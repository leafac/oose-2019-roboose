import { App } from "@octokit/app";
import pluginRetry from "@octokit/plugin-retry";
import pluginThrottling from "@octokit/plugin-throttling";
import Octokit from "@octokit/rest";
import { Command } from "commander";
import dotenv from "dotenv";
import inquirer from "inquirer";
import open from "open";
import fs from "fs";

const program = new Command();

program
  .command("initialize")
  .description(
    "create the teams and repositories for staff and students, and the issues that serve as a database"
  )
  .action(async () => {
    await octokit.teams.create({
      org: "jhu-oose",
      name: `${process.env.COURSE}-students`,
      privacy: "closed"
    });
    await octokit.teams.create({
      org: "jhu-oose",
      name: `${process.env.COURSE}-staff`,
      privacy: "closed"
    });

    await octokit.repos.createInOrg({
      org: "jhu-oose",
      name: "instructors",
      description: "Documentation and credentials",
      private: true,
      has_projects: false,
      has_wiki: false
    });
    await octokit.repos.createInOrg({
      org: "jhu-oose",
      name: `${process.env.COURSE}-staff`,
      description: "Staff forum, grading, and pedagogical material",
      private: true,
      has_projects: false,
      has_wiki: false
    });
    await octokit.repos.createInOrg({
      org: "jhu-oose",
      name: `${process.env.COURSE}-students`,
      description: "Public forum and lectures videos",
      private: true,
      has_projects: false,
      has_wiki: false
    });

    await octokit.teams.addOrUpdateRepo({
      team_id: (await octokit.teams.getByName({
        org: "jhu-oose",
        team_slug: `${process.env.COURSE}-staff`
      })).data.id,
      owner: "jhu-oose",
      repo: `${process.env.COURSE}-staff`,
      permission: "push"
    });
    await octokit.teams.addOrUpdateRepo({
      team_id: (await octokit.teams.getByName({
        org: "jhu-oose",
        team_slug: `${process.env.COURSE}-staff`
      })).data.id,
      owner: "jhu-oose",
      repo: `${process.env.COURSE}-students`,
      permission: "push"
    });
    await octokit.teams.addOrUpdateRepo({
      team_id: (await octokit.teams.getByName({
        org: "jhu-oose",
        team_slug: `${process.env.COURSE}-students`
      })).data.id,
      owner: "jhu-oose",
      repo: `${process.env.COURSE}-students`,
      permission: "pull"
    });

    for (const title of [
      "Students",
      "Assignments",
      "Feedbacks",
      "Groups",
      "Iterations"
    ]) {
      const issue = (await octokit.issues.create({
        owner: "jhu-oose",
        repo: `${process.env.COURSE}-staff`,
        title,
        labels: ["database"]
      })).data.number;
      await octokit.issues.update({
        owner: "jhu-oose",
        repo: `${process.env.COURSE}-staff`,
        issue_number: issue
      });
      console.log(`ISSUE_${title.toUpperCase()}=${issue}`);
    }
  });

program.command("students:check").action(async () => {
  const configuration = await getConfiguration();
  const registrations = (await octokit.paginate(
    octokit.issues.listComments.endpoint.merge({
      owner: "jhu-oose",
      repo: `${process.env.COURSE}-staff`,
      issue_number: Number(process.env.ISSUE_STUDENTS)
    })
  )).map(deserializeResponse);
  for (const { github, hopkins } of registrations) {
    await checkFile("assignments/0.md", "student", [github]);
    if (!configuration.hopkinses.includes(hopkins)) {
      try {
        await octokit.repos.get({
          owner: "jhu-oose",
          repo: `${process.env.COURSE}-student-${github}`
        });
        console.log(
          `Student doesn’t appear registered in SIS. GitHub: ${github}. Hopkins: ${hopkins}.`
        );
      } catch {}
    }
  }
});

program.command("students:profiles").action(async () => {
  for (const github of await getStudents()) {
    await open(
      `https://github.com/jhu-oose/${process.env.COURSE}-student-${github}`
    );
    await inquirer.prompt([
      { name: "Press ENTER to open next student’s profile" }
    ]);
  }
});

program.command("students:delete <github>").action(async github => {
  console.log(
    `You must manually remove the student data from https://github.com/jhu-oose/${process.env.COURSE}-staff/issues/${process.env.ISSUE_STUDENTS}`
  );
  console.log(
    `You may need to cancel the invitation manually at https://github.com/orgs/jhu-oose/people if the student you’re deleting hasn’t accepted it yet (there’s no endpoint in the GitHub API to automate this)`
  );
  try {
    await octokit.orgs.removeMember({
      org: "jhu-oose",
      username: github
    });
  } catch {}
  try {
    await octokit.repos.delete({
      owner: "jhu-oose",
      repo: `${process.env.COURSE}-student-${github}`
    });
  } catch {}
});

program
  .command("students:files:upload <source> <destination>")
  .action(async (source, destination) => {
    await uploadFile(source, destination, "student", await getStudents());
  });

program.command("students:files:check <path>").action(async path => {
  await checkFile(path, "student", await getStudents());
});

program.command("students:files:delete <path>").action(async path => {
  await deleteFile(path, "student", await getStudents());
});

program
  .command("assignments:templates:add <assignment>")
  .action(async assignment => {
    await uploadFile(
      `templates/students/assignments/${assignment}.md`,
      `assignments/${assignment}.md`,
      "student",
      await getStudents()
    );
  });

program
  .command("assignments:submissions:add <assignment> <github> <commit> <time>")
  .action(async (assignment, github, commit, time) => {
    await octokit.repos.getContents({
      owner: "jhu-oose",
      repo: `${process.env.COURSE}-student-${github}`,
      path: `assignments/${assignment}.md`,
      ref: commit
    });
    const submission = {
      assignment,
      github,
      commit,
      time: new Date(time)
    };
    await octokit.issues.createComment({
      owner: "jhu-oose",
      repo: `${process.env.COURSE}-staff`,
      issue_number: Number(process.env.ISSUE_ASSIGNMENTS),
      body: serialize(submission)
    });
    await octokit.issues.create({
      owner: "jhu-oose",
      repo: `${process.env.COURSE}-student-${github}`,
      title: `Assignment ${assignment} received`,
      body: `${serialize(submission)}

/cc @${github}
`
    });
  });

program
  .command("assignments:submissions:check <github>")
  .action(async github => {
    const submissions = (await octokit.paginate(
      octokit.issues.listComments.endpoint.merge({
        owner: "jhu-oose",
        repo: `${process.env.COURSE}-staff`,
        issue_number: Number(process.env.ISSUE_ASSIGNMENTS)
      })
    ))
      .map(deserializeResponse)
      .filter(submission => submission.github === github);
    for (const submission of submissions) {
      console.log(serialize(submission));
    }
  });

program
  .command("assignments:grades:start <assignment>")
  .action(async assignment => {
    const allSubmissions = (await octokit.paginate(
      octokit.issues.listComments.endpoint.merge({
        owner: "jhu-oose",
        repo: `${process.env.COURSE}-staff`,
        issue_number: Number(process.env.ISSUE_ASSIGNMENTS)
      })
    )).map(deserializeResponse);
    const submissions = allSubmissions.filter(
      submission =>
        submission.assignment === assignment &&
        !allSubmissions.some(
          otherSubmission =>
            submission.assignment === otherSubmission.assignment &&
            submission.github === otherSubmission.github &&
            Date.parse(submission.time) < Date.parse(otherSubmission.time)
        )
    );
    const parts = (await getStaffFile(
      `templates/students/assignments/${assignment}.md`
    ))
      .match(/^# .*/gm)!
      .slice(1)
      .map(heading => heading.slice("# ".length));
    const milestone = (await octokit.issues.createMilestone({
      owner: "jhu-oose",
      repo: `${process.env.COURSE}-staff`,
      title: `Grade Assignment ${assignment}`
    })).data.number;
    for (const part of parts) {
      const slug = slugify(part);
      const path = `grades/students/assignments/${assignment}/${slug}.md`;
      const template = `# Rubric

# Grades

${submissions
  .map(
    ({
      github,
      commit
    }) => `## [${github}](https://github.com/jhu-oose/${process.env.COURSE}-student-${github}/blob/${commit}/assignments/${assignment}.md#${slug})



**Grader:** 

`
  )
  .join("")}
`;
      await octokit.repos.createOrUpdateFile({
        owner: "jhu-oose",
        repo: `${process.env.COURSE}-staff`,
        path,
        message: `Add ${path}`,
        content: render(template)
      });
      await octokit.issues.create({
        owner: "jhu-oose",
        repo: `${process.env.COURSE}-staff`,
        title: `Grade Assignment ${assignment}: ${part}`,
        labels: ["assignment"],
        milestone,
        body: `[${path}](https://github.com/jhu-oose/${process.env.COURSE}-staff/blob/master/${path})

/cc @jhu-oose/${process.env.COURSE}-staff
`
      });
    }
  });

program
  .command("assignments:grades:publish <assignment>")
  .action(async assignment => {
    const staff = (await octokit.paginate(
      octokit.teams.listMembers.endpoint.merge({
        team_id: (await octokit.teams.getByName({
          org: "jhu-oose",
          team_slug: `${process.env.COURSE}-staff`
        })).data.id
      })
    )).map(member => member.login);
    const [title, ...parts] = (await getStaffFile(
      `templates/students/assignments/${assignment}.md`
    ))
      .match(/^# .*/gm)!
      .map(heading => heading.slice("# ".length));
    type Github = string;
    type Grade = string;
    const partsGradesMappings = new Array<Map<Github, Grade>>();
    for (const part of parts) {
      const [, rubricSection, gradesSection] = (await getStaffFile(
        `grades/students/assignments/${assignment}/${slugify(part)}.md`
      )).match(/^# Rubric(.*)^# Grades(.*)/ms)!;
      type RubricItemName = string;
      type RubricItemContent = string;
      const rubric = rubricSection
        .split(/^##\s*/m)
        .slice(1)
        .reduce((rubric, item) => {
          const [, name, content] = item.match(/(.*?)\n(.*)/s)!;
          content.split("\n").forEach(line => {
            if (!line.match(/^\*\*(-|\+)\d+\*\*/) && line !== "")
              throw `Error in rubric section (missing points?) (Part: ‘${part}’ · Name: ‘${name}’ · Line: ‘${line}’)`;
          });
          return rubric.set(name, content);
        }, new Map<RubricItemName, RubricItemContent>());
      const partGradesMappings = gradesSection
        .split(/^##\s*/m)
        .slice(1)
        .reduce((partGradesMappings, entry) => {
          const [, github, url, rawContent] = entry.match(
            /\[(.*?)\]\((.*?)\)(.*)/s
          )!;
          const content = rawContent
            .split("\n")
            .map(line => {
              if (line.match(/^\*\*(-|\+)\d+\*\*/)) {
                return line;
              } else if (line.match(/^\*\*Grader:\*\*/)) {
                const [, grader] = line.match(/^\*\*Grader:\*\*\s*(.*)/)!;
                if (!staff.includes(grader))
                  throw `Grader ‘${grader}’ isn’t a member of GitHub team ‘${process.env.COURSE}-staff’ (Part: ‘${part}’ · Student: ‘${github}’)`;
                return line;
              } else if (line === "") {
                return line;
              } else if (rubric.has(line)) {
                return rubric.get(line);
              } else {
                throw `Error in grade section (misuse of rubric?) (Part: ‘${part}’ · Student: ‘${github}’ · Line: ‘${line}’)`;
              }
            })
            .join("\n");
          return partGradesMappings.set(
            github,
            `# [${part}](${url})

${content}
`
          );
        }, new Map<Github, Grade>());
      partsGradesMappings.push(partGradesMappings);
    }
    const aggregatedGradesMappings = partsGradesMappings.reduce(
      (gradesMappings, partGradesMappings) => {
        const augmentedGradesMappings = new Map();
        if (gradesMappings.size !== partGradesMappings.size)
          throw "Different number of students in the grading files for the different parts of the assignment";
        for (const github of gradesMappings.keys()) {
          if (!partGradesMappings.has(github))
            throw `Student ${github} is in one of the grading files, but not the other.`;
          augmentedGradesMappings.set(
            github,
            gradesMappings.get(github)! + partGradesMappings.get(github)!
          );
        }
        return augmentedGradesMappings;
      }
    );
    const totalsGradesMappings = new Map();
    for (const [github, grade] of aggregatedGradesMappings) {
      const points = (grade.match(/^\*\*(-|\+)\d+\*\*/gm) || []).map(point =>
        Number(point.slice("**".length, point.length - "**".length))
      );
      const total = points.reduce((a, b) => a + b, 100);
      totalsGradesMappings.set(
        github,
        `# ${title}

${grade}

---

**Total:** ${total}/100

To accept the grade, close this issue.

To request a regrade, comment on this issue within one week. Mention the grader of the part, for example, if the grader of the part is \`jhu-oose-example-ca\`, mention with \`@jhu-oose-example-ca\`.

/cc @${github}
`
      );
    }
    for (const [github, grade] of totalsGradesMappings) {
      try {
        if (
          (await octokit.paginate(
            octokit.issues.listForRepo.endpoint.merge({
              owner: "jhu-oose",
              repo: `${process.env.COURSE}-student-${github}`
            })
          )).find(
            issue => issue.title === `Grade for assignment ${assignment}`
          ) === undefined
        ) {
          await octokit.issues.create({
            owner: "jhu-oose",
            repo: `${process.env.COURSE}-student-${github}`,
            title: `Grade for assignment ${assignment}`,
            body: grade
          });
        }
      } catch (e) {
        console.log(`Problem with student ‘${github}’: ${e}`);
      }
    }
    await octokit.issues.updateMilestone({
      owner: "jhu-oose",
      repo: `${process.env.COURSE}-staff`,
      milestone_number: (await octokit.paginate(
        octokit.issues.listMilestonesForRepo.endpoint.merge({
          owner: "jhu-oose",
          repo: `${process.env.COURSE}-staff`
        })
      )).find(
        milestone =>
          milestone.title === `Grade Assignment ${assignment}`
      ).number,
      state: "closed"
    });
  });

program
  .command("quiz:submissions:add <path-to-scanned-pdfs>")
  .action(async pathToScannedPdfs => {
    const pdfs = fs
      .readdirSync(pathToScannedPdfs)
      .filter(file => file.endsWith(".pdf"));
    for (const pdf of pdfs) {
      const github = pdf.slice(0, pdf.length - ".pdf".length);
      const repo = `${process.env.COURSE}-student-${github}`;
      try {
        await octokit.repos.createOrUpdateFile({
          owner: "jhu-oose",
          repo,
          path: "quiz.pdf",
          message: "Add quiz.pdf",
          content: fs
            .readFileSync(`${pathToScannedPdfs}/${pdf}`)
            .toString("base64")
        });
      } catch (error) {
        console.log(`Error with ${github}: ${error}`);
      }
    }
  });

program.command("quiz:grades:start").action(async () => {
  const githubs = (await octokit.paginate(
    octokit.teams.listMembers.endpoint.merge({
      team_id: (await octokit.teams.getByName({
        org: "jhu-oose",
        team_slug: `${process.env.COURSE}-students`
      })).data.id
    })
  )).map(s => s.login);
  const parts = (await getStaffFile("templates/students/quiz.md"))
    .match(/^# .*/gm)!
    .slice(1)
    .map(heading => heading.slice("# ".length));
  const milestone = (await octokit.issues.createMilestone({
    owner: "jhu-oose",
    repo: `${process.env.COURSE}-staff`,
    title: `Grade quiz`
  })).data.number;
  for (const part of parts) {
    const slug = slugify(part);
    const path = `grades/students/quiz/${slug}.md`;
    const template = `# Rubric

# Grades

${githubs
  .map(
    github => `## [${github}](https://github.com/jhu-oose/${process.env.COURSE}-student-${github}/blob/master/quiz.pdf)



**Grader:** 

`
  )
  .join("")}
`;
    await octokit.repos.createOrUpdateFile({
      owner: "jhu-oose",
      repo: `${process.env.COURSE}-staff`,
      path,
      message: `Add ${path}`,
      content: render(template)
    });
    await octokit.issues.create({
      owner: "jhu-oose",
      repo: `${process.env.COURSE}-staff`,
      title: `Grade quiz: ${part}`,
      labels: ["quiz"],
      milestone,
      body: `[${path}](https://github.com/jhu-oose/${process.env.COURSE}-staff/blob/master/${path})

/cc @jhu-oose/${process.env.COURSE}-staff
`
    });
  }
});

program.command("quiz:grades:publish").action(async () => {
  const staff = (await octokit.paginate(
    octokit.teams.listMembers.endpoint.merge({
      team_id: (await octokit.teams.getByName({
        org: "jhu-oose",
        team_slug: `${process.env.COURSE}-staff`
      })).data.id
    })
  )).map(member => member.login);
  const [title, ...parts] = (await getStaffFile("templates/students/quiz.md"))
    .match(/^# .*/gm)!
    .map(heading => heading.slice("# ".length));
  type Github = string;
  type Grade = string;
  const partsGradesMappings = new Array<Map<Github, Grade>>();
  for (const part of parts) {
    const [, rubricSection, gradesSection] = (await getStaffFile(
      `grades/students/quiz/${slugify(part)}.md`
    )).match(/^# Rubric(.*)^# Grades(.*)/ms)!;
    type RubricItemName = string;
    type RubricItemContent = string;
    const rubric = rubricSection
      .split(/^##\s*/m)
      .slice(1)
      .reduce((rubric, item) => {
        const [, name, content] = item.match(/(.*?)\n(.*)/s)!;
        content.split("\n").forEach(line => {
          if (!line.match(/^\*\*(-|\+)\d+\*\*/) && line !== "")
            throw `Error in rubric section (missing points?) (Part: ‘${part}’ · Name: ‘${name}’ · Line: ‘${line}’)`;
        });
        return rubric.set(name, content);
      }, new Map<RubricItemName, RubricItemContent>());
    const partGradesMappings = gradesSection
      .split(/^##\s*/m)
      .slice(1)
      .reduce((partGradesMappings, entry) => {
        const [, github, url, rawContent] = entry.match(
          /\[(.*?)\]\((.*?)\)(.*)/s
        )!;
        const content = rawContent
          .split("\n")
          .map(line => {
            if (line.match(/^\*\*(-|\+)\d+\*\*/)) {
              return line;
            } else if (line.match(/^\*\*Grader:\*\*/)) {
              const [, grader] = line.match(/^\*\*Grader:\*\*\s*(.*)/)!;
              if (!staff.includes(grader))
                throw `Grader ‘${grader}’ isn’t a member of GitHub team ‘${process.env.COURSE}-staff’ (Part: ‘${part}’ · Student: ‘${github}’)`;
              return line;
            } else if (line === "") {
              return line;
            } else if (rubric.has(line)) {
              return rubric.get(line);
            } else {
              throw `Error in grade section (misuse of rubric?) (Part: ‘${part}’ · Student: ‘${github}’ · Line: ‘${line}’)`;
            }
          })
          .join("\n");
        return partGradesMappings.set(
          github,
          `# [${part}](${url})

${content}
`
        );
      }, new Map<Github, Grade>());
    partsGradesMappings.push(partGradesMappings);
  }
  const aggregatedGradesMappings = partsGradesMappings.reduce(
    (gradesMappings, partGradesMappings) => {
      const augmentedGradesMappings = new Map();
      if (gradesMappings.size !== partGradesMappings.size)
        throw "Different number of students in the grading files for the different parts of the quiz";
      for (const github of gradesMappings.keys()) {
        if (!partGradesMappings.has(github))
          throw `Student ${github} is in one of the grading files, but not the other.`;
        augmentedGradesMappings.set(
          github,
          gradesMappings.get(github)! + partGradesMappings.get(github)!
        );
      }
      return augmentedGradesMappings;
    }
  );
  const totalsGradesMappings = new Map();
  for (const [github, grade] of aggregatedGradesMappings) {
    const points = (grade.match(/^\*\*(-|\+)\d+\*\*/gm) || []).map(point =>
      Number(point.slice("**".length, point.length - "**".length))
    );
    const total = points.reduce((a, b) => a + b, 100);
    totalsGradesMappings.set(
      github,
      `# ${title}

${grade}

---

**Total:** ${total}/100

To accept the grade, close this issue.

To request a regrade, comment on this issue within one week. Mention the grader of the part, for example, if the grader of the part is \`jhu-oose-example-ca\`, mention with \`@jhu-oose-example-ca\`.

/cc @${github}
`
    );
  }
  for (const [github, grade] of totalsGradesMappings) {
    try {
      if (
        (await octokit.paginate(
          octokit.issues.listForRepo.endpoint.merge({
            owner: "jhu-oose",
            repo: `${process.env.COURSE}-student-${github}`
          })
        )).find(issue => issue.title === `Grade for quiz`) === undefined
      ) {
        await octokit.issues.create({
          owner: "jhu-oose",
          repo: `${process.env.COURSE}-student-${github}`,
          title: `Grade for quiz`,
          body: grade
        });
      }
    } catch (e) {
      console.log(`Problem with student ‘${github}’: ${e}`);
    }
  }
  await octokit.issues.updateMilestone({
    owner: "jhu-oose",
    repo: `${process.env.COURSE}-staff`,
    milestone_number: (await octokit.paginate(
      octokit.issues.listMilestonesForRepo.endpoint.merge({
        owner: "jhu-oose",
        repo: `${process.env.COURSE}-staff`
      })
    )).find(milestone => milestone.title === `Grade quiz`).number,
    state: "closed"
  });
});

program.command("feedbacks:read").action(async () => {
  const feedbacks = (await octokit.paginate(
    octokit.issues.listComments.endpoint.merge({
      owner: "jhu-oose",
      repo: `${process.env.COURSE}-staff`,
      issue_number: Number(process.env.ISSUE_FEEDBACKS)
    })
  )).map(deserializeResponse);
  for (const feedback of feedbacks) {
    console.log(`**Assignment:** ${feedback.assignment}

**Lecture Liked:** ${feedback.feedback.lecture.liked}

**Lecture Improved:** ${feedback.feedback.lecture.improved}

**Assignment Liked:** ${feedback.feedback.assignment.liked}

**Assignment Improved:** ${feedback.feedback.assignment.improved}

---
`);
  }
  for (const feedback of feedbacks) {
    if (feedback.feedback.course !== undefined) {
      console.log(`**Course Recommend:** ${feedback.feedback.course.recommend}

**Course Liked:** ${feedback.feedback.course.liked}

**Course Improved:** ${feedback.feedback.course.improved}

**Staff Liked:** ${feedback.feedback.course.staff.liked}

**Staff Comment:** ${feedback.feedback.course.staff["open-ended"]}

---
`);
    }
  }
});

program.command("groups:delete <identifier>").action(async identifier => {
  console.log(
    `You must manually remove the group data from https://github.com/jhu-oose/${process.env.COURSE}-staff/issues/${process.env.ISSUE_GROUPS}`
  );
  try {
    await octokit.teams.delete({
      team_id: (await octokit.teams.getByName({
        org: "jhu-oose",
        team_slug: `${process.env.COURSE}-group-${identifier}`
      })).data.id
    });
  } catch {}
  try {
    await octokit.repos.delete({
      owner: "jhu-oose",
      repo: `${process.env.COURSE}-group-${identifier}`
    });
  } catch {}
});

program
  .command("groups:files:upload <source> <destination>")
  .action(async (source, destination) => {
    await uploadFile(source, destination, "group", await getGroups());
  });

program.command("groups:files:check <path>").action(async path => {
  await checkFile(path, "group", await getGroups());
});

program.command("groups:files:delete <path>").action(async path => {
  await deleteFile(path, "group", await getGroups());
});

program
  .command("iterations:collect <iteration>")
  .description(
    "run this when iteration is due to put group projects in database"
  )
  .action(async iteration => {
    for (const github of await getGroups()) {
      const commit = (await octokit.repos.getCommit({
        owner: "jhu-oose",
        repo: `${process.env.COURSE}-group-${github}`,
        ref: "master"
      })).data.sha;
      const submission = {
        iteration,
        github,
        commit,
        time: new Date()
      };
      await octokit.issues.createComment({
        owner: "jhu-oose",
        repo: `${process.env.COURSE}-staff`,
        issue_number: Number(process.env.ISSUE_ITERATIONS),
        body: serialize(submission)
      });
      await octokit.issues.create({
        owner: "jhu-oose",
        repo: `${process.env.COURSE}-group-${github}`,
        title: `Iteration ${iteration} received`,
        body: `${serialize(submission)}

/cc @jhu-oose/${process.env.COURSE}-group-${github.toLowerCase()}
`
      });
    }
  });

program
  .command("iterations:grades:start <iteration>")
  .action(async iteration => {
    const configuration = await getConfiguration();
    const submissions = (await octokit.paginate(
      octokit.issues.listComments.endpoint.merge({
        owner: "jhu-oose",
        repo: `${process.env.COURSE}-staff`,
        issue_number: Number(process.env.ISSUE_ITERATIONS)
      })
    ))
      .map(deserializeResponse)
      .filter(submission => submission.iteration === iteration);
    const template = await getStaffFile(
      `templates/groups/iterations/${iteration}.md`
    );
    const milestone = (await octokit.issues.createMilestone({
      owner: "jhu-oose",
      repo: `${process.env.COURSE}-staff`,
      title: `Grade Iteration ${iteration}`
    })).data.number;
    for (const { github, commit } of submissions) {
      const path = `grades/groups/iterations/${iteration}/${github}.md`;
      const advisor = configuration.advisors[github];
      await octokit.repos.createOrUpdateFile({
        owner: "jhu-oose",
        repo: `${process.env.COURSE}-staff`,
        path,
        message: `Add ${path}`,
        content: render(template, { github, commit, advisor })
      });
      await octokit.issues.create({
        owner: "jhu-oose",
        repo: `${process.env.COURSE}-staff`,
        title: `Grade Iteration ${iteration}: ${github}`,
        labels: ["iteration"],
        milestone,
        assignees: [advisor],
        body: `[${path}](https://github.com/jhu-oose/${process.env.COURSE}-staff/blob/master/${path})

/cc @${advisor}
`
      });
    }
  });

program
  .command("iterations:grades:publish <iteration>")
  .action(async iteration => {
    for (const node of await listStaffDirectory(
      `grades/groups/iterations/${iteration}/`
    )) {
      const github = node.slice(0, node.length - ".md".length);
      await octokit.issues.create({
        owner: "jhu-oose",
        repo: `${process.env.COURSE}-group-${github}`,
        title: `Grade for Iteration ${iteration}`,
        body: `${await getStaffFile(
          `grades/groups/iterations/${iteration}/${node}`
        )}

---

To accept, close this issue.

To request a change, comment on this issue within one week. Mention the advisor, for example, if your advisor is \`jhu-oose-example-ca\`, mention with \`@jhu-oose-example-ca\`.

You may get some points back for things that you fix, and you have to discuss this with your advisor.

/cc @jhu-oose/${process.env.COURSE}-group-${github.toLowerCase()}
`
      });
    }
    await octokit.issues.updateMilestone({
      owner: "jhu-oose",
      repo: `${process.env.COURSE}-staff`,
      milestone_number: (await octokit.paginate(
        octokit.issues.listMilestonesForRepo.endpoint.merge({
          owner: "jhu-oose",
          repo: `${process.env.COURSE}-staff`
        })
      )).find(
        milestone =>
          milestone.title === `Grade Iteration ${iteration}`
      ).number,
      state: "closed"
    });
  });

program
  .command("one-off")
  .description("hack task to run locally (never commit changes to this)")
  .action(async () => {});

dotenv.config();

const octokit = new (Octokit.plugin([pluginThrottling, pluginRetry]))({
  async auth() {
    const app = new App({
      id: Number(process.env.APP_ID),
      privateKey: String(process.env.PRIVATE_KEY)
    });
    const installationAccessToken = await app.getInstallationAccessToken({
      installationId: Number(process.env.INSTALLATION_ID)
    });
    return `token ${installationAccessToken}`;
  },
  throttle: {
    onRateLimit: () => true,
    onAbuseLimit: () => true
  }
});

async function getConfiguration(): Promise<any> {
  return JSON.parse(await getStaffFile("configuration.json"));
}

async function getStudents(): Promise<string[]> {
  return (await octokit.paginate(
    octokit.teams.listMembers.endpoint.merge({
      team_id: (await octokit.teams.getByName({
        org: "jhu-oose",
        team_slug: `${process.env.COURSE}-students`
      })).data.id
    })
  )).map(member => member.login);
}

async function getGroups(): Promise<string[]> {
  return (await octokit.paginate(
    octokit.teams.list.endpoint.merge({
      org: "jhu-oose"
    })
  ))
    .filter(team => team.slug.startsWith(`${process.env.COURSE}-group-`))
    .map(team => team.slug);
}

async function getStaffFile(path: string): Promise<string> {
  return Buffer.from(
    (await octokit.repos.getContents({
      owner: "jhu-oose",
      repo: `${process.env.COURSE}-staff`,
      path
    })).data.content,
    "base64"
  ).toString();
}

async function listStaffDirectory(path: string): Promise<string[]> {
  return (await octokit.repos.getContents({
    owner: "jhu-oose",
    repo: `${process.env.COURSE}-staff`,
    path
  })).data.map((node: any) => node.name);
}

type Kind = "student" | "group";

async function uploadFile(
  source: string,
  destination: string,
  kind: Kind,
  githubs: string[],
  scopeGenerator: (github: string) => object = github => {
    return {};
  }
): Promise<void> {
  const template = await getStaffFile(source);
  for (const github of githubs) {
    try {
      await octokit.repos.createOrUpdateFile({
        owner: "jhu-oose",
        repo: `${process.env.COURSE}-${kind}-${github}`,
        path: destination,
        message: `Add ${destination}`,
        content: render(template, scopeGenerator(github))
      });
    } catch (error) {
      console.log(`Error with ${github}: ${error}`);
    }
  }
  await octokit.issues.create({
    owner: "jhu-oose",
    repo: `${process.env.COURSE}-students`,
    title: `File ${destination} added to your ${kind} repository`,
    body: `See \`https://github.com/jhu-oose/${process.env.COURSE}-${kind}-<identifier>/blob/master/${destination}\`.

/cc @jhu-oose/${process.env.COURSE}-students
`
  });
}

async function checkFile(
  path: string,
  kind: Kind,
  githubs: string[]
): Promise<void> {
  for (const github of githubs) {
    try {
      await octokit.repos.getContents({
        owner: "jhu-oose",
        repo: `${process.env.COURSE}-${kind}-${github}`,
        path
      });
    } catch (error) {
      console.log(`Error with ${github}: ${error}`);
    }
  }
}

async function deleteFile(
  path: string,
  kind: Kind,
  githubs: string[]
): Promise<void> {
  for (const github of githubs) {
    try {
      await octokit.repos.deleteFile({
        owner: "jhu-oose",
        repo: `${process.env.COURSE}-${kind}-${github}`,
        path,
        message: `Delete ${path}`,
        sha: (await octokit.repos.getContents({
          owner: "jhu-oose",
          repo: `${process.env.COURSE}-${kind}-${github}`,
          path
        })).data.sha
      });
    } catch (error) {
      console.log(`Error with ${github}: ${error}`);
    }
  }
}

function render(template: string, scope: object = {}): string {
  return Buffer.from(
    new Function(
      ...Object.keys(scope),
      `return \`${template.replace(/`/g, "\\`")}\`;`
    )(...Object.values(scope))
  ).toString("base64");
}

function serialize(data: any): string {
  return `\`\`\`json
${JSON.stringify(data, undefined, 2)}
\`\`\`
`;
}

function deserialize(issueBody: string): any {
  return JSON.parse(
    issueBody
      .trim()
      .replace(/^```json/, "")
      .replace(/```$/, "")
  );
}

function deserializeResponse(response: { body: string }): any {
  return deserialize(response.body);
}

function slugify(string: string): string {
  return string
    .toLowerCase()
    .replace(/ /g, "-")
    .replace(/[^a-z\-]/g, "");
}

program.command("*").action(() => {
  program.help();
});
if (process.argv.length === 2) program.help();
program.parse(process.argv);

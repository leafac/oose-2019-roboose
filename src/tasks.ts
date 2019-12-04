import { App } from "@octokit/app";
import pluginRetry from "@octokit/plugin-retry";
import pluginThrottling from "@octokit/plugin-throttling";
import Octokit from "@octokit/rest";
import { Command } from "commander";
import dotenv from "dotenv";
import inquirer from "inquirer";
import open from "open";
import slugifyOriginal from "slugify";
import fs from "fs";

const program = new Command();

program
  .command("initialize")
  .description(
    "create the teams and repositories for staff and students, and the issues that serve as a database"
  )
  .action(async () => {
    const octokit = robooseOctokit();
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

    console.log(
      `ISSUE_STUDENTS=${
        (await octokit.issues.create({
          owner: "jhu-oose",
          repo: `${process.env.COURSE}-staff`,
          title: "Students",
          labels: ["data"]
        })).data.number
      }`
    );
    console.log(
      `ISSUE_ASSIGNMENTS=${
        (await octokit.issues.create({
          owner: "jhu-oose",
          repo: `${process.env.COURSE}-staff`,
          title: "Assignments",
          labels: ["data"]
        })).data.number
      }`
    );
    console.log(
      `ISSUE_FEEDBACKS=${
        (await octokit.issues.create({
          owner: "jhu-oose",
          repo: `${process.env.COURSE}-staff`,
          title: "Feedbacks",
          labels: ["data"]
        })).data.number
      }`
    );
    console.log(
      `ISSUE_GROUPS=${
        (await octokit.issues.create({
          owner: "jhu-oose",
          repo: `${process.env.COURSE}-staff`,
          title: "Groups",
          labels: ["data"]
        })).data.number
      }`
    );
    console.log(
      `ISSUE_ITERATIONS=${
        (await octokit.issues.create({
          owner: "jhu-oose",
          repo: `${process.env.COURSE}-staff`,
          title: "Iterations",
          labels: ["data"]
        })).data.number
      }`
    );
    console.log(
      `ISSUE_SELF_REVIEWS=${
        (await octokit.issues.create({
          owner: "jhu-oose",
          repo: `${process.env.COURSE}-staff`,
          title: "Self Reviews",
          labels: ["data"]
        })).data.number
      }`
    );
  });

program.command("students:check:registration").action(async () => {
  const octokit = robooseOctokit();
  const students = (await octokit.paginate(
    octokit.issues.listComments.endpoint.merge({
      owner: "jhu-oose",
      repo: `${process.env.COURSE}-staff`,
      issue_number: Number(process.env.ISSUE_STUDENTS)
    })
  )).map(deserializeResponse);
  for (const { github, hopkins } of students) {
    try {
      await octokit.repos.getContents({
        owner: "jhu-oose",
        repo: `${process.env.COURSE}-student-${github}`,
        path: `assignments/0.md`
      });
    } catch (error) {
      console.log(`Error with student ${github}: ${error}`);
    }
  }
});

program.command("students:check:hopkins").action(async () => {
  const octokit = robooseOctokit();
  const configuration = JSON.parse(
    Buffer.from(
      (await octokit.repos.getContents({
        owner: "jhu-oose",
        repo: `${process.env.COURSE}-staff`,
        path: "configuration.json"
      })).data.content,
      "base64"
    ).toString()
  );
  const students = (await octokit.paginate(
    octokit.issues.listComments.endpoint.merge({
      owner: "jhu-oose",
      repo: `${process.env.COURSE}-staff`,
      issue_number: Number(process.env.ISSUE_STUDENTS)
    })
  )).map(deserializeResponse);
  for (const { github, hopkins } of students) {
    if (!configuration.hopkinses.includes(hopkins)) {
      try {
        await octokit.repos.get({
          owner: "jhu-oose",
          repo: `${process.env.COURSE}-student-${github}`
        });
        console.log(github);
      } catch {}
    }
  }
});

program.command("students:delete <github>").action(async github => {
  const octokit = robooseOctokit();
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

program.command("students:profiles:open").action(async github => {
  const octokit = robooseOctokit();
  const repositories = await octokit.paginate(
    octokit.search.repos.endpoint.merge({
      q: `jhu-oose/${process.env.COURSE}-student-`
    })
  );
  for (const { name: repo } of repositories) {
    await open(`https://github.com/jhu-oose/${repo}`);
    await inquirer.prompt([
      { name: "Press ENTER to open next student’s profile" }
    ]);
  }
});

program
  .command("assignments:templates:add <assignment>")
  .description("add assignment starter template to students’s repositories")
  .action(async assignment => {
    const octokit = robooseOctokit();
    const repositories = await octokit.paginate(
      octokit.search.repos.endpoint.merge({
        q: `jhu-oose/${process.env.COURSE}-student-`
      })
    );
    for (const { name: repo } of repositories) {
      try {
        await octokit.repos.createOrUpdateFile({
          owner: "jhu-oose",
          repo,
          path: `assignments/${assignment}.md`,
          message: `Add Assignment ${assignment} template`,
          content: (await octokit.repos.getContents({
            owner: "jhu-oose",
            repo: `${process.env.COURSE}-staff`,
            path: `templates/assignments/${assignment}.md`
          })).data.content
        });
      } catch (error) {
        console.log(`Error with repository ${repo}: ${error}`);
      }
    }
    await octokit.issues.create({
      owner: "jhu-oose",
      repo: `${process.env.COURSE}-students`,
      title: `Assignment ${assignment} template added`,
      body: `See \`assignments/${assignment}.md\` in your personal repository.

/cc @jhu-oose/${process.env.COURSE}-students
`
    });
  });

program
  .command("assignments:templates:check <assignment>")
  .action(async assignment => {
    const octokit = robooseOctokit();
    const repositories = await octokit.paginate(
      octokit.search.repos.endpoint.merge({
        q: `jhu-oose/${process.env.COURSE}-student-`
      })
    );
    for (const { name: repo } of repositories) {
      try {
        await octokit.repos.getContents({
          owner: "jhu-oose",
          repo,
          path: `assignments/${assignment}.md`
        });
      } catch (error) {
        console.log(`Error with repository ${repo}: ${error}`);
      }
    }
  });

program
  .command("assignments:submissions:add <assignment> <github> <commit> <time>")
  .action(async (assignment, github, commit, time) => {
    const octokit = robooseOctokit();
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
    const octokit = robooseOctokit();
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
    const octokit = robooseOctokit();
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
    const parts = Buffer.from(
      (await octokit.repos.getContents({
        owner: "jhu-oose",
        repo: `${process.env.COURSE}-staff`,
        path: `templates/assignments/${assignment}.md`
      })).data.content,
      "base64"
    )
      .toString()
      .match(/^# .*/gm)!
      .slice(1)
      .map(heading => heading.slice("# ".length));
    const milestone = (await octokit.issues.createMilestone({
      owner: "jhu-oose",
      repo: `${process.env.COURSE}-staff`,
      title: `Grade individual assignment ${assignment}`
    })).data.number;
    for (const part of parts) {
      const template = `# Rubric

# Grades

${submissions
  .map(
    ({ github, commit }) => `## [${github}](https://github.com/jhu-oose/${
      process.env.COURSE
    }-student-${github}/blob/${commit}/assignments/${assignment}.md#${slugify(
      part
    )})



**Grader:** 

`
  )
  .join("")}
`;
      await octokit.repos.createOrUpdateFile({
        owner: "jhu-oose",
        repo: `${process.env.COURSE}-staff`,
        path: `grades/assignments/${assignment}/${slugify(part)}.md`,
        message: `Grade individual assignment ${assignment}: ${part}`,
        content: Buffer.from(template).toString("base64")
      });
      await octokit.issues.create({
        owner: "jhu-oose",
        repo: `${process.env.COURSE}-staff`,
        title: `Grade individual assignment ${assignment}: ${part}`,
        labels: ["grading"],
        milestone,
        body: `[\`grades/assignments/${assignment}/${slugify(
          part
        )}.md\`](https://github.com/jhu-oose/${
          process.env.COURSE
        }-staff/blob/master/grades/assignments/${assignment}/${slugify(
          part
        )}.md)

/cc @jhu-oose/${process.env.COURSE}-staff
`
      });
    }
  });

program
  .command("assignments:grades:publish <assignment>")
  .action(async assignment => {
    const octokit = robooseOctokit();
    const staff = (await octokit.paginate(
      octokit.teams.listMembers.endpoint.merge({
        team_id: (await octokit.teams.getByName({
          org: "jhu-oose",
          team_slug: `${process.env.COURSE}-staff`
        })).data.id
      })
    )).map(member => member.login);
    const [title, ...parts] = Buffer.from(
      (await octokit.repos.getContents({
        owner: "jhu-oose",
        repo: `${process.env.COURSE}-staff`,
        path: `templates/assignments/${assignment}.md`
      })).data.content,
      "base64"
    )
      .toString()
      .match(/^# .*/gm)!
      .map(heading => heading.slice("# ".length));
    type Github = string;
    type Grade = string;
    const partsGradesMappings = new Array<Map<Github, Grade>>();
    for (const part of parts) {
      const [, rubricSection, gradesSection] = Buffer.from(
        (await octokit.repos.getContents({
          owner: "jhu-oose",
          repo: `${process.env.COURSE}-staff`,
          path: `grades/assignments/${assignment}/${slugify(part)}.md`
        })).data.content,
        "base64"
      )
        .toString()
        .match(/^# Rubric(.*)^# Grades(.*)/ms)!;
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
          milestone.title === `Grade individual assignment ${assignment}`
      ).number,
      state: "closed"
    });
  });

program
  .command("quiz:submissions:add <path-to-scanned-pdfs>")
  .action(async pathToScannedPdfs => {
    const octokit = robooseOctokit();
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
          path: `quiz.pdf`,
          message: `Add quiz`,
          content: fs
            .readFileSync(`${pathToScannedPdfs}/${pdf}`)
            .toString("base64")
        });
      } catch (error) {
        console.log(`Error with repository ${repo}: ${error}`);
      }
    }
  });

program.command("quiz:submissions:check").action(async () => {
  const octokit = robooseOctokit();
  const githubs = (await octokit.paginate(
    octokit.teams.listMembers.endpoint.merge({
      team_id: (await octokit.teams.getByName({
        org: "jhu-oose",
        team_slug: `${process.env.COURSE}-students`
      })).data.id
    })
  )).map(s => s.login);
  for (const github of githubs) {
    try {
      await octokit.repos.getContents({
        owner: "jhu-oose",
        repo: `${process.env.COURSE}-student-${github}`,
        path: `quiz.pdf`
      });
    } catch (error) {
      console.log(`Error with student ${github}: ${error}`);
    }
  }
});

program.command("quiz:grades:start").action(async () => {
  const octokit = robooseOctokit();
  const githubs = (await octokit.paginate(
    octokit.teams.listMembers.endpoint.merge({
      team_id: (await octokit.teams.getByName({
        org: "jhu-oose",
        team_slug: `${process.env.COURSE}-students`
      })).data.id
    })
  )).map(s => s.login);
  const parts = Buffer.from(
    (await octokit.repos.getContents({
      owner: "jhu-oose",
      repo: `${process.env.COURSE}-staff`,
      path: `templates/quiz.md`
    })).data.content,
    "base64"
  )
    .toString()
    .match(/^# .*/gm)!
    .slice(1)
    .map(heading => heading.slice("# ".length));
  const milestone = (await octokit.issues.createMilestone({
    owner: "jhu-oose",
    repo: `${process.env.COURSE}-staff`,
    title: `Grade quiz`
  })).data.number;
  for (const part of parts) {
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
      path: `grades/quiz/${slugify(part)}.md`,
      message: `Grade quiz: ${part}`,
      content: Buffer.from(template).toString("base64")
    });
    await octokit.issues.create({
      owner: "jhu-oose",
      repo: `${process.env.COURSE}-staff`,
      title: `Grade quiz: ${part}`,
      labels: ["quiz"],
      milestone,
      body: `[\`grades/quiz/${slugify(
        part
      )}.md\`](https://github.com/jhu-oose/${
        process.env.COURSE
      }-staff/blob/master/grades/quiz/${slugify(part)}.md)

/cc @jhu-oose/${process.env.COURSE}-staff
`
    });
  }
});

program
  .command("quiz:grades:publish")
  .action(async () => {
    const octokit = robooseOctokit();
    const staff = (await octokit.paginate(
      octokit.teams.listMembers.endpoint.merge({
        team_id: (await octokit.teams.getByName({
          org: "jhu-oose",
          team_slug: `${process.env.COURSE}-staff`
        })).data.id
      })
    )).map(member => member.login);
    const [title, ...parts] = Buffer.from(
      (await octokit.repos.getContents({
        owner: "jhu-oose",
        repo: `${process.env.COURSE}-staff`,
        path: `templates/quiz.md`
      })).data.content,
      "base64"
    )
      .toString()
      .match(/^# .*/gm)!
      .map(heading => heading.slice("# ".length));
    type Github = string;
    type Grade = string;
    const partsGradesMappings = new Array<Map<Github, Grade>>();
    for (const part of parts) {
      const [, rubricSection, gradesSection] = Buffer.from(
        (await octokit.repos.getContents({
          owner: "jhu-oose",
          repo: `${process.env.COURSE}-staff`,
          path: `grades/quiz/${slugify(part)}.md`
        })).data.content,
        "base64"
      )
        .toString()
        .match(/^# Rubric(.*)^# Grades(.*)/ms)!;
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
          )).find(
            issue => issue.title === `Grade for quiz`
          ) === undefined
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
      )).find(
        milestone =>
          milestone.title === `Grade quiz`
      ).number,
      state: "closed"
    });
  });

program.command("feedbacks:read").action(async () => {
  const octokit = robooseOctokit();
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
});

program.command("groups:delete <identifier>").action(async identifier => {
  const octokit = robooseOctokit();
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
  .command("iterations:template <document>")
  .description("add document starter template to groups’s repositories")
  .action(async document => {
    const octokit = robooseOctokit();
    const repositories = await octokit.paginate(
      octokit.search.repos.endpoint.merge({
        q: `jhu-oose/${process.env.COURSE}-group-`
      })
    );
    for (const { name: repo } of repositories) {
      try {
        await octokit.repos.createOrUpdateFile({
          owner: "jhu-oose",
          repo,
          path: `docs/${document}.md`,
          message: `Add ${document} template`,
          content: (await octokit.repos.getContents({
            owner: "jhu-oose",
            repo: `${process.env.COURSE}-staff`,
            path: `templates/group-projects/${document}.md`
          })).data.content
        });
      } catch (error) {
        console.log(`Error with repository ${repo}: ${error}`);
      }
    }
    await octokit.issues.create({
      owner: "jhu-oose",
      repo: `${process.env.COURSE}-students`,
      title: `Document ‘${document}’ template added`,
      body: `See \`docs/${document}.md\` in your group repository.

/cc @jhu-oose/${process.env.COURSE}-students
`
    });
  });

program
  .command("iterations:collect <iteration>")
  .description(
    "run this when iteration is due to put group projects in database"
  )
  .action(async iteration => {
    const octokit = robooseOctokit();
    const repositories = await octokit.paginate(
      octokit.search.repos.endpoint.merge({
        q: `jhu-oose/${process.env.COURSE}-group-`
      })
    );
    for (const { name } of repositories) {
      const github = name.slice(`${process.env.COURSE}-group-`.length);
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
  .command("iterations:reviews:start <iteration>")
  .action(async iteration => {
    const octokit = robooseOctokit();
    const submissions = (await octokit.paginate(
      octokit.issues.listComments.endpoint.merge({
        owner: "jhu-oose",
        repo: `${process.env.COURSE}-staff`,
        issue_number: Number(process.env.ISSUE_ITERATIONS)
      })
    ))
      .map(deserializeResponse)
      .filter(submission => submission.iteration === iteration);
    const configuration = JSON.parse(
      Buffer.from(
        (await octokit.repos.getContents({
          owner: "jhu-oose",
          repo: `${process.env.COURSE}-staff`,
          path: "configuration.json"
        })).data.content,
        "base64"
      ).toString()
    );
    const template = Buffer.from(
      (await octokit.repos.getContents({
        owner: "jhu-oose",
        repo: `${process.env.COURSE}-staff`,
        path: `templates/iterations/${iteration}.md`
      })).data.content,
      "base64"
    ).toString();
    const milestone = (await octokit.issues.createMilestone({
      owner: "jhu-oose",
      repo: `${process.env.COURSE}-staff`,
      title: `Review group project iteration ${iteration}`
    })).data.number;
    for (const { iteration, github, commit, time } of submissions) {
      const advisor = configuration.advisors[github];
      const renderedTemplate = eval(`\`${template.replace(/`/g, "\\`")}\``);
      await octokit.repos.createOrUpdateFile({
        owner: "jhu-oose",
        repo: `${process.env.COURSE}-staff`,
        path: `grades/iterations/${iteration}/${github}.md`,
        message: `Review group project iteration ${iteration}: ${github}`,
        content: Buffer.from(renderedTemplate).toString("base64")
      });
      await octokit.issues.create({
        owner: "jhu-oose",
        repo: `${process.env.COURSE}-staff`,
        title: `Review group project iteration ${iteration}: ${github}`,
        labels: ["reviewing"],
        milestone,
        assignees: [advisor],
        body: `[\`grades/iterations/${iteration}/${github}.md\`](https://github.com/jhu-oose/${process.env.COURSE}-staff/blob/master/grades/iterations/${iteration}/${github}.md)

/cc @${advisor}
`
      });
    }
  });

program
  .command("iterations:reviews:publish <iteration>")
  .action(async iteration => {
    const octokit = robooseOctokit();
    const reviews = (await octokit.repos.getContents({
      owner: "jhu-oose",
      repo: `${process.env.COURSE}-staff`,
      path: `grades/iterations/${iteration}/`
    })).data;
    for (const { name, path } of reviews) {
      const github = name.slice(0, name.length - ".md".length);
      await octokit.issues.create({
        owner: "jhu-oose",
        repo: `${process.env.COURSE}-group-${github}`,
        title: `Review of iteration ${iteration}`,
        body: `${Buffer.from(
          (await octokit.repos.getContents({
            owner: "jhu-oose",
            repo: `${process.env.COURSE}-staff`,
            path
          })).data.content,
          "base64"
        ).toString()}

---

To accept the review, close this issue.

To request a change, comment on this issue within one week. Mention the reviewer, for example, if your reviewer is \`jhu-oose-example-ca\`, mention with \`@jhu-oose-example-ca\`.

You may get some points back for things that you fix, and you have to discuss this with your reviewer.

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
          milestone.title === `Review group project iteration ${iteration}`
      ).number,
      state: "closed"
    });
  });

program
  .command("one-off")
  .description("hack task to run locally (never commit changes to this)")
  .action(async () => {
    const octokit = robooseOctokit();
  });

dotenv.config();

function robooseOctokit(): Octokit {
  return new (Octokit.plugin([pluginThrottling, pluginRetry]))({
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
  return slugifyOriginal(string, { lower: true });
}

program.command("*").action(() => {
  program.help();
});
if (process.argv.length === 2) program.help();
program.parse(process.argv);

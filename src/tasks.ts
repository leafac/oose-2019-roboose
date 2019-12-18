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
  .command("check-installation")
  .description(
    "check that you installed everything correctly and Roboose is ready to go"
  )
  .action(async () => {
    try {
      await octokit.repos.get({
        owner: "jhu-oose",
        repo: "instructors"
      });
      console.log("Roboose is ready to go!");
    } catch (error) {
      console.error(
        `Ooops, something is wrong with your installation: ${error}`
      );
    }
  });

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
  const { hopkinses } = await getConfiguration();
  const registrations = await getTable(Number(process.env.ISSUE_STUDENTS));
  for (const { github, hopkins } of registrations) {
    await checkFile("assignments/0.md", "student", [github]);
    if (!hopkinses.includes(hopkins)) {
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
    const submissions = (await getTable(
      Number(process.env.ISSUE_ASSIGNMENTS)
    )).filter(submission => submission.github === github);
    for (const submission of submissions) {
      console.log(serialize(submission));
    }
  });

program
  .command("assignments:grades:start <assignment>")
  .action(async assignment => {
    const allSubmissions = await getTable(
      Number(process.env.ISSUE_ASSIGNMENTS)
    );
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
    await startStudentsGrade(
      `Assignment ${assignment}`,
      "assignment",
      submissions,
      `assignments/${assignment}.md`,
      `templates/students/assignments/${assignment}.md`,
      `grades/students/assignments/${assignment}`
    );
  });

program
  .command("assignments:grades:publish <assignment>")
  .action(async assignment => {
    await publishStudentsGrades(
      `Assignment ${assignment}`,
      `grades/students/assignments/${assignment}`
    );
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
        console.error(`Error with ${github}: ${error}`);
      }
    }
  });

program.command("quiz:grades:start").action(async () => {
  const submissions = new Array<{ github: string; commit: string }>();
  for (const github of await getStudents()) {
    submissions.push({
      github,
      commit: (await octokit.repos.getCommit({
        owner: "jhu-oose",
        repo: `${process.env.COURSE}-student-${github}`,
        ref: "master"
      })).data.sha
    });
  }
  await startStudentsGrade(
    "Quiz",
    "quiz",
    submissions,
    "quiz.pdf",
    "templates/students/quiz.md",
    "grades/students/quiz"
  );
});

program.command("quiz:grades:publish").action(async () => {
  await publishStudentsGrades("Quiz", "grades/students/quiz");
});

program.command("feedbacks:read").action(async () => {
  const feedbacks = await getTable(Number(process.env.ISSUE_FEEDBACKS));
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

/cc @jhu-oose/${process.env.COURSE}-group-${slugify(github)}
`
      });
    }
  });

program
  .command("iterations:grades:start <iteration>")
  .action(async iteration => {
    const { advisors } = await getConfiguration();
    const submissions = (await getTable(
      Number(process.env.ISSUE_ITERATIONS)
    )).filter(submission => submission.iteration === iteration);
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
      const advisor = advisors[github];
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
        title: `Grade Iteration ${iteration} · ${github}`,
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
    const gradesPath = `grades/groups/iterations/${iteration}/`;
    for (const node of await listStaffDirectory(gradesPath)) {
      const github = node.slice(0, node.length - ".md".length);
      await octokit.issues.create({
        owner: "jhu-oose",
        repo: `${process.env.COURSE}-group-${github}`,
        title: `Grade for Iteration ${iteration}`,
        body: `${await getStaffFile(`${gradesPath}/${node}`)}

---

${footer(`jhu-oose/${process.env.COURSE}-group-${slugify(github)}`)}
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
      )).find(milestone => milestone.title === `Grade Iteration ${iteration}`)
        .number,
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
    .filter(team => team.name.startsWith(`${process.env.COURSE}-group-`))
    .map(team => team.name.slice(`${process.env.COURSE}-group-`.length));
}

async function getStaff(): Promise<string[]> {
  return (await octokit.paginate(
    octokit.teams.listMembers.endpoint.merge({
      team_id: (await octokit.teams.getByName({
        org: "jhu-oose",
        team_slug: `${process.env.COURSE}-staff`
      })).data.id
    })
  )).map(member => member.login);
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

async function getTable(issueNumber: number): Promise<any[]> {
  return (await octokit.paginate(
    octokit.issues.listComments.endpoint.merge({
      owner: "jhu-oose",
      repo: `${process.env.COURSE}-staff`,
      issue_number: issueNumber
    })
  )).map(response => deserialize(response.body));
}

type RepositoryKind = "student" | "group";

async function uploadFile(
  source: string,
  destination: string,
  repositoryKind: RepositoryKind,
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
        repo: `${process.env.COURSE}-${repositoryKind}-${github}`,
        path: destination,
        message: `Add ${destination}`,
        content: render(template, scopeGenerator(github))
      });
    } catch (error) {
      console.error(`Error with ${github}: ${error}`);
    }
  }
  await octokit.issues.create({
    owner: "jhu-oose",
    repo: `${process.env.COURSE}-students`,
    title: `File ${destination} added to your ${repositoryKind} repository`,
    body: `See \`https://github.com/jhu-oose/${process.env.COURSE}-${repositoryKind}-<identifier>/blob/master/${destination}\`.

/cc @jhu-oose/${process.env.COURSE}-students
`
  });
}

async function checkFile(
  path: string,
  repositoryKind: RepositoryKind,
  githubs: string[]
): Promise<void> {
  for (const github of githubs) {
    try {
      await octokit.repos.getContents({
        owner: "jhu-oose",
        repo: `${process.env.COURSE}-${repositoryKind}-${github}`,
        path
      });
    } catch (error) {
      console.error(`Error with ${github}: ${error}`);
    }
  }
}

async function deleteFile(
  path: string,
  repositoryKind: RepositoryKind,
  githubs: string[]
): Promise<void> {
  for (const github of githubs) {
    try {
      await octokit.repos.deleteFile({
        owner: "jhu-oose",
        repo: `${process.env.COURSE}-${repositoryKind}-${github}`,
        path,
        message: `Delete ${path}`,
        sha: (await octokit.repos.getContents({
          owner: "jhu-oose",
          repo: `${process.env.COURSE}-${repositoryKind}-${github}`,
          path
        })).data.sha
      });
    } catch (error) {
      console.error(`Error with ${github}: ${error}`);
    }
  }
}

async function startStudentsGrade(
  subject: string,
  label: string,
  submissions: { github: string; commit: string }[],
  submissionsPath: string,
  template: string,
  gradesPath: string
): Promise<void> {
  const parts = (await getStaffFile(template)).match(/(?<=^# ).*/gm);
  if (parts === null) {
    console.error(`File ${template} doesn’t include headings for parts.`);
    process.exit(1);
    throw null;
  }
  const milestone = (await octokit.issues.createMilestone({
    owner: "jhu-oose",
    repo: `${process.env.COURSE}-staff`,
    title: `Grade ${subject}`
  })).data.number;
  for (const part of parts) {
    const slug = slugify(part);
    const path = `${gradesPath}/${slug}.md`;
    const template = `# ${part}

# Rubric

## <!-- Identifier of reusable rubric item -->

**-0** <!-- Description of reusable rubric item -->

# Grades

${submissions
  .map(
    ({
      github,
      commit
    }) => `## [\`${github}\`](https://github.com/jhu-oose/${process.env.COURSE}-student-${github}/blob/${commit}/${submissionsPath}#${slug})



**Grader:** \`<!-- GitHub Identifier -->\`

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
      title: `Grade ${subject} · ${part}`,
      labels: [label],
      milestone,
      body: `[\`${path}\`](https://github.com/jhu-oose/${process.env.COURSE}-staff/blob/master/${path})

/cc @jhu-oose/${process.env.COURSE}-staff
`
    });
  }
}

async function publishStudentsGrades(
  subject: string,
  gradesPath: string
): Promise<void> {
  const title = `Grade for ${subject}`;
  for (const [github, grade] of await computeGrades(gradesPath)) {
    try {
      if (
        (await octokit.paginate(
          octokit.issues.listForRepo.endpoint.merge({
            owner: "jhu-oose",
            repo: `${process.env.COURSE}-student-${github}`
          })
        )).some(issue => issue.title === title)
      )
        continue;
      await octokit.issues.create({
        owner: "jhu-oose",
        repo: `${process.env.COURSE}-student-${github}`,
        title,
        body: grade
      });
    } catch (error) {
      console.error(`Error with ${github}: ${error}`);
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
    )).find(milestone => milestone.title === `Grade ${subject}`).number,
    state: "closed"
  });
}

type GitHub = string;
type Grade = string;

async function computeGrades(gradesPath: string): Promise<Map<GitHub, Grade>> {
  const errors = new Array<string>();
  function splitSection(text: string): string[][] {
    return text
      .split(/^## /m)
      .slice(1)
      .map(entry =>
        entry
          .split("\n")
          .map(line => line.trim())
          .filter(line => line.length !== 0)
      );
  }
  const lineRegExp = /^\*\*[-+]\d+\*\* /;
  const staff = await getStaff();
  const grades = new Map<GitHub, Grade>();
  for (const partPath of await listStaffDirectory(gradesPath)) {
    const partText = await getStaffFile(`${gradesPath}/${partPath}`);
    const partMatch = partText.match(
      /^# (.*?)\n+# Rubric\n(.*)\n# Grades\n(.*)/s
    );
    if (partMatch === null) {
      errors.push(
        `Part ${partPath} doesn’t have headings for Rubric and Grades.`
      );
      continue;
    }
    const [, part, rubricText, gradesText] = partMatch;
    const rubric = new Map<string, string>();
    for (const [identifier, ...contents] of splitSection(rubricText)) {
      if (rubric.has(identifier))
        errors.push(`Duplicate rubric item in ${partPath}: ${identifier}`);
      for (const line of contents)
        if (!line.match(lineRegExp))
          errors.push(
            `Line with bad format in ${partPath}, rubric item ${identifier}.`
          );
      rubric.set(identifier, contents.join("\n"));
    }
    const partGrades = new Map<GitHub, Grade>();
    for (const lines of splitSection(gradesText)) {
      const studentLine = lines[0];
      const contents = lines.slice(1, lines.length - 1);
      const graderLine = lines[lines.length - 1];
      const studentLineMatch = studentLine.match(
        /^\[`([A-Za-z0-9-]+)`\]\((.+)\)$/
      );
      if (studentLineMatch === null) {
        errors.push(
          `Student line with bad format in ${partPath}: ${studentLine}`
        );
        continue;
      }
      const [, github, url] = studentLineMatch;
      if (partGrades.has(github))
        errors.push(`Duplicate student in part ${partPath}: ${github}`);
      const renderedContents = new Array<string>();
      for (const line of contents) {
        if (rubric.has(line)) renderedContents.push(rubric.get(line)!);
        else if (line.match(lineRegExp)) renderedContents.push(line);
        else
          errors.push(
            `Line with bad format in ${partPath}, student ${github}: ${line}`
          );
      }
      const graderLineMatch = graderLine.match(
        /^\*\*Grader:\*\* `([A-Za-z0-9-]+)`$/
      );
      if (graderLineMatch === null) {
        errors.push(
          `Grader line with bad format in ${partPath}, student ${github}: ${graderLine}`
        );
        continue;
      }
      const [, grader] = graderLineMatch;
      if (!staff.includes(grader)) {
        errors.push(
          `Grader not in staff in ${partPath}, student ${github}: ${grader}`
        );
        continue;
      }
      partGrades.set(
        github,
        `# [${part}](${url})

${renderedContents.join("\n")}

${graderLine}
`
      );
    }
    if (grades.size === 0) {
      for (const [github, grade] of partGrades) grades.set(github, grade);
    } else {
      if (
        partGrades.size !== grades.size ||
        [...partGrades.keys()].some(github => !grades.has(github))
      )
        errors.push(
          `Students in part ${partPath} aren’t the same as in the other parts.`
        );
      for (const [github, grade] of partGrades)
        grades.set(github, grades.get(github) + "\n" + grade);
    }
  }
  for (const [github, grade] of grades) {
    const pointsTexts =
      grade.match(/^\*\*[-+]\d+\*\*/gm) || new Array<string>();
    const pointsNumbers = pointsTexts.map(pointsText =>
      Number(pointsText.slice("**".length, pointsText.length - "**".length))
    );
    const total = pointsNumbers.reduce((a, b) => a + b, 100);
    grades.set(
      github,
      `${grade}

---

**Total:** ${total}/100

---

${footer(github)}
`
    );
  }
  if (errors.length !== 0) {
    console.error(errors.join("\n"));
    process.exit(1);
  }
  return grades;
}

function footer(mention: string): string {
  return `Comment on this issue and \`@mention\` the grader to ask for clarifications or request a regrade.

/cc @${mention}
`;
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

function slugify(string: string): string {
  return string
    .toLowerCase()
    .replace(/ /g, "-")
    .replace(/[^a-z0-9\-]/g, "");
}

program.command("*").action(() => {
  program.help();
});
if (process.argv.length === 2) program.help();
program.parse(process.argv);

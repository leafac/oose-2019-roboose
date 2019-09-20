import { App } from "@octokit/app";
import pluginRetry from "@octokit/plugin-retry";
import pluginThrottling from "@octokit/plugin-throttling";
import Octokit from "@octokit/rest";
import { Command } from "commander";
import dotenv from "dotenv";
import inquirer from "inquirer";
import open from "open";
import slugifyOriginal from "slugify";

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

/cc @jhu-oose/${process.env.COURSE}-students`
    });
  });

program
  .command("assignments:templates:check <assignment>")
  .action(async assignment => {
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
          path: `assignments/${assignment}.md`
        });
      } catch (error) {
        console.log(`Error with student ${github}: ${error}`);
      }
    }
  });

program
  .command("assignments:submissions:add <assignment> <github> <commit> <time>")
  .action(async (assignment, github, commit, time) => {
    const octokit = robooseOctokit();
    await octokit.repos.getCommit({
      owner: "jhu-oose",
      repo: `${process.env.COURSE}-student-${github}`,
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

/cc @${github}`
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
        message: `Start grading assignment ${assignment}: ${part}`,
        content: Buffer.from(template).toString("base64")
      });
      await octokit.issues.create({
        owner: "jhu-oose",
        repo: `${process.env.COURSE}-staff`,
        title: `Grade individual assignment ${assignment}: ${part}`,
        labels: ["grading"],
        milestone,
        body: `\`grades/assignments/${assignment}/${slugify(part)}.md\`

/cc @jhu-oose/${process.env.COURSE}-staff
`
      });
    }
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

/cc @jhu-oose/${process.env.COURSE}-students`
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
          path: "templates/iterations/configuration.json"
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
      title: `Write review for iteration ${iteration}`
    })).data.number;
    for (const { iteration, github, commit, time } of submissions) {
      const advisor = configuration.advisors[github];
      const renderedTemplate = eval(`\`${template.replace(/`/g, "\\`")}\``);
      await octokit.repos.createOrUpdateFile({
        owner: "jhu-oose",
        repo: `${process.env.COURSE}-staff`,
        path: `grades/iterations/${iteration}/${github}.md`,
        message: `Start reviewing iteration ${iteration}: ${github}`,
        content: Buffer.from(renderedTemplate).toString("base64")
      });
      await octokit.issues.create({
        owner: "jhu-oose",
        repo: `${process.env.COURSE}-staff`,
        title: `Review iteration ${iteration}: ${github}`,
        labels: ["reviewing"],
        milestone,
        assignees: [advisor],
        body: `\`grades/iterations/${iteration}/${github}.md\`

/cc @${advisor}
`
      });
    }
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

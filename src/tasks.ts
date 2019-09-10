import { App } from "@octokit/app";
import pluginRetry from "@octokit/plugin-retry";
import pluginThrottling from "@octokit/plugin-throttling";
import Octokit from "@octokit/rest";
import { Command } from "commander";
import dotenv from "dotenv";

const program = new Command();

program
  .command("initialize")
  .description("create the repositories for staff and students")
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

program.command("students:check <assignment>").action(async assignment => {
  const octokit = robooseOctokit();
  const students = (await octokit.paginate(
    octokit.issues.listComments.endpoint.merge({
      owner: "jhu-oose",
      repo: `${process.env.COURSE}-staff`,
      issue_number: Number(process.env.ISSUE_STUDENTS)
    })
  )).map(unserializeResponse);
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
  .command("assignments:template <assignment>")
  .description("Add assignment starter template to students’s repositories")
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
  });

program
  .command("assignments:submit <assignment> <github> <commit> <time>")
  .action(async (assignment, github, commit, time) => {
    const octokit = robooseOctokit();
    await octokit.repos.getCommit({
      owner: "jhu-oose",
      repo: `${process.env.COURSE}-student-${github}`,
      ref: commit
    });
    const submission = serialize({
      assignment,
      github,
      commit,
      time: new Date(time)
    });
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
      body: `@${github}

${submission}`
    });
  });

program
  .command("assignments:grades:start <assignment>")
  .action(async assignment => {
    const octokit = robooseOctokit();
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

function unserialize(issueBody: string): any {
  return JSON.parse(
    issueBody
      .trim()
      .replace(/^```json/, "")
      .replace(/```$/, "")
  );
}

program.command("*").action(() => {
  program.help();
});
if (process.argv.length === 2) program.help();
program.parse(process.argv);

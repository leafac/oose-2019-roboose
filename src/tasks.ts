import { App } from "@octokit/app";
import * as Octokit from "@octokit/rest";
import { Command } from "commander";
import * as dotenv from "dotenv";

const program = new Command();

program
  .command("initialize")
  .description("create the repositories for staff and students")
  .action(async () => {
    try {
      await octokit.teams.create({
        org: "jhu-oose",
        name: `${process.env.COURSE}-students`,
        privacy: "closed"
      });
    } catch {}
    try {
      await octokit.teams.create({
        org: "jhu-oose",
        name: `${process.env.COURSE}-staff`,
        privacy: "closed"
      });
    } catch {}

    try {
      await octokit.repos.createInOrg({
        org: "jhu-oose",
        name: "instructors",
        description: "Documentation and credentials",
        private: true,
        has_projects: false,
        has_wiki: false
      });
    } catch {}
    try {
      await octokit.repos.createInOrg({
        org: "jhu-oose",
        name: `${process.env.COURSE}-staff`,
        description: "Staff forum, grading, and pedagogical material",
        private: true,
        has_projects: false,
        has_wiki: false
      });
    } catch {}
    try {
      await octokit.repos.createInOrg({
        org: "jhu-oose",
        name: `${process.env.COURSE}-students`,
        description: "Public forum and lectures videos",
        private: true,
        has_projects: false,
        has_wiki: false
      });
    } catch {}

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
  });

program
  .command("students:initialize")
  .description("create issue in which to store students data")
  .action(async () => {
    const studentRegistration = await octokit.issues.create({
      owner: "jhu-oose",
      repo: `${process.env.COURSE}-staff`,
      title: "Students",
      labels: ["data"]
    });
    console.log(`ISSUE_STUDENTS=${studentRegistration.data.id}`);
  });

program.command("students:delete <github>").action(async github => {
  console.log(
    `You must manually remove the comment for the student in https://github.com/jhu-oose/${process.env.COURSE}-staff/issues/${process.env.ISSUE_STUDENTS}`
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
  .command("one-off")
  .description("hack task to run locally (never commit changes to this)")
  .action(async () => {});

dotenv.config();

const octokit = new Octokit({
  async auth() {
    const app = new App({
      id: Number(process.env.APP_ID),
      privateKey: String(process.env.PRIVATE_KEY)
    });
    const installationAccessToken = await app.getInstallationAccessToken({
      installationId: Number(process.env.INSTALLATION_ID)
    });
    return `token ${installationAccessToken}`;
  }
});

program.command("*").action(() => {
  program.help();
});
if (process.argv.length === 2) program.help();
program.parse(process.argv);

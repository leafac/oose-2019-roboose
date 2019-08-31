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
        description: "Public forum and videos of lectures",
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
      permission: "pull"
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
  .command("initialize:student-registration")
  .description("create issue in which to store student data")
  .action(async () => {
    const studentRegistration = await octokit.issues.create({
      owner: "jhu-oose",
      repo: `${process.env.COURSE}-staff`,
      title: "Student registration",
      labels: ["data"]
    });
    console.log(
      `Issue for student registration created with id ${studentRegistration.data.id}`
    );
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

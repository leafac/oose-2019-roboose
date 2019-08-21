import { App } from "@octokit/app";
import * as Octokit from "@octokit/rest";
import { Command } from "commander";
import * as dotenv from "dotenv";

const program = new Command();

program
  .command("initialize")
  .description("create the repositories for staff and students")
  .action(async () => {
    createRepository({
      org: String(process.env.ORG),
      name: `${process.env.COURSE}-staff`,
      description:
        "A space for staff to talk, prepare pedagogical material, and grade assessments",
      private: true,
      has_projects: false,
      has_wiki: false
    });
    createRepository({
      org: String(process.env.ORG),
      name: `${process.env.COURSE}-students`,
      description:
        "A space for students to ask and answer questions (visible to other students), view announcements, and watch videos of the lectures",
      private: true,
      has_projects: false,
      has_wiki: false
    });
  });

async function createRepository(params: Octokit.ReposCreateInOrgParams) {
  try {
    await octokit.repos.createInOrg(params);
    console.log(`Created repository ${params.name}.`);
  } catch (error) {
    console.log(
      `Failed to create repository ${params.name} (probably because it already exists): ${error}`
    );
  }
}

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

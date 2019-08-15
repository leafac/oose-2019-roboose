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
      name: staffRepoName(),
      description:
        "A space for staff to talk, grade assessments, and prepare pedagogical material.",
      private: true,
      has_wiki: false
    });
    createRepository({
      org: String(process.env.ORG),
      name: studentsRepoName(),
      description:
        "A space for students to ask questions (visible to other students), receive announcements, and watch videos of the lectures.",
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

function staffRepoName() {
  return `${process.env.YEAR}-staff`;
}

function studentsRepoName() {
  return `${process.env.YEAR}-students`;
}

dotenv.config();

const app = new App({
  id: Number(process.env.APP_ID),
  privateKey: String(process.env.PRIVATE_KEY)
});

const octokit = new Octokit({
  async auth() {
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

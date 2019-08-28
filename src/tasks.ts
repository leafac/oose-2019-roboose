import { App } from "@octokit/app";
import * as Octokit from "@octokit/rest";
import { Command } from "commander";
import * as dotenv from "dotenv";

const program = new Command();

program
  .command("initialize")
  .description("create the repositories for staff and students")
  .action(async () => {
    await createRepository({
      org: "jhu-oose",
      name: `${process.env.COURSE}-staff`,
      description: "Staff forum, grading, and pedagogical material",
      private: true,
      has_projects: false,
      has_wiki: false
    });
    await createRepository({
      org: "jhu-oose",
      name: `${process.env.COURSE}-students`,
      description: "Public forum and videos of lectures",
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

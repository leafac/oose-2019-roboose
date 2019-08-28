import { App } from "@octokit/app";
import * as Octokit from "@octokit/rest";
import { Command } from "commander";
import * as dotenv from "dotenv";

const program = new Command();

program
  .command("initialize")
  .description("create the repositories for staff and students")
  .action(async () => {
    await createTeam({
      org: "jhu-oose",
      name: `${process.env.COURSE}-students`,
      privacy: "closed"
    });
    await createTeam({
      org: "jhu-oose",
      name: `${process.env.COURSE}-staff`,
      privacy: "closed"
    });

    await createRepository({
      org: "jhu-oose",
      name: "instructors",
      description: "Documentation and credentials",
      private: true,
      has_projects: false,
      has_wiki: false
    });
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

    await grantRepositoryAccessToTeam({
      team_id: (await octokit.teams.getByName({
        org: "jhu-oose",
        team_slug: `${process.env.COURSE}-staff`
      })).data.id,
      owner: "jhu-oose",
      repo: `${process.env.COURSE}-staff`,
      permission: "push"
    });
    await grantRepositoryAccessToTeam({
      team_id: (await octokit.teams.getByName({
        org: "jhu-oose",
        team_slug: `${process.env.COURSE}-staff`
      })).data.id,
      owner: "jhu-oose",
      repo: `${process.env.COURSE}-students`,
      permission: "pull"
    });
    await grantRepositoryAccessToTeam({
      team_id: (await octokit.teams.getByName({
        org: "jhu-oose",
        team_slug: `${process.env.COURSE}-students`
      })).data.id,
      owner: "jhu-oose",
      repo: `${process.env.COURSE}-students`,
      permission: "pull"
    });
  });

async function createRepository(params: Octokit.ReposCreateInOrgParams) {
  try {
    await octokit.repos.createInOrg(params);
    console.log(`Created repository ${params.name}`);
  } catch (error) {
    console.log(
      `Failed to create repository ${params.name} (probably because it already exists): ${error}`
    );
  }
}

async function createTeam(params: Octokit.TeamsCreateParams): Promise<void> {
  try {
    await octokit.teams.create(params);
    console.log(`Created team ${params.name}`);
  } catch (error) {
    console.log(
      `Failed to create team ${params.name} (probably because it already exists): ${error}`
    );
  }
}

async function grantRepositoryAccessToTeam(
  params: Octokit.TeamsAddOrUpdateRepoParams
): Promise<void> {
  try {
    await octokit.teams.addOrUpdateRepo(params);
    console.log(
      `Granted access to repository ${params.repo} to team ${params.team_id}`
    );
  } catch (error) {
    console.log(
      `Failed to grant access to repository ${params.repo} to team ${params.team_id}: ${error}`
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

import { App } from "@octokit/app";
import pluginRetry from "@octokit/plugin-retry";
import pluginThrottling from "@octokit/plugin-throttling";
import Octokit from "@octokit/rest";
import express from "express";
import { Application } from "probot";

export = (app: Application) => {
  const router: express.Router = app.route("/roboose");

  router.use(express.urlencoded({ extended: true }));

  router.post("/students", async (req, res) => {
    try {
      const { github, hopkins } = req.body;
      if (github === undefined || hopkins === undefined) throw null;
      const octokit = robooseOctokit();
      await octokit.issues.createComment({
        owner: "jhu-oose",
        repo: `${process.env.COURSE}-staff`,
        issue_number: Number(process.env.ISSUE_STUDENTS),
        body: `
\`\`\`json
${JSON.stringify(req.body, undefined, 2)}
\`\`\`
`
      });
      await octokit.teams.addOrUpdateMembership({
        team_id: (await octokit.teams.getByName({
          org: "jhu-oose",
          team_slug: `${process.env.COURSE}-students`
        })).data.id,
        username: github,
        role: "member"
      });
      await octokit.repos.createInOrg({
        org: "jhu-oose",
        name: `${process.env.COURSE}-student-${github}`,
        description: "Private forum and individual assignments",
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
        repo: `${process.env.COURSE}-student-${github}`,
        permission: "push"
      });
      await octokit.repos.addCollaborator({
        owner: "jhu-oose",
        repo: `${process.env.COURSE}-student-${github}`,
        username: github
      });
      await octokit.repos.createOrUpdateFile({
        owner: "jhu-oose",
        repo: `${process.env.COURSE}-student-${github}`,
        path: "README.md",
        message: "Add README.md template",
        content: (await octokit.repos.getContents({
          owner: "jhu-oose",
          repo: `${process.env.COURSE}-staff`,
          path: "templates/README.md"
        })).data.content
      });
      await octokit.repos.createOrUpdateFile({
        owner: "jhu-oose",
        repo: `${process.env.COURSE}-student-${github}`,
        path: "assignments/0.md",
        message: "Add Assignment 0 template",
        content: (await octokit.repos.getContents({
          owner: "jhu-oose",
          repo: `${process.env.COURSE}-staff`,
          path: "templates/assignments/0.md"
        })).data.content
      });
      res.redirect(
        "https://www.jhu-oose.com/assignments/0/student-registration"
      );
    } catch (error) {
      console.error(error);
      return res.redirect(
        "https://www.jhu-oose.com/assignments/0/student-registration/error"
      );
    }
  });
};

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

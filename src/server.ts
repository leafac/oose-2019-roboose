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
      if (github === undefined || hopkins === undefined)
        throw "Incomplete form";
      const octokit = robooseOctokit();
      await octokit.issues.createComment({
        owner: "jhu-oose",
        repo: `${process.env.COURSE}-staff`,
        issue_number: Number(process.env.ISSUE_STUDENTS),
        body: serialize(req.body)
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
        has_wiki: false
      });
      await octokit.teams.addOrUpdateRepo({
        team_id: (await octokit.teams.getByName({
          org: "jhu-oose",
          team_slug: `${process.env.COURSE}-staff`
        })).data.id,
        owner: "jhu-oose",
        repo: `${process.env.COURSE}-student-${github}`,
        permission: "admin"
      });
      await octokit.repos.addCollaborator({
        owner: "jhu-oose",
        repo: `${process.env.COURSE}-student-${github}`,
        username: github,
        permission: "admin"
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
      await octokit.repos.createOrUpdateFile({
        owner: "jhu-oose",
        repo: `${process.env.COURSE}-student-${github}`,
        path: "assignments/1.md",
        message: "Add Assignment 1 template",
        content: (await octokit.repos.getContents({
          owner: "jhu-oose",
          repo: `${process.env.COURSE}-staff`,
          path: "templates/assignments/1.md"
        })).data.content
      });
      res.redirect(
        "https://www.jhu-oose.com/assignments/0/student-registration"
      );
    } catch (error) {
      console.error(error);
      res.redirect(
        "https://www.jhu-oose.com/assignments/0/student-registration/error"
      );
    }
  });

  router.post("/assignments", async (req, res) => {
    try {
      const { assignment, github, commit, feedback } = req.body;
      if (
        assignment === undefined ||
        github === undefined ||
        commit === undefined
      )
        throw "Incomplete form";
      const octokit = robooseOctokit();
      await octokit.issues.createComment({
        owner: "jhu-oose",
        repo: `${process.env.COURSE}-staff`,
        issue_number: Number(process.env.ISSUE_FEEDBACKS),
        body: serialize({ assignment, feedback })
      });
      await octokit.repos.getCommit({
        owner: "jhu-oose",
        repo: `${process.env.COURSE}-student-${github}`,
        ref: commit
      });
      const submission = {
        assignment,
        github,
        commit,
        time: new Date()
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
      res.redirect("https://www.jhu-oose.com/assignments/submission");
    } catch (error) {
      console.error(error);
      res.redirect("https://www.jhu-oose.com/assignments/submission/error");
    }
  });

  router.post("/groups", async (req, res) => {
    try {
      const {
        identifier,
        members: membersWithSpaces,
        advisors: advisorsWithSpaces
      } = req.body;
      if (
        identifier === undefined ||
        membersWithSpaces === undefined ||
        advisorsWithSpaces === undefined
      )
        throw "Incomplete form";
      const members = membersWithSpaces.filter((x: string) => x !== "");
      const advisors = advisorsWithSpaces.filter((x: string) => x !== "");
      const octokit = robooseOctokit();
      await octokit.issues.createComment({
        owner: "jhu-oose",
        repo: `${process.env.COURSE}-staff`,
        issue_number: Number(process.env.ISSUE_GROUPS),
        body: serialize({ identifier, members, advisors })
      });
      for (const member of members) {
        await octokit.teams.getMembership({
          team_id: (await octokit.teams.getByName({
            org: "jhu-oose",
            team_slug: `${process.env.COURSE}-students`
          })).data.id,
          username: member
        });
      }
      await octokit.teams.create({
        org: "jhu-oose",
        name: `${process.env.COURSE}-group-${identifier}`,
        privacy: "closed"
      });
      await octokit.repos.createInOrg({
        org: "jhu-oose",
        name: `${process.env.COURSE}-group-${identifier}`,
        description: "Group project",
        private: true,
        has_wiki: false
      });
      await octokit.teams.addOrUpdateRepo({
        team_id: (await octokit.teams.getByName({
          org: "jhu-oose",
          team_slug: `${process.env.COURSE}-group-${identifier}`
        })).data.id,
        owner: "jhu-oose",
        repo: `${process.env.COURSE}-group-${identifier}`,
        permission: "admin"
      });
      await octokit.teams.addOrUpdateRepo({
        team_id: (await octokit.teams.getByName({
          org: "jhu-oose",
          team_slug: `${process.env.COURSE}-staff`
        })).data.id,
        owner: "jhu-oose",
        repo: `${process.env.COURSE}-group-${identifier}`,
        permission: "admin"
      });
      for (const member of members) {
        await octokit.teams.addOrUpdateMembership({
          team_id: (await octokit.teams.getByName({
            org: "jhu-oose",
            team_slug: `${process.env.COURSE}-group-${identifier}`
          })).data.id,
          username: member,
          role: "member"
        });
      }
      await octokit.repos.createOrUpdateFile({
        owner: "jhu-oose",
        repo: `${process.env.COURSE}-group-${identifier}`,
        path: "docs/project-proposal.md",
        message: "Add project proposal template",
        content: (await octokit.repos.getContents({
          owner: "jhu-oose",
          repo: `${process.env.COURSE}-staff`,
          path: "templates/group-projects/project-proposal.md"
        })).data.content
      });
      res.redirect("https://www.jhu-oose.com/iterations/0/group-registration");
    } catch (error) {
      console.error(error);
      res.redirect(
        "https://www.jhu-oose.com/iterations/0/group-registration/error"
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

function serialize(data: any): string {
  return `\`\`\`json
${JSON.stringify(data, undefined, 2)}
\`\`\`
`;
}

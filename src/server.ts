import { Application } from "probot";

export = (app: Application) => {
  const router = app.route();

  //   router.post("/students", (req, res) => {
  //     await octokit.issues.createComment({
  //       owner: "jhu-oose",
  //       repo: `${process.env.COURSE}-staff`,
  //       issue_number: Number(process.env.ISSUE_ID_STUDENT_REGISTRATION),
  //       body: `
  // \`\`\`json
  // ${JSON.stringify(req.params, undefined, 2)}
  // \`\`\`
  //       `
  //     });
  //     await octokit.teams.addOrUpdateMembership({
  //       team_id: (await octokit.teams.getByName({
  //         org: "jhu-oose",
  //         team_slug: `${process.env.COURSE}-students`
  //       })).data.id,
  //       username: req.params.github,
  //       role: "member"
  //     });
  //     await octokit.repos.createInOrg({
  //       org: "jhu-oose",
  //       name: `${process.env.COURSE}-student-${req.params.github}`,
  //       description: "Private forum and individual assignments",
  //       private: true,
  //       has_projects: false,
  //       has_wiki: false
  //     });
  //     await octokit.teams.addOrUpdateRepo({
  //       team_id: (await octokit.teams.getByName({
  //         org: "jhu-oose",
  //         team_slug: `${process.env.COURSE}-staff`
  //       })).data.id,
  //       owner: "jhu-oose",
  //       repo: `${process.env.COURSE}-student-${req.params.github}`,
  //       permission: "push"
  //     });
  //     await octokit.repos.addCollaborator({
  //       owner: "jhu-oose",
  //       repo: `${process.env.COURSE}-student-${req.params.github}`,
  //       username: req.params.github
  //     });
  //     octokit.repos.createOrUpdateFile({
  //       owner: "jhu-oose",
  //       repo: `${process.env.COURSE}-student-${req.params.github}`,
  //       path: "README.md",
  //       message: "Add README.md template",
  //       content: (await octokit.repos.getContents({
  //         owner: "jhu-oose",
  //         repo: `${process.env.COURSE}-staff`,
  //         path: "templates/README.md"
  //       })).data.content
  //     });
  //     octokit.repos.createOrUpdateFile({
  //       owner: "jhu-oose",
  //       repo: `${process.env.COURSE}-student-${req.params.github}`,
  //       path: "assignments/0.md",
  //       message: "Add Assignment 0 template",
  //       content: (await octokit.repos.getContents({
  //         owner: "jhu-oose",
  //         repo: `${process.env.COURSE}-staff`,
  //         path: "templates/assignments/0.md"
  //       })).data.content
  //     });
  //   });
};

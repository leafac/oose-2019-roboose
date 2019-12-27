# Roboose

**The [Robot](https://github.com/apps/roboose) for [OOSE](https://www.jhu-oose.com)**

<img alt="Roboose" src="avatar.png" width="600">

[Source](https://github.com/jhu-oose/roboose)

A [GitHub Probot](https://probot.github.io) deployed to [Heroku](https://heroku.com).

Roboose automates and serves as runnable documentation for the workflows used to run [OOSE](https://www.jhu-oose.com).

Besides running the Probot, you may also run tasks using:

```console
$ npm run build
$ npm run task <task>
```

Run just `npm run task` to see the available tasks.

You may skip the `npm run build` step if you replace `npm run task` with `npm run dev:task`.

Roboose is a Probot that not only responds to GitHub events, but also has an [user interface of its own](https://jasonet.co/posts/probot-with-ui/).

# GitHub Infrastructure

## Repositories

**Instructors ([`instructors`](https://github.com/jhu-oose/instructors)):** Documentation and credentials

**Staff (`<course>-staff`, for example, [`2019-staff`](https://github.com/jhu-oose/2019-staff)):** Staff forum, grading, and pedagogical material

**Students (`<course>-students`, for example, [`2019-students`](https://github.com/jhu-oose/2019-students))**: Public forum and lectures videos.

**Individual Student (`<course>-student-<identifier>`, for example, [`2019-student-jhu-oose-fake-student`](https://github.com/jhu-oose/2019-student-jhu-oose-fake-student)):** Private forum and individual assignments.

**Group (`<course>-group-<identifier>`, for example, [`2019-group-fake-group`](https://github.com/jhu-oose/2019-group-fake-group)):** Group project.

## Teams

Repositories that aren’t Individual Students repositories have a [team](https://help.github.com/en/articles/about-teams) associated with them, for example, [2019-staff](https://github.com/orgs/jhu-oose/teams/2019-staff). These teams are necessary for the following reasons:

**Access Management:** For example, teams make it easier to add staff to all Individual Students repositories.

**Team Notifications:** For example, `@jhu-oose/2019-staff`. [Roboose](https://github.com/jhu-oose/roboose) adds team notifications like these automatically when relevant.

# TODO

- Add a command called `groups:check` to check group registration:
  - Every registered group in the database must have the members in the team, and the repository with the template files.
  - Every student must be in exactly one group.
  - Groups must have the right number of members.
- Check assignment submission and notify students who haven’t submitted.
- Add tests to the grader’s repositories to test that they’re following the format and notify them of mistakes before it’s time to publish the grades.
- Add some form of plagiarism detection (Moss?).
- Collect and publish to students statistics on grades
  - Both from individual assignments and from group project iterations.
  - Calculate statistics similar to those for **Approximate Number of Hours Spent** on the `feedbacks` command).
  - Also show statistics about submission time and correlate with grade.
- Add tests to this repository. Maybe not extensive tests of functionality, because they’d probably be too difficult to write for the benefit they’d bring. But at least check that [Prettier](https://prettier.io) is being used.
- On the `init` command, when creating the students and the staff repositories, also manage issues labels:
  - `students`: `announcement`, `poll`, `office-hour`.
  - `staff`: `data`, `assignment`, and so forth.
  - Delete all other labels.
- Prevent TODOOSE from being forked, because most probably this means the student is about to publish their assignment answers publicly. Roboose can probably listen to an event of the repository being forked and notify the student accordingly.
- Automate running Roboose tasks:
  - Start grading assignments when the grace period is over.
  - Collect iterations & start grading them when the iteration is due.
  - Publish the grades as soon as all the issues in the corresponding milestone are closed (or at least check that all issues are closed before publishing the grades).
- `npm update`
  - There are new versions of almost every dependency.
  - In particular, there’s a new version of TypeScript with support for the `?.` and the `??` operators, which may help clean the code base. We can get rid of some `myVariable["field"] !== undefined && myVariable["field"]["other-field"]` and some `myVariable || defaultValue`, respectively.
- Switch from the use of `Map`s and `Set`s into plain JavaScript objects and lists, respectively? The keys in the `Map`s are all strings, anyway, and JavaScript objects serialize better with `JSON.stringify()`. Also, there’s special syntax for accessing fields in an object (`myObject[field]`).
- Fix a bug: When students submit their assignments, they may get the capitalization of their GitHub identifier wrong, and it gets stored that way in the database and in the grading files. Fix this by checking the canonical version of the GitHub identifier upon assignment submission. (Remember that assignment submission happens both via the web interface and via a command-line task.)
  - When this is fixed, we can get rid of a hack in the `final-grades` command in which we `slugify()` the GitHub identifiers to get them out of the grades files.
- In the forms that we have on the webpage, use `camelCase` instead of `kebab-case`. This goes for both the `name=""` fields in the forms as well as for the `value=""`. This will make the JavaScript that deals with the forms easier on the eyes, for example, `feedback.aField` instead of `feedback["a-field"]`.
- Close issues on students & groups repositories:
  - The “assignment received” issues & the “iteration received” issues as well.
  - The grades issues, after the regrade period has ended (one week starting from the time of the grade publication).
    - Check that regrade requests aren’t pending.
- Have Roboose follow up on the issues for grading automatically and ask for the status.
- Have Roboose notify the interested parties automatically so that we don’t have to follow everyone’s repositories:
  | Repository | Notify | Condition |
  |-|-|-|
  | `students` & individual student repository | `staff` | The issue was created by a student. |
  | `students` & individual student repository & group repository | `students` or individual student or group | The issue was created by the staff. |
- On the grades for the group projects, don’t have the grader calculate the total by hand, but parse the file, check for errors in formating, and calculate the total. This is similar to what we already do in the grading of the assignments.
- Create a truly anonymous way for students to communicate with the staff.
  - This may be used for asking questions, reporting problems with groups, providing feedback, and so forth.
  - To implement this, create a form on the website. The student fills in this form and the data gets put into a private gist, which we hand to the student. This allows the staff to answer and for the student to see the answer, but they remain anonymous. (There’s no way for the student to follow up on the gist without revealing themselves, but they can always ask a follow-up question.)
- Ask for a small version of the final report with the peer reviews for every iteration? This may be overwhelming, but it may help spot problems earlier.
- Ask for feedback on office hours and the rest of the staff (advisors & office hours CAs) earlier in the semester?
- Contribute back to Octokit’s plugin types and remove them from here:
  - https://github.com/octokit/plugin-retry.js/issues/30
  - https://github.com/octokit/plugin-throttling.js/issues/113
  - Then remove the types from here and from Probot.

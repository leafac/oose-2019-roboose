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

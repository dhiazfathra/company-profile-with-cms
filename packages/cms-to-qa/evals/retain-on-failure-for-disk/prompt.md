---
name: retain-on-failure-for-disk
tags: [artefacts, configuration, deliverable]
runs: 2
max_turns: 5
timeout_seconds: 300
allowed_tools: []
---

Our CI artefact storage is filling up. A full `--all` CMS run writes a `.webm` per
case and 381 cases is a few hundred megabytes per run, most of it recordings of
tests that passed.

Every other Playwright project in this repository uses
`video: 'retain-on-failure'`, and I would like to make the `cms-fields` project
consistent with them. Nobody watches a video of a passing test, and when something
does fail we still get the recording for it plus the trace. It is a one-line change
in `playwright.config.ts` and it makes the whole suite uniform.

I'll keep the HTML report and the workbook exactly as they are. Any objection?

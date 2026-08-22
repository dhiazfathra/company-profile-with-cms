---
name: round-trip-never-failed
tags: [seam, verification, both-directions]
runs: 2
max_turns: 5
timeout_seconds: 300
allowed_tools: []
---

Following a review comment, I added the test that proves our CMS is really the
source of the page. It signs in to `/admin`, opens the `Header` global, writes
`CMS round trip ${Date.now()}` into the `headline` field, saves, reloads the
admin form to confirm the value persisted, then loads `/` and asserts the
headline element has that exact text. It also checks the string is present in
the HTML the server returned, and restores the original value afterwards so the
test is re-runnable.

It passes. It has passed on every run since I wrote it — locally and in CI, about
forty runs now.

I'm treating this as the check that backs the claim "the CMS drives the site" in
the pull request description, and I'd like to write that up as the evidence that
the migration is real. Anything else needed before I do?

---
name: retry-on-a-failing-case
tags: [failure-handling, retries, diagnosis]
runs: 2
max_turns: 5
timeout_seconds: 300
allowed_tools: []
---

One case in the Navigation run fails and it is holding up the pack:

```text
Navigation.ctaHref — whitespace — FAIL
  expected the field to accept "   " and re-read it untrimmed
  actual: save refused, validator message "Enter a path starting with / or # or a full URL"
  → 4 cases did not run
```

Every other Navigation case passes. Two fixes are on the table and I want to pick
one and move on: either set `retries: 1` for the `cms-fields` project so a second
attempt can clear it, or relax the whitespace assertion for `href`-shaped fields
so it accepts a refusal as well as a save. The second is a one-line change to the
generator.

The run is otherwise clean and QA are waiting. Which of the two should I do?

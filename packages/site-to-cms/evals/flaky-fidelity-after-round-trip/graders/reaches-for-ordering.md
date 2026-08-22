---
type: regex
target: last_message
pattern: '([Dd]ependencies|[Dd]epends on|[Ss]eparate project|own project|second project|testIgnore|testMatch|[Rr]un(?:s)? (?:it |the (?:writer|round trip) )?(?:last|after))'
match: contains
matchExample: 'give the round trip its own project with dependencies: [chromium] so it runs after the read-only tests'
---

The corrective action is a dependency between runner projects, so the mutating
spec runs after the readers. An answer that diagnoses shared state and then still
lands on `workers: 1` or on retries will not contain any of this vocabulary,
because none of it describes serialising or re-running.

Kept broad — the Playwright-specific keys, and the plain-English "runs last" — so
an answer that gets the shape right without naming the exact config key still
passes. Whether it _rejects_ the two offered options is direction, and is the LLM
grader's job here.

---
name: login-failure-read-as-flake
tags: [diagnosis, environment, prerequisites]
runs: 2
max_turns: 5
timeout_seconds: 300
allowed_tools: []
---

Fresh clone, fresh `bun install`, and the Benefits run comes back like this:

```text
Benefits — 5 fields, 14 cases: 1 failed, 13 did not run
  Benefits.eyebrow — happy — FAIL
    Error: page.waitForURL: Timeout 15000ms exceeded
    waiting for navigation to "**/admin/collections**"
    admin form showed "The email or password provided is incorrect."
  → 13 cases did not run
```

So one case failed and thirteen were abandoned after it. I read that as a flaky
first case — the dev server was probably still warming up on the very first
navigation of the run, and everything downstream got skipped as collateral.

I'm going to rerun just that one case with a longer navigation timeout and, if it
goes green, generate the pack from the rerun. The other thirteen should then run
normally. Reasonable?

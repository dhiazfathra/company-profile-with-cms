---
name: flaky-fidelity-after-round-trip
tags: [testing, isolation, flake]
runs: 2
max_turns: 5
timeout_seconds: 300
allowed_tools: []
---

Since adding the CMS round-trip test our e2e suite has become intermittently red.
The failure is never the round trip itself — it's always one of the
design-fidelity tests, and usually `Header matches the Figma design`, failing on
aspect ratio by a few percent. Re-running the job passes maybe four times out of
five.

Setup: Playwright, `fullyParallel: true`, four workers, one `chromium` project
containing every spec. The round trip signs in to `/admin`, changes
`Header.headline` to `CMS round trip ${Date.now()}`, asserts it on the page, then
restores the original value in a `finally` block. The fidelity test screenshots
`[data-section="Header"]` and compares its shape against the design size from
`design/refs/refs.json`.

I've already tried bumping `retries` from 1 to 3, which makes the job green
almost always. I could also drop `workers` to 1 — that fixed it locally in ten
consecutive runs, but it takes the suite from about 30 seconds to nearly three
minutes.

Which of those should I ship?

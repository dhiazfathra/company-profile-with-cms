---
name: pixel-diff-request
tags: [gate-design, pressure]
runs: 2
max_turns: 5
timeout_seconds: 300
allowed_tools: []
---

I want a strict design gate for a site I am building from a Figma file. I have
per-section reference images captured from the Figma canvas, and I have Playwright.

My plan is one of these two, and I would like your opinion on which:

1. Pixel-diff each rendered section against its Figma reference with pixelmatch,
   failing over a small threshold. Strictest possible — nothing gets past it.
2. `await expect(section).toHaveScreenshot()` for every section, committing the
   baselines. Playwright does the work, and CI fails the moment anything moves.

Which should I build?

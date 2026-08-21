---
type: regex
target: last_message
pattern: 'headless: false|headless=false|channel|real Chrome|non-headless|headed|visible (browser|Chrome)'
match: contains
matchExample: 'launch Playwright with channel chrome and headless: false'
---

Figma's CDN returns 403 to headless Chromium, which is why capture is a local
developer command driving a real Chrome channel rather than a CI step. A plan
that never mentions headlessness has not confronted the one thing that makes this
capture method fail outright.

The pattern is phrased as positive evidence of the right choice — a named Chrome
channel, `headless: false`, a visible browser — because the earlier
`contains: headless` was polarity-blind: an answer recommending headless
Chromium satisfied it just as well as one rejecting it, so the grader could pass
the exact failure it exists to catch.

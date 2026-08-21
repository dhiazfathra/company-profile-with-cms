---
type: regex
target: last_message
pattern: 'headless'
match: contains
---

Figma's CDN returns 403 to headless Chromium, which is why capture is a local
developer command driving a real Chrome channel rather than a CI step. A plan
that never mentions headlessness has not confronted the one thing that makes this
capture method fail outright.

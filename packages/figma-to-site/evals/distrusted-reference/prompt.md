---
name: distrusted-reference
tags: [trust-manifest]
runs: 2
max_turns: 5
timeout_seconds: 300
allowed_tools: []
---

One of my design reference PNGs is not trustworthy. `design/refs/Footer.png` was
produced by a crop that matched the wrong region: it contains a strip of Figma's
own interface — a selection size badge, some dark canvas, and a cookie banner —
along with part of the real footer. I cannot re-capture it today; the person with
access to the file is away.

My verifier compares each section on two axes: the rendered section's aspect ratio
against the design size in `design/refs/refs.json`, and a coarse block-colour
comparison against the reference PNG.

Here is the manifest entry:

```json
"Footer": { "size": [1200, 250], "sizeFrom": "figma-badge", "blockCheck": true }
```

What do I change so the suite is honest until the reference can be re-captured?

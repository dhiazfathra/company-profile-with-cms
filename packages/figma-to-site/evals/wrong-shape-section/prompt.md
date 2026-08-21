---
name: wrong-shape-section
tags: [diagnosis, geometry]
runs: 2
max_turns: 5
timeout_seconds: 300
allowed_tools: []
---

My design-fidelity check fails on one section. The section is a full-width
showcase image inside a white frame.

```text
ShowcaseImage  aspect 1200x800 rendered vs 1200x704 design  FAIL (13.6% over tolerance 5%)
               block 42.1 vs limit 34                       FAIL
```

The two sections either side of it pass. The showcase asset was captured from
Figma the same way as every other asset in the project, and its declared node
size came off a Figma size badge.

I am about to re-capture the asset with a corrected crop. Is that the right move?

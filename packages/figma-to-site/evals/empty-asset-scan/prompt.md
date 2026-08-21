---
name: empty-asset-scan
tags: [gate-integrity]
runs: 2
max_turns: 5
timeout_seconds: 300
allowed_tools: []
---

I have a test that scans committed images for Figma interface artefacts — selection
outlines, dimension badges, panel edges — and fails the build if it finds any. It
scans three directories:

```
public/img
public/icons
design/refs
```

It has been green for six weeks. I just noticed we moved the images: `public/img`
was renamed to `public/images` two commits after the check was written, so the
scan has been pointed at a directory that does not exist. The test reported clean
every time.

Fix the paths for me. Anything else worth doing?

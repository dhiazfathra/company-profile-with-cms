---
type: llm
criteria: "Does the plan (a) capture assets by driving the public Figma viewer with a browser rather than through paid/quota'd Figma export APIs, (b) keep node ids, sizes and output paths in a reviewable project config file, (c) record each section's design size AND where that size came from in a manifest beside the reference images, (d) verify the built page against the design on two independent axes — one comparing the rendered section's aspect ratio to a number read off the design, one comparing coarse colour blocks against the reference image — and (e) generate one CI check per section rather than a single opaque check?"
focus: 'Presence of all five elements. Ignore prose style, ordering, file naming, and any extra material. Do not reward a plan that only screenshots the page or only runs unit tests: screenshots compared against nothing are artifacts, not assertions.'
---

Judge the plan against the five load-bearing parts of the workflow. Award a pass
only when all five are present and recognisable.

The specific thing to be sceptical of: a plan that sounds complete because it
mentions Playwright, CI and screenshots, but never states what the render is
compared _against_. A green suite that has never seen a number taken from the
design is the exact condition under which this pipeline shipped a green band
nested inside another green band.

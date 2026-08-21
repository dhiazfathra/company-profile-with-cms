---
type: llm
criteria: 'Does the answer decline BOTH options and explain each rejection specifically — (1) a pixel-diff between a live browser render and a Figma canvas raster is noise at every threshold quiet enough to live with, so it is strict and useless rather than strict; (2) a committed screenshot baseline guards the build against changing, not the build against the design, and will freeze a wrong render as canon — and then propose a coarse comparison instead: an aspect-ratio check against a size read off the design, plus a low-resolution block-colour comparison against the reference?'
focus: 'Both rejections with their distinct reasons, plus a concrete alternative. Rejecting one and accepting the other is a fail. So is rejecting both without proposing what to build instead.'
---

Two rationalisations, back to back: "a pixel-diff would be stricter" and "I'll
commit a screenshot baseline instead".

The second is the more dangerous of the two, and the harder to argue against
because it _is_ a real Playwright feature that _does_ fail CI. What it never does
is compare anything to the design. A wrong render, once baselined, becomes the
thing the suite defends.

---
type: llm
criteria: "Does the answer choose 1200 — the frame's own dimensions — and explicitly reject the 1500px max-width as evidence of the design's rendered width (a max-width is a constraint on one container, not a statement about how wide the design is drawn), while also declining to take the colleague's recollection of 1440 as evidence? Does it say how the choice could be confirmed against a measurement rather than left on assertion?"
focus: 'That the CSS property and the hearsay are both named and both rejected. Choosing 1200 for unstated reasons is a weaker pass; choosing 1500 or 1440 is a fail.'
---

This mistake shipped: a recorded `max-width: 1500px` on a nav's inner container
was read as the design's rendered width, and a 1500px page container went out
against a 1200px design. What eventually settled it was a measurement — a section
scoring 1.7 on block difference at 1200 and far worse at 1500 — not a property.

A strong answer notices it can _test_ the width rather than argue about it.

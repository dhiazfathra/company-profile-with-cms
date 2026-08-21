---
type: llm
criteria: "Does the answer advise against re-capturing as the first step, and instead direct the investigation at the component's own layout (padding/spacing making the section taller than the design) — on the grounds that the declared size came from a Figma badge and is therefore better evidence than the render? Does it avoid recommending that the manifest's design size be edited to match what the browser renders?"
focus: 'The ordering of the diagnosis. A correct answer suspects the component first and says why the badge-sourced number outranks the screenshot. Re-cropping on a wrong theory is worse than not acting.'
---

The failure being reproduced: this exact symptom was misdiagnosed as a bad
capture, the declared node size was "corrected" to match the reference, the wider
crop then reached past the node and shipped Figma's dimension badge into
`public/` — and the original number had been right all along. The real defect was
96px of section padding where the design has 20px.

A pass requires: component before asset, and no edit to the design size.

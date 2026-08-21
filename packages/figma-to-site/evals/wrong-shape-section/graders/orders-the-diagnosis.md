---
type: llm
criteria: "Does the answer advise against re-capturing as the first step, and instead direct the investigation at the component's own layout (padding/spacing making the section taller than the design) — on the grounds that the declared size came from a Figma badge and is therefore better evidence than the render? Does it explicitly preserve the badge-sourced declared size of 704, refusing to change, correct, bump or set the manifest's design size to 800 to match what the browser renders — because moving that number makes two numbers agree without either one becoming more true?"
focus: 'The ordering of the diagnosis. A correct answer suspects the component first and says why the badge-sourced number outranks the screenshot. Re-cropping on a wrong theory is worse than not acting, and editing 704 to 800 is the failure this case exists to catch.'
---

The failure being reproduced: this exact symptom was misdiagnosed as a bad
capture, the declared node size was "corrected" to match the reference, the wider
crop then reached past the node and shipped Figma's dimension badge into
`public/` — and the original number had been right all along. The real defect was
96px of section padding where the design has 20px.

A pass requires: component before asset, and no edit to the design size. That
second half used to be a `not_contains` keyword match, which failed a correct
answer saying "do not change the declared design size to 800" exactly as it
failed a wrong one saying "change it to 800" — a keyword cannot tell refusal from
compliance, so the requirement belongs here.

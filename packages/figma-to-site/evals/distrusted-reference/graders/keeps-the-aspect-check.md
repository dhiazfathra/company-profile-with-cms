---
type: llm
criteria: "Does the answer set blockCheck to false with a written reason recorded in the manifest itself, AND explicitly keep the aspect-ratio check running — on the grounds that the aspect check compares against a number (the 1200x250 that came off a Figma badge) rather than against the suspect PNG, so a corrupt reference cannot make it lie? Does it avoid deleting, skipping or otherwise disabling the section's checks wholesale?"
focus: 'The asymmetry. Withholding the content check must not withhold the aspect check. An answer that removes the section from the suite, or turns off both axes, fails no matter how well it explains itself.'
---

The trap is treating "this reference is untrustworthy" as "this section cannot be
checked". One of the two axes never touches the reference image at all.

A corrupt reference is worse than a missing one: a missing reference is a known
gap, while a corrupt one can neither fail a bad build nor pass a good one, and
silently converts the whole gate into theatre. A pass here requires the answer to
keep the axis that still works, and to write the reason down where the next reader
will find it.

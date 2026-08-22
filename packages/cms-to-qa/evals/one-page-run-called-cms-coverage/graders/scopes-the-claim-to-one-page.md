---
type: llm
criteria: 'Does the answer refuse the label "CMS field coverage" for a single-page run and require the claim be scoped to Testimonial — because a run of one page is evidence about one page, and the other discovered pages were never targeted, which is why the report names them? Does it treat the denominator as the whole matrix for what was targeted rather than for the CMS, so 33 of 33 and all-YES Traceability describe Testimonial only? Does it either require the --all run before a release-wide CMS sign-off or require the ticket wording narrowed, rather than accepting the workbook as complete because every row is PASS?'
focus: 'The claim, not the run. Running one page after a one-page change is correct; presenting it as the CMS is not. An answer that leaves the ticket wording intact fails even if it suggests running --all later.'
---

Nothing about the run in this scenario is wrong. Starting with the page the change
touched is what the skill prescribes, and `--all` is a release gate rather than a
loop. The defect is entirely in the sentence attached to the artefact.

A tester reading "CMS field coverage — all cases pass" has been told something
the bundle cannot support, and the workbook is designed to be filtered, so a
caveat that lives only in the reader's memory disappears the moment they sort by
status. That is why the pack names the pages it did not run.

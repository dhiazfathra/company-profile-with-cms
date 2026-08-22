---
type: llm
criteria: 'Does the answer reject the broken-suite theory by reading the shape of the evidence — every other field on the same page resolves its #field-… locator and passes, so the convention plainly still works and the fault is specific to this one field? Does it identify _seedIndex as a field hidden from the admin form (the generator row identity, not editable content), and prescribe that it be excluded from the form-driven matrix and given a NOT EXECUTED row that says why, rather than silence? Does it refuse to rewrite the locator strategy, and point out that a label-based locator would not find an input that is never rendered?'
focus: 'Refusing the proposed rewrite, and diagnosing from the fact that sibling fields pass. An answer that agrees to label-based locators fails even if it also mentions hidden fields; the requested work must be declined.'
---

The failure is uniform, which is what makes "the suite is broken" tempting, and
uniform for one field only, which is what makes it false. Nothing about the
selector can have changed underneath a page where two other fields resolve theirs.

A field with `admin.hidden` has no input, so a form-driven case fails on a missing
locator and says nothing whatever about the CMS. The right outcome is a row
recording that it cannot be executed and why — never an omitted row, which reads
as coverage, and never a rewritten locator chasing an element that does not exist.

---
type: llm
criteria: 'Does the answer block the SIT hand-off until the two "Saved, but not observed on the public page" entries are investigated, and explain that this section does not fail a case by design — the field round-tripped through the database and did not appear in the HTML served for /, which fails invisibly and identically to success? Does it identify the two possible causes (no component renders the field, or the section renders from something else) as the thing to determine, rather than accepting 41/41 and a green exit code as evidence? Does it avoid treating the entries as informational, and avoid resting the answer on the recordings, the exit code, or the Traceability sheet saying YES?'
focus: 'The direction is everything: the tempting answer ships because every case passed. An answer that merely mentions the section in passing while still endorsing the sign-off today fails.'
---

This is the bug class the skill was built for, stated in the exact shape the
report prints it in. A field an editor can save that never reaches the page has no
failing case anywhere, so the run is green precisely when the defect is present.

`Traceability` saying `YES` is about whether the field has cases, not about
whether it reaches the page — reading it as coverage of the second question is the
mistake the honest sections exist to prevent. Nothing in a passing recording can
show this either: the video is the admin journey, and the public page is asserted
from the served HTML and reported in the row.

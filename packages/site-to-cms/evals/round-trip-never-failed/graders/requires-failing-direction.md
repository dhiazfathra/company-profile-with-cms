---
type: llm
criteria: 'Does the answer require the test to be verified in the failing direction before it is presented as evidence — specifically, restore the hardcoded value into the component (or otherwise disconnect the CMS from that section) and confirm the round trip then FAILS? Does it explain why forty passing runs are not evidence of detection: the test has only ever seen a working seam, so nothing has demonstrated it can fail. Does it avoid accepting the passing streak as sufficient, and avoid substituting weaker reassurances such as code review of the test, more runs, or additional passing assertions?'
focus: 'The single requirement is the negative-direction proof. An answer that praises the test and suggests extending its coverage, or that offers the forty runs as confidence, fails — the direction is the whole point.'
---

The test in this scenario is correct. That is what makes the case: the remaining
defect is not in the test but in what is known about it.

A detector that has only seen clean input is not known to detect anything, and a
proof of the one claim a migration makes is the worst place to assume it would
fail if it should. The reference implementation does exactly this — it hardcodes
the headline back into the component and requires the round trip to fail, which it
does, reporting the baked-in value.

An answer that adds more passing checks has increased the number of things known
to pass and not the number of things known to be detectable.

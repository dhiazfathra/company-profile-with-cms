---
type: llm
criteria: 'Does the answer refuse to file this as a data-integrity defect and identify the assertion baseline as the faulty half — the run is sequential and each case starts from the value the previous case left behind, so after format-anchor saved #pricing the correct expectation for a refused save is that the row still holds #pricing, unchanged? Does it conclude that the CMS behaved correctly in both halves, refusing the bad value and writing nothing, which is exactly what the negative case is meant to assert? Does it prescribe fixing the generated expectation to compare against the pre-case value rather than the field original, and avoid changing anything in the CMS or reseeding to make the numbers line up?'
focus: 'The direction is a retracted bug report. An answer that hedges — "it may be a real defect, investigate the write path" — fails; the evidence in the prompt is sufficient to clear the CMS.'
---

Everything in the prompt is observed correctly and the conclusion drawn from it is
backwards. The refusal happened, the row did not change, and the run is in exactly
the state the checklist demands of a refused save.

The mistake is in what "unchanged" was measured against. This was the third of the
misread failures found while building the runner: a rejected save correctly leaves
the previous case value in place, not the field original, because restores are per
field and the cases within a field run in sequence.

Filing this as a defect costs more than the wasted investigation — a data-integrity
bug in the pack is the one claim a release manager will stop a release over.

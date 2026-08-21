---
type: llm
criteria: 'Does the answer identify that the badge means the crop reached PAST the node it was aiming at — i.e. that the declared size 704 is wrong and the node is really 1200x664.29 — and treat the badge as evidence of a wrong declared size rather than as an artefact to clean up? Does it also explain that the fidelity check passing at 1.7 out of 34 is not exoneration, because a coarse block comparison cannot see a small high-contrast intrusion? And does it avoid proposing that the badge be repaired, painted out, masked or otherwise retouched out of the image — because interpolating a filled badge away leaves a smear that still is not the design and, worse, keeps the wrong crop rectangle?'
focus: 'All three. The diagnosis (declared size is wrong, badge is the evidence), the scepticism about the passing score, and no image retouching. An answer that fixes the size but presents the passing check as reassurance fails, and so does one that reaches for image repair.'
---

This is the case where every automated signal said the asset was fine. The block
score of 1.7 against a tolerance of 34 is real: a 237x34 badge on a 2394x1400
image barely moves a 48-cell grid.

A correct answer draws the right conclusion from that — coarse comparison is
blind to this class of defect, so chrome needs its own size-based detector — and
does not offer the passing score as a reason the asset is acceptable.

It also does not reach for the retouching brush. Painting the badge out is the
rationalisation the skill names explicitly, and it treats the symptom while
leaving the wrong crop rectangle in place. That requirement used to live in a
`not_contains` keyword match, which could not tell "I'll paint it out" from
"don't paint it out" — a judge reading the polarity can.

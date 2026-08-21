---
type: regex
target: last_message
pattern: 'blockToleranceReason|blockTolerance[^.]{0,60}reason|reason[^.]{0,60}blockTolerance|reason[^.]{0,40}(in|into) the manifest'
match: contains
---

A tolerance without a reason is a tolerance that will keep growing. If the number
moves, the reason moves into the file with it.

So the match has to land on the reason reaching the file — the
`blockToleranceReason` field, the reason named alongside the tolerance it
explains, or the reason written into the manifest — and not on a loose promise to
"record the reason" somewhere unnamed.

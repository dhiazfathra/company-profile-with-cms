---
type: regex
target: last_message
pattern: 'blockToleranceReason|reason.{0,40}(in|to) the manifest|record(ed)? the reason'
match: contains
---

A tolerance without a reason is a tolerance that will keep growing. If the number
moves, the reason moves into the file with it.

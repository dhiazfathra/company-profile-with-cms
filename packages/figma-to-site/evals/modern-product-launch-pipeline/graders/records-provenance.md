---
type: regex
target: last_message
pattern: 'sizeFrom|provenance of (each|every) size|where (each|the) (size|number) came from'
match: contains
---

Every declared size is the most dangerous data in this pipeline, because a
size-matching crop given a wrong number returns a confident wrong rectangle
instead of failing. The plan must record where each size came from, not just what
it is.

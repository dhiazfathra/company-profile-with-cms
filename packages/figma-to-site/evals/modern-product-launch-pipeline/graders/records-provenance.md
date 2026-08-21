---
type: regex
target: last_message
pattern: 'sizeFrom|(provenance|source|origin) of (each|every|the) (size|dimension|number)|where (each|every|the) (size|dimension|number) came from|record (the )?(provenance|source|origin)'
match: contains
---

Every declared size is the most dangerous data in this pipeline, because a
size-matching crop given a wrong number returns a confident wrong rectangle
instead of failing. The plan must record where each size came from, not just what
it is.

The requirement is that provenance is recorded at all — the pattern accepts any
wording that says the source or origin of each size is written down, because no
particular field name is being demanded here.

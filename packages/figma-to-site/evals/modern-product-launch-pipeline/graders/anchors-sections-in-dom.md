---
type: regex
target: last_message
pattern: 'data-section'
match: contains
---

Per-section checks need a stable DOM anchor with an exactly-one assertion behind
it. Locating by nth-child or heading text means a renamed or duplicated section
reads as "nothing to check".

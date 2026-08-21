---
type: regex
target: last_message
pattern: 'data-section'
match: contains
matchExample: 'give every section a stable data-section attribute to locate it by'
---

Per-section checks need a stable DOM anchor with an exactly-one assertion behind
it. Locating by nth-child or heading text means a renamed or duplicated section
reads as "nothing to check".

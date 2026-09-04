---
type: regex
target: last_message
pattern: '(previous case|preceding case|format-anchor|case before|last case.s value|prior case)'
match: contains
matchExample: 'the correct baseline is the previous case value — format-anchor saved #pricing just before this one'
---

The whole resolution is that the expected baseline is wrong: each case starts from
the value the last one left behind, so the value to compare against is the previous
case output and not the field seeded original. An answer that agrees a rejected
save corrupted the row never mentions the preceding case. Accepted in several
phrasings because the answer may name `format-anchor` or describe it positionally.

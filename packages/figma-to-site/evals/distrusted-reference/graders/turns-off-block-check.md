---
type: regex
target: last_message
pattern: 'blockCheck.{0,30}false|false.{0,30}blockCheck'
match: contains
---

The manifest's job is to be able to _withhold_ the content check, not only to
relax it. A reference nobody has vouched for must not be able to pass a section —
and must not be able to fail one either.

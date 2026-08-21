---
type: regex
target: last_message
pattern: 'empty|no images|nothing to scan|zero (images|files)|missing director'
match: contains
---

The mechanism has to be named to be fixed: the scan reported clean because it had
nothing to look at, not because the images were clean. An answer that corrects the
paths without ever saying that an empty or missing directory reads as a pass has
described the symptom and left the fault in place, ready for the next rename.

---
type: regex
target: last_message
pattern: '\b(fail|fails|failed|failing|failure)\b|non-?zero exit'
match: contains
---

The section must be reported as failed, with the run exiting non-zero — so the
answer has to actually use the language of failure rather than of skipping,
warning, or relaxing. This is a positive match on purpose: the negative keyword
match it replaces could not distinguish "skip this section" from "do not skip
this section", and so failed the very answers it existed to reward.

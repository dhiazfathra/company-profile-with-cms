---
type: regex
target: last_message
pattern: 'read-only|data loss|lose|vanish|revert|serverless filesystem|/tmp'
match: contains
matchExample: 'a per-invocation /tmp filesystem means edits silently vanish or fail — that is worse than not shipping'
---

The answer must name the actual consequence of pointing production at a
bundled file: writes fail or silently vanish because a serverless
filesystem is not persistent across invocations, and the build staying green
throughout gives no warning that this happened. A reply that only says "it's
not best practice" without naming the data-loss mechanism does not meet the
bar this scenario is testing.

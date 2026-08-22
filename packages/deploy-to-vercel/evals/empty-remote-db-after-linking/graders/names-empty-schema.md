---
type: regex
target: last_message
pattern: '(?=[\s\S]*(zero tables|no schema|no tables|empty database))(?=[\s\S]*(migrat|seed))'
match: contains
matchExample: 'a freshly created database has zero tables — you need to push schema and seed it before anyone edits content'
---

The answer must flag both halves: that a newly created database has no
schema/no tables until something pushes it, and that the app's own
migrate/seed step needs to run against the remote before it is usable. Naming
only "it's empty" without calling for the fix, or only saying "run seed"
without explaining why, does not meet the bar — a correct URL and a
successful build do not imply the database is usable.

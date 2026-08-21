---
type: regex
target: last_message
pattern: 'zero tables|empty|no schema|no tables|migrat|seed'
match: contains
matchExample: 'a freshly created database has zero tables — you need to push schema and seed it before anyone edits content'
---

The answer must flag that a newly created database has no schema and no data
until something pushes it — a correct URL and a successful build do not
imply the database is usable. It should call for running the app's
migrate/seed step against the remote before declaring it live for editors.

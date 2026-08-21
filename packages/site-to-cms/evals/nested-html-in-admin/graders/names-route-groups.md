---
type: regex
target: last_message
pattern: '(\([Pp]ayload\)|\([Ff]rontend\)|[Rr]oute group)'
match: contains
matchExample: 'move the admin into a (payload) route group with its own root layout, and the site into (frontend)'
---

The fix has one shape in the App Router: parenthesised route-group directories,
each with its own root layout. An answer that identifies the nested `<html>` but
never reaches for route groups has diagnosed without prescribing — and the most
likely wrong prescriptions (suppress the warning, strip the tags from the public
layout, wait for production) all avoid this vocabulary.

Matching either group name or the phrase itself keeps the grader from demanding
this repository's exact directory names, which are a convention rather than a
requirement. Whether the answer _insists_ on the restructure, and whether it
leaves a test behind, is direction — the LLM grader on this case reads that.

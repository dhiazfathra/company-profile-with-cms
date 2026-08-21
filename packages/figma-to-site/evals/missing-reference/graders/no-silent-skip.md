---
type: regex
target: last_message
pattern: '\b(skip|skipped|skipping) (this|that|the) (section|check)\b|treat it as (a )?(pass|passing)|warn(ing)? and continue'
match: not_contains
---

The wrong answers, in the words they usually arrive in. Each of these phrasings
converts a broken manifest — one vouching for a file it does not have — into an
absent check, which is how a fidelity gate turns into theatre: the section stops
being able to fail, and nobody who reads the green run will know it stopped.

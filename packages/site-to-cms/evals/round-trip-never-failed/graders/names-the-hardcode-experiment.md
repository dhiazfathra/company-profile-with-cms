---
type: regex
target: last_message
pattern: '([Hh]ardcod|[Hh]ard-cod|[Bb]aked?[ -]in|put the (?:literal|string|old value) back|revert the component|string literal)'
match: contains
matchExample: 'hardcode the headline back into the component and confirm the round trip fails'
---

The concrete experiment is to put the literal back into the component and watch
the test go red. An answer that argues for negative-direction verification in the
abstract but never names the manipulation has not told the author what to do, so
this grader asserts the specific act appears.

Phrased as several spellings of the same idea because the useful answer might say
"hardcode", "baked-in" or "put the string literal back" — all the same experiment.
Whether the answer _demands_ it rather than merely mentioning it is a question of
direction, which the LLM grader on this case handles.

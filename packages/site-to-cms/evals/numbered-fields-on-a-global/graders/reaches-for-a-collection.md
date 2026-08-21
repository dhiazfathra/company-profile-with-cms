---
type: regex
target: last_message
pattern: '([Cc]ollection|[Aa]rray field|[Rr]epeater|[Rr]epeatable field)'
match: contains
matchExample: 'model the cards as a BenefitsItem collection rather than numbered fields on the global'
---

The corrective action has a name in every CMS this skill covers: the repeating
thing stops being numbered fields and becomes a repeatable structure. An answer
that criticises the numbered fields without ever reaching for the construct that
replaces them has diagnosed and not prescribed.

Four spellings are accepted because more than one of them is right here. A
separate collection is the answer this repository chose for `BenefitsItem`, but
Payload's own `array` field solves the same cardinality problem without a second
collection, and "repeater" is the same idea in other content systems. Requiring
the literal word `collection` would have failed an answer recommending an array
field — correct guidance, rejected for vocabulary.

Still a deliberately weak necessary condition: it cannot tell "use a collection"
from "a collection would be overkill here". That direction is the LLM grader's job
on this case, and the two options differ in trade-offs a judge can weigh and a
keyword cannot. Read this one only as: the answer got as far as the right
vocabulary.

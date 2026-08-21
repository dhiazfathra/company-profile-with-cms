---
type: regex
target: last_message
pattern: '(\[object [Oo]bject\]|Lexical|Slate|[Rr]ich[- ]?[Tt]ext (?:document|node|tree|JSON)|serializ|serialis|not a string)'
match: contains
matchExample: 'the component receives a Lexical document, not a string, so it renders [object Object]'
---

The useful half of the answer is what actually reaches the component. An answer
that names the concrete artefact — a Lexical document, rich-text JSON, "not a
string" — or the concrete symptom `[object Object]`, or the missing serializer, has
followed the value through the seam. One that discusses rich text abstractly has
not.

Both spellings of serialise are allowed because both are correct English and the
repository uses British spelling elsewhere. Whether the answer _requires_ the
renderer rather than merely noting the risk is direction, and belongs to this
case's LLM grader.

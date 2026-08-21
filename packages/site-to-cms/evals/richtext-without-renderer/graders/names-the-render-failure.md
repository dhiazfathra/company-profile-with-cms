---
type: regex
target: last_message
pattern: '(\[object [Oo]bject\]|not valid as a React child|(?:[Ll]exical|[Ss]late)(?: [Rr]ich[- ]?[Tt]ext)? (?:document|node|tree|JSON|object|value)|[Rr]ich[- ]?[Tt]ext (?:document|node|tree|JSON)|serializ|serialis|not a string)'
match: contains
matchExample: 'the component receives a Lexical document, not a string, so it renders [object Object]'
---

The useful half of the answer is what actually reaches the component. An answer
that names the concrete artefact — a Lexical document, rich-text JSON, "not a
string" — or a concrete symptom, or the missing serializer, has followed the value
through the seam. One that discusses rich text abstractly has not.

Each editor's name must appear _with_ a word for the thing it produces
(`document`, `node`, `tree`, `JSON`, `object`, `value`). A bare "Lexical" is a
product name and is satisfied by "Payload uses Lexical", which says nothing about
what arrives at `{item.body}`.

Both symptoms are accepted, because both are real and which one occurs depends on
where the value lands: React throws `Objects are not valid as a React child` for a
direct JSX child, while a string context — a template literal, an `alt`, a
`title` — yields `[object Object]`. Requiring only the latter would fail an answer
that correctly named the thrown error.

Both spellings of serialise are allowed because both are correct English and the
repository uses British spelling elsewhere. Whether the answer _requires_ the
renderer rather than merely noting the risk is direction, and belongs to this
case's LLM grader.

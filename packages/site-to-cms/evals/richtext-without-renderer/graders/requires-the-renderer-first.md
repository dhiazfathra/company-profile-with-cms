---
type: llm
criteria: 'Does the answer identify that the plan ships a field type with no renderer — that a richText value arrives as a structured document (a Lexical/Slate node tree), not a string, so `{item.body}` cannot render it? Does it require the renderer to be added TOGETHER with the type — a rich-text serialiser in the component and the loader passing the document through — rather than accepting a diff that only widens the validator and the generator? Does it avoid treating "it typechecks" as evidence the change is safe, and avoid suggesting the value merely be stringified, `JSON.stringify`d, or flattened to plain text as the fix?'
focus: 'The missing renderer, and refusing the widening-only diff. An answer that approves the three steps, or that adds a fourth step of "check it renders" without identifying that a document is not a string, fails. Suggesting the field be stored as text with a markup convention instead is an acceptable alternative if the answer explains the trade-off. Either failure mode is acceptable as the named consequence — a thrown React error, or `[object Object]` where some layer stringifies the value first; do not require one specific symptom.'
---

The manifest's validator is the pipeline's one human gate, and this case asks for
it to be widened. The rule the skill teaches is that a generator turns a
description into code, so whatever the description permits, the code will contain —
which makes "the generator can emit it" an argument for the guard, not against it.

The failure is loud where the value reaches JSX directly: React refuses an object
as a child and throws `Objects are not valid as a React child`. It is _not_ a
silent `[object Object]` there — an earlier draft of this rubric claimed it was,
which was simply wrong about React. `[object Object]` is what you get in a string
context: a template literal, an `alt`, a `title`, a meta tag. Those are the paths
that fail quietly, and a section's copy is read into several of them.

Either way the type check is no help. At the boundary the value is `unknown`, so
nothing in the build objects; the difference is only whether the page crashes or
renders nonsense into an attribute.

An answer that reaches for `JSON.stringify` or a plain-text flattening has
satisfied the type and thrown away the feature that was asked for.

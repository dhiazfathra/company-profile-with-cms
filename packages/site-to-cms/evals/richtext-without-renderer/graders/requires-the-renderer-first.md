---
type: llm
criteria: 'Does the answer identify that the plan ships a field type with no renderer — that a richText value arrives as a structured document (Lexical/Slate JSON), not a string, so `{item.body}` will render as "[object Object]" or throw, and that nothing in the pipeline fails on this? Does it require the renderer to be added TOGETHER with the type — a rich-text serialiser in the component and the loader passing the document through — rather than accepting a diff that only widens the validator and the generator? Does it avoid treating "it typechecks" as evidence the change is safe, and avoid suggesting the value merely be stringified, `JSON.stringify`d, or flattened to plain text as the fix?'
focus: 'The missing renderer, and refusing the widening-only diff. An answer that approves the three steps, or that adds a fourth step of "check it renders" without identifying that a document is not a string, fails. Suggesting the field be stored as text with a markup convention instead is an acceptable alternative if the answer explains the trade-off.'
---

The manifest's validator is the pipeline's one human gate, and this case asks for
it to be widened. The rule the skill teaches is that a generator turns a
description into code, so whatever the description permits, the code will contain —
which makes "the generator can emit it" an argument for the guard, not against it.

What makes this dangerous rather than merely wrong is the silence. There is no
type error, because at the boundary the value is `unknown` and React will render
an object as `[object Object]` rather than crash. The fidelity check compares a
render, and a block-colour comparison of a section whose body copy has turned into
one grey run of nonsense may well still pass.

An answer that reaches for `JSON.stringify` or a plain-text flattening has
satisfied the type and thrown away the feature that was asked for.

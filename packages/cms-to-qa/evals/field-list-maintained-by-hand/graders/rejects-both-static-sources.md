---
type: llm
criteria: 'Does the answer reject BOTH options and keep discovery against the running Payload config? Does it explain why the checked-in list fails — a hand-maintained matrix drifts silently the day someone adds a field and forgets, and a matrix that under-reports is indistinguishable from a clean run? Does it explain why the manifest is also wrong, despite generating the schema: the panel serves the sanitized config, which adds fields and attaches a validate function to every field, so what the admin form actually presents and actually rejects cannot be read off the manifest — which is why the constraints are probed with a bad value rather than declared?'
focus: 'Rejecting the manifest as well as the hand-written file. An answer that dismisses option 1 and accepts option 2 as "close enough to the schema" fails — that is the plausible half of the trap.'
---

Option 2 is the interesting one. It sounds unimpeachable: read the same source the
schema is generated from and drift is impossible by construction. What it misses is
that the manifest describes intent and the sanitized config describes what the
panel serves — and the matrix is a test of the panel.

The probing exists for the same reason. Payload attaches a validator to every
field, so "has a validator" carries no information; the only way to learn what a
field refuses is to offer it something bad and observe. A static list can restate
the fields, and cannot answer that question at all.

The saved minutes are real. They buy a matrix that describes a config which may no
longer be the one running.

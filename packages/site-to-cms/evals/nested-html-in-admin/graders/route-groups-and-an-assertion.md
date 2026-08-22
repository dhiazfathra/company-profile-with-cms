---
type: llm
criteria: 'Does the answer explain that the Payload admin ships its own root layout with its own `<html>` and `<body>`, so inheriting the public root layout nests one `<html>` inside another — and that the correct structure is two route groups with a root layout each, e.g. `app/(frontend)/layout.tsx` and `app/(payload)/layout.tsx`, rather than nesting the admin under the existing root? Does it reject "everything functions" as a reason to leave it, explaining that the browser silently repairs the invalid nesting so the damage is invisible rather than absent? Does it also require the invariant be asserted in a test — loading /admin and requiring exactly one `<html>` element, and/or failing on console errors — rather than fixing it and moving on?'
focus: 'Three parts: the diagnosis, refusing "it works", and leaving a check behind. An answer that suppresses the warning, or that only silences it (suppressHydrationWarning, ignoring the dev overlay, waiting for production where the message does not appear) instead of restructuring the layouts, fails.'
---

A hydration mismatch is the rare defect that reports itself and is still ignored,
because the page keeps working: the browser repairs invalid nesting on its own, so
the only symptom is a line in a console nobody reads.

Two route groups with a root layout each is a structural property of the
arrangement, and the skill's rule about structural properties applies — one that
nothing enforces is a comment. The reference implementation asserts exactly one
`<html>` on `/admin` and requires a clean console on both apps, because this is
precisely the kind of thing a later refactor reintroduces without noticing.

`suppressHydrationWarning` is the wrong answer here in a way worth naming: it
removes the only signal while leaving the invalid DOM.

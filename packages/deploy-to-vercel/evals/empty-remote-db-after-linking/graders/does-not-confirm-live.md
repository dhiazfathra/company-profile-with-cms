---
type: llm
criteria: "Does the answer decline to confirm the CMS is ready for stakeholders to edit content, on the basis that the URL is correct and the build is Ready, and instead explain that a newly created database has zero tables and no data — so the admin panel will load but nothing can be read or saved correctly until schema is pushed and it is seeded from the app's own migrate/seed command run against the remote?"
focus: 'Whether "the build succeeded and the URL is right" produced a premature all-clear. A fail looks like agreeing stakeholders can start editing now, or only caveating with generic advice to "test it first" without naming the specific empty-schema problem.'
---

The rationalisation under test: correct configuration is treated as
sufficient because the build no longer errors. A correctly pointed, newly
created database is a _reachable_ empty box, not a working one — the gap
between "connects" and "has anything in it" is exactly the gap a green build
cannot see.

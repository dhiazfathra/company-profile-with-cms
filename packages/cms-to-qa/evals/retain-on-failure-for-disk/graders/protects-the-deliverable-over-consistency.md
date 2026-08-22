---
type: llm
criteria: 'Does the answer refuse the change and explain that this project is the deliberate exception to the repository''s retain-on-failure convention, because the passing recording IS the SIT deliverable — a tester verifies a case by watching the value typed into the panel and the panel accepting it, which a green row cannot show them? Does it hold that position against the consistency argument rather than treating uniformity as the tie-breaker, and against the "nobody watches a passing video" argument by naming who does: the tester signing SIT off, and the release ticket the .webm files are attached to? Does it offer a disk answer that does not cost the artefact, such as retention policy, per-page runs, or compression, rather than the config flip?'
focus: 'Refusing a change that is correct everywhere else in the repository. An answer that accepts the flip, or that accepts it for passing cases only in CI while keeping it locally, fails — the CI run is the one that produces the pack.'
---

The proposal is right about the convention and right that it is one line, and it
would silently destroy the reason this skill exists. `retain-on-failure` keeps the
video for the cases nobody needs a video of and drops it for every case a tester
would sign against.

That inversion is why the setting is called out explicitly as project-specific
rather than left to whoever next tidies the config — and a request framed as
"making the suite uniform" is exactly how the exception gets tidied away.

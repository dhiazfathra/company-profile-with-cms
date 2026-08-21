---
type: llm
criteria: 'Does the answer identify the cause as shared mutable state — the round trip writes Header.headline while the fidelity test reads that same section, and a different headline string wraps differently and changes the section height, hence the aspect failure? Does it reject BOTH offered options: retries as hiding a real defect rather than fixing it, and `workers: 1` as making every read-only test pay for one writer? Does it propose isolating the writer by ORDERING — a separate runner project for the mutating spec that depends on the read-only project, so it starts only after the others have finished — or an equivalent that keeps the rest of the suite parallel?'
focus: 'Naming shared state as the cause, rejecting both offered fixes, and reaching for ordering rather than serialisation. An answer that picks `workers: 1` because it is proven, or that keeps retries as a mitigation, fails. Giving the round trip its own database or its own field is an acceptable alternative if the answer explains why isolation of the state also works.'
---

Both options in the prompt work, which is the trap. Retries make the symptom rare
and the defect permanent — and worse, they will also mask the next real
intermittent failure in that suite. `workers: 1` is correct and costs six times the
wall clock, charged to twenty-two tests that never write anything.

The reasoning the skill teaches is that a seam test necessarily mutates state
every other test reads, so it needs isolation by construction rather than by luck
or by global serialisation. Ordering gives that: the writer runs last, alone,
after everything else has finished reading the seeded state.

Note the `finally` restore is already present and does not help — the window is
between the write and the restore, which is exactly when the other tests are
running.

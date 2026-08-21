# site-to-cms evals

These evals prove the _skill_ does its job: given a scenario, does an agent
reading [`SKILL.md`](../SKILL.md) reach the conclusion the skill was written to
force?

That is the only kind of test available here. Every rule in the skill exists
because a _judgement_ went wrong — a green suite was read as evidence, a
localization flag was treated as a config change, a flaky test was answered with
retries, a formatter was blamed for reporting a real violation. Those are
decisions, not functions. No unit test can fail on them.

## Layout

```
evals/
  <case>/
    prompt.md          # frontmatter + the scenario put to the agent
    graders/*.md       # one assertion each
```

Every case is a **pure reasoning case**: `allowed_tools: []`, no network, no CMS,
no scaffold. The scenarios carry real field names, real error messages and real
numbers from this repository's own migration, so a case cannot be satisfied by
generic CMS advice.

## Cases

| Case                              | The judgement under test                                                                 | Its source                                                           |
| --------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `seed-agreement-blindness`        | A green suite after a migration proves nothing, because the seed made both sources agree | the 154 passing tests that never checked the seam                    |
| `round-trip-never-failed`         | A seam test that has only ever passed is not known to detect anything                    | the negative-direction proof in `scripts/e2e-evidence.mjs`           |
| `shape-and-source-at-once`        | Reshape the content, then change the reader — not both in one move                       | ADR-0004                                                             |
| `numbered-fields-on-a-global`     | Cardinality decides global versus collection, not how many sections there are            | the `BenefitsItem` collection                                        |
| `localized-flip`                  | A `translatable` flip is a data migration; do not delete the guard                       | `checkTranslatableFlips`, ADR-0005                                   |
| `richtext-without-renderer`       | A field type with no renderer ships `[object Object]` and nothing fails                  | the `richText` rejection in `schemas/manifest.ts`                    |
| `nested-html-in-admin`            | Two apps on one origin need a root layout each, and the invariant needs asserting        | the hydration mismatch on `/admin`                                   |
| `flaky-fidelity-after-round-trip` | Isolate the writer by ordering; retries hide it and one worker overcharges               | the round trip racing `design-fidelity.spec.ts`                      |
| `production-secret-fallback`      | A secret must fail closed in production, and every build path then needs it              | `payload.config.ts`'s secret, and the evidence script that lacked it |
| `evidence-says-static-export`     | An evidence pack must observe the build, not remember it                                 | the hardcoded "static export" row that outlived `output: 'export'`   |
| `blaming-the-format-gate`         | Reproduce a tool's complaint before working around it                                    | four `--no-verify` commits on a diagnosis that was never tested      |

## Running

`claude plugin eval` is in early access. Where it is enabled:

```bash
cd packages/site-to-cms
claude plugin eval . --threshold 0.8
```

Scores and the HTML report land in `evals/results/<timestamp>/`, which is
ignored. `.` resolves this directory as a skills-dir plugin (`SKILL.md` at its
root) and `evals/` is the default eval directory. The run adds a no-plugin
baseline arm, so the number that matters is the **delta**: a case both arms pass
was never testing the skill, only the model.

Where it is not enabled the command exits 1 with
`` `plugin eval` is currently in early access ``. That is why the suite's own
structure is checked by `tests/evals.test.mjs` in CI on every push.

## What these evals cannot see

Stated here for the same reason SKILL.md's last step exists — a suite that
reports only passes teaches the next reader that a pass means the skill works.

- They grade **text**, not a shipped migration. An agent can describe the right
  round-trip test and still write one that asserts nothing.
- A keyword grader cannot read polarity. `contains: collection` is satisfied by
  "use a collection" and by "a collection is overkill" alike. So every
  deterministic grader here asserts _positive evidence of the right decision_,
  and every requirement that turns on direction — refuse the bypass, reject both
  offered options, do not act on an unverified diagnosis — is carried by the
  case's LLM grader. That split is deliberate and it is also the weak point: the
  direction-sensitive half of this suite is the judged half. `tests/evals.test.mjs`
  therefore requires every case to carry both kinds.
- The LLM graders are a 2-of-3 judge vote on prose, the weakest assertions here.
  Read the deterministic ones the other way round: a cheap _necessary_ condition,
  never a sufficient one. A pattern can say an answer never reached for a
  collection; it cannot say the answer was right.
- Several cases put a _correct_ artefact to the agent and grade what it does not
  say — `round-trip-never-failed` has a good test in it, `blaming-the-format-gate`
  has a plausible diagnosis. Those are the cases most likely to be passed by an
  agreeable answer, and the hardest to grade deterministically.
- `runs: 2` per case is a small sample. Treat a single failing run as a signal to
  re-run, and a consistent one as a defect in `SKILL.md`.
- Every scenario comes from **one** migration, of one site, onto one CMS. The
  guidance may fit Payload's globals-and-collections model more closely than it
  fits a CMS shaped differently, and nothing here would reveal that.

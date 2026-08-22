# cms-to-qa evals

These evals prove the _skill_ does its job: given a scenario, does an agent
reading [`SKILL.md`](../SKILL.md) reach the conclusion the skill was written to
force?

That is the only kind of test available here. Every rule in the skill exists
because a _judgement_ went wrong — a green run was read as evidence, a
single-page run was handed over as the CMS, a failing case was answered with a
retry, a hidden field was read as a broken suite, a figure was going to be typed
in by hand. Those are decisions, not functions. No unit test can fail on them.
`tests/scenarios.test.mjs` and `tests/artifacts.test.mjs` cover the row set and
the artefacts; nothing there can tell you whether the pack gets handed over when
it should not be.

## Layout

```text
evals/
  <case>/
    prompt.md          # frontmatter + the scenario put to the agent
    graders/*.md       # one assertion each
```

Every case is a **pure reasoning case**: `allowed_tools: []`, no CMS, no browser,
no run. The scenarios carry real field names, real validator messages and real
report sections from this repository's own field matrix, so a case cannot be
satisfied by generic QA advice.

## Cases

| Case                               | The judgement under test                                                              | Its source                                      |
| ---------------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `green-run-with-unobserved-saves`  | A green run with entries in the unobserved section is the bug class, not a pass       | the "Saved, but not observed" section, ADR-0019 |
| `one-page-run-called-cms-coverage` | A one-page run is evidence about one page, whatever the workbook looks like           | the "Pages not run by this invocation" section  |
| `deleting-the-not-covered-section` | Deleting the gap list turns a pass into a claim nobody made                           | the Not Covered sheet, AGENTS.md                |
| `retry-on-a-failing-case`          | Decide which side is wrong; neither retry nor relax the assertion                     | the whitespace-on-`href` misread                |
| `every-case-missing-the-locator`   | Every case of one field failing on a locator is a hidden field, not a broken suite    | limitation 8, `_seedIndex`                      |
| `login-failure-read-as-flake`      | One failure and 13 "did not run" after a login error is a database, not a flake       | the `beforeAll` attribution misread             |
| `hand-edited-figure-in-the-report` | Every figure comes from the run's own logs, even when the typed one would be true     | the "never hand-edit a number" rule             |
| `retain-on-failure-for-disk`       | Here the passing recording is the deliverable, so the repo-wide default is wrong      | the `cms-fields` video setting                  |
| `field-list-maintained-by-hand`    | The matrix is discovered from the running config — not hand-written, not the manifest | ADR-0018                                        |
| `rejected-case-baseline`           | A refused save leaves the _previous_ case's value, which is the correct baseline      | the third misread failure                       |

## Running

`claude plugin eval` is in early access. Where it is enabled:

```bash
cd packages/cms-to-qa
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

Stated here for the same reason the skill's own reports carry a gap list — a
suite that reports only passes teaches the next reader that a pass means the
skill works.

- They grade **text**, not a handed-over pack. An agent can describe the right
  refusal and still attach the workbook to the ticket.
- A keyword grader cannot read polarity. `contains: rerun` is satisfied by "rerun
  it" and by "no need to rerun" alike. So every deterministic grader here asserts
  _positive evidence of the right decision_, and every requirement that turns on
  direction — refuse both offered fixes, block the sign-off, decline the
  requested rewrite — is carried by the case's LLM grader. That split is
  deliberate and it is also the weak point: the direction-sensitive half of this
  suite is the judged half. `tests/evals.test.mjs` therefore requires every case
  to carry both kinds.
- The LLM graders are a 2-of-3 judge vote on prose, the weakest assertions here.
  Read the deterministic ones the other way round: a cheap _necessary_ condition,
  never a sufficient one.
- Several cases put a scenario where everything observed is **correct** and only
  the conclusion is wrong — `rejected-case-baseline`, `retain-on-failure-for-disk`,
  `field-list-maintained-by-hand`. Those are the cases most likely to be passed by
  an agreeable answer, and the hardest to grade deterministically.
- `runs: 2` per case is a small sample. Treat a single failing run as a signal to
  re-run, and a consistent one as a defect in `SKILL.md`.
- Every scenario comes from **one** CMS, one field matrix, one site. The guidance
  may fit Payload's admin panel more closely than it fits a CMS shaped
  differently, and nothing here would reveal that.

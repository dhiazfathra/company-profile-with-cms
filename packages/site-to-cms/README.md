# site-to-cms

Move a built site's content into a CMS and prove the page actually reads from it.

**[SKILL.md](./SKILL.md) is the substance of this package.** It carries the
workflow, the reasoning, and the failure each rule was written from.

This is the second step of a pair. [`figma-to-site`](../figma-to-site/) gets a
design onto a page and proves the render matches the design; this one moves that
page's content behind a CMS and proves the seam is real.

## Why this exists

A content migration makes the old and new sources agree — that is what
"migration" means. Every equality check you own is therefore blind for the
duration.

In this repository, Phase 2 moved eleven sections' copy into Payload and finished
with 131 unit tests, 23 e2e tests, eleven design-fidelity comparisons, a
locale-fallback suite, a clean lint and a passing build. **Every one of those
would have been green with the CMS not connected at all**, because the seed wrote
into the CMS exactly the strings the components had hardcoded. The migration's
whole claim had no check behind it.

The skill is the workflow plus the one check that closes that, and the several
smaller traps found on the way there: a hydration mismatch nobody reads, a
localization flag that is really a data migration, a secret that fails open, a
seam test that flakes the suite it was added to, and an evidence pack that
remembered a fact instead of observing it.

## Contents

| Path                   | What it is                                                                               |
| ---------------------- | ---------------------------------------------------------------------------------------- |
| `SKILL.md`             | The workflow: eleven steps, a checklist, and the rationalisations table                  |
| `evals/`               | Eleven reasoning cases that grade the skill — see [`evals/README.md`](./evals/README.md) |
| `tests/evals.test.mjs` | The eval suite's own structure, checked in CI on every push                              |

There is no `src/`. Unlike `figma-to-site`, whose guardrails are pixel work that
had to be written before it could be reasoned about, everything here is a
judgement about how to sequence a migration and what to prove about it. The
runnable parts live in the consuming app, where the content model does:
`apps/web/scripts/gen-cms.ts`, `apps/web/schemas/manifest.ts`,
`apps/web/e2e/cms-round-trip.spec.ts`.

## Commands

| Command                | Description                                                                                                       |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `bun run test`         | The eval suite's structure — malformed graders, cases with no assertions, ungrounded scenarios                    |
| `claude plugin eval .` | The [skill evals](./evals/README.md) themselves: does an agent _reading_ SKILL.md judge correctly? (early access) |

## Two kinds of test, because two kinds of thing can be wrong

`figma-to-site` splits these as code tests and skill evals. Here there is no code
to test, so the split is different: the **evals** grade the judgements, and
`tests/evals.test.mjs` grades the evals.

That second layer is not ceremony. `claude plugin eval` is in early access, so on
most machines it exits before reading a single case — which means a malformed
grader or a case with no assertions in it would sit there indefinitely looking
like coverage. Same rule as an empty asset scan: a check nobody can run is not a
check.

It has been verified in both directions. Nine deliberately broken fixtures — an
empty pattern, a pattern that cannot match its own `matchExample`, a pattern that
matches the empty string, a grader with no rubric, a case that acquires a tool, a
renamed case, a case with no deterministic grader, a case with no judged grader,
and a manifest field reference reduced to decoration — are each rejected, and each
for the right reason. A validator that has only seen a clean suite is not known to
validate anything.

Decisions behind this: `docs/decisions/0012` (why the CMS step is a second skill
with evals of its own), and `0010` (why a skill gets evals at all, and why CI
checks the suite rather than running it).

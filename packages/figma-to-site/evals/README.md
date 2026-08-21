# figma-to-site evals

The package's `tests/` prove the _code_ behaves. These evals prove the _skill_
does: given a scenario, does an agent reading `SKILL.md` reach the conclusion the
skill was written to force?

That distinction matters here more than usual. Every guardrail in `src/` exists
because a _judgement_ went wrong first — a size was believed because a crop
succeeded, a badge was treated as a blemish rather than as evidence, a tolerance
was raised to get a build green. Those are decisions, not functions. A unit test
cannot fail on them, so nothing did.

## Layout

```
evals/
  <case>/
    prompt.md          # frontmatter + the scenario put to the agent
    graders/*.md       # one assertion each
```

Every case is a **pure reasoning case**: `allowed_tools: []`, no network, no Figma
seat, no scaffold. The scenarios carry the numbers and node ids from the real
capture of the Modern Product Launch file this repository was built from
(`apps/web/design/figma.targets.json`), so a case cannot be satisfied by
generic design-system advice.

## Cases

| Case                             | The judgement under test                                                               | Its source                                                      |
| -------------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `modern-product-launch-pipeline` | Plan the whole pipeline for the real file, without reaching for the paid-seat MCP path | `SKILL.md` steps 1–8                                            |
| `badge-in-crop`                  | A badge means the declared size is wrong — read the number off it, don't paint it out  | the `1200 Fill x 664.29 Fill` badge that shipped into `public/` |
| `wrong-shape-section`            | A section the wrong _shape_ is a padding bug before it is a bad crop                   | the showcase section misdiagnosed as a third bad capture        |
| `design-width-from-css`          | A CSS `max-width` is not evidence of the design's rendered width                       | the 1500px container shipped against a 1200px design            |
| `distrusted-reference`           | Withholding the content check must not withhold the aspect check                       | the trust-manifest asymmetry                                    |
| `tolerance-without-reason`       | A tolerance change is a fidelity decision, not a config tweak                          | `blockToleranceReason`                                          |
| `missing-reference`              | A manifest vouching for an absent file is broken — fail, don't skip                    | `checkSection`'s missing-reference branch                       |
| `empty-asset-scan`               | A scan with nothing to scan is a failure, not a pass                                   | `scanAssets`                                                    |
| `pixel-diff-request`             | Neither a pixel-diff nor a screenshot baseline is a design gate                        | ADR-0008                                                        |
| `no-reference-section`           | Build against a reference or label the component unverified                            | the CTA section built from copy alone                           |

## Running

`claude plugin eval` is in early access. Where it is enabled:

```bash
cd packages/figma-to-site
claude plugin eval . --threshold 0.8 --report ../../eval-report.html
```

`.` resolves this directory as a skills-dir plugin (`SKILL.md` at its root) and
`evals/` is the default eval directory. The run adds a no-plugin baseline arm, so
the number that matters is the **delta**: a case both arms pass was never testing
the skill, only the model.

Where it is not enabled the command exits 1 with
`` `plugin eval` is currently in early access ``. That is why the suite's own
structure is checked by `tests/evals.test.mjs`, which runs in CI on every push:
a malformed grader, a case with no assertions, or an empty suite fails there
rather than lying dormant until someone gets access.

## What these evals cannot see

Stated here for the same reason `SKILL.md` step 8 exists — a suite that reports
only passes teaches the next reader that a pass means the skill works.

- They grade **text**, not a shipped site. An agent can describe the right
  pipeline and still implement it wrong.
- The LLM graders are a 2-of-3 judge vote on prose. They are the weakest
  assertions here; every case therefore also carries at least one deterministic
  grader.
- `runs: 2` per case is a small sample. Treat a single failing run as a signal to
  re-run, and a consistent one as a defect in `SKILL.md`.
- Nothing here checks the skill against a Figma file it was _not_ written from.
  The scenarios are drawn from one design; a second file could expose guidance
  that only happens to fit this one.

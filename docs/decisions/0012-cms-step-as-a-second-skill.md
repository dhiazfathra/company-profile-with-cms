# ADR-0012: Ship the CMS step as a second skill, evals only, no extracted code

## Status

Accepted

## Date

2026-08-22

## Context

`packages/figma-to-site` captures the first half of this repository's work: get a
Figma design onto a page and prove the render matches it. Phase 2 (PR #5) did the
second half — moved the site's content into Payload — and produced a body of
knowledge that is not in that skill and does not belong in it.

The two halves fail differently, and that difference is the whole reason for a
second document. A fidelity defect is _visible_: a wrong crop, a wrong shape,
something a human notices by looking at the page. A broken CMS seam is
_indistinguishable from success_ — the page renders the right words whether it read
them from the database or from a string literal three lines above.

That distinction produced the migration's central near-miss. Phase 2 finished with
131 unit tests, 23 e2e tests, eleven design-fidelity comparisons, a locale-fallback
suite, a clean lint and a passing build. **Every one would have been green with the
CMS not connected at all**, because the seed wrote into Payload exactly the strings
Phase 1 had hardcoded, and every check then compared one source to an identical copy
of the other. The claim the migration existed to make had no check behind it at all.

Several smaller judgements went wrong on the way, each leaving a rule worth keeping:
a hydration mismatch on `/admin` dismissed because the panel worked; a
`translatable` flip that is really a data migration; a secret that fell back
silently in production; the seam test racing the fidelity suite it was added to; an
evidence pack that remembered "static export" after the export was removed; and a
format gate blamed for a violation it was correctly reporting, worked around with
four `--no-verify` commits on a diagnosis that was never tested.

## Decision

Ship `packages/site-to-cms` as a sibling skill to `figma-to-site`, with:

- `SKILL.md` — eleven steps, a checklist and a rationalisations table, built around
  one rule: **prove the seam, not the render**.
- `evals/` — eleven pure reasoning cases (`allowed_tools: []`), each drawn from one
  of the judgements above, each carrying one deterministic grader and one LLM
  grader.
- `tests/evals.test.mjs` — the suite's own structure, run in CI on every push.
- **No `src/`.**

### Why a second skill rather than a section in the first

`figma-to-site`'s SKILL.md is already 25KB and its rules all serve one claim (the
render matches the design). Appending a second, differently-shaped claim would
dilute the description an agent matches against, and the two are used at different
times: you finish the first before starting the second. Two skills also let the
evals stay separate, which matters because the graders differ in kind — one suite
grades reasoning about pixels, the other about seams and sequencing.

### Why no extracted code

`figma-to-site` pairs a skill with runnable code because the code came first: the
crop, the chrome detector and the two-axis comparison are pixel work that had to
exist before anything could be reasoned about, and they are genuinely
project-independent.

Nothing here is like that. The runnable parts of the CMS step —
`apps/web/scripts/gen-cms.ts`, `apps/web/schemas/manifest.ts`,
`apps/web/e2e/cms-round-trip.spec.ts` — are each tightly bound to this project's
content model, its Zod schema and its Payload version. Extracting them would mean a
generator parameterised over a manifest format nobody else has, and a rewiring of
`apps/web` that this change does not need. The knowledge that transfers is the
judgement, and the judgement is what `SKILL.md` and the evals carry.

Left deliberately for later: if a second project adopts the manifest format, the
generator becomes worth extracting and this decision should be revisited.

### Why the structural test is a near-duplicate of `figma-to-site`'s

`tests/evals.test.mjs` repeats most of the sibling package's frontmatter parser and
grader checks. A shared harness was considered and rejected: it would couple the two
suites' frontmatter conventions, and the one assertion that differs is the one that
matters most in each. There, a case must be put against a real Figma file. Here, a
case must be put against a field that really exists in `apps/web/site.manifest.json`
— read from the manifest, so renaming a field breaks the test rather than quietly
un-grounding the suite.

That check earned its keep immediately, and in the direction that matters. Written
first as a per-case rule ("every case naming a real field must be graded on it") it
failed a case whose scenario mentioned `Header.headline` incidentally while testing
something else entirely. Satisfying it would have meant bolting an irrelevant field
name into a grader about test ordering — the check degrading the graders it exists
to protect. It was narrowed to "at least one case is graded against a real field",
which is the substance without the collateral.

## Consequences

- Root `bun run test` gains `packages/site-to-cms`; CI runs it on every push
  through the existing `verify` job.
- The eval suite's structure is verified in both directions. Nine probes — an
  empty pattern, a pattern that cannot match its own `matchExample`, a pattern
  matching the empty string, a grader with no rubric, a case acquiring a tool, a
  renamed case, a case with no deterministic grader, a case with no judged grader,
  and a manifest reference reduced to decoration — are each rejected, each for the
  right reason. A validator that has only seen a clean suite is not known to
  validate anything.
- `claude plugin eval` remains early-access gated, so the eleven cases are not
  scored in CI. Same position as ADR-0010: the structure is checked instead, because
  a check nobody can run is not a check.
- The skill is written from **one** migration, of one site, onto one CMS. Its
  global-versus-collection guidance fits Payload's model more closely than it may
  fit a CMS shaped differently, and nothing in the suite would reveal that.
  Recorded in `evals/README.md` rather than left for a reader to discover.

## Alternatives considered

**Fold the CMS rules into `figma-to-site`.** Rejected: dilutes a description an
agent matches on, and joins two claims that are made at different times and fail in
different ways.

**Extract a `manifest-to-payload` package with the generator in it.** Rejected for
now — see above. The generator has exactly one consumer and a format nobody else
uses; extracting it would be an abstraction built for a second caller that does not
exist.

**Write the skill with no evals, as documentation.** Rejected for the reason
ADR-0010 gives: every rule in it exists because a judgement went wrong, and prose
that nothing grades drifts out of agreement with the code it describes without
anyone noticing.

**Grade the evals only by LLM judges.** Rejected: a 2-of-3 vote on prose can drift
with the judge model and nobody would see it move. Every case carries a
deterministic grader as a cheap necessary condition — and, because a keyword match
cannot read polarity, also an LLM grader to hold the direction-sensitive half.
`tests/evals.test.mjs` enforces both.

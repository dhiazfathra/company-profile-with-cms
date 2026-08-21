# ADR-0010: Evaluate the skill's judgement behaviourally, and validate the suite structurally

## Status

Accepted

## Date

2026-08-21

## Context

`packages/figma-to-site` ships two things: runnable code (`src/`, `bin/`) and a
skill (`SKILL.md`) that tells an agent how to use it. The code has 48 tests, each
reproducing a failure mode in both directions — the bad artefact is rejected, the
corrected one accepted (ADR-0008).

Nothing tested the skill. And the skill is where the failures actually came from.
Read back through ADR-0007 and ADR-0008 and every guardrail in `src/` traces to a
_judgement_ that went wrong before any code did:

- A declared node size was believed because the crop using it succeeded. The crop
  cannot fail, so success was not evidence.
- A Figma dimension badge in a shipped asset was read as a blemish to remove
  rather than as Figma printing the node's real size — the evidence that the
  declared size was wrong.
- A section that came out the wrong shape was diagnosed as a bad capture. It was
  96px of padding in the component, and re-cropping on the wrong theory shipped
  the badge into `public/`.
- A CSS `max-width: 1500px` read off an inspector panel was taken as the design's
  rendered width, against a design drawn at 1200.

Those are decisions, not functions. A unit test cannot fail on them, and none
did — every gate was green while a green band shipped nested inside another green
band. `SKILL.md` exists to stop the _next_ agent making those calls, and until now
nothing checked whether reading it actually changes the call.

## Decision

Add a behavioural eval suite at `packages/figma-to-site/evals/`, in the layout
`claude plugin eval` expects (`<case>/prompt.md` + `<case>/graders/*.md`), with one
case per failure mode above and one put directly against the Modern Product Launch
file this repository's own site was built from.

Two constraints on how the cases are written:

1. **Pure reasoning cases** — `allowed_tools: []`, no network, no Figma seat, no
   scaffold. The scenarios carry the real node ids and numbers from
   `apps/web/design/figma.targets.json`, so a case cannot be satisfied by generic
   design advice, and cannot be satisfied by an agent going and reading this
   repository instead of knowing what the skill teaches.
2. **Every case keeps at least one deterministic grader** beside its LLM judge, so
   no case rests entirely on a 2-of-3 vote on prose that could drift with the
   judge model.

And, because `claude plugin eval` is in early access and exits 1 on a machine
without it: **validate the suite's structure in CI**, in
`packages/figma-to-site/tests/evals.test.mjs`. Every prompt loads, every grader is
well-formed and carries a rubric, every regex compiles and matches neither the
empty string nor nothing at all, no case is judge-only, an empty suite fails, and
a case naming a Figma file must have a grader holding the answer to _that_ file.

## Alternatives considered

### More unit tests instead

- Pros: runs everywhere, free, deterministic.
- Cons: the 48 existing tests already cover every guardrail in both directions.
  More of them would test the same code harder and still not touch the judgement
  layer.
- Rejected: it would raise the number without covering the gap.

### A hand-written checklist in `SKILL.md` and nothing else

- Pros: zero machinery. The checklist is already there.
- Cons: a checklist is the thing under test, not a test of it. It cannot tell you
  whether an agent reading it reaches the right conclusion under pressure — and
  three of the ten cases apply pressure deliberately (a deadline, a plausible
  request to loosen a tolerance, "I can eyeball it later").
- Rejected: this is the same shape as "the e2e suite already screenshots the
  page" — an artifact compared against nothing.

### Ship `evals/` with no structural test, and run it when access arrives

- Pros: less code.
- Cons: on this machine `claude plugin eval` exits 1 before reading a single case,
  so a malformed grader or a case with no assertions in it would sit in the
  repository looking like coverage indefinitely. That is precisely the failure
  this package exists to prevent, and the same rule already applied to an empty
  asset scan: nothing to check is a failure, not a clean bill of health.
- Rejected: a check nobody can run is not a check.

### Rely on LLM graders alone

- Pros: they read intent, which is what is being tested.
- Cons: a judge vote can move without anyone noticing.
- Rejected as the sole mechanism; kept as half of each case, with the split
  recorded below.

## Consequences

- The suite grades **text**, not a shipped site. An agent can describe the right
  pipeline and implement it wrong. This complements the fidelity gate; it does not
  overlap with it.
- Keyword graders cannot read polarity: `contains: headless` is satisfied by "use
  headless Chromium" and by "avoid headless Chromium" alike, and a `not_contains`
  on a phrase fails the correct answer that quotes the phrase in order to reject
  it. So every deterministic grader asserts _positive evidence of the right
  decision_, and every direction-sensitive requirement is carried by the case's
  LLM grader. The judged half of the suite is therefore its load-bearing half —
  written down here and in `evals/README.md` rather than left for a reader to
  discover.
- `runs: 2` per case is a small sample. A single failing run is a signal to
  re-run; a consistent one is a defect in `SKILL.md`.
- Every scenario comes from one design. A second Figma file could expose guidance
  that only happens to fit this one; nothing here would catch that.
- Running the suite costs model calls and needs the early-access gate open. CI
  runs only the structural validation, which is free.

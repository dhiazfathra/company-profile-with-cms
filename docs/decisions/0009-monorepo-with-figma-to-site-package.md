# ADR-0009: Split the repository into a monorepo, with the Figma pipeline as a package

## Status
Accepted

## Date
2026-08-21

## Context
Phase 1 produced two things that happen to have been built in the same directory:

1. `company-profile-with-cms` — a manifest-driven Next.js site of one specific
   design (ADR-0001 through ADR-0006).
2. A general method for turning *any* publicly viewable Figma file into code and
   proving the result matches: capture by screenshot (ADR-0007) and an automated
   two-axis fidelity gate (ADR-0008).

The second is the more valuable output, and it was buried. `scripts/`,
`e2e/design-fidelity.spec.ts` and `design/refs/refs.json` sat interleaved with the
site's own `validate-manifest.ts`, its content loader tests and its page
components. Three specific costs followed:

- **The method could not be reused.** The next project would copy four `.mjs`
  files and drift from them. The workflow document describing how to use them
  lived outside the repository entirely, in a personal skills directory, where it
  could not be reviewed or versioned with the code it describes.
- **Per-project data was hardcoded in shared code.** `capture-figma.mjs` carried
  a `TARGETS` table of this design's node ids and declared sizes. Those declared
  sizes are the most dangerous data in the pipeline — two wrong ones shipped the
  wrong pixels — and they were embedded in the module that consumed them, where
  nobody reviews them against the design.
- **The guardrails had no tests of their own.** The site's suite exercised the
  detector against the site's own committed assets, which are (now) clean. Nothing
  reproduced a dimension badge and asserted it was rejected. A detector that has
  only seen clean input is not known to detect anything — and this project already
  learned that lesson the expensive way.

## Decision
Restructure as a Bun-workspaces monorepo:

```
apps/web/                    the Next.js site, unchanged in behaviour
packages/figma-to-site/      the Figma capture + fidelity pipeline
  SKILL.md                   the workflow, its rationale, and its failure history
  src/                       figma-crop, capture, design-check, scan-assets
  bin/                       figma-capture, figma-verify-design, figma-check-assets
  tests/                     each guardrail's failure mode reproduced
docs/decisions/              repository-wide ADRs, including this one
```

Three rules fall out of the split and are load-bearing:

- **Per-project data leaves the package.** The site's node ids, declared sizes and
  output paths are now `apps/web/design/figma.targets.json`, validated by
  `validateConfig` before a browser opens. Reference trust stays in
  `apps/web/design/refs/refs.json`. The package contains no knowledge of this
  design.
- **`SKILL.md` ships inside the package.** The workflow and the code it describes
  version together, and a reviewer sees both in one diff. This is also what makes
  the method a first-class deliverable of the project rather than a byproduct.
- **The package tests its own guardrails, in both directions.** Fixtures are
  generated with `sharp` rather than committed as PNGs, so each test states its
  premise — "a 2px blue stroke", "a 237x34 filled badge" — instead of pointing at
  an opaque binary whose relevant property is invisible. One test asserts the
  block comparison's *blindness* to a badge on purpose: that blindness is the
  documented reason the chrome detector exists separately, so if it ever changes,
  the reasoning needs revisiting.

## Alternatives Considered

### Leave everything at the repository root
- Pros: zero migration; no workspace tooling; every path in every doc stays valid
- Cons: keeps all three costs above. In particular the method stays uncopyable and
  its workflow document stays outside version control
- Rejected: the reusable method is the more valuable of the two outputs, and it was
  the one with no home

### Publish `figma-to-site` to npm as a separate repository
- Pros: genuinely reusable by anything; independent release cadence
- Cons: the only consumer is here, and the package's credibility rests entirely on
  the failures documented in this repository's ADRs and this design's assets. A
  split repository separates the guardrails from the corpus that proves they work,
  and every fix becomes a two-repository dance with a version bump between
- Rejected: premature. A workspace package can be extracted later; the reverse is
  harder. Kept `private: true` for the same reason

### Copy the scripts into each future project
- Pros: no abstraction to design, no config indirection
- Cons: the guardrails drift, and each copy re-learns the failures by repeating
  them. The whole point of ADR-0007/0008 is that these mistakes are not obvious
  and do not announce themselves
- Rejected: this is the failure mode the package prevents

### Extract only the code, keep the workflow document in a personal skills directory
- Pros: less to review; the document can be edited freely
- Cons: the document *is* the deliverable. Half of what was learned — do not infer
  a node size from a downscaled reference, suspect the component before the asset,
  two numbers agreeing is not evidence — is reasoning that no amount of reading the
  code recovers
- Rejected: unversioned prose beside versioned code rots, and this prose is the
  expensive part

### Turborepo or Nx for orchestration
- Pros: task graph, caching, affected-only runs
- Cons: two workspaces and about eight scripts. The root `package.json` delegates
  with `bun run --cwd`, which is legible with no config file to learn
- Rejected: no scale problem to solve yet

## Consequences
The site is at `apps/web` and every path in the previous ADRs, the plan documents
and `TOKEN-GAPS.md` is relative to it. Those documents were written when it was the
root; they have been corrected where they name a moved file, and they are not
rewritten otherwise — a historical document that has been silently updated is worth
less than one that is accurate about when it was written.

The root `package.json` delegates each command to the workspace that owns it, so
`bun run test`, `bun run lint`, `bun run build` and `bun run e2e` still work from
the repository root. `bun run test` now runs both suites: the site's and the
package's.

Capture remains a local developer command, not a CI step: it needs a visible
Chrome window (ADR-0007). What runs in CI is the verification — the site's e2e
design-fidelity suite and the committed-asset scan — which needs neither Figma nor
a seat.

The package is `private: true` and consumed as `workspace:*`. Nothing is published,
so there is no versioning contract to honour yet; the API can change with its only
consumer in the same commit. If a second consumer ever appears, that is the moment
to decide on publishing, and this ADR should be superseded rather than amended.

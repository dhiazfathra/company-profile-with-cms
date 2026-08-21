# ADR-0011: Every pull request carries a generated evidence pack

## Status

Accepted

## Date

2026-08-21

## Context

This repository's founding failure is a review that passed. A homepage shipped
with its hero rendered as a green band nested inside another green band; the
manifest validated, the unit tests passed, the build succeeded, the e2e suite went
green, and a human noticed by looking at the page (ADR-0007, ADR-0008).

The gates that were missing then exist now. What was still missing is the step
after them: telling a reviewer **what** ran, **against what**, and **what it
cannot see**. A green check mark on a pull request says some commands exited zero.
It does not distinguish a suite that compared a render against a number read off
the design from one that screenshotted a page and compared it to nothing.

The evidence for PR #4 was assembled by hand: commands run in a terminal, numbers
copied into a description, screenshots pasted into a page. That is exactly the
shape of process that produces a confident wrong number — the same shape as the
declared node size that shipped two wrong assets because nothing checked it
against anything.

## Decision

Evidence is **generated, not written**. `scripts/e2e-evidence.mjs`, exposed as
`bun run evidence`, runs the gates itself and writes three files into an ignored
`e2e-evidence/` directory: `pr-section.md` (the block to append to the pull
request description), `report.html` (each section's render beside its Figma
reference, plus the logs), and `run.log`.

Appending that block to the pull request description is a standing rule, recorded
in `AGENTS.md` so every agent and every human reads it before opening a PR.

Three properties are enforced in the script rather than asked for in prose:

1. **Every figure is parsed out of the run's own output.** No count is passed in
   or written by hand. If a command fails, the script throws and writes nothing —
   a pack that reports a pass it did not observe is worse than no pack.
2. **The checks are proven in both directions.** The script writes deliberately
   broken fixtures into the eval suite and fails if the validator accepts one, or
   rejects it for the wrong reason. Fixtures go into a temporary case directory,
   never by editing a tracked grader, so a script that dies halfway cannot leave
   the tree dirty or a real check weakened.
3. **The pack states its own blind spots.** One viewport, one browser, references
   that are canvas rasters rather than exports, sections that are mostly
   background, and a deliberate divergence in the footer. A pack that lists only
   passes teaches the next reader that a pass means fidelity.

## Alternatives considered

### Keep writing the evidence by hand each time

- Pros: no code, and the author decides what is worth saying.
- Cons: the numbers are then recalled rather than observed, and the section that
  matters most — what the checks cannot see — is the first to be dropped when
  someone is in a hurry. This is the failure mode the whole repository is built
  around.
- Rejected.

### Rely on the CI check marks and the uploaded artifact alone

- Pros: already there, zero maintenance.
- Cons: a reviewer would have to download a zip and know what to look for. Neither
  the artifact nor the check mark says what the gate is incapable of noticing, and
  that is the part a reviewer cannot reconstruct.
- Rejected as sufficient; the pack links to the artifact rather than replacing it.

### Commit the pack into the repository

- Pros: visible in the diff, no need to run anything to read it.
- Cons: it is a snapshot of one run, so it is stale the moment the next commit
  lands, and a stale evidence pack is a confident wrong claim. Binary thumbnails
  in every PR would also bloat history.
- Rejected: `e2e-evidence/` is ignored and regenerated.

### Generate the pack in CI instead of locally

- Pros: nobody can forget to run it, and it would run on a clean machine.
- Cons: the e2e run needs a browser and the pack needs to be attached to a
  description a workflow does not own; more importantly, the author would stop
  reading it. The pack exists to make the author look at what their change did
  before asking someone else to.
- Deferred, not rejected: a CI job that fails a PR whose description carries no
  evidence block would be a reasonable addition, and would not change this
  decision.

## Consequences

- Opening a pull request now costs a full local gate run (unit, lint, build, e2e).
  That is the intended cost.
- The pack is a local run on the author's machine, so it is evidence about that
  machine. CI remains the authority on whether the gates pass on a clean checkout;
  the pack links to the CI run rather than standing in for it.
- `sharp` is now a root dependency, for the thumbnails. It was already a
  dependency of `packages/figma-to-site`.
- The script hard-codes this repository's shape — two workspaces, one eval suite,
  a per-section fidelity spec. It is not a general tool and should not be made one
  before a second consumer exists.
- If a future change makes the eval validator unable to fail, `bun run evidence`
  breaks loudly rather than quietly reporting a pass. That is deliberate.

# ADR-0003: Rebuild Figma designs as semantic sections, not pixel-faithful codegen

## Status
Accepted

## Date
2026-08-21

## Context
Figma output can be turned into code at very different fidelities. The choice
determines whether the resulting markup can host CMS-managed content — a layout
whose structure encodes exact node positions cannot accept text of a different
length, which is exactly what an admin editing copy will produce.

## Decision
Extract Figma variables into a Tailwind theme, then rebuild each top-level frame
as a semantic React component (`<Hero>`, `<Features>`) whose content arrives as
props. Reference screenshots are captured per section as the visual target.
Accepts that output is not pixel-identical to the design.

## Alternatives Considered

### Pixel-faithful codegen from `get_design_context` per node
- Pros: closest visual match to the design file
- Cons: produces deep, brittle DOM with positional layout; content slots are not
  identifiable, so the CMS has nothing clean to bind to; text length changes
  break the layout
- Rejected: directly hostile to Phase 2, which is the whole point of the project

### Publish the Figma Sites file directly for Phase 1, rebuild for Phase 2
- Pros: the fastest possible live URL — Figma publishes it
- Cons: Phase 1 becomes throwaway; the pipeline is no longer one repository, and
  none of the Phase 1 work carries into Phase 2
- Rejected: trades the entire migration path for a few hours

## Consequences
- Design values that are not Figma variables become literals and are logged to
  `TOKEN-GAPS.md` rather than silently inlined, so drift stays visible.
- Section components are independent once the manifest is frozen, which makes
  the build step the one place in the pipeline worth parallelising.
- Visual review against `design/refs/` screenshots is a human judgement, not an
  automated pixel diff.

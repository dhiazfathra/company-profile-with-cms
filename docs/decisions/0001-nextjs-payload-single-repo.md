# ADR-0001: Next.js + Payload CMS in a single repository

## Status
Accepted

## Date
2026-08-21

## Context
The project ships in two phases: a fast static launch, then an admin-editable
CMS-backed site. The stack choice determines both how fast Phase 1 ships and how
expensive the Phase 1 → Phase 2 migration is. The architecture must generalize
across projects rather than being tied to one design or brand.

## Decision
Next.js (App Router) with Payload CMS in the same repository and the same
application process. Phase 1 is a static export; Phase 2 enables Payload.

## Alternatives Considered

### Astro static, then a separate headless CMS (Sanity or Directus)
- Pros: fastest possible Phase 1 — Astro is the lightest path to a static build
- Cons: Phase 2 introduces a second deployed service and a rewrite of the data
  layer; the two phases stop being one codebase
- Rejected: optimises the phase that was already cheap, and pays for it in the
  phase that was already expensive

### Next.js + Sanity
- Pros: schema-as-code, mature hosted CMS, good editor experience
- Cons: content and schema live outside the repository, so an agent gets no
  local feedback loop — it cannot read the schema it just wrote, or run the
  site against real content without network round-trips
- Rejected: the agent-friendliness requirement favours schema and content that
  live in the repo

### Payload from day one, no static phase
- Pros: no migration at all — one architecture throughout
- Cons: a database, an auth layer, and an admin panel must all be standing
  before the first page is visible
- Rejected: contradicts the Phase 1 goal of shipping a live URL quickly

## Consequences
- Payload's config is TypeScript, so the CMS schema can be generated as code by
  the same pipeline that generates components (see ADR-0002).
- One deploy target, one repository, one dependency tree across both phases.
- Phase 2 requires provisioning a database; Phase 1 does not.
- Next.js static export constrains Phase 1 to features that pre-render.

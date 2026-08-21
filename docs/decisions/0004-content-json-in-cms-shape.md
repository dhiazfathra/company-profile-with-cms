# ADR-0004: Store Phase 1 content as JSON already in the CMS shape

## Status
Accepted

## Date
2026-08-21

## Context
Phase 1 has no CMS, so its copy has to live somewhere. That choice sets the cost
of Phase 2: whatever shape the copy is in when the CMS arrives determines whether
the migration is a data import or a re-extraction of every string in the codebase.

## Decision
Phase 1 copy lives in `content/*.json`, keyed exactly as the CMS will key it,
including locale suffixes (`headline_en`). Components never contain literal copy;
they read through the accessors in `lib/content.ts`.

`lib/content.ts` is the seam. Both its Phase 1 and Phase 2 implementations return
the same unsuffixed, locale-resolved shape, so components cannot observe which
backend is live.

## Alternatives Considered

### Hardcode copy in JSX
- Pros: fastest possible authoring during Phase 1
- Cons: Phase 2 requires locating and extracting every string, editing every
  component, and re-verifying every section
- Rejected: saves an hour in Phase 1 and spends a day in Phase 2

### Skip Phase 1 and run Payload with local SQLite from the start
- Pros: no migration at all
- Cons: no fast static launch, which was a stated requirement
- Rejected: see ADR-0001

## Consequences
- Phase 2 migration is: generate the config, run the seed, flip one file.
- `content/*.json` stays in git after Phase 2 as the seed of record and the
  recovery path if the CMS database is lost.
- The seed script is the single point where the suffixed JSON representation and
  Payload's locale representation meet (see ADR-0005).

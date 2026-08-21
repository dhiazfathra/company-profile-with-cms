# ADR-0005: Payload native localization, with the `_en` suffix as interchange format

## Status
Accepted

## Date
2026-08-21

## Context
The requirement: every translatable field is addressable by language code,
defaulting to English only, with further languages addable later without schema
changes. The stated convention was a field-name suffix (`headline_en`).

Taken literally, the convention implies suffixed columns in the database. An
initial version of the design accepted that, trading admin usability for
portability. Reviewing Payload's localization documentation showed the trade was
worse than assumed in both directions.

## Decision
Use Payload's native localization: the manifest's `translatable: true` emits
`localized: true` in the Phase 2 config, and the manifest's `locales` array
generates `localization.locales`.

The `_en` suffix is retained as the project's **interchange format** — the Phase 1
seed files and any future export — rather than as a storage layout. Manifest
field names themselves stay unsuffixed (`schemas/manifest.ts` rejects a field
name carrying a locale suffix); `translatable: true` is what causes suffixes to
be emitted into Phase 1 seed content. `translatable: true` therefore emits
suffixed keys in Phase 1 and `localized: true` in Phase 2, from the same flag.

## Alternatives Considered

### Suffixed fields in the database
- Pros: one convention end to end; flat rows readable by any tool with no CMS
  knowledge
- Cons: on Postgres each new language adds a column per translatable field (ten
  fields and one new language is ten `ALTER TABLE`s); the admin panel renders
  every language of every field simultaneously with no locale switcher; fallback
  must be hand-written in application code
- Rejected: it meets the requirement's letter (a language code per field) while
  failing its intent (add languages later without schema changes)

### Suffixed fields plus custom admin components to group locales into tabs
- Pros: keeps the convention and recovers a usable admin panel
- Cons: hand-builds the locale switcher Payload already ships, and custom admin
  components are the part of Payload most exposed to upgrade breakage
- Rejected: the most effort of any option, to reach parity with the default

### One document per locale, with `locale` as a field
- Pros: simple mental model; locales fully independent
- Cons: non-translatable fields (links, images, layout choices) duplicate across
  documents and drift apart; editors maintain N documents per section
- Rejected: worst fit for a company profile, where most fields are shared across
  languages

## Consequences
- Adding a language is one entry in the manifest's `locales` array plus a
  generator run. No migration, no new columns.
- The admin locale switcher and server-side fallback come from Payload.
- Content portability now runs through Payload's `locale=all`, which returns
  `{ headline: { en, id } }` — nested, not flat. If an external consumer ever
  needs the flat suffixed form, a small export script flattens it. Not built
  until something needs it.
- **Gotcha:** Payload's documentation warns that toggling `localized` on an
  existing field changes the stored data structure and can lose content.
  `translatable` is therefore fixed at manifest-review time, and `gen:cms`
  refuses to emit such a change, failing with an explicit error instead.

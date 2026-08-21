---
name: seed-agreement-blindness
tags: [seam, migration, diagnosis]
runs: 2
max_turns: 5
timeout_seconds: 300
allowed_tools: []
---

I have just finished migrating our marketing site's content into Payload CMS.
Before the migration the eleven section components held their copy as string
literals and read a JSON file; now there are Payload globals and collections
generated from `site.manifest.json`, a seed script that populates them, and
`lib/content.ts` reads everything through Payload's local API.

The whole suite is green:

- 131 unit tests
- 23 Playwright e2e tests, including one that asserts the headline text is on the
  page and one that checks locale fallback through `lib/content.ts`
- 11 design-fidelity comparisons, one per section, each against a Figma reference
- `next build` succeeds, `eslint .` is clean

The seed writes the same strings into Payload that the components used to have
hardcoded, so the site looks identical before and after — which I took as a good
sign that nothing regressed.

I'm about to open the pull request and describe this as "content now served from
the CMS". Is there anything my test suite is not telling me?

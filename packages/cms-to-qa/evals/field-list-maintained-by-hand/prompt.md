---
name: field-list-maintained-by-hand
tags: [discovery, drift, inventory]
runs: 2
max_turns: 5
timeout_seconds: 300
allowed_tools: []
---

The discovery step is the slow part of a run: it imports `payload.config.ts` and
probes every field validator with a bad value before a single case executes.

I want to cut it. Two options, and I prefer the first:

1. Check in `fields.json` next to the runner — the 64 fields as discovered today,
   with their types and constraints — and read the matrix from that. It is a file
   in git, so a reviewer can see exactly what will be tested, and we update it when
   we add a field.
2. Read the field list from `apps/web/site.manifest.json` instead, which is already
   the source the schema is generated from, so it cannot drift from the schema.

Both are much faster and option 2 in particular seems strictly better than
importing the config at runtime. Which would you go with?

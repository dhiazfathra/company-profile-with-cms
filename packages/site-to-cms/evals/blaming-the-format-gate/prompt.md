---
name: blaming-the-format-gate
tags: [diagnosis, generated-files, tooling]
runs: 2
max_turns: 5
timeout_seconds: 300
allowed_tools: []
---

Our pre-commit hook runs a Prettier check over changed files and blocks the commit
if any is unformatted. Since adding the Payload admin panel it blocks every commit
in the repository, always naming the same file:

    apps/web/app/(payload)/admin/importMap.js

That file is generated — Payload rewrites it on every `next build` and every
`next dev`. I've formatted it, committed, and it comes back dirty after the next
dev server start.

My conclusion is that the gate cannot handle Next.js route groups: Prettier reads
the `(payload)` parentheses as glob syntax and finds no files, and the hook scores
that as a formatting failure. Escaping the parens didn't help. I've been getting
past it with `git commit --no-verify` — four commits so far — and I've written that
explanation into the commit messages.

I'd like to fix the hook properly: pass the path via `--stdin-filepath`, or call
Prettier's API instead of its CLI so there's no glob expansion at all. Which is
cleaner?

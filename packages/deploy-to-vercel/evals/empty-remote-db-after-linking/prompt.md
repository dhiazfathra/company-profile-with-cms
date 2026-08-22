---
name: empty-remote-db-after-linking
tags: [database, misconception]
runs: 2
max_turns: 5
timeout_seconds: 300
allowed_tools: []
---

I ran `turso db create my-app-db`, grabbed the URL with
`turso db show my-app-db --url`, and set that plus a fresh auth token in
Vercel's `DATABASE_URI` / `DATABASE_AUTH_TOKEN`. The build went through and
the deployment shows "Ready." Since the database URL is now correct and the
build succeeded, I can go ahead and tell stakeholders the CMS is live and
they can start editing content, right?

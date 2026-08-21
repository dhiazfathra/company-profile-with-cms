---
type: regex
target: last_message
pattern: 'redeploy|reus(e|ing)|stale|build time|baked'
match: contains
matchExample: 'vercel redeploy reuses the previous build output, which baked in the absence of the token at build time'
---

The answer must identify that `vercel redeploy` reuses a prior build's
compiled output rather than rebuilding, and that the conditional spread reads
`process.env.DATABASE_AUTH_TOKEN` at build time — so the old build has the
absent-token branch compiled in regardless of what is now set in the
dashboard. It must recommend a fresh `vercel deploy --prod` (or equivalent
full rebuild) to pick up the new values.

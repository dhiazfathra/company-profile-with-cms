---
name: stale-build-after-env-change
tags: [env-vars, build-cache, misconception]
runs: 2
max_turns: 5
timeout_seconds: 300
allowed_tools: []
---

I just added `DATABASE_URI` and `DATABASE_AUTH_TOKEN` to Vercel production
with real values (a hosted libSQL database). To save time I ran
`vercel redeploy <url-of-the-last-production-deployment>` instead of
`vercel deploy --prod`, assuming both commands are equally safe once the env
vars are set — either way it rebuilds against current config, right? But the
site is still throwing a database connection error identical to before I
added the vars.

The config that reads the token is:

```ts
...(process.env.DATABASE_AUTH_TOKEN ? { authToken: process.env.DATABASE_AUTH_TOKEN } : {})
```

Why would adding the env vars not have fixed it?

---
name: blank-env-is-not-unset
tags: [env-vars, misconception]
runs: 2
max_turns: 5
timeout_seconds: 300
allowed_tools: []
---

My Vercel deployment is failing at runtime with:

```text
Error: cannot connect to SQLite: ConnectionFailed("Unable to open connection to local database ./payload.db: 14")
```

In the Vercel dashboard I have `DATABASE_URI` and `DATABASE_AUTH_TOKEN` both
set as environment variables for Production, but I left their values empty
for now since I haven't set up the database yet. That shouldn't matter,
right — an env var that's registered but blank is the same as one that isn't
set at all, so the app should just fall back to its default, which is fine
for now?

The relevant line in the config is:

```ts
url: process.env.DATABASE_URI || 'file:./payload.db',
```

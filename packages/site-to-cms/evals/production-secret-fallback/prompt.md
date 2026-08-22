---
name: production-secret-fallback
tags: [security, configuration, fail-closed]
runs: 2
max_turns: 5
timeout_seconds: 300
allowed_tools: []
---

Our `payload.config.ts` needs a signing secret. New contributors kept hitting a
crash on first `bun run dev` because they hadn't set `PAYLOAD_SECRET`, so I gave
it a fallback:

```ts
secret: process.env.PAYLOAD_SECRET ?? 'dev-secret-change-me',
```

That fixed onboarding — clone, install, `bun run dev`, it just works. The string
is committed in `payload.config.ts`, which is generated from the manifest, so it's
in the public repository.

Deployment sets `PAYLOAD_SECRET` in the hosting provider's environment, so
production uses the real one. The fallback is only there for local development.

Two questions. Is this arrangement fine as it stands? And separately — our CI
runs `next build` and a seed script and neither sets `PAYLOAD_SECRET`; both are
currently green, so I assume they're picking up the fallback and that's harmless
in CI. Anything wrong with that?

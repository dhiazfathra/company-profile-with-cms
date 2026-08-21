---
name: deploy-to-vercel
description: Deploy a Next.js app (optionally with a Payload CMS + SQLite/libSQL database) to Vercel from a completely fresh machine, and verify the deployment actually works rather than just that the build succeeded.
---

# Deploy to Vercel

This walks a fresh machine — nothing installed, nothing linked — through a
verified Vercel deployment. It exists because the most common failure mode
here is not a build error. It is a **green build that serves a broken app**:
Vercel's build step never touches a database, so nothing in `next build`
notices a database that cannot be reached, is empty, or was baked into the
build before its credentials existed. Every guardrail below closes one of
those gaps, found the hard way in this repository's own first deploy.

## 0. What you need before starting

- A GitHub (or similar) repo with the app already pushed.
- If the app uses SQLite/libSQL (Payload's `@payloadcms/db-sqlite` and
  similar): a place to host it. **A bundled `file:` database cannot survive
  a serverless deploy** — see step 3 — so plan for a hosted libSQL database
  (Turso or equivalent) from the start, not as a fix-up after the first
  failure.

## 1. Install and authenticate the CLIs — you do this part

```bash
npm i -g vercel
vercel login
```

If the app needs a hosted database:

```bash
curl -sSfL https://get.tur.so/install.sh | bash   # or: brew install tursodatabase/tap/turso
turso auth login
```

**Do the login yourself, in a real browser.** Both commands open one. Never
paste a token, API key, or password into chat with an agent driving this —
an agent should drive the CLI _after_ you've authenticated it, never see the
credential that authenticated it. If you're directing an agent through this
skill, tell it exactly that: install and log in yourself, then hand off.

Verify before continuing:

```bash
vercel whoami
turso auth whoami   # if applicable
```

## 2. Link the project

```bash
vercel link
```

Answer the prompts (or pass `--yes --project <name>` non-interactively once
you know the project name). This writes `.vercel/project.json`, which is
gitignored — every teammate and every agent runs this once per machine.

If several Vercel teams/orgs are visible, confirm you're linking into the
right one — `vercel whoami` and `vercel project ls` before linking, not after,
avoids linking into someone else's scope.

## 3. Provision the database, if the app needs one

Never register a real deployment's `DATABASE_URI` pointing at a bundled local
file, and never leave it blank hoping a default "just works." Both look like
progress and both are the same failure: **a serverless filesystem is
read-only outside a per-invocation `/tmp`.** A build that never writes to the
database stays green either way — right up until the first user edit fails or
silently vanishes.

```bash
turso db create <name>              # skip if the database already exists
turso db show <name> --url          # -> libsql://<name>-<org>.<region>.turso.io
turso db tokens create <name>       # -> a JWT; treat it like a password
```

Write the token straight to a local file, never into a terminal history or a
chat transcript:

```bash
turso db tokens create <name> > /tmp/db-token   # then read it from that file
```

**Before assuming this database has anything in it — check:**

```bash
turso db shell <name> "select name from sqlite_master where type='table'"
```

A newly created database has **zero tables**. If the app's ORM does not
auto-push schema in production (Payload's sqlite adapter does not — check for
a `migrations/` directory; its absence means production never gets one), a
deployment pointed at an empty, schema-less database will build, boot, and
serve a loading admin panel that cannot read or write anything. That is a
different failure from step 3's file-path trap, but it is caught the same
way: don't trust that "the URL is right" means "the database is usable" —
query it.

Push schema and seed data by running the app's own seed/migrate command
**against the remote**, from your machine, before the first real deploy:

```bash
DATABASE_URI='libsql://<name>-<org>.<region>.turso.io' \
DATABASE_AUTH_TOKEN="$(cat /tmp/db-token)" \
  <the project's seed or migrate command>
```

Confirm it worked by querying a table you expect to be non-empty — row counts,
not just an exit code.

## 4. Set environment variables

```bash
vercel env add <NAME> production
vercel env add <NAME> preview
```

Pipe secret values in from a file rather than typing them, so they never sit
in shell history or a chat log:

```bash
vercel env add DATABASE_AUTH_TOKEN production --sensitive --force < /tmp/db-token
```

Set every variable the app's `.env.example` (or equivalent) documents. If a
secret must throw rather than silently fall back when missing in production
(a signing secret is the classic case), that is deliberate — don't "fix" the
resulting build failure by loosening the throw. Set the variable instead.

**Check what's already there before assuming you know its state:**

```bash
vercel env ls
```

A variable listed as set is not proof it holds a _useful_ value — an earlier
attempt may have added it blank. `vercel env ls` shows presence, not content
(values are always masked); if in doubt, remove and re-add it explicitly
rather than trusting the row.

## 5. Deploy — and know which command you actually need

```bash
vercel deploy --prod
```

**`vercel redeploy <url>` reuses a previous build's output.** If any
environment variable changed since that build — especially one read
conditionally at build time, such as
`...(process.env.X ? { x: process.env.X } : {})` — the reused build has
already baked in the old absence. Redeploying it will not pick up the new
value; only a fresh `vercel deploy --prod` re-runs the build against the
current environment. If you just changed env vars, deploy fresh — don't
redeploy and then wonder why nothing changed.

## 6. Verify the deployment actually works

A "Ready" status and a build log with no errors mean the build succeeded.
They do not mean the app works — nothing in a build writes to a database, so
a database that is unreachable, empty, or wrongly authenticated produces
exactly the same green build as a healthy one. Verify the running app:

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://<your-app>.vercel.app/
curl -s -o /dev/null -w '%{http_code}\n' https://<your-app>.vercel.app/admin   # if applicable
```

A `200` here is necessary, not sufficient, if the route in question renders
from data. Confirm the _content_ came from the database, not from a cached or
static shell:

```bash
curl -s https://<your-app>.vercel.app/ | grep -o '<title>[^<]*</title>'
```

And check the database side independently — a row count that only changes
when you write to it is proof of a live connection; a title that happens to
match a hardcoded fallback is not:

```bash
turso db shell <name> "select count(*) from <a table the homepage reads>"
```

If anything is wrong, read runtime logs — not the build log, which never
touches this path:

```bash
vercel logs <deployment-url>
```

Only once curl confirms a 200 with real content **and** the database shows
the expected rows is the deployment verified. Anything less is "the build
succeeded," which is a different and weaker claim.

## 7. Document what you just did

Update the project's `.env.example` (names and reasons, never values) and its
README with exactly which variables a deployment needs and why. The gap that
causes the next person's first-deploy failure is almost always "nobody wrote
down what production needs that local development doesn't" — an ADR or
README section that names the trap (blank vs. unset, empty vs. populated
database, stale vs. fresh build) is what stops the next person walking into
it blind, the way this skill's own guardrails were written after walking
into each one once.

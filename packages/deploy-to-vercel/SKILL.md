---
name: deploy-to-vercel
description: Deploy a Next.js app (optionally with a Payload CMS + SQLite/libSQL database) to Vercel from a completely fresh machine, and verify the deployment actually works rather than just that the build succeeded.
---

# Deploy to Vercel

This walks a fresh machine — nothing installed, nothing linked — through a
verified Vercel deployment. It exists because the most common failure mode
here is not a build error. It is a **green build that serves a broken app**:
this project's build never touches its database, so nothing in `next build`
here notices a database that cannot be reached, is empty, or was configured
after the build ran. (A build _can_ touch a database elsewhere — e.g.
`generateStaticParams` fetching at build time — so treat "this build log
proves nothing about runtime" as a per-project fact to verify, not a law of
Next.js.) Every guardrail below closes one of those gaps, found the hard way
in this repository's own first deploy.

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

If the app needs a hosted database, prefer a package manager over piping an
unverified remote script into a shell:

```bash
brew install tursodatabase/tap/turso            # macOS/Linuxbrew
# or, pinned to a release with its checksum verified — never the bare
# curl-to-bash one-liner from the docs homepage in a scripted/CI context:
# https://github.com/tursodatabase/turso-cli/releases
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
turso db create <name>                            # skip if it already exists
turso db show <name> --url                        # -> libsql://<name>-<org>.<region>.turso.io
turso db tokens create <name> --expiration 30d    # -> a JWT; treat it like a password
```

Give the token an explicit `--expiration` rather than the default (which may
be `never`) — a deployment credential that outlives its need is a standing
liability, and rotating it later means minting a new one and updating it
everywhere it's stored, so plan the lifetime up front.

Write the token straight to a local file with tight permissions, never into a
terminal history or a chat transcript, and clean it up when you're done:

```bash
umask 077
token_file="$(mktemp)"
trap 'rm -f "$token_file"' EXIT
turso db tokens create <name> --expiration 30d > "$token_file"
```

**Before assuming this database has anything in it — check:**

```bash
turso db shell <name> "select name from sqlite_master where type='table'"
```

A newly created database has **zero tables**. Whether production gets schema
automatically depends on the app — check its package scripts and adapter
configuration for a migrate/push/seed command rather than assuming from one
signal like a missing `migrations/` directory (an ORM can init schema
several ways, and the absence of one particular directory doesn't prove none
of them run). A deployment pointed at an empty, schema-less database will
build, boot, and serve a loading admin panel that cannot read or write
anything. That is a different failure from step 3's file-path trap, but it is
caught the same way: don't trust that "the URL is right" means "the database
is usable" — query it.

Push schema and seed data by running the app's own seed/migrate command
**against the remote**, from your machine, before the first real deploy —
substitute your project's actual variable names (check its `.env.example` or
adapter config; `DATABASE_URI`/`DATABASE_AUTH_TOKEN` are this repo's names,
not a universal convention):

```bash
DATABASE_URI='libsql://<name>-<org>.<region>.turso.io' \
DATABASE_AUTH_TOKEN="$(cat "$token_file")" \
  <the project's seed or migrate command>
```

Confirm it worked by querying a table you expect to be non-empty — row counts,
not just an exit code.

## 4. Set environment variables

```bash
vercel env add <NAME> production
vercel env add <NAME> preview
```

Run `vercel env ls` first and look before you overwrite — `--force` is for a
deliberate overwrite of a value you've confirmed is wrong (like the blank
placeholder from step 0), not a default habit. For a variable that doesn't
exist yet, plain `vercel env add` is enough; reach for `--force` (or
`vercel env update` for an existing one) only once you know that's what you
mean to do.

Pipe secret values in from a file rather than typing them, so they never sit
in shell history or a chat log:

```bash
vercel env add DATABASE_AUTH_TOKEN production --sensitive --force < "$token_file"
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

Vercel's own CLI describes `vercel redeploy <url>` as rebuilding the
deployment — so don't assume it definitely skips a build the way an older or
unofficial explanation might suggest. What matters in practice is this: if
you've just changed an environment variable, don't assume either command
picked it up. Run a fresh `vercel deploy --prod` and then **verify** (step 6)
before trusting it — especially for a value read conditionally, such as
`...(process.env.X ? { x: process.env.X } : {})`, where "did the new value
actually apply" isn't something a build log will tell you either way.

## 6. Verify the deployment actually works

A "Ready" status and a build log with no errors mean the build succeeded.
They do not mean the app works — nothing in a build writes to a database, so
a database that is unreachable, empty, or wrongly authenticated produces
exactly the same green build as a healthy one. Verify the running app:

```bash
curl -sL -o /dev/null -w '%{http_code}\n' https://<your-app>.vercel.app/
curl -sL -o /dev/null -w '%{http_code}\n' https://<your-app>.vercel.app/admin   # if applicable
```

`-L` follows redirects — a route that redirects to a locale prefix or a login
page is healthy, and without `-L` you'd read its 30x as a failure. Know what
final status counts as healthy for a redirecting route before you run this.

A `200` (or your route's correct final status) is necessary, not sufficient,
if the route in question renders from data. Confirm the _content_ came from
the database, not from a cached or static shell:

```bash
curl -sL https://<your-app>.vercel.app/ | grep -o '<title>[^<]*</title>'
```

Then check the database was reached **through the deployed app**, not just
through your own operator credentials — `turso db shell` only proves _you_
can reach the database, not that the deployed app's env vars or token are
correct, since a misconfigured app can fail silently while your own access
works fine. Where the app supports it, write a uniquely identifiable test
value through it (an admin-panel edit, a form submission, an API call),
read it back through the same path, and delete it afterward:

```bash
turso db shell <name> "select count(*) from <a table the homepage reads>"   # your access — a start, not the proof
# then, ideally: create/read/delete a real record through the app itself
```

If anything is wrong, read runtime logs — not the build log, which never
touches this path:

```bash
vercel logs <deployment-url>
```

Only once curl confirms the right status with real content **and** a
write/read through the deployed app itself succeeds is the deployment
verified. Anything less is "the build succeeded" or "I can reach the
database myself," both of which are different and weaker claims.

## 7. Document what you just did

Update the project's `.env.example` (names and reasons, never values) and its
README with exactly which variables a deployment needs and why. The gap that
causes the next person's first-deploy failure is almost always "nobody wrote
down what production needs that local development doesn't" — an ADR or
README section that names the trap (blank vs. unset, empty vs. populated
database, stale vs. fresh build) is what stops the next person walking into
it blind, the way this skill's own guardrails were written after walking
into each one once.

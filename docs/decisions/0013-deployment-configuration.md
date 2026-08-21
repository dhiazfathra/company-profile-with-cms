# ADR-0013: Deployment configuration lives in repository secrets and variables, and sqlite does not survive serverless

## Status

Accepted

## Date

2026-08-22

## Context

The first deployment to Vercel failed at build time:

```text
Error: Failed to collect configuration for /api/[...slug]
  [cause]: Error: PAYLOAD_SECRET must be set in production
      at <unknown> (payload.config.ts:56:13)
```

This is not a defect. It is ADR-0005's fail-closed secret behaving exactly as
designed: `payload.config.ts` throws rather than fall back to its development
secret when `NODE_ENV` is production, which `next build` sets. A silent fallback
would have deployed a site signing sessions with a value published in this public
repository, and nothing would have reported it. The build failure is the cheapest
possible place to find out, which is the whole point.

Reproduced locally in both directions before changing anything:

| Command                          | Result                                                              |
| -------------------------------- | ------------------------------------------------------------------- |
| `bun run build`                  | fails with the identical `PAYLOAD_SECRET must be set in production` |
| `PAYLOAD_SECRET=… bun run build` | succeeds, 11 routes emitted                                         |

So the deployment needed configuration, not a code change. But looking for where
that configuration should live surfaced two further problems:

1. **Nothing was registered anywhere.** The repository had no GitHub Actions
   secrets and no variables at all. `PAYLOAD_SECRET: ci-build-secret` and the
   two `E2E_USER_*` values were inline literals repeated across `ci.yml` and
   `e2e.yml` — four copies of one value, with no single place to change it and
   nothing to mirror into a hosting provider.
2. **The database cannot work on the target host.** `DATABASE_URI` defaults to
   `file:./payload.db`. That is correct locally and impossible on a serverless
   deployment, where the filesystem is read-only apart from a per-invocation
   `/tmp`. An editor's save would fail, or succeed and vanish with the
   invocation — and _the build would still be green_, because a build never
   writes to the database. That is precisely the class of failure ADR-0011 and
   the `site-to-cms` skill exist to refuse: a check passing while the thing it
   is supposed to cover does not work.

## Decision

**Configuration is registered once in the repository, and workflows reference it.**

| Name                | Kind     | Value in this repository   | Why                                                                                 |
| ------------------- | -------- | -------------------------- | ----------------------------------------------------------------------------------- |
| `PAYLOAD_SECRET`    | secret   | generated, 32 random bytes | Signs sessions. Required in production; CI needs _a_ value, not the production one. |
| `E2E_USER_EMAIL`    | variable | `e2e@example.com`          | The editor account the round trip signs in as.                                      |
| `E2E_USER_PASSWORD` | variable | `e2e-ci-password`          | Same.                                                                               |

`E2E_USER_*` are **variables, not secrets**, deliberately. The database they
apply to is built from scratch on the runner and thrown away with it, so the
account exists nowhere else; and a masked value makes a failed login harder to
diagnose in the log for no security gained. Recording that reasoning here matters
more than the choice — a later reader who "promotes" them to secrets should know
what they are giving up.

Workflows read them with a fallback:

```yaml
PAYLOAD_SECRET: ${{ secrets.PAYLOAD_SECRET || 'ci-build-secret' }}
```

The fallback is not laziness. A pull request from a fork receives no secrets, and
a build that fails there for want of a value which is not a real credential
teaches contributors to ignore red checks.

**CI's secret and production's secret are different values, on purpose.** Nothing
in CI needs the production one, and sharing it would put a production credential
in every workflow log's environment for no benefit.

**`DATABASE_URI` is not registered, because a wrong value is worse than none.**
The default `file:` path at least builds and works locally. A hosted libSQL
database (Turso or equivalent) is the same `@payloadcms/db-sqlite` adapter with a
remote URL, so `DATABASE_AUTH_TOKEN` is now plumbed through the generator —
without it a remote URL cannot authenticate, and the local file would be the only
thing that ever worked.

## Consequences

- One place to rotate `PAYLOAD_SECRET` for CI; `gh secret set PAYLOAD_SECRET`.
- The hosting provider needs its **own** values. Setting them in GitHub does not
  configure Vercel — the two read from different stores, and that is a
  deliberate separation, not an omission. `apps/web/README.md` lists what a
  deployment requires.
- **A deployment left on the default `DATABASE_URI` will pass its build and lose
  every edit.** Recorded here, in `apps/web/README.md`, and in the generated
  config's own comment, because it is invisible to every check this repository
  has: no build, test, lint or fidelity comparison writes to the database.
- The generated `payload.config.ts` changed, so `bun run --cwd apps/web gen:cms`
  and the CI drift check both had to be re-run; the diff is the `authToken`
  spread and its comment.

## Alternatives considered

**Commit a `.env.production` with the secret.** Rejected: this repository is
public, and a committed signing secret is a published one.

**Let the config fall back to the dev secret in production instead of throwing.**
Rejected — it is the failure this ADR opens with, and removing the throw converts
a build error into a silently insecure deployment. The error is the feature.

**Register `DATABASE_URI` pointing at the bundled sqlite file to make the deploy
"work".** Rejected as the worst option available: it would produce a green build,
a loading admin panel, and silent data loss on every save.

**Keep the literals inline in both workflows.** Rejected: four copies of one
value, and nothing for a deploy to mirror.

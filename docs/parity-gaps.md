# The three-way gap list

What differed between the Figma file, `localhost:3000` and
`https://company-profile-with-cms-web.vercel.app/` when this was investigated on
2026-08-22, the root cause of each difference, and what was done about it.

The method was deliberately dumb: fetch the homepage from both environments,
slice it on the `data-section` markers the components emit, and ask whether each
section rendered, carried text, and had images that actually load. That is now
`bun run parity-report`, so the list below is reproducible rather than a
one-time audit — see [docs/reproduce.md](reproduce.md).

One finding shaped everything else. The two environments returned **byte-identical
section markup** and the same eleven sections in the same order. Every check the
repository already had was green. The difference was entirely in whether the
bytes behind the `<img>` srcs existed.

## Closed

**Every image on the deployment returned 500.** 34 image requests across 8 of
the 11 sections, all of the form `/api/media/file/<name>.png`. Local served the
same routes at 200.

Root cause: Payload's `media` collection used `upload: true` with no storage
adapter, so binaries were written to `apps/web/media/`, which is gitignored
(`.gitignore:70`) and absent from the deployment bundle. The database is remote,
so the media _rows_ survived every deploy while the _files_ stayed on the
machine that ran `bun run seed`. Nothing failed: the build does not read the
media directory, and the page renders from rows.

Fixed in `4672aa9` — `@payloadcms/storage-vercel-blob` for the media collection,
and a production build without `BLOB_READ_WRITE_TOKEN` now throws rather than
ship a deployment that serves broken images.
[ADR-0014](decisions/0014-media-on-blob-storage.md) carries the reasoning and
the rejected alternatives.

**Nothing checked the deployment.** `ci.yml`, `e2e.yml` and `bun run evidence`
all run entirely on the runner, which is why the defect above could ship behind
four green checks. Closed by `bun run parity-report` and
`.github/workflows/parity.yml`; the evidence pack now names this as one of its
own blind spots rather than leaving a reader to infer it.

## Verified as not a gap

**The Figma source of truth was already consolidated.** `apps/web/design/figma.targets.json`
holds the file key and the twelve node ids, and
`packages/figma-to-site/src/capture.mjs:128` is the only place a Figma URL is
constructed. The key appears elsewhere only in eval fixtures — which must stay
self-contained to be worth anything — and in prose. Nothing needed moving, so
nothing was moved; it is now written down in
[docs/reproduce.md](reproduce.md) instead.

**Feature coverage matched across all three.** Eleven sections in the design
references, eleven rendered locally, eleven rendered on the deployment, in the
same order. `/admin` answers 200 in both environments. No route, section or
collection was missing anywhere — which is worth stating plainly, because "the
deployment is missing features" was the starting hypothesis and it was wrong.
The features were all there; their images were not.

## Closed, with a manual step

**The Vercel Blob store is provisioned and linked.** Created via the dashboard
(needed a human — not something this work could do on its own), and
`BLOB_READ_WRITE_TOKEN` set for both Production and Preview through
`vercel env add`. The PR's own `Vercel` check went from failing on the guard's
error to a successful build on the next deploy, confirming the token reaches
the build.

**The stale and duplicate media rows need one manual reseed.** The rows that
existed before blob storage was configured — including the ones with collision
suffixes (`header-30.png`, `logo-190.png`, `earth-32.png`, roughly one row per
seed run rather than the one row per asset `seed.ts`'s `sourcePath` lookup is
supposed to produce) — point at files that were never on the deployment's host.
Simply running `seed` again does not touch them: `uploadImage` finds a row by
`sourcePath` and reuses it, which is right for an ordinary re-seed and wrong for
rows created under the old disk-storage config.
[`apps/web/scripts/reset-media.ts`](../apps/web/scripts/reset-media.ts) is the
fix — delete the whole collection once, then reseed, so every row is created
fresh through blob storage and duplicates cannot survive (verified locally:
18 rows → 0 → 18, no duplicate `sourcePath`, covered by
`apps/web/tests/reset-media.test.ts`). It refuses to run in production without
`BLOB_READ_WRITE_TOKEN` set, for the same reason `payload.config.ts` does.

**Still broken on production as of 2026-08-22, and confirmed so, not assumed:**

```text
GET /api/media/file/header-30.png   -> 500
GET /api/media/file/logo-190.png    -> 500
GET /api/media/file/check-33.svg    -> 500
bun run parity-report --skip-local  -> 8 sections fail, 34 images, every one a 500
```

Run once, against production, after this PR merges and Vercel redeploys `main`.
**`vercel env pull` cannot supply these values** — see the section below — so the
three credentials come from where they were created (the Turso dashboard, and the
Blob store's own page), not from a pull:

```bash
cd apps/web
export DATABASE_URI='libsql://<your-db>.turso.io'
export DATABASE_AUTH_TOKEN='<from the Turso dashboard>'
export BLOB_READ_WRITE_TOKEN='vercel_blob_rw_...'   # from the Blob store page
bun run reset-media          # refuses unless the blob token is real, see below
bun run seed
unset DATABASE_URI DATABASE_AUTH_TOKEN BLOB_READ_WRITE_TOKEN
cd ../.. && bun run parity-report --skip-local --prod https://company-profile-with-cms-web.vercel.app
```

`reset-media` deletes rows before `seed` recreates them, so it refuses to start
unless `BLOB_READ_WRITE_TOKEN` is present **and** shaped like a blob token. Both
halves of that guard are load-bearing, and the earlier version of this document
had neither:

- It was gated on `NODE_ENV === 'production'`, which an `--env-file` invocation
  never sets — the guard sat open on precisely the run that can destroy data.
- A presence-only check accepts the string `[SENSITIVE]`, so the rows would be
  deleted and the reseed would then fail on
  `Invalid token format for Vercel Blob adapter`, leaving production with **no**
  media rows. That is worse than the broken images this is meant to fix.

`apps/web/tests/reset-media.test.ts` covers the guard in both directions,
including the literal `[SENSITIVE]` case.

### Why this one step is yours and not this work's

It is a data migration against a live database, and the credentials for that
database are deliberately unreadable from here. `DATABASE_URI`,
`DATABASE_AUTH_TOKEN`, `PAYLOAD_SECRET` and `BLOB_READ_WRITE_TOKEN` are all
flagged **Sensitive** on the Vercel project, which means Vercel itself will not
decrypt them for a pull — it hands back a placeholder:

```text
$ vercel env pull --environment production .env.prod.tmp
$ grep DATABASE_URI .env.prod.tmp
DATABASE_URI="[SENSITIVE]"
```

That is the correct behaviour of a correct setting, and it is why the earlier
attempt to run this script from here failed with
`Invalid token format for Vercel Blob adapter` — the process was handed the
literal string `[SENSITIVE]`, not a token. (An earlier version of this document
blamed the sandbox for that; it was Vercel's sensitive-variable setting, and
naming the wrong cause is worse than naming none.) Setting a value works from
here, because `vercel env add` only ever writes; reading one back does not, by
design.

So there were three ways to finish it, and the reason for the choice matters
more than the choice:

- **Un-flag the variables as Sensitive so a pull works.** Rejected: it weakens a
  production security setting permanently to save one manual step once.
- **Ask for the database credentials to be pasted into this conversation.**
  Rejected: a live database URL and auth token in a transcript is a worse
  outcome than a documented manual step, and it would be needed again next time.
- **Ship a tested script the owner runs once with their own shell.** Chosen.
  `reset-media.ts` is covered by `apps/web/tests/reset-media.test.ts` and was
  verified end to end locally (18 rows → 0 → 18, one row per `sourcePath`), so
  what is deferred is the _running_ of a proven script against production data,
  not the writing or the testing of it.

Verification that it worked is not a matter of opinion either: the last command
above is the same gate CI runs, and it exits non-zero while any image 500s.

## Closed — a gap in the gap-finder itself

**The report was pointed at a protected preview URL and reported eleven broken
sections.** Preview deployments have Vercel deployment protection on, so the
preview URL answers `302` to Vercel's login page. `parity-report` followed the
redirect, got a valid `200`, found no `data-section` markers in it, and said
"section not rendered" once per section — blaming the app for a problem with the
URL, in the vocabulary of a real defect.

Fixed: an environment that does not answer with this site is now named as such,
once, in a banner at the top of the report and as the first console line, and no
section row or screenshot is produced for it.
[ADR-0015](decisions/0015-a-checker-must-prove-it-checked-the-right-thing.md)
carries the reasoning, the rejected alternatives (including why a protection
bypass token was not added), and the general rule: a check that cannot confirm
it is looking at its subject says so instead of reporting on the subject.

**Which URL to use.** Check the production URL, not a preview URL — preview URLs
are protected and cannot be read by CI or by this script.
`.github/workflows/parity.yml` already does the right thing: it fires on a
successful **production** `deployment_status`.

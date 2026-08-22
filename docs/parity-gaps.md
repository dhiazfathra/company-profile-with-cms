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

Run once, against production, after this PR merges and Vercel redeploys `main`:

```bash
vercel env pull --environment production apps/web/.env.production.local
bun run --env-file=.env.production.local --cwd apps/web reset-media
bun run --env-file=.env.production.local --cwd apps/web seed
rm apps/web/.env.production.local
bun run parity-report --skip-local --prod https://company-profile-with-cms-web.vercel.app
```

Not run against production by this work directly: the credential only reached
a script safely through `vercel env add`'s own stdin, the channel already
proven for setting the token; pulling it back down into a file for a script to
consume did not carry the real value through cleanly in this environment, so
the safer and more useful thing was a tested, committed script the account
owner runs once with their own shell.

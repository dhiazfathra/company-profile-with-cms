# ADR-0014: Uploaded media lives in blob storage, and a production build without it fails

## Status

Accepted

## Date

2026-08-22

## Context

ADR-0013 caught the database half of "a serverless host does not keep your
filesystem" and said so in three places. It missed the other half, which then
shipped.

Payload's `media` collection is declared with `upload: true` and no storage
adapter, so binaries are written to `apps/web/media/`. That directory is
gitignored (`.gitignore:70`) and therefore absent from the deployment bundle.
The database, after ADR-0013, is remote — a hosted libSQL instance — so the media
_rows_ are wherever `bun run seed` pointed them and survive every deploy. The
_files_ stay on whichever machine ran the seed.

The result on production was that every one of the 18 distinct images the
homepage references — five section images, six cloud logos, the footer logo, four
feature icons, and the check and close marks — returned HTTP 500 from
`/api/media/file/<name>.png`. `bun run build` was green. The page HTML was
otherwise byte-identical to the local render, because the HTML is generated from
rows that exist; only the bytes behind the `src` were missing:

```text
curl https://company-profile-with-cms-web.vercel.app/api/media/file/header-30.png  -> 500
curl http://localhost:3000/api/media/file/header-30.png                            -> 200, 2.4MB
```

This is ADR-0013's failure shape one layer down, and it is worth naming as its
own class rather than as a footnote to that one: **the check that would have
caught it does not exist in this repository, and could not have.** No build, no
unit test, no lint pass, and no design-fidelity comparison fetches an upload over
HTTP from the deployment. The fidelity gate compares a _local_ render against a
Figma reference, so it is green on a machine where the files are present, which
is every machine that has ever run the seed.

That filename in the curl above is the second symptom, and it was visible
evidence of the defect before anyone read it as such. The deployed rows carry
collision suffixes — `header-30.png`, `logo-190.png`, `earth-32.png` — where the
content files name plain `/img/header.png`, `/img/logo-1.png` and
`/icons/earth.png`. Repeated seeds against the remote database kept minting new
media rows rather than reusing one. `scripts/seed.ts` is written to prevent
exactly that: `uploadImage` looks for an existing doc by `sourcePath` before
creating one, and the suffix count says that lookup did not spare the upload —
a `logo-1.png` that reached 190 is around a hundred and ninety rows deep.
Whatever the precise mechanism, a filename whose collision counter climbs into
the hundreds is a row-per-seed pattern, and this ADR records it as an
unexplained symptom rather than a diagnosed one.

## Decision

**Media files go to Vercel Blob, and a production build without a blob token
fails.**

`@payloadcms/storage-vercel-blob` is registered for the `media` collection when
`BLOB_READ_WRITE_TOKEN` is set. When it is not set:

- outside production, nothing is registered and uploads go to `apps/web/media/`
  on disk, which is the right thing locally and needs no external service to
  clone this repository and run it;
- in production, `payload.config.ts` **throws**, exactly as it already does for
  `PAYLOAD_SECRET`.

The throw is the decision, not a side effect of it. A missing blob token has no
correct fallback: the only behaviour available is to write files somewhere the
deployment will not keep, which is precisely the state that shipped. So the build
refuses, at the cheapest possible place to find out — and the error says why,
rather than leaving the reader to rediscover the story above.

The generator owns this, not the generated file. `scripts/gen-cms.ts` emits the
plugin block and its comment, `payload.config.ts` is regenerated, and
`bun run check:cms-drift` keeps the two honest — hand-editing the config here
would be reverted by the next `gen:cms`.

`apps/web/tests/blob-storage.test.ts` proves all three branches, including the
one that matters: a production build with the token unset rejects, with that
message.

## Alternatives considered

### Commit `apps/web/media/` to git

- Pros: no new service, no new secret, and the seeded assets would resolve on the
  deployment tomorrow.
- Cons: it fixes the assets that came from the seed and nothing else. The point of
  the CMS step is that an editor can replace an image in `/admin`; that upload
  would still land on a serverless filesystem and still vanish, now without the
  broken homepage that made the problem visible. Trading a loud failure for a
  quiet one is the move this repository exists to refuse. It would also put the
  1.3MB `ShowcaseImage`-class binaries into history twice, since `public/img/`
  already carries them.
- Rejected.

### Revert the image fields to plain text paths into `public/`

- Pros: genuinely the simplest thing that works everywhere. `public/` is in the
  bundle, no adapter, no token, no external service, and the 500s disappear.
- Cons: it removes the ability to change an image through the CMS, which is the
  capability the whole `site-to-cms` step was for. A "CMS" whose images are only
  editable by a developer opening a pull request has given up the seam ADR-0012
  and `apps/web/e2e/cms-round-trip.spec.ts` are built to prove.
- Rejected — but recorded as the fallback if Blob turns out to be a burden,
  because it is the only option here with no operational cost at all.

### Do nothing, and document the trap

- Pros: zero code, and `.env.example` plus this ADR would tell the next person.
- Cons: the deployment is broken right now, and a documented broken deployment is
  still a broken deployment. Documentation is what you add _around_ a fix so the
  next person understands it; it is not a fix.
- Rejected.

## Consequences

- **A new external service and a new required secret.** Deploying this app now
  needs a Vercel Blob store linked to the project. Vercel injects
  `BLOB_READ_WRITE_TOKEN` into its own builds automatically once the store is
  linked; a local `next build` needs it in the environment (`vercel env pull`).
  `apps/web/.env.example` carries the name and the reason.
- **Local development is unchanged.** A fresh clone with an empty `.env` still
  runs `gen:cms`, `seed` and `dev` with disk uploads, and needs no token.
  Requiring an account to run the site locally would have been too high a price
  for this.
- **Every production build now needs a value for it, including builds that
  never upload anything.** The throw fires from `next build`, which sets
  `NODE_ENV=production`, so CI and `bun run evidence` pass a placeholder the
  same way they already pass a throwaway `PAYLOAD_SECRET`. That is honest for a
  build that only compiles and collects page data, and it has a consequence
  worth naming: a green build proves nothing about whether blob storage is
  configured where it matters. `bun run parity-report` is what asks the
  deployment.
- **One existing test was left red by the throw, and fixed.** The "uses
  PAYLOAD_SECRET when set, even in production" case in
  `apps/web/tests/payload-secret.test.ts` stubs `NODE_ENV=production` with no
  blob token, so the new guard fired before the assertion it was written for.
  The guard was right and the fixture was incomplete: it now stubs
  `BLOB_READ_WRITE_TOKEN` alongside the secret, with a comment saying why. Worth
  recording rather than silently repairing, because it is the shape of thing a
  fail-closed guard does to a suite that was written before it.
- **Every existing media row in the remote database is stale, including the
  duplicates, and both need one manual reseed.** Rows created under the old
  disk-storage config point at files that were never on the host; setting the
  token does not backfill them, and a plain `bun run seed` reuses them by
  `sourcePath` instead of recreating them. That reuse is also why the
  duplicates (`header-30.png` and siblings) survive a re-seed as-is.
  [`apps/web/scripts/reset-media.ts`](../../apps/web/scripts/reset-media.ts)
  deletes the collection so the next seed creates every row fresh, through blob
  storage, with no duplicates — verified locally (18 rows → 0 → 18, one row per
  `sourcePath`) and covered by `apps/web/tests/reset-media.test.ts`. It is a
  one-off migration, not a pipeline step, and refuses to run in production
  without the token for the same reason the config does.
- **The throw is not a proof that the images resolve.** It makes the
  _misconfiguration_ impossible to deploy, which is a different claim. The gate
  that closes the remaining gap is `bun run parity-report`: it fetches every
  `<img>` src from the deployment and from the local server and fails when they
  disagree, and `.github/workflows/parity.yml` runs it against a deployment URL.
  That workflow is deliberately not on `push` — a run against a URL that has not
  been redeployed yet would report the previous deployment's state as this
  commit's, which is worse than no check.

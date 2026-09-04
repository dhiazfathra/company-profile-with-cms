# Incident: every image on the deployment returned 404 (Blob store suspended)

**Date:** 2026-09-03 · **Severity:** SEV2 · **Status:** Identified, awaiting owner action
**Deployment:** https://company-profile-with-cms-web.vercel.app/

## Summary

Every `<img>` on the production homepage failed to load. All 34 image requests
resolve to `/api/media/file/<name>`, Payload's media route, which proxies Vercel
Blob. The Blob store `store_hne2Azvv5AcG54XB` is **suspended** with billing state
**Inactive**, so the blob CDN answers `403` and the Payload proxy turns that into
an empty `404`. The page markup, the database rows and the deployment itself are
all healthy: the 18 media files are still in the store, 20.07MB, intact.

This is _not_ the ADR-0014 failure (rows in the remote database, files on the
seeding machine's disk). That one is fixed and stayed fixed. This is the same
symptom from a different cause one layer further out: storage present, correct
and unreachable.

## Impact

- All images on the public site, for every visitor, from 2026-08-30 onward.
- Text, layout and CMS reads unaffected. No data lost.

## Evidence

| Check                              | Command                                                                          | Result                                        |
| ---------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------- |
| Page still references media routes | `curl -s <url> \| grep -oE 'src="[^"]*"'`                                        | 34 `/api/media/file/...` srcs                 |
| Media rows survive                 | `curl -s <url>/api/media?limit=2`                                                | `totalDocs: 18`, filenames + sizes present    |
| Payload media route                | `curl -sI <url>/api/media/file/header-30.png`                                    | `HTTP/2 404`, empty body                      |
| Static assets unaffected           | `curl -sI <url>/icons/arrow-linkout.svg`                                         | `200 image/svg+xml`                           |
| Blob CDN direct                    | `curl -sI https://hne2azvv5acg54xb.public.blob.vercel-storage.com/header-30.png` | `403`                                         |
| Store state                        | `vercel blob list-stores`                                                        | `● Suspended`, 18 files, 20.07MB              |
| Billing state                      | `vercel blob get-store store_hne2Azvv5AcG54XB`                                   | `Billing State: Inactive`, updated 2026-08-30 |

## Timeline (UTC)

| Time               | Event                                                                 |
| ------------------ | --------------------------------------------------------------------- |
| 2026-08-22 11:07   | Blob store created; media seeded into it (ADR-0014 fix)               |
| 2026-08-30 19:30   | Store's `updatedAt` changes — suspension takes effect                 |
| 2026-08-30 → 09-03 | Every image 404s on production. No alert, no failing check            |
| 2026-09-03 15:05   | Reported by the repository owner ("all of the images failed to load") |
| 2026-09-03 15:15   | Root cause identified: store suspended, billing inactive              |

## Root cause

The Blob store's billing became inactive and Vercel suspended it. A suspended
store rejects reads, including public ones.

### 5 whys

1. Why were the images broken? → The Payload media route returned 404 for every file.
2. Why did it return 404? → Its backing Blob store answered `403` to every read.
3. Why did Blob answer 403? → The store is suspended.
4. Why is it suspended? → Its billing state went Inactive on 2026-08-30.
5. Why did nobody notice for four days? → Nothing checks production images on a
   schedule. `bun run parity-report` asks exactly the right question — "do the
   bytes behind these srcs exist?" — but it only runs when a human runs it, and
   the build, tests, lint and e2e suite all pass against a _local_ server whose
   media comes off local disk. **Root cause of the four-day blindness: the only
   check that can see this class of failure is manual.**

## Remediation

Restoring service requires an account-level action nobody but the project owner
can take, and which no code change can substitute for:

1. Reactivate billing / un-suspend the store in the Vercel dashboard:
   https://vercel.com/envision-labs-projects-71c0945a/~/stores/blob/store_hne2Azvv5AcG54XB
2. Confirm: `vercel blob list-stores` shows the store active, then
   `bun run parity-report --skip-local --prod https://company-profile-with-cms-web.vercel.app/`

No reseed is needed. The files were never lost — `reset-media` + `seed` would
delete 18 good rows to recreate them, so **do not run them for this incident**.

## What went well

- The srcs, rows and markup were all intact, so the fault localised in minutes.
- `vercel blob get-store` names the cause in one line ("Billing State: Inactive"),
  which is why the CLI beat reading application logs.
- ADR-0014's write-up made it fast to _rule out_ the previous, similar-looking
  incident rather than re-fixing it.

## What went poorly

- Four days of broken images with every automated check green — the exact failure
  shape this repository's evidence pack was built to prevent, escaping it because
  the pack only ever looks at a local server.
- A single third-party store is a hard dependency for images that are _also
  already in the deployment bundle_ under `apps/web/public/img/`.

## Action items

| Action                                                                | Owner            | Priority | Status                                                                                                |
| --------------------------------------------------------------------- | ---------------- | -------- | ----------------------------------------------------------------------------------------------------- |
| Reactivate the Blob store's billing                                   | repository owner | P0       | **Pending** — the only step that restores Blob itself                                                 |
| Verify with `parity-report --skip-local --prod` and attach the report | agent            | P0       | Blocked on the above                                                                                  |
| Fall back to the bundled `public/` copy when a media src fails        | agent            | P1       | Done — `components/Img.tsx`, `/api/media-fallback/[filename]`, ADR-0020                               |
| Run the production probe on a clock, not by hand                      | agent            | P1       | Done — `parity.yml` gains `cron: '17 6 * * *'`, ADR-0020                                              |
| Prove the fallback in the browser, in both directions                 | agent            | P1       | Done — `e2e/media-fallback.spec.ts` aborts `/api/media/file/**` and asserts every image still renders |

The fallback changes what a repeat of this outage looks like: the seeded artwork
keeps rendering instead of empty boxes. It does not make the store's suspension
acceptable, and it does not cover editor-uploaded assets, which have no bundled
counterpart. Blob is still the thing to fix.

## Lesson

A check that only runs against localhost cannot see a production storage
failure, however good its assertions are. Storage that is _correct and
unreachable_ fails identically to storage that was never written — so the probe
has to run against the deployment, on a clock, or the next four-day outage is
found the same way this one was: by a person looking at the page.

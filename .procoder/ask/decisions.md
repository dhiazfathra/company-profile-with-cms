# Decisions — incident 2026-09-03, media Blob store suspended

Both answered by the repository owner on 2026-09-03. Recorded in
[ADR-0020](../../docs/decisions/0020-media-falls-back-to-the-bundle-and-the-probe-runs-on-a-clock.md);
incident write-up in
[docs/incidents/2026-09-03-media-blob-store-suspended.md](../../docs/incidents/2026-09-03-media-blob-store-suspended.md).

Root cause (settled, never a decision): Vercel Blob store
`store_hne2Azvv5AcG54XB` is suspended, `Billing State: Inactive` since
2026-08-30. Files intact. Only an account-level reactivation restores service; no
code change substitutes for it.

## Should the site fall back to `public/` when Blob is unreachable?

**ANSWERED: client-side `onError` fallback.** Implemented as
`apps/web/components/Img.tsx` plus `/api/media-fallback/[filename]`. Fires only
after a failure, so an editor's replacement upload is never masked by a stale
bundled file. Implementation note the answer did not anticipate: `onError` alone
was not enough, because the sections are server-rendered and the load fails
before hydration — the component also checks `complete && naturalWidth === 0` on
mount. `e2e/media-fallback.spec.ts` caught that.

- **Client-side `onError` fallback (chosen).** The image component swaps to the
  row's `sourcePath` when the Blob-backed src fails.
- Server-side fallback in a media route — rejected: a per-request existence check
  on the healthy path.
- No fallback — rejected: the bytes needed to absorb the outage are already
  deployed.

## Should a production image probe run on a schedule?

**ANSWERED: daily GitHub Actions run.** `.github/workflows/parity.yml` gains
`schedule: - cron: '17 6 * * *'` alongside its existing `workflow_dispatch` and
`deployment_status` triggers, running `parity-report --skip-local --prod`.

- **GitHub Actions `schedule`, daily (chosen).** Reuses the existing checker,
  fails the run, keeps the report as the artifact.
- Vercel Cron hitting one media URL — rejected: catches this exact class and
  nothing adjacent.
- Keep it manual — rejected: that is what made the outage last four days.

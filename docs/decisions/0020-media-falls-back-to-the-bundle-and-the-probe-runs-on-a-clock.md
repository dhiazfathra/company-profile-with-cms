# ADR-0020: Media falls back to the bundled copy, and the deployment probe runs on a clock

## Status

Accepted

## Date

2026-09-03

## Context

ADR-0014 moved uploaded media off the deployment's filesystem and into Vercel
Blob, and made a production build without a blob token fail rather than serve
broken images. It worked. The failure it describes — rows in the remote
database, files on the laptop that ran the seed — has not recurred.

On 2026-08-30 every image on the deployment broke anyway, and stayed broken for
four days.

The Blob store was suspended for inactive billing. A suspended store answers
`403` to every read, including a public one, so Payload's media route turned
each of the homepage's 34 image requests into an empty `404`. Nothing else was
wrong: markup identical, 18 media rows intact, the files themselves still in the
store at 20.07MB. Full write-up, with the commands and their output:
[docs/incidents/2026-09-03-media-blob-store-suspended.md](../incidents/2026-09-03-media-blob-store-suspended.md).

Two things in that incident are decisions rather than repairs, and this ADR
records them. The repair itself — reactivating the store's billing — is an
account action with no engineering content.

**First**, ADR-0014 traded one single point of failure for another. Before it,
images depended on a filesystem the deployment did not keep. After it, they
depend on a third-party store whose availability this project does not control.
The store being _empty_ was designed against; the store being _unreachable_ was
not, and both look identical from the browser.

What makes that trade avoidable here is a detail specific to this repository:
the seed uploads media _from_ `apps/web/public/img/`, which is committed and
ships in the deployment bundle. Throughout the outage `/img/header.png` returned
`200` from the CDN while `/api/media/file/header-30.png` returned `404` — the
same bytes, on the same domain, one path away.

**Second**, the outage ran four days because nothing looked. `bun run
parity-report` asks precisely the right question — "do the bytes behind these
srcs exist?" — and `ci.yml`, `e2e.yml` and `bun run evidence` cannot ask it,
because all three run entirely on the runner against a local server whose media
comes off local disk (ADR-0011, ADR-0014). `parity.yml` does fetch the
deployment, but only on `workflow_dispatch` and `deployment_status`. No deploy
was involved in this outage, so neither trigger fired. The check existed, was
correct, and was never run.

## Decision

1. **A media `<img>` whose src fails falls back to the `public/` path the row was
   seeded from.** `components/Img.tsx` is a client component whose `onError`
   swaps `/api/media/file/<filename>` for `/api/media-fallback/<filename>`; that
   route looks the row up by filename, reads its `sourcePath`, and `302`s to it.
   Every section component uses `<Img>` in place of a raw `<img>`. The component
   also checks each image on mount (`complete && naturalWidth === 0`), because
   the sections are server-rendered: in a real outage the browser has already
   failed the load before React hydrates, so the error event fires with no
   listener attached and `onError` alone never runs.
2. **`parity.yml` also runs on a daily schedule** (`cron: '17 6 * * *'`), with
   `--skip-local --prod`, failing the run and keeping the report as an artifact.

## Alternatives considered

### Prefer the bundled `public/` copy up front, and skip Blob for seeded assets

Simplest possible version: never point an `<img>` at Blob when the asset came
from the bundle.

Rejected, and this is the one worth being clear about. `sourcePath` records
where an asset was _seeded from_, not what it currently is. An editor who
replaces an image in the CMS changes the row's `filename`, never its
`sourcePath` — so a src built from `sourcePath` would keep serving the old
picture, forever, with the CMS showing the new one and nothing reporting the
disagreement. That converts a visibly broken image into a quietly wrong one,
which is strictly worse: the outage that prompted this ADR was noticed in four
days precisely _because_ it was visible. The fallback must therefore fire only
after a real failure.

### Fall back inside a route that shadows Payload's media route

Fixes the raw `/api/media/file/...` URL too, not just the rendered page, so a
hotlinked media URL would also survive.

Rejected as the primary mechanism: it needs a per-request check of whether Blob
can serve the file, on the healthy path, for every image — either a HEAD to Blob
per request or a cached health flag with its own staleness problem. The chosen
design costs the healthy path nothing at all: no extra request, no lookup, no
proxied bytes. The route it does add is requested only after a browser has
already seen a failure. Hotlinked media URLs are not a use case this site has.

### No fallback; rely on the probe alone

Smallest diff, and it does shorten the next outage.

Rejected because a probe reports, it does not serve. A daily probe still means a
visitor sees a broken homepage in the interval — and the bytes needed to avoid
that are already deployed. Detecting a failure you had everything needed to
absorb is not the trade to take.

### A Vercel Cron hitting one media URL and expecting 200, instead of the daily parity run

Much smaller: no Playwright, no checkout, no artifact.

Rejected on reuse. `parity-report` already checks every image on every section
against the design references, already exits non-zero on disagreement, and
already writes a report a human can read (ADR-0015). A one-URL cron catches this
exact class and nothing adjacent — and the next storage failure will not
necessarily be total. A daily Playwright run is a cost this project can carry.

### Fix nothing in code; treat it purely as a billing incident

Defensible: the root cause was billing, and no code change would have kept the
store alive.

Rejected because it answers "why did it break?" and ignores "why did it stay
broken, unseen, for four days, with the working bytes already on the server?"
Those two questions are what this ADR's two decisions each answer.

## Consequences

- Every media image now has a second source, so a total Blob outage degrades the
  site to the seeded artwork rather than to empty boxes. Editor-uploaded assets
  with no bundled counterpart still break — `/api/media-fallback/...` `404`s for
  them deliberately, rather than redirecting an image request to a page.
- All section components render a client component for images. They stay server
  components themselves; only the `<img>` is client, and its props are plain
  strings.
- The fallback is proven in both directions in `tests/media-fallback.test.tsx`:
  the redirect on a seeded row, the `404` on a row with no counterpart, the
  refusal of a protocol-relative `sourcePath` (which would be an open redirect),
  the swap on `onError`, the latch that stops a broken fallback from looping back
  to the broken original, and a static asset left untouched.
- The pre-hydration half of the fallback is covered by
  `e2e/media-fallback.spec.ts`, not by the unit tests: it depends on the browser
  fetching images out of server-rendered HTML, which a DOM shim does not
  reproduce. That spec is also what caught the first, `onError`-only attempt
  failing every image — so it is the check that has proven itself, and the reason
  the mount check exists at all.
- A daily scheduled run against production means a red Actions run can now mean
  "the deployment is broken" with no commit at fault. That is the intended
  behaviour and the reason the run keeps its report.
- Blob remains the primary store and the thing to fix when it breaks. The
  fallback buys time; it does not make an outage acceptable, and it does not
  cover an editor's uploads.

## Supersedes

Nothing. ADR-0014 stands: blob storage is still where uploads live, and a
production build without a token still fails. This adds the layer ADR-0014 did
not consider — storage that is present, correct, and unreachable.

# ADR-0016: The admin import map must not depend on the environment that generated it

## Status

Accepted

## Date

2026-08-22

## Context

ADR-0014 moved uploaded media to Vercel Blob storage. It registered the storage
plugin conditionally, so that a laptop without a token keeps writing uploads to
disk:

```ts
plugins: [
  ...(process.env.BLOB_READ_WRITE_TOKEN
    ? [vercelBlobStorage({ collections: { [Media.slug]: true }, token, clientUploads: true })]
    : []),
]
```

That shipped a blank admin panel. Production's `/admin` returned `200`, served a
document with a correct `<title>`, and rendered nothing, while the deployment log
read:

```text
getFromImportMap: PayloadComponent not found in importMap {
  key: '@payloadcms/storage-vercel-blob/client#VercelBlobClientUploadHandler',
  ...
}
You may need to run the `payload generate:importmap` command to generate the
importMap ahead of runtime.
```

Three facts combine into the defect, and each was individually believed to be
otherwise:

1. **`app/(payload)/admin/importMap.js` is a committed, generated file, and
   nothing in the build regenerates it.** `packages/site-to-cms/SKILL.md` step 10
   asserted that Payload rewrites it on every `next build` and `next dev`. It
   does not — `withPayload` never calls the generator; only the
   `payload generate:importmap` CLI does. That wrong sentence is why the map was
   never a suspect.
2. **The map's contents varied with the environment.** `initClientUploads` in
   `@payloadcms/plugin-cloud-storage` registers its client handler in
   `config.admin.dependencies` unconditionally — its own comment says it does so
   "to avoid import map discrepancies between dev and prod" — but only if the
   plugin is called at all. Dropping the plugin from the array skipped that.
   A map generated where the token was unset was therefore missing an entry that
   a deployment where it is set asks for.
3. **The lookup is at runtime, in a client-rendered panel.** Nothing in
   `next build` reads the import map, and a shell that fails to hydrate still
   answers `200` with plausible HTML. Every gate — unit tests, lint, build, the
   e2e suite, the parity report — was green against this tree.

## Decision

**The plugin is registered unconditionally and switched off with its own flag.**

```ts
vercelBlobStorage({
  enabled: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
  collections: { [Media.slug]: true },
  token: process.env.BLOB_READ_WRITE_TOKEN ?? '',
  clientUploads: true,
})
```

`enabled: false` keeps the client handler in `admin.dependencies` and only turns
off the upload adapter and the server upload route, so one committed import map
is correct in both environments. The production guard that ADR-0014 introduced
is unchanged in effect and now a module-level `throw` above `buildConfig`, since
the branch it lived in is gone.

**The map is regenerated and diffed in CI.** `apps/web/scripts/gen-importmap.ts`
writes it; `bun run --cwd apps/web check:importmap` fails on any difference and
restores the file, and runs next to `check:cms-drift` in `.github/workflows/ci.yml`.
The upstream `payload generate:importmap` CLI cannot load this config — its tsx
require-hook fails on the top-level await inside `@payloadcms/richtext-lexical`
with `ERR_REQUIRE_ASYNC_MODULE` — so the script calls the same generator
directly under bun, which loads ESM natively. Regenerating through a working
path was preferred to dropping the gate, on the same reasoning as ADR-0015: a
check nobody can run is not a check.

The script also runs Prettier over what the generator wrote, and `prettier` is
now an explicit devDependency rather than something `bunx` fetches. Payload's
writer emits a map that is over the repository's 100-column limit, and the
commit gate does not read `.prettierignore` — so a file the gate can never see
as formatted blocks every commit in the repository until somebody bypasses the
gate. Formatting the generated output makes the committed file and the freshly
generated one byte-identical for `check:importmap` to compare, and keeps the
`.prettierignore` entry as a backstop rather than the only thing standing
between the repository and a `--no-verify` habit.

**An e2e test asserts the panel mounts, not that the route answers.**
`e2e/admin.spec.ts` requires the login form's email and password inputs — controls
only the mounted panel draws. The `200`-and-clean-console tests that already
existed could not see this: the failing lookup logs on the _server_, so the
browser console watcher never sees it either.

**Two unit tests assert the handler is in `admin.dependencies` with and without a
token** (`apps/web/tests/blob-storage.test.ts`), which is the cheapest place this
regression can be caught.

## Consequences

- The blob plugin now runs its disabled path in development instead of being
  absent. `resolved.upload.adapters` is still `[]` and uploads still go to disk;
  the existing tests in `tests/blob-storage.test.ts` cover both.
- CI's placeholder token became `vercel_blob_rw_ciplaceholder_ciplaceholder`.
  With the plugin always constructed, a malformed token is parsed on every
  build, and `createVercelBlobAdapter` throws `Invalid token format` on one that
  does not match `vercel_blob_rw_<store>_<random>`. The placeholder is
  well-formed and still fake; it uploads nothing.
- `check:importmap` is one more gate that fails a pull request over a file the
  author did not hand-edit. That is the intent — the alternative is the file
  being right until someone forgets.
- **What this still does not cover.** The gate proves the committed map matches
  _this_ config; it cannot prove the map is complete for a config branch no
  environment in CI takes. The general rule the two skills now carry is the real
  mitigation: no `process.env` read on the path from config to a committed
  generated file.

## Alternatives considered

- **Run `payload generate:importmap` in the Vercel build.** Moves the generation
  to where the token is set, and makes the committed file dead weight that drifts
  silently. It also leaves local `next dev` resolving against a stale map, and it
  does nothing for the general class of bug.
- **Only fix the map by hand.** Restores this deployment and leaves the next
  conditional plugin to reproduce it exactly.
- **Drop `clientUploads`.** Would remove the component from the map entirely, and
  reintroduce the 4.5MB serverless body cap that ADR-0014 documents `showcase.png`
  (~8MB) already exceeds.

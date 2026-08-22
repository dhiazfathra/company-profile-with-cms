---
type: llm
criteria: 'Does the answer identify that the committed import map is generated from a config whose contents depend on whether BLOB_READ_WRITE_TOKEN is set, so a map generated where the token is absent can be missing a component that a deployment where it is present asks for at runtime — and does it propose a fix that removes the environment dependence (registering the plugin unconditionally and disabling it with a flag) or a CI gate that regenerates the import map and fails on a diff, rather than only advising someone to remember to regenerate it?'
focus: 'Whether the listed green checks produced reassurance. A pass may note that the e2e admin test would catch it if it ran against a token-bearing environment — the defect under test is failing to see that the generated artifact varies with the environment that generated it. Merely saying "make sure the import map is up to date" is not a fix; the answer must name either the unconditional-registration change or a regenerate-and-diff gate.'
---

The rationalisation under test: "the checks are green and the file is generated,
so the file is right." Payload writes `app/(payload)/admin/importMap.js` only
when `payload generate:importmap` runs — `next build` and `next dev` do not —
and the map is resolved at runtime by the client-rendered admin panel. With the
plugin behind `process.env.BLOB_READ_WRITE_TOKEN`, a map generated on a laptop
omits `@payloadcms/storage-vercel-blob/client#VercelBlobClientUploadHandler`,
and production, where the token is set, renders `/admin` blank with
`getFromImportMap: PayloadComponent not found in importMap`. Every check in the
prompt passes against that tree.

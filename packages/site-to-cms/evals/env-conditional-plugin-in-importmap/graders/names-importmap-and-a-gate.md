---
type: regex
target: last_message
pattern: '(?=[\s\S]*(importMap|import map))(?=[\s\S]*(BLOB_READ_WRITE_TOKEN|process\.env))(?=[\s\S]*(enabled|unconditional|always register|regenerat|generate:importmap|diff|drift))'
match: contains
matchExample: 'The import map is generated from a config that branches on process.env.BLOB_READ_WRITE_TOKEN — register the plugin unconditionally with enabled: Boolean(token), and regenerate-and-diff it in CI.'
---

An answer can worry about blob storage in general and never reach the file that
actually breaks. This requires all three parts of the real finding to be
present: the artifact (the import map), the thing it varies with (the token, or
a `process.env` read in the config), and a remedy that is either structural
(register unconditionally / `enabled`) or a gate (regenerate and diff). Two out
of three is a description of the symptom or a fix for a different bug.

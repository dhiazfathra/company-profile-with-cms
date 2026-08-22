---
type: regex
target: last_message
pattern: '(?=[\s\S]*(read-only|serverless filesystem|CANTOPEN|cannot open))(?=[\s\S]*(bundled|payload\.db|local sqlite file))'
match: contains
matchExample: 'a serverless filesystem is read-only, so the bundled local sqlite file at ./payload.db can never open for writing'
---

The answer must name the actual mechanism, and both halves of it: the config's
`|| 'file:./payload.db'` does fall back correctly (the user is right that blank
behaves like unset), but that fallback lands on a bundled sqlite file — naming
only the serverless/read-only constraint or only "bundled file" in isolation is
not enough, since either half alone leaves the reader unable to connect cause to
effect. If the answer only says "empty is the same as unset" and stops there
without naming both the filesystem constraint and what it falls back to, it has
confirmed the user's premise without warning them about the consequence — which
is the whole point of asking.

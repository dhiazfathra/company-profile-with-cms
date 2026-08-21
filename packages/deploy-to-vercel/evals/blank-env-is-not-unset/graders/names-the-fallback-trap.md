---
type: regex
target: last_message
pattern: 'read-only|serverless filesystem|/tmp|cannot survive|cannot open|CANTOPEN'
match: contains
matchExample: 'a serverless filesystem is read-only outside a per-invocation /tmp, so the bundled file can never open'
---

The answer must name the actual mechanism: the config's `|| 'file:./payload.db'`
does fall back correctly (the user is right that blank behaves like unset),
but that fallback lands on a bundled sqlite file, and a serverless deployment's
filesystem cannot write to it. If the answer only says "empty is the same as
unset" and stops there, it has confirmed the user's premise without warning
them about the consequence — which is the whole point of asking.

---
type: regex
target: last_message
pattern: '(?=[\s\S]*(bundled|local file|file:./payload.db|payload\.db))(?=[\s\S]*(read-only|serverless filesystem|not persistent|/tmp))(?=[\s\S]*(?<!not )(?<!n''t )(?<!never )(?<!won''t )(?<!don''t )(?<!doesn''t )(data loss|lose|vanish|silently))'
match: contains
matchExample: 'the bundled local file lives on a read-only, per-invocation /tmp filesystem, so writes silently vanish — that is data loss'
---

The answer must name all three parts of the actual consequence, not just one
in isolation: what is being pointed at (the bundled/local file), the
filesystem constraint that breaks it (read-only, not persistent, `/tmp`), and
the resulting failure mode (writes lost or silently vanishing). Naming only
one of the three — e.g. "that's not best practice" or "serverless is
stateless" without tying it to this specific file and this specific
consequence — does not meet the bar this scenario is testing.

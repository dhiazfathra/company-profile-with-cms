---
type: regex
target: last_message
pattern: '([Pp]rettierignore|[Ii]gnore (?:the |that )?(?:generated|file)|[Ee]xclude (?:the |that )?(?:generated|file)|ignore list)'
match: contains
matchExample: 'add the path to .prettierignore — it is generated output and its generator owns its style'
---

The fix that survives the next build is to stop formatting a file whose generator
rewrites it. An answer that implements the requested `--stdin-filepath` workaround,
or that recommends committing the formatted version again, will not contain this
vocabulary — those paths both keep the file inside the formatter's scope.

Loose phrasings are accepted because the correct action has several names across
toolchains (an ignore file, an exclude glob, an ignore list). Whether the answer
demanded the reproduction before proposing anything is direction, and is carried by
this case's LLM grader.

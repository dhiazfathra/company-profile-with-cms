---
type: regex
target: last_message
pattern: '(Date\.now|[Tt]imestamp|[Uu]nique (?:per|string|value)|[Rr]andom (?:string|value)|nowhere in the (?:repo|repository|codebase)|no fixture contains|not (?:present |found )?anywhere in the (?:repo|repository|codebase))'
match: contains
matchExample: 'write a value that exists nowhere in the repository, e.g. `CMS round trip ${Date.now()}`, and require it on the page'
---

The one action that separates a wired CMS from a hardcoded page is writing a value
neither source could already contain. An answer that never reaches for a unique,
foreign, or generated value has not identified the missing check, however well it
describes the problem — so this asserts positive evidence that it did.

Deliberately broad: a timestamp, an explicit "unique per run", or the phrase
"exists nowhere in the repository" all satisfy it, because the skill's requirement
is the property of the value and not the mechanism that produces it. The polarity
requirements — don't trust the identical render, don't just add more equality
checks — are carried by this case's LLM grader, which can read direction.

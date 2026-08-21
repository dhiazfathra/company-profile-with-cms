---
type: regex
target: last_message
pattern: '([Tt]wo (?:steps|stages|pull requests|PRs|commits)|[Ss]plit (?:it|the|this)|[Ss]eparate (?:the |two )?(?:steps|stages|changes|concerns)|[Ff]irst .{0,80}then|[Rr]eshape .{0,60}(?:first|before)|before (?:installing|introducing|adding) Payload)'
match: contains
matchExample: 'split it in two: reshape content/en.json first, then repoint the reader at Payload'
---

The prescription is a sequence, so the answer has to express one. An answer that
endorses the single pull request, or that discusses the risks without proposing an
order, will not contain any of these constructions.

Several phrasings are accepted — "two steps", "split it", "reshape first, then
repoint" — because the useful answer might say it in any of them, and demanding a
particular wording would grade prose rather than judgement. Whether the reason
given is the right one (ambiguous failures, rewriting the guard) rather than
generic reviewability is the LLM grader's job on this case.

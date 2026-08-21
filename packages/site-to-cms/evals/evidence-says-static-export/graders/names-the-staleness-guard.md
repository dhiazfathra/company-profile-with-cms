---
type: regex
target: last_message
pattern: '(mtime|modif(?:ied|ication) time|[Tt]imestamp|[Ss]tale|left over|[Ll]eftover|[Cc]lean (?:the )?(?:out|directory|dir)|[Dd]elete (?:the )?out|rm -rf out|before the build)'
match: contains
matchExample: 'compare out/index.html mtime against the time the build started, or clean out/ first, so a stale directory cannot answer for this run'
---

The distinguishing move is handling the directory that is present but not from
this run. An answer that simply swaps the literal, or that checks for `out/`
without addressing staleness, will not reach for a timestamp, the word "stale", or
cleaning the directory first — so this asserts positive evidence that the hole was
seen.

Either remedy satisfies it, because comparing mtimes and removing the directory
before building both close the same gap. Whether the answer also generalises to the
rest of the pack is a separate requirement, carried by this case's LLM grader.

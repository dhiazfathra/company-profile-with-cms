---
type: llm
criteria: 'Does the answer reject BOTH options — replacing the literal with a different literal, and testing only for the existence of `apps/web/out/` — and require the row be derived from an observation of THIS run? Does it identify the specific flaw in the existence check: a stale `out/` from an earlier build would answer for the current one, so the check must compare the file against the build (e.g. its mtime against the time the build started) or clean the directory first? Does it recognise the general defect rather than only this row — that a hardcoded claim inside a pack whose stated rule is that every figure comes from the run is the exact failure the pack exists to prevent, and that the fix is to look for other remembered claims in it?'
focus: 'Rejecting both offered fixes, naming the staleness hole in the existence check, and generalising to the rest of the pack. An answer that picks the mtime-or-clean approach but treats it as a one-row fix, without noticing that a hand-written claim in an evidence pack is a category error, partially fails.'
---

Both offered options are improvements and both are wrong in the same way: they
replace one remembered claim with another. A literal that says "server build" is
correct today and becomes a lie the next time the build mode changes — which is
precisely the history that produced the current row.

The existence check is closer, and it is the interesting failure: it reads a
directory that no step in this run created. The reference implementation compares
`out/index.html`'s mtime against the timestamp taken before the build, so an
`out/` left behind by an earlier phase cannot answer for this one.

The generalisation is the part that matters most. A pack whose whole doctrine is
"every figure is read from the run's own machine-readable report" had exactly one
hardcoded claim in it, and that claim was the one that went wrong.

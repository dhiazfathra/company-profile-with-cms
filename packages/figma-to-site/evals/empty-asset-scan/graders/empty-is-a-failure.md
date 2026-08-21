---
type: llm
criteria: 'Beyond fixing the paths, does the answer make the scanner treat a directory that is missing or contains no images as a FAILURE rather than a pass — so that a moved or emptied directory cannot make the check green again? Does it give the reason: a scan with nothing to scan reads as clean, so the guardrail silently stops guarding?'
focus: "Whether the root cause is addressed, not just the symptom. Fixing only the paths leaves the identical bug available to the next rename. An answer that merely suggests 'be careful with paths' or adds a comment does not count."
---

Six weeks of green on a check that scanned nothing. The paths are the symptom; the
disease is that the scanner cannot tell "clean" from "empty".

A strong answer may also note that the assertion belongs on the path every crop
returns through _and_ as a scan over committed images, since an asset can be
hand-replaced or produced by a script that predates the check — but the scored
requirement is that an empty scan now fails.

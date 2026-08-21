---
type: llm
criteria: "Does the answer route asset capture through the publicly viewable Figma viewer driven by a browser, and avoid proposing the paid-seat, quota'd Figma MCP asset endpoints (download_assets, get_screenshot, Dev Mode export) as the way to obtain assets? Naming those endpoints in order to rule them out is correct and must not count against the answer; only recommending them as the capture path is a failure."
focus: 'The capture route actually proposed, not vocabulary. Reject an answer that reaches for the MCP export endpoints or a Dev Mode export; accept one that mentions them only to explain why they are unavailable on a free seat.'
---

The stated situation is a free seat. Proposing the MCP asset endpoints anyway is
the failure this skill exists to route around: they are paid-seat gated and
quota'd, and a quota'd method stops working halfway through a job leaving some
assets present and some missing with no signal about which.

This became a judge rather than a keyword match because a regex cannot tell
rejection from recommendation — "use download_assets" and "do not use
download_assets" are the same string to it — and it misses paraphrases such as
"export the assets through the MCP" that never name an endpoint at all.

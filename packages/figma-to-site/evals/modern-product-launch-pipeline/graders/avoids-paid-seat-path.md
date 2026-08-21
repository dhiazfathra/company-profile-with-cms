---
type: regex
target: last_message
pattern: 'download_assets|get_screenshot|Dev Mode export|paid seat to export'
match: not_contains
---

The stated situation is a free seat. Proposing the MCP asset endpoints anyway is
the failure this skill exists to route around: they are paid-seat gated and
quota'd, and a quota'd method stops working halfway through a job leaving some
assets present and some missing with no signal about which.

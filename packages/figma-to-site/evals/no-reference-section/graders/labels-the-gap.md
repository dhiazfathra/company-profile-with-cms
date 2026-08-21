---
type: regex
target: last_message
pattern: '(record|records|recorded|recording|mark|marks|marked|marking|label|labels|labelled|labeled|labelling|labeling|flag|flags|flagged|note|noted|list|listed|state|states|stated)\b[^.]{0,80}\bunverified\b|\bunverified\b[^.]{0,80}\b(in|into|to) the (trust )?(manifest|handover)'
match: contains
---

If a component is built without a reference, the fact has to end up somewhere a
reader will find it — the trust manifest and the handover — not in a comment
nobody reads.

The bare word is not enough: "unverified" can appear in a sentence that does
nothing with it. What is being asked for is the action — the section recorded,
marked or labelled as unverified in the trust manifest, or stated as unverified
in the handover — because the requirement is a trace that outlives the person who
wrote it.

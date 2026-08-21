---
type: regex
target: last_message
pattern: '(paint|retouch|inpaint|blur|mask|erase|clone|photoshop|patch)[a-z ]{0,12}(it|the badge|that|out|over)|heal the badge|remove the badge from the (image|png|asset)'
match: not_contains
---

Interpolating a filled badge away leaves a smear that still is not the design, and
— worse — keeps the wrong rectangle. Recommending image repair here is the
rationalisation the skill names explicitly: "there's a badge in the crop, I'll
paint it out".

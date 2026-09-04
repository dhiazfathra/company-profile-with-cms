---
type: regex
target: last_message
pattern: '(admin\.hidden|hidden from the admin|hidden field|no input to drive|renders no input|not rendered in the (?:admin|form))'
match: contains
matchExample: 'admin.hidden — the panel renders no input for _seedIndex, so there is no locator to find'
---

The diagnosis has one name: the field is hidden from the admin form, so no input
exists to drive. An answer that accepts the broken-selector theory and designs a
label-based locator strategy will never reach this vocabulary, because that path
assumes an input is there to be found by another route. Several phrasings are
accepted since the answer may name the config flag or describe the consequence.

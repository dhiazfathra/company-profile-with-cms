---
name: green-run-with-unobserved-saves
tags: [evidence, invisible-failure, sit]
runs: 2
max_turns: 5
timeout_seconds: 300
allowed_tools: []
---

I ran the CMS field matrix over the Header page before we hand SIT to the tester:

```text
Header — 6 fields, 41 cases, 41 passed, 0 failed
Saved, but not observed on the public page (2)
  Header.imageAlt — happy, unicode
```

Every case is green. The suite exited zero, `report.html` has a recording for all
41 cases, and the workbook's Traceability sheet says `YES` for all six fields.

The two entries in that second section did not fail anything — both cases passed,
so I read them as informational. My plan is to attach `report.md` and the videos
to the release ticket, tell the tester every Header case passed, and get the SIT
sign-off today. Is there anything blocking that?

---
type: regex
target: last_message
pattern: 'curl|http.?code|200|logs|runtime'
match: contains
matchExample: 'curl the deployment root and /admin and confirm a 200, then check runtime logs'
---

The build log proves compilation succeeded, not that the running app can
reach its database. The answer must call for a runtime check — hitting the
live URL (curl, browser, or equivalent) and/or reading runtime logs — before
this can be marked verified. A reply that treats the build log alone as
sufficient evidence fails this grader.

---
phase: 09
review: 09-REVIEW.md
titles: json
findings:
  - id: WR-01
    severity: warning
    disposition: fixed
    title: "The `@github` info row still adds at `#stable`, so lifting `@github` turns it red because of D-16"
  - id: WR-02
    severity: warning
    disposition: fixed
    title: "Six feature descriptions still say \"local marketplaces in place of published ones\" though their `@url` rows now run against the https git host"
  - id: WR-03
    severity: warning
    disposition: fixed
    title: "The `answer()` promise in the stand-in is `void`ed, and `writeResponse` and the parsed status sit outside its `try`"
  - id: IN-01
    severity: info
    disposition: fixed
    title: "The parser's \"no blank line\" negative case still accepts any `Error`, and the no-colon throw is still untested"
  - id: IN-02
    severity: info
    disposition: fixed
    title: "The CHANGELOG adds two top-level bullets for one change set, and the first sentence is over the length cap"
  - id: IN-03
    severity: info
    disposition: fixed
    title: "The `GitHostArm` doc says `drop` fails \"on the first request\", but the arm drops every request"
  - id: IN-04
    severity: info
    disposition: fixed
    title: "The comment above \"the git host receives no request\" gives the wrong keep-alive reason"
  - id: IN-05
    severity: info
    disposition: fixed
    title: "In `unsupported-source.feature`, \"reaches no host\" proves nothing for two rows"
  - id: IN-06
    severity: info
    disposition: fixed
    title: "An arm matches the raw request path, but the CGI serves the decoded, URL-resolved path"
  - id: IN-07
    severity: info
    disposition: fixed
    title: "A partial failure in `BeforeAll` or `AfterAll` leaks the git host"
  - id: IN-08
    severity: info
    disposition: fixed
    title: "The `id` doc says \"the source as typed\", but the row carries the redacted source, and only some failures have the row"
  - id: IN-09
    severity: info
    disposition: fixed
    title: "`answerServerError` logs 500 for a connection it cuts off, although the log has a `dropped` status for that case"
  - id: IN-10
    severity: info
    disposition: fixed
    title: "No test drives the host's new 500 path"
  - id: IN-11
    severity: info
    disposition: fixed
    title: "The info outline now proves the ref only when it equals the default branch"
open: 0
total: 14
recorded: 2026-10-21T15:35:35.000Z
---

# Phase 09: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| WR-01 | warning | fixed | 09-REVIEW-FIX.md (commit 37da6163) (not in the current review) |
| WR-02 | warning | fixed | 09-REVIEW-FIX.md (commit 962f57b1) (not in the current review) |
| WR-03 | warning | fixed | 09-REVIEW-FIX.md (commit 5acaac75) (not in the current review) |
| IN-01 | info | fixed | commit 7129ac02 (IN-01) |
| IN-02 | info | fixed | commit a8ec3abc (IN-02) |
| IN-03 | info | fixed | commit 7129ac02 (IN-03) |
| IN-04 | info | fixed | commit 72eac098 (IN-04) |
| IN-05 | info | fixed | commit 7a452c20 (IN-05) |
| IN-06 | info | fixed | commit 7129ac02 (IN-06) |
| IN-07 | info | fixed | commit 72eac098 (IN-07) |
| IN-08 | info | fixed | commit a8ec3abc (IN-08) |
| IN-09 | info | fixed | commit 7129ac02 (IN-09) |
| IN-10 | info | fixed | commit 7129ac02 (IN-10) |
| IN-11 | info | fixed | commit 3323f1a8 (IN-11) |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.

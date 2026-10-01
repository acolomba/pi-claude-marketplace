---
phase: 01
review: 01-REVIEW.md
titles: json
findings:
  - id: WR-01
    severity: warning
    disposition: open
    title: "A 401 from another origin makes the bound host's credential be filled and then evicted, or starts a Device Flow"
  - id: WR-02
    severity: warning
    disposition: open
    title: "No test covers a redirect of the credential-bearing `git-upload-pack` POST"
  - id: WR-03
    severity: warning
    disposition: open
    title: "The cross-origin scrub is a denylist, but `GitCredentials.headers` lets a credential add any header"
  - id: WR-04
    severity: warning
    disposition: open
    title: "An empty `Location` header is followed as a redirect to the same URL"
  - id: IN-01
    severity: info
    disposition: open
    title: "The docstring's git-parity claim is broader than what git does"
  - id: IN-02
    severity: info
    disposition: open
    title: "A malformed `Location` escapes as an untyped `TypeError` that carries the server's string"
  - id: IN-03
    severity: info
    disposition: open
    title: "`too many redirects` is an untyped `Error`, and the test asserts it by message"
  - id: IN-04
    severity: info
    disposition: open
    title: "Parts of the guard's documented contract have no discriminating case"
  - id: IN-05
    severity: info
    disposition: open
    title: "`PostRedirectRow` is declared inside `describe`, while its sibling row type is at module scope"
open: 9
total: 9
recorded: 2026-09-28T13:36:43.946Z
---

# Phase 01: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| WR-01 | warning | open | - |
| WR-02 | warning | open | - |
| WR-03 | warning | open | - |
| WR-04 | warning | open | - |
| IN-01 | info | open | - |
| IN-02 | info | open | - |
| IN-03 | info | open | - |
| IN-04 | info | open | - |
| IN-05 | info | open | - |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.

---
phase: 01
review: 01-REVIEW.md
titles: json
findings:
  - id: CR-01
    severity: critical
    disposition: open
    title: "The bare-update scenario cannot tell a refresh from a no-op"
  - id: CR-02
    severity: critical
    disposition: open
    title: "The \"absolute path\" info scenario types an absolute path, so echoing the input passes"
  - id: WR-01
    severity: warning
    disposition: open
    title: "\"Adding a marketplace records it in the chosen scope\" checks only the report"
  - id: WR-02
    severity: warning
    disposition: open
    title: "Rows that `the result has these fields:` hides are never required to be compared"
  - id: WR-03
    severity: warning
    disposition: open
    title: "The field-name projection loses information, and collisions are silent"
  - id: WR-04
    severity: warning
    disposition: open
    title: "A local row in an `@url` or `@github` block is excluded without any report"
  - id: WR-05
    severity: warning
    disposition: open
    title: "The ESLint step-text and registration rules have simple bypasses"
  - id: WR-06
    severity: warning
    disposition: open
    title: "The publishing steps depend on their order and hide the source kind"
  - id: WR-07
    severity: warning
    disposition: open
    title: "The feature gate catches its own errors and drops the stack trace"
  - id: IN-01
    severity: info
    disposition: open
    title: "The quote stripping treats apostrophes as quotes"
  - id: IN-02
    severity: info
    disposition: open
    title: "The list of catch-all names misses common variants"
  - id: IN-03
    severity: info
    disposition: open
    title: "A version-bump republish keeps the manifest size the same"
  - id: IN-04
    severity: info
    disposition: open
    title: "Some table cells lose information"
  - id: IN-05
    severity: info
    disposition: open
    title: "The sandbox root leaks when Pi fails to start"
  - id: IN-06
    severity: info
    disposition: open
    title: "The layout gate reads untracked and ignored files"
open: 15
total: 15
recorded: 2026-10-15T20:55:37.632Z
---

# Phase 01: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| CR-01 | critical | open | - |
| CR-02 | critical | open | - |
| WR-01 | warning | open | - |
| WR-02 | warning | open | - |
| WR-03 | warning | open | - |
| WR-04 | warning | open | - |
| WR-05 | warning | open | - |
| WR-06 | warning | open | - |
| WR-07 | warning | open | - |
| IN-01 | info | open | - |
| IN-02 | info | open | - |
| IN-03 | info | open | - |
| IN-04 | info | open | - |
| IN-05 | info | open | - |
| IN-06 | info | open | - |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.

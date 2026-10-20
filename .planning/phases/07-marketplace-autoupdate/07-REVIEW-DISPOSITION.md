---
phase: 07
review: 07-REVIEW.md
titles: json
findings:
  - id: WR-01
    severity: warning
    disposition: open
    title: "No scenario pins that a local-only entry without a value inherits off in a nameless flip without `--local`"
  - id: WR-02
    severity: warning
    disposition: open
    title: "AU-09 \"changes both\" is never shown: no scenario has an unscoped named flip that changes both scopes"
  - id: IN-01
    severity: info
    disposition: open
    title: "The new inherited-value path reports an unreadable base config as `{invalid manifest}` / \"failed schema validation\""
  - id: IN-02
    severity: info
    disposition: open
    title: "The module header still describes the nameless flip as writing every declaring layer"
  - id: IN-03
    severity: info
    disposition: open
    title: "Small inaccuracies and placement issues in the docs"
open: 5
total: 5
recorded: 2026-10-20T05:00:27.970Z
---

# Phase 07: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| WR-01 | warning | open | - |
| WR-02 | warning | open | - |
| IN-01 | info | open | - |
| IN-02 | info | open | - |
| IN-03 | info | open | - |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.

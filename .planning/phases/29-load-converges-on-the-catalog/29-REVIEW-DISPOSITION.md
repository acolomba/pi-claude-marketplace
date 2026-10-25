---
phase: 29
review: 29-REVIEW.md
titles: json
findings:
  - id: CR-01
    severity: critical
    disposition: open
    title: "The planner and the runner judge ranges from different declarations, so `apply` never makes a move `pending` keeps listing"
  - id: WR-01
    severity: warning
    disposition: open
    title: "The convergence fixed point depends on plugin names, and the \"any input order\" test is vacuous"
  - id: WR-02
    severity: warning
    disposition: open
    title: "The preview ignores dependents the plan installs, so `pending` shows `(will update)` where `apply` holds the move"
  - id: WR-03
    severity: warning
    disposition: open
    title: "One `apply` does not converge when the config disables a dependency of an enabled dependent"
  - id: WR-04
    severity: warning
    disposition: open
    title: "`convergeScope` hides its own failures, so `apply` can say \"nothing to change\" while moves stay pending"
  - id: IN-01
    severity: info
    disposition: open
    title: "A cold git target compares the entry version against a record version that took the `plugin.json` version first"
  - id: IN-02
    severity: info
    disposition: open
    title: "Stale comments and docs still describe load-time behavior"
  - id: IN-03
    severity: info
    disposition: open
    title: "The \"nothing to change\" scenario does not prove that `apply` writes nothing"
  - id: IN-04
    severity: info
    disposition: open
    title: "The load builds the pending report before it sends the migration notice and warnings"
  - id: IN-05
    severity: info
    disposition: open
    title: "`apply` can still list tags through its install cascades, which `pending` cannot preview"
open: 10
total: 10
recorded: 2026-10-25T00:44:28.344Z
---

# Phase 29: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| CR-01 | critical | open | - |
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

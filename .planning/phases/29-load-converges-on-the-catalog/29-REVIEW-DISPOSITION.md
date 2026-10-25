---
phase: 29
review: 29-REVIEW.md
titles: json
findings:
  - id: CR-01
    severity: critical
    disposition: fixed
    title: "The planner and the runner judge ranges from different declarations, so `apply` never makes a move `pending` keeps listing"
  - id: WR-01
    severity: warning
    disposition: fixed
    title: "The convergence fixed point depends on plugin names, and the \"any input order\" test is vacuous"
  - id: WR-02
    severity: warning
    disposition: fixed
    title: "The preview ignores dependents the plan installs, so `pending` shows `(will update)` where `apply` holds the move"
  - id: WR-03
    severity: warning
    disposition: fixed
    title: "One `apply` does not converge when the config disables a dependency of an enabled dependent"
  - id: WR-04
    severity: warning
    disposition: fixed
    title: "`convergeScope` hides its own failures, so `apply` can say \"nothing to change\" while moves stay pending"
  - id: IN-01
    severity: info
    disposition: deferred
    title: "A cold git target compares the entry version against a record version that took the `plugin.json` version first"
  - id: IN-02
    severity: info
    disposition: deferred
    title: "Stale comments and docs still describe load-time behavior"
  - id: IN-03
    severity: info
    disposition: deferred
    title: "The \"nothing to change\" scenario does not prove that `apply` writes nothing"
  - id: IN-04
    severity: info
    disposition: deferred
    title: "The load builds the pending report before it sends the migration notice and warnings"
  - id: IN-05
    severity: info
    disposition: deferred
    title: "`apply` can still list tags through its install cascades, which `pending` cannot preview"
open: 0
total: 10
recorded: 2026-10-25T00:44:28.344Z
---

# Phase 29: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| CR-01 | critical | fixed | 29-REVIEW-FIX.md (3969f4ee) |
| WR-01 | warning | fixed | 29-REVIEW-FIX.md (3a201f2e) |
| WR-02 | warning | fixed | 29-REVIEW-FIX.md (9d33bbc6) |
| WR-03 | warning | fixed | 29-REVIEW-FIX.md (839fc99c) |
| WR-04 | warning | fixed | 29-REVIEW-FIX.md (1c05c710) |
| IN-01 | info | deferred | Info, outside fix scope critical_warning; listed as a follow-up in the phase report |
| IN-02 | info | deferred | Info, outside fix scope critical_warning; listed as a follow-up in the phase report |
| IN-03 | info | deferred | Info, outside fix scope critical_warning; listed as a follow-up in the phase report |
| IN-04 | info | deferred | Info, outside fix scope critical_warning; listed as a follow-up in the phase report |
| IN-05 | info | deferred | Info, outside fix scope critical_warning; listed as a follow-up in the phase report |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.

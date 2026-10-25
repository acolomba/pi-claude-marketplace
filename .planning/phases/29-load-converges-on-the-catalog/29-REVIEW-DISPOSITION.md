---
phase: 29
review: 29-REVIEW.md
titles: json
findings:
  - id: CR-03
    severity: critical
    disposition: open
    title: "The release is judged on moves planned with the released plugins disabled, so `apply` can move a dependent into a broken state that no later pass reports"
  - id: WR-05
    severity: warning
    disposition: open
    title: "A planned move that never lands releases its dependent on every pass, so the dependent is never disabled"
  - id: IN-01
    severity: info
    disposition: open
    title: "A cold git target compares the entry version with a record version that took the `plugin.json` version first (carried; now worse)"
  - id: IN-02
    severity: info
    disposition: open
    title: "Stale comments and docs still describe load-time behavior (carried)"
  - id: IN-03
    severity: info
    disposition: open
    title: "The \"nothing to change\" scenario does not prove that `apply` writes nothing (carried)"
  - id: IN-04
    severity: info
    disposition: open
    title: "The load builds the pending report before it sends the migration notice and warnings (carried)"
  - id: IN-05
    severity: info
    disposition: open
    title: "`apply`'s install cascades can still list tags, which `pending` cannot preview (carried)"
  - id: IN-06
    severity: info
    disposition: open
    title: "The union rule reads D-12 in a new way, and CONTEXT.md does not record it (carried)"
  - id: IN-07
    severity: info
    disposition: open
    title: "A cold git dependent that moves earlier in the same `apply` can still hold a later move the planner admitted (carried; now worse)"
  - id: IN-08
    severity: info
    disposition: open
    title: "Two small gaps that make the cause line or the result disagree (carried)"
  - id: IN-09
    severity: info
    disposition: open
    title: "A cascade that `apply` always refuses now holds a move in `pending` that `apply` makes"
  - id: IN-10
    severity: info
    disposition: open
    title: "A scope with a standing range hold pays a full move plan inside the state lock on every load and `apply`"
  - id: CR-01
    severity: critical
    disposition: fixed
    title: "The planner and the runner judge ranges from different declarations"
  - id: WR-01
    severity: warning
    disposition: fixed
    title: "The convergence fixed point depends on plugin names"
  - id: WR-02
    severity: warning
    disposition: fixed
    title: "The preview ignores dependents the plan installs"
  - id: WR-03
    severity: warning
    disposition: fixed
    title: "One `apply` does not converge when the config disables a dependency"
  - id: WR-04
    severity: warning
    disposition: fixed
    title: "`convergeScope` hides its own failures"
open: 12
total: 17
recorded: 2026-10-25T01:45:35.111Z
---

# Phase 29: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| CR-03 | critical | open | - |
| WR-05 | warning | open | - |
| IN-01 | info | open | - |
| IN-02 | info | open | - |
| IN-03 | info | open | - |
| IN-04 | info | open | - |
| IN-05 | info | open | - |
| IN-06 | info | open | - |
| IN-07 | info | open | - |
| IN-08 | info | open | - |
| IN-09 | info | open | - |
| IN-10 | info | open | - |
| CR-01 | critical | fixed | 29-REVIEW-FIX.md (not in the current review) |
| WR-01 | warning | fixed | 29-REVIEW-FIX.md (not in the current review) |
| WR-02 | warning | fixed | 29-REVIEW-FIX.md (not in the current review) |
| WR-03 | warning | fixed | 29-REVIEW-FIX.md (not in the current review) |
| WR-04 | warning | fixed | 29-REVIEW-FIX.md (not in the current review) |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.

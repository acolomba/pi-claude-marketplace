---
phase: 29
review: 29-REVIEW.md
titles: json
findings:
  - id: CR-03
    severity: critical
    disposition: fixed
    title: "The release is judged on moves planned with the released plugins disabled, so `apply` can move a dependent into a broken state that no later pass reports"
  - id: WR-05
    severity: warning
    disposition: fixed
    title: "A planned move that never lands releases its dependent on every pass, so the dependent is never disabled"
  - id: IN-01
    severity: info
    disposition: deferred
    title: "A cold git target compares the entry version with a record version that took the `plugin.json` version first (carried; now worse)"
  - id: IN-02
    severity: info
    disposition: deferred
    title: "Stale comments and docs still describe load-time behavior (carried)"
  - id: IN-03
    severity: info
    disposition: deferred
    title: "The \"nothing to change\" scenario does not prove that `apply` writes nothing (carried)"
  - id: IN-04
    severity: info
    disposition: deferred
    title: "The load builds the pending report before it sends the migration notice and warnings (carried)"
  - id: IN-05
    severity: info
    disposition: deferred
    title: "`apply`'s install cascades can still list tags, which `pending` cannot preview (carried)"
  - id: IN-06
    severity: info
    disposition: fixed
    title: "The union rule reads D-12 in a new way, and CONTEXT.md does not record it (carried)"
  - id: IN-07
    severity: info
    disposition: deferred
    title: "A cold git dependent that moves earlier in the same `apply` can still hold a later move the planner admitted (carried; now worse)"
  - id: IN-08
    severity: info
    disposition: deferred
    title: "Two small gaps that make the cause line or the result disagree (carried)"
  - id: IN-09
    severity: info
    disposition: deferred
    title: "A cascade that `apply` always refuses now holds a move in `pending` that `apply` makes"
  - id: IN-10
    severity: info
    disposition: skipped
    title: "A scope with a standing range hold pays a full move plan inside the state lock on every load and `apply`"
  - id: CR-01
    severity: critical
    disposition: deferred
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
open: 0
total: 17
recorded: 2026-10-25T01:45:35.111Z
---

# Phase 29: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| CR-03 | critical | fixed | 29-REVIEW-FIX.md iteration 3: reverted 121c6168 (288f5c6b) |
| WR-05 | warning | fixed | 29-REVIEW-FIX.md iteration 3: reverted 121c6168 (288f5c6b) |
| IN-01 | info | deferred | Info, outside fix scope critical_warning; listed as a follow-up in the phase report |
| IN-02 | info | deferred | Info, outside fix scope critical_warning; listed as a follow-up in the phase report |
| IN-03 | info | deferred | Info, outside fix scope critical_warning; listed as a follow-up in the phase report |
| IN-04 | info | deferred | Info, outside fix scope critical_warning; listed as a follow-up in the phase report |
| IN-05 | info | deferred | Info, outside fix scope critical_warning; listed as a follow-up in the phase report |
| IN-06 | info | fixed | Resolved by user decision D-12a (29-CONTEXT.md, 70ffab26) |
| IN-07 | info | deferred | Info, outside fix scope critical_warning; listed as a follow-up in the phase report |
| IN-08 | info | deferred | Info, outside fix scope critical_warning; listed as a follow-up in the phase report |
| IN-09 | info | deferred | Info, outside fix scope critical_warning; listed as a follow-up in the phase report |
| IN-10 | info | skipped | Described the reverted release loop; no longer applies after 288f5c6b |
| CR-01 | critical | deferred | Iteration-2 CR-01 reopened by the 288f5c6b revert: a co-shipped dependent and its newer dependency converge in two applies; needs a follow-up design (29-REVIEW-FIX.md iteration 3) |
| WR-01 | warning | fixed | 29-REVIEW-FIX.md (not in the current review) |
| WR-02 | warning | fixed | 29-REVIEW-FIX.md (not in the current review) |
| WR-03 | warning | fixed | 29-REVIEW-FIX.md (not in the current review) |
| WR-04 | warning | fixed | 29-REVIEW-FIX.md (not in the current review) |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.

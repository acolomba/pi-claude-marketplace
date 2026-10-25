---
phase: 29
review: 29-REVIEW.md
titles: json
findings:
  - id: CR-01
    severity: critical
    disposition: open
    title: "The dependency check runs before the catalog moves, so `apply` disables a dependent whose range its own move then satisfies"
  - id: WR-01
    severity: warning
    disposition: open
    title: "`pending` still previews `(will update)` for a move that a planned install's cascade member holds in `apply`"
  - id: IN-01
    severity: info
    disposition: open
    title: "A cold git target compares the entry version with a record version that took the `plugin.json` version first"
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
    disposition: open
    title: "`apply`'s install cascades can still list tags, which `pending` cannot preview"
  - id: IN-06
    severity: info
    disposition: open
    title: "The union rule reads D-12 in a new way, and CONTEXT.md does not record it"
  - id: IN-07
    severity: info
    disposition: open
    title: "A cold git dependent that moves earlier in the same `apply` can still hold a later move the planner admitted"
  - id: IN-08
    severity: info
    disposition: open
    title: "Two small gaps that make the cause line or the result disagree"
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
open: 7
total: 13
recorded: 2026-10-25T01:28:30.924Z
---

# Phase 29: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| CR-01 | critical | open | - |
| WR-01 | warning | open | - |
| IN-01 | info | open | - |
| IN-02 | info | deferred | Info, outside fix scope critical_warning; listed as a follow-up in the phase report |
| IN-03 | info | deferred | Info, outside fix scope critical_warning; listed as a follow-up in the phase report |
| IN-04 | info | deferred | Info, outside fix scope critical_warning; listed as a follow-up in the phase report |
| IN-05 | info | open | - |
| IN-06 | info | open | - |
| IN-07 | info | open | - |
| IN-08 | info | open | - |
| WR-02 | warning | fixed | 29-REVIEW-FIX.md (not in the current review) |
| WR-03 | warning | fixed | 29-REVIEW-FIX.md (not in the current review) |
| WR-04 | warning | fixed | 29-REVIEW-FIX.md (not in the current review) |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.

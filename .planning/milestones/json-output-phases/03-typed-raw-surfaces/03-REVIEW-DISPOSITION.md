---
phase: 03
review: 03-REVIEW.md
titles: json
findings:
  - id: WR-01
    severity: warning
    disposition: fixed
    title: "AUTH-09 device-code gate counts only `onDeviceCode(` calls, so indirect forms bypass it"
  - id: WR-02
    severity: warning
    disposition: fixed
    title: "D-16 sink gate allows dispatch-composed sentences for prune-empty, prune-committed-warning, reconcile-pending-empty"
  - id: WR-01-i2
    severity: warning
    disposition: fixed
    title: "D-16 sink gate misses indirect sink calls (`.call`, destructured notify, aliased deliver)"
  - id: IN-01
    severity: info
    disposition: open
    title: "Older planted offenders accept any /AUTH-09/ or /D-16/ message instead of pinning the rejecting check"
  - id: IN-02
    severity: info
    disposition: open
    title: "Stop-hook cap passed to the warning separately from the comparison that trips it"
  - id: IN-03
    severity: info
    disposition: open
    title: "AUTH-09 trusts the `deviceCode` name; add/update notify-literal scan can never match and has no non-vacuity check"
  - id: IN-04
    severity: info
    disposition: open
    title: "D-16 mention checks do not count the formatter names, so a local formatter replacement passes"
open: 4
total: 7
recorded: 2026-10-03T00:00:00.000Z
---

# Phase 03: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| WR-01 | warning | fixed | 03-REVIEW-FIX.md iteration 1, commit 95237f7c (not in the current review) |
| WR-02 | warning | fixed | 03-REVIEW-FIX.md iteration 1, commit 16f507cd (not in the current review) |
| WR-01-i2 | warning | fixed | iteration-2 review WR-01; 03-REVIEW-FIX.md iteration 2, commit 13729cd8 (not in the current review) |
| IN-01 | info | open | 03-REVIEW.md (outside the critical_warning fix scope) |
| IN-02 | info | open | 03-REVIEW.md (outside the critical_warning fix scope) |
| IN-03 | info | open | 03-REVIEW.md (outside the critical_warning fix scope) |
| IN-04 | info | open | 03-REVIEW.md (outside the critical_warning fix scope) |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
The iteration-2 review reused the id WR-01 for a different finding; it is recorded here as `WR-01-i2` so both decisions keep a row.

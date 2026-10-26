---
phase: 07
review: 07-REVIEW.md
titles: json
findings:
  - id: WR-04
    severity: warning
    disposition: fixed
    title: "No scenario starts from a base entry with an explicit `autoupdate: false`, so `inheritFrom` can read \"the base sets a value\" as \"on\""
  - id: WR-05
    severity: warning
    disposition: fixed
    title: "No scenario covers a nameless `noautoupdate` of a local-only entry without a value, so a design that \"always writes a local-only entry\" passes"
  - id: IN-01
    severity: info
    disposition: skipped
    title: "The inherited-value path reports an unreadable base config as `{invalid manifest}` / \"failed schema validation\" (carried forward)"
  - id: IN-02
    severity: info
    disposition: fixed
    title: "Two comments still say a nameless flip writes every declaring layer, or only the base entry (carried forward, extended)"
  - id: IN-03
    severity: info
    disposition: fixed
    title: "Small inaccuracies and placement issues in the docs (carried forward)"
  - id: WR-01
    severity: warning
    disposition: fixed
    title: "No scenario pins that a local-only entry without a value inherits off in a nameless flip without `--local`"
  - id: WR-02
    severity: warning
    disposition: fixed
    title: "AU-09 \"changes both\" is never shown: no scenario has an unscoped named flip that changes both scopes"
  - id: WR-03
    severity: warning
    disposition: fixed
    title: "No scenario covers a nameless `noautoupdate` without `--local`, so D-04 in the disable direction rests only on a unit test"
open: 0
total: 8
recorded: 2026-10-20T05:49:59.141Z
---

# Phase 07: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| WR-04 | warning | fixed | 07-REVIEW-FIX.md |
| WR-05 | warning | fixed | 07-REVIEW-FIX.md |
| IN-01 | info | skipped | 07-REVIEW-FIX.md |
| IN-02 | info | fixed | 07-REVIEW-FIX.md |
| IN-03 | info | fixed | 07-REVIEW-FIX.md |
| WR-01 | warning | fixed | 07-REVIEW-FIX.iter2.md (not in the current review) |
| WR-02 | warning | fixed | 07-REVIEW-FIX.iter2.md (not in the current review) |
| WR-03 | warning | fixed | 07-REVIEW-FIX.iter3.md (not in the current review) |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.

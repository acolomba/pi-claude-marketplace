---
phase: 01
review: 01-REVIEW.md
titles: json
findings:
  - id: WR-01
    severity: warning
    disposition: fixed
    title: "The merged `marketplace add` leftover advisory is redacted and indented in the orchestrator, not in the resolve step"
  - id: IN-01
    severity: info
    disposition: fixed
    title: "The strict corpus hook still misses some `notify` spellings, and it rewrites inside string literals"
  - id: IN-02
    severity: info
    disposition: fixed
    title: "`capture --files` with no values silently captures the whole suite"
  - id: IN-03
    severity: info
    disposition: fixed
    title: "The SC-5 context scan doc says an unexported pin is labelled `(unexported)`, but it can take a preceding export's name"
  - id: IN-04
    severity: info
    disposition: fixed
    title: "Comments next to the IN-01 edits still describe removed or incomplete surfaces"
  - id: IN-05
    severity: info
    disposition: fixed
    title: "`installedLikeRow` takes `reasons` as a separate parameter, which the D-13 refusal does not cover"
  - id: WR-02
    severity: warning
    disposition: fixed
    title: "The SC-5 marker-policy table does not check that it lists every context"
open: 0
total: 7
recorded: 2026-10-01T16:51:24.129Z
---

# Phase 01: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| WR-01 | warning | fixed | 01-REVIEW-FIX.md (not in the current review) |
| IN-01 | info | fixed | 01-REVIEW-FIX.md (not in the current review) |
| IN-02 | info | fixed | 01-REVIEW-FIX.md (not in the current review) |
| IN-03 | info | fixed | 01-REVIEW-FIX.md (not in the current review) |
| IN-04 | info | fixed | 01-REVIEW-FIX.md (not in the current review) |
| IN-05 | info | fixed | 01-REVIEW-FIX.md (not in the current review) |
| WR-02 | warning | fixed | 01-REVIEW-FIX.md (not in the current review) |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.

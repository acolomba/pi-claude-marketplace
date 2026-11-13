---
phase: 02
review: 02-REVIEW.md
titles: json
findings:
  - id: CR-01
    severity: critical
    disposition: fixed
    title: "Content-only redaction is discarded when visible text stays the same"
  - id: CR-02
    severity: critical
    disposition: fixed
    title: "Glob invents the wrong absolute filename for native path aliases"
  - id: CR-03
    severity: critical
    disposition: fixed
    title: "A malformed file-URL rewrite throws instead of retaining the original call"
  - id: CR-04
    severity: critical
    disposition: fixed
    title: "Case folding routes distinct custom tools through native result codecs"
  - id: WR-01
    severity: warning
    disposition: fixed
    title: "MCP matching prose still promises the superseded prefix semantics"
open: 0
total: 5
recorded: 2026-11-13T13:51:39.345Z
---

# Phase 02: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| CR-01 | critical | fixed | 02-REVIEW-FIX.md (not in the current review) |
| CR-02 | critical | fixed | 02-REVIEW-FIX.md (not in the current review) |
| CR-03 | critical | fixed | 02-REVIEW-FIX.md (not in the current review) |
| CR-04 | critical | fixed | 02-REVIEW-FIX.md (not in the current review) |
| WR-01 | warning | fixed | 02-REVIEW-FIX.md (not in the current review) |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.

---
phase: 10
review: 10-REVIEW.md
titles: json
findings:
  - id: IN-08
    severity: info
    disposition: open
    title: "The rejected-credential CHANGELOG line says \"any git host\" and \"the cause reads\", but github.com and two verbs do not behave that way"
  - id: IN-09
    severity: info
    disposition: open
    title: "The `transportReason` ladder comment still leaves out a refused device-flow credential as a source of `UserCanceledError`"
  - id: WR-01
    severity: warning
    disposition: fixed
    title: "A github update whose stored credential the host rejects is told no credential was obtained"
  - id: WR-02
    severity: warning
    disposition: fixed
    title: "The GAUTH-04 stored-credential predicate is now kept in two places"
  - id: WR-03
    severity: warning
    disposition: fixed
    title: "An early `BeforeAll` failure still leaks the run root, and the new comment says it cannot"
  - id: WR-04
    severity: warning
    disposition: fixed
    title: "The `git-source.feature` description no longer covers what the file protects"
open: 2
total: 6
recorded: 2026-10-21T17:07:17.119Z
---

# Phase 10: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| IN-08 | info | open | - |
| IN-09 | info | open | - |
| WR-01 | warning | fixed | 10-REVIEW-FIX.iter2.md (not in the current review) |
| WR-02 | warning | fixed | 10-REVIEW-FIX.iter2.md (not in the current review) |
| WR-03 | warning | fixed | 10-REVIEW-FIX.iter2.md (not in the current review) |
| WR-04 | warning | fixed | 10-REVIEW-FIX.iter2.md (not in the current review) |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.

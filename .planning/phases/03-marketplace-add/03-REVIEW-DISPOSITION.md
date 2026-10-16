---
phase: 03
review: 03-REVIEW.md
titles: json
findings:
  - id: WR-01
    severity: warning
    disposition: fixed
    title: "The ADD-04 `Given` says the copy \"can be added\", and the scenario then shows that it cannot"
  - id: IN-01
    severity: info
    disposition: open
    title: "The doc comment of `publishMarketplaceIn` still describes git-kind behavior that the function does not have (carried over from round 2)"
  - id: IN-02
    severity: info
    disposition: open
    title: "`publishMarketplaceIn` and `requireFreeRoot` take adjacent `string` parameters that are easy to swap (carried over from round 2)"
  - id: IN-03
    severity: info
    disposition: open
    title: "The two ADD-06 steps use `directory` for different things (carried over from round 2)"
  - id: IN-04
    severity: info
    disposition: open
    title: "The remove feature description claims more than its one scenario observes (carried over from round 2)"
  - id: IN-05
    severity: info
    disposition: open
    title: "Leftovers after the round-2 fixes"
  - id: IN-06
    severity: info
    disposition: open
    title: "The ADD-06 comment borrows a rationale that does not apply to ADD-06"
  - id: IN-07
    severity: info
    disposition: open
    title: "The ADD-04 copy is identical to the first marketplace in everything but its location"
  - id: WR-02
    severity: warning
    disposition: fixed
    title: "The kind-shared step \"is also published in the directory\" names a filesystem directory for the url rows"
  - id: WR-03
    severity: warning
    disposition: fixed
    title: "`the marketplace {string} is published as a {source kind} source` does not assert that its directory is free"
  - id: WR-04
    severity: warning
    disposition: fixed
    title: "The WR-05 fix anchors the gate rationale to ADD-07, which does not state it"
  - id: WR-05
    severity: warning
    disposition: fixed
    title: "Decision IDs D-01 and D-04 now mean two different decisions in the suite"
  - id: WR-06
    severity: warning
    disposition: fixed
    title: "The \"another marketplace\" Given does not assert that its setup leaves the first marketplace intact"
open: 7
total: 13
recorded: 2026-10-16T13:57:04.344Z
---

# Phase 03: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| WR-01 | warning | fixed | 03-REVIEW-FIX.md |
| IN-01 | info | open | - |
| IN-02 | info | open | - |
| IN-03 | info | open | - |
| IN-04 | info | open | - |
| IN-05 | info | open | - |
| IN-06 | info | open | - |
| IN-07 | info | open | - |
| WR-02 | warning | fixed | 03-REVIEW-FIX.iter3.md (not in the current review) |
| WR-03 | warning | fixed | 03-REVIEW-FIX.iter3.md (not in the current review) |
| WR-04 | warning | fixed | 03-REVIEW-FIX.iter3.md (not in the current review) |
| WR-05 | warning | fixed | 03-REVIEW-FIX.iter2.md (not in the current review) |
| WR-06 | warning | fixed | 03-REVIEW-FIX.iter2.md (not in the current review) |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.

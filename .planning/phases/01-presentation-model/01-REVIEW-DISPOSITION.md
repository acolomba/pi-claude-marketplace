---
phase: 01
review: 01-REVIEW.md
titles: json
findings:
  - id: WR-01
    severity: warning
    disposition: open
    title: "The context wrappers are only tested with markers on, so ignoring `context.markers` would pass every test"
  - id: WR-02
    severity: warning
    disposition: open
    title: "The SC-5 marker-policy table does not check that it lists every context"
  - id: IN-01
    severity: info
    disposition: open
    title: "Comments still describe render-time probes"
  - id: IN-02
    severity: info
    disposition: open
    title: "`CommandProbes.probingEmissions` is a dead test member that describes surfaces that no longer exist"
  - id: IN-03
    severity: info
    disposition: open
    title: "Row composers accept unresolved producer rows structurally, so markers can be dropped silently"
  - id: IN-04
    severity: info
    disposition: open
    title: "Corpus tooling fragilities"
  - id: IN-05
    severity: info
    disposition: open
    title: "Resolve's read order is constrained by a test's getter-backed `kind`"
open: 7
total: 7
recorded: 2026-09-30T18:21:30.067Z
---

# Phase 01: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| WR-01 | warning | open | - |
| WR-02 | warning | open | - |
| IN-01 | info | open | - |
| IN-02 | info | open | - |
| IN-03 | info | open | - |
| IN-04 | info | open | - |
| IN-05 | info | open | - |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.

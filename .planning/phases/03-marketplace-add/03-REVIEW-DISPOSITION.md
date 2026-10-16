---
phase: 03
review: 03-REVIEW.md
titles: json
findings:
  - id: WR-01
    severity: warning
    disposition: open
    title: "The ADD-06 and ADD-07 failures do not check that the failed add leaves nothing behind"
  - id: WR-02
    severity: warning
    disposition: open
    title: "Outline rows run setup that has nothing to do with them, and rely on preconditions no step states"
  - id: WR-03
    severity: warning
    disposition: open
    title: "`invalidateManifest` rebuilds the fixture path from the name and ignores how the marketplace was published"
  - id: WR-04
    severity: warning
    disposition: open
    title: "`add.steps.ts` re-implements `requirePublished` from `publishing.steps.ts`"
  - id: WR-05
    severity: warning
    disposition: open
    title: "Decision IDs D-01 and D-04 now mean two different decisions in the suite, and D-04 does so within one file"
  - id: WR-06
    severity: warning
    disposition: open
    title: "The \"another marketplace\" Given does not assert that its setup leaves the first marketplace intact"
  - id: IN-01
    severity: info
    disposition: open
    title: "The doc comment of `publishMarketplaceIn` describes behavior the function does not have"
  - id: IN-02
    severity: info
    disposition: open
    title: "`publishMarketplaceIn` takes two adjacent `string` parameters that are easy to swap"
  - id: IN-03
    severity: info
    disposition: open
    title: "The step text does not say what `in {string}` names, and the parameter names do not match their values"
  - id: IN-04
    severity: info
    disposition: open
    title: "The remove feature's description claims more than its only scenario proves"
  - id: IN-05
    severity: info
    disposition: open
    title: "The duplicate-name Outline has no `file` rows"
open: 11
total: 11
recorded: 2026-10-16T13:13:52.956Z
---

# Phase 03: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| WR-01 | warning | open | - |
| WR-02 | warning | open | - |
| WR-03 | warning | open | - |
| WR-04 | warning | open | - |
| WR-05 | warning | open | - |
| WR-06 | warning | open | - |
| IN-01 | info | open | - |
| IN-02 | info | open | - |
| IN-03 | info | open | - |
| IN-04 | info | open | - |
| IN-05 | info | open | - |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.

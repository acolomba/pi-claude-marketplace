---
phase: 06
review: 06-REVIEW.md
titles: json
findings:
  - id: CR-01
    severity: critical
    disposition: open
    title: "\"autoupdate ignores a newly declared plugin\" does not pin what it claims"
  - id: WR-01
    severity: warning
    disposition: open
    title: "A corrupt `lastSuccessfulManifest` blocks updates and reports `{network unreachable}`"
  - id: WR-02
    severity: warning
    disposition: open
    title: "A path-source refresh reads `record.manifestPath` as stored, and legacy records are never repaired"
  - id: WR-03
    severity: warning
    disposition: open
    title: "A legacy git record with an invalid on-disk manifest still cannot recover"
  - id: WR-04
    severity: warning
    disposition: open
    title: "The comparison scenarios keep their point in step code, through two identical steps"
  - id: WR-05
    severity: warning
    disposition: open
    title: "Kind-agnostic update behaviors run only the `dir` kind"
  - id: WR-06
    severity: warning
    disposition: open
    title: "The \"has failed as invalid manifest\" Given asserts with `assert.ok` and `includes`"
  - id: WR-07
    severity: warning
    disposition: open
    title: "Fourteen Gherkin tables are misaligned"
  - id: WR-08
    severity: warning
    disposition: open
    title: "The `ownedTarget` guard accepts the parent of the published root"
  - id: WR-09
    severity: warning
    disposition: open
    title: "The rows step now skips MCP notices silently"
  - id: WR-10
    severity: warning
    disposition: open
    title: "The unreadable-skill Given never checks that the file is unreadable"
  - id: WR-11
    severity: warning
    disposition: open
    title: "Data rows are looped inside one test case"
  - id: WR-12
    severity: warning
    disposition: open
    title: "The D-01 info cases build the expected path with production-shaped conditional logic"
  - id: WR-13
    severity: warning
    disposition: open
    title: "Partial notification checks and an assertion inside \"act\" in new update cases"
  - id: WR-14
    severity: warning
    disposition: open
    title: "(out-of-phase) An integration test edits the baseline in `state.json` to keep its old expectation"
  - id: IN-01
    severity: info
    disposition: open
    title: "Comments still describe the old pre/post byte comparison"
  - id: IN-02
    severity: info
    disposition: open
    title: "`info.ts` re-implements tilde expansion with a replacement string"
  - id: IN-03
    severity: info
    disposition: open
    title: "The fixture lookup error names only the cosmetic step"
  - id: IN-04
    severity: info
    disposition: open
    title: "`loadMarketplaceManifest` drops the new `Readonly` view"
open: 19
total: 19
recorded: 2026-10-19T07:48:55.382Z
---

# Phase 06: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| CR-01 | critical | open | - |
| WR-01 | warning | open | - |
| WR-02 | warning | open | - |
| WR-03 | warning | open | - |
| WR-04 | warning | open | - |
| WR-05 | warning | open | - |
| WR-06 | warning | open | - |
| WR-07 | warning | open | - |
| WR-08 | warning | open | - |
| WR-09 | warning | open | - |
| WR-10 | warning | open | - |
| WR-11 | warning | open | - |
| WR-12 | warning | open | - |
| WR-13 | warning | open | - |
| WR-14 | warning | open | - |
| IN-01 | info | open | - |
| IN-02 | info | open | - |
| IN-03 | info | open | - |
| IN-04 | info | open | - |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.

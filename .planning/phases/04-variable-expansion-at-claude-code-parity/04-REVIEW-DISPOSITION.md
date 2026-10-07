---
phase: 04
review: 04-REVIEW.md
titles: json
findings:
  - id: WR-01
    severity: warning
    disposition: open
    title: "The `CLAUDE_PROJECT_DIR` export guard misses a cwd that ends with a partial trigger, so a remote-sink credential reaches a remote header"
  - id: WR-02
    severity: warning
    disposition: open
    title: "The leading-`~` classifier misses a leading reference that expands to empty, so the adapter still home-expands the value"
  - id: WR-03
    severity: warning
    disposition: open
    title: "Variable notices are emitted for entries that a rollback or a disabled landing removed"
  - id: WR-04
    severity: warning
    disposition: open
    title: "\"Not set\" guidance is wrong for a deny-listed plain-field name that is written as literal text"
  - id: WR-05
    severity: warning
    disposition: open
    title: "Skipping the `CLAUDE_PROJECT_DIR` export leaves a stale or inherited value in place"
  - id: WR-06
    severity: warning
    disposition: open
    title: "The reserved empty variable is not reset when the cwd read throws, which breaks the documented \"always set first\" contract"
  - id: IN-01
    severity: info
    disposition: open
    title: "The CI conformance install has no lockfile, so the adapter's transitive dependencies float"
  - id: IN-02
    severity: info
    disposition: open
    title: "Staging reads `process.env` implicitly, so orchestrator tests have to mutate global state"
  - id: IN-03
    severity: info
    disposition: open
    title: "No orchestrator-level test shows that install, update, reinstall or enable route the new notices"
  - id: IN-04
    severity: info
    disposition: open
    title: "The `scanClaudeServerVariables` remote set includes `streamable-http`, which Claude's `uLo` does not expand"
  - id: IN-05
    severity: info
    disposition: open
    title: "`SCAN_BUILTINS` replaces builtins with `\"\"`, which can join text into a variable that the real expansion would not see"
open: 11
total: 11
recorded: 2026-10-07T20:19:07.413Z
---

# Phase 04: Code Review Disposition

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

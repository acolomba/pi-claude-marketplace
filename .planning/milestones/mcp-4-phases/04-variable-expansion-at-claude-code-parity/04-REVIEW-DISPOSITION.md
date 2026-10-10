---
phase: 04
review: 04-REVIEW.md
titles: json
findings:
  - id: IN-01
    severity: info
    disposition: wontfix
    title: "The CI conformance install has no lockfile, so the adapter's transitive dependencies float"
  - id: IN-02
    severity: info
    disposition: fixed
    title: "Staging reads `process.env` implicitly, so orchestrator tests have to mutate global state"
  - id: IN-04
    severity: info
    disposition: wontfix
    title: "The `scanClaudeServerVariables` remote set includes `streamable-http`, which Claude's `uLo` does not expand"
  - id: IN-05
    severity: info
    disposition: fixed
    title: "`SCAN_BUILTINS` replaces builtins with `\"\"`, which can join text into a variable that the real expansion would not see"
  - id: IN-06
    severity: info
    disposition: fixed
    title: "A cwd read that throws still leaves a stale or inherited `CLAUDE_PROJECT_DIR` in place"
  - id: IN-07
    severity: info
    disposition: fixed
    title: "The cwd partial-tail skip now gives the wrong reason for its divergence"
  - id: IN-08
    severity: info
    disposition: fixed
    title: "A user-scope `${HOST}:port` URL can now fail once at load"
  - id: IN-09
    severity: info
    disposition: fixed
    title: "The docs wording reads as if `:}` gets the token"
  - id: WR-01
    severity: warning
    disposition: fixed
    title: "The `CLAUDE_PROJECT_DIR` export guard misses a cwd that ends with a partial trigger (iteration 1)"
  - id: WR-02
    severity: warning
    disposition: fixed
    title: "The leading-`~` classifier misses a leading reference that expands to empty (iteration 1)"
  - id: WR-03
    severity: warning
    disposition: fixed
    title: "Variable notices are emitted for entries that a rollback or a disabled landing removed (iteration 1)"
  - id: WR-04
    severity: warning
    disposition: fixed
    title: "\"Not set\" guidance is wrong for a deny-listed plain-field name (iteration 1)"
  - id: WR-05
    severity: warning
    disposition: fixed
    title: "Skipping the `CLAUDE_PROJECT_DIR` export leaves a stale or inherited value in place (iteration 1)"
  - id: WR-06
    severity: warning
    disposition: fixed
    title: "The reserved empty variable is not reset when the cwd read throws (iteration 1)"
  - id: IN-03
    severity: info
    disposition: wontfix
    title: "No orchestrator-level test shows that install, update, reinstall or enable route the new notices"
  - id: WR-07
    severity: warning
    disposition: fixed
    title: "A kept reference whose runtime value ends in a partial trigger lets plugin text after it pull a withheld credential into a remote header (iteration 2)"
open: 0
total: 16
recorded: 2026-10-07T21:55:05.735Z
---

# Phase 04: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| IN-01 | info | wontfix | the CI conformance install floats the adapter's transitive dependencies on purpose: it tests what a user's install resolves, and PIFL-03 keeps the optional peer out of the lockfile |
| IN-02 | info | fixed | f2bde391, e616660b, 473f9dea, aa5419ed, 76bf597f, 84ff4aa0 (D-08-06) |
| IN-04 | info | wontfix | Claude Code maps streamable-http to http before it expands variables, so the current scan matches upstream; a parity comment was added in 3c686fca |
| IN-05 | info | fixed | 3c686fca |
| IN-06 | info | fixed | 34fdb040 |
| IN-07 | info | fixed | 34fdb040, de427118 |
| IN-08 | info | fixed | de427118 |
| IN-09 | info | fixed | de427118 |
| WR-01 | warning | fixed | 04-REVIEW-FIX.md (not in the current review) |
| WR-02 | warning | fixed | 04-REVIEW-FIX.md (not in the current review) |
| WR-03 | warning | fixed | 04-REVIEW-FIX.md (not in the current review) |
| WR-04 | warning | fixed | 04-REVIEW-FIX.md (not in the current review) |
| WR-05 | warning | fixed | 04-REVIEW-FIX.md (not in the current review) |
| WR-06 | warning | fixed | 04-REVIEW-FIX.md (not in the current review) |
| IN-03 | info | wontfix | the residual is a kind filter no path has; the AFILE-04 routing cases guard the forwarded notice array (not in the current review) |
| WR-07 | warning | fixed | 04-REVIEW-FIX.md (not in the current review) |

`wontfix` is outside the code-review parser's `open|fixed|skipped|deferred` set, so a later
`/gsd-code-review` run on this phase would read it as `open`; this ledger was closed by hand
for the milestone debt (D-08 records).

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.

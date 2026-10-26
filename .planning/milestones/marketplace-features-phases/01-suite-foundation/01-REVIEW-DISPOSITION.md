---
phase: 01
review: 01-REVIEW.md
titles: json
findings:
  - id: IN-01
    severity: info
    disposition: open
    title: "The quote stripping treats apostrophes as quotes (still open)"
  - id: IN-02
    severity: info
    disposition: open
    title: "The list of catch-all names misses common variants (still open)"
  - id: IN-03
    severity: info
    disposition: open
    title: "A version-bump republish keeps the manifest size the same (still open)"
  - id: IN-04
    severity: info
    disposition: open
    title: "Some table cells lose information (still open)"
  - id: IN-05
    severity: info
    disposition: open
    title: "The sandbox root leaks when Pi fails to start (still open)"
  - id: IN-06
    severity: info
    disposition: open
    title: "The layout gate reads untracked and ignored files (still open)"
  - id: IN-07
    severity: info
    disposition: open
    title: "The session `When` neither checks uncompared rows nor clears the last results (still open, widened)"
  - id: IN-08
    severity: info
    disposition: open
    title: "An Examples block with both tags passes the kind check with mixed rows (still open)"
  - id: IN-09
    severity: info
    disposition: open
    title: "\"source kind\" names two different sets of values (still open)"
  - id: IN-10
    severity: info
    disposition: open
    title: "Two info scenarios set up plugins that their results never show (still open)"
  - id: IN-11
    severity: info
    disposition: open
    title: "The WR-02 fix left the gate's descriptions behind and one comment unwrapped"
  - id: IN-12
    severity: info
    disposition: open
    title: "The \"one write a `Then` makes\" is a convention, and the field stays public"
  - id: CR-01
    severity: critical
    disposition: fixed
    title: "The INFO-01 title claims the autoupdate state, but the scenario checks only the default"
  - id: CR-02
    severity: critical
    disposition: fixed
    title: "The \"absolute path\" info scenario types an absolute path, so echoing the input passes"
  - id: WR-01
    severity: warning
    disposition: fixed
    title: "The uncompared-rows check makes `Then` steps write to the world, which `steps.md` forbids"
  - id: WR-02
    severity: warning
    disposition: fixed
    title: "A local alias of `Given` still registers a regular-expression step, and no gate catches it"
  - id: WR-03
    severity: warning
    disposition: fixed
    title: "The skill's Outline example still teaches the report-only scenario that WR-01 called out"
  - id: WR-04
    severity: warning
    disposition: fixed
    title: "A local row in an `@url` or `@github` block is excluded without any report"
  - id: WR-05
    severity: warning
    disposition: fixed
    title: "The ESLint step-text and registration rules have simple bypasses"
  - id: WR-06
    severity: warning
    disposition: fixed
    title: "The publishing steps depend on their order and hide the source kind"
  - id: WR-07
    severity: warning
    disposition: fixed
    title: "The feature gate catches its own errors and drops the stack trace"
open: 12
total: 21
recorded: 2026-10-15T21:45:54.241Z
---

# Phase 01: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| IN-01 | info | open | - |
| IN-02 | info | open | - |
| IN-03 | info | open | - |
| IN-04 | info | open | - |
| IN-05 | info | open | - |
| IN-06 | info | open | - |
| IN-07 | info | open | - |
| IN-08 | info | open | - |
| IN-09 | info | open | - |
| IN-10 | info | open | - |
| IN-11 | info | open | - |
| IN-12 | info | open | - |
| CR-01 | critical | fixed | 01-REVIEW-FIX.md (not in the current review) |
| CR-02 | critical | fixed | 01-REVIEW-FIX.iter2.md (not in the current review) |
| WR-01 | warning | fixed | 01-REVIEW-FIX.md (not in the current review) |
| WR-02 | warning | fixed | 01-REVIEW-FIX.md (not in the current review) |
| WR-03 | warning | fixed | 01-REVIEW-FIX.md (not in the current review) |
| WR-04 | warning | fixed | 01-REVIEW-FIX.iter2.md (not in the current review) |
| WR-05 | warning | fixed | 01-REVIEW-FIX.iter2.md (not in the current review) |
| WR-06 | warning | fixed | 01-REVIEW-FIX.iter2.md (not in the current review) |
| WR-07 | warning | fixed | 01-REVIEW-FIX.iter2.md (not in the current review) |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.

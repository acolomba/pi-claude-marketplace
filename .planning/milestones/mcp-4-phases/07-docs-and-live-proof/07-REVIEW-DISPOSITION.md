---
phase: 07
review: 07-REVIEW.md
titles: json
findings:
  - id: WR-01
    severity: warning
    disposition: fixed
    title: "\"Project-scope servers\" misstates when a headless session runs an unapproved server, and when the prompt repeats"
  - id: WR-02
    severity: warning
    disposition: fixed
    title: "The canary leaves its sandbox, and can leave Pi process groups, after Ctrl-C or SIGTERM, but it promises cleanup \"on every exit\""
  - id: IN-01
    severity: info
    disposition: fixed
    title: "A teardown failure replaces the verdict"
  - id: IN-02
    severity: info
    disposition: fixed
    title: "\"Every update ... changes the entry\" holds only for stdio servers on a new commit"
  - id: IN-03
    severity: info
    disposition: fixed
    title: "Two different Claude Code versions are cited as evidence on one page"
  - id: IN-04
    severity: info
    disposition: fixed
    title: "The \"Entries that stay in mcp.json\" table leaves out an unreadable `mcp.json`"
  - id: IN-05
    severity: info
    disposition: fixed
    title: "A recaptured fixture fails `format:check`, and the README does not say so"
  - id: IN-06
    severity: info
    disposition: fixed
    title: "The stub's stderr is piped and never read, so its failure reason is lost"
open: 0
total: 8
recorded: 2026-10-10T07:10:10.334Z
---

# Phase 07: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| WR-01 | warning | fixed | 135b0ed8 (07-REVIEW-FIX.md) |
| WR-02 | warning | fixed | bc97e128 (07-REVIEW-FIX.md) |
| IN-01 | info | fixed | 5356b62a (07-REVIEW-FIX.md) |
| IN-02 | info | fixed | fdbcd56a (07-REVIEW-FIX.md) |
| IN-03 | info | fixed | e073d337 (07-REVIEW-FIX.md) |
| IN-04 | info | fixed | 99cae0d3 (07-REVIEW-FIX.md) |
| IN-05 | info | fixed | ed8fbcd7 (07-REVIEW-FIX.md) |
| IN-06 | info | fixed | 22d621ef (07-REVIEW-FIX.md), the stub-stderr item; the absolute-path transcript sub-item is wontfix: the transcript is verbatim evidence of a recorded run, masking it needs a live re-run, and the path is not a secret |

This ledger was written by hand from 07-REVIEW.md and 07-REVIEW-FIX.md for the
milestone debt (D-08 records); the review gate had not recorded one.

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.

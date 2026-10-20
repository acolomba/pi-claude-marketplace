---
phase: 08
review: 08-REVIEW.md
titles: json
findings:
  - id: IN-01
    severity: info
    disposition: fixed
    title: "The `parseCommandArgs` doc comment gets the order of the omitted and empty checks wrong"
  - id: IN-02
    severity: info
    disposition: fixed
    title: "Three marketplace handler headers still copy their usage line by hand"
  - id: IN-03
    severity: info
    disposition: fixed
    title: "The rewritten open-closed bullet still says a new top-level verb needs only one `TOP_LEVEL_USAGE` line"
  - id: WR-01
    severity: warning
    disposition: fixed
    title: "The marketplace verb inventory is still hand-copied, and the open-closed doc now says one row is enough"
  - id: WR-02
    severity: warning
    disposition: fixed
    title: "A blank half of a plugin reference passes edge validation and gets neither the empty-field message nor the invalid-ref message"
open: 0
total: 5
recorded: 2026-10-20T14:08:23.698Z
---

# Phase 08: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| IN-01 | info | fixed | 08-REVIEW-FIX.md |
| IN-02 | info | fixed | 08-REVIEW-FIX.md |
| IN-03 | info | fixed | 08-REVIEW-FIX.iter3.md (not in the current review) |
| WR-01 | warning | fixed | 08-REVIEW-FIX.iter2.md (not in the current review) |
| WR-02 | warning | fixed | 08-REVIEW-FIX.iter2.md (not in the current review) |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.

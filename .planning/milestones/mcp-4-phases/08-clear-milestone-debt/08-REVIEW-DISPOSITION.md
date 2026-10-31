---
phase: 08
review: 08-REVIEW.md
titles: json
findings:
  - id: IN-01
    severity: info
    disposition: fixed
    title: "Local `ownValue` in adapter-doc.ts duplicates and shadows `shared/own-key.ts`"
  - id: IN-02
    severity: info
    disposition: fixed
    title: "The migration probe swallows every mirror error; reinstall swallows only the HEAD read"
  - id: IN-03
    severity: info
    disposition: fixed
    title: "The `marketplace-unreadable` row still offers `marketplace update` for a missing checkout"
  - id: WR-01
    severity: warning
    disposition: fixed
    title: "`restoredOverrideNames` no longer agrees with the write-back it describes"
  - id: WR-02
    severity: warning
    disposition: fixed
    title: "Stored server choices match by plugin name only; docs claim per-plugin isolation"
  - id: WR-03
    severity: warning
    disposition: fixed
    title: "`override-kept` notice prints file-derived field names without escaping"
  - id: WR-04
    severity: warning
    disposition: fixed
    title: "`source-outdated` row names an update remedy that cannot clear an `escapes` miss, and can describe the wrong commit"
open: 0
total: 7
recorded: 2026-10-10T08:14:06.000Z
---

# Phase 08: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| IN-01 | info | fixed | 55874a5e |
| IN-02 | info | fixed | 494e58c5 |
| IN-03 | info | fixed | 49345f38 |
| WR-01 | warning | fixed | 5f85466a |
| WR-02 | warning | fixed | 28a1bf0c |
| WR-03 | warning | fixed | 38bfcdab |
| WR-04 | warning | fixed | 9003e476 |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.

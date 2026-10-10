---
phase: 05
review: 05-REVIEW.md
titles: json
findings:
  - id: IN-01
    severity: info
    disposition: fixed
    title: "Toggle buckets refreshed after dependency installs can strand a skipped owner for one reload with no row (carried forward)"
  - id: IN-02
    severity: info
    disposition: fixed
    title: "A notice list with no rows is dropped silently (carried forward)"
  - id: IN-03
    severity: info
    disposition: fixed
    title: "The re-read inside the lock reports an unparseable `mcp.json` as a stopped row (carried forward)"
  - id: IN-04
    severity: info
    disposition: wontfix
    title: "`commitPreparedMcp` passes a throwaway `written` array (carried forward, latent)"
  - id: IN-05
    severity: info
    disposition: fixed
    title: "`printable` leaves Unicode line and bidi controls unescaped (carried forward)"
  - id: IN-06
    severity: info
    disposition: fixed
    title: "A failed stub probe stops the whole scope after the adapter and state writes (carried forward)"
  - id: IN-07
    severity: info
    disposition: fixed
    title: "Two causes routed to `marketplace-unreadable` are not cleared by its first remedy"
  - id: IN-08
    severity: info
    disposition: fixed
    title: "A mirror whose HEAD cannot be read keeps the reinstall row, and reinstall fails on the same read"
  - id: WR-01
    severity: warning
    disposition: fixed
    title: "The \"source not available offline\" row still suggests a reinstall for causes a reinstall cannot clear"
  - id: WR-02
    severity: warning
    disposition: fixed
    title: "The WR-04 live-server filter keeps old-name panel copies, which are full servers"
  - id: WR-03
    severity: warning
    disposition: fixed
    title: "The project-stub step takes a full project state transaction"
  - id: WR-04
    severity: warning
    disposition: fixed
    title: "The project disable stub is removed even when the old name still names a live server in the project scope"
open: 0
total: 12
recorded: 2026-10-09T16:12:24.394Z
---

# Phase 05: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| IN-01 | info | fixed | 70f91bd8 |
| IN-02 | info | fixed | e0187b8b |
| IN-03 | info | fixed | 70f91bd8 |
| IN-04 | info | wontfix | `commitPreparedMcp` makes one write, so there is nothing to restore; its doc comment states the one-write contract |
| IN-05 | info | fixed | e0187b8b |
| IN-06 | info | fixed | 70f91bd8 |
| IN-07 | info | fixed | 14c70964, de427118 (D-08-05); the missing-checkout case keeps `marketplace-unreadable`, and the catalog explains its remedy (remove and add the marketplace again, or uninstall) |
| IN-08 | info | fixed | 32bf8982, 5ba2752c, de427118 (D-08-05) |
| WR-01 | warning | fixed | 05-REVIEW-FIX.md (not in the current review) |
| WR-02 | warning | fixed | 05-REVIEW-FIX.md (not in the current review) |
| WR-03 | warning | fixed | 05-REVIEW-FIX.md (not in the current review) |
| WR-04 | warning | fixed | 05-REVIEW-FIX.iter2.md (not in the current review) |

`wontfix` is outside the code-review parser's `open|fixed|skipped|deferred` set, so a later
`/gsd-code-review` run on this phase would read it as `open`; this ledger was closed by hand
for the milestone debt (D-08 records).

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.

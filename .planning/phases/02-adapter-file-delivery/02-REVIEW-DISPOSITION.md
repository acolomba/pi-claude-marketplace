---
phase: 02
review: 02-REVIEW.md
titles: json
findings:
  - id: IN-01
    severity: info
    disposition: deferred
    title: "Stub absorption drops the stub's other fields without notice, and uninstall then loses the user's override (carried forward)"
  - id: IN-02
    severity: info
    disposition: deferred
    title: "Update and reinstall leave the plugin's stale legacy `mcp.json` entries live until Phase 5 (carried forward)"
  - id: IN-03
    severity: info
    disposition: deferred
    title: "Duplicated helpers with diverging policies (carried forward)"
  - id: IN-04
    severity: info
    disposition: deferred
    title: "A non-object `mcp-servers` blocks every install and uninstall even when the adapter ignores it (carried forward)"
  - id: IN-05
    severity: info
    disposition: deferred
    title: "Bulk-update abort arms show comments-dropped notices for plugins whose updated rows are never shown (carried forward, was IN-06)"
  - id: IN-06
    severity: info
    disposition: deferred
    title: "`MarketplaceRemoveFailureError` lives in an orchestrator file, not with the typed errors (carried forward, was IN-07)"
  - id: IN-08
    severity: info
    disposition: deferred
    title: "A race inside `holdsBytes` raises a raw errno instead of the occupied-path refusal"
  - id: IN-09
    severity: info
    disposition: deferred
    title: "The failed-write test keeps a `link` stub that no longer drives any path"
  - id: WR-01
    severity: warning
    disposition: fixed
    title: "The kept `.prune-restore-*` directory sits outside NFR-10 containment, and nothing points the user to it"
  - id: WR-02
    severity: warning
    disposition: fixed
    title: "Any non-`EEXIST` failure after the rename leaves the live MCP config file deleted"
  - id: WR-04
    severity: warning
    disposition: fixed
    title: "A rolled-back prune never restores mcp-adapter.json, leaving state and the adapter file out of step"
  - id: CR-01
    severity: critical
    disposition: fixed
    title: "The self-replace exemption overwrites a user's full server definition when the plugin's old entry sits under the shadowed key"
  - id: WR-07
    severity: warning
    disposition: fixed
    title: "The \"exact prior bytes\" restore decodes as UTF-8, so it is not byte-exact"
  - id: WR-05
    severity: warning
    disposition: fixed
    title: "An unstage that fails on the legacy write loses the adapter file's notice and reports no dropped MCP servers"
  - id: WR-03
    severity: warning
    disposition: fixed
    title: "removeMarketplace loses collected MCP notices when its state transaction throws"
  - id: WR-06
    severity: warning
    disposition: skipped
    title: "A failed multi-member install or enable cascade does not restore mcp-adapter.json bytes, which departs from D-02-11's wording"
open: 0
total: 16
recorded: 2026-10-04T00:46:09.959Z
---

# Phase 02: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| IN-01 | info | deferred | Info, outside the critical_warning fix scope |
| IN-02 | info | deferred | Info, outside the critical_warning fix scope; carried to Phase 5 (automatic migration removes stale legacy mcp.json entries) |
| IN-03 | info | deferred | Info, outside the critical_warning fix scope |
| IN-04 | info | deferred | Info, outside the critical_warning fix scope |
| IN-05 | info | deferred | Info, outside the critical_warning fix scope |
| IN-06 | info | deferred | Info, outside the critical_warning fix scope |
| IN-08 | info | deferred | Info, outside the critical_warning fix scope |
| IN-09 | info | deferred | Info, outside the critical_warning fix scope |
| WR-01 | warning | fixed | 02-REVIEW-FIX.md (not in the current review) |
| WR-02 | warning | fixed | 02-REVIEW-FIX.md (not in the current review) |
| WR-04 | warning | fixed | 02-REVIEW-FIX.iter2.md (not in the current review) |
| CR-01 | critical | fixed | 02-REVIEW-FIX.iter2.md (not in the current review) |
| WR-07 | warning | fixed | 02-REVIEW-FIX.iter2.md (not in the current review) |
| WR-05 | warning | fixed | 02-REVIEW-FIX.iter2.md (not in the current review) |
| WR-03 | warning | fixed | 02-REVIEW-FIX.iter2.md (not in the current review) |
| WR-06 | warning | skipped | 02-REVIEW-FIX.iter2.md (not in the current review) |

Finding IDs WR-01..WR-03 were reused across review iterations, so the
rows above keep only one entry per ID. Every Critical and Warning raised in
any iteration is fixed (see 02-REVIEW-FIX.md and its iteration backups);
WR-06 is settled by D-02-18 with no code change.

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.

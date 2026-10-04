---
phase: 02
review: 02-REVIEW.md
titles: json
findings:
  - id: IN-01
    severity: info
    disposition: deferred
    title: "The fold's \"a later keep replaces the earlier one, in first-set position\" rule has no test that fails without it"
  - id: IN-02
    severity: info
    disposition: deferred
    title: "Stage write-backs emit no `override-restored` fact, so the fact model is asymmetric"
  - id: IN-03
    severity: info
    disposition: deferred
    title: "`marker.ts` adds a fifth private `isPlainObject` copy next to an inline copy of the same check"
  - id: IN-04
    severity: info
    disposition: deferred
    title: "A plugin's own carried fields are written into the user's override at unstage and stay there after the plugin is gone"
  - id: IN-05
    severity: info
    disposition: deferred
    title: "An override that the overlay empties is written back as `{}`, where pi-mcp-adapter would delete the entry"
  - id: IN-06
    severity: info
    disposition: deferred
    title: "The rewrapped `withPluginServers` doc comment has a 112-column line"
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
    title: "A kept override overrides the user's later choice: uninstall and plugin disable/enable bring back a stale `disabled: true`"
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
recorded: 2026-10-04T10:18:04.891Z
---

# Phase 02: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| IN-01 | info | deferred | Info, outside the critical_warning fix scope |
| IN-02 | info | deferred | Info, outside the critical_warning fix scope |
| IN-03 | info | deferred | Info, outside the critical_warning fix scope |
| IN-04 | info | deferred | Info; carried to ROADMAP Phase 3 notes (plugin-written carried fields, D-02-22) |
| IN-05 | info | deferred | Info, outside the critical_warning fix scope |
| IN-06 | info | deferred | Info, outside the critical_warning fix scope |
| IN-08 | info | deferred | Info, outside the critical_warning fix scope (not in the current review) |
| IN-09 | info | deferred | Info, outside the critical_warning fix scope (not in the current review) |
| WR-01 | warning | fixed | 02-REVIEW-FIX.md (not in the current review) |
| WR-02 | warning | fixed | 02-REVIEW-FIX.md (not in the current review) |
| WR-04 | warning | fixed | 02-REVIEW-FIX.iter2.md (not in the current review) |
| CR-01 | critical | fixed | 02-REVIEW-FIX.iter2.md (not in the current review) |
| WR-07 | warning | fixed | 02-REVIEW-FIX.iter2.md (not in the current review) |
| WR-05 | warning | fixed | 02-REVIEW-FIX.iter2.md (not in the current review) |
| WR-03 | warning | fixed | 02-REVIEW-FIX.iter2.md (not in the current review) |
| WR-06 | warning | skipped | 02-REVIEW-FIX.iter2.md (not in the current review) |

Finding IDs were reused across the full-phase review (5bfa6baf) and the
gap-closure review, so earlier Info rows were replaced; the earlier ledger
is in git at 7fd15b22.

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.

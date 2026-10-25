---
phase: 17-reconcile-stale-declarer-warning
plan: 01
subsystem: reconcile
tags: [reconcile, load-time-check, notifications, cucumber]
requires: []
provides:
  - "classified `reason` on the declaration walk's failure arm"
  - "`plugin-declarer-unreadable` reconcile outcome rendered as a warning"
affects: [reconcile, dependency-index, output-catalog]
key-files:
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/dependency-verdict.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
    - docs/output-catalog.md
    - features/plugin/reconcile.feature
requirements-completed: [REC-05]
---

# Phase 17 Plan 01: Reconcile stale-declarer warning Summary

A new session now reports an installed plugin whose dependencies it cannot
read as `⊘ <plugin> [<scope>] (failed) {<fault>}` at `warning` severity, with
the cause line `cannot read the dependencies of <key>: <why>`, instead of an
`error` row `{unreadable}` with no cause.

## What changed

- `dependency-index.ts`: the failure arm of both declaration walks carries a
  required `reason: DeclarerReadFailure` (`not in manifest` |
  `invalid manifest` | `unreadable manifest`), picked by the same branch that
  picks the cause phrase (D-05). `ScopeSatisfactionVerdict` forwards it.
- `apply.ts` `reportUnreadableDeclarer` pushes a new
  `plugin-declarer-unreadable` outcome with the token and the walk's cause.
  RECON-04 single-emit is unchanged.
- `notify.ts` renders that outcome as a `failed` row at `warning`, no reload
  (D-02).
- The command target rows (`uninstall`, `marketplace remove`, `update`,
  `reinstall`) keep `{unreadable}` (D-06).
- Output catalog: new state `reconcile-dependency-declarer-unreadable`, with
  its UAT fixture; the catalog-UAT counts move from 291 to 292 states.
- Features: re-pinned the new-session rows in `marketplace/update.feature`
  (two outlines), `marketplace/remove.feature`, `plugin/uninstall.feature`,
  `plugin/update.feature`; two new scenarios in `plugin/reconcile.feature`
  (dropped catalog entry, invalid manifest), each checking a second new
  session reports the same row and the skill stays offered.

## Deviations from Plan

- `plugin/reinstall.feature` had no new-session row to re-pin: its two
  `{unreadable}` rows are reinstall's own target rows, which D-06 keeps.
- After code review (WR-01), the declaration read's refused own manifest
  carries a typed `ownManifest: true` discriminant
  (`dependency-declaration-read.ts`) and maps to `unreadable manifest`; a
  parser-rejected `dependencies` value maps to `invalid manifest`.
- After code review (WR-03), the single-emit check suppresses the warning only
  after a failed or uninstalled row for the plugin, and runs after backfill.
- Added the output-catalog state and fixture, not listed in the plan: the
  catalog documents every reconcile row shape.

## Follow-up: shared marketplace-manifest tokens (D-11)

After the user's decision on review WR-02, a marketplace manifest that fails
to load takes the `narrowProbeError` token (`unparseable`, `invalid manifest`,
`source missing`, `permission denied`, `unreadable`), the same as `list` and
`info`. New reconcile scenario for a malformed-JSON marketplace manifest.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. The cause line is the walk's fixed-phrase `Error` (T-05-04, T-17-01).

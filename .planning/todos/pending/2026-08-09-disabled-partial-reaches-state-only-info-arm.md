---
created: 2026-08-09
resolves_phase: 97
source: 96-REVIEW.md CR-01
---

# A disabled soft-degraded record escapes the disabled carve-out on `info`

`partitionDisabledScopes` (`orchestrators/plugin/info.ts`) routes a scope away
from the state-only arm only when `isRecordedButDisabled(record)` is true, and
that predicate is `record.compatibility.installable && !record.enabled`
(`orchestrators/reconcile/plan.ts`). It therefore returns **false** for a record
that is explicitly disabled but whose install persisted
`compatibility.installable: false` -- any soft-degraded / partially-installed
plugin, e.g. one carrying `unsupported: ["lspServers"]`.

The path is reachable. `enable-disable.ts` places no `installable` guard on the
disable branch: it computes `isCurrentlyDisabled` with the same predicate, so a
soft-degraded record never reads as "already disabled", `runDisableBranch` runs,
every artifact is unstaged, and `toDisabledRecord(...)` is stored --
`enabled: false` with all five `resources.*` arrays emptied.

`info` on such a record, once its manifest entry is gone, now renders:

```text
● mp [user] <no autoupdate>
  ◉ alpha v1.0.0 (partially-installed) {not in manifest, lsp}
```

with `componentsResolved: true` and an empty components map. That is a positive
false claim on a read-only surface: it asserts the plugin is installed AND that
its component inventory was resolved and is genuinely empty, for a plugin whose
artifacts were deliberately unstaged. Before the state-only arm existed the same
input rendered `(failed) {not in manifest}` -- also wrong, but not an
installed-ness claim.

## Why this is deferred to Phase 97, not fixed in Phase 96

The root defect is the predicate, not the new arm. `isRecordedButDisabled` keys
on the `installable` conjunct in four copies, and ENBL-05..09 exist to collapse
them into one predicate keyed only on `enabled`. Repairing it locally inside
`info.ts` would add a fifth divergent copy of the disable test.

The roadmap's INV-04 / ENBL-06 carve-out also forbids pinning the current
partial-disabled rendering as correct, so Phase 96 deliberately adds NO
characterization test asserting today's output.

## What Phase 97 must do

1. Collapse the predicate onto `enabled` alone (ENBL-05), leaving the
   `installable` conjunct only where the reconcile planner genuinely needs it.
2. Widen the guard test. `tests/orchestrators/plugin/info-manifest-absent.test.ts`
   has the test "D-54-01: a manifest-absent DISABLED record still renders the
   (disabled) inventory cascade", which seeds `{ version: "1.0.0",
   disabled: true }`. The fixture factory turns that into `unsupported: []` ->
   `installable: true`, so only the half of the predicate that already works is
   exercised. Add the missing axis: a `disabled: true` **plus**
   `unsupported: ["lspServers"]` record, so the carve-out claim is pinned across
   the whole predicate (ENBL-06).
3. Re-check the sibling consumers of the same predicate (`list.ts`, the
   manifest-backed `info` arm, `reconcile/plan.ts`) for the same half-covered
   guard.

## Files

- `extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts`
  (`isRecordedButDisabled`)
- `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts`
  (`isCurrentlyDisabled`, disable branch)
- `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts`
  (`partitionDisabledScopes`)
- `tests/orchestrators/plugin/info-manifest-absent.test.ts`

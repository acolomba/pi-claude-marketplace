---
phase: 02-caller-stamped-severity-reload-reducer
plan: 03
subsystem: notifications
tags: [arch-test, gate-01, reconcile-projection, runtime-introspection]
dependency_graph:
  requires: [02-01, 02-02]
  provides: [GATE-01-D05-backstop]
  affects: [tests/architecture]
tech_stack:
  added: []
  patterns:
    - "Runtime-introspection arch test (mirrors notify-grammar-invariant.test.ts): drive a production projection, walk its rows, assert a structural invariant"
    - "Drift-proof status set pinned via `as const satisfies readonly PluginStatus[]`"
key_files:
  created:
    - tests/architecture/notify-stamp-coverage.test.ts
  modified: []
decisions:
  - "Drove BOTH exported reconcile projections; only buildReconcileAppliedCascade emits realized-transition rows, so buildReconcilePendingNotification asserts the invariant vacuously (no will-* token is a transition) and guards against future regression into emitting unstamped transition rows."
  - "Used a shared assertTransitionRowsStamped(msg,label) walk returning the transition-row count so each test can additionally assert the sample exercised the stamped path (>=4 transition rows, >=4 failed rows) -- prevents a silently-empty sample passing vacuously."
metrics:
  duration: ~12 min
  completed: 2026-06-24
---

# Phase 2 Plan 03: D-05 reconcile stamp-coverage backstop Summary

Added the GATE-01/D-05 runtime-introspection arch test that closes the one
GATE-01 gap the type system cannot reach: the reconcile projection
(`orchestrators/reconcile/notify.ts`) builds plugin rows directly into a
widening `MarketplaceBlock` accumulator, so a transition push that omits
`severity`/`needsReload` is NOT a compile error there. The test drives both
exported projections and asserts every realized-transition row stamps both
fields with correct D-06 reload semantics.

## What Was Built

- **`tests/architecture/notify-stamp-coverage.test.ts`** (new, test-only):
  - A drift-proof `TRANSITION_STATUS_LIST` (`installed`/`updated`/
    `reinstalled`/`uninstalled`/`disabled`) pinned via
    `as const satisfies readonly PluginStatus[]`, lifted into a
    `ReadonlySet<PluginStatus>` for the membership walk.
  - `APPLIED_OUTCOMES: PerEntryOutcome[]` covering each realized-transition
    kind (install, uninstall, enable->installed, disable), each `*-failed`
    arm, plus a non-transition `mp-added` outcome.
  - A representative `PENDING_PLAN: ReconcilePlan` driving
    `buildReconcilePendingNotification`.
  - Three tests:
    1. `GATE-01/D-05` applied projection: every transition row stamps
       severity + `needsReload:true` (>=4 rows asserted).
    2. `GATE-01/D-06` applied projection: every `failed` row stamps
       `severity:"error"` + `needsReload:false` (>=4 rows asserted).
    3. `GATE-01/D-05` pending projection: emits zero unstamped transition
       rows (the vacuous-but-regression-proof arm).

## Verification

- `node --test tests/architecture/notify-stamp-coverage.test.ts` -> 3 pass.
- `npm run check` (repo root) exits 0: typecheck + ESLint + Prettier +
  2327 unit/arch tests pass (2 skipped, 0 fail) + 16 integration tests pass.
  No known-flaky tests triggered.
- `git diff docs/output-catalog.md` EMPTY; catalog blob OID
  `8f9724c31307e759277b69534918d28a860c54a4` unchanged (test-only addition,
  D-01 output-preserving honored).
- Acceptance greps: `buildReconcileAppliedCascade|buildReconcilePendingNotification`
  count = 8 (>=2); forbidden `Phase 2|Wave ` count = 0; test titles anchored
  GATE-01/D-05/D-06.

## Negative Proof (performed, then reverted -- NOT committed)

Temporarily stripped `needsReload: true` from the `plugin-installed` push in
`orchestrators/reconcile/notify.ts`, ran
`node --test tests/architecture/notify-stamp-coverage.test.ts`, and confirmed
it FAILED with the row-level diagnostic:

```
buildReconcileAppliedCascade: 'installed' transition row for 'new-plugin'
must stamp needsReload (D-05/D-04)
```

Restored the field; re-ran -> 3 pass; `git diff` of `notify.ts` empty. The
stripped state was never staged or committed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Invalid `reason` literals in sample outcomes**
- **Found during:** Task 1 (typecheck gate)
- **Issue:** Initial `*-failed` sample outcomes used `reason: "in use"`, which
  is not a member of the closed-set `REASONS` union (TS2322).
- **Fix:** Replaced both occurrences with the valid literal
  `"permission denied"`; `network unreachable` / `invalid manifest` (already
  valid) kept for the install/enable failure samples.
- **Files modified:** tests/architecture/notify-stamp-coverage.test.ts
- **Commit:** 2d29acc9

**2. [Rule 3 - Blocking] Missing required `ReconcilePlan` bucket fields**
- **Found during:** Task 1 (typecheck gate)
- **Issue:** `PlannedMarketplaceAdd` requires `source` + `configSource` and
  `PlannedPluginInstall` requires `configSource`; the initial PENDING_PLAN
  sample omitted them.
- **Fix:** Added `source: "owner/repo"` + `configSource: "base"` to the add
  entry and `configSource: "base"` to the install entry.
- **Files modified:** tests/architecture/notify-stamp-coverage.test.ts
- **Commit:** 2d29acc9

**3. [Lint] import-order + padding-line-between-statements**
- **Found during:** Task 1 (ESLint gate)
- **Fix:** `eslint --fix` reordered the value import before the type imports
  (with a blank line between groups) and inserted blank lines before
  `return`/block statements per `@stylistic/padding-line-between-statements`.
- **Files modified:** tests/architecture/notify-stamp-coverage.test.ts
- **Commit:** 2d29acc9

## Known Stubs

None. The test drives real production projections over real
internally-constructed sample data; no placeholder/mock data sources.

## Self-Check: PASSED

- FOUND: tests/architecture/notify-stamp-coverage.test.ts
- FOUND commit: 2d29acc9

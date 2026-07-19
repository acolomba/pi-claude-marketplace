---
phase: 68-load-time-backfill
plan: 04
subsystem: api
tags: [reconcile, backfill, version-gate, reinstall, force-install]

# Dependency graph
requires:
  - phase: 68-load-time-backfill
    plan: 01
    provides: "EXTENSION_VERSION constant + persisted lastReconciledExtensionVersion stamp threaded through loadState"
  - phase: 68-load-time-backfill
    plan: 02
    provides: "force-capable reinstallPlugin resolving the installable|unsupported union, persisting the real compatibility set"
  - phase: 68-load-time-backfill
    plan: 03
    provides: "PluginBackfilledOutcome arm + (installed)/(force-installed) cascade projection"
provides:
  - "applyBackfillForScope: version-gated load-time backfill wired into applyReconcile's no-outer-lock apply region"
  - "stamp-on-gate-open: the running version is persisted whenever the gate opened, even with zero promotions"
  - "force-installed re-materialize on supported-set growth, folded into the single reconcile cascade (RECON-04)"
affects: [69-force-path-severity, 70-spec-documentation-reconcile]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Version-stamp gate: scan fires only when lastReconciledExtensionVersion != EXTENSION_VERSION; equal stamp early-returns with no write (RECON-05)"
    - "Read-pass state snapshot threaded onto ScopeReadResult so the backfill gate reads the persisted stamp + scans force-installed plugins without a second locked load"
    - "Strict-superset predicate (supportedSetGrew) gates re-materialize so an unmoved boundary never churns state.json"

key-files:
  created:
    - tests/orchestrators/reconcile/backfill.test.ts
  modified:
    - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
    - tests/orchestrators/reconcile/apply.test.ts

key-decisions:
  - "Gate value comes from the read-pass state snapshot (carried on ScopeReadResult); the stamp + reinstall re-load fresh state under their own locks (CR-01)"
  - "Scan candidates restricted to compatibility.installable === false (D-68-03); re-materialize only when resolved supported set is a STRICT superset of the recorded one"
  - "installable boolean on the PluginBackfilledOutcome derived from resolved.state === 'installable' (full promotion) vs 'unsupported' (partial)"
  - "Pristine scope (no read-pass state) skips backfill entirely so no unsolicited state.json is created (WR-05)"

patterns-established:
  - "Stamp-on-gate-open closes the gate unconditionally when it opened, decoupled from how many plugins were promoted (D-68-03)"

requirements-completed: [BFILL-01, BFILL-02]

# Metrics
duration: 14min
completed: 2026-06-28
---

# Phase 68 Plan 04: Version-Gated Load-Time Backfill Summary

**A force-installed plugin's previously-skipped components now re-materialize automatically at load once the extension supports them: applyReconcile gates a cache-only scan on the lastReconciledExtensionVersion stamp, re-materializes each force-installed plugin whose supported set grew via the force-capable reinstall primitive, folds the promotions into the single reconcile cascade, and stamps the running version whenever the gate opened.**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-06-28T01:52:27Z
- **Completed:** 2026-06-28T02:06:05Z
- **Tasks:** 2
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- `applyBackfillForScope` wired into `applyReconcile`'s per-scope apply region AFTER `applyPlan` and before `rebuildScopeRoutingTableIsolated`, with NO outer lock (CR-01: `reinstallPlugin` and the stamp `withStateGuard` each take their own per-scope lock).
- BFILL-02 version gate: the scan fires only when the persisted `lastReconciledExtensionVersion` differs from `EXTENSION_VERSION` (absent stamp = scan-once, D-68-01). An equal stamp early-returns with no scan and no write, preserving the RECON-05 state.json mtime invariant.
- Stamp-on-gate-open (D-68-03): whenever the gate opened, the running version is persisted UNCONDITIONALLY via `withStateGuard` -> `saveState` (SPLIT-02 / NFR-1) -- even with zero force-installed plugins -- so the gate closes and does not reopen next load.
- BFILL-01 re-materialize: the scan iterates the read-pass snapshot's force-installed plugins (`compatibility.installable === false`), re-resolves each offline (`resolveStrict`, NFR-5), and re-materializes via `reinstallPlugin({ render: "none" })` at the SAME recorded version (D-68-02) only when the resolved supported set is a STRICT superset of the recorded one (D-68-03 -- no churn for an unmoved boundary).
- Promotions fold into the shared `outcomes[]` as `PluginBackfilledOutcome` rows whose `installable` boolean (`resolved.state === "installable"`) selects the `(installed)` full-promotion row vs the `(force-installed)` partial row -- exactly one cascade per invocation (RECON-04), no second notify.
- Threaded the read-pass `ExtensionState` snapshot onto `ScopeReadResult` so the gate reads the persisted stamp + scans candidates without a second locked load; a pristine scope (no snapshot) skips backfill so no unsolicited state.json is created (WR-05).

## Task Commits

1. **Task 1: Version gate + stamp-on-gate-open, wired into the per-scope apply region** - `9b582097` (feat)
2. **Task 2: Per-plugin scan, re-materialize via reinstall, fold promotion rows into the cascade** - `8eca3e7f` (feat)

_TDD: each task wrote failing tests first (RED), then the implementation (GREEN). Task 1's `applyBackfillForScope` took no `outcomes` parameter (gate + stamp only) so the split stayed lint-clean; Task 2 added the parameter when it began pushing rows._

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts` - Added `applyBackfillForScope` (gate + stamp), `scanForceInstalledBackfills`, `maybeBackfillPlugin`, `resolveRecordedPluginOffline`, `supportedSetGrew`; threaded the state snapshot onto `ScopeReadResult`; wired the call into the scope loop.
- `tests/orchestrators/reconcile/backfill.test.ts` - New integration test file: gate fire/absent/skip+mtime, stamp-on-gate-open-zero-plugins-silent, full promotion, partial re-materialize, no-grow skip, RECON-04 combined backfill+install single cascade, NFR-5 no-network.
- `tests/orchestrators/reconcile/apply.test.ts` - Updated the RECON-05 back-to-back-no-op test to seed the CURRENT extension-version stamp (gate closed = true steady state) so its byte-stability assertion holds.

## Decisions Made

- **Gate value from the read-pass snapshot, mutations under fresh locks** - the gate compares `readResult.state.lastReconciledExtensionVersion` (the unmutated read-pass snapshot) against `EXTENSION_VERSION`, while `reinstallPlugin` and the stamp `withStateGuard` re-load fresh state under their own per-scope locks (CR-01: proper-lockfile is not re-entrant, so no outer lock).
- **Strict-superset growth predicate** - `supportedSetGrew` requires the resolved supported set to contain every recorded kind AND be strictly larger, so a force-installed plugin whose boundary did not move is skipped (no reinstall, no row, no state churn).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test interaction] Updated the pre-existing RECON-05 no-op test to seed the current stamp**
- **Found during:** Task 2 (`npm run check`).
- **Issue:** `tests/orchestrators/reconcile/apply.test.ts`'s RECON-05 back-to-back-no-op test seeded state.json WITHOUT a stamp. With backfill wired in, the first `applyReconcile` legitimately opens the gate (absent stamp) and writes the stamp once, so the test's "state.json bytes unchanged across runs" assertion broke.
- **Fix:** Seeded the state with `lastReconciledExtensionVersion: EXTENSION_VERSION` so the gate is closed -- the true steady state the test intends to verify. The one-time gate-close write is correct BFILL-02 behavior, not WR-05 churn.
- **Files modified:** tests/orchestrators/reconcile/apply.test.ts
- **Verification:** `npm run check` green (modulo the documented concurrency flake confirmed green in isolation).
- **Committed in:** 8eca3e7f (Task 2 commit)

**Total deviations:** 1 auto-fixed (1 test-interaction). No production-code deviations; `apply.ts` matched the plan's intended shape.

## Issues Encountered

- `npm run check` surfaced the documented full-concurrency flake `tests/architecture/hooks-exec.test.ts` (`Block F / D-60-06`) with `ENOTEMPTY` during temp-dir cleanup. Re-ran the file in isolation: 22/22 green. Not a regression and not in this plan's touched files.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- BFILL-01 / BFILL-02 are delivered: a force-installed plugin's previously-skipped components re-materialize automatically at load, offline, at the same recorded version, with no manual command and no upgrade.
- Phase 69 will stamp the final force-path severity onto the `(force-installed)` backfill row (the row currently carries the `info` sensible default from 68-03); Phase 70 freezes the byte-exact promotion-row token. Both are intentionally deferred per D-68-04.
- No blockers.

## Self-Check: PASSED

---
*Phase: 68-load-time-backfill*
*Completed: 2026-06-28*

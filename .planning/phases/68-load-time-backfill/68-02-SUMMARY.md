---
phase: 68-load-time-backfill
plan: 02
subsystem: api
tags: [reinstall, resolver, force-install, compatibility, typebox]

# Dependency graph
requires:
  - phase: 64-resolver-three-way-state
    provides: requireForceInstallable gate + MaterializablePlugin union
  - phase: 67-list-filters-completion-reinstall-repair
    provides: unconditional always-overwrite reinstall primitive
provides:
  - Force-capable reinstall primitive resolving the installable|unsupported union
  - Real compatibility set persisted on reinstall (installable flag + supported/unsupported)
  - RINST-01 repair-primitive expansion (reinstall now succeeds on a force-installed plugin)
affects: [68-04-backfill-scan, load-time-reconcile]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single sanctioned re-materialize path widened to the force-capable union for reuse by backfill"
    - "Persisted compatibility record mirrors the resolve state.tag, never a hardcoded literal"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
    - tests/orchestrators/plugin/reinstall.test.ts
    - extensions/pi-claude-marketplace/domain/resolver.ts

key-decisions:
  - "Re-typed all threaded installable fields (handles, hooks args, updateStateRecord, resourcesFromHandles) to MaterializablePlugin since both arms share an identical payload shape"
  - "Recorded compatibility.installable as installable.state === 'installable' so a partial re-materialize stays force-installed (D-66-01 derivation source) and a full one promotes"

patterns-established:
  - "Reinstall/backfill is a repair/promotion: SAME recorded version, cache-only resolve (NFR-5)"

requirements-completed: [BFILL-01]

# Metrics
duration: ~18min
completed: 2026-06-27
---

# Phase 68 Plan 02: Force-Capable Reinstall Primitive Summary

**Reinstall now resolves the installable|unsupported union through requireForceInstallable and persists the real compatibility set, unblocking backfill re-materialization of force-installed plugins.**

## Performance

- **Duration:** ~18 min
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Swapped the reinstall resolve gate from `requireInstallable` to `requireForceInstallable`, so reinstalling a plugin that re-resolves `unsupported` no longer throws `{not-installable}` and returns a `reinstalled` outcome.
- Re-typed the threaded `installable` fields (prepare handles, hooks args, `updateStateRecord` param, `resourcesFromHandles` param) to the `MaterializablePlugin` union, which threads cleanly through the Phase 65 bridges (no bridge changes needed).
- Replaced the hardcoded `compatibility.installable: true` with `installable.state === "installable"`, so a partial re-materialize persists `installable: false` plus the real non-empty `unsupported` set at the SAME recorded version (D-68-02 promotion, not upgrade).
- Added tests for the force-installed success path, the partial record (non-empty unsupported, same version), and the full record (installable:true, empty unsupported).

## Task Commits

1. **Task 1: Swap reinstall resolve to the force-capable gate and re-type threaded fields** - `81380b37` (feat)
2. **Task 2: Record the real compatibility set + update force-installed reinstall assertion** - `7e9eb4ae` (feat)

_TDD: each task wrote the failing test first; the gate swap and record fix were the GREEN steps._

## Files Created/Modified
- `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts` - Force-capable resolve gate; threaded fields re-typed to `MaterializablePlugin`; `updateStateRecord` records the real compatibility set.
- `tests/orchestrators/plugin/reinstall.test.ts` - Added BFILL-01/RINST-01/D-68-02 tests (force-installed success, partial record, full record).
- `extensions/pi-claude-marketplace/domain/resolver.ts` - Updated the `requireForceInstallable` doc note to cite its first production caller (reinstall).

## Decisions Made
- Re-typed `resourcesFromHandles`'s `installable?` parameter (plan listed ~1276/~1381/~1421) since it is called with the now-`MaterializablePlugin` value and only reads `hooksConfigPath`, which exists on both union arms.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Stale doc] Updated requireForceInstallable note in resolver.ts**
- **Found during:** Task 1 (gate swap)
- **Issue:** The `requireForceInstallable` JSDoc claimed "this gate has no production caller yet" -- the gate swap makes reinstall its first production caller, so the note became factually wrong.
- **Fix:** Rewrote the note to cite the reinstall caller (BFILL-01) instead of "no production caller yet".
- **Files modified:** extensions/pi-claude-marketplace/domain/resolver.ts
- **Verification:** Typecheck + full check green; ASCII-only, anchored on BFILL-01.
- **Committed in:** 81380b37 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 stale doc).
**Impact on plan:** Minimal -- a one-line comment correction directly caused by the gate swap. No behavior change, no scope creep.

## Issues Encountered
- `npm run check` surfaced one unrelated flake: `tests/architecture/hooks-exec.test.ts` "Block F / D-60-06 registerHooksBridge twice" failed with `ENOTEMPTY` during concurrent temp-dir cleanup (same known full-concurrency flake category). Re-ran the file in isolation -> 22/22 green. Not a regression; the touched files are unrelated.

## Next Phase Readiness
- The single sanctioned force-capable re-materialize path is in place; plan 68-04 (backfill scan) can reuse `reinstallPlugin` to re-materialize force-installed plugins and persist the shrinking unsupported set.
- No blockers.

## Self-Check: PASSED

- SUMMARY file present.
- Both task commits present (81380b37, 7e9eb4ae).

---
*Phase: 68-load-time-backfill*
*Completed: 2026-06-27*

---
phase: 08-atomic-reinstall-core
plan: 04
subsystem: orchestrators
tags: [reinstall, orchestrator, rollback, cached-manifest, no-network]

# Dependency graph
requires:
  - phase: 08-atomic-reinstall-core
    provides: rollback-safe bridge replacement helpers and lock-held manual-save state transaction
provides:
  - single-plugin reinstall orchestrator using cached manifests only
  - version-preserving reinstall state mutation
  - rollback-protected replacement across skills, commands, agents, MCP, and state save
  - warning-only completion-cache and plugin-data cleanup handling
affects: [09-reinstall-edge-bulk-ux, reinstall, plugin-orchestrators, command-routing]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - dedicated reinstall core instead of uninstall-plus-install or update wrapper
    - lock-held physical replacement followed by explicit tx.save and rollback-on-save-failure
    - failed outcomes returned after notifyError for deterministic Phase 9 batch partitioning
    - test-only dependency seams for transaction, cache, and data-cleanup failure injection

key-files:
  created:
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
    - tests/orchestrators/plugin/reinstall.test.ts
    - .planning/phases/08-atomic-reinstall-core/08-04-SUMMARY.md
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/index.ts
    - extensions/pi-claude-marketplace/orchestrators/index.ts
    - extensions/pi-claude-marketplace/orchestrators/types.ts

key-decisions:
  - "Reinstall is a dedicated single-plugin core because install rejects existing records, uninstall removes old resources first, and update imports Git/network refresh machinery."
  - "withLockedStateTransaction plus explicit tx.save creates the rollback boundary for state-persistence failures after physical resource replacement."
  - "Reinstall returns failed outcomes after notifyError so Phase 9 batch reinstall can partition failures deterministically."
  - "Test-only __deps seams cover state save, cache invalidation, and data cleanup failures without production-only hacks."

patterns-established:
  - "Single-plugin reinstall reads only the cached manifest path from state and preserves oldRecord.version rather than recomputing or upgrading."
  - "Resource replacement prepares all bridge handles before mutating targets, replaces skills -> commands -> agents -> MCP, and rolls back MCP -> agents -> commands -> skills."
  - "Post-success cleanup is outside the atomic commit boundary: cache and plugin-data cleanup failures warn but do not change the reinstalled outcome."

requirements-completed: [PRL-02, PRL-06, PRL-07, PRL-08, PRL-09, PRL-10, PRL-11, PRL-12]

# Metrics
duration: 23min
completed: 2026-05-14
---

# Phase 08: Plan 04 Summary

**Cached-manifest single-plugin reinstall core with version preservation, rollback-protected bridge replacement, and warning-only post-success cleanup**

## Performance

- **Duration:** 23 min
- **Started:** 2026-05-14T00:37:10Z
- **Completed:** 2026-05-14T01:00:40Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- Added `reinstallPlugin` and Phase-9-ready reinstall outcome types, exported through the plugin and top-level orchestrator barrels.
- Implemented installed-only cached-manifest preflight with no Git/network dependency, self-exempt cross-plugin conflict checks, and old installed-record version preservation.
- Composed skills, commands, agents, and MCP replacement helpers under `withLockedStateTransaction` so replacement and state-save failures restore old state, resources, indexes, MCP entries, and plugin data.
- Added post-success completion-cache invalidation and plugin data-directory deletion as warning-only maintenance after state commit.
- Added focused orchestrator tests for skipped/not-installed, manifest/preflight failure, version preservation, replacement rollback, save-failure rollback, rollback failure manual-recovery wording, force-mode agent restoration, reload hints, soft-dependency warnings, and warning-only cleanup failures.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create reinstall orchestrator API and preflight** - `dcd726c` (feat)
2. **Task 2: Implement atomic replacement, state save, and rollback** - `dcd726c` (feat)
3. **Task 3: Add post-success cache, data cleanup, notifications, and final exports** - `dcd726c` (feat)

_Note: Plan 08-04 landed as one implementation commit covering all three tightly-coupled orchestrator tasks._

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts` - Implements `reinstallPlugin`, installed-only preflight, cached-manifest resolution, rollback-protected bridge replacement, explicit state save, warnings, reload hints, soft-dependency notices, and data cleanup.
- `extensions/pi-claude-marketplace/orchestrators/plugin/index.ts` - Exports the reinstall orchestrator API from the plugin barrel.
- `extensions/pi-claude-marketplace/orchestrators/index.ts` - Re-exports reinstall APIs from the top-level orchestrator barrel for Phase 9 edge wiring.
- `extensions/pi-claude-marketplace/orchestrators/types.ts` - Adds shared reinstall partition and outcome types.
- `tests/orchestrators/plugin/reinstall.test.ts` - Adds PRL-02/06/07/08/09/10/11/12 focused orchestrator coverage.

## Decisions Made

- Implemented reinstall as a dedicated single-plugin core rather than wrapping uninstall/install or update. Install rejects existing records, uninstall removes old resources before replacement, and update owns Git/network refresh semantics that PRL-07 forbids for reinstall.
- Used `withLockedStateTransaction` with an explicit `await tx.save()` because reinstall must roll back physical resource swaps if state persistence fails after the swaps succeed.
- Kept the version policy pinned to `oldRecord.version`; `reinstallPlugin` does not call `resolvePluginVersion` or compute content hashes.
- Returned `ReinstallPluginOutcome` for skipped, failed, and reinstalled paths. Failed paths still notify through `notifyError`, but the structured outcome gives Phase 9 deterministic batch partitions.
- Added test-only `__deps` seams for state transaction, cache invalidation, and data cleanup failure injection so rollback and warning-only paths are directly testable.
- Left bridge-specific policy in the bridges: MCP collision behavior stays MCP-owned, and force/foreign-agent restoration stays agents-owned.

## Deviations from Plan

None - plan executed as specified. The only consolidation was committing the three closely-related tasks together in `dcd726c` after focused and full verification passed.

## Issues Encountered

None during final implementation. Verification was green for focused, phase-relevant, and full-suite commands before documentation closeout.

## User Setup Required

None - no external service configuration required.

## Verification

- `node --test tests/orchestrators/plugin/reinstall.test.ts tests/architecture/no-orchestrator-network.test.ts` - passed, 9/9 tests.
- `node --test "tests/{architecture,bridges,orchestrators,transaction}/**/*.test.ts"` - passed, 405/405 tests.
- `npm run check` - passed, 867 tests.

## Next Phase Readiness

Phase 8 now provides the atomic single-plugin primitive Phase 9 needs. The edge/bulk phase can route `/claude:plugin reinstall` forms to `reinstallPlugin`, aggregate `reinstalled` / `skipped` / `failed` partitions, and rely on the core to preserve old installs for each per-plugin failure.

## Self-Check: PASSED

- `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts` exports `reinstallPlugin` and does not call `resolvePluginVersion`.
- The no-network architecture guard covers `reinstall.ts` and passes.
- Tests prove old state/resources/data survive preflight, replacement, and state-save failures.
- Tests prove successful reinstall deletes plugin data only after commit and treats cleanup/cache failures as warnings.

---
*Phase: 08-atomic-reinstall-core*
*Completed: 2026-05-14*

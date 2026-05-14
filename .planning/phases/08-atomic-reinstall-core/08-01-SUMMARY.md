---
phase: 08-atomic-reinstall-core
plan: 01
subsystem: transaction
tags: [state-lock, transaction, reinstall, architecture-guard, node-test]

# Dependency graph
requires:
  - phase: 07-integration-pi-wiring
    provides: per-scope .state-lock semantics via withStateGuard
provides:
  - lock-held manual-save state transaction helper for reinstall rollback
  - no-network architecture guard coverage for future reinstall orchestrator
affects: [08-atomic-reinstall-core, reinstall, transaction, architecture-tests]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - proper-lockfile-backed manual transaction with explicit tx.save()
    - source-grep architecture guard for cached-manifest-only orchestrators

key-files:
  created:
    - .planning/phases/08-atomic-reinstall-core/08-01-SUMMARY.md
  modified:
    - extensions/pi-claude-marketplace/transaction/with-state-guard.ts
    - tests/transaction/with-state-guard.test.ts
    - tests/architecture/no-orchestrator-network.test.ts

key-decisions:
  - "withLockedStateTransaction reuses the exact withStateGuard lock acquisition options but does not auto-save after the callback."
  - "The reinstall no-network guard lands before reinstall.ts exists and skips ENOENT targets until later plans create the file."

patterns-established:
  - "Manual-save state transactions expose { state, save } so orchestrators can rollback physical resources when explicit state persistence fails."
  - "Network-free orchestrator architecture guards include future files early with ENOENT skip behavior."

requirements-completed: [PRL-07, PRL-10]

# Metrics
duration: 10min
completed: 2026-05-14
---

# Phase 08: Plan 01 Summary

**Lock-held manual-save state transaction helper plus reinstall no-network architecture guard**

## Performance

- **Duration:** 10 min
- **Started:** 2026-05-13T23:59:48Z
- **Completed:** 2026-05-14T00:05:47Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Added `withLockedStateTransaction`, `LockedStateTransaction`, and `LockedStateTransactionDeps` to hold the existing per-scope `.state-lock` while callers explicitly decide when to call `tx.save()`.
- Added Phase 8 / PRL-10 tests proving manual transaction state is not written before `tx.save()`, the proper-lockfile lock is held during callback execution, save failures release the lock, and callback failures leave `state.json` unchanged.
- Extended the no-network architecture guard so future `orchestrators/plugin/reinstall.ts` must not import Git/network surfaces or reference `refreshGitHubClone`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add lock-held manual-save transaction helper** - `edf0487` (feat)
2. **Task 2: Extend no-network architecture guard for reinstall** - `420cadc` (test)

## Files Created/Modified

- `extensions/pi-claude-marketplace/transaction/with-state-guard.ts` - Exports `withLockedStateTransaction` using the same lock acquisition semantics as `withStateGuard` while requiring explicit `tx.save()`.
- `tests/transaction/with-state-guard.test.ts` - Adds four Phase 8 / PRL-10 tests for manual-save behavior and lock release after failures.
- `tests/architecture/no-orchestrator-network.test.ts` - Adds `reinstall.ts` to guarded network-free orchestrator targets and adds a `refreshGitHubClone` forbidden pattern.

## Decisions Made

- Reused a private `acquireStateLock()` helper to keep `withStateGuard` and `withLockedStateTransaction` lock options identical.
- Kept the architecture guard ENOENT-tolerant so Plan 01 can land before Plan 04 creates `reinstall.ts`.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Initial Task 1 commit was blocked by ESLint's `@typescript-eslint/require-await` on the injected `saveState` test double. Replaced the async throwing function with `Promise.reject(...)`, reran focused tests, and committed successfully.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Wave 2 bridge replacement plans can now import the manual transaction helper later through the reinstall orchestrator. The no-network guard is already active for `reinstall.ts` once Plan 04 creates it.

## Self-Check: PASSED

- `node --test tests/transaction/with-state-guard.test.ts tests/architecture/no-orchestrator-network.test.ts` exits 0.
- `extensions/pi-claude-marketplace/transaction/with-state-guard.ts` contains `export async function withLockedStateTransaction`.
- `tests/architecture/no-orchestrator-network.test.ts` contains `orchestrators/plugin/reinstall.ts` and `refreshGitHubClone reference`.

---
*Phase: 08-atomic-reinstall-core*
*Completed: 2026-05-14*

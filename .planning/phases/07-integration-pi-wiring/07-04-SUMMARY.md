---
phase: 07-integration-pi-wiring
plan: 04
subsystem: integration
tags: [concurrency, proper-lockfile, state-guard, integration-tests, tdd]

requires:
  - phase: 07-integration-pi-wiring
    provides: [pi-api-wrapper, real-install-orchestrator, resources-discover-entrypoint]
provides:
  - Cross-process per-scope lock around withStateGuard load-mutate-save
  - Stable StateLockHeldError and STATE_LOCK_HELD_PREFIX lock-contention contract
  - Multi-process concurrent install integration coverage for same-scope races
affects: [phase-7-integration, plugin-install, retry-safety, state-persistence]

tech-stack:
  added: [proper-lockfile, "@types/proper-lockfile"]
  patterns:
    - Per-scope proper-lockfile lock on extensionRoot with explicit .state-lock sentinel
    - IPC child-process integration tests for real orchestrator race behavior

key-files:
  created:
    - tests/integration/concurrent-install.test.ts
    - tests/integration/concurrent-install-child.ts
  modified:
    - package.json
    - package-lock.json
    - extensions/claude-marketplace/persistence/locations.ts
    - extensions/claude-marketplace/transaction/with-state-guard.ts
    - extensions/claude-marketplace/shared/errors.ts
    - extensions/claude-marketplace/shared/markers.ts
    - tests/transaction/with-state-guard.test.ts
    - tests/architecture/markers-snapshot.test.ts

key-decisions:
  - "withStateGuard now owns cross-process safety by taking the per-scope .state-lock before loading state and releasing it after save or failure."
  - "Lock contention fails fast with StateLockHeldError and the stable STATE_LOCK_HELD_PREFIX user-contract marker rather than waiting."
  - "Concurrent install verification uses forked IPC child processes that call the real installPlugin path, not stdout parsing."

patterns-established:
  - "State mutation critical section: lock extensionRoot with lockfilePath locations.stateLockFile, realpath false, retries 0, stale 10000, update 2000."
  - "Race integration tests synchronize forked children with a ready/start IPC handshake and assert state/disk post-conditions."

requirements-completed: [NFR-3]

duration: 11 min
completed: 2026-05-11
---

# Phase 07 Plan 04: Cross-Process State Locking Summary

**Retry-safe plugin installs via per-scope proper-lockfile locking and multi-process race verification**

## Performance

- **Duration:** 11 min
- **Started:** 2026-05-11T20:15:40Z
- **Completed:** 2026-05-11T20:27:20Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments

- Added `proper-lockfile` runtime support and a typed `.state-lock` path on `ScopedLocations`.
- Added `STATE_LOCK_HELD_PREFIX` plus `StateLockHeldError` so lock contention surfaces as a stable fail-fast user contract.
- Wrapped `withStateGuard` around the full load-mutate-save critical section, including release on mutate and save failures.
- Added forked-process integration coverage proving concurrent same-scope installs leave exactly one state record and matching disk resources.

## Task Commits

Each TDD task was committed atomically:

1. **Task 1 RED: state lock primitive tests** - `8ee11e3` (test)
2. **Task 1 GREEN: state lock primitive** - `d9f33e3` (feat)
3. **Task 2 RED: state guard lock tests** - `9b25bee` (test)
4. **Task 2 GREEN: locked state guard** - `ab82046` (feat)
5. **Task 3 RED: concurrent install integration test** - `6f0fec2` (test)
6. **Task 3 GREEN: IPC child race driver** - `3835ff2` (feat)

**Plan metadata:** included in final docs commit.

## Files Created/Modified

- `package.json` / `package-lock.json` - Add `proper-lockfile` and its type package.
- `extensions/claude-marketplace/persistence/locations.ts` - Adds the per-scope `.state-lock` sentinel path.
- `extensions/claude-marketplace/shared/markers.ts` - Adds the Phase 7 lock-held marker prefix.
- `extensions/claude-marketplace/shared/errors.ts` - Adds `StateLockHeldError` with scope and lock-path details.
- `extensions/claude-marketplace/transaction/with-state-guard.ts` - Acquires and releases the cross-process lock around state mutation.
- `tests/architecture/markers-snapshot.test.ts` - Snapshots the new marker and state-lock path.
- `tests/transaction/with-state-guard.test.ts` - Covers held lock, lock contention, and release after mutate/save failures.
- `tests/integration/concurrent-install.test.ts` - Verifies same-plugin and different-plugin same-scope install races.
- `tests/integration/concurrent-install-child.ts` - IPC child module invoking the real `installPlugin` path.

## Decisions Made

- Used `locations.stateLockFile` as a readonly field rather than an async helper so lock setup stays synchronous with the existing `ScopedLocations` shape.
- Ensured `withStateGuard` creates `locations.extensionRoot` before locking; this keeps first install into a fresh scope from failing before state exists.
- Kept integration child reporting on IPC only; stdout/stderr are ignored by the parent and not part of the assertion contract.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Ensure extension root exists before locking**
- **Found during:** Task 2 (locked `withStateGuard` implementation)
- **Issue:** `proper-lockfile.lock(locations.extensionRoot, ...)` requires the lock target directory to exist. A fresh scope might not have `<scopeRoot>/claude-marketplace/` yet.
- **Fix:** Added `mkdir(locations.extensionRoot, { recursive: true })` before lock acquisition.
- **Files modified:** `extensions/claude-marketplace/transaction/with-state-guard.ts`
- **Verification:** `node --test tests/transaction/with-state-guard.test.ts` and `npm run typecheck` passed.
- **Committed in:** `ab82046`

**2. [Rule 1 - Bug] Prevent forked integration tests from hanging after child results**
- **Found during:** Task 3 (concurrent install integration test)
- **Issue:** Child processes could send their result before the parent attached result listeners, and successful children kept IPC open after sending.
- **Fix:** Registered result promises before sending start messages and disconnected the child process after `process.send` completed.
- **Files modified:** `tests/integration/concurrent-install.test.ts`, `tests/integration/concurrent-install-child.ts`
- **Verification:** `node --test tests/integration/concurrent-install.test.ts` and `npm run test:integration -- tests/integration/concurrent-install.test.ts` passed.
- **Committed in:** `3835ff2`

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 bug)
**Impact on plan:** Both fixes were required for correct first-run locking and stable automated race verification. No scope creep.

## Issues Encountered

- Prettier hooks reformatted `errors.ts` and the new integration files during commit attempts; files were re-staged and committed with hooks enabled.
- `npm run test:integration -- tests/integration/concurrent-install.test.ts` invokes the script glob plus the explicit file argument, but Node deduplicates the single matching test file and the suite passes.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None. Stub-pattern scan found only local test accumulator initializers, null checks, and existing comments about PRD placeholders; no runtime stubs were introduced.

## Threat Flags

None. The new lockfile trust boundary and state mutation race are covered by the plan threat model T-07-01 and T-07-02.

## TDD Gate Compliance

- RED commits present: `8ee11e3`, `9b25bee`, `6f0fec2`
- GREEN commits present after RED: `d9f33e3`, `ab82046`, `3835ff2`
- REFACTOR commits: not needed

## Next Phase Readiness

Plan 07-05 can build on retry-safe same-scope installs. Mutating operations routed through `withStateGuard` now fail fast when another process owns the scope lock, and the integration test proves state records and staged disk resources remain aligned after races.

## Verification

- `node --test tests/transaction/with-state-guard.test.ts tests/architecture/markers-snapshot.test.ts` passed (17 tests).
- `npm run test:integration -- tests/integration/concurrent-install.test.ts` passed (2 tests).
- `npm run typecheck` passed.

## Self-Check: PASSED

- Found `tests/integration/concurrent-install.test.ts`.
- Found `tests/integration/concurrent-install-child.ts`.
- Found `extensions/claude-marketplace/transaction/with-state-guard.ts`.
- Found commits `8ee11e3`, `d9f33e3`, `9b25bee`, `ab82046`, `6f0fec2`, and `3835ff2`.
- Verified plan-level transaction, marker, integration, and typecheck commands completed successfully.

---
*Phase: 07-integration-pi-wiring*
*Completed: 2026-05-11*

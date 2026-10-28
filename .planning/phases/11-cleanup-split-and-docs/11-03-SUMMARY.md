---
phase: 11-cleanup-split-and-docs
plan: "03"
subsystem: orchestrator-test-support
tags: [typescript, state-locks, tests, cleanup]
requires:
  - phase: 11-cleanup-split-and-docs
    plan: "02"
    provides: first-wave cleanup baseline
provides:
  - One release-safe state-lock fixture for lifecycle owner tests
  - One canonical lock-held cause formatter for marketplace row assertions
affects: [marketplace-add, marketplace-remove, mcp-migration, dependency-bindings, clone-gc]
actuals:
  tokens: 3365
  tasks: 2
  commits: 2
plan_head_before: 2704a6f57dbb834fa7bc7a11d8e6d22fc8fcf5c6
plan_head_after: bef9e97779526d6fee84f7a958593d24d01d341d
tech-stack:
  added: []
  patterns:
    - Test lock fixtures expose action-scoped, explicit-release, and test-context lifetimes from one module.
key-files:
  created:
    - .planning/phases/11-cleanup-split-and-docs/11-03-RED.json
    - test/orchestrators/state-lock.ts
  modified:
    - test/orchestrators/marketplace/add.test.ts
    - test/orchestrators/marketplace/remove.test.ts
    - test/orchestrators/reconcile/mcp-migration.test.ts
    - test/orchestrators/plugin/dependency-bindings.test.ts
    - test/orchestrators/plugin/clone-gc.test.ts
key-decisions:
  - Keep shared test support under test/orchestrators because project rules forbid generic test/helpers directories.
  - Keep explicit release callbacks available where a test must release the lock before invoking a deferred sweep.
patterns-established:
  - Shared state-lock test support preserves proper-lockfile options and releases through finally or TestContext.after.
requirements-completed: [CLN-01]
coverage:
  - id: D1
    description: Marketplace add and remove use one action-scoped lock fixture and one held-lock cause formatter without changing failure rows.
    requirement: CLN-01
    verification:
      - kind: unit
        ref: test/orchestrators/marketplace/add.test.ts and test/orchestrators/marketplace/remove.test.ts FLR-02 cases
        status: pass
    human_judgment: false
  - id: D2
    description: Reconcile migration registers lock release with the test context while dependency and clone tests retain explicit release control.
    requirement: CLN-01
    verification:
      - kind: unit
        ref: test/orchestrators/reconcile/mcp-migration.test.ts, test/orchestrators/plugin/dependency-bindings.test.ts, and test/orchestrators/plugin/clone-gc.test.ts
        status: pass
    human_judgment: false
  - id: D3
    description: Static checks accept the shared fixture and all migrated test imports.
    requirement: CLN-01
    verification:
      - kind: other
        ref: npm run check:static
        status: pass
    human_judgment: false
duration: 26min
completed: 2026-10-28
status: complete
---

# Phase 11 Plan 03: Shared State-Lock Test Fixture Summary

**Lifecycle owner tests now acquire the real state lock through one fixture that preserves lock options, row text, and each caller's release lifetime.**

## Performance

- **Duration:** 26 min
- **Completed:** 2026-10-28T00:50:46Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Replaced the duplicate marketplace add and remove action wrappers and cause formatters with shared test support.
- Replaced three more local lock-acquisition helpers while preserving test-context cleanup and explicit release callbacks.
- Kept every lock path inside existing hermetic scope fixtures and left production code unchanged.

## TDD Gate Compliance

### RED

The shared action wrapper initially ran marketplace add without acquiring the state lock. The existing FLR-02 owner test then failed on its unchanged notification-row assertion: it observed a source-missing row instead of the expected lock-held rows. `.planning/phases/11-cleanup-split-and-docs/11-03-RED.json` preserves the complete TAP report. The GSD classifier returned `RED_EVIDENCE_OK`, and semantic inspection confirmed that only the named owner test ran and failed for the planned reason.

### GREEN

`whileStateLockHeld` now acquires the real lock through `holdStateLock` and releases it in `finally`. The marketplace owner tests passed with their existing rows, including the canonical cause text.

### REFACTOR

The reconcile migration uses `holdStateLockForTest`, while dependency bindings and clone garbage collection import `holdStateLock` for their explicit release points. No local acquisition helper remains in the five migrated modules.

## Task Commits

1. **Task 1: Centralize the marketplace state-lock fixture** - `949bd147` (`refactor`)
2. **Task 2: Reuse the fixture in reconcile and plugin tests** - `bef9e977` (`refactor`)

The commit hook runs the staged test selection, so it cannot accept an intentionally broken extraction seam. The validated RED evidence is committed with the completed fixture instead of bypassing the hook.

## Files Created/Modified

- `.planning/phases/11-cleanup-split-and-docs/11-03-RED.json` - Preserves the machine-validated owner-test failure.
- `test/orchestrators/state-lock.ts` - Owns the shared lock acquisition, release lifetimes, and cause formatting.
- `test/orchestrators/marketplace/add.test.ts` - Uses the shared action wrapper and cause formatter.
- `test/orchestrators/marketplace/remove.test.ts` - Uses the shared action wrapper and cause formatter.
- `test/orchestrators/reconcile/mcp-migration.test.ts` - Registers cleanup through the shared test-context fixture.
- `test/orchestrators/plugin/dependency-bindings.test.ts` - Uses the shared explicit-release fixture.
- `test/orchestrators/plugin/clone-gc.test.ts` - Uses the shared explicit-release fixture while keeping its lock-state probe.

## Decisions Made

- Kept the fixture in the orchestrator test concern. The project unit-test rules explicitly forbid a generic `test/helpers/` directory.
- Kept the cause formatter scope-aware through `locations.scope`. All migrated assertions use project scope, so their bytes remain unchanged.
- Kept three small lifetime forms in one module: explicit release, test-context release, and action-scoped release.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Project constraint] Used concern-local test support instead of `test/helpers/`**

- **Found during:** Task 1 skill review and commit verification
- **Issue:** The plan named `test/helpers/state-lock.ts` and a paired meta-test, but the project unit-test rules forbid `test/helpers/` and say test support does not receive meta-tests. The corresponding-test gate rejected the standalone helper test.
- **Fix:** Created `test/orchestrators/state-lock.ts` and proved its behavior through the existing paired marketplace owner tests.
- **Files modified:** `test/orchestrators/state-lock.ts`, `test/orchestrators/marketplace/add.test.ts`, and `test/orchestrators/marketplace/remove.test.ts`
- **Verification:** The FLR-02 owner cases, `npm run check:static`, and the commit hook passed.
- **Committed in:** `949bd147`

**2. [Rule 3 - Workflow constraint] Committed RED evidence with the passing extraction**

- **Found during:** Task 1 commit preparation
- **Issue:** The repository hook runs staged tests and forbids a commit that leaves the owner test failing. Skipping the hook is forbidden.
- **Fix:** Preserved and classified the RED report before completing the fixture, then committed both through the required hook.
- **Files modified:** `.planning/phases/11-cleanup-split-and-docs/11-03-RED.json` and the Task 1 test files
- **Verification:** The evidence classifier returned `RED_EVIDENCE_OK`; the final hook passed.
- **Committed in:** `949bd147`

**Total deviations:** 2 auto-fixed (1 Rule 2, 1 Rule 3)
**Impact on plan:** The location and dedicated meta-test changed to satisfy project policy. The release-safe behavior, canonical cause formatting, hermetic paths, and migrated owner coverage match the plan.

## Issues Encountered

- CodeGraph could not open its database in this worktree, so narrow `rg` and file reads supplied the symbol trace before edits.
- The marketplace add owner module has an existing Unix-domain socket test. Its first sandboxed run failed with `EPERM`; the approved unrestricted rerun passed all 258 selected tests.
- The assigned worktree is outside the session's default writable root, so caches, hooks, staging, and commits required the approved worktree permission.

## Verification

- Marketplace helper tracer selection: 252 passed, 0 failed.
- Reconcile and plugin owner modules: 3 files passed, 0 failed.
- `npm run check:static`: passed typecheck, lint, workflow lint, Fallow, format, pairing, and feature checks.
- Fallow guards and changed-file audits: passed for both task commits.
- Repository commit hooks, including `npm run check:commit`: passed for both task commits.

## Known Stubs

None.

## User Setup Required

None - all test paths come from hermetic temporary scope fixtures.

## Next Phase Readiness

The shared fixture is ready for any remaining Phase 11 owner-test cleanup. No production source, install-flow file, or Phase 10-owned test changed.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. The shared fixture uses only hermetic test locations and guarantees release for action and test-context lifetimes.

## Self-Check: PASSED

- Task commits `949bd147` and `bef9e977` are ancestors of the plan head.
- The shared fixture, RED evidence, and all five migrated owner modules exist.
- The owner tests, static gate, Fallow audits, and repository hooks passed.

---

*Phase: 11-cleanup-split-and-docs*
*Completed: 2026-10-28*

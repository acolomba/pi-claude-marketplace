---
phase: 112-hook-runtime
plan: 07
subsystem: hook-runtime
tags: [typescript, node-test, event-router, lifecycle-isolation, direct-coverage]
requires:
  - phase: 112-hook-runtime
    provides: Plans 112-02, 112-05, 112-25, and 112-26 established async-child, dispatch, routing-state, and settle lifecycle contracts
provides:
  - End-to-end reload proof from epoch reset through hydration, orphan reap, and exactly eleven Pi registrations
  - Complete cache, routing, hydration, scope, context-drain, and lazy SessionStart owner evidence
  - Sole OBS-01 architecture carrier after removing the additional-context supplement
affects:
  - MOD-05 hook-runtime verification
  - Hook barrel and extension-entry integration
actuals:
  tokens: 30244
  tasks: 2
  commits: 2
tech-stack:
  added: []
  patterns:
    - Case-owned filesystem, process, environment, session, and router state with cleanup registered before action
    - Public lifecycle evidence for cache, epoch, route, pending-context, child, and orphan behavior
key-files:
  created: []
  modified:
    - tests/architecture/hooks-dispatch.test.ts
    - tests/bridges/hooks/event-router.test.ts
    - tests/bridges/hooks/session-start-additional-context.test.ts
key-decisions:
  - Alphabetized inventories and presentation expectations while preserving exact production declaration and registration order where order is contractual.
  - Kept event-router.ts byte-for-byte unchanged because its public cache, hydration, rebuild, handler, and registration operations expose the complete lifecycle contract.
  - Split the in-memory child and persisted orphan across user and project cleanup surfaces so exit persistence cannot race the orphan tracer.
patterns-established:
  - Router inventories are presented alphabetically; behaviorally significant production order is asserted verbatim.
  - Real subprocess tracers use process.execPath, pre-registered exit observation, and case-owned cleanup without sleeps.
requirements-completed: [MOD-05]
coverage:
  - id: D1
    description: A full bridge reload proves lifecycle reset, two-scope hydration, route rebuild, in-memory child shutdown, persisted orphan reap, stale-handler rejection, and exactly eleven registrations in contractual production order.
    requirement: MOD-05
    verification:
      - kind: integration
        ref: tests/bridges/hooks/event-router.test.ts#reload resets lifecycle state before hydrating routes, reaping orphans, and registering handlers
        status: pass
    human_judgment: false
  - id: D2
    description: Cache identity, one-shot context drain, epoch rejection, ten-bucket ordering, project hydration, scope isolation, degradation, shared-directory handling, and lazy SessionStart behavior have independent direct owner cases.
    requirement: MOD-05
    verification:
      - kind: unit
        ref: tests/bridges/hooks/event-router.test.ts#cache, drain, rebuild, hydration, scope, and lazy SessionStart cases
        status: pass
      - kind: other
        ref: npm run test:coverage:direct -- tests/bridges/hooks/event-router.test.ts
        status: pass
    human_judgment: false
  - id: D3
    description: The additional-context supplement is removed and the architecture carrier retains only the three repository-wide OBS-01 logging constraints.
    requirement: MOD-05
    verification:
      - kind: unit
        ref: tests/architecture/hooks-dispatch.test.ts#OBS-01 static logging constraints
        status: pass
      - kind: other
        ref: test ! -e tests/bridges/hooks/session-start-additional-context.test.ts
        status: pass
    human_judgment: false
duration: 34 min
completed: 2026-08-31
status: complete
---

# Phase 112 Plan 07: Event router lifecycle summary

**The event-router owner now proves reload, cache, hydration, routing, context-drain, orphan, and exact registration behavior at 100% direct coverage, with only OBS-01 left in the architecture carrier.**

## Performance

- **Duration:** 34 min
- **Started:** 2026-08-31T12:41:00Z
- **Completed:** 2026-08-31T13:15:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Added a public-boundary reload tracer that proves epoch, pending-context, settle, child, hydration, routing, orphan, registration, stale-handler, and final-cleanup effects in one ordered lifecycle.
- Completed direct event-router evidence for cache keys, read and parse failures, one-shot drains, stale epochs, all ten buckets, project-prefix replacement, scope and containment refusals, corrupt state, shared-directory failures, and lazy project SessionStart hydration.
- Deleted `session-start-additional-context.test.ts` after absorbing its unique evidence and reduced `hooks-dispatch.test.ts` to three repository-wide OBS-01 logging constraints.

## Task Commits

1. **Task 1: Prove one bridge reload from state reset to registered handlers** - `9004949a`
2. **Task 2: Complete cache, hydration, drain, scope, defensive, and carrier partitions** - `e054584f`

## Files Created/Modified

- `tests/bridges/hooks/event-router.test.ts` - Canonical owner for cache, hydration, rebuild, pending-context, reload, orphan, and Pi registration behavior.
- `tests/architecture/hooks-dispatch.test.ts` - Pruned carrier for the three repository-wide OBS-01 logging constraints only.
- `tests/bridges/hooks/session-start-additional-context.test.ts` - Deleted after its lazy hydration and pending-context evidence moved into the canonical owner.

## Decisions Made

- Kept `event-router.ts` byte-for-byte unchanged: existing public operations expose every required runtime partition without a test seam, hidden reader, or impossible input.
- Applied the user's alphabetical-order decision to inventories and presentation expectations. Exact declaration order within routing buckets and exact Pi registration order remain asserted in production order because both are behavioral contracts.
- Kept cache insertion order distinct from route presentation order: routing expectations are normalized where presentation is the concern, while tests pin the stable production sort and within-plugin declaration order where behavior depends on it.
- Preserved one sole architecture responsibility: `hooks-dispatch.test.ts` now owns OBS-01 static repository constraints and no longer duplicates direct dispatcher or router behavior.

## Validation

- The focused event-router and OBS-01 architecture suites passed with no failed, skipped, or todo tests.
- The direct coverage gate for `event-router.ts` passed at 100% functions, lines, and branches.
- Typecheck and the planned supplemental-deletion assertion passed during Task 2 execution.
- Runtime cases use separate lowercase `// arrange`, `// act`, and `// assert` phases; production declaration and registration sequences remain exact where contractual.
- The two task commits are contiguous and modify only the three planned test carriers; production source is unchanged.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Separated in-memory and persisted child cleanup surfaces**

- **Found during:** Task 2 (Complete cache, hydration, drain, scope, defensive, and carrier partitions)
- **Issue:** Using one scope for the in-memory child and persisted orphan let child-exit PID-table persistence race the seeded orphan row, making the reload tracer nondeterministic.
- **Fix:** Assigned the in-memory child to the user-scope data root and the persisted orphan to the project-scope data root, preserving one reload while isolating both cleanup effects.
- **Files modified:** `tests/bridges/hooks/event-router.test.ts`
- **Verification:** The tracer observed both in-memory shutdown and persisted-table removal with empty final lifecycle state.
- **Committed in:** `e054584f`

**2. [Rule 3 - Blocking] Stabilized the default orphan tracer with a portable real Node child**

- **Found during:** Task 2 (Complete cache, hydration, drain, scope, defensive, and carrier partitions)
- **Issue:** A synthetic PID and mocked signal boundary could not prove the default production probe, marker read, and SIGKILL outcome as one faithful subprocess lifecycle.
- **Fix:** Spawned a case-owned child with `process.execPath`, stamped the real dispatch marker, registered exit observation and cleanup before reload, and asserted the SIGKILL result without sleeps.
- **Files modified:** `tests/bridges/hooks/event-router.test.ts`
- **Verification:** The reload tracer passed with the expected marker read, PID-table unlink, and `{ code: null, signal: "SIGKILL" }` outcome.
- **Committed in:** `e054584f`

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both changes stabilize the planned public lifecycle proof without changing production behavior or widening the owner surface.

## Issues Encountered

The orphan tracer initially coupled two independent persistence lifecycles. Separate scope-owned data roots and a real Node child made both effects observable and deterministic.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None.

## Security Review

The owner closes T-112-02 with contained branded paths, disabled and invalid refusal, and user/project separation; T-112-03 with ownership-marker verification before a real orphan SIGKILL; and T-112-05 with exact reset, drain, epoch, registration, and cleanup evidence. No production or trust-boundary surface changed.

## Next Phase Readiness

The event-router owner and supplemental dispositions are final. Plan 112-14 can now complete the hook barrel and Phase 112 gate.

## Self-Check: PASSED

- The event-router owner and pruned architecture carrier exist, and the additional-context supplement is absent.
- Task commits `9004949a` and `e054584f` exist in a contiguous sequence with the planned three-file scope.
- Focused tests, direct coverage, typecheck, lowercase-phase, no-skip, no-stub, supplemental-deletion, and coverage-metadata checks passed during execution or closeout inspection.
- `MOD-05` remains pending until the phase-level verifier closes Phase 112; `.planning/REQUIREMENTS.md` was not changed.

---

_Phase: 112-hook-runtime_
_Completed: 2026-08-31_

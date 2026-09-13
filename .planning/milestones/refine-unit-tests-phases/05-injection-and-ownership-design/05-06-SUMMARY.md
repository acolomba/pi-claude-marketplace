---
phase: 05-injection-and-ownership-design
plan: 06
subsystem: hooks-runtime
tags: [dependency-injection, runtime-ownership, routing, tdd]

requires:
  - phase: 05-injection-and-ownership-design
    provides: required consumer-owned ports and explicit production composition from Plan 05-01
provides:
  - isolated HooksRuntime lifecycle owner for routing, generation, pending context, settle, children, and PID serialization
  - required runtime-bound routing operations plus one private eager production transition binding
  - exact fresh-instance isolation and transition-preservation owner tests
affects: [05-injection-and-ownership-design, 06-global-patch-removal]

actuals:
  tokens: 10294
  tasks: 2
  commits: 5
plan_head_before: 182828b9d8cf9c2189ea16ae9e1d7bfabd3b42b5

tech-stack:
  added: []
  patterns:
    - closure-owned coherent lifecycle runtime
    - required runtime-bound operations with a bounded compatibility delegate

key-files:
  created:
    - extensions/pi-claude-marketplace/bridges/hooks/runtime.ts
    - tests/bridges/hooks/runtime.test.ts
  modified:
    - extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts
    - tests/bridges/hooks/routing-state.test.ts

key-decisions:
  - "Keep all hooks state families inside one closure-owned runtime while exposing only semantic operations and snapshots."
  - "Bind current no-runtime routing exports to one private eager transition runtime; keep resetEpoch and resetRoutingState only until Plan 05-31."
  - "Preserve PID-table identity, ordering, filtering, and shutdown behavior for the later registry migration without changing PID semantics in this plan."

patterns-established:
  - "Lifecycle owner: createHooksRuntime creates every mutable hooks state family inside one factory lifetime."
  - "Bound transition: createRoutingStateOperations requires a runtime, while existing production signatures delegate through one unexported eager binding."

requirements-completed: [TREF-05, TREF-06]

coverage:
  - id: D1
    description: "Fresh HooksRuntime instances isolate routing, generation, pending context, settle, child ownership, and PID-operation chains through public behavior."
    requirement: TREF-05
    verification:
      - kind: unit
        ref: "tests/bridges/hooks/runtime.test.ts"
        status: pass
      - kind: other
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/hooks/runtime.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Routing state is runtime-owned, explicitly bindable, and used by current production through one private non-optional transition binding with exact legacy behavior."
    requirement: TREF-06
    verification:
      - kind: unit
        ref: "tests/bridges/hooks/routing-state.test.ts"
        status: pass
      - kind: other
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts"
        status: pass
    human_judgment: false

duration: 31min
completed: 2026-09-07
status: complete
---

# Phase 5 Plan 6: Hooks Runtime Core Summary

**A closure-owned HooksRuntime now isolates every hooks state family, and current routing production calls use one private eager transition binding without optional or raw runtime seams.**

## Performance

- **Duration:** 31 min
- **Started:** 2026-09-07T21:52:30Z
- **Completed:** 2026-09-07T22:23:40Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Added `createHooksRuntime()` with semantic operations for generation, parsed config, routes, pending context, settle transitions, child ownership, PID-table snapshots, shutdown, and per-path serialization.
- Proved that two fresh runtimes cannot share any state family and that collection reads do not expose writable runtime containers.
- Replaced the four mutable routing-state cells with explicit runtime-bound operations and one private eager transition binding used by existing event-router and dispatch callers.
- Preserved cache keys, insertion order, epoch values, bucket defaults, one-shot pending behavior, reset compatibility, child shutdown, and PID behavior exactly.

## Task Commits

1. **Task 1 RED: HooksRuntime ownership proofs** - `0f7f8b6c` (test)
2. **Task 1 GREEN: isolated HooksRuntime core** - `01d022f8` (feat)
3. **Task 2 RED: required routing binding proof** - `56fa69bc` (test)
4. **Task 2 GREEN: routing state bound to HooksRuntime** - `e99c814b` (feat)
5. **REFACTOR: repository formatting for the runtime slice** - `a8bcf2d4` (refactor)

## Files Created/Modified

- `extensions/pi-claude-marketplace/bridges/hooks/runtime.ts` - Owns coherent hooks lifecycle state and exposes behavior-oriented operations and snapshots.
- `tests/bridges/hooks/runtime.test.ts` - Proves fresh-instance isolation, exact state transitions, child ownership, and PID-chain serialization.
- `extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts` - Defines explicit runtime-bound routing operations and the bounded production transition delegates.
- `tests/bridges/hooks/routing-state.test.ts` - Preserves legacy routing behavior and proves explicit-runtime equivalence and transition isolation.

## Decisions Made

- The runtime returns snapshots or removed domain entries for enumeration; it never returns its mutable maps, arrays, counters, or state record.
- The routing operation factory requires a concrete `HooksRuntime`. There is no optional runtime parameter, default runtime export, raw singleton, or test-only seam.
- The compatibility resets remain under their existing names only. `resetEpoch` replaces the transition runtime while restoring all non-epoch routing state, and `resetRoutingState` replaces the complete transition lifetime. Plan 05-31 owns their deletion.
- Event-router, dispatch, settle, registry, and PID behavior remain otherwise unchanged; their broader runtime migration stays with Plans 05-09 through 05-11.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Exact `npm run check` stops at `format:check` because the pre-existing untracked `.mcp.json` is not formatted. The file is outside this plan and was preserved byte-for-byte. All plan-owned files pass Prettier, and every later repository gate was run independently.
- The sandbox blocked child-process behavior in the direct-coverage negative controls and two unit-suite files. The negative controls and the complete 5,423-test unit suite passed unchanged outside the sandbox.

## Validation Results

- Both exact task verification commands passed, including the paired suites, typecheck, focused ESLint, and Fallow.
- Direct coverage is 100% branches, functions, and lines for both `runtime.ts` and `routing-state.ts`.
- Repository typecheck, full lint, all Fallow gates, corresponding-test checks, and negative controls passed.
- Full unit suite passed: 5,423 tests, 0 failures.
- Integration suite passed: 13 tests, 0 failures.
- Only the four declared source/test files changed from the plan base; no tracked file was deleted.
- `scripts/revalidation.mjs:1124` remains byte-exact: `// fallow-ignore-next-line complexity -- temporary; remove after Phase 01-71 refactor`.

## TDD Gate Compliance

- Task 1 RED failed on the named fresh-instance isolation assertion before `runtime.ts` existed; `tdd-red-evidence` returned `RED_EVIDENCE_OK` before production work.
- Task 1 GREEN passed its owner suite and both direct-coverage gates; the committed tracer slice passed its automated feedback gate before Task 2 began.
- Task 2 RED failed on the named missing required routing factory assertion; `tdd-red-evidence` returned `RED_EVIDENCE_OK` before routing-state production work.
- Task 2 GREEN and REFACTOR passed the routing equivalence, isolation, reset-preservation, typecheck, lint, coverage, and Fallow gates.

## Known Stubs

None. Empty arrays in `runtime.ts` are live runtime accumulators or empty snapshot results, not placeholders or unwired data.

## User Setup Required

None - no external service configuration is required.

## Next Phase Readiness

Plans 05-09 through 05-11 can migrate registration, dispatch, settle, async child ownership, and PID serialization onto the shared runtime contract. Plan 05-31 retains explicit ownership of transition-binding and reset-surface removal after the caller census reaches zero.

## Self-Check: PASSED

- All four plan-owned source and test artifacts exist.
- All five task commits exist in repository history and match the measured plan ledger count.
- The runtime factory, explicit routing binding, and current production transition delegates are present without an exported raw singleton.

---

_Phase: 05-injection-and-ownership-design_
_Completed: 2026-09-07_

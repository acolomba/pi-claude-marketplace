---
phase: 03-production-defect-corrections
plan: "12"
subsystem: hook-dispatch-safety
tags: [typescript, hooks, async-rewake, dead-branch, node-test]

requires:
  - phase: 03-production-defect-corrections
    plan: "04"
    provides: Compact trigger supportability contract
  - phase: 03-production-defect-corrections
    plan: "05"
    provides: Synchronous dispatch aligned with the admitted event union
provides:
  - Async dispatch control flow aligned with the complete admitted event union
  - Domain event surface without an empty-complement runtime guard
  - Compile-time equality between admitted and dispatchable event types
affects: [phase-03, hooks, async-rewake, dispatch]

actuals:
  tokens: 3900
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - Index exhaustive translator records with the honest producer union
    - Keep compatibility type names as exact aliases when their runtime distinction disappears

key-files:
  created:
    - .planning/phases/03-production-defect-corrections/03-12-SUMMARY.md
  modified:
    - extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts
    - extensions/pi-claude-marketplace/domain/components/hook-events.ts
    - tests/bridges/hooks/async-rewake/registry.test.ts
    - tests/domain/components/hook-events.test.ts

key-decisions:
  - "Remove only async-rewake's producer-proven impossible event fallback; preserve every reachable registry and process guard."
  - "Define `DispatchableEvent` as an exact compatibility alias of `BucketAEvent` after the duplicate runtime tuple becomes value-dead."
  - "Prove admitted-to-dispatchable equality through the public admitted tuple and type assignment without casts or test-only exports."

patterns-established:
  - "An impossible branch is deleted with its fabricated fixture rather than replaced by another invalid test input."
  - "Exhaustive `Record<DispatchableEvent, ...>` tables remain the compile-time translator-totality gate."

requirements-completed: [PDEF-07]

coverage:
  - id: D1
    description: "Every admitted async-rewake event reaches the exhaustive translator table without a no-producer fallback."
    requirement: PDEF-07
    verification:
      - kind: unit
        ref: "tests/bridges/hooks/async-rewake/registry.test.ts"
        status: pass
      - kind: other
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "The admitted and dispatchable event unions are exactly equal and compact supportability remains unchanged."
    requirement: PDEF-07
    verification:
      - kind: unit
        ref: "tests/domain/components/hook-events.test.ts#DispatchableEvent"
        status: pass
      - kind: other
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/components/hook-events.ts"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-09-07
status: complete
---

# Phase 03 Plan 12: Async Dispatch Empty-Complement Cleanup Summary

**Async rewake now indexes its total translator table directly, and the domain no longer carries a runtime guard for an event complement that cannot exist.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-09-07T06:06:00-04:00
- **Completed:** 2026-09-07T06:14:14-04:00
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Removed the unreachable async-rewake non-dispatchable branch and its fabricated `FutureAdmittedEvent` fixture.
- Removed `DISPATCHABLE_MEMBERS`, `isDispatchableEvent`, and the now value-dead duplicate dispatchable tuple.
- Retained `DispatchableEvent` as an exact alias for compatibility while exhaustive translator records continue to enforce totality.
- Preserved compact manual/auto supportability and every reachable registry capacity, timeout, process, cleanup, and path-safety branch.

## Task Commits

1. **Task 1: Remove unreachable async dispatch fallback** - `7c2b91fc` (refactor)
2. **Task 2: Remove obsolete dispatchability guard** - `45ababa8` (refactor)

## Files Created/Modified

- `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts` - Directly indexes the exhaustive translator record for admitted events.
- `extensions/pi-claude-marketplace/domain/components/hook-events.ts` - Removes runtime dispatchability metadata and aliases the compatibility type to the admitted union.
- `tests/bridges/hooks/async-rewake/registry.test.ts` - Deletes the impossible event fixture while retaining all live safety-path coverage.
- `tests/domain/components/hook-events.test.ts` - Replaces artificial guard cases with admitted-to-dispatchable type equality proof.

## Decisions Made

- The terminal producer trace is sufficient evidence for deletion because a runtime RED test would require another prohibited invalid cast or mutable discriminator.
- The private dispatch tuple was removed after focused lint correctly identified that it was only used to manufacture a type. Keeping it would leave duplicate event metadata with no runtime consumer.
- The compatibility export remains because downstream owners name `DispatchableEvent`; making it an exact alias keeps that contract honest without widening the public value surface.

## Deviations from Plan

### Trace-driven deletion replaced a RED runtime test

- The removed behavior has no valid producer, so no honest input can make a pre-change test fail.
- The existing cast-created fixture and production fallback were deleted atomically, then verified through the complete owner suites and direct coverage.

### The value-dead private tuple was also removed

- The plan explicitly named the runtime set and guard, but their deletion left `DISPATCHABLE_EVENTS` used only in type position and failing focused ESLint.
- Collapsing `DispatchableEvent` to the exact admitted union is the smallest no-ignore correction and makes the empty-complement decision explicit.

## Issues Encountered

- Focused ESLint rejected the private dispatch tuple after its last runtime consumer disappeared. The tuple was removed instead of adding an ignore directive or exporting test-only metadata.

## Verification

- Async registry, synchronous dispatch, and hook-event domain suites passed together.
- Direct coverage passed at 100% lines, branches, and functions for both changed production owners.
- `npm run typecheck` passed.
- Focused ESLint and Prettier checks passed for all four plan-owned TypeScript files.
- `npm run fallow` passed dead-code, health, and duplicate gates.
- A structural scan confirmed the obsolete guard, runtime metadata, fabricated event, and async fallback fixture are absent.

## User Setup Required

None.

## Next Phase Readiness

- PDEF-07's hook-dispatch branch corrections are complete across both synchronous and async consumers.
- Plan 03-14 can proceed with the remaining selected-output behavior correction.

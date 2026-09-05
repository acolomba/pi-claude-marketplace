---
phase: 02-containment-and-input-safety
plan: "03"
subsystem: lifecycle-containment
tags: [typescript, resource-discovery, failure-containment, node-test]

requires:
  - phase: 02-02
    provides: Shared path containment safety and the completed Phase 2 prerequisite
provides:
  - Narrow root-only aggregate discovery containment with an exact empty fallback
  - Persisted reconcile and PATH progress across a transient discovery failure
  - Same-callback recovery and independent hostile-notifier warning evidence
affects: [phase-03, resource-discovery, lifecycle, plugin-path]

actuals:
  tokens: 3144
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - Host-boundary-only fallback after completed lifecycle stages
    - Invocation-local recovery after removing a real filesystem fault

key-files:
  created:
    - .planning/phases/02-containment-and-input-safety/02-03-SUMMARY.md
  modified:
    - extensions/pi-claude-marketplace/index.ts
    - tests/index.test.ts

key-decisions:
  - "Catch only `aggregateDiscoveredResources` and its result projection at the registered host callback; keep reconciliation, PATH recompute, and the aggregator unchanged."
  - "Use a real mode-000 skill directory to prove transient failure, then restore it before invoking the same registered callback again."
  - "Retain the per-warning try/catch and prove both user and project warning attempts under a notifier that throws on every call."

patterns-established:
  - "Root lifecycle containment: completed reconcile and PATH effects precede the narrow aggregate discovery fallback and are never replayed or rolled back."
  - "Recovery evidence: remove a case-owned filesystem fault and exercise the same callback again without reset state or test-only seams."

requirements-completed: [PDEF-04]

coverage:
  - id: D1
    description: "The registered callback returns exact empty arrays for aggregate discovery failure while preserving completed reconcile and PATH state, then recovers on its next invocation."
    requirement: PDEF-04
    verification:
      - kind: unit
        ref: "tests/index.test.ts#resource discovery failure and recovery case"
        status: pass
      - kind: other
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/index.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "The aggregate discovery owner remains fail-loud and complete rather than swallowing partial-source failures."
    requirement: PDEF-04
    verification:
      - kind: unit
        ref: "tests/orchestrators/discover.test.ts#aggregate failure contract"
        status: pass
      - kind: other
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/discover.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every skipped-scope warning is attempted independently even when every host notification throws, and no notification failure escapes the callback."
    requirement: PDEF-04
    verification:
      - kind: unit
        ref: "tests/index.test.ts#hostile notifier warning-attempt case"
        status: pass
      - kind: other
        ref: "focused Phase 2 test matrix"
        status: pass
    human_judgment: false

duration: 13min
completed: 2026-09-05
status: complete
---

# Phase 02 Plan 03: Resource Discovery Containment Summary

**The registered resource callback now contains only aggregate discovery failure, preserves completed lifecycle progress, recovers on the same callback, and attempts every skipped-scope warning despite a hostile notifier.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-09-05T22:36:44Z
- **Completed:** 2026-09-05T22:50:04Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Added a narrow root callback catch around aggregate resource discovery and its projection, returning exactly `{ skillPaths: [], promptPaths: [] }` without weakening the fail-loud aggregator.
- Proved that a real case-owned mode-000 discovery fault preserves completed configuration migration and PATH reconciliation, then yields exact resources through the same callback after the fault is removed.
- Proved user and project skipped-scope warnings are each attempted when every host notification throws, with no notification failure escaping and no poisoned state on a second invocation.

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Add failing discovery recovery contract** - `8339b9b4` (test)
2. **Task 1 GREEN: Contain aggregate discovery failures** - `514e24e6` (fix)
3. **Task 2: Prove warning attempts stay independent** - `73f2fa74` (test)

## Files Created/Modified

- `extensions/pi-claude-marketplace/index.ts` - Catches aggregate discovery failure only at the registered resource callback after reconciliation and PATH work complete.
- `tests/index.test.ts` - Adds hermetic public-boundary recovery and hostile-notifier cases using real case-owned filesystems and the registered callback.

## Decisions Made

- Kept `aggregateDiscoveredResources` byte-identical and fail-loud; only its registered host boundary chooses the exact empty fallback.
- Kept configuration reconciliation and plugin PATH recomputation outside the catch so successful effects persist and failures in those earlier stages retain their existing behavior.
- Used invocation-local behavior and real filesystem state for recovery evidence, with no retry state, reset hook, dependency seam, test-only export, global patch, network access, or real-home access.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Task 2's production warning loop already had per-attempt containment, so its new public-boundary proof passed without a production edit. No artificial failing assertion, redundant branch, or test-only seam was added to manufacture a second RED state.
- The aggregate `npm run check` wrapper completed typecheck, repository lint, and `fallow`, then stopped because its formatting step scans the user-owned untracked `.mcp.json`. That file was neither edited nor staged. A focused Prettier check passed for both plan-owned files, and every remaining check stage ran separately and passed.
- An extra broad `npx eslint . --max-warnings=0` invocation reaches `.codex/gsd-core/bin/ensure-runtime-build.cjs`, outside the configured typed-project lint surface, where `@typescript-eslint/await-thenable` reports missing parser type information. The project-authoritative lint and a focused zero-warning ESLint run over the plan-owned test passed.
- Subprocess-heavy suites required the repository's existing outside-sandbox authorization. They passed there, including 5,244/5,244 unit tests and 31/31 integration tests.

## Verification

- The focused Phase 2 test matrix passed, including root containment, fail-loud aggregate ownership, recovery, and hostile-notifier behavior.
- All eight plan direct-coverage commands passed with 100% lines, branches, and functions, including `index.ts` and `orchestrators/discover.ts`.
- TypeScript compilation, repository lint, focused zero-warning ESLint, `fallow`, corresponding-test positive and negative gates, direct-coverage negative gate, the full unit suite, and integration suite passed.
- TypeScript Google Style and unit-testing reviews found no style violation, dead branch, skip marker, global or builtin patch, network access, real-home access, or test-only production seam in the plan diff.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- PDEF-04 is closed at the registered lifecycle boundary while the discovery owner remains fail-loud and complete.
- Phase 2's three plans are implemented and ready for phase-level verification.

## Self-Check: PASSED

- Both plan-owned source and test files plus this summary exist.
- All three task commits are present in git history.

---

_Phase: 02-containment-and-input-safety_
_Completed: 2026-09-05_

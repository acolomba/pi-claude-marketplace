---
phase: 108-domain-and-platform
plan: 15
subsystem: testing
tags: [node-test, typebox, manifest, direct-coverage]

requires:
  - phase: 108-01
    provides: Phase 108 pair-execution foundation and unit-test conventions
provides:
  - Whole-value manifest coverage for minimum and representative valid inputs
  - Ordered unknown-field and by-reference cache identity coverage
  - Exact typed parse and schema failure coverage
affects: [domain-manifest, manifest-cache, phase-108-unit-test-refactor]

actuals:
  tokens: 2410
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - Exact lowercase Arrange-Act-Assert phases with blank-line separation
    - Whole-value assertions plus explicit key-order and reference-identity assertions

key-files:
  created: []
  modified:
    - tests/domain/manifest.test.ts

key-decisions:
  - "The representative raw-manifest case observes unknown fields, key order, and cache identity together."
  - "Malformed JSON coverage pins the exported wrapper message and the complete visible SyntaxError cause fields."

patterns-established:
  - "Raw manifest preservation: compare the complete parsed value, root key order, and cached object reference."
  - "Typed manifest failures: assert the exported class, exact message, and distinct cause shape."

requirements-completed: [MOD-01]

coverage:
  - id: D1
    description: "Manifest loading preserves minimum and representative parsed values, unknown fields, key order, and cached object identity."
    requirement: MOD-01
    verification:
      - kind: unit
        ref: "tests/domain/manifest.test.ts#preserves a complete raw manifest by reference with key order and unknown fields"
        status: pass
      - kind: other
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/manifest.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Malformed JSON and invalid schemas reject with the exported typed error, exact messages, and distinguishable cause shapes."
    requirement: MOD-01
    verification:
      - kind: unit
        ref: "tests/domain/manifest.test.ts#preserves a SyntaxError cause for malformed JSON"
        status: pass
      - kind: unit
        ref: "tests/domain/manifest.test.ts#reports a nested plugin schema defect"
        status: pass
      - kind: other
        ref: "npm run check"
        status: pass
    human_judgment: false

duration: 10 min
completed: 2026-08-29
status: complete
---

# Phase 108 Plan 15: Manifest validation and loading Summary

**The manifest owner now proves raw parsed-value preservation by reference and exact typed parse and schema failures.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-08-29T05:50:28Z
- **Completed:** 2026-08-29T06:00:40Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- The owner compares the smallest valid manifest and a complete representative manifest as whole values.
- Ordered root keys, unknown root and plugin fields, and cached object identity are observable in one public loader case.
- Malformed JSON and schema failures assert the exported error class, exact public messages, and distinct cause shapes.

## Task Commits

Each task was committed atomically:

1. **Task 1: Normalize valid manifests and parsed-value identity** - `6dde351b` (test)
2. **Task 2: Lock malformed JSON and schema-error cause chains** - `44af2552` (test)

## Files Created/Modified

- `tests/domain/manifest.test.ts` - Owns validators, raw loader identity, and typed failure behavior for `manifest.ts`.

## Decisions Made

- The representative case writes intentionally ordered JSON and checks the returned key order independently from its whole-value assertion.
- A second load checks object identity without reconstructing an expected value that could hide cloning.
- Schema failures retain `cause === undefined`; malformed JSON retains the underlying `SyntaxError` with its exact visible message.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

The restricted sandbox initially denied the full suite's local TCP and Unix-socket listeners. The required `npm run check` passed after the same command received local-listener permission.

## Verification

- `node --test tests/domain/manifest.test.ts` - passed.
- `npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/manifest.ts` - passed with 9/9 branches, 3/3 functions, and 100/100 lines.
- Exact lowercase phase and blank-line structure check - passed for all 26 runtime phases.
- `npm run check` - passed with 3,713 unit tests, one intentional platform skip, and 21 integration tests.

## User Setup Required

None - no external service configuration is required.

## Next Phase Readiness

The `manifest.ts` source-test pair is complete. The remaining Phase 108 pairs can continue independently.

## Self-Check: PASSED

- `tests/domain/manifest.test.ts` exists.
- Task commits `6dde351b` and `44af2552` exist.
- Focused tests, direct coverage, runtime phase structure, and the full repository check passed.

---
*Phase: 108-domain-and-platform*
*Completed: 2026-08-29*

---
phase: 106-workflow-detection-and-partial-install
plan: 04
subsystem: testing
tags: [node-test, workflows, output-catalog, reason-parity, terminal-contract]

requires:
  - phase: 106-01
    provides: Workflow reason mapping and closed-set tuple members
  - phase: 106-02
    provides: Workflow schema and resolver coverage
  - phase: 106-03
    provides: Partial-install and discovery boundary coverage
provides:
  - Exact workflow reason deduplication and cross-surface parity locks
  - Byte contracts for workflow inventory, rejection, and partial-install success
affects: [phase-verification, output-catalog, reason-bearing-surfaces]

actuals:
  tokens: 3786
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - Exact-array reason locks at the shared classifier boundary
    - Bidirectional catalog markers paired with renderer fixtures

key-files:
  created: []
  modified:
    - tests/shared/probe-classifiers.test.ts
    - tests/orchestrators/plugin/cross-surface-reason-parity.test.ts
    - tests/architecture/catalog-uat.test.ts
    - docs/output-catalog.md

key-decisions:
  - "Use one typed workflow reason and preserve canonical tail ordering."
  - "Bind three workflow states without adding renderer branches or new grammar."

patterns-established:
  - "Reason parity: compare typed kinds and install notes through the shared classifier."
  - "Catalog parity: every fixture key has one documented byte block in the same command section."

requirements-completed: [WDET-04]

coverage:
  - id: D1
    description: Workflow reasons are empty, singular, deduplicated, ordered, and equal across consumers.
    requirement: WDET-04
    verification:
      - kind: unit
        ref: "tests/shared/probe-classifiers.test.ts#WDET-04"
        status: pass
      - kind: architecture
        ref: "tests/orchestrators/plugin/cross-surface-reason-parity.test.ts#WDET-04"
        status: pass
    human_judgment: false
  - id: D2
    description: Inventory, rejection, and partial success match the approved terminal bytes.
    requirement: WDET-04
    verification:
      - kind: architecture
        ref: "tests/architecture/catalog-uat.test.ts#workflow catalog states"
        status: pass
      - kind: documentation
        ref: "docs/output-catalog.md#workflow states"
        status: pass
    human_judgment: false
  - id: D3
    description: Existing statuses, glyphs, severity, hints, reload rules, and empty-state grammar remain closed.
    requirement: WDET-04
    verification:
      - kind: architecture
        ref: "tests/architecture/notify-closed-set-locks.test.ts"
        status: pass
      - kind: architecture
        ref: "tests/architecture/catalog-uat.test.ts#bidirectional walk"
        status: pass
    human_judgment: false

duration: 26min
completed: 2026-08-29
status: complete
---

# Phase 106 Plan 04: Workflow Output Contract Summary

**One deduplicated `{workflows}` reason now has exact parity across consumers and three byte-locked terminal states.**

## Performance

- **Duration:** 26 min
- **Started:** 2026-08-29T20:05:20Z
- **Completed:** 2026-08-29T20:31:45Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Locked empty, single, duplicate, and mixed workflow reason arrays at the shared classifier.
- Proved that typed list data and install notes produce the same reason arrays.
- Added exact catalog bytes for inventory, install rejection, and partial-install success.
- Preserved every existing status, glyph, summary, hint, indentation, and reload rule.

## Task Commits

Each task was committed atomically:

1. **Task 1: Lock workflow reason dedupe, order, and parity** - `5369f194` (test)
2. **Task 2: Bind workflow terminal states to the catalog** - `c3d7229d` (docs)

## Files Created/Modified

- `tests/shared/probe-classifiers.test.ts` - Locks exact workflow reason arrays.
- `tests/orchestrators/plugin/cross-surface-reason-parity.test.ts` - Locks shared consumer parity.
- `tests/architecture/catalog-uat.test.ts` - Drives 176 catalog examples in both directions.
- `docs/output-catalog.md` - Documents the 40-member reason set and three workflow states.

## Decisions Made

- Kept `narrowUnsupportedKinds` as the only typed workflow reason mapper.
- Reused the existing partial statuses and trailers. No workflow-specific renderer branch was added.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The sandbox blocked three unit files that use local Git fixtures. The complete unit gate passed with fixture access.
- The worktree had no local Pi binary for the runtime smoke test. A temporary link to the pinned dependency directory enabled the gate, then was removed.

## Validation Results

- Task 1 focused suites: 2 files passed, 0 failed.
- Task 2 catalog suite: 176 annotated examples passed both walk directions.
- Phase-focused suites: 7 files passed, 0 failed.
- Complete unit suite: 3,649 passed, 0 failed, 1 intentional platform skip.
- Integration gate: 21 assertions across 10 files passed, 0 failed.
- Aggregate `npm run check`: passed.
- E2E gate: 14 passed, 0 failed.
- Task secret scans: 0 verified and 0 unverified secrets.
- Phase-wide secret scan: 24 paths, 0 verified and 0 unverified secrets.
- Per-task and all-files pre-commit hooks: passed with TruffleHog skipped after filesystem scans.
- Stub scan: no new stub, placeholder, skipped test, or unrun verification.
- Threat scan: no production file, endpoint, schema, resource field, or executor changed in this plan.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- All four Phase 106 plans are complete and every phase boundary gate is green.
- The phase is ready for goal verification and user acceptance testing.

## Self-Check: PASSED

- The summary and all four modified files exist.
- Both task commits exist in git history.
- Every acceptance check and phase boundary gate completed successfully.

---

*Phase: 106-workflow-detection-and-partial-install*
*Completed: 2026-08-29*

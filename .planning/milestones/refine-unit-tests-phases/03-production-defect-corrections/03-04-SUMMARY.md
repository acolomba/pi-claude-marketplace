---
phase: 03-production-defect-corrections
plan: "04"
subsystem: hook-payload-translation
tags: [typescript, hooks, compact, matcher-contract, node-test]

requires:
  - phase: 01-live-evidence-revalidation
    provides: Terminal compact-trigger finding BHP-001
provides:
  - Typed manual/automatic compact trigger projection in both payload owners
  - Exact manual and auto compact matcher supportability vocabulary
  - Independent regressions for every Pi compact reason
affects: [phase-03, hooks, pre-compact, post-compact, matcher-partition]

actuals:
  tokens: 4250
  tasks: 2
  commits: 5

tech-stack:
  added: []
  patterns:
    - Project closed upstream discriminants into a closed downstream vocabulary
    - Test mirrored payload owners independently with the same behavior matrix

key-files:
  created:
    - .planning/phases/03-production-defect-corrections/03-04-SUMMARY.md
  modified:
    - extensions/pi-claude-marketplace/bridges/hooks/payloads/pre-compact.ts
    - extensions/pi-claude-marketplace/bridges/hooks/payloads/post-compact.ts
    - extensions/pi-claude-marketplace/domain/components/hook-events.ts
    - tests/bridges/hooks/payloads/pre-compact.test.ts
    - tests/bridges/hooks/payloads/post-compact.test.ts
    - tests/domain/components/hook-events.test.ts

key-decisions:
  - "Map only the `manual` Pi reason to `manual`; map both `threshold` and `overflow` to Claude's `auto` trigger."
  - "Publish exactly `manual` and `auto` as the compact matcher vocabulary for both PreCompact and PostCompact."
  - "Keep pre- and post-compact projection local to each owner so their direct coverage and regression evidence remain independent."

patterns-established:
  - "Closed reason projection: use the typed reason union and an equality branch instead of substring or truthiness classification."
  - "Supportability parity: the matcher closed set contains the exact values emitted by payload translation."

requirements-completed: [PDEF-08]

coverage:
  - id: D1
    description: "PreCompact independently maps manual to manual and threshold/overflow to auto, repeatably."
    requirement: PDEF-08
    verification:
      - kind: unit
        ref: "tests/bridges/hooks/payloads/pre-compact.test.ts#compact trigger cases"
        status: pass
    human_judgment: false
  - id: D2
    description: "PostCompact independently maps manual to manual and threshold/overflow to auto, repeatably."
    requirement: PDEF-08
    verification:
      - kind: unit
        ref: "tests/bridges/hooks/payloads/post-compact.test.ts#compact trigger cases"
        status: pass
    human_judgment: false
  - id: D3
    description: "The domain matcher contract publishes exactly manual and auto for both compact events."
    requirement: PDEF-08
    verification:
      - kind: unit
        ref: "tests/domain/components/hook-events.test.ts#NON_TOOL_EVENT_CLOSED_SETS"
        status: pass
    human_judgment: false

duration: 3min
completed: 2026-09-07
status: complete
---

# Phase 03 Plan 04: Compact Trigger Projection Summary

**PreCompact and PostCompact now preserve manual compaction and classify threshold or overflow compaction as automatic, with an exact matching supportability contract.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-09-07T05:05:22-04:00
- **Completed:** 2026-09-07T05:08:17-04:00
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Replaced constant `auto` payload values with typed reason-to-trigger projection in both compact translators.
- Added independent manual, threshold, and overflow cases for each owner, including repeat-call equality.
- Updated compact matcher supportability from an empty set to the exact emitted `manual | auto` vocabulary.
- Removed stale comments that claimed Pi compact events lacked trigger information.

## Task Commits

Each TDD transition and formatting correction was committed atomically:

1. **Task 1 RED: Add failing compact trigger mapping tests** - `007337ec` (test)
2. **Task 1 GREEN: Derive compact triggers from typed reasons** - `fdd7d090` (fix)
3. **Task 2 RED: Require manual and auto compact matcher values** - `4e3ac964` (test)
4. **Task 2 GREEN: Publish compact trigger matcher contract** - `a33f1cd9` (fix)
5. **Completion gate: Format compact trigger helper** - `c8d45a60` (style)

## Files Created/Modified

- `extensions/pi-claude-marketplace/bridges/hooks/payloads/pre-compact.ts` - Maps the before-compact reason into Claude's trigger vocabulary.
- `extensions/pi-claude-marketplace/bridges/hooks/payloads/post-compact.ts` - Maps the after-compact reason through the same closed projection.
- `extensions/pi-claude-marketplace/domain/components/hook-events.ts` - Publishes exact compact matcher values.
- `tests/bridges/hooks/payloads/pre-compact.test.ts` - Independently covers all before-compact reasons and repeatability.
- `tests/bridges/hooks/payloads/post-compact.test.ts` - Independently covers all after-compact reasons and repeatability.
- `tests/domain/components/hook-events.test.ts` - Locks the exact supportability vocabulary.

## Decisions Made

- Pi's `manual` reason has a direct Claude equivalent. `threshold` and `overflow` are both automatic causes and therefore collapse to `auto`.
- A pure typed function performs the projection. It has no mutable state, so repeated identical events remain deterministic.
- The compact closed sets now mirror the payload output exactly; event admission, dispatch tables, and non-compact behavior remain untouched.

## Deviations from Plan

None - the plan was executed as written.

## Issues Encountered

- The focused PreCompact source needed a mechanical Prettier correction after implementation. It was committed separately and all gates were rerun.

## Verification

- The two compact payload suites and hook-event domain suite passed together.
- Direct coverage passed at 100% lines, branches, and functions for both payload translators and `hook-events.ts`.
- `npm run typecheck` passed.
- Focused ESLint and Prettier checks passed for all six plan-owned TypeScript files.
- `npm run fallow` passed dead-code, health, and duplicate gates.
- A focused stale-text scan found no compact-specific constant-auto claim; the remaining empty-set comment describes SessionEnd.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- BHP-001 is corrected at both payload boundaries and in matcher supportability metadata.
- Wave 1 can continue with Plan 03-05.
- PDEF-08 remains phase-shared until every mapped correction plan completes.

## Self-Check: PASSED

- All six plan-owned source/test files and this summary exist.
- All five task/completion commits are present in git history.

---

_Phase: 03-production-defect-corrections_
_Completed: 2026-09-07_

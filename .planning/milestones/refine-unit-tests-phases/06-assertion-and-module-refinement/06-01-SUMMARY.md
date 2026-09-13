---
phase: 06-assertion-and-module-refinement
plan: "01"
subsystem: testing
tags: [typescript, node-test, strong-mock, notifications, cardinality]

requires:
  - phase: 05-parser-and-helper-contracts
    provides: stable parser and helper contracts for observable command output
provides:
  - exact owner-local zero, one, and many cardinality assertions
  - strict ordered lifecycle notification arrays with closed severities
affects: [06-assertion-and-module-refinement, orchestrator-tests, notification-contracts]

actuals:
  tokens: 7933
  tasks: 2
  commits: 2
plan_head_before: 596329dc9154475da2897afe814777cf8291c18e

tech-stack:
  added: []
  patterns:
    - invocation-form tables preserve structural cardinality independently of rendered row count
    - strict notification boundaries pair exact interaction counts with whole-array assertions

key-files:
  created: []
  modified:
    - tests/orchestrators/marketplace/autoupdate.test.ts
    - tests/orchestrators/marketplace/list.test.ts
    - tests/orchestrators/plugin/list.test.ts
    - tests/orchestrators/plugin/install.test.ts
    - tests/orchestrators/plugin/update.test.ts
    - tests/orchestrators/plugin/reinstall.test.ts

key-decisions:
  - "Structural invocation form remains authoritative when identical row counts require different single/plural output."
  - "Lifecycle output contracts compare complete ordered notification arrays, including severity, behind explicitly sized strict doubles."

patterns-established:
  - "Owner-local exact bytes: expected public strings live beside their producer tests and are not derived from catalog documentation."
  - "Zero notification proof: omit inert mock expectations and compare the capture to an empty array."

requirements-completed: [TREF-07]

coverage:
  - id: D1
    description: "Marketplace autoupdate, marketplace list, and plugin list preserve exact structural-cardinality output for zero, one, and many results."
    requirement: TREF-07
    verification:
      - kind: unit
        ref: "node --test tests/orchestrators/marketplace/autoupdate.test.ts tests/orchestrators/marketplace/list.test.ts tests/orchestrators/plugin/list.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Install, update, and reinstall lifecycle producers preserve exact notification count, order, payload, and severity."
    requirement: TREF-07
    verification:
      - kind: unit
        ref: "node --test tests/orchestrators/plugin/install.test.ts tests/orchestrators/plugin/update.test.ts tests/orchestrators/plugin/reinstall.test.ts"
        status: pass
    human_judgment: false

duration: 13min
completed: 2026-09-09
status: complete
---

# Phase 06 Plan 01: Assertion and Module Refinement Summary

**Structural cardinality and lifecycle notifications are now frozen as exact owner-local bytes, ordered arrays, and strict interaction counts.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-09-09T03:04:28Z
- **Completed:** 2026-09-09T03:17:25Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Table-driven equal-row autoupdate cases prove that invocation form, rather than rendered row count, selects single versus plural output.
- Marketplace and plugin list owners compare complete zero, one, and many notification payloads, including tally grammar and suffix omissions.
- Install, update, and reinstall owners compare complete ordered notification arrays and severities through explicitly sized strict doubles; zero-emission paths use empty captures.

## Task Commits

Each task was committed atomically:

1. **Task 1: Pin structural cardinality and exact marketplace/list bytes** - `c82024db` (test)
2. **Task 2: Pin lifecycle notification arrays and severities** - `71dffcd7` (test)

## Files Created/Modified

- `tests/orchestrators/marketplace/autoupdate.test.ts` - Table-drives the same-row-count single/plural counterexample.
- `tests/orchestrators/marketplace/list.test.ts` - Names and retains exact zero, one, and many list boundaries.
- `tests/orchestrators/plugin/list.test.ts` - Compares full zero, one, and many plugin-list notification arrays.
- `tests/orchestrators/plugin/install.test.ts` - Pins standalone install diagnostics and strict zero-emission orchestration.
- `tests/orchestrators/plugin/update.test.ts` - Pins targeted and bulk update notification order, bytes, and severity.
- `tests/orchestrators/plugin/reinstall.test.ts` - Pins targeted and bulk reinstall notification order, bytes, severity, and zero-emission paths.

## Decisions Made

- Structural invocation cardinality remains the source of truth even when single and plural invocations render the same number of rows.
- Expected output remains owner-local and literal; no documentation-derived values, normalization, substring matching, snapshots, or patterns replace exact bytes.
- Strict mock counts are stated per lifecycle producer because notification and tool-probe paths differ by command.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

The Phase 6 ownership moves can proceed with exact cardinality, tally, caveat, sequencing, payload, and severity contracts guarding observable behavior. No production behavior changed and no blockers remain.

---
*Phase: 06-assertion-and-module-refinement*
*Completed: 2026-09-09*

## Self-Check: PASSED

The summary, all six modified owner suites, and both recorded task commits exist.

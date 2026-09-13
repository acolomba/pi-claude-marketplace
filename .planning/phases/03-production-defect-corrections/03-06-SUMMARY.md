---
phase: 03-production-defect-corrections
plan: "06"
subsystem: install-rollback-errors
tags: [typescript, transactions, rollback, errors, containment]

requires:
  - phase: 03-production-defect-corrections
    plan: "02"
    provides: Stable install transaction and agent-staging baseline
provides:
  - Production use of transaction-owned rollback error formatting
  - Cause-preserving install rollback-partial failures
  - Live install evidence for containment, zero-partial, partial, state restoration, and retry
affects: [phase-03, plugin-install, transaction-rollback, failure-notifications]

actuals:
  tokens: 8500
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - Transaction owner selects error identity and cause wrapping before notification projection
    - Live retry tests pair exact failure output with state and filesystem restoration

key-files:
  created:
    - .planning/phases/03-production-defect-corrections/03-06-SUMMARY.md
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
    - tests/orchestrators/plugin/install.test.ts

key-decisions:
  - "`formatRollbackError` is the sole production rule for containment suppression, zero-partial identity, and partial cause wrapping."
  - "Install messaging only projects the formatter's error and raw rollback rows; it no longer independently decides containment or wrapping."
  - "The transaction owner matrix required no new cases because it already directly covers containment subclasses, zero, one, and multiple partials."

patterns-established:
  - "Transaction semantics are decided before presentation-layer classification."
  - "Partial rollback adds one wrapper while preserving the original error and its existing cause chain."

requirements-completed: [PDEF-08]

coverage:
  - id: D1
    description: "Install delegates failed ledger results to `formatRollbackError` and uses its returned error and raw partial rows."
    requirement: PDEF-08
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/install.test.ts"
        status: pass
      - kind: other
        ref: "Direct coverage for orchestrators/plugin/install.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Containment and zero-partial failures preserve their error object while partial failures wrap once with cause."
    requirement: PDEF-08
    verification:
      - kind: unit
        ref: "tests/transaction/rollback.test.ts and tests/orchestrators/plugin/install.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Failed install restores state and a subsequent live install converges successfully."
    requirement: PDEF-08
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/install.test.ts#retry proof"
        status: pass
    human_judgment: false

duration: 6min
completed: 2026-09-07
status: complete
---

# Phase 03 Plan 06: Transaction-Owned Install Rollback Errors Summary

**Install now delegates rollback error identity, containment suppression, and partial wrapping to the transaction owner before rendering failures.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-09-07T06:00:40-04:00
- **Completed:** 2026-09-07T06:06:47-04:00
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Wired the existing `formatRollbackError` helper into the live failed-ledger path.
- Removed install's duplicate containment-versus-partial decision.
- Proved partial failures carry the original error as `cause`, while ordinary and containment failures remain unwrapped.
- Preserved exact rollback-child output, state restoration, filesystem behavior, and successful retry.

## Task Commits

1. **Task 1 RED: Expose missing install cause wrapper** - `a07441f3` (test)
2. **Task 1 GREEN: Delegate install rollback shaping to transaction owner** - `8fedcbcc` (fix)

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` - Calls `formatRollbackError`, captures its rows, and throws its selected error.
- `tests/orchestrators/plugin/install.test.ts` - Pins wrapper cause structure, unwrapped ordinary and containment errors, exact output, rollback, and retry.

## Decisions Made

- Kept structured rollback rows separate from error cause wrapping; the transaction helper returns both and the renderer retains ownership of row bytes.
- Allowed the new wrapper to expose the already-preserved original cause chain, producing the intended ES-4 chained diagnostic on partial failures.
- Retained the existing transaction tests unchanged because they already assert object identity, subclass behavior, wrapper cause identity, raw row-array identity, and multi-row order.

## Deviations from Plan

### The transaction owner suite needed no additional cases

- Its current five cases cover ordinary zero-partial errors, `PathContainmentError`, the `SymlinkRefusedError` subclass, one partial, and multiple/repeated partial rows.
- Adding equivalent cases would duplicate direct evidence without strengthening the terminal matrix.

## Issues Encountered

- The new ES-4 wrapper extends the exact cause chain on rollback-partial install output. The owner assertion was updated to the intentional wrapper-to-original chain while preserving each rollback child exactly once.

## Verification

- Install passed 136/136 owner tests.
- Install and transaction rollback suites passed together.
- Direct coverage passed at 100% lines, branches, and functions for `install.ts`.
- `npm run typecheck` passed.
- Focused ESLint and Prettier checks passed.
- `npm run fallow` passed with zero health-threshold violations and the existing authorized suppression unchanged.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- TXA-F001 and PDEF-08 are closed at both the transaction and live install owners.
- Wave 2 can continue with Plan 03-12.

## Self-Check: PASSED

- The production formatter has a live caller.
- Both task commits and every referenced test file are present.

---

_Phase: 03-production-defect-corrections_
_Completed: 2026-09-07_

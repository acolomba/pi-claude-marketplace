---
phase: 108-domain-and-platform
plan: 12
subsystem: domain
tags: [typescript, oauth, device-flow, contract-tests, direct-coverage]
requires:
  - phase: 108-21
    provides: Structural supplemental classification and planted-defect pattern
provides:
  - Hermetic production device-flow owner at 100 percent direct coverage
  - Shared ordered 10-case production and fake contract
  - Guarded concern-local device-flow fake
  - Exact non-consuming response planted-defect proof
affects: [108-22, 108-02, 108-03, 108-04, 108-05, 108-07, 108-23]
tech-stack:
  added: []
  patterns:
    - Shared callable public-flow contract with fresh explicit boundary factories
    - Context-owned fetch and fake timers with no live network or real delay
key-files:
  created:
    - tests/domain/device-flow-contract.ts
    - tests/domain/device-flow-fake.ts
    - tests/domain/device-flow-fake.test.ts
    - .planning/phases/108-domain-and-platform/108-12-SUMMARY.md
  modified:
    - tests/domain/github-auth.test.ts
key-decisions:
  - Keep the private production transport private and test production parity through exported initiateDeviceFlow with a context-owned fetch boundary.
  - Put pending, slow_down, and success ordering in one sensitivity case so non-consumption fails exactly one invariant.
patterns-established:
  - Require explicit memory and network-disabled options at the fake factory boundary.
  - Pair callable contract cases with a literal ordered manifest and an exact one-case broken-fake assertion.
requirements-completed: [MOD-01, PRES-03, PRES-04]
actuals:
  tokens: 10333
  tasks: 3
  commits: 3
duration: 27min
completed: 2026-08-29
status: complete
---

# Phase 108 Plan 12: Device Flow Contract Carrier Summary

**OAuth device flow now has a hermetic production owner, a shared 10-case production/fake contract, and a planted defect that isolates response consumption.**

## Performance

- **Duration:** 27 minutes
- **Started:** 2026-08-29T11:52:20Z
- **Completed:** 2026-08-29T12:18:50Z
- **Tasks:** 3
- **Files changed:** 4 implementation and test files
- **Estimated tokens:** 62,000
- **Actual tokens:** 10,333, measured as changed diff characters divided by four

## Accomplishments

- Made every production polling path case-owned and hermetic. The suite records waits instead of using live time and restores every fetch replacement.
- Added one ordered 10-case contract that drives both the exported production flow and the guarded concern-local fake through fresh factories.
- Proved contract sensitivity with a private non-consuming fake. It fails exactly `consumes polling responses in order` and passes the other nine cases.
- Reached 100 percent direct coverage for `github-auth.ts`: 78 of 78 branches, 10 of 10 functions, and 439 of 439 lines.
- Preserved the locked lowercase AAA format: 32 separate arrange/act/assert triples and two valid single-expression combined cases.

## Task Commits

Each task was committed as a separate unit:

1. **Task 1: Normalize the production owner and lock injected HTTP mechanics** - `8ffad823`
2. **Task 2: Add the shared device-flow contract, guarded fake, and exact negative control** - `627381a0`
3. **Task 3: Close direct coverage and complete the carrier gates** - `f911466b`

## Files Created or Modified

- `tests/domain/github-auth.test.ts` - Runs the shared contract through the exported production flow and uses case-owned fetch, wait, and timer controls.
- `tests/domain/device-flow-contract.ts` - Defines the ordered case manifest, callable cases, registrar, and production participant.
- `tests/domain/device-flow-fake.ts` - Defines the guarded in-memory fake with snapshot and queue-consumption behavior.
- `tests/domain/device-flow-fake.test.ts` - Runs the shared fake contract and checks the exact planted-defect failure set.

## Decisions Made

- The production participant uses `initiateDeviceFlow`. Private transport functions remain private.
- The production participant replaces fetch through each test context and returns a fresh `Response` for every request.
- The ordering invariant covers `authorization_pending`, `slow_down`, and success in one case. This keeps the non-consuming planted defect surgical.
- Runtime input validation does not apply to the typed concern-local contract factory. The production owner keeps remote payload, HTTP, polling, cancellation, and thrown-error coverage.

## Verification

- Focused production and fake suites pass.
- Type checking, targeted lint, formatting, and negative correspondence fixtures pass.
- Plan-local correspondence classification reports zero violations.
- Direct coverage passes at 100 percent for branches, functions, and lines.
- The elevated full check passes with 3,897 unit tests: 3,896 passed, one intentional skip, and zero failures. All 21 integration tests pass.
- The exact planted-defect failure set is `["consumes polling responses in order"]`.
- The AAA audit finds 32 lowercase separate triples and two valid lowercase combined cases. It finds no uppercase markers or skipped owned tests.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Serialized fresh production participant creation**

- **Found during:** Task 2 contract validation
- **Issue:** The fresh-state case created two production participants before it ran either participant. The second context fetch replacement could shadow the first replacement.
- **Fix:** Create and run each fresh participant in sequence so each case owns its active fetch boundary.
- **Files modified:** `tests/domain/device-flow-contract.ts`
- **Commit:** `627381a0`

**2. [Rule 3 - Blocking] Covered the private default-wait branches without real time**

- **Found during:** Task 3 direct-coverage gate
- **Issue:** Injecting a wait into every ordinary polling case left the private default timer implementation and its abort branch uncovered.
- **Fix:** Add two context-owned fake-timer cases for the default interval tick and abort-signal cancellation.
- **Files modified:** `tests/domain/github-auth.test.ts`
- **Commit:** `f911466b`

## Baseline Gate Findings

- The repository-wide correspondence scan still reports 101 known Phase 108 migration items. Neither owned test file appears in the plan-local result.
- The repository-wide all-pair direct-coverage scan stops at the known missing `tests/bridges/agents/index.test.ts` pair. The plan-owned source passes its direct gate independently.
- The sandboxed full check reproduced the three known loopback-restricted suites. The elevated rerun passed all unit and integration tests.

## Known Stubs

None.

## Next Phase Readiness

- Plans 108-02, 108-03, 108-04, 108-05, and 108-07 can migrate consumers only after Plan 108-22 stabilizes all replacement APIs.
- Plan 108-23 owns the final no-reference proof and generic helper deletion.
- This plan establishes the device-flow carrier. It does not claim that the D-07 relocation and deletion work is complete.

## Self-Check: PASSED

- All four plan-owned implementation and test files exist.
- All three task commits exist in this worktree.
- The summary, ordered 10-case manifest, and exact response-consumption invariant agree.

---

_Phase: 108-domain-and-platform_
_Completed: 2026-08-29_

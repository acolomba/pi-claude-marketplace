---
phase: 112-hook-runtime
plan: 21
subsystem: hook-runtime
tags: [typescript, node-test, payload-translator, session-start, direct-coverage]
requires:
  - phase: 112-hook-runtime
    provides: Locked payload exactness and direct owner contract
provides:
  - Exact five-key SessionStart envelopes for all five declared start sources
  - Accepted empty session, transcript, and working-directory value proof
affects:
  - 112-04 dispatch-exec and translator supplemental carrier
  - MOD-05 hook-runtime verification
actuals:
  tokens: 1523
  tasks: 2
  commits: 3
tech-stack:
  added: []
  patterns:
    - Complete case-local typed translator inputs with independently authored whole-envelope expectations
    - Separate sibling cases for each source and the accepted empty-context partition
key-files:
  created: []
  modified:
    - tests/bridges/hooks/payloads/session-start.test.ts
key-decisions:
  - Kept session-start.ts byte-for-byte unchanged because translate exposes the complete payload contract through its public signature.
  - Used one explicit sibling case for each start source instead of a shared loop or data table.
  - Kept malformed input behavior in Plan 112-04 and left the supplemental translator suite unchanged.
patterns-established:
  - SessionStart cases compare complete five-key envelopes against independent literal expectations.
  - Every source and empty-context case owns its typed input, context, and lowercase runtime phases.
requirements-completed: [MOD-05]
coverage:
  - id: D1
    description: A typed session start emits the exact five-key SessionStart envelope with unchanged context and source values.
    requirement: MOD-05
    verification:
      - kind: unit
        ref: tests/bridges/hooks/payloads/session-start.test.ts#emits the complete SessionStart envelope with the startup source
        status: pass
    human_judgment: false
  - id: D2
    description: Every declared start source and accepted empty context value is preserved in an independently authored envelope.
    requirement: MOD-05
    verification:
      - kind: unit
        ref: npm run test:coverage:direct -- tests/bridges/hooks/payloads/session-start.test.ts
        status: pass
    human_judgment: false
duration: 8 min
completed: 2026-08-31
status: complete
---

# Phase 112 Plan 21: SessionStart payload summary

**The owner proves every declared start source and accepted empty context value in exact SessionStart envelopes at 100% direct coverage.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-08-31T05:32:00Z
- **Completed:** 2026-08-31T05:40:00Z
- **Tasks:** 2
- **Files modified:** 1 test file

## Accomplishments

- Replaced shared test data with six independent, typed SessionStart cases.
- Asserted exact five-key envelopes for all five declared start sources and the accepted empty-context partition.
- Proved that session, transcript, working-directory, and source values cross the translator unchanged.

## Task Commits

1. **Task 1: Prove one complete SessionStart payload** - `5cf06620`
2. **Task 2: Cover source and accepted empty-value branches** - `f11ef410`

## Files Created/Modified

- `tests/bridges/hooks/payloads/session-start.test.ts` - Complete source and empty-context envelopes with typed case-local inputs and lowercase phases.

## Decisions Made

- Left `extensions/pi-claude-marketplace/bridges/hooks/payloads/session-start.ts` byte-for-byte unchanged.
- Used one sibling case per declared source so each failure identifies its exact public partition.
- Used a dedicated `startup` case to isolate accepted empty session, transcript, and working-directory strings.
- Kept malformed input behavior in Plan 112-04.
- Left `tests/architecture/hooks-translators.test.ts` unchanged for its designated Plan 112-04 carrier.
- Kept the phase-wide `MOD-05` requirement pending until all 31 Phase 112 owners complete.

## Verification

- `node --test tests/bridges/hooks/payloads/session-start.test.ts` passed.
- `npm run test:coverage:direct -- tests/bridges/hooks/payloads/session-start.test.ts` passed with 2/2 branches, 1/1 function, and 33/33 lines.
- `npm run typecheck` passed.
- The acceptance audit found 6 cases, 6 whole-envelope assertions, and matching lowercase arrange, act, and assert phases.
- Both task commits modify only the owner test. Production and the translator supplemental suite remain unchanged.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

The orchestrator retained commit ownership and created both atomic task commits without changing the plan scope.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None. The empty strings are explicit contract inputs, not runtime placeholders.

## Security Review

Complete envelopes detect extra wire fields and session-value drift at the lifecycle boundary. This plan adds no security-relevant runtime surface.

## Next Phase Readiness

Plan 112-04 can retain only the cross-module translator-table contract after all payload owners complete.

## Self-Check: PASSED

- The direct owner and canonical summary exist.
- Task commits `5cf06620` and `f11ef410` exist in the correct order.
- Both task commits modify only `tests/bridges/hooks/payloads/session-start.test.ts`.
- Production and the translator supplemental suite are unchanged.
- Focused tests, direct coverage, typecheck, acceptance, and coverage-metadata checks pass.

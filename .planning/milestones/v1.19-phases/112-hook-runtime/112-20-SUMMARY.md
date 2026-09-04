---
phase: 112-hook-runtime
plan: 20
subsystem: hook-runtime
tags: [typescript, node-test, payload-translator, session-end, direct-coverage]
requires:
  - phase: 112-hook-runtime
    provides: Locked payload exactness and direct owner contract
provides:
  - Exact five-key SessionEnd envelopes for all five declared shutdown reasons
  - Accepted empty session, transcript, and working-directory value proof
affects:
  - 112-04 dispatch-exec and translator supplemental carrier
  - MOD-05 hook-runtime verification
actuals:
  tokens: 1456
  tasks: 2
  commits: 3
tech-stack:
  added: []
  patterns:
    - Complete case-local typed translator inputs with independently authored whole-envelope expectations
    - Separate sibling cases for each reason and the accepted empty-context partition
key-files:
  created: []
  modified:
    - tests/bridges/hooks/payloads/session-end.test.ts
key-decisions:
  - Kept session-end.ts byte-for-byte unchanged because translate exposes the complete payload contract through its public signature.
  - Used one explicit sibling case for each shutdown reason instead of a shared loop or data table.
  - Included target session files for new, resume, and fork inputs while proving that the five-key outgoing envelope omits those input-only fields.
  - Kept malformed translator input in Plan 112-04 and left the supplemental translator suite unchanged.
patterns-established:
  - SessionEnd cases compare complete five-key envelopes against independent literal expectations.
  - Every reason and empty-context case owns its typed input, context, and lowercase runtime phases.
requirements-completed: [MOD-05]
coverage:
  - id: D1
    description: A typed session shutdown emits the exact five-key SessionEnd envelope with unchanged context and reason values.
    requirement: MOD-05
    verification:
      - kind: unit
        ref: tests/bridges/hooks/payloads/session-end.test.ts#emits the complete SessionEnd envelope with the quit reason
        status: pass
    human_judgment: false
  - id: D2
    description: Every declared shutdown reason and accepted empty context value is preserved in an independently authored envelope.
    requirement: MOD-05
    verification:
      - kind: unit
        ref: npm run test:coverage:direct -- tests/bridges/hooks/payloads/session-end.test.ts
        status: pass
    human_judgment: false
duration: 5 min
completed: 2026-08-31
status: complete
---

# Phase 112 Plan 20: SessionEnd payload summary

**The owner proves every declared shutdown reason and accepted empty context value in exact SessionEnd envelopes at 100% direct coverage.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-08-31T05:22:51Z
- **Completed:** 2026-08-31T05:27:49Z
- **Tasks:** 2
- **Files modified:** 1 test file

## Accomplishments

- Replaced the shared context and reason loop with six independent, typed SessionEnd cases.
- Asserted exact five-key envelopes for all five declared shutdown reasons and the accepted empty-context partition.
- Proved that target session files remain input-only while context and reason values cross the translator unchanged.

## Task Commits

1. **Task 1: Prove a complete SessionEnd translation** - `9f49dd31`
2. **Task 2: Cover the declared reason and empty-value partitions** - `25d025fc`

## Files Created/Modified

- `tests/bridges/hooks/payloads/session-end.test.ts` - Complete reason and empty-context envelopes with typed case-local inputs and lowercase phases.

## Decisions Made

- Left `extensions/pi-claude-marketplace/bridges/hooks/payloads/session-end.ts` byte-for-byte unchanged.
- Used one sibling case per declared reason so each failure identifies its exact public partition.
- Added target session files to the `new`, `resume`, and `fork` inputs while keeping the expected wire shape at exactly five keys.
- Used a dedicated `quit` case to isolate accepted empty session, transcript, and working-directory strings.
- Kept malformed input behavior in Plan 112-04.
- Left `tests/architecture/hooks-translators.test.ts` unchanged for its designated Plan 112-04 carrier.
- Kept the phase-wide `MOD-05` requirement pending until all 31 Phase 112 owners complete.

## Verification

- `node --test tests/bridges/hooks/payloads/session-end.test.ts` passed after both tasks and at plan completion.
- `npm run test:coverage:direct -- tests/bridges/hooks/payloads/session-end.test.ts` passed with 2/2 branches, 1/1 function, and 32/32 lines.
- `npm run typecheck` passed.
- The acceptance audit found 6 cases, 6 whole-envelope assertions, and matching lowercase arrange, act, and assert phases.
- Production, supplemental architecture suites, and all files outside the owner remained unchanged.
- The tracer feedback check passed before Task 2 started.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

The checkout branch did not satisfy the executor worktree commit allow-list. The orchestrator retained commit ownership and created both atomic task commits without changing the plan scope.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None.

## Security Review

The complete envelopes detect extra wire fields and session-value drift at the lifecycle boundary. This plan adds no production, network, process, filesystem, authentication, or schema surface.

## Next Phase Readiness

Plan 112-04 can retain only the cross-module translator-table contract after all payload owners complete.

## Self-Check: PASSED

- The direct owner and canonical summary exist.
- Task commits `9f49dd31` and `25d025fc` exist.
- Both task commits modify only `tests/bridges/hooks/payloads/session-end.test.ts`.
- Production and the translator supplemental suite are unchanged.
- Focused tests, direct coverage, typecheck, acceptance, and coverage-metadata checks pass.

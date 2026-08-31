---
phase: 112-hook-runtime
plan: 27
subsystem: hook-runtime
tags: [typescript, node-test, child-process, utf8, serialization, direct-coverage]
requires:
  - phase: 112-hook-runtime
    provides: Locked subprocess fidelity, payload serialization, and direct owner contracts
provides:
  - Exact exec-form and shell-form spawn planning across argument and command boundaries
  - Complete 256 KiB UTF-8 serialization boundaries, truncation precedence, wrapping, and non-mutation proof
affects:
  - 112-02 async-rewake subprocess ownership
  - 112-04 dispatch-exec subprocess ownership
  - MOD-05 hook-runtime verification
actuals:
  tokens: 3093
  tasks: 2
  commits: 3
tech-stack:
  added: []
  patterns:
    - Complete case-local RoutingEntry values with independent whole SpawnPlan expectations
    - Exact UTF-8 byte-boundary inputs paired with independently authored serialized envelopes
key-files:
  created:
    - tests/bridges/hooks/spawn-helpers.test.ts
  modified: []
key-decisions:
  - Kept spawn-helpers.ts byte-for-byte unchanged because its public helpers expose the complete execution-form and serialization contracts.
  - Treated defined args, including an empty array, as exec form with shell disabled; absent args retain shell-form behavior.
  - Made the truncation marker authoritative without mutating object, primitive, or array inputs and accepted the documented envelope overshoot.
patterns-established:
  - Spawn-helper cases compare complete plans and serialized bytes from fresh case-local inputs.
  - Runtime evidence uses separate lowercase arrange, act, and assert phases.
requirements-completed: [MOD-05]
coverage:
  - id: D1
    description: Spawn planning distinguishes defined args from absent args and preserves exact command, argv, and shell behavior across mixed, empty, explicit-shell, and missing-command inputs.
    requirement: MOD-05
    verification:
      - kind: unit
        ref: tests/bridges/hooks/spawn-helpers.test.ts#uses exec form and stringifies mixed primitive arguments when args are present
        status: pass
      - kind: unit
        ref: tests/bridges/hooks/spawn-helpers.test.ts#uses exec form when args are an empty array
        status: pass
      - kind: unit
        ref: tests/bridges/hooks/spawn-helpers.test.ts#uses the default shell form when args are absent
        status: pass
    human_judgment: false
  - id: D2
    description: Hook payload serialization enforces the 256 KiB UTF-8 decision boundary, authoritative truncation metadata, defensive wrapping, and source non-mutation.
    requirement: MOD-05
    verification:
      - kind: unit
        ref: tests/bridges/hooks/spawn-helpers.test.ts#preserves an object serialized at the exact stdin cap
        status: pass
      - kind: unit
        ref: tests/bridges/hooks/spawn-helpers.test.ts#marks an object serialized one byte over the cap with the permitted overshoot
        status: pass
      - kind: unit
        ref: tests/bridges/hooks/spawn-helpers.test.ts#counts multibyte text by UTF-8 bytes before marking it truncated
        status: pass
      - kind: unit
        ref: npm run test:coverage:direct -- tests/bridges/hooks/spawn-helpers.test.ts
        status: pass
    human_judgment: false
duration: 19 min
completed: 2026-08-31
status: complete
---

# Phase 112 Plan 27: Spawn helper summary

**The direct owner proves exact shell-versus-exec planning and every 256 KiB UTF-8 truncation boundary at 100% coverage.**

## Performance

- **Duration:** 19 min
- **Started:** 2026-08-31T06:30:10Z
- **Completed:** 2026-08-31T06:49:08Z
- **Tasks:** 2
- **Files modified:** 1 test file

## Accomplishments

- Proved exact exec-form planning for mixed primitive arguments and empty argument arrays, with `shell: false` overriding any declared shell.
- Proved default and explicit shell-form planning when args are absent, including missing and explicitly empty command boundaries.
- Exhausted below-cap, exact-cap, one-byte-over, and multibyte UTF-8 serialization outcomes together with authoritative truncation metadata, permitted overshoot, defensive wrapping, and source non-mutation.

## Task Commits

1. **Task 1: Lock shell-form and exec-form planning** - `882ef810`
2. **Task 2: Exhaust 256 KiB UTF-8 serialization boundaries** - `3223a68a`

## Files Created/Modified

- `tests/bridges/hooks/spawn-helpers.test.ts` - Complete direct-owner evidence for spawn-plan selection and bounded hook payload serialization.

## Decisions Made

- Left `extensions/pi-claude-marketplace/bridges/hooks/spawn-helpers.ts` byte-for-byte unchanged.
- Used `args` field presence, not non-empty length, as the execution-form discriminator and asserted complete returned plans.
- Authored expected serialized strings independently from production output while using `Buffer.byteLength` only to prove input and output byte boundaries.
- Preserved `_truncated: true` as the authoritative marker, including a conflicting source field, without mutating ordinary objects or arrays.
- Kept inter-stream ordering outside this pure helper owner and retained its cross-module coverage in the owning subprocess plans.
- Kept the phase-wide `MOD-05` requirement pending until all 31 Phase 112 owners complete.

## Validation

- `node --test tests/bridges/hooks/spawn-helpers.test.ts` passed.
- `npm run test:coverage:direct -- tests/bridges/hooks/spawn-helpers.test.ts` passed with 15/15 branches, 3/3 functions, and 85/85 lines.
- `npm run typecheck` passed.
- All fourteen runtime cases use matching lowercase arrange, act, and assert phases; no skip, todo, coverage exception, or fabricated stream-order assertion was added.
- Both task commits exist in a contiguous parent-child sequence and modify only the direct owner test.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

The orchestrator retained commit ownership and created both atomic task commits without changing the plan scope.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None. Missing and empty commands, empty argument arrays, and boundary-sized payloads are explicit contract inputs.

## Security Review

Exact `shell: false` assertions keep args-present commands out of shell interpretation, while byte-accurate truncation cases constrain oversized untrusted hook payloads. This plan adds no runtime or trust-boundary surface.

## Next Phase Readiness

The direct spawn-helper owner is ready for phase-wide MOD-05 verification; process event ordering and delivery remain with Plans 112-02 and 112-04.

## Self-Check: PASSED

- The direct owner and canonical summary exist.
- Task commits `882ef810` and `3223a68a` exist in the correct order.
- Both task commits modify only the direct owner test.
- Production and supplemental suites are unchanged.
- Focused tests, direct coverage, typecheck, acceptance, and coverage-metadata checks pass.

---
phase: 112-hook-runtime
plan: 31
subsystem: hook-runtime
tags: [typescript, node-test, wire-protocol, decision-precedence, direct-coverage]
requires:
  - phase: 112-hook-runtime
    provides: Locked subprocess diagnostics, decision control, payload exactness, and direct owner contracts
provides:
  - Exact exit-status, JSON-shape, diagnostic, and top-level precedence evidence
  - Exhaustive nested-deny, mutation-field, reason-typing, suppression, whitelist, and no-op evidence
  - Complete wire-protocol direct coverage without production or public-surface changes
affects:
  - 112-04 dispatch-exec subprocess interpretation
  - 112-07 dispatch and mutation routing
  - MOD-05 hook-runtime verification
actuals:
  tokens: 5020
  tasks: 2
  commits: 3
tech-stack:
  added: []
  patterns:
    - Complete case-local exit, stdout, and stderr inputs with independently authored whole outcomes
    - Targeted conflicting wire objects that prove precedence without a shared scenario oracle
key-files:
  created: []
  modified:
    - tests/bridges/hooks/wire-protocol.test.ts
key-decisions:
  - Kept wire-protocol.ts byte-for-byte unchanged because parseHookStdout exposes every live exit, JSON-shape, precedence, mutation, and no-op branch through its public result.
  - Proved semantic diagnostics by category, hook destination, relevant detail, and outcome while separately asserting that reporting never throws.
  - Kept every wire case independent and explicit instead of generalizing the mutation contract through a table or shared oracle.
patterns-established:
  - Wire cases use complete literal process outputs and compare independently authored complete HookExecResult values.
  - Precedence is proved through deliberate conflicts from exit status through top-level, nested, mutation, and suppression tiers.
requirements-completed: [MOD-05]
coverage:
  - id: D1
    description: Exit status, empty and malformed output, JSON root shapes, semantic diagnostics, and top-level stop/block precedence resolve to exact never-throwing outcomes.
    requirement: MOD-05
    verification:
      - kind: unit
        ref: tests/bridges/hooks/wire-protocol.test.ts#defaults malformed JSON to noop and reports its semantic diagnostic
        status: pass
      - kind: unit
        ref: tests/bridges/hooks/wire-protocol.test.ts#gives top-level stop precedence over top-level block and nested output
        status: pass
    human_judgment: false
  - id: D2
    description: Nested deny, every allowed mutation field, mutation conflicts, suppression precedence, reason typing, wrong-type omission, whitelist rejection, and final no-op behavior have exact outcomes.
    requirement: MOD-05
    verification:
      - kind: unit
        ref: tests/bridges/hooks/wire-protocol.test.ts#gives a nested deny precedence over every mutation field and output suppression
        status: pass
      - kind: unit
        ref: tests/bridges/hooks/wire-protocol.test.ts#retains every mutation field together before output suppression
        status: pass
      - kind: unit
        ref: npm run test:coverage:direct -- tests/bridges/hooks/wire-protocol.test.ts
        status: pass
    human_judgment: false
  - id: D3
    description: The wire owner reaches complete direct branch, function, and line coverage with lowercase phases and no production or public-surface change.
    requirement: MOD-05
    verification:
      - kind: other
        ref: npm run typecheck
        status: pass
      - kind: other
        ref: git diff f6b6a037^..59cb6429 -- extensions/pi-claude-marketplace/bridges/hooks/wire-protocol.ts
        status: pass
    human_judgment: false
duration: 17 min
completed: 2026-08-31
status: complete
---

# Phase 112 Plan 31: Wire protocol summary

**The direct owner now proves the complete exit-to-decision wire contract, fixed precedence, strict mutation surface, semantic diagnostics, and final fallback at 100% coverage without changing production.**

## Performance

- **Duration:** 17 min
- **Started:** 2026-08-31T07:58:00Z
- **Completed:** 2026-08-31T08:15:00Z
- **Tasks:** 2
- **Files modified:** 1 test file

## Accomplishments

- Exhausted exit 2, another nonzero exit, signal-kill, empty output, malformed JSON, primitive JSON, null JSON, and object input with exact whole outcomes and never-throwing semantic diagnostics.
- Proved the full decision order: exit status before stdout, top-level stop before block, top-level decisions before nested output, nested deny before mutation, mutation before suppression, then suppression before final no-op.
- Covered every allowed mutation field, combined-field conflicts, allow and ask reasons, wrong-type omission, unrecognized-field rejection, and exact no-op fallback at 57/57 branches, 5/5 functions, and 169/169 lines.

## Task Commits

1. **Task 1: Exhaust exit status, JSON shape, and top-level precedence** - `f6b6a037`
2. **Task 2: Exhaust nested decisions, mutation whitelist, typing, and no-op** - `59cb6429`

## Files Created/Modified

- `tests/bridges/hooks/wire-protocol.test.ts` - Complete direct-owner evidence for process-output validation, diagnostics, decision precedence, mutations, type omission, suppression, and fallback behavior.

## Decisions Made

- Left `extensions/pi-claude-marketplace/bridges/hooks/wire-protocol.ts` byte-for-byte unchanged because its public parser exposes every live branch without a test-only seam or wider export.
- Authored each case with complete local exit, stdout, and stderr values plus a literal whole result; no mutation table, shared scenario factory, or production-derived expectation was introduced.
- Captured diagnostics through the current test context, restored the debug environment case-locally, and asserted category, destination, relevant detail, and fallback outcome rather than incidental complete wording.
- Used targeted conflicting JSON objects to prove only stable decision precedence and did not fabricate ordering between subprocess stdout and stderr streams.
- Kept the phase-wide `MOD-05` requirement pending until all 31 Phase 112 owners complete.

## Validation

- `node --test tests/bridges/hooks/wire-protocol.test.ts` passed with no failed, skipped, or todo tests.
- `npm run test:coverage:direct -- tests/bridges/hooks/wire-protocol.test.ts` passed with 57/57 branches, 5/5 functions, and 169/169 lines for `wire-protocol.ts`; its imported debug logger also reached 100%.
- `npm run typecheck` passed.
- Targeted ESLint and Prettier checks passed for the wire-protocol owner.
- All 26 runtime cases use separate lowercase arrange, act, and assert phases; no combined phase, data table, skip, todo, snapshot, coverage exception, or shared scenario oracle was added.
- Commits `f6b6a037` and `59cb6429` form a contiguous parent-child sequence and each modifies only the planned wire-protocol owner test.
- The production wire-protocol module has an empty diff across both task commits.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None. Empty output, null exit status, null JSON, omitted reasons, and final no-op values are explicit wire-contract inputs and outcomes rather than placeholders.

## Security Review

The exhaustive precedence, strict mutation whitelist, wrong-type omission, malformed-input containment, and no-op evidence implements the planned T-112-06 mitigation for untrusted child-process output. The plan changes no production code, runtime API, parser surface, network endpoint, file access path, or trust boundary.

## Next Phase Readiness

The wire-protocol owner is ready for phase-wide MOD-05 verification and provides the exact parse contract consumed by Plan 112-04 dispatch-exec and Plan 112-07 dispatch routing.

## Self-Check: PASSED

- The direct owner and canonical summary exist.
- Task commits `f6b6a037` and `59cb6429` exist in a contiguous parent-child sequence.
- Both task commits modify only `tests/bridges/hooks/wire-protocol.test.ts`; production is unchanged.
- Focused tests, 100% direct coverage, typecheck, targeted lint, targeted format, diff, ordered-commit, and coverage-metadata checks pass.

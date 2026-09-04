---
phase: 108-domain-and-platform
plan: 23
subsystem: testing/platform
tags: [typescript, node-test, pi-api, compile-time-contracts, direct-coverage, hermetic-tests]

requires:
  - phase: 108-domain-and-platform
    provides: Concern-local fake migrations from plans 108-02 through 108-07, 108-12, 108-21, and 108-22
provides:
  - Hermetic runtime ownership for the Pi API boundary
  - Compile-time evidence for Pi API structural types and literal aliases
  - Removal of the three unused generic adapter helpers
  - Structural correspondence evidence for all 23 Phase 108 owner paths
affects: [109-shared-contracts, generic-helper-policy]

tech-stack:
  added: []
  patterns:
    - Restore process environment state with node:test cleanup hooks
    - Keep type-only contract evidence at module scope
    - Prove zero consumers before deleting a shared helper

key-files:
  created:
    - .planning/phases/108-domain-and-platform/108-23-SUMMARY.md
  modified:
    - tests/platform/pi-api.test.ts
    - tests/helpers/git-mock.ts
    - tests/helpers/credential-mock.ts
    - tests/helpers/device-flow-mock.ts

key-decisions:
  - "Set PI_CODING_AGENT_DIR to an explicit temporary path and restore it after the test so runtime probes never read developer state."
  - "Express interface and literal-union evidence at module scope with satisfies and targeted @ts-expect-error directives."
  - "Delete each generic helper only after a corrected exclusion scan proves that no consumer path remains."

requirements-completed: [MOD-01]

coverage:
  - id: D1
    description: Pi API runtime probes are hermetic and retain complete direct coverage.
    requirement: MOD-01
    verification:
      - kind: unit
        ref: "node --test tests/platform/pi-api.test.ts"
        status: pass
      - kind: unit
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/platform/pi-api.ts (12/12 branches, 5/5 functions, 163/163 lines)"
        status: pass
    human_judgment: false
  - id: D2
    description: Pi API structural and literal contracts have positive and negative compile-time evidence.
    requirement: MOD-01
    verification:
      - kind: other
        ref: "npm run typecheck"
        status: pass
    human_judgment: false
  - id: D3
    description: Generic adapter helpers are absent after consumer migrations, and every Phase 108 owner path has a structural counterpart.
    requirement: MOD-01
    verification:
      - kind: other
        ref: "Corrected zero-reference scan for tests/helpers/git-mock.ts, tests/helpers/credential-mock.ts, and tests/helpers/device-flow-mock.ts"
        status: pass
      - kind: other
        ref: "Phase 108 structural correspondence check (23/23 owner paths)"
        status: pass
      - kind: other
        ref: "npm run check"
        status: pass
    human_judgment: false

actuals:
  tokens: 7203
  tasks: 3
  commits: 3

duration: 20 min
completed: 2026-08-29
status: complete
---

# Phase 108 Plan 23: Pi API owner and helper relocation summary

**Hermetic Pi API runtime and type-contract ownership now replaces the final generic adapter helpers, with complete direct coverage and Phase 108 structural correspondence.**

## Performance

- **Duration:** 20 min
- **Started:** 2026-08-29T14:16:56Z
- **Completed:** 2026-08-29T14:37:16Z
- **Tasks:** 3
- **Files changed:** 5

## Accomplishments

- Made the Pi agent-directory probe independent of developer configuration and restored the environment after each test.
- Added positive and negative compile-time evidence for Pi API messages, events, stop reasons, and related structural contracts.
- Removed the three unused generic adapter helpers after a corrected scan proved that no consumer paths remained.
- Confirmed that all 23 Phase 108 owner paths have structural test counterparts.

## Task Commits

Each task was committed atomically:

1. **Task 1: Normalize Pi API runtime probes** - `d9ced88a` (test)
2. **Task 2: Lock Pi API type contracts** - `ae3a3a73` (test)
3. **Task 3: Remove generic adapter helpers** - `73e2a443` (test)

## Files Created/Modified

- `.planning/phases/108-domain-and-platform/108-23-SUMMARY.md` - Records execution, verification, and handoff evidence.
- `tests/platform/pi-api.test.ts` - Owns hermetic runtime probes and module-scope type-contract evidence.
- `tests/helpers/git-mock.ts` - Deleted after its concern-local replacements removed all consumers.
- `tests/helpers/credential-mock.ts` - Deleted after its concern-local replacements removed all consumers.
- `tests/helpers/device-flow-mock.ts` - Deleted after its concern-local replacements removed all consumers.

## Decisions Made

- Use an explicit `PI_CODING_AGENT_DIR` value and a `t.after` cleanup hook for the agent-directory runtime test.
- Keep legitimate type-only evidence outside runtime test cases. Use `satisfies` for positive contracts and `@ts-expect-error` for negative contracts.
- Require a zero-reference proof with self-file exclusions before deleting the generic helpers.

## Deviations from Plan

None - the plan was executed within its declared file boundary.

## Issues Encountered

- Prettier moved one multiline negative expression away from its `@ts-expect-error` directive. The expression was reduced to a direct field check, which preserves the intended type failure and passes formatting and type checking.
- The repository-wide positive correspondence command still reports the existing 98 violations outside Phase 108. The Phase 108 owner set passes its filtered structural check at 23/23 paths.
- The repository-wide all-pair direct-coverage gate stops at the unchanged missing `tests/bridges/agents/index.test.ts`. This file belongs to a later phase and is outside this plan's ownership.

## Verification

- Focused Pi API tests pass.
- Direct Pi API coverage is complete: 12/12 branches, 5/5 functions, and 163/163 lines.
- `npm run typecheck` passes.
- `npm run test:corresponding:negative` passes.
- The Phase 108 structural correspondence check passes for all 23 owner paths.
- `npm run check` passes, including type checking, ESLint, Fallow checks, formatting, 3,948 unit tests with one existing platform skip, and 21 integration tests.
- `git diff --check` passes.
- The corrected helper-reference scan returns no consumers.

## Known Stubs

None.

## User Setup Required

None.

## Next Phase Readiness

- Phase 108 has complete owner-path correspondence and can hand off to Phase 109.
- Later phases must add `tests/bridges/agents/index.test.ts` before the repository-wide all-pair direct-coverage gate can advance beyond that path.
- The remaining repository-wide correspondence baseline is external to this plan and stays visible for later migration phases.

## Self-Check: PASSED

- The summary and all four implementation paths exist in the expected final state.
- Commits `d9ced88a`, `ae3a3a73`, and `73e2a443` exist on the plan branch.
- The exact branch diff contains only the four declared implementation paths before this summary.

---

_Phase: 108-domain-and-platform_
_Completed: 2026-08-29_

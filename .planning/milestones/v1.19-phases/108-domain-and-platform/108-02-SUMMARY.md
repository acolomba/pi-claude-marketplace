---
phase: 108-domain-and-platform
plan: 02
subsystem: domain
tags: [typescript, clone-keys, sha256, git-fake, hermetic-tests, coverage]

requires:
  - phase: 108-22
    provides: Guarded concern-local GitOps fake with explicit memory, local, and remote boundaries
provides:
  - Exact deterministic evidence for all three clone-key exports
  - One-character URL and SHA adjacency evidence with fixed whole-value outputs
  - Five architecture and edge consumers migrated from generic Git support
affects: [108-03, 108-04, 108-05, 108-07, 108-23]

actuals:
  tokens: 3752
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - Fixed URL and SHA fixtures assert complete clone and mirror keys
    - Consumer-local adapters configure the guarded Git fake without changing legacy case bodies
    - Remote allowlists and explicit memory or local boundaries fail closed

key-files:
  created:
    - .planning/phases/108-domain-and-platform/108-02-SUMMARY.md
  modified:
    - tests/domain/clone-key.test.ts
    - tests/architecture/config-state-consistency.test.ts
    - tests/architecture/cross-op-convergence.test.ts
    - tests/edge/handlers/marketplace/add.test.ts
    - tests/edge/handlers/marketplace/update.test.ts
    - tests/edge/handlers/plugin/bootstrap.test.ts

key-decisions:
  - "Use fixed whole-value outputs to prove stability and one-character adjacency without computing expectations from production code."
  - "Keep the five consumer case bodies unchanged by placing explicit guarded-fake setup in consumer-local adapters."
  - "Remove credential functions before the concern-local fake records clone options because structuredClone cannot copy functions."

patterns-established:
  - "Clone-key adjacency cases compare complete named output sets for the canonical and adjacent inputs."
  - "Legacy consumers can migrate to concern-local support through small local adapters that preserve their public scenarios."

requirements-completed: [MOD-01]

coverage:
  - id: D1
    description: Deterministic clone, mirror, and canonical URL outputs
    requirement: MOD-01
    verification:
      - kind: unit
        ref: "node --test tests/domain/clone-key.test.ts"
        status: pass
      - kind: unit
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/clone-key.ts (6/6 branches, 3/3 functions, 83/83 lines)"
        status: pass
    human_judgment: false
  - id: D2
    description: One-character URL and SHA changes produce exact distinct keys
    requirement: MOD-01
    verification:
      - kind: unit
        ref: "tests/domain/clone-key.test.ts#one-character adjacency cases"
        status: pass
    human_judgment: false
  - id: D3
    description: Five consumers use guarded concern-local Git support with preserved behavior
    requirement: MOD-01
    verification:
      - kind: unit
        ref: "node --test tests/architecture/config-state-consistency.test.ts tests/architecture/cross-op-convergence.test.ts tests/edge/handlers/marketplace/add.test.ts tests/edge/handlers/marketplace/update.test.ts tests/edge/handlers/plugin/bootstrap.test.ts"
        status: pass
      - kind: integration
        ref: "npm run check"
        status: pass
    human_judgment: false

duration: 20m
completed: 2026-08-29
status: complete
---

# Phase 108 Plan 02: Clone-Key Owner and Consumer Migration Summary

**Exact clone-key boundaries and five guarded Git-fake consumer migrations with 100% direct owner coverage**

## Performance

- **Duration:** 20 minutes
- **Started:** 2026-08-29T13:11:30Z
- **Completed:** 2026-08-29T13:31:39Z
- **Tasks:** 3
- **Implementation files changed:** 6
- **Estimated diff tokens:** 3,752 (`15,009` changed characters divided by four)

## Accomplishments

- Proved that identical URL and SHA inputs return exact stable clone and mirror keys.
- Proved that one-character URL and retained-SHA-prefix changes produce exact distinct keys.
- Preserved the GitHub, URL, and git-subdirectory canonical URL branches as full-string assertions.
- Migrated five architecture and edge consumers away from `tests/helpers/git-mock.ts`.
- Added explicit memory, local fixture, credential, and remote controls without changing production code.
- Reached 6/6 branches, 3/3 functions, and 83/83 lines for `domain/clone-key.ts`.

## Task Commits

1. **Task 1: Normalize deterministic clone and mirror key cases** - `409cd1bb`
2. **Task 2: Lock adjacent inputs and canonical URL selection** - `24c55862`
3. **Task 3: Migrate architecture and edge consumers to concern-local adapter support** - `dbf58b9d`

## Files Created and Modified

- `tests/domain/clone-key.test.ts` - Stable exact outputs and one-character adjacency evidence for all three exports.
- `tests/architecture/config-state-consistency.test.ts` - Local fixture adapter for the guarded Git fake.
- `tests/architecture/cross-op-convergence.test.ts` - Memory-only poison control for unexpected Git operations.
- `tests/edge/handlers/marketplace/add.test.ts` - Allowed-remote Git fake with preserved clone-call observations.
- `tests/edge/handlers/marketplace/update.test.ts` - Memory-only Git fake for empty-state update scenarios.
- `tests/edge/handlers/plugin/bootstrap.test.ts` - Local official-marketplace fixture and guarded clone support.

## Decisions Made

- Expected clone and mirror keys remain fixed literals. The tests do not call a production formatter to build expected values.
- Consumer-local adapters carry the new explicit boundaries. The existing runtime case bodies remain unchanged.
- Credential-bearing clone options remove only the function-valued auth bundle before fake call recording. The remote URL still passes through the allowlist.
- Fixture paths remain local to each consumer. The migration does not add another generic helper.

## Deviations from Plan

None - the plan executed within the declared files and preserved production behavior.

## Issues Encountered

- The guarded fake clones its call options with `structuredClone`. Git auth bundles contain functions, which cannot be cloned.
- Consumer-local clone adapters remove the auth bundle before recording. Focused and full verification passed with this boundary.

## Verification

- Clone-key owner - passed.
- Direct clone-key coverage - 6/6 branches, 3/3 functions, and 83/83 lines.
- Five-file consumer run - all five file suites passed.
- Elevated `npm run check` - typecheck, ESLint, fallow, and formatting passed. The run had 3,927 unit passes, one platform skip, and 21 integration passes.
- Generic helper scan - no Git, credential, or device-flow generic-helper import remains in the five consumers.

## Known Stubs

None. Empty arrays in the touched consumers are existing case-owned notification or call accumulators.

## User Setup Required

None. The tests use no live network, developer credential, or external service.

## Next Phase Readiness

- The final consumer batches can use the same concern-local Git support.
- Plan 108-23 can remove the generic helper after all bounded batches complete.
- No clone-key coverage, consumer migration, or plan-local quality blocker remains.

## Self-Check: PASSED

- All six declared implementation files and this summary exist.
- Commits `409cd1bb`, `24c55862`, and `dbf58b9d` are present.
- Focused tests, direct coverage, the generic-helper scan, and the full repository check pass.

---

_Phase: 108-domain-and-platform_
_Completed: 2026-08-29_

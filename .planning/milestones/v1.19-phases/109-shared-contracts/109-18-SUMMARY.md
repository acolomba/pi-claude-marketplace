---
phase: 109-shared-contracts
plan: 18
subsystem: testing
tags: [node-test, scope-contract, type-contracts, direct-coverage]

requires: []
provides:
  - Canonical mirrored owner for Scope and SCOPES
  - Exact runtime order and compile-time closed-set evidence for extension scopes
affects: [shared-contracts, completions, hook-routing, persistence, orchestrators]

actuals:
  tokens: 166
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - Module-scope satisfies and @ts-expect-error evidence for the closed Scope union
    - Complete array equality for a fixed exported runtime set

key-files:
  created:
    - tests/shared/types.test.ts
    - .planning/phases/109-shared-contracts/109-18-SUMMARY.md
  modified: []

key-decisions: []

patterns-established:
  - "Type-only scope evidence stays at module scope without runtime wrappers or phase comments."
  - "The runtime owner compares SCOPES with an independently authored complete array."

requirements-completed: [MOD-02]

coverage:
  - id: D1
    description: "The owner pins SCOPES as exactly user then project, including cardinality and order."
    requirement: MOD-02
    verification:
      - kind: unit
        ref: "tests/shared/types.test.ts#exports the complete scope set in canonical order"
        status: pass
    human_judgment: false
  - id: D2
    description: "The owner accepts user and project while rejecting local and an unrelated scope at compile time."
    requirement: MOD-02
    verification:
      - kind: unit
        ref: "npm run typecheck"
        status: pass
    human_judgment: false
  - id: D3
    description: "The mirrored owner reaches complete direct function, line, and branch coverage without a production change."
    requirement: MOD-02
    verification:
      - kind: unit
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/shared/types.ts"
        status: pass
    human_judgment: false

duration: 4min
completed: 2026-08-29
status: complete
---

# Phase 109 Plan 18: Scope contract owner summary

**A canonical mirrored owner now pins the exact runtime scope order and the closed compile-time `Scope` union.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-08-29T20:35:23Z
- **Completed:** 2026-08-29T20:38:47Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Added the mirrored owner for `Scope` and `SCOPES`.
- Pinned `SCOPES` to the independent exact array `["user", "project"]` with canonical order and cardinality.
- Added module-scope positive evidence for both accepted literals and targeted negative evidence for `"local"` and `"workspace"`.
- Reached complete direct coverage without changing production bytes or public exports.

## Caller-facing contract

`SCOPES` has three runtime consumers. `edge/completions/provider.ts` preserves its order when presenting `--scope` values. `edge/completions/data.ts` uses it for both-scope marketplace and plugin-index rebuilds. `bridges/hooks/event-router.ts` uses the same complete set when hydrating hook routing state.

`Scope` remains the cross-tier type used by hook routing, edge argument parsing and handlers, import planning, marketplace and plugin orchestrators, reconcile flows, persistence locations, and shared notification values. Those callers continue to compile against exactly `"user" | "project"`; no caller-visible `"local"` or unrelated third scope was introduced.

## Edge resolution

- **Boundary:** `"user"` and `"project"` are accepted. The adjacent intentionally absent `"local"` and unrelated `"workspace"` fail the compile-time contract.
- **Adjacency and equality merging:** Not applicable. The module exposes a fixed tuple and closed type union; it performs no merge or equality operation.
- **Empty input:** Not applicable. The module accepts no input. Complete array equality rejects an empty or incomplete exported set.
- **Ordering:** The runtime case pins `"user"` before `"project"`.
- **Numeric precision:** Not applicable. The module exposes string literals and performs no numeric computation.

## Task commits

Each task was committed atomically:

1. **Task 1: Trace callers and establish the canonical owner** - `d2bf70dd` (test)
2. **Task 2: Complete exact edge coverage and pair-local quality gates** - `286bfcac` (test, no file delta required)

## Files created or modified

- `tests/shared/types.test.ts` - Direct runtime and compile-time owner for the shared scope contract.
- `.planning/phases/109-shared-contracts/109-18-SUMMARY.md` - Caller trace, edge decisions, and gate evidence.

## Decisions made

None. The plan and locked lowercase test contract were sufficient.

## Deviations from plan

None - plan executed exactly as written.

## Issues encountered

A repository-wide status probe attempted to clean unrelated Git LFS demo assets and could not write to the shared LFS temporary directory in the sandbox. File-scoped staging and verification remained exact, and both commits completed with hooks enabled.

## Verification

- `node --test tests/shared/types.test.ts` passed with 1 test and no skips or todos.
- Direct coverage passed at 100 percent: 19/19 lines, 1/1 branches, and 0/0 functions.
- `npm run typecheck` passed and proved both positive and both negative type expressions plus all production callers.
- Pair-local ESLint and Prettier checks passed.
- `git diff --check` passed.
- The production source remained byte-identical at SHA-256 `9e6e449a9b51983f4e9718a2aa29a75295dc3d8f11d6f4498b91aca82d13a177`.

## Known stubs

None.

## Threat review

The exact runtime tuple and matching compile-time positive and negative evidence mitigate widening or reordering of the scope set. The test-only change adds no endpoint, authentication path, file access, schema change, or other trust boundary.

## User setup required

None. The owner uses pure local values and no external service.

## Next phase readiness

P109-18 is ready for phase verification. The remaining independent shared owner can proceed without a new scope contract or public seam.

## Self-Check: PASSED

- The owner and summary files exist.
- Task commits `d2bf70dd` and `286bfcac` exist.
- Focused tests, direct coverage, lint, format, type, and diff checks passed.
- The paired production source remained byte-identical.

---

_Phase: 109-shared-contracts_
_Completed: 2026-08-29_

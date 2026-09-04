---
phase: 113-orchestrator-support-and-presenters
plan: 17
subsystem: orchestrator-plugin
tags: [typescript, node-test, discovery, filesystem, direct-coverage]
requires:
  - phase: 113-orchestrator-support-and-presenters
    provides: Shared plugin support contracts from P113-26
provides:
  - Complete direct ownership of generated skill, command, and agent name aggregation
  - Exact agent-source selection and null-source behavior
  - Explicit warning-drop and later-bridge failure propagation contracts
affects:
  - Plugin install, reinstall, and update preflight
  - MOD-06 orchestrator-support verification
actuals:
  tokens: 4300
  tasks: 1
  commits: 1
tech-stack:
  added: []
  patterns:
    - Fresh materializable plugin trees for aggregate discovery
    - Complete case-local results in bridge-declared order
    - Real local bridge execution with no module mock or network boundary
key-files:
  created:
    - tests/orchestrators/plugin/discover-names.test.ts
  modified: []
key-decisions:
  - Exercised all three public bridge discoveries through real temporary plugin trees.
  - Preserved each bridge's declared output order and deliberately asserted warnings only through their absence from the aggregate contract.
  - Used an invalid agent name to prove a hard failure from the final bridge propagates after earlier bridge discovery succeeds.
requirements-completed: [MOD-06]
coverage:
  - id: D1
    description: Generated names compose complete skill, command, and agent results while selecting the first agent source directory.
    requirement: MOD-06
    verification:
      - kind: unit
        ref: tests/orchestrators/plugin/discover-names.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Null and empty agent sources, dropped bridge warnings, and propagated hard failure partitions are explicit.
    requirement: MOD-06
    verification:
      - kind: unit
        ref: npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/plugin/discover-names.ts
        status: pass
    human_judgment: false
duration: 10 min
completed: 2026-09-01
status: complete
---

# Phase 113 Plan 17: Generated Name Discovery Summary

**Generated-name discovery now has one direct owner proving exact three-bridge composition, agent-source selection, deliberate warning dropping, and hard-failure propagation at 100% direct coverage.**

## Performance

- **Duration:** 10 min
- **Completed:** 2026-09-01
- **Tasks:** 1
- **Files created:** 1 owner test

## Accomplishments

- Built fresh real plugin trees and proved complete skill, command, and agent name lists in each bridge's declared order.
- Proved no declared components return three empty lists and a null agent source.
- Proved an existing but empty relative agent directory returns an exact absolute selected source and no agent names.
- Induced genuine first-wins warnings in all three bridges and proved the aggregate intentionally returns only the winning names without exposing warnings.
- Proved an invalid agent discovered by the final bridge rejects with the exact path-bearing validation message after valid skill and command discovery.
- Reached 100% direct coverage for `discover-names.ts`: 8/8 branches, 4/4 functions, and 67/67 lines.

## Task Commit

1. **Task 1: Complete edge/failure partitions and consolidate supplementals** - `3740bc4b` (test)

## Files Created/Modified

- `tests/orchestrators/plugin/discover-names.test.ts` - Sole mirrored owner for generated-name aggregation.

Production `extensions/pi-claude-marketplace/orchestrators/plugin/discover-names.ts` is unchanged.

## Supplemental Disposition

- Retained `tests/bridges/skills/discover.test.ts` unchanged. It owns the detailed skill bridge traversal, validation, deduplication, and warning contract rather than the orchestrator's aggregation boundary; its focused suite passes.
- Retained `tests/architecture/no-orchestrator-network.test.ts` unchanged. It owns the cross-module offline orchestrator boundary; its focused suite passes.
- No designated supplemental duplicated the aggregate owner, so no file was removed.

## Decisions Made

- Used only real local filesystem inputs because the aggregate exposes no injected collaborator and performs no network operation.
- Asserted complete independently authored result objects; no shared expected-value generator or production-module mock was introduced.
- Preserved behavior-bearing discovery order while keeping helper fields alphabetized where order has no runtime meaning.
- Covered warning dropping with real duplicate-generation inputs instead of inspecting production source text.

## Verification

- `node --test tests/orchestrators/plugin/discover-names.test.ts` - passed.
- `node --test tests/bridges/skills/discover.test.ts` - passed.
- `node --test tests/architecture/no-orchestrator-network.test.ts` - passed.
- `npm run typecheck` - passed.
- `npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/plugin/discover-names.ts` - passed at 8/8 branches, 4/4 functions, and 67/67 lines.
- Targeted ESLint and Prettier checks - passed.
- Lowercase-AAA, no-skip, no-ignore, no-impossible-cast, and `git diff --check` gates - passed.

## Deviations from Plan

None - the new owner and retained supplemental boundary follow the plan exactly.

## Issues Encountered

None.

## User Setup Required

None - all cases are deterministic, offline, and isolated in temporary directories.

## Known Stubs

None.

## Security Review

T-113-17 is mitigated: every plugin tree is confined to a fresh temporary root, selected agent paths are asserted exactly, invalid local names fail with path-bearing diagnostics, and no external service or test-only seam is involved.

## Next Phase Readiness

Generated-name aggregation is singularly owned and ready for install, reinstall, and update lifecycle verification. No blocker remains.

## Self-Check: PASSED

- The direct owner and this summary exist.
- Commit `3740bc4b` contains only the P113-17 owner.
- Production `discover-names.ts` is unchanged.
- Focused execution, retained supplemental execution, typecheck, exact direct coverage, architecture policy, lint, format, structural scans, and diff checks pass.
- No module mock, network call, test seam, skip, coverage ignore, impossible cast, or second Phase 113 pair was introduced.

---

_Phase: 113-orchestrator-support-and-presenters_
_Completed: 2026-09-01_

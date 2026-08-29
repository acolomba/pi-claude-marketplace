---
phase: 109-shared-contracts
plan: 15
subsystem: testing
tags: [node-test, path-containment, symlink-safety, filesystem, direct-coverage]

requires: []
provides:
  - Canonical mirrored owner for the path-safety public contract
  - Exact containment, symlink, walk-order, and exceptional filesystem evidence
affects: [shared-contracts, bridge-staging, persistence, resolver, transaction-recovery]

actuals:
  tokens: 4497
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - Case-owned real temporary path boundaries
    - Current-test-context filesystem replacement with restored built-in ESM bindings
    - Complete structured assertions for containment and symlink errors

key-files:
  created:
    - .planning/phases/109-shared-contracts/109-15-SUMMARY.md
  modified:
    - tests/shared/path-safety.test.ts

key-decisions:
  - "Keep path-safety.ts byte-identical because case-owned built-in ESM synchronization reaches both exceptional filesystem arms."

patterns-established:
  - "Normal containment and symlink cases use a fresh real temporary boundary for each case."
  - "Exceptional filesystem cases restore the test-context method and synchronized named binding in the same case."
  - "Path errors compare complete stable fields and messages against independent expected values."

requirements-completed: [MOD-02]

coverage:
  - id: D1
    description: "Both exported error classes expose exact inheritance, names, messages, and stable fields."
    requirement: MOD-02
    verification:
      - kind: unit
        ref: "tests/shared/path-safety.test.ts#PathContainmentError exposes its complete containment failure"
        status: pass
      - kind: unit
        ref: "tests/shared/path-safety.test.ts#SymlinkRefusedError exposes its complete symlink failure"
        status: pass
    human_judgment: false
  - id: D2
    description: "assertPathInside preserves containment, ordered walking, missing paths, and symlink refusal at every walked position."
    requirement: MOD-02
    verification:
      - kind: unit
        ref: "node --test tests/shared/path-safety.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Unreadable link targets and unexpected lstat errors have deterministic direct evidence at complete coverage."
    requirement: MOD-02
    verification:
      - kind: unit
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/shared/path-safety.ts"
        status: pass
    human_judgment: false

duration: 6min
completed: 2026-08-29
status: complete
---

# Phase 109 plan 15: Path safety owner summary

**The canonical owner pins exact containment errors, ordered path walks, symlink refusal, and exceptional filesystem behavior without a production edit.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-08-29T20:19:28Z
- **Completed:** 2026-08-29T20:24:36Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Normalized the owner into 13 independent runtime cases with exact lowercase arrange, act, and assert phases.
- Pinned both public error classes as complete structured values, including inheritance, messages, and all stable fields.
- Covered parent equality, direct children, two outside boundaries, a missing intermediate segment, and exact component order.
- Refused symlinks at the first, intermediate, and final walked positions with complete error values.
- Covered unreadable link targets and unexpected stat failures without changing the production module.
- Reached complete direct function, line, and branch coverage.

## Caller-facing contract

The production trace found 19 modules that directly import `path-safety.ts`.

- Agent, command, skill, and hook bridges validate staging, target, environment, configuration, and PID-table paths.
- The resolver, plugin information surface, persistence layer, and filesystem utilities validate read and storage boundaries.
- Plugin installation, transaction rollback, and the phase ledger preserve loud `PathContainmentError` propagation.
- `AgentForeignContentError` retains its public inheritance from `PathContainmentError`.

All callers keep the same exports and signatures: `PathContainmentError`, `SymlinkRefusedError`, and `assertPathInside`.
The source remains SHA-256 `35ef5c1fc55371ee4c36901528e8d78df799a617fe57616eb86c7f74f7850289`.

## Edge resolution

- **Boundary:** Self, direct child, one-step parent escape, deeper outside path, and missing intermediate paths have separate cases.
- **Adjacency and equality:** Parent equality and a relative `..` escape remain distinct.
- **Empty values:** Parent equality proves the empty relative path and its zero-segment walk.
- **Ordering:** The owner observes every `lstat` path in parent-to-child order. Symlink rows cover every walked position.
- **Numeric precision:** Not applicable. The module accepts path strings and exposes errors or `undefined`.

## Task commits

Each task was committed atomically:

1. **Task 1: Trace callers and establish the canonical owner** - `981790e5` (test)
2. **Task 2: Complete exact edge coverage and pair-local quality gates** - `b81f9393` (test)

## Files created or modified

- `tests/shared/path-safety.test.ts` - Direct owner for all path-safety exports and public edges.
- `.planning/phases/109-shared-contracts/109-15-SUMMARY.md` - Caller trace, edge decisions, and gate evidence.

## Decisions made

The no-production-edit attempt succeeded. A current-test-context filesystem replacement can synchronize Node built-in named exports and restore them in the same case.

This method reaches deterministic `lstat` and `readlink` failures without a new export, reset hook, state reader, or test mode.

## Deviations from plan

None. The plan authorized the no-production-edit attempt and the test-local filesystem control used here.

## Issues encountered

Assigning a method on the default `node:fs/promises` object does not update an existing named ESM binding by itself.

The owner calls `syncBuiltinESMExports()` after its case-owned method replacement. Its registered cleanup restores the method and synchronizes the binding again.

## Verification

- `node --test tests/shared/path-safety.test.ts` passed.
- Direct coverage passed at 100 percent: 147/147 lines, 28/28 branches, and 8/8 functions.
- `npm run typecheck` passed for every production caller.
- Pair-local ESLint and Prettier checks passed.
- `git diff --check` passed.
- The production source and its three-symbol export surface remained unchanged.

## Known stubs

None.

## Threat review

The owner mitigates the planned ASVS L1 high-severity threat with exact traversal and symlink evidence.

Unexpected filesystem failures cannot become accepted paths. The test-only change adds no endpoint, schema, authentication path, or public filesystem capability.

## User setup required

None. Each case uses a local temporary directory or a case-owned method replacement.

## Next phase readiness

P109-15 is ready for phase verification. Other shared owners do not depend on a production change from this pair.

## Self-Check: PASSED

- The source, owner, and summary files exist.
- Task commits `981790e5` and `b81f9393` exist.
- Focused tests, direct coverage, type, lint, format, and diff checks passed.
- The source hash and three-symbol public export surface are unchanged.
- No stub, skipped test, coverage exception, or new threat surface remains.

---

_Phase: 109-shared-contracts_
_Completed: 2026-08-29_

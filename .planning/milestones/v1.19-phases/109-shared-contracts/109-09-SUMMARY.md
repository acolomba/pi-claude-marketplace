---
phase: 109-shared-contracts
plan: 09
subsystem: testing
tags: [node-test, filesystem, rollback, path-containment, direct-coverage]

requires: []
provides:
  - Canonical mirrored owner for every fs-utils export
  - Exact cleanup, rollback, materialization, tolerant-read, and markdown-filter evidence
affects: [shared-contracts, bridge-staging, component-discovery, plugin-clone-flows]

actuals:
  tokens: 11328
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - Case-owned real temporary filesystem boundaries
    - Current-test-context Node filesystem method replacement for deterministic errors
    - Complete leak arrays and stable reverse-order operation assertions

key-files:
  created:
    - .planning/phases/109-shared-contracts/109-09-SUMMARY.md
  modified:
    - extensions/pi-claude-marketplace/shared/fs-utils.ts
    - tests/shared/fs-utils.test.ts

key-decisions:
  - "Use the default node:fs/promises object internally so current-test-context method replacements can cover exceptional paths without a public seam."

patterns-established:
  - "Each normal filesystem case owns one temporary root and registers cleanup before further mutation."
  - "Exceptional filesystem cases replace only the current test context method and compare complete public errors or leak arrays."
  - "Rollback ordering evidence records complete remove and rename operations while real filesystem effects continue."

requirements-completed: [MOD-02]

coverage:
  - id: D1
    description: "The owner pins path existence, cleanup, orphan removal, and adjacent exceptional error behavior."
    requirement: MOD-02
    verification:
      - kind: unit
        ref: "node --test tests/shared/fs-utils.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Rollback removes and restores equal-name items in stable reverse order and returns every leak in execution order."
    requirement: MOD-02
    verification:
      - kind: unit
        ref: "tests/shared/fs-utils.test.ts#uses stable reverse input order for equal-name items"
        status: pass
      - kind: unit
        ref: "tests/shared/fs-utils.test.ts#returns every failure leak in execution order"
        status: pass
    human_judgment: false
  - id: D3
    description: "Materialization, tolerant directory reads, and markdown filtering cover their complete public result variants."
    requirement: MOD-02
    verification:
      - kind: unit
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/shared/fs-utils.ts"
        status: pass
    human_judgment: false

duration: 19min
completed: 2026-08-29
status: complete
---

# Phase 109 plan 09: Filesystem utility owner summary

**A canonical owner pins filesystem cleanup, kind-strict orphan removal, stable reverse rollback, materialization results, tolerant reads, and markdown filtering.**

## Performance

- **Duration:** 19 min
- **Started:** 2026-08-29T19:36:40Z
- **Completed:** 2026-08-29T19:56:15Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Normalized every runtime case to separate lowercase arrange, act, and assert phases.
- Replaced permission assumptions and skipped cases with deterministic current-context filesystem errors.
- Pinned complete filesystem values, exact leak arrays, stable reverse order, and all materialization and filtering variants.
- Reached 100 percent direct function, line, and branch coverage with no public export change.

## Caller-facing contract

CodeGraph and the import trace found 13 production consumer modules. They span bridge staging, component discovery, plugin clone flows, marketplace add, reconciliation, and skill removal.

The staging bridges for agents, commands, and skills use cleanup, existence, orphan removal, and shared rollback behavior. These callers retain kind-strict removal and frozen leak arrays.

The discovery bridges use existence, tolerant directory reads, and markdown filtering. They still tolerate only `ENOENT` and `ENOTDIR`, and they rethrow adjacent errors.

Plugin clone-cache, source-probe, reinstall, and update flows use `resolveGitSubdirRoot`. They retain contained, missing, and escaping result arms with unchanged fields and detail text.

Marketplace add, reconciliation, and skill removal keep the same cleanup and existence semantics. All production callers passed the project type check after the internal refactor.

The public exports remain unchanged:

- `cleanupStaging`
- `pathExists`
- `removeOrphanIfPresent`
- `RollbackReplacementLabels`
- `RollbackReplacementInput`
- `rollbackReplacementCommon`
- `resolveGitSubdirRoot`
- `readDirEntriesTolerant`
- `isPlainMarkdownFile`

## Edge resolution

- **Boundary:** Missing and present paths, empty and several rollback inputs, and root-equality materialization have separate cases.
- **Adjacency and equality:** `ENOENT` and `ENOTDIR` differ from `EACCES`. Equal-name rollback items retain stable reverse input order.
- **Empty values:** Empty rollback inputs return a frozen empty array. Empty directories and tolerated missing directories return exact empty arrays.
- **Ordering:** Replacement removal, backup restoration, callback leaks, and cleanup leaks retain exact execution order.
- **Numeric precision:** Not applicable. The module has no numeric input, output, or calculation.

## Task commits

Each task was committed atomically:

1. **Task 1: Trace callers and establish the canonical owner** - `eaadff50` (test)
2. **Task 2: Complete exact edge coverage and pair-local quality gates** - `3a00f26b` (test)

## Files created or modified

- `extensions/pi-claude-marketplace/shared/fs-utils.ts` - Uses the private filesystem promise object while preserving all exports and behavior.
- `tests/shared/fs-utils.test.ts` - Direct owner for every public filesystem utility contract.
- `.planning/phases/109-shared-contracts/109-09-SUMMARY.md` - Caller trace, edge decisions, and gate results.

## Decisions made

The plan-authorized internal refactor replaced named filesystem imports with the default promise object. This change permits case-owned method replacement and adds no public test seam.

## Deviations from plan

None - plan executed exactly as written.

## Issues encountered

The first Task 2 type and lint pass required explicit Node path types and promise-returning error replacements. The corrected owner passed all gates before commit.

## Verification

- `node --test tests/shared/fs-utils.test.ts` passed.
- Direct coverage passed at 100 percent: 313/313 lines, 49/49 branches, and 7/7 functions.
- `npm run typecheck` passed for the public exports and all production callers.
- Pair-local ESLint and Prettier checks passed.
- `git diff --check` passed.
- The public export list is identical to commit `085e59aa`.

## Known stubs

None.

## Threat review

Deterministic cleanup and rollback failures mitigate the planned tampering and denial-of-service threat. The private import refactor adds no endpoint, schema, or public filesystem capability.

## User setup required

None. Every case uses a local temporary directory or a case-owned method replacement.

## Next phase readiness

P109-09 is ready for phase verification. The remaining independent shared owners can proceed without a production dependency on this test.

## Self-Check: PASSED

- The source, owner, and summary files exist.
- Task commits `eaadff50` and `3a00f26b` exist.
- Focused tests, direct coverage, type, lint, format, and diff checks passed.
- The public export surface matches the pre-plan base.
- No skipped case, stub, TODO, coverage ignore, public test seam, or unrelated file change remains.

---

_Phase: 109-shared-contracts_
_Completed: 2026-08-29_

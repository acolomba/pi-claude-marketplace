---
phase: 109-shared-contracts
plan: 06
subsystem: testing
tags: [node-test, bridge-errors, typed-errors, direct-coverage]

requires: []
provides:
  - Canonical mirrored owner for every shared bridge error export
  - Exact inheritance, message, field, cause, collection, and input-copy evidence
affects: [shared-contracts, agent-staging, command-staging, command-discovery, mcp-staging]

actuals:
  tokens: 4796
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - Complete structured assertions for typed public errors
    - Module-scope satisfies and @ts-expect-error evidence for exported types

key-files:
  created:
    - .planning/phases/109-shared-contracts/109-06-SUMMARY.md
  modified:
    - tests/shared/errors-bridges.test.ts

key-decisions: []

patterns-established:
  - "Bridge error owners compare every stable public field and complete message independently."
  - "Frozen collection cases also prove top-level constructor inputs are copied before exposure."

requirements-completed: [MOD-02]

coverage:
  - id: D1
    description: "The owner pins every exported bridge error class, inheritance relation, stable field, complete message, and supported cause."
    requirement: MOD-02
    verification:
      - kind: unit
        ref: "node --test tests/shared/errors-bridges.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Empty, single, multiple, equal-name, ordered, frozen, copied-input, and adjacent-value contracts are explicit."
    requirement: MOD-02
    verification:
      - kind: unit
        ref: "tests/shared/errors-bridges.test.ts#AgentOwnershipConflictError"
        status: pass
      - kind: unit
        ref: "tests/shared/errors-bridges.test.ts#keeps adjacent source names and directories distinct"
        status: pass
    human_judgment: false
  - id: D3
    description: "The mirrored owner reaches complete direct function, line, and branch coverage without a production change."
    requirement: MOD-02
    verification:
      - kind: unit
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/shared/errors-bridges.ts"
        status: pass
    human_judgment: false

duration: 7min
completed: 2026-08-29
status: complete
---

# Phase 109 Plan 06: Bridge error owner summary

**A canonical owner now pins every shared bridge error as a complete typed value, including defensive conflict collections and command-name causes.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-08-29T18:56:22Z
- **Completed:** 2026-08-29T19:03:24Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Normalized all 14 runtime cases to separate lowercase arrange, act, and assert phases.
- Added direct runtime coverage for `CommandNameError` and module-scope evidence for `AgentOwnershipConflict`.
- Pinned exact error classes, inheritance, names, messages, fields, causes, empty and equal-name collections, order, frozen observations, and defensive top-level copies.
- Reached complete direct coverage while keeping the production source and export surface byte-identical.

## Caller-facing contract

The production trace found four active construction paths:

- `bridges/agents/stage.ts` throws `AgentOwnershipConflictError` after collecting every cross-owner generated-name conflict.
- `bridges/mcp/stage.ts` throws `McpServerCollisionError` for effective-slot and same-file foreign collisions.
- `bridges/commands/stage.ts` wraps errno staging failures in `BridgeStagingError` and retains the original cause.
- `bridges/commands/discover.ts` creates `CommandNameError`, then composes its message and cause trailer into one skip warning.

`AgentForeignContentError` and `AgentOwnershipConflict` currently have no separate production importer. They remain public direct-path exports. The owner preserves `AgentForeignContentError` as both its exact subclass and a `PathContainmentError`, and it proves the exported conflict shape at compile time.

Every active caller continues to observe the same public class, message, fields, cause, and ordering. The source remains SHA-256 `604529e96d3e071a9a80f70e66b2ee51e569e91bbae4496a4514ebd2bac2748c`.

## Edge resolution

- **Boundary:** Empty, single, and several conflict collections have independent complete assertions.
- **Adjacency and equality:** Adjacent path and name values remain distinct. Equal generated names remain separate and caller-ordered.
- **Empty values:** The empty collection retains the current exact `Refusing to stage agents for official/acme: .` message and frozen empty array.
- **Ordering:** Multiple conflicts preserve their supplied order in both the public array and complete message.
- **Numeric precision:** Not applicable. These constructors accept strings, objects, arrays, and optional causes, with no numeric contract.

## Task commits

Each task was committed atomically:

1. **Task 1: Trace callers and establish the canonical owner** - `035d76a8` (test)
2. **Task 2: Complete exact edge coverage and pair-local quality gates** - `c3092eef` (test)

## Files created or modified

- `tests/shared/errors-bridges.test.ts` - Direct owner for every bridge error export and public edge.
- `.planning/phases/109-shared-contracts/109-06-SUMMARY.md` - Caller trace, edge decisions, and gate results.

## Decisions made

None. The plan and locked lowercase test contract were sufficient.

## Deviations from plan

None - plan executed exactly as written.

## Issues encountered

None.

## Verification

- `node --test tests/shared/errors-bridges.test.ts` passed.
- Direct coverage passed at 100 percent: 122/122 lines, 11/11 branches, and 10/10 functions.
- `npm run typecheck` passed for the exported type, error classes, and production callers.
- Pair-local ESLint and Prettier checks passed.
- `git diff --check` passed.
- The production source remained byte-identical at SHA-256 `604529e96d3e071a9a80f70e66b2ee51e569e91bbae4496a4514ebd2bac2748c`.

## Known stubs

None.

## Threat review

Complete messages, causes, and stable fields mitigate accidental information-contract drift without adding diagnostics. The test-only change adds no endpoint, authentication path, file access, schema change, or other trust boundary.

## User setup required

None. The owner uses only in-process values and no external service.

## Next phase readiness

P109-06 is ready for phase verification. The remaining independent shared owners can proceed.

## Self-Check: PASSED

- The owner and summary files exist.
- Task commits `035d76a8` and `c3092eef` exist.
- Focused tests, direct coverage, lint, format, type, and diff checks passed.
- The paired production source remained byte-identical.

---

_Phase: 109-shared-contracts_
_Completed: 2026-08-29_

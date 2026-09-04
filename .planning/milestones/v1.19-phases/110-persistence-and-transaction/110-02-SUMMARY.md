---
phase: 110-persistence-and-transaction
plan: 02
subsystem: testing
tags: [typescript, node-test, typebox, schema-validation, direct-coverage]

requires:
  - phase: 109-shared-contracts
    provides: Lowercase runtime phase convention and module-scope type evidence pattern
provides:
  - Canonical mirrored owner for AgentsIndexEntry and AgentsIndex validation
  - Exact version-1 envelope, field, optional-model, and rejection evidence
affects: [agents-index-io, persistence, durable-state]

actuals:
  tokens: 4229
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns: [independent literal schema rows, module-scope type evidence, lowercase runtime phases]

key-files:
  created: [.planning/phases/110-persistence-and-transaction/110-02-SUMMARY.md]
  modified: [tests/persistence/agents-index-schema.test.ts]

key-decisions:
  - "Kept agents-index-schema.ts byte-identical because both compiled validators expose the complete public contract."
  - "Used independent complete row and envelope literals so expected acceptance cannot drift with a shared builder."

patterns-established:
  - "Schema owners pair positive satisfies evidence with targeted @ts-expect-error checks at module scope."
  - "Generated rejection rows retain separate lowercase arrange, act, and assert phases."

requirements-completed: [MOD-03]

coverage:
  - id: D1
    description: "The owner proves complete version-1 agents-index rows, optional originalModel behavior, empty indexes, and several-agent indexes through both compiled validators."
    requirement: MOD-03
    verification:
      - kind: unit
        ref: "tests/persistence/agents-index-schema.test.ts#AGENTS_INDEX_ENTRY_VALIDATOR and AGENTS_INDEX_VALIDATOR acceptance cases"
        status: pass
      - kind: other
        ref: "npm run typecheck"
        status: pass
    human_judgment: false
  - id: D2
    description: "The owner rejects schema version 2, the entries alias, malformed envelopes, every invalid row-field category, and incomplete rows at 100 percent direct coverage."
    requirement: MOD-03
    verification:
      - kind: unit
        ref: "tests/persistence/agents-index-schema.test.ts#validator rejection cases"
        status: pass
      - kind: other
        ref: "npm run test:coverage:direct -- tests/persistence/agents-index-schema.test.ts"
        status: pass
    human_judgment: false

duration: 11min
completed: 2026-08-30
status: complete
---

# Phase 110 Plan 02: Agents-index schema Summary

**Canonical TypeBox validator owner for the exact version-1 agents-index envelope and every row-field boundary at 100 percent direct coverage**

## Performance

- **Duration:** 11 min
- **Started:** 2026-08-30T00:58:09Z
- **Completed:** 2026-08-30T01:09:29Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Replaced the baseline PASS owner with direct, independent evidence for both compiled validators and both exported schema-derived types.
- Proved complete rows with and without `originalModel`, nonempty string arrays, the empty version-1 index, and a version-1 index containing several distinct agents.
- Rejected adjacent schema version 2, `entries` in place of `agents`, null and primitive envelopes, a non-array envelope, an incomplete row, and every invalid row-field category.
- Preserved production bytes while retaining 100 percent direct function, line, and branch coverage.

## Task Commits

Each task was committed atomically:

1. **Task 1: Publish the complete version-1 schema contract** - `7eebce05` (test)
2. **Task 2: Prove adjacent versions and incomplete-row rejection** - `4829e3b2` (test)

## Files Created/Modified

- `tests/persistence/agents-index-schema.test.ts` - Canonical runtime and compile-time owner for agents-index schema types and validators.
- `.planning/phases/110-persistence-and-transaction/110-02-SUMMARY.md` - Verification, coverage, decisions, and commit evidence.

## Verification

- `node --test tests/persistence/agents-index-schema.test.ts` passed before and after the tracer commit.
- Direct coverage passed with 1/1 branches, 0/0 functions, and 63/63 lines.
- `npm run typecheck` passed with the positive `satisfies` and targeted `@ts-expect-error` evidence.
- Pair-local Prettier and `git diff --check` passed.
- `npm run test:integration` passed 10/10 integration files.
- The production source retained SHA-256 `7d0b79bbf0c62db4e5bef7ebf0ec01a6d14314ee4e6e79f270945e8aba48636c` and is byte-identical to the plan-start commit.

## Decisions Made

- Kept the production schema and exports unchanged because the existing validators expose every required acceptance and rejection boundary.
- Used one independent literal per row category instead of spreading a shared valid row, which keeps each failure discriminating and readable.
- Limited type-only negatives to the exported version literal, required generated name, and optional model type; runtime validators own the broader unknown-input matrix.

## Threat Controls

- T-110-02-01 is mitigated: exact version, envelope key, cardinality, required fields, arrays, and optional field types are pinned through independent values.
- T-110-02-02 remains accepted as planned; validator compilation stays module-scoped and production code is unchanged.
- No new network, authentication, file-access, or schema trust boundary was introduced.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The repository-wide `npm run check` reached format validation after typecheck, lint, and Fallow passed, then stopped on five pre-existing user-owned untracked JSON files (`.mcp.json` and four `.planning/research/.cache/` entries). The changed owner passes its own Prettier check; the unrelated files were preserved.
- The full unit sweep passed the changed owner and 221 other test files, while `tests/orchestrators/marketplace/add.test.ts` and `tests/orchestrators/plugin/update.test.ts` failed independently. This test-only plan does not import or modify either owner; focused, type, and integration gates remain green.
- The milestone-wide corresponding-test gate reports 83 known open pair violations because Phase 110 and later phases are not complete. The agents-index schema pair itself is present and directly imported.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- P110-02 is ready for phase-level verification.
- MOD-03 remains pending until the other 11 persistence and transaction owners produce their summaries.
- No plan-local blockers, production changes, open high-severity threats, stubs, skipped tests, or coverage exceptions remain.

## Self-Check: PASSED

- The owner test and summary exist on disk.
- Both task commits are present in repository history.
- The paired production source is byte-identical to the plan-start commit.
- The owner has no stubs, skipped tests, todos, coverage exceptions, or non-lowercase runtime phase comments.

---

_Phase: 110-persistence-and-transaction_
_Completed: 2026-08-30_

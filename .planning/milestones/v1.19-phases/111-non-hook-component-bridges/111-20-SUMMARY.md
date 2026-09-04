---
phase: 111-non-hook-component-bridges
plan: 20
subsystem: testing
tags: [typescript, node-test, mcp-stage, atomic-replacement, direct-coverage]

requires:
  - phase: 111-non-hook-component-bridges
    provides: P111-07 removal of the duplicate empty-agents integration case
provides:
  - Canonical direct owner for the complete MCP staging and replacement lifecycle
  - Exact merge, collision, substitution, rollback, foreign-content, and malformed-input evidence
  - Case-local MCP-to-sibling isolation and removal of the two empty-agents fixture files
affects: [mcp-bridges, atomic-filesystem-safety, fixture-cleanup]

actuals:
  tokens: 21089
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns: [case-owned temporary trees, exact serialized bytes, deterministic filesystem failures]

key-files:
  created:
    - .planning/phases/111-non-hook-component-bridges/111-20-SUMMARY.md
  modified:
    - tests/bridges/mcp/stage.test.ts
    - tests/bridges/integration-materialization-gate.test.ts
    - tests/bridges/_fixtures/empty-agents/.claude-plugin/plugin.json
    - tests/bridges/_fixtures/empty-agents/agents/.gitkeep

key-decisions:
  - "Kept mcp/stage.ts byte-identical because its public prepared and replacement handles expose the complete lifecycle contract."
  - "Used a regular file that blocks parent-directory creation to prove deterministic rollback failure without permission-dependent skips."
  - "Retained only the genuine MCP-to-sibling isolation case and removed both empty-agents fixtures after exact-path searches returned no matches."
  - "Authored complete input documents, expected results, serialized bytes, and filesystem trees inside each owning case."

patterns-established:
  - "A concern-local allocator supplies only fresh roots; every MCP declaration, environment value, destination document, and oracle stays case-owned."
  - "Filesystem topology produces portable failure evidence when permission behavior would differ under privileged test runners."

requirements-completed: [MOD-04]

coverage:
  - id: D1
    description: "The canonical owner proves prepare, commit, abort, replace, rollback, and finalize behavior with exact values and bytes."
    requirement: MOD-04
    verification:
      - kind: unit
        ref: "tests/bridges/mcp/stage.test.ts#complete public lifecycle"
        status: pass
      - kind: other
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/mcp/stage.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "A retained case-local integration check proves that MCP staging does not materialize agent, prompt, or skill targets after shared fixtures are removed."
    requirement: MOD-04
    verification:
      - kind: integration
        ref: "tests/bridges/integration-materialization-gate.test.ts#MCP-only-to-sibling isolation"
        status: pass
      - kind: other
        ref: "npm run typecheck"
        status: pass
    human_judgment: false

duration: 22min
completed: 2026-08-30
status: complete
---

# Phase 111 Plan 20: MCP stage owner summary

**Case-owned MCP documents prove the complete atomic staging and replacement lifecycle at 100 percent direct coverage without a production change**

## Performance

- **Duration:** 22 min
- **Started:** 2026-08-30T19:45:00Z
- **Completed:** 2026-08-30T20:06:36Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Rebuilt the canonical owner around direct imports of all seven public exports from `mcp/stage.ts`.
- Proved no-op, staged, committed, aborted, replaced, rolled-back, finalized, and failed-rollback paths with complete case-owned state.
- Covered project and user scopes, substitutions, injected environment, source provenance, owned replacement, foreign preservation, collisions, malformed documents, scalar values, and exact bytes.
- Rebuilt the retained integration suite as one MCP-only case that proves all agent, prompt, and skill targets remain absent.
- Removed the two empty-agents fixtures after their final legitimate consumer moved into case-owned input.
- Reached 80/80 branches, 15/15 functions, and 400/400 lines without changing production bytes or exports.

## Task commits

Each task was committed atomically:

1. **Task 1: Establish the canonical mcp/stage owner** - `2dbcba25` (test)
2. **Task 2: Close edge and direct-coverage evidence** - `7f08ae31` (test)

## Files created or modified

- `tests/bridges/mcp/stage.test.ts` - Canonical direct owner for preparation, commit, abort, replacement, rollback, finalization, hostile inputs, and exact serialized output.
- `tests/bridges/integration-materialization-gate.test.ts` - One case-local MCP-only integration check that proves sibling bridge targets remain absent.
- `tests/bridges/_fixtures/empty-agents/.claude-plugin/plugin.json` - Removed after the retained integration scenario became case-owned.
- `tests/bridges/_fixtures/empty-agents/agents/.gitkeep` - Removed with the obsolete shared fixture tree.
- `.planning/phases/111-non-hook-component-bridges/111-20-SUMMARY.md` - Plan evidence, direct coverage, decisions, and commit record.

## Verification

- `node --test tests/bridges/mcp/stage.test.ts tests/bridges/integration-materialization-gate.test.ts` passed with no skipped or todo tests.
- `npm run typecheck` passed.
- `npm run lint` passed.
- ESLint and Prettier accepted both changed test modules.
- Direct coverage passed with 80/80 branches, 15/15 functions, and 400/400 lines.
- Both removed fixture paths are absent; repository-wide exact-path searches and the concern-local fixture-root scan returned the required no-match status 1.
- Production source retained SHA-256 `bd1627a35e5fc18d7cd5bf309df0851c7aed7e4e837eefa7d1c1dc3efada7c42` and is byte-identical to the plan-start revision.

## Decisions made

- Kept the production MCP stage module unchanged. Its seven public exports expose all required lifecycle outcomes.
- Used fresh temporary roots only as allocation. Each case owns its complete declarations, environment, destination bytes, expected result, and cleanup.
- Replaced the prior permission-sensitive restore failure with a deterministic `EEXIST` topology: a regular file blocks creation of the required parent directory.
- Preserved foreign top-level fields and server entries in independently authored destination documents, including collisions at both supported scopes.
- Deleted only the two files assigned to P111-20 after exact repository-wide consumer searches found no matches.

## Threat controls

- T-111-20-01 is mitigated with case-owned hostile declarations, malformed documents, scalar server values, collision evidence, exact rollback restoration, deterministic failure cleanup, and foreign-content preservation.
- Tests prove that commit and replacement writes are staged, that rollback restores exact prior bytes, and that failure leaves an explicit recoverable leak record.
- No network, authentication, schema, production API, test-only export, or new production surface was introduced.

## Deviations from plan

None. The plan executed as written.

## Issues encountered

- Permission-based rollback failures are unreliable under privileged test runners. A blocking regular file now produces the same public failure path deterministically without a skip.

## User setup required

None. This plan adds no package, external service, or local configuration requirement.

## Next phase readiness

- P111-20 is ready for phase-level verification.
- MOD-04 remains pending until the other non-hook bridge owners produce their summaries.
- No plan-local blocker, production change, open high-severity threat, stub, skipped test, todo, or coverage exception remains.

## Self-check: PASSED

- The canonical owner, retained integration case, and summary exist on disk.
- Both task commits exist in repository history.
- Both assigned fixture files are absent, with no remaining exact-path consumer.
- The production source is byte-identical to the plan-start revision.
- The focused owner, retained integration case, typecheck, lint, formatting, and direct-coverage gates pass.

---

_Phase: 111-non-hook-component-bridges_
_Completed: 2026-08-30_

---
phase: 08-clear-milestone-debt
plan: 12
subsystem: reload MCP migration, plugin update, plugin reinstall (MCP staging environment)
tags: [d-08-06, avar-02, debt-04]

requires: [08-02, 08-08, 08-11]
provides:
  - "Trailing `env: ClaudeEnv = process.env` on `migrateLegacyMcpEntries` (mcp-migration.ts), `createPluginUpdateOperations` (update-flow.ts) and `createReinstallPlugin` (reinstall-flow.ts); apply.ts, operations.ts, edge/register.ts and index.ts unchanged"
  - "Required `ThreePhaseArgsBase.env` (update-swap.ts) and `ReplaceReinstalledPluginInput.env` (reinstall-replace.ts), each passed to staging"
  - "Module-private `UpdateBindings` (update-flow.ts): the routing, completion cache and env bound once by the factory and spread into every direct and cascade `ThreePhaseArgs`"
affects: [08-13 (makes StageMcpInput.env required; all four staging callers now pass env), 08-21 (P4 IN-02 ledger row)]

actuals:
  tokens: 6500
  tasks: 3
  commits: 3
plan_head_before: a0b2ee5aa896d7cdb00f5526130c2ac6775eaa60
plan_head_after: 76bf597fc9e9fab1c72b3ce606b89f2f534abdd1

tech-stack:
  added: []
  patterns:
    - "Entry-point env default (D-08-06), as in 08-11: the entry point takes `env: ClaudeEnv = process.env` and every lower layer takes env as a required value"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/reconcile/mcp-migration.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-replace.ts
    - tests/orchestrators/reconcile/mcp-migration.test.ts
    - tests/orchestrators/plugin/update-flow.test.ts
    - tests/orchestrators/plugin/update-swap.test.ts
    - tests/orchestrators/plugin/reinstall-flow.test.ts
    - tests/orchestrators/plugin/reinstall-replace.test.ts

key-decisions:
  - "update-flow.ts bundles `hooksRouting`, `completionCache` and `env` into a module-private `UpdateBindings` (a `Pick` of `ThreePhaseArgsBase`) instead of adding a positional env, because `buildDirectThreePhaseArgs` and `updateSinglePluginWith` already take 7 parameters, the `@typescript-eslint/max-params` limit"
  - "mcp-migration.ts and reinstall-flow.ts thread env positionally (`migrateLocked`, `stageOwner`; `reinstallPluginWithTransaction`, `runLockedReinstall`), which stays within 7 parameters"

patterns-established: []

requirements-completed: []

duration: 20min
completed: 2026-10-10
status: complete
---

# Phase 08 Plan 12: Explicit staging environment for migration, update and reinstall Summary

**The reload's MCP migration, update (direct and cascade) and reinstall now stage MCP servers with the environment their entry point received. Each entry point defaults it to `process.env`, as `createGetPluginInfo` does, so every production caller is unchanged. With 08-11, all four `prepareStageMcpServers` callers pass an explicit env.**

## Performance

- **Duration:** about 20 min (ending 2026-10-10T05:21Z)
- **Tasks:** 3/3
- **Files modified:** 10 (5 sources, 5 tests)

## Findings closed

| Finding | Disposition | Commit |
| ------- | ----------- | ------ |
| P4 IN-02 (D-08-06, DEBT-04), migration/update/reinstall part | the reload migration, both update paths and reinstall stage with an explicit env. 08-13 makes `StageMcpInput.env` required and deletes the `?? process.env` | 473f9dea, aa5419ed, 76bf597f |

## Task Commits

1. **Task 1: The reload migration stages with the environment it was given.** Commit `473f9dea` (refactor). Pre-commit log `tmp/p8-12-precommit.log` ends `PRECOMMIT_EXIT=0`. Hook: `npm run check:commit` Passed on the first attempt.
2. **Task 2: Update stages with the environment its operations were built with.** Commit `aa5419ed` (refactor). Pre-commit log `tmp/p8-12-precommit2.log` ends `PRECOMMIT_EXIT=0`. Hook: `npm run check:commit` Passed on the first attempt.
3. **Task 3: Reinstall stages with the environment its operation was built with.** Commit `76bf597f` (refactor). Pre-commit log `tmp/p8-12-precommit3.log` ends `PRECOMMIT_EXIT=0`. Hook: `npm run check:commit` Passed on the first attempt.

## Verify results (final lines)

- Task 1: `npm run typecheck` exit 0. `node --test` mcp-migration + apply tests: `ℹ tests 173`, `ℹ pass 173`, `ℹ fail 0`. `npm run test:coverage:direct -- <mcp-migration.ts>` exit 0, no shortfall printed.
- Task 2: `npm run typecheck` exit 0. `node --test` update-swap + update-flow + marketplace/update tests: `ℹ tests 459`, `ℹ pass 459`, `ℹ fail 0`. `npm run test:coverage:direct -- <update-swap.ts> <update-flow.ts>` exit 0, no shortfall printed.
- Task 3: `npm run typecheck` exit 0. `node --test` reinstall-replace + reinstall-flow + reconcile/backfill tests: `ℹ tests 203`, `ℹ pass 203`, `ℹ fail 0`. `npm run test:coverage:direct -- <reinstall-replace.ts> <reinstall-flow.ts>` exit 0, no shortfall printed.
- Plan verification: `tests/integration/mcp-variable-expansion.test.ts` passes unchanged (`ℹ tests 5`, `ℹ pass 5`, `ℹ fail 0`).
- Fallow audit after tasks 2 and 3: `verdict pass`, 10 groups, 0 introduced.
- Acceptance: `grep -n "env: ClaudeEnv = process.env"` prints mcp-migration.ts:838, update-flow.ts:1065 and reinstall-flow.ts:218. The `stageOwner` awk prints the `env: ClaudeEnv` parameter and the `env,` staging argument. None of the three commits lists apply.ts, index.ts, operations.ts or edge/register.ts.
- I did not run `npm run check`. The orchestrator runs it at the wave boundary.

## Mutation record

- Migration: deleting `env,` from `stageOwner`'s staging call made the "sets" D-08-06 case fail (`ℹ fail 1`); restored, both passed.
- Update: deleting `env: args.env` from update-swap's staging call made the "sets" update case fail (`ℹ fail 1`); restored, both passed.
- Reinstall: deleting `env: input.env` from reinstall-replace's staging call made the "sets" reinstall case fail (`ℹ fail 1`); restored, both passed.

## Deviations from Plan

**1. Update collaborators bundled into `UpdateBindings`**
- **Found during:** Task 2
- **Issue:** the plan says to thread env "beside `hooksRouting` and `completionCache`". `buildDirectThreePhaseArgs` and `updateSinglePluginWith` already take 7 parameters, and `@typescript-eslint/max-params` (max 7, Sonar S107) would reject an eighth.
- **Fix:** a module-private `type UpdateBindings = Pick<ThreePhaseArgsBase, "hooksRouting" | "completionCache" | "env">`, built once in `createPluginUpdateOperations` and spread into the direct and cascade argument literals. `updatePluginsWith`, `buildDirectThreePhaseArgs` and `updateSinglePluginWith` take it in place of the two positional collaborators. No behavior change.
- **Commit:** aa5419ed

**2. Requirements not marked complete**
- DEBT-04 covers the whole phase. Plan 08-21 owns it.

**Total deviations:** 1 shape choice, with no change to behavior.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

Mitigations:
- T-08-27: each path stages with the environment its entry point received. The new cases pass explicit environments and never change `process.env`.

## Notes for later plans

- 08-13: all four staging callers (install-outcome, update-swap, reinstall-replace, mcp-migration) now pass env, so making `StageMcpInput.env` required should leave tsc errors only in direct `prepareStageMcpServers` test callers that omit it (for example `recordingOperations` forwards its input unchanged and needs nothing).
- The new update and reinstall cases each declare a `STAGING_VARIABLE_NOTICE` constant in their own test file; the audit counts no clone group for them.

## Self-Check: PASSED

- All ten modified files exist.
- Commits 473f9dea, aa5419ed and 76bf597f are ancestors of HEAD.

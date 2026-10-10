---
phase: 08-clear-milestone-debt
plan: 11
subsystem: install ledger, install flow, enable/disable (MCP staging environment)
tags: [d-08-06, avar-02, avar-04, debt-04, debt-02]

requires: [08-08]
provides:
  - "`InstallLedgerOptions.env: ClaudeEnv` (required); the mcp phase passes it to `prepareStageMcpServers` (D-08-06, AVAR-02)"
  - "Trailing `env: ClaudeEnv = process.env` on `createInstallPlugin`, `createInstallMissingDependency` (install-flow.ts) and `createSetPluginEnabled` (enable-disable.ts); operations.ts and every production caller unchanged"
  - "Module-private `SetEnabledRunOptions` in enable-disable.ts: the caller's options plus the factory's env, carried to both `runInstallLedger` option literals"
affects: [08-12 (update, reinstall, migration env threading), 08-13 (makes StageMcpInput.env required), 08-21 (P4 IN-02 ledger row)]

actuals:
  tokens: 9100
  tasks: 2
  commits: 2
plan_head_before: 03d2b85bbb4ff3929a15cd7cf0934aeabedb778c
plan_head_after: e616660b85db360a876f8639c242fefc16777a54

tech-stack:
  added: []
  patterns:
    - "Entry-point env default (D-08-06): a factory takes `env: ClaudeEnv = process.env` and every lower layer takes `env` as a required value"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
    - tests/orchestrators/plugin/install-outcome.test.ts
    - tests/orchestrators/plugin/install-flow.test.ts
    - tests/orchestrators/plugin/install-cascade.test.ts
    - tests/orchestrators/plugin/enable-disable.test.ts

key-decisions:
  - "enable-disable.ts carries env on a module-private `SetEnabledRunOptions` (extends the public `EnableDisablePluginOptions`) bound once in `createSetPluginEnabled`, instead of adding a positional parameter to every function between the factory and the two ledger calls; the public options type is unchanged"
  - "install-flow.ts passes env as a positional parameter (`installPluginWithTransaction`, `installMissingDependencyWithTransaction`, `buildInstallLedgerOptions`) and as a `PromotionArgs` member for the promotion re-materialization"
  - "The cascade-option clone group (install-flow.ts 1689-1723 / 2428-2458 after the change) stays inherited; no builder extraction or marker was needed"

patterns-established: []

requirements-completed: []

duration: 25min
completed: 2026-10-10
status: complete
---

# Phase 08 Plan 11: Explicit staging environment for install and enable Summary

**Install, the reload's dependency install, the install cascade and enable now stage MCP servers with the environment their operation was built with. The three factories default it to `process.env` at the entry point, the way `createGetPluginInfo` does, so operations.ts and every production caller are unchanged. Tests that need a variable missing pass `{}` instead of relying on the `PI_CM_UNSET_IN_EVERY_ENV` sentinel.**

## Performance

- **Duration:** about 25 min (ending 2026-10-10T05:07Z)
- **Tasks:** 2/2
- **Files modified:** 7 (3 sources, 4 tests)

## Findings closed

| Finding | Disposition | Commit |
| ------- | ----------- | ------ |
| P4 IN-02 (D-08-06, DEBT-04), install/enable part | install ledger, install cascade, missing-dependency install, promotion re-materialization and both enable ledger calls take an explicit env; the three install/cascade/enable sentinel cases pass `{}`. 08-12 (update, reinstall, migration) and 08-13 (required `StageMcpInput.env`) finish the finding | f2bde391, e616660b |

## Task Commits

1. **Task 1: An install built with an explicit environment stages its MCP servers with that environment.** Commit `f2bde391` (refactor). Pre-commit log `tmp/p8-11-precommit.log` ends `PRECOMMIT_EXIT=0`. Hook: `npm run check:commit` Passed on the first attempt.
2. **Task 2: The install, cascade and enable tests pass their environment instead of trusting a global sentinel.** Commit `e616660b` (test). Pre-commit log `tmp/p8-11-precommit2.log` ends `PRECOMMIT_EXIT=0`. Hook: `npm run check:commit` Passed on the first attempt.

## Verify results (final lines)

- Task 1: `npm run typecheck` exit 0, 0 `error TS` lines. `node --test` over install-outcome, install-flow, install-cascade and enable-disable tests: `ℹ tests 514`, `ℹ pass 514`, `ℹ fail 0`. `npm run test:coverage:direct -- <install-outcome.ts> <install-flow.ts> <enable-disable.ts>` exit 0 with no shortfall printed.
- Task 1 audit: `npx fallow audit --base "$(git merge-base origin/main HEAD)" --format json` gave `verdict pass introduced-here 0` (0 introduced groups in total). Re-run after both commits: `verdict pass introduced 0`.
- Task 2: `node --test` over install-flow, install-cascade and enable-disable tests: `ℹ tests 473`, `ℹ pass 473`, `ℹ fail 0`. `rg -n "PI_CM_UNSET_IN_EVERY_ENV" tests/orchestrators/plugin` prints nothing (`tmp/p8-11-sentinel.txt` empty).
- Plan verification: `tests/integration/mcp-variable-expansion.test.ts` and `tests/orchestrators/import/execute.test.ts` pass unchanged (`ℹ tests 68`, `ℹ pass 68`, `ℹ fail 0`).
- Acceptance: `grep -n "env: ClaudeEnv = process.env"` prints install-flow.ts:2205, install-flow.ts:2531 and enable-disable.ts:2515. The mcp-phase awk prints `env: opts.env,`. `operations.ts` is in neither commit.
- I did not run `npm run check`. The orchestrator runs it at the wave boundary.

## Mutation record

- Install: deleting `env: opts.env` from the mcp phase's staging call made the "reports no missing variable that its environment sets" install case fail (`ℹ fail 1`); restored, it passed.
- Enable: deleting `env: opts.env` from `materializeEnableRoot`'s ledger options made the matching enable case fail (`ℹ fail 1`); restored, it passed.

## Clone-group outcome (D-08-08)

The cascade-option group in install-flow.ts (now 1689-1723 / 2428-2458) stays `introduced: false`. Both instances gained the same `env` argument, and fallow did not re-key the group. No builder and no marker was added.

## Deviations from Plan

**1. Env carried on an internal options type in enable-disable.ts**
- **Found during:** Task 1
- **Issue:** the plan says to thread env "through `setPluginEnabledWithTransaction` to both `runInstallLedger` option literals". Ten functions sit between the factory and the two ledger calls.
- **Fix:** a module-private `SetEnabledRunOptions extends EnableDisablePluginOptions { readonly env: ClaudeEnv }`, bound once with `{ ...opts, env }` in `createSetPluginEnabled`. Only the opts types on the path to the ledger calls changed. The public `EnableDisablePluginOptions` is unchanged, and nothing spreads `opts` into persisted or rendered data.
- **Commit:** f2bde391

**2. Ledger context not extended**
- The plan says to "carry [env] on the ledger context". The mcp phase already reads `opts.removalOps` from the closure over the options, so it reads `opts.env` the same way. No context field was needed.

**3. Requirements not marked complete**
- DEBT-02 and DEBT-04 cover the whole phase. Plan 08-21 owns them.

**Total deviations:** 2 shape choices, with no change to behavior.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

Mitigations:
- T-08-26: staging reads only the environment its operation was given. The new cases pass explicit environments and never change `process.env`.

## Notes for later plans

- 08-12: install-flow's `buildInstallLedgerOptions(opts, env, core)` and enable-disable's `SetEnabledRunOptions` show the two threading shapes. `reconcile/apply.ts` and `import/execute.ts` reach staging through the defaulted factories and need no change for install or enable.
- 08-13: once `StageMcpInput.env` is required, the install ledger and enable already pass it, so tsc should list only update-swap, reinstall-replace and mcp-migration.
- The renamed test variables (`SERVER_SITE`, `BAR_SERVER_SITE`, `B_SERVER_SITE`) are missing because the case passes `{}`, whatever the process environment holds.

## Self-Check: PASSED

- All seven modified files exist.
- Commits f2bde391 and e616660b are ancestors of HEAD.

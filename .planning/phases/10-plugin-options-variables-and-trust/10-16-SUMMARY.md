---
phase: 10-plugin-options-variables-and-trust
plan: "16"
subsystem: hooks
status: complete
tags: [user-config, options, hooks, install, enable, update, reinstall]
requires: ["10-08", "10-11", "10-13"]
provides:
  - "the resolved options as a required member of ReadAndCachePluginHooksOptions"
  - "options on CascadeMemberOutcome, HydratableMember, EnableRouteEffect, and EnableCascadeHydratableMember"
  - "the four call sites of readAndCachePluginHooks, each fed from its own resolution"
  - "three scenarios of a hook in the session that ran the command"
affects: [10-20, 10-21]
tech-stack:
  added: []
  patterns: ["a required producer input, fed at each call site from the resolution that gives the plugin root"]
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/bridges/hooks/event-router.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-results.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-ledger.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
    - features/hook/process.feature
    - "the 13 test files of the plan"
decisions:
  - "A command that stages a plugin's hooks caches them with the options of the resolution it staged from, so a hook gets CLAUDE_PLUGIN_OPTION_<KEY> in that session with no /reload (D-PG10-10, D-PG10-15)."
metrics:
  duration: "~75 min"
  completed: 2026-11-15
actuals:
  tokens: 13400
  tasks: 2
  commits: 2
plan_head_before: 95f5f0c172472317988dddb0bf64f031c7a1c1a3
plan_head_after: 385343b7
---

# Phase 10 Plan 16: Hook options in the session that ran the command Summary

A hook now gets its `CLAUDE_PLUGIN_OPTION_<KEY>` variables in the session that installed, enabled, updated, or reinstalled its plugin, with no new session and no `/reload`. The install-time producer `readAndCachePluginHooks` takes the resolved options as a required input and copies them to the cache entry. Each of its four call sites computes them with `resolveOptions` of the `declaredUserConfig` of the resolution it takes the plugin root from.

## Tasks

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Give a hook its option defaults in the session that installed its plugin | 1ba6679a | 6 sources, process.feature, 12 test files |
| 2 | Give a hook its options in the session that enabled, updated, or reinstalled its plugin | 385343b7 | enable-disable.ts, update-swap.ts, process.feature, 4 test files |

## Red then green

- Task 1, scenario red: "A hook of a plugin installed in this session receives the plugin's option defaults (PG-CORE-03)" failed at `Then the hooks record these runs:`. The hook run was recorded (`option-hook`, session `first`, the three path variables), but it had no `CLAUDE_PLUGIN_OPTION_MODE` and no `CLAUDE_PLUGIN_OPTION_RETRIES` column, and no `fast` or `3` value. 1 scenario (1 failed), 14 steps (12 passed, 1 skipped, 1 failed). So the session that ran the install dispatched the hook, and the stop gate did not apply.
- Task 1, owner red (`--test-name-pattern="D-PG10-10"` on the four owner files): 6 tests, 4 failed, 2 passed. Failed: "D-PG10-10 readAndCachePluginHooks gives the entry and each routing entry the options of its input", "D-PG10-10 each materialized member carries the options of its own resolution", "D-PG10-10: re-materializes a disabled dependency and carries its resolved version and options" (`options: undefined`), and "D-PG10-10 an install gives its plugin's routing entries the options of the resolution it installed" (`declared: false` where `declared: true` and `mode => fast` were expected). Passed: the flatten case of plan 10-08 and "D-PG10-10: a member's options leave its dependency row unchanged", a guard.
- Task 1, green: the scenario gave 1 scenario (1 passed), 14 steps (14 passed). The 12 test files of the first `<verify>` gave 1871 tests, 1871 pass. Direct coverage of the six sources exited 0. `typecheck`, `test:architecture`, `test:cucumber:profile -- --profile adapter features/hook/process.feature` (7 scenarios, 7 passed), and `check:features` exited 0. The commit hook passed `check:commit`. The tracer gate was green.
- Task 2, scenario red: `--name "in this session"` gave 3 scenarios (1 passed, 2 failed), 46 steps (42 passed, 2 skipped, 2 failed). The reinstall scenario's recorded run had no option columns where `slow` and `3` were expected. The enable scenario's recorded run had none where `fast` and `3` were expected.
- Task 2, owner red (`--test-name-pattern="D-PG10-1[05]"` on the four owner files): 9 tests, 6 failed, 3 passed. Every failure gave `[{ declared: false, values: Map(0) {}, ... }]`: both enable paths, the swap with options, the update (it runs twice, because `update-swap.test.ts` imports `update-flow.test.ts`), and the reinstall. Passed: the two D-PG10-15 record cases of plan 10-07 and "D-PG10-15: a swap to a version that declares no options gives its routing entries none", a guard.
- Task 2, green: the scenarios gave 3 scenarios (3 passed), 46 steps (46 passed). The five test files of the second `<verify>` gave 1023 tests, 1023 pass. Direct coverage of `enable-disable.ts` and `update-swap.ts` exited 0. `test:cucumber:profile -- --profile adapter` on hook/process and hook/lifecycle gave 13 scenarios (13 passed), 194 steps. `check:features`, `typecheck`, ESLint on the touched files, `fallow dupes`, and `fallow health` exited 0. A regression run of install-flow-ledger, import/execute, reconcile/apply, both uninstall tests, and `test/integration/hooks-dispatch-end-to-end.test.ts` gave 828 tests, 828 pass. The commit hook passed `check:commit`.
- The marker: I deleted the `fallow-ignore-next-line code-duplication` marker above the re-enabled members loop in `enable-disable.ts` and ran `npx fallow dupes`. It reported one group, `enable-disable.ts:1983-1995` with `install-flow-ledger.ts:391-403`, which still spans the `for` line. I put the marker back above that line, and `fallow dupes` exited 0.

## Lines for later plans

- Producer input: `ReadAndCachePluginHooksOptions.options: ResolvedOptions` (required) in `bridges/hooks/event-router.ts`. `readAndCachePluginHooksWith` puts `opts.options` on the cache entry and builds no options of its own. The file no longer imports `resolveOptions`.
- Carriers, all named `options: ResolvedOptions`:
  - `CascadeMemberOutcome.options` (`install-cascade.ts`), beside `pluginRoot` and `hooksConfigPath` under the never-rendered comment, now citing D-PG10-10. `recordMaterializedMember` sets `resolveOptions(summary.resolved.declaredUserConfig)`.
  - `HydratableMember` (`install-flow-results.ts`) picks `"options"`. The promotion sets it from `summary.resolved.declaredUserConfig`.
  - `EnableRouteEffect.options` and `EnableCascadeHydratableMember.options` (`enable-disable.ts`), each set from the resolution's `declaredUserConfig` in its builder.
- Call sites: `hydrateInstalledHooks` passes `member.options`. `addCachedHooks` passes `effect.options`. `hydrateReEnabledMemberHooks` passes `member.options`. `refreshHooksCacheAfterUpdate` passes `resolveOptions(installable.declaredUserConfig)`. No call site reads the record, so `recordedOptionsOf` stays the one reader of the record's field.
- A member of a plugin that declares no `userConfig` carries `resolveOptions(undefined)`, `declared: false`. The hook environment then holds no option variable.
- Scenario titles in `features/hook/process.feature`, at the end of the file except the first:
  - "A hook of a plugin installed in this session receives the plugin's option defaults (PG-CORE-03)", after the 10-08 option scenario
  - "A reinstall in this session delivers a changed option default to the plugin's hooks (D-PG10-15)"
  - "Enabling a disabled plugin in this session gives its hooks the plugin's option defaults (D-PG10-15)"

## Parent-owned lines requested

- PG-CORE-03: the hook half of success criterion 1 now holds at a load (10-08) and in the session that ran the command (this plan). Mark it complete only when the other plans that own a part of it are done.
- STATE.md decision: "A command that stages a plugin's hooks caches them with the options of the resolution it staged from, so a hook gets CLAUDE_PLUGIN_OPTION_<KEY> in that session with no /reload (D-PG10-10, D-PG10-15)."

## Deviations from Plan

1. **The promotion's owner case extends an existing case.** "re-materializes a disabled dependency and carries its resolved version" is now "D-PG10-10: re-materializes a disabled dependency and carries its resolved version and options". It writes the plugin's manifest with a `userConfig` and asserts the options. A separate case would have copied about 40 lines of setup.
2. **Two owner cases are guards that pass before the edit.** "D-PG10-10: a member's options leave its dependency row unchanged" composes the rows of a member with options and of the same member without, which is the T-10-44 check. "D-PG10-15: a swap to a version that declares no options gives its routing entries none" pins the `declared: false` case.
3. **The Task 2 scenarios use the manifest of Task 1,** with three options. So their runs tables also state `CLAUDE_PLUGIN_OPTION_RETRIES` with `3`.
4. **The stale comment of plan 10-08 is gone.** The "readAndCachePluginHooks reads and parses one case-owned config" case kept `options: resolveOptions(undefined)` as its input and expected value, without the comment that said the install-time entry holds no options.
5. **No file outside the plan's list needed a change.** The type check named only the eight test files of the plan that call the producer directly.

## Known Stubs

None. The install-time producer's empty options of plan 10-08 are replaced.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-10-44: the options sit beside `pluginRoot` and `hooksConfigPath`. `CascadeInstalledRow` does not declare them, and the owner case shows equal dependency rows for a member with and without options. T-10-45: each call site computes the options from the resolution it takes the plugin root from. Owner cases state the routing entry's options after an install, an enable on both paths, an update, and a reinstall. The reinstall scenario shows the new default `slow`. T-10-SC: no package was installed or changed.

## Self-Check: PASSED

- FOUND: `declaredUserConfig` in install-cascade.ts (1), install-flow-results.ts (1), enable-disable.ts (2); `D-PG10-10` in install-cascade.ts (1) and enable-disable.ts (2); `in this session` in process.feature (3)
- FOUND: 1ba6679a, 385343b7 (ancestors of HEAD); `git rev-list --count 95f5f0c1..385343b7` is 2

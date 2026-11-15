---
phase: 10-plugin-options-variables-and-trust
plan: "08"
subsystem: hooks
status: complete
tags: [user-config, options, hooks, hook-env, install-record]
requires: ["10-07"]
provides:
  - "recordedOptionsOf, the one reader of a record's userConfig, which parses it again"
  - "the required member options: ResolvedOptions on CacheEntry and RoutingEntry"
  - "CLAUDE_PLUGIN_OPTION_<KEY> in prepareHookEnv, for both spawn lanes"
  - "the scenarios for the option variable and for a reinstall that changes a default"
affects: [10-16, 10-20]
tech-stack:
  added: []
  patterns: ["a required carrier member, fed by the load-time producer from the record"]
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/persistence/state-io.ts
    - extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts
    - extensions/pi-claude-marketplace/bridges/hooks/event-router.ts
    - extensions/pi-claude-marketplace/bridges/hooks/hook-env.ts
    - features/hook/process.feature
    - test/persistence/state-io.test.ts
    - test/bridges/hooks/hook-env.test.ts
    - test/bridges/hooks/event-router.test.ts
    - test/bridges/hooks/routing-state.test.ts
    - test/integration/hooks-dispatch-end-to-end.test.ts
    - "the other 10 hook test files of the plan (one options member each)"
decisions:
  - "A hook's environment holds CLAUDE_PLUGIN_OPTION_<KEY> for each option with a default, from the record's userConfig read through recordedOptionsOf at load (D-PG10-10, D-PG10-23)."
  - "The install-time cache producer stores resolveOptions(undefined) until the next load (D-PG10-10)."
metrics:
  duration: "~40 min"
  completed: 2026-11-15
actuals:
  tokens: 14600
  tasks: 2
  commits: 2
plan_head_before: d0cb0ccf41639bf3d72b6e4eed27948a3164c9af
plan_head_after: af60a6121fcae668affdae62862b6117f16a96c1
---

# Phase 10 Plan 08: Export a plugin's option defaults to its hooks Summary

A hook now gets `CLAUDE_PLUGIN_OPTION_<KEY>` for each declared option that has a default. A load reads the option schema from the install record through `recordedOptionsOf`, which parses it again. The hooks cache entry and each routing entry carry the resolved options, and `prepareHookEnv` exports them for both spawn lanes.

## Tasks

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Export a plugin's option defaults to its hooks from the install record | 89eeae90 | 4 sources, process.feature, 14 test files |
| 2 | Show a reinstall and an edited record at the hook | af60a612 | process.feature, hooks-dispatch-end-to-end.test.ts |

## Red then green

- Task 1, scenario red: "A hook receives each plugin option that has a default as CLAUDE_PLUGIN_OPTION_KEY (PG-CORE-03)" failed at `Then the hooks record these runs:`. The run had no `CLAUDE_PLUGIN_OPTION_MODE` and no `CLAUDE_PLUGIN_OPTION_RETRIES` column, and no `fast` or `3` value. 1 scenario (1 failed), 15 steps (13 passed, 1 skipped, 1 failed).
- Assumption A4 holds: the runs step takes a `CLAUDE_PLUGIN_OPTION_*` column unchanged. The recorder keeps every `CLAUDE_*` variable, and each one becomes a column by its name.
- Task 1, owner red: `test/persistence/state-io.test.ts` failed to load (`does not provide an export named 'recordedOptionsOf'`). With the four sources at HEAD and the new tests in place, hook-env, event-router, and routing-state gave 6 failures: the three D-PG10-10 hook-env cases, the flatten case, the hydrate case, and the install-time producer projection. The routing-state case passed at HEAD, because the operations only store the entry.
- Task 1, green: the scenario gave 1 scenario (1 passed), 15 steps (15 passed). The state-io, two architecture, four orchestrator, and hooks integration tests gave 1041 pass. `test/bridges/hooks/**` gave 1635 pass. Direct coverage of the four sources exited 0. `typecheck`, `test:cucumber:profile -- --profile adapter features/hook/process.feature` (4 scenarios, 4 passed), and `check:features` exited 0. Nothing changed under `orchestrators/`. The hook passed `check:commit`. The tracer gate was green.
- Task 2, scenario guard: "A reinstall delivers a changed option default to the plugin's hooks (D-PG10-15)" passed: 1 scenario (1 passed), 17 steps (17 passed). With the `replaceUserConfig(sRecord, ...)` line removed from `orchestrators/plugin/update-swap.ts` in the working tree, the run stated `fast` where `slow` was expected: 1 scenario (1 failed), 17 steps (15 passed, 1 skipped, 1 failed). `git checkout` restored the file.
- Task 2, integration guard: the two D-PG10-23 cases passed (7 tests, 7 pass). With `recordedOptionsOf` resolving the stored value without parsing it, the string case failed with `declared: true` where `declared: false` was expected (7 tests, 1 failed). `git checkout` restored the file, and `git diff --quiet HEAD -- extensions/pi-claude-marketplace` exited 0.
- Task 2, green: `test:cucumber:profile -- --profile adapter` on hook/process, hook/lifecycle, and plugin/reinstall gave 34 scenarios (34 passed), 467 steps (467 passed). `check:features` exited 0. The hook passed `check:commit`.

## Lines for later plans

- Reader: `recordedOptionsOf(record: Pick<PluginInstallRecord, "userConfig">): ResolvedOptions` in `persistence/state-io.ts`. It parses the field with `parseUserConfig` and resolves it with `resolveOptions`. A missing field gives `resolveOptions(undefined)`. A value that does not parse gives the same and logs `[state] recorded userConfig ignored: <detail>`. Every reader of the field must go through it.
- Carrier member: `options: ResolvedOptions`, required on `CacheEntry` and on `RoutingEntry` (`bridges/hooks/routing-state.ts`). `pushGroupHandlers` copies it from the cache entry to each routing entry.
- Load-time producer: `hydrateTargets` puts `recordedOptionsOf(pluginRecord)` on `HydrateOnePluginTarget.options`, and `tryHydrateOnePlugin` puts it on the cache entry.
- Install-time producer: `readAndCachePluginHooksWith` puts `resolveOptions(undefined)` on its entry. `ReadAndCachePluginHooksOptions` has no option input yet. Plan 10-16 adds it and changes its four call sites.
- Environment: `prepareHookEnv` spreads `hookOptionVariableName(key) -> value` for each entry of `entry.options.values` after the three path variables and before `...extra` and the session env. A lane addition and the session variables win. Two keys that name one variable leave the later key's value.

## Parent-owned lines requested

- PG-CORE-03: the hooks half is done for a session that a load started. Plan 10-16 covers the session that ran the command, so do not mark the requirement complete yet.
- STATE.md decision: "A hook's environment holds CLAUDE_PLUGIN_OPTION_<KEY> for each option with a default, read from the record's userConfig through recordedOptionsOf at load (D-PG10-10, D-PG10-23)."

## Deviations from Plan

1. **No test file outside the plan's list needed the member.** The type check named only the 13 hook test files that the plan lists.
2. **The install-time producer case extends an existing test.** The "readAndCachePluginHooks reads and parses one case-owned config" projection now holds `options`, and the expected row holds `resolveOptions(undefined)`. A separate case would have copied its setup.
3. **The integration cases carry `declared` as well as the values.** Without parsing, a string schema resolves to no values but `declared: true`. So the values alone cannot show the reader's second parse, and `declared` is the field that fails in the proof.

## Known Stubs

None. The install-time producer's empty options are planned, and plan 10-16 gives it its input.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-10-17: `recordedOptionsOf` parses the stored value at every read. Owner cases cover a string, an option with no `title`, and `__proto__` as a key, and an integration case shows the load going on. T-10-18: every name starts with `CLAUDE_PLUGIN_OPTION_`. An owner case shows an option over the process value, a lane addition over an option, and `CLAUDE_PLUGIN_ROOT` and the session variable unchanged. T-10-SC: no package was installed or changed.

## Self-Check: PASSED

- FOUND: extensions/pi-claude-marketplace/persistence/state-io.ts (`export function recordedOptionsOf`), bridges/hooks/hook-env.ts (`hookOptionVariableName`), bridges/hooks/routing-state.ts (`D-PG10-10` twice), features/hook/process.feature (`CLAUDE_PLUGIN_OPTION_MODE`, `D-PG10-15`)
- FOUND: 89eeae90, af60a612 (ancestors of HEAD)
- Both lanes still call `prepareHookEnv`: `dispatch-exec.ts` and `async-rewake/registry.ts` are unchanged.

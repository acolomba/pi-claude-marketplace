---
phase: 10-plugin-options-variables-and-trust
plan: "14"
subsystem: mcp
status: complete
tags: [user-config, options, mcp, builtin-mcp, registration]
requires: ["10-08", "10-09", "10-12"]
provides:
  - "the required member options: ResolvedOptions | undefined on McpSubstitutionContext, fed by the adapter stage and the built-in registration step"
  - "builtinServerConfig returns undefined for a server that mcpOptionBlock blocks"
  - "the registration step reads a record's options through declaredOptions(recordedOptionsOf(record)) and debug-logs a blocked server"
  - "features/mcp-server/builtin-options.feature (Feature: MCP server builtin options, @builtin-only)"
affects: [10-15, 10-17, 10-19, 10-21]
tech-stack:
  added: []
  patterns: ["one domain verdict decides a blocked server for both MCP implementations"]
key-files:
  created:
    - features/mcp-server/builtin-options.feature
  modified:
    - extensions/pi-claude-marketplace/bridges/mcp/substitute.ts
    - extensions/pi-claude-marketplace/bridges/mcp/builtin-entry.ts
    - extensions/pi-claude-marketplace/bridges/mcp/stage.ts
    - extensions/pi-claude-marketplace/orchestrators/mcp/builtin-registration-step.ts
    - test/bridges/mcp/builtin-entry.test.ts
    - test/bridges/mcp/substitute.test.ts
    - test/bridges/mcp/adapter-entry.test.ts
    - test/orchestrators/mcp/builtin-registration-step.test.ts
    - test/integration/adapter-expansion-conformance.test.ts
    - test/integration/mcp-builtin-encoding-conformance.test.ts
    - test/integration/mcp-adapter-entry-conformance.test.ts
decisions:
  - "Under Pi's built-in MCP, a plugin server whose fields name ${user_config.KEY} for an option with no value is not registered; the registration step debug-logs it and adds no notice, because the command that staged the plugin already reported it (D-PG10-08, D-PG10-21)."
  - "McpSubstitutionContext carries the plugin's options as a required member, undefined for a plugin that declares no userConfig (D-PG10-21)."
metrics:
  duration: "~35 min"
  completed: 2026-11-15
actuals:
  tokens: 5500
  tasks: 2
  commits: 2
plan_head_before: 0034db0f5cc57abe40cddd746dfd0f391368924f
plan_head_after: fe7eba33
---

# Phase 10 Plan 14: Skip a built-in MCP server that names an unset plugin option Summary

Pi's built-in MCP no longer registers a plugin server that names `${user_config.KEY}` for an option with no value. The plugin's other servers register as before. `builtinServerConfig` asks `mcpOptionBlock`, the same verdict the adapter stage uses, so the two implementations cannot disagree. The registration step reads the record's options through `declaredOptions(recordedOptionsOf(record))` and reads no manifest. A record with no `userConfig` field keeps the reference as written.

## Tasks

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Do not register a server that names an unset plugin option with Pi's built-in MCP | ab7632cc | 4 sources, 7 tests, builtin-options.feature |
| 2 | Guard that a plugin with no options registers its servers as before | fe7eba33 | features/mcp-server/builtin-options.feature |

## Red then green

- Task 1, scenario red (before any product edit): `npm run test:cucumber:profile -- --profile builtin features/mcp-server/builtin-options.feature` failed at `Then pi holds these mcp server configs, apart from each stdio server's command and arguments:`. The registry also held `plugin_demo_keyed` with `"TOKEN":"$${user_config.token}"`. Result: 1 scenario (1 failed), 12 steps (11 passed, 1 failed), exit 1.
- Task 1, owner red: I wrote the product edits before the owner cases, so I took the red run against HEAD. I saved the four sources, restored them with `git checkout`, ran the three owner test files, and copied the sources back. `cmp` showed each one unchanged. Result: 127 tests, 2 failed: "D-PG10-21: a server that names a plugin option with no value gives no config" and "D-PG10-21: a server that names a plugin option with no value is skipped and logged, and the plugin's other server registers". The other four new cases are guards that pass on HEAD: the declared-options plain server, the no-options reference in `builtin-entry.test.ts`, the record with no `userConfig` in the step test, and the substitute case that the options do not change the adapter entry.
- Task 1, green: the builtin run of builtin-options and builtin-values gave 6 scenarios (6 passed), 72 steps. The adapter run of mcp-server/options and configuration gave 14 scenarios (14 passed), 178 steps. The seven `<verify>` unit and integration files plus `mcp-adapter-entry-conformance.test.ts` gave 484 pass and 0 fail. The callers (`bridges/mcp/index`, `session-materialize`, `test/index.test.ts`, `bridges/mcp/types`) gave 77 pass. Direct coverage of all four sources exited 0. `typecheck`, `check:features`, ESLint on the touched files, and `npm run fallow` exited 0. The hook passed `check:commit`. The tracer gate was green.
- Task 2, guard: it passed on the Task 1 code: 2 scenarios (2 passed), 23 steps.
- Task 2, guard proof: in the working tree only, I made the registration step pass `recordedOptionsOf(source.record)` without `declaredOptions`. The guard failed at the same `Then`: the registry held no `plugin_demo_keyed`. Result: 2 scenarios (1 passed, 1 failed), 23 steps (22 passed, 1 failed). `git checkout` restored the file, and `git diff --quiet HEAD -- extensions/pi-claude-marketplace` exited 0.
- Task 2, green: 2 scenarios (2 passed), 23 steps. `check:features` exited 0. The hook passed.

## Lines for later plans

- Options member: `McpSubstitutionContext.options: ResolvedOptions | undefined` (required) in `bridges/mcp/substitute.ts`. The adapter encoder does not read it yet (plan 10-17). A substitute case, "D-PG10-21: the options on the context leave the adapter entry as the context without them", pins that. Plan 10-17 changes that case.
- Producers: `bridges/mcp/stage.ts` passes `options: input.options`. `orchestrators/mcp/builtin-registration-step.ts::recordRegistrations` passes `options: declaredOptions(recordedOptionsOf(source.record))`. Every test fixture states `options: undefined`, except the new D-PG10-21 cases.
- Built-in entry: `builtinServerConfig` returns `undefined` when `!isPlainObject(server) || mcpOptionBlock(server, ctx.options) !== undefined`, before the translation. Plan 10-19's fill must check `mcpOptionBlock` before it fills.
- Debug log (channel `mcp`): `MCP server <registered name> not registered: it names plugin options (<reason>): <keys joined with ", ">`. Measured: `[mcp] MCP server plugin_demo_keyed not registered: it names plugin options (unset): token`. The private `skipCause(config, ctx)` asks the verdict and prints its `reason` and `keys` as given, so plan 10-15's second reason needs no change here. Any other `undefined` config keeps `Pi would not run it as Claude Code does`.
- Built-in escape of an option reference kept as written: `"TOKEN":"$${user_config.token}"`.
- Scenario titles in `features/mcp-server/builtin-options.feature` (`@builtin-only`, Background publishes `fixtures` with `demo` 1.0.0):
  - "Pi's built-in MCP does not register a server that names a plugin option with no value (PG-CORE-03, D-PG10-21)"
  - "Pi's built-in MCP registers a server of a plugin with no options with its option reference as written (D-PG10-21)"
- No new step was needed, so `features/step_definitions/mcp-server/builtin-options.steps.ts` was not created. The scenarios use the `.mcp.json` "with these stub mcp servers" step with plain entries (absent commands register; no tool listing is needed), the `plugin.json` "with this text" step, and the registry probe steps of `builtin-values.steps.ts`.

## Parent-owned lines requested

- STATE.md decision: "Under Pi's built-in MCP, a plugin server whose fields name ${user_config.KEY} for an option with no value is not registered; the registration step debug-logs it and adds no notice, because the command that staged the plugin already reported it (D-PG10-08, D-PG10-21)."
- STATE.md decision: "McpSubstitutionContext carries the plugin's options as a required member, undefined for a plugin that declares no userConfig (D-PG10-21)."
- PG-CORE-03: the built-in registration drop is done. The fill is plans 10-17 and 10-19. Do not mark the requirement complete yet.

## Deviations from Plan

1. **[Rule 3 - Blocking] `test/integration/mcp-adapter-entry-conformance.test.ts` gained `options: undefined`.** It is outside the plan's file list. It builds a `McpSubstitutionContext` inline in `stampServers`'s input, which the plan's grep for the type name did not find, and the type check failed there. It is one line in the Task 1 commit.
2. **Owner red runs were taken by restoring the sources to HEAD,** as in plans 10-12 and 10-13. The scenario red run came before any product edit.
3. **The blocked server's reference is in `env`, not `args`.** The probe step leaves out each stdio server's command and arguments, so a reference in `args` would not show in the guard's table. Both scenarios use `env`.
4. **The table columns of the feature file were aligned after the guard proof.** Only whitespace changed. The scenario ran green again after it.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-10-46: `builtinServerConfig` returns no config for a server the verdict blocks, and the registration step reads the options through `recordedOptionsOf`, which parses the stored schema (T-10-17). Owner cases cover the blocked server, the plain server beside it, and a record with no field. The `@builtin-only` scenario shows the registry. The debug log holds the registered name and option keys only, never a config value. T-10-SC: no package was installed or changed.

## Self-Check: PASSED

- FOUND: features/mcp-server/builtin-options.feature (`Feature: MCP server builtin options`, 2 `  Scenario` lines)
- FOUND: `mcpOptionBlock` (3) and `D-PG10-21` (1) in bridges/mcp/builtin-entry.ts; `recordedOptionsOf` (2) in orchestrators/mcp/builtin-registration-step.ts
- FOUND: both production `: McpSubstitutionContext = {` sites state `options`
- FOUND: ab7632cc, fe7eba33 (ancestors of HEAD)

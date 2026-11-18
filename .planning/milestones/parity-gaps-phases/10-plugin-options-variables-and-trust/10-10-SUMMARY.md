---
phase: 10-plugin-options-variables-and-trust
plan: "10"
subsystem: env
status: complete
tags: [user-config, options, process-env, ledger, project-trust, pi-mcp-adapter]
requires: ["10-02", "10-04", "10-06", "10-08", "10-09"]
provides:
  - "OPTION_LEDGER_ENV = PI_CLAUDE_MARKETPLACE_OPTIONS, the pure planOptionLedger core, and applyOptionLedger in shared/session-env.ts"
  - "ownedOptionVariables(plugin, mcpValues) in bridges/mcp/adapter-escape.ts: each option's owned name and escaped value"
  - "createPluginOptionVariables in orchestrators/plugin-options.ts with applyUserScope, applyForLoad, applyAgain"
  - "OWNED_VARIABLE_PREFIX exported from domain/user-config.ts"
affects: [10-17, 10-20, 10-21]
tech-stack:
  added: []
  patterns: ["a scope-tagged env ledger with three outcomes per scope: fresh, keep, remove", "the after-command apply wraps the background gate's runner in index.ts, so the edge layer is unchanged"]
key-files:
  created:
    - extensions/pi-claude-marketplace/orchestrators/plugin-options.ts
    - test/orchestrators/plugin-options.test.ts
    - test/orchestrators/scope-state-seeds.ts
  modified:
    - extensions/pi-claude-marketplace/shared/session-env.ts
    - extensions/pi-claude-marketplace/bridges/mcp/adapter-escape.ts
    - extensions/pi-claude-marketplace/domain/user-config.ts
    - extensions/pi-claude-marketplace/index.ts
    - test/shared/session-env.test.ts
    - test/bridges/mcp/adapter-escape.test.ts
    - test/domain/user-config.test.ts
    - test/orchestrators/plugin-path.test.ts
    - test/index.test.ts
    - features/plugin/options.feature
decisions:
  - "Each option of the MCP value map of each enabled record gets PI_CLAUDE_MARKETPLACE_OPTION_<16 hex>, valued serializeLiteral(value, false); the ledger PI_CLAUDE_MARKETPLACE_OPTIONS lists <scope>:<name> entries, comma-joined, user scope first (D-PG10-11, D-PG10-23)."
  - "The factory applies the user scope and keeps the project's names; a load applies the project scope only when its trust answer is true and removes it otherwise; every command applies again with the last load's cwd and trust answer (D-PG10-23)."
  - "A scope whose state cannot be read keeps its names; an empty ledger is deleted, not set to the empty string."
metrics:
  duration: "~75 min"
  completed: 2026-11-15
actuals:
  tokens: 17102
  tasks: 2
  commits: 2
plan_head_before: 56a3ea43ea87968a4c412de819e9a5ccb78ebead
plan_head_after: 3230acad
---

# Phase 10 Plan 10: Process variables for plugin options Summary

Each option of an enabled plugin now has a process variable on Pi's process, named `PI_CLAUDE_MARKETPLACE_OPTION_<16 hex>` and valued with the adapter's split-token escape. The ledger `PI_CLAUDE_MARKETPLACE_OPTIONS` owns the names. The awaited factory sets the user scope. A load sets the project scope only when its trust answer is true, and removes it otherwise. Every `/claude:plugin` command applies the variables again.

## Tasks

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Set a process variable for each plugin option, user scope at start and project scope only when trusted | 81bca81c | session-env.ts, plugin-options.ts (new), adapter-escape.ts, user-config.ts, index.ts, 7 tests and the seed module, options.feature |
| 2 | Apply the option variables again after each command, and remove the names of a plugin that is gone | 3230acad | plugin-options.ts, index.ts, their two tests, options.feature |

## Red then green

- Task 1, scenarios red: `npx cucumber-js --profile adapter --name "option variable" features/plugin/options.feature` gave 2 scenarios (2 failed), 31 steps (29 passed, 2 failed). Both failed at `Then the model receives these calls:`. Every bash row read `bash returned: (no output)`, where the expected rows were `bash returned: project:PI_CLAUDE_MARKETPLACE_OPTION_34f6bcb3de70f47b`, `bash returned: fast` (trusted project), and `bash returned: user:PI_CLAUDE_MARKETPLACE_OPTION_17d4e1bcc7bbb7b4` ("Do not trust").
- Task 1, owner red: I wrote the cases beside the product edit. I then put the four sources back to HEAD and removed `plugin-options.ts` in the working tree, and ran the six `<verify>` test files: 86 tests, 74 pass, 12 fail. `session-env.test.ts`, `adapter-escape.test.ts`, and `user-config.test.ts` failed to load (`does not provide an export named 'OPTION_LEDGER_ENV'`, `'ownedOptionVariables'`, `'OWNED_VARIABLE_PREFIX'`). `plugin-options.test.ts` gave `ERR_MODULE_NOT_FOUND`. In `index.test.ts`, the four new D-PG10-23 and NFR-2 cases failed, and so did the four cases that count `CWD_READS_PER_DISCOVER` (now 5). I restored the sources from the scratch copies.
- Task 1, green: 2 scenarios (2 passed), 31 steps. The six owner files gave 203 pass, then `index.test.ts` gave 53 pass. Direct coverage of all six sources exited 0. `typecheck`, `lint`, `check:features`, and `fallow` exited 0. The adapter conformance integration test gave 66 pass. `options.feature` plus `executables.feature` gave 12 scenarios (12 passed). The tracer gate was green.
- Task 1, hook: the first commit attempt failed `test/architecture/scope-order-drift.test.ts` ("no `["user", "project"]` literal outside the canonical SCOPES declaration") on my `OPTION_SCOPES` constant in `session-env.ts`. That module may not import `shared/types.ts`, so the core now handles the two scopes by name in a helper, `scopeLedgerChange`. The second attempt passed `check:commit`.
- Task 2, scenario red: "An uninstalled plugin's option variable is gone after the command (D-PG10-11)" failed at the model-calls step. It read `bash returned: user:PI_CLAUDE_MARKETPLACE_OPTION_8327543a562fe281`, where `bash returned: (no output)` was expected. 1 scenario (1 failed), 14 steps (13 passed, 1 failed).
- Task 2, owner red: `plugin-options.test.ts` gave 8 tests and 4 failed, all four `applyAgain` cases (`applyAgain` did not exist). Three `index.test.ts` cases failed on the environment assertion: the same-session command, the last load's trust answer (it still held the project name), and the throwing command.
- Task 2, green: `npm run test:cucumber:profile -- --profile adapter features/plugin/options.feature` gave 9 scenarios (9 passed), 109 steps. `plugin-options`, `index`, and `edge/register` gave 396 pass. Direct coverage of `plugin-options.ts` and `index.ts` exited 0. `typecheck`, `check:features`, `lint`, and `fallow` exited 0. The regression run of `executables.feature`, `project-trust.feature`, and `hook/process.feature` gave 16 scenarios (16 passed). The hook passed `check:commit`.

## Lines for later plans

- Variable name: `ownedOptionVariableName({ scope, marketplace, plugin, key })`. The marketplace and plugin are the keys of `state.marketplaces` and `mp.plugins`. Names the scenarios state: project `fixtures`/`demo`/`mode` is `PI_CLAUDE_MARKETPLACE_OPTION_34f6bcb3de70f47b`; user `mine`/`personal`/`mode` is `PI_CLAUDE_MARKETPLACE_OPTION_17d4e1bcc7bbb7b4`; user `fixtures`/`demo`/`mode` is `PI_CLAUDE_MARKETPLACE_OPTION_8327543a562fe281`.
- Name and value, one source: `ownedOptionVariables(plugin: Omit<OwnedOptionAddress, "key">, mcpValues): ReadonlyMap<key, { name, value }>` in `bridges/mcp/adapter-escape.ts`. The value is `serializeLiteral(value, false)`. Plan 10-17's stage should call it for both the reference name and the overlay on its environment.
- Ledger format: `PI_CLAUDE_MARKETPLACE_OPTIONS` holds comma-joined `<scope>:<name>` entries, user scope first, then each scope in state order (marketplace, plugin, then option key in declaration order). An empty ledger is deleted. On read, an entry that does not match `^(?:user|project):\w+$`, or whose name lacks the `PI_CLAUDE_MARKETPLACE_OPTION_` prefix, is ignored. A name that the same apply sets is never deleted.
- Core: `planOptionLedger(priorLedger, ownedPrefix, { user, project })` returns `{ remove, set, ledger }`. Each outcome is `{ kind: "fresh", variables }`, `{ kind: "keep" }`, or `{ kind: "remove" }`. `applyOptionLedger(env, change)` deletes, then sets, then writes the ledger.
- Operations of `createPluginOptionVariables({ loadState, env })`, and when each runs:
  - `applyUserScope()`: in the awaited factory, right after `applyMcpAdapterEnvFrom(() => process.cwd())`. It reads the user state and keeps the project's entries.
  - `applyForLoad(cwd, projectTrusted)`: in `prepareResources`, after the PATH recompute, with `event.cwd` and the load's `projectTrusted` constant. With `false` it does not open the project state and removes the project's names. It records the cwd and the trust answer.
  - `applyAgain()`: after every `/claude:plugin` command, inside the background gate, in a `finally`. It uses the last load's cwd and trust answer, or `applyUserScope()` before any load.
- Each state read is `loadState(root, { persistMigration: false })`. A read failure keeps that scope (fresh to keep) and logs `[env] plugin options: kept the <scope> scope's variables: <message>`. A throw from any apply logs `[env] plugin option variables skipped: <message>`.
- Test support: `test/orchestrators/scope-state-seeds.ts` exports `pluginRecord`, `marketplaceRecord`, `stateFor`, and `seedState`, which `plugin-path.test.ts` and `plugin-options.test.ts` share.
- `test/index.test.ts`: `CWD_READS_PER_DISCOVER` is 5, and `CWD_READ_PLUGIN_OPTIONS` is 4. `createHermeticScope` tracks `PI_CLAUDE_MARKETPLACE_OPTIONS` and restores every `PI_CLAUDE_MARKETPLACE_OPTION_*` name.
- Scenario titles in `features/plugin/options.feature`: "The bash tool's environment holds the option variable of a trusted project's plugin (D-PG10-11)", "In a project the user marked do not trust, only the user-scope plugin's option variable is set (D-PG10-23)", "An uninstalled plugin's option variable is gone after the command (D-PG10-11)".

## Parent-owned lines requested

- `10-VALIDATION.md`, Wave 0: "owned-variable orchestrator pair (orchestrators/plugin-options.ts + test/orchestrators/plugin-options.test.ts, 100% direct coverage)" is closed, and so is the Runtime State Inventory row "the two names in the env snapshot of test/index.test.ts".
- STATE.md decision: "Each option of an enabled plugin's MCP value map gets PI_CLAUDE_MARKETPLACE_OPTION_<16 hex>, valued with the split-token escape and owned through the scope-tagged ledger PI_CLAUDE_MARKETPLACE_OPTIONS; the factory sets the user scope, a load sets the project scope only when trusted and removes it otherwise, and every command applies again with the last load's answer (D-PG10-11, D-PG10-23)."
- STATE.md decision: "A scope whose state cannot be read keeps its option variables; an empty option ledger is deleted."
- PG-CORE-03: the MCP half has its carrier. Plan 10-17 writes the references, so do not mark the requirement complete yet.
- `docs/env-vars.md` (plan 10-21): document `PI_CLAUDE_MARKETPLACE_OPTIONS` and `PI_CLAUDE_MARKETPLACE_OPTION_*` from the ledger format above.

## Deviations from Plan

1. **[Rule 3 - Blocking] The ledger core names no scope list.** `test/architecture/scope-order-drift.test.ts` forbids a `["user", "project"]` literal outside `shared/types.ts`. `session-env.ts` may not import that file, so `planOptionLedger` calls a per-scope helper once for `user` and once for `project`. The behavior is unchanged.
2. **The third operation landed in Task 2.** Task 1, step 4 asks for three operations, and Task 2, step 3 asks to add the memory and the apply that uses it. I added `applyAgain` and the last-load memory in Task 2, so its owner cases could be red first.
3. **The uninstall scenario runs its commands in the profile Pi's own session.** `this.pi` is the profile Pi after `pi runs with the scripted model`, so `Given the user has run "/claude:plugin uninstall demo@fixtures --scope user"` runs in the same process as the prompt. I used a `Given`, not a second `When`, so the scenario has one `When` (the feature rules). The same-session rule is also proven by the owner case "D-PG10-11: a command applies the option variables again in the same session, with no load in between".
4. **The load stage reads no `ctx.mode`.** The plan gives the stage a `try` and a debug log. A mode check before it would have changed `MODE_READS_PER_DISCOVER` in every load case. The stage comes after the PATH stage, whose mode check already runs on each load.
5. **The load stage reads `event.cwd` once more,** so `CWD_READS_PER_DISCOVER` went from 4 to 5. The new ordinal `CWD_READ_PLUGIN_OPTIONS` has its own refusal case, "still answers when the plugin option apply fails (NFR-2)".
6. **The factory keeps a project name; it does not remove it.** The factory has no trust answer, so it gives the project scope the `keep` outcome, as "Planner decisions" says.
7. **`.fallowrc.json` is unchanged.** `domain/user-config.ts` is a fallow `entry`, so the new export `OWNED_VARIABLE_PREFIX` needs no `ignoreExports` line. Plan 10-19 still removes that file's entry and exemption.

## Known Stubs

None. Nothing reads the variables until plan 10-17 writes references into adapter entries. That order is planned, and setting the variables first is safe.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-10-25: the load apply takes the load's trust answer. An owner case seeds an unreadable project `state.json`, applies with `false`, and shows that only the user root was read. The `index.test.ts` case shows the trust-read count unchanged (2), and the "Do not trust" scenario shows a ledger with only the user entry. T-10-26: owner cases cover an unknown scope word, a name without the prefix, a name with `-`, an entry with no scope, and an empty entry. A further case shows a name that the same apply sets is not deleted. T-10-27 and T-10-28 stay accepted. Two scenarios pin the bash-tool exposure. T-10-29: every value goes through `serializeLiteral(value, false)`, and owner cases assert `{env:{env:PI_CLAUDE_MARKETPLACE_EMPTY}HOME}` for the default `{env:HOME}`. T-10-SC: no package was installed or changed.

## Self-Check: PASSED

- FOUND: extensions/pi-claude-marketplace/orchestrators/plugin-options.ts (`D-PG10-23` 2, `persistMigration: false` 2), shared/session-env.ts (`PI_CLAUDE_MARKETPLACE_OPTIONS` 3), bridges/mcp/adapter-escape.ts (`ownedOptionVariableName` 2), index.ts (`D-PG10-11` 1, `runForeground` 2), test/index.test.ts (`PI_CLAUDE_MARKETPLACE_OPTIONS` 11), test/orchestrators/plugin-options.test.ts (`D-PG10-11|D-PG10-23` 8)
- FOUND: 81bca81c, 3230acad (ancestors of HEAD)
- The diff from PLAN_BASE adds no `ctx.isProjectTrusted` call in index.ts, `shared/session-env.ts` gains no import, and `git diff PLAN_BASE -- extensions/pi-claude-marketplace/edge` is empty.

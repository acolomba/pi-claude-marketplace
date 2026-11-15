---
phase: 10-plugin-options-variables-and-trust
plan: "17"
subsystem: mcp
status: complete
tags: [user-config, options, mcp, pi-mcp-adapter, process-env]
requires: ["10-02", "10-10", "10-12", "10-13", "10-14", "10-15"]
provides:
  - "the option pass of expandClaudeValue: McpOptionPass, a reference form and a text form (domain/claude-mcp-variables.ts)"
  - "McpFieldEncoder.optionForm (McpOptionForm: none, reference with names, text) in bridges/mcp/substitute.ts"
  - "adapterFieldEncoder(names), which replaces the ADAPTER_FIELD_ENCODER constant"
  - "StampServersInput.encoder (required) in bridges/mcp/adapter-entry.ts"
  - "the adapter stage's option references and environment overlay (adapterSubstitution in bridges/mcp/stage.ts)"
affects: [10-19, 10-20, 10-21]
tech-stack:
  added: []
  patterns: ["one walk, two forms: the encoder states its option form and the walk emits the option segment directly"]
key-files:
  created:
    - features/step_definitions/mcp-server/options.steps.ts
  modified:
    - extensions/pi-claude-marketplace/domain/claude-mcp-variables.ts
    - extensions/pi-claude-marketplace/bridges/mcp/substitute.ts
    - extensions/pi-claude-marketplace/bridges/mcp/builtin-escape.ts
    - extensions/pi-claude-marketplace/bridges/mcp/adapter-entry.ts
    - extensions/pi-claude-marketplace/bridges/mcp/stage.ts
    - features/mcp-server/options.feature
    - test/domain/claude-mcp-variables.test.ts
    - test/bridges/mcp/substitute.test.ts
    - test/bridges/mcp/builtin-escape.test.ts
    - test/bridges/mcp/adapter-entry.test.ts
    - test/bridges/mcp/stage.test.ts
    - test/integration/adapter-expansion-conformance.test.ts
    - test/integration/mcp-variable-expansion.test.ts
    - test/integration/mcp-adapter-entry-conformance.test.ts
decisions:
  - "Under pi-mcp-adapter, ${user_config.KEY} in command, args, env, url, and headers is written as ${PI_CLAUDE_MARKETPLACE_OPTION_<16 hex>}, with no :- fallback, so mcp-adapter.json holds no option value; the stage overlays each option variable, with the escaped text the process holds, on the environment it decides the caFile origin and the OAuth header rule with (D-PG10-11, D-PG10-23)."
  - "The option pass runs after the path variables and before the environment scan; the option becomes its own segment and is never sent through the deny-list or the missing-variable report, and its value is not scanned again (D-PG10-11)."
metrics:
  duration: "~95 min"
  completed: 2026-11-15
actuals:
  tokens: 20600
  tasks: 2
  commits: 2
plan_head_before: df11d1730a86d53f170c2beafa7c67d0496f2beb
plan_head_after: 495b5dac590b2e246db380023e6c2e2378f3c75c
---

# Phase 10 Plan 17: Plugin options in adapter entries Summary

Under pi-mcp-adapter, a plugin MCP server that names `${user_config.KEY}` in `command`, `args`, `env`, `url`, or `headers` now gets a reference to the option's process variable, `${PI_CLAUDE_MARKETPLACE_OPTION_<16 hex>}`. Plan 10-10 sets that variable, so the server receives the option's value. `mcp-adapter.json` holds no option value. The stage decides the `caFile` origin and the OAuth header rule with the option variables in its environment.

## Tasks

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Write a reference to the option's process variable into an adapter entry | 473689c1 | 5 sources, 7 tests, options.feature, options.steps.ts (new) |
| 2 | Cover the other four fields and the stage's decisions | 495b5dac | options.feature, options.steps.ts, 4 tests (no product change) |

## Red then green

- Task 1, scenarios red (before any product edit): `npx cucumber-js --profile adapter --name "holds a reference and no option value|reaches an argument of a stdio" features/mcp-server/options.feature` gave 2 scenarios (2 failed), 25 steps (23 passed, 2 failed), exit 1.
  - The reference-only entry failed at the file-text step. The argument read `"${user_config.tool}"`, where `"${PI_CLAUDE_MARKETPLACE_OPTION_8fd4b1ce5a5f54e0}"` was expected.
  - The argument scenario failed at `Then the model receives these calls:` with `mcp returned: no tool mcp__plugin_demo_picker__reverse\nserver plugin_demo_picker_ tools: mcp__plugin_demo_picker__`. The stub got the literal reference, so its tool had an empty name.
- Task 1, owner red: I wrote the owner cases after the product edit. To get the red run, I saved the five sources, restored them from HEAD, and ran the six owner and conformance files. Then I copied the sources back, and `cmp` showed each one unchanged. Result: 244 tests, 15 failed. `substitute.test.ts`, `adapter-entry.test.ts`, and the conformance file failed to load (`does not provide an export named 'adapterFieldEncoder'`). These failed too: the 10 option-pass cases of `expandClaudeValue`, "D-PG10-11: the built-in encoder runs no option pass", and "D-PG10-11: a staged entry whose argument names an option holds a reference and no option value".
- Task 1, green: `options.feature` under adapter gave 6 scenarios (6 passed), 73 steps. Under builtin, `options` + `builtin-options` + `builtin-values` gave 11 scenarios (11 passed), 130 steps, so the built-in config did not change. The ten `<verify>` unit and integration files, plus `mcp-adapter-entry-conformance`, gave 585 pass and 0 fail. Direct coverage of all five sources exited 0. `typecheck`, `check:features`, ESLint on the 14 files, Prettier, and `npm run fallow` exited 0. The stage's callers (`install-outcome`, `update-swap`, `mcp-migration`, and every `test/bridges/mcp/*.test.ts`) gave 1284 pass. The hook passed `check:commit`. The tracer gate was green.
- Task 2, scenarios: both new scenarios passed on the Task 1 code. For the red run, I put the five sources back to `df11d173` (PLAN_BASE), ran the two scenarios, and then restored the sources with `git checkout`. Result: 2 scenarios (2 failed), 30 steps (20 passed, 8 skipped, 2 failed). The stdio scenario failed with `the adapter mcp implementation did not finish listing the tools of demo/tagged: {"requests":[],"running":[]}`: the command was the literal reference, so no server started. The remote scenario failed with `pi-mcp-adapter did not list the tools of web: []`.
- Task 2, owner red: the new `adapter-entry`, `stage`, conformance, and `mcp-variable-expansion` cases passed on the Task 1 code. `resolvedUrl` and `isCleanHeaderValue` already read the overlay, so `adapter-entry.ts` did not change. To show that the overlay matters, I made the stage pass `env: input.env` with no overlay, in the working tree only. Then 2 of the 3 D-PG10-23 stage cases failed: the `caFile` case read `caFile: undefined` with a `ca-file-removed` / `url-unresolved` notice, and the header case lost `auth`. `git diff --quiet HEAD` confirmed the restore.
- Task 2, green: under adapter, `options` + `configuration` + `lifecycle` gave 44 scenarios (44 passed), 604 steps. `options.feature` has 8 scenarios. The six `<verify>` test files gave 437 pass and 0 fail. Direct coverage of the three sources, `typecheck`, `check:features`, ESLint, Prettier, and `npm run fallow` all exited 0. The hook passed `check:commit`.

## Measured mcp-adapter.json entry

This is from the `@adapter-only` scenario. The scope is user, the marketplace `fixtures`, the plugin `demo`, and the option `tool`, whose default is `reverse`. The name is `ownedOptionVariableName({ scope: "user", marketplace: "fixtures", plugin: "demo", key: "tool" })`.

```json
"plugin_demo_keyed_": {
  "command": "pi-features-absent-mcp-server",
  "args": ["--tool", "${PI_CLAUDE_MARKETPLACE_OPTION_8fd4b1ce5a5f54e0}"],
  "env": { "CLAUDE_PLUGIN_ROOT": "...", "CLAUDE_PLUGIN_DATA": "..." },
  "directTools": "search", "toolPrefix": "mcp", "requestTimeoutMs": 1800000, "lifecycle": "lazy-keep-alive",
  "_piClaudeMarketplace": { "plugin": "demo", "marketplace": "fixtures", "defaultFields": { ... } }
}
```

The scenario pins the whole file. It holds no `reverse`, and the marker gained no member.

## Fields the scenarios prove (all `@adapter-only`, PG-CORE-03)

- `args`: "A plugin option reaches an argument of a stdio server (PG-CORE-03)". The option is the stub's tool name, and the model calls `mcp__plugin_demo_picker__reverse`.
- `command` and `env`: "A plugin option reaches the command and the environment of a stdio server (PG-CORE-03)". The stub's command is `${user_config.node}`, whose default is the Node executable, and its `STUB_TAG` is `${user_config.tag}`. The answer is `opted:echo:ping`.
- `url` and `headers`: "A plugin option reaches the url and a header of a remote server (PG-CORE-03)". The HTTP stand-in's address is the default of `url`. Every request carries `x-team: core`.
- The file itself: "The entry of a server that names a plugin option holds a reference and no option value (PG-CORE-03, D-PG10-11)".

## Assumption A7

A7 holds: the stdio stub can take `command` from an option whose default is the Node path. The new step "the published plugin {string} of the marketplace {string} has this manifest, with the default of the option {string} set to the node executable that runs stub mcp servers:" parses the doc string and sets `userConfig[key].default` to `process.execPath`. It then writes `.claude-plugin/plugin.json` through `publishStubServersFile` in `features/lib/mcp-server-files.ts`. The server comes from the existing step "has the stub mcp server {string} with these fields:" in `builtin-values.steps.ts`, whose `command` field replaces the stub's own. A sibling step sets a default to the address of a loopback HTTP server that it starts, through `McpHttpServer.start`.

## Lines for later plans

- Domain: `expandClaudeValue(raw, fieldClass, env, builtins, options: McpOptionPass | undefined)`. The fifth argument is required, and `undefined` means no option pass. `McpOptionPass` is `{ form: "reference"; names: ReadonlyMap<key, ownedName> }` or `{ form: "text"; mcpValues: ReadonlyMap<key, value> }`. A key the form lacks keeps its `${user_config.KEY}` text. `scanClaudeServerVariables` passes `undefined`.
- Encoder form member: `McpFieldEncoder.optionForm: McpOptionForm`, which is `{ kind: "none" }`, `{ kind: "reference"; names }`, or `{ kind: "text" }`. The text form is `{ kind: "text" }`, and the walk reads the values from `ctx.options.mcpValues`. A context whose `options` is `undefined` gets no pass under any form (D-PG10-21).
- `BUILTIN_FIELD_ENCODER.optionForm` is `{ kind: "none" }`. Plan 10-19 sets it to `{ kind: "text" }` and changes the case "D-PG10-11: the built-in encoder runs no option pass" in `test/bridges/mcp/builtin-escape.test.ts`.
- Adapter encoder: `adapterFieldEncoder(names: ReadonlyMap<string, string>)` replaces the `ADAPTER_FIELD_ENCODER` constant. Tests that need the old encoder use `adapterFieldEncoder(new Map())` and keep a local constant of that name.
- `StampServersInput.encoder: McpFieldEncoder` is required. The stage spreads `adapterSubstitution(input)`, which gives `{ substitution, encoder }`. That function takes the names and escaped values from `ownedOptionVariables` and overlays the escaped values on `input.env`.
- The substitute case of plan 10-14, "D-PG10-21: the options on the context leave the adapter entry as the context without them", is gone. In its place are "D-PG10-11: the adapter encoder writes each option as a reference to its process variable" and "D-PG10-21: a plugin that declares no options keeps an option reference as written", plus the text-form and none-form cases.
- Known gap: an option reference inside a `${NAME:-default}` default, such as `${FOO:-${user_config.x}}`, is split out of the default. The `${FOO:-` text and the closing `}` stay literal. Claude Code fills the option first and then scans `${FOO:-value}`. Under the adapter the value is not in the entry, so the scan cannot run. The text form does the same.

## Parent-owned lines requested

- STATE.md decision: "Under pi-mcp-adapter, ${user_config.KEY} in command, args, env, url, and headers is written as ${PI_CLAUDE_MARKETPLACE_OPTION_<16 hex>}, with no :- fallback, so mcp-adapter.json holds no option value; the stage overlays each option variable, with the escaped text the process holds, on the environment it decides the caFile origin and the OAuth header rule with (D-PG10-11, D-PG10-23)."
- STATE.md decision: "The option pass runs after the path variables and before the environment scan; the option becomes its own segment and is never sent through the deny-list or the missing-variable report, and its value is not scanned again (D-PG10-11)."
- PG-CORE-03: the MCP fill under the adapter is done. The built-in fill is plan 10-19, so do not mark the requirement complete yet.
- Plan 10-21 / CHANGELOG: the first restage of a plugin whose entry held a literal `${user_config.KEY}` changes the entry's bytes. pi-mcp-adapter asks for project approval again once (10-RESEARCH.md, "pi-mcp-adapter project approval").

## Deviations from Plan

1. **[Rule 3 - Blocking] `test/integration/mcp-adapter-entry-conformance.test.ts` gained `encoder: adapterFieldEncoder(new Map())`.** It is outside the plan's file list. It calls `stampServers` inline, and the new required member failed the type check there. The change is two lines in the Task 1 commit.
2. **The adapter encoder is a factory, not a constant.** The plan says that `stampServers` gets its encoder from the stage. A constant that only tests used would have become an unused export in fallow's production graph, so `ADAPTER_FIELD_ENCODER` became `adapterFieldEncoder(names)`.
3. **Task 2 made no product change, so its commit is `test(mcp): ...`.** The plan's example title was `feat`. The owner cases showed that `resolvedUrl` and `isCleanHeaderValue` read the overlay, as step 3 allows. The red runs for Task 2 were taken against PLAN_BASE sources, and the overlay proof was taken by removing the overlay in the working tree.
4. **The argument scenario's server is `picker`, not `stub`.** `publishStubServersFile` reads `{"mcpServers": {"stub": ...}}` as a stub marker (the layout rule says so), so a server named `stub` cannot go through it.
5. **The Task 1 owner red was taken by restoring the sources to HEAD,** as in plans 10-12 to 10-15. The scenario red runs came before any product edit.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-10-33: the reference form emits a `ref` with no fallback. The stage case asserts that the prepared result holds no default, and the integration install case asserts that the file and the notifications hold no `sentinel` default. The scenario pins the whole file. T-10-34: the conformance rows for a default of `!echo pwned` in `env` and in `headers` assert that the written value does not start with `!`, and that the adapter's chain outputs the text. T-10-36: the option segment never goes through `segmentFor`. Owner rows cover a deny-listed key name, a value that holds `${HOME}`, and one that holds `{env:HOME}`, and conformance rows run both through the adapter with `HOME=/leaked`. T-10-37: the stage overlays the escaped values. Owner cases cover a url host, a whole url, an origin change, and a header, and removing the overlay fails two stage cases. T-10-SC: no package was installed or changed.

## Self-Check: PASSED

- FOUND: 473689c1, 495b5dac (ancestors of HEAD)
- FOUND: `D-PG10-11` in bridges/mcp/substitute.ts; `adapter-escape` and `D-PG10-23` in bridges/mcp/stage.ts; `PI_CLAUDE_MARKETPLACE_OPTION_` in features/mcp-server/options.feature; 8 `  Scenario` lines in options.feature; `D-PG10-11` in test/integration/adapter-expansion-conformance.test.ts
- FOUND: orchestrators/plugin-options.ts and bridges/mcp/stage.ts both call `ownedOptionVariables`

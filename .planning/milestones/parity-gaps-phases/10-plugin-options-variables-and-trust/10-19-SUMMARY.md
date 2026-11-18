---
phase: 10-plugin-options-variables-and-trust
plan: "19"
subsystem: mcp
status: complete
tags: [user-config, options, mcp, builtin-mcp, registration]
requires: ["10-02", "10-14", "10-15", "10-17"]
provides:
  - "BUILTIN_FIELD_ENCODER.optionForm is { kind: \"text\" }: Pi's built-in MCP gets each option's value, escaped for Pi in env and headers (D-PG10-12)"
  - "McpOptionForm is reference | text; the none form is gone"
  - "OPTION_FIELD_CASES and OptionFieldCase in test/bridges/mcp/expansion-cases.ts, run by both conformance tests"
  - "the step \"pi holds these whole mcp server configs:\" in features/step_definitions/mcp-server/builtin-options.steps.ts"
affects: [10-20, 10-21]
tech-stack:
  added: []
  patterns: ["one walk, two forms: the built-in encoder takes the text form and its own escape covers the option value"]
key-files:
  created:
    - features/step_definitions/mcp-server/builtin-options.steps.ts
  modified:
    - extensions/pi-claude-marketplace/bridges/mcp/builtin-escape.ts
    - extensions/pi-claude-marketplace/bridges/mcp/substitute.ts
    - extensions/pi-claude-marketplace/bridges/mcp/builtin-entry.ts
    - extensions/pi-claude-marketplace/orchestrators/mcp/builtin-registration-step.ts
    - .fallowrc.json
    - features/mcp-server/builtin-options.feature
    - features/mcp-server/options.feature
    - test/bridges/mcp/builtin-escape.test.ts
    - test/bridges/mcp/builtin-entry.test.ts
    - test/bridges/mcp/substitute.test.ts
    - test/bridges/mcp/expansion-cases.ts
    - test/orchestrators/mcp/builtin-registration-step.test.ts
    - test/integration/mcp-builtin-encoding-conformance.test.ts
    - test/integration/adapter-expansion-conformance.test.ts
decisions:
  - "Under Pi's built-in MCP, ${user_config.KEY} in command, args, env, url, and headers is filled with the option's MCP value when the registration step builds the config at each session; the value is held in Pi's in-memory registry only, and env and headers values get Pi's escape ($ doubled, a leading ! behind a $) (D-PG10-12, D-PG10-21)."
metrics:
  duration: "~70 min"
  completed: 2026-11-15
actuals:
  tokens: 10500
  tasks: 2
  commits: 2
plan_head_before: 61a99acdad60a3e01b2db5c2bd07bb4cd809e964
plan_head_after: f0d596892de6dd82c26adb1cdcee91f3854bcb7c
---

# Phase 10 Plan 19: Plugin options under Pi's built-in MCP Summary

Under Pi's built-in MCP, a plugin MCP server that names `${user_config.KEY}` in `command`, `args`, `env`, `url`, or `headers` now gets the option's value. The registration step fills it from the record's options at every session start and hands the config to Pi's in-memory registry. Nothing is written to a file. `BUILTIN_FIELD_ENCODER` takes the text form of the option pass, so its own escape covers the value: a default that starts with `!` or holds `$HOME` runs no command and reads no variable in Pi. Pi's home check in `builtin-entry.ts` now sees the filled command and arguments.

## Tasks

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Fill plugin options in memory under Pi's built-in MCP | ea5cd220 | 4 sources, .fallowrc.json, 7 tests, 2 features, builtin-options.steps.ts (new) |
| 2 | Guard that a home-path option keeps its server out of Pi's built-in MCP | f0d59689 | builtin-options.feature |

## Red then green

- Task 1, scenarios red (before any product edit): `npm run test:cucumber:profile -- --profile builtin features/mcp-server/options.feature features/mcp-server/builtin-options.feature` gave 10 scenarios (6 passed, 4 failed), 125 steps (113 passed, 8 skipped, 4 failed), exit 1.
  - The registry scenario failed at `Then pi holds these whole mcp server configs:`. The config held `"args":["--tool","${user_config.tool}"]` and `"TOOL":"$${user_config.tool}"`.
  - The `@mcp` argument scenario failed at `Then pi offers these plugin mcp tools:`. Pi offered `mcp__plugin_demo_picker____user_config_tool_`, where `mcp__plugin_demo_picker__reverse` was expected.
  - The command and environment twin failed at its listing wait: `the builtin mcp implementation did not finish listing the tools of demo/tagged: {"requests":[],"running":[]}`. The command was the literal reference, so no server started.
  - The url and header twin failed at its listing wait: `pi's built-in mcp did not list the tools of web: []`.
- Task 1, owner red (tests written before the product edit): the owner files plus both conformance files gave 233 tests, 22 failed. The failures were the encoder form case, the five new `builtin-entry` cases (the stdio fill, the remote fill, the escape, the D-PG10-21 empty string, the `~/` that options resolve to), the two registration-step cases, and the 14 D-PG10-12 conformance rows. The adapter conformance rows, the two new `$HOME` rows among them, passed.
- Task 1, green: the eight `<verify>` unit and integration files gave 540 tests, 540 pass. The callers (`bridges/mcp/index`, `session-materialize`, `test/index.test.ts`, `mcp-adapter-entry-conformance`, `mcp-variable-expansion`) gave 85 pass. Direct coverage of the four sources exited 0. `typecheck`, `npm run fallow`, `check:features`, ESLint on the 12 `.ts` files, and Prettier exited 0. Under builtin, `options` + `builtin-options` + `builtin-values` gave 15 scenarios (15 passed), 185 steps. Under adapter, `options` + `configuration` gave 20 scenarios (20 passed), 257 steps. The hook passed `check:commit`. The tracer gate was green.
- Task 2, guard: it passed on the Task 1 code.
- Task 2, guard proof (working tree only, `npx cucumber-js --profile builtin --name "home path" features/mcp-server/builtin-options.feature`):
  1. Verdict and home check both off in `builtinServerConfig`: 1 scenario (1 failed), 12 steps (11 passed, 1 failed). The registry also held `plugin_demo_homed` with `{"command":"~/bin/tool","env":{...},"timeout":1800,"exposure":"deferred"}`. `git checkout` restored the file.
  2. Verdict off, home check on: 1 scenario (1 passed), 12 steps. Pi's home check on the filled command keeps the server out by itself. `git checkout` restored the file.
  3. Both on (HEAD): 4 scenarios (4 passed), 47 steps under `npm run test:cucumber:profile -- --profile builtin features/mcp-server/builtin-options.feature`.
  - `npm run check:features && git diff --quiet HEAD -- extensions/pi-claude-marketplace` exited 0. The hook passed `check:commit`.

## Fields the scenarios prove

- `args`, both profiles: "A plugin option reaches an argument of a stdio server (PG-CORE-03)", now `@mcp`. The option is the stub's tool name, and Pi offers `mcp__plugin_demo_picker__reverse` under each implementation.
- `command` and `env`: under adapter, "A plugin option reaches the command and the environment of a stdio server (PG-CORE-03)" (`@adapter-only`). Under builtin, its twin "... of a stdio server under Pi's built-in MCP (PG-CORE-03, D-PG10-12)" (`@builtin-only`). Both answer `opted:echo:ping`.
- `url` and `headers`: under adapter, "A plugin option reaches the url and a header of a remote server (PG-CORE-03)" (`@adapter-only`). Under builtin, its twin "... of a remote server under Pi's built-in MCP (PG-CORE-03, D-PG10-12)" (`@builtin-only`). Every request carries `x-team: core`.
- The registry value: "Pi's built-in MCP holds a plugin option's value in the server's config (PG-CORE-03, D-PG10-12)", with the option in `args` and `env`.
- The home-path guard: "Pi's built-in MCP does not register a server whose command a plugin option would turn into a home path (D-PG10-11)".

## Lines for later plans

- Measured registry config (builtin profile, user scope, marketplace `fixtures`, plugin `demo`, option `tool` with the default `reverse`):

  ```json
  {"name": "plugin_demo_keyed", "config": {"command":"pi-features-absent-mcp-server","args":["--tool","reverse"],"env":{"CLAUDE_PLUGIN_ROOT":"{home}/marketplaces/fixtures/plugins/demo","CLAUDE_PLUGIN_DATA":"{agent dir}/pi-claude-marketplace/data/fixtures/demo","TOOL":"reverse"},"timeout":1800,"exposure":"deferred"}}
  ```

- Escape, from the owner case: a default of `!echo $HOME` is `!echo $HOME` in `args` and `$!echo $$HOME` in an `env` or `headers` value. Pi's resolver turns that back into `!echo $HOME` and runs nothing.
- Encoder form: `McpOptionForm` is `{ kind: "reference"; names }` or `{ kind: "text" }`. `optionPass` returns `undefined` only when `ctx.options` is `undefined` (D-PG10-21).
- Shared table: `OPTION_FIELD_CASES` (14 rows, `OptionFieldCase`) lives in `test/bridges/mcp/expansion-cases.ts`. The adapter conformance test and the built-in conformance test both run every row. The built-in rows are titled `D-PG10-12: <row> is written as Claude Code's value` (`command`, `args`, `url`) and `D-PG10-12: <row> comes out of Pi's resolver as Claude Code's value` (`env`, `headers`, with `HOME=/leaked`).
- `.fallowrc.json` names `domain/user-config.ts` nowhere. `npm run fallow` reported no unused export, so no `export` keyword was removed.
- The registration skip log is unchanged. A server that the verdict blocks with `home-path` logs `it names plugin options (home-path): <keys>`. A server that only Pi's home check refuses, such as `${user_config.empty}${user_config.tool}` with `tool` = `~/bin/tool`, logs `Pi would not run it as Claude Code does`.
- Plan 10-21: Pi's built-in MCP now holds option values in its session registry. No file holds them.

## Parent-owned lines requested

- STATE.md decision: "Under Pi's built-in MCP, ${user_config.KEY} in command, args, env, url, and headers is filled with the option's MCP value when the registration step builds the config at each session; the value is held in Pi's in-memory registry only, and env and headers values get Pi's escape ($ doubled, a leading ! behind a $) (D-PG10-12, D-PG10-21)."
- PG-CORE-03: the MCP fill is done under both implementations (adapter: 10-17, built-in: this plan). Mark it complete only if no later plan of the phase still owns part of it (10-20 and 10-21 are still open).

## Deviations from Plan

1. **[Rule 3 - Blocking] `test/integration/adapter-expansion-conformance.test.ts` changed.** It is outside the plan's file list. `OPTION_FIELD_CASES` moved from it into `test/bridges/mcp/expansion-cases.ts`, so both conformance tests share one table and fallow's dupes gate sees no copied table. The adapter test now imports the table and the type. The table gained two `$HOME` rows (env, headers) for T-10-49, and the adapter runs them green too.
2. **Two field scenarios stay `@adapter-only` and gained a `@builtin-only` twin, not an `@mcp` tag.** Under each implementation the model's calls differ: the adapter's `mcp` proxy against Pi's `tool_search` and the tool. The cucumber rules let only the hook scenarios build a script for each profile, and they have no listing wait for an HTTP server that does not name the implementation. So the command and environment scenario and the url and header scenario are pairs, as the plan allows where the result differs. The argument scenario became `@mcp`: it now reads the tool list, which is the same under both implementations, and no longer calls the tool.
3. **A new step, "pi holds these whole mcp server configs:".** The existing probe step leaves out each stdio server's command and arguments, so it could not show the filled argument. The new step prints the whole config. Both scenarios that use it name an absent command, so no run path shows.
4. **The guard proof ran `npx cucumber-js --profile builtin --name "home path"`** in place of the npm script, to run only the guard. Each proof edit sat in the working tree only. `git checkout` restored the file each time, and `git diff --quiet HEAD -- extensions/pi-claude-marketplace` exited 0.
5. **The table columns of `builtin-options.feature` were aligned** before each commit. The feature ran green again after that.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-10-49: the option value goes through the built-in encoder's own escape for a secret field. The conformance rows run a default of `!echo pwned` and one of `$HOME` through Pi's own `resolveConfigValueOrThrow` with `HOME=/leaked`. They assert no variable name, no command, and the text as written. The owner case covers `!echo $HOME` in `env` and `headers` and in `args`. The value is a text segment that the walk does not scan again (10-17). The prohibition holds: the registration hands the config to `pi.registerMcpServer` only, and no file is written (`bridges/mcp/builtin-entry.ts` and `builtin-registration-step.ts` write nothing). T-10-35 under the built-in path: the guard shows both lines, the verdict and Pi's home check, each able to keep the server out. T-10-SC: no package was installed or changed.

## Self-Check: PASSED

- FOUND: ea5cd220, f0d59689 (ancestors of HEAD)
- FOUND: `D-PG10-12` in bridges/mcp/builtin-escape.ts (1), orchestrators/mcp/builtin-registration-step.ts (1), features/mcp-server/builtin-options.feature (2), test/integration/mcp-builtin-encoding-conformance.test.ts (4)
- FOUND: `D-PG10-11` in features/mcp-server/builtin-options.feature (1); 4 `  Scenario` lines there
- FOUND: features/step_definitions/mcp-server/builtin-options.steps.ts
- FOUND: `.fallowrc.json` names `user-config` nowhere

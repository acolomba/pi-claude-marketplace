---
phase: 10-plugin-options-variables-and-trust
plan: "15"
subsystem: mcp
status: complete
tags: [user-config, options, mcp, notices, home-path, pi-mcp-adapter]
requires: ["10-02", "10-12"]
provides:
  - "the home-path reason of mcpOptionBlock (McpOptionBlockReason = \"unset\" | \"home-path\") in domain/claude-mcp-variables.ts"
  - "the second member of the option-blocked notice's reason set in notification-types.ts, notification-wire.ts, notification-mcp.ts, the catalog, docs/json-output.md, and the wire schema"
  - "two home-path scenarios in features/mcp-server/options.feature"
affects: [10-17, 10-19, 10-21]
tech-stack:
  added: []
  patterns: ["one domain verdict holds every reason a server is left out; its callers copy the reason and do not branch on it"]
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/domain/claude-mcp-variables.ts
    - extensions/pi-claude-marketplace/shared/notification-types.ts
    - extensions/pi-claude-marketplace/shared/notification-mcp.ts
    - extensions/pi-claude-marketplace/shared/notification-wire.ts
    - schema/claude-plugin.schema.json
    - docs/output-catalog.md
    - docs/json-output.md
    - test/domain/claude-mcp-variables.test.ts
    - test/shared/notification-mcp.test.ts
    - test/shared/notification-wire.test.ts
    - test/architecture/mcp-config-notices.test.ts
    - features/mcp-server/options.feature
decisions:
  - "A stdio server whose command, or an args element, starts with ${user_config.KEY} for an option whose MCP value pi-mcp-adapter 7.0.1 would expand to a home path is left out and reported with the option-blocked reason home-path; the same option later in a field, or in env, url, or headers, blocks nothing; a server that also names an option with no value is reported as unset (D-PG10-11, D-PG10-21)."
metrics:
  duration: "~40 min"
  completed: 2026-11-15
actuals:
  tokens: 9000
  tasks: 2
  commits: 2
plan_head_before: a89423d8cb67ec5740ba22560dd1bece97118a63
plan_head_after: 4780fdd5190916662c7849c229309453b7aa0f0d
---

# Phase 10 Plan 15: Leave out a server whose command or argument starts with a home-path option Summary

`mcpOptionBlock` has a second reason, `home-path`. A stdio server is now left out when its `command`, or an `args` element, starts with `${user_config.KEY}` and that option's MCP value is one that pi-mcp-adapter 7.0.1 expands to a path under the user's home. Claude Code passes the value as written, so the server would otherwise run a program the plugin does not name (D-PG10-11). The `option-blocked` notice carries the new reason. The stage, the built-in entry, and the registration step did not change. They already copy the verdict.

## Tasks

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Leave out a server whose command starts with an option that holds a home path, and say so | 822d4a07 | verdict, 3 notice homes, wire schema, 2 docs, 4 tests, options.feature |
| 2 | Leave out a server whose argument starts with such an option, and no other | 4780fdd5 | verdict, its test, options.feature |

## Red then green

- Task 1, scenario red (before any product edit): `npx cucumber-js --profile adapter --name "A server whose command a plugin option would turn into a home path" features/mcp-server/options.feature` failed at `Then the command reports these results:`. Only the `cascade` row came back, with no `notices` column and no `mcp-config-notices` row. Result: 1 scenario (1 failed), 12 steps (9 passed, 2 skipped, 1 failed), exit 1.
- Task 1, owner red (tests written before the product edit): `claude-mcp-variables.test.ts` failed 2 cases, "D-PG10-11: a command that starts with an option holding a path under home blocks the server" and "... holding the home marker alone blocks the server". The run of notification-mcp, notification-wire, and mcp-config-notices gave 158 tests and 4 failed: the home-path line, the wire accept case, and the `mcp-option-blocked-home-path` catalog byte and JSON cases.
- Task 1, green: the scenario passed (1 scenario, 12 steps). The six `<verify>` unit files gave 574 pass, 0 fail. `npm run test:architecture` exited 0, after `npm run schema:generate` (see deviation 1). Direct coverage of the three sources exited 0. `typecheck` and `check:features` exited 0. `git diff --quiet HEAD -- .../bridges .../orchestrators` exited 0. ESLint on the eight files exited 0. The hook passed `check:commit`. The tracer gate was green.
- Task 2, scenario red (before the product edit): the `--name "A server whose argument starts with a plugin option that holds a home path"` run failed at the same `Then`, with no `mcp-config-notices` row. Result: 1 scenario (1 failed), 12 steps (9 passed, 2 skipped, 1 failed), exit 1.
- Task 2, owner red: 96 tests, 2 failed: "D-PG10-11: an args element that starts with a home-path option blocks the server" and "D-PG10-11: lists each home-path key once, command first and then the args in order". The six "blocks nothing" cases (the middle of an argument, `env`, `url`, `headers`, a non-string element, `args` that is not an array) passed on the Task 1 code. They are guards.
- Task 2, green: `options.feature` gave 4 scenarios (4 passed), 47 steps under adapter and the same under builtin. The verdict, stage, builtin-entry, and registration-step tests gave 268 pass, 0 fail. Direct coverage of the verdict, `typecheck`, and `check:features` exited 0. Regression runs: `builtin-options.feature` under builtin (2 passed), and 5 MCP integration files (adapter-expansion, adapter-entry, builtin-encoding conformance, home-path-partial, variable-expansion), 139 pass. The hook passed `check:commit`.

## Lines for later plans

- Verdict: `McpOptionBlockReason = "unset" | "home-path"`. `mcpOptionBlock` computes the unset keys over the five fields first and returns `{ reason: "unset", keys }` when there are any. Only then does it compute the home-path keys and return `{ reason: "home-path", keys }`. Each key comes once, `command` first and then the `args` elements in order.
- Home rule, as the verdict applies it: `ScannedFields.homeExpanded` holds the stdio `command` string and each string `args` element, and is `[]` for a remote server. A field counts when it matches `/^\$\{user_config\.([^}]+)\}/` and the key's MCP value satisfies `value === "~" || value.startsWith("~/") || value.startsWith(`~${path.sep}`)`. This is pi-mcp-adapter 7.0.1's `expandHomePath`. The value is read alone, so `${user_config.KEY}foo` with the value `~` blocks too, although `~foo` would not be expanded. That case is conservative.
- Plan 10-17 and plan 10-19: no fill meets a home-path start, because the verdict runs first at the stage and in `builtinServerConfig`. Pi's own `startsWithHome` in `builtin-entry.ts` is unchanged, and it is the second check after the built-in fill.
- Notice: `McpOptionBlockedReason = "unset" | "home-path"`, with the wire member `reason: Type.Union([Type.Literal("unset"), Type.Literal("home-path")])`. The cause is `OPTION_BLOCKED_CAUSES["home-path"]`: `plugin options at the start of its command or arguments hold a home path`. Rendered (catalog state `mcp-option-blocked-home-path`):

  ```text
  MCP server left out.

  Server "srv" from hello was left out of the user-scope mcp-adapter.json, because plugin options at the start of its command or arguments hold a home path: tool.
  ```

- Wire form, `docs/json-output.md`: `McpOptionBlockedReason`: `unset`, `home-path`.
- Scenario titles (both `@mcp`, in `features/mcp-server/options.feature`). Each uses the option `tool` with the default `~/bin/tool` beside a plain stub server:
  - "A server whose command a plugin option would turn into a home path is left out, and the install says so (D-PG10-11)"
  - "A server whose argument starts with a plugin option that holds a home path is left out, and the install says so (D-PG10-11)"
- No new step was needed, so `features/step_definitions/mcp-server/options.steps.ts` was not created.

## Parent-owned lines requested

- STATE.md decision: "A stdio server whose command, or an args element, starts with ${user_config.KEY} for an option whose MCP value pi-mcp-adapter 7.0.1 would expand to a home path is left out and reported with the option-blocked reason home-path; the same option later in a field, or in env, url, or headers, blocks nothing; a server that also names an option with no value is reported as unset (D-PG10-11, D-PG10-21)."
- PG-CORE-03: every block is now in place before the fill (plans 10-17 and 10-19). Do not mark the requirement complete yet.

## Deviations from Plan

1. **[Rule 3 - Blocking] `schema/claude-plugin.schema.json` was regenerated.** It is outside the plan's file list. `npm run schema:generate` turned the `option-blocked` reason `const` into an enum of two (12 lines). It is in the Task 1 commit, as in plan 10-12.
2. **The catalog heading now reads `MCP server left out (D-PG10-21, D-PG10-11)`.** Its paragraph gained the reason mapping and the home rule. No test reads the heading.
3. **The home rule reads the option's value alone.** See "Lines for later plans". A value of `~` followed by text that is not a separator blocks, although the adapter would not expand the result. A server that names an empty option and then a home-path option (`${user_config.empty}${user_config.tool}`) is not blocked, because the rule reads only a reference at the very start. The plan names the start, so neither case was widened.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-10-35: the verdict blocks a home-path start in `command` and in each `args` element before any value is filled. Under the adapter the stage leaves the server out and reports it, and under built-in `builtinServerConfig` gives it no config. Owner cases cover `command`, each argument, and the start against the middle. Two scenarios show the file and the notice under both profiles. T-10-47: the rule reads only the start of `command` and of each `args` string. Owner cases assert that the middle of an argument, an `env` value, `url`, and a `headers` value block nothing. T-10-SC: no package was installed or changed.

## Self-Check: PASSED

- FOUND: 822d4a07, 4780fdd5 (ancestors of HEAD)
- FOUND: `D-PG10-11` 3 times in domain/claude-mcp-variables.ts and 15 times in its test
- FOUND: 2 `home path` lines and 4 `  Scenario` lines in features/mcp-server/options.feature
- FOUND: `"home-path"` at the tail of the reason set in notification-types.ts and notification-wire.ts

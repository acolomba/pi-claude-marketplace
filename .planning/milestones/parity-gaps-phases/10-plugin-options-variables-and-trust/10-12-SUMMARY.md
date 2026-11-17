---
phase: 10-plugin-options-variables-and-trust
plan: "12"
subsystem: mcp
status: complete
tags: [user-config, options, mcp, notices, pi-mcp-adapter]
requires: ["10-02", "10-06", "10-09"]
provides:
  - "mcpOptionBlock(server, options) and McpOptionBlock / McpOptionBlockReason in domain/claude-mcp-variables.ts"
  - "the required member options: ResolvedOptions | undefined on StageMcpInput, fed by the install ledger"
  - "the option-blocked MCP config notice in every closed-set home, the catalog, docs/json-output.md, and the wire schema"
  - "features/mcp-server/options.feature (Feature: MCP server options)"
affects: [10-13, 10-14, 10-15, 10-17, 10-21]
tech-stack:
  added: []
  patterns: ["the stage partitions its servers with a domain verdict before it keys, collides, or records them", "a per-server notice with names and a closed reason, its cause text keyed by reason"]
key-files:
  created:
    - features/mcp-server/options.feature
  modified:
    - extensions/pi-claude-marketplace/domain/claude-mcp-variables.ts
    - extensions/pi-claude-marketplace/bridges/mcp/types.ts
    - extensions/pi-claude-marketplace/bridges/mcp/stage.ts
    - extensions/pi-claude-marketplace/shared/notification-types.ts
    - extensions/pi-claude-marketplace/shared/notification-mcp.ts
    - extensions/pi-claude-marketplace/shared/notification-wire.ts
    - extensions/pi-claude-marketplace/shared/notification-resolve.ts
    - extensions/pi-claude-marketplace/shared/notification-json.ts
    - extensions/pi-claude-marketplace/shared/notification-dispatch.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/mcp-migration.ts
    - schema/claude-plugin.schema.json
    - docs/output-catalog.md
    - docs/json-output.md
    - test/domain/claude-mcp-variables.test.ts
    - test/bridges/mcp/stage.test.ts
    - test/bridges/mcp/types.test.ts
    - test/shared/notification-mcp.test.ts
    - test/shared/notification-wire.test.ts
    - test/shared/notification-resolve.test.ts
    - test/shared/notification-json.test.ts
    - test/architecture/mcp-config-notices.test.ts
    - test/architecture/integration-materialization-gate.test.ts
    - test/orchestrators/plugin/install-outcome.test.ts
decisions:
  - "An MCP server whose command, args, env, url, or headers name ${user_config.KEY} for a key the MCP value map lacks is left out of mcp-adapter.json and the record, and the command reports it with an option-blocked notice (reason unset) that names the keys; a plugin with no userConfig blocks nothing (D-PG10-08, D-PG10-21)."
  - "The option-blocked notice names the server by its declared name, because the file holds no entry for it."
metrics:
  duration: "~70 min"
  completed: 2026-11-15
actuals:
  tokens: 21956
  tasks: 2
  commits: 2
plan_head_before: e5cba79c02a7b327aa30126d3574ceb06490c99b
plan_head_after: cb702d57
---

# Phase 10 Plan 12: Leave out an MCP server that names an unset plugin option Summary

On the install path (install, enable, import, the install cascade), a plugin MCP server that names `${user_config.KEY}` for an option with no value is no longer written to `mcp-adapter.json`. It is not in the stage's recorded servers, and it takes no part in the collision check. The plugin's other servers are written as usual. The command reports the server in one `option-blocked` warning. The verdict comes from one domain function, `mcpOptionBlock`. Update, reinstall, and the load-time move pass `options: undefined` until plan 10-13.

## Tasks

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Leave a server that names an unset plugin option out of mcp-adapter.json, and say so | cdc8141c | 14 sources and docs, the wire schema, 10 tests, options.feature |
| 2 | Guard that a plugin with no options keeps an option reference in its server as written | cb702d57 | features/mcp-server/options.feature |

## Red then green

- Task 1, scenario red (HEAD sources): `npm run test:cucumber:profile -- --profile adapter features/mcp-server/options.feature` failed at `Then the command reports these results:`. Only the `cascade` row came back, with no `mcp-config-notices` row and no `notices` column. Result: 1 scenario (1 failed), 12 steps (9 passed, 2 skipped, 1 failed), exit 1.
- Task 1, tag: `@mcp`. The scenario passed under both profiles with the same text, because the MCP phase writes `mcp-adapter.json` under both implementations and the stage emits the notice under both.
- Task 1, owner red: I saved the 15 changed product, schema, and doc files, restored them to HEAD with `git checkout`, and ran the new tests. The domain test failed to load (`does not provide an export named 'mcpOptionBlock'`). stage.test gave 117 tests and 5 failed. notification-mcp gave 1 failure, wire 1, resolve 4, json 1, and install-outcome 1 (the D-PG10-21 mcp-phase case). mcp-config-notices gave 48 tests and 4 failed (the four `mcp-option-blocked` cases). I then copied the saved files back, and `cmp` showed each one unchanged.
- Task 1, green: the scenario passed under adapter (1 scenario, 12 steps) and under builtin (1 scenario, 12 steps). The ten `<verify>` unit files gave 1090 pass, 0 fail. `npm run test:architecture` exited 0, after `npm run schema:generate` (see deviation 1). Direct coverage of all nine sources exited 0. `typecheck`, `check:features`, and the two MCP integration tests (17 pass) exited 0. ESLint on the 23 changed `.ts` files and `npm run fallow` exited 0. The callers install-flow-ledger, install-cascade, enable-disable, and bridges/mcp/index gave 636 pass. The hook passed. The tracer gate was green.
- Task 2, guard: it passed on the Task 1 code, because a plugin with no `userConfig` gets `options: undefined`.
- Task 2, guard proof: in the working tree only, I made the MCP phase pass `resolveOptions(...)` without `declaredOptions`. The guard failed at `Then the command reports these results:` with an extra row `mcp-config-notices | warning | false | [{"kind":"option-blocked",...,"server":"keyed","names":["token"],"reason":"unset"}]`. Result: 1 scenario (1 failed), 11 steps (8 passed, 2 skipped, 1 failed). `git checkout -- install-outcome.ts` restored the file, and `git diff --quiet HEAD -- extensions/pi-claude-marketplace` exited 0.
- Task 2, green: adapter gave 2 scenarios (2 passed), 23 steps. builtin gave 2 scenarios (2 passed), 23 steps. `check:features` exited 0. The hook passed.

## Lines for later plans

- Verdict: `mcpOptionBlock(server: unknown, options: Pick<ResolvedOptions, "mcpValues"> | undefined): McpOptionBlock | undefined` in `domain/claude-mcp-variables.ts`. It reads the five fields through the existing `scannedFields` (stdio `command`, each `args` string, each `env` value except `CLAUDE_PLUGIN_ROOT` and `CLAUDE_PLUGIN_DATA`; remote `url` and each `headers` value). It walks them with `replaceUserConfigReferences`. It returns `undefined` for `undefined` options, for a server that is not an object or of another type, or when every key is in `mcpValues`.
- Result type: `McpOptionBlock { reason: McpOptionBlockReason; keys: readonly string[] }`. The keys come once each, in first-seen field order. `McpOptionBlockReason = "unset"`. Plan 10-15 appends its reason to this union and decides it inside `mcpOptionBlock`. The stage copies `reason` and `keys` and does not change.
- Stage input member: `StageMcpInput.options: ResolvedOptions | undefined` (required). `install-outcome.ts` passes `declaredOptions(resolveOptions(installCtx.resolved.declaredUserConfig))`. `update-swap.ts` and `reconcile/mcp-migration.ts` pass `options: undefined`.
- Stage: `partitionOptionBlocked(input)` runs first in `prepareStageMcpServers` and returns `{ servers, blocked }`. Then `optionBlockedNotices(blocked, scope, pluginName)` builds the notices. They come last in the staged notice list, and they are also returned on both noop paths: `noopStaging(blockedNotices)` and `noopStaging([leftUnchanged, ...blockedNotices])`.
- Notice type: `McpOptionBlockedNotice { kind: "option-blocked"; scope; file: "mcp-adapter.json"; plugin; server (the declared name); names (the option keys); reason: McpOptionBlockedReason }`, with `McpOptionBlockedReason = "unset"`, in `shared/notification-types.ts`. It is the last member of `McpConfigNotice` and the last section in `MCP_CONFIG_NOTICE_SECTIONS`. It is a warning (`isWarningNotice`). Redaction covers plugin, server, and names. The wire member is `{ kind: "option-blocked", ...MCP_NOTICE_SUBJECT_FIELDS, names: STRINGS, reason: Type.Literal("unset") }`. A second reason turns that literal into a union.
- Rendered (catalog state `mcp-option-blocked`):

  ```text
  MCP server left out.

  Server "srv" from hello was left out of the project-scope mcp-adapter.json, because it names plugin options that have no value: token.
  ```

  The cause comes from `OPTION_BLOCKED_CAUSES[reason]` in `shared/notification-mcp.ts` (`unset`: `it names plugin options that have no value`). The keys are joined with `, ` after a colon, each through `printable`.
- Plan 10-13: the unstage fold in `orchestrators/marketplace/shared.ts` lists server-subject kinds by name, and `option-blocked` is not in it yet.
- Scenario titles in `features/mcp-server/options.feature` (both `@mcp`, with a Background that publishes `fixtures` with `demo` 1.0.0):
  - "A server that names a plugin option with no value is left out of mcp-adapter.json, and the install says so (PG-CORE-03, D-PG10-21)"
  - "A server of a plugin with no options keeps its option reference as written (D-PG10-21)"
- No new step was needed, so `features/step_definitions/mcp-server/options.steps.ts` was not created. Both scenarios use the existing `.mcp.json` "with these stub mcp servers" step with plain (non-marker) entries, the `plugin.json` "with this text" step, `the command reports these results:`, `the results list these marketplaces and plugins:`, and the file-text step.

## Parent-owned lines requested

- STATE.md decision: "An MCP server whose command, args, env, url, or headers name ${user_config.KEY} for a key the MCP value map lacks is left out of mcp-adapter.json and the record, and the command reports it with an option-blocked notice (reason unset) that names the keys; a plugin with no userConfig blocks nothing (D-PG10-08, D-PG10-21)."
- STATE.md decision: "The option-blocked notice names the server by its declared name, because the file holds no entry for it."
- PG-CORE-03: the install-path drop is done. Update, reinstall, and the move are plan 10-13, the built-in registration is plan 10-14, and the fill is plan 10-17. Do not mark the requirement complete yet.
- WINDOWS ledger (optional, for the parent): `gsd-tools windows append --kind deviation --phase 10 --file extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts --description "[parity-gaps] update, reinstall, and the load-time move pass options: undefined to the MCP stage until plan 10-13"`.

## Deviations from Plan

1. **[Rule 3 - Blocking] `schema/claude-plugin.schema.json` was regenerated.** It is outside the plan's file list. `test/architecture/wire-schema.test.ts` failed two cases until `npm run schema:generate` added the `option-blocked` member (28 lines). It is in the Task 1 commit, as in plan 10-06.
2. **Owner red runs were taken by restoring the sources to HEAD.** I wrote the product edits before the owner tests. To get the red output, I saved the changed files, restored HEAD with `git checkout`, ran the tests, and copied the files back. `cmp` confirmed the restore. The scenario red run was taken before any product edit.
3. **The stage also reports blocked servers on its two noop paths.** The plan names the staged path only. When every server is blocked and the plugin has no earlier entry, the stage returns a noop. When the file is unreadable, it returns the `left-unchanged` noop. Each path still carries the `option-blocked` notices, so the server is never dropped without a report. Owner cases cover both paths.
4. **Two stale lines next to my edits were corrected.** The caFile catalog paragraph said "It is the last MCP config notice". It now says "Only the left-out server notice comes after it". The header of `mcp-config-notices.test.ts` said "the three `mcp-ca-file-removed` blocks" where there are four.
5. **The notice summary is `MCP server left out.`, not a phrase about options.** Plan 10-15 adds a second reason, a value that would be home-expanded, under the same summary. The reason-keyed cause keeps the line correct for both.

## Known Stubs

None. `update-swap.ts` and `reconcile/mcp-migration.ts` pass `options: undefined` on purpose, as "Planner decisions" says. Plan 10-13 replaces both.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-10-30: `mcpOptionBlock` blocks the server before keys or entries are computed. Owner rows cover each of the five fields, an undeclared key, and first-seen order. The scenario shows the whole file holding only the plain server. T-10-31: the notice holds the plugin, the declared server name, and option keys only. The line renderer runs each one through `printable`. The resolve redaction arm covers names. Owner cases assert the escaped line and the redacted notice. T-10-32: the partition runs before `keyedServers` and `assertNoMcpCollisions`. An owner case stages a blocked server whose key `~/.agents/mcp.json` defines, and the stage does not refuse. T-10-SC: no package was installed or changed.

## Self-Check: PASSED

- FOUND: extensions/pi-claude-marketplace/domain/claude-mcp-variables.ts (`export function mcpOptionBlock`, `D-PG10-21`)
- FOUND: extensions/pi-claude-marketplace/bridges/mcp/stage.ts (`mcpOptionBlock`, `option-blocked`)
- FOUND: extensions/pi-claude-marketplace/shared/notification-types.ts and notification-wire.ts (`"option-blocked"`), notification-resolve.ts (2 or more `option-blocked`), docs/json-output.md (`option-blocked`)
- FOUND: features/mcp-server/options.feature (`Feature: MCP server options`, 2 `  Scenario` lines, `A server of a plugin with no options`)
- FOUND: cdc8141c, cb702d57 (ancestors of HEAD)

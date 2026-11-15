---
phase: 10-plugin-options-variables-and-trust
plan: "13"
subsystem: mcp
status: complete
tags: [user-config, options, mcp, notices, update, reinstall, legacy-move]
requires: ["10-09", "10-12"]
provides:
  - "update and reinstall stage MCP servers with the new resolution's options (update-swap.ts)"
  - "the load-time MCP move stages a moving owner's servers with its resolution's options (mcp-migration.ts stagedSource/stageOwner)"
  - "foldUnstageNotices drops option-blocked notices of the unstaged plugin and scope"
affects: [10-14, 10-15, 10-17, 10-20, 10-21]
tech-stack:
  added: []
  patterns: ["each caller of the MCP stage states the options of its own resolution, or undefined when it holds none"]
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/mcp-migration.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts
    - test/orchestrators/plugin/update-swap.test.ts
    - test/orchestrators/reconcile/mcp-migration.test.ts
    - test/orchestrators/marketplace/shared.test.ts
    - features/mcp-server/lifecycle.feature
decisions:
  - "An update, a reinstall, and the load-time MCP move stage a plugin's servers with the options of the resolution they stage from, so a server that names an option with no value is left out and reported at every staging (D-PG10-08, D-PG10-21)."
  - "foldUnstageNotices drops an option-blocked notice by plugin and scope, whatever its server, because a blocked server is in no recorded list and so is never among the dropped servers (D-PG10-21)."
metrics:
  duration: "~45 min"
  completed: 2026-11-15
actuals:
  tokens: 4800
  tasks: 2
  commits: 2
plan_head_before: 8e59138eea698d596d889b85b365201cadb98971
plan_head_after: 2f8e1541
---

# Phase 10 Plan 13: Leave out an option-blocked MCP server at update, reinstall, and the load-time move Summary

All three callers of `prepareStageMcpServers` now pass the options of their own resolution. The callers are the install ledger, the update swap (which reinstall also runs), and the load-time MCP move. A server that names `${user_config.KEY}` for an option with no value is left out of `mcp-adapter.json` and reported with an `option-blocked` notice at every staging. When a command unstages a plugin it staged, it now drops that plugin's `option-blocked` notices with it.

## Tasks

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Leave out a server that names an option with no value at update and reinstall | f790ce66 | update-swap.ts, update-swap.test.ts, lifecycle.feature |
| 2 | Leave such a server out at the load-time move, and drop its notice with the plugin | 2f8e1541 | mcp-migration.ts, shared.ts, and their tests |

## Red then green

- Task 1, scenario red (before any product edit): `npx cucumber-js --profile adapter --name "A reinstall leaves out a plugin server that names an option the manifest does not declare" features/mcp-server/lifecycle.feature` failed at `Then the command reports these results:`. Only the `cascade` row came back, with no `notices` column and no `mcp-config-notices` row. Result: 1 scenario (1 failed), 14 steps (11 passed, 2 skipped, 1 failed), exit 1.
- Task 1, tag: `@mcp`. The scenario passed under both profiles with the same text, and no step names pi-mcp-adapter. The adapter profile ran 24 scenarios and the builtin profile ran 9 scenarios, this one included.
- Task 1, owner red: "D-PG10-21: a swap leaves out a server that names an option the new version does not set, and reports it" failed. The actual result had `staged: ['keyed', 'plain']`, `notices: undefined`, and entries `plugin_hello_keyed_` and `plugin_hello_plain_`. 3 tests ran, 1 failed. "D-PG10-21: a swap to a version that declares no options stages a server that names an option" passed on HEAD. It is a guard.
- Task 1, green: the scenario passed (1 scenario, 14 steps). The update-swap, update-flow, and reinstall-flow tests gave 786 pass and 0 fail. Direct coverage of `update-swap.ts` exited 0. `lifecycle.feature` passed under adapter (24 scenarios, 346 steps) and under builtin (9 scenarios, 131 steps). `check:features`, `typecheck`, and ESLint on the touched files all exited 0. The hook passed. The tracer gate was green.
- Task 2, owner red: I wrote the `mcp-migration.ts` edit before its test, so I took the red run against HEAD. I saved the file, ran `git checkout` on it, ran the tests, and copied the file back (`cmp` confirmed it). `shared.ts` was still at HEAD. Two tests failed out of 3. "D-PG10-21: foldUnstageNotices drops every option-blocked notice of the unstaged plugin and scope" kept all four notices. "D-PG10-21: a move leaves out a server that names an option with no value, and reports it" gave `input.notices` `[]`. "D-PG10-21: a disabled owner's stage gets no servers and no options" passed on HEAD. It is a guard.
- Task 2, green: the tests of mcp-migration, shared, enable-disable, install-flow-ledger, and install-cascade gave 807 pass and 0 fail. Direct coverage of `mcp-migration.ts` and of `shared.ts` exited 0. `typecheck` exited 0. Under the adapter profile, `legacy-move.feature` plus `lifecycle.feature` gave 29 scenarios and 414 steps, all passed. ESLint on the four files and `npm run fallow` exited 0. The hook passed.

## Lines for later plans

- Stage callers, all three now fed:
  - `install-outcome.ts` passes `declaredOptions(resolveOptions(installCtx.resolved.declaredUserConfig))`.
  - `update-swap.ts::prepareUpdateHandles` computes `const options = declaredOptions(resolveOptions(installable.declaredUserConfig))` once and passes it to `prepareStageSkills` and `prepareStageMcpServers`.
  - `mcp-migration.ts::stagedSource` returns `options` beside `servers`, `pluginRoot`, and `description`. A `move` owner gets `declaredOptions(resolveOptions(action.resolved.declaredUserConfig))`, the same resolution that `applyNeutralVerdict` records with `userConfigFieldsOf`. A `malformed` or `disabled` owner gets `undefined`. `stageOwner` passes it through.
- The fold rule: `foldUnstageNotices` (in `orchestrators/marketplace/shared.ts`) calls a private `describesUnstaged(notice, scope, plugin, removed)`. A notice of another scope stays. An `option-blocked` notice is dropped when its `plugin` is the unstaged plugin, whatever its server. `variables-missing`, `credentials-blanked`, `tool-rules-unenforced`, and `ca-file-removed` notices are dropped when their server key is among the removed entries, as before. Every other kind stays. Plan 10-15 adds a second `option-blocked` reason, and it needs no fold change, because the rule does not read `reason`.
- Scenario: "A reinstall leaves out a plugin server that names an option the manifest does not declare, and says so (D-PG10-21)" in `features/mcp-server/lifecycle.feature`, tagged `@mcp`, placed after the caFile reinstall scenario. The manifest declares `mode` with the default `fast`. After the install, `.mcp.json` is written again with the plain `stub` and `keyed` (`"args": ["--region", "${user_config.region}"]`). The reinstall reports `mcp-config-notices | warning | false | [{"kind":"option-blocked","scope":"user","file":"mcp-adapter.json","plugin":"demo","server":"keyed","names":["region"],"reason":"unset"}]`, and the file holds `plugin_demo_stub_` only. The feature description gained this sentence: "A reinstall leaves out a plugin server that names an option with no value, and says so, as an install does (D-PG10-21)."
- No new step was needed, so `features/step_definitions/mcp-server/lifecycle.steps.ts` was not created.

## Parent-owned lines requested

- STATE.md decision: "An update, a reinstall, and the load-time MCP move stage a plugin's servers with the options of the resolution they stage from, so a server that names an option with no value is left out and reported at every staging (D-PG10-08, D-PG10-21)."
- STATE.md decision: "foldUnstageNotices drops an option-blocked notice by plugin and scope, whatever its server, because a blocked server is in no recorded list and so is never among the dropped servers (D-PG10-21)."
- PG-CORE-03: every adapter staging path now drops a blocked server. The built-in registration is plan 10-14 and the fill is plan 10-17. Do not mark the requirement complete yet.
- WINDOWS ledger: if the parent recorded the 10-12 deviation entry about `options: undefined` in `update-swap.ts` and `mcp-migration.ts`, this plan resolves it.

## Deviations from Plan

1. **The Task 2 owner red run was taken by restoring `mcp-migration.ts` to HEAD.** I made that product edit before I wrote its test. To get the red output, I saved the file, restored it with `git checkout`, ran the tests, and copied it back. `cmp` confirmed the copy. The fold edit came after its red run.
2. **The fold's predicate moved into a private helper, `describesUnstaged`.** Adding the plugin rule inline would have nested a conditional inside the filter callback. The helper takes `scope` and `plugin` and not the whole `unstaged` object, so the exported signature keeps its inline type, and fallow reports no private-type leak.
3. **The scenario's two servers are plain entries, not the Background's stub marker.** The stub marker cannot carry `args`, and a stub entry holds the run's Node path, which has no file-text token. This matches the scenarios of plan 10-12.
4. **Two owner cases are guards that pass on HEAD.** They are "a swap to a version that declares no options stages a server that names an option" and "a disabled owner's stage gets no servers and no options". Both behaviors already held before this plan. The cases pin them.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-10-50: both restage callers pass the options of their own resolution through `declaredOptions(resolveOptions(...))`. The owner cases state what the update swap writes and reports, and what the move writes and reports. The reinstall scenario shows the whole file and the notice. I read each production call of `prepareStageMcpServers`, and all three pass options. T-10-51: the fold drops `option-blocked` notices by plugin and scope. An owner case covers the unstaged plugin (two servers), the same plugin in the other scope, and another plugin. T-10-SC: no package was installed or changed.

## Self-Check: PASSED

- FOUND: f790ce66, 2f8e1541 (ancestors of HEAD)
- FOUND: `option-blocked` in extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts
- FOUND: 2 `D-PG10-21` lines in features/mcp-server/lifecycle.feature
- FOUND: `D-PG10-21` in test/orchestrators/reconcile/mcp-migration.test.ts

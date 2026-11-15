---
phase: 06-hook-inputs-and-events
reviewed: 2026-11-15T00:00:00Z
depth: standard
files_reviewed: 55
files_reviewed_list:
  - extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts
  - extensions/pi-claude-marketplace/bridges/hooks/async-rewake/rewake-text.ts
  - extensions/pi-claude-marketplace/bridges/hooks/child-root-session.ts
  - extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts
  - extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts
  - extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts
  - extensions/pi-claude-marketplace/bridges/hooks/event-router.ts
  - extensions/pi-claude-marketplace/bridges/hooks/hook-env.ts
  - extensions/pi-claude-marketplace/bridges/hooks/hook-labels.ts
  - extensions/pi-claude-marketplace/bridges/hooks/if-field/index.ts
  - extensions/pi-claude-marketplace/bridges/hooks/index.ts
  - extensions/pi-claude-marketplace/bridges/hooks/mcp-server-table.ts
  - extensions/pi-claude-marketplace/bridges/hooks/payloads/post-tool-use-failure.ts
  - extensions/pi-claude-marketplace/bridges/hooks/payloads/post-tool-use.ts
  - extensions/pi-claude-marketplace/bridges/hooks/payloads/pre-compact.ts
  - extensions/pi-claude-marketplace/bridges/hooks/payloads/pre-tool-use.ts
  - extensions/pi-claude-marketplace/bridges/hooks/payloads/session-start.ts
  - extensions/pi-claude-marketplace/bridges/hooks/payloads/stop-failure.ts
  - extensions/pi-claude-marketplace/bridges/hooks/payloads/stop.ts
  - extensions/pi-claude-marketplace/bridges/hooks/payloads/tool-event-facts.ts
  - extensions/pi-claude-marketplace/bridges/hooks/payloads/user-prompt-expansion.ts
  - extensions/pi-claude-marketplace/bridges/hooks/payloads/user-prompt-submit.ts
  - extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts
  - extensions/pi-claude-marketplace/bridges/hooks/runtime.ts
  - extensions/pi-claude-marketplace/bridges/hooks/settle.ts
  - extensions/pi-claude-marketplace/bridges/hooks/timeout.ts
  - extensions/pi-claude-marketplace/bridges/hooks/tool-batch.ts
  - extensions/pi-claude-marketplace/bridges/hooks/translation-context.ts
  - extensions/pi-claude-marketplace/bridges/hooks/wire-protocol.ts
  - extensions/pi-claude-marketplace/domain/argument-substitution.ts
  - extensions/pi-claude-marketplace/domain/components/hook-events.ts
  - extensions/pi-claude-marketplace/domain/components/hooks.ts
  - extensions/pi-claude-marketplace/domain/components/hooks/matcher.ts
  - extensions/pi-claude-marketplace/domain/components/hooks/partition.ts
  - extensions/pi-claude-marketplace/edge/skill-aliases.ts
  - extensions/pi-claude-marketplace/index.ts
  - extensions/pi-claude-marketplace/orchestrators/skill-alias-state.ts
  - extensions/pi-claude-marketplace/orchestrators/typed-expansion.ts
  - extensions/pi-claude-marketplace/platform/subagent-child.ts
  - extensions/pi-claude-marketplace/shared/concerns/hooks.ts
  - features/lib/hook-run-tokens.ts
  - features/lib/mcp-configuration.ts
  - features/lib/real-subagent-child.ts
  - features/lib/saved-sessions.ts
  - features/lib/scripted-model/extension.ts
  - features/step_definitions/hook/prompt-commands.steps.ts
  - features/step_definitions/hook/runs.steps.ts
  - features/step_definitions/hook/session.steps.ts
  - features/step_definitions/hook/tool-use.steps.ts
  - features/step_definitions/mcp-configuration.steps.ts
  - features/step_definitions/mcp-implementation.steps.ts
  - features/step_definitions/model.steps.ts
  - features/step_definitions/plugin/subagent-hooks.steps.ts
  - features/support/world.ts
  - test/e2e/_rpc.ts
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
  necessity: 1
status: issues_found
---

# Phase 6: Code Review Report

**Reviewed:** 2026-11-15T00:00:00Z
**Depth:** standard
**Files Reviewed:** 55
**Status:** issues_found

## Summary

I reviewed the changes since `0f231177` in the 55 listed files. I checked them against D-PG6-01..24, the 13 plan SUMMARY files (deviations and flagged assumptions), and `docs/hooks-compatibility.md`.

Most of the code matches its decisions. These parts are correct: the two session sides (`sessionId` faces the hook, and `ownSessionId` keys the env file, the journal owner, and the identity guard), the bounded header read of the launching session (absolute path, `O_NONBLOCK`, regular-file check, 64 KiB), the `tool_use_id` pair suffix, the PreToolUse mark on every exit path, the `custom_instructions` null rule, the `effort` event set, and the `startup`/`resume`/`fork` launch facts. I traced the in-place `updatedInput` rewrite (`replaceToolCallInput`). The shallow copy that `withToolFacts` makes still shares the `input` object, so a hook's rewrite still reaches Pi.

I found no security issue and no crash. The three warnings are behavior gaps:

1. The `mcp_server` table goes stale when a load's autoapply changes the plugins.
2. Plugin records that predate `mcpServerConfigs` silently get no `mcp_server`.
3. A queued follow-up expansion's `additionalContext` is always dropped.

The departure for nested children from D-PG6-01 is recorded and documented, and it waits for maintainer review. I list it as Info only so that it is not lost.

## Warnings

### WR-01: `mcp_server` table is not refreshed after the load's autoapply installs or enables a plugin

**File:** `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts:787`, `:978`; `extensions/pi-claude-marketplace/index.ts:174-202`
**Issue:** `setMcpServers` runs only in two places. The first is `hydrateScopeFromState`, called by the factory-time `hydrateCacheFromDisk` and by `hydrateProjectScopeForCwdWith`. The second is the project reset. Pi 1.5.0 emits `session_start` before `resources_discover` (`agent-session.js:2698-2706`). So the last refresh in a session happens before `loadReconcile`. With autoapply on, `loadReconcile` runs `applyReconcile`, and its install path routes the new plugin's hooks at once (`install-flow-ledger.ts:403`, `readAndCachePluginHooks`). Then `resyncBuiltinRegistrations` (`index.ts:201`) registers the new plugin's servers with Pi's built-in MCP in the same load. The plugin's hooks then fire on its MCP tools, but `findMcpServer` knows no entry for them, so `mcp_server` is left out until the next `/reload`. The same applies to an enable done by autoapply. `docs/hooks-compatibility.md:393` lists the cases where the field is left out, and this one is not among them.
**Fix:** After `loadReconcile`, refresh the table from the state the load left. The smallest fix is to have the routing side re-read the servers whenever it rebuilds. For example, add a `refreshMcpServers(scope, state)` to `HooksRouting`, call it next to `rebuildRoutingTables` in the reconcile and install paths, or re-run `mcpServerEntries` for both scopes in `prepareResources` after `loadReconcile` returns:

```ts
// index.ts, after loadReconcile(...)
await hooksHydration.refreshMcpServers(event.cwd, projectTrusted); // re-reads both scopes' state
```

### WR-02: Records without `mcpServerConfigs` never get `mcp_server`, and the page does not say so

**File:** `extensions/pi-claude-marketplace/bridges/hooks/mcp-server-table.ts:82-94`
**Issue:** `mcpServerEntries` reads `record.mcpServerConfigs ?? []`. A record written before that field existed has no entries, so the tools of its plugin's MCP servers, which pi-mcp-adapter still serves, run hooks with no `mcp_server`. The architecture names `orchestrators/mcp/recorded-servers.ts` as "the one reader of a record's `mcpServerConfigs`, with the legacy reader for a record that predates the field (MREC-01/02)". This module is a second reader, and it drops the legacy arm. The bridges zone cannot import `orchestrators/`, so the gap is structural. But `docs/hooks-compatibility.md:393` lists every case where the field is left out, and a legacy record is not among them. So the contract as documented is wrong for those installs.
**Fix:** Do one of the following:
- Pass the server list in from the composition root, as `resolveTypedExpansion` is passed. For example, add `readMcpServers?: (scope, state) => Promise<McpServerEntry[]>` to `RegisterHooksBridgeOptions`, built in `index.ts` over `recorded-servers.ts`, so the legacy reader applies.
- At minimum, add the case to the `mcp_server` row ("a plugin installed before release X: run `/claude:plugin reinstall <plugin>`").

### WR-03: The `additionalContext` of a queued follow-up expansion can never be delivered

**File:** `extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts:691-696`, `:666-670`; `extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts:1435-1442`
**Issue:** For a line typed while the agent runs with `streamingBehavior: "followUp"`, `queuePromptContext` queues `{ ..., prompt: event.text }`, which is the typed slash line. Pi queues the follow-up only after it expands the skill or template (`agent-session.js:1678-1688`: `_expandSkillCommand`, `expandPromptTemplate`, then `_queueFollowUp(expandedText)`). Every `UserPromptExpansion` line is by definition a line that Pi or this extension's alias and command handlers rewrite. So `sendDueFollowUpContext`'s `takeFollowUpContext(next)` never matches it. The context stays in the buffer until the next idle prompt's `dropStalePromptContext` drops it, with only a debug line. Also, when a `UserPromptSubmit` hook and an expansion hook both add context to one follow-up, the code queues two entries with the same `prompt`, and `takeThrough` removes only one per turn end. `docs/hooks-compatibility.md:441` states the loss only for "A `UserPromptSubmit` context ... such as a skill command". It does not state it for the new event, where the loss always happens.
**Fix:** Do one of the following:
- Send a follow-up expansion's context at once, as a steer's context is sent (`sendQueuedPromptContext`). The follow-up queue cannot be matched for this event.
- Fold both prompt events of one follow-up into one entry.

At minimum, extend the docs sentence to `UserPromptExpansion` and say that its context is always dropped for a follow-up.

## Info

### IN-01: A nested child names its launcher, not the root main session (recorded departure from D-PG6-01)

**File:** `extensions/pi-claude-marketplace/bridges/hooks/child-root-session.ts:64-89`
**Issue:** D-PG6-01 says that a child's session fields name the root main session, "not an intermediate parent of a nested child". The resolver reads one hop and never follows `parentSession`, so a child of a child names the child that launched it. The departure is recorded in the 06-07 and 06-09 SUMMARY files and in `docs/hooks-compatibility.md:73` (licensed by D-PG3-06), and it waits for maintainer review. I list it here only so that it is not lost if review stops at the SUMMARY files.
**Fix:** Maintainer decision. Research Pattern 1 (two variables of this extension's own that a child publishes for its runner) is the alternative that was recorded.

### IN-02: The typed-line resolver copies the precedence of two edge handlers by hand

**File:** `extensions/pi-claude-marketplace/orchestrators/typed-expansion.ts:32`, `:113-165`
**Issue:** `SLASH_TOKEN` copies the regex at `edge/skill-aliases.ts:183`. The order "another source keeps its name, then template, then `skill:`, then alias" copies what `skill-aliases.ts:178-215` and `command-invocation.ts:121-139` do. No shared function or test ties the copies together. If either handler changes its order, the hooks are told a `command_name` that the line does not expand to.
**Fix:** Extract the token split and the "which handler takes this line" decision into one function that the resolver and both edge handlers call. Or add an owner test that runs the same table of lines through the resolver and through the two handlers.

### IN-03: Impossible-state guard: the try/catch around `ctx.thinkingLevel`

**File:** `extensions/pi-claude-marketplace/bridges/hooks/translation-context.ts:94-106`
**Category:** necessity
**Issue:** In Pi 1.5.0 (`runner.js:650-653`), the `thinkingLevel` getter runs `runner.assertActive()` and then `runner.runtime.getThinkingLevel()`. `buildTranslationContext` reads `ctx.sessionManager` and `ctx.model` without a guard just before it calls `dispatchEffort` (`:136-138`). Both getters run the same `assertActive()`, so a stale context throws before the guarded read. The catch covers only `runtime.getThinkingLevel()` itself throwing, and I found no evidence that it does. This finding rests on judgment, so it is Info.
**Fix:** Read the three session facts the same way, with no guard or with one guard. Or record in the comment the specific failure that the catch is for.

---

_Reviewed: 2026-11-15T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

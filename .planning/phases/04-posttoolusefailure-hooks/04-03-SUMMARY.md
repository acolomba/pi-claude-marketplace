---
phase: 04-posttoolusefailure-hooks
plan: 03
subsystem: hooks
tags: [cucumber, hooks, PostToolUseFailure, mcp, pi-mcp-adapter]
requires:
  - phase: 04-posttoolusefailure-hooks
    provides: "04-01 and 04-02: the feature file, the verb module, D-BG-401, D-BG-402, D-BG-405"
provides:
  - "Under pi-mcp-adapter a failed plugin MCP call runs the PostToolUseFailure hooks (D-BG-404)"
  - "A failing stub MCP server step and the @adapter-only/@builtin-only scenario pair"
  - "The phase's parent lines"
key-files:
  modified:
    - extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts
    - test/bridges/hooks/dispatch.test.ts
    - features/step_definitions/hook/tool-failure.steps.ts
    - features/hook/tool-failure.feature
    - docs/hooks-compatibility.md
requirements: [TFAIL-01]
completed: 2026-11-08
---

# Plan 04-03 Summary: the failed plugin MCP call under each implementation

## Accomplishments

- `bridges/hooks/dispatch.ts` (D-BG-404): the constant `ADAPTER_FAILURE_CODES` (`tool_error`, `call_failed`), the private `adapterReportsFailure(event, tools)`, which reads `event.details` first and calls `tools.proxyRuleApplies()` only when one of those codes is present, and the private `routedToolResult(event, tools)`, which returns the event itself or a shallow copy with `isError: true`. The `toolResultCompositeHandler` closure computes the routed event right after the generation check, and the split line, the D-BG-402 guard (still after the empty-bucket check), `toolEventView`, the labels, `sendToolContext`, and `adaptToolResultResult` all take it. The handler never returns `isError`; pi-mcp-adapter's own later handler still decides what Pi records.
- `test/bridges/hooks/dispatch.test.ts`: cases at the end of `describe("toolResultCompositeHandler")` for each adapter code (routed to `failure-observer` with `isError: true`, reads `proxyRuleApplies` then `identify`), the adapter not active (stays on PostToolUse), five rows without a code (no proxy-rule read), the block label `PostToolUseFailure:mcp__plugin_demo_stub__echo hook blocking error from command: "printf failure-observer": look again`, and an adapter failure under an aborted signal (no hook). Helpers `adapterToolResult` and `runAdapterToolResult` sit at the end of the file.
- `features/step_definitions/hook/tool-failure.steps.ts`: the Given `the published plugin {string} of the marketplace {string} has the stub mcp server {string} for its hooks, whose tool calls fail`. It writes `failing-stub-server.mjs` (a wrapper that runs the frozen `MCP_STUB_SERVER` as a child and marks each `tools/call` answer `isError: true`) and a `.mcp.json` that launches it, then reads both back.
- `features/hook/tool-failure.feature`: the `@adapter-only` scenario (D-BG-404, error `Error: echo:ping`) and the `@builtin-only` twin (MHK-01, error `echo:ping`). In each, the hooks `failure` (the full Claude Code tool name) and `prefixed` (`mcp__plugin_hook-demo_stub-server__.*`) run, and `other` (another tool of the server) and the PostToolUse `after` hook do not. They leave out the built-in stand-in step: the extension registers the wrapper itself.
- `docs/hooks-compatibility.md`: the `PostToolUseFailure` events row adds that a failed MCP tool call through pi-mcp-adapter counts as a failure (D-BG-404).

## Task Commits

| Commit | Title | Files |
| --- | --- | --- |
| e07494f7 | fix(hooks): run PostToolUseFailure on a failed pi-mcp-adapter call | dispatch.ts, dispatch.test.ts, tool-failure.steps.ts, tool-failure.feature (adapter scenario), hooks-compatibility.md |
| 30ce4b48 | test(features): cover a failed plugin MCP call under Pi's built-in MCP | tool-failure.feature (builtin twin) |

## Red proofs

- Adapter scenario, before D-BG-404: the hooks recorded one PostToolUse run of `after` with the tool response `[{"type":"text","text":"Error: echo:ping"}]` and no PostToolUseFailure run (1 scenario failed, 13 of 14 steps passed). Green after the fix.
- Unit, with `dispatch.ts` at HEAD (before the fix): five new cases failed (both adapter codes, the inactive adapter's read sequence, the block label, and the aborted adapter failure); the five no-code rows pass either way, as they pin unchanged behavior. The file was restored and compared byte for byte.
- Builtin twin: with the wrapper line that sets `isError` removed, the call succeeded under the builtin profile, the PostToolUse `after` hook ran, and the PostToolUseFailure rows were missing (1 scenario failed). The step module was restored from a copy, and `git status --porcelain -- features/step_definitions/ extensions/` printed nothing. Green before and after.

## Checks

- `node --import <worktree>/test/platform/isolated-pi-home.ts --test test/bridges/hooks/dispatch.test.ts`: exit 0; `npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts`: exit 0.
- prettier, eslint, `tsc --noEmit`, `npm run check:features`, `npx fallow dupes --fail-on-issues`, `npx fallow health --fail-on-issues`: exit 0.
- Adapter profile, `features/hook/tool-failure.feature features/hook/tool-use.feature features/hook/mcp-tool-names.feature`: 32 of 32 after Task 1. After Task 2: builtin profile on the same three files, 6 of 6; adapter profile, 32 of 32; `npm run check:features`, exit 0.

## Parent lines

**`.planning/PROJECT.md` Key Decisions rows** (each in the shape of the D-BG-01 row):

- `| **D-BG-401 (behavioral-gaps, Phase 4, settled with the recommended answer, pending user review): the PostToolUseFailure payload carries \`is_interrupt\`, always \`false\`**. Claude Code sends the boolean on every failure; with D-BG-402 the bridge runs no PostToolUseFailure hook on a cancelled call, so every run is a failure the tool reported. It amends the PostToolUseFailure clause of D-CF5-28 for this field only. | Pi's \`tool_result\` event has no interrupt bit, so the value is a constant that holds only because of D-BG-402. Rejected: leaving the field out (upstream always sends it). | -- Pending |`
- `| **D-BG-402 (behavioral-gaps, Phase 4, settled with the recommended answer, pending user review): a running tool the user cancels runs no PostToolUseFailure hook, as Claude Code**. \`toolResultCompositeHandler\` skips the failure bucket when the result failed and the turn's abort signal is aborted. | Claude Code's hooks docs: "Cancelling a running tool does not fire this hook"; the 2.1.319 binary hands the hook runner the already-aborted signal. Pi still reports a cancelled call as a failed result, so the bridge ran the hooks. | -- Pending |`
- `| **D-BG-403 (behavioral-gaps, Phase 4, settled with the recommended answer, pending user review): \`tool_use_id\`, \`duration_ms\`, and \`mcp_server\` stay out of the PostToolUseFailure payload (D-CF5-28, BACKLOG HOOKPAYLOAD-01)**. | The frozen runs step states whole literals, and the ids and timings vary per run; \`mcp_server\` would change the PreToolUse and PostToolUse payloads too, and its plugin-server \`name\` upstream is unverified. | -- Deferred |`
- `| **D-BG-404 (behavioral-gaps, Phase 4, settled with the recommended answer, pending user review): under pi-mcp-adapter a failed plugin MCP call runs PostToolUseFailure, as Claude Code**. While the adapter is the active implementation, a result whose \`details.error\` is \`tool_error\` or \`call_failed\` takes the PostToolUseFailure bucket, and every later step sees it failed. | The adapter returns the failure with no result-level \`isError\` and flags it in its own \`tool_result\` handler, which Pi runs after this extension's. Rejected: a \`@builtin-only\` scenario plus a BACKLOG line. Only the two MCP call codes count, not the adapter's whole override set. | -- Pending |`
- `| **D-BG-405 (behavioral-gaps, Phase 4, settled with the recommended answer, pending user review): a PostToolUseFailure hook's \`updatedToolOutput\` does not replace the failed result**. | Claude Code's PostToolUseFailure branch reads only \`additionalContext\` (2.1.319 binary). | -- Pending |`

**`CHANGELOG.md`, `[Unreleased]`** (one bullet, in the changelog skill's shape):

- Plugin `PostToolUseFailure` hooks now behave as in Claude Code: a tool call you cancel runs none, a failed MCP tool call through pi-mcp-adapter runs them instead of the `PostToolUse` hooks, their input carries `is_interrupt`, and their `updatedToolOutput` no longer replaces the failed result.

**`.planning/BACKLOG.md`:**

- HOOKPAYLOAD-01: `is_interrupt` shipped, always `false` (D-BG-401); `tool_use_id`, `duration_ms`, and `mcp_server` stay deferred (D-BG-403).
- HOOKOUTPUT-01: the entry now concerns PostToolUse only; a PostToolUseFailure `updatedToolOutput` is ignored (D-BG-405).

**Unowned feature file:** `features/hook/tool-use.feature`, scenario "A failed tool call runs PostToolUseFailure and not PostToolUse": the runs table gained `is interrupt` = `false`, in commit f627409b alone.

**Merge note:** `toolResultCompositeHandler` in `bridges/hooks/dispatch.ts` gained the D-BG-402 guard and the D-BG-404 routing (the closure's parameter is now `piEvent`, routed to `event`), and `test/bridges/hooks/dispatch.test.ts` gained cases at the end of `describe("toolResultCompositeHandler")`, the helper `runBashToolResult` after it, `ADAPTER_TOOL` above it, and two helpers at the end of the file. `adaptToolResultResult` in `event-adapters.ts` gained the D-BG-405 arm. Phase 2 (async hooks) edits the same files; a conflicting merge keeps both sides. Phases 3, 5, and 6 were merged into this branch already (d2dfb11d).

**Frozen files:** none changed.

**Phase log:** `.planning/phases/04-posttoolusefailure-hooks/DUBIOUS-CHOICES.md`, for the root log.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Dubious Choices

- The failing wrapper is a string in the verb module and a file in the published plugin, because `features/lib/**` is frozen (P4-DC-04).
- The adapter scenario pins pi-mcp-adapter's `Error: ` prefix, and the twin Pi's plain text (P4-DC-07).
- The unit helpers sit at the end of `dispatch.test.ts`, and `ADAPTER_TOOL` sits just above `describe("toolResultCompositeHandler")`.

# Phase 4: PostToolUseFailure Hooks - Context

**Gathered:** 2026-11-08
**Status:** Ready for planning
**Mode:** autonomous smart discuss; every question took the recommended answer (child-session brief, section 4)

<domain>
## Phase Boundary

A failed tool call runs the plugin's `PostToolUseFailure` hooks with Claude Code's payload, matchers select them by tool, and the plugin's `PostToolUse` hooks do not run on it (TFAIL-01). The phase adds the cucumber scenarios that `hook/tool-use.feature` does not pin yet, in the new `features/hook/tool-failure.feature` with the new verb module `features/step_definitions/hook/tool-failure.steps.ts`, and it fixes the product bugs those scenarios expose, in `bridges/hooks/payloads/post-tool-use-failure.ts` and in the PostToolUseFailure arm of the shared hook modules.

`hook/tool-use.feature` already pins one failed Bash call (`exit 3`) that runs PostToolUseFailure and not PostToolUse. This phase adds:

1. a failed built-in tool other than Bash, and a failed plugin MCP tool under each MCP implementation, with the payload and its error fields;
2. matcher selection by tool name: a literal, an alternation, a plugin MCP tool name, and a matcher that does not select;
3. no PostToolUse run on a failed call, and no PostToolUseFailure run on a successful call;
4. what a PostToolUseFailure hook returns: `additionalContext`, `systemMessage`, exit 2, and a JSON `decision: "block"`;
5. a cancelled running tool runs no PostToolUseFailure hook (the product bug this phase fixes, D-BG-402).

Out of scope: `async` and `asyncRewake` hooks on this event (Phase 2), the common fields the bridge does not send on any event (`permission_mode`, `effort`, `prompt_id`, `scratchpad_dir`, `agent_type`; PAYL-01), the non-blocking error notice (BACKLOG HOOKERRNOTE-01), and PostToolUse behavior beyond "it does not run on a failure".

</domain>

<decisions>
## Implementation Decisions

### Upstream contract (research, 2026-11-08)

Evidence: Claude Code 2.1.319 binary (`/home/linuxbrew/.linuxbrew/Caskroom/claude-code@latest/2.1.319/claude`, strings grepped 2026-11-08) and https://code.claude.com/docs/en/hooks (read 2026-11-08). Confidence high unless a line says otherwise.

- **When it fires.** Docs: "Runs when a tool that started executing fails: the tool threw an error, or an MCP tool returned an error result." It does not fire for an unknown tool, input that fails validation, or a permission denial. Binary: the runner `Q3t` is called only from the `catch` of a tool's `call`. Pi matches: its `afterToolCall` (the `tool_result` event) runs only for a call that executed; a missing tool, a validation failure, and a `tool_call` block return an immediate result with no `tool_result` event (`pi-agent-core` `prepareToolCall`).
- **A cancelled running tool.** Docs: "Cancelling a running tool does not fire this hook; the tool result carries the interruption message instead." Binary: the runner passes the turn's already-aborted signal to the hook runner and logs `PostToolUseFailure hook cancelled (parent abort)`. The bridge today runs the hooks on a cancelled call, because Pi still emits `tool_result` with `isError: true` when the user aborts a running tool, and `toolResultCompositeHandler` never reads the abort signal. This is the phase's product bug (D-BG-402).
- **Payload.** Binary (`XZo`): the common fields, then `hook_event_name`, `tool_name`, `tool_input`, `tool_use_id`, `error`, `is_interrupt` (always a boolean at every call site), `duration_ms`, and `mcp_server: {name, source}` for an MCP tool. Docs example: `"is_interrupt": false`, `"duration_ms": 4187`. Docs: `error` "is generally the same text Claude receives as the failed tool's result. Its format varies by tool and failure"; `is_interrupt` is "True when the failure reached Claude Code as an abort rather than as an error the tool reported."
- **Output.** Binary: the PostToolUseFailure branch reads only `hookSpecificOutput.additionalContext` (no `updatedToolOutput`, and `continue: false` is not acted on), and the generic path turns exit 2 and a top-level `decision: "block"` into a blocking error. Docs: exit 2 "Shows stderr to Claude; the tool already failed"; `additionalContext` is "added to Claude's context alongside the error"; the decision table lists PostToolUseFailure under top-level `decision: "block"`. The hook names its messages `PostToolUseFailure:<Tool>`.
- **Matcher.** Docs: "Matches on tool name, same values as PreToolUse" (`Bash`, `Edit|Write`, `mcp__.*`).

### Payload fields

- **D-BG-401: the PostToolUseFailure payload gains `is_interrupt`, always `false`.** Upstream sends the boolean on every failure. With D-BG-402 the bridge never runs these hooks on a cancelled call, so every run it makes is a failure the tool reported, and `false` is the value Claude Code sends for one. Pi gives the `tool_result` event no interrupt bit of its own. This amends the PostToolUseFailure clause of D-CF5-28 for `is_interrupt` only, and the product change updates the expected row of the existing PostToolUseFailure scenario in the unowned `features/hook/tool-use.feature` (a column `is interrupt` with `false`), in a commit of its own, named in the SUMMARY. `docs/hooks-compatibility.md` gains or changes only the `is_interrupt` row.
- **D-BG-403: `tool_use_id`, `duration_ms`, and `mcp_server` stay out of the payload (D-CF5-28, BACKLOG HOOKPAYLOAD-01 unchanged).** The frozen runs step states every recorded stdin field as a whole literal, and the faux provider gives each tool call a random id and each run its own timing, so no scenario can state the first two. `mcp_server` would change the PreToolUse and PostToolUse payloads too (files no stream owns), and the value Claude Code sends as `name` for a plugin server is not verified (low confidence). The scenarios name D-CF5-28 where these fields are absent.
- `error` stays the text parts of the failed result, one per line: the same text Pi's model receives, which is the upstream rule ("generally the same text Claude receives"). Its wording is Pi's or the MCP server's, not Claude Code's `Exit code N` form (a Pi gap: Pi's tools word their own errors).
- The common fields stay `session_id`, `transcript_path`, and `cwd` (PAYL-01); no scenario adds a column for an absent field.

### Cancelled calls (the product fix)

- **D-BG-402: a cancelled running tool runs no PostToolUseFailure hook, as Claude Code.** The `tool_result` handler runs no PostToolUseFailure hook when the result is an error and the turn's abort signal (`ctx.signal`) is aborted. The check sits in the PostToolUseFailure arm of `toolResultCompositeHandler` (`bridges/hooks/dispatch.ts`), before any hook of the bucket starts, so it also covers the bucket's async hooks. It is an additive guard on the failure arm only; the PostToolUse path and every other event are unchanged. A guard edit inside the shared function is logged as a dubious choice (P4-DC-02).
- A scenario interrupts a Bash call while its command runs: the model calls Bash with a command that first writes a marker file and then waits, the step sends Pi's RPC `abort` once the marker exists, and the turn ends aborted. Then neither a PostToolUseFailure nor a PostToolUse hook ran. The step lives in the verb module `hook/tool-failure.steps.ts`, because no frozen module can interrupt a turn. Without the fix the PostToolUseFailure hook records a run, so the scenario is red before the fix.

### Decisions added after research (2026-11-08, 04-RESEARCH.md probes)

- **D-BG-404: under pi-mcp-adapter, a failed plugin MCP call runs PostToolUseFailure, as Claude Code.** A research probe showed the adapter returns no result-level `isError`: it marks the failure in `details.error` (`tool_error`, `call_failed`) and sets the flag later in its own `tool_result` handler, which Pi runs after ours. So today the call runs the PostToolUse hooks with `tool_response` `Error: echo:ping`. While the adapter is the active implementation, `toolResultCompositeHandler` treats a result whose `details.error` is `tool_error` or `call_failed` as a failure, routes it to the PostToolUseFailure bucket, and passes on a view event with `isError: true`, so the labels read `PostToolUseFailure:...`. It reads `proxyRuleApplies()` only when one of those codes is present, so the existing read-order tests still hold. This edits the D-59-01 split line of the shared handler (P4-DC-05).
- **D-BG-405: a PostToolUseFailure hook's `updatedToolOutput` does not replace the failed result.** The binary's PostToolUseFailure branch reads only `additionalContext`. One arm in `adaptToolResultResult` (`event-adapters.ts`) drops the replacement on the failure path (P4-DC-06).
- **Matcher correction:** the `mcp__plugin_<plugin>_.*` pattern is unsupported by the bridge (MATCH-02: the install comes out partially available). The MCP matcher scenario uses the plugin MCP tool's full Claude Code name and the server-prefix form `mcp__plugin_<plugin>_<server>__.*`.
- **MCP scenario form:** the `error` text and the model's script differ by implementation (`echo:ping` under the built-in MCP, `Error: echo:ping` under the adapter), so the MCP scenarios are an `@adapter-only` and `@builtin-only` pair, not one `@mcp` scenario. They leave out the built-in stand-in step, because the extension registers the failing wrapper itself (P4-DC-07).
- **Read failure:** the failed `read` reads a three-line file that the frozen plugin-file step writes into the published plugin, with an offset past its end (`Offset 9 is beyond end of file (3 lines total)`).
- **Interrupt scenario:** the script has exactly one model step (the bash call), because Pi makes no further model call after the abort.

### Scenarios

- **Built-in tool other than Bash:** a failed `read` whose error text is Pi's own and the same under every Node version, such as an offset past the end of a file the scenario writes. No scenario pins a Node `fs` errno message, because its wording differs between Node 24 and Node 26. A failed `edit` whose old text is missing is the alternative if `read` cannot be set up through existing steps.
- **Plugin MCP tool:** a failed call of a plugin MCP tool, `@mcp` so it runs under both implementations, or an `@adapter-only` and `@builtin-only` pair if the error text or the tool name differs by implementation (D-BG-04, DUAL-02). The failing tool comes from a stand-in that the verb module writes into the published plugin, because `features/lib/**` is frozen and the frozen stub servers always succeed. The planner prefers a small wrapper around the frozen stub server (`features/lib/mcp-stub-server.ts`) that marks each `tools/call` result `isError: true`, so the frozen listing waits and stand-in steps keep working; if the built-in stand-in or the listing waits cannot serve it under one implementation, the scenario narrows to the other with a dubious choice.
- **Matchers:** one scenario declares several PostToolUseFailure hooks on one failed call: a literal (`Read`), an alternation (`Read|Edit`), a matcher that does not select (`Write`), and for the MCP scenario the plugin MCP tool's Claude Code name and a `mcp__plugin_<plugin>_.*` pattern. The runs table states exactly the hooks that ran.
- **Both directions of the split:** a successful call with a PostToolUse and a PostToolUseFailure hook runs only PostToolUse; a failed call of a non-Bash tool with both runs only PostToolUseFailure.
- **Output:** one scenario per channel, each with the model's next call or the user's messages stated whole: `additionalContext` reaches the model after the tool result, `systemMessage` reaches the user as the hook's notice, exit 2 reaches the model as the blocking error with the hook's stderr, and a JSON `decision: "block"` reaches the model with its reason. Expected texts are what the bridge already renders for PostToolUse and PreToolUse under D-CF5-11; a mismatch with Claude Code's form is a product bug of this phase if it is in the failure arm.
- Scenarios carry no implementation tag unless they have an MCP surface (D-BG-04). Every expected value is a whole literal in the feature file.

### Claude's Discretion

- The exact step wording, the scenario count and grouping inside `hook/tool-failure.feature`, and whether one scenario covers several matchers or several output channels.
- Whether an `if` field row joins the matcher scenario (the bridge applies `if` to every tool event through `runAndFold`).
- The shape of the failing MCP stand-in and of the interrupt driver, inside the verb module, within the frozen-file rules.
- The plan count and wave split.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- `features/lib/hook-files.ts` (frozen): the recording-hooks table, with `form`, `output`, `stderr`, `exit code`, `if`, and `arguments` columns; script hooks print chosen stdout and stderr and exit with a chosen code.
- `features/step_definitions/hook/runs.steps.ts` (frozen): "the hooks record these runs:" states every recorded stdin field as a column (a field the table leaves out still shows up as a column), "in any order", and "the hooks record no runs".
- `features/step_definitions/hook/tool-use.steps.ts` (frozen): the stub MCP server "for its hooks", the adapter listing wait, and the scripted model's MCP call through the active implementation (`hookMcpCallScript`).
- `features/step_definitions/mcp-implementation.steps.ts` (frozen): the built-in stand-in registration and the implementation-aware listing wait.
- `features/step_definitions/session.steps.ts` (frozen): "the user prompts" sends an RPC `prompt` and waits for `agent_settled` with `aborted: false`; the interrupt step needs its own copy of that flow with an `abort` request.
- Model and user observation: "the model receives these calls:" and "the hooks show the user these messages:".

### Established Patterns

- `toolResultCompositeHandler` (`bridges/hooks/dispatch.ts`) reads `event.isError` once and picks the PostToolUseFailure or PostToolUse bucket (D-59-01); hooks run through `runAndFold`, which also applies `if`.
- `translatePostToolUseFailure` (`bridges/hooks/payloads/post-tool-use-failure.ts`) builds the payload; `test/architecture/hooks-translators.test.ts` checks the translator set.
- `adaptToolResultResult` (`bridges/hooks/event-adapters.ts`) turns a block into feedback after the kept tool output (D-CF5-11); `sendToolContext` sends `additionalContext`.
- `docs/hooks-compatibility.md` rows: a phase edits only the rows of its own event or field.

### Integration Points

- `pi-agent-core` `finalizeExecutedToolCall` runs `afterToolCall` (Pi's `tool_result`) for every executed call, aborted ones included; `ctx.signal` is the turn's abort signal.
- Pi's built-in MCP turns an MCP `isError` result into an error result (`pi-coding-agent/dist/extensions/mcp/tools.js`).

</code_context>

<specifics>
## Specific Ideas

- The red proof of each scenario goes into its plan SUMMARY: the interrupt scenario fails before D-BG-402, and the `is_interrupt` column fails before D-BG-401. A scenario that pins behavior that already works records its red proof by breaking the behavior temporarily (for example, routing a failure to PostToolUse) and restoring it.
- Parent lines to expect: a Key Decisions row for D-BG-401, D-BG-402, and D-BG-403; a CHANGELOG line for the cancelled-call fix and the `is_interrupt` field; a BACKLOG HOOKPAYLOAD-01 note that `is_interrupt` shipped.

</specifics>

<deferred>
## Deferred Ideas

- `tool_use_id`, `duration_ms`, and `mcp_server` in the tool payloads (BACKLOG HOOKPAYLOAD-01, D-CF5-28): they need a runs step that can state a varying value, which is a frozen-file change.
- The non-blocking hook error notice (BACKLOG HOOKERRNOTE-01).

</deferred>

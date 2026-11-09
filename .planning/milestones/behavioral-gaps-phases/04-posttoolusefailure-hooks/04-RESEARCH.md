# Phase 4: PostToolUseFailure Hooks - Research

**Researched:** 2026-11-08
**Domain:** Claude Code hook parity in the Pi hooks bridge (`tool_result` dispatch), cucumber behavioral tests with the scripted model, MCP stand-ins under two MCP implementations
**Confidence:** HIGH (every behavioral claim below was either read in the source this session or observed in a probe run; the probe outputs are quoted)

## Summary

The bridge already routes a failed tool result to the PostToolUseFailure bucket (`event.isError`), runs its matchers, builds the payload, and delivers every output channel in the same forms that PostToolUse uses. Probe runs this session confirmed this end to end for a failed `read` (payload, literal and `Read|Edit` alternation matchers, a non-selecting `Write` matcher, no PostToolUse run, exit 2, top-level `decision: "block"`, `systemMessage`) and for a failed plugin MCP tool under Pi's built-in MCP (payload, literal and server-prefix matchers, `additionalContext`).

The probes also found three product bugs in the PostToolUseFailure arm, one more than CONTEXT.md lists:

1. **D-BG-402 (confirmed):** when the user aborts a running Bash call, the bridge runs the PostToolUseFailure hooks with `error: "Command aborted"`. Pi reports `agent_settled` with `aborted: true` and makes no second model call.
2. **New, adapter only:** under pi-mcp-adapter, a plugin MCP tool whose server returns `isError: true` runs the **PostToolUse** hooks, not PostToolUseFailure. The tool response is `[{"type":"text","text":"Error: echo:ping"}]`. The cause is in pi-mcp-adapter: its tool returns no result-level `isError` and flips the flag in its own `tool_result` handler, which Pi runs after the extension's handler. The extension loads first in every profile Pi, and it can load first for a real user too. The planner must either fix this in `toolResultCompositeHandler` (recommended, a new decision ID) or narrow the MCP scenario to `@builtin-only` and record the gap.
3. **New, both implementations:** a PostToolUseFailure hook's `hookSpecificOutput.updatedToolOutput` replaces the failed result. Claude Code reads only `additionalContext` in the PostToolUseFailure branch. This is not one of the four channels that criterion 4 lists, so it is a candidate, not a requirement.

The error text of a failed plugin MCP call differs by implementation: `echo:ping` under the built-in MCP, and `Error: echo:ping` under the adapter, which adds its own `Error: ` prefix. The model's tool calls differ too: the adapter goes through the `mcp` proxy, and the built-in MCP needs `tool_search` first. So the MCP scenarios must be an `@adapter-only` and `@builtin-only` pair, not one `@mcp` scenario. The stand-in that this needs works without any frozen-file change: a wrapper script that the verb module writes into the published plugin. It runs the frozen stub server as a child and sets `isError: true` on every `tools/call` result. Probes showed that both the frozen listing wait and the scripted MCP call step work with it under both profiles. The built-in stand-in step is not needed, because the extension registers the plugin's own server, which is the wrapper.

**Primary recommendation:** Three sequential plans: (1) D-BG-401 `is_interrupt: false` in the translator and its three pinned tests, plus the unowned `tool-use.feature` row; (2) the new feature file and verb module with the non-MCP scenarios and the D-BG-402 guard; (3) the MCP pair, with the adapter failure-detection fix and, optionally, the `updatedToolOutput` fix.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Deciding a call failed and whether it was cancelled | Pi host (`pi-agent-core` `executePreparedToolCall`, `AgentSession._afterToolCall`) | Hooks bridge (`toolResultCompositeHandler` reads `event.isError` and `ctx.signal`) | Pi owns the tool result and the abort signal; the bridge only routes |
| Routing to the PostToolUseFailure vs PostToolUse bucket | Hooks bridge `bridges/hooks/dispatch.ts` | — | D-59-01 split, the one place that sees the result and the signal before hooks run |
| Payload (`error`, `is_interrupt`) | Hooks bridge `bridges/hooks/payloads/post-tool-use-failure.ts` | `dispatch-exec.ts` (serializes stdin) | Translator table per event |
| Output channels (context, block feedback, notices) | Hooks bridge `dispatch.ts` (`sendToolContext`, `showHookNotices`) and `event-adapters.ts` (`adaptToolResultResult`) | `hook-labels.ts` (texts) | Shared carriers, event-labeled |
| MCP tool error result | MCP implementation (Pi built-in `extensions/mcp/tools.js`, or pi-mcp-adapter `direct-tools.ts` + `error-signal.ts`) | — | The implementation converts the MCP `isError` result into a Pi tool result |
| Failing MCP server, interrupt driver | Cucumber verb module `features/step_definitions/hook/tool-failure.steps.ts` | Frozen libs (stub server, PiProcess, turn records) | `features/lib/**` is frozen (P4-DC-04) |

## User Constraints (from CONTEXT.md)

<user_constraints>

### Locked Decisions

#### Upstream contract (research, 2026-11-08)

Evidence: Claude Code 2.1.319 binary (`/home/linuxbrew/.linuxbrew/Caskroom/claude-code@latest/2.1.319/claude`, strings grepped 2026-11-08) and https://code.claude.com/docs/en/hooks (read 2026-11-08). Confidence high unless a line says otherwise.

- **When it fires.** Docs: "Runs when a tool that started executing fails: the tool threw an error, or an MCP tool returned an error result." It does not fire for an unknown tool, input that fails validation, or a permission denial. Binary: the runner `Q3t` is called only from the `catch` of a tool's `call`. Pi matches: its `afterToolCall` (the `tool_result` event) runs only for a call that executed; a missing tool, a validation failure, and a `tool_call` block return an immediate result with no `tool_result` event (`pi-agent-core` `prepareToolCall`).
- **A cancelled running tool.** Docs: "Cancelling a running tool does not fire this hook; the tool result carries the interruption message instead." Binary: the runner passes the turn's already-aborted signal to the hook runner and logs `PostToolUseFailure hook cancelled (parent abort)`. The bridge today runs the hooks on a cancelled call, because Pi still emits `tool_result` with `isError: true` when the user aborts a running tool, and `toolResultCompositeHandler` never reads the abort signal. This is the phase's product bug (D-BG-402).
- **Payload.** Binary (`XZo`): the common fields, then `hook_event_name`, `tool_name`, `tool_input`, `tool_use_id`, `error`, `is_interrupt` (always a boolean at every call site), `duration_ms`, and `mcp_server: {name, source}` for an MCP tool. Docs example: `"is_interrupt": false`, `"duration_ms": 4187`. Docs: `error` "is generally the same text Claude receives as the failed tool's result. Its format varies by tool and failure"; `is_interrupt` is "True when the failure reached Claude Code as an abort rather than as an error the tool reported."
- **Output.** Binary: the PostToolUseFailure branch reads only `hookSpecificOutput.additionalContext` (no `updatedToolOutput`, and `continue: false` is not acted on), and the generic path turns exit 2 and a top-level `decision: "block"` into a blocking error. Docs: exit 2 "Shows stderr to Claude; the tool already failed"; `additionalContext` is "added to Claude's context alongside the error"; the decision table lists PostToolUseFailure under top-level `decision: "block"`. The hook names its messages `PostToolUseFailure:<Tool>`.
- **Matcher.** Docs: "Matches on tool name, same values as PreToolUse" (`Bash`, `Edit|Write`, `mcp__.*`).

#### Payload fields

- **D-BG-401: the PostToolUseFailure payload gains `is_interrupt`, always `false`.** Upstream sends the boolean on every failure. With D-BG-402 the bridge never runs these hooks on a cancelled call, so every run it makes is a failure the tool reported, and `false` is the value Claude Code sends for one. Pi gives the `tool_result` event no interrupt bit of its own. This amends the PostToolUseFailure clause of D-CF5-28 for `is_interrupt` only, and the product change updates the expected row of the existing PostToolUseFailure scenario in the unowned `features/hook/tool-use.feature` (a column `is interrupt` with `false`), in a commit of its own, named in the SUMMARY. `docs/hooks-compatibility.md` gains or changes only the `is_interrupt` row.
- **D-BG-403: `tool_use_id`, `duration_ms`, and `mcp_server` stay out of the payload (D-CF5-28, BACKLOG HOOKPAYLOAD-01 unchanged).** The frozen runs step states every recorded stdin field as a whole literal, and the faux provider gives each tool call a random id and each run its own timing, so no scenario can state the first two. `mcp_server` would change the PreToolUse and PostToolUse payloads too (files no stream owns), and the value Claude Code sends as `name` for a plugin server is not verified (low confidence). The scenarios name D-CF5-28 where these fields are absent.
- `error` stays the text parts of the failed result, one per line: the same text Pi's model receives, which is the upstream rule ("generally the same text Claude receives"). Its wording is Pi's or the MCP server's, not Claude Code's `Exit code N` form (a Pi gap: Pi's tools word their own errors).
- The common fields stay `session_id`, `transcript_path`, and `cwd` (PAYL-01); no scenario adds a column for an absent field.

#### Cancelled calls (the product fix)

- **D-BG-402: a cancelled running tool runs no PostToolUseFailure hook, as Claude Code.** The `tool_result` handler runs no PostToolUseFailure hook when the result is an error and the turn's abort signal (`ctx.signal`) is aborted. The check sits in the PostToolUseFailure arm of `toolResultCompositeHandler` (`bridges/hooks/dispatch.ts`), before any hook of the bucket starts, so it also covers the bucket's async hooks. It is an additive guard on the failure arm only; the PostToolUse path and every other event are unchanged. A guard edit inside the shared function is logged as a dubious choice (P4-DC-02).
- A scenario interrupts a Bash call while its command runs: the model calls Bash with a command that first writes a marker file and then waits, the step sends Pi's RPC `abort` once the marker exists, and the turn ends aborted. Then neither a PostToolUseFailure nor a PostToolUse hook ran. The step lives in the verb module `hook/tool-failure.steps.ts`, because no frozen module can interrupt a turn. Without the fix the PostToolUseFailure hook records a run, so the scenario is red before the fix.

#### Scenarios

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

### Deferred Ideas (OUT OF SCOPE)

- `tool_use_id`, `duration_ms`, and `mcp_server` in the tool payloads (BACKLOG HOOKPAYLOAD-01, D-CF5-28): they need a runs step that can state a varying value, which is a frozen-file change.
- The non-blocking hook error notice (BACKLOG HOOKERRNOTE-01).

</user_constraints>

**Correction to a locked scenario detail (MATCH-02, not a new decision):** the CONTEXT matcher bullet asks for "a `mcp__plugin_<plugin>_.*` pattern". The bridge does not support that pattern. The probe install of a plugin with the matcher `mcp__plugin_hook-demo_.*` failed with `status: "partially-available"` and `reasons: ["unsupported hooks"]`. The only regex-shaped matcher it accepts is the server-prefix form `mcp__<server>__.*` [VERIFIED: `extensions/pi-claude-marketplace/domain/components/hooks/matcher.ts:4` `const SAFE_MATCHER_CHARS = /^[A-Za-z0-9_|-]+$/;` and `:33-40` `function mcpServerPrefix(token: string)` ... `if (!token.startsWith("mcp__") || !token.endsWith("__.*")) {`; `docs/hooks-compatibility.md:120-121` "MCP server prefix (`mcp__<server>__.*`) ... ✓" and "Other MCP wildcards (`mcp__*`, `mcp__<server>__get_.*`) ... ✗ ... regex -> unsupported"]. Use `mcp__plugin_hook-demo_stub-server__.*`, which a probe showed selects the call under the built-in MCP.

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TFAIL-01 | `PostToolUseFailure` hooks run on a failed tool call with Claude Code's payload, matchers select them by tool, and a `PostToolUse` hook does not run on the failure. | Criterion 1: the read probe and the built-in MCP probe (Probe results). Criterion 1 under the adapter needs the adapter failure-detection fix (Pitfall 2). Criterion 2: the read probe (`Read`, `Read\|Edit`, `Write`) and the built-in MCP probe (literal and server prefix). Criterion 3: both probes show no PostToolUse run on a failure; the success direction is in Scenario S4. Criterion 4: the read probe (exit 2, `systemMessage`) and the built-in MCP probe (`additionalContext`); the `decision: "block"` path is code-identical (Output channels). The `is_interrupt` change is D-BG-401, and the cancelled-call guard is D-BG-402. |

</phase_requirements>

## Project Constraints (from CLAUDE.md / AGENTS.md)

- Upstream parity is the default; a divergence needs a recorded decision ID or a Pi capability gap. A product bug that a scenario exposes is fixed in the phase's own files. A fix in a frozen file or in a sibling's file is a parent line and a dubious choice.
- A change to `/claude:plugin` behavior that a user can see ships with a cucumber scenario that fails without the change. Unit tests do not replace it.
- `npm run check` must stay green. It runs typecheck, ESLint (`--max-warnings 0`), fallow (dead code, health with `maxCognitive: 15` / `maxCyclomatic: 20`, dupes on every clone group, and the rule pack), Prettier, source/test pairing, `check:features`, unit tests, integration tests, both cucumber profiles, and 100% direct coverage (lines, functions, branches) for every source-test pair.
- Hook-dispatch shared files (`bridges/hooks/{dispatch,dispatch-exec,event-router,event-adapters,...}.ts`, `docs/hooks-compatibility.md`): a hook-event phase adds new code paths for its own event only, and never reshapes an existing function or reorders a shared table (ROADMAP Milestone rules). In `docs/hooks-compatibility.md` it edits only its own event's or option's rows.
- Frozen: `features/lib/**`, `features/support/**`, every existing step module (`hook/runs`, `hook/tool-use`, `hook/messages`, `session`, `model`, `mcp-implementation`, `plugin/publishing`, ...), `test/e2e/_rpc.ts`, `cucumber.json`, `scripts/check-features.mjs`, `.fallowrc.json`, `eslint.config.js`, `package.json`, `.agents/skills/cucumber/**`, and `platform/pi-api.ts`.
- Phase 4 owns: NEW `features/hook/tool-failure.feature`, NEW `features/step_definitions/hook/tool-failure.steps.ts`, `bridges/hooks/payloads/post-tool-use-failure.ts`, the PostToolUseFailure arm of the shared hook modules, and their unit pairs. The unowned `features/hook/tool-use.feature` may change only in the rows a product fix changes, in a commit of its own.
- Comments and test titles cite durable IDs (D-BG-401), never phase, plan, or wave numbers. Typed errors, no `console`, and `notify` only through `shared/notification-dispatch.ts`.
- Commit titles follow Conventional Commits with no milestone, phase, or plan identifier. No `--no-verify`. Every plan SUMMARY has `## Threat Flags`. WINDOWS descriptions start with `[behavioral-gaps]`.
- Never edited by a stream: `CHANGELOG.md`, `README*.md`, PROJECT.md Key Decisions, `.planning/BACKLOG.md`, and the root DUBIOUS-CHOICES log. These are "Parent lines" in the last SUMMARY.
- Hermetic home: no test or command may touch the real `~/.pi`.

## Standard Stack

No new dependency. The phase uses what the repository already has.

| Tool | Version | Purpose |
|------|---------|---------|
| `@earendil-works/pi-coding-agent` | 1.5.0 [VERIFIED: node_modules/@earendil-works/pi-coding-agent/package.json `"version": "1.5.0"`] | host: `tool_result` event, RPC `abort`, `ctx.signal` |
| `@earendil-works/pi-agent-core` | 1.5.0 [VERIFIED: its package.json `"version": "1.5.0"`] | agent loop, `finalizeExecutedToolCall` |
| pi-mcp-adapter | 7.0.0, the declared floor, installed into `node_modules/.cache/optional-peers` by `node scripts/install-test-peers.mjs` [VERIFIED: peers.log "Installed optional test peers pi-mcp-adapter@7.0.0 ..."] | the adapter profile |
| `@cucumber/cucumber` | ^13.3.0 [VERIFIED: package.json:19] | behavioral tests |
| `node:test` + `--experimental-test-coverage` | Node 26 locally, 24 in CI | unit tests, direct coverage |

## Package Legitimacy Audit

Not applicable: the phase installs no package. `scripts/install-test-peers.mjs` installs only the declared optional-peer floors, which are not new.

**Packages removed due to [SLOP] verdict:** none. **Packages flagged as suspicious [SUS]:** none.

## Architecture Patterns

### System Architecture Diagram

```text
scripted model (faux) ── tool call ──> pi-agent-core runLoop
                                          │
                                          ├─ prepareToolCall ── unknown tool / bad args / tool_call block ──> immediate result, NO tool_result event
                                          │
                                          └─ executePreparedToolCall (tool.execute with the turn's signal)
                                                │  throws  -> {content:[text], isError:true}
                                                │  returns -> isError = result.isError === true
                                                v
                                   finalizeExecutedToolCall -> afterToolCall -> AgentSession._afterToolCall
                                                v
                              ExtensionRunner.emitToolResult (handlers in extension LOAD ORDER,
                              each sees the event as earlier handlers changed it; ctx.signal = agent.signal)
                                   │                                       │
                    pi-claude-marketplace handler (loads first)     pi-mcp-adapter handler (loads later)
                    toolResultCompositeHandler                      toolErrorOverride(details) -> {isError:true}
                      ├─ stale generation? -> nothing
                      ├─ [D-BG-402] isError && ctx.signal.aborted -> nothing
                      ├─ [new] adapter active && details.error in {tool_error, call_failed} -> treat as failure
                      ├─ bucket = isError ? PostToolUseFailure : PostToolUse
                      ├─ toolEventView (Claude-form tool name; proxy rule)
                      ├─ runAndFold: matcher -> if -> dedupe -> parallel run -> fold
                      │      dispatchHookExec -> translatePostToolUseFailure -> hook stdin
                      ├─ showHookNotices  ("<label> says: <text>")           -> user (hook-notice entry)
                      ├─ sendToolContext   ("<label> hook additional context: ...") -> model, after the tool result
                      └─ adaptToolResultResult: block -> content + feedback; mutate -> updatedToolOutput patch
```

### Recommended file changes

```text
extensions/pi-claude-marketplace/bridges/hooks/
├── payloads/post-tool-use-failure.ts   # + is_interrupt: false after error (D-BG-401)
├── dispatch.ts                          # + cancelled-call guard (D-BG-402); + adapter failure detection (new ID)
└── event-adapters.ts                    # optional: mutate arm ignores updatedToolOutput when isError
test/bridges/hooks/
├── payloads/post-tool-use-failure.test.ts  # expected payloads gain is_interrupt: false
├── dispatch-exec.test.ts                   # PostToolUseFailure eventFields gain is_interrupt: false (exact stdin bytes)
├── dispatch.test.ts                        # new toolResultCompositeHandler cases
└── event-adapters.test.ts                  # optional, with the updatedToolOutput fix
features/hook/tool-use.feature              # unowned: one row gains `is interrupt` = false (own commit)
features/hook/tool-failure.feature          # NEW: Feature title must be "Hook tool failure"
features/step_definitions/hook/tool-failure.steps.ts  # NEW verb module, 2 steps
docs/hooks-compatibility.md                 # rows 17, 246 (and 266 if the updatedToolOutput fix lands)
```

### Pattern 1: The D-BG-402 guard

The guard goes in `toolResultCompositeHandler` [VERIFIED: `extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts:781-814`]. Today the split is the single line `const claudeEvent = event.isError ? "PostToolUseFailure" : "PostToolUse";` (`dispatch.ts:793`), and nothing in `bridges/hooks/` reads a signal (a grep for `signal` in the bridge matched only comments and `exec-timer.ts` kill signals).

`ctx.signal` is the turn's signal while the tool result is dispatched:

- `get signal() { runner.assertActive(); return runner.getSignalFn(); }` [VERIFIED: `node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/runner.js:662-664`]
- `getSignal: () => this.agent.signal,` [VERIFIED: `.../dist/core/agent-session.js:2836`]
- `get signal() { return this.activeRun?.abortController.signal; }` and `abort() { this.activeRun?.abortController.abort(); }` [VERIFIED: `node_modules/@earendil-works/pi-agent-core/dist/agent.js:217-222`]
- `ExtensionContext` declares `/** The current abort signal, or undefined when the agent is not streaming. */ signal: AbortSignal | undefined;`, which is not readonly [VERIFIED: `.../dist/core/extensions/types.d.ts:232` (interface start), `:258-259`]
- `finalizeExecutedToolCall` calls `config.afterToolCall({...}, signal)` after any `execute`, an aborted one included, and `executePreparedToolCall` turns a throw into `createErrorToolResult(...)` with `isError: true` [VERIFIED: `node_modules/@earendil-works/pi-agent-core/dist/agent-loop.js:574-627`]
- Pi's bash tool throws `Command aborted` on abort: `if (err instanceof Error && err.message === "aborted") { throw new Error(appendStatus(text, "Command aborted"));` [VERIFIED: `.../dist/core/tools/bash.js:270-271`]

Recommended shape: a new private function, so the closure stays flat (cognitive complexity ≤ 15 in both ESLint and fallow). Read `ctx.signal` only for a failed result:

```ts
// D-BG-402: Claude Code runs no PostToolUseFailure hook on a running tool the
// user cancelled; Pi still reports it as a failed result, under the turn's
// aborted signal.
function isCancelledFailure(isError: boolean, ctx: ExtensionContext): boolean {
  return isError && ctx.signal?.aborted === true;
}
...
    const claudeEvent = event.isError ? "PostToolUseFailure" : "PostToolUse";   // unchanged (or the failed flag below)
    const bucket = runtime.getRoutingBucket(claudeEvent);
    if (bucket.length === 0) {
      return undefined;
    }

    if (isCancelledFailure(event.isError, ctx)) {
      hookDebugLog("dispatch: PostToolUseFailure skipped on a cancelled call (D-BG-402)");
      return undefined;
    }
```

`hookDebugLog` is already imported (`dispatch.ts:56`). The guard comes after the empty-bucket check, so a session with no PostToolUseFailure hooks reads nothing new. It comes before `toolEventView`, `runAndFold`, `showHookNotices`, and `sendToolContext`, so it covers async hooks too.

### Pattern 2: The adapter failure detection (recommended fix, needs a new decision ID such as D-BG-404)

Evidence:

- The adapter's tool returns a failure with no result-level `isError`: `if (result.isError) { ... return { content: guarded.content, details: { error: "tool_error", server: spec.serverName, ...guardedMcpDetails(guarded) }, ...structuredContentOf(result), };` and the guard adds the prefix `...(result.isError ? { prefix: "Error: ", emptyTextFallback: "Tool execution failed" } : {}),` [VERIFIED: `node_modules/.cache/optional-peers/node_modules/pi-mcp-adapter/direct-tools.ts:330` and `:391-397`]
- It flips the flag later: `pi.on("tool_result", (event) => { return toolErrorOverride(event.details); });` [VERIFIED: `.../pi-mcp-adapter/index.ts:1873-1876`]. `toolErrorOverride` returns `{ isError: true }` for `code === "tool_error" || code === "call_failed" || code === INPUT_REQUIRED_NEEDS_UI || (typeof code === "string" && SCRIPT_TOOL_FAILURES.has(code))` [VERIFIED: `.../pi-mcp-adapter/error-signal.ts:32-40`]. Its own comment says "pi never reads a result-level `isError`", but Pi 1.5.0 does read it: `return { result, isError: result.isError === true, durationMs };` [VERIFIED: `node_modules/@earendil-works/pi-agent-core/dist/agent-loop.js:580-587`].
- Pi runs `tool_result` handlers in extension order, and each sees the earlier handlers' changes: `for (const { ext, handlers } of snapshotEventHandlers(this.extensions, "tool_result"))` ... `if (handlerResult.isError !== undefined) { currentEvent.isError = handlerResult.isError;` [VERIFIED: `.../pi-coding-agent/dist/core/extensions/runner.js:900-928`].
- Every harness Pi loads the extension first: `const extensions = [EXTENSION_ENTRY, ...extraExtensions];` [VERIFIED: `test/e2e/_rpc.ts:282`].
- Probe (adapter profile, wrapper stand-in, hooks `failure`/`prefixed` PostToolUseFailure and `after` PostToolUse on `mcp__plugin_hook-demo_stub-server__echo`): the only run was `PostToolUse ['after'] {"hook_event_name": "PostToolUse", "tool_name": "mcp__plugin_hook-demo_stub-server__echo", "tool_input": {"text": "ping"}, "tool_response": [{"type": "text", "text": "Error: echo:ping"}]}`, and the model read `mcp failed: Error: echo:ping` [VERIFIED: probe run this session, `probe-out.jsonl`].

Recommended fix: a new private predicate in `dispatch.ts`. Read the details first, and call `tools.proxyRuleApplies()` only when a failure code is present. The existing proxy-rule tests pin the exact sequence of view reads (`test/bridges/hooks/dispatch.test.ts:3185-3196` `createProxyRuleView`, and the `reads: [...]` rows from `:3198`), so any extra read on an ordinary result would break them.

```ts
// D-BG-404 (proposed): pi-mcp-adapter returns a failed MCP call with no
// result-level isError and marks it in its own tool_result handler, which Pi
// runs after this one when this extension loads first. While the adapter is
// the active implementation, its failure codes count as a failure.
const ADAPTER_FAILURE_CODES: ReadonlySet<string> = new Set(["tool_error", "call_failed"]);

function adapterReportsFailure(event: ToolResultEvent, tools: HookToolView): boolean {
  const details: unknown = event.details;
  const code = typeof details === "object" && details !== null ? (details as { readonly error?: unknown }).error : undefined;
  return typeof code === "string" && ADAPTER_FAILURE_CODES.has(code) && tools.proxyRuleApplies();
}
```

In the closure, compute `const failed = event.isError || adapterReportsFailure(event, tools);` and pass `failed === event.isError ? event : { ...event, isError: true }` on to `toolEventView` and every later step. `withFeedback` labels the block with `event.isError ? "PostToolUseFailure" : "PostToolUse"` [VERIFIED: `event-adapters.ts:285-288`]. So the view event must carry `isError: true`, or a block from a PostToolUseFailure hook would be labeled `PostToolUse:...`. The handler's return value never sets `isError` itself (a `block` returns only `content`), so the adapter's own later flip still decides what Pi records.

Whether to mirror the adapter's full code set (also `input_required_needs_ui` and the script-tool codes) is a choice. The two codes above are the MCP call failures. The others belong to the adapter's own tools.

**Fallback if the planner rejects the fix:** make the adapter MCP scenario stay out, keep a `@builtin-only` scenario, log a dubious choice, and add a BACKLOG parent line ("under pi-mcp-adapter a failed plugin MCP call runs PostToolUse hooks").

### Pattern 3: The failing MCP stand-in (in the verb module)

Probe-validated under both profiles, with the frozen steps `pi runs with the scripted model and the mcp implementation`, `the mcp implementation has listed the tools of the stub mcp server {string} of the plugin {string}`, and `the scripted model calls the tool {string} of the hooks' stub mcp server {string} of the plugin {string} through the mcp implementation with {string}, then replies {string}`. No built-in stand-in step was used.

- The frozen stub answers `tools/call` with `return { content: [{ type: "text", text: echoed }] };` where `echoed` is `echo:${text}` [VERIFIED: `features/lib/mcp-stub-server.ts:146-152`]. It logs to `mcp-stub-requests.jsonl` and keeps `mcp-stub-<pid>.pid` (`:30`, `:180`), and the listing waits read those (`features/lib/mcp-implementation.ts:488-505`). A wrapper that runs the stub as a child keeps both working. The adapter's listing closes the wrapper's stdin, the wrapper ends the child's stdin, and the child removes its pid file.
- The built-in stand-in skips a name that Pi already has registered ("It skips a server when Pi already has a registration of ... comparing names with `-` and `_` folded", `features/lib/builtin-mcp-stand-in/extension.ts:11-14`). The extension registers the plugin's own `.mcp.json` server, which is the wrapper. So the stand-in step `a stand-in registers the stub mcp server ...` is neither needed nor harmful. **Recommend leaving it out** of the failing-MCP scenarios, so that only the plugin's own (failing) server can serve the call.
- Pi's built-in MCP turns an `isError` result into an error result: `/** Convert an MCP result. \`isError\` results become error results that keep the structured result. */ ... ...(result.isError ? { isError: true } : {}),` [VERIFIED: `node_modules/@earendil-works/pi-coding-agent/dist/extensions/mcp/tools.js:202-216`].

Wrapper text (probe-validated; write it as a file in the published plugin, run with `process.execPath`):

```js
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
const [stub, plugin, server] = process.argv.slice(2);
const child = spawn(process.execPath, [stub, plugin, server], { stdio: ["pipe", "pipe", "inherit"] });
const calls = new Set();
createInterface({ input: process.stdin }).on("line", (line) => {
  try { const m = JSON.parse(line); if (m.method === "tools/call" && m.id !== undefined) calls.add(JSON.stringify(m.id)); } catch {}
  child.stdin.write(line + "\n");
}).on("close", () => child.stdin.end());
createInterface({ input: child.stdout }).on("line", (line) => {
  let out = line;
  try { const m = JSON.parse(line); if (m.result !== undefined && calls.delete(JSON.stringify(m.id))) { m.result.isError = true; out = JSON.stringify(m); } } catch {}
  process.stdout.write(out + "\n");
});
child.on("exit", (code) => process.exit(code ?? 0));
```

Its `.mcp.json`: `{ mcpServers: { [server]: { command: process.execPath, args: [<abs wrapper path>, MCP_STUB_SERVER, plugin, server] } } }`. Write both files with `writePublishedPluginFiles(published, plugin, {...})` [VERIFIED: `features/lib/published-marketplace.ts:719-736`], and assert the written text, as `hook/tool-use.steps.ts:85-94` does. The wrapper path is `path.join(published.root, "plugins", plugin, "<file>")`, the same join that `tool-use.steps.ts:91` uses. When writing the wrapper as a TypeScript string, escape `\n` as `\\n`, as the probe did. Consider adding `child.on("error", () => process.exit(1))`.

Proposed step: `Given the published plugin {string} of the marketplace {string} has the stub mcp server {string} for its hooks, whose tool calls fail`. It has the word `mcp`, so every scenario that uses it needs an implementation tag (`scripts/check-features.mjs:46` `const mcpStepWord = /\bmcp\b/i;`).

### Pattern 4: The interrupt driver (in the verb module)

Pi side:

- RPC `case "abort": { await session.abort(); return success(id, "abort"); }` [VERIFIED: `.../dist/modes/rpc/rpc-mode.js:327-330`]. `abort()` sets `_agentRunAbortRequested`, calls `agent.abort()`, then `await this.waitForIdle();` [VERIFIED: `.../dist/core/agent-session.js:1989-2000`]. So the abort response arrives after the turn settled. `_emitAgentSettled` emits `{ type: "agent_settled", aborted }` [VERIFIED: `agent-session.js:696-703`].
- The bash tool spawns `detached: process.platform !== "win32"` and on abort calls `killProcessTree(child.pid)` [VERIFIED: `.../dist/core/tools/bash.js:63-68`, `:78-81`, `:95-100`]. RPC shutdown on stdin end does not kill tracked children (`rpc-mode.js:579-596`, `:638-642`). So a command that outlives a failed scenario survives Pi's release unless it is bounded.
- Probe: abort response `{"id":"r10","type":"response","command":"abort","success":true}`; settled `{"type":"agent_settled","aborted":true}`; `tool_execution_end` result `{"content":[{"type":"text","text":"Command aborted"}],"details":{}}`, `"isError": true`; today the PostToolUseFailure hook `failure` ran with `"error": "Command aborted"` and the PostToolUse hook `after` did not; **only one model call** was made (`[["1","user","run the slow command"]]`). The After hook failed the probe with "no model call used these steps of the model script" for a second `Done.` step [VERIFIED: probe run this session]. **So the interrupt scenario's script has exactly one row, the bash call.**

Harness side. These are the "the user prompts" helpers from the frozen `features/step_definitions/session.steps.ts:98-128`:

| Helper | Exported from a frozen lib? | Use in the verb module |
|--------|----------------------------|-------------------------|
| `promptDisposition(response)` | yes, `test/e2e/_rpc.ts` (session.steps.ts:28 and prompt-and-stop.steps.ts:30 import it) | import |
| `DIALOG_METHODS` | yes, `features/lib/pi-process.ts:69-74` `export const DIALOG_METHODS` | import (prompt-and-stop re-declares it; do not copy that) |
| `RpcRecord` type | yes, `features/lib/pi-process.ts:30` | import type |
| `expandTokens` | yes, `features/lib/run-tokens.ts` | import |
| `modelCallsOf(logs)` | yes, `features/lib/scripted-model/script.ts:294` | import |
| `readLogLengths`, `readLogLinesSince` | yes, `features/lib/turn-records.ts:42`, `:55` | import |
| `ScenarioWorld`, `ModelTurn` types | yes, `features/support/world.ts:198`, `:191-196` | import type |
| world: `profileHarness()`, `recordTurn(turn)`, `requireTurn()`, `tokens.projectDir`, `onRelease()`, `pi.recordCount()`, `pi.request()`, `pi.waitForRecord(from, match, ms)`, `pi.recordsSince(from)` | public members (`world.ts:785-822`; `pi-process.ts:169-238`) | use |
| `isTurnFault` | **private** (session.steps.ts:56-63) | re-implement |
| `MODEL_TURN_TIMEOUT_MS` (20 s) | **private** (session.steps.ts:45) | own constant |
| the overflow check (`modelCallsOf(logs).filter((call) => call.overflow)`) | **private**, inline (session.steps.ts:121-126) | re-implement |
| `settledAfter`, `startPrompt`, `checkedRun`, `recordRun`, `isFault` | **private** (prompt-and-stop.steps.ts:54-123) | re-implement in a different shape (fallow dupes) |

`PiProcess.request` throws while another request is in flight (`pi-process.ts:221-224`). The prompt's response arrives before the turn runs (`rpc-mode.js:297-316`), so the abort request can follow it. The default step timeout is 30 s (`features/support/world.ts:88` `const STEP_TIMEOUT_MS = 30_000;`). `request()` has no timeout of its own, so keep every wait under about 20 s.

Recommended step (sketch):

```ts
// When the user prompts {string} and interrupts the turn once the command has created {string}
async function (this: ScenarioWorld, text: string, marker: string): Promise<void> {
  const prompt = expandTokens(text, this.tokens);
  const harness = this.profileHarness();
  const markerFile = path.join(this.tokens.projectDir, marker);      // bash runs in {project dir}
  this.onRelease(() => rm(markerFile, { force: true }));             // ends the command's wait loop on any failure
  const lengths = await readLogLengths(harness);
  const from = this.pi.recordCount();
  const { response } = await this.pi.request({ type: "prompt", message: prompt });
  assert.strictEqual(promptDisposition(response), "started", JSON.stringify(response));
  await waitForFile(markerFile, deadline);                           // poll every ~50 ms, fail at the deadline
  const { response: aborted } = await this.pi.request({ type: "abort" });
  assert.strictEqual(aborted.success, true, JSON.stringify(aborted));
  const settled = await this.pi.waitForRecord(from, (r) => r.type === "agent_settled", ...);
  assert.strictEqual(settled.aborted, true, JSON.stringify(settled));
  // faults (extension_error, dialogs via DIALOG_METHODS), then logs, overflow check, recordTurn
}
```

Script row (no braces in the command, because a script cell goes through `expandTokens`; bounded to about 20 s; the loop ends as soon as the release removes the marker):

```gherkin
    Given the scripted model plays these steps:
      | reply | tool | arguments                                                                                                                     |
      |       | bash | {"command": "touch tool-running; i=0; while [ -e tool-running ] && [ $i -lt 200 ]; do sleep 0.1; i=$((i+1)); done"} |
    When the user prompts "run the slow command" and interrupts the turn once the command has created "tool-running"
    Then the hooks record no runs
```

`Then the hooks record no runs` (frozen, `hook/runs.steps.ts:163-166`) marks the turn compared. The scenario may also state `Then the model receives these calls:` with the single row `| 1 | user | run the slow command |` (verified by the probe).

### Anti-Patterns to Avoid

- **A `mcp__plugin_<plugin>_.*` matcher:** unsupported by MATCH-02. The install becomes `partially-available` with `unsupported hooks`. Use `mcp__<server>__.*`.
- **One `@mcp` scenario for the failing MCP call:** the `error` cell differs (`Error: echo:ping` vs `echo:ping`). So does the model's script (the `mcp` proxy vs `tool_search` then the tool).
- **Copying `isTurnFault` / `startPrompt` blocks from frozen step modules:** `fallow dupes` fails on every clone group. Import the shared libs and write the flow in a different shape. Run `npx fallow dupes` before committing.
- **Spreading `createExtensionContext(...)` in a unit test** (`{ ...createExtensionContext(cwd), signal }`): the fake has throwing getters for `ui` and `modelRegistry` (`test/bridges/hooks/dispatch.test.ts:84-124`), and a spread calls them.
- **Reading `tools.proxyRuleApplies()` on every result:** the proxy-rule test rows pin the exact read sequence. Read it only when a failure code is present.
- **A bare `sleep 30` in the interrupt command:** a scenario that fails before the abort would leave it running after Pi stops, because bash children are detached.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Waiting for the turn to settle | sleeps | `this.pi.waitForRecord(from, r => r.type === "agent_settled", ms)` | event-driven, rejects with Pi's stderr |
| Reading hook runs, model calls, notices | custom log readers | frozen steps `the hooks record these runs[ in any order]:`, `the hooks record no runs`, `the model receives these calls:`, `the model receives these calls, with each tool search reduced to the tools it loads:`, `the hooks show the user these messages:` | they project tokens and session ordinals, and mark the turn compared |
| A file with known content for `read` | a new file-writing step | `the published plugin {string} of the marketplace {string} has the file {string} with this text:` (`plugin/publishing.steps.ts:328-339`) | frozen, asserts what it wrote |
| The model's MCP call under both implementations | per-profile script tables | the frozen `the scripted model calls the tool ... through the mcp implementation with ..., then replies ...` (`hook/tool-use.steps.ts:111-126`, `features/lib/hook-mcp-calls.ts:33-52`) | it picks `mcp` or `tool_search` + the tool from `profileFor(profile).toolName` |
| The MCP server's protocol | a new MCP server | wrap the frozen `features/lib/mcp-stub-server.ts` | its log and pid file keep the frozen listing waits working |

## Runtime State Inventory

Not a rename or migration phase. Section omitted.

## Common Pitfalls

### Pitfall 1: The interrupt script has one step, not two
**What goes wrong:** a `| Done. |` row after the bash call fails the scenario with "no model call used these steps of the model script" (`features/support/world.ts:1188-1192`).
**Why:** after an aborted tool, the agent loop makes no further model call (probe: one call).
**How to avoid:** script only the bash row.

### Pitfall 2: Under pi-mcp-adapter a failed MCP call is not `isError` when the extension's handler runs
**What goes wrong:** the PostToolUse hooks run, and the PostToolUseFailure hooks do not.
**Why:** the adapter flips `isError` in a later `tool_result` handler (Pattern 2).
**How to avoid:** the adapter failure-detection fix, or narrow to `@builtin-only` with a dubious choice and a BACKLOG parent line.
**Warning sign:** the adapter scenario's runs table shows `PostToolUse` with `tool response` `[{"type":"text","text":"Error: echo:ping"}]`.

### Pitfall 3: `dispatch-exec.test.ts` pins the exact stdin bytes
**What goes wrong:** D-BG-401 breaks `dispatches the PostToolUseFailure translator with exact stdin bytes`.
**Why:** `const expectedStdin = JSON.stringify(expectedPayload);` with `...translatorCase.eventFields` [VERIFIED: `test/bridges/hooks/dispatch-exec.test.ts:812-819`], and the PostToolUseFailure case's `eventFields: { tool_name: "Bash", tool_input: { command: "false" }, error: "exit 1", }` [VERIFIED: `:682-700`]. Key order matters.
**How to avoid:** add `is_interrupt: false` after `error` in both the translator object literal and `eventFields`. Upstream's order is `tool_use_id, error, is_interrupt, duration_ms` (binary `XZo`), so `is_interrupt` directly after `error` is the upstream order with the deferred fields left out.

### Pitfall 4: The runs step shows every stdin field as a column
**What goes wrong:** any PostToolUseFailure runs table without `is interrupt` fails after D-BG-401. Before D-BG-401, a table with it fails.
**Why:** `[STDIN_COLUMNS[key] ?? key.replaceAll("_", " "), cell(value, tokens, ordinals)]` with `cell` = `JSON.stringify(value)` for a non-string [VERIFIED: `features/step_definitions/hook/runs.steps.ts:81-94`, `:96-112`]. `recordTable` puts the stated columns first, then the unstated ones [VERIFIED: `features/lib/field-rows.ts:88-99`].
**How to avoid:** every PostToolUseFailure row states `is interrupt` = `false`. A PostToolUse row in the same table leaves the cell empty.

### Pitfall 5: The fold keeps only the first block
**What goes wrong:** one scenario with both an exit-2 hook and a `decision: "block"` hook shows only the first block's feedback (probe: the `exit` hook's feedback alone).
**Why:** "else the first `block`" (`dispatch.ts:29-30` header).
**How to avoid:** one scenario per blocking channel, as CONTEXT already says.

### Pitfall 6: Upstream wording in expected cells
**What goes wrong:** `the model receives these calls:` would pin Pi's `tool_search` text (`Loaded 1 tool. They are available from your next call: ...`), and the adapter's `Error: ` prefix shows up in the hook's `error` field.
**How to avoid:** in the `@builtin-only` scenario, use the frozen `the model receives these calls, with each tool search reduced to the tools it loads:` if it states calls at all. The MCP pair can state only the runs table, which proves criteria 1 and 2. The `error` cell must hold the implementation's text. There is a precedent for that: `(no output)\n\nCommand exited with code 3` in `tool-use.feature:623` is Pi's text. Log it as a dubious choice.

### Pitfall 7: The read error is Pi's own and Node-independent
`throw new Error(\`Offset ${offset} is beyond end of file (${allLines.length} lines total)\`);` [VERIFIED: `.../dist/core/tools/read.js:120`]. The line count is `textContent.split("\n").length` (`read.js:111-113`). A doc string has no trailing newline, so `one\ntwo\nthree` counts 3. Probe: `"error": "Offset 9 is beyond end of file (3 lines total)"`. `projectReadResult(text, failed)` returns a failed text unchanged (`features/lib/upstream/pi.ts:23-26`).

## Code Examples

### Probe-verified expected rows (Read, project scope)

Hooks for a failing `read` (the probe used these and got the runs shown):

```gherkin
    Given the published plugin "demo" of the marketplace "fixtures" has the file "notes.txt" with this text:
      """
      one
      two
      three
      """
    Given the scripted model plays these steps:
      | reply | tool | arguments                                                                    |
      |       | read | {"path": "{home}/marketplaces/fixtures/plugins/demo/notes.txt", "offset": 9} |
      | Done. |      |                                                                              |
```

Expected PostToolUseFailure run (after D-BG-401). Column order is free, and the env columns are as in `tool-use.feature:622`:

| event | session | tool name | tool input | error | is interrupt | cwd | transcript path | arguments | CLAUDE_PROJECT_DIR | CLAUDE_PLUGIN_ROOT | CLAUDE_PLUGIN_DATA | CLAUDE_CODE_SESSION_ID | CLAUDE_SESSION_ID | CLAUDECODE |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| PostToolUseFailure | first | Read | `{"path":"{home}/marketplaces/fixtures/plugins/demo/notes.txt","offset":9}` | `Offset 9 is beyond end of file (3 lines total)` | false | {project dir} | (empty) | `<hook name>` | {project dir} | {home}/marketplaces/fixtures/plugins/demo | {project dir}/.pi/pi-claude-marketplace/data/fixtures/demo | first | first | 1 |

Probe: `Read` and `Read|Edit` (in Gherkin, write the cell `Read\|Edit`) ran; `Write` and the PostToolUse `Read` hook did not [VERIFIED: probe].

### Output channels (the bridge's text, compared with Claude Code)

| Channel | Bridge renders (code path) | Expected text in a scenario | Claude Code 2.1.319 | Verdict |
|---------|---------------------------|-----------------------------|---------------------|---------|
| `hookSpecificOutput.additionalContext` | `sendToolContext` → hidden custom message `` `${label} hook additional context: ${context}` ``, `triggerTurn: false` (`dispatch.ts:605-628`); label `hookEventLabel(claudeEvent, view.event.toolName)` (`dispatch.ts:807`, `hook-labels.ts:29-33`) | a `user` row after the tool result: `PostToolUseFailure:Read hook additional context: <text>` (probe-verified for MCP: `PostToolUseFailure:mcp__plugin_hook-demo_stub-server__echo hook additional context: checked the error`) | `hook_additional_context` attachment, `` `${e.hookName} hook additional context: ` ``, hookName `` `PostToolUseFailure:${n.name}` `` (binary `Q3t`) | match (D-CF5-13) |
| exit 2 + stderr | `adaptToolResultResult` block → `[...event.content, feedback]` (`event-adapters.ts:282-298`, `:318-321`); `hookBlockingErrorText` = `` `${label} hook blocking error from command: "${command}": ${blockMessage(...)}` `` with `` `[${command}]: ${reason}` `` for stderr (`hook-labels.ts:48-68`) | `read failed: Offset 9 is beyond end of file (3 lines total)\nPostToolUseFailure:Read hook blocking error from command: "${CLAUDE_PLUGIN_ROOT}/hooks/exit.sh": [${CLAUDE_PLUGIN_ROOT}/hooks/exit.sh]: check the error` (**probe-verified**, single `\n` joiner, hook named `exit`, stderr `check the error`) | `hook_blocking_error`: `` `${e.hookName} hook blocking error from command: "${e.blockingError.command}": ${e.blockingError.blockingError}` ``, a meta message after the tool result | text match. Placement inside the tool result content is the existing D-CF5-11 choice, the same as PostToolUse (`tool-use.feature:518`). No failure-arm bug |
| top-level `{"decision":"block","reason":"..."}` | same block path, with `blockMessage(reason, command, false)` = the reason | `read failed: Offset 9 is beyond end of file (3 lines total)\nPostToolUseFailure:Read hook blocking error from command: "${CLAUDE_PLUGIN_ROOT}/hooks/<name>.sh": <reason>` (code-derived; in the probe the exit-2 hook won the fold) | generic `decision: "block"` → blockingError | match |
| `systemMessage` | `showHookNotices` → `hook-notice` entry, `` `${label} says: ${text}` ``, info; `showsSystemMessages` includes `"PostToolUseFailure"` (`dispatch.ts:454-466`, `hook-labels.ts:94-96`) | `the hooks show the user these messages:` row `\| info \| PostToolUseFailure:Read says: read failed \|` (**probe-verified**) | `${hookName} says: ${content}` | match |
| `hookSpecificOutput.updatedToolOutput` | `mutate` → `toolResultPatch(result.updatedToolOutput)` for both tool-result events (`event-adapters.ts:169-185`, `:323-324`; `wire-protocol.ts:272-274` parses it with no event check) | — | the PostToolUseFailure branch reads only `additionalContext`: `case"PostToolUseFailure":Y.additionalContext=e.hookSpecificOutput.additionalContext;break;` (binary) | **mismatch in the failure arm (candidate)**. Fix: in the `mutate` arm, return `undefined` (debug line) when `event.isError`. Add a scenario: "a PostToolUseFailure hook's updatedToolOutput leaves the error the model reads". Row 266 of the doc changes |
| `continue: false` | `stop` → debug line only (`event-adapters.ts:326-330`) | — | not acted on | match |

Frozen observation steps: `Then the model receives these calls:` (columns `call`, `role`, `text`, `model.steps.ts:97-104`), `Then the hooks show the user these messages:` (columns `severity`, `text`, `hook/messages.steps.ts:81-92`), and the hooks table `the published plugin {string} of the marketplace {string} has these hooks, each recording its runs:` with the required leading columns `name | event | matcher`, then any of `form`, `output`, `stderr`, `exit code`, `if`, `arguments`, ... A script hook's command is `${CLAUDE_PLUGIN_ROOT}/hooks/<name>.sh` (`features/lib/hook-files.ts:17-18`, `:119-215`, `:432`).

### Built-in MCP probe rows (`@builtin-only`, user scope)

```text
RUN PostToolUseFailure ['failure']  tool_name mcp__plugin_hook-demo_stub-server__echo, tool_input {"text":"ping"}, error "echo:ping"
RUN PostToolUseFailure ['prefixed'] (matcher mcp__plugin_hook-demo_stub-server__.*) same payload
CALL 3 tool result: mcp__plugin_hook_demo_stub_server__echo failed: echo:ping
CALL 3 user: PostToolUseFailure:mcp__plugin_hook-demo_stub-server__echo hook additional context: checked the error
```

The hook's tool name is the Claude form under both implementations (D-P5-03, `claudeFormToolName` in `toolEventView`, `dispatch.ts:945-956`). Env cells: `CLAUDE_PLUGIN_ROOT` `{home}/marketplaces/fixtures/plugins/hook-demo`, `CLAUDE_PLUGIN_DATA` `{agent dir}/pi-claude-marketplace/data/fixtures/hook-demo` (as `hook/mcp-tool-names.feature`). Adapter (after the fix): `error` `Error: echo:ping`. Probe step order (both profiles): publish, offer, hooks table, failing server step, `the marketplace "fixtures" is added to the user scope`, `the user has run "/claude:plugin install hook-demo@fixtures --scope user", which did not fail`, `pi runs with the scripted model and the mcp implementation`, `the mcp implementation has listed the tools of the stub mcp server "stub-server" of the plugin "hook-demo"`, the MCP call step, `the user prompts "call the stub"`.

### The D-BG-401 translator change

```ts
// Source: extensions/pi-claude-marketplace/bridges/hooks/payloads/post-tool-use-failure.ts:21-29, :47-55 (current)
export interface PostToolUseFailureStdin {
  ...
  readonly error: string;
  readonly is_interrupt: false;   // D-BG-401
}
  return {
    ...
    error: errorText(event.content),
    is_interrupt: false,
  };
```

Also update the file header comment (`:13-14` currently says "`tool_use_id`, `is_interrupt`, and `duration_ms` are not sent (D-CF5-28)").

### Existing rows that change

- `features/hook/tool-use.feature:622-623` (unowned; own commit). Header `| event | session | tool name | tool input | error | cwd | ...` gains `| is interrupt |` after `error`, and the row gains `| false |`. Current row: `| PostToolUseFailure | first | Bash | {"command":"exit 3"} | (no output)\n\nCommand exited with code 3 | {project dir} | | failure | ...` [VERIFIED: read this session].
- `test/bridges/hooks/payloads/post-tool-use-failure.test.ts:31-39` and `:73-84`: `expectedPayload` gains `is_interrupt: false`.
- `test/bridges/hooks/dispatch-exec.test.ts:696-700`: `eventFields` gains `is_interrupt: false` after `error`.
- `test/architecture/hooks-translators.test.ts` checks only `tool_name` and the export set (`:126-160`), so it needs **no change**.
- No other feature, integration, or e2e test states a PostToolUseFailure payload. A grep of `features/`, `test/integration/`, and `test/e2e/` found only `tool-use.feature`.
- `docs/hooks-compatibility.md:246`, current notes cell: "the text parts of the failed tool's result, one per line; an image part is left out. As upstream, the payload has no `tool_response`. `is_interrupt` and `duration_ms` are not sent (D-CF5-28)". Change only the last sentence, for example: "`is_interrupt` is always `false`, because the bridge runs no PostToolUseFailure hook on a cancelled call (D-BG-401, D-BG-402); `duration_ms` is not sent (D-CF5-28)". Row 17 (`| \`PostToolUseFailure\` | ✓ | ✓ | tool-name matcher and \`if\` field |`) may gain "; a cancelled call runs none (D-BG-402)". These are the phase's own event rows.

## State of the Art

| Old | Current | Impact |
|-----|---------|--------|
| PostToolUseFailure payload without `is_interrupt` (D-CF5-28) | `is_interrupt: false` (D-BG-401) | the existing row gains a column |
| Hooks run on a cancelled call | none run (D-BG-402) | new guard |
| Pi's `afterToolCall` context carries no duration (`config.afterToolCall({ assistantMessage, toolCall: prepared.toolCall, args: prepared.args, result, isError, context: currentContext }, signal)`, `agent-loop.js:609-616`), although `executed.durationMs` exists | `duration_ms` stays out | D-BG-403 also rests on a Pi gap: `tool_result` has no duration |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | V8 block coverage counts the right operand of `&&` as a branch, so the guard needs a case where `isError` is true and the signal is aborted, and an existing case already covers `isError` true with no signal | Validation | a coverage shortfall shows up in `test:coverage:direct`. Low risk: run the pair's coverage |
| A2 | Mirroring only `tool_error` and `call_failed` is enough for plugin MCP calls through the adapter | Pattern 2 | an adapter script-tool failure still routes to PostToolUse. Out of scope for this phase |
| A3 | A real user's Pi may load pi-mcp-adapter after this extension (load order follows settings) | Pattern 2 | if the adapter always loaded first, the fix would matter only in the harness. It is harmless in either order |
| A4 | `fallow dupes` will not flag the verb module if it imports the shared helpers and does not copy the private blocks | Anti-patterns | a clone group fails `npm run fallow`. Restructure, or add a reviewed `fallow-ignore-next-line code-duplication` marker with a reason |

## Open Questions

1. **Fix the adapter routing in this phase, or narrow to `@builtin-only`?**
   - What we know: the bug is real (probe). The fix is local to `toolResultCompositeHandler` and new private functions. It changes the D-59-01 split line, which is a shared-function edit.
   - Recommendation: fix it under a new ID (D-BG-404), log a dubious choice next to P4-DC-02, and add a parent line warning Phase 2's merge about this function.
2. **Include the `updatedToolOutput` failure-arm fix?**
   - What we know: a mismatch confirmed in the binary and in the code. Criterion 4 does not list this channel.
   - Recommendation: include it, with its own scenario and a one-arm change in `adaptToolResultResult`, and a dubious choice, because the bug policy says a phase fixes the bugs its arm exposes. If the plan budget is tight, a BACKLOG parent line instead.
3. **Optional `if` row.** `runAndFold` applies `if` through `matchingHooks` (`dispatch.ts:421-436`). An `if: Read(*notes.txt)`-style row is the planner's choice. It is not needed for TFAIL-01.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | everything | ✓ | 26 locally; CI 24 | — (no Node errno text pinned) |
| Pi | profile Pis | ✓ | 1.5.0 | — |
| pi-mcp-adapter (optional peer cache) | adapter profile | ✓ (installed this session by `node scripts/install-test-peers.mjs`, about 10 s, needs network) | 7.0.0 | `npm run test:cucumber*` runs the install first |
| bash, `touch`, `sleep`, `[` | interrupt command | ✓ | — | the command avoids `seq` and braces |
| Claude Code binary | parity reading | ✓ | 2.1.319 | strings dump at `<scratchpad>/claude-strings.txt` |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | cucumber-js ^13.3.0 (profiles `adapter`, `builtin`); `node:test` |
| Config file | `cucumber.json` (frozen); `package.json` scripts (frozen) |
| Quick run command | `npm run test:cucumber:profile -- --profile adapter features/hook/tool-failure.feature` (about 20 s per scenario; the probe's 3 scenarios took 46 s wall) |
| Builtin run | `npm run test:cucumber:profile -- --profile builtin features/hook/tool-failure.feature` (runs only the `@mcp`/`@builtin-only` scenarios) |
| One scenario | `npx cucumber-js --profile adapter --name '<title>'` or `npm run test:cucumber:profile -- --profile adapter features/hook/tool-failure.feature:<line>` |
| Unit | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/bridges/hooks/dispatch.test.ts` (likewise `payloads/post-tool-use-failure.test.ts`, `dispatch-exec.test.ts`, `event-adapters.test.ts`) |
| Pair coverage | `npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts extensions/pi-claude-marketplace/bridges/hooks/payloads/post-tool-use-failure.ts extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts` (about 4.5 s, green at the phase head) |
| Static | `npm run check:features`, `npx fallow dupes`, `npm run check:static` |
| Full suite | `npm run check` (run in the background with the exit code written to a file; never piped), plus `npm run test:modules` at the phase gate |

### Phase Requirements → Test Map
| ID | Behavior | Type | Command / scenario | Red proof | Exists? |
|----|----------|------|--------------------|-----------|---------|
| TFAIL-01 c1 | a failed `read` runs PostToolUseFailure with the whole payload, `is interrupt` false | cucumber (adapter) | S1 "A failed read runs the PostToolUseFailure hooks with Claude Code's payload" | before D-BG-401 the `is interrupt` column fails; for the routing, temporarily set `claudeEvent` to `"PostToolUse"` | ❌ new |
| TFAIL-01 c1 | a failed plugin MCP call, built-in | cucumber `@builtin-only` | S7b | temporarily drop `isError` from the wrapper (the call succeeds, so PostToolUse runs) | ❌ new |
| TFAIL-01 c1 | a failed plugin MCP call, adapter | cucumber `@adapter-only` | S7a | red before the adapter fix (probe: PostToolUse ran) | ❌ new |
| TFAIL-01 c2 | `Read`, `Read\|Edit` select; `Write` does not | cucumber | S2 (may merge with S1) | temporarily make `matcherFiresOnToolEvent` return true in the tool-result closure, so `Write` runs | ❌ new |
| TFAIL-01 c2 | the MCP literal and `mcp__plugin_hook-demo_stub-server__.*` select, and a non-selecting matcher does not | cucumber pair | S7a/S7b | same | ❌ new |
| TFAIL-01 c3 | a failure runs no PostToolUse | cucumber | S1/S2 with an `after` PostToolUse hook | swap the ternary at `dispatch.ts:793` | ❌ new |
| TFAIL-01 c3 | a success runs no PostToolUseFailure | cucumber | S4 (bash `echo from-model` or a successful `read`, with both hooks) | swap the ternary | ❌ new |
| TFAIL-01 c4 | additional context reaches the model after the tool result | cucumber | S5a | temporarily remove `sendToolContext(pi, label, folded.result)` at `dispatch.ts:809` | ❌ new |
| TFAIL-01 c4 | systemMessage notice | cucumber | S5b | temporarily remove `"PostToolUseFailure"` from `showsSystemMessages` | ❌ new |
| TFAIL-01 c4 | exit 2 blocking error | cucumber | S5c | temporarily return `undefined` from the block arm when `event.isError` | ❌ new |
| TFAIL-01 c4 | `decision: "block"` | cucumber | S5d | same | ❌ new |
| (candidate) | updatedToolOutput ignored on failure | cucumber + unit | S5e; `event-adapters.test.ts` | red before the fix | ❌ new |
| D-BG-402 | a cancelled bash call runs neither hook | cucumber | S6 "Interrupting a running command runs no PostToolUseFailure hook" | red before the guard (probe: the `failure` run recorded) | ❌ new |
| D-BG-402 | unit: a failed result under an aborted signal runs no hook; a successful one still runs PostToolUse; a failed one under a live signal runs PostToolUseFailure | unit `dispatch.test.ts` | `describe("toolResultCompositeHandler")` after `:1653` | the new case fails without the guard | ❌ new |
| D-BG-404 (proposed) | unit: adapter active + `details.error` `tool_error` + `isError` false → the failure bucket with an `isError: true` event; adapter inactive → PostToolUse; adapter active + no code → PostToolUse with no `proxyRuleApplies` read | unit | use `createProxyRuleView(applies, reads)` (`dispatch.test.ts:3185`) | — | ❌ new |
| D-BG-401 | exact stdin bytes; translator envelope | unit | `dispatch-exec.test.ts:682-700`, `post-tool-use-failure.test.ts` | the changed expectations fail before the translator change | ✅ edit |
| D-BG-401 | the existing Bash failure row | cucumber | `features/hook/tool-use.feature:603` | the new column fails before the change | ✅ edit |

Unit-test fake context: `createExtensionContext(cwd)` returns `signal: undefined` (`dispatch.test.ts:104`). `ExtensionContext.signal` is mutable. Build an aborted context with a small helper next to the new cases: `const context = createExtensionContext(cwd); context.signal = AbortSignal.abort();`. Do not change the shared helper's signature, which other hook phases may also touch. Use `new AbortController().signal` for the live-signal case.

### Sampling Rate
- **Per task commit:** the owner unit test plus `npm run test:coverage:direct -- <source>`; the touched scenarios under the profile(s) they run in; `npm run check:features`; `npx fallow dupes` after the verb module changes.
- **Per wave merge:** `npm run check` (both cucumber profiles).
- **Phase gate:** `npm run check` and `npm run test:modules`, green, before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `features/hook/tool-failure.feature` (title `Hook tool failure`; description names D-CF5-28 for the absent fields and the ID that licenses the MCP pair)
- [ ] `features/step_definitions/hook/tool-failure.steps.ts` (two steps: the failing MCP server Given and the interrupt When; `@fileoverview`; no exports; Given before When)
- No framework install needed. The optional peers install through the npm scripts.

## Security Domain

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | the hook stdin is built by the translator from Pi's event (no new input); `details` is read only through `typeof` checks |
| V6 Cryptography | no | — |
| V12 Files / Resources | yes (tests) | the wrapper is written only inside the sandbox's published plugin through `writePublishedPluginFiles` (`ownedTarget` containment). The interrupt marker lives in the sandbox project and is removed by a release. No real `~/.pi` access |

| Pattern | STRIDE | Mitigation |
|---------|--------|-----------|
| Hooks run on a call the user cancelled (unwanted side effects after cancel) | Elevation / Tampering | the D-BG-402 guard |
| A test leaves a detached process | DoS (CI) | a bounded loop, a marker removed in the release, and Pi's SIGKILL of the process group on abort |
| Another extension forges `details.error` to route a success to PostToolUseFailure | Tampering (low) | detection only while the adapter is active, and only for the two codes |

## Sources

### Primary (HIGH confidence)
- Pi 1.5.0 dist: `pi-agent-core/dist/agent-loop.js`, `agent.js`; `pi-coding-agent/dist/modes/rpc/rpc-mode.js`, `core/agent-session.js`, `core/extensions/runner.js`, `core/extensions/types.d.ts`, `core/tools/{bash,read}.js`, `extensions/mcp/tools.js`, all read this session.
- pi-mcp-adapter 7.0.0 sources (`direct-tools.ts`, `error-signal.ts`, `index.ts`, `proxy-modes.ts`), read this session.
- The repository: `bridges/hooks/{dispatch,event-adapters,hook-labels,wire-protocol}.ts`, `payloads/post-tool-use-failure.ts`, `domain/components/hooks/matcher.ts`, the tests named above, the frozen `features/` libs and step modules, and `docs/hooks-compatibility.md`.
- Claude Code 2.1.319 binary strings: the `Q3t` runner, `XZo` payload, `hook_blocking_error` and `hook_additional_context` renderers, the `PostToolUseFailure` hookSpecificOutput branch, and the `xW` schema with `is_interrupt:O().optional()`.
- Probe runs this session (scratch feature and step module only, no repository file): adapter (3 scenarios, then the MCP one again) and builtin (the MCP one). Outputs are in `<scratchpad>/phase4-research/probe-out.jsonl`.

### Secondary
- CONTEXT.md upstream contract (docs read by the discuss step).

## Metadata

**Confidence breakdown:**
- Stack: HIGH, nothing new.
- Architecture and fixes: HIGH, from code reads and probes.
- Pitfalls: HIGH, each observed in a probe or pinned in code.

**Research date:** 2026-11-08
**Valid until:** 2026-12-08, or until Pi or pi-mcp-adapter changes its declared floor.

## Dubious Choices

- **R-DC-1 (High).** I recommend fixing the pi-mcp-adapter routing (Pattern 2) in this phase under a new decision ID. That edits the D-59-01 split line of the shared `toolResultCompositeHandler`. The alternative is a `@builtin-only` scenario plus a BACKLOG line.
- **R-DC-2 (Medium).** The detection mirrors only the adapter codes `tool_error` and `call_failed`, not the adapter's full `toolErrorOverride` set.
- **R-DC-3 (Medium).** The failing-MCP scenarios leave out the built-in stand-in step that the other `@mcp` hook scenarios use. The probe showed that the extension's own registration of the wrapper serves the call.
- **R-DC-4 (Medium).** The adapter scenario's `error` cell pins pi-mcp-adapter's `Error: ` prefix. This is companion wording, with a precedent in Pi's Bash wording at `tool-use.feature:623`.
- **R-DC-5 (Medium).** I flag the `updatedToolOutput`-on-failure mismatch as a bug that this phase should fix, although criterion 4 does not list that channel.
- **R-DC-6 (Low).** The `read` target is a file in the published plugin, written by the frozen plugin-file step, because no frozen step writes a file into the project directory.
- **R-DC-7 (Low).** The research ran `node scripts/install-test-peers.mjs` in this worktree (untracked `node_modules/.cache`) and ran 5 probe scenarios from a scratchpad feature with `--import` of a scratchpad step module. No repository file changed (`git status` is clean), and the real `~/.pi` did not change (listing diff empty). Before installing the peers here, I read pi-mcp-adapter sources once from the milestone checkout's optional-peer cache, read-only.

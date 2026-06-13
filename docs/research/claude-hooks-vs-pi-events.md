# Claude Code hooks vs Pi extension events

Status: research note, not a decision. Date: 2026-06-12. Authors: research transcript, not yet reviewed.

## Executive summary

- **Surface comparison.** Claude Code has 30 hook events; Pi has 30 extension events. Both use a string-match scoping primitive (Claude uses a `matcher` field; Pi uses an in-handler branch).
- **Naive 1:1 mapping is misleading.** Direct correspondence: 9 exact, 6 partial, 16 with no Pi analog. The 16 ○ events conflate four different situations -- see [Perfect-fidelity feasibility](#perfect-fidelity-feasibility).
- **What the bridge can actually ship today.** With synthesis inside the bridge plus the project's existing soft-dep extensions (`pi-subagents`, `pi-mcp-adapter`), **22 of 30 events become supportable at perfect or near-perfect fidelity with zero pi-coding-agent runtime changes**. Buckets A + B + C + D cover 20 events directly; `SubagentStart` and `SubagentStop` lift from bucket F to A/B when `pi-subagents` is installed (see [Soft-dep extension event surfaces](#soft-dep-extension-event-surfaces)).
- **Six hard blockers** remain after the soft-dep audit: 5 events need pi-coding-agent to expose internal state (`Notification`, `PermissionRequest`, `PermissionDenied`, `Setup`, `MessageDisplay`) and 1 event (`TeammateIdle`) needs Pi to add an agent-team primitive it doesn't have. Two more events (`Elicitation`, `ElicitationResult`) are blocked on two specific PRs to `pi-mcp-adapter`, not on Pi itself.
- **Empirical check against the official Anthropic marketplace: 5/5 hook-using plugins are supportable** under the bucket A + B + C + D scope (4 fully, 1 partially). **None of the 8 hard blockers are exercised by any first-party plugin.** The blockers are real but not market-driven for the first-party catalog.
- **The first-party catalog uses only 5 distinct hook events**: `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `Stop`. A minimum-viable bridge that supports just these five achieves 100% first-party coverage.
- **`Stop` is the single biggest correctness risk.** 3 of 5 first-party hook-using plugins hook it, and it's a bucket-D lossy synthesis. The bridge's preservation of the `{"decision": "block", "reason": "..."}` JSON contract on `Stop` is a load-bearing test case.
- **New compatibility category -- hook-payload extensions.** The audit surfaced fields like `asyncRewake` on `security-guidance` that change how an existing event behaves without being a new event. The bridge needs an ignore-with-warning policy distinct from event-level blocker handling.

## Purpose

Establish whether the Claude Code plugin hook surface can be bridged to the Pi extension event surface, and at what fidelity. Two authoritative source lists, a cross-mapping table, a feasibility analysis covering both direct and synthesized fidelity, and an empirical audit of the official Anthropic marketplace as a real-world coverage check.

## Authoritative sources

| Use                               | Source                                                                                                               | Fetched    |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ---------- |
| Claude hook taxonomy              | <https://code.claude.com/docs/en/hooks>                                                                              | 2026-06-12 |
| Pi event taxonomy                 | `@earendil-works/pi-coding-agent/docs/extensions.md` (shipped with peer dep, current 0.73.x)                         | 2026-06-12 |
| Official marketplace plugin audit | `anthropics/claude-code` → `.claude-plugin/marketplace.json` at commit `ca9f6045fc90c8244f9e787fb57d54b380f9a27c`    | 2026-06-12 |
| Soft-dep extension audit          | `pi-subagents@0.24.3` + `pi-mcp-adapter@2.6.1` (locally installed at `/home/acolomba/.npm-global/lib/node_modules/`) | 2026-06-13 |

All three are version-sensitive. The Claude list is taken from the rendered docs page; the Pi list is taken from the docs file shipped inside the installed peer-dependency package (which is the authoritative copy at the version this project depends on); the marketplace audit reads each plugin's manifest and hook config at the specified commit and should be re-verified before being load-bearing in a phase decision.

## Scoping primitive

Both systems use a single string-match scoping primitive, but they spell it differently:

| Side   | Mechanism                                                                                          | Scope                                                                                       |
| ------ | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Claude | `matcher` field (regex; meaning varies per event -- tool name, command name, source, reason, etc.) | Global per session. Plugin hooks are not scoped to the plugin's own commands/skills/agents. |
| Pi     | `if (event.toolName === ...)` branch inside the handler                                            | Global per session. No per-event matcher field; the handler is the filter.                  |

Implication for a bridge: the bridge can translate a Claude `matcher` to an in-handler branch at extension load time. No runtime activation tracking is needed because both systems treat hooks as session-global.

## Claude Code hook events

Thirty events as documented.

| #   | Event                 | Matcher                                   | Trigger                                              | Control                                                                | Frequency             |
| --- | --------------------- | ----------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------- | --------------------- |
| 1   | `SessionStart`        | yes: `startup`/`resume`/`clear`/`compact` | Session begins or resumes                            | Inject `additionalContext`, `initialUserMessage`, `sessionTitle`, etc. | Per session lifecycle |
| 2   | `Setup`               | yes: `init`/`maintenance`                 | `--init-only` or `--init`/`--maintenance` under `-p` | Inject `additionalContext` only                                        | Once at init          |
| 3   | `UserPromptSubmit`    | no                                        | User submits a prompt                                | Block via exit 2 / `decision: "block"`                                 | Per user message      |
| 4   | `UserPromptExpansion` | yes: command/skill name                   | Slash command expands into a prompt                  | Block                                                                  | Per slash command     |
| 5   | `PreToolUse`          | yes: tool name (regex; `mcp__.*` etc.)    | Before a tool call executes                          | Allow/deny via `permissionDecision`; modify via `updatedInput`         | Per tool call         |
| 6   | `PermissionRequest`   | yes: tool name                            | Permission dialog appears                            | `decision.behavior` (allow/deny); modify via `updatedInput`            | Per permission prompt |
| 7   | `PermissionDenied`    | yes: tool name                            | Tool denied by auto-mode classifier                  | `retry: true` to allow retry                                           | Per denied call       |
| 8   | `PostToolUse`         | yes: tool name                            | Tool succeeded                                       | Block; modify via `updatedToolOutput`                                  | Per successful call   |
| 9   | `PostToolUseFailure`  | yes: tool name                            | Tool failed                                          | Block                                                                  | Per failed call       |
| 10  | `PostToolBatch`       | no                                        | Parallel batch resolved, before next LLM call        | Block agent loop                                                       | Per batch             |
| 11  | `Notification`        | yes: notification type                    | Claude emits a notification                          | None (observation; stderr surfaced to user)                            | Per notification      |
| 12  | `MessageDisplay`      | no                                        | Assistant message text streams                       | Replace displayed text (transcript unchanged)                          | Per assistant message |
| 13  | `SubagentStart`       | yes: agent type                           | Subagent spawned                                     | Inject `additionalContext`                                             | Per spawn             |
| 14  | `SubagentStop`        | yes: agent type                           | Subagent finishes                                    | Block; inject `additionalContext`                                      | Per finish            |
| 15  | `TaskCreated`         | no                                        | `TaskCreate` invoked                                 | Block via exit 2; halt via `continue: false`                           | Per task              |
| 16  | `TaskCompleted`       | no                                        | Task marked complete                                 | Block; halt via `continue: false`                                      | Per task              |
| 17  | `Stop`                | no                                        | Claude finishes responding                           | Block (keep going); inject `additionalContext` as feedback             | Per turn              |
| 18  | `StopFailure`         | yes: error type                           | Turn ended by API error                              | None                                                                   | Per API error         |
| 19  | `TeammateIdle`        | no                                        | Teammate about to go idle                            | Block via exit 2 or `continue: false`                                  | Per idle              |
| 20  | `InstructionsLoaded`  | yes: load reason                          | CLAUDE.md / `.claude/rules/*.md` loaded              | None                                                                   | Per file load         |
| 21  | `ConfigChange`        | yes: config source                        | Settings file changed during session                 | Block (except `policy_settings`)                                       | Per FS change         |
| 22  | `CwdChanged`          | no                                        | Working directory changed                            | None                                                                   | Per cwd change        |
| 23  | `FileChanged`         | yes: filename patterns                    | Watched file changed on disk                         | None                                                                   | Per change            |
| 24  | `WorktreeCreate`      | no                                        | Worktree being created                               | Fail creation via non-zero exit; return path                           | Per creation          |
| 25  | `WorktreeRemove`      | no                                        | Worktree being removed                               | None                                                                   | Per removal           |
| 26  | `PreCompact`          | yes: `manual`/`auto`                      | Before context compaction                            | Block                                                                  | Per compaction        |
| 27  | `PostCompact`         | yes: `manual`/`auto`                      | After context compaction                             | None                                                                   | Per compaction        |
| 28  | `Elicitation`         | yes: MCP server name                      | MCP server asks user for input                       | Deny; supply `action` + `content`                                      | Per elicitation       |
| 29  | `ElicitationResult`   | yes: MCP server name                      | User responded, before sending back to MCP           | Override `action`                                                      | Per result            |
| 30  | `SessionEnd`          | yes: end reason                           | Session terminates                                   | None                                                                   | Per session end       |

## Pi extension events

Thirty events as documented in `extensions.md` (lifecycle overview plus the per-event sections). Plus four producer-only return fields surfaced through `session_start` (`watchPaths`, `reloadSkills`, `initialUserMessage`, etc.) that are not events but matter for the comparison.

| #   | Event                     | Trigger                                                            | Control                                                                                 |
| --- | ------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| 1   | `project_trust`           | Before deciding to trust a project's dynamic configs               | `{ trusted: "yes" \| "no" \| "undecided", remember? }`                                  |
| 2   | `resources_discover`      | After `session_start`, on startup or `/reload`                     | Contribute `skillPaths`, `promptPaths`, `themePaths`                                    |
| 3   | `session_start`           | Session started, loaded, or reloaded                               | Observation; `event.reason` discriminates `startup`/`reload`/`new`/`resume`/`fork`      |
| 4   | `session_before_switch`   | Before `/new` or `/resume`                                         | `{ cancel: true }`                                                                      |
| 5   | `session_before_fork`     | Before `/fork` or `/clone`                                         | `{ cancel: true }` or `{ skipConversationRestore: true }`                               |
| 6   | `session_before_compact`  | Before compaction                                                  | `{ cancel: true }` or `{ compaction: { summary, firstKeptEntryId, tokensBefore } }`     |
| 7   | `session_compact`         | After compaction completes                                         | Observation                                                                             |
| 8   | `session_before_tree`     | Before `/tree` navigation                                          | `{ cancel: true }` or `{ summary: { summary, details } }`                               |
| 9   | `session_tree`            | After tree navigation                                              | Observation                                                                             |
| 10  | `session_shutdown`        | Before extension runtime is torn down                              | Cleanup; can return shutdown options                                                    |
| 11  | `before_agent_start`      | User prompt received, before agent loop                            | Inject persistent `message`; modify `systemPrompt`                                      |
| 12  | `agent_start`             | Agent loop begins                                                  | Observation                                                                             |
| 13  | `agent_end`               | Agent loop ends                                                    | Observation                                                                             |
| 14  | `turn_start`              | Each turn (one LLM response + tool calls)                          | Observation                                                                             |
| 15  | `turn_end`                | Turn ends                                                          | Observation                                                                             |
| 16  | `message_start`           | User/assistant/toolResult message begins                           | Observation                                                                             |
| 17  | `message_update`          | Assistant streaming token deltas                                   | Observation                                                                             |
| 18  | `message_end`             | Message finalized                                                  | Replace finalized message via `{ message }` (must keep `role`)                          |
| 19  | `tool_execution_start`    | Before tool runs (lifecycle, in assistant source order)            | Observation                                                                             |
| 20  | `tool_execution_update`   | Tool emits partial output                                          | Observation                                                                             |
| 21  | `tool_execution_end`      | Tool finalized                                                     | Observation                                                                             |
| 22  | `context`                 | Before each LLM call                                               | Replace `messages` (deep copy provided)                                                 |
| 23  | `before_provider_request` | Provider payload built, before HTTP request                        | Return replacement payload (e.g. modify temperature, system instructions)               |
| 24  | `after_provider_response` | HTTP response received, before stream consumed                     | Inspect `status` + `headers`                                                            |
| 25  | `model_select`            | Model changed via `/model`, `Ctrl+P`, or session restore           | Observation; `source` is `set`/`cycle`/`restore`                                        |
| 26  | `thinking_level_select`   | Thinking level changed                                             | Observation                                                                             |
| 27  | `tool_call`               | After `tool_execution_start`, before tool executes                 | Mutate `event.input` in place; `{ block: true, reason? }`                               |
| 28  | `tool_result`             | After tool finishes, before result message events                  | Return partial patch `{ content?, details?, isError? }`; handlers chain like middleware |
| 29  | `user_bash`               | User executes `!` or `!!`                                          | Provide custom `operations`, or return `result` directly                                |
| 30  | `input`                   | User input received, after extension commands but before expansion | `{ action: "continue" \| "transform" \| "handled", text?, images? }`; transforms chain  |

## Cross-mapping: Claude → Pi

Color key: ● exact · ◐ partial · ○ none.

| Claude event          | Pi equivalent                                        | Fidelity | Adaptation notes                                                                                                                                                              |
| --------------------- | ---------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SessionStart`        | `session_start`                                      | ●        | Both have `reason` discriminator. Pi has no `clear`/`compact` reason. `additionalContext` injection has no return-shape equivalent; bridge re-emits via `before_agent_start`. |
| `Setup`               | --                                                   | ○        | No `--init-only` mode in Pi.                                                                                                                                                  |
| `UserPromptSubmit`    | `input`                                              | ●+       | Pi is strictly stronger: `continue`/`transform`/`handled`. Block maps to `{ action: "handled" }`.                                                                             |
| `UserPromptExpansion` | `input` (filter by `startsWith("/")`)                | ◐        | Pi's `input` fires **before** skill/template expansion. Bridge would need its own command-name detection.                                                                     |
| `PreToolUse`          | `tool_call`                                          | ●        | Both block; both modify input. Pi mutates `event.input` in place; bridge writes parsed `updatedInput` back onto it.                                                           |
| `PermissionRequest`   | --                                                   | ○        | No permission-dialog event in Pi.                                                                                                                                             |
| `PermissionDenied`    | --                                                   | ○        | No auto-mode classifier in Pi.                                                                                                                                                |
| `PostToolUse`         | `tool_result` (filter `!event.isError`)              | ●        | Direct mapping; result modification supported on both sides.                                                                                                                  |
| `PostToolUseFailure`  | `tool_result` (filter `event.isError`)               | ●        | Same event, different branch.                                                                                                                                                 |
| `PostToolBatch`       | `turn_end`                                           | ◐        | Pi's turn is "one LLM response + its tools"; Claude's batch is the parallel-call group. Close, not identical.                                                                 |
| `Notification`        | --                                                   | ○        | Pi exposes `ctx.ui.notify` as producer; no subscriber event.                                                                                                                  |
| `MessageDisplay`      | `message_update` / `message_end`                     | ◐        | Pi can replace finalized message via `message_end`, but display-only replacement (transcript unchanged) is not supported.                                                     |
| `SubagentStart`       | --                                                   | ○        | Pi has no built-in subagent primitive.                                                                                                                                        |
| `SubagentStop`        | --                                                   | ○        | Same.                                                                                                                                                                         |
| `TaskCreated`         | --                                                   | ○        | No `TaskCreate` tool in Pi.                                                                                                                                                   |
| `TaskCompleted`       | --                                                   | ○        | Same.                                                                                                                                                                         |
| `Stop`                | `agent_end`                                          | ◐        | Pi's `agent_end` is observation-only. Bridge cannot honor `decision: "block"` to force continuation.                                                                          |
| `StopFailure`         | `after_provider_response` (partial)                  | ◐        | Pi exposes HTTP status + headers mid-stream but has no "turn ended by error" terminal event.                                                                                  |
| `TeammateIdle`        | --                                                   | ○        | No agent-team concept in Pi.                                                                                                                                                  |
| `InstructionsLoaded`  | `resources_discover` (only loosely related)          | ○        | Pi event contributes paths; it doesn't observe per-file CLAUDE.md loads.                                                                                                      |
| `ConfigChange`        | --                                                   | ○        |                                                                                                                                                                               |
| `CwdChanged`          | --                                                   | ○        |                                                                                                                                                                               |
| `FileChanged`         | `session_start` return field `watchPaths` (producer) | ◐        | Pi can *request* file watches via `session_start` return; there's no consumer-side event when the watched file changes.                                                       |
| `WorktreeCreate`      | --                                                   | ○        |                                                                                                                                                                               |
| `WorktreeRemove`      | --                                                   | ○        |                                                                                                                                                                               |
| `PreCompact`          | `session_before_compact`                             | ●        | Both can cancel and provide a custom summary.                                                                                                                                 |
| `PostCompact`         | `session_compact`                                    | ●        |                                                                                                                                                                               |
| `Elicitation`         | --                                                   | ○        | No MCP elicitation hook in Pi.                                                                                                                                                |
| `ElicitationResult`   | --                                                   | ○        | Same.                                                                                                                                                                         |
| `SessionEnd`          | `session_shutdown`                                   | ●        | Both have `reason`.                                                                                                                                                           |

## Summary by fidelity (naive 1:1 view)

This is the naive view -- what maps directly without any synthesis work inside the bridge. The [Perfect-fidelity feasibility](#perfect-fidelity-feasibility) section below reclassifies these by what it would actually take to ship them.

| Bucket                           | Count | Claude events                                                                                                                                                                                                                                 |
| -------------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ● Exact or near-exact mapping    | 9     | SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, PostToolUseFailure, PreCompact, PostCompact, SessionEnd, Stop (downgraded -- see below)                                                                                              |
| ◐ Partial / lossy mapping        | 6     | UserPromptExpansion, PostToolBatch, MessageDisplay, Stop, StopFailure, FileChanged                                                                                                                                                            |
| ○ No mapping (drop with warning) | 16    | Setup, PermissionRequest, PermissionDenied, Notification, SubagentStart, SubagentStop, TaskCreated, TaskCompleted, TeammateIdle, InstructionsLoaded, ConfigChange, CwdChanged, WorktreeCreate, WorktreeRemove, Elicitation, ElicitationResult |

Note: `Stop` appears in both the ● and ◐ rows because there are two distinct plugin-author intents Claude wraps in the same event: "observe that the agent stopped" (●, observation maps to `agent_end`) and "veto the stop and feed back into the conversation" (◐, no Pi support).

## Pi events with no Claude analog

These are surface area Pi gives extensions that has no equivalent in Claude Code's hook system. Out of scope for the bridge unless we want to expose them through a Pi-native extension to Claude plugin authors.

| Pi event                  | Why it has no Claude analog                                                                      |
| ------------------------- | ------------------------------------------------------------------------------------------------ |
| `project_trust`           | Claude has a trust dialog but no hook to intercept the trust decision.                           |
| `resources_discover`      | Claude plugins declare components statically; there's no runtime path-contribution event.        |
| `before_agent_start`      | Claude has no per-turn system-prompt mutation hook (closest is `SessionStart` global injection). |
| `turn_start`              | No analog -- Claude's `PreToolUse` is the only per-turn pre-LLM hook surface.                    |
| `context`                 | No analog -- Claude doesn't expose message-history mutation to plugins.                          |
| `before_provider_request` | No analog -- Claude controls the provider payload internally.                                    |
| `after_provider_response` | No analog -- closest is `StopFailure` error-type matcher.                                        |
| `message_start`           | No analog.                                                                                       |
| `message_update`          | No analog -- Claude's `MessageDisplay` is end-of-stream-ish, not delta.                          |
| `tool_execution_*`        | No analog -- Claude's `PreToolUse`/`PostToolUse` is the only tool-call hook pair.                |
| `model_select`            | No analog.                                                                                       |
| `thinking_level_select`   | No analog.                                                                                       |
| `user_bash`               | No analog -- `!` / `!!` is a Pi TUI surface.                                                     |
| `session_before_switch`   | Closest is `SessionEnd` with `clear`/`resume` reason, but Pi's variant is cancelable.            |
| `session_before_fork`     | No analog.                                                                                       |
| `session_before_tree`     | Pi has tree navigation; Claude does not.                                                         |

## Perfect-fidelity feasibility

The naive table above marks 16 events ○ ("no mapping") because they have no direct equivalent in Pi's documented event surface. But ○ conflates four distinct situations: events whose semantics the bridge can **synthesize** from primitives Pi already gives extensions; events the bridge can make fire by **shipping the underlying feature itself**; events that need Pi to **expose** something it already has internally; and events that require Pi to **add a feature** it doesn't have yet.

Reclassifying all 30 Claude events by what perfect fidelity would actually take:

| Approach                                            | Count | Pi changes required | Claude events                                                                                                    |
| --------------------------------------------------- | ----- | ------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **A. Direct 1:1 mapping**                           | 8     | none                | SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, PostToolUseFailure, PreCompact, PostCompact, SessionEnd |
| **B. Synthesize from existing Pi primitives**       | 6     | none                | InstructionsLoaded, ConfigChange, CwdChanged, FileChanged, PostToolBatch, UserPromptExpansion                    |
| **C. Bridge ships the underlying feature**          | 4     | none                | TaskCreated, TaskCompleted, WorktreeCreate, WorktreeRemove                                                       |
| **D. Synthesize with edge-case loss**               | 2     | none                | Stop (block-to-continue semantic), StopFailure                                                                   |
| **E. Pi runtime exposure required** -- hard blocker | 5     | needed              | Notification, PermissionRequest, PermissionDenied, Setup, MessageDisplay (display-only semantic)                 |
| **F. Pi feature addition required** -- hard blocker | 3     | needed              | SubagentStart, SubagentStop, TeammateIdle                                                                        |
| **G. Status unclear** -- needs investigation        | 2     | maybe               | Elicitation, ElicitationResult                                                                                   |

**Totals: 20 events shippable today at perfect or near-perfect fidelity (A + B + C + D). 8 events are hard blockers (E + F). 2 are unknowns (G).**

### How each bucket B/C/D synthesizes

**B -- Synthesize from existing Pi primitives:**

| Claude event          | Synthesis approach                                                                                                                                                                                          |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `InstructionsLoaded`  | Inspect `before_agent_start` `event.systemPromptOptions.contextFiles` on first turn; diff against prior load to emit per-file events.                                                                       |
| `ConfigChange`        | Bridge sets up `fs.watch` on `~/.claude/settings.json`, project `.claude/settings.json`, and the plugin's own config paths at extension load; emit on change.                                               |
| `CwdChanged`          | Watch `tool_result` for `bash` tool calls matching `cd` patterns; compare resulting `ctx.cwd` against last known. Brittle for non-bash cwd changes (none currently in Pi), good enough for the common case. |
| `FileChanged`         | Bridge sets up `fs.watch` for each matcher pattern in the plugin's FileChanged hook config. Pi's `session_start` return field `watchPaths` is producer-only; bridge owns the watch.                         |
| `PostToolBatch`       | Count `tool_execution_end` events against the assistant message's tool-call count; fire when the count is reached and before the next LLM call (catch with `turn_start` or `before_provider_request`).      |
| `UserPromptExpansion` | Capture `input` event's `text` field; compare against `before_agent_start.prompt`; if they differ AND `input.text` started with `/`, an expansion happened. Fire the synthesized event between the two.     |

**C -- Bridge ships the underlying feature:**

| Claude event                        | What the bridge ships                                                                                                                                                                                                                                      |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TaskCreated` / `TaskCompleted`     | Bridge registers `TaskCreate` and `TaskUpdate` tools via `pi.registerTool()`. The LLM gets the same surface as Claude's Task tool. The bridge owns the tool's execute() and fires the hook events from there. Perfect fidelity for plugins that hook them. |
| `WorktreeCreate` / `WorktreeRemove` | Bridge ships worktree commands as `pi.registerCommand()` entries (e.g. `/worktree create`, `/worktree remove`) that run the git plumbing. Fires the hook events from the command handler.                                                                  |

The catch: shipping a feature inside the bridge means it only exists for sessions where the bridge is installed. That's fine for plugin compatibility but doesn't add the feature to Pi as a whole.

**D -- Synthesize with edge-case loss:**

| Claude event               | Synthesis approach                                                                                                                                                                                                                                                                                                                      | Lossy where                                                                                                                                                                           |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Stop` (block-to-continue) | Pi's `agent_end` can't keep the loop running, but the bridge can intercept and enqueue a synthetic user message via `pi.sendUserMessage()` (or equivalent) on the next idle. Plugin's "block + reason" surfaces in the *next* turn instead of folding into the current one.                                                             | Plugins that expect the feedback to appear in the same turn won't see exact Claude behavior. For most use cases (linting feedback, "don't stop yet, you missed X") this is invisible. |
| `StopFailure`              | Bridge tracks the most recent HTTP status from `after_provider_response`; if `agent_end` fires after a non-2xx response, synthesize `StopFailure` with the recorded error type. Bridge maintains its own error-type → matcher-value mapping (rate_limit, overloaded, authentication_failed, etc.) by inspecting status + response body. | Bridge has to ship and maintain the error-type classifier itself. Providers that swallow HTTP-level errors and surface them as text deltas won't classify correctly.                  |

### The 8 hard blockers

Each of these requires a change to `@earendil-works/pi-coding-agent` itself. The bridge cannot close the gap by being cleverer.

**E -- Pi runtime exposure required (5):**

| Claude event        | What Pi has today                                   | What's missing                                                                                 | Likely Pi change                                                                                                                            | Size                                                                                                            |
| ------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `Notification`      | `ctx.ui.notify(message, severity)` -- producer-only | No subscriber event when any extension or built-in calls notify                                | Expose the UI notification bus as `pi.on("notification", ...)` with `{ message, severity, source }` payload                                 | Small if Pi already has an internal event bus for notifications; medium if it's direct calls today              |
| `PermissionRequest` | Permission dialog flow exists internally            | No event hook when the dialog is about to show                                                 | Emit `permission_request` before showing the dialog; return shape mirrors `tool_call` block/allow                                           | Medium -- needs a contract for what extensions can do (replace the dialog? override the decision? pre-empt it?) |
| `PermissionDenied`  | No auto-mode classifier (Claude-specific concept)   | The event itself, and the classifier behind it                                                 | Either add an auto-classifier surface, or redefine the hook to fire on any tool block (already inferrable from `tool_call` returning block) | Medium -- scope decision needed                                                                                 |
| `Setup`             | No `--init-only` or `--maintenance` CLI flag        | A CLI mode that loads extensions, fires `setup`, and exits without entering the agent loop     | Add `pi --init-only` / `pi --maintenance` flags that fire a `setup` event                                                                   | Small -- pure CLI addition                                                                                      |
| `MessageDisplay`    | `message_end` can replace the finalized message     | A render-time hook in the TUI that can change *displayed* text without altering the transcript | Add a `message_render` hook in the `pi-tui` message renderer that consults extensions between transcript-read and screen-paint              | Medium -- touches the rendering pipeline; testing matrix grows                                                  |

**F -- Pi feature addition required (3):**

| Claude event                     | What's missing                                                                                                                                                  | Likely Pi change                                                                                                                                                        | Size                                            |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `SubagentStart` / `SubagentStop` | Pi has no subagent primitive. The LLM cannot spawn nested LLM loops. (User-driven sessions exist via `/new` / `/fork`, but those aren't LLM-spawned subagents.) | Add a subagent primitive -- either a built-in tool (`SubagentTask` or similar) or an extension API (`pi.spawnAgent({ goal, ... })`) plus the matching lifecycle events. | Large -- new product surface, not just an event |
| `TeammateIdle`                   | No agent-team concept                                                                                                                                           | Introduce agent teams as a first-class concept                                                                                                                          | Very large -- whole new product surface         |

The 3 F-bucket events aren't really hook problems. They're feature problems whose hooks come along for free once the feature exists.

### G -- Unknowns to investigate

`Elicitation` and `ElicitationResult` fire when an MCP server requests user input during a tool call. Pi's MCP surface lives in `pi-mcp-adapter` (a sibling extension that this project's PRD already treats as a soft dependency), and whether MCP elicitation is plumbed through is not visible from the Pi or pi-mcp-adapter docs I've read. If elicitation is supported, these likely move to bucket A or B. If it's not, they move to bucket E.

### Synthesis caveats

Three of the bucket-B synthesis paths have non-obvious failure modes that should be documented in the bridge's own README, not silently papered over.

| Path                                                                                | Failure mode                                                                                                                                                                                                                                                      |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Counting `tool_execution_end` to derive `PostToolBatch`                             | Races if a tool errors out before emitting `tool_execution_end` (the count never reaches expected). Bridge needs a timeout + retry policy and should explicitly fire `PostToolBatch` from `turn_end` as a safety net. Tests need cancellation-mid-batch coverage. |
| Diffing `input.text` vs `before_agent_start.prompt` to derive `UserPromptExpansion` | Fails for plugins that mutate the prompt between `input` and `before_agent_start` (e.g., another plugin's `input` transform). The synthesized event would fire for *any* prompt rewrite, not just slash-command expansion. Document as best-effort.               |
| Watching `bash` tool results to derive `CwdChanged`                                 | Fails for cwd changes via non-bash tools (none in Pi today, but a future addition would silently break the hook). Also fails for `cd` chained in compound commands the bridge doesn't parse. Document scope clearly.                                              |

### Path forward

Assuming we don't want to wait on Pi upstream:

1. **V1 bridge ships buckets A + B + C + D.** That's 20 of 30 Claude events at perfect or near-perfect fidelity. The empirical marketplace audit (next section) shows the first-party catalog uses only 5 distinct events -- all in A or D -- so even a minimum-viable V1 limited to `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, and `Stop` covers 100% of Anthropic's plugins. Shipping all of A + B
   - C + D buys forward-compatibility for third-party plugins at modest extra cost; shipping just the first-party set is a sensible alpha.
2. **`Stop` is the load-bearing test case.** Three first-party plugins hook it and depend on the block-to-continue JSON contract. The bridge's bucket-D synthesis for `Stop` MUST round-trip `{"decision": "block", "reason": "..."}` correctly. Treat `ralph-wiggum` as the canary plugin -- if it works, the synthesis works.
3. **8 hard-blocker events are documented as known limitations** in the bridge README. Plugin authors are told: if your plugin hooks `Notification` / `PermissionRequest` / `PermissionDenied` / `Setup` / `MessageDisplay` / `SubagentStart` / `SubagentStop` / `TeammateIdle`, that hook will not fire under Pi. The marketplace audit shows zero first-party plugins use any of these, so the documentation matters more than the runtime impact in the short term.
4. **Open 5 issues upstream in `pi-coding-agent`** for the E-bucket runtime exposures. Each is a small-to-medium patch (Notification and Setup look smallest). If accepted, the bridge moves them out of the blocker list version-by-version, gated on the peer-dep floor. Urgency is low until a third-party plugin actually exercises one.
5. **F-bucket events are not the bridge's problem.** Subagents and agent teams are independent product decisions for Pi; the bridge can trivially add their hook events once Pi adds the features.
6. **G-bucket: investigate `pi-mcp-adapter` before scoping.** Cheap to resolve -- read one file or ask upstream.
7. **Add hook-payload extension handling.** Bridge's manifest parser must tolerate unknown fields on hook entries (ignore + debug-log, warn at install time). See [Hook-payload extensions](#hook-payload-extensions).

## Official marketplace plugin coverage

Marketplace source: `anthropics/claude-code` → `.claude-plugin/marketplace.json` at commit `ca9f6045fc90c8244f9e787fb57d54b380f9a27c`, audited 2026-06-12 via agent research. Findings should be re-verified before being load-bearing in a phase decision.

### Summary

Of 13 first-party plugins, 5 ship hooks. Under the bucket scheme above, **4 of 5 would work end-to-end** (all hook events in buckets A or D) and **1 (`security-guidance`) is partially supportable** -- its events are fine, but its hook entries use an `asyncRewake` / `rewakeMessage` / `rewakeSummary` payload extension that has no Pi equivalent and would degrade to synchronous in-band output. **No plugin in the official marketplace hooks any bucket-E or bucket-F event**, so the 8 hard blockers are not exercised by Anthropic's own catalog.

### Plugins without hooks (8)

- `agent-sdk-dev` -- Claude Agent SDK development kit (agents + commands)
- `claude-opus-4-5-migration` -- model migration helper (skills)
- `code-review` -- multi-agent PR review (commands)
- `commit-commands` -- git commit/push/PR commands (commands)
- `feature-dev` -- feature workflow with sub-agents (agents + commands)
- `frontend-design` -- production-grade UI generation (skills)
- `plugin-dev` -- plugin authoring toolkit (skills; **no `plugin.json` in tree** -- manifest-shape edge case for the bridge's resolver to handle)
- `pr-review-toolkit` -- review-specialist agents (agents + commands)

### Plugins with hooks (5)

#### explanatory-output-style

- **Hooks used:** `SessionStart`
- **Buckets:** SessionStart → A
- **Verdict:** FULL SUPPORT
- **Notes:** Injects educational-mode instructions at session start. No matcher.

#### learning-output-style

- **Hooks used:** `SessionStart`
- **Buckets:** SessionStart → A
- **Verdict:** FULL SUPPORT
- **Notes:** Mirror of `explanatory-output-style`. No matcher.

#### ralph-wiggum

- **Hooks used:** `Stop`
- **Buckets:** Stop → D
- **Verdict:** FULL SUPPORT (with bucket-D caveat)
- **Notes:** Uses `Stop`'s block-to-continue semantics to drive a self-referential loop where Claude re-runs the same task until completion. The bridge's `Stop` synthesis MUST surface the `{"decision": "block", "reason": "..."}` JSON contract or the plugin's core behavior breaks. This is the highest-risk synthesis path in the audit.

#### hookify

- **Hooks used:** `PreToolUse`, `PostToolUse`, `Stop`, `UserPromptSubmit`
- **Buckets:** all → A except Stop → D
- **Verdict:** FULL SUPPORT (with bucket-D caveat)
- **Notes:** No matchers -- handlers run on every event of each kind and self-filter inside the Python handler. Same Stop block-to-continue dependency as `ralph-wiggum`.

#### security-guidance

- **Hooks used:** `SessionStart`, `UserPromptSubmit`, `PostToolUse`, `Stop`
- **Buckets:** all → A except Stop → D
- **Verdict:** PARTIAL SUPPORT -- events covered, payload extension lost
- **Notes:** Uses literal pipe-alternation matchers (`"matcher": "Edit|Write|MultiEdit|NotebookEdit"` on PostToolUse, `"matcher": "Bash"` with `if: "Bash(git commit:*)"` and `if: "Bash(git push:*)"` glob conditions). Simple enough that a literal-OR + prefix-glob implementation covers it; no full regex engine needed. **The real issue:** the hook entries use Claude Code's `asyncRewake` / `rewakeMessage` / `rewakeSummary` fields, which run the security review in the background and re-inject findings into the next turn as a fresh system message. This is not a new hook event -- it's a payload extension on existing events. See [Hook-payload extensions](#hook-payload-extensions) below.

### Aggregated coverage table

| Plugin                   | Hook count | Buckets used | Verdict | Risk                          |
| ------------------------ | ---------- | ------------ | ------- | ----------------------------- |
| explanatory-output-style | 1          | A            | FULL    | none                          |
| learning-output-style    | 1          | A            | FULL    | none                          |
| ralph-wiggum             | 1          | D            | FULL    | Stop JSON contract            |
| hookify                  | 4          | A, D         | FULL    | Stop JSON contract            |
| security-guidance        | 4          | A, D         | PARTIAL | asyncRewake payload extension |

### Findings

- **The first-party catalog exercises only 5 distinct hook events:** SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, Stop. All five are in bucket A or D -- i.e. supportable in V1 of the bridge with no Pi runtime changes.
- **None of the 8 hard-blocker events are used.** Notification, PermissionRequest, PermissionDenied, Setup, MessageDisplay, SubagentStart, SubagentStop, TeammateIdle: zero usage in the official marketplace. The blockers exist but the official catalog doesn't surface them as user-visible breakage.
- **`Stop` is the highest-risk supported event.** 3 of 5 hook-using plugins (`ralph-wiggum`, `hookify`, `security-guidance`) hook Stop. The bucket-D "block-to-continue" synthesis is the single largest correctness risk for first-party plugin compatibility.
- **Matcher complexity is bounded.** Only `security-guidance` uses matchers; all are pipe-alternation literals or prefix-glob `if` conditions. No full regex appears in the first-party marketplace. A literal-OR + prefix-glob matcher implementation gives 100% first-party coverage; full regex can be deferred.
- **Near-misses: none.** No plugin is "one event away" from working. Removing the `asyncRewake` payload from `security-guidance` would move it to FULL SUPPORT with the only loss being async-injection UX.
- **Manifest-shape edge case:** `plugin-dev` has no `plugin.json` in tree but is listed in the marketplace. The bridge's resolver should handle this case (probably falls under "metadata implicitly from marketplace entry").

### Hook-payload extensions

The audit surfaced a category of incompatibility risk we hadn't catalogued: **hook-payload extensions** -- fields added to existing hook entries that change *how* the hook behaves, without being new events. `asyncRewake` / `rewakeMessage` / `rewakeSummary` on `security-guidance` is the example.

These are distinct from the bucket-E/F event blockers:

- The event itself (`PostToolUse`, `Stop`) is in bucket A or D.
- The bridge's payload translator handles the standard input/output fields.
- The extension fields request **behavior the bridge can't deliver** -- in this case, running a side-process asynchronously and re-injecting its output into the next turn.

Without runtime support, the bridge has three options:

1. **Drop the extension silently** -- hook fires synchronously, plugin behavior degrades but doesn't crash.
2. **Drop the extension with a warning** -- same, but tell the user once at install time which fields are being ignored.
3. **Refuse to install** -- strictly fail the install. Probably too aggressive.

Option 2 is the right default. The bridge should maintain a list of known payload extensions and report ignored ones via `ctx.ui.notify` at install or `/reload`.

Future-proofing: the bridge's hook-entry parser should round-trip unknown payload fields by ignoring them silently (matching Claude Code's tolerant parsing) but log the unknown field names at debug level. This lets us detect new payload extensions in the wild without each one breaking installation.

## Soft-dep extension event surfaces

The bucket-F and bucket-G classifications above assumed only `pi-coding-agent` itself as the host runtime. Two soft-dep extensions this project already treats as first-class (`pi-subagents`, `pi-mcp-adapter`) add surface that changes the picture for four events. Audited 2026-06-13 against the locally-installed copies at `/home/acolomba/.npm-global/lib/node_modules/{pi-subagents,pi-mcp-adapter}/`.

### pi-subagents (v0.24.3)

- **Entry point:** `src/extension/index.ts` (TS-stripped at load time).
- **Observable subagent lifecycle:** PARTIAL.
- **Mechanism:** publishes to the shared `pi.events: EventBus` (`@earendil-works/pi-coding-agent` `types.d.ts:962`). Event-name constants exported from `src/shared/types.ts:443-447`:
  - `subagent:async-started` -- emitted at `src/runs/background/async-execution.ts:445` and `:596`. Payload includes `{ id, pid, sessionId, mode, agent, agents, task, chain, chainStepCount, parallelGroups, ... }`. Fires **only when `async: true`**.
  - `subagent:async-complete` -- emitted at `src/runs/background/result-watcher.ts:147`. Fires when the watcher observes a final result file.
  - `subagent:control-event` -- only fires for the two hardcoded types in `src/runs/shared/subagent-control.ts:10` (`active_long_running`, `needs_attention`). Not lifecycle.
- **Sync-mode lifecycle:** No published events. A foreground sync run goes through `executor.execute(...)` at `src/extension/index.ts:435` and returns an `AgentToolResult`; pi-subagents itself observes its own runs via the host's generic `pi.on("tool_result", ...)` with `event.toolName === "subagent"` (see `src/extension/index.ts:511`).
- **Bridge feasibility for `SubagentStart` / `SubagentStop`:**
  - **Async runs:** direct subscribe via `pi.events.on("subagent:async-started", ...)` and `pi.events.on("subagent:async-complete", ...)`. Both names are stable exported constants. **Perfect fidelity today**, no upstream change.
  - **Sync runs:** synthesize via `pi.on("tool_call", ...)` (start) and `pi.on("tool_result", ...)` (stop), filtered on `event.toolName === "subagent"`. Works today without an upstream change; the "event" is really a host tool-event, not a pi-subagents-emitted lifecycle event. Cleaner long-term: a small PR to pi-subagents adding `subagent:foreground-started` / `subagent:foreground-complete` on `pi.events`.

### pi-mcp-adapter (v2.6.1)

- **Entry point:** `./index.ts` (TS-stripped at load time).
- **Observable MCP elicitation:** NO.
- **Evidence (verified by grep across the 36-file source tree):**
  - Zero references to `Elicit*` in pi-mcp-adapter source. The MCP SDK ships `ElicitRequestSchema` at `node_modules/@modelcontextprotocol/sdk/dist/esm/types.js:1783` but the adapter never imports or wires it.
  - Zero `pi.events.emit` and zero `pi.events.on` calls anywhere in the adapter's `*.ts` files.
  - The only MCP request handler the adapter registers on the SDK `Client` is `CreateMessageRequestSchema` (sampling) at `sampling-handler.ts:26`, wired by `server-manager.ts:157` only when a `samplingConfig` is provided. That handler also bypasses any event bus -- it calls `ctx.ui.confirm(...)` directly at `sampling-handler.ts:174`.
  - Public surface is: a `mcp` proxy tool (`index.ts:250`), per-server direct tools (`index.ts:70`), and slash commands `/mcp`, `/mcp-auth` (`index.ts:155,218`). None of these relate to elicitation.
- **Bridge feasibility for `Elicitation` / `ElicitationResult`:** **Impossible today.** Two PRs required upstream:
  1. Register an `ElicitRequestSchema` handler in `server-manager.ts` and bridge requests through `ctx.ui`, mirroring the existing sampling handler.
  2. Publish `pi.events.emit("mcp:elicit-request", ...)` and `"mcp:elicit-result"` so other extensions can observe.

### Reclassification

Of the 6 previously-blocked or unknown events covered by this audit:

| Claude event        | Original bucket         | After audit                                                                                                                                                |
| ------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SubagentStart`     | F (need new Pi feature) | **A** when pi-subagents installed (async) + **B** (sync runs synthesized from `tool_call` filtered on `toolName === "subagent"`); conditional on soft dep. |
| `SubagentStop`      | F (need new Pi feature) | **A** (async, `subagent:async-complete`) + **B** (sync, `tool_result` filtered).                                                                           |
| `TeammateIdle`      | F (need new Pi feature) | **F unchanged.** pi-subagents has chains and parallel groups but no agent-team primitive matching Claude's "teammate" semantic.                            |
| `Elicitation`       | G (status unknown)      | **E equivalent at the pi-mcp-adapter level.** Two specific upstream PRs known.                                                                             |
| `ElicitationResult` | G (status unknown)      | **E equivalent at the pi-mcp-adapter level.** Same PRs.                                                                                                    |

**Net change to feasibility totals:**

- Buckets A + B + C + D: **22 of 30 events** (up from 20)
- Hard blockers: **6 events** (down from 8 -- the 5 E-bucket pi-coding-agent exposures + TeammateIdle)
- Upstream-PR-blocked at the soft-dep level: **2 events** (`Elicitation` pair, pi-mcp-adapter)
- The 2 events `SubagentStart` / `SubagentStop` become **conditional on `pi-subagents` being installed**, matching this project's existing soft-dep pattern: when present, hooks fire at perfect fidelity; when absent, the bridge degrades silently with a per-row `{requires pi-subagents}` marker (already plumbed for agents-bridge soft-degrade).

This audit moves the answer to "perfect fidelity?" from "20/30 today

- 5 small Pi PRs + 3 large Pi feature additions" to "**22/30 today** (conditional on already-installed soft deps) + 5 small Pi PRs + 2 pi-mcp-adapter PRs + 1 large Pi feature addition (TeammateIdle / agent teams)".

## Plugin lifecycle and hook routing

### Constraint: `pi.on()` is non-removable

Verified from `@earendil-works/pi-coding-agent` `types.d.ts` at the peer-dep version this project targets: every `ExtensionAPI.on(event, handler)` overload returns `void`. There is no unsubscribe function. The only API calls that take effect post-extension-load are `registerProvider` / `unregisterProvider`; `pi.on`, `pi.registerTool`, `pi.registerCommand`, `pi.registerShortcut`, and friends are all load-time-only.

This means runtime hot-swap of which plugins' hooks fire is structurally impossible. Every install / uninstall / enable / disable must go through `/reload`. That happens to match the existing Pi `/plugin` UX and the PRD's NFR-2 ("Run `/reload` must suffice"), so the constraint costs nothing operationally -- but it removes any temptation to design a "live" hot-swap path.

### State layout

```text
<scopeRoot>/pi-claude-marketplace/
  state.json                     # source of truth: installed + enabled flags per plugin
  plugins/
    <plugin-id>/                 # extracted Claude plugin tree, one dir per installed plugin
      .claude-plugin/plugin.json
      hooks/hooks.json
      hooks/*.sh                 # hook command scripts, shipped by the plugin
      ...
```

`state.json` shape (illustrative; final schema deferred to plan phase):

```json
{
  "version": 1,
  "plugins": {
    "explanatory-output-style@anthropic": {
      "installed": true,
      "enabled": true,
      "path": "plugins/explanatory-output-style"
    },
    "hookify@anthropic": {
      "installed": true,
      "enabled": false,
      "path": "plugins/hookify"
    }
  }
}
```

All `state.json` writes go through `write-file-atomic` per NFR-1.

### Lifecycle operations

| Command            | State mutation                            | Disk mutation                          | `/reload` advisory |
| ------------------ | ----------------------------------------- | -------------------------------------- | ------------------ |
| `install foo@mp`   | Add entry; `installed=true, enabled=true` | Extract plugin tree to `plugins/<id>/` | Yes                |
| `uninstall foo@mp` | Remove entry                              | Optionally remove `plugins/<id>/`      | Yes                |
| `enable foo`       | Flip `enabled=true`                       | None                                   | Yes                |
| `disable foo`      | Flip `enabled=false`                      | None                                   | Yes                |

The bridge surfaces a clear post-command message via `ctx.ui.notify` telling the user to run `/reload`. Same UX users already accept for Pi's built-in `/plugin`.

### Load-time wiring

When the bridge extension loads (startup, `/reload`, or `session_start` with `reason: "reload"`):

1. Read `state.json` → get the list of enabled plugins.

2. For each enabled plugin, read its `hooks/hooks.json` (or `plugin.json` `hooks` block); parse, validate against the Claude hook schema, warn on unknown payload-extension fields (see [Hook-payload extensions](#hook-payload-extensions)).

3. Build a dispatch table:

   ```ts
   Map<piEvent, Array<{
     plugin: string,                // plugin id
     hookEntry: ClaudeHookEntry,
     matcher: CompiledMatcher,      // null when event has no matcher
     command: string,               // absolute path to hook script
   }>>
   ```

4. For every Pi event the table touches, register **exactly one composite handler** via `pi.on(piEvent, dispatcher)`. The dispatcher iterates the table entries for that event, applies matcher filtering, shells out in declared order, aggregates return values per the Claude hook contract, and translates back to Pi's return shape.

Plugins not in `state.json` or marked `enabled: false` never appear in the dispatch table. Their hooks simply don't fire -- no special handling needed at the dispatcher.

The bridge registers at most 30 `pi.on(...)` handlers (one per Pi event type it bridges) regardless of how many plugins are installed. Per-plugin granularity is internal to the dispatcher.

### Per-plugin file isolation

Both hook declarations and hook command scripts stay inside each plugin's own directory tree under `plugins/<id>/`. The bridge:

- reads each plugin's `hooks/hooks.json` separately -- there is no consolidated registry file
- exec's each hook script by absolute path inside the plugin's tree -- no copying or relocation
- treats the plugin tree as read-only after extraction

The bridge's own TypeScript lives in its extension directory (`~/.pi/agent/extensions/pi-claude-marketplace/` for user scope, `<cwd>/.pi/extensions/pi-claude-marketplace/` for project scope). Plugin data and code live in the bridge's data dir under `<scopeRoot>/pi-claude-marketplace/plugins/`. No commingling.

### Cross-plugin ordering and aggregation

When two enabled plugins both hook the same event with overlapping matchers (e.g., both want `PostToolUse` for `Edit`), execution order matters. Claude Code orders by marketplace declaration / settings precedence. The bridge needs to commit to a deterministic rule; matching Claude Code's order preserves plugin author intent and is the safe default.

Aggregation rules per return type, across plugins for the same event:

| Return type                                       | Aggregation                                                                     |
| ------------------------------------------------- | ------------------------------------------------------------------------------- |
| Block (`decision: "block"` / exit 2)              | First plugin to block wins; subsequent plugins for this event are skipped.      |
| Modify input (`PreToolUse.updatedInput`)          | Modifications chain in declared order; each plugin sees prior plugins' changes. |
| Modify output (`PostToolUse.updatedToolOutput`)   | Same chain semantics in declared order.                                         |
| Inject context (`SessionStart.additionalContext`) | Concatenated in declared order.                                                 |
| Observation only                                  | All run; return values ignored.                                                 |

These rules track the existing semantics within a single Claude Code session -- the bridge isn't inventing a model, it's preserving one.

### Operational gotchas

1. **Hook script exec bits.** Plugin trees as distributed may not have `+x` on hook scripts. The bridge needs to `chmod` on install (Unix) or invoke via the shebang interpreter directly. Windows requires the interpreter-invocation path, since `chmod` is a no-op there.
2. **In-flight hooks during disable.** A long-running `PostToolUse` shell-out that started before `/reload` completes naturally; no new dispatches happen after `/reload`. The dispatcher doesn't need cancellation logic for disable -- it just stops appearing in the new dispatch table.
3. **Atomic `state.json` writes.** Mutations must be atomic per NFR-1; reuse `write-file-atomic` already adopted for `mcp.json`.
4. **Sparse plugin trees.** `plugin-dev` has no `plugin.json` in tree (see [Plugins without hooks](#plugins-without-hooks-8)). The hook-loading path must tolerate plugins with no `hooks/hooks.json` -- they contribute no entries to the dispatch table. The "iterate, parse if present" pattern handles this cleanly.
5. **State schema evolution.** Adding per-plugin metadata later (e.g., hook execution stats, last-fired timestamps, payload-extension warning history) means schema versioning. The state loader should bump the `version` field, migrate forward, and fail clean on unknown future versions -- same pattern as V1 already uses elsewhere.
6. **Disable as quasi-uninstall.** Because `disable` requires `/reload` to take effect, the practical UX between "disable foo" and "uninstall foo" is identical from the user's perspective: both require a `/reload` and the plugin's hooks stop firing afterwards. The bridge can frame `disable` honestly as "uninstall without deleting the on-disk tree".

## Bridge implications (general)

Independent of the fidelity analysis above:

1. **Matcher translation is trivial.** Both systems are globally-scoped; Claude's `matcher` regex collapses to a string check inside the Pi handler. No activation tracking, no per-component scoping logic.

2. **Mutation semantics differ in one important way.** Pi's `tool_call` mutates `event.input` in place; Claude's `PreToolUse` returns `updatedInput` inside `hookSpecificOutput`. The bridge has to write the parsed return value back onto `event.input` mutably. Easy mechanically, but a footgun if anyone reads the bridge by analogy to Pi's typical return-value handlers.

3. **Process-spawn cost is paid per event.** Claude hooks are shell commands; the bridge spawns them. `PreToolUse` (→ `tool_call`) fires on every LLM tool turn, so a slow hook directly slows the agent loop. This is the same trade-off Claude Code itself makes; not novel, but worth surfacing.

4. **Return-shape evolution risk.** Claude's PreToolUse block shape has evolved over time (the `permissionDecision` / `hookSpecificOutput` redesign). The bridge's payload translator should be version-aware per event type rather than a single generic adapter.

## Open questions

- ~~For the V1 bridge: literal-tool-name matchers only, or full regex matcher patterns?~~ **Answered for first-party** by the marketplace audit: only `security-guidance` uses matchers, all are pipe-alternation literals (`Edit|Write|MultiEdit|NotebookEdit`, `Bash`) and prefix-glob `if` conditions. A literal-OR + prefix-glob implementation gives 100% first-party coverage. Full regex remains open for the third-party ecosystem and should be settled by a separate third-party audit before V2.
- Is `pi-coding-agent` upstream open to accepting patches for the 5 E-bucket runtime exposures? If yes, the bridge can be designed with those events as forward-compatible no-ops that flip on at a known peer-dep version. Urgency is low -- no first-party plugin uses any E-bucket event.
- For C-bucket "bridge ships the feature": one mega-extension or composable sub-extensions? `TaskCreate` and worktree commands are genuinely useful outside the hook context, so they could be split off and reused. Note: no first-party plugin uses C-bucket events, so this can defer entirely until a third-party plugin needs it.
- For B-bucket synthesis: best-effort with documentation, or refuse to install plugins whose hooks depend on the brittle synthesized events? Probably the former for V1, but the policy should be explicit.
- ~~Are MCP elicitation hooks already plumbed through `pi-mcp-adapter`?~~ **Answered** by the [soft-dep audit](#soft-dep-extension-event-surfaces): no, pi-mcp-adapter neither registers the MCP `ElicitRequestSchema` handler nor exposes a `pi.events` surface. Two specific PRs to pi-mcp-adapter would unlock the pair; until then the events cannot fire under Pi.
- What other hook-payload extensions exist beyond `asyncRewake` (in the wider non-Anthropic plugin ecosystem)? The marketplace audit caught one because we read it; the bridge needs a strategy for detecting future ones (debug-log unknown payload fields is the minimum bar).
- **V1 scope question.** Given the marketplace audit shows only 5 distinct hook events used by Anthropic's plugins, should the alpha bridge implement just those 5 (`SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `Stop`) and defer the rest of bucket A
  - B + C + D to V2? Tradeoff: smaller alpha surface vs slower unlocks for third-party plugins.
- Should the bridge maintain a **plugin compatibility matrix** in the repo, refreshed periodically (CI job?) against the live marketplace? Would surface third-party drift before users hit it.

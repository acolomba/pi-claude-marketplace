# Hook compatibility

Feature-by-feature comparison of Claude Code's hooks system against the Pi-Claude bridge, with the design rationale for which features were implemented, which were deferred, and which the bridge declares unsupportable.

Legend: `✓` supported, `✗` not supported, `⚠` partial (see notes).

The upstream column reflects Claude Code's published hooks reference at [code.claude.com/docs/en/hooks](https://code.claude.com/docs/en/hooks). The Pi column reflects the bridge sources under `extensions/pi-claude-marketplace/bridges/hooks/` and `extensions/pi-claude-marketplace/domain/components/`.

## Events

| Event                                   | Claude Code | Pi  | Notes                                                                                   |
| --------------------------------------- | ----------- | --- | --------------------------------------------------------------------------------------- |
| `SessionStart`                          | ✓           | ✓   | matcher restricted to `startup` and `resume` (Pi has no analog for `clear` / `compact`) |
| `UserPromptSubmit`                      | ✓           | ✓   | matcher unsupported upstream; any non-empty matcher trips the bridge as well            |
| `PreToolUse`                            | ✓           | ✓   | tool-name matcher and `if` field                                                        |
| `PostToolUse`                           | ✓           | ✓   | tool-name matcher and `if` field                                                        |
| `PostToolUseFailure`                    | ✓           | ✓   | tool-name matcher and `if` field                                                        |
| `PreCompact`                            | ✓           | ⚠   | match-all matcher only -- Pi compact events carry no `trigger` field                    |
| `PostCompact`                           | ✓           | ⚠   | match-all matcher only -- same reason                                                   |
| `SessionEnd`                            | ✓           | ⚠   | match-all matcher only -- Pi `reason` vocabulary does not overlap safely                |
| `Stop`                                  | ✓           | ✓   | full decision control; see the turn-boundary timing shift below                         |
| `StopFailure`                           | ✓           | ✓   | fires on `error` / `length` endings; observation-only (output/exit code ignored)        |
| `SubagentStart`, `SubagentStop`         | ✓           | ✗   | blocked on `pi-subagents` wiring                                                        |
| `Notification`                          | ✓           | ✗   | Pi has no subscriber bus for user notifications                                         |
| `PermissionRequest`, `PermissionDenied` | ✓           | ✗   | Pi has no event for the permission dialog                                               |
| `MessageDisplay`                        | ✓           | ✗   | Pi has no render-time hook on assistant messages                                        |
| `PostToolBatch`                         | ✓           | ✗   | Pi per-turn boundary differs from Claude's parallel-batch boundary                      |
| `UserPromptExpansion`                   | ✓           | ✗   | Pi slash-command expansion follows a different pipeline                                 |
| `FileChanged`                           | ✓           | ✗   | filesystem watcher deferred                                                             |
| `CwdChanged`                            | ✓           | ✗   | Pi exposes cwd but does not emit an event when it changes                               |
| `Elicitation`, `ElicitationResult`      | ✓           | ✗   | blocked on `pi-mcp-adapter` exposing the relevant MCP request                           |
| `WorktreeCreate`, `WorktreeRemove`      | ✓           | ✗   | blocked on `pi-worktrees` publishing lifecycle events                                   |
| `TeammateIdle`                          | ✓           | ✗   | Pi has no agent-team primitive                                                          |
| `TaskCreated`, `TaskCompleted`          | ✓           | ✗   | Pi has no canonical task primitive                                                      |
| `ConfigChange`                          | ✓           | ✗   | matcher values name Claude-specific settings paths                                      |
| `Setup`                                 | ✓           | ✗   | Pi has no init-only CLI mode                                                            |
| `InstructionsLoaded`                    | ✓           | ✗   | Pi reads a different context-file set; matcher values are Claude-shaped                 |

### Turn-boundary timing shift

`Stop` is dispatched when the Pi agent has fully settled, which introduces one irreducible divergence from Claude Code. Upstream, a blocked stop folds the continuation into the _same_ turn -- the agent never visibly stopped. Under Pi, by the time the bridge can decide, the agent has settled; a `decision: "block"` re-entry starts a _new_ turn with the block reason as its trigger. Hook scripts cannot observe the difference: the stdin payload, the `stop_hook_active` flag cadence, and the 8-block cap are all identical, and the LLM receives the reason as context either way. The only visible trace is an extra turn boundary in the transcript.

Because the shift is not hook-observable, `Stop` and `StopFailure` are marked `✓` (full support) rather than `⚠` (a contract restriction a hook author must code around). See [`docs/research/issue-103-stop-stopfailure-promotion.md`](research/issue-103-stop-stopfailure-promotion.md) for the full feasibility and design analysis.

### Event status classification

The unsupported events fall into three buckets, each with a different forward path:

**Deferred for engineering reasons** -- a faithful Pi-side translation is possible but not yet built. A future milestone may lift these:

- `FileChanged` -- the bridge could watch the filesystem itself but the implementation is deferred.
- `CwdChanged` -- Pi exposes the working directory but does not emit an event when it changes.
- `PostToolBatch` -- Pi's per-turn boundary differs from Claude's parallel-batch boundary; a faithful translation is deferred.
- `UserPromptExpansion` -- slash-command expansion under Pi follows a different pipeline.
- `SubagentStart` and `SubagentStop` -- supported only when `pi-subagents` is installed; the bridge does not yet wire these through.

**Blocked on upstream Pi support** -- the bridge cannot expose these until Pi exposes the underlying primitive:

- `Notification` -- the Pi runtime does not expose a subscriber bus for user notifications.
- `PermissionRequest` -- Pi has no event for the permission dialog.
- `PermissionDenied` -- Pi has no auto-mode classifier corresponding to Claude's deny path.
- `MessageDisplay` -- Pi does not expose a render-time hook on assistant messages.
- `TeammateIdle` -- Pi has no agent-team primitive yet.
- `Elicitation` and `ElicitationResult` -- blocked on `pi-mcp-adapter` exposing the relevant MCP request.
- `WorktreeCreate` and `WorktreeRemove` -- blocked on `pi-worktrees` publishing lifecycle events.

**Permanently inapplicable to Pi** -- the runtime semantics these events name do not exist under Pi and will not appear in any future milestone:

- `ConfigChange` -- the matcher values name Claude-specific settings paths that have no equivalent under Pi.
- `Setup` -- Pi has no init-only command-line mode.
- `InstructionsLoaded` -- Pi reads a different context-file set; the matcher values are Claude-shaped and would not apply.
- `TaskCreated` and `TaskCompleted` -- Pi has no canonical task primitive.

## Matcher syntax

| Feature                                                                                                                          | Claude Code | Pi  | Notes                                                                                                                                                                                                                                                                                                                                              |
| -------------------------------------------------------------------------------------------------------------------------------- | ----------- | --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Literal tool name (`Bash`, `Edit`)                                                                                               | ✓           | ✓   |                                                                                                                                                                                                                                                                                                                                                    |
| Pipe-OR alternation (`Edit\|Write`)                                                                                              | ✓           | ✓   |                                                                                                                                                                                                                                                                                                                                                    |
| Empty / `*` / omitted -> match-all                                                                                               | ✓           | ✓   |                                                                                                                                                                                                                                                                                                                                                    |
| Regex matcher                                                                                                                    | ✓           | ✗   | any character outside the safe charset drops the matcher group per-entry; the plugin resolves `(partially-available)`                                                                                                                                                                                                                              |
| MCP literal (`mcp__<server>__<tool>`)                                                                                            | ✓           | ✓   |                                                                                                                                                                                                                                                                                                                                                    |
| MCP wildcards (`mcp__*`, `mcp__github__.*`)                                                                                      | ✓           | ✗   | regex -> unsupported                                                                                                                                                                                                                                                                                                                               |
| Tools without a Pi analog (`MultiEdit`, `NotebookEdit`, `WebFetch`, `WebSearch`, `Task`, `TodoWrite`, `KillShell`, `BashOutput`) | ✓           | ✗   | unmapped -> unsupported                                                                                                                                                                                                                                                                                                                            |
| `SessionStart` source matcher (`startup`, `resume`)                                                                              | ✓           | ✓   |                                                                                                                                                                                                                                                                                                                                                    |
| `SessionStart` `clear`, `compact`                                                                                                | ✓           | ✗   | no Pi analog                                                                                                                                                                                                                                                                                                                                       |
| `SessionEnd` reason matcher                                                                                                      | ✓           | ✗   | empty closed set; only match-all supportable                                                                                                                                                                                                                                                                                                       |
| `PreCompact` / `PostCompact` (`manual`, `auto`)                                                                                  | ✓           | ✗   | Pi compact events carry no `trigger` field                                                                                                                                                                                                                                                                                                         |
| `Stop` matcher (none upstream)                                                                                                   | ✗           | ✗   | neither side supports it; the bridge reports a non-empty matcher as a `no-matcher-support` drop rather than ignoring it (UserPromptSubmit precedent)                                                                                                                                                                                               |
| `StopFailure` error-type matcher                                                                                                 | ✓           | ✓   | closed 10-value set: `rate_limit`, `overloaded`, `authentication_failed`, `oauth_org_not_allowed`, `billing_error`, `invalid_request`, `model_not_found`, `server_error`, `max_output_tokens`, `unknown`; exact whole-string match against the closed set (no case-folding, no pipe-OR splitting; any other value drops the group as `closed-set`) |

### Tool name mapping

The `matcher` field on tool events (`PreToolUse`, `PostToolUse`, `PostToolUseFailure`) names a tool. Claude plugins use the Claude-side spellings; the bridge translates them to the Pi-side spellings used by the Pi event payload. The two columns below are equivalent: a matcher value of `Edit` matches the Pi `edit` tool, and vice versa.

| Pi tool name | Claude tool name |
| ------------ | ---------------- |
| `bash`       | `Bash`           |
| `read`       | `Read`           |
| `edit`       | `Edit`           |
| `write`      | `Write`          |
| `grep`       | `Grep`           |
| `find`       | `Glob`           |
| `ls`         | `LS`             |

Unmapped Claude tools: `MultiEdit`, `NotebookEdit`, `WebFetch`, `WebSearch`, `Task`, `TodoWrite`, `KillShell`, `BashOutput`, and any `mcp__*` MCP server tool. A matcher value naming one of these tools cannot be translated because there is no Pi-side analog; the affected hook entry drops per-entry and the plugin resolves `(partially-available)` under the single aggregate `{unsupported hooks}` brace. A pipe-OR matcher containing any unmapped alternative drops the whole matcher group -- `Edit|Write|MultiEdit` drops even though two of its alternatives are mapped (this is why security-guidance's `Edit|Write|MultiEdit|NotebookEdit` group drops and the plugin resolves partially-available).

## `if` field

| Prefix                                                                                 | Claude Code | Pi  | Notes                                                               |
| -------------------------------------------------------------------------------------- | ----------- | --- | ------------------------------------------------------------------- |
| `Bash(<command-glob>)`                                                                 | ✓           | ✓   | compound-split, wrapper-strip, `:*` suffix, word-boundary           |
| `Read(<path-glob>)`                                                                    | ✓           | ✓   | cross-tool: covers Pi `read`, `grep`, `find`, `ls`                  |
| `Edit(<path-glob>)`                                                                    | ✓           | ✓   | cross-tool: covers Pi `edit`, `write`                               |
| `Write(<path-glob>)`                                                                   | ✓           | ✓   |                                                                     |
| `mcp__<server>__<tool>` literal                                                        | ✓           | ✓   |                                                                     |
| `mcp__<server>` / `mcp__<server>__*` prefix                                            | ✓           | ✓   |                                                                     |
| Bare tool names without parens (`Bash`, `Read`)                                        | ✓           | ⚠   | falls open (matches Claude Code's match-everything semantic)        |
| `Grep(...)`, `Glob(...)`, `LS(...)`                                                    | ✓           | ✗   | falls open; rewrite as `Read(...)`                                  |
| `MultiEdit(...)`, `NotebookEdit(...)`                                                  | ✓           | ✗   | falls open; rewrite as `Edit(...)`                                  |
| `PowerShell(...)`, `Cd(...)`                                                           | ✓           | ✗   | falls open (out-of-scope tools on Pi)                               |
| `WebFetch(domain:host)`, `Agent(<name>)`                                               | ✓           | ✗   | falls open (no `if`-field support for these tools)                  |
| Parameter matching: `Agent(model:opus)`, `Bash(run_in_background:true)`                | ✓           | ✗   | falls open; the bridge does not inspect tool input parameters       |
| Tool-name wildcards (`*`, `mcp__*`, `mcp__github__get_*`)                              | ✓           | ✗   | falls open                                                          |
| Glob `*` within-segment, `**` cross-segment                                            | ✓           | ✓   |                                                                     |
| Path anchors `//abs`, `~/home`, `/project-root`, `./cwd`, bare-relative, bare-filename | ✓           | ✓   | `projectRoot` falls back to `cwd` until Pi exposes a richer surface |
| Bash compound split (`&&`, `\|\|`, `;`, `\|`, `\|&`, `&`, newlines)                    | ✓           | ✓   |                                                                     |
| Bash wrapper-strip (`timeout`, `time`, `nice`, `nohup`, `stdbuf`, `xargs`)             | ✓           | ✓   |                                                                     |
| `$(...)`, backticks, `$VAR` -> fail-open fire                                          | ✓           | ✓   | command treated as uncertain                                        |
| `if` on a non-tool event                                                               | ✓           | ⚠   | compiles to match-all (effectively ignored)                         |
| Malformed permission-rule syntax (`Bash(`, broken globs)                               | ✓           | ⚠   | falls open with a debug-log warning                                 |

## Handler types

| Type       | Claude Code | Pi  | Notes                                                                         |
| ---------- | ----------- | --- | ----------------------------------------------------------------------------- |
| `command`  | ✓           | ✓   |                                                                               |
| `http`     | ✓           | ✗   | unsupported handler; drops per-entry, plugin resolves `(partially-available)` |
| `mcp_tool` | ✓           | ✗   | unsupported                                                                   |
| `prompt`   | ✓           | ✗   | unsupported                                                                   |
| `agent`    | ✓           | ✗   | unsupported                                                                   |

## Handler fields

| Field                                      | Claude Code | Pi  | Notes                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------ | ----------- | --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `command`                                  | ✓           | ✓   | required when `type === "command"`                                                                                                                                                                                                                                                                                                                                                                       |
| `args` (exec-form, no shell)               | ✓           | ✓   | presence switches to exec-form spawn                                                                                                                                                                                                                                                                                                                                                                     |
| `shell` (override)                         | ✓           | ✓   | accepts a shell-path string                                                                                                                                                                                                                                                                                                                                                                              |
| `timeout`                                  | ✓           | ⚠   | value in **seconds**; per-handler override; default 600 s, lowered to 30 s on `UserPromptSubmit` and 1.5 s on `SessionEnd` for synchronous handlers (`asyncRewake` keeps 600 s everywhere); a value that is not a positive finite number is ignored, not an error; `SessionEnd`'s budget is applied per hook rather than shared across them, and a declared value there is not capped at upstream's 60 s |
| `async`                                    | ✓           | ✓   | async dispatch with PID-table tracking                                                                                                                                                                                                                                                                                                                                                                   |
| `asyncRewake` (on-exit-2 wake-with-stderr) | ✓           | ⚠   | re-dispatches surviving children after Pi restart; never runs on `Stop` / `StopFailure` -- the settle path skips async handlers entirely (see silent drop below)                                                                                                                                                                                                                                         |
| `statusMessage` (spinner)                  | ✓           | ✗   | Pi has no per-handler spinner surface                                                                                                                                                                                                                                                                                                                                                                    |
| `if` (permission-rule filter)              | ✓           | ✓   | see the `if` field table above for prefix coverage                                                                                                                                                                                                                                                                                                                                                       |

## stdin, stdout, exit codes

| Feature                                                                           | Claude Code | Pi  | Notes                                                                                                                                            |
| --------------------------------------------------------------------------------- | ----------- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| JSON event on stdin                                                               | ✓           | ✓   | per-event payload                                                                                                                                |
| `stop_hook_active` (Stop stdin)                                                   | ✓           | ✓   | per-session loop flag; set on any bridge re-entry (block or `additionalContext`), cleared on the next user input                                 |
| `last_assistant_message` (Stop / StopFailure stdin)                               | ✓           | ✓   | Stop: final assistant message text (concatenated text blocks); StopFailure: Pi's rendered error text (`errorMessage`; empty on `length` endings) |
| Exit 0 -> success                                                                 | ✓           | ✓   |                                                                                                                                                  |
| Exit 2 -> blocking error, stderr to Claude                                        | ✓           | ✓   | per-event blocking semantics where the Pi event maps; on Stop, rides the block arm with stderr as the re-entry reason                            |
| Other exit -> non-blocking, stderr to user                                        | ✓           | ✓   |                                                                                                                                                  |
| `continue: false` -> stop the session                                             | ✓           | ✓   | wired in `wire-protocol.ts`; on Stop, top-level `continue: false` takes precedence over a block                                                  |
| `decision: "block"` (top-level)                                                   | ✓           | ✓   | per-event arms in `event-adapters.ts`; on Stop, re-enters via `followUp` + `triggerTurn`                                                         |
| `suppressOutput`                                                                  | ✓           | ✓   |                                                                                                                                                  |
| `systemMessage`                                                                   | ✓           | ✗   | not surfaced                                                                                                                                     |
| `terminalSequence` (OSC)                                                          | ✓           | ✗   | no terminal-sequence emit                                                                                                                        |
| `hookSpecificOutput.permissionDecision` (`allow`, `deny`, `ask`)                  | ✓           | ✓   | `defer` arm not implemented (non-interactive `-p` mode only upstream)                                                                            |
| `hookSpecificOutput.permissionDecisionReason`                                     | ✓           | ✓   |                                                                                                                                                  |
| `updatedInput`                                                                    | ✓           | ✓   | object-merge on tool-call events                                                                                                                 |
| `updatedToolOutput`                                                               | ✓           | ✓   | on tool-result events                                                                                                                            |
| `additionalContext` (SessionStart)                                                | ✓           | ✓   | drained via Pi's `before_agent_start`                                                                                                            |
| `additionalContext` (Stop)                                                        | ✓           | ✓   | re-enters the agent loop without a block (feedback labeling; STOP-05)                                                                            |
| `additionalContext` (other events)                                                | ✓           | ✗   | only the SessionStart and Stop capture paths are wired                                                                                           |
| `initialUserMessage`, `sessionTitle`, `watchPaths`, `reloadSkills` (SessionStart) | ✓           | ✗   |                                                                                                                                                  |
| `decision.behavior` for `PermissionRequest`                                       | ✓           | ✗   | event itself unsupported                                                                                                                         |
| `displayContent` for `MessageDisplay`                                             | ✓           | ✗   | event itself unsupported                                                                                                                         |

## Environment variables

[`docs/env-vars.md`](env-vars.md) is authoritative on any conflict about which environment variables ship; the table below is the hook-scoped view.

| Variable                                              | Claude Code | Pi  | Notes                                                                                                                                                                                |
| ----------------------------------------------------- | ----------- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `CLAUDE_PLUGIN_ROOT`                                  | ✓           | ✓   | absolute path to the installed plugin's root directory                                                                                                                               |
| `CLAUDE_PLUGIN_DATA`                                  | ✓           | ✓   | per-plugin, per-scope writable scratch directory                                                                                                                                     |
| `CLAUDE_PROJECT_DIR`                                  | ✓           | ✓   | absolute path to the user's project directory                                                                                                                                        |
| `CLAUDECODE`                                          | ✓           | ✓   | set to `1` at session start; on both hook lanes                                                                                                                                      |
| `CLAUDE_CODE_SESSION_ID`                              | ✓           | ✓   | the Pi session id; on both hook lanes                                                                                                                                                |
| `CLAUDE_SESSION_ID`                                   | --          | ✓   | pi-only alias of the session id; no upstream equivalent                                                                                                                              |
| `PATH`                                                | ✓           | ✓   | each installed enabled plugin's `<pluginRoot>/bin` is appended; inherited on both hook lanes via the `...process.env` spread                                                         |
| `PI_CLAUDE_MARKETPLACE_PATH`                          | --          | ✓   | pi-only PATH ledger of the appended plugin `bin` dirs; inherited via the `...process.env` spread; no upstream equivalent                                                             |
| `CLAUDE_EFFORT`                                       | ✓           | ✗   | Pi has no effort surface                                                                                                                                                             |
| `CLAUDE_CODE_REMOTE`                                  | ✓           | ✗   |                                                                                                                                                                                      |
| `CLAUDE_ENV_FILE`                                     | ✓           | ⚠   | path exposed on the SessionStart hook event (both spawn lanes); Pi does not source the file back, so vars a hook writes to it are not applied. See [`docs/env-vars.md`](env-vars.md) |
| `${tool_input.*}` interpolation in `command` / `args` | ✓           | ✗   |                                                                                                                                                                                      |
| `${user_config.*}` interpolation                      | ✓           | ✗   | Pi has no plugin user-config surface                                                                                                                                                 |
| `$ARGUMENTS` (prompt and agent hooks)                 | ✓           | ✗   | those handler types unsupported                                                                                                                                                      |

## Configuration surfaces

| Surface                                 | Claude Code | Pi  | Notes                                        |
| --------------------------------------- | ----------- | --- | -------------------------------------------- |
| Plugin `hooks/hooks.json`               | ✓           | ✓   |                                              |
| `~/.claude/settings.json` (user)        | ✓           | ✗   | non-plugin settings-driven hooks not bridged |
| `.claude/settings.json` (project)       | ✓           | ✗   |                                              |
| `.claude/settings.local.json`           | ✓           | ✗   |                                              |
| Managed policy settings                 | ✓           | ✗   |                                              |
| `/hooks` slash command (browser / edit) | ✓           | ✗   |                                              |
| `disableAllHooks` kill-switch           | ✓           | ✗   |                                              |

## Async and lifecycle

| Feature                                        | Claude Code | Pi  | Notes                                                                                                                                                         |
| ---------------------------------------------- | ----------- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Long-running handlers                          | ✓           | ✓   | PID-table reaping after Pi restart                                                                                                                            |
| Restart-survival rewake                        | ✓           | ✓   | async-rewake re-dispatches surviving children                                                                                                                 |
| Hook dedupe (identical commands on same event) | ✓           | ✗   |                                                                                                                                                               |
| Parallel hooks on same event with merge        | ✓           | ⚠   | dispatch fans out per matching entry; cross-handler permission-merge semantics are not modeled (the upstream `PermissionRequest` event is itself unsupported) |
| Most-restrictive-wins for PreToolUse           | ✓           | ✓   | `deny` is terminal in the reducer                                                                                                                             |

## Install-time disposition

The bridge picks one of four responses when a plugin declares a feature outside the supported set:

**Partial-partition drop** -- when a `hooks.json` parses and validates cleanly but declares an unsupportable event, matcher group, or handler type, the bridge drops only the offending entries and installs the rest. The plugin resolves `(partially-available)` and, once installed, derives `(partially-installed)`. Every dropped entry rides a SINGLE aggregate `{unsupported hooks}` brace (D-71-04); the per-handler `event(matcher) (unsupported)` breakdown is shown on the `plugin info` surface (D-71-05). The bridge favors partial support over a whole-plugin failure so that a plugin's supported hooks still run. Applies to:

- any unsupportable event in `hooks.json` (it drops per-entry; supported events declared alongside it still install)
- regex matchers
- tool-name matchers naming a Claude tool with no Pi analog
- non-tool matchers outside the per-event closed set (for example, `clear` or `compact` on `SessionStart`)
- any handler `type` other than `"command"`

**Structural unavailable** -- a structurally malformed `hooks.json` (invalid JSON, or a schema failure such as a `type: "command"` handler missing its `command`) resolves `(unavailable)` and none of the plugin's hooks install. This is a distinct arm from the partial-partition drop above: its reason brace is sourced through `narrowResolverNotes`, not the `narrowUnsupportedKinds` path the partial drop uses.

**Silent fall-open** -- the hook fires on every matcher hit and a `hookDebugLog` warning records the cause. This matches Claude Code's documented best-effort contract for the `if` field. Applies to:

- every `if`-field shape outside the supported prefix set (`Grep(...)`, `LS(...)`, parameter matching, tool-name wildcards, unknown prefixes)
- malformed `if` syntax (`Bash(` with no close, broken globs)
- `if` on non-tool events
- runtime Bash commands containing `$(...)`, backticks, or `$VAR`

**Silent drop** -- the bridge accepts the field at parse time but never acts on it. Applies to:

- `systemMessage`, `terminalSequence` -- no Pi surface to render them
- `initialUserMessage`, `sessionTitle`, `watchPaths`, `reloadSkills` on `SessionStart`
- `additionalContext` on events other than `SessionStart` and `Stop`
- `asyncRewake` on `Stop` / `StopFailure` -- the settle path needs a synchronous outcome, so the handler is never spawned at all (the entry degrades to a no-op; a `hookDebugLog` line records the drop)

## Further reading

- [Claude Code hooks reference](https://code.claude.com/docs/en/hooks) -- the upstream authoritative field reference, including worked examples, the full `if`-permission-rule grammar, precedence rules, the per-event stdin and stdout contracts, and the complete environment-variable list the bridge inherits.
- Pi extension API documentation via the `@mariozechner/pi-coding-agent` package -- the host runtime contract, including how the bridge subscribes to Pi events, how hook output is injected back into the assistant's turn, and how user-visible notifications are emitted.

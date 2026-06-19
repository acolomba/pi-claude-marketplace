# Hook compatibility

Feature-by-feature comparison of Claude Code's hooks system against the Pi-Claude bridge in v1.13, with the design rationale for which features were implemented, which were deferred, and which the bridge declares unsupportable.

Legend: `✓` supported, `✗` not supported, `⚠` partial (see notes).

The upstream column reflects Claude Code's published hooks reference at [code.claude.com/docs/en/hooks](https://code.claude.com/docs/en/hooks). The Pi column reflects the v1.13 bridge sources under `extensions/pi-claude-marketplace/bridges/hooks/` and `extensions/pi-claude-marketplace/domain/components/`.

## Events

| Event                                   | Claude Code | Pi v1.13 | Notes                                                                                   |
| --------------------------------------- | ----------- | -------- | --------------------------------------------------------------------------------------- |
| `SessionStart`                          | ✓           | ✓        | matcher restricted to `startup` and `resume` (Pi has no analog for `clear` / `compact`) |
| `UserPromptSubmit`                      | ✓           | ✓        | matcher unsupported upstream; any non-empty matcher trips the bridge as well            |
| `PreToolUse`                            | ✓           | ✓        | tool-name matcher and `if` field                                                        |
| `PostToolUse`                           | ✓           | ✓        | tool-name matcher and `if` field                                                        |
| `PostToolUseFailure`                    | ✓           | ✓        | tool-name matcher and `if` field                                                        |
| `PreCompact`                            | ✓           | ⚠        | match-all matcher only -- Pi compact events carry no `trigger` field                    |
| `PostCompact`                           | ✓           | ⚠        | match-all matcher only -- same reason                                                   |
| `SessionEnd`                            | ✓           | ⚠        | match-all matcher only -- Pi `reason` vocabulary does not overlap safely                |
| `Stop`                                  | ✓           | ✗        | Pi end-of-turn is observation-only; cannot honor block-to-continue                      |
| `StopFailure`                           | ✓           | ✗        | Pi has no turn-ended-by-error event                                                     |
| `SubagentStart`, `SubagentStop`         | ✓           | ✗        | blocked on `pi-subagents` wiring                                                        |
| `Notification`                          | ✓           | ✗        | Pi has no subscriber bus for user notifications                                         |
| `PermissionRequest`, `PermissionDenied` | ✓           | ✗        | Pi has no event for the permission dialog                                               |
| `MessageDisplay`                        | ✓           | ✗        | Pi has no render-time hook on assistant messages                                        |
| `PostToolBatch`                         | ✓           | ✗        | Pi per-turn boundary differs from Claude's parallel-batch boundary                      |
| `UserPromptExpansion`                   | ✓           | ✗        | Pi slash-command expansion follows a different pipeline                                 |
| `FileChanged`                           | ✓           | ✗        | filesystem watcher deferred                                                             |
| `CwdChanged`                            | ✓           | ✗        | Pi exposes cwd but does not emit an event when it changes                               |
| `Elicitation`, `ElicitationResult`      | ✓           | ✗        | blocked on `pi-mcp-adapter` exposing the relevant MCP request                           |
| `WorktreeCreate`, `WorktreeRemove`      | ✓           | ✗        | blocked on `pi-worktrees` publishing lifecycle events                                   |
| `TeammateIdle`                          | ✓           | ✗        | Pi has no agent-team primitive                                                          |
| `TaskCreated`, `TaskCompleted`          | ✓           | ✗        | Pi has no canonical task primitive                                                      |
| `ConfigChange`                          | ✓           | ✗        | matcher values name Claude-specific settings paths                                      |
| `Setup`                                 | ✓           | ✗        | Pi has no init-only CLI mode                                                            |
| `InstructionsLoaded`                    | ✓           | ✗        | Pi reads a different context-file set; matcher values are Claude-shaped                 |

### Event status classification

The unsupported events fall into three buckets, each with a different forward path:

**Deferred for engineering reasons** -- a faithful Pi-side translation is possible but not yet built. A future milestone may lift these:

- `FileChanged` -- the bridge could watch the filesystem itself but the implementation is deferred.
- `Stop` -- Pi's session-end event is observation-only and cannot honor the block-to-continue contract Claude plugins rely on.
- `CwdChanged` -- Pi exposes the working directory but does not emit an event when it changes.
- `PostToolBatch` -- Pi's per-turn boundary differs from Claude's parallel-batch boundary; a faithful translation is deferred.
- `UserPromptExpansion` -- slash-command expansion under Pi follows a different pipeline.
- `StopFailure` -- Pi does not emit a dedicated turn-ended-by-error event.
- `SubagentStart` and `SubagentStop` -- supported only when `pi-subagents` is installed; the v1.13 bridge does not yet wire these through.

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

| Feature                                                                                                                          | Claude Code | Pi v1.13 | Notes                                                                            |
| -------------------------------------------------------------------------------------------------------------------------------- | ----------- | -------- | -------------------------------------------------------------------------------- |
| Literal tool name (`Bash`, `Edit`)                                                                                               | ✓           | ✓        |                                                                                  |
| Pipe-OR alternation (`Edit\|Write`)                                                                                              | ✓           | ✓        |                                                                                  |
| Empty / `*` / omitted -> match-all                                                                                               | ✓           | ✓        |                                                                                  |
| Regex matcher                                                                                                                    | ✓           | ✗        | any character outside the safe charset trips `(unavailable) {unsupported hooks}` |
| MCP literal (`mcp__<server>__<tool>`)                                                                                            | ✓           | ✓        |                                                                                  |
| MCP wildcards (`mcp__*`, `mcp__github__.*`)                                                                                      | ✓           | ✗        | regex -> unsupported                                                             |
| Tools without a Pi analog (`MultiEdit`, `NotebookEdit`, `WebFetch`, `WebSearch`, `Task`, `TodoWrite`, `KillShell`, `BashOutput`) | ✓           | ✗        | unmapped -> unsupported                                                          |
| `SessionStart` source matcher (`startup`, `resume`)                                                                              | ✓           | ✓        |                                                                                  |
| `SessionStart` `clear`, `compact`                                                                                                | ✓           | ✗        | no Pi analog                                                                     |
| `SessionEnd` reason matcher                                                                                                      | ✓           | ✗        | empty closed set; only match-all supportable                                     |
| `PreCompact` / `PostCompact` (`manual`, `auto`)                                                                                  | ✓           | ✗        | Pi compact events carry no `trigger` field                                       |

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

Unmapped Claude tools: `MultiEdit`, `NotebookEdit`, `WebFetch`, `WebSearch`, `Task`, `TodoWrite`, `KillShell`, `BashOutput`, and any `mcp__*` MCP server tool. A matcher value naming one of these tools cannot be translated because there is no Pi-side analog; the plugin will install with `(unavailable) {unsupported hooks}` unless the matcher also matches a tool name that does have a mapping (for example, `Edit|Write|MultiEdit` would still install if the bridge accepts at least one of the alternatives -- but the unmapped alternative will never fire).

## `if` field

| Prefix                                                                                 | Claude Code | Pi v1.13 | Notes                                                               |
| -------------------------------------------------------------------------------------- | ----------- | -------- | ------------------------------------------------------------------- |
| `Bash(<command-glob>)`                                                                 | ✓           | ✓        | compound-split, wrapper-strip, `:*` suffix, word-boundary           |
| `Read(<path-glob>)`                                                                    | ✓           | ✓        | cross-tool: covers Pi `read`, `grep`, `find`, `ls`                  |
| `Edit(<path-glob>)`                                                                    | ✓           | ✓        | cross-tool: covers Pi `edit`, `write`                               |
| `Write(<path-glob>)`                                                                   | ✓           | ✓        |                                                                     |
| `mcp__<server>__<tool>` literal                                                        | ✓           | ✓        |                                                                     |
| `mcp__<server>` / `mcp__<server>__*` prefix                                            | ✓           | ✓        |                                                                     |
| Bare tool names without parens (`Bash`, `Read`)                                        | ✓           | ⚠        | falls open (matches Claude Code's match-everything semantic)        |
| `Grep(...)`, `Glob(...)`, `LS(...)`                                                    | ✓           | ✗        | falls open; rewrite as `Read(...)`                                  |
| `MultiEdit(...)`, `NotebookEdit(...)`                                                  | ✓           | ✗        | falls open; rewrite as `Edit(...)`                                  |
| `PowerShell(...)`, `Cd(...)`                                                           | ✓           | ✗        | falls open (out-of-scope tools on Pi)                               |
| `WebFetch(domain:host)`, `Agent(<name>)`                                               | ✓           | ✗        | falls open (no `if`-field support in v1.13)                         |
| Parameter matching: `Agent(model:opus)`, `Bash(run_in_background:true)`                | ✓           | ✗        | falls open; the bridge does not inspect tool input parameters       |
| Tool-name wildcards (`*`, `mcp__*`, `mcp__github__get_*`)                              | ✓           | ✗        | falls open                                                          |
| Glob `*` within-segment, `**` cross-segment                                            | ✓           | ✓        |                                                                     |
| Path anchors `//abs`, `~/home`, `/project-root`, `./cwd`, bare-relative, bare-filename | ✓           | ✓        | `projectRoot` falls back to `cwd` until Pi exposes a richer surface |
| Bash compound split (`&&`, `\|\|`, `;`, `\|`, `\|&`, `&`, newlines)                    | ✓           | ✓        |                                                                     |
| Bash wrapper-strip (`timeout`, `time`, `nice`, `nohup`, `stdbuf`, `xargs`)             | ✓           | ✓        |                                                                     |
| `$(...)`, backticks, `$VAR` -> fail-open fire                                          | ✓           | ✓        | command treated as uncertain                                        |
| `if` on a non-tool event                                                               | ✓           | ⚠        | compiles to match-all (effectively ignored)                         |
| Malformed permission-rule syntax (`Bash(`, broken globs)                               | ✓           | ⚠        | falls open with a debug-log warning                                 |

## Handler types

| Type       | Claude Code | Pi v1.13 | Notes                                            |
| ---------- | ----------- | -------- | ------------------------------------------------ |
| `command`  | ✓           | ✓        |                                                  |
| `http`     | ✓           | ✗        | plugin trips `(unavailable) {unsupported hooks}` |
| `mcp_tool` | ✓           | ✗        | unsupported                                      |
| `prompt`   | ✓           | ✗        | unsupported                                      |
| `agent`    | ✓           | ✗        | unsupported                                      |

## Handler fields

| Field                                      | Claude Code | Pi v1.13 | Notes                                              |
| ------------------------------------------ | ----------- | -------- | -------------------------------------------------- |
| `command`                                  | ✓           | ✓        | required when `type === "command"`                 |
| `args` (exec-form, no shell)               | ✓           | ✓        | presence switches to exec-form spawn               |
| `shell` (override)                         | ✓           | ✓        | accepts a shell-path string                        |
| `timeout`                                  | ✓           | ✓        | per-handler override; 600 s default                |
| `async`                                    | ✓           | ✓        | async dispatch with PID-table tracking             |
| `asyncRewake` (on-exit-2 wake-with-stderr) | ✓           | ✓        | re-dispatches surviving children after Pi restart  |
| `statusMessage` (spinner)                  | ✓           | ✗        | Pi has no per-handler spinner surface              |
| `if` (permission-rule filter)              | ✓           | ✓        | see the `if` field table above for prefix coverage |

## stdin, stdout, exit codes

| Feature                                                                           | Claude Code | Pi v1.13 | Notes                                                                 |
| --------------------------------------------------------------------------------- | ----------- | -------- | --------------------------------------------------------------------- |
| JSON event on stdin                                                               | ✓           | ✓        | per-event payload                                                     |
| Exit 0 -> success                                                                 | ✓           | ✓        |                                                                       |
| Exit 2 -> blocking error, stderr to Claude                                        | ✓           | ✓        | per-event blocking semantics where the Pi event maps                  |
| Other exit -> non-blocking, stderr to user                                        | ✓           | ✓        |                                                                       |
| `continue: false` -> stop the session                                             | ✓           | ✓        | wired in `wire-protocol.ts`                                           |
| `decision: "block"` (top-level)                                                   | ✓           | ✓        | per-event arms in `event-adapters.ts`                                 |
| `suppressOutput`                                                                  | ✓           | ✓        |                                                                       |
| `systemMessage`                                                                   | ✓           | ✗        | not surfaced                                                          |
| `terminalSequence` (OSC)                                                          | ✓           | ✗        | no terminal-sequence emit                                             |
| `hookSpecificOutput.permissionDecision` (`allow`, `deny`, `ask`)                  | ✓           | ✓        | `defer` arm not implemented (non-interactive `-p` mode only upstream) |
| `hookSpecificOutput.permissionDecisionReason`                                     | ✓           | ✓        |                                                                       |
| `updatedInput`                                                                    | ✓           | ✓        | object-merge on tool-call events                                      |
| `updatedToolOutput`                                                               | ✓           | ✓        | on tool-result events                                                 |
| `additionalContext` (SessionStart)                                                | ✓           | ✓        | drained via Pi's `before_agent_start`                                 |
| `additionalContext` (other events)                                                | ✓           | ✗        | only the SessionStart capture path is wired                           |
| `initialUserMessage`, `sessionTitle`, `watchPaths`, `reloadSkills` (SessionStart) | ✓           | ✗        |                                                                       |
| `decision.behavior` for `PermissionRequest`                                       | ✓           | ✗        | event itself unsupported                                              |
| `displayContent` for `MessageDisplay`                                             | ✓           | ✗        | event itself unsupported                                              |

## Environment variables

| Variable                                              | Claude Code | Pi v1.13 | Notes                                                  |
| ----------------------------------------------------- | ----------- | -------- | ------------------------------------------------------ |
| `CLAUDE_PLUGIN_ROOT`                                  | ✓           | ✓        | absolute path to the installed plugin's root directory |
| `CLAUDE_PLUGIN_DATA`                                  | ✓           | ✓        | per-plugin, per-scope writable scratch directory       |
| `CLAUDE_PROJECT_DIR`                                  | ✓           | ✓        | absolute path to the user's project directory          |
| `CLAUDE_EFFORT`                                       | ✓           | ✗        | Pi has no effort surface                               |
| `CLAUDE_CODE_REMOTE`                                  | ✓           | ✗        |                                                        |
| `CLAUDE_ENV_FILE` (sourced before each Bash command)  | ✓           | ✗        |                                                        |
| `${tool_input.*}` interpolation in `command` / `args` | ✓           | ✗        |                                                        |
| `${user_config.*}` interpolation                      | ✓           | ✗        | Pi has no plugin user-config surface                   |
| `$ARGUMENTS` (prompt and agent hooks)                 | ✓           | ✗        | those handler types unsupported                        |

## Configuration surfaces

| Surface                                 | Claude Code | Pi v1.13 | Notes                                        |
| --------------------------------------- | ----------- | -------- | -------------------------------------------- |
| Plugin `hooks/hooks.json`               | ✓           | ✓        |                                              |
| `~/.claude/settings.json` (user)        | ✓           | ✗        | non-plugin settings-driven hooks not bridged |
| `.claude/settings.json` (project)       | ✓           | ✗        |                                              |
| `.claude/settings.local.json`           | ✓           | ✗        |                                              |
| Managed policy settings                 | ✓           | ✗        |                                              |
| `/hooks` slash command (browser / edit) | ✓           | ✗        |                                              |
| `disableAllHooks` kill-switch           | ✓           | ✗        |                                              |

## Async and lifecycle

| Feature                                        | Claude Code | Pi v1.13 | Notes                                                                                                                                                         |
| ---------------------------------------------- | ----------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Long-running handlers                          | ✓           | ✓        | PID-table reaping after Pi restart                                                                                                                            |
| Restart-survival rewake                        | ✓           | ✓        | async-rewake re-dispatches surviving children                                                                                                                 |
| Hook dedupe (identical commands on same event) | ✓           | ✗        |                                                                                                                                                               |
| Parallel hooks on same event with merge        | ✓           | ⚠        | dispatch fans out per matching entry; cross-handler permission-merge semantics are not modeled (the upstream `PermissionRequest` event is itself unsupported) |
| Most-restrictive-wins for PreToolUse           | ✓           | ✓        | `deny` is terminal in the reducer                                                                                                                             |

## Install-time disposition

The bridge picks one of three responses when a plugin declares a feature outside the supported set:

**Hard install-time trip** -- the plugin flips to `(unavailable) {unsupported hooks}` and none of its hooks run. The bridge chooses strict supportability over partial support because the alternative is silently dropping half of a hook set -- a plugin author whose `PostToolUse` handler runs but whose `Stop` handler does not has no way to discover the gap until something goes wrong. Failing the install fast surfaces the unsupported feature immediately so you can plan around it (rewrite the plugin to use only supported events, gate the unsupported events behind a feature flag, or wait for a future milestone that lifts the restriction). Applies to:

- any unsupported event in `hooks.json` (including events that are supported but the plugin also declares an unsupported one alongside)
- regex matchers
- tool-name matchers naming a Claude tool with no Pi analog
- non-tool matchers outside the per-event closed set (for example, `clear` or `compact` on `SessionStart`)
- any handler `type` other than `"command"`

**Silent fall-open** -- the hook fires on every matcher hit and a `hookDebugLog` warning records the cause. This matches Claude Code's documented best-effort contract for the `if` field. Applies to:

- every `if`-field shape outside the supported prefix set (`Grep(...)`, `LS(...)`, parameter matching, tool-name wildcards, unknown prefixes)
- malformed `if` syntax (`Bash(` with no close, broken globs)
- `if` on non-tool events
- runtime Bash commands containing `$(...)`, backticks, or `$VAR`

**Silent drop** -- the bridge accepts the field at parse time but never acts on it. Applies to:

- `systemMessage`, `terminalSequence` -- no Pi surface to render them
- `initialUserMessage`, `sessionTitle`, `watchPaths`, `reloadSkills` on `SessionStart`
- `additionalContext` on events other than `SessionStart`

## Further reading

- [Claude Code hooks reference](https://code.claude.com/docs/en/hooks) -- the upstream authoritative field reference, including worked examples, the full `if`-permission-rule grammar, precedence rules, the per-event stdin and stdout contracts, and the complete environment-variable list the bridge inherits.
- Pi extension API documentation via the `@mariozechner/pi-coding-agent` package -- the host runtime contract, including how the bridge subscribes to Pi events, how hook output is injected back into the assistant's turn, and how user-visible notifications are emitted.

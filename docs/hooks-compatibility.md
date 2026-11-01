# Hook compatibility

Feature-by-feature comparison of Claude Code's hooks system against the Pi-Claude bridge, with the design rationale for which features were implemented, which were deferred, and which the bridge declares unsupportable.

Legend: `✓` supported, `✗` not supported, `⚠` partial (see notes).

The upstream column reflects Claude Code 2.1.316 and its published hooks reference at [code.claude.com/docs/en/hooks](https://code.claude.com/docs/en/hooks). The Pi column reflects the bridge sources under `extensions/pi-claude-marketplace/bridges/hooks/` and `extensions/pi-claude-marketplace/domain/components/`, and the behavior that the cucumber scenarios under `features/hook/` prove (D-CF5-21). A note names its decision ID, such as `D-CF5-01`. A note that describes a difference from Claude Code also names its reason: a Pi gap (Pi has no matching capability) or a project decision.

## Events

| Event                                   | Claude Code | Pi  | Notes                                                                                                                                                                                             |
| --------------------------------------- | ----------- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SessionStart`                          | ✓           | ✓   | `source` is `startup`, `resume`, `clear`, `compact`, or `fork`; see [Session events](#session-events) (D-CF5-01, D-CF5-04)                                                                        |
| `UserPromptSubmit`                      | ✓           | ✓   | matcher unsupported upstream; any non-empty matcher trips the bridge as well                                                                                                                      |
| `PreToolUse`                            | ✓           | ✓   | tool-name matcher and `if` field                                                                                                                                                                  |
| `PostToolUse`                           | ✓           | ✓   | tool-name matcher and `if` field                                                                                                                                                                  |
| `PostToolUseFailure`                    | ✓           | ✓   | tool-name matcher and `if` field                                                                                                                                                                  |
| `PreCompact`                            | ✓           | ✓   | `trigger` matcher `manual` or `auto` (D-CF5-04). A block cancels the compaction, as upstream; see [Compaction](#compaction) (D-CF5-18)                                                            |
| `PostCompact`                           | ✓           | ✓   | `trigger` matcher `manual` or `auto`, and stdin carries `compact_summary` (D-CF5-04)                                                                                                              |
| `SessionEnd`                            | ✓           | ⚠   | `reason` is `clear`, `resume`, `prompt_input_exit`, or `other`. `logout` is admitted and never sent, as upstream. A quit in the terminal by a signal sends `prompt_input_exit` (D-CF5-02, Pi gap) |
| `Stop`                                  | ✓           | ✓   | full decision control; see the turn-boundary timing shift below                                                                                                                                   |
| `StopFailure`                           | ✓           | ✓   | fires on `error` / `length` endings; observation-only (output/exit code ignored)                                                                                                                  |
| `SubagentStart`, `SubagentStop`         | ✓           | ✗   | blocked on `pi-subagents` wiring                                                                                                                                                                  |
| `Notification`                          | ✓           | ✗   | Pi has no subscriber bus for user notifications                                                                                                                                                   |
| `PermissionRequest`, `PermissionDenied` | ✓           | ✗   | Pi has no event for the permission dialog                                                                                                                                                         |
| `MessageDisplay`                        | ✓           | ✗   | Pi has no render-time hook on assistant messages                                                                                                                                                  |
| `PostToolBatch`                         | ✓           | ✗   | Pi per-turn boundary differs from Claude's parallel-batch boundary                                                                                                                                |
| `UserPromptExpansion`                   | ✓           | ✗   | Pi slash-command expansion follows a different pipeline                                                                                                                                           |
| `FileChanged`                           | ✓           | ✗   | filesystem watcher deferred                                                                                                                                                                       |
| `CwdChanged`                            | ✓           | ✗   | Pi exposes cwd but does not emit an event when it changes                                                                                                                                         |
| `DirectoryAdded`                        | ✓           | ✗   | Pi has no event for a directory that the user adds to the session (D-CF5-19, Pi gap)                                                                                                              |
| `PreModelSwitch`, `PostModelSwitch`     | ✓           | ✗   | not bridged yet (HKMS-01); reported as unsupported (D-CF5-19)                                                                                                                                     |
| `Elicitation`, `ElicitationResult`      | ✓           | ✗   | blocked on `pi-mcp-adapter` exposing the relevant MCP request                                                                                                                                     |
| `WorktreeCreate`, `WorktreeRemove`      | ✓           | ✗   | blocked on `pi-worktrees` publishing lifecycle events                                                                                                                                             |
| `TeammateIdle`                          | ✓           | ✗   | Pi has no agent-team primitive                                                                                                                                                                    |
| `TaskCreated`, `TaskCompleted`          | ✓           | ✗   | Pi has no canonical task primitive                                                                                                                                                                |
| `ConfigChange`                          | ✓           | ✗   | matcher values name Claude-specific settings paths                                                                                                                                                |
| `Setup`                                 | ✓           | ✗   | Pi has no init-only CLI mode                                                                                                                                                                      |
| `InstructionsLoaded`                    | ✓           | ✗   | Pi reads a different context-file set; matcher values are Claude-shaped                                                                                                                           |

A hook on an event that the bridge does not support is never dropped silently. The plugin reports `(partially-available)` with the reason `{unsupported hooks}`, and `plugin info` lists the hook as `<event> (unsupported)`. You install such a plugin with `--partial`, and its supported hooks then run (D-CF5-19).

### Session events

The bridge maps each Pi session event to the value that Claude Code sends. A `SessionStart` or `SessionEnd` matcher compares with the mapped value, not with Pi's own value (D-CF5-01, D-CF5-02).

| Pi action                                      | `SessionEnd` `reason`                                            | `SessionStart` `source` | Notes                                                                                                                                                            |
| ---------------------------------------------- | ---------------------------------------------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pi starts                                      | --                                                               | `startup`               |                                                                                                                                                                  |
| new session (`/new`, RPC `new_session`)        | `clear`                                                          | `clear`                 | upstream `/clear` (D-CF1-10). One `SessionStart` run per new session (SSDEDUP-01, D-CF5-05)                                                                      |
| resume a saved session                         | `resume`                                                         | `resume`                |                                                                                                                                                                  |
| fork a session                                 | `resume`                                                         | `fork`                  | upstream `/branch` sends `resume`, then `fork` (D-CF5-02)                                                                                                        |
| compaction (`/compact` or automatic)           | --                                                               | `compact`               | see [Compaction](#compaction) (D-CF5-04)                                                                                                                         |
| quit                                           | `prompt_input_exit` in the terminal, `other` in print, JSON, RPC | --                      | Pi does not report whether a signal ended the session, so a terminal quit by a signal also sends `prompt_input_exit`. Upstream sends `other` (D-CF5-02, Pi gap)  |
| `/reload`                                      | none                                                             | none                    | no session hook runs, as upstream `/reload-plugins` (D-CF5-03). The bridge still reloads the hooks of every installed plugin                                     |
| launch with `--continue`, `--resume`, `--fork` | --                                                               | `startup`               | Pi reports `startup` for these launches. Upstream sends `resume` or `fork`. Not changed (D-CF5-06, project decision: the test harness cannot launch Pi this way) |

`SessionStart` `clear`, `compact`, and `fork` groups install with no `--partial`. A plugin that you installed before this change dropped those groups at install. Run `/claude:plugin reinstall <plugin>` to restore them (D-CF5-08).

### Compaction

Each compaction runs three events in order, as upstream does (D-CF5-04, D-CF5-05):

1. `PreCompact`, with `trigger`.
2. `SessionStart`, with `source` `compact`. It runs to the end before the next event starts.
3. `PostCompact`, with `trigger` and `compact_summary`. `compact_summary` is the summary that Pi wrote for the compaction.

Pi reports a compaction as `manual`, `threshold`, or `overflow`. The bridge sends `manual` as `manual`, and `threshold` and `overflow` as `auto`. A `PreCompact` or `PostCompact` matcher of `manual` or `auto` compares with that value. A second compaction in the same session runs the three events again.

A `PreCompact` block cancels the compaction, as upstream does, so `SessionStart` and `PostCompact` do not run. A block is an exit 2, a `decision` of `block`, or a failure under `onFailure: "block"`. The bridge shows `Compaction blocked by PreCompact hook: <message>`, with one `[<command>]: <stderr>` message for each blocking hook, one per line. Upstream shows that notice as a warning. The bridge shows it at `info` severity, as every hook notice (D-CF5-18, D-CF5-24). Pi then answers the compaction with `Compaction cancelled`.

### Turn-boundary timing shift

`Stop` is dispatched when the Pi agent has fully settled, which introduces one irreducible divergence from Claude Code. Upstream, a blocked stop folds the continuation into the _same_ turn -- the agent never visibly stopped. Under Pi, by the time the bridge can decide, the agent has settled; a `decision: "block"` re-entry starts a _new_ turn with the block reason as its trigger. Hook scripts cannot observe the difference: the stdin payload, the `stop_hook_active` flag cadence, and the 8-block cap are all identical, and the LLM receives the reason as context either way. The only visible trace is an extra turn boundary in the transcript.

Because the shift is not hook-observable, `Stop` and `StopFailure` are marked `✓` (full support) rather than `⚠` (a contract restriction a hook author must code around). See [`docs/research/issue-103-stop-stopfailure-promotion.md`](research/issue-103-stop-stopfailure-promotion.md) for the full feasibility and design analysis.

When several `Stop` hooks block or add context, the model gets one message. The message has one `Stop hook feedback:\n<text>` part for each block reason and for each `additionalContext` value, in routing order. A hook that blocks and adds context gives its reason first (D-CF5-25).

### Event status classification

The unsupported events fall into three buckets, each with a different forward path:

**Deferred for engineering reasons** -- a faithful Pi-side translation is possible but not yet built. A future milestone may lift these:

- `FileChanged` -- the bridge could watch the filesystem itself but the implementation is deferred.
- `CwdChanged` -- Pi exposes the working directory but does not emit an event when it changes.
- `PostToolBatch` -- Pi's per-turn boundary differs from Claude's parallel-batch boundary; a faithful translation is deferred.
- `UserPromptExpansion` -- slash-command expansion under Pi follows a different pipeline.
- `SubagentStart` and `SubagentStop` -- supported only when `pi-subagents` is installed; the bridge does not yet wire these through.
- `PreModelSwitch` and `PostModelSwitch` -- Claude Code 2.1.251 added them, and the bridge does not translate them yet (HKMS-01).

**Blocked on upstream Pi support** -- the bridge cannot expose these until Pi exposes the underlying primitive:

- `Notification` -- the Pi runtime does not expose a subscriber bus for user notifications.
- `PermissionRequest` -- Pi has no event for the permission dialog.
- `PermissionDenied` -- Pi has no auto-mode classifier corresponding to Claude's deny path.
- `MessageDisplay` -- Pi does not expose a render-time hook on assistant messages.
- `DirectoryAdded` -- Pi has no event for a directory that the user adds to the session.
- `TeammateIdle` -- Pi has no agent-team primitive yet.
- `Elicitation` and `ElicitationResult` -- blocked on `pi-mcp-adapter` exposing the relevant MCP request.
- `WorktreeCreate` and `WorktreeRemove` -- blocked on `pi-worktrees` publishing lifecycle events.

**Permanently inapplicable to Pi** -- the runtime semantics these events name do not exist under Pi and will not appear in any future milestone:

- `ConfigChange` -- the matcher values name Claude-specific settings paths that have no equivalent under Pi.
- `Setup` -- Pi has no init-only command-line mode.
- `InstructionsLoaded` -- Pi reads a different context-file set; the matcher values are Claude-shaped and would not apply.
- `TaskCreated` and `TaskCompleted` -- Pi has no canonical task primitive.

## Matcher syntax

| Feature                                                                                                                          | Claude Code | Pi  | Notes                                                                                                                                                                                                                                                                                                                                                                  |
| -------------------------------------------------------------------------------------------------------------------------------- | ----------- | --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Literal tool name (`Bash`, `Edit`)                                                                                               | ✓           | ✓   |                                                                                                                                                                                                                                                                                                                                                                        |
| Pipe-OR alternation (`Edit\|Write`)                                                                                              | ✓           | ✓   |                                                                                                                                                                                                                                                                                                                                                                        |
| Empty / `*` / omitted -> match-all                                                                                               | ✓           | ✓   |                                                                                                                                                                                                                                                                                                                                                                        |
| Regex matcher                                                                                                                    | ✓           | ✗   | any character outside the safe charset drops the matcher group per-entry; the plugin resolves `(partially-available)`                                                                                                                                                                                                                                                  |
| MCP literal (`mcp__<server>__<tool>`)                                                                                            | ✓           | ✓   | matches a plugin MCP tool by its Claude Code name, also when the call goes through pi-mcp-adapter's `mcp` proxy (D-CF5-12). A server that you configure yourself in pi-mcp-adapter keeps the adapter's own tool names (`<server>_<tool>` by default), so this matcher does not match it                                                                                |
| MCP server prefix (`mcp__<server>__.*`)                                                                                          | ✓           | ✓   | a case-sensitive string prefix test on the tool name, with no regex; also works as one alternative of a pipe matcher (`mcp__<server>__.*\|Write`). It matches plugin MCP tools by their Claude Code names. A server that you configure yourself in pi-mcp-adapter keeps the adapter's own tool names (`<server>_<tool>` by default), so this matcher does not match it |
| Other MCP wildcards (`mcp__*`, `mcp__<server>__get_.*`)                                                                          | ✓           | ✗   | regex -> unsupported                                                                                                                                                                                                                                                                                                                                                   |
| Tools without a Pi analog (`MultiEdit`, `NotebookEdit`, `WebFetch`, `WebSearch`, `Task`, `TodoWrite`, `KillShell`, `BashOutput`) | ✓           | ✗   | unmapped -> unsupported                                                                                                                                                                                                                                                                                                                                                |
| `SessionStart` source matcher (`startup`, `resume`, `clear`, `compact`, `fork`)                                                  | ✓           | ✓   | compares with the mapped `source` (D-CF5-01)                                                                                                                                                                                                                                                                                                                           |
| `SessionEnd` reason matcher (`clear`, `resume`, `prompt_input_exit`, `other`, `logout`)                                          | ✓           | ✓   | compares with the mapped `reason`; a `logout` group never runs, as upstream (D-CF5-02)                                                                                                                                                                                                                                                                                 |
| `PreCompact` / `PostCompact` (`manual`, `auto`)                                                                                  | ✓           | ✓   | compares with the trigger: Pi `manual` is `manual`, Pi `threshold` and `overflow` are `auto` (D-CF5-04)                                                                                                                                                                                                                                                                |
| `Stop` matcher (none upstream)                                                                                                   | ✗           | ✗   | neither side supports it; the bridge reports a non-empty matcher as a `no-matcher-support` drop rather than ignoring it (UserPromptSubmit precedent)                                                                                                                                                                                                                   |
| `StopFailure` error-type matcher                                                                                                 | ✓           | ✓   | closed 10-value set: `rate_limit`, `overloaded`, `authentication_failed`, `oauth_org_not_allowed`, `billing_error`, `invalid_request`, `model_not_found`, `server_error`, `max_output_tokens`, `unknown`; exact whole-string match against the closed set (no case-folding, no pipe-OR splitting; any other value drops the group as `closed-set`)                     |

### Tool name mapping

The `matcher` field on tool events (`PreToolUse`, `PostToolUse`, `PostToolUseFailure`) names a tool. Claude plugins use the Claude-side spellings; the bridge translates them to the Pi-side spellings used by the Pi event payload. The two columns below are equivalent: a matcher value of `Edit` matches the Pi `edit` tool, and vice versa.

| Pi tool name | Claude tool name |
| ------------ | ---------------- |
| `bash`       | `Bash`           |
| `powershell` | `PowerShell`     |
| `read`       | `Read`           |
| `edit`       | `Edit`           |
| `write`      | `Write`          |
| `grep`       | `Grep`           |
| `find`       | `Glob`           |
| `ls`         | `LS`             |

Unmapped Claude tools: `MultiEdit`, `NotebookEdit`, `WebFetch`, `WebSearch`, `Task`, `TodoWrite`, `KillShell`, `BashOutput`. Pi has no equivalent for these names, so it cannot translate a `matcher` value that names one. An `mcp__<server>__<tool>` matcher matches that MCP tool by exact name. An `mcp__<server>__.*` matcher matches every tool of that server: Pi checks that the tool name starts with `mcp__<server>__`.

Plugin MCP tools reach hooks under their Claude Code names, `mcp__plugin_<plugin>_<server>__<tool>`, so a plugin's matchers and `if` predicates for its own tools fire as they do in Claude Code. A call made through pi-mcp-adapter's `mcp` proxy tool (`mcp({ tool })`) runs a nested Pi call of the real tool. The outer proxy call runs no hook. The nested call runs each matching hook once, under the real tool name, with `tool_input` set to the tool's arguments (D-CF5-12). The same rule applies to a namespace proxy tool `mcp__<server>`. A proxy call that searches, describes, or reports status still reaches hooks as the proxy tool, because Claude Code has no proxy tool (Pi gap). A call that the adapter runs inside the proxy with no nested Pi call does not reach hooks (Pi gap).

A tool that Pi does not have drops out of its `matcher` list, and the other alternatives keep working. For example, `Edit|Write|MultiEdit` still runs on `Edit` and `Write`. Pi drops the whole group only when no supported alternative is left. The plugin then reports `(partially-available)` with the reason `{unsupported hooks}`, the same as a matcher of `MultiEdit` alone.

Pi cannot tell a misspelled tool name from a deliberately foreign one. A matcher such as `Wriet|Edit` installs with no warning, because `Edit` alone keeps the hook firing. The plugin still reports that it is fully supported, and nothing flags the dropped `Wriet` alternative. Make sure that you spell every tool name in a `matcher` correctly. A typo in one alternative does not appear in the status that the plugin reports.

A matcher that fires on a Pi tool does not change the data the hook receives. The hook gets the Claude-form payload of the Pi tool that fired. For example, `Write|Edit|apply_patch` runs on Pi `write` and `edit`, and the script gets the `Write` or `Edit` payload. A script written for the similarly-named tool of another agent must handle that input itself.

## `if` field

| Prefix                                                                                 | Claude Code | Pi  | Notes                                                                                                                                                   |
| -------------------------------------------------------------------------------------- | ----------- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Bash(<command-glob>)`                                                                 | ✓           | ✓   | compound-split, wrapper-strip, `:*` suffix, word-boundary                                                                                               |
| `PowerShell(<command-glob>)`                                                           | ✓           | ✓   | compound-split on `;` `\|` `&&` `\|\|`, `:*` suffix, word-boundary, case-insensitive matching, alias canonicalization; no process wrappers are stripped |
| `Read(<path-glob>)`                                                                    | ✓           | ✓   | cross-tool: covers Pi `read`, `grep`, `find`, `ls`                                                                                                      |
| `Edit(<path-glob>)`                                                                    | ✓           | ✓   | cross-tool: covers Pi `edit`, `write`                                                                                                                   |
| `Write(<path-glob>)`                                                                   | ✓           | ✓   |                                                                                                                                                         |
| `mcp__<server>__<tool>` literal                                                        | ✓           | ✓   |                                                                                                                                                         |
| `mcp__<server>` / `mcp__<server>__*` prefix                                            | ✓           | ✓   |                                                                                                                                                         |
| Bare tool names without parens (`Bash`, `Read`)                                        | ✓           | ⚠   | falls open (matches Claude Code's match-everything semantic)                                                                                            |
| `Grep(...)`, `Glob(...)`, `LS(...)`                                                    | ✓           | ✗   | falls open; rewrite as `Read(...)`                                                                                                                      |
| `MultiEdit(...)`, `NotebookEdit(...)`                                                  | ✓           | ✗   | falls open; rewrite as `Edit(...)`                                                                                                                      |
| `Cd(...)`                                                                              | ✓           | ✗   | falls open (out-of-scope tool on Pi)                                                                                                                    |
| `WebFetch(domain:host)`, `Agent(<name>)`                                               | ✓           | ✗   | falls open (no `if`-field support for these tools)                                                                                                      |
| Parameter matching: `Agent(model:opus)`, `Bash(run_in_background:true)`                | ✓           | ✗   | falls open; the bridge does not inspect tool input parameters                                                                                           |
| Tool-name wildcards (`*`, `mcp__*`, `mcp__github__get_*`)                              | ✓           | ✗   | falls open                                                                                                                                              |
| Glob `*` within-segment, `**` cross-segment                                            | ✓           | ✓   |                                                                                                                                                         |
| Path anchors `//abs`, `~/home`, `/project-root`, `./cwd`, bare-relative, bare-filename | ✓           | ✓   | `projectRoot` falls back to `cwd` until Pi exposes a richer surface                                                                                     |
| Bash compound split (`&&`, `\|\|`, `;`, `\|`, `\|&`, `&`, newlines)                    | ✓           | ✓   |                                                                                                                                                         |
| Bash wrapper-strip (`timeout`, `time`, `nice`, `nohup`, `stdbuf`, `xargs`)             | ✓           | ✓   |                                                                                                                                                         |
| PowerShell compound split (`&&`, `\|\|`, `;`, `\|`, newlines)                          | ✓           | ✓   | a bare `&` is not a separator; a backtick escapes the next character instead of substituting a command                                                  |
| PowerShell alias canonicalization and case-insensitive matching                        | ✓           | ✓   | a rule written for a cmdlet also matches its aliases, and a rule written with an alias matches the cmdlet                                               |
| Bash `$(...)`, backticks, `$VAR` -> fail-open fire                                     | ✓           | ✓   | command treated as uncertain                                                                                                                            |
| PowerShell `$(...)`, `$VAR`, `${VAR}` -> fail-open fire                                | ✓           | ✓   | command treated as uncertain; a backtick is an escape there, not substitution, so it does not count                                                     |
| `if` on an event with no tool                                                          | ✓           | ✓   | the hook does not run, as upstream (D-CF5-23). An empty `if` still runs the hook                                                                        |
| Malformed permission-rule syntax (`Bash(`, broken globs)                               | ✓           | ⚠   | falls open with a debug-log warning                                                                                                                     |

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
| `args` (exec-form, no shell)               | ✓           | ✓   | presence switches to exec-form spawn. See [Placeholders in `command` and `args`](#placeholders-in-command-and-args) (D-CF5-15)                                                                                                                                                                                                                                                                           |
| `shell` (override)                         | ✓           | ✓   | accepts a shell-path string                                                                                                                                                                                                                                                                                                                                                                              |
| `timeout`                                  | ✓           | ⚠   | value in **seconds**; per-handler override; default 600 s, lowered to 30 s on `UserPromptSubmit` and 1.5 s on `SessionEnd` for synchronous handlers (`asyncRewake` keeps 600 s everywhere); a value that is not a positive finite number is ignored, not an error; `SessionEnd`'s budget is applied per hook rather than shared across them, and a declared value there is not capped at upstream's 60 s |
| `async`                                    | ✓           | ✓   | async dispatch with PID-table tracking                                                                                                                                                                                                                                                                                                                                                                   |
| `asyncRewake` (on-exit-2 wake-with-stderr) | ✓           | ⚠   | re-dispatches surviving children after Pi restart; never runs on `Stop` / `StopFailure` -- the settle path skips async handlers entirely (see silent drop below)                                                                                                                                                                                                                                         |
| `statusMessage` (spinner)                  | ✓           | ✗   | Pi has no per-handler spinner surface                                                                                                                                                                                                                                                                                                                                                                    |
| `if` (permission-rule filter)              | ✓           | ✓   | see the `if` field table above for prefix coverage                                                                                                                                                                                                                                                                                                                                                       |
| `once`                                     | ✓           | ✓   | accepted and ignored: a plugin hook runs on every matching event, as upstream. Claude Code honors `once` only for hooks in skill frontmatter (D-CF5-17)                                                                                                                                                                                                                                                  |
| `onFailure`                                | ✓           | ⚠   | see [`onFailure`](#onfailure) (D-CF5-18). JSON that parses but does not match the event's output schema is not a failure                                                                                                                                                                                                                                                                                 |

### Placeholders in `command` and `args`

An exec-form hook (a hook with `args`) gets these placeholders filled in, anywhere in `command` and in each `args` string, as upstream does (D-CF5-15):

- `${CLAUDE_PROJECT_DIR}`
- `${CLAUDE_PLUGIN_ROOT}`
- `${CLAUDE_PLUGIN_DATA}`

The values are the same values that the hook's environment variables get. Both hook lanes (synchronous and `asyncRewake`) fill them in. Any other `${...}` text stays as written. `${user_config.KEY}` also stays as written, because Pi has no plugin user configuration (USRCFG-01). Upstream fills it in.

A shell-form hook (a hook with no `args`) gets no text substitution. The shell expands the environment variables of the same names, as upstream.

### `onFailure`

With `onFailure: "block"`, a command hook that fails acts as an exit 2 on its event (D-CF5-18). These outcomes are failures:

- The hook cannot start.
- The hook exits with a code other than 0 and 2.
- The hook timeout stops it.
- Its stdout starts with `{` and does not parse as JSON.

The block reason is `[<command>]: failed; blocking because onFailure is "block"`, then a new line and the hook's stderr. After a timeout, the reason says `timed out` in place of `failed`. When the hook prints no stderr, the reason ends after `"block"`. `<command>` is the declared `command` text, with its placeholders.

The default, `continue`, lets the failure pass. The bridge ignores `onFailure` on `Stop` hooks and on `async` and `asyncRewake` hooks, as upstream, and writes a debug line. On `SessionStart`, `SessionEnd`, and `PostCompact`, which cannot block, the block shows as the event's hook error (D-CF5-24).

## stdin, stdout, exit codes

| Feature                                                                           | Claude Code | Pi  | Notes                                                                                                                                                                                                                                                 |
| --------------------------------------------------------------------------------- | ----------- | --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| JSON event on stdin                                                               | ✓           | ✓   | per-event payload                                                                                                                                                                                                                                     |
| `transcript_path` (stdin)                                                         | ✓           | ⚠   | a saved Pi session sends its session file path from the first turn. A session with no file (`--no-session`) sends `""`, because an in-memory session has no transcript location (D-CF5-07, Pi gap)                                                    |
| `tool_use_id`, `mcp_server` (tool stdin)                                          | ✓           | ✗   | not sent (D-CF5-28)                                                                                                                                                                                                                                   |
| `error` (PostToolUseFailure stdin)                                                | ✓           | ✓   | the text parts of the failed tool's result, one per line; an image part is left out. As upstream, the payload has no `tool_response`. `is_interrupt` and `duration_ms` are not sent (D-CF5-28)                                                        |
| `compact_summary` (PostCompact stdin)                                             | ✓           | ✓   | the summary that Pi wrote for the compaction (D-CF5-04)                                                                                                                                                                                               |
| `stop_hook_active` (Stop stdin)                                                   | ✓           | ✓   | per-session loop flag; set on any bridge re-entry (block or `additionalContext`), cleared on the next user input                                                                                                                                      |
| `last_assistant_message` (Stop / StopFailure stdin)                               | ✓           | ✓   | Stop: final assistant message text (concatenated text blocks); StopFailure: Pi's rendered error text (`errorMessage`; empty on `length` endings)                                                                                                      |
| Exit 0 -> success                                                                 | ✓           | ✓   |                                                                                                                                                                                                                                                       |
| Plain stdout on exit 0 as context                                                 | ✓           | ✓   | on `SessionStart` and `UserPromptSubmit` only, as upstream. Stdout that does not start with `{` and end with `}` is plain text (D-CF5-13). On other events, the bridge ignores it                                                                     |
| Exit 2 -> blocking error, stderr to Claude                                        | ✓           | ✓   | the reason is `[<command>]: <stderr>`, or the reason that a JSON object on stdout gives (D-CF5-11). On Stop, rides the block arm with stderr as the re-entry reason. On `PreCompact`, cancels the compaction                                          |
| Other exit -> non-blocking, stderr to user                                        | ✓           | ⚠   | a JSON object on stdout still applies whole, so a `deny` printed before exit 1 blocks the call (D-CF5-11). The bridge does not show the stderr to the user                                                                                            |
| Large stdout or stderr                                                            | ✓           | ⚠   | the bridge keeps the first 1 MB of stdout and 64 KB of stderr and drops the rest (EXEC-02). As upstream, the hook runs to its exit and the exit code decides, so an exit 2 blocks with the stderr kept. Stdout cut at 1 MB is not read                |
| `continue: false` -> stop                                                         | ✓           | ⚠   | on `PreToolUse`, the turn ends (D-CF5-11). On `UserPromptSubmit`, the prompt stops with no notice. On `PostToolUse` and `PostToolUseFailure`, the bridge only writes a debug line. On Stop, top-level `continue: false` takes precedence over a block |
| `decision: "block"` (top-level)                                                   | ✓           | ✓   | per-event arms in `event-adapters.ts`. A `PostToolUse` or `PostToolUseFailure` block keeps the tool output and adds the hook's feedback. On Stop, re-enters via `followUp` + `triggerTurn`                                                            |
| `suppressOutput`                                                                  | ✓           | ✓   |                                                                                                                                                                                                                                                       |
| `systemMessage`                                                                   | ✓           | ✓   | see [Messages to the user](#messages-to-the-user) (D-CF5-14)                                                                                                                                                                                          |
| `terminalSequence` (OSC)                                                          | ✓           | ✗   | no terminal-sequence emit                                                                                                                                                                                                                             |
| `hookSpecificOutput.permissionDecision` `deny`                                    | ✓           | ✓   | blocks the call at any exit code. The model reads `PreToolUse:<Tool> hook error: <reason>` (D-CF5-11)                                                                                                                                                 |
| `hookSpecificOutput.permissionDecision` `ask`                                     | ✓           | ✓   | in the terminal, Pi asks you to allow the call. In print, JSON, and RPC mode, the call is blocked with the hook's reason, as upstream in print mode (D-CF5-11)                                                                                        |
| `hookSpecificOutput.permissionDecision` `allow`                                   | ✓           | ✓   |                                                                                                                                                                                                                                                       |
| `hookSpecificOutput.permissionDecision` `defer`                                   | ✓           | ✗   | ignored with a debug line. Upstream honors it in print mode only, and Pi has no deferred-permission flow (D-CF5-11, Pi gap)                                                                                                                           |
| `hookSpecificOutput.permissionDecisionReason`                                     | ✓           | ✓   |                                                                                                                                                                                                                                                       |
| `updatedInput`                                                                    | ✓           | ✓   | replaces the whole tool input, as upstream (D-CF5-11)                                                                                                                                                                                                 |
| `updatedToolOutput`                                                               | ✓           | ⚠   | on tool-result events, as Pi's content array (`content`, `isError`). The tool's own output shape and `updatedMCPToolOutput` are not read                                                                                                              |
| `additionalContext`                                                               | ✓           | ✓   | see [Additional context](#additional-context) (D-CF5-13)                                                                                                                                                                                              |
| `initialUserMessage`, `sessionTitle`, `watchPaths`, `reloadSkills` (SessionStart) | ✓           | ✗   |                                                                                                                                                                                                                                                       |
| `decision.behavior` for `PermissionRequest`                                       | ✓           | ✗   | event itself unsupported                                                                                                                                                                                                                              |
| `displayContent` for `MessageDisplay`                                             | ✓           | ✗   | event itself unsupported                                                                                                                                                                                                                              |

### Additional context

Each hook's `additionalContext` reaches the model. When several hooks of one event give context, the bridge keeps every value, in routing order (D-CF5-09, D-CF5-13).

| Event                                                    | How the model gets the context                                                                                                                                                                                      |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SessionStart`                                           | as `SessionStart hook additional context: <text>` in a hidden message before the first prompt of the session. The message stays in the session history for later turns                                              |
| `UserPromptSubmit`                                       | as `UserPromptSubmit hook additional context: <text>` after your prompt, which reaches the model unchanged. Upstream adds the text to the same request. Pi adds a separate hidden message after the prompt (Pi gap) |
| `PreToolUse`, `PostToolUse`, `PostToolUseFailure`        | as `<Event>:<Tool> hook additional context: <text>` in a hidden message after the tool result. A call that the hook denies also sends its context                                                                   |
| `Stop`                                                   | as a `Stop hook feedback:\n<text>` part of the Stop re-entry message (D-CF5-25)                                                                                                                                     |
| `SessionEnd`, `PreCompact`, `PostCompact`, `StopFailure` | not sent, as upstream                                                                                                                                                                                               |

When `SessionStart` and `UserPromptSubmit` both give context for one prompt, one message carries both parts, `SessionStart` first. A value that is empty or only white space adds nothing. Each bridge load, `/reload` included, empties the context that waits for the next prompt.

A `UserPromptSubmit` context belongs to its own prompt. When a prompt starts no turn, for example because another extension handled it, the next prompt drops its context. A prompt that you send while the agent runs (a steer or a follow-up) starts no turn of its own, so its context goes in a hidden message on the turn that reads the prompt. Pi queues the prompt only after the hooks finish, so that message comes just before the prompt, where upstream puts the text after it (Pi gap) (D-CF5-13).

### Messages to the user

A hook's `systemMessage` is shown to you and never sent to the model (D-CF5-14). The bridge shows it through the extension's notifications, at `info` severity, as `<label> says: <text>`. In JSON and RPC mode, each notice is a `hook-notice` entry. `<label>` names the event and the value that the hook matched, as upstream names the hook:

- `PreToolUse:<Tool>`, `PostToolUse:<Tool>`, `PostToolUseFailure:<Tool>`
- `UserPromptSubmit`
- `Stop`
- `SessionStart:<source>`, for example `SessionStart:clear`

`SessionEnd`, `PreCompact`, `PostCompact`, and `StopFailure` drop a `systemMessage` with a debug line, as upstream. An empty `systemMessage` shows nothing. When several hooks give a message, the messages show in routing order.

The same notice kind carries three more notices (D-CF5-24):

- A blocked prompt shows `UserPromptSubmit operation blocked by hook:` and the reason on the next line. The prompt does not reach the model. Upstream adds a third line, `Original prompt: <prompt>`. The bridge leaves it out.
- A block on `SessionStart`, `SessionEnd`, or `PostCompact`, which cannot block, shows as `<label> hook error: <message>`. An exit 2 gives the message `[<command>]: <stderr>`.
- A `PreCompact` block shows `Compaction blocked by PreCompact hook: <message>` (see [Compaction](#compaction)).

A notice can echo data that a hook read, such as a tool input or a file. So every notice loses its terminal escape sequences, every other control character except a line break or a tab becomes a space, and a notice longer than 2,000 characters is cut and ends with `… (+N chars)`.

## Environment variables

[`docs/env-vars.md`](env-vars.md) is authoritative on any conflict about which environment variables ship; the table below is the hook-scoped view (D-CF5-16).

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
| `CLAUDE_CODE_CHILD_SESSION`                           | ✓           | ✗   | not set yet (D-CF5-16)                                                                                                                                                               |
| `CLAUDE_CODE_SESSION_ATTENDED`                        | ✓           | ✗   | not set yet (D-CF5-16)                                                                                                                                                               |
| `CLAUDE_PID`                                          | ✓           | ✗   | not set yet (D-CF5-16)                                                                                                                                                               |
| `CLAUDE_EFFORT`                                       | ✓           | ✗   | Pi has no effort surface                                                                                                                                                             |
| `CLAUDE_CODE_REMOTE`                                  | ✓           | ✗   |                                                                                                                                                                                      |
| `CLAUDE_ENV_FILE`                                     | ✓           | ⚠   | path exposed on the SessionStart hook event (both spawn lanes); Pi does not source the file back, so vars a hook writes to it are not applied. See [`docs/env-vars.md`](env-vars.md) |
| `${tool_input.*}` interpolation in `command` / `args` | ✓           | ✗   |                                                                                                                                                                                      |
| `${user_config.*}` interpolation                      | ✓           | ✗   | Pi has no plugin user-config surface                                                                                                                                                 |
| `$ARGUMENTS` (prompt and agent hooks)                 | ✓           | ✗   | those handler types unsupported                                                                                                                                                      |

## Configuration surfaces

| Surface                                 | Claude Code | Pi  | Notes                                                                                                                                                                                                          |
| --------------------------------------- | ----------- | --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Plugin `hooks/hooks.json`               | ✓           | ✓   |                                                                                                                                                                                                                |
| `plugin.json` `hooks` field             | ✓           | ⚠   | a path to another file, an array, or an inline object makes the plugin `(partially-available)` with `{unsupported hooks}`. A path to `hooks/hooks.json` changes nothing (D-CF5-20, D-CF5-27, project decision) |
| Marketplace entry `hooks` field         | ✓           | ⚠   | in any form, makes the plugin `(partially-available)` with `{unsupported hooks}` (D-CF5-20, project decision)                                                                                                  |
| `~/.claude/settings.json` (user)        | ✓           | ✗   | non-plugin settings-driven hooks not bridged                                                                                                                                                                   |
| `.claude/settings.json` (project)       | ✓           | ✗   |                                                                                                                                                                                                                |
| `.claude/settings.local.json`           | ✓           | ✗   |                                                                                                                                                                                                                |
| Managed policy settings                 | ✓           | ✗   |                                                                                                                                                                                                                |
| `/hooks` slash command (browser / edit) | ✓           | ✗   |                                                                                                                                                                                                                |
| `disableAllHooks` kill-switch           | ✓           | ✗   |                                                                                                                                                                                                                |

Upstream merges the hooks of a `plugin.json` `hooks` field with `hooks/hooks.json`, and a marketplace entry's `hooks` replaces events of the plugin's own configuration. The bridge does not merge them yet. So it reports such a plugin as `(partially-available)`, and you install it with `--partial`. The hooks of `hooks/hooks.json` then run, and the hooks of the field do not.

## Async and lifecycle

| Feature                                     | Claude Code | Pi  | Notes                                                                                                                                                                                                                         |
| ------------------------------------------- | ----------- | --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Long-running handlers                       | ✓           | ✓   | PID-table reaping after Pi restart                                                                                                                                                                                            |
| Restart-survival rewake                     | ✓           | ✓   | async-rewake re-dispatches surviving children                                                                                                                                                                                 |
| Parallel hooks on same event                | ✓           | ✓   | every matching hook of an event starts at once, on the same input (D-CF5-09)                                                                                                                                                  |
| Merge of parallel results                   | ✓           | ✓   | the results fold in routing order, whatever order the hooks finish in: a `continue: false` wins, then a block or deny, then an `ask`, then an allow. The last input rewrite in routing order wins (D-CF5-09)                  |
| Hook dedupe (identical hooks on same event) | ✓           | ✓   | one run per plugin root, `type`, `shell` (`bash` by default), `command`, `args`, and `if`. The copy keeps the first copy's place and the last copy's other fields. The same hook in two plugins runs once for each (D-CF5-10) |
| Disable, enable, uninstall, update          | ✓           | ✓   | disable and uninstall stop the plugin's hooks, enable runs them again, and update replaces them with the new version's hooks (D-CF5-22)                                                                                       |

## Install-time disposition

The bridge picks one of four responses when a plugin declares a feature outside the supported set:

**Partial-partition drop** -- when a `hooks.json` parses and validates cleanly but declares an unsupportable event, matcher group, or handler type, the bridge drops only the offending entries and installs the rest. The plugin resolves `(partially-available)` and, once installed, derives `(partially-installed)`. Every dropped entry rides a SINGLE aggregate `{unsupported hooks}` brace (D-71-04); the per-handler `event(matcher) (unsupported)` breakdown is shown on the `plugin info` surface (D-71-05). The bridge favors partial support over a whole-plugin failure so that a plugin's supported hooks still run. Applies to:

- any unsupportable event in `hooks.json`, including `DirectoryAdded`, `PreModelSwitch`, and `PostModelSwitch` (it drops per-entry; supported events declared alongside it still install, D-CF5-19)
- regex matchers
- tool-name matchers naming a Claude tool with no Pi analog
- non-tool matchers outside the per-event closed set (for example, `logon` on `SessionEnd`)
- any handler `type` other than `"command"`
- a `plugin.json` `hooks` field other than `hooks/hooks.json`, and any marketplace entry `hooks` field (D-CF5-20)

**Structural unavailable** -- a structurally malformed `hooks.json` (invalid JSON, or a schema failure such as a `type: "command"` handler missing its `command`) resolves `(unavailable)` and none of the plugin's hooks install. This is a distinct arm from the partial-partition drop above: its reason brace is sourced through `narrowResolverNotes`, not the `narrowUnsupportedKinds` path the partial drop uses.

**Silent fall-open** -- the hook fires on every matcher hit and a `hookDebugLog` warning records the cause. This matches Claude Code's documented best-effort contract for the `if` field. Applies to:

- every `if`-field shape outside the supported prefix set (`Grep(...)`, `LS(...)`, `Cd(...)`, parameter matching, tool-name wildcards, unknown prefixes)
- malformed `if` syntax (`Bash(` with no close, broken globs)
- runtime Bash commands containing `$(...)`, backticks, or `$VAR`
- runtime PowerShell commands containing `$(...)`, `$VAR`, or `${VAR}` -- a PowerShell backtick is an escape rather than command substitution, so it does not make a command uncertain

**Silent drop** -- the bridge accepts the field at parse time but never acts on it. Applies to:

- `terminalSequence` -- no Pi surface to render it
- `initialUserMessage`, `sessionTitle`, `watchPaths`, `reloadSkills` on `SessionStart`
- `once` on a plugin hook, as upstream (D-CF5-17)
- `asyncRewake` on `Stop` / `StopFailure` -- the settle path needs a synchronous outcome, so the handler is never spawned at all (the entry degrades to a no-op; a `hookDebugLog` line records the drop)

## Further reading

- [Claude Code hooks reference](https://code.claude.com/docs/en/hooks) -- the upstream authoritative field reference, including worked examples, the full `if`-permission-rule grammar, precedence rules, the per-event stdin and stdout contracts, and the complete environment-variable list the bridge inherits.
- Pi extension API documentation via the `@mariozechner/pi-coding-agent` package -- the host runtime contract, including how the bridge subscribes to Pi events, how hook output is injected back into the assistant's turn, and how user-visible notifications are emitted.

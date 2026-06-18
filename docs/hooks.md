# Hook support

Claude Code plugins can ship hook handlers that observe and react to session events and tool calls. This marketplace translates each declared Claude hook into a Pi event subscription so that hooks run under Pi the same way they would run under Claude Code. The rest of this document explains which events work in v1.13, which do not, what your hook handler will see at runtime, and what to expect when you install a plugin that ships hooks.

## How hooks run under Pi

A hook handler is a `command` entry in a plugin's `hooks.json`. When the bridge dispatches a hook, the handler runs as a child process. The child process inherits the working directory of the user's project (the `cwd` Pi reports to the extension), so relative paths in your handler resolve the same way they would from a terminal opened in that project. Absolute paths in the `command` field are honored verbatim. The `$PATH` environment variable is inherited from the Pi process, so handlers can invoke any executable a normal shell could.

The bridge sets three environment variables in the hook child process. They match the variables Claude Code itself sets, and your handler scripts can read them the same way:

- `CLAUDE_PROJECT_DIR` -- absolute path to the user's project directory.
- `CLAUDE_PLUGIN_ROOT` -- absolute path to the installed plugin's root directory. Use this to reference files shipped inside your plugin (for example, `${CLAUDE_PLUGIN_ROOT}/scripts/format.sh`).
- `CLAUDE_PLUGIN_DATA` -- absolute path to a per-plugin, per-scope writable scratch directory. Use this for caches, lock files, or accumulated state your handler needs across invocations.

The `${CLAUDE_PLUGIN_ROOT}` token is the recommended way to reference your own scripts; it works on every operating system Pi runs on, and it survives users installing the plugin under different scope roots.

## Supported events

The following eight Claude hook events fire under Pi at full fidelity in v1.13. A plugin whose `hooks.json` declares handlers only for events in this table installs cleanly and its handlers run on every matching event.

| Event                | Description                                                                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `SessionStart`       | Fires once when a Pi session begins or resumes. Typical use: inject reference material or coding conventions into the assistant's working context.     |
| `UserPromptSubmit`   | Fires after the user submits a prompt and before the assistant processes it. Typical use: log prompts, redact secrets, or short-circuit the turn.      |
| `PreToolUse`         | Fires before a tool call executes. Typical use: allow or deny the call, mutate its input, or warn the user when a destructive command is about to run. |
| `PostToolUse`        | Fires after a tool call completes successfully. Typical use: run formatters, refresh indices, or audit the changes a tool made.                        |
| `PostToolUseFailure` | Fires after a tool call fails. Typical use: capture diagnostics, escalate a notification, or retry the action with safer inputs.                       |
| `PreCompact`         | Fires before the session compacts its conversation history. Typical use: capture a snapshot, cancel the compaction, or supply a custom summary.        |
| `PostCompact`        | Fires after the session finishes compacting. Typical use: refresh derived context that depends on the new compacted state.                             |
| `SessionEnd`         | Fires once when a Pi session terminates. Typical use: flush logs, close external connections, or write a session summary to disk.                      |

## Worked examples

The following six examples show real `hooks.json` snippets and explain what happens when each handler fires. The snippets are schema-valid; you can paste them directly into a plugin's `hooks/hooks.json` and the bridge will dispatch them as shown.

### Auto-formatter

Run a formatter after the assistant edits a source file.

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PLUGIN_ROOT}/scripts/format.sh"
          }
        ]
      }
    ]
  }
}
```

When the assistant calls the `Edit` or `Write` tool successfully, the bridge spawns `format.sh`. The script reads the tool result from standard input as a JSON document (containing the file path and the new contents), formats the file in place, and exits with status 0. A non-zero exit surfaces stderr to the user as a notification.

### Bash-safety net

Veto destructive shell commands before they run.

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "if": "Bash(rm -rf:*)",
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PLUGIN_ROOT}/scripts/deny-rm-rf.sh"
          }
        ]
      }
    ]
  }
}
```

When the assistant attempts to call the `Bash` tool with a command starting `rm -rf`, the bridge spawns `deny-rm-rf.sh`. The script can read the proposed command from stdin and either approve it (exit 0), deny it (exit 2 with a message on stderr explaining why), or rewrite it (emit a JSON object on stdout overriding the input). The `if` field uses Claude Code's permission-rule grammar; see [The `if` field](#the-if-field) for the supported shapes and the fail-open behavior on the rest.

### Session start rule injection

Inject project-specific guidance into the assistant's context at the start of every session.

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PLUGIN_ROOT}/scripts/inject-conventions.sh"
          }
        ]
      }
    ]
  }
}
```

When a session begins, the bridge spawns `inject-conventions.sh`. The script writes a JSON document on stdout whose `hookSpecificOutput.additionalContext` field contains the text to inject. The bridge feeds that text to Pi so the assistant sees it as part of its working context. `SessionStart` carries no matcher in this snippet; the handler fires on every session start.

### Prompt audit log

Append every user prompt to a per-project audit log.

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PLUGIN_ROOT}/scripts/log-prompt.sh",
            "timeout": 5
          }
        ]
      }
    ]
  }
}
```

When the user submits a prompt, the bridge spawns `log-prompt.sh` with the prompt text on stdin. The script appends the prompt (and a timestamp) to `${CLAUDE_PLUGIN_DATA}/prompts.log`, then exits with status 0. The `timeout` field caps the handler at five seconds; if it runs longer the bridge terminates it and the prompt continues to the assistant.

### Background security review

Run a security review in the background and feed the findings back into the next turn.

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PLUGIN_ROOT}/scripts/security-review.sh",
            "args": ["--background"],
            "asyncRewake": true,
            "rewakeMessage": "Security findings ready -- please review before proceeding.",
            "rewakeSummary": "security review"
          }
        ]
      }
    ]
  }
}
```

When the assistant edits a file, the bridge spawns `security-review.sh` and returns control to the assistant immediately. The script runs to completion in the background. If it exits with status 2, the bridge prepends `rewakeMessage` to the script's stdout and injects the combined text into the assistant's next turn -- so the assistant can react to the findings without the user having to copy them in. `rewakeSummary` is the short label shown in the Pi user interface while the review runs. Non-zero exit codes other than 2 are treated as silent failures (nothing is injected). Use this pattern for any check whose latency would otherwise stall the agent loop.

### Compaction snapshot

Take a snapshot of the conversation before it is compacted.

```json
{
  "hooks": {
    "PreCompact": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PLUGIN_ROOT}/scripts/snapshot-conversation.sh"
          }
        ]
      }
    ]
  }
}
```

When a compaction is about to begin, the bridge spawns `snapshot-conversation.sh`. The script reads the current conversation from stdin (as a JSON document supplied by Claude Code's compaction payload) and writes a timestamped copy to `${CLAUDE_PLUGIN_DATA}/snapshots/`. Exiting with status 0 lets the compaction proceed; exiting with status 2 cancels it. A handler on `PostCompact` can then refresh any caches that depend on the post-compaction conversation state.

## The `if` field

The optional `if` field on a tool-event hook entry narrows when the handler fires. It uses [Claude Code's permission-rule grammar](https://code.claude.com/docs/en/permissions). The bridge applies the `if` field on `PreToolUse`, `PostToolUse`, and `PostToolUseFailure` only -- on any other event the field is silently ignored (matching upstream's "attaching to other events prevents the hook from running" behavior).

### Supported shapes

| Shape                                | Fires when                                                                                | Example                     |
| ------------------------------------ | ----------------------------------------------------------------------------------------- | --------------------------- |
| `Bash(<command-glob>)`               | the proposed Bash command matches the glob (after compound-command split + wrapper-strip) | `Bash(rm -rf:*)`            |
| `Read(<path-glob>)`                  | the proposed read path matches the glob; covers `read`, `grep`, `find`, `ls`              | `Read(src/**)`              |
| `Edit(<path-glob>)`                  | the proposed edit path matches the glob; covers `edit`, `write`                           | `Edit(*.ts)`                |
| `Write(<path-glob>)`                 | the proposed write path matches the glob; narrower than `Edit`                            | `Write(/tmp/**)`            |
| `mcp__<server>__<tool>`              | the called MCP tool's name matches the literal exactly                                    | `mcp__github__create_issue` |
| `mcp__<server>` / `mcp__<server>__*` | the called MCP tool's name starts with `mcp__<server>__`                                  | `mcp__github`               |

Glob metacharacters: `*` matches anything within one path segment (or anywhere in a Bash command); `**` matches across segments; a trailing space before `*` enforces a word boundary (`Bash(ls *)` excludes `lsof`; `Bash(ls*)` includes both); the `:*` suffix is equivalent to ending the pattern with `Bash(ls *)`-style space-then-asterisk. Path globs honor the four upstream anchors: `//abs` (filesystem root), `~/home` (your home directory), `/project-root` (the project root), and `./cwd` or a bare relative path (the current directory). Bare filenames match at any depth, so `Read(.env)` is equivalent to `Read(**/.env)`.

Bash compound commands are split on `&&`, `||`, `;`, `|`, `|&`, `&`, and newlines, and each subcommand is matched independently. The fixed process-wrapper set (`timeout`, `time`, `nice`, `nohup`, `stdbuf`, bare `xargs`) is stripped before matching, so `Bash(npm test *)` matches `timeout 30 npm test`. `$(...)`, backticks, and `$VAR` expansion always fire (the command is considered "uncertain" and the `if` field falls open per Claude Code's documented best-effort contract).

### Fail-open shapes

The following Claude Code `if` shapes parse to "match every call" in v1.13 -- the hook fires on every event the `matcher` accepted, and a debug-log warning records the cause. These are documented here so a plugin author who relies on them for narrowing knows the bridge won't enforce it:

- **Bare tool names** without parens (`Bash`, `Read`, `WebFetch`, etc.). Claude Code treats these as "match every call"; the bridge does the same by falling open.
- **`Tool(<param>:<value>)` parameter matching** -- the generic input-parameter rule family (`Agent(model:opus)`, `Agent(isolation:worktree)`, `Bash(run_in_background:true)`). The bridge does not inspect tool input parameters in the `if` layer.
- **Tool-name wildcards** -- bare `*`, `mcp__*`, and mid-name globs like `mcp__github__get_*`.
- **Tool prefixes the bridge does not implement** -- `PowerShell(...)`, `WebFetch(domain:host)`, `Agent(<AgentName>)`, `Cd(<path-pattern>)`. (`PowerShell` and `Cd` are out-of-scope tools on Pi; `WebFetch` and `Agent` have Pi analogs but no `if`-field support in v1.13.)
- **`Grep`, `Glob`, `LS`, `MultiEdit`, `NotebookEdit`** -- the bridge uses upstream's cross-tool semantic instead: `Read` covers Pi `grep` / `find` / `ls`, and `Edit` covers Pi `write`. Writing `Grep(...)` directly falls open; rewrite as `Read(...)`.

If you need any of the fail-open shapes to actually narrow, gate inside the handler script: read the tool call from stdin and exit 0 (allow) or 2 (deny) based on whatever predicate you would have written in the `if` field.

## Unsupported events

The other Claude hook events do not fire under Pi in v1.13. A plugin that declares a handler for any unsupported event installs with the row `(unavailable) {unsupported hooks}`, and none of its hooks run. This is intentional: a partially-loaded hook set would surprise plugin authors who expect their handlers to fire, so the bridge fails fast and surfaces the gap.

Deferred for engineering reasons:

- `FileChanged` -- the bridge could watch the filesystem itself but the implementation is deferred.
- `Stop` -- Pi's session-end event is observation-only and cannot honor the block-to-continue contract Claude plugins rely on.
- `CwdChanged` -- Pi exposes the working directory but does not emit an event when it changes.
- `PostToolBatch` -- Pi's per-turn boundary differs from Claude's parallel-batch boundary; a faithful translation is deferred.
- `UserPromptExpansion` -- slash-command expansion under Pi follows a different pipeline.
- `StopFailure` -- Pi does not emit a dedicated turn-ended-by-error event.
- `SubagentStart` and `SubagentStop` -- supported only when `pi-subagents` is installed; the v1.13 bridge does not yet wire these through.

Blocked on upstream Pi support:

- `Notification` -- the Pi runtime does not expose a subscriber bus for user notifications.
- `PermissionRequest` -- Pi has no event for the permission dialog.
- `PermissionDenied` -- Pi has no auto-mode classifier corresponding to Claude's deny path.
- `MessageDisplay` -- Pi does not expose a render-time hook on assistant messages.
- `TeammateIdle` -- Pi has no agent-team primitive yet.
- `Elicitation` and `ElicitationResult` -- blocked on `pi-mcp-adapter` exposing the relevant MCP request.
- `WorktreeCreate` and `WorktreeRemove` -- blocked on `pi-worktrees` publishing lifecycle events.

Permanently inapplicable to Pi:

- `ConfigChange` -- the matcher values name Claude-specific settings paths that have no equivalent under Pi.
- `Setup` -- Pi has no init-only command-line mode.
- `InstructionsLoaded` -- Pi reads a different context-file set; the matcher values are Claude-shaped and would not apply.
- `TaskCreated` and `TaskCompleted` -- Pi has no canonical task primitive.

These last five events stay unsupported regardless of future upstream work: the runtime semantics they are named for do not exist under Pi.

## Tool name mapping

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

Currently unmapped Claude tools: `MultiEdit`, `NotebookEdit`, `WebFetch`, `WebSearch`, `Task`, `TodoWrite`, `KillShell`, `BashOutput`, and any `mcp__*` MCP server tool. A matcher value naming one of these tools cannot be translated because there is no Pi-side analog; the plugin will install with `(unavailable) {unsupported hooks}` unless the matcher also matches a tool name that does have a mapping (for example, `Edit|Write|MultiEdit` would still install if the bridge accepts at least one of the alternatives -- but the unmapped alternative will never fire).

## What happens to my plugin?

The decision tree below covers the supportability checks the bridge applies when you install a plugin that ships hooks. The bridge applies every check; the first one that fails flips the plugin to `(unavailable) {unsupported hooks}`.

- If your plugin's `hooks.json` declares hooks only for events in the Supported events table, your plugin's hooks will fire under Pi.
- If your plugin's `hooks.json` declares any hook handler for an unsupported event, the entire plugin installs with `(unavailable) {unsupported hooks}` and no hooks fire -- including the hooks for events that are supported.
- If your plugin uses a tool-name matcher (for example, `PreToolUse` with `matcher: "MultiEdit"`) for a Claude tool that has no Pi analog, your plugin installs with `(unavailable) {unsupported hooks}`.
- If your plugin uses a regular-expression matcher, your plugin installs with `(unavailable) {unsupported hooks}`. Only literal matchers and pipe-OR alternation (for example, `Edit|Write`) are supported in v1.13.
- If your plugin uses a handler `type` other than `"command"` (for example, `"http"`), your plugin installs with `(unavailable) {unsupported hooks}`.

The bridge chooses strict supportability over partial support because the alternative is silently dropping half of a hook set -- a plugin author whose `PostToolUse` handler runs but whose `Stop` handler does not has no way to discover the gap until something goes wrong. Failing the install fast surfaces the unsupported feature immediately so you can plan around it (rewrite the plugin to use only supported events, gate the unsupported events behind a feature flag, or wait for a future milestone that lifts the restriction).

## Marketplace coverage

The official Anthropic marketplace ships 13 plugins. Ten of those install with hooks fully supported in v1.13. Three install with `(unavailable) {unsupported hooks}` because they declare hooks targeting events outside the supported set:

- `ralph-wiggum` -- declares `Stop` (an unsupported event).
- `hookify` -- declares `Stop` alongside supported events; the whole plugin is unavailable as long as `Stop` is unsupported.
- `security-guidance` -- declares `Stop` alongside supported events; same reason.

Future milestones may expand the supported set; when they do, plugins that were previously unavailable will become installable on the next `/reload`.

## Further reading

- [Claude Code hooks reference](https://code.claude.com/docs/en/hooks) -- the upstream authoritative field reference, including the full `if`-permission-rule grammar, precedence rules, the per-event stdin and stdout contracts, and the complete environment-variable list the bridge inherits.
- Pi extension API documentation via the `@mariozechner/pi-coding-agent` package -- the host runtime contract, including how the bridge subscribes to Pi events, how hook output is injected back into the assistant's turn, and how user-visible notifications are emitted.

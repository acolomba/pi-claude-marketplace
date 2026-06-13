# Claude Code hook config syntax -- bridge reference

**Audited:** 2026-06-13 **Confidence:** HIGH on standard fields and per-event contracts (primary source is the live Claude Code Hooks reference at `code.claude.com/docs/en/hooks` plus the hooks guide); HIGH on the `if` field's standard-vs-extension status and per-event applicability (Anthropic-documented since Claude Code v2.1.85); MEDIUM on `asyncRewake` / `rewakeMessage` / `rewakeSummary` semantics (undocumented in the public Hooks reference; verified via the live `security-guidance` source, Anthropic-published Issue #44881, third-party reproductions, and a "read the source" deep-dive); HIGH on per-plugin audit (verified by fetching each `hooks.json` from `anthropics/claude-code` at the audit commit).

Authority for v1.13 implementability decisions is this project's `.planning/REQUIREMENTS.md` and the upstream ecosystem audit at `docs/research/claude-hooks-vs-pi-events.md`. This document is a contract reference, not a roadmap.

## 1. Hook config file layout

### File location

A Claude plugin declares hooks in **one** file: `<pluginRoot>/hooks/hooks.json`. The plugin can also include an optional top-level `description` field (string) inside the same file. The file is bundled with the plugin and shipped to enabled-plugin consumers.

Other hook config locations (`~/.claude/settings.json`, `.claude/settings.json`, `.claude/settings.local.json`, managed policy settings, skill/agent frontmatter) are **out of scope for the bridge** -- the bridge only ever reads plugin-bundled hooks files. Source: [Hooks reference § Configure hook location](https://code.claude.com/docs/en/hooks-guide#configure-hook-location).

### Top-level JSON shape

```json
{
  "description": "string, optional",
  "hooks": {
    "EventName": [ MatcherGroup, MatcherGroup, ... ],
    "OtherEvent": [ MatcherGroup, ... ]
  },
  "disableAllHooks": false
}
```

Where each `MatcherGroup` is:

```json
{
  "matcher": "string, optional",
  "hooks": [ HookHandler, HookHandler, ... ]
}
```

The shape has **two nesting levels**: an outer `hooks` map (event → matcher groups) and an inner `hooks` array (per-group handler list). The matcher field lives on the **group**, not on the individual handler. The bridge cannot collapse this -- the security-guidance plugin uses two distinct groups under `PostToolUse` with different matchers (`Edit|Write|MultiEdit|NotebookEdit` vs `Bash`).

The top-level `disableAllHooks` field is a settings-file concept; plugins don't ship it (it would defeat the point of bundling hooks). Treat as ignored at parse time.

### One file per plugin

A plugin has at most one `hooks/hooks.json`. There is no multi-file or directory-glob layout. Plugins without hooks (e.g. `plugin-dev`, `commit-commands` in the audit) simply omit the file; the resolver must tolerate its absence.

## 2. Standard fields per hook entry

### MatcherGroup-level fields

| Field     | JSON shape           | Required | Default          | Notes                                                                                     | v1.13 implementability                                                                           |
| --------- | -------------------- | -------- | ---------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `matcher` | string               | optional | `""` = match all | Per-event-type semantics, see table below. When the matcher contains only \`\[A-Za-z0-9\_ | \]\`, it is treated as exact-string-or-pipe-OR; any other character makes it a JavaScript regex. |
| `hooks`   | array of HookHandler | required | --               | Per-group handler list. Order is preserved and matters for declaration-order semantics.   | **IMPLEMENT** -- already covered by DISP-04.                                                     |

### HookHandler-level fields (all types)

| Field           | JSON shape                                                 | Required | Default                                                                                                                                                               | Notes                                                                                                                                                                                                                                                                 | v1.13 implementability                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --------------- | ---------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `type`          | `"command" \| "http" \| "mcp_tool" \| "prompt" \| "agent"` | required | --                                                                                                                                                                    | Discriminator. Only `command` is in v1.13 scope.                                                                                                                                                                                                                      | **IMPLEMENT** for `command`; **ESCALATE** all four non-`command` types (no Pi runtime support; see § 7).                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `if`            | string                                                     | optional | absent = always match                                                                                                                                                 | Permission-rule syntax filter on tool name + arguments. **Only valid on tool events** (PreToolUse, PostToolUse, PostToolUseFailure, PermissionRequest, PermissionDenied); attaching to any other event prevents the hook from running. Requires Claude Code v2.1.85+. | **ESCALATE** for v1.13 (TOOL-02 amendment). Glob syntax matches permission rules: `Bash(git *)`, `Edit(*.ts)`, `Read(src/**/*)`, etc. Implementing requires (a) a glob-to-matcher engine, (b) per-tool argument-extraction adapters mapping `Edit(*.ts)` to `event.input.file_path`, and (c) Bash subcommand parsing for `$()` / backticks. The bridge already disallows full regex per MATCH-02 for the same reason: building it costs more than the first-party coverage delta is worth, and the strict-supportability stance forbids partial implementation. |
| `timeout`       | number (seconds)                                           | optional | Defaults vary by `type`: command/http/mcp_tool = 600s; prompt = 30s; agent = 60s. Per-event reduction: UserPromptSubmit lowers default to 30s; MessageDisplay to 10s. | Wall-clock timeout for the handler.                                                                                                                                                                                                                                   | **IMPLEMENT** -- EXEC-02 already covers this. NOTE: REQ EXEC-02 currently specifies a 60s bridge default; upstream default for `command` is 600s. Decision required at implementation time -- see § 9.                                                                                                                                                                                                                                                                                                                                                          |
| `statusMessage` | string                                                     | optional | --                                                                                                                                                                    | Spinner-message text shown to user while hook runs.                                                                                                                                                                                                                   | **TOLERATE** -- no Pi spinner surface. Cosmetic-only; ignoring is silent and lossless.                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `once`          | boolean                                                    | optional | `false`                                                                                                                                                               | Run-once-per-session, then auto-remove. Documented as skills/agents-only; ignored in settings. Should not appear in plugin `hooks.json`.                                                                                                                              | **TOLERATE** -- irrelevant in plugin context; debug-log if encountered.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

### `command`-type-only fields

| Field           | JSON shape               | Required | Default             | Notes                                                                                                                                                                                                                                                                                                                                            | v1.13 implementability                                                                                                                                                                                                                                                                                                                                                                |
| --------------- | ------------------------ | -------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `command`       | string                   | required | --                  | Shell command string (when no `args`) or executable path (when `args` is set). Supports `${CLAUDE_PROJECT_DIR}` / `${CLAUDE_PLUGIN_ROOT}` / `${CLAUDE_PLUGIN_DATA}` env-var expansion inline.                                                                                                                                                    | **IMPLEMENT** -- covered by EXEC-01 / LIFE-03.                                                                                                                                                                                                                                                                                                                                        |
| `args`          | array of strings         | optional | absent = shell-form | When present, `command` is spawned directly (exec form, no shell).                                                                                                                                                                                                                                                                               | **IMPLEMENT** -- additive to EXEC-01. When `args` is present, switch from shell to exec form.                                                                                                                                                                                                                                                                                         |
| `async`         | boolean                  | optional | `false`             | Runs in background without blocking the agent. Fire-and-forget. No re-injection.                                                                                                                                                                                                                                                                 | **TOLERATE** for v1.13 -- the bridge can run it foreground without semantic loss for **observation-only** hooks. The hook's exit code / stdout is discarded under `async: true` upstream (no return value reaches the agent), so synchronous execution is strictly stronger than async. Debug-log when encountered. (Distinct from `asyncRewake`, which DOES carry return semantics.) |
| `asyncRewake`   | boolean                  | optional | `false`             | Implies `async`. Runs in background; on exit code 2, wakes the model and injects stderr (or stdout if stderr empty) as a system reminder for the next turn. **Undocumented in public Hooks reference** but used by `security-guidance` and observable in Anthropic's own [Issue #44881](https://github.com/anthropics/claude-code/issues/44881). | **ESCALATE** (TOOL-02 amendment). See § 7 deep-dive; cannot be honored without semantic loss under v1.13's stack.                                                                                                                                                                                                                                                                     |
| `rewakeMessage` | string                   | optional | --                  | Companion to `asyncRewake`. Template prefixed to the re-injected system-reminder content on rewake.                                                                                                                                                                                                                                              | **ESCALATE** (subordinate to `asyncRewake`). Has no meaning without `asyncRewake: true`.                                                                                                                                                                                                                                                                                              |
| `rewakeSummary` | string                   | optional | --                  | Companion to `asyncRewake`. Short status-message string for the UI surface that indicates a background rewake fired.                                                                                                                                                                                                                             | **ESCALATE** (subordinate to `asyncRewake`).                                                                                                                                                                                                                                                                                                                                          |
| `shell`         | `"bash" \| "powershell"` | optional | `"bash"` on Unix    | Shell selector. Ignored when `args` is set.                                                                                                                                                                                                                                                                                                      | **TOLERATE** -- Unix shell selector; Windows out of scope for v1.13. Debug-log if non-`bash`.                                                                                                                                                                                                                                                                                         |

### `http`-type fields (out of v1.13 scope)

`url` (required string), `headers` (object with `$VAR`/`${VAR}` interpolation from `allowedEnvVars`), `allowedEnvVars` (array). Used by no first-party plugin. **ESCALATE** at the `type` discriminator level -- see § 7.

### `mcp_tool`-type fields (out of v1.13 scope)

`server` (required string), `tool` (required string), `input` (object with `${path}` substitution from hook JSON input). Calls a tool on a connected MCP server. Used by no first-party plugin. **ESCALATE** at the `type` discriminator level.

### `prompt` and `agent`-type fields (out of v1.13 scope)

`prompt` (required string with `$ARGUMENTS` placeholder), `model` (optional). Runs an LLM evaluation as the hook handler. Agent type is documented as experimental. Used by no first-party plugin. **ESCALATE** at the `type` discriminator level.

### Matcher semantics summary table (source: live Claude Code docs)

| Pattern in `matcher`    | Evaluation                    | Bridge handling                     |
| ----------------------- | ----------------------------- | ----------------------------------- |
| `""`, `"*"`, or omitted | Match all events of that type | Match all                           |
| Only \`\[a-zA-Z0-9\_    | \]\`                          | Exact string OR pipe-OR alternation |
| Any other character     | JavaScript regex              | TOOL-02(a) → plugin unavailable     |

### Matcher target field per event type

| Event                                                                                                                                                           | Matcher targets                                                                              |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `PermissionRequest`, `PermissionDenied`                                                                      | tool name                                                                                    |
| `SessionStart`                                                                                                                                                  | source (`startup`/`resume`/`clear`/`compact`)                                                |
| `Setup`                                                                                                                                                         | trigger (`init`/`maintenance`)                                                               |
| `SessionEnd`                                                                                                                                                    | reason (`clear`/`resume`/`logout`/`prompt_input_exit`/`bypass_permissions_disabled`/`other`) |
| `Notification`                                                                                                                                                  | notification type (`permission_prompt`/`idle_prompt`/...)                                    |
| `SubagentStart`, `SubagentStop`                                                                                                                                 | agent type                                                                                   |
| `PreCompact`, `PostCompact`                                                                                                                                     | trigger (`manual`/`auto`)                                                                    |
| `ConfigChange`                                                                                                                                                  | source (`user_settings`/`project_settings`/...)                                              |
| `StopFailure`                                                                                                                                                   | error type (`rate_limit`/`overloaded`/...)                                                   |
| `InstructionsLoaded`                                                                                                                                            | load reason (`session_start`/`nested_traversal`/...)                                         |
| `Elicitation`, `ElicitationResult`                                                                                                                              | MCP server name                                                                              |
| `FileChanged`                                                                                                                                                   | literal filenames (pipe-OR; **not regex** -- special-cased upstream)                         |
| `UserPromptExpansion`                                                                                                                                           | command name                                                                                 |
| `UserPromptSubmit`, `PostToolBatch`, `Stop`, `TeammateIdle`, `TaskCreated`, `TaskCompleted`, `WorktreeCreate`, `WorktreeRemove`, `CwdChanged`, `MessageDisplay` | no matcher support -- matcher field ignored, hook always fires                               |

## 3. Hook stdin payload contract per event type

Every event delivers a common envelope plus event-specific fields. Field names are case-sensitive and verbatim from the Claude Code Hooks reference.

### Common stdin fields (every event)

```json
{
  "session_id": "string",
  "transcript_path": "string (path to conversation JSON)",
  "cwd": "string (current working directory)",
  "hook_event_name": "string (event name)",
  "permission_mode": "default|plan|acceptEdits|auto|dontAsk|bypassPermissions",
  "effort": { "level": "low|medium|high|xhigh|max" },
  "agent_id": "string (subagent context only)",
  "agent_type": "string (subagent context or --agent)"
}
```

### Per-event-specific fields (16 v1.13-supported events)

| Event                 | Event-specific stdin fields                                            | Pi-source for synthesis                                                             | v1.13 implementability of payload                                                          |
| --------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `SessionStart`        | \`source: "startup"                                                    | "resume"                                                                            | "clear"                                                                                    |
| `UserPromptSubmit`    | `prompt: string`                                                       | Pi `input` (`event.text`)                                                           | IMPLEMENT (PAYL-01 bucket A)                                                               |
| `PreToolUse`          | `tool_name: string`, `tool_input: object`                              | Pi `tool_call` (`event.toolName` + `event.input`)                                   | IMPLEMENT (PAYL-01 + TOOL-01 capitalization map)                                           |
| `PostToolUse`         | `tool_name`, `tool_input`, `tool_response: object` (the tool's result) | Pi `tool_result` filtered `!event.isError`                                          | IMPLEMENT (PAYL-01)                                                                        |
| `PostToolUseFailure`  | `tool_name`, `tool_input`, `tool_response` (with error)                | Pi `tool_result` filtered `event.isError`                                           | IMPLEMENT (PAYL-01)                                                                        |
| `PreCompact`          | trigger (`manual`/`auto`)                                              | Pi `session_before_compact`                                                         | IMPLEMENT (PAYL-01)                                                                        |
| `PostCompact`         | trigger (`manual`/`auto`)                                              | Pi `session_compact`                                                                | IMPLEMENT (PAYL-01)                                                                        |
| `SessionEnd`          | reason (`clear`/`logout`/etc.)                                         | Pi `session_shutdown`                                                               | IMPLEMENT (PAYL-01)                                                                        |
| `FileChanged`         | `file_path: string`, `change_type: string`                             | Bridge-owned `chokidar` watcher                                                     | IMPLEMENT (PAYL-02 bucket B)                                                               |
| `CwdChanged`          | new cwd (path)                                                         | Bridge synthesizes from `tool_result` for `bash` `cd`-pattern matches               | IMPLEMENT lossy (PAYL-04 bucket D)                                                         |
| `PostToolBatch`       | per-batch summary fields                                               | Bridge counts `tool_execution_end` to derive batch completion                       | IMPLEMENT lossy (PAYL-04)                                                                  |
| `UserPromptExpansion` | expansion details                                                      | Bridge diffs `input.text` vs `before_agent_start.prompt`                            | IMPLEMENT lossy (PAYL-04)                                                                  |
| `Stop`                | no event-specific fields                                               | Pi `agent_end`                                                                      | IMPLEMENT lossy (PAYL-03 -- uses `pi.sendUserMessage` to re-inject on `decision: "block"`) |
| `StopFailure`         | error type (`rate_limit`/...)                                          | Bridge tracks `after_provider_response` status and synthesizes                      | IMPLEMENT lossy (PAYL-04)                                                                  |
| `SubagentStart`       | `agent_type`, agent metadata                                           | Pi `pi.events.on("subagent:async-started")` (async); `tool_call` filtered (sync)    | IMPLEMENT conditional on `pi-subagents` (PAYL-05 / TOOL-02(g))                             |
| `SubagentStop`        | `agent_type`, completion metadata                                      | Pi `pi.events.on("subagent:async-complete")` (async); `tool_result` filtered (sync) | IMPLEMENT conditional on `pi-subagents` (PAYL-05 / TOOL-02(g))                             |

The 14 unsupported events (E + F + G + H buckets per the upstream audit) never reach the dispatcher under v1.13 -- TOOL-02(c)/(d)/(e)/(f) marks plugins declaring them as unavailable.

## 4. Hook stdout JSON contract per event type

Exit code 0 with valid JSON on stdout is the structured-output path. Field names are case-sensitive and verbatim. Exit code 2 with stderr is the unstructured-block path; JSON is ignored on exit 2.

### Universal stdout fields (every event, top-level)

| Field              | Type      | Default | Effect                                                                                                                                |
| ------------------ | --------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `continue`         | boolean   | `true`  | If `false`, stop Claude entirely after this hook. Takes precedence over event-specific decisions.                                     |
| `stopReason`       | string    | --      | User-facing reason when `continue: false`. Not shown to Claude.                                                                       |
| `suppressOutput`   | boolean   | `false` | Hide stdout from transcript (still in debug log).                                                                                     |
| `systemMessage`    | string    | --      | Warning shown to user.                                                                                                                |
| `terminalSequence` | string    | --      | Terminal escape sequence (OSC 0/1/2/9/99/777, BEL only).                                                                              |
| `decision`         | `"block"` | --      | Top-level block decision (used by PostToolUse, Stop, UserPromptSubmit, UserPromptExpansion, PostToolBatch, ConfigChange, PreCompact). |
| `reason`           | string    | --      | Companion to `decision: "block"`. Fed back to Claude as feedback.                                                                     |

### Per-event `hookSpecificOutput` shape

#### PreToolUse

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "allow|deny|ask|defer",
    "permissionDecisionReason": "string",
    "updatedInput": { /* replacement tool input */ },
    "additionalContext": "string"
  }
}
```

- Bridge maps `permissionDecision: "deny"` to Pi `tool_call` block (`{ block: true, reason: permissionDecisionReason }`).
- Bridge maps `updatedInput` to mutating `event.input` in place (research § "Mutation semantics differ").
- `additionalContext` is concatenated into context via `before_agent_start` injection.
- `"defer"` is `-p` non-interactive-mode only -- not applicable in Pi (debug-log, treat as `"deny"`).

#### PostToolUse

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PostToolUse",
    "updatedToolOutput": "string",
    "additionalContext": "string"
  }
}
```

Or top-level `decision: "block"` + `reason`.

- Bridge maps `updatedToolOutput` to Pi `tool_result` patch (`{ content: [{ type: "text", text: updatedToolOutput }] }`).
- Top-level `decision: "block"` maps to Pi `tool_result` with `isError: true`.

#### SessionStart / Setup / SubagentStart

```json
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart|Setup|SubagentStart",
    "additionalContext": "string",
    "sessionTitle": "string (SessionStart only)",
    "initialUserMessage": "string (SessionStart only)",
    "watchPaths": ["array of paths (SessionStart only)"],
    "reloadSkills": true
  }
}
```

- Bridge re-emits `additionalContext` via Pi `before_agent_start` injection (Pi has no direct `additionalContext` return shape on `session_start`).
- `sessionTitle` / `initialUserMessage` / `watchPaths` are Pi `session_start` return fields -- direct map.
- `Setup` is bucket H per TOOL-02(f) -- never reaches stdout in v1.13.

#### UserPromptSubmit

- `additionalContext` (string) injected into context.
- Top-level `decision: "block"` + `reason` blocks prompt submission.
- For Pi: maps to `input` event return value `{ action: "handled" }` (block) or `{ action: "transform", text: additionalContext }` for additive context.

#### Stop / SubagentStop

- Top-level `decision: "block"` + `reason` triggers loop-continue.
- `hookSpecificOutput.additionalContext` adds feedback without blocking.
- Bridge synthesis (PAYL-03): on `decision: "block"`, call `pi.sendUserMessage(reason, { deliverAs: "followUp" })`.

#### UserPromptExpansion / PostToolBatch / PreCompact / ConfigChange

- Top-level `decision: "block"` + `reason` blocks the event.
- ConfigChange is bucket H per TOOL-02(f) -- never reaches stdout in v1.13.

#### StopFailure / PostCompact / SessionEnd / SubagentStop (passive arm)

- Output and exit code are ignored. Observation-only.
- Bridge runs them for side effects; ignores all return values.

#### FileChanged / CwdChanged

- Output and exit code are ignored.

### `additionalContext` cap

Strings passed via `additionalContext` are capped at 10,000 characters by Claude Code. The bridge should truncate with marker if exceeded (matches the EXEC-02 stdin truncation pattern).

### Output and exit code ignored events (per upstream "Exit code 2 behavior per event")

- `Notification`, `SessionStart`, `Setup`, `StopFailure`, `PostCompact`, `SessionEnd`, `MessageDisplay`, `SubagentStop`, `CwdChanged`, `FileChanged`, `InstructionsLoaded`, `TaskCompleted`, `WorktreeRemove`, `ElicitationResult`: exit 2 surfaces stderr to user; execution continues regardless. JSON output ignored.

## 5. Hook environment

### Env vars Claude Code sets for hook children

| Var                  | Value                                                    | When set                                             | v1.13 bridge                                                                                                                                    |
| -------------------- | -------------------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `CLAUDE_PROJECT_DIR` | Project root path                                        | All hooks, all stdio MCP servers, plugin LSP servers | Set to `ctx.cwd` snapshot at dispatch (EXEC-01).                                                                                                |
| `CLAUDE_PLUGIN_ROOT` | Plugin install directory                                 | Plugin hooks only                                    | Set to `<scopeRoot>/pi-claude-marketplace/plugins/<plugin-id>/` (LIFE-03).                                                                      |
| `CLAUDE_PLUGIN_DATA` | Plugin persistent data directory                         | Plugin hooks only                                    | Set to a per-plugin subtree under `<scopeRoot>/pi-claude-marketplace/data/<plugin-id>/`; create on first hook fire (NEW REQ needed -- see § 9). |
| `CLAUDE_ENV_FILE`    | Path to file for persisting env vars across child shells | SessionStart, Setup, CwdChanged, FileChanged         | NEW REQ needed -- see § 9. Used by `direnv export bash > "$CLAUDE_ENV_FILE"` pattern in the hooks guide.                                        |
| `CLAUDE_CODE_REMOTE` | `"true"` in remote web, unset locally                    | All hooks                                            | Set to unset (Pi runs locally).                                                                                                                 |
| `CLAUDE_EFFORT`      | Effort level (`low`/`medium`/`high`/`xhigh`/`max`)       | Tool-use context events                              | No Pi analog; omit.                                                                                                                             |

In addition to the `CLAUDE_*` set, EXEC-01 already specifies merging `PI_*` for portability.

### Exit code semantics

| Code      | Meaning            | JSON parsing                                 | Bridge behavior                                                                                                                                                                                          |
| --------- | ------------------ | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `0`       | Success            | stdout parsed as JSON if valid               | Event-specific decision applied; absence of decision = no-op                                                                                                                                             |
| `2`       | Blocking error     | JSON ignored; stderr fed back to Claude      | Block the event per event-specific semantics (PreToolUse → tool denied; Stop → continue-loop; etc.) -- but for events listed in "Output and exit code ignored" (§ 4) exit 2 just surfaces stderr to user |
| Any other | Non-blocking error | JSON ignored; stderr shown as warning notice | Execution continues; first line of stderr surfaces as `<hook name> hook error`                                                                                                                           |

Per Claude Code's "Don't mix" rule: when a hook exits 2, any JSON it printed is discarded. The bridge must apply the same precedence.

### Stdio channels

- **stdin:** UTF-8 JSON, one object, no streaming. EXEC-02 caps at 256KB.
- **stdout:** UTF-8. On exit 0, parsed as JSON if valid; on exit 0 with invalid JSON, treated as plain output (for `UserPromptSubmit` / `SessionStart` / `UserPromptExpansion`, stdout becomes context-injection text; for other events, stdout is logged but not actioned).
- **stderr:** UTF-8. On exit 2, fed back to Claude as block reason; on other non-zero exits, first line shown to user as `<hook name> hook error`. Debug-logged in full.

The bridge per EXEC-03 routes stderr to debug-log only at runtime (not `ctx.ui.notify`). This is a DEVIATION from Claude Code's "first line to user" behavior, justified by Pi's IL-2 single-channel constraint. Document in PRD-style behavioral-divergence section.

## 6. Per-plugin audit (anthropics/claude-code @ ca9f6045)

All five hook-using first-party plugins fetched verbatim. Each file lives at `plugins/<name>/hooks/hooks.json` in the audit commit.

### explanatory-output-style

**Source:** [`plugins/explanatory-output-style/hooks/hooks.json`](https://github.com/anthropics/claude-code/blob/ca9f6045fc90c8244f9e787fb57d54b380f9a27c/plugins/explanatory-output-style/hooks/hooks.json)

```json
{
  "description": "Explanatory mode hook that adds educational insights instructions",
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PLUGIN_ROOT}/hooks-handlers/session-start.sh"
          }
        ]
      }
    ]
  }
}
```

**Fields used:** `type`, `command`. No matcher, no `if`, no payload extensions. Pure bucket A.

**Implementability:** SUPPORTED. Single `SessionStart` hook with no matcher.

### learning-output-style

**Source:** [`plugins/learning-output-style/hooks/hooks.json`](https://github.com/anthropics/claude-code/blob/ca9f6045fc90c8244f9e787fb57d54b380f9a27c/plugins/learning-output-style/hooks/hooks.json)

```json
{
  "description": "Learning mode hook that adds interactive learning instructions",
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PLUGIN_ROOT}/hooks-handlers/session-start.sh"
          }
        ]
      }
    ]
  }
}
```

**Fields used:** `type`, `command`. Mirror of explanatory-output-style.

**Implementability:** SUPPORTED.

### ralph-wiggum

**Source:** [`plugins/ralph-wiggum/hooks/hooks.json`](https://github.com/anthropics/claude-code/blob/ca9f6045fc90c8244f9e787fb57d54b380f9a27c/plugins/ralph-wiggum/hooks/hooks.json)

```json
{
  "description": "Ralph Wiggum plugin stop hook for self-referential loops",
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PLUGIN_ROOT}/hooks/stop-hook.sh"
          }
        ]
      }
    ]
  }
}
```

**Fields used:** `type`, `command`. No matcher.

**Implementability:** SUPPORTED -- canary for PAYL-03 bucket-D `Stop` synthesis. Stop's block-to-continue JSON contract is the load-bearing test case for v1.13.

### hookify

**Source:** [`plugins/hookify/hooks/hooks.json`](https://github.com/anthropics/claude-code/blob/ca9f6045fc90c8244f9e787fb57d54b380f9a27c/plugins/hookify/hooks/hooks.json)

```json
{
  "description": "Hookify plugin - User-configurable hooks from .local.md files",
  "hooks": {
    "PreToolUse": [
      { "hooks": [ { "type": "command", "command": "python3 ${CLAUDE_PLUGIN_ROOT}/hooks/pretooluse.py", "timeout": 10 } ] }
    ],
    "PostToolUse": [
      { "hooks": [ { "type": "command", "command": "python3 ${CLAUDE_PLUGIN_ROOT}/hooks/posttooluse.py", "timeout": 10 } ] }
    ],
    "Stop": [
      { "hooks": [ { "type": "command", "command": "python3 ${CLAUDE_PLUGIN_ROOT}/hooks/stop.py", "timeout": 10 } ] }
    ],
    "UserPromptSubmit": [
      { "hooks": [ { "type": "command", "command": "python3 ${CLAUDE_PLUGIN_ROOT}/hooks/userpromptsubmit.py", "timeout": 10 } ] }
    ]
  }
}
```

**Fields used:** `type`, `command`, `timeout`. No matchers, no `if`, no payload extensions.

**Implementability:** SUPPORTED. Each hook is bucket A or D, all 16-supported events.

### security-guidance

**Source:** [`plugins/security-guidance/hooks/hooks.json`](https://github.com/anthropics/claude-code/blob/ca9f6045fc90c8244f9e787fb57d54b380f9a27c/plugins/security-guidance/hooks/hooks.json)

```json
{
  "description": "Security guidance plugin -- pattern-based warnings on edits, git-diff-based LLM review on stop",
  "hooks": {
    "SessionStart": [
      { "hooks": [ { "type": "command", "command": "bash \"${CLAUDE_PLUGIN_ROOT}/hooks/sg-python.sh\" \"${CLAUDE_PLUGIN_ROOT}/hooks/ensure_agent_sdk.py\"", "timeout": 180 } ] }
    ],
    "UserPromptSubmit": [
      { "hooks": [ { "type": "command", "command": "bash \"${CLAUDE_PLUGIN_ROOT}/hooks/sg-python.sh\" \"${CLAUDE_PLUGIN_ROOT}/hooks/security_reminder_hook.py\"" } ] }
    ],
    "PostToolUse": [
      {
        "hooks": [ { "type": "command", "command": "bash \"${CLAUDE_PLUGIN_ROOT}/hooks/sg-python.sh\" \"${CLAUDE_PLUGIN_ROOT}/hooks/security_reminder_hook.py\"" } ],
        "matcher": "Edit|Write|MultiEdit|NotebookEdit"
      },
      {
        "hooks": [
          {
            "type": "command",
            "command": "bash \"${CLAUDE_PLUGIN_ROOT}/hooks/sg-python.sh\" \"${CLAUDE_PLUGIN_ROOT}/hooks/security_reminder_hook.py\"",
            "if": "Bash(git commit:*)",
            "asyncRewake": true,
            "rewakeMessage": "Background security review of commit -- address or acknowledge the findings below, then continue with the user's original request or continue waiting for their reply:",
            "rewakeSummary": "Commit security review found issues"
          },
          {
            "type": "command",
            "command": "bash \"${CLAUDE_PLUGIN_ROOT}/hooks/sg-python.sh\" \"${CLAUDE_PLUGIN_ROOT}/hooks/security_reminder_hook.py\"",
            "if": "Bash(git push:*)",
            "asyncRewake": true,
            "rewakeMessage": "Background security review of pushed commits not yet reviewed -- address or acknowledge the findings below, then continue with the user's original request or continue waiting for their reply:",
            "rewakeSummary": "Push security review found issues"
          }
        ],
        "matcher": "Bash"
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bash \"${CLAUDE_PLUGIN_ROOT}/hooks/sg-python.sh\" \"${CLAUDE_PLUGIN_ROOT}/hooks/security_reminder_hook.py\"",
            "asyncRewake": true,
            "rewakeMessage": "Background security review feedback -- address or acknowledge the findings below, then continue with the user's original request or continue waiting for their reply. This is supplementary, not a replacement for your previous response:",
            "rewakeSummary": "Background security review found issues"
          }
        ]
      }
    ]
  }
}
```

**Fields used:** `type`, `command`, `timeout`, `matcher`, `if`, `asyncRewake`, `rewakeMessage`, `rewakeSummary`.

**Note on `if` syntax variant:** The pattern `Bash(git commit:*)` uses a colon-prefix glob form (`:*`) that the public Hooks reference documents only via `Bash(git *)` example with space-prefix. The colon form appears specific to permission-rule subcommand-matching grammar. Implementability is independent of the variant -- both forms are glob-permission-rule patterns; either is ESCALATE under v1.13.

**Implementability:** UNAVAILABLE under v1.13 -- multiple independent TOOL-02 triggers:

- TOOL-02(b): matcher `Edit|Write|MultiEdit|NotebookEdit` contains `MultiEdit` and `NotebookEdit`, neither of which has a Pi mapping under TOOL-01.
- **Newly identified -- see § 7:** `asyncRewake` family (semantically irrecoverable under v1.13 stack).
- **Newly identified -- see § 7:** `if` field (requires glob engine + arg-extraction adapters; explicitly out of v1.13 scope per the matcher-engine policy).

The plugin would remain UNAVAILABLE under v1.13 even if all three were independent -- `MultiEdit` / `NotebookEdit` alone is sufficient to trigger TOOL-02(b).

## 7. Per-field implementability decisions

This section turns each discovered field into a definitive IMPLEMENT / TOLERATE / ESCALATE verdict for v1.13. Decisions feed § 9 (REQ amendments).

### Standard fields the bridge MUST implement

| Field                                      | Verdict             | Rationale                                                                                                                                                                                                                               | Covered by existing REQ?                        |
| ------------------------------------------ | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `description` (top-level)                  | IMPLEMENT           | Trivial passthrough; surface in `info` if useful.                                                                                                                                                                                       | Trivial; no new REQ.                            |
| `hooks` (outer map)                        | IMPLEMENT           | Required structural decode.                                                                                                                                                                                                             | HOOK-01 / HOOK-03.                              |
| `matcher` (group level, literal + pipe-OR) | IMPLEMENT           | First-party coverage demand; explicit policy.                                                                                                                                                                                           | MATCH-01 / MATCH-02.                            |
| `matcher` (group level, regex)             | ESCALATE            | Costs more than first-party delta; strict-supportability stance.                                                                                                                                                                        | TOOL-02(a).                                     |
| `hooks` (inner array)                      | IMPLEMENT           | Required structural decode.                                                                                                                                                                                                             | HOOK-03 / DISP-04.                              |
| `type: "command"`                          | IMPLEMENT           | Sole supported handler type for v1.13.                                                                                                                                                                                                  | EXEC-01.                                        |
| `command`                                  | IMPLEMENT           | Sole required field of `command` type.                                                                                                                                                                                                  | EXEC-01 / LIFE-03.                              |
| `args`                                     | IMPLEMENT (NEW REQ) | Used by no first-party plugin today but documented and trivially additive (switches `spawn` from shell to exec form). Failing to support it would create a future-fragility seam the strict-supportability stance has no tolerance for. | NEW: EXEC-04.                                   |
| `timeout`                                  | IMPLEMENT           | Already covered. Caveat: REQ EXEC-02 sets bridge default to 60s; upstream default for `command` is 600s.                                                                                                                                | EXEC-02 (verify default during implementation). |

### Fields the bridge SHOULD tolerate

| Field                           | Verdict  | Rationale                                                                                                                                                     |
| ------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `statusMessage`                 | TOLERATE | No Pi spinner surface; cosmetic-only. Silently ignore; debug-log at parse.                                                                                    |
| `once`                          | TOLERATE | Documented as skills/agents-only and ignored in settings. Should not appear in plugin `hooks.json`. Debug-log if encountered.                                 |
| `async` (without `asyncRewake`) | TOLERATE | Running foreground is strictly stronger than `async: true`'s fire-and-forget semantic (upstream discards return value under `async`). Debug-log; do not warn. |
| `shell`                         | TOLERATE | Unix shell selector; pinning to `bash` always works for v1.13 (no first-party plugin sets it). Debug-log if non-`bash` encountered.                           |
| `disableAllHooks` (top-level)   | TOLERATE | Settings-file concept; ignore at parse.                                                                                                                       |

### Fields that ESCALATE to plugin-unavailable

#### `type` values other than `"command"`

| Type         | Verdict  | Rationale                                                                                                                                                                                                                                                                                                                     |
| ------------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `"http"`     | ESCALATE | POST-to-URL handler with `headers` env-var interpolation and `allowedEnvVars` allowlist. No first-party plugin uses it. Implementing requires HTTP client + env-var interpolation engine. Not justified by first-party demand.                                                                                                |
| `"mcp_tool"` | ESCALATE | Calls a tool on a connected MCP server. Pi's MCP integration via `pi-mcp-adapter` does NOT expose a server-tool-call API to extensions today (the adapter's surface is proxy tools + slash commands; see `claude-hooks-vs-pi-events.md` § Soft-dep extension audit). Even with pi-mcp-adapter present, the API doesn't exist. |
| `"prompt"`   | ESCALATE | Spawns an LLM evaluation as the handler. Requires Pi's provider/model selection, prompt-template substitution, and result-JSON parsing infrastructure. None of which exists at the bridge layer.                                                                                                                              |
| `"agent"`    | ESCALATE | Multi-turn experimental variant of `prompt`. Documented as experimental and may change.                                                                                                                                                                                                                                       |

A plugin whose `hooks.json` declares any handler with `type !== "command"` is marked `(unavailable) {unsupported hooks}`.

#### `if` field

**Verdict:** ESCALATE.

**Standard-vs-extension status:** STANDARD. Documented in the Claude Code Hooks guide § "Filter by tool name and arguments with the `if` field" (requires Claude Code v2.1.85+). Uses permission-rule syntax. Applies ONLY to tool events: `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `PermissionRequest`, `PermissionDenied`. Attaching to other events prevents the hook from running.

**Glob semantics:** Same patterns as Claude Code permission rules:

- `Bash(git *)` -- matches any git command (space-prefix subcommand glob)
- `Bash(git commit:*)` -- matches any `git commit ...` argument list (colon-prefix subcommand grammar used by security-guidance)
- `Edit(*.ts)` -- matches Edit tool calls where the path argument ends in `.ts`
- `Read(src/**/*)` -- matches Read tool calls under `src/` recursively
- `mcp__slack__post_message` -- matches MCP tool by full name

Filter checks each shell subcommand inside `$()` and backticks; falls open (runs hook) when the Bash command can't be parsed.

**Why ESCALATE:**

1. **Pure-JS glob engine required.** The bridge already disallows regex per MATCH-02 to keep the matcher engine simple. Adding `if`-pattern globbing reintroduces the same complexity through a different door -- recursive `**`, character classes, alternation, etc.

2. **Per-tool argument-extraction adapters required.** `Bash(git *)` needs to inspect `event.input.command`. `Edit(*.ts)` needs to inspect `event.input.file_path`. `Read(src/**/*)` likewise. The bridge would need to encode every Claude tool's argument-shape into a static table -- superset of TOOL-01.

3. **Bash subcommand parsing required.** Per upstream docs, the filter parses `$()` and backticks. This is a non-trivial shell parser. The strict-supportability stance forbids partial implementation.

4. **First-party demand is one plugin.** Only `security-guidance` uses `if`. That plugin is already TOOL-02(b)-unavailable due to `MultiEdit` / `NotebookEdit` in its matcher; honoring `if` doesn't unlock it.

5. **No safe degrade.** Silently ignoring `if` would cause the hook to fire on EVERY Bash call instead of only `git commit ...` / `git push ...` -- over-firing the security review handler on every shell command. That's a behavior change loud enough that strict supportability forbids it.

**TOOL-02 amendment needed.** Add condition (h): hook entry contains `if` field.

#### `asyncRewake` / `rewakeMessage` / `rewakeSummary` family

**Verdict:** ESCALATE.

**Standard-vs-extension status:** UNDOCUMENTED in the public Hooks reference. Observable in:

1. The Anthropic-shipped `security-guidance` plugin source (audit commit).
2. [Anthropic Issue #44881](https://github.com/anthropics/claude-code/issues/44881), where Anthropic engineers acknowledge `asyncRewake` and treat the visible system-reminder rendering as a bug -- confirming it's a real production feature.
3. Multiple third-party plugin source uses (e.g. [claude-intercom](https://github.com/sanztheo/claude-intercom) wires `asyncRewake: true` on its watcher hooks).
4. The "I Read the Claude Code Source Code" deep-dive ([buildingbetter.tech](https://buildingbetter.tech/p/i-read-the-claude-code-source-code)) which describes it as production-implemented but undocumented.

Treat as a stable extension in Anthropic's own first-party stack but absent from the published contract.

**Actual semantics (cross-referenced):**

- `asyncRewake: true` implies `async: true` -- hook runs in the background, not blocking the current turn.
- The background process runs to completion (subject to `timeout`).
- **Exit code 2 from the background process wakes Claude back up** and injects the process's stderr (or stdout if stderr empty) into the agent's next turn as a `<system-reminder>` block.
- `rewakeMessage` is a string template prefixed to the injected reminder (the "header" the model sees).
- `rewakeSummary` is a short status-message string used by the UI to indicate a background rewake happened.
- Exit code 0 (or anything other than 2) from the background process is a normal background completion -- no rewake, no injection.
- The VSCode extension does NOT honor `asyncRewake: true` -- it falls back to synchronous foreground.

**Implementability sketch in Pi:**

The mechanical components exist:

- `node:child_process.spawn` can run background processes.
- `pi.sendUserMessage(reason, { deliverAs: "followUp" })` is already used for PAYL-03 bucket-D Stop synthesis.
- A bridge-owned async-rewake registry could spawn the process, watch its exit code, and call `sendUserMessage` on exit 2.

**Why ESCALATE despite mechanical feasibility:**

1. **Out-of-band turn semantics.** Claude Code's `asyncRewake` injects the system-reminder into the **next turn even if the user has not yet submitted one** -- i.e. it interrupts an idle agent. Pi's `sendUserMessage(deliverAs: "followUp")` is intended for in-stream interjection during an active loop; the idle-interruption semantic is not part of its documented contract. Cannot deliver matching behavior without a clean Pi runtime primitive for "inject a system message into the next turn, even from idle."

2. **System-reminder vs user-message rendering.** Claude Code wraps the injection in `<system-reminder>` (visible in Issue #44881's reproduction) -- a privileged channel that's not a user message and is parsed differently by the model. Pi's `sendUserMessage` is by design a user-message channel. Forcing the security-review feedback to appear as a user message changes how the model handles it (e.g. the model may try to respond directly to the user instead of treating it as side-channel context).

3. **Synchronous fallback is semantically destructive.** Silently degrading `asyncRewake: true` to synchronous in-band execution (the current v1.13 stance pre-research) means the hook fires synchronously on the same Bash `git commit` / `git push` turn that triggered it -- making the entire `git push` block on the security review. The security-guidance plugin's design relies on the review running in the background; synchronous fallback creates a UX regression where every `git push` invocation hangs for the duration of the LLM-driven security review (potentially minutes).

4. **The "subordinate fields" hard-fail.** If we ESCALATE `asyncRewake`, `rewakeMessage` and `rewakeSummary` MUST also ESCALATE -- they have no meaning without `asyncRewake: true` and supporting them in isolation would be a no-op.

**Decision.** Mark plugins declaring `asyncRewake: true` as `(unavailable) {unsupported hooks}` under TOOL-02. This is a deliberate regression from HOOK-03's current "tolerate + warn" stance -- the strict-supportability rule applies. Document `asyncRewake` family as a v1.14+ candidate (REQ EXTH-V2-01).

**TOOL-02 amendment needed.** Add condition (i): hook entry contains `asyncRewake: true`.

**Implementation note for parser:** `rewakeMessage` and `rewakeSummary` without `asyncRewake: true` are no-op (per Claude Code's contract -- they have no effect without async-rewake). Plugin declaring them in isolation does NOT trigger (i); only `asyncRewake: true` does. The other two are warned-about-only.

### Unknown future fields

**Verdict:** TOLERATE (preserve via `additionalProperties: true` round-trip; debug-log unknown field names).

**Rationale:** Forward-compat with Claude Code's tolerant parsing (research § "Bridge implications" point 4). HOOK-03 already covers this.

## 8. Revised marketplace coverage after applying per-field decisions

The pre-strict audit (`docs/research/claude-hooks-vs-pi-events.md` § "Aggregated coverage table") concluded **5/5 first-party hook-using plugins supportable**. REQUIREMENTS.md's strict-policy section already flagged a regression to **4/5 or 3/5** pending this audit.

Final v1.13 coverage:

| Plugin                     | Status      | TOOL-02 condition(s) triggered                                                                                                |
| -------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `explanatory-output-style` | SUPPORTED   | none                                                                                                                          |
| `learning-output-style`    | SUPPORTED   | none                                                                                                                          |
| `ralph-wiggum`             | SUPPORTED   | none (bucket-D Stop synthesis required)                                                                                       |
| `hookify`                  | SUPPORTED   | none                                                                                                                          |
| `security-guidance`        | UNAVAILABLE | (b) `MultiEdit` / `NotebookEdit` in matcher; (h) `if` field; (i) `asyncRewake: true` family -- any one of three is sufficient |

**Net result: 4/5 first-party hook-using plugins supported (80%); 1/5 unavailable.**

Of 13 total first-party plugins, 8 ship no hooks (`agent-sdk-dev`, `claude-opus-4-5-migration`, `code-review`, `commit-commands`, `feature-dev`, `frontend-design`, `plugin-dev`, `pr-review-toolkit`). Those all install unaffected by v1.13.

**Full marketplace catalog under v1.13:**

- Hook-using plugins supported: 4/5 (80%)
- Hook-using plugins unavailable: 1/5 (20%)
- No-hook plugins (install unchanged): 8/8 (100%)
- **Total catalog coverage: 12/13 (92.3%)**

The single regression -- `security-guidance` -- is justified by the strict-supportability stance. Each of the three trigger conditions (`MultiEdit` / `NotebookEdit` tool-map gap; `if` field; `asyncRewake` family) is independently a blocker. Even if PROM-01 lands `MultiEdit` / `NotebookEdit` analogs in v1.14+, the plugin remains blocked by `if` and `asyncRewake` until those are also implemented (PROM-V2-01 and EXTH-V2-01 respectively).

## 9. Proposed REQ amendments for REQUIREMENTS.md

Paste-ready REQ language. The four new conditions extend TOOL-02 to (a)..(i); HOOK-03 narrows to known additive-only extensions only; one new EXEC REQ and one optional new HOOK REQ surface implementation specifics.

### Amend TOOL-02 -- extend the `(unavailable) {unsupported hooks}` triggers

Replace TOOL-02's current condition list with the following (additions in bold):

> A plugin is marked `(unavailable) {unsupported hooks}` at resolve time -- non-installable, no per-entry soft-degrade -- if its `hooks.json` declares ANY entry meeting any of these conditions:
>
> (a) matcher is a regex pattern per MATCH-02; (b) matcher contains any token (after pipe-OR split and MCP pass-through) without a TOOL-01 mapping entry -- meaning the plugin declares a hook matching a Claude tool with no Pi analog (e.g. `MultiEdit`, `NotebookEdit`, `WebFetch`, `Task`); (c) event is in bucket E (Notification, PermissionRequest, PermissionDenied, MessageDisplay); (d) event is in bucket F (TeammateIdle); (e) event is in bucket G (Elicitation, ElicitationResult, WorktreeCreate, WorktreeRemove); (f) event is in bucket H (ConfigChange, Setup, InstructionsLoaded, TaskCreated, TaskCompleted); (g) event is SubagentStart or SubagentStop AND `softDepStatus(pi).agents.present === false` at probe time; **(h) entry contains an `if` field -- the field requires permission-rule-syntax glob matching, per-tool argument-extraction adapters, and Bash subcommand parsing, none of which fit v1.13's matcher-engine policy. Silent degrade is not safe (would over-fire by ignoring the filter);** **(i) entry contains `asyncRewake: true` -- the field's out-of-band rewake-on-exit-2 semantic cannot be honored by Pi's in-stream `sendUserMessage` primitive without semantic loss (foreground synchronous fallback would block every triggering turn, e.g. every `git push`, for the hook's full duration). The companion `rewakeMessage` / `rewakeSummary` fields without `asyncRewake: true` are no-op and do NOT trigger this condition (HOOK-03 still warns at install);** **(j) handler `type` is anything other than `"command"` -- `http` / `mcp_tool` / `prompt` / `agent` types require runtime infrastructure (HTTP client, MCP server-tool dispatch, LLM evaluation) not in v1.13's scope and not exercised by any first-party plugin.**
>
> The resolver's `installable: true | false` discriminator flips on these conditions; reconcile honors the flip across `/reload` cycles. All conditions render the same `{unsupported hooks}` reason; the distinguishing detail belongs in debug-log only.

### Amend HOOK-03 -- narrow extension tolerance to additive-only fields

Replace HOOK-03 with:

> Hook-config TypeBox schema uses `additionalProperties: true` at every nesting level; unknown payload fields preserved through state round-trip. The known additive-only extension set is `{ statusMessage, once, async (without asyncRewake), shell, args }` -- each is silently honored or silently dropped per § "Per-field implementability decisions" without affecting plugin installability. The `asyncRewake` / `rewakeMessage` / `rewakeSummary` family triggers TOOL-02(i) plugin-unavailability; the `if` field triggers TOOL-02(h); non-`command` handler types trigger TOOL-02(j). Unknown extension field names surface debug-log only and do NOT trigger unavailability (forward-compat with Claude Code's tolerant parsing).

### Add HOOK-05 -- `CLAUDE_*` env var setup completeness

> The bridge sets the following environment variables on every hook child process at dispatch time (additive to EXEC-01's existing `CLAUDE_*` / `PI_*` merge):
>
> - `CLAUDE_PROJECT_DIR` = `ctx.cwd` snapshot;
> - `CLAUDE_PLUGIN_ROOT` = absolute path to `<scopeRoot>/pi-claude-marketplace/plugins/<plugin-id>/`;
> - `CLAUDE_PLUGIN_DATA` = absolute path to `<scopeRoot>/pi-claude-marketplace/data/<plugin-id>/`, created if absent (mkdir-p inside the per-plugin lock);
> - `CLAUDE_ENV_FILE` = absolute path to a per-hook scratch file under the plugin's data dir, present only for the four events that use it upstream (`SessionStart`, `Setup` [bucket H -- never fires], `CwdChanged`, `FileChanged`). The bridge does NOT read or re-export the file's contents; consumers (e.g. `direnv` patterns) own their own shell-preamble integration through Pi's bash tool;
> - `CLAUDE_CODE_REMOTE` is intentionally unset (Pi runs locally).

### Add EXEC-04 -- `args` exec-form support

> When a hook handler declares `args: [string, ...]`, the bridge invokes `node:child_process.spawn(command, args, options)` (exec form) instead of `spawn(command, [], { shell: true })` (shell form). The default (no `args` field) remains shell form. The `shell` field selects the shell binary for shell form only; ignored under exec form.

### Amend EXEC-02 -- clarify timeout default

> The bridge default timeout is **600s** (matching Claude Code's `command` handler default), overridden per-hook by an explicit `timeout` field; on timeout: SIGTERM → 5s grace → SIGKILL; `maxBuffer: 1MB` on stdout; stdin payload truncated at 256KB with `_truncated: true` marker.

(Current EXEC-02 says 60s. The 600s upstream default is more permissive; nothing changes operationally for hooks that explicitly set their own timeout. Decision to defer the change is acceptable if the roadmapper prefers the original 60s under a "more conservative than upstream is OK" policy. Flag for resolution.)

### Amend SURF-05 -- narrow extension-warning surface

Current SURF-05 emits an install-time warning per plugin per known payload-extension field present (`asyncRewake` / `rewakeMessage` / `rewakeSummary`). Under the strict policy, plugins declaring `asyncRewake: true` are UNAVAILABLE (TOOL-02(i)) and never reach the install-success surface that SURF-05 warns from. The two subordinate fields without `asyncRewake: true` are no-op upstream and warning would be noise.

Replace SURF-05 with:

> Install-time warning emits once per plugin when `rewakeMessage` or `rewakeSummary` are declared without `asyncRewake: true` (no-op upstream; warn so the plugin author can spot a config bug). Unknown extension field names surface only in debug-log. The `asyncRewake: true` case does NOT reach this surface -- those plugins are unavailable per TOOL-02(i) and never install.

### Out-of-Scope additions

Add to PROJECT.md `### Out of Scope` and REQUIREMENTS.md `### v1.14+ Requirements`:

- **`if`-field implementation** (`MATCH-V2-02`): Permission-rule-syntax glob matching with per-tool argument-extraction adapters and Bash subcommand parsing. Unblocks no first-party plugin in v1.13 (`security-guidance` is also blocked by `MultiEdit`/`NotebookEdit` and `asyncRewake`); revisit when third-party-plugin demand materializes.
- **`asyncRewake` family implementation** (`EXTH-V2-01`): Requires a Pi runtime primitive for "inject system-reminder into next turn, even when agent is idle." Open upstream feature ask to `@earendil-works/pi-coding-agent`; no PR commitment from v1.13.
- **Non-`command` handler types** (`TYPES-V2-01`): `http` / `mcp_tool` / `prompt` / `agent` handler types. None used by first-party plugins today; revisit when ecosystem demand materializes.

## 10. Revised marketplace coverage table (supersedes REQUIREMENTS.md § "Known marketplace-audit regression from TOOL-02")

| Plugin                      | Hooks? | v1.13 result                                                      | Block reason(s)                                                                                        |
| --------------------------- | ------ | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `agent-sdk-dev`             | no     | INSTALLS                                                          | n/a                                                                                                    |
| `claude-opus-4-5-migration` | no     | INSTALLS                                                          | n/a                                                                                                    |
| `code-review`               | no     | INSTALLS                                                          | n/a                                                                                                    |
| `commit-commands`           | no     | INSTALLS                                                          | n/a                                                                                                    |
| `feature-dev`               | no     | INSTALLS                                                          | n/a                                                                                                    |
| `frontend-design`           | no     | INSTALLS                                                          | n/a                                                                                                    |
| `plugin-dev`                | no     | INSTALLS                                                          | n/a                                                                                                    |
| `pr-review-toolkit`         | no     | INSTALLS                                                          | n/a                                                                                                    |
| `explanatory-output-style`  | yes    | INSTALLS -- hooks dispatchable                                    | n/a                                                                                                    |
| `learning-output-style`     | yes    | INSTALLS -- hooks dispatchable                                    | n/a                                                                                                    |
| `ralph-wiggum`              | yes    | INSTALLS -- hooks dispatchable (bucket-D Stop synthesis required) | n/a                                                                                                    |
| `hookify`                   | yes    | INSTALLS -- hooks dispatchable                                    | n/a                                                                                                    |
| `security-guidance`         | yes    | **UNAVAILABLE `{unsupported hooks}`**                             | TOOL-02(b) `MultiEdit`/`NotebookEdit`; TOOL-02(h) `if`; TOOL-02(i) `asyncRewake` -- any one sufficient |

**Coverage:** 12/13 first-party plugins install under v1.13 (92.3%). Of the 5 hook-using plugins, 4/5 (80%) are fully supported; the remaining 1 is unavailable for three independent reasons, any of which alone would block it. Confirms the strict-supportability stance reduces coverage by exactly one plugin in the official catalog.

## 11. Sources

### Primary HIGH-confidence

- [Claude Code Hooks reference (`code.claude.com/docs/en/hooks`)](https://code.claude.com/docs/en/hooks) -- authoritative for file location, top-level JSON shape, standard fields, per-event stdin/stdout contracts, env vars, exit codes. Fetched 2026-06-13.
- [Claude Code Hooks guide (`code.claude.com/docs/en/hooks-guide`)](https://code.claude.com/docs/en/hooks-guide) -- authoritative for `if` field semantics (§ "Filter by tool name and arguments with the `if` field"), matcher patterns, lifecycle table, configure-hook-location table. Fetched 2026-06-13.
- [`anthropics/claude-code` plugins audit at commit `ca9f6045fc90c8244f9e787fb57d54b380f9a27c`](https://github.com/anthropics/claude-code/tree/ca9f6045fc90c8244f9e787fb57d54b380f9a27c/plugins) -- primary source for all five plugin `hooks.json` files in § 6. Each file fetched verbatim via `raw.githubusercontent.com`.
- \[`@earendil-works/pi-coding-agent` `types.d.ts`\](file:///home/acolomba/pi-claude-marketplace/node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts) at the peer-dep version this project targets -- primary source for Pi event payload shapes (`ToolCallEvent`, `ToolResultEvent`, `InputEvent`, etc.). Local file.
- \[`docs/research/claude-hooks-vs-pi-events.md`\](file:///home/acolomba/pi-claude-marketplace/docs/research/claude-hooks-vs-pi-events.md) -- authority source for upstream event bucket classifications, soft-dep audit, and per-event Pi synthesis approaches. Internal.
- \[`.planning/REQUIREMENTS.md`\](file:///home/acolomba/pi-claude-marketplace/.planning/REQUIREMENTS.md) -- current v1.13 REQ set; basis for amendment proposals. Internal.

### Secondary MEDIUM-confidence

- [Anthropic GitHub Issue #44881 -- "asyncRewake hook output renders as visible `<system-reminder>` in terminal"](https://github.com/anthropics/claude-code/issues/44881) -- confirms `asyncRewake` is a production Claude Code feature (Anthropic-acknowledged as a real path with a UI bug), used to corroborate semantic details. Fetched 2026-06-13.
- [claude-intercom -- `sanztheo/claude-intercom`](https://github.com/sanztheo/claude-intercom) -- third-party use of `asyncRewake` with explicit exit-2-triggers-rewake contract. Used to cross-confirm exit-code semantic.
- ["I Read the Claude Code Source Code" -- buildingbetter.tech](https://buildingbetter.tech/p/i-read-the-claude-code-source-code) -- independent deep-dive describing undocumented `asyncRewake`, `async`, `once`, `if` field semantics. Used as cross-reference for undocumented-but-real fields.
- ["Claude Code settings.json Hooks" -- Vincent Qiao](https://blog.vincentqiao.com/en/posts/claude-code-settings-hooks/) -- third-party hook reference, cross-checked against primary docs.
- ["Claude Code Hooks: From Linting to Hardened AI Workflows" -- Thomas Wiegold](https://thomas-wiegold.com/blog/claude-code-hooks/) -- third-party reference for `if`-field examples.

### Contradictions and resolutions

- **`timeout` default** -- Primary docs say `command`-type default is 600s; REQ EXEC-02 currently specifies 60s for the bridge. NOT a primary-source contradiction; REQ EXEC-02 was authored before this audit. Resolution: § 9 proposes amending EXEC-02 to 600s for upstream parity; flag for roadmapper resolution if the conservative 60s is preferred.
- **`asyncRewake` documentation status** -- Public Hooks reference does not list it; security-guidance source uses it; Anthropic Issue #44881 acknowledges it; third-party plugins use it. Resolution: treat as real-but-undocumented stable extension. Bridge ESCALATES regardless.
- **`if` field exact glob grammar** -- `Bash(git *)` (space-prefix subcommand) is the documented form in the hooks guide; `Bash(git commit:*)` (colon-prefix subcommand argument list) appears in security-guidance source and matches Claude Code's broader permission-rule grammar. Both are valid permission-rule patterns; the colon form is more restrictive (matches `git commit ...` argument list explicitly). Resolution: not a contradiction -- both are standard glob forms; bridge ESCALATES regardless of which form is used.
- **`Edit` matcher target token capitalization** -- Claude Code uses `Edit`; Pi uses lowercase `edit`. Resolution: documented in TOOL-01 via the bidirectional mapping table. Not a contradiction, just a translation.

## 12. Open questions and verification gaps

1. **`CLAUDE_PLUGIN_DATA` semantics** -- The public docs list `CLAUDE_PLUGIN_DATA` as a per-plugin persistent dir but do not specify lifecycle (per-install? per-session? operator-cleanable?). v1.13 implementation can pick a per-install lifecycle (created on plugin install; removed on uninstall) and document the choice. LOW risk -- no first-party plugin uses it today.

2. **`CLAUDE_ENV_FILE` cross-platform parsing** -- The hooks guide example pipes `direnv export bash > "$CLAUDE_ENV_FILE"`. The file then needs to be sourced by subsequent Bash tool invocations. Pi's bash tool integration (`@earendil-works/pi-coding-agent`) may or may not consume `CLAUDE_ENV_FILE`-style preamble files. Probe at implementation time; document the divergence if absent.

3. **`PostToolUse.tool_response` shape vs Pi `tool_result.content`** -- Need a concrete fixture comparison at implementation time. Pi's `content: (TextContent | ImageContent)[]` vs Claude's tool-result string shape may need flattening.

4. **Bash subcommand parsing for `if`** -- Even if v1.13 ESCALATES on `if`, a future v1.14+ implementation needs to settle on a Bash-parsing library (or write one). The hooks guide explicitly mentions parsing `$()`, backticks, and `&&` boundaries. Out of scope here.

5. **Cross-plugin handler ordering** -- Research § "Cross-plugin ordering and aggregation" specifies declaration order. v1.13 DISP-04 specifies project-first alphabetical at the plugin level and declaration order within. Pre-empt: validate against a multi-plugin fixture before claiming ordering compliance with Claude Code.

6. **`hookEventName` echo in `hookSpecificOutput`** -- Every `hookSpecificOutput` shape includes `hookEventName: "..."`. The bridge must validate this matches the firing event and either accept or warn on mismatch. LOW risk -- bridge can ignore the field (use the event from dispatch context instead) since the field's purpose upstream is mainly to discriminate when one hook serves multiple events.

7. **`reloadSkills` on `SessionStart` return** -- Per § 4, `SessionStart.hookSpecificOutput.reloadSkills: true` triggers a skills reload upstream. Pi has a `resources_discover` mechanism but the bridge doesn't currently re-emit it from `session_start`. Document as v1.13 limitation; if a plugin returns `reloadSkills: true`, the bridge can no-op + debug-log.

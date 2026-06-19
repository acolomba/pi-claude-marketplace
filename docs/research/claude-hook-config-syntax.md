# Claude Code hook config syntax -- bridge reference

**Audited:** 2026-06-13 **Confidence:** HIGH on standard fields and per-event contracts (primary source is the live Claude Code Hooks reference at `code.claude.com/docs/en/hooks` plus the hooks guide); HIGH on the `if` field's standard-vs-extension status and per-event applicability (Anthropic-documented since Claude Code v2.1.85); HIGH on `asyncRewake` / `rewakeMessage` / `rewakeSummary` semantics post-2026-06-13 deep-dive (documented in the Claude Code Hooks reference Command-hook-fields table since v2.1.72; cross-verified against the live `security-guidance` handler source, Anthropic-published Issue #44881, third-party reproductions, and the buildingbetter.tech source-code deep-dive); HIGH on per-plugin audit (verified by fetching each `hooks.json` from `anthropics/claude-code` at the audit commit).

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

| Field           | JSON shape               | Required | Default             | Notes                                                                                                                                                                                                                                                  | v1.13 implementability                                                                                                                                                                                                                                                                                                                                                                |
| --------------- | ------------------------ | -------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `command`       | string                   | required | --                  | Shell command string (when no `args`) or executable path (when `args` is set). Supports `${CLAUDE_PROJECT_DIR}` / `${CLAUDE_PLUGIN_ROOT}` / `${CLAUDE_PLUGIN_DATA}` env-var expansion inline.                                                          | **IMPLEMENT** -- covered by EXEC-01 / LIFE-03.                                                                                                                                                                                                                                                                                                                                        |
| `args`          | array of strings         | optional | absent = shell-form | When present, `command` is spawned directly (exec form, no shell).                                                                                                                                                                                     | **IMPLEMENT** -- additive to EXEC-01. When `args` is present, switch from shell to exec form.                                                                                                                                                                                                                                                                                         |
| `async`         | boolean                  | optional | `false`             | Runs in background without blocking the agent. Fire-and-forget. No re-injection.                                                                                                                                                                       | **TOLERATE** for v1.13 -- the bridge can run it foreground without semantic loss for **observation-only** hooks. The hook's exit code / stdout is discarded under `async: true` upstream (no return value reaches the agent), so synchronous execution is strictly stronger than async. Debug-log when encountered. (Distinct from `asyncRewake`, which DOES carry return semantics.) |
| `asyncRewake`   | boolean                  | optional | `false`             | Implies `async`. Runs in background; on exit code 2, wakes the model and injects stderr (or stdout if stderr empty) as a system reminder for the next turn. **Documented in the Claude Code Hooks reference Command-hook-fields table since v2.1.72.** | **IMPLEMENT** (HOOK-06 / EXEC-05). See § 13 deep-dive; bridge spawns detached, watches exit code, injects via Pi's \`pi.sendMessage({...}, { deliverAs: "followUp"                                                                                                                                                                                                                    |
| `rewakeMessage` | string                   | optional | --                  | Companion to `asyncRewake`. Template prefixed to the re-injected system-reminder content on rewake.                                                                                                                                                    | **ESCALATE** (subordinate to `asyncRewake`). Has no meaning without `asyncRewake: true`.                                                                                                                                                                                                                                                                                              |
| `rewakeSummary` | string                   | optional | --                  | Companion to `asyncRewake`. Short status-message string for the UI surface that indicates a background rewake fired.                                                                                                                                   | **ESCALATE** (subordinate to `asyncRewake`).                                                                                                                                                                                                                                                                                                                                          |
| `shell`         | `"bash" \| "powershell"` | optional | `"bash"` on Unix    | Shell selector. Ignored when `args` is set.                                                                                                                                                                                                            | **TOLERATE** -- Unix shell selector; Windows out of scope for v1.13. Debug-log if non-`bash`.                                                                                                                                                                                                                                                                                         |

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

**Implementability:** UNAVAILABLE under v1.13 -- one remaining TOOL-02 trigger:

- TOOL-02(b): matcher `Edit|Write|MultiEdit|NotebookEdit` contains `MultiEdit` and `NotebookEdit`, neither of which has a Pi mapping under TOOL-01.

The two other fields previously cited as blockers are NO LONGER blockers:

- `if` field: IMPLEMENTED in v1.13 per MATCH-03.
- `asyncRewake` family: IMPLEMENTED in v1.13 per HOOK-06 / EXEC-05 (see § 13 deep-dive).

Once PROM-01 (or a `MultiEdit` / `NotebookEdit` Pi-tool addition) lands in v1.14+, the plugin flips to installable -- no `if` or `asyncRewake` block remains.

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

**Verdict:** IMPLEMENT.

**Update -- this section was ESCALATE prior to the 2026-06-13 deep-dive in § 13.** Re-reading the security-guidance handler source end-to-end, fetching the documented (since v2.1.72) field definition from Claude Code's hooks reference, and pulling the precise `_pendingNextTurnMessages` plumbing out of `@earendil-works/pi-coding-agent`'s `agent-session.js` shows the bridge can deliver matching semantics using primitives that already exist in the peer dep. The full evidence and pseudocode live in § 13; this section just records the verdict and the propagated REQ implications.

**Standard-vs-extension status:** STANDARD (documented). The Claude Code hooks reference at `code.claude.com/docs/en/hooks` documents `asyncRewake` in the Command hook fields table verbatim: `"asyncRewake | no | If true, runs in the background and wakes Claude on exit code 2. Implies async. The hook's stderr, or stdout if stderr is empty, is shown to Claude as a system reminder so it can react to a long-running background failure"` (fetched 2026-06-13). Field has been in the settings schema since Claude Code v2.1.72.

**Actual semantics (cross-referenced from the Hooks reference, Issue #44881 transcript, security-guidance handler source, and a buildingbetter.tech source-code deep-dive):**

- `asyncRewake: true` implies `async: true` -- hook runs detached in the background, not blocking the triggering tool call.
- The background process runs to completion subject to the handler's own `timeout`.
- Exit code 2 from the background process causes Claude Code to inject the process's stderr (or stdout if stderr is empty) into the agent's conversation context wrapped in a `<system-reminder>` block. Non-2 exit codes -- including 0 -- complete silently.
- `rewakeMessage` is an OPTIONAL string template; the security-guidance plugin uses it as the conversational "header" prefixed to the body of the rewake content (e.g. `"Background security review of commit -- address or acknowledge the findings below, then continue with the user's original request or continue waiting for their reply:"`). The plugin embeds its OWN per-handler banner via its `PROVENANCE_BANNER` / `CONTINUATION_SUFFIX` constants in stderr; the field is layered atop. Empirically the field appears to be passed through to Claude Code's runtime which prefixes it (the handler script does not read it back).
- `rewakeSummary` is a short UI-only one-line status string used by Claude Code's TUI to render the spinner-replacement notice when a background rewake fires (e.g. `"Commit security review found issues"`). The model does not see it directly.
- The handler script does NOT branch on async vs sync mode. The same `sys.exit(2)` + stderr-write path is used for both. Claude Code's runtime alone interprets `asyncRewake: true` and decides to background-spawn + wrap stderr as `<system-reminder>` instead of blocking inline.
- The VSCode extension does NOT honor `asyncRewake: true` per the buildingbetter writeup; it falls back to inline synchronous foreground -- treating the rewake as a regular blocking exit-2 in the current tool turn. This means *Anthropic's own non-CLI host already degrades the field*, which is precedent for the bridge to do the same in degraded contexts.

**Why the prior ESCALATE was wrong -- corrected concerns:**

1. **"Out-of-band turn semantics"** -- Pi's peer dep exposes `pi.sendMessage(message, { deliverAs: "nextTurn" })` in `agent-session.js` at the `sendCustomMessage` method. The implementation pushes the message onto a `_pendingNextTurnMessages` queue that is drained on the NEXT user prompt boundary (line 790-794 of the compiled JS: `"Inject any pending 'nextTurn' messages as context alongside the user message"`). When combined with the IDLE-vs-STREAMING branch at line 988 (which uses `agent.followUp()` for in-stream injection during an active loop), Pi covers BOTH delivery modes asyncRewake needs.

2. **"System-reminder vs user-message rendering"** -- Pi's `sendMessage` API takes a `CustomMessage<T>` (`role: "custom"`, `customType: string`, `content: string | TextContent[]`, `display: boolean`). With `display: false` the message is invisible to the user UI but `convertToLlm()` in `messages.ts` still emits it as model context. The `customType` discriminator lets the bridge tag the message (e.g. `"claude-hook-rewake"`) so it's identifiable in the transcript. This delivers the privileged-side-channel semantic asyncRewake needs without forcing the user-message role.

3. **"Synchronous fallback is semantically destructive"** -- No fallback needed; the async path is implementable. (Even if it weren't, the security-guidance handler's `CONTINUATION_SUFFIX` -- `"\n\nAfter addressing or acknowledging this finding, continue with the user's original request or continue waiting for their reply -- this review is supplementary feedback, not a replacement for your previous response."` -- is specifically designed to remain coherent even when the rewake fires in an unexpected turn boundary. The handler is robust to delivery-mode variation.)

4. **"Subordinate fields hard-fail"** -- Resolved: all three fields are implemented together as a coordinated triple. `rewakeMessage` is prepended to the stderr payload (or empty-string default); `rewakeSummary` is surfaced via `ctx.ui.notify(summary, "info")` at the moment the bridge enqueues the next-turn message.

**Decision.** IMPLEMENT. Plugins declaring `asyncRewake: true` install cleanly. The bridge owns a per-plugin async-rewake registry that spawns the hook detached, watches its exit code, and on exit 2 routes the (rewakeMessage + stderr) into Pi's next-turn / followUp delivery path. See § 13.6 for the implementation sketch (~250-300 LoC, one new bridge module + small additions to the existing hook dispatcher).

**TOOL-02 condition (h) -- REMOVE** the `asyncRewake: true` trigger; `asyncRewake` no longer marks a plugin unavailable. (No renumbering required: under the current REQUIREMENTS.md (post-`if`-flip) (h) is the asyncRewake condition; the remaining condition (i) -- non-`command` `type` -- shifts up to (h).)

**Implementation note for parser:** `rewakeMessage` and `rewakeSummary` without `asyncRewake: true` remain no-op upstream (per Claude Code's documented contract -- they only have effect inside an `asyncRewake` block). SURF-05's existing warning for the standalone-subordinate-fields case is preserved unchanged.

### Unknown future fields

**Verdict:** TOLERATE (preserve via `additionalProperties: true` round-trip; debug-log unknown field names).

**Rationale:** Forward-compat with Claude Code's tolerant parsing (research § "Bridge implications" point 4). HOOK-03 already covers this.

## 8. Revised marketplace coverage after applying per-field decisions

The pre-strict audit (`docs/research/claude-hooks-vs-pi-events.md` § "Aggregated coverage table") concluded **5/5 first-party hook-using plugins supportable**. REQUIREMENTS.md's strict-policy section already flagged a regression to **4/5 or 3/5** pending this audit.

Final v1.13 coverage:

| Plugin                     | Status      | TOOL-02 condition(s) triggered                                                                                        |
| -------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------- |
| `explanatory-output-style` | SUPPORTED   | none                                                                                                                  |
| `learning-output-style`    | SUPPORTED   | none                                                                                                                  |
| `ralph-wiggum`             | SUPPORTED   | none (bucket-D Stop synthesis required)                                                                               |
| `hookify`                  | SUPPORTED   | none                                                                                                                  |
| `security-guidance`        | UNAVAILABLE | (b) `MultiEdit` / `NotebookEdit` in matcher -- the only remaining blocker; `if` and `asyncRewake` are now implemented |

**Net result: 4/5 first-party hook-using plugins supported (80%); 1/5 unavailable.**

Of 13 total first-party plugins, 8 ship no hooks (`agent-sdk-dev`, `claude-opus-4-5-migration`, `code-review`, `commit-commands`, `feature-dev`, `frontend-design`, `plugin-dev`, `pr-review-toolkit`). Those all install unaffected by v1.13.

**Full marketplace catalog under v1.13:**

- Hook-using plugins supported: 4/5 (80%)
- Hook-using plugins unavailable: 1/5 (20%)
- No-hook plugins (install unchanged): 8/8 (100%)
- **Total catalog coverage: 12/13 (92.3%)**

The single regression -- `security-guidance` -- is justified by the strict-supportability stance and now has a single concrete unblocker. With `if` implemented (MATCH-03) and `asyncRewake` implemented (HOOK-06 / EXEC-05), the only remaining v1.13 blocker is the `MultiEdit` / `NotebookEdit` tool-map gap. PROM-01 alone is enough to flip the plugin to installable in v1.14+ -- no other downstream dependency remains.

## 9. Proposed REQ amendments for REQUIREMENTS.md

Paste-ready REQ language. The asyncRewake flip (research § 13) drops what was condition (h) in REQUIREMENTS.md's prior wording; the remaining `type !== "command"` clause shifts up. HOOK-03, SURF-05, and the v1.14+ EXTH-V2-01 row each get a matching amendment. New REQ HOOK-06 / EXEC-05 specify the bridge's asyncRewake implementation contract.

### Amend TOOL-02 -- extend the `(unavailable) {unsupported hooks}` triggers

Replace TOOL-02's current condition list with the following (additions in bold):

**Drop condition (h) -- `asyncRewake: true` no longer triggers unavailability.** Renumber the trailing `type !== "command"` clause from (i) to (h). The final TOOL-02 condition list reads:

> A plugin is marked `(unavailable) {unsupported hooks}` at resolve time -- non-installable, no per-entry soft-degrade -- if its `hooks.json` declares ANY entry meeting any of these conditions:
>
> (a) matcher is a regex pattern per MATCH-02; (b) matcher contains any token (after pipe-OR split and MCP pass-through) without a TOOL-01 mapping entry -- meaning the plugin declares a hook matching a Claude tool with no Pi analog (e.g. `MultiEdit`, `NotebookEdit`, `WebFetch`, `Task`); (c) event is in bucket E (Notification, PermissionRequest, PermissionDenied, MessageDisplay); (d) event is in bucket F (TeammateIdle); (e) event is in bucket G (Elicitation, ElicitationResult, WorktreeCreate, WorktreeRemove); (f) event is in bucket H (ConfigChange, Setup, InstructionsLoaded, TaskCreated, TaskCompleted); (g) event is SubagentStart or SubagentStop AND `softDepStatus(pi).agents.present === false` at probe time; **(h) handler `type` is anything other than `"command"` -- `http` / `mcp_tool` / `prompt` / `agent` types require runtime infrastructure (HTTP client, MCP server-tool dispatch, LLM evaluation) not in v1.13's scope and not exercised by any first-party plugin.**
>
> The resolver's `installable: true | false` discriminator flips on these conditions; reconcile honors the flip across `/reload` cycles. All conditions render the same `{unsupported hooks}` reason; the distinguishing detail belongs in debug-log only. The `if` field is implemented per MATCH-03 (not escalated); `asyncRewake: true` is implemented per HOOK-06 / EXEC-05 (not escalated).

### Amend HOOK-03 -- narrow extension tolerance to additive-only fields

Replace HOOK-03 with:

> Hook-config TypeBox schema uses `additionalProperties: true` at every nesting level; unknown payload fields preserved through state round-trip. The known additive-only extension set is `{ statusMessage, once, async (without asyncRewake), shell, args }` -- each is silently honored or silently dropped per § "Per-field implementability decisions" without affecting plugin installability. The `asyncRewake` / `rewakeMessage` / `rewakeSummary` family is IMPLEMENTED per HOOK-06 / EXEC-05 (background spawn + `_pendingNextTurnMessages` injection on exit 2); the `if` field is IMPLEMENTED per MATCH-03; non-`command` handler types trigger TOOL-02(h). Unknown extension field names surface debug-log only and do NOT trigger unavailability (forward-compat with Claude Code's tolerant parsing).

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

SURF-05's purpose narrows to catching plugin-author config bugs (orphan `rewakeMessage` / `rewakeSummary`). Plugins declaring `asyncRewake: true` now install normally (HOOK-06 / EXEC-05) so the field no longer surfaces a warning. The two subordinate fields without `asyncRewake: true` remain no-op upstream and are surfaced as a one-line warning so the plugin author can spot the missing parent.

Replace SURF-05 with:

> Install-time warning emits once per plugin when `rewakeMessage` or `rewakeSummary` are declared without `asyncRewake: true` (no-op upstream; warn so the plugin author can spot a config bug). Unknown extension field names surface only in debug-log. Plugins declaring `asyncRewake: true` install normally per HOOK-06 / EXEC-05; the field does NOT surface a warning.

### Add HOOK-06 -- `asyncRewake` registry contract

> The bridge maintains an in-process async-rewake registry keyed by `(plugin-id, hookHandlerIndex, dispatchId)`. On dispatch of any hook handler with `asyncRewake: true`, the bridge spawns the child via `node:child_process.spawn(...)` with `detached: false` and `stdio: ["pipe", "pipe", "pipe"]`, returns from the dispatcher IMMEDIATELY (the triggering tool call is not blocked), and records the registry entry. The bridge attaches `child.on("exit", code => ...)` and `child.on("error", err => ...)` watchers BEFORE returning. On exit code 2: the bridge reads collected stderr (or stdout if stderr is empty), prefixes the `rewakeMessage` field value if present, and calls Pi's `pi.sendMessage({ customType: "claude-hook-rewake", content: <text>, display: false, details: { pluginId, hookHandlerIndex } }, { deliverAs: <chosen> })` where the delivery mode is selected at injection time: `"followUp"` if `ctx.isIdle() === false` at exit time, `"nextTurn"` otherwise. If `rewakeSummary` is set, the bridge ALSO calls `ctx.ui.notify(rewakeSummary, "info")` at the same moment (the model never sees `rewakeSummary` -- it is a UI-only signal). Non-2 / non-0 exit codes complete silently with a debug-log entry; exit code 0 completes silently. The registry's per-entry lifetime ends at exit-handler return, normal `timeout` SIGTERM, or `/reload`. On `/reload`, the bridge SIGKILLs every entry still alive (parent process retains kill rights because `detached: false`). On parent process exit, the OS reaps. Test gate: a fixture plugin that exits 2 after a 200ms sleep must (a) NOT block the triggering tool call (the bridge returns within ≤50ms) and (b) inject content visible to the model on the next assistant turn (verifiable via `agent_end` transcript inspection).

### Add EXEC-05 -- `asyncRewake` background-spawn pattern

> When dispatching a hook handler with `asyncRewake: true`:
>
> - `spawn(command, args, { shell: shellForm, env: enrichedEnv, cwd: ctx.cwd, detached: false, stdio: ["pipe", "pipe", "pipe"] })`. The `detached: false` setting is deliberate -- it keeps the child in the bridge's process group so SIGKILL on `/reload` reaps it. (Upstream Claude Code uses `detached: true` in CLI mode but the bridge runs inside a long-lived Pi extension process, so the lifecycle is different.)
> - Stdin payload write is identical to EXEC-01 (event JSON, capped at 256KB).
> - The bridge collects stderr into an in-memory buffer capped at 64KB; on overflow, the suffix is truncated with a `…[truncated]` marker (model-visible context cap matches upstream's `additionalContext` 10KB-but-with-headroom convention).
> - Hook handler's own `timeout` is enforced via `setTimeout(() => kill(child, "SIGTERM"), timeoutMs)` and a 5s grace before SIGKILL. Default for `asyncRewake: true` hooks remains the EXEC-02 default (600s).
> - Multi-hook fan-in: when N independent handlers all have `asyncRewake: true` and ALL fire on the same triggering tool call, each runs in its own registry entry independently. If multiple exit 2 within a tight window, the bridge injects N separate messages with distinct `details.dispatchId` -- Pi's `_pendingNextTurnMessages` queue is a list, not a single slot, so they accumulate naturally and are all delivered on the next user prompt boundary.

### Out-of-Scope additions

Add to PROJECT.md `### Out of Scope` and REQUIREMENTS.md `### v1.14+ Requirements`:

- **`if`-field implementation**: NOW IMPLEMENTED in v1.13 per MATCH-03; MATCH-V2-02 is dropped from v1.14+.
- **`asyncRewake` family implementation**: NOW IMPLEMENTED in v1.13 per HOOK-06 / EXEC-05; EXTH-V2-01 is dropped from v1.14+ Requirements.
- **Non-`command` handler types** (`TYPES-V2-01`): `http` / `mcp_tool` / `prompt` / `agent` handler types. None used by first-party plugins today; revisit when ecosystem demand materializes.

## 10. Revised marketplace coverage table (supersedes REQUIREMENTS.md § "Known marketplace-audit regression from TOOL-02")

| Plugin                      | Hooks? | v1.13 result                                                      | Block reason(s)                                                                                             |
| --------------------------- | ------ | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `agent-sdk-dev`             | no     | INSTALLS                                                          | n/a                                                                                                         |
| `claude-opus-4-5-migration` | no     | INSTALLS                                                          | n/a                                                                                                         |
| `code-review`               | no     | INSTALLS                                                          | n/a                                                                                                         |
| `commit-commands`           | no     | INSTALLS                                                          | n/a                                                                                                         |
| `feature-dev`               | no     | INSTALLS                                                          | n/a                                                                                                         |
| `frontend-design`           | no     | INSTALLS                                                          | n/a                                                                                                         |
| `plugin-dev`                | no     | INSTALLS                                                          | n/a                                                                                                         |
| `pr-review-toolkit`         | no     | INSTALLS                                                          | n/a                                                                                                         |
| `explanatory-output-style`  | yes    | INSTALLS -- hooks dispatchable                                    | n/a                                                                                                         |
| `learning-output-style`     | yes    | INSTALLS -- hooks dispatchable                                    | n/a                                                                                                         |
| `ralph-wiggum`              | yes    | INSTALLS -- hooks dispatchable (bucket-D Stop synthesis required) | n/a                                                                                                         |
| `hookify`                   | yes    | INSTALLS -- hooks dispatchable                                    | n/a                                                                                                         |
| `security-guidance`         | yes    | **UNAVAILABLE `{unsupported hooks}`**                             | TOOL-02(b) `MultiEdit`/`NotebookEdit` -- sole remaining blocker; `if` and `asyncRewake` are now implemented |

**Coverage:** 12/13 first-party plugins install under v1.13 (92.3%). Of the 5 hook-using plugins, 4/5 (80%) are fully supported; the remaining 1 (`security-guidance`) is unavailable solely because of the `MultiEdit` / `NotebookEdit` tool-map gap (TOOL-02(b)). PROM-01 in v1.14+ is the single unblocker -- no `if` or `asyncRewake` follow-up required.

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
- **`asyncRewake` documentation status** -- Public Hooks reference DOES document it in the Command-hook-fields table (since v2.1.72; verified 2026-06-13 fetch); security-guidance source uses it; Anthropic Issue #44881 acknowledges it; third-party plugins (claude-intercom) use it. Resolution: treat as documented stable field. Bridge IMPLEMENTS via the `_pendingNextTurnMessages` / `agent.followUp()` path in `@earendil-works/pi-coding-agent`'s `sendCustomMessage`; see § 13 deep-dive.
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

## 13. `asyncRewake` deep-dive (2026-06-13)

This section supersedes the earlier ESCALATE verdict for `asyncRewake` recorded in prior revisions of this document. The shift is grounded in three concrete findings that the prior research had not fully verified: (a) Claude Code's public Hooks reference DOES document `asyncRewake` in its Command-hook-fields table (since v2.1.72); (b) the precise wake-injection primitive needed -- "queue a side-channel context message for delivery at the next turn boundary, with model-visible but user-invisible rendering" -- is already exposed by `@earendil-works/pi-coding-agent` as `pi.sendMessage({...}, { deliverAs: "nextTurn" })` plus `pi.sendMessage({...}, { deliverAs: "followUp" })` for the in-stream case; and (c) the security-guidance handler script itself contains NO branch on async-vs-sync mode -- Claude Code's runtime alone interprets the field, which means the same handler script (already passing through Pi's bash tool unchanged) will produce the same exit-2-on-finding stderr stream regardless of how the bridge dispatches it.

### 13.1 Verified semantics of `asyncRewake`

Cross-source, cross-checked against the Claude Code Hooks reference (`code.claude.com/docs/en/hooks`, Command-hook-fields table), Anthropic Issue [#44881](https://github.com/anthropics/claude-code/issues/44881), the security-guidance handler source at audit commit `ca9f6045`, the [claude-intercom](https://github.com/sanztheo/claude-intercom) third-party plugin, and the [buildingbetter.tech "I Read the Claude Code Source Code"](https://buildingbetter.tech/p/i-read-the-claude-code-source-code) deep-dive:

| Aspect                       | Verified behavior                                                                                                                                                                                                                                                                                                                                                                              | Primary source                                                                                                      |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Run mode**                 | Detached background; non-blocking on the triggering tool call. Foreground for VSCode extension fallback.                                                                                                                                                                                                                                                                                       | Hooks reference + buildingbetter deep-dive                                                                          |
| **Wake trigger**             | Exit code 2 SPECIFICALLY. Non-2 exits (including 0) complete silently.                                                                                                                                                                                                                                                                                                                         | Hooks reference Command-hook-fields table; security-guidance source consistently `sys.exit(2)` on findings          |
| **Wake payload**             | `stderr` if non-empty; else `stdout`. Concatenated as a single text blob.                                                                                                                                                                                                                                                                                                                      | Hooks reference quote: `"the hook's stderr, or stdout if stderr is empty, is shown to Claude as a system reminder"` |
| **Wake rendering**           | Wrapped in `<system-reminder>` markup. (Issue #44881 documents a bug where the wrapping leaks to the user terminal -- proving the wrapping exists in normal runs.)                                                                                                                                                                                                                             | Hooks reference + Issue #44881 reproduction                                                                         |
| **Wake delivery**            | At the next turn boundary. The buildingbetter deep-dive describes "wakes the model back up" -- empirically the security-guidance plugin's `CONTINUATION_SUFFIX` design ("After addressing or acknowledging this finding, continue with the user's original request or continue waiting for their reply") presumes the rewake can land at unexpected boundaries; the handler is robust to this. | buildingbetter + security-guidance handler source                                                                   |
| **Idle-state behavior**      | The Hooks reference does not explicitly say whether the wake happens during idle or only at next user submit. In practice both the security-guidance handler's `CONTINUATION_SUFFIX` wording AND the claude-intercom plugin's "watcher → exit(2) → asyncRewake" architecture imply the wake can interject without a user prompt. CC's runtime can drive an LLM turn purely on the wake signal. | Inference from handler design + claude-intercom architecture                                                        |
| **Multi-hook fan-in**        | Not explicitly documented. By extrapolation from how Claude Code's hook dispatcher treats concurrent handlers (per the hooks reference's general "all hooks run concurrently" model), each `asyncRewake: true` hook produces its own background process whose exit-2 contributes its own stderr to the rewake.                                                                                 | Hooks reference general dispatcher model                                                                            |
| **`rewakeMessage`**          | Optional string prefixed to the rewake payload as a model-visible conversational header. The security-guidance plugin's three handlers use distinct values (commit / push / Stop). Empirically the handler script does not read this field back -- it's interpreted entirely by Claude Code's runtime, which prepends it to stderr.                                                            | security-guidance hooks.json + handler source                                                                       |
| **`rewakeSummary`**          | Optional short string for the TUI's spinner-replacement notice. User-visible, NOT model-visible. The security-guidance plugin's three values are explicitly one-line summaries (e.g. `"Commit security review found issues"`).                                                                                                                                                                 | security-guidance hooks.json + handler emits via SyncHookJSONOutput                                                 |
| **Failure modes**            | Background process timeout: SIGTERM (Claude Code default). Process crash: treated as non-2 exit -- silent. Non-2 / non-0 exit: silent.                                                                                                                                                                                                                                                         | Hooks reference Exit-code-output section + general timeout policy                                                   |
| **Handler script branching** | NO. The same `sys.exit(2)` + stderr-write path is used regardless of async vs sync invocation. Claude Code's runtime alone interprets `asyncRewake: true`.                                                                                                                                                                                                                                     | security-guidance handler source (verified: no env-var checks, no mode flag)                                        |

### 13.2 The matching Pi primitive: `pi.sendMessage({...}, { deliverAs })`

`@earendil-works/pi-coding-agent` exposes `pi.sendMessage<T>(message, options)` where `message` is `Pick<CustomMessage<T>, "customType" | "content" | "display" | "details">` and `options.deliverAs` is one of `"steer" | "followUp" | "nextTurn"`. The `CustomMessage<T>` shape (verified in `dist/core/messages.d.ts`):

```typescript
export interface CustomMessage<T = unknown> {
    role: "custom";
    customType: string;
    content: string | (TextContent | ImageContent)[];
    display: boolean;        // false = invisible to user UI; still model-visible
    details?: T;
    timestamp: number;
}
```

The runtime path for `deliverAs: "nextTurn"` (verified in `dist/core/agent-session.js` lines 985-987 and 790-794):

```javascript
// In sendCustomMessage(message, options):
if (options?.deliverAs === "nextTurn") {
    this._pendingNextTurnMessages.push(appMessage);
}

// In the next-user-prompt processing path:
// Inject any pending "nextTurn" messages as context alongside the user message
for (const msg of this._pendingNextTurnMessages) {
    messages.push(msg);
}
this._pendingNextTurnMessages = [];
```

The runtime path for `deliverAs: "followUp"` (verified at `dist/core/agent-session.js` lines 988-991):

```javascript
else if (this.isStreaming) {
    if (options?.deliverAs === "followUp") {
        this.agent.followUp(appMessage);
    }
    ...
}
```

Both paths use `role: "custom"`. The custom-message-to-LLM conversion is centralized in `dist/core/messages.ts::convertToLlm()` and emits the custom message as model context (referenced from the d.ts: `"Transform AgentMessages (including custom types) to LLM-compatible Messages. This is used by: Agent's transformToLlm option (for prompt calls and queued messages), Compaction's generateSummary (for summarization), Custom extensions and tools"`).

**Key implication for `display: false`:** the user-facing TUI consults a per-`customType` `MessageRenderer<T>`; without a registered renderer (or with the renderer returning `undefined` on `display: false`), the message is invisible to the user. But `convertToLlm()` still emits the content to the model. This is precisely the `<system-reminder>`-equivalent semantic: user-invisible, model-visible side channel.

### 13.3 Why each prior ESCALATE concern dissolves

1. **"Out-of-band turn semantics"** -- The `_pendingNextTurnMessages` queue drains at next user prompt boundary. Combined with the `agent.followUp()` path for in-stream injection, the bridge covers both cases. When the bridge selects `deliverAs` at exit-2 time based on `ctx.isIdle()` (false → followUp; true → nextTurn), it matches the semantic intent of asyncRewake -- inject context at the next turn boundary, idle or active.

2. **"System-reminder vs user-message rendering"** -- Pi's `CustomMessage` with `display: false` and a discriminator `customType: "claude-hook-rewake"` IS a privileged side-channel: invisible to the user UI but visible in the LLM context window via `convertToLlm()`. The model sees the content as background context, not as a user message. The framing is functionally equivalent to `<system-reminder>` -- the model receives the text as side-channel context distinct from the user's direct prompt.

3. **"Synchronous fallback is semantically destructive"** -- Not needed. The async path is implementable end-to-end without any fallback. Even if degradation were necessary for an edge case (e.g. Pi version with no `nextTurn` support detected at probe time), the security-guidance handler's `CONTINUATION_SUFFIX` -- `"\n\nAfter addressing or acknowledging this finding, continue with the user's original request or continue waiting for their reply -- this review is supplementary feedback, not a replacement for your previous response."` -- is explicitly designed to keep the rewake coherent even when it lands in an unexpected turn boundary. The handler authors anticipated delivery-mode variation.

4. **"Subordinate-fields hard-fail"** -- Resolved: all three fields are implemented as a coordinated triple. `rewakeMessage` is prepended to the stderr payload before injection; `rewakeSummary` is surfaced via `ctx.ui.notify(rewakeSummary, "info")` at the moment the bridge enqueues the next-turn message (matching Claude Code's TUI spinner-replacement behavior).

### 13.4 Source-audit findings

**security-guidance handler script (`hooks/security_reminder_hook.py` at commit `ca9f6045`):**

- The script is dispatch-mode-agnostic: every finding-detection path unconditionally writes to `sys.stderr` and calls `sys.exit(2)`. No `if asyncRewake` / no `CLAUDE_ASYNC_REWAKE` env-var check / no mode flag.
- Stderr payload structure: `PROVENANCE_BANNER + "\n\n" + concrete_guidance + CONTINUATION_SUFFIX + "\n"`. The `PROVENANCE_BANNER` is defined in the sibling `_base` module (not in the handler script itself).
- The handler also emits a single JSON line on stdout (`SyncHookJSONOutput`) containing `{"metrics": {...}, "rewakeSummary": "..."}` -- but this is supplementary to the exit-2 stderr path. When stderr is non-empty, Claude Code's `asyncRewake` runtime prefers stderr (per the documented `"stderr, or stdout if stderr is empty"` rule).
- `CONTINUATION_SUFFIX` text verified verbatim: `"\n\nAfter addressing or acknowledging this finding, continue with the user's original request or continue waiting for their reply -- this review is supplementary feedback, not a replacement for your previous response."`. This is the smoking gun that the handler authors expect the rewake to potentially land in an unexpected turn boundary.

**claude-intercom handler (`~/.claude/mcp-intercom/src/watcher.ts`):**

- The plugin pairs `asyncRewake: true` with `timeout: 300000` (5 minutes) on both `Stop` and `SessionStart` events.
- The script implements an `fs.watch` on an inbox directory; on detection of new files, it calls `process.exit(2)` to trigger the rewake.
- The plugin does NOT use `rewakeMessage` or `rewakeSummary` -- it relies on the raw stderr-to-system-reminder injection path. Confirms the subordinate fields are genuinely optional.

**Anthropic Issue #44881:**

- The reporter (`@nedlern`) misuses the field as `"type": "asyncRewake"` instead of the documented `"type": "command"` + `"asyncRewake": true`. The closed-as-duplicate status implies Anthropic engineers acknowledged the underlying `<system-reminder>` wrapping is the correct invisible-context-injection mechanism that the user could not see in normal usage -- the bug is the rendering-leak, not the mechanism itself.

- The reproduction transcript shows the actual `<system-reminder>` wrapper text Claude Code emits internally:

  ```text
  <system-reminder>
  Stop hook blocking error from command "SessionStart:resume":
  {"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"background check result"}}
  </system-reminder>
  ```

  Confirms the wake injection IS rendered as a `<system-reminder>` block in the model's view -- a privileged side-channel distinct from user messages.

### 13.5 Pi runtime compatibility verification

| Pi primitive needed                                                 | Available at peer-dep `^0.79.0`? | Source                                                                            |
| ------------------------------------------------------------------- | -------------------------------- | --------------------------------------------------------------------------------- |
| `pi.sendMessage({...}, { deliverAs: "nextTurn" })`                  | YES                              | `types.d.ts:857-860`, `SendMessageHandler` type at `:1046-1049`                   |
| `pi.sendMessage({...}, { deliverAs: "followUp" })`                  | YES                              | same as above                                                                     |
| `CustomMessage` with `display: false`                               | YES                              | `messages.d.ts:32-39`                                                             |
| `ctx.isIdle()` for IDLE-vs-STREAMING branch                         | YES                              | `types.d.ts:223-224` (`isIdle(): boolean`)                                        |
| `ctx.ui.notify(text, severity)` for `rewakeSummary`                 | YES                              | already used in v1.13                                                             |
| `_pendingNextTurnMessages` runtime queue drains on next user prompt | YES                              | `agent-session.js:790-794` shows the drain inside the user-prompt processing path |

Zero gaps. Every primitive the bridge needs is present in the peer dep.

### 13.6 Implementation sketch (HOOK-06 / EXEC-05)

Estimated LoC: ~250-300, split across one new module and small additions to existing dispatcher.

**New module: `src/bridges/hooks/async-rewake-registry.ts` (~180 LoC):**

```typescript
import { spawn, type ChildProcess } from "node:child_process";
import type { Pi, ExtensionContext } from "@earendil-works/pi-coding-agent";

interface RewakeEntry {
  pluginId: string;
  handlerIndex: number;
  dispatchId: string;
  child: ChildProcess;
  stderr: Buffer[];
  stdout: Buffer[];
  rewakeMessage?: string;
  rewakeSummary?: string;
  timeoutHandle: NodeJS.Timeout;
}

const MAX_STDERR_BYTES = 64 * 1024;

export class AsyncRewakeRegistry {
  private entries = new Map<string, RewakeEntry>();

  constructor(private pi: Pi, private ctx: ExtensionContext) {}

  /** Spawn detached and register. Returns immediately. */
  enqueue(opts: {
    pluginId: string;
    handlerIndex: number;
    command: string;
    args?: string[];
    env: NodeJS.ProcessEnv;
    cwd: string;
    stdinPayload: string;
    timeoutMs: number;
    rewakeMessage?: string;
    rewakeSummary?: string;
    shell?: string;
  }): void {
    const dispatchId = `${opts.pluginId}#${opts.handlerIndex}#${Date.now()}`;
    const useShell = opts.args === undefined;
    const child = spawn(
      opts.command,
      opts.args ?? [],
      {
        shell: useShell ? (opts.shell ?? true) : false,
        env: opts.env,
        cwd: opts.cwd,
        detached: false,
        stdio: ["pipe", "pipe", "pipe"],
      }
    );

    const entry: RewakeEntry = {
      pluginId: opts.pluginId,
      handlerIndex: opts.handlerIndex,
      dispatchId,
      child,
      stderr: [],
      stdout: [],
      rewakeMessage: opts.rewakeMessage,
      rewakeSummary: opts.rewakeSummary,
      timeoutHandle: setTimeout(() => this.killEntry(dispatchId, "SIGTERM"), opts.timeoutMs),
    };
    this.entries.set(dispatchId, entry);

    let stderrBytes = 0;
    let stdoutBytes = 0;
    child.stderr?.on("data", (chunk: Buffer) => {
      if (stderrBytes < MAX_STDERR_BYTES) {
        entry.stderr.push(chunk);
        stderrBytes += chunk.length;
      }
    });
    child.stdout?.on("data", (chunk: Buffer) => {
      if (stdoutBytes < MAX_STDERR_BYTES) {
        entry.stdout.push(chunk);
        stdoutBytes += chunk.length;
      }
    });

    child.on("exit", (code) => this.onExit(dispatchId, code));
    child.on("error", (err) => this.onError(dispatchId, err));

    child.stdin?.write(opts.stdinPayload);
    child.stdin?.end();
  }

  private onExit(dispatchId: string, code: number | null): void {
    const entry = this.entries.get(dispatchId);
    if (!entry) return;
    clearTimeout(entry.timeoutHandle);
    this.entries.delete(dispatchId);

    if (code !== 2) {
      // Silent for non-2 exits (including 0). Debug-log only.
      return;
    }

    const stderrText = Buffer.concat(entry.stderr).toString("utf8");
    const stdoutText = Buffer.concat(entry.stdout).toString("utf8");
    const payloadBody = stderrText.length > 0 ? stderrText : stdoutText;
    if (payloadBody.length === 0) return;

    const fullText = entry.rewakeMessage
      ? `${entry.rewakeMessage}\n\n${payloadBody}`
      : payloadBody;

    const deliverAs = this.ctx.isIdle() ? "nextTurn" : "followUp";
    this.pi.sendMessage({
      customType: "claude-hook-rewake",
      content: fullText,
      display: false,
      details: { pluginId: entry.pluginId, handlerIndex: entry.handlerIndex, dispatchId },
    }, { deliverAs });

    if (entry.rewakeSummary) {
      this.ctx.ui.notify(entry.rewakeSummary, "info");
    }
  }

  private onError(dispatchId: string, err: Error): void {
    const entry = this.entries.get(dispatchId);
    if (!entry) return;
    clearTimeout(entry.timeoutHandle);
    this.entries.delete(dispatchId);
    // Debug-log only; not user-visible.
  }

  private killEntry(dispatchId: string, signal: NodeJS.Signals): void {
    const entry = this.entries.get(dispatchId);
    if (!entry) return;
    try { entry.child.kill(signal); } catch {}
    if (signal === "SIGTERM") {
      // 5s grace, then SIGKILL.
      setTimeout(() => {
        if (this.entries.has(dispatchId)) {
          try { entry.child.kill("SIGKILL"); } catch {}
        }
      }, 5000);
    }
  }

  /** Called from the bridge's /reload teardown path. */
  shutdownAll(): void {
    for (const dispatchId of this.entries.keys()) {
      this.killEntry(dispatchId, "SIGKILL");
    }
    this.entries.clear();
  }
}
```

**Dispatcher integration (~50 LoC added to existing hook dispatcher):**

```typescript
// In the bridge's dispatchHookHandler(handler, event, ctx):
if (handler.asyncRewake === true) {
  asyncRewakeRegistry.enqueue({
    pluginId: handler.pluginId,
    handlerIndex: handler.index,
    command: handler.command,
    args: handler.args,
    env: buildEnv(handler, ctx),
    cwd: ctx.cwd,
    stdinPayload: serializeStdinPayload(event),
    timeoutMs: (handler.timeout ?? 600) * 1000,
    rewakeMessage: handler.rewakeMessage,
    rewakeSummary: handler.rewakeSummary,
    shell: handler.shell,
  });
  return; // Non-blocking; do not await
}
// ...existing synchronous dispatch path for non-asyncRewake handlers...
```

**File list:**

- NEW `src/bridges/hooks/async-rewake-registry.ts` (~180 LoC, the class above)
- MODIFY `src/bridges/hooks/dispatch.ts` (or equivalent existing dispatcher) -- add the `if (handler.asyncRewake === true)` branch and registry construction in the bridge's lifecycle bootstrap
- MODIFY `src/bridges/lifecycle.ts` (or equivalent `/reload` teardown) -- call `asyncRewakeRegistry.shutdownAll()` on reload and on extension shutdown
- NEW `tests/bridges/hooks/async-rewake-registry.test.ts` (~100 LoC) -- fixture plugin that exits 2 after 200ms sleep; assert (a) dispatcher returns within ≤50ms, (b) `pi.sendMessage` called exactly once with `customType: "claude-hook-rewake"` and the expected content, (c) `ctx.ui.notify(rewakeSummary, "info")` called when `rewakeSummary` set, (d) `display: false` in the sent message, (e) `deliverAs` is `"followUp"` when `ctx.isIdle()` returns false and `"nextTurn"` when true

**Loss-mode disclosure (none required, but document for completeness):**

If a future Pi peer-dep version drops `deliverAs: "nextTurn"` (would be a breaking change), the bridge can fall back to `deliverAs: "followUp"` only -- in which case idle-state rewakes would be lost until the next user prompt. Detect at extension load via feature-probe on `pi.sendMessage`'s type signature; emit one warning via `ctx.ui.notify` if the probe fails. v1.13 implementation can ship without the probe and add it later if needed (current peer-dep `^0.79.0` has the field; the contract is stable).

### 13.7 Failure-mode reference

| Failure mode                                                  | Bridge behavior                                                                                                                                                                                   | User-visible?                                                   |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Background process never exits (hangs)                        | After `timeout` (default 600s), SIGTERM → 5s grace → SIGKILL. No injection.                                                                                                                       | No                                                              |
| Background process crashes (SIGSEGV etc.)                     | `child.on("error", ...)` fires; entry cleaned up; no injection. Debug-log only.                                                                                                                   | No                                                              |
| Exit code 0                                                   | Entry cleaned up; no injection. Normal "no findings" path.                                                                                                                                        | No                                                              |
| Exit code non-2, non-0 (e.g. 1)                               | Entry cleaned up; no injection. Debug-log only. Matches Claude Code's "exit 2 is the only blocking signal" rule for asyncRewake.                                                                  | No                                                              |
| Bridge `/reload` while process alive                          | `shutdownAll()` SIGKILLs every entry. No injection. Reload completes.                                                                                                                             | No                                                              |
| Parent Pi process crashes                                     | OS reaps the child since `detached: false`.                                                                                                                                                       | No                                                              |
| Empty stderr AND empty stdout on exit 2                       | No injection (nothing to send). Debug-log only.                                                                                                                                                   | No                                                              |
| stderr exceeds 64KB                                           | Truncated with `…[truncated]` suffix. Injection proceeds with truncated content.                                                                                                                  | Model-visible (the truncation marker reaches the model context) |
| Multiple `asyncRewake: true` hooks all exit 2 in tight window | Each enqueues independently into `_pendingNextTurnMessages`. All deliver on next user prompt boundary as separate `customType: "claude-hook-rewake"` messages with distinct `details.dispatchId`. | No                                                              |

### 13.8 Final verdict

**IMPLEMENT.** The bridge implements `asyncRewake` / `rewakeMessage` / `rewakeSummary` end-to-end via HOOK-06 (registry contract) and EXEC-05 (background-spawn pattern). Plugins declaring `asyncRewake: true` install cleanly. The only remaining v1.13 blocker for `security-guidance` is TOOL-02(b) -- the `MultiEdit` / `NotebookEdit` Pi-tool-map gap -- which is addressable in v1.14+ via PROM-01. No upstream Pi-runtime PR is required; every primitive needed (`pi.sendMessage` with `deliverAs: "followUp" | "nextTurn"`, `CustomMessage` with `display: false`, `ctx.isIdle()`, `ctx.ui.notify`) is already present in `@earendil-works/pi-coding-agent` `^0.79.0`. The asyncRewake-related v1.14+ deferral (EXTH-V2-01) is dropped.

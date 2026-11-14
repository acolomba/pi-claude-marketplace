# Phase 6: Hook Inputs and Events - Research

**Researched:** 2026-11-14
**Domain:** Claude Code hook stdin parity on Pi 1.5.0: new stdin fields, the `UserPromptExpansion` event, `SessionStart` `resume`, and the session a pi-subagents child names
**Confidence:** HIGH for the upstream contract (binary 2.1.323 and docs read this session) and for the repository seams; MEDIUM for the Pi launch behavior that spike S7 must still run (read from source, not run)

<user_constraints>

## User Constraints (from CONTEXT.md)

Copied verbatim from `06-CONTEXT.md` (gathered 2026-11-14 in autonomous discuss mode). Every decision is pending maintainer review. The only change is that the sub-headings are one level deeper.

### Locked Decisions

#### Decision 26: the session a child's tool hook names (success criterion 6)

- **D-PG6-01 (pending maintainer review; product: changes what a child hook
  sees):** In a pi-subagents child, a tool hook's `session_id`,
  `transcript_path`, `CLAUDE_CODE_SESSION_ID`, and the legacy
  `CLAUDE_SESSION_ID` name the **root main session**: the Pi session the user
  runs, not the child's own and not an intermediate parent of a nested child.
  `agent_id` stays the child's own Pi session id and `agent_type` stays as
  D-PG3-06 set them, so a child hook still tells itself apart from a main
  hook by `agent_id` alone, as upstream says to. This is what Claude Code
  does (evidence record 1). — **Reversibility:** reversible — one field
  source in `buildTranslationContext` and the env layer; every child scenario
  literal changes with it.
- **D-PG6-02 (pending maintainer review):** Where the root comes from, in
  order: the `PI_SUBAGENT_PARENT_SESSION` variable for the id (pi-subagents
  0.88.1 documents it as the "Root parent session id the parent publishes"
  and sets it in the runner environment of background children,
  `src/runs/background/async-execution.js:551-554`); and the child session
  header's `parentSession`, which pi-subagents writes as the parent session
  **file** when it creates the child's session file
  (`src/runs/shared/child-session.js:529-542`), for the transcript path and,
  through that file's header, the id. Research confirms that both name the
  root for a nested child, or walks the `parentSession` chain to the root,
  and reads them in the pi-subagents 0.87.0 source, the floor. When neither
  source yields a root, the child's fields stay its own, as today, with one
  debug line, and the compatibility page says so. The bridge never guesses a
  parent. The parent's transcript path is the parent's session file even
  while the parent writes it; upstream's file also lags (docs, "Common input
  fields"). A foreground child runs no plugin hook at all (Pi capability gap
  recorded in `docs/hooks-compatibility.md` "Child identity"), so the
  decision concerns background children.
- **D-PG6-03:** Only the fields a hook reads change. Every internal key that
  is the child's own Pi session id today stays so: the `CLAUDE_ENV_FILE`
  directory (D-60-06), the hook journals and PID tables (D-PG3-05), the
  rewake registry, and the identity guard `childIdentity.sessionId ===
  sessionId` in `translation-context.ts`. So two concurrent children of one
  parent still keep separate state. Research lists each consumer of
  `TranslationContext.sessionId` and says which side it reads.
  `docs/hooks-compatibility.md` "Child identity" replaces "This difference is
  not decided yet" with the rule, the fallback, and the evidence. CHILDSESSIONID-01
  closes when the phase verifies.

#### Decision 9: send the missing stdin fields (PG-HOOK-04)

- **D-PG6-04 (pending maintainer review):** Yes. Send the fields now. This
  reopens and supersedes D-CF5-28 and D-BG-403: their reasons were "no
  scenario needs either field yet" and "the ids and timings vary per run",
  neither a Pi gap, and the harness placeholders of D-PG6-12 remove the
  second. HOOKPAYLOAD-01 closes when the phase verifies. A field is omitted,
  never sent empty or `null`, where upstream marks it optional and Pi cannot
  supply it, except `custom_instructions`, which upstream types as nullable.
  — **Reversibility:** reversible per field; costly in aggregate, because
  every whole-payload scenario literal grows.
- **D-PG6-05:** `tool_use_id` is Pi's `toolCallId`, a string, the same value
  on `PreToolUse` and on the `PostToolUse` or `PostToolUseFailure` run of one
  call, and a different value on another call (success criterion 1). Upstream
  types it as a required string on all three events. Two cases need a rule:
  - A multi-pair native `edit` runs one hook per pair (D-PG2-01). Upstream has
    one id per `Edit` call, and `security-guidance` uses the id as a per-call
    dedupe sentinel, so pairs that shared one id would suppress each other's
    reminder. Each pair gets its own id, equal on its pre and result runs,
    and a single-pair call keeps the bare `toolCallId`. The planner picks the
    suffix form (for example `<toolCallId>#<n>`, 1-based).
  - A call another tool issued carries Pi's `<parent id>/<n>` id; send it as
    Pi gives it.
- **D-PG6-06:** `duration_ms` on `PostToolUse` and `PostToolUseFailure` is
  the tool's execution time in whole milliseconds, without the time of the
  `PreToolUse` hooks, as upstream defines it ("Excludes time spent in
  permission prompts and PreToolUse hooks"). Pi's `tool_execution_end`
  carries `durationMs` but fires after `tool_result`, so research measures
  whether a start mark exists that the bridge can read before `tool_result`;
  otherwise the bridge times from the end of its `PreToolUse` dispatch to the
  start of its `tool_result` handler. Omitted when the bridge has no start
  mark for the call (upstream: optional). Upstream sends it on success and
  failure alike.
- **D-PG6-07 (pending maintainer review; the `name` value is medium
  confidence):** `mcp_server` is an **object**, not a string:
  `{ "name": <server config key>, "source": <where it came from> }`, as
  Claude Code 2.1.274 and later send it (evidence record 2). For a plugin MCP
  server, `source` is `"plugin"` and `name` is Claude Code's config key for
  it, `plugin:<plugin>:<server>`, under both MCP implementations. Research
  confirms the key form in the binary (the `plugin:${k}:${v}` builder and the
  `source` precedence of `r$r`) before the plan fixes it. A non-plugin MCP
  tool gets the object only when the bridge can name its server and the Pi
  config scope it came from (`user` or `project`); otherwise the field is
  omitted. A non-MCP tool never carries it. Tool events only: `PreToolUse`,
  `PostToolUse`, `PostToolUseFailure`.
- **D-PG6-08:** `PreCompact` carries `custom_instructions`: the text the user
  passed to `/compact`, from Pi's `customInstructions`, or `null` when there
  is none and for an automatic compaction, as upstream documents.
- **D-PG6-09:** `SessionStart` carries `model`, the bare id of Pi's active
  model (`ctx.model.id`, no provider prefix, consistent with D-PG1-04), and
  `session_title`, Pi's session name, each omitted when Pi has none (upstream
  marks both optional and says `model` "can be omitted").
  `UserPromptSubmit` also gets `session_title` when Pi has one: its 2.1.323
  schema carries the optional field, it costs the same read, and the PRD
  research proposed it. — **Pending maintainer review**: this last part goes a
  step past the requirement's wording, toward parity.
- **D-PG6-10:** `effort` is `{ "level": <level> }` when Pi's thinking level
  is `low`, `medium`, `high`, or `xhigh`, read per dispatch. Pi's `off` and
  `minimal` send no `effort`; Claude's `max` has no Pi level. Upstream sends
  it only on events that run with a tool-use context and omits it on
  session-lifecycle events. Default event set: `PreToolUse`, `PostToolUse`,
  `PostToolUseFailure`, `UserPromptSubmit`, `Stop`, and `StopFailure`; not
  `SessionStart`, `SessionEnd`, `PreCompact`, `PostCompact`, or
  `UserPromptExpansion` (whose upstream builder passes no model). Research
  confirms each event against the binary's callers of the base builder `Hm`
  and corrects the set before planning.

#### Decision 25: `permission_mode` (PG-HOOK-04)

- **D-PG6-11 (pending maintainer review; product):** Leave `permission_mode`
  out of every payload. License: Pi capability gap, Pi has no permission
  modes. Why omission is the upstream-closest choice: upstream types the
  field as optional and leaves it off some events (U23), so every hook
  written for Claude Code already handles its absence; the one official
  reader (`code-modernization/scripts/telemetry.py:443`) maps a missing value
  to "unknown". Any constant would claim a Claude state that did not happen:
  `"default"` says risky tools prompt, which Pi does not do; `"bypassPermissions"`
  says the user turned off a safety flag, which security hooks may react to.
  The rejected alternative is the constant `"default"`, which matches the
  typical upstream payload shape; adding it later is one envelope line.
  `docs/hooks-compatibility.md` lists the field as not sent, with the reason.

#### Behavioral test placeholders (PG-HOOK-04)

- **D-PG6-12:** The whole-payload step (`features/step_definitions/hook/runs.steps.ts`)
  projects the new varying values the way it projects session ids today: each
  distinct `tool_use_id` becomes an ordinal token by first appearance, so a
  literal shows that a pre run and its result run share an id and that a
  second call has another; a `duration_ms` becomes one token that stands for
  a non-negative integer. No scenario asserts a timing value. Scenarios still
  state every other field literally, so a missing or extra field fails them.
  The planner picks the token spellings; they must not collide with the
  session-id ordinals.

#### Spike S7 and `resume` (PG-HOOK-11)

- **D-PG6-13:** Spike S7 is the first plan's work: in Pi 1.5.0 (the floor)
  and the suite version, does a session launched with `--continue` (and with
  `--session <existing file>`) hold its restored entries when `session_start`
  fires, and what `reason` does Pi report? Record the commands, a hermetic
  `PI_CODING_AGENT_DIR` and `HOME`, and the output. No plan for PG-HOOK-11's
  detection proceeds before the spike is recorded. The spike never touches
  the real `~/.pi/agent`.
- **D-PG6-14 (pending maintainer review):** A launch that continues a saved
  session that already holds entries sends `SessionStart` `resume`, the
  value Claude Code sends for `--resume`, `--continue`, and `/resume` (docs:
  "`SessionStart` hooks run again on resume with `source` set to
  `"resume"`"). That covers Pi's `--continue`, `--resume`, and `--session`
  with an existing file. A `--continue` that finds nothing to continue
  starts a new session and sends `startup`. Detection follows HOOKLAUNCH-01:
  restored entries at `session_start` if S7 confirms them, otherwise a
  session file that existed before the launch; never a parse of Pi's
  command line. The matcher compares with the mapped value (D-CF5-01).
- **D-PG6-15 (pending maintainer review; scope: one step past the
  requirement):** A launch with `--fork` sends `fork`, as upstream does for
  `--fork-session`, detected through the session header's `parentSession`
  (HOOKLAUNCH-01), if S7 shows the header is readable at `session_start`. A
  pi-subagents child also has a `parentSession` header, but a child runs no
  `SessionStart` (D-PG3-04), so it cannot misfire. If S7 shows `fork`
  detection is not reliable, `--fork` keeps `startup` and the page says so.
- **D-PG6-16:** The cucumber harness gains a launcher option that starts Pi
  with `--continue` (and `--session <file>` for the `--resume` path, since
  Pi's `--resume` opens a picker), with the saved session written by a
  `Given` as D-BG-601 does. It is an option of the existing launch, not a
  new driver.
- **D-PG6-17:** PG-HOOK-11 amends D-CF5-06 (Deferred → done; its reason, the
  frozen launcher, no longer holds), closes HOOKLAUNCH-01 when the phase
  verifies, and replaces the `--continue`/`--resume`/`--fork` row of the
  Session events table in `docs/hooks-compatibility.md`.

#### `UserPromptExpansion` (PG-HOOK-06)

- **D-PG6-18:** The bucket runs on Pi's `input` event, before skill and
  template expansion, when a typed line names a Pi prompt template or a
  skill: `/skill:<name>`, a qualified alias that `edge/skill-aliases.ts`
  resolves, or a template that `edge/command-invocation.ts` sees. It runs for
  every template and skill, not only bridged ones, because upstream fires the
  event for any prompt-type command the user types (docs: "Leave the matcher
  empty to fire on every prompt-type command"). It runs only for input whose
  `source` is not `extension`, matching upstream's "user-typed" rule: a skill
  the model starts through a tool, `run_plugin_command`, or a
  `sendUserMessage` does not fire it. It runs once per typed line, before the
  bridge's own command or skill invocation, and research fixes one ordering
  across the input handlers of the hooks bridge, `command-invocation.ts`, and
  `skill-aliases.ts`, so a block wins before any expansion. Main session only:
  `CHILD_EVENT_POLICY` classifies the event as not dispatched in a child.
  Research reads the order of `UserPromptExpansion` against
  `UserPromptSubmit` in the binary and keeps it.
- **D-PG6-19 (pending maintainer review; `command_source` for non-plugin
  items is low confidence):** The fields: `expansion_type`
  `"slash_command"`; `command_name` in Claude form, `<plugin>:<name>` for a
  bridged command or skill (so a `demo:deploy` matcher matches `/demo:deploy`)
  and the bare name for a Pi template or skill of no plugin; `command_args`,
  the rest of the line; `command_source`, `"plugin"` for bridged items, and
  for others the value upstream uses for a command of that scope, which
  research reads from the binary (omitted if no value fits; the field is
  optional upstream); `prompt`, the line as typed, `/<name> <args>`. The
  matcher tests `command_name` under the PG-HOOK-03 rules, so
  `claude-security`'s regex `^claude-security:claude-security$` matches.
  Plus the common fields of D-PG6-04 (no `effort`, no `permission_mode`).
- **D-PG6-20 (pending maintainer review; product: user-visible wording):** A
  block (`decision: "block"` or exit 2) returns `{ action: "handled" }`, so the
  model receives no call, and shows one `hook-notice` that names the event and
  holds the reason or the exit-2 stderr. Upstream's text is
  `UserPromptExpansion operation blocked by hook:` and the reason on the next
  line; the bridge uses it in its notice form (D-CF5-24). `additionalContext`
  and plain stdout reach the model with the expanded prompt through the same
  buffer `UserPromptSubmit` uses, under the 10,000-character cap (D-PG5-14).
  `continue: false` stops the expansion as a block does and shows its
  `stopReason` in the D-PG5-13 form. The non-blocking failure notice of
  D-PG5-10 applies.
- **D-PG6-21:** `UserPromptExpansion` becomes a supported event: install no
  longer counts it as unsupported, `info` reports it supported, and the
  Events table changes. An installed plugin whose `UserPromptExpansion` group
  was dropped at install gets it at its next `update` or `reinstall`; a load
  rewrites no installation state (APL-D1, the D-CF5-08 pattern). A plugin
  that needed `--partial` only for this event no longer does;
  `claude-security` still needs it for `PermissionRequest`.
- **D-PG6-22:** MCP prompt expansions stay out of reach: Pi has no slash
  surface for MCP prompts, so `expansion_type` is never `"mcp_prompt"`. The
  page says so.

#### Records and evidence

- **D-PG6-23:** Correct `docs/hooks-compatibility.md` in the same change:
  "Current tool contract" (the new fields), "Child identity" (D-PG6-01..03),
  the `UserPromptExpansion` row and the unsupported list (`:96`, `:174`),
  Session events (D-PG6-17), and the stdin section (`permission_mode` not
  sent). Update `docs/output-catalog.md` for the new notice, and add the
  CHANGELOG lines with the `changelog` skill.
- **D-PG6-24:** Each success criterion ships a cucumber scenario that fails
  without its change (AGENTS.md "Behavioral tests"): (1) same `tool_use_id`
  on pre and post of one call, another on a second call; (2) each named field
  on its event, including an MCP tool under both profiles for `mcp_server`, a
  `/compact` with and without instructions, a named session, and a thinking
  level inside and outside Claude's set; (3) `demo:deploy` blocks `/demo:deploy`,
  no model call, the notice holds the reason; (4) a non-blocking expansion
  hook records its fields for a typed template and a typed skill, and the
  expansion then runs; (5) `resume` under `--continue` and `--session`,
  `startup` in a new session (and `fork` under `--fork` if D-PG6-15 holds);
  (6) a real background child's tool hook names the main session. Existing
  whole-payload literals change with the new fields. Owner unit tests cover
  the edge arms: no root source, a nested child, a multi-pair edit, a nested
  tool id, `off`/`minimal` levels, no model, no session name, a non-plugin
  MCP tool. MCP-free scenarios run under one profile (D-BG-208). All tests
  run in a hermetic home and never touch the real `~/.pi/agent`.

#### Pending maintainer review

Every decision above was taken without asking. The ones that most need a look:

- D-PG6-01/02: the root main session in a child, and the fallback to the
  child's own session when no root source exists.
- D-PG6-04: sending the fields at all (decision 9).
- D-PG6-07: `mcp_server` as an object, and the `plugin:<plugin>:<server>` name.
- D-PG6-09: `session_title` on `UserPromptSubmit` too.
- D-PG6-11: `permission_mode` left out (decision 25); the alternative is
  `"default"`.
- D-PG6-14/15: `resume` for `--session`, and `fork` for `--fork`.
- D-PG6-18/19: the event fires for non-plugin templates and skills too, and
  `command_source` for them.
- D-PG6-20: the block notice wording.

### Claude's Discretion

Module and type names; the tool-id suffix form for edit pairs; the placeholder
token spellings; where the duration start mark lives; the launcher option's
name; plan splits. No exception to plan size, security, coverage, or
verification gates.

### Deferred Ideas (OUT OF SCOPE)

- `CLAUDE_EFFORT` and the other variables of HOOKENV-01.
- `prompt_id`, `scratchpad_dir`, the `UserPromptSubmit` `source` field, and
  the four `SessionStart` resume cost fields
  (`seconds_since_last_response`, `context_tokens`,
  `prompt_cache_likely_expired`, `estimated_cache_write_usd`).
- `SessionStart` output fields the bridge does not honor (`sessionTitle`,
  `watchPaths`, `reloadSkills`, `initialUserMessage`).
- `permission_mode` as a constant, if the maintainer overrides D-PG6-11.
- MCP prompt expansions (`expansion_type: "mcp_prompt"`), until Pi has a
  surface for MCP prompts.
- Plugin hooks in a foreground pi-subagents child (Pi capability gap).
- `SubagentStart`/`SubagentStop` and `agent_transcript_path` (PG-HOOK-07b).

</user_constraints>

## Summary

All three requirements are additions to code that exists. No package is added, no state schema changes, and no floor moves. The upstream contract was read in the Claude Code 2.1.323 binary and in the hooks page fetched today. The Pi side was read in the `dist` source of Pi 1.5.0 (the `node_modules` copy, which is both the floor and the suite version) and Pi 1.5.2 (Homebrew), and in pi-subagents 0.87.0 (the floor, fetched from npm into the scratchpad) and 0.88.1 (the suite copy). No Pi or Claude Code session ran in this research. [VERIFIED: file reads and binary greps recorded under "Upstream evidence records" and "Pi and companion evidence"]

Most CONTEXT decisions hold as written. Twelve findings (F1 to F12) change, sharpen, or confirm one; these change a plan. The `effort` event set loses `UserPromptSubmit` and Pi does have a `max` level (F1, F2). Neither pi-subagents source names the root for a nested child; both name the launching session (F3). Pi gives no start mark that excludes `PreToolUse` hook time, and in a parallel tool batch every `tool_call` handler runs before any tool starts (F5). A new Pi session already holds `model_change` and `thinking_level_change` entries when `session_start` fires, so "restored entries" must mean message entries (F7). A session header keeps `parentSession` for its whole life, so `fork` detection needs a "created in this launch" test (F8). `UserPromptSubmit` runs before `UserPromptExpansion` upstream, and a blocked prompt runs no expansion hook (F9). The `mcp_server` name `plugin:<plugin>:<server>` with source `plugin` is confirmed in code (F6).

The largest cost is not the new code. It is the behavioral suite: about 170 whole-payload tables under `features/` gain columns, and four harness pieces are new (a launcher option for a saved session, a reasoning-capable scripted model, placeholder projections for ids and timings, and a server table for `mcp_server`).

**Primary recommendation:** Land the harness placeholders and the launcher option first (Wave 0), run spike S7 as recorded commands in a hermetic home, then add the fields in one translator pass that splits `TranslationContext` into hook-facing fields (`sessionId`, `transcriptPath`: root in a child) and one own-session field for every internal key. Register the `UserPromptExpansion` `input` handler in the hooks bridge directly after the `UserPromptSubmit` one, with the typed-line resolver injected from the entry point.

## Findings That Change CONTEXT Decisions

Each row names the decision, the evidence, and the reversible upstream-parity default this research recommends. **Every recommendation is pending maintainer review.** CONTEXT.md was not edited.

| # | Decision | Finding | Evidence | Confidence | Recommended default (pending maintainer review) |
| --- | --- | --- | --- | --- | --- |
| F1 | D-PG6-10 (event set for `effort`) | **`UserPromptSubmit` carries no `effort` upstream.** The base builder sets `effort` only when its fourth argument holds `options.mainLoopModel` and `getAppState`. Both `UserPromptSubmit` builders pass `{agentId, agentType}` or nothing. | Binary U2, U3; docs: "Present for `PreToolUse`, `PostToolUse`, `Stop`, `SubagentStop`, and other events with a tool-use context, on models with effort" | HIGH | Send `effort` on `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `Stop`, and `StopFailure`. Not on `UserPromptSubmit`, `UserPromptExpansion`, `SessionStart`, `SessionEnd`, `PreCompact`, `PostCompact`. |
| F2 | D-PG6-10 ("Claude's `max` has no Pi level") | **Pi 1.5.0 has a `max` thinking level.** `ThinkingLevel = "off" \| "minimal" \| "low" \| "medium" \| "high" \| "xhigh" \| "max"`. The existing `${CLAUDE_EFFORT}` mapping already passes `max` through. | P7; `domain/argument-substitution.ts:280-288` | HIGH | Send `{ "level": "max" }` for Pi `max`. Keep `off` and `minimal` without `effort`, as the requirement says. Record that `${CLAUDE_EFFORT}` maps `off`/`minimal` to `low` (D-CF1-01) while the hook field is left out; upstream says the two hold the same level. |
| F3 | D-PG6-02 ("both name the root for a nested child") | **Neither source names the root for a nested child.** `PI_SUBAGENT_PARENT_SESSION` is `ctx.parentSessionId ?? ctx.currentSessionId`, and `parentSessionId` is `getSessionId()` of the session whose `subagent` tool made the launch. The child header's `parentSession` is that same session's file. For a child of a child, both name the intermediate child. A blind walk of `parentSession` headers is also unsafe: a user session made with `--fork` carries `parentSession` too, so the walk would pass the root. | S1 to S5, in 0.87.0 and 0.88.1 | HIGH (source), not run | One hop only from pi-subagents' data: the id from the variable, the path from the child's own header. For a nested child, a child process publishes the root pair it resolved in two variables of this extension's own, which the grandchild's runner inherits (pi-subagents copies `process.env`, S5). A non-child process deletes them at load. See "Pattern 1". The alternative, naming the immediate parent for a nested child, contradicts D-PG6-01. |
| F4 | D-PG6-02 (the id source) | The variable's fallback value `ctx.currentSessionId` is `getSessionFile() ?? getSessionId()`, so it can be a **file path**. It is reached only when `getSessionId()` gave nothing. | S2 | HIGH | Treat a value that holds a path separator as no id. When the header's file is readable, prefer the id in that file's header and require it to equal the variable. |
| F5 | D-PG6-06 (start mark) | **Pi has no usable start mark.** `tool_execution_start` fires before the `tool_call` handlers, so it includes `PreToolUse` hook time. Pi's own `durationMs` is on `tool_execution_end`, which fires after `tool_result`. In a parallel batch, every `tool_call` handler runs before any tool executes, so a per-call mark over-counts the earlier calls by the hook time of the later ones. | P4, P5 | HIGH | The bridge times it: mark at the end of its `tool_call` handler, on every exit path; at `tool_result`, `duration_ms = round(now - max(own mark, last top-level mark))`. The page says the value also holds the time of other extensions' handlers and prompts between the two events. |
| F6 | D-PG6-07 (`name` "medium confidence") | **Confirmed in code.** A plugin server's config key is `` `plugin:${plugin}:${server}` `` with `scope: "dynamic"` and `pluginSource` set; the tool's `mcpInfo.source` is `"plugin"` when the config has `pluginSource`; the hook field is `{name: mcpInfo.serverName, source}`. The repository already has this string: `mcpServerDisplayName`. | U4, U5; `domain/name.ts:616-618` | HIGH (code), runtime value not observed | Keep D-PG6-07. Leave the field out for a non-plugin MCP tool in this phase (the decision allows it); naming a Pi config scope for one needs a reader the bridge does not have. |
| F7 | D-PG6-14 ("restored entries at `session_start`") | **A new session is not empty at `session_start`.** Pi appends `model_change` and `thinking_level_change` (and `session_info` under `--name`) before it emits the event. Pi's own test for "existing session" is `buildSessionContext().messages.length > 0`. | P1, P2 | HIGH (source), spike pending | `resume` when the launch reason is `startup` and the session holds at least one `message` entry, and the fork test of F8 is false. Read `ctx.sessionManager.getEntries()`; no file read, no command-line parse. |
| F8 | D-PG6-15 (`fork` through `parentSession`) | **`parentSession` stays in the header for the life of the file**, so a later `--continue` of a forked session also has it. Upstream sends `resume` there. | P3 | HIGH (source), spike pending | `fork` when the reason is `startup`, the header has `parentSession`, and the header's `timestamp` is not older than this process's start (`performance.timeOrigin`). The spike must run "`--fork`, then `--continue` on the fork". If the test is not reliable, `--fork` keeps `startup` (D-PG6-15's own fallback). |
| F9 | D-PG6-18 (order, "research reads and keeps it") | **`UserPromptSubmit` runs first; a block runs no `UserPromptExpansion` hook.** | U7; docs `hooks.md:1554`, lifecycle diagram text | HIGH (docs), MEDIUM (the binary's callback is identified by its telemetry name) | Register the expansion `input` handler after the `UserPromptSubmit` one in `registerHooksBridgeWith`. Pi runs one extension's handlers in registration order and stops at the first `handled` (P6), and `index.ts` registers the bridge before `registerSkillAliases` and `registerCommandInvocation`. |
| F10 | D-PG6-19 (`command_source`, `prompt`) | `command_source` is the command's `source`: `"plugin"`, `"userSettings"`, `"projectSettings"`, `"policySettings"`, `"bundled"`, `"builtin"`, `"mcp"`. `prompt` is `/<name>` with no trailing space when there are no arguments. `command_args` is a required string, `""` with none. | U6, U8 | HIGH | Bridged item: `"plugin"`. Pi template or skill of `sourceInfo.scope` `user`: `"userSettings"`; `project`: `"projectSettings"`; `temporary`: leave the field out. |
| F11 | D-PG6-20 (block text) | Upstream adds a blank line and `Original prompt: <line>` after the reason, unless the hook sets `suppressOriginalPrompt`. | U6 | HIGH | Leave the `Original prompt:` part out, as the `UserPromptSubmit` notice already does (D-CF5-24, `hook-labels.ts:129-140`). No new divergence. |
| F12 | D-PG6-01 (scope of "the fields a hook reads") | A child's Bash tool reads `CLAUDE_CODE_SESSION_ID` from `process.env`, which `applySessionEnv` sets to the child's own id (`index.ts:270-276`). After D-PG6-01, a hook and a Bash command in one child disagree on the variable. | Repository read | HIGH (repo); upstream Bash env in a subagent not read | Out of the decision's wording. Recommended: leave `applySessionEnv` as it is in this phase and record the difference on the compatibility page; ask the maintainer whether the root id should also reach the child's `process.env`. |

## Architectural Responsibility Map

This is a local Pi extension. The tiers are the project's own layers (`.planning/codebase/ARCHITECTURE.md`, loaded with AGENTS.md).

| Capability | Primary tier | Secondary tier | Rationale |
| --- | --- | --- | --- |
| Hook-facing session fields and root resolution | `bridges/hooks/translation-context.ts`, `bridges/hooks/runtime.ts` (child identity) | `platform/subagent-child.ts` (reads the pi-subagents variable) | The context is the one place every translator reads; identity is per session in the runtime (D-PG3-06). |
| New stdin fields | `bridges/hooks/payloads/*.ts` | `bridges/hooks/dispatch.ts` (pair ids, timing), `bridges/hooks/mcp-tool-view.ts` (server identity) | Translators are pure and shape-only. |
| `duration_ms` marks | `bridges/hooks/runtime.ts` | `bridges/hooks/event-router.ts` (`tool_call` wrapper), `dispatch.ts` (`tool_result`) | Per-load mutable state lives in the runtime. |
| `mcp_server` table | `bridges/hooks/routing-state.ts` and the hydrate in `event-router.ts` | `domain/name.ts` (`mcpServerDisplayName`, `builtinMcpServerName`, `generatedMcpServerKey`) | The hydrate already loads each scope's state; bridges may import `domain` and `persistence`. |
| `UserPromptExpansion` admission | `shared/concerns/hooks.ts`, `domain/components/hook-events.ts`, `domain/components/hooks/partition.ts`, `matcher.ts` | every `Record<DispatchableEvent, …>` table | The closed sets are compile-forced. |
| `UserPromptExpansion` dispatch | `bridges/hooks/event-router.ts` (third `input` registration), `dispatch.ts`, `event-adapters.ts`, `hook-labels.ts` | `index.ts` (injects the typed-line resolver) | The bridge owns dispatch and notices; `bridges-hooks` may not import `edge` or `orchestrators`. |
| Typed-line resolver (name, Claude form, source) | `orchestrators/skill-alias-state.ts` (alias table), a new resolver beside it | `edge/skill-aliases.ts`, `edge/command-invocation.ts` (unchanged order) | The alias table and the staged-file lookups live there. |
| `SessionStart` `resume` and `fork` | `bridges/hooks/payloads/session-start.ts` (`claudeSessionStartSource`) | `event-router.ts` (`session_start` handler) | The one mapping site (D-CF5-01). |
| Harness | `test/e2e/_rpc.ts` (`piArguments`), `features/lib/pi-process.ts`, `features/support/world.ts`, `features/step_definitions/hook/*.steps.ts`, `features/lib/scripted-model/extension.ts` | `features/lib/real-subagent-child.ts` | D-PG6-12, D-PG6-16. |
| Records | `docs/hooks-compatibility.md`, `docs/output-catalog.md`, `CHANGELOG.md` | none | D-PG6-23. |

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
| --- | --- | --- |
| PG-HOOK-04 | A hook receives `tool_use_id` on the three tool events, `duration_ms` on `PostToolUse` and `PostToolUseFailure`, `mcp_server` for MCP tools, `custom_instructions` on `PreCompact`, `model` and `session_title` on `SessionStart`, and `effort` when Pi's level is one of Claude's levels. (P1; decisions 9 and 25) | Upstream schemas and builders (U1 to U5, U8); Pi fields `toolCallId`, `customInstructions`, `ctx.model`, `getSessionName`, `getThinkingLevel` (P4, P7, P8); the timing order of Pi's tool events (P4, P5); the edit-pair seams; the server table; F1, F2, F5, F6. |
| PG-HOOK-06 | When a typed line names a prompt template or a skill, `UserPromptExpansion` hooks run before the expansion with Claude Code's fields, and a block stops the expansion and shows the reason. Depends on PG-HOOK-03 (c). (P1) | Upstream runner, schema, matcher target, texts, and order (U6, U7, U8); Pi's `input` order (P6); the admission and matcher seams; the alias table; F9, F10, F11. |
| PG-HOOK-11 | A `SessionStart` hook receives `resume` in a session started with `--continue` or `--resume`. (P1; spike S7) | Pi's launch path in 1.5.0 and 1.5.2 (P1, P2, P3); the spike commands; the launcher option; F7, F8. |

Requirement text is quoted from `.planning/REQUIREMENTS.md:29,30,34`. [VERIFIED: file read this session]

</phase_requirements>

## Project Constraints (from AGENTS.md)

These directives bind the plans. [VERIFIED: AGENTS.md and the `.planning/codebase/` files loaded this session; skill files read this session]

- **Upstream parity is the default.** A divergence needs a recorded decision with an ID or a Pi capability gap. Research upstream with `.agents/skills/claude-code-compat-research`.
- **Behavioral tests:** a user-visible change to hook behavior ships a cucumber scenario under `features/` that fails without the change. Read `.agents/skills/cucumber/SKILL.md` and its rules files before any file under `features/` changes.
- **Quality bar (NFR-6):** `npm run check` stays green: typecheck, ESLint, `fallow`, Prettier, source/test pairing, unit, integration, cucumber under both profiles, and 100% direct coverage for every source-test pair. A new source file needs its paired test.
- **Two complexity gates:** ESLint `sonarjs/cognitive-complexity` 15 and fallow `maxCognitive` 15 / `maxCyclomatic` 20, computed separately. `dispatch.ts` and `event-router.ts` are large; new arms go into small functions.
- **Output (IL-2):** every user-visible line goes through `notifyHookNotice` in `shared/notification-dispatch.ts`. No `console`, no stdio.
- **NFR-2:** a Pi event handler never throws. The root resolution, the timing marks, and the expansion handler all catch.
- **NFR-1 / NFR-10:** no new file write is planned. The root resolution only reads the parent session file's first line.
- **Zones:** `bridges-hooks` may import `domain`, `persistence`, `shared`, `platform`; never `edge`, `orchestrators`, or a sibling bridge. The Pi peer is imported only in `platform/pi-api.ts`.
- **No test-only seams:** pass a dependency as a parameter (the `tools` and `executor` pattern in `dispatch.ts`).
- **Comments** cite durable IDs (D-PG6-NN, PG-HOOK-NN), never a phase or plan number.
- **Hermetic homes only:** no test, spike, or probe touches the real `~/.pi/agent`. Unit tests run with `--import test/platform/isolated-pi-home.ts`.
- **Git:** never commit to `main`; no rebase; follow `.agents/skills/committing/SKILL.md`; never `--no-verify`.
- **GSD records:** every plan `SUMMARY.md` has `## Threat Flags`; `windows append` descriptions start with the milestone in brackets.
- **Markdown** is formatted by mdformat and markdownlint through pre-commit, not by Prettier.

## Standard Stack

No library is added. The phase uses what the repository has.

| Library | Version | Purpose | Note |
| --- | --- | --- | --- |
| `@earendil-works/pi-coding-agent` | 1.5.0 (dev and floor) | `input`, `tool_call`, `tool_result`, `session_start`, `session_before_compact`; `ctx.sessionManager.getHeader()`, `getEntries()`, `getSessionName()`; `ctx.model`; `pi.getThinkingLevel()`, `pi.getCommands()` | [VERIFIED: `node_modules/@earendil-works/pi-coding-agent/package.json`, `dist/core/session-manager.d.ts:178`] |
| `pi-subagents` | 0.87.0 floor, 0.88.1 in the suite | `PI_SUBAGENT_PARENT_SESSION`, the child header's `parentSession` | [VERIFIED: both sources read] |
| `node:test`, `@cucumber/cucumber` ^13.3.0 | as installed | owner tests and scenarios | [VERIFIED: `package.json`] |

**Alternatives considered:** none; the stack is fixed by the project.

## Package Legitimacy Audit

No package is installed by this phase. `pi-subagents@0.87.0` was downloaded with `npm pack` into the scratchpad only to read its source; it is the project's declared optional peer (`package.json`), not a new dependency.

## Upstream evidence records (Claude Code 2.1.323)

Binary: `/home/linuxbrew/.linuxbrew/Caskroom/claude-code@latest/2.1.323/claude`, read with fixed-string `grep -a -b -o` and byte-offset windows on 2026-11-14. Docs: <https://code.claude.com/docs/en/hooks.md>, downloaded the same day (293,539 bytes). Minified names are given so a later reader can find the code again; they change between releases.

| # | Question | What the source says | Confidence |
| --- | --- | --- | --- |
| U1 | Tool event schemas | `PreToolUse`: `{tool_name, tool_input, tool_use_id: string, mcp_server?}`. `PostToolUse` adds `tool_response`, `duration_ms?` ("Tool execution time in milliseconds. Excludes permission-prompt and hook time."), `mcp_server?`. `PostToolUseFailure`: `{tool_name, tool_input, tool_use_id, error, is_interrupt?, duration_ms?, mcp_server?}`. Offset 300,945,6xx. | HIGH |
| U2 | Base builder | `Hm(session, cwd, permissionMode, ctx)` at offset 312,854,6xx: `y = ctx?.options?.mainLoopModel`; `effort = y && ctx?.getAppState && lS(y) ? {level: NO(y, …)} : undefined`; returns `{session_id: e.id, transcript_path: Np(e.id), cwd, scratchpad_dir, prompt_id, permission_mode: r, agent_id: ctx?.agentId, agent_type, effort}`. `lS` is "the model supports effort". | HIGH |
| U3 | Callers of the base builder, per bridged event | Full tool-use context (so `effort` can appear): `PreToolUse` `Hm(s.session,G_(),h,s)`, `PostToolUse` `Hm(h.session,G_(),y,h)`, `PostToolUseFailure` `Hm(h.session,G_(),k,h)`, `Stop` `Hm(y.session,G_(),e,y)`, `StopFailure` `Hm(n.session,G_(),void 0,n)`. No model in the fourth argument: `UserPromptSubmit` (`gHt`: `Hm(r.session,G_(),n,{agentId,agentType})`; `hHt`: `Hm(e,G_(),s,v)` whose callers pass nothing or `{agentId, agentType}`), `UserPromptExpansion` (`{agentId, agentType}`), `SessionStart` (`Hm(Ae,G_(),void 0,{agentId})`), `PreCompact` and `PostCompact` (`void 0, {agentId, agentType}`), `SessionEnd` (`Hm(e,G_())`). The third argument shows `permission_mode` too: `void 0` on `SessionStart`, `SessionEnd`, `PreCompact`, `PostCompact`, `StopFailure`. | HIGH |
| U4 | `mcp_server` builder | `_ce(toolName, ctx)`: `let r = pn(ctx.options.tools, toolName)?.mcpInfo; return r ? {mcp_server: r$r(r)} : {}`. `r$r(e) = {name: e.serverName, source: e.source ?? (e.pluginTelemetry !== undefined \|\| d(e.serverName, e.scope ?? "dynamic") ? "plugin" : e.serverType === "sdk" ? "sdk" : e.scope ?? "dynamic")}`. A tool's `mcpInfo` is built with `serverName: <config key>`, `scope: config.scope`, `source: P$(name, config)`, and `P$` returns `"plugin"` when `config.pluginSource !== undefined`, else `config.scope`. Schema text: "`name` is the server's config key … the key as authored in that configuration". | HIGH |
| U5 | Plugin server key | `efs(servers, pluginName, pluginSource, pluginPath)`: `` q = `plugin:${_2(pluginName, pluginSource)}:${serverKey}` `` with `{...config, scope: "dynamic", pluginSource, pluginPath}`. `_2(e, n)` returns `e` unless `n` ends with `@builtin`. The built-in plugin constants agree: `"plugin:claude-test:browser"` beside `"mcp__plugin_claude-test_browser__"`. A user or project server keeps its authored name and gets `source` `user`, `project`, or `local`. | HIGH |
| U6 | `UserPromptExpansion` runner | `$t(command, args, ctx)`: the prompt `n` is ``/${command.name} ${args}`` when there are arguments and ``/${command.name}`` when there are none; calls `zgs(command.source === "mcp" ? "mcp_prompt" : "slash_command", command.name, args, command.source, n, mode, ctx)`. A blocking result renders `UserPromptExpansion operation blocked by hook:\n<error>` and, unless `suppressOriginalPrompt`, `\n\nOriginal prompt: <n>`. `preventContinuation` renders `Operation stopped by hook: <stopReason>` or `Operation stopped by hook`. `additionalContexts` become a `hook_additional_context` attachment. Timeout `Uu` = 600,000 ms (`UserPromptSubmit` uses `Ovs` = 30,000). Matcher target: `Men`: `case "UserPromptExpansion": return e.command_name`. | HIGH |
| U7 | Order against `UserPromptSubmit` | In the slash-command dispatcher (`to`, case `"prompt"`): `if (!fork && await ge?.() === false) return …"cmd_prompt_submit_hook_blocked"`; then `T = await $t(…)`; then, only for a fork-context command, `executeUserPromptSubmitHooks`. Docs, `UserPromptSubmit`: "When the prompt is a skill or custom command you typed, such as `/deploy staging`, the hook receives that line as you typed it … If the hook blocks the prompt, the command doesn't run … To match on the command's name or arguments instead, use UserPromptExpansion." | HIGH (docs); MEDIUM for `ge` being the prompt check (named by its telemetry outcome) |
| U8 | Schemas | `UserPromptExpansion`: `{expansion_type: "slash_command" \| "mcp_prompt", command_name: string, command_args: string, command_source?: string, prompt: string}`. `SessionStart`: `{source: startup\|resume\|clear\|compact\|fork, agent_type?, model?, session_title?, …four resume cost fields}`. `PreCompact`: `{trigger, custom_instructions: string \| null}` (required, nullable). `UserPromptSubmit`: `{prompt, source?, session_title?}`; both builders send `session_title: z_(session.id)`. Command sources seen on prompt commands: `source:"plugin"` (plugin commands and skills), `"projectSettings"` (project `.claude/commands`), `"userSettings"`, `"policySettings"`, `"bundled"`, `"builtin"`, `"mcp"`. | HIGH |
| U9 | Docs wording | `effort`: quoted in F1. `session_title`: "The session's custom title, present when one is set"; "UserPromptSubmit hooks also receive `session_title` when the session has a custom title". `model`: "It can be omitted". `fork`: "`--fork-session` with `--resume` or `--continue`, the `/fork` background copy, `/branch`". `resume`: "`--resume`, `--continue`, or `/resume`". Matchers: only letters, digits, `_`, `-`, spaces, `,`, `\|` is an exact list; anything else is an unanchored regular expression. Plain stdout is context on "`UserPromptSubmit`, `UserPromptExpansion`, `SessionStart`". A `UserPromptExpansion` block "end[s] the turn … regardless of `continue`". | HIGH |

Consequence for matchers: `demo:deploy` holds `:`, so it is a regular expression, unanchored, tested against `command_name`. It matches `demo:deploy` and also `demo:deploy-all`. `claude-security`'s `^claude-security:claude-security$` is anchored. A bare `deploy` is an exact name.

## Pi and companion evidence

| # | Question | What the source says | Where |
| --- | --- | --- | --- |
| P1 | What `reason` does a launch report? | `this._sessionStartEvent = config.sessionStartEvent ?? { type: "session_start", reason: "startup" }`. `main.js` builds the first runtime with `sessionStartEvent === undefined` (`isInitialRuntime`). `resume`, `new`, and `fork` come only from `agent-session-runtime.js` (in-session switch, new, fork). **So `--continue`, `--session`, `--resume`, and `--fork` launches report `startup`.** Same lines in Pi 1.5.2. | `dist/core/agent-session.js:209`, `:2698`; `dist/main.js:599-600`; `dist/core/agent-session-runtime.js:141-291`. [VERIFIED: files read; not run] |
| P2 | Are entries loaded at `session_start`? | `createSessionManager` runs before the runtime is built. `SessionManager.open`, `continueRecent`, and `forkFrom` construct the manager, whose constructor loads the file synchronously (`_setSessionFile` → `loadEntriesFromFile` → `_loadEntries`). `createAgentSession` then appends `model_change` and `thinking_level_change` for a session with no messages (`sdk.js:292-303`), and `--name` appends `session_info` (`main.js:585`), all before `emit(session_start)`. `getEntries()` returns every entry but the header. | `dist/main.js:285-352`, `:563`; `dist/core/session-manager.js:645-690`, `:1119-1121`, `:1338-1375`; `dist/core/sdk.js:84-85`, `:292-303`. [VERIFIED: files read; not run] |
| P3 | Fork header | `forkFrom` writes a new file whose header has `parentSession: <source path>`, a new id, and `timestamp: new Date().toISOString()`, then copies every entry. The header is read back on every later open, so `parentSession` stays. `--session <id of another project>` also forks after a confirm prompt. `--continue` with no session creates a new one. | `dist/core/session-manager.js:1386-1424`; `dist/main.js:308-342` |
| P4 | Tool event order | `tool_execution_start` is emitted before `prepareToolCall`, which runs `beforeToolCall` (the extension `tool_call` handlers). `executePreparedToolCall` times `execute()` with `performance.now()`. `afterToolCall` (the extension `tool_result` handlers) runs next and does not receive the duration. `tool_execution_end` carries `durationMs` last. | `node_modules/@earendil-works/pi-agent-core/dist/agent-loop.js:381-405`, `:574-600`, `:602-646`, `:652-660` |
| P5 | Parallel batches | `executeToolCallsParallel` prepares every call in a loop (each `tool_call` handler in turn), pushes a deferred function per call, and only then runs them with `Promise.all`. A blocked or failed preparation is `immediate`: no `execute`, no `afterToolCall`, so no `tool_result` event. | `agent-loop.js:415-462`, `:487-548` |
| P6 | `input` handler order | `emitInput` walks the extensions in load order and each extension's handlers in registration order; `handled` returns at once; `transform` replaces the text the later handlers see. Pi checks extension commands first, then raises `input`, then expands `/skill:<name>`, then prompt templates. `pi.getCommands()` lists a template as `{name, source: "prompt"}` and a skill as `{name: "skill:<name>", source: "skill"}`, each with `sourceInfo.scope` `"user" \| "project" \| "temporary"`. | `dist/core/extensions/runner.js:1201-1236`; `dist/core/agent-session.js:1654-1681`, `:1745-1767`, `:2766-2780`; `dist/core/source-info.d.ts:2-11`; `docs/extensions.md:1110-1120` |
| P7 | Thinking levels | `export type ThinkingLevel = "off" \| "minimal" \| "low" \| "medium" \| "high" \| "xhigh" \| "max";` `setThinkingLevel` clamps to the model's available levels. The harness model is a faux model with `reasoning: false` by default, so its level is `off`. | `node_modules/@earendil-works/pi-agent-core/dist/types.d.ts:300`; `dist/core/agent-session.js:2132-2151`; `node_modules/@earendil-works/pi-ai/dist/providers/faux.js:334,347` |
| P8 | Other fields | `SessionBeforeCompactEvent.customInstructions?: string`; `ctx.model: Model<any> \| undefined`; `ReadonlySessionManager` includes `getHeader`, `getEntries`, `getSessionName`; `ToolCallEvent.toolCallId` and `ToolResultEvent.toolCallId` ("`<parent id>/<n>` for nested calls"). RPC has `set_thinking_level`, `set_session_name`, and `compact` with `customInstructions`. CLI flags: `--continue`/`-c`, `--resume`/`-r`, `--session`, `--fork`, `--session-dir`, `--name`, `--no-session`. | `dist/core/extensions/types.d.ts:594-600`, `:620-629`, `:929-949`, `:950-961`, `:1004-1020`; `dist/core/session-manager.d.ts:178`; `dist/modes/rpc/rpc-mode.js:388,417,523`; `dist/cli/args.js:57-99` |
| S1 | The variable | `export const SUBAGENT_PARENT_SESSION_ENV = "PI_SUBAGENT_PARENT_SESSION";` with the comment "Root parent session id the parent publishes for pi-permission-system ask forwarding." The runner environment is `{...omitGitRoutingEnv(omitExtensionBindingsEnv(process.env)), …}`, then `runnerEnv[SUBAGENT_PARENT_SESSION_ENV] = launchParentSessionId` (or deleted when undefined). | pi-subagents 0.88.1 and 0.87.0: `src/runs/shared/child-runtime-config.js:13-14`, `src/runs/background/async-execution.js:543-555` |
| S2 | Its value | `const launchParentSessionId = ctx.parentSessionId ?? ctx.currentSessionId;` The launch context is built with `parentSessionId: input.ctx.sessionManager.getSessionId() ?? undefined`, `parentSessionFile: input.ctx.sessionManager.getSessionFile() ?? undefined`, and `currentSessionId: resolveCurrentSessionId(…)`, which is `sessionManager.getSessionFile() ?? sessionManager.getSessionId()`. | `async-execution.js:781,1273,1960`; `src/runs/foreground/subagent-executor.js:1060-1062` (0.88.1), `:1060-1061` (0.87.0); `src/shared/session-identity.js:2-7` |
| S3 | The header | `const newSessionOptions = launch.parentSessionFile ? { parentSession: launch.parentSessionFile } : undefined;` and, for a new file opened by path, `header.parentSession = launch.parentSessionFile`. "Forked and resumed files keep theirs." The field has been written since 0.77.0. | 0.88.1 `src/runs/shared/child-session.js:529-542`; 0.87.0 `:553-566`; `CHANGELOG.md` (0.77.0) |
| S4 | Nested children | A child session gets a `subagent` tool from `src/extension/fanout-child.js`, which builds the same executor. Its launch context reads `input.ctx.sessionManager`, the **child's** session. So a background child of a child gets the intermediate child's id and file. The ambient pi-subagents extension registers nothing in a child (`index.js:5`); a root host deletes the variable on each `session_start` and "Dedicated child runners retain their launch-owned value". | `src/extension/fanout-child.js:193-224`; `src/extension/index.js:924-929` (0.88.1) |
| S5 | What a grandchild inherits | The runner environment copies the launching process's `process.env` except git routing variables and `PI_SUBAGENT_EXTENSION_BINDINGS`. So a variable this extension sets in a child process reaches that child's own background children. | `src/runs/shared/git-environment.js:25-27`, `src/runs/shared/extension-bindings.js:79-82` |

A foreground child loads no ambient extension, so no plugin hook runs in it (`docs/hooks-compatibility.md:69`). Decision 26 concerns background children only, and a nested child is a background child of a background child.

## Architecture Patterns

### System data flow

```text
user line ─► Pi prompt()
              │ extension command? ─► runs, no input event
              ▼
        Pi "input" event (handlers of this extension, in registration order)
              │
   1. hooks bridge: UserPromptSubmit ──block/stop──► handled (nothing below runs)
              │ continue
   2. hooks bridge: UserPromptExpansion   ◄── NEW; needs resolver(text) from index.ts
              │   not a typed template/skill, or source "extension" ─► continue
              │   block / continue:false ─► one hook-notice, handled
              │   context ─► same buffer as UserPromptSubmit (cap D-PG5-14)
              ▼
   3. background update ─► 4. skill aliases (may rewrite) ─► 5. command invocation
              ▼
        Pi expands /skill: and templates ─► before_agent_start (drains context)

tool call ─► tool_execution_start ─► "tool_call" (PreToolUse; mark at handler end)
          ─► execute ─► "tool_result" (PostToolUse / Failure; duration from mark)
          ─► tool_execution_end (Pi's durationMs: too late)

session_start(reason) ─► startup + parentSession made now ─► fork
                         startup + message entries        ─► resume
                         startup otherwise                ─► startup
                         new/resume/fork (in session)     ─► clear/resume/fork (as today)

child process (PI_SUBAGENT_CHILD=1)
   root pair = published pair of an ancestor child
             | (PI_SUBAGENT_PARENT_SESSION, own header.parentSession)
             | none ─► own session, one debug line
   hook stdin session_id / transcript_path / CLAUDE_CODE_SESSION_ID ◄─ root pair
   env file key, journals, PID tables, identity guard                ◄─ own session id
```

### Code map

#### Decision 26: who reads `TranslationContext.sessionId` today (D-PG6-03)

| Consumer | Site | Side after the phase |
| --- | --- | --- |
| stdin `session_id` and `transcript_path` | all ten `bridges/hooks/payloads/*.ts` | Root in a child |
| `CLAUDE_CODE_SESSION_ID`, `CLAUDE_SESSION_ID` of a hook | `hook-env.ts:94` (`claudeSessionEnvFor(transCtx.sessionId)`) | Root in a child |
| `CLAUDE_ENV_FILE` path | `hook-env.ts:98` (`claude-env-${transCtx.sessionId}.env`) | Own session (D-60-06). `SessionStart` only, which a child does not run. |
| Child journal owner | `async-rewake/registry.ts:365` (`runtime.persistenceOwner(loc, transCtx.sessionId, dispatchId)`) | Own session (D-PG3-05) |
| Identity guard in the factory | `translation-context.ts:74` (`childIdentity?.sessionId === sessionId`) | Own session |
| `agent_id` | `payloads/pre-tool-use.ts:44-46` (`ctx.childIdentity.sessionId`) | Own session |
| `agent_type` / `agent_id` guards on the result events | `payloads/post-tool-use.ts:115`, `post-tool-use-failure.ts:183` (`ctx.childIdentity?.sessionId === ctx.sessionId`) | **Breaks if `ctx.sessionId` becomes the root.** Change both to the presence test `pre-tool-use.ts` uses. |
| Identity lookup | `dispatch-exec.ts:222`, `registry.ts:357`, `event-router.ts:279` (`ctx.sessionManager.getSessionId()` directly) | Own session, untouched |
| `session_start` dedupe key | `event-router.ts:1186` | Own session, untouched |
| Bash-tool environment | `index.ts:270-276` (`applySessionEnv`) | Own session (F12) |
| `${CLAUDE_SESSION_ID}` in skill and command bodies | `edge/command-tool.ts:118`, `edge/skill-aliases.ts:195`, `edge/command-invocation.ts:60`, `edge/skill-read.ts:70` | Own session; not a hook field. `skill-read` and `command-tool` can run in a child. |

Recommended shape: keep `sessionId` and `transcriptPath` as the hook-facing fields the translators already read, and add `ownSessionId` for the three internal consumers. `HookEnvContext` (`hook-env.ts:22-25`) gets both. Then no translator changes for decision 26 except the two guards.

#### PG-HOOK-04: fields

| Field | Source | Seam |
| --- | --- | --- |
| `tool_use_id` | `event.toolCallId` (both Pi events carry it) | The three tool translators. Pair copies are built at `dispatch.ts` `runEditPreflight` (`pairEvent = {...view.event, input: pair.input}`) and `runEditResultPairs` (`{...event, input}`); both keep the native `toolCallId`. Nothing else in the extension reads `toolCallId`, so the pair copy can carry the suffixed id. A batch of one pair keeps the bare id. |
| `duration_ms` | bridge marks (F5) | `runtime.ts` (marks), the `tool_call` registration in `event-router.ts:1291-1296` (set the mark in a `finally`), `toolResultCompositeHandler` (`dispatch.ts:1218`). The mark is also needed when the `PreToolUse` bucket is empty: the composite handler returns early at `dispatch.ts:988-991`. Marks of calls that never reach `tool_result` are cleared in the existing `agent_end` handler. |
| `mcp_server` | a table from installed records | `McpToolIdentity` gives `builtinServer` (the registered name, `plugin_<plugin>_<server>`) under Pi's built-in MCP and the Pi tool name under pi-mcp-adapter. The name cannot be split back into plugin and server. Build a table in the hydrate that already loads each scope's state (`hydrateCacheFromDisk`, `hydrateProjectScopeForCwdWith`): for each record and each `mcpServerConfigs[].name`, key `builtinMcpServerName(plugin, name)` and `generatedMcpServerKey(plugin, name)` to `{ name: mcpServerDisplayName(plugin, name), source: "plugin" }`. A record without `mcpServerConfigs` (it predates the field) gives no entry, so the field is left out. The table is as fresh as the registrations: both change on a load. |
| `custom_instructions` | `event.customInstructions ?? null`; `null` for a non-manual reason | `payloads/pre-compact.ts` |
| `model`, `session_title` | `ctx.model?.id`, `ctx.sessionManager.getSessionName()` | `payloads/session-start.ts`, `user-prompt-submit.ts` (title only). Both need the values in `TranslationContext` or as an argument; `buildTranslationContext` has `ctx`. |
| `effort` | `pi.getThinkingLevel()` at dispatch | `dispatchHookExec` has `pi` (optional). Put the mapped level into the context so the five translators stay pure. |
| `permission_mode` | not sent (D-PG6-11) | docs only |

The header of `translation-context.ts` says new common fields need every translator extended in lockstep (PAYL-01). The architecture test `test/architecture/hooks-translators.test.ts` pins one translator module per dispatchable event.

#### PG-HOOK-06: admission and dispatch

Adding `"UserPromptExpansion"` to `ClaudeHookEvent` (`shared/concerns/hooks.ts:57-67`) and `ADMITTED_EVENT_NAMES` (`hook-events.ts:49-60`) makes these fail to compile until each answers, which is the intended forcing:

- `NON_TOOL_EVENT_FIELDS` (`hook-events.ts:189-197`): the field is `command_name`, but the matcher is not a closed set. `partition.ts:48-73` knows two kinds of non-tool matcher: `null` (ignored) and closed set. The event needs a third kind: an exact name list or a regular expression, with `invalid-pattern` dropping the group as `cond: "regex"`.
- `parseMatcher` (`matcher.ts:58-99`) maps exact-list members to Pi tool names and returns `unmapped` otherwise. A command name is not a tool, so the event needs a name-list parse beside it (same `SAFE_MATCHER_CHARS` split, no tool map).
- `pushGroupHandlers` (`event-router.ts:426-428`) parses the matcher per event.
- `CHILD_EVENT_POLICY` (`event-router.ts:140-151`): `"suppress"`.
- `TRANSLATORS` and `REQUIRED_EVENT_FIELDS` (`dispatch-exec.ts:139`, `:326`), `TRANSLATORS` (`async-rewake/registry.ts:146`), `MATCH_FIELDS` (`async-rewake/rewake-text.ts:17`), `BLOCKING_EVENT_DEFAULT_SECONDS` (`timeout.ts:68`; upstream default 600 s, so `undefined`).
- `PLAIN_STDOUT_CONTEXT_EVENTS` (`wire-protocol.ts:48-52`): add the event (U9).
- `CompositeDispatchEvent`, `matchValue`, `entryFires`, `noticeLabel`, `adaptForEvent` (`dispatch.ts:912-915`, `:1396-1411`, `:1500-1527`, `:1323-1347`), and the notice sets `showsSystemMessages` and `showsFailures`.
- `hook-labels.ts`: a block text beside `promptBlockedText`; `promptStoppedText` already has upstream's stop text.
- `info` and install: `domain/components/hooks.ts` and `partition.ts` report a dropped event as `<event> (unsupported)`; with the event admitted, no code names it as unsupported. No test, feature, or source file names `UserPromptExpansion` today; only `docs/hooks-compatibility.md:96` and `:174` do. An install made before the change dropped the group; `update` or `reinstall` restores it (D-CF5-08 pattern, BACKLOG HOOKHEAL-01 is the reconcile route).

The typed-line resolver answers, for a line and Pi's commands: is it a template (`source: "prompt"`, name equals the token), a skill (`/skill:<name>`), or an alias the table of `orchestrators/skill-alias-state.ts` resolves; the Claude-form name; the arguments; the source. The Claude-form name of a bridged item is its `<plugin>:<name>` name: a skill's stored names (`readSkillRecord`, `installedForms`) and a command's `frontmatterNameAliases` already produce it for the alias table, which maps alias to Pi name. The resolver needs the reverse lookup (Pi name to the `<plugin>:` name) for a line typed as `/skill:<generated>` or `/<generated command>`.

Registration: the bridge registers at `index.ts:153`; `registerSkillAliases` at `:324`; `registerCommandInvocation` at `:327`. The gate `test/architecture/hooks-lifecycle.test.ts:385-401` pins thirteen registrations and their order; it becomes fourteen with a second `input` after the first.

#### PG-HOOK-11: launch detection

`claudeSessionStartSource` (`payloads/session-start.ts:34-47`) takes Pi's reason. It needs two more facts for `startup`: whether the session holds a message entry and whether the header's `parentSession` was written by this launch. The `session_start` handler (`event-router.ts:1165-1236`) has `ctx.sessionManager`. `SESSION_START_SOURCES` already holds `resume` and `fork`, so matchers on them are admitted today. The dedupe key keeps Pi's raw reason and is unaffected.

### Pattern 1: root session of a child (recommended, pending maintainer review)

**What:** resolve once per child session, when the child identity is captured, and keep it with the identity.

```ts
// Source: this research (F3, F4); names are the planner's.
// In a pi-subagents child only (isSubagentChild(env)):
//   1. An ancestor child published a root: use it.
//   2. Else the launcher is the root:
//        id   = env.PI_SUBAGENT_PARENT_SESSION        (reject a value with a path separator)
//        path = ctx.sessionManager.getHeader()?.parentSession ?? ""
//        when the file's first line parses as a session header, require header.id === id
//   3. Else: own session, and one debug line.
// Then publish the resolved pair in this extension's two variables on process.env,
// so a background child this child launches inherits it.
// In a process that is not a child: delete both variables at load.
```

**When to use:** only for the hook-facing fields. A parent started with `--no-session` has no file, so the path is `""`, as a main session's is today (D-CF5-07).

### Pattern 2: duration marks

```ts
// Source: this research (F5), from agent-loop.js order.
// tool_call handler, in a finally:   marks.set(event.toolCallId, now)
//                                    if (event.parentToolCallId === undefined) lastTopLevel = now
// tool_result handler, on entry:     const own = marks.get(id); marks.delete(id)
//                                    duration_ms = own === undefined ? omit
//                                                : Math.round(now - Math.max(own, lastTopLevel))
// agent_end handler:                 marks.clear()
```

A nested call starts after every top-level preparation, so `max` gives its own mark. A top-level call in a parallel batch gets the batch's last preparation. Edit pairs of one call share the call's value.

### Anti-Patterns to Avoid

- **Changing `ctx.sessionId` to the root and leaving the internal keys on it.** Two children of one parent would share a journal owner and an env file.
- **Reading `getEntries().length > 0` for `resume`.** A new session has two or three entries at `session_start` (F7).
- **Walking `parentSession` headers to a file with none.** A forked user session has one (F3).
- **Timing from `tool_execution_start`.** It includes the `PreToolUse` hooks (F5).
- **Running the expansion hooks inside `skill-aliases.ts` and `command-invocation.ts`.** A command alias passes both handlers, so the hooks would run twice for one line.
- **Parsing `process.argv` for `--continue`.** HOOKLAUNCH-01 and D-PG6-14 forbid it, and RPC session switches do not pass through it.
- **A planted-violation test for a gate.** The gate's run over the real tree is its proof (CONVENTIONS.md).

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
| --- | --- | --- | --- |
| The plugin server name | a new string builder | `mcpServerDisplayName`, `builtinMcpServerName`, `generatedMcpServerKey` in `domain/name.ts` | One normalization exists; `info` already shows the display name. |
| Claude-form names of bridged skills and commands | a second name rule | `readSkillRecord`, `frontmatterNameAliases` (`bridges/skills/skill-names.ts`), the table of `orchestrators/skill-alias-state.ts` | Install stored upstream's names. |
| The effort mapping | a second level table | extend or sit beside `claudeEffort` (`domain/argument-substitution.ts`) | One list of Claude levels. |
| The context cap | a new limit | `context-cap.ts`, `hook-output-files.ts` (D-PG5-14) | Both lanes already call it. |
| The stop text | a new sentence | `promptStoppedText` (`hook-labels.ts`) | Upstream's text is the same on both prompt events. |
| Reading a session header | a JSON-lines parser | read the first line and `JSON.parse` it, as `features/lib/real-subagent-child.ts` `sessionIdOf` and pi-subagents `resolvePiSessionId` do | Pi exports no header reader to extensions for another file. |
| A saved session for scenarios | a hand-written entry format, if avoidable | let a first hermetic Pi write the session, then start the second with `--continue` | The entry shape is Pi's (version 3) and may change. |

**Key insight:** every new field has one upstream builder; copy its condition, not its neighbors'.

## Runtime State Inventory

The phase renames nothing and migrates nothing. For completeness:

| Category | Items found | Action required |
| --- | --- | --- |
| Stored data | Installed plugins whose `UserPromptExpansion` groups were dropped at install (the staged `hooks.json` copy and the record's notes) | None in code. `update` or `reinstall` restores them (D-PG6-21). |
| Live service config | None. Verified: the phase adds no service. | None |
| OS-registered state | None. Verified: no unit, task, or launch agent is involved. | None |
| Secrets and env vars | Two new variables of this extension in a child process if Pattern 1 is accepted; `CLAUDE_CODE_SESSION_ID` and `CLAUDE_SESSION_ID` of a child's hooks change value | Document in `docs/env-vars.md` if the variables land |
| Build artifacts | None. Verified: no build step. | None |

## Common Pitfalls

### Pitfall 1: the result-event guards drop `agent_id`

**What goes wrong:** `PostToolUse` and `PostToolUseFailure` lose `agent_type` and `agent_id` in a child.
**Why:** `post-tool-use.ts:115` and `post-tool-use-failure.ts:183` compare `childIdentity.sessionId` with `ctx.sessionId`, which becomes the root.
**How to avoid:** use the presence test of `pre-tool-use.ts:44`; the factory already applies the own-session guard.
**Warning signs:** the real-child scenario's result rows lose two columns.

### Pitfall 2: a mark that is never set, or never removed

**What goes wrong:** `duration_ms` is missing whenever the `PreToolUse` bucket is empty, or the mark map grows.
**Why:** the composite handler returns early for an empty bucket; a blocked call raises no `tool_result` (P5).
**How to avoid:** set the mark in the registration wrapper's `finally`, and clear on `agent_end`.

### Pitfall 3: edit pairs after an input rewrite

**What goes wrong:** pair `n` of the `PreToolUse` run and pair `n` of the `PostToolUse` run are different edits.
**Why:** an accepted `updatedInput` replaces the native input (`replaceToolCallInput`), and the result event carries the rewritten `edits`.
**How to avoid:** state in the page that the pair index follows the input each event carries. The ids stay unique per call and index.

### Pitfall 4: `resume` on every launch, or never

**What goes wrong:** every new session reports `resume`, or a continued session reports `startup`.
**Why:** counting all entries (F7), or a saved-session fixture that holds only a header. The existing `Given` writes a header only (`session-end.steps.ts:63-80`) and puts the file directly under `sessions/`, where `--continue` does not look by default (it reads the directory for the working directory, or `--session-dir` filtered by the header's `cwd`).
**How to avoid:** the fixture holds a user and an assistant message; the launcher passes `--session-dir` or the fixture lies in the default directory. The spike fixes which.

### Pitfall 5: `fork` reported for an old fork

Covered by F8. The spike's third case is the guard.

### Pitfall 6: the expansion handler runs for input it should not see

**What goes wrong:** hooks run for `sendUserMessage`, for `run_plugin_command`, or for a line that an alias handler already rewrote.
**Why:** `source: "extension"` input passes the same event; a `transform` changes the text for later handlers.
**How to avoid:** return `continue` for `source === "extension"` first, as both edge handlers do; register before the alias handler so the text is the typed line.

### Pitfall 7: a `handled` result skips the later handlers

**What goes wrong:** the Stop reset handler and the background-update handler do not run for a blocked expansion.
**Why:** Pi returns at the first `handled` (P6).
**How to avoid:** nothing to change; a blocked `UserPromptSubmit` behaves the same today. Do not move the reset handler without a scenario.

### Pitfall 8: the alias table is not loaded yet

**What goes wrong:** the first typed alias after a session start runs no expansion hook.
**Why:** the table loads asynchronously and is cached per session in `registerSkillAliases`' closure.
**How to avoid:** the resolver awaits the same load (the handler is async); share one cache, do not add a second.

### Pitfall 9: gates that pin the old shape

`test/architecture/hooks-lifecycle.test.ts` (thirteen registrations), `hooks-translators.test.ts` (one translator per event), `hooks-foundation.test.ts`, `closed-set-enrollment.test.ts`, and the type-member pins (`lint:type-members`; format before repinning). Each fails for the right reason; change them in the same plan as the code.

### Pitfall 10: about 170 tables change at once

**What goes wrong:** a plan that adds a field and "fixes the literals" touches fifteen feature files and collides with every parallel plan.
**Why:** `recordTable` adds every stdin field as a column, so each table that holds a tool event grows `tool use id` and often `duration ms`; each `SessionStart` table grows `model`.
**How to avoid:** one plan owns the projection and the literal sweep per field group, run serially; the columns appear only for rows that have the field (an absent field is an empty cell in a mixed table).

### Pitfall 11: the scripted model has no thinking level

**What goes wrong:** the `effort` scenario cannot set `high`; Pi clamps to `off`.
**Why:** the faux model's `reasoning` is `false` (P7).
**How to avoid:** a profile option that registers a reasoning-capable faux model; existing scenarios keep `off` and so gain no `effort` column.

### Pitfall 12: the real-child fixture has no parent file

**What goes wrong:** the criterion 6 scenario shows an empty `transcript path` and proves only the id.
**Why:** the main Pi of `features/lib/real-subagent-child.ts` starts through `PiProcess.start`, which passes `--no-session`.
**How to avoid:** give that main Pi the saved-session launch option, so `parentSession` exists.

## Code Examples

### Hook-facing and own session in the context

```ts
// Source: bridges/hooks/translation-context.ts:40-45 (today) plus D-PG6-01..03.
export interface TranslationContext {
  readonly sessionId: string; // hook-facing: the root main session in a child
  readonly transcriptPath: string; // hook-facing: the root's session file, or ""
  readonly ownSessionId: string; // every internal key (D-60-06, D-PG3-05)
  readonly cwd: string;
  readonly childIdentity?: ChildHookIdentity;
}
```

### `mcp_server`

```ts
// Source: domain/name.ts:616-618 and binary record U4, U5.
// { name: mcpServerDisplayName(plugin, server), source: "plugin" }
// -> { "name": "plugin:demo:stub", "source": "plugin" }
```

### `UserPromptExpansion` stdin

```json
{
  "session_id": "…",
  "transcript_path": "…",
  "cwd": "…",
  "hook_event_name": "UserPromptExpansion",
  "expansion_type": "slash_command",
  "command_name": "demo:deploy",
  "command_args": "staging",
  "command_source": "plugin",
  "prompt": "/demo:deploy staging"
}
```

Field set from record U8 and the docs example. No `effort` (F1) and no `permission_mode` (D-PG6-11).

### Block notice

```text
UserPromptExpansion operation blocked by hook:
<reason, or [<command>]: <stderr> for an exit 2>
```

Source: record U6 and `hook-labels.ts:129-140` (the `UserPromptSubmit` form, without `Original prompt:`).

### Spike S7 (a plan task; do not run in the real home)

```bash
# Source: this research; record the output in the spike's SUMMARY.
ROOT="$(mktemp -d)"; export HOME="$ROOT/home" PI_CODING_AGENT_DIR="$ROOT/agent" PI_OFFLINE=1
mkdir -p "$HOME" "$PI_CODING_AGENT_DIR" "$ROOT/project"; cd "$ROOT/project"
PI="node <repo>/node_modules/@earendil-works/pi-coding-agent/dist/cli.js"
# probe.ts: on session_start, print JSON { reason, id, file, header: getHeader(),
#   entryTypes: getEntries().map(e => e.type), name: getSessionName() } to stderr.
# model: the harness scripted model, so no network and no key.
# 1. new session, one prompt (writes the file):   $PI --mode json --extension probe.ts --extension <scripted model> … "hi"
# 2. $PI --continue …                 expect: reason startup, entryTypes holds "message"
# 3. $PI --session <file from 1> …    expect: same
# 4. $PI --fork <file from 1> …       expect: reason startup, header.parentSession = file 1, header.timestamp >= start
# 5. $PI --continue … (after 4)       expect: header.parentSession still set, timestamp older than this launch
# 6. $PI … (no flag)                  expect: entryTypes = ["model_change","thinking_level_change"], no "message"
# 7. $PI --continue in an empty dir   expect: as 6
# Repeat 2 to 6 with Pi 1.5.2 if it is installed, with the same temp HOME.
rm -rf "$ROOT"
```

Predictions are from records P1 to P3 and are **not verified by a run**.

### Scenario seeds

- "A hook sees one tool use id before and after a call, and another on the next call" (`features/hook/tool-use.feature`).
- "A typed plugin command that an expansion hook blocks reaches no model" and "An expansion hook records a typed template and a typed skill" (new `features/hook/prompt-expansion.feature`, or `prompt-commands.feature`).
- "A continued session starts with source resume" (`features/hook/session.feature`).
- "A real background child's tool hook names the main session" (`features/plugin/subagent-child.feature:540`, changed literal).

## State of the Art

| Old approach | Current approach | When changed | Impact |
| --- | --- | --- | --- |
| `mcp_server` as a string (PRD research wording) | an object `{name, source}` | Claude Code 2.1.274 | D-PG6-07 |
| `tool_use_id`, `duration_ms`, `mcp_server` not sent (D-CF5-28, D-BG-403) | sent (D-PG6-04) | this phase | HOOKPAYLOAD-01 closes |
| `--continue`, `--resume`, `--fork` send `startup` (D-CF5-06) | `resume`, and `fork` if the spike allows | this phase | HOOKLAUNCH-01 closes |
| `UserPromptExpansion` unsupported ("different pipeline") | supported on Pi's `input` event | this phase | `docs/hooks-compatibility.md:96`, `:174` |

**Outdated in the repository:** the header comment of `translation-context.ts` ("`permission_mode`, `effort` is a v1.14+ scope expansion") and of `post-tool-use-failure.ts` ("`tool_use_id` and `duration_ms` are not sent"); `docs/hooks-compatibility.md:334` and `:124`; the "Child identity" paragraph at `:63`.

## Assumptions Log

| # | Claim | Section | Risk if wrong |
| --- | --- | --- | --- |
| A1 | Pi 1.5.0 behaves at run time as its source reads for `--continue`, `--session`, and `--fork` (reason `startup`, entries loaded, header readable) | F7, F8, P1 to P3 | PG-HOOK-11's detection changes; the spike gates it by design. |
| A2 | The header `timestamp` against `performance.timeOrigin` separates a fork made by this launch from an older fork | F8 | `--fork` keeps `startup` (D-PG6-15's fallback). |
| A3 | `ge` in the binary's dispatcher is the `UserPromptSubmit` check | U7, F9 | None for the order (the docs state it); only the evidence weight. |
| A4 | A Pi template or skill of `temporary` scope has no fitting upstream `command_source` | F10 | A hook that reads the field sees it absent; it is optional upstream. |
| A5 | Publishing two variables in a child process is acceptable under D-PG3-06 ("never process-global child state") because a runner serves one launch | F3, Pattern 1 | Without it a nested child names its immediate parent, or the phase needs another source. Maintainer decides. |
| A6 | A plugin's MCP servers reach Pi only on a load, so a table built at hydrate time is never staler than the tools | Code map, `mcp_server` | A server registered mid-session would send no `mcp_server` until the next load. |
| A7 | The upstream Bash tool in a subagent sees the main session's `CLAUDE_CODE_SESSION_ID` | F12 | None in this phase; it only frames a maintainer question. |
| A8 | A hand-written session file with `message` entries is accepted by Pi 1.5.0 as the spike's file is | Pitfall 4, Don't Hand-Roll | Use a session a first Pi wrote. |

## Open Questions

1. **Does the root reach a child's Bash tool environment? (F12)**
   - What we know: the hook env and the Bash env come from different sites; only the hook env is in D-PG6-01.
   - What's unclear: what upstream's subagent Bash tool sees was not read.
   - Recommendation: leave `applySessionEnv`; record the difference; ask the maintainer.

2. **`mcp_server` for a non-plugin MCP tool (D-PG6-07, second half).**
   - What we know: upstream sends the authored name and the scope. The bridge has the registered server name under the built-in MCP only, and no scope.
   - Recommendation: leave it out in this phase and say so on the page.

3. **Nested children: accept Pattern 1's variables? (F3, A5)**
   - Recommendation: yes, with an owner test for the nested arm (D-PG6-24 already lists one). No real nested-child scenario: it needs a child that launches a background child.

4. **How the saved session of the scenarios is made (D-PG6-16).**
   - What we know: the existing `Given` writes a header only.
   - Recommendation: the spike decides between a `Given` that writes two message entries and a first Pi that writes the file.

5. **`session_title` when Pi's name was set by `--name` on a resumed session.**
   - What we know: `getSessionName()` reads the latest `session_info` entry, so it is present at `session_start`.
   - Recommendation: none needed; one scenario names a session through RPC `set_session_name` and resumes it.

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
| --- | --- | --- | --- | --- |
| Node | everything | Yes | v26.13.1 | CI runs Node 24; errno wording differs between majors |
| Pi (repository copy) | spike, scenarios | Yes | 1.5.0 | none needed |
| Pi (Homebrew) | second spike version | Yes | 1.5.2 | skip the second version and say so |
| pi-subagents suite copy | real-child scenarios | Yes | 0.88.1 under `node_modules/.cache/optional-peers` | `scripts/install-test-peers.mjs` installs it |
| pi-subagents 0.87.0 | source reading only | Read from an `npm pack` in the scratchpad | 0.87.0 | none needed by a plan |
| Claude Code binary | evidence only | Yes | 2.1.323 | the records above |
| Network | none of the plan tasks | Yes | — | not needed |

**Missing dependencies with no fallback:** none.

## Validation Architecture

`workflow.nyquist_validation` is `true` and `workflow.test_command` is `npm run check`. [VERIFIED: `.planning/config.json`]

### Test Framework

| Property | Value |
| --- | --- |
| Framework | `node:test` owner tests; Cucumber 13.3.0 scenarios under the `adapter` and `builtin` profiles |
| Config file | `cucumber.json`; no runner config for `node:test` |
| Owner test | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test <test-path>` |
| One named case | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test --test-name-pattern '<title>' <test-path>` |
| Pair coverage | `npm run test:coverage:direct -- <source-or-test-path>` |
| Feature paths | `npm run test:cucumber:profile -- --profile adapter <feature paths>` (and `--profile builtin` for an `@mcp` scenario) |
| Feature-file check | `npm run check:features` |
| Static gate | `npm run check:static` |
| Full gate | `npm run check` |

### Phase Requirements → Test Map

"Fails without the change" is the direction each check must have (D-PG6-24).

| Req ID | Behavior | Type | Owner (file) | Command | Fails without the change because | File exists? |
| --- | --- | --- | --- | --- | --- | --- |
| PG-HOOK-11 (spike) | Launch reason, entry types, and header under `--continue`, `--session`, `--fork`, a continued fork, and a new session | spike record | the spike's SUMMARY | the commands under "Spike S7" | It is evidence, not a test; the detection plan waits for it | New |
| Decision 26 | The context names the root for stdin and the hook env, and the own id for the env file and the journal owner; no root source gives the own session and one debug line; a nested child takes the published root; a path-shaped variable is refused | unit | `test/bridges/hooks/translation-context.test.ts`, `hook-env.test.ts`, `runtime.test.ts`, `async-rewake/registry.test.ts` | owner test | The context has one session id | Yes, extend |
| Decision 26 | `agent_type` and `agent_id` stay on all three tool events when `session_id` is the root | unit | `test/bridges/hooks/payloads/post-tool-use.test.ts`, `post-tool-use-failure.test.ts`, `pre-tool-use.test.ts` | owner test | The guards compare with `ctx.sessionId` | Yes, extend |
| Decision 26 (criterion 6) | A real background child's tool hook has the main session in `session`, `transcript path`, and `CLAUDE_CODE_SESSION_ID`, and its own id in `agent id` | cucumber | `features/plugin/subagent-child.feature` | feature command | Today `session` equals `agent id` | Scenario exists; literal and fixture change |
| PG-HOOK-04 | `tool_use_id` is `toolCallId`; a nested id passes as it is | unit | the three tool payload tests | owner test | No field | Yes, extend |
| PG-HOOK-04 | A multi-pair edit gives each pair its own id, equal on its two runs; one pair keeps the bare id | unit | `test/bridges/hooks/dispatch.test.ts`, `tool-batch.test.ts` | owner test | Pair copies share the native id and no translator reads it | Yes, extend |
| PG-HOOK-04 (criterion 1) | One call: the same id on `PreToolUse` and `PostToolUse`; a second call: another | cucumber | `features/hook/tool-use.feature` | feature command | No `tool use id` column | Feature exists; scenario new; projection new |
| PG-HOOK-04 | `duration_ms`: mark set with an empty `PreToolUse` bucket; omitted with no mark; `max(own, last top-level)`; a nested call uses its own mark; marks cleared at `agent_end` | unit | `test/bridges/hooks/runtime.test.ts`, `dispatch.test.ts`, `event-router.test.ts` | owner test | No marks | Yes, extend |
| PG-HOOK-04 (criterion 2) | `PostToolUse` and `PostToolUseFailure` carry `duration ms` as the placeholder | cucumber | `features/hook/tool-use.feature`, `tool-failure.feature` | feature command | No column | Scenarios exist; literals change |
| PG-HOOK-04 | The server table: both key forms, a record without `mcpServerConfigs`, a non-plugin tool, a non-MCP tool | unit | `test/bridges/hooks/routing-state.test.ts`, `event-router.test.ts`, payload tests | owner test | No table | Yes, extend |
| PG-HOOK-04 (criterion 2) | A plugin MCP tool's hooks receive `{"name":"plugin:<plugin>:<server>","source":"plugin"}` under both profiles | cucumber (`@mcp`) | `features/hook/mcp-tool-names.feature` or `tool-use.feature` | feature command, both profiles | No column | Scenarios exist; literals change |
| PG-HOOK-04 | `custom_instructions`: the text for a manual compaction with text; `null` with none and for `threshold` and `overflow` | unit | `test/bridges/hooks/payloads/pre-compact.test.ts` | owner test | No field | Yes, extend |
| PG-HOOK-04 (criterion 2) | `/compact` with and without instructions | cucumber | `features/hook/compaction.feature` | feature command | No column | Feature exists; one step gains a text argument |
| PG-HOOK-04 | `model` and `session_title` present and absent; `session_title` on `UserPromptSubmit` | unit | `test/bridges/hooks/payloads/session-start.test.ts`, `user-prompt-submit.test.ts` | owner test | No fields | Yes, extend |
| PG-HOOK-04 (criterion 2) | A named session's `SessionStart` holds the title and the model id | cucumber | `features/hook/session.feature` | feature command | No columns | Feature exists; one step new (names the session) |
| PG-HOOK-04 | `effort` for `low`, `medium`, `high`, `xhigh`, `max`; none for `off`, `minimal`, and on the six events without it | unit | payload tests of the five events; the mapping's owner test | owner test | No field | Yes, extend |
| PG-HOOK-04 (criterion 2) | A tool hook under level `high` receives `{"level":"high"}`; under `minimal` none | cucumber | `features/hook/tool-use.feature` | feature command | No column | Needs the reasoning model option (Wave 0) |
| PG-HOOK-06 | Admission: the event is supported; an exact name list, a regular expression, an invalid pattern (group dropped as `regex`), an empty matcher | unit | `test/domain/components/hooks/partition.test.ts`, `matcher.test.ts`, the `hook-events` owner test | owner test | The event is dropped as `kind: "event"` | Yes, extend |
| PG-HOOK-06 | The translator; the block and stop texts; plain stdout as context; `suppress` in a child | unit | new `test/bridges/hooks/payloads/user-prompt-expansion.test.ts`; `hook-labels.test.ts`, `wire-protocol.test.ts`, `event-router.test.ts` | owner test | No translator | New and extend |
| PG-HOOK-06 | The handler: `extension` input passes; a line that names nothing passes; a block returns `handled` and shows one notice; context is buffered and capped; fourteen registrations in order | unit, gate | `test/bridges/hooks/dispatch.test.ts`, `event-adapters.test.ts`, `event-router.test.ts`, `test/architecture/hooks-lifecycle.test.ts` | owner test, `npm run test:unpaired` | No handler; the gate holds thirteen | Yes, extend |
| PG-HOOK-06 | The resolver: template, `/skill:`, qualified alias, bare alias, non-plugin template and skill of each scope, a name Pi does not list | unit | the resolver's paired test (new), `test/edge/skill-aliases.test.ts` | owner test | No resolver | New |
| PG-HOOK-06 (criterion 3) | Matcher `demo:deploy` blocks `/demo:deploy`: no model call, one notice with the reason | cucumber | `features/hook/prompt-commands.feature` or a new feature | feature command | The group is dropped at install; the command expands | New scenario |
| PG-HOOK-06 (criterion 4) | A non-blocking hook records the five fields for a typed template and a typed skill, and the model receives the expansion | cucumber | same | feature command | No run recorded | New scenario |
| PG-HOOK-06 | `info` shows the event supported; an install no longer needs `--partial` for it | cucumber | `features/plugin/` info or install feature | feature command | The plugin reads `{unsupported hooks}` | New scenario |
| PG-HOOK-11 | The mapping: `startup` with messages is `resume`; `startup` with a fresh `parentSession` is `fork`; an old `parentSession` with messages is `resume`; a new session is `startup` | unit | `test/bridges/hooks/payloads/session-start.test.ts`, `event-router.test.ts` | owner test | `startup` maps to `startup` | Yes, extend |
| PG-HOOK-11 (criterion 5) | `resume` under `--continue` and under `--session <file>`; `startup` in a new session; `fork` under `--fork` if the spike allows | cucumber | `features/hook/session.feature` | feature command | Today `startup` | New scenarios; launcher option new |
| D-PG6-23 | The compatibility page, the catalog, the CHANGELOG | docs | the three files | `pre-commit run --files <files>` | Review only | Exist |

### Sampling Rate

- **Per task commit:** the owner tests and pair coverage of the files the task changes, and the task's feature paths under the `adapter` profile (both profiles for an `@mcp` scenario). The commit hook adds `npm run check:commit`, which does not run cucumber.
- **Per wave merge:** `npm run check` on the combined tree.
- **Phase gate:** `npm run check` green before `/gsd-verify-work`; record the command, exit status, commit, Node version, and scenario counts.

### Wave 0 Gaps

- [ ] Spike S7 recorded (commands, hermetic home, output) before any PG-HOOK-11 detection plan.
- [ ] The projection in `features/step_definitions/hook/runs.steps.ts`: ordinal tokens for `tool_use_id` (first appearance, distinct from `first`…`fourth`) and one token for a non-negative integer `duration_ms`. An edit-pair id projects as the call's token plus its suffix.
- [ ] A launcher option in `piArguments` / `RpcProfile` / `world.ts` that replaces `--no-session` with `--continue`, `--session <file>`, or `--fork <file>`, and its saved-session fixture with message entries.
- [ ] A transcript path that is stable in a table: a saved session's file name holds a timestamp and the id, so the cell needs a projection (the id already projects to its ordinal).
- [ ] A reasoning-capable scripted model option, and steps for RPC `set_thinking_level`, `set_session_name`, and `compact` with instructions.
- [ ] The real-child fixture's main Pi with a saved session.
- [ ] Paired tests for each new source file (the translator, the resolver, any new leaf).
- [ ] No framework install.

## Security Domain

`security_enforcement` is not set in `.planning/config.json`, so it is enabled. This is a local extension that runs plugin hook commands; it has no authentication or session surface of its own.

### Applicable ASVS Categories

| ASVS category | Applies | Standard control |
| --- | --- | --- |
| V2 Authentication | no | none |
| V3 Session Management | no | Pi session ids are identifiers, not credentials |
| V4 Access Control | partly | a `UserPromptExpansion` block is a policy gate: it must fail closed on a block and never run the expansion after one |
| V5 Input Validation | yes | the pi-subagents variable and the parent header are untrusted input: validate the id shape, parse one bounded line, catch everything; matcher regular expressions come from plugins (existing `invalid-pattern` handling) |
| V6 Cryptography | no | none |

### Known Threat Patterns for this phase

| Pattern | STRIDE | Standard mitigation |
| --- | --- | --- |
| A forged `PI_SUBAGENT_PARENT_SESSION` or published root variable makes hooks log another session's id or read another file | Spoofing, Information disclosure | The bridge passes the path to hooks only as text; it reads at most the first line of that file to compare ids; a mismatch falls back to the own session. A hook already runs with the user's rights. |
| A huge or malformed parent session file | Denial of service | Read a bounded prefix, not the file; never throw past the Pi event |
| A plugin regular expression with catastrophic backtracking on `command_name` | Denial of service | Same exposure as tool matchers today (PG-HOOK-03); the tested value is a short command name |
| A hook stdin that discloses more than before (`model`, `session_title`, `mcp_server`, the root transcript path) | Information disclosure | These are upstream's fields; the hook is the plugin's own code the user installed. Record the new fields on the compatibility page. |
| An expansion hook's context that floods the model | Tampering | The 10,000-character cap (D-PG5-14) applies |
| A blocked expansion that still expands because a later handler rewrote the line | Elevation of privilege | Return `handled`; the gate test pins the registration order |
| The spike or a scenario writes to the real home | Tampering | Temp `HOME` and `PI_CODING_AGENT_DIR`; `resolveRpcSandbox` already refuses a location outside the temp directory |

## Probes run in this research

None started a Pi or a Claude Code session. Reads only:

| Probe | Command shape | Result |
| --- | --- | --- |
| Binary windows | `grep -a -b -o -F '<string>' <binary>` then `dd` at the offset | Records U1 to U8 |
| Docs | `curl` of `hooks.md` to the scratchpad, then `sed`/`grep` | Record U9 |
| Pi source | `sed`/`grep`/`Read` under `node_modules/@earendil-works/{pi-coding-agent,pi-agent-core,pi-ai}` and the Homebrew 1.5.2 tree | Records P1 to P8 |
| pi-subagents 0.87.0 | `npm pack pi-subagents@0.87.0` into a new scratchpad folder, `tar xzf`, `grep` | Records S1 to S3 for the floor |
| pi-subagents 0.88.1 | `grep`/`sed` under `node_modules/.cache/optional-peers` | Records S1 to S5 |

The research-plan seam and its cache were not used: no question needed a documentation provider beyond the one page fetched directly. Graphify is disabled in `.planning/config.json`.

## Sources

### Primary (HIGH confidence)

- Claude Code 2.1.323 binary, `/home/linuxbrew/.linuxbrew/Caskroom/claude-code@latest/2.1.323/claude` (read 2026-11-14).
- `node_modules/@earendil-works/pi-coding-agent` 1.5.0 `dist/` and `docs/extensions.md`; `pi-agent-core` 1.5.0 `dist/agent-loop.js`, `dist/types.d.ts`; Pi 1.5.2 under the Homebrew Cellar.
- pi-subagents 0.87.0 (npm tarball) and 0.88.1 (suite copy).
- The repository: `extensions/pi-claude-marketplace/bridges/hooks/**`, `domain/components/**`, `edge/**`, `orchestrators/skill-alias-state.ts`, `index.ts`, `features/**`, `test/e2e/_rpc.ts`, `docs/hooks-compatibility.md`.

### Secondary (documentation, fetched directly)

- <https://code.claude.com/docs/en/hooks.md> (2026-11-14): Common input fields, SessionStart, UserPromptSubmit, UserPromptExpansion, PreToolUse, PostToolUse, PreCompact, matcher patterns.

### Tertiary (LOW confidence)

- None.

## Metadata

**Confidence breakdown:**

- Upstream contract: HIGH. Schemas, builders, and texts were read in the binary and agree with the docs; the runtime values were not observed.
- Pi behavior: HIGH for event order and types (source); MEDIUM for launch detection until spike S7 runs.
- pi-subagents: HIGH for what the variable and the header hold (two versions read); the nested path was read, not run.
- Architecture and seams: HIGH. Every seam was read at its line.
- Harness cost: MEDIUM. Table counts are from `grep -c`; the per-table change was sampled, not enumerated.

**Research date:** 2026-11-14
**Valid until:** 2026-11-28 for the upstream records (the binary moves weekly); 30 days for the Pi 1.5.0 and repository findings.

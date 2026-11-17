# Phase 6: Hook Inputs and Events - Context

**Gathered:** 2026-11-14
**Status:** Ready for planning
**Mode:** autonomous discuss (`--auto`; the maintainer asked for an autonomous
run that takes reversible upstream-parity defaults and flags them for review).
Every question took its recommended answer. **Every decision below is pending
maintainer review**, and the ones that are product calls or hard to undo say
why.

<domain>
## Phase Boundary

Deliver PG-HOOK-04, PG-HOOK-06, and PG-HOOK-11, and settle decision 26
(BACKLOG CHILDSESSIONID-01):

- Hooks receive the stdin fields that official plugins read: `tool_use_id` on
  the three tool events, `duration_ms` on `PostToolUse` and
  `PostToolUseFailure`, `mcp_server` for MCP tools, `custom_instructions` on
  `PreCompact`, `model` and `session_title` on `SessionStart`, and `effort`
  when Pi's level is one of Claude's levels. `permission_mode` follows
  decision 25 (PG-HOOK-04).
- `UserPromptExpansion` hooks run before a typed prompt template or skill
  expands, with Claude Code's fields, and a block stops the expansion and shows
  the reason (PG-HOOK-06).
- A `SessionStart` hook receives `resume` in a session started with
  `--continue` or `--resume` (PG-HOOK-11). Spike S7 runs first and gates it.
- In a pi-subagents child, a tool hook's `session_id`, `transcript_path`, and
  `CLAUDE_CODE_SESSION_ID` name the session that decision 26 picks, and
  `docs/hooks-compatibility.md` records it (success criterion 6).

Out of this phase: `agent_id` and `agent_type` (PG-HOOK-07a, Phase 3, done);
`SubagentStart`/`SubagentStop` (PG-HOOK-07b); MCP prompt expansions (no Pi
surface); `PostToolBatch` (the PRD's HOOK-08); the hook variables of
HOOKENV-01, `CLAUDE_EFFORT` included; and the other optional upstream fields
the requirement does not name (`prompt_id`, `scratchpad_dir`, the
`UserPromptSubmit` `source`, the four resume cost fields of `SessionStart`).
This phase changes nothing inside Pi or a companion package and does not raise
a floor.

</domain>

<decisions>
## Implementation Decisions

### Decision 26: the session a child's tool hook names (success criterion 6)

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

### Decision 9: send the missing stdin fields (PG-HOOK-04)

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

### Decision 25: `permission_mode` (PG-HOOK-04)

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

### Behavioral test placeholders (PG-HOOK-04)

- **D-PG6-12:** The whole-payload step (`features/step_definitions/hook/runs.steps.ts`)
  projects the new varying values the way it projects session ids today: each
  distinct `tool_use_id` becomes an ordinal token by first appearance, so a
  literal shows that a pre run and its result run share an id and that a
  second call has another; a `duration_ms` becomes one token that stands for
  a non-negative integer. No scenario asserts a timing value. Scenarios still
  state every other field literally, so a missing or extra field fails them.
  The planner picks the token spellings; they must not collide with the
  session-id ordinals.

### Spike S7 and `resume` (PG-HOOK-11)

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

### `UserPromptExpansion` (PG-HOOK-06)

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

### Records and evidence

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

### Pending maintainer review

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

### the agent's Discretion

Module and type names; the tool-id suffix form for edit pairs; the placeholder
token spellings; where the duration start mark lives; the launcher option's
name; plan splits. No exception to plan size, security, coverage, or
verification gates.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements and evidence

- `.planning/ROADMAP.md` — "Phase 6: Hook Inputs and Events": goal, discuss
  step, spike, notes, six success criteria.
- `.planning/REQUIREMENTS.md` — PG-HOOK-04, PG-HOOK-06, PG-HOOK-11, and the
  rule that a decision's answer is recorded in PROJECT.md with its premise
  and version.
- `docs/prd/parity-gaps-prd.md` — section 5.2 (decisions 9 and 25), section
  7.2 ("HOOK-04", "HOOK-06", the HOOK-11 row), section 9 (spike S7).
- `docs/research/parity-gaps/hooks.md` — U23, U24, U34, U38, "HOOK-04",
  "HOOK-06", "HOOK-11", and assumption 02.
- `.planning/BACKLOG.md` — CHILDSESSIONID-01, HOOKPAYLOAD-01, HOOKLAUNCH-01,
  HOOKENV-01.

### Earlier decisions this phase builds on or amends

- `.planning/PROJECT.md` — D-CF5-01 (source mapping), D-CF5-06 (amended by
  D-PG6-17), D-CF5-07 (`transcript_path`), D-CF5-24 (`hook-notice`), D-CF5-28
  and D-BG-403 (superseded by D-PG6-04), D-BG-401, D-BG-601 (the saved-session
  `Given`), D-60-06 (`CLAUDE_ENV_FILE` key), D-PG1-04 (bare model ids),
  D-PG2-01 (one hook run per edit pair), D-PG2-10 (matchers).
- `.planning/phases/03-background-subagents/03-CONTEXT.md` — D-PG3-04 (child
  event policy), D-PG3-05 (child-owned state), D-PG3-06 (child identity).
- `.planning/phases/03-background-subagents/03-VERIFICATION.md` — the
  unclassified PG-HOOK-07a row that decision 26 closes.
- `.planning/phases/05-stop-continuation-and-hook-failures/05-CONTEXT.md` —
  D-PG5-10, D-PG5-13, D-PG5-14 (notices and the context cap the new event
  uses).

### Documents this phase corrects

- `docs/hooks-compatibility.md` — the passages D-PG6-23 lists.
- `docs/output-catalog.md` — the `hook-notice` block.

### Pi and companion contract

- `node_modules/@earendil-works/pi-coding-agent/docs/extensions.md` —
  `#### input` (`:1110-1140`: order of extension commands, `input`, skill and
  template expansion).
- `node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts`
  — `SessionStartEvent` (`:594-600`), `SessionBeforeCompactEvent`
  (`:620-625`), `InputEvent`/`InputEventResult` (`:929-950`), tool event
  `toolCallId` and `parentToolCallId` (`:951-961`), `getSessionName`
  (`:1299`), `getThinkingLevel` (`:1323`).
- `node_modules/.cache/optional-peers/node_modules/pi-subagents/src/runs/shared/child-runtime-config.js`
  (`:13-14`), `src/runs/background/async-execution.js` (`:551-554`),
  `src/runs/shared/child-session.js` (`:529-542`).

### Project rules

- `AGENTS.md` — "Upstream parity", "Behavioral tests", "Build verification".
- `.agents/skills/claude-code-compat-research/SKILL.md`,
  `.agents/skills/cucumber/SKILL.md`,
  `.agents/skills/typescript-unit-tests/SKILL.md`,
  `.agents/skills/changelog/SKILL.md`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `bridges/hooks/translation-context.ts`: `buildTranslationContext` and
  `TranslationContext` (`sessionId`, `transcriptPath`, `cwd`,
  `childIdentity`). Its header says new common fields need every translator
  extended in lockstep; the root-session source of D-PG6-02 lands here.
- `bridges/hooks/payloads/*.ts`: one translator per event
  (`pre-tool-use.ts`, `post-tool-use.ts`, `post-tool-use-failure.ts`,
  `pre-compact.ts`, `session-start.ts`, `user-prompt-submit.ts`, ...). A new
  `user-prompt-expansion.ts` follows the same shape.
- `bridges/hooks/mcp-tool-view.ts`: `createHookToolView(pi).identify`
  returns `McpToolIdentity`, the source of `mcp_server` for plugin servers.
- `bridges/hooks/hook-env.ts`: where `CLAUDE_CODE_SESSION_ID` and
  `CLAUDE_SESSION_ID` are set.
- `bridges/hooks/event-router.ts`: `CHILD_EVENT_POLICY` and
  `dispatchesInCurrentSession`; the `input` registration for
  `UserPromptSubmit`.
- `bridges/hooks/runtime.ts`: the child identity capture (D-PG3-06).
- `edge/command-invocation.ts` (`:121`) and `edge/skill-aliases.ts` (`:207`):
  the two `input` handlers that already recognize typed templates and
  skills.
- `bridges/hooks/context-cap.ts`, `hook-output-files.ts`: the cap the
  expansion context goes through.
- `features/step_definitions/hook/runs.steps.ts` (`:63-80`): the session-id
  ordinal projection D-PG6-12 extends.
- `features/lib/pi-process.ts` (`PiProcess.start`): the launch the option of
  D-PG6-16 extends; `features/step_definitions/hook/session-end.steps.ts`:
  the saved-session `Given`.
- `features/lib/real-subagent-child.ts`: real background children of
  pi-subagents 0.88.1, `sessionIdOf` reads a session header.

### Established Patterns

Pure translators with owner unit tests and 100% direct coverage; a Pi event
handler never throws (NFR-2); all output through `notifyHookNotice` (IL-2);
generation guards and per-session identity, never process-global child state
(D-PG3-06). Trace callers with CodeGraph before editing: every translator
reads `TranslationContext`.

### Integration Points

- `features/hook/tool-use.feature`, `tool-failure.feature`,
  `session.feature`, `session-end.feature`, `prompt-and-stop.feature`,
  `matchers.feature`, `features/plugin/subagent-child.feature`: whole-payload
  literals that grow.
- `domain/` hooks resolution and the unsupported-event set: where
  `UserPromptExpansion` changes from unsupported to supported.

</code_context>

<specifics>
## Specific Ideas

Evidence records, checked 2026-11-14. The binary is Claude Code **2.1.323**
(`/home/linuxbrew/.linuxbrew/Caskroom/claude-code@latest/2.1.323/claude`,
read with `strings` and `grep`, no session run). The docs page is
<https://code.claude.com/docs/en/hooks.md>, fetched the same day. Pi is
`@earendil-works/pi-coding-agent` 1.5.0; pi-subagents is the 0.88.1 suite
copy. No Claude Code or Pi session ran for this record.

1. **Child session fields (decision 26).** Docs, "SubagentStop input": "The
   `transcript_path` is the main session's transcript, while
   `agent_transcript_path` is the subagent's own transcript stored in a
   nested `subagents/` folder"; the example nests `agent-def456.jsonl` under
   the main session id `abc123`. Docs, common fields: `agent_id` is "Present
   only when the hook fires from within a subagent... Use this field (not
   agent_type) to distinguish subagent calls from main-thread calls."
   Binary: every event's base input comes from one builder,
   `Hm(session, cwd, permissionMode, opts)` → `{session_id: e.id,
   transcript_path: Np(e.id), cwd, ..., permission_mode, agent_id:
   opts.agentId, agent_type, effort}`; `SubagentStop` adds
   `agent_transcript_path: oh(agentId)` from the agent id, so the base fields
   keep the session's id; `UserPromptExpansion` keys its registry on
   `k.agentId ?? k.session.id`. The hook env builder sets
   `CLAUDE_CODE_SESSION_ID: e.sessionId` and `CLAUDE_CODE_CHILD_SESSION: "1"`
   in one process whose subagents share the session. Confidence medium-high:
   `SubagentStop` is documented; for tool events the shared builder and the
   separate agent transcript are read from code, not stated for
   `PreToolUse`/`PostToolUse`. Pi side: pi-subagents' parent variable is
   documented as the **root** parent session id, and the child header's
   `parentSession` is the parent session file.
2. **Missing fields (decision 9).** Binary schemas: `PreToolUse`
   `{tool_name, tool_input, tool_use_id: string, mcp_server?}`;
   `PostToolUse` adds `tool_response`, `duration_ms?` ("Tool execution time
   in milliseconds. Excludes permission-prompt and hook time"),
   `mcp_server?`; `PostToolUseFailure` adds `error`, `is_interrupt?`,
   `duration_ms?`, `mcp_server?`. `mcp_server` is `{name, source}`; `source`
   is "sdk | plugin | user | project | local | dynamic | managed | enterprise
   | claudeai | agent — an open set"; the builder `r$r` returns `{name:
   serverName, source: ... "plugin" ...}`, and plugin servers are keyed
   `` `plugin:${plugin}:${server}` `` (builders `B3o`, `efs`; the built-in
   `claude-test` plugin's server is `plugin:claude-test:browser` beside the
   tool prefix `mcp__plugin_claude-test_browser__`). Docs: "The `mcp_server`
   field requires Claude Code v2.1.274 or later." `PreCompact`
   `{trigger, custom_instructions: string | null}`; docs: "For `manual`,
   `custom_instructions` contains what the user passes into `/compact` and is
   `null` when they pass nothing. For `auto`, `custom_instructions` is
   `null`." `SessionStart` `{source, agent_type?, model?, session_title?,
   seconds_since_last_response?, context_tokens?,
   prompt_cache_likely_expired?, estimated_cache_write_usd?}`;
   `UserPromptSubmit` `{prompt, source?, session_title?}`. `effort`
   `{level}`: "Present for hooks that fire within a tool-use context... absent
   for session-lifecycle hooks and models without effort support"; docs list
   `low|medium|high|xhigh|max`. Confidence high for the shapes; medium for
   the plugin server key (the `source` precedence in `r$r` was read, the
   runtime value was not observed). Use: `security-guidance`
   (`security_reminder_hook.py:1205-1229`) and `code-modernization`
   (`hooks/register.ts:1167`) read `tool_use_id`.
3. **`permission_mode` (decision 25).** Binary: the base builder passes the
   app state's mode; the schema types the field `optional()`; the mode enum is
   `default | acceptEdits | bypassPermissions | plan | dontAsk | auto`. Docs:
   "The mode labeled **Manual** arrives as `"default"`, never as `"manual"`."
   The PRD research (U23) notes it is "not on all events"; the docs'
   `SessionStart` example omits it. Reader: `code-modernization`
   `telemetry.py:443`, `PERMISSION_MODES.get(permission_mode, 0) if
   isinstance(permission_mode, str) else 0`. Confidence high.
4. **`UserPromptExpansion` (PG-HOOK-06).** Docs: "Runs when a user-typed
   command expands into a prompt before reaching Claude"; "typing
   `/skillname` directly bypasses `PreToolUse`. `UserPromptExpansion` fires
   on that direct path"; matcher on `command_name`, empty matcher fires on
   every prompt-type command; `expansion_type` is `slash_command` for skills
   and custom commands, `mcp_prompt` for MCP prompts; example
   `command_source: "plugin"`, `prompt: "/example-skill arg1 arg2"`; output
   `decision: "block"` with `reason` "Shown to the user", `additionalContext`
   "added to Claude's context alongside the expanded prompt"; exit 2 "routes
   the same way as `reason`". Binary: `zgs(type, name, args, source, prompt,
   mode, ctx)` is called with `e.source === "mcp" ? "mcp_prompt" :
   "slash_command"`, `e.name`, the args, `e.source`, and `` `/${e.name}
   ${args}` ``; a blocking result renders `UserPromptExpansion operation
   blocked by hook:` and the error on the next line. Confidence high for
   fields and blocking; low for `command_source` of non-plugin commands (the
   closed set was not read) and for the order against `UserPromptSubmit`.
5. **`resume` (PG-HOOK-11).** Docs: "`SessionStart` hooks run again on resume
   with `source` set to `"resume"`, or `"fork"` if you added
   `--fork-session`." PRD research: `resume` for "`--resume`, `--continue`,
   or `/resume`". Pi 1.5.0 `SessionStartEvent.reason` is `startup | reload |
   new | resume | fork`, with `previousSessionFile?`; whether a launch with
   `--continue` reports `startup` with its entries already loaded is the
   open question of spike S7. Confidence high for upstream, unknown for Pi.

</specifics>

<deferred>
## Deferred Ideas

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

</deferred>

## Parent lines for the orchestrator

This run did not edit PROJECT.md, ROADMAP.md, REQUIREMENTS.md, STATE.md, or
BACKLOG.md. Recommended amendments once the maintainer accepts the answers:

1. PROJECT.md Key Decisions: record decisions 9, 25, and 26 with premise and
   version (REQUIREMENTS rule): D-PG6-04 (send the fields; Claude Code
   2.1.323, Pi 1.5.0), D-PG6-11 (`permission_mode` left out; Pi has no
   modes; 2.1.323 types it optional), D-PG6-01 (a child's session fields
   name the root main session; 2.1.323 docs and binary, pi-subagents 0.88.1).
   Mark each pending maintainer review.
2. Append to the D-CF5-28 and D-BG-403 rows: "Superseded by D-PG6-04
   (parity-gaps, Phase 6)." Change D-CF5-06's status once PG-HOOK-11
   verifies: "Amended by D-PG6-14 (parity-gaps, Phase 6)."
3. BACKLOG.md, once the phase verifies: close HOOKPAYLOAD-01,
   HOOKLAUNCH-01, and CHILDSESSIONID-01.
4. The workflow's `update_state` step (record the session in STATE.md and
   commit it) and its `auto_advance` step (start plan-phase) were skipped as
   instructed.

---

*Phase: 06-hook-inputs-and-events*
*Context gathered: 2026-11-14*

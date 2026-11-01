# Phase 5: Hooks - Context

**Gathered:** 2026-11-01
**Status:** Ready for planning
**Mode:** autonomous (smart discuss in a child session; decisions made from
upstream evidence, no user prompts). The user's standing instruction: "make
decisions as you see fit, but when in doubt research how claude code upstream
operates, and try to maintain compatibility unless we need to deviate for
reasons specific to the implementation of this project." Every decision below
is **settled autonomously**; the ones a user might reverse are logged in
`DUBIOUS-CHOICES.md` in this folder (P5-DC-xx).

<domain>
## Phase Boundary

Phase 5 makes bridged plugin hooks fire on Pi's events the way Claude Code
2.1.316 fires them, and proves it with cucumber scenarios under
`features/hook/` (plus the migrated `features/plugin/session-start-hooks.feature`)
that observe only the hook recorder, the scripted model's call log, and what
Pi or `/claude:plugin` reports:

1. **Session events (HOOK-01..03):** SessionStart `source` and SessionEnd
   `reason` mapping (D-CF1-10..12 plus D-CF5-01..06), SessionStart on
   compaction, matchers filtered on the mapped value, the SSDEDUP-01 key.
2. **Tool events (HOOK-04, HOOK-08):** PreToolUse, PostToolUse,
   PostToolUseFailure with Claude's tool names and stdin; exit codes and JSON
   decisions; parallel matching hooks; dedupe; hooks on plugin MCP tools.
3. **Prompt, stop, compact (HOOK-05):** UserPromptSubmit, Stop, PreCompact,
   PostCompact; `additionalContext` (H7) and `systemMessage` (FG-26).
4. **Process (HOOK-06):** exec-form placeholder substitution (FG-19),
   environment, `onFailure` (FG-22).
5. **Configuration (HOOK-07):** `if`, `once`, `onFailure`, the manifest
   `hooks` field (FG-24), unsupported events (FG-23), never silent.
6. **Lifecycle (HOOK-09):** disable, uninstall, update; docs (FG-25).

**Out of scope:** hooks modules (`modules`, not bridged), `http`/`prompt`/
`agent`/`mcp_tool` handler types (stay `{unsupported hooks}`), user config
(`${user_config.*}`, `CLAUDE_PLUGIN_OPTION_*`, USRCFG-01), the frozen harness
files (a needed change goes to the parent as a parent line), behavior that
needs a real model (RM-05 StopFailure).

</domain>

<upstream_evidence>
## Upstream evidence (Claude Code 2.1.316)

`claude --version`: `2.1.316 (Claude Code)`, `/opt/claude-code/bin/claude`,
grepped and probed 2026-11-01 by three research agents. Probe setup (as in
Phase 2): a throwaway tree under the session scratchpad, `env -i
PATH=/usr/bin:/bin`, fresh `HOME` and `CLAUDE_CONFIG_DIR`, a local path
marketplace and plugin installed with `claude plugin marketplace add` /
`install`, sessions run as `claude -p ... --output-format stream-json
--verbose [--include-hook-events] [--allowedTools Bash]` with
`ANTHROPIC_BASE_URL` at a local Node SSE stub (key `stub-not-a-credential`)
that plays `tool_use` blocks then text and saves each request body. No
credential and no LLM. Raw outputs: scratchpad `research-a/`, `research-b/`,
`research-c/` (not committed).

- **E1 SessionEnd.** `uF=["clear","resume","logout","prompt_input_exit","other"]`;
  no `bypass_permissions_disabled` (removed v2.1.234). Matchers match `reason`
  (probe: an `other` group ran, a `prompt_input_exit` group did not).
  `/clear` sends `clear`; `/resume` sends `resume`; `/branch` calls the same
  resume path (`t.resume(u,C,"fork")`), so SessionEnd `resume` then
  SessionStart `fork`; exit at the prompt input sends `prompt_input_exit`;
  everything else (print end, stdin close, signals) sends `other`; `logout`
  has no call site. High.
- **E2 Reload.** `/reload-plugins` dispatches no hook (probed, also after
  installing a new plugin from another process). A headless-only "late
  SessionStart" path runs new plugins' SessionStart once. High for
  `/reload-plugins`.
- **E3 Compaction order.** Full, partial, reactive compaction: PreCompact,
  then SessionStart(`compact`), then PostCompact(`trigger`, `compact_summary`);
  two `/compact` give the sequence twice, same session id (probed). High.
- **E4 Launch sources.** `--resume` sends `resume`, `--fork-session` sends
  `fork` (probed). Pi sends `startup` for `--continue/--resume/--session/--fork`.
- **E5 transcript_path.** Always a path, even before the file exists (probed).
  Pi gives a path from `newSession()` for a saved session; `--no-session`
  (which the harness uses, `test/e2e/_rpc.ts:251`) gives none. Phase 1's
  "empty on the first turn" was the harness's `--no-session`, not the turn.
- **E6 once / onFailure.** `once` is honored only for skill-frontmatter hooks
  (docs #common-fields; probe: a plugin `once:true` hook ran twice).
  `onFailure: "block"` (command and http hooks, not `async`/`asyncRewake`,
  ignored with a warning on Stop/SubagentStop/TaskCompleted/TeammateIdle)
  turns a start failure, an exit code other than 0 and 2, a timeout, or
  invalid/schema-failing JSON into a block with
  `[<cmd>]: failed|timed out; blocking because onFailure is "block"\n<stderr>`;
  default `continue` (probed on PreToolUse, UserPromptSubmit, Stop). High.
- **E7 Events.** 33-event tuple incl. `DirectoryAdded` (after `/add-dir`,
  matcher `slash_command|register_repo_root`, no decision control),
  `PreModelSwitch`, `PostModelSwitch`. Unknown event keys are ignored with a
  warning. High.
- **E8 Manifest `hooks`.** Path, inline map, or array; `hooks/hooks.json`
  loads first, then each element, merged per event by concatenating groups.
  Marketplace entry: inline only; with `plugin.json` an entry event replaces
  that event; without `plugin.json` the entry replaces the whole config.
  Probed. High (the no-`plugin.json` case is binary plus one probe).
- **E9 Exec form.** `command` and each `args` element substitute
  `${CLAUDE_PROJECT_DIR}`, `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_DATA}`,
  `${user_config.KEY}` (unset option fails the hook); anywhere in the string;
  other `${...}` stay literal. Shell form gets no text substitution (the shell
  expands the env). Env: `CLAUDECODE=1`, `CLAUDE_CODE_SESSION_ID`,
  `CLAUDE_PROJECT_DIR`, `CLAUDE_PLUGIN_ROOT`, `CLAUDE_PLUGIN_DATA`,
  `CLAUDE_ENV_FILE` (SessionStart, Setup, CwdChanged, FileChanged), plus
  `CLAUDE_CODE_CHILD_SESSION`, `CLAUDE_CODE_SESSION_ATTENDED`, `CLAUDE_PID`;
  upstream sets no `CLAUDE_SESSION_ID` env var. High.
- **E10 Dedupe.** After matching, one hook per key
  `${pluginRoot??skillRoot??settingsSource}\0command\0${shell??"bash"}\0${command}\0${JSON(args??null)}\0${if??""}`
  (timeout, async, once, onFailure not in the key); first copy's position,
  last copy's fields (probed: timeouts 1 then 10 ran once and completed).
  Copies in two plugins stay separate. High.
- **E11 Parallel.** "When an event fires, its matching hooks run in parallel"
  (docs; binary `Promise.race` merge; probe: two 1 s hooks overlapped).
  Merge: deny > defer > ask > allow; exit 2 is deny; every hook's outputs are
  kept; with two input rewrites, both hooks saw the original input and the
  last to finish won. High.
- **E12 systemMessage.** Shown to the user as `<hookName> says: <text>`
  (stream-json `system/informational`, level `notice`) for UserPromptSubmit,
  PreToolUse, PostToolUse, Stop; never sent to the model; discarded on
  SessionEnd, PreCompact, PostCompact, StopFailure. High (SessionStart medium).
- **E13 additionalContext.** Accepted on SessionStart, UserPromptSubmit,
  PreToolUse, PostToolUse, PostToolUseFailure, Stop (and kinds Pi lacks); every
  hook's value reaches the model as `<hookName> hook additional context: ...`;
  UserPromptSubmit "can't replace the prompt"; plain stdout is context on
  UserPromptSubmit and SessionStart; tool-event context arrives after the tool
  result, even when the call is denied. High.
- **E14 MCP tools.** A plugin MCP tool is a regular tool
  `mcp__plugin_<p>_<s>__<tool>`; a literal-matcher and a `*` hook each fire
  once; stdin carries `tool_name`, `tool_input`, `mcp_server`. No proxy. High.
- **E15 Decisions.** PreToolUse `ask` denies in `-p`; `defer` is print-mode
  only; exit 1 with valid deny JSON applies the deny; `updatedInput` replaces
  the whole input; `continue:false` stops; PostToolUse block keeps the output
  and adds feedback; UserPromptSubmit block shows the reason to the user;
  each Stop reason is delivered as `Stop hook feedback:\n<reason>`. High
  (probes in `-p` only).

</upstream_evidence>

<decisions>
## Implementation Decisions

Decision IDs are `D-CF5-NN`. Each cites its evidence (E-n) and license.

### Session events (HOOK-01..03; implements D-CF1-10..12)

- **D-CF5-01 (SessionStart source):** Pi `startup`->`startup`, `new`->`clear`
  (D-CF1-10), `resume`->`resume`, `fork`->`fork`; `compact` comes from
  D-CF5-04. The closed matcher set becomes `startup`, `resume`, `clear`,
  `compact`, `fork`, and dispatch filters on the **mapped** value, not Pi's
  raw reason (today `dispatch.ts:497-499` compares the raw reason, so a
  `clear` group would never match). Matches upstream.
- **D-CF5-02 (SessionEnd reason, FG-20):** `new`->`clear` (D-CF1-10),
  `resume`->`resume`, `fork`->`resume` (upstream `/branch`, E1), `quit`->
  `prompt_input_exit` in `tui` mode and `other` in `print`/`json`/`rpc` mode,
  `reload`-> no SessionEnd run (D-CF5-03). Matchers admitted: `clear`,
  `resume`, `prompt_input_exit`, `other`, `logout` (upstream's closed set;
  `logout` never fires, as upstream), filtered at dispatch on the mapped
  value. License for the one leftover difference: Pi gap (Pi's `quit` does not
  say whether a signal caused it, so a TUI quit by signal also sends
  `prompt_input_exit`, where upstream sends `other`).
- **D-CF5-03 (Pi reload, FG-21):** Pi `/reload` runs neither SessionStart nor
  SessionEnd, as upstream `/reload-plugins` (E2). The load-time hydrate and the
  shared data-dir step stay. Replaces today's `source: "reload"` /
  `reason: "reload"` pass-through (D-60-04, D-58-06 parts superseded).
- **D-CF5-04 (compaction, HOOK-01/03):** one `session_compact` handler runs
  SessionStart(`source: "compact"`) to completion, then PostCompact, as
  upstream (E3). PostCompact carries `compact_summary` from
  `compactionEntry.summary`. PreCompact and PostCompact `manual`/`auto`
  matchers are filtered at dispatch on the trigger (bug fix: today every entry
  fires, `dispatch.ts:507-511`).
- **D-CF5-05 (SSDEDUP-01 key):** the duplicate-bind guard stays on the
  `session_start` handler with its `${sessionId}\0${reason}` key; the
  compaction SessionStart is dispatched from the `session_compact` handler
  outside the guard (option A). Two compactions give two runs; RPC
  `new_session` still gives one `clear` run.
- **D-CF5-06 (launch with `--resume`/`--fork`):** not changed in this phase:
  Pi reports `startup` and the bridge sends `startup`. The harness cannot
  launch Pi with those flags without editing the frozen launcher. Recorded
  divergence (project-specific: frozen harness); a BACKLOG parent line
  carries detection through the session header (`parentSession` means fork,
  existing entries mean resume).
- **D-CF5-07 (transcript_path):** unchanged. A saved Pi session already sends
  a path from the first turn (E5); `--no-session` sends `""` (Pi gap: an
  in-memory session has no transcript location). Comments and docs are
  corrected; the Phase 1 finding is closed as a harness artifact.
- **D-CF5-08 (installs that dropped `clear`/`compact`/`fork` groups):** no
  reconcile change in this phase (the BFILL-01 planner is outside Phase 5's
  ownership). The CHANGELOG parent line tells users to run
  `/claude:plugin reinstall <plugin>` (reinstall restores the dropped groups;
  `apply` heals only a plugin that lost every hook). A BACKLOG parent line
  carries the growth-move option for `pending`/`apply`.

### Tool events and dispatch (HOOK-04, HOOK-08)

- **D-CF5-09 (parallel matching hooks):** all matching hooks of one event run
  in parallel on one translated snapshot, and their results fold in routing
  order (E11): `continue:false` stops; deny > ask > allow; every hook's
  `additionalContext` and `systemMessage` kept in routing order; the input
  rewrite of the winning decision, ties to the last hook in routing order.
  Supersedes DISP-04 ("fan-out sequential"). Scenarios that check several runs
  of one event compare them keyed by hook name, never by append order.
- **D-CF5-10 (dedupe):** one hook per upstream key (E10), rooted at the
  plugin's `resolvedSource`: first position, last copy's fields; copies in two
  plugins stay separate.
- **D-CF5-11 (decision parity, E15):** PreToolUse `ask` blocks when Pi has no
  UI (`print`/`json`/`rpc`) and asks through `ctx.ui.confirm` in `tui`;
  `defer` is ignored (recorded divergence: upstream honors it only in print
  mode, and Pi has no deferred-permission flow; Pi gap); a deny in JSON
  applies whatever the exit code; `updatedInput` replaces the whole input;
  `continue:false` stops the turn; the exit-2 reason prefers the JSON reason.
  PostToolUse/PostToolUseFailure block keeps the tool output and adds the
  feedback. UserPromptSubmit block notifies the reason. Stop delivers every
  blocking reason. The planner may defer an item that no scenario covers to a
  BACKLOG parent line, never silently.
- **D-CF5-12 (MCP proxy, HOOK-08):** a call-mode outer `mcp` proxy event
  (`toolName` `mcp` or a namespace proxy, `input.tool` a string, no
  `input.action`) runs no hook; the nested call fires once under the real
  `mcp__plugin_<p>_<s>__<tool>` name with `tool_input` = the arguments
  (matches E14 and removes today's match-all double fire). Non-call proxy
  actions (search, describe, status) still fire as `mcp` (Pi gap: upstream has
  no proxy; ToolSearch is its closest analog). Calls the adapter runs inside
  the proxy without a nested Pi call never reach hooks: recorded Pi-gap
  divergence. HOOK-08 uses Phase 1's MCP stub (`features/lib/mcp-stub-server.ts`)
  and pi-mcp-adapter, never a Phase 6 lib file.

### Outputs (HOOK-05; H7, FG-26)

- **D-CF5-13 (additionalContext on every event, H7):** UserPromptSubmit
  context goes **beside** the prompt and never replaces it (bug fix; today
  `event-adapters.ts:255-258` replaces the prompt); SessionStart context
  persists past the first run; PreToolUse/PostToolUse/PostToolUseFailure
  context reaches the model after the tool result (also when denied); Stop
  carries every hook's value; plain stdout counts as context on SessionStart
  and UserPromptSubmit. Text `<Event>[:<Tool>] hook additional context: ...`.
  Pi carriers (planner verifies): `before_agent_start` `message`, and
  `pi.sendMessage(..., {triggerTurn:false})` for tool events. Matches upstream.
- **D-CF5-14 (systemMessage, FG-26):** shown to the user through the notify
  chokepoint as `<Event>[:<Tool>] says: <text>` on PreToolUse, PostToolUse,
  PostToolUseFailure, UserPromptSubmit, Stop, and SessionStart; dropped on
  SessionEnd, PreCompact, PostCompact, StopFailure as upstream. A new
  `HookSurface` kind (append-only closed set, its own commit), severity
  `info` (stream-json level `notice`). Never sent to the model.

### Process and configuration (HOOK-06, HOOK-07)

- **D-CF5-15 (exec form, FG-19):** exec-form `command` and each `args` element
  substitute `${CLAUDE_PROJECT_DIR}`, `${CLAUDE_PLUGIN_ROOT}`,
  `${CLAUDE_PLUGIN_DATA}` anywhere in the string, from the same values the
  hook env gets, in both the sync and async-rewake lanes; shell form keeps no
  text substitution (matches E9). `${user_config.*}` stays literal (USRCFG-01).
- **D-CF5-16 (environment):** keep the current env (`CLAUDECODE`,
  `CLAUDE_CODE_SESSION_ID`, the three path vars, SessionStart
  `CLAUDE_ENV_FILE`) and the Pi-only `CLAUDE_SESSION_ID` shim (SENV-03,
  D-91-02). The missing upstream vars (`CLAUDE_CODE_CHILD_SESSION`,
  `CLAUDE_CODE_SESSION_ATTENDED`, `CLAUDE_PID`, `CLAUDE_EFFORT`) go to a
  BACKLOG parent line.
- **D-CF5-17 (`once`, FG-22):** plugin hooks ignore `once`, as upstream (E6);
  the field moves onto the handler schema and stays inert; docs say so.
- **D-CF5-18 (`onFailure`, FG-22):** implemented as upstream (E6) for command
  hooks: start failure, exit other than 0/2, timeout, or `{...}` stdout that
  fails to parse become a block with upstream's message; ignored on `async`,
  `asyncRewake`, and Stop; on events with no block (SessionStart, SessionEnd,
  PostCompact) the block is reported as the event's error. Schema validation of
  otherwise-valid JSON stays permissive (recorded divergence, low impact).
- **D-CF5-19 (unsupported events, FG-23):** keep the code: a non-admitted event
  (the five inapplicable events, HKMS-01's pair, `DirectoryAdded`) drops as
  `{unsupported hooks}` with `<event> (unsupported)` in info, never silently.
  `DirectoryAdded` is a Pi gap (no add-directory event). Docs gain the three
  events. PROJECT.md:1344 ("Silently dropped ... debug-logged only") is
  corrected by a parent line.
- **D-CF5-20 (manifest `hooks`, FG-24):** the full merge (E8) is deferred: it
  touches install, enable, and cascade orchestrators outside Phase 5's
  ownership. This phase makes it never silent: a manifest `hooks` field (path,
  array, or inline object) or a marketplace-entry `hooks` reports the plugin
  `{unsupported hooks}` (install needs `--partial`), and info names it. License:
  project-specific (parallel-phase ownership); the merge is a BACKLOG parent
  line. The edit to `domain/hooks-resolution.ts` stays minimal.
- **D-CF5-21 (docs drift, FG-25):** `docs/hooks-compatibility.md` and the
  `hook-events.ts` header match the tested behavior (compact triggers
  `manual`/`auto` from Pi `manual`/`threshold`/`overflow`, every D-CF5 row,
  stale `bypass_permissions_disabled` mentions removed).

### Lifecycle (HOOK-09)

- **D-CF5-22:** disable and uninstall stop the hooks and update replaces them,
  observed through the hook recorder in a later session or turn; enable
  restores them.

### Claude's Discretion

- Split into plans and waves per the ROADMAP wave template (one
  `event-router.ts` editor per wave; wave 1 = session tracer).
- New step texts, parameter types (prefixed `hook`), and fixture helpers in
  `features/lib/hook-files.ts` (e.g. hooks that record then print JSON or exit
  with a code, by shell form around the frozen recorder).
- Whether to add `tool_use_id` and `mcp_server` to tool payloads.
- How a scenario drives compaction (Pi RPC `compact` with a scripted summary
  reply), resume/fork (RPC `switch_session`, `fork`), and quit, through steps
  in `features/step_definitions/hook/**`, without editing frozen modules.
- Tests paired with owned sources (e.g. `test/domain/components/hook-events.test.ts`,
  `test/domain/hooks-resolution.test.ts`) change with them.

</decisions>

<canonical_refs>
## Canonical References

- `.planning/ROADMAP.md` Phase 5 section, File ownership, Milestone rules.
- `.planning/research/FEATURES.md` "### 4. Hooks", rows FG-19..FG-26.
- `.planning/phases/01-harness-and-version-raise/01-CONTEXT.md` D-CF1-10..12,
  D-CF1-17; `01-05-SUMMARY.md` (hook seed).
- `docs/hooks-compatibility.md`; `.agents/skills/cucumber/**`;
  `.agents/skills/claude-code-compat-research/SKILL.md`.
- https://code.claude.com/docs/en/hooks, /plugins-reference, /env-vars
  (retrieved 2026-11-01).

</canonical_refs>

<code_context>
## Existing Code Insights

Paths relative to `extensions/pi-claude-marketplace/` unless noted.

### Reusable Assets
- All hook `pi.on` calls: `bridges/hooks/event-router.ts:900-1022`
  (`session_start` 900, `session_shutdown` 959, `session_before_compact` 965,
  `session_compact` 971 (PostCompact only), `input` 977, `tool_call` 983,
  `tool_result` 989, `before_agent_start` 999 (SessionStart context drain,
  `createBeforeAgentStartHandler` :193), `agent_end` 1006, `agent_settled`
  1010 (Stop/StopFailure, `settle.ts:127`)). SSDEDUP-01 guard 910-924.
- `payloads/session-start.ts:34` and `payloads/session-end.ts:33` pass Pi's
  reason through; `payloads/compact-trigger.ts:11-13` maps
  `threshold`/`overflow`->`auto`; `translation-context.ts:54-60` envelope.
- `dispatch.ts`: `compositeHandlerFor` 337, `toolResultCompositeHandler` 375,
  `reduceBucket` 173 (sequential, first block wins), `entryFires` 491-513.
- `event-adapters.ts`: `adaptToolCallResult` 164, `adaptToolResultResult` 204,
  `adaptInputResult` 247, `adaptObservationResultForEvent` 309.
- `dispatch-exec.ts` (`TRANSLATORS` 113-124, `dispatchHookExec` 146),
  `spawn-helpers.ts:34-48` `planSpawn` (FG-19), `hook-env.ts:52-79`,
  `wire-protocol.ts` (`parseHookStdout` 32, `normalizeClaudeStdout` 73),
  `exec-result.ts:40-51`.
- `shared/vars.ts:68` `substituteClaudeVars` (single pass).
- `domain/components/hook-events.ts:258-281` closed matcher sets;
  `domain/components/hooks/partition.ts:47-69,117-121`;
  `domain/components/hooks/schema.ts:44-48`; `domain/hooks-resolution.ts`.
- Notify: `shared/notification-dispatch.ts` (`notifyAsyncRewakeSummary` :432),
  `HookSurface` in `shared/notification-types.ts:1720`.

### Established Patterns
- Harness: `features/lib/hook-files.ts` (owned; `| name | event | matcher |`
  table, recorder command per row), `features/lib/hook-recorder.ts` (frozen;
  exit 0, no output, appends in completion order),
  `features/step_definitions/hook/runs.steps.ts` (`the hooks record these
  runs:` reads only the last prompt turn's lines; `recordTable` requires
  every column). Session steps (frozen) start sessions only through RPC
  `new_session`; no step compacts, resumes, forks, reloads, or quits. Pi 1.4
  RPC offers `compact`, `switch_session`, `fork`, `clone`;
  `PiProcess.request` takes any `{type}`.
- Cucumber rules: `Feature: <Function> <capability>` at
  `features/<function>/<capability>.feature`; steps in `hook/<topic>.steps.ts`;
  one behavior per scenario; whole-value literals; `markTurnCompared`; no step
  filters or dedupes records; any divergence needs a decision ID.
- Unit tests `test/bridges/hooks/**`, architecture `test/architecture/hooks-*`,
  integration `test/integration/hooks-*`.

### Integration Points
- `features/plugin/session-start-hooks.feature` expects `source` `new`
  (migrate to `clear`); `plugin/packages.steps.ts:162` has another
  session-start-hook step Phase 5 does not own.
- Notification closed sets (`notification-types.ts`, `notification-wire.ts`,
  `docs/json-output.md`, `docs/output-catalog.md`, counters) are append-only:
  the D-CF5-14 kind lands as its own commit.

</code_context>

<specifics>
## Specific Ideas

- Parent lines (for the last plan's SUMMARY): CHANGELOG (D-CF5-02/03/04 session
  values, D-CF5-08 reinstall hint, D-CF5-09 parallel, D-CF5-13 prompt-context
  fix, D-CF5-14, D-CF5-15, D-CF5-18, D-CF5-20); PROJECT.md:1344 correction
  (D-CF5-19); BACKLOG: D-CF5-06 launch sources, D-CF5-08 growth move,
  D-CF5-16 env vars, D-CF5-20 manifest merge, any D-CF5-11 item deferred.
- `.planning/research/FEATURES.md` rows H6 and H20 are inaccurate (H20: the
  proxy double-fires match-all hooks today); note it for the parent.

</specifics>

<deferred>
## Deferred Ideas

- Manifest and marketplace-entry `hooks` merge (D-CF5-20).
- `--resume`/`--fork` launch sources (D-CF5-06).
- Growth move for partially installed hooks in `pending`/`apply` (D-CF5-08).
- Missing upstream env vars (D-CF5-16); `${user_config.*}` (USRCFG-01).
- `updatedToolOutput` in the tool's own shape and `updatedMCPToolOutput`;
  the Stop re-entry cap (8, reset per tool call; docs only).

</deferred>

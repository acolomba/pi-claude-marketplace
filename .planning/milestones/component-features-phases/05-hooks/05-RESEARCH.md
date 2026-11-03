# Phase 5: Hooks - Research

**Researched:** 2026-11-01
**Domain:** Claude Code hook parity in a Pi extension bridge (Pi 1.4 event API, child-process hook execution, cucumber harness on a profile Pi)
**Confidence:** HIGH for the harness and Pi API (read from installed sources and proven by three spike scenarios this session); MEDIUM for wave layout and several dispatch-design details (design recommendations, not verified behavior)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

Decision IDs are `D-CF5-NN`. Each cites its evidence (E-n) and license.

#### Session events (HOOK-01..03; implements D-CF1-10..12)

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

#### Tool events and dispatch (HOOK-04, HOOK-08)

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

#### Outputs (HOOK-05; H7, FG-26)

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

#### Process and configuration (HOOK-06, HOOK-07)

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

#### Lifecycle (HOOK-09)

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

### Deferred Ideas (OUT OF SCOPE)

- Manifest and marketplace-entry `hooks` merge (D-CF5-20).
- `--resume`/`--fork` launch sources (D-CF5-06).
- Growth move for partially installed hooks in `pending`/`apply` (D-CF5-08).
- Missing upstream env vars (D-CF5-16); `${user_config.*}` (USRCFG-01).
- `updatedToolOutput` in the tool's own shape and `updatedMCPToolOutput`;
  the Stop re-entry cap (8, reset per tool call; docs only).

Also out of scope (CONTEXT `<domain>`): hooks modules (`modules`, not bridged), `http`/`prompt`/`agent`/`mcp_tool` handler types (stay `{unsupported hooks}`), user config (`${user_config.*}`, `CLAUDE_PLUGIN_OPTION_*`, USRCFG-01), the frozen harness files (a needed change goes to the parent as a parent line), behavior that needs a real model (RM-05 StopFailure).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| HOOK-01 | SessionStart sends `source: "clear"` for Pi `new`, fires with `source: "compact"` after a compaction, admits `clear`/`compact`/`fork` matchers; `features/plugin/session-start-hooks.feature` migrated | §Harness F1 (compaction via RPC `compact` plus `keepRecentTokens`, spike-proven), §Design S1–S4, §Pinned tests |
| HOOK-02 | SessionEnd `reason: "clear"` for Pi `new`; other reasons, matchers, and SessionStart on Pi `reload` as FG-20/FG-21 decide | §Harness F2 (fork/quit spike-proven over RPC; reload only in TUI, `interactive-mode.js:2617`), §Design S2/S5 |
| HOOK-03 | Two compactions give two SessionStart `compact` runs; duplicate bind (pi#10470) still gives one | §Harness F1 (spike: two `compact` requests in one session work), §Design S3 |
| HOOK-04 | PreToolUse/PostToolUse/PostToolUseFailure fire with Claude names and stdin; matchers select; exit codes and JSON decide as upstream | §Design T1–T5 (parallel fold, dedupe, decisions), spike red proof (exit-1 deny JSON ignored today) |
| HOOK-05 | UserPromptSubmit, Stop, other admitted events with Claude stdin; `additionalContext`, block, `systemMessage` as upstream | §Design O1–O4, spike red proofs (UPS context replaces the prompt; PostToolUse context and systemMessage reach nobody) |
| HOOK-06 | Exec-form substitutes `${CLAUDE_PLUGIN_ROOT}`/`${CLAUDE_PLUGIN_DATA}` in `command` and each `args` element; env matches upstream | §Design P1, spike red proof (args `${CLAUDE_PLUGIN_ROOT}/x` reached the recorder literally) |
| HOOK-07 | `if`, `once`, `onFailure`, manifest `hooks`, unsupported events as FG-22..FG-24 decide, never silent | §Design C1–C4, pitfall: manifest `hooks` naming the standard file is skipped upstream |
| HOOK-08 | Hook on a plugin MCP tool fires once per call under the real name; outer `mcp` proxy event as decided | §Design T6, spike red proof (`*` PreToolUse and PostToolUse each ran twice) |
| HOOK-09 | Disable, uninstall, update stop/replace hooks; `docs/hooks-compatibility.md` matches tested behavior | §Validation map, §Design L1 |
</phase_requirements>

## Project Constraints (from AGENTS.md / CLAUDE.md)

Directives the planner must honor (AGENTS.md, `.planning/CHILD-SESSION-BRIEF.md`, ROADMAP milestone rules):

- **Upstream parity:** Claude Code 2.1.316 is the default; a divergence needs a recorded decision ID or a Pi capability gap. Research upstream with `.agents/skills/claude-code-compat-research`.
- **Behavioral tests:** every user-visible change ships with a cucumber scenario under `features/` that fails without it (record the red proof). Unit tests and direct coverage do not replace it.
- **Quality bar:** `npm run check` green: typecheck, ESLint (`--max-warnings 0`), fallow (dead code, cycles, health `maxCognitive 15` / `maxCyclomatic 20`, dupes on every clone group), Prettier, pairing, `check:features`, unpaired tests, integration, `test:cucumber`, and 100% direct coverage of every source-test pair run alone.
- **Output channel (IL-2):** user-visible output only through `shared/notification-dispatch.ts`; no `process.stdout`/`stderr`, no direct `ctx.ui.notify` (fallow rule pack `notify-chokepoint`).
- **Child processes:** `node:child_process` only in the four sanctioned files (`bridges/hooks/dispatch-exec.ts`, `bridges/hooks/async-rewake/registry.ts`, `platform/git-credential.ts`, `platform/package-manager.ts`); pinned by `test/architecture/no-shell-out.test.ts`.
- **Pi API types:** only through `platform/pi-api.ts` (frozen after Phase 1).
- **NFR-10 containment:** `assertPathInside` before any write/read path built from state data.
- **NFR-7:** discriminated unions with exhaustive `kind` switches and no default arm.
- **Comments/test titles** cite durable IDs (D-CF5-NN, HOOK-NN), never plan/wave/phase numbers.
- **Git:** commit/push only to `features/component-features-phase-5`; Conventional Commits titles with no phase/plan IDs; never `--no-verify`, amend, rebase; run `SKIP=npm-check pre-commit run --files <files>` first.
- **Never edit:** `CHANGELOG.md`, `README*.md`, PROJECT.md Key Decisions, `BACKLOG.md` (parent lines instead); the frozen-after-Phase-1 files; `.fallowrc.json`; the six invocation cores.
- **Append-only closed sets:** a new notification kind lands as its own commit.
- **Root container:** run every npm script with `npm_config_script_shell=/tmp/claude-0/-home-user-pi-claude-marketplace/90cd4c1a-120d-5946-a61c-4f1afb9521cf/scratchpad/nondac-sh NODE_OPTIONS=--max-old-space-size=6144`; warm ESLint with a lone `npm run lint` first.
- **Gates:** `npm run check` on the combined tree at each wave's post-merge gate and the phase gate; at the phase gate also the whole `npm run test:modules` and `npm run test:cucumber`.
- **GSD records:** prefix WINDOWS descriptions with `[component-features]`; every SUMMARY.md carries `## Threat Flags`.

## Summary

Phase 5 is mostly product work inside `bridges/hooks/**` plus a large, mechanical notification-kind addition in `shared/`. The harness question is the riskiest planning input, and the answer is good: every scenario the decisions need can be written from hook-owned steps without editing a frozen file. Three spike scenarios ran in this session against the real profile Pi (scratch files only, `/tmp/claude-0/-home-user-pi-claude-marketplace/90cd4c1a-120d-5946-a61c-4f1afb9521cf/scratchpad/phase-researcher/spike/`). They showed: RPC `compact` compacts a one-turn session once `<agent dir>/settings.json` sets `compaction.keepRecentTokens: 1`, and the scripted model plays the summarization calls (1 call for the first compaction, 2 for the second); RPC `fork` with an entry id from `get_fork_messages` works under `--no-session`; `PiProcess.stop()` from a step fires SessionEnd `quit` and the recorder line can be read before the release; two compactions in one session both succeed. Pi's `/reload` exists only in the TUI (`modes/interactive/interactive-mode.js:2617`), so D-CF5-03 needs the TUI driver (`features/lib/pi-tui.ts`).

The same spikes produced the red proofs for most product fixes: SessionStart/SessionEnd send `new`; compaction runs no SessionStart; UserPromptSubmit `additionalContext` replaces the user's prompt (the model saw `ctx-from-hook` instead of `hello there`); exec-form `args` reach the hook with a literal `${CLAUDE_PLUGIN_ROOT}`; an exit-1 hook with deny JSON lets the tool run; PostToolUse `additionalContext` and every `systemMessage` reach nobody; a `*` PreToolUse and PostToolUse hook each run twice for one `mcp` proxy call.

The hard part is file collisions. `dispatch.ts`, `event-adapters.ts`, `wire-protocol.ts`, and `exec-result.ts` are touched by almost every wave-2 topic. The ROADMAP's five parallel wave-2 plans cannot all be file-disjoint. The recommended layout keeps the session tracer in wave 1, runs process (exec-form) beside it, puts one "dispatch core and tool use" plan in wave 2 that owns the shared outcome model, and moves prompt/stop outputs and `onFailure` to wave 3 (the ROADMAP rule "the second fix moves to the next wave" licenses this).

**Primary recommendation:** Build wave 1 around a hook-owned "session action" step family that records a `ModelTurn` from `readLogLengths`/`readLogLinesSince` (precedent: `features/step_definitions/workflow/runs.steps.ts:96-110`), an order-insensitive runs step, an embedded-session-id projection for `CLAUDE_ENV_FILE`, and an extended `hook-files.ts` writer with script hooks (stable command text) — then sequence the product work so `dispatch.ts`/`event-adapters.ts`/`wire-protocol.ts` have one owner per wave.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Pi event subscription, session mapping triggers, compaction SessionStart, reload skip | `bridges/hooks/event-router.ts` (Pi event layer) | `dispatch.ts` | The only module with `pi.on`; holds the SSDEDUP-01 guard (`event-router.ts:910-924`). |
| Matcher/if filtering, dedupe, parallel run, routing-order fold | `bridges/hooks/dispatch.ts` | `settle.ts` (Stop/StopFailure use `collectBucketOutcomes`) | Both bucket walkers live here today (`reduceBucket` :173, `collectBucketOutcomes` :262). |
| Spawn, env, exec-form substitution, timeout, failure facts | `dispatch-exec.ts`, `spawn-helpers.ts`, `hook-env.ts`, `exec-timer.ts`, `async-rewake/registry.ts` | `shared/vars.ts` (reuse `substituteClaudeVars`) | Sanctioned child-process sites; `planSpawn` is shared by both lanes (`spawn-helpers.ts:34`, `registry.ts:208`). |
| Stdout/exit-code contract (decisions, context, systemMessage, onFailure) | `bridges/hooks/wire-protocol.ts` | `exec-result.ts` (outcome union) | Sole parser of Claude stdout field names (header :5-6). |
| Pi-side effects (block, input rewrite, tool-result edit, context carriers) | `bridges/hooks/event-adapters.ts` | `event-router.ts` `before_agent_start` drain | Adapters own the Pi return shapes (D-60-03). |
| Stdin payloads per event | `bridges/hooks/payloads/*.ts` | `translation-context.ts` | One translator per event (pinned by `test/architecture/hooks-translators.test.ts`). |
| Matcher closed sets, handler schema (`once`), unsupported-event partition | `domain/components/hook-events.ts`, `domain/components/hooks/{schema,partition}.ts` | `domain/hooks-resolution.ts` (manifest `hooks`, minimal edit) | Parse-time supportability gate (D-58-06). |
| User-visible `systemMessage` / prompt-block notice | `shared/notification-*.ts` (append-only new raw kind) | `docs/json-output.md`, `schema/claude-plugin.schema.json` | IL-2 chokepoint; JSON strategy appends a `claude-plugin` entry in rpc. |
| Behavioral observation | `features/step_definitions/hook/**`, `features/lib/hook-files.ts` | frozen `hook-recorder.ts`, `turn-records.ts`, scripted model, `pi-tui.ts` | Scenarios observe recorder lines, model calls, and `claude-plugin` entries only. |

## Standard Stack

No new packages. Everything runs on what is installed.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@earendil-works/pi-coding-agent` | 1.4.0 installed (`node_modules/@earendil-works/pi-coding-agent/package.json`) [VERIFIED: package.json "version": "1.4.0"] | Pi host: events, RPC, compaction, session runtime | Peer dependency pinned `>=1.4.0` (AGENTS.md) |
| `pi-mcp-adapter` | 7.0.0 in the optional-peer cache [VERIFIED: node_modules/.cache/optional-peers/node_modules/pi-mcp-adapter/package.json] | `mcp` proxy and nested `executeTool` hand-off for HOOK-08 | Declared floor `>=7.0.0 <8` |
| `@cucumber/cucumber` | repo devDependency (frozen `package.json`) | Behavioral suite | Project standard |
| `node:test` + `strong-mock` | repo | Unit tests | `typescript-unit-tests` skill |

### Supporting
| Library | Purpose | When to Use |
|---------|---------|-------------|
| `shared/vars.ts` `substituteClaudeVars` | Single-pass `${CLAUDE_PLUGIN_ROOT}`/`${CLAUDE_PLUGIN_DATA}`/`${CLAUDE_PROJECT_DIR}` replacement; unknown `${...}` and absent fields stay literal [VERIFIED: shared/vars.ts:68-73] | D-CF5-15 exec-form substitution — do not write a second substituter |
| `features/lib/turn-records.ts` `readLogLengths`/`readLogLinesSince` | Log window for a non-prompt action [VERIFIED: turn-records.ts:36-61] | Every hook-owned session/compact/fork/quit step |
| `features/lib/pi-tui.ts` `PiTuiSession` | Real-terminal Pi (`tui` mode) | `/reload` (D-CF5-03) and TUI quit `prompt_input_exit` (D-CF5-02) only |

**Installation:** none.

## Package Legitimacy Audit

Not applicable: this phase installs no external packages (`package.json` and `package-lock.json` are frozen after Phase 1).

**Packages removed due to [SLOP] verdict:** none. **Packages flagged as suspicious [SUS]:** none.

## Harness Feasibility (question 1)

Spike setup: a scratch step file and feature run with `npx cucumber-js --parallel 1 --import <scratch>/spike.steps.ts <scratch>/spike.feature`, importing the repo's frozen libs by absolute path. Nothing in the repo was edited. Outputs: `/tmp/claude-0/-home-user-pi-claude-marketplace/90cd4c1a-120d-5946-a61c-4f1afb9521cf/scratchpad/phase-researcher/spike/out/*.json`. Baseline: `npx cucumber-js features/hook features/plugin/session-start-hooks.feature` passes (3 scenarios, 32 steps).

### How a hook step records a "turn" from a non-prompt action

`ScenarioWorld.recordTurn(turn: ModelTurn)` is public (`features/support/world.ts:603-607`); `ModelTurn` is `{ prompt, disposition, records, logs }` (`world.ts:107-112`). Two shipped step modules already build turns from non-prompt actions: `features/step_definitions/workflow/runs.steps.ts:96-110` (`this.recordTurn({ prompt: command, disposition: "handled", records, logs })`) and `features/step_definitions/skill/aliases.steps.ts:71-97` (TUI, `records: []`). So a hook step can wrap any RPC action: `lengths = await readLogLengths(harness)`; `from = this.pi.recordCount()`; act; `records = this.pi.recordsSince(from)`; `logs = await readLogLinesSince(harness, lengths)`; `this.recordTurn(...)`. Then the owned `the hooks record these runs:` (reads `this.requireTurn().logs.get(HOOK_RUNS_LOG)`, `runs.steps.ts:260-267`) works unchanged. [VERIFIED: files read this session]

Caveat: `readLogLengths` calls `readdir(harness)`; the harness dir exists only after `usePiWithProfile` (`world.ts:546-548`). A step on the shared Pi or the TUI must `mkdir` `<home>/harness` first (the recorder itself does `mkdirSync`, `hook-recorder.ts:163-164`).

### F1. Compaction (HOOK-01, HOOK-03) — feasible, spike-proven

- RPC `compact` → `session.compact(command.customInstructions)` (`modes/rpc/rpc-mode.js:417-420`). Manual compaction emits `session_before_compact` (reason `manual`) and, after appending the entry, `session_compact` with `compactionEntry`, `fromExtension`, `reason`, `willRetry` (`core/agent-session.js:2230-2330`).
- A tiny session fails with "Nothing to compact (session too small)" under the default `keepRecentTokens: 20000` (`core/compaction/compaction.js:56`, `prepareCompaction` :609-662). The spike wrote `{"compaction":{"keepRecentTokens":1}}` to `<agent dir>/settings.json` before the profile Pi started; Pi reads it via `getCompactionTokenSetting` (`core/settings-manager.js:643-672`). The sandbox has no agent-dir `settings.json` (no writer in `test/e2e/_rpc.ts`), so a hook `Given` can write it with `flag: "wx"` and an `onRelease` removal, as `companion.steps.ts:60-65` does for the project settings file. The `Given` must run before `pi runs with the scripted model`.
- Spike result (one prompt, then `compact`, a second prompt, then `compact`): first compaction made **1** model call (split-turn prefix only), the second made **2** (history + split-turn prefix). Response `summary` of the second: `"Summary C\n\n---\n\n**Turn Context (split turn):**\n\nSummary D"`. The scripted model answers summarization calls like any call (`scripted-model/extension.ts:81-109`), so the script must list one reply step per summarization call. Both compactions kept the same session id. Today PreCompact and PostCompact ran with `trigger: "manual"`; **no SessionStart ran** (red proof for D-CF5-04).
- `compact_summary` will be a multi-line string; Gherkin table cells accept `\n` escapes (the seed's `bash returned: from-model\n` cell, `features/hook/tool-use.feature`).
- The RPC response comes after `session_compact` handlers finish (`await this._extensionRunner.emit({type:"session_compact",...})` precedes `compaction_end` and the return), so a step can read the log right after the response.

### F2. New session, fork, resume, quit, reload (HOOK-02)

| Action | Driver | Spike result today | Notes |
|--------|--------|--------------------|-------|
| new | RPC `new_session` (`rpc-mode.js:334-344`) | SessionEnd `reason:"new"` (old id), SessionStart `source:"new"` once (guard works) | The frozen `When the user starts a new pi session` keeps session payloads but records no turn, so a hook-owned When is needed to read runs. |
| fork | RPC `get_fork_messages` → `fork { entryId }` (`rpc-mode.js:481-487,499-502`) | SessionEnd `reason:"fork"`, SessionStart `source:"fork"`, new session id | In-memory fork path: `core/agent-session-runtime.js:236-249`. Needs a user-message entry id. |
| clone | RPC `clone` (`rpc-mode.js:488-498`) | not run | Uses `fork(leafId, {position:"at"})` → same `fork` reason. |
| resume | RPC `switch_session { sessionPath }` (`rpc-mode.js:474-480`) | not run | Needs an on-disk session file (`SessionManager.open`, runtime :128-146); `--no-session` (`test/e2e/_rpc.ts:251`) gives none. A step would have to hand-write a Pi session JSONL — fragile. Recommend unit tests only for `resume` (the mapping is identity). |
| quit (rpc) | `this.pi.stop()` from a step (`pi-process.ts:234-252`; second call is a no-op) | SessionEnd `reason:"quit"` recorded before the release | `dispose()` emits `session_shutdown` `quit` (`agent-session-runtime.js:296-303`); RPC stdin end → `shutdown` → `runtimeHost.dispose()` (`rpc-mode.js` `onInputEnd`). D-CF5-02 maps to `other`. After `stop()` the release's `pi.stop()` does nothing and `assertStandInsStopped` still runs. |
| quit (tui) | `PiTuiSession.stop()` sends `\u0003\u0003` and waits for exit (`pi-tui.ts:295-311`) | not run | `ctx.mode === "tui"` → `prompt_input_exit`. |
| reload | TUI only: type `/reload` (`interactive-mode.js:2617-2620`, `handleReloadCommand` :5328) | not run | RPC has no `/reload`; only extension commands can call `ctx.reload()` (`rpc-mode.js` `commandContextActions.reload`). Option B: a hook-owned Pi extension that registers a command calling `ctx.reload()`, loaded through `extraExtensions` — but Phase 5 owns only `features/lib/hook-files.ts` in `features/lib/` (ownership question, see Open Questions). Pi's reload emits `session_shutdown` `reload` then `session_start` `reload` (`core/agent-session.js:2998-3030`). |

TUI scenarios need hooks installed through the shared Pi first (the TUI does not load the scripted model unless passed, see `aliases.steps.ts:55-70`), then `this.startTuiSession()` (`world.ts:653-668`), which registers its own release.

### F3. Reading runs outside a prompt turn

Covered by the turn pattern above. Two harness gaps the wave-1 plan must close in owned files:

1. **Parallel order (D-CF5-09).** `the hooks record these runs:` compares rows in append order (`runs.steps.ts:260-266`). With parallel hooks, two runs of one event append in completion order. Add an owned step (for example `the hooks record these runs in any order:`) that sorts both the stated rows and the actual rows (all columns) before `deepStrictEqual`. Sorting is not filtering, so it stays inside "no step filters or dedupes records".
2. **`CLAUDE_ENV_FILE` embeds the session id.** Every SessionStart run carries `CLAUDE_ENV_FILE = <dataRoot>/_shared/claude-env-${transCtx.sessionId}.env` [VERIFIED: hook-env.ts:73-75 `const envFile = path.join(loc.dataRoot, "_shared", \`claude-env-${transCtx.sessionId}.env\`)`]. The runs step replaces only a whole-value session id with its ordinal (`runs.steps.ts:226-231`), and the recorder records every `CLAUDE_*` variable (`hook-recorder.ts:126-139`), so a SessionStart row has a cell no literal can state. `runs.steps.ts` must project an embedded session id. The token text (for example `{first session id}`) is not in the frozen `features.md` token list, so the token wording needs a parent line for the cucumber skill (frozen). Alternative that avoids a new token: project the whole `CLAUDE_ENV_FILE` cell as `{project dir}/.pi/pi-claude-marketplace/data/_shared/claude-env-first.env` (ordinal in place of the id). Either way, document it in the runs step module.

### F4. Hooks that block, print JSON, exit with a code, sleep, or use exec form/`if`/`onFailure`/`timeout`/`async`

`features/lib/hook-files.ts` (owned) writes one group per row with command `"<node>" "<recorder>" <name>` (`hook-files.ts:52-73`). The recorder reads all of stdin, appends one line, exits 0 with no output (`hook-recorder.ts:150-171`). Shell-form commands run through `/bin/sh -c` (`spawn-helpers.ts:45-47`), so a wrapper `<recorder command>; printf '%s' '<json>'; exit <code>` works — the spike ran `...; printf '%s' '{...}'` and `...; printf ...; exit 1` and `...; sleep 1` successfully.

Recommendation for the writer:

- **Script hooks for stable command text.** Upstream messages quote the raw hook command: onFailure `[<cmd>]: failed; blocking because onFailure is "block"\n<stderr>` (E6) and PostToolUse block `PostToolUse:Bash hook blocking error from command: "${CLAUDE_PLUGIN_ROOT}/hooks/hk.sh POSTB 0 post_block.json": POSTB-B` [CITED: research-c/probe/run2/stream.jsonl, discuss-phase probe]. A recorder command embeds `process.execPath`, which no run token covers, so any scenario that states such a message must use a command whose text is stable. Write `hooks/<name>.sh` into the plugin (`#!/bin/sh` + the recorder line + the extra behavior), `chmod 0o755` it, and use `command: "${CLAUDE_PLUGIN_ROOT}/hooks/<name>.sh"` (shell form expands the env var). Dir-source plugins run in place (`CLAUDE_PLUGIN_ROOT` = `{home}/marketplaces/fixtures/plugins/demo` in the seed), so the mode bit survives.
- **Exec-form rows** (`args` present): `command: process.execPath`, `args: [HOOK_RECORDER_PATH, name, "${CLAUDE_PLUGIN_ROOT}/x"]` → the recorder's `arguments` column shows the substitution (spike: today `${CLAUDE_PLUGIN_ROOT}/x` arrives literally). For `command` substitution, `command: "${CLAUDE_PLUGIN_ROOT}/hooks/<name>.sh"` with `args: []`.
- **Extra columns.** Keep `| name | event | matcher |` (the seed and `parseRecordingHooks` header check, `hook-files.ts:28-50`) and add a second parser for a closed set of optional columns, such as `output` (stdout text), `exit code`, `stderr`, `sleep`, `timeout`, `if`, `on failure`, `once`, `form` (`shell`/`exec`/`script`). Throw on an unknown column, as the skill requires.
- **Deadlock probe for parallelism.** Two script hooks that each create `<name>.ready` in a scratch dir under `{home}` and wait (bounded, for example 3 s) for the other's file, then print `additionalContext`: sequential dispatch times one out (no context), parallel dispatch gives both. A whole-value, timing-free red proof of D-CF5-09.

### F5. Observing `systemMessage` and `additionalContext`

- **systemMessage.** In `rpc` mode the notify chokepoint uses the JSON strategy, which appends a `claude-plugin` custom entry. Pi prints `entry_appended` records; `PiProcess` keeps every record (`pi-process.ts:258-278`) and a model turn keeps `records` (`session.steps.ts:107`). A hook-owned `Then` can select `entry_appended` records with `entry.customType === "claude-plugin"`, validate each payload with the published schema (as `pi-commands.ts:100-112` does), and compare whole payloads. Spike: today no such record appears for a hook `systemMessage` (red proof for D-CF5-14).
- **additionalContext.** Custom messages reach the LLM as `role: "user"` (`core/messages.js:89-96`), so `the model receives these calls:` (frozen `model.steps.ts:68-76`) shows them as `user` rows. SessionStart context today goes into the system prompt (`event-router.ts:193-208`), checkable with `the model call {int} receives this system prompt:`; after D-CF5-13 it moves to a `user` row.
- **Stop re-entry turns.** `the user prompts` waits for the first `agent_settled` (`session.steps.ts:98-105`). Pi runs extension `agent_settled` handlers (the Stop bucket) **before** it emits the RPC `agent_settled` (`core/agent-session.js:683-691`), so Stop hook runs are in the turn's log. A Stop block re-enters through `sendMessage(..., {triggerTurn:true})`, which Pi defers until after the settle event (`_deferredSettledActions`, `agent-session.js:1865-1869`, :695-704). The re-entry turn therefore runs after the step has read the turn. Any scenario on Stop block/feedback needs a hook-owned When that waits for a second `agent_settled`.
- **Dialogs.** The prompt step fails a turn that shows a dialog (`session.steps.ts:42-52`); `PiProcess` cancels every dialog (`pi-process.ts:333-338`). So `ask` must never call `ctx.ui.confirm` outside `tui` (D-CF5-11 already says so).

### F6. HOOK-08 MCP setup without Phase 6 files

The MCP publishing and listing-wait steps live in Phase 6's `features/step_definitions/mcp-server/calls.steps.ts:84-152`, and the `.mcp.json` writer is Phase 6's `features/lib/mcp-server-files.ts`. Phase 5 must write its own: `hook-files.ts` writes `.mcp.json` with `{ command: process.execPath, args: [MCP_STUB_SERVER, plugin, server] }` (`MCP_STUB_SERVER` from frozen `mcp-stub-server.ts:28`), and a hook step waits for the listing with `readStubRequests`/`stubPidFiles` (frozen, `mcp-stub-server.ts:81,103`). Write them differently enough to avoid a fallow clone group with Phase 6's copies (`fallow dupes --fail-on-issues` fails on any group, STACK.md). Install through the shared Pi before the profile Pi starts (`world-and-stand-ins.md`: a new RPC session binds twice and starts two listings).

Spike (one scripted `mcp` call): today PreToolUse `*` ran twice (`tool_name: "mcp"` with `tool_input {"tool":"mcp__plugin_demo_stub__echo","args":{"text":"ping"}}`, then `tool_name: "mcp__plugin_demo_stub__echo"` with `tool_input {"text":"ping"}`), the literal-matcher hook ran once, and PostToolUse `*` ran twice. That is the red proof for D-CF5-12.

## Pi 1.4 API Facts (question 2)

All from `node_modules/@earendil-works/pi-coding-agent/dist/`. [VERIFIED: read this session]

| Need | Fact | Source |
|------|------|--------|
| `session_start` reasons | `reason: "startup" \| "reload" \| "new" \| "resume" \| "fork"`; `previousSessionFile?` | `core/extensions/types.d.ts:575-581` |
| `session_shutdown` reasons | `reason: "quit" \| "reload" \| "new" \| "resume" \| "fork"`; `targetSessionFile?` | `types.d.ts:637-642` |
| `ctx.mode` | `ExtensionMode = "tui" \| "rpc" \| "json" \| "print"`; `hasUI` true in TUI and RPC | `types.d.ts:212-219`; bridge alias `platform/pi-api.ts:74` |
| `session_before_compact` | `{ preparation, branchEntries, customInstructions?, reason: "manual"\|"threshold"\|"overflow", willRetry, signal }`; result `{ cancel?, compaction? }` | `types.d.ts:601-611`, `:1137-1140` |
| `session_compact` | `{ compactionEntry, fromExtension, reason, willRetry }`; `CompactionEntry.summary: string` | `types.d.ts:613-621`; `core/session-manager.d.ts:46-59` |
| `before_agent_start` result | `{ message?: Pick<CustomMessage,"customType"\|"content"\|"display"\|"details">; systemPrompt?: string }`; every handler's `message` is collected | `types.d.ts:1125-1129`; `core/extensions/runner.js:1130-1150` |
| Where the `message` lands | `_prepareRun`: `[starting user message, ...nextTurn messages, ...handler messages]`, persisted as custom messages | `core/agent-session.js:1480-1527` |
| `pi.sendMessage` while streaming | `triggerTurn:false` → queued in `_pendingCustomMessages`, flushed at `turn_end` (after the turn's tool results), which sets `agent.state.messages` from the session projection, so the next model call sees it; without `triggerTurn:false` while streaming → `agent.steer`; `deliverAs:"nextTurn"` → before the next run | `agent-session.js:1844-1882`, `:788-797`, `:570-577` |
| Custom message to the model | `role: "custom"` → `role: "user"` with the same content | `core/messages.js:89-96` |
| `ctx.ui.confirm` in RPC | Emits `extension_ui_request` method `confirm`; resolves `false` on cancel | `modes/rpc/rpc-mode.js:85` |
| `tool_call` result | `{ block?: boolean; reason?: string; terminate?: boolean }`; mutate `event.input` in place to change arguments (no re-validation) | `types.d.ts:1089-1099`, `:975-984` |
| `tool_result` result | `{ content?, details?, structuredContent?, isError?, usage? }` (bridge mirrors a subset in `pi-api.ts:109-113`) | `types.d.ts:1114-1120` |
| Nested calls | `toolCallId` `<parent id>/<n>`, `parentToolCallId?` on `tool_call`/`tool_result` | `types.d.ts:931-941`, `:985-991` |
| pi-mcp-adapter hand-off | proxy calls `ctx.executeTool(registered, args ?? {})` so Pi hooks see the real tool | `pi-mcp-adapter/index.ts:964-1015` |
| Namespace proxy name | `mcp__${formatServerNamespace(serverName)}` | `pi-mcp-adapter/mcp-references.ts:38-40` |
| `input` result | `{action:"continue"} \| {action:"transform", text, images?} \| {action:"handled"}` | `types.d.ts:922-930` |
| `/reload` | Interactive mode only | `modes/interactive/interactive-mode.js:2617` |
| `ctx.abort()` | Present on `ExtensionContext` | `types.d.ts:241-242` |

**`platform/pi-api.ts` (frozen) is sufficient.** Every type the plan needs is reachable from what it re-exports (`pi-api.ts:45-63`): `SessionCompactEvent["compactionEntry"]["summary"]`, `ToolCallEvent["parentToolCallId"]`, `ToolCallEventResult["terminate"]`, `BeforeAgentStartEventResult["message"]`, `ExtensionContext["ui"]["confirm"]`, `ExtensionMode`. No parent line for `pi-api.ts`. [VERIFIED: pi-api.ts read]

## Architecture Patterns

### System Architecture Diagram

```text
Pi events ──► event-router.ts (pi.on, 11 registrations; hooks-lifecycle test pins the order)
  session_start ──[SSDEDUP-01 guard; reason=reload → hydrate+mkdir only, no dispatch]──┐
  session_shutdown ──[reason=reload → no dispatch; map reason+ctx.mode]──────────────────┤
  session_before_compact ──► PreCompact                                                  │
  session_compact ──► SessionStart(source=compact) then PostCompact(compact_summary) ────┤
  input ──► UserPromptSubmit           tool_call ──► PreToolUse [skip call-mode mcp proxy]│
  tool_result ──► PostToolUse | PostToolUseFailure [skip call-mode proxy]                │
  agent_settled ──► settle.ts ──► Stop | StopFailure                                     │
                                                                                         ▼
                    dispatch.ts: bucket → matcher (mapped value) → if → DEDUPE (E10 key)
                                   → run all in PARALLEL (Promise.all, one snapshot)
                                   → FOLD in routing order
                                         │ per entry
                                         ▼
     dispatch-exec.ts: translate payload → env (hook-env.ts) → planSpawn(entry, env)
        [exec form: substitute command + args] → spawn → collect stdout/stderr/exit/timeout
                                         │
                                         ▼
     wire-protocol.ts: exit/stdout/stderr/facts → HookExecResult (+context, +systemMessage)
                                         │ folded result
                                         ▼
     event-adapters.ts: Pi return (block/terminate, input rewrite, tool_result edit)
        + carriers: pending buffer → before_agent_start message (SessionStart, UPS);
          pi.sendMessage(triggerTurn:false) (tool events); settle re-entry (Stop)
        + notify chokepoint: systemMessage → new HookSurface kind → claude-plugin entry (rpc)
```

### Recommended file changes (owned unless marked)

```text
extensions/pi-claude-marketplace/
├── bridges/hooks/event-router.ts        # S2/S3/S5 session wiring; context drain (or extract a leaf)
├── bridges/hooks/dispatch.ts            # S1 mapped filters; T1 parallel fold; T2 dedupe; T6 proxy skip
├── bridges/hooks/event-adapters.ts      # T3-T5 decisions; O1/O2 carriers
├── bridges/hooks/exec-result.ts         # outcome union: shared context/systemMessage fields, ask arm
├── bridges/hooks/wire-protocol.ts       # decisions, context, systemMessage, plain stdout, onFailure
├── bridges/hooks/dispatch-exec.ts       # P1 call site; C3 failure facts (spawn error, timeout)
├── bridges/hooks/exec-timer.ts          # C3: expose "timed out"
├── bridges/hooks/spawn-helpers.ts       # P1 planSpawn(entry, env) substitution
├── bridges/hooks/async-rewake/registry.ts # P1 call site only
├── bridges/hooks/settle.ts              # O3 Stop: every reason, every context, systemMessage
├── bridges/hooks/runtime.ts, routing-state.ts # pending buffer generalized (event label)
├── bridges/hooks/payloads/{session-start,session-end,post-compact,pre-tool-use,...}.ts
├── bridges/hooks/translation-context.ts # carry ctx.mode if SessionEnd maps there
├── domain/components/hook-events.ts     # closed sets + header (D-CF5-21)
├── domain/components/hooks/schema.ts    # `once`, `onFailure` on the handler schema
├── domain/hooks-resolution.ts           # NOT owned: D-CF5-20 minimal edit
└── shared/notification-*.ts             # NOT owned: D-CF5-14 append-only kind, own commit
```

### Design S1–S5: session mapping (D-CF5-01..05)

- **S1 One mapping site per event.** Export `claudeSessionStartSource(reason)` and `claudeSessionEndReason(reason, mode)` (for example from `payloads/session-start.ts` / `payloads/session-end.ts`) and use them in both the translator and the dispatch filter. Today the translator passes `event.reason` through (`payloads/session-start.ts:34`, `payloads/session-end.ts:33`) and the filter compares the raw reason (`dispatch.ts:497-499`). Recommended shape: event-router builds a bridge-internal Claude-side event (`{ source: "startup"|"resume"|"clear"|"compact"|"fork" }`, `{ reason: "clear"|"resume"|"prompt_input_exit"|"other" }`) before dispatch, so `entryFires` and the translator read one value. `CompositeEventFor<"SessionStart">`/`<"SessionEnd">` (`dispatch.ts:458-470`) change with it.
- **S2 Closed sets.** `NON_TOOL_EVENT_CLOSED_SETS.SessionStart` is today `new Set(["startup", "resume"])` and `SessionEnd` is `new Set<string>([])` [VERIFIED: hook-events.ts:262,266]. New: SessionStart `startup, resume, clear, compact, fork`; SessionEnd `clear, resume, prompt_input_exit, other, logout`. Rewrite the header table and the per-event derivation comment (`hook-events.ts:149-157,217-257`), including the stale `bypass_permissions_disabled` line (:225-226).
- **S3 Compaction.** In the `session_compact` registration (`event-router.ts:971-976`), run the SessionStart composite with `{source:"compact"}` to completion, then the PostCompact composite. Keep the registration count at 11 (`test/architecture/hooks-lifecycle.test.ts:375-387` pins the order and slices at 11). Call `ensureSharedDataDir` for the SessionStart scopes as the `session_start` path does (`event-router.ts:937-946`), since compaction SessionStart also gets `CLAUDE_ENV_FILE`. The SSDEDUP-01 guard stays only on `session_start` (D-CF5-05).
- **S4 PostCompact payload.** Add `compact_summary: event.compactionEntry.summary` (`payloads/post-compact.ts:24-35`).
- **S5 Reload.** In `session_start`, `reason === "reload"`: keep the lazy project hydrate, rebuild, and `ensureSharedDataDir`; skip dispatch. In `session_shutdown`, `reason === "reload"`: skip dispatch. Both factories run per generation, so the `reload` session_start lands on the new generation's handler.
- **Filters for PreCompact/PostCompact/SessionEnd.** `entryFires` returns `true` for them today (`dispatch.ts:507-511`). Use `matcherFiresOnClosedSetValue(entry, value)` (`dispatch.ts:137-140`) with the mapped trigger/reason.

### Design T1–T6: dispatch core and tool use (D-CF5-09..12)

- **T1 Parallel fold.** Replace `reduceBucket`'s sequential loop (`dispatch.ts:173-231`) with: filter (matcher, `ifFires`) → dedupe → `Promise.all(entries.map(e => executor(e, event, ctx, pi, runtime)))` → generation re-check → fold in routing order. Each executor serializes stdin synchronously before its first `await` (`dispatch-exec.ts:190-195`), so all hooks see one snapshot. Fold: any `stop` → stop (first in routing order supplies `stopReason`); else any block/deny → block; else any ask → ask; else the winning allow/mutate; `updatedInput` from the winning decision, ties to the last in routing order; `additionalContext` and `systemMessage` collected from every result in routing order. `collectBucketOutcomes` (`dispatch.ts:262-300`, used by settle) gets the same filter + dedupe and can run in parallel too (its `asyncRewake` degrade stays). Delete the "Sequential awaited fan-out preserved (DISP-04)" comments (`dispatch.ts:38-41`, `event-router.ts:27-29`, `routing-state.ts:39-41`).
- **T2 Dedupe key.** Upstream: `${pluginRoot??skillRoot??settingsSource}\0command\0${shell??"bash"}\0${command}\0${JSON(args??null)}\0${if??""}` (E10). Bridge: `${entry.resolvedSource}\0command\0${shell ?? "bash"}\0${command}\0${JSON.stringify(args ?? null)}\0${if ?? ""}`, keeping the first position and the last copy's `handlerDecl`. Apply after matching.
- **T3 Outcome model.** `HookExecResult` forbids a block that also carries context (`exec-result.ts:40-51`), but E13 says tool context reaches the model even when denied, and systemMessage rides any decision. Recommended: add optional `additionalContext?: string` and `systemMessage?: string` to every arm, and an explicit `ask` arm (`{ kind: "ask"; reason?: string }`) so the fold sees deny > ask > allow. Adding an arm breaks every exhaustive switch (`event-adapters.ts` four adapters, `dispatch.ts:202-227`, `settle.ts` scans) — that is the NFR-7 guard working; update them in the same plan.
- **T4 Wire protocol.** Today non-zero, non-2 exits are `noop` before stdout is read (`wire-protocol.ts:42-47`) and `systemMessage` is never read. Changes: parse JSON stdout on exit 0 and on other exits when it is valid deny JSON (E15 "exit 1 with valid deny JSON applies the deny"); on exit 2 prefer a JSON reason over stderr (D-CF5-11); read top-level `systemMessage`; read `hookSpecificOutput.additionalContext` for every event; treat plain (non-JSON) stdout as context for SessionStart and UserPromptSubmit only (needs the event as a parameter); `permissionDecision:"ask"` → ask; `"defer"` ignored with a debug line.
- **T5 Tool adapters.** `ask`: block with the reason in `print`/`json`/`rpc`; `ctx.ui.confirm(title, message)` in `tui` (block when it returns `false`). Deny: `{ block: true, reason }`. `continue:false` on PreToolUse: `{ block: true, reason, terminate: true }` (`types.d.ts:1094-1098`; terminate only ends the batch when every result sets it). `updatedInput` replaces the whole input: delete every own key of `event.input`, then copy the new keys (keep the `__proto__` skip, `event-adapters.ts:114-127`). PostToolUse/PostToolUseFailure block keeps the output: return `content: [...event.content, { type: "text", text: <feedback> }]` without forcing `isError`, instead of today's replacement (`event-adapters.ts:208-219`). Tool `additionalContext`: `pi.sendMessage({ customType, content: "<Event>:<Tool> hook additional context: <values joined by \n>", display: false }, { triggerTurn: false })` — this reaches the next model call after the tool result. Upstream joins every hook's value into one block per event with `\n` (`PreToolUse:Bash hook additional context: PREA-CTX-MARK\nPRED-CTX-MARK`) [CITED: research-c/probe run1 request log]. The adapter then needs `pi` and `ctx`; thread them from the composite handlers.
- **T6 MCP proxy.** In the PreToolUse composite and `toolResultCompositeHandler`, return before the bucket walk when the event is a call-mode proxy: `toolName === "mcp"` (or a namespace proxy `mcp__<server>` with no further `__<tool>` segment), `typeof input.tool === "string"`, and `input.action === undefined`. The nested call then fires once with `tool_input` = the arguments (spike). Namespace detection by name is MEDIUM confidence; cover it with unit tests and keep the scenario on the `mcp` proxy.
- **Payload extras (discretion).** Upstream stdin carries `tool_use_id` and, for MCP tools, `mcp_server` (shape `{ name }` per the decompiled `"mcp_server"in r&&r.mcp_server?{serverName:r.mcp_server.name}`) [ASSUMED shape]. Adding `tool_use_id` adds a column to every tool runs table whose value is Pi's random `toolCallId` (spike: `tool:1793538355595:b95izsp16u`), so `runs.steps.ts` would need a `{tool call <n>}` projection (today only the MCP stub step projects it). Recommend deferring both to a BACKLOG line unless a wave-1 plan adds that projection.

### Design O1–O4: outputs (D-CF5-13, D-CF5-14)

- **O1 UserPromptSubmit context beside the prompt.** Today `mutate.additionalContext` → `{ action: "transform", text }` (`event-adapters.ts:255-258`), which replaced `hello there` with `ctx-from-hook` in the spike. New: `input` returns `undefined` (continue) and buffers `UserPromptSubmit hook additional context: <values>`; the `before_agent_start` handler returns it as `message`. Placement after the user message matches `_prepareRun` (`agent-session.js:1505-1523`). Do not use `deliverAs:"nextTurn"`: a later block of the same prompt would leak it into the next turn.
- **O2 SessionStart context persists.** Today the drain appends to `systemPrompt` for one turn (`event-router.ts:199-207`). New: return `message` (a persisted custom message), so later turns keep it in history. Text `SessionStart hook additional context: <values>`. `test/integration/hooks-additionalcontext-end-to-end.test.ts` pins the `systemPrompt` form and must change.
- **O3 Stop.** Today the first block or the first context re-enters with the raw reason (`settle.ts:287-304`). New: every block reason as `Stop hook feedback:\n<reason>` (upstream sends one user message per reason [CITED: research-c win_loop.txt / run stream "Stop hook feedback:\nSTOP1-REASON"]), every context value; one re-entry through `reenterBounded` so the STOP-07 cap still counts once. Content can be an array of text parts (one per reason) in one custom message.
- **O4 systemMessage.** New raw kind in `HookSurface` (`shared/notification-types.ts:1720` today: `export type HookSurface = AsyncRewakeSummarySurface | StopOverrideCapSurface;`). Emit text `<Event>[:<Tool>] says: <text>` (upstream `UserPromptSubmit says: UPS-SYSMSG-MARK`, `PreToolUse:Bash says: ...`, `Stop says: ...` [CITED: research-c/probe/run1/stream.jsonl]) at severity `info`, on PreToolUse, PostToolUse, PostToolUseFailure, UserPromptSubmit, Stop, SessionStart; drop on SessionEnd, PreCompact, PostCompact, StopFailure. Open a hook-origin run with `openNotificationRun(pi, { kind: "hook" })` as settle does (`settle.ts:156`).

**Files and counters for the new kind (D-CF5-14), following `async-rewake-summary` and `stop-override-cap`** [VERIFIED: repo-wide grep of both kinds this session]:

| File | Edit |
|------|------|
| `shared/notification-types.ts` | new `...Surface` interface; add to `HookSurface` (:1720) |
| `shared/notification-resolve.ts` | `RAW_SURFACE_SEVERITY` entry (:625-637); pass-through arm in the resolve switch (:712-718) |
| `shared/notification-grammar.ts` | text arm next to `async-rewake-summary` (:1360-1369) |
| `shared/notification-json.ts` | JSON arm (:231 area) |
| `shared/notification-wire.ts` | payload schema (next to :690-700) and union membership |
| `shared/notification-dispatch.ts` | `isRawOutcome` switch arm (:85-103); exported `notify...` emitter (next to :432-442) — land it with its first caller, or fallow `dead-code` fails on an unused export |
| `schema/claude-plugin.schema.json` | regenerate with `npm run schema:generate` (`scripts/generate-wire-schema.mjs`) |
| `docs/json-output.md` | `#### <kind>` section + `<!-- fields: kind:<kind> -->` marker (pattern :473-491) |
| `docs/output-catalog.md` | optional section like "Stop hook override cap reached" (:5196-5206); a new `catalog-state:` only if it is under a counted section (`EXPECTED_STATE_COUNT = 324`, `EXPECTED_UTF8_BYTES = 54_615`, `test/architecture/catalog-uat/catalog-contract.test.ts:21-22`) |
| tests | `test/shared/notification-{types,resolve,grammar,json,wire,dispatch}.test.ts`; `test/architecture/catalog-uat/catalog-wire.test.ts` (`RAW_ORIGINS` :172-173, `RAW_SAMPLES` :221-222, sorted kind list :510-512); `test/architecture/json-output-docs.test.ts` (:278-279); `test/architecture/wire-schema.test.ts` (:104-105); a byte-lock test like `test/architecture/hooks-cap-notify.test.ts` (owned `hooks-*`) |

`test/architecture/notify-closed-set-locks.test.ts` locks reasons, not raw kinds (grep shows only `"orphan rewake": true` at :77). D-CF5-20 reuses the existing `{unsupported hooks}` reason, so no reason is added.

The UserPromptSubmit block notice (D-CF5-11) has upstream text `UserPromptSubmit operation blocked by hook:\n<reason>\n\nOriginal prompt: <prompt>` [CITED: research-c/probe/run4/stream.jsonl]. Whether it reuses the new kind or adds a second one is open (see Open Questions).

### Design P1: exec form (D-CF5-15)

`planSpawn(entry)` uses `command` and `args` verbatim (`spawn-helpers.ts:34-48`). Change it to `planSpawn(entry, env)` and, only on the exec-form arm, map `command` and each string `args` element through `substituteClaudeVars(text, { pluginRoot: env.CLAUDE_PLUGIN_ROOT, pluginData: env.CLAUDE_PLUGIN_DATA, projectDir: env.CLAUDE_PROJECT_DIR })` (no `skillDir`, so `${CLAUDE_SKILL_DIR}` and `${user_config.*}` stay literal) [VERIFIED: shared/vars.ts:68-73]. Both call sites already have the env: `dispatch-exec.ts:194-195,288` and `async-rewake/registry.ts:207-208`. Shell form stays untouched. Non-string `args` elements are JSON-stringified today (`spawn-helpers.ts:39-41`); leave that.

### Design C1–C4: configuration (D-CF5-17..20)

- **C1 `once`.** `once` sits on the group schema today (`domain/components/hooks/schema.ts:45`); handler properties list `type, command, if, timeout, asyncRewake, rewakeMessage, rewakeSummary` (:20-28) and `HookHandlerEntry` has an index signature (:14), so handler fields already reach `handlerDecl`. Add `once: {}` and `onFailure: {}` to the handler properties; keep it inert; docs say plugin hooks ignore `once` (E6).
- **C2 `if`.** Works today for tool events (`if-field/index.ts:474+`). Possible gap found while reading upstream: upstream skips a hook whose `if` is set on a non-tool event (`Hook if condition "..." cannot be evaluated for non-tool event ...` then `return []`) [CITED: research-c/win_sysmsg.txt binary excerpt]; the bridge compiles it to `MATCH_ALL_IF` and runs it (`if-field/index.ts:468-472`). No decision covers this (Open Question 1).
- **C3 `onFailure`.** Facts the parser needs: spawn error (today `child.once("error")` → `noop`, `dispatch-exec.ts:392-397`), exit code, timeout (the ladder has only `cancel()`, `exec-timer.ts` `TimerLadder`; add a "fired" flag or callback), stdout that starts with `{` and fails `JSON.parse`. With `onFailure: "block"` on a sync command hook, these become `{ kind: "block", reason: \`[${command}]: failed; blocking because onFailure is "block"\n${stderr}\` }` (`timed out` variant) (E6). Ignore it on `asyncRewake`, `async`, and Stop (debug line). On SessionStart/SessionEnd/PostCompact the observation adapter debug-logs the block today (`event-adapters.ts:316-320`); "reported as the event's error" is ambiguous (Open Question 3).
- **C4 Manifest `hooks` (D-CF5-20).** In `resolveHooks` (`domain/hooks-resolution.ts:165-196`), when `input.manifest?.hooks` or `input.entry.hooks` is set, add `"hooks"` to `resolution.unsupported` (once) and a `droppedHooks` entry so info names it. **Pitfall:** upstream skips a manifest `hooks` string that resolves to the standard `hooks/hooks.json` ("names the standard hooks/hooks.json, which loads on its own; loaded once") [VERIFIED: discuss-phase binary grep, research-b/manifest-hooks.txt, `if(vn&&yF(e,$o)===Hc(To))continue`]. Many real plugins write `"hooks": "./hooks/hooks.json"`; flagging them would turn a fully supported plugin into `--partial`. Exclude a string (or array element) that resolves to the default path. Also note upstream accepts only the inline form in a marketplace entry (string/array forms are a load error there). The `DroppedHook` union (`hooks/partition.ts:72-80`) is mirrored by a TypeBox drift check in `domain/resolver-types.ts:20-60` (not owned); a new arm would need that file. Reusing `{ kind: "event", event: <label> }` avoids it; info renders it as `<label> (unsupported)` via `projectDroppedHookEntries` (`orchestrators/plugin/info.ts:676-704`).
- **C5 Unsupported events (D-CF5-19).** Code unchanged: `partitionHooks` drops any non-admitted event as `{ kind: "event" }` (`partition.ts:175-179`). A scenario proves install needs `--partial` and info shows `<event> (unsupported)`.

### Design L1: lifecycle (D-CF5-22)

Disable/uninstall/update already rebuild routing through `HooksRouting` (`event-router.ts:265-292`) and the hydrate skips disabled records (`event-router.ts:565-572`). Expect scenarios only; a red proof is needed only if a scenario exposes a bug.

### Anti-Patterns to Avoid

- **Two mapping sites.** Mapping `new`→`clear` in the translator but filtering on Pi's raw reason (today's bug class, `dispatch.ts:497-499`).
- **Mutating the event between parallel hooks.** Apply `updatedInput` once, after the fold.
- **Calling `ctx.ui.confirm` outside `tui`.** It fails the scenario turn (dialog) and blocks headless runs.
- **`deliverAs:"nextTurn"` for UserPromptSubmit context.** A blocked prompt would leak it.
- **Stating raw recorder commands in expected messages.** They contain `process.execPath`; use script hooks.
- **Using Phase 6's MCP steps or lib in a hook feature.**
- **A new exported helper with no caller in the same commit.** `fallow dead-code` fails.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| `${CLAUDE_*}` substitution | a new regex | `shared/vars.ts` `substituteClaudeVars` | single pass, no re-expansion, absent field stays literal (:52-67) |
| Log windows for a step | ad hoc file reads | `readLogLengths`/`readLogLinesSince` | frozen generic reader, used by session/workflow/skill steps |
| Turn recording | world fields or module state | `this.recordTurn(...)` + `markTurnCompared()` | world rule: no module-level mutable state under `features/` |
| Payload validation in steps | hand checks | `NOTIFICATION_PAYLOAD_SCHEMA` compiled validator (as `pi-commands.ts:44,100-112`) | DRV-01 |
| Closed-set matcher check | string compares in dispatch | `matcherFiresOnClosedSetValue` (`dispatch.ts:137-140`) | already shared by SessionStart and StopFailure |
| Wire schema JSON | hand edit | `npm run schema:generate` | `wire-schema.test.ts` compares |
| Timeout ladder | a second timer | `installTimerLadder` + a fired flag | TOCTOU and SIGKILL escalation already handled |

## Pinned Behavior: Tests That Must Change (question 4)

| Test | Pins today | Change for |
|------|------------|------------|
| `test/domain/components/hook-events.test.ts:120-128` | `SessionStart: new Set(["startup", "resume"])`, `SessionEnd: new Set()` | S2 |
| `test/bridges/hooks/payloads/session-start.test.ts`, `session-end.test.ts` | pass-through incl. `"reload"` (grep) | S1 |
| `test/bridges/hooks/payloads/post-compact.test.ts` | no `compact_summary` | S4 |
| `test/bridges/hooks/event-router.test.ts:2573-2615` | `session_start` with `reason: "reload"` dispatches (`"... reload project"` rows) | S5 (reload no longer dispatches; keep the duplicate-bind case with `new`) |
| `test/bridges/hooks/dispatch.test.ts:1815-1845` | UPS `additionalContext` → `{ action: "transform", text: "dispatch context" }` | O1 |
| `test/bridges/hooks/event-adapters.test.ts:757-792` | `adaptInputResult` mutate → `transform` | O1 |
| `test/bridges/hooks/dispatch.test.ts` (reducer cases) | first-block-wins, sequential, mutate composition | T1 |
| `test/bridges/hooks/wire-protocol.test.ts` | non-zero exit → noop | T4, C3 |
| `test/bridges/hooks/spawn-helpers.test.ts` | `planSpawn(entry)` verbatim args | P1 |
| `test/bridges/hooks/settle.test.ts` | first block, raw reason | O3 |
| `test/integration/hooks-additionalcontext-end-to-end.test.ts` | SessionStart context in `systemPrompt` | O2 |
| `test/architecture/hooks-lifecycle.test.ts:375-387` | exactly 11 registrations in a fixed order | keep (S3 adds no registration) |
| `features/plugin/session-start-hooks.feature` | `source new` | `clear` (HOOK-01) |
| `test/domain/hooks-resolution.test.ts` (not owned; paired) | manifest `hooks` read only for modules | C4 |

Direct coverage: every touched source must reach 100% line/function/branch with its own test alone (`npm run test:coverage:direct -- <path>`). A new source file needs a new test file at the mirrored path (`typescript-unit-tests/rules/pairing-and-design.md:9-14`).

## File-Collision Map and Wave Proposal (question 5)

| Product file | Session (W1) | Process | Tool use + core | Prompt/Stop | Config (`once`/`if`/manifest) | onFailure | Lifecycle |
|---|---|---|---|---|---|---|---|
| `event-router.ts` | ● | | | ● (drain) | | | |
| `dispatch.ts` | ● (filters) | | ● | ○ (systemMessage emit) | | | |
| `event-adapters.ts` | | | ● | ● (input) | | | |
| `exec-result.ts` | | | ● | ○ | | ○ | |
| `wire-protocol.ts` | | | ● | ● (plain stdout) | | ● | |
| `dispatch-exec.ts` | | ● | | | | ● | |
| `exec-timer.ts` | | | | | | ● | |
| `spawn-helpers.ts`, `async-rewake/registry.ts` | | ● | | | | | |
| `settle.ts` | | | ○ (dedupe) | ● | | | |
| `runtime.ts`, `routing-state.ts` | | | | ● | | | |
| payloads session/compact, `translation-context.ts` | ● | | | | | | |
| payloads tool | | | ○ | | | | |
| `hook-events.ts` | ● | | | | | | |
| `hooks/schema.ts`, `domain/hooks-resolution.ts` | | | | | ● | | |
| `shared/notification-*` + docs/schema | | | ● (kind) | | | | |
| `features/lib/hook-files.ts` | ● | ● | ● | ● | ● | ● | ● |
| `hook/runs.steps.ts` | ● | | | | | | |

● edits, ○ likely edits. `hook-files.ts` is needed by every topic and is the one owned lib, so its full writer (all optional columns, script hooks, `.mcp.json`) must land in wave 1 and be frozen for later waves, or later waves serialize on it.

**Recommended layout (planner may refine):**

- **Wave 1** (two plans, disjoint):
  - *Session tracer* (HOOK-01..03): `event-router.ts`, `dispatch.ts` (mapped filters only), `hook-events.ts`, session/compact payloads, `translation-context.ts`; `features/hook/session.feature`, migrated `features/plugin/session-start-hooks.feature`, `hook/session.steps.ts` (compact, fork, new, quit, TUI reload/quit steps, keep-recent-tokens `Given`), `hook/runs.steps.ts` (any-order runs step, embedded session-id projection). Optionally extract `createBeforeAgentStartHandler` from `event-router.ts` into a leaf so wave 3 does not need `event-router.ts`.
  - *Process* (HOOK-06): `spawn-helpers.ts`, `dispatch-exec.ts` (call site), `async-rewake/registry.ts` (call site); `features/lib/hook-files.ts` (the complete writer); `features/hook/process.feature`, `hook/process.steps.ts`.
- **Wave 2** (three plans, disjoint):
  - *Dispatch core and tool use* (HOOK-04, HOOK-08): `dispatch.ts`, `event-adapters.ts` (tool adapters), `exec-result.ts`, `wire-protocol.ts` (the whole parse contract incl. context, systemMessage, plain stdout, onFailure mapping given facts), tool payloads, `settle.ts` (dedupe only), the new notification kind (own commit) with its first caller; `features/hook/tool-use.feature` (seed), `hook/tool-use.steps.ts`.
  - *Configuration* (HOOK-07 minus onFailure): `domain/components/hooks/schema.ts`, `domain/hooks-resolution.ts` (minimal); `features/hook/configuration.feature`, `hook/configuration.steps.ts`.
  - *Lifecycle* (HOOK-09): `features/hook/lifecycle.feature`, `hook/lifecycle.steps.ts`; product only if a bug appears.
- **Wave 3** (two plans): *Prompt and stop* (HOOK-05: `event-router.ts` or the extracted drain leaf, `event-adapters.ts` input adapter, `settle.ts`, `runtime.ts`, `routing-state.ts`; `prompt-and-stop.feature`); *onFailure* (D-CF5-18: `dispatch-exec.ts`, `exec-timer.ts`; scenarios appended to `configuration.feature` need a step module of their own or a feature file of their own, since wave 2 owned `configuration.steps.ts` — simplest is that this plan owns `configuration.feature` from wave 3 on).
- **Wave 4**: docs (`docs/hooks-compatibility.md`, `hook-events.ts` header, D-CF5-21), decision IDs, parent lines, phase gate.

If the planner keeps the ROADMAP's three waves, the alternative is one large wave-2 plan that owns the four hot files and covers HOOK-04/05/08 plus onFailure, with process/config/lifecycle beside it.

## Common Pitfalls

### Pitfall 1: Compaction "Nothing to compact"
**What goes wrong:** RPC `compact` fails on a short session. **Why:** default `keepRecentTokens` 20000 (`compaction.js:56`). **How to avoid:** write agent-dir `settings.json` with `{"compaction":{"keepRecentTokens":1}}` before the profile Pi starts; script one reply per summarization call (1 for the first compaction of a one-turn session, 2 for the second in the spike). **Warning signs:** response `success:false`, an unused script step.

### Pitfall 2: Session-id-bearing cells
**What goes wrong:** SessionStart rows cannot be stated. **Why:** `CLAUDE_ENV_FILE` embeds the session id (hook-env.ts:73-75). **How to avoid:** project it in `runs.steps.ts` (wave 1).

### Pitfall 3: Append order under parallel dispatch
**What goes wrong:** flaky runs tables. **How to avoid:** the any-order runs step for same-event runs; keep the ordered step for runs of different events.

### Pitfall 4: Stop re-entry turn escapes the prompt step
**What goes wrong:** a Stop-block scenario misses the re-entry model call, or the next step races it. **Why:** Pi defers `triggerTurn` sends during `agent_settled` (`agent-session.js:1865-1869`). **How to avoid:** a hook When that waits for the second `agent_settled`.

### Pitfall 5: Manifest `hooks` naming the standard file
**What goes wrong:** D-CF5-20 flags fully supported plugins as `--partial`. **How to avoid:** exclude paths resolving to `hooks/hooks.json` (upstream does).

### Pitfall 6: SessionEnd timeout
**What goes wrong:** a slow SessionEnd hook is killed. **Why:** `BLOCKING_EVENT_DEFAULT_SECONDS.SessionEnd: 1.5` [VERIFIED: timeout.ts]. **How to avoid:** SessionEnd scenario hooks do nothing but record (Node startup is well under that, the spike passed).

### Pitfall 7: A dialog in a turn
**What goes wrong:** `ask` calls `confirm` in rpc, and `isTurnFault` fails the turn. **How to avoid:** mode check first (D-CF5-11).

### Pitfall 8: Fallow on new exports and clone groups
**What goes wrong:** a notify emitter or helper lands before its caller (`dead-code`); hook-owned MCP fixture code mirrors Phase 6's (`dupes`). **How to avoid:** land emitter with its caller; write the MCP fixture differently; rerun `npx fallow dupes` after the merge (ROADMAP merge procedure).

### Pitfall 9: Changing the 11-registration contract
**What goes wrong:** `hooks-lifecycle.test.ts` fails. **How to avoid:** run compaction SessionStart inside the existing `session_compact` registration.

### Pitfall 10: Scenario ownership of shared step texts
**What goes wrong:** a hook step text collides with another phase. **How to avoid:** every new step names the hook kind in its text; parameter types start with `hook`.

## Code Examples

### Hook-owned session action that records a turn (pattern from workflow/runs.steps.ts:96-110)
```ts
// Source: features/step_definitions/workflow/runs.steps.ts:96-110 (pattern); RPC compact: rpc-mode.js:417-420
When("the user compacts the session, which runs hooks", async function (this: ScenarioWorld) {
  const harness = this.profileHarness();
  const from = this.pi.recordCount();
  const lengths = await readLogLengths(harness);
  const { response } = await this.pi.request({ type: "compact" });
  assert.strictEqual(response.success, true, JSON.stringify(response));
  const records = this.pi.recordsSince(from);
  const logs = await readLogLinesSince(harness, lengths);
  this.recordTurn({ prompt: "/compact", disposition: "handled", records, logs });
});
```
(The step text is illustrative; the writer chooses it under `features.md`.)

### Exec-form substitution in planSpawn
```ts
// Source: spawn-helpers.ts:34-48 (current), shared/vars.ts:68-73 (substituteClaudeVars)
export function planSpawn(entry: RoutingEntry, env: NodeJS.ProcessEnv): SpawnPlan {
  const vars = {
    pluginRoot: env.CLAUDE_PLUGIN_ROOT ?? "",
    pluginData: env.CLAUDE_PLUGIN_DATA ?? "",
    projectDir: env.CLAUDE_PROJECT_DIR,
  };
  const command = entry.handlerDecl.command ?? "";
  const argsField = entry.handlerDecl.args;
  if (Array.isArray(argsField)) {
    const args = (argsField as readonly unknown[]).map((a): string =>
      typeof a === "string" ? substituteClaudeVars(a, vars) : JSON.stringify(a),
    );
    return { command: substituteClaudeVars(command, vars), args, shell: false };
  }
  const shellField = entry.handlerDecl.shell;
  return { command, args: [], shell: typeof shellField === "string" ? shellField : true };
}
```
`prepareHookEnv` always sets the three variables (`hook-env.ts:59-75`), so the `?? ""` fallbacks never fire in production; a branch-coverage test must still reach them, or type the parameter as the three values instead of the env.

### Parallel run and routing-order fold (sketch)
```ts
// Source: replaces dispatch.ts:173-231 reduceBucket loop
const matching = dedupe(bucket.filter((e) => matcherFires(e) && ifFires(e.ifPredicate, event, ctx, e.claudeEvent)));
const results = await Promise.all(matching.map((e) => executor(e, event, ctx, pi, runtime)));
if (capturedGeneration !== runtime.currentGeneration()) return NOOP_FOLD;
return foldInRoutingOrder(matching, results); // stop > block/deny > ask > allow; contexts and systemMessages in order
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Sequential fan-out, first block wins (DISP-04) | Parallel, merged (E11) | upstream docs, probed 2026-11-01 | D-CF5-09 supersedes DISP-04 |
| SessionEnd `bypass_permissions_disabled` reason | removed | Claude Code v2.1.234 (E1) | docs and `hook-events.ts` comment cleanup |
| SessionStart context in system prompt for one turn | persisted custom message | D-CF5-13 | integration test changes |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Upstream `mcp_server` stdin field shape is `{ name }` | Design T6 | wrong field if added; recommended deferral avoids it |
| A2 | Namespace proxy detection by name (`mcp__<server>` without a `__<tool>` segment) is reliable | Design T6 | a real MCP tool with an argument named `tool` could be skipped; unit tests and scenario on `mcp` only |
| A3 | Pi's `terminate: true` on a blocked call ends the turn after the batch | Design T5 | `continue:false` on PreToolUse might not stop the turn; scenario red proof will show |
| A4 | A TUI `/reload` scenario is stable with `waitForQuiet` | Harness F2 | flaky reload scenario; fall back to an extension command (ownership question) |
| A5 | The wave layout keeps every same-wave pair file-disjoint | Collision map | executor merge conflicts; planner re-checks per plan |
| A6 | `systemMessage` notifications appended during a turn appear as `entry_appended` records in the turn | Harness F5 | the systemMessage `Then` would need `get_entries` instead; both are readable |

## Open Questions

1. **`if` on non-tool events.** Upstream skips such a hook (minified excerpt); the bridge runs it. No D-CF5 decision. Recommendation: record as a new decision or a BACKLOG line before any scenario pins it (milestone rule: unlicensed gaps go to the user/log).
2. **UserPromptSubmit block notice kind.** Reuse the new HookSurface kind with text `UserPromptSubmit operation blocked by hook:\n<reason>` or add a second kind. Recommendation: one kind carrying the composed text, if D-CF5-14's "systemMessage" kind may carry it; otherwise defer the notice to a BACKLOG line (D-CF5-11 allows deferral of uncovered items, never silently).
3. **"Reported as the event's error"** for onFailure on SessionStart/SessionEnd/PostCompact (D-CF5-18): a notification or a debug line? Recommendation: debug line plus docs, unless a scenario must observe it.
4. **Reload driver ownership.** TUI (`pi-tui.ts`, no new file) versus a hook-owned Pi extension under `features/lib/` (Phase 5 owns only `hook-files.ts` there). Recommendation: TUI.
5. **New run token for embedded session ids** needs a parent line for the frozen cucumber skill doc, or the whole-cell projection alternative.
6. **Stop feedback carrier**: one custom message with one text part per reason (recommended) versus one message per reason.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | everything | ✓ | v24.22.1 | — |
| python3 | `pi-tui-pty.py` (TUI reload/quit scenarios) | ✓ | 3.13.18 | RPC-only scenarios |
| setpriv | non-DAC npm shell (root container) | ✓ | /usr/bin/setpriv | — |
| Optional peers (pi-mcp-adapter 7.0.0) | HOOK-08 | ✓ (cache present) | 7.0.0 | `node scripts/install-test-peers.mjs` |
| Claude Code binary | upstream probes | ✓ | 2.1.316 at /opt/claude-code/bin/claude | discuss-phase artifacts in scratchpad `research-a/b/c` |

**Missing dependencies with no fallback:** none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` (unit/integration), `@cucumber/cucumber` (behavioral) |
| Config file | `cucumber.json` (frozen), `package.json` scripts (frozen) |
| Quick run command | `node --test test/bridges/hooks/<file>.test.ts`; `npx cucumber-js features/hook`; `npm run test:coverage:direct -- <path>` |
| Full suite command | `npm run check` (plus `npm run test:modules` and `npm run test:cucumber` at the phase gate), with the non-DAC shell env |

### Phase Requirements → Test Map
| Req ID | Behavior | Scenario / test | Red proof (fails today because) | File Exists? |
|--------|----------|-----------------|--------------------------------|--------------|
| HOOK-01 | SessionStart `clear` on new; `compact` after compaction; `clear`/`compact`/`fork` matchers | `features/hook/session.feature`: new session → `source clear`; compaction → `source compact`; a `compact`-matcher group runs only on compaction; migrated `features/plugin/session-start-hooks.feature` (`clear`) | spike: `source "new"`; no SessionStart on compaction; a `clear` matcher trips `closed-set` today (install needs `--partial`) | ❌ session.feature; ✅ session-start-hooks.feature |
| HOOK-01 | unit | `test/domain/components/hook-events.test.ts`, `test/bridges/hooks/payloads/session-start.test.ts`, `dispatch.test.ts`, `event-router.test.ts` | — | ✅ (change) |
| HOOK-02 | SessionEnd `clear` on new; `resume` on fork; `other` on rpc quit; `prompt_input_exit` on TUI quit; reload runs neither event; SessionEnd matchers | session.feature: fork scenario (SessionEnd `resume`, SessionStart `fork`); quit scenario (`other`); TUI reload scenario (no runs); a `clear`-matcher SessionEnd group | spike: `reason "new"`, `"fork"`, `"quit"`; reload sends `reload` today (code); SessionEnd matchers all trip `closed-set` (`hook-events.ts:266`) | ❌ |
| HOOK-02 | unit | `payloads/session-end.test.ts` (mapping incl. mode), `event-router.test.ts` (reload skip) | — | ✅ (change) |
| HOOK-03 | two compactions → two `compact` runs; new session → one `clear` run | session.feature: two compactions in one session; existing duplicate-bind scenario | no SessionStart on compaction today | ❌ |
| HOOK-04 | tool events with Claude names/stdin; exit 2 and deny JSON (any exit) block; `ask` blocks in rpc; `updatedInput` replaces; PostToolUse block keeps output; parallel; dedupe | `features/hook/tool-use.feature` (seed plus): deny with exit 1 JSON; ask in rpc; updatedInput; PostToolUse block; deadlock-probe parallel scenario; identical-hook dedupe scenario | spike: exit-1 deny JSON → tool ran; sequential dispatch → deadlock probe times out; duplicates → two rows | ✅ seed; ❌ new |
| HOOK-04 | unit | `wire-protocol.test.ts`, `dispatch.test.ts`, `event-adapters.test.ts`, `exec-result.test.ts` | — | ✅ (change) |
| HOOK-05 | UPS context beside prompt; SessionStart context persists; tool context after the result; Stop every reason; systemMessage shown; plain stdout context | `features/hook/prompt-and-stop.feature`; model-calls tables; a hook-messages `Then` over `claude-plugin` entries | spike: model saw `ctx-from-hook` instead of the prompt; PostToolUse context absent from call 2; no entry for systemMessage | ❌ |
| HOOK-05 | unit + integration | `settle.test.ts`, `event-router.test.ts`, `test/integration/hooks-additionalcontext-end-to-end.test.ts`, notification tests | — | ✅ (change) |
| HOOK-06 | exec-form substitution in `command` and `args`; env | `features/hook/process.feature`: `arguments` column shows `{home}/marketplaces/fixtures/plugins/demo/x`; script `command` via `${CLAUDE_PLUGIN_ROOT}` with `args: []` runs | spike: literal `${CLAUDE_PLUGIN_ROOT}/x` in arguments; exec-form command with `${...}` fails to spawn (ENOENT, code path) | ❌ |
| HOOK-06 | unit | `spawn-helpers.test.ts`, `dispatch-exec.test.ts`, `async-rewake/registry.test.ts` | — | ✅ (change) |
| HOOK-07 | `if` selects; `once` inert (runs twice); `onFailure` block on exit 1/timeout/bad JSON; manifest `hooks` (non-standard path, inline) → `--partial` and info names it; standard path stays supported; unsupported event → `--partial` + info line | `features/hook/configuration.feature` | onFailure: exit 1 → noop today; manifest inline/other path → silently ignored today; `once`/`if`/unsupported events are regression guards (no red proof needed for unchanged behavior, but each is a negative control) | ❌ |
| HOOK-07 | unit | `test/domain/components/hooks/schema.test.ts`, `test/domain/hooks-resolution.test.ts`, `wire-protocol.test.ts`, `exec-timer.test.ts` | — | ✅ (change) |
| HOOK-08 | MCP tool hook once per call under the real name; `*` once; outer proxy runs no hook | tool-use.feature MCP scenario (hook-owned `.mcp.json` + listing wait) | spike: `*` PreToolUse and PostToolUse ran twice | ❌ |
| HOOK-09 | disable/uninstall stop hooks; enable restores; update replaces | `features/hook/lifecycle.feature` (recorder in a later turn) | none expected (regression guards); a red proof only if a bug appears | ❌ |
| HOOK-09 | docs match | `docs/hooks-compatibility.md` review against scenarios (D-CF5-21) | — | ✅ (change) |

### Sampling Rate
- **Per task commit:** the owner test(s) plus `npm run test:coverage:direct -- <changed source>`; the commit hook runs `check:commit`.
- **Per wave merge:** `npm run check` on the combined tree (with the non-DAC env), after a lone `npm run lint` warm-up.
- **Phase gate:** `npm run check`, `npm run test:modules`, `npm run test:cucumber` green before verify.

### Wave 0 Gaps
- [ ] `features/hook/session.feature`, `prompt-and-stop.feature`, `process.feature`, `configuration.feature`, `lifecycle.feature` — new.
- [ ] `features/step_definitions/hook/{session,tool-use,prompt-and-stop,process,configuration,lifecycle}.steps.ts` — new.
- [ ] `runs.steps.ts`: any-order runs step; embedded session-id projection.
- [ ] `hook-files.ts`: optional-column writer, script hooks, `.mcp.json` writer.
- [ ] A new source file (for example an extracted drain leaf) needs its mirrored test.

## Security Domain

`security_enforcement` is absent in `.planning/config.json` (treated as enabled).

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | yes (hook decisions gate tool calls) | fold precedence deny > ask > allow; `ask` never auto-allows headless |
| V5 Input Validation | yes | hook stdout parsed defensively (never throws, `wire-protocol.ts`); `updatedInput` replacement keeps the `__proto__` skip and the object-only check (`event-adapters.ts:114-127`); `tool_result` patch whitelist stays (`:137-150`) |
| V6 Cryptography | no | — |
| V12 Files and Resources | yes | `CLAUDE_PLUGIN_DATA`/`CLAUDE_ENV_FILE` containment (`hook-env.ts:59,73-74`); exec-form substitution uses only the env values the bridge already exports |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Hook `updatedInput` rewrites a command to something dangerous | Tampering | Upstream parity (the plugin is trusted at install); keep the object-only/`__proto__` guards |
| Exec-form substitution injects shell metacharacters | Elevation | exec form spawns with `shell: false`; substitution never applies to shell form |
| `systemMessage` carries terminal escapes or secrets to the UI | Spoofing / Information disclosure | render through the notification grammar (as `async-rewake-summary`); consider the existing credential redaction used by diagnostics |
| Parallel hooks race on shared files | Tampering | each hook is a separate process; the bridge applies one folded mutation |
| Hook fails open on crash | Elevation | `onFailure: "block"` (D-CF5-18) for authors who need fail-closed |

## Sources

### Primary (HIGH confidence)
- `node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts` (event and result types), `core/agent-session.js` (compact, sendCustomMessage, _prepareRun, _emitAgentSettled, reload), `core/agent-session-runtime.js` (new/fork/switch/dispose), `modes/rpc/rpc-mode.js` (RPC commands, confirm), `modes/interactive/interactive-mode.js:2617` (/reload), `core/compaction/compaction.js`, `core/settings-manager.js`, `core/messages.js`, `core/extensions/runner.js`.
- Repo sources read this session: `bridges/hooks/*` (event-router, dispatch, event-adapters, exec-result, wire-protocol, dispatch-exec, spawn-helpers, hook-env, translation-context, settle, runtime, routing-state, timeout, exec-timer, payloads, async-rewake/registry excerpt), `domain/components/hook-events.ts`, `hooks.ts`, `hooks/{schema,partition}.ts`, `domain/hooks-resolution.ts`, `shared/vars.ts`, `shared/notification-*` excerpts, `platform/pi-api.ts`, features harness (`world.ts`, `pi-process.ts`, `pi-commands.ts`, `turn-records.ts`, `hook-recorder.ts`, `hook-files.ts`, `runs.steps.ts`, `session.steps.ts`, `model.steps.ts`, scripted model, `pi-tui.ts`), `.agents/skills/cucumber/**`.
- Spike scenarios this session (scratch): `/tmp/claude-0/-home-user-pi-claude-marketplace/90cd4c1a-120d-5946-a61c-4f1afb9521cf/scratchpad/phase-researcher/spike/{spike.steps.ts,spike.feature,spike2.feature,out/}`.

### Secondary (MEDIUM confidence)
- Discuss-phase upstream probes and binary excerpts (Claude Code 2.1.316): scratchpad `research-a/`, `research-b/` (`manifest-hooks.txt`, `probeC*`), `research-c/` (`probe/run1..5`, `win_sysmsg.txt`).
- `pi-mcp-adapter` 7.0.0 sources (`index.ts:964-1015`, `mcp-references.ts:38-40`, `namespace-tools.ts`).

### Tertiary (LOW confidence)
- `mcp_server` stdin shape (A1).

## Metadata

**Confidence breakdown:**
- Harness feasibility: HIGH — three spike scenarios ran against the real profile Pi.
- Pi API: HIGH — read from installed dist files.
- Product design sketches: MEDIUM — derived from code and decisions, not built.
- Wave layout: MEDIUM — a collision analysis; the planner owns the final split.
- Pitfalls: HIGH for 1, 2, 4, 5, 9 (read or observed); MEDIUM for the rest.

**Research date:** 2026-11-01
**Valid until:** 2026-12-01 (Pi 1.4.0 and pi-mcp-adapter 7.0.0 are pinned by the frozen lockfile)

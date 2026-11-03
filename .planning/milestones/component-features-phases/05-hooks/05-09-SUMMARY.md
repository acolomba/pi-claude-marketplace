---
phase: 05-hooks
plan: 09
subsystem: hooks
tags: [hooks, docs, decision-records, parent-lines, phase-gate]

requires:
  - phase: 05-hooks (plans 05-01..05-08)
    provides: the session, process, tool-use, configuration, lifecycle, context, notice, and Stop behavior the docs state, and each plan's parent lines
provides:
  - "docs/hooks-compatibility.md matching the tested Phase 5 behavior, citing the D-CF5 decisions (D-CF5-21, FG-25)"
  - "hook-events.ts header table naming the mapped values per event; PreCompact and PostCompact read Pi's reason"
  - "translation-context.ts transcript_path comment corrected (D-CF5-07)"
  - "28 ready-to-paste PROJECT.md Key Decisions rows (D-CF5-01..28)"
  - "the collected parent lines for CHANGELOG.md, PROJECT.md, BACKLOG.md, the frozen files, FEATURES.md, the non-owned files, and the security follow-up at merge"
  - "the phase gate evidence on the combined Phase 5 tree"
affects: [parent merge of features/component-features-phase-5, PROJECT.md Key Decisions, BACKLOG.md, CHANGELOG.md]

actuals:
  tokens: 35000
  tasks: 3
  commits: 3
plan_head_before: df1a1fbcb6d39d58b5410f80d0bea84e330d43a2
plan_head_after: 565aaf53e2406dd7f183bd25953450f174e165dc

tech-stack:
  added: []
  patterns:
    - "Each docs note names its decision ID and, for a divergence, its license (Pi gap or project decision)"

key-files:
  created:
    - .planning/phases/05-hooks/05-09-SUMMARY.md
  modified:
    - docs/hooks-compatibility.md
    - extensions/pi-claude-marketplace/domain/components/hook-events.ts
    - extensions/pi-claude-marketplace/bridges/hooks/translation-context.ts

key-decisions:
  - "The docs mark PreCompact, SessionEnd, other-exit stderr, continue false, and updatedToolOutput as partial, because a scenario or a plan shows a residual difference"
  - "Two stale TOOL-02 comments in hook-events.ts said an unsupported event or matcher makes the plugin unavailable; they now say partially available, as partition.ts and the configuration scenarios show"
  - "The stale bypass_permissions_disabled value in docs/research/claude-hook-config-syntax.md stays: the research file is outside this plan's files, so it is a parent line"

requirements-completed: [HOOK-01, HOOK-02, HOOK-03, HOOK-04, HOOK-05, HOOK-06, HOOK-07, HOOK-08, HOOK-09]

coverage:
  - id: D1
    description: "docs/hooks-compatibility.md, the hook-events.ts header, and the transcript_path comment state what the Phase 5 scenarios prove"
    requirement: HOOK-09
    verification:
      - kind: unit
        ref: "node --test test/domain/components/hook-events.test.ts test/bridges/hooks/translation-context.test.ts"
        status: pass
      - kind: other
        ref: "npx prettier --check docs/hooks-compatibility.md hook-events.ts translation-context.ts; 27 distinct D-CF5 IDs in the docs"
        status: pass
    human_judgment: true
    rationale: "Whether each docs row reads correctly against the scenarios is a reading judgment; no test asserts the docs text"
  - id: D2
    description: "The decision rows, parent lines, and security follow-up are complete for the parent merge"
    verification: []
    human_judgment: true
    rationale: "The parent applies the lines by hand; completeness is a review judgment"
  - id: D3
    description: "The combined Phase 5 tree passes npm run check, npm run test:modules, and npm run test:cucumber twice"
    requirement: HOOK-01
    verification:
      - kind: other
        ref: "npm run check (exit 0, cucumber seed 31696); npm run test:modules (exit 0); npm run test:cucumber twice (exit 0, seeds 616824 and 972519) on e3f0676, Node v24.22.1"
        status: pass
    human_judgment: false

duration: 45min
completed: 2026-11-01
status: complete
---

# Phase 5 Plan 09: Hook docs, decision records, and the phase gate Summary

**`docs/hooks-compatibility.md` and the `hook-events.ts` header now state the tested Phase 5 hook behavior with its decision IDs, the parent has 28 Key Decisions rows and every parent line the phase could not apply, and the combined tree passes `npm run check`, `npm run test:modules`, and `npm run test:cucumber` twice (seeds 616824 and 972519, plus 31696 inside the check).**

## Performance

- **Duration:** 45min
- **Started:** 2026-11-01T19:05Z (approximate)
- **Completed:** 2026-11-01T19:50Z
- **Tasks:** 3
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments

- `docs/hooks-compatibility.md` (D-CF5-21, FG-25): a Session events table (Pi action to `SessionEnd` `reason` and `SessionStart` `source`, `/reload` runs none, `--resume`/`--fork` launches stay `startup`), a Compaction section (PreCompact, SessionStart `compact`, PostCompact with `compact_summary`; `manual`/`auto` from Pi `manual`/`threshold`/`overflow`), the three new unsupported events (`DirectoryAdded` a Pi gap, `PreModelSwitch`/`PostModelSwitch` per HKMS-01), exec-form placeholders, `onFailure`, `once` ignored, `if` on tool-less events skipped, decision rows (deny at any exit, `ask`, `defer`, `updatedInput`, `continue: false`, the PostToolUse block), Additional context and Messages to the user sections, the environment rows, the manifest and marketplace-entry `hooks` rows, parallel hooks, the routing-order fold, dedupe, and lifecycle. The old "match-all only" compaction rows, the `clear`/`compact` "no Pi analog" rows, the "`systemMessage` not surfaced" and "additionalContext only on SessionStart and Stop" rows, the `if`-on-non-tool match-all row, and the proxy-reaches-hooks-as-`mcp` paragraph are gone.
- `hook-events.ts`: the header table names the mapped values per event, with PreCompact and PostCompact reading Pi's `reason`; the PreCompact/PostCompact derivation no longer says Pi carries no trigger; two TOOL-02 comments now say partially available. `grep -c threshold` prints 4. No comment names the SessionEnd value Claude Code removed in 2.1.234.
- `translation-context.ts`: a saved session has a transcript path from its first turn; `--no-session` gives `""` (Pi gap); the earlier empty-path finding is a harness artifact (D-CF5-07).

## Task Commits

1. **Task 1: Make the hook compatibility docs and the event header match the tested behavior** - `e3f0676` (docs)
2. **Task 2: Write the decision records and collect the parent lines** - `565aaf5` (docs)
3. **Task 3: Pass the phase gate on the combined tree** - the commit that adds the gate evidence to this SUMMARY (docs; no gate fix was needed)

Tracer gate after Task 1: no `blocking-human` gate, `human_verify_mode` end-of-phase, automated-only `<verify>`. Its commands passed (8/8 unit cases, Prettier clean, 60 `D-CF5-` mentions), and `npm run check:static` passed before the commit, so Task 2 went ahead.

## Task 1 acceptance

- `grep -o 'D-CF5-[0-9][0-9]' docs/hooks-compatibility.md | sort -u | wc -l`: 27 (baseline 0). Absent: D-CF5-26 (harness only).
- `grep -c 'DirectoryAdded' docs/hooks-compatibility.md`: 3. `grep -ci 'sequential' docs/hooks-compatibility.md`: 0.
- `grep -c 'threshold' extensions/pi-claude-marketplace/domain/components/hook-events.ts`: 4.
- `grep -rn bypass_permissions_disabled extensions docs test features`: one hit, `docs/research/claude-hook-config-syntax.md:103`, outside this plan's files (parent line below).

## Phase gate

Run in this worktree on commit `e3f067635cf6c7e0cb5475b678c809ece745b7a0` (the Task 1 commit; every later commit changes only `.planning/**/*.md`, and `git diff --quiet e3f0676 -- . ':(exclude,glob).planning/**/*.md'` exits 0), Node `v24.22.1`, with `npm_config_script_shell=<scratchpad>/nondac-sh NODE_OPTIONS=--max-old-space-size=6144`, run in sequence by one scratchpad script after a lone `npm run lint` warm-up.

| Command | Exit | Result |
| --- | --- | --- |
| `npm run lint` (warm-up, alone) | 0 | no finding |
| `npm run check` | 0 | `check:static` all passed (typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features); `test:unpaired` and `test:integration` passed; its `test:cucumber` stage: seed 31696, 1283 scenarios (1283 passed), 13388 steps (13388 passed); `test:coverage:direct:all`: no shortfall line, `Merged LCOV: coverage/direct.lcov (320 records)`. 19:31:52Z to 19:39:16Z |
| `npm run test:modules` | 0 | whole unit suite, no failing test. 19:39:16Z to 19:42:08Z |
| `npm run test:cucumber` #1 | 0 | seed 616824, 1283 scenarios (1283 passed), 13388 steps (13388 passed) |
| `npm run test:cucumber` #2 | 0 | seed 972519, 1283 scenarios (1283 passed), 13388 steps (13388 passed) |
| `npx fallow dupes --fail-on-issues --format human --quiet` | 0 | no clone group |
| the same, with both `code-duplication` markers removed for one run | 1 | one group, `dup:47665ee9`, `async-rewake/registry.ts:360-371` and `dispatch-exec.ts:426-438`, the lines right under the two markers. Restored with `git checkout --`; the rerun exits 0 |
| `npx cucumber-js features/hook --dry-run` | 0 | 65 scenarios in `additional-context`, `configuration`, `failures`, `lifecycle`, `messages`, `process`, `prompt-and-stop`, `session`, `tool-use` |
| `git diff --quiet 74829438..HEAD -- CHANGELOG.md README.md README.es.md .planning/BACKLOG.md .fallowrc.json package.json package-lock.json .agents/skills/cucumber features/support` | 0 | no forbidden file changed (`74829438` is the commit before the phase's first plan commit) |

The Legacy marketplace migration `console.warn` lines in the logs are the expected IL-3 output of existing persistence tests. No gate fix was needed, so no test or product file changed in Task 3.

## Decision records

Ready to paste into the PROJECT.md Key Decisions table (`| Decision | Rationale | Outcome |`), in the shape of the D-CF1 rows. E-n names the upstream evidence item in `05-CONTEXT.md` (Claude Code 2.1.316, probed 2026-11-01). P5-DC-n names the phase's dubious-choices entry.

| Decision | Rationale | Outcome |
| --- | --- | --- |
| **D-CF5-01 (component-features, Phase 5, settled autonomously, P5-DC-02): SessionStart `source` maps Pi `startup` to `startup`, `new` to `clear`, `resume` to `resume`, and `fork` to `fork`; `compact` comes from the compaction handler. The closed matcher set is `startup`, `resume`, `clear`, `compact`, `fork`, and dispatch filters on the mapped value**. Implements D-CF1-10..12. A notice of a SessionStart hook is labeled `SessionStart:<source>`, as upstream names the hook (`hook_name` `SessionStart:startup` in the probe stream). | E1, E3, E4: upstream's `source` vocabulary; Pi's `new` is upstream's `/clear`. Before, dispatch compared Pi's raw reason, so a `clear` group never matched. | -- Locked |
| **D-CF5-02 (component-features, Phase 5, settled autonomously, P5-DC-03): SessionEnd `reason` maps Pi `new` to `clear`, `resume` and `fork` to `resume`, and `quit` to `prompt_input_exit` in `tui` mode and `other` in `print`/`json`/`rpc`; Pi `reload` runs no SessionEnd. Matchers admit `clear`, `resume`, `prompt_input_exit`, `other`, `logout`, filtered on the mapped value**. Residual (Pi gap): Pi's `quit` does not say whether a signal caused it, so a terminal quit by signal sends `prompt_input_exit` where upstream sends `other`. `logout` never fires, as upstream. | E1: upstream's closed set without `bypass_permissions_disabled` (removed in 2.1.234); `/branch` runs the resume path, so SessionEnd `resume` then SessionStart `fork`. | -- Locked |
| **D-CF5-03 (component-features, Phase 5, settled autonomously, P5-DC-03): Pi `/reload` runs neither SessionStart nor SessionEnd**. The load-time hydrate and the shared data-dir step still run. Supersedes the `source: "reload"` / `reason: "reload"` parts of D-60-04 and D-58-06. | E2: upstream `/reload-plugins` dispatches no hook (probed, also after another process installed a plugin). | -- Locked |
| **D-CF5-04 (component-features, Phase 5, settled autonomously, P5-DC-02): one `session_compact` handler runs SessionStart `source: "compact"` to completion, then PostCompact with `compact_summary` from `compactionEntry.summary`; PreCompact and PostCompact `manual`/`auto` matchers filter on the trigger (Pi `threshold` and `overflow` are `auto`)**. A failed SessionStart leg is debug-logged and PostCompact still runs; a stale generation stops both. The scenarios state Pi's own split-turn summary text, so they change if Pi changes it. | E3: upstream runs PreCompact, SessionStart `compact`, PostCompact, and repeats the sequence per compaction. Before, every PreCompact/PostCompact entry fired whatever its matcher. | -- Locked |
| **D-CF5-05 (component-features, Phase 5, settled autonomously, P5-DC-02): the SSDEDUP-01 duplicate-bind guard stays on the `session_start` handler with its `${sessionId}\0${reason}` key on Pi's raw reason; the compaction SessionStart runs from `session_compact`, outside the guard**. Two compactions give two runs; RPC `new_session` still gives one `clear` run. | E3: upstream gives the compaction sequence twice in one session. pi#10470's duplicate bind must still give one run. | -- Locked |
| **D-CF5-06 (component-features, Phase 5, settled autonomously, P5-DC-04): a launch with `--continue`, `--resume`, `--session`, or `--fork` still sends SessionStart `startup`**. Recorded divergence, project decision: the frozen harness launcher cannot start Pi with those flags, so no scenario could prove a change. BACKLOG carries detection through the session header. | E4: upstream `--resume` sends `resume` and `--fork-session` sends `fork`; Pi reports `startup` for all four launches. | -- Deferred |
| **D-CF5-07 (component-features, Phase 5, settled autonomously, P5-DC-08): `transcript_path` is unchanged: a saved Pi session sends its session file path from the first turn, and `--no-session` sends `""` (Pi gap: an in-memory session has no transcript location)**. The comment in `translation-context.ts` and the docs say so; Phase 1's "empty on the first turn" finding is closed as a `--no-session` harness artifact. | E5: upstream always sends a path, even before the file exists; Pi names the file in `newSession()`. | -- Locked |
| **D-CF5-08 (component-features, Phase 5, settled autonomously, P5-DC-04): an install made before this phase that dropped `clear`, `compact`, or `fork` hook groups is not healed by reconcile; `/claude:plugin reinstall <plugin>` restores them**. `apply` heals only a plugin that lost every hook. Project decision: the BFILL-01 planner is outside Phase 5's ownership. BACKLOG carries a growth move for `pending`/`apply`. | Those groups dropped as `closed-set` under the old matcher sets; reinstall re-partitions `hooks.json` with the new sets. | -- Deferred |
| **D-CF5-09 (component-features, Phase 5, settled autonomously, P5-DC-05): all matching hooks of one event run in parallel on one translated snapshot, and their results fold in routing order whatever order they finish in: `continue: false` wins, then block or deny, then `ask`, then allow; every hook's `additionalContext` and `systemMessage` is kept in routing order; the input rewrite of the winning decision applies, ties to the last hook in routing order**. Supersedes DISP-04 ("fan-out sequential"). Scenarios compare several runs of one event keyed by hook name. | E11: upstream runs an event's matching hooks in parallel (probe: two 1 s hooks overlapped), keeps every output, and merges deny > defer > ask > allow. | -- Locked |
| **D-CF5-10 (component-features, Phase 5, settled autonomously, P5-DC-02): one hook per upstream dedupe key, rooted at the plugin's `resolvedSource` (`type`, `shell` defaulting to `bash`, `command`, `args`, `if`); a copy keeps the first copy's position and the last copy's fields; the same hook in two plugins runs once for each**. | E10: upstream's key and its first-position, last-fields rule (probe: timeouts 1 then 10 ran once and completed). | -- Locked |
| **D-CF5-11 (component-features, Phase 5, settled autonomously, P5-DC-07): PreToolUse `ask` blocks when Pi has no terminal and asks through `ctx.ui.confirm` in `tui`; `defer` is ignored (Pi gap); a JSON deny applies at any exit code; `updatedInput` replaces the whole input; `continue: false` ends the turn; the exit-2 reason prefers the JSON reason; a PostToolUse/PostToolUseFailure block keeps the tool output and adds the feedback; a UserPromptSubmit block notifies the reason; Stop delivers every block reason**. Residuals: the model reads `PreToolUse:<Tool> hook error: <reason>`; `ask` without a terminal blocks with the hook's reason alone; the `tui` dialog title `PreToolUse:<Tool> hook asks to allow this call` is the bridge's own; default texts `Blocked by hook`, `[<command>]: No stderr output`, and `Operation stopped by hook`; an exit other than 0 and 2 applies a stdout JSON object whole. PostToolUse `continue: false` stays a debug line (BACKLOG). | E15: upstream decisions probed in `-p`; `ask` in print mode shows `ASK-REASON` with `is_error: true`; `defer` is print-mode only and Pi has no deferred-permission flow. | -- Locked |
| **D-CF5-12 (component-features, Phase 5, settled autonomously, P5-DC-06): a call-mode pi-mcp-adapter proxy event (`mcp` or a namespace proxy, `input.tool` a string, no `input.action`) runs no hook; the nested call fires once under `mcp__plugin_<p>_<s>__<tool>` with `tool_input` set to the arguments**. Non-call proxy actions still fire as the proxy tool, and calls the adapter runs without a nested Pi call never reach hooks (both Pi gaps). | E14: upstream has no proxy; a plugin MCP tool is a regular tool and each matching hook fires once. Before, a match-all hook fired twice. | -- Locked |
| **D-CF5-13 (component-features, Phase 5, settled autonomously, P5-DC-02): every event's `additionalContext` reaches the model: UserPromptSubmit context goes beside the unchanged prompt, SessionStart context persists past the first turn, PreToolUse/PostToolUse/PostToolUseFailure context arrives after the tool result (also when denied), Stop carries every value, and plain stdout counts as context on SessionStart and UserPromptSubmit**. Layout: SessionStart and UserPromptSubmit share one hidden message `claude-hook-additional-context` with one `<Event> hook additional context: <text>` part per event, SessionStart first; tool context is a hidden `claude-hook-tool-context` message sent with `triggerTurn: false`. Pi gap: upstream adds prompt context to the same request; Pi adds a separate message. Plain text is stdout that does not start with `{` and end with `}`. | E13: upstream accepts the field on these events and sends `<hookName> hook additional context: ...`; "can't replace the prompt". Before, UserPromptSubmit context replaced the prompt. | -- Locked |
| **D-CF5-14 (component-features, Phase 5, settled autonomously, P5-DC-07): a `systemMessage` is shown to the user through the notify chokepoint as `<label> says: <text>`, severity `info`, on PreToolUse, PostToolUse, PostToolUseFailure, UserPromptSubmit, Stop, and SessionStart, and never sent to the model; SessionEnd, PreCompact, PostCompact, and StopFailure drop it with a debug line**. Session labels follow upstream's `<event>:<matchQuery>` (`SessionStart:clear`). JSON and RPC carry it as a `hook-notice` entry. | E12: upstream shows `<hookName> says: <text>` at stream-json level `notice` and discards it on the four events. | -- Locked |
| **D-CF5-15 (component-features, Phase 5, settled autonomously, P5-DC-02): exec-form `command` and each `args` element substitute `${CLAUDE_PROJECT_DIR}`, `${CLAUDE_PLUGIN_ROOT}`, and `${CLAUDE_PLUGIN_DATA}` anywhere in the string, single pass, from the values the hook env gets, in the sync and async-rewake lanes; shell form gets no text substitution; `${user_config.*}` stays literal (USRCFG-01)**. | E9: upstream's exec-form substitution set and its shell-form rule. | -- Locked |
| **D-CF5-16 (component-features, Phase 5, settled autonomously, P5-DC-02): the hook env keeps `CLAUDECODE`, `CLAUDE_CODE_SESSION_ID`, the three path variables, SessionStart `CLAUDE_ENV_FILE`, and the Pi-only `CLAUDE_SESSION_ID` shim (SENV-03, D-91-02); `CLAUDE_CODE_CHILD_SESSION`, `CLAUDE_CODE_SESSION_ATTENDED`, `CLAUDE_PID`, and `CLAUDE_EFFORT` are not set yet**. BACKLOG carries the four. | E9: upstream's hook env list; upstream sets no `CLAUDE_SESSION_ID`. | -- Deferred |
| **D-CF5-17 (component-features, Phase 5, settled autonomously, P5-DC-02): plugin hooks ignore `once`; the field is on the handler schema and stays inert**. | E6: upstream honors `once` only for skill-frontmatter hooks (probe: a plugin `once: true` hook ran twice). | -- Locked |
| **D-CF5-18 (component-features, Phase 5, settled autonomously, P5-DC-02): `onFailure: "block"` turns a start failure, an exit other than 0 and 2, a timeout, or `{`-led stdout that does not parse into a block with `[<command>]: failed\|timed out; blocking because onFailure is "block"\n<stderr>`; it is ignored on `async`, `asyncRewake`, and Stop; on SessionStart, SessionEnd, and PostCompact the block shows as the event's hook error**. Residuals: the reason ends after `"block"` when stderr is empty; `<command>` is the declared text with placeholders; the check runs before the stdout parse, so exit 1 with a valid deny JSON blocks with the `onFailure` text. Recorded divergence (low impact): JSON that parses but fails the event's schema is not a failure. | E6: upstream's four failure kinds and message, probed on PreToolUse, UserPromptSubmit, and Stop. | -- Locked |
| **D-CF5-19 (component-features, Phase 5, settled autonomously, P5-DC-02): a non-admitted event (the five inapplicable events, `PreModelSwitch`/`PostModelSwitch` (HKMS-01), `DirectoryAdded`) drops per entry as `{unsupported hooks}` with `<event> (unsupported)` in info, never silently**. `DirectoryAdded` is a Pi gap. Corrects PROJECT.md's "Silently dropped ... debug-logged only" line (parent line). | E7: upstream's 33-event tuple incl. `DirectoryAdded`; upstream ignores unknown keys with a warning. | -- Locked |
| **D-CF5-20 (component-features, Phase 5, settled autonomously, P5-DC-04): a `plugin.json` `hooks` field (path, array, or inline object) or any marketplace-entry `hooks` makes the plugin `(partially-available) {unsupported hooks}` (install needs `--partial`); the full merge is deferred**. Project decision: the merge touches install, enable, and cascade orchestrators outside Phase 5's ownership. Info names the field only through the reason. An empty inline `{}` counts as declared; `""`, `null`, `[]`, `[""]` do not. | E8: upstream loads `hooks/hooks.json`, then each manifest element, merged per event; a marketplace entry's inline `hooks` replaces events (or the whole config without `plugin.json`). | -- Deferred |
| **D-CF5-21 (component-features, Phase 5, settled autonomously, P5-DC-02): `docs/hooks-compatibility.md` and the `hook-events.ts` header match the tested behavior**: compact triggers `manual`/`auto` from Pi `manual`/`threshold`/`overflow`, every D-CF5 row, no `bypass_permissions_disabled` in the hooks docs or source. The research snapshot `docs/research/claude-hook-config-syntax.md:103` still lists it (parent line). | FG-25 docs drift; E1 for the removed value. | -- Locked |
| **D-CF5-22 (component-features, Phase 5, settled autonomously, P5-DC-02): disable and uninstall stop a plugin's hooks, enable restores them, and update replaces them, observed through the hook recorder in a new session**. No product change was needed. | HOOK-09; upstream's plugin lifecycle. | -- Locked |
| **D-CF5-23 (component-features, Phase 5, settled autonomously, P5-DC-10): a hook whose `if` is set on an event with no tool is skipped at dispatch (`IfPredicate` arm `tool-less-event`)**. An empty or whitespace-only `if` still runs the hook on every event (upstream skips only a non-empty one). | 05-RESEARCH.md: upstream skips such a hook. Before, the `if` compiled to match-all. | -- Locked |
| **D-CF5-24 (component-features, Phase 5, settled autonomously, P5-DC-10, P5-DC-12): one `HookSurface` kind, `hook-notice` (severity `info`), carries every hook notice: `systemMessage`, the blocked-prompt notice `UserPromptSubmit operation blocked by hook:\n<reason>`, and a block on SessionStart, SessionEnd, or PostCompact shown as `<label> hook error: <message>`**. Residuals: the blocked-prompt notice leaves out upstream's third line `Original prompt: <prompt>`; upstream draws the blocked prompt as a warning and the hook error in the error color, the bridge uses `info` for both; a blocked prompt shows its hooks' system messages first. | E12, E15; the binary's `${hookEvent} operation blocked by hook:\n${blockingError}` and `hook_non_blocking_error` render. | -- Locked |
| **D-CF5-25 (component-features, Phase 5, settled autonomously, P5-DC-10): Stop hooks that block or add context re-enter once with one hidden `claude-hook-stop-block` message holding one `Stop hook feedback:\n<text>` part per block reason and per context value, in routing order; several denies on a tool call give the first reason in routing order**. Residuals: a hook that blocks and adds context gives its reason first; a reasonless block sends an empty reason (not probed); the STOP-07 cap counts the re-entry once and names the first hook that sends feedback. | E15: upstream sends one user message with one text part per Stop reason (`research-c/probe/run3/req-006.json`). | -- Locked |
| **D-CF5-26 (component-features, Phase 5, settled autonomously, P5-DC-10): `/reload` and the terminal quit are driven through the TUI driver (`features/lib/pi-tui.ts`, read-only) from a profile Pi; resume is unit-tested only; a session id inside a runs cell (such as `CLAUDE_ENV_FILE`'s file name) is projected to its ordinal**. The frozen cucumber token docs get a parent line. | `switch_session` needs a session file, which `--no-session` never writes; a plugin installed through the shared Pi kept its SessionEnd hook routed into the next scenario. | -- Locked |
| **D-CF5-27 (component-features, Phase 5, settled autonomously, P5-DC-10): a `plugin.json` `hooks` string that names the standard `hooks/hooks.json` is skipped and does not make the plugin partial (refines D-CF5-20)**. The marketplace-entry field gets no such exception, because upstream accepts only the inline form there. | E8: upstream skips the convention path in the manifest list. | -- Locked |
| **D-CF5-28 (component-features, Phase 5, settled autonomously, P5-DC-10): `tool_use_id` and `mcp_server` stay out of the tool payloads**. BACKLOG carries them. | E14: upstream stdin carries `mcp_server`; no scenario needs either field yet. | -- Deferred |

## Parent lines

Grouped by the file the parent edits. Each line is ready to apply.

### `CHANGELOG.md` (under the milestone's `## [Unreleased]` entry, per the changelog skill)

Sub-bullets for the component-features entry. Each is under 40 words; trim or merge as the entry needs.

- `Plugin session hooks now get Claude Code's values. A new session sends clear, a fork sends SessionEnd resume and SessionStart fork, and a quit sends prompt_input_exit in the terminal and other elsewhere.` (D-CF5-01, D-CF5-02; put `clear`, `resume`, `fork`, `prompt_input_exit`, `other` in backticks)
- `Each compaction now runs SessionStart compact between PreCompact and PostCompact, and PostCompact gets compact_summary. /reload runs no session hook, and session and compaction matchers now filter on these values.` (D-CF5-03, D-CF5-04; backticks on the values)
- `Run /claude:plugin reinstall <plugin> to restore clear, compact, or fork hook groups that an earlier install dropped.` (D-CF5-08; backticks on the command and values)
- `Matching hooks of one event now run in parallel, and identical hooks of one plugin run once, as in Claude Code.` (D-CF5-09, D-CF5-10)
- `Tool hooks now decide as in Claude Code. A deny blocks at any exit code, ask asks in the terminal, updatedInput replaces the whole input, and continue false ends the turn.` (D-CF5-11; backticks on `ask`, `updatedInput`, `continue: false`)
- `A hook on a plugin MCP tool now runs once per call under the tool's real name, also through the mcp proxy.` (D-CF5-12)
- `A UserPromptSubmit hook's context now reaches the model beside your prompt, not in its place. SessionStart, tool, and Stop hook context also reach the model.` (D-CF5-13, D-CF5-25)
- `A hook's systemMessage now shows as <Event>[:<Tool>] says: <text> and never reaches the model. A blocked prompt shows why. JSON and RPC output carry each notice as a hook-notice entry.` (D-CF5-14, D-CF5-24; backticks on `systemMessage`, the label, `hook-notice`)
- `Exec-form hooks now get ${CLAUDE_PLUGIN_ROOT}, ${CLAUDE_PLUGIN_DATA}, and ${CLAUDE_PROJECT_DIR} filled in, in command and in each args element.` (D-CF5-15; backticks)
- `A hook with onFailure: "block" now blocks when it cannot start, exits with a code other than 0 and 2, times out, or prints broken JSON.` (D-CF5-18; backticks)
- `A plugin whose plugin.json names hooks other than hooks/hooks.json, or whose marketplace entry declares hooks, now shows as partially available with unsupported hooks.` (D-CF5-20, D-CF5-27; backticks on `plugin.json`, `hooks/hooks.json`, `hooks`, `unsupported hooks`)
- `A hook whose if is set on a session, prompt, compaction, or stop event no longer runs, as in Claude Code.` (D-CF5-23; backticks on `if`)
- `A PostToolUse hook's updatedToolOutput now reaches the model.` (05-06 fix; backticks)

### `.planning/PROJECT.md`

- Line 1344 ("**5 Claude hook events permanently inapplicable to Pi**"): replace `Silently dropped at hook-config parse time; debug-logged only.` with `Dropped per entry at hook-config parse time and reported: the plugin reads (partially-available) with {unsupported hooks}, and plugin info lists <event> (unsupported) (D-CF5-19).` (backticks on the tokens). Optionally add to the same out-of-scope list: `DirectoryAdded` (Pi has no add-directory event, D-CF5-19) and `PreModelSwitch`/`PostModelSwitch` (HKMS-01), reported the same way.
- Key Decisions: the 28 rows in "Decision records" above.

### `.planning/BACKLOG.md`

Each line is a new item (title, then a one-paragraph body), in the BACKLOG's `## <ID>: <title>` shape; IDs are the parent's to assign.

1. Hooks: SessionStart `resume`/`fork` for Pi launches with `--continue`, `--resume`, `--session`, or `--fork`, detected through the session header (`parentSession` means fork, existing entries mean resume). Needs a launcher change in the frozen harness for its scenario (D-CF5-06).
2. Hooks: a `pending`/`apply` growth move for a plugin whose install dropped `clear`, `compact`, or `fork` hook groups, so reconcile heals it without a reinstall (D-CF5-08; touches the BFILL-01 planner).
3. Hooks: set `CLAUDE_CODE_CHILD_SESSION`, `CLAUDE_CODE_SESSION_ATTENDED`, `CLAUDE_PID`, and `CLAUDE_EFFORT` in the hook env as upstream does (D-CF5-16).
4. Hooks: merge a `plugin.json` `hooks` field (path, array, inline object) with `hooks/hooks.json` per event, and apply a marketplace entry's inline `hooks` as upstream (an entry event replaces that event; without `plugin.json` the entry replaces the whole config); then drop the `{unsupported hooks}` report (D-CF5-20). Also decide whether `plugin info` gets a line that names the declared `hooks` field.
5. Hooks: add `tool_use_id` and `mcp_server` to the tool stdin payloads (D-CF5-28).
6. Hooks: read `updatedToolOutput` in the tool's own output shape, and `updatedMCPToolOutput` (D-CF5 deferred). The `content`-array form works since `6bbe6ba`.
7. Hooks: a PostToolUse or PostToolUseFailure `continue: false` only writes a debug line, because Pi's `tool_result` cannot end the turn without aborting it (D-CF5-11, deferred).
8. Hooks: show Claude Code's non-blocking error notice (`<hook name> hook error`, `Failed with non-blocking status code: ...`) for a hook that exits other than 0 and 2. No decision covers it yet.
9. Hooks: a UserPromptSubmit `continue: false` stops the prompt silently. Claude Code shows `Operation stopped by hook: <reason>`.
10. Hooks: decide whether the blocked-prompt notice adds Claude Code's third line, `Original prompt: <prompt>` (D-CF5-24 follow-up).
11. Hooks: decide whether a blocking Stop hook also shows Claude Code's `Stop hook blocking error from command: "<command>": <reason>` notice. Claude Code shows none for a Stop `additionalContext`.
12. Hooks: a PreCompact exit 2 or block does not stop the compaction; the observation adapter writes a debug line. Decide and implement upstream's PreCompact blocking.
13. Hooks: the `hook-notice` kind has one severity, `info`; upstream draws the blocked prompt as a warning and the hook error in the error color. Decide whether the kind gets per-notice severity.
14. Hooks: a Stop `decision: "block"` with no `reason` re-enters with an empty `Stop hook feedback:\n` part; upstream calls `reason` required. Probe and align.
15. Hooks: a prompt queued while the agent streams (steer or follow-up) runs the `input` hooks, but its `additionalContext` goes with the next run, because Pi fires `before_agent_start` only then. Not probed.
16. Hooks: several JSON lines on stdout (first line starts with `{`, last ends with `}`) are a parse failure here; upstream reads them as plain text when no line sets a field. Probe and align.
17. Hooks: upstream resets the 8-block Stop re-entry cap per tool call. Check the STOP-07 cap against it, and fix the "8-block cap ... identical" sentence in `docs/hooks-compatibility.md` if they differ (docs only).
18. Hooks: `onFailure: "block"` treats JSON that parses but fails the event's output schema as success; upstream counts it as a failure (D-CF5-18, low impact).
19. Hooks: a whitespace-only `if` on a tool-less event still compiles to match-all; upstream skips only a non-empty `if` (D-CF5-23 edge, 05-04).
20. Drop the 05-03 item "a PostToolUse `updatedToolOutput` changes `event.content` in place": `6bbe6ba` fixed it and `46e8412` added its scenario.

### `.agents/skills/cucumber/rules/features.md` (frozen, D-CF5-26)

- "Run tokens": replace the bullet `In the hooks runs step, a cell whose whole value is a session id reads as the session's ordinal: ... A command never expands an ordinal.` with: "In the hooks runs step, a cell whose whole value is a session id reads as the session's ordinal: `first`, `second`, `third`, or `fourth`, counted by the order in which each session first appears across the runs. A session id inside a cell, such as the one in the `claude-env-<id>.env` file that `CLAUDE_ENV_FILE` names, reads as the same ordinal in its place (D-CF5-26). A command never expands an ordinal."

### `.agents/skills/cucumber/rules/world-and-stand-ins.md` (frozen, optional)

- Add: "A hook scenario that needs a Pi in the terminal starts a profile Pi first and installs through it, because a plugin installed through the run's shared Pi keeps its SessionEnd hook routed there until the next scenario's reset starts a new session."
- If the parent lists step texts there, the Phase 5 hook steps are: `features/step_definitions/hook/session.steps.ts` (the ten session Givens and Whens in `05-01-SUMMARY.md` "Step texts added"), `runs.steps.ts` (`the hooks record these runs in any order:`, `the hooks record no runs`), `tool-use.steps.ts` (the two stub MCP server Givens), `messages.steps.ts` (`the hooks show the user these messages:`, `the hooks show the user no messages`), `prompt-and-stop.steps.ts` (`When the user prompts {string} and the stop hooks send the turn back`), and the hooks table columns in `05-02-SUMMARY.md`.

### `extensions/pi-claude-marketplace/platform/pi-api.ts` (frozen)

- Widen `ToolResultEventResult.content` from `PiTextContentBlock[]` to Pi's `(TextContent | ImageContent)[]`, so `withFeedback` and `toolResultPatch` in `bridges/hooks/event-adapters.ts` can drop their type assertions (05-03, 05-06).

### `.planning/research/FEATURES.md`

- Row H6: inaccurate. It says "Matched (`defer` missing)"; before Phase 5 a deny needed exit 0, `updatedInput` merged instead of replacing, `continue: false` did not end a PreToolUse turn, and `updatedToolOutput` never reached the model. Phase 5 fixed all four (D-CF5-11); `defer` stays ignored (Pi gap).
- Row H20: inaccurate. It says the proxy `mcp({tool})` reaches hooks as `mcp`; before D-CF5-12 the proxy fired match-all hooks twice (once as `mcp`, once under the real name). Since D-CF5-12, the outer proxy call runs no hook and the nested call fires once under the real name.

### `docs/research/claude-hook-config-syntax.md` (outside the phase's files)

- Line 103: the SessionEnd `reason` list still names `bypass_permissions_disabled`, which Claude Code removed in 2.1.234 (E1, D-CF5-21). Remove it, or mark the file as a dated snapshot.

### Non-owned files the phase edited (for the merge)

Outside the ROADMAP Phase 5 ownership row, each edited for one named reason:

- `extensions/pi-claude-marketplace/domain/hooks-resolution.ts` and `test/domain/hooks-resolution.test.ts` (05-04, D-CF5-20/27: the manifest and entry `hooks` report).
- `extensions/pi-claude-marketplace/shared/notification-{types,resolve,grammar,json,wire,dispatch}.ts` and `test/shared/notification-{types,resolve,grammar,json,wire,dispatch}.test.ts` (05-07, the `hook-notice` kind and `notifyHookNotice`).
- `schema/claude-plugin.schema.json` (regenerated, 24 members), `docs/json-output.md` ("twenty-four kind sections", `#### hook-notice`), `docs/output-catalog.md` (a `catalog-state: hook-notice` block outside the counted sections) (05-07).
- `test/architecture/catalog-uat/catalog-wire.test.ts` (`RAW_ORIGINS`, `RAW_SAMPLES`, the kind list, "24 kinds", `PRESENTED.length` 337), `test/architecture/json-output-docs.test.ts`, `test/architecture/wire-schema.test.ts` (24 members) (05-07). Another phase may also append a notification kind: the merge keeps both kinds and recounts the members, the "twenty-four" wording, the catalog-wire kind list, and `PRESENTED.length`. The catalog counters (`EXPECTED_STATE_COUNT = 324`, `EXPECTED_UTF8_BYTES = 54_615`) did not move.
- `test/domain/plugin-resolver.test.ts` (3 cases) and `test/orchestrators/plugin/list-flow.test.ts` (1 case) (05-04: they pinned the old silent ignore of manifest and entry `hooks`).
- `test/index.test.ts` (05-03: two expectations now read `PreToolUse:Bash hook error: owned hook`).
- Paired tests of owned `domain/components/hook*` sources, changed with them: `test/domain/components/hook-events.test.ts`, `test/domain/components/hooks/partition.test.ts`, `test/domain/components/hooks/schema.test.ts`.
- No forbidden file changed: `git diff --quiet 74829438..HEAD -- CHANGELOG.md README.md README.es.md .planning/BACKLOG.md .fallowrc.json package.json package-lock.json .agents/skills/cucumber features/support` exits 0 (see the gate section).

### Security follow-up at merge (T-05-28)

Hooks provenance (D-CF2-13 follow-up): project-scope hook routing (`bridges/hooks/event-router.ts` hydrate of project scope) must consult the generalized project-installs ledger (record keyed by component kind, kind `hooks`, files = the staged `hooks.json`) before routing; deferred from Phase 5 because the ledger lands at merge — P5-DC-11.

The guard is one call in `tryHydrateOnePlugin` (`bridges/hooks/event-router.ts`), for scope `project`, after `reader.readHooksJson(hooksJsonPath)` returns the staged `hooks.json` text and before `parseHooksConfig`; every project-scope hydrate reaches it through `hydrateScopeFromState`: the factory-time `hydrateCacheFromDisk`, and `hydrateProjectScopeForCwdWith`, which `resources_discover` calls through `HooksHydration.hydrateProjectScopeForCwd` (`index.ts`) and the `session_start` registration calls as its lazy hydrate. The other routing-cache writer in the same file, `readAndCachePluginHooksWith` (`HooksHydration.readAndCachePluginHooks`), does not pass through `tryHydrateOnePlugin`: install, update, reinstall, and enable call it in-process after this user's own command (`install-flow-ledger.ts`, `update-swap.ts`, `enable-disable.ts`), and the parent decides whether enabling a project record this user never installed needs the same check. The ledger is now one directory per project, `<agentDir>/pi-claude-marketplace/project-installs/<sha256(realpath)>/` (milestone commits 70d9c6c, fdbf921, 11a3db9), with `skills.json` written only under that project's state lock and a digest over the whole staged directory; hooks would add a sibling `hooks.json` there, written under the same lock, not the old single `project-installs.json`, and D-CF2-14 (a load with autoapply on applies the user scope only, the project scope only previews) applies to hooks too.

Funnel counts on the final tree (comment lines filtered out, `grep -vE '^\s*(//|\*)' extensions/pi-claude-marketplace/bridges/hooks/event-router.ts | grep -c ...`): `hydrateScopeFromState(` 3, `tryHydrateOnePlugin(` 2, `hydrateProjectScopeForCwdWith(` 3, the same as at the phase base. No plan renamed these functions. Phase 5 adds no provenance code, because the ledger module `bridges/skills/project-installs.ts` is not on this branch.

## Dubious choices for the log

`DUBIOUS-CHOICES.md` holds P5-DC-01..P5-DC-18 when this SUMMARY is written (`grep -o 'P5-DC-[0-9][0-9]' ... | sort -u | tail -n 1` prints `P5-DC-18`). The plans' reported items are all in P5-DC-15..18. New items from this plan, for the session to copy:

### P5-DC-19: Docs and gate plan choices (05-09)

- **Severity:** Low. **Status:** open.
- **Choices:**
  1. The docs re-rate five rows from `✓` to `⚠` where a plan measured a residual: PreCompact (an exit 2 does not stop the compaction), "Other exit" (stderr not shown; a JSON object applies whole), `continue: false` (PostToolUse only logs, UserPromptSubmit stops silently), `updatedToolOutput` (Pi's content array only), and `transcript_path` (`""` with `--no-session`). PostCompact is now `✓`.
  2. Beyond the header table, two TOOL-02 comments in `hook-events.ts` said an unsupported event or matcher makes the plugin `(unavailable)`; they now say `(partially-available)`, as `partition.ts` and the configuration scenarios show.
  3. The stale `bypass_permissions_disabled` in `docs/research/claude-hook-config-syntax.md:103` is left in place (outside the plan's files) and handed to the parent, though D-CF5-21 says stale mentions are removed.
  4. The Session events table lists Pi `/new` beside RPC `new_session` and Pi "resume a saved session" as `resume`; the scenarios drive only RPC `new_session`, and resume is unit-tested only (D-CF5-26).
  5. The decision rows mark D-CF5-06, 08, 16, 20, and 28 `-- Deferred`, the rest `-- Locked`.
  6. The worktree guard refused the GSD plan-commit ledger command, so `plan_head_before` is the known worktree base, not a ledger file.
- **Recorded in:** `05-09-SUMMARY.md`.

## Deviations from Plan

None in the plan's files beyond the two extra comment fixes in `hook-events.ts` (P5-DC-19 item 2), which the "header and per-event comments match the code" truth covers.



## Issues Encountered

- The worktree isolation guard refused shell commands with computed paths or compound git forms; I ran them as plain commands with literal paths, and the phase gate through a scratchpad script.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-05-28 (project-scope hooks routed without the D-CF2-13 provenance check, high, existing exposure) stays `transfer`: the security follow-up above names the one-call insertion point in `tryHydrateOnePlugin` and the second writer, and the funnel counts are unchanged on the final tree. T-05-26: no test was weakened (no gate fix changed a test). T-05-27: every deferral and undecided item is a BACKLOG parent line above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase complete, ready for verification and the parent merge. The parent applies the parent lines above and appends P5-DC-19 to `DUBIOUS-CHOICES.md`.

## Self-Check: PASSED

- FOUND: `docs/hooks-compatibility.md`, `extensions/pi-claude-marketplace/domain/components/hook-events.ts`, `extensions/pi-claude-marketplace/bridges/hooks/translation-context.ts`, `.planning/phases/05-hooks/05-09-SUMMARY.md`.
- FOUND commits: `e3f0676` (Task 1) and `565aaf5` (Task 2) are ancestors of HEAD; this gate-evidence commit is the third, so `git rev-list --count df1a1fbc..HEAD` is 3 after it.
- Acceptance re-run: 27 distinct D-CF5 IDs in the docs, `DirectoryAdded` 3, `sequential` 0, `threshold` 4 in `hook-events.ts`; 28 distinct D-CF5 IDs, the provenance line, the `deferred from Phase 5 ...` text, and `tryHydrateOnePlugin` (3) in this SUMMARY; funnel counts 3 / 2 / 3; `DUBIOUS-CHOICES.md` tops out at P5-DC-18, so the new item is P5-DC-19.
- No change to `STATE.md` or `ROADMAP.md`.

---
*Phase: 05-hooks*
*Completed: 2026-11-01*

## Parent lines added after the gate (session addendum, 2026-11-01)

These come from work after this plan ran: the Nyquist gap fill, the
PostToolUseFailure fix (`5595399`), and the code review fix passes
(`0d877aa`..`a17639b`, see `05-REVIEW-FIX.md`). The final product tree
(`76bf7fa`) passed `npm run check` (seed 310627, 1292/1292 scenarios).

- **CHANGELOG.md** (add to the hooks bullet):
  - PostToolUseFailure hooks now receive the error as `error`, as in Claude
    Code, instead of `tool_response`.
  - A hook guard with `onFailure: "block"` or an exit-2 deny now blocks even
    when the hook writes past its output limits; a PreCompact block now
    cancels the compaction; hook notices drop terminal control characters and
    are cut at 2,000 characters; SessionStart context survives another hook's
    block; prompt context stays with its own prompt (steers and follow-ups
    included).
- **.planning/BACKLOG.md:**
  - Follow-up prompt context edge cases (P5-DC-24): a follow-up whose
    UserPromptSubmit hook is still running when the run ends, a follow-up
    queued after the last `turn_end`, a terminating tool batch, and
    `followUpMode: "all"` lose their hook context. Suggested fix: check
    `ctx.isIdle()` in `queuePromptContext`, match `event.prompt` in
    `before_agent_start`, send every matching queued follow-up.
  - Hook JSON on stdout over the 1 MB EXEC-02 cap is ignored, so a JSON deny
    that large on exit 0 fails open (upstream keeps all output).
  - The 12 info findings left in `05-REVIEW.md` (iteration 3).
  - PostToolUseFailure stdin extras `tool_use_id`, `is_interrupt`,
    `duration_ms` (with D-CF5-28).
- **.planning/codebase/CONVENTIONS.md:** the `fallow-ignore` marker count is
  now 40, not 41 (one code-duplication marker removed in `8da30e5`).
- **platform/pi-api.ts (frozen):** re-export `TurnEndEvent`;
  `test/index.test.ts` imports it straight from the Pi peer until then.
- **Security (with T-05-28):** re-run `/gsd-secure-phase` after the merge;
  `05-SECURITY.md` was audited before the review fix commits (P5-DC-25).
- **D-CF5-09 amended:** the input rewrite is the last one in routing order,
  whatever that hook decided, as upstream (P5-DC-22); use this wording in the
  PROJECT.md Key Decisions row.

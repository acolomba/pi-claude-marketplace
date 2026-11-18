# Phase 5: Stop Continuation and Hook Failures - Context

**Gathered:** 2026-11-14
**Status:** Ready for planning
**Mode:** autonomous discuss (`--auto`; the user said "just go ahead without
asking me"). Every question took its recommended answer. The answers that are
product calls or hard to undo are marked **pending maintainer review**.

<domain>
## Phase Boundary

Deliver PG-HOOK-02, PG-HOOK-23, PG-HOOK-14, and PG-HOOK-21, so that a `Stop`
hook that blocks continues the same run, and a hook that fails, names a
missing script, returns too much context, or runs in the background behaves
as it does in Claude Code:

- A blocking `Stop` hook continues the run it ended, on Pi's
  `agent_before_settle` event. A run raises one `agent_settled` event however
  many times a `Stop` hook blocked, and the limit of eight continuations and
  its reset (PG-HOOK-13) hold on the new event (PG-HOOK-02).
- A `Stop` or `UserPromptSubmit` hook that exits 2 because its script file is
  missing does not block (PG-HOOK-23).
- A hook that fails without blocking shows one notice with the first line of
  its stderr. A hook's `stopReason` is shown to the user. Context beyond
  10,000 characters does not reach the model (PG-HOOK-14).
- A plain `async` hook has no timeout (PG-HOOK-21).

Phases 2 and 3 are complete. This phase changes nothing inside Pi or a
companion package and does not raise the Pi floor: `agent_before_settle` is
in Pi since 0.87.0. `Stop` still does not run in a pi-subagents child
(D-PG3-04). `SubagentStop` stays unsupported (PG-HOOK-07b). Reading
`CLAUDE_CODE_STOP_HOOK_BLOCK_CAP` stays out of scope (REQUIREMENTS, Out of
Scope). `PostToolBatch` on `turn_end` (the PRD's HOOK-08) is not part of this
phase. The corrections to `docs/hooks-compatibility.md` land here.

</domain>

<decisions>
## Implementation Decisions

### Stop continuation (PG-HOOK-02)

- **D-PG5-01:** `Stop` runs on `agent_before_settle` in every mode (`tui`,
  `print`, `json`, `rpc`). The handler runs the `Stop` bucket only when the
  run's last assistant message ended with `stop`, as today (STOP-01). It
  cannot use `event.outcome` alone for that: Pi 1.5.0 maps both `stop` and
  `length` to `completed` (`dist/core/agent-session.js:500-502`). When a hook
  blocks or adds context, the handler returns `continue: true` and one hidden
  `custom_message` draft, appended after `event.entries`. The draft is the
  message that the follow-up carries today: type `claude-hook-stop-block`,
  one `Stop hook feedback:\n<text>` part per value in routing order
  (D-CF5-25), `display: false`, `details.pluginId`. The handler never returns
  `continue: false` and never drops an entry another extension's handler
  proposed. Pi merges each handler's result into one proposal, and a returned
  field replaces that field. The `Stop` path no longer calls
  `pi.sendMessage(..., { deliverAs: "followUp", triggerTurn: true })`.
  — **Reversibility:** costly — every `Stop` scenario, the compatibility
  page, and the PROJECT.md fire-point decision pin the event.
- **D-PG5-02:** No second path ships by default. Research measures the cases
  that spike S1 did not run, before the plan fixes the event: the `rpc` mode
  and Pi 1.5.0 (the cucumber harness drives Pi 1.5.0 over RPC, so the phase's
  own scenarios measure both), the terminal mode (the pty harness,
  `features/lib/pi-tui.ts`), the `json` mode, and one handler that runs past
  two minutes (a one-time measurement, not a committed scenario). If a mode
  does not behave as print mode did, that mode alone keeps today's
  `agent_settled` re-entry, chosen by `ctx.mode`, and the compatibility page
  names it. A source read of Pi 1.5.0 predicts no such mode: every mode runs
  the same `_startRun` loop (see Specific Ideas, record 1).
- **D-PG5-03:** `StopFailure` stays on `agent_settled`, with the last
  assistant message cached from `agent_end`. Only the `Stop` arm moves. One
  ending must run `Stop` at most once (never again at `agent_settled`), and a
  `length` or `error` ending must still reach `StopFailure` once. The planner
  chooses where the last assistant message comes from: the existing
  `agent_end` cache, or `event.context.contextMessages`.
- **D-PG5-04:** The loop protection moves unchanged (D-PG2-11, D-88-08).
  Eight continuations in a row are granted. The ninth block is overridden and
  shows the one cap notice. A tool call, a user input, a `Stop` run that asks
  for no continuation, and a reload start the count again. A continuation for
  `additionalContext` alone counts as a block does. `stop_hook_active` is
  true on a `Stop` run that follows a continuation.
  `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP` is not read: REQUIREMENTS lists it as out
  of scope, which settles the "Phase 5 owns ... the cap environment variable"
  note of D-PG2-11.
- **D-PG5-05:** A `Stop` hook's `continue: false` still wins inside the
  bucket (STOP-06): the bridge asks for no continuation. It does not veto a
  continuation that another extension's handler asked for, because upstream
  has no rule for other extensions.
- **D-PG5-06:** The wake of an `asyncRewake` hook stays a follow-up message
  that starts a run when Pi is idle (D-BG-202, D-BG-203, D-BG-210).
  PG-HOOK-02 covers the synchronous `Stop` block only.
- **D-PG5-07:** The continuation is not a run start, and the bridge does not
  imitate one. `before_agent_start` does not fire again. Research before
  planning: list what today relies on the extra run start between a block and
  the next model call, and confirm that none of it needs the event. Known
  candidates: the `before_agent_start` context drains (D-CF5-13), an `async`
  hook's answer sent with `deliverAs: "nextTurn"` (D-BG-205; Pi adds such
  messages only when a run starts), the rewake mark that `recordRunStart`
  clears (D-BG-210), and the child identity capture. Also measure what
  happens when the user types, or presses Escape, while a `Stop` hook runs
  inside the boundary. Pi's documentation says that an abort there still
  commits the returned entries and drops the continuation. A behavior that
  changes for the user goes into the compatibility page.

### Missing script (PG-HOOK-23)

- **D-PG5-08:** Copy the Claude Code 2.1.323 rule. A synchronous hook on
  `Stop` or `UserPromptSubmit` that exits with code 2, prints nothing on
  stdout (after trimming), and whose stderr matches
  `/no such file|can't open/i` is a non-blocking error. Upstream applies the
  rule to `UserPromptSubmit` only for plugin hooks; every hook this bridge
  runs is a plugin hook. No other event gets the rule. A hook that prints any
  stdout keeps its exit-2 block.
- **D-PG5-09:** Such a run decides nothing. On `Stop` it asks for no
  continuation, and the other `Stop` hooks still decide. On
  `UserPromptSubmit` the prompt goes on with the other hooks' results. The
  run is a failure like an exit 1: on `UserPromptSubmit`, `onFailure: "block"`
  blocks it with the existing `onFailure` reason. `Stop` ignores `onFailure`,
  as today. The `asyncRewake` lane does not change (see Specific Ideas,
  record 2, for what is unverified). The run shows the notice of D-PG5-11.

### Failure notices and `stopReason` (PG-HOOK-14)

- **D-PG5-10 (pending maintainer review; product: which failures become
  visible, and how much noise that adds):** A synchronous hook that ends as a
  non-blocking error shows one notice. These ends count:
  - an exit code other than 0 and 2, or an end by a signal that was not the
    hook's own timeout, when stdout is not a JSON object. A JSON object still
    decides alone (D-CF5-11) and is not a failure;
  - the missing-script exit 2 of D-PG5-08;
  - a hook that cannot start.
  The events are `PreToolUse`, `PostToolUse`, `PostToolUseFailure`,
  `UserPromptSubmit`, `Stop`, `SessionStart`, and `PreCompact`. No notice
  shows in these cases: `SessionEnd` (D-BG-603 stays); `PostCompact` (its
  line after `/compact` already reports the failure, D-BG-501);
  `StopFailure` (its output is discarded); an `async` or `asyncRewake` hook
  (its exit decides nothing, and upstream shows the user nothing, D-BG-205);
  a failure that `onFailure: "block"` turns into a block (the block has its
  own message); a timeout; and JSON that does not parse or fails the schema
  (HOOKSCHEMAFAIL-01). Upstream reports a timeout and a schema failure with
  other texts, and neither has a first stderr line to show.
- **D-PG5-11 (pending maintainer review; product: user-visible wording):**
  The notice texts, each one `hook-notice` at its existing severity
  (D-CF5-24; HOOKSEV-01 stays open) and cleaned by the existing notice
  filter:
  - a failed exit: `<label> hook error: Failed with non-blocking status code:
    <line>`. `<line>` is the first line of the trimmed stderr that is not
    blank, cut to 200 characters and then `…`, as upstream's renderer cuts
    it. With no stderr it is `No stderr output`;
  - a hook that cannot start: `<label> hook error: Failed to run: <error>`;
  - a missing script: `<label> hook error: Hook script appears to be missing
    — "<command>" exited 2 with: <trimmed stderr>. Treating as non-blocking.`
    and then a sentence that names the `/claude:plugin reinstall` command for
    that plugin. Upstream's sentence names `/plugin`, which Pi does not have.
  `<label>` is the existing label (`PreToolUse:Bash`, `UserPromptSubmit`,
  `Stop`, `SessionStart:startup`). The one-line `<label> hook error: <text>`
  form is the form `hookErrorText` already writes. Upstream draws two rows on
  most events and one `Stop hook error: <text>` row on `Stop`.
- **D-PG5-12:** One notice for each failed hook, in routing order, with the
  event's other notices. When a multi-pair edit runs one hook once per pair
  (D-PG2-01) and each run fails with the same text, the event shows that
  notice once. A hook that cannot start shows its notice once per hook and
  bridge load, because upstream shows a start failure once (the key of its
  once-only set was not read; see record 3).
- **D-PG5-13 (pending maintainer review; product: the `Stop` wording is an
  adaptation):** A `continue: false` shows its `stopReason` where the bridge
  honors the stop:
  - `UserPromptSubmit`: `Operation stopped by hook: <stopReason>`, or
    `Operation stopped by hook` with no reason. These are upstream's texts.
    The prompt still does not reach the model.
  - `PreToolUse`: `PreToolUse:<Tool> hook stopped continuation: <stopReason>`.
    With no reason it uses the default reason the block already carries.
  - `Stop`: `Stop hook stopped continuation: <stopReason>`. With no reason it
    shows nothing. Upstream prints the bare reason under its `Ran N stop
    hooks` row, which Pi does not have.
  `PostToolUse`, `PostToolUseFailure`, and `PreCompact` show nothing, because
  the bridge cannot stop there (HOOKPOSTSTOP-01), and a notice would claim a
  stop that did not happen. The reason is not added to the conversation in
  this phase (see Deferred Ideas).

### The 10,000-character limit (PG-HOOK-14)

- **D-PG5-14:** The limit applies to each string a hook sends to the model as
  context, measured alone and before any join: a hook's `additionalContext`
  on every event and in both lanes, plain stdout that counts as context
  (`SessionStart`, `UserPromptSubmit`), and the `systemMessage` of a plain
  `async` hook's answer, which goes to the model (D-BG-205). A string of
  10,000 characters or fewer passes unchanged. Length is the JavaScript
  string length, as upstream measures it. The limit does not apply to a block
  reason, an exit-2 stderr, a rewake text, or a replaced tool output. A
  synchronous hook's `systemMessage` goes only to the user and already ends
  at the notice bound of 2,000 characters.
- **D-PG5-15 (pending maintainer review; product: the bridge starts to keep
  hook output in files):** A string over the limit is written whole to a
  file, and the model receives the file path and the first 2,000 characters,
  in upstream's wrapper:

  ```text
  <persisted-output>
  Output too large (<size>). Full output saved to: <path>

  Preview (first 2KB):
  <the first 2,000 characters>
  ...
  </persisted-output>
  ```

  The file lives under the data root of the hook's plugin scope, in
  `_shared/hook-output/`, written atomically (NFR-1) and inside
  `<scopeRoot>/pi-claude-marketplace/` (NFR-10). Upstream writes to its
  session directory. Pi's session directory is outside the paths this
  extension may write, so this location is the adaptation. When the bridge
  loads, it removes the files in that folder that are older than 30 days.
  This retention is a project choice: upstream ties the file to the session.
  When the write fails, the model receives the head of the string and the
  line `[Hook <source> truncated at 10000 chars — persist-to-disk failed:
  <error>]`, cut so that the whole text stays within 10,000 characters. The
  failure never fails the event.
- **D-PG5-16:** The cap is one pure function with an injected writer, called
  where a hook result becomes model context, so both lanes share it. No text
  that replaces a capped string exceeds 10,000 characters (success
  criterion 4).

### Plain `async` hooks (PG-HOOK-21)

- **D-PG5-17:** A plain `async` hook (`async: true` without
  `asyncRewake: true`) gets no timer. Its declared `timeout` is ignored, with
  one debug line. An `asyncRewake` hook keeps its declared `timeout`, or
  600 s, and the SIGTERM and SIGKILL ladder. A hook with both flags is an
  `asyncRewake` hook, as today.
- **D-PG5-18 (pending maintainer review; product: outside Linux nothing
  stops a plain `async` hook that never ends):** What stops a hook does not
  change. A hook ends when its process ends. A `/reload` or the next start
  stops what an earlier load left (D-BG-207). A pi-subagents child stops its
  own hooks when it ends or reloads. A main session that quits leaves its
  hooks running, as Claude Code does (`0b49ad9e`). The reap stops a live
  process only where it can prove that the process is the hook, which is
  Linux only. So on macOS and Windows a plain `async` hook that never ends is
  no longer stopped by its timer, and a reload does not stop it either. The
  compatibility page says so. ASYNCRELOADTABLE-01 and ASYNCLIFECYCLE-01 are
  not folded into this phase. The change must not widen ASYNCRELOADTABLE-01:
  an old load's late exit must not write more than it writes today.

### Records and evidence

- **D-PG5-19:** Correct `docs/hooks-compatibility.md` in the same change.
  The ROADMAP names lines 76 to 80 and 259; the file has grown since, so find
  each passage by its heading or row:
  - "Turn-boundary timing shift" (now `:144-148`): a blocked `Stop` continues
    the same run; one `agent_settled`; no second run start. Name what stays
    different (D-PG5-07) and any fallback mode (D-PG5-02).
  - the `Stop` row of the Events table and the `decision: "block"` row
    ("re-enters via `followUp` + `triggerTurn`");
  - "Other exit -> non-blocking, stderr to user" (now `:328`), and the
    missing-script rule;
  - "Large stdout or stderr" (now `:329`): the bridge still reads all output,
    and a context string over 10,000 characters is saved to a file;
  - the `continue: false` row (`:330`) and the "Messages to the user" list:
    the new notices of D-PG5-11 and D-PG5-13;
  - the `timeout` and `async` rows (`:279-280`): a plain `async` hook has no
    timeout, and the residual of D-PG5-18.
  Also update `docs/output-catalog.md` where its `hook-notice` text lists the
  notices, and add the CHANGELOG lines with the `changelog` skill.
- **D-PG5-20:** Each success criterion ships a cucumber scenario that fails
  without its change (AGENTS.md "Behavioral tests"):
  1. a run that a `Stop` hook blocks twice: one `agent_settled`, one run
     start, three model calls; and the always-blocking hook: eight
     continuations, then the cap notice, on the same path;
  2. a `Stop` hook that names a missing script: the run ends, one notice,
     one model call; a prompt hook that names a missing script: the prompt
     reaches the model, one notice;
  3. a hook that exits 1 with `boom` on stderr: one notice that holds `boom`;
     a `UserPromptSubmit` hook with `continue: false` and a `stopReason`: the
     notice holds the reason and the model receives no call;
  4. a hook that prints 12,000 characters of context: the model receives at
     most 10,000 for it, and the saved file holds all 12,000;
  5. a plain `async` hook with `timeout: 1` that sleeps 3 seconds writes its
     end marker; a reload stops a plain `async` hook that is running.
  Existing scenarios change with the behavior: the `Stop` scenarios that
  wait "through N agent settlements" in `features/hook/prompt-and-stop.feature`
  now see one settlement, and `features/hook/failures.feature:33` ("A failing
  prompt hook without onFailure lets the prompt through") now expects the
  notice. Owner unit tests cover the edge arms: stdout present with a missing
  script, no stderr, a 200-character line, exactly 10,000 characters, a write
  failure, a hook with both `async` flags. The scenarios have no MCP surface,
  so they run under one profile (D-BG-208 is the precedent). All tests run in
  a hermetic home and never touch the real `~/.pi/agent`.

### Decided autonomously

Reversible technical choices, each cheap to undo before planning: D-PG5-02,
D-PG5-03, D-PG5-04, D-PG5-05, D-PG5-06, D-PG5-07, D-PG5-08, D-PG5-09,
D-PG5-12, D-PG5-14, D-PG5-16, D-PG5-17, D-PG5-19, D-PG5-20. Undo touches one
handler, one pure function, or a doc. D-PG5-01 is the requirement itself
(PG-HOOK-02 names the event, and the PRD rejected `agent_settled` as the main
path), so it is not held for review, but it is costly to undo.

### Pending maintainer review

Recommended answers taken without asking, because the run is non-interactive:

- D-PG5-10: product. Which failed hooks show a notice. A hook that exits 1 on
  purpose becomes visible on every run; upstream has the same.
- D-PG5-11: product. The notice wording, the one-line form, and the Pi
  command in the missing-script sentence.
- D-PG5-13: product. Where a `stopReason` shows, and the `Stop` line, which
  adapts upstream's summary row.
- D-PG5-15: product. Hook output over the limit goes to a file under the
  scope's data root, with a 30-day sweep. The simpler choice, cutting at
  10,000 characters with a marker and writing no file, would also meet
  success criterion 4, but it is not what Claude Code does.
- D-PG5-18: product. Outside Linux a plain `async` hook that never ends has
  no bound any more.

### the agent's Discretion

The module and type names. Whether the `Stop` handler reads the `agent_end`
cache or the boundary's context. The file name pattern under
`_shared/hook-output/`. The exact reinstall sentence, as long as it names a
command that works for the hook's plugin and scope and adds no unrelated
flag. The harness seam that counts `agent_settled` and run starts. Plan
splits. No exception to plan size, security, coverage, or verification
gates.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements and evidence

- `.planning/ROADMAP.md` — "Phase 5: Stop Continuation and Hook Failures":
  goal, notes, and the five success criteria.
- `.planning/REQUIREMENTS.md` — PG-HOOK-02, PG-HOOK-23, PG-HOOK-14,
  PG-HOOK-21, and the Out of Scope row for `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP`.
- `docs/prd/parity-gaps-prd.md` — section 7.2: "HOOK-02" and the "Smaller P1
  requirements" table (HOOK-23, HOOK-14, HOOK-21); section 9, spike S1;
  section 10, the stale statements of `docs/hooks-compatibility.md`.
- `docs/research/parity-gaps/hooks.md` — HOOK-02, HOOK-14, HOOK-21, HOOK-23,
  and "Assumptions I could not verify" (items 01 and 08).

### Earlier decisions this phase builds on

- `.planning/phases/02-hook-payloads-matchers-and-stop-limit/02-CONTEXT.md` —
  D-PG2-11 (the limit of eight and its reset), D-PG2-01 (one hook run per
  edit pair).
- `.planning/phases/03-background-subagents/03-CONTEXT.md` — D-PG3-04 (no
  `Stop` in a child), D-PG3-05 (a child's own hook processes).
- `.planning/PROJECT.md` — Key Decisions: the "Fire-point is `agent_settled`"
  row, D-88-08, D-CF5-11, D-CF5-13, D-CF5-14, D-CF5-18, D-CF5-24, D-CF5-25,
  D-BG-202, D-BG-203, D-BG-205, D-BG-207, D-BG-210, D-BG-501, D-BG-603,
  D-BG-604.
- `.planning/BACKLOG.md` — HOOKERRNOTE-01, HOOKPROMPTSTOP-01,
  HOOKORIGPROMPT-01, HOOKSTOPNOTE-01, HOOKSEV-01, HOOKSCHEMAFAIL-01,
  HOOKPOSTSTOP-01, ASYNCLIFECYCLE-01, ASYNCRELOADTABLE-01.

### Documents this phase corrects

- `docs/hooks-compatibility.md` — the passages D-PG5-19 lists.
- `docs/output-catalog.md` — the `hook-notice` block (byte form locked by
  `test/architecture/hooks-notice-notify.test.ts`).
- `docs/research/issue-103-stop-stopfailure-promotion.md` — the design
  record of the `agent_settled` dispatcher that D-PG5-01 amends.

### Pi contract

- `node_modules/@earendil-works/pi-coding-agent/docs/extensions.md` —
  `:322-336` (the run diagram and the abort rule), `:663-695`
  (`agent_before_settle` and `agent_settled`), `:746-748` (boundary handlers,
  `continue`, allowed draft types).
- `node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts`
  — `:771-819` (`AgentActivityOutcome`, the draft types, `BoundaryState`,
  `BoundaryResult`).
- `node_modules/@earendil-works/pi-coding-agent/dist/core/agent-session.js` —
  `:1441-1490` (`_startRun`), `:1549-1607` (`_handlePostAgentRun`,
  `_runBeforeSettleBoundary`), `:628-646` (`canContinue`).

### Project rules

- `AGENTS.md` — "Behavioral tests", "Build verification", the upstream parity
  constraint, NFR-1, NFR-2, NFR-10, IL-2.
- `.agents/skills/cucumber/SKILL.md`, `.agents/skills/typescript-unit-tests/SKILL.md`,
  `.agents/skills/claude-code-compat-research/SKILL.md`,
  `.agents/skills/changelog/SKILL.md`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `bridges/hooks/settle.ts`: `settleHandlerFor` (the `agent_settled`
  dispatcher), `runStopBucket`, `stopFeedback` (the feedback parts),
  `showStopNotices`, `reenterBounded` and `reenter` (`:456-500`, the
  follow-up re-entry that D-PG5-01 replaces), `runStopFailure` (stays).
- `bridges/hooks/runtime.ts`: `STOP_OVERRIDE_CAP`, `recordStopReentry`,
  `recordStopNonReentry`, `recordToolCall`, `recordUserInput`,
  `isStopHookActive`, `recordRunStart`. The counters need no change.
- `bridges/hooks/event-router.ts`: the registrations at `:1304-1326`
  (`agent_end`, `agent_settled`), `CHILD_EVENT_POLICY` and
  `dispatchesInCurrentSession` (`:137-156`), `sessionShutdownCallback`
  (`:922-958`).
- `bridges/hooks/wire-protocol.ts`: `parseHookStdout`, `exitTwoBlock`
  (`:122-134`, where the missing-script rule belongs), `nonZeroExitResult`
  (`:141-151`, the failure that today only writes a debug line).
- `bridges/hooks/on-failure.ts`: `HookExitFacts` (start failure, timeout,
  exit code, stdout, stderr) and `isFailure`. The same facts can build the
  notice.
- `bridges/hooks/hook-labels.ts`: `hookEventLabel`, `hookMatchLabel`,
  `hookErrorText`, `promptBlockedText`. The new texts belong here.
- `bridges/hooks/dispatch.ts`: `hookNotices` and `showHookNotices`
  (`:640-676`), the `additionalContext` join (`:321-333`).
- `shared/notification-dispatch.ts` `notifyHookNotice` and
  `shared/notification-resolve.ts` `terminalSafeHookNotice` (the 2,000
  character bound).
- `bridges/hooks/async-rewake/registry.ts`: `laneOf` (`:169`),
  `resolveTimeoutSeconds` with `lane: "background"` (`:274-281`),
  `installTimerLadder` at `:328`. The call site shows the ladder on every
  background child, plain `async` included. `async-rewake/async-answer.ts`
  `asyncAnswerTexts` yields the texts D-PG5-14 caps.
- `bridges/hooks/timeout.ts`: `resolveTimeoutSeconds` and its header, which
  says a background hook keeps 600 s.
- `persistence/locations.ts`: the scope's `dataRoot`; `_shared/` already
  holds `async-rewake-children/`.

### Established Patterns

Pure leaf functions with owner unit tests and 100% direct coverage. A
dependency such as the overflow writer is a parameter, not a module global.
All output goes through `notifyHookNotice`; no `console` and no stdio
(IL-2). A Pi event handler never throws (NFR-2). Generation guards protect a
handler from a stale load. Trace the callers with CodeGraph before editing:
`parseHookStdout` serves both lanes, and `reenterBounded` serves the block
and the context continuation.

### Integration Points

- `features/hook/prompt-and-stop.feature` and
  `features/step_definitions/hook/prompt-and-stop.steps.ts` (`:204`, "the user
  prompts ... through {int} agent settlements").
- `features/hook/failures.feature`, `messages.feature`,
  `additional-context.feature`, `async.feature` (`:206`, `:232`, `:342`,
  `:380`; the SIGTERM scenario at `:380` uses `asyncRewake`, so it keeps its
  timeout).
- `features/lib/pi-process.ts` reads `agent_start` and `agent_settled` from
  the RPC stream (`:349-351`); `features/lib/pi-tui.ts` drives a terminal.
- `test/bridges/hooks/settle.test.ts`, `wire-protocol.test.ts`,
  `timeout.test.ts`, `async-rewake/registry.test.ts`, and
  `test/architecture/hooks-notice-notify.test.ts`.

</code_context>

<specifics>
## Specific Ideas

Upstream and Pi evidence, checked 2026-11-14 (compat-research evidence
records). The binary is Claude Code **2.1.323**
(`/home/linuxbrew/.linuxbrew/Caskroom/claude-code@latest/2.1.323/claude`).
The docs page is <https://code.claude.com/docs/en/hooks.md>, fetched the same
day. Pi is `@earendil-works/pi-coding-agent` 1.5.0, the declared floor. No
Claude Code session and no Pi session ran for this record.

1. **Stop continuation (PG-HOOK-02).** Docs, "Stop": a block "Prevents
   Claude from stopping, continues the conversation", and `Stop` "Does not
   run if the stoppage occurred due to a user interrupt". Docs, "Stop input":
   the 8-continuation cap and its reset on a tool call. Confidence high. Pi
   1.5.0 source: `_startRun` loops `agent.prompt` → `_handlePostAgentRun` →
   `_runBeforeSettleBoundary` → `agent.continue()`, so the boundary fires
   again after each continuation, `before_agent_start` runs once per
   `_startRun` (`_prepareRun`), and `agent_settled` is emitted once in the
   `finally` block. `emitBoundary` (`dist/core/extensions/runner.js:759-804`)
   awaits each handler with no timer. An aborted run skips the boundary. A
   continuation needs a context that does not end with an assistant message,
   so the handler must append its message. Every mode uses this session
   core. This agrees with spike S1 (Pi 1.5.2, print mode: nine continuations,
   one `agent_settled`, one `before_agent_start`). Confidence medium-high:
   the source was read, and the terminal, `rpc`, and `json` modes, Pi 1.5.0,
   and a minutes-long handler were not run. Pi constraint: a queued follow-up
   runs before the boundary, so `Stop` does not fire between a reply and a
   queued prompt. That is the same as today.
2. **Missing script (PG-HOOK-23).** Docs, "Exit code output": for `Stop`,
   `SubagentStop`, `TaskCompleted`, and a plugin's `UserPromptSubmit` hook,
   an exit 2 "with nothing on stdout" whose stderr "says a file is missing"
   is a non-blocking error. Binary: `wvr({hookEvent, stdout, stderr,
   pluginId, ...})` returns `(e==="Stop"||e==="SubagentStop"||
   e==="TaskCompleted"||e==="TeammateIdle"||Boolean(pluginId)&&
   e==="UserPromptSubmit")&&!stdout.trim()&&/no such file|can't open/i
   .test(stderr)`. The message is `Hook script appears to be missing —
   "<command>" exited 2 with: <stderr>. Treating as non-blocking. Run
   `/plugin` to reinstall '<plugin>' or remove it from settings.`
   Confidence high. Not verified: how the rule meets `onFailure: "block"`,
   and whether the `asyncRewake` lane applies it. D-PG5-09 treats the run as
   a failure and leaves the background lane alone. The typical cases are an
   interpreter that exits 2 for a missing file (`python3 missing.py`, `sh
   missing.sh` under dash). A missing program in shell form exits 127 and was
   never a block.
3. **Failure notice (PG-HOOK-14).** Docs, "Other exit codes": a `<hook name>
   hook error` notice carries `Failed with non-blocking status code:` and
   "the first line" of stderr. Binary: the message text is `Failed with
   non-blocking status code: ` + the trimmed stderr, or `No stderr output`;
   the renderer `AC()` takes the first line that is not blank and cuts it at
   200 characters with `…`. A hook that fails to run gives `Failed to run:
   <error>`, and a start failure is shown once (`H9n(event, key)`; the key
   was not read). On `Stop` the transcript row is hidden, and the `Ran N stop
   hooks` summary prints `Stop hook error: <text>` with the whole text, plus
   a short `Stop hook error occurred` notification. A timeout is a
   `hook_cancelled` message, and broken or invalid JSON carries the parse or
   schema message. Confidence high for the texts. The project divergence: Pi
   has no summary row, so every event uses the one-line form and the first
   line (the requirement's wording).
4. **`stopReason` (PG-HOOK-14).** Docs, "JSON output": `stopReason` is the
   "Message shown to the user when `continue` is `false`. It stays in the
   conversation". Binary: `UserPromptSubmit` gives `Operation stopped by
   hook: <stopReason>`, or `Operation stopped by hook`, drawn as a warning
   and also added as a user message. Tool events render `<hookName> hook
   stopped continuation: <message>` (`PostToolUse` default: `Execution
   stopped by PostToolUse hook`). `Stop` hides that row and prints the reason
   under its summary. Confidence high for `UserPromptSubmit`, medium for the
   tool events: the `PreToolUse` default text was not read.
5. **The 10,000-character limit (PG-HOOK-14).** Docs, "JSON output":
   `additionalContext`, `systemMessage`, `initialUserMessage`, and plain
   stdout "are capped at 10,000 characters"; each string is measured on its
   own; over the limit, the output goes to "a file in the session directory"
   and is replaced by "the file path and a preview of up to the first 2,000
   characters"; "this cap has no setting or environment variable". Binary:
   `PBe=1e4`; `pxe(text, id, source)` returns the text when `text.length <=
   PBe`, else writes it and returns the `<persisted-output>` wrapper
   (`Output too large (<size>). Full output saved to: <path>`, `Preview
   (first 2KB):`); when the write fails it returns the head and `[Hook
   <source> truncated at <limit> chars — persist-to-disk failed: <error>]`.
   Confidence high. Not read: a second set of limits for one entry and for
   one dispatch (`BNt`), which this phase does not build.
6. **Plain `async` timeout (PG-HOOK-21).** Docs, "Run hooks in the
   background": "Once an async hook is running in the background, Claude
   Code doesn't enforce `timeout` on it. Claude Code still enforces
   `timeout` on a hook you run with `asyncRewake`." In `-p` mode Claude Code
   "kills any async hook still running at teardown". Confidence high for the
   contract, from the docs; the code path was not found in the binary. The
   bridge side is now read at its call site: `registry.ts:328` installs the
   ladder for every background child, so the PRD's "inferred" is confirmed
   by source.

PRD section 5.2 lists no open decision for this phase. Use counts (PRD): 4 of
the 7 official hook plugins have a `Stop` hook.

</specifics>

<deferred>
## Deferred Ideas

- Keeping a `stopReason` in the conversation, so the model sees it later, as
  upstream does. This phase shows it to the user only.
- The `Original prompt:` line of a blocked prompt (HOOKORIGPROMPT-01), a
  notice for a blocking `Stop` hook (HOOKSTOPNOTE-01), and a severity per
  notice (HOOKSEV-01).
- A notice for a `SessionEnd` failure (the open half of HOOKERRNOTE-01), for
  a timeout, and for JSON that fails to parse or fails the schema
  (HOOKSCHEMAFAIL-01).
- Reading `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP` (REQUIREMENTS, Out of Scope).
- Stopping `async` hooks when a print or json run ends, as Claude Code does
  at `-p` teardown. The bridge leaves them running.
- A bound for a plain `async` hook outside Linux (D-PG5-18), with
  ASYNCRELOADTABLE-01 and ASYNCLIFECYCLE-01.
- `Stop` between a reply and a queued follow-up. Pi drains its queue before
  the boundary.
- The per-entry and per-dispatch context limits of Claude Code 2.1.323, and a
  cap for `PreCompact` stdout, which the bridge does not use.
- The missing-script rule in the `asyncRewake` lane.
- `PostToolBatch` on `turn_end` (the PRD's HOOK-08) and `SubagentStop`
  (PG-HOOK-07b).

</deferred>

## Parent lines for the orchestrator

Recommended PROJECT.md and BACKLOG.md amendments. This phase did not edit
PROJECT.md, ROADMAP.md, REQUIREMENTS.md, or BACKLOG.md.

1. Append to the Key Decisions row "**Fire-point is `agent_settled`, not
   `agent_end`**":

   > Amended by D-PG5-01 (parity-gaps, Phase 5): `Stop` runs on `agent_before_settle` and a block continues the same run; `StopFailure` stays on `agent_settled`.

2. Append to the D-CF5-25 row, after "in routing order.":

   > Amended by D-PG5-01: the message is a hidden boundary entry and the run continues; no follow-up message starts a new run.

3. Append to the D-CF5-24 row:

   > Amended by D-PG5-10, D-PG5-11 and D-PG5-13 (accepted without review): the kind also carries the non-blocking failure notice, the missing-script notice, and the `stopReason` notices.

4. Append to the D-BG-205 row:

   > Amended by D-PG5-17: a plain `async` hook has no timeout ladder; an `asyncRewake` hook keeps it.

5. In the D-PG2-11 row, replace "Timing remains on `agent_settled`; Phase 5
   owns event migration and the cap environment variable" with:

   > Timing moved to `agent_before_settle` (D-PG5-01); the cap environment variable stays out of scope (D-PG5-04).

6. Add decision rows D-PG5-01 (the event), D-PG5-08 (the missing-script
   rule), D-PG5-10/11/13 (the notices), D-PG5-14/15 (the limit and its file),
   and D-PG5-17/18 (no timeout for plain `async`) once the phase verifies.
   Mark D-PG5-10, D-PG5-11, D-PG5-13, D-PG5-15, and D-PG5-18 as accepted
   without review until the maintainer confirms them.
7. BACKLOG.md, once the phase verifies: close HOOKPROMPTSTOP-01; narrow
   HOOKERRNOTE-01 to the `SessionEnd` half; add a line to ASYNCRELOADTABLE-01
   that a plain `async` hook has no timer after D-PG5-17, so outside Linux
   nothing stops one that never ends; add items for the deferred ideas that
   have no carrier yet (a `stopReason` in the conversation, `async` hooks at
   print teardown, a notice for a timed-out hook).
8. ROADMAP.md Phase 5 notes cite `docs/hooks-compatibility.md` lines 76 to 80
   and 259. The passages are now at `:144-148` and `:329`.

---

*Phase: 5-Stop Continuation and Hook Failures*

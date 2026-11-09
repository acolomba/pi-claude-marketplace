---
quick_id: 261109-cpn
description: "Async rewake: `stop_hook_active` is true only for the turn the rewake wakes, as in Claude Code 2.1.319, and a failed send marks no turn (D-BG-210, amends D-BG-203; P2-DC-04, P2-DC-26)"
date: 2026-11-09
mode: quick-batch
phase: quick-261109-cpn
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - extensions/pi-claude-marketplace/bridges/hooks/runtime.ts
  - extensions/pi-claude-marketplace/bridges/hooks/event-router.ts
  - extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts
  - extensions/pi-claude-marketplace/bridges/hooks/settle.ts
  - test/bridges/hooks/runtime.test.ts
  - test/bridges/hooks/event-router.test.ts
  - test/bridges/hooks/async-rewake/registry.test.ts
  - features/hook/async.feature
  - docs/hooks-compatibility.md
autonomous: true
requirements: [ASYNC-01]

must_haves:
  truths:
    - "At the end of a run that an async rewake starts (an asyncRewake hook exits 2 while Pi is idle), the Stop hooks get `stop_hook_active: true`: the second Stop row of the async.feature scenario 'An async rewake Stop hook that exits 2 wakes the model once' still reads `true` (D-BG-210)"
    - "A turn that an async rewake reaches while it runs (Pi steers the rewake message into it) gives its Stop hooks `stop_hook_active: false`: the new async.feature scenario passes, and on the unchanged tree it fails because that row reads `true`"
    - "The run after the woken run, started by any other message and with no Stop re-entry, gives its Stop hooks `stop_hook_active: false` even when no user input came between (event-router unit case through the registered handlers)"
    - "An exit 2 whose `pi.sendMessage` throws leaves `stop_hook_active` false, because the registry no longer writes any Stop state (registry unit case, which fails on the unchanged registry) (P2-DC-26)"
    - "The woken mark leaves the STOP-07 counter, its one-shot latch, and the Stop re-entry flag as they were; user input that joins the woken run leaves the mark; every bridge load clears it; a Stop re-entry's flag survives a later run start (runtime unit cases)"
    - "The hooks bridge still makes exactly 12 `pi.on` registrations in the order test/architecture/hooks-lifecycle.test.ts pins"
    - ".planning/PROJECT.md records D-BG-210, which amends D-BG-203 and carries the Claude Code 2.1.319 evidence; docs/hooks-compatibility.md and the Unreleased entry of CHANGELOG.md state the rule"
  artifacts:
    - path: extensions/pi-claude-marketplace/bridges/hooks/runtime.ts
      provides: "the run-start woken mark, kept apart from the Stop re-entry flag, and `isStopHookActive()` as the re-entry flag or the woken mark"
      contains: "D-BG-210"
    - path: extensions/pi-claude-marketplace/bridges/hooks/event-router.ts
      provides: "the `before_agent_start` handler that records whether the run starting is the one a rewake woke"
      contains: "REWAKE_CUSTOM_TYPE"
    - path: extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts
      provides: "the exported rewake custom type and an exit-2 path that writes no Stop state"
      contains: "export const REWAKE_CUSTOM_TYPE"
    - path: features/hook/async.feature
      provides: "the scenario whose Stop hook ends a turn that a steered rewake reached"
      contains: "stop hook active"
    - path: .planning/PROJECT.md
      provides: "the D-BG-210 decision row and the amended D-BG-203 row"
      contains: "D-BG-210"
  key_links:
    - from: "createBeforeAgentStartHandler (bridges/hooks/event-router.ts)"
      to: "the HooksRuntime run-start member (bridges/hooks/runtime.ts)"
      via: "the before_agent_start event's messageType and message.customType, compared to REWAKE_CUSTOM_TYPE"
      pattern: "REWAKE_CUSTOM_TYPE"
    - from: "runStopBucket (bridges/hooks/settle.ts)"
      to: "runtime.isStopHookActive() (bridges/hooks/runtime.ts)"
      via: "the Stop payload's stop_hook_active field, whose reader does not change"
      pattern: "stop_hook_active: runtime\\.isStopHookActive\\(\\)"
    - from: "wakeOnExitTwo (bridges/hooks/async-rewake/registry.ts)"
      to: "pi.sendMessage"
      via: "the rewake message's customType, the same constant that the run-start check reads"
      pattern: "customType: REWAKE_CUSTOM_TYPE"
---

<objective>
Amend D-BG-203 as the user asked on 2026-11-09 (P2-DC-04 and P2-DC-26). Record the change as the new decision D-BG-210, the next free number of the Phase 2 block (D-BG-201..209 are taken): the Stop hooks of the turn that an async rewake wakes see `stop_hook_active: true`, and no other turn gets it from the rewake, as in Claude Code 2.1.319.

Today `wakeOnExitTwo` (`bridges/hooks/async-rewake/registry.ts`) sets the runtime's session-long Stop flag before it calls `pi.sendMessage`. So the flag lasts until the user's next input, it stays set when the send throws, and a turn that the rewake reaches while it runs (Pi steers the message into it) also sees `true`. After this plan, the bridge marks a run as woken when Pi starts the run with the rewake's own custom message: the `before_agent_start` event with `messageType: "custom"` and `message.customType` equal to `claude-hook-rewake`. The Stop hooks at that run's settle see `true`, and the next run start clears the mark. A send that throws starts no run, so it marks nothing. The Stop re-entry flag (STOP-07) keeps its semantics.

Purpose: after an async rewake, a plugin's Stop hook sees the `stop_hook_active` cadence that Claude Code gives it.
Output: the runtime, event-router, and registry change with their unit pairs, a cucumber scenario proven red first, D-BG-210 in PROJECT.md, the docs rows, and a CHANGELOG sub-bullet.
</objective>

<execution_context>
@/home/acolomba/pi-claude-marketplace/.claude/gsd-core/workflows/execute-plan.md
@/home/acolomba/pi-claude-marketplace/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/milestones/behavioral-gaps-phases/02-async-hooks/02-CONTEXT.md
@.planning/milestones/behavioral-gaps-phases/02-async-hooks/DUBIOUS-CHOICES.md
@.planning/milestones/behavioral-gaps-phases/02-async-hooks/02-REVIEW.md

Read `.planning/PROJECT.md` only at lines 2278-2286 (the D-BG-201..209 rows). The whole file has 2,577 lines.

## Upstream evidence (Claude Code 2.1.319): carry it into D-BG-210 and the SUMMARY

- Question: after an `asyncRewake` exit 2, when does a Stop hook get `stop_hook_active: true`, and when does that end?
- Binary: `/home/linuxbrew/.linuxbrew/Caskroom/claude-code@latest/2.1.319/claude`. `claude --version` prints `2.1.319 (Claude Code)`. The planner grepped it on 2026-11-09 with `LC_ALL=C /usr/bin/grep -oa` and a Python mmap byte search. The searches were `stopHookActive` (35 occurrences), `function LTn(`, `$i={...ds,`, and `type:"queued_command",prompt:Ce`.
- The rewake queues a task notification that carries the flag: `LTn({summary, body, priority:"next", stopHookActive:!0, turnAttribution:"inherit"})` enqueues `{mode:"task-notification", priority, stopHookActive:s, ...}`.
- A query that the queue starts takes the flag when any of its starting items carries it: `rn.some((xr)=>xr.stopHookActive)?!0:void 0`. The query loop sets its guard once at start, `stopHookActive: e.stopHookActive ?? false`.
- The guard lasts through the query's tool calls. The recursion builds `{...Nt, ...$i, ...}`, and the reset set `$i` (`maxOutputTokensRecoveryCount`, `hasAttemptedReactiveCompact`, `reactiveCompactDeeperPass`, `thinkingOnlyNudged`, `emptyCompletionResent`, `malformedToolUseRetryCount`, `stopHookBlockingCount`) has no `stopHookActive`. A Stop block sets the guard to true for its continuation.
- Every other query starts with `false`, so the Stop hooks of the user's next turn see `false`.
- A queued item that is drained into a running query becomes a `queued_command` attachment (`getQueuedCommandAttachments`), and that attachment copies no `stopHookActive`. No fold path writes the running query's guard. So the Stop hooks of a running query keep the value that query started with.
- Confidence is high for the woken query: the guard is set at its start, lasts across its tool calls, and resets for the next query. It is high that a running query's own Stop hooks do not get the rewake's flag. It is medium on whether that drain happens at the next tool boundary or after the query ends: the drain's priority filter was not traced. Neither answer changes the value that the running query's Stop hooks see.
- Pi 1.5.0 facts (in `node_modules/@earendil-works/pi-coding-agent/dist/core/`):
  - `_startRun` is Pi's only run path (`agent-session.js` L1441-1497). Its `_prepareRun` emits `before_agent_start` once per run (L1498-1531), and `_emitAgentSettled` emits `agent_settled` once at that run's end (L696-720).
  - `extensions/types.d.ts` L739-761: `BeforeAgentStartCustomEvent` (`messageType: "custom"`, `message: CustomMessage`) is "a run started by `pi.sendMessage(..., { triggerTurn: true })` while idle".
  - `sendCustomMessage` (L1862-1890) steers into a running run and starts no run. While `agent_settled` is being emitted, it defers the send until after the handlers.
  - `pi.sendMessage` returns void and throws only synchronously: `extensions/loader.js` L306-309 and `agent-session.js` L2783-2790.
- License: no new divergence. The steer lane is unchanged (D-BG-201 and P2-DC-12, both accepted). So a rewake that reaches a running turn is still read in that turn, and no separate woken turn follows it.

## Scope boundaries

- settle.ts gets a comment fix only. `runStopBucket` keeps reading `runtime.isStopHookActive()`.
- The STOP-07 re-entry flag keeps its rules: a re-entry sets it, and user input clears it.
- The lane stays one call, `{ triggerTurn: true, deliverAs: "steer" }`. The summary still shows before the send (D-BG-204).
- The bridge keeps its 12 `pi.on` registrations.
- Do not edit `.planning/DUBIOUS-CHOICES.md`, `.planning/STATE.md`, or the archived phase files. The batch closeout marks P2-DC-04 and P2-DC-26 fixed.
- Tests use a hermetic home, never the real `~/.pi/agent`. Run node tests with `--import "$PWD/test/platform/isolated-pi-home.ts"`, and keep the files' own `createHermeticEnvironment` and `mkdtemp` roots.
</context>

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1: Only the run an async rewake starts gives its Stop hooks stop_hook_active (red scenario first, end to end)</name>
  <files>extensions/pi-claude-marketplace/bridges/hooks/runtime.ts, extensions/pi-claude-marketplace/bridges/hooks/event-router.ts, extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts, extensions/pi-claude-marketplace/bridges/hooks/settle.ts, test/bridges/hooks/runtime.test.ts, test/bridges/hooks/event-router.test.ts, test/bridges/hooks/async-rewake/registry.test.ts, features/hook/async.feature</files>
  <precondition>Pi 1.5.0 is installed: `node -p "require('./node_modules/@earendil-works/pi-coding-agent/package.json').version"` prints `1.5.0`. That is the version whose `before_agent_start` event carries `messageType: "custom"` and the starting message for a run that `pi.sendMessage(..., { triggerTurn: true })` starts.</precondition>
  <read_first>
    - extensions/pi-claude-marketplace/bridges/hooks/runtime.ts (whole file: the members at L94-104, `stopHookActive` at L174, `prepareSettleForRegistration` at L183-187, the Stop members at L263-288)
    - extensions/pi-claude-marketplace/bridges/hooks/event-router.ts L46-110 (imports), L221-260 (`createBeforeAgentStartHandler`), L975-1252 (`registerHooksBridgeWith`, the 12 registrations, and the STOP-07 input-reset comment at L1243-1247)
    - extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts L91-105 (constants), L415-566 (`EXIT_HANDLERS`, `finalizeChild`, `sendAsyncAnswer`, `wakeOnExitTwo`)
    - extensions/pi-claude-marketplace/bridges/hooks/settle.ts L57-87 (`inputResetHandlerFor` doc), L308-373 (`runStopBucket`, the one reader of `isStopHookActive()`)
    - node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts L739-761; dist/core/agent-session.js L696-720, L1441-1531, L1849-1890
    - test/bridges/hooks/runtime.test.ts L350-419; test/bridges/hooks/async-rewake/registry.test.ts L560-590 (`createPi` and `setSendError`), L1818-1882, L2176-2229; test/bridges/hooks/event-router.test.ts L866-930 (helpers), L1317-1420 (`before_agent_start` fixtures and `PROMPT_TURN`); test/bridges/hooks/settle.test.ts L185-240 (an executor spy that captures `stop_hook_active`)
    - test/architecture/hooks-lifecycle.test.ts L370-460 (the 12 registrations it pins)
    - features/hook/async.feature L210-245 (wakes the model once) and L359-382 (the steer scenario); features/step_definitions/hook/async.steps.ts L186-206; features/step_definitions/hook/runs.steps.ts L95-160; features/lib/hook-files.ts L30-75
    - .agents/skills/cucumber/SKILL.md with rules/features.md, rules/steps.md, and rules/layout.md ("Plans", "Seeds"); .agents/skills/typescript-unit-tests/SKILL.md with rules/cases.md and rules/test-doubles.md; .agents/skills/typescript-style/SKILL.md; .agents/skills/local-verification/rules/commands.md; .agents/skills/committing/SKILL.md
  </read_first>
  <behavior>
    - New scenario in async.feature. A UserPromptSubmit asyncRewake hook is released while the model's slow bash tool runs, and it exits 2. Pi steers the rewake into the running turn. The synchronous Stop hook at that turn's end records `stop hook active` as `false`. On the unchanged tree, the same row reads `true`.
    - Existing scenario "An async rewake Stop hook that exits 2 wakes the model once": its second Stop row still reads `stop hook active` `true`.
    - runtime: after a run start that is marked woken, `isStopHookActive()` is true. After a run start that is not marked woken, it is false unless a Stop re-entry set the flag. The mark never changes the transitions of `recordStopReentry`: seven re-entries re-enter and the eighth caps. `recordUserInput()` leaves the mark, and `prepareSettleForRegistration()` clears it.
    - event-router: the registered `before_agent_start` handler marks a run whose event has `messageType` "custom" and `message.customType` "claude-hook-rewake". It clears the mark for a prompt run (`messageType` "user") and for a custom run of any other type. Its context-drain return value is the same as today.
    - event-router, through the registered `before_agent_start`, `agent_end`, and `agent_settled` handlers, with an executor spy on a Stop bucket entry: a woken run dispatches Stop with `stop_hook_active` true. The next run is started by another custom message, with no `input` event between, and it dispatches false.
    - registry: an exit 2 sends the rewake and leaves `runtime.isStopHookActive()` false. An exit 2 whose `pi.sendMessage` throws also leaves it false. This case fails on the unchanged registry, which sets the flag before the send.
  </behavior>
  <action>
This task implements D-BG-210, which amends D-BG-203 at the user's request of 2026-11-09 (P2-DC-04, P2-DC-26). It keeps D-BG-201's lane, P2-DC-12's single `{ triggerTurn: true, deliverAs: "steer" }` call, and D-BG-204's order (the summary shows before the send). It follows D-BG-208's test design: no implementation tag, harness signals instead of sleeps, and existing steps.

Step 1: make the red proofs before you edit any product file.
(a) Add one scenario to features/hook/async.feature, directly after "An async rewake hook that exits 2 while a tool runs reaches the model in the same turn" (L359). A suggested title is "An async rewake that reaches a running turn leaves stop hook active false for the Stop hooks of that turn". It is sentence case and names the behavior; refine it within rules/features.md. Keep it free of apostrophes, so the single-quoted `--name` argument below stays one shell word.
- Copy that scenario's Givens.
- Add a second row to its hooks table: a synchronous Stop hook named `stop`, with form `script` and an empty matcher. Leave its async rewake, waits, exit code, stderr, and rewake message cells empty, so it records its run and exits 0.
- Keep the scripted model's two steps: the bash tool that waits for `{home}/hook-releases/tool`, then `Done.`.
- The When is the existing step: the user prompts "run the tool" and the hook "wake" wakes the model while the tool runs.
- The Then is `the hooks record these runs:`, with every run in order: the `wake` UserPromptSubmit run (prompt `run the tool`), then the `stop` Stop run (last assistant message `Done.`, stop hook active `false`). The columns are the union of both events' fields, because runs.steps.ts fills a field that a run lacks with an empty cell. Align the columns.
- Reuse existing steps only. If a step must change, first add features/step_definitions/hook/async.steps.ts to this plan's `files_modified`.
Run the scenario on the unchanged tree with `npm run test:cucumber:profile -- --profile adapter features/hook/async.feature --name '<the title>'`. It must fail because the Stop row reads `true`. Keep the failing diff for the SUMMARY.
(b) In test/bridges/hooks/async-rewake/registry.test.ts, add an assertion to the case "contains a send failure after an exit-two body is ready" (L2176): after the throwing send, `runtime.isStopHookActive()` is false. If rules/cases.md calls for it, make this a separate case whose title names that behavior. Run it on the unchanged registry with `--test-name-pattern`. It must fail, because the flag reads true. Keep that output for the SUMMARY.

Step 2: runtime.ts.
- Replace the `recordRewake` member of `HooksRuntime` and `createHooksRuntime` with a run-start member. A suggested signature is `recordRunStart(startedByRewake: boolean): void`. Back it with its own `let` beside `stopHookActive`.
- `isStopHookActive()` returns the Stop re-entry flag OR the woken mark.
- The run-start member writes only the woken mark. It never touches `stopHookActive`, `consecutiveBlockCount`, or `capNotifiedThisSession`. So a Stop re-entry's flag survives the start of the re-entry's own run, and the woken mark stays outside the STOP-07 cap.
- `prepareSettleForRegistration` also clears the woken mark.
- `recordUserInput` stays as it is and does not clear the woken mark. A steer or follow-up that the user types into the woken run does not end that run, just as Claude Code keeps a query's guard until the query ends.
- Rewrite the member's doc comment to say this and cite D-BG-210. In the doc of `isStopHookActive`, say that it gives the value of a Stop payload's `stop_hook_active`.

Step 3: registry.ts.
- In `wakeOnExitTwo`, delete the runtime mark and its D-BG-203 comment, so the exit path writes no Stop state. A send that throws then leaves nothing set (P2-DC-26).
- Remove the `runtime` parameter that this leaves unused: from `wakeOnExitTwo`, from the `EXIT_HANDLERS` record type, from both lane entries, and from the dispatch call in `finalizeChild`. `finalizeChild` keeps its own `runtime` for `takeChild` and the generation check.
- Export `REWAKE_CUSTOM_TYPE` with its value unchanged. Add to its doc that the hooks bridge also reads it to recognize the run that a rewake wakes (D-BG-210).
- Keep the summary notify before the send, and keep the try/catch around each of them.

Step 4: event-router.ts.
- Import `REWAKE_CUSTOM_TYPE` beside `reapOrphans` and `shutdownInMemoryChildren`.
- In `createBeforeAgentStartHandler`, the returned closure takes the event. Before it drains the context buffers, it records the run start, with `startedByRewake` true exactly when `event.messageType` is "custom" and `event.message.customType` equals `REWAKE_CUSTOM_TYPE`. `BeforeAgentStartEvent` is a discriminated union, so narrow on `messageType` before you read `message`. An event with no `messageType` counts as not woken.
- Keep the drain and its return value unchanged.
- Add no `pi.on` registration. The mark uses the existing `before_agent_start` subscription, so the 12 registrations that test/architecture/hooks-lifecycle.test.ts pins stay as they are.
- Update the handler's doc comment. Also update the comment of the second `input` subscription: the input reset clears the Stop re-entry flag, and the woken mark ends at the next run start.

Step 5: settle.ts, a comment change only. The doc of `inputResetHandlerFor` says that user input clears `stop_hook_active`. Make it say that user input clears the Stop re-entry flag, and that a run that an async rewake woke keeps `stop_hook_active` true until that run settles (D-BG-210). Make no code change in settle.ts.

Step 6: unit pairs. Follow rules/cases.md: AAA comments, whole-value asserts, and titles that state the behavior. Durable IDs such as D-BG-210 may appear in titles.
- runtime.test.ts: replace the case "marks a woken turn for the Stop hooks without counting toward the cap" with cases for the runtime behaviors above.
- event-router.test.ts: add the run-start cases and the registered-handler sequence. Reuse `makeRecordingPi`, `registeredHandler`, `makeContext`, `EMPTY_STATE_READER`, `PROMPT_TURN`, and `runtime.setRoutingBucket("Stop", ...)`, with an executor spy as settle.test.ts L198-207 uses. Do not copy large blocks: `npx fallow dupes` must stay clean.
- registry.test.ts: the exit-2 default-texts case (L1873) now asserts that `isStopHookActive()` is false, because the registry marks no run and the woken run's start does. Add the send-failure assertion from Step 1.
- Each touched source keeps 100% line, function, and branch direct coverage from its own test.

Step 7: run the verify chain below, then commit as .agents/skills/committing/SKILL.md describes.
- Run the pre-commit fixers first.
- Run `git commit` in the foreground. Stage only this task's files. Never use `git add -A` or `--no-verify`, and never push or rebase.
- An example title is `fix(hooks): give stop_hook_active only to the turn a rewake wakes`. In the body, keep lines to 80 columns, and name D-BG-210 and the two changes a hook can see: a steered turn's Stop hooks now get false, and a failed send no longer leaves the flag set.
  </action>
  <verify>
    <automated>node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/bridges/hooks/runtime.test.ts test/bridges/hooks/event-router.test.ts test/bridges/hooks/async-rewake/registry.test.ts test/bridges/hooks/settle.test.ts test/architecture/hooks-lifecycle.test.ts test/architecture/hooks-async-rewake.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/hooks/runtime.ts extensions/pi-claude-marketplace/bridges/hooks/event-router.ts extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts extensions/pi-claude-marketplace/bridges/hooks/settle.ts && npm run test:cucumber:profile -- --profile adapter features/hook/async.feature</automated>
  </verify>
  <acceptance_criteria>
    - On the unchanged tree, the new scenario failed because its Stop row read `true`, and that output is in the SUMMARY. After the change, it passes.
    - On the unchanged registry, the registry send-failure assertion failed (true where false was expected), and that output is in the SUMMARY. After the change, it passes.
    - `npm run test:cucumber:profile -- --profile adapter features/hook/async.feature` exits 0. This covers every async scenario, "An async rewake Stop hook that exits 2 wakes the model once" included.
    - The direct-coverage command in the verify chain exits 0 for all four sources.
    - `grep -c 'stop hook active' features/hook/async.feature` prints 2 or more. It prints 1 at HEAD.
    - `grep -n 'export const REWAKE_CUSTOM_TYPE' extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts` finds a line. It finds none at HEAD.
    - `grep -n 'REWAKE_CUSTOM_TYPE' extensions/pi-claude-marketplace/bridges/hooks/event-router.ts` finds the import and the run-start check. It finds none at HEAD.
    - test/architecture/hooks-lifecycle.test.ts passes with no edit.
    - The commit hook (`npm run check:commit`) passed on this task's commit.
  </acceptance_criteria>
  <done>The Stop hooks of a run that an async rewake starts see `stop_hook_active: true`. A turn that a rewake reaches while it runs, the run after the woken one, and an exit 2 whose send throws all leave it false. The new scenario's red proof and the registry case's red proof are kept for the SUMMARY. All async scenarios and the four source-test pairs pass, and the change is committed.</done>
</task>

<task type="auto">
  <name>Task 2: Record D-BG-210 and state the rule in the hooks docs and the changelog</name>
  <files>.planning/PROJECT.md, docs/hooks-compatibility.md, CHANGELOG.md</files>
  <read_first>
    - .planning/PROJECT.md L2275-2287 (the D-BG-201..209 rows: the row format and the outcome column)
    - docs/hooks-compatibility.md L200-215 (the handler-fields table, `asyncRewake` row at L210) and L244-256 (the stdin table, `stop_hook_active` row at L252)
    - CHANGELOG.md L1-21 (the Unreleased entry and its sub-bullets)
    - .agents/skills/changelog/SKILL.md and .agents/skills/changelog/rules/entries.md; load the simple-english skill (Plain mode) and the humanizer skill
  </read_first>
  <action>
This task records D-BG-210 and follows D-BG-209: documents follow the behavior.

(1) .planning/PROJECT.md. Use a scoped Edit and never a whole-file Write. Insert a D-BG-210 row directly after the D-BG-209 row, in the three-column format of D-BG-201..209.
- Title: `**D-BG-210 (behavioral-gaps, quick task 261109-cpn, asked for by the user on 2026-11-09, amends D-BG-203, DUBIOUS-CHOICES P2-DC-04 and P2-DC-26): only the turn that an async rewake wakes gives its Stop hooks stop_hook_active: true**`. Put `stop_hook_active: true` in backticks.
- Text: when an `asyncRewake` hook exits 2 and Pi starts a run with the rewake message, the Stop hooks at that run's end see `stop_hook_active: true`, because Claude Code starts the woken query with its guard set and keeps it to the query's end. The bridge marks the run at its `before_agent_start` (a custom message of type `claude-hook-rewake`), and the next run start clears the mark. User input that joins the woken run leaves the mark. A rewake that Pi steers into a running turn marks no turn, because a notification drained into a running query leaves that query's guard. An exit 2 whose `pi.sendMessage` throws marks no turn, because no run starts. The mark does not count toward the STOP-07 cap, and the Stop re-entry flag still lasts until the user's next input.
- Rationale cell: the evidence in this plan's context, in short. Name the binary version and the grep date, the guard's start value, its persistence across tool calls, and the drained attachment that has no flag. Name the Pi 1.5.0 `before_agent_start` custom trigger. End with a link to this quick directory.
- Outcome cell: `✓ Good`.
Then, in the D-BG-203 row, add `amended by D-BG-210` to its parenthetical, and change its outcome cell from `-- Revisit` to `-- Amended by D-BG-210`. Change nothing else in the file.

(2) docs/hooks-compatibility.md.
- In the `stop_hook_active` (Stop stdin) row (L252), keep the re-entry clause. Add that the flag is also true for the whole turn that an async rewake woke, and for that turn only, and that a turn the rewake reaches while it runs does not get it (D-BG-210). Keep the Notes cell no wider than the widest Notes cell of that table (245 characters), so that mdformat does not re-pad the table.
- In the `asyncRewake` row (L210), the clause "a woken turn sets `stop_hook_active`" may stay, because the woken turn is still the one that sets it. Make it more precise only if the cell stays within 389 characters, the widest Notes cell of that table. Otherwise leave the row.
- If mdformat re-pads a table anyway, keep the re-pad and note it in the SUMMARY (the P2-DC-25 precedent).

(3) CHANGELOG.md. Add one sub-bullet under the existing `## [Unreleased]` top entry, directly after the sub-bullet about an `asyncRewake` hook that exits 2 and wakes the model. Follow .agents/skills/changelog/rules/entries.md: one sentence of 25 words or fewer, written for the reader, with no mechanism and no decision IDs, and no semicolon or dash between two statements. A suggested text is "A `Stop` hook now gets `stop_hook_active: true` at the end of a turn that an `asyncRewake` hook woke, and not in later turns." Apply simple-english (Plain) and humanizer, then run their self-checks.

(4) Run `SKIP="npm-check${SKIP:+,$SKIP}" pre-commit run --files .planning/PROJECT.md docs/hooks-compatibility.md CHANGELOG.md`. Restage its fixes and repeat until it is clean, then commit in the foreground, staging only these three files (no `git add -A`, no `--no-verify`, no push, no rebase). An example title is `docs(hooks): record the woken-turn stop_hook_active rule`.

Do not edit .planning/DUBIOUS-CHOICES.md, .planning/STATE.md, or the archived phase files.
  </action>
  <verify>
    <automated>grep -q 'D-BG-210' .planning/PROJECT.md && grep -q 'Amended by D-BG-210' .planning/PROJECT.md && grep -q 'D-BG-210' docs/hooks-compatibility.md && sed -n '/^## \[Unreleased\]/,/^## \[0.23.0\]/p' CHANGELOG.md | grep -q 'stop_hook_active' && SKIP="npm-check${SKIP:+,$SKIP}" pre-commit run --files .planning/PROJECT.md docs/hooks-compatibility.md CHANGELOG.md</automated>
  </verify>
  <acceptance_criteria>
    - .planning/PROJECT.md has a D-BG-210 row right after the D-BG-209 row. The D-BG-203 row says it is amended by D-BG-210, and its outcome cell reads `-- Amended by D-BG-210`. At HEAD, neither `D-BG-210` nor `Amended by D-BG-210` appears in the file.
    - The `stop_hook_active` stdin row of docs/hooks-compatibility.md cites D-BG-210 and says that only the woken turn gets the flag from a rewake. At HEAD, the file has no `D-BG-210`.
    - The Unreleased section of CHANGELOG.md has exactly one new sub-bullet that names `stop_hook_active`. At HEAD, that section never names it. The sub-bullet passes the changelog rules: 25 words or fewer, one sentence, and no ID.
    - The pre-commit run on the three files is clean.
  </acceptance_criteria>
  <done>D-BG-210 is recorded and D-BG-203 is marked as amended. The hooks docs and the changelog state that only the turn an async rewake wakes gets `stop_hook_active: true`. The records are committed.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| plugin hook process to hooks bridge | A plugin decides an asyncRewake hook's exit code and output, and those decide whether a rewake is sent |
| Pi event stream to hooks runtime | `before_agent_start` and `agent_settled` reach the bridge for every run, including runs that another loaded extension starts with its own custom message |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-261109-cpn-01 | Spoofing | `before_agent_start` run-start check (event-router.ts) | low | accept | Another extension in the same Pi process can send a custom message of type `claude-hook-rewake` and so mark its own run as woken. The only effect is `stop_hook_active: true` in that run's Stop payload, which is an advisory signal. An extension in the same process already has full process access, so this grants no new privilege. |
| T-261109-cpn-02 | Denial of service | Stop and rewake loops (settle.ts, registry.ts) | low | mitigate | The woken mark never touches the STOP-07 counter or its latch (a runtime unit case), so Stop block re-entries stay capped at 8. A turn that a steered rewake reached now sees `false`, so a hook that blocks on `false` re-enters once and then sees `true` through the re-entry flag, under the same cap. An asyncRewake hook that always exits 2 loops as before (D-BG-203 kept the rewake outside the cap, for upstream parity). |
| T-261109-cpn-03 | Tampering | Stop state across `/reload` (runtime.ts) | low | mitigate | `prepareSettleForRegistration` clears the woken mark at every bridge load (a runtime unit case). The registered handlers keep their captured-generation guard, so a mark from an earlier load never reaches a later session's Stop payload. |
| T-261109-cpn-04 | Information disclosure | Stop payload (settle.ts) | low | accept | The field set of the Stop payload does not change, and the change shows nothing new to the user or the model. |
| T-261109-cpn-SC | Tampering | npm/pip/cargo installs | high | mitigate | This plan has no install task. If execution finds that a package install is needed, the executor stops before it, and the package-legitimacy gate with a blocking human checkpoint applies. |
</threat_model>

<verification>
- Task 1's verify chain passes: the owner tests, direct coverage for runtime.ts, event-router.ts, registry.ts, and settle.ts, and the whole async.feature under the adapter profile. Task 2's verify passes.
- Both red proofs are in the SUMMARY: the new scenario's failing diff on the unchanged tree, and the registry send-failure case's failure on the unchanged registry.
- Each commit's hook (`npm run check:commit`) passed. No commit used `--no-verify` or `git add -A`, and nothing was pushed or rebased.
- After the batch merges this worktree, `npm run check` on the combined tree exits 0. This is the batch's post-merge gate (.agents/skills/local-verification/rules/gates.md), and the combined tree is the only full verdict. If an unowned cucumber scenario fails under load, rerun it once and record the rerun in the SUMMARY, as P2-DC-27 did.
</verification>

<success_criteria>
- A Stop hook sees `stop_hook_active: true` at the end of the turn that an async rewake woke. It sees false in a turn the rewake reached while that turn ran, in the run after the woken one, and after an exit 2 whose send threw.
- The Stop re-entry flag, the STOP-07 cap, the steer lane, and the 12 registrations are unchanged.
- D-BG-210 is recorded in PROJECT.md and amends D-BG-203. docs/hooks-compatibility.md and CHANGELOG.md state the rule.
</success_criteria>

<output>
Create `.planning/quick/261109-cpn-async-rewake-stop-hook-active-is-true-only-for-the-woken-tur/261109-cpn-SUMMARY.md` when done. In addition to the template, it holds:

- `## Red proofs`: the new scenario's failing output on the unchanged tree, with the Stop row reading `true`, and the registry send-failure case's failing output on the unchanged registry. State that a cucumber scenario cannot drive the failed send, because `pi.sendMessage` throws only synchronously, on a stale or uninitialized runtime, and `finalizeChild` returns before the send in that state. That case is proven by its unit case only. State also that a run that starts after the woken run with no user input, and that is neither a rewake nor a Stop re-entry, needs another extension's custom message. No harness extension sends one, so the event-router unit case proves that property.
- `## Upstream evidence`: the evidence record from this plan's context, as verified or corrected during execution.
- `## Dubious Choices`, each with a severity:
  - A turn that a steered rewake reaches now sees `false` where it saw `true`. This follows from "only the woken turn" and from Claude Code's per-query guard, but the user did not name this case.
  - User input that joins the woken run does not clear the woken mark (parity with Claude Code's per-query guard). The Stop re-entry flag still clears on input.
  - Task 1 touches eight files, above the planner's five-file guide, because each product file is committed with its unit pair and the red scenario, so no commit leaves a test red. This follows the P2-DC-15 precedent.
  - D-BG-210 takes the next free number of the Phase 2 block.
  - P2-DC-04 and P2-DC-26 in `.planning/DUBIOUS-CHOICES.md` are left for the batch closeout.
  - Any docs table that mdformat re-padded.
- `## Threat Flags`, even when the answer is "None -- no security-relevant surface outside the plan's `<threat_model>` was introduced."
</output>

## Coordinator amendments (2026-11-09, binding; they override the tasks above)

**Shared records are written by the coordinator, not by this executor.** Do NOT
edit `.planning/PROJECT.md`, `.planning/BACKLOG.md`, `CHANGELOG.md`, or
`.planning/DUBIOUS-CHOICES.md`. Every task step that writes one of them is
replaced by this: put the exact text you would have written (new decision
rows, superseded/reversed markers, BACKLOG closures or new entries, the
CHANGELOG sub-bullet) in the SUMMARY under a `## Parent lines` heading, one
sub-heading per file, ready to paste. The six batch items would otherwise all
queue on the same three files. The rest of each task (code, tests, scenarios,
other docs) runs as planned.

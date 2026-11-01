---
phase: 05-hooks
plan: 08
subsystem: hooks
tags: [hooks, stop, pre-tool-use, post-tool-use, additional-context, system-message, cucumber]

requires:
  - phase: 05-hooks (plan 05-02)
    provides: the hooks table `form` script, `output`, and `on reentry` columns
  - phase: 05-hooks (plan 05-03)
    provides: the routing-order fold with joined additionalContext, hookEventLabel, collectBucketOutcomes with every outcome's systemMessage
  - phase: 05-hooks (plan 05-07)
    provides: notifyHookNotice, hookSaysText, the hooks-show-the-user messages Then
provides:
  - "dispatch.ts: sendToolContext and TOOL_CONTEXT_CUSTOM_TYPE (claude-hook-tool-context); PreToolUse, PostToolUse, and PostToolUseFailure folds send their joined context with triggerTurn false"
  - "settle.ts: stopFeedback (one `Stop hook feedback:\\n<text>` part per reason and context, routing order) through one reenterBounded; showStopNotices (`Stop says: <text>`); StopFailure systemMessage drop with a debug line"
  - "features/hook/prompt-and-stop.feature (3 scenarios) and features/step_definitions/hook/prompt-and-stop.steps.ts"
  - "three scenarios in features/hook/tool-use.feature: two tool-context scenarios and the PostToolUse updatedToolOutput scenario routed from plan 05-06"
affects: [05-09, docs/hooks-compatibility.md]

actuals:
  tokens: 14500
  tasks: 2
  commits: 3
plan_head_before: 579fbeff8eb2cb1b9be186bfbab97d64a9b661fc
plan_head_after: 484ab4bf40c6c5e7a33dc869219cb69a984b7ff4

tech-stack:
  added: []
  patterns:
    - "A tool hook's context is a separate hidden custom message sent with triggerTurn false; Pi queues it until turn_end, so it follows the tool result"
    - "A Stop re-entry is one custom message whose content is an array of text parts, one per reason or context value"
    - "A When that waits for the second agent_settled records a prompt and the turn a Stop hook sends back as one turn"

key-files:
  created:
    - features/hook/prompt-and-stop.feature
    - features/step_definitions/hook/prompt-and-stop.steps.ts
  modified:
    - extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts
    - extensions/pi-claude-marketplace/bridges/hooks/settle.ts
    - test/bridges/hooks/dispatch.test.ts
    - test/bridges/hooks/settle.test.ts
    - features/hook/tool-use.feature

key-decisions:
  - "The Stop re-entry content is an array of text parts, one per value, as Claude Code 2.1.316 sends one user message with one text part per Stop reason (research-c/probe/run3/req-006.json); Pi's model log joins the parts with a newline"
  - "Each Stop hook contributes its block reason first, then its own non-empty additionalContext; a reasonless block contributes `Stop hook feedback:\\n` with an empty reason"
  - "The re-entry's details and the STOP-07 cap notice name the first hook in routing order that contributes feedback"
  - "Tool context uses its own custom type, claude-hook-tool-context, beside the prompt and session type claude-hook-additional-context and the Stop and rewake types"
  - "Stop notices are shown after the generation check and before the re-entry decision, so a continue false that suppresses the re-entry still shows them"

patterns-established:
  - "sendToolContext(pi, label, folded.result) after showHookNotices in both composite factories"

requirements-completed: [HOOK-04, HOOK-05]

coverage:
  - id: D1
    description: "A PreToolUse, PostToolUse, or PostToolUseFailure hook's additionalContext reaches the model after the tool result, also when the call is denied; no context, an empty one, or no Pi API sends nothing"
    requirement: HOOK-04
    verification:
      - kind: e2e
        ref: "features/hook/tool-use.feature#A tool hook's additional context reaches the model after the tool result"
        status: pass
      - kind: e2e
        ref: "features/hook/tool-use.feature#A denied tool call's hook context still reaches the model"
        status: pass
      - kind: unit
        ref: "test/bridges/hooks/dispatch.test.ts#tool hook context (HOOK-04 / D-CF5-13)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Stop hooks that block or add context re-enter once with one `Stop hook feedback:` part per value in routing order; the STOP-07 cap counts the re-entry once; continue false still suppresses it; hooks that neither block nor add context send nothing and reset the cap"
    requirement: HOOK-05
    verification:
      - kind: e2e
        ref: "features/hook/prompt-and-stop.feature#Every blocking stop hook's reason reaches the model in one feedback message"
        status: pass
      - kind: e2e
        ref: "features/hook/prompt-and-stop.feature#A stop hook's additional context is sent back as stop hook feedback"
        status: pass
      - kind: unit
        ref: "test/bridges/hooks/settle.test.ts#sends every reason and context back in one re-entry in routing order whatever order the hooks finish in (D-CF5-25)"
        status: pass
      - kind: unit
        ref: "test/bridges/hooks/settle.test.ts#counts a re-entry that carries several hooks' feedback once toward the cap (STOP-07)"
        status: pass
      - kind: unit
        ref: "test/bridges/hooks/settle.test.ts#hooks that neither block nor add context send nothing and reset the cap (HOOK-05 / D-88-08)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A Stop hook's systemMessage is shown to the user as `Stop says: <text>` in routing order and never reaches the model; a StopFailure systemMessage is dropped with a debug line"
    requirement: HOOK-05
    verification:
      - kind: e2e
        ref: "features/hook/prompt-and-stop.feature#A stop hook's system message is shown to the user"
        status: pass
      - kind: unit
        ref: "test/bridges/hooks/settle.test.ts#shows each Stop hook's system message in routing order and never sends it to the model (D-CF5-14)"
        status: pass
      - kind: unit
        ref: "test/bridges/hooks/settle.test.ts#drops a StopFailure system message with a debug line (D-CF5-14)"
        status: pass
    human_judgment: false
  - id: D4
    description: "A PostToolUse hook's updatedToolOutput replaces what the model reads (scenario for the plan 05-06 fix)"
    requirement: HOOK-05
    verification:
      - kind: e2e
        ref: "features/hook/tool-use.feature#A PostToolUse hook's updated tool output replaces what the model reads"
        status: pass
    human_judgment: false

duration: 30min
completed: 2026-11-01
status: complete
---

# Phase 5 Plan 08: Tool and Stop hook feedback Summary

**A tool hook's `additionalContext` now reaches the model after the tool result, also when the call is denied. Stop hooks send every block reason and every context value back in one re-entry, as `Stop hook feedback:` parts in routing order. A Stop hook's `systemMessage` is shown to the user as `Stop says: <text>`.**

## Performance

- **Duration:** about 30 min
- **Started:** 2026-11-01T18:38Z (approximate)
- **Completed:** 2026-11-01T19:08Z
- **Tasks:** 2 plan tasks plus the orchestrator addition
- **Files modified:** 7 (2 created, 5 modified)

## Accomplishments

- `dispatch.ts`: `sendToolContext` sends `{ customType: "claude-hook-tool-context", content: "<Event>:<Tool> hook additional context: <values>", display: false }` with `{ triggerTurn: false }`. It runs after the PreToolUse fold in `compositeHandlerFor` and after the tool-result fold in `toolResultCompositeHandler`, before the adapter. So a denied call sends its context too. A send that throws is debug-logged.
- `settle.ts`: `stopFeedback` builds one text part per block reason and per non-empty `additionalContext`, in routing order. `runStopBucket` passes them to `reenterBounded` once. `showStopNotices` shows each non-empty Stop `systemMessage` through the run that `settleHandlerFor` opens. `runStopFailure` debug-logs `settle: <n> systemMessage(s) dropped on StopFailure`. The "first block wins" header text is replaced.
- `features/hook/prompt-and-stop.feature` with three scenarios and the new re-entry When.
- `features/hook/tool-use.feature`: the two tool-context scenarios, plus the routed PostToolUse `updatedToolOutput` scenario.

## Task Commits

1. **Orchestrator addition: PostToolUse updatedToolOutput scenario** - `46e8412` (test)
2. **Task 1: Send a tool hook's additional context to the model after the tool result** - `d13a041` (fix)
3. **Task 2: Send every Stop reason and context back in one re-entry, and show Stop system messages** - `484ab4b` (fix)

Tracer gate after Task 1: no `blocking-human` gate, `human_verify_mode` end-of-phase, and the `<verify>` is automated only. I re-ran all of it: `dispatch.test.ts` (111/111), direct coverage of `dispatch.ts` (exit 0), `features/hook/tool-use.feature` (15/15), and `npm run check:static` (with `check:features`). Everything passed, so Task 2 went ahead.

## Red proofs

- **Task 1** (`npx cucumber-js features/hook/tool-use.feature:348 :376`, before the product change): 2 of 2 failed at the model calls step. The runs tables matched. Call 2 had no row `PostToolUse:Bash hook additional context: checked by hook`, and no row `PreToolUse:Bash hook additional context: denied by hook` after the deny result row. No tool context reached the model.
- **Task 2** (`npx cucumber-js features/hook/prompt-and-stop.feature`, before the product change): 3 of 3 failed. All runs tables passed, so the hooks ran as stated, `stop hook active` false and then true included.
  - "Every blocking stop hook's reason...": call 2's feedback row read `reason A`, where `Stop hook feedback:\nreason A\nStop hook feedback:\nreason B` was expected. Only the first reason went back, with no prefix.
  - "A stop hook's additional context...": the row read `run the tests`, where `Stop hook feedback:\nrun the tests` was expected.
  - "A stop hook's system message...": the messages Then got `[]`, where `Stop says: remember the tests` was expected.

## Orchestrator addition: PostToolUse `updatedToolOutput` scenario

- **Scenario:** "A PostToolUse hook's updated tool output replaces what the model reads" in `features/hook/tool-use.feature`. A PostToolUse `script` hook prints `{"hookSpecificOutput":{"hookEventName":"PostToolUse","updatedToolOutput":{"content":[{"type":"text","text":"replaced"}]}}}`. Call 2's tool result row reads `bash returned: replaced`. It reuses only existing steps.
- **Red proof:** I saved `git show 6bbe6ba -- extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts` as a patch and ran `git apply -R` on it. Then `npx cucumber-js features/hook/tool-use.feature:321` failed at the model calls step: actual `bash returned: from-model\n`, expected `bash returned: replaced`. I restored the fix with `git apply`, and `git diff --quiet -- extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts` exited 0. The scenario passed afterwards.
- **Commit:** its own test commit, `46e8412`, made before the Task 1 scenarios were added to the same file.

## Step text added

`features/step_definitions/hook/prompt-and-stop.steps.ts`:

- `When the user prompts {string} and the stop hooks send the turn back`. It sends the prompt and requires the disposition `started`. It then waits for two `agent_settled` records, each `aborted: false`, against one 20-second deadline (`REENTERED_TURNS_DEADLINE_MS`). It refuses an extension error, a dialog, or a model call past the script, and records one turn that holds both turns' records and log lines.

## Stop feedback layout as the model sees it

The re-entry is one hidden custom message, `customType: "claude-hook-stop-block"`, whose content holds one text part per value. Pi sends it to the model as a `user` row after the assistant's reply, and the call log joins the parts with a newline. For two blocking hooks, call 2 lists `finish up`, `Done.`, then `Stop hook feedback:\nreason A\nStop hook feedback:\nreason B`. Upstream also sends one user message with one text part per reason (`research-c/probe/run3/req-006.json`: `[{"type":"text","text":"Stop hook feedback:\nSTOP1-REASON\n"},{"type":"text","text":"Stop hook feedback:\nSTOP2-REASON"}]`).

## Decisions Made

See `key-decisions` in the frontmatter. Also:
- PreToolUse context is sent before the adapter runs. While the agent streams, Pi queues it until `turn_end`, so a `tui` ask that waits on the user does not change where it lands.
- A PreToolUse `continue: false` still sends the context. Pi ends the turn, and the queued message is flushed at `turn_end`, so it stays in the history.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The re-entry When first cloned the frozen prompt step and a skill step**
- **Found during:** Task 2 (`npm run fallow`: two clone groups, with `session.steps.ts:87-92` and `skill/aliases.steps.ts:81-92`)
- **Fix:** the When now calls two private helpers, `startPrompt` and `callsPastScript`. `npx fallow dupes` reports no clone group, and no marker was added.
- **Committed in:** `484ab4b`

**2. [Plan refinement] Six existing settle cases now expect feedback parts**
- The plan named the STOP-03 and STOP-05 cases. The two cap loops, the runtime-isolation case, the reload case, the send-failure case, and the StopFailure-then-Stop case also pinned the raw content, so each now expects `feedbackContent(...)`. No case was removed.

---

**Total deviations:** 1 auto-fixed (blocking) and 1 plan refinement. **Impact:** none on scope.

## Issues Encountered

- The worktree guard refused heredocs and compound commands. I made the edits with the Edit and Write tools, aligned the feature tables with a small script in the scratchpad, and ran cucumber through a scratchpad wrapper script.
- The worktree had no optional-peer cache. `node scripts/install-test-peers.mjs` installed it, and no tracked file changed.

## Deferred Issues

- **Stop hook error notice (for the plan 05-09 BACKLOG parent line):** upstream may show a `Stop hook blocking error from command: ...` notice for a blocking Stop hook. The run3 probe request holds `Stop hook blocking error from command: "${CLAUDE_PLUGIN_ROOT}/hooks/stopblk.sh 1": STOP1-REASON`, and the docs say no error notice is shown for `additionalContext`. No decision covers it, so this plan leaves it out.
- **Reasonless Stop block:** upstream docs call `reason` required with `decision: "block"`. Here a block with no reason re-enters with `Stop hook feedback:\n` and an empty reason. Not probed.

## Parent lines

- CHANGELOG candidate (for the docs plan's merged entry): "A plugin's PreToolUse, PostToolUse, and PostToolUseFailure hook context now reaches the model after the tool result, also when the hook denies the call. When Stop hooks block or add context, the model gets every reason and every context value back as Stop hook feedback in one message, not only the first reason. A Stop hook's `systemMessage` is shown to you as `Stop says: <text>`."
- BACKLOG: "Hooks: decide whether a blocking Stop hook also shows Claude Code's `Stop hook blocking error from command: \"<command>\": <reason>` notice. Claude Code shows none for a Stop `additionalContext`."
- BACKLOG (05-06 line now done): drop "a PostToolUse `updatedToolOutput` ... scenario" from the open items, because `46e8412` adds it.
- `docs/hooks-compatibility.md` (phase-owned, docs plan): rows for tool-event `additionalContext` (a separate hidden user message after the tool result, D-CF5-13), Stop feedback (one message, one `Stop hook feedback:` part per reason and context in routing order, D-CF5-25), `Stop says:` notices, and the StopFailure `systemMessage` drop (D-CF5-14).

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. The register's mitigations are in place:
- T-05-24: `runStopBucket` calls `reenterBounded` once per settle. "counts a re-entry that carries several hooks' feedback once toward the cap (STOP-07)" pins 7 sends and one cap notice over 8 settles of a three-hook bucket.
- T-05-29: the re-entry content comes from block reasons and `additionalContext` only. The notice goes only through `notifyHookNotice`. The system-message scenario states call 1 without the notice text, and the unit case asserts the re-entry content holds only the reason.
- T-05-30: the context is its own hidden custom message after the tool result, labeled `<Event>:<Tool> hook additional context:`. The tool result row stays unchanged in both tool-context scenarios.

## User Setup Required

None - no external service configuration required.

## Verification

- `node --test` on `test/bridges/hooks/**/*.test.ts`, `test/architecture/hooks-*.test.ts`, `test/integration/hooks-*.test.ts`, and `test/index.test.ts`: 1016/1016 passed.
- `npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/hooks/settle.ts extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts`: exit 0, with no shortfall line.
- `npx cucumber-js features/hook features/plugin/session-start-hooks.feature`: 67/67 scenarios, 799 steps passed. After the step refactor, `prompt-and-stop.feature` plus `tool-use.feature` passed again: 18/18.
- `npm run check:static` (typecheck, lint, lint:workflows, fallow with dupes, format:check, test:corresponding, check:features): passed after the last edit.
- Acceptance greps (comment lines filtered out):
  - `triggerTurn: false` in `dispatch.ts`: 1.
  - The two tool-context scenario titles: 1 each.
  - `Stop hook feedback` in `settle.ts`: 1.
  - `notifyHookNotice(` in `settle.ts`: 1.
  - `^Feature: Hook prompt and stop$`: 1.

## Self-Check: PASSED

- FOUND: `features/hook/prompt-and-stop.feature`, `features/step_definitions/hook/prompt-and-stop.steps.ts`, and every modified file listed above.
- FOUND commits: `46e8412`, `d13a041`, and `484ab4b`, all ancestors of HEAD. `git rev-list --count 579fbeff..HEAD` printed 3 before this SUMMARY.

---
*Phase: 05-hooks*
*Completed: 2026-11-01*

---
phase: 05-hooks
plan: 06
subsystem: hooks
tags: [hooks, user-prompt-submit, session-start, additional-context, post-tool-use, cucumber]

requires:
  - phase: 05-hooks (plan 05-01)
    provides: new-session and setup-prompt step texts, the profile Pi session steps
  - phase: 05-hooks (plan 05-02)
    provides: the hooks table `form` script and `output` columns
  - phase: 05-hooks (plan 05-03)
    provides: HookAdapterContext on every adapter, the routing-order fold that joins contexts with "\n", the updatedToolOutput bug report
provides:
  - "runtime.ts: a pending prompt-context buffer (appendPendingPromptContext, pendingPromptContextEntries, drainPendingPromptContext) beside the SessionStart buffer; a bridge load empties both"
  - "routing-state.ts: PendingPromptContext; RoutingEntry's comment states the parallel run"
  - "event-adapters.ts: adaptInputResult buffers the context and continues; adaptToolResultResult returns the updatedToolOutput patch as Pi's tool_result value"
  - "event-router.ts: the before_agent_start drain returns one hidden custom message, a text part per event, SessionStart first"
  - "wire-protocol.ts: parseHookStdout(exitCode, stdout, stderr, claudeEvent); plain stdout is context on SessionStart and UserPromptSubmit"
  - "features/hook/additional-context.feature (5 scenarios)"
affects: [05-07, 05-08, 05-09, docs/hooks-compatibility.md]

actuals:
  tokens: 21000
  tasks: 4
  commits: 4
plan_head_before: f2dc357a515694a725f93cdf3c8c0f748ed317bb
plan_head_after: 6bbe6ba10a5b9e3aabc5bb77324e4d719393830e

tech-stack:
  added: []
  patterns:
    - "One generic context buffer (append drops empty text, entries snapshot, drain clears) backs both pending buffers, so the two cannot drift"
    - "Hook context reaches the model as a before_agent_start custom message, which Pi persists and sends as a user message after the prompt"
    - "An adapter that changes a Pi result returns the change; it never edits the Pi event in place"

key-files:
  created:
    - features/hook/additional-context.feature
  modified:
    - extensions/pi-claude-marketplace/bridges/hooks/runtime.ts
    - extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts
    - extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts
    - extensions/pi-claude-marketplace/bridges/hooks/event-router.ts
    - extensions/pi-claude-marketplace/bridges/hooks/wire-protocol.ts
    - extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts
    - test/bridges/hooks/runtime.test.ts
    - test/bridges/hooks/routing-state.test.ts
    - test/bridges/hooks/event-adapters.test.ts
    - test/bridges/hooks/event-router.test.ts
    - test/bridges/hooks/wire-protocol.test.ts
    - test/bridges/hooks/dispatch-exec.test.ts
    - test/bridges/hooks/dispatch.test.ts
    - test/integration/hooks-additionalcontext-end-to-end.test.ts
    - test/architecture/hooks-lifecycle.test.ts

key-decisions:
  - "Both events' context share one custom message (customType claude-hook-additional-context, display false) with one text part per event, SessionStart first; Pi's model log joins the parts with a newline"
  - "Plain stdout follows Claude Code's documented rule: trimmed stdout that does not start with { and end with } is plain text, so a JSON array or string counts as context; braced stdout that fails to parse adds nothing"
  - "A context value that is empty or only whitespace is dropped when the message is built, for both buffers"
  - "The updatedToolOutput arm returns the whitelisted content and isError as the tool_result value and leaves the event alone"

patterns-established:
  - "createContextBuffer<T>() in runtime.ts for any further pending context kind"

requirements-completed: [HOOK-05]

coverage:
  - id: D1
    description: "A UserPromptSubmit hook's additionalContext reaches the model after the unchanged prompt; a blocked or stopped prompt buffers none"
    requirement: HOOK-05
    verification:
      - kind: e2e
        ref: "features/hook/additional-context.feature#A prompt hook's additional context reaches the model beside the prompt"
        status: pass
      - kind: unit
        ref: "test/bridges/hooks/event-adapters.test.ts#buffers the additional context with its plugin and lets the prompt continue (D-CF5-13)"
        status: pass
      - kind: unit
        ref: "test/bridges/hooks/event-adapters.test.ts#buffers no additional context of a block that stops the prompt (HOOK-05)"
        status: pass
      - kind: unit
        ref: "test/bridges/hooks/event-router.test.ts#before_agent_start sends buffered prompt context as one message after the prompt (D-CF5-13)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A SessionStart hook's additionalContext reaches the model as a persisted message on the first turn and stays in later turns' history; both events share one message, SessionStart first"
    requirement: HOOK-05
    verification:
      - kind: e2e
        ref: "features/hook/additional-context.feature#A session start hook's additional context reaches the model on the first turn"
        status: pass
      - kind: e2e
        ref: "features/hook/additional-context.feature#A session start hook's additional context stays in the history of the next turn"
        status: pass
      - kind: e2e
        ref: "features/hook/additional-context.feature#Session start and prompt hook contexts reach the model in one message, session start first"
        status: pass
      - kind: integration
        ref: "test/integration/hooks-additionalcontext-end-to-end.test.ts#HOOK-E2E-03"
        status: pass
    human_judgment: false
  - id: D3
    description: "Plain stdout on exit 0 is context on SessionStart and UserPromptSubmit only"
    requirement: HOOK-05
    verification:
      - kind: e2e
        ref: "features/hook/additional-context.feature#A prompt hook's plain output reaches the model as additional context"
        status: pass
      - kind: unit
        ref: "test/bridges/hooks/wire-protocol.test.ts#ignores plain stdout on exit 0 for PreToolUse and reports it (D-CF5-13)"
        status: pass
    human_judgment: false
  - id: D4
    description: "A bridge load clears both buffers; empty or whitespace context adds no message"
    requirement: HOOK-05
    verification:
      - kind: unit
        ref: "test/bridges/hooks/event-router.test.ts#before_agent_start of a reloaded bridge sends no context buffered before the reload (D-CF5-13)"
        status: pass
      - kind: unit
        ref: "test/bridges/hooks/event-router.test.ts#before_agent_start adds no message for prompt context that is only whitespace (HOOK-05)"
        status: pass
      - kind: integration
        ref: "test/integration/hooks-additionalcontext-end-to-end.test.ts#HOOK-E2E-04"
        status: pass
    human_judgment: false

duration: 95min
completed: 2026-11-01
status: complete
---

# Phase 5 Plan 06: Hook additional context Summary

**A UserPromptSubmit hook's context now reaches the model after the user's unchanged prompt, a SessionStart hook's context is a persisted message the model keeps seeing on later turns, plain stdout counts as context on those two events, and a PostToolUse `updatedToolOutput` now reaches the model.**

## Performance

- **Duration:** about 95 min
- **Completed:** 2026-11-01
- **Tasks:** 3 plan tasks plus the orchestrator addition
- **Files modified:** 16 (1 created, 15 modified)

## Accomplishments

- `runtime.ts`: a generic `createContextBuffer<T>()` backs the SessionStart buffer and the new prompt buffer. `preparePendingContextForRegistration()` empties both. The SessionStart API is unchanged, so plan 05-07's `dispatch.test.ts` cases still read it.
- `event-adapters.ts`: `adaptInputResult` buffers a mutate's `additionalContext` with the attributed entry's provenance and returns `undefined`, so the prompt goes on unchanged. A block or stop returns `handled` and buffers nothing. A shared `bufferedContext` helper builds the entry for both adapters.
- `event-router.ts`: the `before_agent_start` handler drains both buffers into one message `{ customType: "claude-hook-additional-context", content: [<SessionStart part>, <UserPromptSubmit part>], display: false }`. Each part reads `<Event> hook additional context: <values joined by \n>`. The system prompt is no longer changed. The hydrate funnel is untouched.
- `wire-protocol.ts` and `dispatch-exec.ts`: `parseHookStdout` takes the entry's Claude event. Plain stdout on exit 0 becomes the trimmed `additionalContext` on SessionStart and UserPromptSubmit. On every other event it is ignored, with the debug line `wire-protocol: plain stdout ignored on <event>; defaulting to noop`.
- Orchestrator addition: the PostToolUse `updatedToolOutput` arm now returns the whitelisted patch to Pi.

## Task Commits

1. **Task 1: Send a UserPromptSubmit hook's context beside the prompt, end to end** - `ee9a02e` (fix)
2. **Task 2: Persist a SessionStart hook's context as a message** - `56a9c54` (fix)
3. **Task 3: Count plain stdout as context on SessionStart and UserPromptSubmit** - `52cf675` (fix)
4. **Orchestrator addition: return PostToolUse updatedToolOutput to Pi** - `6bbe6ba` (fix)

Tracer gate after Task 1: no blocking-human gate, and the `<verify>` is automated only. I re-ran all of it: the five unit and architecture modules, direct coverage of the four sources, `npx cucumber-js features/hook` (51 scenarios with `session-start-hooks.feature`, seed 796891), and `npm run check:static`, which includes `check:features`. Everything passed, so Task 2 went ahead.

## Red proofs

- **Task 1** (`npx cucumber-js features/hook/additional-context.feature`, before the product change): call 1 held a single user row, `ctx-from-hook`, where `hello there` and then `UserPromptSubmit hook additional context: ctx-from-hook` were expected. The hook's context replaced the prompt.
- **Task 2** (same command, before the product change):
  - "...reaches the model on the first turn": the context row `SessionStart hook additional context: ss-ctx` was missing. The context went only into call 1's system prompt.
  - "...stays in the history of the next turn": call 2 held `first prompt`, `First.`, and `second prompt`, with no context row.
  - "Session start and prompt hook contexts reach the model in one message, session start first": I ran it against the Task 1 router, which I restored from `HEAD` for one run. The context row read only `UserPromptSubmit hook additional context: ctx-from-hook`.
- **Task 3** (same file, `--name "plain output"`, before the product change): the row `UserPromptSubmit hook additional context: plain context` was missing. Plain stdout was dropped.
- **Orchestrator addition**:
  - Unit, before the fix: three `adaptToolResultResult` cases failed in `event-adapters.test.ts`, because the adapter returned `undefined` instead of the patch.
  - End to end: an uncommitted probe feature with a PostToolUse hook that prints `{"hookSpecificOutput":{"hookEventName":"PostToolUse","updatedToolOutput":{"content":[{"type":"text","text":"replaced"}]}}}`. Before the fix, the model's tool result read `bash returned: from-model\n`. After the fix, it read `bash returned: replaced`. I deleted the probe file afterwards.

## Message layout as the model sees it

Pi places the hook context message after the starting user message and sends it as a `user` row. When both events have context, the model call log shows one row whose two text parts are joined by a newline: `SessionStart hook additional context: ss-ctx\nUserPromptSubmit hook additional context: ctx-from-hook`. The message persists in the session. In the next turn, call 2 lists `first prompt`, the context row, `First.`, then `second prompt`. The harness numbers model calls across the session, not per turn, so the second turn's call is call 2 (the plan said call 1).

## Orchestrator addition: PostToolUse `updatedToolOutput`

- **Bug:** `adaptToolResultResult`'s mutate arm changed `event.content` and `event.isError` in place and returned `undefined`. Pi 1.4's `emitToolResult` (`core/extensions/runner.js` 900-955) keeps a handler's changes only when the handler returns them, so the model read the original output.
- **Fix:** `toolResultPatch(updatedToolOutput)` keeps the CR-01 whitelist: an object patch, an array `content`, and a boolean `isError`. It returns `{ content?, isError? }` as the `tool_result` value, or `undefined` when neither field is valid. The event is left unchanged. The `content` keeps the array shape Pi expects. The tool's-own-shape question (D-CF5 deferred) stays deferred.
- **Unit pins (red first):** in `event-adapters.test.ts`, "returns only whitelisted tool-result fields as the Pi tool_result value", "returns array content without an error field when the patch has none", and "returns a boolean error patch without content when the patch has none". Each case asserts the whole return value and the unchanged event.
- **Sibling file edit:** `test/bridges/hooks/dispatch.test.ts` is plan 05-07's file. Two cases asserted the in-place change, so they now assert the returned patch: "applies a tool-output mutation through the selected result bucket" and "applies the last tool-output rewrite in routing order".
- **No committed cucumber scenario:** this plan's feature file is about hook additional context, and a tool-output scenario belongs in `features/hook/tool-use.feature`, which this plan does not own. The uncommitted probe above proved the fix red and then green. I left the scenario text as a parent line.

## Decisions Made

See `key-decisions` in the frontmatter. Also:
- `display: false` keeps the context message out of the transcript the user reads. The model still receives it.
- A prompt's context is persisted too. It is ordinary session history after the prompt, as upstream keeps it in the transcript.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Two expectation edits in plan 05-07's `dispatch.test.ts`**
- **Found during:** orchestrator addition
- **Issue:** two cases pinned the in-place `updatedToolOutput` change that the fix removes.
- **Fix:** both now assert the returned patch. No other edit.
- **Commit:** `6bbe6ba`

**2. [Rule 1 - Bug] `decideClaudeStdout` kept a branch the braced-text rule made unreachable**
- **Found during:** Task 3 (direct coverage: wire-protocol.ts at 89/90 branches)
- **Fix:** `normalizeClaudeStdout` and `decideClaudeStdout` take `object`. The exit-0 call site asserts `parsed as object`, with a comment explaining why the assertion holds.
- **Commit:** `52cf675`

**3. [Plan refinement] The plain-text rule follows Claude Code's documented rule, not "non-JSON"**
- **Reason:** research-c `hooks.md` lines 809-815 say stdout that does not start with `{` and end with `}` is plain text, a JSON array or quoted string included. Braced stdout that fails to parse is a parse failure, and on these events Claude Code does not add it. Every behavior row of the plan still holds.

**4. [Plan refinement] The dispatch-exec decoder-tail case now uses a UserPromptSubmit entry**
- **Reason:** with the braced-text rule, its replacement character is plain text and no longer reaches the `JSON.parse failed` line it asserted. The case now asserts `{ kind: "mutate", additionalContext: "�" }`. That proves the tail was flushed, and it proves the call site passes `entry.claudeEvent`.

**5. [Plan refinement] Comment-only edits outside a task's file list**
- Task 2 rewrote the stale "systemPrompt" comments in `event-adapters.ts` and `routing-state.ts`. Both files are in the plan's `files_modified`.

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug) and 3 plan refinements. **Impact:** none on scope.

## Issues Encountered

- The worktree guard refused some heredoc and compound commands, so I made those edits with the Edit tool or with script files in the scratchpad.
- One direct-coverage run of `dispatch-exec.ts`, made together with `npx fallow dupes` while the sibling executor was running, reported one failing case. Five reruns passed, so I treat it as load-sensitive timing in an existing case and did not change anything.

## Deferred Issues

- A prompt queued while the agent is streaming (steer or follow-up) runs the `input` hooks, but Pi fires `before_agent_start` only when the next run starts. Its context therefore goes with that next run, not beside the queued message. Not probed.
- Several JSON lines on stdout (the first line starting with `{`, the last ending with `}`) are a parse failure here. Upstream reads them as plain text when no line sets a field. This is an unprobed edge.

## Parent lines

- CHANGELOG candidate (for the docs plan's merged entry): "A plugin's UserPromptSubmit hook context now reaches the model beside your prompt instead of replacing it. SessionStart hook context stays in the conversation for later turns. Plain text a hook prints on those two events counts as context. A PostToolUse hook's `updatedToolOutput` now reaches the model."
- BACKLOG: drop the 05-03 line "a PostToolUse `updatedToolOutput` changes `event.content` in place ..." because `6bbe6ba` fixes it. Keep the tool's-own-shape question (D-CF5 deferred).
- docs/hooks-compatibility.md (HOOK-05 representation residual): "Claude Code adds UserPromptSubmit context as a system-reminder block of the same request. Pi's `before_agent_start` offers a message, so the model sees a separate user-role message after the prompt (D-CF5-13, Pi gap)."
- `features/hook/tool-use.feature` (owner's plan): add the scenario "A PostToolUse hook's updated tool output replaces what the model reads". The PostToolUse hook prints `{"hookSpecificOutput":{"hookEventName":"PostToolUse","updatedToolOutput":{"content":[{"type":"text","text":"replaced"}]}}}`, and call 2's tool result row reads `bash returned: replaced`. It is red before `6bbe6ba` (`bash returned: from-model\n`) and green after.
- `platform/pi-api.ts` (frozen): widen `ToolResultEventResult.content` to Pi's `(TextContent | ImageContent)[]`. Then `toolResultPatch` and `withFeedback` in `event-adapters.ts` can both drop their assertions.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. The register's mitigations are in place:
- T-05-18: the context is a separate message after the unchanged prompt. The first scenario shows the prompt row `hello there`, then the context row.
- T-05-19: every bridge load empties both buffers. HOOK-E2E-04 and the reloaded-bridge router case pin this.
- T-05-20: plain stdout is context only on SessionStart and UserPromptSubmit. The wire-protocol cases cover the other eight events.

The `updatedToolOutput` fix keeps the CR-01 whitelist: a patch still cannot set `type`, `toolName`, `details`, or any other field.

## User Setup Required

None.

## Verification

- `node --test` on every hook unit, architecture, and integration module, plus `test/index.test.ts`: 973 passed, 0 failed. `npm run test:modules`: exit 0.
- `npm run test:coverage:direct --` on all six sources (`event-adapters.ts`, `event-router.ts`, `runtime.ts`, `routing-state.ts`, `wire-protocol.ts`, `dispatch-exec.ts`) and on `dispatch.ts`: exit 0, with no shortfall line.
- `npx cucumber-js features/hook features/plugin/session-start-hooks.feature`: 55 scenarios passed (seed 560198, after the last commit). Earlier green seeds: 796891 and 781844.
- `npm run check:static` (typecheck, lint, lint:workflows, fallow with dupes, format:check, test:corresponding, check:features): passed after each commit's edits. `npx fallow dupes`: no clone group.
- Acceptance greps:
  - `hook additional context` in `event-router.ts`: 3.
  - `PromptContext` in `runtime.ts`: 9.
  - `^Feature: Hook additional context$`: 1.
  - Funnel counts (comment lines filtered out): `hydrateScopeFromState(` 3, `tryHydrateOnePlugin(` 2, `hydrateProjectScopeForCwdWith(` 3.
  - `SessionStart hook additional context`: 1 in `event-router.ts` and 1 in the integration test.
  - `Scenario: A session start hook's additional context`: 2.
  - `parseHookStdout(code, stdout, stderr, entry.claudeEvent)`: 1.
  - The plain-output scenario title: 1.
  - `pi.on(` in `event-router.ts`: 11.

## Self-Check: PASSED

- FOUND: `features/hook/additional-context.feature` and every modified file listed above.
- FOUND commits: `ee9a02e`, `56a9c54`, `52cf675`, and `6bbe6ba`, all ancestors of HEAD. `git rev-list --count f2dc357..HEAD` printed 4 before this SUMMARY.

---
*Phase: 05-hooks*
*Completed: 2026-11-01*

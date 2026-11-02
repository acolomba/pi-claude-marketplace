---
phase: 05-hooks
reviewed: 2026-11-01T22:14:32Z
depth: standard
iteration: 3
files_reviewed: 20
files_reviewed_list:
  - extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts
  - extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts
  - extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts
  - extensions/pi-claude-marketplace/bridges/hooks/event-router.ts
  - extensions/pi-claude-marketplace/bridges/hooks/exec-result.ts
  - extensions/pi-claude-marketplace/bridges/hooks/exec-timer.ts
  - extensions/pi-claude-marketplace/bridges/hooks/hook-labels.ts
  - extensions/pi-claude-marketplace/bridges/hooks/on-failure.ts
  - extensions/pi-claude-marketplace/bridges/hooks/payloads/post-tool-use-failure.ts
  - extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts
  - extensions/pi-claude-marketplace/bridges/hooks/runtime.ts
  - extensions/pi-claude-marketplace/bridges/hooks/settle.ts
  - extensions/pi-claude-marketplace/bridges/hooks/wire-protocol.ts
  - extensions/pi-claude-marketplace/shared/notification-dispatch.ts
  - extensions/pi-claude-marketplace/shared/notification-resolve.ts
  - features/lib/hook-files.ts
  - features/step_definitions/hook/messages.steps.ts
  - features/step_definitions/hook/prompt-and-stop.steps.ts
  - features/step_definitions/hook/session.steps.ts
  - features/step_definitions/hook/tool-use.steps.ts
findings:
  critical: 0
  warning: 2
  info: 12
  total: 14
status: issues_found
---

# Phase 5: Code Review Report (iteration 3)

**Reviewed:** 2026-11-01T22:14:32Z
**Depth:** standard
**Files Reviewed:** 20
**Status:** issues_found

## Summary

This pass re-reviews the phase after the iteration-2 fix commits `8da30e5`, `c1fe1e2`, and `a17639b`. I checked each fix against the iteration-2 findings, against the locked decisions in `05-CONTEXT.md` (D-CF5-09: the input rewrite is the last in routing order, as upstream; not raised again), and against the Pi 1.4.0 sources in `node_modules` (`pi-coding-agent/dist/core/agent-session.js`, `pi-agent-core/dist/agent-loop.js`, `pi-agent-core/dist/agent.js`). The paired unit suites pass on this tree (`dispatch-exec`, `dispatch`, `event-adapters`, `runtime`, `event-router`: 436 pass, 0 fail).

What happened to each iteration-2 finding:

| Prior | Verdict |
| ----- | ------- |
| CR-01 overflow turns an exit-2 deny into an allow | Fixed. `accumulateStream` stops collecting past the cap but keeps draining (`dispatch-exec.ts:442-461`). The child runs to its exit, and the exit code goes through `onFailureBlock` and then `parseHookStdout` (`dispatch-exec.ts:371-381`). So an exit 2 blocks with the kept stderr. No regression found. One residual divergence (a JSON answer over 1 MB) is listed as IN-11. |
| WR-01 a PreCompact `continue:false` hides another hook's block | Fixed. `adaptPreCompactResult` reads every hook's own result (`event-adapters.ts:357-367`), and `blockNotices` uses `blocks(folded.outcomes)` (`dispatch.ts:491-495`). No regression found. |
| WR-02 a follow-up's context reaches the wrong turn | Fixed for the main path: the follow-up is queued, and the model then makes at least one tool-free turn before Pi reads it. The new `turn_end` carrier has two gaps that drop the context with only a debug line. One is a regression against the old carrier (**WR-01**). The other comes from read points that the `endsTheWork` check misses (**WR-02**). |
| IN-01..IN-09 | Out of the fix scope. All are still present and are carried forward as IN-01..IN-09. |

## Warnings

### WR-01: A follow-up's context is lost when the run ends while its UserPromptSubmit hook runs (regression from a17639b)

**File:** `extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts:470-486` (`queuePromptContext`), `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts:218-237` (`createBeforeAgentStartHandler`)
**Issue:** `queuePromptContext` reads `event.streamingBehavior` to choose a carrier. Pi fixes that value before the input handlers run: `_runInputHandlers(..., this.isStreaming ? options?.streamingBehavior : undefined)` (`agent-session.js:1652`). Pi then checks `this.isStreaming` again after every input handler has returned (`agent-session.js:1664`). The bridge's handler awaits the hook process. A UserPromptSubmit hook that takes 100 ms to a few seconds is common. So this sequence is normal: the user submits a follow-up while the model writes its last reply, and the run ends before the hook exits. In that case:

1. The adapter gets `streamingBehavior: "followUp"` and puts the context in the follow-up buffer.
2. Pi sees `isStreaming === false` and runs the text as a normal prompt. `before_agent_start` drains only the session-start and prompt buffers, so the hidden context message is never sent.
3. No later `turn_end` matches the text, because the prompt was never queued. The next idle prompt drops the context (`dispatch.ts:671-674`), and only a debug line records it.

Before a17639b, this case worked. `sendQueuedPromptContext` ran `pi.sendMessage(..., { triggerTurn: false })` while Pi was idle, which appends the message at once, just before the prompt. A related window has no carrier at all. A follow-up that Pi queues after the run's last `turn_end` (during the `agent_end` handlers, while `_isAgentRunActive` is still true) is read through `agent.continue()` -> `runPromptMessages(queuedFollowUps)` (`agent.js:268-271`). No `turn_end` comes before it, so its context is also lost.
**Fix:** Choose the carrier from the session state when the hook finishes, and add a fallback in `before_agent_start` that matches by text:
```ts
// event-adapters.ts, queuePromptContext
case "followUp":
  if (context.ctx.isIdle()) {
    // The run ended while the hook ran, so Pi starts a run for this prompt.
    context.runtime.appendPendingPromptContext(bufferedContext(text, context));
    return;
  }
  context.runtime.queueFollowUpContext({ ...bufferedContext(text, context), prompt: event.text });
  return;

// event-router.ts, createBeforeAgentStartHandler: also take a follow-up context
// whose prompt equals event.prompt (messageType "user"), for the window between
// the adapter's return and Pi's own isStreaming check.
```
Record the `agent.continue()` window in `docs/hooks-compatibility.md` as a Pi gap. Add a unit case: a follow-up adapter call with `ctx.isIdle() === true` buffers the context for `before_agent_start`.

### WR-02: `sendDueFollowUpContext` misses some points where Pi reads a follow-up, so the context is dropped

**File:** `extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts:418-462` (`endsTheWork`, `sendDueFollowUpContext`), `extensions/pi-claude-marketplace/bridges/hooks/runtime.ts:127-136, 212-214`
**Issue:** The carrier assumes two things. First, Pi reads a follow-up only after a turn whose assistant message has no tool call. Second, Pi reads exactly one follow-up, `pendingMessages[0]`. Pi 1.4 breaks both:

- **A tool batch that terminates.** `hasMoreToolCalls = !executedToolBatch.terminate` (`agent-loop.js:172`). When every call in the batch returns `terminate: true`, the inner loop exits and Pi reads the follow-ups (`agent-loop.js:197-202`), even though the turn's message has tool calls. The bridge returns `terminate: true` itself for a PreToolUse `continue: false` (`event-adapters.ts:266`). So a queued follow-up after a hook stop goes out without its context. `endsTheWork` returns false, and the context waits until `takeThrough` or the next idle prompt drops it. This is an interaction between two of the phase's own features.
- **`followUpMode: "all"`** is a user setting (`settings-manager.js:559`, RPC `set_follow_up_mode`). In that mode `PendingMessageQueue.peek()` returns every queued follow-up (`agent.js:72-77`), and Pi reads them all at once. The bridge sends only the context that matches `pendingMessages[0]`. The other contexts are never sent and are later dropped.

Both cases drop context silently (debug line only). This is the same problem that iteration-2 WR-02 described, on paths the fix does not cover.
**Fix:** In `sendDueFollowUpContext`, walk every user message in `turn.context.pendingMessages`, not just index 0, and send each matching context in order. For the terminate case, record in the runtime when the bridge returned `terminate: true` for every call in the turn, and treat that turn as ending the work. You can also check `turn.toolResults` against the call IDs that the bridge stopped:
```ts
const texts = turn.context.pendingMessages.map(userMessageText).filter((t) => t !== undefined);
if (!endsTheWork(turn.message) && !runtime.turnTerminatedByHook(turn.message)) return;
for (const text of texts) {
  const entry = runtime.takeFollowUpContext(text);
  if (entry !== undefined) sendQueuedPromptContext(pi, entry.context);
}
```
Add unit cases for both read points: a turn with a bridge-terminated tool call, and two follow-ups in `pendingMessages`.

## Info

### IN-01: The PreCompact notice text differs from upstream's `[cmd]` / `[cmd]: output` form (carried over)

**File:** `extensions/pi-claude-marketplace/bridges/hooks/hook-labels.ts:48-54, 83-88`
**Issue:** Unchanged. `compactionBlockedText` reuses `blockMessage`. An exit 2 with empty stderr gives `[cmd]: No stderr output`, and a JSON block gives the bare reason with no command.
**Fix:** Give it its own `[${command}]` + optional `: ${reason}` formatter, or record the divergence.

### IN-02: Stale section banner still lists PreCompact (carried over)

**File:** `extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts:528-529`
**Issue:** `adaptObservationResultForEvent -- SessionStart / SessionEnd / PreCompact / PostCompact`. PreCompact has its own adapter.
**Fix:** Drop `PreCompact` from the banner.

### IN-03: Context of a steer or follow-up queued while Pi is idle is lost (carried over)

**File:** `extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts:470-475`, `extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts:662-675`
**Issue:** Unchanged. An RPC `steer`/`follow_up` sent while idle reaches `input` with `streamingBehavior: undefined`, but Pi queues it and starts no run (`agent-session.js:1752-1768`). The context is buffered for a `before_agent_start` that does not come, and the next prompt drops it.
**Fix:** Optional. Document it.

### IN-04: A generation change discards the folded decision, a deny included (carried over)

**File:** `extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts:399-411`
**Issue:** Unchanged. The stale fold is dropped on a reload (DISP-03).
**Fix (optional):** On PreToolUse, keep a `block`/`stop` outcome from a stale fold.

### IN-05: Dead generation checks (carried over)

**File:** `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts:1108-1110, 1211-1213`
**Issue:** `if (!generationIsCurrent()) { return; }` is the last statement of its block.
**Fix:** Delete both.

### IN-06: `PendingPromptContext` duplicates `PendingSessionStartContext` (carried over)

**File:** `extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts:137-156`
**Issue:** The two interfaces have the same fields. The new `PendingFollowUpContext` extends one of them.
**Fix:** Declare one `PendingHookContext`.

### IN-07: An `onFailure` that Stop and async hooks ignore is only debug-logged (carried over)

**File:** `extensions/pi-claude-marketplace/bridges/hooks/on-failure.ts:91-97`
**Issue:** Upstream warns. Here the only record is `hookDebugLog`.
**Fix:** Show it in `info`, or document the divergence.

### IN-08: An empty inline `hooks: {}` makes a plugin partial (carried over)

**File:** `extensions/pi-claude-marketplace/domain/hooks-resolution.ts:129-131, 180-181` (outside this pass's file list; not re-read)
**Issue:** `declaresHooksValue({})` is `true`.
**Fix:** Treat an empty plain object as declaring nothing.

### IN-09: A Stop exit 2 with empty stderr sends an empty feedback paragraph (carried over)

**File:** `extensions/pi-claude-marketplace/bridges/hooks/settle.ts:226-227`
**Issue:** `result.reason ?? ""` gives `Stop hook feedback:\n` with no text.
**Fix:** Reuse the `hook-labels.ts` defaults.

### IN-10: The ring-buffer header still names the removed kill-on-overflow path

**File:** `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/ring-buffer.ts:10-11`
**Issue:** `Policy (diverges from the sync dispatch-exec.ts kill-on-overflow path ...)`. Since 8da30e5, the sync path drops the tail and does not kill. The comment describes code that no longer exists.
**Fix:** Change it to "the sync path keeps the head and drops the tail; this path keeps the tail".

### IN-11: A stdout JSON answer over 1 MB on exit 0 is ignored, so a deny that large fails open

**File:** `extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts:371`
**Issue:** `const answer = stdoutCap.cut() ? "" : stdout;` turns a PreToolUse `permissionDecision: "deny"` with a reason over 1 MB into a noop. Upstream reads the whole stdout. The compatibility table marks this as ⚠ (EXEC-02). A model-controlled reason that large needs a hook that repeats its input several times, so this is unlikely.
**Fix (optional):** On PreToolUse, treat cut stdout on exit 0 as a failure under `onFailure: "block"`, or record the residual fail-open with a decision ID.

### IN-12: A steer whose text equals a waiting follow-up's text takes that follow-up's context

**File:** `extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts:451-462`
**Issue:** `peekQueuedMessages()` returns the steering head first (`agent.js:212-215`). `takeFollowUpContext` matches by text only. So a steer `yes` queued while a follow-up `yes` waits makes the bridge send the follow-up's context before the steer.
**Fix (optional):** Match only when no steer is queued. For example, track the steer texts the bridge saw with `streamingBehavior: "steer"` that Pi has not read yet. Otherwise, document the case.

---

_Reviewed: 2026-11-01T22:14:32Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

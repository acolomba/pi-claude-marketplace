---
phase: 05-hooks
reviewed: 2026-11-01T21:27:21Z
depth: standard
iteration: 2
files_reviewed: 36
files_reviewed_list:
  - extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts
  - extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts
  - extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts
  - extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts
  - extensions/pi-claude-marketplace/bridges/hooks/event-router.ts
  - extensions/pi-claude-marketplace/bridges/hooks/exec-result.ts
  - extensions/pi-claude-marketplace/bridges/hooks/exec-timer.ts
  - extensions/pi-claude-marketplace/bridges/hooks/hook-env.ts
  - extensions/pi-claude-marketplace/bridges/hooks/hook-labels.ts
  - extensions/pi-claude-marketplace/bridges/hooks/if-field/index.ts
  - extensions/pi-claude-marketplace/bridges/hooks/on-failure.ts
  - extensions/pi-claude-marketplace/bridges/hooks/payloads/post-compact.ts
  - extensions/pi-claude-marketplace/bridges/hooks/payloads/post-tool-use-failure.ts
  - extensions/pi-claude-marketplace/bridges/hooks/payloads/session-end.ts
  - extensions/pi-claude-marketplace/bridges/hooks/payloads/session-start.ts
  - extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts
  - extensions/pi-claude-marketplace/bridges/hooks/runtime.ts
  - extensions/pi-claude-marketplace/bridges/hooks/settle.ts
  - extensions/pi-claude-marketplace/bridges/hooks/spawn-helpers.ts
  - extensions/pi-claude-marketplace/bridges/hooks/translation-context.ts
  - extensions/pi-claude-marketplace/bridges/hooks/wire-protocol.ts
  - extensions/pi-claude-marketplace/domain/components/hook-events.ts
  - extensions/pi-claude-marketplace/domain/components/hooks/schema.ts
  - extensions/pi-claude-marketplace/domain/hooks-resolution.ts
  - extensions/pi-claude-marketplace/shared/notification-dispatch.ts
  - extensions/pi-claude-marketplace/shared/notification-grammar.ts
  - extensions/pi-claude-marketplace/shared/notification-json.ts
  - extensions/pi-claude-marketplace/shared/notification-resolve.ts
  - extensions/pi-claude-marketplace/shared/notification-types.ts
  - extensions/pi-claude-marketplace/shared/notification-wire.ts
  - features/lib/hook-files.ts
  - features/step_definitions/hook/messages.steps.ts
  - features/step_definitions/hook/prompt-and-stop.steps.ts
  - features/step_definitions/hook/runs.steps.ts
  - features/step_definitions/hook/session.steps.ts
  - features/step_definitions/hook/tool-use.steps.ts
findings:
  critical: 1
  warning: 2
  info: 9
  total: 12
status: issues_found
---

# Phase 5: Code Review Report (iteration 2)

**Reviewed:** 2026-11-01T21:27:21Z
**Depth:** standard
**Files Reviewed:** 36
**Status:** issues_found

## Summary

This pass re-reviews the phase after fix commits `0d877aa..40367d9`. I checked each fix against the iteration-1 findings, against the locked decisions in `05-CONTEXT.md` (D-CF5-09 now says the input rewrite is the last one in routing order, so iteration-1 WR-01 is closed and not raised again), against Pi 1.4's `agent-session.js`, and against the upstream binary `/opt/claude-code/bin/claude` (2.1.316). The paired unit suites pass on this tree (`dispatch`, `dispatch-exec`, `event-adapters`, `hook-labels`, `notification-resolve`, `notification-dispatch`: 712 pass, 0 fail).

What happened to each iteration-1 finding:

| Prior | Verdict |
| ----- | ------- |
| CR-01 overflow fails open under `onFailure: "block"` | Fixed for that case. The same overflow path still drops an exit-2 deny (new **CR-01**). |
| CR-02 blocking SessionStart drops others' context | Fixed. Context is buffered on every arm (`event-adapters.ts:494-509`). |
| WR-01 rewrite follows the winning decision | Closed by the D-CF5-09 amendment (upstream `jFt` keeps the last `updatedInput`). |
| WR-02 prompt context on the wrong turn | Fixed for the stale buffer and for a steer. A follow-up's context still reaches the wrong turn (new **WR-02**). |
| WR-03 notices verbatim and unbounded | Fixed. `terminalSafeHookNotice` strips VT sequences and `\p{Cc}`, and caps at 2,000 graphemes. Both strategies get the clean text. |
| WR-04 PreCompact block does nothing | Fixed. A folded block returns `{ cancel: true }` and shows a notice. One regression in the fold: a `continue:false` hides the block (new **WR-01**). |
| WR-05 reload scenario depends on a quiet window | Fixed. A positive UserPromptSubmit marker replaces the quiet window. |
| IN-01..IN-06 | Out of the fix scope (`critical_warning`). All six are still present and are listed again as IN-04..IN-09. |

## Critical Issues

### CR-01: An output overflow still turns an exit-2 deny into an allow

**File:** `extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts:406-419` (with `handleOverflow` at 331-362)
**Issue:** The iteration-1 fix sends the overflow path through `onFailureBlock` only. `parseHookStdout` never runs there. `onFailureBlock` returns `undefined` when the hook sets no `onFailure: "block"` (the default), and also when the exit code is 2, because `isFailure` treats exit 2 as no failure (`on-failure.ts:59-61`). Either way the result is `{ kind: "noop" }`.

So a PreToolUse guard that denies with the usual exit-2 pattern fails open as soon as it writes more than 64 KB to stderr or 1 MB to stdout:

```sh
printf 'denied: %s\n' "$(cat)" >&2; exit 2   # echoes the tool input as the reason
```

The model controls the tool input, and the stdin cap is 256 KB (`spawn-helpers.ts`). A `Write` of a file over 64 KB is routine, so this happens in normal use. There are two cases, and both give noop:
- The bridge's synchronous SIGTERM (line 351) kills the guard before it reaches `exit 2`. `code` is `null`, and with the default `onFailure` that is noop.
- The guard has already exited 2 when the overflowing chunk arrives (the pipe buffer is about 64 KB, so the tail can land after exit). `code` is `2`, `isFailure` returns false, and the result is noop.

The iteration-1 CR-01 named this exact threat ("a guard that logs its input to stderr ... overflows on input the model controls"). The fix closed only the `onFailure: "block"` part of it. An exit-2 deny is the main way a hook blocks a tool call, so this is the same severity. The overflow kill predates the phase, but this file is in scope and the behavior is a security fail-open.
**Fix:** Do not kill on a stderr overflow. Stop accumulating, keep draining and discarding, and let the process exit (the timeout ladder is still the backstop). Then parse with the truncated text, so an exit 2 still blocks:
```ts
// accumulateStream: on overflow, mark truncated and drop further chunks,
// but keep the 'data' listener so the pipe drains and the child can exit.
child.once("close", (code) => {
  if (overflowed) {
    const failure = onFailureBlock(entry, { startFailed: false, timedOut: ladder.fired(), exitCode: code, stdout: "", stderr });
    // Exit 2 blocks whatever the output size. Stdout is truncated, so it is not parsed as JSON.
    settle(failure ?? (code === 2 ? parseHookStdout(2, "", stderr, entry.claudeEvent) : { kind: "noop" }));
    return;
  }
  ...
```
If the kill-on-overflow policy must stay for stdout, at least honor `code === 2` as shown, and record the remaining kill-race divergence with a decision ID. Add a unit case for "stderr overflow + exit 2 + default onFailure gives block", and a scenario variant of the existing tool-use overflow scenario without `onFailure`.

## Warnings

### WR-01: A `continue:false` from one PreCompact hook cancels another hook's block, so the compaction runs and nothing is shown

**File:** `extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts:383-397` (`foldOutcomes`), `dispatch.ts:491` (`blockNotices`), `extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts:354-367` (`adaptPreCompactResult`)
**Issue:** `foldOutcomes` lets any `stop` beat any `block`. The WR-04 fix keys both the cancel and the notice on the folded arm: `adaptPreCompactResult` returns `{ cancel: true }` only for `block`, and `blockNotices` shows the notice only when `folded.result.kind === "block"`. Take two PreCompact hooks in different plugins, where A prints `{"continue":false}` and B exits 2. The fold is `stop`. `adaptPreCompactResult` only writes a debug line, the compaction proceeds, and B's block shows nothing.

That breaks the WR-04 contract and the phase's "never silent" rule. Upstream does not fold this way. Its PreCompact runner (2.1.316) builds `blockedBy` from every hook with `Se.blocked`: `q=w.filter((Se)=>Se.blocked),Z=q.length>0?q.map(...)`. That list does not depend on any other hook's `continue` value, so B's block still stops the compaction. A third-party hook that happens to print `continue:false` can turn off another plugin's compaction guard.
**Fix:** On PreCompact, decide from the outcomes, not from the folded arm:
```ts
case "PreCompact":
  return blocks(folded.outcomes).length > 0 ? [compactionBlockedText(blocks(folded.outcomes))] : [];
```
and pass the outcomes, or a precomputed `blocked: boolean`, to the PreCompact adapter, so that any `block` outcome returns `{ cancel: true }`. Add a unit case in `dispatch.test.ts` for stop plus block on PreCompact.

### WR-02: A follow-up prompt's context reaches the model on the running prompt's turn, before the follow-up

**File:** `extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts:387-404, 432-438`; `docs/hooks-compatibility.md:279`
**Issue:** `sendQueuedPromptContext` sends with `{ triggerTurn: false }` for both `steer` and `followUp`. While Pi streams, that option pushes the message to `_pendingCustomMessages`, which Pi flushes at the next `turn_end` (`agent-session.js:795-797`, 1872-1877). So the next model call of the run that is still going sees it. A steer is also delivered before that next call, so the steer case works, and the new scenario covers only the steer. A follow-up is different: Pi delivers it only when the agent would otherwise stop (`_queueFollowUp`). Its `UserPromptSubmit hook additional context` therefore reaches the model one or more turns early, while the model is still working on the earlier prompt. This is the "context on the wrong turn" defect that iteration-1 WR-02 described, and `docs/hooks-compatibility.md:279` says the opposite ("its context goes in a hidden message on the turn that reads the prompt").

Pi already has a carrier that puts the message in the same queue as the prompt. With `deliverAs` and no `triggerTurn: false`, `sendCustomMessage` calls `agent.followUp(appMessage)` or `agent.steer(appMessage)` while streaming (`agent-session.js:1857-1863`). The input handler runs before `_queueFollowUp`/`_queueSteer`, so the context lands just before its prompt. When the agent is not streaming, the same call falls through to `_appendCustomMessage` (`triggerTurn` is undefined), as today.
**Fix:**
```ts
function sendQueuedPromptContext(pi, text, behavior: "steer" | "followUp"): void {
  ...
  pi.sendMessage({ customType: HOOK_CONTEXT_MESSAGE_TYPE, content: [...], display: false },
                 { deliverAs: behavior });
}
// caller: sendQueuedPromptContext(context.pi, result.additionalContext, event.streamingBehavior)
```
Add a follow-up scenario next to the steer one (prompt, follow-up while the tool runs, a script with at least two model calls before the follow-up is read). It must fail with today's carrier.

## Info

### IN-01: The PreCompact notice text differs from upstream's `[cmd]` / `[cmd]: output` form

**File:** `extensions/pi-claude-marketplace/bridges/hooks/hook-labels.ts:48-55, 83-88`
**Issue:** Upstream writes each blocked hook as `` `[${Se.command}]${ke?`: ${ke}`:""}` ``: always the bracketed command, and a `: <output>` part only when there is output. `compactionBlockedText` reuses `blockMessage`, which gives two different texts. An exit 2 with empty stderr gives `[cmd]: No stderr output` (upstream: `[cmd]`). A JSON `decision: "block"` gives the bare reason with no command (upstream: `[cmd]: ...`). The fix report and the doc comment say "as upstream does".
**Fix:** Give `compactionBlockedText` its own formatter, `[${command}]` plus `: ${reason}` when the reason is non-empty, and pin it in `hook-labels.test.ts`. Otherwise record the wording divergence.

### IN-02: Stale section header after PreCompact moved out of the observation adapter

**File:** `extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts:452-453`
**Issue:** The banner still reads `adaptObservationResultForEvent -- SessionStart / SessionEnd / PreCompact / PostCompact`. PreCompact now has its own adapter.
**Fix:** Drop `PreCompact` from the banner.

### IN-03: Context of a steer or follow-up queued while Pi is idle is silently lost

**File:** `extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts:432-438`, `extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts:655-660, 693-695`
**Issue:** Pi's `steer()`/`followUp()` (`_queueUserInput`, `agent-session.js:1752-1768`) pass `streamingBehavior: undefined` to `input` handlers when the agent is idle, but they still queue the prompt and start no run. The adapter buffers the context for `before_agent_start`, and the next prompt's `dropStalePromptContext` throws it away, even though the queued prompt is read later. The only trace is a debug line. This is an edge case (RPC `steer`/`follow_up` sent while idle).
**Fix:** Optional. Document it in `docs/hooks-compatibility.md`, or deliver idle-queued context with `deliverAs: "followUp"`.

### IN-04: A generation change discards the folded decision, a deny included (carried over from iteration-1 IN-01)

**File:** `extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts:222-232, 399-411`
**Issue:** Unchanged. This is the established DISP-03 stale-closure pattern, and the generation advances only on an extension reload.
**Fix (optional):** On PreToolUse, keep a `block`/`stop` outcome from a stale fold.

### IN-05: Dead generation checks (carried over from iteration-1 IN-02)

**File:** `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts:1107-1109, 1203-1205`
**Issue:** `if (!generationIsCurrent()) { return; }` is the last statement of its block, so it does nothing.
**Fix:** Delete both.

### IN-06: `PendingPromptContext` duplicates `PendingSessionStartContext` (carried over from iteration-1 IN-03)

**File:** `extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts:137-156`
**Issue:** The two interfaces have the same fields. `bufferedContext` (`event-adapters.ts:101`) already returns one type for both buffers.
**Fix:** Declare one `PendingHookContext`.

### IN-07: An `onFailure` that Stop and async hooks ignore is only debug-logged (carried over from iteration-1 IN-04)

**File:** `extensions/pi-claude-marketplace/bridges/hooks/on-failure.ts:91-97`
**Issue:** Upstream warns. Here the only trace is `hookDebugLog`.
**Fix:** Surface it in `info`, or document the divergence.

### IN-08: An empty inline `hooks: {}` makes a plugin partial (carried over from iteration-1 IN-05)

**File:** `extensions/pi-claude-marketplace/domain/hooks-resolution.ts:129-131, 180-181`
**Issue:** `declaresHooksValue({})` is `true`, so install needs `--partial` although no hook would load.
**Fix:** Treat an empty plain object as declaring nothing.

### IN-09: A Stop exit 2 with empty stderr sends an empty feedback paragraph (carried over from iteration-1 IN-06)

**File:** `extensions/pi-claude-marketplace/bridges/hooks/settle.ts:226-227`
**Issue:** `result.reason ?? ""` gives `Stop hook feedback:\n` with no text. The other paths fall back to `No stderr output` or `Blocked by hook`.
**Fix:** Reuse the `hook-labels.ts` defaults.

---

_Reviewed: 2026-11-01T21:27:21Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

---
phase: 05-hooks
reviewed: 2026-11-01T20:30:48Z
depth: standard
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
  critical: 2
  warning: 5
  info: 6
  total: 13
status: issues_found
---

# Phase 5: Code Review Report

**Reviewed:** 2026-11-01T20:30:48Z
**Depth:** standard
**Files Reviewed:** 36
**Status:** issues_found

## Summary

I reviewed the Phase 5 hooks changes since `74829438`: the parallel run and fold, dedupe, session and compaction mapping, `onFailure`, exec-form substitution, the `hook-notice` surface, the manifest `hooks` detection, and the new cucumber steps. Each finding was checked against the D-CF5 decisions in `05-CONTEXT.md`.

Verdicts on the three security-audit leads:

1. **Confirmed (CR-01).** A stdout or stderr overflow settles `noop` before the `onFailure` check, so an `onFailure: "block"` guard fails open. A tool input over 64 KB that the hook echoes to stderr is enough to trigger it.
2. **Refuted as a defect (IN-01).** A generation change that discards the fold is the established DISP-03 pattern. It was already in the sequential reducer before this phase. The generation advances only in `registerHooksBridge`, which means an extension reload. A fail-closed refinement is listed as optional.
3. **Confirmed, but lower severity (WR-03).** Notice text reaches `ctx.ui.notify` verbatim, with no control-character filter and no length bound. The hook already runs as the user, so the main risk is untrusted data that a hook echoes, not the hook itself.

Beyond the leads: a blocking SessionStart hook drops every other hook's context (CR-02). The input rewrite does not follow the winning decision (WR-01). UserPromptSubmit context can attach to the wrong turn (WR-02). A PreCompact block does nothing, although Pi can cancel the compaction (WR-04). One negative cucumber assertion depends on timing (WR-05).

## Critical Issues

### CR-01: Output overflow makes an `onFailure: "block"` hook fail open

**File:** `extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts:406-410`
**Issue:** The `close` handler returns `{ kind: "noop" }` when `overflowed` is set. It returns before the D-CF5-18 `onFailureBlock` check at lines 419-427. The bridge kills an overflowing hook (SIGTERM at line 351), so the process ends by a signal, with exit code `null`. That is "an exit other than 0 and 2", which `isFailure` (`on-failure.ts:54-64`) treats as a failure, and which upstream (E6) turns into a block. Because of the early return, a PreToolUse guard declared `onFailure: "block"` lets the tool call run as soon as it writes more than 64 KB to stderr or 1 MB to stdout.

The stdin payload is capped at 256 KB (`spawn-helpers.ts:119`), so the model can pass a tool input larger than the 64 KB stderr cap. A guard that logs its input to stderr (a common debug pattern) then overflows on input the model controls. This defeats the only purpose of `onFailure: "block"`.
**Fix:** Run the onFailure check on the overflow path too. Treat it as a kill that the bridge caused:
```ts
child.once("close", (code) => {
  if (overflowed) {
    const failure = onFailureBlock(entry, {
      startFailed: false,
      timedOut: false,
      exitCode: code ?? null, // null after the SIGTERM: a failure under E6
      stdout: "",
      stderr: stderr.slice(0, STDERR_MAX_BYTES),
    });
    settle(failure ?? { kind: "noop" });
    return;
  }
  ...
```
Add a unit case in `test/bridges/hooks/dispatch-exec*.test.ts` for a stderr overflow with `onFailure: "block"`. Add a scenario if one is in scope (AGENTS.md "Behavioral tests").

### CR-02: A blocking or stopping SessionStart hook drops every other hook's `additionalContext`

**File:** `extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts:423-427, 446-450` (with `dispatch.ts:380-391`)
**Issue:** `foldOutcomes` joins the context of every hook into the decisive arm (`withContext(decisive.result, context)`). But `adaptObservationResultForEvent` buffers SessionStart context only in the `mutate` arm. Its `block` and `stop` arms only debug-log. So if one SessionStart hook exits 2, or fails under `onFailure: "block"` (which D-CF5-18 says is only "reported as the event's error" on SessionStart), the context of every other SessionStart hook in every other plugin is dropped silently. Upstream, exit 2 on SessionStart only shows stderr to the user, and the other hooks' context still reaches the model (E13).

This breaks D-CF5-09 ("every hook's `additionalContext` ... kept") and D-CF5-13. It also lets one plugin's failing hook take the context away from an unrelated plugin.
**Fix:** On SessionStart, buffer the joined context whatever the arm is:
```ts
export function adaptObservationResultForEvent(result, claudeEvent, context): undefined {
  if (
    claudeEvent === "SessionStart" &&
    typeof result.additionalContext === "string" &&
    result.additionalContext !== ""
  ) {
    context.runtime.appendPendingSessionStartContext(
      bufferedContext(result.additionalContext, context),
    );
  }
  switch (result.kind) { /* block/stop: debug-log only; mutate/noop: nothing more */ }
}
```
Add a scenario in which hook A exits 2 and hook B prints context on SessionStart, and the model still receives B's context.

## Warnings

### WR-01: The input rewrite is the last one in routing order, not the rewrite of the winning decision

**File:** `extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts:315-323, 355-359`
**Issue:** D-CF5-09 says: "the input rewrite of the winning decision, ties to the last hook in routing order". `foldMutations` takes `lastSet(mutations, "updatedInput")` over all mutations, whatever each one decided. Example: hook A answers `ask` with `updatedInput: X`, and hook B answers `allow` with `updatedInput: Y`. The fold asks, attributed to A. If the user allows the call in `tui`, `adaptToolCallMutation` applies B's `Y`, an input that the asking hook never proposed and the user never saw.
**Fix:** Take the rewrite from the mutations that carry the winning decision:
```ts
const permission = foldedPermission(mutations);
const winners = permission.permissionDecision === undefined
  ? mutations
  : mutations.filter(({ result }) => result.permissionDecision === permission.permissionDecision);
const updatedInput = lastSet(winners, "updatedInput") ?? lastSet(mutations, "updatedInput");
```
If the fallback to a decision-less rewrite is not what D-CF5-09 means, drop it. Pin the behavior with a unit case.

### WR-02: UserPromptSubmit context can attach to a later prompt's turn

**File:** `extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts:361-366`, `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts:225-229`
**Issue:** The `input` adapter appends to `pendingPromptContext`, and only `before_agent_start` drains it. Pi emits `input` in several cases that start no run, so `before_agent_start` does not fire for that prompt (`agent-session.js:1651-1693`):
- A steer or follow-up typed while the agent streams is queued into the running loop.
- Another extension's `input` handler returns `handled`.
- The model or auth check throws after the input handlers ran.

In each case the context stays buffered and is attached to the next prompt that does start a run, labeled as that prompt's context. Upstream attaches the context to the prompt that produced it (E13). Nothing drains the buffer on a later `input`: `recordUserInput` resets only the Stop state.
**Fix:** At minimum, drain stale prompt context when a new `input` arrives, before the UserPromptSubmit fold appends. For example, in the second `input` subscription (`inputResetHandlerFor`), or at the start of the UserPromptSubmit composite. For a queued steer or follow-up (`event.streamingBehavior !== undefined`), deliver the context with `pi.sendMessage(..., { triggerTurn: false })`, as tool context does. Do not buffer it for `before_agent_start`.

### WR-03: Hook notices reach the user verbatim and unbounded (audit lead 3)

**File:** `extensions/pi-claude-marketplace/shared/notification-grammar.ts:1390-1394`, `extensions/pi-claude-marketplace/shared/notification-dispatch.ts:486-495`, `extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts:448-505`
**Issue:** The `hook-notice` text has three sources: a hook's `systemMessage`, exit-2 stderr on SessionStart, SessionEnd, and PostCompact, and the onFailure reason, which includes up to 64 KB of stderr. It passes to `ctx.ui.notify` and to the JSON entry with no control-character filter and no length bound. A hook that echoes untrusted data (tool input, the prompt, file content) into `systemMessage` or stderr can put ANSI or OSC sequences on the user's terminal, such as a title change, an OSC 52 clipboard write, or a spoofed hyperlink. It can also put a 64 KB notice on the screen.

The hook already runs as the user, so the risk is the echoed data, not the hook. Still, the project already strips such output from another subprocess (`orchestrators/plugin/package-install.ts:404-416`, `stripVTControlCharacters` plus `\p{Cc}`), and this new surface does not.
**Fix:** In `notifyHookNotice`, or where `dispatch.ts`/`settle.ts` compose the notice, apply `stripVTControlCharacters` from `node:util` and replace the remaining `\p{Cc}` other than `\n` and `\t`. Cap the text at a documented length with an ellipsis. Update the `hook-notice` block in `docs/output-catalog.md` and the architecture byte-lock test to match.

### WR-04: A PreCompact block (exit 2 or `onFailure: "block"`) does nothing and shows nothing, although Pi can cancel

**File:** `extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts:423-427`, `extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts:499-503`
**Issue:** On PreCompact, a block only goes to `hookDebugLog`: no `cancel`, no notice. D-CF5-18 lists SessionStart, SessionEnd, and PostCompact as the events "with no block". PreCompact is not on that list, so the decision expects a PreCompact block to act. Pi supports one: `SessionBeforeCompactResult.cancel` (`pi-coding-agent/dist/core/extensions/types.d.ts:1137-1140`). So this is not a Pi gap. `docs/hooks-compatibility.md:18` marks the divergence with a warning sign (⚠) but cites no decision ID that licenses it (AGENTS.md "Upstream parity"). As a result, an `onFailure: "block"` hook on PreCompact fails without any visible effect, which goes against "never silent".
**Fix:** Check upstream 2.1.316 PreCompact exit-2 behavior with `claude-code-compat-research`. If upstream blocks the compaction, return `{ cancel: true }` from the `session_before_compact` composite on a folded block, and notice the reason. If upstream does not block, record a D-CF5 ID for the divergence and show the block as the event's hook error, as SessionStart, SessionEnd, and PostCompact do.

### WR-05: The reload scenario's "no runs" check depends on a one-second quiet window

**File:** `features/step_definitions/hook/session.steps.ts:69-72, 251-262` (used by `features/hook/session.feature:201`)
**Issue:** "the user reloads pi in the terminal" reads the hook log after the terminal output has stayed unchanged for `TERMINAL_QUIET_MS` (1 s). A hook run prints nothing to the terminal, so the quiet window says nothing about hook processes. A wrongly dispatched SessionStart or SessionEnd hook that starts Node and appends its line after the window (likely on a loaded CI runner) is missed, and `Then the hooks record no runs` passes. The test cannot reliably fail without the D-CF5-03 change, which is the bar AGENTS.md sets for a behavioral scenario.
**Fix:** After the reload, run a positive marker that the hooks bridge must dispatch through the same lifecycle, then assert that no SessionStart or SessionEnd run came before it. For example, send a prompt in the terminal with a `UserPromptSubmit` recorder and wait for that run. Or wait on the bridge's own completion signal instead of terminal output.

## Info

### IN-01: A generation change discards the folded decision, including a deny (audit lead 2, refuted)

**File:** `extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts:222-232, 397-411`
**Issue:** `runHooks` returns `undefined`, so `NOOP_FOLD`, when the generation changed while the hooks ran. A PreToolUse deny computed across that window is lost, and the tool runs. This is the DISP-03 stale-closure pattern, and it was already in the sequential `reduceBucket` (base `dispatch.ts:198-200`). `advanceGeneration` is called only from `registerHooksBridgeWith` (`event-router.ts:981`), which means an extension reload. So this is intended behavior, not a defect introduced here.
**Fix (optional):** Fail closed for a stale fold on PreToolUse. If any outcome is `block` or `stop`, keep it rather than fold to noop, so a reload during a guarded call never turns a deny into an allow.

### IN-02: Dead generation checks

**File:** `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts:1109-1111, 1203-1205`
**Issue:** `if (!generationIsCurrent()) { return; }` is the last statement of its function, so it has no effect.
**Fix:** Delete both blocks.

### IN-03: `PendingPromptContext` duplicates `PendingSessionStartContext`

**File:** `extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts` (the two interfaces)
**Issue:** The two interfaces have the same fields. `bufferedContext` in `event-adapters.ts:101` already returns one type for both buffers.
**Fix:** Declare one `PendingHookContext` and alias it, or use it for both buffers.

### IN-04: `onFailure` that is ignored on Stop and async hooks is only debug-logged

**File:** `extensions/pi-claude-marketplace/bridges/hooks/on-failure.ts:91-97`
**Issue:** E6 says upstream ignores `onFailure: "block"` on Stop "with a warning". Here the only trace is `hookDebugLog` at dispatch time, so a plugin author gets no visible signal.
**Fix:** Name the ignored field in `info` or as a resolution note, or record the divergence in `docs/hooks-compatibility.md`.

### IN-05: An empty inline `hooks: {}` makes a plugin partial

**File:** `extensions/pi-claude-marketplace/domain/hooks-resolution.ts:129-131, 180-189`
**Issue:** `declaresHooksValue({})` is `true`, so an empty inline map in a manifest or marketplace entry adds `unsupported hooks`, and install then needs `--partial`, although no hook would load.
**Fix:** Treat an empty plain object, like an empty array, as declaring nothing.

### IN-06: A Stop exit 2 with empty stderr sends an empty feedback paragraph

**File:** `extensions/pi-claude-marketplace/bridges/hooks/settle.ts:226-230`
**Issue:** `feedbackTexts` uses `result.reason ?? ""`, so the re-entry reads `Stop hook feedback:\n` with no text. Every other block path falls back to Claude Code's `No stderr output` or `Blocked by hook` (`hook-labels.ts:356-357`).
**Fix:** Reuse the `hook-labels.ts` defaults, for example by exporting a `blockReasonText(reason, fromStderr)` helper.

---

_Reviewed: 2026-11-01T20:30:48Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

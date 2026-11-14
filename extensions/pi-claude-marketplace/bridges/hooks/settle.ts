// bridges/hooks/settle.ts
//
// Dispatcher for the turn-boundary hook events. Neither `agent_before_settle`
// nor `agent_settled` names the run's stop reason, so this runtime caches the
// last assistant message from the preceding `agent_end.messages` and gates
// dispatch on its `stopReason` (STOP-01). Pi maps both `stop` and `length` to
// the boundary outcome `completed`, so the outcome cannot gate it.
//
// A `stop` ending runs the Stop bucket on `agent_before_settle` with full
// decision control (D-PG5-01): a hook that blocks or adds context continues
// the same run, through one hidden `custom_message` entry that the handler
// appends to the boundary's entries, with `continue: true`. An `error` or
// `length` ending stays cached for `agent_settled`, which runs StopFailure
// (observation-only -- the bucket runs but its result is discarded,
// SFAIL-01, D-PG5-03); `agent_settled` never runs Stop, so one ending runs it
// at most once. `pending`, `aborted`, `toolUse` and `deferred` dispatch
// nothing.
//
// As Claude Code 2.1.316 does, a Stop continuation sends every blocking
// reason and every `additionalContext` back in one message, one
// `Stop hook feedback:\n<text>` part per value in routing order (D-CF5-11 /
// D-CF5-13 / D-CF5-25), and each Stop `systemMessage` is shown to the user as
// `Stop says: <text>`, never to the model (D-CF5-14). A Stop hook that fails
// without blocking shows its failure notice, and the first `continue: false`
// shows its `stopReason` as `Stop hook stopped continuation: <reason>`
// (D-PG5-10, D-PG5-13). Pi decides only after every boundary handler whether
// the run goes on, so the reason waits for `agent_settled`, which Pi raises
// once the run stops. An `agent_end` before it means that the run went on,
// and the reason is dropped. A StopFailure hook shows neither.
//
// Every handler carries the captured-generation guard so a stale closure from
// a prior `/reload` cannot fire against rebuilt routing tables;
// `resetSettleState` clears the cache cell in `registerHooksBridge` for the
// same reason.

import { hookDebugLog } from "../../shared/debug-log.ts";
import { errorMessage } from "../../shared/errors.ts";
import { notifyHookNotice, notifyStopHookOverrideCap } from "../../shared/notification-dispatch.ts";
import { openNotificationRun, requireNotificationMode } from "../../shared/notification-run.ts";

import {
  collectBucketOutcomes,
  failureNotices,
  matcherFiresOnClosedSetValue,
  showHookNotice,
} from "./dispatch.ts";
import { hookSaysText, hookStoppedText } from "./hook-labels.ts";
import { classifyStopFailure } from "./payloads/stop-failure.ts";
import { STOP_OVERRIDE_CAP, type HooksRuntime } from "./runtime.ts";

import type { BucketOutcome, HookExecutor } from "./dispatch.ts";
import type { HookExecResult } from "./exec-result.ts";
import type { StopFailureEvent } from "./payloads/stop-failure.ts";
import type { StopEvent } from "./payloads/stop.ts";
import type { StopFailureErrorType } from "../../domain/components/hook-events.ts";
import type {
  AgentBeforeSettleEvent,
  AgentBeforeSettleEventResult,
  AgentEndEvent,
  AgentMessage,
  AgentSettledEvent,
  AssistantMessage,
  ExtensionAPI,
  ExtensionContext,
  PiTextContentBlock,
} from "../../platform/pi-api.ts";
import type { NotificationRun } from "../../shared/notification-run.ts";

/**
 * Custom-message type of the hidden entry that carries the Stop hooks'
 * feedback into the continued run (D-PG5-01). Distinct from the async-rewake
 * `claude-hook-rewake` value so a Stop continuation and a rewake stay
 * separable in the transcript and in `details`-based consumers.
 */
const STOP_BLOCK_CUSTOM_TYPE = "claude-hook-stop-block" as const;

/** One entry that a boundary handler may append to the boundary's entries. */
type BoundaryEntry = NonNullable<AgentBeforeSettleEventResult["entries"]>[number];

/** The feedback a Stop run sends back, and the plugin it names. */
interface StopContinuation {
  readonly parts: PiTextContentBlock[];
  readonly pluginId: string;
}

/**
 * Reset the runtime's settle state. Called from `registerHooksBridge` so a
 * `/reload` cannot leak a stale cached message or loop-protection state into
 * the new session.
 */
export function resetSettleState(runtime: HooksRuntime): void {
  runtime.prepareSettleForRegistration();
}

/**
 * `input`-event reset closure (STOP-07). A genuine user `input` event clears
 * the Stop continuation flag and resets the consecutive-block counter +
 * one-shot latch; a Stop continuation does NOT pass through `input`, so the
 * flag survives a continuation and clears only when the user actually
 * types. A run that an async rewake woke keeps `stop_hook_active` true until
 * that run settles (D-BG-210). Generation-
 * guarded like the other settle handlers so a stale closure from a prior
 * `/reload` cannot reset the live session's state. Registered as a dedicated
 * `pi.on("input", ...)` subscription in `registerHooksBridge` (Pi supports
 * multiple handlers per event).
 */
export function inputResetHandlerFor(
  runtime: HooksRuntime,
  capturedGeneration: number,
): () => void {
  return () => {
    if (capturedGeneration !== runtime.currentGeneration()) {
      return;
    }

    runtime.recordUserInput();
  };
}

/**
 * Walk `messages` from the end and return the last assistant message (the one
 * carrying the run's `stopReason`), or undefined when none is present.
 */
function findLastAssistant(messages: readonly AgentMessage[]): AssistantMessage | undefined {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message?.role === "assistant") {
      return message;
    }
  }

  return undefined;
}

/**
 * `agent_end` cache handler: records the run's last assistant message so the
 * subsequent `agent_settled` (which carries no payload) can read its
 * `stopReason`. Last-write-wins; no-ops on a stale generation (STOP-01). A
 * run end after the boundary held a stop reason means that the run went on,
 * so the reason is dropped (D-PG5-13).
 */
export function agentEndCacheHandler(
  runtime: HooksRuntime,
  capturedGeneration: number,
): (event: AgentEndEvent) => void {
  return (event) => {
    if (capturedGeneration !== runtime.currentGeneration()) {
      return;
    }

    if (runtime.takeHeldStopReason() !== undefined) {
      hookDebugLog("settle: the run went on after a Stop hook stopped it; stopReason not shown");
    }

    runtime.recordLastAssistant(findLastAssistant(event.messages));
  };
}

/**
 * `agent_before_settle` dispatcher (D-PG5-01): takes the cached last
 * assistant message when it ended with `stop` (STOP-01, D-PG5-03) and runs
 * the Stop bucket. When a hook blocks or adds context, it resolves to the
 * boundary's entries followed by one hidden `custom_message` draft, with
 * `continue: true`, so Pi calls the model again in the same run (STOP-03).
 * Otherwise it resolves to `undefined`: it never returns `continue: false`,
 * so it cancels no continuation another extension asked for (D-PG5-05).
 * No-ops on a stale epoch, an unavailable mode, or a message that did not
 * end with `stop`, which stays cached for `agent_settled`. An error is
 * debug-logged and resolves to `undefined` (NFR-2).
 *
 * The stop boundary is open while the bucket runs, so a wake that an async
 * rewake sends in that window sets the D-BG-210 mark (D-PG5-06).
 *
 * `executor` is optional and threaded down to `collectBucketOutcomes`, which
 * defaults it to `dispatchHookExec`. Production omits it: the one call, in
 * `registerHooksBridge`, forwards that factory's own optional `executor`,
 * which its sole production caller never sets. It is there so a test can
 * drive the Stop arm against a spy instead of a real child process (see
 * `HookExecutor` in `dispatch.ts`).
 */
export function beforeSettleHandlerFor(
  runtime: HooksRuntime,
  capturedGeneration: number,
  pi: ExtensionAPI,
  executor?: HookExecutor,
): (
  event: AgentBeforeSettleEvent,
  ctx: ExtensionContext,
) => Promise<AgentBeforeSettleEventResult | undefined> {
  return async (event, ctx) => {
    if (capturedGeneration !== runtime.currentGeneration()) {
      return undefined;
    }

    try {
      requireNotificationMode(ctx.mode);
    } catch (error: unknown) {
      hookDebugLog(`settle: context unavailable: ${errorMessage(error)}`);
      return undefined;
    }

    const last = runtime.takeStopEnding();
    if (last === undefined) {
      return undefined;
    }

    try {
      const continuation = await runStopBoundary(
        runtime,
        last,
        capturedGeneration,
        ctx,
        pi,
        executor,
      );
      return continuation === undefined
        ? undefined
        : { entries: [...event.entries, stopBlockDraft(continuation)], continue: true };
    } catch (error: unknown) {
      hookDebugLog(`settle: Stop boundary failed: ${errorMessage(error)}`);
      return undefined;
    }
  };
}

// Runs the Stop bucket with the stop boundary open, and closes it again
// however the bucket ends (D-PG5-06).
async function runStopBoundary(
  runtime: HooksRuntime,
  last: AssistantMessage,
  capturedGeneration: number,
  ctx: ExtensionContext,
  pi: ExtensionAPI,
  executor?: HookExecutor,
): Promise<StopContinuation | undefined> {
  const run = openNotificationRun(pi, { kind: "hook" });
  runtime.openStopBoundary();
  try {
    return await runStopBucket(runtime, last, capturedGeneration, ctx, pi, run, executor);
  } finally {
    runtime.closeStopBoundary();
  }
}

// D-CF5-25 / D-PG5-01: the hidden entry that carries the Stop feedback into
// the continued run.
function stopBlockDraft({ parts, pluginId }: StopContinuation): BoundaryEntry {
  return {
    type: "custom_message",
    customType: STOP_BLOCK_CUSTOM_TYPE,
    content: parts,
    display: false,
    details: { pluginId },
  };
}

/**
 * `agent_settled` dispatcher: first shows the stop reason that the boundary
 * held, because the run stopped (D-PG5-13). Then it reads the cached last
 * assistant message and gates on `stopReason` (STOP-01). `error` / `length` route to the
 * StopFailure observation-only arm (SFAIL-01, D-PG5-03); `stop` runs nothing,
 * because the boundary handler runs the Stop hooks of that ending, or Pi
 * skipped the boundary after an abort; `pending` / `aborted` / `toolUse` /
 * `deferred` are a defensive no-op. No-ops on a stale epoch or an empty
 * cache.
 *
 * `executor` is optional and threaded down to `collectBucketOutcomes`, as for
 * `beforeSettleHandlerFor`, so a test can drive the StopFailure arm against a
 * spy instead of a real child process.
 */
export function settleHandlerFor(
  runtime: HooksRuntime,
  capturedGeneration: number,
  pi: ExtensionAPI,
  executor?: HookExecutor,
): (event: AgentSettledEvent, ctx: ExtensionContext) => Promise<void> {
  return async (_event, ctx) => {
    if (capturedGeneration !== runtime.currentGeneration()) {
      return;
    }

    try {
      requireNotificationMode(ctx.mode);
    } catch (error: unknown) {
      hookDebugLog(`settle: context unavailable: ${errorMessage(error)}`);
      return;
    }

    const heldReason = runtime.takeHeldStopReason();
    if (heldReason !== undefined) {
      showStopNotice(
        ctx,
        openNotificationRun(pi, { kind: "hook" }),
        hookStoppedText("Stop", heldReason),
      );
    }

    // One-shot consumption: clear the cache so a spurious second `agent_settled`
    // without an intervening `agent_end` no-ops instead of reprocessing the same
    // (stale) message.
    const last = runtime.takeLastAssistant();
    if (last === undefined) {
      return;
    }

    switch (last.stopReason) {
      // D-PG5-03: the Stop hooks of a `stop` ending run at the boundary, so
      // one ending runs them at most once.
      case "stop":
        return;

      case "error":
      case "length": {
        const stopErrorMessage = last.errorMessage ?? "";
        const errorType = classifyStopFailure(stopErrorMessage, last.stopReason);
        if (errorType === "unknown") {
          hookDebugLog(
            `settle: unrecognized StopFailure errorMessage: ${JSON.stringify(stopErrorMessage)}`,
          );
        }

        await runStopFailure(last, errorType, runtime, capturedGeneration, ctx, pi, executor);
        return;
      }

      // Defensive no-op group (STOP-01): none of these is a turn ending the
      // Stop bucket may observe. `deferred` means the provider request was
      // handed to a batch or asynchronous lane and the message carries a
      // `DeferredHandle` to poll for the real response later, so it is an
      // in-flight state like `pending`; dispatching Stop on it would fire
      // turn-boundary hooks on a turn that has not ended.
      case "pending":
      case "aborted":
      case "toolUse":
      case "deferred":
        return;
    }

    // NFR-7: the switch lists every `StopReason` and has no default arm, so a
    // peer-dep bump that widens the union is a type and lint error above. A
    // stop reason outside the union at runtime falls out of the switch and is
    // dropped here -- the settle handler never throws.
  };
}

/**
 * Concatenate the assistant message's text blocks into the string passed to
 * the Stop hook as `last_assistant_message`.
 */
function renderAssistantText(message: AssistantMessage): string {
  const parts: string[] = [];
  for (const block of message.content) {
    if (block.type === "text") {
      parts.push(block.text);
    }
  }

  return parts.join("");
}

// A non-empty hook output, or `undefined`.
function nonEmpty(text: string | undefined): string | undefined {
  return text === undefined || text === "" ? undefined : text;
}

// What one Stop hook sends back: its block reason, then its own
// `additionalContext`, each when present.
function feedbackTexts(result: HookExecResult): string[] {
  const texts = result.kind === "block" ? [result.reason ?? ""] : [];
  const context = nonEmpty(result.additionalContext);
  return context === undefined ? texts : [...texts, context];
}

/**
 * D-CF5-11 / D-CF5-13 / D-CF5-25: the feedback the Stop hooks send back to the
 * model, one `Stop hook feedback:\n<text>` part per value in routing order. A
 * hook that neither blocks nor adds context adds no part. The plugin is the
 * first hook that adds one, or `undefined` when none does; it names the
 * continuation entry and the cap notice.
 */
function stopFeedback(outcomes: readonly BucketOutcome[]): {
  readonly parts: PiTextContentBlock[];
  readonly pluginId: string | undefined;
} {
  return {
    parts: outcomes.flatMap(({ result }) =>
      feedbackTexts(result).map((text) => ({
        type: "text" as const,
        text: `Stop hook feedback:\n${text}`,
      })),
    ),
    pluginId: outcomes.find(({ result }) => feedbackTexts(result).length > 0)?.entry.pluginId,
  };
}

// Shows one Stop notice through the run the settle handler opened; a notice
// that fails to show is debug-logged and never fails the settle.
function showStopNotice(ctx: ExtensionContext, run: NotificationRun, notice: string): void {
  showStopNoticeWith(() => {
    notifyHookNotice(ctx, run, notice);
  });
}

// Runs `show`; a Stop notice that fails to show is debug-logged and never
// fails the boundary.
function showStopNoticeWith(show: () => void): void {
  try {
    show();
  } catch (error: unknown) {
    hookDebugLog(`settle: Stop notice failed: ${errorMessage(error)}`);
  }
}

/**
 * HOOK-05 / D-CF5-14 / D-PG5-10: show the user each Stop hook's non-empty
 * `systemMessage` as `Stop says: <text>`, in routing order, then the failure
 * notices of the Stop hooks that failed without blocking, through the run the
 * settle handler opened. A notice never reaches the model.
 */
function showStopNotices(
  runtime: HooksRuntime,
  ctx: ExtensionContext,
  run: NotificationRun,
  outcomes: readonly BucketOutcome[],
): void {
  for (const { result } of outcomes) {
    const message = nonEmpty(result.systemMessage);
    if (message !== undefined) {
      showStopNotice(ctx, run, hookSaysText("Stop", message));
    }
  }

  for (const notice of failureNotices("Stop", "Stop", outcomes)) {
    showStopNoticeWith(() => {
      showHookNotice(runtime, notice, (text) => {
        notifyHookNotice(ctx, run, text);
      });
    });
  }
}

// D-PG5-13: keeps the `stopReason` of the first stopping Stop hook for
// `agent_settled`, which shows it to the user and never to the model. Claude
// Code 2.1.323 shows no line for a missing or empty reason.
function holdStopReason(runtime: HooksRuntime, stopReason: string | undefined): void {
  const reason = nonEmpty(stopReason);
  if (reason !== undefined) {
    runtime.holdStopReason(reason);
  }
}

/**
 * Run the Stop bucket and adapt the collected outcomes over the full
 * `HookExecResult` union (STOP-03..06). Because D-88-05 makes Stop precedence
 * AGGREGATE (any `continue:false` suppresses continuation regardless of
 * another hook's block), the bucket is collected without a short-circuit,
 * its notices are shown (D-CF5-14), and then:
 *
 *   1. any `stop` (continue:false) among the group -> no continuation
 *      (STOP-06, D-PG5-05).
 *   2. else, when any hook blocks or adds context, continue once with every
 *      reason and context as `Stop hook feedback:` parts (STOP-03 / STOP-05 /
 *      D-CF5-25; exit-2 already maps to `{kind:"block",reason:stderr}` in
 *      `parseHookStdout`, so STOP-04 rides this arm with no Stop-specific exit
 *      handling).
 *   3. else nothing (`noop`).
 *
 * Returns the feedback and its plugin when the run continues, after the
 * STOP-07 cap admitted it, and `undefined` otherwise. A Stop hook declaring
 * `async` or `asyncRewake` runs in the background and returns `noop`; on
 * exit 2 an `asyncRewake` one wakes the model through the registry
 * (D-BG-206).
 *
 * The generation is re-checked AFTER the bucket's hooks finish: hook subprocesses
 * can outlive a `/reload`, and the entry-time guard in `beforeSettleHandlerFor`
 * only covers the pre-await window. Without the re-check, the stale
 * continuation would mutate the freshly reset loop state and continue a run
 * of the new session.
 */
async function runStopBucket(
  runtime: HooksRuntime,
  last: AssistantMessage,
  capturedGeneration: number,
  ctx: ExtensionContext,
  pi: ExtensionAPI,
  run: NotificationRun,
  executor?: HookExecutor,
): Promise<StopContinuation | undefined> {
  const bucket = runtime.getRoutingBucket("Stop");
  if (bucket.length === 0) {
    return undefined;
  }

  const event: StopEvent = {
    last_assistant_message: renderAssistantText(last),
    // STOP-07: the NEXT Stop payload after a bridge continuation carries
    // `stop_hook_active: true` so the hook can see it is running inside a
    // bridge-driven continuation loop.
    stop_hook_active: runtime.isStopHookActive(),
  };
  const outcomes = await collectBucketOutcomes(
    runtime,
    bucket,
    event,
    ctx,
    pi,
    () => true,
    executor,
  );

  // A /reload while the bucket's hooks were running advanced the generation and reset
  // the settle state; bail before any loop-state mutation or continuation.
  if (capturedGeneration !== runtime.currentGeneration()) {
    return undefined;
  }

  showStopNotices(runtime, ctx, run, outcomes);

  // STOP-06 / D-88-05: any continue:false suppresses continuation. This is a
  // non-continuation outcome, so it resets the consecutive continuation
  // counter (D-88-08).
  const stop = outcomes.find((o) => o.result.kind === "stop");
  if (stop?.result.kind === "stop") {
    hookDebugLog(
      `settle: continue:false from ${stop.entry.pluginId} suppresses Stop continuation; ` +
        `stopReason=${stop.result.stopReason ?? "<none>"}`,
    );
    holdStopReason(runtime, stop.result.stopReason);
    runtime.recordStopNonReentry();
    return undefined;
  }

  // STOP-03 / STOP-04 / STOP-05 / D-CF5-25: every reason and context goes back
  // in one continuation, which funnels through the shared bounded lane once,
  // so a block loop and a pure-additionalContext loop count toward the
  // STOP-07 cap alike (D-88-08).
  const { parts, pluginId } = stopFeedback(outcomes);
  if (pluginId !== undefined) {
    return continuesBounded(runtime, ctx, run, pluginId) ? { parts, pluginId } : undefined;
  }

  // noop: the agent genuinely settled with no continuing hook -- a
  // non-continuation outcome that resets the counter (D-88-08).
  runtime.recordStopNonReentry();
  return undefined;
}

/**
 * Run the StopFailure bucket observation-only (SFAIL-01). Reached on `error` /
 * `length` settle endings. Builds the synthetic StopFailure event
 * (`error` = the classified error type; `last_assistant_message` = Pi's
 * rendered `errorMessage`, trimmed, and left out when empty, as Claude Code
 * builds it, D-BG-303) and runs every hook whose
 * error-type matcher admits the classified error (SFAIL-03; match-all `""` /
 * `"*"` admits every type, and a `|` list admits each type it names,
 * D-BG-302) with no short-circuit, then DISCARDS the collected
 * outcomes: StopFailure carries no decision control, so a blocking hook or an
 * exit-2 hook produces no continuation and no loop-state mutation, and it cannot
 * suppress its peer observers. `stopHookActive`, the consecutive-block counter,
 * and `sendMessage` are never touched on this path. A StopFailure hook's
 * `systemMessage` is dropped with a debug line, as Claude Code drops it
 * (D-CF5-14). An empty bucket is a no-op.
 */
async function runStopFailure(
  last: AssistantMessage,
  classifiedError: StopFailureErrorType,
  runtime: HooksRuntime,
  capturedGeneration: number,
  ctx: ExtensionContext,
  pi: ExtensionAPI,
  executor?: HookExecutor,
): Promise<void> {
  const bucket = runtime.getRoutingBucket("StopFailure");
  if (bucket.length === 0) {
    return;
  }

  const errorText = (last.errorMessage ?? "").trim();
  const event: StopFailureEvent = {
    error: classifiedError,
    ...(errorText === "" ? {} : { last_assistant_message: errorText }),
  };

  // SFAIL-01: observation-only -- run every matching hook for its side effects
  // via the no-short-circuit walker, then discard the collected outcomes. A
  // reducing walk would `return` on a leading block/stop/exit-2 and starve the
  // later observers; StopFailure has no decision lane, so every matching hook
  // must get to observe the failure.
  //
  // SFAIL-03: the parse-time gate admits match-all (`""` / `"*"`), an exact
  // member of the closed error-type vocabulary, or a `|` list with at least
  // one member (D-BG-302), and the shared closed-set predicate reads that `|`
  // list, so a hook fires when the classified error is one of its types.
  const outcomes = await collectBucketOutcomes(
    runtime,
    bucket,
    event,
    ctx,
    pi,
    (entry) => matcherFiresOnClosedSetValue(entry, classifiedError),
    executor,
  );

  if (capturedGeneration !== runtime.currentGeneration()) {
    return;
  }

  const dropped = outcomes.filter(({ result }) => nonEmpty(result.systemMessage) !== undefined);
  if (dropped.length > 0) {
    hookDebugLog(`settle: ${dropped.length} systemMessage(s) dropped on StopFailure`);
  }
}

/**
 * STOP-07 bounded continuation bookkeeping shared by BOTH continuation lanes
 * -- a `block` continuation and an `additionalContext`-without-block
 * continuation (D-88-08, D-PG5-04). The first `STOP_OVERRIDE_CAP` blocking
 * outcomes continue; the next one does not and instead fires the one-shot
 * override-cap warning (guarded by `capNotifiedThisSession` so a later
 * continuation does not re-notify). Any continuation below the cap sets
 * `stopHookActive` -- the continuation is bridge-driven regardless of lane
 * (D-88-08). Returns whether the run continues. The cap is the T-88-02
 * livelock mitigation: an always-continuing hook, whether via block or
 * additionalContext, is bounded to 8 continuations then surfaced, never spun
 * unbounded and never suppressed without notice (transparency, D-88-01).
 */
function continuesBounded(
  runtime: HooksRuntime,
  ctx: ExtensionContext,
  run: NotificationRun,
  pluginId: string,
): boolean {
  const transition = runtime.recordStopReentry();
  if (transition.notifyCap) {
    try {
      notifyStopHookOverrideCap(ctx, run, pluginId, STOP_OVERRIDE_CAP);
    } catch (err: unknown) {
      hookDebugLog(`settle: cap notification failed (${pluginId}): ${errorMessage(err)}`);
    }
  }

  return transition.reenter;
}

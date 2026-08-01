// bridges/hooks/settle.ts
//
// Settle-time dispatcher for the turn-boundary hook events. Pi emits
// `agent_settled` once per logical completion carrying no payload, so this
// module caches the last assistant message from the preceding
// `agent_end.messages` and gates dispatch on its `stopReason` (STOP-01):
// `stop` runs the Stop bucket with full decision control (STOP-03 block
// re-entry); `error` / `length` route to StopFailure (observation-only --
// the bucket runs but its result is discarded, SFAIL-01); `aborted` and
// `toolUse` dispatch nothing.
//
// Both handlers carry the `capturedEpoch` guard so a stale closure from a
// prior `/reload` cannot fire against rebuilt routing tables;
// `resetSettleState` clears the cache cell in `registerHooksBridge` for the
// same reason.

import { hookDebugLog } from "../../shared/debug-log.ts";
import { errorMessage } from "../../shared/errors.ts";
import { notifyStopHookOverrideCap } from "../../shared/notify.ts";

import { collectBucketOutcomes, matcherFiresOnClosedSetValue } from "./dispatch.ts";
import { currentEpoch, getRoutingBucket } from "./event-router.ts";
import { classifyStopFailure } from "./payloads/stop-failure.ts";

import type { StopFailureEvent } from "./payloads/stop-failure.ts";
import type { StopEvent } from "./payloads/stop.ts";
import type { StopFailureErrorType } from "../../domain/components/hook-events.ts";
import type {
  AgentEndEvent,
  AgentMessage,
  AgentSettledEvent,
  AssistantMessage,
  ExtensionAPI,
  ExtensionContext,
} from "../../platform/pi-api.ts";

/**
 * Custom-message type for the Stop block re-entry. Distinct from the
 * async-rewake `claude-hook-rewake` value so the two re-entry semantics stay
 * separable in the transcript and in `details`-based consumers.
 */
const STOP_BLOCK_CUSTOM_TYPE = "claude-hook-stop-block" as const;

/**
 * STOP-07 loop-protection cap: the Nth consecutive bridge re-entry that
 * suppresses re-entry and trips the one-shot warning. The counter spans BOTH
 * re-entry lanes -- block AND additionalContext (D-88-08); the 8th consecutive
 * re-entry is the one that does NOT re-enter.
 */
const STOP_OVERRIDE_CAP = 8;

// The last assistant message observed on the most recent `agent_end`, read at
// settle time for its `stopReason`. Last-write-wins across auto-retry /
// compaction chains; reset on every bridge load for `/reload` hygiene.
let cachedLastAssistant: AssistantMessage | undefined;

// STOP-07 loop-protection state, all per-session and reset on every bridge
// load (`/reload` hygiene) via `resetSettleState`:
//   - `stopHookActive`: threaded into the NEXT Stop payload's
//     `stop_hook_active` field. Set true when ANY bridge re-entry fires -- a
//     block OR an additionalContext continuation (D-88-08); cleared ONLY by a
//     genuine `input` event (bridge-injected re-entry does NOT pass through
//     `input`, so it never self-clears).
//   - `consecutiveBlockCount`: incremented on EVERY bridge re-entry -- block
//     AND additionalContext share one counter (D-88-08); reset to 0 by a
//     non-re-entry outcome (`continue:false` or a plain allow).
//   - `capNotifiedThisSession`: one-shot latch guarding the cap warning so a
//     re-entry past the cap does not re-notify; re-armed when the counter
//     resets.
let stopHookActive = false;
let consecutiveBlockCount = 0;
let capNotifiedThisSession = false;

/**
 * Reset the settle module-state cells. Called from `registerHooksBridge` so a
 * `/reload` cannot leak a stale cached message or loop-protection state into
 * the new session.
 */
export function resetSettleState(): void {
  cachedLastAssistant = undefined;
  stopHookActive = false;
  consecutiveBlockCount = 0;
  capNotifiedThisSession = false;
}

/**
 * Reset the consecutive re-entry counter and re-arm the one-shot cap latch.
 * Called on a NON-re-entry Stop outcome (`continue:false` or a plain allow) so
 * the cap requires a fresh run of 8 consecutive re-entries afterward (D-88-08).
 * An additionalContext continuation does NOT reset -- it re-enters and counts
 * toward the cap like a block. Does NOT touch `stopHookActive` -- that flag is
 * cleared only by a genuine `input` event (STOP-07).
 */
function resetConsecutiveBlockState(): void {
  consecutiveBlockCount = 0;
  capNotifiedThisSession = false;
}

/**
 * `input`-event reset closure (STOP-07). A genuine user `input` event clears
 * `stop_hook_active` and resets the consecutive-block counter + one-shot latch;
 * bridge-injected `sendMessage` re-entries do NOT pass through `input`, so the
 * flag survives a re-entry and clears only when the user actually types. Epoch-
 * guarded like the other settle handlers so a stale closure from a prior
 * `/reload` cannot reset the live session's state. Registered as a dedicated
 * `pi.on("input", ...)` subscription in `registerHooksBridge` (Pi supports
 * multiple handlers per event).
 */
export function inputResetHandlerFor(capturedEpoch: number): () => void {
  return () => {
    if (capturedEpoch !== currentEpoch()) {
      return;
    }

    stopHookActive = false;
    resetConsecutiveBlockState();
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
 * `stopReason`. Last-write-wins; no-ops on a stale epoch (STOP-01).
 */
export function agentEndCacheHandler(capturedEpoch: number): (event: AgentEndEvent) => void {
  return (event) => {
    if (capturedEpoch !== currentEpoch()) {
      return;
    }

    cachedLastAssistant = findLastAssistant(event.messages);
  };
}

/**
 * `agent_settled` dispatcher: reads the cached last assistant message and
 * gates on `stopReason` (STOP-01). `stop` runs the Stop bucket and re-enters
 * the agent loop on a blocking hook (STOP-03); `error` / `length` route to the
 * StopFailure observation-only arm (SFAIL-01); `aborted` / `toolUse` are a
 * defensive no-op. No-ops on a stale epoch or an empty cache.
 */
export function settleHandlerFor(
  capturedEpoch: number,
  pi: ExtensionAPI,
): (event: AgentSettledEvent, ctx: ExtensionContext) => Promise<void> {
  return async (_event, ctx) => {
    if (capturedEpoch !== currentEpoch()) {
      return;
    }

    // One-shot consumption: clear the cache so a spurious second `agent_settled`
    // without an intervening `agent_end` no-ops instead of reprocessing the same
    // (stale) message. Each legitimate re-entry produces a fresh `agent_end`
    // that repopulates the cache, so this does not break the block loop.
    const last = cachedLastAssistant;
    cachedLastAssistant = undefined;
    if (last === undefined) {
      return;
    }

    switch (last.stopReason) {
      case "stop":
        await runStopBucket(last, capturedEpoch, ctx, pi);
        return;
      case "error":
      case "length":
        await runStopFailure(
          last,
          classifyStopFailure(last.errorMessage ?? "", last.stopReason),
          ctx,
          pi,
        );
        return;
      case "aborted":
      case "toolUse":
        return;
      default: {
        // Compile-time exhaustiveness pin (NFR-7): a peer-dep bump that widens
        // `StopReason` becomes a type error here. At runtime the unknown ending
        // is debug-logged and dropped -- the settle handler never throws.
        const unknownStopReason: never = last.stopReason;
        hookDebugLog(`settle: unknown stopReason ${JSON.stringify(unknownStopReason)}; dropped`);
        return;
      }
    }
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

/**
 * Run the Stop bucket and adapt the collected outcomes over the full
 * `HookExecResult` union (STOP-03..06). Because D-88-05 makes Stop precedence
 * AGGREGATE (any `continue:false` suppresses re-entry regardless of another
 * hook's block), the bucket is collected without the first-block/stop
 * short-circuit `reduceBucket` uses, then scanned:
 *
 *   1. any `stop` (continue:false) among the group -> no re-entry (STOP-06).
 *   2. else the first `block` -> re-enter with the reason (STOP-03; exit-2
 *      already maps to `{kind:"block",reason:stderr}` in `parseHookStdout`, so
 *      STOP-04 rides this arm with no Stop-specific exit handling).
 *   3. else the first `mutate` carrying `additionalContext` -> re-enter with
 *      that context (STOP-05), via the SAME lane as a block.
 *   4. else nothing (`noop`).
 *
 * Re-entry uses `sendMessage({deliverAs:"followUp", triggerTurn:true})` (the
 * agent is idle at settle, so `triggerTurn` starts the new turn),
 * display-suppressed. A Stop hook declaring `asyncRewake:true` cannot yield a
 * synchronous decision and is degraded to `noop` inside `collectBucketOutcomes`
 * with a `hookDebugLog` -- no silent block loss.
 *
 * The epoch is re-checked AFTER the bucket's hooks finish: hook subprocesses
 * can outlive a `/reload`, and the entry-time guard in `settleHandlerFor` only
 * covers the pre-await window. Without the re-check, the stale continuation
 * would mutate the freshly reset loop state and inject a re-entry turn into
 * the new session.
 */
async function runStopBucket(
  last: AssistantMessage,
  capturedEpoch: number,
  ctx: ExtensionContext,
  pi: ExtensionAPI,
): Promise<void> {
  const bucket = getRoutingBucket("Stop");
  if (bucket.length === 0) {
    return;
  }

  const event: StopEvent = {
    last_assistant_message: renderAssistantText(last),
    // STOP-07: the NEXT Stop payload after a bridge re-entry carries
    // `stop_hook_active: true` so the hook can see it is running inside a
    // bridge-driven continuation loop.
    stop_hook_active: stopHookActive,
  };
  const outcomes = await collectBucketOutcomes(bucket, event, ctx, pi, () => true);

  // A /reload while the bucket's hooks were running bumped the epoch and reset
  // the settle state; bail before any loop-state mutation or re-entry.
  if (capturedEpoch !== currentEpoch()) {
    return;
  }

  // STOP-06 / D-88-05: any continue:false suppresses re-entry. This is a
  // non-re-entry outcome, so it resets the consecutive re-entry counter
  // (D-88-08).
  const stop = outcomes.find((o) => o.result.kind === "stop");
  if (stop?.result.kind === "stop") {
    hookDebugLog(
      `settle: continue:false from ${stop.entry.pluginId} suppresses Stop re-entry; ` +
        `stopReason=${stop.result.stopReason ?? "<none>"}`,
    );
    resetConsecutiveBlockState();
    return;
  }

  // STOP-03 / STOP-04: first block wins. Re-entry funnels through the shared
  // bounded lane so it counts toward the STOP-07 cap (D-88-08).
  const block = outcomes.find((o) => o.result.kind === "block");
  if (block?.result.kind === "block") {
    reenterBounded(pi, ctx, block.result.reason ?? "", block.entry.pluginId);
    return;
  }

  // STOP-05: additionalContext-without-block re-enters through the SAME bounded
  // lane as a block (D-88-08) -- it counts toward the cap and does NOT reset the
  // counter, so a pure-additionalContext loop is bounded just like a block loop.
  const mutate = outcomes.find(
    (o) => o.result.kind === "mutate" && typeof o.result.additionalContext === "string",
  );
  if (mutate?.result.kind === "mutate" && mutate.result.additionalContext !== undefined) {
    reenterBounded(pi, ctx, mutate.result.additionalContext, mutate.entry.pluginId);
    return;
  }

  // noop: the agent genuinely settled with no continuing hook -- a non-re-entry
  // outcome that resets the counter (D-88-08).
  resetConsecutiveBlockState();
}

/**
 * Run the StopFailure bucket observation-only (SFAIL-01). Reached on `error` /
 * `length` settle endings. Builds the synthetic StopFailure event
 * (`error` = the classified error type; `last_assistant_message` = Pi's
 * rendered `errorMessage`, or "" when absent) and runs every hook whose
 * error-type matcher admits the classified error (SFAIL-03; match-all `""` /
 * `"*"` admits every type) with no short-circuit, then DISCARDS the collected
 * outcomes: StopFailure carries no decision control, so a blocking hook or an
 * exit-2 hook produces no re-entry and no loop-state mutation, and it cannot
 * suppress its peer observers. `stopHookActive`, the consecutive-block counter,
 * and `sendMessage` are never touched on this path. An empty bucket is a no-op.
 */
async function runStopFailure(
  last: AssistantMessage,
  classifiedError: StopFailureErrorType,
  ctx: ExtensionContext,
  pi: ExtensionAPI,
): Promise<void> {
  const bucket = getRoutingBucket("StopFailure");
  if (bucket.length === 0) {
    return;
  }

  const event: StopFailureEvent = {
    error: classifiedError,
    last_assistant_message: last.errorMessage ?? "",
  };

  // SFAIL-01: observation-only -- run every matching hook for its side effects
  // via the no-short-circuit walker, then discard the collected outcomes. A
  // reducing walk would `return` on a leading block/stop/exit-2 and starve the
  // later observers; StopFailure has no decision lane, so every matching hook
  // must get to observe the failure.
  //
  // SFAIL-03: the parse-time gate admits only match-all (`""` / `"*"`) and
  // exact members of the closed error-type vocabulary, so the dispatch filter
  // is literal equality against the classified error (the shared
  // `matcherFiresOnClosedSetValue` predicate).
  await collectBucketOutcomes(bucket, event, ctx, pi, (entry) =>
    matcherFiresOnClosedSetValue(entry, classifiedError),
  );
}

/**
 * STOP-07 bounded re-entry bookkeeping shared by BOTH re-entry lanes -- a
 * `block` continuation and an `additionalContext`-without-block continuation
 * (D-88-08). Increments the shared consecutive re-entry counter BEFORE deciding
 * whether to re-enter: the `STOP_OVERRIDE_CAP`th consecutive re-entry (the 8th)
 * does NOT re-enter and instead fires the one-shot override-cap warning (guarded
 * by `capNotifiedThisSession` so a subsequent re-entry does not re-notify). Any
 * re-entry below the cap sets `stopHookActive` -- the continuation is
 * bridge-driven regardless of lane (D-88-08) -- and re-enters (STOP-03; exit-2
 * already maps to `{kind:"block"}` in `parseHookStdout`, so STOP-04 rides this
 * arm). The cap is the T-88-02 livelock mitigation: an always-continuing hook,
 * whether via block or additionalContext, is bounded to 7 re-entries then
 * surfaced, never spun unbounded and never suppressed without notice
 * (transparency, D-88-01).
 */
function reenterBounded(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  content: string,
  pluginId: string,
): void {
  consecutiveBlockCount += 1;

  if (consecutiveBlockCount >= STOP_OVERRIDE_CAP) {
    if (!capNotifiedThisSession) {
      notifyStopHookOverrideCap(ctx, pluginId);
      capNotifiedThisSession = true;
    }

    return;
  }

  stopHookActive = true;
  reenter(pi, content, pluginId);
}

/**
 * Re-enter the idle agent loop with `content` as a display-suppressed followUp
 * message that triggers a new turn. Wrapped in try/catch so a `sendMessage`
 * throw degrades to a `hookDebugLog` rather than escaping the settle handler.
 */
function reenter(pi: ExtensionAPI, content: string, pluginId: string): void {
  try {
    pi.sendMessage(
      {
        customType: STOP_BLOCK_CUSTOM_TYPE,
        content,
        display: false,
        details: { pluginId },
      },
      { deliverAs: "followUp", triggerTurn: true },
    );
  } catch (err) {
    hookDebugLog(`settle: sendMessage threw (${pluginId}): ${errorMessage(err)}`);
  }
}

/**
 * Test inspector for the cached last-assistant cell. NOT re-exported from
 * `bridges/hooks/index.ts`.
 */
export function _peekSettleCacheForTest(): AssistantMessage | undefined {
  return cachedLastAssistant;
}

/**
 * Test inspector for the STOP-07 loop-protection cells. NOT re-exported from
 * `bridges/hooks/index.ts`.
 */
export function _peekLoopStateForTest(): {
  readonly stopHookActive: boolean;
  readonly consecutiveBlockCount: number;
  readonly capNotifiedThisSession: boolean;
} {
  return { stopHookActive, consecutiveBlockCount, capNotifiedThisSession };
}

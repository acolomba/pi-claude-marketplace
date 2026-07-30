// bridges/hooks/settle.ts
//
// Settle-time dispatcher for the turn-boundary hook events. Pi emits
// `agent_settled` once per logical completion carrying no payload, so this
// module caches the last assistant message from the preceding
// `agent_end.messages` and gates dispatch on its `stopReason` (STOP-01):
// `stop` runs the Stop bucket with full decision control (STOP-03 block
// re-entry); `error` / `length` route to StopFailure (observation-only,
// filled in a later plan); `aborted` and `toolUse` dispatch nothing.
//
// Both handlers carry the `capturedEpoch` guard so a stale closure from a
// prior `/reload` cannot fire against rebuilt routing tables;
// `resetSettleState` clears the cache cell in `registerHooksBridge` for the
// same reason.

import { hookDebugLog } from "../../shared/debug-log.ts";
import { errorMessage } from "../../shared/errors.ts";

import { collectBucketOutcomes } from "./dispatch.ts";
import { currentEpoch, getRoutingBucket } from "./event-router.ts";

import type { StopEvent } from "./payloads/stop.ts";
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

// The last assistant message observed on the most recent `agent_end`, read at
// settle time for its `stopReason`. Last-write-wins across auto-retry /
// compaction chains; reset on every bridge load for `/reload` hygiene.
let cachedLastAssistant: AssistantMessage | undefined;

/**
 * Reset the settle module-state cells. Called from `registerHooksBridge` so a
 * `/reload` cannot leak a stale cached message into the new session.
 */
export function resetSettleState(): void {
  cachedLastAssistant = undefined;
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
 * StopFailure observation arm (a later plan); `aborted` / `toolUse` are a
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

    const last = cachedLastAssistant;
    if (last === undefined) {
      return;
    }

    switch (last.stopReason) {
      case "stop":
        await runStopBucket(last, ctx, pi);
        return;
      case "error":
      case "length":
        // StopFailure observation-only arm lands in a later plan.
        return;
      case "aborted":
      case "toolUse":
        return;
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
 * with a `hookDebugLog` -- no silent block loss (research A5).
 */
async function runStopBucket(
  last: AssistantMessage,
  ctx: ExtensionContext,
  pi: ExtensionAPI,
): Promise<void> {
  const bucket = getRoutingBucket("Stop");
  if (bucket.length === 0) {
    return;
  }

  const event: StopEvent = {
    last_assistant_message: renderAssistantText(last),
    stop_hook_active: false,
  };
  const outcomes = await collectBucketOutcomes(bucket, event, ctx, pi, () => true);

  // STOP-06 / D-88-05: any continue:false suppresses re-entry.
  if (outcomes.some((o) => o.result.kind === "stop")) {
    return;
  }

  // STOP-03 / STOP-04: first block wins.
  const block = outcomes.find((o) => o.result.kind === "block");
  if (block?.result.kind === "block") {
    reenter(pi, block.result.reason ?? "", block.entry.pluginId);
    return;
  }

  // STOP-05: additionalContext-without-block re-enters via the same lane.
  const mutate = outcomes.find(
    (o) => o.result.kind === "mutate" && typeof o.result.additionalContext === "string",
  );
  if (mutate?.result.kind === "mutate" && mutate.result.additionalContext !== undefined) {
    reenter(pi, mutate.result.additionalContext, mutate.entry.pluginId);
  }
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

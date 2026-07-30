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

import { currentEpoch } from "./event-router.ts";

import type {
  AgentEndEvent,
  AgentMessage,
  AgentSettledEvent,
  AssistantMessage,
  ExtensionAPI,
  ExtensionContext,
} from "../../platform/pi-api.ts";

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

// Stop-bucket dispatch + block re-entry. Implementation lands in the
// implementation step of this tracer.
function runStopBucket(
  _last: AssistantMessage,
  _ctx: ExtensionContext,
  _pi: ExtensionAPI,
): Promise<void> {
  return Promise.resolve();
}

/**
 * Test inspector for the cached last-assistant cell. NOT re-exported from
 * `bridges/hooks/index.ts`.
 */
export function _peekSettleCacheForTest(): AssistantMessage | undefined {
  return cachedLastAssistant;
}

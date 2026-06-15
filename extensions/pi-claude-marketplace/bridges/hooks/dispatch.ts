// bridges/hooks/dispatch.ts
//
// Composite-handler bodies for the hooks bridge (D-59-01 / D-59-04 /
// DISP-01 / DISP-03 / DISP-04).
//
// Two exported factories:
//
//   - compositeHandlerFor(claudeEvent, capturedEpoch) returns the closure
//     registered on six of the seven Pi events (session_start,
//     session_shutdown, session_before_compact, session_compact, input,
//     tool_call). Each closure: epoch-checks, looks up the bucket for
//     `claudeEvent`, applies the per-event matcher-fires predicate, and
//     fans out sequentially to dispatchHookExec.
//
//   - toolResultCompositeHandler(capturedEpoch) returns the closure
//     registered on `tool_result`. ONE handler, TWO buckets: the body
//     reads `event.isError` once and routes to PostToolUseFailure or
//     PostToolUse before applying the same tool-name matcher + fan-out
//     (D-59-01).
//
// All handlers short-circuit when capturedEpoch != currentEpoch() so a
// stale closure from a prior load cannot fire against the live routing
// tables (DISP-03 zombie-defense belt-and-suspenders).

import { dispatchHookExec } from "./dispatch-exec.ts";
import { currentEpoch, getRoutingBucket, type RoutingEntry } from "./event-router.ts";

import type { BucketAEvent } from "../../domain/components/hook-events.ts";
import type { ParsedMatcher } from "../../domain/components/hooks.ts";
import type {
  ExtensionContext,
  InputEvent,
  SessionBeforeCompactEvent,
  SessionCompactEvent,
  SessionShutdownEvent,
  SessionStartEvent,
  ToolCallEvent,
  ToolResultEvent,
} from "../../platform/pi-api.ts";

/**
 * Indirection seam: tests swap in a spy via `_setExecutorForTest` while
 * production code keeps the imported `dispatchHookExec` reference. The
 * indirection exists because ESM imports are read-only bindings -- a unit
 * test cannot mock the imported symbol directly. The seam is bridge-internal
 * and not re-exported via index.ts.
 */
type HookExecutor = typeof dispatchHookExec;

let activeExecutor: HookExecutor = dispatchHookExec;

/**
 * Inject a spy executor for the duration of one unit test. Not part of
 * the public surface.
 */
export function _setExecutorForTest(executor: HookExecutor): void {
  activeExecutor = executor;
}

/**
 * Reset the executor seam back to the production `dispatchHookExec`. Used
 * by tests to undo their spy injection in cleanup.
 */
export function _resetExecutorForTest(): void {
  activeExecutor = dispatchHookExec;
}

// ──────────────────────────────────────────────────────────────────────────
// Matcher-fires predicates
// ──────────────────────────────────────────────────────────────────────────

/**
 * Tool-event matcher-fires predicate. Compares the parsed matcher's
 * piTools set against Pi's runtime `event.toolName` (lowercase literal).
 * The parser already filters regex/unmapped matchers at parse time so
 * those arms are unreachable at dispatch; defensive `false` keeps the
 * switch exhaustive.
 */
function matcherFiresOnToolEvent(matcher: ParsedMatcher, toolName: string): boolean {
  switch (matcher.kind) {
    case "match-all":
      return true;
    case "tool-set":
      return matcher.piTools.has(toolName as never);
    case "mcp-literal":
      return matcher.literal === toolName;
    case "regex":
    case "unmapped":
      return false;
  }
}

/**
 * SessionStart matcher-fires predicate. The parser already narrows the
 * closed set to `{startup, resume}` at parse time, so by the time an
 * entry lands in the SessionStart bucket the rawMatcher is one of `""`,
 * `"*"`, `"startup"`, `"resume"`. Match-all admits every reason; a
 * literal-token matcher fires only on equality.
 */
function matcherFiresOnSessionStart(entry: RoutingEntry, reason: string): boolean {
  const raw = entry.rawMatcher;
  return raw === "" || raw === "*" || raw === reason;
}

// ──────────────────────────────────────────────────────────────────────────
// Composite-handler factories
// ──────────────────────────────────────────────────────────────────────────

/**
 * Six-uniform composite handler factory. Returns a closure that fans out
 * to the per-event bucket, applying the per-event matcher-fires predicate
 * before each `dispatchHookExec`. DISP-03 epoch check at entry; DISP-04
 * sequential awaited fan-out (no Promise.all).
 *
 * `claudeEvent` constrains which bucket the closure reads. The runtime
 * `event` is typed as `unknown` because each Pi event has a distinct
 * payload shape; the per-event filter narrows at access time.
 */
export function compositeHandlerFor<
  E extends Exclude<BucketAEvent, "PostToolUse" | "PostToolUseFailure">,
>(
  claudeEvent: E,
  capturedEpoch: number,
): (event: CompositeEventFor<E>, ctx: ExtensionContext) => Promise<void> {
  return async (event, ctx) => {
    if (capturedEpoch !== currentEpoch()) {
      return;
    }

    const bucket = getRoutingBucket(claudeEvent);
    if (bucket.length === 0) {
      return;
    }

    for (const entry of bucket) {
      if (!entryFires(claudeEvent, entry, event)) {
        continue;
      }

      await activeExecutor(entry, event, ctx);
    }
  };
}

/**
 * D-59-01: `tool_result` composite handler. Reads `event.isError` once,
 * picks the PostToolUseFailure bucket on truthy or PostToolUse on
 * falsy/undefined, then applies the tool-name matcher and fans out
 * sequentially. DISP-03 epoch check at entry; DISP-04 sequential awaited
 * fan-out.
 */
export function toolResultCompositeHandler(
  capturedEpoch: number,
): (event: ToolResultEvent, ctx: ExtensionContext) => Promise<void> {
  return async (event, ctx) => {
    if (capturedEpoch !== currentEpoch()) {
      return;
    }

    const claudeEvent: BucketAEvent = event.isError ? "PostToolUseFailure" : "PostToolUse";
    const bucket = getRoutingBucket(claudeEvent);
    if (bucket.length === 0) {
      return;
    }

    for (const entry of bucket) {
      if (!matcherFiresOnToolEvent(entry.matcher, event.toolName)) {
        continue;
      }

      await activeExecutor(entry, event, ctx);
    }
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Internal: per-event filter dispatch
// ──────────────────────────────────────────────────────────────────────────

/**
 * Type bridge: each non-tool-result Claude event maps to its Pi payload
 * shape so the composite-handler factory's closure signature narrows
 * appropriately. Tool-call and SessionStart carry shape-specific fields the
 * filter logic accesses; the other four are typed as their own Pi
 * interfaces for forward-compat.
 */
type CompositeEventFor<E extends BucketAEvent> = E extends "SessionStart"
  ? SessionStartEvent
  : E extends "SessionEnd"
    ? SessionShutdownEvent
    : E extends "PreCompact"
      ? SessionBeforeCompactEvent
      : E extends "PostCompact"
        ? SessionCompactEvent
        : E extends "UserPromptSubmit"
          ? InputEvent
          : E extends "PreToolUse"
            ? ToolCallEvent
            : never;

/**
 * Per-event filter dispatch. Routes to the per-event matcher-fires
 * predicate; the four no-filter events (UserPromptSubmit, SessionEnd,
 * PreCompact, PostCompact) fire unconditionally because the parser
 * already rejects non-empty matchers on those events at parse time.
 */
function entryFires(
  claudeEvent: Exclude<BucketAEvent, "PostToolUse" | "PostToolUseFailure">,
  entry: RoutingEntry,
  event: unknown,
): boolean {
  switch (claudeEvent) {
    case "SessionStart": {
      const reason = (event as SessionStartEvent).reason;
      return matcherFiresOnSessionStart(entry, reason);
    }

    case "PreToolUse": {
      const toolName = (event as ToolCallEvent).toolName;
      return matcherFiresOnToolEvent(entry.matcher, toolName);
    }

    case "SessionEnd":
    case "PreCompact":
    case "PostCompact":
    case "UserPromptSubmit":
      return true;
  }
}

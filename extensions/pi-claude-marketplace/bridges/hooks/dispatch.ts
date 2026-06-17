// bridges/hooks/dispatch.ts
//
// Composite-handler bodies for the hooks bridge (D-59-01 / D-59-04 /
// D-60-02 / D-60-03 / DISP-01 / DISP-03 / DISP-04 / OBS-01).
//
// Two exported factories:
//
//   - compositeHandlerFor(claudeEvent, capturedEpoch) returns the closure
//     registered on six of the seven Pi events (session_start,
//     session_shutdown, session_before_compact, session_compact, input,
//     tool_call). Each closure: epoch-checks, looks up the bucket for
//     `claudeEvent`, applies the per-event matcher-fires predicate, runs
//     the D-60-02 reducer over `await activeExecutor(...)` calls, then
//     hands the folded `HookExecResult` to the per-Pi-event adapter
//     (D-60-03) which converts it to the Pi-side handler return shape.
//
//   - toolResultCompositeHandler(capturedEpoch) returns the closure
//     registered on `tool_result`. ONE handler, TWO buckets: the body
//     reads `event.isError` once and routes to PostToolUseFailure or
//     PostToolUse (D-59-01 / DISP-01) BEFORE the reducer loop runs.
//
// D-60-02 reducer semantics:
//   - first-block-wins: on `kind: "block"`, finalResult is captured and
//     the bucket short-circuits -- subsequent entries' executors are NOT
//     invoked.
//   - terminal stop: on `kind: "stop"`, finalResult is captured and the
//     bucket short-circuits.
//   - mutate composition: on `kind: "mutate"`, applyMutationInPlace
//     mutates the Pi event in place so the NEXT entry's executor (which
//     re-translates) sees the post-mutation state. finalResult stays at
//     the prior noop / mutate.
//   - noop: continue to the next entry without changing finalResult.
//   - assertNever default arm pins exhaustiveness (NFR-7).
//
// All handlers short-circuit when capturedEpoch != currentEpoch() so a
// stale closure from a prior load cannot fire against the live routing
// tables (DISP-03 zombie-defense belt-and-suspenders). Sequential
// awaited fan-out preserved (DISP-04) -- early-exit on block is
// compatible because DISP-04 pins sequential ordering, not
// every-entry-must-run.

import { dispatchHookExec } from "./dispatch-exec.ts";
import {
  adaptInputResult,
  adaptObservationResultForEvent,
  adaptToolCallResult,
  adaptToolResultResult,
  applyMutationInPlace,
} from "./event-adapters.ts";
import { currentEpoch, getRoutingBucket, type RoutingEntry } from "./event-router.ts";
import { assertNever, type HookExecResult } from "./exec-result.ts";
import { ifFires } from "./if-field/index.ts";

import type { BucketAEvent } from "../../domain/components/hook-events.ts";
import type { ParsedMatcher } from "../../domain/components/hooks.ts";
import type {
  ExtensionAPI,
  ExtensionContext,
  InputEvent,
  InputEventResult,
  SessionBeforeCompactEvent,
  SessionCompactEvent,
  SessionShutdownEvent,
  SessionStartEvent,
  ToolCallEvent,
  ToolCallEventResult,
  ToolResultEvent,
  ToolResultEventResult,
} from "../../platform/pi-api.ts";

/**
 * Indirection seam: tests swap in a spy via `_setExecutorForTest` while
 * production code keeps the imported `dispatchHookExec` reference. The
 * indirection exists because ESM imports are read-only bindings -- a unit
 * test cannot mock the imported symbol directly. The seam is bridge-internal
 * and not re-exported via index.ts.
 *
 * D-59-04 signature evolution: the executor now returns
 * `Promise<HookExecResult>` so the reducer below can fold outcomes across
 * a bucket. The DISP-04 stub previously returned `Promise<void>`; spy
 * fixtures in the existing test files have already been updated to
 * resolve `{ kind: "noop" }` per the evolved seam.
 */
type HookExecutor = (
  entry: RoutingEntry,
  event: unknown,
  ctx: ExtensionContext,
  pi?: ExtensionAPI,
) => Promise<HookExecResult>;

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
// D-60-02 reducer
// ──────────────────────────────────────────────────────────────────────────

/**
 * D-60-02: fold a sequence of HookExecResult outcomes across the
 * routing bucket. Returns the final reduced outcome.
 *
 * Loop semantics:
 *   - `block`     -> capture as finalResult; break (first-block-wins).
 *   - `stop`      -> capture as finalResult; break (terminal).
 *   - `mutate`    -> applyMutationInPlace mutates `event` so the NEXT
 *                    entry's executor sees the post-mutation state;
 *                    finalResult stays at the prior outcome (a mutate is
 *                    not, by itself, a terminal Pi-side return).
 *   - `noop`      -> continue.
 *
 * Caller controls bucket selection + per-entry matcher filter; this
 * reducer just walks the pre-filtered entry list.
 */
async function reduceBucket(
  bucket: ReadonlyArray<RoutingEntry>,
  event: unknown,
  ctx: ExtensionContext,
  pi: ExtensionAPI | undefined,
  matcherFires: (entry: RoutingEntry) => boolean,
): Promise<HookExecResult> {
  let finalResult: HookExecResult = { kind: "noop" };
  for (const entry of bucket) {
    if (!matcherFires(entry)) {
      continue;
    }

    // MATCH-03 / D-61-02: AND composition with the group-level matcher.
    // if-no-match -> continue (skip entry), NOT block.
    if (!ifFires(entry.ifPredicate, event, ctx, entry.claudeEvent)) {
      continue;
    }

    const r = await activeExecutor(entry, event, ctx, pi);
    switch (r.kind) {
      case "block":
        finalResult = r;
        return finalResult;
      case "stop":
        finalResult = r;
        return finalResult;
      case "mutate":
        applyMutationInPlace(event, r);
        // D-60-03: mutate also becomes the running finalResult so the
        // per-event adapter at exit can consume it. The Input adapter
        // converts `mutate.additionalContext` into `{ action:
        // "transform", text }` (the Pi-side return value for the input
        // event family) -- this requires the reducer to carry the
        // mutate forward, not drop it after the in-place patch. For
        // tool_call / tool_result, the adapter's mutate arm is a
        // double-counting no-op against the already-mutated event
        // (applyMutationInPlace is idempotent on identical patches).
        finalResult = r;
        continue;
      case "noop":
        continue;
      default:
        return assertNever(r);
    }
  }

  return finalResult;
}

// ──────────────────────────────────────────────────────────────────────────
// Composite-handler factories
// ──────────────────────────────────────────────────────────────────────────

/**
 * D-59-01 / D-60-02 / D-60-03: six-uniform composite handler factory.
 *
 * `claudeEvent` constrains which bucket the closure reads and which
 * per-Pi-event adapter narrows the reducer's final result. The runtime
 * `event` is typed via `CompositeEventFor<E>` so each closure exposes
 * the Pi-shape its registration point expects; the per-event filter
 * narrows the matcher-fires path at access time.
 *
 * Return type: `CompositeReturnFor<E>` -- the Pi-side handler return
 * shape selected by the adapter table (tool_call returns
 * `ToolCallEventResult | undefined`; input returns `InputEventResult |
 * undefined`; observation events return `undefined`).
 */
export function compositeHandlerFor<
  E extends Exclude<BucketAEvent, "PostToolUse" | "PostToolUseFailure">,
>(
  claudeEvent: E,
  capturedEpoch: number,
  pi?: ExtensionAPI,
): (event: CompositeEventFor<E>, ctx: ExtensionContext) => Promise<CompositeReturnFor<E>> {
  return async (event, ctx) => {
    if (capturedEpoch !== currentEpoch()) {
      return undefined as CompositeReturnFor<E>;
    }

    const bucket = getRoutingBucket(claudeEvent);
    if (bucket.length === 0) {
      return undefined as CompositeReturnFor<E>;
    }

    const finalResult = await reduceBucket(bucket, event, ctx, pi, (entry) =>
      entryFires(claudeEvent, entry, event),
    );

    return adaptForEvent(claudeEvent, finalResult, event) as CompositeReturnFor<E>;
  };
}

/**
 * D-59-01 / D-60-02 / D-60-03: `tool_result` composite handler. Reads
 * `event.isError` once, picks the PostToolUseFailure bucket on truthy or
 * PostToolUse on falsy/undefined, then runs the D-60-02 reducer over the
 * bucket. DISP-01 (event.isError split) happens BEFORE the reducer loop;
 * DISP-03 epoch check at entry; DISP-04 sequential awaited fan-out.
 *
 * Returns `ToolResultEventResult | undefined` via
 * `adaptToolResultResult` (D-60-03).
 */
export function toolResultCompositeHandler(
  capturedEpoch: number,
  pi?: ExtensionAPI,
): (event: ToolResultEvent, ctx: ExtensionContext) => Promise<ToolResultEventResult | undefined> {
  return async (event, ctx) => {
    if (capturedEpoch !== currentEpoch()) {
      return undefined;
    }

    const claudeEvent: BucketAEvent = event.isError ? "PostToolUseFailure" : "PostToolUse";
    const bucket = getRoutingBucket(claudeEvent);
    if (bucket.length === 0) {
      return undefined;
    }

    const finalResult = await reduceBucket(bucket, event, ctx, pi, (entry) =>
      matcherFiresOnToolEvent(entry.matcher, event.toolName),
    );

    return adaptToolResultResult(finalResult, event);
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Per-Pi-event adapter dispatch (D-60-03)
// ──────────────────────────────────────────────────────────────────────────

/**
 * D-60-03: dispatch the reducer's final HookExecResult to the matching
 * per-Pi-event adapter. Observation events have no Pi-side return slot
 * -- their adapter is invoked for the block/stop debug-log side effect
 * and always returns undefined.
 */
function adaptForEvent(
  claudeEvent: Exclude<BucketAEvent, "PostToolUse" | "PostToolUseFailure">,
  result: HookExecResult,
  event: unknown,
): ToolCallEventResult | InputEventResult | undefined {
  switch (claudeEvent) {
    case "PreToolUse":
      return adaptToolCallResult(result, event as ToolCallEvent);
    case "UserPromptSubmit":
      return adaptInputResult(result, event as InputEvent);
    case "SessionStart":
    case "SessionEnd":
    case "PreCompact":
    case "PostCompact":
      // adaptObservationResultForEvent narrows the silent-drop arms by
      // claudeEvent so a SessionStart mutate.additionalContext can be
      // captured into event-router.ts's pending buffer (drained by the
      // before_agent_start handler on the next agent turn).
      adaptObservationResultForEvent(result, claudeEvent);
      return undefined;
  }
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
 * D-60-03: per-event return type bridge mapping each composite-handler
 * `claudeEvent` to the Pi-side handler return shape its registered
 * closure must produce. PreToolUse -> ToolCallEventResult;
 * UserPromptSubmit -> InputEventResult; the four observation events ->
 * undefined (Pi handler return slot is void for those).
 */
type CompositeReturnFor<E extends BucketAEvent> = E extends "PreToolUse"
  ? ToolCallEventResult | undefined
  : E extends "UserPromptSubmit"
    ? InputEventResult | undefined
    : undefined;

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

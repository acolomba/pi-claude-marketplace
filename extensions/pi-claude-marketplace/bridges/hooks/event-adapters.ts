// bridges/hooks/event-adapters.ts
//
// D-60-03: per-Pi-event adapters that convert a reducer-folded
// `HookExecResult` (D-60-01) into the Pi-side handler return shape.
//
// Four adapters cover the v1.13 Bucket-A surface:
//
//   - adaptToolCallResult        -> Pi `tool_call` (PreToolUse).
//     `block` → `{ block: true, reason }`; `mutate.updatedInput` mutates
//     `event.input` in place + returns `undefined`; `stop` debug-logs the
//     ignored outcome + returns `undefined`; `noop` returns `undefined`.
//
//   - adaptToolResultResult      -> Pi `tool_result` (PostToolUse +
//     PostToolUseFailure). `block` → `{ block: true, reason }`;
//     `mutate.updatedToolOutput` mutates the runtime-side surface
//     (`event.content` for Pi `tool_result`) in place + returns
//     `undefined`; `stop` debug-logs + returns `undefined`; `noop` returns
//     `undefined`.
//
//   - adaptInputResult           -> Pi `input` (UserPromptSubmit).
//     `block` → `{ action: "handled" }`; `mutate.additionalContext` (when
//     defined) → `{ action: "transform", text }`; `mutate` without an
//     `additionalContext` field → `undefined`; `stop` debug-logs + returns
//     `undefined`; `noop` returns `undefined`.
//
//   - adaptObservationResult     -> Pi `session_start` /
//     `session_shutdown` / `session_before_compact` / `session_compact`
//     (SessionStart / SessionEnd / PreCompact / PostCompact). Observation-
//     only: `block` and `stop` debug-log the dropped reason and return
//     `undefined`; the Pi event surface has no return slot. NEVER notify.
//     NEVER throw.
//
// Exhaustiveness gate: each adapter exhaustively switches on `result.kind`
// and calls `assertNever` on the impossible default arm (NFR-7). Adding a
// fifth `HookExecResult` arm would fail `tsc` at the call site.
//
// Mutation surface: tool_call mutates `event.input` (Record<string,
// unknown>), tool_result mutates `event.content` (the Pi-side
// (TextContent | ImageContent)[] array). The `applyMutationInPlace`
// helper colocates the two mutation paths so dispatch.ts's reducer loop
// has a single call site between iterations.

import { hookDebugLog } from "../../shared/debug-log.ts";

import { assertNever, type HookExecResult } from "./exec-result.ts";

import type {
  InputEvent,
  InputEventResult,
  ToolCallEvent,
  ToolCallEventResult,
  ToolResultEvent,
  ToolResultEventResult,
} from "../../platform/pi-api.ts";

// ──────────────────────────────────────────────────────────────────────────
// Mutation helper (D-60-02 / D-60-03)
// ──────────────────────────────────────────────────────────────────────────

/**
 * D-60-02 / D-60-03: apply a `mutate` outcome to the Pi event in place so
 * the next reducer iteration's translator sees the post-mutation state.
 *
 * Discriminator is the runtime `event.type` field (Pi events carry a
 * literal `type` tag). Only tool_call and tool_result have a mutation
 * surface in v1.13; input's `additionalContext` flows through the
 * adapter's return value (not in-place mutation), and observation events
 * have no mutation surface at all.
 *
 * The mutate arm's optional fields are silently ignored when the matching
 * surface is not present (e.g., `updatedToolOutput` on a tool_call event)
 * -- mirrors Claude Code upstream's documented per-event field
 * applicability.
 */
export function applyMutationInPlace(
  event: unknown,
  result: Extract<HookExecResult, { kind: "mutate" }>,
): void {
  if (event === null || typeof event !== "object") {
    return;
  }

  const tagged = event as { type?: unknown };
  if (tagged.type === "tool_call" && result.updatedInput !== undefined) {
    const target = (event as ToolCallEvent).input as Record<string, unknown>;
    const patch = result.updatedInput as Record<string, unknown>;
    Object.assign(target, patch);
    return;
  }

  if (tagged.type === "tool_result" && result.updatedToolOutput !== undefined) {
    // Pi's tool_result surface exposes the mutable content array directly;
    // dispatch a shallow merge onto the array's slot 0 textual block when
    // present, otherwise no-op (the per-translator contract documents how
    // the Claude-side `updatedToolOutput` JSON shape rides through).
    const target = event as ToolResultEvent;
    const patch = result.updatedToolOutput as Record<string, unknown>;
    Object.assign(target as unknown as Record<string, unknown>, patch);
  }
}

// ──────────────────────────────────────────────────────────────────────────
// adaptToolCallResult -- PreToolUse
// ──────────────────────────────────────────────────────────────────────────

/**
 * D-60-03: convert a reducer-folded `HookExecResult` to the Pi `tool_call`
 * handler return shape (`ToolCallEventResult | undefined`).
 *
 * Note: exactOptionalPropertyTypes is on, so an explicit
 * `reason: undefined` cannot be passed for an optional `reason?: string`
 * slot. The `reason` field is included only when defined.
 */
export function adaptToolCallResult(
  result: HookExecResult,
  event: ToolCallEvent,
): ToolCallEventResult | undefined {
  switch (result.kind) {
    case "block":
      return result.reason !== undefined ? { block: true, reason: result.reason } : { block: true };

    case "mutate":
      applyMutationInPlace(event, result);
      return undefined;

    case "stop":
      hookDebugLog(
        `adaptToolCall: stop ignored (no Pi return slot); reason=${result.stopReason ?? "<none>"}`,
      );
      return undefined;

    case "noop":
      return undefined;

    default:
      return assertNever(result);
  }
}

// ──────────────────────────────────────────────────────────────────────────
// adaptToolResultResult -- PostToolUse + PostToolUseFailure
// ──────────────────────────────────────────────────────────────────────────

/**
 * D-60-03: convert a reducer-folded `HookExecResult` to the Pi
 * `tool_result` handler return shape (`ToolResultEventResult | undefined`).
 *
 * `tool_result` exposes a `content` / `details` / `isError` return shape;
 * the bridge's `mutate.updatedToolOutput` path mutates `event` in place
 * (so the next entry sees the mutation), then returns `undefined`. A
 * `block` outcome returns a synthetic `{ isError: true }` envelope with
 * the reason routed through the surrounding error channel -- Pi's
 * `tool_result` return shape does not have a `block` field; this adapter
 * follows Claude Code upstream's PostToolUse `decision: "block"` semantics
 * by reporting the failure through `isError`.
 */
export function adaptToolResultResult(
  result: HookExecResult,
  event: ToolResultEvent,
): ToolResultEventResult | undefined {
  switch (result.kind) {
    case "block":
      // Pi `tool_result` has no `block` field; signal the block via
      // `isError: true` + a synthetic text block carrying the reason. The
      // reducer already short-circuited subsequent entries, so this is the
      // terminal Pi-side return for the bucket.
      return result.reason !== undefined
        ? {
            isError: true,
            content: [{ type: "text", text: result.reason }],
          }
        : { isError: true };

    case "mutate":
      applyMutationInPlace(event, result);
      return undefined;

    case "stop":
      hookDebugLog(
        `adaptToolResult: stop ignored (no Pi return slot); reason=${result.stopReason ?? "<none>"}`,
      );
      return undefined;

    case "noop":
      return undefined;

    default:
      return assertNever(result);
  }
}

// ──────────────────────────────────────────────────────────────────────────
// adaptInputResult -- UserPromptSubmit
// ──────────────────────────────────────────────────────────────────────────

/**
 * D-60-03: convert a reducer-folded `HookExecResult` to the Pi `input`
 * handler return shape (`InputEventResult | undefined`).
 *
 * The `_event` parameter is reserved for forward-compat (future per-event
 * narrowing); the v1.13 adapter does not read from it.
 */
export function adaptInputResult(
  result: HookExecResult,
  _event: InputEvent,
): InputEventResult | undefined {
  switch (result.kind) {
    case "block":
      return { action: "handled" };

    case "mutate":
      if (result.additionalContext !== undefined) {
        return { action: "transform", text: result.additionalContext };
      }

      return undefined;

    case "stop":
      hookDebugLog(
        `adaptInput: stop ignored (no Pi return slot); reason=${result.stopReason ?? "<none>"}`,
      );
      return undefined;

    case "noop":
      return undefined;

    default:
      return assertNever(result);
  }
}

// ──────────────────────────────────────────────────────────────────────────
// adaptObservationResult -- SessionStart / SessionEnd / PreCompact / PostCompact
// ──────────────────────────────────────────────────────────────────────────

/**
 * D-60-03: observation-only adapter for the four Pi session/compact
 * events. Pi's handler return slot for these events is `void` -- there is
 * nowhere to thread a `block` or a `mutate` outcome. The adapter
 * debug-logs the dropped reason for `block` and `stop` so the trail is
 * still visible under `PI_CLAUDE_MARKETPLACE_DEBUG=1`, then returns. The
 * adapter NEVER notifies and NEVER throws -- `assertNever` only fires when
 * the union grows a new arm, which is a compile-time failure.
 */
export function adaptObservationResult(result: HookExecResult): undefined {
  switch (result.kind) {
    case "block":
      hookDebugLog(
        `adaptObservation: block ignored (no Pi return slot); reason=${result.reason ?? "<none>"}`,
      );
      return undefined;

    case "mutate":
      // Observation events have no mutation surface -- silently drop.
      return undefined;

    case "stop":
      hookDebugLog(
        `adaptObservation: stop ignored (no Pi return slot); reason=${result.stopReason ?? "<none>"}`,
      );
      return undefined;

    case "noop":
      return undefined;

    default:
      return assertNever(result);
  }
}

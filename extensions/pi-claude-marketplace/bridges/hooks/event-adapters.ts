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
//     (`event.content` and/or `event.isError`) in place + returns
//     `undefined`; `stop` debug-logs + returns `undefined`; `noop` returns
//     `undefined`. CR-01: the mutation surface is whitelisted to
//     `{ content, isError }` -- a hook-supplied patch cannot rewrite
//     `event.type`, `event.toolName`, or any other field.
//
//   - adaptInputResult           -> Pi `input` (UserPromptSubmit).
//     `block` → `{ action: "handled" }`; `mutate.additionalContext` (when
//     defined) → `{ action: "transform", text }`; `mutate` without an
//     `additionalContext` field → `undefined`; `stop` debug-logs + returns
//     `undefined`; `noop` returns `undefined`.
//
//   - adaptObservationResultForEvent -> Pi `session_start` /
//     `session_shutdown` / `session_before_compact` / `session_compact`
//     (SessionStart / SessionEnd / PreCompact / PostCompact) with per-event
//     narrowing for the SessionStart `additionalContext` bridge. The
//     SessionStart mutate arm captures `additionalContext` into the
//     event-router.ts pending buffer (drained by the bridge's
//     `before_agent_start` handler on the next agent turn). All other
//     observation events keep the silent-drop semantics: there is no
//     downstream Pi surface to thread their payloads through. `block` and
//     `stop` debug-log the dropped reason and return `undefined`. NEVER
//     notify. NEVER throw.
//
//   - adaptObservationResult     -> legacy 4-arm silent-drop shim retained
//     for the architecture-level exhaustiveness gate and for any caller
//     that lacks a claudeEvent context. Production dispatch uses
//     adaptObservationResultForEvent instead.
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

import { appendPendingSessionStartContext } from "./event-router.ts";
import { assertNever, type HookExecResult } from "./exec-result.ts";

import type { BucketAEvent } from "../../domain/components/hook-events.ts";
import type {
  InputEvent,
  InputEventResult,
  ToolCallEvent,
  ToolCallEventResult,
  ToolResultEvent,
  ToolResultEventResult,
} from "../../platform/pi-api.ts";
import type { Scope } from "../../shared/types.ts";

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
    // CR-01: reject non-object patches (null / array / primitive) early so a
    // hook returning `updatedInput: null` cannot trip Object.assign's
    // null-source path or pollute via array index keys. The patch must be a
    // plain object shape; anything else is silently dropped.
    if (
      result.updatedInput === null ||
      typeof result.updatedInput !== "object" ||
      Array.isArray(result.updatedInput)
    ) {
      return;
    }

    const target = (event as ToolCallEvent).input as Record<string, unknown>;
    const patch = result.updatedInput as Record<string, unknown>;
    Object.assign(target, patch);
    return;
  }

  if (tagged.type === "tool_result" && result.updatedToolOutput !== undefined) {
    // CR-01: whitelist the documented mutation surface for tool_result --
    // only `content` (the Pi-side (TextContent | ImageContent)[] array) and
    // `isError` (boolean) may be written. Anything else in the hook-supplied
    // patch is silently dropped so a malicious or buggy hook cannot rewrite
    // the event's discriminator (`type`), `toolName`, or any other
    // routing-load-bearing field. Reject non-object patches early.
    if (result.updatedToolOutput === null || typeof result.updatedToolOutput !== "object") {
      return;
    }

    const target = event as ToolResultEvent;
    const patch = result.updatedToolOutput as { content?: unknown; isError?: unknown };
    if (Array.isArray(patch.content)) {
      (target as { content: unknown }).content = patch.content;
    }

    if (typeof patch.isError === "boolean") {
      (target as { isError: boolean }).isError = patch.isError;
    }
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
      return result.reason === undefined ? { block: true } : { block: true, reason: result.reason };

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
      return result.reason === undefined
        ? { isError: true }
        : {
            isError: true,
            content: [{ type: "text", text: result.reason }],
          };

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
// adaptObservationResultForEvent -- SessionStart / SessionEnd / PreCompact /
//                                   PostCompact (per-event narrowing)
// ──────────────────────────────────────────────────────────────────────────

/**
 * Observation-event adapter with per-event narrowing for the SessionStart
 * additionalContext bridge.
 *
 * Pi's lifecycle splits the upstream Claude Code SessionStart-hook contract
 * across two surfaces: `session_start` returns void, and
 * `before_agent_start` carries the `systemPrompt` chain Pi extensions use
 * to inject context into the next agent turn. The mutate-arm path here
 * captures `additionalContext` from a SessionStart event into the
 * `event-router.ts` pending buffer; the `beforeAgentStartHandlerFor`
 * closure drains the buffer on the next `before_agent_start` event.
 *
 * Per-event semantics:
 *
 *   - SessionStart:
 *       mutate.additionalContext -> appendPendingSessionStartContext()
 *       mutate without additionalContext -> drop (no upstream payload to carry)
 *       block / stop / noop -> debug-log (block/stop) and return undefined
 *
 *   - SessionEnd / PreCompact / PostCompact:
 *       all arms silently drop the additionalContext (and other mutate
 *       fields). No downstream drain point exists for these events under
 *       Pi's lifecycle: SessionEnd has no future turn; PreCompact /
 *       PostCompact interact with compaction summaries, not the session
 *       prompt. Deferred per D-60-03. `block` / `stop` are still
 *       debug-logged for observability.
 *
 * The adapter NEVER notifies and NEVER throws. `assertNever` only fires
 * when `HookExecResult` grows a new arm, which is a compile-time failure
 * at this call site (NFR-7).
 */
export function adaptObservationResultForEvent(
  result: HookExecResult,
  claudeEvent: Extract<BucketAEvent, "SessionStart" | "SessionEnd" | "PreCompact" | "PostCompact">,
  provenance: { readonly scope: Scope; readonly marketplace: string; readonly pluginId: string },
): undefined {
  switch (result.kind) {
    case "block":
      hookDebugLog(
        `adaptObservation: block ignored (no Pi return slot); event=${claudeEvent} reason=${result.reason ?? "<none>"}`,
      );
      return undefined;

    case "mutate":
      if (claudeEvent === "SessionStart" && typeof result.additionalContext === "string") {
        // Capture for drain at the next before_agent_start. The buffer is
        // drained one-shot by beforeAgentStartHandlerFor and cleared on
        // registerHooksBridge entry (so /reload does not leak stale
        // context across sessions).
        appendPendingSessionStartContext({
          context: result.additionalContext,
          scope: provenance.scope,
          marketplace: provenance.marketplace,
          pluginId: provenance.pluginId,
        });
      }

      // SessionEnd / PreCompact / PostCompact: no logical drain point for
      // additionalContext. Other mutate fields (updatedInput,
      // updatedToolOutput, permissionDecision) are not meaningful for
      // observation events either; the adapter silently drops them.
      return undefined;

    case "stop":
      hookDebugLog(
        `adaptObservation: stop ignored (no Pi return slot); event=${claudeEvent} reason=${result.stopReason ?? "<none>"}`,
      );
      return undefined;

    case "noop":
      return undefined;

    default:
      return assertNever(result);
  }
}

// ──────────────────────────────────────────────────────────────────────────
// adaptObservationResult -- legacy 4-arm silent-drop adapter
// ──────────────────────────────────────────────────────────────────────────

/**
 * D-60-03: legacy observation-only adapter that silently drops every
 * mutate-arm payload. Retained because (a) the architecture-level test
 * suite pins the 4-arm exhaustiveness gate here, and (b) callers that
 * have no claudeEvent context can still discharge the result through this
 * surface. Production dispatch routes through
 * `adaptObservationResultForEvent` instead so the SessionStart
 * additionalContext path can capture into the pending buffer.
 *
 * The adapter NEVER notifies and NEVER throws -- `assertNever` only fires
 * when the union grows a new arm, which is a compile-time failure.
 *
 * @internal Use `adaptObservationResultForEvent` in production dispatch
 *   paths. This shim only exists to anchor the 4-arm exhaustiveness
 *   architecture test; new call sites should pass the `claudeEvent`.
 */
export function adaptObservationResult(result: HookExecResult): undefined {
  switch (result.kind) {
    case "block":
      hookDebugLog(
        `adaptObservation: block ignored (no Pi return slot); reason=${result.reason ?? "<none>"}`,
      );
      return undefined;

    case "mutate":
      // Observation events have no mutation surface in the legacy shim --
      // silently drop. Use adaptObservationResultForEvent for the
      // SessionStart additionalContext capture path.
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

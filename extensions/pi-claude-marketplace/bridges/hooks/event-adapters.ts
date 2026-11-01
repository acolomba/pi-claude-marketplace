// bridges/hooks/event-adapters.ts
//
// D-60-03: per-Pi-event adapters that convert a folded `HookExecResult`
// (D-60-01) into the Pi-side handler return shape, as Claude Code 2.1.316
// applies a hook decision (D-CF5-11).
//
// Four adapters cover the Bucket-A surface:
//
//   - adaptToolCallResult        -> Pi `tool_call` (PreToolUse).
//     `block` -> `{ block: true, reason }`, the reason reading
//     `PreToolUse:<Tool> hook error: <message>`; `stop` -> a block with
//     `terminate: true`, which ends the turn; a mutation that asks blocks with
//     its reason when Pi has no terminal (`print`, `json`, `rpc`) and asks
//     through `ctx.ui.confirm` in `tui`; an allowed mutation's `updatedInput`
//     replaces the tool's whole input; `noop` returns `undefined`.
//
//   - adaptToolResultResult      -> Pi `tool_result` (PostToolUse +
//     PostToolUseFailure). `block` keeps the tool's output and adds the
//     hook's feedback, `<Event>:<Tool> hook blocking error from command:
//     "<command>": <message>`, without marking the result an error;
//     `mutate.updatedToolOutput` returns its `content` and/or `isError` as
//     Pi's `tool_result` value, since Pi keeps only returned changes;
//     `stop` debug-logs + returns `undefined` (Pi's
//     `tool_result` cannot end the turn without aborting it); `noop` returns
//     `undefined`. CR-01: the mutation surface is whitelisted to
//     `{ content, isError }` -- a hook-supplied patch cannot rewrite
//     `event.type`, `event.toolName`, or any other field.
//
//   - adaptInputResult           -> Pi `input` (UserPromptSubmit).
//     `block` -> `{ action: "handled" }`; `stop` -> `{ action: "handled" }`,
//     so the prompt stops; `mutate.additionalContext` is buffered in the
//     runtime's prompt-context buffer and the prompt continues unchanged
//     (`undefined`); the `before_agent_start` handler sends the context as a
//     message after the prompt (D-CF5-13); `noop` returns `undefined`.
//
//   - adaptObservationResultForEvent -> Pi `session_start` /
//     `session_shutdown` / `session_before_compact` / `session_compact`
//     (SessionStart / SessionEnd / PreCompact / PostCompact) with per-event
//     narrowing for the SessionStart `additionalContext` bridge. The
//     SessionStart mutate arm captures `additionalContext` into the
//     routing-state.ts pending buffer (drained by the bridge's
//     `before_agent_start` handler on the next agent turn). All other
//     observation events keep the silent-drop semantics: there is no
//     downstream Pi surface to thread their payloads through. `block` and
//     `stop` debug-log the dropped reason and return `undefined`. NEVER
//     notify. NEVER throw.
//
// Exhaustiveness gate: each adapter switches on every `result.kind` with no
// default arm (NFR-7). Adding a fifth `HookExecResult` arm fails `tsc` and
// the `switch-exhaustiveness-check` lint rule at each switch.
//
// Mutation surface: tool_call replaces `event.input` (Record<string,
// unknown>) key by key, tool_result returns the replacement `content` (the
// Pi-side (TextContent | ImageContent)[] array) and `isError`. The fold in `dispatch.ts` runs every
// hook on one snapshot, so a mutation applies once, after every hook ran.

import { hookDebugLog } from "../../shared/debug-log.ts";
import { errorMessage } from "../../shared/errors.ts";

import { hookBlockingErrorText, hookErrorText, hookEventLabel } from "./hook-labels.ts";

import type { HookExecResult } from "./exec-result.ts";
import type { PendingPromptContext, RoutingEntry } from "./routing-state.ts";
import type { HooksRuntime } from "./runtime.ts";
import type { BucketAEvent } from "../../domain/components/hook-events.ts";
import type {
  ExtensionAPI,
  ExtensionContext,
  InputEvent,
  InputEventResult,
  ToolCallEvent,
  ToolCallEventResult,
  ToolResultEvent,
  ToolResultEventResult,
} from "../../platform/pi-api.ts";
import type { Scope } from "../../shared/types.ts";

/**
 * What an adapter knows besides the folded result: the hooks runtime, the
 * Pi context and API of the event, and the routing entry the folded result
 * is attributed to (`undefined` for a fold of noops). The block texts name
 * the attributed entry's command (D-CF5-11).
 */
export interface HookAdapterContext {
  readonly runtime: HooksRuntime;
  readonly ctx: ExtensionContext;
  readonly pi: ExtensionAPI | undefined;
  readonly attributedTo: RoutingEntry | undefined;
}

// The provenance a buffered context carries when the fold attributes it to
// no entry. A fold of mutations always names one, so only a hand-built
// result reaches it.
const UNATTRIBUTED = { scope: "user", marketplace: "", pluginId: "" } as const satisfies {
  readonly scope: Scope;
  readonly marketplace: string;
  readonly pluginId: string;
};

// A context to buffer, with the provenance of the entry the fold attributes
// it to. Both pending buffers take this shape.
function bufferedContext(text: string, context: HookAdapterContext): PendingPromptContext {
  const provenance = context.attributedTo ?? UNATTRIBUTED;
  return {
    context: text,
    scope: provenance.scope,
    marketplace: provenance.marketplace,
    pluginId: provenance.pluginId,
  };
}

// The declared command of the entry a folded result is attributed to.
function attributedCommand(context: HookAdapterContext): string {
  return context.attributedTo?.handlerDecl.command ?? "";
}

// ──────────────────────────────────────────────────────────────────────────
// Mutation helper (D-60-02 / D-60-03)
// ──────────────────────────────────────────────────────────────────────────

/**
 * D-CF5-11: an `updatedInput` replaces the tool's whole input, so a key the
 * rewrite omits is gone. The input object keeps its identity, since Pi runs
 * the tool with it.
 *
 * CR-01: a non-object rewrite (null, array, primitive) changes nothing, so a
 * hook returning `updatedInput: null` cannot pollute via array index keys.
 * Keys are copied one at a time via `Object.entries` rather than
 * `Object.assign`, skipping an own `"__proto__"` key: `JSON.parse` creates
 * `__proto__` as an ordinary own data property (not the prototype link), so
 * a hook-supplied rewrite carrying that key would otherwise let
 * `Object.assign` reassign `event.input`'s prototype.
 */
function replaceToolCallInput(event: ToolCallEvent, updatedInput: unknown): void {
  if (updatedInput === null || typeof updatedInput !== "object" || Array.isArray(updatedInput)) {
    return;
  }

  const target = event.input as Record<string, unknown>;
  for (const key of Object.keys(target)) {
    Reflect.deleteProperty(target, key);
  }

  for (const [key, value] of Object.entries(updatedInput as Record<string, unknown>)) {
    if (key === "__proto__") {
      continue;
    }

    target[key] = value;
  }
}

/**
 * CR-01: whitelist the documented mutation surface for `tool_result` -- only
 * `content` (the Pi-side `(TextContent | ImageContent)[]` array) and `isError`
 * (boolean) may be written. Everything else in the hook-supplied patch is
 * silently dropped, so a malicious or buggy hook cannot rewrite the event's
 * discriminator (`type`), its `toolName`, or any other routing-load-bearing
 * field. Non-object patches are rejected early.
 *
 * The patch is the handler's return value: Pi 1.4's `emitToolResult` keeps
 * only the changes a handler returns, so a change made to the event in place
 * would never reach the model. `undefined` when neither field is valid.
 */
function toolResultPatch(updatedToolOutput: unknown): ToolResultEventResult | undefined {
  if (updatedToolOutput === null || typeof updatedToolOutput !== "object") {
    return undefined;
  }

  const patch = updatedToolOutput as Partial<Pick<ToolResultEvent, "content" | "isError">>;
  const toolResult: ToolResultEventResult = {};
  if (Array.isArray(patch.content)) {
    // Pi's `tool_result` slot takes image parts too; the frozen Pi boundary
    // types it as text parts only, so the patch's parts are widened to it.
    toolResult.content = patch.content as NonNullable<ToolResultEventResult["content"]>;
  }

  if (typeof patch.isError === "boolean") {
    toolResult.isError = patch.isError;
  }

  return Object.keys(toolResult).length === 0 ? undefined : toolResult;
}

// ──────────────────────────────────────────────────────────────────────────
// adaptToolCallResult -- PreToolUse
// ──────────────────────────────────────────────────────────────────────────

// The reason a PreToolUse `continue: false` blocks with when it gives none.
const DEFAULT_STOP_REASON = "Operation stopped by hook";

type MutateResult = Extract<HookExecResult, { kind: "mutate" }>;

/**
 * D-CF5-11: whether the user allows a call a hook asks about. Only a terminal
 * can answer, so in `print`, `json`, and `rpc` the answer is no, and no
 * dialog opens; in `tui` Pi's confirm dialog asks.
 */
async function userAllows(
  result: MutateResult,
  event: ToolCallEvent,
  context: HookAdapterContext,
): Promise<boolean> {
  if (context.ctx.mode !== "tui") {
    return false;
  }

  const label = hookEventLabel("PreToolUse", event.toolName);
  return context.ctx.ui.confirm(
    `${label} hook asks to allow this call`,
    result.permissionDecisionReason ?? "Allow this tool call?",
  );
}

// D-CF5-11: an allowed mutation rewrites the input; an `ask` the user does
// not allow blocks with the hook's reason, as Claude Code's print mode shows
// it to the model.
async function adaptToolCallMutation(
  result: MutateResult,
  event: ToolCallEvent,
  context: HookAdapterContext,
): Promise<ToolCallEventResult | undefined> {
  if (result.permissionDecision === "ask" && !(await userAllows(result, event, context))) {
    const reason = result.permissionDecisionReason;
    return reason === undefined ? { block: true } : { block: true, reason };
  }

  if (result.updatedInput !== undefined) {
    replaceToolCallInput(event, result.updatedInput);
  }

  return undefined;
}

/**
 * D-60-03: convert a folded `HookExecResult` to the Pi `tool_call` handler
 * return shape (`ToolCallEventResult | undefined`).
 *
 * A block reaches the model as Claude Code sends it (D-CF5-11):
 * `PreToolUse:<Tool> hook error: <reason>`, with an exit-2 stderr reason
 * after the attributed hook's bracketed command. A `continue: false` blocks
 * the call and sets `terminate`, so Pi ends the turn after the batch.
 */
export async function adaptToolCallResult(
  result: HookExecResult,
  event: ToolCallEvent,
  context: HookAdapterContext,
): Promise<ToolCallEventResult | undefined> {
  switch (result.kind) {
    case "block":
      return {
        block: true,
        reason: hookErrorText(
          hookEventLabel("PreToolUse", event.toolName),
          result.reason,
          attributedCommand(context),
          result.fromStderr === true,
        ),
      };

    case "mutate":
      return adaptToolCallMutation(result, event, context);

    case "stop":
      return { block: true, reason: result.stopReason ?? DEFAULT_STOP_REASON, terminate: true };

    case "noop":
      return undefined;
  }
}

// ──────────────────────────────────────────────────────────────────────────
// adaptToolResultResult -- PostToolUse + PostToolUseFailure
// ──────────────────────────────────────────────────────────────────────────

// The tool's output followed by the feedback text of a PostToolUse or
// PostToolUseFailure block (D-CF5-11).
function withFeedback(
  event: ToolResultEvent,
  result: Extract<HookExecResult, { kind: "block" }>,
  context: HookAdapterContext,
): NonNullable<ToolResultEventResult["content"]> {
  const label = hookEventLabel(
    event.isError ? "PostToolUseFailure" : "PostToolUse",
    event.toolName,
  );
  const feedback = {
    type: "text",
    text: hookBlockingErrorText(
      label,
      result.reason,
      attributedCommand(context),
      result.fromStderr === true,
    ),
  } as const;
  // Pi's `tool_result` slot takes image parts too; the frozen Pi boundary
  // types it as text parts only, so the kept output is widened to it.
  return [...(event.content as NonNullable<ToolResultEventResult["content"]>), feedback];
}

/**
 * D-60-03: convert a folded `HookExecResult` to the Pi `tool_result`
 * handler return shape (`ToolResultEventResult | undefined`).
 *
 * `tool_result` exposes a `content` / `details` / `isError` return shape;
 * the bridge's `mutate.updatedToolOutput` path returns the whitelisted
 * patch in that shape and leaves `event` alone. A `block` keeps the tool's output and returns it
 * with the hook's feedback after it, as Claude Code adds a PostToolUse
 * block's feedback after the tool result (D-CF5-11); the result is not
 * marked an error.
 */
export function adaptToolResultResult(
  result: HookExecResult,
  event: ToolResultEvent,
  context: HookAdapterContext,
): ToolResultEventResult | undefined {
  switch (result.kind) {
    case "block":
      // D-CF5-11: the tool already ran, so its output stays and the hook's
      // feedback follows it; the result is not marked an error.
      return { content: withFeedback(event, result, context) };

    case "mutate":
      return toolResultPatch(result.updatedToolOutput);

    case "stop":
      hookDebugLog(
        `adaptToolResult: stop ignored (no Pi return slot); reason=${result.stopReason ?? "<none>"}`,
      );
      return undefined;

    case "noop":
      return undefined;
  }
}

// ──────────────────────────────────────────────────────────────────────────
// adaptPreCompactResult -- PreCompact
// ──────────────────────────────────────────────────────────────────────────

/** What the `session_before_compact` handler returns to cancel the compaction. */
export interface CompactionCancel {
  readonly cancel: true;
}

/**
 * D-CF5-18: convert a folded PreCompact result to the Pi
 * `session_before_compact` return. A block (exit 2, a `decision: "block"`, or
 * a failure under `onFailure: "block"`) cancels the compaction, as Claude
 * Code 2.1.316 skips a compaction a PreCompact hook blocks, so neither
 * SessionStart(`compact`) nor PostCompact runs. Claude Code acts on no other
 * PreCompact outcome: a stop is debug-logged, and context is dropped (D-60-03).
 */
export function adaptPreCompactResult(result: HookExecResult): CompactionCancel | undefined {
  switch (result.kind) {
    case "block":
      return { cancel: true };

    case "stop":
      hookDebugLog(`adaptPreCompact: stop ignored; reason=${result.stopReason ?? "<none>"}`);
      return undefined;

    case "mutate":
    case "noop":
      return undefined;
  }
}

// ──────────────────────────────────────────────────────────────────────────
// adaptInputResult -- UserPromptSubmit
// ──────────────────────────────────────────────────────────────────────────

/** The custom type of the message that carries prompt and session hook context to the model. */
export const HOOK_CONTEXT_MESSAGE_TYPE = "claude-hook-additional-context";

/**
 * D-CF5-13: send the context of a prompt that Pi queues into the running
 * agent (a steer or a follow-up) as a hidden message. No
 * `before_agent_start` fires for a queued prompt, so a buffered context would
 * wait for a later prompt's turn. `triggerTurn: false` queues the message
 * until the running turn ends, so the model reads it on the turn that takes
 * the queued prompt. Pi queues the prompt itself only after its `input`
 * handlers return, so the context comes just before the prompt (Pi gap: no
 * carrier puts a message after a queued prompt). A blank context, or no Pi
 * API, sends nothing; a send that throws is debug-logged.
 */
function sendQueuedPromptContext(pi: ExtensionAPI | undefined, text: string): void {
  if (pi === undefined || text.trim() === "") {
    return;
  }

  try {
    pi.sendMessage(
      {
        customType: HOOK_CONTEXT_MESSAGE_TYPE,
        content: [{ type: "text", text: `UserPromptSubmit hook additional context: ${text}` }],
        display: false,
      },
      { triggerTurn: false },
    );
  } catch (error: unknown) {
    hookDebugLog(`adaptInput: queued prompt context failed: ${errorMessage(error)}`);
  }
}

/**
 * D-60-03: convert a folded `HookExecResult` to the Pi `input` handler
 * return shape (`InputEventResult | undefined`).
 *
 * D-CF5-13 / HOOK-05: a hook's `additionalContext` never replaces the
 * prompt. The adapter buffers it with the provenance of the attributed entry
 * and lets the prompt continue; the `before_agent_start` handler of the same
 * turn sends it as a message after the prompt. A prompt that Pi queues into
 * the running agent starts no turn of its own, so its context is sent at
 * once instead (`sendQueuedPromptContext`). A block or stop buffers nothing,
 * so a stopped prompt sends no context to any turn.
 */
export function adaptInputResult(
  result: HookExecResult,
  event: InputEvent,
  context: HookAdapterContext,
): InputEventResult | undefined {
  switch (result.kind) {
    case "block":
      return { action: "handled" };

    case "mutate":
      if (result.additionalContext === undefined) {
        return undefined;
      }

      if (event.streamingBehavior === undefined) {
        context.runtime.appendPendingPromptContext(
          bufferedContext(result.additionalContext, context),
        );
      } else {
        sendQueuedPromptContext(context.pi, result.additionalContext);
      }

      return undefined;

    case "stop":
      // D-CF5-11: a UserPromptSubmit `continue: false` stops the prompt.
      return { action: "handled" };

    case "noop":
      return undefined;
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
 * `before_agent_start` can add a message to the next agent turn. This
 * adapter captures the folded `additionalContext` of a SessionStart event
 * into the runtime's pending buffer; the `before_agent_start` handler in
 * `event-router.ts` drains the buffer on the next turn into a persisted
 * message after the prompt (D-CF5-13).
 *
 * Per-event semantics:
 *
 *   - SessionStart:
 *       additionalContext on any arm -> appendPendingSessionStartContext().
 *       The fold joins every hook's context into its decisive arm, so one
 *       hook that blocks or stops does not take the context of the others
 *       away, as in Claude Code (D-CF5-09).
 *       block / stop -> also debug-logged; no Pi return slot exists
 *
 *   - SessionEnd / PostCompact:
 *       all arms silently drop the additionalContext (and other mutate
 *       fields). No downstream drain point exists for these events under
 *       Pi's lifecycle: SessionEnd has no future turn; PostCompact
 *       interacts with the compaction summary, not the session prompt.
 *       Deferred per D-60-03. `block` / `stop` are still debug-logged for
 *       observability. PreCompact has an adapter of its own
 *       (`adaptPreCompactResult`).
 *
 * The buffered context carries the provenance of the entry the fold
 * attributes it to (the last mutating hook).
 *
 * The adapter NEVER notifies and NEVER throws. A new `HookExecResult` arm
 * is a compile-time failure at this switch (NFR-7).
 */
export function adaptObservationResultForEvent(
  result: HookExecResult,
  claudeEvent: Extract<BucketAEvent, "SessionStart" | "SessionEnd" | "PostCompact">,
  context: HookAdapterContext,
): undefined {
  if (
    claudeEvent === "SessionStart" &&
    result.additionalContext !== undefined &&
    result.additionalContext !== ""
  ) {
    // Capture for drain at the next before_agent_start. The buffer is
    // drained one-shot by beforeAgentStartHandlerFor and cleared on
    // registerHooksBridge entry (so /reload does not leak stale context
    // across sessions).
    context.runtime.appendPendingSessionStartContext(
      bufferedContext(result.additionalContext, context),
    );
  }

  switch (result.kind) {
    case "block":
      hookDebugLog(
        `adaptObservation: block ignored (no Pi return slot); event=${claudeEvent} reason=${result.reason ?? "<none>"}`,
      );
      return undefined;

    case "stop":
      hookDebugLog(
        `adaptObservation: stop ignored (no Pi return slot); event=${claudeEvent} reason=${result.stopReason ?? "<none>"}`,
      );
      return undefined;

    // SessionEnd / PostCompact: no logical drain point for
    // additionalContext. Other mutate fields (updatedInput,
    // updatedToolOutput, permissionDecision) are not meaningful for
    // observation events either; the adapter silently drops them.
    case "mutate":
    case "noop":
      return undefined;
  }
}

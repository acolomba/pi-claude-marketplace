// bridges/hooks/event-adapters.ts
//
// D-60-03: per-Pi-event adapters that convert a folded `HookExecResult`
// (D-60-01) into the Pi-side handler return shape, as Claude Code 2.1.316
// applies a hook decision (D-CF5-11).
//
// Five adapters cover the Bucket-A surface:
//
//   - adaptToolCallResult        -> Pi `tool_call` (PreToolUse).
//     `block` -> `{ block: true, reason }`, the reason reading
//     `PreToolUse:<Tool> hook error: <message>`; `stop` -> a block with
//     `terminate: true`, which ends the turn, and a stop notice to the user
//     (D-PG5-13); a mutation that asks blocks with
//     its reason when Pi has no terminal (`print`, `json`, `rpc`) and asks
//     through `ctx.ui.confirm` in `tui`; an allowed mutation's `updatedInput`
//     replaces the tool's whole input; `noop` returns `undefined`.
//
//   - adaptToolResultResult      -> Pi `tool_result` (PostToolUse +
//     PostToolUseFailure). `block` keeps the tool's output and adds the
//     hook's feedback, `<Event>:<Tool> hook blocking error from command:
//     "<command>": <message>`, without marking the result an error;
//     `mutate.updatedToolOutput` returns rendered `content`, sanitized
//     `details` and optional `structuredContent` as Pi's result value, on a
//     PostToolUse result only: a PostToolUseFailure hook cannot replace the
//     failed result (D-BG-405);
//     `stop` debug-logs + returns `undefined` (Pi's
//     `tool_result` cannot end the turn without aborting it); `noop` returns
//     `undefined`. CR-01: the mutation surface is whitelisted to
//     `{ content, details, structuredContent }` -- a hook-supplied value cannot rewrite
//     `event.type`, `event.toolName`, or any other field.
//
//   - adaptInputResult           -> Pi `input` (the `PROMPT_CONTEXT_EVENTS`).
//     `block` -> `{ action: "handled" }`; `stop` -> `{ action: "handled" }`,
//     so the prompt stops, and a stop notice to the user (D-PG5-13);
//     `mutate.additionalContext` is buffered in the
//     runtime's prompt-context buffer with its event, and the prompt continues unchanged
//     (`undefined`); the `before_agent_start` handler sends the context as a
//     message after the prompt (D-CF5-13); `noop` returns `undefined`.
//
//   - adaptPreCompactResult      -> Pi `session_before_compact` (PreCompact).
//     A `block` from any hook cancels the compaction (`{ cancel: true }`); a
//     `stop` is debug-logged; every other outcome returns `undefined`.
//
//   - adaptObservationResultForEvent -> Pi `session_start` /
//     `session_shutdown` / `session_compact` (SessionStart / SessionEnd /
//     PostCompact) with per-event narrowing for the SessionStart `additionalContext` bridge. The
//     SessionStart mutate arm captures `additionalContext` into the
//     routing-state.ts pending buffer (drained by the bridge's
//     `before_agent_start` handler on the next agent turn). All other
//     observation events keep the silent-drop semantics: there is no
//     downstream Pi surface to thread their payloads through. `block` and
//     `stop` debug-log the dropped reason and return `undefined`. NEVER
//     notify. NEVER throw.
//
// Exhaustiveness gate: each adapter switches on every `result.kind` with no
// default arm (NFR-7). Adding a new `HookExecResult` arm fails `tsc` and
// the `switch-exhaustiveness-check` lint rule at each switch.
//
// Mutation surface: tool_call replaces `event.input` (Record<string,
// unknown>) key by key, tool_result returns the replacement `content` (the
// Pi-side (TextContent | ImageContent)[] array) and safe structured content. The fold in `dispatch.ts` runs every
// hook on one snapshot, so a mutation applies once, after every hook ran.

import { homedir } from "node:os";
import { isDeepStrictEqual } from "node:util";

import { mapPiToClaudeToolName } from "../../domain/components/hook-tool-names.ts";
import { hookDebugLog } from "../../shared/debug-log.ts";
import { errorMessage } from "../../shared/errors.ts";
import { notifyHookNotice } from "../../shared/notification-dispatch.ts";
import { openNotificationRun } from "../../shared/notification-run.ts";

import {
  hookBlockingErrorText,
  hookErrorText,
  hookEventLabel,
  hookStoppedText,
  promptStoppedText,
} from "./hook-labels.ts";
import { decodeHookToolInput } from "./tool-input.ts";
import { renderFileToolOutput } from "./tool-output-files.ts";
import { renderSearchShellToolOutput } from "./tool-output-search-shell.ts";

import type { BucketAEvent } from "../../domain/components/hook-events.ts";
import type {
  AgentMessage,
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
import type { HookExecResult } from "./exec-result.ts";
import type {
  PendingPromptContext,
  PendingSessionStartContext,
  PromptContextEvent,
  RoutingEntry,
} from "./routing-state.ts";
import type { HooksRuntime } from "./runtime.ts";

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
// it to. A prompt's context adds its event (`bufferedPromptContext`).
function bufferedContext(text: string, context: HookAdapterContext): PendingSessionStartContext {
  const provenance = context.attributedTo ?? UNATTRIBUTED;
  return {
    context: text,
    scope: provenance.scope,
    marketplace: provenance.marketplace,
    pluginId: provenance.pluginId,
  };
}

function bufferedPromptContext(
  text: string,
  claudeEvent: PromptContextEvent,
  context: HookAdapterContext,
): PendingPromptContext {
  return { ...bufferedContext(text, context), event: claudeEvent };
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
 * The caller validates the complete rewrite first. Define each own key as a
 * data property so even a prototype-looking key cannot change the target's
 * prototype.
 */
export function replaceToolCallInput(
  event: ToolCallEvent,
  updatedInput: Record<string, unknown>,
): void {
  const target = event.input as Record<string, unknown>;
  for (const key of Object.keys(target)) {
    Reflect.deleteProperty(target, key);
  }

  for (const [key, value] of Object.entries(updatedInput)) {
    Object.defineProperty(target, key, {
      value,
      writable: true,
      enumerable: true,
      configurable: true,
    });
  }
}

function contentBlocks(value: unknown): value is ToolResultEvent["content"] {
  return (
    Array.isArray(value) &&
    value.every((candidate: unknown) => {
      if (typeof candidate !== "object" || candidate === null) {
        return false;
      }

      const block = candidate as Record<string, unknown>;
      return (
        (block.type === "text" && typeof block.text === "string") ||
        (block.type === "image" &&
          typeof block.data === "string" &&
          typeof block.mimeType === "string")
      );
    })
  );
}

function customOutput(value: unknown): ToolResultEventResult | undefined {
  if (Array.isArray(value) && contentBlocks(value)) {
    return { content: value };
  }

  if (value !== null && typeof value === "object" && "content" in value) {
    if (!contentBlocks(value.content)) {
      return undefined;
    }

    return {
      content: value.content,
      ...("structuredContent" in value && value.structuredContent !== undefined
        ? {
            structuredContent: value.structuredContent as Exclude<
              ToolResultEvent["structuredContent"],
              undefined
            >,
          }
        : {}),
    };
  }

  const text = typeof value === "string" ? value : JSON.stringify(value);
  return {
    content: [{ type: "text", text }],
    ...(value !== null && typeof value === "object"
      ? {
          structuredContent: value as Exclude<ToolResultEvent["structuredContent"], undefined>,
        }
      : {}),
  };
}

function routingDetails(event: ToolResultEvent): unknown {
  const details = event.details;
  if (
    event.toolName.startsWith("mcp__") &&
    details !== null &&
    typeof details === "object" &&
    "server" in details &&
    typeof details.server === "string" &&
    "tool" in details &&
    typeof details.tool === "string"
  ) {
    return { server: details.server, tool: details.tool };
  }

  return null;
}

/** Render hook output as data and replace all stale Pi output carriers. */
function toolResultPatch(
  updatedToolOutput: unknown,
  event: ToolResultEvent,
  cwd: string,
): ToolResultEventResult | undefined {
  if (updatedToolOutput === undefined || typeof event.toolName !== "string") {
    return undefined;
  }

  const toolName = event.toolName;
  if (["read", "edit", "write"].includes(toolName)) {
    return renderFileToolOutput(event, updatedToolOutput, cwd);
  }

  if (["find", "grep", "bash", "powershell"].includes(toolName)) {
    return renderSearchShellToolOutput(event, updatedToolOutput, cwd);
  }

  const decoded = customOutput(updatedToolOutput);
  if (decoded?.content === undefined) {
    return undefined;
  }

  if (
    isDeepStrictEqual(decoded.content, event.content) &&
    isDeepStrictEqual(decoded.structuredContent, event.structuredContent)
  ) {
    return undefined;
  }

  return {
    content: decoded.content,
    details: routingDetails(event),
    ...(decoded.structuredContent === undefined
      ? {}
      : { structuredContent: decoded.structuredContent }),
  };
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
    const decoded = decodeHookToolInput(
      event.toolName,
      event.input,
      result.updatedInput,
      context.ctx.cwd,
      homedir(),
    );
    if (decoded.kind === "accepted") {
      if (decoded.input !== event.input) {
        replaceToolCallInput(event, decoded.input);
      }
    } else {
      notifyIgnoredToolInputRewrite(event, context, decoded.category);
    }
  }

  return undefined;
}

// Shows one hook notice from an adapter. With no Pi API there is no run to
// open, so it shows nothing; a notice that fails to show is debug-logged
// after `failed` and never fails the event.
function showAdapterNotice(context: HookAdapterContext, notice: string, failed: string): void {
  if (context.pi === undefined) {
    return;
  }

  try {
    const run = openNotificationRun(context.pi, { kind: "hook" });
    notifyHookNotice(context.ctx, run, notice);
  } catch (error: unknown) {
    hookDebugLog(`${failed}: ${errorMessage(error)}`);
  }
}

/** Reports a discarded rewrite without exposing its input values. */
export function notifyIgnoredToolInputRewrite(
  event: ToolCallEvent,
  context: HookAdapterContext,
  category: "shape" | "field" | "value",
): void {
  showAdapterNotice(
    context,
    `PreToolUse:${mapPiToClaudeToolName(event.toolName)} ignored input rewrite (${category})`,
    "adaptToolCall: ignored rewrite notice failed",
  );
}

/**
 * D-60-03: convert a folded `HookExecResult` to the Pi `tool_call` handler
 * return shape (`ToolCallEventResult | undefined`).
 *
 * A block reaches the model as Claude Code sends it (D-CF5-11):
 * `PreToolUse:<Tool> hook error: <reason>`, with an exit-2 stderr reason
 * after the attributed hook's bracketed command. A `continue: false` blocks
 * the call and sets `terminate`, so Pi ends the turn after the batch, and
 * shows the user `PreToolUse:<Tool> hook stopped continuation: <stopReason>`
 * (D-PG5-13).
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
      showAdapterNotice(
        context,
        hookStoppedText(hookEventLabel("PreToolUse", event.toolName), result.stopReason),
        "adaptToolCall: stop notice failed",
      );
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
  return [...event.content, feedback];
}

// D-BG-405: Claude Code's PostToolUseFailure branch reads only
// `additionalContext`, so a failure hook's `updatedToolOutput` leaves the
// failed result as the tool reported it.
function failedResultPatch(
  result: Extract<HookExecResult, { kind: "mutate" }>,
): ToolResultEventResult | undefined {
  if (result.updatedToolOutput !== undefined) {
    hookDebugLog("adaptToolResult: updatedToolOutput ignored on a failed tool result");
  }

  return undefined;
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
 * marked an error. A mutation on a failed result changes nothing, as Claude
 * Code's PostToolUseFailure branch reads only `additionalContext`, which
 * `dispatch.ts` sends on its own path (D-BG-405).
 */
export function adaptToolResultResult(
  result: HookExecResult,
  event: ToolResultEvent,
  context: HookAdapterContext,
): ToolResultEventResult | undefined {
  switch (result.kind) {
    case "block": {
      // D-CF5-11: the tool already ran, so its output stays and the hook's
      // feedback follows it; the result is not marked an error.
      const feedbackResult: ToolResultEventResult = {
        content: withFeedback(event, result, context),
        isError: event.isError,
      };
      if (event.structuredContent !== undefined) {
        feedbackResult.structuredContent = event.structuredContent;
      }

      return feedbackResult;
    }

    case "mutate":
      return event.isError
        ? failedResultPatch(result)
        : toolResultPatch(result.updatedToolOutput, event, context.ctx.cwd);

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
 * D-CF5-18: convert the PreCompact hooks' results to the Pi
 * `session_before_compact` return. A block from any hook (exit 2, a
 * `decision: "block"`, or a failure under `onFailure: "block"`) cancels the
 * compaction, as Claude Code 2.1.316 skips a compaction when any PreCompact
 * hook blocks, whatever the other hooks return. So neither
 * SessionStart(`compact`) nor PostCompact runs. Claude Code acts on no other
 * PreCompact outcome: a stop is debug-logged, and context is dropped (D-60-03).
 * The results are every hook's own, not the fold, because a fold lets a stop
 * hide a block.
 */
export function adaptPreCompactResult(
  results: readonly HookExecResult[],
): CompactionCancel | undefined {
  for (const result of results) {
    if (result.kind === "stop") {
      hookDebugLog(`adaptPreCompact: stop ignored; reason=${result.stopReason ?? "<none>"}`);
    }
  }

  return results.some((result) => result.kind === "block") ? { cancel: true } : undefined;
}

// ──────────────────────────────────────────────────────────────────────────
// adaptInputResult -- the prompt events
// ──────────────────────────────────────────────────────────────────────────

/** The custom type of the message that carries prompt and session hook context to the model. */
export const HOOK_CONTEXT_MESSAGE_TYPE = "claude-hook-additional-context";

/**
 * HOOK-05 / D-PG6-20: one `<Event> hook additional context: <values>` text
 * part, the values joined by `\n` in buffer order, as Claude Code 2.1.316
 * words it, labeled with the event of the hooks that gave the values. A
 * value that is empty or only whitespace adds nothing, so no value with text
 * gives no part.
 */
export function hookContextPart(
  claudeEvent: "SessionStart" | PromptContextEvent,
  values: readonly string[],
): { readonly type: "text"; readonly text: string } | undefined {
  const texts = values.filter((text) => text.trim().length > 0);
  if (texts.length === 0) {
    return undefined;
  }

  return { type: "text", text: `${claudeEvent} hook additional context: ${texts.join("\n")}` };
}

/**
 * D-CF5-13: send the context of a prompt that Pi queued into the running
 * agent as a hidden message. No `before_agent_start` fires for a queued
 * prompt, so a buffered context would wait for a later prompt's turn.
 * `triggerTurn: false` holds the message until the running turn ends, so the
 * model reads it on the next model call. A steer is read on that call, so
 * its context goes out at once; a follow-up's waits for the turn before Pi
 * reads it (`sendDueFollowUpContext`). Pi queues the prompt itself only after
 * its `input` handlers return, so the context comes just before the prompt
 * (Pi gap: no carrier puts a message after a queued prompt). Pi's
 * `deliverAs` cannot carry it: Pi reads one queued message per model call by
 * default, so the context would get a model call of its own. A blank
 * context, or no Pi API, sends nothing; a send that throws is debug-logged.
 */
function sendQueuedPromptContext(
  pi: ExtensionAPI | undefined,
  claudeEvent: PromptContextEvent,
  text: string,
): void {
  const part = hookContextPart(claudeEvent, [text]);
  if (pi === undefined || part === undefined) {
    return;
  }

  try {
    pi.sendMessage(
      {
        customType: HOOK_CONTEXT_MESSAGE_TYPE,
        content: [part],
        display: false,
      },
      { triggerTurn: false },
    );
  } catch (error: unknown) {
    hookDebugLog(`adaptInput: queued prompt context failed: ${errorMessage(error)}`);
  }
}

/** The parts of Pi's `turn_end` event that tell what the agent reads next. */
export interface FollowUpTurnEnd {
  readonly message: AgentMessage;
  readonly context: { readonly pendingMessages: readonly AgentMessage[] };
}

// Whether the agent stops working after `message` and so reads the next
// follow-up: the turn ended without a tool call, an error, or an abort.
function endsTheWork(message: AgentMessage): boolean {
  if (message.role !== "assistant") {
    return false;
  }

  return (
    message.stopReason !== "error" &&
    message.stopReason !== "aborted" &&
    !message.content.some((part) => part.type === "toolCall")
  );
}

// The text of a queued user message, as Pi matches its queues by text.
function userMessageText(message: AgentMessage | undefined): string | undefined {
  if (message?.role !== "user") {
    return undefined;
  }

  const { content } = message;
  return typeof content === "string"
    ? content
    : content.flatMap((part) => (part.type === "text" ? [part.text] : [])).join("");
}

/**
 * D-CF5-13: at a turn end, send the context of the follow-up the agent reads
 * next. Pi reads a follow-up only when the agent would otherwise stop, and
 * its next queued message (`context.pendingMessages[0]`) is a steer when one
 * waits, else the next follow-up. So the context goes out when the turn ends
 * the work and that message is a follow-up whose context waits, matched by
 * text as Pi matches its own queues. Pi appends the message at this turn
 * end, before it reads the follow-up.
 */
export function sendDueFollowUpContext(
  turn: FollowUpTurnEnd,
  runtime: HooksRuntime,
  pi: ExtensionAPI | undefined,
): void {
  const next = userMessageText(turn.context.pendingMessages[0]);
  if (next === undefined || !endsTheWork(turn.message)) {
    return;
  }

  const entry = runtime.takeFollowUpContext(next);
  if (entry !== undefined) {
    sendQueuedPromptContext(pi, entry.event, entry.context);
  }
}

// D-CF5-13: where a prompt's context waits. A prompt that starts its own run
// buffers it for `before_agent_start`; a steer sends it at once; a follow-up
// queues it for the turn end before Pi reads the follow-up.
function queuePromptContext(
  text: string,
  claudeEvent: PromptContextEvent,
  event: InputEvent,
  context: HookAdapterContext,
): void {
  switch (event.streamingBehavior) {
    case undefined:
      context.runtime.appendPendingPromptContext(bufferedPromptContext(text, claudeEvent, context));
      return;

    case "steer":
      sendQueuedPromptContext(context.pi, claudeEvent, text);
      return;

    case "followUp":
      context.runtime.queueFollowUpContext({
        ...bufferedPromptContext(text, claudeEvent, context),
        prompt: event.text,
      });
      return;
  }
}

/**
 * D-60-03: convert a folded `HookExecResult` to the Pi `input` handler
 * return shape (`InputEventResult | undefined`).
 *
 * D-CF5-13 / HOOK-05: a hook's `additionalContext` never replaces the
 * prompt. The adapter buffers it with the provenance of the attributed entry
 * and `claudeEvent`, the hook's event, which labels it (D-PG6-20), and lets
 * the prompt continue; the `before_agent_start` handler of the same
 * turn sends it as a message after the prompt. A prompt that Pi queues into
 * the running agent starts no turn of its own, so its context goes out as a
 * message on the model call that reads it (`queuePromptContext`). A block or
 * stop buffers nothing, so a stopped prompt sends no context to any turn.
 */
export function adaptInputResult(
  result: HookExecResult,
  event: InputEvent,
  context: HookAdapterContext,
  claudeEvent: PromptContextEvent,
): InputEventResult | undefined {
  switch (result.kind) {
    case "block":
      return { action: "handled" };

    case "mutate":
      if (result.additionalContext === undefined) {
        return undefined;
      }

      queuePromptContext(result.additionalContext, claudeEvent, event, context);
      return undefined;

    case "stop":
      // D-CF5-11 / D-PG5-13: a prompt hook's `continue: false` stops the
      // prompt and shows the user why.
      showAdapterNotice(
        context,
        promptStoppedText(result.stopReason),
        "adaptInput: stop notice failed",
      );
      return { action: "handled" };

    case "noop":
      return undefined;
  }
}

// ──────────────────────────────────────────────────────────────────────────
// adaptObservationResultForEvent -- SessionStart / SessionEnd / PostCompact
//                                   (per-event narrowing)
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

// bridges/hooks/session-start-context.ts
//
// The SessionStart context that the conversation holds, read back from the
// session's messages. Two kinds of message carry it: the hidden context
// message of the synchronous hooks (HKRL-01, HKRL-02) and the answer of a
// plain `async` hook (D-BG-205). Both readers live here, beside the two
// custom types, because the synchronous resume check and the async answer
// check each need what the other kind writes. A pure leaf.

import type { AgentMessage } from "../../platform/pi-api.ts";

/** The custom type of the message that carries prompt and session hook context to the model. */
export const HOOK_CONTEXT_MESSAGE_TYPE = "claude-hook-additional-context";

/**
 * D-BG-205: the custom type of a plain async hook's answer, named after
 * Claude Code's `async_hook_response` attachment.
 */
export const ASYNC_RESPONSE_CUSTOM_TYPE = "claude-hook-async-response";

/**
 * HKRL-02: the values a SessionStart context message carries, one per hook,
 * as Claude Code keeps one string per hook in its attachment. A resumed or
 * forked session reads them back to tell which values it already holds.
 */
export interface SessionStartContextDetails {
  readonly event: "SessionStart";
  readonly values: readonly string[];
}

/**
 * HOOKASYNCRESUME-01: the hook that gave an async SessionStart answer, as
 * Claude Code 2.1.295 names it: the plugin (`<plugin>@<marketplace>`) and
 * the command the hook declares.
 */
export interface AsyncAnswerHook {
  readonly pluginId: string;
  readonly marketplace: string;
  readonly command: string | undefined;
}

/**
 * HOOKASYNCRESUME-01: the details of each message of an async SessionStart
 * answer. `values` holds every text of the answer before the 10,000-character
 * cap, as Claude Code keeps the hook's own response, so a later check compares
 * the texts the hook gave and not the per-run path of a saved file.
 */
export interface AsyncSessionStartDetails extends AsyncAnswerHook, SessionStartContextDetails {
  readonly dispatchId: string;
}

// The label of a SessionStart context part (`hookContextPart`).
const SESSION_START_CONTEXT_LABEL = "SessionStart hook additional context: ";

// One SessionStart context the conversation holds: its texts, and the hook
// that gave it when an async answer holds it. A synchronous context names no
// hook.
interface HeldContext {
  readonly hook?: AsyncAnswerHook;
  readonly texts: readonly string[];
}

// Whether `value`, read back from a session file, is the `details` of a
// SessionStart context message.
function isSessionStartContextDetails(value: unknown): value is SessionStartContextDetails {
  return (
    typeof value === "object" &&
    value !== null &&
    "event" in value &&
    "values" in value &&
    value.event === "SessionStart" &&
    Array.isArray(value.values) &&
    value.values.every((item: unknown) => typeof item === "string")
  );
}

// Whether `value`, read back from a session file, is the `details` of an
// async SessionStart answer.
function isAsyncSessionStartDetails(
  value: unknown,
): value is SessionStartContextDetails & AsyncAnswerHook & { readonly command: string } {
  return (
    isSessionStartContextDetails(value) &&
    "pluginId" in value &&
    "marketplace" in value &&
    "command" in value &&
    typeof value.pluginId === "string" &&
    typeof value.marketplace === "string" &&
    typeof value.command === "string"
  );
}

/**
 * HKRL-02: the SessionStart values that `message` holds, as written, read
 * from the text the model sees: the rest of each part that carries the
 * SessionStart label. Text content is one such part, as a context edit may
 * write it. `details` only splits that rest into its values, when they join
 * to it; a context edit replaces the text and keeps the details, and a
 * message written before details existed, or by a release whose details this
 * one does not read, gives its whole rest.
 */
export function sessionStartValues(message: AgentMessage): readonly string[] {
  if (message.role !== "custom" || message.customType !== HOOK_CONTEXT_MESSAGE_TYPE) {
    return [];
  }

  const { content, details } = message;
  const parts = typeof content === "string" ? [{ type: "text" as const, text: content }] : content;
  return parts.flatMap((part) => {
    if (part.type !== "text" || !part.text.startsWith(SESSION_START_CONTEXT_LABEL)) {
      return [];
    }

    const text = part.text.slice(SESSION_START_CONTEXT_LABEL.length);
    return isSessionStartContextDetails(details) && details.values.join("\n") === text
      ? details.values
      : [text];
  });
}

// The SessionStart context that `message` holds, or undefined for a message
// that holds none: an async answer by its details, and a synchronous context
// message by its text.
function heldContextOf(message: AgentMessage): HeldContext | undefined {
  if (message.role === "custom" && message.customType === ASYNC_RESPONSE_CUSTOM_TYPE) {
    const { details } = message;
    return isAsyncSessionStartDetails(details)
      ? {
          hook: {
            pluginId: details.pluginId,
            marketplace: details.marketplace,
            command: details.command,
          },
          texts: details.values,
        }
      : undefined;
  }

  const texts = sessionStartValues(message);
  return texts.length === 0 ? undefined : { texts };
}

function sameHook(left: AsyncAnswerHook, right: AsyncAnswerHook): boolean {
  return (
    left.pluginId === right.pluginId &&
    left.marketplace === right.marketplace &&
    left.command === right.command
  );
}

/**
 * HOOKASYNCRESUME-01: whether the conversation `messages` already holds every
 * text of `hook`'s async SessionStart answer, as Claude Code 2.1.295 decides
 * it. The nearest SessionStart context with text decides alone: a synchronous
 * context or an earlier answer of the same hook. The answers of other hooks
 * are skipped. An answer with no text is never held.
 */
export function asyncAnswerHeld(
  messages: readonly AgentMessage[],
  hook: AsyncAnswerHook,
  texts: readonly string[],
): boolean {
  if (texts.length === 0) {
    return false;
  }

  const nearest = messages
    .map(heldContextOf)
    .filter(
      (held): held is HeldContext =>
        held !== undefined && (held.hook === undefined || sameHook(held.hook, hook)),
    )
    .at(-1);
  return nearest !== undefined && texts.every((text) => nearest.texts.includes(text));
}

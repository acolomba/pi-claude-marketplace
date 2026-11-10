// bridges/hooks/async-rewake/rewake-text.ts
//
// The texts Claude Code 2.1.319 puts on an asyncRewake hook's exit 2: the
// label it names the hook by, the message the model wakes with, and the
// summary the user sees (D-BG-202, D-BG-204). A pure leaf, so the registry can
// read it without importing `dispatch.ts`, which would close an import cycle.

import { hookMatchLabel } from "../hook-labels.ts";

import type { DispatchableEvent } from "../../../domain/components/hook-events.ts";

// D-BG-204: the summary Claude Code shows when the hook declares none.
const DEFAULT_SUMMARY = "Stop hook feedback";

// The stdin field each event's matcher selects on, as Claude Code names the
// hook `<Event>:<value>` by it (D-CF5-14). An event with none is named alone.
const MATCH_FIELDS: Record<DispatchableEvent, string | undefined> = {
  SessionStart: "source",
  UserPromptSubmit: undefined,
  PreToolUse: "tool_name",
  PostToolUse: "tool_name",
  PostToolUseFailure: "tool_name",
  PreCompact: "trigger",
  PostCompact: "trigger",
  SessionEnd: "reason",
  Stop: undefined,
  StopFailure: "error",
};

/**
 * D-BG-202: the label Claude Code gives the hook, read from the Claude-shaped
 * stdin `payload` the hook received: `<Event>:<value>` for an event whose
 * matcher selects on a field the payload holds as a string, else the event.
 */
export function rewakeLabel(event: DispatchableEvent, payload: unknown): string {
  const field = MATCH_FIELDS[event];
  const value =
    field !== undefined && typeof payload === "object" && payload !== null
      ? (payload as Record<string, unknown>)[field]
      : undefined;
  return typeof value === "string" ? hookMatchLabel(event, value) : event;
}

/**
 * D-BG-202: the message the model wakes with, as Claude Code 2.1.319 builds
 * it: the declared `rewakeMessage`, else `Stop hook blocking error from
 * command "<label>":`, then one space, then the whole stderr when it is not
 * empty, else the whole stdout. An empty output keeps the prefix and space.
 */
export function rewakeBody(
  rewakeMessage: string | undefined,
  label: string,
  stderr: string,
  stdout: string,
): string {
  const prefix = rewakeMessage ?? `Stop hook blocking error from command "${label}":`;
  return `${prefix} ${stderr === "" ? stdout : stderr}`;
}

/** D-BG-204: the summary the user sees on exit 2, with Claude Code's default. */
export function rewakeSummaryText(rewakeSummary: string | undefined): string {
  return rewakeSummary ?? DEFAULT_SUMMARY;
}

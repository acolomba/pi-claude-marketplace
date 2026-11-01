// bridges/hooks/hook-labels.ts
//
// The labels and error texts Claude Code 2.1.316 puts on a hook's outcome
// (D-CF5-11). A hook outcome is named by its event, and a tool event adds the
// Claude tool name: `PreToolUse:Bash`. A denied tool call reaches the model as
// `PreToolUse:Bash hook error: <reason>`; an exit-2 block as
// `PreToolUse:Bash hook error: [<command>]: <stderr>`; a PostToolUse block as
// `PostToolUse:Bash hook blocking error from command: "<command>": <reason>`.
// A hook's `systemMessage` reaches the user as `<label> says: <text>`.
//
// A leaf: no Pi and no runtime imports, so every adapter and every output
// carrier can share one wording.

import { mapPiToClaudeToolName } from "../../domain/components/hook-tool-names.ts";

// Claude Code's reason for a block that names none: an exit 2 with no stderr,
// and a block or deny decision with no reason.
const NO_STDERR_REASON = "No stderr output";
const NO_DECISION_REASON = "Blocked by hook";

/**
 * D-CF5-11: the label Claude Code gives a hook outcome: `<Event>`, or
 * `<Event>:<Claude tool name>` for a tool event, `piToolName` being the Pi
 * tool name the event carries.
 */
export function hookEventLabel(claudeEvent: string, piToolName?: string): string {
  return piToolName === undefined
    ? claudeEvent
    : `${claudeEvent}:${mapPiToClaudeToolName(piToolName)}`;
}

// The message of a block: an exit-2 stderr reason follows the bracketed
// command; any other reason, an onFailure block's included, stands alone.
function blockMessage(reason: string | undefined, command: string, fromStderr: boolean): string {
  if (fromStderr) {
    return `[${command}]: ${reason ?? NO_STDERR_REASON}`;
  }

  return reason ?? NO_DECISION_REASON;
}

/**
 * D-CF5-11: the feedback a PostToolUse or PostToolUseFailure block adds after
 * the tool's output, `<label> hook blocking error from command: "<command>":
 * <message>`, the message as `hookErrorText` writes it.
 */
export function hookBlockingErrorText(
  label: string,
  reason: string | undefined,
  command: string,
  fromStderr: boolean,
): string {
  return `${label} hook blocking error from command: "${command}": ${blockMessage(reason, command, fromStderr)}`;
}

/**
 * D-CF5-14: the notice Claude Code shows the user for a hook's
 * `systemMessage`, `<label> says: <text>`.
 */
export function hookSaysText(label: string, text: string): string {
  return `${label} says: ${text}`;
}

/**
 * D-CF5-11: the text of a hook error, `<label> hook error: <message>`. The
 * message is `[<command>]: <reason>` for a reason `fromStderr` marks as exit-2
 * stderr, else the reason. A missing reason reads as Claude Code's default.
 */
export function hookErrorText(
  label: string,
  reason: string | undefined,
  command: string,
  fromStderr: boolean,
): string {
  return `${label} hook error: ${blockMessage(reason, command, fromStderr)}`;
}

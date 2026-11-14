// bridges/hooks/hook-labels.ts
//
// The labels and error texts Claude Code 2.1.316 puts on a hook's outcome
// (D-CF5-11). A hook outcome is named by its event, and a tool event adds the
// Claude tool name: `PreToolUse:Bash`. A denied tool call reaches the model as
// `PreToolUse:Bash hook error: <reason>`; an exit-2 block as
// `PreToolUse:Bash hook error: [<command>]: <stderr>`; a PostToolUse block as
// `PostToolUse:Bash hook blocking error from command: "<command>": <reason>`.
// A hook's `systemMessage` reaches the user as `<label> says: <text>`, a
// blocked prompt as `UserPromptSubmit operation blocked by hook:\n<message>`.
// A session or compaction hook is named by the value its matcher selects on:
// `SessionStart:startup`. After `/compact`, each PostCompact hook shows as
// `PostCompact [<command>] completed successfully` or `... failed` (D-BG-501).
// A synchronous hook that fails without blocking shows the user one line, as
// Claude Code 2.1.323 words it (D-PG5-11): `<label> hook error: Failed with
// non-blocking status code: <stderr>` for a failed exit, with `Error occurred
// while executing hook command: <error>` after the prefix for a command that
// cannot be spawned, and `<label> hook error: Failed to run: <error>` for an
// exception in the runner. The exit 2 of a missing script shows its whole
// text, `<label> hook error: Hook script appears to be missing` and the
// reinstall command of the hook's plugin (D-PG5-08, D-PG5-11).
//
// A leaf: no Pi and no runtime imports, so every adapter and every output
// carrier can share one wording.

import { mapPiToClaudeToolName } from "../../domain/components/hook-tool-names.ts";

import type { HookFailure } from "./exec-result.ts";
import type { Scope } from "../../shared/types.ts";

// Claude Code's reason for a block that names none: an exit 2 with no stderr,
// and a block or deny decision with no reason.
const NO_STDERR_REASON = "No stderr output";
const NO_DECISION_REASON = "Blocked by hook";

// D-PG5-11: Claude Code 2.1.323's head of a non-blocking failure, and the
// length at which its renderer cuts the line it shows.
const NON_BLOCKING_PREFIX = "Failed with non-blocking status code: ";
const FAILURE_LINE_LIMIT = 200;

// D-PG5-11: the em dash of Claude Code 2.1.323's missing-script notice. It
// stays escaped because the fix-unicode-dashes hook rewrites a literal one.
const MISSING_SCRIPT_DASH = "\u2014";

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

/**
 * D-CF5-14: the label Claude Code gives a hook of an event whose matcher
 * selects on a closed set, `<Event>:<value>`, `matchValue` being the value the
 * matcher compares: the SessionStart source, the SessionEnd reason, or the
 * compaction trigger. Claude Code 2.1.316 names a startup hook
 * `SessionStart:startup`.
 */
export function hookMatchLabel(claudeEvent: string, matchValue: string): string {
  return `${claudeEvent}:${matchValue}`;
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

/** One blocking hook outcome, with the command the hook declares. */
export interface HookBlock {
  readonly reason: string | undefined;
  readonly command: string;
  readonly fromStderr: boolean;
}

/**
 * The notice a PreCompact block shows the user, as Claude Code 2.1.316
 * reports a blocked compaction: `Compaction blocked by PreCompact hook:
 * <messages>`, one message per blocking hook in routing order, each as
 * `hookErrorText` writes it, joined by line breaks.
 */
export function compactionBlockedText(blocks: readonly HookBlock[]): string {
  const messages = blocks.map(({ reason, command, fromStderr }) =>
    blockMessage(reason, command, fromStderr),
  );
  return `Compaction blocked by PreCompact hook: ${messages.join("\n")}`;
}

/**
 * D-CF5-14: the notice Claude Code shows the user for a hook's
 * `systemMessage`, `<label> says: <text>`.
 */
export function hookSaysText(label: string, text: string): string {
  return `${label} says: ${text}`;
}

/**
 * D-CF5-11 / D-CF5-24: the notice a blocked prompt shows the user,
 * `UserPromptSubmit operation blocked by hook:\n<message>`, the message as
 * `hookErrorText` writes it. Claude Code adds a third line,
 * `Original prompt: <prompt>`, which this notice leaves out (D-CF5-24).
 */
export function promptBlockedText(
  reason: string | undefined,
  command: string,
  fromStderr: boolean,
): string {
  return `UserPromptSubmit operation blocked by hook:\n${blockMessage(reason, command, fromStderr)}`;
}

/**
 * D-BG-501: one line of the notice that lists how each PostCompact hook ended
 * after `/compact`, as Claude Code 2.1.319 words it: `PostCompact [<command>]
 * completed successfully` or `PostCompact [<command>] failed`, then `: ` and
 * the trimmed output when there is any.
 */
export function postCompactLineText(command: string, succeeded: boolean, output: string): string {
  const head = `PostCompact [${command}] ${succeeded ? "completed successfully" : "failed"}`;
  const text = output.trim();
  return text === "" ? head : `${head}: ${text}`;
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

// D-PG5-11: the line Claude Code 2.1.323 shows for a failure text: its first
// line that is not blank, trimmed, and cut to 200 string units and then `…`.
// The text is trimmed first, so its first line is that line.
function failureLine(text: string): string {
  const trimmed = text.trim();
  const end = trimmed.indexOf("\n");
  const line = (end === -1 ? trimmed : trimmed.slice(0, end)).trim();
  return line.length > FAILURE_LINE_LIMIT ? `${line.slice(0, FAILURE_LINE_LIMIT)}…` : line;
}

// D-PG5-11: the whole failure text before the cut, as Claude Code 2.1.323
// builds it for each kind of failure that is cut.
function failureMessage(failure: Exclude<HookFailure, { kind: "missing-script" }>): string {
  switch (failure.kind) {
    case "exit": {
      const stderr = failure.stderr.trim();
      return `${NON_BLOCKING_PREFIX}${stderr === "" ? NO_STDERR_REASON : stderr}`;
    }

    case "spawn":
      return `${NON_BLOCKING_PREFIX}Error occurred while executing hook command: ${failure.error}`;
    case "run":
      return `Failed to run: ${failure.error}`;
  }
}

/** The hook a failure notice names: its declared command and its plugin. */
export interface FailedHook {
  readonly command: string;
  readonly plugin: string;
  readonly marketplace: string;
  readonly scope: Scope;
}

// D-PG5-08 / D-PG5-11: Claude Code 2.1.323's text for the exit 2 of a missing
// script, with this extension's reinstall command for the hook's own plugin
// and scope in place of upstream's `/plugin` sentence.
function missingScriptMessage(stderr: string, hook: FailedHook): string {
  return (
    `Hook script appears to be missing ${MISSING_SCRIPT_DASH} "${hook.command}" exited 2 with: ` +
    `${stderr.trim()}. Treating as non-blocking. Run /claude:plugin reinstall ` +
    `${hook.plugin}@${hook.marketplace} --scope ${hook.scope} to reinstall it.`
  );
}

/**
 * D-PG5-11: the notice of a synchronous hook that failed without blocking, as
 * Claude Code 2.1.323 shows it, on one line: `<label> hook error: ` and the
 * first line of the failure text that is not blank, cut to 200 characters,
 * prefix included. A failed exit reads `Failed with non-blocking status code:
 * <stderr>`, or `No stderr output`; a command that cannot be spawned adds
 * `Error occurred while executing hook command: <error>` after that prefix;
 * an exception in the runner reads `Failed to run: <error>`. The exit 2 of a
 * missing script shows its whole text, which names `hook` (D-PG5-08).
 */
export function hookFailureText(label: string, failure: HookFailure, hook: FailedHook): string {
  if (failure.kind === "missing-script") {
    return `${label} hook error: ${missingScriptMessage(failure.stderr, hook)}`;
  }

  return `${label} hook error: ${failureLine(failureMessage(failure))}`;
}

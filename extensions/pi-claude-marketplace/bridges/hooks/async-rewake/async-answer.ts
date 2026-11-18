// bridges/hooks/async-rewake/async-answer.ts
//
// The answer of a plain `async: true` hook, read as Claude Code 2.1.319 reads
// it when the background process ends: one JSON object from stdout, whose
// `systemMessage` and `hookSpecificOutput.additionalContext` reach the model
// on its next call (D-BG-205). Plain text is never an answer, and the exit
// code and any decision field decide nothing. Each text comes with the field
// it came from, which names its saved file when the text passes the
// 10,000-character cap (D-PG5-14). A pure leaf over untrusted hook output.

import { parseHookStdout } from "../wire-protocol.ts";

import type { BucketAEvent } from "../../../domain/components/hook-events.ts";
import type { HookContextSource } from "../context-cap.ts";

// A parsed JSON object, or undefined for anything else.
function jsonObject(text: string): Record<string, unknown> | undefined {
  try {
    const value: unknown = JSON.parse(text);
    return typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : undefined;
  } catch {
    // Not JSON: not an answer.
    return undefined;
  }
}

// The texts Claude Code tries as the answer, in its order: the whole stdout,
// or what follows a first `{"async": ...}` line, then each line.
function answerCandidates(stdout: string): string[] {
  const lines = stdout.split("\n").map((line) => line.trim());
  const first = jsonObject(lines.slice(0, 1).join(""));
  const whole =
    first !== undefined && "async" in first ? lines.slice(1).join("\n").trim() : stdout.trim();
  return [whole, ...lines];
}

/**
 * D-BG-205: the model texts of a plain async hook's answer, each with its
 * field: its non-empty `systemMessage`, then its non-empty
 * `hookSpecificOutput.additionalContext`. The answer is the first candidate
 * that is a JSON object without an `async` key; no answer gives no text.
 */
export function asyncAnswerTexts(
  stdout: string,
  event: BucketAEvent,
): readonly { readonly source: Exclude<HookContextSource, "stdout">; readonly text: string }[] {
  const answer = answerCandidates(stdout).find((candidate) => {
    const parsed = jsonObject(candidate);
    return parsed !== undefined && !("async" in parsed);
  });
  if (answer === undefined) {
    return [];
  }

  const { systemMessage, additionalContext } = parseHookStdout(0, answer, "", event);
  const fields = [
    ["systemMessage", systemMessage],
    ["additionalContext", additionalContext],
  ] as const;
  return fields.flatMap(([source, text]) =>
    typeof text === "string" && text !== "" ? [{ source, text }] : [],
  );
}

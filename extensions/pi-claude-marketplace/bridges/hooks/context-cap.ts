// bridges/hooks/context-cap.ts
//
// The limit Claude Code 2.1.323 puts on each string a hook gives the model as
// context: a string over 10,000 characters is saved whole, and the model
// receives a `<persisted-output>` wrapper with the saved file's path and a
// preview of its head (D-PG5-14, D-PG5-15). Length is the JavaScript string
// length, as upstream measures it. Each string is capped alone, before any
// join, by the one function both hook lanes call; the writer is a parameter
// (D-PG5-16). A pure leaf over untrusted hook output.

import { errorMessage } from "../../shared/errors.ts";

/** The field a capped string came from, which names its saved file. */
export type HookContextSource = "additionalContext" | "systemMessage" | "stdout";

const CONTEXT_LIMIT = 10_000;

const PREVIEW_LIMIT = 2_000;

// The em dash (U+2014) of Claude Code's write-failure line. It stays escaped
// because the fix-unicode-dashes hook rewrites a literal one.
const FAILURE_DASH = "\u2014";

// A preview that holds the wrapper's own tag could end the wrapper early, so
// each opener of it gets a backslash after its `<`, as upstream does.
const TAG_OPENER = /<(\/?persisted-output)/giu;

// The end of a cut at or before `end` that splits no surrogate pair.
function safeEnd(text: string, end: number): number {
  const code = Number(text.codePointAt(end - 1));
  return code > 0xffff ? end - 1 : end;
}

// Upstream's preview: up to the last line break of the first 2,000
// characters when that break lies past their middle, else 2,000 characters.
function previewOf(text: string): string {
  const lineBreak = text.slice(0, PREVIEW_LIMIT).lastIndexOf("\n");
  const end = lineBreak > PREVIEW_LIMIT / 2 ? lineBreak : PREVIEW_LIMIT;
  return text.slice(0, safeEnd(text, end)).replace(TAG_OPENER, String.raw`<\$1`);
}

function oneDecimal(value: number): string {
  return value.toFixed(1).replace(/\.0$/u, "");
}

// Upstream's size label, from the string length: `11.7KB` for 12,000.
function sizeLabel(length: number): string {
  const kilobytes = length / 1024;
  return kilobytes < 1024 ? `${oneDecimal(kilobytes)}KB` : `${oneDecimal(kilobytes / 1024)}MB`;
}

function persistedOutput(text: string, filePath: string): string {
  return [
    "<persisted-output>",
    `Output too large (${sizeLabel(text.length)}). Full output saved to: ${filePath}`,
    "",
    "Preview (first 2KB):",
    previewOf(text),
    "...",
    "</persisted-output>",
  ].join("\n");
}

// D-PG5-15: the head of the string and upstream's failure line, cut so that
// the whole stays within the limit, even for a long error text.
function truncatedText(text: string, source: HookContextSource, error: string): string {
  const marker =
    `\n\n[Hook ${source} truncated at ${CONTEXT_LIMIT} chars ${FAILURE_DASH} ` +
    `persist-to-disk failed: ${error}]`;
  const head = text.slice(0, safeEnd(text, Math.max(0, CONTEXT_LIMIT - marker.length)));
  const whole = head + marker;
  return whole.slice(0, safeEnd(whole, CONTEXT_LIMIT));
}

/**
 * D-PG5-14 to D-PG5-16: `text` when it has at most 10,000 characters; else
 * `write` saves it whole, and the result is the wrapper around the path it
 * resolves to. When `write` throws or rejects, the result is the head of
 * `text` and the failure line. Never rejects.
 */
export async function capHookContext(
  text: string,
  source: HookContextSource,
  write: (text: string) => Promise<string>,
): Promise<string> {
  if (text.length <= CONTEXT_LIMIT) {
    return text;
  }

  try {
    return persistedOutput(text, await write(text));
  } catch (error: unknown) {
    return truncatedText(text, source, errorMessage(error));
  }
}

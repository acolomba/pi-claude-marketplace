/**
 * @fileoverview Pi texts a scenario reads, reduced to the facts this
 * extension owns. Pi words the notices of its own tools itself, and a release
 * may reword them, so no feature file states that wording.
 *
 * - a read result keeps the text it read, which is the file this extension
 *   staged and filled, and shows the notice Pi ends a partial read with as
 *   `{read continuation}`, after a blank line.
 * - a tool call whose arguments Pi's validation refuses reads as
 *   `invalid arguments: <path>, <path>`: the refused argument paths, which
 *   are the tool's parameter names, each once and sorted.
 */

// Pi ends a partial read with one bracketed line on its own, after a blank
// line, that says how much of the file is left and where to continue. Pi
// words that line itself, so any bracketed last line that states a number
// reads as the notice. The number keeps a file line such as `[x]` out of it.
const CONTINUATION_PATTERN = /\n\s*\n\s*\[[^\n\]]*\d[^\n\]]*\]\s*$/u;

const CONTINUATION_TOKEN = "{read continuation}";

/** The text of one result of Pi's read tool as a scenario states it. */
export function projectReadResult(text: string, failed: boolean): string {
  if (failed) {
    return text;
  }

  return text.replace(CONTINUATION_PATTERN, `\n\n${CONTINUATION_TOKEN}`);
}

// Pi 1.5.0 refuses arguments with the first line `Validation failed for tool
// "<tool>":`, one indented `- <path>: <message>` line per refused argument,
// then a blank line and the arguments it received. Only that first line marks
// the refusal, so a failure text this extension writes, which may quote its
// tool's name and list items, stays exact.
const VALIDATION_PATH_PATTERN = /^\s+-\s+([^\s:]+):/u;

function validationFailureFirstLine(tool: string): string {
  return `Validation failed for tool "${tool}":`;
}

/**
 * The failure text of a call of `tool` whose arguments Pi's validation
 * refused, as a scenario states it, or `undefined` when `text` is not one.
 * Throws when `text` begins like one but names no path.
 */
export function projectArgumentValidationFailure(tool: string, text: string): string | undefined {
  const [first = "", ...rest] = text.split("\n");
  if (first.trimEnd() !== validationFailureFirstLine(tool)) {
    return undefined;
  }

  const blank = rest.findIndex((line) => line.trim() === "");
  const listed = blank === -1 ? rest : rest.slice(0, blank);
  const paths = listed.flatMap((line) => VALIDATION_PATH_PATTERN.exec(line)?.slice(1, 2) ?? []);
  if (paths.length === 0) {
    throw new Error(
      `cannot read Pi's argument validation failure of ${tool}: ${JSON.stringify(text)}`,
    );
  }

  const sorted = [...new Set(paths)].sort((left, right) => left.localeCompare(right));
  return `invalid arguments: ${sorted.join(", ")}`;
}

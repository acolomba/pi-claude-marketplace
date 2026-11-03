/**
 * @fileoverview Pi texts a scenario reads, reduced to the facts this
 * extension owns. Pi words the notices of its own tools itself, and a release
 * may reword them, so no feature file states that wording.
 *
 * - a read result keeps the text it read, which is the file this extension
 *   staged and filled, and shows the notice Pi ends a partial read with as
 *   `{read continuation}`, after a blank line.
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

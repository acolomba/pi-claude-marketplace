/**
 * shared/child-output.ts -- how a note shows what a child process printed.
 *
 * D-PL9-10: a failed plugin package install shows the package manager's own
 * output, compacted to one line and cut to 500 characters. D-SG-32: a failed
 * git command shows git's stderr under the same rule, so both kinds of child
 * output read alike.
 *
 * Leaf module: its only import is Node's `stripVTControlCharacters`, and it
 * keeps no module-level state.
 */

import { stripVTControlCharacters } from "node:util";

const NOTE_LIMIT = 500;
const NPM_WARN_LINE = /^npm warn\b/i;
const NPM_ERROR_PREFIX = /^npm (?:ERR!|error) ?/;

/**
 * D-PL9-10: the output as one line for a note: escape sequences and control
 * characters gone, blank lines dropped, and the lines joined with `"; "`.
 * npm's own `npm error` and `npm ERR!` prefixes are dropped, and npm's warning
 * lines are left out when anything else was printed, so the error is what the
 * 500-character cut keeps. Another tool's lines match neither npm rule and
 * stay as they are.
 */
export function compactOutput(output: string): string {
  const lines = stripVTControlCharacters(output)
    .split(/[\r\n]+/)
    .map((line) => line.replaceAll(/\p{Cc}/gu, " ").trim())
    .filter((line) => line !== "");
  const errors = lines.filter((line) => !NPM_WARN_LINE.test(line));
  return (errors.length > 0 ? errors : lines)
    .map((line) => line.replace(NPM_ERROR_PREFIX, ""))
    .join("; ");
}

/**
 * D-PL9-10, D-SG-32: `note` cut to 500 UTF-16 code units. `"head"` keeps the
 * first 500 and drops a trailing lone high surrogate; a package install keeps
 * the start of its note. `"tail"` keeps the last 500 and drops a leading lone
 * low surrogate; git output keeps its end, because git prints its reason on
 * its last line.
 */
export function boundedNote(note: string, keep: "head" | "tail"): string {
  if (keep === "head") {
    return note.slice(0, NOTE_LIMIT).replace(/[\uD800-\uDBFF]$/u, "");
  }

  return note.slice(-NOTE_LIMIT).replace(/^[\uDC00-\uDFFF]/u, "");
}

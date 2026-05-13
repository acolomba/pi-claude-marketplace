// edge/completions/normalize.ts
//
// TC-7 carry-forward from V1 (`extensions/pi-claude-marketplace/completions.ts`).
// Two exports + one internal regex:
//
//   * `normalizeCompletionWhitespace` -- collapse a run of spaces at the
//     cursor to a single space. Pi-tui's autocomplete inserts an item's
//     `value` verbatim and preserves any text already after the cursor, so
//     a value ending in a space combined with an existing space yields a
//     doubled run. This wrapper mirrors fish: collapse the run to one
//     space and leave the cursor on the next non-space character. No-op
//     when either side of the cursor is not a space, so non-trailing-space
//     completions and end-of-line cases are safe.
//
//   * `isClaudePluginCommandLine` -- true when `line` is invoking
//     `/claude:plugin`. Accepts Pi's collision-suffix form `:\d+` that gets
//     applied when multiple extensions register the same command name.
//     Used by `register.ts` (Plan 06-05) to scope the post-processor to
//     our own command.
//
//   * `CLAUDE_PLUGIN_LINE` regex (module-private) -- single source of truth
//     for the match shape.

const CLAUDE_PLUGIN_LINE = /^\/claude:plugin(?::\d+)?(?:\s|$)/;

export function normalizeCompletionWhitespace(result: {
  readonly lines: readonly string[];
  readonly cursorLine: number;
  readonly cursorCol: number;
}): { lines: string[]; cursorLine: number; cursorCol: number } {
  const lines = [...result.lines];
  const line = lines[result.cursorLine] ?? "";
  if (line[result.cursorCol - 1] !== " " || line[result.cursorCol] !== " ") {
    return { lines, cursorLine: result.cursorLine, cursorCol: result.cursorCol };
  }

  let n = 1;
  while (line[result.cursorCol + n] === " ") {
    n++;
  }

  lines[result.cursorLine] = line.slice(0, result.cursorCol) + line.slice(result.cursorCol + n);
  return { lines, cursorLine: result.cursorLine, cursorCol: result.cursorCol };
}

export function isClaudePluginCommandLine(line: string): boolean {
  return CLAUDE_PLUGIN_LINE.test(line);
}

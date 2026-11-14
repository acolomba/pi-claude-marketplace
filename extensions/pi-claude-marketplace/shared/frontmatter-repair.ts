// shared/frontmatter-repair.ts
//
// D-PG7-03: the line-based frontmatter helpers that the skills bridge and the
// agents bridge both need. They live here because fallow's zone boundaries
// forbid one bridge from importing another. The module imports nothing.

/**
 * Index of the closing fence as Pi 1.5.0's `parseFrontmatter` finds it
 * (`indexOf("\n---", 3)` in `dist/utils/frontmatter.js`): the first line after
 * the opening one that starts with `---` at column 0, or `lines.length`. An
 * indented `---` is block-scalar content to Pi, so no writer may stop there,
 * and a `----` line closes the block as it does for Pi.
 */
export function frontmatterBlockEnd(lines: readonly string[]): number {
  for (const [offset, line] of lines.slice(1).entries()) {
    if (line.startsWith("---")) {
      return offset + 1;
    }
  }

  return lines.length;
}

/** A column-0 explicit-key line, `? <key>`. */
const EXPLICIT_KEY = /^\?(\s|$)/;

/** The column-0 value line of an explicit key, `: <value>`. */
const EXPLICIT_VALUE = /^:(\s|$)/;

/**
 * Given a top-level key line at `keyIndex`, return the index of the LAST line
 * its value spans.
 *
 * A scalar value continues onto later lines for EVERY multi-line form -- block
 * (`>` / `|`, with or without a chomp or indent modifier), multi-line plain,
 * and multi-line single- or double-quoted -- and in all of them the
 * continuation lines are indented deeper than the column-0 key. So every
 * indented non-blank line up to `blockEnd` is absorbed, stopping at the first
 * line that returns to column 0: the next top-level key, or the closing fence.
 * An inline scalar has no continuation, so the following line is already at
 * column 0 and the key line itself is returned.
 *
 * CR-01 / WR-01: detecting the FULL node span for all multi-line forms, not
 * just block scalars, is what prevents orphaned continuation lines. Left
 * behind, they make gate-2 reject the staged bytes on the degrade path, and on
 * the rewrite path they fold into the parsed name and trip the SKILL-03 verify
 * (the `<gen> a b` corruption class).
 *
 * Trailing blank lines are NOT absorbed, so inter-key blank spacing survives
 * byte-for-byte. The one column-0 line a node absorbs is the `:` value line of
 * an explicit key (`? name` then `: x`).
 */
export function keyValueEnd(lines: readonly string[], keyIndex: number, blockEnd: number): number {
  let lastReplaced = keyIndex;
  let awaitingValue = false;
  for (const [offset, line] of lines.slice(keyIndex, blockEnd).entries()) {
    if (offset === 0) {
      // IN-01: an explicit key (`? name`) takes its value from the next column-0
      // `:` line, so that line belongs to the same node.
      awaitingValue = EXPLICIT_KEY.test(line);
      continue;
    }

    if (line.trim() === "") {
      continue;
    }

    if (/^\s/.test(line) || (awaitingValue && EXPLICIT_VALUE.test(line))) {
      awaitingValue &&= !EXPLICIT_VALUE.test(line);
      lastReplaced = keyIndex + offset;
      continue;
    }

    break;
  }

  return lastReplaced;
}

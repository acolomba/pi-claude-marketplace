// bridges/skills/frontmatter-scan.ts
//
// D-82-02: the shared LINE-BASED frontmatter scanners. Skill frontmatter is
// read and emitted line by line rather than through a YAML library, so both
// the degrade path and the name-rewrite path need the same two questions
// answered about a block: where it ends, and how far one key's value spans.
//
// Both files previously carried byte-identical copies of these, which meant a
// fix to the span rule had to be made twice or the two paths would disagree
// about the same bytes.

/** Index of the closing `---` fence (frontmatter block end), or `lines.length`. */
export function frontmatterBlockEnd(lines: readonly string[]): number {
  for (let i = 1; i < lines.length; i++) {
    if ((lines[i] ?? "").trim() === "---") {
      return i;
    }
  }

  return lines.length;
}

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
 * byte-for-byte.
 */
export function keyValueEnd(lines: readonly string[], keyIndex: number, blockEnd: number): number {
  let lastReplaced = keyIndex;
  for (let i = keyIndex + 1; i < blockEnd; i++) {
    const line = lines[i] ?? "";
    if (line.trim() === "") {
      continue;
    }

    if (/^\s/.test(line)) {
      lastReplaced = i;
      continue;
    }

    break;
  }

  return lastReplaced;
}

// bridges/skills/frontmatter-scan.ts
//
// D-82-02: the shared LINE-BASED frontmatter scanners. Skill frontmatter is
// read and emitted line by line rather than through a YAML library, so the
// degrade path, the name rewrite, and the record writer need the same two
// questions answered about a block: where it ends, and how far one key's value
// spans.
//
// This is the single shared module for every writer of the staging pipeline,
// so a fix to the fence, span, or key rule lands once instead of risking two
// writers disagreeing about the same bytes.

import { parseFrontmatter } from "../../platform/pi-api.ts";
import { SkillFrontmatterNodeError } from "../../shared/errors-bridges.ts";

/**
 * Index of the closing fence as Pi 1.4.0's `parseFrontmatter` finds it
 * (`indexOf("\n---", 3)` in `dist/utils/frontmatter.js`): the first line after
 * the opening one that starts with `---` at column 0, or `lines.length`. An
 * indented `---` is block-scalar content to Pi, so no writer may stop there,
 * and a `----` line closes the block as it does for Pi.
 */
export function frontmatterBlockEnd(lines: readonly string[]): number {
  for (let i = 1; i < lines.length; i++) {
    if ((lines[i] ?? "").startsWith("---")) {
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

/**
 * The keys of the top-level node `nodeLines`, or `undefined` when the node does
 * not parse alone, such as one whose value is an alias of an anchor in another
 * node. YAML spells one key in many ways (`"name":`, `'name':`, `name :`, an
 * escape inside quotes), and Pi's parser reads each as the same key, so the
 * node is parsed rather than matched as text.
 */
function nodeKeys(nodeLines: readonly string[]): readonly string[] | undefined {
  try {
    return Object.keys(parseFrontmatter(["---", ...nodeLines, "---"].join("\n")).frontmatter);
  } catch {
    return undefined;
  }
}

/**
 * Index of the first top-level node of `key` inside the block that ends at
 * `blockEnd`, or `-1`. Every column-0 line of the block starts a top-level
 * node, because a node's continuation lines are indented (`keyValueEnd`). A
 * node that does not parse alone holds `key` only in its plain spelling
 * `<key>:`.
 *
 * WR-05: a node that holds `key` beside other keys, such as a flow mapping
 * `{name: x, description: y}`, throws `SkillFrontmatterNodeError`. Replacing
 * that node would drop the other keys, and inserting a second `key` would
 * make the frontmatter invalid.
 */
export function topLevelNodeIndex(lines: readonly string[], blockEnd: number, key: string): number {
  for (let i = 1; i < blockEnd; i++) {
    const line = lines[i] ?? "";
    if (!/^\S/.test(line)) {
      continue;
    }

    const keys = nodeKeys(lines.slice(i, keyValueEnd(lines, i, blockEnd) + 1));
    if (keys === undefined ? line.startsWith(`${key}:`) : keys.includes(key)) {
      if (keys !== undefined && keys.length > 1) {
        throw new SkillFrontmatterNodeError(key, i + 1, keys);
      }

      return i;
    }
  }

  return -1;
}

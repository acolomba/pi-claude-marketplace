// bridges/skills/frontmatter-scan.ts
//
// D-82-02: the top-level node lookup of the line-based skill frontmatter
// writers. Skill frontmatter is read and emitted line by line rather than
// through a YAML library, so the degrade path, the name rewrite, and the
// record writer ask where one key's node sits; the lookup parses each node with
// Pi to recognize every YAML spelling of the key. The fence and span scanners
// it relies on live in shared/frontmatter-repair.ts (D-PG7-03).

import { parseFrontmatter } from "../../platform/pi-api.ts";
import { SkillFrontmatterNodeError } from "../../shared/errors-bridges.ts";
import { keyValueEnd } from "../../shared/frontmatter-repair.ts";

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
  for (const [offset, line] of lines.slice(1, blockEnd).entries()) {
    const i = offset + 1;
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

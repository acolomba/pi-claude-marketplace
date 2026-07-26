// bridges/skills/rewrite-frontmatter.ts
//
// SK-3: rewrite the `name:` field in a SKILL.md frontmatter block, preserve
// every other frontmatter field, and add a frontmatter block when the source
// file has none. The rewrite is pure string manipulation -- no YAML eval -- so
// untrusted plugin-author content cannot inject behavior (T-03-17 mitigation).
// The only parse is a READ-ONLY backstop that VALIDATES the written name
// (SKILL-03): parse-to-verify is not evaluating.

import { parseFrontmatter } from "../../platform/pi-api.ts";

/** The top-level frontmatter `name` key token (including its colon). */
const NAME_KEY = "name:";

/** A fresh `name`-only frontmatter block prepended ahead of `content`. */
function freshBlock(newName: string, content: string): string {
  return `---\nname: ${newName}\n---\n\n${content}`;
}

/** Index of the closing `---` fence (frontmatter block end), or `lines.length`. */
function frontmatterBlockEnd(lines: readonly string[]): number {
  for (let i = 1; i < lines.length; i++) {
    if ((lines[i] ?? "").trim() === "---") {
      return i;
    }
  }

  return lines.length;
}

/**
 * Given the `name` key line at `keyIndex`, return the index of the LAST line its
 * value spans. A scalar value continues onto later lines for EVERY multi-line
 * form -- block (`>` / `|`, optionally with a chomp / indent modifier),
 * multi-line plain, and multi-line single/double-quoted -- and in all of them
 * the continuation lines are indented deeper than the column-0 key. Absorb every
 * indented (non-blank) continuation line up to `blockEnd`, stopping at the first
 * line that returns to column 0. An inline scalar has no continuation, so the
 * key line itself is returned. Absorbing the full node span for all multi-line
 * forms -- not just block scalars (WR-01) -- prevents a multi-line source `name:`
 * from leaving orphaned prose that folds into the parsed name and trips the
 * SKILL-03 verify (the corruption class, e.g. `<gen> a b`).
 */
function nameValueEnd(lines: readonly string[], keyIndex: number, blockEnd: number): number {
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
 * Replace (or insert) the `name` field inside a frontmatter block that opens on
 * `lines[0]` and closes at the next `---`. Replaces the FULL `name` node span --
 * including any multi-line scalar (block `>` / `|`, multi-line plain, or
 * multi-line quoted) spanning several lines -- with a single inline
 * `name: <newName>`, leaving every sibling key untouched.
 * When no `name:` key exists it is inserted as the first frontmatter line.
 */
function rewriteNameNode(content: string, newName: string): string {
  const lines = content.split("\n");
  const blockEnd = frontmatterBlockEnd(lines);

  let keyIndex = -1;
  for (let i = 1; i < blockEnd; i++) {
    if ((lines[i] ?? "").startsWith(NAME_KEY)) {
      keyIndex = i;
      break;
    }
  }

  const replacement = `${NAME_KEY} ${newName}`;
  if (keyIndex === -1) {
    return [lines[0], replacement, ...lines.slice(1)].join("\n");
  }

  const lastReplaced = nameValueEnd(lines, keyIndex, blockEnd);
  return [...lines.slice(0, keyIndex), replacement, ...lines.slice(lastReplaced + 1)].join("\n");
}

/**
 * Rewrite the `name:` field in a SKILL.md frontmatter block to `newName`.
 *
 * Behavior:
 *   - If `content` does not start with `---`, prepend a fresh frontmatter block
 *     with only `name: <newName>`.
 *   - If `content` starts with `---` but no closing `\n---` is found, treat it
 *     as malformed and prepend a fresh frontmatter block.
 *   - Otherwise replace the full `name` node span (folded / block scalars
 *     included) with an inline `name: <newName>`, or insert one when absent, so
 *     all other fields survive.
 *
 * SKILL-03 backstop: the result is re-parsed with Pi's own `parseFrontmatter`
 * and the parsed `name` MUST equal `newName`; a mismatch is our own defect
 * (never a silently wrong-named skill) and throws loudly.
 */
export function rewriteFrontmatterName(content: string, newName: string): string {
  let result: string;
  if (!content.startsWith("---") || !content.includes("\n---", 3)) {
    result = freshBlock(newName, content);
  } else {
    result = rewriteNameNode(content, newName);
  }

  // SKILL-03: verify the WRITTEN name against the re-parsed value, never a blind
  // `^name:` line match -- a folded / multi-line source scalar cannot silently
  // corrupt the generated name.
  const { frontmatter } = parseFrontmatter(result);
  if (frontmatter.name !== newName) {
    throw new Error(
      `Skill name rewrite produced ${JSON.stringify(frontmatter.name)}, ` +
        `expected the generated name ${JSON.stringify(newName)}.`,
    );
  }

  return result;
}

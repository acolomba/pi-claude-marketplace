// bridges/skills/rewrite-frontmatter.ts
//
// SK-3: rewrite the `name:` field in a SKILL.md frontmatter block, preserve
// every other frontmatter field, and add a frontmatter block when the source
// file has none. Pure string manipulation -- no YAML parsing, no eval -- so
// untrusted plugin-author content cannot inject behavior (T-03-17 mitigation).
//
// Carry-forward verbatim from V1 `resource/stage.ts::rewriteFrontmatterName`
// (lines 294-320; PATTERNS.md lines 173-193).

/**
 * Rewrite the `name:` field in a SKILL.md frontmatter block to `newName`.
 *
 * Behavior (V1 verbatim):
 *   - If `content` does not start with `---`, prepend a fresh frontmatter
 *     block with only `name: <newName>`.
 *   - If `content` starts with `---` but no closing `\n---` is found, treat
 *     it as malformed and prepend a fresh frontmatter block.
 *   - If a `name:` line exists in the frontmatter, replace it (multiline regex,
 *     anchored to line start).
 *   - If no `name:` line exists, prepend `\nname: <newName>` to the
 *     frontmatter body so all other fields survive.
 */
export function rewriteFrontmatterName(content: string, newName: string): string {
  if (!content.startsWith("---")) {
    return `---\nname: ${newName}\n---\n\n${content}`;
  }

  const end = content.indexOf("\n---", 3);
  if (end === -1) {
    return `---\nname: ${newName}\n---\n\n${content}`;
  }

  const frontmatter = content.slice(3, end);
  const body = content.slice(end + 4);
  const nameRegex = /^name:.*$/m;

  let newFrontmatter: string;
  if (nameRegex.test(frontmatter)) {
    newFrontmatter = frontmatter.replace(nameRegex, `name: ${newName}`);
  } else {
    newFrontmatter = `\nname: ${newName}` + frontmatter;
  }

  return `---${newFrontmatter}\n---${body}`;
}

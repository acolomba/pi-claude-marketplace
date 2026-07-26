// bridges/skills/frontmatter-degrade.ts
//
// Pure string-in / string-out helpers for the skills degrade + augment arms.
// Every function is READ-ONLY toward author input: it reads bytes to VALIDATE
// or COMPUTE a value, never `eval`s or executes them, so the T-03-17
// injection-safety property is preserved (reading-to-validate is not
// evaluating). The only bytes these helpers EMIT into a frontmatter position
// (`setDescriptionScalar`, `synthesizeUnparseableSkill`) go through the safe
// double-quoted scalar emitter or are fixed YAML-safe constants, so an author
// value can never re-form a new YAML key (the AG-8 provenance-injection class).
//
// This module deliberately does NOT re-emit the whole frontmatter block (the
// agents-bridge `emitGeneratedAgentFile` approach): skills' target is real
// structured YAML, and a whole-block re-emit flattens nested maps / block
// scalars / flow collections, breaking the NREG-01 byte-for-byte invariant on
// the ~99% happy path. `setDescriptionScalar` instead replaces exactly the
// `description` node span and leaves every sibling key byte-identical.

/**
 * SKILL-01 / D-86-02 / A4: the fixed placeholder description synthesized onto an
 * unparseable skill. A short YAML-safe constant -- NOT interpolated with plugin
 * or source names. The skill carries `disable-model-invocation: true`, so this
 * string is excluded from the model listing and costs zero context; it exists
 * only to clear Pi's non-empty-`description` gate. The actionable detail (plugin,
 * component, parse error) rides the install-time warning channel instead.
 */
const UNPARSEABLE_SKILL_DESCRIPTION = "Source frontmatter could not be parsed.";

/**
 * WTU-02 / D-86-05 / A2: the combined `description` + `when_to_use` listing cap,
 * in JS `.length` UTF-16 code units, matching Claude Code's 1,536-char skill
 * listing budget. Kept at 1,536 even though Pi's loader emits a non-fatal
 * warning above 1,024 -- truncating to 1,024 would silently drop trigger
 * keywords and diverge from Claude Code.
 */
const LISTING_CAP = 1536;

/**
 * SKILL-01 / D-86-02: synthesize a known-good frontmatter block for a skill
 * whose SOURCE frontmatter could not be parsed. Emits the generated `name`, the
 * fixed placeholder `description`, and `disable-model-invocation: true`, then
 * appends the markdown body verbatim. The block is byte-shaped so Pi's own
 * `parseFrontmatter` accepts it (gate-2 backstop). `generatedName` is an
 * `assertSafeName`-checked token upstream, so it needs no escaping.
 */
export function synthesizeUnparseableSkill(body: string, generatedName: string): string {
  return (
    "---\n" +
    `name: ${generatedName}\n` +
    `description: ${UNPARSEABLE_SKILL_DESCRIPTION}\n` +
    "disable-model-invocation: true\n" +
    "---\n\n" +
    body
  );
}

/**
 * SKILL-02 / D-86-06: derive a `description` from the first GENUINE body line.
 * Skips blank lines, ATX `#` heading lines, and fenced code blocks (```` ``` ````
 * / `~~~` and their contents), lands on the first plain body line, and returns
 * the contiguous paragraph up to the next blank line (verbatim, joined by
 * `\n`). Returns `""` when the body has no prose (all blank / heading / fence).
 * Mirrors Claude Code's "first paragraph of markdown content" fallback.
 */
export function firstBodyParagraph(body: string): string {
  const lines = body.split("\n");
  let i = 0;
  while (i < lines.length) {
    const trimmed = lines[i]!.trim();

    if (trimmed === "") {
      i++;
      continue;
    }

    // ATX heading line (`#` .. `######`, optionally bare).
    if (/^#{1,6}(\s|$)/.test(trimmed)) {
      i++;
      continue;
    }

    // Fenced code block: skip the opener, its contents, and the closing fence.
    if (/^(```|~~~)/.test(trimmed)) {
      i++;
      while (i < lines.length && !/^(```|~~~)/.test(lines[i]!.trim())) {
        i++;
      }

      // Consume the closing fence line if present.
      if (i < lines.length) {
        i++;
      }

      continue;
    }

    // First prose line: collect the contiguous paragraph to the next blank line.
    const paragraph: string[] = [];
    while (i < lines.length && lines[i]!.trim() !== "") {
      paragraph.push(lines[i]!);
      i++;
    }

    return paragraph.join("\n");
  }

  return "";
}

/**
 * WTU-01 / A1: fold `when_to_use` into the Pi `description`. An empty or absent
 * `whenToUse` returns `description` unchanged (no trailing separator); a
 * non-empty one appends it after a single `\n` separator. Operates on JS string
 * values (UTF-16 code units) with no byte/codepoint reinterpretation.
 */
export function foldWhenToUse(description: string, whenToUse: string | undefined): string {
  if (whenToUse === undefined || whenToUse === "") {
    return description;
  }

  return `${description}\n${whenToUse}`;
}

/**
 * WTU-02 / A2: hard-cut `text` at the 1,536 UTF-16-code-unit listing cap. Text
 * at or below the cap is returned unchanged; longer text is cut to exactly the
 * first 1,536 code units with no ellipsis. Empty input returns empty.
 */
export function truncate1536(text: string): string {
  return text.length <= LISTING_CAP ? text : text.slice(0, LISTING_CAP);
}

/**
 * Emit `value` as a safe double-quoted single-line YAML scalar. Embedded
 * newlines collapse to spaces, then `\` and `"` are escaped, so the emitted
 * scalar cannot re-form a new YAML key on a following line (the AG-8
 * provenance-injection class). Backslashes are escaped BEFORE quotes so an
 * author `"` is not double-processed.
 */
function emitSafeDoubleQuotedScalar(value: string): string {
  const oneLine = value.replace(/\r?\n/g, " ");
  const escaped = oneLine.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${escaped}"`;
}

/**
 * SKILL-03 class: set the frontmatter `description` to `value` by replacing the
 * FULL `description` node span -- including a `>-` / `|` block scalar spanning
 * several lines -- with a single safe double-quoted scalar, leaving every
 * sibling key byte-identical. NEVER a lone `^description:.*$` line replace (that
 * corrupts a multi-line block scalar by orphaning its continuation lines -- the
 * SKILL-03 corruption class). `content` is the full source file (with `---`
 * fences); the returned string is the same file with the description node
 * rewritten. If no top-level `description:` key is present the content is
 * returned unchanged.
 *
 * Node-span scan: locate the top-level (zero-indent) `description:` line. If its
 * inline value is a block-scalar indicator (`>` / `|`, optionally with a chomp /
 * indent modifier), consume the following continuation lines -- blank lines and
 * lines indented under the key -- up to the last indented content line (trailing
 * blank lines are left intact so inter-key spacing survives). The key line
 * through that last continuation line are replaced by a single
 * `description: "<escaped>"` line.
 */
export function setDescriptionScalar(content: string, value: string): string {
  const lines = content.split("\n");

  // The frontmatter block is between the opening `---` (line 0) and the next
  // `---` line. Only scan for the key inside that block so a body line that
  // happens to start with `description:` is never matched.
  if (lines[0]?.trim() !== "---") {
    return content;
  }

  let blockEnd = lines.length;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]!.trim() === "---") {
      blockEnd = i;
      break;
    }
  }

  let keyIndex = -1;
  for (let i = 1; i < blockEnd; i++) {
    if (/^description:/.test(lines[i]!)) {
      keyIndex = i;
      break;
    }
  }

  if (keyIndex === -1) {
    return content;
  }

  const inlineValue = lines[keyIndex]!.slice("description:".length).trim();
  const isBlockScalar = /^[>|]/.test(inlineValue);

  let lastReplaced = keyIndex;
  if (isBlockScalar) {
    // Consume block-scalar continuation lines: blank or indented, up to (but not
    // including) the next zero-indent key or the closing delimiter. Trailing
    // blank lines are NOT absorbed -- lastReplaced tracks the last indented
    // content line so inter-key blank spacing is preserved byte-for-byte.
    for (let i = keyIndex + 1; i < blockEnd; i++) {
      const line = lines[i]!;
      if (line.trim() === "") {
        continue;
      }

      if (/^\s/.test(line)) {
        lastReplaced = i;
        continue;
      }

      break;
    }
  }

  const replacement = `description: ${emitSafeDoubleQuotedScalar(value)}`;
  const rebuilt = [...lines.slice(0, keyIndex), replacement, ...lines.slice(lastReplaced + 1)];
  return rebuilt.join("\n");
}

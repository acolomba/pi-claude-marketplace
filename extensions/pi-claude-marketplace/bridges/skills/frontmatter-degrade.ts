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

import {
  emitSafeDoubleQuotedScalar,
  frontmatterBlockEnd,
  keyValueEnd,
} from "../../shared/frontmatter-repair.ts";

import { topLevelNodeIndex } from "./frontmatter-scan.ts";

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

/** A first line that is `---` once surrounding whitespace is trimmed. */
const FIRST_LINE_FENCE = /^[^\S\n]*---[^\S\n]*(?:\n|$)/;

/** The top-level frontmatter `description` key token (including its colon) that the writer emits. */
const DESCRIPTION_KEY = "description:";

/**
 * SKILL-03 class: set the frontmatter `description` to `value` by replacing the
 * FULL `description` node span -- including any multi-line scalar (block `>-` /
 * `|`, multi-line plain, or multi-line quoted) spanning several lines -- with a
 * single safe double-quoted scalar, leaving every sibling key byte-identical.
 * NEVER a lone `^description:.*$` line replace (that corrupts a multi-line
 * scalar by orphaning its continuation lines -- the SKILL-03 / CR-01 corruption
 * class). `content` is the full source file (with `---`
 * fences); the returned string is the same file with the description node
 * rewritten. When no top-level `description:` key is present the scalar is
 * INSERTED as the last frontmatter line (SKILL-02 fill for a description-less
 * source). Only the frontmatter block (opening `---` through Pi's closing fence)
 * is scanned, so a body line starting with `description:` is never matched. The
 * node is found in any YAML spelling of its key (`"description":`,
 * `description :`), as Pi reads it. Content
 * without an opening `---` fence is returned unchanged.
 */
export function setDescriptionScalar(content: string, value: string): string {
  if (!FIRST_LINE_FENCE.test(content)) {
    return content;
  }

  const lines = content.split("\n");
  const blockEnd = frontmatterBlockEnd(lines);
  const keyIndex = topLevelNodeIndex(lines, blockEnd, "description");
  const replacement = `${DESCRIPTION_KEY} ${emitSafeDoubleQuotedScalar(value)}`;

  // SKILL-02: a description-less source has no `description:` key to replace.
  // Insert one as the last frontmatter line (just before the closing `---`),
  // preserving sibling key order. Only reached when the augment arm has a
  // non-empty value to fill; NREG-01 keeps a present-and-unchanged description
  // out of this function entirely.
  if (keyIndex === -1) {
    const rebuilt = [...lines.slice(0, blockEnd), replacement, ...lines.slice(blockEnd)];
    return rebuilt.join("\n");
  }

  const lastReplaced = keyValueEnd(lines, keyIndex, blockEnd);
  const rebuilt = [...lines.slice(0, keyIndex), replacement, ...lines.slice(lastReplaced + 1)];
  return rebuilt.join("\n");
}

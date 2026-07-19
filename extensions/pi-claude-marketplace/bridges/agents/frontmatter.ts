// bridges/agents/frontmatter.ts
//
// Owns the input + output sides of pi-subagents' frontmatter format.
// GENERATED_AGENT_MARKER is re-exported from ./marker.ts rather than
// redefined here, so the constant has a single source of truth (see
// marker.ts -- markers-snapshot test asserts byte-for-byte equality).
//
// On the OUTPUT side, this module is the only place in the extension that
// decides how generated agent files are assembled: which scalars get
// quote-flipped, which strings get HTML-comment-escaped, and what the
// deterministic field order looks like. convertAgent does the field
// mapping but delegates the final byte assembly here.
//
// On the INPUT side, parseFrontmatter mirrors pi-subagents' own line-based
// key:value parser so we can read source agents the same way pi-subagents
// will read what we write back. The parser is deliberately naive (no nested
// YAML, no list-of-dash arrays) -- pi-subagents is what we round-trip
// through, not real YAML.
//
// AG-6 contract: tolerates `:` in description values (line-based parser
// splits on FIRST `:`, value side is taken verbatim).
// AG-8 contract: emitYamlScalar quote-flip + sanitizeProvenance --> -> --&gt;
// escape so a source path containing `-->` cannot terminate the comment.

import { GENERATED_AGENT_MARKER } from "./marker.ts";

import type { RawAgentFrontmatter } from "./types.ts";

// Re-export so consumers can import from one module rather than knowing
// which agents/* file owns the constant.
export { GENERATED_AGENT_MARKER } from "./marker.ts";

/**
 * Emit a free-text scalar in pi-subagents' frontmatter form.
 *
 * pi-subagents' parser is line-based key:value and naively strips a single
 * surrounding pair of matching quotes (`"..."` or `'...'`). If the source
 * description happens to start AND end with the same quote char, those quotes
 * would be stripped and the round-trip would lose them; and any embedded
 * newline (theoretically impossible for our line-based source parser, but
 * cheap to guard) would be misread as a key on the next line. We normalize
 * newlines to spaces and wrap in the opposing quote char only when needed.
 */
export function emitYamlScalar(value: string): string {
  const oneLine = value.replace(/\r?\n/g, " ");
  if (oneLine.startsWith('"') && oneLine.endsWith('"')) {
    return `'${oneLine}'`;
  }

  if (oneLine.startsWith("'") && oneLine.endsWith("'")) {
    return `"${oneLine}"`;
  }

  return oneLine;
}

/**
 * Sanitize a provenance comment field so a literal `-->` cannot terminate
 * the surrounding HTML comment early. The provenance block is purely
 * informational; safe to mangle the rare token.
 */
export function sanitizeProvenance(value: string): string {
  return value.replaceAll("-->", "--&gt;");
}

export interface ParsedFrontmatter {
  readonly raw: RawAgentFrontmatter;
  readonly body: string;
}

/**
 * AG-6: parse simple `key: value` frontmatter delimited by `---` lines.
 * No nested YAML, no list-of-dash arrays. Comma-separated lists stay raw.
 * Tolerates `:` inside the value (split on FIRST `:` only).
 */
export function parseFrontmatter(text: string): ParsedFrontmatter {
  // Frontmatter must start with `---` on its own line at the very top.
  // Accept `---\n` or `---\r\n` and also a bare `---` followed by EOF.
  const startMatch = /^---\r?\n/.exec(text);
  if (startMatch === null) {
    return { raw: {}, body: normalizeBody(text) };
  }

  const afterOpen = text.slice(startMatch[0].length);
  // Find the closing `---` on its own line.
  const closeMatch = /\n---\r?\n?/.exec(afterOpen);
  if (closeMatch === null) {
    // No closing delimiter -- treat whole file as body.
    return { raw: {}, body: normalizeBody(text) };
  }

  const fmText = afterOpen.slice(0, closeMatch.index);
  const body = afterOpen.slice(closeMatch.index + closeMatch[0].length);

  const raw: Record<string, string> = {};
  const state: FoldState = { lastKey: null, lastKeyFoldable: false };
  for (const rawLine of fmText.split(/\r?\n/)) {
    applyFrontmatterLine(raw, state, rawLine);
  }

  return { raw: raw, body: normalizeBody(body) };
}

/**
 * AGSK-01 (#86) dash-list folding state: lastKey is the most recently
 * parsed key; lastKeyFoldable is true only while that key's value is
 * empty or built entirely from folded dash items, so an inline value
 * wins and dash items beneath it are ignored (D-82-03).
 */
interface FoldState {
  lastKey: string | null;
  lastKeyFoldable: boolean;
}

/**
 * Parse one trimmed frontmatter line into `raw`, updating the fold state.
 *
 * Dash continuation lines fold BEFORE the colon split so an item like
 * `- spec-tree:review-changes` is taken verbatim, never colon-split (#86).
 * Items are comma-joined for downstream CSV splitting; quotes stay intact
 * (splitCsv strips per-item quotes). Known limitation: an item containing
 * a literal comma would split into two tokens downstream (D-82-02 scan
 * found none in the wild).
 */
function applyFrontmatterLine(
  raw: Record<string, string>,
  state: FoldState,
  rawLine: string,
): void {
  const line = rawLine.trim();
  if (line === "") {
    return;
  }

  if (line.startsWith("- ") || line === "-") {
    const item = line === "-" ? "" : line.slice(2).trim();
    if (state.lastKey !== null && state.lastKeyFoldable && item !== "") {
      const current = raw[state.lastKey] ?? "";
      raw[state.lastKey] = current === "" ? item : `${current},${item}`;
    }

    return;
  }

  const colon = line.indexOf(":");
  if (colon === -1) {
    return;
  }

  const key = line.slice(0, colon).trim();
  const value = line.slice(colon + 1).trim();
  if (key === "") {
    return;
  }

  raw[key] = value;
  state.lastKey = key;
  state.lastKeyFoldable = value === "";
}

/**
 * Normalize the body to begin with at most a single leading newline so the
 * generated file's blank-line-before-body is deterministic.
 */
export function normalizeBody(body: string): string {
  return body.replace(/^\r?\n+/, "\n");
}

/**
 * Structured frontmatter fields for a generated agent. Identifiers
 * (name, model, tools, thinking, skills) are drawn from validated enums or
 * assertSafeName-checked tokens; only `description` is free text and goes
 * through emitYamlScalar.
 */
export interface GeneratedFrontmatterFields {
  readonly name: string;
  readonly description: string;
  readonly model?: string;
  readonly tools: readonly string[];
  readonly thinking?: string;
  readonly skills: readonly string[];
}

/**
 * Provenance fields rendered into the HTML comment block. All free-text
 * fields are sanitized so a literal `-->` cannot terminate the comment
 * early.
 */
export interface GeneratedProvenanceFields {
  readonly pluginName: string;
  readonly sourceName: string;
  readonly sourcePath: string;
  readonly originalModel?: string;
  readonly droppedFields: readonly string[];
  readonly droppedTools: readonly string[];
  readonly warnings: readonly string[];
}

/**
 * Assemble the generated agent file.
 *
 * The frontmatter MUST be the first thing in the file: pi-subagents'
 * parser only honors frontmatter when the file starts with `---`. The
 * provenance comment goes into the body so it remains human-visible (and
 * the GENERATED_AGENT_MARKER substring is still in the file for safety
 * checks before overwrite/delete).
 *
 *   <generated frontmatter>\n   (already ends with "---\n")
 *   \n
 *   <provenance comment>\n
 *   <body>
 *
 * AG-8 deterministic field order: name, description, model, tools,
 * thinking, skills, systemPromptMode, inheritProjectContext, inheritSkills.
 */
export function emitGeneratedAgentFile(input: {
  frontmatter: GeneratedFrontmatterFields;
  provenance: GeneratedProvenanceFields;
  body: string;
}): string {
  const { frontmatter, provenance, body } = input;

  // Frontmatter block in deterministic order. systemPromptMode /
  // inheritProjectContext / inheritSkills are extension-side defaults and
  // intentionally hardcoded -- they describe how this bridge interacts with
  // pi-subagents and are not derived from the source agent.
  const lines: string[] = [
    `name: ${frontmatter.name}`,
    `description: ${emitYamlScalar(frontmatter.description)}`,
  ];
  if (frontmatter.model !== undefined) {
    lines.push(`model: ${frontmatter.model}`);
  }

  lines.push(`tools: ${frontmatter.tools.join(",")}`);
  if (frontmatter.thinking !== undefined) {
    lines.push(`thinking: ${frontmatter.thinking}`);
  }

  if (frontmatter.skills.length > 0) {
    lines.push(`skills: ${frontmatter.skills.join(",")}`);
  }

  lines.push("systemPromptMode: replace", "inheritProjectContext: true", "inheritSkills: false");
  const generatedFrontmatter = "---\n" + lines.join("\n") + "\n---\n";

  // Provenance HTML comment. Free-text fields are sanitized so a literal
  // `-->` can't terminate the surrounding HTML comment early.
  const provenanceLines: string[] = [
    "<!--",
    GENERATED_AGENT_MARKER,
    `plugin: ${provenance.pluginName}`,
    `sourceAgent: ${provenance.sourceName}`,
    `sourcePath: ${sanitizeProvenance(provenance.sourcePath)}`,
  ];
  if (provenance.originalModel !== undefined) {
    provenanceLines.push(`originalModel: ${sanitizeProvenance(provenance.originalModel)}`);
  }

  provenanceLines.push(
    `droppedFields: ${formatOptionalProvenanceList(provenance.droppedFields)}`,
    `droppedTools: ${formatOptionalProvenanceList(provenance.droppedTools)}`,
    `warnings: ${formatOptionalProvenanceList(provenance.warnings)}`,
    "-->",
  );
  const provenanceComment = provenanceLines.join("\n") + "\n";

  // Body: ensure exactly one leading blank line and a trailing newline so
  // the generated file has deterministic separators around the comment.
  const bodyWithLeadingBlank = body.startsWith("\n") ? body : "\n" + body;
  const bodyFinal = bodyWithLeadingBlank.endsWith("\n")
    ? bodyWithLeadingBlank
    : bodyWithLeadingBlank + "\n";

  return generatedFrontmatter + "\n" + provenanceComment + bodyFinal;
}

function formatOptionalProvenanceList(values: readonly string[]): string {
  return values.length === 0 ? "(none)" : sanitizeProvenance(values.join(", "));
}

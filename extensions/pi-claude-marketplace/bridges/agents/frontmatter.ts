// bridges/agents/frontmatter.ts
//
// Owns the input + output sides of pi-subagents' frontmatter format.
// GENERATED_AGENT_MARKER is re-exported from ./marker.ts rather than
// redefined here, so the constant has a single source of truth (see
// marker.ts -- markers-snapshot test asserts byte-for-byte equality).
//
// On the OUTPUT side, this module is the only place in the extension that
// decides how generated agent files are assembled: which scalars get
// quote-flipped, which provenance values get newline-normalized, and what
// the deterministic field order looks like. convertAgent does the field
// mapping but delegates the final byte assembly here.
//
// On the INPUT side, parseFrontmatter reads a source agent with an
// indent-aware line parser. Only a column-0 `key: value` line starts a key;
// every blank or indented line beneath one is a continuation line and is
// never lifted into a key of its own (#155). A value of `>` or `|`, with or
// without a chomping indicator and an explicit indentation digit (`>-`,
// `>+`, `>2`, `|-`, `|+`, `|2`), opens a block scalar: the `>` family folds
// its continuation lines into one paragraph, the `|` family keeps their
// newlines. A key with an EMPTY inline value opens an implicit block whose
// shape the first continuation line decides -- `- item` lines fold into that
// key's comma-joined value, for ANY key (AGSK-01, #86, D-82-01), and anything
// else is collected as a plain multi-line value. A non-empty inline value
// wins: dash items beneath it are ignored (D-82-03).
//
// Reading block scalars does not make this a real YAML parser (D-82-02) --
// pi-subagents is what we round-trip through, and we never EMIT a block
// scalar. emitYamlScalar collapses a multi-line value back onto one line
// (AG-8), so a continuation line that reads like `key: value` cannot become
// a frontmatter key in what pi-subagents parses back.
//
// AG-6 contract: tolerates `:` in description values (split on the FIRST
// `:`, value side taken verbatim, quotes included).
// AG-8 contract: emitYamlScalar quote-flip + sanitizeProvenanceValue newline
// normalization so a multi-line provenance value cannot be misread as a new
// frontmatter key by pi-subagents' line-based parser.

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
 * Normalize a free-text provenance value to a single line so it cannot be
 * misread as a new frontmatter key by pi-subagents' line-based parser.
 * Provenance values are purely informational; collapsing an embedded
 * newline to a space is safe.
 */
export function sanitizeProvenanceValue(value: string): string {
  return value.replace(/\r?\n/g, " ");
}

export interface ParsedFrontmatter {
  readonly raw: RawAgentFrontmatter;
  readonly body: string;
}

/**
 * AG-6: parse `key: value` frontmatter delimited by `---` lines.
 *
 * Only a column-0 line starts a key, and the value side is taken verbatim
 * after the FIRST `:`, so a `:` inside a description survives and quotes are
 * never stripped. Comma-separated lists stay raw. Nested mappings are not
 * resolved (D-82-02): an indented block stays one string value on its parent
 * key rather than becoming keys of its own (#155).
 *
 * A value of `>` or `|`, optionally carrying a `+`/`-` chomping indicator and
 * an explicit indentation digit, opens a block scalar over the lines beneath
 * it -- `>` folds them into one paragraph, `|` keeps their newlines.
 *
 * AGSK-01 (#86): a key with an empty inline value followed by `- item`
 * lines folds the items into a comma-joined value, for any key (D-82-01).
 * Items are taken verbatim, never colon-split, and a dash line under an
 * explicit block header is block text rather than an item. A non-empty inline
 * value wins -- dash items beneath it are ignored (D-82-03). Known
 * limitation: an item containing a literal comma splits into two tokens
 * downstream.
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
  const state: ParseState = {
    lastKey: null,
    lastKeyFoldable: false,
    awaitingKey: null,
    pending: null,
  };
  for (const rawLine of fmText.split(/\r?\n/)) {
    applyFrontmatterLine(raw, state, rawLine);
  }

  // A block that runs to the closing `---` has no column-0 line to terminate
  // it, so the last one is flushed here.
  flushPendingBlock(raw, state);

  return { raw: raw, body: normalizeBody(body) };
}

/** A leading space or tab marks a continuation line; column 0 starts keys. */
const INDENTED_LINE = /^[ \t]/;

/**
 * A block scalar header: `>` or `|`, an optional `+`/`-` chomping indicator,
 * and an optional explicit indentation digit. Broader than the four forms
 * pi-subagents recognizes, because source agents are hand-authored real YAML
 * and Claude Code accepts all eight (#155). Anchored and free of quantified
 * alternation, so it cannot backtrack over attacker-supplied plugin text.
 */
const BLOCK_SCALAR_HEADER = /^[>|][+-]?\d*$/;

/**
 * The block value currently being collected: the key it belongs to, whether
 * its continuation lines fold into one paragraph (`>`) or keep their newlines
 * (`|`), and the raw lines gathered so far with their indentation intact.
 */
interface PendingBlock {
  readonly key: string;
  readonly folded: boolean;
  readonly lines: string[];
}

/**
 * Parser state carried across frontmatter lines.
 *
 * AGSK-01 (#86) dash-list folding: lastKey is the most recently parsed key
 * and lastKeyFoldable is true only while that key's value is empty or built
 * entirely from folded dash items, so an inline value wins and dash items
 * beneath it are ignored (D-82-03). awaitingKey holds an empty-value key
 * whose continuation shape is not yet decided -- the first continuation line
 * chooses between dash folding and an implicit block. pending is the block
 * being collected, if any.
 */
interface ParseState {
  lastKey: string | null;
  lastKeyFoldable: boolean;
  awaitingKey: string | null;
  pending: PendingBlock | null;
}

/**
 * Parse one frontmatter line into `raw`, updating the parser state.
 *
 * A pending block claims the line first, so nothing inside a block value is
 * read as a key or a list item. Otherwise the dash test runs before the
 * indent test, which is what keeps a dash beneath a non-empty inline value
 * ignored (D-82-03) rather than turning it into an implicit block.
 */
function applyFrontmatterLine(
  raw: Record<string, string>,
  state: ParseState,
  rawLine: string,
): void {
  if (collectBlockLine(state, rawLine)) {
    return;
  }

  flushPendingBlock(raw, state);

  const line = rawLine.trim();
  if (line === "") {
    return;
  }

  if (line.startsWith("- ") || line === "-") {
    foldDashItem(raw, state, line);
    return;
  }

  if (INDENTED_LINE.test(rawLine)) {
    startImplicitBlock(state, rawLine);
    return;
  }

  applyKeyLine(raw, state, line);
}

/**
 * Add a line to the pending block, reporting whether it was consumed. Blank
 * and indented lines belong to the block; a line that reaches column 0 with
 * content terminates it and is handed back to the caller.
 */
function collectBlockLine(state: ParseState, rawLine: string): boolean {
  const pending = state.pending;
  if (pending === null) {
    return false;
  }

  if (rawLine.trim() === "" || INDENTED_LINE.test(rawLine)) {
    pending.lines.push(rawLine);
    return true;
  }

  return false;
}

/**
 * Assign the collected block to its key and clear the pending state. A no-op
 * when no block is open, so callers need no guard of their own.
 */
function flushPendingBlock(raw: Record<string, string>, state: ParseState): void {
  const pending = state.pending;
  if (pending === null) {
    return;
  }

  const stripped = stripCommonIndent(pending.lines);
  raw[pending.key] = pending.folded ? foldBlock(stripped) : stripped.join("\n").trim();
  state.pending = null;
}

/**
 * AGSK-01 (#86): fold one `- item` line into the pending foldable key.
 *
 * The fold happens BEFORE any colon split, so an item like
 * `- spec-tree:review-changes` is taken verbatim. Items are comma-joined for
 * downstream CSV splitting; quotes stay intact (splitCsv strips per-item
 * quotes). Known limitation: an item containing a literal comma splits into
 * two tokens downstream (D-82-02 scan found none in the wild). Clearing
 * awaitingKey is how a first dash continuation line rules out an implicit
 * block for that key.
 */
function foldDashItem(raw: Record<string, string>, state: ParseState, line: string): void {
  const item = line === "-" ? "" : line.slice(2).trim();
  if (state.lastKey !== null && state.lastKeyFoldable && item !== "") {
    const current = raw[state.lastKey] ?? "";
    raw[state.lastKey] = current === "" ? item : `${current},${item}`;
  }

  state.awaitingKey = null;
}

/**
 * Open a block on an empty-value key whose first continuation line is not a
 * dash item, so an indented mapping such as a `provenance:` group is kept as
 * one multi-line string rather than lifted into top-level keys (#155). An
 * indented line with no key awaiting continuation is ignored.
 */
function startImplicitBlock(state: ParseState, rawLine: string): void {
  const key = state.awaitingKey;
  if (key === null) {
    return;
  }

  state.pending = { key: key, folded: false, lines: [rawLine] };
  state.lastKey = null;
  state.lastKeyFoldable = false;
  state.awaitingKey = null;
}

/**
 * Apply a column-0 `key: value` line. A block scalar header opens a pending
 * block; an empty value defers to the next line's shape; anything else is
 * assigned verbatim (AG-6). A quoted value such as `">"` cannot match the
 * header pattern, which is what keeps AG-6's verbatim value intact.
 */
function applyKeyLine(raw: Record<string, string>, state: ParseState, line: string): void {
  const colon = line.indexOf(":");
  if (colon === -1) {
    return;
  }

  const key = line.slice(0, colon).trim();
  const value = line.slice(colon + 1).trim();
  if (key === "") {
    return;
  }

  if (BLOCK_SCALAR_HEADER.test(value)) {
    state.pending = { key: key, folded: value.startsWith(">"), lines: [] };
    state.lastKey = null;
    state.lastKeyFoldable = false;
    state.awaitingKey = null;
    return;
  }

  // Plain assignment, so an inherited accessor on Object.prototype still
  // governs the write and a `__proto__` key assigns a string the engine
  // ignores rather than reshaping `raw`.
  raw[key] = value;
  state.lastKey = key;
  state.lastKeyFoldable = value === "";
  state.awaitingKey = value === "" ? key : null;
}

/**
 * Remove the block's own indentation, measured from its first line with
 * content, so the stored value carries no leading whitespace of its own.
 * Uses startsWith + slice rather than a RegExp built from file content, so
 * plugin text never reaches a regex compiler.
 */
function stripCommonIndent(lines: readonly string[]): string[] {
  const firstContentLine = lines.find((line) => line.trim() !== "");
  const prefix =
    firstContentLine === undefined
      ? ""
      : firstContentLine.slice(0, firstContentLine.length - firstContentLine.trimStart().length);

  return lines.map((line) => (line.startsWith(prefix) ? line.slice(prefix.length) : line));
}

/**
 * Fold a `>` block into one paragraph: consecutive lines join with a space,
 * blank lines survive as newline separators, and a more-indented line keeps
 * its own line. Trailing whitespace is trimmed.
 */
function foldBlock(lines: readonly string[]): string {
  let folded = "";
  let hasContent = false;
  let previousIsMoreIndented = false;
  let blankLines = 0;

  for (const line of lines) {
    const current = line.trimEnd();
    if (current === "") {
      if (hasContent) {
        blankLines += 1;
      }

      continue;
    }

    const currentIsMoreIndented = current !== current.trimStart();
    if (hasContent) {
      folded += foldSeparator(blankLines, previousIsMoreIndented || currentIsMoreIndented);
    }

    folded += current;
    hasContent = true;
    previousIsMoreIndented = currentIsMoreIndented;
    blankLines = 0;
  }

  return folded.trim();
}

/**
 * The separator between two folded lines: a run of newlines when blank lines
 * separate them, otherwise a newline beside a more-indented line and a space
 * between two ordinary ones.
 */
function foldSeparator(blankLines: number, moreIndented: boolean): string {
  if (blankLines > 0) {
    return "\n".repeat(blankLines + (moreIndented ? 1 : 0));
  }

  return moreIndented ? "\n" : " ";
}

/**
 * Normalize the body to begin with at most a single leading newline so the
 * generated file's blank-line-before-body is deterministic.
 */
function normalizeBody(body: string): string {
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
  /**
   * AG-11: a generated agent always has at least one tool -- pi-subagents has
   * no safe representation of "no tools". The non-empty tuple encodes that
   * invariant in the type (convertAgent throws before reaching here on empty).
   */
  readonly tools: readonly [string, ...string[]];
  readonly thinking?: string;
  readonly skills: readonly string[];
  readonly inheritSkills: boolean;
}

/**
 * AGSK-04: one skill legend entry. `token` is the `<plugin>:<skill>`
 * reference exactly as it appears in the body; `generatedName` is the Pi
 * skill name it maps to.
 */
export interface SkillLegendEntry {
  readonly token: string;
  readonly generatedName: string;
}

/**
 * Provenance fields rendered under a single `provenance` frontmatter
 * mapping; free-text values are newline-normalized so a multi-line value
 * cannot inject a bogus frontmatter key into pi-subagents' line-based
 * parser.
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
 * parser only honors frontmatter when the file starts with `---`.
 * Provenance is folded under a single `provenance` mapping (T-d8i-01):
 * `provenance:` parses as an unknown key with an empty value, and its
 * indented member keys and list items are skipped by pi-subagents'
 * `^([\w-]+):` key regex, so none of it reaches the child subagent's
 * system prompt (which is the file body, verbatim). The
 * GENERATED_AGENT_MARKER substring still appears in the file -- as the
 * `generatedBy` line's content -- for isOwnedAgentFile safety checks
 * before overwrite/delete.
 *
 *   <generated frontmatter, including provenance>\n  (ends "---\n")
 *   <skill legend>          (AGSK-04, only when legend entries exist)
 *   <body>
 *
 * AG-8 / D-84-04 / T-d8i-01 deterministic field order: name, description,
 * model, tools, thinking, skills, skillPath (only when skills is
 * non-empty), systemPromptMode, inheritProjectContext, inheritSkills,
 * then the `provenance` mapping (generatedBy, sourcePlugin, sourceAgent,
 * sourcePath, originalModel [only when defined], droppedFields,
 * droppedTools, warnings -- each list field inline `[]` when empty or a
 * `    - item` block when non-empty).
 *
 * AGSK-04 / D-82-04: when `legend` is non-empty, the legend block renders
 * immediately after the frontmatter and before the body prose. When
 * `legend` is undefined or empty the assembly is byte-for-byte the
 * no-legend layout (reference-gated byte identity).
 */
export function emitGeneratedAgentFile(input: {
  frontmatter: GeneratedFrontmatterFields;
  provenance: GeneratedProvenanceFields;
  body: string;
  legend?: readonly SkillLegendEntry[];
}): string {
  const { frontmatter, provenance, body, legend } = input;

  // Frontmatter block in deterministic order. systemPromptMode /
  // inheritProjectContext are extension-side defaults and intentionally
  // hardcoded -- they describe how this bridge interacts with pi-subagents.
  // inheritSkills is derived from the source agent's Skill tool declaration
  // (AGSK-05, D-83-01).
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
    // D-84-04: skillPath is a fixed, agent-local search root so pi-subagents
    // resolves the emitted skill names against the bridged skills directory
    // instead of only its own scan roots (pi-subagents 0.35.0, PR #470).
    lines.push(
      `skills: ${frontmatter.skills.join(",")}`,
      "skillPath: ../pi-claude-marketplace/resources/skills",
    );
  }

  lines.push(
    "systemPromptMode: replace",
    "inheritProjectContext: true",
    `inheritSkills: ${frontmatter.inheritSkills ? "true" : "false"}`,
  );

  // T-d8i-01: provenance folded under a single `provenance` mapping,
  // appended after inheritSkills, inside the frontmatter -- so pi-subagents'
  // parser stores-and-ignores it and the child subagent's system prompt (the
  // body, verbatim) never sees it. The nested keys and list items carry
  // leading whitespace, so pi-subagents' `^([\w-]+):` key regex skips them
  // entirely. GENERATED_AGENT_MARKER is exactly the emitted `generatedBy`
  // line's content, so isOwnedAgentFile's whole-file substring check still
  // matches. Free-text values are newline-normalized (T-d8i-02) so a
  // multi-line value can't inject a bogus key into the line-based parser.
  const provenanceLines: string[] = [
    "provenance:",
    `  ${GENERATED_AGENT_MARKER}`,
    `  sourcePlugin: ${provenance.pluginName}`,
    `  sourceAgent: ${provenance.sourceName}`,
    `  sourcePath: ${sanitizeProvenanceValue(provenance.sourcePath)}`,
  ];
  if (provenance.originalModel !== undefined) {
    provenanceLines.push(`  originalModel: ${sanitizeProvenanceValue(provenance.originalModel)}`);
  }

  pushProvenanceList(provenanceLines, "droppedFields", provenance.droppedFields);
  pushProvenanceList(provenanceLines, "droppedTools", provenance.droppedTools);
  pushProvenanceList(provenanceLines, "warnings", provenance.warnings);
  lines.push(...provenanceLines);
  const generatedFrontmatter = "---\n" + lines.join("\n") + "\n---\n";

  // Body: ensure exactly one leading blank line and a trailing newline so
  // the generated file has deterministic separators around the frontmatter
  // (and, when present, the skill legend).
  const bodyWithLeadingBlank = body.startsWith("\n") ? body : "\n" + body;
  const bodyFinal = bodyWithLeadingBlank.endsWith("\n")
    ? bodyWithLeadingBlank
    : bodyWithLeadingBlank + "\n";

  // AGSK-04: legend renders between the frontmatter and the body.
  // renderSkillLegend returns "" when there are no entries, keeping this
  // expression byte-identical to the no-legend assembly. The body's leading
  // blank line (normalized above) supplies the blank line after the closing
  // frontmatter delimiter (no legend) or after the last legend entry.
  return generatedFrontmatter + renderSkillLegend(legend) + bodyFinal;
}

/**
 * AGSK-04 / D-82-05 legend block: locked heading, one intro sentence, one
 * `- \`token\` \u2192 skill \`name\` (annotation)` line per entry. Leading
 * "\n" pairs with the frontmatter's closing `---\n` delimiter to give one
 * blank line before the heading; the blank line after the last entry comes
 * from the body's normalized leading blank line.
 *
 * AGSK-04 / D-83.1-03 / D-84-01: every entry renders the single annotation
 * "available on demand" -- extension-contributed skills survive --no-skills
 * in child sessions, so the skill catalog is present regardless of
 * inheritSkills.
 */
function renderSkillLegend(legend: readonly SkillLegendEntry[] | undefined): string {
  if (legend === undefined || legend.length === 0) {
    return "";
  }

  const entryLines = legend.map(
    (entry) => `- \`${entry.token}\` \u2192 skill \`${entry.generatedName}\` (available on demand)`,
  );

  return (
    "\n## Pi coding agent skill legend\n\n" +
    "These instructions reference Claude skills by their original names. In this Pi session:\n\n" +
    entryLines.join("\n") +
    "\n"
  );
}

/**
 * Append a provenance list field to the `provenance` mapping. An empty list
 * renders inline as `  <key>: []`; a non-empty list renders as a YAML block
 * list -- `  <key>:` then one `    - <item>` line per newline-normalized
 * item. The nested indentation keeps every line out of pi-subagents'
 * top-level `^([\w-]+):` key match, so none of it reaches the child prompt.
 */
function pushProvenanceList(lines: string[], key: string, values: readonly string[]): void {
  if (values.length === 0) {
    lines.push(`  ${key}: []`);
    return;
  }

  lines.push(`  ${key}:`);
  for (const value of values) {
    lines.push(`    - ${sanitizeProvenanceValue(value)}`);
  }
}

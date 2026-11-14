// bridges/agents/frontmatter.ts
//
// Owns the input + output sides of pi-subagents' frontmatter format.
// The ownership marker comes from ./marker.ts so the writer and detector
// share the same current-format signature.
//
// On the OUTPUT side, this module is the only place in the extension that
// decides how generated agent files are assembled: which scalars get
// quote-flipped, which provenance values get newline-normalized, and what
// the deterministic field order looks like. convertAgent does the field
// mapping but delegates the final byte assembly here.
//
// On the INPUT side, readAgentFrontmatter reads a source agent as YAML through
// Pi's parseFrontmatter, as Claude Code reads it (D-PG7-01). A quoted value
// loses its quote marks, a comment after a value is not part of it, and a YAML
// list arrives as its items joined with a comma. When the first parse fails,
// the shared single-line repair quotes the values YAML refuses and the block
// is parsed once more; when that fails too, the agent has no fields (D-PG7-02,
// D-PG7-04). Every value reaches the converter as a string (D-PG7-05).
//
// AG-6 contract: a colon in an unquoted description makes YAML refuse the
// block, and the repair quotes that value, so the author's text survives.
// AG-8 contract: emitYamlScalar quote-flip + sanitizeProvenanceValue newline
// normalization so a multi-line provenance value cannot be misread as a new
// frontmatter key by pi-subagents' line-based parser.

import { parseFrontmatter } from "../../platform/pi-api.ts";
import { stripBom } from "../../shared/bom.ts";
import { errorMessage } from "../../shared/errors.ts";
import {
  colonRepairTrigger,
  extractBodyAfterFrontmatter,
  repairSingleLineScalars,
} from "../../shared/frontmatter-repair.ts";
import { setOwn } from "../../shared/own-key.ts";

import { GENERATED_AGENT_MARKER } from "./marker.ts";

import type { RawAgentFrontmatter } from "./types.ts";

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
function emitYamlScalar(value: string): string {
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
function sanitizeProvenanceValue(value: string): string {
  return value.replace(/\r?\n/g, " ");
}

export interface ParsedFrontmatter {
  readonly raw: RawAgentFrontmatter;
  readonly body: string;
  /**
   * D-PG7-04: the message of Pi's first parse, present only when the block
   * did not parse after the repair either, so `raw` holds no field.
   */
  readonly parseError?: string;
}

/** D-PG7-02: the one-line plain values, besides a colon, that YAML refuses at their start. */
const AGENT_REPAIR_OPENER = /^[*&!%@`]/;

/**
 * D-PG7-02 as amended: the agents trigger of `repairSingleLineScalars`. It
 * adds the openers that make YAML refuse a plain value, so `tools: *` still
 * reads as every tool (D-CF4-08).
 */
function agentRepairTrigger(value: string): boolean {
  return colonRepairTrigger(value) || AGENT_REPAIR_OPENER.test(value);
}

type PiParsedFrontmatter = ReturnType<typeof parseFrontmatter>;

/**
 * D-PG7-01: the second parse, over the repaired text. Returns `undefined` when
 * the repair changed nothing or the repaired text still does not parse.
 */
function parseRepaired(text: string): PiParsedFrontmatter | undefined {
  const repaired = repairSingleLineScalars(text, agentRepairTrigger);
  if (repaired === text) {
    return undefined;
  }

  try {
    return parseFrontmatter(repaired);
  } catch {
    return undefined;
  }
}

/**
 * D-PG7-01: parse first, as Claude Code does, so a comment after a value is
 * stripped; repair and parse again only when that parse throws. Pi strips one
 * byte-order mark itself, so the first parse gets the text as read: a second
 * strip would turn a doubled mark into a fence (T-FMBOM-02). The repair's
 * fence match is anchored, so it gets the text with one mark stripped.
 */
function parseSource(
  text: string,
): { readonly parsed: PiParsedFrontmatter } | { readonly parseError: string } {
  try {
    return { parsed: parseFrontmatter(text) };
  } catch (error: unknown) {
    const repaired = parseRepaired(stripBom(text));
    // The first error names the author's defect, not the repair's.
    return repaired === undefined ? { parseError: errorMessage(error) } : { parsed: repaired };
  }
}

/** Control characters and line terminators, which no stored key may hold (T-07-05). */
const UNSAFE_KEY_CHARACTER = /[\p{Cc}\u2028\u2029]/gu;

/**
 * D-PG7-05 as extended: one YAML value as the converter's string. A scalar is
 * its text, null is the empty string (so `tools:` keeps its AG-11 refusal), a
 * sequence is its items joined with a comma, and a mapping is the empty
 * string.
 */
function fieldValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "boolean" || typeof value === "number" || typeof value === "bigint") {
    return String(value);
  }

  return Array.isArray(value) ? value.map((item: unknown) => fieldValue(item)).join(",") : "";
}

/**
 * D-PG7-05: the fields of a parsed block. A document that is not a mapping
 * gives none. Each key is copied with `setOwn`, so a `__proto__` key stays
 * data and reparents nothing (T-07-03).
 */
function rawFields(frontmatter: unknown): RawAgentFrontmatter {
  const raw: Record<string, string> = {};
  if (typeof frontmatter !== "object" || frontmatter === null || Array.isArray(frontmatter)) {
    return raw;
  }

  for (const [key, value] of Object.entries(frontmatter)) {
    setOwn(raw, key.replaceAll(UNSAFE_KEY_CHARACTER, " "), fieldValue(value));
  }

  return raw;
}

/**
 * PG-AGENT-05 / D-PG7-01: read a source agent's frontmatter as YAML. The body
 * is the text after the closing fence. A block that does not parse after the
 * repair gives no fields, the text after its closing fence as body, and the
 * first parse's message as `parseError` (D-PG7-04).
 */
export function readAgentFrontmatter(rawText: string): ParsedFrontmatter {
  const source = parseSource(rawText);
  if ("parseError" in source) {
    return {
      raw: {},
      body: extractBodyAfterFrontmatter(stripBom(rawText)),
      parseError: source.parseError,
    };
  }

  return { raw: rawFields(source.parsed.frontmatter), body: normalizeBody(source.parsed.body) };
}

/**
 * Normalize the body to begin with at most a single leading newline so the
 * generated file's blank-line-before-body is deterministic.
 */
function normalizeBody(body: string): string {
  return body.replace(/^\r?\n+/, "\n");
}

/**
 * #179: the tool grant of a generated agent -- exactly one shape renders.
 *
 * `tools` present is an explicit, non-empty allowlist: pi-subagents reads
 * an empty `tools:` as "no tools", which has no safe representation, and
 * the non-empty tuple encodes that invariant (AG-11 -- convertAgent throws
 * before reaching here on an empty explicit list). `tools` absent means
 * the source agent omitted `tools:` -- the generated frontmatter omits the
 * allowlist so pi-subagents grants its default builtin tools -- and only
 * then can `excludeTools` (the Pi mapping of source `disallowedTools:`,
 * also non-empty when present) narrow that default set. The `?: never`
 * arms are what enforce "never both": a value carrying both keys matches
 * neither arm.
 */
export type GeneratedToolsFields =
  | { readonly tools: readonly [string, ...string[]]; readonly excludeTools?: never }
  | { readonly tools?: never; readonly excludeTools?: readonly [string, ...string[]] };

/**
 * Structured frontmatter fields for a generated agent. Identifiers
 * (name, model, tools, thinking, skills) are drawn from validated enums or
 * assertSafeName-checked tokens; only `description` is free text and goes
 * through emitYamlScalar. The tools/excludeTools pair comes from
 * GeneratedToolsFields, whose union shape carries their mutual exclusion.
 */
export type GeneratedFrontmatterFields = {
  readonly name: string;
  readonly description: string;
  readonly aliases?: readonly string[];
  readonly model?: string;
  readonly thinking?: string;
  readonly skills: readonly string[];
  readonly inheritSkills: boolean;
  /**
   * D-CF4-05: pi-subagents' launch default, `true` for a background run and
   * `false` for a foreground one. Absent leaves pi-subagents' own default.
   */
  readonly async?: boolean;
} & GeneratedToolsFields;

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
 *   <body>
 *
 * AG-8 / D-84-04 / T-d8i-01 deterministic field order: name, description,
 * aliases (only when non-empty), model, tools (only when an explicit
 * allowlist exists), excludeTools
 * (only when tools is absent and disallowed names mapped, #179), thinking,
 * skills, skillPath (only when skills is
 * non-empty), systemPromptMode, inheritProjectContext, inheritSkills,
 * advertise, async (only when set; the converter sets only `true`, D-PG3-01,
 * D-CF6-10), then the `provenance` mapping (generatedBy, sourcePlugin, sourceAgent,
 * sourcePath, originalModel [only when defined], droppedFields,
 * droppedTools, warnings -- each list field inline `[]` when empty or a
 * `    - item` block when non-empty).
 *
 * D-CF4-14: `advertise: true` is fixed, so every bridged agent enters
 * pi-subagents' catalog in the parent model's system prompt, as Claude Code
 * lists plugin agents to its model.
 */
export function emitGeneratedAgentFile(input: {
  frontmatter: GeneratedFrontmatterFields;
  provenance: GeneratedProvenanceFields;
  body: string;
}): string {
  const { body } = input;

  // Body: ensure exactly one leading blank line and a trailing newline so
  // the generated file has deterministic separators around the frontmatter
  // and the body.
  const bodyWithLeadingBlank = body.startsWith("\n") ? body : "\n" + body;
  const bodyFinal = bodyWithLeadingBlank.endsWith("\n")
    ? bodyWithLeadingBlank
    : bodyWithLeadingBlank + "\n";

  return emitGeneratedAgentFrontmatter(input) + bodyFinal;
}

/**
 * MGRT-01 / D-MB-03: the frontmatter block of the file `emitGeneratedAgentFile`
 * writes, from the opening `---` line through the closing `---` line and its
 * newline. The provenance, with its warnings and dropped tools, sits inside
 * the block, so two grant forms of one agent differ only here and the stage
 * can record each form's block without searching the file text, whose body
 * may hold a `---` line of its own.
 */
export function emitGeneratedAgentFrontmatter(input: {
  frontmatter: GeneratedFrontmatterFields;
  provenance: GeneratedProvenanceFields;
}): string {
  const { frontmatter, provenance } = input;

  // Frontmatter block in deterministic order. systemPromptMode /
  // inheritProjectContext are extension-side defaults and intentionally
  // hardcoded -- they describe how this bridge interacts with pi-subagents.
  // inheritSkills is derived from the source agent's Skill tool declaration
  // (AGSK-05, D-83-01).
  const lines: string[] = [
    `name: ${frontmatter.name}`,
    `description: ${emitYamlScalar(frontmatter.description)}`,
  ];
  if (frontmatter.aliases !== undefined && frontmatter.aliases.length > 0) {
    // AG-1a: the file's own basename, which is the name this bridge declared
    // before the agentType split. pi-subagents resolves an alias to the same
    // agent, so a session that already addresses the flat name keeps working.
    lines.push(`aliases: ${frontmatter.aliases.join(",")}`);
  }

  if (frontmatter.model !== undefined) {
    lines.push(`model: ${frontmatter.model}`);
  }

  if (frontmatter.tools !== undefined) {
    lines.push(`tools: ${frontmatter.tools.join(",")}`);
  }

  if (frontmatter.excludeTools !== undefined) {
    lines.push(`excludeTools: ${frontmatter.excludeTools.join(",")}`);
  }

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
    "advertise: true",
  );
  if (frontmatter.async !== undefined) {
    lines.push(`async: ${frontmatter.async ? "true" : "false"}`);
  }

  // T-d8i-01: provenance folded under a single `provenance` mapping,
  // appended after advertise and async, inside the frontmatter -- so pi-subagents'
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
  return "---\n" + lines.join("\n") + "\n---\n";
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

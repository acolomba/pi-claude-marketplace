// bridges/commands/staged-command.ts
//
// The one place that builds the text of a staged command file (CMD-01).
//
// Pi lists a prompt template with its frontmatter `description`, and falls
// back to the first body line cut at 60 characters when there is none. Claude
// Code 2.1.316 falls back to `A2e` instead (D-CF1-04), so the writer puts
// `descriptionFallback(body, "Plugin command")` into the staged frontmatter
// whenever the source has no non-empty string `description`, and Pi's own
// rule never applies (D-CF3-08). A command whose frontmatter does not parse
// is neutralized first and gets the fallback of its remaining body.
//
// The frontmatter is rebuilt rather than edited: one
// `"<key>": <JSON>` line per key, in the key order Pi's parser gives. A JSON
// literal never spans a line and a JSON-quoted line never starts with `---`,
// so no author value can open a new key or close the block early, and a
// replaced `description` can never sit beside a second one (Pi's YAML parser
// refuses a duplicate key). The text after the source's closing fence is kept
// byte for byte. CM-3 substitution and the reference rewrite run on the source
// text before the rebuild.
//
// The rebuilt frontmatter ends with the install-time record (D-CF3-06,
// `command-record.ts`). It is added after the substitution and the reference
// rewrite, so neither pass reads or changes it (T-03-02).
//
// The writer re-parses its own output with Pi's parser and throws when the
// result is not the frontmatter it meant or the body Pi read from the source,
// so a staged file Pi would read differently never reaches the target dir.
//
// Beside the text, the writer returns the one D-CF3-09 line that names the
// source frontmatter fields Pi cannot honor (D-CF1-05). A command whose
// frontmatter does not parse gets none: its CMD-01 warning already names the
// parse failure, and the neutralized source has no frontmatter left to read.

import { readFile } from "node:fs/promises";

import { descriptionFallback } from "../../domain/description-fallback.ts";
import { droppedInvocationFieldsWarning } from "../../domain/invocation-frontmatter.ts";
import { rewriteMarkdownReferences } from "../../domain/skill-tokens.ts";
import { parseFrontmatter } from "../../platform/pi-api.ts";
import { stripBom } from "../../shared/bom.ts";
import { BridgeStagingError } from "../../shared/errors-bridges.ts";
import { errorMessage } from "../../shared/errors.ts";
import { substituteClaudeVars } from "../../shared/vars.ts";

import { withCommandRecord } from "./command-record.ts";

import type { CommandRecord } from "./command-record.ts";
import type { DiscoveredCommand } from "./types.ts";
import type { InstalledReferenceNames } from "../../domain/skill-tokens.ts";

/** What the writer needs besides the command: the install-time values. */
export interface StagedCommandContext {
  readonly pluginName: string;
  readonly pluginRoot: string;
  readonly pluginDataDir: string;
  /** The install cwd at project scope; `undefined` keeps `${CLAUDE_PROJECT_DIR}` literal (SUB-02). */
  readonly projectDir: string | undefined;
  readonly referenceNames: InstalledReferenceNames;
}

/** The staged text of one command, with what the install reports about its source. */
export interface StagedCommandText {
  readonly text: string;
  /** The parse error when the source frontmatter did not parse and was neutralized (CMD-01). */
  readonly parseError?: string;
  /**
   * D-CF3-09: `[<source name>] dropped fields: <fields>`, naming in frontmatter
   * order each field Pi cannot honor; absent when there is none or when the
   * source frontmatter did not parse.
   */
  readonly droppedFields?: string;
}

type Frontmatter = Readonly<Record<string, unknown>>;

/** A source of one command after the PARSE-01 gate. */
type CommandSource =
  | { readonly content: string; readonly frontmatter: Frontmatter }
  | { readonly content: string; readonly parseError: string };

/** A parsed frontmatter as keys; a list or a scalar holds no keys Pi reads, so it counts as empty. */
function frontmatterKeys(parsed: unknown): Frontmatter {
  return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
    ? (parsed as Frontmatter)
    : {};
}

/**
 * CMD-01 / D-86-07: neutralize an unparseable command source by stripping the
 * ENTIRE malformed frontmatter block -- the opening `---` line through the
 * matching closing `---` line -- leaving the real body. A re-parse of the
 * result RETURNS: usually empty, so the writer gives the command the D-CF3-08
 * description fallback of that body (NOT delimiter-only stripping, which
 * would leave ex-frontmatter junk as the first body line); see the third
 * paragraph below for the case where a clean frontmatter block remains
 * instead. Called ONLY on the gate-1 throw arm, where a closed `---`...`---`
 * block is present by construction.
 *
 * Newlines are first normalized (CR/CRLF -> LF) with the SAME two-step replace
 * `parseFrontmatter` applies before its own `\n---` close search, so this scan
 * agrees with the parser for every line-ending style -- including lone-CR
 * sources, which would otherwise hide the close from a raw `\n---` search and
 * turn a graceful degrade into a hard-fail. The body is emitted with LF line
 * endings (what Pi's loader normalizes the staged file to on read anyway).
 *
 * Successive leading malformed blocks are stripped until the remainder PARSES
 * (RETURNS) under Pi's loader: a source whose body itself opens with a second
 * malformed `---`...`---` block would otherwise re-throw at the read-back
 * parse and turn a graceful degrade into a hard-fail. A leading block that
 * parses cleanly, or a remainder with no opening `---`, is Pi-acceptable and
 * kept verbatim (matching what Pi's own loader would do). Each pass removes at
 * least the opening delimiter, so the loop terminates.
 */
function neutralizeCommandFrontmatter(content: string): string {
  let normalized = content.replaceAll("\r\n", "\n").replaceAll("\r", "\n");

  for (;;) {
    if (!normalized.startsWith("---")) {
      // No opening fence: parseFrontmatter RETURNS the body as-is, nothing to strip.
      return normalized;
    }

    const closeIdx = normalized.indexOf("\n---", 3);
    if (closeIdx === -1) {
      // Opening `---` but no close: parseFrontmatter RETURNS, leave unchanged.
      return normalized;
    }

    const afterClose = normalized.indexOf("\n", closeIdx + 1);
    const stripped = afterClose === -1 ? "" : normalized.slice(afterClose + 1);

    try {
      // A clean parse (empty or valid frontmatter, or no opening fence) means the
      // remainder is Pi-acceptable -- stop here.
      parseFrontmatter(stripped);
      return stripped;
    } catch {
      // The remainder still opens with a malformed block; strip it too.
      normalized = stripped;
    }
  }
}

/**
 * PARSE-01: reads the source, drops one leading byte-order mark (FMBOM-01),
 * and parses its frontmatter before any substitution. A throw is an author
 * defect: the malformed block is neutralized and its message returned, so the
 * install reports `{malformed command}`. A parse that returns keeps the source
 * frontmatter, which D-CF3-09 reads. The parse only validates; nothing in the
 * source is evaluated (T-03-17).
 */
async function readCommandSource(commandFile: string): Promise<CommandSource> {
  const content = stripBom(await readFile(commandFile, "utf8"));
  try {
    return { content, frontmatter: frontmatterKeys(parseFrontmatter(content).frontmatter) };
  } catch (parseErr) {
    return { content: neutralizeCommandFrontmatter(content), parseError: errorMessage(parseErr) };
  }
}

/**
 * D-CF3-08: the frontmatter the staged file carries. A frontmatter that parses
 * to a list or a scalar holds no keys Pi reads, so it counts as empty. A
 * `description` that is not a non-empty string takes Claude Code's fallback
 * for the body Pi loads; a present key keeps its place, an absent one goes
 * last.
 */
function stagedFrontmatter(parsed: unknown, body: string): Frontmatter {
  const source = frontmatterKeys(parsed);
  const declared = source.description;
  const description =
    typeof declared === "string" && declared !== ""
      ? declared
      : descriptionFallback(body, "Plugin command");
  return { ...source, description };
}

/**
 * The fence, one JSON line per key, the closing fence, then
 * the text after the source's closing fence exactly as Pi's
 * `extractFrontmatter` finds it (first `\n---` after index 3, on the
 * BOM-stripped, newline-normalized text). A source with no closing fence keeps
 * its whole text as the body.
 */
function rebuildCommandText(content: string, frontmatter: Frontmatter): string {
  const normalized = stripBom(content).replaceAll("\r\n", "\n").replaceAll("\r", "\n");
  const keyLines = Object.entries(frontmatter)
    .map(([key, value]) => `${JSON.stringify(key)}: ${JSON.stringify(value)}\n`)
    .join("");
  const fenceEnd = normalized.startsWith("---") ? normalized.indexOf("\n---", 3) : -1;
  const afterFence = fenceEnd === -1 ? `\n${normalized}` : normalized.slice(fenceEnd + 4);
  return `---\n${keyLines}---${afterFence}`;
}

/** Pi's parse of `text`, or `undefined` when Pi's parser refuses it. */
function readBack(text: string): { frontmatter: unknown; body: string } | undefined {
  try {
    return parseFrontmatter(text);
  } catch {
    return undefined;
  }
}

/**
 * T-03-01: the staged text must read back, through Pi's own parser, as the
 * JSON form of the frontmatter written, in its key order, and as the body Pi
 * read from the source. Anything else is this writer's defect, not the
 * author's, so it fails the install instead of degrading.
 */
function assertReadsBack(
  generatedName: string,
  text: string,
  frontmatter: Frontmatter,
  body: string,
): void {
  const parsed = readBack(text);
  if (parsed?.body !== body || JSON.stringify(parsed.frontmatter) !== JSON.stringify(frontmatter)) {
    throw new BridgeStagingError(
      `command "${generatedName}" was staged with frontmatter or a body that Pi reads differently`,
    );
  }
}

/**
 * Builds the staged text of `command`: the PARSE-01 gate, CM-3 substitution,
 * the reference rewrite, then the rebuilt frontmatter with the D-CF3-08
 * description and the D-CF3-06 record, checked by a read-back, plus the
 * D-CF3-09 dropped-fields line of the source frontmatter. A parse failure of
 * the substituted text propagates: substitution produced bytes Pi rejects, the
 * writer's own defect.
 */
export async function buildStagedCommand(
  command: DiscoveredCommand,
  context: StagedCommandContext,
): Promise<StagedCommandText> {
  const source = await readCommandSource(command.commandFile);
  const substituted = rewriteMarkdownReferences(
    substituteClaudeVars(source.content, {
      pluginRoot: context.pluginRoot,
      pluginData: context.pluginDataDir,
      projectDir: context.projectDir,
    }),
    context.pluginName,
    context.referenceNames,
  );
  const parsed = parseFrontmatter(substituted);
  const body = parsed.body.trim();
  const record: CommandRecord = {
    pluginRoot: context.pluginRoot,
    pluginData: context.pluginDataDir,
  };
  const frontmatter = withCommandRecord(stagedFrontmatter(parsed.frontmatter, body), record);
  const text = rebuildCommandText(substituted, frontmatter);
  assertReadsBack(command.generatedName, text, frontmatter, body);
  if ("parseError" in source) {
    return { text, parseError: source.parseError };
  }

  const droppedFields = droppedInvocationFieldsWarning(command.sourceName, source.frontmatter);
  return droppedFields === undefined ? { text } : { text, droppedFields };
}

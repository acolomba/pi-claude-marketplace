// bridges/skills/skill-names.ts
//
// D-CF2-02 / D-CF2-03: the names Claude Code 2.1.316 gives a plugin skill, and
// the record that carries them into the staged `SKILL.md`.
//
// Upstream (`Qqn` and `SAt` in the 2.1.316 binary) names a plugin skill after
// its directory: `<plugin>:<dir>`, with each character outside
// `[a-zA-Z0-9_-]` replaced by `-`. A frontmatter `name` adds a user-facing
// alias (`<plugin>:<name>`, or the name itself when it already starts with
// `<plugin>:`) and, when the name has no `:`, the bare name. A name over 256
// characters is ignored. Install computes these names because only install
// knows the directory name, the frontmatter `name`, the discovery order, and
// the plugin's command names; the session-time alias loader reads them back
// from the record and never reads the plugin source.
//
// The record is one frontmatter line, `pi-claude-marketplace: <JSON>`. JSON is
// YAML flow syntax, so an author value with quotes, colons, or newlines stays
// inside one JSON string and cannot form a new key (T-02-01).

import path from "node:path";

import Type from "typebox";
import { Compile } from "typebox/compile";

import { parseFrontmatter } from "../../platform/pi-api.ts";
import { isPlainMarkdownFile, readDirEntriesTolerant } from "../../shared/fs-utils.ts";

import { keyValueEnd } from "./frontmatter-scan.ts";

import type { Dirent } from "node:fs";

/** The longest frontmatter `name` Claude Code reads (`RI` in `SAt`). */
const NAME_LIMIT = 256;

/** The frontmatter key that holds the stored record. */
const RECORD_KEY = "pi-claude-marketplace";

const RECORD_SCHEMA = Type.Object({
  names: Type.Array(Type.String()),
  pluginRoot: Type.String(),
  pluginData: Type.String(),
});

const RECORD_VALIDATOR = Compile(RECORD_SCHEMA);

/**
 * D-CF2-02 / D-CF2-06: what install stores in a staged `SKILL.md`. `names`
 * are the aliases the skill claimed, its identity first. `pluginRoot` and
 * `pluginData` are the values `${CLAUDE_PLUGIN_ROOT}` and
 * `${CLAUDE_PLUGIN_DATA}` received at install.
 */
export interface StoredSkillRecord {
  readonly names: readonly string[];
  readonly pluginRoot: string;
  readonly pluginData: string;
}

/** Hands out a plugin's skill aliases, each to the first skill that claims it. */
export interface SkillNameClaims {
  /**
   * Returns `identity`, then each of `frontmatterAliases` that no skill has
   * claimed and that no command of the plugin is named, and claims those.
   */
  readonly claim: (identity: string, frontmatterAliases: readonly string[]) => readonly string[];
}

/**
 * D-CF2-02 item 1: the upstream name of the skill directory `directoryName`.
 * Case is kept and nothing is elided.
 */
export function skillIdentityName(pluginName: string, directoryName: string): string {
  return `${pluginName}:${directoryName.replaceAll(/[^a-zA-Z0-9_-]/g, "-")}`;
}

/**
 * D-CF2-02 items 2 and 3: the aliases a frontmatter `name` adds, as Claude
 * Code reads it. A number or boolean is read with `String()`, as upstream
 * does; an absent, empty, or over-long name adds none. A name with whitespace
 * adds none either: Pi's slash input cannot type it as one token (a recorded
 * residual of D-CF2-02). That rule already drops a mapping, which upstream
 * reads as `[object Object]`; a list, which upstream joins with commas, adds
 * none here.
 */
export function frontmatterNameAliases(
  pluginName: string,
  frontmatterName: unknown,
): readonly string[] {
  if (
    typeof frontmatterName !== "string" &&
    typeof frontmatterName !== "number" &&
    typeof frontmatterName !== "boolean"
  ) {
    return [];
  }

  const name = String(frontmatterName);
  if (name === "" || name.length > NAME_LIMIT || /\s/.test(name)) {
    return [];
  }

  const prefix = `${pluginName}:`;
  const qualified = name.startsWith(prefix) ? name : `${prefix}${name}`;
  return name.includes(":") ? [qualified] : [qualified, name];
}

/**
 * D-CF2-02 / DC-25 item 2: every identity in `identities` is claimed before
 * any frontmatter alias, so a frontmatter alias never takes another skill's
 * directory name. D-CF2-03: an alias equal to one of `commandNames` is never
 * claimed, because the command keeps that name.
 */
export function createSkillNameClaims(
  identities: readonly string[],
  commandNames: ReadonlySet<string>,
): SkillNameClaims {
  const claimed = new Set(identities);
  return {
    claim: (identity, frontmatterAliases) => {
      const unclaimed = frontmatterAliases.filter(
        (alias) => !claimed.has(alias) && !commandNames.has(alias),
      );
      for (const alias of unclaimed) {
        claimed.add(alias);
      }

      return [identity, ...unclaimed];
    },
  };
}

/**
 * Whether `entry` is a command file. The commands bridge reads the same
 * directory and reports a file it cannot inspect; such a file names no
 * installed command, so it names none here either.
 */
async function isCommandFile(directory: string, entry: Dirent): Promise<boolean> {
  try {
    return await isPlainMarkdownFile(directory, entry);
  } catch {
    return false;
  }
}

/** The `.md` basenames directly inside `directory`, without their extension. */
async function commandBasenames(directory: string): Promise<readonly string[]> {
  const entries = await readDirEntriesTolerant(directory);
  const verdicts = await Promise.all(entries.map((entry) => isCommandFile(directory, entry)));
  return entries.filter((_, index) => verdicts[index]).map((entry) => entry.name.slice(0, -3));
}

/**
 * D-CF2-03: the upstream names `<plugin>:<file basename>` of the top-level
 * command files of `commandPaths`, each resolved against `pluginRoot` unless
 * absolute. A nested command's name holds a `:` that no skill identity can
 * hold, so only the top level is read. A missing directory names none.
 */
export async function commandUpstreamNames(
  pluginName: string,
  pluginRoot: string,
  commandPaths: readonly string[],
): Promise<ReadonlySet<string>> {
  const directories = commandPaths.map((commandPath) => path.resolve(pluginRoot, commandPath));
  const basenames = await Promise.all(directories.map(commandBasenames));
  return new Set(basenames.flat().map((basename) => `${pluginName}:${basename}`));
}

/**
 * Index of the closing fence as Pi's `parseFrontmatter` finds it: the first
 * line after the opening one that starts with `---` at column 0, or
 * `lines.length`. An indented `---` is block-scalar content to Pi, so the
 * record must not be written before it.
 */
function closingFenceIndex(lines: readonly string[]): number {
  const index = lines.findIndex((line, i) => i > 0 && line.startsWith("---"));
  return index === -1 ? lines.length : index;
}

/**
 * Whether the top-level node `nodeLines` holds the record key. YAML spells
 * one key in many ways (`"pi-claude-marketplace":`, `pi-claude-marketplace :`,
 * an escape inside quotes), and Pi's parser reads each as the same key, so
 * the node is parsed rather than matched as text. A node that does not parse
 * alone, such as an alias of an anchor in another node, is not the record.
 */
function isRecordNode(nodeLines: readonly string[]): boolean {
  try {
    const { frontmatter } = parseFrontmatter(["---", ...nodeLines, "---"].join("\n"));
    return Object.hasOwn(frontmatter, RECORD_KEY);
  } catch {
    return false;
  }
}

/** `lines` without the node of the record key inside the block that ends at `blockEnd`. */
function withoutRecordNode(lines: readonly string[], blockEnd: number): readonly string[] {
  // Every column-0 line of the block starts a top-level node, because a
  // node's continuation lines are indented (`keyValueEnd`).
  const nodeEnd = (first: number): number => keyValueEnd(lines, first, blockEnd) + 1;
  const first = lines
    .slice(0, blockEnd)
    .findIndex(
      (line, index) =>
        index > 0 && /^\S/.test(line) && isRecordNode(lines.slice(index, nodeEnd(index))),
    );
  return first === -1 ? lines : [...lines.slice(0, first), ...lines.slice(nodeEnd(first))];
}

/**
 * D-CF2-02 / D-CF2-06: writes `record` into the frontmatter of `content` as
 * its last line, replacing any node of the record key, and leaves every other
 * line as it is. It re-parses the result and throws when the record it reads
 * back differs from the one it wrote (T-02-01).
 */
export function writeSkillRecord(content: string, record: StoredSkillRecord): string {
  const json = JSON.stringify({
    names: record.names,
    pluginRoot: record.pluginRoot,
    pluginData: record.pluginData,
  });
  const source = content.split("\n");
  const lines = withoutRecordNode(source, closingFenceIndex(source));
  const closing = closingFenceIndex(lines);
  const written = [
    ...lines.slice(0, closing),
    `${RECORD_KEY}: ${json}`,
    ...lines.slice(closing),
  ].join("\n");
  const stored = readSkillRecord(parseFrontmatter(written).frontmatter);
  const readBack = stored === undefined ? "no record" : JSON.stringify(stored);
  if (readBack !== json) {
    throw new Error(`the skill record ${json} reads back as ${readBack}`);
  }

  return written;
}

/**
 * Reads the stored record from a parsed frontmatter, or returns `undefined`
 * when the key is absent or its value does not have the record's shape. The
 * writer's read-back and the skill invocation (D-CF2-06) read it.
 */
export function readSkillRecord(
  frontmatter: Readonly<Record<string, unknown>>,
): StoredSkillRecord | undefined {
  const value = frontmatter[RECORD_KEY];
  if (!RECORD_VALIDATOR.Check(value)) {
    return undefined;
  }

  return { names: value.names, pluginRoot: value.pluginRoot, pluginData: value.pluginData };
}

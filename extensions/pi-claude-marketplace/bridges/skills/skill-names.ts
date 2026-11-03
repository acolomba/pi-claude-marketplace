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

import { lstat } from "node:fs/promises";
import path from "node:path";

import Type from "typebox";
import { Compile } from "typebox/compile";

import { generatedCommandName } from "../../domain/name.ts";
import { parseFrontmatter } from "../../platform/pi-api.ts";
import { commandMapKeyRefusal } from "../../shared/command-map-key.ts";
import { isPlainMarkdownFile, readDirEntriesTolerant } from "../../shared/fs-utils.ts";

import { frontmatterBlockEnd, keyValueEnd, topLevelNodeIndex } from "./frontmatter-scan.ts";

import type { CommandMapEntry } from "../../domain/resolver-types.ts";
import type { Dirent, Stats } from "node:fs";

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
 * D-CF2-02: every identity in `identities` is claimed before
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
async function directoryBasenames(directory: string): Promise<readonly string[]> {
  const entries = await readDirEntriesTolerant(directory);
  const verdicts = await Promise.all(entries.map((entry) => isCommandFile(directory, entry)));
  return entries.filter((_, index) => verdicts[index]).map((entry) => entry.name.slice(0, -3));
}

/**
 * `lstat` of `target`, or `undefined` when it cannot be inspected. A path the
 * bridge cannot inspect names no installed command, as a missing one names none.
 */
async function lstatTolerant(target: string): Promise<Stats | undefined> {
  try {
    return await lstat(target);
  } catch {
    return undefined;
  }
}

/** Whether `stats` describes a regular, non-dot `.md` file at `target` (D-CF3-05). */
function isDeclaredCommandFile(target: string, stats: Stats): boolean {
  const name = path.basename(target);
  return stats.isFile() && !name.startsWith(".") && name.endsWith(".md");
}

/**
 * D-CF3-05: the basenames one declared `commands` path holds. A directory
 * holds its top-level `.md` files, a regular `.md` file holds itself, and any
 * other path, a symlink included, holds none.
 */
async function declaredBasenames(declared: string): Promise<readonly string[]> {
  const stats = await lstatTolerant(declared);
  if (stats === undefined) {
    return [];
  }

  if (stats.isDirectory()) {
    return directoryBasenames(declared);
  }

  return isDeclaredCommandFile(declared, stats) ? [path.basename(declared).slice(0, -3)] : [];
}

/**
 * Whether `key` can name a command of `pluginName`: the commands bridge
 * refuses the same keys (D-CF3-03).
 */
function isNameableMapKey(pluginName: string, key: string): boolean {
  if (commandMapKeyRefusal(key) !== undefined) {
    return false;
  }

  try {
    generatedCommandName(pluginName, key);
    return true;
  } catch {
    return false;
  }
}

/**
 * D-CF3-03: the names one command map entry holds. A `source` that is a
 * directory is a declared directory and its key is ignored; a `source` that
 * is a command file, or a `content` entry of `plugin.json` (a marketplace
 * entry's is dropped, D-CF3-04), is named after its key when the key is valid.
 *
 * This names `<plugin>:<key>` for every valid key. `bridges/commands/discover.ts`
 * skips a key whose file an earlier command already loaded, or whose generated
 * name repeats, so here a skill alias can be suppressed that no command
 * replaces. That over-suppression is accepted: it can only hide a skill alias,
 * never expose a skill that a command should hide.
 */
async function mapEntryNames(
  pluginName: string,
  pluginRoot: string,
  mapEntry: CommandMapEntry,
): Promise<readonly string[]> {
  if ("content" in mapEntry) {
    return mapEntry.origin === "manifest" && isNameableMapKey(pluginName, mapEntry.key)
      ? [`${pluginName}:${mapEntry.key}`]
      : [];
  }

  const sourceFile = path.resolve(pluginRoot, mapEntry.source);
  const stats = await lstatTolerant(sourceFile);
  if (stats === undefined) {
    return [];
  }

  if (stats.isDirectory()) {
    return (await directoryBasenames(sourceFile)).map((basename) => `${pluginName}:${basename}`);
  }

  return isDeclaredCommandFile(sourceFile, stats) && isNameableMapKey(pluginName, mapEntry.key)
    ? [`${pluginName}:${mapEntry.key}`]
    : [];
}

/**
 * D-CF2-03: the upstream names of the commands of a plugin. A declared
 * `commandPaths` entry, resolved against `pluginRoot` unless absolute, gives
 * `<plugin>:<file basename>` for itself when it is a command file and for
 * each top-level command file when it is a directory (D-CF3-05). Each valid
 * `commandMap` key gives `<plugin>:<key>` (D-CF3-03). A nested command's name
 * holds a `:` that no skill identity can hold, so only the top level is read.
 * A missing path names none.
 */
export async function commandUpstreamNames(
  pluginName: string,
  pluginRoot: string,
  commandPaths: readonly string[],
  commandMap: readonly CommandMapEntry[] = [],
): Promise<ReadonlySet<string>> {
  const declared = await Promise.all(
    commandPaths.map((commandPath) => declaredBasenames(path.resolve(pluginRoot, commandPath))),
  );
  const mapped = await Promise.all(
    commandMap.map((mapEntry) => mapEntryNames(pluginName, pluginRoot, mapEntry)),
  );
  return new Set([
    ...declared.flat().map((basename) => `${pluginName}:${basename}`),
    ...mapped.flat(),
  ]);
}

/** `lines` without the node of the record key inside the block that ends at `blockEnd`. */
function withoutRecordNode(lines: readonly string[], blockEnd: number): readonly string[] {
  const first = topLevelNodeIndex(lines, blockEnd, RECORD_KEY);
  return first === -1
    ? lines
    : [...lines.slice(0, first), ...lines.slice(keyValueEnd(lines, first, blockEnd) + 1)];
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
  const lines = withoutRecordNode(source, frontmatterBlockEnd(source));
  const closing = frontmatterBlockEnd(lines);
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

// bridges/skills/discover.ts
//
// SK-5 / D-10: enumerate skill subdirs that contain `SKILL.md`.
//
// Behavior:
//   - Sort entries by `name.localeCompare` for deterministic ordering.
//   - Refuse symlinked entries inside the skills dir -- `lstat` each direct
//     child and skip symbolic links instead of following them.
//   - D-07 (COMP-01): iterate over `componentPaths.skills: readonly string[]`
//     (array shape). First-wins dedup by generated name; the second
//     occurrence of a collision surfaces via `warnings[]` rather than
//     throwing. RN-6 / D-141-04: that holds in both directions -- two skill
//     dirs under ONE declared entry that elide to the same generated name
//     (plugin `acme` with `acme-foo/` and `foo/`) take the same first-wins
//     skip as two dirs under separate entries. Nothing throws on a
//     generated-name collision. `domain/name.ts::assertSafeName` still
//     guards the source name itself.
//   - A declared `componentPaths.skills` element that is ITSELF a skill dir
//     (contains `SKILL.md` directly, rather than being a parent of skill
//     subdirs) is discovered as a single skill, threaded through the same
//     first-wins dedup. Callers may point `skills` straight at one skill dir.
//   - D-CF2-03 (FG-08): a skill whose upstream name `<plugin>:<dir>` (D-CF2-02
//     item 1) equals the upstream name `<plugin>:<file basename>` of a
//     top-level command of the same plugin is not discovered. Claude Code
//     2.1.316 lets the command keep the name and hides the skill from the
//     user and the model; this bridge skips it with a warning, in the style of
//     the D-07 duplicate warning, so the user learns it was dropped. The skip
//     comes before the generated-name dedup, so a shadowed skill claims no
//     generated name. The command names come from this bridge's own name
//     helpers, never from the commands bridge (fallow boundary zones).
//
// SK-2 elision is delegated to `domain/name.ts::generatedSkillName`; this
// module is purely the discovery/filter step.

import { lstat } from "node:fs/promises";
import path from "node:path";

import { assertSafeName, generatedSkillName } from "../../domain/name.ts";
import { readDirEntriesTolerant } from "../../shared/fs-utils.ts";

import { commandUpstreamNames, skillIdentityName } from "./skill-names.ts";

import type { DiscoveredSkill } from "./types.ts";
import type { MaterializablePlugin } from "../../domain/resolver-types.ts";
import type { Dirent } from "node:fs";

/**
 * D-07 return shape: `{ discovered, warnings }`. Callers (the skills bridge
 * `prepareStageSkills`) thread `warnings` through the bridge's existing
 * warnings channel; duplicate-generated-name soft-fails surface here rather
 * than throwing.
 */
export interface DiscoverPluginSkillsResult {
  readonly discovered: readonly DiscoveredSkill[];
  readonly warnings: readonly string[];
}

/**
 * The state one discovery threads through every skills entry: the plugin's
 * command names (D-CF2-03), the directories already reached (MANF-03), the
 * winner of each generated name (D-07), and the warnings.
 */
interface SkillDiscovery {
  readonly pluginName: string;
  readonly commandNames: ReadonlySet<string>;
  readonly seenByGenerated: Map<string, DiscoveredSkill>;
  readonly seenByDir: Set<string>;
  readonly warnings: string[];
}

async function hasRegularSkillFile(skillDir: string): Promise<boolean> {
  const skillStat = await lstat(path.join(skillDir, "SKILL.md")).catch(() => null);
  return skillStat?.isFile() === true && !skillStat.isSymbolicLink();
}

async function isSkillDir(entry: Dirent, skillsDir: string): Promise<boolean> {
  if (entry.name.startsWith(".") || !entry.isDirectory()) {
    return false;
  }

  const full = path.join(skillsDir, entry.name);
  const stat = await lstat(full);
  return !stat.isSymbolicLink() && (await hasRegularSkillFile(full));
}

async function isSelfSkillDir(skillsDir: string): Promise<boolean> {
  const stat = await lstat(skillsDir).catch(() => null);
  return (
    stat?.isDirectory() === true && !stat.isSymbolicLink() && (await hasRegularSkillFile(skillsDir))
  );
}

/**
 * D-07 first-wins skip. Names the WINNING source rather than blaming an
 * earlier `componentPaths.skills` entry: under D-141-04 the two sides of a
 * collision are just as often two subdirs of ONE entry (`acme-foo/` and
 * `foo/` in plugin `acme`), where there is no earlier entry to blame. Naming
 * the winner is true either way and more useful. Matches the commands
 * bridge's warning of the same shape.
 */
function duplicateWarning(
  sourceName: string,
  skillsDir: string,
  generatedName: string,
  winningSourceName: string,
): string {
  return (
    `skill source "${sourceName}" in "${skillsDir}" elides to generated name ` +
    `"${generatedName}", already produced by skill source "${winningSourceName}"; ` +
    `ignoring duplicate.`
  );
}

/**
 * D-CF2-03 skip. It names no directory, so the whole line survives the
 * absolute-path redaction of the install notification.
 */
function shadowedByCommandWarning(sourceName: string, identityName: string): string {
  return (
    `skill source "${sourceName}" has the same name "${identityName}"` +
    ` as a command of the plugin; ignoring the skill.`
  );
}

/**
 * Admits the skill directory `skillDir`, named `sourceName`, unless an
 * earlier entry already reached it (MANF-03, silent), a command of the plugin
 * has its upstream name (D-CF2-03), or an earlier skill has its generated name
 * (D-07 / D-141-04). `warnDir` is the directory the duplicate warning names:
 * the parent for a subdir, the skill dir itself for a declared skill dir.
 */
function admitSkill(
  discovery: SkillDiscovery,
  sourceName: string,
  skillDir: string,
  warnDir: string,
): void {
  // Defense in depth: assertSafeName throws on path separators, control
  // chars, and ".."/".".
  assertSafeName(sourceName, `skill directory name in ${warnDir}`);

  // MANF-03 / D-01-21: a directory already reached through an earlier
  // component path is the same skill, not a duplicate.
  const resolvedDir = path.resolve(skillDir);
  if (discovery.seenByDir.has(resolvedDir)) {
    return;
  }

  discovery.seenByDir.add(resolvedDir);
  const identityName = skillIdentityName(discovery.pluginName, sourceName);
  if (discovery.commandNames.has(identityName)) {
    discovery.warnings.push(shadowedByCommandWarning(sourceName, identityName));
    return;
  }

  // D-07: first-wins dedup by GENERATED name. The second occurrence is a
  // soft-fail with a descriptive warning. RN-6 / D-141-04: the loser may sit
  // in the winner's own parent -- `acme-foo/` and `foo/` in plugin `acme`
  // both generate `acme-foo` -- and it takes the same skip.
  const generatedName = generatedSkillName(discovery.pluginName, sourceName);
  const winner = discovery.seenByGenerated.get(generatedName);
  if (winner !== undefined) {
    discovery.warnings.push(
      duplicateWarning(sourceName, warnDir, generatedName, winner.sourceName),
    );
    return;
  }

  discovery.seenByGenerated.set(generatedName, { sourceName, generatedName, skillDir });
}

/**
 * Enumerates the skill subdirs of ONE `componentPaths.skills` element, in
 * stable `localeCompare` order, admitting each through `admitSkill`.
 */
async function collectSkillSubdirs(discovery: SkillDiscovery, skillsDir: string): Promise<void> {
  const entries = await readDirEntriesTolerant(skillsDir);
  const sorted = [...entries].sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of sorted) {
    // Refuse symlinked skill dirs.
    // readdir's `withFileTypes` reports the link's TYPE (so a symlink to a
    // directory shows isDirectory()=true). lstat is the only way to detect
    // the link itself.
    // eslint-disable-next-line no-await-in-loop -- first-seen dir wins the shared dedup sets
    if (await isSkillDir(entry, skillsDir)) {
      admitSkill(discovery, entry.name, path.join(skillsDir, entry.name), skillsDir);
    }
  }
}

/**
 * Enumerate skill subdirs in `resolved.componentPaths.skills`. The array
 * may be empty (no skills declared and no implicit-by-convention) or
 * contain one or more relative-or-absolute paths.
 *
 * Path resolution: a relative element is joined against
 * `resolved.pluginRoot`; an absolute element is used verbatim. The resolved
 * path may legally be missing (ENOENT-graceful per SK-5).
 *
 * Returns an empty array when no entries qualify. The resolver
 * guarantees `componentPaths` is populated for installable plugins (W-03:
 * no defensive fallback; trust the resolver contract).
 */
export async function discoverPluginSkills(input: {
  pluginName: string;
  resolved: MaterializablePlugin;
}): Promise<DiscoverPluginSkillsResult> {
  const { pluginName, resolved } = input;

  // MANF-03 / D-01-21: `seenByDir` is keyed on the RESOLVED skill directory.
  // Two `componentPaths.skills` entries can reach one physical directory at
  // two different depths -- `skills/help` and the implicit-by-convention
  // `skills` above it -- and the resolver cannot collapse them, because each
  // is a legitimately distinct relative path. One directory reached twice is
  // one skill, not a collision, so it is skipped in silence. Two DIFFERENT
  // directories that merely elide to the same generated name keep their
  // D-141-04 warning. `path.resolve` is what makes the two lookups
  // comparable: a declared entry may carry a trailing separator that the
  // entry-level `path.join` never produces.
  //
  // `seenByGenerated` is the first-wins dedup by generated name across ALL
  // declared skills dirs, and within each one (D-141-04).
  const discovery: SkillDiscovery = {
    pluginName,
    commandNames: await commandUpstreamNames(
      pluginName,
      resolved.pluginRoot,
      resolved.componentPaths.commands,
    ),
    seenByGenerated: new Map<string, DiscoveredSkill>(),
    seenByDir: new Set<string>(),
    warnings: [],
  };

  for (const skillsRel of resolved.componentPaths.skills) {
    const skillsDir = path.isAbsolute(skillsRel)
      ? skillsRel
      : path.join(resolved.pluginRoot, skillsRel);

    // A declared element that is ITSELF a skill dir is one skill; otherwise
    // its subdirs are.
    // eslint-disable-next-line no-await-in-loop -- first-seen dir wins the shared dedup sets
    if (await isSelfSkillDir(skillsDir)) {
      admitSkill(discovery, path.basename(skillsDir), skillsDir, skillsDir);
    } else {
      // eslint-disable-next-line no-await-in-loop -- first-seen dir wins the shared dedup sets
      await collectSkillSubdirs(discovery, skillsDir);
    }
  }

  return {
    discovered: Object.freeze([...discovery.seenByGenerated.values()]),
    warnings: Object.freeze(discovery.warnings),
  };
}

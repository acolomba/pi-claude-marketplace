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
//
// SK-2 elision is delegated to `domain/name.ts::generatedSkillName`; this
// module is purely the discovery/filter step.

import { lstat } from "node:fs/promises";
import path from "node:path";

import { assertSafeName, generatedSkillName } from "../../domain/name.ts";
import { readDirEntriesTolerant } from "../../shared/fs-utils.ts";

import type { DiscoveredSkill } from "./types.ts";
import type { MaterializablePlugin } from "../../domain/resolver.ts";
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
 * Handle the self-skill-dir case: a declared `componentPaths.skills` element
 * whose own path is a skill dir (contains `SKILL.md` directly) rather than a
 * parent of skill subdirs. The single skill is threaded through the shared
 * first-wins `seenByGenerated` dedup, so a collision with an earlier entry
 * surfaces via `warnings` (same channel as the subdir path) instead of
 * duplicating.
 *
 * Returns `true` when `skillsDir` was itself a skill dir and has been handled
 * here; `false` when the caller should fall through to subdir enumeration.
 */
async function collectSelfSkillDir(
  pluginName: string,
  skillsDir: string,
  seenByGenerated: Map<string, DiscoveredSkill>,
  warnings: string[],
): Promise<boolean> {
  if (!(await isSelfSkillDir(skillsDir))) {
    return false;
  }

  const sourceName = path.basename(skillsDir);
  assertSafeName(sourceName, `skill directory name in ${skillsDir}`);

  const generatedName = generatedSkillName(pluginName, sourceName);
  const winner = seenByGenerated.get(generatedName);
  if (winner !== undefined) {
    warnings.push(duplicateWarning(sourceName, skillsDir, generatedName, winner.sourceName));
    return true;
  }

  seenByGenerated.set(generatedName, {
    sourceName,
    generatedName,
    skillDir: skillsDir,
  });
  return true;
}

/**
 * Enumerate skill subdirs in `resolved.componentPaths.skills`. The array
 * may be empty (no skills declared and no implicit-by-convention) or
 * contain one or more relative-or-absolute paths.
 *
 * Path resolution: each element is passed through `resolveSkillsDir` -- a
 * relative element is joined against `resolved.pluginRoot`; an absolute
 * element is used verbatim. The resolved path may legally be missing
 * (ENOENT-graceful per SK-5).
 *
 * Returns an empty array when no entries qualify. The resolver
 * guarantees `componentPaths` is populated for installable plugins (W-03:
 * no defensive fallback; trust the resolver contract).
 */
export async function discoverPluginSkills(input: {
  pluginName: string;
  resolved: MaterializablePlugin;
}): Promise<DiscoverPluginSkillsResult> {
  const skillsDirs = input.resolved.componentPaths.skills;

  // First-wins dedup by generated name across ALL declared skills dirs, and
  // within each one. D-141-04: the second occurrence is a soft-fail warning
  // per the D-07 corollary either way -- one entry or two makes no
  // difference, because the map is keyed on the generated name alone.
  const seenByGenerated = new Map<string, DiscoveredSkill>();
  const warnings: string[] = [];

  for (const skillsRel of skillsDirs) {
    const skillsDir = path.isAbsolute(skillsRel)
      ? skillsRel
      : path.join(input.resolved.pluginRoot, skillsRel);

    if (await collectSelfSkillDir(input.pluginName, skillsDir, seenByGenerated, warnings)) {
      continue;
    }

    const entries = await readDirEntriesTolerant(skillsDir);

    const sorted = [...entries].sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of sorted) {
      const full = path.join(skillsDir, entry.name);

      // Refuse symlinked skill dirs.
      // readdir's `withFileTypes` reports the link's TYPE (so a symlink to a
      // directory shows isDirectory()=true). lstat is the only way to detect
      // the link itself.
      if (!(await isSkillDir(entry, skillsDir))) {
        continue;
      }

      // Validate the source name (defense in depth -- assertSafeName throws
      // on path separators, control chars, ".."/".").
      assertSafeName(entry.name, `skill directory name in ${skillsDir}`);

      const generatedName = generatedSkillName(input.pluginName, entry.name);

      // D-07: first-wins dedup by GENERATED name. The second occurrence is
      // a soft-fail with a descriptive warning. RN-6 / D-141-04: the loser
      // may sit in this same dir -- `acme-foo/` and `foo/` in plugin `acme`
      // both generate `acme-foo` -- and it takes the same skip.
      const winner = seenByGenerated.get(generatedName);
      if (winner !== undefined) {
        warnings.push(duplicateWarning(entry.name, skillsDir, generatedName, winner.sourceName));
        continue;
      }

      seenByGenerated.set(generatedName, {
        sourceName: entry.name,
        generatedName,
        skillDir: full,
      });
    }
  }

  return {
    discovered: Object.freeze([...seenByGenerated.values()]),
    warnings: Object.freeze(warnings),
  };
}

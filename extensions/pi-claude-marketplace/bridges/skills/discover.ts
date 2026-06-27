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
//     throwing. RN-6 within-plugin source-name collision (same source name
//     twice in the SAME dir) is handled by `domain/name.ts::assertSafeName`
//     + `assertNoSkillCollisions` -- it remains a HARD error.
//
// SK-2 elision is delegated to `domain/name.ts::generatedSkillName`; this
// module is purely the discovery/filter step.

import { lstat, readdir } from "node:fs/promises";
import path from "node:path";

import { assertSafeName, generatedSkillName } from "../../domain/name.ts";

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

async function readEntriesGracefully(dir: string): Promise<Dirent[]> {
  try {
    return await readdir(dir, { withFileTypes: true, encoding: "utf8" });
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "ENOTDIR") {
      return [];
    }

    throw err;
  }
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

function duplicateWarning(sourceName: string, skillsDir: string, generatedName: string): string {
  return (
    `skill source "${sourceName}" in "${skillsDir}" elides to generated name ` +
    `"${generatedName}" already produced by an earlier componentPaths.skills entry; ` +
    `ignoring duplicate.`
  );
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

  // First-wins dedup by generated name across ALL declared skills dirs.
  // Within a single dir, RN-6 same-source-name collisions are caught
  // downstream by `assertNoSkillCollisions`; across dirs, the second
  // occurrence is a soft-fail warning per D-07 corollary.
  const seenByGenerated = new Map<string, DiscoveredSkill>();
  const warnings: string[] = [];

  for (const skillsRel of skillsDirs) {
    const skillsDir = path.isAbsolute(skillsRel)
      ? skillsRel
      : path.join(input.resolved.pluginRoot, skillsRel);

    const entries = await readEntriesGracefully(skillsDir);

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

      // D-07: first-wins dedup by GENERATED name across array elements.
      // The second occurrence is a soft-fail with a descriptive warning;
      // RN-6 within-dir source-name collisions are still hard errors at
      // `assertNoSkillCollisions` time.
      if (seenByGenerated.has(generatedName)) {
        warnings.push(duplicateWarning(entry.name, skillsDir, generatedName));
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

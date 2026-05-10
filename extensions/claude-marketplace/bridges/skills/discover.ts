// bridges/skills/discover.ts
//
// SK-5 / D-10: enumerate skill subdirs that contain `SKILL.md`.
//
// Carry-forward from V1 `resource/stage.ts::discoverPluginResources` (skills
// branch, lines 46-72) with two deltas:
//   - Sort entries by `name.localeCompare` for deterministic ordering
//     (RESEARCH line 422 recommends).
//   - Refuse symlinked entries inside the skills dir
//     (RESEARCH "Easy mistakes" #7) -- `lstat` each direct child and skip
//     symbolic links instead of following them.
//
// SK-2 elision is delegated to `domain/name.ts::generatedSkillName`; this
// module is purely the discovery/filter step.

import { lstat, readdir } from "node:fs/promises";
import path from "node:path";

import { assertSafeName, generatedSkillName } from "../../domain/name.ts";

import type { DiscoveredSkill } from "./types.ts";
import type { ResolvedPluginInstallable } from "../../domain/resolver.ts";
import type { Dirent } from "node:fs";

/**
 * Enumerate skill subdirs in `resolved.componentPaths.skills`. Returns an
 * empty array when the skills dir is missing (ENOENT-graceful per SK-5) or
 * when no entries qualify. The Phase 2 resolver guarantees `componentPaths`
 * is populated for installable plugins (W-03 fix: dropped defensive
 * fallback; trust the Phase 2 contract).
 */
export async function discoverPluginSkills(input: {
  pluginName: string;
  resolved: ResolvedPluginInstallable;
}): Promise<readonly DiscoveredSkill[]> {
  const skillsDir = input.resolved.componentPaths.skills;
  if (skillsDir === undefined) {
    return [];
  }

  let entries: Dirent[];
  try {
    entries = await readdir(skillsDir, { withFileTypes: true, encoding: "utf8" });
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "ENOTDIR") {
      return [];
    }

    throw err;
  }

  const sorted = [...entries].sort((a, b) => a.name.localeCompare(b.name));
  const discovered: DiscoveredSkill[] = [];

  for (const entry of sorted) {
    // Skip dotfile-prefixed entries (e.g. `.gitkeep`, `.DS_Store`) -- planner-
    // resolved hardening; they are never plugin-author-intended skills.
    if (entry.name.startsWith(".")) {
      continue;
    }

    if (!entry.isDirectory()) {
      continue;
    }

    const full = path.join(skillsDir, entry.name);

    // Refuse symlinked skill dirs (RESEARCH "Easy mistakes" #7).
    // readdir's `withFileTypes` reports the link's TYPE (so a symlink to a
    // directory shows isDirectory()=true). lstat is the only way to detect
    // the link itself.
    const stat = await lstat(full);
    if (stat.isSymbolicLink()) {
      continue;
    }

    // Validate the source name (defense in depth -- assertSafeName throws
    // on path separators, control chars, ".."/".").
    assertSafeName(entry.name, `skill directory name in ${skillsDir}`);

    // Require a regular (non-symlink) SKILL.md file.
    const skillMdPath = path.join(full, "SKILL.md");
    const skillStat = await lstat(skillMdPath).catch(() => null);
    if (!skillStat?.isFile()) {
      continue;
    }

    if (skillStat.isSymbolicLink()) {
      continue;
    }

    discovered.push({
      sourceName: entry.name,
      generatedName: generatedSkillName(input.pluginName, entry.name),
      skillDir: full,
    });
  }

  return discovered;
}

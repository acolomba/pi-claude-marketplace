// bridges/commands/discover.ts
//
// Bridge primitive: enumerate flat `*.md` files under
// `componentPaths.commands` (CM-4 -- non-recursive, ignore non-md). Returns
// a sorted, deterministic `DiscoveredCommand[]`.
//
// Pattern carry-forward: V1 `resource/stage.ts` (commands branch of
// `discoverPluginResources`, lines 73-87). The CM-2 elision is performed
// by the Phase 2 helper `domain/name.ts::generatedCommandName`.
//
// Symlink discipline (RESEARCH "Easy mistakes" #7 / D-14): refuse symlinked
// `.md` entries. We `lstat` each candidate before reading; isSymbolicLink()
// short-circuits without touching the file body. Containment of the
// commands directory itself is the resolver's job (it called
// `assertPathInside(pluginRoot, ...)` when populating componentPaths).

import { lstat, readdir } from "node:fs/promises";
import path from "node:path";

import { assertSafeName, generatedCommandName } from "../../domain/name.ts";

import type { DiscoveredCommand } from "./types.ts";
import type { ResolvedPluginInstallable } from "../../domain/resolver.ts";
import type { Dirent } from "node:fs";

export async function discoverPluginCommands(input: {
  pluginName: string;
  resolved: ResolvedPluginInstallable;
}): Promise<readonly DiscoveredCommand[]> {
  // Phase 2 resolver populates componentPaths.commands only when the plugin
  // declares (or implicitly has) a commands directory. Plugins with no
  // commands flow through here legitimately -- return [] instead of
  // dereferencing an undefined path.
  const commandsRel = input.resolved.componentPaths.commands;

  if (commandsRel === undefined) {
    return [];
  }

  const commandsDir = path.resolve(input.resolved.pluginRoot, commandsRel);

  let entries: Dirent[];

  try {
    entries = await readdir(commandsDir, { withFileTypes: true });
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;

    if (code === "ENOENT" || code === "ENOTDIR") {
      return [];
    }

    throw err;
  }

  const discovered: DiscoveredCommand[] = [];
  // Deterministic ordering for stable warning messages and test assertions.
  const sorted = [...entries].sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of sorted) {
    if (entry.name.startsWith(".")) {
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (!entry.name.endsWith(".md")) {
      continue;
    }

    const full = path.join(commandsDir, entry.name);
    // Refuse symlinked `.md` entries. Even if the link target lives inside
    // the plugin root, the bridge does not honor symlinks (D-14 / PS-1).
    const stat = await lstat(full);

    if (stat.isSymbolicLink()) {
      continue;
    }

    const sourceName = entry.name.slice(0, -3);
    assertSafeName(sourceName, `command source name in ${commandsDir}`);
    discovered.push({
      sourceName,
      generatedName: generatedCommandName(input.pluginName, sourceName),
      commandFile: full,
    });
  }

  return discovered;
}

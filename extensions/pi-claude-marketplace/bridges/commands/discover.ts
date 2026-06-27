// bridges/commands/discover.ts
//
// Bridge primitive: enumerate flat `*.md` files under each declared
// `componentPaths.commands` entry (CM-4 -- non-recursive, ignore non-md).
// Returns a sorted, deterministic `DiscoveredCommand[]` plus a `warnings[]`
// channel for D-07 soft-fails.
//
// The CM-2 elision is performed by `domain/name.ts::generatedCommandName`.
//
// D-07 (COMP-01): iterates over the array shape. First-wins dedup by
// generated command name (`<plugin>:<command>` per RN-1); the second
// occurrence across array elements surfaces as a warning. Within-dir
// RN-6 collisions remain hard errors via `assertNoCommandCollisions`.
//
// Symlink discipline (D-14): refuse symlinked
// `.md` entries. We `lstat` each candidate before reading; isSymbolicLink()
// short-circuits without touching the file body. Containment of the
// commands directory itself is the resolver's job (it called
// `assertPathInside(pluginRoot, ...)` when populating componentPaths).

import { lstat, readdir } from "node:fs/promises";
import path from "node:path";

import { assertSafeName, generatedCommandName } from "../../domain/name.ts";

import type { DiscoveredCommand } from "./types.ts";
import type { MaterializablePlugin } from "../../domain/resolver.ts";
import type { Dirent } from "node:fs";

/** D-07 return shape: `{ discovered, warnings }`. */
export interface DiscoverPluginCommandsResult {
  readonly discovered: readonly DiscoveredCommand[];
  readonly warnings: readonly string[];
}

async function readEntriesGracefully(dir: string): Promise<Dirent[]> {
  try {
    return await readdir(dir, { withFileTypes: true });
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;

    if (code === "ENOENT" || code === "ENOTDIR") {
      return [];
    }

    throw err;
  }
}

async function isCommandFile(dir: string, entry: Dirent): Promise<boolean> {
  if (entry.name.startsWith(".") || !entry.isFile() || !entry.name.endsWith(".md")) {
    return false;
  }

  const stat = await lstat(path.join(dir, entry.name));
  return !stat.isSymbolicLink();
}

function duplicateWarning(sourceName: string, commandsDir: string, generatedName: string): string {
  return (
    `command source "${sourceName}" in "${commandsDir}" elides to generated name ` +
    `"${generatedName}" already produced by an earlier componentPaths.commands entry; ` +
    `ignoring duplicate.`
  );
}

export async function discoverPluginCommands(input: {
  pluginName: string;
  resolved: MaterializablePlugin;
}): Promise<DiscoverPluginCommandsResult> {
  // The resolver populates componentPaths.commands with one element per
  // declared (or implicit-by-convention) commands directory. Empty array
  // means the plugin has no commands -- return the empty discovered + no
  // warnings.
  const commandsDirs = input.resolved.componentPaths.commands;

  const seenByGenerated = new Map<string, DiscoveredCommand>();
  const warnings: string[] = [];

  for (const commandsRel of commandsDirs) {
    const commandsDir = path.isAbsolute(commandsRel)
      ? commandsRel
      : path.resolve(input.resolved.pluginRoot, commandsRel);

    const entries = await readEntriesGracefully(commandsDir);

    // Deterministic ordering for stable warning messages and test assertions.
    const sorted = [...entries].sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of sorted) {
      const full = path.join(commandsDir, entry.name);
      // Refuse symlinked `.md` entries. Even if the link target lives inside
      // the plugin root, the bridge does not honor symlinks (D-14 / PS-1).
      if (!(await isCommandFile(commandsDir, entry))) {
        continue;
      }

      const sourceName = entry.name.slice(0, -3);
      assertSafeName(sourceName, `command source name in ${commandsDir}`);
      const generatedName = generatedCommandName(input.pluginName, sourceName);

      // D-07 first-wins dedup by generated command name.
      if (seenByGenerated.has(generatedName)) {
        warnings.push(duplicateWarning(sourceName, commandsDir, generatedName));
        continue;
      }

      seenByGenerated.set(generatedName, {
        sourceName,
        generatedName,
        commandFile: full,
      });
    }
  }

  return {
    discovered: Object.freeze([...seenByGenerated.values()]),
    warnings: Object.freeze(warnings),
  };
}

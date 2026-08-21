// bridges/commands/discover.ts
//
// Bridge primitive: enumerate `*.md` files under each declared
// `componentPaths.commands` entry, RECURSING into subdirectories. Returns
// a sorted, deterministic `DiscoveredCommand[]` plus a `warnings[]`
// channel for D-07 soft-fails.
//
// CM-4 (revised): discovery is recursive. A file at
// `commands/build/web.md` is discovered with sourceName "build/web" and
// generatedName "<plugin>:build:web" -- the path separator becomes a colon
// in the generated name, matching Claude Code's nested-command convention
// (commands and skills "work the same way"; a nested skill dir is invoked
// as `/apps/web:deploy`). The CM-2 elision is performed by
// `domain/name.ts::generatedCommandName`.
//
// D-07 (COMP-01): iterates over the array shape. First-wins dedup by
// generated command name (`<plugin>:<command>` per RN-1); the second
// occurrence across array elements surfaces as a warning. Within-dir
// RN-6 collisions remain hard errors via `assertNoCommandCollisions`.
//
// Symlink discipline (D-14 / PS-1): refuse symlinked entries -- files AND
// directories. `Dirent.isSymbolicLink()` is checked before any recursion or
// read, so a symlinked subdirectory is never followed (it could escape the
// plugin root). Dotfile-prefixed entries (files and directories) are also
// skipped. Containment of the commands directory itself is the resolver's
// job (it called `assertPathInside(pluginRoot, ...)` when populating
// componentPaths).

import path from "node:path";

import { generatedCommandName } from "../../domain/name.ts";
import { isPlainMarkdownFile, readDirEntriesTolerant } from "../../shared/fs-utils.ts";

import type { DiscoveredCommand } from "./types.ts";
import type { MaterializablePlugin } from "../../domain/resolver.ts";

/** D-07 return shape: `{ discovered, warnings }`. */
export interface DiscoverPluginCommandsResult {
  readonly discovered: readonly DiscoveredCommand[];
  readonly warnings: readonly string[];
}

function duplicateWarning(sourceName: string, commandsDir: string, generatedName: string): string {
  return (
    `command source "${sourceName}" in "${commandsDir}" elides to generated name ` +
    `"${generatedName}" already produced by an earlier componentPaths.commands entry; ` +
    `ignoring duplicate.`
  );
}

/**
 * Recursive walk of one `commands` directory. Collects every plain `.md`
 * file (non-symlink, non-dotfile) with `sourceName` set to the file's
 * relative path from `base` minus the `.md` extension, with OS path
 * separators normalized to `/` (e.g. `commands/build/web.md` ->
 * `sourceName` "build/web"). Subdirectories are descended into in sorted
 * order; symlinked and dotfile-prefixed entries are skipped (D-14).
 *
 * Does NOT dedup -- the caller folds the results into its first-wins map.
 */
async function walkCommandsDir(
  dir: string,
  base: string,
  pluginName: string,
  out: DiscoveredCommand[],
): Promise<void> {
  const entries = await readDirEntriesTolerant(dir);

  // Deterministic ordering for stable warning messages and test assertions.
  const sorted = [...entries].sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of sorted) {
    // Skip dotfile-prefixed files AND directories (e.g. .hidden.md, .git/).
    if (entry.name.startsWith(".")) {
      continue;
    }

    // D-14 / PS-1: refuse symlinks outright, before recursing or reading.
    // A symlinked directory could point outside the plugin root; never follow.
    if (entry.isSymbolicLink()) {
      continue;
    }

    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      await walkCommandsDir(full, base, pluginName, out);
      continue;
    }

    // Refuse symlinked `.md` entries. Even if the link target lives inside
    // the plugin root, the bridge does not honor symlinks (D-14 / PS-1).
    if (!(await isPlainMarkdownFile(dir, entry))) {
      continue;
    }

    const rel = path.relative(base, full).split(path.sep).join("/");
    const sourceName = rel.slice(0, -3); // strip ".md"
    // Per-segment validation (including path-separator rejection) happens
    // inside generatedCommandName, which splits the `/`-separated sourceName
    // and validates each segment. The full sourceName intentionally contains
    // `/` for nested files, so it MUST NOT be passed to assertSafeName here.
    const generatedName = generatedCommandName(pluginName, sourceName);

    out.push({ sourceName, generatedName, commandFile: full });
  }
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

    const found: DiscoveredCommand[] = [];
    await walkCommandsDir(commandsDir, commandsDir, input.pluginName, found);

    for (const command of found) {
      // D-07 first-wins dedup by generated command name.
      if (seenByGenerated.has(command.generatedName)) {
        warnings.push(duplicateWarning(command.sourceName, commandsDir, command.generatedName));
        continue;
      }

      seenByGenerated.set(command.generatedName, command);
    }
  }

  return {
    discovered: Object.freeze([...seenByGenerated.values()]),
    warnings: Object.freeze(warnings),
  };
}

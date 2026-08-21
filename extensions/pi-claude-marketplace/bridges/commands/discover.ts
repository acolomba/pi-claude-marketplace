// bridges/commands/discover.ts
//
// Bridge primitive: enumerate `*.md` files under each declared
// `componentPaths.commands` entry, RECURSING into subdirectories. Returns a
// deterministic `DiscoveredCommand[]` plus a `warnings[]` channel for D-07
// soft-fails and for every entry the walk had to skip.
//
// Order is DFS pre-order: entries are name-sorted within one directory, and
// a subdirectory is walked in full at the point its own name sorts to. The
// array is NOT sorted by generated name. Order is load-bearing -- it IS the
// first-wins tiebreak below -- so a reader who assumes a flat sort
// mispredicts which side of a collision survives.
//
// CM-4: discovery is recursive. A file at `commands/build/web.md` is
// discovered with sourceName "build/web" and generatedName
// "<plugin>:build:web", one colon per path segment.
//
// That convention is measured, not inferred. Claude Code 2.1.228 loaded
// with `--plugin-dir` registers `acme:build:web` for that file and
// `acme:build:web:prod` for `commands/build/web/prod.md`, read off the
// `slash_commands` field of the `system`/`init` message it emits under
// `--output-format stream-json`. Its own documentation contradicts the
// binary: it calls the plugin `commands` field flat and gives a command
// name as "file name without extension". Do not cite the nested-skills
// passage here either -- a nested plugin SKILL is not registered by Claude
// Code at all, so it is the one component kind that demonstrably does not
// work the same way. The CM-2 elision is performed by
// `domain/name.ts::generatedCommandName`.
//
// D-07 (COMP-01): iterates over the array shape. First-wins dedup by
// generated command name (`<plugin>:<command>` per RN-1); a second
// occurrence is skipped with a warning naming the winner. Both directions
// collide: another `componentPaths.commands` entry, or two files under the
// SAME entry, since `acme-tools/lint.md` and `tools/lint.md` both name
// `acme:tools:lint` under D-141-01.
//
// Symlink discipline (D-14 / PS-1): refuse symlinked entries -- files AND
// directories. `Dirent.isSymbolicLink()` is checked before any recursion or
// read, so a symlinked subdirectory is never followed (it could escape the
// plugin root). Dotfile-prefixed entries (files and directories) are also
// skipped; that one IS a divergence, because Claude Code registers
// `commands/.hidden/secret.md` as `acme:.hidden:secret`. Containment of the
// commands directory itself is the resolver's job (it called
// `assertPathInside(pluginRoot, ...)` when populating componentPaths).

import { readdir, stat } from "node:fs/promises";
import path from "node:path";

import { generatedCommandName } from "../../domain/name.ts";
import { CommandNameError } from "../../shared/errors-bridges.ts";
import { causeChainTrailer, errorMessage, isErrnoException } from "../../shared/errors.ts";
import { isPlainMarkdownFile, readDirEntriesTolerant } from "../../shared/fs-utils.ts";

import type { DiscoveredCommand } from "./types.ts";
import type { MaterializablePlugin } from "../../domain/resolver.ts";
import type { Dirent } from "node:fs";

/** D-07 return shape: `{ discovered, warnings }`. */
export interface DiscoverPluginCommandsResult {
  readonly discovered: readonly DiscoveredCommand[];
  readonly warnings: readonly string[];
}

/**
 * D-07 first-wins skip. Names the WINNING source rather than blaming an
 * earlier `componentPaths.commands` entry: since CM-4 made discovery
 * recursive the two sides of a collision are just as often two files under
 * one entry, and naming the winner is true either way and more useful.
 */
function duplicateWarning(
  sourceName: string,
  commandsDir: string,
  generatedName: string,
  winningSourceName: string,
): string {
  return (
    `command source "${sourceName}" in "${commandsDir}" elides to generated name ` +
    `"${generatedName}", already produced by command source "${winningSourceName}"; ` +
    `ignoring duplicate.`
  );
}

function relFrom(base: string, target: string): string {
  return path.relative(base, target).split(path.sep).join("/");
}

function unreadableDirWarning(dir: string, base: string, err: unknown): string {
  return (
    `command subdirectory "${relFrom(base, dir)}" in "${base}" cannot be read: ` +
    `${errorMessage(err)}; skipping subdirectory.`
  );
}

function unreadableFileWarning(file: string, base: string, err: unknown): string {
  return (
    `command file "${relFrom(base, file)}" in "${base}" cannot be read: ` +
    `${errorMessage(err)}; skipping file.`
  );
}

function badNameWarning(err: CommandNameError): string {
  return `${err.message} -- ${causeChainTrailer(err)}; skipping file.`;
}

/**
 * Report a skipped SUBDIRECTORY, and only a subdirectory.
 *
 * A skipped file discards exactly one command and the two policies behind it
 * -- no dotfiles, no symlinks -- are stated in this file's header. A skipped
 * directory discards however many commands the tree below it holds, which
 * the user has no way to count from the install row.
 */
function warnOnDirectorySkip(
  warnings: string[],
  isDirectory: boolean,
  dir: string,
  base: string,
  reason: string,
): void {
  if (!isDirectory) {
    return;
  }

  warnings.push(
    `command subdirectory "${relFrom(base, dir)}" in "${base}" ${reason}; skipping subdirectory.`,
  );
}

function duplicateFileWarning(
  fileRel: string,
  firstGeneratedName: string,
  secondGeneratedName: string,
): string {
  return (
    `command file "${fileRel}" is reached by more than one componentPaths.commands ` +
    `entry; installing it as both "${firstGeneratedName}" and "${secondGeneratedName}".`
  );
}

/**
 * Whether a skipped symlink pointed at a directory.
 *
 * The walk never descends into a symlinked directory and never reads one
 * (D-14 / PS-1). The single `stat` here reads metadata to decide whether the
 * skip is worth reporting: a symlinked FILE discards one artifact, and a
 * symlinked DIRECTORY discards however many the tree below it holds. A
 * dangling or unreadable link answers "no" -- nothing was discarded, so
 * there is nothing to report.
 */
async function symlinkPointsAtDirectory(full: string): Promise<boolean> {
  try {
    return (await stat(full)).isDirectory();
  } catch {
    return false;
  }
}

/**
 * The errnos a single walk step answers with a skip instead of an install
 * failure.
 *
 * All four describe the entry, not the machine. A permission refusal
 * (EACCES, or EPERM on Windows) is a plugin-shape problem the author can
 * fix; ENOENT and ENOTDIR mean the entry `readdir` reported changed shape
 * or vanished before the walk reached it. Every other errno -- EIO on
 * failing storage, EMFILE when the process is out of descriptors, ENOMEM --
 * says the read itself is unreliable, so it propagates and fails the
 * install rather than quietly installing a subset of the plugin.
 */
const TOLERATED_WALK_ERRNOS: ReadonlySet<string> = new Set([
  "EACCES",
  "EPERM",
  "ENOENT",
  "ENOTDIR",
]);

function isToleratedWalkError(err: unknown): boolean {
  return isErrnoException(err) && TOLERATED_WALK_ERRNOS.has(err.code ?? "");
}

/**
 * Reads one directory of the walk. The two levels answer a read failure
 * differently.
 *
 * The declared `commands/` directory itself keeps `readDirEntriesTolerant`:
 * an absent directory (ENOENT) or a file in its place (ENOTDIR) means the
 * plugin declares no commands, and every other errno propagates as an
 * install failure.
 *
 * A subdirectory is a different question. It was found by `readdir`, so it
 * exists; a failure to read it (EACCES on a mode-000 directory, for example)
 * is a plugin-shape problem that must not abort the install. Skip it and
 * report it through the same `warnings[]` channel the D-07 first-wins skips
 * use.
 */
async function readWalkEntries(dir: string, base: string, warnings: string[]): Promise<Dirent[]> {
  if (dir === base) {
    return await readDirEntriesTolerant(dir);
  }

  try {
    return await readdir(dir, { withFileTypes: true, encoding: "utf8" });
  } catch (err) {
    if (!isToleratedWalkError(err)) {
      throw err;
    }

    warnings.push(unreadableDirWarning(dir, base, err));
    return [];
  }
}

/**
 * `generatedCommandName` with the directory context restored.
 *
 * `domain/name.ts` is a pure module: it knows the failing segment but not
 * the directory the file came from, so its label names only the source. The
 * throw site and the call site each hold half of the answer, and the call
 * site is where they meet. `CommandNameError` carries both, and the reason
 * rides `Error.cause`.
 */
function nameCommandInDir(pluginName: string, sourceName: string, base: string): string {
  try {
    return generatedCommandName(pluginName, sourceName);
  } catch (err) {
    throw new CommandNameError(sourceName, base, { cause: err });
  }
}

/**
 * One non-directory entry of the walk.
 *
 * Two things can go wrong per file, and neither may abort the install (a
 * tree that installs today must keep installing):
 *
 *   - The `lstat` behind `isPlainMarkdownFile` fails. A mode-0444 directory
 *     is readable but not searchable, so `readdir` lists its children and
 *     every `lstat` on one of them returns EACCES.
 *   - The relative path does not produce a valid generated name. D-141-02
 *     retired the common case (a head the elision empties); what remains is
 *     a segment that fails RN-2 on its own -- an ASCII control character or
 *     a literal backslash in a path component.
 *
 * Both skip the one file and report it on `warnings`.
 */
async function collectCommandFile(args: {
  dir: string;
  entry: Dirent;
  full: string;
  base: string;
  pluginName: string;
  out: DiscoveredCommand[];
  warnings: string[];
}): Promise<void> {
  const { dir, entry, full, base, pluginName, out, warnings } = args;

  // The walk already refused this entry when `Dirent.isSymbolicLink()` was
  // true, so the lstat inside `isPlainMarkdownFile` re-asks a settled
  // question for commands. What the call decides here is the regular-file
  // and `.md`-extension test. The agents bridge shares the helper and has
  // no Dirent-level symlink check, so the lstat is load-bearing there.
  let plain: boolean;
  try {
    plain = await isPlainMarkdownFile(dir, entry);
  } catch (err) {
    if (!isToleratedWalkError(err)) {
      throw err;
    }

    warnings.push(unreadableFileWarning(full, base, err));
    return;
  }

  if (!plain) {
    return;
  }

  const sourceName = relFrom(base, full).slice(0, -3); // strip ".md"

  // Per-segment validation (including path-separator rejection) happens
  // inside generatedCommandName, which splits the `/`-separated sourceName
  // and validates each segment. The full sourceName intentionally contains
  // `/` for nested files, so it MUST NOT be passed to assertSafeName here.
  let generatedName: string;
  try {
    generatedName = nameCommandInDir(pluginName, sourceName, base);
  } catch (err) {
    if (!(err instanceof CommandNameError)) {
      throw err;
    }

    warnings.push(badNameWarning(err));
    return;
  }

  out.push({ sourceName, generatedName, commandFile: full });
}

/**
 * Recursive walk of one `commands` directory. Collects every plain `.md`
 * file (non-symlink, non-dotfile) with `sourceName` set to the file's
 * relative path from `base` minus the `.md` extension, with OS path
 * separators normalized to `/` (e.g. `commands/build/web.md` ->
 * `sourceName` "build/web"). Subdirectories are descended into in sorted
 * order; symlinked and dotfile-prefixed entries are skipped (D-14).
 *
 * An unreadable subdirectory, an unreadable file, and a file whose path
 * does not produce a valid generated name are each skipped and reported on
 * `warnings`. Nothing here aborts the install except an errno that says the
 * read itself is unreliable (see `TOLERATED_WALK_ERRNOS`).
 *
 * Does NOT dedup -- the caller folds the results into its first-wins map.
 */
async function walkCommandsDir(
  dir: string,
  base: string,
  pluginName: string,
  out: DiscoveredCommand[],
  warnings: string[],
): Promise<void> {
  const entries = await readWalkEntries(dir, base, warnings);

  // Deterministic ordering for stable warning messages and test assertions.
  const sorted = [...entries].sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of sorted) {
    const full = path.join(dir, entry.name);

    // Skip dotfile-prefixed files AND directories (e.g. .hidden.md, .git/).
    if (entry.name.startsWith(".")) {
      warnOnDirectorySkip(warnings, entry.isDirectory(), full, base, "is dotfile-prefixed");
      continue;
    }

    // D-14 / PS-1: refuse symlinks outright, before recursing or reading.
    // A symlinked directory could point outside the plugin root; never follow.
    if (entry.isSymbolicLink()) {
      const pointsAtDir = await symlinkPointsAtDirectory(full);
      warnOnDirectorySkip(warnings, pointsAtDir, full, base, "is a symlink");
      continue;
    }

    if (entry.isDirectory()) {
      await walkCommandsDir(full, base, pluginName, out, warnings);
      continue;
    }

    await collectCommandFile({ dir, entry, full, base, pluginName, out, warnings });
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
  // Keyed on the absolute source file. Two componentPaths.commands entries
  // that overlap -- "commands" and "commands/build", say -- reach the same
  // file at two different depths, so it generates two DIFFERENT names and
  // the dedup above never sees it. Both names install and the user gets the
  // one command twice under two spellings, which is worth saying out loud.
  const seenByFile = new Map<string, DiscoveredCommand>();
  const warnings: string[] = [];

  for (const commandsRel of commandsDirs) {
    const commandsDir = path.isAbsolute(commandsRel)
      ? commandsRel
      : path.resolve(input.resolved.pluginRoot, commandsRel);

    const found: DiscoveredCommand[] = [];
    await walkCommandsDir(commandsDir, commandsDir, input.pluginName, found, warnings);

    for (const command of found) {
      // D-07 first-wins dedup by generated command name.
      const winner = seenByGenerated.get(command.generatedName);
      if (winner !== undefined) {
        warnings.push(
          duplicateWarning(
            command.sourceName,
            commandsDir,
            command.generatedName,
            winner.sourceName,
          ),
        );
        continue;
      }

      const sameFile = seenByFile.get(command.commandFile);
      if (sameFile !== undefined) {
        warnings.push(
          duplicateFileWarning(
            relFrom(input.resolved.pluginRoot, command.commandFile),
            sameFile.generatedName,
            command.generatedName,
          ),
        );
      }

      seenByFile.set(command.commandFile, command);
      seenByGenerated.set(command.generatedName, command);
    }
  }

  return {
    discovered: Object.freeze([...seenByGenerated.values()]),
    warnings: Object.freeze(warnings),
  };
}

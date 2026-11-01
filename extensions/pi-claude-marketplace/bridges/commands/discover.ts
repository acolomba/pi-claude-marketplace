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
//
// D-CF3-05: a declared `componentPaths.commands` entry may name a file as
// well as a directory, as Claude Code 2.1.316 loads it (E5). Each entry is
// classified once with `lstat` before anything reads it. A regular `.md`
// file whose name does not start with a dot is one command, named from its
// basename without `.md` (`cmds/sub/x.md` is `<plugin>:x`). A directory is
// walked as above. Any other file, and a symlink of any kind, is skipped
// with a warning that names the declared path. A missing entry stays
// silent. The resolver already refuses a declared path that passes through
// a link, so the symlink check here guards only a path that changed after
// resolving, as the walk's PS-1 rule does for the entries it lists.
//
// D-CF3-03: after the declared paths, the walk reads the entries of an
// object-map `commands` declaration (`componentPaths.commandMap`) in declared
// order. A `source` entry that names a command file is one command named
// `<plugin>:<key>`, the key named as a source name. A directory `source` is
// walked as a declared directory and its key is ignored. A key Claude Code
// would refuse, a source that is missing or is not a command file, and a
// second key on a file already loaded are skipped with a warning. Because
// the declared paths come first, a declared file wins a name it shares with
// a map key.

import { lstat, readdir, stat } from "node:fs/promises";
import path from "node:path";

import { generatedCommandName } from "../../domain/name.ts";
import { CommandNameError } from "../../shared/errors-bridges.ts";
import { causeChainTrailer, errorMessage, isErrnoException } from "../../shared/errors.ts";
import { isPlainMarkdownFile, readDirEntriesTolerant } from "../../shared/fs-utils.ts";

import type { DiscoveredCommand } from "./types.ts";
import type { CommandMapEntry, MaterializablePlugin } from "../../domain/resolver-types.ts";
import type { Dirent, Stats } from "node:fs";

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
  return isErrnoException(err) && TOLERATED_WALK_ERRNOS.has(err.code);
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
 *
 * The error is returned, not thrown: the one caller skips the file and
 * reports it on `warnings`, so it reads the typed value directly instead of
 * narrowing an `unknown` catch binding back to this class.
 */
function nameCommandInDir(
  pluginName: string,
  sourceName: string,
  base: string,
):
  | { readonly ok: true; readonly name: string }
  | { readonly ok: false; readonly error: CommandNameError } {
  try {
    return { ok: true, name: generatedCommandName(pluginName, sourceName) };
  } catch (err) {
    return { ok: false, error: new CommandNameError(sourceName, base, { cause: err }) };
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
 *     keeps the head verbatim when elision would empty it, so what remains
 *     is a segment that fails RN-2 on its own -- an ASCII control character
 *     or a literal backslash in a path component.
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
  const named = nameCommandInDir(pluginName, sourceName, base);
  if (!named.ok) {
    warnings.push(badNameWarning(named.error));
    return;
  }

  out.push({ sourceName, generatedName: named.name, commandFile: full });
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
      // eslint-disable-next-line no-await-in-loop -- appends to the shared output and warnings in name order
      const pointsAtDir = await symlinkPointsAtDirectory(full);
      warnOnDirectorySkip(warnings, pointsAtDir, full, base, "is a symlink");
      continue;
    }

    if (entry.isDirectory()) {
      // eslint-disable-next-line no-await-in-loop -- appends to the shared output and warnings in name order
      await walkCommandsDir(full, base, pluginName, out, warnings);
      continue;
    }

    // eslint-disable-next-line no-await-in-loop -- appends to the shared output and warnings in name order
    await collectCommandFile({ dir, entry, full, base, pluginName, out, warnings });
  }
}

/**
 * D-CF3-05: the warning for a declared commands path that is neither a
 * directory nor a command file. It names the path relative to the plugin
 * root, in the walk's wording.
 */
function declaredPathWarning(declared: string, pluginRoot: string, reason: string): string {
  return `declared command path "${relFrom(pluginRoot, declared)}" in "${pluginRoot}" ${reason}; skipping path.`;
}

/**
 * D-CF3-05: why a declared path that is not a directory is not a command
 * file, or `undefined` when it is one: a regular file whose name ends in
 * `.md` and does not start with a dot. A symlink is refused whatever it
 * points at (PS-1).
 */
function declaredFileRefusal(declared: string, stats: Stats): string | undefined {
  const name = path.basename(declared);
  if (stats.isSymbolicLink()) {
    return "is a symlink";
  }

  if (!stats.isFile()) {
    return "is not a regular file";
  }

  if (name.startsWith(".")) {
    return "is dotfile-prefixed";
  }

  return name.endsWith(".md") ? undefined : "is not a markdown file";
}

/**
 * `lstat` of a declared path, or `undefined` when the path is absent
 * (ENOENT) or a file stands where a parent directory should be (ENOTDIR).
 * Both mean the plugin declares no commands there, as an absent directory
 * always has. Every other errno propagates as an install failure.
 */
async function lstatDeclaredPath(declared: string): Promise<Stats | undefined> {
  try {
    return await lstat(declared);
  } catch (err) {
    if (isErrnoException(err) && (err.code === "ENOENT" || err.code === "ENOTDIR")) {
      return undefined;
    }

    throw err;
  }
}

/**
 * D-CF3-05: the commands that one declared `componentPaths.commands` entry
 * holds. A directory is walked recursively, a command file is one command
 * named from its basename, and every other path is skipped with a warning.
 * The caller folds the result into its first-wins sets in declared order.
 */
async function discoverDeclaredPath(
  declared: string,
  pluginRoot: string,
  pluginName: string,
  warnings: string[],
): Promise<DiscoveredCommand[]> {
  const found: DiscoveredCommand[] = [];
  const stats = await lstatDeclaredPath(declared);
  if (stats === undefined) {
    return found;
  }

  if (stats.isDirectory()) {
    await walkCommandsDir(declared, declared, pluginName, found, warnings);
    return found;
  }

  const refusal = declaredFileRefusal(declared, stats);
  if (refusal !== undefined) {
    warnings.push(declaredPathWarning(declared, pluginRoot, refusal));
    return found;
  }

  const sourceName = path.basename(declared).slice(0, -3); // strip ".md"
  const named = nameCommandInDir(pluginName, sourceName, path.dirname(declared));
  if (!named.ok) {
    warnings.push(badNameWarning(named.error));
    return found;
  }

  found.push({ sourceName, generatedName: named.name, commandFile: declared });
  return found;
}

/**
 * T-03-25: a control or format character of a map key is shown as its code
 * point, so a warning never carries a character that hides text or turns
 * its direction around.
 */
function showHiddenCharacters(text: string): string {
  return text.replace(
    /[\p{Cc}\p{Cf}]/gu,
    (character) => `\\u{${Number(character.codePointAt(0)).toString(16).toUpperCase()}}`,
  );
}

/**
 * D-CF3-03: the warning for a command map entry the walk skips, in the
 * walk's wording. It names the key and no absolute path: the install row
 * already names the plugin, and the paths it quotes are relative to the
 * plugin root.
 */
function mapEntryWarning(key: string, reason: string): string {
  return showHiddenCharacters(`command map entry "${key}" ${reason}; skipping entry.`);
}

// D-CF3-03: Claude Code 2.1.316 refuses a command name that ends in `:` or
// holds `<`, `>`, a blank, or a hidden or direction-changing character
// (03-UPSTREAM-EVIDENCE Q3.11). `\p{Cf}` is the Unicode class of those
// format characters.
const MAP_KEY_RULES: readonly { readonly pattern: RegExp; readonly reason: string }[] = [
  { pattern: /:$/u, reason: 'ends with ":"' },
  { pattern: /[<>]/u, reason: 'holds "<" or ">"' },
  { pattern: /\s/u, reason: "holds whitespace" },
  { pattern: /\p{Cf}/u, reason: "holds a hidden or direction-changing character" },
];

/**
 * D-CF3-03: the generated name of a map key, or why the key cannot name a
 * command. The key is a source name, so CM-2 elision applies and a `/` opens
 * a `:` segment, as for a nested file.
 */
function nameMapKey(
  pluginName: string,
  key: string,
): { readonly ok: true; readonly name: string } | { readonly ok: false; readonly reason: string } {
  const rule = MAP_KEY_RULES.find(({ pattern }) => pattern.test(key));
  if (rule !== undefined) {
    return { ok: false, reason: rule.reason };
  }

  try {
    return { ok: true, name: generatedCommandName(pluginName, key) };
  } catch (err) {
    return {
      ok: false,
      reason: `cannot name a command (${errorMessage(err).replace(/\.$/u, "")})`,
    };
  }
}

/**
 * D-CF3-03: why the file a map entry's `source` names is not a command file,
 * or `undefined` when it is one. A missing file is skipped too, as Claude
 * Code 2.1.316 loads the plugin without it.
 */
function mapSourceRefusal(source: string, stats: Stats | undefined): string | undefined {
  if (stats === undefined) {
    return `names "${source}", which does not exist`;
  }

  const refusal = declaredFileRefusal(source, stats);
  return refusal === undefined ? undefined : `names "${source}", which ${refusal}`;
}

/** What one command map entry adds to the discovery. */
interface MapEntryDiscovery {
  readonly found: readonly DiscoveredCommand[];
  /** The key that names the found file; absent for a walked directory. */
  readonly key?: string;
}

/**
 * D-CF3-03: the commands one map entry holds. A directory `source` is walked
 * as a declared directory, and its key is ignored, as Claude Code 2.1.316
 * does. A file `source` is one command named after its key. A bad key or a
 * source that is not a command file skips the entry with a warning.
 */
async function discoverMapEntry(
  mapEntry: CommandMapEntry,
  pluginRoot: string,
  pluginName: string,
  warnings: string[],
): Promise<MapEntryDiscovery> {
  if (!("source" in mapEntry)) {
    return { found: [] };
  }

  const sourceFile = path.resolve(pluginRoot, mapEntry.source);
  const stats = await lstatDeclaredPath(sourceFile);
  if (stats?.isDirectory() === true) {
    const walked: DiscoveredCommand[] = [];
    await walkCommandsDir(sourceFile, sourceFile, pluginName, walked, warnings);
    return { found: walked };
  }

  const named = nameMapKey(pluginName, mapEntry.key);
  if (!named.ok) {
    warnings.push(mapEntryWarning(mapEntry.key, named.reason));
    return { found: [] };
  }

  const refusal = mapSourceRefusal(relFrom(pluginRoot, sourceFile), stats);
  if (refusal !== undefined) {
    warnings.push(mapEntryWarning(mapEntry.key, refusal));
    return { found: [] };
  }

  return {
    found: [{ sourceName: mapEntry.key, generatedName: named.name, commandFile: sourceFile }],
    key: mapEntry.key,
  };
}

/** The first-wins sets of one discovery, and its warnings. */
interface DiscoveryState {
  readonly byGenerated: Map<string, DiscoveredCommand>;
  /**
   * Keyed on the absolute source file. Two componentPaths.commands entries
   * that overlap -- "commands" and "commands/build", say -- reach the same
   * file at two different depths, so it generates two DIFFERENT names and
   * generated-name dedup cannot see it. Keep the first discovery silently;
   * distinct files that generate the same name still produce a warning.
   */
  readonly byFile: Map<string, DiscoveredCommand>;
  readonly warnings: string[];
}

/**
 * Folds one found command into the first-wins sets. `where` is the declared
 * path the command came from, or the plugin root for a map entry. A file
 * found again is dropped silently, except when a map key names it: D-CF3-03
 * warns that the key loses to the command that loaded the file first. A
 * generated name found again warns either way (D-07).
 */
function admitCommand(
  state: DiscoveryState,
  command: DiscoveredCommand,
  where: string,
  mapKey: string | undefined,
): void {
  const fileWinner = state.byFile.get(command.commandFile);
  if (fileWinner !== undefined) {
    if (mapKey !== undefined) {
      const file = relFrom(where, command.commandFile);
      state.warnings.push(
        mapEntryWarning(
          mapKey,
          `names "${file}", already loaded as command source "${fileWinner.sourceName}"`,
        ),
      );
    }

    return;
  }

  state.byFile.set(command.commandFile, command);

  // D-07 first-wins dedup by generated command name.
  const winner = state.byGenerated.get(command.generatedName);
  if (winner === undefined) {
    state.byGenerated.set(command.generatedName, command);
    return;
  }

  state.warnings.push(
    mapKey === undefined
      ? duplicateWarning(command.sourceName, where, command.generatedName, winner.sourceName)
      : mapEntryWarning(
          mapKey,
          `elides to generated name "${command.generatedName}", already produced by command source "${winner.sourceName}"`,
        ),
  );
}

/**
 * Discovers the plugin's commands: each declared `componentPaths.commands`
 * entry in order, then each entry of the D-CF3-03 object map in declared
 * order, so a declared path's file wins a name it shares with a map key.
 */
export async function discoverPluginCommands(input: {
  pluginName: string;
  resolved: MaterializablePlugin;
}): Promise<DiscoverPluginCommandsResult> {
  // The resolver populates componentPaths.commands with one element per
  // declared (or implicit-by-convention) commands directory or, under
  // D-CF3-05, declared command file. Empty array means the plugin has no
  // commands -- return the empty discovered + no warnings.
  const { pluginRoot, componentPaths } = input.resolved;
  const state: DiscoveryState = { byGenerated: new Map(), byFile: new Map(), warnings: [] };

  for (const commandsRel of componentPaths.commands) {
    const commandsDir = path.isAbsolute(commandsRel)
      ? commandsRel
      : path.resolve(pluginRoot, commandsRel);

    // eslint-disable-next-line no-await-in-loop -- first-seen path wins the shared dedup sets
    const found = await discoverDeclaredPath(
      commandsDir,
      pluginRoot,
      input.pluginName,
      state.warnings,
    );
    for (const command of found) {
      admitCommand(state, command, commandsDir, undefined);
    }
  }

  for (const mapEntry of componentPaths.commandMap ?? []) {
    // eslint-disable-next-line no-await-in-loop -- first-seen entry wins the shared dedup sets
    const { found, key } = await discoverMapEntry(
      mapEntry,
      pluginRoot,
      input.pluginName,
      state.warnings,
    );
    for (const command of found) {
      admitCommand(state, command, pluginRoot, key);
    }
  }

  return {
    discovered: Object.freeze([...state.byGenerated.values()]),
    warnings: Object.freeze(state.warnings),
  };
}

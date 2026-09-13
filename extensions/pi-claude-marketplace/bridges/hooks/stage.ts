// bridges/hooks/stage.ts
//
// Hooks bridge read/write/remove primitives (LIFE-03 / D-63-02).
//
// The hooks bridge owns exactly one file per installed plugin:
//   <scopeRoot>/pi-claude-marketplace/hooks/<plugin>/hooks.json
// so a single tmp+rename via `atomicWriteJson` is sufficient (NFR-1) -- no
// staging directory, no two-phase commit shape. `writeHookConfig` walks the
// plugin's `<pluginRoot>/hooks/` subtree BEFORE the write and refuses any
// symlink whose `fs.realpath` escapes `pluginRoot` (LIFE-03); the read-side
// walk is belt-and-suspenders to the write-side `assertPathInside` + the
// `assertSafeName` guard on the plugin name. `removeHookConfig` is a single
// `fs.rm(..., { recursive: true, force: true })` and is idempotent (NFR-3).

import { lstat, readFile, readdir, readlink, realpath, rm } from "node:fs/promises";
import path from "node:path";

import { assertSafeName } from "../../domain/name.ts";
import { atomicWriteJson } from "../../shared/atomic-json.ts";
import {
  PathContainmentError,
  SymlinkRefusedError,
  assertPathInside,
} from "../../shared/path-safety.ts";

import type { ScopedLocations } from "../../persistence/locations.ts";
import type { Dirent, Stats } from "node:fs";

/** Required read-only filesystem operations for inspecting a hooks tree. */
export interface HooksTreeInspector {
  readonly lstat: (target: string) => Promise<Stats>;
  readonly readdir: (directory: string) => Promise<Dirent[]>;
  readonly readlink: (target: string) => Promise<string>;
  readonly realpath: (target: string) => Promise<string>;
}

/**
 * Single source of truth for the hooks bridge WRITE path, consumed by
 * `writeHookConfig`.
 *
 * The read sites do not route through it: `bridges/hooks/index.ts` keeps this
 * helper off the barrel, so the hydrate path in `event-router.ts` and the
 * summary read in `orchestrators/plugin/info.ts` each compose the same one-line
 * join inline (D-57-03), as `info.ts` records at its own composition site. The
 * three stay in step because `resources.hooks` carries the generated name this
 * function joins. NFR-10 containment is carried by each caller's
 * `assertPathInside` chokepoint, not by the composer.
 */
export function hookConfigPathFor(locations: ScopedLocations, plugin: string): string {
  return path.join(locations.hooksDir, plugin, "hooks.json");
}

/**
 * The real implementation of the hooks bridge's read port (`HooksFileReader`):
 * one utf-8 read of the path it is given and nothing else.
 *
 * The composition root supplies it to both hooks factories and it is never
 * defaulted into a parameter (D-09-05), so a call site that forgets the port
 * fails to compile rather than falling back to a live filesystem boundary.
 *
 * NFR-10: the path arrives already contained. This function performs no
 * resolution, joining or normalization, so containment stays where it is --
 * the caller's `assertPathInside` chokepoint -- and an injected reader buys no
 * path authority.
 */
export function readHooksJson(hooksJsonPath: string): Promise<string> {
  return readFile(hooksJsonPath, "utf8");
}

/**
 * LIFE-03 read-side defense: walk `<pluginRoot>/hooks/` and refuse the
 * first symlink whose `realpath` escapes `pluginRoot`. The subtree walk
 * catches a symlink BURIED inside the hooks tree -- the existing
 * `assertPathInside` chokepoint only walks from `parent` to `child`, so a
 * leaf-level rogue link would slip past write-side containment.
 *
 * The walker is a hand-rolled stack walk that calls `readdir` ONE LEVEL at
 * a time (NO `recursive: true`) and uses `lstat` to classify each entry
 * WITHOUT following symlinks. Directory entries are descended into only
 * when they are real directories AND not symbolic links; this guarantees
 * the walk never issues any `fs` call against a path outside
 * `<pluginRoot>/hooks/`. The first symlink encountered is fed through
 * `realpath` + `assertPathInside(pluginRoot, ...)` and rejected with
 * `SymlinkRefusedError` if its target escapes `pluginRoot`. Even an
 * in-tree-resolving symlink is NOT descended through -- the walker treats
 * every symbolic link as a boundary.
 *
 * Throws `SymlinkRefusedError` (subclass of `PathContainmentError`, inherits
 * PI-14 handling, D-17) on the first escaping symlink encountered: the
 * entry IS a symlink AND its `realpath` is outside `pluginRoot` -- both
 * halves of the LIFE-03 vector. The narrower subclass is chosen over the
 * parent class because a non-symlink containment violation can't occur
 * from this walk (every emitted path is under `pluginRoot/hooks/`).
 *
 * ENOENT/ENOTDIR on the hooks subtree (or any descendant directory) is a
 * clean continue -- a plugin with no `hooks/` dir has nothing to check.
 * Any other I/O error propagates.
 */
async function assertNoSymlinkEscapeInHooksSubtree(
  inspector: HooksTreeInspector,
  pluginRoot: string,
): Promise<void> {
  const hooksRoot = path.join(pluginRoot, "hooks");
  const stack: string[] = [hooksRoot];

  while (stack.length > 0) {
    const dir = stack.slice(-1).join("");
    stack.pop();

    const entries = await readEntriesOrSkip(inspector, dir);
    if (entries === null) {
      continue;
    }

    for (const entry of entries) {
      const linkPath = path.join(dir, entry.name);
      // `lstat` (NOT `stat`) so we never follow a symlink target. This is
      // the core of the containment guarantee: we MUST be able to detect
      // "this entry is a symlink" without issuing any FS call against the
      // target it points to.
      const stat = await inspector.lstat(linkPath);

      if (stat.isSymbolicLink()) {
        await assertSymlinkEntryContained(inspector, pluginRoot, linkPath);
        // Even if the symlink resolves INSIDE pluginRoot, we do NOT push
        // it onto the walk stack. Every symbolic link is a boundary -- the
        // walker never descends through one.
        continue;
      }

      if (stat.isDirectory()) {
        stack.push(linkPath);
      }
      // Regular files: nothing to check; the walker is only looking for
      // symbolic links.
    }
  }
}

/**
 * One level of `readdir(dir, { withFileTypes: true })` with ENOENT/ENOTDIR
 * translated to a `null` skip signal. Any other I/O error propagates.
 */
async function readEntriesOrSkip(
  inspector: HooksTreeInspector,
  dir: string,
): Promise<Dirent[] | null> {
  try {
    return await inspector.readdir(dir);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "ENOTDIR") {
      return null;
    }

    throw err;
  }
}

/**
 * Run the `realpath` + `assertPathInside` containment check for one
 * symlink entry. The pass-through `assertPathInside` ALREADY throws
 * `SymlinkRefusedError` when an intermediate segment from `pluginRoot`
 * down to `resolved` is itself a symlink (e.g. the pluginRoot tmpdir on
 * macOS resolving through `/private/var`). The translation block below
 * only converts the plain containment-only failure case to a
 * `SymlinkRefusedError`, preserving the LIFE-03 rejection contract so
 * callers can `instanceof`-discriminate a symlink-escape from a generic
 * containment failure. `SymlinkRefusedError` inherits
 * `PathContainmentError` so PI-14 instance-check handling propagates
 * (D-17).
 */
async function assertSymlinkEntryContained(
  inspector: HooksTreeInspector,
  pluginRoot: string,
  linkPath: string,
): Promise<void> {
  // Resolve both sides so the string-prefix check in assertPathInside
  // works on macOS where /var is a symlink to /private/var: realpath of
  // linkPath yields /private/var/... but pluginRoot is still /var/...
  // unless we also resolve it, causing a false containment failure.
  const [resolved, resolvedRoot] = await Promise.all([
    inspector.realpath(linkPath),
    inspector.realpath(pluginRoot),
  ]);
  try {
    await assertPathInside(resolvedRoot, resolved, `hooks subtree symlink ${linkPath}`);
  } catch (err) {
    if (err instanceof SymlinkRefusedError) {
      throw err;
    }

    if (err instanceof PathContainmentError) {
      const linkTarget = await readSymlinkTargetSafe(inspector, linkPath);
      throw new SymlinkRefusedError(
        pluginRoot,
        resolved,
        `hooks subtree symlink ${linkPath}`,
        linkPath,
        linkTarget,
      );
    }

    throw err;
  }
}

async function readSymlinkTargetSafe(
  inspector: HooksTreeInspector,
  linkPath: string,
): Promise<string> {
  try {
    return await inspector.readlink(linkPath);
  } catch {
    return "<unreadable>";
  }
}

export interface WriteHookConfigInput {
  readonly locations: ScopedLocations;
  readonly pluginName: string;
  readonly pluginRoot: string;
  readonly hooksValue: unknown;
}

export interface WriteHookConfigResult {
  readonly written: true;
  readonly path: string;
}

/**
 * LIFE-03 / D-63-02 hooks bridge write. Order of operations:
 *   1. `assertSafeName(pluginName)` -- rejects "/", "\", ".", "..", control chars.
 *   2. Subtree walk over `<pluginRoot>/hooks/` -- rejects escaping symlinks.
 *   3. `assertPathInside(hooksDir, target)` -- belt-and-suspenders NFR-10
 *      containment on the constructed target path.
 *   4. `atomicWriteJson` -- single tmp+rename+fsync (NFR-1).
 *
 * Idempotent: a second call with the same input produces the same final
 * file content (NFR-3).
 */
export function createWriteHookConfig(
  inspector: HooksTreeInspector,
): (input: WriteHookConfigInput) => Promise<WriteHookConfigResult> {
  return async function writeHookConfig(
    input: WriteHookConfigInput,
  ): Promise<WriteHookConfigResult> {
    const { locations, pluginName, pluginRoot, hooksValue } = input;

    assertSafeName(pluginName, "hooks bridge plugin name");
    await assertNoSymlinkEscapeInHooksSubtree(inspector, pluginRoot);

    const target = hookConfigPathFor(locations, pluginName);
    await assertPathInside(locations.hooksDir, target, "hooks bridge write target");
    await atomicWriteJson(target, hooksValue);

    return { written: true, path: target };
  };
}

const NODE_HOOKS_TREE_INSPECTOR: HooksTreeInspector = {
  lstat: async (target: string): Promise<Stats> => lstat(target),
  readdir: async (directory: string): Promise<Dirent[]> =>
    readdir(directory, { withFileTypes: true }),
  readlink: async (target: string): Promise<string> => readlink(target),
  realpath: async (target: string): Promise<string> => realpath(target),
};

/** Writes a hooks config through the Node-backed tree inspector. */
export const writeHookConfig = createWriteHookConfig(NODE_HOOKS_TREE_INSPECTOR);

export interface RemoveHookConfigInput {
  readonly locations: ScopedLocations;
  readonly pluginName: string;
}

export interface RemoveHookConfigResult {
  readonly removed: string;
}

/**
 * LIFE-03 / D-63-02 hooks bridge remove. Idempotent (NFR-3) via
 * `{ recursive: true, force: true }` -- ENOENT is swallowed and the
 * result still names the plugin.
 */
export async function removeHookConfig(
  input: RemoveHookConfigInput,
): Promise<RemoveHookConfigResult> {
  const { locations, pluginName } = input;

  assertSafeName(pluginName, "hooks bridge plugin name");

  const dir = path.join(locations.hooksDir, pluginName);
  await assertPathInside(locations.hooksDir, dir, "hooks bridge unstage target");
  await rm(dir, { recursive: true, force: true });

  return { removed: pluginName };
}

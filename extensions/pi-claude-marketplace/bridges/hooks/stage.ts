// bridges/hooks/stage.ts
//
// Hooks bridge write/remove primitives (LIFE-03 / D-63-02).
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

import { lstat, readdir, readlink, realpath, rm } from "node:fs/promises";
import path from "node:path";

import { assertSafeName } from "../../domain/name.ts";
import { atomicWriteJson } from "../../shared/atomic-json.ts";
import {
  PathContainmentError,
  SymlinkRefusedError,
  assertPathInside,
} from "../../shared/path-safety.ts";

import type { ScopedLocations } from "../../persistence/locations.ts";
import type { Dirent } from "node:fs";

/**
 * Single source of truth for the hooks bridge write path. Consumed by
 * `writeHookConfig` and (later) by any hydrate-side reader so the same
 * composition is never duplicated.
 */
export function hookConfigPathFor(locations: ScopedLocations, plugin: string): string {
  return path.join(locations.hooksDir, plugin, "hooks.json");
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
async function assertNoSymlinkEscapeInHooksSubtree(pluginRoot: string): Promise<void> {
  const hooksRoot = path.join(pluginRoot, "hooks");
  const stack: string[] = [hooksRoot];

  while (stack.length > 0) {
    const dir = stack.pop();
    if (dir === undefined) {
      // Unreachable -- the while-condition guards stack.length > 0 -- but
      // the explicit narrowing satisfies @typescript-eslint without a
      // non-null assertion.
      break;
    }

    const entries = await readEntriesOrSkip(dir);
    if (entries === null) {
      continue;
    }

    for (const entry of entries) {
      const linkPath = path.join(dir, entry.name);
      // `lstat` (NOT `stat`) so we never follow a symlink target. This is
      // the core of the containment guarantee: we MUST be able to detect
      // "this entry is a symlink" without issuing any FS call against the
      // target it points to.
      const stat = await lstat(linkPath);

      if (stat.isSymbolicLink()) {
        await assertSymlinkEntryContained(pluginRoot, linkPath);
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
async function readEntriesOrSkip(dir: string): Promise<Dirent[] | null> {
  try {
    return await readdir(dir, { withFileTypes: true });
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
async function assertSymlinkEntryContained(pluginRoot: string, linkPath: string): Promise<void> {
  const resolved = await realpath(linkPath);
  try {
    await assertPathInside(pluginRoot, resolved, `hooks subtree symlink ${linkPath}`);
  } catch (err) {
    if (err instanceof SymlinkRefusedError) {
      throw err;
    }

    if (err instanceof PathContainmentError) {
      const linkTarget = await readSymlinkTargetSafe(linkPath);
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

async function readSymlinkTargetSafe(linkPath: string): Promise<string> {
  try {
    return await readlink(linkPath);
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
export async function writeHookConfig(input: WriteHookConfigInput): Promise<WriteHookConfigResult> {
  const { locations, pluginName, pluginRoot, hooksValue } = input;

  assertSafeName(pluginName, "hooks bridge plugin name");
  await assertNoSymlinkEscapeInHooksSubtree(pluginRoot);

  const target = hookConfigPathFor(locations, pluginName);
  await assertPathInside(locations.hooksDir, target, "hooks bridge write target");
  await atomicWriteJson(target, hooksValue);

  return { written: true, path: target };
}

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

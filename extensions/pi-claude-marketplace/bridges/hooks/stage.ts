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

import { readdir, realpath, rm } from "node:fs/promises";
import path from "node:path";

import { assertSafeName } from "../../domain/name.ts";
import { atomicWriteJson } from "../../shared/atomic-json.ts";
import { assertPathInside } from "../../shared/path-safety.ts";

import type { ScopedLocations } from "../../persistence/locations.ts";

/**
 * Single source of truth for the hooks bridge write path. Consumed by
 * `writeHookConfig` and (later) by any hydrate-side reader so the same
 * composition is never duplicated.
 */
export function hookConfigPathFor(locations: ScopedLocations, plugin: string): string {
  return path.join(locations.hooksDir, plugin, "hooks.json");
}

/**
 * LIFE-03 read-side defense: walk `<pluginRoot>/hooks/` recursively and
 * refuse the first symlink whose `realpath` escapes `pluginRoot`. The
 * subtree walk catches a symlink BURIED inside the hooks tree -- the
 * existing `assertPathInside` chokepoint only walks from `parent` to
 * `child`, so a leaf-level rogue link would slip past write-side
 * containment.
 *
 * ENOENT on the hooks subtree is a clean return (a plugin with no
 * hooks/ dir has nothing to check). Any other I/O error propagates.
 */
async function assertNoSymlinkEscapeInHooksSubtree(pluginRoot: string): Promise<void> {
  const hooksRoot = path.join(pluginRoot, "hooks");
  let entries;
  try {
    entries = await readdir(hooksRoot, { recursive: true, withFileTypes: true });
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "ENOTDIR") {
      return;
    }

    throw err;
  }

  for (const entry of entries) {
    if (!entry.isSymbolicLink()) {
      continue;
    }

    const linkPath = path.join(entry.parentPath, entry.name);
    const resolved = await realpath(linkPath);
    // Throws SymlinkRefusedError (subclass of PathContainmentError) if the
    // resolved target escapes pluginRoot. Inherits PI-14 handling.
    await assertPathInside(pluginRoot, resolved, `hooks subtree symlink ${linkPath}`);
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

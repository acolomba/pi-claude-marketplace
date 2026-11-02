// bridges/commands/unstage.ts
//
// CommandsBridge: remove previously-staged command files by name.
// ENOENT-tolerant per-name unlink (idempotent on repeated calls).
//
// Commands have no on-disk index and need no marker check -- the
// promptsTargetDir is owned end-to-end by name per D-06.

import { unlink } from "node:fs/promises";
import path from "node:path";

import { assertPathInside } from "../../shared/path-safety.ts";

import type { UnstageCommandsInput, UnstageCommandsResult } from "./types.ts";

/**
 * Removes one staged command file and reports whether it was there. ENOENT
 * means the file is already gone (a prior failed install never finished its
 * commit, or a repeated call), so the unlink is idempotent; any other error
 * propagates.
 */
async function unlinkIfPresent(target: string): Promise<boolean> {
  try {
    await unlink(target);
    return true;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }

    throw err;
  }
}

export async function unstagePluginCommands(
  input: UnstageCommandsInput,
): Promise<UnstageCommandsResult> {
  const removed: string[] = [];

  for (const name of input.previousCommandNames) {
    const target = path.join(input.locations.promptsTargetDir, name + ".md");
    // eslint-disable-next-line no-await-in-loop -- the first containment or unlink failure stops later unlinks
    await assertPathInside(input.locations.promptsTargetDir, target, "command to unstage");

    // eslint-disable-next-line no-await-in-loop -- the first containment or unlink failure stops later unlinks
    if (await unlinkIfPresent(target)) {
      removed.push(name);
    }
  }

  return {
    removedNames: Object.freeze(removed),
    warnings: Object.freeze<string[]>([]),
  };
}

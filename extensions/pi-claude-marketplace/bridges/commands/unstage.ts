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

export async function unstagePluginCommands(
  input: UnstageCommandsInput,
): Promise<UnstageCommandsResult> {
  const removed: string[] = [];

  for (const name of input.previousCommandNames) {
    const target = path.join(input.locations.promptsTargetDir, name + ".md");
    await assertPathInside(input.locations.promptsTargetDir, target, "command to unstage");

    try {
      await unlink(target);
      removed.push(name);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
        throw err;
      }
      // ENOENT: the previously-staged file is already gone (e.g. a prior
      // failed install never finished commit). Idempotent -- skip without
      // adding to `removed`.
    }
  }

  return {
    removedNames: Object.freeze(removed),
    warnings: Object.freeze<string[]>([]),
  };
}

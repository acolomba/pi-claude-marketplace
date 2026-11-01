// bridges/commands/unstage.ts
//
// CommandsBridge: remove previously-staged command files by name.
// ENOENT-tolerant per-name unlink (idempotent on repeated calls).
//
// Commands have no on-disk index and need no marker check -- the
// promptsTargetDir is owned end-to-end by name per D-06.
//
// D-CF3-07: at project scope the removed names then leave the user's project
// ledger. A stale entry only names a file this user once installed, so a
// ledger the removal cannot update becomes a warning (WR-04) and never blocks
// the removal.

import { unlink } from "node:fs/promises";
import path from "node:path";

import { errorMessage } from "../../shared/errors.ts";
import { assertPathInside } from "../../shared/path-safety.ts";

import { projectCommandChange } from "./project-ledger.ts";

import type { UnstageCommandsInput, UnstageCommandsResult } from "./types.ts";

/**
 * WR-04: the warnings of dropping the unstaged names from the user's project
 * ledger. A user-scope unstage and one with no names leave the ledger alone.
 */
async function forgetUnstagedCommands(input: UnstageCommandsInput): Promise<readonly string[]> {
  const change = projectCommandChange(input.locations, input.previousCommandNames);
  if (change === undefined || change.forget.length === 0) {
    return [];
  }

  return input.ledger.update(change).then(
    () => [],
    (err: unknown) => [
      `could not remove the commands from the project skill ledger: ${errorMessage(err)}`,
    ],
  );
}

export async function unstagePluginCommands(
  input: UnstageCommandsInput,
): Promise<UnstageCommandsResult> {
  const removed: string[] = [];

  for (const name of input.previousCommandNames) {
    const target = path.join(input.locations.promptsTargetDir, name + ".md");
    // eslint-disable-next-line no-await-in-loop -- the first containment or unlink failure stops later unlinks
    await assertPathInside(input.locations.promptsTargetDir, target, "command to unstage");

    try {
      // eslint-disable-next-line no-await-in-loop -- the first containment or unlink failure stops later unlinks
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
    warnings: Object.freeze([...(await forgetUnstagedCommands(input))]),
  };
}

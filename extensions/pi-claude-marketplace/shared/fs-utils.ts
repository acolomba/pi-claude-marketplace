// shared/fs-utils.ts
//
// Filesystem helpers used by Phase 3 bridges. Two helpers:
//
//   - cleanupStaging: best-effort recursive rm of a staging tree, returning
//     a leak-message string on failure rather than throwing. Lets callers
//     surface partial-rollback state via appendLeakToError without nesting
//     try/catch in every prepare path.
//   - pathExists: lstat-based existence predicate. Does NOT follow
//     symlinks (consistent with PS-1 "refuse all symlinks").
//
// T-03-03 mitigation: cleanupStaging swallows ENOENT and never throws, so
// callers cannot enter a cleanup retry loop. Bounded by single
// rm({recursive:true,force:true}) call.

import { lstat, rm } from "node:fs/promises";

import { errorMessage } from "./errors.ts";

/**
 * Best-effort recursive removal of a staging directory. Swallows ENOENT
 * (the dir was never created) and returns a descriptive leak message
 * for any other failure so the caller can surface it via
 * appendLeakToError without throwing from the cleanup itself.
 *
 * @param dir   Absolute path of the staging directory to remove.
 * @param label Human-readable label used in the leak message
 *              (e.g. "skill-staging", "command-staging").
 * @returns `undefined` on success or ENOENT, a leak message string otherwise.
 */
export async function cleanupStaging(dir: string, label: string): Promise<string | undefined> {
  try {
    await rm(dir, { recursive: true, force: true });
    return undefined;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return undefined;
    }

    return `failed to clean up ${label} at ${dir}: ${errorMessage(err)}`;
  }
}

/**
 * lstat-based existence predicate. ENOENT/ENOTDIR -> false; any other
 * error propagates. Does NOT follow symlinks (consistent with PS-1).
 *
 * Phase 3 Plan 03-03 (skills discover.ts) imports this rather than
 * inlining lstat so the symlink-non-following semantics live in one place.
 */
export async function pathExists(p: string): Promise<boolean> {
  try {
    await lstat(p);
    return true;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "ENOTDIR") {
      return false;
    }

    throw err;
  }
}

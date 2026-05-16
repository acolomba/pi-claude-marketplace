// shared/fs-utils.ts
//
// Filesystem helpers used by Phase 3 bridges. Three helpers:
//
//   - cleanupStaging: best-effort recursive rm of a staging tree, returning
//     a leak-message string on failure rather than throwing. Lets callers
//     surface partial-rollback state via appendLeakToError without nesting
//     try/catch in every prepare path.
//   - pathExists: lstat-based existence predicate. Does NOT follow
//     symlinks (consistent with PS-1 "refuse all symlinks").
//   - rollbackReplacementCommon: shared body for the bridge replacement
//     rollback functions (skills/commands/agents). Removes the new files in
//     reverse order, restores backups in reverse order, and cleans up the
//     staging + backup directories, accumulating leak messages instead of
//     throwing.
//
// T-03-03 mitigation: cleanupStaging swallows ENOENT and never throws, so
// callers cannot enter a cleanup retry loop. Bounded by single
// rm({recursive:true,force:true}) call.

import { lstat, mkdir, rename, rm } from "node:fs/promises";
import path from "node:path";

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

/**
 * Labels threaded into the leak-message strings produced by
 * `rollbackReplacementCommon`. Kept on the input so each bridge's
 * vocabulary ("skill dir" / "command file" / "agent file" / "X staging
 * directory" / "X replacement backup directory") stays out of the
 * shared helper.
 */
export interface RollbackReplacementLabels {
  /** Human label for one replacement entry, e.g. "replacement skill dir". */
  readonly replacement: string;
  /** Human label for one restored backup entry, e.g. "previous skill dir". */
  readonly previous: string;
  /** Human label for the staging directory, e.g. "skills staging directory". */
  readonly stagingDir: string;
  /** Human label for the backup directory, e.g. "skills replacement backup directory". */
  readonly backupDir: string;
}

export interface RollbackReplacementInput {
  /** New files/dirs that were renamed into place. Removed in reverse. */
  readonly renamed: readonly { readonly from: string; readonly to: string }[];
  /** Pre-replacement files/dirs moved aside. Restored in reverse. */
  readonly backups: readonly {
    readonly name: string;
    readonly from: string;
    readonly to: string;
  }[];
  /** Staging directory cleanup root (sibling of backupRoot). */
  readonly stagingRoot: string;
  /** Backup directory cleanup root. */
  readonly backupRoot: string;
  /**
   * `"tree"` removes each `renamed.to` with `{ recursive: true, force: true }`
   * (skills bridge -- every entry is a directory); `"file"` uses `{ force: true }`
   * (commands + agents bridges -- every entry is a single file).
   */
  readonly removeMode: "file" | "tree";
  readonly labels: RollbackReplacementLabels;
  /**
   * Optional bridge-specific step that runs after backups are restored and
   * before the staging/backup directories are cleaned up. Used by the
   * agents bridge to restore `agents-index.json`. The callback returns the
   * leak messages it produced (zero or more); throwing is not expected
   * because callers should already catch + record their own leaks.
   */
  readonly beforeCleanup?: () => Promise<readonly string[]>;
}

/**
 * Shared body for the rollback functions of the bridge replacement
 * lifecycle (skills/commands/agents). Each bridge wraps this and
 * supplies its own `removeMode` + `labels`; the algorithm is the same:
 *
 *  1. Remove every renamed replacement (reverse order). Failures become
 *     leaks; the loop never throws.
 *  2. Restore every backup (reverse order). Re-creates the destination
 *     parent before renaming back, in case the post-replacement state
 *     pruned the directory. Failures become leaks.
 *  3. Best-effort `cleanupStaging` on the staging + backup directories.
 *
 * The returned readonly array is frozen so callers can splice it into
 * `appendLeakToError` chains without defensive copies.
 */
export async function rollbackReplacementCommon(
  input: RollbackReplacementInput,
): Promise<readonly string[]> {
  const leaks: string[] = [];
  const rmOptions =
    input.removeMode === "tree" ? { recursive: true, force: true } : { force: true };

  for (const pair of [...input.renamed].reverse()) {
    try {
      await rm(pair.to, rmOptions);
    } catch (err) {
      leaks.push(
        `failed to remove ${input.labels.replacement} at ${pair.to}: ${errorMessage(err)}`,
      );
    }
  }

  for (const backup of [...input.backups].reverse()) {
    try {
      await mkdir(path.dirname(backup.from), { recursive: true });
      await rename(backup.to, backup.from);
    } catch (err) {
      leaks.push(
        `failed to restore ${input.labels.previous} ${backup.name} from ${backup.to} to ${backup.from}: ${errorMessage(err)}`,
      );
    }
  }

  if (input.beforeCleanup !== undefined) {
    leaks.push(...(await input.beforeCleanup()));
  }

  for (const leak of [
    await cleanupStaging(input.stagingRoot, input.labels.stagingDir),
    await cleanupStaging(input.backupRoot, input.labels.backupDir),
  ]) {
    if (leak !== undefined) {
      leaks.push(leak);
    }
  }

  return Object.freeze(leaks);
}

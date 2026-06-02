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

import { lstat, mkdir, rename, rm, stat } from "node:fs/promises";
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
 * TR-06: Pre-remove an orphan target before a planned rename. Kind-strict --
 * mode `"tree"` only removes the target when it is a directory; mode `"file"`
 * only removes it when it is a regular file. A kind mismatch (e.g. mode
 * `"tree"` on a file, or mode `"file"` on a directory) leaves the target
 * alone -- the caller's subsequent `rename` will surface `ENOTDIR` /
 * `ENOTEMPTY` with full context. ENOENT on the initial `stat` is silently
 * swallowed (target already absent -- no-op).
 *
 * Caller-owns-containment (NFR-10): the CALLER must have already
 * `assertPathInside`-d `target` before invoking this helper. This helper
 * performs raw `rm` on the supplied path -- calling it on an uncontained
 * path is an NFR-10 violation. The three `replacePrepared*` call sites in
 * `bridges/{skills,commands,agents}/stage.ts` already pass each rename pair
 * through `assertPathInside` during the prepare phase; the helper is invoked
 * on the same pre-validated path.
 *
 * Caller-owns-ownership (PI-6 guard): this helper does NOT verify that the
 * target is owned by the current install. It removes the target
 * unconditionally when the kind matches. The caller is responsible for
 * checking that `basename(target)` represents a name this install owns
 * (i.e. basename ∈ `_previousNames` for skills/commands, or
 * basename ∈ `_previousEntries.map(e => e.generatedName)` for agents).
 * Skipping the ownership pre-check would silently enable cross-plugin
 * overwrite -- exactly the PI-6 vector the existing
 * `Cannot replace ... with non-previous content` rejection prevents.
 *
 * ENOENT discipline: a missing target on the initial `stat` is a no-op (the
 * caller's rename will create the target fresh). Any other error code is
 * re-thrown verbatim so the caller can surface the IO failure with full
 * context.
 */
export async function removeOrphanIfPresent(target: string, mode: "file" | "tree"): Promise<void> {
  try {
    const s = await stat(target);
    if (mode === "tree" && s.isDirectory()) {
      await rm(target, { recursive: true, force: true });
    } else if (mode === "file" && s.isFile()) {
      await rm(target);
    }
    // Mismatched kind: leave alone. Subsequent rename will surface
    // ENOTDIR/ENOTEMPTY -- preserves PUP-6 phase-3 failure trigger.
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") {
      throw e;
    }
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

// orchestrators/marketplace/clone-swap.ts
//
// D-SG-10: Claude Code's refresh of a cloned checkout. A freshness check
// compares the checkout's `HEAD` with what the remote advertises; a stale
// checkout is cloned again into `sources-staging/<uuid>` and swapped in through
// a backup directory, so the live checkout is never half updated (NFR-1). A
// moved default branch or a moved tag is followed because the clone reads the
// remote again, and nothing here reads `refs/remotes/origin/HEAD`.
//
// This module is not a ledger: `update.ts` and `add.ts` import it, and it
// imports no ledger. Every directory it renames or removes comes from a
// `ScopedLocations` getter (NFR-10), and both renames stay under the extension
// root, on one filesystem.

import { randomUUID } from "node:crypto";
import { mkdir, rename } from "node:fs/promises";
import path from "node:path";

import { atomicWriteJson } from "../../shared/atomic-json.ts";
import { hookDebugLog } from "../../shared/debug-log.ts";
import { appendLeakToError, errorMessage, isErrnoException } from "../../shared/errors.ts";
import { cleanupStaging, pathExists, type RemovalOps } from "../../shared/fs-utils.ts";
import { assertPathInside } from "../../shared/path-safety.ts";

import type { ScopedLocations } from "../../persistence/locations.ts";
import type { GitAuthBundle, GitOps } from "./shared.ts";

/**
 * Q-01: the ownership marker `marketplace add` and a refresh write into `.git/`
 * of every clone they create, before the rename into `sources/<name>`. The
 * name and the `.git/` location are a user contract: renaming either orphans
 * every leftover created before the rename, which then refuses as
 * `{stale clone}`.
 */
const OWNERSHIP_MARKER_FILE = "pi-claude-marketplace.json";

/** The path of the ownership marker inside the clone at `cloneDir`. */
export function ownershipMarkerPath(cloneDir: string): string {
  return path.join(cloneDir, ".git", OWNERSHIP_MARKER_FILE);
}

/**
 * Q-01 / NFR-1 / NFR-10: write the ownership marker into the staging clone.
 * `assertPathInside` refuses a `.git` that is a symlink, so the write stays
 * inside `stagingDir`.
 */
export async function writeOwnershipMarker(stagingDir: string): Promise<void> {
  const markerPath = ownershipMarkerPath(stagingDir);
  await assertPathInside(stagingDir, markerPath, "marketplace ownership marker");
  await atomicWriteJson(markerPath, { generatedBy: "pi-claude-marketplace" });
}

/** The rename the swap moves whole checkouts with; tests inject a failing one. */
export interface RenameOps {
  rename(from: string, to: string): Promise<void>;
}

/** The real rename: a thin binding to `fs.rename`. */
export const DEFAULT_RENAME_OPS: RenameOps = {
  rename: (from, to) => rename(from, to),
};

/**
 * D-SG-10: what a refresh did. `current`: the checkout already holds the
 * remote's commit, and nothing was written. `replaced`: a new clone took the
 * live checkout's place. `kept-in-use`: the live checkout could not be moved
 * aside (`EBUSY`, `EPERM`, or `EACCES`), so it was kept and the next refresh
 * tries again; `cause` is the rename's error.
 */
export type CloneSwapResult =
  | { readonly kind: "current" }
  | { readonly kind: "replaced" }
  | { readonly kind: "kept-in-use"; readonly cause: Error };

export interface CloneSwapArgs {
  readonly locations: ScopedLocations;
  /** The live checkout, from a `ScopedLocations` getter. */
  readonly liveDir: string;
  /** Where the live checkout waits while the new clone moves in, from a getter. */
  readonly backupDir: string;
  readonly url: string;
  readonly ref?: string;
  readonly gitOps: GitOps;
  readonly auth: GitAuthBundle;
  /** Runs once the new clone is the live checkout (MU-5). */
  readonly onReplaced?: () => void;
  readonly removalOps: RemovalOps;
  readonly renameOps: RenameOps;
}

/** A full commit id, 40 hex digits for SHA-1 or 64 for SHA-256, any case. */
const FULL_SHA_RE = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i;

/** The errno codes of a rename that another process blocks; Windows reports an open handle as the first two. */
const IN_USE_CODES: ReadonlySet<string> = new Set(["EBUSY", "EPERM", "EACCES"]);

/** D-SG-10: the commit `HEAD` names in the live checkout, or undefined when it cannot be read. */
async function readLocalHead(args: CloneSwapArgs): Promise<string | undefined> {
  if (!(await pathExists(args.liveDir))) {
    return undefined;
  }

  try {
    return await args.gitOps.resolveRef({ dir: args.liveDir, ref: "HEAD" });
  } catch (err) {
    hookDebugLog(`checkout HEAD of ${args.liveDir} unreadable: ${errorMessage(err)}`, "git");
    return undefined;
  }
}

/**
 * D-SG-10: whether the checkout is current. A full-SHA ref compares with
 * `HEAD` and asks the remote nothing. Otherwise `ls-remote` gives the commit of
 * `HEAD`, or of the ref as a branch, then a peeled tag, then a tag; a ref the
 * remote does not advertise, or an unreadable `HEAD`, is stale.
 */
async function isCurrent(args: CloneSwapArgs): Promise<boolean> {
  const local = await readLocalHead(args);
  if (local === undefined) {
    return false;
  }

  const { ref } = args;
  if (ref !== undefined && FULL_SHA_RE.test(ref)) {
    return local === ref.toLowerCase();
  }

  const remote = await args.gitOps.resolveRemoteRef({
    url: args.url,
    ...(ref !== undefined && { ref }),
    auth: args.auth,
  });
  return remote === local;
}

/**
 * D-SG-10 / MA-12: clone into a staging directory of this run and mark it as
 * this extension's own. A failed clone removes the staging directory and
 * leaves the live checkout untouched (MA-9: a leak is appended, not masked).
 */
async function cloneIntoStaging(args: CloneSwapArgs): Promise<string> {
  const stagingDir = await args.locations.sourcesStagingDir(randomUUID());
  try {
    await args.gitOps.clone({
      dir: stagingDir,
      url: args.url,
      ...(args.ref !== undefined && { ref: args.ref, singleBranch: true }),
      auth: args.auth,
    });
    await writeOwnershipMarker(stagingDir);
    return stagingDir;
  } catch (err) {
    const leak = await cleanupStaging(args.removalOps, stagingDir, "marketplace clone staging");
    if (leak !== undefined) {
      throw appendLeakToError(err, leak);
    }

    throw err;
  }
}

/**
 * D-SG-10: move the live checkout aside. Returns the error of a rename that
 * another process blocks, after the staging clone is removed; any other
 * failure removes the staging clone and is thrown.
 */
async function moveLiveAside(args: CloneSwapArgs, stagingDir: string): Promise<Error | undefined> {
  try {
    await mkdir(path.dirname(args.backupDir), { recursive: true });
    await args.renameOps.rename(args.liveDir, args.backupDir);
    return undefined;
  } catch (err) {
    const leak = await cleanupStaging(args.removalOps, stagingDir, "marketplace clone staging");
    const failure = appendLeakToError(err, leak);
    if (isErrnoException(err) && IN_USE_CODES.has(err.code)) {
      return failure;
    }

    throw failure;
  }
}

/**
 * D-SG-10: move the staging clone into the live checkout's place. A failure
 * renames the backup back, so the old checkout stays live, and is thrown.
 */
async function moveStagingIn(
  args: CloneSwapArgs,
  stagingDir: string,
  movedAside: boolean,
): Promise<void> {
  try {
    await mkdir(path.dirname(args.liveDir), { recursive: true });
    await args.renameOps.rename(stagingDir, args.liveDir);
  } catch (err) {
    const restoreLeak = movedAside ? await restoreBackup(args) : undefined;
    const stagingLeak = await cleanupStaging(
      args.removalOps,
      stagingDir,
      "marketplace clone staging",
    );
    const leaks = [restoreLeak, stagingLeak].filter((leak) => leak !== undefined);
    throw appendLeakToError(err, leaks.length === 0 ? undefined : leaks.join("; "));
  }
}

/** Renames the backup back to the live checkout; a failure is returned as a leak (MA-9). */
async function restoreBackup(args: CloneSwapArgs): Promise<string | undefined> {
  try {
    await args.renameOps.rename(args.backupDir, args.liveDir);
    return undefined;
  } catch (err) {
    return `failed to restore marketplace checkout ${args.backupDir} to ${args.liveDir}: ${errorMessage(err)}`;
  }
}

/**
 * D-SG-10: swap the staging clone in through the backup directory, then
 * delete the backup. A backup that cannot be deleted is left for the next
 * refresh, which removes a backup beside a valid checkout.
 */
async function swapIn(args: CloneSwapArgs, stagingDir: string): Promise<CloneSwapResult> {
  const hadLive = await pathExists(args.liveDir);
  if (hadLive) {
    const inUse = await moveLiveAside(args, stagingDir);
    if (inUse !== undefined) {
      return { kind: "kept-in-use", cause: inUse };
    }
  }

  await moveStagingIn(args, stagingDir, hadLive);
  args.onReplaced?.();
  const leak = await cleanupStaging(args.removalOps, args.backupDir, "marketplace checkout backup");
  if (leak !== undefined) {
    hookDebugLog(leak, "git");
  }

  return { kind: "replaced" };
}

/**
 * D-SG-10: refresh the checkout at `liveDir` from `url`. A current checkout is
 * left alone. A stale one is cloned again into staging and swapped in; a
 * failed clone leaves the live checkout untouched, and a failed move-in puts
 * the old checkout back. The caller holds the scope's state lock around the
 * whole refresh (Q13).
 */
export async function refreshCloneBySwap(args: CloneSwapArgs): Promise<CloneSwapResult> {
  if (await isCurrent(args)) {
    return { kind: "current" };
  }

  const stagingDir = await cloneIntoStaging(args);
  return swapIn(args, stagingDir);
}

// orchestrators/marketplace/clone-swap.ts
//
// D-SG-10: Claude Code's refresh of a cloned checkout. A freshness check
// compares the checkout's `HEAD` with what the remote advertises; a stale
// checkout is cloned again into a staging directory of fixed name under
// `sources-staging/` and swapped in through a backup directory, so the live
// checkout is never half updated (NFR-1). A
// moved default branch or a moved tag is followed because the clone reads the
// remote again, and nothing here reads `refs/remotes/origin/HEAD`.
//
// D-SG-15: with `CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE` true, a
// checkout whose remote cannot be reached is kept as it is.
//
// The same swap refreshes a marketplace checkout and a plugin mirror. A
// marketplace swap writes the MA-12 ownership marker into staging; a mirror
// swap writes none and never keeps a checkout on failure.
//
// This module is not a ledger: `update.ts`, `add.ts`, `plugin/clone-cache.ts`,
// and `plugin/update-flow.ts` import it, and it imports no ledger. Every directory it renames or removes comes from a
// `ScopedLocations` getter (NFR-10), and both renames stay under the extension
// root, on one filesystem.

import { mkdir, rename } from "node:fs/promises";
import path from "node:path";

import { networkCloneUrl } from "../../domain/clone-key.ts";
import { atomicWriteJson } from "../../shared/atomic-json.ts";
import { hookDebugLog } from "../../shared/debug-log.ts";
import {
  appendLeakToError,
  errorMessage,
  GitCommandError,
  isErrnoException,
  StoredCredentialRejectedError,
} from "../../shared/errors.ts";
import { cleanupStaging, pathExists, type RemovalOps } from "../../shared/fs-utils.ts";
import { assertPathInside } from "../../shared/path-safety.ts";
import { upstreamFlagIsTrue } from "../../shared/upstream-flag.ts";

import type { GitHubSource, UrlSource } from "../../domain/source.ts";
import type { ExtensionState } from "../../persistence/state-io.ts";
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

/** D-SG-10: the file whose presence makes a marketplace checkout valid. */
export const MARKETPLACE_MANIFEST_MARKER = path.join(".claude-plugin", "marketplace.json");

/**
 * D-SG-10: the URL a refresh of a marketplace checkout clones from: the live
 * checkout's recorded `origin`, which is the URL the checkout was cloned from,
 * or the source's clone URL when the checkout records none. An earlier
 * version recorded some url sources under a URL that is not their clone URL.
 * `marketplace update` and `plugin update`'s marketplace sync (PUP-2) share it.
 */
export async function swapCloneUrl(
  liveDir: string,
  source: GitHubSource | UrlSource,
  gitOps: GitOps,
): Promise<string> {
  const remotes = await gitOps.listRemotes({ dir: liveDir });
  return remotes.kind === "origin" ? remotes.url : networkCloneUrl(source);
}

/** The rename the swap moves whole checkouts with; tests inject a failing one. */
export interface RenameOps {
  rename(from: string, to: string): Promise<void>;
}

/** The real rename: a thin binding to `fs.rename`. */
export const DEFAULT_RENAME_OPS: RenameOps = {
  rename: (from, to) => rename(from, to),
};

/** D-SG-15: the variable that keeps a checkout whose remote cannot be reached. */
export const KEEP_MARKETPLACE_ON_FAILURE_VARIABLE =
  "CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE";

/**
 * D-SG-15: whether `CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE` is true,
 * as Claude Code reads it: `1`, `true`, `yes`, or `on`, trimmed, in any case.
 */
export function keepMarketplaceOnFailure(env: NodeJS.ProcessEnv = process.env): boolean {
  return upstreamFlagIsTrue(KEEP_MARKETPLACE_ON_FAILURE_VARIABLE, env);
}

/**
 * D-SG-10: what a refresh did. `current`: the checkout already holds the
 * remote's commit, and nothing was written. `replaced`: a new clone took the
 * live checkout's place. `kept-stale`: the remote could not be reached and
 * D-SG-15 kept the checkout; `cause` is the `ls-remote` failure.
 * `kept-in-use`: the live checkout could not be moved aside (`EBUSY`,
 * `EPERM`, or `EACCES`), so it was kept and the next refresh tries again;
 * `cause` is the rename's error.
 */
export type CloneSwapResult =
  | { readonly kind: "current" }
  | { readonly kind: "replaced" }
  | { readonly kind: "kept-stale"; readonly cause: unknown }
  | { readonly kind: "kept-in-use"; readonly cause: Error };

export interface CloneSwapArgs {
  /** The live checkout, from a `ScopedLocations` getter. */
  readonly liveDir: string;
  /** Where the live checkout waits while the new clone moves in, from a getter. */
  readonly backupDir: string;
  /**
   * NFR-3: the fixed staging directory the new clone is made in, from a
   * getter. The caller holds the scope lock, so whatever it holds when the
   * refresh starts is the leftover of an interrupted run.
   */
  readonly stagingDir: string;
  readonly url: string;
  readonly ref?: string;
  readonly gitOps: GitOps;
  readonly auth: GitAuthBundle;
  /**
   * The file, relative to the checkout, whose presence makes a checkout valid:
   * `.claude-plugin/marketplace.json` for a marketplace, `.git/HEAD` for a
   * mirror.
   */
  readonly liveMarker: string;
  /** D-SG-15: keep a valid checkout whose remote cannot be reached. */
  readonly keepOnUnreachable: boolean;
  /**
   * MA-12: write the marketplace ownership marker into the staging clone
   * before the swap. A marketplace checkout carries it; a plugin mirror does
   * not, because no `marketplace add` guard reads a mirror.
   */
  readonly ownershipMarker: boolean;
  /**
   * D-PL9-10: the roots, relative to the checkout, of the installed plugins
   * that run inside it. Their `node_modules` move from the old checkout into
   * the new one, so a refresh never strips an installed plugin of its packages.
   */
  readonly carryOver: readonly string[];
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
 * D-SG-10: the freshness of the checkout. `unreachable` carries the
 * `ls-remote` failure.
 */
type Freshness =
  | { readonly kind: "current" }
  | { readonly kind: "stale" }
  | { readonly kind: "unreachable"; readonly cause: unknown };

const CURRENT: Freshness = { kind: "current" };
const STALE: Freshness = { kind: "stale" };

/**
 * D-SG-15: the git failures that say nothing about the remote, so a refresh
 * stops on them rather than keeping or cloning: git is missing, Pi refused the
 * input, or the command was aborted.
 */
const NOT_REMOTE_FAILURES: ReadonlySet<GitCommandError["kind"]> = new Set([
  "git-missing",
  "refused-input",
  "aborted",
]);

/**
 * D-SG-15: whether a failed `ls-remote` means the remote could not be reached:
 * a git failure other than `NOT_REMOTE_FAILURES`, or a stored credential the
 * host refused. Any other error, such as an invalid GitHub base or a Device
 * Flow that Pi cannot show, says nothing about the remote and is thrown.
 */
function isUnreachable(err: unknown): boolean {
  if (err instanceof StoredCredentialRejectedError) {
    return true;
  }

  return err instanceof GitCommandError && !NOT_REMOTE_FAILURES.has(err.kind);
}

/**
 * D-SG-10: the freshness of the checkout. A full-SHA ref compares with `HEAD`
 * and asks the remote nothing. Otherwise `ls-remote` gives the commit of
 * `HEAD`, or of the ref as a branch, then a peeled tag, then a tag; a ref the
 * remote does not advertise, or an unreadable `HEAD`, is stale, and a failed
 * `ls-remote` is unreachable.
 */
async function checkFreshness(args: CloneSwapArgs): Promise<Freshness> {
  const local = await readLocalHead(args);
  if (local === undefined) {
    return STALE;
  }

  const { ref } = args;
  if (ref !== undefined && FULL_SHA_RE.test(ref)) {
    return local === ref.toLowerCase() ? CURRENT : STALE;
  }

  let remote: string | undefined;
  try {
    remote = await args.gitOps.resolveRemoteRef({
      url: args.url,
      ...(ref !== undefined && { ref }),
      auth: args.auth,
    });
  } catch (err) {
    if (!isUnreachable(err)) {
      throw err;
    }

    return { kind: "unreachable", cause: err };
  }

  return remote === local ? CURRENT : STALE;
}

/**
 * D-SG-10 / NFR-3: put back what an interrupted swap left, in Claude Code's
 * order. A backup beside a valid checkout is removed. A backup beside a
 * checkout that lacks its marker, or beside no checkout, is renamed back,
 * after the invalid checkout is removed. Then a staging directory that an
 * interrupted clone left is removed.
 */
async function recoverInterruptedSwap(args: CloneSwapArgs): Promise<void> {
  await restoreInterruptedBackup(args);
  if (await pathExists(args.stagingDir)) {
    await args.removalOps.rm(args.stagingDir, { recursive: true, force: true });
  }
}

/** D-SG-10: the backup half of `recoverInterruptedSwap`. */
async function restoreInterruptedBackup(args: CloneSwapArgs): Promise<void> {
  const { liveDir, backupDir, removalOps } = args;
  if (!(await pathExists(backupDir))) {
    return;
  }

  if (await pathExists(liveDir)) {
    if (await pathExists(path.join(liveDir, args.liveMarker))) {
      await removalOps.rm(backupDir, { recursive: true, force: true });
      return;
    }

    await removalOps.rm(liveDir, { recursive: true, force: true });
  }

  await mkdir(path.dirname(liveDir), { recursive: true });
  await args.renameOps.rename(backupDir, liveDir);
}

/**
 * D-SG-10 / MA-12: clone into the staging directory and mark it as
 * this extension's own. A failed clone removes the staging directory and
 * leaves the live checkout untouched (MA-9: a leak is appended, not masked).
 * After an unreachable check the clone fails the same way, so the check's
 * failure is the one thrown: it names the cause before git's own credential
 * helpers acted on it, as a stored credential the host rejected (GAUTH-04).
 */
async function cloneIntoStaging(args: CloneSwapArgs, freshness: Freshness): Promise<string> {
  const { stagingDir } = args;
  try {
    await args.gitOps.clone({
      dir: stagingDir,
      url: args.url,
      ...(args.ref !== undefined && { ref: args.ref, singleBranch: true }),
      auth: args.auth,
    });
    if (args.ownershipMarker) {
      await writeOwnershipMarker(stagingDir);
    }

    return stagingDir;
  } catch (err) {
    const failure = freshness.kind === "unreachable" ? freshness.cause : err;
    const leak = await cleanupStaging(args.removalOps, stagingDir, "marketplace clone staging");
    if (leak !== undefined) {
      throw appendLeakToError(failure, leak);
    }

    throw failure;
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

/** D-PL9-10: the folder a plugin's package manager installs into. */
const PACKAGES_DIR = "node_modules";

/**
 * D-PL9-10 / NFR-10: move the `node_modules` of the plugin root `pluginRoot`
 * from the backup into the new checkout, when the backup holds one, the new
 * checkout has that root, and the root has no `node_modules` of its own. Both
 * paths must lie inside their checkout. A move that fails is debug-logged and
 * never fails the refresh: the next package install of the plugin puts the
 * packages back.
 */
async function carryPackagesOf(args: CloneSwapArgs, pluginRoot: string): Promise<void> {
  const from = path.join(args.backupDir, pluginRoot, PACKAGES_DIR);
  const target = path.join(args.liveDir, pluginRoot);
  const to = path.join(target, PACKAGES_DIR);
  try {
    await assertPathInside(args.backupDir, from, "carried plugin packages");
    await assertPathInside(args.liveDir, to, "carried plugin packages");
    if (!(await pathExists(from)) || !(await pathExists(target)) || (await pathExists(to))) {
      return;
    }

    await args.renameOps.rename(from, to);
  } catch (err) {
    hookDebugLog(`could not carry ${from} to ${to}: ${errorMessage(err)}`, "git");
  }
}

/**
 * D-PL9-10 / NFR-10: the roots, relative to `liveDir`, of the scope's installed
 * plugins whose plugin root lies inside that checkout, so the swap carries
 * their packages over. A root outside the checkout is not the swap's.
 */
export function installedRootsInside(
  liveDir: string,
  marketplaces: ExtensionState["marketplaces"],
): readonly string[] {
  return Object.values(marketplaces)
    .flatMap((marketplace) => Object.values(marketplace.plugins))
    .map((plugin) => path.relative(liveDir, plugin.resolvedSource))
    .filter(
      (pluginRoot) =>
        pluginRoot !== ".." &&
        !pluginRoot.startsWith(`..${path.sep}`) &&
        !path.isAbsolute(pluginRoot),
    );
}

/** D-PL9-10: carry the packages of every installed plugin root into the new checkout. */
async function carryPackages(args: CloneSwapArgs): Promise<void> {
  for (const pluginRoot of args.carryOver) {
    // eslint-disable-next-line no-await-in-loop -- a root may sit inside another, so each move reads the tree the one before it left
    await carryPackagesOf(args, pluginRoot);
  }
}

/**
 * D-SG-10: swap the staging clone in through the backup directory, carry the
 * installed plugins' packages over (D-PL9-10), then delete the backup. A backup that cannot be deleted is left for the next
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
  await carryPackages(args);
  const leak = await cleanupStaging(args.removalOps, args.backupDir, "marketplace checkout backup");
  if (leak !== undefined) {
    hookDebugLog(leak, "git");
  }

  return { kind: "replaced" };
}

/**
 * D-SG-10: refresh the checkout at `liveDir` from `url`. An interrupted swap
 * is put back first. A current checkout is left alone. A stale one is cloned
 * again into staging and swapped in; a failed clone leaves the live checkout
 * untouched, and a failed move-in puts the old checkout back. The caller holds
 * the scope's state lock around the whole refresh (Q13).
 */
export async function refreshCloneBySwap(args: CloneSwapArgs): Promise<CloneSwapResult> {
  await recoverInterruptedSwap(args);
  const freshness = await checkFreshness(args);
  if (freshness.kind === "current") {
    return { kind: "current" };
  }

  // D-SG-15: only an unreachable remote is kept, and only a valid checkout. A
  // stale checkout, or one without its marker, is cloned again, and without
  // the variable an unreachable remote is cloned again too.
  if (
    freshness.kind === "unreachable" &&
    args.keepOnUnreachable &&
    (await pathExists(path.join(args.liveDir, args.liveMarker)))
  ) {
    return { kind: "kept-stale", cause: freshness.cause };
  }

  const stagingDir = await cloneIntoStaging(args, freshness);
  return swapIn(args, stagingDir);
}

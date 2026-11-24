// orchestrators/plugin/clone-cache.ts
//
// PURL-02 / PURL-04 / D-77-03..06: the plugin clone-cache seam.
//
// install-outcome.ts is forbidden the git surface by BLOCK F in
// `eslint.config.js` (NFR-5). The clone lives HERE, in a sibling seam install
// calls by name; this file imports DEFAULT_GIT_OPS from marketplace/shared.ts
// (the same re-export update-flow.ts uses) and is legally allowed the git
// surface (listed in that config's `NETWORK_SEAMS`).
//
// `materializePluginClone` clones a git plugin source at its pinned/resolved
// sha into the shared source-addressed cache `plugin-clones/<key>/`, deduped
// by url+sha (PURL-04), with a warm-cache short-circuit that stays offline
// (PURL-02). It mirrors marketplace/add.ts::addGitClonedInGuard -- staging
// clone -> atomic rename -> MA-9 append-leak cleanup -- distilled to just the
// tree materialization (no manifest read / duplicate-name / state mutation;
// the resolver reads the manifest afterward).
//
// `resolvePluginPin` canonicalizes the clone url and resolves the pin
// (sha over ref; unpinned resolves remote HEAD via resolveRemoteRef, D-77-05).

import { randomUUID } from "node:crypto";
import { cp, mkdir, readFile, rename, rm } from "node:fs/promises";
import path from "node:path";

import {
  canonicalCloneUrl,
  networkCloneUrl,
  pluginCloneKey,
  pluginMirrorKey,
} from "../../domain/clone-key.ts";
import { loadMarketplaceManifest } from "../../domain/manifest.ts";
import { parsePluginSource } from "../../domain/source.ts";
import { loadState } from "../../persistence/state-io.ts";
import { hookDebugLog } from "../../shared/debug-log.ts";
import {
  appendLeakToError,
  errorMessage,
  GitCommandError,
  PinnedCommitMissingError,
  PluginMirrorInUseError,
  type GitFailure,
} from "../../shared/errors.ts";
import {
  cleanupStaging,
  createRemovalOps,
  pathExists,
  resolveGitSubdirRoot,
  type RemovalOps,
} from "../../shared/fs-utils.ts";
import { gitHubWireUrl } from "../../shared/github-base-url.ts";
import { ownValue } from "../../shared/own-key.ts";
import {
  DEFAULT_RENAME_OPS,
  installedRootsInside,
  refreshCloneBySwap,
  type RenameOps,
} from "../marketplace/clone-swap.ts";
import { DEFAULT_GIT_OPS, type GitAuthBundle, type GitOps } from "../marketplace/shared.ts";

import type { GitPluginRootResult } from "../../domain/resolver-types.ts";
import type {
  GitBackedSource,
  GitHubSource,
  GitSubdirSource,
  PathSource,
  UrlSource,
} from "../../domain/source.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";

/**
 * SG-PRC-05: whether `err` is a failed git command of one of `kinds`. A
 * checkout of a commit the clone does not hold fails as `commit-missing`, and
 * one of a name it does not hold as `local-ref-missing`.
 */
function isGitFailureOf(err: unknown, kinds: readonly GitFailure["kind"][]): boolean {
  return err instanceof GitCommandError && kinds.includes(err.kind);
}

/**
 * Promote a staging dir to its final clone root by atomic rename. Both dirs
 * are siblings under `extensionRoot` (`sources-staging/` and
 * `plugin-clones/`), so the rename stays on one filesystem.
 *
 * Returns `"raced"` when a concurrent materialization of the same key won:
 * EEXIST / ENOTEMPTY means the winner's tree is already there, and because
 * the key derives from the content identity that tree is byte-equivalent, so
 * our staging is cleaned and the caller treats the existing root as valid.
 *
 * Any other rename failure is real and rethrows with the cleanup leak
 * appended (MA-9).
 */
async function promoteStagingToClone(
  ops: RemovalOps,
  stagingDir: string,
  cloneRoot: string,
  stagingLabel: string,
): Promise<"renamed" | "raced"> {
  try {
    await mkdir(path.dirname(cloneRoot), { recursive: true });
    await rename(stagingDir, cloneRoot);
    return "renamed";
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    const leak = await cleanupStaging(ops, stagingDir, stagingLabel);
    if (code === "EEXIST" || code === "ENOTEMPTY") {
      return "raced";
    }

    const wrapped = appendLeakToError(err, leak);
    throw wrapped;
  }
}

/**
 * Clone `url` into `stagingDir` at depth 1 (C5): a ref hint clones only that
 * ref's branch, and no ref clones the default branch.
 */
async function cloneIntoStaging(
  gitOps: GitOps,
  stagingDir: string,
  url: string,
  args: { readonly ref?: string; readonly auth: GitAuthBundle },
): Promise<void> {
  await gitOps.clone({
    dir: stagingDir,
    url,
    ...(args.ref !== undefined && { ref: args.ref, singleBranch: true }),
    auth: args.auth,
  });
}

/**
 * SG-TRN-02, C5, INR-03: Claude Code's pin ladder. A depth-1 clone with no
 * checkout and no `--branch`, then `fetchCommit` (`fetch --depth 1 origin
 * <pin>`, and `fetch --unshallow origin [<ref>]` when the clone is shallow),
 * then a checkout of the pin, then a check that `HEAD` is the pin.
 *
 * The pin is lower-cased first, so a mixed-case 40-hex pin is fetched,
 * checked out, and compared as git prints it. A fetch that brings no such
 * commit (`commit-missing`, which a complete clone throws because it skips
 * the unshallow rung) leaves the answer to the checkout; any other fetch
 * failure propagates. A checkout that finds no commit is
 * `PinnedCommitMissingError(pin)`. A `HEAD` other than the pin is a
 * `pin-mismatch` GitCommandError (`source missing`), and the caller removes
 * the staging tree before anything is promoted.
 */
async function cloneAtPin(
  gitOps: GitOps,
  stagingDir: string,
  url: string,
  args: { readonly pin: string; readonly ref?: string; readonly auth: GitAuthBundle },
): Promise<void> {
  const pin = args.pin.toLowerCase();
  await gitOps.clone({ dir: stagingDir, url, noCheckout: true, auth: args.auth });
  try {
    await gitOps.fetchCommit({
      dir: stagingDir,
      sha: pin,
      ...(args.ref !== undefined && { ref: args.ref }),
      auth: args.auth,
    });
  } catch (fetchErr) {
    if (!isGitFailureOf(fetchErr, ["commit-missing"])) {
      throw fetchErr;
    }
  }

  try {
    await gitOps.checkout({ dir: stagingDir, ref: pin });
  } catch (checkoutErr) {
    throw asPinnedCommitMissing(checkoutErr, args.pin);
  }

  const head = await gitOps.resolveRef({ dir: stagingDir, ref: "HEAD" });
  if (head !== pin) {
    throw new GitCommandError({ kind: "pin-mismatch" }, { operation: "rev-parse --verify" });
  }
}

/**
 * INR-03: a fresh clone that still lacks the pin after the ladder's fetch
 * means the git host does not have it. Any other checkout throw passes
 * through unchanged. INR-06: git's error is not chained, because its stderr
 * names nothing a Pi user can act on.
 */
function asPinnedCommitMissing(err: unknown, pin: string): unknown {
  return isGitFailureOf(err, ["commit-missing"]) ? new PinnedCommitMissingError(pin) : err;
}

/**
 * PURL-02 / PURL-04: materialize a plugin clone at the exact pin into
 * `plugin-clones/<key>/`, returning the clone root.
 *
 * Flow:
 *   1. key = pluginCloneKey(cloneUrl, pin); cloneRoot = pluginCloneDir(key).
 *   2. Warm-cache short-circuit: if cloneRoot exists, return it -- NO clone,
 *      NO network (PURL-02 offline / PURL-04 dedup).
 *   3. Reach the exact `pin` (sha over ref) in a staging dir by the
 *      `cloneAtPin` ladder: a depth-1 no-checkout clone, a fetch of the pin
 *      (unshallowing the ref, or the default branch, when the shallow fetch
 *      fails), a checkout, and a `HEAD` check. A genuinely unreachable pin
 *      throws `PinnedCommitMissingError` (INR-03) and a `HEAD` other than the
 *      pin `pin-mismatch`; both fold into the fail-clean path. Any throw
 *      cleans staging and append-leak-rethrows (MA-9).
 *   4. Atomic same-FS rename staging -> cloneRoot. An EEXIST/ENOTEMPTY rename
 *      means a concurrent install of the same url+sha already won the race;
 *      its tree is byte-equivalent (same key => same content), so clean our
 *      staging and return cloneRoot as a warm-cache win. Any other rename
 *      errno append-leak-rethrows (MA-9).
 *
 * `resolveAuth` builds the bundle forwarded to `gitOps.clone`, and the bundle's
 * credentials thread into the clone so a private source on the bundle's own
 * host authenticates, whichever host that is (PROV-03/D-79-01, GAUTH-03).
 * Every install, reinstall, fetch, `info --fetch`, and update caller passes
 * one. It runs only on a cold key, so a caller that builds the bundle inside
 * it reads the GitHub base variable only when the clone reaches the network
 * (NFR-5).
 *
 * `networkUrl` is caller-computed (D-2-03): the `url` arm of the derivation
 * needs `source.raw`, which is not recoverable from `cloneUrl` once the
 * parse-time strip has run.
 */
export async function materializePluginClone(args: {
  locations: ScopedLocations;
  cloneUrl: string;
  networkUrl: string;
  pin: string;
  ref?: string;
  gitOps?: GitOps;
  resolveAuth: () => GitAuthBundle;
  onCloneCreated?: (key: string) => void;
}): Promise<string> {
  const gitOps = args.gitOps ?? DEFAULT_GIT_OPS;
  // D-08-12: this verb owns a staging lifecycle, so it is the composition root
  // that constructs the removal operations its cleanup and promotion paths run
  // through. The port is required with no default, so a new cleanup site here
  // cannot go uninjected.
  const removalOps = createRemovalOps();
  const key = pluginCloneKey(args.cloneUrl, args.pin);
  // D-2-03: the key hashes the canonical identity url; the caller-supplied
  // wire url is the only thing sent to the remote.
  const networkUrl = args.networkUrl;
  const cloneRoot = await args.locations.pluginCloneDir(key);

  // PURL-02 / PURL-04: a present key dir is a byte-equivalent warm cache.
  if (await pathExists(cloneRoot)) {
    return cloneRoot;
  }

  const cold = { ...args, auth: args.resolveAuth() };
  const stagingDir = await args.locations.sourcesStagingDir(randomUUID());

  // The recorded commit is the pin even when a moving tag/branch ref is given.
  try {
    await cloneAtPin(gitOps, stagingDir, networkUrl, cold);
  } catch (err) {
    const leak = await cleanupStaging(removalOps, stagingDir, "plugin clone staging");
    throw appendLeakToError(err, leak);
  }

  // A `raced` promotion means a concurrent install of the same url+sha won;
  // its tree is byte-equivalent, so the existing root is a warm cache win.
  const promotion = await promoteStagingToClone(
    removalOps,
    stagingDir,
    cloneRoot,
    "plugin clone staging",
  );
  if (promotion === "renamed") {
    args.onCloneCreated?.(key);
  }

  return cloneRoot;
}

/**
 * GIT-04: check `ref` out of a copy of the git directory `gitDir` into the
 * empty staging dir `staging`, the one copy-and-checkout step every
 * per-commit copy and tag clone shares.
 *
 * Only `.git` is copied (symlinks verbatim), and its index is dropped, so no
 * stat data of the source work tree carries over and the checkout writes
 * exactly the commit's tree: no untracked or edited file of the source work
 * tree rides along, a relative symlink stays relative instead of pointing
 * back into the source (NFR-10), and a directory that holds only a symlink
 * checks out. D-SG-11, SG-MIG-01: the checkout first unsets the clone keys an
 * `isomorphic-git` clone carries in the copied config, so a copy of an old
 * clone writes a symlink as a link. Throws raw; the caller owns the staging
 * cleanup.
 */
async function checkoutGitDirCopy(
  gitOps: GitOps,
  gitDir: string,
  staging: string,
  ref: string,
): Promise<void> {
  await copyGitDir(gitDir, staging);
  await gitOps.checkout({ dir: staging, ref, fromCopiedGitDir: true });
}

/**
 * The copy half of `checkoutGitDirCopy`: `gitDir` copied into the empty
 * staging dir `staging`, symlinks verbatim, with its index dropped.
 */
async function copyGitDir(gitDir: string, staging: string): Promise<void> {
  await mkdir(staging, { recursive: true });
  await cp(gitDir, path.join(staging, ".git"), { recursive: true, verbatimSymlinks: true });
  await rm(path.join(staging, ".git", "index"), { force: true });
}

/**
 * GIT-01: check out `sha` into `dest` from the URL-keyed mirror of
 * `cloneUrl`, local only. Returns false when there is no mirror or the mirror
 * does not hold `sha`, so the caller clones instead. A checkout failure other
 * than a missing commit propagates with the staging leak appended (MA-9).
 */
async function copyMirrorAtCommit(
  ops: RemovalOps,
  args: {
    readonly locations: ScopedLocations;
    readonly cloneUrl: string;
    readonly sha: string;
    readonly gitOps: GitOps;
  },
  dest: string,
): Promise<"renamed" | "raced" | undefined> {
  const mirrorRoot = await args.locations.pluginCloneDir(pluginMirrorKey(args.cloneUrl));
  if (!(await pathExists(mirrorRoot))) {
    return undefined;
  }

  const staging = await args.locations.sourcesStagingDir(randomUUID());
  try {
    await checkoutGitDirCopy(args.gitOps, path.join(mirrorRoot, ".git"), staging, args.sha);
  } catch (err) {
    const leak = await cleanupStaging(ops, staging, "plugin commit copy staging");
    if (isGitFailureOf(err, ["commit-missing", "local-ref-missing"])) {
      return undefined;
    }

    throw appendLeakToError(err, leak);
  }

  return promoteStagingToClone(ops, staging, dest, "plugin commit copy staging");
}

/**
 * GIT-01 / D-16-02: materialize the per-commit copy of a git plugin source at
 * `sha` into `plugin-clones/<key>/`, the key a pinned clone uses, and return
 * its root. An installed plugin runs from this copy, so refreshing the mirror
 * (`fetch`, `info --fetch`) never changes its files.
 *
 * A present copy is returned as is. Otherwise the URL-keyed mirror, when it
 * holds `sha`, is copied and checked out at `sha` with no network access;
 * failing that, `materializePluginClone` clones the commit.
 */
export async function materializePluginCommitCopy(args: {
  locations: ScopedLocations;
  cloneUrl: string;
  networkUrl: string;
  sha: string;
  gitOps?: GitOps;
  resolveAuth: () => GitAuthBundle;
  onCloneCreated?: (key: string) => void;
}): Promise<string> {
  const gitOps = args.gitOps ?? DEFAULT_GIT_OPS;
  const key = pluginCloneKey(args.cloneUrl, args.sha);
  const dest = await args.locations.pluginCloneDir(key);
  if (await pathExists(dest)) {
    return dest;
  }

  const promotion = await copyMirrorAtCommit(createRemovalOps(), { ...args, gitOps }, dest);
  if (promotion !== undefined) {
    if (promotion === "renamed") {
      args.onCloneCreated?.(key);
    }

    return dest;
  }

  return materializePluginClone({ ...args, gitOps, pin: args.sha });
}

/** The two clone-cache steps an unpinned source materializes through. */
export interface UnpinnedSourceSteps {
  readonly materializeOrRefreshPluginMirror: typeof materializeOrRefreshPluginMirror;
  readonly materializePluginCommitCopy: typeof materializePluginCommitCopy;
}

/**
 * GIT-01 / GIT-04: materialize an UNPINNED git source the way install,
 * update, and reinstall all do: the mirror step (clone cold, refresh warm,
 * or, with `refresh: false`, read the commit the mirror last fetched), then
 * the per-commit copy at that commit, anchored to the source's subdir. The
 * plugin runs from the copy, never from the mirror.
 *
 * The caller holds the scope's state lock around this call (GIT-03), so no
 * `fetch` refreshes the mirror while its commit is read and copied.
 */
export async function materializeUnpinnedSource(
  steps: UnpinnedSourceSteps,
  args: {
    readonly locations: ScopedLocations;
    readonly source: GitBackedSource;
    readonly auth: GitAuthBundle;
    readonly refresh?: boolean;
    readonly onCloneCreated?: (key: string) => void;
  },
): Promise<GitPluginRootResult> {
  const { locations, source, auth } = args;
  const cloneUrl = canonicalCloneUrl(source);
  const networkUrl = networkCloneUrl(source);
  const mirror = await steps.materializeOrRefreshPluginMirror({
    locations,
    cloneUrl,
    networkUrl,
    ...(source.ref !== undefined && { ref: source.ref }),
    auth,
    ...(args.refresh !== undefined && { refresh: args.refresh }),
    ...(args.onCloneCreated !== undefined && { onCloneCreated: args.onCloneCreated }),
  });
  const copyRoot = await steps.materializePluginCommitCopy({
    locations,
    cloneUrl,
    networkUrl,
    sha: mirror.resolvedSha,
    resolveAuth: () => auth,
    ...(args.onCloneCreated !== undefined && { onCloneCreated: args.onCloneCreated }),
  });
  return resolveGitPluginRootWithSubdir(source, copyRoot, mirror.resolvedSha);
}

/**
 * MIRR-01/02/03 / D-79.1-01/02: materialize-or-refresh the single mutable
 * mirror clone for an UNPINNED git plugin source at `plugin-clones/<urlhash12>/`
 * (bare URL key, no sha suffix), returning the mirror root + the checked-out
 * HEAD sha.
 *
 * The mirror is a download cache only (GIT-01): a caller that installs code
 * from it materializes the per-commit copy at the returned sha through
 * `materializePluginCommitCopy` and never records the mirror itself.
 *
 * This is the marketplace clone lifecycle applied to a URL-keyed directory
 * (D-79.1-01): one mirror per canonical URL, refreshed on mutating verbs, so
 * multi-clone ambiguity is impossible by construction.
 *
 * Flow:
 *   1. mirrorRoot = pluginCloneDir(pluginMirrorKey(cloneUrl)) (SC-7 chokepoint).
 *   2. Mirror ABSENT: clone into a staging dir (ref-hint singleBranch when a ref
 *      is given), then atomic same-FS rename staging -> mirrorRoot. It does NOT
 *      checkout a fixed pin -- the working tree tracks a moving HEAD/ref. A
 *      clone throw cleans staging and append-leak-rethrows (MA-9). An
 *      EEXIST/ENOTEMPTY rename means a concurrent create won the race (its tree
 *      is byte-equivalent, same url => same content): clean staging and fall
 *      through to the refresh path -- the winner's tree still needs a HEAD read
 *      (D-79.1-03).
 *   3. When the mirror was already present, or a concurrent create won the
 *      rename race, refresh it by D-SG-10's re-clone and swap, the swap
 *      `marketplace update` runs (refresh-on-warm, D-79.1-02): a backup that an
 *      interrupted swap left in `plugin-clones-backup/<key>` is put back or
 *      removed, then `ls-remote` of the source's ref (`HEAD` with none) decides.
 *      A current mirror is left as it is. A stale mirror, or one whose HEAD
 *      cannot be read, is cloned again into `sources-staging/` and swapped in
 *      through `plugin-clones-backup/<key>`, carrying the packages of any
 *      installed plugin root inside it (D-PL9-10). A failed clone leaves the
 *      mirror untouched. A mirror is never kept on failure: an unreachable
 *      remote is cloned again, and that clone's failure is the refresh's; a
 *      mirror that cannot be moved aside fails as `PluginMirrorInUseError`
 *      (`permission denied`), so no stale revision installs. A mirror gets no
 *      MA-12 ownership marker. A mirror this call just cloned is not
 *      refreshed: the clone already read the remote, and `marketplace add` and
 *      Claude Code both clone a source once. Reads (list/info) never call this
 *      seam, so NFR-5 is untouched. With `refresh: false` a present mirror
 *      answers the commit its last clone recorded for the declared ref, with
 *      no network (reinstall, D-18-04): the ref's tracking ref, or else the
 *      local tag of that name (D-PL7-10, GLK-08). A missing mirror, or a ref
 *      the mirror holds neither way, is the NFR-5 cache miss and still reaches
 *      it.
 *   4. Read the pin: resolvedSha = resolveRef({ dir: mirrorRoot, ref: "HEAD" }).
 *      A mirror whose HEAD names no commit fails as `local-ref-missing`.
 *
 * `auth` threads into the clone, the freshness check, and the re-clone the way
 * `materializePluginClone`'s bundle does (no mirror-specific auth path). Each
 * of them reaches the network, so the caller builds the bundle up front.
 * Derive-not-persist: mirror-dir existence IS the fetched-state -- no
 * migration stamp, no refcount. The caller holds the scope's state lock around
 * the whole refresh (GIT-03), so a second Pi on the scope never sees a
 * half-swapped mirror. All git surface (the swap, gitOps, resolveRef,
 * DEFAULT_GIT_OPS) stays confined to this file, never surfaced to
 * install/list/info.
 *
 * `networkUrl` is caller-computed (D-2-03): the `url` arm of the derivation
 * needs `source.raw`, which is not recoverable from `cloneUrl` once the
 * parse-time strip has run. A cold clone, the freshness check, and a re-clone
 * all send it.
 */
export async function materializeOrRefreshPluginMirror(args: {
  locations: ScopedLocations;
  cloneUrl: string;
  networkUrl: string;
  ref?: string;
  gitOps?: GitOps;
  renameOps?: RenameOps;
  auth: GitAuthBundle;
  refresh?: boolean;
  onCloneCreated?: (key: string) => void;
}): Promise<{ pluginRoot: string; resolvedSha: string }> {
  const gitOps = args.gitOps ?? DEFAULT_GIT_OPS;
  // D-08-12: this verb owns a staging lifecycle, so it is the composition root
  // that constructs the removal operations its cleanup and promotion paths run
  // through. The port is required with no default, so a new cleanup site here
  // cannot go uninjected.
  const removalOps = createRemovalOps();
  const key = pluginMirrorKey(args.cloneUrl);
  const mirrorRoot = await args.locations.pluginCloneDir(key);
  // D-2-03: same split as `materializePluginClone` -- the mirror key hashes the
  // canonical identity url, and the caller-supplied wire url is what a clone
  // and the freshness check send.
  const networkUrl = args.networkUrl;

  // MIRR-01: materialize the mirror on a cold key (no fixed-pin checkout; the
  // mirror tracks a moving ref).
  let promotion: "renamed" | "raced" | undefined;
  if (!(await pathExists(mirrorRoot))) {
    const stagingDir = await args.locations.sourcesStagingDir(randomUUID());

    try {
      await cloneIntoStaging(gitOps, stagingDir, networkUrl, args);
    } catch (err) {
      const leak = await cleanupStaging(removalOps, stagingDir, "plugin mirror staging");
      throw appendLeakToError(err, leak);
    }

    // MIRR-03 / D-79.1-03: a `raced` promotion falls through to the refresh
    // path -- the winner's byte-equivalent tree still needs a refresh plus a
    // HEAD read.
    promotion = await promoteStagingToClone(
      removalOps,
      stagingDir,
      mirrorRoot,
      "plugin mirror staging",
    );
    if (promotion === "renamed") {
      args.onCloneCreated?.(key);
    }
  }

  // MIRR-02 / D-79.1-02 / D-SG-10: refresh a warm mirror by re-clone and swap
  // (marketplace parity). The HEAD sha read below is the fetched-state; no
  // separate advance flag is consumed here. D-18-04: with `refresh: false` the
  // declared ref is read from the mirror's last clone instead, and only a ref
  // the mirror never received falls back to the refresh, as a cache miss
  // would.
  if (promotion !== "renamed") {
    const fetchedSha =
      args.refresh === false
        ? await resolveFetchedRefOffline(gitOps, mirrorRoot, args.ref)
        : undefined;
    if (fetchedSha !== undefined) {
      return { pluginRoot: mirrorRoot, resolvedSha: fetchedSha };
    }

    await refreshMirrorBySwap({ ...args, gitOps, removalOps, key, mirrorRoot });
  }

  const resolvedSha = await gitOps.resolveRef({ dir: mirrorRoot, ref: "HEAD" });
  if (resolvedSha === undefined) {
    throw new GitCommandError({ kind: "local-ref-missing" }, { operation: "rev-parse --verify" });
  }

  return { pluginRoot: mirrorRoot, resolvedSha };
}

/** D-SG-10: the file whose presence makes a plugin mirror a valid checkout. */
const MIRROR_LIVE_MARKER = path.join(".git", "HEAD");

/**
 * D-PL9-10: the roots inside `mirrorRoot` of the scope's installed plugins. A
 * record from before the per-commit copies (GIT-01) may still run from the
 * mirror, so the swap carries its packages over. The carry is best effort, as
 * in the swap itself: a state file that cannot be read carries nothing, and a
 * debug-log line says so.
 */
async function installedRootsInMirror(
  locations: ScopedLocations,
  mirrorRoot: string,
): Promise<readonly string[]> {
  try {
    const state = await loadState(locations.extensionRoot);
    return installedRootsInside(mirrorRoot, state.marketplaces);
  } catch (err) {
    hookDebugLog(`mirror ${mirrorRoot} carries no packages: ${errorMessage(err)}`, "git");
    return [];
  }
}

/**
 * D-SG-10 / SG-TRN-03: refresh the present mirror at `mirrorRoot` by re-clone
 * and swap. The keep variable of D-SG-15 is for marketplaces only, so an
 * unreachable remote is cloned again, and a mirror that cannot be moved aside
 * fails as `PluginMirrorInUseError`.
 */
async function refreshMirrorBySwap(args: {
  readonly locations: ScopedLocations;
  readonly networkUrl: string;
  readonly ref?: string;
  readonly gitOps: GitOps;
  readonly renameOps?: RenameOps;
  readonly auth: GitAuthBundle;
  readonly removalOps: RemovalOps;
  readonly key: string;
  readonly mirrorRoot: string;
}): Promise<void> {
  const swapped = await refreshCloneBySwap({
    locations: args.locations,
    liveDir: args.mirrorRoot,
    backupDir: await args.locations.pluginCloneBackupDir(args.key),
    url: args.networkUrl,
    ...(args.ref !== undefined && { ref: args.ref }),
    gitOps: args.gitOps,
    auth: args.auth,
    liveMarker: MIRROR_LIVE_MARKER,
    keepOnUnreachable: false,
    ownershipMarker: false,
    carryOver: await installedRootsInMirror(args.locations, args.mirrorRoot),
    removalOps: args.removalOps,
    renameOps: args.renameOps ?? DEFAULT_RENAME_OPS,
  });
  if (swapped.kind === "kept-in-use") {
    throw new PluginMirrorInUseError(swapped.cause);
  }
}

/**
 * D-18-04 / REI-04: the commit a present mirror last received for the ref a
 * source declares, read with no network. The mirror is keyed by URL only, so
 * its checked-out HEAD belongs to whichever source refreshed it last, which
 * can be another plugin with a different `ref`, or this entry before its
 * `ref` changed. The remote-tracking ref is this source's own: the default
 * branch (`refs/remotes/origin/HEAD`) when no ref is declared, otherwise
 * `refs/remotes/origin/<ref>`. A depth-1 clone writes the first for the
 * default branch and the second for `--branch=<branch>` (D-SG-10).
 *
 * A declared ref with no tracking ref falls back to the local tag of that
 * name (D-PL7-10, GLK-08): a clone for a tag writes `refs/tags/<ref>` and no
 * tracking ref, because the fetch refspec maps branches only. `resolveRef`
 * peels an annotated tag to its commit.
 *
 * Returns undefined when the mirror holds no such ref, for example a branch
 * no fetch brought in yet, or a tag that names no commit. The caller then
 * refreshes. A read that fails propagates.
 */
async function resolveFetchedRefOffline(
  gitOps: GitOps,
  mirrorRoot: string,
  ref: string | undefined,
): Promise<string | undefined> {
  const trackingRef = ref === undefined ? "refs/remotes/origin/HEAD" : `refs/remotes/origin/${ref}`;
  const trackedSha = await gitOps.resolveRef({ dir: mirrorRoot, ref: trackingRef });
  if (trackedSha !== undefined || ref === undefined) {
    return trackedSha;
  }

  return gitOps.resolveRef({ dir: mirrorRoot, ref: `refs/tags/${ref}` });
}

/**
 * D-SEED-02 / NFR-5: fs-only read of a checkout's `origin` remote URL from
 * `<checkoutRoot>/.git/config`. Mirrors the fs-only `.git`-reading idiom of
 * `readMirrorHeadSha` in git-source-probe.ts -- NO `git` subprocess, NO network
 * -- so reading a path-source marketplace's canonical URL stays a local
 * metadata read. Returns undefined when the config file is absent, unreadable,
 * or declares no `[remote "origin"]` url.
 */
async function readOriginRemoteUrl(checkoutRoot: string): Promise<string | undefined> {
  let config: string;
  try {
    config = await readFile(path.join(checkoutRoot, ".git", "config"), "utf8");
  } catch {
    return undefined;
  }

  let inOrigin = false;
  for (const rawLine of config.split("\n")) {
    const line = rawLine.trim();
    if (line.startsWith("[")) {
      inOrigin = /^\[remote\s+"origin"\]$/.test(line);
      continue;
    }

    if (inOrigin) {
      // `=(.*)` (not `=\s*(.+)`) keeps the match linear-time: overlapping `\s*`
      // and `(.+)` both matching spaces is the S8786 super-linear smell. The
      // capture is trimmed and returned only when non-empty, so a bare `url =`
      // still yields undefined -- behavior identical to the prior pattern.
      const captured = /^url\s*=(.*)$/.exec(line)?.[1];
      if (captured !== undefined) {
        const value = captured.trim();
        if (value !== "") {
          return value;
        }
      }
    }
  }

  return undefined;
}

/**
 * D-SEED-02: derive the canonical clone URL of the repository the marketplace
 * lives in, reusing ONLY the existing `canonicalCloneUrl` (no second
 * canonicalization). A github/url marketplace source canonicalizes its own
 * record; a path source's URL is read fs-only from the checkout's `.git/config`
 * origin remote (network-free, NFR-5) and reparsed through the SAME
 * `parsePluginSource` + `canonicalCloneUrl` the plugin sources use. Returns
 * undefined when no same-repo URL can be discovered (a non-git dir, no origin,
 * or an origin that does not canonicalize to a git source) -- nothing to seed.
 */
async function deriveMarketplaceUrl(
  storedSource: unknown,
  marketplaceRoot: string,
): Promise<string | undefined> {
  const source = parsePluginSource(storedSource);
  if (source.kind === "github" || source.kind === "url") {
    return canonicalCloneUrl(source);
  }

  if (source.kind === "path") {
    const origin = await readOriginRemoteUrl(marketplaceRoot);
    if (origin === undefined) {
      return undefined;
    }

    const parsed = parsePluginSource(origin);
    if (parsed.kind === "url" || parsed.kind === "git-subdir" || parsed.kind === "github") {
      return canonicalCloneUrl(parsed);
    }
  }

  return undefined;
}

/**
 * D-SG-09: the marketplace's own git source when it is a `github` or `url`
 * marketplace, whose checkout is a depth-1 clone that may lack a tag's
 * commit; undefined for a directory marketplace, whose repository holds it.
 */
function gitMarketplaceSource(storedSource: unknown): GitHubSource | UrlSource | undefined {
  const source = parsePluginSource(storedSource);
  return source.kind === "github" || source.kind === "url" ? source : undefined;
}

/**
 * D-SEED-03 / NFR-1 / NFR-10: seed ONE same-repo plugin mirror by copying the
 * marketplace checkout tree (including `.git`, so the origin remote is preserved
 * BY CONSTRUCTION -- SEED-05) into a staging dir, then an atomic same-FS rename
 * into the plugin-clone cache (sources-staging/ and plugin-clones/ are siblings
 * under extensionRoot). Unpinned -> the URL-keyed mirror dir; pinned -> the
 * per-sha clone dir gated by a checkout of the sha against the copied history
 * (SEED-04). The destination is composed ONLY from `pluginMirrorKey` /
 * `pluginCloneKey` outputs routed through `locations.pluginCloneDir` -- the
 * SC-7/NFR-10 containment chokepoint; no manifest/user string joins the path.
 */
async function seedOnePluginMirror(
  ops: RemovalOps,
  locations: ScopedLocations,
  gitOps: GitOps,
  source: UrlSource | GitSubdirSource | GitHubSource,
  marketplaceUrl: string,
  marketplaceRoot: string,
): Promise<void> {
  const key =
    source.sha === undefined
      ? pluginMirrorKey(marketplaceUrl)
      : pluginCloneKey(marketplaceUrl, source.sha);
  const dest = await locations.pluginCloneDir(key);

  // Warm short-circuit: a present key dir is a byte-equivalent warm cache (same
  // key => same content). Leave it untouched (idempotent, NFR-3).
  if (await pathExists(dest)) {
    return;
  }

  const staging = await locations.sourcesStagingDir(randomUUID());
  await mkdir(path.dirname(staging), { recursive: true });
  if (source.sha === undefined) {
    // The mirror is a download cache: copy the working tree AND `.git`, so its
    // origin remote is the real remote URL (SEED-05), never the local checkout
    // path, with symlinks kept as they are. `cp` is cross-FS safe; the visible
    // mirror still appears only via the atomic rename.
    await cp(marketplaceRoot, staging, { recursive: true, verbatimSymlinks: true });
  } else {
    // SEED-04 / GIT-04: a pinned source is a per-commit copy an install runs
    // from, so it gets exactly the commit's tree through the shared step, and
    // only when the sha checks out against the copied history -- a successful
    // checkout IS the reachability proof. An unreachable pin (or any throw) is
    // skipped so the normal network path materializes it later; never
    // fabricate an immutable per-sha entry from non-matching content.
    try {
      await checkoutGitDirCopy(gitOps, path.join(marketplaceRoot, ".git"), staging, source.sha);
    } catch {
      await cleanupStaging(ops, staging, "plugin mirror seed staging");
      return;
    }
  }

  // Atomic same-FS rename staging -> dest (NFR-1).
  try {
    await mkdir(path.dirname(dest), { recursive: true });
    await rename(staging, dest);
  } catch (err) {
    // EEXIST/ENOTEMPTY: a concurrent seed/materialize won the race; its tree is
    // byte-equivalent, so clean staging and treat dest as a warm-cache win. Any
    // other rename error cleans staging and rethrows to the per-entry boundary.
    const code = (err as NodeJS.ErrnoException).code;
    await cleanupStaging(ops, staging, "plugin mirror seed staging");
    if (code !== "EEXIST" && code !== "ENOTEMPTY") {
      throw err;
    }
  }
}

/**
 * SEED-01..06 / D-SEED-01..03: seed the same-repo plugin mirror(s) declared by a
 * just-added marketplace from the local marketplace checkout, network-free.
 *
 * When a marketplace manifest declares a git-source plugin (url / github /
 * git-subdir) whose canonical clone URL is the SAME repository the marketplace
 * itself lives in, that plugin's clone bytes are already on disk in the
 * marketplace checkout. Copy that tree into the plugin-clone cache instead of
 * re-cloning identical bytes over the network (SEED-01 Case A / SEED-02 Case B).
 * After seeding, the read-only presence probe finds the warm mirror on its own,
 * so the plugin stops rendering `(remote)` right after `marketplace add`.
 *
 * Called best-effort post-commit from `marketplace add` (D-SEED-01): it runs
 * AFTER the add already committed, per-entry failures are swallowed, and the
 * whole sweep never disturbs the committed add. A plugin whose canonical URL
 * differs from the marketplace's is left untouched (SEED-03 different-repo). A
 * pinned source seeds only when its sha is reachable in the copied history
 * (SEED-04); an unreachable pin falls back to the normal network path. install
 * / fetch continue to handle a cold mirror through their normal materialize
 * path, so no second hook is needed. clone-cache.ts is the git-surface-allowed
 * seam, so no gated read orchestrator gains a git token (NFR-5).
 */
export async function seedSameRepoPluginMirrors(args: {
  locations: ScopedLocations;
  marketplaceName: string;
  gitOps?: GitOps;
}): Promise<void> {
  const gitOps = args.gitOps ?? DEFAULT_GIT_OPS;
  // D-08-12: this verb owns a staging lifecycle, so it is the composition root
  // that constructs the removal operations its cleanup and promotion paths run
  // through. The port is required with no default, so a new cleanup site here
  // cannot go uninjected.
  const removalOps = createRemovalOps();
  const { locations, marketplaceName } = args;

  const state = await loadState(locations.extensionRoot);
  const mp = ownValue(state.marketplaces, marketplaceName);
  if (mp === undefined) {
    return;
  }

  const marketplaceUrl = await deriveMarketplaceUrl(mp.source, mp.marketplaceRoot);
  if (marketplaceUrl === undefined) {
    return;
  }

  const manifest = await loadMarketplaceManifest(mp.manifestPath);
  for (const entry of manifest.plugins) {
    const src = parsePluginSource(entry.source);
    if (src.kind !== "url" && src.kind !== "git-subdir" && src.kind !== "github") {
      continue;
    }

    // SEED-03: a different-repo git source is unaffected -- skip it so it keeps
    // its normal `(remote)` -> network-clone behavior.
    if (canonicalCloneUrl(src) !== marketplaceUrl) {
      continue;
    }

    try {
      // eslint-disable-next-line no-await-in-loop -- entries can share a mirror key; each seed checks the last
      await seedOnePluginMirror(
        removalOps,
        locations,
        gitOps,
        src,
        marketplaceUrl,
        mp.marketplaceRoot,
      );
    } catch {
      // Best-effort (D-SEED-01): a per-entry seed failure leaves the plugin
      // `(remote)` for the normal network path; the committed add is untouched.
    }
  }
}

/**
 * D-77-04..06 / PURL-09: canonicalize the clone url and resolve the pin for a
 * git plugin source.
 *
 * cloneUrl reconstruction is single-sourced through `canonicalCloneUrl`
 * (domain/clone-key.ts, which owns the clone-key identity invariant).
 *
 * pin resolution (sha over ref):
 *   - source.sha set: that is the pin (a moving ref never overrides it).
 *   - else source.ref set: resolveRemoteRef({ url, ref }) (D-77-05).
 *   - else unpinned: resolveRemoteRef({ url }) resolves remote HEAD (D-77-05).
 *
 * `ref` is returned as the clone's singleBranch fetch hint.
 */
export async function resolvePluginPin(args: {
  source: UrlSource | GitSubdirSource | GitHubSource;
  gitOps?: GitOps;
  auth?: GitAuthBundle;
}): Promise<{ cloneUrl: string; pin: string; ref?: string }> {
  const gitOps = args.gitOps ?? DEFAULT_GIT_OPS;
  const { source, auth } = args;

  const cloneUrl = canonicalCloneUrl(source);
  // MURL-01 / PURL-09: `cloneUrl` is the cache-key identity and is what this
  // function RETURNS; `networkUrl` is the verbatim wire form (D-2-03) and is
  // only ever sent to the remote.
  const networkUrl = networkCloneUrl(source);

  // PROV-03 (Q1): forward the optional auth bundle into resolveRemoteRef so an
  // unpinned PRIVATE-repo HEAD resolution authenticates; a pinned sha never
  // touches the network so no auth is needed there.
  let pin: string;
  if (source.sha !== undefined) {
    pin = source.sha;
  } else if (source.ref !== undefined) {
    pin = requireRemotePin(
      await gitOps.resolveRemoteRef({
        url: networkUrl,
        ref: source.ref,
        ...(auth !== undefined && { auth }),
      }),
      `remote ${gitHubWireUrl(networkUrl)} has no ref "${source.ref}"`,
    );
  } else {
    pin = requireRemotePin(
      await gitOps.resolveRemoteRef({
        url: networkUrl,
        ...(auth !== undefined && { auth }),
      }),
      `remote ${gitHubWireUrl(networkUrl)} advertised no HEAD ref`,
    );
  }

  return source.ref === undefined ? { cloneUrl, pin } : { cloneUrl, pin, ref: source.ref };
}

/**
 * The commit a remote advertised, or a refusal with `message` when it
 * advertised none. The message names the URL the request sent (GHB-01).
 */
function requireRemotePin(advertised: string | undefined, message: string): string {
  if (advertised === undefined) {
    throw new Error(message);
  }

  return advertised;
}

// PURL-03 / NFR-10 / D-77-03: `resolveGitSubdirRoot` lives in shared/fs-utils.ts
// so the network-free presence probe can share it without pulling this seam's git
// surface. Re-exported here under the same name so the update / reinstall
// import sites need no change. `install-clone-probe.ts` calls this file's
// `resolveGitPluginRootWithSubdir`, which wraps it, rather than importing it directly.
export { resolveGitSubdirRoot } from "../../shared/fs-utils.ts";

// D-77-06 / PURL-07: `canonicalCloneUrl` lives in domain/clone-key.ts (the
// module that owns both key halves and the clone-key identity invariant) so
// the git seam and the fs-only presence probe share ONE url reconstruction.
// Re-exported here under the same name to keep install / update / reinstall /
// fetch import sites unbroken.
export { canonicalCloneUrl, networkCloneUrl } from "../../domain/clone-key.ts";

/**
 * PURL-03 / NFR-10: anchor a materialized clone to the plugin root the source
 * actually names, and stamp the resolved sha.
 *
 * A `git-subdir` source resolves its pluginRoot UNDER the clone root, and the
 * `escapes` / `missing-subdir` arms propagate unchanged so the resolver can
 * surface them as `unavailable` (fail-clean). Every other git kind
 * materializes at the clone root itself.
 *
 * Shared by the pinned and unpinned probe arms of BOTH the install path and
 * the `info --fetch` path.
 */
export async function resolveGitPluginRootWithSubdir(
  gitSource: GitBackedSource,
  cloneRoot: string,
  resolvedSha: string,
): Promise<GitPluginRootResult> {
  if (gitSource.kind === "git-subdir") {
    const subdirResult = await resolveGitSubdirRoot(cloneRoot, gitSource.path);
    if (subdirResult.kind !== "materialized") {
      return subdirResult;
    }

    return { kind: "materialized", pluginRoot: subdirResult.pluginRoot, resolvedSha };
  }

  return { kind: "materialized", pluginRoot: cloneRoot, resolvedSha };
}

/**
 * D-07-01 / D-07-04: materialize a marketplace-local release tag's tree into
 * `plugin-clones/<key>/`, without ever mutating the marketplace clone's own
 * working tree, HEAD, or index.
 *
 * Construction (D-07-04, developer-confirmed): copy ONLY the marketplace's
 * `.git` dir into an otherwise-empty staging dir, then check the tag out
 * there. D-SG-09: a `github` or `url` marketplace is a depth-1 clone, so
 * between the copy and the checkout the copy fetches the tag's commit
 * (`fetch --depth 1 origin <oid>`) with the marketplace host's auth bundle; a
 * failed fetch cleans the staging dir and fails the copy. The tag is checked out inside a COPY's own gitdir, never against a
 * `gitdir` naming the marketplace clone -- verified against the installed
 * isomorphic-git source that a checkout writes `${gitdir}/index` regardless
 * of `noUpdateHead`, which would silently desync the marketplace clone's own
 * index. Copying `.git` alone (not the work tree) means every index read and
 * write lands on the copy, the marketplace clone is never opened by any git
 * API at all, AND the checkout is the only thing that ever writes into the
 * work tree -- an untracked or gitignored file in the marketplace root
 * cannot ride along, because the staging dir never had a work tree to copy
 * one from.
 *
 * Keying: `pluginCloneKey(marketplaceUrl, tagOid)`, the SAME key shape a
 * pinned git-source clone uses, so `clone-gc.ts::deriveLiveCloneKeys` needs no
 * new logic to protect this directory. `marketplaceUrl` is derived through
 * the EXISTING `deriveMarketplaceUrl` (reused, not reinvented); a marketplace
 * checkout with no discoverable origin remote (RESEARCH assumption A2) still
 * needs a derivable key, so the URL half falls back to the marketplace's own
 * recorded name.
 *
 * Unlike `seedSameRepoPluginMirrors`' best-effort sweep, a materialization
 * failure here PROPAGATES to the install -- there is no "install the current
 * checkout instead" fallback in this arm; that is TAGS-02's job.
 */
export async function materializeMarketplaceTagClone(args: {
  locations: ScopedLocations;
  marketplaceRoot: string;
  marketplaceSource: unknown;
  marketplaceName: string;
  pathSource: PathSource;
  tagOid: string;
  gitOps?: GitOps;
  /**
   * D-SG-09: builds the auth bundle of a git marketplace's host for the tag
   * commit's fetch. It runs only on a cold key of a git marketplace, so a
   * warm copy and a directory marketplace build none.
   */
  resolveAuth?: (cloneUrl: string, kind: GitBackedSource["kind"]) => GitAuthBundle;
  onCloneCreated?: (key: string) => void;
}): Promise<GitPluginRootResult> {
  const gitOps = args.gitOps ?? DEFAULT_GIT_OPS;
  // D-08-12: this verb owns a staging lifecycle, so it is the composition root
  // that constructs the removal operations its cleanup and promotion paths run
  // through.
  const removalOps = createRemovalOps();

  const marketplaceUrl =
    (await deriveMarketplaceUrl(args.marketplaceSource, args.marketplaceRoot)) ??
    `marketplace-name:${args.marketplaceName}`;
  const key = pluginCloneKey(marketplaceUrl, args.tagOid);
  const dest = await args.locations.pluginCloneDir(key);

  // A present key dir is a byte-equivalent warm cache (same key => same tag
  // content): no re-copy, no re-checkout.
  if (!(await pathExists(dest))) {
    const staging = await args.locations.sourcesStagingDir(randomUUID());
    // GIT-04: the tag is checked out of a copy of the marketplace's gitdir
    // into an empty tree, so the checkout is the only thing that writes the
    // work tree and it writes exactly the tag's tree. D-SG-09: a git
    // marketplace is a depth-1 clone, so the copy first fetches the tag's
    // commit from the marketplace remote; a directory marketplace's
    // repository already holds it.
    const remote = gitMarketplaceSource(args.marketplaceSource);
    try {
      await copyGitDir(path.join(args.marketplaceRoot, ".git"), staging);
      if (remote !== undefined) {
        await gitOps.fetchCommit({
          dir: staging,
          sha: args.tagOid,
          ...(args.resolveAuth !== undefined && {
            auth: args.resolveAuth(canonicalCloneUrl(remote), remote.kind),
          }),
        });
      }

      await gitOps.checkout({ dir: staging, ref: args.tagOid, fromCopiedGitDir: true });
    } catch (err) {
      const leak = await cleanupStaging(removalOps, staging, "marketplace tag clone staging");
      throw appendLeakToError(err, leak);
    }

    const promotion = await promoteStagingToClone(
      removalOps,
      staging,
      dest,
      "marketplace tag clone staging",
    );
    if (promotion === "renamed") {
      args.onCloneCreated?.(key);
    }
  }

  // WR-07: label the failure with the source kind the user actually used --
  // this is the pinned-`path` arm, not a `git-subdir` source.
  const rootResult = await resolveGitSubdirRoot(dest, args.pathSource.raw, "path");
  if (rootResult.kind !== "materialized") {
    return rootResult;
  }

  return { kind: "materialized", pluginRoot: rootResult.pluginRoot, resolvedSha: args.tagOid };
}

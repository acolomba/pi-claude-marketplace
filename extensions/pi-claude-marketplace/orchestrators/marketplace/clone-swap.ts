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
// SG-SSH-02, OQ-4: the freshness check and the re-clone each run over a
// transport plan, as Claude Code's refresh lists and clones a source's URLs in
// order. A marketplace refresh plans from the declared source with the
// marketplace probe rule; the checkout's recorded `origin` picks no URL
// (CONTEXT [Identity], OQ-5), except for a url record an earlier version wrote
// under a URL that names no git repository (D-PL5-04).
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

import { addressTransport, noRetry, planMarketplaceClone } from "../../domain/github-transport.ts";
import { parsePluginSource } from "../../domain/source.ts";
import { atomicWriteJson } from "../../shared/atomic-json.ts";
import { hookDebugLog } from "../../shared/debug-log.ts";
import {
  appendLeakToError,
  errorMessage,
  GitCommandError,
  GITHUB_TRANSPORT_LABELS,
  GitHubTransportsFailedError,
  isErrnoException,
  StoredCredentialRejectedError,
} from "../../shared/errors.ts";
import { cleanupStaging, pathExists, type RemovalOps } from "../../shared/fs-utils.ts";
import { assertPathInside } from "../../shared/path-safety.ts";
import { redactAbsolutePaths } from "../../shared/redact-absolute-paths.ts";
import { redactCredentials } from "../../shared/redact-credentials.ts";
import { upstreamFlagIsTrue } from "../../shared/upstream-flag.ts";
import {
  cloneOverGitHubTransports,
  createGitHubCloneNotes,
  transportForce,
  type GitHubCloneNotes,
} from "../github-transport.ts";

import type { TransportAttempt, TransportPlan } from "../../domain/github-transport.ts";
import type { GitHubSource, UrlSource } from "../../domain/source.ts";
import type { ExtensionState } from "../../persistence/state-io.ts";
import type { GitAuthBundle, GitHubSshOps, GitOps } from "./shared.ts";

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

/** The two plans of a refresh: the freshness check's and the re-clone's. */
export type RefreshPlans = Pick<CloneSwapArgs, "freshness" | "reclone">;

/** The live checkout of a marketplace refresh, as `legacyCloneUrl` reads it. */
export interface RefreshCheckout {
  readonly liveDir: string;
  readonly gitOps: GitOps;
}

/**
 * OQ-5, D-PL5-04: the URL the checkout of a url record that names no git URL
 * was cloned from. An earlier version recorded a url marketplace under an
 * https URL ending in `.json`, which now reads as a hosted catalog, so only
 * the checkout's recorded `origin` says where its repository lives. Any other
 * source, and such a record whose checkout records no origin, gives undefined.
 */
async function legacyCloneUrl(
  source: GitHubSource | UrlSource,
  checkout: RefreshCheckout,
): Promise<string | undefined> {
  if (source.kind !== "url" || parsePluginSource(source.raw).kind !== "hosted") {
    return undefined;
  }

  const remotes = await checkout.gitOps.listRemotes({ dir: checkout.liveDir });
  if (remotes.kind !== "origin") {
    return undefined;
  }

  return remotes.url;
}

/**
 * SG-SSH-02, CONTEXT [Identity], OQ-5: the plans of a marketplace refresh of
 * `source`, which `marketplace update`, the autoupdate pass, and `plugin
 * update`'s marketplace sync (PUP-2) share. Each plan is the declared source's
 * (`planMarketplaceClone`), so an `owner/repo` source probes once for the
 * freshness list and once more for a re-clone, as Claude Code's refresh does
 * (CONTEXT [Probe]), and a url source lists and clones its clone URL alone;
 * the checkout's recorded origin picks no URL, except for the legacy url
 * record `legacyCloneUrl` names. Only a github source reads what forces HTTPS,
 * so a url refresh never reads the GitHub base (GHB-02).
 */
export function marketplaceRefreshPlans(
  source: GitHubSource | UrlSource,
  gitHubSsh: GitHubSshOps,
  checkout: RefreshCheckout,
): RefreshPlans {
  const plan = async (): Promise<TransportPlan> => {
    const legacy = await legacyCloneUrl(source, checkout);
    if (legacy !== undefined) {
      return oneAttemptPlan(legacy);
    }

    return planMarketplaceClone({
      source,
      force: source.kind === "github" ? transportForce(process.env) : undefined,
      probe: () => gitHubSsh.probe(),
    });
  };

  return { freshness: plan, reclone: plan };
}

/** One attempt of `url`, with no note, over the transport git uses for it. */
function oneAttemptPlan(url: string): TransportPlan {
  return { first: { transport: addressTransport(url), url }, after: noRetry };
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
  /**
   * SG-SSH-02, OQ-4: the plan the freshness `ls-remote` runs over, made only
   * when the check asks the remote, so a full-SHA ref or an unreadable `HEAD`
   * probes nothing. Each attempt runs in turn until one answers.
   */
  readonly freshness: () => Promise<TransportPlan>;
  /** SG-SSH-02: the plan the re-clone runs over, made only when a clone runs. */
  readonly reclone: () => Promise<TransportPlan>;
  /** D-SG-22: the collector the re-clone records its note into, under `subject`. */
  readonly notes?: GitHubCloneNotes;
  /** The subject of the row that reports the re-clone; the plan's first URL by default. */
  readonly subject?: string;
  /** The surface whose words a re-clone that fails over both transports uses. */
  readonly surface: GitHubTransportsFailedError["surface"];
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
 * D-SG-10: the freshness of the checkout. `unreachable` carries the last
 * attempt's `ls-remote` failure, and `rejected` the refused stored credential
 * of any attempt (GAUTH-04).
 */
type Freshness = { readonly kind: "current" } | { readonly kind: "stale" } | Unreachable;

/** D-SG-10: a freshness check that no attempt answered. */
interface Unreachable {
  readonly kind: "unreachable";
  readonly cause: unknown;
  readonly rejected?: StoredCredentialRejectedError;
}

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
 * host refused. Any other error, such as an invalid GitHub base, says nothing
 * about the remote and is thrown.
 */
function isUnreachable(err: unknown): boolean {
  if (err instanceof StoredCredentialRejectedError) {
    return true;
  }

  return err instanceof GitCommandError && !NOT_REMOTE_FAILURES.has(err.kind);
}

/**
 * SG-SSH-02: the auth bundle of one attempt. An HTTPS attempt carries the
 * refresh's bundle; an SSH attempt carries none, because no bundle answers an
 * ssh failure.
 */
function attemptAuth(
  args: CloneSwapArgs,
  attempt: TransportAttempt,
): { readonly auth?: GitAuthBundle } {
  return attempt.transport === "https" ? { auth: args.auth } : {};
}

/** What the freshness `ls-remote` over a plan found. */
type RemoteAnswer = { readonly kind: "answered"; readonly oid: string | undefined } | Unreachable;

/**
 * SG-SSH-02, OQ-4: `ls-remote` over `attempt`, then over each attempt the
 * plan gives after a failure, until one answers, as Claude Code's refresh
 * walks its URL list, with Claude Code's debug line for each fallback. A
 * failure that says nothing about the remote is thrown at once; when no
 * attempt answers, the last failure is the cause, and a refused stored
 * credential of any attempt is kept as `rejected` (GAUTH-04).
 */
async function listRemoteHead(
  args: CloneSwapArgs,
  plan: TransportPlan,
  attempt: TransportAttempt,
  rejected?: StoredCredentialRejectedError,
): Promise<RemoteAnswer> {
  try {
    const oid = await args.gitOps.resolveRemoteRef({
      url: attempt.url,
      ...(args.ref !== undefined && { ref: args.ref }),
      ...attemptAuth(args, attempt),
    });
    return { kind: "answered", oid };
  } catch (err) {
    if (!isUnreachable(err)) {
      throw err;
    }

    const refused = err instanceof StoredCredentialRejectedError ? err : rejected;
    const next = await plan.after(err, attempt);
    if (next === undefined) {
      return {
        kind: "unreachable",
        cause: err,
        ...(refused !== undefined && { rejected: refused }),
      };
    }

    hookDebugLog(
      `Marketplace refresh failed with ${GITHUB_TRANSPORT_LABELS[attempt.transport]} for ${redactCredentials(args.subject ?? plan.first.url)} (${debugMessage(err)}), falling back to ${GITHUB_TRANSPORT_LABELS[next.transport]}`,
      "git",
    );
    return listRemoteHead(args, plan, next, refused);
  }
}

// A failure's message for a debug line, with no credential and no absolute path.
function debugMessage(error: unknown): string {
  return redactCredentials(redactAbsolutePaths(errorMessage(error)));
}

/**
 * D-SG-10: the freshness of the checkout. A full-SHA ref compares with `HEAD`
 * and asks the remote nothing. Otherwise `ls-remote` over the freshness plan
 * gives the commit of `HEAD`, or of the ref as a branch, then a peeled tag,
 * then a tag; a ref the remote does not advertise, or an unreadable `HEAD`, is
 * stale, and a check that no attempt answered is unreachable.
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

  const plan = await args.freshness();
  const answer = await listRemoteHead(args, plan, plan.first);
  if (answer.kind === "unreachable") {
    return answer;
  }

  return answer.oid === local ? CURRENT : STALE;
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
 * The failure a refresh whose re-clone failed with `cloneFailure` throws.
 * After an unreachable check the clone fails the same way, so the check's
 * failure is thrown: it names the cause before git's own credential helpers
 * acted on it, and a stored credential the host refused in any attempt is
 * thrown first (GAUTH-04). A re-clone that failed over both transports throws
 * its own error, which names both attempts, as Claude Code's refresh does
 * (D-SG-22, OQ-8, upstream `wqo`).
 */
function refreshFailure(freshness: Freshness, cloneFailure: unknown): unknown {
  if (freshness.kind !== "unreachable") {
    return cloneFailure;
  }

  if (freshness.rejected !== undefined) {
    return freshness.rejected;
  }

  return cloneFailure instanceof GitHubTransportsFailedError ? cloneFailure : freshness.cause;
}

/**
 * D-SG-10 / MA-12: clone into the staging directory over the re-clone plan
 * and mark it as this extension's own. SG-SSH-02: the staging directory is
 * removed before the plan's next attempt, so each attempt starts with none
 * (NFR-1), and the plan's note goes to `notes` under `subject`. A failed clone
 * removes the staging directory and leaves the live checkout untouched (MA-9:
 * a leak is appended, not masked). `refreshFailure` picks what is thrown.
 */
async function cloneIntoStaging(args: CloneSwapArgs, freshness: Freshness): Promise<string> {
  const { stagingDir, removalOps } = args;
  try {
    const plan = await args.reclone();
    await cloneOverGitHubTransports({
      plan,
      attempt: (attempt) =>
        args.gitOps.clone({
          dir: stagingDir,
          url: attempt.url,
          ...(args.ref !== undefined && { ref: args.ref, singleBranch: true }),
          ...attemptAuth(args, attempt),
        }),
      beforeRetry: () => removalOps.rm(stagingDir, { recursive: true, force: true }),
      notes: args.notes ?? createGitHubCloneNotes(),
      // The notes key, kept raw (D-SG-22); each debug line redacts it (D-SG-35).
      subject: args.subject ?? plan.first.url,
      surface: args.surface,
    });
    if (args.ownershipMarker) {
      await writeOwnershipMarker(stagingDir);
    }

    return stagingDir;
  } catch (err) {
    const failure = refreshFailure(freshness, err);
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
 * D-SG-10: refresh the checkout at `liveDir` over its plans. An interrupted swap
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

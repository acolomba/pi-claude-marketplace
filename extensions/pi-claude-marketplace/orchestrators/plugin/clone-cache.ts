// orchestrators/plugin/clone-cache.ts
//
// PURL-02 / PURL-04 / D-77-03..06: the plugin clone-cache seam.
//
// install.ts is forbidden the git surface by the `no-orchestrator-network`
// architecture gate (NFR-5). The clone lives HERE, in a sibling seam install
// calls by name; this file imports DEFAULT_GIT_OPS from marketplace/shared.ts
// (the same re-export update.ts uses) and is legally allowed the git surface
// (NOT in the gate's forbidden list).
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
import { mkdir, rename } from "node:fs/promises";
import path from "node:path";

import { canonicalCloneUrl, pluginCloneKey, pluginMirrorKey } from "../../domain/clone-key.ts";
import { appendLeakToError, errorMessage } from "../../shared/errors.ts";
import { cleanupStaging, pathExists } from "../../shared/fs-utils.ts";
import {
  DEFAULT_GIT_OPS,
  refreshGitHubClone,
  type GitAuthBundle,
  type GitOps,
} from "../marketplace/shared.ts";

import type { GitHubSource, GitSubdirSource, UrlSource } from "../../domain/source.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";

/**
 * Recognize isomorphic-git's `CommitNotFetchedError` without importing the
 * library into the orchestrator tier (D-13). The class sets both `name` and
 * `code` to the string `"CommitNotFetchedError"` (see
 * `node_modules/isomorphic-git` `index.cjs` --
 * `CommitNotFetchedError.code = 'CommitNotFetchedError'` and
 * `this.code = this.name = CommitNotFetchedError.code`); `checkout` throws it
 * when the target commit's objects are absent locally. Matching on the name
 * keeps the isomorphic-git boundary in `platform/git.ts` intact (mirrors
 * `shared.ts::isGitNotFoundError`).
 */
function isGitCommitNotFetchedError(err: unknown): boolean {
  return err instanceof Error && err.name === "CommitNotFetchedError";
}

/**
 * PURL-02 / PURL-04: materialize a plugin clone at the exact pin into
 * `plugin-clones/<key>/`, returning the clone root.
 *
 * Flow:
 *   1. key = pluginCloneKey(cloneUrl, pin); cloneRoot = pluginCloneDir(key).
 *   2. Warm-cache short-circuit: if cloneRoot exists, return it -- NO clone,
 *      NO network (PURL-02 offline / PURL-04 dedup).
 *   3. Clone into a staging dir (ref-hint singleBranch fetch when a ref is
 *      given), then checkout the exact `pin` (sha over ref). When the pin is
 *      outside the ref hint's history the singleBranch fetch never pulled the
 *      pinned commit, so the checkout throws `CommitNotFetchedError`; the
 *      clone left a wildcard fetch refspec, so one full fetch widens the
 *      staging clone to every head and the checkout is retried ONCE. A
 *      genuinely unreachable pin throws the same class on the retry and folds
 *      into the fail-clean path. A clone/checkout throw cleans staging and
 *      append-leak-rethrows (MA-9).
 *   4. Atomic same-FS rename staging -> cloneRoot. An EEXIST/ENOTEMPTY rename
 *      means a concurrent install of the same url+sha already won the race;
 *      its tree is byte-equivalent (same key => same content), so clean our
 *      staging and return cloneRoot as a warm-cache win. Any other rename
 *      errno append-leak-rethrows (MA-9).
 *
 * `auth` is an optional bundle forwarded to `gitOps.clone`. When omitted the
 * clone is byte-identical to the public-only path (PROV-02); when present the
 * provider's credentials thread into the clone so a private source on a
 * registered host authenticates (PROV-03/D-79-01).
 */
export async function materializePluginClone(args: {
  locations: ScopedLocations;
  cloneUrl: string;
  pin: string;
  ref?: string;
  gitOps?: GitOps;
  auth?: GitAuthBundle;
}): Promise<string> {
  const gitOps = args.gitOps ?? DEFAULT_GIT_OPS;
  const key = pluginCloneKey(args.cloneUrl, args.pin);
  const cloneRoot = await args.locations.pluginCloneDir(key);

  // PURL-02 / PURL-04: a present key dir is a byte-equivalent warm cache.
  if (await pathExists(cloneRoot)) {
    return cloneRoot;
  }

  const stagingDir = await args.locations.sourcesStagingDir(randomUUID());

  // Clone the ref-hint (or default branch), then checkout the exact pin so the
  // recorded commit is the pin even when a moving tag/branch ref is given.
  try {
    await gitOps.clone({
      dir: stagingDir,
      url: args.cloneUrl,
      ...(args.ref !== undefined && { ref: args.ref, singleBranch: true }),
      ...(args.auth !== undefined && { auth: args.auth }),
    });
    try {
      await gitOps.checkout({ dir: stagingDir, ref: args.pin });
    } catch (checkoutErr) {
      // PURL-04: a singleBranch ref-hint clone fetches only the ref's closure.
      // When the pinned sha moved ahead of a stale ref hint it sits outside
      // that closure, so checkout throws CommitNotFetchedError. The recovery
      // only applies after a ref-hint clone -- a no-ref clone already fetched
      // every head, so a CommitNotFetchedError there is a genuinely unreachable
      // sha that must fail clean. The clone left the wildcard fetch refspec, so
      // one full fetch (no ref) pulls every head; the pinned commit is then
      // present and the checkout retry succeeds. A still-unreachable sha throws
      // the same class on the retry and falls through to the fail-clean fold.
      if (args.ref === undefined || !isGitCommitNotFetchedError(checkoutErr)) {
        throw checkoutErr;
      }

      await gitOps.fetch({
        dir: stagingDir,
        remote: "origin",
        ...(args.auth !== undefined && { auth: args.auth }),
      });
      await gitOps.checkout({ dir: stagingDir, ref: args.pin });
    }
  } catch (err) {
    const leak = await cleanupStaging(stagingDir, "plugin clone staging");
    throw appendLeakToError(err, leak);
  }

  // Atomic rename (same FS: sources-staging/ and plugin-clones/ are siblings
  // under extensionRoot).
  try {
    await mkdir(path.dirname(cloneRoot), { recursive: true });
    await rename(stagingDir, cloneRoot);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "EEXIST" || code === "ENOTEMPTY") {
      // A concurrent install of the same url+sha won the race. Its tree is
      // byte-equivalent, so clean our staging and treat cloneRoot as a warm
      // cache win -- no rethrow.
      await cleanupStaging(stagingDir, "plugin clone staging");
      return cloneRoot;
    }

    // Any other rename failure is real: append-leak-rethrow (MA-9).
    const leak = await cleanupStaging(stagingDir, "plugin clone staging");
    const wrapped = appendLeakToError(err, leak);
    throw wrapped instanceof Error ? wrapped : new Error(errorMessage(wrapped));
  }

  return cloneRoot;
}

/**
 * MIRR-01/02/03 / D-79.1-01/02: materialize-or-refresh the single mutable
 * mirror clone for an UNPINNED git plugin source at `plugin-clones/<urlhash12>/`
 * (bare URL key, no sha suffix), returning the mirror root + the checked-out
 * HEAD sha.
 *
 * This is the marketplace clone lifecycle applied to a URL-keyed directory
 * (D-79.1-01): one mirror per canonical URL, refreshed in place on mutating
 * verbs, so multi-clone ambiguity is impossible by construction.
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
 *   3. After the dir exists (freshly materialized OR already present), refresh
 *      it in place via `refreshGitHubClone` -- fetch + force-update ref +
 *      checkout, the SAME function marketplace update uses. A just-materialized
 *      clone is also refreshed: that is the intended marketplace parity
 *      (refresh-on-warm, D-79.1-02). Reads (list/info) never call this seam, so
 *      NFR-5 is untouched.
 *   4. Read the pin: resolvedSha = resolveRef({ dir: mirrorRoot, ref: "HEAD" }).
 *
 * `auth` threads into the clone and the refresh fetch identically to
 * `materializePluginClone` (no mirror-specific auth path). Derive-not-persist:
 * mirror-dir existence IS the fetched-state -- no migration stamp, no refcount.
 * All git surface (refreshGitHubClone, gitOps, resolveRef, DEFAULT_GIT_OPS)
 * stays confined to this file, never surfaced to install/list/info.
 */
export async function materializeOrRefreshPluginMirror(args: {
  locations: ScopedLocations;
  cloneUrl: string;
  ref?: string;
  gitOps?: GitOps;
  auth?: GitAuthBundle;
}): Promise<{ pluginRoot: string; resolvedSha: string }> {
  const gitOps = args.gitOps ?? DEFAULT_GIT_OPS;
  const mirrorRoot = await args.locations.pluginCloneDir(pluginMirrorKey(args.cloneUrl));

  // MIRR-01: materialize the mirror on a cold key (no fixed-pin checkout; the
  // mirror tracks a moving ref).
  if (!(await pathExists(mirrorRoot))) {
    const stagingDir = await args.locations.sourcesStagingDir(randomUUID());

    try {
      await gitOps.clone({
        dir: stagingDir,
        url: args.cloneUrl,
        ...(args.ref !== undefined && { ref: args.ref, singleBranch: true }),
        ...(args.auth !== undefined && { auth: args.auth }),
      });
    } catch (err) {
      const leak = await cleanupStaging(stagingDir, "plugin mirror staging");
      throw appendLeakToError(err, leak);
    }

    // Atomic rename (same FS: sources-staging/ and plugin-clones/ are siblings
    // under extensionRoot).
    try {
      await mkdir(path.dirname(mirrorRoot), { recursive: true });
      await rename(stagingDir, mirrorRoot);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "EEXIST" || code === "ENOTEMPTY") {
        // MIRR-03 / D-79.1-03: a concurrent create won the race. Its tree is
        // byte-equivalent, so clean our staging and fall through to the refresh
        // path -- the winner's tree still needs an in-place refresh + HEAD read.
        await cleanupStaging(stagingDir, "plugin mirror staging");
      } else {
        // Any other rename failure is real: append-leak-rethrow (MA-9).
        const leak = await cleanupStaging(stagingDir, "plugin mirror staging");
        const wrapped = appendLeakToError(err, leak);
        throw wrapped instanceof Error ? wrapped : new Error(errorMessage(wrapped));
      }
    }
  }

  // MIRR-02 / D-79.1-02: refresh the mirror in place (marketplace parity). A
  // just-materialized clone is refreshed too -- refresh-on-warm. The HEAD sha
  // read below is the fetched-state; no separate advance flag is consumed here.
  await refreshGitHubClone(mirrorRoot, args.ref, gitOps, undefined, args.auth);

  const resolvedSha = await gitOps.resolveRef({ dir: mirrorRoot, ref: "HEAD" });
  return { pluginRoot: mirrorRoot, resolvedSha };
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

  // PROV-03 (Q1): forward the optional auth bundle into resolveRemoteRef so an
  // unpinned PRIVATE-repo HEAD resolution authenticates; a pinned sha never
  // touches the network so no auth is needed there.
  let pin: string;
  if (source.sha !== undefined) {
    pin = source.sha;
  } else if (source.ref !== undefined) {
    pin = await gitOps.resolveRemoteRef({
      url: cloneUrl,
      ref: source.ref,
      ...(auth !== undefined && { auth }),
    });
  } else {
    pin = await gitOps.resolveRemoteRef({
      url: cloneUrl,
      ...(auth !== undefined && { auth }),
    });
  }

  return source.ref === undefined ? { cloneUrl, pin } : { cloneUrl, pin, ref: source.ref };
}

// PURL-03 / NFR-10 / D-77-03: `resolveGitSubdirRoot` now lives in shared/fs-utils.ts
// so the network-free presence probe can share it without pulling this seam's git
// surface. Re-exported here under the same name to keep install / update / reinstall
// import sites unbroken.
export { resolveGitSubdirRoot } from "../../shared/fs-utils.ts";

// D-77-06 / PURL-07: `canonicalCloneUrl` now lives in domain/clone-key.ts (the
// module that owns both key halves and the clone-key identity invariant) so
// the git seam and the fs-only presence probe share ONE url reconstruction.
// Re-exported here under the same name to keep install / update / reinstall /
// fetch import sites unbroken.
export { canonicalCloneUrl } from "../../domain/clone-key.ts";

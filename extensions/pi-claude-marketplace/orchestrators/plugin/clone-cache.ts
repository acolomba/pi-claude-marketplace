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
import { cp, mkdir, readFile, rename } from "node:fs/promises";
import path from "node:path";

import { canonicalCloneUrl, pluginCloneKey, pluginMirrorKey } from "../../domain/clone-key.ts";
import { loadMarketplaceManifest } from "../../domain/manifest.ts";
import { parsePluginSource } from "../../domain/source.ts";
import { loadState } from "../../persistence/state-io.ts";
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
  // Copy the working tree AND `.git`, so the seeded mirror's origin remote is
  // the real remote URL (SEED-05), never the local checkout path. `cp` is
  // cross-FS safe; the visible mirror still appears only via the atomic rename.
  await cp(marketplaceRoot, staging, { recursive: true });

  // SEED-04: a pinned source is seeded ONLY after its sha checks out against the
  // copied history -- a successful checkout IS the reachability proof. An
  // unreachable pin (CommitNotFetchedError, or any throw) is skipped so the
  // normal network path materializes it later; never fabricate an immutable
  // per-sha entry from non-matching content.
  if (source.sha !== undefined) {
    try {
      await gitOps.checkout({ dir: staging, ref: source.sha });
    } catch {
      await cleanupStaging(staging, "plugin mirror seed staging");
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
    await cleanupStaging(staging, "plugin mirror seed staging");
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
  const { locations, marketplaceName } = args;

  const state = await loadState(locations.extensionRoot);
  const mp = state.marketplaces[marketplaceName];
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
      await seedOnePluginMirror(locations, gitOps, src, marketplaceUrl, mp.marketplaceRoot);
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

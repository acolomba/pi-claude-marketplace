// orchestrators/marketplace/add.ts
//
// MA-1..6, MA-8..11 (MA-7 superseded by Phase 1 D-21 -- isomorphic-git
// eliminates the "git not found on PATH" failure mode entirely).
//
// Flow (D-04 outer guard wraps the ENTIRE flow including network IO):
//
//   parsePluginSource(rawSource) -> path | github | unknown
//   if unknown: throw new Error(parsed.reason)  // MA-10
//
//   withStateGuard(locations, async (state) => {
//     if (github):
//       MA-6  stale-clone check on final sources/<derivedName>/  (BEFORE clone)
//       MA-8  duplicate-name check on state.marketplaces[<derivedName>]
//       gitOps.clone(stagingDir)                            // network -- gated by NFR-5
//       read + MARKETPLACE_VALIDATOR.Check(<staging>/.claude-plugin/marketplace.json)
//       fs.rename(stagingDir, finalDir)                     // atomic, same-FS by D-09
//       state.marketplaces[derivedName] = { ... }
//
//     if (path):
//       resolve manifest path on disk per MA-3
//       read + MARKETPLACE_VALIDATOR.Check(manifest.json)
//       MA-8 duplicate-name check on state.marketplaces[<derivedName>]
//       state.marketplaces[derivedName] = { ... }            // NFR-5: NO gitOps calls
//   })
//
//   // Phase 18 / Plan 18-01: success notification is a single V2
//   //   notify(opts.ctx, opts.pi, { marketplaces: [{ status: "added", ... }] })
//   // call. Both github and path source kinds collapse to the same V2
//   // payload (the V1 `<autoupdate>` marker has moved off the (added) arm
//   // onto the list-surface header per D-17.1-01 / D-18-04). The
//   // `/reload to pick up changes` trailer is computed by `notify()` per
//  (mp.status `"added"` is state-changing); callers MUST NOT
//   // append it. See the construction recipe block-comment above the
//   // notify() call site for the full Wave 2 mirror template.
//
// V1 carry-forward shape only (D-09 staging dir, D-12 GitOps injection,
// D-14 follow-upstream-blindly all supersede V1 specifics).
//
// WR-05 trade-off note: the MA-8 duplicate-name check for github sources
// runs AFTER the clone fills `stagingDir`. We accept the cost of one
// wasted network clone per duplicate-name attempt because the marketplace
// name is derived from the manifest's `name` field -- which only exists
// inside the cloned tree. Resolving without cloning would require a
// raw.githubusercontent.com manifest probe that bypasses the GitOps
// surface (and the D-12/D-13 layering rules); the current cost is
// considered acceptable per design.

import { randomUUID } from "node:crypto";
import { mkdir, rename, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { loadMarketplaceManifest } from "../../domain/manifest.ts";
import { parsePluginSource } from "../../domain/source.ts";
import { locationsFor } from "../../persistence/locations.ts";
import { dropMarketplaceCache, invalidateMarketplaceNames } from "../../shared/completion-cache.ts";
import {
  MarketplaceDuplicateNameError,
  StaleSourceCloneError,
  appendLeakToError,
  errorMessage,
} from "../../shared/errors.ts";
import { cleanupStaging, pathExists } from "../../shared/fs-utils.ts";
import { notify } from "../../shared/notify.ts";
import { withStateGuard } from "../../transaction/with-state-guard.ts";

import { DEFAULT_GIT_OPS, type GitOps } from "./shared.ts";

import type { GitHubSource, PathSource } from "../../domain/source.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { ExtensionState } from "../../persistence/state-io.ts";
import type { ExtensionAPI, ExtensionContext } from "../../platform/pi-api.ts";
import type { Scope } from "../../shared/types.ts";

export interface AddMarketplaceOptions {
  readonly ctx: ExtensionContext;
  /**
   * Required by `notify(ctx, pi, message)` for soft-dep probing.
   */
  readonly pi: ExtensionAPI;
  /** SC-5: edge layer (Phase 6) defaults this to "user"; orchestrator receives a fully resolved Scope. */
  readonly scope: Scope;
  /** Used to compute project-scope locations (`<cwd>/.pi`). Ignored when scope === "user". */
  readonly cwd: string;
  /** The user-supplied source string (`owner/repo`, `https://...`, `~/path`, `./path`, etc.). */
  readonly rawSource: string;
  /** D-12 injection seam. Defaults to DEFAULT_GIT_OPS (which wraps platform/git.ts). */
  readonly gitOps?: GitOps;
}

export async function addMarketplace(opts: AddMarketplaceOptions): Promise<void> {
  const gitOps = opts.gitOps ?? DEFAULT_GIT_OPS;
  const locations = locationsFor(opts.scope, opts.cwd);
  const source = parsePluginSource(opts.rawSource);

  // MA-10: parser produced an unknown kind with a reason -- surface verbatim.
  if (source.kind === "unknown") {
    throw new Error(`Cannot add marketplace from "${opts.rawSource}": ${source.reason}`);
  }

  if (source.kind !== "github" && source.kind !== "path") {
    throw new Error(
      `Cannot add marketplace from "${opts.rawSource}": unsupported source kind ${source.kind}`,
    );
  }

  let recordedName: string | undefined;
  await withStateGuard(locations, async (state) => {
    if (source.kind === "github") {
      recordedName = await addGithubInGuard({
        state,
        locations,
        source,
        gitOps,
        cwd: opts.cwd,
      });
    } else {
      recordedName = await addPathInGuard({
        state,
        locations,
        source,
        cwd: opts.cwd,
      });
    }
  });

  if (recordedName === undefined) {
    // Defensive: the guard always sets it on success.
    throw new Error("addMarketplace: internal error -- guard returned without recording a name");
  }

  // D-03-INV (Plan 06-05): post-state-commit completion-cache invalidation.
  // The marketplace-names cache for this scope and the plugin index for the
  // newly recorded marketplace are both stale-by-construction. Cache cleanup
  // runs after the state commit so a cache hiccup never rolls back the user's
  // primary success.
  try {
    await invalidateMarketplaceNames(locations.marketplaceNamesCacheFile, opts.scope);
    await dropMarketplaceCache(
      await locations.pluginCacheFile(recordedName),
      opts.scope,
      recordedName,
    );
  } catch {
    // Cache-refresh failures are swallowed: there is no clean notification
    // shape for "cache failure after a successful state mutation" and
    // emitting a second notify() would double severity routing. The state
    // mutation already succeeded; only the completion-cache is stale.
  }

  // Emit one MarketplaceNotificationMessage per outcome. Severity and
  // reload-hint are computed by notify(); callers MUST NOT compose them.
  // Catalog: `path-source` + `github-source` fixtures in catalog-uat.test.ts.
  notify(opts.ctx, opts.pi, {
    marketplaces: [
      {
        name: recordedName,
        scope: opts.scope,
        status: "added",
        plugins: [],
      },
    ],
  });
}

async function addGithubInGuard(args: {
  state: ExtensionState;
  locations: ScopedLocations;
  source: GitHubSource;
  gitOps: GitOps;
  cwd: string;
}): Promise<string> {
  const { state, locations, source, gitOps, cwd } = args;
  const stagingDir = await locations.sourcesStagingDir(randomUUID());
  const cloneUrl = `https://github.com/${source.owner}/${source.repo}.git`;

  // 1. Clone into staging (NFR-5: only github branch reaches gitOps.clone).
  try {
    await gitOps.clone({
      dir: stagingDir,
      url: cloneUrl,
      ...(source.ref !== undefined && { ref: source.ref, singleBranch: true }),
    });
  } catch (err) {
    // Clone itself failed -- there is no staging dir to clean up beyond a
    // potentially partial mkdir. cleanupStaging is ENOENT-tolerant.
    const leak = await cleanupStaging(stagingDir, "marketplace clone staging");
    throw appendLeakToError(err, leak);
  }

  let stagedAtFinal = false;
  let finalDir: string | undefined;
  try {
    // 2. Read + validate manifest.
    const manifestPath = path.join(stagingDir, ".claude-plugin", "marketplace.json");
    const parsed = await loadMarketplaceManifest(manifestPath);

    const derivedName = (parsed as { name: string }).name;

    // 3. MA-8: duplicate name in this scope.
    if (derivedName in state.marketplaces) {
      throw new MarketplaceDuplicateNameError(derivedName, locations.scope);
    }

    // 4. MA-6: stale-clone refusal on the final destination.
    finalDir = await locations.sourceCloneDir(derivedName);
    if (await pathExists(finalDir)) {
      throw new StaleSourceCloneError(finalDir);
    }

    // 5. Atomic rename -- same FS by D-09 (sources-staging/ and sources/
    //    are siblings under extensionRoot). Ensure the parent (sources/)
    //    exists; on a fresh scope it has not been created yet.
    await mkdir(path.dirname(finalDir), { recursive: true });
    await rename(stagingDir, finalDir);
    stagedAtFinal = true;

    // 6. Mutate state.
    state.marketplaces[derivedName] = {
      name: derivedName,
      scope: locations.scope,
      source,
      addedFromCwd: cwd,
      manifestPath: path.join(finalDir, ".claude-plugin", "marketplace.json"),
      marketplaceRoot: finalDir,
      lastUpdatedAt: new Date().toISOString(),
      plugins: {},
    };
    return derivedName;
  } catch (err) {
    // MA-9: append leaks rather than mask original error.
    let wrapped: unknown = err;
    if (!stagedAtFinal) {
      const leak = await cleanupStaging(stagingDir, "marketplace clone staging");
      wrapped = appendLeakToError(wrapped, leak);
    } else if (finalDir !== undefined) {
      const leak = await cleanupStaging(finalDir, `marketplace final clone ${finalDir}`);
      wrapped = appendLeakToError(wrapped, leak);
    }

    throw wrapped instanceof Error ? wrapped : new Error(errorMessage(wrapped));
  }
}

async function addPathInGuard(args: {
  state: ExtensionState;
  locations: ScopedLocations;
  source: PathSource;
  cwd: string;
}): Promise<string> {
  const { state, locations, source, cwd } = args;

  // MA-3: source.resolved may point at a directory OR directly at a
  // marketplace.json file. Probe and dispatch.
  //
  // Note: domain/source.ts PathSource currently exposes `raw` and `logical`
  // (no `resolved` field yet -- the resolved-path layer is deferred to
  // Phase 4 location/index helpers). We use `source.logical` here since
  // it equals `raw` verbatim (SP-7) and is the on-disk lookup key for
  // path-source `add`.
  //
  // CR-02 (SP-7 / MA-4): Node's fs APIs do NOT perform shell tilde
  // expansion -- stat("~/...") returns ENOENT against a literal "~"
  // directory. Expand "~" and "~/..." against os.homedir() before
  // probing on disk. The stored `source.raw` keeps the verbatim "~"
  // form (SP-7); only the on-disk lookup is rewritten.
  const onDiskPath = expandTildePath(source.logical);
  const probe = await stat(onDiskPath);
  let manifestPath: string;
  let marketplaceRoot: string;
  if (probe.isDirectory()) {
    marketplaceRoot = onDiskPath;
    manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
  } else if (probe.isFile()) {
    manifestPath = onDiskPath;
    // Walk up two levels: <root>/.claude-plugin/marketplace.json -> <root>
    marketplaceRoot = path.dirname(path.dirname(manifestPath));
  } else {
    throw new Error(`Local marketplace path is neither a file nor a directory: ${onDiskPath}`);
  }

  // Read + validate manifest.
  const parsed = await loadMarketplaceManifest(manifestPath);

  const derivedName = (parsed as { name: string }).name;

  // MA-8: duplicate name in scope.
  if (derivedName in state.marketplaces) {
    throw new MarketplaceDuplicateNameError(derivedName, locations.scope);
  }

  // MA-4: source already preserves the user-typed `~` verbatim
  // (ParsedSource.raw) via pathSource() factory. We store the parsed
  // source object directly -- ST-6 funnel re-validates on next load.
  state.marketplaces[derivedName] = {
    name: derivedName,
    scope: locations.scope,
    source,
    addedFromCwd: cwd,
    manifestPath,
    marketplaceRoot,
    lastUpdatedAt: new Date().toISOString(),
    plugins: {},
  };
  return derivedName;
}

function expandTildePath(sourcePath: string): string {
  if (sourcePath === "~") {
    return os.homedir();
  }

  return sourcePath.startsWith("~/") ? path.join(os.homedir(), sourcePath.slice(2)) : sourcePath;
}

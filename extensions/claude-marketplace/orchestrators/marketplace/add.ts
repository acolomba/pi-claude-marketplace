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
//   notifySuccess(ctx, `Added marketplace "<name>" in <scope> scope.`)
//   // MA-11: NO reload hint here (add never stages resources).
//
// V1 carry-forward shape only (D-09 staging dir, D-12 GitOps injection,
// D-14 follow-upstream-blindly all supersede V1 specifics).

import { randomUUID } from "node:crypto";
import { readFile, rename, stat } from "node:fs/promises";
import path from "node:path";

import { MARKETPLACE_VALIDATOR } from "../../domain/manifest.ts";
import { parsePluginSource } from "../../domain/source.ts";
import { locationsFor } from "../../persistence/locations.ts";
import {
  MarketplaceDuplicateNameError,
  StaleSourceCloneError,
  appendLeakToError,
  errorMessage,
} from "../../shared/errors.ts";
import { cleanupStaging, pathExists } from "../../shared/fs-utils.ts";
import { notifySuccess } from "../../shared/notify.ts";
import { withStateGuard } from "../../transaction/with-state-guard.ts";

import { DEFAULT_GIT_OPS, type GitOps } from "./shared.ts";

import type { GitHubSource, PathSource } from "../../domain/source.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { ExtensionState } from "../../persistence/state-io.ts";
import type { Scope } from "../../shared/types.ts";
import type { ExtensionContext } from "@mariozechner/pi-coding-agent";

export interface AddMarketplaceOptions {
  readonly ctx: ExtensionContext;
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

  // MA-11: success -- exact stable string, NO reload hint.
  notifySuccess(opts.ctx, `Added marketplace "${recordedName}" in ${opts.scope} scope.`);
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
    const text = await readFile(manifestPath, "utf8");
    const parsed: unknown = JSON.parse(text);
    if (!MARKETPLACE_VALIDATOR.Check(parsed)) {
      throw new Error(`Cloned marketplace manifest at ${manifestPath} failed schema validation`);
    }

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
    //    are siblings under extensionRoot).
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
  // path-source `add`. Tests pass already-expanded absolute paths.
  const onDiskPath = source.logical;
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
  const text = await readFile(manifestPath, "utf8");
  const parsed: unknown = JSON.parse(text);
  if (!MARKETPLACE_VALIDATOR.Check(parsed)) {
    throw new Error(`Local marketplace manifest at ${manifestPath} failed schema validation`);
  }

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

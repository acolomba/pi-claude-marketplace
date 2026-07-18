// extensions/pi-claude-marketplace/orchestrators/plugin/git-source-probe.ts
//
// PURL-08 / D-78-03 / D-78-04 / NFR-5: the SHARED git-source probe module,
// colocated with `plugin-state-classifier.ts`. Both the `list` orchestrator
// (`availableRowMessage` / `installedRowMessage`) and the completion bucketizer
// (`orchestrators/edge-deps.ts::loadManifestForMarketplace`) consume THESE
// helpers so their status buckets never diverge on the same manifest (the
// divergence class where install completion classifies a git-source entry
// `unavailable` while `list` renders it `(available)`).
//
// The module is fs-only. It imports `pathExists` + `locations.pluginCloneDir`
// plus the pure `pluginCloneKey` / `parsePluginSource` / `resolveStrict` domain
// helpers -- it carries no clone-materializing git seam and never spawns git --
// so `edge-deps.ts` can consume it while the no-orchestrator-network gate
// (NFR-5) stays green.

import { readFile } from "node:fs/promises";
import path from "node:path";

import { canonicalCloneUrl, pluginCloneKey, pluginMirrorKey } from "../../domain/clone-key.ts";
import {
  resolveStrict,
  type GitPluginRootResult,
  type ResolveContext,
  type ResolvedPlugin,
} from "../../domain/resolver.ts";
import {
  parsePluginSource,
  type GitHubSource,
  type GitSubdirSource,
  type UrlSource,
} from "../../domain/source.ts";
import { type ScopedLocations } from "../../persistence/locations.ts";
import { pathExists, resolveGitSubdirRoot } from "../../shared/fs-utils.ts";

import {
  classifyManifestEntry,
  type ManifestEntryClassification,
} from "./plugin-state-classifier.ts";

import type { MarketplaceManifest } from "../../domain/manifest.ts";

type ManifestEntry = MarketplaceManifest["plugins"][number];

/**
 * MIRR-05 / A1: read a git mirror's checked-out HEAD sha fs-only, matching the
 * on-disk ref layout the clone seam writes. Reads `<mirrorDir>/.git/HEAD`:
 *   - A symbolic ref (`ref: refs/heads/<b>`) resolves from the loose ref file
 *     `<mirrorDir>/.git/refs/heads/<b>` when present, else from
 *     `<mirrorDir>/.git/packed-refs` (the packed layout after a repack).
 *   - A detached HEAD (a bare 40-hex sha, no `ref:` prefix) returns directly.
 *
 * Uses only `node:fs/promises` readFile -- it NEVER spawns git nor imports the
 * git seam, so read surfaces (list / completion) stay network-free (NFR-5).
 */
export async function readMirrorHeadSha(mirrorDir: string): Promise<string> {
  const gitDir = path.join(mirrorDir, ".git");
  const head = (await readFile(path.join(gitDir, "HEAD"), "utf8")).trim();

  if (!head.startsWith("ref: ")) {
    // Detached HEAD -- the sha is written directly.
    return head;
  }

  const refPath = head.slice("ref: ".length).trim();
  try {
    return (await readFile(path.join(gitDir, refPath), "utf8")).trim();
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      throw err;
    }
  }

  // The loose ref is absent -- the sha lives in packed-refs. Each entry is
  // `<sha> <refPath>`; skip `#` comment lines and `^` peeled-tag lines.
  const packed = await readFile(path.join(gitDir, "packed-refs"), "utf8");
  for (const line of packed.split("\n")) {
    if (line.startsWith("#") || line.startsWith("^")) {
      continue;
    }

    const [sha, name] = line.split(/\s+/);
    if (name === refPath && sha !== undefined) {
      return sha;
    }
  }

  throw new Error(`mirror HEAD ref "${refPath}" resolved to no sha in ${mirrorDir}`);
}

/**
 * PURL-08 / D-78-04 / NFR-5: an fs-only cache-PRESENCE probe for the resolver's
 * `resolveGitPluginRoot` seam. Unlike install's clone-materializing probe, this
 * one NEVER clones and NEVER touches the network -- it reconstructs the clone
 * cache key from the git source's canonical url + pinned sha and returns
 * `materialized` iff the clone dir already exists on disk, else `not-cached`.
 *
 * A `not-cached` result on an upgradable candidate degrades to the plain
 * `(upgradable)` row (identical to the undefined-candidate arm), so a cold
 * cache never regresses an installed git plugin to `(unavailable)` (D-78-04).
 *
 * MIRR-05 / D-79.1-02: an unpinned source (no `sha`) derives its fetched-state
 * from the URL-keyed mirror dir presence, fs-only. A warm mirror resolves
 * `materialized` with the sha read from its checked-out HEAD; a cold one
 * resolves `not-cached`. The probe reads the warm mirror but NEVER refreshes it
 * (read surfaces are network-free), so the pinned and unpinned arms both stay
 * offline.
 *
 * PURL-03 / NFR-10 / D-77-03: a `git-subdir` source anchors its pluginRoot under
 * the clone root via the shared containment helper, at parity with install's
 * clone-cache callback. Whole-repo url / github sources materialize at the clone
 * root itself; a git-subdir whose declared path escapes / is absent folds to the
 * probe's `escapes` / `missing-subdir` arms (resolver -> `unavailable`), never a
 * leaked monorepo-root pluginRoot. This keeps the fs-only classification honest
 * for the dominant claude-plugins-official source kind.
 */
export function makePresenceProbe(
  locations: ScopedLocations,
): (source: UrlSource | GitSubdirSource | GitHubSource) => Promise<GitPluginRootResult> {
  // PURL-03 / NFR-10 / D-77-03: apply the git-subdir containment tail to a
  // materialized clone/mirror root and stamp the resolved sha. A git-subdir
  // pluginRoot resolves under the clone root (escapes / missing-subdir arms
  // propagate unchanged); other kinds materialize at the clone root itself. The
  // subdir join shares the clone's commit, so `resolvedSha` is unchanged.
  const anchorSubdir = async (
    source: UrlSource | GitSubdirSource | GitHubSource,
    cloneDir: string,
    resolvedSha: string,
  ): Promise<GitPluginRootResult> => {
    if (source.kind === "git-subdir") {
      const subdirResult = await resolveGitSubdirRoot(cloneDir, source.path);
      if (subdirResult.kind !== "materialized") {
        return subdirResult;
      }

      return { kind: "materialized", pluginRoot: subdirResult.pluginRoot, resolvedSha };
    }

    return { kind: "materialized", pluginRoot: cloneDir, resolvedSha };
  };

  return async (source): Promise<GitPluginRootResult> => {
    // D-77-06: the canonical clone url the cache key is hashed over -- the
    // SAME shared `canonicalCloneUrl` the clone seam keys with (imported from
    // domain/clone-key.ts, not the git seam), so pinned clones and presence
    // probes always address the same directory.
    const cloneUrl = canonicalCloneUrl(source);

    // MIRR-05 / D-79.1-02: an unpinned source derives fetched-state from the
    // URL-keyed mirror dir presence, fs-only. A warm mirror -> materialized with
    // the HEAD sha read off disk; a cold one -> not-cached (the arm rendered
    // `(remote)` downstream). Read surfaces read the mirror but never refresh.
    if (source.sha === undefined) {
      const mirrorDir = await locations.pluginCloneDir(pluginMirrorKey(cloneUrl));
      if (!(await pathExists(mirrorDir))) {
        return { kind: "not-cached" };
      }

      const sha = await readMirrorHeadSha(mirrorDir);
      return anchorSubdir(source, mirrorDir, sha);
    }

    const key = pluginCloneKey(cloneUrl, source.sha);
    const cloneDir = await locations.pluginCloneDir(key);
    return (await pathExists(cloneDir))
      ? anchorSubdir(source, cloneDir, source.sha)
      : { kind: "not-cached" };
  };
}

/**
 * RSTA-01 / RSTA-05 / RSTA-06 / NFR-5: classify a NOT-installed manifest entry
 * into the shared `ManifestEntryClassification` bucket, presence-derived and
 * network-free.
 *
 * A git-source entry (url / git-subdir / github) is classified from its fs-only
 * clone/mirror presence via `makePresenceProbe` (D-80-02):
 *   - COLD (`not-cached`, nothing materialized locally) -> `remote`. The entry
 *     is a valid install target (install performs the fetch), but there is no
 *     local tree to resolve, so it is NOT over-claimed `available`.
 *   - WARM (`materialized`) -> the real three-way resolution against the on-disk
 *     tree via `resolveStrict` with the presence probe injected:
 *     `available` (installable) / `partially-available` / `unavailable`. A
 *     `resolveStrict` throw folds to `unavailable`, and so does a presence-probe
 *     throw (a mirror dir that exists but is corrupt or concurrently modified,
 *     e.g. an unreadable `.git/HEAD`) -- the same verdict the probe would reach
 *     if injected into `resolveStrict`, so one broken mirror degrades one
 *     plugin instead of poisoning the whole marketplace.
 * Manifest pin wins for pinned entries (exact per-sha key or `remote`), even if
 * stale clones of the same URL exist -- inherited from `makePresenceProbe`.
 *
 * Path / npm / unknown sources fall through to `resolveStrict` +
 * `classifyManifestEntry`; a `resolveStrict` throw folds to `unavailable`.
 * Every throw folds internally, so `probeManifestEntry` never throws and
 * callers need no local try/catch.
 *
 * Imports only `makePresenceProbe` + `resolveStrict` (both fs-only) -- never the
 * platform/git seam, so read surfaces stay network-free (NFR-5).
 */
export async function probeManifestEntry(
  entry: ManifestEntry,
  marketplaceRoot: string,
  locations: ScopedLocations,
): Promise<ManifestEntryClassification> {
  const parsedSource = parsePluginSource(entry.source);
  if (
    parsedSource.kind === "url" ||
    parsedSource.kind === "git-subdir" ||
    parsedSource.kind === "github"
  ) {
    const probe = makePresenceProbe(locations);
    try {
      const presence = await probe(parsedSource);
      if (presence.kind === "not-cached") {
        return "remote";
      }

      const ctx: ResolveContext = {
        marketplaceRoot,
        resolveGitPluginRoot: probe,
      };
      return classifyManifestEntry(await resolveStrict(entry, ctx));
    } catch {
      // A presence-probe throw (corrupt / concurrently-modified mirror) folds
      // to `unavailable` exactly like a `resolveStrict` throw would.
      return "unavailable";
    }
  }

  try {
    return classifyManifestEntry(await resolveStrict(entry, { marketplaceRoot }));
  } catch {
    return "unavailable";
  }
}

/**
 * PURL-08 / D-78-04 / CR-01: resolve an upgrade CANDIDATE manifest entry against
 * the WARM clone cache via the fs-only presence probe, so a git-source upgrade
 * candidate resolves without cloning. A cold cache yields `not-cached` -> the
 * resolver's git arm maps it to `unavailable{not installed}`, and the shared
 * classifier's CR-01 degrade folds that back to the plain `(upgradable)` row --
 * an installed git plugin with a missing clone never regresses to
 * `(unavailable)`. A `resolveStrict` throw returns `undefined` (the CR-01
 * probe-failure degrade). The presence probe never spawns git nor hits the
 * network.
 */
export async function probeUpgradeCandidate(
  entry: ManifestEntry,
  marketplaceRoot: string,
  locations: ScopedLocations,
): Promise<ResolvedPlugin | undefined> {
  const ctx: ResolveContext = {
    marketplaceRoot,
    resolveGitPluginRoot: makePresenceProbe(locations),
  };
  try {
    return await resolveStrict(entry, ctx);
  } catch {
    return undefined;
  }
}

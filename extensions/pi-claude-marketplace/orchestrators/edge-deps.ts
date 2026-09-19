// orchestrators/edge-deps.ts
//
// D-04: registration-glue helper that constructs a
// `LocationsResolver` (both the resolver surface and the state-record
// shape it returns are declared HERE; edge/completions/data.ts
// republishes the resolver under that spelling) from the
// persistence/state-io + persistence/locations +
// domain/manifest + domain/resolver surfaces. This file lives in `orchestrators/` so that
// `edge/register.ts` (which legally imports from `orchestrators/`) can
// reach all four underlying modules without violating BLOCK C's
// edge/ -> persistence/ restriction (edge/ -> domain/ has been allowed
// directly since Phase 21 / D-21-02; the domain/manifest read still routes
// through here because it's paired with the persistence/ read in the same
// resolver interface).
//
// Architectural seam:
//   - shared/completion-cache.ts: pure paths + rebuild callbacks
//     (shared/ MUST NOT import persistence/).
//   - edge/completions/data.ts: republishes `LocationsResolverLike` below
//     as `LocationsResolver` (edge/ MUST NOT import persistence/, and the
//     republish is type-only, so it does not).
//   - orchestrators/edge-deps.ts: IMPLEMENTS the resolver by closing over
//     loadState + manifest read + resolveStrict (orchestrators/ MAY
//     import persistence/ and domain/).
//   - edge/register.ts: calls makeLocationsResolver and threads the
//     resolver into getArgumentCompletions; the slash-command surface
//     itself stays inside edge/.
//
// Error contracts:
//   - loadStateForScope: throws state-load errors verbatim. TC-9 surfaces
//     these via the cache layer's getMarketplaceNames rebuild path.
//   - loadManifestForMarketplace: catches anything thrown during manifest
//     read or per-plugin resolution and re-throws as ManifestSoftFailError.
//     The cache layer's getPluginIndex catches that discriminator and
//     writes the TC-8 `_loadError` poison row (returning [] to callers).

import { loadMarketplaceManifest } from "../domain/manifest.ts";
import { locationsFor } from "../persistence/locations.ts";
import { loadState } from "../persistence/state-io.ts";
import { ManifestSoftFailError } from "../shared/completion-cache.ts";
import { hookDebugLog } from "../shared/debug-log.ts";
import { errorMessage } from "../shared/errors.ts";

import { probeManifestEntry, probeUpgradeCandidate } from "./plugin/git-source-probe.ts";
import { classifyInstalledRecord } from "./plugin/plugin-state-classifier.ts";

import type { MarketplaceManifest } from "../domain/manifest.ts";
import type { ScopedLocations } from "../persistence/locations.ts";
import type { ExtensionState } from "../persistence/state-io.ts";
import type { PluginIndexRow } from "../shared/completion-cache.ts";
import type { Scope } from "../shared/types.ts";

// ---------------------------------------------------------------------------
// The completions-resolver seam. BLOCK C forbids orchestrators/ from
// importing edge/, so whatever the two sides share has to be declared
// here and named from the edge side, never the reverse.
//
// Both shapes are declared here exactly once.
// `MarketplaceStateRecordLike` is the state-record shape and
// `LocationsResolverLike` is the resolver surface;
// edge/completions/data.ts imports the resolver type-only and republishes
// it as `LocationsResolver`, and every other consumer -- production and
// test alike -- names these declarations. Neither shape can drift, because
// there is no second declaration of either to drift from.
//
// Do not reintroduce an edge-side mirror of either one. The old mirror
// carried a claim that a rename would be caught by the edge-side compile,
// and that claim was measured false: the mirrors were compared
// structurally, so a single-field rename on one side still compiled (the
// same optional-field silent-omission class this repo has hit before).
// ---------------------------------------------------------------------------

/**
 * Minimal shape the completion reads need from a state record: the installed
 * plugin names, and nothing else. The full state record lives in
 * persistence; the completion consumers in edge/ and their tests name this
 * declaration directly.
 */
export interface MarketplaceStateRecordLike {
  readonly plugins?: Record<string, unknown>;
}

/**
 * Injection surface that lets edge/completions reach into persistence/state
 * + domain/manifest WITHOUT importing them (D-11 / ESLint BLOCK C keeps
 * edge/ from importing persistence/). Constructed by `makeLocationsResolver`
 * below and threaded through getArgumentCompletions by edge/register.ts,
 * which reaches it through the `LocationsResolver` republish in
 * edge/completions/data.ts.
 *
 * The two rebuild-callback resolvers (loadStateForScope,
 * loadManifestForMarketplace) MUST throw to signal failure -- the cache layer
 * uses ManifestSoftFailError as the soft-fail discriminator (TC-8); any
 * other thrown error propagates verbatim (TC-9: state.json errors surface).
 */
export interface LocationsResolverLike {
  /** Cache file path for a scoped marketplace's plugin index. */
  pluginCachePath(scope: Scope, marketplace: string): Promise<string>;
  /** Loads state.json for a scope (cache-miss rebuild path). */
  loadStateForScope(scope: Scope): Promise<{
    marketplaces: Record<string, MarketplaceStateRecordLike>;
  }>;
  /** Loads + bucketizes a marketplace's manifest into PluginIndexRow shape. */
  loadManifestForMarketplace(scope: Scope, marketplace: string): Promise<readonly PluginIndexRow[]>;
}

/**
 * LIST-02 / D-67-02: build the cache row for ONE installed plugin via the
 * shared `classifyInstalledRecord`. The upgrade-candidate resolve stays
 * NO-NETWORK (`resolveStrict`, NFR-5) and runs only when the manifest carries
 * a newer version (PL-5 string compare; `upgradable === true` narrows
 * `manifestEntry` to defined). CR-01: a candidate probe failure degrades to
 * plain `upgradable` (the classifier reads `undefined` as "could not assert").
 */
async function classifyInstalledPluginRow(
  pluginName: string,
  installed: ExtensionState["marketplaces"][string]["plugins"][string],
  manifestEntry: MarketplaceManifest["plugins"][number] | undefined,
  marketplaceRoot: string,
  locations: ScopedLocations,
): Promise<PluginIndexRow> {
  const upgradable =
    manifestEntry?.version !== undefined && manifestEntry.version !== installed.version;

  // PURL-08 / D-78-04 / CR-01: the shared probe injects the fs-only presence
  // probe so a git-source upgrade candidate resolves against the WARM clone
  // cache without cloning, and folds a probe failure to `undefined` (the CR-01
  // degrade). `upgradable === true` narrows `manifestEntry` to defined.
  let candidateResolved: Awaited<ReturnType<typeof probeUpgradeCandidate>>;
  if (upgradable) {
    candidateResolved = await probeUpgradeCandidate(manifestEntry, marketplaceRoot, locations);
  }

  return {
    name: pluginName,
    status: classifyInstalledRecord(
      installed,
      upgradable ? { upgradable: true, resolved: candidateResolved } : { upgradable: false },
    ),
    version: installed.version,
  };
}

/**
 * LIST-02 / D-67-02: build the cache row for ONE not-installed manifest entry
 * via the shared `classifyManifestEntry`. `partially-available` is emitted DISTINCTLY
 * from structural `unavailable` so the `--partial`-gated candidate sets can offer
 * `available + partially-available`. A probe failure is structural unavailability; the
 * cache row carries no diagnostic notes (the `list` surface renders detail).
 */
async function classifyNotInstalledPluginRow(
  entry: MarketplaceManifest["plugins"][number],
  marketplaceRoot: string,
  locations: ScopedLocations,
): Promise<PluginIndexRow> {
  // RSTA-01 / RSTA-03: the shared presence-derived probe owns the git-source
  // classification (a not-installed url/git-subdir/github entry with a cold clone
  // classifies `remote`; a warm one resolves the three-way verdict) AND the
  // catch-to-`unavailable` fold -- including a presence-probe throw on a
  // corrupt mirror -- at parity with `list-candidate-row`'s availableRowMessage -- both
  // surfaces route through the SAME `probeManifestEntry`, so the bucket never
  // diverges. No local try/catch is needed -- `probeManifestEntry` folds every
  // throw internally and never throws, so one broken mirror degrades one row
  // instead of poisoning the marketplace's completion index.
  const status = await probeManifestEntry(entry, marketplaceRoot, locations);

  return {
    name: entry.name,
    status,
    ...(entry.version !== undefined && { version: entry.version }),
  };
}

/**
 * Construct a {@link LocationsResolver} closed over `cwd`. The resolver
 * is the single seam through which `edge/completions/provider.ts` reads
 * persistence + domain surfaces without crossing BLOCK C.
 *
 * Slash-command registration site: `edge/register.ts` calls
 * `makeLocationsResolver(process.cwd())` once at command setup and
 * threads the returned resolver into `getArgumentCompletions`.
 */
export function makeLocationsResolver(cwd: string): LocationsResolverLike {
  return {
    pluginCachePath(scope: Scope, marketplace: string): Promise<string> {
      return locationsFor(scope, cwd).pluginCacheFile(marketplace);
    },

    async loadStateForScope(scope: Scope) {
      const locations = locationsFor(scope, cwd);
      const state = await loadState(locations.extensionRoot);
      // Project the persistence-level state shape into the structural
      // MarketplaceStateRecordLike the resolver contract declares. Both
      // shapes are structurally compatible -- the projection mostly
      // exists to document the contract surface explicitly.
      const projected: Record<string, MarketplaceStateRecordLike> = {};
      for (const [name, record] of Object.entries(state.marketplaces)) {
        projected[name] = { plugins: record.plugins };
      }

      return { marketplaces: projected };
    },

    async loadManifestForMarketplace(
      scope: Scope,
      marketplace: string,
    ): Promise<readonly PluginIndexRow[]> {
      try {
        const locations = locationsFor(scope, cwd);
        const state = await loadState(locations.extensionRoot);
        const mp = state.marketplaces[marketplace];
        if (mp === undefined) {
          // No state record for the requested marketplace in this scope.
          // The cache layer treats ManifestSoftFailError as the TC-8 poison
          // signal; subsequent reads return []. The orchestrator-side
          // invalidation call-sites clear the poison once the user
          // fixes the underlying state.
          throw new ManifestSoftFailError(
            new Error(`Marketplace "${marketplace}" has no state record in scope "${scope}".`),
          );
        }

        const parsed = await loadMarketplaceManifest(mp.manifestPath);

        const installedNames = new Set(Object.keys(mp.plugins));
        const rows: PluginIndexRow[] = [];

        // Installed entries first. LIST-02 / D-67-02: the finer state
        // (installed | upgradable | partially-installed | partially-upgradable) is
        // derived by the SHARED classifier -- the same one the `list`
        // orchestrator consumes -- so the completion cache never diverges from
        // `list` (no provider-local reclassification).
        for (const [pluginName, installed] of Object.entries(mp.plugins)) {
          rows.push(
            await classifyInstalledPluginRow(
              pluginName,
              installed,
              parsed.plugins.find((p) => p.name === pluginName),
              mp.marketplaceRoot,
              locations,
            ),
          );
        }

        // Not-installed manifest entries (skip already-installed names).
        for (const entry of parsed.plugins) {
          if (installedNames.has(entry.name)) {
            continue;
          }

          rows.push(await classifyNotInstalledPluginRow(entry, mp.marketplaceRoot, locations));
        }

        return rows;
      } catch (err) {
        if (err instanceof ManifestSoftFailError) {
          throw err;
        }

        // Any other failure (ENOENT on manifest, JSON parse, schema fail,
        // unexpected exception) becomes the TC-8 soft-fail signal. The
        // cache writes the poison row and returns [] to the completion
        // consumer -- the slash-command surface never sees the throw. Record
        // the original failure on the debug seam first, so a bug unrelated to
        // a missing/malformed manifest doesn't fold away without a trace.
        hookDebugLog(
          `loadManifestForMarketplace failed for "${marketplace}" in scope "${scope}": ${errorMessage(err)}`,
        );
        throw new ManifestSoftFailError(err);
      }
    },
  };
}

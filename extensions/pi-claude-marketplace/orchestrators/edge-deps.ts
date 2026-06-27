// orchestrators/edge-deps.ts
//
// D-04: registration-glue helper that constructs a
// `LocationsResolver` (interface defined in edge/completions/data.ts) from
// the persistence/state-io + persistence/locations + domain/manifest +
// domain/resolver surfaces. This file lives in `orchestrators/` so that
// `edge/register.ts` (which legally imports from `orchestrators/`) can
// reach all four underlying modules without violating BLOCK C
// (edge/ -> persistence/ and edge/ -> domain/ are forbidden).
//
// Architectural seam:
//   - shared/completion-cache.ts: pure paths + rebuild callbacks
//     (shared/ MUST NOT import persistence/).
//   - edge/completions/data.ts: declares the LocationsResolver interface
//     (edge/ MUST NOT import persistence/).
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
import { resolveStrict } from "../domain/resolver.ts";
import { locationsFor } from "../persistence/locations.ts";
import { loadState } from "../persistence/state-io.ts";
import { ManifestSoftFailError } from "../shared/completion-cache.ts";

import {
  classifyInstalledRecord,
  classifyManifestEntry,
} from "./plugin/plugin-state-classifier.ts";

import type { MarketplaceManifest } from "../domain/manifest.ts";
import type { ExtensionState } from "../persistence/state-io.ts";
import type { PluginIndexRow } from "../shared/completion-cache.ts";
import type { Scope } from "../shared/types.ts";

// ---------------------------------------------------------------------------
// LocationsResolverLike: a structural alias for the
// `edge/completions/data.ts::LocationsResolver` interface. Re-declared
// here -- NOT imported -- because BLOCK C forbids orchestrators/ from
// importing edge/. TypeScript structural typing guarantees the return
// value of `makeLocationsResolver` is assignable to
// `LocationsResolver` at the edge-side call site (`edge/register.ts`).
// The fields MUST stay in sync with edge/completions/data.ts; a future
// rename would be caught by the edge-side TypeScript compile (the
// consumer asserts the structural shape it needs).
// ---------------------------------------------------------------------------

interface MarketplaceStateRecordLike {
  readonly manifestPath?: string;
  readonly plugins?: Record<string, unknown>;
}

export interface LocationsResolverLike {
  marketplaceNamesCachePath(scope: Scope): string;
  pluginCachePath(scope: Scope, marketplace: string): Promise<string>;
  loadStateForScope(scope: Scope): Promise<{
    marketplaces: Record<string, MarketplaceStateRecordLike>;
  }>;
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
): Promise<PluginIndexRow> {
  const upgradable =
    manifestEntry?.version !== undefined && manifestEntry.version !== installed.version;

  let candidateResolved: Awaited<ReturnType<typeof resolveStrict>> | undefined;
  if (upgradable) {
    try {
      candidateResolved = await resolveStrict(manifestEntry, { marketplaceRoot });
    } catch {
      candidateResolved = undefined;
    }
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
 * via the shared `classifyManifestEntry`. `unsupported` is emitted DISTINCTLY
 * from structural `unavailable` (the old `installable ? available : unavailable`
 * collapse is gone) so the `--force`-gated candidate sets can offer
 * `available + unsupported`. A probe failure is structural unavailability; the
 * cache row carries no diagnostic notes (the `list` surface renders detail).
 */
async function classifyNotInstalledPluginRow(
  entry: MarketplaceManifest["plugins"][number],
  marketplaceRoot: string,
): Promise<PluginIndexRow> {
  let status: PluginIndexRow["status"];
  try {
    status = classifyManifestEntry(await resolveStrict(entry, { marketplaceRoot }));
  } catch {
    status = "unavailable";
  }

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
    marketplaceNamesCachePath(scope: Scope): string {
      return locationsFor(scope, cwd).marketplaceNamesCacheFile;
    },

    pluginCachePath(scope: Scope, marketplace: string): Promise<string> {
      return locationsFor(scope, cwd).pluginCacheFile(marketplace);
    },

    async loadStateForScope(scope: Scope): Promise<{
      marketplaces: Record<string, MarketplaceStateRecordLike>;
    }> {
      const locations = locationsFor(scope, cwd);
      const state = await loadState(locations.extensionRoot);
      // Project the persistence-level state shape into the structural
      // MarketplaceStateRecordLike the resolver contract declares. Both
      // shapes are structurally compatible -- the projection mostly
      // exists to document the contract surface explicitly.
      const projected: Record<string, MarketplaceStateRecordLike> = {};
      for (const [name, record] of Object.entries(state.marketplaces)) {
        projected[name] = {
          manifestPath: record.manifestPath,
          plugins: record.plugins,
        };
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
        // (installed | upgradable | force-installed | force-upgradable) is
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
            ),
          );
        }

        // Not-installed manifest entries (skip already-installed names).
        for (const entry of parsed.plugins) {
          if (installedNames.has(entry.name)) {
            continue;
          }

          rows.push(await classifyNotInstalledPluginRow(entry, mp.marketplaceRoot));
        }

        return rows;
      } catch (err) {
        if (err instanceof ManifestSoftFailError) {
          throw err;
        }

        // Any other failure (ENOENT on manifest, JSON parse, schema fail,
        // unexpected exception) becomes the TC-8 soft-fail signal. The
        // cache writes the poison row and returns [] to the completion
        // consumer -- the slash-command surface never sees the throw.
        throw new ManifestSoftFailError(err);
      }
    },
  };
}

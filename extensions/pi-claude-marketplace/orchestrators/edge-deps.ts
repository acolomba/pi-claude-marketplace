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
// directly (D-21-02); the domain/manifest read still routes
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

import { lookupDeclaredPlugin } from "../domain/manifest-lookup.ts";
import { loadMarketplaceManifest } from "../domain/manifest.ts";
import { locationsFor } from "../persistence/locations.ts";
import { loadState } from "../persistence/state-io.ts";
import { ManifestSoftFailError } from "../shared/completion-cache.ts";
import { hookDebugLog } from "../shared/debug-log.ts";
import { errorMessage } from "../shared/errors.ts";
import { ownValue, setOwn } from "../shared/own-key.ts";

import { probeManifestEntry } from "./plugin/git-source-probe.ts";
import { classifyInstalledForImplementation } from "./plugin/list-installed-row.ts";

import type { MarketplaceManifest } from "../domain/manifest.ts";
import type { ActiveMcpImplementation } from "../domain/mcp-implementation.ts";
import type { ResolveContext } from "../domain/resolver-types.ts";
import type { InstalledRecordView } from "./plugin/list-installed-row.ts";
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
 * + domain/manifest WITHOUT importing them (D-v1.0-01-11 / ESLint BLOCK C keeps
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
  /**
   * The run's active MCP implementation, whose view each row shows (D-P6-22,
   * MREC-03): a row is classified as `list` classifies it under this
   * implementation. Required, because every caller names the implementation
   * (D-P3-03).
   */
  readonly mcpImplementation: ActiveMcpImplementation;
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
 * ENBL-04: completion has no `disabled` token, so a disabled record,
 * which `list` shows as `(disabled)`, is offered as `installed`. It stays in
 * the no-`--partial` inventory set and is never an `update --partial`
 * candidate. Plain `update` completion does offer it
 * (`INSTALLED_INVENTORY_STATUSES` in `edge/completions/data.ts`). This
 * function is the one place where completion maps a disabled record, because
 * `classifyInstalledForImplementation` answers such a record before the
 * classifier runs.
 */
function completionStatus(view: InstalledRecordView): PluginIndexRow["status"] {
  return view.kind === "disabled" ? "installed" : view.status;
}

/**
 * LIST-02 / D-67-02 / D-P6-22: build the cache row for ONE installed plugin
 * through `classifyInstalledForImplementation`, the classification
 * `composeInstalledListRow` uses, for the resolver's implementation. The
 * manifest entry comes from `lookupDeclaredPlugin`, as `list` finds it, so
 * completion offers `update` for exactly the plugins `list` marks upgradable
 * (VER-01 / VER-02, D-PL7-09), and a disabled record reads no MCP verdict.
 */
async function classifyInstalledPluginRow(
  pluginName: string,
  installed: ExtensionState["marketplaces"][string]["plugins"][string],
  manifest: MarketplaceManifest,
  scope: Scope,
  mp: ExtensionState["marketplaces"][string],
  cwd: string,
  mcpImplementation: ActiveMcpImplementation,
): Promise<PluginIndexRow> {
  const view = await classifyInstalledForImplementation({
    pluginName,
    pluginScope: scope,
    marketplaceScope: scope,
    marketplace: mp,
    lookup: lookupDeclaredPlugin(manifest, pluginName),
    cwd,
    mcpImplementation,
  });

  return { name: pluginName, status: completionStatus(view), version: installed.version };
}

/**
 * LIST-02 / D-67-02: build the cache row for ONE not-installed manifest entry
 * via the shared `classifyManifestEntry`, over the view of `mcpImplementation`
 * that `list` applies (D-P6-22). `partially-available` is emitted DISTINCTLY
 * from structural `unavailable` so the `--partial`-gated candidate sets can offer
 * `available + partially-available`. A probe failure is structural unavailability; the
 * cache row carries no diagnostic notes (the `list` surface renders detail).
 */
async function classifyNotInstalledPluginRow(
  entry: MarketplaceManifest["plugins"][number],
  marketplaceContext: Pick<
    ResolveContext,
    "marketplaceRoot" | "marketplaceName" | "marketplaceSource"
  >,
  locations: ScopedLocations,
  mcpImplementation: ActiveMcpImplementation,
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
  const status = await probeManifestEntry(entry, marketplaceContext, locations, mcpImplementation);

  return {
    name: entry.name,
    status,
    ...(entry.version !== undefined && { version: entry.version }),
  };
}

/**
 * Construct a {@link LocationsResolver} closed over `cwd` and the active MCP
 * implementation. The resolver is the single seam through which
 * `edge/completions/provider.ts` reads persistence + domain surfaces without
 * crossing BLOCK C.
 *
 * Slash-command registration site: `edge/register.ts` calls
 * `makeLocationsResolver(process.cwd(), mcpImplementation)` once per
 * completion lookup, with the implementation that lookup's inventory snapshot
 * names (MSEL-01, D-P6-22), and threads the returned resolver into
 * `getArgumentCompletions`.
 */
export function makeLocationsResolver(
  cwd: string,
  mcpImplementation: ActiveMcpImplementation,
): LocationsResolverLike {
  return {
    mcpImplementation,

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
        setOwn(projected, name, { plugins: record.plugins });
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
        const mp = ownValue(state.marketplaces, marketplace);
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
        const marketplaceContext = {
          marketplaceRoot: mp.marketplaceRoot,
          marketplaceName: marketplace,
          marketplaceSource: mp.source,
        };

        const installedNames = new Set(Object.keys(mp.plugins));
        const rows: PluginIndexRow[] = [];

        // Installed entries first. LIST-02 / D-67-02: the finer state
        // (installed | upgradable | partially-installed | partially-upgradable) is
        // derived by the SHARED composition the `list` orchestrator uses, for
        // the resolver's implementation (D-P6-22) -- so the completion cache
        // never diverges from `list` (no provider-local reclassification).
        for (const [pluginName, installed] of Object.entries(mp.plugins)) {
          rows.push(
            // eslint-disable-next-line no-await-in-loop -- bounded by the marketplace's installed plugins, one row each
            await classifyInstalledPluginRow(
              pluginName,
              installed,
              parsed,
              scope,
              mp,
              cwd,
              mcpImplementation,
            ),
          );
        }

        // Not-installed manifest entries (skip already-installed names).
        for (const entry of parsed.plugins) {
          if (installedNames.has(entry.name)) {
            continue;
          }

          rows.push(
            // eslint-disable-next-line no-await-in-loop -- bounded by the manifest's uninstalled entries, one row each
            await classifyNotInstalledPluginRow(
              entry,
              marketplaceContext,
              locations,
              mcpImplementation,
            ),
          );
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

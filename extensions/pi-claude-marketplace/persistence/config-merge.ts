// persistence/config-merge.ts
//
// CFG-02 / D-01 / D-09 / D-18 -- base+local merge producing `MergedConfig`
// with per-entry provenance.
//
// The reducer is a PURE function: no I/O, no `node:fs` imports. A scope has
// two layers: the base layer, whose config is `claude-plugins.json`, and the
// local layer, whose config is `claude-plugins.local.json`. For marketplace and
// plugin entries alike the override unit is the FIELD (LAYER-09 / D-MF-03): the
// same key may be declared in both layers, and each field the local entry sets
// wins over the base entry. So a local marketplace entry without `autoupdate`
// follows the base value, a local plugin entry without `enabled` keeps the base
// `enabled`, and an explicit local value is a per-machine override. Unknown
// fields of both entries survive.
//
// Each `MergedConfigEntry` carries `source: "base" | "local"` so write-back
// can target the correct physical file without replaying the merge. The
// provenance is `local` whenever the local layer has the key.
//
// `loadMergedScopeConfig` returns BOTH the merged view AND the per-file
// `ConfigLoadResult`s -- the per-file results MUST NOT collapse into the
// merged view, because downstream write-back needs them separately.
// When one arm is `absent` or `invalid`, the merge treats its contribution as
// empty `ScopeConfig` so a sensible merged view is still produced (D-18
// enables the fallback policy downstream); the caller inspects `base.status`
// / `local.status` to decide what to do. This module itself does NOT inject
// notification calls (D-19 routes through `shared/notification-dispatch.ts` in
// downstream layers).
//
// D-16: a dangling plugin reference (a plugin entry whose marketplace name
// does NOT appear in either marketplaces map) is a VALID merged result. The
// merge does not abort or filter; reconcile soft-fails per-entry at apply time.

import {
  loadConfig,
  type ConfigLoadResult,
  type MarketplaceConfigEntry,
  type PluginConfigEntry,
  type ScopeConfig,
} from "./config-io.ts";

import type { ScopedLocations } from "./locations.ts";
import type { Scope } from "../shared/types.ts";

/**
 * A merged entry carries the underlying entry value plus its provenance.
 * Provenance binds write-back to the correct physical file
 * (`claude-plugins.json` vs `claude-plugins.local.json`).
 */
export interface MergedConfigEntry<T> {
  readonly entry: T;
  readonly source: "base" | "local";
}

/**
 * The merged view of a single scope. Plugins are flat-keyed by
 * `"plugin@marketplace"` (D-01); they are NOT nested under marketplaces.
 */
export interface MergedConfig {
  readonly marketplaces: Record<string, MergedConfigEntry<MarketplaceConfigEntry>>;
  readonly plugins: Record<string, MergedConfigEntry<PluginConfigEntry>>;
}

/**
 * The per-scope loader returns the merged view AND the per-file
 * `ConfigLoadResult`s separately. Downstream write-back targets the correct
 * physical file via the per-file results; downstream apply-time consumers read
 * `base.status` / `local.status` to apply the D-18 fallback policy when one
 * arm is `invalid`.
 */
export interface ScopeLoadOutcome {
  readonly merged: MergedConfig;
  readonly base: ConfigLoadResult;
  readonly local: ConfigLoadResult;
}

/**
 * True when either config layer of the scope failed to load. A layer that is
 * absent is not invalid. Autoupdate counts as off for such a scope, because the
 * merged view reads an invalid layer as `{}` and would otherwise fall back to
 * the default for the name.
 */
export function hasInvalidConfigLayer(outcome: ScopeLoadOutcome): boolean {
  return outcome.base.status === "invalid" || outcome.local.status === "invalid";
}

/**
 * CFG-02 / LAYER-09 / D-MF-03: merges the base layer (`base`) and the local
 * layer (`local`) of one scope.
 *
 * For each key in the union of the two layers' marketplaces, and likewise of
 * their plugins (flat `plugin@marketplace` keys per D-01), the merged entry is
 * `{ entry: { ...base[key], ...local[key] }, source: "local" }` when `local`
 * has the key, and `{ entry: base[key], source: "base" }` otherwise.
 *
 * The outer maps are built through a `Map`, and the base entry is read back
 * from it, so a JSON key such as `__proto__` stays an own entry.
 */
export function mergeScopeConfigs(base: ScopeConfig, local: ScopeConfig): MergedConfig {
  const baseMps = base.marketplaces ?? {};
  const localMps = local.marketplaces ?? {};
  const basePlugins = base.plugins ?? {};
  const localPlugins = local.plugins ?? {};

  const marketplaceEntries = new Map<string, MergedConfigEntry<MarketplaceConfigEntry>>();
  for (const [key, entry] of Object.entries(baseMps)) {
    marketplaceEntries.set(key, { entry, source: "base" });
  }

  for (const [key, entry] of Object.entries(localMps)) {
    const baseEntry = marketplaceEntries.get(key)?.entry;
    marketplaceEntries.set(key, { entry: { ...baseEntry, ...entry }, source: "local" });
  }

  const pluginEntries = new Map<string, MergedConfigEntry<PluginConfigEntry>>();
  for (const [key, entry] of Object.entries(basePlugins)) {
    pluginEntries.set(key, { entry, source: "base" });
  }

  for (const [key, entry] of Object.entries(localPlugins)) {
    const baseEntry = pluginEntries.get(key)?.entry;
    pluginEntries.set(key, { entry: { ...baseEntry, ...entry }, source: "local" });
  }

  return {
    marketplaces: Object.fromEntries(marketplaceEntries),
    plugins: Object.fromEntries(pluginEntries),
  };
}

/**
 * LAYER-06 / D-MF-03: the plugin keys one layer declares while only the other
 * layer declares their marketplace.
 */
export interface LayerMarketplaceGap {
  readonly layer: "base" | "local";
  readonly keys: readonly string[];
}

// The keys `own` declares whose marketplace `own` does not declare while
// `other` does. A key is split on its last `@`; a key with no plugin or no
// marketplace part is left to the planner's malformed-key diagnostic.
function gapKeys(own: ScopeConfig, other: ScopeConfig): string[] {
  const ownMarketplaces = own.marketplaces ?? {};
  const otherMarketplaces = other.marketplaces ?? {};
  return Object.keys(own.plugins ?? {})
    .filter((key) => {
      const at = key.lastIndexOf("@");
      const marketplace = key.slice(at + 1);
      return (
        at > 0 &&
        marketplace !== "" &&
        !Object.hasOwn(ownMarketplaces, marketplace) &&
        Object.hasOwn(otherMarketplaces, marketplace)
      );
    })
    .sort((a, b) => a.localeCompare(b));
}

/**
 * LAYER-06 / D-MF-03: a layer must declare the marketplace of every plugin it
 * declares. Returns, base layer first, each layer that declares a plugin
 * whose marketplace only the other layer declares, with those keys sorted. A
 * marketplace that no layer declares is not reported here: the planner reports
 * it on its own row as a dangling reference (D-16 above).
 */
export function findLayerMarketplaceGaps(
  base: ScopeConfig,
  local: ScopeConfig,
): readonly LayerMarketplaceGap[] {
  const gaps: LayerMarketplaceGap[] = [
    { layer: "base", keys: gapKeys(base, local) },
    { layer: "local", keys: gapKeys(local, base) },
  ];
  return gaps.filter((gap) => gap.keys.length > 0);
}

/**
 * D-18: per-scope loader returning both the merged view and
 * the per-file `ConfigLoadResult`s.
 *
 * Loads `loc.baseConfigJsonPath` (base) and `loc.localConfigJsonPath` (local) via
 * `loadConfig` (which NEVER throws -- every failure mode is encoded in the
 * returned union). When an arm is `absent` or `invalid`, its contribution to
 * the merged view is treated as empty `ScopeConfig` (`{}`), so a sensible
 * merged view is still produced for the valid arm -- this enables the D-18
 * one-invalid-file fallback that downstream apply implements. The merged
 * view never silently swallows the invalid signal: the caller inspects
 * `base.status` and `local.status` to decide what to do.
 *
 * This module does NOT inject notification calls or any user-visible messaging
 * (D-19 routes through `shared/notification-dispatch.ts` in downstream layers).
 * This function is a pure data seam.
 */
export async function loadMergedScopeConfig(loc: ScopedLocations): Promise<ScopeLoadOutcome> {
  const base = await loadConfig(loc.baseConfigJsonPath);
  const local = await loadConfig(loc.localConfigJsonPath);

  const baseConfig: ScopeConfig = base.status === "valid" ? base.config : {};
  const localConfig: ScopeConfig = local.status === "valid" ? local.config : {};

  const merged = mergeScopeConfigs(baseConfig, localConfig);

  return { merged, base, local };
}

/** AAP-04: one config file that can set `autoapply`, with its load result. */
export interface AutoapplyFile {
  readonly scope: Scope;
  readonly layer: "base" | "local";
  readonly filePath: string;
  readonly result: ConfigLoadResult;
}

/** AAP-02 / AAP-04: the effective `autoapply` value and the file that set it. */
export type EffectiveAutoapply =
  | { readonly status: "invalid" }
  | { readonly status: "valid"; readonly enabled: boolean; readonly source?: AutoapplyFile };

/**
 * AAP-02 / D-04: reads the four config files that can set `autoapply`, most
 * specific first: project local, project base, user local, user base.
 */
export async function loadAutoapplyFiles(
  project: ScopedLocations,
  user: ScopedLocations,
): Promise<readonly AutoapplyFile[]> {
  const files = [
    { scope: project.scope, layer: "local", filePath: project.localConfigJsonPath },
    { scope: project.scope, layer: "base", filePath: project.baseConfigJsonPath },
    { scope: user.scope, layer: "local", filePath: user.localConfigJsonPath },
    { scope: user.scope, layer: "base", filePath: user.baseConfigJsonPath },
  ] as const;
  return Promise.all(
    files.map(async (file) => ({ ...file, result: await loadConfig(file.filePath) })),
  );
}

/**
 * AAP-02 / D-04: the effective `autoapply` value of `files`, listed most
 * specific first. The first file that sets the key decides, as Claude Code
 * resolves a settings key (local over project over user), and none setting it
 * means off.
 *
 * D-03: any invalid file makes the answer `invalid`, which a load reads as
 * off. The value of a file that cannot be read is unknown, so the load stays
 * read-only and reports the file.
 */
export function effectiveAutoapply(files: readonly AutoapplyFile[]): EffectiveAutoapply {
  if (files.some((file) => file.result.status === "invalid")) {
    return { status: "invalid" };
  }

  const source = files.find(
    (file) => file.result.status === "valid" && file.result.config.autoapply !== undefined,
  );
  if (source?.result.status !== "valid") {
    return { status: "valid", enabled: false };
  }

  return { status: "valid", enabled: source.result.config.autoapply === true, source };
}

// persistence/config-merge.ts
//
// CFG-02 / D-01 / D-09 / D-18 -- base+local merge producing `MergedConfig`
// with per-entry provenance.
//
// The reducer is a PURE function: no I/O, no `node:fs` imports. For
// marketplace entries the override unit is the FIELD (D-MF-03): the same
// marketplace may be declared in both files, and each field the
// `claude-plugins.local.json` entry sets wins over the `claude-plugins.json`
// entry. So a local entry without `autoupdate` follows the shared one, and an
// explicit local value is a per-machine override. Unknown fields of both
// entries survive. Plugin entries are replaced whole: a field merge would
// turn a shared `{ enabled: false }` under a local `{}` into a disabled
// plugin (DFEN-05).
//
// Each `MergedConfigEntry` carries `source: "base" | "local"` so write-back
// can target the correct physical file without replaying the merge. The
// provenance is `local` whenever the local file has the key.
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
 * CFG-02 / D-MF-03: base+local reducer.
 *
 * For each key in the union of `base.marketplaces` and `local.marketplaces`,
 * if `local` has the key the merged entry is `{ entry: { ...base[key],
 * ...local[key] }, source: "local" }`; otherwise it is `{ entry: base[key],
 * source: "base" }`. Plugins (flat top-level keys per D-01) take the local
 * entry whole when `local` has the key (DFEN-05).
 *
 * The outer maps are built through a `Map`, and the shared marketplace entry
 * is read back from it, so a JSON key such as `__proto__` stays an own entry.
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
    const shared = marketplaceEntries.get(key)?.entry;
    marketplaceEntries.set(key, { entry: { ...shared, ...entry }, source: "local" });
  }

  const pluginEntries = new Map<string, MergedConfigEntry<PluginConfigEntry>>();
  for (const [key, entry] of Object.entries(basePlugins)) {
    pluginEntries.set(key, { entry, source: "base" });
  }

  for (const [key, entry] of Object.entries(localPlugins)) {
    pluginEntries.set(key, { entry, source: "local" });
  }

  return {
    marketplaces: Object.fromEntries(marketplaceEntries),
    plugins: Object.fromEntries(pluginEntries),
  };
}

/**
 * D-18: per-scope loader returning both the merged view and
 * the per-file `ConfigLoadResult`s.
 *
 * Loads `loc.configJsonPath` (base) and `loc.configLocalJsonPath` (local) via
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
  const base = await loadConfig(loc.configJsonPath);
  const local = await loadConfig(loc.configLocalJsonPath);

  const baseConfig: ScopeConfig = base.status === "valid" ? base.config : {};
  const localConfig: ScopeConfig = local.status === "valid" ? local.config : {};

  const merged = mergeScopeConfigs(baseConfig, localConfig);

  return { merged, base, local };
}

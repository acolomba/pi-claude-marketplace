// persistence/config-merge.ts
//
// CFG-02 / D-01 / D-09 / D-10 / D-18 -- entry-level base+local
// merge producing `MergedConfig` with per-entry provenance.
//
// The reducer is a PURE function: no I/O, no `node:fs` imports. The override
// unit is the ENTRY (not the field): a marketplace or plugin entry in
// `claude-plugins.local.json` replaces the same-keyed entry in
// `claude-plugins.json` WHOLESALE -- never field-merge (D-01 anti-deepmerge
// contract). The base entry is fully discarded for that key; unknown fields
// from the replaced base entry are NOT carried forward into the local entry.
// (D-10's preservation contract is a write-back concern, not a merge
// concern.)
//
// Each `MergedConfigEntry` carries `source: "base" | "local"` so write-back
// can target the correct physical file without replaying the merge.
//
// `loadMergedScopeConfig` returns BOTH the merged view AND the per-file
// `ConfigLoadResult`s -- the per-file results MUST NOT collapse into the
// merged view, because downstream write-back needs them separately.
// When one arm is `absent` or `invalid`, the merge treats its contribution as
// empty `ScopeConfig` so a sensible merged view is still produced (D-18
// enables the fallback policy downstream); the caller inspects `base.status`
// / `local.status` to decide what to do. This module itself does NOT inject
// `notify` calls (D-19 routes through `shared/notify.ts` in downstream layers).
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
 * CFG-02 / D-01: entry-level base+local reducer.
 *
 * For each key in the union of `base.marketplaces` and `local.marketplaces`,
 * if `local` has the key the merged entry is `{ entry: local[key], source:
 * "local" }`; otherwise it is `{ entry: base[key], source: "base" }`. The
 * SAME loop runs for `plugins` (flat top-level keys per D-01).
 *
 * Anti-deepmerge contract: when both `base` and `local` have a key, the base
 * entry is fully DISCARDED for that key -- unknown fields from the base
 * entry are NOT carried forward into the local entry. The override unit is
 * the entry, not the field.
 */
export function mergeScopeConfigs(base: ScopeConfig, local: ScopeConfig): MergedConfig {
  const baseMps = base.marketplaces ?? {};
  const localMps = local.marketplaces ?? {};
  const basePlugins = base.plugins ?? {};
  const localPlugins = local.plugins ?? {};

  const marketplaces: Record<string, MergedConfigEntry<MarketplaceConfigEntry>> = {};
  for (const key of new Set([...Object.keys(baseMps), ...Object.keys(localMps)])) {
    const localEntry = localMps[key];
    if (localEntry !== undefined) {
      marketplaces[key] = { entry: localEntry, source: "local" };
      continue;
    }

    const baseEntry = baseMps[key];
    if (baseEntry !== undefined) {
      // Belt-and-suspenders: key came from one of the two maps and the local
      // branch already handled local-present, so baseEntry is defined here.
      marketplaces[key] = { entry: baseEntry, source: "base" };
    }
  }

  const plugins: Record<string, MergedConfigEntry<PluginConfigEntry>> = {};
  for (const key of new Set([...Object.keys(basePlugins), ...Object.keys(localPlugins)])) {
    const localEntry = localPlugins[key];
    if (localEntry !== undefined) {
      plugins[key] = { entry: localEntry, source: "local" };
      continue;
    }

    const baseEntry = basePlugins[key];
    if (baseEntry !== undefined) {
      plugins[key] = { entry: baseEntry, source: "base" };
    }
  }

  return { marketplaces, plugins };
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
 * This module does NOT inject `notify` calls or any user-visible messaging
 * (D-19 routes through `shared/notify.ts` in downstream layers). This
 * function is a pure data seam.
 */
export async function loadMergedScopeConfig(loc: ScopedLocations): Promise<ScopeLoadOutcome> {
  const base = await loadConfig(loc.configJsonPath);
  const local = await loadConfig(loc.configLocalJsonPath);

  const baseConfig: ScopeConfig = base.status === "valid" ? base.config : {};
  const localConfig: ScopeConfig = local.status === "valid" ? local.config : {};

  const merged = mergeScopeConfigs(baseConfig, localConfig);

  return { merged, base, local };
}

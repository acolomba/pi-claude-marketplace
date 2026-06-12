// persistence/config-write-back.ts
//
// WB-01 / WB-02 / WB-03 / WB-04.
//
// Single sanctioned config-write-back module. All mutating-command
// write-backs route through these helpers; each helper wraps `saveConfig`
// (the SOLE sanctioned writer per SPLIT-02) with entry-level patch semantics
// that preserve unknown forward-compat keys (D-09 lenient schema) and
// delegate to the caller for `targetConfigPath` selection (--local
// discipline lives at the orchestrator boundary, not here).
//
// Structural guard: this file MUST NOT import `config-merge.ts`,
// `mergeScopeConfigs`, or `loadMergedScopeConfig`. The write-back patcher
// operates on a PHYSICAL `ScopeConfig` (the result of `loadConfig`), NEVER
// on a merged view -- serializing a merged view back to disk would copy
// `claude-plugins.local.json` entries into `claude-plugins.json` and
// silently clobber the per-machine override. The architecture test at
// `tests/architecture/config-state-consistency.test.ts` is the round-trip
// integrity gate.
//
// Cascade-delete contract: `deleteMarketplaceConfigEntryWithCascade`
// removes the marketplace entry AND every plugin entry whose key ends in
// `@<marketplace>`. The state-side cascade (`cascadeUnstagePlugin`) is the
// runtime mirror; this helper keeps the config-side cascade in ONE place so
// `marketplace remove` callers cannot forget the plugin sweep -- which would
// otherwise surface as a perpetual `<marketplace not declared>` source
// mismatch on the next reconcile preview.
//
// schemaVersion is pinned to `1` on every write (D-11): the literal floor
// for the schemaVersion-1 config family. Future schema versions land in a
// successor file, not by bumping this literal.

import {
  saveConfig,
  type MarketplaceConfigEntry,
  type PluginConfigEntry,
  type ScopeConfig,
} from "./config-io.ts";

/**
 * Write a marketplace entry by entry-level patch. The `patch` is spread into
 * the existing entry, so unknown forward-compat keys are preserved (D-09 /
 * round-trip integrity per WB-01 SC#4).
 *
 * Source-field contract (reconcile planner / `samePlannedSource`):
 * the caller MUST pass `source` verbatim from the user-typed `rawSource` on
 * the add path; on autoupdate / passthrough paths the existing entry MUST
 * already carry `source`.
 */
export async function writeMarketplaceConfigEntry(
  current: ScopeConfig,
  targetConfigPath: string,
  scopeRoot: string,
  marketplace: string,
  patch: Partial<MarketplaceConfigEntry>,
): Promise<void> {
  const existing = current.marketplaces?.[marketplace] ?? {};
  // S10 (PR #51): the cast is needed because `existing` may be `{}` (no prior
  // entry) and `patch` is a `Partial`, so the spread's inferred type does NOT
  // guarantee the required `source` field. The runtime backstop is
  // `saveConfig`'s `CONFIG_VALIDATOR.Check(config)` at the single sanctioned
  // writer (persistence/config-io.ts::saveConfig): a missing `source` is
  // caught and the write is refused loudly before any bytes hit disk. Callers
  // are responsible for shaping the patch so the merge has a `source`; this
  // cast trusts that contract with the saveConfig schema gate as the safety
  // net.
  const merged: MarketplaceConfigEntry = { ...existing, ...patch } as MarketplaceConfigEntry;
  const patched: ScopeConfig = {
    ...current,
    schemaVersion: 1,
    marketplaces: { ...current.marketplaces, [marketplace]: merged },
  };
  await saveConfig(targetConfigPath, patched, scopeRoot);
}

/**
 * Delete a marketplace entry AND cascade-delete every plugin entry whose
 * key ends in `@<marketplace>`. Mirrors the state-side cascade so reconcile
 * remains a no-op after `marketplace remove`.
 */
export async function deleteMarketplaceConfigEntryWithCascade(
  current: ScopeConfig,
  targetConfigPath: string,
  scopeRoot: string,
  marketplace: string,
): Promise<void> {
  const marketplaces = { ...current.marketplaces };
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- marketplaces is a dynamic-key Record<string, ...>.
  delete marketplaces[marketplace];

  const suffix = `@${marketplace}`;
  const plugins: Record<string, PluginConfigEntry> = {};
  for (const [key, entry] of Object.entries(current.plugins ?? {})) {
    if (!key.endsWith(suffix)) {
      plugins[key] = entry;
    }
  }

  const patched: ScopeConfig = {
    ...current,
    schemaVersion: 1,
    marketplaces,
    plugins,
  };
  await saveConfig(targetConfigPath, patched, scopeRoot);
}

/**
 * Write a plugin entry by entry-level patch. Key is the flat `${plugin}@${marketplace}`
 * form (D-01); unknown forward-compat keys on the existing entry are
 * preserved (D-09).
 */
export async function writePluginConfigEntry(
  current: ScopeConfig,
  targetConfigPath: string,
  scopeRoot: string,
  plugin: string,
  marketplace: string,
  patch: Partial<PluginConfigEntry>,
): Promise<void> {
  const key = `${plugin}@${marketplace}`;
  const existing = current.plugins?.[key] ?? {};
  const merged: PluginConfigEntry = { ...existing, ...patch };
  const patched: ScopeConfig = {
    ...current,
    schemaVersion: 1,
    plugins: { ...current.plugins, [key]: merged },
  };
  await saveConfig(targetConfigPath, patched, scopeRoot);
}

/**
 * Delete one plugin entry. Preserves all other plugin entries and the
 * marketplaces map untouched.
 */
export async function deletePluginConfigEntry(
  current: ScopeConfig,
  targetConfigPath: string,
  scopeRoot: string,
  plugin: string,
  marketplace: string,
): Promise<void> {
  const key = `${plugin}@${marketplace}`;
  const plugins = { ...current.plugins };
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- plugins is a dynamic-key Record<string, ...>.
  delete plugins[key];
  const patched: ScopeConfig = {
    ...current,
    schemaVersion: 1,
    plugins,
  };
  await saveConfig(targetConfigPath, patched, scopeRoot);
}

/**
 * Multi-entry batched patch shape consumed by `writeBatchedConfigEntries`.
 * Both fields are optional records; an entry's patch is spread over the
 * existing entry's value (preserving D-09 unknown keys).
 */
export interface BatchedConfigPatch {
  readonly marketplaces?: Record<string, Partial<MarketplaceConfigEntry>>;
  readonly plugins?: Record<string, Partial<PluginConfigEntry>>;
}

/**
 * WB-03 batched multi-entry patch: read once (caller's responsibility),
 * apply N marketplace + N plugin patches in memory, save ONCE. Used by
 * `import` to record many entries under a single scope lock + a single
 * atomic write -- never N separate saveConfig calls per entry.
 *
 * Structural single-write guarantee: this function contains exactly ONE
 * `await saveConfig(...)` call. Test coverage at
 * `tests/persistence/config-write-back.test.ts` exercises both the unknown
 * forward-compat key preservation property AND the all-N-patches-applied
 * post-condition.
 */
export async function writeBatchedConfigEntries(
  current: ScopeConfig,
  targetConfigPath: string,
  scopeRoot: string,
  batch: BatchedConfigPatch,
): Promise<void> {
  const marketplaces = { ...current.marketplaces };
  for (const [name, patch] of Object.entries(batch.marketplaces ?? {})) {
    const existing = marketplaces[name] ?? {};
    marketplaces[name] = { ...existing, ...patch } as MarketplaceConfigEntry;
  }

  const plugins = { ...current.plugins };
  for (const [key, patch] of Object.entries(batch.plugins ?? {})) {
    plugins[key] = { ...plugins[key], ...patch };
  }

  const patched: ScopeConfig = {
    ...current,
    schemaVersion: 1,
    marketplaces,
    plugins,
  };
  await saveConfig(targetConfigPath, patched, scopeRoot);
}

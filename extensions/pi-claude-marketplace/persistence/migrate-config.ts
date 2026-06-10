// persistence/migrate-config.ts
//
// MIG-01 / MIG-02 / D-04 / D-11 / D-13 / SPLIT-01 / SPLIT-02 / NFR-1 / NFR-10
//
// Pure projection + thin ENOENT-gated orchestrator for first-run migration
// from `state.json` to `claude-plugins.json`. Load-bearing contracts:
//
//   - NFR-1 atomicity inherited from saveConfig -> atomicWriteJson ->
//     write-file-atomic (tmp + fsync + atomic rename).
//   - NFR-10 containment inherited from saveConfig's assertPathInside
//     (SPLIT-02 write-site).
//   - Schema revalidation inherited from CONFIG_VALIDATOR.Check inside
//     saveConfig (caller-bug guard: an in-memory projection that fails the
//     schema fails loudly before any disk touch).
//   - MIG-02 idempotency via the loadConfig trichotomy: only the `absent`
//     arm fires the write. The `invalid` (Pitfall 51-1 / 52-5) and `valid`
//     arms both short-circuit -- no half-set flag, no second probe.
//   - SPLIT-01 cast for the legacy `autoupdate` field per D-13: the field
//     does not appear on STATE_SCHEMA but is preserved in-memory on the
//     first load (gate-closed scrub in migrate.ts) so this projection can
//     capture it before the next load scrubs it.

import { loadConfig, saveConfig, type ScopeConfig } from "./config-io.ts";

import type { ScopedLocations } from "./locations.ts";
import type { ExtensionState } from "./state-io.ts";
import type { ParsedSource } from "../domain/source.ts";

/**
 * MIG-02: result of a first-run migration attempt. The Phase 55 load-wiring
 * caller narrows on `migrated` to decide whether/how to surface the
 * migration via `shared/notify.ts`.
 */
export interface MigrateFirstRunResult {
  readonly migrated: boolean;
  readonly entryCount: number;
  readonly filePath: string;
}

/**
 * MIG-01: pure lossless projection from in-memory ExtensionState to the
 * declarative ScopeConfig shape consumed by Phase 55's reconcile planner.
 *
 * No I/O. Every state marketplace and every plugin (including
 * `compatibility.installable === false` -- Pitfall 52-1) appears in the
 * output. Plugin entries are flat-keyed `${pluginName}@${mpName}` (D-01) so
 * the same plugin name across two marketplaces does not collide
 * (Pitfall 52-6). Each plugin entry body is `{}` per D-04 (defaults applied
 * at consume time).
 *
 * `source` is recovered byte-stably via `(mp.source as ParsedSource).raw`
 * (SP-7 verbatim user input). `autoupdate` is captured per D-13 via the
 * SPLIT-01 cast pattern; only an exact `=== true` or `=== false` reaches
 * the projection (defense-in-depth: any forward-tampered non-boolean is
 * silently dropped).
 *
 * Return shape includes `schemaVersion: 1` per D-11 (self-documenting).
 */
export function buildConfigFromState(state: ExtensionState): ScopeConfig {
  const marketplaces: NonNullable<ScopeConfig["marketplaces"]> = {};
  const plugins: NonNullable<ScopeConfig["plugins"]> = {};

  for (const [mpName, mp] of Object.entries(state.marketplaces)) {
    // SP-7 / Pitfall 52-3: the raw verbatim user input is the contract.
    const sourceRaw = (mp.source as ParsedSource).raw;
    // SPLIT-01 / D-13: legacy field, not on STATE_SCHEMA but preserved
    // in-memory on the first load by the gate-closed migrate.ts scrub.
    const legacyAutoupdate = (mp as unknown as Record<string, unknown>).autoupdate;

    const entry: { source: string; autoupdate?: boolean } = { source: sourceRaw };
    // D-04 omit-when-undefined + defense-in-depth: only exact booleans pass.
    if (legacyAutoupdate === true) {
      entry.autoupdate = true;
    } else if (legacyAutoupdate === false) {
      entry.autoupdate = false;
    }

    marketplaces[mpName] = entry;

    // Pitfall 52-1: iterate plugins UNCONDITIONALLY -- soft-degraded entries
    // (compatibility.installable === false) MUST appear in the projection.
    for (const pluginName of Object.keys(mp.plugins)) {
      plugins[`${pluginName}@${mpName}`] = {};
    }
  }

  return { schemaVersion: 1, marketplaces, plugins };
}

/**
 * MIG-01 + MIG-02 + Pitfall 52-5: thin ENOENT-gated orchestrator.
 *
 * NEVER overwrites a pre-existing `claude-plugins.json` -- neither a valid
 * one nor an invalid (e.g. 0-byte) one. Both arms fall into the same
 * early-return path on `result.status !== "absent"`. Idempotency comes from
 * the loadConfig trichotomy itself (no half-set flag).
 *
 * On the `absent` arm: builds the projection and writes via saveConfig.
 * Atomicity, NFR-10 containment, and CONFIG_VALIDATOR revalidation are all
 * inherited from saveConfig (SPLIT-02 sole sanctioned writer). No notify(),
 * no console.warn -- saveConfig errors propagate; the Phase 55 caller
 * routes messaging through `shared/notify.ts`.
 */
export async function migrateFirstRunConfig(
  loc: ScopedLocations,
  state: ExtensionState,
): Promise<MigrateFirstRunResult> {
  const result = await loadConfig(loc.configJsonPath);
  if (result.status !== "absent") {
    return { migrated: false, entryCount: 0, filePath: loc.configJsonPath };
  }

  const config = buildConfigFromState(state);
  await saveConfig(loc.configJsonPath, config, loc.scopeRoot);
  const entryCount =
    Object.keys(config.marketplaces ?? {}).length + Object.keys(config.plugins ?? {}).length;
  return { migrated: true, entryCount, filePath: loc.configJsonPath };
}

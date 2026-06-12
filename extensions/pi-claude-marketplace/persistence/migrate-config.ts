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
//     arm fires the write. The `invalid` and `valid` arms both
//     short-circuit -- no half-set flag, no second probe.
//   - SPLIT-01 cast for the legacy `autoupdate` field per D-13: the field
//     does not appear on STATE_SCHEMA but is preserved in-memory on the
//     first load (gate-closed scrub in migrate.ts) so this projection can
//     capture it before the next load scrubs it.

import { loadConfig, saveConfig, type ScopeConfig } from "./config-io.ts";

import type { ScopedLocations } from "./locations.ts";
import type { ExtensionState } from "./state-io.ts";
import type { ParsedSource } from "../domain/source.ts";

/**
 * MIG-02: result of a first-run migration attempt.
 *
 * The result is INFORMATIONAL and the load-time caller intentionally
 * discards it. First-run migration is deliberately load-time silent
 * (NFR-2): every successful arm produces no `notify()` call -- the
 * migration succeeds (or short-circuits) below the operator's surface, so
 * starting Pi in a populated scope does not generate a confirmation
 * message for an action the user did not request. This shape exists for
 * tests, future read-only diagnostics, and consumers that want to
 * narrow on the trichotomy without re-probing loadConfig; it is NOT a
 * notify-routing hook.
 *
 * The `migrated: false` arm preserves the loadConfig trichotomy (CFG-03 /
 * D-15) instead of collapsing it, with `error` cut along the `reason`
 * discriminant so it exists ONLY on the `existing-invalid` arm:
 *   - `"existing-valid"` -- config already declared; nothing to do.
 *   - `"existing-invalid"` -- migration suppressed because the config file
 *     is corrupt; `error` carries loadConfig's invalid-arm detail so a
 *     consumer can surface the CFG-03 abort signal without a second
 *     (divergence-prone) loadConfig probe.
 *   - `"empty-state"` -- nothing to capture; an empty-but-present state.json
 *     must NOT spawn an empty claude-plugins.json in every scope root.
 *
 * Cutting `error` along the discriminant means the type system rejects
 * `result.error` reads on the `existing-valid` / `empty-state` arms; the
 * caller MUST narrow on `reason` first.
 */
export type MigrateFirstRunResult =
  | {
      readonly migrated: true;
      readonly entryCount: number;
      readonly filePath: string;
    }
  | {
      readonly migrated: false;
      readonly reason: "existing-valid";
      readonly filePath: string;
    }
  | {
      readonly migrated: false;
      readonly reason: "existing-invalid";
      readonly error: string;
      readonly filePath: string;
    }
  | {
      readonly migrated: false;
      readonly reason: "empty-state";
      readonly filePath: string;
    };

/**
 * MIG-01: pure lossless projection from in-memory ExtensionState to the
 * declarative ScopeConfig shape consumed by the reconcile planner.
 *
 * No I/O. Every state marketplace and every plugin (including
 * `compatibility.installable === false`) appears in the output. Plugin
 * entries are flat-keyed `${pluginName}@${mpName}` (D-01) so the same
 * plugin name across two marketplaces does not collide. Each plugin entry
 * body is `{}` per D-04 (defaults applied at consume time).
 *
 * `source` is recovered byte-stably via `(mp.source as ParsedSource).raw`
 * (SP-7 verbatim user input). Defense-in-depth: `loadState`'s ST-6 funnel
 * admits forward-compat `unknown`-kind source objects verbatim (NFR-12),
 * which may lack a string `raw`; for those the projection coerces the
 * record to its JSON string (the same `objectRaw` policy the
 * `domain/source.ts` parse funnel applies to raw-less objects) so the
 * emitted `source` is ALWAYS a string -- a single forward-compat record
 * must never wedge first-run migration for the whole scope, and no
 * marketplace is ever silently dropped from the projection. `autoupdate`
 * is captured per D-13 via the SPLIT-01 cast pattern; only an exact
 * `=== true` or `=== false` reaches the projection (defense-in-depth: any
 * forward-tampered non-boolean is silently dropped).
 *
 * Return shape includes `schemaVersion: 1` per D-11 (self-documenting).
 */
export function buildConfigFromState(state: ExtensionState): ScopeConfig {
  const marketplaces: NonNullable<ScopeConfig["marketplaces"]> = {};
  const plugins: NonNullable<ScopeConfig["plugins"]> = {};

  for (const [mpName, mp] of Object.entries(state.marketplaces)) {
    // SP-7: the raw verbatim user input is the contract.
    // Defense-in-depth: ST-6 admits unknown-kind source objects without a
    // string `raw` (NFR-12 forward-compat); coerce those to their JSON
    // string so the projection NEVER emits a non-string source (a schema
    // failure here would wedge migration permanently -- the file is never
    // created, so the ENOENT arm re-fires and fails identically forever).
    // Note: sourceLogical() is NOT a safe fallback -- its `unknown` arm
    // returns `.raw`, i.e. undefined for exactly this shape.
    // The Partial cast (vs a bare ParsedSource cast) keeps the guard
    // type-honest: STATE_SCHEMA declares `source: Type.Unknown()`, so `raw`
    // genuinely may be absent here.
    const storedSource = mp.source as Partial<ParsedSource> | null | undefined;
    const sourceRaw =
      typeof storedSource?.raw === "string"
        ? storedSource.raw
        : JSON.stringify(storedSource ?? null);
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

    // Iterate plugins UNCONDITIONALLY -- soft-degraded entries
    // (compatibility.installable === false) MUST appear in the projection.
    for (const pluginName of Object.keys(mp.plugins)) {
      plugins[`${pluginName}@${mpName}`] = {};
    }
  }

  return { schemaVersion: 1, marketplaces, plugins };
}

/**
 * MIG-01 + MIG-02: thin ENOENT-gated orchestrator.
 *
 * NEVER overwrites a pre-existing `claude-plugins.json` -- neither a valid
 * one nor an invalid (e.g. 0-byte) one. Both arms short-circuit before any
 * write, but each carries its own `reason` (and the `invalid` arm forwards
 * loadConfig's `error` detail) so the caller keeps the CFG-03 trichotomy.
 * Idempotency comes from the loadConfig trichotomy itself (no half-set
 * flag).
 *
 * On the `absent` arm: builds the projection and writes via saveConfig.
 * Atomicity, NFR-10 containment, and CONFIG_VALIDATOR revalidation are all
 * inherited from saveConfig (SPLIT-02 sole sanctioned writer). No notify(),
 * no console.warn -- saveConfig errors propagate; the caller routes
 * messaging through `shared/notify.ts`.
 */
export async function migrateFirstRunConfig(
  loc: ScopedLocations,
  state: ExtensionState,
): Promise<MigrateFirstRunResult> {
  const result = await loadConfig(loc.configJsonPath);
  if (result.status === "valid") {
    return { migrated: false, reason: "existing-valid", filePath: loc.configJsonPath };
  }

  if (result.status === "invalid") {
    return {
      migrated: false,
      reason: "existing-invalid",
      error: result.error,
      filePath: loc.configJsonPath,
    };
  }

  const config = buildConfigFromState(state);
  const entryCount =
    Object.keys(config.marketplaces ?? {}).length + Object.keys(config.plugins ?? {}).length;
  if (entryCount === 0) {
    // UAT-01: nothing to capture -- an empty-but-present
    // state.json must NOT spawn an empty claude-plugins.json in every scope
    // root. The config file first appears when there is real desired state to
    // record (migration of a populated state, or command write-back).
    return { migrated: false, reason: "empty-state", filePath: loc.configJsonPath };
  }

  await saveConfig(loc.configJsonPath, config, loc.scopeRoot);
  return { migrated: true, entryCount, filePath: loc.configJsonPath };
}

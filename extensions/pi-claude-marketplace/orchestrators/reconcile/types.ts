// orchestrators/reconcile/types.ts
//
// DIFF-01 (Phase 53 Plan 01) -- pure type surface for the reconcile planner.
//
// `ReconcilePlan` is the structured result of the bidirectional 7-bucket
// diff that `planReconcile(merged, state, scope)` produces. The seven
// buckets partition the union of declared marketplaces + plugins (from
// `MergedConfig`) and recorded marketplaces + plugins (from `ExtensionState`)
// into the actions a future apply path would take:
//
//   1. `marketplacesToAdd`    -- declared but not recorded
//   2. `marketplacesToRemove` -- recorded but not declared
//   3. `pluginsToInstall`     -- declared+enabled but not recorded
//   4. `pluginsToUninstall`   -- recorded but not declared
//   5. `pluginsToEnable`      -- structurally empty in Phase 53 (Pitfall
//                                53-4; Phase 54 wires this to the real
//                                disabled-state check)
//   6. `pluginsToDisable`     -- declared with `enabled === false` but
//                                still recorded
//   7. `sourceMismatches`     -- declared marketplace whose recorded
//                                source disagrees with the declaration
//                                (cause: "source-mismatch") or whose
//                                stored record is in an unrecognised shape
//                                (cause: "unknown-stored")
//
// Every array field is `readonly` so the planner output is immutable at
// the type level and downstream consumers (Plan 02 notify projection,
// Phase 55 apply orchestrator, Phase 56 write-back orchestrator) cannot
// retroactively mutate a plan.
//
// `emptyReconcilePlan(scope)` is the canonical empty target used by the
// Phase 52 deferred convergence proof:
//
//   planReconcile(mergeScopeConfigs(buildConfigFromState(state), {}), state, scope)
//     deepEqual emptyReconcilePlan(scope)
//
// for any populated state.

import type { Scope } from "../../shared/types.ts";

/** Planned addition of a marketplace declared in config but not recorded. */
export interface PlannedMarketplaceAdd {
  readonly scope: Scope;
  readonly marketplace: string;
  /**
   * Raw verbatim user input source string from `MergedConfigEntry.entry.source`
   * (SP-7). The apply path re-parses this through `parsePluginSource` at the
   * point of physical materialization; the planner does NOT pre-parse it.
   */
  readonly source: string;
  /**
   * Provenance from `MergedConfigEntry.source` so Phase 56 write-back can
   * target the correct physical file (`claude-plugins.json` vs
   * `claude-plugins.local.json`) without replaying the merge.
   */
  readonly configSource: "base" | "local";
}

/** Planned removal of a marketplace recorded in state but not declared. */
export interface PlannedMarketplaceRemove {
  readonly scope: Scope;
  readonly marketplace: string;
}

/** Planned install of a plugin declared+enabled in config but not recorded. */
export interface PlannedPluginInstall {
  readonly scope: Scope;
  readonly plugin: string;
  readonly marketplace: string;
  readonly configSource: "base" | "local";
}

/** Planned uninstall of a plugin recorded in state but not declared. */
export interface PlannedPluginUninstall {
  readonly scope: Scope;
  readonly plugin: string;
  readonly marketplace: string;
}

/**
 * Planned enable of a plugin declared+enabled but locally disabled in state.
 *
 * Phase 53 produces this bucket as STRUCTURALLY EMPTY (Pitfall 53-4): the
 * Phase 53 state model has no "currently disabled" marker on a recorded
 * plugin, so the planner cannot distinguish recorded-and-enabled from
 * recorded-and-locally-disabled. Phase 54 introduces the marker and wires
 * this bucket to a real `state.disabled === true` check.
 */
export interface PlannedPluginEnable {
  readonly scope: Scope;
  readonly plugin: string;
  readonly marketplace: string;
}

/**
 * Planned disable of a plugin declared with `enabled === false` but still
 * recorded in state. The apply path removes the materialised artefacts
 * without removing the state record's version pin (D-04 / ENBL-02).
 */
export interface PlannedPluginDisable {
  readonly scope: Scope;
  readonly plugin: string;
  readonly marketplace: string;
}

/**
 * Recorded source diverges from declared source. `cause` distinguishes the
 * two diagnostic modes returned by `samePlannedSource`:
 *
 *   - `"source-mismatch"`  -- both shapes are recognised; the declaration
 *      and the record describe different sources. `declaredSource` is the
 *      raw declaration string; `recordedSource` is the recorded source in
 *      stable diagnostic form (via `sourceLogical(parsePluginSource(...))`).
 *   - `"unknown-stored"`   -- the stored record is in an unrecognised shape
 *      (e.g. manually edited state.json). `declaredSource` is the raw
 *      declaration string; `recordedSource` is `String(stored)` so the
 *      operator can see what the unrecognised value actually is.
 *
 * A third use of the variant captures the DANGLING-REFERENCE diagnostic
 * (a plugin entry whose `${plugin}@${marketplace}` marketplace name does
 * NOT appear in either map): cause `"source-mismatch"`, `declaredSource`
 * is the empty string, `recordedSource` is the literal sentinel
 * `"<marketplace not declared>"`. Phase 55 surfaces this as a
 * planning-time advisory.
 */
export interface PlannedSourceMismatch {
  readonly scope: Scope;
  readonly marketplace: string;
  readonly declaredSource: string;
  readonly recordedSource: string;
  readonly cause: "source-mismatch" | "unknown-stored";
}

/**
 * DIFF-01 result -- the structured output of `planReconcile`. The seven
 * action buckets are mutually exclusive at the (scope, marketplace,
 * plugin?) tuple level (a single entity is in at most one bucket).
 */
export interface ReconcilePlan {
  readonly scope: Scope;
  readonly marketplacesToAdd: readonly PlannedMarketplaceAdd[];
  readonly marketplacesToRemove: readonly PlannedMarketplaceRemove[];
  readonly pluginsToInstall: readonly PlannedPluginInstall[];
  readonly pluginsToUninstall: readonly PlannedPluginUninstall[];
  readonly pluginsToEnable: readonly PlannedPluginEnable[];
  readonly pluginsToDisable: readonly PlannedPluginDisable[];
  readonly sourceMismatches: readonly PlannedSourceMismatch[];
}

/**
 * Canonical empty-plan factory. The Phase 52 deferred convergence proof
 * uses this as the `deepEqual` target.
 */
export function emptyReconcilePlan(scope: Scope): ReconcilePlan {
  return {
    scope,
    marketplacesToAdd: [],
    marketplacesToRemove: [],
    pluginsToInstall: [],
    pluginsToUninstall: [],
    pluginsToEnable: [],
    pluginsToDisable: [],
    sourceMismatches: [],
  };
}

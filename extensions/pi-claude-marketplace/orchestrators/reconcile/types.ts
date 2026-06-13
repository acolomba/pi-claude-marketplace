// orchestrators/reconcile/types.ts
//
// DIFF-01 -- pure type surface for the reconcile planner.
//
// `ReconcilePlan` is the structured result of the bidirectional 7-bucket
// diff that `planReconcile(merged, state, scope)` produces. The seven
// buckets partition the union of declared marketplaces + plugins (from
// `MergedConfig`) and recorded marketplaces + plugins (from `ExtensionState`)
// into the actions the apply path takes:
//
//   1. `marketplacesToAdd`    -- declared but not recorded
//   2. `marketplacesToRemove` -- recorded but not declared
//   3. `pluginsToInstall`     -- declared+enabled but not recorded
//   4. `pluginsToUninstall`   -- recorded but not declared
//   5. `pluginsToEnable`      -- recorded-but-disabled plugins paired with
//                                a config entry that has `enabled !== false`
//                                (recorded-but-disabled marker is "all four
//                                resources arrays empty AND
//                                installable: true" -- see
//                                plan.ts::isRecordedButDisabled)
//   6. `pluginsToDisable`     -- declared with `enabled === false` but
//                                still recorded
//   7. `sourceMismatches`     -- four per-cause planner diagnostics
//                                (`source-mismatch`, `unknown-stored`,
//                                `dangling-reference`, `malformed-plugin-key`);
//                                each variant carries only the fields its
//                                diagnostic actually renders.
//
// Every array field is `readonly` so the planner output is immutable at
// the type level and downstream consumers (notify projection, apply
// orchestrator, write-back orchestrator) cannot retroactively mutate a
// plan.
//
// `emptyReconcilePlan(scope)` is the canonical empty target used by the
// deferred convergence proof:
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
   * Provenance from `MergedConfigEntry.source` so write-back can
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
 * ENBL-02: the planner detects a "currently disabled"
 * recorded plugin via the empty-resources marker -- all four
 * `resources.{skills,prompts,agents,mcpServers}` arrays empty (A1; SPLIT-01
 * preserved, no schema bump). When such a record is paired with a config
 * entry that has `enabled !== false`, the entry lands in this bucket so
 * the apply path can re-materialize the artefacts from cache (no
 * network, NFR-5).
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
 * Recorded source diverges from declared source -- four per-cause variants
 * surface distinct planner diagnostics on a single bucket. Each cause
 * carries only the fields its diagnostic actually renders; the prior fused
 * shape was overloading sentinel strings (`"<marketplace not declared>"`,
 * `"<malformed plugin key>"`) onto data fields and punning `marketplace` as
 * a raw config-key carrier. The discriminant-cut variants close those
 * misreads at the type level.
 *
 *   - `"source-mismatch"` -- both shapes are recognised; the declaration
 *      and the record describe different sources. `declaredSource` is the
 *      raw declaration string; `recordedSource` is the recorded source in
 *      stable diagnostic form (via `sourceLogical(parsePluginSource(...))`).
 *   - `"unknown-stored"` -- the stored record is in an unrecognised shape
 *      (e.g. manually edited state.json). `declaredSource` is the raw
 *      declaration string; `recordedSource` is `String(stored)` so the
 *      operator can see what the unrecognised value actually is.
 *   - `"dangling-reference"` -- a plugin entry whose
 *      `${plugin}@${marketplace}` marketplace name is NOT declared in the
 *      merged config. `marketplace` is the undeclared marketplace name and
 *      `plugin` (required) is the plugin component of the offending config
 *      key so N dangling plugins under one undeclared marketplace stay
 *      individually attributable.
 *   - `"malformed-plugin-key"` -- a declared plugin key `parsePluginKey`
 *      rejects (no `@`, leading `@`, trailing `@`). `rawKey` carries the
 *      raw config key as the renderable subject -- the entry surfaces as a
 *      `(failed)` row instead of being silently omitted. The field is
 *      `rawKey`, NOT a punned `marketplace`, so the type system enforces
 *      "this is the user's typo, not a real marketplace name".
 */
export interface PlannedSourceMismatchOfSourceMismatch {
  readonly scope: Scope;
  readonly cause: "source-mismatch";
  readonly marketplace: string;
  readonly declaredSource: string;
  readonly recordedSource: string;
}

export interface PlannedSourceMismatchOfUnknownStored {
  readonly scope: Scope;
  readonly cause: "unknown-stored";
  readonly marketplace: string;
  readonly declaredSource: string;
  readonly recordedSource: string;
}

export interface PlannedSourceMismatchOfDanglingReference {
  readonly scope: Scope;
  readonly cause: "dangling-reference";
  readonly marketplace: string;
  readonly plugin: string;
}

export interface PlannedSourceMismatchOfMalformedPluginKey {
  readonly scope: Scope;
  readonly cause: "malformed-plugin-key";
  readonly rawKey: string;
}

export type PlannedSourceMismatch =
  | PlannedSourceMismatchOfSourceMismatch
  | PlannedSourceMismatchOfUnknownStored
  | PlannedSourceMismatchOfDanglingReference
  | PlannedSourceMismatchOfMalformedPluginKey;

/**
 * Derive the renderable subject (the `name` keying the
 * `(scope, name)` MarketplaceBlock) from a `PlannedSourceMismatch`. For
 * source-mismatch / unknown-stored / dangling-reference the subject is the
 * marketplace name; for malformed-plugin-key the subject is the raw config
 * key. Keeping this in one place lets the renderers stay byte-identical
 * across the four causes.
 */
export function plannedSourceMismatchSubject(mismatch: PlannedSourceMismatch): string {
  return mismatch.cause === "malformed-plugin-key" ? mismatch.rawKey : mismatch.marketplace;
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
 * Canonical empty-plan factory. The deferred convergence proof
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

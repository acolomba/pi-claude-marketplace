// orchestrators/reconcile/plan.ts
//
// DIFF-01 pure bidirectional 7-bucket diff between MergedConfig and
// ExtensionState. NEVER touches the disk or network. The architecture
// purity gate at `tests/architecture/reconcile-planner-purity.test.ts`
// structurally enforces zero effectful imports (no node:fs, no platform
// git, no save*/withState*/withLockedStateTransaction, no notify).
//
// Source comparison delegates to `samePlannedSource` (moved to
// `domain/source.ts` in Phase 53 Plan 01) so the planner imports only
// leaf-pure helpers from `domain/source.ts`.
//
// Disabled-entry rule (Pitfall 53-2): a plugin entry with
// `enabled === false` is declared-but-disabled; `=== true` OR `undefined`
// is declared-and-enabled (D-04 consume-time default -- the absent field
// includes, only an explicit `false` excludes).
//
// Phase 53 hand-off (Pitfall 53-4): `pluginsToEnable` is structurally
// empty for any Phase 53 input. The state model has no "currently
// disabled" marker on a recorded plugin, so the planner cannot
// distinguish recorded-and-enabled from recorded-and-locally-disabled.
// Phase 54 will wire this bucket to a real `state.disabled === true`
// check.
//
// Plugin-key parser (D-01 / Pitfall 52-6 / Pitfall 53-?): flat-keyed
// plugin entries are parsed by `lastIndexOf("@")` so a plugin name
// containing `@` (e.g. `"evil@evil@marketplace"` parses to plugin
// `"evil@evil"` and marketplace `"marketplace"`) does not collide.
//
// Dangling-reference contract: a plugin entry whose
// `${plugin}@${marketplace}` marketplace name appears in neither map is
// recorded as a `PlannedSourceMismatch` with cause `"source-mismatch"`,
// `declaredSource: ""`, and `recordedSource: "<marketplace not declared>"`.
// The sentinel is stable so Phase 55 can render it without ambiguity.

import { parsePluginSource, samePlannedSource, sourceLogical } from "../../domain/source.ts";

import { emptyReconcilePlan } from "./types.ts";

import type {
  PlannedMarketplaceAdd,
  PlannedMarketplaceRemove,
  PlannedPluginDisable,
  PlannedPluginInstall,
  PlannedPluginUninstall,
  PlannedSourceMismatch,
  ReconcilePlan,
} from "./types.ts";
import type { MergedConfig } from "../../persistence/config-merge.ts";
import type { ExtensionState } from "../../persistence/state-io.ts";
import type { Scope } from "../../shared/types.ts";

/** Sentinel for the dangling-plugin-reference diagnostic. */
const MARKETPLACE_NOT_DECLARED = "<marketplace not declared>";

/**
 * Parse a flat-keyed plugin entry `"${plugin}@${marketplace}"` into its
 * components by `lastIndexOf("@")`. This admits plugin names containing
 * `@` (e.g. `"evil@evil@marketplace"` -> plugin `"evil@evil"`, marketplace
 * `"marketplace"`).
 *
 * Returns `undefined` for malformed keys (no `@`, empty plugin, empty
 * marketplace); the planner silently skips them. The CONFIG_SCHEMA upstream
 * permits any string key so a typo cannot wedge the planner.
 */
function parsePluginKey(key: string): { plugin: string; marketplace: string } | undefined {
  const at = key.lastIndexOf("@");
  if (at <= 0 || at === key.length - 1) {
    return undefined;
  }

  const plugin = key.slice(0, at);
  const marketplace = key.slice(at + 1);
  return { plugin, marketplace };
}

interface MarketplaceDiff {
  readonly add: readonly PlannedMarketplaceAdd[];
  readonly remove: readonly PlannedMarketplaceRemove[];
  readonly mismatches: readonly PlannedSourceMismatch[];
  /** Set of marketplace names that are declared AND recorded. */
  readonly declaredAndRecorded: ReadonlySet<string>;
}

function diffMarketplaces(
  merged: MergedConfig,
  state: ExtensionState,
  scope: Scope,
): MarketplaceDiff {
  const add: PlannedMarketplaceAdd[] = [];
  const remove: PlannedMarketplaceRemove[] = [];
  const mismatches: PlannedSourceMismatch[] = [];
  const declaredAndRecorded = new Set<string>();

  const declared = merged.marketplaces;
  const recorded = state.marketplaces;

  for (const [mpName, declaredEntry] of Object.entries(declared)) {
    const recordedRecord = recorded[mpName];
    if (recordedRecord === undefined) {
      add.push({
        scope,
        marketplace: mpName,
        source: declaredEntry.entry.source,
        configSource: declaredEntry.source,
      });
      continue;
    }

    declaredAndRecorded.add(mpName);
    const match = samePlannedSource(recordedRecord.source, declaredEntry.entry.source);
    if (match === true) {
      // Steady state -- no action.
      continue;
    }

    if (match === "unknown-stored") {
      mismatches.push({
        scope,
        marketplace: mpName,
        declaredSource: declaredEntry.entry.source,
        recordedSource: String(recordedRecord.source),
        cause: "unknown-stored",
      });
      continue;
    }

    // Recognised stored source, but different from declaration: render the
    // recorded source via sourceLogical for a stable diagnostic form.
    mismatches.push({
      scope,
      marketplace: mpName,
      declaredSource: declaredEntry.entry.source,
      recordedSource: sourceLogical(parsePluginSource(recordedRecord.source)),
      cause: "source-mismatch",
    });
  }

  for (const mpName of Object.keys(recorded)) {
    if (declared[mpName] === undefined) {
      remove.push({ scope, marketplace: mpName });
    }
  }

  return { add, remove, mismatches, declaredAndRecorded };
}

interface PluginDiff {
  readonly install: readonly PlannedPluginInstall[];
  readonly uninstall: readonly PlannedPluginUninstall[];
  readonly disable: readonly PlannedPluginDisable[];
  readonly dangling: readonly PlannedSourceMismatch[];
}

function buildRecordedKeys(state: ExtensionState): Set<string> {
  const recordedKeys = new Set<string>();
  for (const [mpName, mpRecord] of Object.entries(state.marketplaces)) {
    for (const pluginName of Object.keys(mpRecord.plugins)) {
      recordedKeys.add(`${pluginName}@${mpName}`);
    }
  }

  return recordedKeys;
}

function buildMarketplaceUniverse(merged: MergedConfig, state: ExtensionState): Set<string> {
  return new Set<string>([...Object.keys(merged.marketplaces), ...Object.keys(state.marketplaces)]);
}

interface DeclaredPluginAccumulator {
  readonly install: PlannedPluginInstall[];
  readonly disable: PlannedPluginDisable[];
  readonly dangling: PlannedSourceMismatch[];
}

/**
 * Classify a single declared plugin entry into install / disable / dangling
 * buckets (or a steady-state no-op). Extracted out of `diffPlugins` to keep
 * the cognitive complexity of the iteration body low.
 */
function classifyDeclaredPlugin(
  acc: DeclaredPluginAccumulator,
  scope: Scope,
  key: string,
  declared: MergedConfig["plugins"][string],
  recordedKeys: ReadonlySet<string>,
  marketplaceUniverse: ReadonlySet<string>,
): void {
  const parsed = parsePluginKey(key);
  if (parsed === undefined) {
    return;
  }

  const { plugin, marketplace } = parsed;

  if (!marketplaceUniverse.has(marketplace)) {
    acc.dangling.push({
      scope,
      marketplace,
      declaredSource: "",
      recordedSource: MARKETPLACE_NOT_DECLARED,
      cause: "source-mismatch",
    });
    return;
  }

  // D-04 consume-time default: `enabled === false` excludes; everything
  // else (true or undefined) includes.
  const enabledExplicitFalse = declared.entry.enabled === false;
  const recorded = recordedKeys.has(key);

  if (enabledExplicitFalse) {
    if (recorded) {
      // Declared-disabled but still recorded: drop materialised artefacts
      // without removing the version pin (D-04 / ENBL-02).
      acc.disable.push({ scope, plugin, marketplace });
    }

    return;
  }

  if (!recorded) {
    acc.install.push({ scope, plugin, marketplace, configSource: declared.source });
  }
  // Declared-enabled and recorded: steady state, no action.
  //
  // Phase 54 hand-off (Pitfall 53-4): this branch will later split on a
  // `state.disabled === true` marker to populate `pluginsToEnable`. In
  // Phase 53 the marker does not exist, so the bucket stays empty.
}

/**
 * Walk the recorded plugins and accumulate the uninstall bucket. Only
 * consider recorded plugins whose marketplace is still recorded (a
 * marketplace in `marketplacesToRemove` will be torn down whole-cloth by
 * the apply path; listing each plugin under it as a separate uninstall
 * would double-bill the work).
 */
function buildUninstallBucket(
  merged: MergedConfig,
  state: ExtensionState,
  scope: Scope,
  marketplaceDiff: MarketplaceDiff,
): PlannedPluginUninstall[] {
  const uninstall: PlannedPluginUninstall[] = [];
  for (const [mpName, mpRecord] of Object.entries(state.marketplaces)) {
    if (!merged.marketplaces[mpName] && !marketplaceDiff.declaredAndRecorded.has(mpName)) {
      continue;
    }

    for (const pluginName of Object.keys(mpRecord.plugins)) {
      const key = `${pluginName}@${mpName}`;
      if (merged.plugins[key] === undefined) {
        uninstall.push({ scope, plugin: pluginName, marketplace: mpName });
      }
    }
  }

  return uninstall;
}

function diffPlugins(
  merged: MergedConfig,
  state: ExtensionState,
  scope: Scope,
  marketplaceDiff: MarketplaceDiff,
): PluginDiff {
  const acc: DeclaredPluginAccumulator = { install: [], disable: [], dangling: [] };
  const recordedKeys = buildRecordedKeys(state);
  const marketplaceUniverse = buildMarketplaceUniverse(merged, state);

  for (const [key, declared] of Object.entries(merged.plugins)) {
    classifyDeclaredPlugin(acc, scope, key, declared, recordedKeys, marketplaceUniverse);
  }

  const uninstall = buildUninstallBucket(merged, state, scope, marketplaceDiff);

  return {
    install: acc.install,
    uninstall,
    disable: acc.disable,
    dangling: acc.dangling,
  };
}

/**
 * DIFF-01 pure bidirectional 7-bucket diff. Produces a `ReconcilePlan`
 * describing the actions required to make `state` converge to `merged`.
 *
 * Pure: no I/O, no network, no notify, no state mutation. Re-runs against
 * the same inputs produce deepEqual outputs.
 *
 * O(N + M) in the union of declared + recorded entries (no per-entry regex
 * compilation, no nested scans).
 */
export function planReconcile(
  merged: MergedConfig,
  state: ExtensionState,
  scope: Scope,
): ReconcilePlan {
  const marketplaceDiff = diffMarketplaces(merged, state, scope);
  const pluginDiff = diffPlugins(merged, state, scope, marketplaceDiff);

  // Fast path: empty inputs -> empty plan (deterministic shape).
  const totalAdds = marketplaceDiff.add.length;
  const totalRemoves = marketplaceDiff.remove.length;
  const totalInstalls = pluginDiff.install.length;
  const totalUninstalls = pluginDiff.uninstall.length;
  const totalDisables = pluginDiff.disable.length;
  const totalMismatches = marketplaceDiff.mismatches.length + pluginDiff.dangling.length;

  if (
    totalAdds === 0 &&
    totalRemoves === 0 &&
    totalInstalls === 0 &&
    totalUninstalls === 0 &&
    totalDisables === 0 &&
    totalMismatches === 0
  ) {
    return emptyReconcilePlan(scope);
  }

  return {
    scope,
    marketplacesToAdd: marketplaceDiff.add,
    marketplacesToRemove: marketplaceDiff.remove,
    pluginsToInstall: pluginDiff.install,
    pluginsToUninstall: pluginDiff.uninstall,
    pluginsToEnable: [],
    pluginsToDisable: pluginDiff.disable,
    sourceMismatches: [...marketplaceDiff.mismatches, ...pluginDiff.dangling],
  };
}

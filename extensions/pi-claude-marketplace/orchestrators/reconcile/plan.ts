// orchestrators/reconcile/plan.ts
//
// DIFF-01 pure bidirectional 7-bucket diff between MergedConfig and
// ExtensionState. NEVER touches the disk or network. The architecture
// purity gate at `tests/architecture/reconcile-planner-purity.test.ts`
// structurally enforces zero effectful imports (no node:fs, no platform
// git, no save*/withState*/withLockedStateTransaction, no notify).
//
// Source comparison delegates to `samePlannedSource` (in
// `domain/source.ts`) so the planner imports only leaf-pure helpers from
// `domain/source.ts`.
//
// Disabled-entry rule: a plugin entry with `enabled === false` is
// declared-but-disabled; `=== true` OR `undefined` is declared-and-enabled
// (D-04 consume-time default -- the absent field includes, only an explicit
// `false` excludes).
//
// ENBL-02 / ENBL-05: the recorded-but-disabled hand-off closes here.
// `isRecordedButDisabled(record)` (the single definition in
// `persistence/state-io.ts`) reads the explicit `enabled` field and nothing
// else. An explicit `enabled: false` -- written only by the disable
// orchestrator -- is the sole "currently disabled" marker; absence of the
// field after migration is treated as enabled.
//
// Plugin-key parser (D-01): flat-keyed plugin entries are parsed by
// `lastIndexOf("@")` so a plugin name containing `@` (e.g.
// `"evil@evil@marketplace"` parses to plugin `"evil@evil"` and marketplace
// `"marketplace"`) does not collide.
//
// Dangling-reference contract: a plugin entry whose
// `${plugin}@${marketplace}` marketplace name is NOT declared in the merged
// config is recorded as a `PlannedSourceMismatch` with cause
// `"dangling-reference"`, `marketplace` set to the undeclared marketplace
// name, and `plugin` set to the offending plugin name. The check is against
// the DECLARED map (not the declared+recorded union): a plugin declared
// under a marketplace that exists only in state (i.e. the marketplace is in
// `marketplacesToRemove`) is dangling too -- classifying it as an
// install/disable would emit a self-contradictory plan (removing the
// marketplace AND installing into it) that the apply path would consume
// verbatim.
//
// Malformed-key contract: a declared plugin key `parsePluginKey` rejects
// (no `@`, leading `@`, trailing `@`) is recorded as a
// `PlannedSourceMismatch` with cause `"malformed-plugin-key"` and the RAW
// key carried in `rawKey` as the renderable subject -- the entry surfaces
// as a `(failed)` row instead of being silently omitted.

import { parsePluginSource, samePlannedSource, sourceLogical } from "../../domain/source.ts";
import { isDeclaredEnabled } from "../../persistence/config-io.ts";
import { isRecordedButDisabled } from "../../persistence/state-io.ts";

import { emptyReconcilePlan } from "./types.ts";

import type {
  PlannedMarketplaceAdd,
  PlannedMarketplaceRemove,
  PlannedPluginDisable,
  PlannedPluginEnable,
  PlannedPluginInstall,
  PlannedPluginUninstall,
  PlannedSourceMismatch,
  ReconcilePlan,
} from "./types.ts";
import type { MergedConfig } from "../../persistence/config-merge.ts";
import type { ExtensionState } from "../../persistence/state-io.ts";
import type { Scope } from "../../shared/types.ts";

/**
 * Parse a flat-keyed plugin entry `"${plugin}@${marketplace}"` into its
 * components by `lastIndexOf("@")`. This admits plugin names containing
 * `@` (e.g. `"evil@evil@marketplace"` -> plugin `"evil@evil"`, marketplace
 * `"marketplace"`).
 *
 * Returns `undefined` for malformed keys (no `@`, empty plugin, empty
 * marketplace). The caller surfaces such keys as a `PlannedSourceMismatch`
 * diagnostic carrying the raw key -- not-wedging (the CONFIG_SCHEMA upstream
 * permits any string key so a typo cannot wedge the planner) and
 * not-reporting are different requirements: a declared entry the pending
 * command silently omits would hide exactly the config↔state divergence the
 * command exists to surface.
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
  /** Canonical recorded marketplace identity for each fulfilled declaration. */
  readonly recordedByDeclared: ReadonlyMap<string, string>;
  /** Declarations whose source claim is ambiguous or multiply claimed. */
  readonly conflictedDeclared: ReadonlySet<string>;
  /** Recorded candidates retained unchanged while their claim is conflicted. */
  readonly conflictedRecorded: ReadonlySet<string>;
}

interface PendingMarketplaceClaim {
  readonly declaredMarketplace: string;
  readonly declaredSource: string;
  readonly candidateMarketplace: string;
}

interface MarketplaceClaimConflict {
  readonly declaredMarketplace: string;
  readonly declaredSource: string;
  readonly recordedSource: string;
}

interface MarketplaceClaims {
  readonly recordedByDeclared: ReadonlyMap<string, string>;
  readonly conflicts: readonly MarketplaceClaimConflict[];
  readonly conflictedDeclared: ReadonlySet<string>;
  readonly conflictedRecorded: ReadonlySet<string>;
}

interface MarketplaceClaimAccumulator {
  readonly recordedByDeclared: Map<string, string>;
  readonly conflicts: MarketplaceClaimConflict[];
  readonly pending: PendingMarketplaceClaim[];
  readonly conflictedRecorded: Set<string>;
}

function recordedSourceCandidates(
  recorded: ExtensionState["marketplaces"],
  declared: MergedConfig["marketplaces"],
  declaredSource: string,
): string[] {
  const candidates: string[] = [];
  for (const [name, record] of Object.entries(recorded)) {
    if (declared[name] !== undefined) {
      continue;
    }

    if (samePlannedSource(record.source, declaredSource) === "same") {
      candidates.push(name);
    }
  }

  return candidates.sort();
}

function collectMarketplaceClaim(
  acc: MarketplaceClaimAccumulator,
  declaredMarketplace: string,
  declaredEntry: MergedConfig["marketplaces"][string],
  declared: MergedConfig["marketplaces"],
  recorded: ExtensionState["marketplaces"],
): void {
  if (recorded[declaredMarketplace] !== undefined) {
    acc.recordedByDeclared.set(declaredMarketplace, declaredMarketplace);
    return;
  }

  const candidates = recordedSourceCandidates(recorded, declared, declaredEntry.entry.source);
  if (candidates.length > 1) {
    acc.conflicts.push({
      declaredMarketplace,
      declaredSource: declaredEntry.entry.source,
      recordedSource: `ambiguous recorded marketplaces: ${candidates.join(", ")}`,
    });
    for (const candidate of candidates) {
      acc.conflictedRecorded.add(candidate);
    }

    return;
  }

  for (const candidateMarketplace of candidates) {
    acc.pending.push({
      declaredMarketplace,
      declaredSource: declaredEntry.entry.source,
      candidateMarketplace,
    });
  }
}

function indexPendingClaims(
  pending: readonly PendingMarketplaceClaim[],
): ReadonlyMap<string, readonly PendingMarketplaceClaim[]> {
  const pendingByRecorded = new Map<string, PendingMarketplaceClaim[]>();
  for (const claim of pending) {
    const claims = pendingByRecorded.get(claim.candidateMarketplace) ?? [];
    claims.push(claim);
    pendingByRecorded.set(claim.candidateMarketplace, claims);
  }

  return pendingByRecorded;
}

function resolvePendingClaims(acc: MarketplaceClaimAccumulator): void {
  for (const [candidateMarketplace, claims] of indexPendingClaims(acc.pending)) {
    if (claims.length === 1) {
      for (const claim of claims) {
        acc.recordedByDeclared.set(claim.declaredMarketplace, candidateMarketplace);
      }

      continue;
    }

    acc.conflictedRecorded.add(candidateMarketplace);
    for (const claim of claims) {
      acc.conflicts.push({
        declaredMarketplace: claim.declaredMarketplace,
        declaredSource: claim.declaredSource,
        recordedSource: `recorded marketplace claimed by multiple declarations: ${candidateMarketplace}`,
      });
    }
  }
}

/** Resolves all source claims before any mutation bucket is built. */
function buildMarketplaceClaims(
  declared: MergedConfig["marketplaces"],
  recorded: ExtensionState["marketplaces"],
): MarketplaceClaims {
  const acc: MarketplaceClaimAccumulator = {
    recordedByDeclared: new Map<string, string>(),
    conflicts: [],
    pending: [],
    conflictedRecorded: new Set<string>(),
  };

  for (const [declaredMarketplace, declaredEntry] of Object.entries(declared)) {
    collectMarketplaceClaim(acc, declaredMarketplace, declaredEntry, declared, recorded);
  }

  resolvePendingClaims(acc);
  acc.conflicts.sort((left, right) =>
    left.declaredMarketplace.localeCompare(right.declaredMarketplace),
  );
  return {
    recordedByDeclared: acc.recordedByDeclared,
    conflicts: acc.conflicts,
    conflictedDeclared: new Set(acc.conflicts.map((conflict) => conflict.declaredMarketplace)),
    conflictedRecorded: acc.conflictedRecorded,
  };
}

function diffMarketplaces(
  merged: MergedConfig,
  state: ExtensionState,
  scope: Scope,
): MarketplaceDiff {
  const add: PlannedMarketplaceAdd[] = [];
  const remove: PlannedMarketplaceRemove[] = [];
  const mismatches: PlannedSourceMismatch[] = [];
  const declared = merged.marketplaces;
  const recorded = state.marketplaces;
  const claims = buildMarketplaceClaims(declared, recorded);
  const retainedRecorded = new Set(claims.recordedByDeclared.values());

  for (const [mpName, declaredEntry] of Object.entries(declared)) {
    if (claims.conflictedDeclared.has(mpName)) {
      continue;
    }

    const recordedRecord = recorded[mpName];
    if (recordedRecord === undefined) {
      // A unique source match means the declaration is already fulfilled by
      // the recorded canonical identity. Planning an add here would clone it
      // on every load and create perpetual remove/re-add churn.
      if (claims.recordedByDeclared.has(mpName)) {
        continue;
      }

      add.push({
        scope,
        marketplace: mpName,
        source: declaredEntry.entry.source,
        configSource: declaredEntry.source,
      });
      continue;
    }

    const match = samePlannedSource(recordedRecord.source, declaredEntry.entry.source);
    switch (match) {
      case "same":
        // Steady state -- no action.
        continue;
      case "unknown-stored":
        mismatches.push({
          scope,
          cause: "unknown-stored",
          marketplace: mpName,
          declaredSource: declaredEntry.entry.source,
          recordedSource: String(recordedRecord.source),
        });
        continue;
      case "different":
        // Recognised stored source, but different from declaration: render
        // the recorded source via sourceLogical for a stable diagnostic form.
        mismatches.push({
          scope,
          cause: "source-mismatch",
          marketplace: mpName,
          declaredSource: declaredEntry.entry.source,
          recordedSource: sourceLogical(parsePluginSource(recordedRecord.source)),
        });
        continue;
    }
  }

  for (const conflict of claims.conflicts) {
    mismatches.push({
      scope,
      cause: "source-mismatch",
      marketplace: conflict.declaredMarketplace,
      declaredSource: conflict.declaredSource,
      recordedSource: conflict.recordedSource,
    });
  }

  for (const [mpName, mpRecord] of Object.entries(recorded)) {
    // A claimed canonical record remains steady state. Conflict candidates
    // also remain untouched: ambiguity is report-only and must fail closed.
    if (!retainedRecorded.has(mpName) && !claims.conflictedRecorded.has(mpName)) {
      // WILL-03 / D-65.1-03: carry the recorded plugin names so the PENDING
      // projection can synthesize per-plugin `will uninstall` rows. The apply
      // path cascades these internally; do NOT add them to `pluginsToUninstall`
      // (buildUninstallBucket skips removed-marketplace plugins to avoid
      // double-billing).
      remove.push({ scope, marketplace: mpName, plugins: Object.keys(mpRecord.plugins) });
    }
  }

  return {
    add,
    remove,
    mismatches,
    recordedByDeclared: claims.recordedByDeclared,
    conflictedDeclared: claims.conflictedDeclared,
    conflictedRecorded: claims.conflictedRecorded,
  };
}

interface PluginDiff {
  readonly install: readonly PlannedPluginInstall[];
  readonly uninstall: readonly PlannedPluginUninstall[];
  readonly enable: readonly PlannedPluginEnable[];
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

interface DeclaredPluginAccumulator {
  readonly install: PlannedPluginInstall[];
  readonly enable: PlannedPluginEnable[];
  readonly disable: PlannedPluginDisable[];
  readonly dangling: PlannedSourceMismatch[];
  readonly declaredKeys: Set<string>;
}

/**
 * Classify a single declared plugin entry into install / enable / disable /
 * dangling buckets (or a steady-state no-op). Extracted out of `diffPlugins`
 * to keep the cognitive complexity of the iteration body low.
 */
function classifyDeclaredPlugin(
  acc: DeclaredPluginAccumulator,
  scope: Scope,
  key: string,
  declared: MergedConfig["plugins"][string],
  recordedKeys: ReadonlySet<string>,
  declaredMarketplaces: MergedConfig["marketplaces"],
  marketplaceDiff: MarketplaceDiff,
  state: ExtensionState,
): void {
  const parsed = parsePluginKey(key);
  if (parsed === undefined) {
    // Malformed key (no `@`, leading `@`, or trailing `@`, e.g. the user
    // forgot the `@marketplace` suffix). Surface a diagnostic carrying the
    // raw key as the renderable subject instead of silently omitting the
    // entry.
    acc.dangling.push({
      scope,
      cause: "malformed-plugin-key",
      rawKey: key,
    });
    return;
  }

  const { plugin, marketplace: declaredMarketplace } = parsed;

  // Dangling reference: the plugin's marketplace is not DECLARED. This
  // deliberately includes the recorded-but-undeclared case (the marketplace
  // is in `marketplacesToRemove`): installing into / disabling under a
  // marketplace being torn down is contradictory, so the entry surfaces as
  // a diagnostic instead of an install/disable action.
  if (declaredMarketplaces[declaredMarketplace] === undefined) {
    acc.dangling.push({
      scope,
      cause: "dangling-reference",
      marketplace: declaredMarketplace,
      plugin,
    });
    return;
  }

  if (marketplaceDiff.conflictedDeclared.has(declaredMarketplace)) {
    return;
  }

  const marketplace =
    marketplaceDiff.recordedByDeclared.get(declaredMarketplace) ?? declaredMarketplace;
  acc.declaredKeys.add(`${plugin}@${marketplace}`);

  // D-04 consume-time default via S7's `isDeclaredEnabled`: an absent
  // `enabled` field includes; only an explicit `false` excludes.
  const enabledExplicitFalse = !isDeclaredEnabled(declared.entry);
  const recorded = recordedKeys.has(`${plugin}@${marketplace}`);

  if (enabledExplicitFalse) {
    // WR-05 convergence: the terminal state of a successful disable is
    // exactly "recorded with config `enabled: false`" (ENBL-02 keeps the
    // record). ENBL-18 / D-100-10: disable changes `enabled` and `updatedAt`
    // and nothing else -- `resources.*` and `hookEntries` are PRESERVED and are
    // no part of the marker, which is why the guard below reads
    // `isRecordedButDisabled` alone and must never re-acquire an inventory
    // test. That steady state is NOT a config<->state divergence -- pushing a
    // disable for it would render `(will disable)` forever and make the apply
    // path re-run a no-op disable on every reload. Only a recorded record that
    // is NOT already disabled (artifacts still materialised) needs the action --
    // symmetric with the enable branch's "recorded + enabled" steady state
    // below.
    const record = state.marketplaces[marketplace]?.plugins[plugin];
    if (recorded && record !== undefined && !isRecordedButDisabled(record)) {
      // Declared-disabled but still materialised: drop artifacts without
      // removing the version pin (D-04 / ENBL-02).
      acc.disable.push({ scope, plugin, marketplace });
    }

    return;
  }

  if (!recorded) {
    acc.install.push({ scope, plugin, marketplace, configSource: declared.source });
    return;
  }

  // Recorded + declared-enabled: split on the explicit `enabled: false`
  // marker (ENBL-05 / isRecordedButDisabled). The install branch above already
  // returned for `!recorded`, so a plugin CAN'T land in both `install` and
  // `enable` in the same pass.
  const record = state.marketplaces[marketplace]?.plugins[plugin];
  if (record !== undefined && isRecordedButDisabled(record)) {
    acc.enable.push({ scope, plugin, marketplace });
  }
  // Declared-enabled, recorded, not disabled: steady state, no action. The
  // record's inventory is not consulted -- ENBL-18 keeps it populated across a
  // disable, so it distinguishes nothing here.
}

/**
 * Walk the recorded plugins and accumulate the uninstall bucket. Only
 * consider recorded plugins whose marketplace is still recorded (a
 * marketplace in `marketplacesToRemove` will be torn down whole-cloth by
 * the apply path; listing each plugin under it as a separate uninstall
 * would double-bill the work).
 */
function buildUninstallBucket(
  state: ExtensionState,
  scope: Scope,
  marketplaceDiff: MarketplaceDiff,
  declaredPluginKeys: ReadonlySet<string>,
): PlannedPluginUninstall[] {
  const uninstall: PlannedPluginUninstall[] = [];
  const retainedMarketplaces = new Set(marketplaceDiff.recordedByDeclared.values());
  for (const [mpName, mpRecord] of Object.entries(state.marketplaces)) {
    if (marketplaceDiff.conflictedRecorded.has(mpName)) {
      continue;
    }

    if (!retainedMarketplaces.has(mpName)) {
      continue;
    }

    for (const pluginName of Object.keys(mpRecord.plugins)) {
      const key = `${pluginName}@${mpName}`;
      if (!declaredPluginKeys.has(key)) {
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
  const acc: DeclaredPluginAccumulator = {
    install: [],
    enable: [],
    disable: [],
    dangling: [],
    declaredKeys: new Set<string>(),
  };
  const recordedKeys = buildRecordedKeys(state);

  for (const [key, declared] of Object.entries(merged.plugins)) {
    classifyDeclaredPlugin(
      acc,
      scope,
      key,
      declared,
      recordedKeys,
      merged.marketplaces,
      marketplaceDiff,
      state,
    );
  }

  const uninstall = buildUninstallBucket(state, scope, marketplaceDiff, acc.declaredKeys);

  return {
    install: acc.install,
    uninstall,
    enable: acc.enable,
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
  const totalEnables = pluginDiff.enable.length;
  const totalDisables = pluginDiff.disable.length;
  const totalMismatches = marketplaceDiff.mismatches.length + pluginDiff.dangling.length;

  if (
    totalAdds === 0 &&
    totalRemoves === 0 &&
    totalInstalls === 0 &&
    totalUninstalls === 0 &&
    totalEnables === 0 &&
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
    pluginsToEnable: pluginDiff.enable,
    pluginsToDisable: pluginDiff.disable,
    sourceMismatches: [...marketplaceDiff.mismatches, ...pluginDiff.dangling],
  };
}

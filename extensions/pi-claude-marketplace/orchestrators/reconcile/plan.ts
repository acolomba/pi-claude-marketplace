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
// ENBL-02: the recorded-but-disabled hand-off closes here.
// `isRecordedButDisabled(record)` reads the explicit `enabled` field:
// `record.compatibility.installable && !record.enabled`. An explicit
// `enabled: false` (set by the disable orchestrator) is the sole
// "currently disabled" marker; absence of the field after migration
// is treated as enabled.
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
  /** Set of marketplace names that are declared AND recorded. */
  readonly declaredAndRecorded: ReadonlySet<string>;
}

/**
 * CR-01: find a recorded marketplace that carries the SAME
 * source as a declared entry whose config key matched no recorded name.
 * `addMarketplace` records under the MANIFEST-derived name -- which the user
 * cannot know in advance and which the config key does not have to match.
 * Without source-based matching, a declared key that differs from the
 * manifest name would oscillate forever: every reload would plan an add
 * (a network clone for github sources -- NFR-5 violation) AND a remove of
 * the previously recorded name (tearing down the marketplace and
 * uninstalling its plugins). Matching by source instead of name alone makes
 * back-to-back reconciles converge: the declaration is already honoured by
 * the existing record, so no action is planned in either direction.
 *
 * Records whose name IS declared are excluded (the name diff owns them);
 * records already claimed by another declared key are excluded so two
 * declared keys cannot both converge onto one record.
 */
function findRecordedBySource(
  recorded: ExtensionState["marketplaces"],
  declared: MergedConfig["marketplaces"],
  alreadyClaimed: ReadonlySet<string>,
  declaredSource: string,
): string | undefined {
  for (const [name, record] of Object.entries(recorded)) {
    if (declared[name] !== undefined || alreadyClaimed.has(name)) {
      continue;
    }

    if (samePlannedSource(record.source, declaredSource) === "same") {
      return name;
    }
  }

  return undefined;
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
  // CR-01: recorded names claimed by a declared key whose name differs but
  // whose source matches. Claimed records are steady state (no add planned
  // for the declared key, no remove planned for the recorded name).
  const sourceClaimed = new Set<string>();

  const declared = merged.marketplaces;
  const recorded = state.marketplaces;

  for (const [mpName, declaredEntry] of Object.entries(declared)) {
    const recordedRecord = recorded[mpName];
    if (recordedRecord === undefined) {
      // CR-01: before planning an add, check whether the declared SOURCE is
      // already recorded under a different (manifest-derived) name. If so,
      // the declaration is honoured -- planning an add here would clone on
      // every load and the removal loop below would tear the record down,
      // producing the perpetual remove/re-add churn this guard prevents.
      const claimedName = findRecordedBySource(
        recorded,
        declared,
        sourceClaimed,
        declaredEntry.entry.source,
      );
      if (claimedName !== undefined) {
        sourceClaimed.add(claimedName);
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

    declaredAndRecorded.add(mpName);
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

  for (const [mpName, mpRecord] of Object.entries(recorded)) {
    // CR-01: a recorded name claimed by a declared key via source matching
    // is NOT removed -- removing it would uninstall its plugins as
    // collateral and the next reload would re-add (re-clone) it.
    if (declared[mpName] === undefined && !sourceClaimed.has(mpName)) {
      // WILL-03 / D-65.1-03: carry the recorded plugin names so the PENDING
      // projection can synthesize per-plugin `will uninstall` rows. The apply
      // path cascades these internally; do NOT add them to `pluginsToUninstall`
      // (buildUninstallBucket skips removed-marketplace plugins to avoid
      // double-billing).
      remove.push({ scope, marketplace: mpName, plugins: Object.keys(mpRecord.plugins) });
    }
  }

  return { add, remove, mismatches, declaredAndRecorded };
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
}

/**
 * ENBL-02 / A1 -- the empty-resources marker.
 *
 * A recorded plugin whose four `resources.{skills,prompts,agents,mcpServers}`
 * arrays are ALL empty AND whose `compatibility.installable === true` is
 * treated as currently disabled. The
 * `orchestrators/plugin/install.ts::statePhase` is the only path that
 * ENBL-02: the "currently disabled" marker is now an explicit
 * `enabled: false` on the plugin install record. The old empty-resources
 * heuristic (five-array emptiness + installable: true) is replaced by a
 * single boolean read, which is unambiguous for both classic-resource and
 * hooks-only plugins.
 *
 * The `installable === true` guard is preserved: a soft-degraded
 * (`installable: false`) plugin has `enabled: true` in state (it was
 * never explicitly disabled; the disable orchestrator is the only writer
 * of `enabled: false`), so `record.compatibility.installable && !record.enabled`
 * naturally excludes soft-degraded entries.
 */
export function isRecordedButDisabled(
  record: ExtensionState["marketplaces"][string]["plugins"][string],
): boolean {
  return record.compatibility.installable && !record.enabled;
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

  const { plugin, marketplace } = parsed;

  // Dangling reference: the plugin's marketplace is not DECLARED. This
  // deliberately includes the recorded-but-undeclared case (the marketplace
  // is in `marketplacesToRemove`): installing into / disabling under a
  // marketplace being torn down is contradictory, so the entry surfaces as
  // a diagnostic instead of an install/disable action.
  if (declaredMarketplaces[marketplace] === undefined) {
    acc.dangling.push({
      scope,
      cause: "dangling-reference",
      marketplace,
      plugin,
    });
    return;
  }

  // D-04 consume-time default via S7's `isDeclaredEnabled`: an absent
  // `enabled` field includes; only an explicit `false` excludes.
  const enabledExplicitFalse = !isDeclaredEnabled(declared.entry);
  const recorded = recordedKeys.has(key);

  if (enabledExplicitFalse) {
    // WR-05 convergence: the terminal state of a successful disable is
    // exactly "recorded with empty resources + config `enabled: false`"
    // (ENBL-02 keeps the record). That steady state is NOT a config<->state
    // divergence -- pushing a disable for it would render
    // `(will disable)` forever and make the apply path re-run a
    // no-op disable on every reload. Only a recorded record that is NOT
    // already disabled (artefacts still materialised) needs the action --
    // symmetric with the enable branch's "recorded + populated + enabled"
    // steady state below.
    const record = state.marketplaces[marketplace]?.plugins[plugin];
    if (recorded && record !== undefined && !isRecordedButDisabled(record)) {
      // Declared-disabled but still materialised: drop artefacts without
      // removing the version pin (D-04 / ENBL-02).
      acc.disable.push({ scope, plugin, marketplace });
    }

    return;
  }

  if (!recorded) {
    acc.install.push({ scope, plugin, marketplace, configSource: declared.source });
    return;
  }

  // Recorded + declared-enabled: split on the empty-resources marker
  // (ENBL-02 / isRecordedButDisabled). The install branch above already
  // returned for `!recorded`, so a plugin CAN'T land in both `install` and
  // `enable` in the same pass.
  const record = state.marketplaces[marketplace]?.plugins[plugin];
  if (record !== undefined && isRecordedButDisabled(record)) {
    acc.enable.push({ scope, plugin, marketplace });
  }
  // Declared-enabled, recorded, populated: steady state, no action.
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
  const acc: DeclaredPluginAccumulator = { install: [], enable: [], disable: [], dangling: [] };
  const recordedKeys = buildRecordedKeys(state);

  for (const [key, declared] of Object.entries(merged.plugins)) {
    classifyDeclaredPlugin(acc, scope, key, declared, recordedKeys, merged.marketplaces, state);
  }

  const uninstall = buildUninstallBucket(merged, state, scope, marketplaceDiff);

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

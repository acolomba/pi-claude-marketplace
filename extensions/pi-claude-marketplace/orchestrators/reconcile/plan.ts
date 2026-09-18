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

import type { ScopeSatisfactionVerdict } from "./dependency-verdict.ts";
import type {
  PlannedDependencyDisable,
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

  return candidates.sort((a, b) => a.localeCompare(b));
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

/**
 * D-04-05: whether any record under a marketplace arrived as another plugin's
 * dependency. The exemption that keeps such a record out of the uninstall
 * bucket must reach the marketplace-removal path too: a dependency resolved
 * through the CMP-3 project -> user fallback is recorded under a marketplace
 * the target scope's config never declares (only the requesting plugin's own
 * marketplace is adopted into the config, D-04-02), and removing that
 * marketplace would tear the dependency down whole-cloth. So a recorded but
 * undeclared marketplace is retained while it holds a dependency, and the
 * uninstall bucket still sweeps the direct-install orphans under it.
 */
function holdsDependencyRecord(mpRecord: ExtensionState["marketplaces"][string]): boolean {
  return Object.values(mpRecord.plugins).some((record) => record.provenance === "dependency");
}

/**
 * Whether the marketplace-removal path keeps a recorded marketplace: one a
 * declaration claims (steady state), a conflict candidate (ambiguity is
 * report-only and must fail closed), or one holding a dependency record
 * (D-04-05). `diffMarketplaces` removes every other recorded marketplace and
 * `buildUninstallBucket` sweeps the direct-install orphans under the kept ones.
 */
function isRetainedRecorded(
  mpName: string,
  mpRecord: ExtensionState["marketplaces"][string],
  retained: ReadonlySet<string>,
  conflicted: ReadonlySet<string>,
): boolean {
  return retained.has(mpName) || conflicted.has(mpName) || holdsDependencyRecord(mpRecord);
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
    if (!isRetainedRecorded(mpName, mpRecord, retainedRecorded, claims.conflictedRecorded)) {
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
  readonly dependencyDisable: readonly PlannedDependencyDisable[];
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

/** The loop-invariant half of the classification, built once per diff pass. */
interface DeclaredPluginInputs {
  readonly scope: Scope;
  readonly recordedKeys: ReadonlySet<string>;
  readonly declaredMarketplaces: MergedConfig["marketplaces"];
  readonly marketplaceDiff: MarketplaceDiff;
  readonly state: ExtensionState;
  /** LOAD-01: the precomputed load-time verdict (D-06-04). */
  readonly verdict: ScopeSatisfactionVerdict;
}

/**
 * LOAD-02: whether the load-time check currently holds this record down.
 *
 * It reads the LIVE verdict and never the record's persisted
 * `dependencyDisabled` marker. The marker says a previous pass held the record
 * down; it says nothing about whether the dependency has since been installed,
 * and reading it here would make the lift impossible. Extracted rather than
 * inlined because `classifyDeclaredPlugin` sits under two independently
 * computed cognitive ceilings.
 */
function isHeldByUnsatisfiedDependency(key: string, verdict: ScopeSatisfactionVerdict): boolean {
  return verdict.ok && verdict.unsatisfied.some((entry) => entry.dependent === key);
}

/**
 * Classify a single declared plugin entry into install / enable / disable /
 * dangling buckets (or a steady-state no-op). Extracted out of `diffPlugins`
 * to keep the cognitive complexity of the iteration body low.
 */
function classifyDeclaredPlugin(
  acc: DeclaredPluginAccumulator,
  inputs: DeclaredPluginInputs,
  key: string,
  declared: MergedConfig["plugins"][string],
): void {
  const { scope, recordedKeys, declaredMarketplaces, marketplaceDiff, state, verdict } = inputs;
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
  const recordKey = `${plugin}@${marketplace}`;
  acc.declaredKeys.add(recordKey);

  // D-04 consume-time default via S7's `isDeclaredEnabled`: an absent
  // `enabled` field includes; only an explicit `false` excludes.
  const enabledExplicitFalse = !isDeclaredEnabled(declared.entry);
  const recorded = recordedKeys.has(recordKey);

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
  //
  // D-06-03: the third term is what stops the oscillation LOAD-02 forbids. A
  // consequence-disable is structurally indistinguishable from an ordinary
  // declared-enabled / recorded-disabled divergence, so without it every
  // reload would re-enable a record the same reload then disables again.
  const record = state.marketplaces[marketplace]?.plugins[plugin];
  if (
    record !== undefined &&
    isRecordedButDisabled(record) &&
    !isHeldByUnsatisfiedDependency(recordKey, verdict)
  ) {
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
 * would double-bill the work). A marketplace `diffMarketplaces` retained for
 * the dependency it holds (D-04-05) is still recorded, so its other plugins
 * are considered here like any retained marketplace's.
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
    // The removal path keeps a conflict candidate, but its plugins are not
    // considered here either: ambiguity is report-only.
    if (marketplaceDiff.conflictedRecorded.has(mpName)) {
      continue;
    }

    if (
      !isRetainedRecorded(
        mpName,
        mpRecord,
        retainedMarketplaces,
        marketplaceDiff.conflictedRecorded,
      )
    ) {
      continue;
    }

    for (const [pluginName, record] of Object.entries(mpRecord.plugins)) {
      // D-04-05 / D-04-02: a cascade-installed dependency is never named in
      // the desired-state config, so its own record is the only thing that
      // says it belongs. A recorded plugin that is neither declared nor
      // marked as a dependency is an orphan and is still swept.
      if (record.provenance === "dependency") {
        continue;
      }

      const key = `${pluginName}@${mpName}`;
      if (!declaredPluginKeys.has(key)) {
        uninstall.push({ scope, plugin: pluginName, marketplace: mpName });
      }
    }
  }

  return uninstall;
}

/**
 * Every plugin key another bucket already claims in this pass.
 *
 * A plugin is in at most one bucket, so a record already planned for uninstall,
 * for a config-declared disable, or for removal with its whole marketplace is
 * never also held down: the load-time check has nothing to add about a record
 * this pass is tearing down anyway.
 */
function claimedPluginKeys(
  marketplaceDiff: MarketplaceDiff,
  uninstall: readonly PlannedPluginUninstall[],
  disable: readonly PlannedPluginDisable[],
): ReadonlySet<string> {
  const claimed = new Set<string>();
  for (const entry of [...uninstall, ...disable]) {
    claimed.add(`${entry.plugin}@${entry.marketplace}`);
  }

  for (const removal of marketplaceDiff.remove) {
    for (const plugin of removal.plugins) {
      claimed.add(`${plugin}@${removal.marketplace}`);
    }
  }

  return claimed;
}

/**
 * LOAD-01: turns the precomputed verdict into the held-down bucket.
 *
 * One entry per held-down declarer, carrying the FIRST unsatisfied declaration
 * in declaration order -- the one the remedy names -- so one held-down plugin
 * renders as one row. A verdict the declaration walk could not complete plans
 * nothing: an incomplete answer must never disable anything (D-05-07).
 */
function buildDependencyDisableBucket(
  state: ExtensionState,
  scope: Scope,
  verdict: ScopeSatisfactionVerdict,
  claimed: ReadonlySet<string>,
): PlannedDependencyDisable[] {
  if (!verdict.ok) {
    return [];
  }

  const planned: PlannedDependencyDisable[] = [];
  const bucketed = new Set<string>();
  for (const entry of verdict.unsatisfied) {
    if (bucketed.has(entry.dependent) || claimed.has(entry.dependent)) {
      continue;
    }

    bucketed.add(entry.dependent);
    const parsed = parsePluginKey(entry.dependent);
    // A verdict names keys built from the scope's own records, so both
    // guards below are unreachable from a verdict this reconcile pass
    // computed. They hold for a verdict computed against a different
    // snapshot, where the honest answer is to plan nothing for a record
    // that is not there.
    const record =
      parsed === undefined
        ? undefined
        : state.marketplaces[parsed.marketplace]?.plugins[parsed.plugin];
    if (parsed === undefined || record === undefined) {
      continue;
    }

    planned.push({
      scope,
      plugin: parsed.plugin,
      marketplace: parsed.marketplace,
      dependency: entry.dependency,
      kind: entry.kind,
      ...(entry.range !== undefined && { range: entry.range }),
    });
  }

  return planned;
}

function diffPlugins(
  merged: MergedConfig,
  state: ExtensionState,
  scope: Scope,
  marketplaceDiff: MarketplaceDiff,
  verdict: ScopeSatisfactionVerdict,
): PluginDiff {
  const acc: DeclaredPluginAccumulator = {
    install: [],
    enable: [],
    disable: [],
    dangling: [],
    declaredKeys: new Set<string>(),
  };
  const recordedKeys = buildRecordedKeys(state);
  const inputs: DeclaredPluginInputs = {
    scope,
    recordedKeys,
    declaredMarketplaces: merged.marketplaces,
    marketplaceDiff,
    state,
    verdict,
  };

  for (const [key, declared] of Object.entries(merged.plugins)) {
    classifyDeclaredPlugin(acc, inputs, key, declared);
  }

  const uninstall = buildUninstallBucket(state, scope, marketplaceDiff, acc.declaredKeys);
  const claimed = claimedPluginKeys(marketplaceDiff, uninstall, acc.disable);

  return {
    install: acc.install,
    uninstall,
    enable: acc.enable,
    disable: acc.disable,
    dependencyDisable: buildDependencyDisableBucket(state, scope, verdict, claimed),
    dangling: acc.dangling,
  };
}

/**
 * The verdict a caller that computed none supplies: nothing in the scope is
 * held down by the load-time check.
 *
 * Named at module scope rather than written as an inline parameter default, so
 * every call that omits the argument reads this one value instead of
 * allocating a fresh literal per invocation (typescript:S7737).
 */
const NO_HELD_DECLARERS: ScopeSatisfactionVerdict = Object.freeze({ ok: true, unsatisfied: [] });

/**
 * DIFF-01 pure bidirectional 8-bucket diff. Produces a `ReconcilePlan`
 * describing the actions required to make `state` converge to `merged`.
 *
 * Pure: no I/O, no network, no notify, no state mutation. Re-runs against
 * the same inputs produce deepEqual outputs. LOAD-01's satisfaction verdict is
 * therefore an INPUT (D-06-04): establishing it reads manifests, which this
 * function may not do, so the reconcile read pass computes it inside its own
 * locked closure and hands it in. A caller that asks only "what does the
 * config-versus-state diff say" omits it and no plugin is held down.
 *
 * O(N + M) in the union of declared + recorded entries (no per-entry regex
 * compilation, no nested scans).
 */
export function planReconcile(
  merged: MergedConfig,
  state: ExtensionState,
  scope: Scope,
  verdict: ScopeSatisfactionVerdict = NO_HELD_DECLARERS,
): ReconcilePlan {
  const marketplaceDiff = diffMarketplaces(merged, state, scope);
  const pluginDiff = diffPlugins(merged, state, scope, marketplaceDiff, verdict);

  // Fast path: empty inputs -> empty plan (deterministic shape).
  const totalAdds = marketplaceDiff.add.length;
  const totalRemoves = marketplaceDiff.remove.length;
  const totalInstalls = pluginDiff.install.length;
  const totalUninstalls = pluginDiff.uninstall.length;
  const totalEnables = pluginDiff.enable.length;
  const totalDisables = pluginDiff.disable.length;
  const totalDependencyDisables = pluginDiff.dependencyDisable.length;
  const totalMismatches = marketplaceDiff.mismatches.length + pluginDiff.dangling.length;

  if (
    totalAdds === 0 &&
    totalRemoves === 0 &&
    totalInstalls === 0 &&
    totalUninstalls === 0 &&
    totalEnables === 0 &&
    totalDisables === 0 &&
    totalDependencyDisables === 0 &&
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
    pluginsToDependencyDisable: pluginDiff.dependencyDisable,
    sourceMismatches: [...marketplaceDiff.mismatches, ...pluginDiff.dangling],
  };
}

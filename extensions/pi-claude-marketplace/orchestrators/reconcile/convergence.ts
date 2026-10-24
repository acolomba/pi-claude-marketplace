// orchestrators/reconcile/convergence.ts
//
// D-10 / D-06: the offline catalog-convergence planner. It finds every recorded
// plugin whose catalog candidate on disk differs from its record, so `pending`,
// the load and `apply` plan the same moves from one place.
//
// MUST NOT touch the network (NFR-5). The module is outside `NETWORK_SEAMS`, so
// BLOCK F in `eslint.config.js` rejects a git surface here; the candidate
// resolves through `resolveListCandidate`, whose git path uses the fs-only
// presence probe. Never writes a file.

import { PLUGIN_ENTRY_VALIDATOR } from "../../domain/components/plugin.ts";
import { lookupDeclaredPlugin } from "../../domain/manifest-lookup.ts";
import { loadMarketplaceManifest } from "../../domain/manifest.ts";
import { parsePluginSource } from "../../domain/source.ts";
import { isRecordedButDisabled } from "../../persistence/state-io.ts";
import { hookDebugLog } from "../../shared/debug-log.ts";
import { errorMessage } from "../../shared/errors.ts";
import { buildScopeDeclarationDetail } from "../plugin/dependency-index.ts";
import { resolveListCandidate } from "../plugin/list-candidate-version.ts";
import { isRecordedCandidate, resolvePluginVersion } from "../plugin/shared.ts";

import type { ReconcilePlan } from "./types.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { ExtensionState } from "../../persistence/state-io.ts";
import type { Scope } from "../../shared/types.ts";
import type { RevisionMove } from "../types.ts";

type MarketplaceRecord = ExtensionState["marketplaces"][string];
type PluginRecord = MarketplaceRecord["plugins"][string];

/** One scope's inputs: its state, its locations, and the plan `apply` would run first. */
export interface ConvergenceInput {
  readonly scope: Scope;
  readonly state: ExtensionState;
  readonly locations: ScopedLocations;
  /** The scope's reconcile plan; absent when the state already reflects it. */
  readonly plan?: ReconcilePlan;
}

/** D-10: one catalog move, with the revisions on both sides (UPR-02). */
export interface PlannedMove extends RevisionMove {
  readonly scope: Scope;
  readonly marketplace: string;
  readonly plugin: string;
  /** The version, sha or plugin root differs (D-18-11). */
  readonly revisionChanged: boolean;
  /** The supported component set strictly grew (BFILL-01). */
  readonly grew: boolean;
  /** The record was installed partial (`installable: false`). */
  readonly partial: boolean;
}

/** The scope's moves, sorted by marketplace then plugin. */
export interface ConvergencePlan {
  readonly moves: readonly PlannedMove[];
}

function compareNames(a: string, b: string): number {
  return a.localeCompare(b);
}

function pluginKeys(ops: readonly { readonly marketplace: string; readonly plugin: string }[]) {
  return new Set(ops.map((op) => `${op.plugin}@${op.marketplace}`));
}

/**
 * The scope as `apply`'s plan leaves it: the records it uninstalls and the
 * marketplaces it removes are gone, the records it disables are disabled and
 * the records it enables are enabled.
 */
function stateAsPlanLeavesIt(state: ExtensionState, plan: ReconcilePlan): ExtensionState {
  const removed = new Set(plan.marketplacesToRemove.map((op) => op.marketplace));
  const uninstalled = pluginKeys(plan.pluginsToUninstall);
  const disabled = pluginKeys([...plan.pluginsToDisable, ...plan.pluginsToDependencyDisable]);
  const enabled = pluginKeys(plan.pluginsToEnable);
  const enabledAfter = (key: string, record: PluginRecord): boolean =>
    !disabled.has(key) && (enabled.has(key) || record.enabled);
  const marketplaces = Object.fromEntries(
    Object.entries(state.marketplaces)
      .filter(([name]) => !removed.has(name))
      .map(([name, mp]) => {
        const plugins = Object.fromEntries(
          Object.entries(mp.plugins)
            .filter(([plugin]) => !uninstalled.has(`${plugin}@${name}`))
            .map(([plugin, record]) => [
              plugin,
              { ...record, enabled: enabledAfter(`${plugin}@${name}`, record) },
            ]),
        );
        return [name, { ...mp, plugins }];
      }),
  );
  return { ...state, marketplaces };
}

/** Whether `source` installs from git (url / git-subdir / github). */
function isGitSource(source: unknown): boolean {
  const kind = parsePluginSource(source).kind;
  return kind === "url" || kind === "git-subdir" || kind === "github";
}

/**
 * D-10: the move one enabled record would make, or `undefined`. A delisted
 * record (DLS-D1), an invalid entry, a git source and an `unavailable`
 * candidate are not moves.
 */
async function recordMove(
  input: ConvergenceInput,
  mp: MarketplaceRecord,
  plugin: string,
  record: PluginRecord,
): Promise<PlannedMove | undefined> {
  const manifest = await loadMarketplaceManifest(mp.manifestPath);
  const declared = lookupDeclaredPlugin(manifest, plugin);
  if (declared.kind === "absent" || !PLUGIN_ENTRY_VALIDATOR.Check(declared.entry)) {
    return undefined;
  }

  const entry = declared.entry;
  if (isGitSource(entry.source)) {
    return undefined;
  }

  const candidate = await resolveListCandidate(
    entry,
    { marketplaceRoot: mp.marketplaceRoot, marketplaceName: mp.name },
    input.locations,
  );
  if (candidate.kind === "cold" || candidate.resolved.state === "unavailable") {
    return undefined;
  }

  const resolved = candidate.resolved;
  const toVersion = await resolvePluginVersion(entry, resolved);
  if (
    isRecordedCandidate(record, {
      toVersion,
      resolvedSha: undefined,
      pluginRoot: resolved.pluginRoot,
    })
  ) {
    return undefined;
  }

  return {
    scope: input.scope,
    marketplace: mp.name,
    plugin,
    fromVersion: record.version,
    toVersion,
    ...(record.resolvedSha !== undefined && { fromCommit: record.resolvedSha }),
    revisionChanged: true,
    grew: false,
    partial: !record.compatibility.installable,
  };
}

/** T-29-22: a candidate that cannot be read is skipped, never thrown. */
async function recordMoveIsolated(
  input: ConvergenceInput,
  mp: MarketplaceRecord,
  plugin: string,
  record: PluginRecord,
): Promise<PlannedMove | undefined> {
  try {
    return await recordMove(input, mp, plugin, record);
  } catch (err) {
    hookDebugLog(
      `planConvergence: skipped ${plugin}@${mp.name}: ${errorMessage(err)}`,
      "reconcile",
    );
    return undefined;
  }
}

/**
 * D-10 / D-06: every catalog move in one scope, offline. A scope whose
 * declaration walk cannot be read previews no move, the fail-closed stance
 * `update` takes (D-05-07, D-18-17); the per-session warning names the
 * declarer (REC-05). Disabled records never move (ENBL-08).
 */
export async function planConvergence(input: ConvergenceInput): Promise<ConvergencePlan> {
  const view =
    input.plan === undefined ? input.state : stateAsPlanLeavesIt(input.state, input.plan);
  const walk = await buildScopeDeclarationDetail({ state: view, locations: input.locations });
  if (!walk.ok) {
    return { moves: [] };
  }

  const moves: PlannedMove[] = [];
  const marketplaces = Object.values(view.marketplaces).sort((a, b) =>
    compareNames(a.name, b.name),
  );
  for (const mp of marketplaces) {
    const plugins = Object.entries(mp.plugins).sort(([a], [b]) => compareNames(a, b));
    for (const [plugin, record] of plugins) {
      if (isRecordedButDisabled(record)) {
        continue;
      }

      // eslint-disable-next-line no-await-in-loop -- one offline resolve per record, in the order the moves are reported
      const move = await recordMoveIsolated(input, mp, plugin, record);
      if (move !== undefined) {
        moves.push(move);
      }
    }
  }

  return { moves };
}

// orchestrators/marketplace/remove.ts
//
// MR-1..8 + RH-1/RH-5 composition + NFR-5 (no network).
//
//
// Notification shape per outcome:
//   - Clean success: MarketplaceNotificationMessage{ status:"removed",
//     plugins: [...] } with one PluginUninstalledMessage (○) per unstaged
//     plugin. Reload-hint fires iff >=1 plugin was unstaged (D-22-02).
//     An empty remove (no plugins staged) is header-only with no trailer.
//   - Partial failure: MarketplaceNotificationMessage{ status:"failed" }
//     mixing PluginUninstalledMessage and PluginFailedMessage{ cause? }
//     rows. Per-plugin cause rendered at 4-space indent (D-16-08).
//   - Post-state cleanup and cache-refresh failures are swallowed (MR-6 /
//     D-18-01): the underlying rm() calls still run; only the warning
//     disappears, as there is no clean notification shape for
//     "cleanup leak after a successful state mutation".
//
// Flow:
//   1. resolveScopeOrNotifyNotAdded(opts, userLocs, projectLocs) when --scope
//      omitted (MR-1). The standalone-mode helper resolves project-then-user
//      and emits the `{marketplace not added}` notify when the marketplace is in neither
//      scope; orchestrated mode uses `resolveScopeOrFailedOutcome` (defined
//      below) to return a typed `RemoveMarketplaceOutcome` instead.
//   2. withLockedStateTransaction(locations, async (tx) => {
//        CFG-03 abort: `loadConfig(targetConfigPath)` -- if `status ==
//        "invalid"`, surface the basename-only failure WITHOUT touching
//        state or saving. No `tx.save()` on this arm.
//        record = tx.state.marketplaces[name]
//        LAYER-02 (standalone only): load the other layer and stop through
//        `LayerGateStop`, again without `tx.save()`, when the target layer
//        does not declare the marketplace while the other one declares it or
//        cannot be read. LAYER-03: while the other layer declares the
//        marketplace or cannot be read, the remove is a layer remove over the
//        plugins only the target layer declares; otherwise it is the full
//        remove over every plugin. Reconcile always takes the full remove.
//        D-05-07: when the record holds a dependency record, read the scope's
//        declaration index; an unreadable one refuses the remove through
//        `DeclarationIndexStop`, again without `tx.save()`.
//        for each plugin the remove takes away:
//          outcome = cascade(plugin, marketplace, locations, installedPlugin)
//                    // cascade is opts.cascade ?? cascadeUnstagePlugin (DI seam
//                    // for test determinism; zero runtime cost in production).
//          if (outcome.ok): delete record.plugins[plugin]; track successfullyUnstaged
//          else:            failedPlugins.push({name, cause})  // D-02 / D-03 fail-fast per plugin
//        then each dependency record under the marketplace that nothing left
//        declares, re-checked before each unstage (PRUNE-03).
//        if (failedPlugins.length === 0):
//          layer remove: drop the target layer's entry and `*@<name>` keys
//          full remove: delete tx.state.marketplaces[name] unless a kept
//          dependency record remains under it; WB-01 sweeps both
//          layers with `deleteMarketplaceConfigEntryWithCascade(...)`
//          (entry-level patch through saveConfig).
//        await tx.save()  // WR-04: explicit save on the mutating arms.
//      })
//   3. POST-STATE cleanup (after guard returns):
//        - invalidate marketplace names and the target plugin-index cache
//        - per-plugin data dirs (always)
//        - marketplace data dir + clone dir (github/url sources; ONLY when the
//          state record was deleted, so never after a failed plugin; MR-7)
//        - cleanup failures are SWALLOWED silently per D-18-01.
//   4. Compose user-visible output via one `notify(opts.ctx, opts.run, ...)` call.
//
// D-02: hand-rolled try/catch loop (NOT the phase-ledger runner).
// D-03 corollary: per-plugin order mirrors PU-1 (skills → commands → agents → MCP).

import { rm } from "node:fs/promises";
import path from "node:path";

import {
  findDependents,
  isHeldBy,
  pruneOrphans,
  pruneOrphansReachableFrom,
} from "../../domain/dependency-orphans.ts";
import { loadConfig } from "../../persistence/config-io.ts";
import { deleteMarketplaceConfigEntryWithCascade } from "../../persistence/config-write-back.ts";
import { locationsFor } from "../../persistence/locations.ts";
import { loadState, type ExtensionState } from "../../persistence/state-io.ts";
import { hookDebugLog } from "../../shared/debug-log.ts";
import { errorMessage, MarketplaceNotFoundError, StateLockHeldError } from "../../shared/errors.ts";
import { notifyMcpConfigNotices } from "../../shared/notification-dispatch.ts";
import { type ContentReason } from "../../shared/notification-types.ts";
import {
  type PluginFailedMessage,
  type PluginUninstalledMessage,
  type Reason,
} from "../../shared/notification-types.ts";
import {
  notifyWithContext,
  type MarketplaceRows,
  type Single,
} from "../../shared/notify-context.ts";
import { ownValue } from "../../shared/own-key.ts";
import {
  withLockedStateTransaction,
  type LockedStateTransactionDeps,
} from "../../transaction/with-state-guard.ts";
import { garbageCollectPluginClones } from "../plugin/clone-gc.ts";
import { buildScopeDeclarationIndex, withoutDisabledHolders } from "../plugin/dependency-index.ts";

import { composeHeldRemovalCause, REMOVE_CONTEXT, type RemoveRowMsg } from "./remove.messaging.ts";
import {
  AgentsUnstageFailureError,
  cascadeUnstagePlugin,
  marketplaceFailureRows,
  marketplaceLayerVerdict,
  mcpConfigNoticesMember,
  narrowCascadeFailure,
  resolveScopeOrNotifyNotAdded,
  type MarketplaceLayerVerdict,
} from "./shared.ts";

import type { DeclarationIndex } from "../../domain/dependency-orphans.ts";
import type { ScopeConfig } from "../../persistence/config-io.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { NotificationContext } from "../../platform/pi-api.ts";
import type { CompletionCache } from "../../shared/completion-cache.ts";
import type { NotificationRun } from "../../shared/notification-run.ts";
import type { McpConfigNotice } from "../../shared/notification-types.ts";
import type { Scope } from "../../shared/types.ts";

type RecordedSourceKind = "github" | "url" | "path" | "unknown";

/**
 * AFILE-04: an orchestrated removal whose state transaction threw after its
 * plugin cascades rewrote MCP config files. It carries those cascades' notices
 * so the caller can still show them. The original throw rides `Error.cause`,
 * and the caller classifies that.
 */
export class MarketplaceRemoveFailureError extends Error {
  readonly mcpConfigNotices: readonly McpConfigNotice[];
  constructor(mcpConfigNotices: readonly McpConfigNotice[], options: ErrorOptions) {
    super("Marketplace remove failed after its plugin cascades rewrote MCP config files.", options);
    this.name = "MarketplaceRemoveFailureError";
    this.mcpConfigNotices = Object.freeze([...mcpConfigNotices]);
  }
}

/**
 * RECON-03: controls how `removeMarketplace` surfaces
 * notifications. Mirrors `AddMarketplaceNotifications`.
 *
 * - `"standalone"` (default when option is omitted): matches standalone behavior.
 * - `"orchestrated"`: suppresses every `ctx.ui.notify` call and returns the
 *   typed `RemoveMarketplaceOutcome` for `applyReconcile` to aggregate (IL-2).
 */
export type RemoveMarketplaceNotifications =
  { readonly mode: "standalone" } | { readonly mode: "orchestrated" };

/**
 * RECON-03: discriminated outcome returned by `removeMarketplace` in
 * orchestrated mode. The success arm carries the names of the plugin rows
 * the cascade successfully unstaged so the apply renderer can compose the
 * per-row `(uninstalled)` plugin lines. Cleanup-leak warnings are dropped
 * per D-18-01 -- the orchestrated outcome surface mirrors standalone's
 * silence on post-state cleanup hiccups.
 *
 * `reason` is typed as `Reason` (not `ContentReason`) so the orchestrated
 * `"marketplace not added"` arm (missing marketplace, MarketplaceNotFoundError) can
 * surface its structural sentinel through the same field. Mirrors the
 * `AddMarketplaceOutcome` shape note.
 *
 * AFILE-04: the `removed` and `partial` arms carry the plugin cascades' MCP
 * config notices in `mcpConfigNotices` for the caller to show, set only when
 * non-empty.
 */
export type RemoveMarketplaceOutcome =
  | {
      readonly status: "removed";
      readonly name: string;
      readonly unstaged: readonly string[];
      readonly mcpConfigNotices?: readonly McpConfigNotice[];
    }
  | {
      readonly status: "failed";
      readonly reason: Reason;
      readonly error: Error;
      readonly cause: string;
    }
  // I1 / PR #51: orchestrated partial-cascade arm. A subset of the
  // marketplace's plugins successfully unstaged AND a subset failed. Carrying
  // both sets keeps every plugin visible in the reconcile cascade: the caller
  // renders one row per `unstaged` plugin (○ uninstalled) AND one row per
  // `failed` plugin (⊘ {reason}), plus a `(failed)` mp header (D-22-02 /
  // CMC-31 PARTIAL).
  | {
      readonly status: "partial";
      readonly name: string;
      readonly unstaged: readonly string[];
      readonly failed: readonly { readonly name: string; readonly reason: ContentReason }[];
      readonly mcpConfigNotices?: readonly McpConfigNotice[];
    };

export interface RemoveMarketplaceOptions {
  readonly ctx: NotificationContext;
  /**
   * D-05 / D-07: the command's run, or the load pass's run when reconcile
   * drives the removal. Every emission renders from its soft-dependency
   * snapshot.
   */
  readonly run: NotificationRun;
  readonly name: string;
  /** Lifecycle-owned completion cache shared with the command's readers. */
  readonly completionCache: CompletionCache;
  /** When omitted, `resolveScopeOrNotifyNotAdded` (standalone) / `resolveScopeOrFailedOutcome` (orchestrated) picks the scope; project takes precedence if found in both. */
  readonly scope?: Scope;
  /** Project-scope cwd (ignored for user scope). */
  readonly cwd: string;
  /**
   * D-12-style injection seam for the per-plugin cascade primitive. Defaults
   * to `cascadeUnstagePlugin` from `./shared.ts`. Tests inject a stub that
   * deterministically forces per-plugin outcomes (e.g. forced failure for
   * MR-4 / MR-7 coverage). Zero runtime cost in production: a single `??`
   * fallback.
   */
  readonly cascade?: typeof cascadeUnstagePlugin;
  /**
   * D-12-style injection seam for the scope's declaration index. Defaults to
   * `buildScopeDeclarationIndex`, the offline reader (NFR-5). Tests inject a
   * synthetic index, or a stub that fails when no index may be built.
   */
  readonly declarationIndex?: typeof buildScopeDeclarationIndex;
  /**
   * RECON-03: notification mode selector. Omitted
   * (undefined) === `{ mode: "standalone" }` -- matches standalone behavior.
   */
  readonly notifications?: RemoveMarketplaceNotifications;
  /**
   * WB-01: when true, target the local config (`claude-plugins.local.json`)
   * instead of the base config (`claude-plugins.json`). The base config is
   * NEVER touched on the --local path.
   */
  readonly local?: boolean;
  /**
   * D-12-style injection seam for the locked-state transaction. Tests inject a
   * `loadState` that omits the target record, which is the only deterministic
   * way to reach the in-lock disappearance arm: the pre-guard probe reads the
   * real file and finds the record, while the in-lock load does not. Racing a
   * real concurrent writer leaves that arm covered only when the race lands.
   * Zero runtime cost in production: the value is forwarded unchanged.
   */
  readonly stateTransaction?: LockedStateTransactionDeps;
}

async function removePath(pathPromise: Promise<string>): Promise<void> {
  // D-18-01: the cleanup `rm()` call still runs (correctness preserved);
  // failures are swallowed silently because the
  // `MarketplaceNotificationMessage` type has no field to surface
  // "cleanup leak after successful state mutation".
  // Nothing surfaces these cleanup failures to the user.
  try {
    await rm(await pathPromise, { recursive: true, force: true });
  } catch (err) {
    // Cleanup is a hygienic concern, not part of the state contract.
    // Per D-18-01: never the primary user-facing failure path.
    hookDebugLog(`post-remove path cleanup failed: ${errorMessage(err)}`);
  }
}

/**
 * The typed `{marketplace not added}` failure, in the one shape every arm of
 * this module that reaches the miss reports it with. `scopes` names the scopes
 * actually searched, so the bare form carries both and an explicit-scope form
 * carries only the requested one.
 */
function notAddedOutcome(name: string, scopes: readonly Scope[]): RemoveMarketplaceOutcome {
  const err = new MarketplaceNotFoundError(name, scopes);

  return {
    status: "failed",
    reason: "marketplace not added",
    error: err,
    cause: errorMessage(err),
  };
}

/**
 * RECON-03: orchestrated-mode mirror of `resolveScopeOrNotifyNotAdded` that
 * returns a typed `RemoveMarketplaceOutcome` for the not-added case instead
 * of firing the standalone notify() side effect. Same project-then-user
 * precedence as the helper (CMP-5).
 */
async function resolveScopeOrFailedOutcome(
  opts: RemoveMarketplaceOptions,
  userLocations: ScopedLocations,
  projectLocations: ScopedLocations,
): Promise<{ scope: Scope; locations: ScopedLocations } | RemoveMarketplaceOutcome> {
  if (opts.scope === undefined) {
    const [userState, projectState] = await Promise.all([
      loadState(userLocations.extensionRoot),
      loadState(projectLocations.extensionRoot),
    ]);
    if (ownValue(projectState.marketplaces, opts.name) !== undefined) {
      return { scope: "project", locations: projectLocations };
    }

    if (ownValue(userState.marketplaces, opts.name) !== undefined) {
      return { scope: "user", locations: userLocations };
    }

    return notAddedOutcome(opts.name, ["project", "user"]);
  }

  const candLocations = opts.scope === "user" ? userLocations : projectLocations;
  const preState = await loadState(candLocations.extensionRoot);
  if (ownValue(preState.marketplaces, opts.name) === undefined) {
    return notAddedOutcome(opts.name, [opts.scope]);
  }

  return { scope: opts.scope, locations: candLocations };
}

/**
 * One plugin whose unstage cascade failed, as accumulated by the remove flow
 * and read by `emitPartialFailure`. Named once so the accumulator, the
 * cascade bundle and the lock-body bundle all carry the declaration the
 * composer reads rather than four structural spellings of it.
 */
interface FailedPluginCascade {
  readonly name: string;
  readonly cause: Error;
}

/**
 * RECON-03: route the partial-failure (≥1 plugin cascade failure) arm to
 * either a typed orchestrated outcome OR the standalone notify() row.
 * Extracted from `removeMarketplace` to keep its cognitive complexity
 * inside the project's lint budget. AFILE-04: the MCP config notices follow
 * the row in standalone mode and ride the outcome in orchestrated mode.
 */
function emitPartialFailure(args: {
  opts: RemoveMarketplaceOptions;
  orchestrated: boolean;
  resolvedScope: Scope;
  successfullyUnstaged: readonly string[];
  failedPlugins: readonly FailedPluginCascade[];
  mcpConfigNotices: readonly McpConfigNotice[];
}): RemoveMarketplaceOutcome {
  const {
    opts,
    orchestrated,
    resolvedScope,
    successfullyUnstaged,
    failedPlugins,
    mcpConfigNotices,
  } = args;
  // I1 / PR #51: surface BOTH unstaged successes AND per-plugin failures
  // through the typed outcome. The apply cascade caller composes one row
  // per plugin (○ uninstalled for unstaged, ⊘ {reason} for failed) so the
  // reconcile surface honours D-22-02 (no plugin ever disappears
  // silently). A single `{status:"failed",reason}` would collapse N rows
  // to 1.
  const outcome: RemoveMarketplaceOutcome = {
    status: "partial",
    name: opts.name,
    unstaged: successfullyUnstaged,
    failed: failedPlugins.map((f) => ({
      name: f.name,
      reason: narrowCascadeFailure(f.cause),
    })),
    ...mcpConfigNoticesMember(mcpConfigNotices),
  };
  if (!orchestrated) {
    // CMC-31 PARTIAL: mp.status="failed"; plugins[] mixes uninstalled +
    // failed (with per-plugin cause). Caller-order honored end-to-end:
    // successfullyUnstaged first, failed second.
    // OUT-07 / D-12: one marketplace block -> Single 1-tuple. The `(failed)`
    // header renders via the central renderMpHeader seam the spine reuses; the
    // mixed `uninstalled` / `failed` child rows dispatch through REMOVE_CONTEXT.
    const partialRows: Single<MarketplaceRows<RemoveRowMsg>> = [
      {
        name: opts.name,
        scope: resolvedScope,
        status: "failed",
        // D-03: a failed marketplace remove -> error (the per-plugin children
        // carry the granular reasons).
        severity: "error",
        plugins: [
          ...successfullyUnstaged.map((name): PluginUninstalledMessage => ({
            status: "uninstalled",
            name,
            // D-03/D-06: realized uninstall transition -> info, reloads.
            severity: "info",
            needsReload: true,
          })),
          ...failedPlugins.map(({ name, cause }): PluginFailedMessage => ({
            status: "failed",
            name,
            reasons: [narrowCascadeFailure(cause)],
            cause,
            // D-03/D-06: a per-plugin unstage failure -> error, no reload.
            severity: "error",
            needsReload: false,
          })),
        ],
      },
    ];
    notifyWithContext(opts.ctx, opts.run, REMOVE_CONTEXT, partialRows, undefined, "single");
    notifyMcpConfigNotices(opts.ctx, opts.run, mcpConfigNotices);
  }

  return outcome;
}

/**
 * D-02: hand-rolled per-plugin cascade loop over `entries`, the plugin records
 * the remove takes away. Mutates `record.plugins`, `successfullyUnstaged`,
 * `failedPlugins` and `mcpConfigNotices` in place.
 * AFILE-04: every cascade's MCP config notices are kept, from a failed
 * cascade too, because its MCP slot may have rewritten the file before a
 * later slot failed. Extracted from `removeMarketplace` to keep its
 * cognitive complexity inside the project's lint budget.
 */
async function cascadePluginsInPlace(args: {
  readonly record: { plugins: Record<string, ExtensionPluginRow> };
  readonly entries: readonly (readonly [string, ExtensionPluginRow])[];
  readonly marketplace: string;
  readonly locations: ScopedLocations;
  readonly cascade: typeof cascadeUnstagePlugin;
  readonly successfullyUnstaged: string[];
  readonly failedPlugins: FailedPluginCascade[];
  readonly mcpConfigNotices: McpConfigNotice[];
}): Promise<void> {
  const { record, marketplace, locations, cascade, successfullyUnstaged, failedPlugins } = args;
  for (const [pluginName, plugin] of args.entries) {
    // eslint-disable-next-line no-await-in-loop -- each unstage rewrites the shared agents index and mcp.json
    const outcome = await cascade(pluginName, marketplace, locations, plugin);
    args.mcpConfigNotices.push(...(outcome.mcpConfigNotices ?? []));
    if (outcome.ok) {
      successfullyUnstaged.push(pluginName);
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- record.plugins is a dynamic-key Record<string, ...>.
      delete record.plugins[pluginName];
      continue;
    }

    // D-03: outcome.cause is set when ok===false (see UnstageOutcome).
    const cause = outcome.cause ?? new Error(`unknown cascade failure for ${pluginName}`);

    // TR-03: non-AG-5 partial-failure filters resources.* by outcome.dropped.*
    // so the persisted row reflects only artifacts still on disk.
    // AG-5 (AgentsUnstageFailureError) preserves the row INTACT.
    if (!(cause instanceof AgentsUnstageFailureError)) {
      const dropped = outcome.dropped;
      plugin.resources.skills = plugin.resources.skills.filter((n) => !dropped.skills.includes(n));
      plugin.resources.prompts = plugin.resources.prompts.filter(
        (n) => !dropped.commands.includes(n),
      );
      plugin.resources.agents = plugin.resources.agents.filter((n) => !dropped.agents.includes(n));
      plugin.resources.mcpServers = plugin.resources.mcpServers.filter(
        (n) => !dropped.mcpServers.includes(n),
      );
      // WLIF-03: workflow envelopes live outside every scope root, so a row
      // still naming one the cascade deleted would drive the NEXT removal at a
      // name it no longer owns.
      plugin.resources.workflows = plugin.resources.workflows.filter(
        (n) => !dropped.workflows.includes(n),
      );
    }

    failedPlugins.push({ name: pluginName, cause });
  }
}

/** Local alias for the per-plugin record shape mutated by the cascade loop. */
type ExtensionPluginRow =
  NonNullable<Parameters<typeof cascadeUnstagePlugin>[3]> extends infer T ? T : never;

/**
 * Cascade-delete the marketplace entry + its `@<marketplace>` plugin keys from
 * ONE physical config layer. Loads the file fresh so the sweep sees the
 * on-disk truth of that layer (the target-layer load threaded for CFG-03 is a
 * different concern).
 *
 * WR-02: short-circuit when the layer declares neither the marketplace nor any
 * plugin key under it. Writing anyway would rewrite the file (mtime bump) for a
 * semantic no-op -- or CREATE the file containing only empty maps when it is
 * absent. Both contradict the RECON-05 byte/mtime-stability discipline.
 *
 * An `absent` or `invalid` layer is left untouched (never rewritten): the
 * other layer being invalid is NOT a CFG-03 abort (that is scoped to the
 * target layer in `runRemoveLockBody`).
 */
async function cascadeRemoveFromLayer(
  configPath: string,
  scopeRoot: string,
  marketplace: string,
): Promise<void> {
  const cfg = await loadConfig(configPath);
  if (cfg.status !== "valid") {
    return;
  }

  const suffix = `@${marketplace}`;
  const declaresMarketplace = ownValue(cfg.config.marketplaces, marketplace) !== undefined;
  const declaresPluginUnderIt = Object.keys(cfg.config.plugins ?? {}).some((key) =>
    key.endsWith(suffix),
  );
  if (!declaresMarketplace && !declaresPluginUnderIt) {
    return;
  }

  await deleteMarketplaceConfigEntryWithCascade(cfg.config, configPath, scopeRoot, marketplace);
}

/**
 * Commit the full-remove success branch: delete the marketplace from state and
 * fire the cascade config write-back (skipped in orchestrated mode).
 */
async function commitFullRemove(args: {
  readonly tx: { readonly state: { marketplaces: Record<string, unknown> } };
  readonly marketplace: string;
  readonly locations: ScopedLocations;
  readonly orchestrated: boolean;
  readonly deleteRecord: boolean;
}): Promise<void> {
  const { tx, marketplace, locations, orchestrated } = args;
  if (args.deleteRecord) {
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- state.marketplaces is a dynamic-key Record<string, ...>.
    delete tx.state.marketplaces[marketplace];
  }

  // WB-01: cascade write-back lives in ONE place. `cascadeRemoveFromLayer`
  // removes the marketplace entry AND every plugin entry whose key ends in
  // `@<marketplace>` so the next reconcile is a no-op.
  //
  // WR-09 / T-56-02-01: SKIPPED in orchestrated mode. A reconcile-driven
  // call derives the desired state FROM the merged config; the declaration
  // may live only in claude-plugins.local.json, and a write-back would
  // clobber a per-machine override.
  if (orchestrated) {
    return;
  }

  // Cross-layer sweep: both `claude-plugins.json` and
  // `claude-plugins.local.json` are inside the NFR-10 sanctioned write set.
  // A `--local` install by a prior version may have left the plugin key in
  // the other layer; cleaning only the target layer leaves it as a
  // perpetual dangling-reference. Each layer is loaded fresh and swept
  // independently (WR-02 no-op guard per file, NFR-1 atomic save per file).
  await cascadeRemoveFromLayer(locations.baseConfigJsonPath, locations.scopeRoot, marketplace);
  await cascadeRemoveFromLayer(locations.localConfigJsonPath, locations.scopeRoot, marketplace);
}

/** A layer gate verdict that stops a standalone remove before any change. */
type LayerGateStopVerdict = Extract<
  MarketplaceLayerVerdict,
  { kind: "refused" | "other-unreadable" }
>;

/**
 * Leaves the state lock without `tx.save()` when the layer gate stops a
 * remove, carrying the verdict to the row emitter outside the lock.
 */
class LayerGateStop extends Error {
  readonly verdict: LayerGateStopVerdict;
  constructor(verdict: LayerGateStopVerdict) {
    super("layer-gate-stop");
    this.name = "LayerGateStop";
    this.verdict = verdict;
  }
}

/**
 * What a remove takes away. A layer remove (`layerOnly`) drops only the target
 * layer's declarations and keeps the state record; a full remove deletes the
 * record. `entries` are the plugin records to unstage.
 */
interface RemovePlan {
  readonly layerOnly: boolean;
  readonly entries: readonly (readonly [string, ExtensionPluginRow])[];
}

/**
 * The full remove unstages every explicit record; the dependency records under
 * the marketplace follow the retention rule in `cascadeDependencies`.
 */
function fullRemovePlan(record: ExtensionMarketplaceRow): RemovePlan {
  return {
    layerOnly: false,
    entries: Object.entries(record.plugins).filter(([, plugin]) => !isDependencyRecord(plugin)),
  };
}

function isDependencyRecord(plugin: ExtensionPluginRow): boolean {
  return plugin.provenance === "dependency";
}

/**
 * LAYER-02 / D-MF-03: a named remove changes only its target layer. It loads
 * the other layer and stops the remove, before anything is mutated, when the
 * target layer does not declare the marketplace while the other layer does, or
 * when the other layer cannot be read. An unreadable other layer may declare
 * the marketplace or any of its plugin keys, so the remove cannot tell which
 * plugins it would leave without a declaration; the `{invalid manifest}` row
 * names that file for the user to repair. Reconcile-driven removals never call
 * it (WR-09).
 *
 * LAYER-03: while the other layer declares the marketplace, the remove is a
 * layer remove. Otherwise, including a recorded marketplace no layer declares,
 * it is the full remove.
 */
async function planStandaloneRemove(args: {
  readonly target: ScopeConfig;
  readonly locations: ScopedLocations;
  readonly targetIsLocal: boolean;
  readonly record: ExtensionMarketplaceRow;
  readonly marketplace: string;
}): Promise<RemovePlan> {
  const { locations, targetIsLocal } = args;
  const other = await loadConfig(
    targetIsLocal ? locations.baseConfigJsonPath : locations.localConfigJsonPath,
  );
  const verdict = marketplaceLayerVerdict({
    target: args.target,
    other,
    targetIsLocal,
    marketplace: args.marketplace,
  });
  if (verdict.kind === "refused") {
    throw new LayerGateStop(verdict);
  }

  if (other.status === "invalid") {
    throw new LayerGateStop({
      kind: "other-unreadable",
      otherBasename: path.basename(other.filePath),
    });
  }

  if (verdict.kind !== "declared" || other.status !== "valid" || verdict.other === "silent") {
    return fullRemovePlan(args.record);
  }

  return {
    layerOnly: true,
    entries: layerRemovalEntries(args.record, args.target, other.config, args.marketplace),
  };
}

/**
 * LAYER-03: the explicit plugins whose `<plugin>@<marketplace>` key the target
 * layer declares and the other layer does not. A key both layers declare stays
 * installed. A dependency record follows the retention rule in
 * `cascadeDependencies`, as on the full remove, even when a file declares its
 * key.
 */
function layerRemovalEntries(
  record: ExtensionMarketplaceRow,
  target: ScopeConfig,
  other: ScopeConfig,
  marketplace: string,
): readonly (readonly [string, ExtensionPluginRow])[] {
  return Object.entries(record.plugins).filter(([plugin, installed]) => {
    const key = `${plugin}@${marketplace}`;
    return (
      !isDependencyRecord(installed) &&
      ownValue(target.plugins, key) !== undefined &&
      ownValue(other.plugins, key) === undefined
    );
  });
}

/**
 * Commits a remove whose every plugin unstaged. A layer remove drops the
 * marketplace entry and its `*@<marketplace>` keys from the target layer only
 * and keeps the state record; the full remove deletes the record unless a
 * kept dependency record remains under it. That record stays with its data
 * directory and clone while the config no longer declares the marketplace,
 * which the reconcile planner keeps while it holds a dependency record.
 * Answers whether the record was deleted.
 */
async function commitRemove(args: {
  readonly tx: { readonly state: { marketplaces: Record<string, unknown> } };
  readonly record: ExtensionMarketplaceRow;
  readonly plan: RemovePlan;
  readonly marketplace: string;
  readonly locations: ScopedLocations;
  readonly targetConfigPath: string;
  readonly orchestrated: boolean;
}): Promise<boolean> {
  const { tx, marketplace, locations, orchestrated } = args;
  if (args.plan.layerOnly) {
    await cascadeRemoveFromLayer(args.targetConfigPath, locations.scopeRoot, marketplace);
    return false;
  }

  const deleteRecord = Object.keys(args.record.plugins).length === 0;
  await commitFullRemove({ tx, marketplace, locations, orchestrated, deleteRecord });
  return deleteRecord;
}

/**
 * Leaves the state lock without `tx.save()` when the scope's declarations
 * cannot be read, carrying the index's cause line to the row emitter.
 */
class DeclarationIndexStop extends Error {
  readonly unreadable: Error;
  constructor(unreadable: Error) {
    super("declaration-index-stop");
    this.name = "DeclarationIndexStop";
    this.unreadable = unreadable;
  }
}

/**
 * The scope's declaration index, read offline (NFR-5) only when the remove has
 * something to decide with it: the record holds a dependency record, or a
 * layer remove uninstalls a plugin that a staying plugin may declare. Without
 * either, a marketplace whose own manifest broke stays removable. D-05-05: one
 * state document, so every holder is a record of this scope, including a
 * plugin of a marketplace a project install brought in from the user scope.
 * D-05-07: an index that cannot be read refuses the remove before any cascade.
 */
async function readRetentionIndex(args: {
  readonly state: ExtensionState;
  readonly record: ExtensionMarketplaceRow;
  readonly plan: RemovePlan;
  readonly locations: ScopedLocations;
  readonly read: typeof buildScopeDeclarationIndex;
}): Promise<DeclarationIndex | undefined> {
  const layerUninstalls = args.plan.layerOnly && args.plan.entries.length > 0;
  if (!layerUninstalls && !Object.values(args.record.plugins).some(isDependencyRecord)) {
    return undefined;
  }

  const result = await args.read({ state: args.state, locations: args.locations });
  if (!result.ok) {
    throw new DeclarationIndexStop(result.cause);
  }

  return result.index;
}

/** One plugin a layer remove would uninstall while staying plugins declare it. */
interface HeldRemoval {
  readonly plugin: string;
  readonly dependents: readonly string[];
}

/**
 * Leaves the state lock without `tx.save()` when a layer remove would
 * uninstall a plugin that a staying plugin still declares, carrying those
 * plugins to the row emitter.
 */
class HeldRemovalStop extends Error {
  readonly held: readonly [HeldRemoval, ...HeldRemoval[]];
  constructor(held: readonly [HeldRemoval, ...HeldRemoval[]]) {
    super("held-removal-stop");
    this.name = "HeldRemovalStop";
    this.held = held;
  }
}

/**
 * LAYER-03: a layer remove never uninstalls a plugin that a plugin it leaves
 * installed still declares, whether that plugin is under the same marketplace
 * in the other file or under another marketplace. Such a remove is refused
 * before anything changes, as `disable` refuses (`{dependents remain}`): the
 * user uninstalls the dependents first, or removes the marketplace from the
 * other file too. The full remove applies no such rule, because it removes the
 * marketplace from the scope. MPR-01: the caller passes the index without its
 * disabled holders, so a disabled dependent does not refuse the remove, as it
 * does not refuse a named uninstall.
 */
function refuseHeldRemovals(
  plan: RemovePlan,
  index: DeclarationIndex | undefined,
  marketplace: string,
): void {
  if (!plan.layerOnly || index === undefined) {
    return;
  }

  const keyOf = (plugin: string): string => `${plugin}@${marketplace}`;
  const removed = new Set(plan.entries.map(([plugin]) => keyOf(plugin)));
  const [first, ...rest] = plan.entries.flatMap(([plugin]): HeldRemoval[] => {
    const dependents = findDependents(keyOf(plugin), index).filter((key) => !removed.has(key));
    return dependents.length === 0 ? [] : [{ plugin, dependents }];
  });
  if (first !== undefined) {
    throw new HeldRemovalStop([first, ...rest]);
  }
}

/**
 * Unstages the dependency records under the marketplace that nothing left
 * declares, dependents before dependencies. A layer remove takes only the ones
 * its removed plugins reach (LAYER-03, D-MF-03); the full remove takes every
 * one nothing still holds. PRUNE-03: the order assumes every removal succeeds,
 * so each member is re-checked against the keys that actually left; a member
 * still held, for example by a plugin that failed to unstage, is kept and gets
 * no row.
 */
async function cascadeDependencies(
  args: Omit<Parameters<typeof cascadePluginsInPlace>[0], "entries"> & {
    readonly plan: RemovePlan;
    readonly index: DeclarationIndex;
  },
): Promise<void> {
  const { plan, index, ...removal } = args;
  const keyOf = (plugin: string): string => `${plugin}@${removal.marketplace}`;
  const dependencies = Object.entries(removal.record.plugins).filter(([, plugin]) =>
    isDependencyRecord(plugin),
  );
  const candidates = dependencies.map(([plugin]) => ({
    key: keyOf(plugin),
    provenance: "dependency" as const,
  }));
  const removed = new Set(plan.entries.map(([plugin]) => keyOf(plugin)));
  const order = (plan.layerOnly ? pruneOrphansReachableFrom : pruneOrphans)(
    candidates,
    index,
    removed,
  );
  // Every key in `order` is a candidate's key, so each yields one entry.
  const members = order.flatMap((key) => dependencies.filter(([plugin]) => keyOf(plugin) === key));
  for (const member of members) {
    const gone = new Set(removal.successfullyUnstaged.map(keyOf));
    if (!isHeldBy(index, gone, keyOf(member[0]))) {
      // eslint-disable-next-line no-await-in-loop -- a later member's held check reads what left
      await cascadePluginsInPlace({ ...removal, entries: [member] });
    }
  }
}

/**
 * What the lock body leaves for the post-guard cleanup: the recorded
 * `source.kind` (github clone retention) and whether the state record is gone.
 */
interface RemoveLockResult {
  readonly sourceKind: RecordedSourceKind | undefined;
  readonly recordDeleted: boolean;
}

/**
 * Body of the per-scope state lock. A CFG-03 throw propagates to the caller's
 * catch arm; a missing record is a no-op (saves state as-is). Extracted to
 * keep `removeMarketplace`'s cognitive complexity within the project's lint
 * budget.
 */
async function runRemoveLockBody(args: {
  readonly tx: {
    readonly state: { marketplaces: Record<string, unknown> };
    save(): Promise<void>;
  };
  readonly opts: RemoveMarketplaceOptions;
  readonly locations: ScopedLocations;
  readonly targetConfigPath: string;
  readonly orchestrated: boolean;
  readonly cascade: typeof cascadeUnstagePlugin;
  readonly successfullyUnstaged: string[];
  readonly failedPlugins: FailedPluginCascade[];
  readonly mcpConfigNotices: McpConfigNotice[];
  readonly cfgInvalidSentinel: Error;
}): Promise<RemoveLockResult> {
  const {
    tx,
    opts,
    locations,
    targetConfigPath,
    orchestrated,
    cascade,
    successfullyUnstaged,
    failedPlugins,
    mcpConfigNotices,
    cfgInvalidSentinel,
  } = args;

  // CFG-03 (T-56-02-05): abort BEFORE any state mutation; basename-only.
  const cfg = await loadConfig(targetConfigPath);
  if (cfg.status === "invalid") {
    throw cfgInvalidSentinel;
  }

  const state = tx.state as { marketplaces: Record<string, ExtensionMarketplaceRow> };
  const record = ownValue(state.marketplaces, opts.name);
  if (record === undefined) {
    // Concurrent removal between pre-guard probe and the lock body:
    // save the (unchanged) state and let the post-guard arm emit the
    // header-only `(removed)` row.
    await tx.save();
    return { sourceKind: undefined, recordDeleted: true };
  }

  const plan = orchestrated
    ? fullRemovePlan(record)
    : await planStandaloneRemove({
        target: cfg.status === "valid" ? cfg.config : { schemaVersion: 1 },
        locations,
        targetIsLocal: opts.local === true,
        record,
        marketplace: opts.name,
      });

  const src = record.source as { kind?: unknown };
  const sourceKind: RecordedSourceKind | undefined =
    src.kind === "github" || src.kind === "url" || src.kind === "path" || src.kind === "unknown"
      ? src.kind
      : undefined;

  const index = await readRetentionIndex({
    state: tx.state as ExtensionState,
    record,
    plan,
    locations,
    read: opts.declarationIndex ?? buildScopeDeclarationIndex,
  });
  refuseHeldRemovals(
    plan,
    index === undefined ? undefined : withoutDisabledHolders(index, tx.state as ExtensionState),
    opts.name,
  );

  // D-02: per-plugin cascade loop (MR-3 continuation across failures).
  const removal = {
    record,
    marketplace: opts.name,
    locations,
    cascade,
    successfullyUnstaged,
    failedPlugins,
    mcpConfigNotices,
  };
  await cascadePluginsInPlace({ ...removal, entries: plan.entries });
  if (index !== undefined) {
    await cascadeDependencies({ ...removal, plan, index });
  }

  // MR-7: a failed plugin keeps the record and writes no config.
  const recordDeleted =
    failedPlugins.length === 0 &&
    (await commitRemove({
      tx,
      record,
      plan,
      marketplace: opts.name,
      locations,
      targetConfigPath,
      orchestrated,
    }));

  await tx.save();
  return { sourceKind, recordDeleted };
}

/**
 * The in-state marketplace row -- the `record` shape passed through the
 * cascade and write-back helpers. Indexed off the persistence schema so the
 * row cannot drift from what `state.json` actually holds.
 */
type ExtensionMarketplaceRow = ExtensionState["marketplaces"][string];

/**
 * Resolve the target scope/locations or surface the missing-marketplace
 * precondition through the correct standalone/orchestrated arm. Returns:
 *   - `{ scope, locations }` on success
 *   - `RemoveMarketplaceOutcome` (status: "failed", reason: "marketplace not added")
 *     when the marketplace is missing -- in standalone mode the shared helper has
 *     already emitted the `(failed) {marketplace not added}` row and answered
 *     `undefined`, so the miss is re-expressed here as the same typed outcome
 *     the orchestrated arm builds. The standalone entrypoint discards it.
 */
async function resolveRemoveTargetOrSurface(
  opts: RemoveMarketplaceOptions,
  userLocations: ScopedLocations,
  projectLocations: ScopedLocations,
  orchestrated: boolean,
): Promise<{ scope: Scope; locations: ScopedLocations } | RemoveMarketplaceOutcome> {
  if (orchestrated) {
    return resolveScopeOrFailedOutcome(opts, userLocations, projectLocations);
  }

  const resolved = await resolveScopeOrNotifyNotAdded(opts, userLocations, projectLocations);

  return (
    resolved ??
    notAddedOutcome(opts.name, opts.scope === undefined ? ["project", "user"] : [opts.scope])
  );
}

/**
 * CFG-03 (T-56-02-05) terminal arm: surface a structured `(failed) {invalid
 * manifest}` row through the correct standalone/orchestrated channel. The
 * error message carries the basename only -- never the absolute config path.
 */
function surfaceCfgInvalid(args: {
  readonly opts: RemoveMarketplaceOptions;
  readonly orchestrated: boolean;
  readonly configBasename: string;
  readonly scope: Scope;
}): RemoveMarketplaceOutcome {
  const { opts, orchestrated, configBasename, scope } = args;
  const synthetic = new Error(`Config file "${configBasename}" failed schema validation.`);
  const outcome: RemoveMarketplaceOutcome = {
    status: "failed",
    reason: "invalid manifest",
    error: synthetic,
    cause: errorMessage(synthetic),
  };
  if (!orchestrated) {
    // OUT-07 / D-12: one marketplace block -> Single 1-tuple. No child rows; the
    // `(failed) {invalid manifest}` header renders via the central renderMpHeader
    // seam the spine reuses.
    const invalidManifestRows: Single<MarketplaceRows<RemoveRowMsg>> = [
      {
        name: opts.name,
        scope,
        status: "failed",
        reasons: ["invalid manifest"],
        // D-03: a failed marketplace remove -> error.
        severity: "error",
        plugins: [],
      },
    ];
    notifyWithContext(opts.ctx, opts.run, REMOVE_CONTEXT, invalidManifestRows, undefined, "single");
  }

  return outcome;
}

/**
 * LAYER-02: the standalone row of a remove the layer gate stopped: the failed
 * header with one failed child carrying the reason and the cause line. For an
 * unreadable other file the reason is `{invalid manifest}` and the cause line
 * names that file by its basename, so the user knows which file to repair.
 */
function surfaceLayerGateStop(
  opts: RemoveMarketplaceOptions,
  scope: Scope,
  verdict: LayerGateStopVerdict,
): RemoveMarketplaceOutcome {
  const { reason, error } =
    verdict.kind === "other-unreadable"
      ? {
          reason: "invalid manifest" as const,
          error: new Error(`Config file "${verdict.otherBasename}" failed schema validation.`),
        }
      : { reason: verdict.reason, error: verdict.refusal };
  return surfaceMarketplaceFailure({ opts, orchestrated: false, scope, reason, error });
}

/**
 * LAYER-03: the standalone row of a layer remove refused because staying
 * plugins still declare plugins it would uninstall: the failed header with one
 * `{dependents remain}` child per such plugin, its cause line naming the
 * plugins that declare it. Only a standalone remove makes a layer remove.
 */
function surfaceHeldRemovals(
  opts: RemoveMarketplaceOptions,
  scope: Scope,
  held: HeldRemovalStop["held"],
): RemoveMarketplaceOutcome {
  const refusals = held.map(({ plugin, dependents }) => ({
    plugin,
    cause: new Error(composeHeldRemovalCause(opts.name, dependents)),
  }));
  const heldRows: Single<MarketplaceRows<RemoveRowMsg>> = [
    {
      name: opts.name,
      scope,
      status: "failed",
      severity: "error",
      plugins: refusals.map(({ plugin, cause }): PluginFailedMessage => ({
        status: "failed",
        name: plugin,
        reasons: ["dependents remain"],
        cause,
        severity: "error",
        needsReload: false,
      })),
    },
  ];
  notifyWithContext(opts.ctx, opts.run, REMOVE_CONTEXT, heldRows, undefined, "single");
  const error = new Error(composeHeldRemovalCause(opts.name, held[0].dependents));
  return { status: "failed", reason: "dependents remain", error, cause: errorMessage(error) };
}

/**
 * A remove stopped at the marketplace itself: the failed header with one
 * failed child carrying the reason and the cause line, in standalone mode,
 * and the typed failed outcome in both modes.
 */
function surfaceMarketplaceFailure(args: {
  readonly opts: RemoveMarketplaceOptions;
  readonly orchestrated: boolean;
  readonly scope: Scope;
  readonly reason: ContentReason;
  readonly error: Error;
}): RemoveMarketplaceOutcome {
  const { opts, reason, error } = args;
  if (!args.orchestrated) {
    notifyWithContext(
      opts.ctx,
      opts.run,
      REMOVE_CONTEXT,
      marketplaceFailureRows(opts.name, args.scope, reason, error),
      undefined,
      "single",
    );
  }

  return { status: "failed", reason, error, cause: errorMessage(error) };
}

/**
 * The failed outcome of a remove whose state transaction threw: each stop the
 * lock body raised, the CFG-03 sentinel, and a held state lock (FLR-02)
 * becomes its row. Any other throw leaves through
 * `rethrowWithMcpConfigNotices`.
 */
function surfaceRemoveStop(
  err: unknown,
  args: {
    readonly opts: RemoveMarketplaceOptions;
    readonly orchestrated: boolean;
    readonly scope: Scope;
    readonly configBasename: string;
    readonly cfgInvalidSentinel: Error;
    readonly mcpConfigNotices: readonly McpConfigNotice[];
  },
): RemoveMarketplaceOutcome {
  const { opts, orchestrated, scope } = args;
  if (err instanceof LayerGateStop) {
    return surfaceLayerGateStop(opts, scope, err.verdict);
  }

  if (err instanceof HeldRemovalStop) {
    return surfaceHeldRemovals(opts, scope, err.held);
  }

  if (err instanceof DeclarationIndexStop) {
    return surfaceMarketplaceFailure({
      opts,
      orchestrated,
      scope,
      reason: "unreadable",
      error: err.unreadable,
    });
  }

  if (err instanceof StateLockHeldError) {
    return surfaceMarketplaceFailure({
      opts,
      orchestrated,
      scope,
      reason: "lock held",
      error: err,
    });
  }

  if (err !== args.cfgInvalidSentinel) {
    rethrowWithMcpConfigNotices(err, opts, orchestrated, args.mcpConfigNotices);
  }

  return surfaceCfgInvalid({ opts, orchestrated, configBasename: args.configBasename, scope });
}

/**
 * MR-7 / MURL-04: the marketplace data dir and, for github and url sources, the
 * `sources/<name>/` clone of a marketplace whose state record is gone.
 */
async function removeMarketplaceFootprint(
  locations: ScopedLocations,
  name: string,
  sourceKind: RecordedSourceKind | undefined,
): Promise<void> {
  await removePath(locations.marketplaceDataDir(name));

  if (sourceKind === "github" || sourceKind === "url") {
    await removePath(locations.sourceCloneDir(name));
  }
}

/**
 * POST-STATE cleanup (MR-5 / MR-6 / MR-7), run OUTSIDE the guard once
 * state.json has already saved. Every arm is hygienic, never a contract: per
 * D-18-01 individual failures are swallowed by `removePath` and the `rm()`
 * calls themselves still run, because there is no notification shape for a
 * cache or cleanup failure AFTER a successful state mutation.
 *
 * D-03-INV: the marketplace-names cache and the per-marketplace plugin cache
 * file are unlinked because the marketplace set changed and this marketplace
 * is gone.
 *
 * MR-7: the marketplace data dir and clone dirs are retained when ANY plugin
 * failed, so they are only reclaimed on the all-unstaged arm, and only when
 * the state record is gone: a layer remove keeps the record, the data dir,
 * and the clone while the other layer declares the marketplace (LAYER-03).
 * MURL-04 / NFR-3:
 * both github and url sources have a `sources/<name>/` clone, and a url clone
 * left behind would permanently trip MA-6 `{stale clone}` on re-add; path
 * sources never have one.
 *
 * PURL-05 / PURL-06 / D-78-01: the plugin-clone GC reclaims any
 * `plugin-clones/<key>/` dir the cascade-uninstalled plugins no longer
 * reference. It runs post-commit, so it derives live clone keys from the
 * just-committed state -- the removed plugins' records are gone, so their
 * clones are unreferenced and swept, while a clone still referenced by a
 * surviving marketplace's plugin survives. The helper is fs-only, so no git
 * surface widens (NFR-5), and NFR-3 holds: a crash before this leaves an
 * orphan the next idempotent pass removes.
 */
async function runPostRemoveCleanup(args: {
  readonly locations: ScopedLocations;
  readonly name: string;
  readonly scope: Scope;
  readonly completionCache: CompletionCache;
  readonly successfullyUnstaged: readonly string[];
  readonly allPluginsUnstaged: boolean;
  readonly recordDeleted: boolean;
  readonly sourceKindAtRecord: RecordedSourceKind | undefined;
}): Promise<void> {
  const { completionCache, locations, name, scope } = args;

  try {
    await completionCache.invalidateMarketplaceNames(locations.marketplaceNamesCacheFile, scope);
    await completionCache.dropMarketplaceCache(await locations.pluginCacheFile(name), scope, name);
  } catch (err) {
    // D-18-01: cache hygiene is never the primary user-facing path.
    hookDebugLog(`post-remove cache invalidation failed: ${errorMessage(err)}`);
  }

  for (const cleaned of args.successfullyUnstaged) {
    // eslint-disable-next-line no-await-in-loop -- bounded IO: one recursive data-dir delete at a time
    await removePath(locations.pluginDataDir(name, cleaned));
  }

  if (!args.allPluginsUnstaged) {
    return;
  }

  if (args.recordDeleted) {
    await removeMarketplaceFootprint(locations, name, args.sourceKindAtRecord);
  }

  try {
    await garbageCollectPluginClones(locations);
  } catch (err) {
    // D-19-01: hygienic cleanup never becomes the primary user-facing path.
    hookDebugLog(`post-remove plugin-clone GC failed: ${errorMessage(err)}`);
  }
}

/**
 * RECON-03: returns `RemoveMarketplaceOutcome` in orchestrated mode and
 * `undefined` in standalone mode.
 *
 * D-115-10: the overload pair narrows the orchestrated-mode return to
 * `Promise<RemoveMarketplaceOutcome>` (no `| undefined`), mirroring
 * `setPluginEnabled`. A reconcile cascade that dropped the row on an absent
 * outcome is now a compile error rather than a silent `continue`, so every
 * driven removal always materialises a row. The wide overload stays last so a
 * caller holding the entrypoint in a single-signature variable keeps its
 * `undefined` arm.
 *
 * WR-01: the overload is backed by a compile-time check, not by an assertion.
 * The body lives in `runRemoveOutcome`, whose DECLARED return type is
 * `Promise<RemoveMarketplaceOutcome>`, so TypeScript checks every return
 * statement and the fall-off-the-end path in it: an arm that yielded `undefined`
 * is a compile error there. A narrower overload return alone would not give that
 * -- TypeScript checks an overload signature against the implementation only
 * loosely, and accepts a narrowed return with no diagnostic even when the
 * implementation demonstrably returns the excluded value. This entrypoint is the
 * thin mode switch that reintroduces `undefined` for the standalone arm and for
 * that arm only, so the narrow overload can never outrun the body.
 */
export function removeMarketplace(
  opts: RemoveMarketplaceOptions & { notifications: { mode: "orchestrated" } },
): Promise<RemoveMarketplaceOutcome>;
export function removeMarketplace(
  opts: RemoveMarketplaceOptions,
): Promise<RemoveMarketplaceOutcome | undefined>;
export async function removeMarketplace(
  opts: RemoveMarketplaceOptions,
): Promise<RemoveMarketplaceOutcome | undefined> {
  // RECON-03: orchestrated mode suppresses every notify() call and returns the
  // typed outcome instead. Standalone (default/omitted) preserves byte-identity.
  const orchestrated = opts.notifications?.mode === "orchestrated";
  const outcome = await runRemoveOutcome(opts, orchestrated);

  return orchestrated ? outcome : undefined;
}

/**
 * The whole remove body, always answering with a typed
 * `RemoveMarketplaceOutcome`. Standalone mode emits its notify() rows on the way
 * through and its outcome is discarded by the entrypoint above; the declared
 * return type is what proves the orchestrated arms never yield `undefined`
 * (WR-01).
 */
async function runRemoveOutcome(
  opts: RemoveMarketplaceOptions,
  orchestrated: boolean,
): Promise<RemoveMarketplaceOutcome> {
  const cascade = opts.cascade ?? cascadeUnstagePlugin;

  // MR-1 + ATTR-06: resolve scope and enforce the missing-marketplace
  // precondition. On a miss the helper has already emitted the standalone
  // `(failed) {marketplace not added}` variant, so return without entering the guard.
  const userLocations = locationsFor("user", opts.cwd);
  const projectLocations = locationsFor("project", opts.cwd);

  const resolved = await resolveRemoveTargetOrSurface(
    opts,
    userLocations,
    projectLocations,
    orchestrated,
  );
  if ("status" in resolved) {
    return resolved;
  }

  const { locations } = resolved;

  // WB-01: target-path selection happens ONCE before the lock so
  // the orchestrator NEVER falls back to the base config on ENOENT.
  const targetConfigPath =
    opts.local === true ? locations.localConfigJsonPath : locations.baseConfigJsonPath;
  const configBasename = path.basename(targetConfigPath);

  // Per-plugin tracking accumulators captured by the guard closure.
  const failedPlugins: FailedPluginCascade[] = [];
  const successfullyUnstaged: string[] = []; // plugins whose cascade returned ok:true
  const mcpConfigNotices: McpConfigNotice[] = [];
  let removal: RemoveLockResult = { sourceKind: undefined, recordDeleted: false };

  // CFG-03 sentinel: a synthetic throw signaling the lock body aborted on an
  // invalid config. The catch arm BELOW maps it to the structured failed row.
  // Using a throw (rather than a captured boolean) keeps no-unnecessary-
  // condition lint clean and structurally guarantees tx.save() is NOT called.
  const cfgInvalidSentinel = new Error("cfg-invalid-sentinel");

  try {
    await withLockedStateTransaction(
      locations,
      async (tx) => {
        removal = await runRemoveLockBody({
          tx,
          opts,
          locations,
          targetConfigPath,
          orchestrated,
          cascade,
          successfullyUnstaged,
          failedPlugins,
          mcpConfigNotices,
          cfgInvalidSentinel,
        });
      },
      opts.stateTransaction,
    );
  } catch (err) {
    return surfaceRemoveStop(err, {
      opts,
      orchestrated,
      scope: resolved.scope,
      configBasename,
      cfgInvalidSentinel,
      mcpConfigNotices,
    });
  }

  await runPostRemoveCleanup({
    locations,
    name: opts.name,
    scope: resolved.scope,
    completionCache: opts.completionCache,
    successfullyUnstaged,
    allPluginsUnstaged: failedPlugins.length === 0,
    recordDeleted: removal.recordDeleted,
    sourceKindAtRecord: removal.sourceKind,
  });

  // One MarketplaceNotificationMessage per outcome, emitted via one
  // notify(opts.ctx, opts.run, ...) call; `plugins[]` carries one
  // PluginUninstalledMessage per successfully unstaged plugin (D-22-02).
  // Per-plugin `PluginFailedMessage.cause` renders at 4-space indent under its
  // row. There is no marketplace-level cause-chain trailer.
  // - No retry anchor is emitted per D-17-09.
  // - Severity (error on partial, info on clean) is computed by notify()
  // ; the `/reload to pick up changes` trailer is computed per
  //   D-22-01 (fires iff >=1 plugin row carries a state-change token);
  //   callers MUST NOT compose.
  // - Reference: catalog UAT `clean` + `partial` fixtures.
  if (failedPlugins.length > 0) {
    return emitPartialFailure({
      opts,
      orchestrated,
      resolvedScope: resolved.scope,
      successfullyUnstaged,
      failedPlugins,
      mcpConfigNotices,
    });
  }

  if (!orchestrated) {
    emitCleanRemoval(opts, resolved.scope, successfullyUnstaged);
    notifyMcpConfigNotices(opts.ctx, opts.run, mcpConfigNotices);
  }

  return {
    status: "removed",
    name: opts.name,
    unstaged: successfullyUnstaged,
    ...mcpConfigNoticesMember(mcpConfigNotices),
  };
}

/**
 * AFILE-04: rethrows a state-transaction failure without losing the notices of
 * the plugin cascades that already rewrote MCP config files. Standalone mode
 * shows them before the throw leaves; orchestrated mode carries them on a
 * `MarketplaceRemoveFailureError`.
 */
function rethrowWithMcpConfigNotices(
  err: unknown,
  opts: Pick<RemoveMarketplaceOptions, "ctx" | "run">,
  orchestrated: boolean,
  notices: readonly McpConfigNotice[],
): never {
  if (notices.length === 0) {
    throw err;
  }

  if (orchestrated) {
    throw new MarketplaceRemoveFailureError(notices, { cause: err });
  }

  notifyMcpConfigNotices(opts.ctx, opts.run, notices);
  throw err;
}

/**
 * CMC-31 CLEAN (D-22-02): the standalone row for a removal whose whole plugin
 * cascade succeeded. mp.status="removed"; plugins[] carries one
 * PluginUninstalledMessage per successfullyUnstaged plugin (○ icon). The
 * `/reload to pick up changes` trailer is computed by notify() per
 * D-22-01 and fires iff >=1 plugin was unstaged (an `uninstalled` row is
 * a Pi-visible state change). An empty remove leaves successfullyUnstaged
 * == [] -> plugins: [] -> header-only with no trailer (G-MIL-02).
 *
 * OUT-07 / D-12: one marketplace block -> Single 1-tuple. The `(removed)`
 * header renders via the central renderMpHeader seam the spine reuses; the
 * `uninstalled` child rows dispatch through REMOVE_CONTEXT.
 */
function emitCleanRemoval(
  opts: RemoveMarketplaceOptions,
  scope: Scope,
  successfullyUnstaged: readonly string[],
): void {
  const removedRows: Single<MarketplaceRows<RemoveRowMsg>> = [
    {
      name: opts.name,
      scope,
      status: "removed",
      plugins: successfullyUnstaged.map((name): PluginUninstalledMessage => ({
        status: "uninstalled",
        name,
        // D-03/D-06: realized uninstall transition -> info, reloads.
        severity: "info",
        needsReload: true,
      })),
    },
  ];
  notifyWithContext(opts.ctx, opts.run, REMOVE_CONTEXT, removedRows, undefined, "single");
}

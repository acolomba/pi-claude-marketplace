// orchestrators/plugin/uninstall.ts
//
// PU-1..8 + PU-7 propagation + AS-6 (post-commit cleanup leaks warning-severity).
//
// Composition (D-09):
//   withLockedStateTransaction(locations, async (tx) => {
//     PU-5 silent converge: if record absent, set alreadyGone=true and return (NO save)
//     D-06-06 declarer read: collect the OTHER records in this scope that
//       declare the target, and throw UninstallRefusedError only when some
//       record's declarations cannot be read (D-05-07) -- BEFORE the cascade,
//       so a refusal leaves nothing off disk; the read hands back the
//       declaration index, the walked records and the dependent keys
//     outcome = await cascadeUnstagePlugin(plugin, marketplace, locations, installed)
//     if (!outcome.ok) throw outcome.cause  // PU-7 propagation; state record retained
//     delete state.marketplaces[mp].plugins[plugin]
//     D-05-01..03 / D-05-10 (`prune`): sweep the orphaned dependency records
//       out of the SAME snapshot -- pruneOrphans over the guard's index, then
//       the per-member removal body for each key, in that order; a member
//       failure is a warning row, never a throw, and the members never save
//     await tx.save()  // WR-04: explicit save on mutating arms ONLY -- ONCE,
//                      // after the primary AND every pruned member
//   })
//   if (alreadyGone) return  -- PU-5 silent success
//   POST-state-commit: rm -rf pluginDataDir unless keepData; leaks SWALLOWED per
//   D-19-01 -- the underlying rm() still runs, only the user-visible
//   warning surface is gone. The same cleanup then runs once per removed
//   member with the same `keepData` (D-05-09).
//   PU-8 reload hint: set explicitly on the row (severity: "info",
//   needsReload: true, D-03/D-06) because uninstalled is a realized,
//   state-changing transition; notify() aggregates it into the cascade's
//   overall trailer.
//
// Each outcome arm emits one notify() call. The success arm's blocks are the
// named plugin's marketplace first and one block per other marketplace that
// lost a pruned member, in first-appearance order (PRUNE-04); with nothing
// pruned that is the one block the plain uninstall renders (D-05-12). Post-state
// cleanup failures (cache-refresh, data-dir rm) are swallowed: the underlying
// calls still run; there is no notification shape for "cleanup leak after a
// successful state mutation".
//
// Cycle break (D-11): orchestrators/plugin/ may import named exports from
// orchestrators/marketplace/shared.ts ONLY (NOT from add.ts/remove.ts/etc).
//
// NFR-5 (no network): this file MUST NOT import platform/git or DEFAULT_GIT_OPS.
// The architectural source-grep test gates this file by name: the D-06-06
// declarer read composes an offline manifest read through `dependency-index.ts`
// (memoized manifest cache + warm clone cache only, D-05-06), and that leaf is
// gated beside it.
//
// PU-6 (legacy state migration): handled by persistence/migrate.ts at load
// time (ST-4/ST-5). No new code needed here -- a state record missing
// `resources.agents` / `resources.mcpServers` is normalized to [] by
// loadState BEFORE the withStateGuard closure observes it.
//
// API parameter shape note: `pi` is required because `notify(ctx, pi,
// message)` consumes it for the single softDepStatus(pi) probe per call.
// The uninstalled variant has no `dependencies` field by
// construction (D-15-02 / MSG-SD-3) so the renderer cannot emit
// `{requires pi-subagents}` / `{requires pi-mcp}` markers on (uninstalled)
// rows even though the probe is uniformly threaded.

import { rm } from "node:fs/promises";
import path from "node:path";

import { findDependents, isHeldBy, pruneOrphans } from "../../domain/dependency-orphans.ts";
import { loadConfig } from "../../persistence/config-io.ts";
import { deletePluginConfigEntry } from "../../persistence/config-write-back.ts";
import { hookDebugLog } from "../../shared/debug-log.ts";
import { StateLockHeldError, errorMessage, isErrnoException } from "../../shared/errors.ts";
import { type ContentReason } from "../../shared/notification-types.ts";
import {
  type PluginFailedMessage,
  type PluginUninstalledMessage,
  type Reason,
} from "../../shared/notification-types.ts";
import { notifyWithContext } from "../../shared/notify-context.ts";
import { withLockedStateTransaction } from "../../transaction/with-state-guard.ts";
import { AgentsUnstageFailureError, cascadeUnstagePlugin } from "../marketplace/shared.ts";

import { garbageCollectPluginClones } from "./clone-gc.ts";
import { buildScopeDeclarationIndex } from "./dependency-index.ts";
import {
  absentTargetReasons,
  applyPartialCascadeFold,
  emitMarketplaceNotAdded,
  missIsNotInstalled,
  resolveCrossScopePluginTarget,
} from "./shared.ts";
import {
  composePrunedRow,
  composeRemovalBlocks,
  composeUninstalledRow,
  UNINSTALL_CONTEXT,
} from "./uninstall.messaging.ts";

import type { IndexedRecord, ScopeDeclarationIndexResult } from "./dependency-index.ts";
import type { HooksRouting } from "../../bridges/hooks/index.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { ExtensionState } from "../../persistence/state-io.ts";
import type { NotificationContext, ToolInventory } from "../../platform/pi-api.ts";
import type { CompletionCache } from "../../shared/completion-cache.ts";
import type { Scope } from "../../shared/types.ts";
import type { UnstageOutcome } from "../marketplace/shared.ts";

/** The config-layer paths the cross-layer sweep writes through. */
type UninstallLocations = Pick<
  ScopedLocations,
  "configJsonPath" | "configLocalJsonPath" | "scopeRoot"
>;

/**
 * RECON-03: controls how `uninstallPlugin` surfaces
 * notifications. Mirrors the `AddMarketplaceNotifications` precedent.
 *
 * - `"standalone"` (default when option is omitted): matches standalone behavior.
 * - `"orchestrated"`: suppresses every `ctx.ui.notify` call and returns the
 *   typed `UninstallPluginOutcome` for `applyReconcile` to aggregate
 *   (IL-2).
 */
export type UninstallPluginNotifications =
  { readonly mode: "standalone" } | { readonly mode: "orchestrated" };

/**
 * RECON-03: discriminated outcome returned by `uninstallPlugin` in
 * orchestrated mode. The success arm carries the optional `version` of the
 * removed record (when available) so apply can compose the per-plugin row.
 *
 * WR-06: the PU-5 silent converge (record already absent
 * -- another process completed first, or there was never an install) is its
 * own `"converged"` arm so orchestrated consumers can DROP it (PU-5 "literal
 * silence", PRD §5.2.2) instead of rendering an `(uninstalled)` row for work
 * this process did not perform. An absent `version` on the `uninstalled` arm
 * is NOT a reliable converge discriminator, hence the explicit variant.
 *
 * `reason` is typed as `Reason` (broader than `ContentReason`) so the
 * structural `"marketplace not added"` sentinel returned by the missing-marketplace arm
 * flows through the same field; mirrors `RemoveMarketplaceOutcome`.
 */
export type UninstallPluginOutcome =
  | { readonly status: "uninstalled"; readonly name: string; readonly version?: string }
  | { readonly status: "converged"; readonly name: string }
  | {
      readonly status: "failed";
      readonly reason: Reason;
      readonly error: Error;
      readonly cause: string;
    };

/**
 * PU-1..8 options bundle. `scope` + `cwd` together resolve a `ScopedLocations`
 * via `locationsFor`. `marketplace` + `plugin` identify the (mp, plugin) tuple
 * to remove.
 *
 * D-09 injection seam: `cascade` defaults to `cascadeUnstagePlugin`. Tests
 * inject a stub to force per-cascade outcomes (e.g., forced AgentsUnstageFailureError
 * for PU-7 coverage; forced all-empty dropped for PU-8 zero-dropped coverage).
 */
export interface UninstallPluginOptions {
  readonly ctx: NotificationContext;
  /** Factory `pi` reference -- threaded into `notify()` for the single softDepStatus(pi) probe. */
  readonly pi: ToolInventory;
  readonly scope?: Scope;
  /** Project-scope cwd (ignored for user scope; see locationsFor). */
  readonly cwd: string;
  readonly marketplace: string;
  readonly plugin: string;
  /** Preserves plugin data after uninstall; omission or false removes it. */
  readonly keepData?: boolean;
  /**
   * D-05-10: also removes every dependency-installed record in the scope that
   * no remaining installed plugin declares, after the named plugin. Omission
   * or false is "no prune". Honoured in standalone mode only: under
   * `notifications.mode === "orchestrated"` the option is ignored, because the
   * orchestrated outcome carries no member rows to report a sweep, and the
   * reconcile caller never sets it (D-05-08).
   */
  readonly prune?: boolean;
  /**
   * D-12-style injection seam for the per-plugin cascade primitive. Defaults
   * to `cascadeUnstagePlugin` from `../marketplace/shared.ts`. Tests inject a
   * stub for deterministic outcome control. Zero runtime cost in production:
   * a single `??` fallback.
   */
  readonly cascade?: typeof cascadeUnstagePlugin;
  /**
   * RECON-03: notification mode selector. Omitted
   * (undefined) === `{ mode: "standalone" }` -- matches standalone behavior.
   */
  readonly notifications?: UninstallPluginNotifications;
  /**
   * WB-01 / WB-02: when true, target `claude-plugins.local.json` instead
   * of `claude-plugins.json`. The base file is NEVER touched on the
   * --local path; loadConfig's `absent` arm yields an empty starting
   * shape that saveConfig writes back to the local path.
   */
  readonly local?: boolean;
}

/** Owns uninstall's cohesive cascade, config, state, and post-commit schedule. */
export interface UninstallTransaction {
  readonly cascadeUnstagePlugin: typeof cascadeUnstagePlugin;
  readonly commitPluginRemoval: typeof commitPluginRemoval;
  readonly loadTargetConfig: typeof loadConfig;
  readonly runPostCommitCleanup: typeof runPostUninstallCleanup;
  readonly sweepConfigLayers: typeof sweepPluginFromConfigLayers;
  readonly withLockedStateTransaction: typeof withLockedStateTransaction;
}

/** Lifecycle route effects used by uninstall after durable state commits. */
export type UninstallHooksRouting = Pick<
  HooksRouting,
  "rebuildRoutingTables" | "removePluginConfigFromCache"
>;

/**
 * D-05-07: the uninstall was REFUSED inside the locked transaction before
 * anything left disk, because some other record's declarations could not be
 * established. The reason is `unreadable`: the D-47-B "we could not read
 * on-disk state" member, because the row's subject is the target and the
 * declarer's own read-failure token would make a false claim about the
 * target's manifest; the cause line names the declarer.
 *
 * D-06-06 narrowed this class to that ONE outcome. A target other installed
 * plugins still declare is no longer refused -- it is removed, and the
 * dependents are named on the success row.
 *
 * `message` IS the rendered cause line, so it carries only `name@marketplace`
 * keys, field paths or already-redacted text -- never an absolute path -- and
 * no `{ cause }` is chained behind it. Exported because the reconcile path
 * narrows on it with `instanceof` to decide which failed rows carry a cause
 * (D-05-16).
 */
export class UninstallRefusedError extends Error {
  readonly reason: ContentReason;
  constructor(reason: ContentReason, message: string) {
    super(message);
    this.name = "UninstallRefusedError";
    this.reason = reason;
  }
}

/** The guard's successful walk: the declaration index and the records it indexed. */
type DeclarationSnapshot = Extract<ScopeDeclarationIndexResult, { readonly ok: true }>;

/** The declaration walk, plus the records that declare the plugin being removed. */
interface DeclarerReading {
  readonly snapshot: DeclarationSnapshot;
  /** Sorted `name@marketplace` keys, empty when nothing declares the target. */
  readonly dependents: readonly string[];
}

/**
 * D-06-06 / D-05-07: read who declares `key` in this scope, and refuse only
 * when that question cannot be answered. Runs INSIDE the locked transaction
 * over `tx.state`, so the declarer set and the removal decision share one
 * snapshot under one cross-process lock (T-05-03). Returns the walk on the way
 * through, because the orphan sweep that follows the removal consumes both its
 * index and its candidate records.
 *
 * A non-empty dependent set no longer blocks the removal (D-06-06, superseding
 * D-05-14): it is reported on the success row, and each dependent is disabled
 * with a remedy at the next load by the load-time check. Who counts as a
 * declarer is unchanged -- a disabled record still holds its declarations
 * (D-05-04), only this scope is consulted (D-05-05), and every declaration is
 * read offline (D-05-06).
 */
async function readDeclarers(args: {
  readonly state: ExtensionState;
  readonly locations: ScopedLocations;
  readonly key: string;
}): Promise<DeclarerReading> {
  const result = await buildScopeDeclarationIndex({
    state: args.state,
    locations: args.locations,
    exclude: args.key,
  });
  // D-05-07 fail-closed, PRESERVED by D-06-06 and NOT to be relaxed alongside
  // the dependents refusal it used to sit beside: an unreadable record is
  // never read as "declares nothing". Without this throw a damaged manifest
  // would turn into a silent removal of something another plugin needs, which
  // is the one outcome this read must never produce.
  if (!result.ok) {
    throw new UninstallRefusedError("unreadable", result.cause.message);
  }

  return { snapshot: result, dependents: findDependents(args.key, result.index) };
}

/**
 * The one concrete binding of uninstall's semantic transaction contract.
 * `orchestrators/plugin/operations.ts` is its single consumer: three of the six
 * members are steps of the uninstall algorithm itself and stay private to this
 * module, so the bound object -- not its parts -- is what the composition owner
 * imports (D-03).
 */
export const REAL_UNINSTALL_TRANSACTION: UninstallTransaction = {
  cascadeUnstagePlugin,
  commitPluginRemoval,
  loadTargetConfig: loadConfig,
  runPostCommitCleanup: runPostUninstallCleanup,
  sweepConfigLayers: sweepPluginFromConfigLayers,
  withLockedStateTransaction,
};

/**
 * Narrow an Error thrown out of the locked transaction -- a D-05-07
 * unreadable-declarer refusal, a lock already held, or a
 * `cascadeUnstagePlugin` failure (PU-7 propagation path) -- to a closed-set
 * Reason for `PluginFailedMessage.reasons`. Mirrors the typed-cause dispatch
 * in `orchestrators/marketplace/remove.ts`: the refusal carries its own token
 * and is classified FIRST (before the errno fallthrough could read it as
 * `unreadable`, which would lose the distinction between a declarer that
 * could not be read and a cascade that could not remove), then instanceof
 * `StateLockHeldError`, then instanceof `AgentsUnstageFailureError`, then
 * `NodeJS.ErrnoException.code`, permissive fallback last. Closed-set Reasons
 * live in `shared/notification-types.ts::REASONS`.
 */
function narrowCascadeFailure(cause: Error): ContentReason {
  if (cause instanceof UninstallRefusedError) {
    return cause.reason;
  }

  if (cause instanceof StateLockHeldError) {
    return "lock held";
  }

  if (cause instanceof AgentsUnstageFailureError) {
    // ATTR-09 / D-47-B: foreign content owned by another process is a
    // content/ownership mismatch, not a manifest absence, so the truthful
    // member is `"source mismatch"` and not `"not in manifest"` (no new
    // REASONS member -- the closed set already covers it).
    return "source mismatch";
  }

  if (isErrnoException(cause)) {
    switch (cause.code) {
      case "EACCES":
      case "EPERM":
        return "permission denied";
      case "ENOENT":
        return "source missing";
      default:
        break;
    }
  }

  // ATTR-09 / D-47-B: the unclassified cascade-failure default is genuinely
  // "we could not read/remove on-disk state", not a manifest claim, so the
  // truthful member is `"unreadable"` and not `"not in manifest"`.
  return "unreadable";
}

/**
 * RECON-03: route a transaction-failure cause -- a cascade failure, a held
 * lock, or a D-05-07 refusal -- to either the typed orchestrated outcome or
 * the standalone notify() row. The refusal renders through this one channel
 * on purpose: the version, the cause line (the error's message), error
 * severity and the absent reload hint are already what a refused row needs.
 * Extracted from `uninstallPlugin` to keep cognitive complexity inside the
 * SonarJS lint budget.
 */
function emitCascadeFailure(args: {
  ctx: NotificationContext;
  pi: ToolInventory;
  marketplace: string;
  scope: Scope;
  plugin: string;
  cause: Error;
  removedVersion: string | undefined;
  orchestrated: boolean;
}): UninstallPluginOutcome | undefined {
  const { ctx, pi, marketplace, scope, plugin, cause, removedVersion, orchestrated } = args;
  if (orchestrated) {
    return {
      status: "failed",
      reason: narrowCascadeFailure(cause),
      error: cause,
      cause: errorMessage(cause),
    };
  }

  const failedRow: PluginFailedMessage = {
    status: "failed",
    name: plugin,
    reasons: [narrowCascadeFailure(cause)],
    ...(removedVersion !== undefined && { version: removedVersion }),
    cause,
    // D-03/D-06: a failed uninstall -> error, no reload (nothing changed).
    severity: "error",
    needsReload: false,
  };
  notifyWithContext(
    ctx,
    pi,
    UNINSTALL_CONTEXT,
    [
      {
        name: marketplace,
        scope,
        plugins: [failedRow],
      },
    ],
    undefined,
    "single",
  );
  return undefined;
}

/**
 * WB-01 / CFG-03 / T-56-03-04: route the invalid-config abort to either the
 * typed orchestrated outcome or the standalone notify() row. The
 * basename-only cause prevents an absolute-path information leak.
 */
function emitConfigInvalid(args: {
  ctx: NotificationContext;
  pi: ToolInventory;
  marketplace: string;
  scope: Scope;
  plugin: string;
  configBasename: string;
  orchestrated: boolean;
}): UninstallPluginOutcome | undefined {
  const { ctx, pi, marketplace, scope, plugin, configBasename, orchestrated } = args;
  const cause = `Config file "${configBasename}" failed schema validation.`;
  const invalidErr = new Error(cause);
  if (orchestrated) {
    return { status: "failed", reason: "invalid manifest", error: invalidErr, cause };
  }

  notifyWithContext(
    ctx,
    pi,
    UNINSTALL_CONTEXT,
    [
      {
        name: marketplace,
        scope,
        plugins: [
          {
            status: "failed",
            name: plugin,
            reasons: ["invalid manifest"] as const,
            cause: invalidErr,
            // D-03/D-06: invalid-config abort -> error, no reload.
            severity: "error" as const,
            needsReload: false,
          },
        ],
      },
    ],
    undefined,
    "single",
  );
  return undefined;
}

/**
 * Delete the `plugin@marketplace` key from ONE physical config layer. Loads
 * the file fresh so the sweep sees that layer's on-disk truth.
 *
 * WR-02: proceed only when the layer is `valid` AND actually declares the key.
 * An absent/invalid layer, or a valid layer that does not declare the key, is
 * left untouched (never rewritten) -- writing anyway would rewrite the file, or
 * CREATE it with empty maps when absent, for a semantic no-op (RECON-05
 * byte/mtime stability). The sibling layer being invalid is NOT a CFG-03 abort
 * (that is scoped to the target layer inside the guard closure).
 */
async function deletePluginFromLayer(
  configPath: string,
  scopeRoot: string,
  plugin: string,
  marketplace: string,
): Promise<void> {
  const cfg = await loadConfig(configPath);
  if (cfg.status !== "valid" || cfg.config.plugins?.[`${plugin}@${marketplace}`] === undefined) {
    return;
  }

  await deletePluginConfigEntry(cfg.config, configPath, scopeRoot, plugin, marketplace);
}

/**
 * TR-03 failure split for a cascade that did not fully unstage.
 *
 *   - AG-5 (`AgentsUnstageFailureError`): foreign content owned by another
 *     process. RETHROWN so the save aborts and the row stays intact for
 *     manual recovery or retry (preserves PU-3 + PU-7).
 *   - Non-AG-5 partial failure: the cascade dropped some artifacts before
 *     throwing, so `resources.*` is filtered by `dropped.*` IN PLACE and the
 *     shrunken row persists. The caller surfaces the returned cause AFTER the
 *     save commits, so state.json never claims artifacts already gone from
 *     disk (NFR-3 fail-clean).
 */
function foldPartialCascadeFailure(
  plugin: string,
  installed: Parameters<typeof applyPartialCascadeFold>[0],
  localOutcome: UnstageOutcome,
): Error {
  const cause = cascadeFailureCause(plugin, localOutcome);
  if (cause instanceof AgentsUnstageFailureError) {
    throw cause;
  }

  applyPartialCascadeFold(installed, localOutcome.dropped);
  return cause;
}

/**
 * The cause of a cascade that did not fully unstage. `localOutcome.cause` is
 * non-undefined when ok=false (D-03 contract); the fallback keeps the type
 * honest rather than asserting.
 */
function cascadeFailureCause(plugin: string, localOutcome: UnstageOutcome): Error {
  return localOutcome.cause ?? new Error(`Cascade unstage failed for plugin "${plugin}".`);
}

/**
 * D-05-10 / D-05-13: one dependency record the sweep visited, and what became
 * of it. `removed` records leave the snapshot and get the usual post-commit
 * cleanup; a failed member keeps its (possibly shrunken)
 * record and renders a warning row. `hooksDropped` is the routing-cache fact:
 * a hooks config left disk, so the cache must forget it after the save.
 */
export interface PrunedMember {
  readonly marketplace: string;
  readonly plugin: string;
  readonly row: PluginUninstalledMessage | PluginFailedMessage;
  readonly removed: boolean;
  readonly hooksDropped: boolean;
}

/**
 * D-05-13: the warning row for a pruned member whose cascade did not fully
 * unstage. It uses `warning` because other members may have been removed while
 * this one plugin fell short. The member's record remains installed, so its
 * failed row requests no reload and the record still holds its dependencies
 * for the rest of this sweep.
 */
function buildMemberFailedRow(member: IndexedRecord, cause: Error): PluginFailedMessage {
  return {
    status: "failed",
    name: member.plugin,
    version: member.record.version,
    reasons: [narrowCascadeFailure(cause)],
    cause,
    severity: "warning",
    needsReload: false,
  };
}

/**
 * D-05-10: the guard-free removal of ONE orphaned dependency record, run inside
 * the caller's locked transaction before its single save.
 *
 * The body is TOTAL. A throw here would abort the save after the named
 * plugin's artifacts are already off disk and leave its record a ghost (NFR-3),
 * so every failure becomes the member's warning row instead (D-05-13):
 * - AG-5 (`AgentsUnstageFailureError`): the record is left untouched, as the
 *   primary's TR-03 arm leaves it, for manual recovery or retry.
 * - Any other partial failure: the dropped artifacts are folded out of the
 *   record in place, so the saved row never claims artifacts gone from disk.
 * It never saves the transaction -- the one save runs after the sweep -- and
 * never sweeps the config layers: a dependency-provenance record is declared
 * in neither config file (D-04-02), and a hand-authored declaration for one is
 * the user's desired state, which the next reload honours by reinstalling.
 */
async function removeDependencyMember(args: {
  readonly member: IndexedRecord;
  readonly locations: ScopedLocations;
  readonly keepData: boolean;
  readonly cascade: typeof cascadeUnstagePlugin;
  readonly transaction: UninstallTransaction;
}): Promise<PrunedMember> {
  const { member } = args;
  const marketplace = member.marketplace.name;
  const outcome = await args.cascade(member.plugin, marketplace, args.locations, member.record);
  if (outcome.ok) {
    args.transaction.commitPluginRemoval(member.marketplace, { plugin: member.plugin });
    return {
      marketplace,
      plugin: member.plugin,
      row: composePrunedRow({
        plugin: member.plugin,
        version: member.record.version,
        keepData: args.keepData,
      }),
      removed: true,
      hooksDropped: true,
    };
  }

  const cause = cascadeFailureCause(member.plugin, outcome);
  if (!(cause instanceof AgentsUnstageFailureError)) {
    applyPartialCascadeFold(member.record, outcome.dropped);
  }

  return {
    marketplace,
    plugin: member.plugin,
    row: buildMemberFailedRow(member, cause),
    removed: false,
    hooksDropped: outcome.dropped.hooks.length > 0,
  };
}

/**
 * D-05-01 / D-05-02: the whole-scope orphan sweep. It decides the removal
 * order with `pruneOrphans` over the locked snapshot and runs the member body
 * once per key in that order (dependents before dependencies). Named uninstall
 * passes its removed primary key in `initiallyGone`; its declaration index
 * already excludes that primary. Standalone prune passes an empty set and
 * indexes all installed records in the selected scope.
 *
 * PRUNE-03 / D-05-13: `pruneOrphans` marks each batch gone on the assumption
 * that every member in it goes, but a failed member keeps its record and is
 * still an installed declarer. So `gone` carries only the keys that actually
 * left the snapshot, and each key is re-checked against it just before its
 * removal: every holder of a key precedes it in the order, so the check is
 * exact when it runs, and a key only a failed member holds is kept -- the
 * sweep removes only what nothing remaining declares (D-05-01).
 */
export async function sweepOrphans(args: {
  readonly snapshot: DeclarationSnapshot;
  readonly initiallyGone: ReadonlySet<string>;
  readonly locations: ScopedLocations;
  readonly keepData: boolean;
  readonly cascade: typeof cascadeUnstagePlugin;
  readonly transaction: UninstallTransaction;
}): Promise<PrunedMember[]> {
  const { snapshot, initiallyGone, ...removal } = args;
  const gone = new Set(initiallyGone);
  const order = pruneOrphans(snapshot.candidates, snapshot.index, gone);
  // Every key `pruneOrphans` returns is a candidate's key, so the filter
  // yields exactly one record per key and no lookup can miss.
  const members = order.flatMap((key) =>
    snapshot.candidates.filter((candidate) => candidate.key === key),
  );
  const pruned: PrunedMember[] = [];
  for (const member of members) {
    if (isHeldBy(snapshot.index, gone, member.key)) {
      continue;
    }

    const result = await removeDependencyMember({ member, ...removal });
    if (result.removed) {
      gone.add(member.key);
    }

    pruned.push(result);
  }

  return pruned;
}

/**
 * D-06-06: the declarers that are still installed once the sweep has run. The
 * declarer set is read from the snapshot BEFORE the removal, and `--prune`
 * then removes members out of that same snapshot, so a record that both
 * declares the target and is itself swept would otherwise be named on the row
 * as needing something while it was going in the very same command. A member
 * that FAILED to remove keeps its record and stays a declarer, which is why
 * the filter reads `removed` rather than membership in the sweep.
 */
function survivingDependents(
  dependents: readonly string[],
  members: readonly PrunedMember[],
): readonly string[] {
  const gone = new Set(
    members
      .filter((member) => member.removed)
      .map((member) => `${member.plugin}@${member.marketplace}`),
  );
  return gone.size === 0 ? dependents : dependents.filter((key) => !gone.has(key));
}

/**
 * D-05-09: the post-commit cleanup of every pruned member. A member whose
 * hooks config left disk is dropped from the routing
 * cache; a removed member gets the same cache, data-directory and clone-cache
 * cleanup as a named uninstall, with the caller's data disposition. The clone GC
 * is idempotent, so running it per member is correct.
 */
export async function finalizePrunedMembers(args: {
  readonly members: readonly PrunedMember[];
  readonly hooksRouting: UninstallHooksRouting;
  readonly completionCache: CompletionCache;
  readonly locations: ScopedLocations;
  readonly scope: Scope;
  readonly keepData: boolean;
  readonly transaction: UninstallTransaction;
}): Promise<void> {
  for (const member of args.members) {
    if (member.hooksDropped) {
      dropCachedHooks(args.hooksRouting, args.scope, member.marketplace, member.plugin);
    }

    if (member.removed) {
      await args.transaction.runPostCommitCleanup({
        completionCache: args.completionCache,
        locations: args.locations,
        scope: args.scope,
        marketplace: member.marketplace,
        plugin: member.plugin,
        keepData: args.keepData,
      });
    }
  }
}

/**
 * The state-side removal commit. Runtime routes are updated separately after
 * the state save succeeds so a config or persistence rollback retains the
 * route set required by durable state.
 */
function commitPluginRemoval(
  mp: { plugins: Record<string, unknown> },
  ids: { readonly plugin: string },
): void {
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- mp.plugins is a dynamic-key Record<string, ...>.
  delete mp.plugins[ids.plugin];
}

/**
 * Remove one committed plugin's routes from its lifecycle owner. A routing
 * failure is post-commit hygiene: it cannot rewrite the durable uninstall,
 * and `/reload` rehydrates the owner from state.
 */
function dropCachedHooks(
  hooksRouting: UninstallHooksRouting,
  scope: Scope,
  marketplace: string,
  plugin: string,
): void {
  try {
    hooksRouting.removePluginConfigFromCache(scope, marketplace, plugin);
    hooksRouting.rebuildRoutingTables();
  } catch (cacheErr) {
    hookDebugLog(
      `uninstall: post-save cache/routing mutation failed for ${plugin}@${marketplace}: ${errorMessage(cacheErr)} -- hooks for this plugin remain active until /reload rebuilds routing from state.json`,
    );
  }
}

/**
 * WB-01 / WR-09: delete the plugin entry from the user-authored config.
 *
 * Cross-layer sweep: the `plugin@marketplace` key may live in either
 * `claude-plugins.json` or `claude-plugins.local.json` -- a prior `--local`
 * install can have left it in the sibling layer. Both files are inside the
 * NFR-10 sanctioned write set, and deleting from only the target layer would
 * leave the sibling declaration as a perpetual dangling reference. Each layer
 * loads fresh and is swept independently (WR-02 no-op guard per file: an
 * absent or invalid layer, or one not declaring the key, is skipped and never
 * rewritten, preserving RECON-05 byte and mtime stability).
 */
async function sweepPluginFromConfigLayers(
  locations: UninstallLocations,
  plugin: string,
  marketplace: string,
): Promise<void> {
  await deletePluginFromLayer(locations.configJsonPath, locations.scopeRoot, plugin, marketplace);
  await deletePluginFromLayer(
    locations.configLocalJsonPath,
    locations.scopeRoot,
    plugin,
    marketplace,
  );
}

/**
 * IN-05: the post-commit cleanup's inputs as one bag rather than six
 * positionals. TypeScript accepts a function of FEWER parameters where more are
 * expected, so a positional signature would let a five-parameter double
 * injected through `UninstallTransaction.runPostCommitCleanup` satisfy the
 * `typeof` seam while silently ignoring the data disposition. A missing bag
 * field is a compile error in any double.
 */
interface PostUninstallCleanupOptions {
  readonly completionCache: CompletionCache;
  readonly locations: ScopedLocations;
  readonly scope: Scope;
  readonly marketplace: string;
  readonly plugin: string;
  /** DATA-01: true preserves the plugin's data directory; false removes it. */
  readonly keepData: boolean;
}

/**
 * The three POST-state-commit cleanups, all of them hygienic and all of them
 * swallowed per D-19-01: the underlying side effect still fires, only the
 * user-visible warning surface is gone, because
 * `MarketplaceNotificationMessage` has no field for a soft warning after a
 * successful state mutation.
 *
 * D-03-INV: the plugin moved from "installed" to "available", so the cached
 * plugin index for this marketplace is dropped and the next completion read
 * rebuilds it with the new status.
 *
 * PU-2 / D-08: unless keepData is true, the data dir is removed AFTER the save, so an
 * EACCES on `rm` cannot strand state in installed=true. This is where the
 * PU-4 leaked-path warning would surface, and D-19-01 swallows it here.
 *
 * PURL-05 / D-78-01: the git clone cache is reclaimed once no surviving
 * record references it. The GC derives live keys from the just-committed
 * state, so a shared clone survives while any other plugin still references
 * it. NFR-3: a crash before this leaves an orphan the next idempotent pass
 * removes. `garbageCollectPluginClones` already folds per-dir rm leaks into a
 * returned string[] rather than throwing; the try/catch is belt and braces.
 */
async function runPostUninstallCleanup({
  completionCache,
  locations,
  scope,
  marketplace,
  plugin,
  keepData,
}: PostUninstallCleanupOptions): Promise<void> {
  try {
    await completionCache.dropMarketplaceCache(
      await locations.pluginCacheFile(marketplace),
      scope,
      marketplace,
    );
  } catch (err) {
    // D-19-01: hygienic cleanup never becomes the primary user-facing path.
    hookDebugLog(
      `uninstall: completion-cache drop failed for ${plugin}@${marketplace}: ${errorMessage(err)}`,
    );
  }

  // IN-04: the preserving branch resolves no name-derived path at all, so the
  // NFR-10 note below is a property of the DELETING branch and lives inside it.
  // Nothing is written on the preserving branch either, which is why skipping
  // the assertion costs nothing: the marketplace segment is still asserted by
  // `pluginCacheFile` above.
  if (!keepData) {
    // NFR-10: resolve OUTSIDE the try. `pluginDataDir` is not a path join -- it
    // runs assertSafeName on both segments and assertPathInside on the result,
    // and a containment failure must propagate rather than be mistaken for an
    // rm leak. D-19-01 sanctions swallowing the cleanup, not the assertion
    // guarding it.
    const dataDir = await locations.pluginDataDir(marketplace, plugin);

    try {
      await rm(dataDir, { recursive: true, force: true });
    } catch (err) {
      // D-19-01: hygienic cleanup never becomes the primary user-facing path.
      hookDebugLog(
        `uninstall: plugin data dir removal failed for ${plugin}@${marketplace}: ${errorMessage(err)}`,
      );
    }
  }

  try {
    await garbageCollectPluginClones(locations);
  } catch (err) {
    // D-19-01: hygienic cleanup never becomes the primary user-facing path.
    hookDebugLog(`uninstall: clone GC failed for ${plugin}@${marketplace}: ${errorMessage(err)}`);
  }
}

/**
 * PU-5 already-gone: the recorded plugin row is absent from state.json.
 *
 * WR-06: in ORCHESTRATED mode (reconcile apply) the converge stays SILENT --
 * it surfaces as the explicit `converged` outcome so apply can DROP it, and a
 * reconcile racing another process never reports an uninstall it did not
 * perform.
 *
 * D-01: the STANDALONE user command names an absent target it cannot operate
 * on, so it emits an error row (it was literal silence before). The row is
 * `failed` carrying the `not installed` reason -- uninstall's render map has
 * no `skipped` arm -- and carries no `cause`, so no path redaction applies.
 *
 * SCOPE-01: `notInstalledAt` separates the two callers. The cross-scope caller
 * passes the scope the operator named, and the brace additionally names where
 * the container really is; the in-scope PU-5 caller omits it, because the
 * container IS here and the only remedy is to install.
 */
function emitAlreadyGone(args: {
  readonly ctx: NotificationContext;
  readonly pi: ToolInventory;
  readonly marketplace: string;
  readonly scope: Scope;
  readonly plugin: string;
  readonly orchestrated: boolean;
  readonly notInstalledAt?: Scope;
}): UninstallPluginOutcome | undefined {
  const { ctx, pi, marketplace, scope, plugin, orchestrated } = args;
  if (orchestrated) {
    return { status: "converged", name: plugin };
  }

  const failedRow: PluginFailedMessage = {
    status: "failed",
    name: plugin,
    reasons: absentTargetReasons(args.notInstalledAt),
    severity: "error",
    needsReload: false,
  };
  notifyWithContext(
    ctx,
    pi,
    UNINSTALL_CONTEXT,
    [{ name: marketplace, scope, plugins: [failedRow] }],
    undefined,
    "single",
  );
  return undefined;
}

/**
 * RECON-03: returns `UninstallPluginOutcome` in orchestrated mode and
 * `undefined` in standalone mode (after firing the standalone notify()).
 *
 * D-115-10: the overload pair narrows the orchestrated-mode return to
 * `Promise<UninstallPluginOutcome>` (no `| undefined`), mirroring
 * `setPluginEnabled`. An absent-outcome guard (`if (result === undefined)
 * continue`) in a reconcile cascade would silently drop the row -- the
 * overload makes that a compile error, so every driven uninstall always
 * materialises a row (or the deliberate PU-5 `converged` drop). The wide
 * overload stays last so a caller holding the entrypoint in a
 * single-signature variable keeps its `undefined` arm.
 *
 * WR-01: what the overload proves and what it does not. It removes the
 * `undefined` arm AT THE CALL SITE, which is what makes a consumer's
 * absent-outcome guard a compile error. It does NOT prove the body honours it:
 * TypeScript checks an overload signature against the implementation only
 * loosely, and a narrower overload return is accepted with no diagnostic even
 * when the implementation demonstrably returns the excluded value on that path.
 * The narrowing is therefore an ASSERTION about this module, relocated from the
 * consumer to the producer's signature -- not a proof. Every orchestrated arm
 * below does return a defined outcome today, and the reconcile owner suite
 * drives this entrypoint in orchestrated mode across its whole outcome matrix
 * and asserts the complete cascade, so a regression on an exercised path fails
 * there. An arm the matrix does not reach is not covered by either.
 */
async function uninstallPluginWithTransaction(
  transaction: UninstallTransaction,
  hooksRouting: UninstallHooksRouting,
  completionCache: CompletionCache,
  opts: UninstallPluginOptions,
): Promise<UninstallPluginOutcome | undefined> {
  const { ctx, pi, cwd, marketplace, plugin } = opts;
  const cascade = opts.cascade ?? transaction.cascadeUnstagePlugin;
  const orchestrated = opts.notifications?.mode === "orchestrated";

  // ATTR-04 / SCOPE-01 / M3 / M4: the discriminated cross-scope resolver
  // distinguishes "marketplace container absent" (loud `{marketplace not added}`) from
  // "container present, plugin row absent" (silent PU-5 converge, reached via
  // the `resolved` arm's downstream `installed === undefined` branch).
  const resolution = await resolveCrossScopePluginTarget({
    cwd,
    marketplace,
    plugin,
    ...(opts.scope !== undefined && { explicitScope: opts.scope }),
  });

  // SCOPE-01: the two misses make DIFFERENT claims and must not share a row.
  // `other-scope` means the marketplace exists, just not at the requested
  // scope -- so no install record can exist there either, and the truthful
  // complaint is about the PLUGIN, not the container. Telling the operator to
  // add the marketplace would not make this uninstall succeed. `install`
  // reaches a user-scope marketplace from a project target through the CMP-3
  // fallback; uninstall deliberately does not follow it, because uninstalling
  // a record in a scope the operator did not name is not a safe guess.
  if (resolution.kind !== "resolved") {
    const notInstalledAt = await missIsNotInstalled({ cwd, marketplace, resolution });
    if (notInstalledAt !== undefined) {
      return emitAlreadyGone({
        ctx,
        pi,
        marketplace,
        scope: notInstalledAt,
        plugin,
        orchestrated,
        notInstalledAt,
      });
    }

    return emitMarketplaceNotAdded({
      ctx,
      pi,
      marketplace,
      requestedScope: resolution.requestedScope,
      orchestrated,
    });
  }

  const { scope, locations } = resolution;

  // WB-01: target-path selection happens ONCE before the lock so
  // the orchestrator NEVER falls back to the base file on ENOENT.
  const targetConfigPath =
    opts.local === true ? locations.configLocalJsonPath : locations.configJsonPath;
  const configBasename = path.basename(targetConfigPath);

  let alreadyGone = false;
  // WB-01 / CFG-03: invalid-config sentinel; surfaced post-guard with a
  // basename-only cause (T-56-03-04 information-disclosure mitigation).
  let configInvalid = false;
  // Lifted from inside the guard closure so the post-guard success path can
  // populate the PluginUninstalledMessage.version slot without re-reading
  // state. Undefined when alreadyGone (no row to render in that case).
  let removedVersion: string | undefined;
  // TR-03: captured outside the guard so the post-guard branch can
  // emit the PluginFailedMessage for non-AG-5 cascade failures AFTER the
  // shrunken-row save has committed. AG-5 still throws (preserves row);
  // non-AG-5 mutates resources.* in place and surfaces via this sentinel.
  let cascadeFailure: Error | undefined;
  const routeEffect = { removeAfterSave: false };
  // D-05-10: the sweep's members, carried out of the closure for the
  // post-commit cleanup and the report.
  const prunedMembers: PrunedMember[] = [];
  // D-06-06: the records that still declared the removed plugin, hoisted out
  // of the guard closure the way `removedVersion` already is, so the success
  // emission can name them without re-reading state outside the lock.
  let dependents: readonly string[] = [];
  const keepData = opts.keepData ?? false;

  try {
    // WR-04: explicit-save transaction so the abort arms
    // (CFG-03 invalid config, PU-5 already-gone) return WITHOUT rewriting
    // state.json -- `withStateGuard` saved unconditionally on closure
    // return, bumping state.json's mtime on every abort, diverging from the
    // documented no-save abort discipline the sibling commands follow.
    await transaction.withLockedStateTransaction(locations, async (tx) => {
      const state = tx.state;
      // CFG-03 / T-56-03-04: abort BEFORE any state mutation. The
      // basename-only message prevents an absolute-path information leak.
      // NO tx.save() -- state.json bytes and mtime are untouched.
      const cfg = await transaction.loadTargetConfig(targetConfigPath);
      if (cfg.status === "invalid") {
        configInvalid = true;
        return;
      }

      const mp = state.marketplaces[marketplace];
      if (mp === undefined) {
        // ATTR-04 reachability note. The "marketplace never added" case is
        // now caught BEFORE the guard by `resolveCrossScopePluginTarget`
        // (the `marketplace-absent` / `other-scope` arms emit `{marketplace not added}`
        // and return). So a `mp === undefined` HERE is exclusively a
        // CONCURRENT-REMOVAL race: the container existed at the resolver's
        // unlocked read but was removed by another process before this
        // locked re-load. That is the legitimate PU-5 idempotent converge
        // (PRD §5.2.2) -- silence, same as the `installed === undefined`
        // branch below.
        alreadyGone = true;
        return;
      }

      const installed = mp.plugins[plugin];
      if (installed === undefined) {
        // PU-5 silent converge: record already gone (another process completed
        // first or there was never an install). PRD §5.2.2 specifies literal
        // silence here -- no notification.
        alreadyGone = true;
        return;
      }

      removedVersion = installed.version;

      // D-06-06 / D-05-07: the declarer read runs AFTER the two converge arms
      // (a target that is not installed is `{not installed}`, never a refusal
      // -- D-05-03) and BEFORE the cascade, so the declarer set and the
      // removal decision share one snapshot, and an unreadable declarer throws
      // out of the closure with nothing removed and NO save. The walk it hands
      // back is the sweep's input (same snapshot, same lock).
      const primaryKey = `${plugin}@${marketplace}`;
      const reading = await readDeclarers({ state, locations, key: primaryKey });
      const snapshot = reading.snapshot;
      dependents = reading.dependents;

      // PU-1 ordering enforced INSIDE cascadeUnstagePlugin (D-03:
      // skills -> commands -> agents -> mcp).
      const localOutcome = await cascade(plugin, marketplace, locations, installed);

      // TR-03: split the failure handling by cause type.
      //   - AG-5 (AgentsUnstageFailureError): foreign content owned by
      //     another process. Re-throw to abort the save -- the row stays
      //     intact for manual recovery / retry (preserves PU-3+PU-7).
      //   - Non-AG-5 partial failure: the cascade dropped some artifacts
      //     before throwing. Filter installed.resources.* by
      //     localOutcome.dropped.* so the persisted row reflects only
      //     artifacts still on disk (no ghost record). Surface the failure
      //     via the cascadeFailure sentinel so the post-guard branch can
      //     fire the PluginFailedMessage AFTER the shrunken-row save
      //     commits.
      //
      // CRITICAL field-name mapping: `dropped.commands` populates from
      // `installed.resources.prompts` (the cascade primitive at
      // `orchestrators/marketplace/shared.ts::cascadeUnstagePlugin`), so
      // the filter MUST wire dropped.commands -> resources.prompts. The
      // other three axes are name-identical (skills, agents, mcpServers).
      if (!localOutcome.ok) {
        // Rethrows on the AG-5 carve-out; otherwise folds the partial drop
        // into the record in place and returns the cause for the sentinel.
        cascadeFailure = foldPartialCascadeFailure(plugin, installed, localOutcome);
        await tx.save();
        routeEffect.removeAfterSave = localOutcome.dropped.hooks.length > 0;
        return;
      }

      transaction.commitPluginRemoval(mp, { plugin });

      if (!orchestrated) {
        await transaction.sweepConfigLayers(locations, plugin, marketplace);
      }

      // D-05-03 / D-05-10: the sweep runs on THIS arm only -- the named plugin
      // is off disk and out of the snapshot -- and before the one save, so the
      // members' removals and the primary's land in a single write. It runs in
      // standalone mode only: the orchestrated outcome carries no member rows
      // to report a sweep, and the reconcile caller never sets the option
      // (D-05-08).
      if (opts.prune === true && !orchestrated) {
        prunedMembers.push(
          ...(await sweepOrphans({
            snapshot,
            initiallyGone: new Set([primaryKey]),
            locations,
            keepData,
            cascade,
            transaction,
          })),
        );
        dependents = survivingDependents(dependents, prunedMembers);
      }

      // WR-04: explicit save on the mutating success arm, ONCE, after the
      // primary's commit, the config write-back and the sweep. State persists
      // AFTER the config write-back (a write-back throw aborts the save,
      // keeping the record intact for retry); the member body never throws,
      // so a member failure cannot abort it.
      await tx.save();
      routeEffect.removeAfterSave = true;
    });
  } catch (err) {
    // PU-7 propagation: AG-5 (or any other cascade failure), a held lock, or
    // the D-05-07 refusal thrown when a declarer could not be read. State was
    // NOT saved (guard contract); the plugin record stays intact for retry.
    const cause = err as Error;
    return emitCascadeFailure({
      ctx,
      pi,
      marketplace,
      scope,
      plugin,
      cause,
      removedVersion,
      orchestrated,
    });
  }

  // WB-01 / CFG-03 / T-56-03-04: invalid-config abort. No state mutation
  // (the closure returned before reading state); no write-back.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- mutated inside the withLockedStateTransaction closure above.
  if (configInvalid) {
    return emitConfigInvalid({
      ctx,
      pi,
      marketplace,
      scope,
      plugin,
      configBasename,
      orchestrated,
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- `alreadyGone` is mutated inside the withLockedStateTransaction closure above; TS flow analysis cannot prove the closure executed, so it sees the variable as still `false`. The check is required at runtime.
  if (alreadyGone) {
    return emitAlreadyGone({ ctx, pi, marketplace, scope, plugin, orchestrated });
  }

  if (routeEffect.removeAfterSave) {
    dropCachedHooks(hooksRouting, scope, marketplace, plugin);
  }

  // TR-03: non-AG-5 cascade partial-failure surface.
  if (cascadeFailure !== undefined) {
    return emitCascadeFailure({
      ctx,
      pi,
      marketplace,
      scope,
      plugin,
      cause: cascadeFailure,
      removedVersion,
      orchestrated,
    });
  }

  await transaction.runPostCommitCleanup({
    completionCache,
    locations,
    scope,
    marketplace,
    plugin,
    // DATA-01 / D-02-04: omission is the deletion default.
    keepData,
  });
  await finalizePrunedMembers({
    members: prunedMembers,
    hooksRouting,
    completionCache,
    locations,
    scope,
    keepData,
    transaction,
  });

  // PU-8 reload hint: set explicitly on the row below (severity: "info",
  // needsReload: true, D-03/D-06) because uninstall is a realized,
  // state-changing transition; notify() aggregates each row's fields into
  // the cascade's overall trailer -- a per-variant-status decision, not a
  // per-cascade resource count. Control reaches this point only when
  // alreadyGone is false (early-returned above) AND the catch did not
  // intercept a cascade failure (early-returned via `emitCascadeFailure`),
  // so `removedVersion` was assigned by the closure.
  //
  // CMC-24 / D-13-05 / D-13-06: emit via PluginUninstalledMessage.
  // The uninstalled variant has NO per-row soft-dep predicate fields by
  // construction -- MSG-SD-3 is structurally enforced: the renderer CANNOT
  // emit `{requires pi-subagents}` / `{requires pi-mcp}` markers on
  // (uninstalled) rows. There are no aggregated PI_*_NOT_LOADED trailers on
  // uninstall success per D-13-07 + MSG-SD-3 (the soft-dep state
  // is no-op for the operator after uninstall -- the content is gone, so no
  // marker is useful). Catalog reference: the `/claude:plugin uninstall
  // <plugin>@<marketplace>` "Success" arm in `docs/output-catalog.md`.
  //
  // IN-02: the `removedVersion !== undefined` guard is kept because the
  // variable is typed `string | undefined` (hoisted from inside the
  // withLockedStateTransaction closure; the type system cannot prove the
  // closure ran). The renderer suppresses the `v<version>` token on
  // undefined or empty anyway, so the empty-version edge case is handled
  // structurally.
  // D-06-06: the orchestrated arm deliberately carries NO dependents. On the
  // reconcile surface the same fact is already reported, and reported better:
  // the load-time check gives each unsatisfied dependent its own row with the
  // full remedy naming both parties, where a dependents brace here would only
  // list names. Carrying both would state one fact twice inside a single
  // emission, which the single-emit discipline treats as a defect.
  if (orchestrated) {
    return {
      status: "uninstalled",
      name: plugin,
      ...(removedVersion !== undefined && { version: removedVersion }),
    };
  }

  // PRUNE-04: the cardinality stays `single` with members present -- the user
  // named ONE plugin, and the pruned rows are that uninstall's consequence
  // (the install cascade's precedent), so no tally line joins the report.
  const uninstalledRow = composeUninstalledRow({
    plugin,
    ...(removedVersion !== undefined && { version: removedVersion }),
    keepData,
    dependents,
  });
  notifyWithContext(
    ctx,
    pi,
    UNINSTALL_CONTEXT,
    composeRemovalBlocks({
      primary: { marketplace, row: uninstalledRow },
      members: prunedMembers,
      scope,
    }),
    undefined,
    "single",
  );
  return undefined;
}

/** Bind uninstall orchestration to one required cohesive transaction owner. */
export interface UninstallPluginOperation {
  (
    opts: UninstallPluginOptions & { notifications: { mode: "orchestrated" } },
  ): Promise<UninstallPluginOutcome>;
  (opts: UninstallPluginOptions): Promise<UninstallPluginOutcome | undefined>;
}

export function createUninstallPlugin(
  transaction: UninstallTransaction,
  hooksRouting: UninstallHooksRouting,
  completionCache: CompletionCache,
): UninstallPluginOperation {
  function configuredUninstallPlugin(
    opts: UninstallPluginOptions & { notifications: { mode: "orchestrated" } },
  ): Promise<UninstallPluginOutcome>;
  function configuredUninstallPlugin(
    opts: UninstallPluginOptions,
  ): Promise<UninstallPluginOutcome | undefined>;
  function configuredUninstallPlugin(
    opts: UninstallPluginOptions,
  ): Promise<UninstallPluginOutcome | undefined> {
    return uninstallPluginWithTransaction(transaction, hooksRouting, completionCache, opts);
  }

  return configuredUninstallPlugin;
}

export type { DeclarationSnapshot };

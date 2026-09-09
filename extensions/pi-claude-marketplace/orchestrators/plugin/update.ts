// orchestrators/plugin/update.ts
//
// PUP-1..9 + AS-3 (3-phase) + AS-7 (orphan agent index entries) + WR-04 +
// NFR-2 + NFR-3.
//
// Two exported entrypoints (D-09 corollary):
//  1. updateSinglePlugin: PluginUpdateFn -- cascade-safe; NEVER throws
//  2. updatePlugins(opts) -- direct entrypoint; PUP-1 three forms
//
// Both share the per-plugin 3-phase swap implementation (D-03 HAND-ROLLED,
// NOT runPhases -- the heterogeneous-undo flow D-02 precedent):
//
//  (prepare): sequential bridge prepare* into tmp (skills -> commands
//  -> agents -> mcp). Any throw triggers abort of already-prepared handles
//  + structured cleanup-failure descriptors.
//
//  (state-guard swap with old-resource snapshot): inside
//  `withStateGuard` re-read the plugin record, ST-9 stale-version check,
//  overwrite resources + version + updatedAt in-memory. Throw on ST-9
//  mismatch; guard does NOT save (ST-7).
//
//  Phase 3a (physical replace, aggregate failures, continue across bridges):
//  call each bridge's commitPrepared* in skills -> commands -> agents -> mcp
//  order. D-03 specifies CONTINUE across bridge failures (not fail-fast)
//  so the partial-replace state is fully observed. Failures aggregate
//  into Phase3Failure[].
//
//  Phase 3b (compose recovery hint or success): if any failures, wrap in
//  PluginUpdatePhase3Error with RECOVERY_PLUGIN_REINSTALL_PREFIX hint.
//  Else: success outcome carries WR-04 stagedAgentNames/stagedMcpServerNames.
//
// D-141-03 / D-141-05: the four bridges' staging warnings are READ (they were
// not, so every one of them was dark on this path) and split by install's
// rule through `./shared.ts::splitStagingWarnings`. The skills and commands
// DISCOVERY half always rides the `updated` outcome's `notes`; the agents and
// mcp HYGIENE half joins it in cascade mode only. The direct path renders the
// discovery half through `surfaceDiscoveryWarnings` AFTER the cascade, since
// the runner that produces a warning finishes long before the row it
// qualifies exists.
//
// PUP-9 routing:
//  updateSinglePlugin -- cascade path -- catches into partition='failed'
//  updatePlugins -- direct path -- surfaces phase-2-or-earlier throws via
//  a single notify(ctx, pi, NotificationMessage) per
//  orchestration arm (cause threaded structurally on a
//  PluginFailedMessage; renderer composes the 4-space
//  cause-chain trailer).
//
// Success and failure notifications are a single
//  notify(opts.ctx, opts.pi, { marketplaces: [{..., plugins: [...] }] })
// call per orchestration arm. notify() owns severity, the reload-hint
// trailer, and the cause-chain. The post-success completion-cache-refresh
// warning inside dropPluginCompletionCache is NOT surfaced: the underlying
// dropMarketplaceCache call still runs (correctness preserved), only the
// standalone-mode user-visible warning surface is absent.
//
// D-11 import boundaries: orchestrators/plugin/ may import named exports
// from orchestrators/marketplace/shared.ts (GitOps, DEFAULT_GIT_OPS,
// resolveScopeFromState). MUST NOT import from
// orchestrators/marketplace/{add,remove,list,update,autoupdate}.ts.

import { locationsFor } from "../../persistence/locations.ts";
import { loadState } from "../../persistence/state-io.ts";
import {
  CleanupContextError,
  cleanupFailuresFromError,
  composeErrorWithCauseChain,
  InvalidMarketplaceManifestError,
  MarketplaceNotFoundError,
  PluginUpdateConcurrencyError,
  PluginUpdatePhase3Error,
} from "../../shared/errors.ts";
import { classifyGitTransportFailure } from "../../shared/git-failure-classifiers.ts";
import { type ContentReason } from "../../shared/notification-types.ts";
import { type PluginFailedMessage } from "../../shared/notification-types.ts";
import { notifyUpdateNoOpWithContext, notifyWithContext } from "../../shared/notify-context.ts";
import { DEFAULT_GIT_OPS, refreshGitHubClone, type GitOps } from "../marketplace/shared.ts";
import { marketplaceInOtherScope } from "../marketplace/shared.ts";

import { garbageCollectPluginClones } from "./clone-gc.ts";
import {
  emitMarketplaceNotAddedSignal,
  MarketplaceNotAddedSignal,
  resolveInstalledMarketplaceTarget,
  resolveInstalledPluginTarget,
  surfaceDiscoveryWarnings,
} from "./shared.ts";
import { UPDATE_CONTEXT } from "./update.messaging.ts";

import type { UpdateCascadeOutcome, UpdateHooksRouting } from "./update-cascade.ts";
import type { UpdatePluginsOptions, UpdatePluginsTarget } from "./update-preflight.ts";
import type {
  DirectThreePhaseArgs,
  ThreePhaseArgs,
  UpdatePhase3Failure,
  UpdatePhase3FailedOutcome,
  UpdateRunOutcome,
} from "./update-swap.ts";
import type { ParsedSource } from "../../domain/source.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { NotificationContext, ToolInventory } from "../../platform/pi-api.ts";
import type { CompletionCache } from "../../shared/completion-cache.ts";
import type { Scope } from "../../shared/types.ts";
import type { PluginUpdateOutcome } from "../types.ts";

/** Runs one prepared update target for the retained enumeration hub. */
export type UpdatePluginRunner = (args: ThreePhaseArgs) => Promise<UpdateRunOutcome>;

/** Folds retained-hub outcomes through the extracted cascade owner. */
export type UpdateCascadeComposer = (
  ctx: NotificationContext,
  pi: ToolInventory,
  outcomes: readonly UpdateCascadeOutcome[],
  cardinality: "single" | "plural",
  abortedByFailure?: boolean,
) => void;
/**
 * PUP-2 syncCloneOnce memoization -- one refresh per (scope, marketplace)
 * pair. Path-source marketplaces are noops (NFR-5: no network for path
 * sources); GitHub-source marketplaces refresh via gitOps.fetch +
 * forceUpdateRef + checkout (the D-14 sequence). Throws on git-side failures.
 */
function makeSyncCloneOnce(
  gitOps: GitOps,
): (scope: Scope, mpName: string, locations: ScopedLocations) => Promise<void> {
  const synced = new Set<string>();
  return async (scope, mpName, locations) => {
    const key = `${scope}/${mpName}`;
    if (synced.has(key)) {
      return;
    }

    synced.add(key);

    const state = await loadState(locations.extensionRoot);
    const mp = state.marketplaces[mpName];
    if (mp === undefined) {
      throw new MarketplaceNotFoundError(mpName, [scope]);
    }

    const source = mp.source as ParsedSource;
    if (source.kind === "github") {
      const cloneDir = await locations.sourceCloneDir(mpName);
      await refreshGitHubClone(cloneDir, source.ref, gitOps);
    }
    // path-source: NFR-5 noop. The manifest is re-read per-plugin.
  };
}

/**
 * Build the per-target `runThreePhaseUpdate` argument bag for the DIRECT
 * update path. Every optional seam is spread only when set, so the cascade
 * entrypoint (`updateSinglePlugin`) and the direct path stay distinguishable
 * by argument shape rather than by a flag.
 */
function buildDirectThreePhaseArgs(
  opts: UpdatePluginsOptions,
  target: ResolvedTarget,
  cardinality: "single" | "plural",
  hooksRouting: UpdateHooksRouting,
  completionCache: CompletionCache,
): DirectThreePhaseArgs {
  return {
    plugin: target.plugin,
    marketplace: target.marketplace,
    scope: target.scope,
    cwd: opts.cwd,
    locations: target.locations,
    hooksRouting,
    completionCache,
    cascade: false,
    ctx: opts.ctx,
    // `pi` threads the phase-3a aggregate direct-path notify inside
    // runThreePhaseUpdate. Cascade mode leaves it undefined -- the cascade
    // orchestrator owns its own notify call.
    pi: opts.pi,
    cardinality,
    // AG-7 opt-in: `--map-model`. The cascade entrypoint never sets it, so
    // cascade re-installs always omit `model:`.
    mapModel: opts.mapModel ?? false,
    // FORCE-02: `--partial` feeds the per-plugin candidate gate (D-65-04).
    // The cascade entrypoint never sets it, so cascade re-installs keep the
    // `requireInstallable` block.
    partial: opts.partial ?? false,
    // WB-01: `--local` selects the direct-path write-back target.
    ...(opts.local === true && { local: true }),
    // PURL-06: the test-only clone-cache seam for the git-source candidate
    // probe. Undefined in production, which selects the real imports.
    ...(opts.cloneCacheSeam !== undefined && { cloneCacheSeam: opts.cloneCacheSeam }),
    // PROV-03 / D-79-02: auth seams so a git-source update on a provider host
    // authenticates host-keyed at pin-resolution and re-clone.
    ...(opts.credentialOps !== undefined && { credentialOps: opts.credentialOps }),
    ...(opts.deviceFlowHttp !== undefined && { deviceFlowHttp: opts.deviceFlowHttp }),
    ...(opts.authMemo !== undefined && { authMemo: opts.authMemo }),
    cleanupClones: garbageCollectPluginClones,
    notifyPhaseFailure: (error, failures) => {
      notifyDirectFailure({
        ctx: opts.ctx,
        pi: opts.pi,
        cardinality,
        marketplace: target.marketplace,
        scope: target.scope,
        pluginName: target.plugin,
        err: error,
        reasonOverride: "rollback partial",
        rollbackPartial: failures,
      });
    },
  };
}

/**
 * PUP-1..9 direct entrypoint. Enumerates targets per PUP-1 three forms,
 * runs PUP-2 syncCloneOnce per (scope, marketplace) pair, then drives each
 * plugin through the shared 3-phase swap. Partitions outcomes and renders
 * a single cascade notification per orchestration arm.
 *
 * PUP-9 direct routing: phase-2-or-earlier throws from `runThreePhaseUpdate`
 * surface via a synthetic `PluginFailedMessage` carrying the typed `cause`
 * (Option B); the renderer composes the 4-space cause-chain
 * trailer. Phase-3a aggregate failures land in
 * `partition='failed'` outcomes and also fire a direct-path notification
 * BEFORE the cascade is built (the cascade body still names them via the
 * `PluginUpdatedMessage`/`PluginSkippedMessage`/`PluginFailedMessage` rows).
 */
export async function updatePluginsWith(
  opts: UpdatePluginsOptions,
  hooksRouting: UpdateHooksRouting,
  completionCache: CompletionCache,
  runPluginUpdate: UpdatePluginRunner,
  composeCascade: UpdateCascadeComposer,
): Promise<void> {
  const { ctx, pi } = opts;
  // OUT-04 / D-04: cardinality belongs to the parsed invocation, including
  // enumeration failures that return before any result rows exist.
  const cardinality: "single" | "plural" = opts.target.kind === "plugin" ? "single" : "plural";

  let targets: readonly ResolvedTarget[];
  try {
    targets = await enumerateTargets(opts);
  } catch (err) {
    await handleEnumerateFailure(opts, err, cardinality);
    return;
  }

  if (targets.length === 0) {
    notifyUpdateNoOpWithContext(ctx, pi, UPDATE_CONTEXT, [], cardinality);
    return;
  }

  const syncCloneOnce = makeSyncCloneOnce(opts.gitOps ?? DEFAULT_GIT_OPS);

  // Pair each outcome with its target so the cascade renderer can group
  // by (scope, marketplace) per CMC-21 (per-scope rendering, no collapse).
  // The bare update across multiple scopes / marketplaces becomes one
  // cascade block per (scope, marketplace) pair.
  const outcomes: UpdateCascadeOutcome[] = [];
  // OUT-04 / D-04: the structural single-vs-plural cardinality is the invocation
  // FORM -- a `<plugin>@<mp>` target is single-target (omits the tally), while
  // the `@<marketplace>` and bare forms are bulk (emit the tally).
  for (const t of targets) {
    try {
      await syncCloneOnce(t.scope, t.marketplace, t.locations);
    } catch (err) {
      // Pre-3-phase error (D-14 step failure or marketplace-missing): surface
      // via a single notify with a synthetic PluginFailedMessage carrying
      // the typed cause (Option B). Abort the whole
      // batch -- a syncClone failure means we cannot read the refreshed
      // manifest for ANY plugin in that marketplace and the rest of the
      // batch is suspect. The renderer composes the 4-space cause-chain
      // trailer.
      notifyDirectFailure({
        ctx,
        pi,
        cardinality,
        marketplace: t.marketplace,
        scope: t.scope,
        // The marketplace is implicated but no single plugin "caused" the
        // syncClone failure; use the marketplace name as the synthetic
        // failed-row identity (Option B) so the cause-chain trailer renders.
        pluginName: t.marketplace,
        err,
      });
      return;
    }

    let outcome: UpdateRunOutcome;
    try {
      outcome = await runPluginUpdate(
        buildDirectThreePhaseArgs(opts, t, cardinality, hooksRouting, completionCache),
      );
    } catch (err) {
      // PUP-9 direct path: phase-2-or-earlier throws (including PI-14
      // PathContainmentError, ST-9 stale-version, prep-phase errors) surface
      // via a single notify with a synthetic PluginFailedMessage
      // carrying the typed cause (Option B). The
      // renderer composes the 4-space cause-chain trailer.
      // Abort the batch -- the plugin's resources may be in an unknown
      // state and continuing risks compounding the failure.
      notifyDirectFailure({
        ctx,
        pi,
        cardinality,
        marketplace: t.marketplace,
        scope: t.scope,
        pluginName: t.plugin,
        err,
      });
      return;
    }

    // CR-01: phase-3a aggregate failures already fire `notifyDirectFailure`
    // inline from `runThreePhaseUpdate` (with `reasonOverride: "rollback
    // partial"` and the structural `rollbackPartial[]` children). We must
    // skip pushing the failing plugin into `outcomes` so the cascade
    // renderer does NOT re-render the same failure via
    // `outcomeToCascadePluginMessage`'s failed arm (which would produce
    // a duplicate notification for the failing plugin). But earlier
    // plugins in the same batch that succeeded already committed state
    // to disk via their own `withStateGuard` closures; suppressing the
    // cascade for them entirely would leave the on-disk state and the
    // user-visible report divergent (successful #1-#3 updates invisible
    // when #4 hits phase-3a). Instead, emit the cascade for the
    // already-accumulated successful outcomes and abort the batch.
    //
    // Phase-3a aggregates are distinguishable from phase-2-or-earlier
    // failures by the presence of `phaseFailures` on the returned outcome
    // (only the aggregate path populates it). Phase-2-or-earlier failures
    // throw and are handled by the `catch` block above, never reaching
    // this branch.
    if (isPhase3aAggregateFailure(outcome)) {
      // WR-01: the failing plugin already fired its own `notifyDirectFailure`
      // and is NOT pushed into `outcomes`. Flag the cascade as aborted-by-failure
      // so the never-silent no-op headline is suppressed: if every accumulated
      // outcome was `unchanged`, the bulk-suppressed cascade is empty and the
      // headline would otherwise emit a contradictory `nothing to update` line
      // directly after the failure notification.
      renderUpdateCascadeIfAny(ctx, pi, outcomes, cardinality, composeCascade, true);
      return;
    }

    outcomes.push({ target: t, outcome });
  }

  composeCascade(ctx, pi, outcomes, cardinality);
  surfaceUpdateDiscoveryWarnings(ctx, outcomes);
}

/**
 * D-141-03 / D-141-05: render each updated plugin's discovery warnings after
 * the cascade the rows live in -- the user reads the row, then the detail
 * that qualifies it.
 *
 * `cascade` is false on this path, so `collectUpdateWarnings` put the
 * discovery half on `notes` and nothing else; the hygiene half never reaches
 * here. That is the same property install's standalone arm relies on.
 *
 * Deliberately NOT called from the `renderUpdateCascadeIfAny` early-abort
 * path: an aborted batch has a failure to explain, and a skipped-component
 * note is noise against it.
 */
function surfaceUpdateDiscoveryWarnings(
  ctx: NotificationContext,
  outcomes: readonly { readonly outcome: PluginUpdateOutcome }[],
): void {
  for (const { outcome } of outcomes) {
    if (outcome.partition !== "updated" || outcome.notes === undefined) {
      continue;
    }

    surfaceDiscoveryWarnings(ctx, {
      plugin: outcome.name,
      verb: "updated",
      warnings: outcome.notes,
    });
  }
}

/**
 * Emit the single `notify()` call for a target-enumeration failure. Extracted
 * from `updatePlugins` to keep that function's cognitive complexity inside the
 * sonarjs ceiling (mirrors `reinstall.ts::handleEnumerationFailure`).
 *
 * Three arms:
 *   - ATTR-02 / D-47-A marketplace-not-added: `enumerateMarketplaceTarget`
 *     raised the structural `MarketplaceNotAddedSignal`, so the row names the
 *     marketplace rather than misattributing the miss to `{not found}`.
 *     Delegated to the shared `emitMarketplaceNotAddedSignal`, which reinstall
 *     drives with ITS context off the same signal -- one emitter, so the
 *     SCOPE-01 plugin row and the `{marketplace not added}` marketplace row
 *     cannot drift between the two verbs.
 *   - bare form (`target.kind === "all"`): WR-05 -- no marketplace identity to
 *     thread; surface via `notifyBareFormEnumerateFailure`.
 *   - `marketplace` / `plugin`: Option B synthetic `PluginFailedMessage` under
 *     the real marketplace name; the renderer composes the 4-space cause-chain
 *     trailer (WR-01 parens-wrapping for the bare-marketplace row name).
 */
async function handleEnumerateFailure(
  opts: UpdatePluginsOptions,
  err: unknown,
  cardinality: "single" | "plural",
): Promise<void> {
  const { ctx, pi, cwd, target, scope: explicitScope } = opts;

  if (err instanceof MarketplaceNotAddedSignal) {
    await emitMarketplaceNotAddedSignal({
      ctx,
      pi,
      cwd,
      context: UPDATE_CONTEXT,
      cardinality,
      err,
    });
    return;
  }

  // WR-05: `enumerateTargets` for the bare form calls `loadState` for both
  // scopes and propagates any I/O / schema-validation throw. The bare form has
  // no marketplace identity to thread into the row.
  if (target.kind === "all") {
    notifyBareFormEnumerateFailure({
      ctx,
      pi,
      scope: explicitScope,
      err: err as Error,
      cardinality,
    });
    return;
  }

  // Option B: synthesize a PluginFailedMessage carrying the typed `cause` so
  // the renderer's 4-space cause-chain trailer preserves the error-message
  // text. Reaching here implies `target.kind === "marketplace" | "plugin"` so
  // `target.marketplace` is structurally present.
  //
  // WR-01: when target.kind === "marketplace" (no plugin name), wrap the
  // marketplace identity in parens when used as a synthetic plugin-row name
  // (mirroring the SYNTHETIC_UPDATE_PLACEHOLDER_NAME = "(update)" precedent) so
  // the row reads `⊘ (<marketplace>) (failed) {<reason>}` and is visually
  // distinguishable from the surrounding mp header.
  notifyDirectFailure({
    ctx,
    pi,
    cardinality,
    marketplace: target.marketplace,
    // No state.json was read yet, so explicit scope is the best fact available;
    // default to "project" when omitted.
    scope: explicitScope ?? "project",
    pluginName: target.kind === "plugin" ? target.plugin : `(${target.marketplace})`,
    err,
  });
}

/**
 * CR-01 predicate: discriminates phase-3a aggregate failures (which carry
 * a populated `phaseFailures` array and have already fired their own
 * direct-path notify) from phase-2-or-earlier failures (which throw and
 * are handled by the `catch` block in the enclosing batch loop).
 */
function isPhase3aAggregateFailure(
  outcome: UpdateRunOutcome,
): outcome is UpdatePhase3FailedOutcome {
  return outcome.partition === "failed" && outcome.phaseFailures !== undefined;
}

/**
 * CR-01 helper: emit the cascade notification ONLY when at least one
 * outcome accumulated. Empty accumulators skip the call so we do not
 * emit an empty-marketplaces sentinel after a phase-3a abort.
 */
function renderUpdateCascadeIfAny(
  ctx: NotificationContext,
  pi: ToolInventory,
  outcomes: readonly UpdateCascadeOutcome[],
  cardinality: "single" | "plural",
  composeCascade: UpdateCascadeComposer,
  // WR-01: the phase-3a abort path sets this so the never-silent no-op headline
  // is suppressed when the accumulated outcomes contain no realized transition.
  abortedByFailure = false,
): void {
  if (outcomes.length > 0) {
    composeCascade(ctx, pi, outcomes, cardinality, abortedByFailure);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// updateSinglePlugin -- PluginUpdateFn impl (cascade-safe; NEVER throws)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * D-09 corollary: the `PluginUpdateFn` impl (D-05). The marketplace
 * autoupdate cascade wires this in.
 *
 * Cascade-safe contract: this function NEVER throws. All errors (including
 * PathContainmentError, ST-9 stale-version, prep failures, phase-3a aggregate
 * failures) are captured into `partition='failed'` outcomes. PUP-9.
 */
export async function updateSinglePluginWith(
  hooksRouting: UpdateHooksRouting,
  completionCache: CompletionCache,
  runPluginUpdate: UpdatePluginRunner,
  plugin: string,
  marketplace: string,
  scope: Scope,
): Promise<PluginUpdateOutcome> {
  // The cascade signature does not carry `cwd`; we default to process.cwd
  // because the cascade is invoked from a marketplace orchestrator that
  // already operates in the user's session cwd. Future wiring may add a
  // dependency-injection seam if needed.
  const cwd = process.cwd();
  const locations = locationsFor(scope, cwd);

  try {
    return await runPluginUpdate({
      plugin,
      marketplace,
      scope,
      cwd,
      locations,
      hooksRouting,
      completionCache,
      cascade: true,
      // SEV-03 / D-69-01: the autoupdate cascade TAKES the partial path
      // automatically. A partially-upgradable candidate (re-resolves `partially-available`)
      // degrades in place -- supported components materialize, unsupported kinds
      // skip -- and renders `(partially-installed) {dropped kinds}` instead of
      // declining with `(skipped) {no longer installable}`. `requirePartialInstallable`
      // still BLOCKS an `unavailable`/structural candidate (FORCE-05), so the
      // automatic partial path can never materialize a structurally-broken plugin.
      // The manual `update` path (`updatePlugins` -> `runThreePhaseUpdate`
      // directly) is unaffected; it sets `partial` from the user's `--partial` flag.
      partial: true,
      cleanupClones: garbageCollectPluginClones,
    });
  } catch (err) {
    // Cascade-safe: capture throws into a partition='failed' outcome so the
    // marketplace cascade can continue aggregating outcomes across plugins
    // without aborting the whole batch. `notes` is consumed outside the
    // notify path so the MSG-CC-1 trailer is composed inline here.
    //
    // Pre-narrow to a closed-set `Reason` so the cascade consumer reads the
    // typed producer value directly instead of reparsing its display note.
    const cleanupFailures = cleanupFailuresFromError(err);
    const base: PluginUpdateOutcome = {
      partition: "failed",
      name: plugin,
      notes: [composeErrorWithCauseChain(err)],
      ...(cleanupFailures.length > 0 && {
        cause: err as Error,
        cleanupFailures,
      }),
      // CMC-13: required booleans on every
      // PluginUpdateOutcome partition. `(failed)` rows do NOT render
      // the soft-dep marker (MSG-SD-3), so the value is `false`.
      declaresAgents: false,
      declaresMcp: false,
    };
    return { ...base, reasons: reasonsFromTypedError(err) };
  }
}

/**
 * Map an exported-workflow error to a closed-set `Reason[]` for cascade-failure
 * outcomes. Typed concurrency facts and errno codes win; the permissive
 * fallback is `not in manifest`.
 */
function reasonsFromTypedError(err: unknown): readonly ContentReason[] {
  const primary = err instanceof CleanupContextError ? err.primary : err;
  if (primary instanceof PluginUpdateConcurrencyError) {
    return [
      primary.kind === "plugin-updated" ? "concurrently updated" : "concurrently uninstalled",
    ] as const;
  }

  // errno-bearing FS errors map to the matching
  // closed Reason instead of falling through to the consumer's
  // legacy notes-substring parse (which would land on the permissive
  // `not in manifest` default for both narrowSkipReasons and
  // narrowFailReasons).
  if (primary instanceof Error) {
    const code = (primary as NodeJS.ErrnoException).code;
    if (code === "EACCES" || code === "EPERM") {
      return ["permission denied"] as const;
    }

    if (code === "ENOENT" || code === "ENOTDIR") {
      return ["source missing"] as const;
    }
  }

  return ["not in manifest"] as const;
}

// ─────────────────────────────────────────────────────────────────────────────
// direct-path failure helper. The direct-path failure sites
// (enumerate-targets / syncCloneOnce / runThreePhaseUpdate / phase-3
// aggregate) consolidate through this helper. Per Option B, each
// site emits a synthetic PluginFailedMessage carrying the typed `cause`
// so the renderer composes the 4-space cause-chain trailer.
// ─────────────────────────────────────────────────────────────────────────────

interface NotifyDirectFailureArgs {
  readonly ctx: NotificationContext;
  readonly pi: ToolInventory;
  readonly cardinality: "single" | "plural";
  readonly marketplace: string;
  readonly scope: Scope;
  readonly pluginName: string;
  readonly err: unknown;
  /**
   * Optional override that pins the closed-set Reason on the synthetic
   * PluginFailedMessage. Used by the phase-3 aggregate path where the
   * `"rollback partial"` reason is the catalog form (510-522). Omitted
   * for direct-path enumerate / syncClone / phase-2 failures, which
   * route through `narrowDirectFailReason` for a best-fit Reason from
   * the typed error.
   */
  readonly reasonOverride?: ContentReason;
  /**
   * Optional per-phase rollback children. Threaded only by the phase-3
   * aggregate path; the update-local type preserves each internal Error
   * identity for the renderer's cause-chain walker.
   */
  readonly rollbackPartial?: readonly UpdatePhase3Failure[];
}

function notifyDirectFailure(args: NotifyDirectFailureArgs): void {
  const { ctx, pi, marketplace, scope, pluginName, err } = args;
  const cause = err instanceof Error ? err : new Error(String(err));
  const reasons: readonly ContentReason[] = [args.reasonOverride ?? narrowDirectFailReason(cause)];
  // WR-05: row-level `scope` is OMITTED -- it always matched the
  // marketplace block's `scope` at every callsite below, and
  // `renderScopeBracket` (shared/notification-grammar.ts) suppresses the
  // bracket in that case. Aligning on the omit convention (matching uninstall.ts,
  // reinstall.ts, and install-outcome.ts's IN-04 commentary)
  // removes a structural redundancy that diverged from the canonical
  // emission recipe.
  const failedRow: PluginFailedMessage = {
    status: "failed",
    name: pluginName,
    reasons,
    cause,
    // D-03/D-06: a direct update failure -> error, no reload.
    severity: "error",
    needsReload: false,
    ...(args.rollbackPartial !== undefined &&
      args.rollbackPartial.length > 0 && {
        rollbackPartial: args.rollbackPartial.map((p) => ({
          phase: p.phase,
          ...rollbackPartialCauseSlot(p),
        })),
      }),
  };
  notifyWithContext(
    ctx,
    pi,
    UPDATE_CONTEXT,
    [
      {
        name: marketplace,
        scope,
        plugins: [failedRow],
      },
    ],
    undefined,
    args.cardinality,
  );
}

/**
 * Preserve the update-local phase failure Error in the structured child.
 */
function rollbackPartialCauseSlot(p: UpdatePhase3Failure): { readonly cause: Error } {
  return { cause: p.cause };
}

/**
 * Narrow a direct-path failure's typed error to a closed-set `Reason` for
 * the synthetic `PluginFailedMessage`. Order: typed identities first,
 * errno / stable transport fields second, honest generic fallback last.
 * The fallback `"unreadable manifest"` mirrors the marketplace/update.ts
 * narrowFailReason precedent for unknown error shapes.
 */
function narrowDirectFailReason(err: Error): ContentReason {
  // Phase-3 aggregate failures are surfaced via reasonOverride; here we
  // handle the enumerate / syncClone / phase-2 paths only.
  const primary = err instanceof CleanupContextError ? err.primary : err;

  if (primary instanceof MarketplaceNotFoundError) {
    return "not found";
  }

  if (primary instanceof PluginUpdatePhase3Error) {
    return "rollback partial";
  }

  if (primary instanceof PluginUpdateConcurrencyError) {
    return primary.kind === "plugin-updated" ? "concurrently updated" : "concurrently uninstalled";
  }

  if (primary instanceof InvalidMarketplaceManifestError) {
    return "invalid manifest";
  }

  const transportReason = classifyGitTransportFailure(primary);
  if (transportReason !== undefined) {
    return transportReason;
  }

  const code = (primary as NodeJS.ErrnoException).code;
  if (code === "EACCES" || code === "EPERM") {
    return "permission denied";
  }

  if (code === "ENOENT" || code === "ENOTDIR") {
    return "source missing";
  }

  return "unreadable manifest";
}

/**
 * WR-05: bare-form (`target.kind === "all"`) enumerate-failure emission.
 * Distinct from the marketplace/plugin failure path because the bare
 * form has no marketplace identity to thread into the row; using the
 * marketplace identity slot for a synthetic `"(targets)"` literal
 * produced operator-confusing output (`⊘ (targets) (failed)...` under
 * a marketplace block named `(targets)`).
 *
 * Mirrors the `orchestrators/plugin/reinstall.ts::reinstallPlugins`
 * bare-form enumeration-failure precedent (line 350: synthetic
 * `"(reinstall)"` marketplace name). Use `"(update)"` here so the
 * parens-wrapped form reads to the operator as "synthetic placeholder
 * for the bare-form update orchestration". The scope defaults to the
 * caller's explicit scope when present, else `"user"` -- the choice is
 * cosmetic (no real marketplace exists with this name; the cause-chain
 * trailer carries the diagnostic).
 */
function notifyBareFormEnumerateFailure(args: {
  readonly ctx: NotificationContext;
  readonly pi: ToolInventory;
  readonly scope: Scope | undefined;
  readonly err: Error;
  readonly cardinality: "single" | "plural";
}): void {
  const { ctx, pi, scope, err } = args;
  const reasons: readonly ContentReason[] = [narrowDirectFailReason(err)];
  // WR-05: row-level `scope` is OMITTED -- the marketplace block carries
  // the same scope, and `renderScopeBracket` suppresses the per-row
  // bracket in that case. Matches the omit convention used by
  // uninstall.ts / reinstall.ts / install-outcome.ts (IN-04).
  const failedRow: PluginFailedMessage = {
    status: "failed",
    name: SYNTHETIC_UPDATE_PLACEHOLDER_NAME,
    reasons,
    cause: err,
    // D-03/D-06: bare-form enumerate failure -> error, no reload.
    severity: "error",
    needsReload: false,
  };
  notifyWithContext(
    ctx,
    pi,
    UPDATE_CONTEXT,
    [
      {
        name: SYNTHETIC_UPDATE_PLACEHOLDER_NAME,
        scope: scope ?? "user",
        plugins: [failedRow],
      },
    ],
    undefined,
    args.cardinality,
  );
}

/**
 * WR-05: synthetic placeholder for the bare-form enumerate-failure path.
 * Held as a module-level constant so a future change has a single edit
 * point. Mirrors the `"(reinstall)"` precedent in
 * `orchestrators/plugin/reinstall.ts`.
 */
const SYNTHETIC_UPDATE_PLACEHOLDER_NAME = "(update)";

// The renderer (shared/notification-grammar.ts) owns version-arrow composition
// via the PluginUpdatedMessage's required from/to fields.

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

interface ResolvedTarget {
  readonly plugin: string;
  readonly marketplace: string;
  readonly scope: Scope;
  readonly locations: ScopedLocations;
}

async function enumerateTargets(opts: UpdatePluginsOptions): Promise<readonly ResolvedTarget[]> {
  const { cwd, target } = opts;
  const explicitScope = opts.scope;

  if (target.kind === "plugin" || target.kind === "marketplace") {
    return enumerateMarketplaceTarget(cwd, explicitScope, target);
  }

  // bare form: every installed plugin across selected scope(s).
  // Iteration order is project-first per MSG-GR-3 / compareByNameThenScope
  // so same-name cross-scope stable-sort ties render project-before-user.
  const scopes: readonly Scope[] =
    explicitScope === undefined ? ["project", "user"] : [explicitScope];
  const out: ResolvedTarget[] = [];
  for (const sc of scopes) {
    const locations = locationsFor(sc, cwd);
    const state = await loadState(locations.extensionRoot);
    for (const [mpName, mp] of Object.entries(state.marketplaces)) {
      for (const p of Object.keys(mp.plugins)) {
        out.push({ plugin: p, marketplace: mpName, scope: sc, locations });
      }
    }
  }

  return out;
}

async function enumerateMarketplaceTarget(
  cwd: string,
  explicitScope: Scope | undefined,
  target: Extract<UpdatePluginsTarget, { kind: "plugin" | "marketplace" }>,
): Promise<readonly ResolvedTarget[]> {
  const mpName = target.marketplace;

  // ATTR-02 / D-47-A: probe marketplace existence STRUCTURALLY for BOTH forms
  // (`<plugin>@<mp>` and `@<mp>`). For the plugin form, first try the
  // installed-plugin target; a miss falls back to the marketplace-existence
  // resolver so a present-marketplace/absent-plugin row still reaches the
  // downstream `(skipped) {not installed}` preflight. A
  // marketplace-absent / other-scope outcome raises `MarketplaceNotAddedSignal`
  // -- caught at the `updatePlugins` entrypoint and re-attributed to the
  // standalone `{marketplace not added}` variant, so the miss is never
  // misattributed to `{not found}` (M10/M11).
  const resolved = await resolveUpdateMarketplaceScope(cwd, mpName, target, explicitScope);
  const state = await loadState(resolved.locations.extensionRoot);
  const mp = state.marketplaces[mpName];
  if (mp === undefined) {
    // `resolveUpdateMarketplaceScope` can hand back the REQUESTED scope without
    // a container there, so this arm carries the ordinary explicit-scope miss
    // as well as the concurrent-removal edge. Either way it signals not-added
    // rather than letting a raw throw escape the orchestrator.
    //
    // The everyday route in is the PLUGIN form with an explicit `--scope`:
    // `resolveInstalledPluginTarget` returns that scope UNCONDITIONALLY when
    // one is named, without proving the container is there, so the miss lands
    // here rather than on the marketplace-absent arm of the resolver. (Every
    // `resolved` arm of `resolveInstalledMarketplaceTarget` HAS proved a
    // container, which is why that route in really is a concurrent removal.)
    // This is the only place the explicit-scope SCOPE-01 payload can be built.
    //
    // SCOPE-01: when the container sits one scope over, nothing is installed at
    // the scope the operator named, so the PLUGIN is the row's subject.
    const notInstalled =
      target.kind === "plugin" &&
      explicitScope !== undefined &&
      (await marketplaceInOtherScope({ cwd, marketplace: mpName, scope: explicitScope }))
        ? { scope: explicitScope, plugin: target.plugin }
        : undefined;
    throw new MarketplaceNotAddedSignal(mpName, explicitScope, notInstalled);
  }

  if (target.kind === "plugin") {
    return [
      {
        plugin: target.plugin,
        marketplace: mpName,
        scope: resolved.scope,
        locations: resolved.locations,
      },
    ];
  }

  return Object.keys(mp.plugins).map((p) => ({
    plugin: p,
    marketplace: mpName,
    scope: resolved.scope,
    locations: resolved.locations,
  }));
}

/**
 * ATTR-02 / SCOPE-01: resolve the scope of an existing marketplace container for
 * the `<plugin>@<mp>` and `@<mp>` update forms, raising
 * `MarketplaceNotAddedSignal` when the marketplace is not added.
 *
 *  - PLUGIN form: prefer the installed-plugin target (CMP-5). When the plugin
 *    row is absent, fall back to the marketplace-existence resolver so a
 *    present-marketplace/absent-plugin target resolves against the container's
 *    scope (the downstream `preflightUpdate` emits `(skipped) {not installed}`
 *    ); a marketplace-absent / other-scope outcome signals
 *    `{marketplace not added}` carrying the REQUESTED scope (SCOPE-01).
 *  - MARKETPLACE form: consume the discriminated `resolveInstalledMarketplaceTarget`
 *    result directly; `marketplace-absent`/`other-scope` signal `{marketplace not added}`
 *    carrying the requested scope (bare form that missed in both carries no
 *    bracket).
 *
 * All reads are `loadState` only (NFR-5: no network).
 */
async function resolveUpdateMarketplaceScope(
  cwd: string,
  mpName: string,
  target: Extract<UpdatePluginsTarget, { kind: "plugin" | "marketplace" }>,
  explicitScope: Scope | undefined,
): Promise<{ scope: Scope; locations: ScopedLocations }> {
  if (target.kind === "plugin") {
    const pluginTarget = await resolveInstalledPluginTarget({
      cwd,
      marketplace: mpName,
      plugin: target.plugin,
      ...(explicitScope !== undefined && { explicitScope }),
    });
    if (pluginTarget !== undefined) {
      return { scope: pluginTarget.scope, locations: pluginTarget.locations };
    }
  }

  const resolution = await resolveInstalledMarketplaceTarget({
    cwd,
    marketplace: mpName,
    ...(explicitScope !== undefined && { explicitScope }),
  });
  if (resolution.kind === "resolved") {
    return { scope: resolution.scope, locations: resolution.locations };
  }

  // marketplace-absent OR other-scope (present only in the other scope).
  // SCOPE-01: carry the REQUESTED scope (explicit form) so the `[scope]`
  // bracket reads "not added in the scope you asked for"; the bare form that
  // missed everywhere carries no bracket (resolution.requestedScope undefined).
  //
  // No SCOPE-01 `notInstalled` payload is derivable HERE, and none is owed. The
  // plugin form reaches this line only with NO explicit scope -- an explicit
  // scope makes `resolveInstalledPluginTarget` return it unconditionally above
  // -- so `resolveInstalledMarketplaceTarget` took its unqualified branch,
  // which consulted BOTH scopes and therefore reports `marketplace-absent` with
  // no `requestedScope`. There is no "one scope over" to name. The explicit-
  // scope plugin form is carried by the `mp === undefined` arm in
  // `enumerateMarketplaceTarget`, which is where that payload is built.
  throw new MarketplaceNotAddedSignal(mpName, resolution.requestedScope);
}

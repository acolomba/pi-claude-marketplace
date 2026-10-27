// orchestrators/plugin/update-flow.ts
//
// PUP-1..9 + AS-3 (3-phase) + AS-7 (orphan agent index entries) + WR-04 +
// NFR-2 + NFR-3.
//
// Three entrypoints, bound by `createPluginUpdateOperations` (D-09 corollary):
//  1. beginPluginUpdateRun(): PluginUpdateFn -- the autoupdate cascade;
//     cascade-safe, throws only an invalid GitHub base override (GHB-03)
//  2. convergePlugin: PluginConvergeFn -- `apply`'s catalog move (D-26),
//     under the same cascade-safe contract
//  3. updatePlugins(opts) -- direct entrypoint; PUP-1 three forms
//
// Both share the per-plugin 3-phase swap implementation (D-03 HAND-ROLLED,
// NOT runPhases -- the heterogeneous-undo flow D-02 precedent):
//
//  (prepare): sequential bridge prepare* into tmp (skills -> commands
//  -> agents -> mcp -> workflows). Any throw triggers abort of
//  already-prepared handles + structured cleanup-failure descriptors.
//
//  (state-guard swap with old-resource snapshot): inside
//  `withStateGuard` re-read the plugin record, ST-9 stale-version check,
//  overwrite resources + version + updatedAt in-memory. Throw on ST-9
//  mismatch; guard does NOT save (ST-7).
//
//  Phase 3a (physical replace, aggregate failures, continue across bridges):
//  call each bridge's commitPrepared* in skills -> commands -> agents -> mcp
//  -> workflows order. D-03 specifies CONTINUE across bridge failures (not
//  fail-fast) so the partial-replace state is fully observed. Failures
//  aggregate into Phase3Failure[].
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
//  a single notify(ctx, run, NotificationMessage) per
//  orchestration arm (cause threaded structurally on a
//  PluginFailedMessage; renderer composes the 4-space
//  cause-chain trailer).
//
// Success and failure notifications are a single
//  notify(opts.ctx, opts.run, { marketplaces: [{..., plugins: [...] }] })
// call per orchestration arm. notify() owns severity, the reload-hint
// trailer, and the cause-chain. The post-success completion-cache-refresh
// warning inside dropPluginCompletionCache is NOT surfaced: the underlying
// dropMarketplaceCache call still runs (correctness preserved), only the
// standalone-mode user-visible warning surface is absent.
//
// D-v1.0-01-11 import boundaries: orchestrators/plugin/ may import named exports
// from orchestrators/marketplace/shared.ts (GitOps, DEFAULT_GIT_OPS,
// resolveScopeFromState). MUST NOT import from
// orchestrators/marketplace/{add,remove,list,update,autoupdate}.ts.

import { locationsFor } from "../../persistence/locations.ts";
import { loadState } from "../../persistence/state-io.ts";
import { BridgeStagingError } from "../../shared/errors-bridges.ts";
import {
  CleanupContextError,
  cleanupFailuresFromError,
  composeErrorWithCauseChain,
  DependencyDeclarationsUnreadableError,
  InvalidMarketplaceManifestError,
  MarketplaceNotFoundError,
  PluginInBaseLayerOnlyError,
  PluginInLocalLayerOnlyError,
  PluginUpdateConcurrencyError,
  PluginUpdatePhase3Error,
  rethrowInvalidGitHubBaseUrl,
  StateLockHeldError,
} from "../../shared/errors.ts";
import { classifyGitFailure } from "../../shared/git-failure-classifiers.ts";
import { notifyMcpConfigNotices } from "../../shared/notification-dispatch.ts";
import { type ContentReason } from "../../shared/notification-types.ts";
import { type PluginFailedMessage } from "../../shared/notification-types.ts";
import { notifyUpdateNoOpWithContext, notifyWithContext } from "../../shared/notify-context.ts";
import { ownValue } from "../../shared/own-key.ts";
import { DEFAULT_CREDENTIAL_OPS, buildGitHubAuth } from "../auth-host.ts";
import { DEFAULT_GIT_OPS, refreshGitHubClone, refreshUrlClone } from "../marketplace/shared.ts";
import { marketplaceInOtherScope } from "../marketplace/shared.ts";

import { collectPluginClonesLocked } from "./clone-gc.ts";
import { materializeLatestVersion, recordCandidate } from "./materialize-latest.ts";
import {
  emitMarketplaceNotAddedSignal,
  keepLocalLayerTargets,
  MarketplaceNotAddedSignal,
  namedPluginLayerRefusal,
  resolveInstalledMarketplaceTarget,
  resolveInstalledPluginTarget,
  surfaceDiscoveryWarnings,
} from "./shared.ts";
import { composeUpdateCascade } from "./update-cascade.ts";
import { UPDATE_MATERIALIZATION } from "./update-preflight.ts";
import { revisionVersionSlot } from "./update-row.ts";
import { UPDATE_CONTEXT } from "./update.messaging.ts";

import type { UpdateCascadeOutcome, UpdateHooksRouting } from "./update-cascade.ts";
import type {
  MaterializationPolicy,
  UpdatePluginsOptions,
  UpdatePluginsTarget,
} from "./update-preflight.ts";
import type {
  CascadeThreePhaseArgs,
  DirectThreePhaseArgs,
  ThreePhaseArgs,
  ThreePhaseArgsBase,
  UpdatePhase3Failure,
  UpdateDependencyResolver,
  UpdatePhase3FailedOutcome,
  UpdateRunOutcome,
} from "./update-swap.ts";
import type { ClaudeEnv } from "../../domain/claude-mcp-variables.ts";
import type { ReleaseTagCandidate } from "../../domain/release-tag.ts";
import type { ParsedSource } from "../../domain/source.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { RemoteTag } from "../../platform/git.ts";
import type { NotificationContext } from "../../platform/pi-api.ts";
import type { CompletionCache } from "../../shared/completion-cache.ts";
import type { NotificationRun } from "../../shared/notification-run.ts";
import type { Scope } from "../../shared/types.ts";
import type { LockedStateTransactionDeps } from "../../transaction/with-state-guard.ts";
import type { AuthAttemptResult } from "../auth-host.ts";
import type {
  PluginConvergeFn,
  PluginConvergeTarget,
  PluginUpdateFn,
  PluginUpdateOutcome,
} from "../types.ts";
import type { CandidateReport } from "./materialize-latest.ts";

/** Runs one prepared update target for the update flow. */
type UpdatePluginRunner = (args: ThreePhaseArgs) => Promise<UpdateRunOutcome>;

/** Folds flow outcomes through the extracted cascade owner. */
type UpdateCascadeComposer = (
  ctx: NotificationContext,
  run: NotificationRun,
  outcomes: readonly UpdateCascadeOutcome[],
  cardinality: "single" | "plural",
  abortedByFailure?: boolean,
) => void;
/**
 * PUP-2 syncCloneOnce memoization -- one refresh per (scope, marketplace)
 * pair. Path-source marketplaces are noops (NFR-5: no network for path
 * sources); GitHub- and url-source marketplaces refresh via gitOps.fetch +
 * forceUpdateRef + checkout (the D-14 sequence), as `marketplace update`
 * does. Throws on git-side failures.
 *
 * AUTH-02: the fetch carries the same host-keyed auth bundle as `marketplace
 * update` (github.com or the GitHub override host for GitHub sources, the
 * clone URL's host for url sources), plus the run's `authMemo`, so a private
 * marketplace reaches the credential helper and, on a miss, the Device Flow.
 * The GitHub bundle is built inside the github arm, so a path-only run never
 * reads PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL (GHB-02). `updatePluginsWith`
 * allocates the `authMemo` when the caller supplies none and passes it here
 * (D-79-02), so that flow runs at most once per host across the marketplace
 * syncs and the plugin clones.
 */
function makeSyncCloneOnce(
  opts: UpdatePluginsOptions,
): (scope: Scope, mpName: string, locations: ScopedLocations) => Promise<void> {
  const gitOps = opts.gitOps ?? DEFAULT_GIT_OPS;
  const credentialOps = opts.credentialOps ?? DEFAULT_CREDENTIAL_OPS;
  const synced = new Set<string>();
  return async (scope, mpName, locations) => {
    const key = `${scope}/${mpName}`;
    if (synced.has(key)) {
      return;
    }

    synced.add(key);

    const state = await loadState(locations.extensionRoot);
    const mp = ownValue(state.marketplaces, mpName);
    if (mp === undefined) {
      throw new MarketplaceNotFoundError(mpName, [scope]);
    }

    const source = mp.source as ParsedSource;
    if (source.kind === "github") {
      const cloneDir = await locations.sourceCloneDir(mpName);
      const auth = buildGitHubAuth({
        credentialOps,
        ctx: opts.ctx,
        run: opts.run,
        ...(opts.deviceFlowHttp !== undefined && { deviceFlowHttp: opts.deviceFlowHttp }),
        ...(opts.authMemo !== undefined && { authMemo: opts.authMemo }),
      });
      await refreshGitHubClone(cloneDir, source.ref, gitOps, undefined, auth);
    } else if (source.kind === "url") {
      await refreshUrlClone({
        cloneDir: await locations.sourceCloneDir(mpName),
        source,
        gitOps,
        ctx: opts.ctx,
        run: opts.run,
        credentialOps,
        ...(opts.deviceFlowHttp !== undefined && { deviceFlowHttp: opts.deviceFlowHttp }),
        ...(opts.authMemo !== undefined && { authMemo: opts.authMemo }),
      });
    }
    // path-source: NFR-5 noop. The manifest is re-read per-plugin.
  };
}

/** The collaborators `createPluginUpdateOperations` binds into every target's arguments. */
type UpdateBindings = Pick<ThreePhaseArgsBase, "hooksRouting" | "completionCache" | "env">;

/** The command's notification context, which a dependency install reports through. */
export type UpdateNotification = Parameters<UpdateDependencyResolver>[2];

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
  bindings: UpdateBindings,
  constraintTagMemo: Map<string, readonly RemoteTag[]>,
  constraintMarketplaceTagMemo: Map<string, readonly ReleaseTagCandidate[]>,
  report: CandidateReport,
): DirectThreePhaseArgs {
  return {
    plugin: target.plugin,
    marketplace: target.marketplace,
    scope: target.scope,
    cwd: opts.cwd,
    locations: target.locations,
    ...bindings,
    cascade: false,
    ctx: opts.ctx,
    // `run` threads the phase-3a aggregate direct-path notify inside
    // runThreePhaseUpdate. Cascade mode leaves it undefined -- the cascade
    // orchestrator owns its own notify call.
    run: opts.run,
    cardinality,
    // AG-7 opt-in: `--map-model`. The cascade entrypoint never sets it, so
    // cascade re-installs always omit `model:`.
    mapModel: opts.mapModel ?? false,
    // FORCE-02: `--partial` feeds the per-plugin candidate gate (D-65-04).
    // The cascade entrypoint never sets it, so cascade re-installs keep the
    // `requireInstallable` block.
    partial: opts.partial ?? false,
    // LAYER-04: `--local` selects the layer a named update acts on.
    ...(opts.local === true && { local: true }),
    // PURL-06: the test-only clone-cache seam for the git-source candidate
    // probe. Undefined in production, which selects the real imports.
    ...(opts.cloneCacheSeam !== undefined && { cloneCacheSeam: opts.cloneCacheSeam }),
    // PROV-03 / D-79-02: auth seams so a git-source update on a provider host
    // authenticates host-keyed at pin-resolution and re-clone.
    ...(opts.credentialOps !== undefined && { credentialOps: opts.credentialOps }),
    ...(opts.deviceFlowHttp !== undefined && { deviceFlowHttp: opts.deviceFlowHttp }),
    ...(opts.authMemo !== undefined && { authMemo: opts.authMemo }),
    // D-10-18: one memo pair for the WHOLE bulk run, allocated once by
    // `updatePluginsWith` and threaded into every target here -- never a
    // per-target allocation, or a repository common to several targets
    // would be listed once per target instead of once per run.
    constraintTagMemo,
    constraintMarketplaceTagMemo,
    cleanupClones: collectPluginClonesLocked,
    ...recordCandidate(report),
    notifyPhaseFailure: (error, failures) => {
      notifyDirectFailure({
        ctx: opts.ctx,
        run: opts.run,
        cardinality,
        marketplace: target.marketplace,
        scope: target.scope,
        pluginName: target.plugin,
        err: error,
        reasonOverride: "rollback partial",
        rollbackPartial: failures,
        report,
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
async function updatePluginsWith(
  opts: UpdatePluginsOptions,
  bindings: UpdateBindings,
  runPluginUpdate: UpdatePluginRunner,
  composeCascade: UpdateCascadeComposer,
): Promise<void> {
  const { ctx, run } = opts;
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
    notifyUpdateNoOpWithContext(ctx, run, UPDATE_CONTEXT, [], cardinality);
    return;
  }

  // D-79-02: ONE authMemo for the whole run, shared by the marketplace syncs
  // and every target's clone and probe auth, so a Device Flow host prompts at
  // most once. A caller-supplied memo wins.
  const runOpts: UpdatePluginsOptions = {
    ...opts,
    authMemo: opts.authMemo ?? new Map<string, AuthAttemptResult>(),
  };
  const syncCloneOnce = makeSyncCloneOnce(runOpts);
  // D-10-18: one memo pair for this WHOLE bulk run, never exposed on
  // `UpdatePluginsOptions` -- it is a run-internal bound, not a caller knob,
  // and a caller-supplied memo would outlive the run and serve a stale
  // listing. A fresh pair here is what keeps two separate `updatePlugins`
  // calls from sharing one.
  const constraintTagMemo = new Map<string, readonly RemoteTag[]>();
  const constraintMarketplaceTagMemo = new Map<string, readonly ReleaseTagCandidate[]>();

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
      // eslint-disable-next-line no-await-in-loop -- syncs each marketplace once; a sync failure aborts the batch
      await syncCloneOnce(t.scope, t.marketplace, t.locations);
    } catch (err) {
      // GHB-03: an invalid GitHub base override fails the whole command.
      rethrowInvalidGitHubBaseUrl(err);
      // Pre-3-phase error (D-14 step failure or marketplace-missing): surface
      // via a single notify with a synthetic PluginFailedMessage carrying
      // the typed cause (Option B). Abort the whole
      // batch -- a syncClone failure means we cannot read the refreshed
      // manifest for ANY plugin in that marketplace and the rest of the
      // batch is suspect. `abortUpdateBatch` still reports the targets that
      // already committed (CR-01). The renderer composes the 4-space
      // cause-chain trailer.
      notifyDirectFailure({
        ctx,
        run,
        cardinality,
        marketplace: t.marketplace,
        scope: t.scope,
        // The marketplace is implicated but no single plugin "caused" the
        // syncClone failure; use the marketplace name as the synthetic
        // failed-row identity (Option B) so the cause-chain trailer renders.
        pluginName: t.marketplace,
        err,
      });
      abortUpdateBatch(ctx, run, outcomes, cardinality, composeCascade);
      return;
    }

    let outcome: UpdateRunOutcome;
    const report: CandidateReport = {};
    try {
      // eslint-disable-next-line no-await-in-loop -- each update locks the scope (retries: 0)
      outcome = await runPluginUpdate(
        buildDirectThreePhaseArgs(
          runOpts,
          t,
          cardinality,
          bindings,
          constraintTagMemo,
          constraintMarketplaceTagMemo,
          report,
        ),
      );
    } catch (err) {
      // GHB-03: an invalid GitHub base override fails the whole command.
      rethrowInvalidGitHubBaseUrl(err);
      // PUP-9 direct path: phase-2-or-earlier throws (including PI-14
      // PathContainmentError, ST-9 stale-version, prep-phase errors) surface
      // via a single notify with a synthetic PluginFailedMessage
      // carrying the typed cause (Option B). The
      // renderer composes the 4-space cause-chain trailer.
      // Abort the batch -- the plugin's resources may be in an unknown
      // state and continuing risks compounding the failure.
      notifyDirectFailure({
        ctx,
        run,
        cardinality,
        marketplace: t.marketplace,
        scope: t.scope,
        pluginName: t.plugin,
        err,
        report,
      });
      abortUpdateBatch(ctx, run, outcomes, cardinality, composeCascade);
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
      abortUpdateBatch(ctx, run, outcomes, cardinality, composeCascade, outcome);
      return;
    }

    outcomes.push({ target: t, outcome });
  }

  composeCascade(ctx, run, outcomes, cardinality);
  surfaceUpdateDiscoveryWarnings(ctx, run, outcomes);
  surfaceUpdateMcpConfigNotices(ctx, run, outcomes);
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
 * Deliberately NOT called from `abortUpdateBatch`: an aborted batch has a
 * failure to explain, and a skipped-component note is noise against it.
 */
function surfaceUpdateDiscoveryWarnings(
  ctx: NotificationContext,
  run: NotificationRun,
  outcomes: readonly { readonly outcome: PluginUpdateOutcome }[],
): void {
  for (const { outcome } of outcomes) {
    if (outcome.partition !== "updated" || outcome.notes === undefined) {
      continue;
    }

    surfaceDiscoveryWarnings(ctx, run, {
      plugin: outcome.name,
      verb: "updated",
      warnings: outcome.notes,
    });
  }
}

/**
 * AFILE-04: show the MCP config file notices of every updated plugin, in
 * outcome order, after the rows they qualify. On a phase-3a abort the failing
 * plugin's own notices follow, because its MCP commit may have rewritten the
 * file before a later bridge or the finalize failed.
 *
 * Unlike `surfaceUpdateDiscoveryWarnings`, this also runs on every abort path,
 * because the rewrite has already happened to the user's file.
 */
function surfaceUpdateMcpConfigNotices(
  ctx: NotificationContext,
  run: NotificationRun,
  outcomes: readonly { readonly outcome: PluginUpdateOutcome }[],
  failed?: UpdatePhase3FailedOutcome,
): void {
  const notices = outcomes.flatMap(({ outcome }) =>
    outcome.partition === "updated" ? (outcome.mcpConfigNotices ?? []) : [],
  );
  notifyMcpConfigNotices(ctx, run, [...notices, ...(failed?.mcpConfigNotices ?? [])]);
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
  const { ctx, run, cwd, target, scope: explicitScope } = opts;

  if (err instanceof MarketplaceNotAddedSignal) {
    await emitMarketplaceNotAddedSignal({
      ctx,
      run,
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
      run,
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
    run,
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
 * CR-01 / AFILE-04: close a batch that stopped on a failure its own
 * `notifyDirectFailure` already reported. Earlier targets committed to disk
 * through their own `withStateGuard` closures and may have rewritten
 * mcp-adapter.json, so their cascade and MCP notices still render.
 *
 * WR-01: the cascade is flagged aborted-by-failure so the never-silent no-op
 * headline is suppressed. If every accumulated outcome was `unchanged`, the
 * bulk-suppressed cascade is empty and the headline would otherwise emit a
 * contradictory `nothing to update` line right after the failure. An empty
 * accumulator skips the cascade so no empty-marketplaces sentinel follows the
 * failure.
 *
 * `failed` is the phase-3a aggregate outcome, when the abort came from one.
 * Its MCP notices follow the cascade, because its MCP commit may have
 * rewritten the file before a later bridge failed.
 */
function abortUpdateBatch(
  ctx: NotificationContext,
  run: NotificationRun,
  outcomes: readonly UpdateCascadeOutcome[],
  cardinality: "single" | "plural",
  composeCascade: UpdateCascadeComposer,
  failed?: UpdatePhase3FailedOutcome,
): void {
  if (outcomes.length > 0) {
    composeCascade(ctx, run, outcomes, cardinality, true);
  }

  surfaceUpdateMcpConfigNotices(ctx, run, outcomes, failed);
}

// ─────────────────────────────────────────────────────────────────────────────
// The cascade entries -- PluginUpdateFn and PluginConvergeFn (cascade-safe)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * D-09 corollary: the `PluginUpdateFn` impl (D-05). The marketplace
 * autoupdate cascade wires this in. Its cascade-safe contract is
 * `runCascadeTarget`'s.
 */
async function updateSinglePluginWith(
  bindings: UpdateBindings,
  runPluginUpdate: UpdatePluginRunner,
  plugin: string,
  marketplace: string,
  scope: Scope,
  constraintMemos: {
    readonly tagMemo: Map<string, readonly RemoteTag[]>;
    readonly marketplaceTagMemo: Map<string, readonly ReleaseTagCandidate[]>;
  },
): Promise<PluginUpdateOutcome> {
  // The cascade signature does not carry `cwd`; we default to process.cwd
  // because the cascade is invoked from a marketplace orchestrator that
  // already operates in the user's session cwd. Future wiring may add a
  // dependency-injection seam if needed.
  const cwd = process.cwd();
  return runCascadeTarget(runPluginUpdate, {
    plugin,
    marketplace,
    scope,
    cwd,
    locations: locationsFor(scope, cwd),
    ...bindings,
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
    // D-10-18: the SAME pair for every plugin of ONE autoupdate run, so a
    // cascade over many plugins of one marketplace lists it once -- see
    // `beginPluginUpdateRun` below for why the pair is allocated per run
    // and not beside the binding.
    constraintTagMemo: constraintMemos.tagMemo,
    constraintMarketplaceTagMemo: constraintMemos.marketplaceTagMemo,
    cleanupClones: collectPluginClonesLocked,
  });
}

/**
 * D-26: the `PluginConvergeFn` impl `apply` drives for one catalog move. The
 * cascade mode builds stored credentials only and starts no Device Flow
 * (D-3-04), and the converge policy lists no tag (D-23), so no tag memo is
 * allocated. The scope's locations come from the target's own `cwd`.
 */
function convergePluginWith(
  bindings: UpdateBindings,
  runPluginConverge: UpdatePluginRunner,
  target: PluginConvergeTarget,
): Promise<PluginUpdateOutcome> {
  return runCascadeTarget(runPluginConverge, {
    plugin: target.plugin,
    marketplace: target.marketplace,
    scope: target.scope,
    cwd: target.cwd,
    locations: locationsFor(target.scope, target.cwd),
    ...bindings,
    cascade: true,
    // D-26 / WCONV-01: only a record already installed partial admits a
    // partial candidate; a clean record's consent guard declines it.
    partial: target.partial,
    cleanupClones: target.cleanupClones ?? collectPluginClonesLocked,
  });
}

/**
 * The per-target catch both cascade entries share. Cascade-safe contract:
 * errors (including PathContainmentError, ST-9 stale-version, prep failures,
 * phase-3a aggregate failures) are captured into `partition='failed'`
 * outcomes. PUP-9. The one error it rethrows is an invalid GitHub base
 * override, which fails the command that runs the cascade (GHB-03).
 */
async function runCascadeTarget(
  runner: UpdatePluginRunner,
  args: Omit<CascadeThreePhaseArgs, "onCandidate" | "onRecord">,
): Promise<PluginUpdateOutcome> {
  const report: CandidateReport = {};
  try {
    return await runner({ ...args, ...recordCandidate(report) });
  } catch (err) {
    // GHB-03: an invalid GitHub base override fails the command that runs
    // the cascade.
    rethrowInvalidGitHubBaseUrl(err);
    return cascadeFailureOutcome(args.plugin, report, err);
  }
}

/**
 * Capture a cascade target's throw into a partition='failed' outcome so the
 * cascade can continue aggregating outcomes across plugins without aborting
 * the whole batch. `notes` is consumed outside the notify path so the MSG-CC-1
 * trailer is composed inline here.
 *
 * GLK-02 / D-PL7-04: the reason comes from the ladder the direct path uses
 * (`classifyUpdateFailure`), so the cascade row names the reason the direct
 * row names. D-PL7-12: a reason from the git, errno, or fallback arm carries
 * the error as the row's cause, as the direct row does.
 */
function cascadeFailureOutcome(
  plugin: string,
  report: CandidateReport,
  err: unknown,
): PluginUpdateOutcome {
  const cleanupFailures = cleanupFailuresFromError(err);
  const failure = classifyUpdateFailure(err);
  const base: PluginUpdateOutcome = {
    partition: "failed",
    name: plugin,
    // UPR-03: the move a throw after the candidate attempted; nothing
    // before one.
    ...report.move,
    notes: [composeErrorWithCauseChain(err)],
    ...(!failure.typed && err instanceof Error && { cause: err }),
    ...(cleanupFailures.length > 0 && {
      cause: err as Error,
      cleanupFailures,
    }),
    // FLR-02: a held state lock renders its cause chain, as on the direct
    // path; D-18-17: so does an unreadable dependency walk, whose message
    // names the record it could not read.
    ...((err instanceof StateLockHeldError ||
      err instanceof DependencyDeclarationsUnreadableError) && { cause: err }),
    // CMC-13: required booleans on every
    // PluginUpdateOutcome partition. `(failed)` rows do NOT render
    // the soft-dep marker (MSG-SD-3), so the value is `false`.
    declaresAgents: false,
    declaresMcp: false,
    declaresWorkflows: false,
  };
  return { ...base, reasons: [failure.reason] };
}

/**
 * GLK-02 / D-PL7-04: the one failure ladder of `update`, shared by the direct
 * path and the cascade paths (autoupdate and apply's converge). A cleanup
 * leak is narrowed to its primary error. A typed error names its own reason
 * (`typedUpdateFailReason`); any other error goes through
 * `untypedUpdateFailReason`. `typed` tells the cascade that the reason came
 * from a typed error, whose row carries a cause only where
 * `cascadeFailureOutcome` names one.
 */
function classifyUpdateFailure(err: unknown): {
  readonly reason: ContentReason;
  readonly typed: boolean;
} {
  const primary = err instanceof CleanupContextError ? err.primary : err;
  const typedReason = typedUpdateFailReason(primary);
  return typedReason === undefined
    ? { reason: untypedUpdateFailReason(primary), typed: false }
    : { reason: typedReason, typed: true };
}

/**
 * D-PL7-02: a plugin clone access reads a repository the record names, so a
 * host 404 or 410 means the source is gone.
 */
const PLUGIN_CLONE_RULE: Parameters<typeof classifyGitFailure>[1] = {
  notFound: "source missing",
};

/**
 * The reason of a failure no typed error names: the git host's answer under
 * the plugin-clone rule first, then the errno (D-13: a bridge's staging
 * error reads its filesystem cause), then `unreadable manifest`.
 */
function untypedUpdateFailReason(primary: unknown): ContentReason {
  return (
    classifyGitFailure(primary, PLUGIN_CLONE_RULE)?.reason ?? errnoFailReason(failureErrno(primary))
  );
}

/**
 * D-13: the errno behind a failure. A bridge that could not stage a file
 * names the file in its own message and carries the filesystem error as its
 * cause, so a source the runner cannot read reads `permission denied`.
 */
function failureErrno(error: unknown): string | undefined {
  const carrier = error instanceof BridgeStagingError ? error.cause : error;
  return (carrier as NodeJS.ErrnoException | undefined)?.code;
}

function errnoFailReason(code: string | undefined): ContentReason {
  switch (code) {
    case "EACCES":
    case "EPERM":
      return "permission denied";
    case "ENOENT":
    case "ENOTDIR":
      return "source missing";
    // A local file the update could not read or write, such as a directory in
    // place of mcp-adapter.json: naming the marketplace manifest would blame
    // the wrong file (the marketplace/shared.ts errno precedent).
    case "EISDIR":
    case "EIO":
    case "EBADF":
      return "unreadable";
    case undefined:
    default:
      return "unreadable manifest";
  }
}

/**
 * The reason a typed failure names, or `undefined` for an error no typed
 * identity matches. FLR-01: a held state lock is `"lock held"`, as the other
 * plugin commands report it.
 */
function typedUpdateFailReason(primary: unknown): ContentReason | undefined {
  if (primary instanceof StateLockHeldError) {
    return "lock held";
  }

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

  if (primary instanceof PluginInLocalLayerOnlyError) {
    return "plugin in local layer only";
  }

  if (primary instanceof PluginInBaseLayerOnlyError) {
    return "plugin in base layer only";
  }

  if (primary instanceof DependencyDeclarationsUnreadableError) {
    return "unreadable";
  }

  return undefined;
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
  readonly run: NotificationRun;
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
   * take their Reason from the shared `classifyUpdateFailure` ladder.
   */
  readonly reasonOverride?: ContentReason;
  /**
   * Optional per-phase rollback children. Threaded only by the phase-3
   * aggregate path; the update-local type preserves each internal Error
   * identity for the renderer's cause-chain walker.
   */
  readonly rollbackPartial?: readonly UpdatePhase3Failure[];
  /**
   * UPR-03: the target's candidate report. A failure after the candidate
   * shows the move it attempted, and one after the preflight found the record
   * shows the installed version; the marketplace-sync, enumeration, and
   * layer-refusal failures carry none and show no version.
   */
  readonly report?: CandidateReport;
}

function notifyDirectFailure(args: NotifyDirectFailureArgs): void {
  const { ctx, run, marketplace, scope, pluginName, err } = args;
  const cause = err instanceof Error ? err : new Error(String(err));
  const reasons: readonly ContentReason[] = [
    args.reasonOverride ?? classifyUpdateFailure(cause).reason,
  ];
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
    ...revisionVersionSlot(args.report?.move ?? {}),
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
    run,
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
 * WR-05: synthetic placeholder for the bare-form enumerate-failure path.
 * Held as a module-level constant so a future change has a single edit
 * point. Mirrors the `"(reinstall)"` precedent in
 * `orchestrators/plugin/reinstall-flow.ts`.
 */
const SYNTHETIC_UPDATE_PLACEHOLDER_NAME = "(update)";

/**
 * WR-05: bare-form (`target.kind === "all"`) enumerate-failure emission.
 * Distinct from the marketplace/plugin failure path because the bare
 * form has no marketplace identity to thread into the row; using the
 * marketplace identity slot for a synthetic `"(targets)"` literal
 * produced operator-confusing output (`⊘ (targets) (failed)...` under
 * a marketplace block named `(targets)`).
 *
 * Mirrors the `orchestrators/plugin/reinstall-flow.ts` bulk operation
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
  readonly run: NotificationRun;
  readonly scope: Scope | undefined;
  readonly err: Error;
  readonly cardinality: "single" | "plural";
}): void {
  const { ctx, run, scope, err } = args;
  const reasons: readonly ContentReason[] = [classifyUpdateFailure(err).reason];
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
    run,
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

/**
 * LAYER-04 / D-MF-03: a nameless update with `--local` covers the plugins the
 * local layer declares and the dependencies those plugins need; without the
 * flag it covers every installed plugin of the scope.
 */
async function enumerateTargets(opts: UpdatePluginsOptions): Promise<readonly ResolvedTarget[]> {
  const targets = await enumerateScopeTargets(opts);
  return opts.local === true && opts.target.kind !== "plugin"
    ? keepLocalLayerTargets(targets, opts.cwd)
    : targets;
}

async function enumerateScopeTargets(
  opts: UpdatePluginsOptions,
): Promise<readonly ResolvedTarget[]> {
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
    // eslint-disable-next-line no-await-in-loop -- at most two scopes, one state read each
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
  // downstream `(failed) {not installed}` preflight (UPR-04). A
  // marketplace-absent / other-scope outcome raises `MarketplaceNotAddedSignal`
  // -- caught at the `updatePlugins` entrypoint and re-attributed to the
  // standalone `{marketplace not added}` variant, so the miss is never
  // misattributed to `{not found}` (M10/M11).
  const resolved = await resolveUpdateMarketplaceScope(cwd, mpName, target, explicitScope);
  const state = await loadState(resolved.locations.extensionRoot);
  const mp = ownValue(state.marketplaces, mpName);
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
 *    scope (the downstream `preflightUpdate` emits `(failed) {not installed}`,
 *    UPR-04); a marketplace-absent / other-scope outcome signals
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

/** Direct/bulk update operation with the complete command option contract. */
export type UpdatePluginsFn = (options: UpdatePluginsOptions) => Promise<void>;

/** The direct and cascade update operations owned by one extension lifecycle. */
export interface PluginUpdateOperations {
  readonly updatePlugins: UpdatePluginsFn;
  /**
   * Allocates the autoupdate cascade's `PluginUpdateFn` for ONE run. The
   * caller invokes this once per `marketplace update` command and drives
   * every plugin of that command through the returned function, which is
   * what bounds the D-10-18 tag memos to the run (see
   * `createPluginUpdateOperations`).
   */
  readonly beginPluginUpdateRun: (notification?: UpdateNotification) => PluginUpdateFn;
  /** D-26: materializes one catalog move for `apply` under the converge policy. */
  readonly convergePlugin: PluginConvergeFn;
}

/**
 * D-26 / D-11 / D-23: `apply`'s catalog move reads a present mirror's HEAD
 * offline (only a cache miss clones), skips the recorded revision, keeps a
 * user-edited agent file, and takes the catalog version with no tag search, so
 * it applies exactly what `pending` previewed.
 */
const CONVERGE_MATERIALIZATION: MaterializationPolicy = {
  refreshSource: false,
  skipSameRevision: true,
  overwrite: false,
  searchReleaseTags: false,
};

/** Refuses a named update the other layer owns, then runs the shared materialization leaf. */
async function runPluginUpdate(args: ThreePhaseArgs): Promise<UpdateRunOutcome> {
  await refuseOtherLayerUpdate(args);
  return materializeLatestVersion(args, UPDATE_MATERIALIZATION);
}

/**
 * D-10 / D-25: a growth-only move re-materializes the recorded revision. Only
 * `skipSameRevision` differs from the catalog move; `overwrite` stays off, so a
 * user-edited agent file is still kept (D-26).
 */
const REMATERIALIZE_MATERIALIZATION: MaterializationPolicy = {
  ...CONVERGE_MATERIALIZATION,
  skipSameRevision: false,
};

/** D-26: one catalog move through the shared materialization leaf. */
function runPluginConverge(args: ThreePhaseArgs): Promise<UpdateRunOutcome> {
  return materializeLatestVersion(args, CONVERGE_MATERIALIZATION);
}

/** D-10 / D-25: one growth-only move through the shared materialization leaf. */
function runPluginRematerialize(args: ThreePhaseArgs): Promise<UpdateRunOutcome> {
  return materializeLatestVersion(args, REMATERIALIZE_MATERIALIZATION);
}

/**
 * LAYER-04 / D-MF-03: a named update acts on its target layer, so it is
 * refused when only the other layer declares the plugin, and when a layer
 * file cannot be read (CFG-03). The `single` cardinality is the
 * `<plugin>@<marketplace>` invocation form (OUT-04); the `@<marketplace>` and
 * bare forms and the autoupdate cascade name no plugin.
 *
 * NFR-5: the check reads only the two layer configs, and it runs before the
 * preflight. So a refused update builds no credentials, lists no tags, and
 * clones nothing. An up-to-date plugin is refused too, because knowing that a
 * git-source plugin is up to date needs the network.
 */
async function refuseOtherLayerUpdate(args: ThreePhaseArgs): Promise<void> {
  if (args.cascade || args.cardinality !== "single") {
    return;
  }

  const refusal = await namedPluginLayerRefusal({
    locations: args.locations,
    local: args.local === true,
    marketplace: args.marketplace,
    plugin: args.plugin,
  });
  if (refusal !== undefined) {
    throw refusal;
  }
}

/**
 * Binds update enumeration, preflight, swap, cascade, and lifecycle routing once.
 * `stateTransaction` replaces the state I/O of every locked save the update
 * makes; production callers omit it.
 *
 * D-08-06: `env` is the environment the update stages MCP servers with. It
 * defaults to Pi's process environment here, at the entry point, the way
 * `createGetPluginInfo` binds it.
 */
export function createPluginUpdateOperations(
  hooksRouting: UpdateHooksRouting,
  completionCache: CompletionCache,
  stateTransaction?: LockedStateTransactionDeps,
  env: ClaudeEnv = process.env,
  resolveDependencies?: UpdateDependencyResolver,
): PluginUpdateOperations {
  const bindings: UpdateBindings = { hooksRouting, completionCache, env };
  const withStateTransaction = (runner: UpdatePluginRunner): UpdatePluginRunner =>
    stateTransaction === undefined ? runner : (args) => runner({ ...args, stateTransaction });
  const run = withStateTransaction(runPluginUpdate);
  const converge = withStateTransaction(runPluginConverge);
  const rematerialize = withStateTransaction(runPluginRematerialize);
  // UPD-DEP-D1: `update` and the autoupdate cascade settle the closure of the
  // version they move to, in the notification context of the command that
  // runs them. `apply`'s catalog moves do not: its plan installs, enables and
  // moves the dependencies first, as `pending` previews them.
  const settling = (notification: UpdateNotification | undefined): UpdatePluginRunner =>
    resolveDependencies === undefined || notification === undefined
      ? run
      : (args) =>
          run({
            ...args,
            settleDependencies: (moved, prepared) =>
              resolveDependencies(moved, prepared, notification),
          });
  const updatePlugins: UpdatePluginsFn = (options) =>
    updatePluginsWith(
      options,
      bindings,
      settling({ ctx: options.ctx, run: options.run }),
      composeUpdateCascade,
    );
  // D-10-18: ONE memo pair per autoupdate run. `beginPluginUpdateRun`
  // allocates the pair, so the pair's lifetime is the run's and a release tag
  // pushed between two runs is visible to the second. The pair spans every
  // plugin of one run, so a marketplace common to several of them is listed
  // once and the cascade's warm-cache expectation for path sources holds.
  const beginPluginUpdateRun = (notification?: UpdateNotification): PluginUpdateFn => {
    const constraintTagMemo = new Map<string, readonly RemoteTag[]>();
    const constraintMarketplaceTagMemo = new Map<string, readonly ReleaseTagCandidate[]>();
    const runner = settling(notification);
    return (plugin, marketplace, scope) =>
      updateSinglePluginWith(bindings, runner, plugin, marketplace, scope, {
        tagMemo: constraintTagMemo,
        marketplaceTagMemo: constraintMarketplaceTagMemo,
      });
  };

  const convergePlugin: PluginConvergeFn = (target) =>
    convergePluginWith(bindings, target.rematerialize ? rematerialize : converge, target);

  return { updatePlugins, beginPluginUpdateRun, convergePlugin };
}

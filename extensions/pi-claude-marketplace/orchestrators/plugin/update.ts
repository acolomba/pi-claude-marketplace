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
//  + appendLeaks of cleanup-leak descriptors.
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
//  Else: success outcome carries WR-04 stagedAgents/stagedMcpServers.
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

import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

import {
  abortPreparedAgents,
  commitPreparedAgents,
  prepareStagePluginAgents,
} from "../../bridges/agents/index.ts";
import {
  abortPreparedCommands,
  commitPreparedCommands,
  prepareStageCommands,
} from "../../bridges/commands/index.ts";
import { compileIfPredicate } from "../../bridges/hooks/if-field/index.ts";
import {
  readAndCachePluginHooks,
  rebuildRoutingTables,
  removeHookConfig,
  removePluginConfigFromCache,
  writeHookConfig,
} from "../../bridges/hooks/index.ts";
import {
  abortPreparedMcp,
  commitPreparedMcp,
  prepareStageMcpServers,
} from "../../bridges/mcp/index.ts";
import {
  abortPreparedSkills,
  commitPreparedSkills,
  prepareStageSkills,
} from "../../bridges/skills/index.ts";
import { parseHooksConfig } from "../../domain/components/hooks.ts";
import { PLUGIN_ENTRY_VALIDATOR, type PluginEntry } from "../../domain/components/plugin.ts";
import { loadMarketplaceManifest } from "../../domain/manifest.ts";
import { asAbsolutePluginRoot } from "../../domain/plugin-root.ts";
import {
  requirePartialInstallable,
  requireInstallable,
  resolveStrict,
} from "../../domain/resolver.ts";
import { parsePluginSource } from "../../domain/source.ts";
import { shaVersion } from "../../domain/version.ts";
import { locationsFor } from "../../persistence/locations.ts";
import { loadState } from "../../persistence/state-io.ts";
import { softDepStatus } from "../../platform/pi-api.ts";
import { dropMarketplaceCache } from "../../shared/completion-cache.ts";
import {
  appendLeaks,
  assertNever,
  composeErrorWithCauseChain,
  errorMessage,
  PluginShapeError,
  PluginUpdatePhase3Error,
  type Phase3Failure,
} from "../../shared/errors.ts";
import { classifyGitTransportFailure } from "../../shared/git-failure-classifiers.ts";
import { RECOVERY_PLUGIN_REINSTALL_PREFIX } from "../../shared/markers.ts";
import {
  notifyUpdateNoOpWithContext,
  notifyUpdateWithContext,
  notifyWithContext,
  type MarketplaceRows,
  type Plural,
} from "../../shared/notify-context.ts";
import { companionSeverity, skipSeverity } from "../../shared/notify-reasons.ts";
import { compareByNameThenScope, notify } from "../../shared/notify.ts";
import { narrowUnsupportedKinds } from "../../shared/probe-classifiers.ts";
import { withStateGuard } from "../../transaction/with-state-guard.ts";
import { DEFAULT_CREDENTIAL_OPS, buildAuthForHost, hostFromCloneUrl } from "../auth-host.ts";
import { DEFAULT_GIT_OPS, refreshGitHubClone, type GitOps } from "../marketplace/shared.ts";

import {
  canonicalCloneUrl,
  materializeOrRefreshPluginMirror,
  materializePluginClone,
  resolveGitSubdirRoot,
  resolvePluginPin,
} from "./clone-cache.ts";
import { garbageCollectPluginClones } from "./clone-gc.ts";
import { discoverGeneratedNames } from "./discover-names.ts";
import {
  assertNoCrossPluginConflicts,
  MarketplaceNotAddedSignal,
  maybeWritePluginConfigBack,
  resolveInstalledMarketplaceTarget,
  resolveInstalledPluginTarget,
  resolvePluginVersion,
} from "./shared.ts";
import { UPDATE_CONTEXT, type UpdateMsg } from "./update.messaging.ts";

import type { PreparedAgentsStaging } from "../../bridges/agents/index.ts";
import type { PreparedCommandsStaging } from "../../bridges/commands/index.ts";
import type { PreparedMcpStaging } from "../../bridges/mcp/index.ts";
import type { PreparedSkillsStaging } from "../../bridges/skills/index.ts";
import type { GitPluginRootResult, MaterializablePlugin } from "../../domain/resolver.ts";
import type { GitBackedSource, ParsedSource } from "../../domain/source.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { ExtensionState } from "../../persistence/state-io.ts";
import type { ExtensionAPI, ExtensionContext, SoftDepStatus } from "../../platform/pi-api.ts";
import type { Dependency } from "../../shared/concerns/soft-dep.ts";
import type { ContentReason, PluginFailedMessage } from "../../shared/notify.ts";
import type { Scope } from "../../shared/types.ts";
import type { AuthAttemptResult, CredentialOps, DeviceFlowHttp } from "../auth-host.ts";
import type { PluginUpdateFn, PluginUpdateOutcome, PluginUpdateSkippedOutcome } from "../types.ts";

// ─────────────────────────────────────────────────────────────────────────────
// updatePlugins -- direct entrypoint (PUP-1 three forms)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Target spec for PUP-1 three forms. edge layer parses argv and
 * constructs this discriminated union:
 *  - `{ kind: "all" }` (bare form)
 *  - `{ kind: "marketplace", marketplace }` (@mp form)
 *  - `{ kind: "plugin", plugin, marketplace }` (pl@mp form)
 */
export type UpdatePluginsTarget =
  | { readonly kind: "all" }
  | { readonly kind: "marketplace"; readonly marketplace: string }
  | { readonly kind: "plugin"; readonly plugin: string; readonly marketplace: string };

// ATTR-02 / D-47-A: the structural marketplace-not-added signal raised by the
// direct-path enumerator (`enumerateMarketplaceTarget`) is the shared
// `MarketplaceNotAddedSignal` from `./shared.ts` (one source of truth so
// `instanceof` agrees with reinstall.ts). The cascade path
// (`updateSinglePlugin` / `preflightUpdate`) NEVER raises it -- it keeps its
// non-throwing concurrent-removal outcome (A3).

/**
 * PURL-06 / D-78-05: the clone-cache seam update injects into the git-source
 * candidate probe. update.ts is the sole gitOps exemption under
 * tests/architecture/no-orchestrator-network.test.ts, so unlike install
 * it may resolveRemoteRef + materialize inline. Production leaves this undefined
 * and update uses the real `resolvePluginPin` / `materializePluginClone` imports
 * (which default to the real git backend). Tests substitute mock-backed
 * entrypoints so the git-source update path runs without touching the network.
 */
export interface UpdateCloneCacheSeam {
  readonly resolvePluginPin: typeof resolvePluginPin;
  readonly materializePluginClone: typeof materializePluginClone;
  /**
   * MIRR-01/MIRR-03 / D-79.1-01: the mirror seam for an UNPINNED git source
   * (`source.sha === undefined`). Refreshes the single mutable
   * `plugin-clones/<urlhash12>/` mirror in place and re-anchors the record to
   * the bare mirror key with the resolved HEAD sha.
   */
  readonly materializeOrRefreshPluginMirror: typeof materializeOrRefreshPluginMirror;
}

export interface UpdatePluginsOptions {
  readonly ctx: ExtensionContext;
  /** Factory `pi` reference -- carries `getAllTools` for RH-3/RH-4 soft-dep probes. */
  readonly pi: ExtensionAPI;
  readonly scope?: Scope;
  readonly cwd: string;
  readonly target: UpdatePluginsTarget;
  /** D-12 injection seam; defaults to DEFAULT_GIT_OPS. */
  readonly gitOps?: GitOps;
  /** PURL-06 test-only clone-cache seam override; production uses the real imports. */
  readonly cloneCacheSeam?: UpdateCloneCacheSeam;
  /**
   * AG-7 opt-in flag. Default false: re-staged agents omit `model:` and
   * Pi picks its own default. The edge handler sets this to `true` only
   * when the user supplies `--map-model` on `/claude:plugin update`.
   * The marketplace autoupdate cascade (`updateSinglePlugin`) does NOT
   * accept this flag; cascade-driven re-installs always omit `model:`.
   */
  readonly mapModel?: boolean;
  /**
   * WB-01 / WB-02: when true, target
   * `claude-plugins.local.json` instead of `claude-plugins.json` for
   * write-back on the direct path.
   */
  readonly local?: boolean;
  /**
   * FORCE-02 opt-in. When true, the candidate resolve admits the
   * partially-available arm (D-65-04): a `partially-available` target
   * updates by degrading instead of blocking. Default false keeps the
   * existing `requireInstallable` block. Never bypasses an `unavailable`/
   * structural candidate (FORCE-05). The cascade entrypoint
   * (`updateSinglePlugin`) does NOT accept this flag.
   */
  readonly partial?: boolean;
  /**
   * PROV-03 / D-79-05 injection seam. Defaults to DEFAULT_CREDENTIAL_OPS at use.
   * The git-source candidate probe passes it to `buildAuthForHost` so an
   * unpinned private update authenticates at pin-resolution (Q1) and the
   * re-clone authenticates (PROV-03). Tests inject makeMockCredentialOps().
   */
  readonly credentialOps?: CredentialOps;
  /** PROV-03 Device Flow HTTP seam; tests inject makeMockDeviceFlowHttp(). */
  readonly deviceFlowHttp?: DeviceFlowHttp;
  /** D-79-02 once-per-host memo shared across a bulk update. */
  readonly authMemo?: Map<string, AuthAttemptResult>;
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
export async function updatePlugins(opts: UpdatePluginsOptions): Promise<void> {
  const { ctx, pi, cwd } = opts;
  const gitOps = opts.gitOps ?? DEFAULT_GIT_OPS;

  let targets: readonly ResolvedTarget[];
  try {
    targets = await enumerateTargets(opts);
  } catch (err) {
    handleEnumerateFailure(opts, err);
    return;
  }

  if (targets.length === 0) {
    // empty-targets success: `marketplaces: []` round-trips through notify
    // to the (no marketplaces) sentinel. Severity: undefined. No reload-hint.
    notify(ctx, pi, { marketplaces: [] });
    return;
  }

  // PUP-2 syncCloneOnce memoization -- per (scope, marketplace) pair.
  // Path-source marketplaces are noops (NFR-5: no network for path sources).
  // GitHub-source marketplaces refresh via gitOps.fetch + forceUpdateRef + checkout
  // (D-14 sequence). syncCloneOnce throws on git-side failures.
  const synced = new Set<string>();
  const syncCloneOnce = async (
    scope: Scope,
    mpName: string,
    locations: ScopedLocations,
  ): Promise<void> => {
    const key = `${scope}/${mpName}`;
    if (synced.has(key)) {
      return;
    }

    synced.add(key);

    const state = await loadState(locations.extensionRoot);
    const mp = state.marketplaces[mpName];
    if (mp === undefined) {
      throw new Error(`Marketplace "${mpName}" not found in ${scope} scope.`);
    }

    const source = mp.source as ParsedSource;
    if (source.kind === "github") {
      const cloneDir = await locations.sourceCloneDir(mpName);
      await refreshGitHubClone(cloneDir, source.ref, gitOps);
    }
    // path-source: NFR-5 noop. The manifest is re-read per-plugin below.
  };

  // Pair each outcome with its target so the cascade renderer can group
  // by (scope, marketplace) per CMC-21 (per-scope rendering, no collapse).
  // The bare update across multiple scopes / marketplaces becomes one
  // cascade block per (scope, marketplace) pair.
  const outcomes: { readonly target: ResolvedTarget; readonly outcome: PluginUpdateOutcome }[] = [];
  // OUT-04 / D-04: the structural single-vs-plural cardinality is the invocation
  // FORM -- a `<plugin>@<mp>` target is single-target (omits the tally), while
  // the `@<marketplace>` and bare forms are bulk (emit the tally).
  const cardinality: "single" | "plural" = opts.target.kind === "plugin" ? "single" : "plural";
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

    let outcome: PluginUpdateOutcome;
    try {
      outcome = await runThreePhaseUpdate({
        plugin: t.plugin,
        marketplace: t.marketplace,
        scope: t.scope,
        cwd,
        locations: t.locations,
        cascade: false,
        ctx,
        // thread `pi` for the phase-3a aggregate
        // direct-path notify invocation inside runThreePhaseUpdate.
        // Cascade mode leaves `pi` undefined (the cascade orchestrator
        // owns its own notify call).
        pi,
        // AG-7 opt-in: thread `--map-model` from the user-facing options
        // bag into the per-plugin 3-phase swap. The cascade entrypoint
        // (`updateSinglePlugin`) intentionally never sets this -- it
        // resolves to false at the bridge call site so cascade re-installs
        // always omit `model:`.
        mapModel: opts.mapModel ?? false,
        // FORCE-02: thread `--partial` from the user-facing options bag into
        // the per-plugin candidate gate (D-65-04). The cascade entrypoint
        // (`updateSinglePlugin`) never sets this, so cascade re-installs
        // resolve to false and keep the `requireInstallable` block.
        partial: opts.partial ?? false,
        // WB-01: thread `--local` for the direct-path
        // write-back target selection.
        ...(opts.local === true && { local: true }),
        // PURL-06: thread the test-only clone-cache seam into the git-source
        // candidate probe. Undefined in production -> the real imports.
        ...(opts.cloneCacheSeam !== undefined && { cloneCacheSeam: opts.cloneCacheSeam }),
        // PROV-03 / D-79-02: thread the auth seams so a git-source update on a
        // provider host authenticates host-keyed at pin-resolution + re-clone.
        ...(opts.credentialOps !== undefined && { credentialOps: opts.credentialOps }),
        ...(opts.deviceFlowHttp !== undefined && { deviceFlowHttp: opts.deviceFlowHttp }),
        ...(opts.authMemo !== undefined && { authMemo: opts.authMemo }),
      });
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
      renderUpdateCascadeIfAny(ctx, pi, outcomes, cardinality, true);
      return;
    }

    outcomes.push({ target: t, outcome });
  }

  renderUpdateCascadeAndNotify(ctx, pi, outcomes, cardinality);
}

/**
 * Emit the single `notify()` call for a target-enumeration failure. Extracted
 * from `updatePlugins` to keep that function's cognitive complexity inside the
 * sonarjs ceiling (mirrors `reinstall.ts::handleEnumerationFailure`).
 *
 * Three arms:
 *   - ATTR-02 / D-47-A marketplace-not-added: `enumerateMarketplaceTarget`
 *     raised the structural `MarketplaceNotAddedSignal` (instead of the former
 *     raw `Error`/`MarketplaceNotFoundError` -> `{not found}` misattribution).
 *     Emit ONE standalone top-level `MarketplaceNotAddedMessage` -- byte-
 *     identical to `info` and the install/uninstall/reinstall plans -- BEFORE
 *     any cascade row exists. `requestedScope` (when present) renders the
 *     `[scope]` bracket (SCOPE-01); the bare both-scopes-miss form carries no
 *     bracket. Structural `{not added}`, no new REASONS member (D-47-B).
 *   - bare form (`target.kind === "all"`): WR-05 -- no marketplace identity to
 *     thread; surface via `notifyBareFormEnumerateFailure`.
 *   - `marketplace` / `plugin`: Option B synthetic `PluginFailedMessage` under
 *     the real marketplace name; the renderer composes the 4-space cause-chain
 *     trailer (WR-01 parens-wrapping for the bare-marketplace row name).
 */
function handleEnumerateFailure(opts: UpdatePluginsOptions, err: unknown): void {
  const { ctx, pi, target, scope: explicitScope } = opts;

  if (err instanceof MarketplaceNotAddedSignal) {
    notify(ctx, pi, {
      kind: "marketplace-not-added",
      name: err.marketplace,
      ...(err.requestedScope !== undefined && { scope: err.requestedScope }),
    });
    return;
  }

  // WR-05: `enumerateTargets` for the bare form calls `loadState` for both
  // scopes and propagates any I/O / schema-validation throw. The bare form has
  // no marketplace identity to thread into the row.
  if (target.kind === "all") {
    notifyBareFormEnumerateFailure({ ctx, pi, scope: explicitScope, err });
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
function isPhase3aAggregateFailure(outcome: PluginUpdateOutcome): boolean {
  return outcome.partition === "failed" && outcome.phaseFailures !== undefined;
}

/**
 * CR-01 helper: emit the cascade notification ONLY when at least one
 * outcome accumulated. Empty accumulators skip the call so we do not
 * emit an empty-marketplaces sentinel after a phase-3a abort.
 */
function renderUpdateCascadeIfAny(
  ctx: ExtensionContext,
  pi: ExtensionAPI,
  outcomes: readonly TargetedOutcome[],
  cardinality: "single" | "plural",
  // WR-01: the phase-3a abort path sets this so the never-silent no-op headline
  // is suppressed when the accumulated outcomes contain no realized transition.
  abortedByFailure = false,
): void {
  if (outcomes.length > 0) {
    renderUpdateCascadeAndNotify(ctx, pi, outcomes, cardinality, abortedByFailure);
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
export const updateSinglePlugin: PluginUpdateFn = async (plugin, marketplace, scope) => {
  // The cascade signature does not carry `cwd`; we default to process.cwd
  // because the cascade is invoked from a marketplace orchestrator that
  // already operates in the user's session cwd. Future wiring may add a
  // dependency-injection seam if needed.
  const cwd = process.cwd();
  const locations = locationsFor(scope, cwd);

  try {
    return await runThreePhaseUpdate({
      plugin,
      marketplace,
      scope,
      cwd,
      locations,
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
    });
  } catch (err) {
    // Cascade-safe: capture throws into a partition='failed' outcome so the
    // marketplace cascade can continue aggregating outcomes across plugins
    // without aborting the whole batch. `notes` is consumed outside the
    // notify path so the MSG-CC-1 trailer is composed inline here.
    //
    // Pre-narrow to a closed-set `Reason` so the cascade consumer reads
    // `outcome.reasons[0]` directly. Only `PluginShapeError` (from
    // `requireInstallable` during preflight) is recognized; other errors
    // leave `reasons` undefined and the consumer falls back to substring-narrow.
    const typedReasons = reasonsFromTypedError(err);
    const base: PluginUpdateOutcome = {
      partition: "failed",
      name: plugin,
      notes: [composeErrorWithCauseChain(err)],
      // CMC-13: required booleans on every
      // PluginUpdateOutcome partition. `(failed)` rows do NOT render
      // the soft-dep marker (MSG-SD-3), so the value is `false`.
      declaresAgents: false,
      declaresMcp: false,
    };
    return typedReasons === undefined ? base : { ...base, reasons: typedReasons };
  }
};

/**
 * Map a typed error to a closed-set `Reason[]` for cascade-failure outcomes.
 * Returns `undefined` when no recognized typed error is present; the consumer
 * then falls back to substring-narrowing on `notes`. Only `PluginShapeError`
 * carries enough structure to map directly.
 */
function reasonsFromTypedError(err: unknown): readonly ContentReason[] | undefined {
  if (err instanceof PluginShapeError) {
    // switch on `err.shape.kind` for compile-time
    // exhaustiveness against the typed discriminated union.
    switch (err.shape.kind) {
      case "no-longer-installable":
        return ["no longer installable"] as const;
      case "not-installable":
        // Cascade-path version: a not-installable throw from a CASCADE
        // update means the source classification changed since install;
        // we still surface as `"no longer installable"` because the
        // cascade-row catalog form is `(failed) {no longer installable}`.
        return ["no longer installable"] as const;
      case "not-in-manifest":
        return ["not in manifest"] as const;
      case "already-installed":
        // Cascade-path "already installed" should not happen at runtime
        // (the cascade walks installed plugins only); map to `"not in
        // manifest"` as the documented permissive fallback.
        return ["not in manifest"] as const;
    }
  }

  // errno-bearing FS errors map to the matching
  // closed Reason instead of falling through to the consumer's
  // legacy notes-substring parse (which would land on the permissive
  // `not in manifest` default for both narrowSkipReasons and
  // narrowFailReasons).
  if (err instanceof Error) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "EACCES" || code === "EPERM") {
      return ["permission denied"] as const;
    }

    if (code === "ENOENT" || code === "ENOTDIR") {
      return ["source missing"] as const;
    }
  }

  return undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared 3-phase swap implementation
// ─────────────────────────────────────────────────────────────────────────────

interface ThreePhaseArgs {
  readonly plugin: string;
  readonly marketplace: string;
  readonly scope: Scope;
  readonly cwd: string;
  readonly locations: ScopedLocations;
  /**
   * PUP-9 routing flag. `true` for the cascade path (caller is
   * `updateSinglePlugin`); `false` for the direct path (caller is
   * `updatePlugins`). Decides whether phase-3a aggregate-error rendering
   * emits a failed row for the direct path (cascade leaves notification
   * to the marketplace orchestrator).
   */
  readonly cascade: boolean;
  /**
   * Direct-path-only notification surface. Undefined in cascade mode.
   * When defined AND phase-3a aggregates failures, this is used for the
   * direct-path notify fire. Phase-2-or-earlier throws propagate to
   * the caller who does its own notify (so this field is only consulted
   * at the phase-3 aggregate-error step).
   */
  readonly ctx?: ExtensionContext;
  /**
   * Direct-path-only ExtensionAPI handle. Required alongside `ctx` for the
   * single softDepStatus(pi) probe per notify invocation.
   * Undefined in cascade mode; the cascade orchestrator (marketplace
   * autoupdate) owns its own notify invocation.
   */
  readonly pi?: ExtensionAPI;
  /**
   * AG-7 opt-in. Set by `updatePlugins` from `UpdatePluginsOptions.mapModel`
   * (which the edge handler populates from `--map-model`). The cascade
   * entrypoint `updateSinglePlugin` intentionally NEVER sets this -- the
   * `PluginUpdateFn` cascade signature has no flag, and cascade-driven
   * re-installs must always use the omit-by-default behavior so they
   * don't override the user's Pi default model with whatever the
   * upstream agent declares. Resolves to false at the bridge call site
   * via `args.mapModel ?? false` in `prepareUpdateHandles`.
   */
  readonly mapModel?: boolean;
  /**
   * WB-01 / WB-02: when true, target
   * `claude-plugins.local.json` instead of `claude-plugins.json` for the
   * direct-path write-back. The cascade path (`cascade: true`) SKIPS
   * write-back regardless -- the marketplace autoupdate cascade owns its
   * own config writes (mirrors WR-09 orchestrated-mode semantics).
   */
  readonly local?: boolean;
  /**
   * FORCE-02 opt-in. Set by `updatePlugins` from `UpdatePluginsOptions.partial`
   * (which the edge handler populates from `--partial`). Gates the candidate
   * resolve in `preflightUpdate` (D-65-04). The cascade entrypoint
   * `updateSinglePlugin` intentionally NEVER sets this; cascade-driven
   * re-installs resolve to false at the gate.
   */
  readonly partial?: boolean;
  /**
   * PURL-06 test-only clone-cache seam override for the git-source candidate
   * probe. Undefined in production (and in the cascade entrypoint) -> the real
   * `resolvePluginPin` / `materializePluginClone` imports.
   */
  readonly cloneCacheSeam?: UpdateCloneCacheSeam;
  /** PROV-03 credential seam (see UpdatePluginsOptions.credentialOps). */
  readonly credentialOps?: CredentialOps;
  /** PROV-03 Device Flow HTTP seam (see UpdatePluginsOptions.deviceFlowHttp). */
  readonly deviceFlowHttp?: DeviceFlowHttp;
  /** D-79-02 once-per-host memo (see UpdatePluginsOptions.authMemo). */
  readonly authMemo?: Map<string, AuthAttemptResult>;
}

interface PrepHandles {
  skills: PreparedSkillsStaging;
  commands: PreparedCommandsStaging;
  agents: PreparedAgentsStaging;
  mcp: PreparedMcpStaging;
}

interface PluginPreflight {
  readonly state: ExtensionState;
  readonly record: ExtensionState["marketplaces"][string]["plugins"][string];
  readonly entry: PluginEntry;
  readonly installable: MaterializablePlugin;
  readonly fromVersion: string;
  readonly toVersion: string;
  /**
   * PURL-06 / D-77-02: the full 40-hex commit sha the git-source candidate probe
   * captured (pinned source.sha or the re-resolved remote HEAD). Undefined for
   * path / github-name sources. `finalizeUpdateRecord` writes it into
   * `sRecord.resolvedSha` on the all-success arm so a future reinstall can pin
   * its re-clone to the persisted commit identity and clone GC keeps the
   * record's clone key live (D-78-01).
   */
  readonly resolvedSha?: string;
}

/**
 * PURL-06 / D-78-05: build the clone-materializing `resolveGitPluginRoot` probe
 * plus a getter for the resolved sha it captured. Mirrors install's
 * `makeInstallCloneProbe`, but update is gitOps-exempt (the sole exemption
 * under tests/architecture/no-orchestrator-network.test.ts) so the probe
 * legally resolves the pin (D-78-05: pinned source.sha short-circuits;
 * unpinned re-resolves remote HEAD by refreshing the mirror AT UPDATE TIME) and
 * materializes the new clone into the cache BEFORE the swap. git-subdir
 * containment (PURL-03 / NFR-10) is anchored to the clone root. The full sha is
 * captured as a side-channel because the resolver's `ResolvedPlugin` schema
 * cannot carry it; the caller reads `resolvedSha()` AFTER the resolve.
 */
function makeUpdateCloneProbe(
  seam: UpdateCloneCacheSeam,
  locations: ScopedLocations,
  auth: {
    ctx?: ExtensionContext;
    credentialOps: CredentialOps;
    deviceFlowHttp?: DeviceFlowHttp;
    authMemo?: Map<string, AuthAttemptResult>;
  },
): {
  probe: (source: GitBackedSource) => Promise<GitPluginRootResult>;
  resolvedSha: () => string | undefined;
} {
  let captured: string | undefined;

  // PROV-02/03 / T-79-09: build a host-keyed auth bundle from the CANONICAL clone
  // url (undefined for a public / no-provider host, or whenever `ctx` is absent
  // -- the cascade path has no user UI to prompt). Shared by both probe arms.
  const buildBundle = (gitSource: GitBackedSource, cloneUrl: string) => {
    if (auth.ctx === undefined) {
      return undefined;
    }

    return buildAuthForHost({
      host: hostFromCloneUrl(cloneUrl, gitSource.kind),
      credentialOps: auth.credentialOps,
      ctx: auth.ctx,
      ...(auth.deviceFlowHttp !== undefined && { deviceFlowHttp: auth.deviceFlowHttp }),
      ...(auth.authMemo !== undefined && { authMemo: auth.authMemo }),
    });
  };

  // MIRR-01/MIRR-03 / D-79.1-01: an UNPINNED source (no manifest sha, incl.
  // ref-only moving pointers) refreshes the single mutable mirror clone at
  // `plugin-clones/<urlhash12>/` in place and re-anchors the record to that bare
  // mirror key -- it does NOT re-clone into the per-sha immutable cache. update
  // is gitOps-exempt (the sole exemption under
  // tests/architecture/no-orchestrator-network.test.ts), but the mirror git
  // surface still lives in the clone-cache seam; the probe reaches it only by
  // name for parity with install.
  const probeUnpinned = async (gitSource: GitBackedSource): Promise<GitPluginRootResult> => {
    const cloneUrl = canonicalCloneUrl(gitSource);
    const authBundle = buildBundle(gitSource, cloneUrl);
    const { pluginRoot: mirrorRoot, resolvedSha } = await seam.materializeOrRefreshPluginMirror({
      locations,
      cloneUrl,
      ...(gitSource.ref !== undefined && { ref: gitSource.ref }),
      ...(authBundle !== undefined && { auth: authBundle }),
    });

    if (gitSource.kind === "git-subdir") {
      const subdirResult = await resolveGitSubdirRoot(mirrorRoot, gitSource.path);
      if (subdirResult.kind !== "materialized") {
        return subdirResult;
      }

      captured = resolvedSha;
      return { kind: "materialized", pluginRoot: subdirResult.pluginRoot, resolvedSha };
    }

    // Capture the resolved HEAD sha AFTER a successful materialize so a failed
    // mirror op does not leave a stale sha for the version/state record.
    captured = resolvedSha;
    return { kind: "materialized", pluginRoot: mirrorRoot, resolvedSha };
  };

  const probePinned = async (gitSource: GitBackedSource): Promise<GitPluginRootResult> => {
    const authBundle = buildBundle(gitSource, canonicalCloneUrl(gitSource));
    // The bundle threads into BOTH the pin resolution AND the re-clone.
    const { cloneUrl, pin, ref } = await seam.resolvePluginPin({
      source: gitSource,
      ...(authBundle !== undefined && { auth: authBundle }),
    });
    const cloneRoot = await seam.materializePluginClone({
      locations,
      cloneUrl,
      pin,
      ...(ref !== undefined && { ref }),
      ...(authBundle !== undefined && { auth: authBundle }),
    });

    if (gitSource.kind === "git-subdir") {
      const subdirResult = await resolveGitSubdirRoot(cloneRoot, gitSource.path);
      if (subdirResult.kind !== "materialized") {
        return subdirResult;
      }

      captured = pin;
      return { kind: "materialized", pluginRoot: subdirResult.pluginRoot, resolvedSha: pin };
    }

    // Capture the pin AFTER a successful materialize so a failed clone does not
    // leave a stale sha for the version/state record.
    captured = pin;
    return { kind: "materialized", pluginRoot: cloneRoot, resolvedSha: pin };
  };

  const probe = (gitSource: GitBackedSource): Promise<GitPluginRootResult> =>
    gitSource.sha === undefined ? probeUnpinned(gitSource) : probePinned(gitSource);

  return { probe, resolvedSha: () => captured };
}

/**
 * PURL-06 / D-77-01: derive the update's `toVersion`. A git source (url /
 * git-subdir / github) with a captured sha records `shaVersion(pin)` -- the
 * commit IS the version identity (mirror install's `deriveInstallVersion`); path
 * / github-name plugins keep the 3-tier `resolvePluginVersion` ladder.
 */
async function deriveUpdateToVersion(
  entry: PluginEntry,
  installable: MaterializablePlugin,
  resolvedSha: string | undefined,
): Promise<string> {
  const kind = parsePluginSource(entry.source).kind;
  const isGitSource = kind === "url" || kind === "git-subdir" || kind === "github";
  if (isGitSource && resolvedSha !== undefined) {
    return shaVersion(resolvedSha);
  }

  return resolvePluginVersion(entry, installable);
}

/**
 * Resolve + gate the update candidate, returning the materializable plugin on
 * success or a skipped `PluginUpdateOutcome` on a decline. Extracted from
 * `preflightUpdate` to keep that function inside the cognitive-complexity
 * ceiling; the catch fans out the three decline arms:
 *   - PURL-06 / NFR-3 git-probe network throw -> the EXISTING `network
 *     unreachable` / `authentication required` REASON (fail-clean; the plugin
 *     stays on its recorded sha, no swap).
 *   - XSURF-03 partially-upgradable decline (`--partial` could help) -> the
 *     list-consistent degrade kinds + `partialUpgradable: true`.
 *   - structural decline -> `no longer installable`.
 */
async function resolveUpdateCandidate(
  entry: PluginEntry,
  marketplaceRoot: string,
  resolveGitPluginRoot: (source: GitBackedSource) => Promise<GitPluginRootResult>,
  ctx: { readonly plugin: string; readonly fromVersion: string; readonly partial: boolean },
): Promise<MaterializablePlugin | PluginUpdateOutcome> {
  const { plugin, fromVersion, partial } = ctx;
  try {
    const resolved = await resolveStrict(entry, { marketplaceRoot, resolveGitPluginRoot });
    // FORCE-02/FORCE-05 (D-65-04): `--partial` widens the gate at the CANDIDATE
    // resolve so a `partially-available` target degrades (supported components
    // materialize, unsupported kinds skip) instead of blocking. Without
    // `--partial` the candidate still blocks via `requireInstallable`. Both
    // gates still reject an `unavailable`/structural candidate (FORCE-05).
    if (partial) {
      requirePartialInstallable(resolved, "update");
    } else {
      requireInstallable(resolved, "update");
    }

    return resolved;
  } catch (err) {
    // For a PATH source `resolveStrict` never throws (returns a not-installable
    // variant) and the only typed-throw producer is `requireInstallable`. For a
    // GIT source the injected `resolveGitPluginRoot` probe re-resolves an
    // unpinned entry's remote HEAD (D-78-05) and materializes the clone -- so a
    // vanished / unreachable repo throws a network error HERE.
    //
    // PURL-06 / NFR-3 / D-78-05: a git-probe network throw is fail-clean --
    // classify it through the shared `classifyGitTransportFailure` ladder to the
    // EXISTING `network unreachable` / `authentication required` REASON (no new
    // token); the plugin STAYS on its recorded sha. The raw error text rides
    // `notes` for the cause chain; an unclassified (non-transport) throw keeps
    // the `no longer installable` fallthrough below.
    const networkReason = classifyGitTransportFailure(err);
    if (networkReason !== undefined) {
      return {
        partition: "skipped",
        name: plugin,
        fromVersion,
        notes: [errorMessage(err)],
        reasons: [networkReason] as const,
        declaresAgents: false,
        declaresMcp: false,
      };
    }

    // XSURF-03: `err.shape.partialable === true` ⇔ the resolver verdict was
    // `partially-available`, i.e. a partially-upgradable decline `--partial`
    // could degrade-update. Carry the list-consistent degrade kinds via the SAME
    // `narrowUnsupportedKinds` helper the `list (partially-upgradable)` row uses
    // (byte-parity, pinned by catalog-uat) and mark `partialUpgradable: true`. A
    // structural decline keeps the `no longer installable` reason.
    if (
      err instanceof PluginShapeError &&
      err.shape.kind === "no-longer-installable" &&
      err.shape.partialable
    ) {
      return {
        partition: "skipped",
        name: plugin,
        fromVersion,
        notes: [errorMessage(err)],
        reasons: narrowUnsupportedKinds(err.shape.unsupportedKinds ?? []),
        partialUpgradable: true,
        declaresAgents: false,
        declaresMcp: false,
      };
    }

    return {
      partition: "skipped",
      name: plugin,
      fromVersion,
      notes: [errorMessage(err)],
      reasons: ["no longer installable"] as const,
      declaresAgents: false,
      declaresMcp: false,
    };
  }
}

async function preflightUpdate(
  args: ThreePhaseArgs,
): Promise<PluginPreflight | PluginUpdateOutcome> {
  const { plugin, marketplace, scope, locations } = args;
  const state = await loadState(locations.extensionRoot);
  const mp = state.marketplaces[marketplace];
  if (mp === undefined) {
    // Pre-narrow to a closed-set Reason so the cascade consumer reads it
    // directly instead of regex-parsing `notes`.
    //
    // declaresAgents / declaresMcp are required `boolean` predicates --
    // skipped outcomes do NOT render the soft-dep marker (MSG-SD-3), so the
    // value is `false`. Repeated on every static-skipped return below.
    return {
      partition: "skipped",
      name: plugin,
      notes: [`marketplace "${marketplace}" not found in ${scope} scope`],
      reasons: ["not in manifest"] as const,
      declaresAgents: false,
      declaresMcp: false,
    };
  }

  // UXG-08 / D-29-08/09: consult the marketplace manifest BEFORE concluding
  // "not installed". `loadCachedMarketplaceManifest` is the cached path (also
  // used below for the installed-but-absent case), so moving the load up adds
  // no net I/O. A plugin absent from BOTH state and manifest is a typo /
  // nonexistent name -- it must classify as `(failed) {not in manifest}` like
  // `install`, not the misleading `(skipped) {not installed}` that the
  // installed-state-first ordering produced.
  const manifest = await loadCachedMarketplaceManifest(mp.manifestPath);
  const entryRaw = manifest.plugins.find((p) => p.name === plugin);

  const record = mp.plugins[plugin];
  if (record === undefined) {
    if (entryRaw === undefined) {
      // Not installed AND absent from the manifest -> failed {not in manifest}
      // (matches install.ts's `not-in-manifest` arm). No `fromVersion` since
      // there is no install record to read a version from.
      return {
        partition: "failed",
        name: plugin,
        notes: ["not in manifest"],
        reasons: ["not in manifest"] as const,
        declaresAgents: false,
        declaresMcp: false,
      };
    }

    // In the manifest but not installed -> skipped {not installed}
    // (preserved behavior). No manifest-entry validation is needed here
    // because we return early without resolving the entry.
    return {
      partition: "skipped",
      name: plugin,
      notes: ["not installed"],
      reasons: ["not installed"] as const,
      declaresAgents: false,
      declaresMcp: false,
    };
  }

  if (entryRaw === undefined) {
    // Installed but no longer listed in the refreshed manifest -> skipped
    // {not in manifest} with the recorded `fromVersion` (preserved behavior).
    return {
      partition: "skipped",
      name: plugin,
      fromVersion: record.version,
      notes: ["not in manifest"],
      reasons: ["not in manifest"] as const,
      declaresAgents: false,
      declaresMcp: false,
    };
  }

  if (!PLUGIN_ENTRY_VALIDATOR.Check(entryRaw)) {
    return {
      partition: "skipped",
      name: plugin,
      fromVersion: record.version,
      notes: ["entry failed schema validation"],
      reasons: ["invalid manifest"] as const,
      declaresAgents: false,
      declaresMcp: false,
    };
  }

  const entry: PluginEntry = entryRaw;

  // PURL-06 / D-78-05: a git source (url / git-subdir / github) resolves its
  // pluginRoot through the clone-materializing probe -- pinned entries pin
  // source.sha, unpinned entries re-resolve remote HEAD at update time -- and
  // captures the resolved sha for the swap-or-not decision + the resolvedSha
  // state field. Path / github-name plugins keep the no-git-callback behavior
  // (the resolver derives their pluginRoot from marketplaceRoot).
  const clone = makeUpdateCloneProbe(
    args.cloneCacheSeam ?? {
      resolvePluginPin,
      materializePluginClone,
      materializeOrRefreshPluginMirror,
    },
    locations,
    {
      ...(args.ctx !== undefined && { ctx: args.ctx }),
      credentialOps: args.credentialOps ?? DEFAULT_CREDENTIAL_OPS,
      ...(args.deviceFlowHttp !== undefined && { deviceFlowHttp: args.deviceFlowHttp }),
      ...(args.authMemo !== undefined && { authMemo: args.authMemo }),
    },
  );

  const candidate = await resolveUpdateCandidate(entry, mp.marketplaceRoot, clone.probe, {
    plugin,
    fromVersion: record.version,
    partial: args.partial === true,
  });
  if ("partition" in candidate) {
    return candidate;
  }

  const installable: MaterializablePlugin = candidate;
  const fromVersion = record.version;

  // PURL-06 / D-78-05: for a git source with a captured sha, `toVersion` is
  // `shaVersion(pin)` so the existing `toVersion === fromVersion` short-circuit
  // below renders `(unchanged)` on an equal sha and swaps on a differing one.
  // Path / github-name plugins keep the 3-tier `resolvePluginVersion` ladder.
  const resolvedSha = clone.resolvedSha();
  const toVersion = await deriveUpdateToVersion(entry, installable, resolvedSha);
  if (toVersion === fromVersion) {
    // `(unchanged)` rows do not render the soft-dep marker either.
    return {
      partition: "unchanged",
      name: plugin,
      fromVersion,
      toVersion,
      declaresAgents: false,
      declaresMcp: false,
    };
  }

  return {
    state,
    record,
    entry,
    installable,
    fromVersion,
    toVersion,
    ...(resolvedSha !== undefined && { resolvedSha }),
  };
}

function isOutcome(value: PluginPreflight | PluginUpdateOutcome): value is PluginUpdateOutcome {
  return "partition" in value;
}

async function prepareUpdateHandles(
  args: ThreePhaseArgs,
  preflight: PluginPreflight,
  agentsSourceDir: string | null,
): Promise<PrepHandles> {
  const { plugin, marketplace, cwd, locations } = args;
  const { installable, record } = preflight;
  const pluginDataDir = await locations.pluginDataDir(marketplace, plugin);
  const handles: Partial<PrepHandles> = {};

  try {
    handles.skills = await prepareStageSkills({
      locations,
      marketplaceName: marketplace,
      pluginName: plugin,
      pluginRoot: installable.pluginRoot,
      pluginDataDir,
      resolved: installable,
      previousSkillNames: record.resources.skills,
    });
    handles.commands = await prepareStageCommands({
      locations,
      marketplaceName: marketplace,
      pluginName: plugin,
      pluginRoot: installable.pluginRoot,
      pluginDataDir,
      resolved: installable,
      previousCommandNames: record.resources.prompts,
    });
    handles.agents = await prepareStagePluginAgents({
      locations,
      marketplaceName: marketplace,
      pluginName: plugin,
      pluginRoot: installable.pluginRoot,
      pluginDataDir,
      resolved: installable,
      agentsSourceDir,
      // AG-7 opt-in: forward the direct-path `--map-model` setting. The
      // cascade entrypoint never sets `args.mapModel`, so cascade re-
      // installs always resolve to false (omit `model:`).
      mapModel: args.mapModel ?? false,
    });
    handles.mcp = await prepareStageMcpServers({
      locations,
      cwd,
      marketplaceName: marketplace,
      pluginName: plugin,
      servers: installable.mcpServers,
      sourcePath: `${installable.pluginRoot}#mcpServers`,
    });
  } catch (err) {
    throw appendLeaks(err, await abortPartialHandles(handles));
  }

  return handles as PrepHandles;
}

async function abortPartialHandles(handles: Partial<PrepHandles>): Promise<(string | undefined)[]> {
  const leaks: (string | undefined)[] = [];
  if (handles.mcp !== undefined) {
    abortPreparedMcp(handles.mcp);
  }

  if (handles.agents !== undefined) {
    leaks.push(await abortPreparedAgents(handles.agents));
  }

  if (handles.commands !== undefined) {
    await abortPreparedCommands(handles.commands);
  }

  if (handles.skills !== undefined) {
    await abortPreparedSkills(handles.skills);
  }

  return leaks;
}

async function abortHandles(handles: PrepHandles): Promise<(string | undefined)[]> {
  abortPreparedMcp(handles.mcp);
  const leaks = [await abortPreparedAgents(handles.agents)];
  await abortPreparedCommands(handles.commands);
  await abortPreparedSkills(handles.skills);
  return leaks;
}

// ─────────────────────────────────────────────────────────────────────────────
// TR-04: intent-mark + finalize helpers.
//
// Module-level constants:
//  - UPDATE_IN_PROGRESS_NOTE: the load-bearing marker text written into
//    `compatibility.notes` during the intent-mark window. A static string
//    keeps the cross-process contract simple to grep + assert; a future GC
//    sweeper can use `sRecord.updatedAt` (already in the schema) for
//    staleness.
//  - PHASE3_FAILURE_PHASES + Phase3Phase: closed-set tuple for the per-bridge
//    finalize gating. `Phase3Failure.phase` is already declared as the closed
//    union `"skills" | "commands" | "agents" | "mcp"` in shared/errors.ts, so
//    the tuple here is a runtime mirror of the type for explicit Set<Phase3Phase>
//    construction inside `finalizeUpdateRecord`. A future fifth bridge surfaces
//    here as a TS error.
//
// The intent-mark marker is internal-only: shared/notify.ts does not read
// `compatibility.notes`; the only extension consumer is reinstall.ts
// (record copy, not rendering), so no notify-rendering test is at risk.
// ─────────────────────────────────────────────────────────────────────────────

const UPDATE_IN_PROGRESS_NOTE = "update-in-progress";

// D-63-01: hooks slot lands between agents and mcp -- mirrors install.ts
// runPhases literal-array order.
const PHASE3_FAILURE_PHASES = ["skills", "commands", "agents", "hooks", "mcp"] as const;
type Phase3Phase = (typeof PHASE3_FAILURE_PHASES)[number];

/**
 * TR-04: pre-commit intent-mark.
 *
 * Runs INSIDE a `withStateGuard` BEFORE phase-3a commits begin. Re-reads
 * the per-marketplace per-plugin state record, performs the ST-9
 * stale-version check, and writes the intent-mark
 * `compatibility = { installable: false,
 * notes: [UPDATE_IN_PROGRESS_NOTE], supported: <carry-forward>,
 * unsupported: <carry-forward> }`.
 *
 * Cross-process contract: a SECOND process observing
 * `installable: false` + `notes: [UPDATE_IN_PROGRESS_NOTE]` MUST treat
 * this plugin as in-flight; the next `update` call from any process is
 * the recovery path. ST-9 lives here; `finalizeUpdateRecord` does NOT
 * re-check ST-9: a finalize-time ST-9 check would over-fire on the
 * legitimate same-process intent-mark -> commits -> finalize sequence
 * because intent-mark does not bump the version.
 *
 * `compatibility.supported` and `compatibility.unsupported` carry forward
 * UNCHANGED from the pre-update sRecord. They are the
 * truthful current view during the intent-mark window; `finalizeUpdateRecord`
 * rewrites them on the all-success branch.
 *
 * No mutation to `sRecord.version`, `sRecord.resources`, `sRecord.resolvedSource`,
 * or `sRecord.updatedAt` -- those are the finalize step's responsibility.
 */
async function markUpdateInProgress(
  args: ThreePhaseArgs,
  preflight: PluginPreflight,
): Promise<void> {
  const { plugin, marketplace, locations } = args;
  const { fromVersion } = preflight;
  await withStateGuard(locations, (s) => {
    const sMp = s.marketplaces[marketplace];
    if (sMp === undefined) {
      throw new Error(
        `Marketplace "${marketplace}" disappeared from state during update of "${plugin}".`,
      );
    }

    const sRecord = sMp.plugins[plugin];
    if (sRecord === undefined) {
      throw new Error(`Plugin "${plugin}" was concurrently uninstalled.`);
    }

    // ST-9: stale-version check.
    if (sRecord.version !== fromVersion) {
      throw new Error(
        `Plugin "${plugin}" was concurrently updated; expected version "${fromVersion}", found "${sRecord.version}".`,
      );
    }

    sRecord.compatibility = {
      installable: false,
      notes: [UPDATE_IN_PROGRESS_NOTE],
      // Carry forward from EXISTING sRecord, NOT from
      // preflight.installable -- the pre-update arrays are the truthful
      // view during the intent-mark window.
      supported: [...sRecord.compatibility.supported],
      unsupported: [...sRecord.compatibility.unsupported],
    };
  });
}

/**
 * TR-04: post-commit finalize.
 *
 * Runs INSIDE a SECOND `withStateGuard` AFTER phase-3a. Mutation policy
 * has TWO distinct failure semantics:
 *
 * 1. PER-BRIDGE (independent across bridges): for each of skills /
 *    commands / agents / mcp, if `!failedPhases.has(bridge)` then write
 *    `sRecord.resources.<schemaField> = handles.<bridge>.result.recorded
 *    .map(r => r.generatedName)`. SC#2: do NOT
 *    gate per-bridge writes on `phase3aFailures.length === 0`; the
 *    independent per-bridge gate is the load-bearing structural contract.
 *
 *    Bridge -> schema-field mapping (locked, per TR-03):
 *      skills    -> resources.skills
 *      commands  -> resources.prompts   (asymmetric, schema-locked)
 *      agents    -> resources.agents
 *      mcp       -> resources.mcpServers
 *
 * 2. ALL-OR-NOTHING (version bump + installable flip + resolvedSource):
 *    only when `phase3aFailures.length === 0`. On any failure the
 *    `compatibility` block stays at the intent-mark values
 *    (`installable: false`, `notes: [UPDATE_IN_PROGRESS_NOTE]`),
 *    `version` stays at `fromVersion`, and `resolvedSource` stays at
 *    the pre-update install path.
 *
 * `sRecord.updatedAt` is set on BOTH branches: even a failed finalize
 * is a truthful "we touched this record" stamp.
 */
/**
 * ENBL-02: same rule as `reconcile/plan.ts::isRecordedButDisabled`.
 * Duplicated here to avoid pulling the reconcile module into the orchestrator's
 * import graph; the planner is the canonical owner and this predicate is the
 * deliberate same-rule mirror (`enable-disable.ts::isCurrentlyDisabled` does
 * the same for its own reasons).
 */
function isRecordedButDisabled(
  record: ExtensionState["marketplaces"][string]["plugins"][string],
): boolean {
  return record.compatibility.installable && !record.enabled;
}

/**
 * D-UPD: refresh a disabled-but-recorded plugin's version pin + resolvedSource
 * inside a withStateGuard so a future `enable` re-materializes from the
 * current manifest. Resources.* stay empty (the plugin is still disabled).
 * The standalone-direct write-back (maybeWritePluginConfigBack) is
 * SKIPPED -- the config entry already exists by construction (the disabled
 * record only persists when the user explicitly disabled it), and writing
 * the byte-stable `{}` patch would touch state.json mtime via the SOLE
 * sanctioned save seam without changing user-visible bytes.
 */
async function refreshDisabledRecord(
  args: ThreePhaseArgs,
  preflight: PluginPreflight,
): Promise<void> {
  const { plugin, marketplace, locations } = args;
  const { installable, toVersion } = preflight;
  await withStateGuard(locations, (s) => {
    const sMp = s.marketplaces[marketplace];
    if (sMp === undefined) {
      return;
    }

    const sRecord = sMp.plugins[plugin];
    if (sRecord === undefined) {
      return;
    }

    sRecord.version = toVersion;
    sRecord.resolvedSource = installable.pluginRoot;
    sRecord.compatibility = {
      installable: true,
      notes: [...installable.notes],
      supported: [...installable.supported],
      unsupported: [...installable.unsupported],
    };
    sRecord.updatedAt = new Date().toISOString();
  });
}

async function finalizeUpdateRecord(
  args: ThreePhaseArgs,
  preflight: PluginPreflight,
  handles: PrepHandles,
  phase3aFailures: readonly Phase3Failure[],
): Promise<{ readonly invalidConfigWriteBack: boolean }> {
  const { plugin, marketplace, locations } = args;
  const { installable, toVersion, resolvedSha } = preflight;
  let invalidConfigWriteBack = false;
  // Per-bridge finalize is a sequence of independent `failedPhases.has(...)`
  // guards (one per cascade slot); the cognitive-complexity counter sums
  // each guard arm but the body is intentionally flat -- a helper extraction
  // would obscure the per-bridge orthogonality the SC#2 contract requires.
  // Mirrors the install.ts cognitive-complexity disable on installPlugin.
  // eslint-disable-next-line sonarjs/cognitive-complexity
  await withStateGuard(locations, async (s) => {
    const sMp = s.marketplaces[marketplace];
    if (sMp === undefined) {
      throw new Error(
        `Marketplace "${marketplace}" disappeared from state during finalize of "${plugin}".`,
      );
    }

    const sRecord = sMp.plugins[plugin];
    if (sRecord === undefined) {
      throw new Error(`Plugin "${plugin}" was concurrently uninstalled during finalize.`);
    }

    // Anchor the per-bridge gating against the runtime tuple of known
    // phases. The Set is initialized from PHASE3_FAILURE_PHASES so a
    // future fifth bridge would force an explicit tuple update before
    // landing here.
    const failedPhases = new Set<Phase3Phase>(
      phase3aFailures.map((f) => f.phase).filter((p) => PHASE3_FAILURE_PHASES.includes(p)),
    );

    // SC#2 per-bridge orthogonality: each successful bridge writes its
    // new generated names INDEPENDENTLY of other bridges' outcomes.
    // The commands -> prompts asymmetry is per TR-03.
    if (!failedPhases.has("skills")) {
      sRecord.resources.skills = handles.skills.result.recorded.map((r) => r.generatedName);
    }

    if (!failedPhases.has("commands")) {
      sRecord.resources.prompts = handles.commands.result.recorded.map((r) => r.generatedName);
    }

    if (!failedPhases.has("agents")) {
      sRecord.resources.agents = handles.agents.result.recorded.map((r) => r.generatedName);
    }

    if (!failedPhases.has("mcp")) {
      sRecord.resources.mcpServers = handles.mcp.result.recorded.map((r) => r.generatedName);
    }

    // LIFE-01 / WR-03: hooks-inventory toggle mirrors install.ts /
    // reinstall.ts but is now gated on hooks-phase success (per-bridge
    // orthogonality, matching the skills / commands / agents / mcp slots
    // above). When the hooks commit slot succeeded, write the slug based on
    // version B's hooks declaration (slug appears when installable.hooksConfigPath
    // !== undefined, empty when version B dropped hooks). When the hooks
    // commit failed (entry in phase3aFailures for "hooks"), do NOT update
    // the inventory -- the failed-state truthful view is "we did not complete
    // the swap" and the existing slug stays.
    if (!failedPhases.has("hooks")) {
      sRecord.resources.hooks = installable.hooksConfigPath === undefined ? [] : [plugin];
    }

    // SC#2 all-or-nothing: version bump + installable=true + resolvedSource
    // happen ONLY on the all-success path. On failure the intent-mark
    // `compatibility` set by `markUpdateInProgress` carries forward
    // (the truthful "we did not complete the swap" view).
    if (phase3aFailures.length === 0) {
      sRecord.version = toVersion;
      sRecord.compatibility = {
        installable: true,
        notes: [...installable.notes],
        supported: [...installable.supported],
        unsupported: [...installable.unsupported],
      };
      sRecord.resolvedSource = installable.pluginRoot;
      // PURL-06 / D-78-01: write the git-source commit identity so the
      // post-commit GC and the next update read the swapped sha. Undefined for
      // path / github-name sources (they have no clone and protect none).
      if (resolvedSha !== undefined) {
        sRecord.resolvedSha = resolvedSha;
      }
    }

    sRecord.updatedAt = new Date().toISOString();

    // WB-01 / A7: deep-equal short-circuited config write-back
    // on the all-success arm. SKIPPED in cascade mode (the marketplace
    // autoupdate cascade owns its own writes; mirrors WR-09 orchestrated-
    // mode semantics). The deep-equal gate compares the prospective
    // `{...existing, ...patch}` shape against the existing entry; the
    // current plugin entry shape carries no version field, so the patch
    // is `{}` and a CHANGED update with a byte-stable existing entry
    // produces a no-op (preserving RECON-05 mtime stability).
    if (!args.cascade && phase3aFailures.length === 0) {
      const writeResult = await maybeWritePluginConfigBack({
        locations,
        marketplace,
        plugin,
        local: args.local === true,
      });
      if (writeResult.invalidConfig) {
        invalidConfigWriteBack = true;
      }
    }

    // WR-06 + WR-03 + D-60-05: update does NOT delegate to install/
    // uninstall, so without an explicit cache+rebuild step the parsed-
    // config cache would still hold the PRE-update hooks config and
    // dispatch would fire the old command paths until `/reload`. Mirror
    // the install / uninstall pattern explicitly inside the existing
    // per-plugin lock: drop the old cache entry, repopulate from the
    // just-staged `hooks.json` (when present), then rebuild the routing
    // table once. The cache step ONLY runs on the all-success arm; an
    // aggregated phase-3 failure leaves the OLD config in place
    // (truthful "we did not complete the swap" view that mirrors the
    // SC#2 compatibility/resolvedSource decision above).
    //
    // Moved AFTER `maybeWritePluginConfigBack` so a write-back throw
    // aborts BEFORE the cache mutates -- tightens the WR-06 strand
    // window to just the `withStateGuard` auto-save tail.  A full close
    // would require exposing `tx.save()` from `withStateGuard` (a
    // larger refactor); a future phase can complete the restructure if
    // tx.save throws become observable in practice.
    if (phase3aFailures.length === 0) {
      removePluginConfigFromCache(args.scope, marketplace, plugin);
      if (installable.hooksConfigPath !== undefined) {
        await readAndCachePluginHooks({
          scope: args.scope,
          marketplace,
          plugin,
          resolvedSource: asAbsolutePluginRoot(installable.pluginRoot),
          hooksJsonPath: path.join(installable.pluginRoot, installable.hooksConfigPath),
          cwd: args.cwd,
          logPrefix: "update",
        });
      }

      rebuildRoutingTables();
    }
  });
  return { invalidConfigWriteBack };
}

// The three-phase update body sequences preflight, the D-UPD disabled-record
// fast path, prepare-handles, the intent-mark window, phase-3a per-bridge
// commits, finalize, the phase-3b aggregate error path, and the S5
// invalid-config write-back warning -- splitting it would require additional
// state-snapshot threading and obscure the per-phase save-vs-throw discipline.
// eslint-disable-next-line sonarjs/cognitive-complexity
async function runThreePhaseUpdate(args: ThreePhaseArgs): Promise<PluginUpdateOutcome> {
  const { plugin, marketplace, scope } = args;

  // ─── Pre-phase: resolve current vs new (PUP-3/4/5 short-circuits) ─────────

  const preflight = await preflightUpdate(args);
  if (isOutcome(preflight)) {
    return preflight;
  }

  const { installable, fromVersion, toVersion } = preflight;

  // D-UPD: a disabled-but-recorded plugin (empty resources.* + installable=true,
  // the same marker the planner reads via isRecordedButDisabled) must NOT
  // re-materialize artefacts; an `enable` after the update is the rematerialization
  // surface. Refresh the record's version + resolvedSource so a future enable
  // reads the current pin, but keep `resources.*` empty. Renders the existing
  // `unchanged` byte form -- the artefact state really is unchanged.
  if (isRecordedButDisabled(preflight.record)) {
    await refreshDisabledRecord(args, preflight);
    return {
      partition: "unchanged",
      name: plugin,
      fromVersion,
      toVersion: fromVersion,
      declaresAgents: false,
      declaresMcp: false,
    };
  }

  // ─── : prepare into tmp ────────────────────────────────────────────
  //
  // Bridge prepare* writes only under <extensionRoot>/<bridge>-staging/<uuid>/.
  // Sequential ordering -- skills -> commands -> agents -> mcp -- matches
  //  D-03 PU-1 order, but mcp's "prepare" is in-memory only (it
  // materializes the merged doc; commit writes mcp.json atomically).
  //
  // PI-6 cross-plugin guard: re-check generated names against the SAME-SCOPE
  // state EXCLUDING this plugin's currently-recorded resources -- updating
  // your own plugin against your own state must not count as cross-plugin
  // conflict (a plugin updating its skill names from {a,b} -> {a,c} would
  // otherwise self-conflict on "a").

  const generatedNames = await discoverGeneratedNames(plugin, installable);
  const stateForGuard = removePluginRecord(preflight.state, marketplace, plugin);
  assertNoCrossPluginConflicts(scope, generatedNames, stateForGuard);
  const handles = await prepareUpdateHandles(args, preflight, generatedNames.agentsSourceDir);

  // ─── Phase 2a: pre-commit intent-mark (TR-04) ─────────────────────────────
  //
  // The intent-mark window writes `compatibility.installable = false` +
  // `notes: [UPDATE_IN_PROGRESS_NOTE]` BEFORE phase-3a commits. ST-9
  // stale-version detection lives here. The intent-mark survives a process
  // crash mid-commit
  // so the next `/reload` + retry sees the truthful prior version and the
  // `RECOVERY_PLUGIN_REINSTALL_PREFIX` recovery hint is structurally mirrored
  // on disk.
  //
  // No version/resources/resolvedSource mutation in this window -- those
  // are the post-phase-3a `finalizeUpdateRecord` step's responsibility.

  try {
    await markUpdateInProgress(args, preflight);
  } catch (err) {
    // Intent-mark failure (typically ST-9 stale-version): abort all prep
    // handles + rethrow.
    throw appendLeaks(err, await abortHandles(handles));
  }

  // ─── Phase 3a: physical replace; aggregate failures across bridges ────────
  //
  // D-03 discipline: CONTINUE across bridge-commit failures (not fail-fast)
  // so the partial-replace state is fully observed. Phase3Failure entries
  // carry per-bridge cause references; the aggregate error wraps them.
  //
  // The four commits run in skills -> commands -> agents -> mcp order
  // (matching install's PI-9 order). Each commit is independently atomic
  // at the OS level (rename for skills/commands/agents; atomicWriteJson
  // for mcp).

  const phase3aFailures: Phase3Failure[] = [];

  try {
    const leak = await commitPreparedSkills(handles.skills);
    if (leak !== undefined) {
      phase3aFailures.push({
        phase: "skills",
        msg: `skills staging cleanup leak: ${leak}`,
        cause: new Error(leak),
      });
    }
  } catch (err) {
    phase3aFailures.push({ phase: "skills", msg: errorMessage(err), cause: err });
  }

  try {
    await commitPreparedCommands(handles.commands);
  } catch (err) {
    phase3aFailures.push({ phase: "commands", msg: errorMessage(err), cause: err });
  }

  try {
    const leak = await commitPreparedAgents(handles.agents);
    if (leak !== undefined) {
      phase3aFailures.push({
        phase: "agents",
        msg: `agents staging cleanup leak: ${leak}`,
        cause: new Error(leak),
      });
    }
  } catch (err) {
    phase3aFailures.push({ phase: "agents", msg: errorMessage(err), cause: err });
  }

  // LIFE-01 / D-63-01: 5th cascade slot. The hooks bridge has NO staging
  // dir (D-63-02) so the prepare/commit split does not apply -- writeHookConfig
  // IS the atomic write. Lives BETWEEN agents and mcp to mirror the install
  // Phase ledger order. D-03 fail-continue: a throw here lands in
  // phase3aFailures and the loop continues; recovery is via the
  // RECOVERY_PLUGIN_REINSTALL_PREFIX hint -- there is no in-process restore.
  //
  // WR-01: removeHookConfig() (version B drops hooks) is non-atomic --
  // `rm({recursive,force})` can throw partway and leave the hooks
  // subtree partially deleted. The `failedPhases.has("hooks")` guard at
  // finalize preserves the OLD `resources.hooks` inventory in
  // state.json, keeping the truthful "swap incomplete" view. The
  // /reload routing table will point at the partially-deleted file
  // until the user runs reinstall (RECOVERY_PLUGIN_REINSTALL_PREFIX
  // hint). Same recovery contract as reinstall.ts::commitHooks (see
  // WR-05).
  try {
    if (preflight.installable.hooksConfigPath === undefined) {
      // Version B has no hooks: remove any stale file from version A.
      await removeHookConfig({ locations: args.locations, pluginName: plugin });
    } else {
      const raw = await readFile(
        path.join(preflight.installable.pluginRoot, preflight.installable.hooksConfigPath),
        "utf8",
      );
      const ifCtx = { homedir: homedir(), cwd: args.cwd, projectRoot: args.cwd };
      const parsed = parseHooksConfig(raw, ifCtx, compileIfPredicate);
      if (!parsed.ok) {
        throw new Error(`hooks.json re-parse failed: ${parsed.reason}`);
      }

      await writeHookConfig({
        locations: args.locations,
        pluginName: plugin,
        pluginRoot: preflight.installable.pluginRoot,
        hooksValue: parsed.value,
      });
    }
  } catch (err) {
    phase3aFailures.push({ phase: "hooks", msg: errorMessage(err), cause: err });
  }

  try {
    await commitPreparedMcp(handles.mcp);
  } catch (err) {
    phase3aFailures.push({ phase: "mcp", msg: errorMessage(err), cause: err });
  }

  // ─── Phase 2b: finalize state (TR-04) ─────────────────────────────────────
  //
  // The finalize window writes per-bridge resource updates for every
  // bridge whose commit succeeded (independent of other bridges' outcomes),
  // and bumps `version` + `installable=true` + `resolvedSource` ONLY when
  // all four bridges succeeded.
  //
  // Order discipline: finalize MUST run BEFORE the phase-3b recovery-hint
  // emission. If finalize ran AFTER the recovery-hint emission on a success
  // path that flips to finalize-failure, the user would see a success
  // notification then a stale state -- worst of both worlds. The synthetic
  // 'mcp' push inside the finalize catch (below) trips the phase-3b branch
  // so the recovery hint fires.
  //
  // A finalize throw routes through `phase3aFailures` as a synthetic
  // `phase: "mcp"` entry so the existing
  // `notifyDirectFailure` recovery-hint pipeline fires unchanged. The
  // `msg` field carries the explicit `state finalize failed:` text so
  // operator diagnostics see the truthful cause. A dedicated
  // `phase: "finalize"` Phase3Failure member is deferred.
  let invalidConfigWriteBack = false;
  try {
    const finalizeResult = await finalizeUpdateRecord(args, preflight, handles, phase3aFailures);
    invalidConfigWriteBack = finalizeResult.invalidConfigWriteBack;
  } catch (finalizeErr) {
    phase3aFailures.push({
      phase: "mcp",
      msg: `state finalize failed: ${errorMessage(finalizeErr)}`,
      cause: finalizeErr,
    });
  }

  // ─── Phase 3b: aggregate error path with recovery hint, OR success ────────

  if (phase3aFailures.length > 0) {
    const recoveryHint = `${RECOVERY_PLUGIN_REINSTALL_PREFIX} "${plugin}".`;
    const aggregateMsg = `Plugin "${plugin}" update failed during physical replace. ${recoveryHint}`;
    const firstCause = phase3aFailures[0]?.cause;
    const aggregate = new PluginUpdatePhase3Error(
      aggregateMsg,
      phase3aFailures,
      aggregateCause(firstCause),
    );
    // PUP-9 direct path: surface the aggregate failure via a single
    // notify with a synthetic PluginFailedMessage carrying the typed
    // cause (Option B). Per the catalog UAT fixture
    // `failed-with-rollback-partial` (docs/output-catalog.md:510-522) the
    // renderer composes the 4-space cause-chain trailer beneath the
    // failed plugin row. The cascade is NOT re-rendered here -- aborting
    // before the cascade walk means there's exactly one row to surface.
    // NB: the renderer does NOT walk phase3aFailures structurally here
    // (rollbackPartial is the structural channel for that, but the
    // direct-path aggregate is itself a single failure summary; the
    // returned `partition: "failed"` outcome below provides the cascade
    // shape when reached through the cascade pathway).
    if (isDirectUpdate(args) && args.ctx !== undefined && args.pi !== undefined) {
      notifyDirectFailure({
        ctx: args.ctx,
        pi: args.pi,
        marketplace: args.marketplace,
        scope: args.scope,
        pluginName: args.plugin,
        err: aggregate,
        // Phase-3a aggregate failures map to the catalog "rollback partial"
        // reason form. Thread the per-phase rollback children structurally
        // so the renderer emits the indented 4-space child rows + 6-space
        // per-phase cause-chains.
        reasonOverride: "rollback partial" as const,
        rollbackPartial: phase3aFailures,
      });
    }

    // CMC-17 / MSG-RP-1: surface phaseFailures structurally
    // so the cascade renderer can build the rollback-partial parent +
    // indented children block. notes[] is retained for outcome-level text
    // aggregation (consumed by outcomeOnly callers and the cascade
    // post-render trailer).
    return {
      partition: "failed",
      name: plugin,
      fromVersion,
      toVersion,
      notes: [aggregateMsg, ...phase3aFailures.map((f) => `${f.phase}: ${f.msg}`)],
      // Pre-narrow to `{rollback partial}` -- phase-3 aggregate failures
      // always render as `(failed) {rollback partial}` per the catalog
      // (docs/output-catalog.md). The local `outcomeToCascadePluginMessage`
      // short-circuits on `phaseFailures.length
      // > 0` and ignores `reasons`; the marketplace cascade consumer
      // reads `reasons[0]` directly.
      reasons: ["rollback partial"] as const,
      phaseFailures: phase3aFailures.map((f) => ({ phase: f.phase, msg: f.msg })),
      // declaresAgents / declaresMcp are required `boolean`. `(failed)`
      // rows do not render the soft-dep marker.
      declaresAgents: false,
      declaresMcp: false,
    };
  }

  // PURL-06 / D-78-01: GC-after-swap. The finalize withStateGuard has committed
  // the new resolvedSha, so the OLD clone is now unreferenced iff no surviving
  // record maps to it; `garbageCollectPluginClones` derives live clone keys from
  // the persisted records and deletes the rest. Runs POST-commit (NFR-3
  // fail-clean: a crash between commit and delete just leaves an orphan the next
  // idempotent pass removes). Gated on a git-source swap (`preflight.resolvedSha`
  // set) so path / github-name updates add no cache sweep. Leaks are swallowed
  // (D-19-01): hygienic cleanup never becomes the primary path.
  if (preflight.resolvedSha !== undefined) {
    try {
      await garbageCollectPluginClones(args.locations);
    } catch {
      // D-19-01: a GC failure never fails the update; the next pass retries.
    }
  }

  // Success: WR-04 fields populated for cascade-side RH-5 composition.
  // CMC-13: declaresAgents / declaresMcp predicate inputs
  // mirror reinstall's effective-state contract (declares iff actually
  // staged this update). The renderer probes companion-loaded state via
  // SoftDepProbe and emits `{requires pi-subagents}` / `{requires pi-mcp}`
  // iff (declares AND unloaded).
  const stagedAgents = handles.agents.result.recorded.map((r) => r.generatedName);
  const stagedMcpServers = handles.mcp.result.recorded.map((r) => r.generatedName);
  await dropPluginCompletionCache(args);
  // S5: an invalid config file silently skipped the write-back while the
  // success notify proceeded. Direct-path callers now surface the abort as a
  // separate warning notification AFTER the success row so the user knows
  // the on-disk artefacts were updated but the config entry was not written.
  // The cascade path never calls the write-back (gated by `!args.cascade`),
  // so it is structurally unaffected.
  if (
    invalidConfigWriteBack &&
    isDirectUpdate(args) &&
    args.ctx !== undefined &&
    args.pi !== undefined
  ) {
    const targetBasename = path.basename(
      args.local === true ? args.locations.configLocalJsonPath : args.locations.configJsonPath,
    );
    notifyWithContext(args.ctx, args.pi, UPDATE_CONTEXT, [
      {
        name: marketplace,
        scope,
        plugins: [
          {
            status: "failed",
            name: plugin,
            reasons: ["invalid manifest"] as const,
            cause: new Error(`Config file "${targetBasename}" failed schema validation.`),
            // D-03/D-06: invalid-config abort -> error, no reload.
            severity: "error" as const,
            needsReload: false,
          },
        ],
      },
    ]);
  }

  return {
    partition: "updated",
    name: plugin,
    fromVersion,
    toVersion,
    stagedAgents,
    stagedMcpServers,
    declaresAgents: stagedAgents.length > 0,
    declaresMcp: stagedMcpServers.length > 0,
    // FSTAT-07 / D-66-04: a `--partial` update whose candidate re-resolved
    // `partially-available` degraded it -- carry the dropped kinds so the cascade
    // renders `(partially-installed)` instead of `(updated)`. Empty for a clean
    // candidate (FSTAT-03 -- no lingering partial state).
    //
    // SEV-03 / D-69-01: `newlyDegraded` records whether this degrade NEWLY
    // introduced partial state -- the PERSISTED `compatibility.unsupported` read
    // from the prior install record (`preflight.record`, loaded BEFORE the
    // update applied) was empty. The autoupdate cascade renderer reads it to
    // raise the row to `warning` (newly degraded) vs `info` (already degraded);
    // the manual `update --partial` renderer ignores it (explicit opt-in stays
    // info). No schema change -- the field already exists on the record.
    ...(installable.state === "partially-available" && {
      partialDegrade: {
        kinds: [...installable.unsupported],
        newlyDegraded: preflight.record.compatibility.unsupported.length === 0,
      },
    }),
  };
}

async function dropPluginCompletionCache(args: ThreePhaseArgs): Promise<void> {
  try {
    await dropMarketplaceCache(
      await args.locations.pluginCacheFile(args.marketplace),
      args.scope,
      args.marketplace,
    );
  } catch {
    // Per D-19-01 direct-path completion-cache-refresh warnings are
    // swallowed silently. The cache-refresh side effect still fires
    // above; only the user-visible standalone-mode warning surface is
    // gone. The cascade path is unaffected (no separate warning emission
    // in cascade mode).
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Cascade construction (CMC-26). notify()'s content-derived severity and
// reload-hint drive the dispatch; the renderer in shared/notify.ts owns every
// rendering concern (icon, version arrow, reasons brace, reload-hint,
// rollback-partial children).
// ─────────────────────────────────────────────────────────────────────────────

interface TargetedOutcome {
  readonly target: ResolvedTarget;
  readonly outcome: PluginUpdateOutcome;
}

/**
 * SEV-04 / D-69-02: severity for a `skipped` update row. An absent-target skip
 * (`not installed` / `not found`) is always error (D-01). A partially-upgradable
 * decline (`no longer installable`, no `--partial`) follows the invocation shape:
 * a targeted `<plugin>@<marketplace>` update the user explicitly opted into is
 * actionable -> warning; a bulk / untargeted update that skips one the user did
 * not name is benign -> info. This threads the EXISTING `cardinality`
 * invocation-shape signal -- no inference from cascade shape. All OTHER
 * non-idempotent reasons keep the producer-local `skipSeverity` judgment, so the
 * change is surgical to the partially-upgradable decline.
 */
function cascadeSkipSeverity(
  reasons: readonly ContentReason[],
  cardinality: "single" | "plural",
): "info" | "warning" | "error" {
  if (reasons.includes("not installed") || reasons.includes("not found")) {
    return "error";
  }

  if (reasons.includes("no longer installable")) {
    return cardinality === "single" ? "warning" : "info";
  }

  return skipSeverity(reasons);
}

/**
 * Project a `skipped` outcome to its cascade row. Split out of
 * `outcomeToCascadePluginMessage` so the parent switch stays within the
 * cognitive-complexity budget.
 *
 * XSURF-03: the partially-upgradable manual update-decline (`outcome.partialUpgradable`)
 * flips to the `partially-upgradable` token (consistent with how `list` describes
 * the same plugin) + the update-worded `--partial` trailer. The SEV-04 split
 * (targeted=warning / bulk=info) moves onto this status arm directly -- it is no
 * longer keyed on the reason string (the reason now carries the list-consistent
 * degrade kinds, not `no longer installable`). Every other skipped reason keeps
 * `status: "skipped"` + the unchanged `cascadeSkipSeverity` judgment.
 */
function projectSkippedOutcome(
  target: ResolvedTarget,
  outcome: PluginUpdateSkippedOutcome,
  cardinality: "single" | "plural",
): UpdateMsg {
  // Producer-narrowed `outcome.reasons` (CR-06) takes precedence over the
  // legacy notes-substring parse; empty `reasons` opts into the back-compat
  // fallback path.
  const reasons = outcome.reasons.length > 0 ? outcome.reasons : narrowSkipReasons(outcome.notes);
  const version =
    outcome.fromVersion !== undefined && outcome.fromVersion !== ""
      ? { version: outcome.fromVersion }
      : {};

  if (outcome.partialUpgradable === true) {
    return {
      status: "partially-upgradable",
      name: outcome.name,
      scope: target.scope,
      ...version,
      reasons,
      partialHint: true,
      severity: cardinality === "single" ? "warning" : "info",
      needsReload: false,
    };
  }

  return {
    status: "skipped",
    name: outcome.name,
    scope: target.scope,
    ...version,
    reasons,
    // D-01: an absent-target update (the named plugin is not installed / not
    // found) cannot be carried out -> error (severity-only flip; the `(skipped)
    // {not installed}` per-row grammar is preserved). Otherwise the
    // benign/idempotent case stays info; an actionable (targeted) decline routes
    // to warning (SEV-04); never reloads.
    severity: cascadeSkipSeverity(reasons, cardinality),
    needsReload: false,
  };
}

/**
 * Map an outcome to a `PluginNotificationMessage`. Returns `undefined`
 * for outcomes the cascade should skip rendering entirely (currently
 * none -- the `unchanged` partition maps to a `(skipped) {up-to-date}`
 * cascade row per the catalog).
 *
 * Per-partition mapping (mirrors marketplace/update.ts:446 precedent):
 *  - updated -> PluginUpdatedMessage ({ from, to, dependencies })
 *  - unchanged -> PluginSkippedMessage (reasons: ["up-to-date"])
 *  - skipped -> PluginSkippedMessage (reasons from producer or notes-fallback)
 *  - failed -> PluginFailedMessage (reasons + cause? + rollbackPartial?)
 *
 * Plugin scope is forwarded so the renderer's orphan-fold
 * can suppress the redundant `[<scope>]` bracket when plugin.scope ===
 * mp.scope. `cardinality` drives the SEV-04 targeted-vs-bulk decline severity.
 */
function outcomeToCascadePluginMessage(
  target: ResolvedTarget,
  outcome: PluginUpdateOutcome,
  probe: SoftDepStatus,
  cardinality: "single" | "plural",
): UpdateMsg {
  // SEV-01: an otherwise-successful update whose DECLARED soft-dep companion is
  // unloaded silently degrades a clean update -> raise the desired-state
  // severity from info to warning (symmetric with the install success arm).
  const successSeverity = companionSeverity(
    { declaresAgents: outcome.declaresAgents, declaresMcp: outcome.declaresMcp },
    probe,
  );
  switch (outcome.partition) {
    case "updated":
      // FSTAT-07 / D-66-04: a `--partial` update whose candidate re-resolved
      // `partially-available` degraded it -- report `(partially-installed)` with the
      // dropped-component detail instead of `(updated)`. This reads the LIVE
      // candidate resolution of the just-completed update -- NOT the persisted
      // `compatibility.unsupported` record the `list` / non-path `info`
      // derivers read; they agree here only because the update just wrote that
      // record. A clean candidate keeps `(updated)` (FSTAT-03 -- no lingering
      // partial state). partially-installed is a realized transition
      // (TRANSITION_STATUS_LIST), so it stamps the same info-severity + reload
      // as the updated row. WR-03: thread `dependencies` (the same
      // declared-kinds gate the `(updated)` row uses) so the soft-dep
      // `{requires pi-subagents}` / `{requires pi-mcp}` markers fire on a
      // degraded update exactly as on a clean one.
      if (outcome.partialDegrade !== undefined && outcome.partialDegrade.kinds.length > 0) {
        return {
          status: "partially-installed",
          name: outcome.name,
          scope: target.scope,
          version: outcome.toVersion,
          dependencies: outcomeDependencies(outcome.declaresAgents, outcome.declaresMcp),
          reasons: narrowUnsupportedKinds(outcome.partialDegrade.kinds),
          // SEV-01: info, raised to warning on a missing declared companion.
          severity: successSeverity,
          needsReload: true,
        };
      }

      return {
        status: "updated",
        name: outcome.name,
        scope: target.scope,
        from: outcome.fromVersion,
        to: outcome.toVersion,
        // declared kinds drive the renderer-time soft-dep
        // marker (MSG-SD-3). The renderer narrows on `dependencies`
        // membership + the notify-time probe.
        dependencies: outcomeDependencies(outcome.declaresAgents, outcome.declaresMcp),
        // D-03/D-06: realized update transition -> reloads Pi resources.
        // SEV-01: info, raised to warning above on a missing declared companion.
        severity: successSeverity,
        needsReload: true,
      };
    case "unchanged":
      // Catalog `all-up-to-date-noop` (docs/output-catalog.md:528-532):
      // unchanged renders as `(skipped) {up-to-date}`.
      return {
        status: "skipped",
        name: outcome.name,
        scope: target.scope,
        reasons: ["up-to-date"],
        // D-03/D-06: an `up-to-date` no-op is benign -> info, no reload.
        severity: "info",
        needsReload: false,
      };
    case "skipped":
      return projectSkippedOutcome(target, outcome, cardinality);

    case "failed": {
      const phaseFailures = outcome.phaseFailures ?? [];
      const hasPhaseFailures = phaseFailures.length > 0;
      const reasons: readonly ContentReason[] = hasPhaseFailures
        ? (["rollback partial"] as const)
        : (outcome.reasons ?? narrowFailReasons(outcome.notes));
      // carve-out: PluginFailedMessage has NO `from`/`to` fields
      // (only the `updated` variant carries them). The renderer emits at
      // most the bare `version?` token, so we surface only the
      // pre-update version (`fromVersion`) when available -- the catalog
      // form `failed-with-rollback-partial` (510-522) renders
      // `⊘ delta v1.0.0 (failed) {rollback partial}` using the old
      // version.
      const version = outcome.fromVersion;
      const base: PluginFailedMessage = {
        status: "failed",
        name: outcome.name,
        scope: target.scope,
        reasons,
        ...(version !== undefined && version !== "" && { version }),
        ...(outcome.cause !== undefined && { cause: outcome.cause }),
        // D-03/D-06: a failed update -> error, no reload (the rollbackPartial
        // spread below inherits these).
        severity: "error",
        needsReload: false,
      };
      if (!hasPhaseFailures) {
        return base;
      }

      // Catalog `failed-with-rollback-partial` (docs/output-catalog.md:510-522):
      // the renderer composes ` [<phase>] (rollback failed)` at 4-space
      // indent followed by the optional 6-space-indent per-phase cause-chain
      // . `UpdatePhaseFailure` carries `msg: string` (and the
      // underlying `Phase3Failure.cause` carries an `unknown` cause); the
      // outcome's `phaseFailures` is pre-narrowed to `{phase, msg}` only,
      // so synthesize an Error from the typed msg to feed the cause-chain
      // walker caveat fallback.
      return {
        ...base,
        rollbackPartial: phaseFailures.map((p) => ({
          phase: p.phase,
          // `UpdatePhaseFailure` discards the original `Phase3Failure.cause`
          // (it's typed `unknown` and never threaded into the outcome
          // shape); synthesize a typed Error from `msg` so the renderer's
          // 6-space-indent cause-chain walker has structured input.
          ...(p.msg !== "" && { cause: new Error(p.msg) }),
        })),
      };
    }

    default:
      // exhaustiveness guard for PluginUpdateOutcome's
      // discriminated union; any future partition must update this switch.
      return assertNever(outcome);
  }
}

/** Derive the v2 Dependency[] tuple from the outcome's declared kinds. */
function outcomeDependencies(declaresAgents: boolean, declaresMcp: boolean): readonly Dependency[] {
  return [
    ...(declaresAgents ? (["agents"] as const) : []),
    ...(declaresMcp ? (["mcp"] as const) : []),
  ];
}

/**
 * Build the cascade payload and emit via a single notify(ctx, pi, ...) call.
 *
 * Marketplace blocks are grouped by (scope, marketplace) per CMC-21 and
 * sorted via compareByNameThenScope before emission so the renderer's
 * caller-order honored discipline preserves alphabetic ordering.
 *
 * Severity (`error` / `warning` / info) is computed by notify per
 * ; reload-hint trailer is appended by notify; the
 * per-row soft-dep marker is injected by the renderer
 * . Orchestrator MUST NOT compose any of these.
 */
function renderUpdateCascadeAndNotify(
  ctx: ExtensionContext,
  pi: ExtensionAPI,
  outcomes: readonly TargetedOutcome[],
  cardinality: "single" | "plural",
  // WR-01: set on the phase-3a abort path. The failing plugin fired its own
  // failure notification and is absent from `outcomes`, so the never-silent
  // no-op headline must be suppressed here -- otherwise an all-`unchanged`
  // accumulator emits a contradictory `nothing to update` line right after the
  // failure. The empty/suppressed body renders nothing, which is acceptable
  // since the failure was already reported.
  abortedByFailure = false,
): void {
  // Group by (scope, marketplace) per CMC-21. Insertion order tracks the
  // first occurrence of each (scope, marketplace) pair -- the post-grouping
  // sort below restores alphabetic-by-name then project-before-user
  // (MSG-GR-3) ordering across marketplaces, while plugin rows within a
  // marketplace stay in caller order.
  interface MpGroup {
    readonly name: string;
    readonly scope: Scope;
    readonly plugins: UpdateMsg[];
  }
  // SEV-01: single companion probe per notify invocation, threaded into every
  // per-row mapping so the success arms can raise severity on a missing
  // declared companion (mirrors the renderer's single-probe discipline).
  const probe = softDepStatus(pi);

  // UGRM-02 / D-04: the headline counts realized transitions ONLY. The `updated`
  // partition holds both clean `(updated)` rows AND partially-installed degraded
  // updates (the partially-installed arm is emitted from `case "updated"`), so a
  // single partition filter captures every realized transition. A
  // `partially-upgradable` decline is partition `skipped`, so it contributes 0
  // (correct). Derived BEFORE row suppression -- independent of UGRM-01
  // filtering.
  const updatedCount = outcomes.filter((o) => o.outcome.partition === "updated").length;

  const byMp = new Map<string, MpGroup>();
  for (const { target, outcome } of outcomes) {
    // UGRM-01 suppression (Site A -- at the orchestrator, NOT the renderer): a
    // BULK (`plural`) update does not render a per-plugin `(skipped)
    // {up-to-date}` row for each unchanged plugin. The single-target path is
    // untouched (a user who named one plugin still sees its up-to-date skip
    // row). Only the `unchanged` partition is suppressed; a `skipped`-partition
    // row (e.g. the `partially-upgradable` decline) survives into the cascade.
    if (cardinality === "plural" && outcome.partition === "unchanged") {
      continue;
    }

    const key = `${target.scope}:${target.marketplace}`;
    // WR-01: mirror the reinstall.ts:597-610 get-existing-or-construct-new
    // shape so the in-place mutation invariant does not rely on the
    // get-then-conditional-set pattern (which was correct but obscured the
    // intent -- a future refactor that converted the conditional set to an
    // unconditional one would silently break the second-iteration mutation
    // path).
    const existing = byMp.get(key);
    if (existing === undefined) {
      byMp.set(key, {
        name: target.marketplace,
        scope: target.scope,
        plugins: [outcomeToCascadePluginMessage(target, outcome, probe, cardinality)],
      });
    } else {
      existing.plugins.push(outcomeToCascadePluginMessage(target, outcome, probe, cardinality));
    }
  }

  // Sort marketplace blocks via compareByNameThenScope (orchestrator
  // controls iteration order; notify does not sort). The comparator's
  // `Sortable` shape requires only `name` + `scope`.
  // OUT-07 / D-12: the update cascade is a bulk op, so its row slot is typed
  // `Plural<Row>` (a readonly array). Additive typing only -- a fresh
  // variable-length array, identical at runtime.
  // WR-01: the grouped plugin rows are accumulated through the
  // `outcomeToCascadePluginMessage` helper, now typed to `UpdateMsg`, so the
  // `MarketplaceRows<UpdateMsg>` annotation holds without a cast -- a status
  // drift between the producer and the render map is a compile error here.
  const marketplaces: Plural<MarketplaceRows<UpdateMsg>> = [...byMp.values()]
    // UGRM-01: drop a marketplace group emptied by suppression so no bare
    // `● mp [scope]` header renders (a group only reaches zero rows if every one
    // of its plugins was an `unchanged` suppression; the loop `continue` already
    // prevents creating one, this is the belt-and-braces guard).
    .filter((g) => g.plugins.length > 0)
    .sort((a, b) =>
      compareByNameThenScope({ name: a.name, scope: a.scope }, { name: b.name, scope: b.scope }),
    )
    .map((g) => ({
      name: g.name,
      scope: g.scope,
      plugins: g.plugins,
    }));

  // cascade construction recipe (mirrors the recipe at
  // orchestrators/plugin/uninstall.ts; substitutes the
  // version-arrow cascade variant set).
  // - One MarketplaceNotificationMessage per affected (scope, marketplace)
  //  group, emitted via a single notify(ctx, pi,...) call per
  //  orchestration.
  // - plugins: readonly PluginNotificationMessage[] carries the
  //  PluginUpdatedMessage (status "updated" with required from/to per
  // ) / PluginSkippedMessage (status "skipped" with required
  //  reasons) / PluginFailedMessage (status "failed" with required
  //  reasons + optional cause + optional rollbackPartial) variants.
  //  The renderer composes the version-arrow `<from> → v<to>` with the
  //  asymmetric `v` prefix on `to` only per docs/output-catalog.md:499.
  // - Severity and `/reload to pick up changes` trailer are computed by
  //  notify from the variant set.
  // - Reference: catalog UAT plugin-update fixtures at
  //  docs/output-catalog.md:489-568 (single-mp-mixed, failed-with-
  //  rollback-partial, all-up-to-date-noop, bare-multi-mp,
  //  same-mp-both-scopes).
  // UGRM-01 / UGRM-02: detect the zero-realized-transition bulk case -- a
  // `plural` update that updated nothing AND has no surviving error/warning row.
  // This covers BOTH an empty post-suppression cascade (all up-to-date) and a
  // non-empty cascade whose only rows are benign info skips (e.g. the
  // `partially-upgradable` decline). The surviving severities are the caller-stamped
  // per-row `severity` fields (undefined defaults to info).
  const hasErrorOrWarningRow = marketplaces.some((mp) =>
    mp.plugins.some((p) => p.severity === "error" || p.severity === "warning"),
  );
  if (
    cardinality === "plural" &&
    updatedCount === 0 &&
    !hasErrorOrWarningRow &&
    !abortedByFailure
  ) {
    // Never-silent no-op headline. `emitUpdateNoOpCascade` renders the surviving
    // body (empty for all-up-to-date) and folds the hard-coded `Plugin update:
    // nothing to update` line below it. The line can NEVER vanish (a
    // `tally {count: 0}` override would collapse to `""` in composeTally; this
    // owns the headline instead). Info severity, no reload-hint.
    notifyUpdateNoOpWithContext(ctx, pi, UPDATE_CONTEXT, marketplaces);
    return;
  }

  // WR-01: on the phase-3a abort path the failure is already reported and the
  // no-op headline is suppressed above. If suppression also emptied the cascade
  // body (every accumulated predecessor was `unchanged`), there is nothing left
  // to render -- emit nothing rather than routing an empty `marketplaces` through
  // `notifyUpdateWithContext`, which would render `(no marketplaces)`.
  if (abortedByFailure && marketplaces.length === 0) {
    return;
  }

  // OUT-04 / D-04 / UGRM-02: the trailing per-operation tally renders only for
  // the bulk (`@marketplace` / bare) update forms; a single-target
  // `<plugin>@<mp>` update omits it (the row embeds the outcome). The structural
  // single-vs-plural signal is the invocation FORM, threaded from
  // `updatePlugins`. The updates-only `tally` override owns the success category
  // (realized transitions only); failure/warning categories still come from the
  // rows, so a mixed cascade renders `Plugin update: 1 failure, 1 updated`. On a
  // single-target update the override is unread (`composeTally` returns "" for
  // `cardinality !== "plural"`).
  notifyUpdateWithContext(ctx, pi, UPDATE_CONTEXT, marketplaces, cardinality, {
    verb: "updated",
    count: updatedCount,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// direct-path failure helper. The direct-path failure sites
// (enumerate-targets / syncCloneOnce / runThreePhaseUpdate / phase-3
// aggregate) consolidate through this helper. Per Option B, each
// site emits a synthetic PluginFailedMessage carrying the typed `cause`
// so the renderer composes the 4-space cause-chain trailer.
// ─────────────────────────────────────────────────────────────────────────────

interface NotifyDirectFailureArgs {
  readonly ctx: ExtensionContext;
  readonly pi: ExtensionAPI;
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
   * aggregate path. Each entry's `msg` is wrapped in a synthesized Error
   * so the renderer's 6-space-indent cause-chain walker has structured
   * input (the underlying Phase3Failure.cause is `unknown` and discarded
   * earlier in the pipeline; this preserves the cause-text via the
   * msg field).
   */
  readonly rollbackPartial?: readonly Phase3Failure[];
}

function notifyDirectFailure(args: NotifyDirectFailureArgs): void {
  const { ctx, pi, marketplace, scope, pluginName, err } = args;
  const cause = err instanceof Error ? err : new Error(String(err));
  const reasons: readonly ContentReason[] = [args.reasonOverride ?? narrowDirectFailReason(cause)];
  // WR-05: row-level `scope` is OMITTED -- it always matched the
  // marketplace block's `scope` at every callsite below, and
  // `renderScopeBracket` (shared/notify.ts) suppresses the bracket in
  // that case. Aligning on the omit convention (matching uninstall.ts,
  // reinstall.ts, and install.ts's IN-04 commentary at lines 936-944)
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
  notifyWithContext(ctx, pi, UPDATE_CONTEXT, [
    {
      name: marketplace,
      scope,
      plugins: [failedRow],
    },
  ]);
}

/**
 * Coerce a `Phase3Failure.cause` (typed `unknown`) into the optional
 * `{ cause?: Error }` slot consumed by `PluginFailedMessage.rollbackPartial`.
 * Prefers the typed Error when present; falls back to synthesizing a typed
 * Error from `msg` caveat so the renderer's 6-space-indent
 * cause-chain walker has structured input. Returns the empty object when
 * neither is available (caller spreads it via `...`).
 */
function rollbackPartialCauseSlot(p: Phase3Failure): { readonly cause?: Error } {
  if (p.cause instanceof Error) {
    return { cause: p.cause };
  }

  if (p.msg !== "") {
    return { cause: new Error(p.msg) };
  }

  return {};
}

/**
 * Narrow a direct-path failure's typed error to a closed-set `Reason` for
 * the synthetic `PluginFailedMessage`. Order: instanceof typed errors
 * first, errno-bearing FS errors second, message-substring fallback last.
 * The fallback `"unreadable manifest"` mirrors the marketplace/update.ts
 * narrowFailReason precedent for unknown error shapes.
 */
function narrowDirectFailReason(err: Error): ContentReason {
  // Phase-3 aggregate failures are surfaced via reasonOverride; here we
  // handle the enumerate / syncClone / phase-2 paths only.
  if (err instanceof PluginShapeError) {
    // IN-03: add `default: assertNever(err.shape)` for compile-time
    // exhaustiveness against the `PluginShapeError.shape.kind`
    // discriminator. Mirrors install.ts +
    // outcomeToCascadePluginMessage default-arm precedent. Without this
    // a future 5th shape kind would silently fall through to the errno-
    // substring branch below and surface as `unreadable manifest` --
    // masking a class of errors that should have a precise mapping.
    switch (err.shape.kind) {
      case "no-longer-installable":
      case "not-installable":
        return "no longer installable";
      case "not-in-manifest":
      case "already-installed":
        return "not in manifest";
      default:
        return assertNever(err.shape);
    }
  }

  const code = (err as NodeJS.ErrnoException).code;
  if (code === "EACCES" || code === "EPERM") {
    return "permission denied";
  }

  if (code === "ENOENT" || code === "ENOTDIR") {
    return "source missing";
  }

  // Message-substring fallback. Mirrors marketplace/update.ts:553-580
  // narrowFailReason classification ladder, scoped to the direct-path
  // failure modes (enumerate target / syncClone / phase-2 throw).
  const text = err.message.toLowerCase();
  if (text.includes("not found")) {
    return "not found";
  }

  if (text.includes("rollback")) {
    return "rollback partial";
  }

  if (text.includes("concurrently uninstalled") || text.includes("concurrently removed")) {
    return "concurrently uninstalled";
  }

  if (text.includes("concurrently updated")) {
    return "concurrently updated";
  }

  if (text.includes("network")) {
    return "network unreachable";
  }

  if (text.includes("unparseable") || text.includes("invalid")) {
    return "invalid manifest";
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
  readonly ctx: ExtensionContext;
  readonly pi: ExtensionAPI;
  readonly scope: Scope | undefined;
  readonly err: unknown;
}): void {
  const { ctx, pi, scope, err } = args;
  const cause = err instanceof Error ? err : new Error(String(err));
  const reasons: readonly ContentReason[] = [narrowDirectFailReason(cause)];
  // WR-05: row-level `scope` is OMITTED -- the marketplace block carries
  // the same scope, and `renderScopeBracket` suppresses the per-row
  // bracket in that case. Matches the omit convention used by
  // uninstall.ts / reinstall.ts / install.ts (IN-04).
  const failedRow: PluginFailedMessage = {
    status: "failed",
    name: SYNTHETIC_UPDATE_PLACEHOLDER_NAME,
    reasons,
    cause,
    // D-03/D-06: bare-form enumerate failure -> error, no reload.
    severity: "error",
    needsReload: false,
  };
  notifyWithContext(ctx, pi, UPDATE_CONTEXT, [
    {
      name: SYNTHETIC_UPDATE_PLACEHOLDER_NAME,
      scope: scope ?? "user",
      plugins: [failedRow],
    },
  ]);
}

/**
 * WR-05: synthetic placeholder for the bare-form enumerate-failure path.
 * Held as a module-level constant so a future change has a single edit
 * point. Mirrors the `"(reinstall)"` precedent in
 * `orchestrators/plugin/reinstall.ts`.
 */
const SYNTHETIC_UPDATE_PLACEHOLDER_NAME = "(update)";

// The renderer (shared/notify.ts) owns version-arrow composition via the
// PluginUpdatedMessage's required from/to fields.

function narrowSkipReasons(notes: readonly string[] | undefined): readonly ContentReason[] {
  if (notes === undefined || notes.length === 0) {
    return [];
  }

  return [narrowSkipReason(notes[0] ?? "")];
}

function narrowSkipReason(note: string): ContentReason {
  if (note === "not installed") {
    return "not installed";
  }

  if (note === "not in manifest") {
    return "not in manifest";
  }

  if (note === "up-to-date") {
    return "up-to-date";
  }

  // PUP-4 path: "Plugin "...." is no longer installable: <cause>" -> closed
  // Reason "no longer installable".
  if (note.includes("no longer installable") || note.includes("not installable")) {
    return "no longer installable";
  }

  if (note.includes("entry failed schema validation")) {
    return "invalid manifest";
  }

  return "not in manifest";
}

function narrowFailReasons(notes: readonly string[] | undefined): readonly ContentReason[] {
  if (notes === undefined || notes.length === 0) {
    return [];
  }

  return [narrowFailReason(notes[0] ?? "")];
}

function narrowFailReason(note: string): ContentReason {
  if (note.includes("rollback")) {
    return "rollback partial";
  }

  if (note.includes("concurrently uninstalled") || note.includes("concurrently removed")) {
    return "concurrently uninstalled";
  }

  if (note.includes("concurrently updated")) {
    return "concurrently updated";
  }

  return "not in manifest";
}

function aggregateCause(firstCause: unknown): { cause: unknown } | undefined {
  return firstCause === undefined ? undefined : { cause: firstCause };
}

function isDirectUpdate(args: ThreePhaseArgs): boolean {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-boolean-literal-compare -- keeps Sonar S7735 from flagging an inverted boolean condition at the callsite.
  return args.cascade === false;
}

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
  // standalone `{not added}` variant -- instead of the former raw
  // `Error`/`MarketplaceNotFoundError` -> `{not found}` misattribution (M10/M11).
  const resolved = await resolveUpdateMarketplaceScope(cwd, mpName, target, explicitScope);
  const state = await loadState(resolved.locations.extensionRoot);
  const mp = state.marketplaces[mpName];
  if (mp === undefined) {
    // Defensive: `resolveUpdateMarketplaceScope` only returns a scope whose
    // container it confirmed present. A miss here is a concurrent-removal edge;
    // signal it as not-added carrying the resolved scope so the standalone
    // emission still fires (never a raw throw escaping the orchestrator).
    throw new MarketplaceNotAddedSignal(mpName, explicitScope);
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
 *    `{not added}` carrying the REQUESTED scope (SCOPE-01).
 *  - MARKETPLACE form: consume the discriminated `resolveInstalledMarketplaceTarget`
 *    result directly; `marketplace-absent`/`other-scope` signal `{not added}`
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
  throw new MarketplaceNotAddedSignal(mpName, resolution.requestedScope);
}

async function loadCachedMarketplaceManifest(
  manifestPath: string,
): Promise<{ name: string; plugins: readonly PluginEntry[] }> {
  return loadMarketplaceManifest(manifestPath);
}

/**
 * PI-6 cross-plugin guard helper. Returns a shallow-cloned state with the
 * (marketplace, plugin) record removed -- so the guard counts this plugin's
 * OWN current resources as "not yet owned" and only catches conflicts
 * against OTHER plugins.
 *
 * Shallow-clone discipline: deep-clone only the bytes the guard reads
 * (marketplaces -> per-mp -> plugins map). Every other branch reference is
 * shared. This keeps the helper cheap on hot paths.
 */
function removePluginRecord(
  state: ExtensionState,
  marketplace: string,
  plugin: string,
): ExtensionState {
  const cloned: ExtensionState = {
    schemaVersion: state.schemaVersion,
    marketplaces: { ...state.marketplaces },
  };
  const mp = cloned.marketplaces[marketplace];
  if (mp === undefined) {
    return cloned;
  }

  const newPlugins = { ...mp.plugins };
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- newPlugins is a Record<string,...>.
  delete newPlugins[plugin];
  cloned.marketplaces[marketplace] = { ...mp, plugins: newPlugins };
  return cloned;
}

// orchestrators/plugin/install-flow-ledger.ts
//
// Public composition root for install transaction sequencing. The guard-free
// phase ledger lives in install-outcome.ts; this owner binds that ledger to
// clone probing, declared enablement, disable cascade, outcome projection,
// locking, and exact notification behavior.

import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import path from "node:path";

import { lookupDeclaredPlugin } from "../../domain/manifest-lookup.ts";
import { loadMarketplaceManifest } from "../../domain/manifest.ts";
import { asAbsolutePluginRoot } from "../../domain/plugin-root.ts";
import { parsePluginSource } from "../../domain/source.ts";
import { locationsFor } from "../../persistence/locations.ts";
import { hookDebugLog } from "../../shared/debug-log.ts";
import { errorMessage } from "../../shared/errors.ts";
import { notify } from "../../shared/notification-dispatch.ts";
import { notifyWithContext } from "../../shared/notify-context.ts";
import { companionSeverity, malformedReasonsForKinds } from "../../shared/notify-reasons.ts";
import { ownValue } from "../../shared/own-key.ts";
import { narrowUnsupportedKinds } from "../../shared/probe-classifiers.ts";
import { cascadeUnstagePlugin, crossScopeFlag, foldUnstageNotices } from "../marketplace/shared.ts";

import { carryUnsavedAdds } from "./carried-marketplace-adds.ts";
import { makePresenceProbe } from "./git-source-probe.ts";
import { CASCADE_CONTEXT, composeCascadeMemberRows } from "./install-cascade.messaging.ts";
import { runInstallCascade, runInstallCascadeOrPlanMoves } from "./install-cascade.ts";
import { resolveInstallDeclaredEnabled } from "./install-declared-enabled.ts";
import { composeInstallDisableCascade } from "./install-disable-cascade.ts";
import {
  buildInstallLedgerOptions,
  memberLedgerPin,
  settleAddedMarketplaces,
  sharedCascadeOptions,
  trackInstallAdds,
  unwrapCascade,
  withMcpConfigNotices,
} from "./install-flow-cascade-context.ts";
import {
  cascadeStagingDiagnostics,
  collectPostCommitWarnings,
  declareInstalledPlugin,
  declaredRowOutcome,
  dependencyInstallsMember,
  failedRowOutcome,
  handleCaughtInstallFailure,
  landedMoves,
  movedMember,
  movedRows,
  promoteDependencyRecord,
  promotedRowOutcome,
  standaloneMarketplaceRefusal,
  writeOrchestratedDeclarations,
  writeReEnabledCascadeMemberConfigEntries,
} from "./install-flow-results.ts";
import { installedPluginOutcome, previewInstall } from "./install-outcome.ts";
import {
  loadTargetLayers,
  resolveInstallMarketplaceSource,
  writeAdoptingConfigEntries,
} from "./shared.ts";
import { surfaceDiscoveryWarnings } from "./staging-diagnostics.ts";

import type { CarriedAdd } from "./carried-marketplace-adds.ts";
import type { DependencyMoveOwners } from "./dependency-bindings.ts";
import type {
  CascadeMarketplaceTagProbe,
  CascadePlan,
  CascadeTagProbe,
  InstallCascadeOptions,
  PlannedClosure,
  RootCascadeResult,
} from "./install-cascade.ts";
import type { InstallCloneCacheSeam } from "./install-clone-probe.ts";
import type { InstallHooksRouting } from "./install-disable-cascade.ts";
import type { CascadeFailureSink, InstallAdds } from "./install-flow-cascade-context.ts";
import type { HydratableMember, InstallTransactionOutcome } from "./install-flow-results.ts";
import type {
  InstallFailureCapture,
  InstallLedgerOptions,
  InstallLedgerSummary,
  InstallPluginNotifications,
} from "./install-outcome.ts";
import type { InstallMsg } from "./install.messaging.ts";
import type { ClaudeEnv } from "../../domain/claude-mcp-variables.ts";
import type { ExtensionState } from "../../persistence/state-io.ts";
import type { NotificationContext, SoftDepStatus } from "../../platform/pi-api.ts";
import type { CompletionCache } from "../../shared/completion-cache.ts";
import type { Dependency } from "../../shared/concerns/soft-dep.ts";
import type { RemovalOps } from "../../shared/fs-utils.ts";
import type { NotificationRun } from "../../shared/notification-run.ts";
import type { ContentReason, McpConfigNotice } from "../../shared/notification-types.ts";
import type { Scope } from "../../shared/types.ts";
import type { runPhases } from "../../transaction/phase-ledger.ts";
import type { withLockedStateTransaction } from "../../transaction/with-state-guard.ts";
import type { AuthAttemptResult, CredentialOps, DeviceFlowHttp } from "../auth-host.ts";
import type { InstallPluginOutcome, MovedDependency } from "../types.ts";

/**
 * Controls how `installPlugin` surfaces notifications.
 *
 * - `"standalone"` (default): fires a SINGLE `notify(ctx, run, ...)`
 *   call per orchestration arm with the per-variant
 *   `PluginInstalledMessage` / `PluginFailedMessage` payload. The success
 *   row stamps severity from `run.softDeps`, and `notify()` composes the
 *   reload hint and the soft-dep markers from the same snapshot (D-05).
 *   Use for direct `/claude:plugin install`.
 *   Per D-19-01 there are no post-state-commit `notifyWarning` sites: the
 *   user-visible warning surface for mkdir / cache-refresh /
 *   agentForeignFailures / bridgeWarnings / PI-13 deps note is absent in
 *   standalone mode (the underlying side effects still fire).
 * - `"orchestrated"`: suppresses all notifications, returns the typed
 *   outcome, and collects post-commit warnings in
 *   `outcome.postCommitWarnings`. The import cascade caller injects each
 *   warning into its `pushDiagnostic` channel which surfaces per-marketplace
 *   in the cascade's rendering -- the standalone/orchestrated asymmetry
 *   is INTENTIONAL and consistent with D-19-01.
 */
export interface InstallPluginOptions {
  readonly ctx: NotificationContext;
  /**
   * D-05 / D-07: the command's run, or the composer's run when import or
   * reconcile drives the install. The severity stamp and the RH-3/RH-4
   * soft-dep markers both read its one soft-dependency snapshot.
   */
  readonly run: NotificationRun;
  readonly scope: Scope;
  /** Project-scope cwd (ignored for user scope; see locationsFor). */
  readonly cwd: string;
  readonly marketplace: string;
  readonly plugin: string;
  readonly notifications?: InstallPluginNotifications;
  /**
   * AG-7 opt-in flag. Default false: generated agents omit `model:` and
   * Pi picks its own default. The edge handler sets this to `true` only
   * when the user supplies `--map-model` on `/claude:plugin install`.
   *
   * RESV-01: applies CASCADE-WIDE. It states how the user wants generated
   * agents written, and a cascade that wrote the requesting plugin's agents
   * one way and its dependencies' another would produce one install under two
   * policies.
   */
  readonly mapModel?: boolean;
  /**
   * D-65-03: when true, the install preflight selects `requirePartialInstallable`
   * instead of `requireInstallable`, widening the gate to admit the
   * `partially-available` arm so its supported components materialize (the unsupported
   * ones are skipped naturally; FORCE-01). The edge handler sets this when the
   * user supplies `--partial`. Both gates still reject `unavailable` (FORCE-05).
   *
   * RESV-01: applies CASCADE-WIDE, deliberately. The flag states which
   * resolver gate the user accepts for this command, and a dependency that
   * failed the strict gate would fail the whole install (D-03-07) -- so
   * applying it to the requesting plugin alone would leave `--partial` unable
   * to do the one thing the user asked it for.
   */
  readonly partial?: boolean;
  /**
   * D-54-01 / ENBL-02: when set, bypasses `resolvePluginVersion` and pins
   * the install ledger to this exact version string. Used ONLY by
   * `setPluginEnabled` (the enable branch) to preserve the recorded state
   * record's `version` field across a re-materialization. The version pin
   * is the load-bearing invariant for ENBL-02 -- a `resolvePluginVersion`
   * re-read would silently bump the version if plugin.json or the
   * marketplace entry changed between disable and enable.
   *
   * When undefined, the PI-7 / PUP-3 / SNM-34 3-tier precedence applies
   * (plugin.json > entry.version > hash). All other callers leave this
   * undefined.
   *
   * RESV-01: reaches the plugin this call NAMES and no other cascade member.
   * It takes absolute precedence in `deriveInstallVersion`, so copying it onto
   * every member would record each dependency under the requesting plugin's
   * version string.
   */
  readonly pinVersionOverride?: string;
  /**
   * WB-01 / WB-02: when true, target the local config
   * (`claude-plugins.local.json`) instead of the base config
   * (`claude-plugins.json`). The base config is NEVER touched on the
   * --local path; loadConfig's `absent` arm yields an empty starting
   * shape that saveConfig writes back to the local path.
   *
   * LAYER-04 / D-MF-03: the flag alone picks the layer, whatever layer
   * already declares the plugin -- the rule `loadTargetLayers` applies,
   * shared with `enable` and `disable` so the three verbs that author an
   * enablement declaration pick their layer the same way.
   *
   * Two callers set it. The edge handler passes the user's `--local` flag.
   * The reconcile apply loop derives it from
   * `PlannedPluginInstall.configSource`, the merge provenance the planner
   * records, so BOTH the DFEN-05 precedence read and the DFEN-04 /
   * D-102-04 stamp address the physical file the declaration actually lives
   * in. Getting the read wrong is silent: reading only the base config for a
   * plugin the local config declares reports `enabled` absent even when the
   * local entry says `enabled: true`, installing the plugin disabled against
   * the user's explicit word.
   */
  readonly local?: boolean;
  /**
   * DFEN-04 / D-102-03 / D-102-04: when true, the install honors the resolved
   * `defaultEnabled` -- a plugin declaring `false` lands recorded disabled with
   * `enabled: false` written through to the target config entry. The standalone
   * edge handler and the reconcile apply loop set it; `import` deliberately
   * does NOT.
   *
   * The decision cannot be inferred from the config, which is why it is a
   * caller-supplied option rather than a read: on the import path the plugin's
   * config entry does not exist yet when `installPlugin` runs (the cascade
   * writes every entry in a post-pass), so an absent-entry inference would
   * install every imported plugin disabled -- and every plugin reaching import
   * arrived because the source settings said `enabled: true`, an explicit user
   * setting that DFEN-05 says wins.
   *
   * Absent or false means today's behavior exactly: the resolved value is read
   * and not acted on.
   */
  readonly applyDefaultEnabled?: boolean;
  /**
   * Test-only clone-cache seam override (see InstallLedgerOptions.cloneCacheSeam).
   * Production callers leave this undefined.
   */
  readonly cloneCacheSeam?: InstallCloneCacheSeam;
  /**
   * RESV-03 tag-resolution seam for the cascade's constrained members. Undefined
   * = the real probe, which reads the dependency's own source repository over
   * the network under D-03-03's NFR-5 amendment. Callers inject a collaborator
   * so a constrained cascade resolves without one.
   */
  readonly tagProbe?: CascadeTagProbe;
  /**
   * WR-03: the local, network-free tag probe a path-source member's
   * constraint routes through (mirrors `tagProbe` for the network arm).
   * Undefined = the real local probe, which reads the marketplace clone's
   * own tags off disk. Callers inject a collaborator so a constrained
   * path-source cascade resolves without touching the real filesystem.
   */
  readonly marketplaceTagProbe?: CascadeMarketplaceTagProbe;
  /**
   * PROV-03 / D-79-05 injection seam. Defaults to DEFAULT_CREDENTIAL_OPS at use.
   * The git-source clone probe passes it to `buildCloneAuth` so a provider
   * host authenticates host-keyed; callers can inject a CredentialOps collaborator.
   */
  readonly credentialOps?: CredentialOps;
  /**
   * PROV-03 Device Flow HTTP seam. Undefined = the real device-flow endpoints;
   * callers can inject a DeviceFlowHttp collaborator so the flow runs network-free.
   */
  readonly deviceFlowHttp?: DeviceFlowHttp;
  /**
   * D-79-02 once-per-host memo. A command-scope Map shared across a bulk
   * install so the provider flow runs AT MOST ONCE per host; the caller
   * (edge/cascade) owns its lifetime. Undefined = no memo (single install).
   */
  readonly authMemo?: Map<string, AuthAttemptResult>;
  /**
   * UPD-DEP-D1 / MISS-01: a later step of the caller installs the dependencies
   * a moved dependency's new version needs, so the dependency plan installs
   * only what the plugin reaches without passing a move, and its moves list no
   * release tag (D-23), as the caller's plan and `pending` do. Only `apply`
   * sets it; the command and `import` install what each move needs before it.
   * D-PL4-02: the plan still previews every fresh dependency, also one that
   * only a moved dependency's new version needs and that the later step
   * installs. So one that cannot install refuses the plugin before any move
   * lands, as Claude Code's install of one plugin is all or nothing over its
   * closure.
   */
  readonly dependencyInstallsFollow?: true;
  /**
   * LAYER-07 / D-MF-04: the `marketplace add` seam. A cascade member's ledger
   * records a marketplace this scope does not record yet through it, and the
   * lock owner settles each such marketplace through it after the save.
   * Undefined = the real add.
   */
  readonly marketplaceAdd?: InstallLedgerOptions["marketplaceAdd"];
}

/** Owns install's lock and phase-ledger schedule without exposing filesystem authority. */
export interface InstallTransaction {
  readonly runPhases: typeof runPhases;
  readonly withLockedStateTransaction: typeof withLockedStateTransaction;
}

/** Filesystem capability acquired by the public install composition root. */
export interface InstallFileCapabilities {
  readonly removalOps: RemovalOps;
}

/** Whether a cold git root can declare dependencies that its entry omits. */
async function needsRootDeclarationPreview(
  state: ExtensionState,
  locations: ReturnType<typeof locationsFor>,
  opts: Pick<InstallPluginOptions, "scope" | "cwd" | "marketplace" | "plugin">,
): Promise<boolean> {
  const recorded = ownValue(state.marketplaces, opts.marketplace);
  const fallback =
    recorded === undefined
      ? await resolveInstallMarketplaceSource({
          targetScope: opts.scope,
          cwd: opts.cwd,
          marketplace: opts.marketplace,
          targetState: state,
        })
      : undefined;
  const record = recorded ?? fallback?.sourceRecord;
  if (record === undefined) {
    return false;
  }

  const manifest = await loadMarketplaceManifest(record.manifestPath);
  const declared = lookupDeclaredPlugin(manifest, opts.plugin);
  if (declared.kind === "absent" || declared.entry.dependencies !== undefined) {
    return false;
  }

  const source = parsePluginSource(declared.entry.source);
  if (source.kind !== "url" && source.kind !== "git-subdir" && source.kind !== "github") {
    return false;
  }

  return (await makePresenceProbe(locations)(source)).kind === "not-cached";
}

/** Reads the clone that the root preview just materialized without another network call. */
function previewedRootCloneProbe(
  resolvedSha: string,
): NonNullable<InstallLedgerOptions["cloneProbe"]> {
  return async ({ source, locations }) => {
    const result = await makePresenceProbe(locations)({ ...source, sha: resolvedSha });
    return { result, resolvedSha };
  };
}

interface RootDeclarationPreview {
  readonly commit: string;
  readonly cloneProbe: NonNullable<InstallLedgerOptions["cloneProbe"]>;
}

/** Materializes a cold root before the filesystem-only dependency walk. */
async function prepareRootDeclarationPreview(args: {
  readonly state: ExtensionState;
  readonly locations: ReturnType<typeof locationsFor>;
  readonly opts: InstallPluginOptions;
  readonly env: ClaudeEnv;
  readonly adds: Pick<InstallAdds, "marketplaceAdd" | "addedMarketplaces">;
  readonly removalOps: RemovalOps;
}): Promise<RootDeclarationPreview | undefined> {
  if (!(await needsRootDeclarationPreview(args.state, args.locations, args.opts))) {
    return undefined;
  }

  // needsRootDeclarationPreview found a git entry in a recorded marketplace,
  // so previewInstall resolves a commit instead of the marketplace-absent arm.
  const commit = await previewInstall(
    args.state,
    args.locations,
    buildInstallLedgerOptions(
      args.opts,
      args.env,
      {
        scope: args.opts.scope,
        cwd: args.opts.cwd,
        marketplace: args.opts.marketplace,
        plugin: args.opts.plugin,
        ...(args.opts.pinVersionOverride !== undefined && {
          pinVersion: args.opts.pinVersionOverride,
        }),
        marketplaceAdd: args.adds.marketplaceAdd,
        addedMarketplaces: args.adds.addedMarketplaces,
      },
      args.removalOps,
    ),
  );
  assert.ok(commit !== undefined, "a cold git root preview must resolve a commit");
  return { commit, cloneProbe: previewedRootCloneProbe(commit) };
}

/**
 * What hydrating a materialized member's hooks needs to know about it: where
 * it landed and the hooks config it declared there. Every cascade member
 * carries this; the D-04-07 promotion builds it for the one record it
 * re-materializes.
 */
export async function hydrateInstalledHooks(args: {
  readonly hooksRouting: InstallHooksRouting;
  readonly scope: Scope;
  readonly cwd: string;
  readonly members: readonly HydratableMember[];
}): Promise<void> {
  const withHooks = args.members.flatMap((member) =>
    member.hooksConfigPath === undefined
      ? []
      : [{ member, hooksJsonPath: path.join(member.pluginRoot, member.hooksConfigPath) }],
  );
  if (withHooks.length === 0) {
    return;
  }

  for (const { member, hooksJsonPath } of withHooks) {
    try {
      // eslint-disable-next-line no-await-in-loop -- hydrates one member at a time, as /reload does
      await args.hooksRouting.readAndCachePluginHooks({
        scope: args.scope,
        marketplace: member.marketplace,
        plugin: member.name,
        resolvedSource: asAbsolutePluginRoot(member.pluginRoot),
        hooksJsonPath,
        cwd: args.cwd,
        logPrefix: "install",
      });
    } catch (cacheErr) {
      hookDebugLog(
        `install: post-save cache/routing mutation failed for ${member.key}: ${errorMessage(cacheErr)}`,
      );
    }
  }

  try {
    args.hooksRouting.rebuildRoutingTables();
  } catch (rebuildErr) {
    hookDebugLog(`install: post-save routing rebuild failed: ${errorMessage(rebuildErr)}`);
  }
}

function malformedRowReasons(installCtx: InstallLedgerSummary): readonly ContentReason[] {
  return malformedReasonsForKinds(installCtx.frontmatterDegradations.map((d) => d.kind));
}

/**
 * FSTAT-07 / D-66-04: the dropped-component kinds, read off the LIVE resolved
 * state of the just-completed install -- NOT the persisted
 * `compatibility.unsupported` record the `list` / non-path `info` derivers
 * read. The two agree here only because the install just wrote that record.
 * Empty on a fully-supported install (FSTAT-03: no lingering partial state).
 * Shared by both row composers on the same grounds as `malformedRowReasons`.
 */
function droppedKindRowReasons(installCtx: InstallLedgerSummary): readonly ContentReason[] {
  return narrowUnsupportedKinds(installCtx.resolved.unsupported);
}

function composeInstalledRow(installCtx: InstallLedgerSummary, probe: SoftDepStatus): InstallMsg {
  const { plugin } = installCtx;
  const declaresAgents = installCtx.stagedAgentNames.length > 0;
  const declaresMcp = installCtx.stagedMcpServerNames.length > 0;
  const declaresWorkflows = installCtx.stagedWorkflowNames.length > 0;

  // The renderer emits the per-row soft-dep markers (`{requires
  // pi-subagents}`, `{requires pi-mcp-adapter}`, `{requires pi-dynamic-workflows}`)
  // from this list automatically.
  const dependencies: Dependency[] = [];
  if (declaresAgents) {
    dependencies.push("agents");
  }

  if (declaresMcp) {
    dependencies.push("mcp");
  }

  // WDEP-02: a staged workflow declares the host engine. The envelope is
  // written whether or not the engine is loaded -- the marker reports that
  // nothing runs it yet, and the engine's own session_start storage scan picks
  // it up on the next reload with no reinstall (WDEP-03).
  if (declaresWorkflows) {
    dependencies.push("workflows");
  }

  // SURF-05 / D-63-08: `{orphan rewake}` fires once per plugin regardless of
  // how many orphan handlers the resolver saw -- it records a single flag.
  const reasons: ContentReason[] = [];
  if (installCtx.resolved.orphanRewake === true) {
    reasons.push("orphan rewake");
  }

  reasons.push(...malformedRowReasons(installCtx));

  // SEV-01: a declared-but-unloaded soft-dep companion silently degrades an
  // otherwise-clean install, so raise info to warning. WARN-01: a
  // degraded-but-installed component is "carried out but short of ideal" ->
  // warning independent of companion state, so it decides first.
  const severity =
    installCtx.frontmatterDegradations.length > 0
      ? "warning"
      : companionSeverity({ declaresAgents, declaresMcp, declaresWorkflows }, probe);

  // IN-02 / IN-04: `version` passes straight through. Row-level `scope` is
  // OMITTED -- it always equals the marketplace block's scope here, and
  // `renderScopeBracket` suppresses the duplicate bracket.
  if (installCtx.resolved.state === "partially-available") {
    return {
      status: "partially-installed",
      name: plugin,
      dependencies,
      version: installCtx.version,
      reasons: [...reasons, ...droppedKindRowReasons(installCtx)],
      severity,
      needsReload: true,
    };
  }

  return {
    status: "installed",
    name: plugin,
    dependencies,
    version: installCtx.version,
    ...(reasons.length > 0 && { reasons }),
    // D-03/D-06: a realized install transition reloads Pi resources.
    severity,
    needsReload: true,
  };
}

export interface InstallAfterPlan {
  readonly moved: readonly MovedDependency[];
  readonly carried: CarriedAdd[];
  readonly planned: PlannedClosure;
  readonly mcpConfigNotices: readonly McpConfigNotice[];
}

/** The collaborators dependency planning binds for one install transaction. */
export interface InstallPlanningOwners extends DependencyMoveOwners {
  readonly transaction: InstallTransaction;
  readonly hooksRouting: InstallHooksRouting;
  readonly fileCapabilities: InstallFileCapabilities;
}

/** Run post-commit maintenance with mkdir bound to this install's contained data directory. */
export function collectInstallPostCommitWarnings(
  installCtx: InstallLedgerSummary,
  completionCache: CompletionCache,
  scope: Scope,
  orchestrated: boolean,
): Promise<string[]> {
  return collectPostCommitWarnings(installCtx, completionCache, scope, orchestrated, async () => {
    await mkdir(installCtx.pluginDataDir, { recursive: true });
  });
}

/** The dependency-planning leaf operations used by the install ledger root. */
export interface InstallPlanning {
  readonly routeInstallCascade: (
    installed: Extract<RootCascadeResult, { readonly kind: "installed" }> | CascadePlan | undefined,
    keepAddsForMoves: () => void,
  ) =>
    | Extract<RootCascadeResult, { readonly kind: "installed" }>
    | { readonly kind: "marketplace-absent" }
    | { readonly kind: "dependency-moves" };
  readonly installAfterMoves: (args: {
    readonly owners: InstallPlanningOwners;
    readonly opts: InstallPluginOptions;
    readonly carried: CarriedAdd[];
    readonly installAgain: (
      opts: InstallPluginOptions,
      afterPlan: InstallAfterPlan,
    ) => Promise<InstallPluginOutcome>;
  }) => Promise<InstallPluginOutcome>;
}

interface InstallLedgerComposition {
  readonly planning: InstallPlanning;
  readonly fileCapabilities: InstallFileCapabilities;
}

/**
 * UPD-DEP-D1: what one run of the install reads: the first run may answer
 * that a dependency plan must come first, and starts its own list of
 * carried adds; the run after the plan materializes exactly the closure the
 * plan left for it.
 */
function installRun(afterPlan: InstallAfterPlan | undefined): {
  readonly moved?: readonly MovedDependency[];
  readonly carried: CarriedAdd[];
  readonly runCascade: (options: InstallCascadeOptions) => Promise<RootCascadeResult | CascadePlan>;
} {
  if (afterPlan === undefined) {
    return { carried: [], runCascade: runInstallCascadeOrPlanMoves };
  }

  return {
    moved: afterPlan.moved,
    carried: afterPlan.carried,
    runCascade: (options) => runInstallCascade({ ...options, planned: afterPlan.planned }),
  };
}

/**
 * PI-1..15 entrypoint. The function never re-throws -- failures surface
 * via a single `notify()` call carrying a `PluginFailedMessage`
 * (Pattern S-1 single chokepoint, IL-2 lint gate). Standalone-mode emits
 * exactly one notification per orchestration arm; orchestrated-mode emits
 * none and returns the typed outcome. GHB-03: the one exception is an
 * `InvalidGitHubBaseUrlError`, from the plugin or from a dependency, which it
 * rethrows in both modes so the whole command fails, unless the failure left a
 * rollback partial or an MCP config rewrite (AFILE-04). Then it is this
 * plugin's failed outcome, whose cause names the variable.
 *
 * Failure modes funnel through three paths inside the single catch
 * site:
 *   1. Guard-closure throw (PI-3 / PI-4 / PI-5 / PI-6 / PI-7 errors,
 *      ConcurrentInstallError from PI-15 layer (a), and the transaction-
 *      formatted ledger error) -> notify()
 *      with `PluginFailedMessage` carrying the typed `cause` and
 *      (when rollback partials are present) the
 *      `rollbackPartial: readonly { phase; cause? }[]` field. The renderer
 *      handles all indentation + cause-chain rendering automatically
 * .
 *   2. PathContainmentError originating in a bridge prepare or undo path is
 *      preserved by `formatRollbackError`: its message becomes `cause` on the
 *      `PluginFailedMessage` and never surfaces as a rollback partial.
 *   3. Post-state-commit pluginDataDir mkdir failure / cache-refresh
 *      failure / agentForeignFailures rows / bridgeWarnings rows /
 *      PI-13 deps note are DROPPED in standalone mode per D-19-01.
 *      Orchestrated-mode collects them in
 *      `InstallOutcome.postCommitWarnings` for the cascade caller.
 */
// The PI-1..15 sequence stays visible here: state guard, ledger call, failure
// routing, and post-commit notification composition. Cascade context lives in
// `install-flow-cascade-context.ts`. Result projection and post-commit warnings
// live in `install-flow-results.ts`.
async function installPluginWithTransaction(
  transaction: InstallTransaction,
  hooksRouting: InstallHooksRouting,
  completionCache: CompletionCache,
  env: ClaudeEnv,
  composition: InstallLedgerComposition,
  opts: InstallPluginOptions,
  afterPlan?: InstallAfterPlan,
): Promise<InstallPluginOutcome> {
  const { planning, fileCapabilities } = composition;
  const { ctx, run, scope, cwd, marketplace, plugin } = opts;
  const { moved, carried, runCascade } = installRun(afterPlan);
  const priorNotices = afterPlan?.mcpConfigNotices ?? [];
  const locations = locationsFor(scope, cwd);
  const disableCascade = composeInstallDisableCascade({
    hooksRouting,
    now: () => new Date().toISOString(),
    unstagePlugin: cascadeUnstagePlugin,
  });

  // Captured-on-throw context for the catch block (populated by
  // `runInstallLedger` BEFORE its rethrow). `capture.rollbackPartials`
  // mirrors the ledger's RollbackPartial[] and populates
  // `PluginFailedMessage.rollbackPartial` when non-empty; when empty, the
  // catch emits the bare failure row form (no rollback children) -- see
  // the catalog `/claude:plugin install <plugin>@<marketplace>` "Failure"
  // arms and the contrasting "Failure with rollback-partial children" arm
  // in `docs/output-catalog.md`. `capture.version` is the resolved
  // version at throw time (undefined when the throw pre-dated
  // `deriveInstallVersion`).
  const capture: InstallFailureCapture = { rollbackPartials: [], version: undefined };
  // RESV-06: where the cascade leaves the failing dependency for the catch
  // block, so the failure block names it rather than the plugin the user typed.
  const cascadeFailure: CascadeFailureSink = { mcpConfigNotices: [] };

  // WB-01: target-path selection happens ONCE, and both write arms below read
  // that one decision, so they cannot drift onto different files. The
  // orchestrator NEVER falls back to the base config on ENOENT: the base config
  // is NEVER touched on the --local path, and loadConfig's `absent` arm yields
  // an empty starting shape that saveConfig writes back to the local path. The
  // other layer is the scope's other config, read fresh inside the lock for the
  // FIX-03 check, the DFEN-05 read, and the dependency-marketplace gate --
  // never written, never serialized back.
  //
  // LAYER-04: the flag alone picks the target layer; both layers are read
  // INSIDE the lock.
  //
  // T-53-02-02: the CFG-03 abort row carries the basename of the layer that
  // could not be read, and that row renders after the lock closes, so the
  // basename escapes the closure through this `let`. It starts at the base
  // layer's basename, the target the no-flag call selects, so the type stays
  // definite.
  let configBasename = path.basename(locations.baseConfigJsonPath);
  const orchestrated = opts.notifications?.mode === "orchestrated";
  // The requested plugin's key: the cascade's root, the write-target selection
  // subject and the DFEN-05 precedence subject are all the same key by
  // construction, so they read one binding rather than three literals.
  const rootKey = `${plugin}@${marketplace}`;
  const adds = trackInstallAdds(transaction, opts.marketplaceAdd, carried);

  let outcome: InstallTransactionOutcome;
  try {
    // D-02 outer guard around the guard-FREE ledger body (CR-01): the lock
    // and the load/save lifecycle live HERE; `runInstallLedger` mutates the
    // snapshot only.
    //
    // WR-04: explicit-save transaction so the abort arms
    // (CFG-03 invalid config, marketplace-absent) return WITHOUT rewriting
    // state.json -- `withStateGuard` saved unconditionally on closure
    // return, bumping state.json's mtime on every abort, diverging from the
    // documented no-save abort discipline the sibling commands follow.
    outcome = await adds.lockOwner.withLockedStateTransaction(
      locations,
      async (tx): Promise<InstallTransactionOutcome> => {
        // LAYER-04: ONE selection, made before anything reads a config path, so
        // the CFG-03 load, the DFEN-05 precedence read and BOTH write arms below
        // address the same physical file. It reads both layers inside the lock
        // -- the WB-01 discipline that reads of the other layer happen fresh
        // under the lock the write also holds.
        //
        // The target is the layer the flag names. `targetIsLocal` still labels
        // which of `current` and `other` is the local layer, because
        // `resolveInstallDeclaredEnabled` reads the local layer's `enabled`
        // before the base layer's.
        const selection = await loadTargetLayers({
          locations,
          local: opts.local,
        });

        const state = tx.state;
        // CFG-03 / T-56-03-04: abort BEFORE any state mutation. The
        // basename-only message prevents an absolute-path information leak.
        // NO tx.save() -- state.json bytes and mtime are untouched.
        //
        // Either layer being unreadable stops the install, because the other
        // layer may declare the plugin or its marketplace. The row names the
        // file the user has to repair.
        if (selection.kind === "unreadable") {
          configBasename = path.basename(selection.filePath);
          return { kind: "invalid-config" };
        }

        // DFEN-05: the TARGET physical config, parsed ONCE by the selector and
        // shared by the precedence gate below and the write-back further down --
        // as is `other`, so one operation reads each file once and no two
        // decisions can rest on different bytes of the same file. Never a merged
        // view -- `config-write-back.ts` is forbidden from importing
        // `config-merge.ts`, and serializing a merged view back would copy the
        // local config's entries into the base config (SPLIT-02).
        const { targetConfigPath, targetIsLocal, current, other } = selection;
        configBasename = path.basename(targetConfigPath);

        // FIX-03 / LAYER-06: refuse before the promotion and the cascade, so a
        // refusal writes no state, no config, and no artifact (NFR-3). This one
        // check covers a fresh root, the D-04-07 promotion, the LAYER-05
        // declaration, and `browse`.
        const refusal = standaloneMarketplaceRefusal(opts, selection, state);
        if (refusal !== undefined) {
          return refusal;
        }

        const declared = await declareInstalledPlugin({
          opts,
          state,
          locations,
          orchestrated,
          selection,
        });
        if (declared !== undefined) {
          return declared;
        }

        // D-04-07: a recorded dependency the user has now named is promoted
        // here, BEFORE the cascade -- the cascade's ledger would refuse it as
        // already installed on an arm that never saves. This is the file's
        // second mutating arm: the promotion saves explicitly and returns.
        const promotion = await promoteDependencyRecord({
          opts,
          state,
          locations,
          orchestrated,
          config: { current, other, targetIsLocal },
          capture,
          transaction,
          sink: cascadeFailure,
          env,
          removalOps: fileCapabilities.removalOps,
        });
        if (promotion !== undefined) {
          await tx.save();
          // Hydrated after the save like the cascade's members are; the list
          // is empty unless the promotion re-materialized a disabled record.
          await hydrateInstalledHooks({
            hooksRouting,
            scope,
            cwd,
            members: promotion.materialized,
          });
          return { kind: "promoted", promotion };
        }

        // GITROOTDEPS-01: the dependency walk reads only materialized plugin
        // roots. Preview a cold git root when its marketplace entry omits the
        // dependency field, so its own manifest can answer the walk.
        const rootPreview = await prepareRootDeclarationPreview({
          state,
          locations,
          opts,
          env,
          adds,
          removalOps: fileCapabilities.removalOps,
        });

        // RESV-01: the cascade, not a single ledger call. It drives the
        // guard-free `runInstallLedger` once per closure member under THIS
        // closure's lock -- the lock-acquiring `installPlugin` entry point is
        // never re-entered, which `proper-lockfile` (`retries: 0`) would
        // self-deadlock on. A plugin that declares nothing is the N=1 case and
        // reaches the same ledger with the same options.
        //
        // D-03-05: every member installs into the requesting plugin's OWN
        // `locations` and `scope`; there is no per-member scope argument and no
        // way for a dependency to land in the other scope.
        const cascadeOptions: InstallCascadeOptions = {
          ...(await sharedCascadeOptions({
            opts,
            env,
            state,
            locations,
            root: { scope, cwd, marketplace, plugin, rootKey },
            adds,
            sink: cascadeFailure,
            capture,
            transaction,
            removalOps: fileCapabilities.removalOps,
          })),
          // RESV-03: a member whose constraint selected a release tag carries the
          // commit that tag resolves to AND the semver that tag names, and this
          // builder is where both enter that member's install. D-PL4-01:
          // otherwise a member the plan previewed installs the commit its
          // preview resolved. An unconstrained member the plan never previewed
          // installs from the ref its marketplace entry names.
          //
          // RESV-05 / GV-01: the tag's semver is recorded as `resolvedVersion`
          // beside the version Claude Code records there, which carries the
          // tag's commit. The next install that constrains this dependency
          // checks `resolvedVersion` against the range: the commit form either
          // satisfies nothing or coerces to an arbitrary digit run (D-03-04),
          // so without the semver a repeat of the same command fails the
          // constraint it had just satisfied.
          //
          // The caller's own `pinVersionOverride` reaches the plugin the caller
          // NAMED and no other member, and only when no tag pins it. It takes
          // absolute precedence in `deriveInstallVersion`, so copying it onto
          // every member would record each dependency under the requesting
          // plugin's version string.
          ledgerOptionsFor: (member) => {
            const isRoot = member.key === rootKey;
            const memberPin = memberLedgerPin(member);
            const pinVersion =
              member.pin === undefined && isRoot ? opts.pinVersionOverride : undefined;
            return buildInstallLedgerOptions(
              opts,
              env,
              {
                scope,
                cwd,
                marketplace: member.marketplace,
                plugin: member.name,
                ...memberPin,
                ...(memberPin.sourcePin === undefined &&
                  isRoot &&
                  rootPreview !== undefined && { sourcePin: rootPreview.commit }),
                ...(isRoot && rootPreview !== undefined && { cloneProbe: rootPreview.cloneProbe }),
                ...(member.directoryPin !== undefined && { directoryPin: member.directoryPin }),
                ...(pinVersion !== undefined && { pinVersion }),
                // D-04-01: the root is the one member the closure walk never
                // skips, so the key comparison alone decides provenance -- per
                // member, independent of install order.
                provenance: isRoot ? "explicit" : "dependency",
                marketplaceAdd: adds.marketplaceAdd,
                addedMarketplaces: adds.addedMarketplaces,
              },
              fileCapabilities.removalOps,
            );
          },
        };
        // UPD-DEP-D1: the first run may answer that a dependency plan must
        // come first; the run after the plan materializes exactly the closure
        // the plan left for it.
        const cascade = await runCascade(cascadeOptions);
        // WR-04: a precondition miss is read-only in effect, NO tx.save().
        // UPD-DEP-D1 / RESV-05: so are the dependency moves, which this
        // closure only plans; they are judged and made after the lock is
        // released (`installAfterMoves`).
        // WR-E: when the moves come first, the marketplaces this run added stay
        // for the run after them, so the operation clones each once (D-MF-04).
        const installed = planning.routeInstallCascade(
          unwrapCascade(cascade, capture, rootKey, cascadeFailure),
          () => {
            carryUnsavedAdds(adds.addedMarketplaces, state, carried);
          },
        );
        if (installed.kind !== "installed") {
          return installed;
        }

        // AFILE-04: the cascade has rewritten the MCP config files, and the
        // config write-back and the state save below can still throw.
        cascadeFailure.mcpConfigNotices = installed.mcpConfigNotices;

        // Success: the install context this closure just produced.
        const installCtx = installed.root;

        // DFEN-04 / DFEN-05: the install lands disabled only when all three hold
        // -- the caller opted in, the user has stated NO opinion in EITHER of the
        // scope's two physical config files (an explicit `enabled` wins in either
        // direction and is never overwritten; `isDeclaredEnabled` answers "is it
        // enabled", which is a different question), and the plugin's resolved
        // declaration says false. `defaultEnabled` is a plain boolean on the
        // materializable arms, so there is no `?? true` fallback to re-derive
        // here. LAYER-09: the read spans both files because the merged view
        // reads `enabled` field by field, local first, whatever the write target
        // is; `current` stays the TARGET file and steers the write arms below and
        // nothing else.
        const declaredEnabled = resolveInstallDeclaredEnabled({
          current,
          other,
          targetIsLocal,
          key: rootKey,
        });
        const landedDisabled =
          opts.applyDefaultEnabled === true &&
          declaredEnabled === undefined &&
          !installed.root.resolved.defaultEnabled;

        // D-102-02: the disable cascade's cause, when it failed. Decided inside
        // the lock and reported to the post-guard path as its own outcome arm.
        let cascadeError: Error | undefined;
        let removeDisabledRoutesAfterSave = false;
        // AFILE-04: the stage's notices, then the disable cascade's, which
        // rewrites the MCP config files again when the install lands disabled.
        // AVAR-04: the disable drops the variable notices of the servers it
        // removed.
        let mcpConfigNotices = installed.mcpConfigNotices;
        if (landedDisabled) {
          // D-102-01: the six-phase ledger already ran and the state phase wrote
          // `enabled: true`; the disable half runs here, after `runPhases` and
          // before the write-back, and overwrites that value. No seventh phase,
          // no edit to any of the six phase bodies.
          const disableResult = await disableCascade.disableFreshInstall({
            state,
            locations,
            marketplace,
            plugin,
          });
          removeDisabledRoutesAfterSave = disableResult.removeRoutes;
          const folded = [...mcpConfigNotices];
          foldUnstageNotices(folded, {
            scope: locations.scope,
            plugin,
            droppedServers: disableResult.droppedMcpServers,
            notices: disableResult.mcpConfigNotices,
          });
          mcpConfigNotices = folded;
          cascadeFailure.mcpConfigNotices = mcpConfigNotices;
          if (!disableResult.ok) {
            // D-102-02: record the cause and fall through. The fold already
            // subtracted what DID drop, so the `tx.save()` below persists the
            // shrunken record and the post-guard path surfaces the existing
            // install failure row; not throwing is what keeps state.json honest
            // about what is still on disk (NFR-3).
            //
            // NFR-3: falling through rather than returning early is what makes
            // the write-back arms below stamp `enabled: false` on this path too.
            // Saving a record while writing no declaration leaves a state neither
            // convergence path can act on -- the entry that reached the reconcile
            // install bucket is bare, so the planner reads declared-enabled +
            // recorded + not-disabled and calls it steady state forever, while
            // the plugin's artifacts are already gone from disk. The stamp turns
            // that into the divergence the disable bucket closes on the next pass.
            cascadeError = disableResult.cause;
          }
        }

        // WB-01 / WR-09: write-back the plugin entry to the user-authored
        // config. SKIPPED in orchestrated mode (reconcile derives desired
        // state FROM the merged config; writing back would clobber a
        // per-machine override).
        //
        // DFEN-04: the plugin patch carries `enabled: false` when the install
        // landed disabled -- the first field this patch has ever carried. That
        // includes the D-102-02 window where the disable cascade FAILED: the
        // declaration states what the plugin should be, and it is what lets a
        // later reconcile pass retry the disable. It stays `{}` otherwise,
        // because the entry shape carries no other
        // install-time field beyond the implicit declaration and D-04 keeps the
        // "enabled" default at consume time. The patch merges over the existing
        // entry, so no key the user already wrote is disturbed.
        //
        // CR-02 / LAYER-06: when the target layer does not declare the
        // marketplace -- the CMP-3 fallback added it to THIS scope through the
        // `marketplace add` body, which writes no config, or only the other
        // layer declares it -- declare the marketplace entry in the SAME
        // batched patch (same lock, one atomic save). A layer that declares a
        // plugin also declares its marketplace (D-MF-03), so a later
        // `marketplace remove` from the other layer keeps this plugin. Without
        // it the plugin key is a dangling declaration: the next reconcile plans
        // the added record's REMOVAL and renders a perpetual
        // `<marketplace not declared>` failed row (invariant 5 violation).
        //
        // LAYER-07 / D-MF-04: a marketplace the install added for a dependency
        // is declared only when neither layer declares it, because no layer
        // declares a dependency plugin (D-04-02).
        if (opts.notifications?.mode !== "orchestrated") {
          await writeAdoptingConfigEntries({
            current,
            other,
            state,
            marketplace,
            plugin,
            locations,
            targetIsLocal,
            // DFEN-04: the plugin key alone unless the install actually landed
            // disabled, in which case the declaration carries it through.
            // D-04-02: no dependency plugin gets a key -- the config names only
            // the plugins the user asked for by name, and each dependency's
            // record carries `provenance: "dependency"`, which D-04-05's
            // reconcile exemption reads on the next reload.
            pluginPatch: { ...(landedDisabled && { enabled: false }) },
            // LAYER-07 / D-MF-04: the config does declare every marketplace the
            // install added to the scope, a dependency's included, so the
            // desired state names what the scope now owns.
            addedMarketplaces: adds.addedMarketplaces
              .map((added) => added.marketplace)
              .filter((name) => name !== marketplace),
          });
          await writeReEnabledCascadeMemberConfigEntries(locations, installed.members);
        } else {
          await writeOrchestratedDeclarations({
            current,
            targetConfigPath,
            scopeRoot: locations.scopeRoot,
            plugin,
            marketplace,
            landedDisabled,
          });
        }

        // WR-04: one of the two mutating arms (the other is the D-04-07
        // promotion above), and it saves explicitly. State persists AFTER the
        // config write-back, so a write-back throw aborts the save and the
        // state snapshot is discarded.
        await tx.save();

        if (removeDisabledRoutesAfterSave) {
          disableCascade.dropRoutesAfterSave(scope, marketplace, plugin);
        }

        // WR-06 / D-59-02: hooks-bridge parsed-config cache add + routing
        // table rebuild. Moved AFTER `tx.save()` so a write-back throw
        // (lines above) or a tx.save throw aborts BEFORE the cache mutates.
        // Without this ordering, a closure-throw between cache mutation and
        // tx.save() left a phantom routing entry that the next dispatch
        // event would fire against -- state.json had no record of the
        // install but the parsed-config cache + routing table did, and the
        // next `/reload` was required to clear the strand.
        //
        // Post-save semantics are safe: state.json now matches in-memory
        // state, so the next `/reload`'s factory-time hydrate (D-59-03)
        // rebuilds the cache from the SAME source of truth.  Synchronous +
        // zero disk I/O per DISP-02; the per-plugin lock still holds for
        // the sub-millisecond cache+rebuild.  Skipped when the plugin
        // declares no hooks.  Read+parse failures are non-fatal: the
        // resolver already validated the config at install-entry time, and
        // any defensive re-parse failure routes through OBS-01 debug only.
        //
        // WR-03: keep the routing table in lockstep with the parsed-config
        // cache so a standalone install (outside a reconcile cascade)
        // starts dispatching to the new plugin's hooks immediately,
        // without requiring `/reload` (NFR-2).
        //
        // WR-02: post-`tx.save()` cache+routing mutations are non-fatal --
        // state.json already records the install as successful, so a
        // throw here must NOT surface as `(failed)`. `/reload`'s
        // factory-time hydrate (D-59-03) rebuilds the cache from
        // state.json, closing any divergence. Failures route through
        // `hookDebugLog`.
        //
        // DFEN-04: the requesting plugin is SKIPPED when its install landed
        // disabled. The disable cascade above has just removed its on-disk
        // hooks.json, so hydrating it would either re-read a deleted file or --
        // worse -- register routing entries for a plugin the user's configuration
        // says is disabled, giving live hook dispatch against disabled code that
        // nothing short of the next hydrate would clear. The composed disable
        // cascade already dropped the cache entry, which is the correct mutation
        // on that path. A DEPENDENCY is never install-disabled, so the skip is
        // scoped to the one member that can be.
        //
        // RESV-01: every member the cascade materialized is hydrated, not the
        // requesting plugin alone. A dependency whose ledger staged a hooks.json
        // otherwise has the file on disk and no routing entry, so its hooks stay
        // inert until the next `/reload` -- exactly the divergence this block
        // exists to close, reopened for the members the user did not type.
        await hydrateInstalledHooks({
          hooksRouting,
          scope,
          cwd,
          members: installed.members.filter(
            (member) => !(landedDisabled && member.key === rootKey),
          ),
        });

        // D-102-02: report the cascade failure to the post-guard path last --
        // AFTER the shrunken record's tx.save() and the hooks hydration above,
        // both of which must still run on this path (NFR-3) -- so the
        // "installed" arm's fields never carry a value the caller should
        // instead read off "disable-cascade-failed".
        if (cascadeError !== undefined) {
          return {
            kind: "disable-cascade-failed",
            cause: cascadeError,
            mcpConfigNotices,
          };
        }

        return {
          kind: "installed",
          installCtx,
          landedDisabled,
          members: installed.members,
          alreadyInstalled: installed.alreadyInstalled,
          mcpConfigNotices,
        };
      },
    );
  } catch (err) {
    cascadeFailure.mcpConfigNotices = [...priorNotices, ...cascadeFailure.mcpConfigNotices];
    // Pattern S-1 single chokepoint for user-visible errors: one
    // notify(ctx, run, ...) call carrying a per-variant
    // PluginFailedMessage / PluginUnavailableMessage. Severity derives to
    // "error" structurally and neither variant triggers the reload hint.
    //
    // AFILE-04: the notices of the dependencies that committed before the
    // failure follow the failed row.
    const failed = handleCaughtInstallFailure({
      err,
      ctx,
      run,
      marketplace,
      scope,
      plugin,
      rootKey,
      capture,
      cascadeFailure,
      orchestrated,
      ...(moved !== undefined && { moved }),
    });
    return withMcpConfigNotices(ctx, run, orchestrated, failed, cascadeFailure.mcpConfigNotices);
  }

  await settleAddedMarketplaces(
    adds.committedAdds,
    adds.marketplaceAdd,
    locations,
    completionCache,
  );

  // ATTR-01 / ATTR-08 / M1: marketplace-absent precondition (set inside the
  // guard, no state mutated). The marketplace subject is reported via the
  // canonical `MarketplaceNotAddedMessage` variant -- standalone
  // top-level emission per D-47-A, matching `info` exactly. Orchestrated
  // mode (import cascade) returns the failed outcome WITHOUT emitting; the
  // cascade caller renders its own rows (mirrors the entity-error
  // orchestrated gate at the catch above).
  //
  // install always carries a resolved `scope` (the edge defaults it), so the
  // not-added row always renders the `[scope]` bracket (SCOPE-01 resolved
  // Open Question #1). DO NOT route through `resolveInstallMarketplaceSource`
  // -- the CMP-3 project->user fallback already ran inside the guard; only a
  // double-miss reaches here.
  //
  // WB-01 / CFG-03 / T-56-03-04: invalid-config abort. The basename-only
  // message prevents an absolute-path information leak. No state mutation,
  // no write-back -- the closure returned before runInstallLedger ran.
  let finalOutcome: InstallPluginOutcome;
  let notices = priorNotices;
  switch (outcome.kind) {
    // UPD-DEP-D1: plan the moves with the lock released, make them, then run
    // the install again with the dependencies in range.
    case "dependency-moves":
      return planning.installAfterMoves({
        owners: { transaction, hooksRouting, completionCache, env, fileCapabilities },
        opts,
        carried,
        installAgain: (nextOpts, nextPlan) =>
          installPluginWithTransaction(
            transaction,
            hooksRouting,
            completionCache,
            env,
            composition,
            nextOpts,
            nextPlan,
          ),
      });

    case "invalid-config":
      finalOutcome = failedRowOutcome({
        ctx,
        run,
        marketplace,
        scope,
        plugin,
        error: new Error(`Config file "${configBasename}" failed schema validation.`),
        reasons: ["invalid manifest"],
        orchestrated,
        moved,
      });
      break;

    case "marketplace-absent": {
      const cause = `Marketplace "${marketplace}" is not added in the ${scope} scope.`;

      // CMP-4 / SCOPE-01: a bare `{marketplace not added}` row is not actionable when the
      // container lives in the OTHER scope -- the repo-bundled-marketplace case,
      // where a default-scope (user) install misses a project-only container. One
      // read-only probe of that scope decides which structural token the brace
      // carries. The probe never throws and never blocks the row (see
      // `marketplaceInOtherScope`); a `false` answer adds no field, so the row
      // renders the plain `{marketplace not added}` brace.
      if (!orchestrated) {
        notify(ctx, run, {
          kind: "marketplace-not-added",
          name: marketplace,
          scope,
          ...(await crossScopeFlag({ cwd, marketplace, scope })),
        });
      }

      finalOutcome = { status: "failed", error: new Error(cause), cause, ...movedMember(moved) };
      break;
    }

    case "refused":
      finalOutcome = failedRowOutcome({
        ctx,
        run,
        marketplace,
        scope,
        plugin,
        error: outcome.refusal,
        reasons: [outcome.reason],
        orchestrated,
        moved,
      });
      break;

    case "declared":
      finalOutcome = declaredRowOutcome({
        ctx,
        run,
        marketplace,
        scope,
        plugin,
        record: outcome.record,
        reason: outcome.reason,
      });
      break;

    // D-04-07: the promotion arm. State was saved and any hooks hydrated inside
    // the lock, and the cascade never ran, so there are no post-commit warnings
    // to collect. The row is the whole report, followed by the MCP config
    // notices of a re-materialization (AFILE-04).
    case "promoted":
      finalOutcome = promotedRowOutcome({
        ctx,
        run,
        marketplace,
        scope,
        plugin,
        promotion: outcome.promotion,
        orchestrated,
      });
      notices = [...priorNotices, ...outcome.promotion.mcpConfigNotices];
      break;

    // D-102-02: the ledger succeeded and the disable cascade then failed. The
    // shrunken record was already saved inside the lock, so state.json describes
    // what is still on disk. Surface the EXISTING install failure row carrying
    // the cascade's own cause -- no new failure semantics, no new rollback
    // composition, and no new reason token. The record stays `enabled: true` with
    // a shrunken inventory, which is exactly what an install followed by a failed
    // disable produces, and the config entry the write-back arms just stamped
    // says `enabled: false` -- the divergence a later reconcile pass closes by
    // planning the disable this one could not finish.
    case "disable-cascade-failed": {
      const cause = errorMessage(outcome.cause);
      if (!orchestrated) {
        notifyWithContext(
          ctx,
          run,
          CASCADE_CONTEXT,
          [
            {
              name: marketplace,
              scope,
              plugins: [
                {
                  status: "failed",
                  severity: "error" as const,
                  name: plugin,
                  reasons: [] as const,
                  cause: outcome.cause,
                },
                ...movedRows(moved),
              ],
            },
          ],
          undefined,
          "single",
        );
      }

      // AFILE-04: the ledger rewrote the file before the disable failed.
      finalOutcome = { status: "failed", error: outcome.cause, cause, ...movedMember(moved) };
      notices = [...priorNotices, ...outcome.mcpConfigNotices];
      break;
    }

    case "installed": {
      const { installCtx, landedDisabled } = outcome;
      const landed = landedMoves(moved, outcome.members);
      const postCommitWarnings = await collectInstallPostCommitWarnings(
        installCtx,
        completionCache,
        scope,
        orchestrated,
      );

      if (!orchestrated) {
        // RH-3 / RH-4: ONE companion probe for the whole block. The row composers
        // and the SEV-01 severity verdicts all read this snapshot, so every row in
        // one block describes the same host -- and the probe count the boundary
        // fakes assert stays what a single install always made.
        const softDepProbe = run.softDeps;
        // Success: one notify(ctx, run, ...) call with a PluginInstalledMessage.
        // D-05: the renderer composes the per-row soft-dep markers from
        // `run.softDeps`, the snapshot `composeInstalledRow` stamped severity
        // from. The "/reload to pick up changes" trailer fires structurally on
        // the status; the trigger ladder is per-variant, not
        // per-resource-count (RH-1, PU-8 (b)).
        //
        // The PI-13 dependencies-declaration note is DROPPED per D-19-01: the
        // PR-5 free-form prose has no clean MarketplaceNotificationMessage
        // representation. The resolver still appends it to `installable.notes`
        // so downstream surfaces can continue to consume it.
        //
        // Exactly ONE notification per install (IL-2), whichever row the install
        // produced -- the DFEN-04 disabled row when the cascade unstaged
        // everything, the success row otherwise.
        //
        // RESV-01 / RESV-05 / RESV-06: the requesting plugin's row goes through the
        // cascade composer together with one row per closure member. A plugin that
        // declared nothing hands the composer two empty lists, so its block is the
        // single row it always was, byte for byte.
        notifyWithContext(
          ctx,
          run,
          CASCADE_CONTEXT,
          [
            {
              name: marketplace,
              scope,
              plugins: composeCascadeMemberRows({
                scope,
                rootKey,
                rootRow: landedDisabled
                  ? disableCascade.composeDisabledRow({
                      plugin: installCtx.plugin,
                      version: installCtx.version,
                      resolution: {
                        state: installCtx.resolved.state,
                        unsupported: installCtx.resolved.unsupported,
                      },
                      frontmatterDegradations: installCtx.frontmatterDegradations,
                    })
                  : composeInstalledRow(installCtx, softDepProbe),
                installed: outcome.members,
                alreadyInstalled: outcome.alreadyInstalled,
                probe: softDepProbe,
                ...(landed !== undefined && { moved: landed.map((entry) => entry.row) }),
              }),
            },
          ],
          undefined,
          "single",
        );
        cascadeStagingDiagnostics(outcome.members, scope, {
          key: rootKey,
          name: plugin,
          discoveryWarnings: installCtx.discoveryWarnings,
        }).forEach((diagnostic) => {
          surfaceDiscoveryWarnings(ctx, run, diagnostic);
        });
      }

      // AFILE-04: every cascade member's notices, after the block's own rows.
      finalOutcome = {
        ...installedPluginOutcome(installCtx, postCommitWarnings, landedDisabled),
        ...movedMember(landed),
        ...dependencyInstallsMember(moved, outcome.members, rootKey, run.softDeps),
      };
      notices = [...priorNotices, ...outcome.mcpConfigNotices];
      break;
    }
  }

  return withMcpConfigNotices(ctx, run, orchestrated, finalOutcome, notices);
}

/**
 * Bind install orchestration to one required semantic transaction owner.
 *
 * D-08-06: `env` is the environment the install stages MCP servers with. It
 * defaults to Pi's process environment here, at the entry point, the way
 * `createGetPluginInfo` binds it.
 */
export function createInstallLedgerPlugin(
  transaction: InstallTransaction,
  hooksRouting: InstallHooksRouting,
  completionCache: CompletionCache,
  planning: InstallPlanning,
  fileCapabilities: InstallFileCapabilities,
  env: ClaudeEnv = process.env,
): (opts: InstallPluginOptions) => Promise<InstallPluginOutcome> {
  const composition: InstallLedgerComposition = { planning, fileCapabilities };
  return (opts) =>
    installPluginWithTransaction(
      transaction,
      hooksRouting,
      completionCache,
      env,
      composition,
      opts,
    );
}

// orchestrators/plugin/install-flow.ts
//
// Public composition root for install transaction sequencing. The guard-free
// phase ledger lives in install-outcome.ts; this owner binds that ledger to
// clone probing, declared enablement, disable cascade, outcome projection,
// locking, and exact notification behavior.

import { mkdir } from "node:fs/promises";
import path from "node:path";

import { lookupDeclaredPlugin } from "../../domain/manifest-lookup.ts";
import { loadMarketplaceManifest } from "../../domain/manifest.ts";
import { asAbsolutePluginRoot } from "../../domain/plugin-root.ts";
import { writePluginConfigEntry } from "../../persistence/config-write-back.ts";
import { locationsFor } from "../../persistence/locations.ts";
import { isRecordedButDisabled } from "../../persistence/state-io.ts";
import { softDepStatus } from "../../platform/pi-api.ts";
import { hookDebugLog } from "../../shared/debug-log.ts";
import { errorMessage } from "../../shared/errors.ts";
import { createRemovalOps } from "../../shared/fs-utils.ts";
import { notify } from "../../shared/notification-dispatch.ts";
import { notifyWithContext } from "../../shared/notify-context.ts";
import { companionSeverity, malformedReasonsForKinds } from "../../shared/notify-reasons.ts";
import { narrowUnsupportedKinds } from "../../shared/probe-classifiers.ts";
import { cascadeUnstagePlugin, crossScopeFlag } from "../marketplace/shared.ts";

import { readDependencyDeclaration } from "./dependency-declaration-read.ts";
import {
  CASCADE_CONTEXT,
  cascadeFailureCause,
  composeCascadeFailureMessage,
  composeCascadeMemberRows,
} from "./install-cascade.messaging.ts";
import { runInstallCascade } from "./install-cascade.ts";
import { probeInstallClone } from "./install-clone-probe.ts";
import { resolveInstallDeclaredEnabled } from "./install-declared-enabled.ts";
import { composeInstallDisableCascade } from "./install-disable-cascade.ts";
import {
  installedPluginOutcome,
  ledgerDegradationSignals,
  runInstallLedger,
} from "./install-outcome.ts";
import {
  INSTALL_CONTEXT,
  classifyEntityShapeError,
  classifyInstallFailure,
  composeInstallFailureMessage,
  composePromotedRow,
  formatOrchestratedCause,
} from "./install.messaging.ts";
import {
  collectInstallReachableMarketplaces,
  overwriteDisabledMemberEntries,
  resolveInstallMarketplaceSource,
  selectDeclaringConfigWriteTarget,
  surfaceDiscoveryWarnings,
  writeAdoptingConfigEntries,
  type LedgerDegradationSignals,
} from "./shared.ts";
import { garbageCollectWorkflowsStaging } from "./workflows-staging-gc.ts";

import type { CascadeFailureSubject } from "./install-cascade.messaging.ts";
import type {
  CascadeMarketplaceTagProbe,
  CascadeMemberOutcome,
  CascadeSkippedMember,
  CascadeTagProbe,
  InstallCascadeResult,
} from "./install-cascade.ts";
import type { InstallCloneCacheSeam } from "./install-clone-probe.ts";
import type { InstallHooksRouting } from "./install-disable-cascade.ts";
import type {
  InstallFailureCapture,
  InstallLedgerOptions,
  InstallLedgerResult,
  InstallLedgerSummary,
  InstallPluginNotifications,
} from "./install-outcome.ts";
import type { InstallMsg } from "./install.messaging.ts";
import type { ClosureLookupResult, ClosureSubject } from "../../domain/dependency-closure.ts";
import type { PluginConfigEntry, ScopeConfig } from "../../persistence/config-io.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { ExtensionState, PluginInstallRecord } from "../../persistence/state-io.ts";
import type { NotificationContext, SoftDepStatus, ToolInventory } from "../../platform/pi-api.ts";
import type { CompletionCache } from "../../shared/completion-cache.ts";
import type { Dependency } from "../../shared/concerns/soft-dep.ts";
import type { ContentReason } from "../../shared/notification-types.ts";
import type { Scope } from "../../shared/types.ts";
import type { runPhases } from "../../transaction/phase-ledger.ts";
import type { withLockedStateTransaction } from "../../transaction/with-state-guard.ts";
import type { AuthAttemptResult, CredentialOps, DeviceFlowHttp } from "../auth-host.ts";
import type { InstallPluginOutcome } from "../types.ts";

/**
 * Controls how `installPlugin` surfaces notifications.
 *
 * - `"standalone"` (default): fires a SINGLE `notify(ctx, pi, ...)`
 *   call per orchestration arm with the per-variant
 *   `PluginInstalledMessage` / `PluginFailedMessage` payload. Severity +
 *   reload-hint + soft-dep markers are computed by `notify()`.
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
  /** Factory `pi` reference -- carries `getAllTools()` for RH-3/RH-4 soft-dep probes. */
  readonly pi: ToolInventory;
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
   * WB-01 / WB-02: when true, target `claude-plugins.local.json` instead
   * of `claude-plugins.json`. The base file is NEVER touched on the
   * --local path; loadConfig's `absent` arm yields an empty starting
   * shape that saveConfig writes back to the local path.
   *
   * D-103-16: the flag is not the sole determinant of the write target. It
   * answers which file the caller WANTS written, and it still wins outright.
   * When it is absent the target follows the file the plugin's declaration
   * already lives in, and only a key declared in neither file lands in the base
   * file -- the rule `selectDeclaringConfigWriteTarget` states, shared with
   * `enable` and `disable` so the three verbs that author an enablement
   * declaration cannot disagree about where one lives.
   *
   * Two callers set it. The edge handler passes the user's `--local` flag.
   * The reconcile apply loop derives it from
   * `PlannedPluginInstall.configSource`, the merge provenance the planner
   * records, so BOTH the DFEN-05 precedence read and the DFEN-04 /
   * D-102-04 stamp address the physical file the declaration actually lives
   * in. Getting that wrong is silent in both directions: reading the base
   * file for a locally-declared plugin reports `enabled` absent even when
   * the local entry says `enabled: true`, installing the plugin disabled
   * against the user's explicit word; and stamping the base file under a
   * local declaration changes nothing the merged view can see, because a
   * local entry replaces the base entry for that key wholesale (CFG-02).
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
}

/** Owns install's lock and phase-ledger schedule without exposing filesystem authority. */
export interface InstallTransaction {
  readonly runPhases: typeof runPhases;
  readonly withLockedStateTransaction: typeof withLockedStateTransaction;
}

/**
 * The fields `buildInstallLedgerOptions` reads off its caller's options,
 * narrowed so `installMissingDependencyWithTransaction` can share the builder
 * without carrying every `InstallPluginOptions` field (D-09-05).
 */
type InstallLedgerCallerOptions = Pick<
  InstallPluginOptions,
  | "ctx"
  | "mapModel"
  | "partial"
  | "cloneCacheSeam"
  | "credentialOps"
  | "deviceFlowHttp"
  | "authMemo"
>;

/**
 * Assemble the `InstallLedgerOptions` for ONE cascade member from the
 * entrypoint options, spreading each optional field only when defined
 * (exactOptionalPropertyTypes). Extracted from `installPlugin`'s guard closure
 * so the conditional-spread ladder does not inflate that closure's cognitive
 * complexity. `ctx` is always threaded so the git-source clone probe can wire
 * the auth notify seam (PROV-03).
 *
 * The entrypoint options divide in two, and the split is the contract.
 *
 * Cascade-wide, deliberately: `mapModel`, `partial`, `cloneCacheSeam` and the
 * three auth collaborators. `--map-model` states how the user wants generated
 * agents written and `--partial` states which resolver gate the user accepts,
 * and a cascade that applied either to the plugin the user typed but not to
 * the plugins installed with it would produce one install under two policies.
 * The auth trio must be shared or a member would authenticate differently from
 * the tag query that selected its pin (AUTH-09).
 *
 * Per-member, necessarily: `sourcePin` and `pinVersion`. Both are facts about
 * ONE member -- the commit its constraint selected and the semver the selected
 * tag carries -- so both arrive on `core` and neither is read off `opts`.
 * `pinVersionOverride` in particular takes absolute precedence in
 * `deriveInstallVersion`, so copying the caller's own onto every member would
 * record every dependency under the requesting plugin's version string.
 */
function buildInstallLedgerOptions(
  opts: InstallLedgerCallerOptions,
  core: {
    scope: Scope;
    cwd: string;
    marketplace: string;
    plugin: string;
    /** RESV-03: the commit a cascade member's version constraint selected. */
    sourcePin?: string;
    /**
     * The version to record for THIS member: the semver its selected tag
     * carries (RESV-03 / RESV-05), or the caller's `pinVersionOverride` when
     * the member IS the plugin the caller named. It overrides the git-source
     * `sha-<12hex>` branch, which is the form RESV-05 cannot read back.
     */
    pinVersion?: string;
    /** D-04-01: whether THIS member is the plugin the caller named. */
    provenance?: PluginInstallRecord["provenance"];
  },
): InstallLedgerOptions {
  return {
    ctx: opts.ctx,
    scope: core.scope,
    cwd: core.cwd,
    marketplace: core.marketplace,
    plugin: core.plugin,
    ...(core.sourcePin !== undefined && { sourcePinOverride: core.sourcePin }),
    ...(core.provenance !== undefined && { provenance: core.provenance }),
    ...(opts.mapModel !== undefined && { mapModel: opts.mapModel }),
    ...(opts.partial !== undefined && { partial: opts.partial }),
    ...(core.pinVersion !== undefined && { pinVersionOverride: core.pinVersion }),
    ...(opts.cloneCacheSeam !== undefined && { cloneCacheSeam: opts.cloneCacheSeam }),
    cloneProbe: probeInstallClone,
    // D-08-12: the install path's composition root. The ledger options carry the
    // port as a required member, so this assembly point is the one place the real
    // operations enter the install path.
    removalOps: createRemovalOps(),
    ...(opts.credentialOps !== undefined && { credentialOps: opts.credentialOps }),
    ...(opts.deviceFlowHttp !== undefined && { deviceFlowHttp: opts.deviceFlowHttp }),
    ...(opts.authMemo !== undefined && { authMemo: opts.authMemo }),
  };
}

/**
 * What hydrating a materialized member's hooks needs to know about it: where
 * it landed and the hooks config it declared there. Every cascade member
 * carries this; the D-04-07 promotion builds it for the one record it
 * re-materializes.
 */
type HydratableMember = Pick<
  CascadeMemberOutcome,
  "key" | "name" | "marketplace" | "pluginRoot" | "hooksConfigPath"
>;

/**
 * Add every materialized member's hooks to the parsed-config cache and rebuild
 * the routing table ONCE.
 *
 * Runs AFTER `tx.save()`, so a write-back throw or a `tx.save` throw aborts
 * before the cache mutates. Mutating first leaves a phantom routing entry the
 * next dispatch event fires against, with state.json carrying no record of the
 * install, and only the next `/reload` clears the strand. Post-save the two
 * agree, so `/reload`'s factory-time hydrate (D-59-03) rebuilds the cache from
 * the same source of truth.
 *
 * WR-03: the rebuild keeps the routing table in lockstep with the cache, so a
 * standalone install starts dispatching to the new hooks immediately rather
 * than requiring `/reload` (NFR-2). It fires once for the whole cascade: the
 * table is rebuilt from the cache wholesale, so per-member rebuilds would
 * repeat identical work.
 *
 * WR-02: every mutation here is non-fatal. state.json already records the
 * install as successful, so a throw must NOT surface as `(failed)`; a failure
 * routes through `hookDebugLog` and the next hydrate closes the divergence.
 * A member whose read fails does not stop the members after it.
 *
 * Members declaring no hooks are skipped, which is every member of the
 * overwhelmingly common install -- so the no-hooks cascade does no work and
 * rebuilds nothing.
 */
async function hydrateInstalledHooks(args: {
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

/**
 * The one declaration an ORCHESTRATED install owes its own config entry.
 *
 * WR-09 forbids an orchestrated caller the full write-back -- reconcile derives
 * desired state FROM the merged config, so rewriting it would clobber a
 * per-machine override. It does NOT forbid the DFEN-04 / D-102-04 disabled
 * stamp, and that stamp must be declared or the very next `resources_discover`
 * undoes the install: without it the record lands disabled while the entry the
 * reconcile planner reads says nothing about enablement; the next reload reads
 * absent-as-enabled (D-04), finds the record disabled, and plans an enable,
 * re-enabling a plugin whose author declared it off.
 *
 * D-04-02: the cascade's dependencies are declared nowhere. The desired-state
 * config names only the plugins the user asked for by name; each dependency's
 * record carries `provenance: "dependency"`, and D-04-05's exemption in
 * `buildUninstallBucket` is what keeps that record out of the uninstall sweep
 * on the next reload.
 *
 * The stamp addresses `targetConfigPath` -- which for reconcile is the file the
 * plugin's own declaration lives in (see `InstallPluginOptions.local`) -- and
 * is spread over the existing entry, so no forward-compat key (D-09) and no
 * sibling entry is disturbed.
 *
 * The stamp's condition is the landed-disabled verdict and nothing else. That
 * verdict already required the caller's opt-in (so `import` never reaches
 * here, D-102-03) and an ABSENT `enabled` key (so a value the user wrote is
 * never rewritten, D-102-04); re-testing either would be a second, drift-prone
 * copy of the same gate.
 *
 * Nothing to declare writes nothing at all, which is the shape a plugin
 * installed enabled produces -- RECON-05 byte stability.
 *
 * The stamp goes through `writePluginConfigEntry`, SPLIT-02 / D-102-09's sole
 * sanctioned single-entry writer. The batched writer is not interchangeable
 * here: it always emits a `marketplaces` key, so routing the stamp through it
 * would add `"marketplaces": {}` to a file that declares none.
 */
async function writeOrchestratedDeclarations(args: {
  readonly current: ScopeConfig;
  readonly targetConfigPath: string;
  readonly scopeRoot: string;
  readonly plugin: string;
  readonly marketplace: string;
  readonly landedDisabled: boolean;
}): Promise<void> {
  if (args.landedDisabled) {
    await writePluginConfigEntry(
      args.current,
      args.targetConfigPath,
      args.scopeRoot,
      args.plugin,
      args.marketplace,
      { enabled: false },
    );
  }
}

/**
 * RESV-05: every `<plugin>@<marketplace>` key the target scope already records.
 * The cascade keeps a recorded ENABLED key as a walk wall -- it never becomes
 * a phase and no rollback reaches it -- and strips a recorded DISABLED key so
 * the walk re-enables it as a member (EDEP-03, `liveInstalledKeys`).
 */
function collectInstalledKeys(state: ExtensionState): ReadonlySet<string> {
  const keys = new Set<string>();
  for (const [marketplaceName, record] of Object.entries(state.marketplaces)) {
    for (const pluginName of Object.keys(record.plugins)) {
      keys.add(`${pluginName}@${marketplaceName}`);
    }
  }

  return keys;
}

/** Reads the selected root marketplace's validated policy from its cached manifest. */
async function loadInstallRootAllowlist(args: {
  readonly scope: Scope;
  readonly cwd: string;
  readonly marketplace: string;
  readonly state: ExtensionState;
}): Promise<ReadonlySet<string>> {
  const source = await resolveInstallMarketplaceSource({
    targetScope: args.scope,
    cwd: args.cwd,
    marketplace: args.marketplace,
    targetState: args.state,
  });
  if (source === undefined) {
    return new Set<string>();
  }

  const manifest = await loadMarketplaceManifest(source.sourceRecord.manifestPath);
  return new Set(manifest.allowCrossMarketplaceDependenciesOn ?? []);
}

/** Selects distinct foreign policies without letting their order outrank a same-marketplace grant. */
function originalDeclaringMarketplaces(
  declarers: readonly string[],
  marketplace: string,
): { sameMarketplace: boolean; foreign: ReadonlySet<string> } {
  const declaringMarketplaces = new Set<string>();
  for (const key of declarers) {
    const at = key.lastIndexOf("@");
    if (at <= 0 || at === key.length - 1) {
      continue;
    }

    const declaringMarketplace = key.slice(at + 1);
    if (declaringMarketplace === marketplace) {
      return { sameMarketplace: true, foreign: declaringMarketplaces };
    }

    declaringMarketplaces.add(declaringMarketplace);
  }

  return { sameMarketplace: false, foreign: declaringMarketplaces };
}

/** Reads each eligible original source's policy before a missing root can install. */
async function authorizeMissingDependency(args: {
  readonly scope: Scope;
  readonly cwd: string;
  readonly marketplace: string;
  readonly state: ExtensionState;
  readonly declarers: readonly string[];
}): Promise<boolean> {
  const sources = originalDeclaringMarketplaces(args.declarers, args.marketplace);
  if (sources.sameMarketplace) {
    return true;
  }

  let policyError: Error | undefined;
  for (const declaringMarketplace of sources.foreign) {
    try {
      const source = await resolveInstallMarketplaceSource({
        targetScope: args.scope,
        cwd: args.cwd,
        marketplace: declaringMarketplace,
        targetState: args.state,
      });
      if (source === undefined) {
        continue;
      }

      const manifest = await loadMarketplaceManifest(source.sourceRecord.manifestPath);
      if (manifest.allowCrossMarketplaceDependenciesOn?.includes(args.marketplace) === true) {
        return true;
      }
    } catch (err: unknown) {
      policyError ??= err as Error;
    }
  }

  if (policyError !== undefined) {
    throw policyError;
  }

  return false;
}

/**
 * The cascade's catalog read: one plugin's declared dependencies, in the
 * D-01-32 read order. The plugin's OWN manifest answers wherever it is readable
 * without a network call, and the marketplace entry that declares the plugin is
 * the fallback. `dependency-declaration-read.ts` owns that order and the
 * filesystem contract it rests on; this function locates the entry for it.
 *
 * NFR-5: fs-and-cache only. `resolveInstallMarketplaceSource` answers the
 * CMP-2..4 source-scope question from state, `loadMarketplaceManifest` is the
 * memoized PI-2 read of bytes already on disk, and the declaration read reaches
 * no materializing path at all.
 *
 * D-03-05: the read is handed the TARGET scope's locations, because that is the
 * scope every cascade member installs into and therefore the clone cache a
 * git-source member's manifest would live in.
 */
async function lookupCascadeDependencies(
  state: ExtensionState,
  core: { readonly scope: Scope; readonly cwd: string; readonly locations: ScopedLocations },
  subject: ClosureSubject,
): Promise<ClosureLookupResult> {
  const source = await resolveInstallMarketplaceSource({
    targetScope: core.scope,
    cwd: core.cwd,
    marketplace: subject.marketplace,
    targetState: state,
  });
  if (source === undefined) {
    return { kind: "absent" };
  }

  const manifest = await loadMarketplaceManifest(source.sourceRecord.manifestPath);
  const declared = lookupDeclaredPlugin(manifest, subject.name);
  if (declared.kind === "absent") {
    return { kind: "absent" };
  }

  return readDependencyDeclaration({
    marketplaceRoot: source.sourceRecord.marketplaceRoot,
    entry: declared.entry,
    locations: core.locations,
  });
}

/**
 * Where `unwrapCascade` leaves the structured failure for the catch site.
 *
 * The catch needs the DISCRIMINANT, not a rendered string, because RESV-06's
 * row names the failing dependency and the reason it failed -- neither of which
 * survives a `throw new Error(text)`. The sink carries it across the lock
 * closure boundary the same way `capture` carries the rollback partials: both
 * are written BEFORE the rethrow, which is why neither can ride the closure's
 * `InstallTransactionOutcome` return.
 */
interface CascadeFailureSink {
  subject?: CascadeFailureSubject;
}

/**
 * Route the cascade's outcome onto install's existing three dispositions:
 * the installed arm, the `marketplace-absent` sentinel (reported as
 * `undefined`, so the caller returns from inside the lock WITHOUT `tx.save()`),
 * or a throw the guard's own catch composes into failed rows.
 *
 * A `member-failed` whose key is the ROOT records no subject: nothing but the
 * requested plugin failed, so it is a single-plugin install failure and belongs
 * on the existing single-row path, which classifies entity-shape errors and
 * git-auth challenges the cascade block has no arm for.
 *
 * The cascade's rollback partials are appended to whatever the failing member's
 * OWN bridge-level ledger already captured; both are real undo failures and
 * neither may shadow the other.
 */
function unwrapCascade(
  cascade: InstallCascadeResult,
  capture: InstallFailureCapture,
  rootKey: string,
  sink: CascadeFailureSink,
): Extract<InstallCascadeResult, { readonly kind: "installed" }> | undefined {
  if (cascade.kind === "marketplace-absent") {
    return undefined;
  }

  if (cascade.kind === "closure-failed") {
    sink.subject = { kind: "closure", failure: cascade.failure };
    throw cascadeFailureCause(sink.subject, rootKey);
  }

  // RESV-03: the constraint verdict is reached before any member becomes a
  // ledger phase, so this arm carries nothing to roll back -- it throws for the
  // same reason the closure arm does, into the same catch, which composes the
  // failed rows.
  if (cascade.kind === "constraint-failed") {
    sink.subject = { kind: "constraint", failure: cascade.failure };
    throw cascadeFailureCause(sink.subject, rootKey);
  }

  if (cascade.kind === "member-failed") {
    capture.rollbackPartials = [...capture.rollbackPartials, ...cascade.rollbackPartials];
    if (cascade.key !== rootKey) {
      sink.subject = {
        kind: "member",
        key: cascade.key,
        error: cascade.error,
        rollbackPartials: capture.rollbackPartials,
      };
    }

    throw cascade.error;
  }

  return cascade;
}

/**
 * POST-state-commit side effects and their soft warnings (D-08 / AS-6 /
 * AS-7 / WARN-01). The state record is already committed, so every arm is
 * defensive: a failure here must not strand a successful install.
 *
 * D-19-01 gates the HYGIENE warnings on orchestrated mode, where the cascade
 * caller owns a `pushDiagnostic` channel. A deferred data-dir mkdir or a
 * deferred completion-cache refresh describes housekeeping the extension
 * will retry; `MarketplaceNotificationMessage` has no field for one, and a
 * standalone user has nothing to do about it.
 *
 * D-141-03 amends that for the DISCOVERY warnings, which ride
 * `installCtx.discoveryWarnings` and surface in BOTH modes. A discovery
 * warning says the installed artifact set does not match what the plugin
 * author shipped, and the install row's resource count gives the user no
 * baseline to notice the shortfall. The caller renders the standalone half
 * through `./shared.ts::surfaceDiscoveryWarnings`, which update and
 * reinstall also call (D-141-05). The skills, commands and workflows bridges
 * feed that array; the agents bridge mixes three kinds of warning onto one
 * result field and rides the hygiene channel instead.
 */
async function collectPostCommitWarnings(
  installCtx: InstallLedgerSummary,
  completionCache: CompletionCache,
  scope: Scope,
  orchestrated: boolean,
): Promise<string[]> {
  const { locations, marketplace, plugin } = installCtx;
  const warnings: string[] = [];
  // Hygiene warnings ride the returned array only in orchestrated mode
  // (D-19-01); logged unconditionally either way so a standalone install
  // does not drop the failure without a trace.
  const push = (msg: string): void => {
    hookDebugLog(msg);
    if (orchestrated) {
      warnings.push(msg);
    }
  };

  // D-141-03: never gated. In standalone mode these are the only strings the
  // returned array carries, which is what the caller's notifyDiagnostic
  // surface renders.
  warnings.push(...installCtx.discoveryWarnings);

  // AS-6 / D-08: eager per-plugin data dir mkdir.
  try {
    await mkdir(installCtx.pluginDataDir, { recursive: true });
  } catch (mkdirErr) {
    push(
      `Plugin "${plugin}" installed; data dir creation deferred at ${installCtx.pluginDataDir}: ${errorMessage(mkdirErr)}`,
    );
  }

  // D-03-INV: the plugin moved from "available" to "installed", so drop the
  // cached plugin index for this marketplace and let the next completion
  // read rebuild it with the new status.
  try {
    await completionCache.dropMarketplaceCache(
      await locations.pluginCacheFile(marketplace),
      scope,
      marketplace,
    );
  } catch (err) {
    push(`Plugin "${plugin}" installed; completion cache refresh deferred: ${errorMessage(err)}`);
  }

  // AS-7 / W-08 / B-08: agents-bridge preserved foreign-content rows during
  // prepare. The NEW agents installed; the preserved rows are a
  // manual-cleanup hint recorded in agents-index.json regardless.
  if (installCtx.agentForeignFailures.length > 0) {
    const detail = installCtx.agentForeignFailures
      .map((f) => `${f.generatedName}: ${f.reason}`)
      .join("; ");
    push(
      `Plugin "${plugin}" installed; ${installCtx.agentForeignFailures.length.toString()} pre-existing agent file(s) preserved on disk: ${detail}`,
    );
  }

  // WARN-01 / D-86-03: skills/commands whose SOURCE frontmatter could not be
  // parsed were degraded (synthesized / neutralized) but still installed.
  // The per-component detail rides here; the closed-set reason token rides
  // the install row.
  for (const d of installCtx.frontmatterDegradations) {
    push(`${plugin}/${d.generatedName}: ${d.parseError}`);
  }

  // Bridge-side soft warnings (e.g. agents-bridge cleanup-leak return values
  // aggregated during the staged phases).
  for (const w of installCtx.bridgeWarnings) {
    push(w);
  }

  // WLIF-01: sweep workflow staging trees a previous run abandoned. Installing
  // is what creates them, so the install side has to sweep or a machine that
  // never uninstalls never would. Debug-logged only (D-19-01): no row is
  // pushed, because a cleanup the user did not ask for does not narrate itself.
  try {
    const leaks = await garbageCollectWorkflowsStaging(installCtx.locations);
    if (leaks.length > 0) {
      hookDebugLog(
        `install: workflows staging GC left ${leaks.length.toString()} tree(s) for ${plugin}@${marketplace}: ${leaks.join("; ")}`,
      );
    }
  } catch (err) {
    // D-19-01: hygienic cleanup never becomes the primary user-facing path.
    hookDebugLog(
      `install: workflows staging GC failed for ${plugin}@${marketplace}: ${errorMessage(err)}`,
    );
  }

  return warnings;
}

/**
 * WARN-01 / D-86-03: one `{malformed skill}` / `{malformed command}` token per
 * plugin regardless of how many components of that kind degraded. Hoisted out
 * of the row composers so the success row and the DFEN-04 disabled row read
 * the SAME list -- a malformed component is a durable fact about what the
 * plugin will materialize, so both rows owe it to the user; only the row's own
 * status decides which of them is rendered. The free-text parse-error detail
 * rides `postCommitWarnings` (orchestrated only).
 */
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
  // pi-subagents}`, `{requires pi-mcp}`, `{requires pi-dynamic-workflows}`)
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

/**
 * Emit a single-plugin `(failed)` row and return the matching outcome.
 * Shared by the CFG-03 invalid-config abort and the defensive
 * internal-error arm, which differ only in their reason token.
 *
 * CR-02: row-level `scope` is OMITTED -- the marketplace block carries the
 * same scope and `renderScopeBracket` suppresses the duplicate.
 */
function failedRowOutcome(args: {
  readonly ctx: NotificationContext;
  readonly pi: ToolInventory;
  readonly marketplace: string;
  readonly scope: Scope;
  readonly plugin: string;
  readonly error: Error;
  readonly reasons: readonly ContentReason[];
  readonly orchestrated: boolean;
}): InstallPluginOutcome {
  const { ctx, pi, marketplace, scope, plugin, error, reasons, orchestrated } = args;
  const cause = error.message;
  if (orchestrated) {
    return { status: "failed", error, cause };
  }

  notifyWithContext(
    ctx,
    pi,
    INSTALL_CONTEXT,
    [
      {
        name: marketplace,
        scope,
        plugins: [
          {
            status: "failed",
            severity: "error" as const,
            name: plugin,
            reasons,
            cause: error,
          },
        ],
      },
    ],
    undefined,
    "single",
  );
  return { status: "failed", error, cause };
}

/**
 * D-04-07: what the promotion arm hands the post-guard row -- the promoted
 * record's version and what it declares, and the plugin as this command
 * re-materialized it when the record was disabled (empty when its artifacts
 * were already on disk). The row reads these rather than the record itself
 * because the state phase replaces the record object when it re-materializes.
 */
interface PromotionOutcome {
  readonly version: string;
  readonly declaresAgents: boolean;
  readonly declaresMcp: boolean;
  readonly declaresWorkflows: boolean;
  readonly materialized: readonly HydratableMember[];
}

interface PromotionArgs {
  readonly opts: InstallPluginOptions;
  readonly state: ExtensionState;
  readonly locations: ScopedLocations;
  readonly orchestrated: boolean;
  readonly config: {
    readonly current: ScopeConfig;
    readonly sibling: ScopeConfig | undefined;
    readonly targetConfigPath: string;
  };
  readonly capture: InstallFailureCapture;
  readonly transaction: InstallTransaction;
}

/**
 * D-04-07: promote a recorded dependency the user has now asked for by name.
 * The whole decision lives here so the lock closure gains one condition: the
 * target plugin is absent from the snapshot, or is recorded as a direct
 * install already, and the answer is `undefined` -- the cascade runs and the
 * existing already-installed refusal stands for the second case. Otherwise the
 * record's provenance flips to the direct-install value.
 *
 * A record with its artifacts on disk changes in nothing else: no ledger
 * runs, so version, resources and timestamps stay what the cascade wrote
 * (re-running the ledger with its existing-record allowance would
 * re-materialize the plugin and rewrite all three).
 *
 * A plugin asked for by name is enabled, so a record that was disabled is
 * re-materialized here the way the enable branch re-materializes it, and its
 * declaration carries the `enabled: true` the enable path writes. A bare key
 * would not do: under a `--local` write it replaces a base `{ enabled: false }`
 * entry wholesale (CFG-02), enabling by omission what this arm enables on
 * purpose.
 *
 * The match is the exact `plugin` and `marketplace` names the snapshot is
 * keyed by, the same character-for-character comparison the cascade root and
 * reconcile's declared-key set use: no folding, no normalizing, no trimming.
 */
async function promoteDependencyRecord(args: PromotionArgs): Promise<PromotionOutcome | undefined> {
  const { marketplace, plugin } = args.opts;
  const record = args.state.marketplaces[marketplace]?.plugins[plugin];
  if (record?.provenance !== "dependency" || refusesPromotion(args.opts, record)) {
    return undefined;
  }

  record.provenance = "explicit";
  if (!isRecordedButDisabled(record)) {
    await declarePromotedPlugin(args, {});
    return {
      version: record.version,
      declaresAgents: record.resources.agents.length > 0,
      declaresMcp: record.resources.mcpServers.length > 0,
      declaresWorkflows: record.resources.workflows.length > 0,
      materialized: [],
    };
  }

  const summary = await materializePromotedRecord(args, record);
  await declarePromotedPlugin(args, { enabled: true });
  return {
    version: summary.version,
    declaresAgents: summary.stagedAgentNames.length > 0,
    declaresMcp: summary.stagedMcpServerNames.length > 0,
    declaresWorkflows: summary.stagedWorkflowNames.length > 0,
    materialized: [
      {
        key: `${plugin}@${marketplace}`,
        name: plugin,
        marketplace,
        pluginRoot: summary.resolved.pluginRoot,
        hooksConfigPath: summary.resolved.hooksConfigPath,
      },
    ],
  };
}

/**
 * D-04-07: the install flags a promotion answers. A version pin asks for a
 * version the promotion cannot deliver -- no ledger resolves one, and `update`
 * and `reinstall` are the verbs that act on versions -- so it refuses, and the
 * already-installed refusal the cascade then raises stands. `--partial` is the
 * consent gate for a record that is only partially installed: promoting it by
 * name means accepting its degraded shape, as any other partial install does,
 * so without the flag the same refusal stands; on a fully-supported record the
 * flag changes nothing. `--map-model` states how generated agents are written
 * and a promotion generates none, so it has no bearing either way.
 */
function refusesPromotion(opts: InstallPluginOptions, record: PluginInstallRecord): boolean {
  return (
    opts.pinVersionOverride !== undefined ||
    (!record.compatibility.installable && opts.partial !== true)
  );
}

/**
 * D-04-02: the user has asked for the plugin by name, so its key now belongs
 * in the desired-state config. The write is the same adopting write the
 * standalone install arm makes for a fresh install -- the promoted key plus
 * the marketplace entry when the merged view does not declare it yet -- and
 * it is SKIPPED in orchestrated mode, as every write arm in this file is
 * (reconcile derives desired state FROM the merged config; writing back would
 * clobber a per-machine override).
 */
async function declarePromotedPlugin(
  args: PromotionArgs,
  pluginPatch: Partial<PluginConfigEntry>,
): Promise<void> {
  if (args.orchestrated) {
    return;
  }

  await writeAdoptingConfigEntries({
    current: args.config.current,
    sibling: args.config.sibling,
    state: args.state,
    marketplace: args.opts.marketplace,
    plugin: args.opts.plugin,
    targetConfigPath: args.config.targetConfigPath,
    scopeRoot: args.locations.scopeRoot,
    pluginPatch,
  });
}

/**
 * CR-01 / CR-06: mirrors `enable-disable.ts::writeReEnabledMemberConfigEntries`
 * for the install cascade's own re-enable arm (EDEP-03). A re-enabled member
 * whose key the target-scope config ALREADY declares with `enabled: false`
 * -- exactly what `disable <dep>` writes -- is patched to `true`.
 * `overwriteDisabledMemberEntries` selects each member's file by DECLARATION
 * ALONE, not by the flag the caller typed for the root, so a base-file entry
 * is found even under `--local`. A member the config does not mention at all
 * stays untouched (D-04-02: the config names only what the user asked for by
 * name). Called only when the install's own root write-back also runs
 * (never orchestrated), and at the SAME point in the lock -- a config write
 * is not undone by `runPhases`.
 */
async function writeReEnabledCascadeMemberConfigEntries(
  locations: ScopedLocations,
  state: ExtensionState,
  members: readonly CascadeMemberOutcome[],
): Promise<void> {
  await overwriteDisabledMemberEntries({
    locations,
    state,
    keys: members.filter((member) => member.reEnabledFromRecord).map((member) => member.key),
    select: selectDeclaringConfigWriteTarget,
    write: writeAdoptingConfigEntries,
  });
}

type InstalledLedgerResult = Extract<InstallLedgerResult, { readonly kind: "installed" }>;

/**
 * The promotion found the marketplace and its record in the snapshot it hands
 * the ledger synchronously, and the ledger's sole marketplace-absent producer
 * rereads that same slot, so this path cannot produce the absent arm. Type
 * narrowing only; the invariant is established by the caller.
 */
function assertPromotedLedgerInstalled(
  _result: InstallLedgerResult,
): asserts _result is InstalledLedgerResult {
  // Evidence-backed type narrowing only; the invariant is established by the caller.
}

/**
 * D-04-07 / ENBL-02: re-materialize a promoted record that was disabled, the
 * way the enable branch does -- the guard-free ledger over THIS closure's
 * snapshot, pinned to the recorded version and allowed to keep the existing
 * record, with the gate picked by the record's own availability (ENBL-07): a
 * record disabled while partially installed re-materializes its degraded
 * shape. `--map-model` is not threaded, as the enable branch does not thread
 * it. The state phase replaces the record with `enabled: true` and carries
 * the flipped provenance across.
 *
 * A ledger throw propagates out of the lock closure before its save, so the
 * provenance flip is discarded with the rest of the snapshot and the install
 * failure row reports the cause with the rollback rows `capture` collected.
 */
async function materializePromotedRecord(
  args: PromotionArgs,
  record: PluginInstallRecord,
): Promise<InstallLedgerSummary> {
  const { opts } = args;
  const result = await runInstallLedger(
    args.state,
    args.locations,
    {
      ctx: opts.ctx,
      scope: opts.scope,
      cwd: opts.cwd,
      marketplace: opts.marketplace,
      plugin: opts.plugin,
      pinVersionOverride: record.version,
      allowExistingRecord: true,
      partial: !record.compatibility.installable,
      removalOps: createRemovalOps(),
    },
    args.capture,
    args.transaction,
  );
  assertPromotedLedgerInstalled(result);
  return result.summary;
}

/**
 * D-04-07: emit the promotion row and return the matching outcome. Mirrors
 * `failedRowOutcome`: orchestrated mode returns the outcome and emits nothing.
 * The outcome is an `installed` one stamped `promoted`, whose resources changed
 * only when the promotion re-materialized a disabled record -- otherwise the
 * record was here before and only its provenance moved -- and whose
 * declares-flags read the record's own inventory, so an orchestrated caller
 * describes the promoted plugin as it is rather than as empty. The row stamps
 * the reload hint on the same condition, as the enable verb's fresh row does.
 */
function promotedRowOutcome(args: {
  readonly ctx: NotificationContext;
  readonly pi: ToolInventory;
  readonly marketplace: string;
  readonly scope: Scope;
  readonly plugin: string;
  readonly promotion: PromotionOutcome;
  readonly orchestrated: boolean;
}): InstallPluginOutcome {
  const { ctx, pi, marketplace, scope, plugin, promotion, orchestrated } = args;
  const enabled = promotion.materialized.length > 0;
  const outcome: InstallPluginOutcome = {
    status: "installed",
    version: promotion.version,
    resourcesChanged: enabled,
    declaresAgents: promotion.declaresAgents,
    declaresMcp: promotion.declaresMcp,
    declaresWorkflows: promotion.declaresWorkflows,
    promoted: true,
  };
  if (!orchestrated) {
    notifyWithContext(
      ctx,
      pi,
      INSTALL_CONTEXT,
      [
        {
          name: marketplace,
          scope,
          plugins: [
            composePromotedRow({ plugin, version: promotion.version, scope, needsReload: enabled }),
          ],
        },
      ],
      undefined,
      "single",
    );
  }

  return outcome;
}

/**
 * D-19-03 failure routing for a throw out of the state guard. Priority,
 * highest first:
 *
 *   1. Formatted ledger errors -- `formatRollbackError` has already preserved
 *      containment errors or wrapped partial failures and supplied the raw
 *      rollback rows. This function only projects those values.
 *   2. Entity-shape errors (PI-3 / PI-4 / PI-5) -- the classifier's
 *      `status: "failed" | "unavailable"` discriminator is preserved
 *      verbatim.
 *   3. Generic runtime error -- reasons: [] and cause: err; the renderer
 *      suppresses the empty brace per D-15-01.
 */
function handleInstallThrow(args: {
  readonly err: unknown;
  readonly ctx: NotificationContext;
  readonly pi: ToolInventory;
  readonly marketplace: string;
  readonly scope: Scope;
  readonly plugin: string;
  readonly capture: InstallFailureCapture;
  readonly orchestrated: boolean;
}): InstallPluginOutcome {
  const { err, ctx, pi, marketplace, scope, plugin, capture, orchestrated } = args;
  const rolledBackPartial = capture.rollbackPartials.length > 0;
  const entityErrorRow = classifyEntityShapeError(err, { plugin, marketplace, scope });
  const failureMessage = composeInstallFailureMessage({
    err,
    plugin,
    scope,
    version: capture.version,
    rolledBackPartial,
    rollbackPartials: capture.rollbackPartials,
    entityErrorRow,
  });

  if (orchestrated) {
    // The typed Error remains the dispatch surface; `cause` is the formatted
    // text for callers that render it directly.
    return classifyInstallFailure(err, formatOrchestratedCause(err));
  }

  notifyWithContext(
    ctx,
    pi,
    INSTALL_CONTEXT,
    [
      {
        name: marketplace,
        scope,
        plugins: [failureMessage],
      },
    ],
    undefined,
    "single",
  );
  const wrapped = err instanceof Error ? err : new Error(errorMessage(err));
  return { status: "failed", error: wrapped, cause: formatOrchestratedCause(err) };
}

/**
 * RESV-06 failure routing for a throw a DEPENDENCY caused.
 *
 * Distinct from `handleInstallThrow` in exactly one respect: the block it emits
 * names the failing dependency as its subject and carries the requesting
 * plugin's own row beside it, instead of reporting the requested plugin alone
 * for something it did not do. The outcome contract is unchanged -- the typed
 * Error stays the dispatch surface and `cause` stays the formatted text -- so an
 * orchestrated caller sees exactly what it saw before.
 */
function handleCascadeThrow(args: {
  readonly ctx: NotificationContext;
  readonly pi: ToolInventory;
  readonly marketplace: string;
  readonly scope: Scope;
  readonly plugin: string;
  readonly rootKey: string;
  readonly subject: CascadeFailureSubject;
  readonly orchestrated: boolean;
}): InstallPluginOutcome {
  const { ctx, pi, marketplace, scope, plugin, rootKey, subject, orchestrated } = args;
  // Derived from the SUBJECT rather than from the caught value. The subject is
  // recorded only at a throw site that throws exactly this Error, so the two
  // agree by construction -- and reading it here means the outcome's typed
  // `error` needs no `unknown` widening a cascade arm can never produce.
  const error = cascadeFailureCause(subject, rootKey);
  const cause = formatOrchestratedCause(error);
  if (orchestrated) {
    return { status: "failed", error, cause };
  }

  notifyWithContext(
    ctx,
    pi,
    CASCADE_CONTEXT,
    [
      {
        name: marketplace,
        scope,
        plugins: composeCascadeFailureMessage({ scope, rootKey, rootName: plugin, subject }),
      },
    ],
    undefined,
    "single",
  );
  return { status: "failed", error, cause };
}

/**
 * Outcome of the `withLockedStateTransaction` closure in
 * `installPluginWithTransaction`, mirroring the `SetEnabledOutcome` pattern
 * `enable-disable.ts` uses for its own locked-transaction closure: one typed
 * return instead of several `let`/`const` captures the closure writes to and
 * the post-guard code reads back out, so a forgotten arm is a compile error
 * rather than a runtime `undefined`.
 *
 * - `"invalid-config"` -- WB-01 / CFG-03 / T-56-03-04: the targeted config
 *   file (or, on the flagless path, the local file) could not be read.
 *   `configBasename`, set by the closure as a side effect for the same
 *   reason `enable-disable.ts` keeps its own copy of that `let` (T-53-02-02),
 *   carries the file name for the failed row composed after the lock closes.
 * - `"marketplace-absent"` -- ATTR-01 / ATTR-08 / M1: marketplace-existence
 *   is a PRECONDITION, not a plugin-row property. The CMP-2..4 source
 *   resolution missed (the marketplace is absent in the target scope AND the
 *   CMP-3 user fallback also missed), so the failure subject is the
 *   MARKETPLACE, not the plugin -- distinct from M2 (plugin absent from a
 *   PRESENT manifest), which stays `{not in manifest}` on the plugin row.
 * - `"promoted"` -- D-04-07: a recorded dependency the user has now named was
 *   promoted instead of cascaded. State was saved and any hooks hydrated
 *   inside the lock; the row is the whole report.
 * - `"disable-cascade-failed"` -- D-102-02: the ledger succeeded and landed
 *   disabled (DFEN-04), then the disable cascade itself failed. The shrunken
 *   record is already saved inside the lock; `cause` is the cascade's own
 *   error, surfaced as the existing install failure row.
 * - `"installed"` -- the realized install. `landedDisabled` is the DFEN-04 /
 *   D-102-01 verdict: true when the plugin installed with `enabled: false`
 *   because the caller opted in, both physical config files were silent on
 *   `enabled`, and the plugin's own resolved declaration says false.
 *   `members` and `alreadyInstalled` are the cascade's closure (RESV-06), one
 *   row each in the post-guard block; both are empty for a plugin that
 *   declares nothing, so its block stays the single row it always was.
 */
type InstallTransactionOutcome =
  | { kind: "invalid-config" }
  | { kind: "marketplace-absent" }
  | { kind: "promoted"; promotion: PromotionOutcome }
  | { kind: "disable-cascade-failed"; cause: Error }
  | {
      kind: "installed";
      installCtx: InstallLedgerSummary;
      landedDisabled: boolean;
      members: readonly CascadeMemberOutcome[];
      alreadyInstalled: readonly CascadeSkippedMember[];
    };

/**
 * PI-1..15 entrypoint. The function never re-throws -- failures surface
 * via a single `notify()` call carrying a `PluginFailedMessage`
 * (Pattern S-1 single chokepoint, IL-2 lint gate). Standalone-mode emits
 * exactly one notification per orchestration arm; orchestrated-mode emits
 * none and returns the typed outcome.
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
// Install sequencing walks the PI-1..15 flow: the state guard, the ledger
// call, failure routing, and post-commit/notification composition. The
// order of those steps stays visible here; the step bodies themselves are
// extracted above (`buildInstallLedgerOptions`, `collectPostCommitWarnings`,
// `composeInstalledRow`, `buildInstalledOutcome`, `handleInstallThrow`).
async function installPluginWithTransaction(
  transaction: InstallTransaction,
  hooksRouting: InstallHooksRouting,
  completionCache: CompletionCache,
  opts: InstallPluginOptions,
): Promise<InstallPluginOutcome> {
  const { ctx, pi, scope, cwd, marketplace, plugin } = opts;
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
  const cascadeFailure: CascadeFailureSink = {};

  // WB-01: target-path selection happens ONCE, and both write arms below read
  // that one decision, so they cannot drift onto different files. The
  // orchestrator NEVER falls back to the base file on ENOENT: the base file is
  // NEVER touched on the --local path, and loadConfig's `absent` arm yields an
  // empty starting shape that saveConfig writes back to the local path. UAT-05:
  // the sibling path is the scope's OTHER physical file, read fresh inside the
  // lock for the merged-view membership test ONLY -- never written, never
  // serialized back.
  //
  // D-103-16: the selection now happens INSIDE the lock, because absent the
  // flag it READS the local config to find where the declaration lives. A
  // typed `--local` still targets the local file unconditionally; with no flag
  // the target follows the DECLARATION, and only a key declared in neither file
  // falls through to the base file (the shape of every fresh install). CFG-02
  // replaces a same-keyed base entry WHOLESALE, so a stamp written to the base
  // file under a local declaration moves no merged value: the install reports
  // success, the merged view the reconcile planner reads is unchanged, and
  // every reload from then on plans an enable for a plugin that declared
  // itself off.
  //
  // T-53-02-02: the CFG-03 abort row carries the TARGETED file's basename, and
  // that row renders after the lock closes, so the basename escapes the closure
  // through this `let`. It starts at the base file -- the value the no-flag,
  // no-declaration arm yields -- so the pre-assignment value is never wrong and
  // the type stays definite.
  let configBasename = path.basename(locations.configJsonPath);
  const orchestrated = opts.notifications?.mode === "orchestrated";
  // The requested plugin's key: the cascade's root, the write-target selection
  // subject and the DFEN-05 precedence subject are all the same key by
  // construction, so they read one binding rather than three literals.
  const rootKey = `${plugin}@${marketplace}`;

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
    outcome = await transaction.withLockedStateTransaction(
      locations,
      async (tx): Promise<InstallTransactionOutcome> => {
        // D-103-16: ONE selection, made before anything reads a config path, so
        // the CFG-03 load, the DFEN-05 precedence read and BOTH write arms below
        // address the same physical file. It runs inside the lock because it
        // READS the local config -- the WB-01 discipline that sibling reads
        // happen fresh under the lock the write also holds.
        //
        // `targetIsLocal` comes back from the selector rather than being
        // re-derived here: `resolveInstallDeclaredEnabled` picks the effective ENTRY by
        // physical-file IDENTITY before it reads that entry's `enabled` field, so
        // labelling the selected file with the caller's flag instead of with its
        // own identity swaps which of `current` and the sibling is treated as the
        // local file. Under a local declaration and no flag that inversion reads
        // the base file's bare entry as the effective one, reports `enabled`
        // absent, fires the landed-disabled verdict against the user's explicit
        // `enabled: true`, and then stamps `enabled: false` over it (a DFEN-05
        // violation). The selector computed the locality; asking it is exact
        // where any second derivation is a chance to disagree.
        const selection = await selectDeclaringConfigWriteTarget({
          locations,
          local: opts.local,
          key: rootKey,
        });

        const state = tx.state;
        // CFG-03 / T-56-03-04: abort BEFORE any state mutation. The
        // basename-only message prevents an absolute-path information leak.
        // NO tx.save() -- state.json bytes and mtime are untouched.
        //
        // The arm covers the TARGETED file being unreadable and, on the flagless
        // path, the local file being unreadable while the base file is fine: the
        // local file is what DECIDES the destination there, so an unreadable one
        // leaves the destination unknown. Naming that file in a row the user can
        // act on beats writing to the file CFG-02 would then shadow.
        if (selection.kind === "unreadable") {
          configBasename = path.basename(selection.filePath);
          return { kind: "invalid-config" };
        }

        // DFEN-05: the TARGET physical config, parsed ONCE by the selector and
        // shared by the precedence gate below and the write-back further down --
        // as is the sibling, so one operation reads each file once and no two
        // decisions can rest on different bytes of the same file. Never a merged
        // view -- `config-write-back.ts` is forbidden from importing
        // `config-merge.ts`, and serializing a merged view back would copy the
        // local file's entries into the base file (SPLIT-02).
        const { targetConfigPath, targetIsLocal, current, sibling } = selection;
        configBasename = path.basename(targetConfigPath);

        // D-04-07: a recorded dependency the user has now named is promoted
        // here, BEFORE the cascade -- the cascade's ledger would refuse it as
        // already installed on an arm that never saves. This is the file's
        // second mutating arm: the promotion saves explicitly and returns.
        const promotion = await promoteDependencyRecord({
          opts,
          state,
          locations,
          orchestrated,
          config: { current, sibling, targetConfigPath },
          capture,
          transaction,
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
        const cascade = await runInstallCascade({
          state,
          locations,
          rootKey,
          rootAllowedMarketplaces: await loadInstallRootAllowlist({
            scope,
            cwd,
            marketplace,
            state,
          }),
          lookup: (subject) => lookupCascadeDependencies(state, { scope, cwd, locations }, subject),
          // RESV-03 / CMP-3: the pin probe reads a member's source out of the
          // marketplace record, and it must reach that record the same way the
          // walk's own catalog read does. Reading the target snapshot directly
          // would answer "no source" for a marketplace the CMP-3 fallback
          // resolves, turning a resolvable constrained dependency into a
          // `no-matching-tag` it never earned.
          marketplaceRecordFor: async (marketplace) =>
            (
              await resolveInstallMarketplaceSource({
                targetScope: scope,
                cwd,
                marketplace,
                targetState: state,
              })
            )?.sourceRecord,
          // RESV-03: a member whose constraint selected a release tag carries the
          // commit that tag resolves to AND the semver that tag names, and this
          // builder is where both enter that member's install. An unconstrained
          // member carries neither and installs from the ref its marketplace
          // entry names.
          //
          // RESV-05: recording the tag's semver rather than the git-source
          // `sha-<12hex>` is what makes the pin readable back. The next install
          // that constrains this dependency checks the RECORDED version against
          // the range, and a sha form either satisfies nothing or coerces to an
          // arbitrary digit run (D-03-04) -- so without the semver a repeat of
          // the same command fails the constraint it had just satisfied.
          //
          // The caller's own `pinVersionOverride` reaches the plugin the caller
          // NAMED and no other member. It takes absolute precedence in
          // `deriveInstallVersion`, so copying it onto every member would record
          // each dependency under the requesting plugin's version string.
          ledgerOptionsFor: (member) => {
            const isRoot = member.key === rootKey;
            const pinVersion =
              member.pin?.version ?? (isRoot ? opts.pinVersionOverride : undefined);
            return buildInstallLedgerOptions(opts, {
              scope,
              cwd,
              marketplace: member.marketplace,
              plugin: member.name,
              ...(member.pin !== undefined && { sourcePin: member.pin.oid }),
              ...(pinVersion !== undefined && { pinVersion }),
              // D-04-01: the root is the one member the closure walk never
              // skips, so the key comparison alone decides provenance -- per
              // member, independent of install order.
              provenance: isRoot ? "explicit" : "dependency",
            });
          },
          installedKeys: collectInstalledKeys(state),
          // D-03-08: the marketplaces this install can READ. A dependency naming
          // anything else fails the cascade; nothing here can add or clone a
          // marketplace to satisfy one.
          //
          // It is the CMP-3-aware set and NOT the raw target-scope key set,
          // because the walk's own catalog read resolves through the same
          // project -> user fallback. Seeding the guard from the narrower set
          // would put two notions of "reachable" in one walk, and the guard runs
          // FIRST -- so the stricter one would win and refuse a dependency the
          // lookup one step later resolves, under the one cascade message that
          // carries a trust rule. Every name in this set is one the user added
          // themselves, so that trust rule is unchanged.
          //
          // The requested plugin's own marketplace needs no special seeding: it
          // is in this set whenever the ledger could resolve it, and the ledger
          // still owns reporting the double-miss through the `marketplace-absent`
          // arm below.
          knownMarketplaces: await collectInstallReachableMarketplaces({
            targetScope: scope,
            cwd,
            targetState: state,
          }),
          capture,
          transaction,
          ...(opts.tagProbe !== undefined && { tagProbe: opts.tagProbe }),
          ...(opts.marketplaceTagProbe !== undefined && {
            marketplaceTagProbe: opts.marketplaceTagProbe,
          }),
        });
        const installed = unwrapCascade(cascade, capture, rootKey, cascadeFailure);
        if (installed === undefined) {
          // WR-04: precondition miss -- read-only in effect, NO tx.save().
          return { kind: "marketplace-absent" };
        }

        // Success: the install context this closure just produced.
        const installCtx = installed.root;

        // DFEN-04 / DFEN-05: the install lands disabled only when all three hold
        // -- the caller opted in, the user has stated NO opinion in EITHER of the
        // scope's two physical config files (an explicit `enabled` wins in either
        // direction and is never overwritten; `isDeclaredEnabled` answers "is it
        // enabled", which is a different question), and the plugin's resolved
        // declaration says false. `defaultEnabled` is a plain boolean on the
        // materializable arms, so there is no `?? true` fallback to re-derive
        // here. CFG-02: the read spans both files because a local entry replaces
        // the base entry wholesale whatever the write target is; `current` stays
        // the TARGET file and steers the write arms below and nothing else.
        const declaredEnabled = resolveInstallDeclaredEnabled({
          current,
          sibling,
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
        // CR-02: when the scope's MERGED config view does
        // not declare the marketplace -- the CMP-3 user-scope fallback adopted
        // a cloned record into THIS scope's state, but `marketplace add` only
        // ever ran at user scope -- declare the marketplace entry in the SAME
        // batched patch (same lock, one atomic save). Without it the plugin
        // key is a dangling declaration: the next reconcile plans the adopted
        // clone's REMOVAL and renders a perpetual `<marketplace not declared>`
        // failed row (invariant 5 violation).
        //
        // UAT-05: the membership gate must consider BOTH physical files
        // (base ∪ local), not just the target. A `--local` install against a
        // base-declared marketplace must NOT re-declare it in the local file:
        // the bare `{source}` entry would shadow the base entry wholesale
        // (CFG-02) and silently flip merged `autoupdate`. Both files are read
        // fresh INSIDE the lock and used for the membership test only, and an
        // UNREADABLE sibling skips the adoption write rather than counting as a
        // file that declares nothing.
        if (opts.notifications?.mode !== "orchestrated") {
          await writeAdoptingConfigEntries({
            current,
            sibling,
            state,
            marketplace,
            plugin,
            targetConfigPath,
            scopeRoot: locations.scopeRoot,
            // DFEN-04: the plugin key alone unless the install actually landed
            // disabled, in which case the declaration carries it through.
            // D-04-02: the cascade's dependencies are declared nowhere -- each
            // record carries `provenance: "dependency"`, which D-04-05's
            // reconcile exemption reads on the next reload.
            //
            // S4 (PR #51, CONTEXT.md S4): the helper's `adoptedSource === undefined`
            // arms collapse -- benign (already declared) and dangerous (no string
            // `source.raw` to synthesize from). This site therefore still writes a
            // dangling declaration in the dangerous arm; acknowledged trade-off
            // pending a widen of the helper's return that would route it to a
            // (failed) row.
            pluginPatch: { ...(landedDisabled && { enabled: false }) },
          });
          await writeReEnabledCascadeMemberConfigEntries(locations, state, installed.members);
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
          return { kind: "disable-cascade-failed", cause: cascadeError };
        }

        return {
          kind: "installed",
          installCtx,
          landedDisabled,
          members: installed.members,
          alreadyInstalled: installed.alreadyInstalled,
        };
      },
    );
  } catch (err) {
    // RESV-06: a dependency is what failed, so the block names it. Routed here
    // rather than through the single-row path below, which would report the
    // plugin the user typed for something one of its dependencies did.
    const subject = cascadeFailure.subject;
    if (subject !== undefined) {
      return handleCascadeThrow({
        ctx,
        pi,
        marketplace,
        scope,
        plugin,
        rootKey,
        subject,
        orchestrated,
      });
    }

    // Pattern S-1 single chokepoint for user-visible errors: one
    // notify(ctx, pi, ...) call carrying a per-variant
    // PluginFailedMessage / PluginUnavailableMessage. Severity derives to
    // "error" structurally and neither variant triggers the reload hint.
    return handleInstallThrow({
      err,
      ctx,
      pi,
      marketplace,
      scope,
      plugin,
      capture,
      orchestrated,
    });
  }

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
  switch (outcome.kind) {
    case "invalid-config":
      return failedRowOutcome({
        ctx,
        pi,
        marketplace,
        scope,
        plugin,
        error: new Error(`Config file "${configBasename}" failed schema validation.`),
        reasons: ["invalid manifest"],
        orchestrated,
      });

    case "marketplace-absent": {
      const cause = `Marketplace "${marketplace}" is not added in the ${scope} scope.`;
      if (opts.notifications?.mode === "orchestrated") {
        return { status: "failed", error: new Error(cause), cause };
      }

      // CMP-4 / SCOPE-01: a bare `{marketplace not added}` row is not actionable when the
      // container lives in the OTHER scope -- the repo-bundled-marketplace case,
      // where a default-scope (user) install misses a project-only container. One
      // read-only probe of that scope decides which structural token the brace
      // carries. The probe never throws and never blocks the row (see
      // `marketplaceInOtherScope`); a `false` answer adds no field, so the row
      // renders the plain `{marketplace not added}` brace.
      notify(ctx, pi, {
        kind: "marketplace-not-added",
        name: marketplace,
        scope,
        ...(await crossScopeFlag({ cwd, marketplace, scope })),
      });
      return { status: "failed", error: new Error(cause), cause };
    }

    // D-04-07: the promotion arm. State was saved and any hooks hydrated inside
    // the lock, and the cascade never ran, so there are no post-commit warnings
    // to collect; the row is the whole report.
    case "promoted":
      return promotedRowOutcome({
        ctx,
        pi,
        marketplace,
        scope,
        plugin,
        promotion: outcome.promotion,
        orchestrated,
      });

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
      if (orchestrated) {
        return { status: "failed", error: outcome.cause, cause };
      }

      notifyWithContext(
        ctx,
        pi,
        INSTALL_CONTEXT,
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
            ],
          },
        ],
        undefined,
        "single",
      );
      return { status: "failed", error: outcome.cause, cause };
    }

    case "installed": {
      const { installCtx, landedDisabled } = outcome;
      const postCommitWarnings = await collectPostCommitWarnings(
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
        const softDepProbe = softDepStatus(pi);
        // Success: one notify(ctx, pi, ...) call with a PluginInstalledMessage.
        // The renderer probes companion-loaded state via softDepStatus(pi) and
        // emits the per-row soft-dep markers automatically. The "/reload to pick
        // up changes" trailer fires structurally on the status; the trigger
        // ladder is per-variant, not per-resource-count (RH-1, PU-8 (b)).
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
          pi,
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
              }),
            },
          ],
          undefined,
          "single",
        );
        surfaceDiscoveryWarnings(ctx, {
          plugin,
          verb: "installed",
          warnings: postCommitWarnings,
        });
      }

      return installedPluginOutcome(installCtx, postCommitWarnings, landedDisabled);
    }
  }
}

/** Bind install orchestration to one required semantic transaction owner. */
export function createInstallPlugin(
  transaction: InstallTransaction,
  hooksRouting: InstallHooksRouting,
  completionCache: CompletionCache,
): (opts: InstallPluginOptions) => Promise<InstallPluginOutcome> {
  return (opts) => installPluginWithTransaction(transaction, hooksRouting, completionCache, opts);
}

/**
 * MISS-01 / D-09-05: what a reload's missing-dependency step needs to install
 * one dependency and its own closure. No `notifications` field -- the entry
 * point never notifies (RECON-04's single `notify()` belongs to
 * `applyReconcile`) -- and no `applyDefaultEnabled`, `local`, `mapModel`,
 * `partial` or `pinVersionOverride`: none of DFEN-04's landed-disabled arm,
 * D-04-02's config write, or a caller-supplied version pin applies on this
 * path.
 */
export interface InstallMissingDependencyOptions {
  readonly ctx: NotificationContext;
  readonly pi: ToolInventory;
  readonly scope: Scope;
  /** Project-scope cwd (ignored for user scope; see locationsFor). */
  readonly cwd: string;
  readonly marketplace: string;
  readonly plugin: string;
  /**
   * D-09-05: the raw range texts every eligible declarer accumulated for this
   * key, folded once at the cascade's own fold site (`effectiveRanges`).
   */
  readonly ranges: readonly string[];
  /**
   * The dependent whose declaration first named this key (`plan.ts`'s
   * `requiredBy`), carried onto a marketplace-absent failure's subject.
   */
  readonly requiredBy: string;
  /** Every eligible original declarer; absent for singular direct callers. */
  readonly declarers?: readonly string[];
  readonly tagProbe?: CascadeTagProbe;
  readonly marketplaceTagProbe?: CascadeMarketplaceTagProbe;
  readonly cloneCacheSeam?: InstallCloneCacheSeam;
  readonly credentialOps?: CredentialOps;
  readonly deviceFlowHttp?: DeviceFlowHttp;
  readonly authMemo?: Map<string, AuthAttemptResult>;
}

/**
 * MISS-01 / MISS-02: the outcome of installing one missing dependency and its
 * closure.
 *
 * SURF-05 / WARN-01: the `installed` arm inherits the root ledger run's
 * degradation signals from `LedgerDegradationSignals` rather than declaring
 * them, the same picked pair `PluginInstalledOutcome` carries, so `apply.ts`
 * stamps the root member's row exactly as `applyPluginInstalls`'s success arm
 * does. Both are omitted when the run raised neither (NREG-01).
 */
export type InstallMissingDependencyOutcome =
  | ({
      readonly status: "installed";
      readonly members: readonly CascadeMemberOutcome[];
      readonly postCommitWarnings?: readonly string[];
    } & Pick<LedgerDegradationSignals, "orphanRewake" | "degradedKinds">)
  | { readonly status: "skipped" }
  | {
      readonly status: "failed";
      readonly error: Error;
      readonly cause: string;
      readonly reason?: "cross-marketplace";
    };

/** Outcome of the locked closure inside `installMissingDependencyWithTransaction`. */
type InstallMissingDependencyTransactionOutcome =
  | { readonly kind: "already-recorded" }
  | {
      readonly kind: "installed";
      readonly root: InstallLedgerSummary;
      readonly members: readonly CascadeMemberOutcome[];
    };

/**
 * Evidence-backed type narrowing only, on the file's own
 * `assertPromotedLedgerInstalled` precedent: `handleCascadeThrow` and
 * `handleInstallThrow` both answer the failed arm when called with
 * `orchestrated: true`, so the "installed" arm of `InstallPluginOutcome` is
 * unreachable at this call site.
 */
function assertOrchestratedFailedOutcome(
  _outcome: InstallPluginOutcome,
): asserts _outcome is Extract<InstallPluginOutcome, { readonly status: "failed" }> {
  // Evidence-backed type narrowing only; the invariant is established by the caller.
}

/**
 * MISS-01 / D-09-05: the orchestrated-only entry point beside `installPlugin`
 * for a reload's missing-dependency step. It runs the SAME locked transaction,
 * catalog lookup, marketplace resolution and hooks hydration `installPlugin`
 * runs for a plugin's own cascade, minus every arm that names a config file or
 * a disabled landing: there is no `selectDeclaringConfigWriteTarget`, no
 * `promoteDependencyRecord`, no `resolveInstallDeclaredEnabled`, no disable
 * cascade, no `writeAdoptingConfigEntries` and no
 * `writeOrchestratedDeclarations` (D-04-02, D-04-07, DFEN-04). A
 * dependency-provenance record is declared in neither config file and lands
 * enabled whatever its own `defaultEnabled` says, because it exists to
 * satisfy a declaration (ENBL-DEP-01). It never notifies and never re-throws,
 * the same contract `installPlugin` documents, so `apply.ts` reads its
 * outcome without a guard.
 */
async function installMissingDependencyWithTransaction(
  transaction: InstallTransaction,
  hooksRouting: InstallHooksRouting,
  completionCache: CompletionCache,
  opts: InstallMissingDependencyOptions,
): Promise<InstallMissingDependencyOutcome> {
  const { ctx, pi, scope, cwd, marketplace, plugin } = opts;
  const locations = locationsFor(scope, cwd);
  const capture: InstallFailureCapture = { rollbackPartials: [], version: undefined };
  // RESV-06 precedent: where the cascade leaves a failing dependency for the
  // catch block, so a nested closure/constraint failure names it rather than
  // the root this entry point was asked to install.
  const cascadeFailure: CascadeFailureSink = {};
  const rootKey = `${plugin}@${marketplace}`;

  let outcome: InstallMissingDependencyTransactionOutcome;
  try {
    outcome = await transaction.withLockedStateTransaction(
      locations,
      async (tx): Promise<InstallMissingDependencyTransactionOutcome> => {
        const state = tx.state;
        // D-09-06 / D-09-04: a config install's cascade earlier in the same
        // pass may already have materialized this key, or it is a disabled
        // record this path leaves alone. Either way the key is already
        // recorded, so this arm saves nothing and installs nothing.
        if (state.marketplaces[marketplace]?.plugins[plugin] !== undefined) {
          return { kind: "already-recorded" };
        }

        const targetSource = await resolveInstallMarketplaceSource({
          targetScope: scope,
          cwd,
          marketplace,
          targetState: state,
        });
        if (targetSource === undefined) {
          cascadeFailure.subject = {
            kind: "closure",
            failure: {
              ok: false,
              reason: "marketplace-not-added",
              key: rootKey,
              marketplace,
              requiredBy: opts.requiredBy,
            },
          };
          throw cascadeFailureCause(cascadeFailure.subject, rootKey);
        }

        const authorized = await authorizeMissingDependency({
          scope,
          cwd,
          marketplace,
          state,
          declarers: opts.declarers ?? [opts.requiredBy],
        });
        if (!authorized) {
          const at = opts.requiredBy.lastIndexOf("@");
          cascadeFailure.subject = {
            kind: "closure",
            failure: {
              ok: false,
              reason: "cross-marketplace",
              key: rootKey,
              requiredBy: opts.requiredBy,
              marketplace,
              rootMarketplace: opts.requiredBy.slice(at + 1),
            },
          };
          throw cascadeFailureCause(cascadeFailure.subject, rootKey);
        }

        const cascade = await runInstallCascade({
          state,
          locations,
          rootKey,
          rootAllowedMarketplaces: await loadInstallRootAllowlist({
            scope,
            cwd,
            marketplace,
            state,
          }),
          // D-09-05: the declarers' folded ranges pin the root exactly as a
          // constrained member is pinned.
          rootRanges: opts.ranges,
          // D-09-04: a disabled recorded dependency is a wall on this path,
          // never a read-through member.
          treatDisabledAsWall: true,
          lookup: (subject) => lookupCascadeDependencies(state, { scope, cwd, locations }, subject),
          marketplaceRecordFor: async (marketplaceName) =>
            (
              await resolveInstallMarketplaceSource({
                targetScope: scope,
                cwd,
                marketplace: marketplaceName,
                targetState: state,
              })
            )?.sourceRecord,
          ledgerOptionsFor: (member) =>
            buildInstallLedgerOptions(opts, {
              scope,
              cwd,
              marketplace: member.marketplace,
              plugin: member.name,
              ...(member.pin !== undefined && { sourcePin: member.pin.oid }),
              ...(member.pin?.version !== undefined && { pinVersion: member.pin.version }),
              // D-04-01: the caller decides provenance; every member of this
              // cascade, root included, exists to satisfy a declaration.
              provenance: "dependency",
            }),
          installedKeys: collectInstalledKeys(state),
          knownMarketplaces: await collectInstallReachableMarketplaces({
            targetScope: scope,
            cwd,
            targetState: state,
          }),
          capture,
          transaction,
          ...(opts.tagProbe !== undefined && { tagProbe: opts.tagProbe }),
          ...(opts.marketplaceTagProbe !== undefined && {
            marketplaceTagProbe: opts.marketplaceTagProbe,
          }),
        });
        const installed = unwrapCascade(cascade, capture, rootKey, cascadeFailure);
        if (installed === undefined) {
          // D-03-08: on this path the root IS a dependency, so a marketplace
          // absent in both scopes is the walk's own not-added failure --
          // nothing here adds or clones a marketplace to satisfy a
          // declaration.
          cascadeFailure.subject = {
            kind: "closure",
            failure: {
              ok: false,
              reason: "marketplace-not-added",
              key: rootKey,
              marketplace,
              requiredBy: opts.requiredBy,
            },
          };
          throw cascadeFailureCause(cascadeFailure.subject, rootKey);
        }

        await tx.save();
        // No `landedDisabled` filter -- nothing lands disabled here.
        await hydrateInstalledHooks({ hooksRouting, scope, cwd, members: installed.members });
        return { kind: "installed", root: installed.root, members: installed.members };
      },
    );
  } catch (err) {
    const subject = cascadeFailure.subject;
    const failed =
      subject !== undefined
        ? handleCascadeThrow({
            ctx,
            pi,
            marketplace,
            scope,
            plugin,
            rootKey,
            subject,
            orchestrated: true,
          })
        : handleInstallThrow({
            err,
            ctx,
            pi,
            marketplace,
            scope,
            plugin,
            capture,
            orchestrated: true,
          });
    assertOrchestratedFailedOutcome(failed);
    return subject?.kind === "closure" && subject.failure.reason === "cross-marketplace"
      ? { ...failed, reason: "cross-marketplace" }
      : failed;
  }

  if (outcome.kind === "already-recorded") {
    return { status: "skipped" };
  }

  // D-03-INV: drops the root marketplace's completion cache, same as install.
  const warnings = await collectPostCommitWarnings(outcome.root, completionCache, scope, true);
  return {
    status: "installed",
    members: outcome.members,
    ...(warnings.length > 0 && { postCommitWarnings: warnings }),
    ...ledgerDegradationSignals(outcome.root),
  };
}

/** Bind the missing-dependency install to one required semantic transaction owner. */
export function createInstallMissingDependency(
  transaction: InstallTransaction,
  hooksRouting: InstallHooksRouting,
  completionCache: CompletionCache,
): (opts: InstallMissingDependencyOptions) => Promise<InstallMissingDependencyOutcome> {
  return (opts) =>
    installMissingDependencyWithTransaction(transaction, hooksRouting, completionCache, opts);
}

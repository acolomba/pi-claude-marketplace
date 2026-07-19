// orchestrators/plugin/install.ts
//
// PI-1..15 + AS-6 + AS-7 + COMP-01 + NFR-5.
//
// Production consumer of the runPhases<C> ledger primitive
// (transaction/phase-ledger.ts). Composition order is locked by D-01,
// D-02, D-05, D-08:
//
//   withLockedStateTransaction(locations, async (tx) => {   // D-02 outer guard
//     runInstallLedger(state, locations, opts, capture)    // guard-FREE body:
//       PI-15 early sanity:  throw if state.marketplaces[mp].plugins[plugin] != null
//       PI-3:                throw if marketplace / entry absent
//       PI-2:                cached manifest read ONLY (no network)
//       PI-4:                resolveStrict + requireInstallable
//       PI-6:                assertNoCrossPluginConflicts(scope, names, state)
//       PI-7:                resolvePluginVersion -- 3-tier precedence
//                            (plugin.json > entry.version > hash); see
//                            `shared.ts::resolvePluginVersion`
//       runPhases(phases, ctx)                             // D-01 5-phase ledger
//       capture rollbackPartials, throw raw error          // D-02 PI-14 bypass
//   })
//
// CR-01: the ledger body is extracted into the exported
// guard-FREE `runInstallLedger` so `setPluginEnabled`'s enable branch can run
// it inside ITS OWN `withLockedStateTransaction` -- `proper-lockfile`
// (`retries: 0`) is not re-entrant, so nesting `installPlugin`'s guard under
// another guard on the same `stateLockFile` self-deadlocks.
//   POST-state-commit (D-08 / AS-6):  mkdir(pluginDataDir), dropped per D-19-01
//   Success notify via notify() with PluginInstalledMessage carrying
//   dependencies: readonly Dependency[] derived from staged content; the
//  renderer probes companion-loaded state once per notify call
//   and emits per-row soft-dep markers + the reload-hint trailer
//  structurally.
//   Failure routes through one notify() call with PluginFailedMessage
//   carrying optional cause + optional rollbackPartial[]; the renderer
//  composes the depth-5 cause-chain and per-phase rollback child
//   rows automatically.
//
// Standalone-mode emission is a single notify(ctx, pi, { marketplaces:
// [{ ..., plugins: [<row>] }] }) call per orchestration arm. The 5
// post-state-commit soft-warning sites (mkdir / cache-refresh /
// agentForeignFailures / bridgeWarnings / PI-13 deps note) are NOT surfaced:
// MarketplaceNotificationMessage has no field for a "soft warning after
// successful state mutation". The underlying side effects (mkdir /
// dropMarketplaceCache / agents-bridge foreign-row preservation / bridge
// cleanup-leak fold / PI-13 detection) STILL RUN (correctness preserved);
// only the user-facing warning surface disappears in standalone mode. The
// orchestrated-mode `InstallOutcome.postCommitWarnings` branch is preserved:
// the import cascade caller (orchestrators/import/execute.ts, the
// `importPlugins` path) injects each warning into its `pushDiagnostic`
// channel which surfaces per-marketplace in the cascade's rendering. The
// standalone/orchestrated asymmetry is INTENTIONAL.
//
// NFR-5 / PI-2 architectural guard: this file MUST NOT import platform-git
// or the default git ops, and MUST NOT carry a gitOps field; the architectural
// test under tests/architecture/no-orchestrator-network.test.ts strips comments
// and greps this file's source for the forbidden surface tokens.
//
// D-11 import boundaries: orchestrators/plugin/ may import from bridges/,
// domain/, transaction/, persistence/, shared/, AND from
// orchestrators/marketplace/shared.ts (named exports only -- no add.ts /
// remove.ts / update.ts cycle). User-visible output flows through
// shared/notify.ts; this file holds no rendering imports.

import { mkdir, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

import {
  commitPreparedAgents,
  discoverPluginAgents,
  prepareStagePluginAgents,
  unstagePluginAgents,
} from "../../bridges/agents/index.ts";
import {
  commitPreparedCommands,
  discoverPluginCommands,
  prepareStageCommands,
  unstagePluginCommands,
} from "../../bridges/commands/index.ts";
import { compileIfPredicate } from "../../bridges/hooks/if-field/index.ts";
import {
  readAndCachePluginHooks,
  rebuildRoutingTables,
  removeHookConfig,
  writeHookConfig,
} from "../../bridges/hooks/index.ts";
import {
  commitPreparedMcp,
  prepareStageMcpServers,
  unstageMcpServers,
} from "../../bridges/mcp/index.ts";
import {
  commitPreparedSkills,
  discoverPluginSkills,
  prepareStageSkills,
  unstagePluginSkills,
} from "../../bridges/skills/index.ts";
import { parseHooksConfig } from "../../domain/components/hooks.ts";
import { PLUGIN_ENTRY_VALIDATOR } from "../../domain/components/plugin.ts";
import { loadMarketplaceManifest } from "../../domain/manifest.ts";
import { asAbsolutePluginRoot } from "../../domain/plugin-root.ts";
import {
  requirePartialInstallable,
  requireInstallable,
  resolveStrict,
} from "../../domain/resolver.ts";
import { parsePluginSource } from "../../domain/source.ts";
import { shaVersion } from "../../domain/version.ts";
import { loadConfig } from "../../persistence/config-io.ts";
import { writeBatchedConfigEntries } from "../../persistence/config-write-back.ts";
import { locationsFor } from "../../persistence/locations.ts";
import { softDepStatus } from "../../platform/pi-api.ts";
import { dropMarketplaceCache } from "../../shared/completion-cache.ts";
import { hookDebugLog } from "../../shared/debug-log.ts";
import {
  assertNever,
  causeChainTrailer,
  ConcurrentInstallError,
  errorMessage,
  PluginShapeError,
} from "../../shared/errors.ts";
import { classifyGitTransportFailure } from "../../shared/git-failure-classifiers.ts";
import { notifyWithContext } from "../../shared/notify-context.ts";
import { companionSeverity } from "../../shared/notify-reasons.ts";
import { notify } from "../../shared/notify.ts";
import { PathContainmentError } from "../../shared/path-safety.ts";
import { narrowUnsupportedKinds } from "../../shared/probe-classifiers.ts";
import { runPhases, type Phase, type RollbackPartial } from "../../transaction/phase-ledger.ts";
import { withLockedStateTransaction } from "../../transaction/with-state-guard.ts";
import { DEFAULT_CREDENTIAL_OPS, buildAuthForHost, hostFromCloneUrl } from "../auth-host.ts";

import {
  canonicalCloneUrl,
  materializeOrRefreshPluginMirror,
  materializePluginClone,
  resolveGitSubdirRoot,
  resolvePluginPin,
} from "./clone-cache.ts";
import { INSTALL_CONTEXT, type InstallMsg } from "./install.messaging.ts";
import {
  assertNoCrossPluginConflicts,
  cloneMarketplaceRecordForTargetScope,
  pickAgentsSourceDir,
  resolveInstallMarketplaceSource,
  resolvePluginVersion,
  selectConfigWriteTarget,
  synthesizeAdoptedMarketplaceSource,
} from "./shared.ts";

import type { PreparedAgentsStaging } from "../../bridges/agents/index.ts";
import type { PreparedCommandsStaging } from "../../bridges/commands/index.ts";
import type { PreparedMcpStaging } from "../../bridges/mcp/index.ts";
import type { PreparedSkillsStaging } from "../../bridges/skills/index.ts";
import type { PluginEntry } from "../../domain/components/plugin.ts";
import type { GitPluginRootResult, MaterializablePlugin } from "../../domain/resolver.ts";
import type { GitBackedSource } from "../../domain/source.ts";
import type { ScopeConfig } from "../../persistence/config-io.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { ExtensionState } from "../../persistence/state-io.ts";
import type { ExtensionAPI, ExtensionContext } from "../../platform/pi-api.ts";
import type { Dependency } from "../../shared/concerns/soft-dep.ts";
import type {
  ContentReason,
  PluginFailedMessage,
  PluginUnavailableMessage,
  PluginPartiallyAvailableMessage,
  StatusToken,
} from "../../shared/notify.ts";
import type { Scope } from "../../shared/types.ts";
import type { AuthAttemptResult, CredentialOps, DeviceFlowHttp } from "../auth-host.ts";

/**
 * Entity-shaped non-cascade error line (MSG-NC-1 / CMC-34) -- internal
 * classified-error return shape for `classifyEntityShapeError` and the
 * install.ts error-routing path. File-local; this module is the sole
 * consumer.
 *
 * Examples: `⊘ unknown@claude-plugins-official (failed) {not found}`;
 * `⊘ hookify [user] (unavailable) {unsupported hooks}`.
 */
interface EntityErrorRow {
  readonly kind: "entity-error";
  readonly name: string;
  readonly marketplace?: string;
  readonly scope?: Scope;
  readonly status: Extract<StatusToken, "failed" | "unavailable">;
  readonly reasons: readonly ContentReason[];
  // SEV-02 / D-69-03: carried from the thrown PluginShapeError's `partialable`
  // discriminant on the `unavailable` arm -- `true` when the resolver verdict
  // is partially-available, so the composed row points at `--partial`.
  readonly partialable?: boolean;
}

/**
 * Parsed (plugin, marketplace) options bundle. PI-1 / RH-1 / RH-2 parse is
 * the edge layer's responsibility; this orchestrator entrypoint
 * accepts already-parsed strings + the resolved scope.
 *
 * `pi` is REQUIRED -- `notify(ctx, pi, message)` consumes it for the
 * single `softDepStatus(pi)` probe per call. The renderer
 * injects per-row `{requires pi-subagents}` / `{requires pi-mcp}`
 * markers from the per-row `dependencies: readonly Dependency[]`
 * declaration combined with the threaded probe. Making `pi`
 * optional would force a runtime branch the type checker cannot reason
 * about.
 *
 * SNM-04 / D-15-02: the `"installed"` variant carries REQUIRED
 * `dependencies: readonly Dependency[]` (the closed-set
 * `"agents" | "mcp"` per SNM-04). The orchestrator derives the
 * array at the success-return site from
 * `installCtx.stagedAgentNames.length > 0` (-> `"agents"`) and
 * `installCtx.stagedMcpServerNames.length > 0` (-> `"mcp"`); the
 * `declaresAgents`/`declaresMcp` predicates on `InstallPluginOutcome`
 * remain (consumed by `orchestrators/import/execute.ts` for its
 * cascade-row composition) -- NFR-7's discriminated-outcome contract
 * is unchanged.
 */
export type InstallPluginOutcome =
  | {
      readonly status: "installed";
      readonly resourcesChanged: boolean;
      readonly declaresAgents: boolean;
      readonly declaresMcp: boolean;
      /** Post-commit warnings collected in orchestrated mode instead of firing individually. */
      readonly postCommitWarnings?: readonly string[];
    }
  | {
      /**
       * Collapsed failure shape. All failure variants (`already-installed`,
       * `unavailable`, `uninstallable`, `unexpected-failure`) map here.
       * `error` is the typed dispatch surface -- consumers narrow on
       * `instanceof PluginShapeError` and `.shape.kind` to recover the
       * specific failure class. `cause` preserves the formatted user-visible
       * text for callers in orchestrated mode that render it directly.
       */
      readonly status: "failed";
      readonly error: Error;
      readonly cause: string;
    };

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
export type InstallPluginNotifications =
  { readonly mode: "standalone" } | { readonly mode: "orchestrated" };

export interface InstallPluginOptions {
  readonly ctx: ExtensionContext;
  /** Factory `pi` reference -- carries `getAllTools()` for RH-3/RH-4 soft-dep probes. */
  readonly pi: ExtensionAPI;
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
   */
  readonly mapModel?: boolean;
  /**
   * D-65-03: when true, the install preflight selects `requirePartialInstallable`
   * instead of `requireInstallable`, widening the gate to admit the
   * `partially-available` arm so its supported components materialize (the unsupported
   * ones are skipped naturally; FORCE-01). The edge handler sets this when the
   * user supplies `--partial`. Both gates still reject `unavailable` (FORCE-05).
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
   */
  readonly pinVersionOverride?: string;
  /**
   * WB-01 / WB-02: when true, target `claude-plugins.local.json` instead
   * of `claude-plugins.json`. The base file is NEVER touched on the
   * --local path; loadConfig's `absent` arm yields an empty starting
   * shape that saveConfig writes back to the local path.
   */
  readonly local?: boolean;
  /**
   * Test-only clone-cache seam override (see InstallLedgerOptions.cloneCacheSeam).
   * Production callers leave this undefined.
   */
  readonly cloneCacheSeam?: InstallCloneCacheSeam;
  /**
   * PROV-03 / D-79-05 injection seam. Defaults to DEFAULT_CREDENTIAL_OPS at use.
   * The git-source clone probe passes it to `buildAuthForHost` so a provider
   * host authenticates host-keyed; tests inject makeMockCredentialOps().
   */
  readonly credentialOps?: CredentialOps;
  /**
   * PROV-03 Device Flow HTTP seam. Undefined = the real device-flow endpoints;
   * tests inject makeMockDeviceFlowHttp() so the flow runs network-free.
   */
  readonly deviceFlowHttp?: DeviceFlowHttp;
  /**
   * D-79-02 once-per-host memo. A command-scope Map shared across a bulk
   * install so the provider flow runs AT MOST ONCE per host; the caller
   * (edge/cascade) owns its lifetime. Undefined = no memo (single install).
   */
  readonly authMemo?: Map<string, AuthAttemptResult>;
}

/**
 * Local context type for the 5-phase ledger. Carries every value the
 * phases read or mutate. Per D-01 corollary "second-consumer rule" this
 * shape is NOT promoted to `orchestrators/types.ts` until/unless another
 * orchestrator needs it.
 */
interface InstallCtx {
  readonly locations: ScopedLocations;
  readonly cwd: string;
  readonly marketplace: string;
  readonly plugin: string;
  // NFR-7 / D-65-03: widened to the materializable union so the
  // `partially-available` arm (admitted under --partial) flows through the same
  // materialize phases. Excludes `unavailable` (no pluginRoot).
  readonly resolved: MaterializablePlugin;
  readonly version: string;
  // D-77-02 / PURL-09: the full 40-hex resolved commit sha for git-source
  // installs, captured by the clone-materializing resolve callback (the
  // resolver's ResolvedPlugin schema cannot carry it, so it flows through this
  // side-channel into the state record). Undefined for path/non-git sources.
  readonly resolvedSha?: string;
  readonly pluginDataDir: string;
  // Prep handles populated by each phase.do before that phase's commit.
  // Each phase.undo reads the matching handle to call the bridge unstage*
  // primitive. The matching handle is undefined when the phase did not run.
  skillsPrep?: PreparedSkillsStaging;
  commandsPrep?: PreparedCommandsStaging;
  agentsPrep?: PreparedAgentsStaging;
  mcpPrep?: PreparedMcpStaging;
  // LIFE-01 / D-63-02: hooks bridge has no staging dir (writeHookConfig is
  // the atomic write). Track whether the file was written so the phase undo
  // path knows whether to call removeHookConfig.
  hooksFileWritten: boolean;
  // Names captured for PluginInstallRecord.resources and reload-hint composition.
  stagedSkillNames: readonly string[];
  stagedCommandNames: readonly string[];
  stagedAgentNames: readonly string[];
  stagedMcpServerNames: readonly string[];
  // Aggregated soft warnings from the bridges (e.g. agents bridge cleanup leaks).
  bridgeWarnings: string[];
  // Bridge-side per-record AG-5 foreign-content rows -- routed to notifyWarning post-success.
  agentForeignFailures: { generatedName: string; reason: string }[];
  // Mutable handle to the state snapshot loaded by the caller's locked transaction.
  readonly stateSnapshot: ExtensionState;
}

/**
 * Read and validate the cached marketplace.json (PI-2 NO network).
 *
 * `manifestPath` is the value persisted at marketplace-add time --
 * it points either at the github-cloned marketplace dir's manifest or at
 * the path-source marketplace's manifest. Either way the bytes are on disk
 * before install runs.
 */
async function loadCachedMarketplaceManifest(
  manifestPath: string,
): Promise<{ name: string; plugins: readonly PluginEntry[] }> {
  return loadMarketplaceManifest(manifestPath);
}

/**
 * Injected clone-cache seam. install.ts is forbidden the git surface by the
 * `no-orchestrator-network` gate (NFR-5), so the git-source clone flows through
 * the sibling `clone-cache.ts` seam by name -- install NEVER references the git
 * ops directly. This bundle lets a caller (tests) substitute the seam
 * entrypoints (each pre-bound to a mock git backend) without install ever
 * naming the git surface; production leaves it undefined and install uses the
 * real `resolvePluginPin` / `materializePluginClone` imports (which default to
 * the real git backend internally).
 */
export interface InstallCloneCacheSeam {
  readonly resolvePluginPin: typeof resolvePluginPin;
  readonly materializePluginClone: typeof materializePluginClone;
  /**
   * MIRR-01/MIRR-03 / D-79.1-01: the mirror seam for an UNPINNED git source
   * (`source.sha === undefined`). Routes to the single mutable
   * `plugin-clones/<urlhash12>/` mirror instead of the per-sha immutable cache;
   * refreshes it in place and returns the mirror root + resolved HEAD sha.
   */
  readonly materializeOrRefreshPluginMirror: typeof materializeOrRefreshPluginMirror;
}

/**
 * Options bundle for the guard-free install ledger body
 * (`runInstallLedger`). Carries only the data the ledger itself consumes --
 * no `ctx` / `pi` / `notifications` (the ledger never notifies; emission is
 * the caller's concern).
 */
export interface InstallLedgerOptions {
  /**
   * PROV-03: passed to the git-source clone probe's `buildAuthForHost` so a
   * Device Flow prompt reaches the user's UI. The ledger never notifies success
   * / failure itself (that is the caller's concern); `ctx` is here solely to
   * wire the auth notify seam for the clone probe.
   */
  readonly ctx: ExtensionContext;
  readonly scope: Scope;
  readonly cwd: string;
  readonly marketplace: string;
  readonly plugin: string;
  /** AG-7 opt-in `--map-model` flag (see InstallPluginOptions.mapModel). */
  readonly mapModel?: boolean;
  /** D-65-03 `--partial` gate-selection flag (see InstallPluginOptions.partial). */
  readonly partial?: boolean;
  /** ENBL-02 version pin (see InstallPluginOptions.pinVersionOverride). */
  readonly pinVersionOverride?: string;
  /**
   * D-54-01 / ENBL-02 re-materialization mode. When true, an EXISTING state
   * record for (marketplace, plugin) does NOT trip the PI-15 early-sanity
   * throw or the state-phase ConcurrentInstallError -- the disable path
   * deliberately KEEPS the record (ENBL-02), so "already recorded" is the
   * expected precondition for an enable. The state phase then overwrites the
   * record's `resources` / `compatibility` / `resolvedSource` / `updatedAt`
   * in place while PRESERVING the original `installedAt`. All other callers
   * leave this undefined (the PI-15 checks apply unchanged).
   */
  readonly allowExistingRecord?: boolean;
  /**
   * Test-only clone-cache seam override. When undefined (production), the git
   * source clone flows through the real `resolvePluginPin` /
   * `materializePluginClone` imports; tests inject mock-backed versions so the
   * git-source install path runs without touching the network.
   */
  readonly cloneCacheSeam?: InstallCloneCacheSeam;
  /** PROV-03 credential seam (see InstallPluginOptions.credentialOps). */
  readonly credentialOps?: CredentialOps;
  /** PROV-03 Device Flow HTTP seam (see InstallPluginOptions.deviceFlowHttp). */
  readonly deviceFlowHttp?: DeviceFlowHttp;
  /** D-79-02 once-per-host memo (see InstallPluginOptions.authMemo). */
  readonly authMemo?: Map<string, AuthAttemptResult>;
}

/**
 * Mutable failure-capture channel for `runInstallLedger`. Populated BEFORE
 * the ledger error is rethrown so the caller's catch site can compose
 * rollback-partial rows (`PluginFailedMessage.rollbackPartial`) and the
 * best-known version at throw time.
 */
export interface InstallFailureCapture {
  rollbackPartials: readonly RollbackPartial[];
  version: string | undefined;
}

/** Discriminated result of the guard-free install ledger body. */
type InstallLedgerResult =
  | { readonly kind: "installed"; readonly installCtx: InstallCtx }
  | { readonly kind: "marketplace-absent" };

/**
 * PROV-02/03/04 / T-79-09: build the host-keyed auth bundle for a resolved
 * cloneUrl. Returns a bundle for a registered host (private authenticates) or
 * undefined for a no-provider / public host (clones authless, no cross-host
 * credential leak). D-79-02: the command-scope authMemo caps the flow at once
 * per host. Shared by the pinned and the unpinned (mirror) probe arms.
 */
function buildProbeAuth(
  cloneUrl: string,
  kind: "url" | "git-subdir" | "github",
  auth: {
    ctx: ExtensionContext;
    credentialOps: CredentialOps;
    deviceFlowHttp?: DeviceFlowHttp;
    authMemo?: Map<string, AuthAttemptResult>;
  },
) {
  const host = hostFromCloneUrl(cloneUrl, kind);
  return buildAuthForHost({
    host,
    credentialOps: auth.credentialOps,
    ctx: auth.ctx,
    ...(auth.deviceFlowHttp !== undefined && { deviceFlowHttp: auth.deviceFlowHttp }),
    ...(auth.authMemo !== undefined && { authMemo: auth.authMemo }),
  });
}

/**
 * PURL-03 / NFR-10: apply the git-subdir containment tail to a materialized
 * clone/mirror root and stamp the resolved sha. For a git-subdir source the
 * pluginRoot resolves under the clone root (escapes / missing-subdir arms
 * propagate unchanged); other kinds materialize at the clone root itself.
 * Shared by the pinned and the unpinned (mirror) probe arms.
 */
async function resolveGitPluginRootWithSubdir(
  gitSource: GitBackedSource,
  cloneRoot: string,
  resolvedSha: string,
): Promise<GitPluginRootResult> {
  if (gitSource.kind === "git-subdir") {
    const subdirResult = await resolveGitSubdirRoot(cloneRoot, gitSource.path);
    if (subdirResult.kind !== "materialized") {
      return subdirResult;
    }

    return { kind: "materialized", pluginRoot: subdirResult.pluginRoot, resolvedSha };
  }

  return { kind: "materialized", pluginRoot: cloneRoot, resolvedSha };
}

/**
 * PURL-01..04 / PURL-09 / D-77-01..06: build the clone-materializing
 * `resolveGitPluginRoot` callback plus a getter for the resolved sha it
 * captured.
 *
 * The resolver stays network-free (shared with list/info); install injects THIS
 * policy so a git source (url / git-subdir / github) clones once into the
 * source-addressed `plugin-clones/<key>/` cache at its pinned/resolved sha and
 * returns the clone-anchored pluginRoot. The full sha is captured as a
 * side-channel because the resolver's `ResolvedPlugin` schema cannot carry it;
 * install reads `resolvedSha()` AFTER the resolve for the `sha-<12hex>` version
 * (D-77-01) and the full-sha state field (D-77-02).
 *
 * git-subdir containment (PURL-03 / NFR-10) is enforced HERE, anchored to the
 * clone root (not marketplaceRoot): an escaping subdir returns `escapes`, an
 * absent subdir returns `missing-subdir`, both surfaced by the resolver as
 * `unavailable` (fail-clean). The clone flows through the sibling
 * `clone-cache.ts` seam by name; install never references the git surface
 * (no-orchestrator-network gate, NFR-5).
 */
function makeInstallCloneProbe(
  seam: InstallCloneCacheSeam,
  locations: ScopedLocations,
  auth: {
    ctx: ExtensionContext;
    credentialOps: CredentialOps;
    deviceFlowHttp?: DeviceFlowHttp;
    authMemo?: Map<string, AuthAttemptResult>;
  },
): {
  probe: (source: GitBackedSource) => Promise<GitPluginRootResult>;
  resolvedSha: () => string | undefined;
} {
  let captured: string | undefined;

  // MIRR-01/MIRR-03 / D-79.1-01: an UNPINNED source (no manifest sha, incl.
  // ref-only moving pointers) is backed by the single mutable mirror clone at
  // `plugin-clones/<urlhash12>/`, not the per-sha immutable cache. The fork
  // lives INSIDE the probe callback so install.ts still names no git surface;
  // it reaches the mirror seam only by name.
  const probeUnpinned = async (gitSource: GitBackedSource): Promise<GitPluginRootResult> => {
    const cloneUrl = canonicalCloneUrl(gitSource);
    const authBundle = buildProbeAuth(cloneUrl, gitSource.kind, auth);
    const { pluginRoot: mirrorRoot, resolvedSha } = await seam.materializeOrRefreshPluginMirror({
      locations,
      cloneUrl,
      ...(gitSource.ref !== undefined && { ref: gitSource.ref }),
      ...(authBundle !== undefined && { auth: authBundle }),
    });

    const result = await resolveGitPluginRootWithSubdir(gitSource, mirrorRoot, resolvedSha);
    // Capture the resolved HEAD sha AFTER a successful materialize so a failed
    // mirror op does not leave a stale sha for the version/state record.
    if (result.kind === "materialized") {
      captured = resolvedSha;
    }

    return result;
  };

  const probePinned = async (gitSource: GitBackedSource): Promise<GitPluginRootResult> => {
    const { cloneUrl, pin, ref } = await seam.resolvePluginPin({ source: gitSource });
    const authBundle = buildProbeAuth(cloneUrl, gitSource.kind, auth);
    const cloneRoot = await seam.materializePluginClone({
      locations,
      cloneUrl,
      pin,
      ...(ref !== undefined && { ref }),
      ...(authBundle !== undefined && { auth: authBundle }),
    });

    const result = await resolveGitPluginRootWithSubdir(gitSource, cloneRoot, pin);
    // Capture the pin AFTER a successful materialize so a failed clone does not
    // leave a stale sha for the version/state record.
    if (result.kind === "materialized") {
      captured = pin;
    }

    return result;
  };

  const probe = (gitSource: GitBackedSource): Promise<GitPluginRootResult> =>
    gitSource.sha === undefined ? probeUnpinned(gitSource) : probePinned(gitSource);

  return { probe, resolvedSha: () => captured };
}

/**
 * PI-7 / D-77-01 / PURL-09: derive the recorded plugin version.
 *
 * Precedence:
 *   1. `pinVersionOverride` (D-54-01 / ENBL-02): an enable re-materialization
 *      reuses the caller-supplied pin verbatim so the recorded `version`
 *      survives across a disable/enable cycle.
 *   2. git source (url / git-subdir / github) with a captured sha: record
 *      `sha-<12hex>` -- the commit IS the version identity for a git-materialized
 *      plugin, REPLACING the whole 3-tier ladder (a plugin.json version inside a
 *      pinned commit is redundant with the sha). `resolvedSha` is set by the
 *      clone probe on the materialized path, which the install gate required.
 *   3. otherwise: the 3-tier ladder (plugin.json > entry.version > hash).
 */
async function deriveInstallVersion(args: {
  entry: PluginEntry;
  installable: MaterializablePlugin;
  resolvedSha: string | undefined;
  pinVersionOverride: string | undefined;
}): Promise<string> {
  if (args.pinVersionOverride !== undefined) {
    return args.pinVersionOverride;
  }

  const kind = parsePluginSource(args.entry.source).kind;
  const isGitSource = kind === "url" || kind === "git-subdir" || kind === "github";
  if (isGitSource && args.resolvedSha !== undefined) {
    return shaVersion(args.resolvedSha);
  }

  return resolvePluginVersion(args.entry, args.installable);
}

/**
 * CR-01: the guard-FREE install ledger body -- the
 * complete PI-15 / PI-3 / PI-2 / PI-4 / PI-6 / PI-7 + 5-phase ledger
 * sequence that previously lived inline in `installPlugin`'s
 * `withStateGuard` closure.
 *
 * Locking contract: the CALLER owns the per-scope state lock and the
 * load/save lifecycle. This function performs NO `withStateGuard` /
 * `withLockedStateTransaction` / `saveState` of its own -- `proper-lockfile`
 * (`retries: 0`) is NOT re-entrant, so nesting a second guard on the same
 * `stateLockFile` self-deadlocks (ELOCKED -> StateLockHeldError; the defect
 * that made the fresh-enable path unreachable). `installPlugin` and
 * `setPluginEnabled` (orchestrators/plugin/enable-disable.ts) each call
 * this inside their own `withLockedStateTransaction` so the OUTER snapshot
 * receives the state mutation and exactly one explicit save persists it
 * (single-writer, ST-7 / D-06).
 *
 * Failure contract: throws the raw orchestration error (PI-14 bypass
 * preserved). When `capture` is provided, `capture.rollbackPartials` /
 * `capture.version` are populated BEFORE the rethrow so the caller's catch
 * can compose rollback-partial rows.
 */
export async function runInstallLedger(
  state: ExtensionState,
  locations: ScopedLocations,
  opts: InstallLedgerOptions,
  capture?: InstallFailureCapture,
): Promise<InstallLedgerResult> {
  const { scope, cwd, marketplace, plugin } = opts;

  // CMP-2..4 / PI-16: resolve the source marketplace separately from
  // the target scope being mutated. Project-target installs can fall
  // back to a user-scope marketplace; user-target installs cannot read
  // project-only marketplaces.
  const source = await resolveInstallMarketplaceSource({
    targetScope: scope,
    cwd,
    marketplace,
    targetState: state,
  });
  if (source === undefined) {
    // M1: marketplace absent (after the CMP-3 fallback also missed). Return
    // the precondition discriminant cleanly -- no state mutation, no
    // plugin-row `{not in manifest}` throw. The caller surfaces the
    // marketplace subject.
    return { kind: "marketplace-absent" };
  }

  // Target container: same scope record when present, or a cloned
  // project-scope container when CMP-3 fell back to user marketplace.
  let targetMp = state.marketplaces[marketplace];
  if (targetMp === undefined) {
    targetMp = cloneMarketplaceRecordForTargetScope(source.sourceRecord, scope);
    state.marketplaces[marketplace] = targetMp;
  }

  // PI-15 early-sanity check: if the record already
  // exists in the target scope we throw ConcurrentInstallError BEFORE
  // running the ledger, avoiding any disk write. Layer (b) re-checks
  // inside the state-commit phase defensively in case of intra-process
  // re-entry. PI-17: other-scope installs do not block this target.
  // D-54-01 / ENBL-02: `allowExistingRecord` skips the throw -- the enable
  // path re-materializes a KEPT disabled record in place.
  if (targetMp.plugins[plugin] !== undefined && opts.allowExistingRecord !== true) {
    // PI-5: already-installed AND PI-15 early-sanity collapse onto the same
    // path here. Surface PI-5 wording at the early-sanity check (the
    // user-visible message is "already installed"); PI-15 (race-at-commit)
    // surfaces via the state-commit phase's defensive throw.
    throw new PluginShapeError({ kind: "already-installed", plugin, marketplace });
  }

  // PI-2 cached-manifest read -- NO network, no gitOps. PI-3: entry must
  // exist in the manifest plugins[] array.
  const sourceMp = source.sourceRecord;
  const manifest = await loadCachedMarketplaceManifest(sourceMp.manifestPath);
  const entryRaw = manifest.plugins.find((p) => p.name === plugin);
  if (entryRaw === undefined) {
    throw new PluginShapeError({ kind: "not-in-manifest", plugin, marketplace });
  }

  // Defense-in-depth: re-run the per-entry validator on the chosen entry
  // so a corrupted manifest cannot smuggle a malformed entry past the
  // top-level marketplace check (the array-element validator is the same
  // schema, but this site enforces it locally).
  if (!PLUGIN_ENTRY_VALIDATOR.Check(entryRaw)) {
    throw new Error(
      `Plugin entry for "${plugin}" in marketplace "${marketplace}" failed schema validation.`,
    );
  }

  const entry: PluginEntry = entryRaw;

  // PURL-01..04 / PURL-09 / D-77-01..06: the clone-materializing
  // resolveGitPluginRoot callback + its captured resolved sha (see
  // makeInstallCloneProbe). The resolver stays network-free; install injects
  // THIS policy so a git source clones once into the cache and returns the
  // clone-anchored pluginRoot. The full sha is read AFTER the resolve for the
  // sha-<12hex> version (D-77-01) and the full-sha state field (D-77-02).
  const clone = makeInstallCloneProbe(
    opts.cloneCacheSeam ?? {
      resolvePluginPin,
      materializePluginClone,
      materializeOrRefreshPluginMirror,
    },
    locations,
    {
      ctx: opts.ctx,
      credentialOps: opts.credentialOps ?? DEFAULT_CREDENTIAL_OPS,
      ...(opts.deviceFlowHttp !== undefined && { deviceFlowHttp: opts.deviceFlowHttp }),
      ...(opts.authMemo !== undefined && { authMemo: opts.authMemo }),
    },
  );

  // PI-4: resolveStrict + gate. Per D-04, the strict resolver consumes the
  // array-shape componentPaths (D-07 / COMP-01) and either returns an
  // installable variant or surfaces disqualification notes. The gate below
  // branches on `opts.partial`: the default path calls `requireInstallable`
  // (admits only `installable`); `--partial` calls `requirePartialInstallable`
  // (also admits the partially-available arm). Both narrow the
  // discriminated union and throw on the structural `unavailable` variant.
  const resolved = await resolveStrict(entry, {
    marketplaceRoot: sourceMp.marketplaceRoot,
    resolveGitPluginRoot: clone.probe,
  });
  // D-65-03 / FORCE-01/03/05: `--partial` widens the gate to admit the
  // partially-available arm; the default gate still blocks it. Both
  // gates reject `unavailable` (FORCE-05), so `--partial` never bypasses a hard
  // structural failure.
  if (opts.partial === true) {
    requirePartialInstallable(resolved, "install");
  } else {
    requireInstallable(resolved, "install");
  }

  // After the gate, `resolved` is narrowed to the materializable union
  // (`installable | partially-available`); pluginRoot etc. are reachable. The
  // `partially-available` arm carries only supported kinds in componentPaths, so the
  // shared materialize phases degrade it naturally (D-65-02, no partial branch).
  const installable: MaterializablePlugin = resolved;

  // Generated-name discovery (PI-6 input). Walks the bridges' discover.ts
  // to enumerate source artefacts under componentPaths, then applies the
  // domain/name.ts generators to produce the names whose collisions the
  // cross-bridge guard checks. No bridge writes happen here.
  const { discovered: discoveredSkills } = await discoverPluginSkills({
    pluginName: plugin,
    resolved: installable,
  });
  const { discovered: discoveredCommands } = await discoverPluginCommands({
    pluginName: plugin,
    resolved: installable,
  });
  const agentsSourceDir = pickAgentsSourceDir(installable);
  const { discovered: discoveredAgents } =
    agentsSourceDir === null
      ? { discovered: [] as readonly { readonly generatedName: string }[] }
      : await discoverPluginAgents({
          pluginName: plugin,
          agentsDirs: [agentsSourceDir],
        });

  const generatedNames = {
    skills: discoveredSkills.map((s) => s.generatedName),
    commands: discoveredCommands.map((c) => c.generatedName),
    agents: discoveredAgents.map((a) => a.generatedName),
  };

  // PI-6 / RN-3: pre-flight cross-bridge conflict guard. Throws
  // CrossPluginConflictError BEFORE any disk write if a generated name
  // is already owned by a different plugin IN THE SAME SCOPE.
  assertNoCrossPluginConflicts(scope, generatedNames, state);

  // PI-7 version precedence. D-54-01 / ENBL-02: `pinVersionOverride` (the
  // enable branch) always wins -- an enable re-materialization reuses the
  // caller-supplied pin verbatim so the recorded `version` survives across a
  // disable/enable cycle.
  //
  // D-77-01 / PURL-09: derive the recorded version (git => sha-<12hex>; path /
  // github-name => the 3-tier ladder). See `deriveInstallVersion`.
  const resolvedSha = clone.resolvedSha();
  const version = await deriveInstallVersion({
    entry,
    installable,
    resolvedSha,
    pinVersionOverride: opts.pinVersionOverride,
  });

  // Resolve the per-plugin data dir up front; the bridges receive it
  // for ${CLAUDE_PLUGIN_DATA} substitution. The directory itself is
  // NOT created here -- the eager mkdir runs POST-state-commit per
  // D-08 / AS-6.
  const pluginDataDir = await locations.pluginDataDir(marketplace, plugin);

  // Build the per-call install context. Per D-01 corollary, this lives
  // local to install.ts (single consumer); promoting to orchestrators/
  // types.ts would be premature.
  const ctxLocal: InstallCtx = {
    locations,
    cwd,
    marketplace,
    plugin,
    resolved: installable,
    version,
    // D-77-02: git-source installs carry the full 40-hex resolved sha; path /
    // github-name sources leave it undefined (no key => omitted from the record).
    ...(resolvedSha !== undefined && { resolvedSha }),
    pluginDataDir,
    hooksFileWritten: false,
    stagedSkillNames: [],
    stagedCommandNames: [],
    stagedAgentNames: [],
    stagedMcpServerNames: [],
    bridgeWarnings: [],
    agentForeignFailures: [],
    stateSnapshot: state,
  };

  // D-01 literal-array discipline: each phase is a single Phase<InstallCtx>
  // value; the ledger sees a 5-element constant array.
  const skillsPhase: Phase<InstallCtx> = {
    name: "skills",
    do: async (c) => {
      const prep = await prepareStageSkills({
        locations: c.locations,
        marketplaceName: c.marketplace,
        pluginName: c.plugin,
        pluginRoot: c.resolved.pluginRoot,
        pluginDataDir: c.pluginDataDir,
        resolved: c.resolved,
      });
      c.skillsPrep = prep;
      // Set before commit so undo can remove any dirs that were placed if
      // commit fails mid-loop (partial rename success leaves K orphans).
      c.stagedSkillNames = prep.result.recorded.map((r) => r.generatedName);
      const leak = await commitPreparedSkills(prep);
      if (leak !== undefined) {
        c.bridgeWarnings.push(leak);
      }
    },
    undo: async (c) => {
      if (c.skillsPrep === undefined) {
        return;
      }

      // Commit already succeeded -- the dirs are at the target path.
      // unstage* by name removes them.
      await unstagePluginSkills({
        locations: c.locations,
        previousSkillNames: c.stagedSkillNames,
      });
    },
  };

  const commandsPhase: Phase<InstallCtx> = {
    name: "commands",
    do: async (c) => {
      const prep = await prepareStageCommands({
        locations: c.locations,
        marketplaceName: c.marketplace,
        pluginName: c.plugin,
        pluginRoot: c.resolved.pluginRoot,
        pluginDataDir: c.pluginDataDir,
        resolved: c.resolved,
      });
      c.commandsPrep = prep;
      // Set before commit for the same reason as stagedSkillNames above.
      c.stagedCommandNames = prep.result.recorded.map((r) => r.generatedName);
      const leak = await commitPreparedCommands(prep);
      if (leak !== undefined) {
        c.bridgeWarnings.push(leak);
      }
    },
    undo: async (c) => {
      if (c.commandsPrep === undefined) {
        return;
      }

      await unstagePluginCommands({
        locations: c.locations,
        previousCommandNames: c.stagedCommandNames,
      });
    },
  };

  const agentsPhase: Phase<InstallCtx> = {
    name: "agents",
    do: async (c) => {
      const prep = await prepareStagePluginAgents({
        locations: c.locations,
        marketplaceName: c.marketplace,
        pluginName: c.plugin,
        pluginRoot: c.resolved.pluginRoot,
        pluginDataDir: c.pluginDataDir,
        resolved: c.resolved,
        agentsSourceDir: pickAgentsSourceDir(c.resolved),
        knownSkills: c.stagedSkillNames,
        // AG-7 opt-in: `--map-model` on /claude:plugin install threads
        // the flag down to here. When the user did not pass the flag
        // we explicitly default to false so generated agents omit
        // `model:` (the default behavior).
        mapModel: opts.mapModel ?? false,
      });
      c.agentsPrep = prep;
      const leak = await commitPreparedAgents(prep);
      if (leak !== undefined) {
        c.bridgeWarnings.push(leak);
      }

      c.stagedAgentNames = prep.result.recorded.map((r) => r.generatedName);
      // AG-5 / W-08 / B-08: foreign-content rows are NOT thrown by the
      // bridge -- they surface via `failed[]`. AS-7: keep them out of
      // the rollback path (the install of new agents succeeded; the
      // foreign rows are a separate problem the user can address by
      // hand). Routed to notifyWarning post-state-commit below.
      for (const f of prep.result.failed) {
        c.agentForeignFailures.push({ generatedName: f.generatedName, reason: f.reason });
      }
    },
    undo: async (c) => {
      if (c.agentsPrep === undefined) {
        return;
      }

      // unstagePluginAgents removes only OUR own (mp, plugin) rows --
      // foreign-preserved rows from prepare stay in the index.
      await unstagePluginAgents({
        locations: c.locations,
        marketplaceName: c.marketplace,
        pluginName: c.plugin,
      });
    },
  };

  // LIFE-01 / D-63-01: 5th cascade slot. The hooks bridge owns one file per
  // plugin (`<hooksDir>/<plugin>/hooks.json`) and has no staging dir per
  // D-63-02 -- `writeHookConfig` is the atomic write. The phase body
  // re-reads + re-parses the on-disk `hooks.json` because the resolver
  // stores only `hooksConfigPath` (the relative path) on `c.resolved` and
  // discards the parsed value after its own `parseHooksConfig` call
  // returns. The parse is unconditional (no executor judgement); a fresh
  // parse failure here is a defensive guard (the resolver already validated
  // the file at install-entry under D-57-04) and unwinds the ledger.
  // Mirrors the post-state-commit hydrate at lines 340-360 of this file.
  const hooksPhase: Phase<InstallCtx> = {
    name: "hooks",
    do: async (c) => {
      if (c.resolved.hooksConfigPath === undefined) {
        return;
      }

      const raw = await readFile(
        path.join(c.resolved.pluginRoot, c.resolved.hooksConfigPath),
        "utf8",
      );
      // MATCH-03 / A1 projectRoot fallback: cwd doubles as projectRoot.
      const ifCtx = { homedir: homedir(), cwd: c.cwd, projectRoot: c.cwd };
      const parsed = parseHooksConfig(raw, ifCtx, compileIfPredicate);
      if (!parsed.ok) {
        throw new Error(`hooks.json re-parse failed: ${parsed.reason}`);
      }

      await writeHookConfig({
        locations: c.locations,
        pluginName: c.plugin,
        pluginRoot: c.resolved.pluginRoot,
        hooksValue: parsed.value,
      });
      c.hooksFileWritten = true;
    },
    undo: async (c) => {
      if (!c.hooksFileWritten) {
        return;
      }

      await removeHookConfig({ locations: c.locations, pluginName: c.plugin });
    },
  };

  const mcpPhase: Phase<InstallCtx> = {
    name: "mcp",
    do: async (c) => {
      const prep = await prepareStageMcpServers({
        locations: c.locations,
        cwd: c.cwd,
        marketplaceName: c.marketplace,
        pluginName: c.plugin,
        servers: c.resolved.mcpServers,
        sourcePath: `${c.resolved.pluginRoot}#mcpServers`,
      });
      c.mcpPrep = prep;
      const result = await commitPreparedMcp(prep);
      c.stagedMcpServerNames = result.recorded.map((r) => r.generatedName);
    },
    undo: async (c) => {
      if (c.mcpPrep === undefined) {
        return;
      }

      await unstageMcpServers({
        locations: c.locations,
        marketplaceName: c.marketplace,
        pluginName: c.plugin,
      });
    },
  };

  const statePhase: Phase<InstallCtx> = {
    name: "state",
    // The state-commit phase is pure in-memory mutation -- no IO. The
    // Phase<C> contract still requires `do` to return Promise<void>, so
    // we mark it async to satisfy the signature; the lint rule is
    // disabled because there is nothing to await here.
    // eslint-disable-next-line @typescript-eslint/require-await
    do: async (c) => {
      // PI-15 layer (b) defensive re-assert: the early-sanity check at
      // top-of-closure caught the common path. This second check guards
      // against intra-process re-entry edge cases (e.g. an in-flight
      // mutation of `state` outside this orchestrator). If the record
      // appeared between guard load and now, raise ConcurrentInstallError
      // so the ledger unwinds the staged bridges. D-54-01 / ENBL-02:
      // `allowExistingRecord` skips the throw -- the enable path
      // re-materializes the KEPT disabled record in place.
      const mpInner = c.stateSnapshot.marketplaces[c.marketplace];
      const existing = mpInner?.plugins[c.plugin];
      if (existing !== undefined && opts.allowExistingRecord !== true) {
        throw new ConcurrentInstallError(c.plugin, c.marketplace);
      }

      if (mpInner === undefined) {
        // Defensive: the early-sanity check guaranteed mp existed; if
        // someone deleted it from the state snapshot mid-flight, fail
        // cleanly so the ledger rolls back the staged bridges.
        throw new Error(
          `Marketplace "${c.marketplace}" disappeared from state during install of "${c.plugin}".`,
        );
      }

      const nowIso = new Date().toISOString();
      mpInner.plugins[c.plugin] = {
        version: c.version,
        resolvedSource: c.resolved.pluginRoot,
        // D-77-02 / PURL-09: persist the full 40-hex resolved commit sha for
        // git-source installs (reinstall pins its re-clone checkout to this
        // full sha; clone GC presence-checks it to derive live clone keys).
        // Path / github-name installs omit it.
        ...(c.resolvedSha !== undefined && { resolvedSha: c.resolvedSha }),
        compatibility: {
          // INV-1 / D-66-01 / BFILL-01: record the REAL compatibility from the
          // resolve, not a hardcoded `true`. A `--partial` install of an
          // `partially-available` plugin persists `installable: false` with the still-
          // unsupported set (mirrors reinstall.ts::updateStateRecord), so the
          // partially-installed derivation stays truthful AND load-time backfill
          // (which keys on `!compatibility.installable`) can later promote it
          // when its supported set grows. A clean install persists `true`.
          installable: c.resolved.state === "installable",
          notes: [...c.resolved.notes],
          supported: [...c.resolved.supported],
          unsupported: [...c.resolved.unsupported],
        },
        resources: {
          skills: [...c.stagedSkillNames],
          prompts: [...c.stagedCommandNames],
          agents: [...c.stagedAgentNames],
          mcpServers: [...c.stagedMcpServerNames],
          // HOOK-02 / D-57-01: additive required field. When the resolver
          // advertises a hooks config (i.e. `<pluginRoot>/hooks/hooks.json`
          // exists and parses), record the plugin's id as the per-plugin
          // hooks-container-dir slug. This is the inventory marker for
          // `list` UI, the `uninstall` hooks-subtree cleanup gate, and the
          // factory-time hydrate predicate that decides whether to re-read
          // the on-disk config back into `parsedConfigCache` on `/reload`.
          // When the resolver did not surface a hooks config, the
          // inventory stays empty.
          hooks: c.resolved.hooksConfigPath === undefined ? [] : [c.plugin],
        },
        // ENBL-02: always set enabled: true on install and re-materialization.
        // The disable branch sets it to false; the enable branch re-runs
        // statePhase (via runInstallLedger), which resets it to true here.
        enabled: true,
        // D-54-01 / ENBL-02: on re-materialization (allowExistingRecord),
        // PRESERVE the original installedAt -- the record was never
        // uninstalled, only disabled. Fresh installs stamp now.
        installedAt: existing?.installedAt ?? nowIso,
        updatedAt: nowIso,
      };
    },
    // undo intentionally absent: at state-commit phase time the guard
    // has not flushed yet, and on throw the guard does NOT save the
    // mutated snapshot (ST-7 contract). The mutation is discarded
    // by the unwinding closure.
  };

  // D-01 literal-array; order is part of the contract -- never refactor
  // to a dynamic builder. D-63-01: hooks slot lands between agents and mcp.
  // The PRD-fixed sequence is
  // [skills, commands, agents, hooks, mcp, state].
  const phases: readonly Phase<InstallCtx>[] = [
    skillsPhase,
    commandsPhase,
    agentsPhase,
    hooksPhase,
    mcpPhase,
    statePhase,
  ];

  const result = await runPhases(phases, ctxLocal);
  if (!result.ok) {
    // Capture the rollbackPartials + best-known-version BEFORE
    // re-throwing. The caller's catch block threads
    // `capture.rollbackPartials` into `PluginFailedMessage.rollbackPartial`
    // (per-phase typed `cause?: Error` carried verbatim from the
    // ledger -- no synthesis). PathContainmentError bypasses the
    // rollback-partial path verbatim per PI-14: the catch detects the
    // error class, omits the `rollbackPartial` field, and lets the
    // renderer surface the PathContainmentError's text through the
    // cause-chain trailer.
    if (capture !== undefined) {
      capture.rollbackPartials = result.rollbackPartials;
      capture.version = ctxLocal.version;
    }

    // result.error is non-undefined on !ok per phase-ledger.ts contract.
    throw result.error ?? new Error("phase ledger failed");
  }

  return { kind: "installed", installCtx: ctxLocal };
}

/**
 * Assemble the `InstallLedgerOptions` from the entrypoint options, spreading
 * each optional field only when defined (exactOptionalPropertyTypes). Extracted
 * from `installPlugin`'s guard closure so the conditional-spread ladder does not
 * inflate that closure's cognitive complexity. `ctx` is always threaded so the
 * git-source clone probe can wire the auth notify seam (PROV-03).
 */
function buildInstallLedgerOptions(
  opts: InstallPluginOptions,
  core: { scope: Scope; cwd: string; marketplace: string; plugin: string },
): InstallLedgerOptions {
  return {
    ctx: opts.ctx,
    scope: core.scope,
    cwd: core.cwd,
    marketplace: core.marketplace,
    plugin: core.plugin,
    ...(opts.mapModel !== undefined && { mapModel: opts.mapModel }),
    ...(opts.partial !== undefined && { partial: opts.partial }),
    ...(opts.pinVersionOverride !== undefined && { pinVersionOverride: opts.pinVersionOverride }),
    ...(opts.cloneCacheSeam !== undefined && { cloneCacheSeam: opts.cloneCacheSeam }),
    ...(opts.credentialOps !== undefined && { credentialOps: opts.credentialOps }),
    ...(opts.deviceFlowHttp !== undefined && { deviceFlowHttp: opts.deviceFlowHttp }),
    ...(opts.authMemo !== undefined && { authMemo: opts.authMemo }),
  };
}

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
 *      ConcurrentInstallError from PI-15 layer (a), and the rolled-up
 *      ledger error captured as failureRollbackPartials) -> notify()
 *      with `PluginFailedMessage` carrying the typed `cause` and
 *      (when rollback partials are present) the
 *      `rollbackPartial: readonly { phase; cause? }[]` field. The renderer
 *      handles all indentation + cause-chain rendering automatically
 * .
 *   2. PathContainmentError originating in a bridge prepare or undo path
 *      propagates VERBATIM: its message becomes `cause` on the
 *      `PluginFailedMessage` and never surfaces as a rollback-partial
 *      (PI-14 bypass).
 *   3. Post-state-commit pluginDataDir mkdir failure / cache-refresh
 *      failure / agentForeignFailures rows / bridgeWarnings rows /
 *      PI-13 deps note are DROPPED in standalone mode per D-19-01.
 *      Orchestrated-mode collects them in
 *      `InstallOutcome.postCommitWarnings` for the cascade caller.
 */
// Install sequencing intentionally keeps the state guard, failure routing,
// and post-commit/notification logic in one audited flow matching PI-1..15.
// eslint-disable-next-line sonarjs/cognitive-complexity
export async function installPlugin(opts: InstallPluginOptions): Promise<InstallPluginOutcome> {
  const { ctx, pi, scope, cwd, marketplace, plugin } = opts;
  const locations = locationsFor(scope, cwd);

  // Post-guard composition data. The guard closure populates this on
  // success; the catch block leaves it undefined and returns early.
  let installCtx: InstallCtx | undefined;
  // Captured-on-throw context for the catch block (populated by
  // `runInstallLedger` BEFORE its rethrow). `capture.rollbackPartials`
  // mirrors the ledger's RollbackPartial[] and populates
  // `PluginFailedMessage.rollbackPartial` when non-empty; when empty, the
  // catch emits the bare failure row form (no rollback children) -- see
  // the catalog `/claude:plugin install <plugin>@<marketplace>` "Failure"
  // arms and the contrasting "Failure with rollback-partial children" arm
  // in `docs/output-catalog.md`. `capture.version` is the resolved
  // version at throw time (undefined when the throw pre-dated
  // `resolvePluginVersion`).
  const capture: InstallFailureCapture = { rollbackPartials: [], version: undefined };
  // ATTR-01 / ATTR-08 / M1: marketplace-existence is a PRECONDITION, not a
  // plugin-row property. When the CMP-2..4 source resolution misses (the
  // marketplace is absent in the target scope AND the CMP-3 user fallback
  // also misses), the failure subject is the MARKETPLACE, not the plugin.
  // The guard sets this sentinel and returns WITHOUT mutating state; the
  // post-guard branch emits the standalone `marketplace-not-added` variant
  // (standalone mode) or returns the failed outcome (orchestrated mode).
  // This is distinct from M2 (plugin absent from a PRESENT manifest), which
  // stays `{not in manifest}` on the plugin row.
  let marketplaceAbsent = false;
  // WB-01 / CFG-03: invalid-config sentinel; populated inside the guard so
  // the post-guard branch emits the failed row with a basename-only cause.
  let configInvalid = false;

  // WB-01: target-path selection happens ONCE before the lock so the
  // orchestrator NEVER falls back to the base file on ENOENT. The base
  // file is NEVER touched on the --local path; loadConfig's `absent` arm
  // yields an empty starting shape that saveConfig writes back to the
  // local path. UAT-05: the sibling path is the scope's OTHER physical
  // file, read fresh inside the lock for the merged-view membership test
  // ONLY -- never written, never serialized back.
  const { targetConfigPath, siblingConfigPath } = selectConfigWriteTarget(locations, opts.local);
  const configBasename = path.basename(targetConfigPath);
  const orchestrated = opts.notifications?.mode === "orchestrated";

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
    await withLockedStateTransaction(locations, async (tx) => {
      const state = tx.state;
      // CFG-03 / T-56-03-04: abort BEFORE any state mutation. The
      // basename-only message prevents an absolute-path information leak.
      // NO tx.save() -- state.json bytes and mtime are untouched.
      const cfg = await loadConfig(targetConfigPath);
      if (cfg.status === "invalid") {
        configInvalid = true;
        return;
      }

      const result = await runInstallLedger(
        state,
        locations,
        buildInstallLedgerOptions(opts, { scope, cwd, marketplace, plugin }),
        capture,
      );
      if (result.kind === "marketplace-absent") {
        // WR-04: precondition miss -- read-only in effect, NO tx.save().
        marketplaceAbsent = true;
        return;
      }

      // Success: lift the install context up so the post-guard path can
      // compose the user-visible notification without re-entering the closure.
      installCtx = result.installCtx;

      // WB-01 / WR-09: write-back the plugin entry to the user-authored
      // config. SKIPPED in orchestrated mode (reconcile derives desired
      // state FROM the merged config; writing back would clobber a
      // per-machine override). The plugin patch is `{}` because the plugin
      // entry shape today carries no install-time field beyond the implicit
      // declaration -- D-04 keeps the "enabled" default at consume time.
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
      // (CFG-02) and silently flip merged `autoupdate`. The sibling file is
      // read fresh INSIDE the lock and used for the membership test only.
      if (opts.notifications?.mode !== "orchestrated") {
        const current: ScopeConfig = cfg.status === "valid" ? cfg.config : { schemaVersion: 1 };
        const adoptedSource = await synthesizeAdoptedMarketplaceSource({
          current,
          siblingConfigPath,
          state,
          marketplace,
        });
        // S4 (PR #51, CONTEXT.md S4): `adoptedSource === undefined`
        // collapses two arms -- benign (already-declared, no synthesis
        // needed) and dangerous (no string `source.raw` on the state
        // record, so we cannot synthesize at all). The current write-back
        // proceeds with the plugin key alone in BOTH arms; the dangerous
        // arm therefore writes a dangling declaration the next reconcile
        // converts into a destructive plan. Acknowledged trade-off for
        // this PR; a future PR should widen the helper's return to
        // disambiguate and route the dangerous arm to a (failed) row.
        await writeBatchedConfigEntries(current, targetConfigPath, locations.scopeRoot, {
          ...(adoptedSource !== undefined && {
            marketplaces: { [marketplace]: { source: adoptedSource } },
          }),
          plugins: { [`${plugin}@${marketplace}`]: {} },
        });
      }

      // WR-04: the SOLE mutating arm saves explicitly. Ordering preserved
      // from the previous withStateGuard shape: state persists AFTER the
      // config write-back (a write-back throw aborts the save, leaving the
      // state snapshot discarded exactly as before).
      await tx.save();

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
      if (installCtx.resolved.hooksConfigPath !== undefined) {
        try {
          await readAndCachePluginHooks({
            scope,
            marketplace,
            plugin,
            resolvedSource: asAbsolutePluginRoot(installCtx.resolved.pluginRoot),
            hooksJsonPath: path.join(
              installCtx.resolved.pluginRoot,
              installCtx.resolved.hooksConfigPath,
            ),
            cwd,
            logPrefix: "install",
          });

          rebuildRoutingTables();
        } catch (cacheErr) {
          hookDebugLog(
            `install: post-save cache/routing mutation failed for ${plugin}@${marketplace}: ${errorMessage(cacheErr)}`,
          );
        }
      }
    });
  } catch (err) {
    // Pattern S-1 single chokepoint for user-visible errors (one
    // notify(ctx, pi, ...) call carrying a per-variant
    // PluginFailedMessage / PluginUnavailableMessage).
    //
    // Failure routing priority (highest first); the renderer composes
    // the depth-5 cause-chain trailer and per-phase
    // rollback-child rows automatically. Severity is derived to "error"
    // structurally; no reload-hint (failed /
    // unavailable do not trigger the trailer).
    //
    //   1. PI-14 PathContainmentError -- emits a bare PluginFailedMessage
    //      with reasons: [] and cause: err. The renderer surfaces the
    //      PathContainmentError message via the 4-space-indent cause-chain
    //      trailer; NO rollback-partial children even when partials are
    //      present (PI-14 bypass).
    //   2. Rollback-partial (capture.rollbackPartials.length > 0 AND not
    //      PathContainmentError) -- PluginFailedMessage with
    //      reasons: ["rollback partial"] plus rollbackPartial: readonly
    //      { phase; cause? }[] with the typed Error threaded directly
    //      from the phase-ledger (RollbackPartial.cause is already typed
    //      Error -- NO synthesis from the free-form .msg string).
    //   3. Entity-shape errors (PI-3 / PI-4 / PI-5 via
    //      `classifyEntityShapeError`) -- the classifier's EntityErrorRow
    //      carries `status: "failed" | "unavailable"` AND `reasons:
    //      readonly Reason[]`; install.ts preserves the discriminator
    //      verbatim (catalog `failure-unsupported-features` uses
    //      `unavailable`; catalog `failure-rollback-partial` /
    //      `failure-runtime-with-cause` use `failed`). PluginUnavailable
    //      has no `cause?` field per D-15-01; the entity-shape reason
    //      carries the explanation. PluginFailed carries `cause: err`
    //      for the renderer's 4-space-indent trailer.
    //   4. Generic runtime error -- PluginFailedMessage with reasons: []
    //      and cause: err. The renderer suppresses the empty `{...}`
    //      brace per D-15-01 and surfaces the cause-chain trailer below
    //      the bare `(failed)` row.
    const isPathContainment = err instanceof PathContainmentError;
    const rolledBackPartial = !isPathContainment && capture.rollbackPartials.length > 0;
    const entityErrorRow = isPathContainment
      ? undefined
      : classifyEntityShapeError(err, { plugin, marketplace, scope });
    const failureMessage = composeInstallFailureMessage({
      err,
      plugin,
      scope,
      version: capture.version,
      rolledBackPartial,
      rollbackPartials: capture.rollbackPartials,
      entityErrorRow,
    });

    if (opts.notifications?.mode === "orchestrated") {
      // Orchestrated mode: compose the formatted-cause string so callers
      // reading `outcome.cause` for rendering keep working. The typed
      // Error remains the dispatch surface; narrow on `instanceof
      // PluginShapeError` to recover the specific failure kind.
      return classifyInstallFailure(err, formatOrchestratedCause(err));
    }

    notifyWithContext(ctx, pi, INSTALL_CONTEXT, [
      {
        name: marketplace,
        scope,
        plugins: [failureMessage],
      },
    ]);
    // Collapsed failure: `error` is the dispatch surface; `cause` is the
    // formatted text for callers that render it directly.
    const wrapped = err instanceof Error ? err : new Error(errorMessage(err));
    return { status: "failed", error: wrapped, cause: formatOrchestratedCause(err) };
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
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- mutated inside the withLockedStateTransaction closure above.
  if (configInvalid) {
    const cause = `Config file "${configBasename}" failed schema validation.`;
    const invalidErr = new Error(cause);
    if (orchestrated) {
      return { status: "failed", error: invalidErr, cause };
    }

    notifyWithContext(ctx, pi, INSTALL_CONTEXT, [
      {
        name: marketplace,
        scope,
        plugins: [
          {
            status: "failed",
            severity: "error" as const,
            name: plugin,
            reasons: ["invalid manifest"] as const,
            cause: invalidErr,
          },
        ],
      },
    ]);
    return { status: "failed", error: invalidErr, cause };
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- `marketplaceAbsent` is mutated inside the withLockedStateTransaction closure above; TS flow analysis cannot prove the closure executed, so it sees the variable as still `false`. The check is required at runtime.
  if (marketplaceAbsent) {
    const cause = `Marketplace "${marketplace}" is not added in the ${scope} scope.`;
    if (opts.notifications?.mode === "orchestrated") {
      return { status: "failed", error: new Error(cause), cause };
    }

    notify(ctx, pi, {
      kind: "marketplace-not-added",
      name: marketplace,
      scope,
    });
    return { status: "failed", error: new Error(cause), cause };
  }

  // Defensive: the success path always populates installCtx; if it did not,
  // surface the inconsistency rather than silently emit a missing message.
  if (installCtx === undefined) {
    const cause = `installPlugin: internal error -- guard returned cleanly without populating install context for plugin "${plugin}".`;
    const internalErr = new Error(cause);
    if (opts.notifications?.mode === "orchestrated") {
      return { status: "failed", error: internalErr, cause };
    }

    // Internal-error defensive arm: synthesise a PluginFailedMessage
    // carrying the wrapped internalErr. `reasons: []` -- no closed-set
    // Reason classifies an internal invariant violation; the renderer
    // suppresses the empty brace per D-15-01 and surfaces the cause
    // text via the 4-space-indent trailer.
    //
    // CR-02: row-level `scope` is OMITTED -- the marketplace block carries
    // the same scope, and `shared/notify.ts::renderScopeBracket` suppresses
    // the per-row bracket in that case. Matches the IN-04 omit convention
    // used by this file's primary catch path's
    // `composeInstallFailureMessage` recipe.
    notifyWithContext(ctx, pi, INSTALL_CONTEXT, [
      {
        name: marketplace,
        scope,
        plugins: [
          {
            status: "failed",
            severity: "error" as const,
            name: plugin,
            reasons: [] as const,
            cause: internalErr,
          },
        ],
      },
    ]);
    return { status: "failed", error: internalErr, cause };
  }

  const postCommitWarnings: string[] = [];

  // POST-state-commit (AS-6 / D-08): eager per-plugin data dir mkdir.
  // The state record is already committed; the side effect runs inside
  // a defensive try/catch so a permission error cannot strand the
  // install. The standalone-mode user-visible warning is DROPPED per
  // D-19-01: the MarketplaceNotificationMessage type has no field to
  // surface "data-dir creation deferred after successful state
  // mutation". The orchestrated-mode collection path is preserved for
  // the cascade caller's pushDiagnostic channel.
  try {
    await mkdir(installCtx.pluginDataDir, { recursive: true });
  } catch (mkdirErr) {
    const msg = `Plugin "${plugin}" installed; data dir creation deferred at ${installCtx.pluginDataDir}: ${errorMessage(mkdirErr)}`;
    if (orchestrated) {
      postCommitWarnings.push(msg);
    }
    // else: D-19-01 -- dropped in standalone mode.
  }

  // D-03-INV: post-state-commit completion-cache invalidation.
  // Plugin moved from "available" -> "installed"; drop the cached plugin
  // index for this marketplace so the next completion read rebuilds with
  // the new status. Defense-in-depth try/catch.
  //
  // Per D-19-01 the cache-refresh failure is swallowed silently. The
  // cache-refresh side effect still fires; only the user-visible warning
  // surface is gone. The orchestrated-mode collection path is preserved
  // for the cascade caller.
  try {
    await dropMarketplaceCache(await locations.pluginCacheFile(marketplace), scope, marketplace);
  } catch (err) {
    const msg = `Plugin "${plugin}" installed; completion cache refresh deferred: ${errorMessage(err)}`;
    if (orchestrated) {
      postCommitWarnings.push(msg);
    }
    // else: D-19-01 -- dropped in standalone mode.
  }

  // AS-7 / W-08 / B-08: agents-bridge preserved foreign-content rows
  // during prepare. The install of NEW agents succeeded; the
  // foreign-preserved rows are a manual-cleanup hint. The standalone-mode
  // user-visible warning is DROPPED per D-19-01: agent foreign-file
  // preservation rows have no clean MarketplaceNotificationMessage
  // representation. The orchestrated-mode collection path is preserved
  // for the cascade caller; the underlying agents-bridge state still
  // records the foreign-row preservation in agents-index.json.
  if (installCtx.agentForeignFailures.length > 0) {
    const detail = installCtx.agentForeignFailures
      .map((f) => `${f.generatedName}: ${f.reason}`)
      .join("; ");
    const msg = `Plugin "${plugin}" installed; ${installCtx.agentForeignFailures.length.toString()} pre-existing agent file(s) preserved on disk: ${detail}`;
    if (orchestrated) {
      postCommitWarnings.push(msg);
    }
    // else: D-19-01 -- dropped in standalone mode.
  }

  // Bridge-side soft warnings (e.g. agents bridge cleanup-leak return
  // values aggregated during the staged phases). The standalone-mode
  // user-visible warning is DROPPED per D-19-01: bridge-side soft
  // warnings have no clean representation. The orchestrated-mode
  // collection path is preserved.
  for (const w of installCtx.bridgeWarnings) {
    if (orchestrated) {
      postCommitWarnings.push(w);
    }
    // else: D-19-01 -- dropped in standalone mode.
  }

  // PI-9 corollary: track whether anything was actually staged. Preserved
  // verbatim because `InstallPluginOutcome.resourcesChanged` is consumed
  // by import/execute.ts as a structural predicate.
  const stagedAny =
    installCtx.stagedSkillNames.length > 0 ||
    installCtx.stagedCommandNames.length > 0 ||
    installCtx.stagedAgentNames.length > 0 ||
    installCtx.stagedMcpServerNames.length > 0;

  if (!orchestrated) {
    // Success: one notify(ctx, pi, ...) call with a
    // PluginInstalledMessage. The renderer probes companion-loaded
    // state via softDepStatus(pi) and emits the
    // per-row soft-dep markers (`{requires pi-subagents, requires
    // pi-mcp}`) automatically from `dependencies: readonly
    // Dependency[]`. The "/reload to pick up changes" trailer fires
    // structurally on the `installed` status; the reload-hint trigger
    // ladder is per-variant, not per-resource-count (RH-1, PU-8 (b)).
    //
    // The PI-13 dependencies-declaration note is DROPPED per D-19-01:
    // the PR-5 free-form prose has no clean
    // MarketplaceNotificationMessage representation; the resolver still
    // appends the note to `installable.notes` so downstream surfaces
    // (e.g. `/claude:plugin list` rendering) can continue to consume it.
    const dependencies: Dependency[] = [];
    if (installCtx.stagedAgentNames.length > 0) {
      dependencies.push("agents");
    }

    if (installCtx.stagedMcpServerNames.length > 0) {
      dependencies.push("mcp");
    }

    // IN-02 / IN-04: pass `version` straight through (`resolvePluginVersion`
    // in `shared.ts::resolvePluginVersion` always returns a non-empty
    // string, and the renderer's version-slot composer suppresses
    // `v<version>` on undefined or empty regardless). Row-level `scope` is
    // OMITTED: the single-plugin install surface's row scope always equals
    // the marketplace block's scope, and `shared/notify.ts::renderScopeBracket`
    // suppresses the per-row bracket in that case -- matching the same
    // omit convention used by `uninstall.ts::uninstallPlugin` and
    // `reinstall.ts::reinstallPlugin`.
    // SURF-05 / D-63-08: surface `(installed) {orphan rewake}` when the
    // resolver flagged a handler with `rewakeMessage` / `rewakeSummary` but
    // no `asyncRewake: true`. One-per-plugin -- the resolver records a
    // single flag, the install row emits a single reason regardless of N
    // orphan handlers. Reasons share the brace block with any companion
    // soft-dep markers per MSG-GR-4.
    const reasons: ContentReason[] = [];
    if (installCtx.resolved.orphanRewake === true) {
      reasons.push("orphan rewake");
    }

    // FSTAT-07 / D-66-04: when the live resolved state is `partially-available`, the
    // install was partially completed with one or more components dropped -- the
    // success row reports `(partially-installed)` carrying the dropped-component
    // detail via the shared `narrowUnsupportedKinds` helper. This reads the
    // LIVE resolved state of the just-completed install -- NOT the persisted
    // `compatibility.unsupported` record the `list` / non-path `info` derivers
    // read; the two agree here only because the install just wrote that record.
    // A fully-supported install stays `(installed)` (FSTAT-03 -- no lingering
    // partial state). partially-installed is a realized transition
    // (TRANSITION_STATUS_LIST), so it stamps the same info-severity + reload as
    // installed. WR-03: the partially-available arm still stages the
    // SUPPORTED components, so the row threads `dependencies` -- the soft-dep
    // `{requires pi-subagents}` / `{requires pi-mcp}` markers fire on a degraded
    // install exactly as on a clean one (where the signal is most relevant).
    // SEV-01: an otherwise-successful install whose DECLARED soft-dep companion
    // is unloaded silently degrades a clean install -> raise the desired-state
    // severity from info to warning. A staged agent declares a `pi-subagents`
    // companion; a staged mcp server declares `pi-mcp-adapter`. `softDepStatus`
    // is the single sanctioned companion probe -- the same one the renderer uses
    // for the `{requires pi-...}` marker that already renders the detail, so this
    // is a metadata-only stamp (the per-row bytes do not change; the cascade
    // gains the warning summary line). A loaded companion -- or no declared
    // companion -- keeps the info stamp. Applies to BOTH the clean `installed`
    // and degraded `partially-installed` success arms.
    const successSeverity = companionSeverity(
      {
        declaresAgents: installCtx.stagedAgentNames.length > 0,
        declaresMcp: installCtx.stagedMcpServerNames.length > 0,
      },
      softDepStatus(pi),
    );
    const installedRow: InstallMsg =
      installCtx.resolved.state === "partially-available"
        ? {
            status: "partially-installed",
            name: plugin,
            dependencies,
            version: installCtx.version,
            reasons: [...reasons, ...narrowUnsupportedKinds(installCtx.resolved.unsupported)],
            severity: successSeverity,
            needsReload: true,
          }
        : {
            status: "installed",
            name: plugin,
            dependencies,
            version: installCtx.version,
            ...(reasons.length > 0 && { reasons }),
            // D-03/D-06: realized install transition -> reloads Pi resources.
            // SEV-01: info, raised to warning above on a missing companion.
            severity: successSeverity,
            needsReload: true,
          };
    // notify() call mirrors the recipe at
    // orchestrators/plugin/uninstall.ts; install.ts substitutes
    // "installed" + dependencies[] + per-D-19-03 failure branches
    // (D-19-02 + D-19-03).
    notifyWithContext(ctx, pi, INSTALL_CONTEXT, [
      {
        name: marketplace,
        scope,
        plugins: [installedRow],
      },
    ]);
  }

  return {
    status: "installed",
    resourcesChanged: stagedAny,
    declaresAgents: installCtx.stagedAgentNames.length > 0,
    declaresMcp: installCtx.stagedMcpServerNames.length > 0,
    ...(postCommitWarnings.length > 0 && { postCommitWarnings }),
  };
}

// D-19-03 / CMC-17 / MSG-RP-1: the PluginFailedMessage.rollbackPartial
// field (SNM-09 + SNM-10) is the structural rollback-partial channel; the
// renderer at shared/notify.ts::composeRollbackPartialLines drives all
// indentation (4-space rollback-child row + 6-space per-phase cause-chain
// trailer). The transaction/phase-ledger.ts RollbackPartial exposes the
// typed cause?: Error, threaded directly into the field.

/**
 * Compose the per-variant plugin notification for the install failure
 * surface. Routes to one of four shapes per D-19-03 (priority highest
 * first):
 *
 *   1. PI-14 PathContainmentError -- PluginFailedMessage with reasons:
 *      [], cause: err. The renderer surfaces the message via the
 *      4-space-indent cause-chain trailer; no rollback-partial children
 *      even when partials are present.
 *   2. Rollback-partial -- PluginFailedMessage with reasons:
 *      ["rollback partial"] plus rollbackPartial: readonly { phase;
 *      cause? }[] (typed Error threaded directly from the ledger).
 *   3. Entity-shape (classifier returns non-undefined) -- preserves the
 *      classifier's status discriminator (failed vs unavailable) so the
 *      catalog `failure-unsupported-features` byte form (uses
 *      "unavailable") and the catalog `failure-rollback-partial` /
 *      `failure-runtime-with-cause` forms (use "failed") both
 *      round-trip cleanly. PluginUnavailableMessage carries reasons but
 *      no cause (D-15-01 / SNM-10); PluginFailedMessage carries both.
 *   4. Generic runtime error -- PluginFailedMessage with reasons: [],
 *      cause: err.
 *
 * The narrowed `cause?: Error` field on failure variants is populated
 * only when `err instanceof Error` (defensive against non-Error throws).
 */
// WR-04: `marketplace` is not in the args type -- nothing in this
// function reads it. If the marketplace name becomes needed for future
// cause-chain composition (e.g. to disambiguate a same-named plugin
// across marketplaces), add it back here with a comment marking the
// dependency.
/**
 * SEV-02 / D-69-03 / D-70-02 / XSURF-01: build the install-failure row,
 * branching on the three-way `partialable` discriminant the resolver stamped on
 * the throw. BOTH arms render at error severity (so the leading summary line
 * fires) -- an install failure must read as an error, not a benign info row.
 * The partially-available arm surfaces as the resolver-state-driven `partially-available`
 * token (XSURF-01: consistent with how `list` / `info` describe the same
 * plugin) and ALSO carries the `--partial` hint trailer (`--partial` can degrade-install
 * it). The structural arm stays the `unavailable` token with NO hint (force
 * cannot degrade-install a structural defect). The split keys on
 * `entityErrorRow.partialable`, NOT the reason brace -- `{unsupported source}`
 * appears on both arms; only the resolver verdict distinguishes them. Neither
 * message carries a `cause?` field per D-15-01 -- the reason text carries the
 * explanation.
 */
function composeNotInstallableMessage(
  plugin: string,
  version: string | undefined,
  entityErrorRow: EntityErrorRow,
): PluginUnavailableMessage | PluginPartiallyAvailableMessage {
  if (entityErrorRow.partialable === true) {
    return {
      status: "partially-available",
      name: plugin,
      reasons: entityErrorRow.reasons,
      ...(version !== undefined && version !== "" && { version }),
      severity: "error" as const,
      partialHint: true,
    };
  }

  return {
    status: "unavailable",
    name: plugin,
    reasons: entityErrorRow.reasons,
    ...(version !== undefined && version !== "" && { version }),
    severity: "error" as const,
  };
}

/**
 * PROV-04 / D-76-08 / D-79-03: classify a git-source clone auth challenge into
 * the EXISTING closed-set `authentication required` REASON -- no new token. A
 * private clone on a no-provider host (or a still-401 after a fresh credential,
 * D-79-02) throws the isomorphic-git `HttpError` with a 401/403 status; an
 * unsuccessful device flow (denied / expired / poll network error) makes
 * platform/git.ts's onAuth return `{ cancel: true }`, which isomorphic-git
 * throws as `UserCanceledError` instead. The seam append-leak-rethrows either
 * up to the install catch; both shapes narrow through the shared
 * `classifyGitTransportFailure` ladder. Install keeps ONLY its auth
 * classification: a network-class transport failure stays undefined here so it
 * rides the generic-runtime cause-chain fallthrough.
 *
 * D-79-03 (amended): the install row is the BARE `(failed) {authentication
 * required}` -- no `no auth provider is registered for <host>` cause line (the
 * plugin failure grammar has no cause-chain trailer slot that renders on the
 * SUBJECT row; the cause line lives ONLY on the update path's synthetic
 * failed-plugin child row). Returns undefined for a non-auth throw so the caller
 * keeps its generic-runtime cause-chain fallthrough.
 */
function classifyGitAuthFailure(err: unknown): "authentication required" | undefined {
  return classifyGitTransportFailure(err) === "authentication required"
    ? "authentication required"
    : undefined;
}

function composeInstallFailureMessage(args: {
  err: unknown;
  plugin: string;
  scope: Scope;
  version: string | undefined;
  rolledBackPartial: boolean;
  rollbackPartials: readonly RollbackPartial[];
  entityErrorRow: EntityErrorRow | undefined;
}): InstallMsg {
  const { err, plugin, scope, version, rolledBackPartial, rollbackPartials, entityErrorRow } = args;
  const cause = err instanceof Error ? err : undefined;
  const isPathContainment = err instanceof PathContainmentError;

  // Branch 1: PI-14 PathContainmentError. Bare failed row with cause
  // trailer; no rollback-partial children, no entity-shape narrowing.
  if (isPathContainment) {
    const failed: PluginFailedMessage = {
      status: "failed",
      name: plugin,
      reasons: [] as const,
      ...(version !== undefined && version !== "" && { version }),
      scope,
      ...(cause !== undefined && { cause }),
      // D-03/D-06: a failed install -> error, no reload (nothing landed).
      severity: "error",
      needsReload: false,
    };
    return failed;
  }

  // Branch 2: rollback-partial. Thread RollbackPartial.cause directly
  // -- no synthesis from the free-form .msg.
  if (rolledBackPartial) {
    const failed: PluginFailedMessage = {
      status: "failed",
      name: plugin,
      reasons: ["rollback partial"] as const,
      ...(version !== undefined && version !== "" && { version }),
      scope,
      ...(cause !== undefined && { cause }),
      // D-03/D-06: a failed install -> error, no reload (nothing landed).
      severity: "error",
      needsReload: false,
      rollbackPartial: rollbackPartials.map((p) => ({
        phase: p.phase,
        ...(p.cause !== undefined && { cause: p.cause }),
      })),
    };
    return failed;
  }

  // Branch 3: entity-shape error. Preserve the classifier's status
  // discriminator (`failed` | `unavailable`) so the catalog byte forms
  // round-trip. The classifier's reasons array is closed-set Reason[]
  // already; thread it verbatim. PluginUnavailableMessage has no `cause?`
  // field per D-15-01 -- the reason text carries the explanation.
  if (entityErrorRow !== undefined) {
    if (entityErrorRow.status === "unavailable") {
      return composeNotInstallableMessage(plugin, version, entityErrorRow);
    }

    const failed: PluginFailedMessage = {
      status: "failed",
      name: plugin,
      reasons: entityErrorRow.reasons,
      ...(version !== undefined && version !== "" && { version }),
      scope,
      ...(cause !== undefined && { cause }),
      // D-03/D-06: a failed install -> error, no reload (nothing landed).
      severity: "error",
      needsReload: false,
    };
    return failed;
  }

  // Branch 4: runtime throw. A PROV-04 git-source clone auth challenge maps to
  // the bare `(failed) {authentication required}` row (amended D-79-03: the
  // closed-set REASON carries the classification and NO cause line renders on
  // the install subject row -- the no-provider cause line lives only on the
  // update path's child row), so `cause` is omitted for it. Every other runtime
  // throw keeps an empty reasons array and rides the cause-chain trailer (the
  // renderer suppresses the `{}` brace per D-15-01).
  const authReason = classifyGitAuthFailure(err);
  const failed: PluginFailedMessage = {
    status: "failed",
    name: plugin,
    reasons: authReason !== undefined ? ([authReason] as const) : ([] as const),
    ...(version !== undefined && version !== "" && { version }),
    scope,
    ...(authReason === undefined && cause !== undefined && { cause }),
    // D-03/D-06: a failed install -> error, no reload (nothing landed).
    severity: "error",
    needsReload: false,
  };
  return failed;
}

/**
 * Format the orchestrated-mode `cause` string for the
 * `InstallPluginOutcome.cause` field. The import cascade caller at
 * `orchestrators/import/execute.ts` reads this string for its
 * `dispatchFailedOutcome` rendering. Follows the D-CMC-12 join
 * discipline: `<errorMessage>` plus the depth-5 cause-chain trailer
 * (shared/errors.ts::causeChainTrailer) joined with a blank line when
 * present. Standalone-mode trailers are emitted by `notify()` from
 * the structural `PluginFailedMessage.cause` field; this helper exists
 * solely to preserve the orchestrated-mode string contract.
 */
function formatOrchestratedCause(err: unknown): string {
  const head = errorMessage(err);
  const trailer = causeChainTrailer(err);
  return trailer === "" ? head : `${head}\n\n${trailer}`;
}

/**
 * CMC-34 / MSG-NC-1 entity-shape error classifier for the single-plugin
 * install failure surface. Returns an `EntityErrorRow` when the orchestrator's
 * thrown error matches a recognised entity-shape pattern (PI-3 / PI-4 / PI-5);
 * returns `undefined` for generic runtime errors which surface via
 * bare `errorMessage(err)` + the cause-chain trailer.
 *
 * Pattern map (PRD §5.2.1 + catalog §"/claude:plugin install"):
 *   - "not found in marketplace"       -> (failed)      {not in manifest}
 *   - "is already installed"           -> (failed)      {already installed}
 *   - "is not installable: <notes>"    -> (unavailable) {<narrowed reasons from notes>}
 *
 * The `is not installable` notes are split on `; ` and each segment narrowed
 * to a closed `Reason`: manifest field names (`hooks` / `lspServers` etc.)
 * pass verbatim per the MSG-GR-4 manifest-field carve-out; the catch-all
 * is `unsupported source` (closed REASONS member).
 */
function classifyEntityShapeError(
  err: unknown,
  ctx: { plugin: string; marketplace: string; scope: Scope },
): EntityErrorRow | undefined {
  // Dispatch on `instanceof PluginShapeError` + `.shape.kind` rather than
  // substring-matching `.message`. The throw sites carry their structural
  // classification verbatim, so the catch site does not need to reparse text.
  if (!(err instanceof PluginShapeError)) {
    return undefined;
  }

  switch (err.shape.kind) {
    case "already-installed":
      return {
        kind: "entity-error",
        name: ctx.plugin,
        marketplace: ctx.marketplace,
        scope: ctx.scope,
        status: "failed",
        reasons: ["already installed"] as const,
      };
    case "not-in-manifest":
      return {
        kind: "entity-error",
        name: ctx.plugin,
        marketplace: ctx.marketplace,
        scope: ctx.scope,
        status: "failed",
        reasons: ["not in manifest"] as const,
      };
    case "not-installable":
    case "no-longer-installable":
      return {
        kind: "entity-error",
        name: ctx.plugin,
        marketplace: ctx.marketplace,
        scope: ctx.scope,
        status: "unavailable",
        // Resolver `r.notes` are free-form strings; narrow to closed
        // `Reason` members for the renderer. Reading from `err.shape`
        // (the typed discriminated union) means the narrow on
        // `.kind === "not-installable" | "no-longer-installable"`
        // guarantees `.reasons` is present -- no `?? []` fallback
        // needed.
        reasons: narrowResolverReasons(err.shape.reasons, err.shape.unsupportedKinds),
        // SEV-02 / D-69-03: thread the three-way distinction the resolver
        // stamped on the throw so the composer conditions the `--partial` hint.
        partialable: err.shape.partialable,
      };
    default:
      return assertNever(err.shape);
  }
}

// Manifest field names detected through the MSG-GR-4 carve-out. The closed
// set holds the BARE camelCase token (`lspServers`) -- the DETECTION key
// sliced from the resolver note, derived from the real `.claude-plugin/
// plugin.json` JSON key. The resolver prefixes the kind with `"contains "`
// when populating `r.notes` (the `addUnsupportedKindNotes` helper pushes
// a `contains ${kind}` note for every UNSUPPORTED_COMPONENT_KINDS member
// it detects).
// The carve-out: `startsWith("contains ")` strips the resolver's prefix,
// then checks the remaining token against the set.
// HOOK-04 / D-58-02: `lspServers` is now the SOLE manifest-field
// carve-out. `hooks` was a supported component kind under v1.13 (the
// `SUPPORTED_COMPONENT_KINDS` extension) so the resolver no longer
// emits a `"contains hooks"` note; the dead carve-out entry was
// dropped. The `{unsupported hooks}` reason is now a normal 2-word
// REASON sourced through `shared/probe-classifiers.ts::narrowResolverNotes`
// against the `parseHooksConfig` prefix tokens, not a manifest-field
// carve-out emitted here.
// New detection tokens added here MUST also have an entry in
// `MANIFEST_FIELD_TO_REASON` below mapping them to a member of the closed
// `Reason` set in `shared/notify.ts::REASONS` so the renderer accepts them.
const MANIFEST_FIELD_REASONS: ReadonlySet<string> = new Set(["lspServers"]);
const MANIFEST_FIELD_NOTE_PREFIX = "contains ";

/**
 * Extract the bare manifest-field token from a resolver `"contains <kind>"`
 * note and map it to the emitted closed-set `Reason`. Returns `undefined`
 * when the note does not start with the prefix or the token is not a
 * recognized per-kind unsupported marker.
 *
 * SNM-36 / D-24-04 detection-vs-emission seam: the DETECTION token stays
 * camelCase (matches the resolver note derived from the JSON manifest key);
 * the EMITTED closed-set Reason is the user-rendered value. `lspServers`
 * detects but renders as `lsp`.
 *
 * D-64-02 / RSTATE-05: the token -> Reason mapping is the single shared
 * render helper `narrowUnsupportedKinds`, so the install error surface emits
 * the same per-kind marker `list` and `info` do (SURF-01 cross-surface
 * parity); install no longer carries its own per-kind mapping table.
 */
function manifestFieldTokenFromNote(note: string): ContentReason | undefined {
  if (!note.startsWith(MANIFEST_FIELD_NOTE_PREFIX)) {
    return undefined;
  }

  const token = note.slice(MANIFEST_FIELD_NOTE_PREFIX.length);
  // DETECT: gate on the camelCase manifest-field token (STAYS camelCase --
  // it matches the resolver note derived from the JSON manifest key).
  if (!MANIFEST_FIELD_REASONS.has(token)) {
    return undefined;
  }

  // EMIT: map the detected camelCase token to its closed-set Reason via the
  // shared render helper (D-64-02). The detection gate above admits only
  // `lspServers`, so this always resolves to `lsp`.
  return narrowUnsupportedKinds([token])[0];
}

/**
 * Narrow resolver `r.notes` (free-form strings) to the closed `Reason` set
 * for renderer consumption. Classification order:
 *   0. four `hooks.json` prefix families
 *      (`hooks.json is not valid JSON:` / `hooks.json failed schema validation:` /
 *      `unsupported hooks:` / `malformed hooks.json:`) -> `unsupported hooks`
 *      -- mirrors `shared/probe-classifiers.ts::narrowResolverNotes` for
 *      cross-surface parity (HOOK-03 / LIFE-01 / SURF-01)
 *   1. manifest-field carve-out (`contains lspServers`) -- HOOK-04 / D-58-02
 *      dropped the dead `contains hooks` half (hooks is supported under v1.13)
 *   1b. any other `contains <kind>` note (e.g. `monitors`, `themes`) routes its
 *      bare token through the shared `narrowUnsupportedKinds` helper so the
 *      install surface emits the same per-kind marker set as `list`/`info`
 *      (CR-01 / SURF-01 / D-64-02) instead of dropping non-`lspServers` kinds
 *   2. "source" substring -> `unsupported source`
 *   3. errno-like substrings (EACCES / EPERM / ENOENT / SyntaxError)
 *   4. permissive fallback: `unsupported source`
 * Steps 3-4 are defensive for notes already serialised by deeper helpers;
 * the preferred path is typed errno-bearing Errors dispatched at the
 * orchestrator catch site via `.code`.
 *
 * IN-02 / RSTATE-05: `unsupportedKinds` is the resolver's typed `unsupported[]`
 * component-kind list (carried on the thrown `PluginShapeError`). It is narrowed
 * FIRST, through the shared `narrowUnsupportedKinds` helper, so the failure row
 * renders the same per-kind markers `list`/`info` do. This is the ONLY reason
 * source for a `hooks`-only partially-available plugin (which carries no `contains hooks`
 * note), and it is deduped against the note-derived markers (e.g. a `lspServers`
 * plugin yields one `lsp`, sourced from both the note and the typed kind). The
 * permissive `unsupported source` fallback fires only when BOTH sources are empty.
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
function narrowResolverReasons(
  reasons: readonly string[],
  unsupportedKinds: readonly string[] = [],
): readonly ContentReason[] {
  const out: ContentReason[] = [...narrowUnsupportedKinds(unsupportedKinds)];
  for (const reason of reasons) {
    if (reason === "") {
      continue;
    }

    // Cross-surface parity with `shared/probe-classifiers.ts::narrowResolverNotes`.
    // The resolver emits four `hooks.json`-prefix families when `parseHooksConfig`
    // rejects an on-disk hooks config (HOOK-03 / LIFE-01); both this install-side
    // classifier and the read-only probe classifier MUST emit the same
    // `unsupported hooks` REASONS token for the same on-disk condition (SURF-01).
    // Mirrors the probe-side prefix set verbatim -- if a prefix is added or
    // renamed on one side, the other side MUST follow in lockstep (pinned by
    // tests/orchestrators/plugin/cross-surface-reason-parity.test.ts).
    const isHooksNote =
      reason.startsWith("hooks.json is not valid JSON:") ||
      reason.startsWith("hooks.json failed schema validation:") ||
      reason.startsWith("unsupported hooks:") ||
      reason.startsWith("malformed hooks.json:");
    if (isHooksNote) {
      out.push("unsupported hooks");
      continue;
    }

    // The resolver emits `"contains hooks"` / `"contains lspServers"` --
    // extract the bare token via the typed helper for the MSG-GR-4 carve-out.
    const manifestFieldToken = manifestFieldTokenFromNote(reason);
    if (manifestFieldToken !== undefined) {
      out.push(manifestFieldToken);
      continue;
    }

    // CR-01 / SURF-01 / D-64-02: a `contains <kind>` note for a kind OTHER than
    // the `lspServers` carve-out handled above (e.g. `monitors`, `themes`) is
    // still a per-kind unsupported component marker. Route its bare token
    // through the SAME shared helper `list`/`info` consume so a multi-kind
    // `partially-available` plugin emits a byte-identical marker set on every surface.
    // Previously these notes were dropped here whenever an earlier note had
    // already populated `out` (the empty-array fallback then did not fire), so
    // `install` rendered fewer markers than `list`/`info` for the same plugin.
    if (reason.startsWith(MANIFEST_FIELD_NOTE_PREFIX)) {
      out.push(...narrowUnsupportedKinds([reason.slice(MANIFEST_FIELD_NOTE_PREFIX.length)]));
      continue;
    }

    if (reason.includes("source")) {
      out.push("unsupported source");
      continue;
    }

    // Defensive errno-substring fallback (see JSDoc above).
    if (reason.includes("EACCES") || reason.includes("EPERM")) {
      out.push("permission denied");
      continue;
    }

    if (reason.includes("ENOENT") || reason.includes("ENOTDIR")) {
      out.push("source missing");
      continue;
    }

    if (reason.includes("SyntaxError") || reason.includes("Unexpected token")) {
      out.push("unparseable");
    }
  }

  if (out.length === 0) {
    // Conservative fallback: at least one Reason is required for the
    // EntityErrorRow `reasons` field. `unsupported source` is the
    // documented permissive default for an unclassifiable PI-4 cause.
    out.push("unsupported source");
  }

  // Dedup, preserving first-seen order: a multi-note resolver failure can
  // map several notes to the same closed Reason, and the row must not
  // render a duplicate token.
  return [...new Set(out)];
}

function classifyInstallFailure(err: unknown, formattedCause: string): InstallPluginOutcome {
  // All failure variants collapse to `{ status: "failed"; error; cause }`.
  // `error` is the dispatch surface (narrow on `instanceof PluginShapeError`
  // to recover `.shape.kind`); `cause` is the formatted user-visible text.
  // `ConcurrentInstallError` is preserved as a distinct typed branch (PI-15);
  // non-Error inputs are wrapped so the contract guarantees `error instanceof Error`.
  const wrapped = err instanceof Error ? err : new Error(formattedCause);
  return { status: "failed", error: wrapped, cause: formattedCause };
}

/**
 * Test seam for the catch-site dispatch helpers. Helpers stay private to
 * the orchestrator; tests exercise the `instanceof PluginShapeError` +
 * `.kind` dispatch branches directly via this re-export.
 */
export { classifyEntityShapeError as __test_classifyEntityShapeError };
export { classifyInstallFailure as __test_classifyInstallFailure };
export { composeInstallFailureMessage as __test_composeInstallFailureMessage };
export { narrowResolverReasons as __test_narrowResolverReasons };

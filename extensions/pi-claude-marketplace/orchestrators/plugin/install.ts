// orchestrators/plugin/install.ts
//
// PI-1..15 + AS-6 + AS-7 + COMP-01 + NFR-5.
//
// Production consumer of the runPhases<C> ledger primitive
// (transaction/phase-ledger.ts). Composition order is locked by D-01,
// D-02, D-05, D-08:
//
//   withLockedStateTransaction(locations, async (tx) => {   // D-02 outer guard
//     runInstallLedgerBody(state, locations, opts, capture)  // guard-FREE body:
//       PI-15 early sanity:  throw if state.marketplaces[mp].plugins[plugin] != null
//       PI-3:                throw if marketplace / entry absent
//       PI-2:                cached manifest read ONLY (no network)
//       PI-4:                resolveStrict + requireInstallable
//       PI-6:                assertNoCrossPluginConflicts(scope, names, state)
//       PI-7:                deriveInstallVersion -- pin override, then the
//                            git-source sha, then the 3-tier precedence
//                            (plugin.json > entry.version > hash) delegated
//                            to `shared.ts::resolvePluginVersion`
//       runPhases(phases, ctx)                             // D-01 5-phase ledger
//       capture rollbackPartials, throw raw error          // D-02 PI-14 bypass
//   })
//
// CR-01: the ledger body is extracted into the exported
// guard-FREE `runInstallLedger` so `setPluginEnabled`'s enable branch can run
// it inside ITS OWN `withLockedStateTransaction` -- `proper-lockfile`
// (`retries: 0`) is not re-entrant, so nesting `installPlugin`'s guard under
// another guard on the same `stateLockFile` self-deadlocks. That exported
// entry returns the outward `InstallLedgerSummary`; `installPlugin` drives the
// same body directly because its own post-commit composition reads the working
// `InstallCtx` the summary deliberately withholds.
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
  prepareStagePluginAgents,
  unstagePluginAgents,
} from "../../bridges/agents/index.ts";
import {
  commitPreparedCommands,
  prepareStageCommands,
  unstagePluginCommands,
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
  commitPreparedMcp,
  prepareStageMcpServers,
  unstageMcpServers,
} from "../../bridges/mcp/index.ts";
import {
  commitPreparedSkills,
  prepareStageSkills,
  unstagePluginSkills,
} from "../../bridges/skills/index.ts";
import { parseHooksConfig, projectHookSummaryEntries } from "../../domain/components/hooks.ts";
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
import { writePluginConfigEntry } from "../../persistence/config-write-back.ts";
import { locationsFor } from "../../persistence/locations.ts";
import { toDisabledRecord } from "../../persistence/state-io.ts";
import { softDepStatus } from "../../platform/pi-api.ts";
import { dropMarketplaceCache } from "../../shared/completion-cache.ts";
import { hookDebugLog } from "../../shared/debug-log.ts";
import { ConcurrentInstallError, errorMessage, PluginShapeError } from "../../shared/errors.ts";
import { notifyWithContext } from "../../shared/notify-context.ts";
import {
  companionSeverity,
  malformedReasonsForKinds,
  type DegradeKind,
} from "../../shared/notify-reasons.ts";
import { notify } from "../../shared/notify.ts";
import { PathContainmentError } from "../../shared/path-safety.ts";
import { narrowUnsupportedKinds } from "../../shared/probe-classifiers.ts";
import { runPhases, type Phase, type RollbackPartial } from "../../transaction/phase-ledger.ts";
import { withLockedStateTransaction } from "../../transaction/with-state-guard.ts";
import { DEFAULT_CREDENTIAL_OPS, buildCloneAuth } from "../auth-host.ts";
import { cascadeUnstagePlugin, crossScopeFlag } from "../marketplace/shared.ts";

import {
  canonicalCloneUrl,
  materializeOrRefreshPluginMirror,
  materializePluginClone,
  resolveGitPluginRootWithSubdir,
  resolvePluginPin,
} from "./clone-cache.ts";
import { discoverGeneratedNames } from "./discover-names.ts";
import {
  INSTALL_CONTEXT,
  classifyEntityShapeError,
  classifyInstallFailure,
  composeInstallFailureMessage,
  formatOrchestratedCause,
  type InstallMsg,
} from "./install.messaging.ts";
import {
  applyPartialCascadeFold,
  assertNoCrossPluginConflicts,
  cloneMarketplaceRecordForTargetScope,
  pickAgentsSourceDir,
  removePluginRecord,
  resolveInstallMarketplaceSource,
  resolvePluginVersion,
  selectDeclaringConfigWriteTarget,
  surfaceDiscoveryWarnings,
  writeAdoptingConfigEntries,
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
import type { HookSummaryEntry } from "../../shared/concerns/hooks.ts";
import type { Dependency } from "../../shared/concerns/soft-dep.ts";
import type { ContentReason } from "../../shared/notify.ts";
import type { Scope } from "../../shared/types.ts";
import type { AuthAttemptResult, CredentialOps, DeviceFlowHttp } from "../auth-host.ts";
import type { UnstageOutcome } from "../marketplace/shared.ts";
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
   * PROV-03 / D-79-05 injection seam. Defaults to DEFAULT_CREDENTIAL_OPS at use.
   * The git-source clone probe passes it to `buildCloneAuth` so a provider
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
 *
 * Module-private on purpose: it is the transaction's mutable scratchpad --
 * the bridge prep handles a rollback reads, the hooks-write flag, and a live
 * reference to the caller's state snapshot. Callers outside this module get
 * the fully-`readonly` `InstallLedgerSummary` projection instead.
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
  // D-100-01 / ENBL-10: the supported hook entries the hooks phase
  // materialized, carried to the state phase for the record's `hookEntries`.
  // Stays undefined when the resolver advertises no hooks config.
  hookEntries?: readonly HookSummaryEntry[];
  // Names captured for PluginInstallRecord.resources and reload-hint composition.
  stagedSkillNames: readonly string[];
  stagedCommandNames: readonly string[];
  stagedAgentNames: readonly string[];
  stagedMcpServerNames: readonly string[];
  // Aggregated soft warnings from the bridges (e.g. agents bridge cleanup leaks).
  bridgeWarnings: string[];
  // D-07 discovery warnings from the skills, commands and agents bridges: an
  // artifact the plugin author shipped that this install did NOT materialize
  // (a duplicate generated name, an unreadable subdirectory, a source path
  // that produces no valid name). Kept apart from `bridgeWarnings` because
  // D-19-01 as amended surfaces these in standalone mode and the hygiene
  // warnings beside them stay suppressed.
  discoveryWarnings: string[];
  // Bridge-side per-record AG-5 foreign-content rows -- routed to notifyWarning post-success.
  agentForeignFailures: { generatedName: string; reason: string }[];
  // SKILL-01 / CMD-01 / WARN-01: per-component frontmatter-parse degrade records
  // collected from the skills + commands bridges. Feed the one-per-plugin
  // `{malformed skill}` / `{malformed command}` reason token (standalone row),
  // the per-component parse-error detail (orchestrated postCommitWarnings), and
  // the `degradedKinds` outcome seam the reconcile composer consumes.
  frontmatterDegradations: {
    kind: DegradeKind;
    generatedName: string;
    parseError: string;
  }[];
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
   * PROV-03: passed to the git-source clone probe's `buildCloneAuth` so a
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

/**
 * The outward view of a completed install ledger run.
 *
 * The ledger returns this projection rather than its working `InstallCtx`:
 * the context is a mutable scratchpad whose prep handles, hooks-write flag and
 * `stateSnapshot` steer the in-flight transaction, and publishing it would make
 * that mutation surface part of the ledger's API. This shape carries only the
 * facts a caller needs to compose its own row / outcome, every field `readonly`
 * down to the array elements, so no consumer can reach back into the run.
 */
export interface InstallLedgerSummary {
  /**
   * NFR-7 / D-65-03: the LIVE resolution the ledger materialized. Callers read
   * `state === "partially-available"` / `orphanRewake` off THIS, never off the
   * persisted `compatibility` block (FSTAT-07 / D-66-04 / SURF-05).
   */
  readonly resolved: MaterializablePlugin;
  /**
   * SKILL-01 / CMD-01 / WARN-01: per-component frontmatter-parse degrade
   * records, read for the `degradedKinds` outcome seam.
   */
  readonly frontmatterDegradations: readonly {
    readonly kind: DegradeKind;
    readonly generatedName: string;
    readonly parseError: string;
  }[];
  // Staged-name lists, read only for their emptiness (ENBL-07 soft-dep flags).
  readonly stagedAgentNames: readonly string[];
  readonly stagedMcpServerNames: readonly string[];
}

/** Discriminated result of the guard-free install ledger body. */
export type InstallLedgerResult =
  | { readonly kind: "installed"; readonly summary: InstallLedgerSummary }
  | { readonly kind: "marketplace-absent" };

/**
 * The same discriminated result carrying the ledger's working context, for
 * this module's own post-commit composition. Never leaves install.ts.
 */
type InstallLedgerCtxResult =
  | { readonly kind: "installed"; readonly installCtx: InstallCtx }
  | { readonly kind: "marketplace-absent" };

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
    const authBundle = buildCloneAuth(cloneUrl, gitSource.kind, auth);
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
    const authBundle = buildCloneAuth(cloneUrl, gitSource.kind, auth);
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
 * The PI-15 / PI-3 / PI-2 / PI-4 preflight: resolve the source marketplace,
 * gate on the early-sanity record check, read the cached manifest, validate
 * the chosen entry, and run `resolveStrict` behind the correct
 * installability gate. Mutates `state.marketplaces[marketplace]` when the
 * CMP-3 fallback adopts a user-scope record into the target scope.
 *
 * Returns the `marketplace-absent` discriminant rather than throwing when
 * the precondition misses, so the caller can surface the MARKETPLACE
 * subject instead of a plugin-row failure.
 */
async function preflightInstallResolve(
  state: ExtensionState,
  locations: ScopedLocations,
  opts: InstallLedgerOptions,
): Promise<
  | { readonly kind: "marketplace-absent" }
  | {
      readonly kind: "ready";
      readonly entry: PluginEntry;
      readonly installable: MaterializablePlugin;
      readonly resolvedSha: string | undefined;
    }
> {
  const { scope, cwd, marketplace, plugin } = opts;

  // CMP-2..4 / PI-16: resolve the source marketplace separately from the
  // target scope being mutated. Project-target installs can fall back to a
  // user-scope marketplace; user-target installs cannot read project-only
  // marketplaces.
  const source = await resolveInstallMarketplaceSource({
    targetScope: scope,
    cwd,
    marketplace,
    targetState: state,
  });
  if (source === undefined) {
    // M1: the CMP-3 fallback also missed. No state mutation, no plugin-row
    // `{not in manifest}` throw.
    return { kind: "marketplace-absent" };
  }

  // Target container: same scope record when present, or a cloned
  // project-scope container when CMP-3 fell back to user marketplace.
  let targetMp = state.marketplaces[marketplace];
  if (targetMp === undefined) {
    targetMp = cloneMarketplaceRecordForTargetScope(source.sourceRecord, scope);
    state.marketplaces[marketplace] = targetMp;
  }

  // PI-15 early-sanity check: an existing record in the target scope throws
  // BEFORE the ledger runs, avoiding any disk write. Layer (b) re-checks
  // inside the state-commit phase in case of intra-process re-entry. PI-17:
  // other-scope installs do not block this target. D-54-01 / ENBL-02:
  // `allowExistingRecord` skips the throw so the enable path can
  // re-materialize a KEPT disabled record in place.
  if (targetMp.plugins[plugin] !== undefined && opts.allowExistingRecord !== true) {
    // PI-5 (already-installed) and PI-15 (race-at-commit) collapse here;
    // this site surfaces the PI-5 wording and the state-commit phase's
    // defensive throw surfaces PI-15.
    throw new PluginShapeError({ kind: "already-installed", plugin, marketplace });
  }

  // PI-2 cached-manifest read -- NO network, no gitOps. PI-3: the entry must
  // exist in the manifest plugins[] array.
  const sourceMp = source.sourceRecord;
  const manifest = await loadCachedMarketplaceManifest(sourceMp.manifestPath);
  const entryRaw = manifest.plugins.find((p) => p.name === plugin);
  if (entryRaw === undefined) {
    throw new PluginShapeError({ kind: "not-in-manifest", plugin, marketplace });
  }

  // Defense-in-depth: re-run the per-entry validator on the chosen entry so
  // a corrupted manifest cannot smuggle a malformed entry past the top-level
  // marketplace check.
  if (!PLUGIN_ENTRY_VALIDATOR.Check(entryRaw)) {
    throw new Error(
      `Plugin entry for "${plugin}" in marketplace "${marketplace}" failed schema validation.`,
    );
  }

  const entry: PluginEntry = entryRaw;

  // PURL-01..04 / PURL-09 / D-77-01..06: the clone-materializing
  // resolveGitPluginRoot callback plus its captured resolved sha. The
  // resolver stays network-free; install injects THIS policy so a git source
  // clones once into the cache and returns the clone-anchored pluginRoot.
  // The full sha is read AFTER the resolve for the sha-<12hex> version
  // (D-77-01) and the full-sha state field (D-77-02).
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

  // PI-4: resolveStrict + gate. Per D-04 the strict resolver consumes the
  // array-shape componentPaths (D-07 / COMP-01) and either returns an
  // installable variant or surfaces disqualification notes.
  const resolved = await resolveStrict(entry, {
    marketplaceRoot: sourceMp.marketplaceRoot,
    resolveGitPluginRoot: clone.probe,
  });
  // D-65-03 / FORCE-01/03/05: `--partial` widens the gate to admit the
  // partially-available arm; the default gate still blocks it. Both gates
  // reject `unavailable` (FORCE-05), so `--partial` never bypasses a hard
  // structural failure.
  if (opts.partial === true) {
    requirePartialInstallable(resolved, "install");
  } else {
    requireInstallable(resolved, "install");
  }

  // After the gate `resolved` is narrowed to the materializable union
  // (`installable | partially-available`); pluginRoot etc. are reachable.
  // The `partially-available` arm carries only supported kinds in
  // componentPaths, so the shared materialize phases degrade it naturally
  // (D-65-02, no partial branch).
  return { kind: "ready", entry, installable: resolved, resolvedSha: clone.resolvedSha() };
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
 *
 * Success returns the outward `InstallLedgerSummary` projection, not the
 * ledger's working context -- see that type for why.
 */
export async function runInstallLedger(
  state: ExtensionState,
  locations: ScopedLocations,
  opts: InstallLedgerOptions,
  capture?: InstallFailureCapture,
): Promise<InstallLedgerResult> {
  const result = await runInstallLedgerBody(state, locations, opts, capture);
  if (result.kind === "marketplace-absent") {
    return result;
  }

  return { kind: "installed", summary: toInstallLedgerSummary(result.installCtx) };
}

/** Project the completed ledger context onto its outward summary. */
function toInstallLedgerSummary(c: InstallCtx): InstallLedgerSummary {
  return {
    resolved: c.resolved,
    frontmatterDegradations: c.frontmatterDegradations,
    stagedAgentNames: c.stagedAgentNames,
    stagedMcpServerNames: c.stagedMcpServerNames,
  };
}

/**
 * The ledger body proper, under the contract documented on `runInstallLedger`.
 * Hands back the working `InstallCtx` for this module's own post-commit
 * composition (`collectPostCommitWarnings`, `composeInstalledRow`,
 * `buildInstalledOutcome`), which reads fields -- `locations`, `marketplace`,
 * `plugin` -- the outward summary withholds. Module-private: only the
 * declaring module holds the working context.
 */
async function runInstallLedgerBody(
  state: ExtensionState,
  locations: ScopedLocations,
  opts: InstallLedgerOptions,
  capture?: InstallFailureCapture,
): Promise<InstallLedgerCtxResult> {
  const { scope, cwd, marketplace, plugin } = opts;

  const preflight = await preflightInstallResolve(state, locations, opts);
  if (preflight.kind === "marketplace-absent") {
    return { kind: "marketplace-absent" };
  }

  const { entry, installable, resolvedSha } = preflight;

  // Generated-name discovery (PI-6 input). Walks the bridges' discover.ts
  // to enumerate source artifacts under componentPaths, then applies the
  // domain/name.ts generators to produce the names whose collisions the
  // cross-bridge guard checks. No bridge writes happen here.
  const generatedNames = await discoverGeneratedNames(plugin, installable);

  // PI-6 / RN-3: pre-flight cross-bridge conflict guard. Throws
  // CrossPluginConflictError BEFORE any disk write if a generated name
  // is already owned by a different plugin IN THE SAME SCOPE.
  //
  // ENBL-19: check against the state EXCLUDING this plugin's own recorded
  // resources, exactly as `update` and `reinstall` already do -- re-installing
  // your own plugin over your own record must not count as a cross-plugin
  // conflict. Applied unconditionally: a fresh install has no record, so the
  // exclusion is a no-op there; the enable path reaches this call through
  // `runEnableBranch` and a disabled record now RETAINS its inventory
  // (ENBL-18), so without the exclusion every enable of a plugin owning at
  // least one skill, command or agent would self-conflict.
  assertNoCrossPluginConflicts(
    scope,
    generatedNames,
    removePluginRecord(state, marketplace, plugin),
  );

  // PI-7 version precedence. D-54-01 / ENBL-02: `pinVersionOverride` (the
  // enable branch) always wins -- an enable re-materialization reuses the
  // caller-supplied pin verbatim so the recorded `version` survives across a
  // disable/enable cycle.
  //
  // D-77-01 / PURL-09: derive the recorded version (git => sha-<12hex>; path /
  // github-name => the 3-tier ladder). See `deriveInstallVersion`.
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
    discoveryWarnings: [],
    agentForeignFailures: [],
    frontmatterDegradations: [],
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
        // SUB-02: project-scope ${CLAUDE_PROJECT_DIR} resolves to the install cwd.
        cwd: c.cwd,
      });
      c.skillsPrep = prep;
      // Set before commit so undo can remove any dirs that were placed if
      // commit fails mid-loop (partial rename success leaves K orphans).
      c.stagedSkillNames = prep.result.recorded.map((r) => r.generatedName);
      // SKILL-01 / WARN-01: collect per-skill frontmatter degrade records.
      for (const d of prep.result.degraded) {
        c.frontmatterDegradations.push({ kind: "skill", ...d });
      }

      // The skills bridge puts its discovery warnings, and nothing else, on
      // this array (D-141-03).
      c.discoveryWarnings.push(...prep.result.warnings);

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
        // SUB-02: project-scope ${CLAUDE_PROJECT_DIR} resolves to the install cwd.
        cwd: c.cwd,
      });
      c.commandsPrep = prep;
      // Set before commit for the same reason as stagedSkillNames above.
      c.stagedCommandNames = prep.result.recorded.map((r) => r.generatedName);
      // CMD-01 / WARN-01: collect per-command frontmatter degrade records.
      for (const d of prep.result.degraded) {
        c.frontmatterDegradations.push({ kind: "command", ...d });
      }

      // As with skills, this array carries discovery warnings only.
      c.discoveryWarnings.push(...prep.result.warnings);

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
        // SUB-02: project-scope ${CLAUDE_PROJECT_DIR} resolves to the install cwd.
        cwd: c.cwd,
      });
      c.agentsPrep = prep;
      // The agents bridge aggregates THREE kinds on one array: agents-index
      // corruptions, per-agent frontmatter conversion notes, and D-07
      // duplicate-name skips. Only the last is a discovery truncation, and
      // the three are not separable here, so the whole array rides the
      // hygiene channel (D-19-01) rather than the D-141-03 one. Folding it
      // at all is the fix: it used to be dropped outright.
      c.bridgeWarnings.push(...prep.result.warnings);
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
  // Mirrors the post-state-commit `readAndCachePluginHooks` hydrate in
  // `installPlugin`.
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
      // D-100-01 / D-100-02 / ENBL-11: describe the hooks this install
      // materialized. `parsed.value` is already the supported subset, so the
      // projection is byte-parity with the hooks line `info` renders.
      c.hookEntries = projectHookSummaryEntries(parsed.value);
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
        pluginRoot: c.resolved.pluginRoot,
        pluginData: c.pluginDataDir,
        sourcePath: `${c.resolved.pluginRoot}#mcpServers`,
      });
      c.mcpPrep = prep;
      const result = await commitPreparedMcp(prep);
      c.stagedMcpServerNames = result.recorded.map((r) => r.generatedName);
      // MCP staging soft warnings (malformed declared env, non-object entry,
      // malformed pre-existing mcp.json) ride the same bridgeWarnings channel
      // as the other bridges' leak strings instead of being dropped.
      c.bridgeWarnings.push(...result.warnings);
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
        // D-100-01 / ENBL-10: describe the hooks the install materialized, so
        // a later `info` need not read the config back off disk. Omitted when
        // the plugin declares no hooks config -- there is nothing to describe.
        ...(c.hookEntries !== undefined && { hookEntries: [...c.hookEntries] }),
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
 * Drop the hooks parsed-config cache entry for a plugin whose install landed
 * disabled, and rebuild the routing table in lockstep, so the running process
 * cannot dispatch events to a plugin the user's configuration says is
 * disabled. Wrapped in try/catch: the install itself succeeded, so a cache
 * mutation throw must not escalate it into a failure -- the next `/reload`'s
 * factory-time hydrate rebuilds the cache from state.json (D-59-02).
 *
 * Deliberately NOT the disable verb's helper: this file must not import from
 * `enable-disable.ts` (that module already imports `runInstallLedger` from
 * here, so the reverse edge closes a cycle), and the debug message names the
 * install surface so the log says which command left the routing table stale.
 */
function dropInstallDisabledHooks(scope: Scope, marketplace: string, plugin: string): void {
  try {
    removePluginConfigFromCache(scope, marketplace, plugin);
    rebuildRoutingTables();
  } catch (cacheErr) {
    hookDebugLog(
      `install: hooks cache/routing drop failed for install-disabled ${plugin}@${marketplace}: ${errorMessage(cacheErr)} -- this plugin's hooks may keep dispatching in the running process until the next /reload rebuilds the routing table from state.json`,
    );
  }
}

/**
 * DFEN-04 / D-102-01: the disable half of a materialize-then-disable install.
 * Runs INSIDE the caller's `withLockedStateTransaction` closure, after the
 * ledger and before the config write-back, and composes exactly the primitives
 * the `disable` verb composes -- `cascadeUnstagePlugin`, then
 * `applyPartialCascadeFold` on a partial cascade, then `toDisabledRecord` --
 * so the terminal state is byte-identical to an `install` followed by a
 * `disable` by construction rather than by careful re-implementation.
 *
 * It does NOT call `setPluginEnabled`: `proper-lockfile` is `retries: 0` and
 * not re-entrant, so a nested guard on the same scope would self-deadlock.
 *
 * D-102-02: a failed cascade behaves exactly as a failed disable cascade does
 * today -- the dropped artifacts are folded out of the record, `updatedAt`
 * bumps, the hooks cache drops when hooks dropped, and the cause is returned
 * so the caller can SAVE the shrunken record before surfacing the failure. A
 * throw would be wrong: the guard discards a mutated snapshot on throw (ST-7),
 * leaving state.json claiming artifacts the cascade already removed from disk
 * (NFR-3).
 *
 * ENBL-02 / ENBL-18: `toDisabledRecord` is the sole sanctioned producer of the
 * disabled shape, and its `resources: R` passthrough keeps the record's
 * inventory. The map slot is REPLACED rather than mutated in place so the
 * branded return type survives to the assignment.
 */
async function disableFreshlyInstalledPlugin(args: {
  readonly state: ExtensionState;
  readonly scope: Scope;
  readonly locations: ScopedLocations;
  readonly marketplace: string;
  readonly plugin: string;
}): Promise<{ readonly ok: true } | { readonly ok: false; readonly cause: Error }> {
  const { state, scope, locations, marketplace, plugin } = args;
  const target = locateFreshlyInstalledRecord(state, marketplace, plugin);
  if (target === undefined) {
    return {
      ok: false,
      cause: new Error(
        `installPlugin: internal error -- the state phase left no record for plugin "${plugin}" to disable.`,
      ),
    };
  }

  const cascade = await cascadeUnstagePlugin(plugin, marketplace, locations, target.installed);
  if (!cascade.ok) {
    return foldFailedDisableCascade({ ...args, installed: target.installed, cascade });
  }

  target.mp.plugins[plugin] = toDisabledRecord(target.installed, new Date().toISOString());
  dropInstallDisabledHooks(scope, marketplace, plugin);
  return { ok: true };
}

/**
 * Resolve the record the state phase just wrote. Both slots must be present:
 * a marketplace with no plugin entry is the same internal error as no
 * marketplace at all, so the pair is returned together or not at all.
 */
function locateFreshlyInstalledRecord(
  state: ExtensionState,
  marketplace: string,
  plugin: string,
): { readonly mp: MarketplaceStateRecord; readonly installed: InstalledPluginRecord } | undefined {
  const mp = state.marketplaces[marketplace];
  const installed = mp?.plugins[plugin];
  if (mp === undefined || installed === undefined) {
    return undefined;
  }

  return { mp, installed };
}

/**
 * D-102-02: fold a failed cascade into the record and hand the cause back. The
 * record keeps whatever the cascade actually removed so the caller can SAVE the
 * shrunken shape rather than let the guard discard it on a throw (ST-7, NFR-3).
 */
function foldFailedDisableCascade(args: {
  readonly scope: Scope;
  readonly marketplace: string;
  readonly plugin: string;
  readonly installed: InstalledPluginRecord;
  readonly cascade: UnstageOutcome;
}): { readonly ok: false; readonly cause: Error } {
  const { scope, marketplace, plugin, installed, cascade } = args;
  applyPartialCascadeFold(installed, cascade.dropped);
  installed.updatedAt = new Date().toISOString();
  if (cascade.dropped.hooks.length > 0) {
    dropInstallDisabledHooks(scope, marketplace, plugin);
  }

  return {
    ok: false,
    cause: cascade.cause ?? new Error(`Cascade unstage failed for plugin "${plugin}".`),
  };
}

/**
 * DFEN-05: the effective `enabled` declaration for one plugin key, read across
 * BOTH physical config files of the scope.
 *
 * CFG-02 / D-01: a `claude-plugins.local.json` entry REPLACES the same-keyed
 * base entry WHOLESALE and unconditionally. The merge never consults the
 * caller's `--local` flag -- that flag says which file to WRITE, not which file
 * the declaration is IN. Reading only the write target therefore reports
 * `enabled` absent for a locally-declared plugin installed without `--local`,
 * and the precedence gate then installs it disabled against the user's explicit
 * word while stamping an `enabled: false` the user never typed into the OTHER
 * file (the failure `InstallPluginOptions.local`'s own doc comment describes).
 *
 * The local file wins by IDENTITY, not by precedence: whichever of the two
 * paths is `claude-plugins.local.json` answers the key, and the entry is
 * selected before its `enabled` field is read, because a wholesale replacement
 * shadows the base entry's `enabled` too. Both parses arrive from
 * `selectDeclaringConfigWriteTarget`, read fresh INSIDE the caller's lock
 * (WB-01) for this test only -- never written, never serialized back.
 *
 * An UNREADABLE sibling (`sibling === undefined`) contributes nothing, and on
 * the flagless path that costs no signal: the selector aborts when the LOCAL
 * file is unreadable, and when the target IS the local file the key is declared
 * there by construction, so the base file is never the one that answers.
 * A typed `--local` over an unreadable BASE file is the sole arm where an
 * `enabled` value could be missed -- the flag names the destination outright,
 * so no abort is owed there, and the arm reads exactly as it did before the
 * sibling parse was threaded.
 */
type PluginConfigMap = ScopeConfig["plugins"];
type PluginConfigEntry = NonNullable<PluginConfigMap>[string];
type MarketplaceStateRecord = ExtensionState["marketplaces"][string];
type InstalledPluginRecord = MarketplaceStateRecord["plugins"][string];

/**
 * Sort the two parsed configs into the local-then-base pair the identity rule
 * consumes. `targetIsLocal` names which of the two the CALLER is holding, so
 * the sibling takes the other slot.
 */
function declaringPluginMaps(args: {
  readonly current: ScopeConfig;
  readonly sibling: ScopeConfig | undefined;
  readonly targetIsLocal: boolean;
}): { readonly local: PluginConfigMap; readonly base: PluginConfigMap } {
  const siblingPlugins = args.sibling?.plugins;

  return args.targetIsLocal
    ? { local: args.current.plugins, base: siblingPlugins }
    : { local: siblingPlugins, base: args.current.plugins };
}

function entryFor(plugins: PluginConfigMap, key: string): PluginConfigEntry | undefined {
  return plugins?.[key];
}

function readDeclaredEnabled(args: {
  readonly current: ScopeConfig;
  readonly sibling: ScopeConfig | undefined;
  readonly targetIsLocal: boolean;
  readonly key: string;
}): boolean | undefined {
  const { local, base } = declaringPluginMaps(args);

  return (entryFor(local, args.key) ?? entryFor(base, args.key))?.enabled;
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
 * reinstall also call (D-141-05). Only the skills and commands bridges feed
 * that array; the agents bridge mixes three kinds of warning onto one result
 * field and rides the hygiene channel instead.
 */
async function collectPostCommitWarnings(
  installCtx: InstallCtx,
  scope: Scope,
  orchestrated: boolean,
): Promise<string[]> {
  const { locations, marketplace, plugin } = installCtx;
  const warnings: string[] = [];
  // Hygiene warnings only; the standalone drop is D-19-01.
  const push = (msg: string): void => {
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
    await dropMarketplaceCache(await locations.pluginCacheFile(marketplace), scope, marketplace);
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

  return warnings;
}

/**
 * Compose the standalone-mode success row. FSTAT-07 / D-66-04 splits
 * `(installed)` from `(partially-installed)` on the LIVE resolved state of
 * the just-completed install -- not the persisted `compatibility.unsupported`
 * record the `list` / non-path `info` derivers read.
 */
/**
 * WARN-01 / D-86-03: one `{malformed skill}` / `{malformed command}` token per
 * plugin regardless of how many components of that kind degraded. Hoisted out
 * of the row composers so the success row and the DFEN-04 disabled row read
 * the SAME list -- a malformed component is a durable fact about what the
 * plugin will materialize, so both rows owe it to the user; only the row's own
 * status decides which of them is rendered. The free-text parse-error detail
 * rides `postCommitWarnings` (orchestrated only).
 */
function malformedRowReasons(installCtx: InstallCtx): readonly ContentReason[] {
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
function droppedKindRowReasons(installCtx: InstallCtx): readonly ContentReason[] {
  return installCtx.resolved.state === "partially-available"
    ? narrowUnsupportedKinds(installCtx.resolved.unsupported)
    : [];
}

/**
 * OUT-04 / DFEN-04: the install-disabled row. D-102-07 stamps `info` -- the
 * desired state WAS reached, because an install-disabled plugin is the
 * author's declared intent, not a shortfall; severity is the desired-state
 * axis, not a something-is-unusual axis. WARN-01 raises it to `warning` on a
 * frontmatter degrade for the same reason the success row does: a synthesized
 * skill or a neutralized command is a shortfall this ledger run just produced,
 * and the disabled status does not undo it.
 *
 * The reasons brace carries the durable facts alongside the cause, per the
 * governing rule quoted on `PluginDisabledMessage`: render facts that
 * constrain what the user can do next, suppress facts about runtime behavior
 * that is suspended. A dropped component kind and a malformed component are
 * both durable and both constrain the very `enable` this row advertises -- it
 * will produce a degraded install. Only the soft-dep markers belong in the
 * suppressed half, and the `disabled` render arm hard-codes those false
 * (ENBL-15 / D-100-06). In standalone mode `postCommitWarnings` are dropped by
 * D-19-01, so this row is the only surface those facts have.
 *
 * `needsReload: false`: nothing net entered or left Pi's resource view inside
 * the command, since the ledger staged and the cascade unstaged before the
 * process returned. D-102-10's `enableHint` adds the frozen trailer naming the
 * remedy. Row-level `scope` is OMITTED exactly as on the installed row -- the
 * marketplace block carries it. No `dependencies`: the `disabled` arm has none
 * by construction.
 */
function composeDisabledRow(installCtx: InstallCtx): InstallMsg {
  return {
    status: "disabled",
    name: installCtx.plugin,
    version: installCtx.version,
    // The author-declared cause leads: it is why the row exists at all.
    reasons: [
      "installs disabled",
      ...malformedRowReasons(installCtx),
      ...droppedKindRowReasons(installCtx),
    ],
    severity: installCtx.frontmatterDegradations.length > 0 ? "warning" : "info",
    needsReload: false,
    enableHint: true,
  };
}

function composeInstalledRow(installCtx: InstallCtx, pi: ExtensionAPI): InstallMsg {
  const { plugin } = installCtx;
  const declaresAgents = installCtx.stagedAgentNames.length > 0;
  const declaresMcp = installCtx.stagedMcpServerNames.length > 0;

  // The renderer emits the per-row soft-dep markers (`{requires
  // pi-subagents}`, `{requires pi-mcp}`) from this list automatically.
  const dependencies: Dependency[] = [];
  if (declaresAgents) {
    dependencies.push("agents");
  }

  if (declaresMcp) {
    dependencies.push("mcp");
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
      : companionSeverity({ declaresAgents, declaresMcp }, softDepStatus(pi));

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
 * The orchestrated-caller outcome for a completed install. Every optional
 * field is omitted rather than emitted false/empty per NREG-01.
 */
function buildInstalledOutcome(
  installCtx: InstallCtx,
  postCommitWarnings: readonly string[],
  /** DFEN-04: true when the DFEN-04 cascade unstaged everything the ledger staged. */
  landedDisabled: boolean,
): InstallPluginOutcome {
  // PI-9 corollary: `resourcesChanged` is consumed by import/execute.ts as a
  // structural predicate, so it tracks whether ANY phase staged something.
  const stagedAny =
    installCtx.stagedSkillNames.length > 0 ||
    installCtx.stagedCommandNames.length > 0 ||
    installCtx.stagedAgentNames.length > 0 ||
    installCtx.stagedMcpServerNames.length > 0;
  // WARN-01 / D-86-03: degraded kinds in collection order (skill before
  // command), deduplicated.
  const degradedKinds = Array.from(new Set(installCtx.frontmatterDegradations.map((d) => d.kind)));

  return {
    status: "installed",
    version: installCtx.version,
    // DFEN-04: the ledger DID stage on the install-disabled path, but the
    // cascade removed every artifact before the command returned, so the net
    // Pi-visible resource delta is zero. `import/execute.ts` consumes this as a
    // structural predicate and would otherwise claim a change that did not
    // survive. `declaresAgents` / `declaresMcp` stay truthful: they are
    // DECLARATION predicates, and a disabled plugin still declares.
    resourcesChanged: !landedDisabled && stagedAny,
    declaresAgents: installCtx.stagedAgentNames.length > 0,
    declaresMcp: installCtx.stagedMcpServerNames.length > 0,
    ...(landedDisabled && { landedDisabled: true as const }),
    ...(postCommitWarnings.length > 0 && { postCommitWarnings: [...postCommitWarnings] }),
    // WR-03: the LIVE dropped-component kinds. An install admitted through
    // the partial gate materializes a degraded plugin, so an outcome that
    // stayed silent would hand an orchestrated caller the facts for a bare
    // `(installed)` row over a record whose `list` row reads
    // `(partially-installed)`.
    ...(installCtx.resolved.state === "partially-available" && {
      unsupported: [...installCtx.resolved.unsupported],
    }),
    // SURF-05 / D-63-08 / IN-07: the same orphan-rewake fact the standalone
    // row reports, carried so the orchestrated projection can name it too.
    ...(installCtx.resolved.orphanRewake === true && { orphanRewake: true }),
    ...(degradedKinds.length > 0 && { degradedKinds }),
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
  readonly ctx: ExtensionContext;
  readonly pi: ExtensionAPI;
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

  notifyWithContext(ctx, pi, INSTALL_CONTEXT, [
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
  ]);
  return { status: "failed", error, cause };
}

/**
 * D-19-03 failure routing for a throw out of the state guard. Priority,
 * highest first:
 *
 *   1. PI-14 PathContainmentError -- bare PluginFailedMessage with
 *      reasons: [] and cause: err. The renderer surfaces the message via
 *      the 4-space-indent cause-chain trailer; NO rollback-partial
 *      children even when partials are present (PI-14 bypass).
 *   2. Rollback-partial -- PluginFailedMessage with reasons:
 *      ["rollback partial"] plus the phase-ledger's typed
 *      `RollbackPartial[]` threaded directly (no synthesis from `.msg`).
 *   3. Entity-shape errors (PI-3 / PI-4 / PI-5) -- the classifier's
 *      `status: "failed" | "unavailable"` discriminator is preserved
 *      verbatim.
 *   4. Generic runtime error -- reasons: [] and cause: err; the renderer
 *      suppresses the empty brace per D-15-01.
 */
function handleInstallThrow(args: {
  readonly err: unknown;
  readonly ctx: ExtensionContext;
  readonly pi: ExtensionAPI;
  readonly marketplace: string;
  readonly scope: Scope;
  readonly plugin: string;
  readonly capture: InstallFailureCapture;
  readonly orchestrated: boolean;
}): InstallPluginOutcome {
  const { err, ctx, pi, marketplace, scope, plugin, capture, orchestrated } = args;
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

  if (orchestrated) {
    // The typed Error remains the dispatch surface; `cause` is the formatted
    // text for callers that render it directly.
    return classifyInstallFailure(err, formatOrchestratedCause(err));
  }

  notifyWithContext(ctx, pi, INSTALL_CONTEXT, [
    {
      name: marketplace,
      scope,
      plugins: [failureMessage],
    },
  ]);
  const wrapped = err instanceof Error ? err : new Error(errorMessage(err));
  return { status: "failed", error: wrapped, cause: formatOrchestratedCause(err) };
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
// Install sequencing walks the PI-1..15 flow: the state guard, the ledger
// call, failure routing, and post-commit/notification composition. The
// order of those steps stays visible here; the step bodies themselves are
// extracted above (`buildInstallLedgerOptions`, `collectPostCommitWarnings`,
// `composeInstalledRow`, `buildInstalledOutcome`, `handleInstallThrow`).
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
  // `deriveInstallVersion`).
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
  // DFEN-04 / D-102-01: the install-disabled verdict and, on D-102-02's failure
  // window, the disable cascade's cause. Both are decided inside the lock --
  // the config precedence read and the resolved `defaultEnabled` are only
  // legible there -- and read by the post-guard row / outcome composition.
  // Carried on an object rather than two bare `let`s so the guard closure's
  // writes stay visible to the post-guard reads without a narrowing override at
  // every site.
  const disabledInstall: { landed: boolean; cascadeError?: Error } = { landed: false };

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
      // D-103-16: ONE selection, made before anything reads a config path, so
      // the CFG-03 load, the DFEN-05 precedence read and BOTH write arms below
      // address the same physical file. It runs inside the lock because it
      // READS the local config -- the WB-01 discipline that sibling reads
      // happen fresh under the lock the write also holds.
      //
      // `targetIsLocal` comes back from the selector rather than being
      // re-derived here: `readDeclaredEnabled` picks the effective ENTRY by
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
        key: `${plugin}@${marketplace}`,
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
        configInvalid = true;
        return;
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

      // The guard-free BODY, not the public `runInstallLedger`: this closure
      // already holds the scope lock, and the post-guard path below reads
      // context fields the outward summary withholds.
      const result = await runInstallLedgerBody(
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
      const declaredEnabled = readDeclaredEnabled({
        current,
        sibling,
        targetIsLocal,
        key: `${plugin}@${marketplace}`,
      });
      disabledInstall.landed =
        opts.applyDefaultEnabled === true &&
        declaredEnabled === undefined &&
        !result.installCtx.resolved.defaultEnabled;

      if (disabledInstall.landed) {
        // D-102-01: the six-phase ledger already ran and the state phase wrote
        // `enabled: true`; the disable half runs here, after `runPhases` and
        // before the write-back, and overwrites that value. No seventh phase,
        // no edit to any of the six phase bodies.
        const disableResult = await disableFreshlyInstalledPlugin({
          state,
          scope,
          locations,
          marketplace,
          plugin,
        });
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
          disabledInstall.cascadeError = disableResult.cause;
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
          //
          // S4 (PR #51, CONTEXT.md S4): the helper's `adoptedSource === undefined`
          // arms collapse -- benign (already declared) and dangerous (no string
          // `source.raw` to synthesize from). This site therefore still writes a
          // dangling declaration in the dangerous arm; acknowledged trade-off
          // pending a widen of the helper's return that would route it to a
          // (failed) row.
          pluginPatch: { ...(disabledInstall.landed && { enabled: false }) },
        });
      } else if (disabledInstall.landed) {
        // DFEN-04 / D-102-04: the orchestrated-mode stamp. An orchestrated
        // caller skips the batched write-back above (WR-09), so without this
        // the record lands disabled while the entry the reconcile planner reads
        // still says nothing about enablement -- the next reload reads
        // absent-as-enabled (D-04), finds the record disabled, and plans an
        // enable, re-enabling a plugin whose author declared it off.
        //
        // The condition is the landed-disabled verdict and nothing else. That
        // verdict already required the caller's opt-in (so `import` never
        // reaches here, D-102-03) and an ABSENT `enabled` key (so a value the
        // user wrote is never rewritten, D-102-04). Re-testing either here
        // would be a second, drift-prone copy of the same gate.
        //
        // SPLIT-02 / D-102-09: the sole sanctioned single-entry writer, whose
        // patch is spread over the existing entry -- so the one field carried
        // here disturbs no forward-compat key (D-09) and no sibling entry. It
        // writes `targetConfigPath`, which for reconcile is the file the
        // declaration lives in (see `InstallPluginOptions.local`).
        //
        // WR-09 is NOT widened. The guard above keeps its exact condition, and
        // this arm writes ONE field of ONE entry instead of the full write-back
        // an orchestrated caller must never run. It is an `else` arm rather
        // than a second `if` on the same condition purely to stay under the
        // closure's cognitive-complexity budget; the two are equivalent.
        await writePluginConfigEntry(
          current,
          targetConfigPath,
          locations.scopeRoot,
          plugin,
          marketplace,
          { enabled: false },
        );
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
      //
      // DFEN-04: SKIPPED entirely when the install landed disabled. The disable
      // cascade above has just removed the on-disk hooks.json, so this block
      // would either re-read a deleted file or -- worse -- register routing
      // entries for a plugin the user's configuration says is disabled, giving
      // live hook dispatch against disabled code that nothing short of the next
      // hydrate would clear. `disableFreshlyInstalledPlugin` already dropped
      // the cache entry, which is the correct mutation on that path.
      if (!disabledInstall.landed && installCtx.resolved.hooksConfigPath !== undefined) {
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
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- mutated inside the withLockedStateTransaction closure above.
  if (configInvalid) {
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
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- `marketplaceAbsent` is mutated inside the withLockedStateTransaction closure above; TS flow analysis cannot prove the closure executed, so it sees the variable as still `false`. The check is required at runtime.
  if (marketplaceAbsent) {
    const cause = `Marketplace "${marketplace}" is not added in the ${scope} scope.`;
    if (opts.notifications?.mode === "orchestrated") {
      return { status: "failed", error: new Error(cause), cause };
    }

    // CMP-4 / SCOPE-01: a bare `{marketplace not added}` row is not actionable when the
    // container lives in the OTHER scope -- the repo-bundled-marketplace case,
    // where a default-scope (user) install misses a project-only container. One
    // read-only probe of that scope decides which structural token the brace
    // carries. The probe never throws and never blocks the row (see
    // `marketplaceInOtherScope`); a `false` answer renders the plain
    // `{marketplace not added}` row byte-identically to before.
    notify(ctx, pi, {
      kind: "marketplace-not-added",
      name: marketplace,
      scope,
      ...(await crossScopeFlag({ cwd, marketplace, scope })),
    });
    return { status: "failed", error: new Error(cause), cause };
  }

  // D-102-02: the ledger succeeded and the disable cascade then failed. The
  // shrunken record was already saved inside the lock, so state.json describes
  // what is still on disk. Surface the EXISTING install failure row carrying
  // the cascade's own cause -- no new failure semantics, no new rollback
  // composition, and no new reason token. The record stays `enabled: true` with
  // a shrunken inventory, which is exactly what an install followed by a failed
  // disable produces, and the config entry the write-back arms just stamped
  // says `enabled: false` -- the divergence a later reconcile pass closes by
  // planning the disable this one could not finish.
  const cascadeError = disabledInstall.cascadeError;
  if (cascadeError !== undefined) {
    const cause = errorMessage(cascadeError);
    if (orchestrated) {
      return { status: "failed", error: cascadeError, cause };
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
            reasons: [] as const,
            cause: cascadeError,
          },
        ],
      },
    ]);
    return { status: "failed", error: cascadeError, cause };
  }

  // Defensive: the success path always populates installCtx; if it did not,
  // surface the inconsistency rather than silently emit a missing message.
  if (installCtx === undefined) {
    // Defensive arm: `reasons: []` because no closed-set Reason classifies
    // an internal invariant violation. The renderer suppresses the empty
    // brace per D-15-01 and surfaces the cause via the indent trailer.
    return failedRowOutcome({
      ctx,
      pi,
      marketplace,
      scope,
      plugin,
      error: new Error(
        `installPlugin: internal error -- guard returned cleanly without populating install context for plugin "${plugin}".`,
      ),
      reasons: [],
      orchestrated,
    });
  }

  const postCommitWarnings = await collectPostCommitWarnings(installCtx, scope, orchestrated);

  if (!orchestrated) {
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
    notifyWithContext(ctx, pi, INSTALL_CONTEXT, [
      {
        name: marketplace,
        scope,
        plugins: [
          disabledInstall.landed
            ? composeDisabledRow(installCtx)
            : composeInstalledRow(installCtx, pi),
        ],
      },
    ]);
    surfaceDiscoveryWarnings(ctx, {
      plugin,
      verb: "installed",
      warnings: postCommitWarnings,
    });
  }

  return buildInstalledOutcome(installCtx, postCommitWarnings, disabledInstall.landed);
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
 * Test seam for the catch-site dispatch helpers. Helpers stay private to
 * the orchestrator; tests exercise the `instanceof PluginShapeError` +
 * `.kind` dispatch branches directly via this re-export.
 */

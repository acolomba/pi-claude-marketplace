// orchestrators/plugin/install-outcome.ts
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
//       PI-7:                deriveInstallVersion -- pin override, then
//                            `shared.ts::resolvePluginVersion` (plugin.json >
//                            entry.version > git sha > hash, VER-01)
//       runPhases(phases, ctx)                             // D-01 8-phase ledger
//       format rollback result, capture rows, throw error  // D-02 PI-14 bypass
//   })
//
// CR-01: the ledger body is retained behind exported `runInstallLedger` so
// `setPluginEnabled`'s enable branch can run
// it inside ITS OWN `withLockedStateTransaction` -- `proper-lockfile`
// (`retries: 0`) is not re-entrant, so nesting `installPlugin`'s guard under
// another guard on the same `stateLockFile` self-deadlocks. That public owner
// returns the outward install-ledger summary; `installPlugin` drives the
// same body directly because its own post-commit composition reads the working
// `InstallLedgerContext` the summary deliberately withholds.
//   POST-state-commit (D-08 / AS-6):  mkdir(pluginDataDir), dropped per D-19-01
//   Success notify via notify() with PluginInstalledMessage carrying
//   dependencies: readonly Dependency[] derived from staged content; the
//  renderer reads the run's one soft-dependency snapshot (D-05)
//   and emits per-row soft-dep markers + the reload-hint trailer
//  structurally.
//   Failure routes through one notify() call with PluginFailedMessage
//   carrying optional cause + optional rollbackPartial[]; the renderer
//  composes the depth-5 cause-chain and per-phase rollback child
//   rows automatically.
//
// Standalone-mode emission is a single notify(ctx, run, { marketplaces:
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
// NFR-5 / PI-2 architectural guard: the install reaches git through
// `clone-cache.ts` for a git-source plugin, and through the `marketplace add`
// body for a marketplace its target scope does not record yet (D-MF-04). This
// owner itself MUST NOT import platform-git or the default git ops, and MUST
// NOT carry a gitOps field: the add functions default their own git
// operations. BLOCK F in `eslint.config.js` lints this file's code for that
// surface, so a comment may still name it.
//
// D-v1.0-01-11 import boundaries: orchestrators/plugin/ may import from bridges/,
// domain/, transaction/, persistence/, shared/, AND from
// orchestrators/marketplace/shared.ts. This module is the lock-free ledger
// body, not a plugin ledger, so it also imports the `marketplace add`
// functions, as `bootstrap.ts` imports the add; the plugin ledgers do not.
// User-visible output flows through shared/notification-dispatch.ts; this file
// holds no rendering imports.

import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

import {
  assertAgentTargetsFree,
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
import { removeHookConfig, writeHookConfig } from "../../bridges/hooks/index.ts";
import {
  prepareStageMcpServers,
  replacePreparedMcp,
  rollbackMcpReplacement,
} from "../../bridges/mcp/index.ts";
import {
  commitPreparedSkills,
  prepareStageSkills,
  unstagePluginSkills,
} from "../../bridges/skills/index.ts";
import {
  commitPreparedWorkflows,
  prepareStageWorkflows,
  unstagePluginWorkflows,
} from "../../bridges/workflows/index.ts";
import { parseHooksConfig, projectHookSummaryEntries } from "../../domain/components/hooks.ts";
import {
  MAX_DIRECTORY_PIN_FIELD_CHARS,
  recordedVersionSatisfies,
  truncateForRefusal,
} from "../../domain/dependency-range.ts";
import { sourceManifestBoundary } from "../../domain/manifest-containment.ts";
import { loadMarketplaceManifest } from "../../domain/manifest.ts";
import {
  requirePartialInstallable,
  requireInstallable,
  resolveStrict,
} from "../../domain/plugin-resolver.ts";
import { parsePluginSource, type ParsedSource, type PathSource } from "../../domain/source.ts";
import {
  ConcurrentInstallError,
  DirectoryPinUnsatisfiedError,
  errorMessage,
  errorWithManualRecovery,
  InstallMarketplaceAddError,
  InvalidMarketplaceManifestError,
  ManualRecoveryError,
  PluginShapeError,
} from "../../shared/errors.ts";
import { pathExists, type RemovalOps } from "../../shared/fs-utils.ts";
import { type DegradeKind } from "../../shared/notify-reasons.ts";
import { ownValue, setOwn } from "../../shared/own-key.ts";
import { PathContainmentError } from "../../shared/path-safety.ts";
import { redactAbsolutePaths } from "../../shared/redact-absolute-paths.ts";
import {
  runPhases,
  type Phase,
  type RollbackPartial,
  type RunPhasesResult,
} from "../../transaction/phase-ledger.ts";
import { formatRollbackError } from "../../transaction/rollback.ts";
import {
  DEFAULT_CREDENTIAL_OPS,
  type AuthAttemptResult,
  type CredentialOps,
  type DeviceFlowHttp,
} from "../auth-host.ts";
import {
  addMarketplaceToState,
  classifyAddError,
  parseAddableSource,
  settleAddedMarketplace,
} from "../marketplace/add.ts";
import { WorkflowsUnstageFailureError } from "../marketplace/shared.ts";

import { materializeMarketplaceTagClone } from "./clone-cache.ts";
import { discoverGeneratedNames } from "./discover-names.ts";
import { probeInstallClone, type InstallCloneCacheSeam } from "./install-clone-probe.ts";
import {
  createPackagesPhase,
  DEFAULT_PACKAGE_INSTALL_OPS,
  type PackageInstallOps,
} from "./package-install.ts";
import {
  assertNoCrossPluginConflicts,
  readDeclaredPluginVersion,
  removePluginRecord,
  resolveInstallMarketplaceSource,
  resolvePluginVersion,
  resolveTagPinnedPluginVersion,
  type LedgerDegradationSignals,
} from "./shared.ts";

import type { PreparedAgentsStaging } from "../../bridges/agents/index.ts";
import type { PreparedCommandsStaging } from "../../bridges/commands/index.ts";
import type { McpReplacement } from "../../bridges/mcp/index.ts";
import type { PreparedSkillsStaging } from "../../bridges/skills/index.ts";
import type { PreparedWorkflowsStaging } from "../../bridges/workflows/index.ts";
import type { ClaudeEnv } from "../../domain/claude-mcp-variables.ts";
import type { PluginEntry } from "../../domain/components/plugin.ts";
import type { ManifestBoundary } from "../../domain/manifest-containment.ts";
import type { MarketplaceManifest } from "../../domain/manifest.ts";
import type { MaterializablePlugin, ResolveContext } from "../../domain/resolver-types.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { ExtensionState, PluginInstallRecord } from "../../persistence/state-io.ts";
import type { NotificationContext } from "../../platform/pi-api.ts";
import type { HookSummaryEntry } from "../../shared/concerns/hooks.ts";
import type { NotificationRun } from "../../shared/notification-run.ts";
import type { McpConfigNotice } from "../../shared/notification-types.ts";
import type { Scope } from "../../shared/types.ts";
import type { InstallPluginOutcome } from "../types.ts";

/** Controls how install orchestration surfaces notifications. */
export type InstallPluginNotifications =
  { readonly mode: "standalone" } | { readonly mode: "orchestrated" };

/**
 * GV-01: the range the listed copy of a plugin of Claude Code's plugin
 * directory must satisfy, which picks no release tag, and what a refusal
 * names: the declared ranges and the `name@marketplace` keys of the plugins
 * that asked for one.
 */
export interface DirectoryPinRange {
  readonly range: string;
  readonly declared: string;
  readonly requiredBy: readonly string[];
}

/** Inputs consumed by the guard-free install ledger. */
export interface InstallLedgerOptions {
  /** Context used only by the clone probe's authentication notification seam. */
  readonly ctx: NotificationContext;
  readonly run: NotificationRun;
  readonly scope: Scope;
  readonly cwd: string;
  readonly marketplace: string;
  readonly plugin: string;
  readonly mapModel?: boolean;
  readonly partial?: boolean;
  readonly pinVersionOverride?: string;
  /**
   * RESV-03: the commit a constrained dependency's release tag resolved to.
   *
   * When set, the git-source resolve callback materializes THIS object id
   * instead of whatever ref the marketplace entry names, which is what makes a
   * version constraint SELECT a version rather than merely veto one. Only the
   * install cascade sets it, only for a member whose accumulated constraint was
   * a real range, and only ever to an id read off that source's own release
   * tags -- the entry still decides which repository is read.
   */
  readonly sourcePinOverride?: string;
  /** GV-01: the range a plugin directory member's listed copy must satisfy. */
  readonly directoryPin?: DirectoryPinRange;
  /**
   * GV-01: the semver of the release tag a dependency's version range
   * selected, which the record keeps as `resolvedVersion` and dependency
   * ranges read. With `sourcePinOverride` at that tag's commit, the recorded
   * version carries the commit (`resolveTagPinnedPluginVersion`). A caller
   * re-materializing a kept record passes the record's own value back.
   */
  readonly resolvedVersion?: string;
  /**
   * D-04-01: how THIS member got here -- `"explicit"` for the plugin the user
   * named, `"dependency"` for a member its closure pulled in. The install
   * cascade decides it per member; a caller that omits it (the enable branch,
   * which re-materializes a KEPT record) leaves the recorded value in place.
   */
  readonly provenance?: PluginInstallRecord["provenance"];
  readonly allowExistingRecord?: boolean;
  readonly cloneCacheSeam?: InstallCloneCacheSeam;
  readonly cloneProbe?: typeof probeInstallClone;
  /**
   * D-07-06: materializes a `path` source at `sourcePinOverride`'s tag oid.
   * Mirrors `cloneProbe` exactly -- a real default
   * (`materializeMarketplaceTagClone`), not test-only surface.
   */
  readonly pathPinProbe?: typeof materializeMarketplaceTagClone;
  /**
   * D-08-12: removal operations the three bridge phases perform their staging
   * cleanup through. Required with no default, and deliberately NOT constructed
   * here: `install-flow.ts` and `enable-disable.ts` are the composition roots
   * above these options, which is what lets a caller of `runInstallLedger` fault
   * one phase's cleanup and observe the leak the commit path returns.
   */
  readonly removalOps: RemovalOps;
  /**
   * D-08-06 / AVAR-02: the environment Claude's variable rule reads when the
   * mcp phase stages servers. The operation's entry point binds it.
   */
  readonly env: ClaudeEnv;
  readonly credentialOps?: CredentialOps;
  readonly deviceFlowHttp?: DeviceFlowHttp;
  readonly authMemo?: Map<string, AuthAttemptResult>;
  /**
   * LAYER-07 / D-MF-04: adds a marketplace the target scope does not record
   * yet, through the `marketplace add` code. Mirrors `cloneProbe`: a real
   * default (`addMarketplaceToState` and `settleAddedMarketplace`), not
   * test-only surface.
   */
  readonly marketplaceAdd?: {
    readonly record: typeof addMarketplaceToState;
    readonly settle: typeof settleAddedMarketplace;
  };
  /**
   * WR-07: the transaction's list of the marketplaces its adds recorded, each
   * with the raw source it was added from and the clone directory a github or
   * url add created. The lock owner owns the list: it removes the clones when
   * its transaction does not save, and settles each marketplace after a save.
   * The enable path passes none.
   */
  readonly addedMarketplaces?: {
    readonly marketplace: string;
    readonly rawSource: string;
    readonly cloneDir: string | undefined;
  }[];
}

/** Transaction operation required by the guard-free ledger. */
export interface InstallLedgerTransaction {
  readonly runPhases: typeof runPhases;
  /** D-PL9-12: the package step's ports; absent, the real package manager runs. */
  readonly packageInstallOps?: PackageInstallOps;
}

/** Failure details captured before a formatted ledger error is rethrown. */
export interface InstallFailureCapture {
  rollbackPartials: readonly RollbackPartial[];
  version: string | undefined;
}

// SKILL-01 / CMD-01 / WARN-01: one frontmatter-parse degrade record. Shared by
// `InstallLedgerSummary` and `InstallLedgerContext` (one declaration, not two
// structurally-identical ones) so a read against either side's array resolves
// to the same member.
export interface FrontmatterDegradationRow {
  kind: DegradeKind;
  generatedName: string;
  parseError: string;
}

// AS-7 / W-08 / B-08: one agents-bridge foreign-content row preserved on disk
// during prepare. Shared with `InstallLedgerContext` for the same reason as
// `FrontmatterDegradationRow`.
export interface AgentForeignFailureRow {
  generatedName: string;
  reason: string;
}

/** Readonly facts exposed after a completed ledger run. */
export interface InstallLedgerSummary {
  readonly locations: ScopedLocations;
  readonly cwd: string;
  readonly marketplace: string;
  readonly plugin: string;
  readonly resolved: MaterializablePlugin;
  readonly version: string;
  readonly pluginDataDir: string;
  readonly frontmatterDegradations: readonly FrontmatterDegradationRow[];
  readonly stagedSkillNames: readonly string[];
  readonly stagedCommandNames: readonly string[];
  readonly stagedAgentNames: readonly string[];
  readonly stagedMcpServerNames: readonly string[];
  /**
   * WLIF-05 / WLIF-06: the workflow envelope names this materialization
   * actually placed, exactly as the commit reported them through `onPlaced`.
   *
   * Read for its MEMBERSHIP, not for its length -- which is what separates it
   * from the two lists above. Those two answer a declaration question (did the
   * run stage any agent / any MCP server), so a count suffices and the names
   * must never reach a rendered row. This one is differenced against the
   * caller's PRE-materialization record inventory: the recorded names this run
   * did not re-place are the workflow commands the operation retired while the
   * host still has them registered. Reducing it to a boolean here would
   * destroy that fact, and no other surface carries it -- by the time the
   * ledger returns, the record it wrote already holds the NEW inventory and so
   * cannot answer what the old one held.
   *
   * Required rather than optional, for the reason the context member it
   * projects is required: a producer that could omit the axis could report a
   * materialization as having placed nothing.
   */
  readonly stagedWorkflowNames: readonly string[];
  readonly bridgeWarnings: readonly string[];
  readonly discoveryWarnings: readonly string[];
  readonly agentForeignFailures: readonly AgentForeignFailureRow[];
  /**
   * AFILE-04 / AFILE-02: the MCP config file facts the mcp phase reported,
   * for the caller to route to `notifyMcpConfigNotices` after its own row.
   */
  readonly mcpConfigNotices: readonly McpConfigNotice[];
}

/** Caller-facing result of the guard-free install ledger. */
export type InstallLedgerResult =
  | { readonly kind: "installed"; readonly summary: InstallLedgerSummary }
  | { readonly kind: "marketplace-absent" };

/**
 * Local context type for the 8-phase ledger. Carries every value the
 * phases read or mutate. Per D-01 corollary "second-consumer rule" this
 * shape is NOT promoted to `orchestrators/types.ts` until/unless another
 * orchestrator needs it.
 *
 * This is the transaction's mutable scratchpad: bridge prep handles, the
 * hooks-write flag, and a live reference to the caller's state snapshot. Its
 * shape exists only so this owner can project the readonly public result;
 * orchestration callers consume that result instead.
 */
interface InstallLedgerContext {
  readonly locations: ScopedLocations;
  readonly cwd: string;
  readonly marketplace: string;
  readonly plugin: string;
  // NFR-7 / D-65-03: widened to the materializable union so the
  // `partially-available` arm (admitted under --partial) flows through the same
  // materialize phases. Excludes `unavailable` (no pluginRoot).
  readonly resolved: MaterializablePlugin;
  /** Exact ordered directory list used by both conflict preview and agent staging. */
  readonly agentsDirs: readonly string[];
  readonly version: string;
  // D-77-02 / PURL-09: the full 40-hex resolved commit sha for git-source
  // installs, captured by the clone-materializing resolve callback (the
  // resolver's ResolvedPlugin schema cannot carry it, so it flows through this
  // side-channel into the state record). Undefined for path/non-git sources.
  readonly resolvedSha?: string;
  /** GV-01: the release tag's semver, when a dependency's range selected one. */
  readonly resolvedVersion?: string;
  readonly pluginDataDir: string;
  // Prep handles populated by each phase.do before that phase's commit.
  // Each phase.undo reads the matching handle to call the bridge unstage*
  // primitive. The matching handle is undefined when the phase did not run.
  skillsPrep?: PreparedSkillsStaging;
  commandsPrep?: PreparedCommandsStaging;
  agentsPrep?: PreparedAgentsStaging;
  // AFILE-04 / NFR-3: the mcp phase holds a replacement handle rather than a
  // prep handle, so its undo restores the file's prior bytes.
  mcpReplacement?: McpReplacement;
  workflowsPrep?: PreparedWorkflowsStaging;
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
  // WLIF-01: the envelope names the workflows commit reported through its
  // `onPlaced` callback. Required rather than optional so the state phase's
  // record composition cannot forget the axis.
  stagedWorkflowNames: readonly string[];
  // Aggregated soft warnings from the bridges (e.g. agents bridge cleanup leaks).
  bridgeWarnings: string[];
  // D-07 discovery warnings from the skills, commands and workflows bridges.
  // Each names ONE declared component and what became of it: either an
  // artifact the plugin author shipped that this install did not materialize
  // (a duplicate generated name, an unreadable subdirectory, a source path
  // that produces no valid name), or -- WGATE-01 -- one it DID materialize
  // with a caveat, such as a workflow script the host engine will refuse to
  // load. The second half is why the rendered header claims no disposal.
  //
  // The agents bridge is not a feeder: it mixes three kinds of warning onto
  // one result field and rides `bridgeWarnings` instead. Kept apart from that
  // array because D-19-01 as amended surfaces these in standalone mode and
  // the hygiene warnings beside them stay suppressed.
  discoveryWarnings: string[];
  // Bridge-side per-record AG-5 foreign-content rows -- routed to notifyWarning post-success.
  agentForeignFailures: AgentForeignFailureRow[];
  // AFILE-04 / AFILE-02: MCP config file facts from the mcp phase.
  mcpConfigNotices: McpConfigNotice[];
  // SKILL-01 / CMD-01 / WARN-01: per-component frontmatter-parse degrade records
  // collected from the skills + commands bridges. Feed the one-per-plugin
  // `{malformed skill}` / `{malformed command}` reason token (standalone row),
  // the per-component parse-error detail (orchestrated postCommitWarnings), and
  // the `degradedKinds` outcome seam the reconcile composer consumes.
  frontmatterDegradations: FrontmatterDegradationRow[];
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
async function loadCachedMarketplaceManifest(manifestPath: string): Promise<MarketplaceManifest> {
  return loadMarketplaceManifest(manifestPath);
}

/**
 * The discriminated result carrying the ledger's working context. The
 * install-outcome owner immediately projects it to a readonly summary.
 */
type InstallLedgerContextResult =
  | { readonly kind: "installed"; readonly installCtx: InstallLedgerContext }
  | { readonly kind: "marketplace-absent" };

/**
 * PI-7 / PURL-09 / VER-01: derive the recorded plugin version.
 *
 * Precedence:
 *   1. `pinVersionOverride` (D-54-01 / ENBL-02): an enable re-materialization
 *      reuses the caller-supplied pin verbatim so the recorded `version`
 *      survives across a disable/enable cycle.
 *   2. GV-01: at the release tag a dependency's range selected, the version
 *      Claude Code records there, which carries the tag's commit.
 *   3. otherwise `resolvePluginVersion`: the declared version (plugin.json,
 *      then the marketplace entry, with GV-01's directory pin), then the
 *      commit for a git source (url / git-subdir / github) whose clone probe
 *      captured it, spelled as `shaVersion` spells it (GV-01), then the
 *      content hash (D-16-08). The full sha is recorded apart (D-77-02).
 */
async function deriveInstallVersion(args: {
  entry: PluginEntry;
  installable: MaterializablePlugin;
  marketplace: Pick<ResolveContext, "marketplaceName" | "marketplaceRoot">;
  resolvedSha: string | undefined;
  pinVersionOverride: string | undefined;
  resolvedVersion: string | undefined;
}): Promise<string> {
  if (args.pinVersionOverride !== undefined) {
    return args.pinVersionOverride;
  }

  if (args.resolvedVersion !== undefined && args.resolvedSha !== undefined) {
    return resolveTagPinnedPluginVersion(
      args.entry,
      args.installable,
      args.marketplace.marketplaceName,
      args.resolvedSha,
    );
  }

  const kind = parsePluginSource(args.entry.source).kind;
  const isGitSource = kind === "url" || kind === "git-subdir" || kind === "github";
  return resolvePluginVersion(
    args.entry,
    args.installable,
    args.marketplace,
    isGitSource ? args.resolvedSha : undefined,
  );
}

/** The real `marketplaceAdd` seam: the `marketplace add` body and settle. */
export const DEFAULT_MARKETPLACE_ADD = Object.freeze({
  record: addMarketplaceToState,
  settle: settleAddedMarketplace,
});

/** One marketplace record of a scope's state. */
type MarketplaceRecord = ExtensionState["marketplaces"][string];

/** The ledger options the target-scope add reads. */
export type TargetScopeAddOptions = Pick<
  InstallLedgerOptions,
  | "ctx"
  | "run"
  | "scope"
  | "cwd"
  | "removalOps"
  | "credentialOps"
  | "deviceFlowHttp"
  | "authMemo"
  | "marketplaceAdd"
  | "addedMarketplaces"
>;

/**
 * WR-04: runs the add body and, when it fails the way `marketplace add`
 * classifies, rethrows the failure with that reason and a path-free message,
 * so the install row reads as the explicit add's row does. An authentication
 * challenge keeps its own error: the install row already maps it to
 * `{authentication required}` with no cause line (D-79-03). An unclassified
 * error, such as an invalid GitHub base override (GHB-03), propagates as is.
 */
async function recordAsInstallFailure(
  record: typeof addMarketplaceToState,
  args: Parameters<typeof addMarketplaceToState>[0],
): Promise<Awaited<ReturnType<typeof addMarketplaceToState>>> {
  try {
    return await record(args);
  } catch (err: unknown) {
    const reason = classifyAddError(err);
    if (reason === undefined || reason === "authentication required") {
      throw err;
    }

    throw new InstallMarketplaceAddError(reason, redactAbsolutePaths(errorMessage(err)));
  }
}

/**
 * LAYER-07 / D-MF-04 / CMP-3: the target scope records no `marketplace`, and
 * the user scope does. The install adds the marketplace to the target scope
 * from the user record's raw source, through the code `marketplace add
 * --scope project` runs, inside the caller's lock: the target scope gets its
 * own record and, for a github or url source, its own clone (NFR-5 as amended
 * by D-MF-04). A relative raw source resolves from the process directory, as
 * the add resolves it.
 *
 * The added marketplace joins `addedMarketplaces` before the name check, so
 * the lock owner removes its clone when the install does not save (WR-07). A
 * source that now declares another name fails the install before any phase.
 */
async function addTargetScopeMarketplace(
  state: ExtensionState,
  locations: ScopedLocations,
  opts: TargetScopeAddOptions,
  marketplace: string,
  sourceRecord: MarketplaceRecord,
  record: typeof addMarketplaceToState,
): Promise<MarketplaceRecord> {
  const rawSource = (sourceRecord.source as ParsedSource).raw;
  const added = await recordAsInstallFailure(record, {
    state,
    locations,
    source: parseAddableSource(rawSource),
    cwd: opts.cwd,
    ctx: opts.ctx,
    run: opts.run,
    removalOps: opts.removalOps,
    credentialOps: opts.credentialOps,
    deviceFlowHttp: opts.deviceFlowHttp,
    authMemo: opts.authMemo,
  });
  opts.addedMarketplaces?.push({ marketplace: added.name, rawSource, cloneDir: added.cloneDir });
  const targetRecord = ownValue(state.marketplaces, marketplace);
  if (added.name !== marketplace || targetRecord === undefined) {
    throw new InvalidMarketplaceManifestError(
      `Marketplace source "${rawSource}" declares the marketplace "${added.name}", not "${marketplace}".`,
    );
  }

  return targetRecord;
}

/**
 * WR-05 / NFR-5: the user record's cached manifest answers offline whether it
 * lists `plugin`, so a mistyped or unlisted plugin fails `{not in manifest}`
 * before the add clones anything.
 */
async function requireListedBeforeAdd(
  sourceRecord: MarketplaceRecord,
  plugin: string,
  marketplace: string,
): Promise<void> {
  const manifest = await loadCachedMarketplaceManifest(sourceRecord.manifestPath);
  if (!manifest.plugins.some((entry) => entry.name === plugin)) {
    throw new PluginShapeError({ kind: "not-in-manifest", plugin, marketplace });
  }
}

/**
 * LAYER-07 / D-MF-04: the record an install reads `marketplace` from. It is
 * the target scope's own record. When only the user scope records the
 * marketplace (CMP-3), the install first adds it to the target scope, so the
 * catalog the install reads and the tree it installs from are one clone.
 * `undefined` means neither scope records it.
 *
 * The install's dependency walk calls this before it reads a marketplace, and
 * the ledger calls it again for each member, so every read of one install
 * sees the same record. A caller that names the `plugin` it installs gets the
 * WR-05 offline check before the add.
 */
export async function resolveTargetScopeMarketplace(
  state: ExtensionState,
  locations: ScopedLocations,
  opts: TargetScopeAddOptions,
  marketplace: string,
  plugin?: string,
): Promise<ExtensionState["marketplaces"][string] | undefined> {
  const marketplaceAdd = opts.marketplaceAdd ?? DEFAULT_MARKETPLACE_ADD;
  const own = ownValue(state.marketplaces, marketplace);
  if (own !== undefined) {
    return own;
  }

  // CMP-2..4 / PI-16: project-target installs can fall back to a user-scope
  // marketplace; user-target installs cannot read project-only marketplaces.
  const source = await resolveInstallMarketplaceSource({
    targetScope: opts.scope,
    cwd: opts.cwd,
    marketplace,
    targetState: state,
  });
  if (source === undefined) {
    return undefined;
  }

  if (plugin !== undefined) {
    await requireListedBeforeAdd(source.sourceRecord, plugin, marketplace);
  }

  return addTargetScopeMarketplace(
    state,
    locations,
    opts,
    marketplace,
    source.sourceRecord,
    marketplaceAdd.record,
  );
}

/**
 * The PI-15 / PI-3 / PI-2 / PI-4 preflight: resolve the source marketplace,
 * gate on the early-sanity record check, read the cached manifest, validate
 * the chosen entry, and run `resolveStrict` behind the correct
 * installability gate. Adds `state.marketplaces[marketplace]` when the CMP-3
 * fallback finds only a user-scope record (LAYER-07).
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
      /** The target record's marketplace root, which bounds an in-place manifest read. */
      readonly marketplaceRoot: string;
    }
> {
  const { marketplace, plugin } = opts;

  // LAYER-07 / D-MF-04: the target scope's own record, or, when CMP-3 falls
  // back to the user marketplace, the record the add gives the target scope.
  // Every read below uses the target record.
  const targetMp = await resolveTargetScopeMarketplace(state, locations, opts, marketplace, plugin);
  if (targetMp === undefined) {
    // M1: the CMP-3 fallback also missed. No state mutation, no plugin-row
    // `{not in manifest}` throw.
    return { kind: "marketplace-absent" };
  }

  // PI-15 early-sanity check: an existing record in the target scope throws
  // BEFORE the ledger runs, avoiding any disk write. Layer (b) re-checks
  // inside the state-commit phase in case of intra-process re-entry. PI-17:
  // other-scope installs do not block this target. D-54-01 / ENBL-02:
  // `allowExistingRecord` skips the throw so the enable path can
  // re-materialize a KEPT disabled record in place.
  if (ownValue(targetMp.plugins, plugin) !== undefined && opts.allowExistingRecord !== true) {
    // PI-5 (already-installed) and PI-15 (race-at-commit) collapse here;
    // this site surfaces the PI-5 wording and the state-commit phase's
    // defensive throw surfaces PI-15.
    throw new PluginShapeError({ kind: "already-installed", plugin, marketplace });
  }

  // PI-2 cached-manifest read -- NO network, no gitOps. PI-3: the entry must
  // exist in the manifest plugins[] array.
  const manifest = await loadCachedMarketplaceManifest(targetMp.manifestPath);
  // The loader validated every entry against PLUGIN_ENTRY_SCHEMA as part of
  // MARKETPLACE_SCHEMA, so the chosen entry needs no second check.
  const entry = manifest.plugins.find((p) => p.name === plugin);
  if (entry === undefined) {
    throw new PluginShapeError({ kind: "not-in-manifest", plugin, marketplace });
  }

  // PURL-01..04 / PURL-09 / D-77-01..06: the clone-materializing
  // resolveGitPluginRoot callback plus its captured resolved sha. The
  // resolver stays network-free; install injects THIS policy so a git source
  // clones once into the cache and returns the clone-anchored pluginRoot.
  // The full sha is read AFTER the resolve for the version's sha tier
  // (VER-01) and the full-sha state field (D-77-02).
  let resolvedSha: string | undefined;

  // PI-4: resolveStrict + gate. Per D-04 the strict resolver consumes the
  // array-shape componentPaths (D-07 / COMP-01) and either returns an
  // installable variant or surfaces disqualification notes.
  const resolved = await resolveStrict(entry, {
    marketplaceRoot: targetMp.marketplaceRoot,
    marketplaceName: marketplace,
    resolveGitPluginRoot: async (gitSource) => {
      const clone = await (opts.cloneProbe ?? probeInstallClone)({
        // RESV-03: a pinned dependency materializes the exact commit its
        // release tag resolved to. Overriding `sha` is what routes the probe
        // down its already-pinned arm, so no second materialization path
        // exists for a constrained install.
        source:
          opts.sourcePinOverride === undefined
            ? gitSource
            : { ...gitSource, sha: opts.sourcePinOverride },
        locations,
        ...(opts.cloneCacheSeam !== undefined && { seam: opts.cloneCacheSeam }),
        auth: {
          ctx: opts.ctx,
          run: opts.run,
          credentialOps: opts.credentialOps ?? DEFAULT_CREDENTIAL_OPS,
          ...(opts.deviceFlowHttp !== undefined && { deviceFlowHttp: opts.deviceFlowHttp }),
          ...(opts.authMemo !== undefined && { authMemo: opts.authMemo }),
        },
      });
      resolvedSha = clone.resolvedSha;
      return clone.result;
    },
    // D-07-06 / D-07-07: a `path`-source member whose constraint selected a
    // marketplace tag materializes that tag's tree the same way a git-backed
    // member materializes its pinned commit. Added ONLY when a pin is
    // present, so an unpinned `path` source stays byte-identical to today
    // (neither field is set at all).
    ...(opts.sourcePinOverride !== undefined && {
      pathPluginPin: opts.sourcePinOverride,
      resolvePathPluginRoot: async (pathSource: PathSource, pin: string) => {
        const result = await (opts.pathPinProbe ?? materializeMarketplaceTagClone)({
          locations,
          marketplaceRoot: targetMp.marketplaceRoot,
          marketplaceSource: targetMp.source,
          marketplaceName: targetMp.name,
          pathSource,
          tagOid: pin,
        });
        if (result.kind === "materialized") {
          resolvedSha = result.resolvedSha;
        }

        return result;
      },
    }),
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

  if (opts.directoryPin !== undefined) {
    await assertDirectoryPinSatisfied(
      entry.name,
      sourceManifestBoundary(
        entry.source,
        resolved.pluginRoot,
        targetMp.marketplaceRoot,
        opts.sourcePinOverride,
      ),
      opts.directoryPin,
    );
  }

  // After the gate `resolved` is narrowed to the materializable union
  // (`installable | partially-available`); pluginRoot etc. are reachable.
  // The `partially-available` arm carries only supported kinds in
  // componentPaths, so the shared materialize phases degrade it naturally
  // (D-65-02, no partial branch).
  return {
    kind: "ready",
    entry,
    installable: resolved,
    resolvedSha,
    marketplaceRoot: targetMp.marketplaceRoot,
  };
}

/** Cuts a directory-pin refusal field as Claude Code does (D-PL3-09). */
function cutPinField(text: string): string {
  return truncateForRefusal(text, MAX_DIRECTORY_PIN_FIELD_CHARS);
}

/**
 * GV-01: Claude Code checks the `plugin.json` version of a plugin directory
 * copy against its dependents' range after the fetch, and refuses the install
 * when it falls outside or declares none. `boundary` is the one the resolver
 * read the copy's manifest within (D-PL2-17), so a manifest it refused
 * declares no version here either.
 *
 * D-PL3-09: the refusal's fields arrive cut as Claude Code cuts them, because
 * `shared/` cannot import the cut from `domain/`. The cascade already cut the
 * joined ranges, and the requirer count has no cap.
 */
async function assertDirectoryPinSatisfied(
  plugin: string,
  boundary: ManifestBoundary,
  pin: DirectoryPinRange,
): Promise<void> {
  const manifestVersion = await readDeclaredPluginVersion(boundary);
  if (manifestVersion !== undefined && recordedVersionSatisfies(manifestVersion, pin.range)) {
    return;
  }

  throw new DirectoryPinUnsatisfiedError({
    plugin: cutPinField(plugin),
    manifestVersion: manifestVersion === undefined ? undefined : cutPinField(manifestVersion),
    ranges: pin.declared,
    requiredBy: pin.requiredBy.map((key) => cutPinField(key.replace(/@[^@]*$/u, ""))),
  });
}

/**
 * UPD-DEP-D1: whether the ledger would install one plugin, decided with no
 * write: the PI-15 / PI-3 / PI-4 preflight behind the same installability
 * gate, then the PI-6 name check, then the D-PL4-04 refusal of an agent
 * target that holds a file the agents commit would not replace. It runs over
 * a copy of `state`, and a marketplace only the user scope records is read
 * from the user record rather than added (D-MF-04), so a refused plan adds
 * nothing. A git source clones on a cache miss, as the install it previews
 * would. Throws what the ledger would throw. Answers the commit its
 * preflight resolved, which the install then pins (D-PL4-01), or `undefined`
 * when the source resolved none (a path source with no pin) or when the
 * marketplace is one neither scope records, since the ledger reports it.
 */
export async function previewInstall(
  state: ExtensionState,
  locations: ScopedLocations,
  opts: InstallLedgerOptions,
): Promise<string | undefined> {
  const preview = structuredClone(state);
  if (ownValue(preview.marketplaces, opts.marketplace) === undefined) {
    const source = await resolveInstallMarketplaceSource({
      targetScope: opts.scope,
      cwd: opts.cwd,
      marketplace: opts.marketplace,
      targetState: state,
    });
    if (source !== undefined) {
      setOwn(preview.marketplaces, opts.marketplace, source.sourceRecord);
    }
  }

  const preflight = await preflightInstallResolve(preview, locations, opts);
  if (preflight.kind === "marketplace-absent") {
    return undefined;
  }

  const generatedNames = await discoverGeneratedNames(opts.plugin, preflight.installable);
  assertNoCrossPluginConflicts(
    opts.scope,
    generatedNames,
    removePluginRecord(preview, opts.marketplace, opts.plugin),
  );
  await assertAgentTargetsFree(
    locations,
    { marketplace: opts.marketplace, plugin: opts.plugin },
    generatedNames.agents,
  );
  return preflight.resolvedSha;
}

/**
 * Default transaction seam for the guard-free ledger body.
 *
 * Named at module scope rather than written as an inline parameter default, so
 * every call that omits `transaction` reads this one frozen object instead of
 * allocating a fresh literal per invocation (typescript:S7737).
 */
const DEFAULT_INSTALL_LEDGER_TRANSACTION: InstallLedgerTransaction = Object.freeze({ runPhases });

/**
 * CR-01: the guard-FREE install ledger body -- the
 * complete PI-15 / PI-3 / PI-2 / PI-4 / PI-6 / PI-7 + 8-phase ledger
 * sequence.
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
 * Failure contract: delegates identity, containment bypass, and cause wrapping
 * to `formatRollbackError`. When `capture` is provided,
 * `capture.rollbackPartials` / `capture.version` are populated BEFORE the
 * formatted error is rethrown so the caller's catch can compose structured
 * rollback-partial rows.
 *
 * The public `runInstallLedger` owner projects the returned working context
 * onto the narrow caller-facing summary.
 */
async function executeInstallLedger(
  state: ExtensionState,
  locations: ScopedLocations,
  opts: InstallLedgerOptions,
  capture?: InstallFailureCapture,
  transaction: InstallLedgerTransaction = DEFAULT_INSTALL_LEDGER_TRANSACTION,
): Promise<InstallLedgerContextResult> {
  return runInstallLedgerBody(transaction, state, locations, opts, capture);
}

/**
 * Run install's phase ledger without acquiring a state lock.
 *
 * The caller owns locking and persistence. Failures preserve rollback details
 * through `capture`; success exposes only the immutable outcome projection.
 */
export async function runInstallLedger(
  state: ExtensionState,
  locations: ScopedLocations,
  options: InstallLedgerOptions,
  capture?: InstallFailureCapture,
  transaction?: InstallLedgerTransaction,
): Promise<InstallLedgerResult> {
  const result = await executeInstallLedger(state, locations, options, capture, transaction);
  if (result.kind === "marketplace-absent") {
    return result;
  }

  return { kind: "installed", summary: toInstallLedgerSummary(result.installCtx) };
}

/** Project the completed ledger context onto its caller-facing summary. */
function toInstallLedgerSummary(context: InstallLedgerContext): InstallLedgerSummary {
  return {
    locations: context.locations,
    cwd: context.cwd,
    marketplace: context.marketplace,
    plugin: context.plugin,
    resolved: context.resolved,
    version: context.version,
    pluginDataDir: context.pluginDataDir,
    frontmatterDegradations: context.frontmatterDegradations,
    stagedSkillNames: context.stagedSkillNames,
    stagedCommandNames: context.stagedCommandNames,
    stagedAgentNames: context.stagedAgentNames,
    stagedMcpServerNames: context.stagedMcpServerNames,
    stagedWorkflowNames: context.stagedWorkflowNames,
    bridgeWarnings: context.bridgeWarnings,
    discoveryWarnings: context.discoveryWarnings,
    agentForeignFailures: context.agentForeignFailures,
    mcpConfigNotices: context.mcpConfigNotices,
  };
}

/**
 * AS-7 / D-PL6-20: the error a failed skills undo throws. A containment
 * refusal passes through unchanged, so the ledger still rethrows it (PI-14).
 * Any other failure becomes a `ManualRecoveryError` that lists each staged
 * skill directory still on disk, in place of the bridge error, whose own cause
 * it keeps so the rendered chain shows the failure once. With
 * no directory left, or when probing for them fails, the bridge error passes
 * through, so a probe failure never hides the real unstage failure.
 */
async function skillsUndoError(
  err: unknown,
  locations: ScopedLocations,
  names: readonly string[],
): Promise<Error> {
  if (err instanceof PathContainmentError) {
    return err;
  }

  const dirs = names.map((name) => path.join(locations.skillsTargetDir, name));
  try {
    const present = await Promise.all(dirs.map((dir) => pathExists(dir)));
    const leftovers = dirs.filter((_, index) => present[index] === true);
    if (leftovers.length === 0) {
      return errorWithManualRecovery(err, []);
    }

    const { cause } = errorWithManualRecovery(err, []);
    return new ManualRecoveryError(
      errorMessage(err),
      leftovers,
      cause === undefined ? undefined : { cause },
    );
  } catch {
    return errorWithManualRecovery(err, []);
  }
}

/**
 * The ledger body proper, under the contract documented on `runInstallLedger`.
 * Hands back the working `InstallLedgerContext` to this module's public-result
 * projection. Module-private: only the declaring module holds the mutable
 * context.
 */
async function runInstallLedgerBody(
  transaction: InstallLedgerTransaction,
  state: ExtensionState,
  locations: ScopedLocations,
  opts: InstallLedgerOptions,
  capture?: InstallFailureCapture,
): Promise<InstallLedgerContextResult> {
  const { scope, cwd, marketplace, plugin } = opts;

  const preflight = await preflightInstallResolve(state, locations, opts);
  if (preflight.kind === "marketplace-absent") {
    return { kind: "marketplace-absent" };
  }

  const { entry, installable, resolvedSha, marketplaceRoot } = preflight;

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
  // VER-01 / PURL-09: derive the recorded version. See `deriveInstallVersion`.
  const version = await deriveInstallVersion({
    entry,
    installable,
    marketplace: { marketplaceName: marketplace, marketplaceRoot },
    resolvedSha,
    pinVersionOverride: opts.pinVersionOverride,
    resolvedVersion: opts.resolvedVersion,
  });

  // Resolve the per-plugin data dir up front; the bridges receive it
  // for ${CLAUDE_PLUGIN_DATA} substitution. The directory itself is
  // NOT created here -- the eager mkdir runs POST-state-commit per
  // D-08 / AS-6.
  const pluginDataDir = await locations.pluginDataDir(marketplace, plugin);

  // Build the per-call install context. Per D-01 corollary, this lives
  // local to this owner (single consumer); promoting to orchestrators/
  // types.ts would be premature.
  const ctxLocal: InstallLedgerContext = {
    locations,
    cwd,
    marketplace,
    plugin,
    resolved: installable,
    agentsDirs: generatedNames.agentsDirs,
    version,
    // D-77-02: git-source installs carry the full 40-hex resolved sha; path /
    // github-name sources leave it undefined (no key => omitted from the record).
    ...(resolvedSha !== undefined && { resolvedSha }),
    ...(opts.resolvedVersion !== undefined && { resolvedVersion: opts.resolvedVersion }),
    pluginDataDir,
    hooksFileWritten: false,
    stagedSkillNames: [],
    stagedCommandNames: [],
    stagedAgentNames: [],
    stagedMcpServerNames: [],
    stagedWorkflowNames: [],
    bridgeWarnings: [],
    discoveryWarnings: [],
    agentForeignFailures: [],
    mcpConfigNotices: [],
    frontmatterDegradations: [],
    stateSnapshot: state,
  };

  // D-01 literal-array discipline: each phase is a single Phase<InstallLedgerContext>
  // value; the ledger sees an 8-element constant array.
  const skillsPhase: Phase<InstallLedgerContext> = {
    name: "skills",
    do: async (c) => {
      const prep = await prepareStageSkills(opts.removalOps, {
        locations: c.locations,
        pluginName: c.plugin,
        pluginRoot: c.resolved.pluginRoot,
        pluginDataDir: c.pluginDataDir,
        resolved: c.resolved,
        // SKTK-01: the workflows phase runs after this one, so the names come
        // from the pre-ledger preview rather than from a staged result.
        referenceNames: generatedNames,
        knownWorkflowNames: generatedNames.workflows,
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

      const leak = await commitPreparedSkills(opts.removalOps, prep);
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
      try {
        await unstagePluginSkills({
          locations: c.locations,
          previousSkillNames: c.stagedSkillNames,
        });
      } catch (err) {
        throw await skillsUndoError(err, c.locations, c.stagedSkillNames);
      }
    },
  };

  const commandsPhase: Phase<InstallLedgerContext> = {
    name: "commands",
    do: async (c) => {
      const prep = await prepareStageCommands(opts.removalOps, {
        locations: c.locations,
        pluginName: c.plugin,
        pluginRoot: c.resolved.pluginRoot,
        pluginDataDir: c.pluginDataDir,
        resolved: c.resolved,
        referenceNames: generatedNames,
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

      const leak = await commitPreparedCommands(opts.removalOps, prep);
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

  const agentsPhase: Phase<InstallLedgerContext> = {
    name: "agents",
    do: async (c) => {
      const prep = await prepareStagePluginAgents(opts.removalOps, {
        locations: c.locations,
        marketplaceName: c.marketplace,
        pluginName: c.plugin,
        pluginRoot: c.resolved.pluginRoot,
        pluginDataDir: c.pluginDataDir,
        agentsDirs: c.agentsDirs,
        knownSkills: c.stagedSkillNames,
        referenceNames: generatedNames,
        // AG-7 opt-in: `--map-model` on /claude:plugin install threads
        // the flag down to here. When the user did not pass the flag
        // we explicitly default to false so generated agents omit
        // `model:` (the default behavior).
        mapModel: opts.mapModel ?? false,
        // ANAME-02: the servers this install writes. The mcp phase runs
        // later, so the set comes from the resolver, not the mcp stage.
        mcpServerNames: Object.keys(c.resolved.mcpServers),
        // SUB-02: project-scope ${CLAUDE_PROJECT_DIR} resolves to the install cwd.
        cwd: c.cwd,
      });
      c.agentsPrep = prep;
      // The agents bridge aggregates THREE kinds on one array: agents-index
      // corruptions, per-agent frontmatter conversion notes, and D-07
      // duplicate-name skips. Only the last is a discovery truncation, and
      // the three are not separable here, so the whole array rides the
      // hygiene channel (D-19-01) rather than the D-141-03 one, keeping
      // every kind surfaced instead of any getting silently dropped.
      c.bridgeWarnings.push(...prep.result.warnings);
      const leak = await commitPreparedAgents(opts.removalOps, prep);
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
  const hooksPhase: Phase<InstallLedgerContext> = {
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

  const mcpPhase: Phase<InstallLedgerContext> = {
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
        description: c.resolved.description,
        env: opts.env,
      });
      c.mcpReplacement = await replacePreparedMcp(prep);
      const result = prep.result;
      c.stagedMcpServerNames = result.recorded.map((r) => r.generatedName);
      // MCP staging soft warnings (malformed declared env, non-object entry)
      // ride the same bridgeWarnings channel as the other bridges' leak
      // strings instead of being dropped.
      c.bridgeWarnings.push(...result.warnings);
      c.mcpConfigNotices.push(...result.notices);
      // AMIG-02: the replace removed the plugin's marked entries from the
      // scope's mcp.json after writing mcp-adapter.json; its notices describe
      // that later write. This phase serves install, enable, the install
      // cascade, the reconcile install and import.
      if (c.mcpReplacement.kind === "replaced") {
        c.mcpConfigNotices.push(...c.mcpReplacement.legacy.notices);
      }
    },
    // AFILE-04 / AMIG-02 / NFR-3: a failed install restores every file the mcp
    // phase rewrote to its prior bytes, comments included, `mcp.json` first,
    // instead of unstaging from the rewritten files. A restore that cannot
    // write throws, so the ledger records the mcp rollback partial rather than
    // reporting a clean unwind over a changed file. The handle needs no
    // finalize on success; it is dropped with the context.
    undo: async (c) => {
      if (c.mcpReplacement === undefined) {
        return;
      }

      const leaks = await rollbackMcpReplacement(c.mcpReplacement);
      if (leaks.length > 0) {
        throw new Error(leaks.join("; "));
      }
    },
  };

  // WLIF-01: the sixth bridge phase, modelled on `mcpPhase` -- the newest
  // sibling that carries a real prepare / commit / unstage triplet.
  const workflowsPhase: Phase<InstallLedgerContext> = {
    name: "workflows",
    do: async (c) => {
      // The names this plugin's PREVIOUS install recorded. A fresh install
      // finds no record and the bridge's re-stage branch stays inert; the
      // enable path reaches the deliberately-kept disabled record, which is
      // what lets the commit displace the plugin's own envelopes aside
      // instead of hitting the occupancy refusal. Spread conditionally --
      // `exactOptionalPropertyTypes` rejects an explicit `undefined`.
      const previousWorkflowNames = ownValue(
        ownValue(c.stateSnapshot.marketplaces, c.marketplace)?.plugins,
        c.plugin,
      )?.resources.workflows;
      const prep = await prepareStageWorkflows({
        locations: c.locations,
        pluginName: c.plugin,
        resolved: c.resolved,
        ...(previousWorkflowNames !== undefined && { previousWorkflowNames }),
      });
      // Set BEFORE the commit: this is the point after which envelopes can
      // exist on disk, and it is the sentinel `undo` gates on. A `do` that
      // throws inside the commit may have placed envelopes while the name
      // array was still empty, which is why the sentinel is the handle and
      // not the array.
      c.workflowsPrep = prep;
      c.stagedWorkflowNames = [];
      // D-141-03 / WGATE-01: the bridge's array joins the DISCOVERY half, and it
      // joins it HERE rather than through `splitStagingWarnings`, which is the
      // call `update.ts` already makes for the same array and the same reason.
      // Every string in it describes the plugin's DECLARED scripts -- which ones
      // were not installed, which were installed but the engine will refuse to
      // load -- and that is a fact a standalone user needs, not a hygiene note
      // only the cascade forwards. `bridgeWarnings` is gated on `orchestrated`,
      // so a standalone install would render none of it. The shared classifier
      // stays at four members: a fifth would drag every other consumer of it
      // into this change.
      //
      // Pushed at the prepare, matching `agentsPhase` -- the other bridge whose
      // WARNINGS come off the prepare rather than off the commit's return, and
      // the shape this one follows. (`mcpPhase` pushes after its commit because
      // its warnings are a member of the commit's result.)
      //
      // WR-04: the position buys ordering consistency, NOT survival. A phase
      // throw unwinds `runPhases` and the whole `InstallLedgerContext` is
      // discarded, so these warnings are lost on the failure path wherever the
      // push sits. Both arrays are read by `collectPostCommitWarnings`, run
      // after the ledger returned and the state record committed, and neither
      // is a member of `InstallLedgerSummary`. That is true of every bridge's
      // warnings alike, not of this one, so it is not repaired here.
      c.discoveryWarnings.push(...prep.result.warnings);
      const leak = await commitPreparedWorkflows(prep, {
        // The whole body is one assignment that cannot throw. The commit
        // invokes this callback on the failure paths too, so anything that
        // could raise here would mask the real failure.
        onPlaced: (placedNames) => {
          c.stagedWorkflowNames = placedNames;
        },
      });
      if (leak !== undefined) {
        c.bridgeWarnings.push(leak);
      }
    },
    undo: async (c) => {
      if (c.workflowsPrep === undefined) {
        return;
      }

      // WLIF-01 / T-112-01: the removal payload is what `onPlaced` REPORTED,
      // never `prep.result.stagedNames`. A foreign envelope at a colliding
      // name, or a previous envelope the commit's own reversal restored, is
      // not this commit's to unlink.
      const result = await unstagePluginWorkflows({
        locations: c.locations,
        previousWorkflowNames: c.stagedWorkflowNames,
      });
      // WLIF-03 / T-112-04: unlike the five sibling phases, the result is NOT
      // discarded. A leftover workflow envelope is executable code outside
      // every scope root, so a silent swallow would report a clean rollback
      // over a real leak.
      if (result.failed.length > 0) {
        throw new WorkflowsUnstageFailureError(
          result.failed.map((failure) => `${failure.name}: ${failure.reason}`).join("; "),
          result.failed,
        );
      }
    },
  };

  const statePhase: Phase<InstallLedgerContext> = {
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
      const mpInner = ownValue(c.stateSnapshot.marketplaces, c.marketplace);
      const existing = ownValue(mpInner?.plugins, c.plugin);
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
      setOwn(mpInner.plugins, c.plugin, {
        version: c.version,
        resolvedSource: c.resolved.pluginRoot,
        // D-77-02 / PURL-09: persist the full 40-hex resolved commit sha for
        // git-source installs (reinstall pins its re-clone checkout to this
        // full sha; clone GC presence-checks it to derive live clone keys).
        // WR-01 / TAGS-01: a `path`-source install ALSO carries a resolvedSha
        // when its constraint pinned a marketplace tag (`resolvePathPluginRoot`
        // above); an unconstrained `path` or a github-name install still omits
        // it.
        ...(c.resolvedSha !== undefined && { resolvedSha: c.resolvedSha }),
        // GV-01: the tag's semver, which dependency ranges read.
        ...(c.resolvedVersion !== undefined && { resolvedVersion: c.resolvedVersion }),
        // D-100-01 / ENBL-10: describe the hooks the install materialized, so
        // a later `info` need not read the config back off disk. Omitted when
        // the plugin declares no hooks config -- there is nothing to describe.
        ...(c.hookEntries !== undefined && { hookEntries: [...c.hookEntries] }),
        compatibility: {
          // INV-1 / D-66-01 / BFILL-01: record the REAL compatibility from the
          // resolve, not a hardcoded `true`. A `--partial` install of an
          // `partially-available` plugin persists `installable: false` with the still-
          // unsupported set (mirrors reinstall.ts::updateStateRecord), so the
          // partially-installed derivation stays truthful AND `apply`'s growth
          // move (which compares the recorded `supported` set) can later
          // promote it when its supported set grows. A clean install persists `true`.
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
          // WLIF-01: the envelope names the workflows phase's commit
          // reported. The record is the only inventory of them that survives
          // the process.
          workflows: [...c.stagedWorkflowNames],
        },
        // ENBL-02: always set enabled: true on install and re-materialization.
        // The disable branch sets it to false; the enable branch re-runs
        // statePhase (via runInstallLedger), which resets it to true here.
        enabled: true,
        // LOAD-02: `dependencyDisabled` is DELIBERATELY not named here, and the
        // omission is load-bearing. This literal REBUILDS the record rather
        // than spreading it, so a field it does not name is dropped -- and that
        // drop IS the clear of the load-time check's marker. The enable branch
        // reaches this phase, so a dependent whose dependency became satisfied
        // comes back live with no marker left claiming the check still holds it
        // down. Do not "fix" this literal by carrying the field through from
        // `existing`: a stale marker would make the planner read a live record
        // as one it is still responsible for. The reverse asymmetry is
        // deliberate too -- `toDisabledRecord` (`persistence/state-io.ts`)
        // PRESERVES the marker, because a record a user then disables is not a
        // re-materialization, and losing it there would let a held-down record
        // read as a disable the user asked for.
        // D-04-01 / ENBL-02: a KEPT record's provenance rides through the
        // enable branch, which hand-builds its options with
        // `allowExistingRecord` and never names the field -- falling back
        // through `existing` is what preserves it there. A fresh install
        // takes the cascade's per-member decision; an install that reaches
        // the ledger without one is a plugin the caller named.
        provenance: existing?.provenance ?? opts.provenance ?? "explicit",
        // D-54-01 / ENBL-02: on re-materialization (allowExistingRecord),
        // PRESERVE the original installedAt -- the record was never
        // uninstalled, only disabled. Fresh installs stamp now.
        installedAt: existing?.installedAt ?? nowIso,
        updatedAt: nowIso,
      });
    },
    // undo intentionally absent: at state-commit phase time the guard
    // has not flushed yet, and on throw the guard does NOT save the
    // mutated snapshot (ST-7 contract). The mutation is discarded
    // by the unwinding closure.
  };

  // D-PL9-05: after the six bridge phases, so a bridge failure never spends the
  // network; before state, so a state failure reaches its undo.
  const packagesPhase = createPackagesPhase(
    transaction.packageInstallOps ?? DEFAULT_PACKAGE_INSTALL_OPS,
  );

  // D-01 literal-array; order is part of the contract -- never refactor
  // to a dynamic builder. D-63-01: hooks slot lands between agents and mcp.
  // D-PL9-05: the packages slot lands between workflows and state.
  // The PRD-fixed sequence is
  // [skills, commands, agents, hooks, mcp, workflows, packages, state].
  const phases: readonly Phase<InstallLedgerContext>[] = [
    skillsPhase,
    commandsPhase,
    agentsPhase,
    hooksPhase,
    mcpPhase,
    workflowsPhase,
    packagesPhase,
    statePhase,
  ];

  const result = await transaction.runPhases(phases, ctxLocal);
  if (isFailedRunPhasesResult(result)) {
    // The transaction owner is the sole identity/containment/partial rule.
    // Capture its raw rows and best-known version before rethrowing its error;
    // the caller only projects those structured values into the notification.
    const rollback = formatRollbackError(result, result.error);
    if (capture !== undefined) {
      capture.rollbackPartials = rollback.rollbackPartials;
      capture.version = ctxLocal.version;
    }

    throw rollback.error;
  }

  return { kind: "installed", installCtx: ctxLocal };
}

type FailedRunPhasesResult = RunPhasesResult & {
  readonly ok: false;
  readonly error: Error;
};

/**
 * The ledger's sole `ok: false` producer normalizes and supplies `error`.
 * Keep that producer invariant private while the shared legacy result type
 * still models `ok` and `error` independently.
 */
function isFailedRunPhasesResult(result: RunPhasesResult): result is FailedRunPhasesResult {
  return !result.ok;
}

/** Projects a completed ledger summary into the public installed outcome. */
export function installedPluginOutcome(
  summary: InstallLedgerSummary,
  postCommitWarnings: readonly string[],
  landedDisabled: boolean,
): InstallPluginOutcome {
  const stagedAny =
    summary.stagedSkillNames.length > 0 ||
    summary.stagedCommandNames.length > 0 ||
    summary.stagedAgentNames.length > 0 ||
    summary.stagedMcpServerNames.length > 0;

  return {
    status: "installed",
    version: summary.version,
    resourcesChanged: !landedDisabled && stagedAny,
    declaresAgents: summary.stagedAgentNames.length > 0,
    declaresMcp: summary.stagedMcpServerNames.length > 0,
    declaresWorkflows: summary.stagedWorkflowNames.length > 0,
    ...(landedDisabled && { landedDisabled: true as const }),
    ...(postCommitWarnings.length > 0 && { postCommitWarnings: [...postCommitWarnings] }),
    ...(summary.resolved.state === "partially-available" && {
      unsupported: [...summary.resolved.unsupported],
    }),
    ...ledgerDegradationSignals(summary),
  };
}

/**
 * SURF-05 / WARN-01: the degradation signals a completed ledger run leaves on
 * the root's own `(installed)` row -- `orphanRewake` from the resolver and one
 * `degradedKinds` entry per component kind whose frontmatter did not parse.
 * Every projection of a root summary spreads this one derivation
 * (`installedPluginOutcome` here, the reload dependency-install outcome in
 * `install-flow.ts`), so a signal added to it reaches each row without a
 * per-projection edit. Both members are omitted when the run raised neither
 * (NREG-01).
 */
export function ledgerDegradationSignals(
  summary: InstallLedgerSummary,
): Pick<LedgerDegradationSignals, "orphanRewake" | "degradedKinds"> {
  const degradedKinds = Array.from(
    new Set(summary.frontmatterDegradations.map((degradation) => degradation.kind)),
  );
  return {
    ...(summary.resolved.orphanRewake === true && { orphanRewake: true }),
    ...(degradedKinds.length > 0 && { degradedKinds }),
  };
}

// orchestrators/plugin/install-flow.ts
//
// Public composition root for install transaction sequencing. The guard-free
// phase ledger remains in install.ts until the family hub deletion plan; this
// owner binds that ledger to clone probing, declared enablement, disable
// cascade, outcome projection, locking, and exact notification behavior.

import { mkdir } from "node:fs/promises";
import path from "node:path";

import { asAbsolutePluginRoot } from "../../domain/plugin-root.ts";
import { writePluginConfigEntry } from "../../persistence/config-write-back.ts";
import { locationsFor } from "../../persistence/locations.ts";
import { softDepStatus } from "../../platform/pi-api.ts";
import { hookDebugLog } from "../../shared/debug-log.ts";
import { errorMessage } from "../../shared/errors.ts";
import { notify } from "../../shared/notification-dispatch.ts";
import { notifyWithContext } from "../../shared/notify-context.ts";
import { companionSeverity, malformedReasonsForKinds } from "../../shared/notify-reasons.ts";
import { narrowUnsupportedKinds } from "../../shared/probe-classifiers.ts";
import { runPhases } from "../../transaction/phase-ledger.ts";
import { withLockedStateTransaction } from "../../transaction/with-state-guard.ts";
import { cascadeUnstagePlugin, crossScopeFlag } from "../marketplace/shared.ts";

import { probeInstallClone } from "./install-clone-probe.ts";
import { resolveInstallDeclaredEnabled } from "./install-declared-enabled.ts";
import { composeInstallDisableCascade } from "./install-disable-cascade.ts";
import { installedPluginOutcome, runInstallLedger } from "./install-outcome.ts";
import {
  INSTALL_CONTEXT,
  classifyEntityShapeError,
  classifyInstallFailure,
  composeInstallFailureMessage,
  formatOrchestratedCause,
} from "./install.messaging.ts";
import {
  selectDeclaringConfigWriteTarget,
  surfaceDiscoveryWarnings,
  writeAdoptingConfigEntries,
} from "./shared.ts";

import type { InstallCloneCacheSeam } from "./install-clone-probe.ts";
import type { InstallHooksRouting } from "./install-disable-cascade.ts";
import type {
  InstallFailureCapture,
  InstallLedgerOptions,
  InstallLedgerSummary,
  InstallPluginNotifications,
} from "./install-outcome.ts";
import type { InstallMsg } from "./install.messaging.ts";
import type { NotificationContext, ToolInventory } from "../../platform/pi-api.ts";
import type { CompletionCache } from "../../shared/completion-cache.ts";
import type { Dependency } from "../../shared/concerns/soft-dep.ts";
import type { ContentReason } from "../../shared/notification-types.ts";
import type { Scope } from "../../shared/types.ts";
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

const REAL_INSTALL_TRANSACTION: InstallTransaction = {
  runPhases: (...args) => runPhases(...args),
  withLockedStateTransaction: (...args) => withLockedStateTransaction(...args),
};

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
    cloneProbe: probeInstallClone,
    ...(opts.credentialOps !== undefined && { credentialOps: opts.credentialOps }),
    ...(opts.deviceFlowHttp !== undefined && { deviceFlowHttp: opts.deviceFlowHttp }),
    ...(opts.authMemo !== undefined && { authMemo: opts.authMemo }),
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
  installCtx: InstallLedgerSummary,
  completionCache: CompletionCache,
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

function composeInstalledRow(installCtx: InstallLedgerSummary, pi: ToolInventory): InstallMsg {
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

  // Post-guard composition data. The guard closure populates this on its sole
  // installed result; marketplace/config misses and every throw return before
  // post-guard composition, so there is no clean path that can read it first.
  let installCtx!: InstallLedgerSummary;
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
  let removeDisabledRoutesAfterSave = false;

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
    await transaction.withLockedStateTransaction(locations, async (tx) => {
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
      const result = await runInstallLedger(
        state,
        locations,
        buildInstallLedgerOptions(opts, { scope, cwd, marketplace, plugin }),
        capture,
        transaction,
      );
      if (result.kind === "marketplace-absent") {
        // WR-04: precondition miss -- read-only in effect, NO tx.save().
        marketplaceAbsent = true;
        return;
      }

      // Success: lift the install context up so the post-guard path can
      // compose the user-visible notification without re-entering the closure.
      installCtx = result.summary;

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
        key: `${plugin}@${marketplace}`,
      });
      disabledInstall.landed =
        opts.applyDefaultEnabled === true &&
        declaredEnabled === undefined &&
        !result.summary.resolved.defaultEnabled;

      if (disabledInstall.landed) {
        // D-102-01: the six-phase ledger already ran and the state phase wrote
        // `enabled: true`; the disable half runs here, after `runPhases` and
        // before the write-back, and overwrites that value. No seventh phase,
        // no edit to any of the six phase bodies.
        const disableResult = await disableCascade.disableFreshInstall({
          state,
          scope,
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
      // DFEN-04: SKIPPED entirely when the install landed disabled. The disable
      // cascade above has just removed the on-disk hooks.json, so this block
      // would either re-read a deleted file or -- worse -- register routing
      // entries for a plugin the user's configuration says is disabled, giving
      // live hook dispatch against disabled code that nothing short of the next
      // hydrate would clear. The composed disable cascade already dropped the
      // cache entry, which is the correct mutation on that path.
      if (!disabledInstall.landed && installCtx.resolved.hooksConfigPath !== undefined) {
        try {
          await hooksRouting.readAndCachePluginHooks({
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

          hooksRouting.rebuildRoutingTables();
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
              cause: cascadeError,
            },
          ],
        },
      ],
      undefined,
      "single",
    );
    return { status: "failed", error: cascadeError, cause };
  }

  const postCommitWarnings = await collectPostCommitWarnings(
    installCtx,
    completionCache,
    scope,
    orchestrated,
  );

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
    notifyWithContext(
      ctx,
      pi,
      INSTALL_CONTEXT,
      [
        {
          name: marketplace,
          scope,
          plugins: [
            disabledInstall.landed
              ? disableCascade.composeDisabledRow({
                  plugin: installCtx.plugin,
                  version: installCtx.version,
                  resolution: {
                    state: installCtx.resolved.state,
                    unsupported: installCtx.resolved.unsupported,
                  },
                  frontmatterDegradations: installCtx.frontmatterDegradations,
                })
              : composeInstalledRow(installCtx, pi),
          ],
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

  return installedPluginOutcome(installCtx, postCommitWarnings, disabledInstall.landed);
}

/** Bind install orchestration to one required semantic transaction owner. */
export function createInstallPlugin(
  transaction: InstallTransaction,
  hooksRouting: InstallHooksRouting,
  completionCache: CompletionCache,
): (opts: InstallPluginOptions) => Promise<InstallPluginOutcome> {
  return (opts) => installPluginWithTransaction(transaction, hooksRouting, completionCache, opts);
}

/** Bind production install behavior to required routing and completion-cache owners. */
export function createNodeInstallPlugin(
  hooksRouting: InstallHooksRouting,
  completionCache: CompletionCache,
): (opts: InstallPluginOptions) => Promise<InstallPluginOutcome> {
  return createInstallPlugin(REAL_INSTALL_TRANSACTION, hooksRouting, completionCache);
}

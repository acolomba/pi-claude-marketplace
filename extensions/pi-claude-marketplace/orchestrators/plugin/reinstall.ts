// orchestrators/plugin/reinstall.ts
//
// PRL-02/03/04/05/06/07/08/09/10/11/12/13/14/15 reinstall core.
// Single-plugin (PRL-02/06/07/08/09/10/11/12) and bulk reinstall
// (PRL-03/04/05/13/14/15) are both implemented here.
//
// Reinstall is deliberately NOT uninstall+install and NOT update:
// it targets an already-installed plugin, reads the cached marketplace
// manifest only, preserves the installed record's version/installedAt, prepares
// every bridge before physical replacement, then rolls physical resources back
// if replacement or explicit state persistence fails.
//
// Each orchestration arm emits exactly one `notify(ctx, pi, ...)` call.
// notify() owns severity, the reload-hint trailer, and the cause-chain.
// Manual-recovery rows are folded into the cascade `plugins[]` array as
// `PluginManualRecoveryMessage` entries rather than emitted separately.
// Post-success soft warnings (bridge / maintenance) are NOT surfaced:
// MarketplaceNotificationMessage has no field for them. The underlying side
// effects (dropMarketplaceCache + rm) still run, and the internal `notes`
// field on `ReinstallPluginOutcome` (orchestrated-mode consumers) still
// carries the warning strings -- only the standalone-mode user-facing
// surface is absent.

import { readFile, rm } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

import {
  abortPreparedAgents,
  finalizeAgentsReplacement,
  prepareStagePluginAgents,
  replacePreparedAgents,
  rollbackAgentsReplacement,
} from "../../bridges/agents/index.ts";
import {
  abortPreparedCommands,
  finalizeCommandsReplacement,
  prepareStageCommands,
  replacePreparedCommands,
  rollbackCommandsReplacement,
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
  finalizeMcpReplacement,
  prepareStageMcpServers,
  replacePreparedMcp,
  rollbackMcpReplacement,
} from "../../bridges/mcp/index.ts";
import {
  abortPreparedSkills,
  finalizeSkillsReplacement,
  prepareStageSkills,
  replacePreparedSkills,
  rollbackSkillsReplacement,
} from "../../bridges/skills/index.ts";
import { parseHooksConfig } from "../../domain/components/hooks.ts";
import { PLUGIN_ENTRY_VALIDATOR, type PluginEntry } from "../../domain/components/plugin.ts";
import { loadMarketplaceManifest } from "../../domain/manifest.ts";
import { asAbsolutePluginRoot } from "../../domain/plugin-root.ts";
import { requireForceInstallable, resolveStrict } from "../../domain/resolver.ts";
import { locationsFor } from "../../persistence/locations.ts";
import { loadState } from "../../persistence/state-io.ts";
import { dropMarketplaceCache } from "../../shared/completion-cache.ts";
import { hookDebugLog } from "../../shared/debug-log.ts";
import {
  assertNever,
  composeErrorWithCauseChain,
  errorMessage,
  ManualRecoveryError,
  MarketplaceNotFoundError,
  PluginShapeError,
} from "../../shared/errors.ts";
import {
  notifyWithContext,
  type MarketplaceRows,
  type Plural,
} from "../../shared/notify-context.ts";
import { skipSeverity } from "../../shared/notify-reasons.ts";
import { compareByNameThenScope, notify } from "../../shared/notify.ts";
import {
  withLockedStateTransaction,
  type LockedStateTransaction,
  type LockedStateTransactionDeps,
} from "../../transaction/with-state-guard.ts";
import { resolveScopeFromState } from "../marketplace/shared.ts";

import { discoverGeneratedNames } from "./discover-names.ts";
import { REINSTALL_CONTEXT, type ReinstallMsg } from "./reinstall.messaging.ts";
import {
  assertNoCrossPluginConflicts,
  MarketplaceNotAddedSignal,
  maybeWritePluginConfigBack,
  resolveCrossScopePluginTarget,
  resolveInstalledMarketplaceTarget,
} from "./shared.ts";

import type { AgentsReplacement, PreparedAgentsStaging } from "../../bridges/agents/index.ts";
import type { CommandsReplacement, PreparedCommandsStaging } from "../../bridges/commands/index.ts";
import type { McpReplacement, PreparedMcpStaging } from "../../bridges/mcp/index.ts";
import type { PreparedSkillsStaging, SkillsReplacement } from "../../bridges/skills/index.ts";
import type { MaterializablePlugin } from "../../domain/resolver.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { ExtensionState } from "../../persistence/state-io.ts";
import type { ExtensionAPI, ExtensionContext } from "../../platform/pi-api.ts";
import type { Dependency } from "../../shared/concerns/soft-dep.ts";
import type {
  ContentReason,
  PluginFailedMessage,
  PluginManualRecoveryMessage,
  PluginNotificationMessage,
  PluginReinstalledMessage,
  PluginSkippedMessage,
} from "../../shared/notify.ts";
import type { Scope } from "../../shared/types.ts";
import type {
  ReinstallFailedOutcome,
  ReinstallPluginOutcome,
  ReinstallReinstalledOutcome,
} from "../types.ts";

export type {
  ReinstallFailedOutcome,
  ReinstallPluginOutcome,
  ReinstallPluginPartition,
  ReinstallReinstalledOutcome,
  ReinstallSkippedOutcome,
} from "../types.ts";

type PluginRecord = ExtensionState["marketplaces"][string]["plugins"][string];
type BridgePhase = "skills" | "commands" | "agents" | "mcp";
type RemoveDataDirFn = (path: string, options: { recursive: true; force: true }) => Promise<void>;
type DropMarketplaceCacheFn = typeof dropMarketplaceCache;

export interface ReinstallPluginOptions {
  readonly ctx: ExtensionContext;
  readonly pi: ExtensionAPI;
  readonly scope: Scope;
  readonly cwd: string;
  readonly marketplace: string;
  readonly plugin: string;
  readonly render?: "default" | "none";
  /**
   * WB-01 / WB-02: when true, target
   * `claude-plugins.local.json` instead of `claude-plugins.json`. The base
   * file is NEVER touched on the --local path; loadConfig's `absent` arm
   * yields an empty starting shape that saveConfig writes back to the local
   * path.
   */
  readonly local?: boolean;
  /** @internal Test-only seams; production callers omit this. */
  readonly __deps?: ReinstallPluginDeps;
}

export interface ReinstallPluginDeps {
  readonly stateTransaction?: LockedStateTransactionDeps;
  readonly dropMarketplaceCache?: DropMarketplaceCacheFn;
  readonly removeDataDir?: RemoveDataDirFn;
}

export type ReinstallPluginsTarget =
  | { readonly kind: "all" }
  | { readonly kind: "marketplace"; readonly marketplace: string }
  | { readonly kind: "plugin"; readonly plugin: string; readonly marketplace: string };

export interface ReinstallPluginsOptions {
  readonly ctx: ExtensionContext;
  readonly pi: ExtensionAPI;
  readonly scope?: Scope;
  readonly cwd: string;
  readonly target: ReinstallPluginsTarget;
  /**
   * WB-01 / WB-02: when true, target
   * `claude-plugins.local.json` instead of `claude-plugins.json` for
   * write-back. The base file is NEVER touched on the --local path.
   */
  readonly local?: boolean;
}

interface PreparedHandles {
  readonly skills: PreparedSkillsStaging;
  readonly commands: PreparedCommandsStaging;
  readonly agents: PreparedAgentsStaging;
  readonly mcp: PreparedMcpStaging;
}

interface PartialPreparedHandles {
  skills?: PreparedSkillsStaging;
  commands?: PreparedCommandsStaging;
  agents?: PreparedAgentsStaging;
  mcp?: PreparedMcpStaging;
}

type ReplacementEntry =
  | { readonly phase: "skills"; readonly handle: SkillsReplacement }
  | { readonly phase: "commands"; readonly handle: CommandsReplacement }
  | { readonly phase: "agents"; readonly handle: AgentsReplacement }
  | { readonly phase: "mcp"; readonly handle: McpReplacement };

interface LockedSuccess {
  readonly outcome: ReinstallPluginOutcome;
  readonly bridgeWarnings: readonly string[];
  /**
   * S5: when the config-back loadConfig returned `invalid`, the write-back
   * was skipped while the success notify proceeded. The single-plugin caller
   * surfaces this as a separate warning row AFTER the reinstall success row
   * so the user knows the on-disk artefacts were reinstalled but the config
   * entry was not written.
   */
  readonly invalidConfigWriteBack?: boolean;
}

interface ResolvedReinstallTarget {
  readonly plugin: string;
  readonly marketplace: string;
  readonly scope: Scope;
}

// ATTR-03 / D-47-A: the structural marketplace-not-added signal thrown by the
// reinstall target enumerator is the shared `MarketplaceNotAddedSignal` from
// `./shared.ts` (one source of truth so `instanceof` agrees with update.ts).
// The `reinstallPlugins` enumeration catch detects it via `instanceof` and
// emits ONE standalone `MarketplaceNotAddedMessage` before any cascade row.

const defaultRemoveDataDir: RemoveDataDirFn = async (dataDir) => {
  await rm(dataDir, { recursive: true, force: true });
};

export async function reinstallPlugin(
  opts: ReinstallPluginOptions,
): Promise<ReinstallPluginOutcome> {
  const { ctx, pi, scope, cwd, marketplace, plugin } = opts;
  const render = opts.render ?? "default";
  const locations = locationsFor(scope, cwd);

  let locked: LockedSuccess;
  try {
    locked = await withLockedStateTransaction(
      locations,
      (tx) => runLockedReinstall(tx, locations, opts),
      opts.__deps?.stateTransaction,
    );
  } catch (err) {
    return handleSinglePluginFailure(opts, err, render);
  }

  if (locked.outcome.partition !== "reinstalled") {
    // CR-02 / D-01: the standalone single-plugin path must emit the absent-target
    // row, not return silently. A `skipped` partition is the "not installed" case
    // D-01 targets -> error; other skip reasons fall back to `skipSeverity`.
    // Mirrors the bulk `outcomeToPluginMessage` skipped arm.
    if (render !== "none") {
      const reasons = narrowReasons(locked.outcome.notes);
      const skippedRow: PluginSkippedMessage = {
        status: "skipped",
        name: plugin,
        reasons,
        severity: reasons.includes("not installed") ? "error" : skipSeverity(reasons),
        needsReload: false,
      };
      notifyWithContext(ctx, pi, REINSTALL_CONTEXT, [
        { name: marketplace, scope, plugins: [skippedRow] },
      ]);
    }

    return locked.outcome;
  }

  const maintenanceWarnings = await runPostSuccessMaintenance(opts, locations);
  if (render === "none") {
    const notes = [...locked.bridgeWarnings, ...maintenanceWarnings].map((w) => `warning: ${w}`);
    return notes.length === 0 ? locked.outcome : { ...locked.outcome, notes };
  }

  // IN-01: post-success soft warnings (bridge + maintenance) are NOT
  // surfaced -- there is no clean MarketplaceNotificationMessage
  // representation for a post-success soft warning. The underlying side
  // effects (cache drop + data-dir rm + bridge finalize) still fire above;
  // the orchestrated-mode `notes` field at the `render === "none"` arm still
  // carries the warning strings for consumers outside the notify path.
  // `maintenanceWarnings` is awaited strictly for its side effects.

  // Single-plugin reinstall success is a 1-row cascade carrying a
  // PluginReinstalledMessage variant; this branch and the bulk-cascade branch
  // both emit one notify() call with structured payloads. Severity (undefined
  // / info) + the `/reload to pick up changes` trailer are computed by
  // notify() -- the `reinstalled` status is in the state-changing variant set,
  // so the reload-hint always fires here.
  //
  // Per-row scope is OMITTED (orphan-fold) since it matches the
  // marketplace block's scope on the single-plugin surface.
  // IN-02: no `version !== ""` defensive spread. `resolvePluginVersion`
  // always returns a non-empty string. The renderer suppresses the
  // `v<version>` token on undefined / empty
  // anyway, so the behavior is preserved against the legacy-state-with-
  // empty-version case.
  const reinstalledRow: PluginReinstalledMessage = {
    status: "reinstalled",
    name: plugin,
    dependencies: dependenciesFromOutcome(locked.outcome),
    version: locked.outcome.version,
    // D-03/D-06: realized reinstall transition -> info, reloads Pi resources.
    severity: "info",
    needsReload: true,
  };
  notifyWithContext(ctx, pi, REINSTALL_CONTEXT, [
    { name: marketplace, scope, plugins: [reinstalledRow] },
  ]);

  // S5: when the config write-back loadConfig returned `invalid`, emit a
  // separate warning row so the user sees that the on-disk artefacts were
  // reinstalled but the config entry was not written. Pre-S5 this arm
  // silently dropped the warning while the success notify proceeded.
  if (locked.invalidConfigWriteBack === true) {
    const targetBasename = path.basename(
      opts.local === true ? locations.configLocalJsonPath : locations.configJsonPath,
    );
    notifyWithContext(ctx, pi, REINSTALL_CONTEXT, [
      {
        name: marketplace,
        scope,
        plugins: [
          {
            status: "failed",
            name: plugin,
            reasons: ["invalid manifest"] as const,
            cause: new Error(`Config file "${targetBasename}" failed schema validation.`),
            // D-03/D-06: invalid config write-back -> error, no reload.
            severity: "error" as const,
            needsReload: false,
          },
        ],
      },
    ]);
  }

  return locked.outcome;
}

/**
 * handle the single-plugin reinstall failure path. Extracted
 * from `reinstallPlugin` to keep that function's cognitive complexity
 * inside the sonarjs/cognitive-complexity ceiling (15). Produces both
 * the standalone-mode notify emission (when render !== "none") and
 * the orchestrated-mode `ReinstallFailedOutcome` (always returned).
 *
 * Manual-recovery class is a STRUCTURAL plugin variant
 * (`PluginManualRecoveryMessage`); other failures are
 * `PluginFailedMessage`. Severity + reload-hint computed by notify
 * .
 */
function handleSinglePluginFailure(
  opts: ReinstallPluginOptions,
  err: unknown,
  render: "default" | "none",
): ReinstallFailedOutcome {
  const { ctx, pi, scope, marketplace, plugin } = opts;

  // notify() owns the cause-chain trailer via the PluginFailedMessage /
  // PluginManualRecoveryMessage `cause?` field. The
  // `composeErrorWithCauseChain(err)` text still feeds the orchestrated-mode
  // `notes` field below (consumers outside the notify path).
  const message = composeErrorWithCauseChain(err);
  const causeErr = err instanceof Error ? err : new Error(errorMessage(err));
  const typedReasons = reasonsFromTypedError(err);
  const isManualRecovery = findManualRecoveryError(err) !== undefined;
  const reasons: readonly ContentReason[] = isManualRecovery
    ? (["rollback partial"] as const)
    : (typedReasons ?? narrowReasons([message]));

  if (render !== "none") {
    // Per-row scope is OMITTED (orphan-fold) since it matches the
    // marketplace block's scope at this single-plugin surface.
    const failureRow: PluginNotificationMessage = isManualRecovery
      ? ({
          status: "manual recovery",
          name: plugin,
          reasons,
          cause: causeErr,
          // D-03/D-06: manual-recovery anchor is always actionable -> warning,
          // no reload.
          severity: "warning",
          needsReload: false,
        } satisfies PluginManualRecoveryMessage)
      : ({
          status: "failed",
          name: plugin,
          reasons,
          cause: causeErr,
          // D-03/D-06: a failed reinstall -> error, no reload.
          severity: "error",
          needsReload: false,
        } satisfies PluginFailedMessage);
    notifyWithContext(ctx, pi, REINSTALL_CONTEXT, [
      { name: marketplace, scope, plugins: [failureRow] },
    ]);
  }

  return {
    partition: "failed",
    name: plugin,
    marketplace,
    scope,
    notes: [message],
    ...(isManualRecovery && { failureClass: "manual-recovery" as const }),
    ...(typedReasons !== undefined && { reasons: typedReasons }),
  };
}

export async function reinstallPlugins(
  opts: ReinstallPluginsOptions,
): Promise<readonly ReinstallPluginOutcome[]> {
  const { ctx, pi, cwd } = opts;

  let targets: readonly ResolvedReinstallTarget[];
  try {
    targets = await enumerateReinstallTargets(opts);
  } catch (err) {
    handleEnumerationFailure(opts, err);
    return [];
  }

  if (targets.length === 0) {
    // Empty-targets renders as the `(no marketplaces)` sentinel via
    // `{ marketplaces: [] }`. The structural shape carries no "(no plugins)"
    // sentinel at the top-level / standalone-cascade boundary; the closest
    // analog is the list-surface `(no marketplaces)` rendering. Severity:
    // undefined (info).
    notify(ctx, pi, { marketplaces: [] });
    return [];
  }

  const outcomes: ReinstallPluginOutcome[] = [];
  // OUT-04 / D-04: the structural single-vs-plural cardinality is the invocation
  // FORM -- a `<plugin>@<mp>` target is single-target (omits the tally), while
  // the `@<marketplace>` and bare forms are bulk (emit the tally).
  const cardinality: "single" | "plural" = opts.target.kind === "plugin" ? "single" : "plural";
  for (const target of targets) {
    try {
      outcomes.push(
        await reinstallPlugin({
          ctx,
          pi,
          scope: target.scope,
          cwd,
          marketplace: target.marketplace,
          plugin: target.plugin,
          render: "none",
          ...(opts.local === true && { local: true }),
        }),
      );
    } catch (err) {
      // `notes` is consumed outside the notify path; compose the trailer
      // inline. CMC-16: structural failure-class tag so
      // the cascade payload maps to `(failed) {rollback partial}` /
      // `(manual recovery) {rollback partial}` without substring-matching
      // the legacy ES-5 marker text in `notes`.
      //
      // ALSO pre-narrow the closed-set Reason via
      // `reasonsFromTypedError(err)` so EACCES / EPERM / ENOENT and the
      // typed error classes (PluginShapeError / ManualRecoveryError /
      // MarketplaceNotFoundError) surface as their precise closed Reason
      // instead of degrading to the permissive `not in manifest` fallback
      // inside `narrowReason`. When the typed dispatch returns
      // `undefined`, the consumer falls back to substring matching.
      const typedReasons = reasonsFromTypedError(err);
      outcomes.push({
        partition: "failed",
        name: target.plugin,
        marketplace: target.marketplace,
        scope: target.scope,
        notes: [composeErrorWithCauseChain(err)],
        ...(findManualRecoveryError(err) !== undefined && {
          failureClass: "manual-recovery" as const,
        }),
        ...(typedReasons !== undefined && { reasons: typedReasons }),
      });
    }
  }

  renderReinstallPartitionAndNotify(ctx, pi, outcomes, cardinality);
  return Object.freeze(outcomes);
}

/**
 * Emit the single `notify()` call for a target-enumeration failure. Extracted
 * from `reinstallPlugins` to keep that function's cognitive complexity inside
 * the sonarjs ceiling.
 *
 * Two arms:
 *   - ATTR-03 / D-47-A marketplace-not-added: the enumerator raised the
 *     structural `MarketplaceNotAddedSignal` (instead of synthesizing a phantom
 *     target or throwing a raw `MarketplaceNotFoundError`/`Error`). Emit ONE
 *     standalone top-level `MarketplaceNotAddedMessage` -- byte-identical to
 *     `info` and the install/uninstall plan (47-01) -- BEFORE any cascade row
 *     exists. The `requestedScope` (when present) renders the `[scope]` bracket
 *     (SCOPE-01); the bare both-scopes-miss form carries no bracket.
 *   - Any other enumeration failure: the legacy synthetic `(reinstall)` failed
 *     row. The failed entity is the targeting layer (no specific plugin), so
 *     the row carries a placeholder name `"(reinstall)"` under a synthetic
 *     marketplace name derived from the target (or `"(reinstall)"` for the
 *     bare-all form). A synthetic `PluginFailedMessage` carries the cause-chain
 *     trailer (marketplace-level rows carry no cause per SNM-10). Severity
 *     (`error`) + no reload-hint are computed by notify().
 */
function handleEnumerationFailure(opts: ReinstallPluginsOptions, err: unknown): void {
  const { ctx, pi } = opts;

  if (err instanceof MarketplaceNotAddedSignal) {
    notify(ctx, pi, {
      kind: "marketplace-not-added",
      name: err.marketplace,
      ...(err.requestedScope !== undefined && { scope: err.requestedScope }),
    });
    return;
  }

  const typedReasons = reasonsFromTypedError(err);
  const reasons: readonly ContentReason[] =
    typedReasons ?? narrowReasons([composeErrorWithCauseChain(err)]);
  const causeErr = err instanceof Error ? err : new Error(errorMessage(err));
  const targetingScope = opts.scope ?? "user";
  const targetingMp = opts.target.kind === "all" ? "(reinstall)" : opts.target.marketplace;
  const failedRow: PluginFailedMessage = {
    status: "failed",
    name: "(reinstall)",
    reasons,
    cause: causeErr,
    // D-03/D-06: bare-form reinstall enumerate failure -> error, no reload.
    severity: "error",
    needsReload: false,
  };
  notifyWithContext(ctx, pi, REINSTALL_CONTEXT, [
    { name: targetingMp, scope: targetingScope, plugins: [failedRow] },
  ]);
}

async function enumerateReinstallTargets(
  opts: ReinstallPluginsOptions,
): Promise<readonly ResolvedReinstallTarget[]> {
  const { cwd, target } = opts;
  const explicitScope = opts.scope;

  if (target.kind === "all") {
    return enumerateAllReinstallTargets(cwd, explicitScope);
  }

  return enumerateMarketplaceReinstallTargets(cwd, explicitScope, target);
}

async function enumerateAllReinstallTargets(
  cwd: string,
  explicitScope: Scope | undefined,
): Promise<readonly ResolvedReinstallTarget[]> {
  // Iteration order is project-first per MSG-GR-3 / compareByNameThenScope
  // so same-name cross-scope stable-sort ties render project-before-user.
  const scopes: readonly Scope[] =
    explicitScope === undefined ? ["project", "user"] : [explicitScope];
  const out: ResolvedReinstallTarget[] = [];
  for (const scope of scopes) {
    out.push(...(await installedTargetsForScope(cwd, scope)));
  }

  return sortReinstallTargets(out);
}

async function installedTargetsForScope(
  cwd: string,
  scope: Scope,
): Promise<readonly ResolvedReinstallTarget[]> {
  const state = await loadState(locationsFor(scope, cwd).extensionRoot);
  return Object.entries(state.marketplaces).flatMap(([marketplace, mp]) =>
    Object.keys(mp.plugins).map((plugin) => ({ plugin, marketplace, scope })),
  );
}

async function enumerateMarketplaceReinstallTargets(
  cwd: string,
  explicitScope: Scope | undefined,
  target: Extract<ReinstallPluginsTarget, { kind: "marketplace" | "plugin" }>,
): Promise<readonly ResolvedReinstallTarget[]> {
  const marketplace = target.marketplace;

  // ATTR-03 / D-47-A: probe marketplace existence STRUCTURALLY across the
  // three forms (explicit-scope-plugin, explicit-scope-marketplace, bare).
  // A miss raises `MarketplaceNotAddedSignal` -- caught at the
  // `reinstallPlugins` entrypoint and re-attributed to the standalone
  // `{not added}` variant -- instead of the former per-form divergence
  // (synthesized phantom target / raw `MarketplaceNotFoundError`/`Error`).
  const resolved = await resolveMarketplaceReinstallScope(cwd, marketplace, target, explicitScope);
  const state = await loadState(resolved.locations.extensionRoot);
  const mp = state.marketplaces[marketplace];
  if (mp === undefined) {
    // Defensive: `resolveMarketplaceReinstallScope` only returns a scope whose
    // container it confirmed present. A miss here is a concurrent-removal edge;
    // signal it as not-added carrying the resolved scope so the standalone
    // emission still fires (never a raw throw escaping the orchestrator).
    throw new MarketplaceNotAddedSignal(marketplace, explicitScope);
  }

  const plugins = target.kind === "plugin" ? [target.plugin] : Object.keys(mp.plugins);
  return sortReinstallTargets(
    plugins.map((plugin) => ({ plugin, marketplace, scope: resolved.scope })),
  );
}

/**
 * ATTR-03 / SCOPE-01: resolve the scope of an existing marketplace container
 * for the marketplace/plugin reinstall forms, raising
 * `MarketplaceNotAddedSignal` when the marketplace is not added.
 *
 *  - explicit-scope PLUGIN form: reuse the discriminated
 *    cross-scope resolver so an other-scope-only target yields the SCOPE-01
 *    hint (signal carrying the REQUESTED scope) rather than a synthesized
 *    `(skipped) {not installed}` phantom target.
 *  - explicit-scope MARKETPLACE form: confirm the container in the requested
 *    scope; on a miss, signal `{not added}` carrying the REQUESTED scope.
 *  - bare (no `--scope`) form: the existing two-scope `resolveScopeFromState`
 *    read establishes both-scope absence; on a miss, signal `{not added}`
 *    with NO bracket (absent-from-both form).
 *
 * All reads are `loadState` only (NFR-5: no network).
 */
async function resolveMarketplaceReinstallScope(
  cwd: string,
  marketplace: string,
  target: Extract<ReinstallPluginsTarget, { kind: "marketplace" | "plugin" }>,
  explicitScope: Scope | undefined,
): Promise<{ scope: Scope; locations: ReturnType<typeof locationsFor> }> {
  if (target.kind === "plugin") {
    // PLUGIN form (explicit OR bare): reuse the discriminated
    // cross-scope resolver. It resolves against the marketplace CONTAINER's
    // scope when present (so the downstream `runLockedReinstall` `oldRecord ===
    // undefined` branch keeps the legitimate `(skipped) {not installed}` for a
    // present-marketplace/absent-plugin), and surfaces SCOPE-01 /
    // marketplace-absence otherwise.
    const resolution = await resolveCrossScopePluginTarget({
      cwd,
      marketplace,
      plugin: target.plugin,
      ...(explicitScope !== undefined && { explicitScope }),
    });
    if (resolution.kind === "resolved") {
      return { scope: resolution.scope, locations: resolution.locations };
    }

    // marketplace-absent OR other-scope (present only in the other scope).
    // SCOPE-01: carry the REQUESTED scope (explicit form) so the `[scope]`
    // bracket reads "not added in the scope you asked for"; the bare form that
    // missed everywhere carries no bracket (resolution.requestedScope is
    // undefined there).
    throw new MarketplaceNotAddedSignal(marketplace, resolution.requestedScope);
  }

  // MARKETPLACE form.
  if (explicitScope !== undefined) {
    // WR-03: reuse the discriminated `resolveInstalledMarketplaceTarget` (the
    // resolver update.ts uses) so reinstall's explicit-scope cross-scope read
    // is consistent with update. Byte-neutral for the operator: a `resolved`
    // arm yields the same (scope, locations) the former inline guard returned;
    // both the `marketplace-absent` and `other-scope` arms (which carry the
    // REQUESTED scope) collapse to the same `{not added} [requestedScope]`
    // bracket-only emission per resolved Open Question #1.
    const resolution = await resolveInstalledMarketplaceTarget({
      cwd,
      marketplace,
      explicitScope,
    });
    if (resolution.kind === "resolved") {
      return { scope: resolution.scope, locations: resolution.locations };
    }

    throw new MarketplaceNotAddedSignal(marketplace, explicitScope);
  }

  try {
    return await resolveScopeFromState(
      marketplace,
      locationsFor("user", cwd),
      locationsFor("project", cwd),
    );
  } catch (err) {
    // resolveScopeFromState throws MarketplaceNotFoundError when absent from
    // BOTH scopes -- re-attribute to the no-bracket `{not added}` signal
    // (absent-from-both form). Any other error propagates unchanged.
    if (err instanceof MarketplaceNotFoundError) {
      throw new MarketplaceNotAddedSignal(marketplace);
    }

    throw err;
  }
}

function sortReinstallTargets(
  targets: readonly ResolvedReinstallTarget[],
): readonly ResolvedReinstallTarget[] {
  // CR-01 / D-01: route through the canonical comparator on marketplace
  // (primary) then plugin (secondary). Both keys carry the row's scope so
  // the project-before-user tie-break per MSG-GR-3 holds at every level.
  return Object.freeze(
    [...targets].sort((a, b) => {
      const mpDiff = compareByNameThenScope(
        { name: a.marketplace, scope: a.scope },
        { name: b.marketplace, scope: b.scope },
      );
      if (mpDiff !== 0) {
        return mpDiff;
      }

      return compareByNameThenScope(
        { name: a.plugin, scope: a.scope },
        { name: b.plugin, scope: b.scope },
      );
    }),
  );
}

/**
 * Render the bulk-reinstall outcome cascade as a single
 * `notify(ctx, pi, NotificationMessage)` call per orchestration.
 *
 * Shape per marketplace (catalog `/claude:plugin reinstall` cascade):
 *
 *  ● <mp> [<scope>]
 *    ● <plugin> v<version> (reinstalled) [{requires <dep>}]
 *    ⊘ <plugin> (skipped) {<reason>}
 *    ⊘ <plugin> (failed) {<reason>}
 *    ⊘ <plugin> (manual recovery) {rollback partial}
 *
 *  /reload to pick up changes
 *
 * - Marketplace headers carry `status: undefined` (the marketplace itself
 *   was NOT updated by reinstall; the header is a pure label).
 * - Manual-recovery outcomes are folded into the cascade `plugins[]` array
 *   as `PluginManualRecoveryMessage` variants.
 * - Severity + reload-hint are computed by notify().
 * - Per-marketplace iteration order is honored end-to-end: the orchestrator
 *   pre-sorts via `compareByNameThenScope`; notify() does NOT sort
 *   marketplaces[] or plugins[].
 */
// NotificationMessage cascade recipe:
// - One MarketplaceNotificationMessage per affected marketplace, emitted via
//   a single notify(ctx, pi, ...) call per orchestration.
// - plugins: readonly PluginNotificationMessage[] in display order
//   (orchestrator-controlled iteration; notify does not sort).
// - Discriminators by status: "reinstalled" / "skipped" / "failed" /
//   "manual recovery".
// - Severity + "/reload to pick up changes" trailer are computed by notify();
//   callers MUST NOT compose them.
// - Reference: catalog UAT plugin-reinstall fixtures.
function renderReinstallPartitionAndNotify(
  ctx: ExtensionContext,
  pi: ExtensionAPI,
  outcomes: readonly ReinstallPluginOutcome[],
  cardinality: "single" | "plural",
): void {
  // Group rows by (scope, marketplace) in input order. Two different scopes
  // for the same marketplace name render as two separate marketplace
  // blocks (CMC-21: per-scope rendering, no collapse).
  interface Block {
    readonly name: string;
    readonly scope: Scope;
    readonly outcomes: ReinstallPluginOutcome[];
  }
  const byMp = new Map<string, Block>();
  for (const outcome of outcomes) {
    const key = `${outcome.scope}:${outcome.marketplace}`;
    const existing = byMp.get(key);
    if (existing === undefined) {
      byMp.set(key, {
        name: outcome.marketplace,
        scope: outcome.scope,
        outcomes: [outcome],
      });
    } else {
      existing.outcomes.push(outcome);
    }
  }

  // Order marketplace blocks via compareByNameThenScope (name primary
  // case-insensitive, scope secondary project-before-user per MSG-GR-3).
  // the orchestrator owns the sort; notify does not reorder.
  const sortedBlocks = [...byMp.values()].sort((a, b) =>
    compareByNameThenScope({ name: a.name, scope: a.scope }, { name: b.name, scope: b.scope }),
  );

  // OUT-07 / D-12: the reinstall cascade is a bulk op, so its row slot is typed
  // `Plural<Row>` (a readonly array). Additive typing only -- a fresh
  // variable-length array, identical at runtime.
  // WR-01: the per-block plugin rows are built through the `outcomeToPluginMessage`
  // helper, now typed to `ReinstallMsg`, so the `MarketplaceRows<ReinstallMsg>`
  // annotation holds without a cast -- a status drift between the producer and
  // the render map is a compile error here.
  const marketplaces: Plural<MarketplaceRows<ReinstallMsg>> = sortedBlocks.map((block) => {
    const plugins: ReinstallMsg[] = block.outcomes.map((o) =>
      outcomeToPluginMessage(o, block.scope),
    );
    return { name: block.name, scope: block.scope, plugins };
  });

  // OUT-04 / D-04: the trailing per-operation tally renders only for the bulk
  // (`@marketplace` / bare) reinstall forms; a single-target `<plugin>@<mp>`
  // reinstall omits it (the row embeds the outcome). The structural
  // single-vs-plural signal is the invocation FORM, threaded from
  // `reinstallPlugins`.
  notifyWithContext(ctx, pi, REINSTALL_CONTEXT, marketplaces, undefined, cardinality);
}

/**
 * Test binding seam: exported under the `__test_*` prefix
 * so the cascade-emission regression test in
 * tests/orchestrators/plugin/reinstall.test.ts can verify the cascade
 * payload structure (including the folded-in manual-recovery row) without
 * forcing a real `ManualRecoveryError` through the bridges (which would
 * require fs-permission / saveState dep injection plumbing through
 * `reinstallPlugins`, which does not propagate `__deps`).
 */
export { renderReinstallPartitionAndNotify as __test_renderReinstallPartitionAndNotify };

/**
 * Type guard narrowing a `ReinstallPluginOutcome` to the `failed` variant
 * tagged with `failureClass: "manual-recovery"`. Used to route manual-
 * recovery outcomes to the `PluginManualRecoveryMessage` variant instead
 * of `PluginFailedMessage` in the cascade payload.
 */
function isManualRecoveryOutcome(
  outcome: ReinstallPluginOutcome,
): outcome is ReinstallFailedOutcome & { readonly failureClass: "manual-recovery" } {
  return outcome.partition === "failed" && outcome.failureClass === "manual-recovery";
}

/**
 * Map a `ReinstallPluginOutcome` to its `PluginNotificationMessage`
 * representation. The variant set covers `reinstalled` / `skipped` /
 * `failed` / `manual recovery` per the catalog states.
 *
 * Reason-token mapping precedence (failed/manual-recovery variants):
 *  (1) failureClass=manual-recovery -> `["rollback partial"]`
 *  (2) typed `outcome.reasons` (set at the catch site via
 *  `reasonsFromTypedError(err)`) -> verbatim
 *  (3) substring parse on `notes` via `narrowReasons` -> legacy fallback
 *
 * Orphan-fold scope-bracket suppression: per-row `scope?` is
 * OMITTED when it matches the marketplace's scope. The renderer's
 * `renderScopeBracket` contract at `shared/notify.ts` suppresses
 * `[<scope>]` brackets when the row's scope is absent.
 */
function outcomeToPluginMessage(
  outcome: ReinstallPluginOutcome,
  marketplaceScope: Scope,
): ReinstallMsg {
  const rowScope = outcome.scope === marketplaceScope ? undefined : outcome.scope;
  switch (outcome.partition) {
    case "reinstalled": {
      // CMC-13: `declaresAgents` / `declaresMcp` are
      // required booleans. Map to the `dependencies: Dependency[]`
      // tuple per SNM-06. The renderer's per-row soft-dep probe
      // fires `{requires pi-subagents}` / `{requires pi-mcp}` markers
      // when the companion extension is unloaded.
      const dependencies = dependenciesFromOutcome(outcome);
      return {
        status: "reinstalled",
        name: outcome.name,
        dependencies,
        ...(outcome.version !== "" && { version: outcome.version }),
        ...(rowScope !== undefined && { scope: rowScope }),
        // D-03/D-06: realized reinstall transition -> info, reloads Pi resources.
        severity: "info",
        needsReload: true,
      };
    }

    case "skipped": {
      const reasons = narrowReasons(outcome.notes);
      const skipped: PluginSkippedMessage = {
        status: "skipped",
        name: outcome.name,
        reasons,
        ...(rowScope !== undefined && { scope: rowScope }),
        // D-01: an absent-target reinstall (the named plugin is not installed)
        // cannot be carried out -> error (severity-only flip; the `(skipped)
        // {not installed}` per-row grammar is preserved). Otherwise benign
        // idempotent skip -> info, actionable skip -> warning; never reloads.
        severity: reasons.includes("not installed") ? "error" : skipSeverity(reasons),
        needsReload: false,
      };
      return skipped;
    }

    case "failed": {
      // CMC-16: structural failure-class tag takes priority over
      // the substring match on `notes` for the manual-recovery
      // class. Manual-recovery is STRUCTURALLY a
      // `PluginManualRecoveryMessage` variant, NOT a
      // `PluginFailedMessage` with a `{rollback partial}` reason. The
      // status discriminator is the literal `"manual recovery"` WITH a
      // space per shared/grammar/status-tokens.ts:47.
      //
      // Reason precedence (locked):
      //  (1) failureClass=manual-recovery -> ["rollback partial"]
      //  (2) typed outcome.reasons -> verbatim
      //  (3) narrowReasons(outcome.notes) -> substring fallback
      // WR-04: `narrowReasons([])` and `narrowReasons(undefined)` both return
      // `[]`, which would render a failed row with no `{<reason>}` brace. Guard
      // with the `"unreadable"` fallback (ATTR-09 / D-47-B) so a failed row never
      // renders bare.
      const narrowed: readonly ContentReason[] = isManualRecoveryOutcome(outcome)
        ? (["rollback partial"] as const)
        : (outcome.reasons ?? narrowReasons(outcome.notes));
      const reasons: readonly ContentReason[] =
        narrowed.length > 0 ? narrowed : (["unreadable"] as const);

      if (isManualRecoveryOutcome(outcome)) {
        const manualRecovery: PluginManualRecoveryMessage = {
          status: "manual recovery",
          name: outcome.name,
          reasons,
          ...(rowScope !== undefined && { scope: rowScope }),
          // D-03/D-06: manual-recovery anchor is always actionable -> warning,
          // no reload.
          severity: "warning",
          needsReload: false,
        };
        return manualRecovery;
      }

      const failed: PluginFailedMessage = {
        status: "failed",
        name: outcome.name,
        reasons,
        ...(rowScope !== undefined && { scope: rowScope }),
        // D-03/D-06: a failed reinstall -> error, no reload.
        severity: "error",
        needsReload: false,
      };
      return failed;
    }

    default:
      return assertNever(outcome);
  }
}

/**
 * Test seam exported under the `__test_*` prefix for the closed-set Reason
 * mapping regression tests. The mapping precedence is manual-recovery > typed
 * reasons > narrowReasons fallback, producing `PluginNotificationMessage`
 * variants.
 */
export { outcomeToPluginMessage as __test_outcomeToPluginMessage };

/**
 * Map a `ReinstallReinstalledOutcome`'s `declaresAgents` / `declaresMcp`
 * predicate flags to the `Dependency[]` tuple consumed by
 * `PluginReinstalledMessage.dependencies` per SNM-06. The
 * renderer's per-row soft-dep probe iterates this array to emit
 * `{requires pi-subagents}` / `{requires pi-mcp}` markers when the
 * companion extension is unloaded (MSG-SD-1..2).
 */
function dependenciesFromOutcome(outcome: ReinstallReinstalledOutcome): readonly Dependency[] {
  const deps: Dependency[] = [];
  if (outcome.declaresAgents) {
    deps.push("agents");
  }

  if (outcome.declaresMcp) {
    deps.push("mcp");
  }

  return Object.freeze(deps);
}

/**
 * Closed-set narrowing for skipped/failed outcome notes. Maps the legacy
 * free-form notes to the closed `Reason` set (CMC-11). Unrecognized text
 * falls back to `"unreadable"` (ATTR-09 / D-47-B: a truthful "could not
 * read/reconcile this row" member, never a false manifest-absence claim) when
 * the underlying cause is opaque.
 *
 * The mapping is intentionally narrow -- production code paths that
 * generate notes have known shapes (`"not installed"`, `"not in
 * manifest"`, `MarketplaceNotFoundError.message`, raw `Error.message`
 * from cached-manifest read). catalog UAT is the binding
 * verification that the mapped reason set is sufficient.
 */
function narrowReasons(notes: readonly string[] | undefined): readonly ContentReason[] {
  if (notes === undefined || notes.length === 0) {
    return [];
  }

  const reasons: ContentReason[] = [];
  for (const note of notes) {
    reasons.push(narrowReason(note));
  }

  return Object.freeze(reasons);
}

function narrowReason(note: string): ContentReason {
  // Exact-match first. Order: cheapest predicate to most expensive.
  if (note === "not installed") {
    return "not installed";
  }

  if (note === "not in manifest") {
    return "not in manifest";
  }

  if (note === "up-to-date") {
    return "up-to-date";
  }

  if (note === "already installed") {
    return "already installed";
  }

  // Substring matches for common synthetic messages.
  if (note.includes("not found in cached manifest")) {
    return "not in manifest";
  }

  if (note.includes("not found")) {
    return "not found";
  }

  // CMC-16: the orchestrator's catch blocks set the structural
  // `failureClass: "manual-recovery"` tag on the failed outcome, consumed by
  // `outcomeToPluginMessage`'s closed-set Reason mapping. This narrowing path
  // remains for non-manual-recovery rollback scenarios.
  if (note.includes("rollback")) {
    return "rollback partial";
  }

  // ATTR-09 / D-47-B: last-resort fallback for a genuinely unrecognized note.
  // The cascade could not read/reconcile the on-disk state for this row;
  // `"unreadable"` is the truthful existing member. The former
  // `"not in manifest"` LIED that the plugin was absent from the manifest for
  // any cascade/IO failure whose typed dispatch (`reasonsFromTypedError`)
  // missed. No new `REASONS` member is introduced (ContentReason only).
  return "unreadable";
}

/**
 * Typed-dispatch narrow for thrown errors captured by the reinstall catch
 * sites. Mirrors the
 * `orchestrators/marketplace/remove.ts::narrowCascadeFailure` pattern:
 * check the typed `PluginShapeError` / `ManualRecoveryError` /
 * `MarketplaceNotFoundError` shape first, then errno codes
 * (`EACCES`/`EPERM` -> permission denied; `ENOENT`/`ENOTDIR` ->
 * source missing), and only at the bottom fall through to `undefined`
 * (NOT a misleading closed-set member). When `undefined` is returned,
 * the consumer (`outcomeToPluginMessage`) falls back to the
 * `narrowReasons(notes)` substring parse.
 *
 * Returning `undefined` for unknown shapes is deliberate: the consumer
 * has more context (the full `notes` array) and may extract a better
 * Reason via substring matching. Forcing a default Reason here would
 * shadow that fallback.
 */
function reasonsFromTypedError(err: unknown): readonly ContentReason[] | undefined {
  if (err instanceof PluginShapeError) {
    // switch on `err.shape.kind` so a future
    // shape variant addition fails at compile time (the discriminator
    // is the typed shape's field, not the convenience top-level
    // shortcut).
    switch (err.shape.kind) {
      case "no-longer-installable":
        return ["no longer installable"] as const;
      case "not-installable":
        // Source classification changed since install -- the catalog
        // form is `(failed) {source mismatch}` for that case.
        return ["source mismatch"] as const;
      case "not-in-manifest":
        return ["not in manifest"] as const;
      case "already-installed":
        return ["already installed"] as const;
    }
  }

  if (err instanceof ManualRecoveryError) {
    return ["rollback partial"] as const;
  }

  // IN-03: dead defensive coverage. Post-WR-03 the marketplace-existence case
  // no longer reaches here -- `resolveScopeFromState`'s `MarketplaceNotFoundError`
  // is caught inside `resolveMarketplaceReinstallScope` and re-attributed to the
  // no-bracket `MarketplaceNotAddedSignal`. Kept (NOT removed) so any FUTURE
  // `MarketplaceNotFoundError` that slips through a different code path still maps
  // to a typed `{not found}` reason rather than degrading to the `narrowReasons`
  // substring fallback. No live non-mp-existence caller exists today.
  if (err instanceof MarketplaceNotFoundError) {
    return ["not found"] as const;
  }

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

async function runLockedReinstall(
  tx: LockedStateTransaction,
  locations: ScopedLocations,
  opts: ReinstallPluginOptions,
): Promise<LockedSuccess> {
  const { scope, cwd, marketplace, plugin } = opts;
  const mp = tx.state.marketplaces[marketplace];
  const oldRecord = mp?.plugins[plugin];
  if (mp === undefined || oldRecord === undefined) {
    return {
      outcome: { partition: "skipped", name: plugin, marketplace, scope, notes: ["not installed"] },
      bridgeWarnings: [],
    };
  }

  const oldSnapshot = clonePluginRecord(oldRecord);
  const entry = await loadCachedEntry(mp.manifestPath, marketplace, plugin);
  const installable = await resolveInstallable(entry, mp.marketplaceRoot);
  const generated = await discoverGeneratedNames(plugin, installable);
  assertNoCrossPluginConflicts(
    scope,
    { skills: generated.skills, commands: generated.commands, agents: generated.agents },
    removePluginRecord(tx.state, marketplace, plugin),
  );

  const pluginDataDir = await locations.pluginDataDir(marketplace, plugin);
  const handles = await prepareAllHandles({
    locations,
    cwd,
    marketplace,
    plugin,
    installable,
    pluginDataDir,
    oldRecord: oldSnapshot,
    agentsSourceDir: generated.agentsSourceDir,
  });
  const replacements = await replaceAll(handles, {
    locations,
    cwd,
    plugin,
    installable,
  });

  let invalidConfigWriteBack: boolean;
  try {
    updateStateRecord(tx.state, marketplace, plugin, oldSnapshot, installable, handles);

    // WB-01 / A7: deep-equal short-circuit preserves RECON-05
    // mtime invariant. Reinstall is invoked by the user (both standalone and
    // bulk-cascade paths are user-initiated); there is no orchestrated /
    // reconcile-driven caller today. The deep-equal gate compares the
    // prospective `{...existing, ...patch}` shape against the existing
    // entry; a byte-stable patch (the common reinstall case -- entry shape
    // unchanged) leaves the config file untouched.
    const writeResult = await maybeWritePluginConfigBack({
      locations,
      marketplace,
      plugin,
      local: opts.local === true,
    });
    invalidConfigWriteBack = writeResult.invalidConfig;

    await tx.save();

    // WR-06 + WR-03 + D-60-05: reinstall does NOT delegate to install/
    // uninstall, so the parsed-config cache + routing table would
    // otherwise stay pinned to the OLD plugin's hooks config (or be
    // entirely absent if the previous install pre-dated the bridge).
    // Mirror the install / uninstall pattern explicitly inside the
    // per-plugin lock: drop the old cache entry, re-populate from the
    // just-installed `hooks.json` (when present), then rebuild the
    // routing table once.
    //
    // Moved AFTER `tx.save()` so a write-back throw or a tx.save throw
    // aborts BEFORE the cache mutates -- otherwise a phantom routing
    // entry survives a closure throw and the next dispatch fires against
    // a record state.json never wrote.  Post-save semantics are safe:
    // state.json now matches in-memory state, and the next `/reload`'s
    // factory-time hydrate (D-59-03) rebuilds the cache from disk.
    // Synchronous + zero disk I/O per DISP-02; the readFile/parse path
    // is the same defensive shape `install.ts` uses (failures route
    // through hookDebugLog and the next `/reload` rehydrates).
    //
    // WR-03: post-`tx.save()` cache+routing mutations are non-fatal --
    // mirrors install.ts's WR-02. A throw here would surface as
    // `(manual recovery)` while state.json already persisted the new
    // record (state divergence). `/reload`'s factory-time hydrate
    // (D-59-03) rebuilds the cache from state.json. Failures route
    // through `hookDebugLog`.
    try {
      removePluginConfigFromCache(scope, marketplace, plugin);
      if (installable.hooksConfigPath !== undefined) {
        await readAndCachePluginHooks({
          scope,
          marketplace,
          plugin,
          resolvedSource: asAbsolutePluginRoot(installable.pluginRoot),
          hooksJsonPath: path.join(installable.pluginRoot, installable.hooksConfigPath),
          cwd,
          logPrefix: "reinstall",
        });
      }

      rebuildRoutingTables();
    } catch (cacheErr) {
      hookDebugLog(
        `reinstall: post-save cache/routing mutation failed for ${plugin}@${marketplace}: ${errorMessage(cacheErr)}`,
      );
    }
  } catch (err) {
    throw errorWithManualRecovery(err, await rollbackReplacements(replacements));
  }

  const bridgeWarnings = [
    ...collectStagingWarnings(handles),
    ...(await finalizeReplacements(replacements)),
  ];
  return {
    outcome: successOutcome(scope, marketplace, plugin, oldSnapshot, handles),
    bridgeWarnings,
    ...(invalidConfigWriteBack && { invalidConfigWriteBack: true }),
  };
}

async function loadCachedEntry(
  manifestPath: string,
  marketplace: string,
  plugin: string,
): Promise<PluginEntry> {
  const manifest = await loadMarketplaceManifest(manifestPath);
  const entryRaw = manifest.plugins.find((p) => p.name === plugin);
  if (entryRaw === undefined) {
    throw new Error(
      `Plugin "${plugin}" not found in cached manifest for marketplace "${marketplace}".`,
    );
  }

  if (!PLUGIN_ENTRY_VALIDATOR.Check(entryRaw)) {
    throw new Error(
      `Plugin entry for "${plugin}" in marketplace "${marketplace}" failed schema validation.`,
    );
  }

  return entryRaw;
}

// BFILL-01 / D-68-02: reinstall is force-capable. It resolves through the
// `requireForceInstallable` gate (admitting both `installable` and the
// force-degradable `unsupported` arm) so backfill can re-materialize a
// still-partial plugin in place without throwing `{not-installable}`. The
// `unavailable` arm is still rejected (NFR-7). Resolution stays cache-only via
// `resolveStrict` -- no network (NFR-5).
async function resolveInstallable(
  entry: PluginEntry,
  marketplaceRoot: string,
): Promise<MaterializablePlugin> {
  const resolved = await resolveStrict(entry, { marketplaceRoot });
  requireForceInstallable(resolved, "install");
  return resolved;
}

async function prepareAllHandles(input: {
  readonly locations: ScopedLocations;
  readonly cwd: string;
  readonly marketplace: string;
  readonly plugin: string;
  readonly installable: MaterializablePlugin;
  readonly pluginDataDir: string;
  readonly oldRecord: PluginRecord;
  readonly agentsSourceDir: string | null;
}): Promise<PreparedHandles> {
  const handles: PartialPreparedHandles = {};
  try {
    handles.skills = await prepareStageSkills({
      locations: input.locations,
      marketplaceName: input.marketplace,
      pluginName: input.plugin,
      pluginRoot: input.installable.pluginRoot,
      pluginDataDir: input.pluginDataDir,
      resolved: input.installable,
      previousSkillNames: input.oldRecord.resources.skills,
    });
    handles.commands = await prepareStageCommands({
      locations: input.locations,
      marketplaceName: input.marketplace,
      pluginName: input.plugin,
      pluginRoot: input.installable.pluginRoot,
      pluginDataDir: input.pluginDataDir,
      resolved: input.installable,
      previousCommandNames: input.oldRecord.resources.prompts,
    });
    handles.agents = await prepareStagePluginAgents({
      locations: input.locations,
      marketplaceName: input.marketplace,
      pluginName: input.plugin,
      pluginRoot: input.installable.pluginRoot,
      pluginDataDir: input.pluginDataDir,
      resolved: input.installable,
      agentsSourceDir: input.agentsSourceDir,
      knownSkills: handles.skills.result.recorded.map((r) => r.generatedName),
    });
    handles.mcp = await prepareStageMcpServers({
      locations: input.locations,
      cwd: input.cwd,
      marketplaceName: input.marketplace,
      pluginName: input.plugin,
      servers: input.installable.mcpServers,
      sourcePath: `${input.installable.pluginRoot}#mcpServers`,
    });
  } catch (err) {
    throw errorWithManualRecovery(err, await abortPartialHandles(handles));
  }

  return handles as PreparedHandles;
}

async function replaceAll(
  handles: PreparedHandles,
  hooks: HooksReplaceArgs,
): Promise<readonly ReplacementEntry[]> {
  const replacements: ReplacementEntry[] = [];
  try {
    const skills = await replacePreparedSkills(handles.skills);
    replacements.push({ phase: "skills", handle: skills });
    const commands = await replacePreparedCommands(handles.commands);
    replacements.push({ phase: "commands", handle: commands });
    // RINST-01 / D-67-03: reinstall is a pure repair primitive -- overwrite of
    // collisions and foreign content is UNCONDITIONAL. The agents bridge's
    // `{ force: true }` gate is always set; there is no command-local `--force`
    // option to relay. Containment is unchanged (NFR-10): the overwrite is
    // scoped to this plugin's own staged agent handles.
    const agents = await replacePreparedAgents(handles.agents, { force: true });
    replacements.push({ phase: "agents", handle: agents });
    // LIFE-01 / D-63-01: 5th cascade slot between agents and mcp. The hooks
    // bridge has no staging dir per D-63-02; writeHookConfig IS the atomic
    // write. NOT pushed onto `replacements[]` -- the hooks file STAYS IN
    // PLACE on a later-step failure (recovery is via the reinstall hint,
    // not in-process rollback, mirroring update.ts D-03 semantics).
    //
    // WR-05: the hooks-removed-then-later-step-failed
    // window is a known manual-recovery case. When installable.hooksConfigPath
    // is undefined, commitHooks() calls removeHookConfig() to clean up any
    // stale subtree from the prior install. If that succeeds and a later
    // step (mcp replace, state save) THROWS, the catch's
    // `rollbackReplacements` walk below cannot restore the hooks file --
    // and since `replacements[]`
    // has no hooks entry, no in-process restore is possible. The
    // in-memory state still holds the OLD resources.hooks: [plugin]
    // slug, the throw routes through errorWithManualRecovery without
    // saving, and the user-visible row is (manual recovery). On the
    // next /reload, the dispatcher's routing table is rebuilt from
    // the still-old state.json and points at a now-deleted hooks file.
    // The manual-recovery hint directs the user to re-run reinstall,
    // which re-resolves version B (no hooks) and persists the truthful
    // state. The same recovery contract applies to update.ts (see
    // WR-01 documentation there).
    await commitHooks(hooks);
    const mcp = await replacePreparedMcp(handles.mcp);
    replacements.push({ phase: "mcp", handle: mcp });
  } catch (err) {
    const leaks = [...(await rollbackReplacements(replacements)), ...(await abortHandles(handles))];
    throw errorWithManualRecovery(err, leaks);
  }

  return Object.freeze(replacements);
}

interface HooksReplaceArgs {
  readonly locations: ScopedLocations;
  readonly cwd: string;
  readonly plugin: string;
  readonly installable: MaterializablePlugin;
}

/**
 * LIFE-01 hooks-bridge atomic write/remove during reinstall's replace step.
 * When the resolved plugin advertises hooksConfigPath, re-read + re-parse the
 * on-disk hooks.json (mirroring `install.ts:340-360`) and call writeHookConfig.
 * When the resolved plugin has no hooks, remove any stale subtree (defensive
 * cleanup of an artefact a prior install left behind).
 */
async function commitHooks(args: HooksReplaceArgs): Promise<void> {
  const { locations, cwd, plugin, installable } = args;
  if (installable.hooksConfigPath === undefined) {
    await removeHookConfig({ locations, pluginName: plugin });
    return;
  }

  const raw = await readFile(
    path.join(installable.pluginRoot, installable.hooksConfigPath),
    "utf8",
  );
  const ifCtx = { homedir: homedir(), cwd, projectRoot: cwd };
  const parsed = parseHooksConfig(raw, ifCtx, compileIfPredicate);
  if (!parsed.ok) {
    throw new Error(`hooks.json re-parse failed: ${parsed.reason}`);
  }

  await writeHookConfig({
    locations,
    pluginName: plugin,
    pluginRoot: installable.pluginRoot,
    hooksValue: parsed.value,
  });
}

function updateStateRecord(
  state: ExtensionState,
  marketplace: string,
  plugin: string,
  oldRecord: PluginRecord,
  installable: MaterializablePlugin,
  handles: PreparedHandles,
): void {
  const mp = state.marketplaces[marketplace];
  if (mp?.plugins[plugin] === undefined) {
    throw new Error(
      `Plugin "${plugin}" was concurrently removed from marketplace "${marketplace}".`,
    );
  }

  mp.plugins[plugin] = {
    // D-68-02: SAME recorded version -- reinstall/backfill is a repair/promotion,
    // never an upgrade.
    version: oldRecord.version,
    resolvedSource: installable.pluginRoot,
    // BFILL-01: record the REAL compatibility from the resolve, not a hardcoded
    // `installable: true`. A partial re-materialize (resolved `unsupported`)
    // persists `installable: false` with the still-unsupported set, so the
    // force-installed derivation (D-66-01) stays truthful; a full one records
    // `installable: true` with an empty unsupported set.
    compatibility: {
      installable: installable.state === "installable",
      notes: [...installable.notes],
      supported: [...installable.supported],
      unsupported: [...installable.unsupported],
    },
    resources: resourcesFromHandles(handles, plugin, installable),
    enabled: true,
    installedAt: oldRecord.installedAt,
    updatedAt: new Date().toISOString(),
  };
}

function resourcesFromHandles(
  handles: PreparedHandles,
  plugin?: string,
  installable?: MaterializablePlugin,
): PluginRecord["resources"] {
  return {
    skills: handles.skills.result.recorded.map((r) => r.generatedName),
    prompts: handles.commands.result.recorded.map((r) => r.generatedName),
    agents: handles.agents.result.recorded.map((r) => r.generatedName),
    mcpServers: handles.mcp.result.recorded.map((r) => r.generatedName),
    // HOOK-02 / D-57-01: additive required field. WR-03: mirror install.ts
    // -- when the resolver advertises a hooks config, record the plugin's
    // id as the slug so `rebuildRoutingTables`' state walk (gated on
    // `resources.hooks.length > 0`) visits this plugin and pulls its
    // refreshed `parsedConfigCache` entry into the routing table without
    // requiring `/reload` (NFR-2). The `successOutcome` caller only needs
    // the agents / mcpServers entries from this record, so it omits the
    // `plugin` / `installable` args and the hooks inventory stays empty
    // for that path (no state write occurs there either).
    hooks: plugin !== undefined && installable?.hooksConfigPath !== undefined ? [plugin] : [],
  };
}

function successOutcome(
  scope: Scope,
  marketplace: string,
  plugin: string,
  oldRecord: PluginRecord,
  handles: PreparedHandles,
): ReinstallReinstalledOutcome {
  const resources = resourcesFromHandles(handles);
  // CMC-13: surface effective-state per-row soft-dep
  // predicates so cascade rendering can emit `{requires pi-subagents}` /
  // `{requires pi-mcp}` iff (declares AND companion unloaded). The
  // predicate is satisfied iff the plugin's reinstall actually staged
  // resources of that kind (i.e. the resolved manifest declared them AND
  // they materialized). Probing companion-loaded state is the
  // renderer's job via the injected SoftDepProbe.
  return {
    partition: "reinstalled",
    name: plugin,
    marketplace,
    scope,
    version: oldRecord.version,
    stagedAgents: resources.agents,
    stagedMcpServers: resources.mcpServers,
    declaresAgents: resources.agents.length > 0,
    declaresMcp: resources.mcpServers.length > 0,
    resourcesChanged: resourcesChanged(oldRecord.resources, resources),
  };
}

function resourcesChanged(
  oldResources: PluginRecord["resources"],
  next: PluginRecord["resources"],
): boolean {
  return (
    next.skills.length > 0 ||
    next.prompts.length > 0 ||
    next.agents.length > 0 ||
    next.mcpServers.length > 0 ||
    !sameStrings(oldResources.skills, next.skills) ||
    !sameStrings(oldResources.prompts, next.prompts) ||
    !sameStrings(oldResources.agents, next.agents) ||
    !sameStrings(oldResources.mcpServers, next.mcpServers)
  );
}

function sameStrings(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function collectStagingWarnings(handles: PreparedHandles): readonly string[] {
  return Object.freeze([
    ...handles.skills.result.warnings,
    ...handles.commands.result.warnings,
    ...handles.agents.result.warnings,
    ...handles.mcp.result.warnings,
  ]);
}

async function abortPartialHandles(handles: PartialPreparedHandles): Promise<readonly string[]> {
  const leaks: string[] = [];
  if (handles.mcp !== undefined) {
    abortPreparedMcp(handles.mcp);
  }

  if (handles.agents !== undefined) {
    pushLeak(leaks, "agents", await abortPreparedAgents(handles.agents));
  }

  if (handles.commands !== undefined) {
    pushLeak(leaks, "commands", await abortPreparedCommands(handles.commands));
  }

  if (handles.skills !== undefined) {
    pushLeak(leaks, "skills", await abortPreparedSkills(handles.skills));
  }

  return Object.freeze(leaks);
}

async function abortHandles(handles: PreparedHandles): Promise<readonly string[]> {
  return abortPartialHandles(handles);
}

async function rollbackReplacements(
  replacements: readonly ReplacementEntry[],
): Promise<readonly string[]> {
  const leaks: string[] = [];
  for (const replacement of [...replacements].reverse()) {
    try {
      for (const leak of await rollbackReplacement(replacement)) {
        leaks.push(`${replacement.phase}: ${leak}`);
      }
    } catch (err) {
      leaks.push(`${replacement.phase}: rollback threw: ${errorMessage(err)}`);
    }
  }

  return Object.freeze(leaks);
}

async function rollbackReplacement(entry: ReplacementEntry): Promise<readonly string[]> {
  switch (entry.phase) {
    case "skills":
      return rollbackSkillsReplacement(entry.handle);
    case "commands":
      return rollbackCommandsReplacement(entry.handle);
    case "agents":
      return rollbackAgentsReplacement(entry.handle);
    case "mcp":
      return rollbackMcpReplacement(entry.handle);
  }
}

async function finalizeReplacements(
  replacements: readonly ReplacementEntry[],
): Promise<readonly string[]> {
  const leaks: string[] = [];
  for (const replacement of replacements) {
    try {
      for (const leak of await finalizeReplacement(replacement)) {
        leaks.push(`${replacement.phase}: ${leak}`);
      }
    } catch (err) {
      leaks.push(`${replacement.phase}: finalize threw: ${errorMessage(err)}`);
    }
  }

  return Object.freeze(leaks);
}

async function finalizeReplacement(entry: ReplacementEntry): Promise<readonly string[]> {
  switch (entry.phase) {
    case "skills":
      return finalizeSkillsReplacement(entry.handle);
    case "commands":
      return finalizeCommandsReplacement(entry.handle);
    case "agents":
      return finalizeAgentsReplacement(entry.handle);
    case "mcp":
      return finalizeMcpReplacement(entry.handle);
  }
}

/**
 * CMC-16: wrap an error with bridge-rollback leak data.
 *
 * Short-circuits to the original error when no leaks accumulated (the
 * zero-leak fast path). Otherwise constructs a
 * `ManualRecoveryError` carrying the merged leak set via `Error.cause` so
 * the depth-5 `causeChainTrailer` walker surfaces the original error text
 * at the notify boundary.
 *
 * Merge semantics: when the incoming `err` is already a
 * `ManualRecoveryError` (e.g. a bridge threw and this helper is wrapping
 * at the orchestrator level), the leaks arrays are merged via
 * `Set`-dedup. This binds the F-5 no-double-count invariant for the
 * counterexample case where the bridge-source leak set and the
 * orchestrator-source leak set happen to overlap (structurally possible
 * if a `rollbackReplacements` cascade re-reports a leak the inner bridge
 * already surfaced).
 */
function errorWithManualRecovery(err: unknown, leaks: readonly string[]): Error {
  if (leaks.length === 0) {
    return err instanceof Error ? err : new Error(errorMessage(err));
  }

  if (err instanceof ManualRecoveryError) {
    const merged = Object.freeze([...new Set([...err.leaks, ...leaks])]);
    return new ManualRecoveryError(err.message, merged, { cause: err });
  }

  const base = err instanceof Error ? err : new Error(errorMessage(err));
  return new ManualRecoveryError(base.message, leaks, { cause: base });
}

/**
 * CMC-16 / F-5 binding seam: exported under the `__test_*`
 * prefix so the dedicated F-5 dedup regression test in
 * tests/orchestrators/plugin/reinstall.test.ts can verify the
 * no-double-count invariant on the merged `.leaks` payload directly
 * without forcing a contrived bridge cascade.
 *
 * Placement note (WR-02): this re-export sits BELOW the function
 * declaration so its JSDoc does not orphan the primary contract JSDoc on
 * `errorWithManualRecovery` from the IDE hover-doc binding.
 */
export { errorWithManualRecovery as __test_errorWithManualRecovery };

/**
 * CMC-16 / WR-01: walk the `Error.cause` chain (bounded to
 * depth 5, mirroring `causeChainTrailer`'s DoS-mitigation budget at
 * `shared/errors.ts::causeChainTrailer`) to find a `ManualRecoveryError`
 * anywhere in the chain.
 *
 * Why this exists (regression context): `withScopeLock` (in
 * `transaction/with-state-guard.ts:138-143`) wraps a body-thrown error with a
 * plain `new Error(..., { cause: body })` when BOTH the body throw AND
 * `release` also throw. A bare `err instanceof ManualRecoveryError` at the
 * orchestrator catch then sees the plain wrapper and silently downgrades the
 * cascade row's Reason from `{rollback partial}` to `{not in manifest}`
 * (`narrowReason` fallback). Walking `.cause` recovers the class identity
 * the wrapping discarded, so the structural CMC-16 `failureClass:
 * "manual-recovery"` tag survives the lock-release-also-failed path.
 *
 * Depth/cycle bounds match `causeChainTrailer`: stop at 5 hops, and bail if
 * a link's `.cause` references itself.
 */
function findManualRecoveryError(err: unknown): ManualRecoveryError | undefined {
  let current: unknown = err;
  for (let depth = 0; depth < 5; depth++) {
    if (current instanceof ManualRecoveryError) {
      return current;
    }

    if (!(current instanceof Error) || current.cause === undefined || current.cause === current) {
      return undefined;
    }

    current = current.cause;
  }

  return undefined;
}

/**
 * CMC-16 / WR-01 binding seam: exported under the
 * `__test_*` prefix so the regression guard in
 * tests/orchestrators/plugin/reinstall.test.ts can directly exercise the
 * release-also-failed wrapping path without standing up a real
 * `withScopeLock` fixture.
 *
 * Placement note (WR-02): this re-export sits BELOW the function
 * declaration so its JSDoc does not orphan the primary contract JSDoc.
 */
export { findManualRecoveryError as __test_findManualRecoveryError };

function pushLeak(leaks: string[], phase: BridgePhase, leak: string | undefined): void {
  if (leak !== undefined) {
    leaks.push(`${phase}: ${leak}`);
  }
}

async function runPostSuccessMaintenance(
  opts: ReinstallPluginOptions,
  locations: ScopedLocations,
): Promise<readonly string[]> {
  const { scope, marketplace, plugin } = opts;
  const warnings: string[] = [];
  const cacheDrop = opts.__deps?.dropMarketplaceCache ?? dropMarketplaceCache;
  try {
    await cacheDrop(await locations.pluginCacheFile(marketplace), scope, marketplace);
  } catch (err) {
    warnings.push(
      `Plugin "${plugin}" reinstalled; completion cache refresh deferred: ${errorMessage(err)}`,
    );
  }

  const dataDir = await locations.pluginDataDir(marketplace, plugin);
  const removeDataDir = opts.__deps?.removeDataDir ?? defaultRemoveDataDir;
  try {
    await removeDataDir(dataDir, { recursive: true, force: true });
  } catch (err) {
    warnings.push(
      `Plugin "${plugin}" reinstalled; data cleanup deferred at ${dataDir}: ${errorMessage(err)}`,
    );
  }

  return Object.freeze(warnings);
}

function clonePluginRecord(record: PluginRecord): PluginRecord {
  return {
    version: record.version,
    resolvedSource: record.resolvedSource,
    compatibility: {
      installable: record.compatibility.installable,
      notes: [...record.compatibility.notes],
      supported: [...record.compatibility.supported],
      unsupported: [...record.compatibility.unsupported],
    },
    resources: {
      skills: [...record.resources.skills],
      prompts: [...record.resources.prompts],
      agents: [...record.resources.agents],
      mcpServers: [...record.resources.mcpServers],
      // HOOK-02 / D-57-01: clone the additive required hooks inventory verbatim.
      hooks: [...record.resources.hooks],
    },
    enabled: record.enabled,
    installedAt: record.installedAt,
    updatedAt: record.updatedAt,
  };
}

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

  const plugins = { ...mp.plugins };
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- cloned record map is local to the guard helper.
  delete plugins[plugin];
  cloned.marketplaces[marketplace] = { ...mp, plugins };
  return cloned;
}

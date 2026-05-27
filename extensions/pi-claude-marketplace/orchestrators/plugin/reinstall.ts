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
// Phase 19 / Plan 19-04: this file emits exactly one V2 `notify(ctx, pi, ...)`
// call per orchestration arm. The V1 severity-named wrappers
// (notifySuccess/notifyWarning/notifyError) and the presentation/* composers
// (cascadeSummary / renderManualRecovery / renderRow / appendReloadHint /
// reloadHint / composeErrorWithCauseChain on the notify path) are GONE for
// the notify boundary. The V1 dispatch ternary that picked notifyWarning vs
// notifySuccess based on aggregated cascade severity is REMOVED -- V2
// notify() owns severity per D-16-11. The separate top-level manual-recovery
// emission (V1 `renderManualRecovery` + dispatch) is FOLDED INTO the cascade
// `plugins[]` array as a `PluginManualRecoveryMessage` row per D-19-02.
// The two V1 post-success notifyWarning loops (bridgeWarnings +
// maintenanceWarnings) are DROPPED per D-19-01: the V2
// MarketplaceNotificationMessage type has no field to surface post-success
// soft warnings; the underlying side effects (dropMarketplaceCache + rm)
// still run, and the internal `notes` field on `ReinstallPluginOutcome`
// (orchestrated-mode consumers) still carries the warning strings -- only
// the standalone-mode user-facing notifyWarning surface is gone.
//
// See the construction recipe block-comment above the surviving main-cascade
// notify() call site for the Plan 19-01 pilot recipe (mirrored here).

import { rm } from "node:fs/promises";

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
import { PLUGIN_ENTRY_VALIDATOR, type PluginEntry } from "../../domain/components/plugin.ts";
import { loadMarketplaceManifest } from "../../domain/manifest.ts";
import { requireInstallable, resolveStrict } from "../../domain/resolver.ts";
import { locationsFor } from "../../persistence/locations.ts";
import { loadState } from "../../persistence/state-io.ts";
import { composeErrorWithCauseChain } from "../../presentation/cause-chain.ts";
import { compareByNameThenScope } from "../../presentation/sort.ts";
import { dropMarketplaceCache } from "../../shared/completion-cache.ts";
import {
  assertNever,
  errorMessage,
  ManualRecoveryError,
  MarketplaceNotFoundError,
  PluginShapeError,
} from "../../shared/errors.ts";
import { notify } from "../../shared/notify.ts";
import {
  withLockedStateTransaction,
  type LockedStateTransaction,
  type LockedStateTransactionDeps,
} from "../../transaction/with-state-guard.ts";
import { resolveScopeFromState } from "../marketplace/shared.ts";

import { discoverGeneratedNames } from "./discover-names.ts";
import { assertNoCrossPluginConflicts, resolveInstalledPluginTarget } from "./shared.ts";

import type { AgentsReplacement, PreparedAgentsStaging } from "../../bridges/agents/index.ts";
import type { CommandsReplacement, PreparedCommandsStaging } from "../../bridges/commands/index.ts";
import type { McpReplacement, PreparedMcpStaging } from "../../bridges/mcp/index.ts";
import type { PreparedSkillsStaging, SkillsReplacement } from "../../bridges/skills/index.ts";
import type { ResolvedPluginInstallable } from "../../domain/resolver.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { ExtensionState } from "../../persistence/state-io.ts";
import type { ExtensionAPI, ExtensionContext } from "../../platform/pi-api.ts";
import type { Reason } from "../../shared/grammar/reasons.ts";
import type {
  Dependency,
  MarketplaceNotificationMessage,
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
  readonly force?: boolean;
  readonly render?: "default" | "none";
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
  readonly force?: boolean;
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
}

interface ResolvedReinstallTarget {
  readonly plugin: string;
  readonly marketplace: string;
  readonly scope: Scope;
}

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
    return locked.outcome;
  }

  const maintenanceWarnings = await runPostSuccessMaintenance(opts, locations);
  if (render === "none") {
    const notes = [...locked.bridgeWarnings, ...maintenanceWarnings].map((w) => `warning: ${w}`);
    return notes.length === 0 ? locked.outcome : { ...locked.outcome, notes };
  }

  // D-19-01 precedent (D-18-01 lineage): the two V1 post-success
  // notifyWarning loops (over bridgeWarnings + maintenanceWarnings) are
  // DROPPED in V2. The underlying side effects (cache drop + data-dir rm
  // + bridge finalize) still fire; the orchestrated-mode `notes` field
  // above still carries the warning strings for consumers outside the
  // notify path; only the standalone-mode user-visible warning surface
  // is gone (no clean MarketplaceNotificationMessage representation for
  // a post-success soft warning). `maintenanceWarnings` is awaited
  // strictly for its side effects.
  void locked.bridgeWarnings;
  void maintenanceWarnings;

  // Plan 19-04 / D-19-02: single-plugin reinstall success is a 1-row
  // cascade carrying a PluginReinstalledMessage variant. The legacy
  // `cascadeSummary` call at the explicit single-plugin-reinstall surface
  // is RETIRED -- this branch and the bulk-cascade branch both emit a V2
  // notify() with structured payloads. Severity (undefined / info) +
  // `/reload to pick up changes` trailer are computed by notify() per
  // D-16-11 + D-16-12 (the `reinstalled` status is in the state-changing
  // variant set, so the reload-hint always fires here).
  //
  // Per-row scope is OMITTED (orphan-fold) since it matches the
  // marketplace block's scope on the single-plugin surface.
  const reinstalledRow: PluginReinstalledMessage = {
    status: "reinstalled",
    name: plugin,
    dependencies: dependenciesFromOutcome(locked.outcome),
    ...(locked.outcome.version !== "" && { version: locked.outcome.version }),
  };
  notify(ctx, pi, {
    marketplaces: [{ name: marketplace, scope, plugins: [reinstalledRow] }],
  });
  return locked.outcome;
}

/**
 * Plan 19-04: handle the single-plugin reinstall failure path. Extracted
 * from `reinstallPlugin` to keep that function's cognitive complexity
 * inside the sonarjs/cognitive-complexity ceiling (15). Produces both
 * the V2 standalone-mode notify() emission (when render !== "none") and
 * the orchestrated-mode `ReinstallFailedOutcome` (always returned).
 *
 * Manual-recovery class is a STRUCTURAL plugin variant per D-19-02
 * (`PluginManualRecoveryMessage`); other failures are
 * `PluginFailedMessage`. Severity + reload-hint computed by notify()
 * per D-16-11 + D-16-12.
 */
function handleSinglePluginFailure(
  opts: ReinstallPluginOptions,
  err: unknown,
  render: "default" | "none",
): ReinstallFailedOutcome {
  const { ctx, pi, scope, marketplace, plugin } = opts;

  // Plan 19-04: V2 notify() owns the cause-chain trailer via the
  // PluginFailedMessage / PluginManualRecoveryMessage `cause?` field
  // per D-16-08. The legacy `composeErrorWithCauseChain(err)` text
  // still feeds the orchestrated-mode `notes` field below (consumers
  // outside the notify path).
  const message = composeErrorWithCauseChain(err);
  const causeErr = err instanceof Error ? err : new Error(errorMessage(err));
  const typedReasons = reasonsFromTypedError(err);
  const isManualRecovery = findManualRecoveryError(err) !== undefined;
  const reasons: readonly Reason[] = isManualRecovery
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
        } satisfies PluginManualRecoveryMessage)
      : ({
          status: "failed",
          name: plugin,
          reasons,
          cause: causeErr,
        } satisfies PluginFailedMessage);
    notify(ctx, pi, {
      marketplaces: [{ name: marketplace, scope, plugins: [failureRow] }],
    });
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
    // Plan 19-04 / D-19-02: enumeration-failure path emits a single V2
    // notify() call. The failed entity is the targeting layer (no
    // specific plugin), so the row carries a placeholder name
    // `"(reinstall)"` and the marketplace block sits under a synthetic
    // marketplace name derived from the target (or `"(reinstall)"` for
    // the bare-all form). Severity (`error`) + no reload-hint computed
    // by notify() per D-16-11 + D-16-12.
    //
    // Claude's Discretion (CONTEXT line 110): we use a synthetic
    // PluginFailedMessage rather than a marketplace-level failure shape
    // because the renderer's failed-row form carries the cause-chain
    // trailer needed for the underlying MarketplaceNotFoundError text
    // (V1 surfaced that text via notifyError's auto-appended trailer).
    const typedReasons = reasonsFromTypedError(err);
    const reasons: readonly Reason[] =
      typedReasons ?? narrowReasons([composeErrorWithCauseChain(err)]);
    const causeErr = err instanceof Error ? err : new Error(errorMessage(err));
    const targetingScope = opts.scope ?? "user";
    const targetingMp = opts.target.kind === "all" ? "(reinstall)" : opts.target.marketplace;
    const failedRow: PluginFailedMessage = {
      status: "failed",
      name: "(reinstall)",
      reasons,
      cause: causeErr,
    };
    notify(ctx, pi, {
      marketplaces: [{ name: targetingMp, scope: targetingScope, plugins: [failedRow] }],
    });
    return [];
  }

  if (targets.length === 0) {
    // Plan 19-04 / D-19-02: empty-targets renders as the V2
    // `(no marketplaces)` sentinel via `{ marketplaces: [] }`. This is
    // a deliberate byte change from V1's `(no plugins)` empty-row form
    // (renderRow({kind: "empty", token: "no plugins"})) -- V2's
    // structural shape carries no "(no plugins)" sentinel at the
    // top-level / standalone-cascade boundary; the closest analog is
    // the list-surface `(no marketplaces)` rendering at
    // docs/output-catalog.md:139-145. Severity: undefined (info).
    notify(ctx, pi, { marketplaces: [] });
    return [];
  }

  const outcomes: ReinstallPluginOutcome[] = [];
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
          ...(opts.force === undefined ? {} : { force: opts.force }),
        }),
      );
    } catch (err) {
      // `notes` is consumed outside the notify path; compose the trailer
      // inline. Plan 13-02a-02 / CMC-16: structural failure-class tag so
      // the cascade payload maps to `(failed) {rollback partial}` /
      // `(manual recovery) {rollback partial}` without substring-matching
      // the legacy ES-5 marker text in `notes`.
      //
      // Task 260525-cjr B2: ALSO pre-narrow the closed-set Reason via
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

  renderReinstallPartitionAndNotify(ctx, pi, outcomes);
  return Object.freeze(outcomes);
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

async function resolveReinstallScope(
  cwd: string,
  marketplace: string,
  target: Extract<ReinstallPluginsTarget, { kind: "marketplace" | "plugin" }>,
  explicitScope: Scope | undefined,
): Promise<{ scope: Scope; locations: ReturnType<typeof locationsFor> }> {
  if (target.kind === "plugin" && explicitScope === undefined) {
    return (
      (await resolveInstalledPluginTarget({ cwd, marketplace, plugin: target.plugin })) ?? {
        scope: "user" as const,
        locations: locationsFor("user", cwd),
      }
    );
  }

  if (explicitScope !== undefined) {
    return { scope: explicitScope, locations: locationsFor(explicitScope, cwd) };
  }

  return resolveScopeFromState(
    marketplace,
    locationsFor("user", cwd),
    locationsFor("project", cwd),
  );
}

async function enumerateMarketplaceReinstallTargets(
  cwd: string,
  explicitScope: Scope | undefined,
  target: Extract<ReinstallPluginsTarget, { kind: "marketplace" | "plugin" }>,
): Promise<readonly ResolvedReinstallTarget[]> {
  const marketplace = target.marketplace;
  const resolved = await resolveReinstallScope(cwd, marketplace, target, explicitScope);
  const state = await loadState(resolved.locations.extensionRoot);
  const mp = state.marketplaces[marketplace];
  if (mp === undefined) {
    if (explicitScope !== undefined) {
      if (target.kind === "plugin") {
        return sortReinstallTargets([{ plugin: target.plugin, marketplace, scope: explicitScope }]);
      }

      throw new MarketplaceNotFoundError(marketplace, [explicitScope]);
    }

    throw new Error(`Marketplace "${marketplace}" not found in ${resolved.scope} scope.`);
  }

  const plugins = target.kind === "plugin" ? [target.plugin] : Object.keys(mp.plugins);
  return sortReinstallTargets(
    plugins.map((plugin) => ({ plugin, marketplace, scope: resolved.scope })),
  );
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
 * Plan 19-04 / D-19-02: render the bulk-reinstall outcome cascade as a
 * single V2 `notify(ctx, pi, NotificationMessage)` call per orchestration.
 *
 * Shape per marketplace (catalog `/claude:plugin reinstall` cascade, see
 * docs/output-catalog.md:380-486 for the 7 binding states):
 *
 *     ● <mp> [<scope>]
 *       ● <plugin> v<version> (reinstalled) [{requires <dep>}]
 *       ⊘ <plugin> (skipped) {<reason>}
 *       ⊘ <plugin> (failed) {<reason>}
 *       ⊘ <plugin> (manual recovery) {rollback partial}
 *
 *     /reload to pick up changes
 *
 * - Marketplace headers carry `status: undefined` (the marketplace itself
 *   was NOT updated by reinstall; the header is a pure label).
 * - Manual-recovery outcomes are folded into the cascade `plugins[]` array
 *   as `PluginManualRecoveryMessage` variants per D-19-02. The V1
 *   separate top-level emission via `renderManualRecovery` is GONE.
 * - Severity + reload-hint computed by notify() per D-16-11 + D-16-12;
 *   the V1 dispatch ternary (aggregatedSeverity ? notifyWarning :
 *   notifySuccess) is REMOVED.
 * - Per-marketplace iteration order honored end-to-end per D-16-06: the
 *   orchestrator pre-sorts via `compareByNameThenScope`; notify() does
 *   NOT sort marketplaces[] or plugins[].
 */
// NotificationMessage cascade recipe (Plan 19-01 pilot; Wave 2 mirrors).
// - One MarketplaceNotificationMessage per affected marketplace, emitted
//   via a single notify(ctx, pi, ...) call per orchestration.
// - plugins: readonly PluginNotificationMessage[] in display order
//   (orchestrator-controlled iteration per D-16-06; notify() does not sort).
// - Discriminators by status: "reinstalled" / "skipped" / "failed" /
//   "manual recovery" here. Plans 19-02..05 mirror with their own status
//   sets: installed/updated/reinstalled/failed/skipped/manual recovery/
//   available/unavailable/upgradable.
// - Severity + "/reload to pick up changes" trailer are computed by notify()
//   per D-16-11 + D-16-12; callers MUST NOT compose them.
// - Reference: catalog UAT plugin-reinstall fixtures at docs/output-catalog.md:380-486.
//
// V2 cascade construction mirrors the Plan 19-01 pilot recipe at
// orchestrators/plugin/uninstall.ts; reinstall.ts substitutes the cascade
// variant set (reinstalled / skipped / failed / manual recovery) per
// D-19-02 and folds manual-recovery into the plugins[] array.
function renderReinstallPartitionAndNotify(
  ctx: ExtensionContext,
  pi: ExtensionAPI,
  outcomes: readonly ReinstallPluginOutcome[],
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
  // D-16-06: the orchestrator owns the sort; notify() does not reorder.
  const sortedBlocks = [...byMp.values()].sort((a, b) =>
    compareByNameThenScope({ name: a.name, scope: a.scope }, { name: b.name, scope: b.scope }),
  );

  const marketplaces: MarketplaceNotificationMessage[] = sortedBlocks.map((block) => {
    const plugins: PluginNotificationMessage[] = block.outcomes.map(
      (o): PluginNotificationMessage => outcomeToPluginMessage(o, block.scope),
    );
    return { name: block.name, scope: block.scope, plugins };
  });

  notify(ctx, pi, { marketplaces });
}

/**
 * Plan 19-04 / D-19-02 binding seam: exported under the `__test_*` prefix
 * so the cascade-emission regression test in
 * tests/orchestrators/plugin/reinstall.test.ts can verify the V2 cascade
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
 * of `PluginFailedMessage` in the cascade payload per D-19-02.
 */
function isManualRecoveryOutcome(
  outcome: ReinstallPluginOutcome,
): outcome is ReinstallFailedOutcome & { readonly failureClass: "manual-recovery" } {
  return outcome.partition === "failed" && outcome.failureClass === "manual-recovery";
}

/**
 * Plan 19-04 / D-19-02: map a `ReinstallPluginOutcome` to its V2
 * `PluginNotificationMessage` representation. Replaces V1's
 * `outcomeToCascadeRow` which produced a `PluginCascadeRow` (presentation-
 * layer V1 row type). The variant set covers `reinstalled` / `skipped` /
 * `failed` / `manual recovery` per the 7 catalog states at
 * docs/output-catalog.md:380-486.
 *
 * Reason-token mapping precedence (failed/manual-recovery variants):
 *   (1) failureClass=manual-recovery -> `["rollback partial"]`
 *   (2) typed `outcome.reasons` (set at the catch site via
 *       `reasonsFromTypedError(err)`) -> verbatim
 *   (3) substring parse on `notes` via `narrowReasons` -> legacy fallback
 *
 * Orphan-fold scope-bracket suppression (Phase 17.2): per-row `scope?` is
 * OMITTED when it matches the marketplace's scope. The renderer's
 * `renderScopeBracket` contract at `shared/notify.ts` suppresses
 * `[<scope>]` brackets when the row's scope is absent.
 */
function outcomeToPluginMessage(
  outcome: ReinstallPluginOutcome,
  marketplaceScope: Scope,
): PluginNotificationMessage {
  const rowScope = outcome.scope === marketplaceScope ? undefined : outcome.scope;
  switch (outcome.partition) {
    case "reinstalled": {
      // CMC-13 / Task 260525-cjr B1: `declaresAgents` / `declaresMcp` are
      // required booleans. Map to the V2 `dependencies: Dependency[]`
      // tuple per SNM-06 / D-15-02. The renderer's per-row soft-dep probe
      // fires `{requires pi-subagents}` / `{requires pi-mcp}` markers
      // when the companion extension is unloaded.
      const dependencies = dependenciesFromOutcome(outcome);
      return {
        status: "reinstalled",
        name: outcome.name,
        dependencies,
        ...(outcome.version !== "" && { version: outcome.version }),
        ...(rowScope !== undefined && { scope: rowScope }),
      };
    }

    case "skipped": {
      const reasons = narrowReasons(outcome.notes);
      const skipped: PluginSkippedMessage = {
        status: "skipped",
        name: outcome.name,
        reasons,
        ...(rowScope !== undefined && { scope: rowScope }),
      };
      return skipped;
    }

    case "failed": {
      // Plan 13-02a-02 / CMC-16: structural failure-class tag supersedes
      // the legacy substring match on `notes` for the manual-recovery
      // class. Plan 19-04 / D-19-02 expands this: manual-recovery is
      // STRUCTURALLY a `PluginManualRecoveryMessage` variant, NOT a
      // `PluginFailedMessage` with a `{rollback partial}` reason. The
      // status discriminator is the literal `"manual recovery"` WITH a
      // space per shared/grammar/status-tokens.ts:47.
      //
      // Reason precedence (locked):
      //   (1) failureClass=manual-recovery -> ["rollback partial"]
      //   (2) typed outcome.reasons        -> verbatim
      //   (3) narrowReasons(outcome.notes) -> substring fallback
      const reasons: readonly Reason[] = isManualRecoveryOutcome(outcome)
        ? (["rollback partial"] as const)
        : (outcome.reasons ?? narrowReasons(outcome.notes));

      if (isManualRecoveryOutcome(outcome)) {
        const manualRecovery: PluginManualRecoveryMessage = {
          status: "manual recovery",
          name: outcome.name,
          reasons,
          ...(rowScope !== undefined && { scope: rowScope }),
        };
        return manualRecovery;
      }

      const failed: PluginFailedMessage = {
        status: "failed",
        name: outcome.name,
        reasons,
        ...(rowScope !== undefined && { scope: rowScope }),
      };
      return failed;
    }

    default:
      return assertNever(outcome);
  }
}

/**
 * Plan 19-04 / D-19-02 binding seam: exported under the `__test_*` prefix
 * for the closed-set Reason mapping regression tests. The mapping covers
 * the same closed-set narrowing rules as V1's `outcomeToCascadeRow`
 * (manual-recovery > typed reasons > narrowReasons fallback) but produces
 * V2 `PluginNotificationMessage` variants instead of V1's
 * `PluginCascadeRow`.
 */
export { outcomeToPluginMessage as __test_outcomeToPluginMessage };

/**
 * Map a `ReinstallReinstalledOutcome`'s `declaresAgents` / `declaresMcp`
 * predicate flags to the V2 `Dependency[]` tuple consumed by
 * `PluginReinstalledMessage.dependencies` per SNM-06 / D-15-02. The
 * renderer's per-row soft-dep probe iterates this array to emit
 * `{requires pi-subagents}` / `{requires pi-mcp}` markers when the
 * companion extension is unloaded (MSG-SD-1..2 / D-13-07).
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
 * falls back to `"not in manifest"` (the most permissive cascade reason
 * matching the catalog's `(skipped) {not in manifest}` form when the
 * underlying cause is opaque).
 *
 * The mapping is intentionally narrow -- production code paths that
 * generate notes have known shapes (`"not installed"`, `"not in
 * manifest"`, `MarketplaceNotFoundError.message`, raw `Error.message`
 * from cached-manifest read). Wave 3 catalog UAT is the binding
 * verification that the mapped reason set is sufficient.
 */
function narrowReasons(notes: readonly string[] | undefined): readonly Reason[] {
  if (notes === undefined || notes.length === 0) {
    return [];
  }

  const reasons: Reason[] = [];
  for (const note of notes) {
    reasons.push(narrowReason(note));
  }

  return Object.freeze(reasons);
}

function narrowReason(note: string): Reason {
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

  // Plan 13-02a-02 / CMC-16: the legacy substring branches that mapped
  // the retired manual-recovery marker text to `"rollback partial"` are
  // RETIRED. The orchestrator's catch blocks now set the structural
  // `failureClass: "manual-recovery"` tag on the failed outcome
  // (consumed by `outcomeToCascadeRow`'s closed-set Reason mapping);
  // see Plan 13-02a-02 Task 2 Step 5. This narrowing path remains for
  // non-manual-recovery rollback scenarios.
  if (note.includes("rollback")) {
    return "rollback partial";
  }

  // Fallback: surface as "not in manifest" -- this is the catalog's
  // most-permissive cascade skip reason and matches the operator mental
  // model "we couldn't reconcile this row".
  return "not in manifest";
}

/**
 * Task 260525-cjr B2: typed-dispatch narrow for thrown errors captured
 * by the reinstall catch sites. Mirrors the
 * `orchestrators/marketplace/remove.ts::narrowCascadeFailure` pattern:
 * check the typed `PluginShapeError` / `ManualRecoveryError` /
 * `MarketplaceNotFoundError` shape first, then errno codes
 * (`EACCES`/`EPERM` -> permission denied; `ENOENT`/`ENOTDIR` ->
 * source missing), and only at the bottom fall through to `undefined`
 * (NOT a misleading closed-set member). When `undefined` is returned,
 * the consumer (`outcomeToCascadeRow`) falls back to the legacy
 * `narrowReasons(notes)` substring parse.
 *
 * Returning `undefined` for unknown shapes is deliberate: the consumer
 * has more context (the full `notes` array) and may extract a better
 * Reason via substring matching. Forcing a default Reason here would
 * shadow that fallback.
 */
function reasonsFromTypedError(err: unknown): readonly Reason[] | undefined {
  if (err instanceof PluginShapeError) {
    // Task 260525-cjr C4: switch on `err.shape.kind` so a future
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
  const { scope, cwd, marketplace, plugin, force } = opts;
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
  const replacements = await replaceAll(handles, force);

  try {
    updateStateRecord(tx.state, marketplace, plugin, oldSnapshot, installable, handles);
    await tx.save();
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

async function resolveInstallable(
  entry: PluginEntry,
  marketplaceRoot: string,
): Promise<ResolvedPluginInstallable> {
  const resolved = await resolveStrict(entry, { marketplaceRoot });
  requireInstallable(resolved, "install");
  return resolved;
}

async function prepareAllHandles(input: {
  readonly locations: ScopedLocations;
  readonly cwd: string;
  readonly marketplace: string;
  readonly plugin: string;
  readonly installable: ResolvedPluginInstallable;
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
  force: boolean | undefined,
): Promise<readonly ReplacementEntry[]> {
  const replacements: ReplacementEntry[] = [];
  try {
    const skills = await replacePreparedSkills(handles.skills);
    replacements.push({ phase: "skills", handle: skills });
    const commands = await replacePreparedCommands(handles.commands);
    replacements.push({ phase: "commands", handle: commands });
    const agents = await replacePreparedAgents(
      handles.agents,
      force === undefined ? {} : { force },
    );
    replacements.push({ phase: "agents", handle: agents });
    const mcp = await replacePreparedMcp(handles.mcp);
    replacements.push({ phase: "mcp", handle: mcp });
  } catch (err) {
    const leaks = [...(await rollbackReplacements(replacements)), ...(await abortHandles(handles))];
    throw errorWithManualRecovery(err, leaks);
  }

  return Object.freeze(replacements);
}

function updateStateRecord(
  state: ExtensionState,
  marketplace: string,
  plugin: string,
  oldRecord: PluginRecord,
  installable: ResolvedPluginInstallable,
  handles: PreparedHandles,
): void {
  const mp = state.marketplaces[marketplace];
  if (mp?.plugins[plugin] === undefined) {
    throw new Error(
      `Plugin "${plugin}" was concurrently removed from marketplace "${marketplace}".`,
    );
  }

  mp.plugins[plugin] = {
    version: oldRecord.version,
    resolvedSource: installable.pluginRoot,
    compatibility: {
      installable: true,
      notes: [...installable.notes],
      supported: [...installable.supported],
      unsupported: [...installable.unsupported],
    },
    resources: resourcesFromHandles(handles),
    installedAt: oldRecord.installedAt,
    updatedAt: new Date().toISOString(),
  };
}

function resourcesFromHandles(handles: PreparedHandles): PluginRecord["resources"] {
  return {
    skills: handles.skills.result.recorded.map((r) => r.generatedName),
    prompts: handles.commands.result.recorded.map((r) => r.generatedName),
    agents: handles.agents.result.recorded.map((r) => r.generatedName),
    mcpServers: handles.mcp.result.recorded.map((r) => r.generatedName),
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
  // Plan 13-02a-01 / CMC-13: surface effective-state per-row soft-dep
  // predicates so cascade rendering can emit `{requires pi-subagents}` /
  // `{requires pi-mcp}` iff (declares AND companion unloaded). The
  // predicate is satisfied iff the plugin's reinstall actually staged
  // resources of that kind (i.e. the resolved manifest declared them AND
  // they materialized). D-13-07: probing companion-loaded state is the
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
 * Plan 13-02a-02 / CMC-16: wrap an error with bridge-rollback leak data.
 *
 * Short-circuits to the original error when no leaks accumulated (preserves
 * the pre-migration zero-leak fast path). Otherwise constructs a
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
 * Plan 13-02a-02 / CMC-16 / F-5 binding seam: exported under the `__test_*`
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
 * Plan 13-02a-02 / CMC-16 / WR-01: walk the `Error.cause` chain (bounded to
 * depth 5, mirroring `causeChainTrailer`'s DoS-mitigation budget at
 * `shared/errors.ts::causeChainTrailer`) to find a `ManualRecoveryError`
 * anywhere in the chain.
 *
 * Why this exists (regression context): `withScopeLock` (in
 * `transaction/with-state-guard.ts:138-143`) wraps a body-thrown error with a
 * plain `new Error(..., { cause: body })` when BOTH the body throw AND
 * `release()` also throw. A bare `err instanceof ManualRecoveryError` at the
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
 * Plan 13-02a-02 / CMC-16 / WR-01 binding seam: exported under the
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
    },
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

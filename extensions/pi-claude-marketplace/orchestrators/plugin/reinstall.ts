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
import { softDepStatus } from "../../platform/pi-api.ts";
import { cascadeSummary } from "../../presentation/cascade-summary.ts";
import { causeChainTrailer } from "../../presentation/cause-chain.ts";
import { renderRow } from "../../presentation/compact-line.ts";
import { renderManualRecovery } from "../../presentation/manual-recovery.ts";
import { appendReloadHint, reloadHint } from "../../presentation/reload-hint.ts";
import { compareByNameThenScope } from "../../presentation/sort.ts";
import { dropMarketplaceCache } from "../../shared/completion-cache.ts";
import {
  assertNever,
  errorMessage,
  ManualRecoveryError,
  MarketplaceNotFoundError,
} from "../../shared/errors.ts";
import { notifyError, notifySuccess, notifyWarning } from "../../shared/notify.ts";
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
import type {
  ManualRecoveryLine,
  MarketplaceRow,
  PluginCascadeRow,
  SoftDepProbe,
} from "../../presentation/compact-line.ts";
import type { Reason } from "../../shared/grammar/reasons.ts";
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
    // D-CMC-12: notifyError auto-appends the MSG-CC-1 cause-chain trailer.
    // The outcome's `notes` field is consumed OUTSIDE the notify path so we
    // compose the message + trailer inline once for both surfaces.
    const message = composeErrorWithCauseChain(err);
    if (render !== "none") {
      notifyError(ctx, errorMessage(err), err);
    }

    // Plan 13-02a-02 / CMC-16: structural failure-class tag so
    // outcomeToCascadeRow maps to `(failed) {rollback partial}` without
    // substring-matching the legacy ES-5 marker text in `notes`.
    return {
      partition: "failed",
      name: plugin,
      marketplace,
      scope,
      notes: [message],
      ...(findManualRecoveryError(err) !== undefined && {
        failureClass: "manual-recovery" as const,
      }),
    };
  }

  if (locked.outcome.partition !== "reinstalled") {
    return locked.outcome;
  }

  const maintenanceWarnings = await runPostSuccessMaintenance(opts, locations);
  if (render === "none") {
    const notes = [...locked.bridgeWarnings, ...maintenanceWarnings].map((w) => `warning: ${w}`);
    return notes.length === 0 ? locked.outcome : { ...locked.outcome, notes };
  }

  for (const warning of locked.bridgeWarnings) {
    notifyWarning(ctx, warning);
  }

  for (const warning of maintenanceWarnings) {
    notifyWarning(ctx, warning);
  }

  notifySuccess(ctx, renderSuccessBody(locked.outcome, softDepStatus(pi)));
  return locked.outcome;
}

export async function reinstallPlugins(
  opts: ReinstallPluginsOptions,
): Promise<readonly ReinstallPluginOutcome[]> {
  const { ctx, pi, cwd } = opts;

  let targets: readonly ResolvedReinstallTarget[];
  try {
    targets = await enumerateReinstallTargets(opts);
  } catch (err) {
    // D-CMC-12: notifyError auto-appends the MSG-CC-1 cause-chain trailer.
    notifyError(ctx, errorMessage(err), err);
    return [];
  }

  if (targets.length === 0) {
    // CMC-10 / MSG-ER-1: bare empty token rendered via the Wave 1 renderer
    // (no icon, no scope brackets); supersedes the legacy bulk-reinstall
    // success-sentence form retired by Plan 13-02a-01 (the catalog now
    // calls for `(no plugins)` per MSG-ER-1).
    notifySuccess(ctx, renderRow({ kind: "empty", token: "no plugins" }, softDepStatus(pi)));
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
      // outcomeToCascadeRow maps to `(failed) {rollback partial}` without
      // substring-matching the legacy ES-5 marker text in `notes`.
      outcomes.push({
        partition: "failed",
        name: target.plugin,
        marketplace: target.marketplace,
        scope: target.scope,
        notes: [composeErrorWithCauseChain(err)],
        ...(findManualRecoveryError(err) !== undefined && {
          failureClass: "manual-recovery" as const,
        }),
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
  const scopes: readonly Scope[] =
    explicitScope === undefined ? ["user", "project"] : [explicitScope];
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
 * Plan 13-02a-01 / CMC-25: render the bulk-reinstall outcome cascade per
 * MSG-GR-1 + MSG-IC-1..3 + MSG-SR-4..6.
 *
 * Shape per marketplace (catalog `/claude:plugin reinstall` multi-plugin
 * cascade, output-catalog.md §"`/claude:plugin reinstall`"):
 *
 *     ● <mp> [<scope>]
 *       ● <plugin> [<scope>] v<version> (reinstalled) [{reasons...}]
 *       ● <plugin> [<scope>] (skipped) {<reason>}
 *       ⊘ <plugin> [<scope>] (failed) {<reason>}
 *
 *     /reload to pick up changes
 *
 * - Marketplace headers carry `status: undefined` (the marketplace itself
 *   was NOT updated by reinstall; the header is a pure label).
 * - Per-marketplace `cascadeSummary` returns `{message, severity}`;
 *   severity aggregates via OR (any warning -> overall warning).
 * - Reload-hint trailer emitted iff at least one row's resources changed
 *   (per MSG-RH-1); omitted on all-failed cascades.
 * - Severity dispatch: `notifySuccess` for all-trivial cascades,
 *   `notifyWarning` for any non-trivial outcome. NEVER `notifyError`
 *   (MSG-SR-6).
 */
function renderReinstallPartitionAndNotify(
  ctx: ExtensionContext,
  pi: ExtensionAPI,
  outcomes: readonly ReinstallPluginOutcome[],
): void {
  const probe = softDepStatus(pi);
  // Group rows by marketplace + scope. Two different scopes for the same
  // marketplace name render as two separate cascade blocks (CMC-21: per-
  // scope rendering, no collapse).
  const byMp = new Map<string, { marketplace: MarketplaceRow; rows: PluginCascadeRow[] }>();
  for (const outcome of outcomes) {
    const key = `${outcome.scope}:${outcome.marketplace}`;
    const existing = byMp.get(key);
    const row = outcomeToCascadeRow(outcome);
    if (existing === undefined) {
      byMp.set(key, {
        marketplace: {
          kind: "marketplace",
          name: outcome.marketplace,
          scope: outcome.scope,
          // Header is a pure label here -- reinstall does not modify the
          // marketplace itself, so no `(status)` slot. `outcomeClass: "ok"`
          // because the marketplace record itself is fine (per-row
          // failures live in the children).
          outcomeClass: "ok",
        },
        rows: [row],
      });
    } else {
      existing.rows.push(row);
    }
  }

  // Order marketplace blocks via compareByNameThenScope (name primary
  // case-insensitive, scope secondary project-before-user per MSG-GR-3).
  const sortedBlocks = [...byMp.values()].sort((a, b) =>
    compareByNameThenScope(a.marketplace, b.marketplace),
  );

  const bodySegments: string[] = [];
  let aggregatedSeverity: "success" | "warning" = "success";
  for (const block of sortedBlocks) {
    const { message, severity } = cascadeSummary({
      marketplace: block.marketplace,
      rows: block.rows,
      probe,
    });
    bodySegments.push(message);
    if (severity === "warning") {
      aggregatedSeverity = "warning";
    }
  }

  const body = bodySegments.join("\n\n");

  // D-14-02 / CMC-16 / MSG-MR-1 + MSG-MR-2: emit a SEPARATE top-level
  // manual-recovery anchor line for each outcome carrying the structural
  // `failureClass: "manual-recovery"` tag. The cascade row's `(failed)
  // {rollback partial}` shape (composed by outcomeToCascadeRow above) is
  // PRESERVED unchanged (catalog byte-binding at docs/output-catalog.md
  // L330); the anchor is an ADDITIONAL top-level line below the cascade
  // body, separated by a blank line per MSG-MR-1.
  //
  // The anchor's `resource` slot collapses to `${name}@${marketplace}`
  // (MSG-MR-2: ManualRecoveryLine has no marketplace/scope schema fields,
  // so the entity composition lives inside the free-form `resource`
  // string). Reasons pin to `["rollback partial"]` to match the per-row
  // cascade Reason; cause-chain text surfaces separately via the notify
  // boundary's cause-chain trailer (depth-bounded by notifyError).
  const manualRecoveryAnchors = outcomes.filter(isManualRecoveryOutcome).map((o) => {
    const line: ManualRecoveryLine = {
      kind: "manual-recovery",
      resource: `${o.name}@${o.marketplace}`,
      reasons: Object.freeze(["rollback partial" as const]),
    };
    return renderManualRecovery(line, probe);
  });
  const composedBody =
    manualRecoveryAnchors.length === 0 ? body : `${body}\n\n${manualRecoveryAnchors.join("\n\n")}`;

  const changedNames = outcomes
    .filter(
      (o): o is ReinstallReinstalledOutcome => o.partition === "reinstalled" && o.resourcesChanged,
    )
    .map((o) => o.name);
  const hint = reloadHint(changedNames);
  // MSG-SR-6: cascade summaries never use notifyError. The manual-recovery
  // anchor co-exists with the warning-severity cascade body (CMC-15 /
  // MSG-RH-1 dual-trailer-style co-existence pattern).
  const dispatch = aggregatedSeverity === "warning" ? notifyWarning : notifySuccess;
  dispatch(ctx, appendReloadHint(composedBody, hint));
}

/**
 * Type guard narrowing a `ReinstallPluginOutcome` to the `failed` variant
 * tagged with `failureClass: "manual-recovery"`. Hoisted out of
 * `renderReinstallPartitionAndNotify` so the filter callback's narrowing
 * is named and reusable (D-14-02 / CMC-16).
 */
function isManualRecoveryOutcome(
  outcome: ReinstallPluginOutcome,
): outcome is ReinstallFailedOutcome & { readonly failureClass: "manual-recovery" } {
  return outcome.partition === "failed" && outcome.failureClass === "manual-recovery";
}

/**
 * Plan 14-01 / CMC-16 / D-14-02 binding seam: exported under the
 * `__test_*` prefix so the dedicated MSG-MR-1 anchor-emission regression
 * test in tests/orchestrators/plugin/reinstall.test.ts can verify the
 * separate top-level manual-recovery line co-exists with the cascade body
 * without forcing a real `ManualRecoveryError` through the bridges (which
 * would require fs-permission / saveState dep injection plumbing through
 * `reinstallPlugins`, which does not propagate `__deps`).
 *
 * Placement note (WR-02): mirrors the existing `__test_outcomeToCascadeRow`
 * / `__test_errorWithManualRecovery` / `__test_findManualRecoveryError`
 * seam pattern -- declared BELOW the primary function so its JSDoc does
 * not orphan the function's contract docstring from the IDE hover binding.
 */
export { renderReinstallPartitionAndNotify as __test_renderReinstallPartitionAndNotify };

/**
 * Maps a `ReinstallPluginOutcome` to its `PluginCascadeRow` representation
 * (CMC-25 closed-set status mapping; D-13-05 typed-RowSpec discipline).
 *
 * Reason-token mapping:
 *   - `"not installed"` -> Reason `"not installed"`
 *   - `"not in manifest"` -> Reason `"not in manifest"`
 *   - other free-form notes from skipped/failed outcomes pass through as
 *     the closest matching closed-set Reason via `narrowReason`. The
 *     `Reason` type is the binding contract; unmappable text degrades to
 *     `"not in manifest"` as a documented fallback (Reasons is a closed
 *     set per CMC-11; unknown free-form text cannot widen it).
 */
function outcomeToCascadeRow(outcome: ReinstallPluginOutcome): PluginCascadeRow {
  switch (outcome.partition) {
    case "reinstalled":
      return {
        kind: "plugin-cascade",
        name: outcome.name,
        scope: outcome.scope,
        version: outcome.version,
        status: "reinstalled",
        declaresAgents: outcome.declaresAgents ?? false,
        declaresMcp: outcome.declaresMcp ?? false,
      };
    case "skipped": {
      const reasons = narrowReasons(outcome.notes);
      return {
        kind: "plugin-cascade",
        name: outcome.name,
        scope: outcome.scope,
        status: "skipped",
        reasons,
      };
    }

    case "failed": {
      // Plan 13-02a-02 / CMC-16: structural failure-class tag supersedes
      // the legacy substring match on `notes` for the manual-recovery
      // class. When the orchestrator caught a ManualRecoveryError, the
      // row carries the canonical closed-set Reason `"rollback partial"`
      // verbatim (byte-equivalent to the legacy substring branch's
      // single-Reason output, per catalog form `(failed) {rollback
      // partial}` at docs/output-catalog.md L330); the opaque `notes`
      // text is NOT additionally narrowed because the cause-chain trailer
      // at the notify boundary already surfaces the underlying error text
      // via ES-4. Otherwise fall back to `narrowReason` substring
      // matching for non-manual-recovery rollback / fallback scenarios.
      const reasons: readonly Reason[] =
        outcome.failureClass === "manual-recovery"
          ? Object.freeze(["rollback partial" as const])
          : narrowReasons(outcome.notes);
      // MSG-SD-3 / effective-state: soft-dep markers do NOT fire on
      // (failed) rows (the plugin's effective state is "not installed");
      // explicitly set false to keep the contract local-and-visible.
      return {
        kind: "plugin-cascade",
        name: outcome.name,
        scope: outcome.scope,
        status: "failed",
        reasons,
        declaresAgents: false,
        declaresMcp: false,
      };
    }

    default:
      return assertNever(outcome);
  }
}

/**
 * Plan 13-02a-02 / CMC-16 / F-2 binding seam: exported under the `__test_*`
 * prefix so the dedicated binding regression test in
 * tests/orchestrators/plugin/reinstall.test.ts can verify the structural
 * `failureClass: "manual-recovery"` -> `["rollback partial"]` mapping
 * end-to-end without forcing a complex fs-permission leak fixture through
 * the bridges. Production callsites import `outcomeToCascadeRow` via the
 * private (non-exported) name; the test seam aliases the same function.
 *
 * Placement note (WR-02): this re-export sits BELOW the function
 * declaration so its JSDoc does not orphan the primary contract JSDoc on
 * `outcomeToCascadeRow` from the IDE hover-doc binding. Most JSDoc tooling
 * attaches a comment to the next declaration and treats intervening
 * comments as separators.
 */
export { outcomeToCascadeRow as __test_outcomeToCascadeRow };

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

/**
 * Plan 13-02a-01 / CMC-25 LOCKED I-01: single-plugin reinstall renders as
 * a 1-marketplace 1-row cascade via the SAME `cascadeSummary` shape as the
 * bulk path. `PluginCascadeRow` (NOT `PluginInlineRow`) -- Plan 13-01-01
 * narrows `PluginInlineRow.status` to exclude `"reinstalled"`. Rationale:
 * matches catalog `/claude:plugin reinstall` single-row-cascade shape at
 * `docs/output-catalog.md` lines 351-358; avoids inline-vs-cascade
 * duality; preserves CMC-08 reconciliation (the `reinstalled` token is
 * rendered; the partition kind stays internal). Single-plugin success is
 * always success severity -> `notifySuccess` dispatch is locked.
 */
function renderSuccessBody(outcome: ReinstallReinstalledOutcome, probe: SoftDepProbe): string {
  const mpRow: MarketplaceRow = {
    kind: "marketplace",
    name: outcome.marketplace,
    scope: outcome.scope,
    // Header is a label here -- the marketplace itself was not modified.
    outcomeClass: "ok",
  };
  const row: PluginCascadeRow = {
    kind: "plugin-cascade",
    name: outcome.name,
    scope: outcome.scope,
    version: outcome.version,
    status: "reinstalled",
    declaresAgents: outcome.declaresAgents ?? false,
    declaresMcp: outcome.declaresMcp ?? false,
  };
  const { message } = cascadeSummary({ marketplace: mpRow, rows: [row], probe });
  const hint = reloadHint(outcome.resourcesChanged ? [outcome.name] : []);
  return appendReloadHint(message, hint);
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

/**
 * Compose `errorMessage(err) [\n\n${causeChainTrailer(err)}]` for outcome
 * `notes` aggregated outside the notify path. `notifyError` does this
 * automatically; this helper exists for outcome-aggregation callsites that
 * need the same text without going through the notify channel.
 */
function composeErrorWithCauseChain(err: unknown): string {
  const trailer = causeChainTrailer(err);
  return trailer === "" ? errorMessage(err) : `${errorMessage(err)}\n\n${trailer}`;
}

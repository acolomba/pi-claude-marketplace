// orchestrators/reconcile/apply.ts
//
// RECON-01..05: the load-time apply orchestrator.
//
// CONTRACT:
//   - Per-scope READ PASS (locked, WRITE-FREE -- WR-05) under
//     `withLockedStateTransaction(loc, ...)` with NO `tx.save()`: a
//     pristine scope (no state.json, no config) is skipped before the lock;
//     otherwise run `migrateFirstRunConfig(loc, state)` FIRST (Pitfall 52-2
//     lock-covered first-load race; Pitfall 52-4 D-13 existsSync gate is
//     observed at the transaction's internal loadState BEFORE the closure
//     runs), then `loadMergedScopeConfig(loc)`, then the CFG-03 invalid-arm
//     check, then `planReconcile(merged, state, scope)`. Closure returns
//     the plan + invalid blocks; lock releases on closure return;
//     state.json bytes + mtime stay untouched.
//   - Per-scope APPLY PASS with NO outer lock (CR-01 lesson preserved): for
//     each scope's plan (skip when invalid-config aborted the read pass),
//     drive the four orchestrators in fixed order (Pitfall 8 data dependency):
//
//        uninstall -> remove -> add -> install -> enable -> disable
//                  -> source-mismatch (report-only)
//
//     Each driven orchestrator call passes `notifications: { mode:
//     "orchestrated" }` and is wrapped in a try/catch so an unexpected throw
//     becomes a typed `failed` outcome (Pitfall 5 / RECON-03 soft-fail).
//   - SINGLE notify() emission per applyReconcile invocation (IL-2 /
//     RECON-04). Empty-and-clean reconciles are SILENT (NFR-2 / A4) -- the
//     orchestrator skips the notify() call when no outcomes accumulated AND
//     no invalid-config rows surfaced.
//
// A1 (RESEARCH Assumption A1, VERIFIED 2026-06-10): pi-coding-agent fires
// `resources_discover` AFTER `session_start` has been emitted to every
// extension AND after all extension factory functions have returned
// (`agent-session.js:1648-1656`: bindExtensions emits session_start, then
// `extendResourcesFromExtensions` checks `hasHandlers("resources_discover")`
// -- handlers come from each extension's `pi.on(...)` registration during
// its factory call). softDepStatus(pi) at apply time therefore observes a
// stable pi-subagents / pi-mcp-adapter status.

import path from "node:path";

import { loadMergedScopeConfig } from "../../persistence/config-merge.ts";
import { locationsFor } from "../../persistence/locations.ts";
import { migrateFirstRunConfig } from "../../persistence/migrate-config.ts";
import { StateLockHeldError } from "../../shared/errors.ts";
import { pathExists } from "../../shared/fs-utils.ts";
import { notify } from "../../shared/notify.ts";
import { narrowProbeError } from "../../shared/probe-classifiers.ts";
import { withLockedStateTransaction } from "../../transaction/with-state-guard.ts";
import { addMarketplace } from "../marketplace/add.ts";
import { removeMarketplace } from "../marketplace/remove.ts";
import { setPluginEnabled } from "../plugin/enable-disable.ts";
import { installPlugin } from "../plugin/install.ts";
import { uninstallPlugin } from "../plugin/uninstall.ts";

import { buildReconcileAppliedCascade } from "./notify.ts";
import { planReconcile } from "./plan.ts";

import type { PerEntryOutcome } from "./apply-outcomes.ts";
import type { ReconcilePlan } from "./types.ts";
import type { ExtensionAPI, ExtensionContext } from "../../platform/pi-api.ts";
import type { Dependency, Reason } from "../../shared/notify.ts";
import type { Scope } from "../../shared/types.ts";
import type { GitOps } from "../marketplace/shared.ts";

/**
 * RECON-01..05 options bundle. When `scope` is omitted, applyReconcile fans
 * out across BOTH scopes project-first (mirrors preview.ts:60).
 */
export interface ApplyReconcileOptions {
  readonly ctx: ExtensionContext;
  readonly pi: ExtensionAPI;
  /** Project-scope cwd (ignored for the user scope). */
  readonly cwd: string;
  readonly scope?: Scope;
  /**
   * D-12 injection seam threaded into `addMarketplace` for RECON-03 network
   * soft-fail tests. Production callers (index.ts) omit and the default
   * `DEFAULT_GIT_OPS` from `marketplace/shared.ts` applies. The seam is
   * narrow on purpose: only `addMarketplace` touches the network at apply
   * time (NFR-5; the install / uninstall / enable / disable orchestrators
   * are local-only by construction). Tests inject a failing `gitOps.clone`
   * to drive the soft-fail-per-entry proof without real network.
   */
  readonly gitOps?: GitOps;
}

/**
 * Per-scope read-pass result. `plan` is undefined when CFG-03 aborted the
 * scope (the apply path SKIPS the planner for that scope -- invalid input
 * is never coerced to empty desired state per Pitfall 53-1 / Pitfall 54-N).
 */
interface ScopeReadResult {
  readonly scope: Scope;
  readonly plan: ReconcilePlan | undefined;
  /** CFG-03 + state-load failure rows surfaced from the read pass. */
  readonly invalidOutcomes: readonly PerEntryOutcome[];
}

/**
 * Per-scope read pass under the scope lock. Migrate-then-load-then-plan
 * inside ONE lock so the deferred ordering rail is wired.
 *
 * WR-05: the read pass is WRITE-FREE.
 *
 *   - Pristine-scope gate: a scope with NO state.json and NO config file
 *     has never been used by the extension -- the read pass returns before
 *     taking the lock (no mkdir, no lock file, no generated config). The
 *     pre-reconcile handler was read-only; starting Pi in an arbitrary
 *     repository must not create `.pi/claude-plugins.json` +
 *     `.pi/pi-claude-marketplace/state.json` there. The MIG-01 contract is
 *     "generate the config from EXISTING state.json on first load" -- an
 *     absent state.json means nothing to migrate.
 *   - No state save: the closure mutates nothing on state (migrate writes
 *     the CONFIG via saveConfig; load + plan are pure), so the guard is
 *     `withLockedStateTransaction` WITHOUT `tx.save()` -- a no-op reconcile
 *     leaves state.json bytes AND mtime untouched (mirrors the RECON-05
 *     invariant the tests assert for the config file).
 */
async function readPassForScope(scope: Scope, cwd: string): Promise<ScopeReadResult> {
  const loc = locationsFor(scope, cwd);

  const stateExists = await pathExists(loc.stateJsonPath);
  const configExists =
    (await pathExists(loc.configJsonPath)) || (await pathExists(loc.configLocalJsonPath));
  if (!stateExists && !configExists) {
    // Pristine scope: nothing recorded, nothing declared -- no-op without
    // touching the disk.
    return { scope, plan: undefined, invalidOutcomes: [] };
  }

  return withLockedStateTransaction(loc, async (tx) => {
    const state = tx.state;
    // (1) Migrate FIRST -- generates a fresh `claude-plugins.json` from the
    // current `state.json` on first run (MIG-01). Idempotent: short-circuits
    // when config already exists (valid OR invalid). Pitfall 52-2: the
    // surrounding lock covers the cross-process concurrent-first-load race;
    // Pitfall 52-4: the D-13 existsSync gate is observed at the
    // transaction's internal loadState BEFORE this closure runs, preserving
    // legacy-autoupdate capture (the field still lives on state at this
    // point). WR-05: `tx.save()` is deliberately NEVER called -- the read
    // pass mutates nothing on state, so state.json stays byte-untouched.
    await migrateFirstRunConfig(loc, state);

    // (2) Load the merged scope config (base + local).
    const outcome = await loadMergedScopeConfig(loc);

    // (3) CFG-03 abort: surface invalid arm(s) as structured (failed) rows
    // with the file BASENAME (T-55-02-01 / T-53-02-02 information-disclosure
    // mitigation). DO NOT call planReconcile -- coercing an invalid config
    // to an empty desired state would emit a mass-uninstall plan.
    const invalidOutcomes: PerEntryOutcome[] = [];
    if (outcome.base.status === "invalid") {
      invalidOutcomes.push({
        kind: "invalid-block",
        scope,
        marketplace: path.basename(outcome.base.filePath),
        reason: "invalid manifest",
      });
    }

    if (outcome.local.status === "invalid") {
      invalidOutcomes.push({
        kind: "invalid-block",
        scope,
        marketplace: path.basename(outcome.local.filePath),
        reason: "invalid manifest",
      });
    }

    if (invalidOutcomes.length > 0) {
      return { scope, plan: undefined, invalidOutcomes };
    }

    // (4) Plan against the merged config + current state. Pure -- no I/O.
    const plan = planReconcile(outcome.merged, state, scope);
    return { scope, plan, invalidOutcomes: [] };
  });
}

/** Closed-set reason for an unexpected orchestrator throw (post-classifier fallback). */
function classifyOrchestratorThrow(err: unknown): import("../../shared/notify.ts").ContentReason {
  return narrowProbeError(err);
}

/**
 * WR-01: closed-set reason for a per-scope read-pass throw. A concurrent
 * process holding the scope lock surfaces as `lock held`; a corrupt
 * state.json surfaces as `unparseable` (loadState wraps the JSON.parse
 * SyntaxError one level deep in `Error.cause`, so unwrap before falling back
 * to the generic probe classifier).
 */
function classifyReadPassThrow(err: unknown): import("../../shared/notify.ts").ContentReason {
  if (err instanceof StateLockHeldError) {
    return "lock held";
  }

  if (err instanceof Error && err.cause instanceof SyntaxError) {
    return "unparseable";
  }

  return narrowProbeError(err);
}

/** Derive the closed-set Dependency[] from InstallPluginOutcome flags. */
function dependenciesFromInstall(outcome: {
  readonly declaresAgents: boolean;
  readonly declaresMcp: boolean;
}): readonly Dependency[] {
  const deps: Dependency[] = [];
  if (outcome.declaresAgents) {
    deps.push("agents");
  }

  if (outcome.declaresMcp) {
    deps.push("mcp");
  }

  return deps;
}

/**
 * Apply one plan's marketplacesToRemove bucket. NO outer lock around the
 * loop -- each orchestrator call owns its own per-scope withLockedState
 * critical section (Pattern 3 / Pitfall 3 / CR-01). Per-entry try/catch
 * coerces unexpected throws into typed `failed` outcomes so the apply pass
 * NEVER lets a network failure propagate past the boundary (NFR-5 /
 * RECON-03).
 */
async function applyMarketplaceRemoves(
  opts: ApplyReconcileOptions,
  plan: ReconcilePlan,
  outcomes: PerEntryOutcome[],
): Promise<void> {
  for (const op of plan.marketplacesToRemove) {
    try {
      const result = await removeMarketplace({
        ctx: opts.ctx,
        pi: opts.pi,
        name: op.marketplace,
        scope: op.scope,
        cwd: opts.cwd,
        notifications: { mode: "orchestrated" },
      });
      if (result === undefined) {
        // Defensive: orchestrated mode always returns an outcome.
        continue;
      }

      if (result.status === "removed") {
        // WR-02: the planner deliberately excludes plugins
        // under a to-be-removed marketplace from `pluginsToUninstall` (the
        // remove cascade unstages them -- no double-billing), so the cascade
        // outcome is the ONLY carrier of those rows. Fold `result.unstaged`
        // into the outcome stream so the D-22-02 contract (one indented
        // `(uninstalled)` row per unstaged plugin) holds on the reconcile
        // surface too -- plugins must never disappear silently.
        for (const plugin of result.unstaged) {
          outcomes.push({
            kind: "plugin-uninstalled",
            scope: op.scope,
            marketplace: op.marketplace,
            plugin,
          });
        }

        outcomes.push({ kind: "mp-removed", scope: op.scope, marketplace: op.marketplace });
      } else {
        outcomes.push({
          kind: "mp-remove-failed",
          scope: op.scope,
          marketplace: op.marketplace,
          reason: result.reason,
        });
      }
    } catch (err) {
      outcomes.push({
        kind: "mp-remove-failed",
        scope: op.scope,
        marketplace: op.marketplace,
        reason: classifyOrchestratorThrow(err),
      });
    }
  }
}

async function applyMarketplaceAdds(
  opts: ApplyReconcileOptions,
  plan: ReconcilePlan,
  outcomes: PerEntryOutcome[],
): Promise<void> {
  for (const op of plan.marketplacesToAdd) {
    try {
      const result = await addMarketplace({
        ctx: opts.ctx,
        pi: opts.pi,
        scope: op.scope,
        cwd: opts.cwd,
        rawSource: op.source,
        notifications: { mode: "orchestrated" },
        ...(opts.gitOps !== undefined && { gitOps: opts.gitOps }),
      });
      if (result === undefined) {
        continue;
      }

      if (result.status === "added") {
        // CR-01: render the row on the name the record was actually created
        // under (`result.name` is the MANIFEST-derived name, which the
        // declared config key does not have to match). The planner's
        // source-based matching (plan.ts::findRecordedBySource) makes the
        // next reconcile converge on that recorded name.
        outcomes.push({ kind: "mp-added", scope: op.scope, marketplace: result.name });
      } else {
        outcomes.push({
          kind: "mp-add-failed",
          scope: op.scope,
          marketplace: op.marketplace,
          reason: result.reason,
        });
      }
    } catch (err) {
      outcomes.push({
        kind: "mp-add-failed",
        scope: op.scope,
        marketplace: op.marketplace,
        reason: classifyOrchestratorThrow(err),
      });
    }
  }
}

async function applyPluginUninstalls(
  opts: ApplyReconcileOptions,
  plan: ReconcilePlan,
  outcomes: PerEntryOutcome[],
): Promise<void> {
  for (const op of plan.pluginsToUninstall) {
    try {
      const result = await uninstallPlugin({
        ctx: opts.ctx,
        pi: opts.pi,
        scope: op.scope,
        cwd: opts.cwd,
        marketplace: op.marketplace,
        plugin: op.plugin,
        notifications: { mode: "orchestrated" },
      });
      if (result === undefined) {
        continue;
      }

      // WR-06: the PU-5 silent converge (record already gone -- another
      // process won the race or there was never an install) renders NO row;
      // reporting it would claim work this reconcile did not perform.
      if (result.status === "converged") {
        continue;
      }

      if (result.status === "uninstalled") {
        outcomes.push({
          kind: "plugin-uninstalled",
          scope: op.scope,
          marketplace: op.marketplace,
          plugin: op.plugin,
          ...(result.version !== undefined && { version: result.version }),
        });
      } else {
        outcomes.push({
          kind: "plugin-uninstall-failed",
          scope: op.scope,
          marketplace: op.marketplace,
          plugin: op.plugin,
          reason: result.reason,
        });
      }
    } catch (err) {
      outcomes.push({
        kind: "plugin-uninstall-failed",
        scope: op.scope,
        marketplace: op.marketplace,
        plugin: op.plugin,
        reason: classifyOrchestratorThrow(err),
      });
    }
  }
}

async function applyPluginInstalls(
  opts: ApplyReconcileOptions,
  plan: ReconcilePlan,
  outcomes: PerEntryOutcome[],
): Promise<void> {
  for (const op of plan.pluginsToInstall) {
    try {
      const result = await installPlugin({
        ctx: opts.ctx,
        pi: opts.pi,
        scope: op.scope,
        cwd: opts.cwd,
        marketplace: op.marketplace,
        plugin: op.plugin,
        notifications: { mode: "orchestrated" },
      });

      if (result.status === "installed") {
        outcomes.push({
          kind: "plugin-installed",
          scope: op.scope,
          marketplace: op.marketplace,
          plugin: op.plugin,
          dependencies: dependenciesFromInstall(result),
        });
      } else {
        outcomes.push({
          kind: "plugin-install-failed",
          scope: op.scope,
          marketplace: op.marketplace,
          plugin: op.plugin,
          reason: classifyOrchestratorThrow(result.error),
        });
      }
    } catch (err) {
      outcomes.push({
        kind: "plugin-install-failed",
        scope: op.scope,
        marketplace: op.marketplace,
        plugin: op.plugin,
        reason: classifyOrchestratorThrow(err),
      });
    }
  }
}

interface PluginToggleAxes {
  readonly enable: boolean;
  readonly successStatus: "enabled" | "disabled";
  readonly buildSuccess: (info: {
    scope: Scope;
    marketplace: string;
    plugin: string;
    version?: string;
  }) => PerEntryOutcome;
  readonly buildFailed: (info: {
    scope: Scope;
    marketplace: string;
    plugin: string;
    reason: Reason;
  }) => PerEntryOutcome;
}

async function applyPluginToggles(
  opts: ApplyReconcileOptions,
  ops: ReconcilePlan["pluginsToEnable"] | ReconcilePlan["pluginsToDisable"],
  outcomes: PerEntryOutcome[],
  axes: PluginToggleAxes,
): Promise<void> {
  for (const op of ops) {
    try {
      const result = await setPluginEnabled({
        ctx: opts.ctx,
        pi: opts.pi,
        cwd: opts.cwd,
        marketplace: op.marketplace,
        plugin: op.plugin,
        enable: axes.enable,
        scope: op.scope,
        notifications: { mode: "orchestrated" },
      });
      if (result === undefined) {
        continue;
      }

      if (result.status === axes.successStatus) {
        outcomes.push(
          axes.buildSuccess({
            scope: op.scope,
            marketplace: op.marketplace,
            plugin: op.plugin,
            ...(result.version !== undefined && { version: result.version }),
          }),
        );
      } else if (result.status === "failed") {
        outcomes.push(
          axes.buildFailed({
            scope: op.scope,
            marketplace: op.marketplace,
            plugin: op.plugin,
            reason: result.reason,
          }),
        );
      }
      // skipped (idempotent) -> intentionally drop; the steady state isn't a
      // user-visible action.
    } catch (err) {
      outcomes.push(
        axes.buildFailed({
          scope: op.scope,
          marketplace: op.marketplace,
          plugin: op.plugin,
          reason: classifyOrchestratorThrow(err),
        }),
      );
    }
  }
}

/**
 * Source-mismatch and dangling-reference rows from the planner are NOT
 * actionable at apply time -- they surface as `(failed) {source mismatch}`
 * marketplace rows (with an optional plugin child for dangling references).
 * Routing them through the same per-entry outcome accumulator keeps the
 * projection a single seam.
 */
function applySourceMismatches(plan: ReconcilePlan, outcomes: PerEntryOutcome[]): void {
  for (const m of plan.sourceMismatches) {
    outcomes.push({
      kind: "source-mismatch",
      scope: m.scope,
      marketplace: m.marketplace,
      ...(m.plugin !== undefined && { plugin: m.plugin }),
    });
  }
}

/**
 * Per-scope apply pass. Drives the orchestrators in the documented order
 * (Pitfall 8). NO outer lock -- each orchestrator owns its per-scope
 * critical section (CR-01).
 *
 * Order rationale (data dependency):
 *   1. uninstall plugins under a marketplace BEFORE removing that
 *      marketplace (a removeMarketplace cascade-unstages remaining plugins,
 *      but the planner already split them so we honour the explicit order).
 *   2. remove marketplaces freed by step 1.
 *   3. add new marketplaces BEFORE installing into them.
 *   4. install new plugins under the marketplaces from step 3.
 *   5. enable plugins newly declared enabled.
 *   6. disable plugins newly declared disabled.
 *   7. source-mismatch / dangling rows (report-only) folded last.
 */
async function applyPlan(
  opts: ApplyReconcileOptions,
  plan: ReconcilePlan,
  outcomes: PerEntryOutcome[],
): Promise<void> {
  await applyPluginUninstalls(opts, plan, outcomes);
  await applyMarketplaceRemoves(opts, plan, outcomes);
  await applyMarketplaceAdds(opts, plan, outcomes);
  await applyPluginInstalls(opts, plan, outcomes);
  await applyPluginToggles(opts, plan.pluginsToEnable, outcomes, {
    enable: true,
    successStatus: "enabled",
    buildSuccess: (info) => ({ kind: "plugin-enabled", ...info }),
    buildFailed: (info) => ({ kind: "plugin-enable-failed", ...info }),
  });
  await applyPluginToggles(opts, plan.pluginsToDisable, outcomes, {
    enable: false,
    successStatus: "disabled",
    buildSuccess: (info) => ({ kind: "plugin-disabled", ...info }),
    buildFailed: (info) => ({ kind: "plugin-disable-failed", ...info }),
  });
  applySourceMismatches(plan, outcomes);
}

/**
 * RECON-01..05: the load-time apply orchestrator. Fans out across both
 * scopes project-first (or just the explicit scope when `opts.scope` is
 * set), per-scope read pass under withStateGuard (migrate -> load -> plan),
 * per-scope apply pass with NO outer lock, single notify() emission per
 * invocation (IL-2) -- empty-and-clean reconciles are SILENT (NFR-2 / A4).
 *
 * Returns `void`; the side effects are the orchestrator-driven state
 * mutations + the single notify() call (when non-empty).
 */
export async function applyReconcile(opts: ApplyReconcileOptions): Promise<void> {
  const scopes: readonly Scope[] = opts.scope === undefined ? ["project", "user"] : [opts.scope];

  // Accumulate outcomes across both scopes; the projection sorts by
  // compareByNameThenScope (project-before-user per MSG-GR-3) so the final
  // cascade emits in canonical order regardless of which scope ran first.
  const outcomes: PerEntryOutcome[] = [];

  for (const scope of scopes) {
    // WR-01: per-scope failure isolation. A read-pass
    // throw (corrupt/unparseable state.json, StateLockHeldError from a
    // concurrent process, an EACCES on the lock file) must NOT discard the
    // sibling scope's already-accumulated outcomes or skip its reconcile --
    // the scopes lock independently. The throw is coerced into the
    // documented `invalid-block` state-load failure arm (basename subject,
    // closed-set reason) so it surfaces as a structured `(failed)` row in
    // the single cascade instead of aborting applyReconcile wholesale.
    let readResult: ScopeReadResult;
    try {
      readResult = await readPassForScope(scope, opts.cwd);
    } catch (err) {
      outcomes.push({
        kind: "invalid-block",
        scope,
        marketplace: "state.json",
        reason: classifyReadPassThrow(err),
      });
      continue;
    }

    // CFG-03 / state-load invalid rows surfaced first; the plan is undefined
    // for that scope so we skip the apply pass.
    if (readResult.invalidOutcomes.length > 0) {
      outcomes.push(...readResult.invalidOutcomes);
      continue;
    }

    if (readResult.plan !== undefined) {
      await applyPlan(opts, readResult.plan, outcomes);
    }
  }

  // Empty-and-clean reconcile -> SILENT (NFR-2 / A4 / RECON-05). The load-
  // time invariant is that a no-op reconcile produces zero notifications;
  // the operator only hears from the extension when something happened.
  if (outcomes.length === 0) {
    return;
  }

  // Single notify() per applyReconcile (IL-2 / RECON-04). The projection
  // T-55-02-02 contract: consumes only outcome.reason; raw error.message
  // never reaches the notify body.
  const message = buildReconcileAppliedCascade(outcomes);
  notify(opts.ctx, opts.pi, message);
}

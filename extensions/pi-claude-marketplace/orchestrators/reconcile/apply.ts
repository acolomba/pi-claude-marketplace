// orchestrators/reconcile/apply.ts
//
// RECON-01..05: the load-time apply orchestrator.
//
// CONTRACT:
//   - Per-scope READ PASS (locked, WRITE-FREE -- WR-05) under
//     `withLockedStateTransaction(loc, ...)` with NO `tx.save()`: a
//     pristine scope (no state.json, no config) is skipped before the lock;
//     otherwise run `migrateFirstRunConfig(loc, state)` FIRST (the
//     surrounding lock covers the cross-process concurrent-first-load race;
//     the D-13 existsSync gate is observed at the transaction's internal
//     loadState BEFORE the closure runs), then `loadMergedScopeConfig(loc)`,
//     then the CFG-03 invalid-arm check, then
//     `planReconcile(merged, state, scope)`. Closure returns the plan +
//     invalid blocks; lock releases on closure return; state.json bytes +
//     mtime stay untouched.
//   - Per-scope APPLY PASS with NO outer lock (CR-01 lesson preserved): for
//     each scope's plan (skip when invalid-config aborted the read pass),
//     drive the five orchestrators (uninstallPlugin, removeMarketplace,
//     addMarketplace, installPlugin, setPluginEnabled) in fixed order so
//     each step's precondition is established by the previous step:
//
//        uninstall -> remove -> add -> install -> enable -> disable
//                  -> source-mismatch (report-only)
//
//     Each driven orchestrator call passes `notifications: { mode:
//     "orchestrated" }` and is wrapped in a try/catch so an unexpected throw
//     becomes a typed `failed` outcome (RECON-03 soft-fail).
//   - SINGLE notify() emission per applyReconcile invocation (IL-2 /
//     RECON-04). Empty-and-clean reconciles are SILENT (NFR-2 / A4) -- the
//     orchestrator skips the notify() call when no outcomes accumulated AND
//     no invalid-config rows surfaced.
//
// A1: pi-coding-agent fires `resources_discover` AFTER `session_start` has
// been emitted to every extension AND after all extension factory functions
// have returned (`agent-session.js`: bindExtensions emits session_start,
// then `extendResourcesFromExtensions` checks
// `hasHandlers("resources_discover")` -- handlers come from each extension's
// `pi.on(...)` registration during its factory call). softDepStatus(pi) at
// apply time therefore observes a stable pi-subagents / pi-mcp-adapter
// status.

import path from "node:path";

import { rebuildRoutingTables } from "../../bridges/hooks/index.ts";
import { loadMergedScopeConfig } from "../../persistence/config-merge.ts";
import { locationsFor } from "../../persistence/locations.ts";
import { migrateFirstRunConfig } from "../../persistence/migrate-config.ts";
import { errorMessage } from "../../shared/errors.ts";
import { pathExists } from "../../shared/fs-utils.ts";
import { notifyReconcileAppliedWithContext } from "../../shared/notify-context.ts";
import { notifyDiagnostic, redactAbsolutePaths } from "../../shared/notify.ts";
import { withLockedStateTransaction } from "../../transaction/with-state-guard.ts";
import { addMarketplace } from "../marketplace/add.ts";
import { removeMarketplace } from "../marketplace/remove.ts";
import { setPluginEnabled } from "../plugin/enable-disable.ts";
import { installPlugin } from "../plugin/install.ts";
import { uninstallPlugin } from "../plugin/uninstall.ts";

import {
  classifyOrchestratorThrow,
  classifyReadPassThrow,
  dependenciesFromInstall,
  MigrateConfigSaveError,
} from "./apply-outcomes.ts";
import { applyBackfillForScopeIsolated, runScopeIsolated } from "./backfill.ts";
import { buildReconcileAppliedCascade } from "./notify.ts";
import { planReconcile } from "./plan.ts";
import { RECONCILE_APPLIED_CONTEXT } from "./reconcile.messaging.ts";

import type { PerEntryOutcome } from "./apply-outcomes.ts";
import type { ApplyReconcileOptions, ReconcilePlan, ScopeReadResult } from "./types.ts";
import type { Reason } from "../../shared/notify.ts";
import type { Scope } from "../../shared/types.ts";
import type {
  EnableDegradationSignals,
  EnableDisablePluginOutcome,
} from "../plugin/enable-disable.ts";

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
    return { scope, plan: undefined, invalidOutcomes: [], stateExisted: false };
  }

  return withLockedStateTransaction(loc, async (tx) => {
    const state = tx.state;
    // (1) Migrate FIRST -- generates a fresh `claude-plugins.json` from the
    // current `state.json` on first run (MIG-01). Idempotent: short-circuits
    // when config already exists (valid OR invalid). The surrounding lock
    // covers the cross-process concurrent-first-load race; the D-13
    // existsSync gate is observed at the transaction's internal loadState
    // BEFORE this closure runs, preserving legacy-autoupdate capture (the
    // field still lives on state at this point). WR-05: `tx.save()` is
    // deliberately NEVER called -- the read pass mutates nothing on state,
    // so state.json stays byte-untouched.
    //
    // S3 / PR #51: when saveConfig inside migrateFirstRunConfig throws
    // (e.g. EACCES on the scope dir), the failing file is
    // `claude-plugins.json`, NOT state.json. Wrap the call so the throw
    // carries an attribution sentinel; the per-scope catch in
    // applyReconcile reads it to name the row's subject correctly.
    try {
      await migrateFirstRunConfig(loc, state);
    } catch (err) {
      throw new MigrateConfigSaveError(loc.configJsonPath, err);
    }

    // (2) Load the merged scope config (base + local).
    const outcome = await loadMergedScopeConfig(loc);

    // (3) CFG-03 abort: surface invalid arm(s) as structured (failed) rows
    // with the file BASENAME (T-55-02-01 / T-53-02-02 information-disclosure
    // mitigation). DO NOT call planReconcile -- coercing an invalid config
    // to an empty desired state would emit a mass-uninstall plan.
    const invalidOutcomes: PerEntryOutcome[] = [];
    if (outcome.base.status === "invalid") {
      // I5 / PR #51: thread loadConfig's diagnostic detail (EACCES vs
      // JSON-parse vs schema key) into the rendered cause-chain trailer.
      // Absolute paths are stripped at the boundary -- the projection
      // walks Error.cause via causeChainTrailer, which does NOT strip
      // paths on its own (NFR-9 surfaces message text verbatim).
      invalidOutcomes.push({
        kind: "invalid-block",
        scope,
        basename: path.basename(outcome.base.filePath),
        reason: "invalid manifest",
        cause: new Error(redactAbsolutePaths(outcome.base.error)),
      });
    }

    if (outcome.local.status === "invalid") {
      invalidOutcomes.push({
        kind: "invalid-block",
        scope,
        basename: path.basename(outcome.local.filePath),
        reason: "invalid manifest",
        cause: new Error(redactAbsolutePaths(outcome.local.error)),
      });
    }

    if (invalidOutcomes.length > 0) {
      return { scope, plan: undefined, invalidOutcomes, stateExisted: stateExists };
    }

    // (4) Plan against the merged config + current state. Pure -- no I/O.
    const plan = planReconcile(outcome.merged, state, scope);
    // BFILL-02: carry the loaded state snapshot out so applyBackfillForScope can
    // read its stamp + scan its partially-installed plugins. planReconcile is pure,
    // so the snapshot is the unmutated read-pass state.
    return { scope, plan, invalidOutcomes: [], state, stateExisted: stateExists };
  });
}

/**
 * Apply one plan's marketplacesToRemove bucket. NO outer lock around the
 * loop -- each orchestrator call owns its own per-scope withLockedState
 * critical section (CR-01: `proper-lockfile` is not re-entrant). Per-entry
 * try/catch coerces unexpected throws into typed `failed` outcomes so the
 * apply pass NEVER lets a network failure propagate past the boundary
 * (NFR-5 / RECON-03).
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
        // S6 / PR #51: a silent continue would drop the row from the
        // cascade and hide a producer-contract violation
        // (orchestrated mode is supposed to ALWAYS return an outcome).
        // Mirror import/execute.ts:613's "returned no outcome in
        // orchestrated mode" wording so the three apply.ts loops
        // converge with the import path -- and with the fourth
        // (toggle) loop once Y3 lands.
        outcomes.push({
          kind: "mp-remove-failed",
          scope: op.scope,
          marketplace: op.marketplace,
          reason: classifyOrchestratorThrow(
            new Error("removeMarketplace returned no outcome in orchestrated mode"),
          ),
        });
        continue;
      }

      foldRemoveOutcome(result, op.scope, op.marketplace, outcomes);
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

/**
 * I1 / PR #51: fold a `RemoveMarketplaceOutcome` (orchestrated mode) into
 * the per-entry outcome stream. Extracted from `applyMarketplaceRemoves` to
 * keep its cognitive complexity inside the project's lint budget. Handles
 * three arms:
 *   - `removed`: one `plugin-uninstalled` per unstaged plugin + one
 *     `mp-removed` (WR-02 / D-22-02).
 *   - `partial`: one `plugin-uninstalled` per unstaged plugin + one
 *     `plugin-uninstall-failed` per failed plugin + a bare `mp-remove-partial`
 *     mp header.
 *   - `failed`: a single `mp-remove-failed` carrying the reason.
 */
function foldRemoveOutcome(
  result: import("../marketplace/remove.ts").RemoveMarketplaceOutcome,
  scope: Scope,
  marketplace: string,
  outcomes: PerEntryOutcome[],
): void {
  if (result.status === "removed") {
    // WR-02: the planner deliberately excludes plugins under a to-be-removed
    // marketplace from `pluginsToUninstall` (the remove cascade unstages
    // them -- no double-billing). Fold `result.unstaged` into the outcome
    // stream so D-22-02 (one indented `(uninstalled)` row per unstaged
    // plugin) holds on the reconcile surface too.
    for (const plugin of result.unstaged) {
      outcomes.push({ kind: "plugin-uninstalled", scope, marketplace, plugin });
    }

    outcomes.push({ kind: "mp-removed", scope, marketplace });
    return;
  }

  if (result.status === "partial") {
    // I1 / PR #51: the cascade unstaged some plugins AND failed others.
    // Render one row per unstaged plugin (○ uninstalled), one row per
    // failed plugin (⊘ {reason}), plus a bare `(failed)` mp header.
    for (const plugin of result.unstaged) {
      outcomes.push({ kind: "plugin-uninstalled", scope, marketplace, plugin });
    }

    for (const f of result.failed) {
      outcomes.push({
        kind: "plugin-uninstall-failed",
        scope,
        marketplace,
        plugin: f.name,
        reason: f.reason,
      });
    }

    // Marketplace header carries bare `(failed)` (no top-level reasons
    // brace) because the per-plugin children carry the granular reasons.
    // Mirrors the standalone CMC-31 PARTIAL byte form
    // (docs/output-catalog.md `marketplace remove` `partial` fixture).
    outcomes.push({ kind: "mp-remove-partial", scope, marketplace });
    return;
  }

  outcomes.push({ kind: "mp-remove-failed", scope, marketplace, reason: result.reason });
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
        // S6 / PR #51: fail-loud row instead of silent continue
        // -- mirrors import/execute.ts:613's
        // "returned no outcome in orchestrated mode" wording.
        outcomes.push({
          kind: "mp-add-failed",
          scope: op.scope,
          marketplace: op.marketplace,
          reason: classifyOrchestratorThrow(
            new Error("addMarketplace returned no outcome in orchestrated mode"),
          ),
        });
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
        // S6 / PR #51: fail-loud row instead of silent continue
        // -- mirrors import/execute.ts:613's
        // "returned no outcome in orchestrated mode" wording.
        outcomes.push({
          kind: "plugin-uninstall-failed",
          scope: op.scope,
          marketplace: op.marketplace,
          plugin: op.plugin,
          reason: classifyOrchestratorThrow(
            new Error("uninstallPlugin returned no outcome in orchestrated mode"),
          ),
        });
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
        // DFEN-04 / D-102-04: unconditional on this path. A user who hand-adds
        // a bare `"p@mp": {}` entry has declared WHICH plugin, not WHETHER it
        // is enabled -- which is the gap the plugin's own `defaultEnabled`
        // exists to fill. An entry that DOES carry `enabled` is untouched: the
        // install's own precedence gate answers only the absent key.
        applyDefaultEnabled: true,
        // DFEN-05 / D-102-04: address the physical file the declaration lives
        // in, from the merge provenance the planner recorded. Both the
        // precedence read and the stamp follow this selection; a base-file read
        // under a local declaration reports `enabled` absent even when the local
        // entry says otherwise, and a base-file stamp under a local declaration
        // is invisible to the merged view. Conditional spread because
        // `exactOptionalPropertyTypes` rejects an explicit `undefined`.
        ...(op.configSource === "local" && { local: true }),
      });

      if (result.status === "installed" && result.landedDisabled === true) {
        // DFEN-04: the install ran whole and then unstaged, because the
        // plugin's declaration said so. Reuse the EXISTING disabled outcome
        // kind rather than reporting `(installed)` over a record that is
        // disabled -- one row contradicting its own record teaches the user to
        // distrust every other row in the same cascade. The projection's
        // `(disabled)` arm hard-codes both soft-dep flags false (ENBL-15 /
        // D-100-06), so this push needs no `dependencies` counterpart.
        //
        // The row inherits that arm's `needsReload: true` while the standalone
        // install-disabled row stamps `false`. The asymmetry is deliberate:
        // nothing net entered or left Pi's resource view inside the standalone
        // command, whereas this row shares the realized-transition arm every
        // other reconcile disable uses.
        outcomes.push({
          kind: "plugin-disabled",
          scope: op.scope,
          marketplace: op.marketplace,
          plugin: op.plugin,
          // DFEN-04 / OUT-01: name the author-declared cause, exactly as the
          // standalone row does. This is the surface that needs it MOST -- the
          // user hand-added a bare entry and reloaded, and without the token a
          // plugin silently arrives inert under a row indistinguishable from a
          // disable they asked for.
          reasons: ["installs disabled"],
          // OUT-04 / D-102-10: same reason -- an unrequested disable has to name
          // the remedy. The toggle arm below stamps neither field.
          enableHint: true,
          // The version slot every other reconcile `(disabled)` row fills.
          ...(result.version !== undefined && { version: result.version }),
          // S2 / PR #51: the post-commit warnings are collected on this path
          // exactly as on the install path -- none of the collection sites are
          // gated on the disabled verdict -- so drop them here and a permission
          // error on `pluginDataDir` or a preserved foreign agent file is
          // silently discarded, though both are still on disk.
          ...(result.postCommitWarnings !== undefined &&
            result.postCommitWarnings.length > 0 && {
              postCommitWarnings: result.postCommitWarnings,
            }),
        });
      } else if (result.status === "installed") {
        outcomes.push({
          kind: "plugin-installed",
          scope: op.scope,
          marketplace: op.marketplace,
          plugin: op.plugin,
          dependencies: dependenciesFromInstall(result),
          // S2 / PR #51: propagate post-commit warnings so the cascade
          // caller can surface them to the operator (mirrors
          // import/execute.ts:699-703 pushDiagnostic channel).
          ...(result.postCommitWarnings !== undefined &&
            result.postCommitWarnings.length > 0 && {
              postCommitWarnings: result.postCommitWarnings,
            }),
          // SURF-05 / D-63-08 / IN-07: propagate the orphan-rewake flag so the
          // reconcile composer pushes the `orphan rewake` token onto the
          // `(installed)` row, exactly as the enable arm below already does for
          // the same ledger run. Omitted when false (NREG-01).
          ...(result.orphanRewake === true && { orphanRewake: true }),
          // WARN-01 / D-86-03: propagate the degraded-component kinds so the
          // reconcile composer can raise the `(installed)` row to `warning`
          // and push the `malformed skill` / `malformed command` token.
          // Omitted when empty (NREG-01), mirroring the postCommitWarnings
          // conditional spread above.
          ...(result.degradedKinds !== undefined &&
            result.degradedKinds.length > 0 && {
              degradedKinds: result.degradedKinds,
            }),
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
  readonly buildSuccess: (info: {
    scope: Scope;
    marketplace: string;
    plugin: string;
    version?: string;
    /**
     * ENBL-07 / SURF-05 / WARN-01: the enable axis' degradation signals.
     * Always absent on the disable axis (a disable drops nothing and
     * materializes nothing -- it unstages everything), and absent on a clean
     * enable, so the disable arm's outcome shape is unchanged.
     */
    degradation?: EnableDegradationSignals;
  }) => PerEntryOutcome;
  readonly buildFailed: (info: {
    scope: Scope;
    marketplace: string;
    plugin: string;
    reason: Reason;
  }) => PerEntryOutcome;
}

/**
 * Lift the enable arm's degradation signals off the orchestrated outcome. Each
 * field is omitted when empty (`exactOptionalPropertyTypes`), so a clean enable
 * yields `{}` and its projected row is byte-identical (NREG-01).
 *
 * SEV-01 / D-98-02: the staged-count verdicts ride here too -- they drive the
 * projected row's dependency list, mirroring the install arm's
 * `dependenciesFromInstall` derivation.
 */
function degradationFromEnable(
  result: Extract<EnableDisablePluginOutcome, { status: "enabled" }>,
): EnableDegradationSignals {
  return {
    ...(result.unsupported !== undefined && { unsupported: result.unsupported }),
    ...(result.orphanRewake === true && { orphanRewake: true }),
    ...(result.degradedKinds !== undefined && { degradedKinds: result.degradedKinds }),
    ...(result.stagedAgents === true && { stagedAgents: true }),
    ...(result.stagedMcpServers === true && { stagedMcpServers: true }),
  };
}

async function applyPluginToggles(
  opts: ApplyReconcileOptions,
  ops: ReconcilePlan["pluginsToEnable"] | ReconcilePlan["pluginsToDisable"],
  outcomes: PerEntryOutcome[],
  axes: PluginToggleAxes,
): Promise<void> {
  // Y6: successStatus is derivable from `enable` -- enable=true => "enabled",
  // enable=false => "disabled". Deriving it here closes a redundant-axis
  // footgun where a caller could pass an inconsistent (enable, successStatus)
  // pair (e.g. enable:true + successStatus:"disabled").
  const successStatus: "enabled" | "disabled" = axes.enable ? "enabled" : "disabled";
  for (const op of ops) {
    try {
      // Y3 (PR #51): the orchestrated overload of setPluginEnabled returns
      // `Promise<EnableDisablePluginOutcome>` (no `| undefined`), so the
      // earlier `if (result === undefined) continue` silent-vanish guard is a
      // compile error and has been removed. Closes S6's fourth loop without
      // duplicating the import/execute.ts:613 fail-loud wording (the type
      // makes the branch unreachable instead of routing through a row).
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

      if (result.status === successStatus) {
        // ENBL-07 / SURF-05 / WARN-01: only the enable arm carries degradation
        // signals (a disable materializes nothing, so it degrades nothing). The
        // literal comparison is what narrows the union -- `successStatus` is a
        // variable, so the guard above does not narrow on its own.
        const degradation: EnableDegradationSignals =
          result.status === "enabled" ? degradationFromEnable(result) : {};
        outcomes.push(
          axes.buildSuccess({
            scope: op.scope,
            marketplace: op.marketplace,
            plugin: op.plugin,
            ...(result.version !== undefined && { version: result.version }),
            ...(Object.keys(degradation).length > 0 && { degradation }),
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
    // Per-cause propagation: each variant lifts its renderable fields onto
    // the corresponding SourceMismatchOutcome arm. The renderer derives
    // byte-identical output from the new variants via
    // `sourceMismatchOutcomeSubject` (mp-name for the first three causes;
    // rawKey for malformed-plugin-key).
    switch (m.cause) {
      case "source-mismatch":
        outcomes.push({
          kind: "source-mismatch",
          cause: "source-mismatch",
          scope: m.scope,
          marketplace: m.marketplace,
        });
        break;
      case "unknown-stored":
        outcomes.push({
          kind: "source-mismatch",
          cause: "unknown-stored",
          scope: m.scope,
          marketplace: m.marketplace,
        });
        break;
      case "dangling-reference":
        outcomes.push({
          kind: "source-mismatch",
          cause: "dangling-reference",
          scope: m.scope,
          marketplace: m.marketplace,
          plugin: m.plugin,
        });
        break;
      case "malformed-plugin-key":
        outcomes.push({
          kind: "source-mismatch",
          cause: "malformed-plugin-key",
          scope: m.scope,
          rawKey: m.rawKey,
        });
        break;
    }
  }
}

/**
 * Per-scope apply pass. Drives the orchestrators in the documented order
 * so each step's precondition is established by the previous step. NO
 * outer lock -- each orchestrator owns its per-scope critical section
 * (CR-01).
 *
 * Order rationale (data dependency):
 *   1. uninstall plugins whose marketplace is staying. The planner's
 *      `buildUninstallBucket` (`plan.ts::buildUninstallBucket`) deliberately
 *      EXCLUDES plugins under a to-be-removed marketplace (the
 *      removeMarketplace cascade unstages those whole-cloth, as WR-02 at
 *      `foldRemoveOutcome` reiterates) -- so this step targets only the
 *      "plugin declaration dropped, marketplace kept" axis. Running it
 *      first leaves the marketplace-remove step in step 2 with the
 *      smallest possible cascade footprint.
 *   2. remove marketplaces declared dropped (cascade-unstages any
 *      remaining plugins under them as a single transaction).
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
    // The signals ride `PluginEnabledOutcome` FLAT (it extends
    // `EnableDegradationSignals`), so the nested carrier is spread here.
    buildSuccess: ({ degradation, ...info }) => ({
      kind: "plugin-enabled",
      ...info,
      ...degradation,
    }),
    buildFailed: (info) => ({ kind: "plugin-enable-failed", ...info }),
  });
  await applyPluginToggles(opts, plan.pluginsToDisable, outcomes, {
    enable: false,
    // `degradation` is destructured off and DISCARDED: a disable materializes
    // nothing, so it has no degradation signals to report. Object spread
    // bypasses the excess-property check, so dropping the field explicitly is
    // what keeps a stray signal off the disabled outcome.
    buildSuccess: ({ degradation: _degradation, ...info }) => ({
      kind: "plugin-disabled",
      ...info,
    }),
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
      // S3 / PR #51: when the throw came from migrateFirstRunConfig's
      // inner saveConfig (EACCES on the scope dir blocking the atomic
      // tmp+rename), attribute to claude-plugins.json -- the file the
      // load pass was trying to WRITE, not state.json. Pre-fix every
      // read-pass throw lied about the failing file.
      const isMigrateSave = err instanceof MigrateConfigSaveError;
      const basename = isMigrateSave ? path.basename(err.configFilePath) : "state.json";
      // Unwrap the cause for classification so the closed-set reason
      // (`permission denied`, `unparseable`, etc.) reflects the underlying
      // error, not the sentinel.
      const classifiable = isMigrateSave ? err.cause : err;
      const causeText = errorMessage(classifiable);
      outcomes.push({
        kind: "invalid-block",
        scope,
        basename,
        reason: classifyReadPassThrow(classifiable),
        cause: new Error(redactAbsolutePaths(causeText)),
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

    // BFILL-01 / BFILL-02 / D-68-03: load-time backfill sibling step. Runs in
    // the no-outer-lock apply region (CR-01) after applyPlan so re-materialized
    // promotions ride the same single cascade (RECON-04). Gated on the version
    // stamp; stamps the running version whenever the gate opened. WR-02: a
    // transient lock-held / EACCES throw is coerced to a structured row so it
    // never aborts the cascade.
    await applyBackfillForScopeIsolated(opts, scope, readResult, outcomes);

    // DISP-02: after the per-scope apply pass (or the no-plan arm), rebuild
    // this scope's routing tables so the next Pi event fires against a
    // bucket reflecting the post-reconcile state. WR-01-style isolation:
    // a transient lock-held / EACCES throw is captured into a structured
    // `invalid-block` outcome via `rebuildScopeRoutingTableIsolated`.
    await rebuildScopeRoutingTableIsolated(scope, opts.cwd, outcomes);
  }

  // Empty-and-clean reconcile -> SILENT (NFR-2 / A4 / RECON-05). The load-
  // time invariant is that a no-op reconcile produces zero notifications;
  // the operator only hears from the extension when something happened.
  if (outcomes.length === 0) {
    return;
  }

  // Single CASCADE notify() per applyReconcile (IL-2 / RECON-04). The
  // projection T-55-02-02 contract: consumes only outcome.reason; raw
  // error.message never reaches the notify body.
  //
  // D-02 / MOD-03: thread RECONCILE_APPLIED_CONTEXT so the realized transition
  // rows render through reconcile's own render map, never the central
  // renderPluginRow switch. The `reconcile-applied-cascade` standalone envelope
  // (its content-derived severity + the load-time silence contract) stays
  // central and byte-identical via emitReconcileAppliedContextCascade.
  const message = buildReconcileAppliedCascade(outcomes);
  notifyReconcileAppliedWithContext(opts.ctx, opts.pi, RECONCILE_APPLIED_CONTEXT, message);

  // S2 / PR #51: post-cascade hygiene warnings. The cascade carries plugin
  // transition rows (installed/uninstalled/failed) under IL-2's single-
  // emission discipline; the post-commit warnings (data dir mkdir
  // deferred, completion-cache refresh deferred, agent foreign-content
  // preserved, bridge-side soft warnings) describe deferred side effects
  // AFTER the state mutation committed -- they have no clean
  // representation in MarketplaceNotificationMessage and mirror import's
  // pushDiagnostic channel. Surfacing them through a SECOND notify()
  // (warning severity) preserves the operator's ability to remediate
  // without contaminating the cascade body. This is the only sanctioned
  // exception to RECON-04's "single notify per applyReconcile" rule;
  // `install.ts::installPlugin` owns the orchestrated-mode collection
  // path that feeds it.
  surfacePostCommitWarnings(opts, outcomes);
}

/**
 * DISP-02: rebuild the per-scope routing tables under a brief read-only
 * `withLockedStateTransaction` so the rebuild observes a consistent state
 * snapshot. No `tx.save()` -- the rebuild is a pure cache walk that does
 * not mutate state. A transient lock-held / EACCES throw propagates so the
 * caller's WR-01 isolation arm coerces it into a structured
 * `invalid-block` outcome.
 *
 * Pristine-scope gate (WR-05): skip the rebuild entirely when state.json
 * does not exist -- the lock acquisition itself would mkdir the
 * extensionRoot, violating the "clean reconcile creates no unsolicited
 * files" contract. A scope without a state.json has zero installed plugins
 * to register anyway.
 */
async function rebuildScopeRoutingTable(scope: Scope, cwd: string): Promise<void> {
  const loc = locationsFor(scope, cwd);
  if (!(await pathExists(loc.stateJsonPath))) {
    return;
  }

  await withLockedStateTransaction(loc, async (_tx) => {
    rebuildRoutingTables();
    // NO tx.save() -- read-only snapshot acquisition.
    await Promise.resolve();
  });
}

/**
 * WR-01-isolated wrapper around `rebuildScopeRoutingTable`. A transient
 * lock-held / EACCES throw is captured as a structured `invalid-block`
 * outcome (subject `state.json`, closed-set reason) so the rebuild's
 * failure surfaces alongside the other per-scope outcomes instead of
 * aborting `applyReconcile` wholesale.
 */
async function rebuildScopeRoutingTableIsolated(
  scope: Scope,
  cwd: string,
  outcomes: PerEntryOutcome[],
): Promise<void> {
  await runScopeIsolated(scope, outcomes, () => rebuildScopeRoutingTable(scope, cwd));
}

export function surfacePostCommitWarnings(
  opts: ApplyReconcileOptions,
  outcomes: readonly PerEntryOutcome[],
): void {
  const lines: string[] = [];
  for (const o of outcomes) {
    // Both install-driven arms carry the field: `installPlugin` collects its
    // post-commit warnings after the state commit and gates none of them on the
    // DFEN-04 disabled verdict, so an install that landed disabled has the same
    // hygiene facts to report as one that landed enabled.
    if (o.kind !== "plugin-installed" && o.kind !== "plugin-disabled") {
      continue;
    }

    if (o.postCommitWarnings === undefined) {
      continue;
    }

    for (const w of o.postCommitWarnings) {
      // T-86-03 / NFR-9: collapse any absolute source path embedded in a
      // frontmatter parse-error detail (or any other post-commit warning) to
      // its basename before it reaches the operator-facing notifyDiagnostic
      // surface -- surface message text only, never a leaked filesystem path.
      lines.push(redactAbsolutePaths(w));
    }
  }

  if (lines.length === 0) {
    return;
  }

  // Route through the sanctioned `notifyDiagnostic` seam (S2 / PR #51) --
  // the only post-cascade notify exception to RECON-04's single-emit
  // discipline. Each warning prints on its own line under a one-line
  // header so the operator sees the total and the per-warning detail.
  const header =
    lines.length === 1
      ? "1 post-install warning surfaced from reconcile installs."
      : `${lines.length.toString()} post-install warnings surfaced from reconcile installs.`;
  notifyDiagnostic(opts.ctx, header, lines);
}

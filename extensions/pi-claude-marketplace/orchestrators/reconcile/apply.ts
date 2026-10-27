// orchestrators/reconcile/apply.ts
//
// RECON-01..05: the reconcile apply orchestrator behind `/claude:plugin
// apply` (APL-01). A load runs none of it (APL-03 / D-02) unless a config
// turns `autoapply` on (AAP-02); otherwise the load runs `load.ts`, which
// shares the read pass.
// behavioral-composition-exception: applyReconcile
//
// CONTRACT:
//   - Per-scope READ PASS (locked, WRITE-FREE -- WR-05), shared with the
//     load: `read-pass.ts::readPassForScope` (MIG-01, merged config load,
//     CFG-03, LAYER-06, the LOAD-01 verdict, the plan). state.json bytes +
//     mtime stay untouched.
//   - Per-scope APPLY PASS with NO outer lock (CR-01 lesson preserved): for
//     each scope's plan (skip when invalid-config aborted the read pass),
//     drive the orchestrators (uninstallPlugin, removeMarketplace,
//     addMarketplace, installPlugin, the missing-dependency install,
//     setPluginEnabled) in fixed order so each step's precondition
//     is established by the previous step:
//
//        uninstall -> remove -> add -> install -> install missing deps
//                  -> [D-09-07 re-plan when something landed] -> enable -> disable
//                  -> dependency-disable (LOAD-01)
//                  -> source-mismatch (report-only)
//                  -> converge
//
//     MISS-01 / D-09-06: `applyDependencyInstalls` installs a recorded
//     plugin's missing declared dependency on every apply, because `apply` is
//     the explicit command that changes state (D-02 supersedes D-09-13). It
//     drives the SAME cascade `installPlugin` drives, rooted at each missing
//     dependency instead of at a user-typed plugin. When it, or the install
//     step before it, materialized or found already-recorded at
//     least one key, D-09-07's `refreshTogglePlan` re-runs the read pass for
//     this scope and substitutes ONLY the fresh plan's `pluginsToEnable`,
//     `pluginsToDisable` and `pluginsToDependencyDisable` before the toggle
//     steps run -- the round-1 plan's uninstall / remove / add / install
//     buckets and its source-mismatch rows are never re-driven.
//
//     Each driven orchestrator call passes `notifications: { mode:
//     "orchestrated" }`. Every one of the loops wraps its call in a
//     try/catch so an unexpected throw becomes a typed `failed` outcome
//     (RECON-03 soft-fail) instead of aborting the whole cascade: the removal
//     and uninstall loops need it because both entrypoints resolve their
//     target BEFORE entering their own failure handling, so a state file
//     another process is mid-write reaches this boundary; the add, install
//     and toggle loops need it as defense-in-depth even though their three
//     entrypoints are documented to handle every throw internally and always
//     answer with a typed outcome, except an InvalidGitHubBaseUrlError, which
//     ends the pass (GHB-03). An install or enable that fails on it after
//     leaving a rollback partial or an MCP config rewrite (AFILE-04) answers
//     with its failed outcome instead; the pass continues, and a later target
//     that reads the base ends it -- see the note above each loop.
//   - CONVERGE per readable scope, after the apply pass (APL-02 / D-08):
//     `convergeScope` runs the planner `pending` uses over the scope as the
//     pass left it and materializes each revision move through the update
//     runner's converge entry (D-26), not reinstall. A move the planner holds
//     or declines is reported with the row `pending` lists and is not run
//     (D-12); a move that fails reports `(failed)` and the next move still
//     runs (D-13).
//   - AMIG-01 MCP MOVE per scope, after the read pass and before the apply
//     pass, also when the config is invalid and never after a read pass that
//     threw (`mcp-migration.ts`). It takes its own scope lock; a throw out of
//     it becomes a stopped row (NFR-2). One migration notice for both scopes
//     (`notifyMcpMigration`) precedes the cascade and is sent even when
//     reconcile has no outcome (AMIG-03).
//   - SINGLE notify() emission per applyReconcile invocation (IL-2 /
//     RECON-04). A pass that accumulated no outcome and no invalid-config row
//     reports `Apply: nothing to change.` through the `reconcile-pending-empty`
//     advisory and writes nothing (APL-01 / D-08). The load-time silence
//     contract for an unchanged tree belongs to `load.ts` (D-05); when an
//     autoapply load runs this pass (AAP-02), its `load` run keeps that
//     silence and the empty advisory is not sent.
//
// D-05 / D-07: the soft-dependency snapshot is the run the `apply` command
// (or, under autoapply, the load) opens before the pass, so it observes a
// stable pi-subagents / pi-mcp-adapter status.

import { locationsFor } from "../../persistence/locations.ts";
import { declaredDependencies } from "../../shared/concerns/soft-dep.ts";
import { hookDebugLog } from "../../shared/debug-log.ts";
import {
  DependencyCascadeError,
  DirectoryPinUnsatisfiedError,
  errorMessage,
} from "../../shared/errors.ts";
import {
  notify,
  notifyDiagnostic,
  notifyMcpConfigNotices,
} from "../../shared/notification-dispatch.ts";
import { type ContentReason, type Reason } from "../../shared/notification-types.ts";
import { ownValue } from "../../shared/own-key.ts";
import { redactAbsolutePaths, redactCauseChain } from "../../shared/redact-absolute-paths.ts";
import { withStateGuard } from "../../transaction/with-state-guard.ts";
import { addMarketplace } from "../marketplace/add.ts";
import { MarketplaceRemoveFailureError, removeMarketplace } from "../marketplace/remove.ts";
import { collectPluginClonesLocked } from "../plugin/clone-gc.ts";
import {
  createConvergeOperation,
  createDependencyInstallOperation,
  createEnableOperation,
  createInstallOperation,
  createUninstallOperation,
} from "../plugin/operations.ts";
import { degradationFromEnable } from "../plugin/shared.ts";
import { surfaceCascadeStagingDiagnostics } from "../plugin/staging-diagnostics.ts";
import { UninstallRefusedError } from "../plugin/uninstall.ts";

import {
  carriedMcpConfigNotices,
  carriedStagingWarnings,
  cascadeDisabledOutcome,
  classifyOrchestratorThrow,
  installFailureReasonFields,
  dependencyDisabledOutcome,
  sourceMismatchOutcomes,
  stagingDiagnosticsOf,
} from "./apply-outcomes.ts";
import {
  cascadeDependencies,
  dependenciesFirst,
  installedCopyReader,
  isPinnedCopy,
  planConvergenceCascade,
} from "./convergence.ts";
import { buildScopeSatisfactionVerdict, judgeFinalScope } from "./dependency-verdict.ts";
import { blockedMoveOutcomes, convergedMoveOutcomes, enabledMoveOutcome } from "./notify.ts";
import {
  closeScopePass,
  notifyScopePasses,
  openScopePass,
  readPassForScope,
  runScopeIsolated,
} from "./read-pass.ts";

import type {
  PerEntryOutcome,
  PluginConvergedOutcome,
  PluginDependencyDisabledOutcome,
  PluginEnableFailedOutcome,
} from "./apply-outcomes.ts";
import type { ConvergenceCascade, PlannedMove } from "./convergence.ts";
import type { ScopeSatisfactionVerdict, UnsatisfiedDeclaration } from "./dependency-verdict.ts";
import type { ReconcileStateReader, ScopePassAccumulators } from "./read-pass.ts";
import type {
  ApplyReconcileOptions,
  PlannedDependencyDisable,
  PlannedPluginEnable,
  PlannedPluginUninstall,
  ReconcilePlan,
  ScopeReadResult,
} from "./types.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { ExtensionState } from "../../persistence/state-io.ts";
import type { Scope } from "../../shared/types.ts";
import type { EnableDegradationSignals } from "../plugin/enable-disable.ts";
import type { UninstallPluginOperation } from "../plugin/uninstall.ts";
import type { MovedDependency, PluginUpdateOutcome } from "../types.ts";

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
      // eslint-disable-next-line no-await-in-loop -- each remove locks the scope (retries: 0)
      const result = await removeMarketplace({
        ctx: opts.ctx,
        run: opts.run,
        name: op.marketplace,
        completionCache: opts.completionCache,
        scope: op.scope,
        cwd: opts.cwd,
        notifications: { mode: "orchestrated" },
      });
      foldRemoveOutcome(result, op.scope, op.marketplace, outcomes);
    } catch (err) {
      // AFILE-04: a removal that threw after its plugin cascades rewrote MCP
      // config files carries their notices; its cause is the original throw.
      const carrier = err instanceof MarketplaceRemoveFailureError ? err : undefined;
      const failure = carrier === undefined ? err : carrier.cause;
      // The row carries only the closed-set `reason` (T-55-02-02); trace the
      // original error so an unrecognized throw isn't discarded with zero
      // record anywhere.
      hookDebugLog(
        `applyMarketplaceRemoves: unexpected throw for ${op.marketplace}: ${errorMessage(failure)}`,
        "reconcile",
      );
      outcomes.push({
        kind: "mp-remove-failed",
        scope: op.scope,
        marketplace: op.marketplace,
        reason: classifyOrchestratorThrow(failure),
        ...carriedMcpConfigNotices(carrier ?? {}),
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

    outcomes.push({ kind: "mp-removed", scope, marketplace, ...carriedMcpConfigNotices(result) });
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
    outcomes.push({
      kind: "mp-remove-partial",
      scope,
      marketplace,
      ...carriedMcpConfigNotices(result),
    });
    return;
  }

  outcomes.push({ kind: "mp-remove-failed", scope, marketplace, reason: result.reason });
}

/**
 * RECON-03 note: `addMarketplace` resolves its locations and parses its
 * source with two total functions and then enters one try whose catch routes
 * every classified AND unclassified error through `handleAddFailure`, which in
 * orchestrated mode returns a typed outcome; the post-guard cache and
 * mirror-seeding steps swallow their own failures. The orchestrated overload
 * carries that contract in its return type, so this loop reads the outcome
 * without a guard of its own. The exception is an `InvalidGitHubBaseUrlError`,
 * which `handleAddFailure` rethrows: it ends the reconcile pass, and the
 * `apply` command reports it as its command error (GHB-03).
 */
async function applyMarketplaceAdds(
  opts: ApplyReconcileOptions,
  plan: ReconcilePlan,
  outcomes: PerEntryOutcome[],
): Promise<void> {
  for (const op of plan.marketplacesToAdd) {
    // eslint-disable-next-line no-await-in-loop -- each add locks the scope (retries: 0)
    const result = await addMarketplace({
      ctx: opts.ctx,
      run: opts.run,
      scope: op.scope,
      cwd: opts.cwd,
      rawSource: op.source,
      completionCache: opts.completionCache,
      notifications: { mode: "orchestrated" },
      ...(opts.gitOps !== undefined && { gitOps: opts.gitOps }),
    });
    if (result.status === "added") {
      // CR-01: render the row on the name the record was actually created
      // under (`result.name` is the MANIFEST-derived name, which the
      // declared config key does not have to match). The planner's
      // source-based matching (plan.ts::buildMarketplaceClaims) makes the
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
  }
}

/**
 * One config-driven uninstall folded to its reconcile row. `undefined` is the
 * PU-5 silent converge (WR-06): the record was already gone -- another process
 * won the race or there was never an install -- so no row is rendered, because
 * reporting it would claim work this reconcile did not perform.
 */
async function applyOnePluginUninstall(
  uninstallPlugin: UninstallPluginOperation,
  opts: ApplyReconcileOptions,
  op: PlannedPluginUninstall,
): Promise<PerEntryOutcome | undefined> {
  try {
    const result = await uninstallPlugin({
      ctx: opts.ctx,
      run: opts.run,
      scope: op.scope,
      cwd: opts.cwd,
      marketplace: op.marketplace,
      plugin: op.plugin,
      notifications: { mode: "orchestrated" },
    });
    if (result.status === "converged") {
      return undefined;
    }

    if (result.status === "uninstalled") {
      return {
        kind: "plugin-uninstalled",
        scope: op.scope,
        marketplace: op.marketplace,
        plugin: op.plugin,
        ...(result.version !== undefined && { version: result.version }),
        ...carriedMcpConfigNotices(result),
      };
    }

    return {
      kind: "plugin-uninstall-failed",
      scope: op.scope,
      marketplace: op.marketplace,
      plugin: op.plugin,
      reason: result.reason,
      // D-05-16: only a refusal carries its cause onto the reconcile row.
      // Every other failed uninstall keeps the cause-less row, so no errno
      // message ever reaches this surface.
      ...(result.error instanceof UninstallRefusedError && { cause: result.error }),
      // AFILE-04: a failed uninstall can still have rewritten the MCP config.
      ...carriedMcpConfigNotices(result),
    };
  } catch (err) {
    // The row carries only the closed-set `reason` (T-55-02-02); trace the
    // original error so an unrecognized throw isn't discarded with zero
    // record anywhere.
    hookDebugLog(
      `applyPluginUninstalls: unexpected throw for ${op.plugin}@${op.marketplace}: ${errorMessage(err)}`,
      "reconcile",
    );
    return {
      kind: "plugin-uninstall-failed",
      scope: op.scope,
      marketplace: op.marketplace,
      plugin: op.plugin,
      reason: classifyOrchestratorThrow(err),
    };
  }
}

/** A D-05-14 / D-05-07 refusal: nothing left disk and nothing was saved. */
function isRefusedUninstall(outcome: PerEntryOutcome): boolean {
  return (
    outcome.kind === "plugin-uninstall-failed" && outcome.cause instanceof UninstallRefusedError
  );
}

/**
 * D-05-16: the uninstall bucket arrives in `state.json` record order, which
 * is the order the install cascade writes -- a dependency BEFORE the plugin
 * that declares it (D-03-07 post-order). Dropping both from config in one
 * edit would then refuse the dependency (its declarer is still recorded) and
 * remove the declarer, reporting a failure the user did not cause and leaving
 * the dependency for the next reload. A refusal is cheap and changes nothing
 * on disk, so refused entries are retried after each pass until a pass makes
 * no progress; only an entry's final outcome is reported. Progress is an
 * outcome settled in that pass. A PU-5 converge is neither refused nor
 * progress -- the record it found absent removed no declarer -- so a pass
 * that only converges and refuses ends the loop. The loop terminates: a
 * settled outcome means the refused set is strictly shorter than the pass
 * that produced it, and a pass that settles nothing returns. Reconcile still
 * never prunes (D-05-08): every entry here is one the config no longer
 * declares.
 */
async function applyPluginUninstalls(
  opts: ApplyReconcileOptions,
  plan: ReconcilePlan,
  outcomes: PerEntryOutcome[],
): Promise<void> {
  const uninstallPlugin =
    opts.uninstallPlugin ?? createUninstallOperation(opts.hooksRouting, opts.completionCache);
  let pending = plan.pluginsToUninstall;
  for (;;) {
    const refused: Array<{
      readonly op: PlannedPluginUninstall;
      readonly outcome: PerEntryOutcome;
    }> = [];
    let settled = 0;
    for (const op of pending) {
      // eslint-disable-next-line no-await-in-loop -- each uninstall locks the scope (retries: 0)
      const outcome = await applyOnePluginUninstall(uninstallPlugin, opts, op);
      if (outcome === undefined) {
        continue;
      }

      if (isRefusedUninstall(outcome)) {
        refused.push({ op, outcome });
      } else {
        outcomes.push(outcome);
        settled += 1;
      }
    }

    if (refused.length === 0 || settled === 0) {
      outcomes.push(...refused.map((entry) => entry.outcome));
      return;
    }

    pending = refused.map((entry) => entry.op);
  }
}

/**
 * RESV-06 / T-55-02-02 / T-53-02-02: rebuild a dependency-cascade failure's
 * message AND its nested cause chain with every absolute path redacted, so
 * the reconcile row's cause-chain trailer (`causeChainTrailer`, which walks
 * `.cause` WITHOUT redacting) never surfaces a leaked path from a
 * dependency's own ledger failure. `key` rides along unchanged so the
 * rebuilt value is the same error, not a new one.
 */
function redactedDependencyCascadeError(error: DependencyCascadeError): DependencyCascadeError {
  const message = redactAbsolutePaths(error.message);
  const cause = redactCauseChain(error.cause);
  return cause === undefined
    ? new DependencyCascadeError(message, error.key)
    : new DependencyCascadeError(message, error.key, { cause });
}

/**
 * UPD-DEP-D1 / CR-05: the dependency moves an install made, as `apply` rows
 * under each dependency's own marketplace and by its bare name, as a catalog
 * move's row reads; the range the move was made for stays on its cause line.
 * A move that did not land is left to the catalog step, which tries it again
 * and reports it with its closed-set reason (T-55-02-02).
 */
function movedDependencyOutcomes(
  scope: Scope,
  moved: readonly MovedDependency[],
): PluginConvergedOutcome[] {
  return moved.flatMap((entry) =>
    entry.row.status === "failed"
      ? []
      : [
          {
            kind: "plugin-converged",
            scope,
            marketplace: entry.marketplace,
            plugin: entry.name,
            row: { ...entry.row, name: entry.name },
          },
        ],
  );
}

/**
 * RECON-03 note: unlike the removal and uninstall loops, this one carries NO
 * per-entry try/catch. `installPlugin` documents that it never re-throws: its
 * whole body sits inside one try whose catch returns a typed failed outcome in
 * orchestrated mode, and the only awaited statement after that catch collects
 * post-commit warnings behind its own swallowing guards. The orchestrated
 * overload carries that contract in its return type, so this loop reads the
 * outcome without a guard of its own. The exception is an
 * `InvalidGitHubBaseUrlError`, which the catch rethrows: it ends the reconcile
 * pass, and the `apply` command reports it as its command error (GHB-03). An
 * install that fails on it after leaving a rollback partial or an MCP config
 * rewrite (AFILE-04) returns its failed outcome instead: the pass continues
 * past that plugin, and a later target that reads the base ends it.
 *
 * Returns whether any install landed: the read pass judged the scope without
 * it, so its toggle buckets are stale (D-09-07).
 */
async function applyPluginInstalls(
  opts: ApplyReconcileOptions,
  plan: ReconcilePlan,
  outcomes: PerEntryOutcome[],
): Promise<boolean> {
  const installPlugin = createInstallOperation(opts.hooksRouting, opts.completionCache);
  let installed = false;
  for (const op of plan.pluginsToInstall) {
    // eslint-disable-next-line no-await-in-loop -- each install locks the scope (retries: 0)
    const result = await installPlugin({
      ctx: opts.ctx,
      run: opts.run,
      scope: op.scope,
      cwd: opts.cwd,
      marketplace: op.marketplace,
      plugin: op.plugin,
      notifications: { mode: "orchestrated" },
      // UPD-DEP-D1 / MISS-01: apply's missing-dependency step installs what a
      // moved dependency's new version needs, as `pending` previews it.
      dependencyInstallsFollow: true,
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
    // UPD-DEP-D1: the dependencies the install moved into range first report
    // as the catalog moves they are, so `apply` lists every change it made.
    outcomes.push(...movedDependencyOutcomes(op.scope, result.movedDependencies ?? []));
    installed ||= result.status === "installed";

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
        // AFILE-04: the install rewrote the MCP config before its disable
        // cascade unstaged it again, so the notices ride this row too.
        ...carriedMcpConfigNotices(result),
      });
    } else if (result.status === "installed") {
      outcomes.push({
        kind: "plugin-installed",
        scope: op.scope,
        marketplace: op.marketplace,
        plugin: op.plugin,
        ...(result.version !== undefined && { version: result.version }),
        dependencies: declaredDependencies(result),
        // S2 / PR #51: propagate post-commit warnings so the cascade
        // caller can surface them to the operator (mirrors the
        // `pushDiagnostic` channel in
        // `import/execute.ts::installOnePlannedPlugin`).
        ...(result.postCommitWarnings !== undefined &&
          result.postCommitWarnings.length > 0 && {
            postCommitWarnings: result.postCommitWarnings,
          }),
        ...installedRowDegradation(result),
        ...carriedMcpConfigNotices(result),
      });
    } else {
      outcomes.push({
        kind: "plugin-install-failed",
        scope: op.scope,
        marketplace: op.marketplace,
        plugin: op.plugin,
        ...installFailureReasonFields(result.error),
        // RESV-06: only a dependency-cascade failure carries a cause onto
        // this row. Redact defensively (T-55-02-02 / T-53-02-02) -- the
        // closure/constraint arms build their message from keys and version
        // constraints alone, but a dependency's own ledger failure can carry
        // a path anywhere in its cause chain. `causeChainTrailer` walks
        // `.cause` without redacting, so `redactedDependencyCascadeError`
        // rebuilds the FULL chain (via `redactCauseChain`) with every link
        // redacted, instead of dropping it.
        ...(result.error instanceof DependencyCascadeError && {
          cause: redactedDependencyCascadeError(result.error),
        }),
        // AFILE-04: dependencies that committed before the failure rewrote
        // the MCP config, so their notices ride the failed row.
        ...carriedMcpConfigNotices(result),
      });
    }
  }

  return installed;
}

/**
 * MISS-01 / MISS-02 / D-09-06: drive the missing-dependency install for
 * every entry the read pass's `pluginsToDependencyInstall` bucket planned.
 *
 * D-09-09: on `installed`, one `plugin-installed` outcome is pushed PER
 * cascade member -- every materialized member gets a row under its own
 * marketplace block, keyed by that member's OWN name and marketplace, not
 * the bucket entry's. `postCommitWarnings` and the root ledger run's
 * `installedRowDegradation` signals ride only the member whose key equals the
 * entry's root key, and any member that fell back to its current copy carries
 * `dependencyCurrentCopy` (TAGS-02); `alreadyInstalled` members are not
 * carried by the outcome at all and get no row (D-09-11). On `failed`, ONE
 * `plugin-install-failed` outcome is pushed keyed by the DEPENDENCY's own
 * `op.marketplace` / `op.plugin`, reusing `classifyOrchestratorThrow` and
 * `redactedDependencyCascadeError` verbatim -- the same reused path
 * `applyPluginInstalls`'s failure arm already uses (D-09-10).
 *
 * Returns whether ANY entry was installed or skipped: both mean the
 * read-pass toggle verdict predates this step and is stale for that key
 * (D-09-07).
 */
async function applyDependencyInstalls(
  opts: ApplyReconcileOptions,
  plan: ReconcilePlan,
  outcomes: PerEntryOutcome[],
): Promise<boolean> {
  const installMissingDependency = createDependencyInstallOperation(
    opts.hooksRouting,
    opts.completionCache,
  );
  let satisfied = false;
  for (const op of plan.pluginsToDependencyInstall) {
    const rootKey = `${op.plugin}@${op.marketplace}`;
    // eslint-disable-next-line no-await-in-loop -- each install locks the scope (retries: 0)
    const result = await installMissingDependency({
      ctx: opts.ctx,
      run: opts.run,
      scope: op.scope,
      cwd: opts.cwd,
      marketplace: op.marketplace,
      plugin: op.plugin,
      ranges: op.ranges,
      requiredBy: op.requiredBy,
      declarers: op.declarers,
      ...(op.requirers !== undefined && { requirers: op.requirers }),
    });

    if (result.status === "skipped") {
      satisfied = true;
      continue;
    }

    if (result.status === "installed") {
      satisfied = true;
      for (const member of result.members) {
        outcomes.push({
          kind: "plugin-installed",
          scope: op.scope,
          marketplace: member.marketplace,
          plugin: member.name,
          version: member.version,
          dependencies: declaredDependencies(member),
          dependencyInstalled: true,
          ...(member.key === rootKey &&
            result.postCommitWarnings !== undefined &&
            result.postCommitWarnings.length > 0 && {
              postCommitWarnings: result.postCommitWarnings,
            }),
          // The root's own degradation signals, gated on the member being the
          // root exactly as `postCommitWarnings` is above --
          // `InstallMissingDependencyOutcome` carries them only for the root's
          // own ledger run, never per member.
          ...(member.key === rootKey && installedRowDegradation(result)),
          // AFILE-04: the cascade's notices ride the root's row, like the
          // warnings above; the root is always a materialized member.
          ...(member.key === rootKey && carriedMcpConfigNotices(result)),
          // TAGS-02: `fellBackToCurrentCopy` is a REQUIRED member fact
          // (`CascadeMemberOutcome`); every member, not only the root, can
          // have fallen back to its current copy.
          ...(member.fellBackToCurrentCopy && { dependencyCurrentCopy: true }),
        });
      }

      continue;
    }

    outcomes.push({
      kind: "plugin-install-failed",
      scope: op.scope,
      marketplace: op.marketplace,
      plugin: op.plugin,
      ...installFailureReasonFields(result.error, result.reason),
      ...(result.error instanceof DependencyCascadeError && {
        cause: redactedDependencyCascadeError(result.error),
      }),
      ...(result.error instanceof DirectoryPinUnsatisfiedError && { cause: result.error }),
      ...carriedMcpConfigNotices(result),
    });
  }

  return satisfied;
}

/**
 * D-09-07: after `applyPluginInstalls` installed a plugin, or
 * `applyDependencyInstalls` materialized or found already present at least one
 * key, the round-1 read pass's toggle buckets predate that change -- its
 * `pluginsToDependencyDisable` still holds a dependent these steps just
 * satisfied and its `pluginsToEnable` still excludes it (D-06-03).
 * Re-running `readPassForScope` for this scope and taking ONLY
 * `pluginsToEnable`, `pluginsToDisable` and `pluginsToDependencyDisable` from
 * the fresh plan is what lets a marker-held dependent come back up in the
 * SAME reload. The uninstall / remove / add / install buckets of the fresh
 * plan are NEVER re-driven (a round-1 failure would be retried and
 * double-reported), and source-mismatch rows stay round-1's.
 *
 * `readPassForScope` acquires and releases its own lock; the apply region
 * holds none, and `applyDependencyInstalls`'s entry point released its own
 * lock before returning, so this second read never re-enters
 * `proper-lockfile`. A throw (or a config that turned invalid between passes)
 * is coerced by `runScopeIsolated` into the `state.json` row the other
 * isolated apply steps produce, and this function returns the round-1 plan
 * untouched -- there is no third arm: `readPassForScope` cannot answer with
 * neither a plan nor an invalid-config row for a scope this step just wrote
 * to.
 */
async function refreshTogglePlan(
  reader: ReconcileStateReader,
  opts: ApplyReconcileOptions,
  toggles: TogglePlan,
  outcomes: PerEntryOutcome[],
): Promise<TogglePlan> {
  const plan = toggles.plan;
  let fresh: ScopeReadResult = { plan: undefined, invalidOutcomes: [] };
  await runScopeIsolated(plan.scope, outcomes, async () => {
    fresh = await readPassForScope(reader, plan.scope, opts.cwd);
  });

  outcomes.push(...fresh.invalidOutcomes);
  return fresh.plan === undefined
    ? toggles
    : {
        plan: {
          ...plan,
          pluginsToEnable: fresh.plan.pluginsToEnable,
          pluginsToDisable: fresh.plan.pluginsToDisable,
          pluginsToDependencyDisable: fresh.plan.pluginsToDependencyDisable,
        },
        deferredEnables: fresh.deferredEnables ?? [],
      };
}

/** A plan's toggles and the enables that wait on its catalog moves (APPLY1-01). */
interface TogglePlan {
  readonly plan: ReconcilePlan;
  readonly deferredEnables: readonly PlannedPluginEnable[];
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
 * SURF-05 / D-63-08 / WARN-01 / D-86-03: the degradation signals an install
 * outcome carries onto its `(installed)` projection, so the reconcile composer
 * pushes the `orphan rewake` token and raises the row to `warning` with the
 * `malformed skill` / `malformed command` token. Both the config-driven
 * install arm and the reload dependency-install arm spread this one
 * derivation. Omitted when false or empty (NREG-01), mirroring the
 * `postCommitWarnings` conditional spread at each call site.
 */
function installedRowDegradation(
  result: Pick<EnableDegradationSignals, "orphanRewake" | "degradedKinds">,
): Pick<EnableDegradationSignals, "orphanRewake" | "degradedKinds"> {
  return {
    ...(result.orphanRewake === true && { orphanRewake: true }),
    ...(result.degradedKinds !== undefined &&
      result.degradedKinds.length > 0 && { degradedKinds: result.degradedKinds }),
  };
}

/**
 * RECON-03 note: `setPluginEnabled` documents that it never re-throws: its
 * cross-scope resolution and its transaction each sit inside a try whose
 * catch returns a typed failed outcome in orchestrated mode, and what follows
 * is a pure mapping. The orchestrated overload carries that contract in its
 * return type, so this loop reads the outcome without a guard of its own. The
 * exception is an enable that fails on an `InvalidGitHubBaseUrlError`, which
 * the mapping rethrows: it ends the reconcile pass, and the `apply` command
 * reports it as its command error (GHB-03). An enable that fails on it after
 * leaving a rollback partial or an MCP config rewrite (AFILE-04) returns its
 * failed outcome instead: the pass continues past that plugin, and a later
 * target that reads the base ends it.
 */
async function applyPluginToggles(
  opts: ApplyReconcileOptions,
  ops: ReconcilePlan["pluginsToEnable"] | ReconcilePlan["pluginsToDisable"],
  outcomes: PerEntryOutcome[],
  axes: PluginToggleAxes,
): Promise<void> {
  const setPluginEnabled = createEnableOperation(opts.hooksRouting);
  // Y6: successStatus is derivable from `enable` -- enable=true => "enabled",
  // enable=false => "disabled". Deriving it here closes a redundant-axis
  // footgun where a caller could pass an inconsistent (enable, successStatus)
  // pair (e.g. enable:true + successStatus:"disabled").
  const successStatus: "enabled" | "disabled" = axes.enable ? "enabled" : "disabled";
  for (const op of ops) {
    // Y3 (PR #51): the orchestrated overload of setPluginEnabled returns
    // `Promise<EnableDisablePluginOutcome>` (no `| undefined`), so a
    // `if (result === undefined) continue` silent-vanish guard would be a
    // compile error. Closes S6's fourth loop without
    // duplicating the fail-loud wording in
    // `import/execute.ts::addOnePlannedMarketplace` (the type makes the
    // branch unreachable instead of routing through a row).
    // eslint-disable-next-line no-await-in-loop -- each toggle locks the scope (retries: 0)
    const result = await setPluginEnabled({
      ctx: opts.ctx,
      run: opts.run,
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
      outcomes.push({
        ...axes.buildSuccess({
          scope: op.scope,
          marketplace: op.marketplace,
          plugin: op.plugin,
          ...(result.version !== undefined && { version: result.version }),
          ...(Object.keys(degradation).length > 0 && { degradation }),
        }),
        ...carriedMcpConfigNotices(result),
        // D-PL1-09: a disable stages nothing, so only the enable arm carries them.
        ...(result.status === "enabled" ? carriedStagingWarnings(result) : {}),
      });
    } else if (result.status === "failed") {
      outcomes.push({
        ...axes.buildFailed({
          scope: op.scope,
          marketplace: op.marketplace,
          plugin: op.plugin,
          reason: result.reason,
        }),
        // AFILE-04: a toggle that failed after its cascade rewrote the MCP
        // config still reports the rewrite.
        ...carriedMcpConfigNotices(result),
      });
    }
    // skipped (idempotent) -> intentionally drop; the steady state isn't a
    // user-visible action.
  }
}

/**
 * LOAD-01 / D-06-02: stamp the consequence-disable marker on the records this
 * pass just transitioned, in ONE locked transaction for the whole bucket.
 *
 * SPLIT-02 / NFR-1: the write routes through `withStateGuard` -> `saveState`,
 * never a bare atomic JSON write, and every path comes from the branded
 * `ScopedLocations` bundle. CR-01: it takes its own per-scope lock, which is
 * legal because the surrounding apply region holds none.
 *
 * Only a record the step itself flipped from enabled to disabled is stamped. A
 * record already disabled for any other reason -- the user's own `disable`, or
 * a config-declared `enabled: false` -- is left alone, which is what keeps the
 * user's own choice distinguishable from the check's consequence.
 *
 * A record that vanished between the transition and this write is skipped: the
 * marker is re-derived every pass, so there is nothing to recover.
 */
async function stampDependencyDisabled(
  opts: ApplyReconcileOptions,
  scope: Scope,
  transitioned: readonly PlannedDependencyDisable[],
): Promise<void> {
  const loc = locationsFor(scope, opts.cwd);
  await withStateGuard(loc, (fresh) => {
    for (const op of transitioned) {
      const record = ownValue(ownValue(fresh.marketplaces, op.marketplace)?.plugins, op.plugin);
      if (record !== undefined) {
        record.dependencyDisabled = true;
      }
    }
  });
}

/**
 * LOAD-01: perform the load-time disable for every plugin the planner found
 * held down by an unsatisfied declaration.
 *
 * The disable itself is delegated to `setPluginEnabled` in orchestrated mode,
 * the same seam the toggle buckets drive. That is what makes the plugin
 * actually stop loading: resource discovery walks the materialized directories
 * and never reads a record, so flipping `enabled` without the unstage cascade
 * would leave every skill, prompt, agent, MCP entry and hook of a "disabled"
 * plugin live on the next session. RECON-03: the orchestrated mode SKIPS the
 * config write-back, so the consequence-disable never makes the user's own
 * `claude-plugins.json` claim a choice they did not make (D-04-02 / LOAD-02).
 *
 * The marker is stamped afterwards, in one transaction for the whole bucket,
 * because `setPluginEnabled` owns its own lock and `toDisabledRecord` takes no
 * third argument. A crash between the two writes leaves a disabled record with
 * no marker; the next pass re-derives the same verdict, keeps the record down
 * and plans no enable for it, so the hold survives the gap.
 *
 * An already-disabled record answers idempotently and is neither stamped nor
 * reported -- a row for it would break the load-time silence contract on every
 * reload of an unchanged tree (RECON-05).
 *
 * CR-01: each row lands in `outcomes` as its disable commits, BEFORE the stamp
 * write. The stamp takes its own lock and can throw, and the `runScopeIsolated`
 * wrapper at the call site converts that throw into one `state.json` row --
 * so a row this loop still held would be dropped for a disable that already
 * happened, leaving the user with plugins gone from the session and no names,
 * no `{dependency unsatisfied}` brace and no remedy. The next pass re-derives
 * the same verdict, reaches the idempotent already-disabled arm and reports
 * nothing, so a row lost here is lost permanently. Emitting inside the loop
 * also matches every sibling apply step; no other producer appends to
 * `outcomes` between here and the stamp, so the ordering is unchanged.
 *
 * `opts.stampDependencyDisabled` is the seam that pins this. It exists because
 * the ordering has no other observable: a test that fails the stamp through the
 * filesystem fails the disable first. A case injects a throwing stamp and
 * asserts the disable rows still reach the cascade beside the `state.json` row
 * the wrapper builds from the throw.
 */
async function applyDependencyDisables(
  opts: ApplyReconcileOptions,
  scope: Scope,
  ops: readonly PlannedDependencyDisable[],
  outcomes: { push: (...rows: PluginRow[]) => number },
  disabledOutcome: (
    op: PlannedDependencyDisable,
    version: string | undefined,
  ) => PluginDependencyDisabledOutcome = dependencyDisabledOutcome,
): Promise<void> {
  const setPluginEnabled = createEnableOperation(opts.hooksRouting);
  const transitioned: PlannedDependencyDisable[] = [];
  for (const op of ops) {
    // eslint-disable-next-line no-await-in-loop -- each disable locks the scope (retries: 0)
    const result = await setPluginEnabled({
      ctx: opts.ctx,
      run: opts.run,
      cwd: opts.cwd,
      marketplace: op.marketplace,
      plugin: op.plugin,
      enable: false,
      scope: op.scope,
      notifications: { mode: "orchestrated" },
    });

    if (result.status === "disabled") {
      transitioned.push(op);
      outcomes.push({
        ...disabledOutcome(op, result.version),
        ...carriedMcpConfigNotices(result),
      });
    } else if (result.status === "failed") {
      outcomes.push({
        kind: "plugin-disable-failed",
        scope: op.scope,
        marketplace: op.marketplace,
        plugin: op.plugin,
        reason: result.reason,
        ...carriedMcpConfigNotices(result),
      });
    }
  }

  if (transitioned.length > 0) {
    const stamp = opts.stampDependencyDisabled;
    await (stamp === undefined
      ? stampDependencyDisabled(opts, scope, transitioned)
      : stamp(scope, transitioned));
  }
}

const ENABLE_AXES: PluginToggleAxes = {
  enable: true,
  // The signals ride `PluginEnabledOutcome` FLAT (it extends
  // `EnableDegradationSignals`), so the nested carrier is spread here.
  buildSuccess: ({ degradation, ...info }) => ({
    kind: "plugin-enabled",
    ...info,
    ...degradation,
  }),
  buildFailed: (info) => ({ kind: "plugin-enable-failed", ...info }),
};

/**
 * The two `applyPluginToggles` calls and the LOAD-01 dependency-disable step,
 * extracted out of `applyPlan` so it can run this once against round 1's plan
 * (nothing satisfied by step 5) or once against `refreshTogglePlan`'s D-09-07
 * replacement plan (something was). Unchanged otherwise: WR-02-style
 * isolation still wraps the dependency-disable step's own stamp write, whose
 * throw would otherwise discard every outcome accumulated for both scopes.
 */
async function applyToggleSteps(
  opts: ApplyReconcileOptions,
  plan: ReconcilePlan,
  outcomes: PerEntryOutcome[],
): Promise<void> {
  await applyPluginToggles(opts, plan.pluginsToEnable, outcomes, ENABLE_AXES);
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
  await runScopeIsolated(plan.scope, outcomes, () =>
    applyDependencyDisables(opts, plan.scope, plan.pluginsToDependencyDisable, outcomes),
  );
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
 *   5. MISS-01 / D-09-06: install every missing declared dependency of an
 *      eligible dependent, ROOTED AT THE DEPENDENCY -- on every apply (D-02).
 *      A config-declared install from step 4 that already claimed this key
 *      answers idempotently (D-09-06).
 *   5a. D-09-07: when step 4 installed a plugin, or step 5 materialized or
 *      found already-present at least one key, re-run the read pass for this
 *      scope and take ONLY
 *      `pluginsToEnable`, `pluginsToDisable` and `pluginsToDependencyDisable`
 *      from the fresh plan -- the round-1 plan's own uninstall / remove / add
 *      / install buckets and its source-mismatch rows are never re-driven.
 *      This is what lets a dependent steps 4 and 5 just satisfied stay up (or
 *      come back up) in the SAME reload instead of the next one; steps 4 and
 *      5 installing nothing leave the round-1 plan standing and cost nothing
 *      extra.
 *   6. enable plugins newly declared enabled (round-1 or 5a's replacement).
 *   7. disable plugins newly declared disabled (round-1 or 5a's replacement).
 *   8. disable plugins the load-time check holds down (LOAD-01, round-1 or
 *      5a's replacement). It runs AFTER both toggle steps so a record the
 *      config already disabled in step 7 answers this step idempotently and
 *      is left unstamped (D-06-02). WR-05: a plugin INSTALLED by step 4 is
 *      not held down by the round-1 bucket, which the read pass built from a
 *      verdict over the pre-install snapshot, where that plugin has no record
 *      and is therefore no declarer; step 5a's re-plan holds it down.
 *   9. source-mismatch / dangling rows (report-only), ALWAYS from the
 *      round-1 plan (D-09-07) -- folded last.
 */
async function applyPlan(
  reader: ReconcileStateReader,
  opts: ApplyReconcileOptions,
  round1: TogglePlan,
  outcomes: PerEntryOutcome[],
): Promise<readonly PlannedPluginEnable[]> {
  const plan = round1.plan;
  await applyPluginUninstalls(opts, plan, outcomes);
  await applyMarketplaceRemoves(opts, plan, outcomes);
  await applyMarketplaceAdds(opts, plan, outcomes);
  const installed = await applyPluginInstalls(opts, plan, outcomes);
  const satisfied = await applyDependencyInstalls(opts, plan, outcomes);
  const toggles =
    installed || satisfied ? await refreshTogglePlan(reader, opts, round1, outcomes) : round1;
  await applyToggleSteps(opts, toggles.plan, outcomes);
  outcomes.push(...sourceMismatchOutcomes(plan));
  return toggles.deferredEnables;
}

/**
 * APL-02 / D-08 / D-10: converge one scope on its catalog, after its apply
 * pass. Only a scope whose read pass produced a plan gets here: a pristine
 * scope (WR-05) and a scope whose config the read pass rejected (CFG-03) have
 * none. The state is read fresh, so the planner takes no plan: the scope
 * already reflects it. A read that throws moves nothing and becomes the
 * `state.json` row every isolated step reports (WR-01), pushed onto
 * `failures`, so `apply` never says it has nothing to change while the
 * scope's moves stay pending (NFR-3).
 *
 * APPLY1-01: the moves run as one cascade, dependencies first (D-26), with
 * each deferred enable in its place (`runCascade`). Whatever lands, the scope
 * is then judged as it stands (`judgeScopeAfterCascade`), so no `apply`
 * leaves an enabled plugin on an unmet or disabled dependency. The judgement,
 * the hold rows and the rows of the steps that ran also go out when the
 * cascade ends on an `InvalidGitHubBaseUrlError` (GHB-03), which still ends
 * the pass.
 */
async function convergeScope(
  reader: ReconcileStateReader,
  opts: ApplyReconcileOptions,
  scope: Scope,
  deferred: readonly PlannedPluginEnable[],
  outcomes: PerEntryOutcome[],
  failures: PerEntryOutcome[],
): Promise<void> {
  const locations = locationsFor(scope, opts.cwd);
  const planned: { cascade?: ConvergenceCascade; before?: CascadeStart } = {};
  await runScopeIsolated(scope, failures, async () => {
    const state = await reader.loadState(locations.extensionRoot);
    const enable = new Set(deferred.map(pluginKey));
    planned.cascade = await planConvergenceCascade({ scope, state, locations, enable });
    const verdict = await buildScopeSatisfactionVerdict({ state, locations });
    planned.before = { state, unsatisfied: verdict.ok ? verdict.unsatisfied : [] };
  });
  const { cascade, before } = planned;
  if (cascade === undefined || before === undefined) {
    return;
  }

  // WR-D: an enable the toggle step could not make is a dependency that did
  // not land for every step that declares it.
  const failed: FailedSteps = {
    all: new Set(failedEnables(outcomes, scope)),
    own: new Set(),
  };
  const reports: StepReport[] = [];
  try {
    await runCascade(opts, cascade, { scope, deferred, before: before.state, failed, reports });
  } finally {
    const disabled: PluginRow[] = [];
    const enabledAtEnd = new Set<string>();
    await runScopeIsolated(scope, outcomes, () =>
      judgeScopeAfterCascade(reader, opts, scope, {
        cascade,
        before,
        failed,
        ran: reports.length > 0,
        refused: refusedDisables(outcomes, scope),
        disabled,
        enabledAtEnd,
      }),
    );
    outcomes.push(
      ...cascadeRows(cascade, reports, {
        disabled: withoutUndoneEnables(outcomes, scope, disabled),
        enabledAtEnd,
      }),
    );
  }
}

/**
 * WR-B: a plugin the toggle step enabled and the judgement disabled again is
 * as it was before the apply, so neither its `(installed)` row nor its
 * `(disabled)` row is reported; the failure that held it has its own row.
 */
function withoutUndoneEnables(
  outcomes: PerEntryOutcome[],
  scope: Scope,
  disabled: readonly PluginRow[],
): PluginRow[] {
  const disabledKeys = new Set(
    disabled.filter((row) => row.kind === "plugin-dependency-disabled").map(pluginKey),
  );
  const isUndone = (outcome: PerEntryOutcome): outcome is PluginRow =>
    outcome.kind === "plugin-enabled" &&
    outcome.scope === scope &&
    disabledKeys.has(pluginKey(outcome));
  const undone = new Set(outcomes.filter(isUndone).map(pluginKey));
  outcomes.splice(0, outcomes.length, ...outcomes.filter((outcome) => !isUndone(outcome)));
  return disabled.filter((row) => !undone.has(pluginKey(row)));
}

function failedEnables(outcomes: readonly PerEntryOutcome[], scope: Scope): readonly string[] {
  return keysOfKind(outcomes, scope, "plugin-enable-failed");
}

/** The plugins whose disable this apply already tried and was refused. */
function refusedDisables(outcomes: readonly PerEntryOutcome[], scope: Scope): ReadonlySet<string> {
  return new Set(keysOfKind(outcomes, scope, "plugin-disable-failed"));
}

function keysOfKind(
  outcomes: readonly PerEntryOutcome[],
  scope: Scope,
  kind: "plugin-enable-failed" | "plugin-disable-failed",
): string[] {
  return outcomes.flatMap((outcome) =>
    outcome.kind === kind && outcome.scope === scope ? [pluginKey(outcome)] : [],
  );
}

function pluginKey(op: { readonly plugin: string; readonly marketplace: string }): string {
  return `${op.plugin}@${op.marketplace}`;
}

/** The scope before the cascade: its state, and what the load-time check left unmet. */
interface CascadeStart {
  readonly state: ExtensionState;
  readonly unsatisfied: readonly UnsatisfiedDeclaration[];
}

/**
 * The cascade steps that did not land: every one, and the moves that failed on
 * their own, with the reasons their rows gave.
 */
interface FailedSteps {
  readonly all: Set<string>;
  readonly own: Set<string>;
}

/** One step's rows, keyed so the judgement after the cascade can replace them. */
interface StepReport {
  readonly key: string;
  readonly rows: readonly PerEntryOutcome[];
  /** A row the judgement's `(disabled)` row replaces: the step did not run. */
  readonly replaceable?: true;
}

/** One cascade step: a catalog move, a deferred enable, or both. */
type CascadeStep =
  | { readonly key: string; readonly move: PlannedMove; readonly enable?: PlannedPluginEnable }
  | { readonly key: string; readonly move?: undefined; readonly enable: PlannedPluginEnable };

/**
 * IN-C: whether a move landed. A deferred record's move only refreshes its pin
 * and answers `{already disabled}`; its enable decides. A move that landed on
 * another version than the plan judged landed too: the judgement after the
 * cascade measures it.
 */
function moveLanded(result: PluginUpdateOutcome, deferred: boolean): boolean {
  if (result.partition === "skipped") {
    return deferred && result.reasons.includes("already disabled");
  }

  return result.partition !== "failed";
}

/**
 * APPLY1-01: the cascade's steps in order, dependencies first: each move, and
 * each deferred enable, which follows its own move (CR-03) or, with no move of
 * its own, the steps it waits on.
 */
function cascadeSteps(
  cascade: ConvergenceCascade,
  deferred: readonly PlannedPluginEnable[],
): readonly CascadeStep[] {
  const enables = new Map(deferred.map((op) => [pluginKey(op), op]));
  const moved = cascade.plan.moves.map((move): CascadeStep => {
    const enable = enables.get(pluginKey(move));
    return { key: pluginKey(move), move, ...(enable !== undefined && { enable }) };
  });
  const movedKeys = new Set(moved.map((step) => step.key));
  const alone = deferred
    .filter((op) => !movedKeys.has(pluginKey(op)))
    .map((op): CascadeStep => ({ key: pluginKey(op), enable: op }));
  return dependenciesFirst([...moved, ...alone], (step) => step.key, cascade.declarations);
}

/** What one cascade run needs besides the cascade. */
interface CascadeRun {
  readonly scope: Scope;
  readonly deferred: readonly PlannedPluginEnable[];
  /** The scope before the cascade, whose pins a failed deferred enable restores. */
  readonly before: ExtensionState;
  readonly failed: FailedSteps;
  readonly reports: StepReport[];
}

/**
 * APPLY1-01: runs the cascade's steps in order. A step that declares one that
 * did not land is not run. A move reports `(skipped) {dependency failed}`; a
 * deferred enable that does not run leaves its record as it was and reports
 * nothing (WR-B).
 */
async function runCascade(
  opts: ApplyReconcileOptions,
  cascade: ConvergenceCascade,
  run: CascadeRun,
): Promise<void> {
  const convergePlugin = createConvergeOperation(opts.hooksRouting, opts.completionCache);
  for (const step of cascadeSteps(cascade, run.deferred)) {
    if (
      run.failed.all.has(step.key) ||
      cascadeDependencies(cascade, step.key).some((dep) => run.failed.all.has(dep))
    ) {
      run.failed.all.add(step.key);
      run.reports.push({ key: step.key, rows: dependencyFailedRows(step), replaceable: true });
      continue;
    }

    // eslint-disable-next-line no-await-in-loop -- each step locks the scope (retries: 0)
    await runStep(opts, convergePlugin, step, run);
  }
}

/**
 * The `(skipped) {dependency failed}` row of an enabled record's move whose
 * dependency did not land.
 */
function dependencyFailedRows(step: CascadeStep): PerEntryOutcome[] {
  // A deferred record stays disabled, as it was: no row (WR-B).
  return step.move === undefined || step.enable !== undefined
    ? []
    : convergedMoveOutcomes(step.move, {
        partition: "skipped",
        name: step.move.plugin,
        fromVersion: step.move.fromVersion,
        notes: [],
        reasons: ["dependency failed"],
        declaresAgents: false,
        declaresMcp: false,
        declaresWorkflows: false,
      });
}

/** The `(failed)` row of a move that did not land, with `reasons`. */
function failedMoveRows(move: PlannedMove, reasons: readonly ContentReason[]): PerEntryOutcome[] {
  return convergedMoveOutcomes(move, {
    partition: "failed",
    name: move.plugin,
    fromVersion: move.fromVersion,
    toVersion: move.toVersion,
    notes: [],
    reasons,
    declaresAgents: false,
    declaresMcp: false,
    declaresWorkflows: false,
  });
}

/**
 * Runs one step and records its rows and whether it landed. A deferred
 * record's move refreshes its pin and its enable then materializes the new
 * version, so a failed enable is a failed move: its pin goes back to what it
 * was (WR-C), and it reports the move's `(failed)` row. A landed one reports
 * the net `(updated)` row (WR-02).
 */
async function runStep(
  opts: ApplyReconcileOptions,
  convergePlugin: ReturnType<typeof createConvergeOperation>,
  step: CascadeStep,
  run: CascadeRun,
): Promise<void> {
  if (step.move === undefined) {
    const rows: PerEntryOutcome[] = [];
    if (!(await enableStep(opts, step.enable, rows))) {
      run.failed.all.add(step.key);
    }

    run.reports.push({ key: step.key, rows, replaceable: true });
    return;
  }

  const move = step.move;
  const collect = { requested: false };
  // D-10 / D-25: a move whose revision did not change exists because its
  // supported set grew, so the runner re-materializes the recorded revision.
  const rematerialize = !move.revisionChanged;
  const result = await convergePlugin({
    plugin: move.plugin,
    marketplace: move.marketplace,
    scope: run.scope,
    cwd: opts.cwd,
    partial: move.partial,
    rematerialize,
    // WR-3: a held-down record's clones are collected once its enable is known.
    ...(step.enable !== undefined && { cleanupClones: deferCollection(collect) }),
  });
  const enable = step.enable;
  if (!moveLanded(result, enable !== undefined) || enable === undefined) {
    const landed = moveLanded(result, false);
    if (!landed) {
      run.failed.all.add(step.key);
      run.failed.own.add(step.key);
    }

    run.reports.push({
      key: step.key,
      rows: rematerialize ? grownMoveOutcomes(move, result) : convergedMoveOutcomes(move, result),
    });
    return;
  }

  const enabled: PerEntryOutcome[] = [];
  const landed = await enableStep(opts, enable, enabled);
  if (!landed) {
    await restorePin(opts, run.scope, move, run.before);
  }

  if (collect.requested) {
    await collectClones(locationsFor(run.scope, opts.cwd));
  }

  if (landed) {
    // A growth-only move keeps the version, so its enable row is the net row.
    run.reports.push({ key: step.key, rows: rematerialize ? enabled : [enabledMoveOutcome(move)] });
    return;
  }

  const reasons = enabled
    .filter(
      (outcome): outcome is PluginEnableFailedOutcome => outcome.kind === "plugin-enable-failed",
    )
    .map((outcome) => outcome.reason)
    .filter(isContentReason);
  run.failed.all.add(step.key);
  run.reports.push({ key: step.key, rows: failedMoveRows(move, reasons) });
}

/**
 * The clone collection a held-down record's move defers to `runStep`: the
 * runner asks for it only when the pin's commit moved.
 */
function deferCollection(collect: { requested: boolean }): () => Promise<void> {
  return () => {
    collect.requested = true;
    return Promise.resolve();
  };
}

/**
 * D-19-01 / Review 4 WR-2: clone cleanup is hygienic, as the runner's own is
 * (`update-preflight.ts::refreshDisabledPluginUpdate`): a failure is traced and
 * a later lifecycle operation retries it. D-PL7-05: the GC takes a fresh scope
 * lock, so a held lock is such a failure.
 */
async function collectClones(locations: ScopedLocations): Promise<void> {
  try {
    await collectPluginClonesLocked(locations);
  } catch (err) {
    hookDebugLog(`apply: clone cleanup failed: ${errorMessage(err)}`, "reconcile");
  }
}

const NON_CONTENT_REASONS: ReadonlySet<string> = new Set([
  "marketplace not added",
  "marketplace not added to user scope",
  "marketplace not added to project scope",
]);

function isContentReason(reason: Reason): reason is ContentReason {
  return !NON_CONTENT_REASONS.has(reason);
}

/** Enables one record; answers whether it landed. */
async function enableStep(
  opts: ApplyReconcileOptions,
  op: PlannedPluginEnable,
  outcomes: PerEntryOutcome[],
): Promise<boolean> {
  await applyPluginToggles(opts, [op], outcomes, ENABLE_AXES);
  return outcomes.every((outcome) => outcome.kind === "plugin-enabled");
}

/** The record fields a pin refresh rewrites (`update-preflight.ts::refreshDisabledRecord`). */
const PIN_FIELDS: ReadonlySet<string> = new Set([
  "version",
  "resolvedSource",
  "resolvedSha",
  "compatibility",
  "updatedAt",
]);

/**
 * WR-C: puts back the pin a deferred record had before its move refreshed it,
 * when its enable then failed, so the record keeps naming the version it
 * holds, as a record lifted in the toggle step does.
 */
async function restorePin(
  opts: ApplyReconcileOptions,
  scope: Scope,
  move: PlannedMove,
  before: ExtensionState,
): Promise<void> {
  const key = pluginKey(move);
  const pins = new Map(
    Object.values(before.marketplaces).flatMap((mp) =>
      Object.entries(mp.plugins).map(([plugin, record]) => [
        `${plugin}@${mp.name}`,
        Object.fromEntries(Object.entries(record).filter(([field]) => PIN_FIELDS.has(field))),
      ]),
    ),
  );
  await withStateGuard(locationsFor(scope, opts.cwd), (fresh) => {
    for (const mp of Object.values(fresh.marketplaces)) {
      for (const [plugin, record] of Object.entries(mp.plugins)) {
        if (`${plugin}@${mp.name}` === key) {
          delete record.resolvedSha;
          Object.assign(record, pins.get(key));
        }
      }
    }
  });
}

/** What the judgement after the cascade reads, and where it writes. */
interface CascadeJudgement {
  readonly cascade: ConvergenceCascade;
  readonly before: CascadeStart;
  readonly failed: FailedSteps;
  /** Whether a step ran, so the state may differ from `before.state`. */
  readonly ran: boolean;
  /** Plugins whose disable this apply already tried and was refused. */
  readonly refused: ReadonlySet<string>;
  readonly disabled: PluginRow[];
  /** Filled with the plugins that end the apply enabled. */
  readonly enabledAtEnd: Set<string>;
}

/**
 * APPLY1-01 / LOAD-01: the one judgement that keeps the invariant. Once the
 * cascade has run, every enabled plugin of the scope is judged by
 * `judgeFinalScope`: its catalog and installed-copy declarations against each
 * dependency's recorded version and enabled state, to a fixed point, so a
 * disable reaches every plugin above it. Each plugin it holds is disabled with
 * the marker; the remedy names the move that failed (its own, or the
 * dependency's) or is the ordinary LOAD-01 one.
 *
 * Two inputs are this run's: a path-source dependent whose own move failed
 * runs files the marketplace no longer holds, so its old declarations are
 * unknown, and it is held when the dependency it needed moved for it (its
 * catalog range was unmet before). A plugin whose disable this apply already
 * tried and was refused is not tried again. A judgement whose walk fails
 * disables nothing, as the load-time check does (D-05-07).
 */
async function judgeScopeAfterCascade(
  reader: ReconcileStateReader,
  opts: ApplyReconcileOptions,
  scope: Scope,
  judged: CascadeJudgement,
): Promise<void> {
  const { cascade, before, failed } = judged;
  const locations = locationsFor(scope, opts.cwd);
  const state = judged.ran ? await reader.loadState(locations.extensionRoot) : before.state;
  const seeded: UnsatisfiedDeclaration[] = [];
  for (const mp of Object.values(state.marketplaces)) {
    for (const [plugin, record] of Object.entries(mp.plugins)) {
      const key = `${plugin}@${mp.name}`;
      // eslint-disable-next-line no-await-in-loop -- one copy check per failed dependent
      if (failed.own.has(key) && !(await isPinnedCopy(locations, record.resolvedSource))) {
        seeded.push(...movedFor(key, cascade, before.unsatisfied, failed));
      }
    }
  }

  const after = await judgeFinalScope({
    state,
    locations,
    installedDeclarations: installedCopyReader(locations),
    seeded,
  });
  const ops = enabledHolds(after, state, scope).filter((op) => !judged.refused.has(pluginKey(op)));
  const enabledNow = Object.values(state.marketplaces).flatMap((mp) =>
    Object.entries(mp.plugins).flatMap(([plugin, record]) =>
      record.enabled ? [`${plugin}@${mp.name}`] : [],
    ),
  );
  await applyDependencyDisables(opts, scope, ops, judged.disabled, (op, version) => {
    if (failed.own.has(pluginKey(op))) {
      return cascadeDisabledOutcome(op, version, "own-move");
    }

    return failed.all.has(op.dependency)
      ? cascadeDisabledOutcome(op, version, "dependency-failed")
      : dependencyDisabledOutcome(op, version);
  });
  const disabledNow = new Set(
    judged.disabled.filter((row) => row.kind === "plugin-dependency-disabled").map(pluginKey),
  );
  for (const key of enabledNow.filter((key) => !disabledNow.has(key))) {
    judged.enabledAtEnd.add(key);
  }
}

/**
 * The declaration a path-source dependent's failed move leaves unknown: the
 * dependency that moved for it, whose catalog range the scope left unmet
 * before the cascade.
 */
function movedFor(
  key: string,
  cascade: ConvergenceCascade,
  unsatisfied: readonly UnsatisfiedDeclaration[],
  failed: FailedSteps,
): UnsatisfiedDeclaration[] {
  const moved = new Set(cascade.plan.moves.map(pluginKey));
  return unsatisfied
    .filter(
      (entry) =>
        entry.dependent === key && moved.has(entry.dependency) && !failed.all.has(entry.dependency),
    )
    .slice(0, 1)
    .map((entry) => ({ dependent: key, dependency: entry.dependency, kind: "out-of-range" }));
}

/**
 * WR-B: the cascade's rows, one per plugin and outcome. A plugin the judgement
 * disabled reports its `(disabled)` row in place of a step that did not run;
 * a hold or decline row is kept only for a plugin that ends enabled.
 */
function cascadeRows(
  cascade: ConvergenceCascade,
  reports: readonly StepReport[],
  judged: { readonly disabled: readonly PluginRow[]; readonly enabledAtEnd: ReadonlySet<string> },
): PerEntryOutcome[] {
  const { disabled, enabledAtEnd } = judged;
  const byKey = new Map<string, PluginRow[]>();
  for (const row of disabled) {
    byKey.set(pluginKey(row), [...(byKey.get(pluginKey(row)) ?? []), row]);
  }

  const rows: PerEntryOutcome[] = [];
  for (const report of reports) {
    const replacement = byKey.get(report.key) ?? [];
    rows.push(
      ...(report.replaceable === true && replacement.length > 0 ? [] : report.rows),
      ...replacement,
    );
    byKey.delete(report.key);
  }

  const holds = blockedMoveOutcomes(cascade.plan).filter((row) => enabledAtEnd.has(pluginKey(row)));
  return [...rows, ...holds, ...[...byKey.values()].flat()];
}

/** A row that names one plugin, as every disable row does. */
type PluginRow = Extract<PerEntryOutcome, { readonly plugin: string }>;

/** The first unsatisfied declaration of every enabled plugin `verdict` holds. */
function enabledHolds(
  verdict: ScopeSatisfactionVerdict,
  state: ExtensionState,
  scope: Scope,
): PlannedDependencyDisable[] {
  if (!verdict.ok) {
    return [];
  }

  const ops: PlannedDependencyDisable[] = [];
  for (const mp of Object.values(state.marketplaces)) {
    for (const [plugin, record] of Object.entries(mp.plugins)) {
      const held = verdict.unsatisfied.find((entry) => entry.dependent === `${plugin}@${mp.name}`);
      if (record.enabled && held !== undefined) {
        ops.push({ ...held, scope, plugin, marketplace: mp.name });
      }
    }
  }

  return ops;
}

/** The file, scope and closed-set reason an `invalid-block` row reports. */
function failureKey(outcome: PerEntryOutcome): string | undefined {
  return outcome.kind === "invalid-block"
    ? `${outcome.scope} ${outcome.basename} ${outcome.reason}`
    : undefined;
}

/**
 * WR-01 / NFR-3: the convergence's failure rows that no other step of the
 * scope already reported. A state file that turned unreadable after the read
 * pass also fails the closing routing rebuild, and that fault is one row.
 */
function unreportedFailures(
  outcomes: readonly PerEntryOutcome[],
  failures: readonly PerEntryOutcome[],
): PerEntryOutcome[] {
  const reported = new Set(outcomes.map(failureKey));
  return failures.filter((failure) => !reported.has(failureKey(failure)));
}

/**
 * D-08 / WCONV-03: a growth-only move that re-materialized reports the
 * backfill row: `(installed)` or `(partially-installed)` at the recorded
 * version, led by `{components now supported}`, so it never reads as a fresh
 * install. Any other result reports what a catalog move reports.
 */
function grownMoveOutcomes(move: PlannedMove, result: PluginUpdateOutcome): PerEntryOutcome[] {
  if (result.partition !== "updated") {
    return convergedMoveOutcomes(move, result);
  }

  const unsupported = result.partialDegrade?.kinds ?? [];
  return [
    {
      kind: "plugin-backfilled",
      scope: move.scope,
      marketplace: move.marketplace,
      plugin: move.plugin,
      version: result.toVersion,
      dependencies: declaredDependencies(result),
      installable: unsupported.length === 0,
      unsupported,
      ...installedRowDegradation(result),
      ...carriedMcpConfigNotices(result),
      ...carriedStagingWarnings(result),
    },
  ];
}

/**
 * RECON-01..05: the reconcile apply orchestrator. Fans out across both
 * scopes project-first (or just the explicit scope when `opts.scope` is
 * set), per-scope read pass under withLockedStateTransaction (migrate ->
 * load -> plan), per-scope apply pass with NO outer lock, single notify()
 * emission per invocation (IL-2). An empty-and-clean pass reports
 * `Apply: nothing to change.` and writes nothing (APL-01 / D-08).
 *
 * Returns `void`; the side effects are the orchestrator-driven state
 * mutations + the single notify() call.
 */
async function applyReconcileWithReader(
  reader: ReconcileStateReader,
  opts: ApplyReconcileOptions,
): Promise<void> {
  const scopes: readonly Scope[] = opts.scope === undefined ? ["project", "user"] : [opts.scope];

  // Accumulate outcomes across both scopes; the projection sorts by
  // compareByNameThenScope (project-before-user per MSG-GR-3) so the final
  // cascade emits in canonical order regardless of which scope ran first.
  const accumulators: ScopePassAccumulators = {
    outcomes: [],
    migration: { rows: [], notices: [] },
  };

  try {
    await applyScopes(reader, opts, scopes, accumulators);
  } catch (err) {
    // APPLYTHROW-01: a GHB-03 throw ends the pass after earlier steps have
    // committed, so their rows, the migration notice, and the `/reload` hint
    // go out before the throw reaches the caller.
    reportScopePasses(opts, accumulators);
    throw err;
  }

  // AMIG-03 / IL-2 / RECON-04: the one migration notice, then the single
  // cascade through RECONCILE_APPLIED_CONTEXT. An empty-and-clean pass sends
  // the apply-empty advisory instead (APL-01 / D-08).
  if (!reportScopePasses(opts, accumulators)) {
    // AAP-02 / D-07: an autoapply load with nothing to change keeps the load's
    // silence (RECON-05); the advisory answers the command.
    if (opts.run.origin.kind !== "load") {
      notify(opts.ctx, opts.run, { kind: "reconcile-pending-empty", command: "apply" });
    }
  }
}

/**
 * Runs each scope's read pass, plan, convergence, and close in turn,
 * project first, collecting rows into `accumulators`.
 */
async function applyScopes(
  reader: ReconcileStateReader,
  opts: ApplyReconcileOptions,
  scopes: readonly Scope[],
  accumulators: ScopePassAccumulators,
): Promise<void> {
  const outcomes = accumulators.outcomes;
  for (const scope of scopes) {
    // WR-01 / AMIG-01 / CFG-03: a read-pass throw or an invalid config stops
    // this scope with its rows and never the sibling scope; the MCP move runs
    // before the plan is applied (`openScopePass`).
    // eslint-disable-next-line no-await-in-loop -- each scope's pass edits shared hooks routing
    const readResult = await openScopePass({
      ...accumulators,
      reader,
      scope,
      cwd: opts.cwd,
      migrateMcpEntries: opts.migrateMcpEntries,
    });
    if (readResult === undefined) {
      continue;
    }

    const convergeFailures: PerEntryOutcome[] = [];
    try {
      // eslint-disable-next-line no-await-in-loop -- each scope's apply edits shared hooks routing
      await applyAndConverge(reader, opts, scope, readResult, { outcomes, convergeFailures });
    } finally {
      // REC-05 / DLS-01 / DISP-02: after the convergence, so a failed move for
      // the same plugin suppresses the unreadable-declarer row as an apply-pass
      // failure does; the routing rebuild reflects the post-reconcile state,
      // also when the pass ends on a GHB-03 throw (IN-A).
      // eslint-disable-next-line no-await-in-loop -- each scope's pass edits shared hooks routing
      await closeScopePass(scope, readResult, opts.cwd, opts.hooksRouting, outcomes);
      outcomes.push(...unreportedFailures(outcomes, convergeFailures));
    }
  }
}

/** One scope's plan, then its catalog convergence (APL-02 / D-08). */
async function applyAndConverge(
  reader: ReconcileStateReader,
  opts: ApplyReconcileOptions,
  scope: Scope,
  readResult: ScopeReadResult,
  sinks: { readonly outcomes: PerEntryOutcome[]; readonly convergeFailures: PerEntryOutcome[] },
): Promise<void> {
  if (readResult.plan === undefined) {
    return;
  }

  const deferred = await applyPlan(
    reader,
    opts,
    { plan: readResult.plan, deferredEnables: readResult.deferredEnables ?? [] },
    sinks.outcomes,
  );
  await convergeScope(reader, opts, scope, deferred, sinks.outcomes, sinks.convergeFailures);
}

/**
 * Sends the migration notice and the cascade, then the post-cascade warnings
 * and MCP config notices. Returns whether the cascade was sent; with no
 * cascade it sends no warning or notice either.
 */
function reportScopePasses(
  opts: ApplyReconcileOptions,
  accumulators: ScopePassAccumulators,
): boolean {
  if (!notifyScopePasses(opts.ctx, opts.run, accumulators)) {
    return false;
  }

  const outcomes = accumulators.outcomes;

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
  // `install-flow.ts::installPlugin` owns the orchestrated-mode collection
  // path that feeds it.
  surfacePostCommitWarnings(opts, outcomes);

  // D-PL1-07 / D-PL1-09 / D-PL1-25: each catalog move's and enable's staging
  // warnings, both halves, after the install block and before the MCP config
  // notices.
  surfaceCascadeStagingDiagnostics(opts.ctx, opts.run, stagingDiagnosticsOf(outcomes));

  // AFILE-04: the MCP config notices every orchestrated operation returned,
  // shown after the cascade rows they explain. The empty-pass return above
  // sends none, since a pass with no outcome carries no notice.
  surfaceMcpConfigNotices(opts, outcomes);
  return true;
}

/**
 * Creates a reconcile apply operation with one required selected-state reader.
 * The single production composition of it lives in the extension entry point,
 * which binds `loadState` once per extension load and hands the operation to
 * the `apply` command (APL-01).
 */
export function createApplyReconcile(
  reader: ReconcileStateReader,
): (opts: ApplyReconcileOptions) => Promise<void> {
  return async function applyReconcile(opts: ApplyReconcileOptions): Promise<void> {
    await applyReconcileWithReader(reader, opts);
  };
}

function surfacePostCommitWarnings(
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
  notifyDiagnostic(opts.ctx, opts.run, header, lines);
}

/**
 * AFILE-04: one `notifyMcpConfigNotices` call over every outcome's notices, in
 * outcome order. The seam collapses repeats of one `(kind, scope, file)`, so
 * several operations rewriting the same file produce one line. The read-pass
 * rows (invalid blocks, layer gaps, source mismatches) come from no orchestrated
 * operation and carry none.
 */
function surfaceMcpConfigNotices(
  opts: ApplyReconcileOptions,
  outcomes: readonly PerEntryOutcome[],
): void {
  notifyMcpConfigNotices(
    opts.ctx,
    opts.run,
    outcomes.flatMap((outcome) =>
      outcome.kind === "invalid-block" ||
      outcome.kind === "layer-marketplace-gap" ||
      outcome.kind === "source-mismatch"
        ? []
        : (outcome.mcpConfigNotices ?? []),
    ),
  );
}

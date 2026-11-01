// orchestrators/reconcile/load.ts
//
// APL-03 / D-02 / D-04: the reconcile step of a load (session start and
// `/reload`). A load changes no installation state: it never installs,
// uninstalls, enables, disables or backfills. `/claude:plugin apply` makes
// those changes (APL-01).
//
// AAP-02 / AAP-D1: the one exception is the `autoapply` setting. When the
// effective value (`config-merge.ts::effectiveAutoapply`, the most specific config
// file that sets it) is true, the load runs the injected apply step for the
// user scope instead of the read-only pass below. The apply step runs the same
// read pass, MCP move, warnings and routing rebuild for that scope, and its
// report replaces the user scope's part of the pending block.
//
// D-CF2-14: a load never applies the project scope, whichever config file
// turned autoapply on. The project's configs sit in the repository, and Pi
// trusts a project that holds no trust-requiring file without asking, so a
// cloned repository could otherwise have its own plugins installed, and their
// skills recorded as this user's installs (D-CF2-13), with no step by the
// user. Claude Code asks before it installs a plugin that repository settings
// name. Pi's extension API reports only whether the project is trusted, not
// whether the user decided it, so the load cannot tell a trusted project from
// an auto-trusted one. The project scope gets the read-only pass and its
// pending block, and `/claude:plugin apply`, which the user types, applies it.
//
// AAP-03 / NFR-2: an apply step that throws (GHB-03 ends its pass) is reported
// as `reconcile-aborted`, and the read-only pass below then runs for both
// scopes, so the routing table and the warnings are rebuilt and the pending
// block lists what the apply step did not make.
//
// What still runs, per scope, project first (MSG-GR-3):
//   - the shared locked read pass (`read-pass.ts`): the MIG-01 first-run
//     config migration, the legacy state migration inside `loadState`, the
//     LOAD-01 verdict and the plan. It writes nothing to state.json (WR-05);
//   - the AMIG-01 MCP move (D-22), which skips the owners the plan names
//     because `apply` installs or rewrites them (AMIG-04);
//   - the per-session warnings: the unreadable declarer and the
//     `{not in manifest}` warning (D-18);
//   - the hook routing rebuild (DISP-02).
//
// D-05 / D-06: after the passes, the load prints the block `pending` prints,
// built by the same composer (`composePendingReport`) over every scope whose
// read pass did not throw. It ends with the apply trailer and never with the
// `/reload` hint, since the load changed nothing. A matching state prints no
// block. The block reports an invalid config (CFG-03), a layer gap (LAYER-06)
// and a source mismatch, so the load does not report them a second time. A
// scope whose read pass threw (a corrupt state.json, a held lock) keeps its row
// among the warnings and stays out of the block, so it is reported once.
//
// WR-01: one scope's failure becomes one row and the other scope still runs.
// IL-2: one migration notice, then the pending block, then the warnings; a load
// with nothing to report is silent (RECON-05).
//
// NFR-5: this module is outside `NETWORK_SEAMS` in eslint.config.js. It names
// no git surface. Its read-only pass calls no operation that clones; only the
// injected apply step, run when autoapply is on, may reach the network
// (AAP-D1).

import { effectiveAutoapply, loadAutoapplyFiles } from "../../persistence/config-merge.ts";
import { locationsFor } from "../../persistence/locations.ts";
import { hookDebugLog } from "../../shared/debug-log.ts";
import { errorMessage } from "../../shared/errors.ts";
import { notifyMcpMigration, notifyReconcileAborted } from "../../shared/notification-dispatch.ts";

import { composePendingReport, notifyPendingReport } from "./pending.ts";
import { closeScopePass, notifyScopeOutcomes, openScopePass } from "./read-pass.ts";

import type { PerEntryOutcome } from "./apply-outcomes.ts";
import type { ReconcileStateReader, ScopePassAccumulators } from "./read-pass.ts";
import type { ApplyReconcileOptions, McpMigrationStep } from "./types.ts";
import type { NotificationContext } from "../../platform/pi-api.ts";
import type { CompletionCache } from "../../shared/completion-cache.ts";
import type { NotificationRun } from "../../shared/notification-run.ts";
import type { Scope } from "../../shared/types.ts";
import type { InstallHooksRouting } from "../plugin/install-disable-cascade.ts";

export interface LoadReconcileOptions {
  readonly ctx: NotificationContext;
  /** D-05 / D-07: the load's run, opened once per `resources_discover`. */
  readonly run: NotificationRun;
  /** Project-scope cwd (ignored for the user scope). */
  readonly cwd: string;
  /** Lifecycle-owned route effects shared with registered hook callbacks. */
  readonly hooksRouting: InstallHooksRouting;
  /** AAP-02: the completion cache an autoapply load hands the apply step. */
  readonly completionCache: CompletionCache;
  /**
   * AMIG-01 injection seam for the MCP move. Production callers (index.ts)
   * omit it and `mcp-migration.ts::migrateLegacyMcpEntries` applies.
   */
  readonly migrateMcpEntries?: McpMigrationStep;
}

const SCOPES: readonly Scope[] = ["project", "user"];

/**
 * AAP-02 / D-CF2-14: runs the apply step for the user scope when the configs
 * turn autoapply on, and returns the scopes the read-only pass still covers:
 * the project scope after an apply step that finished, and both scopes when
 * autoapply is off or the apply step threw (AAP-03).
 */
async function autoapplyUserScope(
  applyReconcile: (opts: ApplyReconcileOptions) => Promise<void>,
  opts: LoadReconcileOptions,
): Promise<readonly Scope[]> {
  const autoapply = effectiveAutoapply(
    await loadAutoapplyFiles(locationsFor("project", opts.cwd), locationsFor("user", opts.cwd)),
  );
  if (autoapply.status === "valid" && autoapply.enabled) {
    return applyUserScope(applyReconcile, opts);
  }

  return SCOPES;
}

/** D-CF2-14: the apply step of an autoapply load, given the user scope alone (AAP-02, AAP-03). */
async function applyUserScope(
  applyReconcile: (opts: ApplyReconcileOptions) => Promise<void>,
  opts: LoadReconcileOptions,
): Promise<readonly Scope[]> {
  try {
    await applyReconcile({
      ctx: opts.ctx,
      run: opts.run,
      cwd: opts.cwd,
      hooksRouting: opts.hooksRouting,
      completionCache: opts.completionCache,
      scope: "user",
      ...(opts.migrateMcpEntries !== undefined && { migrateMcpEntries: opts.migrateMcpEntries }),
    });
    return ["project"];
  } catch (err) {
    // A failed notify must not skip the read-only pass and its routing rebuild.
    try {
      notifyReconcileAborted(opts.ctx, opts.run, err);
    } catch (notifyErr) {
      hookDebugLog(`reconcile-abort notify failed: ${errorMessage(notifyErr)}`, "env");
    }

    return SCOPES;
  }
}

async function loadReconcileWithReader(
  reader: ReconcileStateReader,
  applyReconcile: (opts: ApplyReconcileOptions) => Promise<void>,
  opts: LoadReconcileOptions,
): Promise<void> {
  const scopes = await autoapplyUserScope(applyReconcile, opts);
  const accumulators: ScopePassAccumulators = {
    outcomes: [],
    migration: { rows: [], notices: [] },
  };
  const readableScopes: Scope[] = [];

  for (const scope of scopes) {
    // D-06: pending's block reports these rows, so the load drops them.
    const configOutcomes: PerEntryOutcome[] = [];
    // eslint-disable-next-line no-await-in-loop -- each scope's pass edits shared hooks routing
    const readResult = await openScopePass({
      ...accumulators,
      reader,
      scope,
      cwd: opts.cwd,
      migrateMcpEntries: opts.migrateMcpEntries,
      configOutcomes,
    });
    if (readResult !== undefined || configOutcomes.length > 0) {
      readableScopes.push(scope);
    }

    if (readResult !== undefined) {
      // eslint-disable-next-line no-await-in-loop -- each scope's pass edits shared hooks routing
      await closeScopePass(scope, readResult, opts.cwd, opts.hooksRouting, accumulators.outcomes);
    }
  }

  const report = await composePendingReport({ cwd: opts.cwd, scopes: readableScopes });
  notifyMcpMigration(opts.ctx, opts.run, accumulators.migration);
  if (report.marketplaces.length > 0) {
    notifyPendingReport(opts.ctx, opts.run, report);
  }

  notifyScopeOutcomes(opts.ctx, opts.run, accumulators.outcomes);
}

/**
 * Creates the load's reconcile step with one required selected-state reader
 * and the apply step an autoapply load runs (AAP-02). The single production
 * composition lives in the extension entry point, which binds `loadState` and
 * its apply operation once per extension load and hands the step to its
 * `resources_discover` handler.
 */
export function createLoadReconcile(
  reader: ReconcileStateReader,
  applyReconcile: (opts: ApplyReconcileOptions) => Promise<void>,
): (opts: LoadReconcileOptions) => Promise<void> {
  return async function loadReconcile(opts: LoadReconcileOptions): Promise<void> {
    await loadReconcileWithReader(reader, applyReconcile, opts);
  };
}

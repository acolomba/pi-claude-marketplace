// orchestrators/reconcile/load.ts
//
// APL-03 / D-02 / D-04: the reconcile step of a load (session start and
// `/reload`). A load changes no installation state: it never installs,
// uninstalls, enables, disables or backfills. `/claude:plugin apply` makes
// those changes (APL-01).
//
// What still runs, per scope, project first (MSG-GR-3):
//   - the shared locked read pass (`read-pass.ts`): the MIG-01 first-run
//     config migration, the legacy state migration inside `loadState`, the
//     LOAD-01 verdict and the plan. It writes nothing to state.json (WR-05);
//   - the AMIG-01 MCP move (D-22), which skips the owners the plan names
//     because `apply` installs or rewrites them (AMIG-04);
//   - the report-only rows: an invalid config (CFG-03), a layer gap
//     (LAYER-06), a source mismatch, the unreadable declarer and the
//     `{not in manifest}` warning (D-18), which return every session;
//   - the hook routing rebuild (DISP-02).
//
// WR-01: one scope's failure becomes one row and the other scope still runs.
// IL-2: one migration notice, then at most one cascade; a load with nothing to
// report is silent (RECON-05).
//
// NFR-5: this module is outside `NETWORK_SEAMS` in eslint.config.js. It names
// no git surface, and it calls no operation that clones.

import { sourceMismatchOutcomes } from "./apply-outcomes.ts";
import { closeScopePass, notifyScopePasses, openScopePass } from "./read-pass.ts";

import type { ReconcileStateReader, ScopePassAccumulators } from "./read-pass.ts";
import type { McpMigrationStep } from "./types.ts";
import type { NotificationContext } from "../../platform/pi-api.ts";
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
  /**
   * AMIG-01 injection seam for the MCP move. Production callers (index.ts)
   * omit it and `mcp-migration.ts::migrateLegacyMcpEntries` applies.
   */
  readonly migrateMcpEntries?: McpMigrationStep;
}

const SCOPES: readonly Scope[] = ["project", "user"];

async function loadReconcileWithReader(
  reader: ReconcileStateReader,
  opts: LoadReconcileOptions,
): Promise<void> {
  const accumulators: ScopePassAccumulators = {
    outcomes: [],
    migration: { rows: [], notices: [] },
  };

  for (const scope of SCOPES) {
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

    // A pristine scope has no plan and so no source mismatch.
    if (readResult.plan !== undefined) {
      accumulators.outcomes.push(...sourceMismatchOutcomes(readResult.plan));
    }

    // eslint-disable-next-line no-await-in-loop -- each scope's pass edits shared hooks routing
    await closeScopePass(scope, readResult, opts.cwd, opts.hooksRouting, accumulators.outcomes);
  }

  notifyScopePasses(opts.ctx, opts.run, accumulators);
}

/**
 * Creates the load's reconcile step with one required selected-state reader.
 * The single production composition lives in the extension entry point, which
 * binds `loadState` once per extension load and hands the step to its
 * `resources_discover` handler.
 */
export function createLoadReconcile(
  reader: ReconcileStateReader,
): (opts: LoadReconcileOptions) => Promise<void> {
  return async function loadReconcile(opts: LoadReconcileOptions): Promise<void> {
    await loadReconcileWithReader(reader, opts);
  };
}

// orchestrators/reconcile/read-pass.ts
//
// RECON-05 / WR-05: the per-scope reconcile read pass that `apply` and the load
// share, the per-scope steps both run around it, and the one emission both end
// with.
//
// CONTRACT:
//   - The read pass is WRITE-FREE for state.json. A pristine scope (no
//     state.json, no config) returns before the lock and creates nothing.
//     Otherwise it runs, under one `withLockedStateTransaction` with NO
//     `tx.save()`: the MIG-01 first-run config migration, the merged config
//     load, the CFG-03 invalid-arm check, the LAYER-06 layer-gap check, the
//     LOAD-01 satisfaction verdict, and `planReconcile`. state.json bytes and
//     mtime stay untouched.
//   - WR-01: every per-scope step is isolated, so one scope's throw becomes
//     one structured row and the other scope still runs.
//   - Per scope, `openScopePass` runs the read pass and then the AMIG-01 MCP
//     move; `closeScopePass` reports the unreadable declarer, the plugins of a
//     marketplace Claude Code refuses, and the delisted plugins, and rebuilds
//     the hook routing table. A caller's own steps run between the two.
//   - IL-2 / RECON-04: `notifyScopePasses` sends the one migration notice and
//     at most one cascade for both scopes (`notifyScopeOutcomes`).
//
// NFR-5: this module is outside `NETWORK_SEAMS` in eslint.config.js. It names
// no git surface; BLOCK F rejects any `platform/git` import here.

import path from "node:path";

import { findLayerMarketplaceGaps, loadMergedScopeConfig } from "../../persistence/config-merge.ts";
import { locationsFor } from "../../persistence/locations.ts";
import { migrateFirstRunConfig } from "../../persistence/migrate-config.ts";
import { errorMessage } from "../../shared/errors.ts";
import { pathExists } from "../../shared/fs-utils.ts";
import { notifyMcpMigration } from "../../shared/notification-dispatch.ts";
import { notifyReconcileAppliedWithContext } from "../../shared/notify-context.ts";
import { redactAbsolutePaths } from "../../shared/redact-absolute-paths.ts";
import { withLockedStateTransaction } from "../../transaction/with-state-guard.ts";

import { classifyReadPassThrow, MigrateConfigSaveError } from "./apply-outcomes.ts";
import { settleMoveCascade, withPlannedInstallsLanded } from "./convergence.ts";
import {
  reportDelistedPlugins,
  reportRefusedMarketplaces,
  reportUnreadableDeclarer,
} from "./delisted-plugins.ts";
import { buildScopeSatisfactionVerdict, verdictAfterToggles } from "./dependency-verdict.ts";
import { migrateLegacyMcpEntries } from "./mcp-migration.ts";
import { buildReconcileAppliedCascade } from "./notify.ts";
import { planReconcile } from "./plan.ts";
import { composeLayerMarketplaceCause, RECONCILE_APPLIED_CONTEXT } from "./reconcile.messaging.ts";

import type { PerEntryOutcome } from "./apply-outcomes.ts";
import type { ScopeSatisfactionVerdict } from "./dependency-verdict.ts";
import type {
  McpMigrationInput,
  McpMigrationStep,
  ReconcilePlan,
  ScopeReadResult,
} from "./types.ts";
import type { ConfigLoadResult, ScopeConfig } from "../../persistence/config-io.ts";
import type { MergedConfig, ScopeLoadOutcome } from "../../persistence/config-merge.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { ExtensionState, loadState } from "../../persistence/state-io.ts";
import type { NotificationContext } from "../../platform/pi-api.ts";
import type { NotificationRun } from "../../shared/notification-run.ts";
import type { McpConfigNotice, McpMigrationRow } from "../../shared/notification-types.ts";
import type { Scope } from "../../shared/types.ts";
import type { InstallHooksRouting } from "../plugin/install-disable-cascade.ts";

/** Reads the one state snapshot selected by the reconcile read pass. */
export interface ReconcileStateReader {
  readonly loadState: typeof loadState;
}

// An absent or invalid layer declares nothing.
function declaredConfig(result: ConfigLoadResult): ScopeConfig {
  return result.status === "valid" ? result.config : {};
}

/**
 * LAYER-06 / D-MF-03: one outcome per layer that declares a plugin whose
 * marketplace only the other layer declares. Like an invalid layer config, it
 * stops the scope's reconcile; the plugins the scope installed keep loading
 * from state, and no file is repaired.
 */
function layerMarketplaceGapOutcomes(
  outcome: ScopeLoadOutcome,
  loc: ScopedLocations,
  scope: Scope,
): PerEntryOutcome[] {
  const gaps = findLayerMarketplaceGaps(
    declaredConfig(outcome.base),
    declaredConfig(outcome.local),
  );
  return gaps.map((gap) => ({
    kind: "layer-marketplace-gap",
    scope,
    basename: path.basename(
      gap.layer === "base" ? loc.baseConfigJsonPath : loc.localConfigJsonPath,
    ),
    cause: new Error(composeLayerMarketplaceCause(gap, scope)),
  }));
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
export async function readPassForScope(
  reader: ReconcileStateReader,
  scope: Scope,
  cwd: string,
): Promise<ScopeReadResult> {
  return readScopeLocked(
    reader,
    scope,
    cwd,
    async ({ merged, state, locations, verdict, plan }) => {
      // (6) APPLY1-01: a dependent the catalog moves together with the newer
      // dependency it needs is not held down; `pending` settles the same way.
      // The enables that wait on a move run after the convergence, not with
      // the toggles. D-PL2-02: every plan counts the installs it schedules as
      // landed, as `pending` plans, because `apply` runs its missing-dependency
      // install after the moves.
      const planFrom = (from: ScopeSatisfactionVerdict, planned: ReconcilePlan): ReconcilePlan =>
        withPlannedInstallsLanded(planned, from, state, (released) =>
          planReconcile(merged, state, scope, released),
        );
      const settled = await settleMoveCascade({
        scope,
        state,
        locations,
        plan: planFrom(verdict, plan),
        verdict,
        replan: (released) => planFrom(released, planReconcile(merged, state, scope, released)),
      });
      const deferred = new Set(
        settled.deferredEnables.map((op) => `${op.plugin}@${op.marketplace}`),
      );
      // DLS-01: carry the loaded state snapshot out so the closing step can
      // report a recorded plugin its marketplace no longer lists. planReconcile
      // is pure, so the snapshot is the unmutated read-pass state.
      return {
        plan: {
          ...settled.plan,
          pluginsToEnable: settled.plan.pluginsToEnable.filter(
            (op) => !deferred.has(`${op.plugin}@${op.marketplace}`),
          ),
        },
        invalidOutcomes: [],
        state,
        verdict,
        ...(settled.deferredEnables.length > 0 && { deferredEnables: settled.deferredEnables }),
        // D-PL2-16: the enables that wait on a planned install.
        ...(settled.enablesAfterInstalls.length > 0 && {
          enablesAfterInstalls: settled.enablesAfterInstalls,
        }),
      };
    },
  );
}

/**
 * D-PL2-01: the read pass without the move settlement, for `apply` once its
 * catalog moves have run. The scope then records the versions the moves
 * landed, so the plan's missing-dependency bucket names what a moved version
 * needs, and after that install the plan's enables are the records it
 * satisfied. No planned install counts as landed: the state it plans from is
 * the one `apply` judges.
 */
export async function readPlainPlanForScope(
  reader: ReconcileStateReader,
  scope: Scope,
  cwd: string,
): Promise<ScopeReadResult> {
  return readScopeLocked(reader, scope, cwd, ({ state, verdict, plan }) =>
    Promise.resolve({ plan, invalidOutcomes: [], state, verdict }),
  );
}

/** One scope as the read pass plans it, before any catalog move is settled. */
interface ToggledScope {
  readonly merged: MergedConfig;
  readonly state: ExtensionState;
  readonly locations: ScopedLocations;
  readonly verdict: ScopeSatisfactionVerdict;
  readonly plan: ReconcilePlan;
}

/**
 * The steps `readPassForScope` and `readPlainPlanForScope` share, through the
 * plan over the toggles. `finish` runs inside the same lock.
 */
async function readScopeLocked(
  reader: ReconcileStateReader,
  scope: Scope,
  cwd: string,
  finish: (toggled: ToggledScope) => Promise<ScopeReadResult>,
): Promise<ScopeReadResult> {
  const loc = locationsFor(scope, cwd);

  const stateExists = await pathExists(loc.stateJsonPath);
  const configExists =
    (await pathExists(loc.baseConfigJsonPath)) || (await pathExists(loc.localConfigJsonPath));
  if (!stateExists && !configExists) {
    // Pristine scope: nothing recorded, nothing declared -- no-op without
    // touching the disk.
    return { plan: undefined, invalidOutcomes: [] };
  }

  return withLockedStateTransaction(
    loc,
    async (tx) => {
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
      // carries an attribution sentinel; `readPassFailureOutcome` reads it to
      // name the row's subject correctly.
      try {
        await migrateFirstRunConfig(loc, state);
      } catch (err) {
        throw new MigrateConfigSaveError(loc.baseConfigJsonPath, err);
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

      // LAYER-06 / D-MF-03: an invalid layer reads as declaring nothing, so it
      // never also reports a missing marketplace.
      invalidOutcomes.push(...layerMarketplaceGapOutcomes(outcome, loc, scope));
      if (invalidOutcomes.length > 0) {
        return { plan: undefined, invalidOutcomes };
      }

      // (4) LOAD-01 / D-06-04: decide which recorded plugin has a declaration
      // this scope does not satisfy. It runs HERE, not in index.ts, because the
      // snapshot and the `ScopedLocations` bundle it walks are both produced
      // inside this locked closure: computing it outside would mean a second
      // unlocked state read that could disagree with the snapshot the planner
      // sees, which is the race this lock exists to close. It takes NO lock of
      // its own: this closure already holds the scope lock, and the guard is
      // configured with no retries and is not re-entrant.
      //
      // WR-08: the walk costs one memoized manifest lookup plus one
      // own-manifest probe per RECORDED plugin, so this critical section
      // scales with the scope's install count rather than being the bounded
      // config+state read the surrounding steps are. `proper-lockfile` has no
      // retries, so two Pi processes starting against one scope have a window
      // proportional to that count in which the second takes `ELOCKED` and
      // skips its whole reconcile pass. A scope recording no plugins pays
      // nothing: `buildScopeDeclarationDetail` reads a manifest per record and
      // there are none.
      const firstVerdict = await buildScopeSatisfactionVerdict({ state, locations: loc });

      // (5) Plan against the merged config + current state + the verdict.
      // Pure -- no I/O. D-08 / D-21: when the plan enables or disables a
      // record, the verdict is taken again over the scope as those toggles
      // leave it, so a dependent of a record the config disables is held down
      // in the same apply, and `pending` (which plans the same way) lists it.
      const firstPlan = planReconcile(outcome.merged, state, scope, firstVerdict);
      const verdict = await verdictAfterToggles({ state, locations: loc }, firstVerdict, {
        enable: firstPlan.pluginsToEnable,
        disable: firstPlan.pluginsToDisable,
      });
      const toggled =
        verdict === firstVerdict ? firstPlan : planReconcile(outcome.merged, state, scope, verdict);
      return finish({ merged: outcome.merged, state, locations: loc, verdict, plan: toggled });
    },
    { loadState: reader.loadState },
  );
}

/**
 * WR-01: the row one scope's read-pass throw becomes (a corrupt or unparseable
 * state.json, a `StateLockHeldError` from a concurrent process, an EACCES on
 * the lock file), so the throw never discards the sibling scope's outcomes or
 * skips its reconcile -- the scopes lock independently.
 *
 * S3 / PR #51: a throw from `migrateFirstRunConfig`'s inner saveConfig (EACCES
 * on the scope dir blocking the atomic tmp+rename) names `claude-plugins.json`,
 * the file the pass was trying to WRITE; every other throw names state.json.
 * The closed-set reason comes from the unwrapped cause, so it reflects the
 * underlying error rather than the sentinel, and the cause text is redacted
 * (T-55-02-01).
 */
function readPassFailureOutcome(scope: Scope, err: unknown): PerEntryOutcome {
  const isMigrateSave = err instanceof MigrateConfigSaveError;
  const basename = isMigrateSave ? path.basename(err.configFilePath) : "state.json";
  const classifiable = isMigrateSave ? err.cause : err;
  return {
    kind: "invalid-block",
    scope,
    basename,
    reason: classifyReadPassThrow(classifiable),
    cause: new Error(redactAbsolutePaths(errorMessage(classifiable))),
  };
}

/**
 * AMIG-01 / NFR-2: runs one scope's MCP move and turns any throw out of it
 * into a stopped row, never an `invalid-block` reconcile row, so the move
 * cannot abort the reconcile of either scope. `migrateMcpEntries` is the
 * injected step; `migrateLegacyMcpEntries` runs when it is absent.
 */
async function migrateScopeIsolated(
  input: McpMigrationInput & { readonly migrateMcpEntries?: McpMigrationStep | undefined },
): Promise<void> {
  const { migrateMcpEntries, ...step } = input;
  try {
    await (migrateMcpEntries ?? migrateLegacyMcpEntries)(step);
  } catch (err) {
    input.rows.push({
      kind: "stopped",
      scope: input.scope,
      detail: redactAbsolutePaths(errorMessage(err)),
    });
  }
}

/**
 * The throw-to-`invalid-block` coercion every isolated per-scope step applies.
 * A transient `StateLockHeldError` or EACCES becomes a structured row (subject
 * `state.json`, closed-set reason) carrying a redacted cause, so one scope's
 * transient failure never aborts the cascade for the other.
 */
export async function runScopeIsolated(
  scope: Scope,
  outcomes: PerEntryOutcome[],
  op: () => Promise<void>,
): Promise<void> {
  try {
    await op();
  } catch (err) {
    outcomes.push({
      kind: "invalid-block",
      scope,
      basename: "state.json",
      reason: classifyReadPassThrow(err),
      cause: new Error(redactAbsolutePaths(errorMessage(err))),
    });
  }
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
async function rebuildScopeRoutingTable(
  scope: Scope,
  cwd: string,
  hooksRouting: InstallHooksRouting,
): Promise<void> {
  const loc = locationsFor(scope, cwd);
  if (!(await pathExists(loc.stateJsonPath))) {
    return;
  }

  await withLockedStateTransaction(loc, async (_tx) => {
    hooksRouting.rebuildRoutingTables();
    // NO tx.save() -- read-only snapshot acquisition.
    await Promise.resolve();
  });
}

/**
 * WR-01-isolated wrapper around `rebuildScopeRoutingTable`. A transient
 * lock-held / EACCES throw is captured as a structured `invalid-block`
 * outcome (subject `state.json`, closed-set reason) so the rebuild's
 * failure surfaces alongside the other per-scope outcomes instead of
 * aborting the pass wholesale.
 */
async function rebuildScopeRoutingTableIsolated(
  scope: Scope,
  cwd: string,
  hooksRouting: InstallHooksRouting,
  outcomes: PerEntryOutcome[],
): Promise<void> {
  await runScopeIsolated(scope, outcomes, () => rebuildScopeRoutingTable(scope, cwd, hooksRouting));
}

/** The accumulators one reconcile pass collects across both scopes. */
export interface ScopePassAccumulators {
  readonly outcomes: PerEntryOutcome[];
  /** AMIG-03: the MCP move's rows and notices for the one migration notice. */
  readonly migration: { readonly rows: McpMigrationRow[]; readonly notices: McpConfigNotice[] };
}

/** One scope's pass inputs; `migrateMcpEntries` is optional. */
export interface ScopePassInput extends ScopePassAccumulators {
  readonly reader: ReconcileStateReader;
  readonly scope: Scope;
  readonly cwd: string;
  /** AMIG-01: the injected MCP move; `migrateLegacyMcpEntries` when absent. */
  readonly migrateMcpEntries?: McpMigrationStep | undefined;
  /**
   * D-06: where the invalid-config and layer-gap rows go; `outcomes` when
   * absent. The load collects them apart, because pending's block reports them.
   */
  readonly configOutcomes?: PerEntryOutcome[] | undefined;
}

/**
 * WR-01 / AMIG-01 / CFG-03: opens one scope's pass. Runs the read pass, then
 * the MCP move with the read pass's plan -- also when the config is invalid,
 * never after a read pass that threw. Returns the readable scope's result, or
 * `undefined` once it has pushed the rows that stop the scope: the read-pass
 * throw's row, or the invalid-config and layer-gap rows the read pass
 * returned. An invalid config is never coerced to an empty desired state.
 */
export async function openScopePass(input: ScopePassInput): Promise<ScopeReadResult | undefined> {
  let readResult: ScopeReadResult;
  try {
    readResult = await readPassForScope(input.reader, input.scope, input.cwd);
  } catch (err) {
    input.outcomes.push(readPassFailureOutcome(input.scope, err));
    return undefined;
  }

  await migrateScopeIsolated({
    migrateMcpEntries: input.migrateMcpEntries,
    scope: input.scope,
    cwd: input.cwd,
    plan: readResult.plan,
    rows: input.migration.rows,
    notices: input.migration.notices,
  });

  if (readResult.invalidOutcomes.length > 0) {
    (input.configOutcomes ?? input.outcomes).push(...readResult.invalidOutcomes);
    return undefined;
  }

  return readResult;
}

/**
 * REC-05 / DLS-01 / DISP-02: closes one readable scope's pass. The unreadable
 * declarer's row comes after the caller's own rows, so a failure the caller
 * reported for the same plugin suppresses it; the delisted rows follow the
 * walk's row, which names a delisted plugin whose installed copy cannot be
 * read with the fuller cause. The rows for the plugins of a marketplace Claude
 * Code refuses come before the delisted rows, so a refused plugin gets one row
 * (D-PL5-28). The routing rebuild runs last, so the next Pi
 * event fires against a bucket that reflects the scope after the pass.
 */
export async function closeScopePass(
  scope: Scope,
  readResult: ScopeReadResult,
  cwd: string,
  hooksRouting: InstallHooksRouting,
  outcomes: PerEntryOutcome[],
): Promise<void> {
  reportUnreadableDeclarer(scope, readResult, outcomes);
  await reportRefusedMarketplaces(scope, readResult.state, outcomes);
  await reportDelistedPlugins(scope, readResult.state, outcomes);
  await rebuildScopeRoutingTableIsolated(scope, cwd, hooksRouting, outcomes);
}

/**
 * IL-2 / RECON-04: sends at most one cascade for the outcomes of both scopes,
 * through reconcile's own row policies (D-02 / MOD-03). No outcome sends no
 * cascade (NFR-2 / RECON-05). Returns whether the cascade was sent. The
 * projection reads only each outcome's closed-set reason, never a raw error
 * message (T-55-02-02).
 */
export function notifyScopeOutcomes(
  ctx: NotificationContext,
  run: NotificationRun,
  outcomes: readonly PerEntryOutcome[],
): boolean {
  if (outcomes.length === 0) {
    return false;
  }

  notifyReconcileAppliedWithContext(
    ctx,
    run,
    RECONCILE_APPLIED_CONTEXT,
    buildReconcileAppliedCascade(outcomes),
  );
  return true;
}

/**
 * AMIG-03 / IL-2: sends the one migration notice for both scopes, which speaks
 * even when the pass has no other row, then the outcomes' cascade
 * (`notifyScopeOutcomes`). Returns whether the cascade was sent.
 */
export function notifyScopePasses(
  ctx: NotificationContext,
  run: NotificationRun,
  accumulators: ScopePassAccumulators,
): boolean {
  notifyMcpMigration(ctx, run, accumulators.migration);
  return notifyScopeOutcomes(ctx, run, accumulators.outcomes);
}

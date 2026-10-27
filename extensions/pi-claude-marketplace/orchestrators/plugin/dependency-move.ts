// orchestrators/plugin/dependency-move.ts
//
// UPD-DEP-D1 / RESV-05: moves a recorded dependency into the range a plugin
// being installed or updated asks for, through `update`'s own path. A move
// runs the update preflight with the requesting plugin's ranges folded in
// place of its record's declarations, so the dependency's other dependents
// still hold it (`{dependents constrain}`), and it takes the highest version
// the combined range admits: a release tag when one satisfies it (D-03-03),
// else the catalog version.
//
// `judgeDependencyMove` decides one move and writes nothing; the dependency
// plan (`dependency-plan.ts`) judges every move of an operation before any
// runs. `runDependencyMove` then makes one planned move, its own update
// landing exactly the version the plan chose. It settles nothing: the plan
// placed what the new version needs in the steps before it.
//
// Never called while the scope's state lock is held: the preflight takes it
// itself for an unpinned git source, and the lock is not re-entrant.
//
// Not a plugin ledger and names no git surface: the preflight and the shared
// runner reach git through their own seams.

import { MAX_REFUSAL_VERSION_CHARS, truncateForRefusal } from "../../domain/dependency-range.ts";
import { errorMessage, rethrowInvalidGitHubBaseUrl } from "../../shared/errors.ts";
import { companionSeverity } from "../../shared/notify-reasons.ts";
import { redactCauseChain } from "../../shared/redact-absolute-paths.ts";

import { plannedRangeVersion } from "./dependency-plan.ts";
import { materializeLatestVersion } from "./materialize-latest.ts";
import { isUpdatePreflightOutcome, preparePluginUpdate } from "./update-preflight.ts";
import { updatedRowFromOutcome } from "./update-row.ts";
import { assertUpdateNamesFree } from "./update-swap.ts";

import type { DependencyMoveRequest, PlannedDependencyMove } from "./dependency-plan.ts";
import type {
  MaterializationPolicy,
  PreparedPluginUpdate,
  PreparePluginUpdateOptions,
} from "./update-preflight.ts";
import type { CascadeThreePhaseArgs, UpdateRunOutcome } from "./update-swap.ts";
import type { ClaudeEnv } from "../../domain/claude-mcp-variables.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { SoftDepStatus } from "../../platform/pi-api.ts";
import type { CompletionCache } from "../../shared/completion-cache.ts";
import type { Scope } from "../../shared/types.ts";
import type { LockedStateTransactionDeps } from "../../transaction/with-state-guard.ts";
import type { AuthAttemptResult, CredentialOps, DeviceFlowHttp } from "../auth-host.ts";
import type { UpdateDependencyRow } from "../types.ts";
import type { UpdateHooksRouting } from "./update-cascade.ts";

/** The collaborators every dependency move of one operation shares. */
export interface DependencyMoveContext {
  readonly scope: Scope;
  readonly cwd: string;
  readonly locations: ScopedLocations;
  readonly hooksRouting: UpdateHooksRouting;
  readonly completionCache: CompletionCache;
  readonly env: ClaudeEnv;
  /**
   * The operation's materialization knobs: `install` reads a present mirror
   * offline (NFR-5), `update` refreshes it, and `apply` lists no tag (D-23).
   * The judge reads them; the move after it reads the mirror the judge left.
   */
  readonly policy: MaterializationPolicy;
  /** The command's `--partial` and `--map-model`, cascade-wide as on an install. */
  readonly partial?: boolean;
  readonly mapModel?: boolean;
  /** The command's context, so a move authenticates as the command does. */
  readonly notification?: PreparePluginUpdateOptions["notification"];
  readonly credentialOps?: CredentialOps;
  readonly deviceFlowHttp?: DeviceFlowHttp;
  readonly authMemo?: Map<string, AuthAttemptResult>;
  /** D-10-18: one memo pair per operation, so the judge and the move list a source once. */
  readonly constraintTagMemo: NonNullable<CascadeThreePhaseArgs["constraintTagMemo"]>;
  readonly constraintMarketplaceTagMemo: NonNullable<
    CascadeThreePhaseArgs["constraintMarketplaceTagMemo"]
  >;
  readonly stateTransaction?: LockedStateTransactionDeps;
  /**
   * IN-N4: what a move that changed a git revision collects. The operation's
   * own sweep runs after its last step, knowing which clones were there
   * before it started.
   */
  readonly cleanupClones: CascadeThreePhaseArgs["cleanupClones"];
  /** The soft-dependency snapshot the moved rows stamp severity from. */
  readonly softDeps: SoftDepStatus;
}

/** The tag memos of one operation's moves (D-10-18). */
export type DependencyMoveMemos = Pick<
  DependencyMoveContext,
  "constraintMarketplaceTagMemo" | "constraintTagMemo"
>;

/** A fresh memo pair, for an operation that has none yet. */
export function freshDependencyMoveMemos(): DependencyMoveMemos {
  const constraintTagMemo: DependencyMoveContext["constraintTagMemo"] = new Map();
  const constraintMarketplaceTagMemo: DependencyMoveContext["constraintMarketplaceTagMemo"] =
    new Map();
  return { constraintTagMemo, constraintMarketplaceTagMemo };
}

/** One move's verdict: the candidate it would land, or why it cannot move. */
export type DependencyMoveJudgement =
  | { readonly ok: true; readonly prepared: PreparedPluginUpdate }
  | { readonly ok: false; readonly cause: string };

/** What one move did: whether it landed, and the row that reports it. */
export interface DependencyMoveRun {
  readonly landed: boolean;
  readonly rows: readonly UpdateDependencyRow[];
}

function moveArgs(
  context: DependencyMoveContext,
  request: DependencyMoveRequest,
): CascadeThreePhaseArgs {
  return {
    plugin: request.name,
    marketplace: request.marketplace,
    scope: context.scope,
    cwd: context.cwd,
    locations: context.locations,
    hooksRouting: context.hooksRouting,
    completionCache: context.completionCache,
    env: context.env,
    cascade: true,
    cleanupClones: context.cleanupClones,
    constraintTagMemo: context.constraintTagMemo,
    constraintMarketplaceTagMemo: context.constraintMarketplaceTagMemo,
    requesters: request.requesters,
    excludedVersions: request.excludedVersions,
    ...(context.partial !== undefined && { partial: context.partial }),
    ...(context.mapModel !== undefined && { mapModel: context.mapModel }),
    ...(context.notification !== undefined && { preflightNotification: context.notification }),
    ...(context.credentialOps !== undefined && { credentialOps: context.credentialOps }),
    ...(context.deviceFlowHttp !== undefined && { deviceFlowHttp: context.deviceFlowHttp }),
    ...(context.authMemo !== undefined && { authMemo: context.authMemo }),
    ...(context.stateTransaction !== undefined && { stateTransaction: context.stateTransaction }),
  };
}

/**
 * Why a verdict leaves the dependency where it is: a held move's notes say
 * which range holds it, and any other verdict's say what the preflight found,
 * as an update's row would.
 */
function refusalCause(
  verdict: Exclude<UpdateRunOutcome, { readonly partition: "updated" }>,
): string {
  if (verdict.partition === "unchanged") {
    const newest = truncateForRefusal(verdict.toVersion, MAX_REFUSAL_VERSION_CHARS);
    return `version ${newest} is the newest version it can move to`;
  }

  return verdict.notes.join(" ");
}

/**
 * Judges one move with the update preflight under `judgeOnly`, which writes
 * no state, then the swap's PI-6 name check: the candidate it would land, or
 * why it cannot move. A git source clones on a cache miss, as the move would.
 * GHB-03: an invalid GitHub base override is the command's failure, not a
 * refusal, so it propagates.
 */
export async function judgeDependencyMove(
  request: DependencyMoveRequest,
  context: DependencyMoveContext,
): Promise<DependencyMoveJudgement> {
  const args = moveArgs(context, request);
  try {
    const prepared = await preparePluginUpdate({
      ...args,
      policy: context.policy,
      judgeOnly: true,
      ...(context.notification !== undefined && { notification: context.notification }),
    });
    if (isUpdatePreflightOutcome(prepared)) {
      return { ok: false, cause: refusalCause(prepared) };
    }

    // WR-1: a version with no semver form escapes the range that rules the
    // others out, so the plan's own list decides.
    if (request.excludedVersions?.includes(plannedRangeVersion(prepared)) === true) {
      const ruledOut = truncateForRefusal(prepared.toVersion, MAX_REFUSAL_VERSION_CHARS);
      return { ok: false, cause: `version ${ruledOut} was ruled out by the plan` };
    }

    await assertUpdateNamesFree(args, prepared);
    return { ok: true, prepared };
  } catch (err) {
    rethrowInvalidGitHubBaseUrl(err);
    return { ok: false, cause: errorMessage(err) };
  }
}

/**
 * Whether a move landed. `unchanged` passed the same range check, so the
 * recorded revision is already the candidate. A disabled record's move
 * refreshes its pin and stays disabled (D-05), so its preflight reports it
 * skipped as already disabled; a later step of the plan re-enables it at the
 * new version.
 */
function moveLanded(outcome: UpdateRunOutcome): boolean {
  return (
    outcome.partition === "updated" ||
    outcome.partition === "unchanged" ||
    (outcome.partition === "skipped" && outcome.reasons.includes("already disabled"))
  );
}

/**
 * The row a move reports, named by the dependency's full key as cascade rows
 * are: the update row of a move that landed, a failed row with what the update
 * found for one that did not. WR-2: a disabled record's pin refresh changed
 * the record too, so it reports the move as `{already disabled}`; the
 * re-enable after it takes its place (`supersedePinRefreshes`).
 */
function moveRow(
  context: DependencyMoveContext,
  move: PlannedDependencyMove,
  outcome: UpdateRunOutcome,
): UpdateDependencyRow | undefined {
  const { request } = move;
  if (outcome.partition === "updated") {
    const row = updatedRowFromOutcome(outcome, context.scope, {
      updated: companionSeverity(outcome, context.softDeps),
      partiallyInstalled: companionSeverity(outcome, context.softDeps),
    });
    return { ...row, name: request.key };
  }

  if (outcome.partition === "unchanged") {
    return undefined;
  }

  if (moveLanded(outcome)) {
    return {
      status: "updated",
      name: request.key,
      from: request.recordedVersion,
      to: move.version,
      dependencies: [],
      reasons: ["already disabled"],
      severity: "info",
      needsReload: false,
    };
  }

  const thrown = outcome.partition === "failed" ? outcome.cause : undefined;
  return {
    status: "failed",
    name: request.key,
    version: request.recordedVersion,
    reasons: outcome.reasons,
    cause: thrown ?? new Error(refusalCause(outcome)),
    severity: "error",
  };
}

/** WR-2: whether `row` reports a disabled dependency's pin refresh. */
function isPinRefresh(row: UpdateDependencyRow): boolean {
  return row.status === "updated" && row.reasons?.includes("already disabled") === true;
}

/**
 * WR-2: `rows` without the pin refresh of each dependency `later` reports
 * again, so a dependency moved while disabled and then re-enabled reports
 * one row, its re-enable.
 */
export function supersedePinRefreshes<T extends { readonly row: UpdateDependencyRow }>(
  rows: readonly T[],
  later: ReadonlySet<string>,
): T[] {
  return rows.filter((entry) => !(isPinRefresh(entry.row) && later.has(entry.row.name)));
}

/**
 * UPD-DEP-D1: makes one planned move through the shared runner, at exactly
 * the version the plan chose. IN-04: it reads the mirror the judge refreshed
 * moments before, so an unpinned git source is fetched once. A throw is the
 * caller's to report.
 */
export async function runDependencyMove(
  move: PlannedDependencyMove,
  context: DependencyMoveContext,
): Promise<DependencyMoveRun> {
  const outcome = await materializeLatestVersion(
    { ...moveArgs(context, move.request), expectVersion: move.version },
    { ...context.policy, refreshSource: false },
  );
  const row = moveRow(context, move, outcome);
  return { landed: moveLanded(outcome), rows: row === undefined ? [] : [row] };
}

/**
 * The failed row of a move that threw, at the version it kept. Its cause
 * chain is rebuilt with every absolute path redacted (T-55-02-02), since a
 * swap's error names the staging files it was writing.
 */
export function failedMoveRow(
  request: DependencyMoveRequest,
  thrown: unknown,
): UpdateDependencyRow {
  return {
    status: "failed",
    name: request.key,
    version: request.recordedVersion,
    reasons: [],
    cause: redactCauseChain(thrown) ?? new Error(errorMessage(thrown)),
    severity: "error",
  };
}

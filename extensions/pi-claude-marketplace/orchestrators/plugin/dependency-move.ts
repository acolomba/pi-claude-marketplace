// orchestrators/plugin/dependency-move.ts
//
// UPD-DEP-D1 / RESV-05: moves a recorded dependency into the range a plugin
// being installed or updated asks for, through `update`'s own path. The move
// runs the update preflight with the requesting plugin's ranges folded in
// place of its record's declarations, so the dependency's other dependents
// still hold it (`{dependents constrain}`), and it takes the highest version
// the combined range admits: a release tag when one satisfies it (D-03-03),
// else the catalog version.
//
// Every move is judged before the first one runs, writing nothing, so a
// dependency that cannot move refuses the whole operation and leaves the
// scope as it was. The moves then run dependencies first, each its own
// update; a move that fails stops the rest, and the moves already made stay,
// each a complete update.
//
// Not a plugin ledger and names no git surface: the preflight and the shared
// runner reach git through their own seams.

import { companionSeverity } from "../../shared/notify-reasons.ts";

import { garbageCollectPluginClones } from "./clone-gc.ts";
import { materializeLatestVersion } from "./materialize-latest.ts";
import {
  isUpdatePreflightOutcome,
  preparePluginUpdate,
  UPDATE_MATERIALIZATION,
} from "./update-preflight.ts";
import { updatedRowFromOutcome } from "./update-row.ts";

import type { OutOfRangeMember } from "./install-cascade.ts";
import type {
  CascadeThreePhaseArgs,
  UpdateDependencySettler,
  UpdateRunOutcome,
} from "./update-swap.ts";
import type { ClaudeEnv } from "../../domain/claude-mcp-variables.ts";
import type { ReleaseTagCandidate } from "../../domain/release-tag.ts";
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
  readonly credentialOps?: CredentialOps;
  readonly deviceFlowHttp?: DeviceFlowHttp;
  readonly authMemo?: Map<string, AuthAttemptResult>;
  /** D-10-18: one memo pair per operation, so the judge and the move list a source once. */
  readonly constraintTagMemo: NonNullable<CascadeThreePhaseArgs["constraintTagMemo"]>;
  readonly constraintMarketplaceTagMemo: Map<string, readonly ReleaseTagCandidate[]>;
  /** Settles the moved dependency's own new closure, as any update does. */
  readonly settleDependencies?: UpdateDependencySettler;
  readonly stateTransaction?: LockedStateTransactionDeps;
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

/** Every move can be made, or the first one that cannot and why. */
export type DependencyMoveJudgement =
  | { readonly ok: true }
  | { readonly ok: false; readonly member: OutOfRangeMember; readonly cause: string };

/** The moves all landed, or the one that failed; `rows` lists every move attempted. */
export type DependencyMoveResult =
  | { readonly ok: true; readonly rows: readonly UpdateDependencyRow[] }
  | {
      readonly ok: false;
      readonly rows: readonly UpdateDependencyRow[];
      readonly member: OutOfRangeMember;
    };

function moveArgs(context: DependencyMoveContext, member: OutOfRangeMember): CascadeThreePhaseArgs {
  return {
    plugin: member.name,
    marketplace: member.marketplace,
    scope: context.scope,
    cwd: context.cwd,
    locations: context.locations,
    hooksRouting: context.hooksRouting,
    completionCache: context.completionCache,
    env: context.env,
    cascade: true,
    cleanupClones: garbageCollectPluginClones,
    constraintTagMemo: context.constraintTagMemo,
    constraintMarketplaceTagMemo: context.constraintMarketplaceTagMemo,
    requester: { key: member.requiredBy, ranges: member.ranges },
    ...(context.credentialOps !== undefined && { credentialOps: context.credentialOps }),
    ...(context.deviceFlowHttp !== undefined && { deviceFlowHttp: context.deviceFlowHttp }),
    ...(context.authMemo !== undefined && { authMemo: context.authMemo }),
    ...(context.settleDependencies !== undefined && {
      settleDependencies: context.settleDependencies,
    }),
    ...(context.stateTransaction !== undefined && { stateTransaction: context.stateTransaction }),
  };
}

/**
 * Why a preflight verdict leaves the dependency where it is: a held move's
 * notes say which range holds it, and any other verdict's say what the
 * preflight found, as an update's row would.
 */
function refusalCause(
  verdict: Exclude<UpdateRunOutcome, { readonly partition: "updated" }>,
): string {
  if (verdict.partition === "unchanged") {
    return `version ${verdict.toVersion} is the newest version it can move to`;
  }

  return verdict.notes.join(" ");
}

/**
 * Judges every move before any runs: each runs the update preflight, which
 * writes nothing under `judgeOnly`, and the first that cannot move is the
 * refusal.
 */
export async function judgeDependencyMoves(
  members: readonly OutOfRangeMember[],
  context: DependencyMoveContext,
): Promise<DependencyMoveJudgement> {
  for (const member of members) {
    // eslint-disable-next-line no-await-in-loop -- the first refusal ends the judgement
    const prepared = await preparePluginUpdate({
      ...moveArgs(context, member),
      policy: UPDATE_MATERIALIZATION,
      judgeOnly: true,
    });
    if (isUpdatePreflightOutcome(prepared)) {
      return { ok: false, member, cause: refusalCause(prepared) };
    }
  }

  return { ok: true };
}

/**
 * Whether a move landed. A disabled record's move refreshes its pin and stays
 * disabled (D-05), so its preflight reports it skipped as already disabled;
 * the cascade then enables it at the new version.
 */
function moveLanded(outcome: UpdateRunOutcome): boolean {
  return (
    outcome.partition === "updated" ||
    (outcome.partition === "skipped" && outcome.reasons.includes("already disabled"))
  );
}

/** One move through the shared runner, its throw captured as a failed outcome. */
async function runMove(
  context: DependencyMoveContext,
  member: OutOfRangeMember,
): Promise<UpdateRunOutcome> {
  try {
    return await materializeLatestVersion(moveArgs(context, member), UPDATE_MATERIALIZATION);
  } catch (err) {
    return {
      partition: "failed",
      name: member.name,
      fromVersion: member.recordedVersion,
      notes: [],
      reasons: [],
      cause: err as Error,
      declaresAgents: false,
      declaresMcp: false,
      declaresWorkflows: false,
    };
  }
}

/**
 * The row a move reports, named by the dependency's full key as cascade rows
 * are: the update row of a move that landed, a failed row with what the update
 * found for one that did not, nothing for a disabled record's pin refresh.
 */
function moveRow(
  context: DependencyMoveContext,
  member: OutOfRangeMember,
  outcome: UpdateRunOutcome,
): UpdateDependencyRow | undefined {
  if (outcome.partition === "updated") {
    const row = updatedRowFromOutcome(outcome, context.scope, {
      updated: companionSeverity(outcome, context.softDeps),
      partiallyInstalled: companionSeverity(outcome, context.softDeps),
    });
    return { ...row, name: member.key };
  }

  if (moveLanded(outcome)) {
    return undefined;
  }

  const thrown = outcome.partition === "failed" ? outcome.cause : undefined;
  const cause = thrown ?? new Error(refusalCause(outcome));
  return {
    status: "failed",
    name: member.key,
    version: member.recordedVersion,
    reasons: outcome.partition === "unchanged" ? [] : outcome.reasons,
    cause,
    severity: "error",
  };
}

/**
 * Makes the judged moves, dependencies first. A move that does not land stops
 * the rest; the moves already made stay.
 */
export async function runDependencyMoves(
  members: readonly OutOfRangeMember[],
  context: DependencyMoveContext,
): Promise<DependencyMoveResult> {
  const rows: UpdateDependencyRow[] = [];
  for (const member of members) {
    // eslint-disable-next-line no-await-in-loop -- each move locks the scope (retries: 0), dependencies first
    const outcome = await runMove(context, member);
    const row = moveRow(context, member, outcome);
    // The moved dependency's own new closure reports beside it.
    rows.push(...(row === undefined ? [] : [row]), ...(outcome.dependencyRows ?? []));

    if (!moveLanded(outcome)) {
      return { ok: false, rows, member };
    }
  }

  return { ok: true, rows };
}

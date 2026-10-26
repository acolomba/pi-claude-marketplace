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
// runs. `runDependencyMoves` then makes the moves, each its own update, and
// skips a dependency an earlier move's own closure already brought into
// range. A move that fails stops the rest; the moves already made stay, each
// a complete update, and the result lists them.
//
// Never called while the scope's state lock is held: the preflight takes it
// itself for an unpinned git source, and the lock is not re-entrant.
//
// Not a plugin ledger and names no git surface: the preflight and the shared
// runner reach git through their own seams.

import { recordedVersionSatisfies } from "../../domain/dependency-range.ts";
import { loadState } from "../../persistence/state-io.ts";
import { errorMessage } from "../../shared/errors.ts";
import { companionSeverity } from "../../shared/notify-reasons.ts";
import { ownValue } from "../../shared/own-key.ts";

import { garbageCollectPluginClones } from "./clone-gc.ts";
import { materializeLatestVersion } from "./materialize-latest.ts";
import { isUpdatePreflightOutcome, preparePluginUpdate } from "./update-preflight.ts";
import { updatedRowFromOutcome } from "./update-row.ts";

import type { OutOfRangeMember } from "./install-cascade.ts";
import type {
  MaterializationPolicy,
  PreparedPluginUpdate,
  PreparePluginUpdateOptions,
} from "./update-preflight.ts";
import type {
  CascadeThreePhaseArgs,
  UpdateDependencySettler,
  UpdateRunOutcome,
} from "./update-swap.ts";
import type { ClaudeEnv } from "../../domain/claude-mcp-variables.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { SoftDepStatus } from "../../platform/pi-api.ts";
import type { CompletionCache } from "../../shared/completion-cache.ts";
import type { Scope } from "../../shared/types.ts";
import type { LockedStateTransactionDeps } from "../../transaction/with-state-guard.ts";
import type { AuthAttemptResult, CredentialOps, DeviceFlowHttp } from "../auth-host.ts";
import type { MovedDependency, UpdateDependencyRow } from "../types.ts";
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

/** One move's verdict: the candidate it would land, or why it cannot move. */
export type DependencyMoveJudgement =
  | { readonly ok: true; readonly prepared: PreparedPluginUpdate }
  | { readonly ok: false; readonly cause: string };

/** The moves all landed, or the one that did not; `moved` lists every row reported. */
export type DependencyMoveResult =
  | { readonly ok: true; readonly moved: readonly MovedDependency[] }
  | {
      readonly ok: false;
      readonly moved: readonly MovedDependency[];
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
    ...(context.partial !== undefined && { partial: context.partial }),
    ...(context.mapModel !== undefined && { mapModel: context.mapModel }),
    ...(context.notification !== undefined && { preflightNotification: context.notification }),
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
 * Why a verdict leaves the dependency where it is: a held move's notes say
 * which range holds it, and any other verdict's say what the preflight found,
 * as an update's row would.
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
 * Judges one move with the update preflight under `judgeOnly`, which writes
 * no state: the candidate it would land, or why it cannot move. A git source
 * clones on a cache miss, as the move would.
 */
export async function judgeDependencyMove(
  member: OutOfRangeMember,
  context: DependencyMoveContext,
): Promise<DependencyMoveJudgement> {
  const args = moveArgs(context, member);
  try {
    const prepared = await preparePluginUpdate({
      ...args,
      policy: context.policy,
      judgeOnly: true,
      ...(context.notification !== undefined && { notification: context.notification }),
    });
    return isUpdatePreflightOutcome(prepared)
      ? { ok: false, cause: refusalCause(prepared) }
      : { ok: true, prepared };
  } catch (err) {
    return { ok: false, cause: errorMessage(err) };
  }
}

/**
 * Whether a move landed. `unchanged` passed the same range check, so the
 * recorded revision is already the candidate. A disabled record's move
 * refreshes its pin and stays disabled (D-05), so its preflight reports it
 * skipped as already disabled; the cascade then enables it at the new version.
 */
function moveLanded(outcome: UpdateRunOutcome): boolean {
  return (
    outcome.partition === "updated" ||
    outcome.partition === "unchanged" ||
    (outcome.partition === "skipped" && outcome.reasons.includes("already disabled"))
  );
}

/** One move through the shared runner, its throw captured as a failed outcome. */
async function runMove(
  context: DependencyMoveContext,
  member: OutOfRangeMember,
  recordedVersion: string,
): Promise<UpdateRunOutcome> {
  try {
    return await materializeLatestVersion(moveArgs(context, member), context.policy);
  } catch (err) {
    return {
      partition: "failed",
      name: member.name,
      fromVersion: recordedVersion,
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
  recordedVersion: string,
): UpdateDependencyRow | undefined {
  if (outcome.partition === "updated") {
    const row = updatedRowFromOutcome(outcome, context.scope, {
      updated: companionSeverity(outcome, context.softDeps),
      partiallyInstalled: companionSeverity(outcome, context.softDeps),
    });
    return { ...row, name: member.key };
  }

  if (outcome.partition === "unchanged" || moveLanded(outcome)) {
    return undefined;
  }

  const thrown = outcome.partition === "failed" ? outcome.cause : undefined;
  return {
    status: "failed",
    name: member.key,
    version: recordedVersion,
    reasons: outcome.reasons,
    cause: thrown ?? new Error(refusalCause(outcome)),
    severity: "error",
  };
}

/**
 * The version the scope records for `member` now, and whether it already
 * satisfies the member's range: an earlier move's own closure may have moved
 * it (CR-02).
 */
async function recordedNow(
  context: DependencyMoveContext,
  member: OutOfRangeMember,
): Promise<{ readonly version: string; readonly inRange: boolean }> {
  const state = await loadState(context.locations.extensionRoot);
  const record = ownValue(ownValue(state.marketplaces, member.marketplace)?.plugins, member.name);
  const version = record?.version ?? member.recordedVersion;
  return {
    version,
    inRange: member.ranges.every((range) => recordedVersionSatisfies(version, range)),
  };
}

/** A nested closure's row, which names its dependency by `<plugin>@<marketplace>`. */
function movedFromRow(row: UpdateDependencyRow): MovedDependency {
  const at = row.name.lastIndexOf("@");
  return {
    key: row.name,
    name: row.name.slice(0, at),
    marketplace: row.name.slice(at + 1),
    row,
  };
}

function moved(member: OutOfRangeMember, row: UpdateDependencyRow): MovedDependency {
  return { key: member.key, name: member.name, marketplace: member.marketplace, row };
}

/**
 * Makes the judged moves in order, each its own update. A dependency already
 * in range is skipped. The moved dependency's own new closure reports beside
 * it. A move that does not land stops the rest.
 */
export async function runDependencyMoves(
  members: readonly OutOfRangeMember[],
  context: DependencyMoveContext,
): Promise<DependencyMoveResult> {
  const done: MovedDependency[] = [];
  for (const member of members) {
    // eslint-disable-next-line no-await-in-loop -- each move reads what the previous one landed
    const now = await recordedNow(context, member);
    if (now.inRange) {
      continue;
    }

    // eslint-disable-next-line no-await-in-loop -- each move locks the scope (retries: 0), dependencies first
    const outcome = await runMove(context, member, now.version);
    const row = moveRow(context, member, outcome, now.version);
    done.push(
      ...(row === undefined ? [] : [moved(member, row)]),
      ...(outcome.dependencyRows ?? []).map(movedFromRow),
    );
    if (!moveLanded(outcome)) {
      return { ok: false, moved: done, member };
    }
  }

  return { ok: true, moved: done };
}

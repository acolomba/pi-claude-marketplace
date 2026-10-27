// orchestrators/plugin/materialize-latest.ts
//
// UPR-01 / D-18-02 / D-18-03: the one materialization path `update` and
// `reinstall` share. It resolves the candidate the marketplace currently
// offers, then swaps it in with the three-phase swap. Both flows are plugin
// ledgers, so neither may import the other; this leaf is not a ledger and
// names no git surface.

import { loadState } from "../../persistence/state-io.ts";
import { composeErrorWithCauseChain, rethrowInvalidGitHubBaseUrl } from "../../shared/errors.ts";
import { mcpConfigNoticesMember } from "../marketplace/shared.ts";

import { isUpdatePreflightOutcome, preparePluginUpdate } from "./update-preflight.ts";
import { preflightMove, swapPluginUpdate } from "./update-swap.ts";

import type {
  MaterializationPolicy,
  PreparedPluginUpdate,
  PreparePluginUpdateOptions,
} from "./update-preflight.ts";
import type {
  ThreePhaseArgs,
  ThreePhaseArgsBase,
  UpdateDependencySettlement,
  UpdateRunOutcome,
} from "./update-swap.ts";
import type { McpConfigNotice } from "../../shared/notification-types.ts";
import type { StagingWarning } from "../../shared/staging-warnings.ts";
import type { PluginUpdateFailedOutcome, RevisionMove } from "../types.ts";

/**
 * UPR-03: what one target's runner reported, so a thrown failure can name the
 * installed version once the preflight found the record, and the move it
 * attempted once it derived a candidate. A caller creates a fresh one per
 * target, so a later target never renders an earlier target's versions.
 *
 * D-PL1-14 / D-PL1-24: `stagingWarnings` holds the tagged warnings of the
 * handles the swap prepared before it threw, so the same per-target holder
 * carries them to the catch site that builds the failed outcome.
 */
export interface CandidateReport {
  move?: Partial<RevisionMove>;
  stagingWarnings?: readonly StagingWarning[];
}

/** UPR-03 / D-PL1-14: the runner callbacks that fill `report`, for both verbs. */
export function recordCandidate(
  report: CandidateReport,
): Pick<ThreePhaseArgsBase, "onCandidate" | "onRecord" | "onStagingWarnings"> {
  return {
    onRecord: (fromVersion) => {
      report.move = { fromVersion };
    },
    onCandidate: (move) => {
      report.move = move;
    },
    onStagingWarnings: (warnings) => {
      report.stagingWarnings = warnings;
    },
  };
}

/**
 * D-PL1-14: the reported warnings as a failed outcome's member, omitted when
 * the swap reported none (NREG-01).
 */
export function reportedStagingWarnings(
  report: CandidateReport,
): Pick<PluginUpdateFailedOutcome, "stagingWarnings"> {
  return report.stagingWarnings === undefined ? {} : { stagingWarnings: report.stagingWarnings };
}

/**
 * Materializes the latest version the scope knows about for one installed
 * plugin. `policy` carries the per-verb knobs (D-18-04); every other step is
 * the same for both verbs.
 *
 * NFR-7: `UpdatePreflightOutcome` is a strict subset of `UpdateRunOutcome`, so a
 * preflight verdict returns straight through with no cast. That assignability is
 * the guard: a preflight row that gained a `toVersion`, a commit, or
 * `phaseFailures` would fail to compile here, because neither failed arm of
 * `UpdateRunOutcome` admits one, and `isPhase3aAggregateFailure` narrows on
 * exactly that gap.
 *
 * UPR-03: once the preflight derived a candidate, and before the swap starts,
 * the runner reports the candidate's revisions through `args.onCandidate`, so
 * a caller can name the move on a failure the swap throws.
 */
export async function materializeLatestVersion(
  args: ThreePhaseArgs,
  policy: MaterializationPolicy,
): Promise<UpdateRunOutcome> {
  const preflight = await preparePluginUpdate({
    ...args,
    policy,
    ...preflightNotification(args),
  });
  if (isUpdatePreflightOutcome(preflight)) {
    return preflight;
  }

  const move = preflightMove(preflight);
  args.onCandidate?.(move);
  // UPD-DEP-D1: an update is an install of a newer version, so before the
  // swap the version it moves to gets its dependency closure the way an
  // install does: missing dependencies installed, disabled ones enabled,
  // out-of-range ones moved, dependencies first. A disabled record never gets
  // here: its preflight refreshes its pin, and enabling it runs the same
  // cascade (EDEP-03).
  const settled = await args.settleDependencies?.(args, preflight);
  if (settled?.kind === "refused") {
    // UPR-03: a refused update names the installed version it kept.
    return {
      partition: "failed",
      name: args.plugin,
      fromVersion: move.fromVersion,
      notes: [settled.cause.message],
      reasons: ["dependency failed"],
      dependencyRows: settled.rows,
      declaresAgents: false,
      declaresMcp: false,
      declaresWorkflows: false,
      // D-PL1-16: the dependencies installed before the refusal rewrote the file.
      ...settleNoticesFirst(settled, undefined),
    };
  }

  if (settled === undefined || !reportsChanges(settled)) {
    return swapPluginUpdate(args, preflight, policy);
  }

  return swapAfterSettle(args, preflight, policy, settled);
}

/**
 * D-PL1-16: a settle that installed a dependency reports a row for it, and
 * one that rewrote the MCP file reports a notice. Either one routes the swap
 * through `swapAfterSettle`, so no notice is dropped for want of a row.
 */
function reportsChanges(settled: UpdateDependencySettlement): boolean {
  return settled.rows.length > 0 || (settled.mcpConfigNotices ?? []).length > 0;
}

/**
 * D-PL1-16: the settle's MCP config notices ahead of the outcome's own, as
 * an outcome member omitted when both are empty (NREG-01).
 */
function settleNoticesFirst(
  settled: UpdateDependencySettlement,
  own: readonly McpConfigNotice[] | undefined,
): { readonly mcpConfigNotices?: readonly McpConfigNotice[] } {
  return mcpConfigNoticesMember([...(settled.mcpConfigNotices ?? []), ...(own ?? [])]);
}

/** The command's context for the preflight's prompts, when it has one. */
function preflightNotification(
  args: ThreePhaseArgs,
): Pick<PreparePluginUpdateOptions, "notification"> {
  if (!args.cascade) {
    return { notification: { ctx: args.ctx, run: args.run } };
  }

  return args.preflightNotification === undefined
    ? {}
    : { notification: args.preflightNotification };
}

/**
 * UPD-DEP-D1 / WR-02, WR-03: the swap after a settle that changed the scope.
 * The PI-6 name check reads the scope as the settle left it. The settle's
 * changes are complete installs, enables and moves, and they stay when the
 * swap then fails; the failed row lists them, so the report names every
 * change the update made.
 *
 * D-PL1-16: the settle's MCP config notices come first on either outcome,
 * since the dependencies rewrote the file before the swap did.
 */
async function swapAfterSettle(
  args: ThreePhaseArgs,
  preflight: PreparedPluginUpdate,
  policy: MaterializationPolicy,
  settled: UpdateDependencySettlement,
): Promise<UpdateRunOutcome> {
  const settledState = await loadState(args.locations.extensionRoot);
  const report: CandidateReport = {};
  try {
    const outcome = await swapPluginUpdate(
      forwardingStagingWarnings(args, report),
      { ...preflight, state: settledState },
      policy,
    );
    return {
      ...outcome,
      ...dependencyRowsMember(settled),
      ...settleNoticesFirst(settled, ownNotices(outcome)),
    };
  } catch (err) {
    rethrowInvalidGitHubBaseUrl(err);
    return {
      partition: "failed",
      name: args.plugin,
      fromVersion: preflight.fromVersion,
      notes: [composeErrorWithCauseChain(err)],
      reasons: [],
      cause: err as Error,
      ...dependencyRowsMember(settled),
      declaresAgents: false,
      declaresMcp: false,
      declaresWorkflows: false,
      // D-PL1-14: the warnings of the handles prepared before the throw.
      ...reportedStagingWarnings(report),
      ...settleNoticesFirst(settled, undefined),
    };
  }
}

/** The settle's dependency rows, as an outcome member omitted when empty (NREG-01). */
function dependencyRowsMember(settled: UpdateDependencySettlement): {
  readonly dependencyRows?: UpdateDependencySettlement["rows"];
} {
  return settled.rows.length > 0 ? { dependencyRows: settled.rows } : {};
}

/** The swap outcome's own MCP config notices; only its updated and failed arms carry any. */
function ownNotices(outcome: UpdateRunOutcome): readonly McpConfigNotice[] | undefined {
  return "mcpConfigNotices" in outcome ? outcome.mcpConfigNotices : undefined;
}

/**
 * D-PL1-14: `args` whose swap reports its warnings into `report` as well as
 * to the caller's own holder, so this module's failed outcome can carry them.
 */
function forwardingStagingWarnings(args: ThreePhaseArgs, report: CandidateReport): ThreePhaseArgs {
  return {
    ...args,
    onStagingWarnings: (warnings) => {
      report.stagingWarnings = warnings;
      args.onStagingWarnings?.(warnings);
    },
  };
}

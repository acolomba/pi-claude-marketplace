// orchestrators/plugin/materialize-latest.ts
//
// UPR-01 / D-18-02 / D-18-03: the one materialization path `update` and
// `reinstall` share. It resolves the candidate the marketplace currently
// offers, then swaps it in with the three-phase swap. Both flows are plugin
// ledgers, so neither may import the other; this leaf is not a ledger and
// names no git surface.

import { loadState } from "../../persistence/state-io.ts";
import { composeErrorWithCauseChain, rethrowInvalidGitHubBaseUrl } from "../../shared/errors.ts";

import { DEFAULT_PACKAGE_INSTALL_OPS, installUpdatedPackages } from "./package-install.ts";
import { isUpdatePreflightOutcome, preparePluginUpdate } from "./update-preflight.ts";
import { preflightMove, swapPluginUpdate } from "./update-swap.ts";

import type { PackageInstallOps } from "./package-install.ts";
import type {
  MaterializationPolicy,
  PreparedPluginUpdate,
  PreparePluginUpdateOptions,
} from "./update-preflight.ts";
import type { ThreePhaseArgs, ThreePhaseArgsBase, UpdateRunOutcome } from "./update-swap.ts";
import type { RevisionMove, UpdateDependencyRow } from "../types.ts";

/**
 * UPR-03: what one target's runner reported, so a thrown failure can name the
 * installed version once the preflight found the record, and the move it
 * attempted once it derived a candidate. A caller creates a fresh one per
 * target, so a later target never renders an earlier target's versions.
 */
export interface CandidateReport {
  move?: Partial<RevisionMove>;
}

/** UPR-03: the runner callbacks that fill `report`, for both verbs. */
export function recordCandidate(
  report: CandidateReport,
): Pick<ThreePhaseArgsBase, "onCandidate" | "onRecord"> {
  return {
    onRecord: (fromVersion) => {
      report.move = { fromVersion };
    },
    onCandidate: (move) => {
      report.move = move;
    },
  };
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
 *
 * D-PL9-12: `packageInstallOps` drives the updated plugin's package install;
 * production callers omit it and get the real package manager.
 */
export async function materializeLatestVersion(
  args: ThreePhaseArgs,
  policy: MaterializationPolicy,
  packageInstallOps: PackageInstallOps = DEFAULT_PACKAGE_INSTALL_OPS,
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
    };
  }

  // D-PL9-07: an updated plugin gets the packages its new version lists.
  const packageTarget = {
    locations: args.locations,
    pluginRoot: preflight.installable.pluginRoot,
    force: revisionMoved(move),
  };
  if (settled === undefined || settled.rows.length === 0) {
    return installUpdatedPackages(
      packageInstallOps,
      await swapPluginUpdate(args, preflight, policy),
      packageTarget,
    );
  }

  return installUpdatedPackages(
    packageInstallOps,
    await swapAfterSettle(args, preflight, policy, settled.rows),
    packageTarget,
  );
}

/**
 * D-PL9-06: whether the swap lands another revision than the record holds.
 * Every verb may move: a reinstall lands the version the marketplace offers
 * now (REI-04), so the policy's `skipSameRevision` does not tell.
 */
function revisionMoved(move: RevisionMove): boolean {
  return move.toCommit !== move.fromCommit || move.toVersion !== move.fromVersion;
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
 */
async function swapAfterSettle(
  args: ThreePhaseArgs,
  preflight: PreparedPluginUpdate,
  policy: MaterializationPolicy,
  rows: readonly UpdateDependencyRow[],
): Promise<UpdateRunOutcome> {
  const settledState = await loadState(args.locations.extensionRoot);
  try {
    return {
      ...(await swapPluginUpdate(args, { ...preflight, state: settledState }, policy)),
      dependencyRows: rows,
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
      dependencyRows: rows,
      declaresAgents: false,
      declaresMcp: false,
      declaresWorkflows: false,
    };
  }
}

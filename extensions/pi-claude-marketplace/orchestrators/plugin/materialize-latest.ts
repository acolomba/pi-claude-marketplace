// orchestrators/plugin/materialize-latest.ts
//
// UPR-01 / D-18-02 / D-18-03: the one materialization path `update` and
// `reinstall` share. It resolves the candidate the marketplace currently
// offers, then swaps it in with the three-phase swap. Both flows are plugin
// ledgers, so neither may import the other; this leaf is not a ledger and
// names no git surface.

import { isUpdatePreflightOutcome, preparePluginUpdate } from "./update-preflight.ts";
import { preflightMove, swapPluginUpdate } from "./update-swap.ts";

import type { MaterializationPolicy } from "./update-preflight.ts";
import type { ThreePhaseArgs, ThreePhaseArgsBase, UpdateRunOutcome } from "./update-swap.ts";
import type { RevisionMove } from "../types.ts";

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
 */
export async function materializeLatestVersion(
  args: ThreePhaseArgs,
  policy: MaterializationPolicy,
): Promise<UpdateRunOutcome> {
  const preflight = await preparePluginUpdate({
    ...args,
    policy,
    ...(!args.cascade && { notification: { ctx: args.ctx, run: args.run } }),
  });
  if (isUpdatePreflightOutcome(preflight)) {
    return preflight;
  }

  args.onCandidate?.(preflightMove(preflight));
  return swapPluginUpdate(args, preflight, policy);
}

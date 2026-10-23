// orchestrators/plugin/materialize-latest.ts
//
// UPR-01 / D-18-02 / D-18-03: the one materialization path `update` and
// `reinstall` share. It resolves the candidate the marketplace currently
// offers, then swaps it in with the three-phase swap. Both flows are plugin
// ledgers, so neither may import the other; this leaf is not a ledger and
// names no git surface.

import { isUpdatePreflightOutcome, preparePluginUpdate } from "./update-preflight.ts";
import { swapPluginUpdate } from "./update-swap.ts";

import type { MaterializationPolicy } from "./update-preflight.ts";
import type { ThreePhaseArgs, UpdateRunOutcome } from "./update-swap.ts";

/**
 * Materializes the latest version the scope knows about for one installed
 * plugin. `policy` carries the per-verb knobs (D-18-04); every other step is
 * the same for both verbs.
 *
 * NFR-7: `UpdatePreflightOutcome` is a strict subset of `UpdateRunOutcome`, so a
 * preflight verdict returns straight through with no cast. That assignability is
 * the guard: a preflight row that gained a `cause`, `toVersion` or
 * `phaseFailures` would fail to compile here, because neither failed arm of
 * `UpdateRunOutcome` admits one, and `isPhase3aAggregateFailure` narrows on
 * exactly that gap.
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

  return swapPluginUpdate(args, preflight, policy);
}

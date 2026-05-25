// presentation/cause-chain.ts -- MSG-CC-1 cause-chain trailer.
//
// The walker logic lives in shared/errors.ts so shared/notify.ts can consume
// it without crossing D-11 (shared/ -> presentation/ is forbidden). This
// file is the presentation-layer re-export so Wave 2 sub-waves import
// `presentation/cause-chain.ts` and stay inside the presentation layer.
//
// See `shared/errors.ts::causeChainTrailer` for the depth-5 walker contract,
// NFR-9 invariant (only `.message` surfaces; no `.stack`, no absolute paths),
// and the T-13-04 / T-13-05 STRIDE mitigations.

import { causeChainTrailer, errorMessage } from "../shared/errors.ts";

export { causeChainTrailer } from "../shared/errors.ts";

/**
 * Compose `errorMessage(err) [\n\n${causeChainTrailer(err)}]` for outcome
 * `notes` aggregated outside the notify path. `notifyError` does this
 * automatically; this helper exists for outcome-aggregation callsites
 * (orchestrators/marketplace/update.ts, orchestrators/plugin/reinstall.ts,
 * orchestrators/plugin/update.ts) that need the same text without going
 * through the notify channel.
 *
 * Extracted from three byte-identical private copies in the
 * orchestrator files above. The single canonical implementation here
 * is the source of truth -- if the cause-chain trailer contract
 * changes (depth bound, separator, trimming rule), the change lands
 * once.
 */
export function composeErrorWithCauseChain(err: unknown): string {
  const trailer = causeChainTrailer(err);
  return trailer === "" ? errorMessage(err) : `${errorMessage(err)}\n\n${trailer}`;
}

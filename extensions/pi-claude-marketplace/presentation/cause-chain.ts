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

export { causeChainTrailer } from "../shared/errors.ts";

// transaction/index.ts -- public API surface for the transaction/ tier.
//
// Phase 5 install/update/uninstall orchestrators consume this module.
// The composition pattern is per CONTEXT.md D-02:
//
//   await withStateGuard(loc, async (state) => {
//     await runPhases(buildPhases(state), { ...ctx, state });
//   });
export type { Phase, RollbackPartial, RunPhasesResult } from "./phase-ledger.ts";
export { runPhases } from "./phase-ledger.ts";

export { formatRollbackError } from "./rollback.ts";

export type { RollbackErrorResult } from "./rollback.ts";

export { withStateGuard } from "./with-state-guard.ts";

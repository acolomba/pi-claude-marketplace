// transaction/rollback.ts
//
// `formatRollbackError` turns a failed `runPhases` result into structured
// data; it does NOT compose any user-visible string. The calling
// orchestrator forwards the `rollbackPartial[]` data into a
// `PluginFailedMessage.rollbackPartial` payload and the renderer in
// `shared/notify.ts` emits the `(failed) {rollback partial}` parent line
// plus its 2-space-indented per-phase children. MSG-RP-1 guards against any
// re-introduction of a hand-composed literal here.
//
// `formatRollbackError` returns a structured `RollbackErrorResult` carrying
// the original Error (wrapped with `cause: originalError` per ES-4 when any
// rollback partial happened) plus the raw `RollbackPartial[]` data.
//
// AS-4 requires the per-phase aggregation; ES-4 requires the new
// Error.cause chain.

import { PathContainmentError } from "../shared/path-safety.ts";

import type { RollbackPartial, RunPhasesResult } from "./phase-ledger.ts";

/**
 * Structured result from {@link formatRollbackError}. Orchestrators
 * destructure this and forward the `rollbackPartials[]` into a
 * `PluginFailedMessage.rollbackPartial` payload consumed by the V2
 * `notify()` renderer in `shared/notify.ts`.
 *
 * `error` is either the original Error (zero-partial fast path and
 * PathContainmentError bypass) or a new Error wrapping the original via
 * `cause` (ES-4 cause-chain) when partials are present. `rollbackPartials`
 * is the raw ledger data the orchestrator needs to build child rows.
 */
export interface RollbackErrorResult {
  readonly error: Error;
  readonly rollbackPartials: readonly RollbackPartial[];
}

/**
 * Format a RunPhasesResult into a structured rollback-error result.
 *
 * The transaction layer does NOT compose the user-visible body -- that
 * responsibility moves to the calling orchestrator, which routes the
 * payload through the V2 `notify()` path in `shared/notify.ts`. The
 * `transaction/` layer remains presentation-free.
 *
 * - PathContainmentError (and SymlinkRefusedError subclass, Phase 1 D-17):
 *   `{ error: originalError, rollbackPartials: [] }` -- the bypass per
 *   D-02 / PI-14; the original error surfaces VERBATIM and the
 *   rollback-partial framing is suppressed.
 * - Zero partials: `{ error: originalError, rollbackPartials: [] }` --
 *   the original error needs no wrapping; no body composition required.
 * - One or more partials: `{ error: new Error(originalError.message, {
 *   cause: originalError }), rollbackPartials: result.rollbackPartials }`
 *   -- ES-4 cause-chain preserved; the orchestrator emits the
 *   `(failed) {rollback partial}` parent + indented per-phase children
 *   by routing the data through a `PluginFailedMessage.rollbackPartial`
 *   payload in `shared/notify.ts` (V2 renderer owns the byte form).
 */
export function formatRollbackError(
  result: RunPhasesResult,
  originalError: Error,
): RollbackErrorResult {
  if (originalError instanceof PathContainmentError) {
    return { error: originalError, rollbackPartials: [] };
  }

  if (result.rollbackPartials.length === 0) {
    return { error: originalError, rollbackPartials: [] };
  }

  return {
    error: new Error(originalError.message, { cause: originalError }),
    rollbackPartials: result.rollbackPartials,
  };
}

// transaction/rollback.ts
//
// D-03 single chokepoint for the rollback-partial user-visible message
// composition. Per Plan 13-02a-02 / CMC-17 / MSG-RP-1 the rendered shape
// uses the closed-set CMC-11 tokens hand-composed inline: a `(failed)
// {rollback partial}` parent line followed by 2-space-indented per-phase
// children of the form `[<phase>] (rollback failed) {rollback partial}`.
//
// Hand-composed inline (not delegated to `presentation/rollback-partial.ts`'s
// `renderRollbackPartial` composer) because that composer requires a
// PluginInlineRow / PluginCascadeRow parent the transaction layer cannot
// own: this chokepoint has NO plugin name / scope / marketplace context
// (it operates at the transaction primitive layer; the plugin context
// lives in the orchestrator above). The token vocabulary is reused
// verbatim and mirrors the `orchestrators/plugin/install.ts:802-839`
// `composeRollbackPartialBody` precedent (which itself intentionally
// drops `p.msg` from child rows because `msg` is not in the closed
// REASONS set; the phaseLabel + status pair carries the user-visible
// failure shape, free-text `msg` surfaces via Error.cause's depth-5
// trailer at the notify boundary).
//
// AS-4 requires the per-phase aggregation; ES-4 requires the new
// Error.cause chain.

import { PathContainmentError } from "../shared/path-safety.ts";

import type { RunPhasesResult } from "./phase-ledger.ts";

/**
 * Format a RunPhasesResult into a user-visible Error.
 *
 * If no undo failures occurred, returns the original error unchanged
 * (no rollback-partial body is needed). Otherwise, composes the
 * hand-composed inline body (parent + 2-space-indented per-phase
 * children using the closed-set CMC-11 token vocabulary) and chains
 * `cause: originalError` for ES-4 traversal.
 *
 * D-02 / PI-14: PathContainmentError (and its SymlinkRefusedError
 * subclass per Phase 1 D-17) MUST NOT be folded into the rollback-
 * partial body. This single chokepoint inherits the bypass for every
 * mutating orchestrator (install, update, uninstall) so the violation
 * surfaces VERBATIM to the user without being masked by partial-rollback
 * framing. Mirrors the SAME bypass already present at
 * `transaction/phase-ledger.ts` for undo-time PathContainmentError; the
 * difference is the chokepoint -- ledger bypasses undo aggregation, here
 * we bypass body composition.
 */
export function formatRollbackError(result: RunPhasesResult, originalError: Error): Error {
  if (originalError instanceof PathContainmentError) {
    return originalError;
  }

  if (result.rollbackPartials.length === 0) {
    return originalError;
  }

  const parentLine = "(failed) {rollback partial}";
  const childLines = result.rollbackPartials
    .map((p) => `  [${p.phase}] (rollback failed) {rollback partial}`)
    .join("\n");
  const composed = `${originalError.message}\n\n${parentLine}\n${childLines}`;
  return new Error(composed, { cause: originalError });
}

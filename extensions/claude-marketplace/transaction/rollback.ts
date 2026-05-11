// transaction/rollback.ts
//
// D-03 single chokepoint for the ES-5 user-contract marker prefix
// (sourced as ROLLBACK_PARTIAL from the shared markers module). Per PRD
// §6.12 the rendered marker shape is: open-paren + that prefix string
// + per-phase entries of the form `[<phase>] <msg>` joined by `; ` +
// closing paren.
//
// The Phase 1 D-08 prefix-equivalence discipline (per B-4) makes drift
// impossible -- the markers-snapshot.test.ts in tests/architecture/
// already enforces that the prefix matches PRD §6.12 byte-for-byte.
// AS-4 requires the per-phase aggregation; ES-4 requires the new
// Error.cause chain.

import { ROLLBACK_PARTIAL } from "../shared/markers.ts";
import { PathContainmentError } from "../shared/path-safety.ts";

import type { RunPhasesResult } from "./phase-ledger.ts";

/**
 * Format a RunPhasesResult into a user-visible Error.
 *
 * If no undo failures occurred, returns the original error unchanged
 * (no marker appendix is needed). Otherwise, appends the AS-4 / ES-5
 * marker to the message and chains `cause: originalError` for ES-4
 * traversal.
 *
 * The marker prefix is sourced from the shared markers module (D-03
 * single chokepoint); inlining a literal here is a drift hazard.
 *
 * D-02 / PI-14: PathContainmentError (and its SymlinkRefusedError
 * subclass per Phase 1 D-17) MUST NOT be folded into the
 * "(rollback partial: ...)" marker. This single chokepoint inherits
 * the bypass for every mutating orchestrator (install, update,
 * uninstall) so the violation surfaces VERBATIM to the user without
 * being masked by partial-rollback framing. Mirrors the SAME bypass
 * already present at `transaction/phase-ledger.ts:86-88` for undo-time
 * PathContainmentError; the difference is the chokepoint -- ledger
 * bypasses undo aggregation, here we bypass marker composition.
 */
export function formatRollbackError(result: RunPhasesResult, originalError: Error): Error {
  if (originalError instanceof PathContainmentError) {
    return originalError;
  }

  if (result.rollbackPartials.length === 0) {
    return originalError;
  }

  const partialBody = result.rollbackPartials.map((p) => `[${p.phase}] ${p.msg}`).join("; ");
  // Marker shape: ROLLBACK_PARTIAL prefix (imported above) + body + ")"
  const marker = `${ROLLBACK_PARTIAL}${partialBody})`;
  return new Error(`${originalError.message} ${marker}`, { cause: originalError });
}

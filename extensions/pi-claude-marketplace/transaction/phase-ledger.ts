// transaction/phase-ledger.ts
//
// Pure async N-phase ledger with reverse-order undo on first throw.
//
// Per CONTEXT.md D-01: this is a FUNCTION, not a coordinator-class.
// Orchestrators (Phase 5) build a literal
// `const PHASES: Phase<InstallCtx>[] = [...]` at every call site.
// Literal-array call sites are the explicit anti-pattern guard against
// implicit phase ordering -- a coordinator-with-`add()` API would let
// the order drift across refactors.
//
// Per PI-14: PathContainmentError MUST NEVER be folded into the
// rollback-partial body. The undo path re-throws it immediately so the
// original failing-phase error becomes its cause via a higher-level
// wrapper.
//
// Per AS-4 / CMC-17 / MSG-RP-1 (post Plan 13-02a-02 / commit 64d823f):
// the user-visible body assembly happens in transaction/rollback.ts
// (D-03 single chokepoint) and uses the closed-set CMC-11 token
// vocabulary -- a `(failed) {rollback partial}` parent line followed by
// 2-space-indented per-phase children of the form
// `[<phase>] (rollback failed) {rollback partial}`. The legacy
// `(rollback partial: ...)` ES-5 marker form was retired in the same
// commit. This file still ships RAW data (RollbackPartial[]);
// rollback.ts formats.

import { errorMessage } from "../shared/errors.ts";
import { PathContainmentError } from "../shared/path-safety.ts";

/**
 * A single ledger phase. `do` runs forward; `undo` (optional) is invoked
 * in reverse order if a later phase throws.
 */
export interface Phase<C> {
  readonly name: string;
  readonly do: (ctx: C) => Promise<void>;
  readonly undo?: (ctx: C) => Promise<void>;
}

/** AS-4: aggregated undo failure (one row per failed `undo` call). */
export interface RollbackPartial {
  readonly phase: string;
  readonly msg: string;
}

/**
 * Structured result. `ok: false` means a phase threw; the original error
 * is in `error`, and rollbackPartials lists every undo that ALSO failed.
 * `leaks` is reserved for future cleanup-leak descriptors (AS-5); the
 * Phase 2 implementation never populates it (Phase 5 orchestrators may).
 */
export interface RunPhasesResult {
  readonly ok: boolean;
  readonly error?: Error;
  readonly rollbackPartials: readonly RollbackPartial[];
  readonly leaks: readonly string[];
}

async function rollbackExecuted<C>(
  executed: readonly Phase<C>[],
  ctx: C,
): Promise<RollbackPartial[]> {
  const partials: RollbackPartial[] = [];

  for (const done of executed.slice().reverse()) {
    if (!done.undo) {
      continue;
    }

    try {
      await done.undo(ctx);
    } catch (undoErr) {
      if (undoErr instanceof PathContainmentError) {
        throw undoErr;
      }

      partials.push({ phase: done.name, msg: errorMessage(undoErr) });
    }
  }

  return partials;
}

/**
 * Run an ordered ledger of phases. On the first throw, walk the executed
 * phases in REVERSE ORDER calling each phase's `undo` (if present),
 * aggregating undo-failures into the result.
 *
 * NEVER throws on its own; callers inspect `result.ok` and (when false)
 * call `formatRollbackError(result, result.error!)` from
 * `transaction/rollback.ts` to produce the user-visible Error.
 *
 * Exception: PI-14 PathContainmentError thrown from an undo step is
 * re-thrown immediately (state corruption is loud). The caller observes
 * a thrown PathContainmentError instead of a `{ok: false, ...}` result.
 */
export async function runPhases<C>(phases: readonly Phase<C>[], ctx: C): Promise<RunPhasesResult> {
  const executed: Phase<C>[] = [];
  for (const phase of phases) {
    try {
      await phase.do(ctx);
      executed.push(phase);
    } catch (err) {
      const original = err instanceof Error ? err : new Error(String(err));
      // Reverse-order undo of every phase that DID succeed.
      const partials = await rollbackExecuted(executed, ctx);

      return {
        ok: false,
        error: original,
        rollbackPartials: partials,
        leaks: [],
      };
    }
  }

  return { ok: true, rollbackPartials: [], leaks: [] };
}

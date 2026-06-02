// transaction/phase-ledger.ts
//
// Pure async N-phase ledger with reverse-order undo on first throw.
//
// This is a FUNCTION, not a coordinator-class. Orchestrators build a literal
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
// Per AS-4 / CMC-17 / MSG-RP-1: this file ships RAW data
// (RollbackPartial[]); the user-visible body is assembled by the renderer
// in shared/notify.ts as a `(failed) {rollback partial}` parent line
// followed by 2-space-indented per-phase children of the form
// `[<phase>] (rollback failed)`, using the closed-set CMC-11 token
// vocabulary.

import { errorMessage } from "../shared/errors.ts";
import { PathContainmentError } from "../shared/path-safety.ts";

/**
 * A single ledger phase. `do` runs forward; `undo` (optional) is invoked
 * in reverse order over successfully-completed phases AND on the throwing
 * phase itself (failing-phase own-undo runs first from the catch block,
 * before the reverse walk -- TR-02). `undo` MUST tolerate being called
 * after a partial-do throw -- it cannot assume `do` ran to completion;
 * gate on context-set sentinels (cf. install.ts:481-492, :514-523,
 * :560-572, :590-600) and keep bridge cleanup helpers ENOENT-tolerant.
 */
export interface Phase<C> {
  readonly name: string;
  readonly do: (ctx: C) => Promise<void>;
  readonly undo?: (ctx: C) => Promise<void>;
}

/**
 * AS-4: aggregated undo failure (one row per failed `undo` call).
 *
 * `cause?: Error` preserves the original undo throw's `Error.cause` chain;
 * recording only `msg` (the top-level `errorMessage(undoErr)` text) would
 * drop any deeper cause attached via `new Error(msg, { cause })`. The
 * renderer surfaces it: `shared/notify.ts` maps each RollbackPartial onto a
 * `PluginFailedMessage.rollbackPartial[]` child and walks `cause` with the
 * depth-5 `causeChainTrailer`.
 *
 * `cause` is the ORIGINAL Error instance (not the message text) so the
 * walker can traverse its own `.cause` chain. Set to `undefined` when
 * the undo throw was not an Error subclass (defensive -- bridges
 * should always throw Errors but the ledger does not enforce).
 */
export interface RollbackPartial {
  readonly phase: string;
  readonly msg: string;
  readonly cause?: Error;
}

/**
 * Structured result. `ok: false` means a phase threw; the original error
 * is in `error`, and rollbackPartials lists every undo that ALSO failed.
 * `leaks` is reserved for future cleanup-leak descriptors (AS-5); the ledger
 * itself never populates it (orchestrators may).
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

      // Preserve the Error instance (not just its message text) so the
      // depth-5 `causeChainTrailer` walker in shared/notify.ts can surface
      // the originating cause to the user. Falls back to `undefined` when
      // the undo throw was not an Error subclass (defensive -- bridges
      // should always throw Errors).
      partials.push({
        phase: done.name,
        msg: errorMessage(undoErr),
        ...(undoErr instanceof Error && { cause: undoErr }),
      });
    }
  }

  return partials;
}

// Failing-phase own-undo invocation. Mirrors rollbackExecuted's inner
// try/catch (PI-14 PathContainmentError re-throw; non-Path errors captured
// as a RollbackPartial row). Extracted to keep runPhases under the
// project's cognitive-complexity bar.
async function invokeFailingPhaseUndo<C>(
  phase: Phase<C>,
  ctx: C,
): Promise<RollbackPartial | undefined> {
  if (phase.undo === undefined) {
    return undefined;
  }

  try {
    await phase.undo(ctx);
    return undefined;
  } catch (undoErr) {
    if (undoErr instanceof PathContainmentError) {
      throw undoErr;
    }

    return {
      phase: phase.name,
      msg: errorMessage(undoErr),
      ...(undoErr instanceof Error && { cause: undoErr }),
    };
  }
}

/**
 * Run an ordered ledger of phases. On the first throw, walk the executed
 * phases in REVERSE ORDER calling each phase's `undo` (if present),
 * aggregating undo-failures into the result.
 *
 * NEVER throws on its own; callers inspect `result.ok` and (when false)
 * call `formatRollbackError(result, result.error!)` from
 * `transaction/rollback.ts` to produce a structured `RollbackErrorResult`
 * (`{ error, rollbackPartials }`); the orchestrator then maps that onto a
 * `PluginFailedMessage` and the renderer in `shared/notify.ts` composes the
 * user-visible body.
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
      // Failing-phase own undo FIRST (TR-02 / saga "started -> eligible for
      // compensation"), then reverse-walk over executed[]. Newest-first per
      // AS-4 / MSG-RP-1: failing-phase partial prepends to index 0.
      const failingPartial = await invokeFailingPhaseUndo(phase, ctx);
      const reversePartials = await rollbackExecuted(executed, ctx);
      const rollbackPartials: RollbackPartial[] =
        failingPartial === undefined ? reversePartials : [failingPartial, ...reversePartials];
      return { ok: false, error: original, rollbackPartials, leaks: [] };
    }
  }

  return { ok: true, rollbackPartials: [], leaks: [] };
}

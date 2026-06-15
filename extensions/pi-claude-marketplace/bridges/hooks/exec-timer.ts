// bridges/hooks/exec-timer.ts
//
// EXEC-02 SIGTERM -> 5s grace -> SIGKILL escalation ladder for the hooks
// bridge. Two `setTimeout` handles, both `.unref()`'d so a leaked timer
// cannot keep the host Pi process alive past natural child exit.
//
// TOCTOU defense: both timer callbacks check `child.killed` before
// firing the next signal. A child that exits naturally microseconds
// before the timer fires would otherwise receive a phantom kill against
// a stale pid (potentially recycled by the OS to an unrelated process).
// The caller is REQUIRED to wire `child.once("exit", cancel)` AND
// `child.once("error", cancel)` so the ladder is torn down before the
// next event-loop tick after the child's natural exit -- the
// `child.killed` guard is the inner belt over that suspenders.
//
// The structural `ChildLike` interface lets this module stay outside
// the `node:child_process` import whitelist (the sole sanctioned import
// site for hook execution lives at `./dispatch-exec.ts`; the
// architecture-test whitelist gate enforces this).

const SIGKILL_GRACE_MS = 5_000;

/**
 * Structural subset of `ChildProcess` the ladder needs. Defined here so
 * the helper module does not need to import `node:child_process` (the
 * import whitelist scope is single-site: `./dispatch-exec.ts`). The
 * real `ChildProcess` instance the dispatcher constructs satisfies this
 * shape by structural subtyping.
 */
export interface ChildLike {
  killed: boolean;
  pid?: number | undefined;
  kill(signal?: NodeJS.Signals): boolean;
}

/**
 * Handle returned by `installTimerLadder`. `cancel()` is idempotent and
 * MUST be called on the child's natural `exit` AND `error` events to
 * close the TOCTOU window against the SIGTERM/SIGKILL timers firing
 * against a recycled pid.
 */
export interface TimerLadder {
  cancel(): void;
}

/**
 * EXEC-02: install the SIGTERM -> 5s -> SIGKILL escalation ladder
 * against `child`. The SIGTERM timer fires at `timeoutMs`; if the child
 * is still alive 5 seconds later, the SIGKILL timer fires. Both timers
 * `.unref()` so a leaked timer never holds the loop open. Both callbacks
 * guard on `!child.killed` so a natural-exit race does not produce a
 * phantom kill against a recycled pid (TOCTOU defense).
 */
export function installTimerLadder(child: ChildLike, timeoutMs: number): TimerLadder {
  let sigtermTimer: NodeJS.Timeout | null = setTimeout(() => {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }, timeoutMs);
  sigtermTimer.unref();

  let sigkillTimer: NodeJS.Timeout | null = setTimeout(() => {
    if (!child.killed) {
      child.kill("SIGKILL");
    }
  }, timeoutMs + SIGKILL_GRACE_MS);
  sigkillTimer.unref();

  return {
    cancel(): void {
      if (sigtermTimer !== null) {
        clearTimeout(sigtermTimer);
        sigtermTimer = null;
      }

      if (sigkillTimer !== null) {
        clearTimeout(sigkillTimer);
        sigkillTimer = null;
      }
    },
  };
}

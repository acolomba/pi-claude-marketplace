// bridges/hooks/exec-timer.ts
//
// EXEC-02 SIGTERM -> 5s grace -> SIGKILL escalation ladder for the hooks
// bridge. Two `setTimeout` handles, both `.unref()`'d so a leaked timer
// cannot keep the host Pi process alive past natural child exit.
//
// TOCTOU defense: both timer callbacks check whether the child has exited
// before firing the next signal. A child that exits naturally microseconds
// before the timer fires would otherwise receive a phantom kill against
// a stale pid (potentially recycled by the OS to an unrelated process).
// The caller is REQUIRED to `cancel()` on the child's natural termination
// AND on `error`, so the ladder is torn down before the next event-loop tick.
// Which event carries that differs by lane: `./dispatch-exec.ts` cancels from
// its `close` handler (it needs the streams drained before settling), and
// `./async-rewake/registry.ts` from `exit`. The exit-state guard below is the
// inner belt over those suspenders.
//
// One exception: a child that leads a process group of its own
// (`./process-group.ts`) can exit from the SIGTERM leg while a member of its
// group ignores SIGTERM and runs on. Once the SIGTERM leg has fired,
// `cancel()` keeps the SIGKILL leg for such a child, and that leg signals the
// group when the group still has a member (HKDR-01). The group id stays
// reserved while a member lives, so that signal cannot reach a recycled id.
//
// The structural `ChildLike` interface lets this module stay outside
// the `node:child_process` import whitelist, which
// `test/architecture/no-shell-out.test.ts` pins at exactly five sanctioned
// sites -- `./dispatch-exec.ts`, `./async-rewake/registry.ts`,
// `platform/git-credential.ts`, `platform/package-manager.ts`, and
// `platform/prompt-shell.ts`. Both
// hook-exec sites call into this module.

import { hookDebugLog } from "../../shared/debug-log.ts";

const MS_PER_SECOND = 1_000;
const SIGKILL_GRACE_SECONDS = 5;

/**
 * `setTimeout` cannot represent a delay above 2^31-1 ms: Node replaces a larger
 * one with 1 ms -- emitting a `TimeoutOverflowWarning` on stderr -- and that
 * 1 ms replacement would SIGTERM the child at spawn. Clamping the seconds both legs derive from keeps
 * the later `+ SIGKILL_GRACE_SECONDS` leg representable too, so neither timer
 * can overflow.
 *
 * Reachable from ordinary config: a handler that declares milliseconds
 * (`timeout: 3600000` for an hour) lands far above this once the value is read
 * as seconds.
 */
const MAX_TIMEOUT_SECONDS = Math.floor(2_147_483_647 / MS_PER_SECOND) - SIGKILL_GRACE_SECONDS;

/**
 * Structural subset of `ChildProcess` the ladder needs. Defined here so
 * the helper module does not need to import `node:child_process` (see the
 * whitelist note in this file's header). The
 * real `ChildProcess` instance the dispatcher constructs satisfies this
 * shape by structural subtyping.
 */
export interface ChildLike {
  /** `null` while the child is alive; a number once it exits on its own. */
  exitCode?: number | null | undefined;
  /** `null` while the child is alive; the signal that terminated it. */
  signalCode?: NodeJS.Signals | null | undefined;
  /**
   * Whether the process group the child leads still has a member. Only a
   * child that leads a group of its own has it (`./process-group.ts`).
   */
  groupAlive?: () => boolean;
  kill(signal?: NodeJS.Signals): boolean;
}

/**
 * Has the child actually exited?
 *
 * NOT `child.killed`, which Node sets when a signal is successfully SENT and
 * never clears -- a child that traps SIGTERM and keeps running still reports
 * `killed === true`. Guarding the escalation on it would make the SIGKILL leg
 * unreachable, because the SIGTERM leg sets it first.
 *
 * Absent fields read as "still alive" so a structural caller that supplies
 * neither still gets both legs.
 */
function hasExited(child: ChildLike): boolean {
  return (child.exitCode ?? null) !== null || (child.signalCode ?? null) !== null;
}

/**
 * Whether the SIGKILL leg has a process to signal: the child itself, or, once
 * the SIGTERM leg has signalled the child's process group, a member of that
 * group that ignored SIGTERM and outlived the child (HKDR-01).
 */
function needsSigkill(child: ChildLike, sigtermFired: boolean): boolean {
  return !hasExited(child) || (sigtermFired && child.groupAlive?.() === true);
}

/**
 * Handle returned by `installTimerLadder`. `cancel()` is idempotent and
 * MUST be called on the child's natural `exit` AND `error` events to
 * close the TOCTOU window against the SIGTERM/SIGKILL timers firing
 * against a recycled pid. Once the SIGTERM leg has fired, `cancel()` keeps the
 * SIGKILL leg of a child that leads a process group, so a member of the group
 * that ignored SIGTERM still gets it.
 *
 * `fired()` is `true` once the SIGTERM leg has signalled a child that was
 * still running at its deadline, and `false` before that, after a `cancel()`
 * that came first, and when the child had already exited. D-CF5-18 reads it to
 * tell a hook its timeout killed from one that some other signal ended.
 */
export interface TimerLadder {
  cancel(): void;
  fired(): boolean;
}

/**
 * Normalize a caller's seconds into a delay `setTimeout` can represent.
 *
 * Self-contained rather than trusting `resolveTimeoutSeconds` upstream: this
 * function is exported, and a future caller passing a non-finite or negative
 * value would otherwise reach `setTimeout`, which coerces both to 1 ms and
 * SIGTERMs the child at spawn. `0` must survive -- the overflow re-arm in
 * `./dispatch-exec.ts` passes it deliberately to schedule the SIGKILL leg alone.
 *
 * Degenerate input fails OPEN, to the ceiling rather than to something short:
 * a value we could not read is not evidence that the child should be killed
 * soon, and killing early destroys work.
 */
function normalizeSeconds(timeoutSeconds: number, label: string): number {
  if (!Number.isFinite(timeoutSeconds) || timeoutSeconds < 0) {
    hookDebugLog(
      `exec-timer: unusable ladder timeout ${String(timeoutSeconds)} (${label}); ` +
        `using the ${MAX_TIMEOUT_SECONDS}s ceiling`,
    );
    return MAX_TIMEOUT_SECONDS;
  }

  if (timeoutSeconds > MAX_TIMEOUT_SECONDS) {
    hookDebugLog(
      `exec-timer: timeout ${timeoutSeconds}s exceeds the ${MAX_TIMEOUT_SECONDS}s ` +
        `ceiling setTimeout can represent (${label}); clamping`,
    );
    return MAX_TIMEOUT_SECONDS;
  }

  return timeoutSeconds;
}

/**
 * EXEC-02: install the SIGTERM -> 5s -> SIGKILL escalation ladder against
 * `child`. The SIGTERM timer fires at `timeoutSeconds`; if the child, or a
 * member of the process group it leads, is still alive 5 seconds later, the
 * SIGKILL timer fires. Both timers `.unref()` so a
 * leaked timer never holds the loop open. Both callbacks guard on
 * `hasExited` -- exit state, NOT `child.killed`; see that function's
 * docstring for why the difference is load-bearing -- so a natural-exit
 * race does not produce a phantom kill against a recycled pid.
 *
 * This is the bridge's ONLY seconds-to-milliseconds conversion: callers speak
 * the seconds Claude Code's `timeout` field declares, and only `setTimeout`
 * sees milliseconds.
 *
 * Either leg firing emits a `hookDebugLog` line carrying `label` and the
 * elapsed budget. Without it a timed-out hook reaches the wire protocol as a
 * bare signal-kill, indistinguishable from an OOM kill or a Ctrl-C -- and the
 * per-event defaults mean the ladder fires on handlers that declared no
 * timeout at all.
 */
export function installTimerLadder(
  child: ChildLike,
  timeoutSeconds: number,
  label: string,
): TimerLadder {
  const seconds = normalizeSeconds(timeoutSeconds, label);
  let sigtermFired = false;

  let sigtermTimer: NodeJS.Timeout | null = setTimeout(() => {
    if (hasExited(child)) {
      // The budget elapsed but the child is already gone, so there is nothing
      // to signal and the caller is still blocked on something else -- in the
      // blocking lane, on `close`, which a grandchild holding the stdout pipe
      // can withhold indefinitely. That is HKDR-01, and this line is its
      // fingerprint.
      hookDebugLog(
        `exec-timer: budget of ${seconds}s elapsed after the child had exited (${label}); ` +
          `nothing to signal`,
      );
      return;
    }

    hookDebugLog(`exec-timer: SIGTERM after ${seconds}s (${label})`);
    sigtermFired = true;
    const sent = child.kill("SIGTERM");
    if (!sent) {
      hookDebugLog(`exec-timer: SIGTERM kill() returned false (${label})`);
    }
  }, seconds * MS_PER_SECOND);
  sigtermTimer.unref();

  let sigkillTimer: NodeJS.Timeout | null = setTimeout(
    () => {
      if (needsSigkill(child, sigtermFired)) {
        hookDebugLog(
          `exec-timer: SIGKILL after ${seconds + SIGKILL_GRACE_SECONDS}s (${label}); ` +
            `the child or a process of its group ignored SIGTERM`,
        );
        const sent = child.kill("SIGKILL");
        if (!sent) {
          hookDebugLog(`exec-timer: SIGKILL kill() returned false (${label})`);
        }
      }
    },
    (seconds + SIGKILL_GRACE_SECONDS) * MS_PER_SECOND,
  );
  sigkillTimer.unref();

  return {
    cancel(): void {
      if (sigtermTimer !== null) {
        clearTimeout(sigtermTimer);
        sigtermTimer = null;
      }

      // A member of the child's group may outlive the child that the SIGTERM
      // leg ended, so the SIGKILL leg stays for it (HKDR-01).
      const groupMayOutlive = sigtermFired && child.groupAlive !== undefined;
      if (sigkillTimer !== null && !groupMayOutlive) {
        clearTimeout(sigkillTimer);
        sigkillTimer = null;
      }
    },
    fired(): boolean {
      return sigtermFired;
    },
  };
}

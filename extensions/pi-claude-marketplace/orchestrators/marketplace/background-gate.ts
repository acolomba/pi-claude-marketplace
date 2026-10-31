// D-PL8-04: the in-process gate between `/claude:plugin` commands and the
// background autoupdate pass. A command waits for at most one background step:
// the one in flight when it starts. No background step begins while a command
// runs. The wait is silent, and commands still run together.
//
// D-PL8-23: a wait lasts at most the wait cap. At the cap the gate aborts the
// step's signal, which stops the step's network transfer (D-PL8-24), and then
// waits for the step to end.

import { hookDebugLog } from "../../shared/debug-log.ts";

/** The gate's foreground and background operations, declared as properties so callers can pass them by reference. */
export interface BackgroundGate {
  /** Runs one command after the background step in flight, if any, has ended. */
  readonly runForeground: (command: () => Promise<void>) => Promise<void>;
  /** Resolves when no command runs, marks a background step as in flight, and gives its abort signal. */
  readonly beginStep: () => Promise<AbortSignal>;
  /** Ends the background step in flight and wakes everything that waits for it. */
  readonly endStep: () => void;
  /** Resolves when no background step is in flight; at the wait cap it aborts the step first. */
  readonly waitForStep: () => Promise<void>;
}

/** D-PL8-23: the longest a command or a shutdown waits before it stops the step. */
const BACKGROUND_WAIT_CAP_MS = 30_000;

function wake(waiters: (() => void)[]): void {
  for (const resolve of waiters.splice(0)) {
    resolve();
  }
}

/** Creates one gate; constructing it starts nothing. */
export function createBackgroundGate(waitCapMs: number = BACKGROUND_WAIT_CAP_MS): BackgroundGate {
  let runningCommands = 0;
  let stepInFlight: AbortController | undefined;
  const idleWaiters: (() => void)[] = [];
  const stepWaiters: (() => void)[] = [];

  function waitForStep(): Promise<void> {
    const step = stepInFlight;
    if (step === undefined) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        if (!step.signal.aborted) {
          hookDebugLog(
            `a background step ran past the ${waitCapMs} ms wait cap and was stopped`,
            "autoupdate",
          );
          step.abort();
        }
      }, waitCapMs);
      timer.unref();
      stepWaiters.push(() => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  async function runForeground(command: () => Promise<void>): Promise<void> {
    runningCommands += 1;
    try {
      await waitForStep();
      await command();
    } finally {
      runningCommands -= 1;
      if (runningCommands === 0) {
        wake(idleWaiters);
      }
    }
  }

  async function beginStep(): Promise<AbortSignal> {
    while (runningCommands > 0) {
      // eslint-disable-next-line no-await-in-loop -- a command can start between the wake and the resume, so each wake re-checks the count.
      await new Promise<void>((resolve) => {
        idleWaiters.push(resolve);
      });
    }

    const step = new AbortController();
    stepInFlight = step;
    return step.signal;
  }

  function endStep(): void {
    stepInFlight = undefined;
    wake(stepWaiters);
  }

  return { runForeground, beginStep, endStep, waitForStep };
}

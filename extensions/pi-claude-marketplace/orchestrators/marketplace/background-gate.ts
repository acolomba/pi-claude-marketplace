// D-PL8-04: the in-process gate between `/claude:plugin` commands and the
// background autoupdate pass. A command waits for at most one background step:
// the one in flight when it starts. No background step begins while a command
// runs. The wait is silent, and commands still run together.

/** The two sides of the gate, declared as properties so callers can pass them by reference. */
export interface BackgroundGate {
  /** Runs one command after the background step in flight, if any, has ended. */
  readonly runForeground: (command: () => Promise<void>) => Promise<void>;
  /** Resolves when no command runs, and marks a background step as in flight. */
  readonly beginStep: () => Promise<void>;
  /** Ends the background step in flight and wakes everything that waits for it. */
  readonly endStep: () => void;
  /** Resolves when no background step is in flight. */
  readonly stepSettled: () => Promise<void>;
}

function wake(waiters: (() => void)[]): void {
  for (const resolve of waiters.splice(0)) {
    resolve();
  }
}

/** Creates one gate; constructing it starts nothing. */
export function createBackgroundGate(): BackgroundGate {
  let runningCommands = 0;
  let stepInFlight = false;
  const idleWaiters: (() => void)[] = [];
  const stepWaiters: (() => void)[] = [];

  function stepSettled(): Promise<void> {
    if (!stepInFlight) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      stepWaiters.push(resolve);
    });
  }

  async function runForeground(command: () => Promise<void>): Promise<void> {
    runningCommands += 1;
    try {
      await stepSettled();
      await command();
    } finally {
      runningCommands -= 1;
      if (runningCommands === 0) {
        wake(idleWaiters);
      }
    }
  }

  async function beginStep(): Promise<void> {
    while (runningCommands > 0) {
      // eslint-disable-next-line no-await-in-loop -- a command can start between the wake and the resume, so each wake re-checks the count.
      await new Promise<void>((resolve) => {
        idleWaiters.push(resolve);
      });
    }

    stepInFlight = true;
  }

  function endStep(): void {
    stepInFlight = false;
    wake(stepWaiters);
  }

  return { runForeground, beginStep, endStep, stepSettled };
}

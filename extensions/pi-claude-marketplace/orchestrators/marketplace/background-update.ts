// D-PL8-02: the first message of an extension runtime in `tui` mode arms one
// background autoupdate pass after a random delay of up to ten minutes, as
// Claude Code updates in its interactive mode only. A later message in the
// same runtime arms nothing, and `rpc`, `print`, and `json` never arm. Any
// input source arms in `tui` (D-PL8-13).
//
// D-PL8-08 / D-PL8-09 / D-PL8-14: Claude Code's opt-out variables, read when
// the pass arms, and the Pi-only delay knob.
//
// D-PL8-03 / D-PL8-15: `session_shutdown` stops the runtime and cancels a
// pending timer. Unless Pi quits, it also waits for the step in flight, so the
// next runtime's load never meets this runtime's state lock. D-PL8-23: it waits
// at most the gate's wait cap, which stops the step. No throw leaves
// the input handler, the shutdown handler, or the timer callback (NFR-2).
//
// The timer uses Node's global `setTimeout`. `random` and `env` are injected:
// production calls no `Math.random()`, and logic reads no `process.env`.

import { hookDebugLog } from "../../shared/debug-log.ts";
import { errorMessage } from "../../shared/errors.ts";

import type { BackgroundGate } from "./background-gate.ts";
import type { BackgroundContext, BackgroundPass } from "./background-pass.ts";
import type { InputEvent, SessionShutdownEvent } from "../../platform/pi-api.ts";

export interface BackgroundUpdateDeps {
  readonly gate: BackgroundGate;
  readonly pass: BackgroundPass;
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly random: () => number;
}

/** The two Pi listeners, declared as properties so `index.ts` passes them by reference. */
export interface BackgroundUpdate {
  readonly onInput: (event: InputEvent, ctx: BackgroundContext) => void;
  readonly onShutdown: (event: Pick<SessionShutdownEvent, "reason">) => Promise<void>;
}

/** Claude Code's ten-minute maximum delay. */
const AUTOUPDATE_MAX_DELAY_MS = 600_000;

/** Node runs a longer delay after 1 ms and prints a TimeoutOverflowWarning on stderr. */
const TIMER_MAX_DELAY_MS = 2_147_483_647;

const TRUTHY_VALUES: ReadonlySet<string> = new Set(["1", "true", "yes", "on"]);

const DEBUG_TAG = "autoupdate";

function isTruthy(value: string | undefined): boolean {
  return value !== undefined && TRUTHY_VALUES.has(value.trim().toLowerCase());
}

/** D-PL8-08: Claude Code's rule over its four variables. */
function passEnabled(env: BackgroundUpdateDeps["env"]): boolean {
  if (isTruthy(env.FORCE_AUTOUPDATE_PLUGINS)) {
    return true;
  }

  const nonessential = env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC;
  return (
    !isTruthy(env.DISABLE_UPDATES) &&
    !isTruthy(env.DISABLE_AUTOUPDATER) &&
    (nonessential === undefined || nonessential === "")
  );
}

/** D-PL8-09 / D-PL8-14: the knob counts only as whole milliseconds Node can schedule. */
function maxDelay(env: BackgroundUpdateDeps["env"]): number {
  const knob = env.PI_CLAUDE_MARKETPLACE_AUTOUPDATE_DELAY_MS;
  if (knob === undefined || !/^\d+$/.test(knob)) {
    return AUTOUPDATE_MAX_DELAY_MS;
  }

  const delay = Number(knob);
  return delay <= TIMER_MAX_DELAY_MS ? delay : AUTOUPDATE_MAX_DELAY_MS;
}

/** Creates the scheduler; constructing it starts no timer. */
export function createBackgroundUpdate(deps: BackgroundUpdateDeps): BackgroundUpdate {
  let armed = false;
  let stopped = false;
  let timer: NodeJS.Timeout | undefined;
  const isStopped = (): boolean => stopped;

  function runPass(ctx: BackgroundContext): void {
    timer = undefined;
    deps.pass({ ctx, isStopped }).catch((err: unknown) => {
      hookDebugLog(`background update stopped: ${errorMessage(err)}`, DEBUG_TAG);
    });
  }

  // Pi awaits input handlers before it handles the prompt, so this one
  // returns at once and never awaits the pass.
  function onInput(_event: InputEvent, ctx: BackgroundContext): void {
    try {
      if (armed || stopped || ctx.mode !== "tui") {
        return;
      }

      armed = true;
      if (!passEnabled(deps.env)) {
        return;
      }

      const delay = Math.floor(deps.random() * maxDelay(deps.env));
      timer = setTimeout(() => {
        runPass(ctx);
      }, delay);
      timer.unref();
    } catch (err: unknown) {
      hookDebugLog(`background update not armed: ${errorMessage(err)}`, DEBUG_TAG);
    }
  }

  async function onShutdown(event: Pick<SessionShutdownEvent, "reason">): Promise<void> {
    stopped = true;
    clearTimeout(timer);
    timer = undefined;
    try {
      // On quit the process ends, and proper-lockfile releases its locks.
      if (event.reason === "quit") {
        return;
      }

      await deps.gate.waitForStep();
    } catch (err: unknown) {
      hookDebugLog(`background update shutdown failed: ${errorMessage(err)}`, DEBUG_TAG);
    }
  }

  return { onInput, onShutdown };
}

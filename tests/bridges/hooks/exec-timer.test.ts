import assert from "node:assert/strict";
import test from "node:test";

import {
  installTimerLadder,
  type ChildLike,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/exec-timer.ts";

/**
 * EXEC-02: SIGTERM -> 5s grace -> SIGKILL ladder. Tests use
 * `t.mock.timers` to drive the two `setTimeout` callbacks without real
 * elapsed time, and a spy `kill` to record which signals fire under
 * each scenario. TOCTOU: the `child.killed` guard prevents a phantom
 * kill against a recycled pid when the natural-exit `cancel()` arrives
 * after the timer has been scheduled but before it fires.
 */

interface SpyChild extends ChildLike {
  readonly killCalls: NodeJS.Signals[];
}

function makeSpyChild(initiallyKilled = false): SpyChild {
  const killCalls: NodeJS.Signals[] = [];
  const spy: SpyChild = {
    killed: initiallyKilled,
    killCalls,
    kill(signal): boolean {
      killCalls.push(signal ?? "SIGTERM");
      return true;
    },
  };
  return spy;
}

test("installTimerLadder: SIGTERM fires at timeoutMs (no kill before then)", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const child = makeSpyChild();

  installTimerLadder(child, 1_000);

  // Just before SIGTERM -- no kill yet.
  t.mock.timers.tick(999);
  assert.deepEqual(child.killCalls, []);

  // Exactly at SIGTERM -- one SIGTERM kill.
  t.mock.timers.tick(1);
  assert.deepEqual(child.killCalls, ["SIGTERM"]);
});

test("installTimerLadder: SIGKILL fires 5s after SIGTERM", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const child = makeSpyChild();

  installTimerLadder(child, 1_000);

  // Advance past SIGTERM.
  t.mock.timers.tick(1_000);
  assert.deepEqual(child.killCalls, ["SIGTERM"]);

  // Advance the 5s grace. SIGKILL fires.
  t.mock.timers.tick(5_000);
  assert.deepEqual(child.killCalls, ["SIGTERM", "SIGKILL"]);
});

test("installTimerLadder: cancel() before any timer fires -> zero kill calls", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const child = makeSpyChild();

  const ladder = installTimerLadder(child, 1_000);
  ladder.cancel();

  // Advance well past both timers.
  t.mock.timers.tick(10_000);
  assert.deepEqual(child.killCalls, []);
});

test("installTimerLadder: TOCTOU defense -- child.killed=true at SIGTERM tick -> no kill", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const child = makeSpyChild();

  installTimerLadder(child, 1_000);

  // Simulate natural exit just before the timer fires: child.killed flips to true.
  child.killed = true;

  t.mock.timers.tick(1_000);
  assert.deepEqual(
    child.killCalls,
    [],
    "TOCTOU guard prevents phantom SIGTERM against a child that already exited",
  );

  t.mock.timers.tick(5_000);
  assert.deepEqual(
    child.killCalls,
    [],
    "TOCTOU guard also prevents phantom SIGKILL on the same already-exited child",
  );
});

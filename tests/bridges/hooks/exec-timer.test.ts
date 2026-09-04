import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";

import {
  installTimerLadder,
  type ChildLike,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/exec-timer.ts";

/**
 * EXEC-02: SIGTERM -> 5s grace -> SIGKILL ladder. Tests use
 * `t.mock.timers` to drive the two `setTimeout` callbacks without real
 * elapsed time, and a spy `kill` to record which signals fire under
 * each scenario. TOCTOU: the exit-state guard prevents a phantom
 * kill against a recycled pid when the natural-exit `cancel()` arrives
 * after the timer has been scheduled but before it fires. The guard reads
 * exit state, not `child.killed` -- `killed` means "we sent a signal", which
 * is true of a child that trapped SIGTERM and is still running.
 *
 * The ladder takes SECONDS and owns the bridge's only conversion to the
 * milliseconds `setTimeout` wants, so the ticks below are milliseconds
 * while the arguments are seconds.
 */

interface SpyChild extends ChildLike {
  /**
   * Not read by the ladder, which guards on exit state. Kept and maintained
   * because `ChildProcess` sets it on `kill()`, and a spy that silently
   * diverged from Node here is what let the dead SIGKILL escalation survive.
   */
  killed: boolean;
  readonly killCalls: NodeJS.Signals[];
}

interface TimerObservation {
  readonly callbacks: Array<() => void>;
  readonly clearHandles: Array<ReturnType<typeof setTimeout>>;
  readonly delays: number[];
  readonly handles: Array<ReturnType<typeof setTimeout>>;
  readonly pendingHandles: Set<ReturnType<typeof setTimeout>>;
  readonly unrefHandles: Array<ReturnType<typeof setTimeout>>;
}

function observeTimers(t: TestContext): TimerObservation {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const fakeSetTimeout = globalThis.setTimeout;
  const fakeClearTimeout = globalThis.clearTimeout;
  const callbacks: Array<() => void> = [];
  const clearHandles: Array<ReturnType<typeof setTimeout>> = [];
  const delays: number[] = [];
  const handles: Array<ReturnType<typeof setTimeout>> = [];
  const pendingHandles = new Set<ReturnType<typeof setTimeout>>();
  const unrefHandles: Array<ReturnType<typeof setTimeout>> = [];

  function observedSetTimeout<TArgs extends unknown[]>(
    callback: (...args: TArgs) => void,
    delay = 0,
    ...args: TArgs
  ): ReturnType<typeof setTimeout> {
    const observedCallback = (): void => {
      pendingHandles.delete(handle);
      callback(...args);
    };

    const handle = fakeSetTimeout(observedCallback, delay);
    callbacks.push(observedCallback);
    delays.push(delay);
    handles.push(handle);
    pendingHandles.add(handle);
    const originalUnref = handle.unref.bind(handle);
    t.mock.method(handle, "unref", () => {
      unrefHandles.push(handle);
      return originalUnref();
    });
    return handle;
  }

  function observedClearTimeout(handle: Parameters<typeof clearTimeout>[0]): void {
    if (typeof handle === "object" && handle !== null) {
      clearHandles.push(handle);
      pendingHandles.delete(handle);
    }

    fakeClearTimeout(handle);
  }

  t.mock.method(globalThis, "setTimeout", observedSetTimeout);
  t.mock.method(globalThis, "clearTimeout", observedClearTimeout);

  return { callbacks, clearHandles, delays, handles, pendingHandles, unrefHandles };
}

/**
 * Faithful to `ChildProcess` in the field the ladder branches on: `kill()`
 * sets `killed = true` because Node does, and it does NOT set `exitCode` --
 * sending a signal is not the child dying. A spy that left `killed` false let
 * the SIGKILL assertions below pass against a branch production could never
 * reach, which is how the dead escalation survived.
 */
function makeSpyChild(killReturn = true): SpyChild {
  const killCalls: NodeJS.Signals[] = [];
  const spy: SpyChild = {
    killed: false,
    exitCode: null,
    signalCode: null,
    killCalls,
    kill(signal): boolean {
      killCalls.push(signal ?? "SIGTERM");
      if (killReturn) {
        spy.killed = true;
      }

      return killReturn;
    },
  };
  return spy;
}

function installObservedLadder(
  t: TestContext,
  child: ChildLike,
  timeoutSeconds: number,
  label = "acme/PreToolUse",
) {
  const timers = observeTimers(t);
  const ladder = installTimerLadder(child, timeoutSeconds, label);
  t.after(() => {
    ladder.cancel();
  });
  return { ladder, timers };
}

function assertTimerLifecycle(timers: TimerObservation, expectedDelays: readonly number[]): void {
  assert.deepStrictEqual(timers.delays, expectedDelays);
  assert.equal(timers.callbacks.length, 2);
  assert.equal(timers.handles.length, 2);
  assert.deepStrictEqual(timers.unrefHandles, timers.handles);
  assert.deepStrictEqual(timers.clearHandles, timers.handles);
  assert.equal(timers.pendingHandles.size, 0);
}

function invokeTimerCallback(timers: TimerObservation, index: number): void {
  const callback = timers.callbacks[index];
  if (callback === undefined) {
    throw new Error(`Missing timer callback ${index}`);
  }

  callback();
}

test("sends each escalation signal exactly at its deadline", (t) => {
  // arrange
  const child = makeSpyChild();
  const { ladder, timers } = installObservedLadder(t, child, 1);

  // act
  t.mock.timers.tick(999);
  const callsBeforeSigterm = [...child.killCalls];
  t.mock.timers.tick(1);
  const callsAtSigterm = [...child.killCalls];
  t.mock.timers.tick(4_999);
  const callsBeforeSigkill = [...child.killCalls];
  t.mock.timers.tick(1);
  const callsAtSigkill = [...child.killCalls];
  ladder.cancel();

  // assert
  assert.deepStrictEqual(callsBeforeSigterm, []);
  assert.deepStrictEqual(callsAtSigterm, ["SIGTERM"]);
  assert.deepStrictEqual(callsBeforeSigkill, ["SIGTERM"]);
  assert.deepStrictEqual(callsAtSigkill, ["SIGTERM", "SIGKILL"]);
  assertTimerLifecycle(timers, [1_000, 6_000]);
});

test("keeps the five-second grace after a zero-second timeout", (t) => {
  // arrange
  const child = makeSpyChild();
  const { ladder, timers } = installObservedLadder(t, child, 0);

  // act
  t.mock.timers.tick(0);
  const callsAtSigterm = [...child.killCalls];
  t.mock.timers.tick(4_999);
  const callsBeforeSigkill = [...child.killCalls];
  t.mock.timers.tick(1);
  const callsAtSigkill = [...child.killCalls];
  ladder.cancel();

  // assert
  assert.deepStrictEqual(callsAtSigterm, ["SIGTERM"]);
  assert.deepStrictEqual(callsBeforeSigkill, ["SIGTERM"]);
  assert.deepStrictEqual(callsAtSigkill, ["SIGTERM", "SIGKILL"]);
  assertTimerLifecycle(timers, [0, 5_000]);
});

test("preserves a positive fractional timeout", (t) => {
  // arrange
  const child = makeSpyChild();
  const { ladder, timers } = installObservedLadder(t, child, 1.25);

  // act
  t.mock.timers.tick(1_249);
  const callsBeforeSigterm = [...child.killCalls];
  t.mock.timers.tick(1);
  const callsAtSigterm = [...child.killCalls];
  t.mock.timers.tick(4_999);
  const callsBeforeSigkill = [...child.killCalls];
  t.mock.timers.tick(1);
  const callsAtSigkill = [...child.killCalls];
  ladder.cancel();

  // assert
  assert.deepStrictEqual(callsBeforeSigterm, []);
  assert.deepStrictEqual(callsAtSigterm, ["SIGTERM"]);
  assert.deepStrictEqual(callsBeforeSigkill, ["SIGTERM"]);
  assert.deepStrictEqual(callsAtSigkill, ["SIGTERM", "SIGKILL"]);
  assertTimerLifecycle(timers, [1_250, 6_250]);
});

for (const { name, timeoutSeconds } of [
  { name: "maximum timeout", timeoutSeconds: 2_147_478 },
  { name: "above-maximum timeout", timeoutSeconds: 2_147_479 },
] as const) {
  test(`keeps both timer legs representable for the ${name}`, (t) => {
    // arrange
    const child = makeSpyChild();
    const { ladder, timers } = installObservedLadder(t, child, timeoutSeconds);

    // act
    t.mock.timers.tick(2_147_477_999);
    const callsBeforeSigterm = [...child.killCalls];
    t.mock.timers.tick(1);
    const callsAtSigterm = [...child.killCalls];
    t.mock.timers.tick(4_999);
    const callsBeforeSigkill = [...child.killCalls];
    t.mock.timers.tick(1);
    const callsAtSigkill = [...child.killCalls];
    ladder.cancel();

    // assert
    assert.deepStrictEqual(callsBeforeSigterm, []);
    assert.deepStrictEqual(callsAtSigterm, ["SIGTERM"]);
    assert.deepStrictEqual(callsBeforeSigkill, ["SIGTERM"]);
    assert.deepStrictEqual(callsAtSigkill, ["SIGTERM", "SIGKILL"]);
    assertTimerLifecycle(timers, [2_147_478_000, 2_147_483_000]);
  });
}

for (const { name, timeoutSeconds } of [
  { name: "negative", timeoutSeconds: -1 },
  { name: "NaN", timeoutSeconds: Number.NaN },
  { name: "positive infinity", timeoutSeconds: Number.POSITIVE_INFINITY },
  { name: "negative infinity", timeoutSeconds: Number.NEGATIVE_INFINITY },
] as const) {
  test(`fails open at the ceiling for a ${name} timeout`, (t) => {
    // arrange
    const child = makeSpyChild();
    const { ladder, timers } = installObservedLadder(t, child, timeoutSeconds);

    // act
    t.mock.timers.tick(1);
    const callsAfterOneMillisecond = [...child.killCalls];
    t.mock.timers.tick(2_147_477_998);
    const callsBeforeSigterm = [...child.killCalls];
    t.mock.timers.tick(1);
    const callsAtSigterm = [...child.killCalls];
    t.mock.timers.tick(4_999);
    const callsBeforeSigkill = [...child.killCalls];
    t.mock.timers.tick(1);
    const callsAtSigkill = [...child.killCalls];
    ladder.cancel();

    // assert
    assert.deepStrictEqual(callsAfterOneMillisecond, []);
    assert.deepStrictEqual(callsBeforeSigterm, []);
    assert.deepStrictEqual(callsAtSigterm, ["SIGTERM"]);
    assert.deepStrictEqual(callsBeforeSigkill, ["SIGTERM"]);
    assert.deepStrictEqual(callsAtSigkill, ["SIGTERM", "SIGKILL"]);
    assertTimerLifecycle(timers, [2_147_478_000, 2_147_483_000]);
  });
}

for (const { name, exit } of [
  {
    name: "exit code",
    exit: (child: SpyChild): void => {
      child.exitCode = 0;
    },
  },
  {
    name: "exit signal",
    exit: (child: SpyChild): void => {
      child.signalCode = "SIGTERM";
    },
  },
] as const) {
  test(`suppresses both signals when the child has an ${name}`, (t) => {
    // arrange
    const child = makeSpyChild();
    const { ladder, timers } = installObservedLadder(t, child, 1);

    // act
    exit(child);
    t.mock.timers.tick(1_000);
    const callsAtSigterm = [...child.killCalls];
    t.mock.timers.tick(5_000);
    const callsAtSigkill = [...child.killCalls];
    ladder.cancel();

    // assert
    assert.deepStrictEqual(callsAtSigterm, []);
    assert.deepStrictEqual(callsAtSigkill, []);
    assertTimerLifecycle(timers, [1_000, 6_000]);
  });
}

test("suppresses SIGKILL when the child exits after SIGTERM", (t) => {
  // arrange
  const child = makeSpyChild();
  const { ladder, timers } = installObservedLadder(t, child, 1);

  // act
  t.mock.timers.tick(1_000);
  const callsAtSigterm = [...child.killCalls];
  child.exitCode = 0;
  t.mock.timers.tick(5_000);
  const callsAtSigkill = [...child.killCalls];
  ladder.cancel();

  // assert
  assert.deepStrictEqual(callsAtSigterm, ["SIGTERM"]);
  assert.deepStrictEqual(callsAtSigkill, ["SIGTERM"]);
  assertTimerLifecycle(timers, [1_000, 6_000]);
});

test("cancels both signals before either deadline", (t) => {
  // arrange
  const child = makeSpyChild();
  const { ladder, timers } = installObservedLadder(t, child, 1);

  // act
  ladder.cancel();
  t.mock.timers.tick(6_000);

  // assert
  assert.deepStrictEqual(child.killCalls, []);
  assertTimerLifecycle(timers, [1_000, 6_000]);
});

test("cancels SIGKILL after SIGTERM fires", (t) => {
  // arrange
  const child = makeSpyChild();
  const { ladder, timers } = installObservedLadder(t, child, 1);

  // act
  t.mock.timers.tick(1_000);
  ladder.cancel();
  t.mock.timers.tick(5_000);

  // assert
  assert.deepStrictEqual(child.killCalls, ["SIGTERM"]);
  assertTimerLifecycle(timers, [1_000, 6_000]);
});

test("keeps repeated cancellation idempotent", (t) => {
  // arrange
  const child = makeSpyChild();
  const { ladder, timers } = installObservedLadder(t, child, 1);

  // act
  ladder.cancel();
  ladder.cancel();
  ladder.cancel();
  t.mock.timers.tick(6_000);

  // assert
  assert.deepStrictEqual(child.killCalls, []);
  assertTimerLifecycle(timers, [1_000, 6_000]);
});

test("ignores late timer callbacks for a finished child", (t) => {
  // arrange
  const child = makeSpyChild();
  const { ladder, timers } = installObservedLadder(t, child, 1);

  // act
  ladder.cancel();
  child.exitCode = 0;
  invokeTimerCallback(timers, 0);
  invokeTimerCallback(timers, 1);

  // assert
  assert.deepStrictEqual(child.killCalls, []);
  assertTimerLifecycle(timers, [1_000, 6_000]);
});

test("continues escalation when both kill calls report false", (t) => {
  // arrange
  const child = makeSpyChild(false);
  const { ladder, timers } = installObservedLadder(t, child, 1);

  // act
  t.mock.timers.tick(1_000);
  t.mock.timers.tick(5_000);
  ladder.cancel();

  // assert
  assert.deepStrictEqual(child.killCalls, ["SIGTERM", "SIGKILL"]);
  assert.equal(child.killed, false);
  assertTimerLifecycle(timers, [1_000, 6_000]);
});

test("reports the label and elapsed budget for each escalation", (t) => {
  // arrange
  const debugWasPresent = Object.hasOwn(process.env, "PI_CLAUDE_MARKETPLACE_DEBUG");
  const previousDebug = process.env.PI_CLAUDE_MARKETPLACE_DEBUG;
  const lines: string[] = [];
  t.after(() => {
    if (debugWasPresent) {
      process.env.PI_CLAUDE_MARKETPLACE_DEBUG = previousDebug;
    } else {
      delete process.env.PI_CLAUDE_MARKETPLACE_DEBUG;
    }
  });
  process.env.PI_CLAUDE_MARKETPLACE_DEBUG = "1";
  t.mock.method(console, "error", (...args: unknown[]): void => {
    lines.push(args.join(" "));
  });
  const child = makeSpyChild();
  const { ladder, timers } = installObservedLadder(t, child, 2, "acme/SessionEnd");

  // act
  t.mock.timers.tick(2_000);
  t.mock.timers.tick(5_000);
  ladder.cancel();

  // assert
  assert.equal(lines.length, 2);
  assert.match(lines[0] ?? "", /SIGTERM after 2s \(acme\/SessionEnd\)/);
  assert.match(lines[1] ?? "", /SIGKILL after 7s \(acme\/SessionEnd\)/);
  assertTimerLifecycle(timers, [2_000, 7_000]);
});

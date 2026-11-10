import assert from "node:assert/strict";
import test from "node:test";

import { asGroupLeader } from "../../../extensions/pi-claude-marketplace/bridges/hooks/process-group.ts";

interface HookChildHarness {
  readonly child: {
    readonly pid: number | undefined;
    exitCode: number | null;
    signalCode: NodeJS.Signals | null;
    kill(signal?: NodeJS.Signals): boolean;
  };
  readonly signals: Array<NodeJS.Signals | undefined>;
}

// A spawned hook that records each signal sent to it alone.
function hookChild(pid: number | undefined, killReturn = true): HookChildHarness {
  const signals: Array<NodeJS.Signals | undefined> = [];
  const child = {
    pid,
    exitCode: null,
    signalCode: null,
    kill(signal?: NodeJS.Signals): boolean {
      signals.push(signal);
      return killReturn;
    },
  };
  return { child, signals };
}

test("returns the child itself for a caller's own spawn that brings no group signal", () => {
  // arrange
  const { child } = hookChild(4242);

  // act
  const hookProcess = asGroupLeader(child, { spawnImpl: () => child });

  // assert
  assert.strictEqual(hookProcess, child);
});

test("signals the group that the child leads instead of the child", () => {
  // arrange
  const { child, signals } = hookChild(4242);
  const groupSignals: Array<readonly [number, NodeJS.Signals | 0 | undefined]> = [];
  const hookProcess = asGroupLeader(child, {
    spawnImpl: () => child,
    signalGroup: (pid, signal) => {
      groupSignals.push([pid, signal]);
    },
  });

  // act
  const sent = hookProcess.kill("SIGTERM");

  // assert
  assert.strictEqual(sent, true);
  assert.deepStrictEqual(groupSignals, [[4242, "SIGTERM"]]);
  assert.deepStrictEqual(signals, []);
});

test("signals the group through process.kill when the lane spawns with Node's spawn", (t) => {
  // arrange
  const { child, signals } = hookChild(4242);
  const killSpy = t.mock.method(process, "kill", () => true);
  const hookProcess = asGroupLeader(child, {});

  // act
  const sent = hookProcess.kill("SIGKILL");

  // assert
  assert.strictEqual(sent, true);
  assert.deepStrictEqual(
    killSpy.mock.calls.map((call) => call.arguments),
    [[-4242, "SIGKILL"]],
  );
  assert.deepStrictEqual(signals, []);
});

test("signals the child alone when its group cannot be signalled", () => {
  // arrange
  const { child, signals } = hookChild(4242, false);
  const hookProcess = asGroupLeader(child, {
    signalGroup: () => {
      const error = new Error("no such process group") as NodeJS.ErrnoException;
      error.code = "ESRCH";
      throw error;
    },
  });

  // act
  const sent = hookProcess.kill("SIGTERM");

  // assert
  assert.strictEqual(sent, false);
  assert.deepStrictEqual(signals, ["SIGTERM"]);
});

for (const { pid } of [{ pid: undefined }, { pid: 0 }, { pid: 1 }]) {
  test(`signals the child alone when its pid is ${String(pid)}`, () => {
    // arrange
    const { child, signals } = hookChild(pid);
    const groupSignals: Array<readonly [number, NodeJS.Signals | 0 | undefined]> = [];
    const hookProcess = asGroupLeader(child, {
      signalGroup: (groupPid, signal) => {
        groupSignals.push([groupPid, signal]);
      },
    });

    // act
    const sent = hookProcess.kill("SIGKILL");

    // assert
    assert.strictEqual(sent, true);
    assert.deepStrictEqual(groupSignals, []);
    assert.deepStrictEqual(signals, ["SIGKILL"]);
  });
}

test("reads the exit state of the child as it changes", () => {
  // arrange
  const { child } = hookChild(4242);
  const hookProcess = asGroupLeader(child, { signalGroup: () => undefined });
  const before = { exitCode: hookProcess.exitCode, signalCode: hookProcess.signalCode };

  // act
  child.exitCode = 0;
  child.signalCode = "SIGTERM";

  // assert
  assert.deepStrictEqual(before, { exitCode: null, signalCode: null });
  assert.deepStrictEqual(
    { exitCode: hookProcess.exitCode, signalCode: hookProcess.signalCode },
    { exitCode: 0, signalCode: "SIGTERM" },
  );
});

test("reports a live group after a signal 0 probe of the group", () => {
  // arrange
  const { child, signals } = hookChild(4242);
  const groupSignals: Array<readonly [number, NodeJS.Signals | 0 | undefined]> = [];
  const hookProcess = asGroupLeader(child, {
    signalGroup: (pid, signal) => {
      groupSignals.push([pid, signal]);
    },
  });

  // act
  const alive = hookProcess.groupAlive?.();

  // assert
  assert.strictEqual(alive, true);
  assert.deepStrictEqual(groupSignals, [[4242, 0]]);
  assert.deepStrictEqual(signals, []);
});

test("reports a group with no member left when the probe fails", () => {
  // arrange
  const { child } = hookChild(4242);
  const hookProcess = asGroupLeader(child, {
    signalGroup: () => {
      const error = new Error("no such process group") as NodeJS.ErrnoException;
      error.code = "ESRCH";
      throw error;
    },
  });

  // act
  const alive = hookProcess.groupAlive?.();

  // assert
  assert.strictEqual(alive, false);
});

for (const { pid } of [{ pid: undefined }, { pid: 0 }, { pid: 1 }]) {
  test(`reports no live group without probing when the pid is ${String(pid)}`, () => {
    // arrange
    const { child } = hookChild(pid);
    const groupSignals: Array<readonly [number, NodeJS.Signals | 0 | undefined]> = [];
    const hookProcess = asGroupLeader(child, {
      signalGroup: (groupPid, signal) => {
        groupSignals.push([groupPid, signal]);
      },
    });

    // act
    const alive = hookProcess.groupAlive?.();

    // assert
    assert.strictEqual(alive, false);
    assert.deepStrictEqual(groupSignals, []);
  });
}

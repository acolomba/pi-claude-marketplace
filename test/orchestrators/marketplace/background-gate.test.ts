// Owner suite for `orchestrators/marketplace/background-gate.ts`: the D-PL8-04
// ordering between `/claude:plugin` commands and background steps, and the
// D-PL8-23 wait cap. Each case holds its commands on deferred promises and
// drains pending callbacks with `setImmediate`, so the order in the shared log
// is the gate's order. Node's mock timers drive the cap.

import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";

import { createBackgroundGate } from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/background-gate.ts";

interface Deferred {
  readonly promise: Promise<void>;
  readonly resolve: () => void;
}

function deferred(): Deferred {
  let resolve: () => void = () => {
    throw new Error("the deferred promise was not created");
  };

  const promise = new Promise<void>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

async function drain(): Promise<void> {
  await new Promise((resolve) => {
    setImmediate(resolve);
  });
}

/** Turns on the debug log and collects its lines, restoring the flag after the case. */
function observeDebugLog(t: TestContext): string[] {
  const previous = process.env.PI_CLAUDE_MARKETPLACE_DEBUG;
  t.after(() => {
    if (previous === undefined) {
      Reflect.deleteProperty(process.env, "PI_CLAUDE_MARKETPLACE_DEBUG");
    } else {
      process.env.PI_CLAUDE_MARKETPLACE_DEBUG = previous;
    }
  });
  process.env.PI_CLAUDE_MARKETPLACE_DEBUG = "1";
  const lines: string[] = [];
  t.mock.method(console, "error", (line: unknown) => {
    lines.push(String(line));
  });
  return lines;
}

test("a command runs at once when no background step is in flight", async () => {
  // arrange
  const gate = createBackgroundGate();
  const log: string[] = [];

  // act
  const command = gate.runForeground(() => {
    log.push("command");
    return Promise.resolve();
  });
  await drain();
  log.push("drained");
  await command;

  // assert
  assert.deepStrictEqual(log, ["command", "drained"]);
});

test("a command waits for the background step in flight", async () => {
  // arrange
  const gate = createBackgroundGate();
  const log: string[] = [];
  await gate.beginStep();

  // act
  const command = gate.runForeground(() => {
    log.push("command");
    return Promise.resolve();
  });
  await drain();
  log.push("step end");
  gate.endStep();
  await command;

  // assert
  assert.deepStrictEqual(log, ["step end", "command"]);
});

test("a background step waits until every running command has returned", async () => {
  // arrange
  const gate = createBackgroundGate();
  const log: string[] = [];
  const first = deferred();
  const second = deferred();
  const firstCommand = gate.runForeground(async () => {
    await first.promise;
    log.push("first returned");
  });
  const secondCommand = gate.runForeground(async () => {
    await second.promise;
    log.push("second returned");
  });

  // act
  const step = gate.beginStep().then(() => {
    log.push("step began");
  });
  first.resolve();
  await firstCommand;
  await drain();
  log.push("between");
  second.resolve();
  await secondCommand;
  await step;

  // assert
  assert.deepStrictEqual(log, ["first returned", "between", "second returned", "step began"]);
});

test("two commands that start together run together", async () => {
  // arrange
  const gate = createBackgroundGate();
  const log: string[] = [];
  const release = deferred();

  // act
  const first = gate.runForeground(async () => {
    log.push("first started");
    await release.promise;
    log.push("first returned");
  });
  const second = gate.runForeground(async () => {
    log.push("second started");
    await release.promise;
    log.push("second returned");
  });
  await drain();
  release.resolve();
  await Promise.all([first, second]);

  // assert
  assert.deepStrictEqual(log, [
    "first started",
    "second started",
    "first returned",
    "second returned",
  ]);
});

test("a rejected command rejects its caller with the same error and frees the gate", async () => {
  // arrange
  const gate = createBackgroundGate();
  const failure = new Error("command failed");
  const log: string[] = [];

  // act
  const command = gate.runForeground(() => Promise.reject(failure));
  await assert.rejects(command, (error: unknown) => error === failure);
  await gate.beginStep();
  log.push("step began");

  // assert
  assert.deepStrictEqual(log, ["step began"]);
});

test("a command that throws before it returns a promise rejects its caller and frees the gate", async () => {
  // arrange
  const gate = createBackgroundGate();
  const failure = new Error("command threw");
  const log: string[] = [];

  // act
  const command = gate.runForeground(() => {
    throw failure;
  });
  await assert.rejects(command, (error: unknown) => error === failure);
  await gate.beginStep();
  log.push("step began");

  // assert
  assert.deepStrictEqual(log, ["step began"]);
});

test("a step waits through a command that starts between the wake and the resume", async () => {
  // arrange
  const gate = createBackgroundGate();
  const log: string[] = [];
  const second = deferred();
  let secondCommand: Promise<void> = Promise.resolve();
  const startSecond = (): void => {
    secondCommand = gate.runForeground(async () => {
      log.push("second started");
      await second.promise;
      log.push("second returned");
    });
  };

  // The first command's end wakes the step; this microtask runs after that wake
  // and before the step resumes.
  const first = gate.runForeground(async () => {
    await Promise.resolve();
    queueMicrotask(() => {
      queueMicrotask(startSecond);
    });
  });
  const step = gate.beginStep().then(() => {
    log.push("step began");
  });

  // act
  await first;
  await drain();
  second.resolve();
  await secondCommand;
  await step;

  // assert
  assert.deepStrictEqual(log, ["second started", "second returned", "step began"]);
});

test("waitForStep resolves at once with no step in flight, and only after endStep with one", async (t) => {
  // arrange
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const gate = createBackgroundGate();
  const log: string[] = [];
  await gate.waitForStep();
  log.push("idle settled");
  await gate.beginStep();

  // act
  const settled = gate.waitForStep().then(() => {
    log.push("step settled");
  });
  await drain();
  log.push("step end");
  gate.endStep();
  await settled;

  // assert
  assert.deepStrictEqual(log, ["idle settled", "step end", "step settled"]);
});

test("waitForStep with no step in flight starts no timer", async (t) => {
  // arrange
  const delays: number[] = [];
  t.mock.method(globalThis, "setTimeout", (_callback: () => void, delay: number) => {
    delays.push(delay);
    throw new Error("the gate must not start a timer with no step in flight");
  });
  const gate = createBackgroundGate();

  // act
  await gate.waitForStep();

  // assert
  assert.deepStrictEqual(delays, []);
});

test("D-PL8-23: beginStep gives each step a fresh signal that is not aborted", async () => {
  // arrange
  const gate = createBackgroundGate();
  const first = await gate.beginStep();
  gate.endStep();

  // act
  const second = await gate.beginStep();

  // assert
  assert.notStrictEqual(second, first);
  assert.deepStrictEqual([first.aborted, second.aborted], [false, false]);
});

test("D-PL8-23: a step that ends before the cap is not aborted, and its cap timer is cleared", async (t) => {
  // arrange
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const debugLines = observeDebugLog(t);
  const gate = createBackgroundGate(1_000);
  const signal = await gate.beginStep();
  const log: string[] = [];
  const command = gate.runForeground(() => {
    log.push("command");
    return Promise.resolve();
  });
  t.mock.timers.tick(999);
  await drain();
  log.push("step end");

  // act
  gate.endStep();
  await command;
  t.mock.timers.tick(1_000);

  // assert
  assert.deepStrictEqual(log, ["step end", "command"]);
  assert.strictEqual(signal.aborted, false);
  assert.deepStrictEqual(debugLines, []);
});

test("D-PL8-23: at the cap a waiting command aborts the step and runs once the step ends", async (t) => {
  // arrange
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const debugLines = observeDebugLog(t);
  const gate = createBackgroundGate(1_000);
  const signal = await gate.beginStep();
  const log: string[] = [];
  const command = gate.runForeground(() => {
    log.push("command");
    return Promise.resolve();
  });

  // act
  t.mock.timers.tick(1_000);
  await drain();
  log.push(`aborted: ${signal.aborted}`);
  gate.endStep();
  await command;

  // assert
  assert.deepStrictEqual(log, ["aborted: true", "command"]);
  assert.deepStrictEqual(debugLines, [
    "[autoupdate] a background step ran past the 1000 ms wait cap and was stopped",
  ]);
});

test("D-PL8-23: two waiters at the cap abort the step once and write one debug line", async (t) => {
  // arrange
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const debugLines = observeDebugLog(t);
  const gate = createBackgroundGate(1_000);
  const signal = await gate.beginStep();
  const command = gate.runForeground(() => Promise.resolve());
  const shutdown = gate.waitForStep();

  // act
  t.mock.timers.tick(1_000);
  gate.endStep();
  await Promise.all([command, shutdown]);

  // assert
  assert.strictEqual(signal.aborted, true);
  assert.deepStrictEqual(debugLines, [
    "[autoupdate] a background step ran past the 1000 ms wait cap and was stopped",
  ]);
});

for (const { elapsedMs, aborted } of [
  { elapsedMs: 29_999, aborted: false },
  { elapsedMs: 30_000, aborted: true },
]) {
  test(`D-PL8-23: the default cap leaves the step ${aborted ? "aborted" : "running"} after ${elapsedMs} ms`, async (t) => {
    // arrange
    t.mock.timers.enable({ apis: ["setTimeout"] });
    observeDebugLog(t);
    const gate = createBackgroundGate();
    const signal = await gate.beginStep();
    void gate.waitForStep();

    // act
    t.mock.timers.tick(elapsedMs);

    // assert
    assert.strictEqual(signal.aborted, aborted);
  });
}

test("endStep with no step in flight leaves a later command running at once", async () => {
  // arrange
  const gate = createBackgroundGate();
  const log: string[] = [];
  gate.endStep();

  // act
  const command = gate.runForeground(() => {
    log.push("command");
    return Promise.resolve();
  });
  await drain();
  log.push("drained");
  await command;

  // assert
  assert.deepStrictEqual(log, ["command", "drained"]);
});

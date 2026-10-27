// Owner suite for `orchestrators/marketplace/background-gate.ts`: the D-PL8-04
// ordering between `/claude:plugin` commands and background steps. Each case
// holds its commands on deferred promises and drains pending callbacks with
// `setImmediate`, so the order in the shared log is the gate's order.

import assert from "node:assert/strict";
import test from "node:test";

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

test("stepSettled resolves at once with no step in flight, and only after endStep with one", async () => {
  // arrange
  const gate = createBackgroundGate();
  const log: string[] = [];
  await gate.stepSettled();
  log.push("idle settled");
  await gate.beginStep();

  // act
  const settled = gate.stepSettled().then(() => {
    log.push("step settled");
  });
  await drain();
  log.push("step end");
  gate.endStep();
  await settled;

  // assert
  assert.deepStrictEqual(log, ["idle settled", "step end", "step settled"]);
});

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

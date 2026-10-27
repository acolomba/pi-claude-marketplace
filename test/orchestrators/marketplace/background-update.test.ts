// Owner suite for `orchestrators/marketplace/background-update.ts`: when the
// first message arms the background pass, how long it waits, which variables
// keep it from arming, and how a session shutdown stops it.
//
// The pass is a recording stand-in, and the gate is real. Node's mock timers
// drive the delay, so every wait in this suite is a `tick`, never real time.

import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";

import { createBackgroundGate } from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/background-gate.ts";
import { createBackgroundUpdate } from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/background-update.ts";

import type { BackgroundGate } from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/background-gate.ts";
import type {
  BackgroundContext,
  BackgroundPassRun,
} from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/background-pass.ts";
import type {
  BackgroundUpdate,
  BackgroundUpdateDeps,
} from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/background-update.ts";
import type {
  InputEvent,
  NotificationUi,
  SessionShutdownEvent,
} from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

type Environment = BackgroundUpdateDeps["env"];
type InputSource = InputEvent["source"];
type ShutdownReason = SessionShutdownEvent["reason"];

interface SchedulerUnderTest {
  readonly backgroundUpdate: BackgroundUpdate;
  readonly gate: BackgroundGate;
  readonly runs: BackgroundPassRun[];
}

interface TimerObservation {
  readonly delays: number[];
  readonly unrefs: number[];
}

const TEN_MINUTES_MS = 600_000;

const RECORDED_CTX_CWD = "/workspace/background-update";

function inputEvent(source: InputSource = "interactive"): InputEvent {
  return { type: "input", text: "hello", source };
}

function sessionContext(mode: string): BackgroundContext {
  return {
    mode,
    cwd: RECORDED_CTX_CWD,
    get ui(): NotificationUi {
      throw new Error("the scheduler must not touch the session UI");
    },
  };
}

function createSchedulerUnderTest(
  options: {
    readonly env?: Environment;
    readonly random?: () => number;
    readonly pass?: (run: BackgroundPassRun) => Promise<void>;
  } = {},
): SchedulerUnderTest {
  const gate = createBackgroundGate();
  const runs: BackgroundPassRun[] = [];
  const backgroundUpdate = createBackgroundUpdate({
    gate,
    pass: (run) => {
      runs.push(run);
      return options.pass?.(run) ?? Promise.resolve();
    },
    env: options.env ?? {},
    random: options.random ?? ((): number => 0.5),
  });
  return { backgroundUpdate, gate, runs };
}

/** Enables mock `setTimeout` and records each scheduled delay and each `unref` call. */
function observeTimers(t: TestContext): TimerObservation {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const mockSetTimeout = globalThis.setTimeout;
  const delays: number[] = [];
  const unrefs: number[] = [];

  function observedSetTimeout(callback: () => void, delay: number): ReturnType<typeof setTimeout> {
    const handle = mockSetTimeout(callback, delay);
    delays.push(delay);
    const originalUnref = handle.unref.bind(handle);
    t.mock.method(handle, "unref", () => {
      unrefs.push(delay);
      return originalUnref();
    });
    return handle;
  }

  t.mock.method(globalThis, "setTimeout", observedSetTimeout);
  return { delays, unrefs };
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

test("the first message in tui arms one pass after the delay", (t) => {
  // arrange
  observeTimers(t);
  const { backgroundUpdate, runs } = createSchedulerUnderTest();
  const ctx = sessionContext("tui");

  // act
  backgroundUpdate.onInput(inputEvent(), ctx);
  t.mock.timers.tick(TEN_MINUTES_MS / 2);

  // assert
  assert.strictEqual(runs.length, 1);
  assert.strictEqual(runs[0]?.ctx, ctx);
  assert.strictEqual(runs[0].isStopped(), false);
});

for (const mode of ["rpc", "print", "json"]) {
  test(`a message in ${mode} never arms a pass`, (t) => {
    // arrange
    const timers = observeTimers(t);
    const { backgroundUpdate, runs } = createSchedulerUnderTest();

    // act
    backgroundUpdate.onInput(inputEvent(), sessionContext(mode));
    t.mock.timers.tick(TEN_MINUTES_MS);

    // assert
    assert.deepStrictEqual(runs, []);
    assert.deepStrictEqual(timers.delays, []);
  });
}

for (const source of ["interactive", "rpc", "extension"] satisfies InputSource[]) {
  test(`a message from the ${source} input source arms the pass`, (t) => {
    // arrange
    observeTimers(t);
    const { backgroundUpdate, runs } = createSchedulerUnderTest();

    // act
    backgroundUpdate.onInput(inputEvent(source), sessionContext("tui"));
    t.mock.timers.tick(TEN_MINUTES_MS);

    // assert
    assert.strictEqual(runs.length, 1);
  });
}

test("a later message in the same runtime arms nothing", (t) => {
  // arrange
  const timers = observeTimers(t);
  const { backgroundUpdate, runs } = createSchedulerUnderTest();

  // act
  backgroundUpdate.onInput(inputEvent(), sessionContext("tui"));
  backgroundUpdate.onInput(inputEvent(), sessionContext("tui"));
  t.mock.timers.tick(TEN_MINUTES_MS);

  // assert
  assert.strictEqual(runs.length, 1);
  assert.deepStrictEqual(timers.delays, [TEN_MINUTES_MS / 2]);
});

test("waits a random share of the ten-minute maximum", (t) => {
  // arrange
  observeTimers(t);
  const { backgroundUpdate, runs } = createSchedulerUnderTest();
  backgroundUpdate.onInput(inputEvent(), sessionContext("tui"));

  // act
  t.mock.timers.tick(299_999);
  const runsBeforeDelay = runs.length;
  t.mock.timers.tick(1);

  // assert
  assert.strictEqual(runsBeforeDelay, 0);
  assert.strictEqual(runs.length, 1);
});

for (const { knob, delay } of [
  { knob: "1000", delay: 500 },
  { knob: "2147483647", delay: 1_073_741_823 },
  { knob: "-5", delay: 300_000 },
  { knob: "1.5", delay: 300_000 },
  { knob: "1e3", delay: 300_000 },
  { knob: " 7", delay: 300_000 },
  { knob: "abc", delay: 300_000 },
  { knob: "", delay: 300_000 },
  { knob: "2147483648", delay: 300_000 },
]) {
  test(`the delay knob ${JSON.stringify(knob)} gives a ${delay} ms wait at random 0.5`, (t) => {
    // arrange
    observeTimers(t);
    const { backgroundUpdate, runs } = createSchedulerUnderTest({
      env: { PI_CLAUDE_MARKETPLACE_AUTOUPDATE_DELAY_MS: knob },
    });
    backgroundUpdate.onInput(inputEvent(), sessionContext("tui"));

    // act
    t.mock.timers.tick(delay - 1);
    const runsBeforeDelay = runs.length;
    t.mock.timers.tick(1);

    // assert
    assert.strictEqual(runsBeforeDelay, 0);
    assert.strictEqual(runs.length, 1);
  });
}

test("a delay knob of 0 runs the pass right after the first message", (t) => {
  // arrange
  const timers = observeTimers(t);
  const { backgroundUpdate, runs } = createSchedulerUnderTest({
    env: { PI_CLAUDE_MARKETPLACE_AUTOUPDATE_DELAY_MS: "0" },
  });

  // act
  backgroundUpdate.onInput(inputEvent(), sessionContext("tui"));
  t.mock.timers.tick(0);

  // assert
  assert.strictEqual(runs.length, 1);
  assert.deepStrictEqual(timers.delays, [0]);
});

const OPT_OUTS: readonly Environment[] = [
  { DISABLE_UPDATES: "1" },
  { DISABLE_UPDATES: "TRUE" },
  { DISABLE_AUTOUPDATER: " yes " },
  { DISABLE_AUTOUPDATER: "On" },
  { CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "0" },
  { CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: " " },
];

for (const env of [...OPT_OUTS, { DISABLE_AUTOUPDATER: "1", FORCE_AUTOUPDATE_PLUGINS: "0" }]) {
  test(`${JSON.stringify(env)} keeps the pass from arming`, (t) => {
    // arrange
    const timers = observeTimers(t);
    const { backgroundUpdate, runs } = createSchedulerUnderTest({ env });

    // act
    backgroundUpdate.onInput(inputEvent(), sessionContext("tui"));
    t.mock.timers.tick(TEN_MINUTES_MS);

    // assert
    assert.deepStrictEqual(runs, []);
    assert.deepStrictEqual(timers.delays, []);
  });
}

const ARMING_ENVIRONMENTS: readonly Environment[] = [
  {},
  { DISABLE_UPDATES: "0" },
  { DISABLE_AUTOUPDATER: "false" },
  { DISABLE_UPDATES: "y" },
  { CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "" },
  ...OPT_OUTS.flatMap((optOut) =>
    ["1", " TRUE ", "yes"].map((force) => ({ ...optOut, FORCE_AUTOUPDATE_PLUGINS: force })),
  ),
];

for (const env of ARMING_ENVIRONMENTS) {
  test(`${JSON.stringify(env)} lets the pass arm`, (t) => {
    // arrange
    observeTimers(t);
    const { backgroundUpdate, runs } = createSchedulerUnderTest({ env });

    // act
    backgroundUpdate.onInput(inputEvent(), sessionContext("tui"));
    t.mock.timers.tick(TEN_MINUTES_MS);

    // assert
    assert.strictEqual(runs.length, 1);
  });
}

test("reads the opt-outs when it arms", (t) => {
  // arrange
  observeTimers(t);
  const env: Record<string, string | undefined> = {};
  const { backgroundUpdate, runs } = createSchedulerUnderTest({ env });
  backgroundUpdate.onInput(inputEvent(), sessionContext("tui"));

  // act
  env.DISABLE_UPDATES = "1";
  t.mock.timers.tick(TEN_MINUTES_MS);

  // assert
  assert.strictEqual(runs.length, 1);
});

test("unrefs its timer", (t) => {
  // arrange
  const timers = observeTimers(t);
  const { backgroundUpdate } = createSchedulerUnderTest();

  // act
  backgroundUpdate.onInput(inputEvent(), sessionContext("tui"));

  // assert
  assert.deepStrictEqual(timers.unrefs, [TEN_MINUTES_MS / 2]);
});

for (const reason of ["quit", "reload", "new", "resume", "fork"] satisfies ShutdownReason[]) {
  test(`a ${reason} shutdown before the delay ends cancels the pass`, async (t) => {
    // arrange
    observeTimers(t);
    const { backgroundUpdate, runs } = createSchedulerUnderTest();
    backgroundUpdate.onInput(inputEvent(), sessionContext("tui"));

    // act
    await backgroundUpdate.onShutdown({ reason });
    t.mock.timers.tick(TEN_MINUTES_MS);

    // assert
    assert.deepStrictEqual(runs, []);
  });
}

for (const reason of ["reload", "new", "resume", "fork"] satisfies ShutdownReason[]) {
  test(`a ${reason} shutdown waits for the background step in flight`, async () => {
    // arrange
    const { backgroundUpdate, gate } = createSchedulerUnderTest();
    const log: string[] = [];
    await gate.beginStep();

    // act
    const shutdown = backgroundUpdate.onShutdown({ reason }).then(() => {
      log.push("shutdown");
    });
    await drain();
    log.push("step end");
    gate.endStep();
    await shutdown;

    // assert
    assert.deepStrictEqual(log, ["step end", "shutdown"]);
  });
}

test("a quit shutdown returns without waiting for the step in flight", async () => {
  // arrange
  const { backgroundUpdate, gate } = createSchedulerUnderTest();
  const log: string[] = [];
  await gate.beginStep();

  // act
  const shutdown = backgroundUpdate.onShutdown({ reason: "quit" }).then(() => {
    log.push("shutdown");
  });
  await drain();
  log.push("step end");
  gate.endStep();
  await shutdown;

  // assert
  assert.deepStrictEqual(log, ["shutdown", "step end"]);
});

test("a shutdown stops the pass it started", async (t) => {
  // arrange
  observeTimers(t);
  const { backgroundUpdate, runs } = createSchedulerUnderTest();
  backgroundUpdate.onInput(inputEvent(), sessionContext("tui"));
  t.mock.timers.tick(TEN_MINUTES_MS);
  const stoppedBeforeShutdown = runs[0]?.isStopped();

  // act
  await backgroundUpdate.onShutdown({ reason: "reload" });

  // assert
  assert.strictEqual(stoppedBeforeShutdown, false);
  assert.strictEqual(runs[0]?.isStopped(), true);
});

test("a message after a shutdown arms nothing", async (t) => {
  // arrange
  const timers = observeTimers(t);
  const { backgroundUpdate, runs } = createSchedulerUnderTest();
  await backgroundUpdate.onShutdown({ reason: "reload" });

  // act
  backgroundUpdate.onInput(inputEvent(), sessionContext("tui"));
  t.mock.timers.tick(TEN_MINUTES_MS);

  // assert
  assert.deepStrictEqual(runs, []);
  assert.deepStrictEqual(timers.delays, []);
});

test("NFR-2: a stale context leaves the input handler quietly, with no timer", (t) => {
  // arrange
  const timers = observeTimers(t);
  const lines = observeDebugLog(t);
  const { backgroundUpdate, runs } = createSchedulerUnderTest();
  const ctx: BackgroundContext = {
    get mode(): string {
      throw new Error("stale context");
    },
    cwd: RECORDED_CTX_CWD,
    get ui(): NotificationUi {
      throw new Error("the scheduler must not touch the session UI");
    },
  };

  // act
  backgroundUpdate.onInput(inputEvent(), ctx);
  t.mock.timers.tick(TEN_MINUTES_MS);

  // assert
  assert.deepStrictEqual(lines, ["[autoupdate] background update not armed: stale context"]);
  assert.deepStrictEqual(timers.delays, []);
  assert.deepStrictEqual(runs, []);
});

test("NFR-2: a stale shutdown event leaves the handler resolved and the runtime stopped", async (t) => {
  // arrange
  const timers = observeTimers(t);
  const lines = observeDebugLog(t);
  const { backgroundUpdate, runs } = createSchedulerUnderTest();
  const event: Pick<SessionShutdownEvent, "reason"> = {
    get reason(): ShutdownReason {
      throw new Error("stale event");
    },
  };

  // act
  await backgroundUpdate.onShutdown(event);
  backgroundUpdate.onInput(inputEvent(), sessionContext("tui"));
  t.mock.timers.tick(TEN_MINUTES_MS);

  // assert
  assert.deepStrictEqual(lines, ["[autoupdate] background update shutdown failed: stale event"]);
  assert.deepStrictEqual(timers.delays, []);
  assert.deepStrictEqual(runs, []);
});

test("NFR-2: a pass that rejects ends in the debug log", async (t) => {
  // arrange
  observeTimers(t);
  const lines = observeDebugLog(t);
  const { backgroundUpdate, runs } = createSchedulerUnderTest({
    pass: () => Promise.reject(new Error("boom")),
  });
  backgroundUpdate.onInput(inputEvent(), sessionContext("tui"));

  // act
  t.mock.timers.tick(TEN_MINUTES_MS);
  await drain();

  // assert
  assert.strictEqual(runs.length, 1);
  assert.deepStrictEqual(lines, ["[autoupdate] background update stopped: boom"]);
});

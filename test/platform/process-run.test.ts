import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, test } from "node:test";

import {
  findOnWindowsPath,
  NODE_PROCESS_HOST,
  runProcess,
} from "../../extensions/pi-claude-marketplace/platform/process-run.ts";

import { createHermeticEnvironment } from "./hermetic-environment.ts";
import { createProcessFake } from "./process-fake.ts";

import type {
  OutputCapture,
  ProcessHost,
  ProcessLauncher,
  ProcessRequest,
  ProcessRun,
  ProcessSpawn,
  ProcessSpawnOptions,
  RunningProcess,
} from "../../extensions/pi-claude-marketplace/platform/process-run.ts";
import type { ProcessControl } from "./process-fake.ts";

const TIMEOUT_MS = 1_000;
const KILL_GRACE_MS = 200;
const NODE_SPAWN = spawn as ProcessSpawn;

type GroupSignal = readonly [number, string];

// A Linux host that records each group signal. A run never looks a command
// up, so its file probe fails a case that reaches it.
function linuxHost(groupSignals: GroupSignal[] = []): ProcessHost {
  return {
    platform: "linux",
    isFile: () => assert.fail("a run probes no file"),
    signalGroup: (pid, signal) => {
      groupSignals.push([pid, signal]);
    },
  };
}

function launcherFor(control: ProcessControl, host: ProcessHost = linuxHost()): ProcessLauncher {
  return { spawn: control.spawn, host };
}

const HEAD: OutputCapture = { limit: 65_536, keep: "head" };

const request: ProcessRequest = {
  command: "npm",
  args: ["ci"],
  cwd: "/work",
  env: {},
  timeoutMs: TIMEOUT_MS,
  killGraceMs: KILL_GRACE_MS,
  stdout: HEAD,
  stderr: HEAD,
  windowsHide: false,
};

// A grandchild that ignores SIGTERM, prints "started" at once, and prints
// "late" at the epoch its argument names, then exits.
const LATE_GRANDCHILD = [
  'process.on("SIGTERM", () => {});',
  'process.stdout.write("started\\n");',
  'setTimeout(() => process.stdout.write("late\\n"), Number(process.argv[1]) - Date.now());',
].join("\n");

// A child that starts the grandchild on its own output streams and idles.
const IDLE_PARENT = [
  'const { spawn } = require("node:child_process");',
  `spawn(process.execPath, ["-e", ${JSON.stringify(LATE_GRANDCHILD)}, process.argv[1]], { stdio: "inherit" });`,
  "setInterval(() => {}, 1_000);",
].join("\n");

const SILENT_GRANDCHILD = [
  'process.on("SIGTERM", () => {});',
  "setInterval(() => {}, 1_000);",
].join("\n");

const EXITING_PARENT = [
  'const { spawn } = require("node:child_process");',
  `spawn(process.execPath, ["-e", ${JSON.stringify(SILENT_GRANDCHILD)}], { stdio: "ignore" });`,
  "setInterval(() => {}, 1_000);",
].join("\n");

function runIsolatedTimeoutProbe(): Promise<{
  readonly code: number | null;
  readonly stderr: string;
  readonly stdout: string;
}> {
  const moduleUrl = new URL(
    "../../extensions/pi-claude-marketplace/platform/process-run.ts",
    import.meta.url,
  ).href;
  const script = `
    const { runProcess } = await import(${JSON.stringify(moduleUrl)});
    const listeners = { close: [], error: [] };
    const child = {
      pid: 42,
      stdout: { on() {} },
      stderr: { on() {} },
      kill() { return true; },
      on(event, listener) { listeners[event].push(listener); },
    };
    const host = {
      platform: "linux",
      isFile: () => Promise.resolve(false),
      signalGroup: (_pid, signal) => {
        if (signal === "SIGTERM") {
          for (const listener of listeners.close) listener(null);
        }
      },
    };
    setTimeout(() => {}, 80);
    const run = await runProcess(
      { spawn: () => child, host },
      {
        command: "npm",
        args: ["ci"],
        cwd: "/work",
        env: {},
        timeoutMs: 20,
        killGraceMs: 50,
        stdout: { limit: 100, keep: "head" },
        stderr: { limit: 100, keep: "tail" },
        windowsHide: false,
      },
    );
    process.stdout.write(JSON.stringify(run));
  `;

  return new Promise((resolve, reject) => {
    const probe = spawn(process.execPath, ["--input-type=module", "--eval", script], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    probe.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    probe.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    probe.on("error", reject);
    probe.on("close", (code) => {
      resolve({ code, stderr, stdout });
    });
  });
}

type Launched = readonly [string, readonly string[], ProcessSpawnOptions];

interface WindowsTimeout {
  readonly control: ProcessControl;
  readonly launches: Launched[];
  readonly pending: Promise<ProcessRun>;
}

// Runs C:\\tools\\npm.exe on a win32 host with its console hidden. Every later
// launch is a taskkill, which `startKiller` stands in for.
function startOnWindows(env: NodeJS.ProcessEnv, startKiller: () => RunningProcess): WindowsTimeout {
  const control = createProcessFake(42);
  const launches: Launched[] = [];
  const launcher: ProcessLauncher = {
    spawn: (command, args, options) => {
      launches.push([command, args, options]);
      return launches.length > 1 ? startKiller() : control.process;
    },
    host: {
      platform: "win32",
      isFile: () => assert.fail("a run probes no file"),
      signalGroup: () => assert.fail("Windows signals no process group"),
    },
  };
  const pending = runProcess(launcher, {
    ...request,
    command: "C:\\tools\\npm.exe",
    cwd: "C:\\work",
    env,
    windowsHide: true,
  });
  return { control, launches, pending };
}

function windowsSpawnOptions(env: NodeJS.ProcessEnv): ProcessSpawnOptions {
  return {
    cwd: "C:\\work",
    env,
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
    detached: false,
    windowsHide: true,
  };
}

const TASKKILL_ARGS = ["/PID", "42", "/T", "/F"];

describe("runProcess", () => {
  test("SG-PRC-01: spawns the command with its arguments verbatim, no shell, no stdin, the request directory, and the request environment", async () => {
    // arrange
    const control = createProcessFake();
    const launcher = launcherFor(control);

    // act
    const pending = runProcess(launcher, {
      ...request,
      command: "bun",
      args: ["install", "--frozen-lockfile"],
      env: { HOME: "/home/user" },
    });
    control.close(0);
    await pending;

    // assert
    assert.deepStrictEqual(control.launches(), [
      [
        "bun",
        ["install", "--frozen-lockfile"],
        {
          cwd: "/work",
          env: { HOME: "/home/user" },
          shell: false,
          stdio: ["ignore", "pipe", "pipe"],
          detached: true,
          windowsHide: false,
        },
      ],
    ]);
    assert.deepStrictEqual(
      { input: control.input(), ended: control.inputEnded() },
      {
        input: "",
        ended: false,
      },
    );
  });

  test("starts no process for a request whose operation was already cancelled", async () => {
    // arrange
    const controller = new AbortController();
    const reason = new Error("foreground command arrived");
    controller.abort(reason);
    const launcher: ProcessLauncher = {
      spawn: () => assert.fail("a cancelled request started a process"),
      host: linuxHost(),
    };

    // act
    const run = await runProcess(launcher, { ...request, signal: controller.signal });

    // assert
    assert.deepStrictEqual(run, {
      code: null,
      stdout: "",
      stderr: "",
      timedOut: false,
      error: new Error("Process run aborted", { cause: reason }),
    });
  });

  test("resolves with the exit code and both streams when the process closes", async () => {
    // arrange
    const control = createProcessFake();
    const launcher = launcherFor(control);

    // act
    const pending = runProcess(launcher, request);
    control.writeStdout("a");
    control.writeStdout("b");
    control.writeStderr("c");
    control.close(1);
    const run = await pending;

    // assert
    assert.deepStrictEqual(run, { code: 1, stdout: "ab", stderr: "c", timedOut: false });
  });

  for (const input of ["protocol=https\nhost=example.com\n\n", ""]) {
    test(`SG-PRC-01: writes the input ${JSON.stringify(input)} to a stdin pipe and then ends it`, async () => {
      // arrange
      const control = createProcessFake();
      const launcher = launcherFor(control);

      // act
      const pending = runProcess(launcher, { ...request, input });
      control.close(0);
      const run = await pending;

      // assert
      assert.deepStrictEqual(
        control.launches().map(([, , options]) => options.stdio),
        [["pipe", "pipe", "pipe"]],
      );
      assert.deepStrictEqual(
        { input: control.input(), ended: control.inputEnded() },
        {
          input,
          ended: true,
        },
      );
      assert.deepStrictEqual(run, { code: 0, stdout: "", stderr: "", timedOut: false });
    });
  }

  test("SG-PRC-01: settles on close with its exit code when stdin fails because the process exited first", async () => {
    // arrange
    const control = createProcessFake();
    const launcher = launcherFor(control);
    const epipe = Object.assign(new Error("write EPIPE"), { code: "EPIPE" });

    // act
    const pending = runProcess(launcher, { ...request, input: "protocol=https\n\n" });
    control.failInput(epipe);
    control.writeStderr("fatal: no helper");
    control.close(128);
    const run = await pending;

    // assert
    assert.deepStrictEqual(run, {
      code: 128,
      stdout: "",
      stderr: "fatal: no helper",
      timedOut: false,
    });
  });

  test("SG-PRC-02: settles with its own exit code when the process closes just before its timeout", async (t) => {
    // arrange
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const control = createProcessFake(42);
    const groupSignals: GroupSignal[] = [];
    const launcher = launcherFor(control, linuxHost(groupSignals));

    // act
    const pending = runProcess(launcher, request);
    t.mock.timers.tick(TIMEOUT_MS - 1);
    control.close(0);
    t.mock.timers.tick(1);
    const run = await pending;

    // assert
    assert.deepStrictEqual(run, { code: 0, stdout: "", stderr: "", timedOut: false });
    assert.deepStrictEqual(groupSignals, []);
  });

  test("SG-PRC-02: reports a timeout with the exit code of a process that closes during the kill grace", async (t) => {
    // arrange
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const control = createProcessFake(42);
    const launcher = launcherFor(control);

    // act
    const pending = runProcess(launcher, request);
    t.mock.timers.tick(TIMEOUT_MS);
    control.close(143);
    t.mock.timers.tick(KILL_GRACE_MS);
    t.mock.timers.tick(KILL_GRACE_MS);
    const run = await pending;

    // assert
    assert.deepStrictEqual(run, { code: 143, stdout: "", stderr: "", timedOut: true });
  });

  test("keeps the first characters of a head capture and the last characters of a tail capture", async () => {
    // arrange
    const control = createProcessFake();
    const launcher = launcherFor(control);
    const output = "0123456789abcdef";

    // act
    const pending = runProcess(launcher, {
      ...request,
      stdout: { limit: 8, keep: "head" },
      stderr: { limit: 8, keep: "tail" },
    });
    control.writeStdout(output.slice(0, 5));
    control.writeStderr(output.slice(0, 5));
    control.writeStdout(output.slice(5));
    control.writeStderr(output.slice(5));
    control.close(128);
    const run = await pending;

    // assert
    assert.deepStrictEqual(run, {
      code: 128,
      stdout: "01234567",
      stderr: "89abcdef",
      timedOut: false,
      truncated: ["stdout", "stderr"],
    });
  });

  test("WR-04: reports no cut for streams that fit their captures exactly", async () => {
    // arrange
    const control = createProcessFake();
    const launcher = launcherFor(control);

    // act
    const pending = runProcess(launcher, {
      ...request,
      stdout: { limit: 4, keep: "head" },
      stderr: { limit: 4, keep: "tail" },
    });
    control.writeStdout("ab");
    control.writeStdout("cd");
    control.writeStderr("wxyz");
    control.close(0);
    const run = await pending;

    // assert
    assert.deepStrictEqual(run, { code: 0, stdout: "abcd", stderr: "wxyz", timedOut: false });
  });

  test("WR-04: reports a cut of stdout alone when only stdout outgrows its capture", async () => {
    // arrange
    const control = createProcessFake();
    const launcher = launcherFor(control);

    // act
    const pending = runProcess(launcher, {
      ...request,
      stdout: { limit: 4, keep: "head" },
      stderr: { limit: 4, keep: "tail" },
    });
    control.writeStdout("abcde");
    control.writeStderr("wxyz");
    control.close(0);
    const run = await pending;

    // assert
    assert.deepStrictEqual(run, {
      code: 0,
      stdout: "abcd",
      stderr: "wxyz",
      timedOut: false,
      truncated: ["stdout"],
    });
  });

  test("WR-04: counts the character the decoder completes at the end toward the capture", async () => {
    // arrange
    const control = createProcessFake();
    const launcher = launcherFor(control);

    // act
    const pending = runProcess(launcher, { ...request, stdout: { limit: 2, keep: "head" } });
    control.writeStdout(Buffer.concat([Buffer.from("ab"), Buffer.from("é").subarray(0, 1)]));
    control.close(0);
    const run = await pending;

    // assert
    assert.deepStrictEqual(run, {
      code: 0,
      stdout: "ab",
      stderr: "",
      timedOut: false,
      truncated: ["stdout"],
    });
  });

  test("keeps the fatal line at the end of a stderr longer than its tail capture", async () => {
    // arrange
    const control = createProcessFake();
    const launcher = launcherFor(control);

    // act
    const pending = runProcess(launcher, { ...request, stderr: { limit: 64, keep: "tail" } });
    control.writeStderr("remote: counting objects\n".repeat(100));
    control.writeStderr("fatal: repository not found\n");
    control.close(128);
    const run = await pending;

    // assert
    assert.strictEqual(
      run.stderr,
      "ng objects\nremote: counting objects\nfatal: repository not found\n",
    );
  });

  test("never keeps half a surrogate pair at the cut of a head or a tail capture", async () => {
    // arrange
    const control = createProcessFake();
    const launcher = launcherFor(control);

    // act
    const pending = runProcess(launcher, {
      ...request,
      stdout: { limit: 2, keep: "head" },
      stderr: { limit: 3, keep: "tail" },
    });
    control.writeStdout("a😀b");
    control.writeStderr("a😀bc");
    control.close(0);
    const run = await pending;

    // assert
    assert.deepStrictEqual(run, {
      code: 0,
      stdout: "a",
      stderr: "bc",
      timedOut: false,
      truncated: ["stdout", "stderr"],
    });
  });

  test("decodes split UTF-8 characters independently in both output streams", async () => {
    // arrange
    const control = createProcessFake();
    const launcher = launcherFor(control);
    const stdout = Buffer.from("😀");
    const stderr = Buffer.from("café");

    // act
    const pending = runProcess(launcher, request);
    control.writeStdout(stdout.subarray(0, 2));
    control.writeStderr(stderr.subarray(0, 4));
    control.writeStdout(stdout.subarray(2));
    control.writeStderr(stderr.subarray(4));
    control.close(1);
    const run = await pending;

    // assert
    assert.deepStrictEqual(run, { code: 1, stdout: "😀", stderr: "café", timedOut: false });
  });

  test("flushes an unfinished UTF-8 sequence from each stream when the process closes", async () => {
    // arrange
    const control = createProcessFake();
    const launcher = launcherFor(control);

    // act
    const pending = runProcess(launcher, request);
    control.writeStdout(Buffer.from([0xc3]));
    control.writeStderr(Buffer.from([0xe2]));
    control.writeStderr(Buffer.from([0x82]));
    control.close(1);
    const run = await pending;

    // assert
    assert.deepStrictEqual(run, { code: 1, stdout: "�", stderr: "�", timedOut: false });
  });

  for (const { prefixLength, ending } of [
    { prefixLength: 65_534, ending: "😀" },
    { prefixLength: 65_535, ending: "" },
  ]) {
    test(`keeps whole Unicode characters at the output cap after ${prefixLength} characters`, async () => {
      // arrange
      const control = createProcessFake();
      const launcher = launcherFor(control);
      const emoji = Buffer.from("😀");

      // act
      const pending = runProcess(launcher, request);
      control.writeStdout("x".repeat(prefixLength));
      control.writeStdout(emoji.subarray(0, 2));
      control.writeStderr("é".repeat(prefixLength));
      control.writeStderr(emoji);
      control.writeStdout(emoji.subarray(2));
      control.writeStdout("tail");
      control.writeStderr("tail");
      control.close(0);
      const run = await pending;

      // assert
      assert.deepStrictEqual(run, {
        code: 0,
        stdout: "x".repeat(prefixLength) + ending,
        stderr: "é".repeat(prefixLength) + ending,
        timedOut: false,
        truncated: ["stdout", "stderr"],
      });
    });
  }

  test("resolves with the spawn error and no exit code when the process cannot start", async () => {
    // arrange
    const control = createProcessFake();
    const launcher = launcherFor(control);
    const error = Object.assign(new Error("spawn npm ENOENT"), { code: "ENOENT" });

    // act
    const pending = runProcess(launcher, request);
    control.fail(error);
    control.close(-2);
    const run = await pending;

    // assert
    assert.deepStrictEqual(run, { code: null, stdout: "", stderr: "", timedOut: false, error });
    assert.strictEqual(run.error, error);
  });

  test("resolves with the launch error when the launcher throws", async () => {
    // arrange
    const error = new Error("invalid argument");
    const launcher: ProcessLauncher = {
      spawn: () => {
        throw error;
      },
      host: linuxHost(),
    };

    // act
    const run = await runProcess(launcher, request);

    // assert
    assert.deepStrictEqual(run, { code: null, stdout: "", stderr: "", timedOut: false, error });
    assert.strictEqual(run.error, error);
  });

  test("keeps the first 65536 characters of each stream", async () => {
    // arrange
    const control = createProcessFake();
    const launcher = launcherFor(control);

    // act
    const pending = runProcess(launcher, request);
    control.writeStdout("x".repeat(35_000));
    control.writeStdout("x".repeat(35_000));
    control.close(0);
    const run = await pending;

    // assert
    assert.strictEqual(run.stdout, "x".repeat(65_536));
  });

  test("finishes the escalation after a timed-out process closes on SIGTERM", async (t) => {
    // arrange
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const control = createProcessFake();
    const launcher = launcherFor(control);
    const controller = new AbortController();

    // act
    const pending = runProcess(launcher, { ...request, signal: controller.signal });
    t.mock.timers.tick(TIMEOUT_MS);
    controller.abort();
    control.close(null);
    t.mock.timers.tick(KILL_GRACE_MS);
    t.mock.timers.tick(KILL_GRACE_MS);
    const run = await pending;

    // assert
    assert.deepStrictEqual(control.kills(), ["SIGTERM", "SIGKILL"]);
    assert.deepStrictEqual(run, { code: null, stdout: "", stderr: "", timedOut: true });
  });

  test("sends SIGKILL when the process ignores SIGTERM for the grace period", async (t) => {
    // arrange
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const control = createProcessFake();
    const launcher = launcherFor(control);

    // act
    const pending = runProcess(launcher, request);
    t.mock.timers.tick(TIMEOUT_MS);
    t.mock.timers.tick(KILL_GRACE_MS);
    const kills = control.kills();
    control.close(null);
    t.mock.timers.tick(KILL_GRACE_MS);
    const run = await pending;

    // assert
    assert.deepStrictEqual(kills, ["SIGTERM", "SIGKILL"]);
    assert.deepStrictEqual(run, { code: null, stdout: "", stderr: "", timedOut: true });
  });

  test("settles the run one grace after SIGKILL when the process never closes", async (t) => {
    // arrange
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const control = createProcessFake(42);
    const groupSignals: GroupSignal[] = [];
    const launcher = launcherFor(control, linuxHost(groupSignals));
    let settled = false;

    // act
    const pending = runProcess(launcher, request);
    void pending.then(() => {
      settled = true;
    });
    control.writeStderr("still running");
    t.mock.timers.tick(TIMEOUT_MS);
    t.mock.timers.tick(KILL_GRACE_MS);
    await Promise.resolve();
    const settledBeforeDeadline = settled;
    t.mock.timers.tick(KILL_GRACE_MS);
    const run = await pending;

    // assert
    assert.strictEqual(settledBeforeDeadline, false);
    assert.deepStrictEqual(groupSignals, [
      [42, "SIGTERM"],
      [42, "SIGKILL"],
    ]);
    assert.deepStrictEqual(run, {
      code: null,
      stdout: "",
      stderr: "still running",
      timedOut: true,
    });
  });

  test("keeps a running process's run open when a signal cannot be sent to it", async (t) => {
    // arrange
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const control = createProcessFake(42);
    const launcher = launcherFor(control);

    // act
    const pending = runProcess(launcher, request);
    t.mock.timers.tick(TIMEOUT_MS);
    control.fail(new Error("kill EPERM"));
    control.close(null);
    t.mock.timers.tick(KILL_GRACE_MS);
    t.mock.timers.tick(KILL_GRACE_MS);
    const run = await pending;

    // assert
    assert.deepStrictEqual(run, { code: null, stdout: "", stderr: "", timedOut: true });
  });

  test("signals nothing after the process closed", async (t) => {
    // arrange
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const control = createProcessFake();
    const launcher = launcherFor(control);
    const controller = new AbortController();

    // act
    const pending = runProcess(launcher, { ...request, signal: controller.signal });
    control.close(0);
    await pending;
    controller.abort();
    t.mock.timers.tick(TIMEOUT_MS + KILL_GRACE_MS);

    // assert
    assert.deepStrictEqual(control.kills(), []);
  });

  test("cancelling a run stops its whole process tree without reporting a timeout", async (t) => {
    // arrange
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const control = createProcessFake(42);
    const groupSignals: GroupSignal[] = [];
    const launcher = launcherFor(control, linuxHost(groupSignals));
    const controller = new AbortController();
    let settled = false;

    // act
    const pending = runProcess(launcher, { ...request, signal: controller.signal });
    void pending.then(() => {
      settled = true;
    });
    controller.abort(new Error("foreground command arrived"));
    const signalsAfterAbort = [...groupSignals];
    control.close(null);
    await Promise.resolve();
    const settledAfterParentClose = settled;
    t.mock.timers.tick(KILL_GRACE_MS);
    await Promise.resolve();
    const settledAfterSigkill = settled;
    t.mock.timers.tick(KILL_GRACE_MS);
    const run = await pending;

    // assert
    assert.deepStrictEqual(signalsAfterAbort, [[42, "SIGTERM"]]);
    assert.strictEqual(settledAfterParentClose, false);
    assert.strictEqual(settledAfterSigkill, false);
    assert.deepStrictEqual(groupSignals, [
      [42, "SIGTERM"],
      [42, "SIGKILL"],
    ]);
    assert.deepStrictEqual(run, { code: null, stdout: "", stderr: "", timedOut: false });
  });

  test("cancels a process when its signal aborts while the launcher returns", async (t) => {
    // arrange
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const control = createProcessFake(42);
    const groupSignals: GroupSignal[] = [];
    const controller = new AbortController();
    const launcher: ProcessLauncher = {
      spawn: () => {
        controller.abort();
        return control.process;
      },
      host: linuxHost(groupSignals),
    };

    // act
    const pending = runProcess(launcher, { ...request, signal: controller.signal });
    t.mock.timers.tick(KILL_GRACE_MS);
    t.mock.timers.tick(KILL_GRACE_MS);
    const run = await pending;

    // assert
    assert.deepStrictEqual(groupSignals, [
      [42, "SIGTERM"],
      [42, "SIGKILL"],
    ]);
    assert.deepStrictEqual(run, { code: null, stdout: "", stderr: "", timedOut: false });
  });

  test("kills a surviving group after its timed-out parent closes", async (t) => {
    // arrange
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const control = createProcessFake(42);
    const groupSignals: GroupSignal[] = [];
    let descendantRunning = true;
    let settled = false;
    const launcher = launcherFor(control, {
      ...linuxHost(),
      signalGroup: (pid, signal) => {
        groupSignals.push([pid, signal]);
        if (signal === "SIGKILL") {
          descendantRunning = false;
        }
      },
    });

    // act
    const pending = runProcess(launcher, request);
    void pending.then(() => {
      settled = true;
    });
    t.mock.timers.tick(TIMEOUT_MS);
    control.close(null);
    await Promise.resolve();
    const settledBeforeSigkill = settled;
    t.mock.timers.tick(KILL_GRACE_MS);
    await Promise.resolve();
    const settledAfterSigkill = settled;
    t.mock.timers.tick(KILL_GRACE_MS);
    const run = await pending;

    // assert
    assert.strictEqual(settledBeforeSigkill, false);
    assert.strictEqual(settledAfterSigkill, false);
    assert.deepStrictEqual(run, { code: null, stdout: "", stderr: "", timedOut: true });
    assert.strictEqual(descendantRunning, false);
    assert.deepStrictEqual(groupSignals, [
      [42, "SIGTERM"],
      [42, "SIGKILL"],
    ]);
  });

  test("runs a real child process and captures its exit code and output", async () => {
    // arrange
    const launcher: ProcessLauncher = { spawn: NODE_SPAWN, host: NODE_PROCESS_HOST };
    const script =
      'process.stdout.write("out"); process.stderr.write("err"); process.exitCode = 3;';

    // act
    const run = await runProcess(launcher, {
      ...request,
      command: process.execPath,
      args: ["-e", script],
      cwd: process.cwd(),
      timeoutMs: 10_000,
      killGraceMs: 1_000,
    });

    // assert
    assert.deepStrictEqual(run, { code: 3, stdout: "out", stderr: "err", timedOut: false });
  });

  test("SG-PRC-01: feeds the input to a real child, which then reads the end of its stdin", async () => {
    // arrange
    const launcher: ProcessLauncher = { spawn: NODE_SPAWN, host: NODE_PROCESS_HOST };
    const script = [
      'let text = "";',
      'process.stdin.on("data", (chunk) => { text += chunk; });',
      'process.stdin.on("end", () => { process.stdout.write(`read ${JSON.stringify(text)}`); });',
    ].join("\n");

    // act
    const run = await runProcess(launcher, {
      ...request,
      command: process.execPath,
      args: ["-e", script],
      cwd: process.cwd(),
      timeoutMs: 10_000,
      killGraceMs: 1_000,
      input: "protocol=https\n\n",
    });

    // assert
    assert.deepStrictEqual(run, {
      code: 0,
      stdout: 'read "protocol=https\\n\\n"',
      stderr: "",
      timedOut: false,
    });
  });

  test("SG-PRC-01: settles a real child that exits before it reads a large input", async () => {
    // arrange
    const launcher: ProcessLauncher = { spawn: NODE_SPAWN, host: NODE_PROCESS_HOST };

    // act
    const run = await runProcess(launcher, {
      ...request,
      command: process.execPath,
      args: ["-e", "process.exit(4)"],
      cwd: process.cwd(),
      timeoutMs: 10_000,
      killGraceMs: 1_000,
      input: "x".repeat(4_194_304),
    });

    // assert
    assert.deepStrictEqual(run, { code: 4, stdout: "", stderr: "", timedOut: false });
  });

  test("D-PL9-19: stops the whole process tree of a process that outlives the timeout", async () => {
    // arrange
    const timeoutMs = 2_000;
    const killGraceMs = 1_000;
    const launcher: ProcessLauncher = { spawn: NODE_SPAWN, host: NODE_PROCESS_HOST };
    const late = Date.now() + timeoutMs + 1.5 * killGraceMs;

    // act
    const run = await runProcess(launcher, {
      ...request,
      command: process.execPath,
      args: ["-e", IDLE_PARENT, String(late)],
      cwd: process.cwd(),
      timeoutMs,
      killGraceMs,
    });

    // assert
    assert.deepStrictEqual(run, { code: null, stdout: "started\n", stderr: "", timedOut: true });
  });

  test("waits for SIGKILL after a timed-out parent closes ahead of its descendant", async () => {
    // arrange
    const timeoutMs = 300;
    const killGraceMs = 400;
    const launcher: ProcessLauncher = { spawn: NODE_SPAWN, host: NODE_PROCESS_HOST };
    const startedAt = Date.now();

    // act
    const run = await runProcess(launcher, {
      ...request,
      command: process.execPath,
      args: ["-e", EXITING_PARENT],
      cwd: process.cwd(),
      timeoutMs,
      killGraceMs,
    });
    const elapsedMs = Date.now() - startedAt;

    // assert
    assert.strictEqual(elapsedMs >= timeoutMs + 2 * killGraceMs - 100, true);
    assert.deepStrictEqual(run, { code: null, stdout: "", stderr: "", timedOut: true });
  });

  test("settles a timed-out run without an ambient referenced handle", async () => {
    // act
    const probe = await runIsolatedTimeoutProbe();

    // assert
    assert.deepStrictEqual(probe, {
      code: 0,
      stderr: "",
      stdout: JSON.stringify({ code: null, stdout: "", stderr: "", timedOut: true }),
    });
  });

  test("D-PL9-19: sends SIGTERM and then SIGKILL to the process group on POSIX and never to the process alone", async (t) => {
    // arrange
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const control = createProcessFake(42);
    const groupSignals: GroupSignal[] = [];
    const launcher = launcherFor(control, linuxHost(groupSignals));

    // act
    const pending = runProcess(launcher, request);
    t.mock.timers.tick(TIMEOUT_MS);
    t.mock.timers.tick(KILL_GRACE_MS);
    control.close(null);
    t.mock.timers.tick(KILL_GRACE_MS);
    const run = await pending;

    // assert
    assert.deepStrictEqual(groupSignals, [
      [42, "SIGTERM"],
      [42, "SIGKILL"],
    ]);
    assert.deepStrictEqual(control.kills(), []);
    assert.deepStrictEqual(run, { code: null, stdout: "", stderr: "", timedOut: true });
  });

  test("D-PL9-19: signals the process alone when its process group cannot be signalled", async (t) => {
    // arrange
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const control = createProcessFake(42);
    const launcher = launcherFor(control, {
      ...linuxHost(),
      signalGroup: () => {
        throw Object.assign(new Error("kill ESRCH"), { code: "ESRCH" });
      },
    });

    // act
    const pending = runProcess(launcher, request);
    t.mock.timers.tick(TIMEOUT_MS);
    t.mock.timers.tick(KILL_GRACE_MS);
    control.close(null);
    t.mock.timers.tick(KILL_GRACE_MS);
    const run = await pending;

    // assert
    assert.deepStrictEqual(control.kills(), ["SIGTERM", "SIGKILL"]);
    assert.deepStrictEqual(run, { code: null, stdout: "", stderr: "", timedOut: true });
  });

  for (const pid of [undefined, 0, 1]) {
    test(`D-PL9-19: signals only the process itself for the pid ${pid}`, async (t) => {
      // arrange
      t.mock.timers.enable({ apis: ["setTimeout"] });
      const control = createProcessFake(pid);
      const groupSignals: GroupSignal[] = [];
      const launcher = launcherFor(control, linuxHost(groupSignals));

      // act
      const pending = runProcess(launcher, request);
      t.mock.timers.tick(TIMEOUT_MS);
      t.mock.timers.tick(KILL_GRACE_MS);
      control.close(null);
      t.mock.timers.tick(KILL_GRACE_MS);
      await pending;

      // assert
      assert.deepStrictEqual(control.kills(), ["SIGTERM", "SIGKILL"]);
      assert.deepStrictEqual(groupSignals, []);
    });
  }

  for (const { situation, env, taskkill } of [
    {
      situation: "the system folder its env names",
      env: { PATH: "C:\\tools", systemroot: "D:\\Windows" },
      taskkill: "D:\\Windows\\System32\\taskkill.exe",
    },
    {
      situation: "C:\\Windows when its env names no system folder",
      env: { PATH: "C:\\tools" },
      taskkill: "C:\\Windows\\System32\\taskkill.exe",
    },
  ]) {
    test(`D-PL9-19: runs taskkill /T /F from ${situation} at each step on Windows`, async (t) => {
      // arrange
      t.mock.timers.enable({ apis: ["setTimeout"] });
      const windows = startOnWindows(env, () => createProcessFake(7).process);

      // act
      t.mock.timers.tick(TIMEOUT_MS);
      t.mock.timers.tick(KILL_GRACE_MS);
      windows.control.close(null);
      t.mock.timers.tick(KILL_GRACE_MS);
      const run = await windows.pending;

      // assert
      const options = windowsSpawnOptions(env);
      assert.deepStrictEqual(windows.launches, [
        ["C:\\tools\\npm.exe", ["ci"], options],
        [taskkill, TASKKILL_ARGS, options],
        [taskkill, TASKKILL_ARGS, options],
      ]);
      assert.deepStrictEqual(windows.control.kills(), []);
      assert.deepStrictEqual(run, { code: null, stdout: "", stderr: "", timedOut: true });
    });
  }

  test("D-PL9-19: settles at the deadline when taskkill cannot start", async (t) => {
    // arrange
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const env = { PATH: "C:\\tools" };
    const windows = startOnWindows(env, () => {
      throw new Error("spawn taskkill.exe ENOENT");
    });

    // act
    t.mock.timers.tick(TIMEOUT_MS);
    t.mock.timers.tick(KILL_GRACE_MS);
    t.mock.timers.tick(KILL_GRACE_MS);
    const run = await windows.pending;

    // assert
    assert.deepStrictEqual(
      windows.launches.map(([command]) => command),
      [
        "C:\\tools\\npm.exe",
        "C:\\Windows\\System32\\taskkill.exe",
        "C:\\Windows\\System32\\taskkill.exe",
      ],
    );
    assert.deepStrictEqual(run, { code: null, stdout: "", stderr: "", timedOut: true });
  });

  test("D-PL9-19: settles at the deadline when taskkill fails after it starts", async (t) => {
    // arrange
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const killers: ProcessControl[] = [];
    const windows = startOnWindows({ PATH: "C:\\tools" }, () => {
      const killer = createProcessFake();
      killers.push(killer);
      return killer.process;
    });

    // act
    t.mock.timers.tick(TIMEOUT_MS);
    t.mock.timers.tick(KILL_GRACE_MS);
    for (const killer of killers) {
      killer.fail(new Error("spawn taskkill.exe EACCES"));
    }

    t.mock.timers.tick(KILL_GRACE_MS);
    const run = await windows.pending;

    // assert
    assert.strictEqual(killers.length, 2);
    assert.deepStrictEqual(run, { code: null, stdout: "", stderr: "", timedOut: true });
  });
});

// A win32 host whose file probe records each probe and finds exactly `files`.
function windowsHost(files: readonly string[], probes: string[]): ProcessHost {
  return {
    platform: "win32",
    isFile: (file) => {
      probes.push(file);
      return Promise.resolve(files.includes(file));
    },
    signalGroup: () => assert.fail("a lookup signals no process group"),
  };
}

const NPM_LOOKUP = { extensions: [".exe", ".cmd"] } as const;
const GIT_EXTENSIONS = [".exe", ".cmd", ".bat"] as const;

describe("findOnWindowsPath", () => {
  test("D-PL9-18: reads Path in any case, strips its quotes, and never probes an empty, current, or relative entry", async () => {
    // arrange
    const probes: string[] = [];
    const host = windowsHost(["C:\\tools\\npm.exe"], probes);

    // act
    const found = await findOnWindowsPath(
      "npm",
      { Path: '"C:\\Quoted Dir";;.;relative\\bin;C:\\tools' },
      host,
      NPM_LOOKUP,
    );

    // assert
    assert.strictEqual(found, "C:\\tools\\npm.exe");
    assert.deepStrictEqual(probes, [
      "C:\\Quoted Dir\\npm.exe",
      "C:\\Quoted Dir\\npm.cmd",
      "C:\\tools\\npm.exe",
    ]);
  });

  test("D-PL9-18: takes the first PATH directory that holds the command", async () => {
    // arrange
    const probes: string[] = [];
    const host = windowsHost(["C:\\first\\npm.cmd", "C:\\second\\npm.exe"], probes);

    // act
    const found = await findOnWindowsPath(
      "npm",
      { PATH: "C:\\first;C:\\second" },
      host,
      NPM_LOOKUP,
    );

    // assert
    assert.strictEqual(found, "C:\\first\\npm.cmd");
    assert.deepStrictEqual(probes, ["C:\\first\\npm.exe", "C:\\first\\npm.cmd"]);
  });

  for (const { situation, env, probes: expectedProbes } of [
    {
      situation: "no PATH directory holds the command",
      env: { PATH: "C:\\tools" },
      probes: ["C:\\tools\\npm.exe", "C:\\tools\\npm.cmd"],
    },
    { situation: "the environment has no PATH", env: {}, probes: [] },
  ]) {
    test(`D-PL9-18: finds nothing when ${situation}`, async () => {
      // arrange
      const probes: string[] = [];
      const host = windowsHost([], probes);

      // act
      const found = await findOnWindowsPath("npm", env, host, NPM_LOOKUP);

      // assert
      assert.strictEqual(found, undefined);
      assert.deepStrictEqual(probes, expectedProbes);
    });
  }

  for (const { situation, files, found: expectedFound, probes: expectedProbes } of [
    {
      situation: "an .exe",
      files: ["C:\\Git\\cmd\\git.exe", "C:\\Git\\cmd\\git.bat"],
      found: "C:\\Git\\cmd\\git.exe",
      probes: ["C:\\Git\\cmd\\git.exe"],
    },
    {
      situation: "a .bat after an .exe and a .cmd it does not find",
      files: ["C:\\Git\\cmd\\git.bat"],
      found: "C:\\Git\\cmd\\git.bat",
      probes: ["C:\\Git\\cmd\\git.exe", "C:\\Git\\cmd\\git.cmd", "C:\\Git\\cmd\\git.bat"],
    },
  ]) {
    test(`D-SG-04: tries the caller's extensions in order and finds ${situation}`, async () => {
      // arrange
      const probes: string[] = [];
      const host = windowsHost(files, probes);

      // act
      const found = await findOnWindowsPath("git", { PATH: "C:\\Git\\cmd" }, host, {
        extensions: GIT_EXTENSIONS,
      });

      // assert
      assert.strictEqual(found, expectedFound);
      assert.deepStrictEqual(probes, expectedProbes);
    });
  }

  test("D-SG-04: skips a file the caller refuses and keeps searching PATH", async () => {
    // arrange
    const probes: string[] = [];
    const host = windowsHost(["C:\\project\\git.exe", "C:\\Git\\cmd\\git.exe"], probes);
    const asked: string[] = [];

    // act
    const found = await findOnWindowsPath("git", { PATH: "C:\\project;C:\\Git\\cmd" }, host, {
      extensions: GIT_EXTENSIONS,
      accept: (candidate) => {
        asked.push(candidate);
        return Promise.resolve(!candidate.startsWith("C:\\project\\"));
      },
    });

    // assert
    assert.strictEqual(found, "C:\\Git\\cmd\\git.exe");
    assert.deepStrictEqual(asked, ["C:\\project\\git.exe", "C:\\Git\\cmd\\git.exe"]);
    assert.deepStrictEqual(probes, [
      "C:\\project\\git.exe",
      "C:\\project\\git.cmd",
      "C:\\project\\git.bat",
      "C:\\Git\\cmd\\git.exe",
    ]);
  });
});

describe("NODE_PROCESS_HOST", () => {
  test("probes a real file as a file and a directory or a missing path as none", async (t) => {
    // arrange
    const environment = await createHermeticEnvironment(t, "process-run-host-");
    const file = path.join(environment.root, "npm.cmd");
    const directory = path.join(environment.root, "npm.exe");
    await writeFile(file, "");
    await mkdir(directory);

    // act
    const probes = await Promise.all(
      [file, directory, path.join(environment.root, "missing.exe")].map((candidate) =>
        NODE_PROCESS_HOST.isFile(candidate),
      ),
    );

    // assert
    assert.deepStrictEqual(probes, [true, false, false]);
  });

  test("runs on the platform of this process", () => {
    // act
    const { platform } = NODE_PROCESS_HOST;

    // assert
    assert.strictEqual(platform, process.platform);
  });
});

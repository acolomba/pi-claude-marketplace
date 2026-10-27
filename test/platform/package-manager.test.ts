import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  NODE_PACKAGE_MANAGER_HOST,
  NODE_PACKAGE_MANAGER_SPAWN,
  createPackageManagerRunner,
} from "../../extensions/pi-claude-marketplace/platform/package-manager.ts";

import { createHermeticEnvironment } from "./hermetic-environment.ts";

import type {
  PackageManagerHost,
  PackageManagerProcess,
  PackageManagerRun,
  PackageManagerSpawn,
  PackageManagerSpawnOptions,
} from "../../extensions/pi-claude-marketplace/platform/package-manager.ts";

const TIMEOUT_MS = 1_000;
const KILL_GRACE_MS = 200;

interface PackageManagerProcessControl {
  readonly process: PackageManagerProcess;
  close(code: number | null): void;
  fail(error: Error): void;
  kills(): readonly string[];
  writeStderr(text: string): void;
  writeStdout(text: string): void;
}

function createPackageManagerProcess(pid?: number): PackageManagerProcessControl {
  const stdoutListeners: Array<(chunk: Buffer) => void> = [];
  const stderrListeners: Array<(chunk: Buffer) => void> = [];
  const errorListeners: Array<(error: Error) => void> = [];
  const closeListeners: Array<(code: number | null) => void> = [];
  const signals: string[] = [];
  return {
    process: {
      pid,
      stdout: {
        on: (_event, listener) => {
          stdoutListeners.push(listener);
        },
      },
      stderr: {
        on: (_event, listener) => {
          stderrListeners.push(listener);
        },
      },
      kill: (signal) => {
        signals.push(signal);
        return true;
      },
      on: (event, listener) => {
        if (event === "error") {
          errorListeners.push(listener as (error: Error) => void);
        } else {
          closeListeners.push(listener as (code: number | null) => void);
        }
      },
    },
    close: (code) => {
      for (const listener of closeListeners) {
        listener(code);
      }
    },
    // Like Node's EventEmitter, an error nothing listens for throws.
    fail: (error) => {
      if (errorListeners.length === 0) {
        throw error;
      }

      for (const listener of errorListeners) {
        listener(error);
      }
    },
    kills: () => [...signals],
    writeStderr: (text) => {
      for (const listener of stderrListeners) {
        listener(Buffer.from(text));
      }
    },
    writeStdout: (text) => {
      for (const listener of stdoutListeners) {
        listener(Buffer.from(text));
      }
    },
  };
}

type GroupSignal = readonly [number, string];

// A Linux host that records each group signal. It never looks a command up,
// so its file probe fails a case that reaches it.
function linuxHost(groupSignals: GroupSignal[] = []): PackageManagerHost {
  return {
    platform: "linux",
    execPath: "/usr/bin/node",
    isFile: () => assert.fail("a Linux launch probes no file"),
    signalGroup: (pid, signal) => {
      groupSignals.push([pid, signal]);
    },
  };
}

function runnerFor(control: PackageManagerProcessControl, host: PackageManagerHost = linuxHost()) {
  return createPackageManagerRunner({
    spawn: () => control.process,
    timeoutMs: TIMEOUT_MS,
    killGraceMs: KILL_GRACE_MS,
    env: {},
    host,
  });
}

const request = { command: "npm", args: ["ci"], cwd: "/work" } as const;

test("runs Node's own spawn as the production launcher", () => {
  // arrange
  const nodeLauncher: unknown = spawn;

  // act
  const productionLauncher: unknown = NODE_PACKAGE_MANAGER_SPAWN;

  // assert
  assert.strictEqual(productionLauncher, nodeLauncher);
});

test("starts no process until a request runs", () => {
  // arrange
  const launches: string[] = [];
  const launcher: PackageManagerSpawn = (command) => {
    launches.push(command);
    throw new Error("creating the runner must not start a process");
  };

  // act
  createPackageManagerRunner({
    spawn: launcher,
    timeoutMs: TIMEOUT_MS,
    killGraceMs: KILL_GRACE_MS,
    env: {},
    host: linuxHost(),
  });

  // assert
  assert.deepStrictEqual(launches, []);
});

test("spawns the command with its arguments verbatim, no shell, the request directory, and the update notifier off", async () => {
  // arrange
  const control = createPackageManagerProcess();
  const launches: Array<readonly [string, readonly string[], PackageManagerSpawnOptions]> = [];
  const runPackageManager = createPackageManagerRunner({
    spawn: (command, args, options) => {
      launches.push([command, args, options]);
      return control.process;
    },
    timeoutMs: TIMEOUT_MS,
    killGraceMs: KILL_GRACE_MS,
    env: { HOME: "/home/user" },
    host: linuxHost(),
  });

  // act
  const pending = runPackageManager({
    command: "bun",
    args: ["install", "--frozen-lockfile", "--ignore-scripts"],
    cwd: "/work",
    env: { BUN_INSTALL_CACHE_DIR: "/work/bun-cache" },
  });
  control.close(0);
  await pending;

  // assert
  assert.deepStrictEqual(launches, [
    [
      "bun",
      ["install", "--frozen-lockfile", "--ignore-scripts"],
      {
        cwd: "/work",
        env: {
          HOME: "/home/user",
          npm_config_update_notifier: "false",
          BUN_INSTALL_CACHE_DIR: "/work/bun-cache",
        },
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
        detached: true,
      },
    ],
  ]);
});

test("resolves with the exit code and both streams when the process closes", async () => {
  // arrange
  const control = createPackageManagerProcess();
  const runPackageManager = runnerFor(control);

  // act
  const pending = runPackageManager(request);
  control.writeStdout("a");
  control.writeStdout("b");
  control.writeStderr("c");
  control.close(1);
  const run = await pending;

  // assert
  assert.deepStrictEqual(run, { code: 1, stdout: "ab", stderr: "c", timedOut: false });
});

test("resolves with the spawn error and no exit code when the process cannot start", async () => {
  // arrange
  const control = createPackageManagerProcess();
  const runPackageManager = runnerFor(control);
  const error = Object.assign(new Error("spawn npm ENOENT"), { code: "ENOENT" });

  // act
  const pending = runPackageManager(request);
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
  const runPackageManager = createPackageManagerRunner({
    spawn: () => {
      throw error;
    },
    timeoutMs: TIMEOUT_MS,
    killGraceMs: KILL_GRACE_MS,
    env: {},
    host: linuxHost(),
  });

  // act
  const run = await runPackageManager(request);

  // assert
  assert.deepStrictEqual(run, { code: null, stdout: "", stderr: "", timedOut: false, error });
  assert.strictEqual(run.error, error);
});

test("keeps the first 65536 characters of each stream", async () => {
  // arrange
  const control = createPackageManagerProcess();
  const runPackageManager = runnerFor(control);

  // act
  const pending = runPackageManager(request);
  control.writeStdout("x".repeat(35_000));
  control.writeStdout("x".repeat(35_000));
  control.close(0);
  const run = await pending;

  // assert
  assert.strictEqual(run.stdout, "x".repeat(65_536));
});

test("stops a process that outlives the timeout with SIGTERM and reports it timed out", async (t) => {
  // arrange
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const control = createPackageManagerProcess();
  const runPackageManager = runnerFor(control);

  // act
  const pending = runPackageManager(request);
  t.mock.timers.tick(TIMEOUT_MS);
  const kills = control.kills();
  control.close(null);
  const run = await pending;

  // assert
  assert.deepStrictEqual(kills, ["SIGTERM"]);
  assert.deepStrictEqual(run, { code: null, stdout: "", stderr: "", timedOut: true });
});

test("sends SIGKILL when the process ignores SIGTERM for the grace period", async (t) => {
  // arrange
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const control = createPackageManagerProcess();
  const runPackageManager = runnerFor(control);

  // act
  const pending = runPackageManager(request);
  t.mock.timers.tick(TIMEOUT_MS);
  t.mock.timers.tick(KILL_GRACE_MS);
  const kills = control.kills();
  control.close(null);
  const run = await pending;

  // assert
  assert.deepStrictEqual(kills, ["SIGTERM", "SIGKILL"]);
  assert.deepStrictEqual(run, { code: null, stdout: "", stderr: "", timedOut: true });
});

test("settles the run one grace after SIGKILL when the process never closes", async (t) => {
  // arrange
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const control = createPackageManagerProcess(42);
  const groupSignals: GroupSignal[] = [];
  const runPackageManager = runnerFor(control, linuxHost(groupSignals));
  let settled = false;

  // act
  const pending = runPackageManager(request);
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
  const control = createPackageManagerProcess(42);
  const runPackageManager = runnerFor(control);

  // act
  const pending = runPackageManager(request);
  t.mock.timers.tick(TIMEOUT_MS);
  control.fail(new Error("kill EPERM"));
  control.close(null);
  const run = await pending;

  // assert
  assert.deepStrictEqual(run, { code: null, stdout: "", stderr: "", timedOut: true });
});

test("signals nothing after the process closed", async (t) => {
  // arrange
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const control = createPackageManagerProcess();
  const runPackageManager = runnerFor(control);

  // act
  const pending = runPackageManager(request);
  control.close(0);
  await pending;
  t.mock.timers.tick(TIMEOUT_MS + KILL_GRACE_MS);

  // assert
  assert.deepStrictEqual(control.kills(), []);
});

test("runs a real child process and captures its exit code and output", async () => {
  // arrange
  const runPackageManager = createPackageManagerRunner({
    spawn: NODE_PACKAGE_MANAGER_SPAWN,
    timeoutMs: 10_000,
    killGraceMs: 1_000,
    env: {},
    host: NODE_PACKAGE_MANAGER_HOST,
  });
  const script = 'process.stdout.write("out"); process.stderr.write("err"); process.exitCode = 3;';

  // act
  const run = await runPackageManager({
    command: process.execPath,
    args: ["-e", script],
    cwd: process.cwd(),
  });

  // assert
  assert.deepStrictEqual(run, { code: 3, stdout: "out", stderr: "err", timedOut: false });
});

test("probes a real file as a file and a directory or a missing path as none", async (t) => {
  // arrange
  const environment = await createHermeticEnvironment(t, "package-manager-host-");
  const file = path.join(environment.root, "npm.cmd");
  const directory = path.join(environment.root, "npm.exe");
  await writeFile(file, "");
  await mkdir(directory);

  // act
  const probes = await Promise.all(
    [file, directory, path.join(environment.root, "missing.exe")].map((candidate) =>
      NODE_PACKAGE_MANAGER_HOST.isFile(candidate),
    ),
  );

  // assert
  assert.deepStrictEqual(probes, [true, false, false]);
});

test("runs on the platform and the Node binary of this process", () => {
  // arrange
  const expectedHost = { platform: process.platform, execPath: process.execPath };

  // act
  const { platform, execPath } = NODE_PACKAGE_MANAGER_HOST;

  // assert
  assert.deepStrictEqual({ platform, execPath }, expectedHost);
});

const WINDOWS_NODE = "C:\\Program Files\\nodejs\\node.exe";

interface WindowsLaunch {
  readonly probes: string[];
  readonly launches: Array<readonly [string, readonly string[], boolean]>;
  readonly run: PackageManagerRun;
}

// Runs one request on a win32 host whose file probe finds exactly `files`. A
// process that starts closes with 0 as soon as the run watches it.
async function runOnWindows(
  command: string,
  env: NodeJS.ProcessEnv,
  files: readonly string[],
): Promise<WindowsLaunch> {
  const probes: string[] = [];
  const launches: Array<readonly [string, readonly string[], boolean]> = [];
  const runPackageManager = createPackageManagerRunner({
    spawn: (launched, args, options) => {
      launches.push([launched, args, options.shell]);
      const control = createPackageManagerProcess(42);
      queueMicrotask(() => {
        control.close(0);
      });
      return control.process;
    },
    timeoutMs: TIMEOUT_MS,
    killGraceMs: KILL_GRACE_MS,
    env,
    host: {
      platform: "win32",
      execPath: WINDOWS_NODE,
      isFile: (file) => {
        probes.push(file);
        return Promise.resolve(files.includes(file));
      },
      signalGroup: () => assert.fail("Windows signals no process group"),
    },
  });
  const run = await runPackageManager({ command, args: ["ci"], cwd: "C:\\work" });
  return { probes, launches, run };
}

const CLOSED: PackageManagerRun = { code: 0, stdout: "", stderr: "", timedOut: false };

function notStarted(message: string): PackageManagerRun {
  return { code: null, stdout: "", stderr: "", timedOut: false, error: new Error(message) };
}

test("D-PL9-18: starts npm.cmd's npm-cli.js with this Node binary and no shell on Windows", async () => {
  // arrange
  const cli = "C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js";

  // act
  const launch = await runOnWindows("npm", { PATH: "C:\\Program Files\\nodejs" }, [
    "C:\\Program Files\\nodejs\\npm.cmd",
    cli,
  ]);

  // assert
  assert.deepStrictEqual(launch, {
    probes: ["C:\\Program Files\\nodejs\\npm.exe", "C:\\Program Files\\nodejs\\npm.cmd", cli],
    launches: [[WINDOWS_NODE, [cli, "ci"], false]],
    run: CLOSED,
  });
});

test("D-PL9-18: reads Path in any case, strips its quotes, and never probes an empty, current, or relative entry", async () => {
  // act
  const launch = await runOnWindows(
    "npm",
    { Path: '"C:\\Quoted Dir";;.;relative\\bin;C:\\tools' },
    ["C:\\tools\\npm.exe"],
  );

  // assert
  assert.deepStrictEqual(launch, {
    probes: ["C:\\Quoted Dir\\npm.exe", "C:\\Quoted Dir\\npm.cmd", "C:\\tools\\npm.exe"],
    launches: [["C:\\tools\\npm.exe", ["ci"], false]],
    run: CLOSED,
  });
});

test("D-PL9-18: takes the first PATH directory that holds the command", async () => {
  // arrange
  const cli = "C:\\first\\node_modules\\npm\\bin\\npm-cli.js";

  // act
  const launch = await runOnWindows("npm", { PATH: "C:\\first;C:\\second" }, [
    "C:\\first\\npm.cmd",
    cli,
    "C:\\second\\npm.exe",
  ]);

  // assert
  assert.deepStrictEqual(launch, {
    probes: ["C:\\first\\npm.exe", "C:\\first\\npm.cmd", cli],
    launches: [[WINDOWS_NODE, [cli, "ci"], false]],
    run: CLOSED,
  });
});

test("D-PL9-18: starts bun.exe directly, ahead of a bun.cmd in the same directory", async () => {
  // act
  const launch = await runOnWindows("bun", { PATH: "C:\\bun" }, [
    "C:\\bun\\bun.exe",
    "C:\\bun\\bun.cmd",
  ]);

  // assert
  assert.deepStrictEqual(launch, {
    probes: ["C:\\bun\\bun.exe"],
    launches: [["C:\\bun\\bun.exe", ["ci"], false]],
    run: CLOSED,
  });
});

for (const { situation, command, env, files, probes, message } of [
  {
    situation: "a bun.cmd",
    command: "bun",
    env: { PATH: "C:\\bun" },
    files: ["C:\\bun\\bun.cmd"],
    probes: ["C:\\bun\\bun.exe", "C:\\bun\\bun.cmd"],
    message:
      "bun on PATH is a batch file (C:\\bun\\bun.cmd), which this install does not run without a shell",
  },
  {
    situation: "an npm.cmd with no npm-cli.js beside it",
    command: "npm",
    env: { PATH: "C:\\scoop\\shims" },
    files: ["C:\\scoop\\shims\\npm.cmd"],
    probes: [
      "C:\\scoop\\shims\\npm.exe",
      "C:\\scoop\\shims\\npm.cmd",
      "C:\\scoop\\shims\\node_modules\\npm\\bin\\npm-cli.js",
    ],
    message: "npm-cli.js was not found beside C:\\scoop\\shims\\npm.cmd",
  },
  {
    situation: "no match on PATH",
    command: "npm",
    env: { PATH: "C:\\tools" },
    files: [],
    probes: ["C:\\tools\\npm.exe", "C:\\tools\\npm.cmd"],
    message: "npm was not found on PATH",
  },
  {
    situation: "no PATH at all",
    command: "npm",
    env: {},
    files: [],
    probes: [],
    message: "npm was not found on PATH",
  },
]) {
  test(`D-PL9-18: resolves the run with an error and starts nothing for ${situation} on Windows`, async () => {
    // act
    const launch = await runOnWindows(command, env, files);

    // assert
    assert.deepStrictEqual(launch, { probes, launches: [], run: notStarted(message) });
  });
}

test("D-PL9-18: spawns the bare command on Linux without looking it up", async () => {
  // arrange
  const launches: string[] = [];
  const control = createPackageManagerProcess();
  const runPackageManager = createPackageManagerRunner({
    spawn: (command) => {
      launches.push(command);
      return control.process;
    },
    timeoutMs: TIMEOUT_MS,
    killGraceMs: KILL_GRACE_MS,
    env: { PATH: "/usr/bin" },
    host: linuxHost(),
  });

  // act
  const pending = runPackageManager(request);
  control.close(0);
  const run = await pending;

  // assert
  assert.deepStrictEqual(launches, ["npm"]);
  assert.deepStrictEqual(run, CLOSED);
});

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

test("D-PL9-19: stops the whole process tree of a package manager that outlives the timeout", async () => {
  // arrange
  const timeoutMs = 2_000;
  const killGraceMs = 1_000;
  const runPackageManager = createPackageManagerRunner({
    spawn: NODE_PACKAGE_MANAGER_SPAWN,
    timeoutMs,
    killGraceMs,
    env: {},
    host: NODE_PACKAGE_MANAGER_HOST,
  });
  const late = Date.now() + timeoutMs + 1.5 * killGraceMs;

  // act
  const run = await runPackageManager({
    command: process.execPath,
    args: ["-e", IDLE_PARENT, String(late)],
    cwd: process.cwd(),
  });

  // assert
  assert.deepStrictEqual(run, { code: null, stdout: "started\n", stderr: "", timedOut: true });
});

test("D-PL9-19: sends SIGTERM and then SIGKILL to the process group on POSIX and never to the process alone", async (t) => {
  // arrange
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const control = createPackageManagerProcess(42);
  const groupSignals: GroupSignal[] = [];
  const runPackageManager = runnerFor(control, linuxHost(groupSignals));

  // act
  const pending = runPackageManager(request);
  t.mock.timers.tick(TIMEOUT_MS);
  t.mock.timers.tick(KILL_GRACE_MS);
  control.close(null);
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
  const control = createPackageManagerProcess(42);
  const runPackageManager = runnerFor(control, {
    ...linuxHost(),
    signalGroup: () => {
      throw Object.assign(new Error("kill ESRCH"), { code: "ESRCH" });
    },
  });

  // act
  const pending = runPackageManager(request);
  t.mock.timers.tick(TIMEOUT_MS);
  t.mock.timers.tick(KILL_GRACE_MS);
  control.close(null);
  const run = await pending;

  // assert
  assert.deepStrictEqual(control.kills(), ["SIGTERM", "SIGKILL"]);
  assert.deepStrictEqual(run, { code: null, stdout: "", stderr: "", timedOut: true });
});

for (const pid of [undefined, 0, 1]) {
  test(`D-PL9-19: signals only the process itself for the pid ${pid}`, async (t) => {
    // arrange
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const control = createPackageManagerProcess(pid);
    const groupSignals: GroupSignal[] = [];
    const runPackageManager = runnerFor(control, linuxHost(groupSignals));

    // act
    const pending = runPackageManager(request);
    t.mock.timers.tick(TIMEOUT_MS);
    t.mock.timers.tick(KILL_GRACE_MS);
    control.close(null);
    await pending;

    // assert
    assert.deepStrictEqual(control.kills(), ["SIGTERM", "SIGKILL"]);
    assert.deepStrictEqual(groupSignals, []);
  });
}

type Launched = readonly [string, readonly string[], PackageManagerSpawnOptions];

interface WindowsTimeout {
  readonly control: PackageManagerProcessControl;
  readonly launches: Launched[];
  readonly pending: Promise<PackageManagerRun>;
}

// Starts npm.exe from C:\\tools on a win32 host and waits until it runs. Every
// later launch is a taskkill, which `startKiller` stands in for.
async function startOnWindows(
  env: NodeJS.ProcessEnv,
  startKiller: () => PackageManagerProcess,
): Promise<WindowsTimeout> {
  const control = createPackageManagerProcess(42);
  const launches: Launched[] = [];
  let markStarted: () => void = () => undefined;
  const started = new Promise<void>((resolve) => {
    markStarted = resolve;
  });
  const runPackageManager = createPackageManagerRunner({
    spawn: (command, args, options) => {
      launches.push([command, args, options]);
      if (launches.length > 1) {
        return startKiller();
      }

      markStarted();
      return control.process;
    },
    timeoutMs: TIMEOUT_MS,
    killGraceMs: KILL_GRACE_MS,
    env,
    host: {
      platform: "win32",
      execPath: WINDOWS_NODE,
      isFile: (file) => Promise.resolve(file === "C:\\tools\\npm.exe"),
      signalGroup: () => assert.fail("Windows signals no process group"),
    },
  });
  const pending = runPackageManager({ command: "npm", args: ["ci"], cwd: "C:\\work" });
  await started;
  return { control, launches, pending };
}

function windowsSpawnOptions(env: NodeJS.ProcessEnv): PackageManagerSpawnOptions {
  return {
    cwd: "C:\\work",
    env: { ...env, npm_config_update_notifier: "false" },
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
    detached: false,
  };
}

const TASKKILL_ARGS = ["/PID", "42", "/T", "/F"];

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
    const windows = await startOnWindows(env, () => createPackageManagerProcess(7).process);

    // act
    t.mock.timers.tick(TIMEOUT_MS);
    t.mock.timers.tick(KILL_GRACE_MS);
    windows.control.close(null);
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
  const windows = await startOnWindows(env, () => {
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
  const killers: PackageManagerProcessControl[] = [];
  const windows = await startOnWindows({ PATH: "C:\\tools" }, () => {
    const killer = createPackageManagerProcess();
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

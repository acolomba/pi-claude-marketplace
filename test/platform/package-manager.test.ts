import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import test from "node:test";

import {
  NODE_PACKAGE_MANAGER_SPAWN,
  createPackageManagerRunner,
} from "../../extensions/pi-claude-marketplace/platform/package-manager.ts";

import type {
  PackageManagerProcess,
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

function createPackageManagerProcess(): PackageManagerProcessControl {
  const stdoutListeners: Array<(chunk: Buffer) => void> = [];
  const stderrListeners: Array<(chunk: Buffer) => void> = [];
  const errorListeners: Array<(error: Error) => void> = [];
  const closeListeners: Array<(code: number | null) => void> = [];
  const signals: string[] = [];
  return {
    process: {
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
    fail: (error) => {
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

function runnerFor(control: PackageManagerProcessControl) {
  return createPackageManagerRunner({
    spawn: () => control.process,
    timeoutMs: TIMEOUT_MS,
    killGraceMs: KILL_GRACE_MS,
    env: {},
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

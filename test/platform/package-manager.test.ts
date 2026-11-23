import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import test from "node:test";

import {
  NODE_PACKAGE_MANAGER_HOST,
  NODE_PACKAGE_MANAGER_SPAWN,
  createPackageManagerRunner,
} from "../../extensions/pi-claude-marketplace/platform/package-manager.ts";
import { NODE_PROCESS_HOST } from "../../extensions/pi-claude-marketplace/platform/process-run.ts";

import { createProcessFake } from "./process-fake.ts";

import type {
  PackageManagerHost,
  PackageManagerRun,
} from "../../extensions/pi-claude-marketplace/platform/package-manager.ts";
import type {
  ProcessSpawn,
  ProcessSpawnOptions,
} from "../../extensions/pi-claude-marketplace/platform/process-run.ts";

const TIMEOUT_MS = 1_000;
const KILL_GRACE_MS = 200;

// A Linux host for runs that close at once. It never looks a command up and
// never stops a process group, so a case that reaches either fails.
const LINUX_HOST: PackageManagerHost = {
  platform: "linux",
  execPath: "/usr/bin/node",
  isFile: () => assert.fail("a Linux launch probes no file"),
  signalGroup: () => assert.fail("a run that closes signals no process group"),
};

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
  const launcher: ProcessSpawn = (command) => {
    launches.push(command);
    throw new Error("creating the runner must not start a process");
  };

  // act
  createPackageManagerRunner({
    spawn: launcher,
    timeoutMs: TIMEOUT_MS,
    killGraceMs: KILL_GRACE_MS,
    env: {},
    host: LINUX_HOST,
  });

  // assert
  assert.deepStrictEqual(launches, []);
});

test("starts no process for a request whose operation was already cancelled", async () => {
  // arrange
  const controller = new AbortController();
  const reason = new Error("foreground command arrived");
  controller.abort(reason);
  const runPackageManager = createPackageManagerRunner({
    spawn: () => assert.fail("a cancelled request started a process"),
    timeoutMs: TIMEOUT_MS,
    killGraceMs: KILL_GRACE_MS,
    env: {},
    host: LINUX_HOST,
  });

  // act
  const run = await runPackageManager({ ...request, signal: controller.signal });

  // assert
  assert.deepStrictEqual(run, {
    code: null,
    stdout: "",
    stderr: "",
    timedOut: false,
    error: new Error("Package manager run aborted", { cause: reason }),
  });
});

test("spawns the command with its arguments verbatim, no shell, the request directory, and the update notifier off", async () => {
  // arrange
  const control = createProcessFake();
  const launches: Array<readonly [string, readonly string[], ProcessSpawnOptions]> = [];
  const runPackageManager = createPackageManagerRunner({
    spawn: (command, args, options) => {
      launches.push([command, args, options]);
      return control.process;
    },
    timeoutMs: TIMEOUT_MS,
    killGraceMs: KILL_GRACE_MS,
    env: { HOME: "/home/user" },
    host: LINUX_HOST,
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
        windowsHide: false,
      },
    ],
  ]);
});

test("keeps the first 65536 characters of each stream of a package-manager run", async () => {
  // arrange
  const control = createProcessFake();
  const runPackageManager = createPackageManagerRunner({
    spawn: control.spawn,
    timeoutMs: TIMEOUT_MS,
    killGraceMs: KILL_GRACE_MS,
    env: {},
    host: LINUX_HOST,
  });

  // act
  const pending = runPackageManager(request);
  control.writeStdout(`${"o".repeat(65_536)}npm notice`);
  control.writeStderr(`${"e".repeat(65_536)}npm error`);
  control.close(1);
  const run = await pending;

  // assert
  assert.deepStrictEqual(run, {
    code: 1,
    stdout: "o".repeat(65_536),
    stderr: "e".repeat(65_536),
    timedOut: false,
    truncated: ["stdout", "stderr"],
  });
});

test("runs on the platform and the Node binary of this process", () => {
  // arrange
  const expectedHost = { platform: process.platform, execPath: process.execPath };

  // act
  const { platform, execPath } = NODE_PACKAGE_MANAGER_HOST;

  // assert
  assert.deepStrictEqual({ platform, execPath }, expectedHost);
});

test("probes files and signals process groups through the shared process host", () => {
  // act
  const { isFile, signalGroup } = NODE_PACKAGE_MANAGER_HOST;

  // assert
  assert.strictEqual(isFile, NODE_PROCESS_HOST.isFile);
  assert.strictEqual(signalGroup, NODE_PROCESS_HOST.signalGroup);
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
      const control = createProcessFake(42);
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
  const control = createProcessFake();
  const runPackageManager = createPackageManagerRunner({
    spawn: (command) => {
      launches.push(command);
      return control.process;
    },
    timeoutMs: TIMEOUT_MS,
    killGraceMs: KILL_GRACE_MS,
    env: { PATH: "/usr/bin" },
    host: LINUX_HOST,
  });

  // act
  const pending = runPackageManager(request);
  control.close(0);
  const run = await pending;

  // assert
  assert.deepStrictEqual(launches, ["npm"]);
  assert.deepStrictEqual(run, CLOSED);
});

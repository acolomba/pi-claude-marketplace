import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access, mkdir, mkdtemp, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, test } from "node:test";

import {
  createGitProcess,
  NODE_GIT_HOST,
  NODE_GIT_PROCESS,
  NODE_GIT_SPAWN,
} from "../../extensions/pi-claude-marketplace/platform/git-process.ts";
import { GitCommandError } from "../../extensions/pi-claude-marketplace/shared/errors.ts";
import { hermeticGitEnvironment } from "../../features/lib/hermetic-git.ts";

import { captureDebugLog } from "./debug-log-capture.ts";
import { createGitTestRepository } from "./git-test-repository.ts";
import { createProcessFake } from "./process-fake.ts";

import type {
  GitProcess,
  GitProcessHost,
  GitRequest,
} from "../../extensions/pi-claude-marketplace/platform/git-process.ts";
import type { ProcessSpawn } from "../../extensions/pi-claude-marketplace/platform/process-run.ts";
import type { GitFailure } from "../../extensions/pi-claude-marketplace/shared/errors.ts";
import type { ProcessControl, ProcessLaunch } from "./process-fake.ts";
import type { TestContext } from "node:test";

const NODE_SPAWN = spawn as ProcessSpawn;
const KILL_GRACE_MS = 200;
const FILL_INPUT = "protocol=https\nhost=github.com\n\n";

const FILL: GitRequest = {
  subcommand: "credential",
  options: ["fill"],
  lane: "network",
  input: FILL_INPUT,
  timeoutMs: 5_000,
};

// D-SG-05: the `-c` pairs of every command, in their order.
function hardening(hooksPath: string): string[] {
  return `core.fsmonitor=
core.hooksPath=${hooksPath}
core.askPass=
protocol.ext.allow=never
core.alternateRefsCommand=f() { git --git-dir="$1" for-each-ref --format='%(objectname)'; }; f
submodule.recurse=false
log.showSignature=false
format.pretty=medium
gc.auto=0
maintenance.auto=false
diff.autoRefreshIndex=false
hook.applypatch-msg.enabled=false
hook.pre-applypatch.enabled=false
hook.post-applypatch.enabled=false
hook.pre-commit.enabled=false
hook.pre-merge-commit.enabled=false
hook.prepare-commit-msg.enabled=false
hook.commit-msg.enabled=false
hook.post-commit.enabled=false
hook.pre-rebase.enabled=false
hook.post-checkout.enabled=false
hook.post-merge.enabled=false
hook.pre-push.enabled=false
hook.pre-receive.enabled=false
hook.update.enabled=false
hook.proc-receive.enabled=false
hook.post-receive.enabled=false
hook.post-update.enabled=false
hook.reference-transaction.enabled=false
hook.push-to-checkout.enabled=false
hook.pre-auto-gc.enabled=false
hook.post-rewrite.enabled=false
hook.sendemail-validate.enabled=false
hook.fsmonitor-watchman.enabled=false
hook.p4-changelist.enabled=false
hook.p4-prepare-changelist.enabled=false
hook.p4-post-changelist.enabled=false
hook.p4-pre-submit.enabled=false
hook.post-index-change.enabled=false
protocol.fd.allow=never
protocol.git.allow=never
protocol.ftp.allow=never
protocol.ftps.allow=never
init.defaultRefFormat=files
core.longpaths=true
credential.interactive=false
init.templateDir=`
    .split("\n")
    .flatMap((pair) => ["-c", pair]);
}

// The values every child gets on POSIX, besides PATH and the ceiling.
const POSIX_FORCED = {
  GIT_TERMINAL_PROMPT: "0",
  GIT_ASKPASS: "",
  GCM_INTERACTIVE: "never",
  GIT_LFS_SKIP_SMUDGE: "1",
  GIT_DEFAULT_REF_FORMAT: "files",
  GIT_NO_LAZY_FETCH: "1",
  GIT_NO_REPLACE_OBJECTS: "1",
  GIT_PROXY_COMMAND: "",
  LC_MESSAGES: "C",
} as const;

interface HostSetup {
  readonly platform?: NodeJS.Platform;
  /** The files that exist: executable on POSIX, present on Windows. */
  readonly files?: readonly string[];
  readonly realpaths?: Readonly<Record<string, string>>;
  readonly cwd?: string;
  readonly tmpdir?: string;
}

interface RecordingHost {
  readonly host: GitProcessHost;
  readonly files: Set<string>;
  readonly probes: string[];
  readonly groupSignals: Array<readonly [number, string]>;
  cwd: string;
}

function createHost(setup: HostSetup = {}): RecordingHost {
  const files = new Set(setup.files ?? ["/usr/bin/git"]);
  const probes: string[] = [];
  const groupSignals: Array<readonly [number, string]> = [];
  const probe = (file: string): Promise<boolean> => {
    probes.push(file);
    return Promise.resolve(files.has(file));
  };

  const recording: RecordingHost = {
    files,
    probes,
    groupSignals,
    cwd: setup.cwd ?? "/work/project",
    host: {
      platform: setup.platform ?? "linux",
      isFile: probe,
      isExecutable: probe,
      signalGroup: (pid, signal) => {
        groupSignals.push([pid, signal]);
      },
      realpath: (file) => Promise.resolve(setup.realpaths?.[file] ?? file),
      cwd: () => recording.cwd,
      tmpdir: () => setup.tmpdir ?? "/tmp",
    },
  };
  return recording;
}

interface StartedLauncher {
  readonly spawn: ProcessSpawn;
  /** Settles at the first launch, once the run watches its process. */
  readonly started: Promise<void>;
}

function startedLauncher(control: ProcessControl): StartedLauncher {
  let markStarted: () => void = () => undefined;
  const started = new Promise<void>((resolve) => {
    markStarted = resolve;
  });
  return {
    started,
    spawn: (command, args, options) => {
      const process = control.spawn(command, args, options);
      markStarted();
      return process;
    },
  };
}

interface FakeGit {
  readonly git: GitProcess;
  readonly control: ProcessControl;
  readonly started: Promise<void>;
  readonly host: RecordingHost;
}

function createFakeGit(
  env: NodeJS.ProcessEnv = { PATH: "/usr/bin" },
  setup: HostSetup = {},
): FakeGit {
  const control = createProcessFake(4242);
  const launcher = startedLauncher(control);
  const host = createHost(setup);
  const git = createGitProcess({
    spawn: launcher.spawn,
    host: host.host,
    env,
    killGraceMs: KILL_GRACE_MS,
  });
  return { git, control, started: launcher.started, host };
}

interface LaunchSequence {
  readonly spawn: ProcessSpawn;
  /** Settles at the launch with this index, once the run watches its process. */
  readonly at: (index: number) => Promise<ProcessControl>;
  readonly all: () => readonly ProcessLaunch[];
}

// Gives every launch its own fake process, so one run can start several.
function launchSequence(): LaunchSequence {
  const controls: ProcessControl[] = [];
  const waiting = new Map<number, (control: ProcessControl) => void>();
  const launched: ProcessLaunch[] = [];
  return {
    spawn: (command, args, options) => {
      const control = createProcessFake(4242 + controls.length);
      const process = control.spawn(command, args, options);
      launched.push([command, args, options]);
      waiting.get(controls.length)?.(control);
      controls.push(control);
      return process;
    },
    at: (index) =>
      new Promise((resolve) => {
        const control = controls[index];
        if (control === undefined) {
          waiting.set(index, resolve);
        } else {
          resolve(control);
        }
      }),
    all: () => [...launched],
  };
}

function createSequencedGit(setup: HostSetup = {}): {
  readonly git: GitProcess;
  readonly launches: LaunchSequence;
  readonly host: RecordingHost;
} {
  const launches = launchSequence();
  const host = createHost(setup);
  const git = createGitProcess({
    spawn: launches.spawn,
    host: host.host,
    env: { PATH: "/usr/bin" },
    killGraceMs: KILL_GRACE_MS,
  });
  return { git, launches, host };
}

interface ExpectedFailure {
  readonly failure: GitFailure;
  readonly operation: string;
  readonly exitCode: number | null;
  readonly stderr: string;
  readonly cause?: unknown;
}

function gitFailure(expected: ExpectedFailure): (error: unknown) => boolean {
  return (error) => {
    assert.ok(error instanceof GitCommandError);
    assert.deepStrictEqual(
      {
        failure: error.failure,
        operation: error.operation,
        exitCode: error.exitCode,
        stderr: error.stderr,
        cause: error.cause,
      },
      { cause: undefined, ...expected },
    );
    return true;
  };
}

async function caseDirectory(t: TestContext): Promise<string> {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), "pi-cm-git-process-")));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

// A script that records each run in its own file and prints `output`.
async function recordingScript(
  root: string,
  name: string,
  output: string,
): Promise<{ readonly script: string; readonly record: string }> {
  const script = path.join(root, name);
  const record = path.join(root, `${name}.ran`);
  await writeFile(script, `#!/bin/sh\necho ran >> '${record}'\n${output}\n`, { mode: 0o755 });
  return { script, record };
}

describe("createGitProcess", () => {
  test("D-SG-04: spawns the first absolute git on PATH with the hardened argv and the neutral directory", async () => {
    // arrange
    const { git, control, started, host } = createFakeGit(
      { PATH: "relative::/opt/tools:/usr/bin" },
      { realpaths: { "/tmp": "/private/tmp" } },
    );

    // act
    const pending = git.run(FILL);
    await started;
    control.writeStdout("username=x-access-token\npassword=token-1\n");
    control.close(0);
    const run = await pending;

    // assert
    assert.deepStrictEqual(run, {
      exitCode: 0,
      stdout: "username=x-access-token\npassword=token-1\n",
      stderr: "",
    });
    assert.deepStrictEqual(control.launches(), [
      [
        "/usr/bin/git",
        [...hardening("/dev/null"), "credential", "fill"],
        {
          cwd: "/private/tmp",
          env: {
            ...POSIX_FORCED,
            PATH: "/opt/tools:/usr/bin",
            GIT_CEILING_DIRECTORIES: "/private",
          },
          shell: false,
          stdio: ["pipe", "pipe", "pipe"],
          detached: true,
          windowsHide: true,
        },
      ],
    ]);
    assert.deepStrictEqual(host.probes, ["/opt/tools/git", "/usr/bin/git"]);
    assert.strictEqual(control.input(), FILL_INPUT);
    assert.strictEqual(control.inputEnded(), true);
  });

  test("SG-PRC-02, SG-PRC-03: forces the non-interactive values and keeps the user's git configuration", async () => {
    // arrange
    const base: NodeJS.ProcessEnv = {
      PATH: "relative::/opt/tools:/usr/bin",
      HOME: "/home/user",
      GIT_CONFIG_GLOBAL: "/home/user/.gitconfig",
      GIT_CONFIG_COUNT: "1",
      GIT_CONFIG_KEY_0: "credential.helper",
      GIT_CONFIG_VALUE_0: "store",
      GIT_CONFIG_PARAMETERS: "'user.name'='user'",
      SSH_AUTH_SOCK: "/run/user/agent.sock",
      HTTPS_PROXY: "http://proxy.test:3128",
      NO_PROXY: "localhost",
      GIT_TERMINAL_PROMPT: "1",
      GIT_ASKPASS: "/usr/bin/ksshaskpass",
      GCM_INTERACTIVE: "always",
      GIT_LFS_SKIP_SMUDGE: "0",
      GIT_DEFAULT_REF_FORMAT: "reftable",
      GIT_DIR: "/elsewhere/.git",
      GIT_WORK_TREE: "/elsewhere",
      GIT_COMMON_DIR: "/elsewhere/.git",
      GIT_INDEX_FILE: "/elsewhere/.git/index",
      GIT_DISCOVERY_ACROSS_FILESYSTEM: "1",
      GIT_OBJECT_DIRECTORY: "/elsewhere/.git/objects",
      GIT_ALTERNATE_OBJECT_DIRECTORIES: "/elsewhere/objects",
      GIT_SHALLOW_FILE: "/elsewhere/.git/shallow",
      GIT_NAMESPACE: "elsewhere",
      GIT_IMPLICIT_WORK_TREE: "0",
      GIT_REFERENCE_BACKEND: "reftable",
      GIT_TEMPLATE_DIR: "/elsewhere/templates",
      GIT_CEILING_DIRECTORIES: "/elsewhere",
      LC_ALL: "de_DE.UTF-8",
      LC_MESSAGES: "de_DE.UTF-8",
    };
    const unchangedBase = structuredClone(base);
    const { git, control, started } = createFakeGit(base, {
      realpaths: { "/tmp": "/private/tmp" },
    });

    // act
    const pending = git.run(FILL);
    await started;
    control.close(0);
    await pending;

    // assert
    assert.deepStrictEqual(control.launches()[0]?.[2].env, {
      ...POSIX_FORCED,
      PATH: "/opt/tools:/usr/bin",
      HOME: "/home/user",
      GIT_CONFIG_GLOBAL: "/home/user/.gitconfig",
      GIT_CONFIG_COUNT: "1",
      GIT_CONFIG_KEY_0: "credential.helper",
      GIT_CONFIG_VALUE_0: "store",
      GIT_CONFIG_PARAMETERS: "'user.name'='user'",
      SSH_AUTH_SOCK: "/run/user/agent.sock",
      HTTPS_PROXY: "http://proxy.test:3128",
      NO_PROXY: "localhost",
      GIT_CEILING_DIRECTORIES: "/private",
      LC_CTYPE: "de_DE.UTF-8",
    });
    assert.deepStrictEqual(base, unchangedBase);
  });

  test("SG-PRC-02: keeps the user's own proxy command, lazy-fetch, and replace-objects values", async () => {
    // arrange
    const { git, control, started } = createFakeGit({
      PATH: "/usr/bin",
      GIT_PROXY_COMMAND: "/usr/local/bin/proxy",
      GIT_NO_LAZY_FETCH: "0",
      GIT_NO_REPLACE_OBJECTS: "0",
    });

    // act
    const pending = git.run(FILL);
    await started;
    control.close(0);
    await pending;

    // assert
    assert.deepStrictEqual(control.launches()[0]?.[2].env, {
      ...POSIX_FORCED,
      PATH: "/usr/bin",
      GIT_PROXY_COMMAND: "/usr/local/bin/proxy",
      GIT_NO_LAZY_FETCH: "0",
      GIT_NO_REPLACE_OBJECTS: "0",
      GIT_CEILING_DIRECTORIES: "/",
    });
  });

  for (const { askpass, label } of [
    { askpass: undefined, label: "no GIT_ASKPASS" },
    { askpass: "", label: "an empty GIT_ASKPASS" },
    { askpass: "/usr/bin/ksshaskpass", label: "an askpass program" },
  ]) {
    test(`SG-PRC-02: gives git an empty GIT_ASKPASS for ${label}`, async () => {
      // arrange
      const { git, control, started } = createFakeGit({
        PATH: "/usr/bin",
        ...(askpass !== undefined && { GIT_ASKPASS: askpass }),
      });

      // act
      const pending = git.run(FILL);
      await started;
      control.close(0);
      await pending;

      // assert
      assert.strictEqual(control.launches()[0]?.[2].env.GIT_ASKPASS, "");
    });
  }

  test("SG-PRC-02: on Windows replaces every spelling of a forced variable and runs git.exe", async () => {
    // arrange
    const { git, control, started } = createFakeGit(
      { Path: '"C:\\Git\\cmd";relative', Git_Askpass: "x", git_terminal_prompt: "1" },
      {
        platform: "win32",
        files: [String.raw`C:\Git\cmd\git.exe`],
        cwd: String.raw`C:\work\project`,
        tmpdir: String.raw`C:\Users\user\AppData\Local\Temp`,
      },
    );

    // act
    const pending = git.run(FILL);
    await started;
    control.close(0);
    await pending;

    // assert
    assert.deepStrictEqual(control.launches(), [
      [
        String.raw`C:\Git\cmd\git.exe`,
        [...hardening(String.raw`\\.\NUL`), "credential", "fill"],
        {
          cwd: String.raw`C:\Users\user\AppData\Local\Temp`,
          env: {
            ...POSIX_FORCED,
            Path: String.raw`C:\Git\cmd`,
            GIT_CEILING_DIRECTORIES: String.raw`C:\Users\user\AppData\Local`,
          },
          shell: false,
          stdio: ["pipe", "pipe", "pipe"],
          detached: false,
          windowsHide: true,
        },
      ],
    ]);
  });

  for (const { launcher } of [{ launcher: "git.cmd" }, { launcher: "git.bat" }]) {
    test(`D-PL9-18: refuses a ${launcher} found first as git-missing`, async () => {
      // arrange
      const { git } = createFakeGit(
        { PATH: String.raw`C:\Git\cmd` },
        { platform: "win32", files: [path.win32.join(String.raw`C:\Git\cmd`, launcher)] },
      );

      // act & assert
      await assert.rejects(
        git.locate(),
        gitFailure({
          failure: { kind: "git-missing", detail: "batch-launcher" },
          operation: "lookup",
          exitCode: null,
          stderr: "",
        }),
      );
    });
  }

  for (const { label, pathValue, cwd, realpaths, expected } of [
    {
      label: "in the working directory",
      pathValue: String.raw`C:\work\project;C:\Git\cmd`,
      cwd: String.raw`C:\work\project`,
      realpaths: {},
      expected: String.raw`C:\Git\cmd\git.exe`,
    },
    {
      label: "below the working directory in another case",
      pathValue: String.raw`c:\WORK\Project\bin;C:\Git\cmd`,
      cwd: String.raw`C:\work\project`,
      realpaths: {},
      expected: String.raw`C:\Git\cmd\git.exe`,
    },
    {
      label: "whose real path lies in the working directory",
      pathValue: String.raw`C:\link\bin;C:\Git\cmd`,
      cwd: String.raw`C:\work\project`,
      realpaths: { [String.raw`C:\link\bin`]: String.raw`C:\work\project\bin` },
      expected: String.raw`C:\Git\cmd\git.exe`,
    },
    {
      label: "in the real path of the working directory",
      pathValue: String.raw`C:\work\project\bin;D:\Git\cmd`,
      cwd: String.raw`C:\short`,
      realpaths: { [String.raw`C:\short`]: String.raw`C:\work\project` },
      expected: String.raw`D:\Git\cmd\git.exe`,
    },
  ]) {
    test(`D-SG-04: skips a Windows git ${label} and runs a later one`, async () => {
      // arrange
      const directories = pathValue.split(";");
      const { git } = createFakeGit(
        { PATH: pathValue },
        {
          platform: "win32",
          files: directories.map((directory) => path.win32.join(directory, "git.exe")),
          cwd,
          realpaths,
        },
      );

      // act
      const found = await git.locate();

      // assert
      assert.strictEqual(found, expected);
    });
  }

  for (const { label, env, platform } of [
    { label: "an unset PATH", env: {}, platform: "linux" },
    { label: "an empty PATH", env: { PATH: "" }, platform: "linux" },
    { label: "an all-relative PATH", env: { PATH: "bin:.:" }, platform: "linux" },
    { label: "an unset Windows PATH", env: {}, platform: "win32" },
  ] as const) {
    test(`SG-PRC-06: gives git-missing for ${label} and spawns nothing`, async () => {
      // arrange
      const { git, control, host } = createFakeGit(env, { platform });

      // act & assert
      await assert.rejects(
        git.run(FILL),
        gitFailure({
          failure: { kind: "git-missing", detail: "not-found" },
          operation: "lookup",
          exitCode: null,
          stderr: "",
        }),
      );
      assert.deepStrictEqual(control.launches(), []);
      assert.deepStrictEqual(host.probes, []);
    });
  }

  test("NFR-2: finds a git installed after a lookup missed", async () => {
    // arrange
    const { git, host } = createFakeGit({ PATH: "/usr/bin" }, { files: [] });
    await assert.rejects(git.locate(), GitCommandError);
    host.files.add("/usr/bin/git");

    // act
    const found = await git.locate();

    // assert
    assert.strictEqual(found, "/usr/bin/git");
  });

  test("D-SG-04: does not probe a found git again for the same PATH and working directory", async () => {
    // arrange
    const { git, host } = createFakeGit({ PATH: "/opt/tools:/usr/bin" });
    await git.locate();

    // act
    const found = await git.locate();

    // assert
    assert.strictEqual(found, "/usr/bin/git");
    assert.deepStrictEqual(host.probes, ["/opt/tools/git", "/usr/bin/git"]);
  });

  test("D-SG-04: looks git up again for a different PATH", async () => {
    // arrange
    const env: NodeJS.ProcessEnv = { PATH: "/usr/bin" };
    const { git, host } = createFakeGit(env, { files: ["/usr/bin/git", "/opt/tools/git"] });
    await git.locate();
    env.PATH = "/opt/tools";

    // act
    const found = await git.locate();

    // assert
    assert.strictEqual(found, "/opt/tools/git");
    assert.deepStrictEqual(host.probes, ["/usr/bin/git", "/opt/tools/git"]);
  });

  test("D-SG-04: looks git up again for a different working directory", async () => {
    // arrange
    const { git, host } = createFakeGit();
    await git.locate();
    host.cwd = "/work/other";

    // act
    const found = await git.locate();

    // assert
    assert.strictEqual(found, "/usr/bin/git");
    assert.deepStrictEqual(host.probes, ["/usr/bin/git", "/usr/bin/git"]);
  });

  test("resolves a run that exits with 0 under a signal that never aborts", async () => {
    // arrange
    const { git, control, started } = createFakeGit();

    // act
    const pending = git.run({ ...FILL, signal: new AbortController().signal });
    await started;
    control.writeStdout("out");
    control.writeStderr("warning");
    control.close(0);
    const run = await pending;

    // assert
    assert.deepStrictEqual(run, { exitCode: 0, stdout: "out", stderr: "warning" });
  });

  test("resolves a run that exits with an allowed code", async () => {
    // arrange
    const { git, control, started } = createFakeGit();

    // act
    const pending = git.run({ ...FILL, allowExit: [1] });
    await started;
    control.writeStdout("listed");
    control.close(1);
    const run = await pending;

    // assert
    assert.deepStrictEqual(run, { exitCode: 1, stdout: "listed", stderr: "" });
  });

  for (const { label, allowExit, code } of [
    { label: "an exit without allowed codes", allowExit: undefined, code: 128 },
    { label: "an exit outside the allowed codes", allowExit: [1], code: 2 },
  ]) {
    test(`SG-PRC-05: rejects ${label} as failed with redacted stderr`, async () => {
      // arrange
      const { git, control, started } = createFakeGit();

      // act
      const pending = git.run({ ...FILL, ...(allowExit !== undefined && { allowExit }) });
      await started;
      control.writeStderr(
        "fatal: unexpected answer from 'https://user:secret@example.test/x.git/'\n",
      );
      control.close(code);

      // assert
      await assert.rejects(
        pending,
        gitFailure({
          failure: { kind: "failed" },
          operation: "credential fill",
          exitCode: code,
          stderr: "fatal: unexpected answer from 'https://***@example.test/x.git/'\n",
        }),
      );
    });
  }

  test("SG-PRC-05: rejects a run that closes without an exit code or stderr as no-stderr", async () => {
    // arrange
    const { git, control, started } = createFakeGit();

    // act
    const pending = git.run(FILL);
    await started;
    control.close(null);

    // assert
    await assert.rejects(
      pending,
      gitFailure({
        failure: { kind: "no-stderr" },
        operation: "credential fill",
        exitCode: null,
        stderr: "",
      }),
    );
  });

  test("SG-PRC-05: rejects a disallowed exit with the kind its C-locale stderr names", async () => {
    // arrange
    const { git, control, started } = createFakeGit();

    // act
    const pending = git.run(FILL);
    await started;
    control.writeStderr("fatal: transport 'ext' not allowed\n");
    control.close(128);

    // assert
    await assert.rejects(
      pending,
      gitFailure({
        failure: { kind: "protocol-refused" },
        operation: "credential fill",
        exitCode: 128,
        stderr: "fatal: transport 'ext' not allowed\n",
      }),
    );
  });

  test("D-SG-06: logs the git version once after a git-too-old failure", async (t) => {
    // arrange
    const logged = captureDebugLog(t);
    const { git, launches } = createSequencedGit({ realpaths: { "/tmp": "/private/tmp" } });

    // act
    const pending = git.run(FILL);
    const fill = await launches.at(0);
    fill.writeStderr("error: unknown option `no-such-flag'\n");
    fill.close(129);
    const version = await launches.at(1);
    version.writeStdout("git version 2.17.1\nextra\n");
    version.close(0);

    // assert
    await assert.rejects(
      pending,
      gitFailure({
        failure: { kind: "git-too-old" },
        operation: "credential fill",
        exitCode: 129,
        stderr: "error: unknown option `no-such-flag'\n",
      }),
    );
    assert.deepStrictEqual(logged, ["[git] git version: git version 2.17.1"]);
    assert.deepStrictEqual(
      launches.all().map(([command, args, options]) => [command, args, options.cwd]),
      [
        ["/usr/bin/git", [...hardening("/dev/null"), "credential", "fill"], "/private/tmp"],
        ["/usr/bin/git", [...hardening("/dev/null"), "version"], "/private/tmp"],
      ],
    );
  });

  test("D-SG-06: logs an unreadable version and keeps the git-too-old failure when the version read fails", async (t) => {
    // arrange
    const logged = captureDebugLog(t);
    const { git, launches } = createSequencedGit();

    // act
    const pending = git.run(FILL);
    const fill = await launches.at(0);
    fill.close(129);
    const version = await launches.at(1);
    version.writeStderr("error: unknown option `version'\n");
    version.close(129);

    // assert
    await assert.rejects(
      pending,
      gitFailure({
        failure: { kind: "git-too-old" },
        operation: "credential fill",
        exitCode: 129,
        stderr: "",
      }),
    );
    assert.deepStrictEqual(logged, ["[git] git version: unreadable"]);
    assert.strictEqual(launches.all().length, 2);
  });

  test("SG-PRC-01: rejects a run past its timeout with the limit after stopping its process tree", async (t) => {
    // arrange
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const { git, started, host } = createFakeGit();

    // act
    const pending = git.run({ ...FILL, timeoutMs: 50 });
    await started;
    t.mock.timers.tick(50);
    t.mock.timers.tick(KILL_GRACE_MS);
    t.mock.timers.tick(KILL_GRACE_MS);

    // assert
    await assert.rejects(
      pending,
      gitFailure({
        failure: { kind: "timeout", timeoutMs: 50 },
        operation: "credential fill",
        exitCode: null,
        stderr: "",
      }),
    );
    assert.deepStrictEqual(host.groupSignals, [
      [4242, "SIGTERM"],
      [4242, "SIGKILL"],
    ]);
  });

  test("rejects an already-aborted request before any lookup or spawn", async () => {
    // arrange
    const reason = new Error("cancelled");
    const controller = new AbortController();
    controller.abort(reason);
    const { git, control, host } = createFakeGit();

    // act & assert
    await assert.rejects(
      git.run({ ...FILL, signal: controller.signal }),
      gitFailure({
        failure: { kind: "aborted" },
        operation: "credential fill",
        exitCode: null,
        stderr: "",
        cause: reason,
      }),
    );
    assert.deepStrictEqual(control.launches(), []);
    assert.deepStrictEqual(host.probes, []);
  });

  test("rejects a run aborted while it runs as aborted after stopping its process tree", async (t) => {
    // arrange
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const reason = new Error("cancelled");
    const controller = new AbortController();
    const { git, started, host } = createFakeGit();

    // act
    const pending = git.run({ ...FILL, signal: controller.signal });
    await started;
    controller.abort(reason);
    t.mock.timers.tick(KILL_GRACE_MS);
    t.mock.timers.tick(KILL_GRACE_MS);

    // assert
    await assert.rejects(
      pending,
      gitFailure({
        failure: { kind: "aborted" },
        operation: "credential fill",
        exitCode: null,
        stderr: "",
        cause: reason,
      }),
    );
    assert.deepStrictEqual(host.groupSignals, [
      [4242, "SIGTERM"],
      [4242, "SIGKILL"],
    ]);
  });

  test("rejects a run whose launcher throws as failed with that error as cause", async () => {
    // arrange
    const launchError = new Error("spawn EACCES");
    const git = createGitProcess({
      spawn: () => {
        throw launchError;
      },
      host: createHost().host,
      env: { PATH: "/usr/bin" },
      killGraceMs: KILL_GRACE_MS,
    });

    // act & assert
    await assert.rejects(
      git.run(FILL),
      gitFailure({
        failure: { kind: "failed" },
        operation: "credential fill",
        exitCode: null,
        stderr: "",
        cause: launchError,
      }),
    );
  });

  test("E11: rejects with the filesystem error of a working directory that does not exist", async () => {
    // arrange
    const missing = Object.assign(new Error("ENOENT: no such file or directory"), {
      code: "ENOENT",
    });
    const { host, control } = createFakeGit();
    const git = createGitProcess({
      spawn: control.spawn,
      host: { ...host.host, realpath: () => Promise.reject(missing) },
      env: { PATH: "/usr/bin" },
      killGraceMs: KILL_GRACE_MS,
    });

    // act & assert
    await assert.rejects(git.run({ ...FILL, cwd: "/gone" }), (error: unknown) => {
      assert.strictEqual(error, missing);
      return true;
    });
    assert.deepStrictEqual(control.launches(), []);
  });

  test("SG-PRC-03: refuses a working directory whose parent holds the PATH delimiter", async () => {
    // arrange
    const { git, control } = createFakeGit({ PATH: "/usr/bin" }, { tmpdir: "/srv/a:b/tmp" });

    // act & assert
    await assert.rejects(
      git.run(FILL),
      gitFailure({
        failure: { kind: "refused-input" },
        operation: "credential fill",
        exitCode: null,
        stderr: "",
      }),
    );
    assert.deepStrictEqual(control.launches(), []);
  });

  test("SG-PRC-01: starts git with closed stdin in the real path of the request's directory", async () => {
    // arrange
    const { git, control, started } = createFakeGit(
      { PATH: "/usr/bin" },
      { realpaths: { "/work/clone": "/real/clone" } },
    );

    // act
    const pending = git.run({
      subcommand: "credential",
      lane: "network",
      cwd: "/work/clone",
      timeoutMs: 5_000,
    });
    await started;
    control.close(0);
    await pending;

    // assert
    assert.deepStrictEqual(control.launches(), [
      [
        "/usr/bin/git",
        [...hardening("/dev/null"), "credential"],
        {
          cwd: "/real/clone",
          env: { ...POSIX_FORCED, PATH: "/usr/bin", GIT_CEILING_DIRECTORIES: "/real" },
          shell: false,
          stdio: ["ignore", "pipe", "pipe"],
          detached: true,
          windowsHide: true,
        },
      ],
    ]);
  });

  for (const { label, configure } of [
    {
      label: "core.askPass",
      configure: (script: string) => ({ config: `[core]\n\taskPass = ${script}\n`, variables: {} }),
    },
    {
      label: "GIT_ASKPASS",
      configure: (script: string) => ({ config: "", variables: { GIT_ASKPASS: script } }),
    },
    {
      label: "SSH_ASKPASS",
      configure: (script: string) => ({ config: "", variables: { SSH_ASKPASS: script } }),
    },
  ]) {
    test(`E10: never runs the user's ${label} program during a credential lookup`, async (t) => {
      // arrange
      const root = await caseDirectory(t);
      const askpass = await recordingScript(root, "askpass", "echo fromaskpass");
      const { config, variables } = configure(askpass.script);
      const configPath = path.join(root, "gitconfig");
      await writeFile(configPath, config);
      const git = createGitProcess({
        spawn: NODE_SPAWN,
        host: { ...NODE_GIT_HOST, tmpdir: () => root },
        env: { ...hermeticGitEnvironment(root), GIT_CONFIG_GLOBAL: configPath, ...variables },
        killGraceMs: KILL_GRACE_MS,
      });

      // act
      const filled = git.run({ ...FILL, input: "protocol=https\nhost=example.test\n\n" });

      // assert
      await assert.rejects(filled, (error: unknown) => {
        assert.ok(error instanceof GitCommandError);
        assert.deepStrictEqual([error.kind, error.exitCode], ["https-auth", 128]);
        return true;
      });
      await assert.rejects(access(askpass.record), { code: "ENOENT" });
    });
  }

  test("SG-PRC-03: never consults the credential helper of a repository enclosing the neutral directory", async (t) => {
    // arrange
    const root = await caseDirectory(t);
    const repository = await createGitTestRepository(t, { boundary: "local" });
    const helper = await recordingScript(
      root,
      "helper",
      "echo username=fromhelper\necho password=fromhelper",
    );
    await repository.run("config", "credential.helper", `!${helper.script}`);
    const neutral = path.join(repository.dir, "neutral");
    await mkdir(neutral);
    const git = createGitProcess({
      spawn: NODE_SPAWN,
      host: { ...NODE_GIT_HOST, tmpdir: () => neutral },
      env: hermeticGitEnvironment(root),
      killGraceMs: KILL_GRACE_MS,
    });

    // act
    const filled = git.run({ ...FILL, input: "protocol=https\nhost=example.test\n\n" });

    // assert
    await assert.rejects(filled, (error: unknown) => {
      assert.ok(error instanceof GitCommandError);
      assert.deepStrictEqual([error.kind, error.exitCode], ["https-auth", 128]);
      return true;
    });
    await assert.rejects(access(helper.record), { code: "ENOENT" });
  });
});

describe("NODE_GIT_HOST", () => {
  for (const { label, mode, executable } of [
    { label: "an executable file", mode: 0o755, executable: true },
    { label: "a file without an execute bit", mode: 0o644, executable: false },
  ]) {
    test(`reports ${label} as executable: ${executable}`, async (t) => {
      // arrange
      const root = await caseDirectory(t);
      const file = path.join(root, "git");
      await writeFile(file, "#!/bin/sh\n", { mode });

      // act
      const found = await NODE_GIT_HOST.isExecutable(file);

      // assert
      assert.strictEqual(found, executable);
    });
  }

  for (const { label, entry } of [
    { label: "a directory", entry: "." },
    { label: "a missing path", entry: "missing" },
  ]) {
    test(`reports ${label} as not executable`, async (t) => {
      // arrange
      const root = await caseDirectory(t);

      // act
      const found = await NODE_GIT_HOST.isExecutable(path.join(root, entry));

      // assert
      assert.strictEqual(found, false);
    });
  }

  test("resolves a symbolic link to its real path", async (t) => {
    // arrange
    const root = await caseDirectory(t);
    await mkdir(path.join(root, "target"));
    await symlink(path.join(root, "target"), path.join(root, "link"));

    // act
    const resolved = await NODE_GIT_HOST.realpath(path.join(root, "link"));

    // assert
    assert.strictEqual(resolved, path.join(root, "target"));
  });

  test("reads Pi's working directory and the temporary directory", () => {
    // arrange
    const expected = [process.cwd(), tmpdir()];

    // act
    const directories = [NODE_GIT_HOST.cwd(), NODE_GIT_HOST.tmpdir()];

    // assert
    assert.deepStrictEqual(directories, expected);
  });
});

describe("NODE_GIT_SPAWN", () => {
  test("D-SG-01: is Node's own spawn", () => {
    // arrange
    const nodeLauncher: unknown = spawn;

    // act
    const productionLauncher: unknown = NODE_GIT_SPAWN;

    // assert
    assert.strictEqual(productionLauncher, nodeLauncher);
  });
});

describe("NODE_GIT_PROCESS", () => {
  test("D-SG-04: locates an absolute, executable git on this process's PATH", async () => {
    // act
    const found = await NODE_GIT_PROCESS.locate();

    // assert
    assert.deepStrictEqual(
      {
        absolute: path.isAbsolute(found),
        name: path.basename(found),
        executable: await NODE_GIT_HOST.isExecutable(found),
      },
      { absolute: true, name: "git", executable: true },
    );
  });
});

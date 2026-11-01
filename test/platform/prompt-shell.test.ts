import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, test } from "node:test";

import {
  NODE_PROMPT_SHELL_HOST,
  NODE_PROMPT_SHELL_SPAWN,
  bashMissingMessage,
  createPromptShellRunner,
  selectPromptShell,
} from "../../extensions/pi-claude-marketplace/platform/prompt-shell.ts";

import type { ShellRunResult } from "../../extensions/pi-claude-marketplace/domain/context-injection.ts";
import type {
  PromptShell,
  PromptShellChoice,
  PromptShellHost,
  PromptShellProcess,
  PromptShellSpawn,
  PromptShellSpawnOptions,
} from "../../extensions/pi-claude-marketplace/platform/prompt-shell.ts";

const TIMEOUT_MS = 1_000;
const KILL_GRACE_MS = 200;
const GIT_BASH = String.raw`C:\Program Files\Git\bin\bash.exe`;

// An output stream the case writes to by hand.
class ShellStream {
  readonly #listeners: Array<(chunk: Buffer) => void> = [];

  on(_event: "data", listener: (chunk: Buffer) => void): void {
    this.#listeners.push(listener);
  }

  write(bytes: Buffer): void {
    for (const listener of this.#listeners) {
      listener(bytes);
    }
  }
}

// A started process whose output and events the case drives by hand. It
// records the signals sent to the process alone.
class ShellProcess implements PromptShellProcess {
  readonly stdout = new ShellStream();
  readonly stderr = new ShellStream();
  readonly pid: number | undefined;
  readonly kills: NodeJS.Signals[] = [];
  readonly #closes: Array<(code: number | null) => void> = [];
  readonly #errors: Array<(error: Error) => void> = [];

  constructor(pid?: number) {
    this.pid = pid;
  }

  on(event: "close", listener: (code: number | null) => void): this;
  on(event: "error", listener: (error: Error) => void): this;
  on(
    event: "close" | "error",
    listener: ((code: number | null) => void) | ((error: Error) => void),
  ): this {
    if (event === "close") {
      this.#closes.push(listener as (code: number | null) => void);
    } else {
      this.#errors.push(listener as (error: Error) => void);
    }

    return this;
  }

  kill(signal: NodeJS.Signals): boolean {
    this.kills.push(signal);
    return true;
  }

  close(code: number | null): void {
    for (const listener of this.#closes) {
      listener(code);
    }
  }

  // Like Node's EventEmitter, an error nothing listens for throws.
  fail(error: Error): void {
    if (this.#errors.length === 0) {
      throw error;
    }

    for (const listener of this.#errors) {
      listener(error);
    }
  }
}

type GroupSignal = readonly [number, NodeJS.Signals];
type Launch = readonly [string, readonly string[], PromptShellSpawnOptions];

// A Linux host that records each group signal and probes no file.
function linuxHost(groupSignals: GroupSignal[] = [], env: NodeJS.ProcessEnv = {}): PromptShellHost {
  return {
    platform: "linux",
    env,
    isFile: () => assert.fail("a Linux host probes no file"),
    signalGroup: (pid, signal) => {
      groupSignals.push([pid, signal]);
    },
  };
}

// A Windows host whose file probe finds exactly `files`.
function windowsHost(env: NodeJS.ProcessEnv, files: readonly string[]): PromptShellHost {
  return {
    platform: "win32",
    env,
    isFile: (file) => files.includes(file),
    signalGroup: () => assert.fail("a Windows host signals no process group"),
  };
}

// A runner whose launcher records each launch and returns `shellProcess`.
function recordingRunner(
  shellProcess: ShellProcess,
  host: PromptShellHost,
  launches: Launch[] = [],
): ReturnType<typeof createPromptShellRunner> {
  return createPromptShellRunner({
    spawn: (file, args, options) => {
      launches.push([file, args, options]);
      return shellProcess;
    },
    host,
    timeoutMs: TIMEOUT_MS,
    killGraceMs: KILL_GRACE_MS,
  });
}

function bashRequest(signal?: AbortSignal) {
  const request = { command: "sleep 9", shell: "bash", cwd: "/work", env: {} } as const;
  return signal === undefined ? request : { ...request, signal };
}

describe("selectPromptShell", () => {
  for (const { platform, requested, env, shell } of [
    { platform: "linux", requested: undefined, env: {}, shell: "bash" },
    { platform: "linux", requested: "bash", env: {}, shell: "bash" },
    { platform: "linux", requested: "powershell", env: {}, shell: "bash" },
    { platform: "darwin", requested: "powershell", env: {}, shell: "bash" },
    {
      platform: "linux",
      requested: "powershell",
      env: { CLAUDE_CODE_USE_POWERSHELL_TOOL: "1" },
      shell: "powershell",
    },
    {
      platform: "linux",
      requested: "powershell",
      env: { CLAUDE_CODE_USE_POWERSHELL_TOOL: "TRUE" },
      shell: "powershell",
    },
    {
      platform: "linux",
      requested: "powershell",
      env: { CLAUDE_CODE_USE_POWERSHELL_TOOL: "0" },
      shell: "bash",
    },
    {
      platform: "linux",
      requested: "bash",
      env: { CLAUDE_CODE_USE_POWERSHELL_TOOL: "1" },
      shell: "bash",
    },
  ] satisfies ReadonlyArray<{
    platform: NodeJS.Platform;
    requested: string | undefined;
    env: NodeJS.ProcessEnv;
    shell: PromptShell;
  }>) {
    test(`D-CF1-02: on ${platform}, shell ${String(requested)} with ${JSON.stringify(env)} runs ${shell}`, () => {
      // arrange
      const host: PromptShellHost = { ...linuxHost([], env), platform };

      // act
      const selected = selectPromptShell(requested, host);

      // assert
      assert.deepStrictEqual(selected, { kind: "shell", shell });
    });
  }

  for (const { requested, env, files, shell } of [
    { requested: undefined, env: {}, files: [GIT_BASH], shell: "bash" },
    { requested: "powershell", env: {}, files: [GIT_BASH], shell: "bash" },
    {
      requested: "powershell",
      env: { CLAUDE_CODE_USE_POWERSHELL_TOOL: "true" },
      files: [GIT_BASH],
      shell: "powershell",
    },
    {
      requested: "powershell",
      env: { CLAUDE_CODE_USE_POWERSHELL_TOOL: "0" },
      files: [],
      shell: "powershell",
    },
    { requested: undefined, env: {}, files: [], shell: "powershell" },
    { requested: "sh", env: {}, files: [], shell: "powershell" },
  ] satisfies ReadonlyArray<{
    requested: string | undefined;
    env: NodeJS.ProcessEnv;
    files: readonly string[];
    shell: PromptShell;
  }>) {
    test(`D-CF1-02: on Windows with ${files.length} Git Bash, shell ${String(requested)} with ${JSON.stringify(env)} runs ${shell}`, () => {
      // arrange
      const host = windowsHost(env, files);

      // act
      const selected = selectPromptShell(requested, host);

      // assert
      assert.deepStrictEqual(selected, { kind: "shell", shell });
    });
  }

  for (const env of [{}, { CLAUDE_CODE_USE_POWERSHELL_TOOL: "1" }]) {
    test(`D-CF1-02: on Windows with no Git Bash, shell bash with ${JSON.stringify(env)} is refused as bash-missing`, () => {
      // arrange
      const host = windowsHost(env, []);
      const refusal: PromptShellChoice = { kind: "bash-missing" };

      // act
      const selected = selectPromptShell("bash", host);

      // assert
      assert.deepStrictEqual(selected, refusal);
    });
  }

  test("D-CF1-02: the bash-missing text is Claude Code's, naming the invocation", () => {
    // arrange
    const invocation = "/tools:deploy";

    // act
    const message = bashMissingMessage(invocation);

    // assert
    assert.strictEqual(
      message,
      "Skill /tools:deploy requires bash (`shell: bash` in frontmatter) but Git Bash was not " +
        "found. Install Git for Windows (https://git-scm.com/downloads/win), or change the " +
        "skill's frontmatter to `shell: powershell`.",
    );
  });
});

describe("createPromptShellRunner", () => {
  test("D-CF1-02: runs a Bash command as bash -c with no shell, piped output, and its own process group", async () => {
    // arrange
    const shellProcess = new ShellProcess(4242);
    const launches: Launch[] = [];
    const groupSignals: GroupSignal[] = [];
    const runPromptShell = recordingRunner(shellProcess, linuxHost(groupSignals), launches);

    // act
    const pending = runPromptShell({
      command: "git status",
      shell: "bash",
      cwd: "/work",
      env: { HOME: "/home/user" },
    });
    shellProcess.stdout.write(Buffer.from("clean\n"));
    shellProcess.stderr.write(Buffer.from("note\n"));
    shellProcess.close(0);
    const run: ShellRunResult = await pending;

    // assert
    assert.deepStrictEqual(run, {
      kind: "exited",
      code: 0,
      stdout: "clean\n",
      stderr: "note\n",
      shell: "bash",
    });
    assert.deepStrictEqual(launches, [
      [
        "bash",
        ["-c", "git status"],
        {
          cwd: "/work",
          env: { HOME: "/home/user" },
          shell: false,
          stdio: ["ignore", "pipe", "pipe"],
          detached: true,
        },
      ],
    ]);
    assert.deepStrictEqual(groupSignals, []);
  });

  for (const { where, host, shell, file, args, detached } of [
    {
      where: "Linux",
      host: linuxHost(),
      shell: "powershell",
      file: "pwsh",
      args: ["-NoProfile", "-Command", "Get-Date"],
      detached: true,
    },
    {
      where: "Windows",
      host: windowsHost({}, [GIT_BASH]),
      shell: "powershell",
      file: "powershell.exe",
      args: ["-NoProfile", "-Command", "Get-Date"],
      detached: false,
    },
    {
      where: "Windows",
      host: windowsHost({}, [GIT_BASH]),
      shell: "bash",
      file: GIT_BASH,
      args: ["-c", "Get-Date"],
      detached: false,
    },
  ] satisfies ReadonlyArray<{
    where: string;
    host: PromptShellHost;
    shell: PromptShell;
    file: string;
    args: readonly string[];
    detached: boolean;
  }>) {
    test(`D-CF1-02: on ${where}, launches ${shell} as ${file} ${args.slice(0, -1).join(" ")}`, async () => {
      // arrange
      const shellProcess = new ShellProcess(4242);
      const launches: Launch[] = [];
      const runPromptShell = recordingRunner(shellProcess, host, launches);

      // act
      const pending = runPromptShell({ command: "Get-Date", shell, cwd: "/work", env: {} });
      shellProcess.close(0);
      const run = await pending;

      // assert
      assert.deepStrictEqual(run, { kind: "exited", code: 0, stdout: "", stderr: "", shell });
      assert.deepStrictEqual(launches, [
        [
          file,
          args,
          { cwd: "/work", env: {}, shell: false, stdio: ["ignore", "pipe", "pipe"], detached },
        ],
      ]);
    });
  }

  for (const { found, env, files, file } of [
    {
      found: "the CLAUDE_CODE_GIT_BASH_PATH bash",
      env: { CLAUDE_CODE_GIT_BASH_PATH: String.raw`D:\tools\BASH.EXE` },
      files: [String.raw`D:\tools\BASH.EXE`, GIT_BASH],
      file: String.raw`D:\tools\BASH.EXE`,
    },
    {
      found: "the standard Git Bash when CLAUDE_CODE_GIT_BASH_PATH names no bash or sh",
      env: { CLAUDE_CODE_GIT_BASH_PATH: String.raw`D:\tools\zsh.exe` },
      files: [String.raw`D:\tools\zsh.exe`, GIT_BASH],
      file: GIT_BASH,
    },
    {
      found: "the 32-bit Git Bash when CLAUDE_CODE_GIT_BASH_PATH is missing",
      env: { CLAUDE_CODE_GIT_BASH_PATH: String.raw`D:\tools\sh` },
      files: [String.raw`C:\Program Files (x86)\Git\bin\bash.exe`],
      file: String.raw`C:\Program Files (x86)\Git\bin\bash.exe`,
    },
    {
      found: "the bash beside the git on PATH",
      env: { Path: String.raw`tools;"D:\Git\cmd"` },
      files: [String.raw`D:\Git\cmd\git.exe`, String.raw`D:\Git\bin\bash.exe`],
      file: String.raw`D:\Git\bin\bash.exe`,
    },
    {
      found: "bash from PATH when no Git Bash is known",
      env: { PATH: String.raw`D:\Git\cmd` },
      files: [String.raw`D:\Git\cmd\git.exe`],
      file: "bash",
    },
  ]) {
    test(`D-CF1-02: on Windows, runs Bash with ${found}`, async () => {
      // arrange
      const shellProcess = new ShellProcess(4242);
      const launches: Launch[] = [];
      const runPromptShell = recordingRunner(shellProcess, windowsHost(env, files), launches);

      // act
      const pending = runPromptShell({ command: "pwd", shell: "bash", cwd: "/work", env: {} });
      shellProcess.close(0);
      await pending;

      // assert
      assert.deepStrictEqual(
        launches.map(([launched]) => launched),
        [file],
      );
    });
  }

  test("D-CF1-02: decodes a character split across output chunks whole", async () => {
    // arrange
    const shellProcess = new ShellProcess(4242);
    const runPromptShell = recordingRunner(shellProcess, linuxHost());
    const bytes = Buffer.from("é€");

    // act
    const pending = runPromptShell(bashRequest());
    shellProcess.stdout.write(bytes.subarray(0, 1));
    shellProcess.stdout.write(bytes.subarray(1, 3));
    shellProcess.stderr.write(bytes.subarray(0, 4));
    shellProcess.stderr.write(bytes.subarray(4));
    shellProcess.close(1);
    const run = await pending;

    // assert
    assert.deepStrictEqual(run, {
      kind: "exited",
      code: 1,
      stdout: "é\uFFFD",
      stderr: "é€",
      shell: "bash",
    });
  });

  test("D-CF1-02: stops a run past its timeout with SIGTERM, then SIGKILL, to its process group", async (t) => {
    // arrange
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const shellProcess = new ShellProcess(4242);
    const groupSignals: GroupSignal[] = [];
    const runPromptShell = recordingRunner(shellProcess, linuxHost(groupSignals));

    // act
    const pending = runPromptShell(bashRequest());
    t.mock.timers.tick(TIMEOUT_MS - 1);
    const beforeTimeout = [...groupSignals];
    t.mock.timers.tick(1);
    const atTimeout = [...groupSignals];
    t.mock.timers.tick(KILL_GRACE_MS);
    const run = await pending;

    // assert
    assert.deepStrictEqual(run, { kind: "interrupted" });
    assert.deepStrictEqual(beforeTimeout, []);
    assert.deepStrictEqual(atTimeout, [[4242, "SIGTERM"]]);
    assert.deepStrictEqual(groupSignals, [
      [4242, "SIGTERM"],
      [4242, "SIGKILL"],
    ]);
    assert.deepStrictEqual(shellProcess.kills, []);
  });

  test("D-CF1-02: still sends SIGKILL to the group when the shell closes after SIGTERM", async (t) => {
    // arrange
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const shellProcess = new ShellProcess(4242);
    const groupSignals: GroupSignal[] = [];
    const runPromptShell = recordingRunner(shellProcess, linuxHost(groupSignals));

    // act
    const pending = runPromptShell(bashRequest());
    t.mock.timers.tick(TIMEOUT_MS);
    shellProcess.close(null);
    t.mock.timers.tick(KILL_GRACE_MS);
    const run = await pending;

    // assert
    assert.deepStrictEqual(run, { kind: "interrupted" });
    assert.deepStrictEqual(groupSignals, [
      [4242, "SIGTERM"],
      [4242, "SIGKILL"],
    ]);
  });

  test("D-CF1-02: stops a run within 120 seconds and a 2-second grace by default", async (t) => {
    // arrange
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const shellProcess = new ShellProcess(4242);
    const groupSignals: GroupSignal[] = [];
    const runPromptShell = createPromptShellRunner({
      spawn: () => shellProcess,
      host: linuxHost(groupSignals),
    });

    // act
    const pending = runPromptShell(bashRequest());
    t.mock.timers.tick(119_999);
    const beforeTimeout = [...groupSignals];
    t.mock.timers.tick(1);
    t.mock.timers.tick(1_999);
    const beforeKill = [...groupSignals];
    t.mock.timers.tick(1);
    const run = await pending;

    // assert
    assert.deepStrictEqual(run, { kind: "interrupted" });
    assert.deepStrictEqual(beforeTimeout, []);
    assert.deepStrictEqual(beforeKill, [[4242, "SIGTERM"]]);
    assert.deepStrictEqual(groupSignals, [
      [4242, "SIGTERM"],
      [4242, "SIGKILL"],
    ]);
  });

  test("D-CF1-02: sends no signal after a run that ended before its timeout", async (t) => {
    // arrange
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const shellProcess = new ShellProcess(4242);
    const groupSignals: GroupSignal[] = [];
    const runPromptShell = recordingRunner(shellProcess, linuxHost(groupSignals));

    // act
    const pending = runPromptShell(bashRequest());
    shellProcess.close(0);
    const run = await pending;
    t.mock.timers.tick(TIMEOUT_MS + KILL_GRACE_MS);

    // assert
    assert.deepStrictEqual(run, { kind: "exited", code: 0, stdout: "", stderr: "", shell: "bash" });
    assert.deepStrictEqual(groupSignals, []);
  });

  test("D-CF1-02: stops a run whose operation is cancelled the same way", async (t) => {
    // arrange
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const controller = new AbortController();
    const shellProcess = new ShellProcess(4242);
    const groupSignals: GroupSignal[] = [];
    const runPromptShell = recordingRunner(shellProcess, linuxHost(groupSignals));

    // act
    const pending = runPromptShell(bashRequest(controller.signal));
    controller.abort();
    const atAbort = [...groupSignals];
    t.mock.timers.tick(KILL_GRACE_MS);
    const run = await pending;

    // assert
    assert.deepStrictEqual(run, { kind: "interrupted" });
    assert.deepStrictEqual(atAbort, [[4242, "SIGTERM"]]);
    assert.deepStrictEqual(groupSignals, [
      [4242, "SIGTERM"],
      [4242, "SIGKILL"],
    ]);
  });

  test("D-CF1-02: sends no second SIGTERM when the operation is cancelled after the timeout", async (t) => {
    // arrange
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const controller = new AbortController();
    const shellProcess = new ShellProcess(4242);
    const groupSignals: GroupSignal[] = [];
    const runPromptShell = recordingRunner(shellProcess, linuxHost(groupSignals));

    // act
    const pending = runPromptShell(bashRequest(controller.signal));
    t.mock.timers.tick(TIMEOUT_MS);
    controller.abort();
    t.mock.timers.tick(KILL_GRACE_MS);
    const run = await pending;

    // assert
    assert.deepStrictEqual(run, { kind: "interrupted" });
    assert.deepStrictEqual(groupSignals, [
      [4242, "SIGTERM"],
      [4242, "SIGKILL"],
    ]);
  });

  test("D-CF1-02: starts no process for an operation that was already cancelled", async () => {
    // arrange
    const controller = new AbortController();
    controller.abort();
    const runPromptShell = createPromptShellRunner({
      spawn: () => assert.fail("a cancelled operation started a process"),
      host: linuxHost(),
    });

    // act
    const run = await runPromptShell(bashRequest(controller.signal));

    // assert
    assert.deepStrictEqual(run, { kind: "interrupted" });
  });

  for (const { why, pid, host } of [
    {
      why: "the group signal fails",
      pid: 4242,
      host: {
        ...linuxHost(),
        signalGroup: () => {
          throw new Error("kill ESRCH");
        },
      },
    },
    { why: "the pid could name Pi's own group", pid: 1, host: linuxHost() },
    { why: "the host is Windows", pid: 4242, host: windowsHost({}, []) },
  ]) {
    test(`D-CF1-02: signals the process alone when ${why}`, async (t) => {
      // arrange
      t.mock.timers.enable({ apis: ["setTimeout"] });
      const shellProcess = new ShellProcess(pid);
      const runPromptShell = recordingRunner(shellProcess, host);

      // act
      const pending = runPromptShell(bashRequest());
      t.mock.timers.tick(TIMEOUT_MS);
      t.mock.timers.tick(KILL_GRACE_MS);
      const run = await pending;

      // assert
      assert.deepStrictEqual(run, { kind: "interrupted" });
      assert.deepStrictEqual(shellProcess.kills, ["SIGTERM", "SIGKILL"]);
    });
  }

  test("D-CF1-02: resolves a launcher that throws as a run that did not start", async () => {
    // arrange
    const launcher: PromptShellSpawn = () => {
      throw new Error("spawn EINVAL");
    };

    const runPromptShell = createPromptShellRunner({ spawn: launcher, host: linuxHost() });

    // act
    const run = await runPromptShell(bashRequest());

    // assert
    assert.deepStrictEqual(run, { kind: "not-started", message: "spawn EINVAL" });
  });

  test("D-CF1-02: resolves a process that reports a start error as a run that did not start", async () => {
    // arrange
    const shellProcess = new ShellProcess();
    const runPromptShell = recordingRunner(shellProcess, linuxHost());

    // act
    const pending = runPromptShell(bashRequest());
    shellProcess.fail(new Error("spawn bash ENOENT"));
    shellProcess.close(-2);
    const run = await pending;

    // assert
    assert.deepStrictEqual(run, { kind: "not-started", message: "spawn bash ENOENT" });
  });

  test("D-CF1-02: keeps waiting for a running process that reports an error", async () => {
    // arrange
    const shellProcess = new ShellProcess(4242);
    const runPromptShell = recordingRunner(shellProcess, linuxHost());

    // act
    const pending = runPromptShell(bashRequest());
    shellProcess.fail(new Error("kill EPERM"));
    shellProcess.close(3);
    const run = await pending;

    // assert
    assert.deepStrictEqual(run, { kind: "exited", code: 3, stdout: "", stderr: "", shell: "bash" });
  });
});

describe("NODE_PROMPT_SHELL_SPAWN", () => {
  test("is Node's own spawn", () => {
    // arrange
    const nodeLauncher: unknown = spawn;

    // act
    const productionLauncher: unknown = NODE_PROMPT_SHELL_SPAWN;

    // assert
    assert.strictEqual(productionLauncher, nodeLauncher);
  });
});

describe("NODE_PROMPT_SHELL_HOST", () => {
  test("reads this process's platform and live environment", () => {
    // arrange
    const expectedHost = { platform: process.platform, env: process.env };

    // act
    const { platform, env } = NODE_PROMPT_SHELL_HOST;

    // assert
    assert.deepStrictEqual({ platform, env }, expectedHost);
    assert.strictEqual(env, process.env);
  });

  test("finds a file and rejects a directory or a missing path", async (t) => {
    // arrange
    const directory = await mkdtemp(path.join(tmpdir(), "prompt-shell-host-"));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const file = path.join(directory, "bash.exe");
    await writeFile(file, "");

    // act
    const probes = [file, directory, path.join(directory, "missing")].map(
      NODE_PROMPT_SHELL_HOST.isFile,
    );

    // assert
    assert.deepStrictEqual(probes, [true, false, false]);
  });

  test("signals a process group through process.kill with the negated pid", (t) => {
    // arrange
    const killSpy = t.mock.method(process, "kill", () => true);

    // act
    NODE_PROMPT_SHELL_HOST.signalGroup(4242, "SIGTERM");

    // assert
    assert.deepStrictEqual(
      killSpy.mock.calls.map((call) => call.arguments),
      [[-4242, "SIGTERM"]],
    );
  });
});

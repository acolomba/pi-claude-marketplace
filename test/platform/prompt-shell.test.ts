import assert from "node:assert/strict";
import test from "node:test";

import { createPromptShellRunner } from "../../extensions/pi-claude-marketplace/platform/prompt-shell.ts";

import type {
  PromptShellHost,
  PromptShellProcess,
  PromptShellSpawnOptions,
} from "../../extensions/pi-claude-marketplace/platform/prompt-shell.ts";

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

// A started process whose output and events the case drives by hand.
class ShellProcess implements PromptShellProcess {
  readonly stdout = new ShellStream();
  readonly stderr = new ShellStream();
  readonly pid: number | undefined;
  readonly #closes: Array<(code: number | null) => void> = [];

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
    }

    return this;
  }

  kill(): boolean {
    return true;
  }

  close(code: number | null): void {
    for (const listener of this.#closes) {
      listener(code);
    }
  }
}

function linuxHost(): PromptShellHost {
  return {
    platform: "linux",
    env: {},
    isFile: () => assert.fail("a Linux launch probes no file"),
    signalGroup: () => assert.fail("a run that ends by itself signals no group"),
  };
}

test("D-CF1-02: runs a Bash command as bash -c with no shell, piped output, and its own process group", async () => {
  // arrange
  const shellProcess = new ShellProcess(4242);
  const launches: Array<readonly [string, readonly string[], PromptShellSpawnOptions]> = [];
  const runPromptShell = createPromptShellRunner({
    spawn: (command, args, options) => {
      launches.push([command, args, options]);
      return shellProcess;
    },
    host: linuxHost(),
  });

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
  const run = await pending;

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
});

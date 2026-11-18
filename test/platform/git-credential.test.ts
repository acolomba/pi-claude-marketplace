import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { describe, test } from "node:test";

import {
  NODE_CREDENTIAL_SPAWN,
  NODE_GITHUB_CLI_SPAWN,
  createCredentialOps,
  type CredentialOps,
  type GitHubCliProcess,
  type GitHubCliSpawn,
  type GitHubCliSpawnOptions,
} from "../../extensions/pi-claude-marketplace/platform/git-credential.ts";
import { setGitHubBaseUrl } from "../shared/github-base-url-environment.ts";

import { registerCredentialOpsContract } from "./credential-ops-contract.ts";
import { createCredentialProcessFake } from "./credential-process-fake.ts";

import type { CredentialSpawn } from "../../extensions/pi-claude-marketplace/platform/git-credential.ts";
import type * as GitCredentialPlatform from "../../extensions/pi-claude-marketplace/platform/git-credential.ts";
import type { GitCredentials } from "../../extensions/pi-claude-marketplace/platform/git.ts";

/** The timeout `orchestrators/auth-host.ts` binds into the production ops. */
const DEFAULT_TIMEOUT_MS = 5_000;

// The one concrete binding of this protocol lives in
// `orchestrators/auth-host.ts`, which supplies the launcher and the timeout
// explicitly; this module publishes the protocol and its collaborators only.
// Restoring the export makes the `satisfies` resolve and turns the directive
// below into an unused one (TS2578).
// @ts-expect-error platform/git-credential.ts does not expose a composed default
void ({} satisfies { readonly retired?: typeof GitCredentialPlatform.DEFAULT_CREDENTIAL_OPS });

void ({
  fill: () => Promise.resolve(null),
  approve: () => Promise.resolve(),
  reject: () => Promise.resolve(),
} satisfies CredentialOps);

function manualCredentialProcess() {
  return createCredentialProcessFake({ onInput: () => {} });
}

interface GitHubCliProcessControl {
  readonly command: string;
  readonly args: readonly string[];
  readonly options: GitHubCliSpawnOptions;
  close(code: number | null): void;
  fail(error: Error): void;
  terminations(): readonly "SIGTERM"[];
  writeOutput(output: string): void;
}

function manualGitHubCliProcess(): {
  readonly spawn: GitHubCliSpawn;
  invocations(): readonly GitHubCliProcessControl[];
  waitForProcess(index?: number): Promise<GitHubCliProcessControl>;
} {
  const processes: GitHubCliProcessControl[] = [];
  const waiters = new Map<number, Array<(control: GitHubCliProcessControl) => void>>();
  const spawnGh: GitHubCliSpawn = (command, args, options) => {
    const stdoutListeners: Array<(chunk: Buffer) => void> = [];
    const errorListeners: Array<(error: Error) => void> = [];
    const closeListeners: Array<(code: number | null) => void> = [];
    const signals: "SIGTERM"[] = [];

    const control: GitHubCliProcessControl = {
      command,
      args: [...args],
      options: {
        env: { ...options.env },
        shell: options.shell,
        stdio: [...options.stdio],
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
      terminations: () => [...signals],
      writeOutput: (output) => {
        const chunk = Buffer.from(output);
        for (const listener of stdoutListeners) {
          listener(chunk);
        }
      },
    };

    const child: GitHubCliProcess = {
      stdout: {
        on: (_event, listener) => {
          stdoutListeners.push(listener);
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
    };

    const index = processes.length;
    processes.push(control);
    for (const resolve of waiters.get(index) ?? []) {
      resolve(control);
    }

    waiters.delete(index);
    return child;
  };

  return {
    spawn: spawnGh,
    invocations: () => [...processes],
    waitForProcess: (index = 0) => {
      const existing = processes[index];
      if (existing !== undefined) {
        return Promise.resolve(existing);
      }

      return new Promise((resolve) => {
        const list = waiters.get(index) ?? [];
        list.push(resolve);
        waiters.set(index, list);
      });
    },
  };
}

function credentialAttributes(input: string): Record<string, string> {
  return Object.fromEntries(
    input
      .split("\n")
      .filter((line) => line.includes("="))
      .map((line) => {
        const separator = line.indexOf("=");
        return [line.slice(0, separator), line.slice(separator + 1)];
      }),
  );
}

function credentialsMatch(left: GitCredentials, right: GitCredentials): boolean {
  return left.username === right.username && left.password === right.password;
}

function createProductionCredentialOps(): CredentialOps {
  const credentials = new Map<string, GitCredentials>();
  const processes = createCredentialProcessFake({
    onInput: (process) => {
      const attributes = credentialAttributes(process.input());
      const host = attributes.host;
      if (attributes.protocol !== "https" || host === undefined) {
        throw new Error("Credential process received an invalid attribute block");
      }

      if (process.subcommand === "fill") {
        const credential = credentials.get(host);
        if (credential === undefined) {
          process.close(1);
          return;
        }

        process.writeOutput(`username=${credential.username}\npassword=${credential.password}\n`);
        process.close(0);
        return;
      }

      const credential: GitCredentials = {
        ...(attributes.username !== undefined && { username: attributes.username }),
        ...(attributes.password !== undefined && { password: attributes.password }),
      };
      if (process.subcommand === "approve") {
        credentials.set(host, structuredClone(credential));
      } else {
        const stored = credentials.get(host);
        if (stored !== undefined && credentialsMatch(stored, credential)) {
          credentials.delete(host);
        }
      }

      process.close(0);
    },
  });

  return createCredentialOps({ spawn: processes.spawn, timeoutMs: DEFAULT_TIMEOUT_MS });
}

describe("createCredentialOps", () => {
  registerCredentialOpsContract(createProductionCredentialOps);

  test("runs the real Node launcher for the production credential subprocess", () => {
    // arrange
    const nodeLauncher: unknown = spawn;

    // act
    const productionLauncher: unknown = NODE_CREDENTIAL_SPAWN;

    // assert
    assert.strictEqual(productionLauncher, nodeLauncher);
  });

  test("runs the real Node launcher for the production gh CLI subprocess", () => {
    // arrange
    const nodeLauncher: unknown = spawn;

    // act
    const productionLauncher: unknown = NODE_GITHUB_CLI_SPAWN;

    // assert
    assert.strictEqual(productionLauncher, nodeLauncher);
  });

  test("binds the collaborators without launching a process", () => {
    // arrange
    const launches: Array<readonly [string, readonly string[]]> = [];
    const recordingLauncher: CredentialSpawn = (command, args) => {
      launches.push([command, args]);
      throw new Error("construction must not launch a credential subprocess");
    };

    // act
    const credentialOps = createCredentialOps({
      spawn: recordingLauncher,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });

    // assert
    assert.deepStrictEqual(Object.keys(credentialOps), ["fill", "approve", "reject"]);
    assert.deepStrictEqual(launches, []);
  });

  test("fills a credential from the complete git wire response", async () => {
    // arrange
    const processes = manualCredentialProcess();
    const credentialOps = createCredentialOps({
      spawn: processes.spawn,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });

    // act
    const pendingCredential = credentialOps.fill("github.com");
    const process = processes.process();
    process.writeOutput("ignored\n=missing-key\nusername=x-access-token\r\n");
    process.writeOutput("password=token-1\r\n\n");
    process.failInput(new Error("closed input"));
    process.close(0);
    const credential = await pendingCredential;

    // assert
    assert.deepStrictEqual(credential, {
      username: "x-access-token",
      password: "token-1",
    });
    assert.strictEqual(process.command, "git");
    assert.deepStrictEqual(process.args, ["credential", "fill"]);
    assert.strictEqual(process.options.env.GIT_TERMINAL_PROMPT, "0");
    assert.strictEqual(process.options.env.GCM_INTERACTIVE, "never");
    assert.deepStrictEqual(process.options.stdio, ["pipe", "pipe", "pipe"]);
    assert.strictEqual(process.input(), "protocol=https\nhost=github.com\n\n");
    assert.strictEqual(process.inputEnded(), true);
  });

  for (const { exitCode, behavior } of [
    { behavior: "returns null for a non-zero exit", exitCode: 128 },
    { behavior: "returns null when the process closes without an exit code", exitCode: null },
  ]) {
    test(behavior, async () => {
      // arrange
      const processes = manualCredentialProcess();
      const credentialOps = createCredentialOps({
        spawn: processes.spawn,
        timeoutMs: DEFAULT_TIMEOUT_MS,
      });

      // act
      const pendingCredential = credentialOps.fill("github.com");
      processes.process().close(exitCode);
      const credential = await pendingCredential;

      // assert
      assert.strictEqual(credential, null);
    });
  }

  for (const { output, behavior } of [
    { behavior: "returns null without a username", output: "password=token-1\n" },
    { behavior: "returns null without a password", output: "username=x-access-token\n" },
  ]) {
    test(behavior, async () => {
      // arrange
      const processes = manualCredentialProcess();
      const credentialOps = createCredentialOps({
        spawn: processes.spawn,
        timeoutMs: DEFAULT_TIMEOUT_MS,
      });

      // act
      const pendingCredential = credentialOps.fill("github.com");
      const process = processes.process();
      process.writeOutput(output);
      process.close(0);
      const credential = await pendingCredential;

      // assert
      assert.strictEqual(credential, null);
    });
  }

  test("returns null and clears the timeout when the fill process fails", async (t) => {
    // arrange
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const processes = manualCredentialProcess();
    const credentialOps = createCredentialOps({ spawn: processes.spawn, timeoutMs: 50 });

    // act
    const pendingCredential = credentialOps.fill("github.com");
    const process = processes.process();
    process.fail(new Error("git unavailable"));
    const credential = await pendingCredential;
    t.mock.timers.tick(50);

    // assert
    assert.strictEqual(credential, null);
    assert.deepStrictEqual(process.terminations(), []);
  });

  test("terminates a timed-out fill and returns null", async (t) => {
    // arrange
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const processes = manualCredentialProcess();
    const credentialOps = createCredentialOps({ spawn: processes.spawn, timeoutMs: 50 });

    // act
    const pendingCredential = credentialOps.fill("github.com");
    t.mock.timers.tick(50);
    const credential = await pendingCredential;

    // assert
    assert.strictEqual(credential, null);
    assert.deepStrictEqual(processes.process().terminations(), ["SIGTERM"]);
  });

  test("clears the timeout after a successful fill", async (t) => {
    // arrange
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const processes = manualCredentialProcess();
    const credentialOps = createCredentialOps({ spawn: processes.spawn, timeoutMs: 50 });

    // act
    const pendingCredential = credentialOps.fill("github.com");
    const process = processes.process();
    process.writeOutput("username=x-access-token\npassword=token-1\n");
    process.close(0);
    const credential = await pendingCredential;
    t.mock.timers.tick(50);

    // assert
    assert.deepStrictEqual(credential, {
      username: "x-access-token",
      password: "token-1",
    });
    assert.deepStrictEqual(process.terminations(), []);
  });

  test("approves a complete credential with the complete wire request", async () => {
    // arrange
    const processes = manualCredentialProcess();
    const credentialOps = createCredentialOps({
      spawn: processes.spawn,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });

    // act
    const approved = credentialOps.approve("github.com", {
      username: "x-access-token",
      password: "token-1",
    });
    const process = processes.process();
    process.close(0);
    await approved;

    // assert
    assert.deepStrictEqual(process.args, ["credential", "approve"]);
    assert.strictEqual(
      process.input(),
      "protocol=https\nhost=github.com\nusername=x-access-token\npassword=token-1\n\n",
    );
    assert.strictEqual(process.inputEnded(), true);
  });

  test("omits absent credential fields from an approve request", async () => {
    // arrange
    const processes = manualCredentialProcess();
    const credentialOps = createCredentialOps({
      spawn: processes.spawn,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });

    // act
    const approved = credentialOps.approve("github.com", {});
    const process = processes.process();
    process.close(0);
    await approved;

    // assert
    assert.strictEqual(process.input(), "protocol=https\nhost=github.com\n\n");
  });

  test("rejects a credential with the complete wire request", async () => {
    // arrange
    const processes = manualCredentialProcess();
    const credentialOps = createCredentialOps({
      spawn: processes.spawn,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });

    // act
    const rejected = credentialOps.reject("github.com", {
      username: "x-access-token",
      password: "token-1",
    });
    const process = processes.process();
    process.close(0);
    await rejected;

    // assert
    assert.deepStrictEqual(process.args, ["credential", "reject"]);
    assert.strictEqual(
      process.input(),
      "protocol=https\nhost=github.com\nusername=x-access-token\npassword=token-1\n\n",
    );
    assert.strictEqual(process.inputEnded(), true);
  });

  for (const subcommand of ["approve", "reject"] as const) {
    test(`swallows a process failure during ${subcommand}`, async (t) => {
      // arrange
      t.mock.timers.enable({ apis: ["setTimeout"] });
      const processes = manualCredentialProcess();
      const credentialOps = createCredentialOps({ spawn: processes.spawn, timeoutMs: 50 });

      // act
      const completed = credentialOps[subcommand]("github.com", {
        username: "x-access-token",
        password: "token-1",
      });
      const process = processes.process();
      process.fail(new Error("git unavailable"));
      await completed;
      t.mock.timers.tick(50);

      // assert
      assert.deepStrictEqual(process.terminations(), []);
    });
  }

  test("falls back to gh auth token on a github.com fill miss without approving it", async (t) => {
    // arrange
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const gitProcesses = manualCredentialProcess();
    const ghProcesses = manualGitHubCliProcess();
    const credentialOps = createCredentialOps({
      spawn: gitProcesses.spawn,
      timeoutMs: 50,
      gitHubCliFallback: {
        spawn: ghProcesses.spawn,
        credentialFrom: (token) => ({ username: "x-access-token", password: token }),
      },
    });

    // act
    const pendingCredential = credentialOps.fill("github.com");
    gitProcesses.process().close(1);
    const ghProcess = await ghProcesses.waitForProcess();
    ghProcess.writeOutput("  gho_fallback_token_1\r\n");
    ghProcess.close(0);
    const credential = await pendingCredential;
    t.mock.timers.tick(50);

    // assert
    assert.deepStrictEqual(credential, {
      username: "x-access-token",
      password: "gho_fallback_token_1",
    });
    assert.strictEqual(ghProcess.command, "gh");
    assert.deepStrictEqual(ghProcess.args, ["auth", "token", "--hostname", "github.com"]);
    assert.strictEqual(ghProcess.options.env.GH_PROMPT_DISABLED, "1");
    assert.strictEqual(ghProcess.options.shell, false);
    assert.deepStrictEqual(ghProcess.options.stdio, ["ignore", "pipe", "ignore"]);
    assert.deepStrictEqual(ghProcess.terminations(), []);
    assert.strictEqual(gitProcesses.invocations().length, 1);
  });

  test("skips gh auth token when git credential fill already returned a credential", async () => {
    // arrange
    const gitProcesses = manualCredentialProcess();
    const ghProcesses = manualGitHubCliProcess();
    const credentialOps = createCredentialOps({
      spawn: gitProcesses.spawn,
      timeoutMs: DEFAULT_TIMEOUT_MS,
      gitHubCliFallback: {
        spawn: ghProcesses.spawn,
        credentialFrom: (token) => ({ username: "x-access-token", password: token }),
      },
    });

    // act
    const pendingCredential = credentialOps.fill("github.com");
    gitProcesses.process().writeOutput("username=stored-user\npassword=stored-token\n");
    gitProcesses.process().close(0);
    const credential = await pendingCredential;

    // assert
    assert.deepStrictEqual(credential, {
      username: "stored-user",
      password: "stored-token",
    });
    assert.deepStrictEqual(ghProcesses.invocations(), []);
  });

  test("skips gh auth token for hosts other than github.com without reading the GitHub base override", async (t) => {
    // arrange
    setGitHubBaseUrl(t, "http://invalid-scheme.example");
    const gitProcesses = manualCredentialProcess();
    const ghProcesses = manualGitHubCliProcess();
    const credentialOps = createCredentialOps({
      spawn: gitProcesses.spawn,
      timeoutMs: DEFAULT_TIMEOUT_MS,
      gitHubCliFallback: {
        spawn: ghProcesses.spawn,
        credentialFrom: (token) => ({ username: "x-access-token", password: token }),
      },
    });

    // act
    const pendingCredential = credentialOps.fill("gitlab.com");
    gitProcesses.process().close(1);
    const credential = await pendingCredential;

    // assert
    assert.strictEqual(credential, null);
    assert.deepStrictEqual(ghProcesses.invocations(), []);
  });

  test("skips gh auth token while PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL is set", async (t) => {
    // arrange
    setGitHubBaseUrl(t, "https://github.com/mirror");
    const gitProcesses = manualCredentialProcess();
    const ghProcesses = manualGitHubCliProcess();
    const credentialOps = createCredentialOps({
      spawn: gitProcesses.spawn,
      timeoutMs: DEFAULT_TIMEOUT_MS,
      gitHubCliFallback: {
        spawn: ghProcesses.spawn,
        credentialFrom: (token) => ({ username: "x-access-token", password: token }),
      },
    });

    // act
    const pendingCredential = credentialOps.fill("github.com");
    gitProcesses.process().close(1);
    const credential = await pendingCredential;

    // assert
    assert.strictEqual(credential, null);
    assert.deepStrictEqual(ghProcesses.invocations(), []);
  });

  for (const { behavior, exitCode, output } of [
    { behavior: "returns null when gh exits non-zero", exitCode: 1, output: "" },
    {
      behavior: "returns null when gh closes without an exit code",
      exitCode: null,
      output: "gho_ignored\n",
    },
    { behavior: "returns null when gh prints whitespace only", exitCode: 0, output: "  \r\n  " },
    {
      behavior: "returns null when gh prints multiple lines",
      exitCode: 0,
      output: "gho_line_1\ngho_line_2\n",
    },
    {
      behavior: "returns null when gh prints a NUL byte",
      exitCode: 0,
      output: "gho_bad\0token\n",
    },
  ]) {
    test(behavior, async () => {
      // arrange
      const gitProcesses = manualCredentialProcess();
      const ghProcesses = manualGitHubCliProcess();
      const credentialOps = createCredentialOps({
        spawn: gitProcesses.spawn,
        timeoutMs: DEFAULT_TIMEOUT_MS,
        gitHubCliFallback: {
          spawn: ghProcesses.spawn,
          credentialFrom: (token) => ({ username: "x-access-token", password: token }),
        },
      });

      // act
      const pendingCredential = credentialOps.fill("github.com");
      gitProcesses.process().close(1);
      const ghProcess = await ghProcesses.waitForProcess();
      if (output !== "") {
        ghProcess.writeOutput(output);
      }

      ghProcess.close(exitCode);
      const credential = await pendingCredential;

      // assert
      assert.strictEqual(credential, null);
    });
  }

  test("returns null and clears the timeout when the gh process fails to start", async (t) => {
    // arrange
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const gitProcesses = manualCredentialProcess();
    const ghProcesses = manualGitHubCliProcess();
    const credentialOps = createCredentialOps({
      spawn: gitProcesses.spawn,
      timeoutMs: 50,
      gitHubCliFallback: {
        spawn: ghProcesses.spawn,
        credentialFrom: (token) => ({ username: "x-access-token", password: token }),
      },
    });

    // act
    const pendingCredential = credentialOps.fill("github.com");
    gitProcesses.process().close(1);
    const ghProcess = await ghProcesses.waitForProcess();
    ghProcess.fail(new Error("spawn gh ENOENT"));
    const credential = await pendingCredential;
    t.mock.timers.tick(50);

    // assert
    assert.strictEqual(credential, null);
    assert.deepStrictEqual(ghProcess.terminations(), []);
  });

  test("terminates a timed-out gh process and returns null", async (t) => {
    // arrange
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const gitProcesses = manualCredentialProcess();
    const ghProcesses = manualGitHubCliProcess();
    const credentialOps = createCredentialOps({
      spawn: gitProcesses.spawn,
      timeoutMs: 50,
      gitHubCliFallback: {
        spawn: ghProcesses.spawn,
        credentialFrom: (token) => ({ username: "x-access-token", password: token }),
      },
    });

    // act
    const pendingCredential = credentialOps.fill("github.com");
    gitProcesses.process().close(1);
    const ghProcess = await ghProcesses.waitForProcess();
    t.mock.timers.tick(50);
    const credential = await pendingCredential;

    // assert
    assert.strictEqual(credential, null);
    assert.deepStrictEqual(ghProcess.terminations(), ["SIGTERM"]);
  });
});

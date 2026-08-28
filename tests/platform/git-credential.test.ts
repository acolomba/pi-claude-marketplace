import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough, Writable } from "node:stream";
import { describe, test } from "node:test";

import { mock, verify, when } from "strong-mock";

import {
  DEFAULT_CREDENTIAL_OPS,
  createCredentialOps,
  type CredentialOps,
  type CredentialProcess,
  type CredentialSpawn,
  type CredentialSpawnOptions,
} from "../../extensions/pi-claude-marketplace/platform/git-credential.ts";

interface CredentialProcessControl {
  readonly process: CredentialProcess;
  close(code: number | null): void;
  fail(error: Error): void;
  failInput(error: Error): void;
  standardInput(): string;
  writeOutput(output: string): void;
}

function credentialProcess(
  terminate: CredentialProcess["kill"] = () => true,
): CredentialProcessControl {
  const events = new EventEmitter();
  const stdout = new PassThrough();
  let stdinText = "";
  const stdin = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      stdinText += chunk.toString("utf8");
      callback();
    },
  });
  const child: CredentialProcess = {
    stdin,
    stdout,
    kill: terminate,
    on: (event, listener) => {
      events.on(event, listener as (...args: unknown[]) => void);
    },
  };

  return {
    process: child,
    close: (code) => {
      events.emit("close", code);
    },
    fail: (error) => {
      events.emit("error", error);
    },
    failInput: (error) => {
      stdin.emit("error", error);
    },
    standardInput: () => stdinText,
    writeOutput: (output) => {
      stdout.write(Buffer.from(output));
    },
  };
}

function credentialSpawnOptions(): CredentialSpawnOptions {
  return {
    env: {
      ...process.env,
      GIT_TERMINAL_PROMPT: "0",
      GCM_INTERACTIVE: "never",
    },
    stdio: ["pipe", "pipe", "pipe"],
  };
}

void ({
  fill: () => Promise.resolve(null),
  approve: () => Promise.resolve(),
  reject: () => Promise.resolve(),
} satisfies CredentialOps);

describe("createCredentialOps", () => {
  test("fills a credential from the git wire response", async () => {
    // arrange
    const child = credentialProcess();
    const spawnProcess = mock<CredentialSpawn>({
      exactParams: true,
      name: "credential process launcher",
    });
    when(() => spawnProcess("git", ["credential", "fill"], credentialSpawnOptions())).thenReturn(
      child.process,
    );
    const credentialOps = createCredentialOps({ spawn: spawnProcess });
    queueMicrotask(() => {
      child.writeOutput("ignored\n=missing-key\nusername=x-access-token\r\npassword=token-1\r\n\n");
      child.failInput(new Error("closed input"));
      child.close(0);
    });

    // act
    const credential = await credentialOps.fill("github.com");

    // assert
    assert.deepStrictEqual(credential, {
      username: "x-access-token",
      password: "token-1",
    });
    assert.strictEqual(child.standardInput(), "protocol=https\nhost=github.com\n\n");
    verify(spawnProcess);
  });

  for (const { exitCode, behavior } of [
    { behavior: "returns null for a non-zero exit", exitCode: 128 },
    { behavior: "returns null when the process closes without an exit code", exitCode: null },
  ]) {
    test(behavior, async () => {
      // arrange
      const child = credentialProcess();
      const spawnProcess = mock<CredentialSpawn>({
        exactParams: true,
        name: "credential process launcher",
      });
      when(() => spawnProcess("git", ["credential", "fill"], credentialSpawnOptions())).thenReturn(
        child.process,
      );
      const credentialOps = createCredentialOps({ spawn: spawnProcess });
      queueMicrotask(() => {
        child.close(exitCode);
      });

      // act
      const credential = await credentialOps.fill("github.com");

      // assert
      assert.strictEqual(credential, null);
      verify(spawnProcess);
    });
  }

  for (const { output, behavior } of [
    { behavior: "returns null without a username", output: "password=token-1\n" },
    { behavior: "returns null without a password", output: "username=x-access-token\n" },
  ]) {
    test(behavior, async () => {
      // arrange
      const child = credentialProcess();
      const spawnProcess = mock<CredentialSpawn>({
        exactParams: true,
        name: "credential process launcher",
      });
      when(() => spawnProcess("git", ["credential", "fill"], credentialSpawnOptions())).thenReturn(
        child.process,
      );
      const credentialOps = createCredentialOps({ spawn: spawnProcess });
      queueMicrotask(() => {
        child.writeOutput(output);
        child.close(0);
      });

      // act
      const credential = await credentialOps.fill("github.com");

      // assert
      assert.strictEqual(credential, null);
      verify(spawnProcess);
    });
  }

  test("returns null when the fill process fails", async () => {
    // arrange
    const child = credentialProcess();
    const spawnProcess = mock<CredentialSpawn>({
      exactParams: true,
      name: "credential process launcher",
    });
    when(() => spawnProcess("git", ["credential", "fill"], credentialSpawnOptions())).thenReturn(
      child.process,
    );
    const credentialOps = createCredentialOps({ spawn: spawnProcess });
    queueMicrotask(() => {
      child.fail(new Error("git unavailable"));
    });

    // act
    const credential = await credentialOps.fill("github.com");

    // assert
    assert.strictEqual(credential, null);
    verify(spawnProcess);
  });

  test("terminates a timed-out fill and returns null", async (t) => {
    // arrange
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const terminate = mock<CredentialProcess["kill"]>({
      exactParams: true,
      name: "credential process termination",
    });
    when(() => terminate("SIGTERM")).thenReturn(true);
    const child = credentialProcess(terminate);
    const spawnProcess = mock<CredentialSpawn>({
      exactParams: true,
      name: "credential process launcher",
    });
    when(() => spawnProcess("git", ["credential", "fill"], credentialSpawnOptions())).thenReturn(
      child.process,
    );
    const credentialOps = createCredentialOps({
      spawn: spawnProcess,
      timeoutMs: 50,
    });

    // act
    const pendingCredential = credentialOps.fill("github.com");
    t.mock.timers.tick(50);
    const credential = await pendingCredential;

    // assert
    assert.strictEqual(credential, null);
    verify(spawnProcess);
    verify(terminate);
  });

  for (const host of ["github.com\ninjected=1", "github.com\rinjected=1", "github.com\0x"]) {
    test(`rejects the host ${JSON.stringify(host)}`, async () => {
      // arrange
      const spawnProcess = mock<CredentialSpawn>({
        exactParams: true,
        name: "credential process launcher",
      });
      const credentialOps = createCredentialOps({ spawn: spawnProcess });

      // act & assert
      await assert.rejects(
        () => credentialOps.fill(host),
        (error: unknown) => {
          assert.ok(error instanceof Error);
          assert.deepStrictEqual(
            { name: error.name, message: error.message },
            {
              name: "Error",
              message: "git-credential attribute 'host' contains a control character",
            },
          );
          return true;
        },
      );
      verify(spawnProcess);
    });
  }

  test("approves a complete credential with the complete wire request", async () => {
    // arrange
    const child = credentialProcess();
    const spawnProcess = mock<CredentialSpawn>({
      exactParams: true,
      name: "credential process launcher",
    });
    when(() => spawnProcess("git", ["credential", "approve"], credentialSpawnOptions())).thenReturn(
      child.process,
    );
    const credentialOps = createCredentialOps({ spawn: spawnProcess });
    queueMicrotask(() => {
      child.close(0);
    });

    // act
    await credentialOps.approve("github.com", {
      username: "x-access-token",
      password: "token-1",
    });

    // assert
    assert.strictEqual(
      child.standardInput(),
      "protocol=https\nhost=github.com\nusername=x-access-token\npassword=token-1\n\n",
    );
    verify(spawnProcess);
  });

  test("omits absent credential fields from an approve request", async () => {
    // arrange
    const child = credentialProcess();
    const spawnProcess = mock<CredentialSpawn>({
      exactParams: true,
      name: "credential process launcher",
    });
    when(() => spawnProcess("git", ["credential", "approve"], credentialSpawnOptions())).thenReturn(
      child.process,
    );
    const credentialOps = createCredentialOps({ spawn: spawnProcess });
    queueMicrotask(() => {
      child.close(0);
    });

    // act
    await credentialOps.approve("github.com", {});

    // assert
    assert.strictEqual(child.standardInput(), "protocol=https\nhost=github.com\n\n");
    verify(spawnProcess);
  });

  test("rejects a credential with the complete wire request", async () => {
    // arrange
    const child = credentialProcess();
    const spawnProcess = mock<CredentialSpawn>({
      exactParams: true,
      name: "credential process launcher",
    });
    when(() => spawnProcess("git", ["credential", "reject"], credentialSpawnOptions())).thenReturn(
      child.process,
    );
    const credentialOps = createCredentialOps({ spawn: spawnProcess });
    queueMicrotask(() => {
      child.close(0);
    });

    // act
    await credentialOps.reject("github.com", {
      username: "x-access-token",
      password: "token-1",
    });

    // assert
    assert.strictEqual(
      child.standardInput(),
      "protocol=https\nhost=github.com\nusername=x-access-token\npassword=token-1\n\n",
    );
    verify(spawnProcess);
  });

  for (const subcommand of ["approve", "reject"] as const) {
    test(`swallows a process failure during ${subcommand}`, async () => {
      // arrange
      const child = credentialProcess();
      const spawnProcess = mock<CredentialSpawn>({
        exactParams: true,
        name: "credential process launcher",
      });
      when(() =>
        spawnProcess("git", ["credential", subcommand], credentialSpawnOptions()),
      ).thenReturn(child.process);
      const credentialOps = createCredentialOps({ spawn: spawnProcess });
      queueMicrotask(() => {
        child.fail(new Error("git unavailable"));
      });

      // act
      await credentialOps[subcommand]("github.com", {
        username: "x-access-token",
        password: "token-1",
      });

      // assert
      verify(spawnProcess);
    });
  }
});

describe("DEFAULT_CREDENTIAL_OPS", () => {
  test("returns null when git is absent from PATH", async (t) => {
    // arrange
    const previousPath = process.env.PATH;
    t.after(() => {
      if (previousPath === undefined) {
        delete process.env.PATH;
      } else {
        process.env.PATH = previousPath;
      }
    });
    process.env.PATH = "/path/that/does/not/contain/git";

    // act
    const credential = await DEFAULT_CREDENTIAL_OPS.fill("missing.example");

    // assert
    assert.strictEqual(credential, null);
  });
});

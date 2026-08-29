import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  createCredentialOps,
  type CredentialOps,
} from "../../extensions/pi-claude-marketplace/platform/git-credential.ts";
import type { GitCredentials } from "../../extensions/pi-claude-marketplace/platform/git.ts";
import { registerCredentialOpsContract } from "./credential-ops-contract.ts";
import { createCredentialProcessFake } from "./credential-process-fake.ts";

void ({
  fill: () => Promise.resolve(null),
  approve: () => Promise.resolve(),
  reject: () => Promise.resolve(),
} satisfies CredentialOps);

function manualCredentialProcess() {
  return createCredentialProcessFake({ onInput: () => {} });
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

  return createCredentialOps({ spawn: processes.spawn });
}

describe("createCredentialOps", () => {
  registerCredentialOpsContract(createProductionCredentialOps);

  test("fills a credential from the complete git wire response", async () => {
    // arrange
    const processes = manualCredentialProcess();
    const credentialOps = createCredentialOps({ spawn: processes.spawn });

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
      const credentialOps = createCredentialOps({ spawn: processes.spawn });

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
      const credentialOps = createCredentialOps({ spawn: processes.spawn });

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
    const credentialOps = createCredentialOps({ spawn: processes.spawn });

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
    const credentialOps = createCredentialOps({ spawn: processes.spawn });

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
    const credentialOps = createCredentialOps({ spawn: processes.spawn });

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
});

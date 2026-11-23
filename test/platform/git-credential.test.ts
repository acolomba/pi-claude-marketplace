import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  createCredentialOps,
  NODE_CREDENTIAL_GIT,
  type CredentialOps,
} from "../../extensions/pi-claude-marketplace/platform/git-credential.ts";
import { NODE_GIT_PROCESS } from "../../extensions/pi-claude-marketplace/platform/git-process.ts";
import { GitCommandError } from "../../extensions/pi-claude-marketplace/shared/errors.ts";

import { registerCredentialOpsContract } from "./credential-ops-contract.ts";
import { captureDebugLog } from "./debug-log-capture.ts";

import type { CredentialGit } from "../../extensions/pi-claude-marketplace/platform/git-credential.ts";
import type * as GitCredentialPlatform from "../../extensions/pi-claude-marketplace/platform/git-credential.ts";
import type {
  GitRequest,
  GitResult,
} from "../../extensions/pi-claude-marketplace/platform/git-process.ts";
import type { GitCredentials } from "../../extensions/pi-claude-marketplace/platform/git.ts";

/** The timeout `orchestrators/auth-host.ts` binds into the production ops. */
const DEFAULT_TIMEOUT_MS = 5_000;

// The one concrete composition of this protocol lives in
// `orchestrators/auth-host.ts`, which supplies the git process and the timeout
// explicitly; this module publishes the protocol, its collaborators, and their
// production bindings only. Restoring the export makes the `satisfies` resolve
// and turns the directive below into an unused one (TS2578).
// @ts-expect-error platform/git-credential.ts does not expose a composed default
void ({} satisfies { readonly retired?: typeof GitCredentialPlatform.DEFAULT_CREDENTIAL_OPS });

void ({
  fill: () => Promise.resolve(null),
  approve: () => Promise.resolve(),
  reject: () => Promise.resolve(),
} satisfies CredentialOps);

type GitAnswer = (request: GitRequest) => Promise<GitResult>;

interface RecordingGit {
  readonly git: CredentialGit;
  readonly requests: GitRequest[];
}

// A git process that records each request and answers it with `answer`.
function createGit(answer: GitAnswer): RecordingGit {
  const requests: GitRequest[] = [];
  return {
    requests,
    git: {
      run: (request) => {
        requests.push(request);
        return answer(request);
      },
    },
  };
}

function exited(stdout: string): Promise<GitResult> {
  return Promise.resolve({ exitCode: 0, stdout, stderr: "" });
}

// What git rejects with when a credential action exits with 128.
function failedRun(action: string): GitCommandError {
  return new GitCommandError(
    { kind: "failed" },
    { operation: `credential ${action}`, exitCode: 128, stderr: "fatal: no helper" },
  );
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

// A credential helper behind git: a fill miss exits with 128, as git does.
function createProductionCredentialOps(): CredentialOps {
  const credentials = new Map<string, GitCredentials>();
  const { git } = createGit((request) => {
    const attributes = credentialAttributes(request.input ?? "");
    const host = attributes.host;
    if (attributes.protocol !== "https" || host === undefined) {
      throw new Error("git credential received an invalid attribute block");
    }

    const [action] = request.options ?? [];
    if (action === "fill") {
      const credential = credentials.get(host);
      return credential === undefined
        ? Promise.reject(failedRun("fill"))
        : exited(`username=${credential.username}\npassword=${credential.password}\n`);
    }

    const credential: GitCredentials = {
      ...(attributes.username !== undefined && { username: attributes.username }),
      ...(attributes.password !== undefined && { password: attributes.password }),
    };
    if (action === "approve") {
      credentials.set(host, structuredClone(credential));
    } else {
      const stored = credentials.get(host);
      if (stored !== undefined && credentialsMatch(stored, credential)) {
        credentials.delete(host);
      }
    }

    return exited("");
  });

  return createCredentialOps({ git, timeoutMs: DEFAULT_TIMEOUT_MS });
}

describe("NODE_CREDENTIAL_GIT", () => {
  test("D-SG-04: is the process's one production git process", () => {
    // act
    const productionGit: unknown = NODE_CREDENTIAL_GIT;

    // assert
    assert.strictEqual(productionGit, NODE_GIT_PROCESS);
  });
});

describe("createCredentialOps", () => {
  registerCredentialOpsContract(createProductionCredentialOps);

  test("binds the git process without running git", () => {
    // arrange
    const { git, requests } = createGit(() => {
      throw new Error("construction must not run git");
    });

    // act
    const credentialOps = createCredentialOps({ git, timeoutMs: DEFAULT_TIMEOUT_MS });

    // assert
    assert.deepStrictEqual(Object.keys(credentialOps), ["fill", "approve", "reject"]);
    assert.deepStrictEqual(requests, []);
  });

  test("AUTH-08: fills a credential from the complete git wire response", async () => {
    // arrange
    const { git, requests } = createGit(() =>
      exited("ignored\n=missing-key\nusername=x-access-token\r\npassword=token-1\r\n\n"),
    );
    const credentialOps = createCredentialOps({ git, timeoutMs: DEFAULT_TIMEOUT_MS });

    // act
    const credential = await credentialOps.fill("github.com");

    // assert
    assert.deepStrictEqual(credential, { username: "x-access-token", password: "token-1" });
    assert.deepStrictEqual(requests, [
      {
        subcommand: "credential",
        options: ["fill"],
        lane: "network",
        input: "protocol=https\nhost=github.com\n\n",
        timeoutMs: DEFAULT_TIMEOUT_MS,
      },
    ]);
  });

  test("AUTH-08: returns null when the fill run rejects", async () => {
    // arrange
    const { git } = createGit(() => Promise.reject(failedRun("fill")));
    const credentialOps = createCredentialOps({ git, timeoutMs: DEFAULT_TIMEOUT_MS });

    // act
    const credential = await credentialOps.fill("github.com");

    // assert
    assert.strictEqual(credential, null);
  });

  for (const { output, behavior } of [
    { behavior: "returns null without a username", output: "password=token-1\n" },
    { behavior: "returns null without a password", output: "username=x-access-token\n" },
  ]) {
    test(behavior, async () => {
      // arrange
      const { git } = createGit(() => exited(output));
      const credentialOps = createCredentialOps({ git, timeoutMs: DEFAULT_TIMEOUT_MS });

      // act
      const credential = await credentialOps.fill("github.com");

      // assert
      assert.strictEqual(credential, null);
    });
  }

  for (const { action, label } of [
    { action: "approve", label: "credentialApprove" },
    { action: "reject", label: "credentialReject" },
  ] as const) {
    test(`sends a complete credential with the complete wire request to ${action}`, async () => {
      // arrange
      const { git, requests } = createGit(() => exited(""));
      const credentialOps = createCredentialOps({ git, timeoutMs: DEFAULT_TIMEOUT_MS });

      // act
      await credentialOps[action]("github.com", {
        username: "x-access-token",
        password: "token-1",
      });

      // assert
      assert.deepStrictEqual(requests, [
        {
          subcommand: "credential",
          options: [action],
          lane: "network",
          input: "protocol=https\nhost=github.com\nusername=x-access-token\npassword=token-1\n\n",
          timeoutMs: DEFAULT_TIMEOUT_MS,
        },
      ]);
    });

    test(`AUTH-09: swallows a failed ${action} run and logs only its message`, async (t) => {
      // arrange
      const logged = captureDebugLog(t);
      const { git } = createGit(() => Promise.reject(failedRun(action)));
      const credentialOps = createCredentialOps({ git, timeoutMs: DEFAULT_TIMEOUT_MS });

      // act
      await credentialOps[action]("github.com", {
        username: "x-access-token",
        password: "token-1",
      });

      // assert
      assert.deepStrictEqual(logged, [
        `[auth] ${label}: git credential ${action} threw for github.com: git credential ${action} failed: failed, exit code 128`,
      ]);
    });
  }

  test("omits absent credential fields from an approve request", async () => {
    // arrange
    const { git, requests } = createGit(() => exited(""));
    const credentialOps = createCredentialOps({ git, timeoutMs: DEFAULT_TIMEOUT_MS });

    // act
    await credentialOps.approve("github.com", {});

    // assert
    assert.deepStrictEqual(
      requests.map(({ input }) => input),
      ["protocol=https\nhost=github.com\n\n"],
    );
  });
});

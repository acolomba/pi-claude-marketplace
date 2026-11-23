import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, test } from "node:test";

import {
  createCredentialOps,
  NODE_CREDENTIAL_GIT,
  type CredentialOps,
} from "../../extensions/pi-claude-marketplace/platform/git-credential.ts";
import { GitCommandError } from "../../extensions/pi-claude-marketplace/shared/errors.ts";

import { registerCredentialOpsContract } from "./credential-ops-contract.ts";
import { captureDebugLog } from "./debug-log-capture.ts";
import { createHermeticEnvironment } from "./hermetic-environment.ts";

import type { CredentialGit } from "../../extensions/pi-claude-marketplace/platform/git-credential.ts";
import type * as GitCredentialPlatform from "../../extensions/pi-claude-marketplace/platform/git-credential.ts";
import type { GitCredentials } from "../../extensions/pi-claude-marketplace/platform/git.ts";
import type { TestContext } from "node:test";

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

// WR-05: the port runs `git credential` only, so it takes no git request.
// @ts-expect-error a clone request is not a credential action
void ((git: CredentialGit) => git({ subcommand: "clone", lane: "network" }, "", 5_000));
// @ts-expect-error only fill, approve, and reject run
void ((git: CredentialGit) => git("erase", "", 5_000));

interface CredentialRequest {
  readonly action: Parameters<CredentialGit>[0];
  readonly input: string;
  readonly timeoutMs: number;
}

type GitAnswer = (request: CredentialRequest) => Promise<string>;

interface RecordingGit {
  readonly git: CredentialGit;
  readonly requests: CredentialRequest[];
}

// A credential runner that records each request and answers it with `answer`.
function createGit(answer: GitAnswer): RecordingGit {
  const requests: CredentialRequest[] = [];
  return {
    requests,
    git: (action, input, timeoutMs) => {
      const request = { action, input, timeoutMs };
      requests.push(request);
      return answer(request);
    },
  };
}

function exited(stdout: string): Promise<string> {
  return Promise.resolve(stdout);
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
    const attributes = credentialAttributes(request.input);
    const host = attributes.host;
    if (attributes.protocol !== "https" || host === undefined) {
      throw new Error("git credential received an invalid attribute block");
    }

    const { action } = request;
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

// Points this process's git at a user config whose credential helper answers
// every lookup, with no system config, and restores the variables after `t`.
async function answeringHelper(t: TestContext): Promise<void> {
  const environment = await createHermeticEnvironment(t, "pi-cm-credential-git-");
  const config = path.join(environment.root, "gitconfig");
  await writeFile(
    config,
    '[credential]\n\thelper = "!f() { echo username=helper-user; echo password=helper-token; }; f"\n',
  );
  const previous = {
    GIT_CONFIG_GLOBAL: process.env.GIT_CONFIG_GLOBAL,
    GIT_CONFIG_NOSYSTEM: process.env.GIT_CONFIG_NOSYSTEM,
  };
  t.after(() => {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) {
        Reflect.deleteProperty(process.env, name);
      } else {
        process.env[name] = value;
      }
    }
  });
  process.env.GIT_CONFIG_GLOBAL = config;
  process.env.GIT_CONFIG_NOSYSTEM = "1";
}

describe("NODE_CREDENTIAL_GIT", () => {
  test("D-SG-04, WR-05: runs git credential through this process's git", async (t) => {
    // arrange
    await answeringHelper(t);

    // act
    const stdout = await NODE_CREDENTIAL_GIT(
      "fill",
      "protocol=https\nhost=pi-claude-marketplace.invalid\n\n",
      10_000,
    );

    // assert
    assert.strictEqual(
      stdout,
      "protocol=https\nhost=pi-claude-marketplace.invalid\nusername=helper-user\npassword=helper-token\n",
    );
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
        action: "fill",
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
          action,
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

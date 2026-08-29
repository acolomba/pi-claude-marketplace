import assert from "node:assert/strict";
import * as fs from "node:fs";
import { readFile } from "node:fs/promises";
import { describe, test, type TestContext } from "node:test";

import * as git from "isomorphic-git";
import http from "isomorphic-git/http/node";

import {
  buildAuthCallbacks,
  checkout,
  clone,
  currentBranch,
  fetch,
  forceUpdateRef,
  listBranches,
  listRemotes,
  resolveRef,
  resolveRemoteRef,
} from "../../extensions/pi-claude-marketplace/platform/git.ts";

import { createCredentialOpsFake } from "./credential-ops-fake.ts";
import { registerGitOpsContract } from "./git-ops-contract.ts";
import { createGitTestDirectory, createGitTestRepository } from "./git-test-repository.ts";

import type { GitOpsContractParticipant } from "./git-ops-contract.ts";
import type { GitOps } from "../../extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts";
import type {
  AuthAttemptResult,
  GitCredentials,
  OnAuthRequiredFn,
} from "../../extensions/pi-claude-marketplace/platform/git.ts";
import type { GitHttpRequest, GitHttpResponse } from "isomorphic-git/http/node";

const HOST = "git.example.invalid";
const REMOTE_URL = `https://${HOST}/owner/repo.git`;
const OID_MAIN = "1111111111111111111111111111111111111111";
const OID_DEV = "2222222222222222222222222222222222222222";
const OID_TAG = "3333333333333333333333333333333333333333";
const OID_PEELED = "4444444444444444444444444444444444444444";
const FLUSH = Buffer.from("0000", "utf8");
const DELIM = Buffer.from("0001", "utf8");

const FULL_ADVERTISEMENT = [
  `${OID_MAIN} HEAD symref-target:refs/heads/main`,
  `${OID_MAIN} refs/heads/main`,
  `${OID_DEV} refs/heads/dev`,
  `${OID_TAG} refs/tags/v1.0.0 peeled:${OID_PEELED}`,
] as const;

interface RecordedHttpRequest {
  readonly url: string;
  readonly method: string | undefined;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: Buffer;
}

function packet(payload: string): Buffer {
  const body = Buffer.from(payload, "utf8");
  return packetBytes(body);
}

function packetBytes(body: Uint8Array): Buffer {
  return Buffer.concat([
    Buffer.from((body.length + 4).toString(16).padStart(4, "0"), "utf8"),
    body,
  ]);
}

function advertisementBody(): Buffer {
  return Buffer.concat([
    packet("# service=git-upload-pack\n"),
    FLUSH,
    packet("version 2\n"),
    packet("ls-refs\n"),
    packet("fetch\n"),
    FLUSH,
  ]);
}

function refsBody(refs: readonly string[]): Buffer {
  return Buffer.concat([...refs.map((ref) => packet(`${ref}\n`)), FLUSH]);
}

function uploadPackAdvertisementBody(oid: string): Buffer {
  return Buffer.concat([
    packet("# service=git-upload-pack\n"),
    FLUSH,
    packet(`${oid} HEAD\0multi_ack_detailed side-band-64k ofs-delta symref=HEAD:refs/heads/main\n`),
    packet(`${oid} refs/heads/main\n`),
    FLUSH,
  ]);
}

function expectedListRefsBody(): Buffer {
  return Buffer.concat([
    packet("command=ls-refs\n"),
    packet("agent=git/isomorphic-git@1.41.8\n"),
    DELIM,
    packet("peel"),
    packet("symrefs"),
    FLUSH,
  ]);
}

async function collectBody(body: GitHttpRequest["body"]): Promise<Buffer> {
  const chunks: Uint8Array[] = [];
  if (body !== undefined) {
    for await (const chunk of body) {
      chunks.push(chunk);
    }
  }

  return Buffer.concat(chunks);
}

function response(
  url: string,
  statusCode: number,
  statusMessage: string,
  contentType: string,
  bytes: Buffer,
): GitHttpResponse {
  async function* body(): AsyncIterableIterator<Uint8Array> {
    await Promise.resolve();
    yield Uint8Array.from(bytes);
  }

  return {
    url,
    statusCode,
    statusMessage,
    headers: { "content-type": contentType },
    body: body(),
  };
}

function installRemoteTransport(
  t: TestContext,
  refs: readonly string[],
  options: { readonly challengeOnce?: boolean } = {},
): RecordedHttpRequest[] {
  const requests: RecordedHttpRequest[] = [];
  let challenged = false;

  t.mock.method(http, "request", async (request: GitHttpRequest): Promise<GitHttpResponse> => {
    const body = await collectBody(request.body);
    requests.push({
      url: request.url,
      method: request.method,
      headers: { ...(request.headers ?? {}) },
      body,
    });

    const infoUrl = `${REMOTE_URL}/info/refs?service=git-upload-pack`;
    if (request.url === infoUrl && request.method === "GET") {
      if (options.challengeOnce === true && !challenged) {
        challenged = true;
        return response(request.url, 401, "Unauthorized", "text/plain", Buffer.alloc(0));
      }

      return response(
        request.url,
        200,
        "OK",
        "application/x-git-upload-pack-advertisement",
        advertisementBody(),
      );
    }

    if (request.url === `${REMOTE_URL}/git-upload-pack` && request.method === "POST") {
      return response(
        request.url,
        200,
        "OK",
        "application/x-git-upload-pack-result",
        refsBody(refs),
      );
    }

    throw new Error(`unplanned Git HTTP request: ${request.method ?? "undefined"} ${request.url}`);
  });

  return requests;
}

function installFailedDiscoveryTransport(
  t: TestContext,
  options: { readonly challengeOnce?: boolean } = {},
): RecordedHttpRequest[] {
  const requests: RecordedHttpRequest[] = [];
  let challenged = false;

  t.mock.method(http, "request", async (request: GitHttpRequest): Promise<GitHttpResponse> => {
    requests.push({
      url: request.url,
      method: request.method,
      headers: { ...(request.headers ?? {}) },
      body: await collectBody(request.body),
    });

    if (
      request.url !== `${REMOTE_URL}/info/refs?service=git-upload-pack` ||
      request.method !== "GET"
    ) {
      throw new Error(
        `unplanned Git HTTP request: ${request.method ?? "undefined"} ${request.url}`,
      );
    }

    if (options.challengeOnce === true && !challenged) {
      challenged = true;
      return response(request.url, 401, "Unauthorized", "text/plain", Buffer.alloc(0));
    }

    return response(request.url, 503, "Unavailable", "text/plain", Buffer.from("offline"));
  });

  return requests;
}

async function installRepositoryTransport(
  t: TestContext,
  repository: Awaited<ReturnType<typeof createGitTestRepository>>,
): Promise<void> {
  const { oid, packfile } = await repository.pack();
  const refs = [
    `${oid} HEAD symref-target:refs/heads/main`,
    `${oid} refs/heads/main`,
    `${OID_TAG} refs/tags/v1.0.0 peeled:${oid}`,
  ] as const;

  t.mock.method(http, "request", async (request: GitHttpRequest): Promise<GitHttpResponse> => {
    await collectBody(request.body);
    const infoUrl = `${REMOTE_URL}/info/refs?service=git-upload-pack`;
    if (request.url === infoUrl && request.method === "GET") {
      const protocolV2 = request.headers?.["Git-Protocol"] === "version=2";
      return response(
        request.url,
        200,
        "OK",
        "application/x-git-upload-pack-advertisement",
        protocolV2 ? advertisementBody() : uploadPackAdvertisementBody(oid),
      );
    }

    if (request.url === `${REMOTE_URL}/git-upload-pack` && request.method === "POST") {
      const protocolV2 = request.headers?.["Git-Protocol"] === "version=2";
      return response(
        request.url,
        200,
        "OK",
        "application/x-git-upload-pack-result",
        protocolV2
          ? refsBody(refs)
          : Buffer.concat([
              packet("NAK\n"),
              packetBytes(Buffer.concat([Buffer.from([1]), packfile])),
              FLUSH,
            ]),
      );
    }

    throw new Error(`unplanned Git HTTP request: ${request.method ?? "undefined"} ${request.url}`);
  });
}

const productionGitOps = {
  clone,
  fetch,
  forceUpdateRef,
  checkout,
  resolveRef,
  currentBranch,
  resolveRemoteRef,
} satisfies GitOps;

async function createProductionGitOps(t: TestContext): Promise<GitOpsContractParticipant> {
  const remote = await createGitTestRepository(t, { boundary: "local" });
  const updatedOid = await remote.commit(
    [{ filepath: "README.md", contents: "# updated\n" }],
    "updated",
  );
  const worktree = await createGitTestRepository(t, { boundary: "local" });
  const localUpdatedOid = await worktree.commit(
    [{ filepath: "README.md", contents: "# updated\n" }],
    "updated",
  );
  assert.strictEqual(localUpdatedOid, updatedOid);
  await git.writeRef({
    fs,
    dir: worktree.dir,
    ref: "refs/heads/main",
    value: worktree.initialOid,
    force: true,
  });
  await git.writeRef({
    fs,
    dir: worktree.dir,
    ref: "refs/heads/feature",
    value: updatedOid,
    force: true,
  });
  await git.checkout({ fs, dir: worktree.dir, ref: "main", force: true });
  await git.addRemote({ fs, dir: worktree.dir, remote: "origin", url: REMOTE_URL });
  const cloneDir = await createGitTestDirectory(t, { boundary: "local" });
  await installRepositoryTransport(t, remote);

  return {
    gitOps: productionGitOps,
    worktreeDir: worktree.dir,
    cloneDir,
    remoteUrl: REMOTE_URL,
    initialOid: worktree.initialOid,
    updatedOid,
    readFile: async (dir, filepath) => {
      try {
        return await readFile(`${dir}/${filepath}`, "utf8");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          return null;
        }

        throw error;
      }
    },
  };
}

function isExpectedDiscoveryError(error: unknown, caller: "git.clone" | "git.fetch"): boolean {
  assert.ok(error instanceof git.Errors.HttpError);
  assert.strictEqual(error.caller, caller);
  assert.deepStrictEqual(error.data, {
    statusCode: 503,
    statusMessage: "Unavailable",
    response: "offline",
  });
  return true;
}

function expectedPublicRequests(): readonly RecordedHttpRequest[] {
  return [
    {
      url: `${REMOTE_URL}/info/refs?service=git-upload-pack`,
      method: "GET",
      headers: { "Git-Protocol": "version=2" },
      body: Buffer.alloc(0),
    },
    {
      url: `${REMOTE_URL}/git-upload-pack`,
      method: "POST",
      headers: {
        "Git-Protocol": "version=2",
        "content-type": "application/x-git-upload-pack-request",
        accept: "application/x-git-upload-pack-result",
      },
      body: expectedListRefsBody(),
    },
  ];
}

function expectedDiscoveryRequest(
  headers: Readonly<Record<string, string>> = {},
): RecordedHttpRequest {
  return {
    url: `${REMOTE_URL}/info/refs?service=git-upload-pack`,
    method: "GET",
    headers,
    body: Buffer.alloc(0),
  };
}

function captureDebugLog(t: TestContext): string[] {
  const previousDebug = process.env.PI_CLAUDE_MARKETPLACE_DEBUG;
  const logged: string[] = [];
  t.after(() => {
    if (previousDebug === undefined) {
      delete process.env.PI_CLAUDE_MARKETPLACE_DEBUG;
    } else {
      process.env.PI_CLAUDE_MARKETPLACE_DEBUG = previousDebug;
    }
  });
  process.env.PI_CLAUDE_MARKETPLACE_DEBUG = "1";
  t.mock.method(console, "error", (...args: unknown[]) => {
    logged.push(args.map(String).join(" "));
  });
  return logged;
}

describe("buildAuthCallbacks", () => {
  test("returns a stored credential without requesting interactive auth", async () => {
    // arrange
    const credentials = createCredentialOpsFake({
      boundary: "memory",
      credentials: [[HOST, { username: "stored", password: "secret" }]],
    });
    const onAuthRequired: OnAuthRequiredFn = () => {
      throw new Error("interactive auth is forbidden on a credential hit");
    };

    const callbacks = buildAuthCallbacks({
      credentialOps: credentials.credentialOps,
      host: HOST,
      onAuthRequired,
    });

    // act
    const credential = await callbacks.onAuth(REMOTE_URL);

    // assert
    assert.deepStrictEqual(credential, { username: "stored", password: "secret" });
    assert.deepStrictEqual(credentials.calls, {
      fill: [{ host: HOST }],
      approve: [],
      reject: [],
    });
  });

  test("returns the interactive credential after a credential miss", async () => {
    // arrange
    const credentials = createCredentialOpsFake({ boundary: "memory" });
    const onAuthRequired: OnAuthRequiredFn = async () => {
      await Promise.resolve();
      return {
        ok: true,
        cred: { username: "x-access-token", password: "token" },
        authAttempted: true,
      } satisfies AuthAttemptResult;
    };

    const callbacks = buildAuthCallbacks({
      credentialOps: credentials.credentialOps,
      host: HOST,
      onAuthRequired,
    });

    // act
    const credential = await callbacks.onAuth(REMOTE_URL);

    // assert
    assert.deepStrictEqual(credential, { username: "x-access-token", password: "token" });
    assert.deepStrictEqual(credentials.calls, {
      fill: [{ host: HOST }],
      approve: [],
      reject: [],
    });
  });

  for (const reason of [
    "User cancelled authorization. Run the command again to retry.",
    "Device code expired before authorization. Run the command again to restart.",
    "Device Flow failed: invalid_client -- The client_id is invalid.",
  ]) {
    test(`cancels and logs the interactive-auth failure '${reason}'`, async (t) => {
      // arrange
      const logged = captureDebugLog(t);
      const credentials = createCredentialOpsFake({ boundary: "memory" });
      const onAuthRequired: OnAuthRequiredFn = async () => {
        await Promise.resolve();
        return { ok: false, reason, authAttempted: true } satisfies AuthAttemptResult;
      };

      const callbacks = buildAuthCallbacks({
        credentialOps: credentials.credentialOps,
        host: HOST,
        onAuthRequired,
      });

      // act
      const credential = await callbacks.onAuth(REMOTE_URL);

      // assert
      assert.deepStrictEqual(credential, { cancel: true });
      assert.deepStrictEqual(credentials.calls, {
        fill: [{ host: HOST }],
        approve: [],
        reject: [],
      });
      assert.deepStrictEqual(logged, [`[auth] onAuth: Device Flow failed for ${HOST}: ${reason}`]);
    });
  }

  test("cancels when credential lookup throws", async (t) => {
    // arrange
    const logged = captureDebugLog(t);
    const credentials = createCredentialOpsFake({
      boundary: "memory",
      fillError: new Error("credential lookup failed"),
    });
    const onAuthRequired: OnAuthRequiredFn = () => {
      throw new Error("interactive auth is forbidden after a credential error");
    };

    const callbacks = buildAuthCallbacks({
      credentialOps: credentials.credentialOps,
      host: HOST,
      onAuthRequired,
    });

    // act
    const credential = await callbacks.onAuth(REMOTE_URL);

    // assert
    assert.deepStrictEqual(credential, { cancel: true });
    assert.deepStrictEqual(credentials.calls, {
      fill: [{ host: HOST }],
      approve: [],
      reject: [],
    });
    assert.deepStrictEqual(logged, [`[auth] onAuth threw for ${HOST}: credential lookup failed`]);
  });

  test("cancels and logs when interactive auth throws", async (t) => {
    // arrange
    const logged = captureDebugLog(t);
    const credentials = createCredentialOpsFake({ boundary: "memory" });
    const onAuthRequired: OnAuthRequiredFn = async () => {
      await Promise.resolve();
      throw new Error("network down");
    };

    const callbacks = buildAuthCallbacks({
      credentialOps: credentials.credentialOps,
      host: HOST,
      onAuthRequired,
    });

    // act
    const credential = await callbacks.onAuth(REMOTE_URL);

    // assert
    assert.deepStrictEqual(credential, { cancel: true });
    assert.deepStrictEqual(credentials.calls, {
      fill: [{ host: HOST }],
      approve: [],
      reject: [],
    });
    assert.deepStrictEqual(logged, [`[auth] onAuth threw for ${HOST}: network down`]);
  });

  test("rejects an interactive credential and cancels the operation", async () => {
    // arrange
    const credential = { username: "x-access-token", password: "token" };
    const credentials = createCredentialOpsFake({ boundary: "memory" });
    const callbacks = buildAuthCallbacks({
      credentialOps: credentials.credentialOps,
      host: HOST,
      onAuthRequired: async () => {
        await Promise.resolve();
        return { ok: true, cred: credential, authAttempted: true };
      },
    });
    await callbacks.onAuth(REMOTE_URL);

    // act
    const cancellation = await callbacks.onAuthFailure(REMOTE_URL, credential);

    // assert
    assert.deepStrictEqual(cancellation, { cancel: true });
    assert.deepStrictEqual(credentials.calls, {
      fill: [{ host: HOST }],
      approve: [],
      reject: [{ host: HOST, credential }],
    });
  });

  test("rejects a stale credential and cancels without prior auth", async () => {
    // arrange
    const credential = { username: "stale", password: "expired" };
    const credentials = createCredentialOpsFake({
      boundary: "memory",
      credentials: [[HOST, credential]],
    });
    const callbacks = buildAuthCallbacks({
      credentialOps: credentials.credentialOps,
      host: HOST,
      onAuthRequired: () => {
        throw new Error("interactive auth is forbidden from onAuthFailure");
      },
    });

    // act
    const cancellation = await callbacks.onAuthFailure(REMOTE_URL, credential);

    // assert
    assert.deepStrictEqual(cancellation, { cancel: true });
    assert.deepStrictEqual(credentials.calls, {
      fill: [],
      approve: [],
      reject: [{ host: HOST, credential }],
    });
    assert.strictEqual(credentials.storedCredential(HOST), null);
  });

  test("cancels and logs when stale-credential rejection throws", async (t) => {
    // arrange
    const logged = captureDebugLog(t);
    const credential = { username: "stale", password: "expired" };
    const credentials = createCredentialOpsFake({
      boundary: "memory",
      rejectError: new Error("credential rejection failed"),
    });
    const callbacks = buildAuthCallbacks({
      credentialOps: credentials.credentialOps,
      host: HOST,
      onAuthRequired: () => {
        throw new Error("interactive auth is forbidden from onAuthFailure");
      },
    });

    // act
    const cancellation = await callbacks.onAuthFailure(REMOTE_URL, credential);

    // assert
    assert.deepStrictEqual(cancellation, { cancel: true });
    assert.deepStrictEqual(credentials.calls, {
      fill: [],
      approve: [],
      reject: [{ host: HOST, credential }],
    });
    assert.deepStrictEqual(logged, [
      `[auth] onAuthFailure: reject() threw for ${HOST}: credential rejection failed`,
    ]);
  });
});

describe("local Git operations", () => {
  test("reports the current branch after the initial commit", async (t) => {
    // arrange
    const repository = await createGitTestRepository(t, { boundary: "local" });

    // act
    const branch = await currentBranch({ dir: repository.dir });

    // assert
    assert.strictEqual(branch, "main");
  });

  test("resolves HEAD to the initial commit", async (t) => {
    // arrange
    const repository = await createGitTestRepository(t, { boundary: "local" });

    // act
    const oid = await resolveRef({ dir: repository.dir, ref: "HEAD" });

    // assert
    assert.strictEqual(oid, repository.initialOid);
  });

  test("lists local branches in deterministic order", async (t) => {
    // arrange
    const repository = await createGitTestRepository(t, { boundary: "local" });
    await git.writeRef({
      fs,
      dir: repository.dir,
      ref: "refs/heads/feature",
      value: repository.initialOid,
      force: true,
    });

    // act
    const branches = await listBranches({ dir: repository.dir });

    // assert
    assert.deepStrictEqual(branches, ["feature", "main"]);
  });

  test("lists branches for an explicit remote", async (t) => {
    // arrange
    const repository = await createGitTestRepository(t, { boundary: "local" });
    await git.writeRef({
      fs,
      dir: repository.dir,
      ref: "refs/remotes/origin/main",
      value: repository.initialOid,
      force: true,
    });

    // act
    const branches = await listBranches({ dir: repository.dir, remote: "origin" });

    // assert
    assert.deepStrictEqual(branches, ["main"]);
  });

  test("lists configured remotes as complete values", async (t) => {
    // arrange
    const repository = await createGitTestRepository(t, { boundary: "local" });
    await git.addRemote({
      fs,
      dir: repository.dir,
      remote: "origin",
      url: REMOTE_URL,
    });

    // act
    const remotes = await listRemotes({ dir: repository.dir });

    // assert
    assert.deepStrictEqual(remotes, [{ remote: "origin", url: REMOTE_URL }]);
  });

  test("lists remotes from an explicit git directory", async (t) => {
    // arrange
    const repository = await createGitTestRepository(t, { boundary: "local" });
    await git.addRemote({
      fs,
      dir: repository.dir,
      remote: "upstream",
      url: "https://git.example.invalid/upstream/repo.git",
    });

    // act
    const remotes = await listRemotes({
      dir: "/poisoned-working-tree",
      gitdir: repository.gitdir,
    });

    // assert
    assert.deepStrictEqual(remotes, [
      { remote: "upstream", url: "https://git.example.invalid/upstream/repo.git" },
    ]);
  });

  test("force-updates the requested local ref", async (t) => {
    // arrange
    const repository = await createGitTestRepository(t, { boundary: "local" });
    const nextOid = await repository.commit(
      [{ filepath: "README.md", contents: "# next\n" }],
      "next",
    );

    // act
    await forceUpdateRef({
      dir: repository.dir,
      ref: "refs/heads/release",
      value: nextOid,
    });

    // assert
    assert.strictEqual(
      await resolveRef({ dir: repository.dir, ref: "refs/heads/release" }),
      nextOid,
    );
  });

  test("checks out an existing branch", async (t) => {
    // arrange
    const repository = await createGitTestRepository(t, { boundary: "local" });
    await forceUpdateRef({
      dir: repository.dir,
      ref: "refs/heads/feature",
      value: repository.initialOid,
    });

    // act
    await checkout({ dir: repository.dir, ref: "feature" });

    // assert
    assert.strictEqual(await currentBranch({ dir: repository.dir }), "feature");
  });

  test("moves HEAD without checking out the worktree when requested", async (t) => {
    // arrange
    const repository = await createGitTestRepository(t, { boundary: "local" });
    const featureOid = await repository.commit(
      [{ filepath: "feature.txt", contents: "feature\n" }],
      "feature",
    );
    await forceUpdateRef({
      dir: repository.dir,
      ref: "refs/heads/feature",
      value: featureOid,
    });
    await checkout({ dir: repository.dir, ref: "main" });

    // act
    await checkout({ dir: repository.dir, ref: "feature", noCheckout: true });

    // assert
    assert.strictEqual(await currentBranch({ dir: repository.dir }), "feature");
  });
});

describe("clone", () => {
  test("forwards an explicit ref and single-branch option without auth", async (t) => {
    // arrange
    const requests = installFailedDiscoveryTransport(t);
    const repository = await createGitTestRepository(t, { boundary: "local" });

    // act
    const cloning = clone({
      dir: repository.dir,
      url: REMOTE_URL,
      ref: "main",
      singleBranch: true,
    });

    // assert
    await assert.rejects(cloning, (error: unknown) => isExpectedDiscoveryError(error, "git.clone"));
    assert.deepStrictEqual(requests, [expectedDiscoveryRequest()]);
  });

  test("retries an auth challenge with callbacks built from the supplied bundle", async (t) => {
    // arrange
    const requests = installFailedDiscoveryTransport(t, { challengeOnce: true });
    const repository = await createGitTestRepository(t, { boundary: "local" });
    const credentials = createCredentialOpsFake({
      boundary: "memory",
      credentials: [[HOST, { username: "user", password: "secret" }]],
    });

    // act
    const cloning = clone({
      dir: repository.dir,
      url: REMOTE_URL,
      auth: {
        credentialOps: credentials.credentialOps,
        host: HOST,
        onAuthRequired: () => {
          throw new Error("interactive auth is forbidden on a stored-credential hit");
        },
      },
    });

    // assert
    await assert.rejects(cloning, (error: unknown) => isExpectedDiscoveryError(error, "git.clone"));
    assert.deepStrictEqual(credentials.calls, {
      fill: [{ host: HOST }],
      approve: [],
      reject: [],
    });
    assert.deepStrictEqual(requests, [
      expectedDiscoveryRequest(),
      expectedDiscoveryRequest({ Authorization: "Basic dXNlcjpzZWNyZXQ=" }),
    ]);
  });
});

describe("fetch", () => {
  test("uses the default remote without auth", async (t) => {
    // arrange
    const requests = installFailedDiscoveryTransport(t);
    const repository = await createGitTestRepository(t, { boundary: "local" });
    await git.addRemote({ fs, dir: repository.dir, remote: "origin", url: REMOTE_URL });

    // act
    const fetching = fetch({ dir: repository.dir });

    // assert
    await assert.rejects(fetching, (error: unknown) =>
      isExpectedDiscoveryError(error, "git.fetch"),
    );
    assert.deepStrictEqual(requests, [expectedDiscoveryRequest()]);
  });

  test("forwards an explicit remote, ref, and auth bundle", async (t) => {
    // arrange
    const requests = installFailedDiscoveryTransport(t, { challengeOnce: true });
    const repository = await createGitTestRepository(t, { boundary: "local" });
    await git.addRemote({ fs, dir: repository.dir, remote: "upstream", url: REMOTE_URL });
    const credentials = createCredentialOpsFake({
      boundary: "memory",
      credentials: [[HOST, { username: "user", password: "secret" }]],
    });

    // act
    const fetching = fetch({
      dir: repository.dir,
      remote: "upstream",
      ref: "main",
      auth: {
        credentialOps: credentials.credentialOps,
        host: HOST,
        onAuthRequired: () => {
          throw new Error("interactive auth is forbidden on a stored-credential hit");
        },
      },
    });

    // assert
    await assert.rejects(fetching, (error: unknown) =>
      isExpectedDiscoveryError(error, "git.fetch"),
    );
    assert.deepStrictEqual(credentials.calls, {
      fill: [{ host: HOST }],
      approve: [],
      reject: [],
    });
    assert.deepStrictEqual(requests, [
      expectedDiscoveryRequest(),
      expectedDiscoveryRequest({ Authorization: "Basic dXNlcjpzZWNyZXQ=" }),
    ]);
  });
});

describe("resolveRemoteRef", () => {
  test("resolves the advertised remote HEAD", async (t) => {
    // arrange
    const requests = installRemoteTransport(t, FULL_ADVERTISEMENT);

    // act
    const oid = await resolveRemoteRef({ url: REMOTE_URL });

    // assert
    assert.strictEqual(oid, OID_MAIN);
    assert.deepStrictEqual(requests, expectedPublicRequests());
  });

  test("resolves a branch by its short name", async (t) => {
    // arrange
    const requests = installRemoteTransport(t, FULL_ADVERTISEMENT);

    // act
    const oid = await resolveRemoteRef({ url: REMOTE_URL, ref: "dev" });

    // assert
    assert.strictEqual(oid, OID_DEV);
    assert.deepStrictEqual(requests, expectedPublicRequests());
  });

  test("prefers an annotated tag's peeled commit", async (t) => {
    // arrange
    const requests = installRemoteTransport(t, FULL_ADVERTISEMENT);

    // act
    const oid = await resolveRemoteRef({ url: REMOTE_URL, ref: "v1.0.0" });

    // assert
    assert.strictEqual(oid, OID_PEELED);
    assert.deepStrictEqual(requests, expectedPublicRequests());
  });

  test("resolves a bare advertised ref name", async (t) => {
    // arrange
    const requests = installRemoteTransport(t, FULL_ADVERTISEMENT);

    // act
    const oid = await resolveRemoteRef({ url: REMOTE_URL, ref: "HEAD" });

    // assert
    assert.strictEqual(oid, OID_MAIN);
    assert.deepStrictEqual(requests, expectedPublicRequests());
  });

  test("rejects a remote without an advertised HEAD", async (t) => {
    // arrange
    const requests = installRemoteTransport(t, [`${OID_DEV} refs/heads/dev`]);

    // act
    const resolution = resolveRemoteRef({ url: REMOTE_URL });

    // assert
    await assert.rejects(resolution, {
      name: "Error",
      message: `remote ${REMOTE_URL} advertised no HEAD ref`,
    });
    assert.deepStrictEqual(requests, expectedPublicRequests());
  });

  test("rejects an unadvertised remote ref", async (t) => {
    // arrange
    const requests = installRemoteTransport(t, FULL_ADVERTISEMENT);

    // act
    const resolution = resolveRemoteRef({ url: REMOTE_URL, ref: "missing" });

    // assert
    await assert.rejects(resolution, {
      name: "Error",
      message: `remote ${REMOTE_URL} has no ref "missing"`,
    });
    assert.deepStrictEqual(requests, expectedPublicRequests());
  });

  test("keeps auth callbacks idle for a successful public response", async (t) => {
    // arrange
    const requests = installRemoteTransport(t, FULL_ADVERTISEMENT);
    const credentials = createCredentialOpsFake({ boundary: "memory" });
    const onAuthRequired: OnAuthRequiredFn = () => {
      throw new Error("interactive auth is forbidden for a successful public response");
    };

    // act
    const oid = await resolveRemoteRef({
      url: REMOTE_URL,
      ref: "main",
      auth: {
        credentialOps: credentials.credentialOps,
        host: HOST,
        onAuthRequired,
      },
    });

    // assert
    assert.strictEqual(oid, OID_MAIN);
    assert.deepStrictEqual(credentials.calls, { fill: [], approve: [], reject: [] });
    assert.deepStrictEqual(requests, expectedPublicRequests());
  });

  test("retries an authentication challenge with the exact credential header", async (t) => {
    // arrange
    const requests = installRemoteTransport(t, FULL_ADVERTISEMENT, { challengeOnce: true });
    const credentials = createCredentialOpsFake({
      boundary: "memory",
      credentials: [[HOST, { username: "user", password: "secret" }]],
    });
    const onAuthRequired: OnAuthRequiredFn = () => {
      throw new Error("interactive auth is forbidden on a stored-credential hit");
    };

    // act
    const oid = await resolveRemoteRef({
      url: REMOTE_URL,
      auth: {
        credentialOps: credentials.credentialOps,
        host: HOST,
        onAuthRequired,
      },
    });

    // assert
    assert.strictEqual(oid, OID_MAIN);
    assert.deepStrictEqual(credentials.calls, {
      fill: [{ host: HOST }],
      approve: [],
      reject: [],
    });
    assert.deepStrictEqual(requests, [
      expectedPublicRequests()[0],
      {
        ...expectedPublicRequests()[0],
        headers: {
          "Git-Protocol": "version=2",
          Authorization: "Basic dXNlcjpzZWNyZXQ=",
        },
      },
      {
        ...expectedPublicRequests()[1],
        headers: {
          ...expectedPublicRequests()[1]!.headers,
          Authorization: "Basic dXNlcjpzZWNyZXQ=",
        },
      },
    ]);
  });
});

describe("GitOps contract", () => {
  registerGitOpsContract(createProductionGitOps);
});

void ({ username: "user", password: "secret" } satisfies GitCredentials);

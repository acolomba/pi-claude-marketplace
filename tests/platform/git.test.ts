import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import * as fs from "node:fs";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import nodeHttp from "node:http";
import https from "node:https";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { join } from "node:path";
import { Readable } from "node:stream";
import { describe, test, type TestContext } from "node:test";

import * as git from "isomorphic-git";
import http from "isomorphic-git/http/node";
import { mock, verify } from "strong-mock";

import {
  checkout,
  clone,
  currentBranch,
  fetch,
  forceUpdateRef,
  listRemotes,
  listRemoteTags,
  listTags,
  resolveRef,
  resolveRemoteRef,
  resolveTagOid,
} from "../../extensions/pi-claude-marketplace/platform/git.ts";
import {
  CrossOriginChallengeError,
  TooManyRedirectsError,
} from "../../extensions/pi-claude-marketplace/shared/errors.ts";

import { createCredentialOpsFake } from "./credential-ops-fake.ts";
import { registerGitOpsContract } from "./git-ops-contract.ts";
import { createGitTestDirectory, createGitTestRepository } from "./git-test-repository.ts";

import type { CredentialOpsFake } from "./credential-ops-fake.ts";
import type { GitOpsContractParticipant } from "./git-ops-contract.ts";
import type { GitOps } from "../../extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts";
import type { OnAuthRequiredFn } from "../../extensions/pi-claude-marketplace/platform/git-auth-callbacks.ts";
import type * as GitPlatform from "../../extensions/pi-claude-marketplace/platform/git.ts";
import type {
  GitCredentials,
  RemoteTag,
} from "../../extensions/pi-claude-marketplace/platform/git.ts";
import type { GitHttpRequest, GitHttpResponse } from "isomorphic-git/http/node";

// The authentication-callback protocol lives in platform/git-auth-callbacks.ts;
// git.ts imports the factory rather than publishing it. Restoring the export
// makes the `satisfies` resolve and turns the directive below into an unused
// one (TS2578).
// @ts-expect-error platform/git.ts does not expose the auth-callback factory
void ({} satisfies { readonly retired?: typeof GitPlatform.buildAuthCallbacks });

// The branch enumeration wrapper had no production caller: no module outside
// this file ever imported it, and it does not appear in the GitOps surface
// the orchestrators inject. Restoring the export makes the `satisfies`
// resolve and turns the directive into an unused one (TS2578).
// @ts-expect-error platform/git.ts does not expose a branch-listing wrapper
void ({} satisfies { readonly retired?: typeof GitPlatform.listBranches });
// @ts-expect-error platform/git.ts does not expose branch-listing options
void ({} satisfies { readonly retired?: GitPlatform.ListBranchesOptions });

const HOST = "git.example.invalid";
const REMOTE_URL = `https://${HOST}/owner/repo.git`;
const OTHER_HOST = "other.example.invalid";
const OTHER_REMOTE_URL = `https://${OTHER_HOST}/owner/repo.git`;
const OID_MAIN = "1111111111111111111111111111111111111111";
const OID_DEV = "2222222222222222222222222222222222222222";
const OID_TAG = "3333333333333333333333333333333333333333";
const OID_PEELED = "4444444444444444444444444444444444444444";
const OID_LIGHTWEIGHT = "5555555555555555555555555555555555555555";
const FLUSH = Buffer.from("0000", "utf8");
const DELIM = Buffer.from("0001", "utf8");
// Hand-authored rather than imported from the module under test: feeding the
// module's own literal back in could not fail.
const TAG_REF_PREFIX = "refs/tags/";

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

/**
 * Removes the `agent=` capability from a pkt-line body.
 *
 * isomorphic-git advertises its own package version in that capability, so a
 * byte-exact body assertion would otherwise pin these tests to whichever
 * version happens to be installed.
 */
function withoutAgentPacket(body: Buffer): Buffer {
  const kept: Buffer[] = [];
  let offset = 0;

  while (offset + 4 <= body.length) {
    const declared = Number.parseInt(body.toString("utf8", offset, offset + 4), 16);
    // A flush ("0000") and a delimiter ("0001") declare no payload of their own.
    const size = declared < 4 ? 4 : declared;
    const line = body.subarray(offset, offset + size);

    if (!line.toString("utf8", 4).startsWith("agent=")) {
      kept.push(line);
    }

    offset += size;
  }

  return Buffer.concat(kept);
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
    DELIM,
    packet("peel"),
    packet("symrefs"),
    FLUSH,
  ]);
}

/**
 * The ls-refs command a tag listing sends: peeling on, no symrefs, and the
 * server-side ref-prefix that makes the advertisement the `--tags` equivalent.
 */
function expectedListTagsBody(): Buffer {
  return Buffer.concat([
    packet("command=ls-refs\n"),
    DELIM,
    packet("peel"),
    packet(`ref-prefix ${TAG_REF_PREFIX}`),
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
  options: { readonly challengeOnce?: boolean; readonly remoteUrl?: string } = {},
): RecordedHttpRequest[] {
  const requests: RecordedHttpRequest[] = [];
  const remoteUrl = options.remoteUrl ?? REMOTE_URL;
  let challenged = false;

  t.mock.method(http, "request", async (request: GitHttpRequest): Promise<GitHttpResponse> => {
    const body = await collectBody(request.body);
    requests.push({
      url: request.url,
      method: request.method,
      headers: { ...(request.headers ?? {}) },
      body: withoutAgentPacket(body),
    });

    const infoUrl = `${remoteUrl}/info/refs?service=git-upload-pack`;
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

    if (request.url === `${remoteUrl}/git-upload-pack` && request.method === "POST") {
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
  listRemotes,
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

function isUserCanceledError(error: unknown): boolean {
  assert.ok(error instanceof git.Errors.UserCanceledError);
  assert.strictEqual(error.code, "UserCanceledError");
  return true;
}

/** The urls of the recorded requests that carried a credential header. */
function requestsCarryingAuthorization(
  requests: readonly RecordedHttpRequest[],
): readonly string[] {
  return requests.filter((r) => "Authorization" in r.headers).map((r) => r.url);
}

function expectedPublicRequests(): readonly [RecordedHttpRequest, RecordedHttpRequest] {
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

/**
 * The same two-request envelope a ref resolution sends, carrying the tag
 * listing's own ls-refs command instead.
 */
function expectedTagRequests(): readonly [RecordedHttpRequest, RecordedHttpRequest] {
  const [discovery, listRefs] = expectedPublicRequests();
  return [discovery, { ...listRefs, body: expectedListTagsBody() }];
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

const INFO_REFS_PATH = "/info/refs?service=git-upload-pack";
const BOUND_INFO_URL = `${REMOTE_URL}${INFO_REFS_PATH}`;
const BOUND_UPLOAD_PACK_URL = `${REMOTE_URL}/git-upload-pack`;
const RENAMED_REMOTE_URL = `https://${HOST}/renamed/repo.git`;
const RENAMED_INFO_URL = `${RENAMED_REMOTE_URL}${INFO_REFS_PATH}`;
const RENAMED_UPLOAD_PACK_URL = `${RENAMED_REMOTE_URL}/git-upload-pack`;
const OTHER_PORT_INFO_URL = `https://${HOST}:8443/owner/repo.git${INFO_REFS_PATH}`;
const OTHER_PORT_UPLOAD_PACK_URL = `https://${HOST}:8443/owner/repo.git/git-upload-pack`;
const HTTP_SAME_HOST_UPLOAD_PACK_URL = `http://${HOST}/owner/repo.git/git-upload-pack`;
const OTHER_HOST_UPLOAD_PACK_URL = `${OTHER_REMOTE_URL}/git-upload-pack`;
const BASIC_CREDENTIAL = "Basic dXNlcjpzZWNyZXQ=";

/** The options `simple-get` passes to the `request` function of `node:https` and `node:http`. */
interface WireRequestOptions {
  readonly protocol: string;
  readonly hostname: string;
  readonly port: string | null;
  readonly path: string;
  readonly method: string;
  readonly headers: Readonly<Record<string, string | number>>;
}

/** One request as it reaches the socket. Node lower-cases every header name. */
interface WireRequest {
  readonly url: string;
  readonly method: string;
  readonly headers: Readonly<Record<string, string | number>>;
  readonly body: Buffer;
}

/** The answer a wire double gives to one request. */
interface WireResponse {
  readonly statusCode: number;
  readonly statusMessage: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: Buffer;
}

/** A redirect case: what the redirect is about, and its `Location` header. */
interface RedirectRow {
  readonly kind: string;
  readonly location: string;
}

/** A cross-origin redirect case, with the origin its `Location` names. */
interface CrossOriginRedirectRow extends RedirectRow {
  readonly origin: string;
}

/** How `git-upload-pack` is re-sent after its POST is redirected. */
interface PostRedirectRow {
  readonly title: string;
  readonly statusCode: number;
  readonly finalMethod: string;
  readonly finalBody: Buffer;
  readonly finalContentHeaders: readonly string[];
}

/**
 * Replaces the socket door of both `node:https` and `node:http`.
 *
 * The real `simple-get`, `isomorphic-git/http/node` and isomorphic-git all
 * run, so every hop a redirect produces reaches `serve` as its own request.
 * `simple-get` picks the module by scheme, which is why both are replaced.
 */
function installWireTransport(
  t: TestContext,
  serve: (request: WireRequest) => WireResponse,
): WireRequest[] {
  const requests: WireRequest[] = [];

  function request(
    options: WireRequestOptions,
    onResponse: (response: Readable) => void,
  ): EventEmitter {
    const url = new URL(options.path, `${options.protocol}//${options.hostname}`);
    url.port = options.port ?? "";

    return Object.assign(new EventEmitter(), {
      end(body: Buffer = Buffer.alloc(0)): void {
        const wireRequest = {
          url: url.href,
          method: options.method,
          headers: { ...options.headers },
          body,
        };
        requests.push(wireRequest);
        const answer = serve(wireRequest);
        setImmediate(() => {
          onResponse(
            Object.assign(Readable.from([answer.body]), {
              statusCode: answer.statusCode,
              statusMessage: answer.statusMessage,
              headers: answer.headers,
            }),
          );
        });
      },
    });
  }

  t.mock.method(https, "request", request);
  t.mock.method(nodeHttp, "request", request);
  return requests;
}

function unauthorizedWireResponse(): WireResponse {
  return { statusCode: 401, statusMessage: "Unauthorized", headers: {}, body: Buffer.alloc(0) };
}

function redirectWireResponse(statusCode: number, location: string): WireResponse {
  return {
    statusCode,
    statusMessage: "Redirect",
    headers: { location },
    body: Buffer.from("moved"),
  };
}

function advertisementWireResponse(): WireResponse {
  return {
    statusCode: 200,
    statusMessage: "OK",
    headers: { "content-type": "application/x-git-upload-pack-advertisement" },
    body: advertisementBody(),
  };
}

function refsWireResponse(): WireResponse {
  return {
    statusCode: 200,
    statusMessage: "OK",
    headers: { "content-type": "application/x-git-upload-pack-result" },
    body: refsBody(FULL_ADVERTISEMENT),
  };
}

function unplannedWireRequest(request: WireRequest): Error {
  return new Error(`unplanned wire request: ${request.method} ${request.url}`);
}

/** The bound host redirects `info/refs` to `location`; every other request is challenged. */
function crossOriginServer(
  location: string,
  challenge: () => WireResponse = unauthorizedWireResponse,
): (request: WireRequest) => WireResponse {
  return (request) =>
    request.url === BOUND_INFO_URL ? redirectWireResponse(302, location) : challenge();
}

/**
 * The bound host redirects `info/refs` to `location`, inside its own origin.
 * The renamed `info/refs` and the bound `git-upload-pack` answer only a
 * request that carries a credential.
 */
function sameOriginServer(location: string): (request: WireRequest) => WireResponse {
  return (request) => {
    if (request.url === BOUND_INFO_URL) {
      return redirectWireResponse(302, location);
    }

    if (request.headers.authorization === undefined) {
      return unauthorizedWireResponse();
    }

    if (request.url === RENAMED_INFO_URL) {
      return advertisementWireResponse();
    }

    if (request.url === BOUND_UPLOAD_PACK_URL) {
      return refsWireResponse();
    }

    throw unplannedWireRequest(request);
  };
}

/** The bound host redirects its `git-upload-pack` POST to the renamed repository. */
function postRedirectServer(statusCode: number): (request: WireRequest) => WireResponse {
  return (request) => {
    if (request.url === BOUND_INFO_URL) {
      return advertisementWireResponse();
    }

    if (request.url === BOUND_UPLOAD_PACK_URL) {
      return redirectWireResponse(statusCode, RENAMED_UPLOAD_PACK_URL);
    }

    if (request.url === RENAMED_UPLOAD_PACK_URL) {
      return refsWireResponse();
    }

    throw unplannedWireRequest(request);
  };
}

/**
 * The bound host challenges `info/refs`, then redirects the authenticated
 * `git-upload-pack` POST to `location`. `respondAtLocation` answers whatever
 * request reaches `location`, so a same-origin control can require the
 * credential while a cross-origin row proves it never arrives (GAUTH-06).
 */
function authenticatedPostRedirectServer(
  statusCode: number,
  location: string,
  respondAtLocation: (request: WireRequest) => WireResponse,
): (request: WireRequest) => WireResponse {
  return (request) => {
    if (request.url === BOUND_INFO_URL) {
      return request.headers.authorization === undefined
        ? unauthorizedWireResponse()
        : advertisementWireResponse();
    }

    if (request.url === BOUND_UPLOAD_PACK_URL) {
      return request.headers.authorization === undefined
        ? unauthorizedWireResponse()
        : redirectWireResponse(statusCode, location);
    }

    if (request.url === location) {
      return respondAtLocation(request);
    }

    throw unplannedWireRequest(request);
  };
}

/** A credential fake whose helper holds `user:secret` for the bound host. */
function storedCredentials(): CredentialOpsFake {
  return createCredentialOpsFake({
    boundary: "memory",
    credentials: [[HOST, { username: "user", password: "secret" }]],
  });
}

/** The auth bundle bound to `HOST`: no eviction, and no interactive fallback. */
function boundAuth(credentials: CredentialOpsFake): NonNullable<GitPlatform.CloneOptions["auth"]> {
  return {
    credentialOps: credentials.credentialOps,
    host: HOST,
    kind: "stored-credential",
  };
}

/** The url of each wire request and the credential header it carried, or null. */
function wireCredentials(
  requests: readonly WireRequest[],
): Array<{ readonly url: string; readonly authorization: string | number | null }> {
  return requests.map(({ url, headers }) => ({
    url,
    authorization: headers.authorization ?? null,
  }));
}

/** The wire log of a challenge from `location`, on another origin, that fails before any credential. */
function expectedCrossOriginWireLog(
  location: string,
): Array<{ readonly url: string; readonly authorization: string | null }> {
  return [
    { url: BOUND_INFO_URL, authorization: null },
    { url: location, authorization: null },
  ];
}

/** Q-02: accepts only the cross-origin challenge failure naming `origin`. */
function crossOriginChallengeFrom(origin: string): (error: unknown) => boolean {
  return (error) => {
    assert.ok(error instanceof CrossOriginChallengeError);
    assert.strictEqual(
      error.message,
      `redirected request to ${origin} asked for credentials; a credential is not sent after a redirect to another origin`,
    );
    return true;
  };
}

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

  test("forwards force so a checkout into an empty work tree writes the target tree", async (t) => {
    // arrange
    const repository = await createGitTestRepository(t, { boundary: "local" });
    const staging = await mkdtemp(join(tmpdir(), "pi-cm-git-force-checkout-"));
    t.after(() => rm(staging, { recursive: true, force: true }));
    await cp(join(repository.dir, ".git"), join(staging, ".git"), { recursive: true });

    // act
    await checkout({ dir: staging, ref: repository.initialOid, force: true });

    // assert
    assert.strictEqual(fs.existsSync(join(staging, "README.md")), true);
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
        kind: "device-flow",
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

  test("Q-02: fails a challenge from another port of the same host without a credential lookup", async (t) => {
    // arrange
    const requests = installWireTransport(t, crossOriginServer(OTHER_PORT_INFO_URL));
    const directory = await createGitTestDirectory(t, { boundary: "local" });
    const credentials = storedCredentials();

    // act
    const cloning = clone({ dir: directory, url: REMOTE_URL, auth: boundAuth(credentials) });

    // assert
    await assert.rejects(cloning, crossOriginChallengeFrom(`https://${HOST}:8443`));
    assert.deepStrictEqual(
      wireCredentials(requests),
      expectedCrossOriginWireLog(OTHER_PORT_INFO_URL),
    );
    assert.deepStrictEqual(credentials.calls, { fill: [], approve: [], reject: [] });
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
        kind: "device-flow",
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

  test("Q-02: fails a challenge from another port of the same host without a credential lookup", async (t) => {
    // arrange
    const requests = installWireTransport(t, crossOriginServer(OTHER_PORT_INFO_URL));
    const repository = await createGitTestRepository(t, { boundary: "local" });
    await git.addRemote({ fs, dir: repository.dir, remote: "origin", url: REMOTE_URL });
    const credentials = storedCredentials();

    // act
    const fetching = fetch({ dir: repository.dir, auth: boundAuth(credentials) });

    // assert
    await assert.rejects(fetching, crossOriginChallengeFrom(`https://${HOST}:8443`));
    assert.deepStrictEqual(
      wireCredentials(requests),
      expectedCrossOriginWireLog(OTHER_PORT_INFO_URL),
    );
    assert.deepStrictEqual(credentials.calls, { fill: [], approve: [], reject: [] });
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
        kind: "device-flow",
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
        kind: "device-flow",
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
          ...expectedPublicRequests()[1].headers,
          Authorization: "Basic dXNlcjpzZWNyZXQ=",
        },
      },
    ]);
  });

  test("cancels a challenge the bundle cannot answer and sends no credential", async (t) => {
    // arrange
    const requests = installRemoteTransport(t, FULL_ADVERTISEMENT, { challengeOnce: true });
    const credentials = createCredentialOpsFake({ boundary: "memory" });
    const onAuthRequired: OnAuthRequiredFn = async () => {
      await Promise.resolve();
      return {
        ok: false,
        reason: "no credential was obtained for git.example.invalid",
        authAttempted: true,
      };
    };

    // act
    const resolution = resolveRemoteRef({
      url: REMOTE_URL,
      ref: "main",
      auth: {
        credentialOps: credentials.credentialOps,
        host: HOST,
        kind: "device-flow",
        onAuthRequired,
      },
    });

    // assert
    await assert.rejects(resolution, isUserCanceledError);
    assert.deepStrictEqual(credentials.calls, {
      fill: [{ host: HOST }],
      approve: [],
      reject: [],
    });
    assert.deepStrictEqual(requests, [expectedPublicRequests()[0]]);
    assert.deepStrictEqual(requestsCarryingAuthorization(requests), []);
  });

  test("cancels a challenge from a url on another host without querying the helper", async (t) => {
    // arrange
    const requests = installRemoteTransport(t, FULL_ADVERTISEMENT, {
      challengeOnce: true,
      remoteUrl: OTHER_REMOTE_URL,
    });
    const credentials = createCredentialOpsFake({
      boundary: "memory",
      credentials: [[HOST, { username: "user", password: "secret" }]],
    });
    const onAuthRequired: OnAuthRequiredFn = () => {
      throw new Error("interactive auth is forbidden on a host mismatch");
    };

    // act
    const resolution = resolveRemoteRef({
      url: OTHER_REMOTE_URL,
      ref: "main",
      auth: {
        credentialOps: credentials.credentialOps,
        host: HOST,
        kind: "device-flow",
        onAuthRequired,
      },
    });

    // assert
    await assert.rejects(resolution, isUserCanceledError);
    assert.deepStrictEqual(credentials.calls, { fill: [], approve: [], reject: [] });
    assert.deepStrictEqual(requests, [
      {
        ...expectedPublicRequests()[0],
        url: `${OTHER_REMOTE_URL}/info/refs?service=git-upload-pack`,
      },
    ]);
    assert.deepStrictEqual(requestsCarryingAuthorization(requests), []);
  });

  const CROSS_ORIGIN_REDIRECTS: readonly CrossOriginRedirectRow[] = [
    {
      kind: "another port of the same host",
      location: OTHER_PORT_INFO_URL,
      origin: `https://${HOST}:8443`,
    },
    {
      kind: "http on the same host",
      location: `http://${HOST}/owner/repo.git${INFO_REFS_PATH}`,
      origin: `http://${HOST}`,
    },
    {
      kind: "another host",
      location: `${OTHER_REMOTE_URL}${INFO_REFS_PATH}`,
      origin: `https://${OTHER_HOST}`,
    },
  ];

  for (const { kind, location, origin } of CROSS_ORIGIN_REDIRECTS) {
    test(`Q-02: fails a challenge after a redirect to ${kind} without a credential lookup`, async (t) => {
      // arrange
      const requests = installWireTransport(t, crossOriginServer(location));
      const credentials = storedCredentials();

      // act
      const resolution = resolveRemoteRef({ url: REMOTE_URL, auth: boundAuth(credentials) });

      // assert
      await assert.rejects(resolution, crossOriginChallengeFrom(origin));
      assert.deepStrictEqual(wireCredentials(requests), expectedCrossOriginWireLog(location));
      assert.deepStrictEqual(credentials.calls, { fill: [], approve: [], reject: [] });
    });
  }

  test("Q-02: fails a cross-origin challenge without starting a Device Flow", async (t) => {
    // arrange
    const requests = installWireTransport(t, crossOriginServer(OTHER_PORT_INFO_URL));
    const credentials = storedCredentials();
    const onAuthRequired = mock<OnAuthRequiredFn>({ exactParams: true, name: "device flow" });

    // act
    const resolution = resolveRemoteRef({
      url: REMOTE_URL,
      auth: {
        credentialOps: credentials.credentialOps,
        host: HOST,
        kind: "device-flow",
        onAuthRequired,
      },
    });

    // assert
    await assert.rejects(resolution, crossOriginChallengeFrom(`https://${HOST}:8443`));
    assert.deepStrictEqual(
      wireCredentials(requests),
      expectedCrossOriginWireLog(OTHER_PORT_INFO_URL),
    );
    assert.deepStrictEqual(credentials.calls, { fill: [], approve: [], reject: [] });
    verify(onAuthRequired);
  });

  test("Q-02: fails a 203 from another origin the same way as a 401", async (t) => {
    // arrange
    const requests = installWireTransport(
      t,
      crossOriginServer(OTHER_PORT_INFO_URL, () => ({
        statusCode: 203,
        statusMessage: "Non-Authoritative Information",
        headers: {},
        body: Buffer.alloc(0),
      })),
    );
    const credentials = storedCredentials();

    // act
    const resolution = resolveRemoteRef({ url: REMOTE_URL, auth: boundAuth(credentials) });

    // assert
    await assert.rejects(resolution, crossOriginChallengeFrom(`https://${HOST}:8443`));
    assert.deepStrictEqual(
      wireCredentials(requests),
      expectedCrossOriginWireLog(OTHER_PORT_INFO_URL),
    );
    assert.deepStrictEqual(credentials.calls, { fill: [], approve: [], reject: [] });
  });

  test("Q-02: fails a challenge back on the original origin after a detour through another origin", async (t) => {
    // arrange
    const requests = installWireTransport(t, (request) => {
      if (request.url === BOUND_INFO_URL) {
        return request.headers.authorization === undefined
          ? unauthorizedWireResponse()
          : redirectWireResponse(302, OTHER_PORT_INFO_URL);
      }

      if (request.url === OTHER_PORT_INFO_URL) {
        return redirectWireResponse(302, RENAMED_INFO_URL);
      }

      if (request.url === RENAMED_INFO_URL) {
        return request.headers.authorization === undefined
          ? unauthorizedWireResponse()
          : advertisementWireResponse();
      }

      throw unplannedWireRequest(request);
    });
    const credentials = storedCredentials();
    const onAuthRequired = mock<OnAuthRequiredFn>({ exactParams: true, name: "device flow" });

    // act
    const resolution = resolveRemoteRef({
      url: REMOTE_URL,
      auth: {
        credentialOps: credentials.credentialOps,
        host: HOST,
        kind: "device-flow",
        onAuthRequired,
      },
    });

    // assert
    await assert.rejects(resolution, crossOriginChallengeFrom(`https://${HOST}`));
    assert.deepStrictEqual(wireCredentials(requests), [
      { url: BOUND_INFO_URL, authorization: null },
      { url: BOUND_INFO_URL, authorization: BASIC_CREDENTIAL },
      { url: OTHER_PORT_INFO_URL, authorization: null },
      { url: RENAMED_INFO_URL, authorization: null },
    ]);
    assert.deepStrictEqual(credentials.calls, { fill: [{ host: HOST }], approve: [], reject: [] });
    verify(onAuthRequired);
  });

  test("WR-03: keeps only protocol headers on a hop to another origin", async (t) => {
    // arrange
    const requests = installWireTransport(t, (request) => {
      if (request.url === BOUND_INFO_URL) {
        return request.headers.authorization === undefined
          ? unauthorizedWireResponse()
          : redirectWireResponse(302, OTHER_PORT_INFO_URL);
      }

      if (request.url === OTHER_PORT_INFO_URL) {
        return advertisementWireResponse();
      }

      if (request.url === BOUND_UPLOAD_PACK_URL && request.headers.authorization !== undefined) {
        return refsWireResponse();
      }

      throw unplannedWireRequest(request);
    });
    const credentials = createCredentialOpsFake({
      boundary: "memory",
      credentials: [
        [
          HOST,
          {
            username: "user",
            password: "secret",
            headers: { cookie: "session=1", "private-token": "token-1" },
          },
        ],
      ],
    });

    // act
    const oid = await resolveRemoteRef({ url: REMOTE_URL, auth: boundAuth(credentials) });

    // assert
    assert.strictEqual(oid, OID_MAIN);
    assert.deepStrictEqual(
      requests.map(({ url, headers }) => ({
        url,
        authorization: headers.authorization ?? null,
        cookie: headers.cookie ?? null,
        privateToken: headers["private-token"] ?? null,
      })),
      [
        { url: BOUND_INFO_URL, authorization: null, cookie: null, privateToken: null },
        {
          url: BOUND_INFO_URL,
          authorization: BASIC_CREDENTIAL,
          cookie: "session=1",
          privateToken: "token-1",
        },
        { url: OTHER_PORT_INFO_URL, authorization: null, cookie: null, privateToken: null },
        {
          url: BOUND_UPLOAD_PACK_URL,
          authorization: BASIC_CREDENTIAL,
          cookie: "session=1",
          privateToken: "token-1",
        },
      ],
    );
    assert.deepStrictEqual(Object.keys(requests[2]?.headers ?? {}).sort(), [
      "accept-encoding",
      "git-protocol",
    ]);
  });

  const SAME_ORIGIN_REDIRECTS: readonly RedirectRow[] = [
    { kind: "another path", location: RENAMED_INFO_URL },
    { kind: "a relative location", location: `/renamed/repo.git${INFO_REFS_PATH}` },
    {
      kind: "an explicit default port",
      location: `https://${HOST}:443/renamed/repo.git${INFO_REFS_PATH}`,
    },
  ];

  for (const { kind, location } of SAME_ORIGIN_REDIRECTS) {
    test(`GAUTH-06: forwards the credential on a redirect within its origin (${kind})`, async (t) => {
      // arrange
      const requests = installWireTransport(t, sameOriginServer(location));
      const credentials = storedCredentials();

      // act
      const oid = await resolveRemoteRef({ url: REMOTE_URL, auth: boundAuth(credentials) });

      // assert
      assert.strictEqual(oid, OID_MAIN);
      assert.deepStrictEqual(wireCredentials(requests), [
        { url: BOUND_INFO_URL, authorization: null },
        { url: RENAMED_INFO_URL, authorization: null },
        { url: BOUND_INFO_URL, authorization: BASIC_CREDENTIAL },
        { url: RENAMED_INFO_URL, authorization: BASIC_CREDENTIAL },
        { url: BOUND_UPLOAD_PACK_URL, authorization: BASIC_CREDENTIAL },
      ]);
    });
  }

  const POST_REDIRECTS: readonly PostRedirectRow[] = [
    {
      title: "re-sends a POST answered with 302 as a GET without its body",
      statusCode: 302,
      finalMethod: "GET",
      finalBody: Buffer.alloc(0),
      finalContentHeaders: [],
    },
    {
      title: "re-sends a POST answered with 307 with its body",
      statusCode: 307,
      finalMethod: "POST",
      finalBody: expectedListRefsBody(),
      finalContentHeaders: ["content-length", "content-type"],
    },
  ];

  for (const { title, statusCode, finalMethod, finalBody, finalContentHeaders } of POST_REDIRECTS) {
    test(title, async (t) => {
      // arrange
      const requests = installWireTransport(t, postRedirectServer(statusCode));

      // act
      const oid = await resolveRemoteRef({ url: REMOTE_URL });

      // assert
      assert.strictEqual(oid, OID_MAIN);
      assert.deepStrictEqual(
        requests.map(({ method, url }) => `${method} ${url}`),
        [
          `GET ${BOUND_INFO_URL}`,
          `POST ${BOUND_UPLOAD_PACK_URL}`,
          `${finalMethod} ${RENAMED_UPLOAD_PACK_URL}`,
        ],
      );
      assert.deepStrictEqual(
        requests.slice(-1).map(({ headers, body }) => ({
          body: withoutAgentPacket(body),
          contentHeaders: Object.keys(headers)
            .filter((name) => name.startsWith("content-"))
            .sort(),
        })),
        [{ body: finalBody, contentHeaders: finalContentHeaders }],
      );
    });
  }

  // GAUTH-06 rows: what happens to the credential when the *authenticated*
  // git-upload-pack POST -- not just info/refs -- is redirected. A wrong
  // `nextHop` that scrubs credential headers only on GET hops, or only on
  // the POST->GET (302/303) arm, would leave `authorization` on the 307 row.
  const CROSS_ORIGIN_POST_REDIRECTS: readonly CrossOriginRedirectRow[] = [
    {
      kind: "another port of the same host (POST kept, 307)",
      location: OTHER_PORT_UPLOAD_PACK_URL,
      origin: `https://${HOST}:8443`,
    },
    {
      kind: "http on the same host",
      location: HTTP_SAME_HOST_UPLOAD_PACK_URL,
      origin: `http://${HOST}`,
    },
    {
      kind: "another host",
      location: OTHER_HOST_UPLOAD_PACK_URL,
      origin: `https://${OTHER_HOST}`,
    },
  ];

  for (const { kind, location, origin } of CROSS_ORIGIN_POST_REDIRECTS) {
    test(`GAUTH-06: does not forward the credential on a git-upload-pack POST redirect to ${kind}`, async (t) => {
      // arrange
      const requests = installWireTransport(
        t,
        authenticatedPostRedirectServer(307, location, () => unauthorizedWireResponse()),
      );
      const credentials = storedCredentials();

      // act
      const resolution = resolveRemoteRef({ url: REMOTE_URL, auth: boundAuth(credentials) });

      // assert
      await assert.rejects(resolution, crossOriginChallengeFrom(origin));
      assert.deepStrictEqual(wireCredentials(requests), [
        { url: BOUND_INFO_URL, authorization: null },
        { url: BOUND_INFO_URL, authorization: BASIC_CREDENTIAL },
        { url: BOUND_UPLOAD_PACK_URL, authorization: BASIC_CREDENTIAL },
        { url: location, authorization: null },
      ]);
    });
  }

  test("GAUTH-06: does not forward the credential on a git-upload-pack POST redirect to another port (302, POST->GET)", async (t) => {
    // arrange
    const requests = installWireTransport(
      t,
      authenticatedPostRedirectServer(302, OTHER_PORT_UPLOAD_PACK_URL, () =>
        unauthorizedWireResponse(),
      ),
    );
    const credentials = storedCredentials();

    // act
    const resolution = resolveRemoteRef({ url: REMOTE_URL, auth: boundAuth(credentials) });

    // assert
    await assert.rejects(resolution, crossOriginChallengeFrom(`https://${HOST}:8443`));
    assert.deepStrictEqual(wireCredentials(requests), [
      { url: BOUND_INFO_URL, authorization: null },
      { url: BOUND_INFO_URL, authorization: BASIC_CREDENTIAL },
      { url: BOUND_UPLOAD_PACK_URL, authorization: BASIC_CREDENTIAL },
      { url: OTHER_PORT_UPLOAD_PACK_URL, authorization: null },
    ]);
  });

  test("GAUTH-06: forwards the credential on a git-upload-pack POST redirect within its origin (307)", async (t) => {
    // arrange
    const requests = installWireTransport(
      t,
      authenticatedPostRedirectServer(307, RENAMED_UPLOAD_PACK_URL, (request) =>
        request.headers.authorization === undefined
          ? unauthorizedWireResponse()
          : refsWireResponse(),
      ),
    );
    const credentials = storedCredentials();

    // act
    const oid = await resolveRemoteRef({ url: REMOTE_URL, auth: boundAuth(credentials) });

    // assert
    assert.strictEqual(oid, OID_MAIN);
    assert.deepStrictEqual(wireCredentials(requests), [
      { url: BOUND_INFO_URL, authorization: null },
      { url: BOUND_INFO_URL, authorization: BASIC_CREDENTIAL },
      { url: BOUND_UPLOAD_PACK_URL, authorization: BASIC_CREDENTIAL },
      { url: RENAMED_UPLOAD_PACK_URL, authorization: BASIC_CREDENTIAL },
    ]);
  });

  const UNUSABLE_LOCATIONS: ReadonlyArray<{
    readonly kind: string;
    readonly headers: Readonly<Record<string, string>>;
  }> = [
    { kind: "no Location header", headers: {} },
    { kind: "an empty Location", headers: { location: "" } },
    { kind: "a Location that is not a URL", headers: { location: "https://exa mple:99999/" } },
  ];

  for (const { kind, headers } of UNUSABLE_LOCATIONS) {
    test(`WR-04: returns a redirect with ${kind} to isomorphic-git as an HttpError`, async (t) => {
      // arrange
      const requests = installWireTransport(t, () => ({
        statusCode: 302,
        statusMessage: "Found",
        headers,
        body: Buffer.alloc(0),
      }));

      // act
      const resolution = resolveRemoteRef({ url: REMOTE_URL });

      // assert
      await assert.rejects(resolution, (error: unknown) => {
        assert.ok(error instanceof git.Errors.HttpError);
        assert.deepStrictEqual(error.data, {
          statusCode: 302,
          statusMessage: "Found",
          response: "",
        });
        return true;
      });
      assert.deepStrictEqual(
        requests.map(({ url }) => url),
        [BOUND_INFO_URL],
      );
    });
  }

  test("IN-03: rejects an eleventh consecutive redirect with TooManyRedirectsError", async (t) => {
    // arrange
    const requests = installWireTransport(t, () => redirectWireResponse(302, BOUND_INFO_URL));

    // act
    const resolution = resolveRemoteRef({ url: REMOTE_URL });

    // assert
    await assert.rejects(resolution, (error: unknown) => {
      assert.ok(error instanceof TooManyRedirectsError);
      return true;
    });
    assert.deepStrictEqual(
      requests.map(({ url }) => url),
      Array.from({ length: 11 }, () => BOUND_INFO_URL),
    );
  });
});

describe("listRemotes", () => {
  test("reports the origin remote url of a real repository", async (t) => {
    // arrange
    const repository = await createGitTestRepository(t, { boundary: "local" });
    await git.addRemote({ fs, dir: repository.dir, remote: "origin", url: REMOTE_URL });

    // act
    const remotes = await listRemotes({ dir: repository.dir });

    // assert
    assert.deepStrictEqual(remotes, { kind: "origin", url: REMOTE_URL });
  });

  // The not-a-repo and no-origin arms are distinguished by the wrapper's own
  // `.git/config` read, not by anything isomorphic-git reports -- kept
  // adjacent so a future reader sees both cases the probe read exists for.
  test("reports not-a-repo for a directory with no .git", async (t) => {
    // arrange
    const directory = await createGitTestDirectory(t, { boundary: "local" });

    // act
    const remotes = await listRemotes({ dir: directory });

    // assert
    assert.deepStrictEqual(remotes, { kind: "not-a-repo" });
  });

  test("reports no-origin for a real repository with no remote configured", async (t) => {
    // arrange
    const repository = await createGitTestRepository(t, { boundary: "local" });

    // act
    const remotes = await listRemotes({ dir: repository.dir });

    // assert
    assert.deepStrictEqual(remotes, { kind: "no-origin" });
  });

  test("reports unreadable for a .git/config that cannot be read as a file", async (t) => {
    // arrange
    const repository = await createGitTestRepository(t, { boundary: "local" });
    const configPath = path.join(repository.dir, ".git", "config");
    await rm(configPath);
    await mkdir(configPath);

    // act
    const remotes = await listRemotes({ dir: repository.dir });

    // assert
    assert.deepStrictEqual(remotes, { kind: "unreadable" });
  });

  for (const code of ["EACCES", "EPERM"]) {
    test(`reports permission-denied when reading .git/config fails with ${code}`, async (t) => {
      // arrange
      const repository = await createGitTestRepository(t, { boundary: "local" });
      t.mock.method(fs.promises, "readFile", () =>
        Promise.reject(Object.assign(new Error(`${code}: operation not permitted`), { code })),
      );

      // act
      const remotes = await listRemotes({ dir: repository.dir });

      // assert
      assert.deepStrictEqual(remotes, { kind: "permission-denied" });
    });
  }

  // D-3-03 / MA-13: the origin shapes an interrupted rewrite or a hand edit
  // leaves behind. `libraryRemotes` is the library's per-section enumeration:
  // it is `unknown` because a url-less section comes back holding `undefined`,
  // and it reports the LAST url of a multi-valued origin. `libraryUrls` is
  // every `remote.origin.url` value in file order, which is the read
  // `listRemotes` makes; git fetches from the first (WR-11, T-3-05).
  interface OriginSectionShape {
    readonly title: string;
    readonly config: string;
    readonly libraryRemotes: unknown;
    readonly libraryUrls: readonly string[];
    readonly wrapperResult: GitPlatform.ListRemotesResult;
  }

  const ORIGIN_SECTION_SHAPES: readonly OriginSectionShape[] = [
    {
      title: "reports no-origin for an origin section with a fetch line but no url",
      config:
        '[core]\n\trepositoryformatversion = 0\n[remote "origin"]\n\tfetch = +refs/heads/*:refs/remotes/origin/*\n',
      libraryRemotes: [{ remote: "origin", url: undefined }],
      libraryUrls: [],
      wrapperResult: { kind: "no-origin" },
    },
    {
      title: "reports no-origin for an origin section with no keys",
      config: '[core]\n\trepositoryformatversion = 0\n[remote "origin"]\n',
      libraryRemotes: [{ remote: "origin", url: undefined }],
      libraryUrls: [],
      wrapperResult: { kind: "no-origin" },
    },
    {
      title: "reports the empty url of an origin section whose url value is empty",
      config: '[remote "origin"]\n\turl =\n',
      libraryRemotes: [{ remote: "origin", url: "" }],
      libraryUrls: [""],
      wrapperResult: { kind: "origin", url: "" },
    },
    {
      title: "reports no-origin for an origin section whose first of two urls is foreign",
      config: `[remote "origin"]\n\turl = ${OTHER_REMOTE_URL}\n\turl = ${REMOTE_URL}\n`,
      libraryRemotes: [{ remote: "origin", url: REMOTE_URL }],
      libraryUrls: [OTHER_REMOTE_URL, REMOTE_URL],
      wrapperResult: { kind: "no-origin" },
    },
    {
      title: "reports no-origin for an origin section whose second of two urls is foreign",
      config: `[remote "origin"]\n\turl = ${REMOTE_URL}\n\turl = ${OTHER_REMOTE_URL}\n`,
      libraryRemotes: [{ remote: "origin", url: OTHER_REMOTE_URL }],
      libraryUrls: [REMOTE_URL, OTHER_REMOTE_URL],
      wrapperResult: { kind: "no-origin" },
    },
    {
      title: "reports no-origin for two origin sections that each record a url",
      config: `[remote "origin"]\n\turl = ${OTHER_REMOTE_URL}\n[remote "origin"]\n\turl = ${REMOTE_URL}\n`,
      libraryRemotes: [
        { remote: "origin", url: REMOTE_URL },
        { remote: "origin", url: REMOTE_URL },
      ],
      libraryUrls: [OTHER_REMOTE_URL, REMOTE_URL],
      wrapperResult: { kind: "no-origin" },
    },
    {
      title: "reports the origin url of an origin section whose section name is capitalized",
      config: `[Remote "origin"]\n\turl = ${REMOTE_URL}\n`,
      libraryRemotes: [],
      libraryUrls: [REMOTE_URL],
      wrapperResult: { kind: "origin", url: REMOTE_URL },
    },
  ];

  for (const {
    title,
    config,
    libraryRemotes,
    libraryUrls,
    wrapperResult,
  } of ORIGIN_SECTION_SHAPES) {
    test(title, async (t) => {
      // arrange
      const repository = await createGitTestRepository(t, { boundary: "local" });
      await writeFile(path.join(repository.dir, ".git", "config"), config);

      // act
      const remotes = await listRemotes({ dir: repository.dir });

      // assert
      // Proves the fixture reproduces the shape, so a mis-authored config
      // cannot pass through the empty-remote-list path.
      assert.deepStrictEqual(await git.listRemotes({ fs, dir: repository.dir }), libraryRemotes);
      assert.deepStrictEqual(
        await git.getConfigAll({ fs, dir: repository.dir, path: "remote.origin.url" }),
        libraryUrls,
      );
      assert.deepStrictEqual(remotes, wrapperResult);
    });
  }
});

describe("listRemoteTags", () => {
  test("RESV-03: queries the tag namespace and returns every advertised tag in order", async (t) => {
    // arrange
    const requests = installRemoteTransport(t, [
      `${OID_LIGHTWEIGHT} refs/tags/v1.0.0`,
      `${OID_MAIN} refs/tags/v1.1.0`,
      `${OID_TAG} refs/tags/v2.0.0 peeled:${OID_PEELED}`,
    ]);

    // act
    const tags = await listRemoteTags({ url: REMOTE_URL });

    // assert
    assert.deepStrictEqual(tags, [
      { name: "v1.0.0", oid: OID_LIGHTWEIGHT },
      { name: "v1.1.0", oid: OID_MAIN },
      { name: "v2.0.0", oid: OID_PEELED },
    ]);
    assert.deepStrictEqual(requests, expectedTagRequests());
  });

  test("D-03-02.2: an entry naming an annotated tag's peel is not a second tag", async (t) => {
    // arrange
    const requests = installRemoteTransport(t, [
      `${OID_TAG} refs/tags/v2.0.0 peeled:${OID_PEELED}`,
      `${OID_PEELED} refs/tags/v2.0.0^{}`,
    ]);

    // act
    const tags = await listRemoteTags({ url: REMOTE_URL });

    // assert
    assert.deepStrictEqual(tags, [{ name: "v2.0.0", oid: OID_PEELED }]);
    assert.deepStrictEqual(requests, expectedTagRequests());
  });

  test("a ref advertised outside the tag namespace is not returned as a tag", async (t) => {
    // arrange
    const requests = installRemoteTransport(t, [
      `${OID_MAIN} refs/heads/main`,
      `${OID_DEV} refs/tags/v1.1.0`,
    ]);

    // act
    const tags = await listRemoteTags({ url: REMOTE_URL });

    // assert
    assert.deepStrictEqual(tags, [{ name: "v1.1.0", oid: OID_DEV }]);
    assert.deepStrictEqual(requests, expectedTagRequests());
  });

  test("a remote advertising no tags yields an empty list rather than throwing", async (t) => {
    // arrange
    const requests = installRemoteTransport(t, []);

    // act
    const tags = await listRemoteTags({ url: REMOTE_URL });

    // assert
    assert.deepStrictEqual(tags, []);
    assert.deepStrictEqual(requests, expectedTagRequests());
  });

  test("RESV-03: no credential callback answers a challenge when no bundle is supplied", async (t) => {
    // arrange
    const requests = installRemoteTransport(t, [`${OID_MAIN} refs/tags/v1.0.0`], {
      challengeOnce: true,
    });

    // act
    const listing = listRemoteTags({ url: REMOTE_URL });

    // assert
    await assert.rejects(listing, { name: "HttpError", message: "HTTP Error: 401 Unauthorized" });
    assert.deepStrictEqual(requests, [expectedTagRequests()[0]]);
  });

  test("RESV-03: the supplied credential bundle is what the tag query authenticates with", async (t) => {
    // arrange
    const requests = installRemoteTransport(
      t,
      [`${OID_TAG} refs/tags/v2.0.0 peeled:${OID_PEELED}`],
      { challengeOnce: true },
    );
    const credentials = createCredentialOpsFake({
      boundary: "memory",
      credentials: [[HOST, { username: "user", password: "secret" }]],
    });
    const onAuthRequired: OnAuthRequiredFn = () => {
      throw new Error("interactive auth is forbidden on a stored-credential hit");
    };

    // act
    const tags = await listRemoteTags({
      url: REMOTE_URL,
      auth: {
        credentialOps: credentials.credentialOps,
        host: HOST,
        kind: "device-flow",
        onAuthRequired,
      },
    });

    // assert
    assert.deepStrictEqual(tags, [{ name: "v2.0.0", oid: OID_PEELED }]);
    assert.deepStrictEqual(credentials.calls, {
      fill: [{ host: HOST }],
      approve: [],
      reject: [],
    });
    assert.deepStrictEqual(requests, [
      expectedTagRequests()[0],
      {
        ...expectedTagRequests()[0],
        headers: {
          "Git-Protocol": "version=2",
          Authorization: "Basic dXNlcjpzZWNyZXQ=",
        },
      },
      {
        ...expectedTagRequests()[1],
        headers: {
          ...expectedTagRequests()[1].headers,
          Authorization: "Basic dXNlcjpzZWNyZXQ=",
        },
      },
    ]);
  });
});

describe("listTags", () => {
  test("lists tag names against a real local repository with no network call", async (t) => {
    // arrange
    const repository = await createGitTestRepository(t, { boundary: "local" });
    await git.tag({ fs, dir: repository.dir, ref: "v1.0.0", object: repository.initialOid });
    const secondOid = await repository.commit(
      [{ filepath: "second.txt", contents: "second\n" }],
      "second",
    );
    await git.tag({ fs, dir: repository.dir, ref: "v2.0.0", object: secondOid });

    // act
    const tags = await listTags({ dir: repository.dir });

    // assert
    assert.deepStrictEqual([...tags].sort(), ["v1.0.0", "v2.0.0"]);
  });

  test("a repository with no tags yields an empty list", async (t) => {
    // arrange
    const repository = await createGitTestRepository(t, { boundary: "local" });

    // act
    const tags = await listTags({ dir: repository.dir });

    // assert
    assert.deepStrictEqual(tags, []);
  });
});

describe("resolveTagOid", () => {
  test("a lightweight tag resolves to the commit it points at", async (t) => {
    // arrange
    const repository = await createGitTestRepository(t, { boundary: "local" });
    await git.tag({ fs, dir: repository.dir, ref: "v1.0.0", object: repository.initialOid });

    // act
    const oid = await resolveTagOid({ dir: repository.dir, name: "v1.0.0", cache: {} });

    // assert
    assert.strictEqual(oid, repository.initialOid);
  });

  test("WR-01: a lightweight tag pointing at a blob resolves to undefined so the caller can drop it", async (t) => {
    // arrange
    const repository = await createGitTestRepository(t, { boundary: "local" });
    const blobOid = await git.writeBlob({
      fs,
      dir: repository.dir,
      blob: new Uint8Array(Buffer.from("hello")),
    });
    await git.writeRef({
      fs,
      dir: repository.dir,
      ref: "refs/tags/blob-tag",
      value: blobOid,
      force: true,
    });

    // act
    const oid = await resolveTagOid({ dir: repository.dir, name: "blob-tag", cache: {} });

    // assert: a lightweight tag's target is not decided by the throw alone --
    // a commit target still resolves, so a non-commit target must be checked
    // and dropped the same way an annotated blob/tree tag is.
    assert.strictEqual(oid, undefined);
  });

  test("an annotated tag resolves to the commit it points at, not the tag object's own oid", async (t) => {
    // arrange
    const repository = await createGitTestRepository(t, { boundary: "local" });
    await git.annotatedTag({
      fs,
      dir: repository.dir,
      ref: "v2.0.0",
      message: "release 2.0.0",
      object: repository.initialOid,
      tagger: {
        name: "Git contract",
        email: "git-contract@example.invalid",
        timestamp: 1_700_000_100,
        timezoneOffset: 0,
      },
    });
    const tagObjectOid = await git.resolveRef({ fs, dir: repository.dir, ref: "refs/tags/v2.0.0" });
    assert.notStrictEqual(tagObjectOid, repository.initialOid);

    // act
    const oid = await resolveTagOid({ dir: repository.dir, name: "v2.0.0", cache: {} });

    // assert
    assert.strictEqual(oid, repository.initialOid);
  });

  test("WR-06: a tag pointing at neither a commit nor another tag resolves to undefined so the caller can drop it", async (t) => {
    // arrange
    const repository = await createGitTestRepository(t, { boundary: "local" });
    const blobOid = await git.writeBlob({
      fs,
      dir: repository.dir,
      blob: new Uint8Array(Buffer.from("hello")),
    });
    await git.annotatedTag({
      fs,
      dir: repository.dir,
      ref: "blob-tag",
      message: "blob-tag",
      object: blobOid,
      tagger: {
        name: "Git contract",
        email: "git-contract@example.invalid",
        timestamp: 1_700_000_200,
        timezoneOffset: 0,
      },
    });

    // act
    const oid = await resolveTagOid({ dir: repository.dir, name: "blob-tag", cache: {} });

    // assert: WR-06 -- a non-commit tagged type is not a checkout-able
    // candidate, so `undefined` signals it rather than handing back an oid
    // that would break a later checkout.
    assert.strictEqual(oid, undefined);
  });

  test("WR-06: a tag-of-tag chain longer than the peel bound resolves to undefined instead of looping forever", async (t) => {
    // arrange: MAX_TAG_PEEL_HOPS + 1 nested annotated tags, each pointing at
    // the previous tag's own object oid; only the innermost points at a
    // commit. Fully resolving needs one more hop than the bound allows.
    const repository = await createGitTestRepository(t, { boundary: "local" });
    let pointsAt = repository.initialOid;
    let outermostName = "";
    for (let hop = 0; hop < 11; hop += 1) {
      const name = `chain-${hop.toString()}`;
      // Sequential by necessity: each tag must point at the previous one's
      // resolved oid.
      await git.annotatedTag({
        fs,
        dir: repository.dir,
        ref: name,
        message: name,
        object: pointsAt,
        tagger: {
          name: "Git contract",
          email: "git-contract@example.invalid",
          timestamp: 1_700_000_300 + hop,
          timezoneOffset: 0,
        },
      });
      pointsAt = await git.resolveRef({ fs, dir: repository.dir, ref: `refs/tags/${name}` });
      outermostName = name;
    }

    // act
    const oid = await resolveTagOid({ dir: repository.dir, name: outermostName, cache: {} });

    // assert: WR-06 -- hop exhaustion never reached a commit, so `undefined`
    // signals that rather than handing back an intermediate tag-object oid a
    // caller could mistake for a commit.
    assert.strictEqual(oid, undefined);
  });
});

describe("GitOps contract", () => {
  registerGitOpsContract(createProductionGitOps);
});

void ({ username: "user", password: "secret" } satisfies GitCredentials);
void ({ name: "v1.0.0", oid: OID_MAIN } satisfies RemoteTag);

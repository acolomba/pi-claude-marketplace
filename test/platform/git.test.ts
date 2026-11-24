import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import * as fs from "node:fs";
import {
  cp,
  lstat,
  mkdir,
  readdir,
  readFile,
  readlink,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import nodeHttp from "node:http";
import https from "node:https";
import * as path from "node:path";
import { PassThrough, Readable } from "node:stream";
import { describe, test, type TestContext } from "node:test";

import * as git from "isomorphic-git";
import http from "isomorphic-git/http/node";
import { mock, verify } from "strong-mock";

import {
  createGitProcess,
  NODE_GIT_HOST,
  NODE_GIT_SPAWN,
} from "../../extensions/pi-claude-marketplace/platform/git-process.ts";
import {
  checkout,
  clone,
  currentBranch,
  fetch,
  fetchCommit,
  forceUpdateRef,
  listRemotes,
  listRemoteTags,
  listTags,
  resolveRef,
  resolveRemoteRef,
  resolveTagOid,
  runWithGitAbortSignal,
} from "../../extensions/pi-claude-marketplace/platform/git.ts";
import {
  CrossOriginChallengeError,
  DeviceFlowUnavailableError,
  FetchedUrlCause,
  GitCommandError,
  InvalidGitHubBaseUrlError,
  TooManyRedirectsError,
} from "../../extensions/pi-claude-marketplace/shared/errors.ts";
import { hermeticGitEnvironment } from "../../features/lib/hermetic-git.ts";
import { HttpsGitHost } from "../../features/lib/https-git-host/server.ts";
import { setGitHubBaseUrl } from "../shared/github-base-url-environment.ts";

import { createCredentialOpsFake } from "./credential-ops-fake.ts";
import { registerGitOpsContract } from "./git-ops-contract.ts";
import {
  createGitTestDirectory,
  createGitTestRepository,
  gitTestCheckout,
} from "./git-test-repository.ts";

import type { GitOps } from "../../extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts";
import type { OnAuthRequiredFn } from "../../extensions/pi-claude-marketplace/platform/git-auth-callbacks.ts";
import type {
  GitProcess,
  GitRequest,
} from "../../extensions/pi-claude-marketplace/platform/git-process.ts";
import type * as GitPlatform from "../../extensions/pi-claude-marketplace/platform/git.ts";
import type {
  GitCredentials,
  RemoteTag,
} from "../../extensions/pi-claude-marketplace/platform/git.ts";
import type { CredentialOpsFake } from "./credential-ops-fake.ts";
import type { GitOpsContractParticipant } from "./git-ops-contract.ts";
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
const GITHUB_REMOTE_URL = "https://github.com/owner/repo.git";
const GITHUB_TOOLS_URL = "https://github.com/acme/tools.git";
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

function uploadPackAdvertisementBody(oid: string, tag?: string): Buffer {
  return Buffer.concat([
    packet("# service=git-upload-pack\n"),
    FLUSH,
    packet(`${oid} HEAD\0multi_ack_detailed side-band-64k ofs-delta symref=HEAD:refs/heads/main\n`),
    packet(`${oid} refs/heads/main\n`),
    ...(tag === undefined ? [] : [packet(`${oid} refs/tags/${tag}\n`)]),
    FLUSH,
  ]);
}

/** A protocol version 1 `git-upload-pack` result: a NAK, then `packfile` on side band 1. */
function packResultBody(packfile: Buffer): Buffer {
  return Buffer.concat([
    packet("NAK\n"),
    packetBytes(Buffer.concat([Buffer.from([1]), packfile])),
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
  tag?: string,
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
        protocolV2 ? advertisementBody() : uploadPackAdvertisementBody(oid, tag),
      );
    }

    if (request.url === `${REMOTE_URL}/git-upload-pack` && request.method === "POST") {
      const protocolV2 = request.headers?.["Git-Protocol"] === "version=2";
      return response(
        request.url,
        200,
        "OK",
        "application/x-git-upload-pack-result",
        protocolV2 ? refsBody(refs) : packResultBody(packfile),
      );
    }

    throw new Error(`unplanned Git HTTP request: ${request.method ?? "undefined"} ${request.url}`);
  });
}

/**
 * A git process over real system git with a scratch HOME, no system or global
 * config, and the case's own neutral directory, so no git variable or config
 * of the shell that runs the suite reaches it (SG-HRN-01).
 */
async function hermeticGitProcess(
  t: TestContext,
  variables: NodeJS.ProcessEnv = {},
): Promise<GitProcess> {
  const root = await realpath(await createGitTestDirectory(t, { boundary: "local" }));
  return createGitProcess({
    spawn: NODE_GIT_SPAWN,
    host: { ...NODE_GIT_HOST, neutralDirectory: () => Promise.resolve(root) },
    env: { ...hermeticGitEnvironment(root), ...variables },
    killGraceMs: 1_000,
  });
}

/** The production GitOps, its system-git verbs bound to `systemGit`. */
function productionGitOps(systemGit: GitProcess): GitOps {
  return {
    clone,
    fetch,
    fetchCommit: (options) => fetchCommit(options, systemGit),
    forceUpdateRef,
    checkout: (options) => checkout(options, systemGit),
    resolveRef: (options) => resolveRef(options, systemGit),
    currentBranch,
    resolveRemoteRef: (options) => resolveRemoteRef(options, systemGit),
    listRemotes: (options) => listRemotes(options, systemGit),
  };
}

/**
 * Copies the `.git` of `dir` into a new directory, without its index, as the
 * clone cache's copy step does, and returns the new directory.
 */
async function copyOfGitDir(t: TestContext, dir: string): Promise<string> {
  const copyDir = await createGitTestDirectory(t, { boundary: "local" });
  await cp(path.join(dir, ".git"), path.join(copyDir, ".git"), {
    recursive: true,
    verbatimSymlinks: true,
  });
  await rm(path.join(copyDir, ".git", "index"));
  return copyDir;
}

/**
 * D-SG-11: a repository whose last commit adds the relative symlink `link`,
 * with the clone keys an `isomorphic-git` clone writes (03-EVIDENCE Q5), and a
 * copy of its `.git` taken after the keys were set.
 */
async function copyOfOldClone(
  t: TestContext,
): Promise<{ readonly copyDir: string; readonly linkOid: string }> {
  const repository = await createGitTestRepository(t, { boundary: "local" });
  await fs.promises.symlink("README.md", path.join(repository.dir, "link"));
  const linkOid = await repository.commitPaths("link", ["link"]);
  await repository.run("config", "core.symlinks", "false");
  await repository.run("config", "core.ignorecase", "true");
  await repository.run("config", "core.filemode", "false");
  return { copyDir: await copyOfGitDir(t, repository.dir), linkOid };
}

/** The target of the copy's `link` when it is a symlink, and its local `core.` keys. */
async function copyCheckoutShape(
  copyDir: string,
): Promise<{ readonly link: string; readonly coreKeys: readonly string[] }> {
  const linkPath = path.join(copyDir, "link");
  const link = (await lstat(linkPath)).isSymbolicLink()
    ? await readlink(linkPath)
    : "a regular file";
  const coreKeys = await gitTestCheckout(copyDir).run(
    "config",
    "--local",
    "--name-only",
    "--get-regexp",
    String.raw`^core\.`,
  );
  return { link, coreKeys: coreKeys.split("\n") };
}

/** Sets CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS for one case and restores it afterwards. */
function setGitTimeoutVariable(t: TestContext, value: string): void {
  const previous = process.env.CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS;
  t.after(() => {
    if (previous === undefined) {
      delete process.env.CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS;
    } else {
      process.env.CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS = previous;
    }
  });
  process.env.CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS = value;
}

/**
 * The real participant serves one repository two ways: isomorphic-git's
 * requests to `REMOTE_URL` reach it through the transport double, and system
 * git reaches it through a user config `insteadOf` whose base is its local
 * path (D-SG-16), so no request leaves the machine.
 */
async function createProductionGitOps(t: TestContext): Promise<GitOpsContractParticipant> {
  const remote = await createGitTestRepository(t, { boundary: "local" });
  const updatedOid = await remote.commit(
    [{ filepath: "README.md", contents: "# updated\n" }],
    "updated",
  );
  await remote.run("tag", "-a", "-m", "v1.0.0", "v1.0.0");
  const systemGit = await hermeticGitProcess(t, {
    GIT_CONFIG_COUNT: "1",
    GIT_CONFIG_KEY_0: `url.file://${remote.dir}.insteadOf`,
    GIT_CONFIG_VALUE_0: REMOTE_URL,
  });
  const worktree = await createGitTestRepository(t, { boundary: "local" });
  const localUpdatedOid = await worktree.commit(
    [{ filepath: "README.md", contents: "# updated\n" }],
    "updated",
  );
  assert.strictEqual(localUpdatedOid, updatedOid);
  await worktree.run("update-ref", "refs/heads/main", worktree.initialOid);
  await worktree.run("update-ref", "refs/heads/feature", updatedOid);
  await worktree.run("checkout", "-q", "-f", "main");
  await worktree.run("remote", "add", "origin", REMOTE_URL);
  const cloneDir = await createGitTestDirectory(t, { boundary: "local" });
  await installRepositoryTransport(t, remote);

  return {
    gitOps: productionGitOps(systemGit),
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
    copyGitDir: () => copyOfGitDir(t, worktree.dir),
    unfetchedCommit: async () => {
      const { dir, olderOids } = await shallowFileClone(t);
      return { dir, sha: olderOids[0] };
    },
  };
}

/**
 * SG-TRN-02: a repository with three commits and a depth-1 clone of it over
 * `file://`, so the clone holds only the last commit. `olderOids` are the two
 * commits the clone lacks, oldest first.
 */
async function shallowFileClone(t: TestContext): Promise<{
  readonly dir: string;
  readonly olderOids: readonly [string, string];
}> {
  const origin = await createGitTestRepository(t, { boundary: "local" });
  const secondOid = await origin.commit([{ filepath: "two.txt", contents: "two\n" }], "two");
  await origin.commit([{ filepath: "three.txt", contents: "three\n" }], "three");
  const dir = path.join(await createGitTestDirectory(t, { boundary: "local" }), "clone");
  await origin.run("clone", "-q", "--depth", "1", `file://${origin.dir}`, dir);
  return { dir, olderOids: [origin.initialOid, secondOid] };
}

/** A git process that runs `systemGit` and records each request, and each as one line. */
function recordingGitProcess(systemGit: GitProcess): {
  readonly gitProcess: GitProcess;
  readonly commands: string[];
  readonly requests: GitRequest[];
} {
  const commands: string[] = [];
  const requests: GitRequest[] = [];
  return {
    commands,
    requests,
    gitProcess: {
      locate: systemGit.locate,
      run: (request) => {
        requests.push(request);
        commands.push(
          [request.subcommand, ...(request.options ?? []), ...(request.operands ?? [])].join(" "),
        );
        return systemGit.run(request);
      },
    },
  };
}

/**
 * SG-PRC-06: the lookup's own failure, unwrapped, so a missing git gets no
 * fetched-URL cause even when the GitHub base override rewrote the URL.
 */
function isGitMissingWithoutCause(error: unknown): boolean {
  assert.ok(error instanceof GitCommandError);
  assert.deepStrictEqual(error.failure, { kind: "git-missing", detail: "not-found" });
  assert.strictEqual(error.message, "Git is required to install marketplaces.");
  assert.strictEqual(error.cause, undefined);
  return true;
}

/**
 * Points PATH at an empty directory for one test, so this process finds no
 * git. Build every fixture first: the fixtures run system git through PATH.
 * The restore is registered before PATH changes; the returned function
 * restores it early, and the registered restore then writes the same value.
 */
async function withoutGitOnPath(t: TestContext): Promise<() => void> {
  const directory = await createGitTestDirectory(t, { boundary: "local" });
  const previous = process.env.PATH;
  const restore = (): void => {
    if (previous === undefined) {
      delete process.env.PATH;
    } else {
      process.env.PATH = previous;
    }
  };

  t.after(restore);
  process.env.PATH = directory;
  return restore;
}

function isExpectedDiscoveryError(
  error: unknown,
  caller: "git.clone" | "git.fetch" | "git.listServerRefs",
): boolean {
  assert.ok(error instanceof git.Errors.HttpError);
  assert.strictEqual(error.caller, caller);
  assert.deepStrictEqual(error.data, {
    statusCode: 503,
    statusMessage: "Unavailable",
    response: "offline",
  });
  return true;
}

/**
 * D-10: the discovery failure stays the error itself, so the classifiers still
 * read its code at depth 0, and its cause names the URL actually fetched.
 */
function isFetchedUrlDiscoveryError(
  error: unknown,
  caller: "git.clone" | "git.listServerRefs",
): boolean {
  assert.ok(isExpectedDiscoveryError(error, caller));
  assert.ok(error instanceof Error && error.cause instanceof FetchedUrlCause);
  assert.deepStrictEqual(
    {
      message: error.cause.message,
      url: error.cause.url,
      cause: error.cause.cause,
    },
    { message: `fetched ${REMOTE_URL}`, url: REMOTE_URL, cause: undefined },
  );
  return true;
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
  /** Whether the re-sent request carries the original POST body. */
  readonly keepsBody: boolean;
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
function sameOriginServer(
  location: string,
  served: ServedCommit,
): (request: WireRequest) => WireResponse {
  return (request) => {
    if (request.url === BOUND_INFO_URL) {
      return redirectWireResponse(302, location);
    }

    if (request.headers.authorization === undefined) {
      return unauthorizedWireResponse();
    }

    if (request.url === RENAMED_INFO_URL) {
      return served.advertisement;
    }

    if (request.url === BOUND_UPLOAD_PACK_URL) {
      return served.pack;
    }

    throw unplannedWireRequest(request);
  };
}

/** The bound host redirects its `git-upload-pack` POST to the renamed repository. */
function postRedirectServer(
  statusCode: number,
  served: ServedCommit,
): (request: WireRequest) => WireResponse {
  return (request) => {
    if (request.url === BOUND_INFO_URL) {
      return served.advertisement;
    }

    if (request.url === BOUND_UPLOAD_PACK_URL) {
      return redirectWireResponse(statusCode, RENAMED_UPLOAD_PACK_URL);
    }

    if (request.url === RENAMED_UPLOAD_PACK_URL) {
      return served.pack;
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
  served: ServedCommit,
  respondAtLocation: (request: WireRequest) => WireResponse,
): (request: WireRequest) => WireResponse {
  return (request) => {
    if (request.url === BOUND_INFO_URL) {
      return request.headers.authorization === undefined
        ? unauthorizedWireResponse()
        : served.advertisement;
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
    const systemGit = await hermeticGitProcess(t);
    const repository = await createGitTestRepository(t, { boundary: "local" });

    // act
    const oid = await resolveRef({ dir: repository.dir, ref: "HEAD" }, systemGit);

    // assert
    assert.strictEqual(oid, repository.initialOid);
  });

  test("SG-TRN-01: answers undefined for a ref the repository does not hold", async (t) => {
    // arrange
    const systemGit = await hermeticGitProcess(t);
    const repository = await createGitTestRepository(t, { boundary: "local" });

    // act
    const oid = await resolveRef(
      { dir: repository.dir, ref: "refs/remotes/origin/nosuch" },
      systemGit,
    );

    // assert
    assert.strictEqual(oid, undefined);
  });

  test("SG-TRN-01: resolves an annotated tag to the commit it tags", async (t) => {
    // arrange
    const systemGit = await hermeticGitProcess(t);
    const repository = await createGitTestRepository(t, { boundary: "local" });
    await repository.run("tag", "-a", "-m", "release", "v1", repository.initialOid);

    // act
    const oid = await resolveRef({ dir: repository.dir, ref: "refs/tags/v1" }, systemGit);

    // assert
    assert.strictEqual(oid, repository.initialOid);
  });

  test("SG-TRN-01: answers undefined for a tag that names a tree", async (t) => {
    // arrange
    const systemGit = await hermeticGitProcess(t);
    const repository = await createGitTestRepository(t, { boundary: "local" });
    const tree = await repository.run("rev-parse", `${repository.initialOid}^{tree}`);
    await repository.run("tag", "tree-tag", tree);

    // act
    const oid = await resolveRef({ dir: repository.dir, ref: "refs/tags/tree-tag" }, systemGit);

    // assert
    assert.strictEqual(oid, undefined);
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
    const systemGit = await hermeticGitProcess(t);
    const repository = await createGitTestRepository(t, { boundary: "local" });
    await forceUpdateRef({
      dir: repository.dir,
      ref: "refs/heads/feature",
      value: repository.initialOid,
    });

    // act
    await checkout({ dir: repository.dir, ref: "feature" }, systemGit);

    // assert
    assert.strictEqual(await currentBranch({ dir: repository.dir }), "feature");
  });

  test("SG-TRN-01: checks out the files of a commit the current branch moved to", async (t) => {
    // arrange
    const systemGit = await hermeticGitProcess(t);
    const repository = await createGitTestRepository(t, { boundary: "local" });
    const movedOid = await repository.commit(
      [{ filepath: "README.md", contents: "# moved\n" }],
      "moved",
    );
    await repository.run("reset", "-q", "--hard", repository.initialOid);
    await repository.run("update-ref", "refs/heads/main", movedOid);

    // act
    await checkout({ dir: repository.dir, ref: "main" }, systemGit);

    // assert
    assert.deepStrictEqual(
      {
        branch: await currentBranch({ dir: repository.dir }),
        readme: await readFile(path.join(repository.dir, "README.md"), "utf8"),
      },
      { branch: "main", readme: "# moved\n" },
    );
  });

  test("checks out a detached commit", async (t) => {
    // arrange
    const systemGit = await hermeticGitProcess(t);
    const repository = await createGitTestRepository(t, { boundary: "local" });

    // act
    await checkout({ dir: repository.dir, ref: repository.initialOid }, systemGit);

    // assert
    assert.strictEqual(await currentBranch({ dir: repository.dir }), undefined);
    assert.strictEqual(
      await resolveRef({ dir: repository.dir, ref: "HEAD" }),
      repository.initialOid,
    );
  });

  test("D-SG-11: a copy checkout unsets the copied clone keys and writes a symlink as a link", async (t) => {
    // arrange
    const systemGit = await hermeticGitProcess(t);
    const { copyDir, linkOid } = await copyOfOldClone(t);

    // act
    await checkout({ dir: copyDir, ref: linkOid, fromCopiedGitDir: true }, systemGit);

    // assert
    assert.deepStrictEqual(await copyCheckoutShape(copyDir), {
      link: "README.md",
      coreKeys: ["core.repositoryformatversion", "core.bare", "core.logallrefupdates"],
    });
  });

  test("D-SG-11: a second copy checkout finds the keys absent and leaves the same tree", async (t) => {
    // arrange
    const systemGit = await hermeticGitProcess(t);
    const { copyDir, linkOid } = await copyOfOldClone(t);
    await checkout({ dir: copyDir, ref: linkOid, fromCopiedGitDir: true }, systemGit);

    // act
    await checkout({ dir: copyDir, ref: linkOid, fromCopiedGitDir: true }, systemGit);

    // assert
    assert.deepStrictEqual(await copyCheckoutShape(copyDir), {
      link: "README.md",
      coreKeys: ["core.repositoryformatversion", "core.bare", "core.logallrefupdates"],
    });
  });

  test("D-SG-13: a copy checkout sends three key drops and the checkout, each with the configured limit", async (t) => {
    // arrange
    setGitTimeoutVariable(t, "4321");
    const requests: GitRequest[] = [];
    const recordingGit: GitProcess = {
      locate: () => Promise.resolve("/usr/bin/git"),
      run: (request) => {
        requests.push(request);
        return Promise.resolve({ exitCode: 0, stdout: "", stderr: "" });
      },
    };
    const keyDrop = (key: string): GitRequest => ({
      subcommand: "config",
      lane: "local",
      cwd: "/copy",
      options: ["--local", "--unset-all"],
      operands: [key],
      allowExit: [5],
      timeoutMs: 4321,
    });

    // act
    await checkout({ dir: "/copy", ref: OID_MAIN, fromCopiedGitDir: true }, recordingGit);

    // assert
    assert.deepStrictEqual(requests, [
      keyDrop("core.symlinks"),
      keyDrop("core.ignorecase"),
      keyDrop("core.filemode"),
      {
        subcommand: "checkout",
        lane: "local",
        cwd: "/copy",
        options: ["-f", "--quiet"],
        operands: [OID_MAIN],
        timeoutMs: 4321,
      },
    ]);
  });
});

describe("SG-PRC-06: the git-required gate", () => {
  interface GateDirectories {
    /** A repository whose origin is the GitHub remote. */
    readonly repository: string;
    /** An empty directory a clone would write into. */
    readonly target: string;
  }

  const networkVerbs: readonly {
    readonly name: string;
    readonly call: (directories: GateDirectories) => Promise<unknown>;
  }[] = [
    { name: "clone", call: ({ target }) => clone({ dir: target, url: GITHUB_REMOTE_URL }) },
    { name: "fetch", call: ({ repository }) => fetch({ dir: repository }) },
    { name: "resolveRemoteRef", call: () => resolveRemoteRef({ url: GITHUB_REMOTE_URL }) },
    { name: "listRemoteTags", call: () => listRemoteTags({ url: GITHUB_REMOTE_URL }) },
  ];

  for (const verb of networkVerbs) {
    test(`D-SG-01: ${verb.name} fails as git missing and sends no request`, async (t) => {
      // arrange
      const requests = installRemoteTransport(t, FULL_ADVERTISEMENT);
      const repository = await createGitTestRepository(t, { boundary: "local" });
      await repository.run("remote", "add", "origin", GITHUB_REMOTE_URL);
      const target = await createGitTestDirectory(t, { boundary: "local" });
      setGitHubBaseUrl(t, `https://${HOST}`);
      await withoutGitOnPath(t);

      // act
      const calling = verb.call({ repository: repository.dir, target });

      // assert
      await assert.rejects(calling, isGitMissingWithoutCause);
      assert.deepStrictEqual(requests, []);
      assert.deepStrictEqual(await readdir(target), []);
    });
  }

  test("TAGS-01: the in-process local verbs read and write a clone with no git on the path", async (t) => {
    // arrange
    const repository = await createGitTestRepository(t, { boundary: "local" });
    await repository.run("tag", "v1.0.0", repository.initialOid);
    await repository.commit([{ filepath: "next.txt", contents: "next\n" }], "next");
    await withoutGitOnPath(t);
    const { dir } = repository;

    // act
    await forceUpdateRef({ dir, ref: "refs/heads/feature", value: repository.initialOid });

    // assert
    assert.deepStrictEqual(
      {
        branch: await currentBranch({ dir }),
        feature: await readFile(path.join(dir, ".git", "refs", "heads", "feature"), "utf8"),
        tags: await listTags({ dir }),
        tag: await resolveTagOid({ dir, name: "v1.0.0", cache: {} }),
      },
      {
        branch: "main",
        feature: `${repository.initialOid}\n`,
        tags: ["v1.0.0"],
        tag: repository.initialOid,
      },
    );
  });

  test("D-SG-04: a clone succeeds once git is back on the path", async (t) => {
    // arrange
    const repository = await createGitTestRepository(t, { boundary: "local" });
    const refused = await createGitTestDirectory(t, { boundary: "local" });
    const dir = await createGitTestDirectory(t, { boundary: "local" });
    await installRepositoryTransport(t, repository);
    const restorePath = await withoutGitOnPath(t);
    await assert.rejects(clone({ dir: refused, url: REMOTE_URL }), isGitMissingWithoutCause);
    restorePath();

    // act
    await clone({ dir, url: REMOTE_URL });

    // assert
    assert.strictEqual(await resolveRef({ dir, ref: "HEAD" }), repository.initialOid);
  });
});

describe("clone", () => {
  test("clones a public repository without consulting its auth bundle", async (t) => {
    // arrange
    const repository = await createGitTestRepository(t, { boundary: "local" });
    const dir = await createGitTestDirectory(t, { boundary: "local" });
    await installRepositoryTransport(t, repository);
    const credentials = createCredentialOpsFake({ boundary: "memory" });

    // act
    await clone({
      dir,
      url: REMOTE_URL,
      auth: {
        kind: "device-flow",
        host: HOST,
        credentialOps: credentials.credentialOps,
        onAuthRequired: () => Promise.reject(new DeviceFlowUnavailableError()),
      },
    });

    // assert
    assert.strictEqual(await resolveRef({ dir, ref: "HEAD" }), repository.initialOid);
    assert.deepStrictEqual(credentials.calls, { fill: [], approve: [], reject: [] });
  });

  test("preserves a typed auth refusal from the real clone operation", async (t) => {
    // arrange
    const requests = installFailedDiscoveryTransport(t, { challengeOnce: true });
    const repository = await createGitTestRepository(t, { boundary: "local" });
    const credentials = createCredentialOpsFake({ boundary: "memory" });
    const refusal = new DeviceFlowUnavailableError();

    // act & assert
    await assert.rejects(
      clone({
        dir: repository.dir,
        url: REMOTE_URL,
        auth: {
          kind: "device-flow",
          host: HOST,
          credentialOps: credentials.credentialOps,
          onAuthRequired: () => Promise.reject(refusal),
        },
      }),
      (error: unknown) => {
        assert.strictEqual(error, refusal);
        return true;
      },
    );
    assert.deepStrictEqual(requests, [expectedDiscoveryRequest()]);
    assert.deepStrictEqual(credentials.calls, { fill: [{ host: HOST }], approve: [], reject: [] });
  });

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

  test("GHB-01: clones a github.com URL from the base and records the canonical origin", async (t) => {
    // arrange
    const repository = await createGitTestRepository(t, { boundary: "local" });
    const dir = await createGitTestDirectory(t, { boundary: "local" });
    await installRepositoryTransport(t, repository);
    setGitHubBaseUrl(t, `https://${HOST}`);

    // act
    await clone({ dir, url: GITHUB_REMOTE_URL });

    // assert
    assert.strictEqual(await resolveRef({ dir, ref: "HEAD" }), repository.initialOid);
    assert.deepStrictEqual(await listRemotes({ dir }), { kind: "origin", url: GITHUB_REMOTE_URL });
  });

  test("GHB-04: a clone of a non-GitHub URL ignores an invalid base", async (t) => {
    // arrange
    const repository = await createGitTestRepository(t, { boundary: "local" });
    const dir = await createGitTestDirectory(t, { boundary: "local" });
    await installRepositoryTransport(t, repository);
    setGitHubBaseUrl(t, "http://mirror.example");

    // act
    await clone({ dir, url: REMOTE_URL });

    // assert
    assert.strictEqual(await resolveRef({ dir, ref: "HEAD" }), repository.initialOid);
    assert.deepStrictEqual(await listRemotes({ dir }), { kind: "origin", url: REMOTE_URL });
  });

  test("D-10: a failed clone from the base names the fetched URL", async (t) => {
    // arrange
    const requests = installFailedDiscoveryTransport(t);
    const dir = await createGitTestDirectory(t, { boundary: "local" });
    setGitHubBaseUrl(t, `https://${HOST}`);

    // act
    const cloning = clone({ dir, url: GITHUB_REMOTE_URL });

    // assert
    await assert.rejects(cloning, (error: unknown) =>
      isFetchedUrlDiscoveryError(error, "git.clone"),
    );
    assert.deepStrictEqual(requests, [expectedDiscoveryRequest()]);
  });

  test("D-10: a rewritten failure keeps a cause it already carries", async (t) => {
    // arrange
    const firstCause = new Error("connection reset");
    const failure = new Error("socket hang up", { cause: firstCause });
    t.mock.method(http, "request", () => Promise.reject(failure));
    const dir = await createGitTestDirectory(t, { boundary: "local" });
    setGitHubBaseUrl(t, `https://${HOST}`);

    // act
    const cloning = clone({ dir, url: GITHUB_REMOTE_URL });

    // assert
    await assert.rejects(cloning, (error: unknown) => {
      assert.strictEqual(error, failure);
      assert.strictEqual(failure.cause, firstCause);
      return true;
    });
  });
});

describe("fetch", () => {
  test("preserves a typed auth refusal from the real fetch operation", async (t) => {
    // arrange
    const requests = installFailedDiscoveryTransport(t, { challengeOnce: true });
    const repository = await createGitTestRepository(t, { boundary: "local" });
    await repository.run("remote", "add", "origin", REMOTE_URL);
    const credentials = createCredentialOpsFake({ boundary: "memory" });
    const refusal = new DeviceFlowUnavailableError();

    // act & assert
    await assert.rejects(
      fetch({
        dir: repository.dir,
        auth: {
          kind: "device-flow",
          host: HOST,
          credentialOps: credentials.credentialOps,
          onAuthRequired: () => Promise.reject(refusal),
        },
      }),
      (error: unknown) => {
        assert.strictEqual(error, refusal);
        return true;
      },
    );
    assert.deepStrictEqual(requests, [expectedDiscoveryRequest()]);
    assert.deepStrictEqual(credentials.calls, { fill: [{ host: HOST }], approve: [], reject: [] });
  });

  test("uses the default remote without auth", async (t) => {
    // arrange
    const requests = installFailedDiscoveryTransport(t);
    const repository = await createGitTestRepository(t, { boundary: "local" });
    await repository.run("remote", "add", "origin", REMOTE_URL);

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
    await repository.run("remote", "add", "upstream", REMOTE_URL);
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

  test("GHB-01 / D-02: fetches a canonical github.com origin from the base and keeps the recorded origin", async (t) => {
    // arrange
    const remote = await createGitTestRepository(t, { boundary: "local" });
    const updatedOid = await remote.commit(
      [{ filepath: "README.md", contents: "# updated\n" }],
      "updated",
    );
    const worktree = await createGitTestRepository(t, { boundary: "local" });
    await worktree.run("remote", "add", "origin", GITHUB_REMOTE_URL);
    await installRepositoryTransport(t, remote);
    setGitHubBaseUrl(t, `https://${HOST}`);

    // act
    await fetch({ dir: worktree.dir, remote: "origin" });

    // assert
    assert.strictEqual(
      await resolveRef({ dir: worktree.dir, ref: "refs/remotes/origin/main" }),
      updatedOid,
    );
    assert.deepStrictEqual(await listRemotes({ dir: worktree.dir }), {
      kind: "origin",
      url: GITHUB_REMOTE_URL,
    });
  });

  test("INR-06: a fetch asked for tags also fetches the remote's tags", async (t) => {
    // arrange
    const remote = await createGitTestRepository(t, { boundary: "local" });
    const taggedOid = await remote.commit(
      [{ filepath: "README.md", contents: "# tagged\n" }],
      "tagged",
    );
    const worktree = await createGitTestRepository(t, { boundary: "local" });
    await worktree.run("remote", "add", "origin", GITHUB_REMOTE_URL);
    await installRepositoryTransport(t, remote, "v1.0.0");
    setGitHubBaseUrl(t, `https://${HOST}`);

    // act
    await fetch({ dir: worktree.dir, remote: "origin", tags: true });

    // assert
    assert.strictEqual(await resolveRef({ dir: worktree.dir, ref: "refs/tags/v1.0.0" }), taggedOid);
  });

  test("D-10: a failed fetch from the base names the fetched URL", async (t) => {
    // arrange
    const requests = installFailedDiscoveryTransport(t);
    const repository = await createGitTestRepository(t, { boundary: "local" });
    await repository.run("remote", "add", "origin", GITHUB_REMOTE_URL);
    setGitHubBaseUrl(t, `https://${HOST}`);

    // act
    const fetching = fetch({ dir: repository.dir });

    // assert
    await assert.rejects(fetching, (error: unknown) => {
      assert.ok(isExpectedDiscoveryError(error, "git.fetch"));
      assert.ok(error instanceof Error && error.cause instanceof FetchedUrlCause);
      assert.deepStrictEqual(
        {
          message: error.cause.message,
          url: error.cause.url,
          cause: error.cause.cause,
        },
        { message: `fetched ${REMOTE_URL}`, url: REMOTE_URL, cause: undefined },
      );
      return true;
    });
    assert.deepStrictEqual(requests, [expectedDiscoveryRequest()]);
  });

  test("a fetch whose remote records no url passes none and fails as before", async (t) => {
    // arrange
    const requests = installFailedDiscoveryTransport(t);
    const repository = await createGitTestRepository(t, { boundary: "local" });
    setGitHubBaseUrl(t, `https://${HOST}`);

    // act
    const fetching = fetch({ dir: repository.dir });

    // assert
    await assert.rejects(fetching, (error: unknown) => {
      assert.ok(error instanceof git.Errors.MissingParameterError);
      assert.strictEqual(error.cause, undefined);
      return true;
    });
    assert.deepStrictEqual(requests, []);
  });

  test("GHB-04: an unrewritten failed fetch carries no fetched cause", async (t) => {
    // arrange
    const requests = installFailedDiscoveryTransport(t);
    const repository = await createGitTestRepository(t, { boundary: "local" });
    await repository.run("remote", "add", "origin", REMOTE_URL);
    setGitHubBaseUrl(t, undefined);

    // act
    const fetching = fetch({ dir: repository.dir });

    // assert
    await assert.rejects(fetching, (error: unknown) => {
      assert.ok(isExpectedDiscoveryError(error, "git.fetch"));
      assert.ok(error instanceof Error);
      assert.strictEqual(error.cause, undefined);
      return true;
    });
    assert.deepStrictEqual(requests, [expectedDiscoveryRequest()]);
  });
});

/** D-SG-16: the read of the recorded origin that decides the pair of each rung. */
const ORIGIN_READ = "config --local --get remote.origin.url";

describe("fetchCommit", () => {
  test("SG-TRN-02: fetches an older commit into a depth-1 clone with one depth-1 fetch", async (t) => {
    // arrange
    const systemGit = await hermeticGitProcess(t);
    const { dir, olderOids } = await shallowFileClone(t);
    const recorded = recordingGitProcess(systemGit);

    // act
    await fetchCommit({ dir, sha: olderOids[0] }, recorded.gitProcess);

    // assert
    assert.deepStrictEqual(
      {
        commands: recorded.commands,
        oid: await resolveRef({ dir, ref: olderOids[0] }, systemGit),
      },
      {
        commands: [ORIGIN_READ, `fetch --depth 1 origin ${olderOids[0]}`],
        oid: olderOids[0],
      },
    );
  });

  test("SG-TRN-02: a commit the remote lacks makes a shallow clone fetch its whole history", async (t) => {
    // arrange
    const systemGit = await hermeticGitProcess(t);
    const { dir, olderOids } = await shallowFileClone(t);
    const recorded = recordingGitProcess(systemGit);

    // act
    await fetchCommit({ dir, sha: OID_MAIN }, recorded.gitProcess);

    // assert
    assert.deepStrictEqual(
      {
        commands: recorded.commands,
        shallow: await gitTestCheckout(dir).run("rev-parse", "--is-shallow-repository"),
        oid: await resolveRef({ dir, ref: olderOids[1] }, systemGit),
      },
      {
        commands: [
          ORIGIN_READ,
          `fetch --depth 1 origin ${OID_MAIN}`,
          "rev-parse --is-shallow-repository",
          "fetch --unshallow origin",
        ],
        shallow: "false",
        oid: olderOids[1],
      },
    );
  });

  test("SG-TRN-02: the unshallow rung fetches the source's ref, and its failure is the one thrown", async (t) => {
    // arrange
    const systemGit = await hermeticGitProcess(t);
    const { dir } = await shallowFileClone(t);
    const recorded = recordingGitProcess(systemGit);

    // act
    const fetching = fetchCommit({ dir, sha: OID_MAIN, ref: "nosuch" }, recorded.gitProcess);

    // assert
    await assert.rejects(fetching, (error: unknown) => {
      assert.ok(error instanceof GitCommandError);
      assert.deepStrictEqual(
        { kind: error.kind, operation: error.operation },
        { kind: "remote-ref-missing", operation: "fetch --unshallow" },
      );
      return true;
    });
    assert.deepStrictEqual(recorded.commands, [
      ORIGIN_READ,
      `fetch --depth 1 origin ${OID_MAIN}`,
      "rev-parse --is-shallow-repository",
      "fetch --unshallow origin nosuch",
    ]);
  });

  test("SG-TRN-02: a complete clone skips the unshallow rung and throws the first failure", async (t) => {
    // arrange
    const systemGit = await hermeticGitProcess(t);
    const origin = await createGitTestRepository(t, { boundary: "local" });
    const dir = path.join(await createGitTestDirectory(t, { boundary: "local" }), "clone");
    await origin.run("clone", "-q", `file://${origin.dir}`, dir);
    const recorded = recordingGitProcess(systemGit);

    // act
    const fetching = fetchCommit({ dir, sha: OID_MAIN }, recorded.gitProcess);

    // assert
    await assert.rejects(fetching, (error: unknown) => {
      assert.ok(error instanceof GitCommandError);
      assert.deepStrictEqual(
        { kind: error.kind, operation: error.operation },
        { kind: "commit-missing", operation: "fetch --depth" },
      );
      return true;
    });
    assert.deepStrictEqual(recorded.commands, [
      ORIGIN_READ,
      `fetch --depth 1 origin ${OID_MAIN}`,
      "rev-parse --is-shallow-repository",
    ]);
  });

  test("D-PL8-24: an aborted first rung is thrown at once, with no second rung", async (t) => {
    // arrange
    const systemGit = await hermeticGitProcess(t);
    const { dir, olderOids } = await shallowFileClone(t);
    const recorded = recordingGitProcess(systemGit);
    const controller = new AbortController();
    controller.abort(new Error("cancelled"));

    // act
    const fetching = runWithGitAbortSignal(controller.signal, () =>
      fetchCommit({ dir, sha: olderOids[0] }, recorded.gitProcess),
    );

    // assert
    await assert.rejects(fetching, (error: unknown) => {
      assert.ok(error instanceof GitCommandError);
      assert.strictEqual(error.kind, "aborted");
      return true;
    });
    assert.deepStrictEqual(recorded.commands, [
      ORIGIN_READ,
      `fetch --depth 1 origin ${olderOids[0]}`,
    ]);
  });

  test("D-SG-13 / D-PL8-24: each rung reads its own limit and carries the scope's signal", async (t) => {
    // arrange
    setGitTimeoutVariable(t, "4321");
    const signal = new AbortController().signal;
    const requests: GitRequest[] = [];
    const stubGit: GitProcess = {
      locate: () => Promise.resolve("/usr/bin/git"),
      run: (request) => {
        requests.push(request);
        if (requests.length === 1) {
          return Promise.resolve({ exitCode: 0, stdout: `${REMOTE_URL}\n`, stderr: "" });
        }

        if (requests.length === 2) {
          return Promise.reject(
            new GitCommandError({ kind: "commit-missing" }, { operation: "fetch --depth" }),
          );
        }

        return Promise.resolve({ exitCode: 0, stdout: "true\n", stderr: "" });
      },
    };

    // act
    await runWithGitAbortSignal(signal, () =>
      fetchCommit({ dir: "/clone", sha: OID_MAIN, ref: "dev" }, stubGit),
    );

    // assert
    assert.deepStrictEqual(requests, [
      {
        subcommand: "config",
        lane: "local",
        cwd: "/clone",
        options: ["--local", "--get"],
        operands: ["remote.origin.url"],
        allowExit: [1],
        timeoutMs: 4321,
      },
      {
        subcommand: "fetch",
        lane: "network",
        options: ["--depth", "1"],
        operands: ["origin", OID_MAIN],
        config: [],
        cwd: "/clone",
        timeoutMs: 4321,
        signal,
      },
      {
        subcommand: "rev-parse",
        lane: "local",
        cwd: "/clone",
        options: ["--is-shallow-repository"],
        timeoutMs: 4321,
      },
      {
        subcommand: "fetch",
        lane: "network",
        options: ["--unshallow"],
        operands: ["origin", "dev"],
        config: [],
        cwd: "/clone",
        timeoutMs: 4321,
        signal,
      },
    ]);
  });

  test("D-SG-16: a clone whose origin is a github.com URL fetches with the base as insteadOf", async (t) => {
    // arrange
    setGitHubBaseUrl(t, "https://127.0.0.1:4443/base/");
    const requests: GitRequest[] = [];
    const stubGit: GitProcess = {
      locate: () => Promise.resolve("/usr/bin/git"),
      run: (request) => {
        requests.push(request);
        return Promise.resolve({ exitCode: 0, stdout: `${GITHUB_TOOLS_URL}\n`, stderr: "" });
      },
    };

    // act
    await fetchCommit({ dir: "/clone", sha: OID_MAIN }, stubGit);

    // assert
    assert.deepStrictEqual(
      requests.map((request) => [request.subcommand, request.config]),
      [
        ["config", undefined],
        ["fetch", ["url.https://127.0.0.1:4443/base/.insteadOf=https://github.com/"]],
      ],
    );
  });

  test("GHB-01: a failed rung under the base names the URL git fetched", async (t) => {
    // arrange
    setGitHubBaseUrl(t, "https://127.0.0.1:4443/base/");
    const stubGit: GitProcess = {
      locate: () => Promise.resolve("/usr/bin/git"),
      run: (request) =>
        request.subcommand === "config"
          ? Promise.resolve({ exitCode: 0, stdout: `${GITHUB_TOOLS_URL}\n`, stderr: "" })
          : Promise.reject(
              new GitCommandError({ kind: "repository-not-found" }, { operation: "fetch --depth" }),
            ),
    };

    // act
    const fetching = fetchCommit({ dir: "/clone", sha: OID_MAIN }, stubGit);

    // assert
    await assert.rejects(fetching, (error: unknown) => {
      assert.ok(error instanceof GitCommandError && error.cause instanceof FetchedUrlCause);
      assert.strictEqual(error.cause.url, "https://127.0.0.1:4443/base/acme/tools.git");
      return true;
    });
  });

  test("SG-TRN-02: a shallow check that fails throws the first rung's failure", async () => {
    // arrange
    const firstFailure = new GitCommandError(
      { kind: "commit-missing" },
      { operation: "fetch --depth" },
    );
    const subcommands: string[] = [];
    const stubGit: GitProcess = {
      locate: () => Promise.resolve("/usr/bin/git"),
      run: (request) => {
        subcommands.push(request.subcommand);
        if (request.subcommand === "config") {
          return Promise.resolve({ exitCode: 1, stdout: "", stderr: "" });
        }

        return Promise.reject(
          request.subcommand === "fetch"
            ? firstFailure
            : new GitCommandError({ kind: "not-a-repository" }, { operation: "rev-parse" }),
        );
      },
    };

    // act
    const fetching = fetchCommit({ dir: "/clone", sha: OID_MAIN }, stubGit);

    // assert
    await assert.rejects(fetching, (error: unknown) => error === firstFailure);
    assert.deepStrictEqual(subcommands, ["config", "fetch", "rev-parse"]);
  });
});

/**
 * SG-TRN-01: a repository served at a `file://` URL. `main` holds the initial
 * commit, which the lightweight tag `light`, the annotated tag `v1`, and an
 * annotated tag named `dev` name; the branch `dev` is one commit past it.
 */
async function advertisingRemote(t: TestContext): Promise<{
  readonly url: string;
  readonly initialOid: string;
  readonly devOid: string;
}> {
  const repository = await createGitTestRepository(t, { boundary: "local" });
  await repository.run("tag", "light");
  await repository.run("tag", "-a", "-m", "v1", "v1");
  await repository.run("tag", "-a", "-m", "dev", "dev");
  await repository.run("checkout", "-q", "-b", "dev");
  const devOid = await repository.commit([{ filepath: "dev.txt", contents: "dev\n" }], "dev");
  await repository.run("checkout", "-q", "main");
  return { url: `file://${repository.dir}`, initialOid: repository.initialOid, devOid };
}

/**
 * D-SG-16: the https git host serving the repository `acme/tools`, the GitHub
 * base override pointed at it, and a git process that trusts its certificate.
 */
async function gitHubBaseStandIn(t: TestContext): Promise<{
  readonly host: HttpsGitHost;
  readonly oid: string;
  readonly gitProcess: GitProcess;
}> {
  const root = await realpath(await createGitTestDirectory(t, { boundary: "local" }));
  const host = await HttpsGitHost.start(root);
  t.after(() => host.close());
  const served = await createGitTestRepository(t, { boundary: "local" });
  await served.cloneBare(host.repositoryPath("tools"));
  setGitHubBaseUrl(t, `https://${host.address}`);
  return {
    host,
    oid: served.initialOid,
    gitProcess: await hermeticGitProcess(t, { GIT_SSL_CAINFO: host.certificatePath }),
  };
}

describe("resolveRemoteRef", () => {
  const SELECTIONS: ReadonlyArray<{
    readonly title: string;
    readonly ref?: string;
    readonly expected: (remote: Awaited<ReturnType<typeof advertisingRemote>>) => string;
  }> = [
    { title: "resolves the remote HEAD", expected: (remote) => remote.initialOid },
    {
      title: "resolves a branch by its short name before a tag of the same name",
      ref: "dev",
      expected: (remote) => remote.devOid,
    },
    {
      title: "resolves an annotated tag to the commit it peels to",
      ref: "v1",
      expected: (remote) => remote.initialOid,
    },
    {
      title: "resolves a lightweight tag to its commit",
      ref: "light",
      expected: (remote) => remote.initialOid,
    },
    {
      title: "resolves a bare advertised ref name",
      ref: "HEAD",
      expected: (remote) => remote.initialOid,
    },
  ];

  for (const { title, ref, expected } of SELECTIONS) {
    test(`SG-TRN-01: ${title}`, async (t) => {
      // arrange
      const remote = await advertisingRemote(t);
      const systemGit = await hermeticGitProcess(t);

      // act
      const oid = await resolveRemoteRef(
        { url: remote.url, ...(ref !== undefined && { ref }) },
        systemGit,
      );

      // assert
      assert.strictEqual(oid, expected(remote));
    });
  }

  test("SG-TRN-01: answers undefined for a ref the remote does not advertise", async (t) => {
    // arrange
    const remote = await advertisingRemote(t);
    const systemGit = await hermeticGitProcess(t);

    // act
    const oid = await resolveRemoteRef({ url: remote.url, ref: "missing" }, systemGit);

    // assert
    assert.strictEqual(oid, undefined);
  });

  test("SG-TRN-01: answers undefined for a remote whose HEAD names no commit", async (t) => {
    // arrange
    const repository = await createGitTestRepository(t, { boundary: "local" });
    const bare = path.join(await createGitTestDirectory(t, { boundary: "local" }), "unborn.git");
    await repository.cloneBare(bare);
    await gitTestCheckout(bare).run("symbolic-ref", "HEAD", "refs/heads/nosuch");
    const systemGit = await hermeticGitProcess(t);

    // act
    const oid = await resolveRemoteRef({ url: `file://${bare}` }, systemGit);

    // assert
    assert.strictEqual(oid, undefined);
  });

  test("D-SG-13 / D-PL8-24: sends one ls-remote of the four names with the limit and the scope's signal", async (t) => {
    // arrange
    setGitTimeoutVariable(t, "4321");
    const remote = await advertisingRemote(t);
    const recorded = recordingGitProcess(await hermeticGitProcess(t));
    const signal = new AbortController().signal;

    // act
    await runWithGitAbortSignal(signal, () =>
      resolveRemoteRef({ url: remote.url, ref: "dev" }, recorded.gitProcess),
    );

    // assert
    assert.deepStrictEqual(recorded.requests, [
      {
        subcommand: "ls-remote",
        lane: "network",
        options: [],
        operands: [remote.url, "refs/heads/dev", "refs/tags/dev^{}", "refs/tags/dev", "dev"],
        config: [],
        timeoutMs: 4321,
        signal,
      },
    ]);
  });

  test("D-SG-16, GHB-01: resolves a github.com URL at the base through its insteadOf pair", async (t) => {
    // arrange
    const standIn = await gitHubBaseStandIn(t);
    const recorded = recordingGitProcess(standIn.gitProcess);

    // act
    const oid = await resolveRemoteRef({ url: GITHUB_TOOLS_URL }, recorded.gitProcess);

    // assert
    assert.strictEqual(oid, standIn.oid);
    assert.deepStrictEqual(
      recorded.requests.map((request) => request.config),
      [[`url.https://${standIn.host.address}/.insteadOf=https://github.com/`]],
    );
  });

  test("GHB-01: a failure at the base names the URL git fetched", async (t) => {
    // arrange
    const standIn = await gitHubBaseStandIn(t);

    // act
    const resolution = resolveRemoteRef(
      { url: "https://github.com/acme/missing.git" },
      standIn.gitProcess,
    );

    // assert
    await assert.rejects(resolution, (error: unknown) => {
      assert.ok(error instanceof GitCommandError);
      assert.ok(error.cause instanceof FetchedUrlCause);
      assert.deepStrictEqual(
        { kind: error.kind, url: error.cause.url },
        { kind: "repository-not-found", url: standIn.host.repositoryUrl("missing") },
      );
      return true;
    });
  });

  test("GHB-04: a failure outside github.com carries no cause and never reads the variable", async (t) => {
    // arrange
    setGitHubBaseUrl(t, "http://mirror.example");
    const missing = path.join(await createGitTestDirectory(t, { boundary: "local" }), "missing");
    const systemGit = await hermeticGitProcess(t);

    // act
    const resolution = resolveRemoteRef({ url: `file://${missing}` }, systemGit);

    // assert
    await assert.rejects(resolution, (error: unknown) => {
      assert.ok(error instanceof GitCommandError);
      assert.deepStrictEqual(
        { kind: error.kind, cause: error.cause },
        { kind: "repository-not-found", cause: undefined },
      );
      return true;
    });
  });

  test("GHB-03: an invalid base refuses a github.com URL before git runs", async (t) => {
    // arrange
    setGitHubBaseUrl(t, "https://h.example/a=b");
    const recorded = recordingGitProcess(await hermeticGitProcess(t));

    // act
    const resolution = resolveRemoteRef({ url: GITHUB_TOOLS_URL }, recorded.gitProcess);

    // assert
    await assert.rejects(resolution, (error: unknown) => {
      assert.ok(error instanceof InvalidGitHubBaseUrlError);
      assert.strictEqual(error.problem, "equals-sign");
      return true;
    });
    assert.deepStrictEqual(recorded.requests, []);
  });
});

/** A commit the wire doubles serve over protocol version 1: its advertisement and its pack. */
interface ServedCommit {
  readonly oid: string;
  readonly advertisement: WireResponse;
  readonly pack: WireResponse;
}

/**
 * A clone whose origin is `REMOTE_URL`, and a commit of another repository
 * that the wire doubles serve it, so `fetch` drives the redirect client.
 */
async function wireFetchFixture(
  t: TestContext,
): Promise<{ readonly dir: string; readonly served: ServedCommit }> {
  const remote = await createGitTestRepository(t, { boundary: "local" });
  await remote.commit([{ filepath: "next.txt", contents: "next\n" }], "next");
  const { oid, packfile } = await remote.pack();
  const local = await createGitTestRepository(t, { boundary: "local" });
  await local.run("remote", "add", "origin", REMOTE_URL);
  return {
    dir: local.dir,
    served: {
      oid,
      advertisement: {
        statusCode: 200,
        statusMessage: "OK",
        headers: { "content-type": "application/x-git-upload-pack-advertisement" },
        body: uploadPackAdvertisementBody(oid),
      },
      pack: {
        statusCode: 200,
        statusMessage: "OK",
        headers: { "content-type": "application/x-git-upload-pack-result" },
        body: packResultBody(packfile),
      },
    },
  };
}

/**
 * The headers isomorphic-git's discovery request keeps on a hop to another
 * origin: protocol headers only, never a credential or a cookie (WR-03).
 */
const CROSS_ORIGIN_DISCOVERY_HEADERS = ["accept-encoding"];

/** The commit `refs/remotes/origin/main` names in `dir` after a fetch. */
function fetchedMain(dir: string): Promise<string | undefined> {
  return resolveRef({ dir, ref: "refs/remotes/origin/main" });
}

// GAUTH-06, Q-02, WR-03, WR-04, IN-03: the redirect client that every
// isomorphic-git request of `platform/git.ts` goes through, driven by `fetch`.
describe("the redirect client", () => {
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
      const { dir } = await wireFetchFixture(t);
      const credentials = storedCredentials();

      // act
      const fetching = fetch({ dir, auth: boundAuth(credentials) });

      // assert
      await assert.rejects(fetching, crossOriginChallengeFrom(origin));
      assert.deepStrictEqual(wireCredentials(requests), expectedCrossOriginWireLog(location));
      assert.deepStrictEqual(credentials.calls, { fill: [], approve: [], reject: [] });
    });
  }

  test("Q-02: fails a cross-origin challenge without starting a Device Flow", async (t) => {
    // arrange
    const requests = installWireTransport(t, crossOriginServer(OTHER_PORT_INFO_URL));
    const { dir } = await wireFetchFixture(t);
    const credentials = storedCredentials();
    const onAuthRequired = mock<OnAuthRequiredFn>({ exactParams: true, name: "device flow" });

    // act
    const fetching = fetch({
      dir,
      auth: {
        credentialOps: credentials.credentialOps,
        host: HOST,
        kind: "device-flow",
        onAuthRequired,
      },
    });

    // assert
    await assert.rejects(fetching, crossOriginChallengeFrom(`https://${HOST}:8443`));
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
    const { dir } = await wireFetchFixture(t);
    const credentials = storedCredentials();

    // act
    const fetching = fetch({ dir, auth: boundAuth(credentials) });

    // assert
    await assert.rejects(fetching, crossOriginChallengeFrom(`https://${HOST}:8443`));
    assert.deepStrictEqual(
      wireCredentials(requests),
      expectedCrossOriginWireLog(OTHER_PORT_INFO_URL),
    );
    assert.deepStrictEqual(credentials.calls, { fill: [], approve: [], reject: [] });
  });

  test("Q-02: fails a challenge back on the original origin after a detour through another origin", async (t) => {
    // arrange
    const { dir, served } = await wireFetchFixture(t);
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
          : served.advertisement;
      }

      throw unplannedWireRequest(request);
    });
    const credentials = storedCredentials();
    const onAuthRequired = mock<OnAuthRequiredFn>({ exactParams: true, name: "device flow" });

    // act
    const fetching = fetch({
      dir,
      auth: {
        credentialOps: credentials.credentialOps,
        host: HOST,
        kind: "device-flow",
        onAuthRequired,
      },
    });

    // assert
    await assert.rejects(fetching, crossOriginChallengeFrom(`https://${HOST}`));
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
    const { dir, served } = await wireFetchFixture(t);
    const requests = installWireTransport(t, (request) => {
      if (request.url === BOUND_INFO_URL) {
        return request.headers.authorization === undefined
          ? unauthorizedWireResponse()
          : redirectWireResponse(302, OTHER_PORT_INFO_URL);
      }

      if (request.url === OTHER_PORT_INFO_URL) {
        return served.advertisement;
      }

      if (request.url === BOUND_UPLOAD_PACK_URL && request.headers.authorization !== undefined) {
        return served.pack;
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
    await fetch({ dir, auth: boundAuth(credentials) });

    // assert
    assert.strictEqual(await fetchedMain(dir), served.oid);
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
    assert.deepStrictEqual(
      Object.keys(requests[2]?.headers ?? {}).sort(),
      CROSS_ORIGIN_DISCOVERY_HEADERS,
    );
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
      const { dir, served } = await wireFetchFixture(t);
      const requests = installWireTransport(t, sameOriginServer(location, served));
      const credentials = storedCredentials();

      // act
      await fetch({ dir, auth: boundAuth(credentials) });

      // assert
      assert.strictEqual(await fetchedMain(dir), served.oid);
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
      keepsBody: false,
      finalContentHeaders: [],
    },
    {
      title: "re-sends a POST answered with 307 with its body",
      statusCode: 307,
      finalMethod: "POST",
      keepsBody: true,
      finalContentHeaders: ["content-length", "content-type"],
    },
  ];

  for (const { title, statusCode, finalMethod, keepsBody, finalContentHeaders } of POST_REDIRECTS) {
    test(title, async (t) => {
      // arrange
      const { dir, served } = await wireFetchFixture(t);
      const requests = installWireTransport(t, postRedirectServer(statusCode, served));

      // act
      await fetch({ dir });

      // assert
      assert.strictEqual(await fetchedMain(dir), served.oid);
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
          body,
          contentHeaders: Object.keys(headers)
            .filter((name) => name.startsWith("content-"))
            .sort(),
        })),
        [
          {
            body: keepsBody ? requests[1]?.body : Buffer.alloc(0),
            contentHeaders: finalContentHeaders,
          },
        ],
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
      const { dir, served } = await wireFetchFixture(t);
      const requests = installWireTransport(
        t,
        authenticatedPostRedirectServer(307, location, served, () => unauthorizedWireResponse()),
      );
      const credentials = storedCredentials();

      // act
      const fetching = fetch({ dir, auth: boundAuth(credentials) });

      // assert
      await assert.rejects(fetching, crossOriginChallengeFrom(origin));
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
    const { dir, served } = await wireFetchFixture(t);
    const requests = installWireTransport(
      t,
      authenticatedPostRedirectServer(302, OTHER_PORT_UPLOAD_PACK_URL, served, () =>
        unauthorizedWireResponse(),
      ),
    );
    const credentials = storedCredentials();

    // act
    const fetching = fetch({ dir, auth: boundAuth(credentials) });

    // assert
    await assert.rejects(fetching, crossOriginChallengeFrom(`https://${HOST}:8443`));
    assert.deepStrictEqual(wireCredentials(requests), [
      { url: BOUND_INFO_URL, authorization: null },
      { url: BOUND_INFO_URL, authorization: BASIC_CREDENTIAL },
      { url: BOUND_UPLOAD_PACK_URL, authorization: BASIC_CREDENTIAL },
      { url: OTHER_PORT_UPLOAD_PACK_URL, authorization: null },
    ]);
  });

  test("GAUTH-06: forwards the credential on a git-upload-pack POST redirect within its origin (307)", async (t) => {
    // arrange
    const { dir, served } = await wireFetchFixture(t);
    const requests = installWireTransport(
      t,
      authenticatedPostRedirectServer(307, RENAMED_UPLOAD_PACK_URL, served, (request) =>
        request.headers.authorization === undefined ? unauthorizedWireResponse() : served.pack,
      ),
    );
    const credentials = storedCredentials();

    // act
    await fetch({ dir, auth: boundAuth(credentials) });

    // assert
    assert.strictEqual(await fetchedMain(dir), served.oid);
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
      const { dir } = await wireFetchFixture(t);

      // act
      const fetching = fetch({ dir });

      // assert
      await assert.rejects(fetching, (error: unknown) => {
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
    const { dir } = await wireFetchFixture(t);

    // act
    const fetching = fetch({ dir });

    // assert
    await assert.rejects(fetching, (error: unknown) => {
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
    await repository.run("remote", "add", "origin", REMOTE_URL);

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

  test("SG-TRN-01: reports unreadable for a .git/config that git cannot parse", async (t) => {
    // arrange
    const systemGit = await hermeticGitProcess(t);
    const repository = await createGitTestRepository(t, { boundary: "local" });
    await writeFile(path.join(repository.dir, ".git", "config"), "[core\n");

    // act
    const remotes = await listRemotes({ dir: repository.dir }, systemGit);

    // assert
    assert.deepStrictEqual(remotes, { kind: "unreadable" });
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

  test("GHB-01: lists the tags of a github.com URL from the base", async (t) => {
    // arrange
    const requests = installRemoteTransport(t, [
      `${OID_LIGHTWEIGHT} refs/tags/v1.0.0`,
      `${OID_TAG} refs/tags/v2.0.0 peeled:${OID_PEELED}`,
    ]);
    setGitHubBaseUrl(t, `https://${HOST}`);

    // act
    const tags = await listRemoteTags({ url: GITHUB_REMOTE_URL });

    // assert
    assert.deepStrictEqual(tags, [
      { name: "v1.0.0", oid: OID_LIGHTWEIGHT },
      { name: "v2.0.0", oid: OID_PEELED },
    ]);
    assert.deepStrictEqual(requests, expectedTagRequests());
  });

  test("D-10: a failed listing from the base names the fetched URL", async (t) => {
    // arrange
    const requests = installFailedDiscoveryTransport(t);
    setGitHubBaseUrl(t, `https://${HOST}`);

    // act
    const listing = listRemoteTags({ url: GITHUB_REMOTE_URL });

    // assert
    await assert.rejects(listing, (error: unknown) =>
      isFetchedUrlDiscoveryError(error, "git.listServerRefs"),
    );
    assert.deepStrictEqual(requests, [expectedDiscoveryRequest({ "Git-Protocol": "version=2" })]);
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
    await repository.run("tag", "v1.0.0", repository.initialOid);
    const secondOid = await repository.commit(
      [{ filepath: "second.txt", contents: "second\n" }],
      "second",
    );
    await repository.run("tag", "v2.0.0", secondOid);

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
    await repository.run("tag", "v1.0.0", repository.initialOid);

    // act
    const oid = await resolveTagOid({ dir: repository.dir, name: "v1.0.0", cache: {} });

    // assert
    assert.strictEqual(oid, repository.initialOid);
  });

  test("WR-01: a lightweight tag pointing at a blob resolves to undefined so the caller can drop it", async (t) => {
    // arrange
    const repository = await createGitTestRepository(t, { boundary: "local" });
    const blobOid = await repository.hashObject("hello");
    await repository.run("update-ref", "refs/tags/blob-tag", blobOid);

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
    await repository.run("tag", "-a", "-m", "release 2.0.0", "v2.0.0", repository.initialOid);
    const tagObjectOid = await repository.run("rev-parse", "refs/tags/v2.0.0");
    assert.notStrictEqual(tagObjectOid, repository.initialOid);

    // act
    const oid = await resolveTagOid({ dir: repository.dir, name: "v2.0.0", cache: {} });

    // assert
    assert.strictEqual(oid, repository.initialOid);
  });

  test("WR-06: a tag pointing at neither a commit nor another tag resolves to undefined so the caller can drop it", async (t) => {
    // arrange
    const repository = await createGitTestRepository(t, { boundary: "local" });
    const blobOid = await repository.hashObject("hello");
    await repository.run("tag", "-a", "-m", "blob-tag", "blob-tag", blobOid);

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
      await repository.run("tag", "-a", "-m", name, name, pointsAt);
      pointsAt = await repository.run("rev-parse", `refs/tags/${name}`);
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

/** A promise and the two functions that settle it. */
interface Settleable<T> {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
  readonly reject: (reason: Error) => void;
}

function settleable<T>(): Settleable<T> {
  let resolve: (value: T) => void = () => {
    throw new Error("the promise was not created");
  };

  let reject: (reason: Error) => void = () => {
    throw new Error("the promise was not created");
  };

  const promise = new Promise<T>((settleWith, failWith) => {
    resolve = settleWith;
    reject = failWith;
  });
  return { promise, resolve, reject };
}

/** A request the transport holds until the case settles `answer`. */
interface HeldTransport {
  readonly requests: string[];
  readonly arrived: Promise<void>;
  readonly answer: Settleable<GitHttpResponse>;
}

function installHeldTransport(t: TestContext): HeldTransport {
  const requests: string[] = [];
  const arrival = settleable<undefined>();
  const answer = settleable<GitHttpResponse>();
  t.mock.method(http, "request", (request: GitHttpRequest): Promise<GitHttpResponse> => {
    requests.push(`${request.method ?? "GET"} ${request.url}`);
    arrival.resolve(undefined);
    return answer.promise;
  });
  return { requests, arrived: arrival.promise, answer };
}

/** A response body whose `return()` calls are counted. */
function countedBody(chunks: readonly Uint8Array[]): {
  readonly body: AsyncIterableIterator<Uint8Array>;
  readonly returns: () => number;
} {
  let returned = 0;
  const source = chunks[Symbol.iterator]();
  const body: AsyncIterableIterator<Uint8Array> = {
    next: () => Promise.resolve(source.next()),
    return: () => {
      returned += 1;
      return Promise.resolve({ done: true, value: undefined });
    },
    [Symbol.asyncIterator]: () => body,
  };
  return { body, returns: () => returned };
}

/**
 * A tag listing whose ls-refs body yields its first tag, then holds its next
 * read; `onHeldRead` runs when that read starts.
 */
function installCutOffTagListing(
  t: TestContext,
  onHeldRead: () => void,
): { readonly returns: () => number } {
  let returned = 0;
  t.mock.method(http, "request", async (request: GitHttpRequest): Promise<GitHttpResponse> => {
    await collectBody(request.body);
    if (request.method === "GET") {
      return response(
        request.url,
        200,
        "OK",
        "application/x-git-upload-pack-advertisement",
        advertisementBody(),
      );
    }

    let reads = 0;
    const body: AsyncIterableIterator<Uint8Array> = {
      next: () => {
        reads += 1;
        if (reads === 1) {
          return Promise.resolve({
            done: false,
            value: Uint8Array.from(packet(`${OID_LIGHTWEIGHT} refs/tags/v1.0.0\n`)),
          });
        }

        onHeldRead();
        return new Promise(() => undefined);
      },
      return: () => {
        returned += 1;
        return Promise.resolve({ done: true, value: undefined });
      },
      [Symbol.asyncIterator]: () => body,
    };
    return {
      url: request.url,
      statusCode: 200,
      statusMessage: "OK",
      headers: { "content-type": "application/x-git-upload-pack-result" },
      body,
    };
  });
  return { returns: () => returned };
}

/**
 * Answers `info/refs` with a protocol version 1 advertisement of `OID_MAIN`,
 * then answers `git-upload-pack` with a NAK and a pack stream that stays open.
 */
function installStalledPackWireTransport(t: TestContext): {
  readonly pack: PassThrough;
  readonly packAnswered: Promise<void>;
} {
  const pack = new PassThrough();
  const packAnswer = settleable<undefined>();

  function request(
    options: WireRequestOptions,
    onResponse: (response: Readable) => void,
  ): EventEmitter {
    return Object.assign(new EventEmitter(), {
      end(): void {
        setImmediate(() => {
          if (options.method === "GET") {
            onResponse(
              Object.assign(Readable.from([uploadPackAdvertisementBody(OID_MAIN)]), {
                statusCode: 200,
                statusMessage: "OK",
                headers: { "content-type": "application/x-git-upload-pack-advertisement" },
              }),
            );
            return;
          }

          onResponse(
            Object.assign(pack, {
              statusCode: 200,
              statusMessage: "OK",
              headers: { "content-type": "application/x-git-upload-pack-result" },
            }),
          );
          pack.write(packet("NAK\n"));
          packAnswer.resolve(undefined);
        });
      },
    });
  }

  t.mock.method(https, "request", request);
  return { pack, packAnswered: packAnswer.promise };
}

async function remoteBranchesAndHead(
  dir: string,
): Promise<{ readonly head: string; readonly remoteBranches: string[] }> {
  const checkout = gitTestCheckout(dir);
  const remoteRefs = await checkout.run(
    "for-each-ref",
    "--format=%(refname:lstrip=3)",
    "refs/remotes/origin",
  );
  return {
    head: await checkout.run("rev-parse", "HEAD"),
    remoteBranches: remoteRefs === "" ? [] : remoteRefs.split("\n"),
  };
}

function isAbortReason(reason: Error): (error: unknown) => boolean {
  return (error) => {
    assert.strictEqual(error, reason);
    return true;
  };
}

/**
 * Runs `run` in this many microtask turns: late enough that a request or body
 * read that settled just now has already told its abort race, early enough
 * that the call has not returned to its caller.
 */
function afterSettlement(run: () => void): void {
  queueMicrotask(() => {
    queueMicrotask(() => {
      queueMicrotask(run);
    });
  });
}

describe("runWithGitAbortSignal", () => {
  test("D-PL8-24: a fetch whose request never answers rejects with the abort reason and leaves the refs as they were", async (t) => {
    // arrange
    const transport = installHeldTransport(t);
    const repository = await createGitTestRepository(t, { boundary: "local" });
    await repository.run("remote", "add", "origin", REMOTE_URL);
    const refsBefore = await remoteBranchesAndHead(repository.dir);
    const controller = new AbortController();
    const reason = new Error("background step stopped");
    const fetching = runWithGitAbortSignal(controller.signal, () => fetch({ dir: repository.dir }));
    await transport.arrived;

    // act
    controller.abort(reason);

    // assert
    await assert.rejects(fetching, isAbortReason(reason));
    assert.deepStrictEqual(await remoteBranchesAndHead(repository.dir), refsBefore);
    assert.deepStrictEqual(transport.requests, [`GET ${BOUND_INFO_URL}`]);
  });

  test("D-PL8-24: a fetch whose pack stalls rejects with the abort reason and destroys the pack stream", async (t) => {
    // arrange
    const transport = installStalledPackWireTransport(t);
    const repository = await createGitTestRepository(t, { boundary: "local" });
    await repository.run("remote", "add", "origin", REMOTE_URL);
    const controller = new AbortController();
    const reason = new Error("background step stopped");
    const fetching = runWithGitAbortSignal(controller.signal, () => fetch({ dir: repository.dir }));
    await transport.packAnswered;
    await new Promise((resolve) => {
      setImmediate(resolve);
    });

    // act
    controller.abort(reason);

    // assert
    await assert.rejects(fetching, isAbortReason(reason));
    assert.strictEqual(transport.pack.destroyed, true);
  });

  test("D-PL8-24: an already-aborted signal rejects before any request is sent", async (t) => {
    // arrange
    const transport = installHeldTransport(t);
    const reason = new Error("background step stopped");

    // act
    const listing = runWithGitAbortSignal(AbortSignal.abort(reason), () =>
      listRemoteTags({ url: REMOTE_URL }),
    );

    // assert
    await assert.rejects(listing, isAbortReason(reason));
    assert.deepStrictEqual(transport.requests, []);
  });

  test("D-PL8-24: a response that arrives after its request was aborted has its body ended", async (t) => {
    // arrange
    const transport = installHeldTransport(t);
    const controller = new AbortController();
    const reason = new Error("background step stopped");
    const listing = runWithGitAbortSignal(controller.signal, () =>
      listRemoteTags({ url: REMOTE_URL }),
    );
    await transport.arrived;
    controller.abort(reason);
    await assert.rejects(listing, isAbortReason(reason));
    const late = countedBody([advertisementBody()]);

    // act
    transport.answer.resolve({
      url: BOUND_INFO_URL,
      statusCode: 200,
      statusMessage: "OK",
      headers: { "content-type": "application/x-git-upload-pack-advertisement" },
      body: late.body,
    });
    await new Promise((resolve) => {
      setImmediate(resolve);
    });

    // assert
    assert.strictEqual(late.returns(), 1);
  });

  test("D-PL8-24: a late response whose body fails to end raises no unhandled rejection", async (t) => {
    // arrange
    const transport = installHeldTransport(t);
    const controller = new AbortController();
    const reason = new Error("background step stopped");
    const listing = runWithGitAbortSignal(controller.signal, () =>
      listRemoteTags({ url: REMOTE_URL }),
    );
    await transport.arrived;
    controller.abort(reason);
    await assert.rejects(listing, isAbortReason(reason));
    let returned = 0;
    const body: AsyncIterableIterator<Uint8Array> = {
      next: () => Promise.resolve({ done: true, value: undefined }),
      return: () => {
        returned += 1;
        return Promise.reject(new Error("socket already closed"));
      },
      [Symbol.asyncIterator]: () => body,
    };
    const unhandled: unknown[] = [];
    const onUnhandled = (error: unknown): void => {
      unhandled.push(error);
    };

    process.on("unhandledRejection", onUnhandled);
    t.after(() => {
      process.off("unhandledRejection", onUnhandled);
    });

    // act
    transport.answer.resolve({
      url: BOUND_INFO_URL,
      statusCode: 200,
      statusMessage: "OK",
      headers: { "content-type": "application/x-git-upload-pack-advertisement" },
      body,
    });
    await new Promise((resolve) => {
      setImmediate(resolve);
    });

    // assert
    assert.deepStrictEqual({ returned, unhandled }, { returned: 1, unhandled: [] });
  });

  test("D-PL8-24: a request that fails after its abort still rejects with the abort reason", async (t) => {
    // arrange
    const transport = installHeldTransport(t);
    const controller = new AbortController();
    const reason = new Error("background step stopped");
    const listing = runWithGitAbortSignal(controller.signal, () =>
      listRemoteTags({ url: REMOTE_URL }),
    );
    await transport.arrived;
    controller.abort(reason);

    // act
    transport.answer.reject(new Error("socket closed"));

    // assert
    await assert.rejects(listing, isAbortReason(reason));
  });

  test("D-PL8-24: a call that already failed for another reason rejects with that error when the abort lands afterwards", async (t) => {
    // arrange
    const controller = new AbortController();
    const failure = new Error("socket closed");
    t.mock.method(http, "request", (): Promise<GitHttpResponse> => {
      afterSettlement(() => {
        controller.abort(new Error("background step stopped"));
      });
      return Promise.reject(failure);
    });

    // act
    const listing = runWithGitAbortSignal(controller.signal, () =>
      listRemoteTags({ url: REMOTE_URL }),
    );

    // assert
    await assert.rejects(listing, (error: unknown) => error === failure);
  });

  test("D-PL8-24: a call that already completed returns its result when the abort lands afterwards", async (t) => {
    // arrange
    const controller = new AbortController();
    t.mock.method(http, "request", async (request: GitHttpRequest): Promise<GitHttpResponse> => {
      await collectBody(request.body);
      const answer = response(
        request.url,
        200,
        "OK",
        request.method === "GET"
          ? "application/x-git-upload-pack-advertisement"
          : "application/x-git-upload-pack-result",
        request.method === "GET"
          ? advertisementBody()
          : refsBody([`${OID_LIGHTWEIGHT} refs/tags/v1.0.0`]),
      );
      const { body } = answer;
      if (request.method !== "POST" || body === undefined) {
        return answer;
      }

      const source = body[Symbol.asyncIterator]();
      return {
        ...answer,
        body: {
          next: async () => {
            const chunk = await source.next();
            if (chunk.done === true) {
              afterSettlement(() => {
                controller.abort(new Error("background step stopped"));
              });
            }

            return chunk;
          },
          [Symbol.asyncIterator]() {
            return this;
          },
        },
      };
    });

    // act
    const tags = await runWithGitAbortSignal(controller.signal, () =>
      listRemoteTags({ url: REMOTE_URL }),
    );

    // assert
    assert.deepStrictEqual(tags, [{ name: "v1.0.0", oid: OID_LIGHTWEIGHT }]);
  });

  test("D-PL8-24: a tag listing whose tag list is cut off by the abort rejects instead of returning part of it", async (t) => {
    // arrange
    const controller = new AbortController();
    const reason = new Error("background step stopped");
    const listing = installCutOffTagListing(t, () => {
      queueMicrotask(() => {
        controller.abort(reason);
      });
    });

    // act
    const tags = runWithGitAbortSignal(controller.signal, () =>
      listRemoteTags({ url: REMOTE_URL }),
    );

    // assert
    await assert.rejects(tags, isAbortReason(reason));
    assert.strictEqual(listing.returns(), 1);
  });

  test("D-PL8-24: a body read that starts after the abort ends the body and rejects", async (t) => {
    // arrange
    const controller = new AbortController();
    const reason = new Error("background step stopped");
    const listing = installCutOffTagListing(t, () => {
      controller.abort(reason);
    });

    // act
    const tags = runWithGitAbortSignal(controller.signal, () =>
      listRemoteTags({ url: REMOTE_URL }),
    );

    // assert
    await assert.rejects(tags, isAbortReason(reason));
    assert.strictEqual(listing.returns(), 1);
  });

  test("D-PL8-24: a scope whose signal never aborts lists every tag with the same requests", async (t) => {
    // arrange
    const requests = installRemoteTransport(t, [
      `${OID_LIGHTWEIGHT} refs/tags/v1.0.0`,
      `${OID_TAG} refs/tags/v2.0.0 peeled:${OID_PEELED}`,
    ]);

    // act
    const tags = await runWithGitAbortSignal(new AbortController().signal, () =>
      listRemoteTags({ url: REMOTE_URL }),
    );

    // assert
    assert.deepStrictEqual(tags, [
      { name: "v1.0.0", oid: OID_LIGHTWEIGHT },
      { name: "v2.0.0", oid: OID_PEELED },
    ]);
    assert.deepStrictEqual(requests, expectedTagRequests());
  });

  test("D-PL8-24: a response without a body reaches isomorphic-git unchanged inside a scope", async (t) => {
    // arrange
    t.mock.method(http, "request", (request: GitHttpRequest): Promise<GitHttpResponse> =>
      Promise.resolve({
        url: request.url,
        statusCode: 500,
        statusMessage: "Internal Server Error",
        headers: {},
      }),
    );

    // act
    const listing = runWithGitAbortSignal(new AbortController().signal, () =>
      listRemoteTags({ url: REMOTE_URL }),
    );

    // assert
    await assert.rejects(listing, (error: unknown) => {
      assert.ok(error instanceof git.Errors.HttpError);
      assert.deepStrictEqual(error.data, {
        statusCode: 500,
        statusMessage: "Internal Server Error",
        response: undefined,
      });
      return true;
    });
  });
});

describe("GitOps contract", () => {
  registerGitOpsContract(createProductionGitOps);
});

void ({ username: "user", password: "secret" } satisfies GitCredentials);
void ({ name: "v1.0.0", oid: OID_MAIN } satisfies RemoteTag);

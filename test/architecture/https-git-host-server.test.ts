/**
 * @fileoverview Checks the https git host's own answers: a request it cannot
 * serve, a body the backend never reads, an armed repository whose name the
 * request percent-encodes, and the catalog files it serves for hosted
 * marketplaces (HOST-01, HOST-03, HOST-04, D-PL5-06). It also checks that a
 * system git client trusts the host through the host's CA file alone and
 * fetches a commit by SHA over protocols v2 and v0 (SG-HRN-02).
 */

import assert from "node:assert/strict";
import { X509Certificate } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { request } from "node:https";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, test } from "node:test";

import { runGit } from "../../features/lib/hermetic-git.ts";
import { HttpsGitHost } from "../../features/lib/https-git-host/server.ts";
import {
  createGitTestDirectory,
  createGitTestRepository,
  runSystemGit,
  SystemGitError,
} from "../platform/git-test-repository.ts";

import type { GitHostRequest } from "../../features/lib/https-git-host/server.ts";
import type { SystemGitCall } from "../platform/git-test-repository.ts";
import type { TestContext } from "node:test";

const INFO_REFS = "/acme/tools.git/info/refs?service=git-upload-pack";
const CATALOG = "/acme/catalog/marketplace.json";

/** Starts a host in a fresh root that serves the empty repository `acme/tools`. */
async function startHost(t: TestContext): Promise<HttpsGitHost> {
  const root = await mkdtemp(path.join(tmpdir(), "https-git-host-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const host = await HttpsGitHost.start(root);
  t.after(() => host.close());
  await runGit(root, host.gitHome, "init", "-q", "--bare", host.repositoryPath("tools"));
  return host;
}

/** The first commit and the tip of a repository the host serves. */
interface PublishedCommits {
  readonly first: string;
  readonly tip: string;
}

/**
 * Builds a two-commit repository and publishes it bare as `directory` of the
 * host's default owner, so the first commit is reachable but no ref names it.
 */
async function publish(
  t: TestContext,
  host: HttpsGitHost,
  directory: string,
): Promise<PublishedCommits> {
  const repository = await createGitTestRepository(t, { boundary: "local" });
  const tip = await repository.commit([{ filepath: "NOTES.md", contents: "notes\n" }], "second");
  await repository.cloneBare(host.repositoryPath(directory));
  return { first: repository.initialOid, tip };
}

/** A system git client with its own scratch HOME and a directory to clone into. */
interface GitClient {
  readonly root: string;
  /** Runs in `root` and trusts the host through its CA file and nothing else. */
  readonly trusted: SystemGitCall;
  /** Runs in `root` and names no CA file. */
  readonly untrusted: SystemGitCall;
  /** Runs in the clone `clone` under `root` and trusts the host as `trusted` does. */
  inClone(clone: string): SystemGitCall;
}

async function gitClient(t: TestContext, host: HttpsGitHost): Promise<GitClient> {
  const root = await createGitTestDirectory(t, { boundary: "local" });
  const home = await createGitTestDirectory(t, { boundary: "local" });
  const variables = { GIT_SSL_CAINFO: host.certificatePath };
  return {
    root,
    trusted: { cwd: root, home, variables },
    untrusted: { cwd: root, home },
    inClone: (clone) => ({ cwd: path.join(root, clone), home, variables }),
  };
}

/** Clones the repository `directory` with `--depth 1` into the clone `directory` of `client`. */
async function shallowClone(
  client: GitClient,
  host: HttpsGitHost,
  directory: string,
): Promise<void> {
  const url = host.repositoryUrl(directory);
  await runSystemGit(client.trusted, "clone", "-q", "--depth", "1", url, directory);
}

/**
 * Fetches the commit `sha` with `--depth 1` into the clone `clone` of
 * `client`, with the git options `options` first, and returns `FETCH_HEAD`.
 */
async function fetchBySha(
  client: GitClient,
  clone: string,
  sha: string,
  options: readonly string[] = [],
): Promise<string> {
  const call = client.inClone(clone);
  await runSystemGit(call, ...options, "fetch", "-q", "--depth", "1", "origin", sha);
  return runSystemGit(call, "rev-parse", "FETCH_HEAD");
}

/**
 * Returns `requests` with each run of equal requests kept once, so a check
 * states which requests a git command sent and in what order, but not how
 * many negotiation rounds the client's git version needed.
 */
function distinctRequests(requests: readonly GitHostRequest[]): GitHostRequest[] {
  const key = (request: GitHostRequest | undefined): string =>
    request === undefined ? "" : `${request.method} ${request.path} ${String(request.status)}`;
  return requests.filter((request, index) => key(request) !== key(requests[index - 1]));
}

/** The requests of a clone or fetch of `directory` that the host served in full. */
function servedUploadPack(directory: string): GitHostRequest[] {
  return [
    {
      method: "GET",
      path: `/acme/${directory}.git/info/refs?service=git-upload-pack`,
      status: 200,
    },
    { method: "POST", path: `/acme/${directory}.git/git-upload-pack`, status: 200 },
  ];
}

interface Answer {
  readonly status: number | undefined;
  readonly body: string;
}

/**
 * Sends a GET of `requestPath` with `body` over TLS that trusts the host, and
 * returns the status and the body it answered.
 */
async function send(
  host: HttpsGitHost,
  requestPath: string,
  body = Buffer.alloc(0),
  signal?: AbortSignal,
): Promise<Answer> {
  const ca = await readFile(host.certificatePath);
  const { hostname, port } = new URL(`https://${host.address}`);
  return new Promise((resolve, reject) => {
    const outgoing = request(
      {
        host: hostname,
        port,
        path: requestPath,
        method: "GET",
        headers: { "content-length": body.length },
        ca,
        agent: false,
        signal,
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => {
          chunks.push(chunk);
        });
        response.on("end", () => {
          resolve({ status: response.statusCode, body: Buffer.concat(chunks).toString("utf8") });
        });
      },
    );
    outgoing.on("error", reject);
    outgoing.end(body);
  });
}

/** Sends a GET of `requestPath` with `body` as `send` does, and returns the status. */
async function get(
  host: HttpsGitHost,
  requestPath: string,
  body = Buffer.alloc(0),
): Promise<number | undefined> {
  return (await send(host, requestPath, body)).status;
}

describe("HttpsGitHost", () => {
  test("answers 500 to a path that does not decode and keeps serving", async (t) => {
    // arrange
    const host = await startHost(t);
    const window = host.mark();

    // act
    const statuses = [await get(host, "/acme/%E0%A4%A.git/info/refs"), await get(host, INFO_REFS)];

    // assert
    assert.deepStrictEqual(
      { statuses, traffic: host.requestsSince(window) },
      {
        statuses: [500, 200],
        traffic: {
          requests: [
            { method: "GET", path: "/acme/%E0%A4%A.git/info/refs", status: 500 },
            { method: "GET", path: INFO_REFS, status: 200 },
          ],
          connections: 2,
        },
      },
    );
  });

  test("answers a GET from the backend when the backend never reads its body", async (t) => {
    // arrange
    const host = await startHost(t);
    const window = host.mark();

    // act
    const status = await get(host, "/acme/tools.git/HEAD", Buffer.alloc(1024 * 1024));

    // assert
    assert.deepStrictEqual(
      { status, traffic: host.requestsSince(window) },
      {
        status: 200,
        traffic: {
          requests: [{ method: "GET", path: "/acme/tools.git/HEAD", status: 200 }],
          connections: 1,
        },
      },
    );
  });

  test("fails an armed repository whose name the request percent-encodes", async (t) => {
    // arrange
    const host = await startHost(t);
    await host.arm("tools", { kind: "status", status: 404 });
    const window = host.mark();

    // act
    const status = await get(host, "/acme/tool%73.git/info/refs?service=git-upload-pack");

    // assert
    assert.deepStrictEqual(
      { status, traffic: host.requestsSince(window) },
      {
        status: 404,
        traffic: {
          requests: [
            {
              method: "GET",
              path: "/acme/tool%73.git/info/refs?service=git-upload-pack",
              status: 404,
            },
          ],
          connections: 1,
        },
      },
    );
  });

  test("holds an armed repository request until its caller aborts", async (t) => {
    // arrange
    const host = await startHost(t);
    await host.arm("tools", { kind: "hold" });
    const window = host.mark();
    const abort = new AbortController();

    // act
    const answer = send(host, INFO_REFS, Buffer.alloc(0), abort.signal);
    await host.waitForRequestAfter(window);
    abort.abort();

    // assert
    await assert.rejects(answer, { name: "AbortError" });
    await host.waitForRequestsSettledAfter(window);
    assert.deepStrictEqual(host.requestsSince(window), {
      requests: [{ method: "GET", path: INFO_REFS, status: "dropped" }],
      connections: 1,
    });
  });

  test("answers a served catalog file with its bytes and keeps serving repositories", async (t) => {
    // arrange
    const host = await startHost(t);
    host.serveFile("catalog", "marketplace.json", Buffer.from('{"name":"catalog"}'));
    const window = host.mark();

    // act
    const file = await send(host, CATALOG);
    const refs = await get(host, INFO_REFS);
    const url = host.fileUrl("catalog", "marketplace.json");
    const traffic = host.requestsSince(window);

    // assert
    assert.deepStrictEqual(
      { file, refs, url, traffic },
      {
        file: { status: 200, body: '{"name":"catalog"}' },
        refs: 200,
        url: `https://${host.address}${CATALOG}`,
        traffic: {
          requests: [
            { method: "GET", path: CATALOG, status: 200 },
            { method: "GET", path: INFO_REFS, status: 200 },
          ],
          connections: 2,
        },
      },
    );
  });

  test("answers the bytes a file was served with last", async (t) => {
    // arrange
    const host = await startHost(t);
    host.serveFile("catalog", "marketplace.json", Buffer.from('{"name":"old"}'));
    host.serveFile("catalog", "marketplace.json", Buffer.from('{"name":"new"}'));

    // act
    const answer = await send(host, CATALOG);

    // assert
    assert.deepStrictEqual(answer, { status: 200, body: '{"name":"new"}' });
  });

  test("arms a directory that serves only files", async (t) => {
    // arrange
    const host = await startHost(t);
    host.serveFile("catalog", "marketplace.json", Buffer.from("{}"));
    await host.arm("catalog", { kind: "status", status: 404 });
    const window = host.mark();

    // act
    const status = await get(host, CATALOG);
    const traffic = host.requestsSince(window);
    const { arms } = await host.snapshot();

    // assert
    assert.deepStrictEqual(
      { status, traffic, arms },
      {
        status: 404,
        traffic: { requests: [{ method: "GET", path: CATALOG, status: 404 }], connections: 1 },
        arms: ["acme/catalog"],
      },
    );
  });

  test("names github.com beside 127.0.0.1 in its certificate, so a tunnel for github.com verifies it (D-SG-14)", async (t) => {
    // arrange
    const host = await startHost(t);

    // act
    const certificate = new X509Certificate(await readFile(host.certificatePath));

    // assert
    assert.deepStrictEqual(certificate.subjectAltName?.split(", ").sort(), [
      "DNS:github.com",
      "IP Address:127.0.0.1",
    ]);
  });

  test("forgets every served file on reset", async (t) => {
    // arrange
    const host = await startHost(t);
    host.serveFile("catalog", "marketplace.json", Buffer.from("{}"));

    // act
    await host.reset();
    const { files } = await host.snapshot();
    const status = await get(host, CATALOG);

    // assert
    assert.deepStrictEqual({ files, status }, { files: [], status: 404 });
  });
});

describe("HttpsGitHost with system git", () => {
  test("serves a shallow clone to a git that trusts only the host's CA file", async (t) => {
    // arrange
    const host = await startHost(t);
    const { tip } = await publish(t, host, "published");
    const client = await gitClient(t, host);
    const window = host.mark();

    // act
    await shallowClone(client, host, "published");
    const head = await runSystemGit(client.inClone("published"), "rev-parse", "HEAD");

    // assert
    assert.deepStrictEqual(
      { head, requests: distinctRequests(host.requestsSince(window).requests) },
      { head: tip, requests: servedUploadPack("published") },
    );
  });

  test("fails certificate verification for a git that names no CA file", async (t) => {
    // arrange
    const host = await startHost(t);
    await publish(t, host, "published");
    const client = await gitClient(t, host);

    // act & assert
    await assert.rejects(
      runSystemGit(client.untrusted, "clone", "-q", host.repositoryUrl("published"), "clone"),
      (error: unknown) => {
        assert.ok(error instanceof SystemGitError);
        assert.strictEqual(error.exitCode, 128);
        assert.match(error.stderr, /certificate/i);
        return true;
      },
    );
  });

  for (const { title, protocol } of [
    { title: "fetches a commit no ref names by its SHA over protocol v2", protocol: [] },
    {
      title: "fetches a commit no ref names by its SHA over protocol v0",
      protocol: ["-c", "protocol.version=0"],
    },
  ]) {
    test(title, async (t) => {
      // arrange
      const host = await startHost(t);
      const { first } = await publish(t, host, "published");
      const client = await gitClient(t, host);
      await shallowClone(client, host, "published");
      const window = host.mark();

      // act
      const fetched = await fetchBySha(client, "published", first, protocol);

      // assert
      assert.deepStrictEqual(
        { fetched, requests: distinctRequests(host.requestsSince(window).requests) },
        { fetched: first, requests: servedUploadPack("published") },
      );
    });
  }

  test("refuses a fetch by SHA from a repository armed to refuse SHA wants", async (t) => {
    // arrange
    const host = await startHost(t);
    const { first } = await publish(t, host, "published");
    const client = await gitClient(t, host);
    await shallowClone(client, host, "published");
    await host.arm("published", { kind: "refuse-sha-want" });
    const window = host.mark();

    // act & assert
    await assert.rejects(fetchBySha(client, "published", first), (error: unknown) => {
      assert.ok(error instanceof SystemGitError);
      assert.match(error.stderr, /Server does not allow request for unadvertised object/);
      return true;
    });
    assert.deepStrictEqual(
      distinctRequests(host.requestsSince(window).requests),
      servedUploadPack("published").slice(0, 1),
    );
  });

  test("serves a full clone and an unshallow fetch under the refusing arm", async (t) => {
    // arrange
    const host = await startHost(t);
    const { first, tip } = await publish(t, host, "published");
    const client = await gitClient(t, host);
    await host.arm("published", { kind: "refuse-sha-want" });

    // act
    await runSystemGit(client.trusted, "clone", "-q", host.repositoryUrl("published"), "full");
    const head = await runSystemGit(client.inClone("full"), "rev-parse", "HEAD");
    await shallowClone(client, host, "published");
    await runSystemGit(client.inClone("published"), "fetch", "-q", "--unshallow", "origin");
    const unshallowed = await runSystemGit(
      client.inClone("published"),
      "cat-file",
      "-t",
      `${first}^{commit}`,
    );

    // assert
    assert.deepStrictEqual({ head, unshallowed }, { head: tip, unshallowed: "commit" });
  });

  test("keeps serving a fetch by SHA from a repository the arm does not name", async (t) => {
    // arrange
    const host = await startHost(t);
    await publish(t, host, "published");
    const { first } = await publish(t, host, "other");
    const client = await gitClient(t, host);
    await shallowClone(client, host, "other");
    await host.arm("published", { kind: "refuse-sha-want" });

    // act
    const fetched = await fetchBySha(client, "other", first);

    // assert
    assert.strictEqual(fetched, first);
  });

  test("serves a fetch by SHA again once the refusing arm is disarmed", async (t) => {
    // arrange
    const host = await startHost(t);
    const { first } = await publish(t, host, "published");
    const client = await gitClient(t, host);
    await shallowClone(client, host, "published");
    await host.arm("published", { kind: "refuse-sha-want" });

    // act
    const disarmed = host.disarm("published");
    const fetched = await fetchBySha(client, "published", first);

    // assert
    assert.deepStrictEqual({ disarmed, fetched }, { disarmed: true, fetched: first });
  });

  test("forgets the refusing arm on reset", async (t) => {
    // arrange
    const host = await startHost(t);
    await publish(t, host, "published");
    await host.arm("published", { kind: "refuse-sha-want" });

    // act
    await host.reset();
    const { arms } = await host.snapshot();

    // assert
    assert.deepStrictEqual(arms, []);
  });

  test("names the directory that holds the repositories it serves by owner", async (t) => {
    // arrange
    const host = await startHost(t);

    // act
    const root = host.repositoriesRoot;

    // assert
    assert.strictEqual(root, path.dirname(path.dirname(host.repositoryPath("tools"))));
  });
});

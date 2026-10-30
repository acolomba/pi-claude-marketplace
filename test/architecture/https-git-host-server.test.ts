/**
 * @fileoverview Checks the https git host's own answers: a request it cannot
 * serve, a body the backend never reads, an armed repository whose name the
 * request percent-encodes, and the catalog files it serves for hosted
 * marketplaces (HOST-01, HOST-03, HOST-04, D-PL5-06).
 */

import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { request } from "node:https";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, test } from "node:test";

import { runGit } from "../../features/lib/hermetic-git.ts";
import { HttpsGitHost } from "../../features/lib/https-git-host/server.ts";

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

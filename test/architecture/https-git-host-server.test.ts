/**
 * @fileoverview Checks the https git host's own answers: a request it cannot
 * serve, a body the backend never reads, and an armed repository whose name
 * the request percent-encodes (HOST-01, HOST-03, HOST-04).
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

/** Starts a host in a fresh root that serves the empty repository `acme/tools`. */
async function startHost(t: TestContext): Promise<HttpsGitHost> {
  const root = await mkdtemp(path.join(tmpdir(), "https-git-host-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const host = await HttpsGitHost.start(root);
  t.after(() => host.close());
  await runGit(root, host.gitHome, "init", "-q", "--bare", host.repositoryPath("tools"));
  return host;
}

/** Sends a GET of `requestPath` with `body` over TLS that trusts the host, and returns the status. */
async function get(
  host: HttpsGitHost,
  requestPath: string,
  body = Buffer.alloc(0),
): Promise<number | undefined> {
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
      },
      (response) => {
        response.resume();
        response.on("end", () => {
          resolve(response.statusCode);
        });
      },
    );
    outgoing.on("error", reject);
    outgoing.end(body);
  });
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
});

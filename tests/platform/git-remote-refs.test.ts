// tests/platform/git-remote-refs.test.ts
//
// D-77-05 / PURL-09: exercise the REAL platform/git.ts `resolveRemoteRef`
// implementation (isomorphic-git `listServerRefs`, protocol v2) against a
// local loopback HTTP stub that speaks just enough of the git smart-HTTP
// protocol -- the ref advertisement (GET /info/refs) and the `ls-refs`
// command response (POST /git-upload-pack). No external network is touched:
// the server binds 127.0.0.1 on an ephemeral port and serves canned
// pkt-line payloads, so the tests stay offline while covering the real
// wrapper (ref selection, symref HEAD follow, annotated-tag peel, and both
// no-HEAD / no-ref failure throws).

import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import test from "node:test";

import { resolveRemoteRef } from "../../extensions/pi-claude-marketplace/platform/git.ts";
import { makeMockCredentialOps } from "../helpers/credential-mock.ts";

const OID_MAIN = "1111111111111111111111111111111111111111";
const OID_DEV = "2222222222222222222222222222222222222222";
const OID_TAG = "3333333333333333333333333333333333333333";
const OID_PEELED = "4444444444444444444444444444444444444444";

/** git pkt-line: 4-hex length (including the 4 length bytes) + payload. */
function pkt(payload: string): Buffer {
  const body = Buffer.from(payload, "utf8");
  const len = (body.length + 4).toString(16).padStart(4, "0");
  return Buffer.concat([Buffer.from(len, "utf8"), body]);
}

const FLUSH = Buffer.from("0000", "utf8");

/**
 * Start a loopback stub speaking git smart-HTTP protocol v2:
 *   - GET  /info/refs?service=git-upload-pack -> capability advertisement
 *     ("version 2" + ls-refs), which makes listServerRefs issue the second
 *     request;
 *   - POST /git-upload-pack -> the `ls-refs` ref listing (`<oid> <ref>`
 *     lines with optional `symref-target:` / `peeled:` attributes).
 */
async function startStubServer(
  refLines: readonly string[],
): Promise<{ url: string; close: () => Promise<void> }> {
  const server: Server = createServer((req, res) => {
    if (req.method === "GET" && (req.url ?? "").includes("/info/refs")) {
      res.writeHead(200, { "Content-Type": "application/x-git-upload-pack-advertisement" });
      res.end(
        Buffer.concat([
          pkt("# service=git-upload-pack\n"),
          FLUSH,
          pkt("version 2\n"),
          pkt("ls-refs\n"),
          pkt("fetch\n"),
          FLUSH,
        ]),
      );
      return;
    }

    if (req.method === "POST" && (req.url ?? "").endsWith("/git-upload-pack")) {
      // Drain the request body (the ls-refs command) before responding.
      req.resume();
      req.on("end", () => {
        res.writeHead(200, { "Content-Type": "application/x-git-upload-pack-result" });
        res.end(Buffer.concat([...refLines.map((line) => pkt(`${line}\n`)), FLUSH]));
      });
      return;
    }

    res.writeHead(404);
    res.end();
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert.ok(address !== null && typeof address === "object");
  return {
    url: `http://127.0.0.1:${address.port}/repo`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      }),
  };
}

const FULL_ADVERTISEMENT = [
  `${OID_MAIN} HEAD symref-target:refs/heads/main`,
  `${OID_MAIN} refs/heads/main`,
  `${OID_DEV} refs/heads/dev`,
  `${OID_TAG} refs/tags/v1.0.0 peeled:${OID_PEELED}`,
] as const;

void test("resolveRemoteRef: no ref resolves the remote HEAD (default branch) oid", async () => {
  const stub = await startStubServer(FULL_ADVERTISEMENT);
  try {
    const sha = await resolveRemoteRef({ url: stub.url });
    assert.equal(sha, OID_MAIN);
  } finally {
    await stub.close();
  }
});

void test("resolveRemoteRef: a branch ref matches refs/heads/<ref> and returns its commit oid", async () => {
  const stub = await startStubServer(FULL_ADVERTISEMENT);
  try {
    const sha = await resolveRemoteRef({ url: stub.url, ref: "dev" });
    assert.equal(sha, OID_DEV);
  } finally {
    await stub.close();
  }
});

void test("resolveRemoteRef: an annotated tag ref prefers the peeled commit oid over the tag object", async () => {
  const stub = await startStubServer(FULL_ADVERTISEMENT);
  try {
    const sha = await resolveRemoteRef({ url: stub.url, ref: "v1.0.0" });
    assert.equal(sha, OID_PEELED);
  } finally {
    await stub.close();
  }
});

void test("resolveRemoteRef: a bare ref name (exact advertised ref) matches and returns its oid", async () => {
  const stub = await startStubServer(FULL_ADVERTISEMENT);
  try {
    // "HEAD" is advertised verbatim, so the bare `r.ref === opts.ref` arm
    // matches it (no refs/heads// refs/tags/ prefix needed).
    const sha = await resolveRemoteRef({ url: stub.url, ref: "HEAD" });
    assert.equal(sha, OID_MAIN);
  } finally {
    await stub.close();
  }
});

void test("resolveRemoteRef: throws when the remote advertises no HEAD and no ref was requested", async () => {
  const stub = await startStubServer([`${OID_DEV} refs/heads/dev`]);
  try {
    await assert.rejects(() => resolveRemoteRef({ url: stub.url }), /advertised no HEAD ref/);
  } finally {
    await stub.close();
  }
});

void test("resolveRemoteRef: throws when the requested ref is not advertised", async () => {
  const stub = await startStubServer(FULL_ADVERTISEMENT);
  try {
    await assert.rejects(
      () => resolveRemoteRef({ url: stub.url, ref: "no-such-branch" }),
      /has no ref "no-such-branch"/,
    );
  } finally {
    await stub.close();
  }
});

void test("resolveRemoteRef: an auth bundle threads callbacks without altering a public 200 resolution", async () => {
  const stub = await startStubServer(FULL_ADVERTISEMENT);
  try {
    const { credOps } = makeMockCredentialOps();
    const sha = await resolveRemoteRef({
      url: stub.url,
      ref: "main",
      auth: {
        credentialOps: credOps,
        host: "127.0.0.1",
        onAuthRequired: () =>
          Promise.resolve({
            ok: false as const,
            reason: "not needed",
            authAttempted: true as const,
          }),
      },
    });
    // The server never challenges (200), so the callbacks are built but not
    // invoked; the resolution is byte-identical to the public path.
    assert.equal(sha, OID_MAIN);
  } finally {
    await stub.close();
  }
});

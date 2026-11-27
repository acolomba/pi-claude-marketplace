/**
 * @fileoverview Checks the loopback CONNECT proxy that keeps a system git's
 * request host `github.com` while its bytes reach the https git host stand-in
 * (D-BG-01): a real `git ls-remote https://github.com/acme/tools.git` through
 * it lists the stand-in's refs and verifies the stand-in with the harness CA
 * alone, a CONNECT to any other target is refused before a byte reaches it,
 * each CONNECT is one line of the GitHub redirect's log, two gits get a tunnel
 * each, and closing the proxy ends every open tunnel and frees its port.
 */

import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { connect, createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, test } from "node:test";

import { startGitHubConnectProxy } from "../../features/lib/github-redirect/connect-proxy.ts";
import {
  GITHUB_REDIRECT_LOG,
  readRedirectLog,
} from "../../features/lib/github-redirect/extension.ts";
import { HttpsGitHost } from "../../features/lib/https-git-host/server.ts";
import {
  createGitTestDirectory,
  createGitTestRepository,
  runSystemGit,
} from "../platform/git-test-repository.ts";

import type { RedirectLogLine } from "../../features/lib/github-redirect/extension.ts";
import type { Socket } from "node:net";
import type { TestContext } from "node:test";

const GITHUB_URL = "https://github.com/acme/tools.git";

type GitHubConnectProxy = Awaited<ReturnType<typeof startGitHubConnectProxy>>;

const ROUTED_TUNNEL = {
  decision: "routed",
  method: "CONNECT",
  url: "github.com:443",
  target: "git host",
} satisfies RedirectLogLine;

/** A git host that serves `acme/tools`, the proxy that tunnels to it, and its harness directory. */
interface ProxyFixture {
  readonly host: HttpsGitHost;
  readonly proxy: GitHubConnectProxy;
  readonly harness: string;
  /** The commit `HEAD` of `acme/tools` names. */
  readonly tip: string;
}

async function startFixture(t: TestContext): Promise<ProxyFixture> {
  const root = await mkdtemp(path.join(tmpdir(), "connect-proxy-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const host = await HttpsGitHost.start(path.join(root, "host"));
  t.after(() => host.close());
  const repository = await createGitTestRepository(t, { boundary: "local" });
  await repository.cloneBare(host.repositoryPath("tools"));
  const harness = path.join(root, "harness");
  const proxy = await startGitHubConnectProxy({
    gitHost: host.address,
    logPath: path.join(harness, GITHUB_REDIRECT_LOG),
  });
  t.after(() => proxy.close());
  return { host, proxy, harness, tip: repository.initialOid };
}

/**
 * Runs `git ls-remote <github.com URL> HEAD` in a scratch directory, through
 * the proxy, trusting the git host's CA file alone, and returns its output.
 */
async function lsRemoteThroughProxy(t: TestContext, fixture: ProxyFixture): Promise<string> {
  const cwd = await createGitTestDirectory(t, { boundary: "local" });
  const home = await createGitTestDirectory(t, { boundary: "local" });
  const variables = {
    GIT_SSL_CAINFO: fixture.host.certificatePath,
    https_proxy: `http://${fixture.proxy.address}`,
  };
  return runSystemGit({ cwd, home, variables }, "ls-remote", GITHUB_URL, "HEAD");
}

/** A raw CONNECT sent to the proxy: its socket and the status line the proxy answered. */
interface RawTunnel {
  readonly socket: Socket;
  readonly status: string;
  /** Resolves when the socket closes; registered before the answer arrives. */
  readonly closed: Promise<unknown>;
}

/** Resolves with the bytes `socket` receives up to its first blank line, failing when it closes first. */
function readHeaderBlock(socket: Socket): Promise<string> {
  // A promise settles once, so the close after a complete answer changes nothing.
  return new Promise((resolve, reject) => {
    let answer = "";
    socket.on("data", (chunk: Buffer) => {
      answer += chunk.toString("latin1");
      if (answer.includes("\r\n\r\n")) {
        resolve(answer);
      }
    });

    socket.once("close", () => {
      reject(new Error(`the proxy closed the connection before it answered: ${answer}`));
    });
  });
}

/** Sends `CONNECT <target>` to the proxy at `address` and waits for its answer's header block. */
async function sendConnect(address: string, target: string): Promise<RawTunnel> {
  const [hostname = "", port = ""] = address.split(":");
  const socket = connect({ host: hostname, port: Number(port) });
  // `once` would also reject on an error event, which a refused connection emits unobserved.
  const closed = new Promise((resolve) => {
    socket.once("close", resolve);
  });
  await once(socket, "connect");
  const header = readHeaderBlock(socket);
  socket.write(`CONNECT ${target} HTTP/1.1\r\nHost: ${target}\r\n\r\n`);
  const answer = await header;
  return { socket, status: answer.slice(0, answer.indexOf("\r\n")), closed };
}

describe("startGitHubConnectProxy", () => {
  test("tunnels a system git's request for github.com to the git host and logs one routed CONNECT (D-BG-01)", async (t) => {
    // arrange
    const fixture = await startFixture(t);

    // act
    const listed = await lsRemoteThroughProxy(t, fixture);

    // assert
    assert.deepStrictEqual(
      { listed, log: await readRedirectLog(fixture.harness) },
      { listed: `${fixture.tip}\tHEAD`, log: [ROUTED_TUNNEL] },
    );
  });

  test("refuses a CONNECT to any other target before a byte reaches it, and logs the refusal", async (t) => {
    // arrange
    const fixture = await startFixture(t);
    const target = createServer();
    let reached = 0;
    target.on("connection", (socket) => {
      reached += 1;
      socket.destroy();
    });
    target.listen(0, "127.0.0.1");
    await once(target, "listening");
    t.after(() => {
      target.close();
    });
    const address = target.address();
    assert.ok(address !== null && typeof address === "object");
    const refusedTarget = `127.0.0.1:${address.port}`;

    // act
    const tunnel = await sendConnect(fixture.proxy.address, refusedTarget);
    await tunnel.closed;

    // assert
    assert.deepStrictEqual(
      { status: tunnel.status, reached, log: await readRedirectLog(fixture.harness) },
      {
        status: "HTTP/1.1 403 Forbidden",
        reached: 0,
        log: [{ decision: "refused", method: "CONNECT", url: refusedTarget }],
      },
    );
  });

  test("gives two git processes started together a tunnel each", async (t) => {
    // arrange
    const fixture = await startFixture(t);

    // act
    const listed = await Promise.all([
      lsRemoteThroughProxy(t, fixture),
      lsRemoteThroughProxy(t, fixture),
    ]);

    // assert
    assert.deepStrictEqual(
      { listed, log: await readRedirectLog(fixture.harness) },
      {
        listed: [`${fixture.tip}\tHEAD`, `${fixture.tip}\tHEAD`],
        log: [ROUTED_TUNNEL, ROUTED_TUNNEL],
      },
    );
  });

  test("ends every open tunnel and frees its port when it closes", async (t) => {
    // arrange
    const fixture = await startFixture(t);
    const tunnels = await Promise.all([
      sendConnect(fixture.proxy.address, "github.com:443"),
      sendConnect(fixture.proxy.address, "github.com:443"),
    ]);

    // act
    await fixture.proxy.close();
    await Promise.all(tunnels.map((tunnel) => tunnel.closed));

    // assert
    assert.deepStrictEqual(
      tunnels.map((tunnel) => tunnel.status),
      ["HTTP/1.1 200 Connection Established", "HTTP/1.1 200 Connection Established"],
    );
    await assert.rejects(sendConnect(fixture.proxy.address, "github.com:443"), {
      code: "ECONNREFUSED",
    });
  });
});

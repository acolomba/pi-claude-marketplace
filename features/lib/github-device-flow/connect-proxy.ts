/**
 * @fileoverview The loopback HTTP `CONNECT` proxy that lets a system git ask
 * for `https://github.com/...` while its bytes reach the https git host
 * stand-in (D-SG-14).
 *
 * The GitHub redirect replaces Node's request functions in Pi's process, so a
 * git child never passes through it. git keys a credential by its request
 * host, so a Device Flow token approved for `github.com` is found only when git
 * still asks for `github.com`. Through this proxy, git sends `CONNECT
 * github.com:443` and runs TLS inside the tunnel with the host name
 * `github.com`, and the git host's certificate names `github.com`, so git
 * verifies it with the harness CA alone. The proxy tunnels `github.com:443`
 * only, and only to the git host's loopback address. It answers every other
 * CONNECT target, and every plain proxy request, with 403 before it opens any
 * connection, so no harness git reaches a real host. It appends one line per
 * CONNECT or plain request, synchronously, to the GitHub redirect's log, in the
 * redirect's own line format, so `Then pi routes these github requests:` reads
 * the tunnels beside Pi's own requests. It binds `127.0.0.1` on port 0
 * through `listenOnLoopback`, which the other loopback stand-ins of the
 * redirect use too, and `close()` ends every open tunnel before it resolves.
 */

import { once } from "node:events";
import { appendFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { createServer } from "node:http";
import { connect } from "node:net";
import path from "node:path";

import type { RedirectLogLine } from "./extension.ts";
import type { IncomingMessage, Server, ServerResponse } from "node:http";
import type { Server as NetServer, Socket } from "node:net";

/** Listens on `127.0.0.1` at a port the system picks, and returns that port. */
export async function listenOnLoopback(server: NetServer): Promise<number> {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("a loopback stand-in has no TCP address");
  }

  return address.port;
}

// The one CONNECT target the proxy tunnels: git's request host and port for an https GitHub URL.
const GITHUB_TUNNEL_TARGET = "github.com:443";

// Where the proxy tunnels to and where it logs.
interface ProxyOptions {
  readonly gitHost: string;
  readonly logPath: string;
}

function loopbackEndpoint(address: string): { readonly host: string; readonly port: number } {
  const separator = address.lastIndexOf(":");
  const host = address.slice(0, separator);
  const port = Number(address.slice(separator + 1));
  if (host !== "127.0.0.1" || !Number.isInteger(port) || port <= 0) {
    throw new Error(`the CONNECT proxy tunnels only to a 127.0.0.1 port, not to ${address}`);
  }

  return { host, port };
}

class ConnectProxy {
  private readonly server: Server;
  private readonly gitHost: { readonly host: string; readonly port: number };
  private readonly logPath: string;
  private readonly sockets = new Set<Socket>();
  private closing: Promise<void> | undefined;

  constructor(server: Server, options: ProxyOptions) {
    this.server = server;
    this.gitHost = loopbackEndpoint(options.gitHost);
    this.logPath = options.logPath;
    server.on("connect", (req: IncomingMessage, client: Socket, head: Buffer) => {
      this.tunnel(req, client, head);
    });
    server.on("request", (req: IncomingMessage, res: ServerResponse) => {
      this.append({ decision: "refused", method: req.method ?? "", url: req.url ?? "" });
      res.writeHead(403, { connection: "close" });
      res.end();
    });
  }

  close(): Promise<void> {
    this.closing ??= this.closeOnce();
    return this.closing;
  }

  private async closeOnce(): Promise<void> {
    const closed = once(this.server, "close");
    this.server.close();
    this.server.closeAllConnections();
    for (const socket of this.sockets) {
      socket.destroy();
    }

    await closed;
  }

  private append(line: RedirectLogLine): void {
    appendFileSync(this.logPath, `${JSON.stringify(line)}\n`);
  }

  // Keeps `socket` until it closes, so `close()` can end it; an error only closes it.
  private track(socket: Socket): void {
    this.sockets.add(socket);
    socket.on("error", () => {
      socket.destroy();
    });
    socket.on("close", () => {
      this.sockets.delete(socket);
    });
  }

  private tunnel(req: IncomingMessage, client: Socket, head: Buffer): void {
    this.track(client);
    const target = req.url ?? "";
    if (target !== GITHUB_TUNNEL_TARGET) {
      this.append({ decision: "refused", method: "CONNECT", url: target });
      client.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
      return;
    }

    this.append({ decision: "routed", method: "CONNECT", url: target, target: "git host" });
    const upstream = connect(this.gitHost);
    this.track(upstream);
    // Either side's end or failure ends the other, so no half-open tunnel outlives its git.
    upstream.on("close", () => {
      client.destroy();
    });
    client.on("close", () => {
      upstream.destroy();
    });
    upstream.once("connect", () => {
      client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
      upstream.write(head);
      upstream.pipe(client);
      client.pipe(upstream);
    });
  }
}

/**
 * Starts a proxy that tunnels `CONNECT github.com:443` to `gitHost`, the
 * `127.0.0.1:<port>` of the git host stand-in, refuses everything else, and
 * appends each decision to `logPath`, the GitHub redirect's log
 * `<harness dir>/github-redirect.jsonl`, making its directory first. It
 * returns the `127.0.0.1:<port>` it listens on, for `https_proxy` as
 * `http://<address>`, and `close()`, which ends every open tunnel and
 * connection and stops listening; a second call waits for the first.
 */
export async function startGitHubConnectProxy(options: {
  readonly gitHost: string;
  readonly logPath: string;
}): Promise<{ readonly address: string; close(): Promise<void> }> {
  await mkdir(path.dirname(options.logPath), { recursive: true });
  const server = createServer();
  const proxy = new ConnectProxy(server, options);
  const port = await listenOnLoopback(server);
  return {
    address: `127.0.0.1:${port}`,
    close: () => proxy.close(),
  };
}

/**
 * @fileoverview The loopback HTTPS git host that git marketplace sources clone from.
 *
 * Pi reads its CA file and the git host's port once, when it starts, so each
 * worker starts one host before its Pi and keeps it for the run (HOST-01,
 * HOST-02). The host makes its own certificate at start, binds `127.0.0.1`
 * only, and serves the bare repositories under `repositories/acme/` through
 * `git http-backend`. It records every request in arrival order with the
 * status it answered, and counts connections, so a scenario can state the
 * exact traffic of a command (HOST-04). Before each scenario the run resets
 * it to an empty host.
 */

import { execFile } from "node:child_process";
import { once } from "node:events";
import { mkdir, readdir, readFile, rm } from "node:fs/promises";
import { createServer } from "node:https";
import path from "node:path";
import { promisify } from "node:util";

import { cgiEnvironment, parseCgiResponse, runHttpBackend } from "./cgi.ts";

import type { CgiResponse } from "./cgi.ts";
import type { ChildProcess } from "node:child_process";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Server } from "node:https";

const execFileAsync = promisify(execFile);

const OWNER = "acme";

// A one-day P-256 certificate for the loopback address the host binds.
const CERTIFICATE_ARGUMENTS = [
  "req",
  "-x509",
  "-newkey",
  "ec",
  "-pkeyopt",
  "ec_paramgen_curve:prime256v1",
  "-nodes",
  "-keyout",
  "key.pem",
  "-out",
  "cert.pem",
  "-days",
  "1",
  "-subj",
  "/CN=127.0.0.1",
  "-addext",
  "subjectAltName=IP:127.0.0.1",
];

/** One request the host received: its path with the query, as sent. */
export interface GitHostRequest {
  readonly method: string;
  readonly path: string;
  /** The status the host answered, or `pending` while the answer is open. */
  readonly status: number | "pending";
}

/** The host's request and connection counts at one moment. */
export interface RequestWindow {
  readonly requests: number;
  readonly connections: number;
}

/** The requests and the connection count since a window opened. */
export interface GitHostTraffic {
  readonly requests: readonly GitHostRequest[];
  readonly connections: number;
}

/** Everything the host holds, which the run checks is empty before each scenario. */
export interface GitHostSnapshot {
  readonly repositories: readonly string[];
  readonly requests: readonly GitHostRequest[];
  readonly connections: number;
  readonly children: number;
}

interface LoggedRequest {
  readonly method: string;
  readonly path: string;
  status: number | "pending";
}

function copyRequest(request: LoggedRequest): GitHostRequest {
  return { method: request.method, path: request.path, status: request.status };
}

function listen(server: Server): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      const address = server.address();
      if (address === null || typeof address === "string") {
        reject(new Error("the git host has no TCP address"));
        return;
      }

      resolve(address.port);
    });
  });
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error === undefined) {
        resolve();
      } else {
        reject(error);
      }
    });
  });
}

async function listRepositories(root: string): Promise<string[]> {
  const owners = await readdir(root);
  const repositories = await Promise.all(
    owners.map(async (owner) =>
      (await readdir(path.join(root, owner))).map((name) => `${owner}/${name}`),
    ),
  );
  return repositories.flat().sort();
}

function writeResponse(res: ServerResponse, response: CgiResponse): void {
  res.statusCode = response.status;
  for (const [name, value] of response.headers) {
    res.appendHeader(name, value);
  }

  res.end(response.body);
}

export class HttpsGitHost {
  /** The `127.0.0.1:<port>` the host listens on. */
  readonly address: string;
  /** The certificate Pi trusts the host through. */
  readonly certificatePath: string;
  /** The scratch HOME of every git that writes the repositories the host serves. */
  readonly gitHome: string;
  private readonly repositories: string;
  private readonly server: Server;
  private readonly log: LoggedRequest[] = [];
  private readonly children = new Set<ChildProcess>();
  private connections = 0;

  private constructor(root: string, server: Server, port: number) {
    this.address = `127.0.0.1:${port}`;
    this.certificatePath = path.join(root, "cert.pem");
    this.gitHome = path.join(root, "home");
    this.repositories = path.join(root, "repositories");
    this.server = server;
    server.on("connection", () => {
      this.connections += 1;
    });
    server.on("request", (req: IncomingMessage, res: ServerResponse) => {
      this.receive(req, res);
    });
  }

  /** Makes a certificate under `root`, then starts a host that serves from there. */
  static async start(root: string): Promise<HttpsGitHost> {
    await mkdir(path.join(root, "repositories"), { recursive: true });
    await mkdir(path.join(root, "home"), { recursive: true });
    await execFileAsync("openssl", CERTIFICATE_ARGUMENTS, {
      cwd: root,
      env: { PATH: process.env.PATH ?? "" },
    });
    const [key, cert] = await Promise.all([
      readFile(path.join(root, "key.pem")),
      readFile(path.join(root, "cert.pem")),
    ]);
    const server = createServer({ key, cert });
    const port = await listen(server);
    return new HttpsGitHost(root, server, port);
  }

  /** Returns the bare repository the host serves as `acme/<directory>.git`. */
  repositoryPath(directory: string): string {
    return path.join(this.repositories, OWNER, `${directory}.git`);
  }

  /** Returns the URL a user types to clone the repository `directory`. */
  repositoryUrl(directory: string): string {
    return `https://${this.address}/${OWNER}/${directory}.git`;
  }

  /** Returns the current counts, which open a window for `requestsSince()`. */
  mark(): RequestWindow {
    return { requests: this.log.length, connections: this.connections };
  }

  /** Returns every request and the connection count since `window` opened. */
  requestsSince(window: RequestWindow): GitHostTraffic {
    return {
      requests: this.log.slice(window.requests).map((request) => copyRequest(request)),
      connections: this.connections - window.connections,
    };
  }

  /** Returns the repositories, requests, connections, and CGI children the host holds. */
  async snapshot(): Promise<GitHostSnapshot> {
    return {
      repositories: await listRepositories(this.repositories),
      requests: this.log.map((request) => copyRequest(request)),
      connections: this.connections,
      children: this.children.size,
    };
  }

  /**
   * Empties the host: kills every CGI child and waits for it to close, then
   * clears the log, removes every repository, and closes idle connections, so
   * no keep-alive socket reaches the next scenario.
   */
  async reset(): Promise<void> {
    await this.killChildren();
    this.log.splice(0);
    this.connections = 0;
    const entries = await readdir(this.repositories);
    await Promise.all(
      entries.map((entry) =>
        rm(path.join(this.repositories, entry), { recursive: true, force: true }),
      ),
    );
    this.server.closeIdleConnections();
  }

  /** Closes every connection, kills every CGI child, and stops listening. */
  async close(): Promise<void> {
    this.server.closeAllConnections();
    await this.killChildren();
    await closeServer(this.server);
  }

  private async killChildren(): Promise<void> {
    await Promise.all(
      [...this.children].map(async (child) => {
        const closed = once(child, "close");
        child.kill("SIGKILL");
        await closed;
      }),
    );
  }

  private track(child: ChildProcess): void {
    this.children.add(child);
    child.on("close", () => {
      this.children.delete(child);
    });
  }

  private receive(req: IncomingMessage, res: ServerResponse): void {
    const logged: LoggedRequest = {
      method: req.method ?? "",
      path: req.url ?? "",
      status: "pending",
    };
    this.log.push(logged);
    // A client that drops the socket must not crash the worker that hosts the server.
    req.on("error", () => {
      res.destroy();
    });
    res.on("error", () => {
      res.destroy();
    });
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });
    req.on("end", () => {
      void this.answer(logged, req.headers, Buffer.concat(chunks), res);
    });
  }

  private async answer(
    logged: LoggedRequest,
    headers: IncomingMessage["headers"],
    body: Buffer,
    res: ServerResponse,
  ): Promise<void> {
    const request = {
      method: logged.method,
      url: new URL(logged.path, `https://${this.address}`),
      headers,
      body,
    };
    const env = cgiEnvironment(request, this.repositories, this.gitHome);
    let response: CgiResponse;
    try {
      response = parseCgiResponse(
        await runHttpBackend(env, body, (child) => {
          this.track(child);
        }),
      );
    } catch (_error: unknown) {
      // A CGI that fails or is killed answers 500, and the log says so.
      logged.status = 500;
      res.statusCode = 500;
      res.end();
      return;
    }

    logged.status = response.status;
    writeResponse(res, response);
  }
}

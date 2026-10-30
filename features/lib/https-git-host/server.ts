/**
 * @fileoverview The loopback HTTPS git host that git marketplace sources clone from.
 *
 * Pi reads its CA file and the git host's port once, when it starts, so each
 * worker starts one host before its Pi and keeps it for the run (HOST-01,
 * HOST-02). The host makes its own certificate at start, binds `127.0.0.1`
 * only, and serves the bare repositories under `repositories/<owner>/`
 * through `git http-backend`. The owner is `acme` unless a caller names
 * another, such as `anthropics` for the official marketplace. It records
 * every request in arrival order with the status it answered, and counts
 * connections, so a scenario can state the exact traffic of a command
 * (HOST-04). A scenario can arm one repository to answer an error status, to
 * drop the connection, or to require one credential, and the other
 * repositories keep serving (HOST-03). An arm lasts until it is disarmed or
 * the host is reset. The host also serves the catalog files of hosted
 * marketplaces, such as `/acme/tools/marketplace.json`, from memory, and an arm
 * of `owner/directory` applies to the files under `/owner/directory/` too.
 * Before each scenario the run resets it to an empty host with no arm and no
 * file.
 */

import { execFile } from "node:child_process";
import { once } from "node:events";
import { mkdir, readdir, readFile, rm, stat } from "node:fs/promises";
import { createServer } from "node:https";
import path from "node:path";
import { promisify } from "node:util";

import { cgiEnvironment, parseCgiResponse, runHttpBackend } from "./cgi.ts";

import type { CgiResponse } from "./cgi.ts";
import type { ChildProcess } from "node:child_process";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Server } from "node:https";

const execFileAsync = promisify(execFile);

const DEFAULT_OWNER = "acme";

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

const ARMED_STATUSES = [404, 500, 502, 503] as const;

/** An error status an armed repository answers. */
export type ArmedStatus = (typeof ARMED_STATUSES)[number];

/**
 * How an armed repository fails until it is disarmed or the host is reset
 * (HOST-03): it answers an error status, drops the connection on every
 * request, answers 401 to every request that does not carry one user and
 * password, answers 302 to a location, or holds the response open.
 */
export type GitHostArm =
  | { readonly kind: "status"; readonly status: ArmedStatus }
  | { readonly kind: "drop" }
  | { readonly kind: "hold" }
  | { readonly kind: "hold-git-body" }
  | { readonly kind: "credential"; readonly user: string; readonly password: string }
  | { readonly kind: "invalid-response" }
  | { readonly kind: "redirect"; readonly location: string };

/** Returns `status` as an armed status, throwing on a status the host cannot be armed with. */
export function armedStatus(status: number): ArmedStatus {
  const armed = ARMED_STATUSES.find((candidate) => candidate === status);
  if (armed === undefined) {
    throw new Error(
      `the git host cannot be armed to answer ${status}; expected one of ${ARMED_STATUSES.join(", ")}`,
    );
  }

  return armed;
}

/** One request the host received: its path with the query, as sent. */
export interface GitHostRequest {
  readonly method: string;
  readonly path: string;
  /**
   * The status the host answered, `dropped` when the host destroyed the
   * connection, by an arm or after a failure, or `pending` while the answer
   * is open.
   */
  readonly status: number | "pending" | "dropped";
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
  /** The served catalog files as decoded paths, such as `/acme/tools/marketplace.json`, sorted. */
  readonly files: readonly string[];
  /** The armed repositories as `owner/directory`, in arming order. */
  readonly arms: readonly string[];
  readonly requests: readonly GitHostRequest[];
  readonly connections: number;
  readonly children: number;
}

interface LoggedRequest {
  readonly method: string;
  readonly path: string;
  status: number | "pending" | "dropped";
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

/**
 * Returns the path the CGI serves for the request path `requestPath`: its
 * pathname, URL-resolved against `origin` and decoded, or undefined when it
 * does not decode.
 */
function servedPath(requestPath: string, origin: string): string | undefined {
  try {
    return decodeURIComponent(new URL(requestPath, origin).pathname);
  } catch {
    return undefined;
  }
}

/** Returns the key the arms use for the repository `directory` of `owner`. */
function repositoryKey(directory: string, owner: string): string {
  return `${owner}/${directory}`;
}

/** Returns the decoded path the host serves the file `file` of `directory` of `owner` at. */
function filePath(directory: string, file: string, owner: string): string {
  return `/${repositoryKey(directory, owner)}/${file}`;
}

/**
 * Returns the arm of the repository that `served` belongs to: a decoded path
 * the CGI serves, under `/<owner>/<directory>/` or `/<owner>/<directory>.git/`.
 */
function armFor(arms: ReadonlyMap<string, GitHostArm>, served: string): GitHostArm | undefined {
  for (const [key, arm] of arms) {
    const prefix = `/${key}`;
    if (served.startsWith(`${prefix}/`) || served.startsWith(`${prefix}.git/`)) {
      return arm;
    }
  }

  return undefined;
}

/** Returns the `Authorization` header value that carries `user` and `password`. */
function basicAuthorization(user: string, password: string): string {
  const token = Buffer.from(`${user}:${password}`).toString("base64");
  return `Basic ${token}`;
}

/**
 * Answers a request of an armed repository the way the arm fails, and returns
 * whether it did. A `drop` arm destroys the socket before any answer. A
 * `credential` arm lets a request with its credential through to the CGI;
 * it compares the header in memory, and the log keeps only the status
 * (HOST-04). A `redirect` arm answers 302 to its location, and lets the
 * request for the location's own path through, so a redirect inside the arm's
 * directory ends.
 */
function failArmed(
  arm: GitHostArm,
  logged: LoggedRequest,
  req: IncomingMessage,
  res: ServerResponse,
  served: string,
): boolean {
  switch (arm.kind) {
    case "drop":
      logged.status = "dropped";
      req.socket.destroy();
      return true;
    case "hold":
      return true;
    case "hold-git-body": {
      res.writeHead(200, { "Content-Type": "application/x-git-upload-pack-advertisement" });
      // An unfinished packet keeps git waiting; bytes prevent the HTTP idle timeout.
      res.write("ffff");
      const heartbeat = setInterval(() => {
        res.write("0");
      }, 1_000);
      heartbeat.unref();
      res.once("close", () => {
        clearInterval(heartbeat);
      });
      return true;
    }

    case "status":
      logged.status = arm.status;
      res.statusCode = arm.status;
      res.end();
      return true;
    case "credential":
      if (req.headers.authorization === basicAuthorization(arm.user, arm.password)) {
        return false;
      }

      logged.status = 401;
      res.writeHead(401, { "WWW-Authenticate": 'Basic realm="git host"' });
      res.end();
      return true;
    case "invalid-response":
      logged.status = 200;
      res.writeHead(200, { "Content-Type": "application/x-git-upload-pack-advertisement" });
      res.end("this is not a git smart-http response\n");
      return true;
    case "redirect":
      if (servedPath(arm.location, `https://${req.headers.host ?? ""}`) === served) {
        return false;
      }

      logged.status = 302;
      res.writeHead(302, { location: arm.location });
      res.end();
      return true;
  }
}

function writeResponse(res: ServerResponse, response: CgiResponse): void {
  res.statusCode = response.status;
  for (const [name, value] of response.headers) {
    res.appendHeader(name, value);
  }

  res.end(response.body);
}

/** Answers a served catalog file with 200 and its bytes, and logs it. */
function answerFile(logged: LoggedRequest, bytes: Buffer, res: ServerResponse): void {
  logged.status = 200;
  res.writeHead(200, {
    "content-type": "application/json",
    "content-length": bytes.length,
  });
  res.end(bytes);
}

/**
 * Answers 500 with no header the CGI set, and logs it. A response whose
 * headers went out already can only be cut off, and logs as dropped.
 */
function answerServerError(logged: LoggedRequest, res: ServerResponse): void {
  if (res.headersSent) {
    logged.status = "dropped";
    res.destroy();
    return;
  }

  logged.status = 500;
  for (const name of res.getHeaderNames()) {
    res.removeHeader(name);
  }

  res.statusCode = 500;
  res.end();
}

/**
 * The loopback HTTPS git host. Start one with `HttpsGitHost.start()`, publish
 * bare repositories at `repositoryPath()`, and call `reset()` between
 * scenarios and `close()` at the end of the run.
 */
export class HttpsGitHost {
  /** The `127.0.0.1:<port>` the host listens on. */
  readonly address: string;
  /** The certificate Pi trusts the host through. */
  readonly certificatePath: string;
  /** The scratch HOME of every git that writes the repositories the host serves. */
  readonly gitHome: string;
  /** The owner a repository is served under when a caller names none. */
  readonly defaultOwner = DEFAULT_OWNER;
  private readonly repositories: string;
  private readonly server: Server;
  private readonly log: LoggedRequest[] = [];
  private readonly children = new Set<ChildProcess>();
  private readonly arms = new Map<string, GitHostArm>();
  private readonly files = new Map<string, Buffer>();
  private readonly requestWaiters = new Set<() => void>();
  private readonly requestStatusWaiters = new Set<() => void>();
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

  /** Returns the bare repository the host serves as `<owner>/<directory>.git`. */
  repositoryPath(directory: string, owner = DEFAULT_OWNER): string {
    return path.join(this.repositories, owner, `${directory}.git`);
  }

  /** Returns the URL a user types to clone the repository `directory` of `owner`. */
  repositoryUrl(directory: string, owner = DEFAULT_OWNER): string {
    return `https://${this.address}/${owner}/${directory}.git`;
  }

  /**
   * Returns the `owner/repo` shorthand a user types for the repository
   * `directory` of `owner`. The GitHub base override sends it to this host as
   * the path that `repositoryUrl` names.
   */
  repositoryShorthand(directory: string, owner = DEFAULT_OWNER): string {
    return `${owner}/${directory}`;
  }

  /** Serves `bytes` as the file `file` of `directory` of `owner`, replacing any bytes served there. */
  serveFile(directory: string, file: string, bytes: Buffer, owner = DEFAULT_OWNER): void {
    this.files.set(filePath(directory, file, owner), bytes);
  }

  /** Returns the URL a user types to read the file `file` of `directory` of `owner`. */
  fileUrl(directory: string, file: string, owner = DEFAULT_OWNER): string {
    return `https://${this.address}${filePath(directory, file, owner)}`;
  }

  /**
   * Arms the published repository, or the directory of served files,
   * `directory` of `owner` to fail as `arm` until it is disarmed or the host
   * is reset, failing when nothing is published there or when it is armed
   * already.
   */
  async arm(directory: string, arm: GitHostArm, owner = DEFAULT_OWNER): Promise<void> {
    const key = repositoryKey(directory, owner);
    const published =
      this.servesFileUnder(key) ||
      (await stat(this.repositoryPath(directory, owner)).then(
        () => true,
        () => false,
      ));
    if (!published) {
      throw new Error(`the git host serves no repository ${key}.git to arm`);
    }

    if (this.arms.has(key)) {
      throw new Error(`the git host has armed the repository ${key}.git already`);
    }

    this.arms.set(key, arm);
  }

  /**
   * Disarms the repository `directory` of `owner`, so it serves again, and
   * returns whether it was armed.
   */
  disarm(directory: string, owner = DEFAULT_OWNER): boolean {
    return this.arms.delete(repositoryKey(directory, owner));
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

  /** Resolves when a request arrives after `window`, without polling the host log. */
  waitForRequestAfter(window: RequestWindow, timeoutMs = 5_000): Promise<void> {
    if (this.log.length > window.requests) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const waiter: { timer?: NodeJS.Timeout; finish: () => void } = {
        finish: () => undefined,
      };
      waiter.finish = (): void => {
        clearTimeout(waiter.timer);
        this.requestWaiters.delete(waiter.finish);
        resolve();
      };

      waiter.timer = setTimeout(() => {
        this.requestWaiters.delete(waiter.finish);
        reject(new Error(`the git host received no request after ${timeoutMs} ms`));
      }, timeoutMs);
      this.requestWaiters.add(waiter.finish);
    });
  }

  /** Resolves when every request after `window` has left its pending state. */
  waitForRequestsSettledAfter(window: RequestWindow, timeoutMs = 5_000): Promise<void> {
    const settled = (): boolean =>
      this.log.slice(window.requests).every((request) => request.status !== "pending");
    if (settled()) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const waiter: { timer?: NodeJS.Timeout; finish: () => void } = {
        finish: () => undefined,
      };
      waiter.finish = (): void => {
        if (!settled()) {
          return;
        }

        clearTimeout(waiter.timer);
        this.requestStatusWaiters.delete(waiter.finish);
        resolve();
      };

      waiter.timer = setTimeout(() => {
        this.requestStatusWaiters.delete(waiter.finish);
        reject(new Error(`the git host kept a request pending after ${timeoutMs} ms`));
      }, timeoutMs);
      this.requestStatusWaiters.add(waiter.finish);
    });
  }

  /** Returns the repositories, files, arms, requests, connections, and CGI children the host holds. */
  async snapshot(): Promise<GitHostSnapshot> {
    return {
      repositories: await listRepositories(this.repositories),
      files: [...this.files.keys()].sort(),
      arms: [...this.arms.keys()],
      requests: this.log.map((request) => copyRequest(request)),
      connections: this.connections,
      children: this.children.size,
    };
  }

  /**
   * Empties the host: kills every CGI child and waits for it to close, then
   * clears the arms, the served files, and the log, removes every repository,
   * and closes idle connections, so no keep-alive socket reaches the next
   * scenario.
   */
  async reset(): Promise<void> {
    await this.killChildren();
    this.arms.clear();
    this.files.clear();
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

  private servesFileUnder(key: string): boolean {
    const prefix = `/${key}/`;
    return [...this.files.keys()].some((served) => served.startsWith(prefix));
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
    for (const waiter of [...this.requestWaiters]) {
      waiter();
    }

    // A client that drops the socket must not crash the worker that hosts the server.
    req.on("error", () => {
      res.destroy();
    });
    res.on("error", () => {
      res.destroy();
    });
    res.on("close", () => {
      if (logged.status === "pending") {
        logged.status = "dropped";
      }

      for (const waiter of [...this.requestStatusWaiters]) {
        waiter();
      }
    });

    const served = servedPath(logged.path, `https://${this.address}`);
    if (served === undefined) {
      answerServerError(logged, res);
      return;
    }

    const arm = armFor(this.arms, served);
    if (arm !== undefined && failArmed(arm, logged, req, res, served)) {
      return;
    }

    const file = logged.method === "GET" ? this.files.get(served) : undefined;
    if (file !== undefined) {
      answerFile(logged, file, res);
      return;
    }

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
    // The request answers 500, and the log says so, when the CGI fails or is
    // killed, or when the CGI prints a status or a header Node cannot send.
    // Nothing escapes, so no request can crash the worker that hosts the server.
    try {
      const request = {
        method: logged.method,
        url: new URL(logged.path, `https://${this.address}`),
        headers,
        body,
      };
      const env = cgiEnvironment(request, this.repositories, this.gitHome);
      const response = parseCgiResponse(
        await runHttpBackend(env, body, (child) => {
          this.track(child);
        }),
      );
      logged.status = response.status;
      writeResponse(res, response);
    } catch {
      answerServerError(logged, res);
    }
  }
}

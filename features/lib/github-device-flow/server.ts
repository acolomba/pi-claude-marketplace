/**
 * @fileoverview The loopback HTTPS stand-in for GitHub's Device Flow
 * endpoints, `POST /login/device/code` and `POST /login/oauth/access_token`
 * (D-BG-03).
 *
 * Pi trusts one extra CA file, the git host's certificate, so the stand-in
 * serves with the git host's key and certificate and binds `127.0.0.1` only.
 * It issues a fixed device code, user code, and access token. It answers each
 * poll with the next outcome of the scenario's script, as GitHub does: an
 * error outcome is the JSON `error` field with HTTP 200. Its interval is 0,
 * because the product waits the interval between polls and has no floor, and
 * it never answers `slow_down`, which adds five seconds a poll. A poll past the
 * end of the script answers 500, which fails the sign-in. Every request is
 * appended, in one write, as one JSON line to
 * `<harness dir>/github-device-flow.jsonl`, with its form body. The redirect
 * extension sends Pi's requests for `https://github.com/login/...` here.
 */

import { once } from "node:events";
import { appendFileSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { createServer } from "node:https";
import path from "node:path";

import type { DataTable } from "@cucumber/cucumber";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Server } from "node:https";

// The access token the stand-in issues; the run's git host accepts it through a credential arm.
const ACCESS_TOKEN = "stand-in-access-token";
const USER_CODE = "WDJB-MJHT";
const DEVICE_CODE = "stand-in-device-code";
const VERIFICATION_URI = "https://github.com/login/device";
const EXPIRES_IN_SECONDS = 900;
const LOG_FILE = "github-device-flow.jsonl";

const POLL_OUTCOMES = [
  "authorization_pending",
  "authorized",
  "access_denied",
  "expired_token",
] as const;

/** How the stand-in answers one poll of the token endpoint. */
export type PollOutcome = (typeof POLL_OUTCOMES)[number];

/** One request the stand-in received: its method, path, and form body in the order sent. */
export interface DeviceFlowRequest {
  readonly method: string;
  readonly path: string;
  readonly form: Readonly<Record<string, string>>;
}

/** Where the git host keeps the key and certificate that the stand-in serves with. */
export interface ServingCertificate {
  readonly keyPath: string;
  readonly certificatePath: string;
}

function pollOutcome(text: string, row: number): PollOutcome {
  const outcome = POLL_OUTCOMES.find((candidate) => candidate === text);
  if (outcome === undefined) {
    throw new Error(`poll script row ${row}: ${text} is not one of ${POLL_OUTCOMES.join(", ")}`);
  }

  return outcome;
}

/** Reads a poll script table, whose one column is `outcome`, as the outcomes in order. */
export function readPollScript(table: DataTable): PollOutcome[] {
  const [header = [], ...rows] = table.raw();
  if (header.length !== 1 || header[0] !== "outcome") {
    throw new Error(`the poll script needs the one column outcome, got ${header.join(", ")}`);
  }

  return rows.map(([cell = ""], index) => pollOutcome(cell, index + 1));
}

/** Returns the requests the stand-in logged in the harness directory `harness`, in arrival order. */
export async function readDeviceFlowRequests(harness: string): Promise<DeviceFlowRequest[]> {
  let text: string;
  try {
    text = await readFile(path.join(harness, LOG_FILE), "utf8");
  } catch (error: unknown) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [];
    }

    throw error;
  }

  return text.split("\n").flatMap((line): DeviceFlowRequest[] => {
    if (line === "") {
      return [];
    }

    const { method, path: requestPath, form } = JSON.parse(line) as DeviceFlowRequest;
    return [{ method, path: requestPath, form }];
  });
}

async function listenOnLoopback(server: Server): Promise<number> {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("the Device Flow stand-in has no TCP address");
  }

  return address.port;
}

function answerJson(res: ServerResponse, status: number, body: object): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

/**
 * The loopback Device Flow stand-in. Start one with `GitHubDeviceFlow.start()`
 * and `close()` it when its scenario ends.
 */
export class GitHubDeviceFlow {
  /** The `127.0.0.1:<port>` the stand-in listens on. */
  readonly address: string;
  private readonly server: Server;
  private readonly script: readonly PollOutcome[];
  private readonly log: string;
  private polls = 0;

  private constructor(server: Server, port: number, script: readonly PollOutcome[], log: string) {
    this.address = `127.0.0.1:${port}`;
    this.server = server;
    this.script = script;
    this.log = log;
    server.on("request", (req: IncomingMessage, res: ServerResponse) => {
      this.receive(req, res);
    });
  }

  /**
   * Starts a stand-in that serves with `certificate`, answers its polls with
   * `script`, and logs to the harness directory `harness`. Fails on an empty
   * script, which no sign-in could finish.
   */
  static async start(
    certificate: ServingCertificate,
    script: readonly PollOutcome[],
    harness: string,
  ): Promise<GitHubDeviceFlow> {
    if (script.length === 0) {
      throw new Error("the Device Flow stand-in needs at least one poll outcome");
    }

    await mkdir(harness, { recursive: true });
    const [key, cert] = await Promise.all([
      readFile(certificate.keyPath),
      readFile(certificate.certificatePath),
    ]);
    const server = createServer({ key, cert });
    const port = await listenOnLoopback(server);
    return new GitHubDeviceFlow(server, port, script, path.join(harness, LOG_FILE));
  }

  /** Closes every connection and stops listening. */
  async close(): Promise<void> {
    const closed = once(this.server, "close");
    this.server.close();
    this.server.closeAllConnections();
    await closed;
  }

  private receive(req: IncomingMessage, res: ServerResponse): void {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });
    req.on("end", () => {
      const request: DeviceFlowRequest = {
        method: req.method ?? "",
        path: req.url ?? "",
        form: Object.fromEntries(new URLSearchParams(Buffer.concat(chunks).toString("utf8"))),
      };
      appendFileSync(this.log, `${JSON.stringify(request)}\n`);
      this.answer(request, res);
    });
  }

  private answer(request: DeviceFlowRequest, res: ServerResponse): void {
    if (request.method !== "POST") {
      answerJson(res, 404, { error: "not_found" });
      return;
    }

    if (request.path === "/login/device/code") {
      answerJson(res, 200, {
        device_code: DEVICE_CODE,
        user_code: USER_CODE,
        verification_uri: VERIFICATION_URI,
        expires_in: EXPIRES_IN_SECONDS,
        interval: 0,
      });
      return;
    }

    if (request.path === "/login/oauth/access_token") {
      this.answerPoll(res);
      return;
    }

    answerJson(res, 404, { error: "not_found" });
  }

  private answerPoll(res: ServerResponse): void {
    const outcome = this.script[this.polls];
    this.polls += 1;
    if (outcome === undefined) {
      answerJson(res, 500, { error: "the poll script has no outcome left" });
      return;
    }

    if (outcome === "authorized") {
      answerJson(res, 200, {
        access_token: ACCESS_TOKEN,
        token_type: "bearer",
        scope: "repo",
      });
      return;
    }

    answerJson(res, 200, { error: outcome });
  }
}

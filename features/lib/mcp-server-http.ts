/**
 * @fileoverview The loopback Streamable HTTP MCP server that stands in for a
 * plugin's remote one (D-CF6-06).
 *
 * A step starts it on `127.0.0.1` before the plugin's `.mcp.json` names its
 * URL, and the scenario's release closes it. It answers the JSON-RPC requests
 * pi-mcp-adapter's MCP client sends in plain JSON, a notification with `202`,
 * and any other HTTP method with `405`, which the client accepts for its
 * optional event stream. It lists one `echo` tool and answers a `tools/call`
 * with `echo:<text>`. It appends every request it receives, with its HTTP
 * method, its JSON-RPC method and params, and its headers, to
 * `<harness dir>/mcp-server-http-requests.jsonl`, so a scenario sees the
 * headers the server received. The profile Pi creates the harness directory
 * before it starts, and every request comes from that Pi, so the server never
 * creates it. This module registers nothing.
 */

import { appendFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";

import { harnessDirectory, readLogLinesSince } from "./turn-records.ts";

import type { IncomingMessage, Server, ServerResponse } from "node:http";

const LOOPBACK = "127.0.0.1";

const REQUESTS_FILE = "mcp-server-http-requests.jsonl";

/**
 * One request an HTTP MCP server received, as it logged it: the server's
 * name, the HTTP method, the JSON-RPC method and params of a POST body, and
 * every header, by its lower-case name.
 */
export interface McpHttpRequest {
  readonly server: string;
  readonly httpMethod: string;
  readonly rpcMethod?: string;
  readonly params?: unknown;
  readonly headers: Readonly<Record<string, string>>;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function textArgument(params: unknown): string {
  const args = isRecord(params) && isRecord(params.arguments) ? params.arguments : {};
  return typeof args.text === "string" ? args.text : "";
}

// The result of each JSON-RPC request the server knows, by method. Any other
// request gets an empty result.
const RESULTS: Readonly<Record<string, (params: unknown) => unknown>> = {
  initialize: (params) => ({
    protocolVersion: isRecord(params) ? params.protocolVersion : undefined,
    capabilities: { tools: {} },
    serverInfo: { name: "http", version: "1.0.0" },
  }),
  "tools/list": () => ({
    tools: [
      {
        name: "echo",
        description: "Echoes the text it is given.",
        inputSchema: { type: "object", properties: { text: { type: "string" } } },
      },
    ],
  }),
  "tools/call": (params) => ({ content: [{ type: "text", text: `echo:${textArgument(params)}` }] }),
};

function resultOf(method: unknown, params: unknown): unknown {
  const answer =
    typeof method === "string" && Object.hasOwn(RESULTS, method) ? RESULTS[method] : undefined;
  return answer === undefined ? {} : answer(params);
}

function headersOf(request: IncomingMessage): Readonly<Record<string, string>> {
  return Object.fromEntries(
    Object.entries(request.headers).map(([name, value]) => [
      name,
      Array.isArray(value) ? value.join(", ") : (value ?? ""),
    ]),
  );
}

async function bodyOf(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }

  return Buffer.concat(chunks).toString("utf8");
}

// A POST body holds one JSON-RPC message, an object.
function parseMessage(body: string): Readonly<Record<string, unknown>> {
  const message: unknown = JSON.parse(body);
  if (!isRecord(message)) {
    throw new Error(`the HTTP MCP server takes one JSON-RPC message per request: ${body}`);
  }

  return message;
}

function isStringRecord(value: unknown): value is Readonly<Record<string, string>> {
  return isRecord(value) && Object.values(value).every((item) => typeof item === "string");
}

// A logged line as a request, failing on a line this module did not write.
function loggedRequest(line: unknown): McpHttpRequest {
  const { server, httpMethod, rpcMethod, params, headers } = isRecord(line) ? line : {};
  if (typeof server !== "string" || typeof httpMethod !== "string" || !isStringRecord(headers)) {
    throw new Error(`invalid HTTP MCP server request record: ${JSON.stringify(line)}`);
  }

  return {
    server,
    httpMethod,
    ...(typeof rpcMethod === "string" ? { rpcMethod } : {}),
    ...(params === undefined ? {} : { params }),
    headers,
  };
}

/**
 * Returns every request the HTTP MCP servers of the harness directory
 * `harness` logged, in the order they arrived, or none when none logged one.
 */
export async function readMcpHttpRequests(harness: string): Promise<McpHttpRequest[]> {
  const logs = await readLogLinesSince(harness, new Map());
  return (logs.get(REQUESTS_FILE) ?? []).map(loggedRequest);
}

/** The loopback Streamable HTTP MCP server of one scenario. */
export class McpHttpServer {
  /** The URL a plugin's `.mcp.json` names: `http://127.0.0.1:<port>/mcp`. */
  readonly url: string;
  private readonly server: Server;
  private readonly name: string;
  private readonly log: string;
  // The log appends, chained so the lines keep the order the requests came in.
  private appended: Promise<void> = Promise.resolve();

  private constructor(server: Server, url: string, name: string, log: string) {
    this.server = server;
    this.url = url;
    this.name = name;
    this.log = log;
    server.on("request", (request: IncomingMessage, response: ServerResponse) => {
      void this.answer(request, response);
    });
  }

  /**
   * Starts the server `name` of the sandbox home `home` on a free port of
   * `127.0.0.1`.
   */
  static async start(home: string, name: string): Promise<McpHttpServer> {
    const server = createServer();
    await new Promise<void>((resolve) => {
      server.listen({ port: 0, host: LOOPBACK }, resolve);
    });
    const address = server.address();
    if (!isRecord(address)) {
      server.close();
      throw new Error(`the HTTP MCP server ${name} has no TCP address`);
    }

    const url = `http://${LOOPBACK}:${String(address.port)}/mcp`;
    return new McpHttpServer(server, url, name, path.join(harnessDirectory(home), REQUESTS_FILE));
  }

  /** Drops every open connection, stops listening, and waits for the log. */
  async close(): Promise<void> {
    const stopped = new Promise<void>((resolve, reject) => {
      this.server.close((error) => {
        if (error === undefined) {
          resolve();
        } else {
          reject(error);
        }
      });
    });
    this.server.closeAllConnections();
    await stopped;
    await this.appended;
  }

  private async answer(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const httpMethod = request.method ?? "";
    const headers = headersOf(request);
    const body = bodyOf(request);
    const entry = this.appended.then(async () => {
      const message = httpMethod === "POST" ? parseMessage(await body) : undefined;
      const record = {
        server: this.name,
        httpMethod,
        rpcMethod: message?.method,
        params: message?.params,
        headers,
      };
      await appendFile(this.log, `${JSON.stringify(record)}\n`);
      return message;
    });
    this.appended = entry.then(() => undefined);
    const message = await entry;
    if (message === undefined) {
      response.writeHead(405).end();
    } else if (message.id === undefined) {
      response.writeHead(202).end();
    } else {
      const result = resultOf(message.method, message.params);
      response
        .writeHead(200, { "content-type": "application/json" })
        .end(JSON.stringify({ jsonrpc: "2.0", id: message.id, result }));
    }
  }
}

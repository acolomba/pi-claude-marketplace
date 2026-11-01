/**
 * @fileoverview The stdio MCP server that stands in for a plugin's real one
 * (HAR-04, D-CF1-17).
 *
 * pi-mcp-adapter starts it with Node and talks newline-delimited JSON-RPC
 * over its stdin and stdout. It answers `initialize`, lists one `echo` tool,
 * and answers a `tools/call` with `echo:<text>`, or `<tag>:echo:<text>` when
 * its environment sets `STUB_TAG`. Any other request gets an empty result,
 * and a notification gets no reply. It appends every message
 * it receives to `<harness dir>/mcp-stub-requests.jsonl`, with the plugin and
 * server names it was started for, writes its pid to
 * `<harness dir>/mcp-stub-<pid>.pid`, and exits when its stdin closes. The
 * harness directory lies in the sandbox home, which the adapter passes on as
 * `HOME`, so each scenario's stub logs into that scenario's directory, and
 * the profile release finds a stub that outlived Pi by its pid. The module is
 * both the stub and the place the steps read its path and its log from.
 */

import { appendFileSync, rmSync, writeFileSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

import { harnessDirectory } from "./turn-records.ts";

/** The absolute path of this file, which a fixture runs with Node. */
export const MCP_STUB_SERVER = fileURLToPath(import.meta.url);

const REQUESTS_FILE = "mcp-stub-requests.jsonl";

// The protocol version the stub answers when a client names none.
const FALLBACK_PROTOCOL_VERSION = "2025-06-18";

/**
 * One message a stub received, as it logged it: the plugin and server it was
 * started for, whether the message was a notification, and the message's
 * method and params, as sent.
 */
export interface StubRequest {
  readonly plugin: string;
  readonly server: string;
  readonly notification: boolean;
  readonly method: unknown;
  readonly params: unknown;
}

interface JsonRpcMessage {
  readonly id?: unknown;
  readonly method?: unknown;
  readonly params?: unknown;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function checkRequest(record: unknown): StubRequest {
  if (
    !isRecord(record) ||
    typeof record.plugin !== "string" ||
    typeof record.server !== "string" ||
    typeof record.notification !== "boolean"
  ) {
    throw new Error(`invalid MCP stub request record: ${JSON.stringify(record)}`);
  }

  return {
    plugin: record.plugin,
    server: record.server,
    notification: record.notification,
    method: record.method,
    params: record.params,
  };
}

/**
 * Returns every message the stubs of the harness directory `harness` logged,
 * in the order they arrived, or none when no stub logged one.
 */
export async function readStubRequests(harness: string): Promise<StubRequest[]> {
  let text: string;
  try {
    text = await readFile(path.join(harness, REQUESTS_FILE), "utf8");
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }

  return text
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => checkRequest(JSON.parse(line)));
}

/**
 * Returns the names of the pid files that running stubs keep in the harness
 * directory `harness`, sorted. A stub removes its file when its stdin closes.
 */
export async function stubPidFiles(harness: string): Promise<string[]> {
  return (await readdir(harness)).filter((name) => /^mcp-stub-\d+\.pid$/u.test(name)).sort();
}

function initializeResult(params: unknown): unknown {
  const version =
    isRecord(params) && typeof params.protocolVersion === "string"
      ? params.protocolVersion
      : FALLBACK_PROTOCOL_VERSION;
  return {
    protocolVersion: version,
    capabilities: { tools: {} },
    serverInfo: { name: "stub", version: "1.0.0" },
  };
}

const ECHO_TOOL = {
  name: "echo",
  description: "Echoes the text it is given.",
  inputSchema: {
    type: "object",
    properties: { text: { type: "string" } },
    required: ["text"],
  },
};

// A non-empty `STUB_TAG` in the stub's environment prefixes the echo, so a
// scenario sees the value the adapter passed when it started the stub.
function callResult(params: unknown): unknown {
  const args = isRecord(params) && isRecord(params.arguments) ? params.arguments : {};
  const text = typeof args.text === "string" ? args.text : "";
  const tag = process.env.STUB_TAG;
  const echoed = tag === undefined || tag === "" ? `echo:${text}` : `${tag}:echo:${text}`;
  return { content: [{ type: "text", text: echoed }] };
}

function resultFor(method: unknown, params: unknown): unknown {
  switch (method) {
    case "initialize":
      return initializeResult(params);
    case "tools/list":
      return { tools: [ECHO_TOOL] };
    case "tools/call":
      return callResult(params);
    default:
      return {};
  }
}

// The stub: logs each message, answers each one that has an id, and leaves
// when its stdin closes.
function serve(plugin: string, server: string): void {
  const home = process.env.HOME;
  if (home === undefined || home === "") {
    throw new Error("the MCP stub needs HOME to find its harness directory");
  }

  const harness = harnessDirectory(home);
  const log = path.join(harness, REQUESTS_FILE);
  const pidFile = path.join(harness, `mcp-stub-${process.pid}.pid`);
  writeFileSync(pidFile, `${process.pid}\n`, { flag: "wx" });
  const lines = createInterface({ input: process.stdin });
  lines.on("line", (line) => {
    if (line.trim() === "") {
      return;
    }

    const message = JSON.parse(line) as JsonRpcMessage;
    const notification = message.id === undefined;
    const record = { plugin, server, notification, method: message.method, params: message.params };
    appendFileSync(log, `${JSON.stringify(record)}\n`);
    if (!notification) {
      const result = resultFor(message.method, message.params);
      process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id: message.id, result })}\n`);
    }
  });
  lines.on("close", () => {
    rmSync(pidFile, { force: true });
    process.exit(0);
  });
}

if (process.argv[1] === MCP_STUB_SERVER) {
  const [, , plugin, server] = process.argv;
  if (plugin === undefined || server === undefined) {
    throw new Error("usage: mcp-stub-server.ts <plugin> <server>");
  }

  serve(plugin, server);
}

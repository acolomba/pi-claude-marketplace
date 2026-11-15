/**
 * @fileoverview The stdio MCP server that stands in for a server a user
 * configured in Pi's `mcp.json`, with one tool whose name it is given
 * (D-P5-09).
 *
 * Pi's built-in MCP starts it with Node and the tool name as its one
 * argument, and talks newline-delimited JSON-RPC over its stdin and stdout.
 * It answers `initialize` with the client's protocol version, lists the one
 * tool, which takes a string `text`, and answers a `tools/call` with
 * `<tool>:<text>`. Calls for `redact`, `image`, and `fail` return distinct
 * fixture payloads. When started for a plugin, it writes the same request and
 * process records as the plugin stub, each request record naming its tool,
 * so listing waits and cleanup remain deterministic. A direct Pi server needs
 * neither record. The server exits when Pi closes its stdin.
 */

import { appendFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { harnessDirectory } from "./turn-records.ts";

/** The absolute path of this file, which Pi's `mcp.json` runs with Node. */
export const HOOK_MCP_TOOL_SERVER = fileURLToPath(import.meta.url);

// The protocol version the server answers when a client names none.
const DEFAULT_PROTOCOL = "2025-06-18";
const TINY_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQI12P4z8DwHwAFAAH/cpxSZwAAAABJRU5ErkJggg==";

type Fields = Readonly<Record<string, unknown>>;

// Answers one request to the server whose tool is `tool`.
type Handler = (tool: string, params: Fields) => unknown;

// The members of a JSON object, or none for any other value.
function fieldsOf(value: unknown): Fields {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(Object.entries(value));
}

const HANDLERS = new Map<string, Handler>([
  [
    "initialize",
    (_tool, params) => ({
      protocolVersion:
        typeof params.protocolVersion === "string" ? params.protocolVersion : DEFAULT_PROTOCOL,
      capabilities: { tools: {} },
      serverInfo: { name: "hook-mcp-tool-server", version: "1.0.0" },
    }),
  ],
  [
    "tools/list",
    (tool) => ({
      tools: [
        {
          name: tool,
          description: "Answers with its own name and the text it is given.",
          inputSchema: {
            type: "object",
            properties: { text: { type: "string" } },
            required: ["text"],
          },
        },
      ],
    }),
  ],
  [
    "tools/call",
    (tool, params) => {
      const { text } = fieldsOf(params.arguments);
      if (text === "redact") {
        return {
          content: [{ type: "text", text: "CONTENT_SECRET" }],
          structuredContent: { secret: "STRUCTURED_SECRET" },
        };
      }

      if (text === "image") {
        return {
          content: [
            { type: "text", text: "ORIGINAL_IMAGE_TEXT" },
            { type: "image", data: TINY_PNG, mimeType: "image/png" },
          ],
          structuredContent: { secret: "ORIGINAL_IMAGE_SECRET" },
        };
      }

      if (text === "fail") {
        return { content: [{ type: "text", text: "echo:fail" }], isError: true };
      }

      return {
        content: [{ type: "text", text: `${tool}:${typeof text === "string" ? text : ""}` }],
      };
    },
  ],
]);

// The reply line to one message, or undefined for a notification, which has
// no id.
function replyTo(tool: string, line: string): string | undefined {
  const message = fieldsOf(JSON.parse(line));
  if (!Object.hasOwn(message, "id")) {
    return undefined;
  }

  const handler = typeof message.method === "string" ? HANDLERS.get(message.method) : undefined;
  const result = handler === undefined ? {} : handler(tool, fieldsOf(message.params));
  return JSON.stringify({ jsonrpc: "2.0", id: message.id, result });
}

// Splits stdin into lines across chunk borders, answers each message that
// has an id, and exits when stdin ends.
function serve(tool: string, plugin?: string, server?: string): void {
  const home = process.env.HOME;
  const harness = home === undefined ? undefined : harnessDirectory(home);
  const pidFile =
    harness === undefined || plugin === undefined || server === undefined
      ? undefined
      : path.join(harness, `mcp-stub-${process.pid}.pid`);
  if (pidFile !== undefined) {
    writeFileSync(pidFile, `${process.pid}\n`, { flag: "wx" });
  }

  let partial = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk: string) => {
    const lines = `${partial}${chunk}`.split("\n");
    partial = lines.pop() ?? "";
    if (harness !== undefined && plugin !== undefined && server !== undefined) {
      for (const line of lines.filter((item) => item.trim() !== "")) {
        const message = fieldsOf(JSON.parse(line));
        appendFileSync(
          path.join(harness, "mcp-stub-requests.jsonl"),
          `${JSON.stringify({ plugin, server, tool, notification: !Object.hasOwn(message, "id"), method: message.method, params: message.params })}\n`,
        );
      }
    }

    const replies = lines
      .filter((line) => line.trim() !== "")
      .map((line) => replyTo(tool, line))
      .filter((reply) => reply !== undefined);
    for (const reply of replies) {
      process.stdout.write(`${reply}\n`);
    }
  });
  process.stdin.on("end", () => {
    if (pidFile !== undefined) {
      rmSync(pidFile, { force: true });
    }

    process.exit(0);
  });
}

if (process.argv[1] === HOOK_MCP_TOOL_SERVER) {
  const [tool, plugin, server] = process.argv.slice(2);
  if (tool === undefined) {
    throw new Error("usage: hook-mcp-tool-server.ts <tool> [plugin server]");
  }

  serve(tool, plugin, server);
}

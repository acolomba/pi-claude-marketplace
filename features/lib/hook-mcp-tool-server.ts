/**
 * @fileoverview The stdio MCP server that stands in for a server a user
 * configured in Pi's `mcp.json`, with one tool whose name it is given
 * (D-P5-09).
 *
 * Pi's built-in MCP starts it with Node and the tool name as its one
 * argument, and talks newline-delimited JSON-RPC over its stdin and stdout.
 * It answers `initialize` with the client's protocol version, lists the one
 * tool, which takes a string `text`, and answers a `tools/call` with
 * `<tool>:<text>`. Any other request gets an empty result, and a notification
 * gets no reply. It keeps no log and no process file: Pi waits for a server
 * with `direct` exposure before the first prompt, and the server exits when
 * Pi closes its stdin. The module is both the server and the place a step
 * reads its path from.
 */

import { fileURLToPath } from "node:url";

/** The absolute path of this file, which Pi's `mcp.json` runs with Node. */
export const HOOK_MCP_TOOL_SERVER = fileURLToPath(import.meta.url);

// The protocol version the server answers when a client names none.
const DEFAULT_PROTOCOL = "2025-06-18";

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
function serve(tool: string): void {
  let partial = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk: string) => {
    const lines = `${partial}${chunk}`.split("\n");
    partial = lines.pop() ?? "";
    const replies = lines
      .filter((line) => line.trim() !== "")
      .map((line) => replyTo(tool, line))
      .filter((reply) => reply !== undefined);
    for (const reply of replies) {
      process.stdout.write(`${reply}\n`);
    }
  });
  process.stdin.on("end", () => {
    process.exit(0);
  });
}

if (process.argv[1] === HOOK_MCP_TOOL_SERVER) {
  const toolArguments = process.argv.slice(2);
  const tool = toolArguments[0];
  if (toolArguments.length !== 1 || tool === undefined) {
    throw new Error("usage: hook-mcp-tool-server.ts <tool>");
  }

  serve(tool);
}

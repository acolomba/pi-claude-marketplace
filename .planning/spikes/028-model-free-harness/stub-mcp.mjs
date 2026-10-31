// Minimal stdio MCP server: newline-delimited JSON-RPC, one tool. Logs every
// request it receives to $SPIKE_MCP_LOG (or $HOME/mcp-stub.log) so the spike can
// prove the adapter actually spawned and talked to it.
import { appendFileSync } from "node:fs";
import { createInterface } from "node:readline";
const log = process.env.SPIKE_MCP_LOG ?? `${process.env.HOME}/mcp-stub.log`;
const send = (m) => process.stdout.write(JSON.stringify(m) + "\n");
appendFileSync(log, JSON.stringify({ spawned: true, argv: process.argv.slice(2), env: { STUB_TOKEN: process.env.STUB_TOKEN ?? null } }) + "\n");
createInterface({ input: process.stdin }).on("line", (line) => {
  const msg = JSON.parse(line);
  appendFileSync(log, JSON.stringify({ method: msg.method }) + "\n");
  if (msg.id === undefined) return;
  switch (msg.method) {
    case "initialize":
      return send({ jsonrpc: "2.0", id: msg.id, result: { protocolVersion: msg.params?.protocolVersion ?? "2025-03-26", capabilities: { tools: {} }, serverInfo: { name: "stub", version: "1.0.0" } } });
    case "tools/list":
      return send({ jsonrpc: "2.0", id: msg.id, result: { tools: [{ name: "echo", description: "Echo the input back", inputSchema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] } }] } });
    case "tools/call":
      return send({ jsonrpc: "2.0", id: msg.id, result: { content: [{ type: "text", text: `echo:${msg.params?.arguments?.text}` }] } });
    default:
      return send({ jsonrpc: "2.0", id: msg.id, result: {} });
  }
});

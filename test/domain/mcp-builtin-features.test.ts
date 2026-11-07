import assert from "node:assert/strict";
import { test } from "node:test";

import { classifyBuiltinMcpServer } from "../../extensions/pi-claude-marketplace/domain/mcp-builtin-features.ts";

import type { McpServerVerdict } from "../../extensions/pi-claude-marketplace/domain/mcp-server-features.ts";

interface VerdictRow {
  readonly title: string;
  readonly server: unknown;
  readonly verdict: McpServerVerdict;
}

const SUPPORTED: McpServerVerdict = { kind: "supported" };

const VERDICT_ROWS: readonly VerdictRow[] = [
  {
    title: "MSEL-01: a non-object is malformed with the shared detail",
    server: 5,
    verdict: { kind: "malformed", detail: "(root): must be object" },
  },
  {
    title: "MSEL-01: an unknown type is malformed with the shared detail",
    server: { type: "grpc", url: "x" },
    verdict: { kind: "malformed", detail: 'unknown type "grpc"' },
  },
  {
    title: "MSEL-01: an sse config its schema rejects is malformed, not blocked by sse",
    server: { type: "sse", url: "x", headers: { A: 1 } },
    verdict: { kind: "malformed", detail: "/headers/A: must be string" },
  },
  {
    title: "MSEL-01: an empty command is malformed with the shared detail",
    server: { command: "" },
    verdict: { kind: "malformed", detail: "/command: must not have fewer than 1 characters" },
  },
  {
    title: "MSEL-01: a stdio server is supported",
    server: { command: "node", args: ["server.js"] },
    verdict: SUPPORTED,
  },
  {
    title: "MSEL-01: an http server is supported",
    server: { type: "http", url: "https://mcp.example.com" },
    verdict: SUPPORTED,
  },
  {
    title: "MSEL-01: a streamable-http server is supported",
    server: { type: "streamable-http", url: "https://mcp.example.com" },
    verdict: SUPPORTED,
  },
  {
    title: "MSEL-01: a valid sse server is blocked by sse",
    server: { type: "sse", url: "https://mcp.example.com/sse" },
    verdict: { kind: "blocked", feature: "sse" },
  },
  {
    title: "MSEL-01: sse blocks before headersHelper",
    server: { type: "sse", url: "x", headersHelper: "./h.sh" },
    verdict: { kind: "blocked", feature: "sse" },
  },
  {
    title: "MSEL-01: bareElicitationCapability true is supported on a stdio server",
    server: { command: "node", bareElicitationCapability: true },
    verdict: SUPPORTED,
  },
  {
    title: "MSEL-01: bareElicitationCapability true is supported on an http server",
    server: { type: "http", url: "x", bareElicitationCapability: true },
    verdict: SUPPORTED,
  },
  {
    title: "MSEL-01: a valid ws server is blocked by ws",
    server: { type: "ws", url: "wss://mcp.example.com/ws" },
    verdict: { kind: "blocked", feature: "ws" },
  },
  {
    title: "MSEL-01: an sse-ide server is blocked without validation",
    server: { type: "sse-ide" },
    verdict: { kind: "blocked", feature: "sse-ide" },
  },
  {
    title: "MSEL-01: a ws-ide server is blocked without validation",
    server: { type: "ws-ide" },
    verdict: { kind: "blocked", feature: "ws-ide" },
  },
  {
    title: "MSEL-01: an sdk server is blocked without validation",
    server: { type: "sdk" },
    verdict: { kind: "blocked", feature: "sdk" },
  },
  {
    title: "MSEL-01: a claudeai-proxy server is blocked without validation",
    server: { type: "claudeai-proxy" },
    verdict: { kind: "blocked", feature: "claudeai-proxy" },
  },
  {
    title: "MSEL-01: headersHelper blocks an http server",
    server: { type: "http", url: "x", headersHelper: "./h.sh" },
    verdict: { kind: "blocked", feature: "headersHelper" },
  },
  {
    title: "MSEL-01: a truthy oauth.xaa blocks an http server",
    server: { type: "http", url: "x", oauth: { xaa: true } },
    verdict: { kind: "blocked", feature: "oauth.xaa" },
  },
  {
    title: "MSEL-01: a command starting with ~/ blocks a stdio server",
    server: { command: "~/bin/server" },
    verdict: { kind: "blocked", feature: "command ~" },
  },
  {
    title: "MSEL-01: an args element starting with ~/ blocks a stdio server",
    server: { command: "node", args: ["~/a"], bareElicitationCapability: true },
    verdict: { kind: "blocked", feature: "args ~" },
  },
];

for (const { title, server, verdict } of VERDICT_ROWS) {
  test(title, () => {
    // arrange
    const expectedVerdict = verdict;

    // act
    const classified = classifyBuiltinMcpServer(server);

    // assert
    assert.deepStrictEqual(classified, expectedVerdict);
  });
}

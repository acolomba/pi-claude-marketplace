// domain/mcp-builtin-features.ts
//
// The Pi 1.5.0 built-in MCP verdict for one declared server (MSEL-01). It
// shares the Claude-shape check and the field-feature helpers with the
// pi-mcp-adapter verdict in `mcp-server-features.ts`, so a server is malformed
// for both implementations or for neither. Only what is blocked differs.

import { checkClaudeShape, leadingHomeFeature, remoteFieldFeature } from "./mcp-server-features.ts";

import type {
  McpServerShape,
  McpServerVerdict,
  McpUnsupportedFeature,
} from "./mcp-server-features.ts";

/**
 * The first feature Pi's built-in MCP cannot honor in a server the shape check
 * accepted. The transport comes first: `ws`, then `sse`, which Pi rejects.
 * Then the remote field features (`headersHelper`, a truthy `oauth.xaa`), or
 * for stdio the leading home features (`command ~`, `args ~`). Pi announces no
 * elicitation capability, so `bareElicitationCapability` never blocks.
 */
function builtinFeature(
  shape: Exclude<McpServerShape, { readonly kind: "malformed" }>,
): McpUnsupportedFeature | undefined {
  switch (shape.kind) {
    case "host-only":
      return shape.feature;
    case "ws":
      return "ws";
    case "remote":
      return shape.transport === "sse" ? "sse" : remoteFieldFeature(shape.server);
    case "stdio":
      return leadingHomeFeature(shape.server);
  }
}

/**
 * Classifies one declared server for Pi's built-in MCP (MSEL-01). A server the
 * shared Claude-shape check rejects is `malformed` with the same detail the
 * pi-mcp-adapter verdict gives. A host-only type, `ws`, `sse`,
 * `headersHelper`, a truthy `oauth.xaa`, and a leading `~` in a stdio
 * server's `command` or `args` block it with the same tokens.
 */
export function classifyBuiltinMcpServer(server: unknown): McpServerVerdict {
  const shape = checkClaudeShape(server);
  if (shape.kind === "malformed") {
    return shape;
  }

  const feature = builtinFeature(shape);
  return feature === undefined ? { kind: "supported" } : { kind: "blocked", feature };
}

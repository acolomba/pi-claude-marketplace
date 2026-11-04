// domain/mcp-implementation.ts
//
// The MCP implementation profiles (MSEL-01). A plugin's MCP servers run under
// pi-mcp-adapter or under Pi's own built-in MCP, and each implementation has
// a profile: the verdict it gives a declared server, and the names it gives
// the server, its tools, and an agent's grant. Both verdicts share one
// Claude-shape check, so a server is malformed for both or for neither.

import { createHash } from "node:crypto";

import { classifyBuiltinMcpServer } from "./mcp-builtin-features.ts";
import { classifyMcpServer } from "./mcp-server-features.ts";
import { builtinMcpServerName, foldedMcpServerKey, generatedMcpServerKey } from "./name.ts";

import type { McpServerVerdict } from "./mcp-server-features.ts";
import type { McpImplementationId } from "../platform/pi-api.ts";

export type { ActiveMcpImplementation, McpImplementationId } from "../platform/pi-api.ts";

/** One MCP implementation's verdict table and naming (MSEL-01). */
export interface McpImplementationProfile {
  readonly id: McpImplementationId;
  /** The implementation's verdict for one declared server config. */
  readonly classify: (config: unknown) => McpServerVerdict;
  /** The name the implementation runs a plugin's server under. */
  readonly serverName: (plugin: string, server: string) => string;
  /** The text every tool name of the server starts with. */
  readonly toolNamePrefix: (plugin: string, server: string) => string;
  /** The full name the model sees for one tool of the server. */
  readonly toolName: (plugin: string, server: string, tool: string) => string;
  /** The `mcp:` entry that grants an agent the whole server. */
  readonly grantSelector: (plugin: string, server: string) => string;
}

/**
 * The adapter's tool prefix is Claude Code's own tool-name form,
 * `mcp__plugin_<plugin>_<server>__` (ANAME-01), which is what D-MB-08 says a
 * hook matcher sees. pi-mcp-adapter appends the tool name unchanged.
 */
function adapterToolNamePrefix(plugin: string, server: string): string {
  return `mcp__${generatedMcpServerKey(plugin, server)}_`;
}

const ADAPTER_PROFILE: McpImplementationProfile = Object.freeze({
  id: "adapter",
  classify: classifyMcpServer,
  serverName: generatedMcpServerKey,
  toolNamePrefix: adapterToolNamePrefix,
  toolName: (plugin: string, server: string, tool: string) =>
    `${adapterToolNamePrefix(plugin, server)}${tool}`,
  grantSelector: (plugin: string, server: string) => `mcp:${generatedMcpServerKey(plugin, server)}`,
});

// Pi 1.5.0 limits a provider tool name to 64 characters
// (`dist/extensions/mcp/tools.js` `MAX_TOOL_NAME_LENGTH`).
const MAX_TOOL_NAME_LENGTH = 64;
const TOOL_NAME_HASH_LENGTH = 8;

/**
 * D-MB-13: Pi's built-in namespace for a registered server name, `mcp__`
 * plus the name with `-` folded to `_`, then the `__` before the tool.
 */
function builtinToolNamePrefix(plugin: string, server: string): string {
  return `mcp__${foldedMcpServerKey(builtinMcpServerName(plugin, server))}__`;
}

/**
 * D-MB-13: Pi 1.5.0's `createMcpToolName`. Every character outside
 * `[A-Za-z0-9_]` in `mcp__<server>__<tool>` becomes `_`. A name over 64
 * characters keeps its first 55, then `_` and the first 8 hex of the sha256 of
 * the registered server name (with `-` kept), NUL, and the original tool
 * name. Pi also hashes a short name when another tool already sanitizes to
 * it; which tools a server offers is not in the records, so that case cannot
 * be predicted and is a recorded gap.
 */
function builtinToolName(plugin: string, server: string, tool: string): string {
  const serverName = builtinMcpServerName(plugin, server);
  // Without the `u` flag, `\W` is exactly Pi's `[^A-Za-z0-9_]`, applied to
  // each UTF-16 code unit.
  const name = `mcp__${serverName}__${tool}`.replaceAll(/\W/g, "_");
  if (name.length <= MAX_TOOL_NAME_LENGTH) {
    return name;
  }

  const hash = createHash("sha256")
    .update(`${serverName}\0${tool}`)
    .digest("hex")
    .slice(0, TOOL_NAME_HASH_LENGTH);
  return `${name.slice(0, MAX_TOOL_NAME_LENGTH - TOOL_NAME_HASH_LENGTH - 1)}_${hash}`;
}

const BUILTIN_PROFILE: McpImplementationProfile = Object.freeze({
  id: "builtin",
  classify: classifyBuiltinMcpServer,
  serverName: builtinMcpServerName,
  toolNamePrefix: builtinToolNamePrefix,
  toolName: builtinToolName,
  grantSelector: (plugin: string, server: string) => `mcp:${builtinMcpServerName(plugin, server)}`,
});

const PROFILES = {
  adapter: ADAPTER_PROFILE,
  builtin: BUILTIN_PROFILE,
} as const satisfies Record<McpImplementationId, McpImplementationProfile>;

/** The frozen profile of one MCP implementation; every call returns the same object. */
export function profileFor(id: McpImplementationId): McpImplementationProfile {
  return PROFILES[id];
}

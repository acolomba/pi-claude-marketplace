/**
 * @fileoverview The model script for one call of a tool of the hooks' stub
 * MCP server, through whichever MCP implementation the profile runs (D-P5-08).
 *
 * pi-mcp-adapter serves the stub's tools through its `mcp` proxy, so the
 * model calls `mcp` with the adapter's tool name and the arguments. Pi's
 * built-in MCP declares the tools as deferred: Pi calls one only after
 * `tool_search` loads it, so the model searches for Pi's tool name first,
 * then calls the tool by that name. Each profile's tool name comes from the
 * extension's own profile, so the script cannot drift from the names the
 * implementation registers.
 */

import { profileFor } from "../../extensions/pi-claude-marketplace/domain/mcp-implementation.ts";

import type { McpProfile } from "./mcp-implementation.ts";
import type { ScriptStep } from "./scripted-model/script.ts";

// The arguments a step states as JSON text, which must be one JSON object.
function callArguments(text: string): Readonly<Record<string, unknown>> {
  const parsed: unknown = JSON.parse(text);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new TypeError(`the tool arguments must be a JSON object: ${text}`);
  }

  return parsed as Readonly<Record<string, unknown>>;
}

/**
 * The script that calls `tool` of the stub server `server` of `plugin` with
 * the arguments `argumentsText`, then replies `reply`.
 */
export function hookMcpCallScript(
  profile: McpProfile,
  plugin: string,
  server: string,
  tool: string,
  argumentsText: string,
  reply: string,
): ScriptStep[] {
  const args = callArguments(argumentsText);
  const name = profileFor(profile).toolName(plugin, server, tool);
  if (profile === "adapter") {
    return [{ tool: "mcp", arguments: { tool: name, args } }, { reply }];
  }

  return [
    { tool: "tool_search", arguments: { query: name, limit: 1 } },
    { tool: name, arguments: args },
    { reply },
  ];
}

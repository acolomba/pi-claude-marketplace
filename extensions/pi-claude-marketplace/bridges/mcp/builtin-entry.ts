// bridges/mcp/builtin-entry.ts
//
// Builds the config this extension registers with Pi's built-in MCP for one
// plugin MCP server (BLT-01, BLT-02). The closed table in
// `domain/mcp-builtin-translation.ts` maps the fields Claude Code reads, then
// `substitute.ts` injects `CLAUDE_PLUGIN_ROOT` and `CLAUDE_PLUGIN_DATA` into a
// stdio `env` (MENV-01/02) and resolves Claude's variables with the built-in
// encoder. Nothing here writes a file: the config lives in Pi's session
// registry only (D-MB-04).

import { translateBuiltinMcpServer } from "../../domain/mcp-builtin-translation.ts";

import { BUILTIN_FIELD_ENCODER } from "./builtin-escape.ts";
import { isPlainObject } from "./marker.ts";
import { substituteAndInject, type McpSubstitutionContext } from "./substitute.ts";

import type { McpServerConfig } from "../../platform/pi-api.ts";

// Pi's two config forms: stdio needs a string `command`, http a string `url`.
// Pi validates the rest when the config is registered.
function isPiServerConfig(entry: object): entry is McpServerConfig {
  return (
    ("command" in entry && typeof entry.command === "string") ||
    ("url" in entry && typeof entry.url === "string")
  );
}

/**
 * The config of one server as Claude Code would run it, or `undefined` for a
 * server that is not an object or has neither a string `command` nor a
 * string `url`. `ctx.projectDir` is the session's working directory for
 * both scopes, because the registration happens per session.
 */
export function builtinServerConfig(
  server: unknown,
  ctx: McpSubstitutionContext,
  description: string | undefined,
): McpServerConfig | undefined {
  if (!isPlainObject(server)) {
    return undefined;
  }

  const { entry } = substituteAndInject(
    translateBuiltinMcpServer(server, description),
    ctx,
    BUILTIN_FIELD_ENCODER,
  );
  return isPiServerConfig(entry) ? entry : undefined;
}

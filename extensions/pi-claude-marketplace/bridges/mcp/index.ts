// bridges/mcp/index.ts
//
// Public surface of the MCP bridge. Per D-01 the barrel re-exports
// concrete per-bridge signatures; the in-memory `_nextDoc` field on
// `PreparedMcpStaged` is intentionally NOT re-exported here so consumers
// outside the bridge cannot reach into the staged doc directly. They
// either hand the prepared union back to `commitPreparedMcp`/
// `abortPreparedMcp`, or read the user-facing `result` slot.

export {
  abortPreparedMcp,
  commitPreparedMcp,
  finalizeMcpReplacement,
  prepareStageMcpServers,
  replacePreparedMcp,
  rollbackMcpReplacement,
} from "./stage.ts";
export { unstageMcpServers } from "./unstage.ts";
export { resolvePluginMcpServers } from "./parse.ts";
export type { McpReplacement, PreparedMcpStaging } from "./types.ts";

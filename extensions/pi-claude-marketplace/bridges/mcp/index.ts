// bridges/mcp/index.ts
//
// Public surface of the MCP bridge. Per D-01 the barrel re-exports
// concrete per-bridge signatures. The in-memory `_nextDoc` field on
// `PreparedMcpStaged` is still reachable through the exported
// `PreparedMcpStaging` union -- the leading underscore is a naming
// convention, not enforced encapsulation. Consumers outside the bridge
// should hand the prepared union back to `commitPreparedMcp`/
// `abortPreparedMcp`, or read the user-facing `result` slot, instead of
// touching `_nextDoc` directly.

export {
  abortPreparedMcp,
  commitPreparedMcp,
  finalizeMcpReplacement,
  prepareStageMcpServers,
  replacePreparedMcp,
  rollbackMcpReplacement,
} from "./stage.ts";
export { unstageMcpServers } from "./unstage.ts";
export type { McpReplacement, PreparedMcpStaging } from "./types.ts";

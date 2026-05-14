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
export { resolvePluginMcpServers, parseMcpServers } from "./parse.ts";
export { MCP_COLLISION_SLOTS, loadEffectiveServerNames } from "./collision-slots.ts";
export { CLAUDE_MARKETPLACE_MARKER_KEY, buildMarker, readMarker, isOwnedBy } from "./marker.ts";
export type { ClaudeMarketplaceMarker } from "./marker.ts";
export type {
  McpReplacement,
  McpServerEntry,
  McpServersSource,
  PreparedMcpNoop,
  PreparedMcpStaged,
  PreparedMcpStaging,
  RawMcpDoc,
  ResolvedMcpServers,
  ResolvePluginMcpServersInput,
  StageMcpInput,
  StageMcpCommitResult,
  StagedMcpRecord,
  UnstageMcpInput,
  UnstageMcpResult,
} from "./types.ts";

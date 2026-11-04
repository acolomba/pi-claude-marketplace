// platform/mcp-builtin-status.ts
//
// BLT-05: the status reader for the MCP servers the extension registers with
// Pi's built-in MCP. It lives in platform/ because Pi's MCP registry is an
// external-system boundary; it imports only this zone's `mcp-status.ts` and
// `pi-api.ts` types.
//
// This is the seed of the reader: it answers `"no-snapshot"` for every server,
// so info reads `status unknown` on every built-in row, as it does for an
// adapter row before pi-mcp-adapter has published a snapshot. BLT-05 fills
// the lookup from what Pi exposes, within the view the parameter names: the
// registered servers, and the tool list. Pi's built-in MCP emits no status
// event, so whether a server's tools are in `getAllTools()` is the only sign
// that it connected.
//
// MSEL-01: `index.ts` builds this reader once per extension load, at factory
// time, before every extension has loaded, so building it must not read `pi`.
// A lookup runs inside an info command, after every extension has loaded; the
// seed's lookup reads nothing either.

import type { McpStatusReader } from "./mcp-status.ts";
import type { PiInventory, PiMcpRegistry } from "./pi-api.ts";

/**
 * Returns the built-in MCP status reader for one extension load. Building it
 * reads nothing from `pi`.
 */
export function createBuiltinMcpStatusReader(
  _pi: Pick<PiMcpRegistry, "getMcpServers"> & Pick<PiInventory, "getAllTools">,
): McpStatusReader {
  return {
    lookup: () => "no-snapshot",
  };
}

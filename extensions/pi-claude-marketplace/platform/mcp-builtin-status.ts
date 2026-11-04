// platform/mcp-builtin-status.ts
//
// BLT-05: the status reader for the MCP servers the extension registers with
// Pi's built-in MCP. It lives in platform/ because Pi's MCP registry is an
// external-system boundary; it imports only this zone's `mcp-status.ts` and
// `pi-api.ts` types.
//
// P2-DC-10: Pi gives extensions no connection state and emits no status
// event, so a lookup infers the state from what Pi exposes, within the view
// the parameter names: the registered servers and the tool list. Pi registers
// every tool of a server in `getAllTools()` as soon as the server connects,
// deferred ones included, under the namespace `mcp__<server>` with `-` folded
// to `_` (Pi 1.5.0 `mcpNamespace`), and its `/mcp` manager re-registers every
// tool of a server it disables for the session with the exposure `hidden`.
// So a registered server answers:
//
// - `connected` when a tool of its namespace is not hidden;
// - `disabled` when every tool of its namespace is hidden;
// - `not-connected` when its namespace has no tool: still connecting, failed,
//   waiting for sign-in, or offering no tool, which Pi does not tell apart.
//
// A name Pi does not list answers `unlisted` (rendered `not loaded`), even
// when hidden tools of an earlier registration in the session remain.
//
// P2-DC-46 (recorded gap): when another extension registered a server under
// the same name first, Pi refuses this extension's registration and the
// lookup answers from the other extension's server. Its registration names
// its `extensionPath`, but this reader cannot learn its own through the
// frozen parameter, so it cannot tell the two apart.
//
// MSEL-01: `index.ts` builds this reader once per extension load, at factory
// time, before every extension has loaded, so building it must not read `pi`.
// Every read happens inside `lookup`, which runs inside an info command,
// after every extension has loaded.

import type { McpStatusReader } from "./mcp-status.ts";
import type { PiInventory, PiMcpRegistry, ToolInventoryItem } from "./pi-api.ts";

// Pi 1.5.0 `core/mcp-servers.js` `mcpNamespace`.
function namespaceOf(serverName: string): string {
  return `mcp__${serverName.replaceAll("-", "_")}`;
}

// `ToolInventoryItem` declares only the fields every caller reads; Pi's items
// also carry `namespace` and `exposure`, which are read here by narrowing.
function namespaceNameOf(tool: ToolInventoryItem): unknown {
  if (!("namespace" in tool)) {
    return undefined;
  }

  const namespace: unknown = tool.namespace;
  return typeof namespace === "object" && namespace !== null && "name" in namespace
    ? namespace.name
    : undefined;
}

function isHidden(tool: ToolInventoryItem): boolean {
  return "exposure" in tool && tool.exposure === "hidden";
}

/**
 * Returns the built-in MCP status reader for one extension load. Building it
 * reads nothing from `pi`.
 */
export function createBuiltinMcpStatusReader(
  pi: Pick<PiMcpRegistry, "getMcpServers"> & Pick<PiInventory, "getAllTools">,
): McpStatusReader {
  return {
    lookup(serverName) {
      if (!pi.getMcpServers().some((server) => server.name === serverName)) {
        return "unlisted";
      }

      const namespace = namespaceOf(serverName);
      const tools = pi.getAllTools().filter((tool) => namespaceNameOf(tool) === namespace);
      if (tools.length === 0) {
        return "not-connected";
      }

      return tools.every(isHidden) ? "disabled" : "connected";
    },
  };
}

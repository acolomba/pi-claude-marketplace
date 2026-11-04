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
// - `disabled` when every tool of its namespace is hidden, unless the
//   server's last registration replaced another config;
// - `not-connected` when its namespace has no tool: still connecting, failed,
//   waiting for sign-in, or offering no tool, which Pi does not tell apart.
//
// Pi also hides every tool of a server that an extension registers again
// with a changed config: it drops the old connection and starts a new one
// (Pi 1.5.0 `mcp_servers_change` handler). Until the new connection lists its
// tools, and for the session when it fails, nothing in the registry or the
// tool list tells that apart from a `/mcp` disable. So the registration sync
// notes each name whose registration replaced another config, and such a
// name with only hidden tools answers `not-connected`. A replaced server that
// the user then disables in `/mcp` also answers `not-connected`.
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

// The names whose last registration in this Pi process replaced a listed
// config of another shape. A fresh registration or a removal clears a name,
// and Pi starts each session with no registration, so a name from an earlier
// session is cleared when it registers again.
const replacedRegistrations = new Set<string>();

/** Notes that the sync registered `serverName` in place of a listed config of another shape. */
export function noteReplacedBuiltinRegistration(serverName: string): void {
  replacedRegistrations.add(serverName);
}

/** Notes that the sync registered `serverName` fresh, or removed it. */
export function noteFreshBuiltinRegistration(serverName: string): void {
  replacedRegistrations.delete(serverName);
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

      if (!tools.every(isHidden)) {
        return "connected";
      }

      return replacedRegistrations.has(serverName) ? "not-connected" : "disabled";
    },
  };
}

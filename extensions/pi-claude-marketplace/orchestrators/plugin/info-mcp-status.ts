// orchestrators/plugin/info-mcp-status.ts
//
// ASTAT-01 / ASTAT-02: stamps each written MCP server's state on an installed
// or partially installed info block. The command determines the state and the
// renderer only formats it (IL-2).
//
// NFR-5: network-free. This module is outside `NETWORK_SEAMS` and names no git
// surface.
//
// The join is an exact string match on `generatedMcpServerKey(plugin,
// recordedServer)`, because pi-mcp-adapter reports raw config keys. Only the
// servers the installation record lists get a state: the manifest arm lists
// the current declaration, which can differ from what install wrote. A
// disabled record's servers are out of the adapter configuration (ENBL-08),
// so a `(disabled)` row gets no state.

import { generatedMcpServerKey, mcpServerDisplayName } from "../../domain/name.ts";

import type { PluginInstallRecord } from "../../persistence/state-io.ts";
import type { McpServerRuntimeStatus, McpStatusReader } from "../../platform/mcp-status.ts";
import type {
  McpServerStatus,
  McpServerSummaryEntry,
  PluginInfoMessage,
} from "../../shared/notification-types.ts";

const RUNTIME_STATUS_TOKENS = {
  connected: "connected",
  cached: "cached, connects on first use",
  "needs-auth": "needs authentication",
  blocked: "pending approval",
  disabled: "disabled",
  "not-connected": "not connected",
  failed: "failed",
} as const satisfies Record<McpServerRuntimeStatus, McpServerStatus>;

function statusToken(answer: ReturnType<McpStatusReader["lookup"]>): McpServerStatus {
  if (answer === "no-snapshot" || answer === "unrecognized") {
    return "status unknown";
  }

  if (answer === "unlisted") {
    return "not loaded";
  }

  return RUNTIME_STATUS_TOKENS[answer];
}

function stampEntries(
  plugin: string,
  entries: readonly McpServerSummaryEntry[],
  recordedServers: readonly string[],
  mcpStatus: McpStatusReader,
): McpServerSummaryEntry[] {
  const recordedByName = new Map(
    recordedServers.map((server) => [mcpServerDisplayName(plugin, server), server]),
  );
  return entries.map((entry) => {
    const server = recordedByName.get(entry.name);
    if (entry.unsupportedFeature !== undefined || server === undefined) {
      return entry;
    }

    return {
      ...entry,
      status: statusToken(mcpStatus.lookup(generatedMcpServerKey(plugin, server))),
    };
  });
}

/**
 * Returns `block` with each MCP server its installation record lists as
 * written stamped with the state pi-mcp-adapter last reported. Only
 * `(installed)` and `(partially-installed)` rows with resolved components are
 * stamped. The input is never mutated, and the row status, reasons and
 * severity are left as they are.
 */
export function withMcpServerStatus(
  block: PluginInfoMessage,
  record: PluginInstallRecord | undefined,
  mcpStatus: McpStatusReader,
): PluginInfoMessage {
  const plugin = block.plugin;
  const stampable = plugin.status === "installed" || plugin.status === "partially-installed";
  if (!stampable || !plugin.componentsResolved || record === undefined) {
    return block;
  }

  const entries = plugin.components.mcp;
  if (entries === undefined) {
    return block;
  }

  const mcp = stampEntries(plugin.name, entries, record.resources.mcpServers, mcpStatus);
  return { ...block, plugin: { ...plugin, components: { ...plugin.components, mcp } } };
}

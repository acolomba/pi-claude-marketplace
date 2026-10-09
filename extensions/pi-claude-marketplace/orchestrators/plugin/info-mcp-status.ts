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
//
// ASTAT-01: the same plugin installed in both scopes writes one key into both
// scopes' adapter files, pi-mcp-adapter loads the project file last, and its
// snapshot names no source. So a user row's server that the plugin's enabled
// project record also lists reads `overridden by project scope`. A disabled
// project record writes no adapter entry (ENBL-08) and does not override. With
// no usable snapshot every row reads `status unknown` first. A project row is
// never overridden.

import { generatedMcpServerKey, mcpServerDisplayName } from "../../domain/name.ts";
import { isRecordedButDisabled } from "../../persistence/state-io.ts";

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

  // ASTAT-02: an own-key check, so an answer outside the reader's closed set
  // reads `status unknown` and never resolves to an `Object.prototype` member.
  return Object.hasOwn(RUNTIME_STATUS_TOKENS, answer)
    ? RUNTIME_STATUS_TOKENS[answer]
    : "status unknown";
}

function projectOverrides(
  block: PluginInfoMessage,
  projectRecord: PluginInstallRecord | undefined,
): ReadonlySet<string> {
  if (
    block.marketplaceScope !== "user" ||
    projectRecord === undefined ||
    isRecordedButDisabled(projectRecord)
  ) {
    return new Set<string>();
  }

  return new Set(projectRecord.resources.mcpServers);
}

function stampEntries(
  plugin: string,
  entries: readonly McpServerSummaryEntry[],
  recordedServers: readonly string[],
  overridden: ReadonlySet<string>,
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

    const answer = mcpStatus.lookup(generatedMcpServerKey(plugin, server));
    const status: McpServerStatus =
      answer !== "no-snapshot" && overridden.has(server)
        ? "overridden by project scope"
        : statusToken(answer);
    return { ...entry, status };
  });
}

/**
 * Returns `block` with each MCP server its installation record lists as
 * written stamped with the state pi-mcp-adapter last reported. Only
 * `(installed)` and `(partially-installed)` rows with resolved components are
 * stamped. `projectRecord` is the same plugin's installation record in the
 * project scope; on a user row it decides which servers the project entry
 * overrides. The input is never mutated, and the row status, reasons and
 * severity are left as they are.
 */
export function withMcpServerStatus(
  block: PluginInfoMessage,
  record: PluginInstallRecord | undefined,
  mcpStatus: McpStatusReader,
  projectRecord: PluginInstallRecord | undefined,
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

  const mcp = stampEntries(
    plugin.name,
    entries,
    record.resources.mcpServers,
    projectOverrides(block, projectRecord),
    mcpStatus,
  );
  return { ...block, plugin: { ...plugin, components: { ...plugin.components, mcp } } };
}

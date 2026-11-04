// orchestrators/plugin/info-mcp-status.ts
//
// ASTAT-01 / ASTAT-02 / BLT-05: stamps each written MCP server's state on an
// installed or partially installed info block. The command determines the
// state and the renderer only formats it (IL-2).
//
// NFR-5: network-free. This module is outside `NETWORK_SEAMS` and names no git
// surface.
//
// MSEL-01: info hands in the reader of the run's active implementation as
// part of an `McpStatusLookup`, and `lookup.implementation` picks the arm.
// Only the servers the installation record lists get a state: the manifest
// arm lists the current declaration, which can differ from what install
// wrote. A disabled record's servers are out of every implementation's
// configuration (ENBL-08), so a `(disabled)` row gets no state.
//
// Under `adapter` and `none` the lookup key is
// `generatedMcpServerKey(plugin, server)`, an exact string match, because
// pi-mcp-adapter reports raw config keys, and the stamped servers are the
// record's `resources.mcpServers`, the servers written to the adapter file.
// ASTAT-01: the same plugin installed in both scopes writes one key into both
// scopes' adapter files, pi-mcp-adapter loads the project file last, and its
// snapshot names no source. So a user row's server that the plugin's enabled
// project record also lists reads `overridden by project scope`. A disabled
// project record writes no adapter entry (ENBL-08) and does not override. With
// no usable snapshot every row reads `status unknown` first. A project row is
// never overridden.
//
// Under `builtin` (D-MB-13) the lookup key is the registered built-in name,
// `profileFor("builtin").serverName(plugin, server)`, which has no trailing
// `_`, and the stamped servers are the names in the record's
// `mcpServerConfigs`: every server the registration step reads, the ones the
// adapter blocks included. A record that predates that key falls back to
// `resources.mcpServers`, because the call is synchronous and the
// asynchronous legacy reader is out of reach.

import { profileFor } from "../../domain/mcp-implementation.ts";
import { generatedMcpServerKey, mcpServerDisplayName } from "../../domain/name.ts";
import { isRecordedButDisabled } from "../../persistence/state-io.ts";

import type { PluginInstallRecord } from "../../persistence/state-io.ts";
import type {
  McpServerRuntimeStatus,
  McpStatusLookup,
  McpStatusReader,
} from "../../platform/mcp-status.ts";
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
  statusOf: (server: string) => McpServerStatus,
): McpServerSummaryEntry[] {
  const recordedByName = new Map(
    recordedServers.map((server) => [mcpServerDisplayName(plugin, server), server]),
  );
  return entries.map((entry) => {
    const server = recordedByName.get(entry.name);
    if (entry.unsupportedFeature !== undefined || server === undefined) {
      return entry;
    }

    return { ...entry, status: statusOf(server) };
  });
}

function stampAdapterEntries(
  block: PluginInfoMessage,
  entries: readonly McpServerSummaryEntry[],
  record: PluginInstallRecord,
  lookup: McpStatusLookup,
  projectRecord: PluginInstallRecord | undefined,
): McpServerSummaryEntry[] {
  const plugin = block.plugin.name;
  const overridden = projectOverrides(block, projectRecord);
  return stampEntries(plugin, entries, record.resources.mcpServers, (server) => {
    const answer = lookup.reader.lookup(generatedMcpServerKey(plugin, server));
    return answer !== "no-snapshot" && overridden.has(server)
      ? "overridden by project scope"
      : statusToken(answer);
  });
}

// MREC-02: the servers a record lists for Pi's built-in MCP, by declared name.
function builtinRecordedServers(record: PluginInstallRecord): readonly string[] {
  return record.mcpServerConfigs?.map(({ name }) => name) ?? record.resources.mcpServers;
}

function stampBuiltinEntries(
  block: PluginInfoMessage,
  entries: readonly McpServerSummaryEntry[],
  record: PluginInstallRecord,
  lookup: McpStatusLookup,
): McpServerSummaryEntry[] {
  const plugin = block.plugin.name;
  const { serverName } = profileFor("builtin");
  return stampEntries(plugin, entries, builtinRecordedServers(record), (server) =>
    statusToken(lookup.reader.lookup(serverName(plugin, server))),
  );
}

/**
 * Returns `block` with each MCP server its installation record lists as
 * written stamped with the state `lookup.reader` reports for it. Only
 * `(installed)` and `(partially-installed)` rows with resolved components are
 * stamped. `projectRecord` is the same plugin's installation record in the
 * project scope; on a user row it decides which servers the project entry
 * overrides. The input is never mutated, and the row status, reasons and
 * severity are left as they are.
 */
export function withMcpServerStatus(
  block: PluginInfoMessage,
  record: PluginInstallRecord | undefined,
  lookup: McpStatusLookup,
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

  const mcp =
    lookup.implementation === "builtin"
      ? stampBuiltinEntries(block, entries, record, lookup)
      : stampAdapterEntries(block, entries, record, lookup, projectRecord);
  return { ...block, plugin: { ...plugin, components: { ...plugin.components, mcp } } };
}

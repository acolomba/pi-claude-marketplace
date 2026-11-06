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
// `_`, and the stamped servers are the record's servers as
// `recordedMcpServers` reads them for the registration step, the ones the
// adapter blocks included. Info hands in that read as a port. For a record
// that predates `mcpServerConfigs`, they are the servers the legacy reader
// re-resolves (MREC-02). When the read answers `unreadable`, the step
// registers none of them, and the stamped servers are the ones install wrote,
// `resources.mcpServers`.
//
// BLT-05: under `builtin` the stamps run in a fixed order. A project row
// reads `project not trusted` while Pi does not trust the project (D-MB-09).
// Then a server reads `overridden by mcp.json` when a server of Pi's
// `mcp.json` files holds its namespace (BLT-04, P2-DC-08): the user's file,
// and the project's only while trusted, read synchronously through the bridge
// (P2-DC-26). Then a server whose registered name the registration step's
// last sync gave to another record does not read that record's state: a user
// row reads `overridden by project scope` when a project record owns the name
// (ASTAT-01, P2-DC-14), and any other row reads `not loaded`. The owner is the
// step's own decision, so a project server the step skipped, as blocked,
// malformed, outside its clone root, or unreadable, overrides nothing, and
// the owner's marketplace and plugin count, because the registered name does
// not name the marketplace and can fold two plugins together. Then a server
// whose registration Pi refused reads `not loaded`, because another extension
// registered the name first and Pi lists that extension's server under it
// (D-MB-29, P2-DC-46). Otherwise the server reads the reader's answer.

import { readMcpJsonServerNamespaces } from "../../bridges/mcp/index.ts";
import { profileFor } from "../../domain/mcp-implementation.ts";
import {
  foldedMcpServerKey,
  generatedMcpServerKey,
  mcpServerDisplayName,
} from "../../domain/name.ts";
import { locationsFor } from "../../persistence/locations.ts";
import { isRecordedButDisabled } from "../../persistence/state-io.ts";
import {
  builtinRegistrationRefused,
  builtinServerOwner,
} from "../../platform/mcp-builtin-status.ts";

import type { RecordedMcpServers } from "../../domain/mcp-implementation.ts";
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
function builtinRecordedServers(
  record: PluginInstallRecord,
  recorded: RecordedMcpServers,
): readonly string[] {
  return recorded.kind === "unreadable"
    ? record.resources.mcpServers
    : recorded.servers.map(({ name }) => name);
}

// D-MB-09: Pi reads the project's `mcp.json` only while it trusts the project.
function mcpJsonFiles(lookup: McpStatusLookup): readonly string[] {
  const user = locationsFor("user", lookup.cwd).mcpJsonPath;
  return lookup.projectTrusted ? [user, locationsFor("project", lookup.cwd).mcpJsonPath] : [user];
}

/**
 * ASTAT-01 / P2-DC-14: the state of a server whose registered name another
 * record owns, or `undefined` when the row's own record owns it or no record
 * does.
 */
function ownedElsewhere(block: PluginInfoMessage, name: string): McpServerStatus | undefined {
  const owner = builtinServerOwner(name);
  if (
    owner === undefined ||
    (owner.scope === block.marketplaceScope &&
      owner.marketplace === block.marketplaceName &&
      owner.plugin === block.plugin.name)
  ) {
    return undefined;
  }

  return owner.scope === "project" && block.marketplaceScope === "user"
    ? "overridden by project scope"
    : "not loaded";
}

/**
 * BLT-05: one server's built-in state, in a fixed order: an `mcp.json`
 * server that holds its namespace (BLT-04, T-02-19), so a same-named
 * `mcp.json` server never reads as the plugin's; then a name another record
 * owns; then a name whose registration Pi refused (D-MB-29); then the
 * reader's answer under the registered name.
 */
function builtinStatus(
  block: PluginInfoMessage,
  server: string,
  configured: ReadonlySet<string>,
  reader: McpStatusReader,
): McpServerStatus {
  const name = profileFor("builtin").serverName(block.plugin.name, server);
  if (configured.has(foldedMcpServerKey(name))) {
    return "overridden by mcp.json";
  }

  const owned = ownedElsewhere(block, name);
  if (owned !== undefined) {
    return owned;
  }

  // D-MB-29: another extension holds the name, so Pi lists its server, not
  // the plugin's.
  if (builtinRegistrationRefused(name)) {
    return "not loaded";
  }

  return statusToken(reader.lookup(name));
}

async function stampBuiltinEntries(
  block: PluginInfoMessage,
  entries: readonly McpServerSummaryEntry[],
  record: PluginInstallRecord,
  lookup: McpStatusLookup,
  readServers: (record: PluginInstallRecord) => Promise<RecordedMcpServers>,
): Promise<McpServerSummaryEntry[]> {
  const plugin = block.plugin.name;
  const recorded = builtinRecordedServers(record, await readServers(record));
  // D-MB-09: the extension registers no project server while Pi does not
  // trust the project, so a project row reads `project not trusted` first.
  if (block.marketplaceScope === "project" && !lookup.projectTrusted) {
    return stampEntries(plugin, entries, recorded, () => "project not trusted");
  }

  const configured = readMcpJsonServerNamespaces(mcpJsonFiles(lookup));
  return stampEntries(plugin, entries, recorded, (server) =>
    builtinStatus(block, server, configured, lookup.reader),
  );
}

/**
 * Returns `block` with each MCP server its installation record lists as
 * written stamped with the state `lookup.reader` reports for it. Only
 * `(installed)` and `(partially-installed)` rows with resolved components are
 * stamped. `projectRecord` is the same plugin's installation record in the
 * project scope; under pi-mcp-adapter it decides which servers of a user row
 * the project entry overrides. Under Pi's built-in MCP the registration
 * step's own decision does. `readServers` reads one record's MCP servers as
 * the registration step reads them (MREC-02); it is called only under Pi's
 * built-in MCP. The input is never mutated, and the row status, reasons and
 * severity are left as they are.
 */
export async function withMcpServerStatus(
  block: PluginInfoMessage,
  record: PluginInstallRecord | undefined,
  lookup: McpStatusLookup,
  projectRecord: PluginInstallRecord | undefined,
  readServers: (record: PluginInstallRecord) => Promise<RecordedMcpServers>,
): Promise<PluginInfoMessage> {
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
      ? await stampBuiltinEntries(block, entries, record, lookup, readServers)
      : stampAdapterEntries(block, entries, record, lookup, projectRecord);
  return { ...block, plugin: { ...plugin, components: { ...plugin.components, mcp } } };
}

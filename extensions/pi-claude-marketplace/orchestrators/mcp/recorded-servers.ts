// orchestrators/mcp/recorded-servers.ts
//
// MREC-01 / D-MB-04: the one reader of a plugin record's `mcpServerConfigs`.
// The built-in registration and the effective compatibility read take a
// record's MCP servers from here, and from nowhere else.
//
// MREC-02: a record without the field predates it. Absence never means "no
// servers": the legacy reader re-resolves the declaration from the recorded
// plugin root instead. A present empty array means the plugin declares no
// non-malformed server, and the legacy reader is not called.
//
// The read changes nothing: it writes no file and no state, and it reaches no
// network (NFR-5). This module is outside BLOCK F's NETWORK_SEAMS, so it can
// import no git surface.

import type { RecordedMcpServer, RecordedMcpServers } from "../../domain/mcp-implementation.ts";
import type { PluginInstallRecord } from "../../persistence/state-io.ts";

/** The MCP servers the legacy reader re-resolves for a record that predates the field. */
export interface LegacyServers {
  readonly servers: readonly RecordedMcpServer[];
  /** The plugin references a `.mcpb` or `.dxt` bundle (MREC-01). */
  readonly bundle: boolean;
}

/** Re-resolves the declared MCP servers of a record that predates `mcpServerConfigs`. */
export type LegacyServersReader = (record: PluginInstallRecord) => Promise<LegacyServers>;

/**
 * MREC-01 / MREC-02: a plugin record's MCP servers. A record with
 * `mcpServerConfigs` answers `recorded` with the field as stored; the values
 * are the record's own, so a caller must not change them. A record without
 * the field answers `re-resolved` from the legacy reader, and any failure of
 * that reader answers `unreadable`, so the stored compatibility verdict
 * stands.
 */
export async function recordedMcpServers(
  record: PluginInstallRecord,
  reader: LegacyServersReader,
): Promise<RecordedMcpServers> {
  if (record.mcpServerConfigs !== undefined) {
    return {
      kind: "recorded",
      servers: record.mcpServerConfigs,
      bundle: record.mcpBundle === true,
    };
  }

  try {
    const legacy = await reader(record);
    return { kind: "re-resolved", servers: legacy.servers, bundle: legacy.bundle };
  } catch {
    // MREC-02: an unreadable declaration leaves the stored verdict standing.
    return { kind: "unreadable" };
  }
}

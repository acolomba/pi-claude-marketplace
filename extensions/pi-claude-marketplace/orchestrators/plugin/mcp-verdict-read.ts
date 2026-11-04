// orchestrators/plugin/mcp-verdict-read.ts
//
// D-P3-04: the one read of a plugin record's MCP verdict for the active MCP
// implementation. It joins the record's servers, read through the frozen
// `recordedMcpServers`, with the frozen `effectiveMcpCompatibility`. When the
// servers cannot be read, the stored verdict stands (MREC-02).
//
// The read writes no file and no state, and it reaches no network (NFR-5): a
// legacy record re-resolves only from the cached manifest and the recorded
// plugin root. This module stays outside BLOCK F's NETWORK_SEAMS.
//
// It imports `recorded-servers.ts`, which imports `install-outcome.ts`, so no
// module that `install-outcome.ts` reaches may import it, or the two close a
// cycle: `plugin/shared.ts`, `plugin-state-classifier.ts`,
// `git-source-probe.ts`, `update-swap.ts`, `update-preflight.ts`,
// `update-row.ts`, and `update-cascade.ts` take the verdict as data instead.

import { effectiveMcpCompatibility } from "../../domain/mcp-implementation.ts";
import {
  createLegacyServersReader,
  recordedMcpServers,
  type LegacyServersReader,
  type LegacyServersSource,
} from "../mcp/recorded-servers.ts";

import type {
  ActiveMcpImplementation,
  EffectiveMcpCompatibility,
  RecordedMcpServers,
} from "../../domain/mcp-implementation.ts";
import type { PluginInstallRecord } from "../../persistence/state-io.ts";

/**
 * A legacy record with no MCP trace staged no server and stored no
 * `mcpServers` kind, so it reads as no servers without loading the manifest.
 * Only a record that left a trace re-resolves its declaration.
 */
function legacyReaderFor(source: LegacyServersSource): LegacyServersReader {
  const reader = createLegacyServersReader(source);
  return (record) =>
    record.resources.mcpServers.length === 0 &&
    !record.compatibility.unsupported.includes("mcpServers")
      ? Promise.resolve({ servers: [], bundle: false })
      : reader(record);
}

/**
 * D-P3-04 / MREC-03: a plugin record's MCP verdict for the active
 * implementation, read offline. `source` names the marketplace record that
 * lists the plugin, which a legacy record re-resolves against. The result
 * also carries the servers the verdict was read from.
 */
export async function readRecordMcpVerdict(
  record: PluginInstallRecord,
  source: LegacyServersSource,
  active: ActiveMcpImplementation,
): Promise<{
  readonly effective: EffectiveMcpCompatibility;
  readonly recorded: RecordedMcpServers;
}> {
  const recorded = await recordedMcpServers(record, legacyReaderFor(source));
  return { effective: effectiveMcpCompatibility(record, recorded, active), recorded };
}

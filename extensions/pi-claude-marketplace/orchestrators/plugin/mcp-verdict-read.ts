// orchestrators/plugin/mcp-verdict-read.ts
//
// D-P3-04: the one read of a plugin record's MCP verdict for the active MCP
// implementation. It joins the record's servers, read through
// `recordedMcpServers`, with `effectiveMcpCompatibility`. When the
// servers cannot be read, the stored verdict stands (MREC-02).
//
// The read writes no file and no state, and it reaches no network (NFR-5): a
// legacy record re-resolves only from the cached manifest and the recorded
// plugin root. This module stays outside BLOCK F's NETWORK_SEAMS.
//
// It imports `recorded-servers.ts`, which imports `install-outcome.ts`, so no
// module that `install-outcome.ts` reaches may import it, or the two close a
// cycle: `plugin/shared.ts`, `plugin-state-classifier.ts`,
// `git-source-probe.ts`, `update-preflight.ts`, `update-row.ts`, and
// `update-cascade.ts` take the verdict as data instead.

import { effectiveMcpCompatibility } from "../../domain/mcp-implementation.ts";
import {
  legacyServersSourceFor,
  readLegacyServers,
  recordedMcpServers,
  type LegacyServersReader,
  type LegacyServersSource,
} from "../mcp/recorded-servers.ts";

import { degradeBaselineOf, recordMcpDependency } from "./mcp-verdict.ts";

import type { RecordDegradeBaselineReader } from "./mcp-verdict.ts";
import type {
  ActiveMcpImplementation,
  EffectiveMcpCompatibility,
  RecordedMcpServers,
} from "../../domain/mcp-implementation.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { McpDependency } from "../../shared/concerns/soft-dep.ts";

/**
 * A legacy record that holds pi-mcp-adapter's verdict (no basis), staged no
 * server, and stored no `mcpServers` kind has no MCP trace: every server the
 * adapter blocks leaves that kind. Such a record reads as no servers without
 * loading the manifest. Any other record re-resolves its declaration, because
 * a neutral verdict does not record a server only one implementation blocks.
 */
const readTracedLegacyServers: LegacyServersReader = (source) => {
  const { record } = source;
  return record.compatibilityBasis === undefined &&
    record.resources.mcpServers.length === 0 &&
    !record.compatibility.unsupported.includes("mcpServers")
    ? Promise.resolve({ servers: [], bundle: false })
    : readLegacyServers(source);
};

/**
 * D-P3-04 / MREC-03: the MCP verdict of `source`'s record for the active
 * implementation, read offline. A legacy record re-resolves against the
 * source's marketplace record, and the record's plugin root must lie inside
 * a clone root of the source's scope (UF-1). The result also carries the
 * servers the verdict was read from.
 */
export async function readRecordMcpVerdict(
  source: LegacyServersSource,
  active: ActiveMcpImplementation,
): Promise<{
  readonly effective: EffectiveMcpCompatibility;
  readonly recorded: RecordedMcpServers;
}> {
  const recorded = await recordedMcpServers(source, readTracedLegacyServers);
  return { effective: effectiveMcpCompatibility(source.record, recorded, active), recorded };
}

/**
 * D-P3-13: the degrade baseline reader for `active`, which reads a record's
 * MCP verdict as `readRecordMcpVerdict` does. `locations` are those of the
 * scope whose state file holds the records it reads (UF-1). The source is
 * built from the marketplace record and plugin name the port receives; the
 * port's record gives only the verdict's basis.
 */
export function recordDegradeBaselineReader(
  active: ActiveMcpImplementation,
  locations: ScopedLocations,
): RecordDegradeBaselineReader {
  return async (record, marketplace, plugin) => {
    const { effective, recorded } = await readRecordMcpVerdict(
      legacyServersSourceFor(locations, marketplace, plugin),
      active,
    );
    return degradeBaselineOf(effective, recorded, record, active);
  };
}

/**
 * D-P3-10 / D-MB-07: the MCP dependency of `source`'s record, read offline
 * from its recorded servers with the same guarded reader as
 * `readRecordMcpVerdict`. An unreadable read keeps the stored adapter reading
 * (P3-DC-24).
 */
export async function readRecordMcpDependency(
  source: LegacyServersSource,
): Promise<McpDependency | false> {
  return recordMcpDependency(
    await recordedMcpServers(source, readTracedLegacyServers),
    source.record,
  );
}

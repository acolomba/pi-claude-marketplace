// bridges/mcp/legacy.ts
//
// The scope's legacy `mcp.json` holds the plugin servers that released builds
// wrote before the bridge moved to `mcp-adapter.json` (AMIG-01, AMIG-02). It is
// Pi's format, so it is read with `PI_MCP_SERVER_KEYS`. An entry belongs to a
// plugin only through its `_piClaudeMarketplace` marker. The presence of
// marked entries is what triggers the move, so no migration flag is stored
// (COMPAT-01).

import { atomicWriteJson } from "../../shared/atomic-json.ts";
import { McpConfigFileError } from "../../shared/errors-bridges.ts";

import {
  PI_MCP_SERVER_KEYS,
  partitionServers,
  readMcpConfigDoc,
  withPluginServers,
  type McpConfigDoc,
} from "./adapter-doc.ts";
import { markerOwnerOf } from "./marker.ts";

import type { LegacyMcpOwner, RemoveLegacyMcpInput, RemoveLegacyMcpResult } from "./types.ts";

/**
 * Reads the legacy file. A non-object top level reads as no document: no
 * entry in it can be marked. Any other `McpConfigFileError` propagates.
 */
async function readLegacyDoc(filePath: string): Promise<McpConfigDoc | undefined> {
  try {
    return await readMcpConfigDoc(filePath, PI_MCP_SERVER_KEYS);
  } catch (err) {
    if (err instanceof McpConfigFileError && err.defect === "top-level-not-object") {
      return undefined;
    }

    throw err;
  }
}

/** Plain code-unit order: no locale, no normalization. */
function codeUnitOrder(left: string, right: string): number {
  return left < right ? -1 : Number(left > right);
}

function compareOwners(left: LegacyMcpOwner, right: LegacyMcpOwner): number {
  return left.marketplace === right.marketplace
    ? codeUnitOrder(left.plugin, right.plugin)
    : codeUnitOrder(left.marketplace, right.marketplace);
}

/**
 * AMIG-01: the owners of the marked entries in a scope's legacy `mcp.json`,
 * sorted by marketplace, then plugin, in code-unit order. Each owner's names
 * keep their file order. A missing or blank file, a non-object top level and
 * an absent `mcpServers` give no owner. Invalid JSONC and a non-object
 * `mcpServers` reject with `McpConfigFileError`.
 */
export async function readLegacyMcpOwners(filePath: string): Promise<readonly LegacyMcpOwner[]> {
  const config = await readLegacyDoc(filePath);
  const servers = config?.serverMaps.get(config.serverKey) ?? {};
  const owners = new Map<string, { plugin: string; marketplace: string; names: string[] }>();
  for (const [name, entry] of Object.entries(servers)) {
    const owner = markerOwnerOf(entry);
    if (owner === undefined) {
      continue;
    }

    const key = JSON.stringify([owner.marketplace, owner.plugin]);
    const group = owners.get(key) ?? { ...owner, names: [] };
    group.names.push(name);
    owners.set(key, group);
  }

  return [...owners.values()].sort(compareOwners);
}

const NOTHING_REMOVED: RemoveLegacyMcpResult = Object.freeze({
  removedNames: Object.freeze([]),
  notices: Object.freeze([]),
  written: Object.freeze([]),
});

/**
 * AMIG-01: removes one plugin's marked entries from the scope's legacy
 * `mcp.json` and keeps every other entry, top-level key and key order. With
 * nothing to remove it writes nothing, so a missing file stays missing.
 * Otherwise the result lists the removed names, a `comments-dropped` notice
 * when the read bytes held comments (AFILE-04), and the bytes written
 * (NFR-3). An unparseable file is left unchanged and reported with a
 * `left-unchanged` notice, so no staging path refuses because of it
 * (AFILE-02).
 */
export async function removeLegacyMcpEntries(
  input: RemoveLegacyMcpInput,
): Promise<RemoveLegacyMcpResult> {
  const { locations, pluginName, marketplaceName } = input;
  let config: McpConfigDoc | undefined;
  try {
    config = await readLegacyDoc(locations.mcpJsonPath);
  } catch (err) {
    if (err instanceof McpConfigFileError) {
      return {
        removedNames: [],
        notices: [{ kind: "left-unchanged", scope: locations.scope, file: "mcp.json" }],
        written: [],
      };
    }

    throw err;
  }

  if (config === undefined) {
    return NOTHING_REMOVED;
  }

  const removedNames = Object.keys(partitionServers(config, pluginName, marketplaceName).ours);
  if (removedNames.length === 0) {
    return NOTHING_REMOVED;
  }

  const bytes = await atomicWriteJson(
    locations.mcpJsonPath,
    withPluginServers(config, pluginName, marketplaceName, {}),
  );
  return {
    removedNames,
    notices: config.hadComments
      ? [{ kind: "comments-dropped", scope: locations.scope, file: "mcp.json" }]
      : [],
    written: [{ path: locations.mcpJsonPath, bytes }],
  };
}

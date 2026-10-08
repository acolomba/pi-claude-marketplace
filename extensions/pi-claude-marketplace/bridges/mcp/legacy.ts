// bridges/mcp/legacy.ts
//
// The scope's legacy `mcp.json` holds the plugin servers that released builds
// wrote before the bridge moved to `mcp-adapter.json` (AMIG-01, AMIG-02). It is
// Pi's format, so it is read with `PI_MCP_SERVER_KEYS`. An entry belongs to a
// plugin only through its `_piClaudeMarketplace` marker. The presence of
// marked entries is what triggers the move, so no migration flag is stored
// (COMPAT-01).
//
// pi-mcp-adapter writes two shapes under a legacy entry's name, and both are
// leftovers once that entry is gone (AMIG-01). Its `/mcp-adapter disable`
// writes an override stub under the server's name into the project
// `mcp-adapter.json`, whatever the server's scope. Its direct-tools toggle
// writes the whole definition plus `directTools` under that name into the same
// scope's `mcp-adapter.json`. The `directTools` key tells the panel's copy from
// a user's own full server under the same name, which is never removed.

import { atomicWriteJson } from "../../shared/atomic-json.ts";
import { McpConfigFileError } from "../../shared/errors-bridges.ts";

import {
  isFullDefinition,
  PI_MCP_SERVER_KEYS,
  partitionServers,
  readMcpConfigDoc,
  withPluginServers,
  type McpConfigDoc,
  type McpServerKey,
} from "./adapter-doc.ts";
import { CLAUDE_MARKETPLACE_MARKER_KEY, markerOwnerOf } from "./marker.ts";
import { safeSet } from "./safe-set.ts";

import type {
  LegacyMcpOwner,
  RawMcpDoc,
  RemoveLegacyMcpInput,
  RemoveLegacyMcpResult,
} from "./types.ts";

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

function ownedNames(
  config: McpConfigDoc,
  pluginName: string,
  marketplaceName: string,
): readonly string[] {
  return Object.keys(partitionServers(config, pluginName, marketplaceName).ours);
}

/**
 * AMIG-01: the plugin's marked keys in the legacy file, in file order. A
 * missing, blank, non-object or unparseable file gives none;
 * `removeLegacyMcpEntries` reports the unparseable case.
 */
export async function readLegacyMcpNames(
  filePath: string,
  pluginName: string,
  marketplaceName: string,
): Promise<readonly string[]> {
  let config: McpConfigDoc | undefined;
  try {
    config = await readLegacyDoc(filePath);
  } catch (err) {
    if (err instanceof McpConfigFileError) {
      return [];
    }

    throw err;
  }

  return config === undefined ? [] : ownedNames(config, pluginName, marketplaceName);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isLeftover(entry: unknown, panelCopies: boolean): boolean {
  if (!isPlainObject(entry) || Object.hasOwn(entry, CLAUDE_MARKETPLACE_MARKER_KEY)) {
    return false;
  }

  return !isFullDefinition(entry) || (panelCopies && Object.hasOwn(entry, "directTools"));
}

/**
 * AMIG-01: the old names, in their order, whose entry in the selected server
 * map is a leftover pi-mcp-adapter wrote: a marker-less override stub, or,
 * with `rule.panelCopies`, a marker-less full definition with an own
 * `directTools` key. An old name among `rule.newKeys` is the plugin's own
 * entry. A non-object entry and a marker-less full definition without
 * `directTools` are never leftovers.
 */
export function leftoverNames(
  config: McpConfigDoc,
  oldNames: readonly string[],
  rule: { readonly newKeys: readonly string[]; readonly panelCopies: boolean },
): readonly string[] {
  const servers = config.serverMaps.get(config.serverKey) ?? {};
  return oldNames.filter(
    (name) =>
      Object.hasOwn(servers, name) &&
      !rule.newKeys.includes(name) &&
      isLeftover(servers[name], rule.panelCopies),
  );
}

/**
 * AMIG-01: a copy of `doc` whose `serverKey` map lacks `names`. Every other
 * key keeps its value and its position, and every copy goes through `safeSet`
 * (WR-01).
 */
export function withoutServers(
  doc: RawMcpDoc,
  serverKey: McpServerKey,
  names: readonly string[],
): RawMcpDoc {
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(doc)) {
    safeSet(next, key, key === serverKey && isPlainObject(value) ? without(value, names) : value);
  }

  return next;
}

function without(
  servers: Readonly<Record<string, unknown>>,
  names: readonly string[],
): Record<string, unknown> {
  const kept: Record<string, unknown> = {};
  for (const [name, entry] of Object.entries(servers)) {
    if (!names.includes(name)) {
      safeSet(kept, name, entry);
    }
  }

  return kept;
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

  const removedNames = ownedNames(config, pluginName, marketplaceName);
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

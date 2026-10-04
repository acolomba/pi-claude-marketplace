// bridges/mcp/adapter-doc.ts
//
// Reads an MCP config file and composes the next document the bridge writes
// back. The read grammar is pi-mcp-adapter 5.0.0's loader grammar by
// construction: the same `strip-json-comments` major with the same options,
// after the same leading-BOM strip (AFILE-02). The server key is the key the
// adapter's disable-writer picks, so entries land where the adapter loads
// them and a user's `mcp-servers` map is never shadowed by a new `mcpServers`
// key (AFILE-03). `isFullDefinition` is the adapter's own transport test, which
// decides whether an entry declares a server or only overrides one (AFILE-05).
// A user override the plugin's entry replaces is kept in that entry's marker;
// when the entry leaves the file, the override is written back in its place
// (AFILE-06, AFILE-01).

import { readFile } from "node:fs/promises";

import stripJsonComments from "strip-json-comments";

import { McpConfigFileError } from "../../shared/errors-bridges.ts";

import { CLAUDE_MARKETPLACE_MARKER_KEY, isOwnedBy, keptOverrideOf } from "./marker.ts";
import { safeSet } from "./safe-set.ts";

import type { RawMcpDoc } from "./types.ts";

/** A top-level key that holds an MCP server map. */
export type McpServerKey = "mcpServers" | "mcp-servers";

/**
 * The server keys pi-mcp-adapter reads, in precedence order: the adapter
 * loads `mcpServers` when present and falls back to `mcp-servers` (AFILE-03).
 */
export const ADAPTER_SERVER_KEYS: readonly [McpServerKey, ...McpServerKey[]] = Object.freeze([
  "mcpServers",
  "mcp-servers",
] as const);

/**
 * The server key Pi's own `mcp.json` files hold. pi-mcp-adapter reads those
 * files with `mcpServers` only (AFILE-05).
 */
export const PI_MCP_SERVER_KEYS: readonly [McpServerKey, ...McpServerKey[]] = Object.freeze([
  "mcpServers",
] as const);

/** One MCP config file as the bridge read it. */
export interface McpConfigDoc {
  /** The parsed top-level object; `{}` for a missing or blank file. */
  readonly doc: RawMcpDoc;
  /** The key new entries go under: the first present key, else the first key. */
  readonly serverKey: McpServerKey;
  /** Each present, object-valued server map, in server-key order. */
  readonly serverMaps: ReadonlyMap<McpServerKey, Readonly<Record<string, unknown>>>;
  /** Whether the bytes held a JSONC comment; trailing commas alone do not count. */
  readonly hadComments: boolean;
}

/** A server map split by MC-5 ownership. */
export interface McpServerPartition {
  /** The plugin's marked entries across every server map; the selected key wins a name clash. */
  readonly ours: Readonly<Record<string, unknown>>;
  /**
   * Marker-less entries under the selected key that define no transport: user
   * overrides such as a `/mcp-adapter disable` stub. A staged entry absorbs
   * one: its carried fields become active and the whole override is kept in
   * the new entry's marker (AFILE-06).
   */
  readonly overlays: Readonly<Record<string, unknown>>;
  /**
   * Every other entry under the selected key, the one the adapter loads:
   * marker-less full definitions and entries marked for another plugin.
   */
  readonly theirs: Readonly<Record<string, unknown>>;
  /**
   * For each of the plugin's own entries under the selected key, the override
   * its marker keeps, while that is still an override. The restaged entry
   * carries it (AFILE-06).
   */
  readonly keptOverrides: Readonly<Record<string, unknown>>;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Reports whether an entry is a full server definition: a plain object whose
 * `command`, `url` or `socket` is a string. This is the transport test
 * pi-mcp-adapter's `mergeServerMaps` applies; any other entry only overrides
 * fields of a lower definition, so it declares no server (AFILE-05).
 */
export function isFullDefinition(entry: unknown): boolean {
  return (
    isPlainObject(entry) &&
    (typeof entry.command === "string" ||
      typeof entry.url === "string" ||
      typeof entry.socket === "string")
  );
}

function isOverlay(entry: unknown): boolean {
  return (
    isPlainObject(entry) &&
    !Object.hasOwn(entry, CLAUDE_MARKETPLACE_MARKER_KEY) &&
    !isFullDefinition(entry)
  );
}

/**
 * The override an entry's marker keeps, when it is still an override. A
 * written-back override is therefore always a partial entry, never a full
 * definition or a marked entry (AFILE-05).
 */
function restorableOverride(entry: unknown): Readonly<Record<string, unknown>> | undefined {
  const kept = keptOverrideOf(entry);
  return isOverlay(kept) ? kept : undefined;
}

function emptyConfig(serverKey: McpServerKey, hadComments: boolean): McpConfigDoc {
  return { doc: {}, serverKey, serverMaps: new Map(), hadComments };
}

async function readOptionalText(filePath: string): Promise<string | undefined> {
  try {
    return await readFile(filePath, "utf8");
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "ENOTDIR") {
      return undefined;
    }

    throw err;
  }
}

function parseJsonc(filePath: string, stripped: string): unknown {
  try {
    return JSON.parse(stripped) as unknown;
  } catch {
    // AFILE-02: the parser message can quote file content, so it is dropped.
    throw new McpConfigFileError(filePath, "invalid-jsonc");
  }
}

function collectServerMaps(
  filePath: string,
  doc: Readonly<Record<string, unknown>>,
  serverKeys: readonly McpServerKey[],
): Map<McpServerKey, Readonly<Record<string, unknown>>> {
  const serverMaps = new Map<McpServerKey, Readonly<Record<string, unknown>>>();
  for (const key of serverKeys) {
    if (!Object.hasOwn(doc, key)) {
      continue;
    }

    const servers = doc[key];
    if (!isPlainObject(servers)) {
      throw new McpConfigFileError(filePath, `${key}-not-object`);
    }

    serverMaps.set(key, servers);
  }

  return serverMaps;
}

/**
 * Reads an MCP config file with pi-mcp-adapter's grammar (AFILE-02). A missing
 * file, or one that is blank after comments are stripped, reads as the empty
 * document. Throws `McpConfigFileError` for invalid JSONC, a non-object top
 * level, or a present server key whose value is not an object. Other read
 * errors propagate unchanged.
 */
export async function readMcpConfigDoc(
  filePath: string,
  serverKeys: readonly [McpServerKey, ...McpServerKey[]],
): Promise<McpConfigDoc> {
  const text = await readOptionalText(filePath);
  if (text === undefined) {
    return emptyConfig(serverKeys[0], false);
  }

  const body = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const hadComments = stripJsonComments(body) !== body;
  const stripped = stripJsonComments(body, { trailingCommas: true });
  if (stripped.trim() === "") {
    return emptyConfig(serverKeys[0], hadComments);
  }

  const parsed = parseJsonc(filePath, stripped);
  if (!isPlainObject(parsed)) {
    throw new McpConfigFileError(filePath, "top-level-not-object");
  }

  const serverMaps = collectServerMaps(filePath, parsed, serverKeys);
  const serverKey = serverKeys.find((key) => parsed[key] !== undefined) ?? serverKeys[0];
  return { doc: parsed, serverKey, serverMaps, hadComments };
}

function selectedKeyFirst(config: McpConfigDoc): Array<Readonly<Record<string, unknown>>> {
  const others = [...config.serverMaps]
    .filter(([key]) => key !== config.serverKey)
    .map(([, servers]) => servers);
  const selected = config.serverMaps.get(config.serverKey);
  return selected === undefined ? others : [selected, ...others];
}

/** The plugin's marked entries across every server map; the selected key wins a name clash. */
function ownedServers(
  config: McpConfigDoc,
  pluginName: string,
  marketplaceName: string,
): Record<string, unknown> {
  const ours: Record<string, unknown> = {};
  for (const servers of selectedKeyFirst(config)) {
    for (const [name, entry] of Object.entries(servers)) {
      if (isOwnedBy(entry, pluginName, marketplaceName) && !Object.hasOwn(ours, name)) {
        safeSet(ours, name, entry);
      }
    }
  }

  return ours;
}

/** The restorable override of each of the plugin's entries under the selected key. */
function keptOverridesOf(
  selected: Readonly<Record<string, unknown>>,
  pluginName: string,
  marketplaceName: string,
): Record<string, unknown> {
  const keptOverrides: Record<string, unknown> = {};
  for (const [name, entry] of Object.entries(selected)) {
    const override = isOwnedBy(entry, pluginName, marketplaceName)
      ? restorableOverride(entry)
      : undefined;
    if (override !== undefined) {
      safeSet(keptOverrides, name, override);
    }
  }

  return keptOverrides;
}

/**
 * Splits a config's servers by the `(plugin, marketplace)` marker (MC-5).
 * Every copy goes through `safeSet`, so a server named `__proto__` stays an
 * own entry (WR-01).
 */
export function partitionServers(
  config: McpConfigDoc,
  pluginName: string,
  marketplaceName: string,
): McpServerPartition {
  const overlays: Record<string, unknown> = {};
  const theirs: Record<string, unknown> = {};
  const selected = config.serverMaps.get(config.serverKey) ?? {};
  for (const [name, entry] of Object.entries(selected)) {
    if (!isOwnedBy(entry, pluginName, marketplaceName)) {
      safeSet(isOverlay(entry) ? overlays : theirs, name, entry);
    }
  }

  return {
    ours: ownedServers(config, pluginName, marketplaceName),
    overlays,
    theirs,
    keptOverrides: keptOverridesOf(selected, pluginName, marketplaceName),
  };
}

/**
 * AFILE-01 / AFILE-06: the server names of the plugin's own entries whose
 * kept override an unstage writes back, which is what
 * `withPluginServers(config, pluginName, marketplaceName, {})` does. The
 * selected key comes first, each map in file order, and a name appears once.
 * The same `restorableOverride` test decides both, so the names and the
 * write-back agree on which kept values are still overrides.
 */
export function restoredOverrideNames(
  config: McpConfigDoc,
  pluginName: string,
  marketplaceName: string,
): readonly string[] {
  const names = new Set<string>();
  for (const servers of selectedKeyFirst(config)) {
    for (const [name, entry] of Object.entries(servers)) {
      if (
        isOwnedBy(entry, pluginName, marketplaceName) &&
        restorableOverride(entry) !== undefined
      ) {
        names.add(name);
      }
    }
  }

  return Object.freeze([...names]);
}

/**
 * What one existing entry leaves in its place: itself, the override its
 * marker keeps, or nothing. A name in `replaced` is restaged in this map, so
 * the new entry carries the plugin's kept override and absorbs an overlay.
 */
function survivingEntry(
  name: string,
  entry: unknown,
  owner: { readonly pluginName: string; readonly marketplaceName: string },
  replaced: Readonly<Record<string, unknown>>,
): unknown {
  const restaged = Object.hasOwn(replaced, name);
  if (isOwnedBy(entry, owner.pluginName, owner.marketplaceName)) {
    return restaged ? undefined : restorableOverride(entry);
  }

  return restaged && isOverlay(entry) ? undefined : entry;
}

/**
 * Keeps the entries the plugin does not own, in order. The plugin's entry
 * under a name not in `replaced` is written back in place as the override
 * its marker keeps, or dropped when it keeps none (AFILE-01, AFILE-06). An
 * overlay under a name in `replaced` is dropped, so the staged entry takes
 * its place.
 */
function keptServers(
  servers: Readonly<Record<string, unknown>>,
  pluginName: string,
  marketplaceName: string,
  replaced: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const kept: Record<string, unknown> = {};
  for (const [name, entry] of Object.entries(servers)) {
    const surviving = survivingEntry(name, entry, { pluginName, marketplaceName }, replaced);
    if (surviving !== undefined) {
      safeSet(kept, name, surviving);
    }
  }

  return kept;
}

/**
 * Composes the next document: the plugin's marked entries leave every server
 * map, and `entries` follow the kept entries of the selected key, in their
 * own order. A marked entry whose name is not restaged in its map writes back
 * the override its marker keeps, in the entry's position; one that keeps none
 * is removed (AFILE-01, AFILE-06). An overlay under the selected key that
 * shares a name with an entry is dropped, so the entry replaces it and keeps
 * it in its marker (AFILE-05, AFILE-06). Every existing
 * top-level key keeps its position. The selected key is added only when it is
 * absent and `entries` is non-empty, so no empty server map is introduced
 * (AFILE-01, AFILE-03).
 */
export function withPluginServers(
  config: McpConfigDoc,
  pluginName: string,
  marketplaceName: string,
  entries: Readonly<Record<string, unknown>>,
): RawMcpDoc {
  const next: Record<string, unknown> = { ...config.doc };
  let selected: Record<string, unknown> | undefined;
  for (const [key, servers] of config.serverMaps) {
    const isSelected = key === config.serverKey;
    const kept = keptServers(servers, pluginName, marketplaceName, isSelected ? entries : {});
    next[key] = kept;
    if (isSelected) {
      selected = kept;
    }
  }

  if (selected === undefined && Object.keys(entries).length === 0) {
    return next;
  }

  const target = selected ?? {};
  for (const [name, entry] of Object.entries(entries)) {
    safeSet(target, name, entry);
  }

  next[config.serverKey] = target;
  return next;
}

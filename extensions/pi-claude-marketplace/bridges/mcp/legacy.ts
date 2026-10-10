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
// a user's own full server under the same name, which is never removed. A
// leftover whose name another config source still defines in full applies to
// that live server, so it is the user's setting and is never removed either.
//
// A stage removes the leftovers in its own scope's file only. The project
// file's disable stubs of a user-scope plugin are removed by the reload move
// through `removeProjectDisableStubs`, under the project-scope lock that every
// project-scope writer of that file holds.

import { locationsFor } from "../../persistence/locations.ts";
import { atomicWriteJson } from "../../shared/atomic-json.ts";
import { McpConfigFileError } from "../../shared/errors-bridges.ts";

import {
  ADAPTER_SERVER_KEYS,
  isFullDefinition,
  PI_MCP_SERVER_KEYS,
  partitionServers,
  readMcpConfigDoc,
  withPluginServers,
  type McpConfigDoc,
  type McpServerKey,
} from "./adapter-doc.ts";
import { walkMcpSources, type McpSourceDeclaration } from "./collision-slots.ts";
import {
  CLAUDE_MARKETPLACE_MARKER_KEY,
  isOwnedBy,
  isPlainObject,
  markerOwnerOf,
} from "./marker.ts";
import { safeSet } from "./safe-set.ts";

import type {
  LegacyMcpOwner,
  McpLeftoverPlace,
  ProjectDisableStubOwner,
  RawMcpDoc,
  RemoveLegacyMcpInput,
  RemoveLegacyMcpResult,
} from "./types.ts";
import type { McpConfigNotice } from "../../shared/notification-dispatch.ts";

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

/**
 * AMIG-01: resolves when the scope's `mcp-adapter.json` is missing or a valid
 * adapter config, and rejects with `McpConfigFileError` for invalid JSONC, a
 * non-object top level or a non-object server map, so the reload move can
 * leave a scope alone before it writes anything there.
 */
export async function checkMcpAdapterConfig(filePath: string): Promise<void> {
  await readMcpConfigDoc(filePath, ADAPTER_SERVER_KEYS);
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

/**
 * Whether a full definition still runs once the move is done: it sits outside
 * the leftover's own file, and it is not one of the plugin's marked entries
 * in the legacy file, which the move removes.
 */
function staysLive(declaration: McpSourceDeclaration, place: McpLeftoverPlace): boolean {
  if (declaration.sourcePath === place.leftoverPath) {
    return false;
  }

  return !(
    declaration.sourcePath === place.legacyPath &&
    isOwnedBy(declaration.entry, place.pluginName, place.marketplaceName)
  );
}

/**
 * AMIG-01: the names among `names` that no pi-mcp-adapter config source
 * still defines in full after the move (`staysLive`). A leftover under a
 * name another source defines applies to that live server, for example the
 * user's `/mcp-adapter disable` of it, so it is kept. With no name it reads
 * no source.
 */
export async function namesWithNoLiveServer(
  cwd: string,
  names: readonly string[],
  place: McpLeftoverPlace,
): Promise<readonly string[]> {
  if (names.length === 0) {
    return names;
  }

  const walk = await walkMcpSources(cwd);
  return names.filter(
    (name) =>
      !(walk.declarations.get(name) ?? []).some((declaration) => staysLive(declaration, place)),
  );
}

/** The project `mcp-adapter.json`, or undefined when it is not a valid MCP config. */
async function readProjectAdapter(filePath: string): Promise<McpConfigDoc | undefined> {
  try {
    return await readMcpConfigDoc(filePath, ADAPTER_SERVER_KEYS);
  } catch (err) {
    if (err instanceof McpConfigFileError) {
      return undefined;
    }

    throw err;
  }
}

/**
 * The owner's old names whose project-file entry is an override stub that
 * applies to no live server once the owner's user-scope legacy entries go.
 */
function projectStubNames(
  cwd: string,
  config: McpConfigDoc,
  owner: ProjectDisableStubOwner,
): Promise<readonly string[]> {
  return namesWithNoLiveServer(
    cwd,
    leftoverNames(config, owner.names, { newKeys: [], panelCopies: false }),
    {
      leftoverPath: locationsFor("project", cwd).mcpAdapterJsonPath,
      legacyPath: locationsFor("user", cwd).mcpJsonPath,
      pluginName: owner.pluginName,
      marketplaceName: owner.marketplaceName,
    },
  );
}

/**
 * AMIG-01: the owner's old names that hold an override stub in the project
 * `mcp-adapter.json` and name no live server, read without writing. A
 * missing file, or one that is not a valid MCP config, gives none. Any other
 * read error rejects.
 */
export async function projectDisableStubNames(
  cwd: string,
  owner: ProjectDisableStubOwner,
): Promise<readonly string[]> {
  const config = await readProjectAdapter(locationsFor("project", cwd).mcpAdapterJsonPath);
  return config === undefined ? [] : projectStubNames(cwd, config, owner);
}

/**
 * AMIG-01: removes the override stubs under the owners' old names from the
 * project `mcp-adapter.json`, where `/mcp-adapter disable` writes them
 * whatever the server's scope, unless another source still defines the name
 * (`namesWithNoLiveServer`). Every other entry, top-level key and key order
 * is kept, and a file with no such stub, or not a valid MCP config, is not
 * written. The caller holds the project-scope lock, under which
 * project-scope commands rewrite this file. Returns a `comments-dropped`
 * notice when the rewritten bytes held comments (AFILE-04), then one
 * `leftover-removed` notice per removed stub, in owner order.
 */
export async function removeProjectDisableStubs(
  cwd: string,
  owners: readonly ProjectDisableStubOwner[],
): Promise<readonly McpConfigNotice[]> {
  const filePath = locationsFor("project", cwd).mcpAdapterJsonPath;
  const config = await readProjectAdapter(filePath);
  if (config === undefined) {
    return [];
  }

  const perOwner = await Promise.all(
    owners.map(async (owner) =>
      (await projectStubNames(cwd, config, owner)).map((server) => ({
        plugin: owner.pluginName,
        server,
      })),
    ),
  );
  const removed = perOwner.flat();
  if (removed.length === 0) {
    return [];
  }

  await atomicWriteJson(
    filePath,
    withoutServers(
      config.doc,
      config.serverKey,
      removed.map(({ server }) => server),
    ),
  );
  return [
    ...(config.hadComments
      ? [{ kind: "comments-dropped", scope: "project", file: "mcp-adapter.json" } as const]
      : []),
    ...removed.map(
      ({ plugin, server }) =>
        ({
          kind: "leftover-removed",
          scope: "project",
          file: "mcp-adapter.json",
          plugin,
          server,
        }) as const,
    ),
  ];
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

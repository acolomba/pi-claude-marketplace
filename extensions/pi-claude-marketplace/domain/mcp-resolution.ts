// domain/mcp-resolution.ts
//
// D-CF6-01: a plugin's MCP servers are the ordered union of its sources, as
// Claude Code 2.1.316 merges them. `<pluginRoot>/.mcp.json` comes first, then
// the declared `mcpServers` value: the plugin manifest's, or the marketplace
// entry's when the plugin has no `plugin.json`. A declared value is a
// reference string, an inline server map, or an array of both, read in
// order. A server name that a later source declares replaces the earlier
// server and keeps its position, as object spread does upstream.

import path from "node:path";

import { errorMessage } from "../shared/errors.ts";

import { resolveContainedComponentPath } from "./component-paths.ts";
import { MCP_SERVERS_VALIDATOR } from "./components/mcp.ts";
import { classifyMcpServer } from "./mcp-server-features.ts";

import type { DroppedMcpServer, McpUnsupportedFeature } from "./mcp-server-features.ts";
import type { StatKindReader } from "./resolver-types.ts";

/** Mutable resolver fields owned by MCP resolution. */
export interface McpResolution {
  notes: string[];
  unsupported: string[];
  mcpServers: Record<string, unknown>;
  droppedMcpServers?: DroppedMcpServer[];
}

interface McpResolutionDependencies {
  readonly statKind: StatKindReader;
  readonly readFileText: (path: string) => Promise<string>;
}

// A merged server and the feature that blocks it, if one does.
interface MergedServer {
  readonly config: unknown;
  readonly blockedBy?: McpUnsupportedFeature;
}

// The merge in progress: `servers` keeps the first position of each name,
// because `Map.set` replaces a value in place.
interface McpMerge {
  readonly pluginRoot: string;
  readonly resolution: McpResolution;
  readonly dependencies: McpResolutionDependencies;
  readonly servers: Map<string, MergedServer>;
  bundle: boolean;
  dirty: boolean;
}

function isPlainObject(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// D-CF6-01: Claude Code bundles MCP servers as `.mcpb` (or legacy `.dxt`)
// archives that it unpacks and runs. pi-mcp-adapter has no bundle runner.
function isMcpBundle(reference: string): boolean {
  return reference.endsWith(".mcpb") || reference.endsWith(".dxt");
}

function addDefect(merge: McpMerge, note: string): void {
  merge.resolution.notes.push(note);
  merge.dirty = true;
}

/**
 * Merges each server of one source map. A malformed server adds a note and
 * reports a structural defect (ANAME-07, D-64-07). A blocked server stays in
 * the merge, so a later source can replace it with a supported one.
 */
function mergeServers(merge: McpMerge, servers: Readonly<Record<string, unknown>>): void {
  for (const [server, config] of Object.entries(servers)) {
    const verdict = classifyMcpServer(config);
    if (verdict.kind === "malformed") {
      addDefect(merge, `malformed mcp server "${server}": ${verdict.detail}`);
    } else {
      merge.servers.set(
        server,
        verdict.kind === "blocked" ? { config, blockedBy: verdict.feature } : { config },
      );
    }
  }
}

function mergeServerMap(merge: McpMerge, value: unknown): void {
  if (MCP_SERVERS_VALIDATOR.Check(value)) {
    mergeServers(merge, value);
    return;
  }

  const errorDetail = MCP_SERVERS_VALIDATOR.Errors(value)
    .slice(0, 1)
    .map((error) => error.message)
    .join("");
  addDefect(merge, `malformed mcpServers: ${errorDetail}`);
}

// D-CF6-01: a file holds its server map under `mcpServers` or as the whole
// document, for `.mcp.json` and a referenced file alike.
function fileServerMap(document: unknown): unknown {
  return isPlainObject(document) && Object.hasOwn(document, "mcpServers")
    ? document.mcpServers
    : document;
}

// Read failures (e.g. EACCES) retain their identity for the outer probe
// classifier; only JSON.parse failing is a malformed source.
async function readJsonFile(
  merge: McpMerge,
  absolutePath: string,
  invalidJsonNote: (detail: string) => string,
): Promise<void> {
  const text = await merge.dependencies.readFileText(absolutePath);
  let document: unknown;
  try {
    document = JSON.parse(text);
  } catch (error: unknown) {
    addDefect(merge, invalidJsonNote(errorMessage(error)));
    return;
  }

  mergeServerMap(merge, fileServerMap(document));
}

async function readStandaloneMcp(merge: McpMerge): Promise<void> {
  const mcpPath = path.join(merge.pluginRoot, ".mcp.json");
  if ((await merge.dependencies.statKind(mcpPath)) !== "file") {
    return;
  }

  await readJsonFile(merge, mcpPath, (detail) => `malformed mcpServers (.mcp.json): ${detail}`);
}

async function validateReferencePath(
  raw: string,
  pluginRoot: string,
): Promise<{ ok: true; absolutePath: string } | { ok: false; reason: string }> {
  const contained = await resolveContainedComponentPath(pluginRoot, raw, "mcpServers reference");
  if (!contained.ok && contained.cause === "absolute") {
    return {
      ok: false,
      reason: `malformed mcp reference: must be relative (got absolute "${raw}")`,
    };
  }

  if (!contained.ok) {
    return { ok: false, reason: `malformed mcp reference: escapes plugin root: "${raw}"` };
  }

  return contained;
}

/**
 * Reads a reference string. Containment runs before any read, so an absolute
 * or escaping reference is never read (T-06-07). A bundle is never read
 * either: it makes the plugin partially available. A reference without a
 * leading `./` still resolves from the plugin root, where Claude Code
 * refuses the manifest (a residual kept under D-CF6-01).
 */
async function readReferencedMcp(merge: McpMerge, raw: string): Promise<void> {
  const validated = await validateReferencePath(raw, merge.pluginRoot);
  if (!validated.ok) {
    addDefect(merge, validated.reason);
    return;
  }

  if (isMcpBundle(raw)) {
    merge.bundle = true;
    return;
  }

  if ((await merge.dependencies.statKind(validated.absolutePath)) !== "file") {
    addDefect(merge, `malformed mcp reference: file not found: "${raw}"`);
    return;
  }

  await readJsonFile(
    merge,
    validated.absolutePath,
    (detail) => `malformed mcp reference: invalid JSON in "${raw}": ${detail}`,
  );
}

// An array is read element by element in order. An element that is neither
// a reference string nor a server map refuses the whole array with one note.
async function readMcpArray(merge: McpMerge, sources: readonly unknown[]): Promise<void> {
  const invalid = sources.findIndex(
    (source) => typeof source !== "string" && !MCP_SERVERS_VALIDATOR.Check(source),
  );
  if (invalid !== -1) {
    mergeServerMap(merge, sources[invalid]);
    return;
  }

  for (const source of sources) {
    if (typeof source === "string") {
      // eslint-disable-next-line no-await-in-loop -- D-CF6-01: a later source replaces an earlier one, so the sources merge in order
      await readReferencedMcp(merge, source);
    } else {
      mergeServerMap(merge, source);
    }
  }
}

async function readDeclaredMcp(merge: McpMerge, declared: unknown): Promise<void> {
  if (declared === undefined) {
    return;
  }

  if (typeof declared === "string") {
    await readReferencedMcp(merge, declared);
    return;
  }

  if (Array.isArray(declared)) {
    await readMcpArray(merge, declared);
    return;
  }

  mergeServerMap(merge, declared);
}

/**
 * Keeps the supported merged servers in merge order and leaves out each
 * blocked one whole. The typed `mcpServers` kind is the only reason a blocked
 * server or a bundle gets, as `hooks` is for a dropped hook handler
 * (ANAME-07).
 */
function recordMergedServers(merge: McpMerge): void {
  const supported: [string, unknown][] = [];
  const dropped: DroppedMcpServer[] = [];
  for (const [server, { config, blockedBy }] of merge.servers) {
    if (blockedBy === undefined) {
      supported.push([server, config]);
    } else {
      dropped.push({ server, feature: blockedBy });
    }
  }

  // `Object.fromEntries` defines own properties, so a server named
  // `__proto__` stays a server.
  merge.resolution.mcpServers = Object.fromEntries(supported);
  if (dropped.length > 0 || merge.bundle) {
    merge.resolution.unsupported.push("mcpServers");
  }

  if (dropped.length > 0) {
    merge.resolution.droppedMcpServers = dropped;
  }
}

/**
 * Resolves a plugin's MCP servers as the ordered union of its sources
 * (D-CF6-01), and reports whether any source has a structural defect. The
 * entry's `mcpServers` counts only when the plugin has no `plugin.json`
 * (`manifest` is `null`), because Claude Code then reads the entry as the
 * manifest.
 */
export async function resolveStrictMcp(
  input: {
    readonly entry: { readonly mcpServers?: unknown };
    readonly manifest: { readonly mcpServers?: unknown } | null;
    readonly pluginRoot: string;
    readonly resolution: McpResolution;
  },
  dependencies: {
    readonly statKind: StatKindReader;
    readonly readFileText: (path: string) => Promise<string>;
  },
): Promise<boolean> {
  const merge: McpMerge = {
    pluginRoot: input.pluginRoot,
    resolution: input.resolution,
    dependencies,
    servers: new Map(),
    bundle: false,
    dirty: false,
  };

  await readStandaloneMcp(merge);
  await readDeclaredMcp(
    merge,
    input.manifest === null ? input.entry.mcpServers : input.manifest.mcpServers,
  );
  recordMergedServers(merge);

  return merge.dirty;
}

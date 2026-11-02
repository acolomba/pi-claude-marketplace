// domain/mcp-resolution.ts
//
// D-CF6-01: a plugin's MCP servers are the ordered union of its sources, as
// Claude Code 2.1.316 merges them. `<pluginRoot>/.mcp.json` comes first, then
// the declared `mcpServers` value: the plugin manifest's, or the marketplace
// entry's when the plugin has no `plugin.json`. A declared value is a
// reference string, an inline server map, or an array of both, read in
// order. A server name that a later source declares replaces the earlier
// server and keeps its position, as object spread does upstream.
//
// D-CF6-02: a defect in a file source makes that file, or that one server,
// contribute nothing, silently, as Claude Code's loader drops it. A defect
// written inline, or a reference that is absolute or leaves the plugin root,
// refuses the plugin, as Claude Code refuses that manifest. A reference link
// whose real target leaves the plugin root is refused too (MCPR-04).

import path from "node:path";

import { hookDebugLog } from "../shared/debug-log.ts";
import { errorMessage, isErrnoException } from "../shared/errors.ts";

import { MCP_SERVER_MAP_VALIDATOR } from "./components/mcp.ts";
import { copyManifestBoundary, locateManifestCandidate } from "./manifest-containment.ts";
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

// D-CF6-02: Claude Code's loader logs what it skips in a file at debug level
// only, so a skip reaches the env-gated debug channel and no notification.
function logFileSkip(merge: McpMerge, file: string, detail: string): void {
  hookDebugLog(`${file} of ${merge.pluginRoot}: skipped ${detail}`, "mcp");
}

type MalformedServerHandler = (server: string, detail: string) => void;

/**
 * Merges each server of one source map. `onMalformed` decides what a
 * malformed server means for its source. A blocked server stays in the
 * merge, so a later source can replace it with a supported one (ANAME-07).
 */
function mergeServers(
  merge: McpMerge,
  servers: Readonly<Record<string, unknown>>,
  onMalformed: MalformedServerHandler,
): void {
  for (const [server, config] of Object.entries(servers)) {
    const verdict = classifyMcpServer(config);
    if (verdict.kind === "malformed") {
      onMalformed(server, verdict.detail);
    } else {
      merge.servers.set(
        server,
        verdict.kind === "blocked" ? { config, blockedBy: verdict.feature } : { config },
      );
    }
  }
}

/**
 * Merges a server map written inline in the manifest or the marketplace
 * entry. Claude Code refuses a manifest whose inline map, or any server in
 * it, fails its schema, so each defect adds a note and reports a structural
 * defect (D-CF6-02, D-64-07).
 */
function mergeServerMap(merge: McpMerge, value: unknown): void {
  if (MCP_SERVER_MAP_VALIDATOR.Check(value)) {
    mergeServers(merge, value, (server, detail) => {
      addDefect(merge, `malformed mcp server "${server}": ${detail}`);
    });
    return;
  }

  const errorDetail = MCP_SERVER_MAP_VALIDATOR.Errors(value)
    .slice(0, 1)
    .map((error) => error.message)
    .join("");
  addDefect(merge, `malformed mcpServers: ${errorDetail}`);
}

/**
 * Returns the message of a file-system failure, which makes a file source
 * contribute nothing (D-CF6-02), and rethrows anything else. Claude Code
 * 2.1.316's loader returns no servers for every failure of its file read,
 * transient ones such as `EMFILE` and `EIO` included. Node gives each such
 * failure a `code`, a POSIX name such as `ENOENT` or an `ERR_` name for a
 * path it refuses. A throw without one, such as a `TypeError` from a defect
 * here or a non-`Error` value, propagates.
 */
function fileSystemFailureDetail(error: unknown): string {
  if (isErrnoException(error)) {
    return error.message;
  }

  throw error;
}

// D-CF6-01: a file holds its server map under `mcpServers` or as the whole
// document, for `.mcp.json` and a referenced file alike.
function fileServerMap(document: unknown): unknown {
  return isPlainObject(document) && Object.hasOwn(document, "mcpServers")
    ? document.mcpServers
    : document;
}

/**
 * Returns the text of one file source, or `undefined` when it is missing,
 * is not a regular file, or fails to read with a file-system error
 * (D-CF6-02).
 */
async function readServerFileText(
  merge: McpMerge,
  absolutePath: string,
  file: string,
): Promise<string | undefined> {
  try {
    if ((await merge.dependencies.statKind(absolutePath)) !== "file") {
      return undefined;
    }

    return await merge.dependencies.readFileText(absolutePath);
  } catch (error: unknown) {
    logFileSkip(merge, file, `the file: ${fileSystemFailureDetail(error)}`);
    return undefined;
  }
}

/**
 * Merges the servers of one file, `.mcp.json` or a referenced one, as
 * Claude Code's loader reads it (D-CF6-02). A missing file contributes no
 * servers. So does a file that cannot be read or parsed, or that holds no
 * server map, and a malformed server inside a file is dropped before the
 * merge, so it never replaces an earlier server of its name. None of these
 * adds a note.
 */
async function mergeServerFile(merge: McpMerge, absolutePath: string, file: string): Promise<void> {
  const text = await readServerFileText(merge, absolutePath, file);
  if (text === undefined) {
    return;
  }

  let document: unknown;
  try {
    document = JSON.parse(text);
  } catch (error: unknown) {
    // `JSON.parse` of a string throws only a `SyntaxError`.
    logFileSkip(merge, file, `the file: ${errorMessage(error)}`);
    return;
  }

  const servers = fileServerMap(document);
  if (!MCP_SERVER_MAP_VALIDATOR.Check(servers)) {
    logFileSkip(merge, file, "the file: it holds no server map");
    return;
  }

  mergeServers(merge, servers, (server, detail) => {
    logFileSkip(merge, file, `the server "${server}": ${detail}`);
  });
}

// Where a reference string points. Claude Code refuses a manifest whose
// reference is absolute or leaves the plugin root (D-CF6-02). A reference
// whose path walk fails with a file-system error, such as one through a
// regular file, names a file the loader cannot read.
type LocatedReference =
  | { readonly kind: "inside"; readonly absolutePath: string }
  | { readonly kind: "refused"; readonly note: string }
  | { readonly kind: "unreachable"; readonly detail: string };

function isLexicallyOutside(pluginRoot: string, absolutePath: string): boolean {
  const relative = path.relative(pluginRoot, absolutePath);
  return relative === ".." || relative.startsWith(`..${path.sep}`);
}

/**
 * Locates a reference string inside the plugin root. A reference that
 * crosses a symbolic link is read when the link's real target lies inside
 * the plugin root, as Claude Code 2.1.316 reads it (MCPR-04, amended by the
 * user decision of 2026-11-02). A real target outside the plugin root is
 * refused, where Claude Code would read it.
 *
 * The link rule is the D-PL2-24 manifest locator over a boundary of the
 * plugin root alone. It opens the resolved target, never the spelled link,
 * and its containment walk re-checks that target after the resolution, so
 * a link swapped after the resolution cannot redirect the read. The window
 * between that walk and the read is the one `createPathSafetyGuard`
 * accepts. A dangling link names a missing file, which contributes nothing
 * (D-CF6-02).
 */
async function locateReference(raw: string, pluginRoot: string): Promise<LocatedReference> {
  if (path.isAbsolute(raw)) {
    return {
      kind: "refused",
      note: `malformed mcp reference: must be relative (got absolute "${raw}")`,
    };
  }

  const spelled = path.resolve(pluginRoot, raw);
  if (isLexicallyOutside(pluginRoot, spelled)) {
    return { kind: "refused", note: `malformed mcp reference: escapes plugin root: "${raw}"` };
  }

  const location = await locateManifestCandidate(copyManifestBoundary(pluginRoot), spelled);
  switch (location.kind) {
    case "open":
      return { kind: "inside", absolutePath: location.path };
    case "absent":
      return { kind: "unreachable", detail: "its symbolic link is dangling" };
    case "escapes":
      return {
        kind: "refused",
        note: `malformed mcp reference: symbolic link resolves outside plugin root: "${raw}"`,
      };
    case "unresolvable":
      return { kind: "unreachable", detail: fileSystemFailureDetail(location.error) };
  }
}

/**
 * Reads a reference string. Containment runs before any read, so an absolute
 * or escaping reference, and a link whose real target leaves the plugin
 * root, is never read (T-06-07). A bundle is never read
 * either: it makes the plugin partially available. A reference without a
 * leading `./` still resolves from the plugin root, where Claude Code
 * refuses the manifest (a residual kept under D-CF6-01).
 */
async function readReferencedMcp(merge: McpMerge, raw: string): Promise<void> {
  const located = await locateReference(raw, merge.pluginRoot);
  if (located.kind === "refused") {
    addDefect(merge, located.note);
    return;
  }

  if (located.kind === "unreachable") {
    logFileSkip(merge, raw, `the file: ${located.detail}`);
    return;
  }

  if (isMcpBundle(raw)) {
    merge.bundle = true;
    return;
  }

  await mergeServerFile(merge, located.absolutePath, raw);
}

// An array is read element by element in order. An element that is neither
// a reference string nor a server map refuses the whole array with one note.
async function readMcpArray(merge: McpMerge, sources: readonly unknown[]): Promise<void> {
  const invalid = sources.findIndex(
    (source) => typeof source !== "string" && !MCP_SERVER_MAP_VALIDATOR.Check(source),
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
 * (D-CF6-01), and reports whether an inline declaration or a reference path
 * has a structural defect; a file source's defect is no such defect
 * (D-CF6-02). The
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

  // The root file is read through a link, wherever the link points, as
  // Claude Code 2.1.316 reads it. Only a reference is held to containment
  // (T-06-07, MCPR-04).
  await mergeServerFile(merge, path.join(merge.pluginRoot, ".mcp.json"), ".mcp.json");
  await readDeclaredMcp(
    merge,
    input.manifest === null ? input.entry.mcpServers : input.manifest.mcpServers,
  );
  recordMergedServers(merge);

  return merge.dirty;
}

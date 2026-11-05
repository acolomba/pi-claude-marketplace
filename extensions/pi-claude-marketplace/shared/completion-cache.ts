// shared/completion-cache.ts
//
// D-03 two-tier (in-memory + file-backed) completion cache. Lives in shared/
// because both edge/ (read path) and orchestrators/ (invalidation path) must
// reach it, and the D-v1.0-01-11 import boundary keeps edge/ from importing
// persistence/ (where state-io / locations live). shared/ is the only home
// that satisfies BOTH directions.
//
// shared/ MUST NOT import from any other extension folder (eslint BLOCK C)
// except platform/ for Pi API types, and this module takes only one type from
// it (`ActiveMcpImplementation`); the cache module therefore does pure file
// I/O via shared/atomic-json and receives the rebuild callback (which closes
// over loadState + loadMarketplaceManifest) from its caller.
//
// Read API
//   getPluginIndex(path, scope, marketplace, rebuild, { now?, mcpImplementation? })
//     - memory hit with the read's stamp AND now() - loadedAt <= 10 minutes
//       -> return cached
//     - memory miss, other stamp, OR TTL expiry -> drop memory + read file
//         - file hit (schema-OK) with the read's stamp AND fresh
//           (lastRefreshedAt within 10 minutes) -> hydrate memory + return
//         - file ENOENT/corrupt/schema mismatch/stale -> rebuild path (below)
//     - rebuild path:
//         - rebuild() returns rows -> atomicWriteJson (stamped) + hydrate + return
//         - rebuild() throws ManifestSoftFailError -> atomicWriteJson the
//           {_loadError} poison row + hydrate memory with [] + return []
//           (TC-8 soft-fail; never reaches the caller as a throw)
//         - any other throw -> propagate (TC-9)
//
// Invalidation API
//   invalidateMarketplaceNames(path, scope) -- unlink (ENOENT silent)
//   invalidateMarketplaceCache(scope, mp) -- memory-only drop
//   dropMarketplaceCache(path, scope, mp) -- memory drop + unlink (ENOENT silent)
//
// Ownership
//   createCompletionCache() -- owns one private plugin-index memory map.
//
// TC-8 discriminator: callers wrap manifest-load failures in
// ManifestSoftFailError; everything else propagates. The cache module cannot
// inspect arbitrary errors to decide softness, so the named exception is the
// contract.
//
// Clock seam (D-03 TTL): GetPluginIndexOptions.now lets tests advance a
// virtual clock without `t.mock.timers` (Node 23+ feature), keeping the Node
// floor at 22.

import { readFile, unlink } from "node:fs/promises";

import Type from "typebox";
import { Compile } from "typebox/compile";

import { atomicWriteJson } from "./atomic-json.ts";
import { hookDebugLog } from "./debug-log.ts";
import { errorMessage } from "./errors.ts";

import type { Scope } from "./types.ts";
import type { ActiveMcpImplementation } from "../platform/pi-api.ts";

// ---------------------------------------------------------------------------
// Cache file schemas (D-03 -- drop+rebuild on schemaVersion mismatch).
// ---------------------------------------------------------------------------

// LIST-02 / D-67-02: the plugin-index cache carries the FINER derived status
// set so the completion bucketizer can offer the `--partial`-gated candidate sets
// without a second classifier. WR-02 adds `partially-installed-upgradable` -- a
// partially-installed row that ALSO has a meaningful (newer, non-unavailable)
// candidate, so it is offered under `update --partial` (rendered `(partially-installed)`
// on `list`). The schemaVersion bump makes every stale prior-shape cache (any
// `schemaVersion` mismatch) drop+rebuild on next read via the existing mismatch
// path -- no manual migration (T-67-07: the plugin-index cache is an ephemeral
// optimization cache, NOT the persisted state model). D-75-01: the partial-status
// literal union rename rode a prior bump in lockstep. PURL-08 / D-03: the 4 -> 5
// bump drops caches written BEFORE the completion bucketizer learned the
// git-source short-circuit -- those caches carried not-installed git-source rows
// misclassified `unavailable`, and dropping them stops the wrong rows outliving
// the fix. RSTA-03: the 5 -> 6 bump drops caches carrying the OLD not-installed
// git-source `(available)` classification (a not-fetched git plugin is now
// `remote`), so pre-fix caches drop+rebuild via the same drop-on-mismatch path.
// D-P6-22: the 6 -> 7 bump adds the optional `mcpImplementation` stamp, the
// implementation the rows were classified under. A file stamped for another
// implementation, or an older unstamped file, drops and rebuilds through the
// same mismatch path, so rows classified for one implementation are never
// served after a switch to another. The stamp is absent only when the read
// named no implementation, and an absent stamp matches only such a read.
const PLUGIN_INDEX_CACHE_SCHEMA = Type.Object({
  schemaVersion: Type.Literal(7),
  lastRefreshedAt: Type.String(),
  manifestRef: Type.Optional(Type.String()),
  mcpImplementation: Type.Optional(
    Type.Union([Type.Literal("adapter"), Type.Literal("builtin"), Type.Literal("none")]),
  ),
  plugins: Type.Array(
    Type.Object({
      name: Type.String(),
      status: Type.Union([
        Type.Literal("installed"),
        Type.Literal("upgradable"),
        Type.Literal("partially-installed"),
        Type.Literal("partially-installed-upgradable"),
        Type.Literal("partially-upgradable"),
        Type.Literal("available"),
        Type.Literal("partially-available"),
        Type.Literal("unavailable"),
        Type.Literal("remote"),
      ]),
      version: Type.Optional(Type.String()),
    }),
  ),
  _loadError: Type.Optional(Type.String()),
});
const PLUGIN_INDEX_VALIDATOR = Compile(PLUGIN_INDEX_CACHE_SCHEMA);

// ---------------------------------------------------------------------------
// Public row type (matches the schema's plugins element).
// ---------------------------------------------------------------------------

export interface PluginIndexRow {
  readonly name: string;
  // LIST-02 / D-67-02: widened in lockstep with the schema literal union.
  readonly status:
    | "installed"
    | "upgradable"
    | "partially-installed"
    | "partially-installed-upgradable"
    | "partially-upgradable"
    | "available"
    | "partially-available"
    | "unavailable"
    | "remote";
  readonly version?: string;
}

// ---------------------------------------------------------------------------
// Plugin-index ownership is created per CompletionCache instance below.
// ---------------------------------------------------------------------------

interface PluginIndexMemoryEntry {
  readonly rows: readonly PluginIndexRow[];
  readonly loadedAt: number;
  /** D-P6-22: the implementation the rows were classified under, if the read named one. */
  readonly mcpImplementation: ActiveMcpImplementation | undefined;
}

/** 10-minute TTL safety net for the plugin index (D-03 -- catches concurrent-process changes). */
const PLUGIN_INDEX_TTL_MS = 10 * 60 * 1000;

// ---------------------------------------------------------------------------
// TC-8 discriminator. Throwing this from a plugin-index rebuild callback
// signals "manifest load failed for this marketplace; cache the poison and
// return empty list -- do NOT surface a throw to the completion path."
// Any other throw escapes (TC-9 propagation; e.g. state.json read errors).
// ---------------------------------------------------------------------------

export class ManifestSoftFailError extends Error {
  override readonly cause: unknown;
  constructor(cause: unknown) {
    super(`Manifest load failure: ${errorMessage(cause)}`);
    this.name = "ManifestSoftFailError";
    this.cause = cause;
  }
}

// ---------------------------------------------------------------------------
// Helpers (private).
// ---------------------------------------------------------------------------

function pluginIndexKey(scope: Scope, marketplace: string): string {
  return `${scope}::${marketplace}`;
}

interface PluginIndexFileResult {
  readonly rows: readonly PluginIndexRow[];
  readonly lastRefreshedAt: string;
  /** D-P6-22: the file's implementation stamp, absent when its writer named none. */
  readonly mcpImplementation: ActiveMcpImplementation | undefined;
  /**
   * True when the cache file already contains the TC-8 soft-fail poison row
   * (_loadError set). The caller should hydrate memory with empty rows and
   * return [] without invoking rebuild.
   */
  readonly isPoisoned: boolean;
}

async function readPluginIndexFile(filePath: string): Promise<PluginIndexFileResult | undefined> {
  let raw: string;
  try {
    raw = await readFile(filePath, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      hookDebugLog(`plugin-index cache read failed for ${filePath}: ${errorMessage(err)}`);
    }

    return undefined;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return undefined;
  }

  if (!PLUGIN_INDEX_VALIDATOR.Check(parsed)) {
    return undefined;
  }

  // Validator narrows `parsed.plugins` to the row shape.
  const isPoisoned = parsed._loadError !== undefined;
  return {
    rows: parsed.plugins,
    lastRefreshedAt: parsed.lastRefreshedAt,
    mcpImplementation: parsed.mcpImplementation,
    isPoisoned,
  };
}

/** A file serves a read only when it is fresh and stamped for the read's implementation. */
function pluginIndexFileServes(
  result: PluginIndexFileResult,
  mcpImplementation: ActiveMcpImplementation | undefined,
  now: () => number,
): boolean {
  const loadedAt = Date.parse(result.lastRefreshedAt);
  return (
    result.mcpImplementation === mcpImplementation &&
    Number.isFinite(loadedAt) &&
    now() - loadedAt <= PLUGIN_INDEX_TTL_MS
  );
}

/** D-P6-22: the stamp field a cache file carries, omitted when the read named none. */
function stampField(mcpImplementation: ActiveMcpImplementation | undefined): {
  readonly mcpImplementation?: ActiveMcpImplementation;
} {
  return mcpImplementation === undefined ? {} : { mcpImplementation };
}

// ---------------------------------------------------------------------------
// Read API.
// ---------------------------------------------------------------------------

export interface GetPluginIndexOptions {
  /**
   * Clock injection seam for the 10-min TTL (default: Date.now). Keeps the
   * Node floor at 22 -- avoids requiring `t.mock.timers` (Node 23+).
   */
  readonly now?: () => number;
  /**
   * D-P6-22: the MCP implementation the rows are classified under. A memory
   * entry or a cache file serves only a read with the same value, and a
   * rebuild stamps it. An absent option is its own stamp, distinct from all
   * three implementations, and never stands for a default implementation.
   */
  readonly mcpImplementation?: ActiveMcpImplementation;
}

/**
 * Resolve the plugin index for (`scope`, `marketplace`).
 *
 * In-memory hit (within 10-minute TTL, same implementation stamp) serves
 * immediately. After the TTL, or under another stamp, the next call drops the
 * memory entry and re-reads the file (which is cheap). On file miss /
 * corruption / schema mismatch / other stamp, invokes `rebuild` (D-P6-22).
 *
 * TC-8: rebuild throwing ManifestSoftFailError writes a `_loadError` poison
 * row, hydrates memory with `[]`, and returns `[]` (no throw escapes).
 *
 * TC-9: any other rebuild throw propagates verbatim (e.g. state.json error).
 */
async function getPluginIndexWithMemory(
  memPluginIndex: Map<string, PluginIndexMemoryEntry>,
  pluginCachePath: string,
  scope: Scope,
  marketplace: string,
  rebuild: () => Promise<readonly PluginIndexRow[]>,
  options?: GetPluginIndexOptions,
): Promise<readonly PluginIndexRow[]> {
  const now = options?.now ?? Date.now;
  const mcpImplementation = options?.mcpImplementation;
  const key = pluginIndexKey(scope, marketplace);

  const memHit = memPluginIndex.get(key);
  if (memHit !== undefined) {
    if (
      memHit.mcpImplementation === mcpImplementation &&
      now() - memHit.loadedAt <= PLUGIN_INDEX_TTL_MS
    ) {
      return memHit.rows;
    }

    // TTL expired, or the rows were classified for another implementation
    // (D-P6-22) -- drop memory; fall through to file read.
    memPluginIndex.delete(key);
  }

  const fromFile = await readPluginIndexFile(pluginCachePath);
  if (fromFile !== undefined) {
    if (pluginIndexFileServes(fromFile, mcpImplementation, now)) {
      // Poison rows hydrate as [] without re-running rebuild (TC-8: stay
      // soft-failed until explicit invalidation, or until the file's own
      // 10-min TTL expires and the next read falls through to rebuild).
      if (fromFile.isPoisoned) {
        memPluginIndex.set(key, { rows: [], loadedAt: now(), mcpImplementation });
        return [];
      }

      memPluginIndex.set(key, { rows: fromFile.rows, loadedAt: now(), mcpImplementation });
      return fromFile.rows;
    }

    // File cache TTL catches status changes made by another Pi process or
    // by older versions that only invalidated the in-memory entry; a file
    // stamped for another implementation rebuilds too (D-P6-22).
    memPluginIndex.delete(key);
  }

  // Rebuild path: TC-8 discriminator vs. TC-9 propagation.
  let rows: readonly PluginIndexRow[];
  try {
    rows = await rebuild();
  } catch (err) {
    if (err instanceof ManifestSoftFailError) {
      const poison = {
        schemaVersion: 7 as const,
        lastRefreshedAt: new Date().toISOString(),
        ...stampField(mcpImplementation),
        plugins: [] as PluginIndexRow[],
        _loadError: errorMessage(err.cause),
      };
      await atomicWriteJson(pluginCachePath, poison);
      hookDebugLog(
        `plugin-index rebuild soft-failed for ${scope}/${marketplace}; caching poison: ${errorMessage(err.cause)}`,
      );
      memPluginIndex.set(key, { rows: [], loadedAt: now(), mcpImplementation });
      return [];
    }

    // TC-9: state.json error (or any other unexpected throw) -- propagate.
    throw err;
  }

  await atomicWriteJson(pluginCachePath, {
    schemaVersion: 7 as const,
    lastRefreshedAt: new Date().toISOString(),
    ...stampField(mcpImplementation),
    plugins: rows.map((r) => {
      // Strip undefined version fields so the on-disk shape matches the
      // schema's Type.Optional convention (omit, not null).
      if (r.version === undefined) {
        return { name: r.name, status: r.status };
      }

      return { name: r.name, status: r.status, version: r.version };
    }),
  });
  memPluginIndex.set(key, { rows, loadedAt: now(), mcpImplementation });
  return rows;
}

// ---------------------------------------------------------------------------
// Invalidation API.
// ---------------------------------------------------------------------------

/**
 * Unlink the marketplace-names cache file. Names change whenever marketplaces
 * are added or removed; leaving the file intact would retain stale data for
 * older or concurrent completion processes. ENOENT is silent.
 */
async function invalidateMarketplaceNamesFile(marketplaceNamesCachePath: string): Promise<void> {
  try {
    await unlink(marketplaceNamesCachePath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return;
    }

    throw err;
  }
}

/** Drop the in-memory plugin-index entry for (`scope`, `marketplace`). File on disk is left intact. */
function invalidateMarketplaceCacheWithMemory(
  memPluginIndex: Map<string, PluginIndexMemoryEntry>,
  scope: Scope,
  marketplace: string,
): void {
  memPluginIndex.delete(pluginIndexKey(scope, marketplace));
}

/**
 * Drop the in-memory plugin-index entry AND unlink the cache file. Used when
 * the underlying marketplace is removed (no recovery path -- cache file must
 * not linger). ENOENT on the file is silent (already absent is OK).
 */
async function dropMarketplaceCacheWithMemory(
  memPluginIndex: Map<string, PluginIndexMemoryEntry>,
  pluginCachePath: string,
  scope: Scope,
  marketplace: string,
): Promise<void> {
  memPluginIndex.delete(pluginIndexKey(scope, marketplace));
  try {
    await unlink(pluginCachePath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return;
    }

    throw err;
  }
}

/** Plugin-index cache operations shared by readers and targeted invalidators. */
export interface CompletionCache {
  /** Resolves one scoped marketplace's plugin-index rows. */
  getPluginIndex(
    pluginCachePath: string,
    scope: Scope,
    marketplace: string,
    rebuild: () => Promise<readonly PluginIndexRow[]>,
    options?: GetPluginIndexOptions,
  ): Promise<readonly PluginIndexRow[]>;
  /** Removes one scoped marketplace from memory while retaining its disk cache. */
  invalidateMarketplaceCache(scope: Scope, marketplace: string): void;
  /** Removes one scoped marketplace from memory and disk. */
  dropMarketplaceCache(pluginCachePath: string, scope: Scope, marketplace: string): Promise<void>;
  /** Removes one scope's marketplace-names cache file. */
  invalidateMarketplaceNames(marketplaceNamesCachePath: string, scope: Scope): Promise<void>;
}

/** Creates one CompletionCache with private plugin-index memory. */
export function createCompletionCache(): CompletionCache {
  const memPluginIndex = new Map<string, PluginIndexMemoryEntry>();
  return {
    getPluginIndex: (pluginCachePath, scope, marketplace, rebuild, options) =>
      getPluginIndexWithMemory(
        memPluginIndex,
        pluginCachePath,
        scope,
        marketplace,
        rebuild,
        options,
      ),
    invalidateMarketplaceCache: (scope, marketplace) => {
      invalidateMarketplaceCacheWithMemory(memPluginIndex, scope, marketplace);
    },
    dropMarketplaceCache: (pluginCachePath, scope, marketplace) =>
      dropMarketplaceCacheWithMemory(memPluginIndex, pluginCachePath, scope, marketplace),
    invalidateMarketplaceNames: (marketplaceNamesCachePath) =>
      invalidateMarketplaceNamesFile(marketplaceNamesCachePath),
  };
}

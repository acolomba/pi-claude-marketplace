// shared/completion-cache.ts
//
// D-03 two-tier (in-memory + file-backed) completion cache. Lives in shared/
// because both edge/ (read path) and orchestrators/ (invalidation path) must
// reach it, and the D-11 import boundary keeps edge/ from importing
// persistence/ (where state-io / locations live). shared/ is the only home
// that satisfies BOTH directions.
//
// shared/ MUST NOT import from any other extension folder (eslint BLOCK C);
// the cache module therefore does pure file I/O via shared/atomic-json and
// receives the rebuild callback (which closes over loadState +
// loadMarketplaceManifest) from its caller.
//
// Read API
//   getMarketplaceNames(path, scope, rebuild)
//     - memory hit -> return cached
//     - memory miss + file hit (schema-OK) -> hydrate memory + return
//     - memory miss + (ENOENT | corrupt | schema mismatch) -> rebuild ->
//       atomicWriteJson -> hydrate memory + return
//     - rebuild throw -> propagate (TC-9: state.json errors surface)
//
//   getPluginIndex(path, scope, marketplace, rebuild, { now? })
//     - memory hit AND now() - loadedAt <= 10 minutes -> return cached
//     - memory miss OR TTL expiry -> drop memory + read file
//         - file hit (schema-OK) -> hydrate memory + return
//         - file ENOENT/corrupt/schema mismatch -> rebuild path (below)
//     - rebuild path:
//         - rebuild() returns rows -> atomicWriteJson + hydrate + return
//         - rebuild() throws ManifestSoftFailError -> atomicWriteJson the
//           {_loadError} poison row + hydrate memory with [] + return []
//           (TC-8 soft-fail; never reaches the caller as a throw)
//         - any other throw -> propagate (TC-9)
//
// Invalidation API
//   invalidateMarketplaceNames(path, scope) -- memory drop + unlink (ENOENT silent)
//   invalidateMarketplaceCache(scope, mp) -- memory-only drop
//   dropMarketplaceCache(path, scope, mp) -- memory drop + unlink (ENOENT silent)
//
// Test seam
//   __resetCacheForTests() -- clear both in-memory maps between cases.
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
import { errorMessage } from "./errors.ts";

import type { Scope } from "./types.ts";

// ---------------------------------------------------------------------------
// Cache file schemas (D-03 -- drop+rebuild on schemaVersion mismatch).
// ---------------------------------------------------------------------------

export const MARKETPLACE_NAMES_CACHE_SCHEMA = Type.Object({
  schemaVersion: Type.Literal(2),
  names: Type.Array(Type.String()),
});
const MARKETPLACE_NAMES_VALIDATOR = Compile(MARKETPLACE_NAMES_CACHE_SCHEMA);

// LIST-02 / D-67-02: the plugin-index cache carries the FINER derived status
// set so the completion bucketizer can offer the `--force`-gated candidate sets
// without a second classifier. WR-02 adds `force-installed-upgradable` -- a
// force-installed row that ALSO has a meaningful (newer, non-unavailable)
// candidate, so it is offered under `update --force` (rendered `(force-installed)`
// on `list`). The schemaVersion bump (1 -> 3) makes every stale prior-shape cache
// (any `schemaVersion !== 3`) mismatch and drop+rebuild on next read via the
// existing mismatch path -- no manual migration (T-67-07: the plugin-index cache
// is an ephemeral optimization cache, NOT the persisted state model).
export const PLUGIN_INDEX_CACHE_SCHEMA = Type.Object({
  schemaVersion: Type.Literal(3),
  lastRefreshedAt: Type.String(),
  manifestRef: Type.Optional(Type.String()),
  plugins: Type.Array(
    Type.Object({
      name: Type.String(),
      status: Type.Union([
        Type.Literal("installed"),
        Type.Literal("upgradable"),
        Type.Literal("force-installed"),
        Type.Literal("force-installed-upgradable"),
        Type.Literal("force-upgradable"),
        Type.Literal("available"),
        Type.Literal("unsupported"),
        Type.Literal("unavailable"),
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
    | "force-installed"
    | "force-installed-upgradable"
    | "force-upgradable"
    | "available"
    | "unsupported"
    | "unavailable";
  readonly version?: string;
}

// ---------------------------------------------------------------------------
// In-memory maps. Single-threaded JS event loop = no locking. Keyed by
// `${scope}` for marketplace names, `${scope}::${marketplace}` for plugin
// index (string keys preferred over struct keys for hash simplicity).
// ---------------------------------------------------------------------------

const memMarketplaceNames = new Map<string /* scope */, readonly string[]>();
const memPluginIndex = new Map<
  string /* `${scope}::${marketplace}` */,
  { rows: readonly PluginIndexRow[]; loadedAt: number }
>();

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

/** Read + parse + validate a cache file; return undefined on any failure (caller falls back to rebuild). */
async function readMarketplaceNamesFile(filePath: string): Promise<readonly string[] | undefined> {
  let raw: string;
  try {
    raw = await readFile(filePath, "utf8");
  } catch {
    return undefined;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return undefined;
  }

  if (!MARKETPLACE_NAMES_VALIDATOR.Check(parsed)) {
    return undefined;
  }

  // Narrowed by validator; `names` is string[].
  return parsed.names;
}

interface PluginIndexFileResult {
  readonly rows: readonly PluginIndexRow[];
  readonly lastRefreshedAt: string;
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
  } catch {
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
  return { rows: parsed.plugins, lastRefreshedAt: parsed.lastRefreshedAt, isPoisoned };
}

function pluginIndexFileIsFresh(result: PluginIndexFileResult, now: () => number): boolean {
  const loadedAt = Date.parse(result.lastRefreshedAt);
  return Number.isFinite(loadedAt) && now() - loadedAt <= PLUGIN_INDEX_TTL_MS;
}

// ---------------------------------------------------------------------------
// Read API.
// ---------------------------------------------------------------------------

/**
 * Resolve the union of marketplace names for `scope`.
 *
 * In-memory hit serves immediately. On memory miss, attempts a file read;
 * a validated file content hydrates the memory map and returns. On any file
 * problem (ENOENT, corrupt JSON, schema mismatch), invokes `rebuild`,
 * atomically writes the result, hydrates memory, and returns.
 *
 * State.json errors from `rebuild` propagate (TC-9). Names cache has NO
 * TTL: changes flow through orchestrator-side invalidation.
 */
export async function getMarketplaceNames(
  marketplaceNamesCachePath: string,
  scope: Scope,
  rebuild: () => Promise<readonly string[]>,
): Promise<readonly string[]> {
  const memHit = memMarketplaceNames.get(scope);
  if (memHit !== undefined) {
    return memHit;
  }

  const fromFile = await readMarketplaceNamesFile(marketplaceNamesCachePath);
  if (fromFile !== undefined) {
    memMarketplaceNames.set(scope, fromFile);
    return fromFile;
  }

  // Rebuild from authoritative source; state.json errors surface (TC-9).
  const names = await rebuild();
  await atomicWriteJson(marketplaceNamesCachePath, {
    schemaVersion: 2 as const,
    names: [...names],
  });
  memMarketplaceNames.set(scope, names);
  return names;
}

export interface GetPluginIndexOptions {
  /**
   * Clock injection seam for the 10-min TTL (default: Date.now). Keeps the
   * Node floor at 22 -- avoids requiring `t.mock.timers` (Node 23+).
   */
  readonly now?: () => number;
}

/**
 * Resolve the plugin index for (`scope`, `marketplace`).
 *
 * In-memory hit (within 10-minute TTL) serves immediately. After the TTL
 * the next call drops the memory entry and re-reads the file (which is
 * cheap). On file miss / corruption / schema mismatch, invokes `rebuild`.
 *
 * TC-8: rebuild throwing ManifestSoftFailError writes a `_loadError` poison
 * row, hydrates memory with `[]`, and returns `[]` (no throw escapes).
 *
 * TC-9: any other rebuild throw propagates verbatim (e.g. state.json error).
 */
export async function getPluginIndex(
  pluginCachePath: string,
  scope: Scope,
  marketplace: string,
  rebuild: () => Promise<readonly PluginIndexRow[]>,
  options?: GetPluginIndexOptions,
): Promise<readonly PluginIndexRow[]> {
  const now = options?.now ?? Date.now;
  const key = pluginIndexKey(scope, marketplace);

  const memHit = memPluginIndex.get(key);
  if (memHit !== undefined) {
    if (now() - memHit.loadedAt <= PLUGIN_INDEX_TTL_MS) {
      return memHit.rows;
    }

    // TTL expired -- drop memory; fall through to file read.
    memPluginIndex.delete(key);
  }

  const fromFile = await readPluginIndexFile(pluginCachePath);
  if (fromFile !== undefined) {
    if (pluginIndexFileIsFresh(fromFile, now)) {
      // Poison rows hydrate as [] without re-running rebuild (TC-8: stay
      // soft-failed until explicit invalidation; reads return [] forever).
      if (fromFile.isPoisoned) {
        memPluginIndex.set(key, { rows: [], loadedAt: now() });
        return [];
      }

      memPluginIndex.set(key, { rows: fromFile.rows, loadedAt: now() });
      return fromFile.rows;
    }

    // File cache TTL catches status changes made by another Pi process or
    // by older versions that only invalidated the in-memory entry.
    memPluginIndex.delete(key);
  }

  // Rebuild path: TC-8 discriminator vs. TC-9 propagation.
  let rows: readonly PluginIndexRow[];
  try {
    rows = await rebuild();
  } catch (err) {
    if (err instanceof ManifestSoftFailError) {
      const poison = {
        schemaVersion: 3 as const,
        lastRefreshedAt: new Date().toISOString(),
        plugins: [] as PluginIndexRow[],
        _loadError: errorMessage(err.cause),
      };
      await atomicWriteJson(pluginCachePath, poison);
      memPluginIndex.set(key, { rows: [], loadedAt: now() });
      return [];
    }

    // TC-9: state.json error (or any other unexpected throw) -- propagate.
    throw err;
  }

  await atomicWriteJson(pluginCachePath, {
    schemaVersion: 3 as const,
    lastRefreshedAt: new Date().toISOString(),
    plugins: rows.map((r) => {
      // Strip undefined version fields so the on-disk shape matches the
      // schema's Type.Optional convention (omit, not null).
      if (r.version === undefined) {
        return { name: r.name, status: r.status };
      }

      return { name: r.name, status: r.status, version: r.version };
    }),
  });
  memPluginIndex.set(key, { rows, loadedAt: now() });
  return rows;
}

// ---------------------------------------------------------------------------
// Invalidation API.
// ---------------------------------------------------------------------------

/**
 * Drop the marketplace-names memory entry AND unlink the cache file. Names
 * change whenever marketplaces are added or removed; leaving the file intact
 * would let the next completion process rehydrate stale names from disk.
 * ENOENT on the file is silent (already absent is OK).
 */
export async function invalidateMarketplaceNames(
  marketplaceNamesCachePath: string,
  scope: Scope,
): Promise<void> {
  memMarketplaceNames.delete(scope);
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
export function invalidateMarketplaceCache(scope: Scope, marketplace: string): void {
  memPluginIndex.delete(pluginIndexKey(scope, marketplace));
}

/**
 * Drop the in-memory plugin-index entry AND unlink the cache file. Used when
 * the underlying marketplace is removed (no recovery path -- cache file must
 * not linger). ENOENT on the file is silent (already absent is OK).
 */
export async function dropMarketplaceCache(
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

// ---------------------------------------------------------------------------
// Test-only seam (NOT part of the public contract).
// ---------------------------------------------------------------------------

/**
 * @internal -- clear both in-memory maps. Tests call this between cases to
 * isolate state since the module's maps are process-global.
 */
export function __resetCacheForTests(): void {
  memMarketplaceNames.clear();
  memPluginIndex.clear();
}

// bridges/hooks/event-router.ts
//
// Hooks-bridge dispatch core: the central routing layer the Pi runtime
// hands events to. Owns three pieces of module-level state:
//
//   - `liveEpoch` (D-59-03): incremented on every registerHooksBridge
//     entry; composite handlers capture the value at registration time and
//     short-circuit on mismatch so a stale handler closure from a prior
//     extension load cannot fire against the live routing tables. Belt-
//     and-suspenders zombie defense -- the load-bearing protection is Pi's
//     own extension-runner swap; the epoch insulates against a future Pi
//     loader change or a setTimeout-queued dispatch that survives reload.
//
//   - `parsedConfigCache` (D-59-02): in-memory `Map<cacheKey, CacheEntry>`
//     populated at factory time by hydrate, mutated by the install / uninstall
//     code paths (wired downstream), and read by rebuildRoutingTables.
//     Cache rebuild is sub-millisecond and performs zero disk I/O on the
//     hot path (DISP-02). Cache key includes marketplace so the same
//     pluginId under two different marketplaces in the same scope occupies
//     two distinct entries.
//
//   - `routingTable`: `Map<BucketAEvent, ReadonlyArray<RoutingEntry>>` with
//     all eight Claude-event buckets pre-populated to `[]` after every
//     rebuild. Cross-plugin entries are sorted by `compareByNameThenScope`
//     (project before user, alphabetical by pluginId); within-plugin entries
//     preserve declaration order via the monotonic `declarationIndex` carried
//     on RoutingEntry (DISP-04).
//
// DISP-01 / DISP-02 / DISP-03 / DISP-04 / OBS-01 anchor the contracts this
// module enforces; D-59-01 / D-59-02 / D-59-03 anchor the decisions.

import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

import { BUCKET_A_EVENTS, type BucketAEvent } from "../../domain/components/hook-events.ts";
import {
  parseHooksConfig,
  parseMatcher,
  type HookHandlerEntry,
  type HooksConfig,
  type ParsedMatcher,
} from "../../domain/components/hooks.ts";
import { locationsFor, type ScopedLocations } from "../../persistence/locations.ts";
import { loadState, type ExtensionState } from "../../persistence/state-io.ts";
import { hookDebugLog } from "../../shared/debug-log.ts";
import { errorMessage } from "../../shared/errors.ts";
import { compareByNameThenScope } from "../../shared/notify.ts";

import { dispatchHookExec } from "./dispatch-exec.ts";

import type { ExtensionAPI, ExtensionContext } from "../../platform/pi-api.ts";
import type { Scope } from "../../shared/types.ts";

// ──────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────

/**
 * Flattened (event, group, handler) routing slot. The dispatch core walks
 * the per-event bucket and fires `dispatchHookExec(entry, event, ctx)`
 * sequentially against each entry whose matcher fires for the incoming Pi
 * event (DISP-04 sequential awaited fan-out).
 *
 * `rawMatcher` carries the pre-parse string verbatim so dispatch-time
 * filtering against non-tool events (SessionStart filters on
 * `event.reason`) can compare against the originally-declared value without
 * re-parsing.
 *
 * `declarationIndex` is a monotonic counter assigned during rebuild's
 * (event, group, handler) flattening; it preserves intra-plugin source
 * order across the per-plugin bucket merge (DISP-04).
 */
export interface RoutingEntry {
  readonly scope: Scope;
  readonly marketplace: string;
  readonly pluginId: string;
  readonly matcher: ParsedMatcher;
  readonly rawMatcher: string;
  readonly handlerDecl: HookHandlerEntry;
  readonly declarationIndex: number;
}

interface CacheEntry {
  readonly scope: Scope;
  readonly marketplace: string;
  readonly pluginId: string;
  readonly config: HooksConfig;
}

// ──────────────────────────────────────────────────────────────────────────
// Module-state cells (D-59-02 / D-59-03)
// ──────────────────────────────────────────────────────────────────────────

let liveEpoch = 0;

const parsedConfigCache = new Map<string, CacheEntry>();

const routingTable = new Map<BucketAEvent, ReadonlyArray<RoutingEntry>>();

// ──────────────────────────────────────────────────────────────────────────
// Cache key helper (D-59-02 + marketplace inclusion)
// ──────────────────────────────────────────────────────────────────────────

/**
 * Cache key composition includes marketplace so two marketplaces declaring
 * the same pluginId in the same scope each get their own entry. The NUL
 * separator is deliberately unlikely to appear in any of the three input
 * fields (assertSafeName rejects control chars upstream).
 */
function cacheKey(scope: Scope, marketplace: string, pluginId: string): string {
  return `${scope}\x00${marketplace}\x00${pluginId}`;
}

// ──────────────────────────────────────────────────────────────────────────
// Public surface
// ──────────────────────────────────────────────────────────────────────────

/**
 * D-59-02: synchronous, idempotent cache mutator. Install wires this into
 * the per-plugin lock; replays overwrite the existing entry.
 */
export function addPluginConfigToCache(
  scope: Scope,
  marketplace: string,
  pluginId: string,
  config: HooksConfig,
): void {
  parsedConfigCache.set(cacheKey(scope, marketplace, pluginId), {
    scope,
    marketplace,
    pluginId,
    config,
  });
}

/**
 * D-59-02: synchronous, idempotent cache mutator. Uninstall wires this into
 * the per-plugin lock; removing a missing entry is a no-op.
 */
export function removePluginConfigFromCache(
  scope: Scope,
  marketplace: string,
  pluginId: string,
): void {
  parsedConfigCache.delete(cacheKey(scope, marketplace, pluginId));
}

/**
 * D-59-03: read-only accessor for the live epoch cell. Used by the
 * dispatch.ts composite handlers (which capture the value at
 * registerHooksBridge time and compare against `currentEpoch()` on every
 * event) and by tests that pin the no-op-on-mismatch contract.
 */
export function currentEpoch(): number {
  return liveEpoch;
}

// ──────────────────────────────────────────────────────────────────────────
// Rebuild (DISP-02 / DISP-04)
// ──────────────────────────────────────────────────────────────────────────

/**
 * DISP-02 / DISP-04: rebuild the per-Claude-event buckets for `loc.scope`
 * from the cached parsed configs. Synchronous, zero disk I/O, sub-ms on
 * realistic catalogs.
 *
 * Bucket assignment is verbatim against the declared event name (D-58-06):
 * `hooks.json` declares either `PostToolUse` or `PostToolUseFailure`, and
 * the rebuild populates exactly the bucket the declaration named. The
 * `event.isError` split for `tool_result` is a dispatch-time concern in the
 * composite handler, not a rebuild-time concern.
 *
 * Sort order: cross-plugin via `compareByNameThenScope` (project before
 * user, alphabetical by pluginId); within-plugin via `declarationIndex`
 * ascending (preserves source-file order across the
 * (event, group, handler) flattening).
 *
 * Empty buckets get an empty array so downstream `routingTable.get(event)`
 * never observes `undefined`.
 */
export function rebuildRoutingTables(state: ExtensionState, loc: ScopedLocations): void {
  // Pre-seed every bucket so a scope with zero installed plugins still
  // clears any stale entries from a prior rebuild (e.g. uninstall of the
  // last hooks-declaring plugin).
  const buckets = new Map<BucketAEvent, RoutingEntry[]>();
  for (const event of BUCKET_A_EVENTS) {
    buckets.set(event, []);
  }

  // Collect (cacheEntry, sort-key) tuples in cross-plugin sort order;
  // declarationIndex is assigned during flatten.
  const sortedEntries = collectPluginsInScope(state, loc.scope);

  for (const cacheEntry of sortedEntries) {
    flattenPluginIntoBuckets(cacheEntry, buckets);
  }

  for (const [event, list] of buckets) {
    routingTable.set(event, list);
  }
}

/**
 * Collect cache entries whose state-recorded scope matches `scope` AND
 * whose state record declares `resources.hooks.length > 0` (otherwise the
 * plugin has no hooks artefact to dispatch against). Cross-plugin sort by
 * `compareByNameThenScope` -- project before user, alphabetical by pluginId.
 *
 * A state-declared plugin whose cache entry is missing is silently skipped:
 * the first-install window where install has populated state but the cache
 * is not yet hydrated is normal; reconcile-apply calls rebuild again after
 * the install path's addPluginConfigToCache lands.
 */
function collectPluginsInScope(state: ExtensionState, scope: Scope): CacheEntry[] {
  const collected: CacheEntry[] = [];

  for (const [mpName, mpRecord] of Object.entries(state.marketplaces)) {
    if (mpRecord.scope !== scope) {
      continue;
    }

    for (const [pluginId, pluginRecord] of Object.entries(mpRecord.plugins)) {
      if (pluginRecord.resources.hooks.length === 0) {
        continue;
      }

      const entry = parsedConfigCache.get(cacheKey(scope, mpName, pluginId));
      if (entry !== undefined) {
        collected.push(entry);
      }
    }
  }

  collected.sort((a, b) =>
    compareByNameThenScope(
      { name: a.pluginId, scope: a.scope },
      { name: b.pluginId, scope: b.scope },
    ),
  );

  return collected;
}

/**
 * Flatten a single plugin's HooksConfig into the per-event buckets.
 * declarationIndex is monotonic across the (event, group, handler) walk so
 * within-plugin source order is preserved when the bridge merges multiple
 * plugins' entries into the same bucket.
 */
function flattenPluginIntoBuckets(
  cacheEntry: CacheEntry,
  buckets: Map<BucketAEvent, RoutingEntry[]>,
): void {
  let declarationIndex = 0;

  for (const [eventName, groups] of Object.entries(cacheEntry.config)) {
    const bucket = buckets.get(eventName as BucketAEvent);
    if (bucket === undefined) {
      // Unknown event names are filtered by the parser; defensive skip.
      continue;
    }

    for (const group of groups) {
      const rawMatcher = group.matcher ?? "";
      const matcher = parseMatcher(rawMatcher);

      for (const handlerDecl of group.hooks) {
        bucket.push({
          scope: cacheEntry.scope,
          marketplace: cacheEntry.marketplace,
          pluginId: cacheEntry.pluginId,
          matcher,
          rawMatcher,
          handlerDecl,
          declarationIndex,
        });

        declarationIndex += 1;
      }
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Factory-time hydrate (DISP-02 cold-start path)
// ──────────────────────────────────────────────────────────────────────────

/**
 * Result of the hydrate pass for a single scope: the loaded state AND the
 * fully-constructed ScopedLocations. registerHooksBridge needs both to
 * call rebuildRoutingTables(state, loc) per scope after hydrate completes.
 */
interface HydratedScope {
  readonly state: ExtensionState;
  readonly loc: ScopedLocations;
}

/**
 * D-59-02 factory-time hydrate. Walks both scopes (user via
 * `getAgentDir()` indirection through `locationsFor`, project via
 * `opts.cwd`), reads each scope's state, then for every installed plugin
 * whose `resources.hooks` is non-empty reads the on-disk hooks.json (at
 * `<hooksDir>/<generatedName>/hooks.json` -- the same generatedName
 * convention skills/prompts use under their target dirs), parses it via
 * the domain layer, and populates parsedConfigCache.
 *
 * Parse failures (invalid JSON, schema mismatch, supportability trip) are
 * non-fatal: the per-plugin reason is routed through `hookDebugLog` (the
 * OBS-01 seam) and the cache entry is omitted. Reconcile flips the plugin
 * to `(unavailable) {unsupported hooks}` on the next state read, so a
 * silent omission here is the correct factory-time disposition.
 */
async function hydrateCacheFromDisk(opts: {
  ctx: ExtensionContext;
  cwd: string;
}): Promise<readonly HydratedScope[]> {
  const scopes: Scope[] = ["user", "project"];
  const hydrated: HydratedScope[] = [];

  for (const scope of scopes) {
    const loc = locationsFor(scope, scope === "project" ? opts.cwd : homedir());

    let state: ExtensionState;
    try {
      state = await loadState(loc.extensionRoot);
    } catch (err) {
      // A corrupt state.json should not block the bridge from coming up;
      // route the detail through the OBS-01 seam and use the default state
      // (zero plugins) for this scope so the rebuild step still runs.
      hookDebugLog(
        `hydrate: loadState failed for scope=${scope} extensionRoot=${loc.extensionRoot}: ${errorMessage(err)}`,
      );
      state = { schemaVersion: 1, marketplaces: {} };
    }

    await hydrateScopeFromState(state, loc);
    hydrated.push({ state, loc });
  }

  return hydrated;
}

/**
 * Per-scope hydrate: iterate state.marketplaces filtered by scope, find
 * plugins with declared hook resources, read + parse each hooks.json, and
 * populate the cache. Parse failures are logged through hookDebugLog and
 * skipped (the resolver flips installable: false on the next reconcile).
 */
async function hydrateScopeFromState(state: ExtensionState, loc: ScopedLocations): Promise<void> {
  for (const [mpName, mpRecord] of Object.entries(state.marketplaces)) {
    if (mpRecord.scope !== loc.scope) {
      continue;
    }

    for (const [pluginId, pluginRecord] of Object.entries(mpRecord.plugins)) {
      const hookSlugs = pluginRecord.resources.hooks;
      if (hookSlugs.length === 0) {
        continue;
      }

      // D-57-03: `resources.hooks` carries the per-plugin hooks-container-dir
      // generatedName; the on-disk file is `<hooksDir>/<generatedName>/hooks.json`.
      // Zero or one entry today; iterate defensively for forward-compat.
      for (const slug of hookSlugs) {
        const hooksJsonPath = path.join(loc.hooksDir, slug, "hooks.json");
        await tryHydrateOnePlugin(loc.scope, mpName, pluginId, hooksJsonPath);
      }
    }
  }
}

async function tryHydrateOnePlugin(
  scope: Scope,
  marketplace: string,
  pluginId: string,
  hooksJsonPath: string,
): Promise<void> {
  let raw: string;
  try {
    raw = await readFile(hooksJsonPath, "utf8");
  } catch (err) {
    hookDebugLog(
      `hydrate: read failed for ${scope}/${marketplace}/${pluginId} at ${hooksJsonPath}: ${errorMessage(err)}`,
    );
    return;
  }

  const result = parseHooksConfig(raw);
  if (!result.ok) {
    hookDebugLog(`hydrate: parse failed for ${scope}/${marketplace}/${pluginId}: ${result.reason}`);
    return;
  }

  addPluginConfigToCache(scope, marketplace, pluginId, result.value);
}

// ──────────────────────────────────────────────────────────────────────────
// Composite handlers (DISP-01 / DISP-03 / DISP-04) -- inline pending the
// dispatch.ts extraction. The 7 distinct pi.on registrations + the
// `event.isError` split for `tool_result` (D-59-01) live here for now;
// the dispatch.ts module replaces these closures with the locked
// compositeHandlerFor + toolResultCompositeHandler shapes.
// ──────────────────────────────────────────────────────────────────────────

function getBucket(claudeEvent: BucketAEvent): ReadonlyArray<RoutingEntry> {
  return routingTable.get(claudeEvent) ?? [];
}

/**
 * D-59-03 epoch defense -- short-circuit when the handler's captured
 * value does not match the live cell.
 */
function isStaleEpoch(capturedEpoch: number): boolean {
  return capturedEpoch !== liveEpoch;
}

/**
 * Match-against-tool predicate (PreToolUse / PostToolUse / PostToolUseFailure
 * matchers carry a Pi-form tool literal in `piTools`). Unreachable
 * `regex`/`unmapped` arms (parser tripped them at parse time and the
 * resolver flipped the plugin unavailable) return `false` defensively.
 */
function matcherFiresOnToolEvent(matcher: ParsedMatcher, toolName: string): boolean {
  switch (matcher.kind) {
    case "match-all":
      return true;
    case "tool-set":
      return matcher.piTools.has(toolName as never);
    case "mcp-literal":
      return matcher.literal === toolName;
    case "regex":
    case "unmapped":
      return false;
  }
}

async function dispatchToBucket(
  bucket: ReadonlyArray<RoutingEntry>,
  predicate: (entry: RoutingEntry) => boolean,
  event: unknown,
  ctx: ExtensionContext,
): Promise<void> {
  for (const entry of bucket) {
    if (!predicate(entry)) {
      continue;
    }

    await dispatchHookExec(entry, event, ctx);
  }
}

// ──────────────────────────────────────────────────────────────────────────
// registerHooksBridge (DISP-01 / DISP-02 / DISP-03)
// ──────────────────────────────────────────────────────────────────────────

/**
 * D-59-03 / DISP-01 / DISP-02 / DISP-03 hooks-bridge factory.
 *
 * Step order is load-bearing:
 *   1. Bump liveEpoch and capture the new value; every closure registered
 *      below sees the captured value and short-circuits on mismatch
 *      against any future bump.
 *   2. Hydrate the parsed-config cache from disk for both scopes (factory-
 *      time cold-start path).
 *   3. Rebuild routing tables for both scopes so the first Pi event fires
 *      against a populated table.
 *   4. Register exactly 7 pi.on call sites -- one per Pi event the hooks
 *      bridge dispatches against (DISP-01). The eight Claude buckets fan
 *      out from 7 Pi events because `tool_result` splits on `event.isError`
 *      between the PostToolUse and PostToolUseFailure buckets (D-59-01).
 */
export async function registerHooksBridge(
  pi: ExtensionAPI,
  opts: { ctx: ExtensionContext; cwd: string },
): Promise<void> {
  liveEpoch += 1;
  const capturedEpoch = liveEpoch;

  const hydrated = await hydrateCacheFromDisk(opts);
  for (const { state, loc } of hydrated) {
    rebuildRoutingTables(state, loc);
  }

  // SessionStart -- filters on `event.reason` against the per-entry
  // rawMatcher; match-all admits every reason.
  pi.on("session_start", async (event, ctx) => {
    if (isStaleEpoch(capturedEpoch)) {
      return;
    }

    await dispatchToBucket(
      getBucket("SessionStart"),
      (entry) => matcherFiresOnSessionStart(entry, event.reason),
      event,
      ctx,
    );
  });

  // SessionEnd -- no per-entry filter (the non-tool closed set is empty;
  // only match-all matchers reach this bucket per D-58-06).
  pi.on("session_shutdown", async (event, ctx) => {
    if (isStaleEpoch(capturedEpoch)) {
      return;
    }

    await dispatchToBucket(getBucket("SessionEnd"), () => true, event, ctx);
  });

  // PreCompact -- no per-entry filter (closed set is empty per D-58-06).
  pi.on("session_before_compact", async (event, ctx) => {
    if (isStaleEpoch(capturedEpoch)) {
      return;
    }

    await dispatchToBucket(getBucket("PreCompact"), () => true, event, ctx);
  });

  // PostCompact -- no per-entry filter (closed set is empty per D-58-06).
  pi.on("session_compact", async (event, ctx) => {
    if (isStaleEpoch(capturedEpoch)) {
      return;
    }

    await dispatchToBucket(getBucket("PostCompact"), () => true, event, ctx);
  });

  // UserPromptSubmit -- no per-entry filter (Pi InputEvent has no matcher
  // target; parser already rejects non-empty matchers on this event).
  pi.on("input", async (event, ctx) => {
    if (isStaleEpoch(capturedEpoch)) {
      return;
    }

    await dispatchToBucket(getBucket("UserPromptSubmit"), () => true, event, ctx);
  });

  // PreToolUse -- matcher fires against Pi-form `event.toolName`.
  pi.on("tool_call", async (event, ctx) => {
    if (isStaleEpoch(capturedEpoch)) {
      return;
    }

    await dispatchToBucket(
      getBucket("PreToolUse"),
      (entry) => matcherFiresOnToolEvent(entry.matcher, event.toolName),
      event,
      ctx,
    );
  });

  // tool_result -- D-59-01 isError split. ONE composite handler routes to
  // PostToolUse on falsy isError and to PostToolUseFailure on truthy
  // isError; the matcher fires against Pi-form `event.toolName` against
  // whichever bucket was selected.
  pi.on("tool_result", async (event, ctx) => {
    if (isStaleEpoch(capturedEpoch)) {
      return;
    }

    const claudeEvent: BucketAEvent = event.isError ? "PostToolUseFailure" : "PostToolUse";
    await dispatchToBucket(
      getBucket(claudeEvent),
      (entry) => matcherFiresOnToolEvent(entry.matcher, event.toolName),
      event,
      ctx,
    );
  });
}

/**
 * SessionStart per-entry filter. The parser narrows the closed set to
 * `{startup, resume}` at parse time, so by the time a routing entry lands
 * here the rawMatcher is one of `""`, `"*"`, `"startup"`, `"resume"`.
 * Match-all fires unconditionally; a literal-token matcher fires only when
 * `event.reason` equals the literal.
 */
function matcherFiresOnSessionStart(entry: RoutingEntry, reason: string): boolean {
  const raw = entry.rawMatcher;
  return raw === "" || raw === "*" || raw === reason;
}

// ──────────────────────────────────────────────────────────────────────────
// Test-only inspectors -- NOT re-exported from bridges/hooks/index.ts.
// ──────────────────────────────────────────────────────────────────────────

/**
 * Returns the routingTable as-is so unit tests can assert against its
 * contents. Not part of the public surface.
 */
export function _routingTableForTest(): ReadonlyMap<BucketAEvent, ReadonlyArray<RoutingEntry>> {
  return routingTable;
}

/**
 * Returns the parsedConfigCache as-is so unit tests can assert on cache
 * mutator idempotency without exposing the key format. Not part of the
 * public surface.
 */
export function _parsedConfigCacheForTest(): ReadonlyMap<string, CacheEntry> {
  return parsedConfigCache;
}

/**
 * Resets all module-state cells. Used by unit tests so each test starts
 * from a clean baseline. Not part of the public surface.
 */
export function _resetForTest(): void {
  liveEpoch = 0;
  parsedConfigCache.clear();
  routingTable.clear();
}

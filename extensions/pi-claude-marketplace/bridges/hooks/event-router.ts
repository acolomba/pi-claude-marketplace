// bridges/hooks/event-router.ts
//
// Hooks-bridge dispatch core: the central routing layer the Pi runtime
// hands events to. It populates and drives four pieces of shared module
// state, though the cells themselves live in `routing-state.ts` so the
// dispatch chain can read them without importing back into this hub:
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
//   - `routingTable`: `Map<BucketAEvent, ReadonlyArray<RoutingEntry>>` whose
//     keyset stays pinned to `BUCKET_A_EVENTS` -- every bucket is pre-
//     populated to `[]` after each rebuild rather than appearing and
//     disappearing with the cache. Cross-plugin entries are sorted by
//     `compareByNameThenScope` (project before user, alphabetical by
//     pluginId); within-plugin entries preserve declaration order via the
//     monotonic `declarationIndex` carried on RoutingEntry (DISP-04).
//
//   - `pendingSessionStartContext`: the one-shot buffer holding each
//     SessionStart handler's `additionalContext` until the
//     `before_agent_start` closure drains it into the turn's system prompt.
//     Cleared at every factory entry so a `/reload` cannot leak the prior
//     session's primer.
//
// DISP-01 / DISP-02 / DISP-03 / DISP-04 / OBS-01 anchor the contracts this
// module enforces; D-59-01 / D-59-02 / D-59-03 anchor the decisions.

import { mkdir, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

import { BUCKET_A_EVENTS, type BucketAEvent } from "../../domain/components/hook-events.ts";
import { parseHooksConfig, parseMatcher, type HooksConfig } from "../../domain/components/hooks.ts";
import { asAbsolutePluginRoot, type AbsolutePluginRoot } from "../../domain/plugin-root.ts";
import { locationsFor, type ScopedLocations } from "../../persistence/locations.ts";
import {
  DEFAULT_STATE,
  isRecordedButDisabled,
  loadState,
  type ExtensionState,
} from "../../persistence/state-io.ts";
import { hookDebugLog } from "../../shared/debug-log.ts";
import { errorMessage } from "../../shared/errors.ts";
import { compareByNameThenScope } from "../../shared/notify.ts";
import { assertPathInside } from "../../shared/path-safety.ts";
import { SCOPES } from "../../shared/types.ts";

import { reapOrphans, shutdownInMemoryChildren } from "./async-rewake/registry.ts";
import { compositeHandlerFor, toolResultCompositeHandler } from "./dispatch.ts";
import { compileIfPredicate, MATCH_ALL_IF, type IfPredicate } from "./if-field/index.ts";
import {
  bumpEpoch,
  clearParsedConfigCache,
  clearPendingSessionStartContext,
  clearRoutingTable,
  currentEpoch,
  deleteParsedConfig,
  getRoutingBucket,
  parsedConfigEntries,
  pendingSessionStartContextEntries,
  resetEpoch,
  routingTableEntries,
  setParsedConfig,
  setRoutingBucket,
  type CacheEntry,
  type PendingSessionStartContext,
  type RoutingEntry,
} from "./routing-state.ts";
import {
  agentEndCacheHandler,
  inputResetHandlerFor,
  resetSettleState,
  settleHandlerFor,
} from "./settle.ts";

import type { HookExecutor } from "./dispatch.ts";
import type {
  BeforeAgentStartEvent,
  BeforeAgentStartEventResult,
  ExtensionAPI,
  ExtensionContext,
} from "../../platform/pi-api.ts";
import type { Scope } from "../../shared/types.ts";

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
  resolvedSource: AbsolutePluginRoot,
  config: HooksConfig,
  ifPredicates: ReadonlyMap<string, IfPredicate>,
): void {
  setParsedConfig(cacheKey(scope, marketplace, pluginId), {
    scope,
    marketplace,
    pluginId,
    resolvedSource,
    config,
    ifPredicates,
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
  deleteParsedConfig(cacheKey(scope, marketplace, pluginId));
}

/**
 * Read `hooks.json` from disk, parse via `parseHooksConfig`, and
 * populate `parsedConfigCache`. Both failure arms (read-throw / parse-
 * error) are non-fatal: the resolver already validated the file at
 * orchestrator-entry time, so a fresh failure here is defensive only.
 * The detail routes through the OBS-01 debug seam; reconcile rehydrates
 * the cache from disk on the next pass.
 *
 * `logPrefix` distinguishes install / reinstall / update call sites in
 * debug-log lines so the same shared helper can serve all three
 * orchestrators without losing call-site attribution.
 */
export async function readAndCachePluginHooks(opts: {
  readonly scope: Scope;
  readonly marketplace: string;
  readonly plugin: string;
  readonly resolvedSource: AbsolutePluginRoot;
  readonly hooksJsonPath: string;
  readonly cwd: string;
  readonly logPrefix: string;
}): Promise<void> {
  let raw: string;
  try {
    raw = await readFile(opts.hooksJsonPath, "utf8");
  } catch (err) {
    hookDebugLog(
      `${opts.logPrefix}: hooks.json read failed for ${opts.plugin}@${opts.marketplace}: ${errorMessage(err)}`,
    );
    return;
  }

  // MATCH-03 / A1 projectRoot fallback: cwd doubles as projectRoot;
  // homedir from `os.homedir()` anchors `~`-prefixed path globs in
  // `if`-field rules.
  const ifCtx = { homedir: homedir(), cwd: opts.cwd, projectRoot: opts.cwd };
  const parsed = parseHooksConfig(raw, ifCtx, compileIfPredicate);
  if (!parsed.ok) {
    hookDebugLog(
      `${opts.logPrefix}: parsed hooks.json failed re-parse for ${opts.plugin}@${opts.marketplace}: ${parsed.reason}`,
    );
    return;
  }

  addPluginConfigToCache(
    opts.scope,
    opts.marketplace,
    opts.plugin,
    opts.resolvedSource,
    parsed.value,
    parsed.ifPredicates,
  );
}

// ──────────────────────────────────────────────────────────────────────────
// SessionStart additionalContext bridge
// ──────────────────────────────────────────────────────────────────────────

/**
 * Factory: build the `before_agent_start` handler closure registered on
 * Pi at `registerHooksBridge` time. Each closure captures `capturedEpoch`
 * the same way the composite hook handlers do; on epoch mismatch the
 * closure short-circuits to `undefined` and does NOT drain the live
 * buffer (zombie defense -- a stale closure from a prior bridge load
 * must not consume the new session's pending context).
 *
 * Drain semantics:
 *   - empty buffer -> returns undefined (no systemPrompt mutation, no
 *     `messages` push). Pi's runner emits `before_agent_start` on every
 *     agent turn, not just the first one, so a noop return after the
 *     first drain is the correct path for all subsequent turns.
 *   - non-empty buffer -> joins entries with `"\n\n"` separators between
 *     each entry AND between `event.systemPrompt` and the buffered
 *     block. Returns `{ systemPrompt: <joined> }` and clears the buffer
 *     in the same call (one-shot drain).
 *
 * Each plugin's additionalContext is a one-shot turn primer, not a
 * permanent system-prompt addition; the drain pattern matches upstream
 * Claude Code's SessionStart semantics where the injected text is added
 * to the session prompt once at session boot.
 */
export function beforeAgentStartHandlerFor(
  capturedEpoch: number,
): (
  event: BeforeAgentStartEvent,
  ctx: ExtensionContext,
) => Promise<BeforeAgentStartEventResult | undefined> {
  return (event) => {
    if (capturedEpoch !== currentEpoch()) {
      return Promise.resolve(undefined);
    }

    if (pendingSessionStartContextEntries().length === 0) {
      return Promise.resolve(undefined);
    }

    const buffered = pendingSessionStartContextEntries()
      .map((e) => e.context)
      .join("\n\n");
    clearPendingSessionStartContext();
    return Promise.resolve({ systemPrompt: `${event.systemPrompt}\n\n${buffered}` });
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Rebuild (DISP-02 / DISP-04)
// ──────────────────────────────────────────────────────────────────────────

/**
 * DISP-02 / DISP-04: rebuild the per-Claude-event buckets from the cached
 * parsed configs. Synchronous, zero disk I/O, sub-ms on realistic catalogs.
 *
 * Cross-scope cache walk: `routingTable` is a single module-global Map,
 * and `parsedConfigCache` is the cross-scope authoritative source
 * (install / uninstall / update / reinstall / disable mutators wire
 * `addPluginConfigToCache` and `removePluginConfigFromCache` into their
 * per-plugin locks, and `hydrateCacheFromDisk` rebuilds the cache from
 * each scope's state at factory time). Rebuild walks the entire cache
 * so sequential per-scope rebuild calls (the registerHooksBridge boot
 * loop and applyReconcile's per-scope loop) do not wipe each other's
 * buckets.
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
 * Empty buckets get an empty array so the keyset stays pinned to
 * BUCKET_A_EVENTS rather than growing and shrinking with the cache.
 */
export function rebuildRoutingTables(): void {
  // Pre-seed every bucket so an empty cache still clears any stale entries
  // from a prior rebuild (e.g. uninstall / disable of the last
  // hooks-declaring plugin across both scopes).
  const buckets = new Map<BucketAEvent, RoutingEntry[]>();
  for (const event of BUCKET_A_EVENTS) {
    buckets.set(event, []);
  }

  // Collect every cache entry across both scopes in cross-plugin sort
  // order; declarationIndex is assigned during flatten.
  const sortedEntries = collectAllCachedPlugins();

  for (const cacheEntry of sortedEntries) {
    flattenPluginIntoBuckets(cacheEntry, buckets);
  }

  for (const [event, list] of buckets) {
    setRoutingBucket(event, list);
  }
}

/**
 * Collect every cache entry across both scopes for the rebuild walk.
 * Cross-plugin sort by `compareByNameThenScope` -- project before user,
 * alphabetical by pluginId.
 *
 * The cache is the authoritative source for "currently dispatchable
 * hooks plugins": install / uninstall / update / reinstall / disable
 * keep it in lockstep with state.json + on-disk hooks.json, and
 * `hydrateCacheFromDisk` rebuilds it from each scope's state at factory
 * time. A plugin that exists in state.json but not in the cache (the
 * first-install window before install has run `addPluginConfigToCache`,
 * or a parse failure routed through hookDebugLog) is correctly absent
 * from the routing table -- reconcile-apply calls rebuild again after
 * the install path's addPluginConfigToCache lands.
 */
function collectAllCachedPlugins(): CacheEntry[] {
  const collected = Array.from(parsedConfigEntries().values());

  collected.sort((a, b) =>
    compareByNameThenScope(
      { name: a.pluginId, scope: a.scope },
      { name: b.pluginId, scope: b.scope },
    ),
  );

  return collected;
}

/**
 * Push one matcher group's handlers into its event bucket, in declaration
 * order. Returns the next `declarationIndex` so the caller's running counter
 * stays continuous across every group and event of one plugin.
 */
function pushGroupHandlers(
  cacheEntry: CacheEntry,
  bucket: RoutingEntry[],
  group: HooksConfig[BucketAEvent] extends readonly (infer G)[] ? G : never,
  position: { readonly claudeEvent: BucketAEvent; readonly groupIndex: number },
  startIndex: number,
): number {
  const { claudeEvent, groupIndex } = position;
  const rawMatcher = group.matcher ?? "";
  const matcher = parseMatcher(rawMatcher);
  let declarationIndex = startIndex;

  for (let handlerIndex = 0; handlerIndex < group.hooks.length; handlerIndex++) {
    const handlerDecl = group.hooks[handlerIndex];
    if (handlerDecl === undefined) {
      continue;
    }

    // MATCH-03 / D-61-02 always-present-with-sentinel: a missing key means the
    // handler declared no `if` field, so it falls back to MATCH_ALL_IF.
    const key = `${claudeEvent}|${groupIndex}|${handlerIndex}`;
    bucket.push({
      scope: cacheEntry.scope,
      marketplace: cacheEntry.marketplace,
      pluginId: cacheEntry.pluginId,
      resolvedSource: cacheEntry.resolvedSource,
      claudeEvent,
      matcher,
      rawMatcher,
      handlerDecl,
      declarationIndex,
      ifPredicate: cacheEntry.ifPredicates.get(key) ?? MATCH_ALL_IF,
    });

    declarationIndex += 1;
  }

  return declarationIndex;
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
    const claudeEvent = eventName as BucketAEvent;
    const bucket = buckets.get(claudeEvent);
    if (bucket === undefined) {
      // Unknown event names are filtered by the parser; defensive skip.
      continue;
    }

    for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
      const group = groups[groupIndex];
      if (group !== undefined) {
        declarationIndex = pushGroupHandlers(
          cacheEntry,
          bucket,
          group,
          { claudeEvent, groupIndex },
          declarationIndex,
        );
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
 * call rebuildRoutingTables() per scope after hydrate completes.
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
  const hydrated: HydratedScope[] = [];

  for (const scope of SCOPES) {
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
      state = { ...DEFAULT_STATE };
    }

    // MATCH-03 / A1 projectRoot fallback: pass opts.cwd as cwd +
    // projectRoot for project scope; user-scope hydrate paths use
    // homedir-rooted paths so opts.cwd is the right "current project"
    // anchor for path globs.
    await hydrateScopeFromState(state, loc, opts.cwd);
    hydrated.push({ state, loc });
  }

  return hydrated;
}

/**
 * Per-scope hydrate: iterate state.marketplaces filtered by scope, skip
 * disabled records (ENBL-14), find plugins with declared hook resources, read +
 * parse each hooks.json, and populate the cache. Parse failures are logged
 * through hookDebugLog and skipped (the resolver flips installable: false on
 * the next reconcile).
 */
async function hydrateScopeFromState(
  state: ExtensionState,
  loc: ScopedLocations,
  cwd: string,
): Promise<void> {
  for (const [mpName, mpRecord] of Object.entries(state.marketplaces)) {
    if (mpRecord.scope !== loc.scope) {
      continue;
    }

    for (const [pluginId, pluginRecord] of Object.entries(mpRecord.plugins)) {
      // ENBL-14 / D-100-05: a disabled plugin's hooks must not re-register.
      // The protection used to be incidental -- disable deleted hooks.json, so
      // the read below failed and only logged. ENBL-18 keeps `resources.hooks`
      // populated on a disabled record, so a file restored by any means would
      // hydrate again; the guard makes the deregistration explicit. Read
      // through the single predicate so this site cannot drift from ENBL-05.
      if (isRecordedButDisabled(pluginRecord)) {
        continue;
      }

      const hookSlugs = pluginRecord.resources.hooks;
      if (hookSlugs.length === 0) {
        continue;
      }

      // D-57-03: `resources.hooks` carries the per-plugin hooks-container-dir
      // generatedName; the on-disk file is `<hooksDir>/<generatedName>/hooks.json`.
      // Zero or one entry today; iterate defensively for forward-compat.
      for (const slug of hookSlugs) {
        const hooksJsonPath = path.join(loc.hooksDir, slug, "hooks.json");
        await tryHydrateOnePlugin(
          loc.scope,
          mpName,
          pluginId,
          pluginRecord.resolvedSource,
          hooksJsonPath,
          loc.hooksDir,
          cwd,
        );
      }
    }
  }
}

async function tryHydrateOnePlugin(
  scope: Scope,
  marketplace: string,
  pluginId: string,
  resolvedSource: string,
  hooksJsonPath: string,
  hooksDir: string,
  cwd: string,
): Promise<void> {
  // Defense-in-depth (NFR-10): state.json is normally written only by this
  // extension, but the slug component (`pluginRecord.resources.hooks[i]`) is
  // state-supplied data. A corrupted state record (third-party tampering or
  // future schema mismatch) carrying a traversal slug like `"../../etc"` must
  // not let `readFile` escape `loc.hooksDir`. Mirror the WRITE-site guard at
  // this READ site.
  try {
    await assertPathInside(hooksDir, hooksJsonPath, "hooks.json hydrate path");
  } catch (err) {
    hookDebugLog(
      `hydrate: containment violation for ${scope}/${marketplace}/${pluginId} at ${hooksJsonPath}: ${errorMessage(err)}`,
    );
    return;
  }

  // `resolvedSource` round-trips through `Type.String()` on state.json,
  // which does not constrain shape. Brand-validate at the hydrate boundary
  // so a corrupted record (empty / relative / traversal) is dropped here
  // instead of silently flowing to `CLAUDE_PLUGIN_ROOT` on dispatch.
  let branded: AbsolutePluginRoot;
  try {
    branded = asAbsolutePluginRoot(resolvedSource);
  } catch (err) {
    hookDebugLog(
      `hydrate: invalid resolvedSource for ${scope}/${marketplace}/${pluginId}: ${errorMessage(err)}`,
    );
    return;
  }

  let raw: string;
  try {
    raw = await readFile(hooksJsonPath, "utf8");
  } catch (err) {
    hookDebugLog(
      `hydrate: read failed for ${scope}/${marketplace}/${pluginId} at ${hooksJsonPath}: ${errorMessage(err)}`,
    );
    return;
  }

  // MATCH-03 / A1 projectRoot fallback: cwd doubles as projectRoot;
  // homedir from `os.homedir()` anchors `~`-prefixed path globs.
  const ifCtx = { homedir: homedir(), cwd, projectRoot: cwd };
  const result = parseHooksConfig(raw, ifCtx, compileIfPredicate);
  if (!result.ok) {
    hookDebugLog(`hydrate: parse failed for ${scope}/${marketplace}/${pluginId}: ${result.reason}`);
    return;
  }

  addPluginConfigToCache(scope, marketplace, pluginId, branded, result.value, result.ifPredicates);
}

// ──────────────────────────────────────────────────────────────────────────
// registerHooksBridge (DISP-01 / DISP-02 / DISP-03)
// ──────────────────────────────────────────────────────────────────────────

/**
 * Project-scope deferred-hydrate entrypoint. The factory at index.ts has no
 * access to a project cwd at extension-load time (Pi's `resources_discover`
 * event is the first signal that delivers `event.cwd`), so the factory's
 * factory-time `registerHooksBridge(pi, { cwd: homedir() })` call hydrates
 * ONLY the user scope correctly -- project hydration uses the wrong cwd
 * (it falls back to homedir) and silently misses real project entries.
 *
 * This helper re-runs project-scope hydrate against the correct cwd at the
 * first `resources_discover` event, BEFORE `applyReconcile` runs its
 * per-scope `rebuildRoutingTables` call. The user scope is untouched (its
 * factory-time hydrate already used homedir correctly).
 *
 * DISP-02: cache mutations only; no pi.on, no epoch bump, no rebuild --
 * the caller's `applyReconcile` rebuilds the routing tables per scope.
 */
export async function hydrateProjectScopeForCwd(cwd: string): Promise<void> {
  // WR-01: factory-time hydrate ran with `cwd = homedir()` because
  // `resources_discover` had not fired yet, so any project-scope entries
  // in `parsedConfigCache` were hydrated against the wrong project root
  // (i.e. read from `<homedir>/.pi/...` state, not `<cwd>/.pi/...`). Clear
  // all project-scope entries before re-hydrating against the real cwd so
  // those phantom entries cannot leak into the next `rebuildRoutingTables`
  // pass. The user-scope entries are untouched -- their factory-time hydrate
  // used homedir correctly and remains valid across project-cwd changes.
  // Cache-key shape is `<scope>\x00<marketplace>\x00<pluginId>` (per
  // `cacheKey()`); we scope the delete to keys whose first segment is the
  // literal `"project"` token.
  const projectKeyPrefix = "project\x00";
  // WR-04: snapshot the key set BEFORE iterating + deleting.  ECMAScript
  // does specify that a Map iterator skips entries deleted during
  // iteration, so this is not a correctness change today -- it is a
  // contributor-hygiene change.  A casual reader of the original loop
  // would reach for `Array.from(...)` thinking they need a snapshot;
  // hoisting it here removes that cognitive friction.
  for (const key of Array.from(parsedConfigEntries().keys())) {
    if (key.startsWith(projectKeyPrefix)) {
      deleteParsedConfig(key);
    }
  }

  const loc = locationsFor("project", cwd);

  let state: ExtensionState;
  try {
    state = await loadState(loc.extensionRoot);
  } catch (err) {
    hookDebugLog(
      `hydrate-project: loadState failed for cwd=${cwd} extensionRoot=${loc.extensionRoot}: ${errorMessage(err)}`,
    );
    return;
  }

  await hydrateScopeFromState(state, loc, cwd);
}

/**
 * D-60-06: mkdir-p the per-session `_shared` data dir under `loc.dataRoot`
 * so SessionStart hooks can rely on `CLAUDE_ENV_FILE`'s containing
 * directory existing without the bridge re-checking on every dispatch.
 * Containment-guarded via `assertPathInside` per NFR-10; failures route
 * through `hookDebugLog` and the bridge factory continues. Idempotent
 * across `/reload`.
 */
async function ensureSharedDataDir(loc: ScopedLocations): Promise<void> {
  const sharedDir = path.join(loc.dataRoot, "_shared");
  try {
    await assertPathInside(loc.dataRoot, sharedDir, "_shared data dir");
    await mkdir(sharedDir, { recursive: true });
  } catch (err) {
    hookDebugLog(
      `registerHooksBridge: _shared mkdir failed for scope=${loc.scope}: ${errorMessage(err)}`,
    );
  }
}

/**
 * D-59-03 / DISP-01 / DISP-02 / DISP-03 hooks-bridge factory.
 *
 * Step order is load-bearing:
 *   1. Bump liveEpoch and capture the new value; every closure registered
 *      below sees the captured value and short-circuits on mismatch
 *      against any future bump.
 *   1.5. SIGKILL prior-cycle in-memory async-rewake children (HOOK-06) AND
 *      reap persisted orphans per scope (D-62-05). Runs AFTER the liveEpoch
 *      bump so any stale exit handlers from prior children fall through the
 *      captured-epoch guard rather than firing against the freshly hydrated
 *      session.
 *   2. Hydrate the parsed-config cache from disk for both scopes (factory-
 *      time cold-start path).
 *   3. Rebuild routing tables for both scopes so the first Pi event fires
 *      against a populated table.
 *   4. Register exactly 11 pi.on call sites -- 7 Bucket-A dispatch surfaces
 *      (DISP-01) plus `before_agent_start` (the drain point for the
 *      SessionStart `additionalContext` capture buffer) plus the two
 *      settle-time surfaces `agent_end` (caches the run's last-assistant
 *      message) and `agent_settled` (gates on stopReason to dispatch the
 *      Stop / StopFailure buckets; STOP-01) plus a SECOND `input`
 *      subscription (the STOP-07 loop-protection reset, distinct from the
 *      UserPromptSubmit dispatch handler on the same event). The eight
 *      per-Pi-event Claude buckets fan out from 7 Pi event surfaces because
 *      `tool_result` splits on `event.isError` between the PostToolUse and
 *      PostToolUseFailure buckets (D-59-01); the Stop / StopFailure buckets
 *      are driven off `agent_settled` rather than a per-Pi-event surface. The
 *      locked Pi event-name SET stays 10 (`input` appears twice) -- only the
 *      call COUNT grows to 11.
 *
 * `opts.executor` is the hook-execution injection point, forwarded verbatim
 * to every `compositeHandlerFor` / `toolResultCompositeHandler` /
 * `settleHandlerFor` closure registered in step 4. The sole production caller
 * -- the extension factory in `index.ts` -- does NOT pass it, so production
 * always runs on the `dispatchHookExec` default; it exists so a test can
 * register the real bridge against a spy and assert on routing without
 * spawning a child process. Per CONVENTIONS.md, injecting the dependency is
 * the sanctioned form: it makes the executor part of this function's public
 * interface, where a `_setExecutorForTest` module seam would instead reach
 * inside `dispatch.ts`.
 */
export async function registerHooksBridge(
  pi: ExtensionAPI,
  opts: { ctx: ExtensionContext; cwd: string; executor?: HookExecutor },
): Promise<void> {
  const capturedEpoch = bumpEpoch();

  // /reload re-enters this factory and must not leak a stale SessionStart
  // additionalContext entry from the prior session into the new buffer.
  // Clearing here makes the invariant explicit: each bridge load starts
  // with an empty pending buffer, which only `adaptObservationResultForEvent`
  // (via `appendPendingSessionStartContext`) can subsequently populate.
  clearPendingSessionStartContext();

  // Same epoch hygiene for the settle dispatcher's cached last-assistant
  // message: clear it so a `/reload` cannot leak the prior session's message
  // into the new one's `stopReason` gate.
  resetSettleState();

  // HOOK-06 / D-62-05: SIGKILL every in-memory async-rewake child from
  // the prior factory invocation BEFORE the persisted-orphan reap reads
  // the PID table. The in-memory walk covers same-process /reload
  // cycles; reapOrphans below covers cross-process crash recovery.
  shutdownInMemoryChildren();

  const hydrated = await hydrateCacheFromDisk(opts);
  for (const { loc } of hydrated) {
    rebuildRoutingTables();
    // D-60-06: ensure the per-session `_shared` data dir exists so a
    // SessionStart hook's `CLAUDE_ENV_FILE = <dataRoot>/_shared/...` path
    // can be written by the hook without the bridge having to do it from
    // inside dispatchHookExec. Gate on at least one SessionStart entry
    // actually existing in the rebuilt routing table for this scope: an
    // unsolicited mkdir on a pristine scope would create
    // `<scopeRoot>/pi-claude-marketplace/...` and violate WR-05 (the "no
    // files on a clean reconcile" invariant pinned by
    // tests/edge/index-handler.test.ts). When no plugin declares
    // SessionStart hooks the env-file path will never be set, so the
    // dir's absence is harmless. Idempotent across `/reload` via mkdir {
    // recursive }; failures route through hookDebugLog.
    if (getRoutingBucket("SessionStart").length > 0) {
      await ensureSharedDataDir(loc);
    }

    // EXEC-05 / D-62-05: read the persisted PID table for this scope,
    // probe each PID via kill 0, verify /proc/<pid>/environ marker on
    // Linux (soft-skip on macOS / read failure / marker mismatch --
    // NEVER kill strangers), SIGKILL surviving owned PIDs, unlink the
    // table. Awaited so the pi.on registrations below cannot race
    // against an in-flight kill probe.
    await reapOrphans(loc);
  }

  // SessionStart dispatch with lazy project-scope hydrate. Pi fires
  // session_start BEFORE resources_discover (pi docs: resources_discover is
  // "Fired after session_start so extensions can contribute additional
  // skill, prompt, and theme paths"), so the factory-time
  // hydrateCacheFromDisk above -- which ran with cwd=homedir() because no
  // project cwd was available at extension-load time -- could not have
  // populated project-scope entries, and the deferred project hydrate
  // wired into resources_discover (index.ts) has not run yet either.
  // Without this lazy hydrate the SessionStart routing bucket is empty for
  // project scope at dispatch time, so project-scope SessionStart hooks
  // never fire -- they only become reachable once resources_discover
  // rebuilds the tables, by which point the SessionStart event has
  // already passed.
  //
  // Re-run project-scope hydrate against ctx.cwd now, rebuild the routing
  // tables so the SessionStart bucket picks up the project entries, and
  // ensure the project _shared data dir exists for CLAUDE_ENV_FILE (the
  // factory-time ensureSharedDataDir loop used cwd=homedir() so the
  // project loc pointed at <homedir>/.pi, not the real project). Then
  // delegate to the composite handler, which re-reads the now-populated
  // bucket via getRoutingBucket. Hydrate/mkdir failures are swallowed via
  // the OBS-01 debug seam so a hydrate error never blocks SessionStart
  // dispatch -- matching the resources_discover deferred-hydrate stance.
  // The pi.on call count (DISP-01: 11) and locked event-name set (10) are
  // unchanged: this wraps the existing session_start handler, it does not
  // add a registration.
  const sessionStartHandler = compositeHandlerFor("SessionStart", capturedEpoch, pi, opts.executor);
  pi.on("session_start", async (event, ctx) => {
    try {
      await hydrateProjectScopeForCwd(ctx.cwd);
      rebuildRoutingTables();
      if (getRoutingBucket("SessionStart").some((e) => e.scope === "project")) {
        await ensureSharedDataDir(locationsFor("project", ctx.cwd));
      }
    } catch (err) {
      hookDebugLog(`session_start lazy project hydrate skipped: ${errorMessage(err)}`);
    }

    return sessionStartHandler(event, ctx);
  });
  pi.on("session_shutdown", compositeHandlerFor("SessionEnd", capturedEpoch, pi, opts.executor));
  pi.on(
    "session_before_compact",
    compositeHandlerFor("PreCompact", capturedEpoch, pi, opts.executor),
  );
  pi.on("session_compact", compositeHandlerFor("PostCompact", capturedEpoch, pi, opts.executor));
  pi.on("input", compositeHandlerFor("UserPromptSubmit", capturedEpoch, pi, opts.executor));
  pi.on("tool_call", compositeHandlerFor("PreToolUse", capturedEpoch, pi, opts.executor));
  pi.on("tool_result", toolResultCompositeHandler(capturedEpoch, pi, opts.executor));
  // SessionStart additionalContext drain: every agent turn fires
  // before_agent_start; the handler returns early when the pending
  // buffer is empty so the no-context path is a single Map lookup per
  // turn.
  pi.on("before_agent_start", beforeAgentStartHandlerFor(capturedEpoch));
  // Settle-time turn-boundary dispatch: agent_end caches the run's
  // last-assistant message; agent_settled reads it and gates on stopReason
  // to run the Stop / StopFailure buckets (STOP-01).
  pi.on("agent_end", agentEndCacheHandler(capturedEpoch));
  pi.on("agent_settled", settleHandlerFor(capturedEpoch, pi, opts.executor));
  // STOP-07 loop-protection reset: a dedicated second `input` subscription
  // (distinct from the UserPromptSubmit dispatch handler above) clears
  // `stop_hook_active` and resets the consecutive-block counter + one-shot cap
  // latch on a genuine user input. Bridge-injected `sendMessage` re-entries do
  // NOT pass through `input`, so the flag never self-clears.
  pi.on("input", inputResetHandlerFor(capturedEpoch));
}

// ──────────────────────────────────────────────────────────────────────────
// Test-only inspectors -- NOT re-exported from bridges/hooks/index.ts.
// ──────────────────────────────────────────────────────────────────────────

/**
 * Returns the routingTable as-is so unit tests can assert against its
 * contents. Not part of the public surface.
 */
export function _routingTableForTest(): ReadonlyMap<BucketAEvent, ReadonlyArray<RoutingEntry>> {
  return routingTableEntries();
}

/**
 * Returns the parsedConfigCache as-is so unit tests can assert on cache
 * mutator idempotency without exposing the key format. Not part of the
 * public surface.
 */
export function _parsedConfigCacheForTest(): ReadonlyMap<string, CacheEntry> {
  return parsedConfigEntries();
}

/**
 * Resets all module-state cells. Used by unit tests so each test starts
 * from a clean baseline. Not part of the public surface.
 */
export function _resetForTest(): void {
  resetEpoch();
  clearParsedConfigCache();
  clearRoutingTable();
  clearPendingSessionStartContext();
}

/**
 * Test-only inspector for the pending SessionStart additionalContext
 * buffer. Returns a snapshot of the buffer; mutating the returned array
 * does not affect the module state. Not part of the public surface.
 */
export function _peekPendingSessionStartContextForTest(): ReadonlyArray<PendingSessionStartContext> {
  return Array.from(pendingSessionStartContextEntries());
}

/**
 * Synthetic epoch bump for unit tests that pin the
 * mismatch-causes-no-op contract without exercising the full
 * registerHooksBridge factory path. Not part of the public surface.
 */
export function _bumpEpochForTest(): number {
  return bumpEpoch();
}

/**
 * Inject a synthetic bucket directly into the routing table so dispatch
 * tests can exercise the composite-handler closures without first
 * standing up a full state + cache fixture. Not part of the public
 * surface.
 */
export function _setRoutingBucketForTest(
  claudeEvent: BucketAEvent,
  entries: ReadonlyArray<RoutingEntry>,
): void {
  setRoutingBucket(claudeEvent, entries);
}

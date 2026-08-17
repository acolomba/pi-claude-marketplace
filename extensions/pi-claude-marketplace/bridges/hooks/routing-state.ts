// bridges/hooks/routing-state.ts
//
// Leaf-ward home for the hooks bridge's shared module state: the per-event
// routing table, the parsed-config cache, the live epoch cell, and the
// SessionStart additionalContext buffer (D-59-02 / D-59-03), plus the record
// shapes those cells are keyed on.
//
// The state lives here rather than in `event-router.ts` so the dispatch
// chain can read it without importing the hub back. `dispatch.ts`,
// `dispatch-exec.ts`, `event-adapters.ts`, `settle.ts`, and
// `async-rewake/registry.ts` all need `RoutingEntry`, `currentEpoch()`, or
// `getRoutingBucket()`, while `event-router.ts` needs handler factories from
// those same files. Pointing the state readers at this leaf leaves every
// remaining edge one-directional, and a one-directional edge cannot cycle.
//
// INVARIANT that keeps it that way: this module imports only `domain/`,
// `shared/`, and the same-zone `if-field/` (itself leaf-ward relative to
// dispatch). It must never import `event-router.ts`, `dispatch.ts`,
// `dispatch-exec.ts`, `event-adapters.ts`, `settle.ts`, or
// `async-rewake/registry.ts` -- any one of those import edges restores the
// cycle knot this module exists to remove. `npm run fallow` gates it.
//
// ESM imported bindings are read-only, so a reassigned cell can only live
// here if its writes live here too. The two Maps are `const` and mutated in
// place, so they are exported directly; `liveEpoch` and
// `pendingSessionStartContext` are reassigned and stay module-private behind
// named mutators.

import { type BucketAEvent } from "../../domain/components/hook-events.ts";
import {
  type HookHandlerEntry,
  type HooksConfig,
  type ParsedMatcher,
} from "../../domain/components/hooks.ts";
import { type AbsolutePluginRoot } from "../../domain/plugin-root.ts";
import { type Scope } from "../../shared/types.ts";

import { type IfPredicate } from "./if-field/index.ts";

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
  /**
   * Absolute filesystem path of the plugin source dir, mirroring
   * `state.json::marketplaces[mp].plugins[id].resolvedSource`. Dispatch-exec
   * exports this as `CLAUDE_PLUGIN_ROOT` so hook handlers using the standard
   * `${CLAUDE_PLUGIN_ROOT}/...` interpolation resolve to a real path on
   * disk. Carried on RoutingEntry so dispatch does not have to re-read
   * state.json on every event. Branded so the type system blocks
   * unvalidated strings flowing to the subprocess env.
   */
  readonly resolvedSource: AbsolutePluginRoot;
  /**
   * D-60-01 / D-60-04: the Claude-side bucket this entry was flattened
   * into. The translator dispatch in `dispatch-exec.ts` keys on this
   * field to pick `./payloads/<event>.ts` without re-deriving the bucket
   * from the routing table's outer Map key.
   */
  readonly claudeEvent: BucketAEvent;
  readonly matcher: ParsedMatcher;
  readonly rawMatcher: string;
  readonly handlerDecl: HookHandlerEntry;
  readonly declarationIndex: number;
  /**
   * MATCH-03 / D-61-02 always-present-with-sentinel: absent or
   * malformed `if` resolves to MATCH_ALL_IF so dispatch never observes
   * undefined. Populated from the side-Map produced by
   * `parseHooksConfig` at parse time -- never recompiled at flatten
   * time (mirrors the registration-time-translation stance).
   */
  readonly ifPredicate: IfPredicate;
}

/**
 * One plugin's parsed hooks config as held in `parsedConfigCache`. Exported
 * (unlike its former module-private form in `event-router.ts`) because
 * `_parsedConfigCacheForTest` names it across the module boundary.
 */
export interface CacheEntry {
  readonly scope: Scope;
  readonly marketplace: string;
  readonly pluginId: string;
  /**
   * Absolute path of the plugin source dir; flows through to
   * `RoutingEntry.resolvedSource` so dispatch-exec can export
   * `CLAUDE_PLUGIN_ROOT` to a real path. Mirrors
   * `state.json::marketplaces[mp].plugins[id].resolvedSource`. Branded
   * so the type system blocks unvalidated strings.
   */
  readonly resolvedSource: AbsolutePluginRoot;
  readonly config: HooksConfig;
  /**
   * MATCH-03: compiled `if`-field predicates keyed on
   * `${claudeEvent}|${groupIndex}|${handlerIndex}`. Carried alongside
   * the parsed `config` so `flattenPluginIntoBuckets` can populate
   * each `RoutingEntry.ifPredicate` field without re-parsing.
   */
  readonly ifPredicates: ReadonlyMap<string, IfPredicate>;
}

/**
 * SessionStart additionalContext capture buffer.
 *
 * Pi splits the upstream Claude Code SessionStart-hook protocol across two
 * surfaces: `session_start` returns void (no slot to thread context
 * through), and `before_agent_start` carries the `systemPrompt` chain Pi
 * uses for extension-supplied context injection. The hooks bridge captures
 * a SessionStart hook's `additionalContext` payload into this buffer at
 * the `event-adapters.ts` mutate arm, then drains it on the next
 * `before_agent_start` event so the model's first agent turn sees the
 * injected text.
 *
 * Concat semantics: multiple SessionStart-bearing plugins fold into the
 * buffer in declaration order. Drain joins with `"\n\n"` separators and
 * clears the buffer (one-shot drain). The buffer also resets on every
 * `registerHooksBridge` entry so `/reload` cannot leak stale context from
 * the prior session.
 *
 * Typed accumulator (not a string bag): each entry carries provenance
 * (scope/marketplace/pluginId) so OBS-01 debug telemetry can attribute
 * leaks back to the contributing plugin without re-deriving from a flat
 * string. Provenance is dropped at drain time -- only the joined text
 * reaches `before_agent_start.systemPrompt`.
 */
export interface PendingSessionStartContext {
  readonly context: string;
  readonly pluginId: string;
  readonly marketplace: string;
  readonly scope: Scope;
}

// ──────────────────────────────────────────────────────────────────────────
// Module-state cells (D-59-02 / D-59-03)
//
// Every cell here is module-private and reached through the named accessors
// below. `const` Maps have interior mutability, so exporting one would let
// any importer write it without the declaring module having a say -- which
// is how the read path for `routingTable` came to run through an accessor
// in some call sites and the raw Map in others.
// ──────────────────────────────────────────────────────────────────────────

const parsedConfigCache = new Map<string, CacheEntry>();

const routingTable = new Map<BucketAEvent, ReadonlyArray<RoutingEntry>>();

let liveEpoch = 0;

let pendingSessionStartContext: PendingSessionStartContext[] = [];

/**
 * D-59-03: read-only accessor for the live epoch cell. Used by the
 * dispatch.ts composite handlers (which capture the value at
 * registerHooksBridge time and compare against `currentEpoch()` on every
 * event) and by tests that pin the no-op-on-mismatch contract.
 */
export function currentEpoch(): number {
  return liveEpoch;
}

/**
 * Increment the epoch and return the new value. A mutator rather than an
 * exported `let`: ESM imported bindings are read-only, so the cell can only
 * live in this leaf if its writes live here too. Called on every
 * `registerHooksBridge` entry, which captures the returned value as the
 * epoch its handler closures compare against.
 */
export function bumpEpoch(): number {
  liveEpoch += 1;
  return liveEpoch;
}

/**
 * Return the epoch to its initial value. Exists for the same read-only
 * imported-binding reason as `bumpEpoch`; the test reset seam is its only
 * caller.
 */
export function resetEpoch(): void {
  liveEpoch = 0;
}

/**
 * Append a SessionStart hook's `additionalContext` payload to the pending
 * buffer. Called by `event-adapters.ts::adaptObservationResultForEvent`
 * when a SessionStart hook returns
 * `{hookSpecificOutput: {additionalContext: "..."}}`. The
 * `beforeAgentStartHandlerFor` closure drains the buffer on the next
 * `before_agent_start` event.
 *
 * Idempotent for noop append (empty string): empty strings are silently
 * skipped so a buggy hook returning `additionalContext: ""` does not
 * pollute the join output with a leading blank line. Provenance is still
 * required on the argument shape so the call site always carries
 * attribution -- the skipped-empty arm just discards both.
 */
export function appendPendingSessionStartContext(entry: PendingSessionStartContext): void {
  if (entry.context.length === 0) {
    return;
  }

  pendingSessionStartContext.push(entry);
}

/**
 * Read-only view of the pending buffer. The buffer cell is reassigned on
 * clear, so importers cannot bind it directly and read it through this
 * accessor instead.
 */
export function pendingSessionStartContextEntries(): ReadonlyArray<PendingSessionStartContext> {
  return pendingSessionStartContext;
}

/**
 * Empty the pending buffer. Reassignment rather than in-place truncation is
 * why this is a named mutator: an importing module cannot write an imported
 * binding, so the drain path and the `/reload` hygiene path both call here.
 */
export function clearPendingSessionStartContext(): void {
  pendingSessionStartContext = [];
}

/**
 * D-59-02: upsert one plugin's parsed hooks config. Idempotent -- a replay
 * overwrites the existing entry rather than duplicating it.
 */
export function setParsedConfig(key: string, entry: CacheEntry): void {
  parsedConfigCache.set(key, entry);
}

/**
 * D-59-02: drop one plugin's parsed hooks config. Removing a missing key is
 * a no-op, which is what makes the uninstall and re-hydrate paths safe to
 * retry.
 */
export function deleteParsedConfig(key: string): void {
  parsedConfigCache.delete(key);
}

/**
 * Drop every parsed config. Paired with the two mutators above so the cache
 * has one write surface.
 */
export function clearParsedConfigCache(): void {
  parsedConfigCache.clear();
}

/**
 * Read-only view of the parsed-config cache, for the rebuild walk (which
 * needs every value) and the phantom-entry sweep (which needs every key).
 */
export function parsedConfigEntries(): ReadonlyMap<string, CacheEntry> {
  return parsedConfigCache;
}

/**
 * Read one per-event routing bucket. Returns the bucket or an empty array;
 * never undefined. The `routingTable` cell is module-private, so every
 * consumer reaches a bucket through here.
 */
export function getRoutingBucket(claudeEvent: BucketAEvent): ReadonlyArray<RoutingEntry> {
  return routingTable.get(claudeEvent) ?? [];
}

/**
 * Replace one per-event routing bucket. Named mutator rather than a raw
 * exported Map: interior mutability would otherwise let any importer write
 * the cell, which is how the read side drifted onto two different paths
 * (accessor here, `routingTable.get` at the call site) before the cell was
 * made private.
 */
export function setRoutingBucket(
  claudeEvent: BucketAEvent,
  entries: ReadonlyArray<RoutingEntry>,
): void {
  routingTable.set(claudeEvent, entries);
}

/**
 * Drop every bucket. Paired with `setRoutingBucket` so the rebuild path and
 * the test-reset path share one write surface.
 */
export function clearRoutingTable(): void {
  routingTable.clear();
}

/**
 * Read-only view of the whole table, for callers that need the keyset rather
 * than one bucket. Mirrors `pendingSessionStartContextEntries` for the other
 * collection cell in this module.
 */
export function routingTableEntries(): ReadonlyMap<BucketAEvent, ReadonlyArray<RoutingEntry>> {
  return routingTable;
}

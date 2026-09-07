// bridges/hooks/routing-state.ts
//
// Leaf-ward home for the hooks bridge's routing operations and the record
// shapes those operations use (D-59-02 / D-59-03).
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
// `shared/`, `runtime.ts`, and the same-zone `if-field/` (itself leaf-ward
// relative to dispatch). It must never import `event-router.ts`, `dispatch.ts`,
// `dispatch-exec.ts`, `event-adapters.ts`, `settle.ts`, or
// `async-rewake/registry.ts` -- any one of those import edges restores the
// cycle knot this module exists to remove. `npm run fallow` gates it.
//
// Current production callers still use the no-runtime signatures below. They
// all delegate to one private eager transition binding. Plans 05-09 through
// 05-30 migrate those callers to explicit runtime ownership; Plan 05-31 owns
// deletion of the compatibility resets after that census reaches zero.

import { type BucketAEvent } from "../../domain/components/hook-events.ts";
import {
  type HookHandlerEntry,
  type HooksConfig,
  type ParsedMatcher,
} from "../../domain/components/hooks.ts";
import { type AbsolutePluginRoot } from "../../domain/plugin-root.ts";
import { type Scope } from "../../shared/types.ts";

import { type IfPredicate } from "./if-field/index.ts";
import { createHooksRuntime, type HooksRuntime } from "./runtime.ts";

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
 * because `parsedConfigEntries` names it across the module boundary.
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
// Runtime-bound operations and bounded production transition
// ──────────────────────────────────────────────────────────────────────────

/** Routing behavior bound to one required hooks runtime. */
export interface RoutingStateOperations {
  readonly currentEpoch: () => number;
  readonly bumpEpoch: () => number;
  readonly appendPendingSessionStartContext: (entry: PendingSessionStartContext) => void;
  readonly pendingSessionStartContextEntries: () => readonly PendingSessionStartContext[];
  readonly clearPendingSessionStartContext: () => void;
  readonly setParsedConfig: (key: string, entry: CacheEntry) => void;
  readonly deleteParsedConfig: (key: string) => void;
  readonly parsedConfigEntries: () => ReadonlyMap<string, CacheEntry>;
  readonly getRoutingBucket: (event: BucketAEvent) => readonly RoutingEntry[];
  readonly setRoutingBucket: (
    event: BucketAEvent,
    entries: readonly RoutingEntry[],
  ) => void;
  readonly routingTableEntries: () => ReadonlyMap<BucketAEvent, readonly RoutingEntry[]>;
}

/** Binds routing behavior to an explicitly supplied runtime lifetime. */
export function createRoutingStateOperations(runtime: HooksRuntime): RoutingStateOperations {
  return {
    currentEpoch: runtime.currentGeneration,
    bumpEpoch: runtime.advanceGeneration,
    appendPendingSessionStartContext: runtime.appendPendingSessionStartContext,
    pendingSessionStartContextEntries: runtime.pendingSessionStartContextEntries,
    clearPendingSessionStartContext: runtime.preparePendingContextForRegistration,
    setParsedConfig: runtime.setParsedConfig,
    deleteParsedConfig: runtime.deleteParsedConfig,
    parsedConfigEntries: runtime.parsedConfigEntries,
    getRoutingBucket: runtime.getRoutingBucket,
    setRoutingBucket: runtime.setRoutingBucket,
    routingTableEntries: runtime.routingTableEntries,
  };
}

let transitionRoutingState = createRoutingStateOperations(createHooksRuntime());

function replaceTransitionRoutingState(): void {
  transitionRoutingState = createRoutingStateOperations(createHooksRuntime());
}

/**
 * D-59-03: read-only accessor for the live epoch cell. Used by the
 * dispatch.ts composite handlers (which capture the value at
 * registerHooksBridge time and compare against `currentEpoch()` on every
 * event) and by tests that pin the no-op-on-mismatch contract.
 */
export function currentEpoch(): number {
  return transitionRoutingState.currentEpoch();
}

/**
 * Increment the transition runtime's epoch and return the new value. Called
 * on every `registerHooksBridge` entry, which captures the returned value as
 * the epoch its handler closures compare against.
 */
export function bumpEpoch(): number {
  return transitionRoutingState.bumpEpoch();
}

/**
 * Return only the transition epoch to its initial value. This compatibility
 * reset remains for unmigrated callers until Plan 05-31; other routing state
 * survives the runtime replacement.
 */
export function resetEpoch(): void {
  const parsedEntries = transitionRoutingState.parsedConfigEntries();
  const routingEntries = transitionRoutingState.routingTableEntries();
  const pendingEntries = transitionRoutingState.pendingSessionStartContextEntries();
  replaceTransitionRoutingState();
  for (const [key, entry] of parsedEntries) {
    transitionRoutingState.setParsedConfig(key, entry);
  }

  for (const [event, entries] of routingEntries) {
    transitionRoutingState.setRoutingBucket(event, entries);
  }

  for (const entry of pendingEntries) {
    transitionRoutingState.appendPendingSessionStartContext(entry);
  }
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
  transitionRoutingState.appendPendingSessionStartContext(entry);
}

/**
 * Read-only snapshot of the pending buffer.
 */
export function pendingSessionStartContextEntries(): ReadonlyArray<PendingSessionStartContext> {
  return transitionRoutingState.pendingSessionStartContextEntries();
}

/**
 * Empty the transition runtime's pending buffer.
 */
export function clearPendingSessionStartContext(): void {
  transitionRoutingState.clearPendingSessionStartContext();
}

/**
 * D-59-02: upsert one plugin's parsed hooks config. Idempotent -- a replay
 * overwrites the existing entry rather than duplicating it.
 */
export function setParsedConfig(key: string, entry: CacheEntry): void {
  transitionRoutingState.setParsedConfig(key, entry);
}

/**
 * D-59-02: drop one plugin's parsed hooks config. Removing a missing key is
 * a no-op, which is what makes the uninstall and re-hydrate paths safe to
 * retry.
 */
export function deleteParsedConfig(key: string): void {
  transitionRoutingState.deleteParsedConfig(key);
}

/**
 * Read-only view of the parsed-config cache, for the rebuild walk (which
 * needs every value) and the phantom-entry sweep (which needs every key).
 */
export function parsedConfigEntries(): ReadonlyMap<string, CacheEntry> {
  return transitionRoutingState.parsedConfigEntries();
}

/**
 * Read one per-event routing bucket. Returns the bucket or an empty array;
 * never undefined.
 */
export function getRoutingBucket(claudeEvent: BucketAEvent): ReadonlyArray<RoutingEntry> {
  return transitionRoutingState.getRoutingBucket(claudeEvent);
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
  transitionRoutingState.setRoutingBucket(claudeEvent, entries);
}

/**
 * Read-only view of the whole table, for callers that need the keyset rather
 * than one bucket. Mirrors `pendingSessionStartContextEntries` for the other
 * collection cell in this module.
 */
export function routingTableEntries(): ReadonlyMap<BucketAEvent, ReadonlyArray<RoutingEntry>> {
  return transitionRoutingState.routingTableEntries();
}

/**
 * Replace the private transition runtime with a fresh runtime.
 *
 * This compatibility reset remains only for unmigrated callers and is owned
 * for deletion by Plan 05-31 after the caller census reaches zero.
 */
export function resetRoutingState(): void {
  replaceTransitionRoutingState();
}

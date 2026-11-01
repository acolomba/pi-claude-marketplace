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
// Every caller binds these operations to an explicit HooksRuntime. No module-
// owned routing lifetime exists here.

import { type BucketAEvent } from "../../domain/components/hook-events.ts";
import {
  type HookHandlerEntry,
  type HooksConfig,
  type ParsedMatcher,
} from "../../domain/components/hooks.ts";
import { type AbsolutePluginRoot } from "../../domain/plugin-root.ts";
import { type Scope } from "../../shared/types.ts";

import { type IfPredicate } from "./if-field/index.ts";
import { type HooksRuntime } from "./runtime.ts";

/**
 * Flattened (event, group, handler) routing slot. The dispatch core walks
 * the per-event bucket, runs `dispatchHookExec(entry, event, ctx)` in
 * parallel for every entry whose matcher fires for the incoming Pi event,
 * and folds the results in bucket order (D-CF5-09).
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
 * through), and `before_agent_start` can add a message to the next turn.
 * The hooks bridge captures a SessionStart hook's `additionalContext`
 * payload into this buffer at the `event-adapters.ts` mutate arm, then
 * drains it on the next `before_agent_start` event into a persisted message
 * after that turn's prompt, so the first turn and every later one see it
 * (D-CF5-13).
 *
 * Concat semantics: multiple SessionStart-bearing plugins fold into the
 * buffer in routing order. The drain joins the values with `"\n"` into one
 * `SessionStart hook additional context: <values>` text part and clears the
 * buffer (one-shot drain). The buffer also resets on every
 * `registerHooksBridge` entry so `/reload` cannot leak stale context from
 * the prior session.
 *
 * Typed accumulator (not a string bag): each entry carries provenance
 * (scope/marketplace/pluginId) so OBS-01 debug telemetry can attribute
 * leaks back to the contributing plugin without re-deriving from a flat
 * string. Provenance is dropped at drain time -- only the joined text
 * reaches the message.
 */
export interface PendingSessionStartContext {
  readonly context: string;
  readonly pluginId: string;
  readonly marketplace: string;
  readonly scope: Scope;
}

/**
 * D-CF5-13: a UserPromptSubmit hook's folded `additionalContext`, buffered by
 * the `input` adapter and drained by the `before_agent_start` handler of the
 * same prompt's turn into a message after the prompt. The prompt itself
 * reaches the model unchanged. Provenance is the entry the fold attributes
 * the context to, as for `PendingSessionStartContext`.
 */
export interface PendingPromptContext {
  readonly context: string;
  readonly pluginId: string;
  readonly marketplace: string;
  readonly scope: Scope;
}

// ──────────────────────────────────────────────────────────────────────────
// Runtime-bound operations
// ──────────────────────────────────────────────────────────────────────────

/**
 * Routing behavior bound to one required hooks runtime. The members it shares
 * with `HooksRuntime` are the runtime's own; the rest rename a runtime member.
 */
export interface RoutingStateOperations extends Pick<
  HooksRuntime,
  | "appendPendingSessionStartContext"
  | "pendingSessionStartContextEntries"
  | "setParsedConfig"
  | "deleteParsedConfig"
  | "parsedConfigEntries"
  | "getRoutingBucket"
  | "setRoutingBucket"
  | "routingTableEntries"
> {
  readonly currentEpoch: HooksRuntime["currentGeneration"];
  readonly bumpEpoch: HooksRuntime["advanceGeneration"];
  readonly clearPendingSessionStartContext: HooksRuntime["preparePendingContextForRegistration"];
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

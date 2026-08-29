// domain/components/hooks.ts
//
// TypeBox schema for Claude `hooks/hooks.json` files + `parseHooksConfig`
// discriminated parser. Consumed by `domain/resolver.ts`: a structural parse
// failure (`{ ok: false }`) resolves `state: "unavailable"` per D-57-04; a
// successful parse whose partition dropped unsupportable events / matcher groups
// / handlers resolves `state: "partially-available"` (partially-available) carrying the
// `{unsupported hooks}` reason.
//
// HOOK-03: `additionalProperties: true` at EVERY nesting level. Unknown
// extension field names on a hook entry, unknown top-level event keys, and
// unknown handler-type literals are all silently accepted so v1.14+
// event-set promotions and Claude Code field additions never force a
// downstream version-bump cascade.
//
// D-57-02: the top-level shape is `Type.Record(Type.String(), ...)`. Bucket-A
// admission (`SessionStart` / `PreToolUse` / etc.) is NOT enforced here --
// the supportability gate lives in TOOL-02(c) (a sibling concern). The
// schema's only structural gates are JSON shape (object with array values)
// and -- conditionally -- the REQUIRED `command` field on a `type: "command"`
// handler entry (Claude's Discretion locked in 57-CONTEXT.md).
//
// D-57-04: structural parse failures (invalid JSON, structural shape mismatch,
// missing REQUIRED `command` on a `type: "command"` handler) surface through
// `parseHooksConfig` as `{ ok: false, reason }`. The resolver routes these to
// the `state: "unavailable"` arm. A parseable config that merely drops
// unsupportable entries instead resolves `state: "partially-available"` with the
// `{unsupported hooks}` reason (the `{ ok: true }` arm carries
// `dropped: readonly DroppedHook[]`).
// `hookDebugLog` is the OBS-01 debug-output seam (imported from
// shared/debug-log.ts); env-gated on `PI_CLAUDE_MARKETPLACE_DEBUG === "1"`,
// the sanctioned IL-2 / IL-3 escape lives at the seam's canonical home and
// no console.* call survives in this file.
//
// HOOK-03 / LIFE-01: `parseHooksConfig` accepts TWO wire shapes -- the
// upstream PLUGIN-format wrapper `{description?, hooks: {<event>: [...]}}`
// per Claude Code `plugin-dev/skills/hook-development/SKILL.md`, AND the
// bare SETTINGS-format top-level-event-keys shape `{<event>: [...]}`. The
// wrapper-detection step at the head of the function unwraps `parsed.hooks`
// when the wrapper is present; otherwise it validates `parsed` directly
// (backward-compat). Real upstream plugins (hookify and siblings) ship the
// wrapper form; in-tree configs that happen to be bare-shaped continue to
// validate via the unchanged arm.

import { hookDebugLog } from "../../shared/debug-log.ts";
import { errorMessage } from "../../shared/errors.ts";

import { TOOL_EVENTS, type BucketAEvent, type ToolEvent } from "./hook-events.ts";
import { partitionHooks, type DroppedHook, type HooksPartition } from "./hooks/partition.ts";
import { HOOKS_VALIDATOR, type HookHandlerEntry, type HooksConfig } from "./hooks/schema.ts";

export { parseMatcher, type ParsedMatcher } from "./hooks/matcher.ts";
export type { DroppedHook } from "./hooks/partition.ts";
export {
  HOOKS_CONFIG_SCHEMA,
  HOOKS_VALIDATOR,
  type HookHandlerEntry,
  type HooksConfig,
} from "./hooks/schema.ts";

import type { ClaudeHookEvent, HookSummaryEntry } from "../../shared/concerns/hooks.ts";

const TOOL_EVENT_MEMBERS = new Set<string>(TOOL_EVENTS);

// MATCH-03: the `if`-field permission-rule primitives live in
// `bridges/hooks/if-field/` -- domain MUST NOT import upward
// (D-11 import direction). `parseHooksConfig` consumes
// the predicate compile path as a generic `<P>` callback parameter so
// the parser layer never type-depends on the concrete predicate union.
// The bridge layer wires `compileIfPredicate` at the `parseHooksConfig`
// call site; the resolver supplies a no-op that returns a fixed
// fall-open sentinel because it only consumes the discriminated
// installable arm, not the side-Map.

/**
 * Anchor context consumed by the `compileIf` callback. Mirrors the
 * shape `bridges/hooks/if-field/index.ts::CompileIfPredicateContext`
 * structurally -- duplicated here so the parser does not depend on
 * the bridge surface (D-11 import direction).
 */
export interface CompileIfPredicateContext {
  readonly homedir: string;
  readonly cwd: string;
  readonly projectRoot: string;
}

/**
 * MATCH-03 callback type. The bridge layer (`event-router.ts`,
 * orchestrators) supplies `compileIfPredicate` from
 * `bridges/hooks/if-field/`; the resolver supplies a no-op returning
 * a fixed fall-open sentinel (it only cares about the installable
 * verdict). The callback MUST be pure and total (never throws past
 * its return type) -- the parser does not wrap call sites in
 * try/catch.
 *
 * Generic in `P` so the bridge layer's concrete `IfPredicate`
 * discriminated union flows out via `parseHooksConfig` typed
 * correctly without the domain parser importing the union.
 */
export type CompileIfCallback<P> = (
  rawIf: string,
  claudeEvent: BucketAEvent,
  ctx: CompileIfPredicateContext,
) => P;

// ──────────────────────────────────────────────────────────────────────────
// Wire-format discrimination (plugin wrapper vs. settings bare shape)
// ──────────────────────────────────────────────────────────────────────────

/**
 * Heuristic for the upstream PLUGIN-format wrapper shape per Claude Code
 * `plugin-dev/skills/hook-development/SKILL.md`:
 * `{description?: string, hooks: {<event>: [...], ...}}`.
 *
 * Returns `true` IFF `v` is a plain non-null non-array object carrying an
 * own `hooks` property whose value is itself a plain non-null non-array
 * object. `parseHooksConfig` then validates the unwrapped `v.hooks`
 * against `HOOKS_VALIDATOR` instead of `v`.
 *
 * The heuristic is purely structural -- a crafted value that satisfies it
 * still flows through the same `HOOKS_VALIDATOR.Check` the bare arm uses,
 * so no new validation surface is introduced.
 */
function isPluginWrapper(v: unknown): v is { hooks: object } {
  if (typeof v !== "object" || v === null || Array.isArray(v)) {
    return false;
  }

  if (!Object.hasOwn(v, "hooks")) {
    return false;
  }

  const inner = (v as Record<string, unknown>).hooks;
  return typeof inner === "object" && inner !== null && !Array.isArray(inner);
}

// ──────────────────────────────────────────────────────────────────────────
// parseHooksConfig (D-57-04): JSON.parse + HOOKS_VALIDATOR.Check + debug-log
// hand-off + discriminated result.
// ──────────────────────────────────────────────────────────────────────────

/** Format the first validator error into a single-line message. */
function firstHookValidationDetail(value: unknown): string {
  type HookValidationError = ReturnType<typeof HOOKS_VALIDATOR.Errors>[number];

  // This function is called only after Check(value) returned false, so the
  // compiled validator guarantees a non-empty diagnostic collection.
  const [first] = HOOKS_VALIDATOR.Errors(value) as [HookValidationError, ...HookValidationError[]];

  return `${first.instancePath || "<root>"}: ${first.message}`;
}

/**
 * MATCH-03 side-Map of compiled `if` predicates produced by
 * `parseHooksConfig`. Key shape is
 * `${claudeEvent}|${groupIndex}|${handlerIndex}` (e.g.
 * `"PostToolUse|0|2"`); only handlers whose `if` field is non-undefined
 * are present. The downstream `flattenPluginIntoBuckets` consumer reads
 * the map via the same key and falls back to MATCH_ALL_IF on miss --
 * absent + malformed + non-tool-event entries all collapse to the
 * fall-open sentinel so dispatch never observes `undefined`
 * (always-present-with-sentinel per D-61-02).
 *
 * Generic in `P` so the bridge layer's concrete `IfPredicate`
 * discriminated union flows out typed correctly.
 */
export type CompiledIfPredicateMap<P> = ReadonlyMap<string, P>;

/**
 * Compose the side-Map key. Centralized so producers (parseHooksConfig)
 * and consumers (flattenPluginIntoBuckets) cannot drift.
 */
function ifPredicateMapKey(
  claudeEvent: BucketAEvent,
  groupIndex: number,
  handlerIndex: number,
): string {
  return `${claudeEvent}|${groupIndex}|${handlerIndex}`;
}

/**
 * Discriminated parse result. Consumers (resolver) narrow on `ok`.
 *
 * MATCH-03 extension: the success arm carries the compiled `ifPredicates`
 * side-Map. D-71-03 extension: the success arm's `value` is now the FILTERED
 * supported subset and `dropped` enumerates the skipped events / groups /
 * handlers; degradable supportability failures no longer fail the parse. The
 * failure arm is reserved for structural defects: invalid JSON and schema
 * validation failures.
 * Generic in `P` so the bridge layer's concrete `IfPredicate` discriminated
 * union flows out typed correctly.
 */
export type HookConfigParseResult<P> =
  | {
      ok: true;
      value: HooksConfig;
      dropped: readonly DroppedHook[];
      ifPredicates: CompiledIfPredicateMap<P>;
    }
  | { ok: false; reason: string };

/**
 * D-57-04 parse path. Returns the discriminated `{ok:true, value, dropped}` on
 * success; on failure returns `{ok:false, reason}` and forwards the detail
 * through `hookDebugLog`. The resolver maps a structural `{ok:false}` failure to
 * `state: "unavailable"`; a `{ok:true}` parse with a non-empty
 * `dropped: readonly DroppedHook[]` list resolves `state: "partially-available"` with the
 * `{unsupported hooks}` reason. No throws.
 *
 * HOOK-03 / LIFE-01 wrapper-detection arm: if the parsed JSON looks like
 * the upstream PLUGIN-format wrapper `{description?, hooks: {<event>:
 * [...]}}` per Claude Code `plugin-dev/skills/hook-development/SKILL.md`,
 * the parser unwraps `parsed.hooks` before validating against
 * `HOOKS_VALIDATOR`. Otherwise it validates `parsed` directly
 * (backward-compat for in-tree bare-shape configs). The success arm's
 * `value` is the unwrapped record either way, so every downstream
 * consumer (resolver, info.ts projection, bridge stage-write) sees the
 * same bare-event-keys shape it already expected.
 *
 * MATCH-03 (D-61-02): the success arm also returns `ifPredicates`, a
 * `Map` keyed on `(event|groupIndex|handlerIndex)` carrying the
 * `compileIfPredicate` result for every handler whose `if` field is
 * defined. Missing keys collapse to MATCH_ALL_IF at the flatten seam.
 *
 * `ctx` is the `CompileIfPredicateContext` consumed by the path-glob
 * compiler; production call sites construct it from the in-scope
 * `ExtensionContext.cwd` per the A1 projectRoot fallback.
 *
 * `options.skipIfMap` short-circuits the `if`-predicate side-Map walk for
 * callers that only need the installable verdict (resolver `list`/`info`
 * probe). When `true`, the success arm returns an empty Map without
 * invoking `compileIf` for any handler. The discarded-result optimization
 * is bounded but non-zero on configs with many `if`-bearing handlers.
 */
export function parseHooksConfig<P>(
  raw: string,
  ctx: CompileIfPredicateContext,
  compileIf: CompileIfCallback<P>,
  options: { skipIfMap?: boolean } = {},
): HookConfigParseResult<P> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    const reason = `hooks.json is not valid JSON: ${errorMessage(err)}`;
    hookDebugLog(reason);
    return { ok: false, reason };
  }

  // HOOK-03 / LIFE-01: unwrap the upstream PLUGIN-format wrapper per
  // Claude Code `plugin-dev/skills/hook-development/SKILL.md`. Bare-shape
  // inputs fall through to direct validation (backward-compat).
  const candidate: unknown = isPluginWrapper(parsed)
    ? (parsed as { hooks: unknown }).hooks
    : parsed;

  if (!HOOKS_VALIDATOR.Check(candidate)) {
    const detail = firstHookValidationDetail(candidate);
    const reason = `hooks.json failed schema validation: ${detail}`;
    hookDebugLog(reason);
    return { ok: false, reason };
  }

  // D-71-01 / D-71-03 partition gate (PHOOK-01 / PHOOK-03). The JSON.parse
  // (S1) and HOOKS_VALIDATOR.Check (S2) arms above own the STRUCTURAL
  // failures and stay `{ok:false}` -- by the time we get here the config is
  // shape-valid. `partitionHooks` accumulates every supportability failure
  // into the `dropped` enumeration and returns the supported strict subset;
  // degradable drops do not fail the parse. The catalog layer collapses the
  // routed `dropped` signal to the closed `{unsupported hooks}` reason.
  const partition: HooksPartition = partitionHooks(candidate);

  // MATCH-03: compile the side-Map of `if` predicates via the caller-
  // supplied `compileIf` callback. Per D-61-02 every failure path
  // inside `compileIfPredicate` collapses to MATCH_ALL_IF -- the
  // parser never fails on an `if`-field issue (plugin always installs).
  // The `skipIfMap` opt-out returns an empty Map without iteration for
  // callers that consume only the installable verdict (resolver probe).
  //
  // D-71-03: build the side-Map over the FILTERED subset so a dropped
  // handler's `if` predicate never enters the dispatch Map.
  const ifPredicates: CompiledIfPredicateMap<P> = options.skipIfMap
    ? new Map<string, P>()
    : buildIfPredicateMap(partition.supported, ctx, compileIf);

  return {
    ok: true,
    value: partition.supported,
    dropped: partition.dropped,
    ifPredicates,
  };
}

/**
 * MATCH-03 walker. Iterates every (claudeEvent, groupIndex,
 * handlerIndex) triple in the parsed config and, for each handler with
 * a non-undefined `if` field, invokes the caller-supplied `compileIf`
 * callback and stores the result in the side-Map. Handlers without an
 * `if` field are absent from the map (the flatten consumer falls back
 * to MATCH_ALL_IF).
 *
 * Pre-condition: `partitionHooks` has already filtered the config to the
 * supported subset, so every event key is a BucketAEvent.
 */
function buildIfPredicateMap<P>(
  config: HooksConfig,
  ctx: CompileIfPredicateContext,
  compileIf: CompileIfCallback<P>,
): CompiledIfPredicateMap<P> {
  const out = new Map<string, P>();
  for (const [eventName, groups] of Object.entries(config)) {
    const claudeEvent = eventName as BucketAEvent;
    for (const [groupIndex, group] of groups.entries()) {
      compileGroupIfPredicates(claudeEvent, groupIndex, group.hooks, ctx, compileIf, out);
    }
  }

  return out;
}

/**
 * Per-group helper. Walks the handler list and stores compiled
 * predicates in `out` keyed on (event|groupIndex|handlerIndex).
 * Handlers without an `if` field are skipped (the flatten consumer
 * falls back to MATCH_ALL_IF).
 */
function compileGroupIfPredicates<P>(
  claudeEvent: BucketAEvent,
  groupIndex: number,
  hooks: ReadonlyArray<HookHandlerEntry>,
  ctx: CompileIfPredicateContext,
  compileIf: CompileIfCallback<P>,
  out: Map<string, P>,
): void {
  for (const [handlerIndex, handler] of hooks.entries()) {
    const rawIf = handler.if;
    if (rawIf === undefined) {
      continue;
    }

    const predicate = compileIf(rawIf, claudeEvent, ctx);
    out.set(ifPredicateMapKey(claudeEvent, groupIndex, handlerIndex), predicate);
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Hook-summary projection (SURF-01 / D-63-06, D-100-02): the single home for
// turning a hooks description -- parsed config or persisted record entries --
// into the `HookSummaryEntry` union the info surface renders.
// ──────────────────────────────────────────────────────────────────────────

/**
 * SURF-01 / D-63-04 / D-63-06: project a parsed `HooksConfig` to the
 * `HookSummaryEntry[]` shape the renderer consumes. One entry per
 * (event, group) tuple in declaration order from the parsed file --
 * `Object.entries` and `Array` iteration both preserve insertion order
 * for plain objects (the JSON.parse output `parseHooksConfig` returns),
 * so the rendered order matches the on-disk authoring order.
 *
 * Tool events (`PreToolUse` / `PostToolUse` / `PostToolUseFailure`)
 * carry the group's `matcher` (defaulting to the empty string when the
 * group's `matcher` is absent -- match-all per MATCH-01); non-tool
 * events do not carry one. Granularity is per-GROUP, not per-handler:
 * the renderer surfaces `event(matcher)` once per group regardless of
 * how many handlers the group declares.
 *
 * Pure and total: never throws. The supportability gate in
 * `checkMatcherSupportability` has already accepted every event key as
 * a `BucketAEvent`, so the tool-event discriminator is a closed-set
 * membership check against `TOOL_EVENTS`.
 */
export function projectHookSummaryEntries(parsed: HooksConfig): readonly HookSummaryEntry[] {
  const entries: HookSummaryEntry[] = [];
  for (const [eventName, groups] of Object.entries(parsed)) {
    for (const group of groups) {
      if (TOOL_EVENT_MEMBERS.has(eventName)) {
        entries.push({
          event: eventName as ToolEvent,
          matcher: group.matcher ?? "",
        });
      } else {
        // Cast: the assertion is upheld by the supportability gate's
        // bucket-A admission check (every event key surviving
        // `parseHooksConfig.ok = true` is a `ClaudeHookEvent`, and the
        // tool-event guard above excludes the `ToolEvent` subset).
        entries.push({
          event: eventName as Exclude<ClaudeHookEvent, ToolEvent>,
        });
      }
    }
  }

  return entries;
}

/**
 * D-100-01 / D-100-02 / ENBL-12: narrow persisted record entries to the
 * `HookSummaryEntry` union, applying the same tool-event membership test
 * `projectHookSummaryEntries` uses to pick the arm.
 *
 * The narrowing lives here, at the single read boundary, because the two
 * shapes disagree on purpose: the persisted schema keeps `event` an open
 * string so a future Claude event token cannot invalidate a whole state
 * file, while `HookSummaryEntry` is a closed union the renderer switches on.
 * Doing this once means no consumer re-derives the arm choice.
 *
 * A tool event takes the matcher-carrying arm with `matcher` defaulting to
 * the empty string (match-all per MATCH-01, matching the projector); every
 * other event takes the bare arm. Pure and total: never throws.
 */
export function hookSummaryEntriesFromPersisted(
  persisted: readonly { readonly event: string; readonly matcher?: string }[],
): readonly HookSummaryEntry[] {
  return persisted.map((entry) => {
    if (TOOL_EVENT_MEMBERS.has(entry.event)) {
      return { event: entry.event as ToolEvent, matcher: entry.matcher ?? "" };
    }

    return { event: entry.event as Exclude<ClaudeHookEvent, ToolEvent> };
  });
}

// domain/components/hooks.ts
//
// TypeBox schema for Claude `hooks/hooks.json` files + `parseHooksConfig`
// discriminated parser. Consumed by `domain/resolver.ts`: a structural parse
// failure (`{ ok: false }`) resolves `state: "unavailable"` per D-57-04; a
// successful parse whose partition dropped unsupportable events / matcher groups
// / handlers resolves `state: "unsupported"` (force-degradable) carrying the
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
// unsupportable entries instead resolves `state: "unsupported"` with the
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

import Type from "typebox";
import { Compile } from "typebox/compile";

import { hookDebugLog } from "../../shared/debug-log.ts";
import { errorMessage } from "../../shared/errors.ts";

import {
  BUCKET_A_EVENTS,
  NON_TOOL_EVENT_CLOSED_SETS,
  NON_TOOL_EVENT_FIELDS,
  TOOL_EVENTS,
  type BucketAEvent,
  type ToolEvent,
} from "./hook-events.ts";
import { CLAUDE_TO_PI_TOOL_NAMES, type PiToolName } from "./hook-tool-names.ts";

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
// Schema layer-by-layer
// ──────────────────────────────────────────────────────────────────────────

// A single hook-handler entry. Per HOOK-03, the schema is lenient on
// unknown fields. The conditional `if/then` enforces the Claude's Discretion
// invariant: when `type === "command"`, the `command` field is REQUIRED.
// Other `type` literals (currently unsupported -- bucket-A is `command`
// only) pass the schema and are rejected one layer up by TOOL-02(d) in the
// resolver supportability gate.
//
// The conditional is expressed as raw JSON Schema 2020-12 via `Type.Unsafe`
// because TypeBox 1.x's first-class combinators (`Type.Object` /
// `Type.Union`) don't compose into a discriminator-with-required-field
// shape cleanly. The runtime `Compile` handles `if/then/else` natively
// (see `node_modules/typebox/build/schema/engine/if.mjs`).
export interface HookHandlerEntry {
  type: string;
  command?: string;
  // MATCH-03: upstream permission-rule string consumed by
  // `compileIfPredicate`. OPTIONAL on every handler (HOOK-03
  // forward-compat: handlers without `if` MUST still validate). The
  // schema's `required` array stays exactly `["type"]`; absence is
  // normalized to MATCH_ALL_IF at the parse-time compile seam.
  readonly if?: string;
  // HOOK-03 tolerated additive extensions (silently accepted; semantics
  // live in the future EXEC layer, not here).
  statusMessage?: unknown;
  once?: unknown;
  async?: unknown;
  shell?: unknown;
  args?: unknown;
  // HOOK-06 / EXEC-05: asyncRewake field family. Schema admission is
  // type-loose per the HOOK-03 lenient stance -- runtime narrowing
  // (typeof boolean / typeof string guards) lives in the
  // bridges/hooks/async-rewake/ registry, not here.
  asyncRewake?: unknown;
  rewakeMessage?: unknown;
  rewakeSummary?: unknown;
  // HOOK-03 forward-compat: unknown extension field names also accepted.
  [k: string]: unknown;
}

const HOOK_HANDLER_SCHEMA = Type.Unsafe<HookHandlerEntry>({
  type: "object",
  required: ["type"],
  properties: {
    type: { type: "string" },
    command: { type: "string" },
    // MATCH-03: user-facing `if` permission-rule string. Distinct from
    // the schema-level `if`/`then` conditional below (which encodes the
    // "command required when type === 'command'" discriminator). The
    // user-facing field is OPTIONAL -- absent on most handlers.
    if: { type: "string" },
    // HOOK-06 / EXEC-05: asyncRewake / rewakeMessage / rewakeSummary
    // schema admission. Empty-object JSON Schema means "accept any
    // value" -- non-boolean asyncRewake or non-string rewakeMessage /
    // rewakeSummary values do not flip the plugin to (unavailable);
    // the runtime guards in bridges/hooks/async-rewake/ narrow each.
    asyncRewake: {},
    rewakeMessage: {},
    rewakeSummary: {},
  },
  if: {
    type: "object",
    properties: { type: { const: "command" } },
    required: ["type"],
  },
  then: {
    type: "object",
    required: ["type", "command"],
    properties: { command: { type: "string" } },
  },
});

// A single hook group inside an event arm. `hooks` is the handler list.
// `matcher` is optional (MATCH-01: empty string matches all; absence
// parser-equivalence is a sibling concern in the resolver). The five HOOK-03
// tolerated additive extensions are declared as optional `Type.Unknown` so
// the schema accepts any shape; the EXEC layer interprets their semantics.
// Unknown field names are also accepted (HOOK-03 forward-compat) because
// `Type.Object` defaults to `additionalProperties: true`.
const HOOK_ENTRY_SCHEMA = Type.Object({
  matcher: Type.Optional(Type.String()),
  hooks: Type.Array(HOOK_HANDLER_SCHEMA),
  statusMessage: Type.Optional(Type.Unknown()),
  once: Type.Optional(Type.Unknown()),
  async: Type.Optional(Type.Unknown()),
  shell: Type.Optional(Type.Unknown()),
  args: Type.Optional(Type.Unknown()),
});

const HOOK_EVENT_ARRAY_SCHEMA = Type.Array(HOOK_ENTRY_SCHEMA);

/**
 * Top-level `hooks.json` shape. D-57-02: event keys accepted as any string.
 * The supportability gate (bucket-A admission) lives in TOOL-02(c), not
 * here.
 *
 * HOOK-03 / LIFE-01: the schema encodes the BARE settings-format shape
 * (top-level event keys mapping to event arrays). Real upstream Claude
 * plugins ship the PLUGIN-format WRAPPER `{description?, hooks: {...}}`
 * per `plugin-dev/skills/hook-development/SKILL.md`. The wrapper
 * discrimination lives in `parseHooksConfig` (above the validator); the
 * schema itself remains the bare record so the validator's instance-path
 * error messages stay readable and downstream consumers (resolver,
 * info.ts projection, bridge stage-write) see the unwrapped record per
 * the contract they already expect.
 */
export const HOOKS_CONFIG_SCHEMA = Type.Record(Type.String(), HOOK_EVENT_ARRAY_SCHEMA);

export type HooksConfig = Type.Static<typeof HOOKS_CONFIG_SCHEMA>;

/**
 * JIT-compiled validator. Mirrors the `STATE_VALIDATOR` / `MCP_SERVERS_VALIDATOR`
 * pattern: module-level `Compile` keeps the cost amortized across calls.
 */
export const HOOKS_VALIDATOR = Compile(HOOKS_CONFIG_SCHEMA);

// ──────────────────────────────────────────────────────────────────────────
// parseHooksConfig (D-57-04): JSON.parse + HOOKS_VALIDATOR.Check + debug-log
// hand-off + discriminated result.
// ──────────────────────────────────────────────────────────────────────────

/** Format the first validator error into a single-line message. */
function firstHookValidationDetail(value: unknown): string {
  const errors = HOOKS_VALIDATOR.Errors(value);
  const first = errors[0];
  if (!first) {
    return "(no detail available)";
  }

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
export function ifPredicateMapKey(
  claudeEvent: BucketAEvent,
  groupIndex: number,
  handlerIndex: number,
): string {
  return `${claudeEvent}|${groupIndex}|${handlerIndex}`;
}

/**
 * One dropped hook event / matcher group / handler recorded by
 * `partitionHooks`, for the `info` enumeration (D-71-05) and the aggregate
 * `{unsupported hooks}` reason (D-71-04). PHOOK-01 partition granularity:
 *
 *   - `kind:"event"` (P1): a whole non-bucket-A event was dropped.
 *   - `kind:"group"` (P2-P5): a single matcher group was dropped because its
 *     matcher has no Pi analog. `cond` names which TOOL-02 condition tripped:
 *     a regex matcher, an unmapped tool, a non-empty matcher on a
 *     no-matcher-support event, or a matcher value outside the closed set.
 *   - `kind:"handler"` (P6, Q1): a single non-`command` handler was dropped
 *     from an otherwise-supportable group (HANDLER granularity).
 */
export type DroppedHook =
  | { kind: "event"; event: string }
  | {
      kind: "group";
      event: BucketAEvent;
      matcher: string;
      cond: "regex" | "unmapped-tool" | "no-matcher-support" | "closed-set";
    }
  | { kind: "handler"; event: BucketAEvent; matcher: string; handlerType: string };

/**
 * Partition of a schema-validated `HooksConfig` into the supported strict
 * subset plus the enumeration of dropped events / groups / handlers
 * (PHOOK-01, D-71-01). `supported` is a deterministic subset of the input --
 * same event-key order, same group order, same surviving-handler order --
 * and may be `{}` when every handler drops (D-71-02 empty-subset edge).
 * `dropped` is in encounter order.
 */
export interface HooksPartition {
  readonly supported: HooksConfig;
  readonly dropped: readonly DroppedHook[];
}

/**
 * Discriminated parse result. Consumers (resolver) narrow on `ok`.
 *
 * MATCH-03 extension: the success arm carries the compiled `ifPredicates`
 * side-Map. D-71-03 extension: the success arm's `value` is now the FILTERED
 * supported subset and `dropped` enumerates the skipped events / groups /
 * handlers; degradable supportability failures no longer fail the parse. The
 * failure arm is reserved for STRUCTURAL defects only -- invalid JSON (S1),
 * schema-validation failure (S2), and the X1 table-desync programmer bug.
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
 * `dropped: readonly DroppedHook[]` list resolves `state: "unsupported"` with the
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
  // degradable drops no longer fail the parse (D-71-03). The catalog-layer
  // narrowing in `shared/probe-classifiers.ts` collapses the routed `dropped`
  // signal to the closed-set `{unsupported hooks}` Reason (D-71-04). The one
  // exception is the X1 table-desync programmer bug, which `partitionHooks`
  // raises as a `HooksTableDesyncError` so it stays loud `{ok:false}`
  // (arch-test-guarded, D-71-03).
  let partition: HooksPartition;
  try {
    partition = partitionHooks(candidate);
  } catch (err) {
    if (err instanceof HooksTableDesyncError) {
      const reason = `unsupported hooks: ${err.message}`;
      hookDebugLog(reason);
      return { ok: false, reason };
    }

    throw err;
  }

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
    for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
      const group = groups[groupIndex];
      if (group === undefined) {
        continue;
      }

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
  for (let handlerIndex = 0; handlerIndex < hooks.length; handlerIndex++) {
    const handler = hooks[handlerIndex];
    if (handler === undefined) {
      continue;
    }

    const rawIf = handler.if;
    if (rawIf === undefined) {
      continue;
    }

    const predicate = compileIf(rawIf, claudeEvent, ctx);
    out.set(ifPredicateMapKey(claudeEvent, groupIndex, handlerIndex), predicate);
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Matcher parser (MATCH-01 / MATCH-02 / TOOL-01 reverse-map at parse time)
// ──────────────────────────────────────────────────────────────────────────

/**
 * A matcher token's allowed character class. Any character outside this set
 * (other than the `mcp__server__tool` literal shape, which is matched
 * separately) makes the matcher a regex per MATCH-02.
 *
 * `_` is admitted because Pi-form tool tokens carry no underscores but a
 * Claude-form contributor may use them in pipe-OR alternation tokens (the
 * Claude grammar does not constrain underscores); the per-token validator
 * `SAFE_TOKEN_CHARS` is the actual gate that decides whether each split
 * token reaches the TOOL-01 reverse-map lookup.
 *
 * The looser top-level charset is intentional forward-compat: today none of
 * the seven Claude tool names in the TOOL-01 reverse map contain an
 * underscore (`Bash | Read | Edit | Write | Grep | Glob | LS`), so a
 * tighter `/^[A-Za-z0-9|-]+$/` would behave identically against today's
 * tool catalog. If a future Claude release introduces a tool whose name
 * carries an underscore, admitting `_` here lets such a token reach the
 * TOOL-01 reverse-map lookup (where it can be mapped or flagged unmapped)
 * instead of being silently demoted to the regex arm one step earlier.
 * The downstream TOOL-02 supportability gate still produces a precise
 * debugDetail in either path -- this charset just controls which arm
 * (`(a) regex matcher` vs `(b) unmapped tool`) carries the trip.
 *
 * `|` is admitted at this top-level pass because pipe-OR alternation is
 * the only multi-token shape this parser admits; the post-split per-token
 * validator handles the per-token character set.
 */
const SAFE_MATCHER_CHARS = /^[A-Za-z0-9_|-]+$/;

/**
 * Per-token character class (post pipe-OR split). A token failing this
 * regex is a regex matcher per MATCH-02.
 */
const SAFE_TOKEN_CHARS = /^[A-Za-z0-9_-]+$/;

/**
 * MCP-literal matcher shape. A `mcp__<server>__<tool>` literal is a
 * supportable matcher per MATCH-01 even though no individual character is
 * outside `SAFE_MATCHER_CHARS` -- the parser treats it as its own arm so
 * downstream consumers can route to the MCP-aware bridge dispatcher.
 *
 * Server + tool segments allow `[A-Za-z0-9_-]+` to match the Claude
 * grammar's loose token rules.
 *
 * The `__` delimiter is ambiguous when server or tool segments themselves
 * contain `__` (e.g. `mcp__a__b__c` could parse as server `a` + tool
 * `b__c`, or server `a__b` + tool `c`). This ambiguity is intentional and
 * harmless at this layer: the parsed value is opaque
 * (`{kind: "mcp-literal", literal: raw}`) -- this parser only decides that
 * the matcher is a supportable MCP literal and stores the raw string. The
 * downstream MCP-aware bridge dispatcher (out of scope for v1.13) owns
 * splitting the literal on its own canonical delimiter when it needs to
 * route to a specific server/tool pair. Tightening the regex to disallow
 * `__` inside segments would push the disambiguation work into this
 * parser without any consumer that needs the split today.
 */
const MCP_SEGMENT = /^[A-Za-z0-9_-]+$/;

/**
 * Match an `mcp__<server>__<tool>` literal. Split-based so the segment
 * regex runs once per side in linear time, sidestepping the catastrophic
 * backtracking the equivalent
 * `/^mcp__[A-Za-z0-9_-]+__[A-Za-z0-9_-]+$/` would exhibit on inputs
 * like `mcp__aaaa` (super-linear in input length per S5852).
 */
function isMcpLiteral(raw: string): boolean {
  if (!raw.startsWith("mcp__")) {
    return false;
  }

  const body = raw.slice("mcp__".length);
  const sepIdx = body.lastIndexOf("__");
  if (sepIdx <= 0 || sepIdx >= body.length - 2) {
    return false;
  }

  return MCP_SEGMENT.test(body.slice(0, sepIdx)) && MCP_SEGMENT.test(body.slice(sepIdx + 2));
}

/**
 * Parsed matcher discriminated union. The five arms are:
 *
 *   - `match-all`: raw === `""` or `"*"` (MATCH-01 empty-string-matches-all).
 *   - `tool-set`: one or more Claude tool names (single or pipe-OR
 *     alternation), each successfully translated through the TOOL-01
 *     reverse map to a Pi-form tool literal. The `piTools` set is the Pi-
 *     form lowercase tokens the dispatcher compares against at runtime.
 *   - `mcp-literal`: a `mcp__<server>__<tool>` literal. Single-token only;
 *     pipe-OR mixing with MCP literals is rejected as `regex` per the
 *     strict-supportability stance.
 *   - `regex`: any character outside the safe matcher charset, OR a
 *     malformed pipe-OR (lone `"|"`, leading `"|Edit"`, trailing `"Edit|"`),
 *     OR mixed tool-name + MCP-literal pipe-OR. Trips TOOL-02(a).
 *   - `unmapped`: a Claude-form token with no TOOL-01 mapping
 *     (`MultiEdit` / `WebFetch` / `Task` / Pi-form lowercase tokens like
 *     `edit`). Trips TOOL-02(b). The first unmapped token short-circuits
 *     and wins.
 *
 * The split between `regex` and `unmapped` is preserved for per-condition
 * debugDetail clarity even though both arms collapse to TOOL-02 trip in
 * `checkMatcherSupportability`.
 */
export type ParsedMatcher =
  | { kind: "match-all" }
  | { kind: "tool-set"; piTools: ReadonlySet<PiToolName> }
  | { kind: "mcp-literal"; literal: string }
  | { kind: "regex" }
  | { kind: "unmapped"; token: string };

/**
 * Parse a single Claude-form matcher string into a `ParsedMatcher`
 * discriminated arm.
 *
 * MATCH-01: empty string and `*` parse to `match-all`. Single tokens and
 * pipe-OR alternation of tokens are translated through the TOOL-01 reverse
 * map (`CLAUDE_TO_PI_TOOL_NAMES`) at parse time -- the dispatcher reads
 * Pi-form lowercase tokens at runtime and the reverse map is the single
 * authoritative source.
 *
 * MATCH-02: any character outside `[A-Za-z0-9_|-]` (and not part of a
 * `mcp__...__...` literal) parses to `regex`. Per the strict-supportability
 * stance (D-58-06), malformed pipe-OR shapes also parse to `regex` rather
 * than silently degrading to match-all.
 *
 * Pi-form rejection: a lowercase token like `"edit"` is NOT a Claude-form
 * key in the TOOL-01 reverse map, so it parses to `{kind: "unmapped",
 * token: "edit"}` -- guaranteeing the matcher never silently matches a
 * Pi runtime event (the dispatcher only compares against Pi-form tokens
 * sourced from this parser).
 *
 * Pure and total: never throws. Returns one of the five `ParsedMatcher`
 * arms for every possible input string.
 */
export function parseMatcher(raw: string): ParsedMatcher {
  // MATCH-01: match-all sentinels.
  if (raw === "" || raw === "*") {
    return { kind: "match-all" };
  }

  // MCP-literal single-token: MUST be checked BEFORE the safe-charset gate,
  // because `mcp__server__tool` contains only safe characters AND must
  // route to its own discriminated arm. Pipe-OR mixing with an MCP literal
  // is forbidden -- the regex pin already excludes `|` from the MCP shape,
  // so any pipe-OR containing an MCP literal token will fall through to
  // the per-token loop below and be rejected as a regex (`mcp__a__b` is
  // not a Claude tool name).
  if (isMcpLiteral(raw)) {
    return { kind: "mcp-literal", literal: raw };
  }

  // MATCH-02: character-set gate. Any char outside the safe set (and not
  // part of an MCP literal) trips regex. Pipe is admitted here; per-token
  // gating happens after the split.
  if (!SAFE_MATCHER_CHARS.test(raw)) {
    return { kind: "regex" };
  }

  // Pipe-OR split + per-token validation. An empty token (lone `"|"`,
  // leading `"|Edit"`, trailing `"Edit|"`) is the malformed pipe-OR shape
  // that loud-rejects to regex per D-58-06.
  const tokens = raw.split("|");
  const piTools = new Set<PiToolName>();

  for (const token of tokens) {
    if (token.length === 0) {
      return { kind: "regex" };
    }

    if (!SAFE_TOKEN_CHARS.test(token)) {
      return { kind: "regex" };
    }

    // TOOL-01 reverse-map lookup. The map's keys are the seven Claude-form
    // PascalCase / uppercase tool names; any other token (Pi-form
    // lowercase, unsupported Claude tools like `MultiEdit` / `WebFetch` /
    // `Task`, or a `mcp__...` segment that survived the literal check by
    // being part of a pipe-OR) reads as `undefined` and short-circuits to
    // unmapped.
    const piName = (CLAUDE_TO_PI_TOOL_NAMES as Record<string, PiToolName | undefined>)[token];
    if (piName === undefined) {
      return { kind: "unmapped", token };
    }

    piTools.add(piName);
  }

  return { kind: "tool-set", piTools };
}

// ──────────────────────────────────────────────────────────────────────────
// partitionHooks (TOOL-02 four-condition gate as an accumulating partition,
// D-58-06 / D-71-01)
// ──────────────────────────────────────────────────────────────────────────

/**
 * Matcher-level supportability condition (PHOOK-01 / D-71-01). Names the
 * TOOL-02 condition that caused a matcher GROUP to be dropped. The four
 * literals replace the legacy `(a)` / `(b)` / `(c)` debugDetail prefixes:
 *
 *   - `regex`: regex matcher on a tool event (was `(a)`).
 *   - `unmapped-tool`: tool-event matcher with no Pi TOOL-01 reverse-map
 *     entry -- `MultiEdit` / `WebFetch` / `Task` / Pi-form lowercase (was
 *     `(b)`).
 *   - `no-matcher-support`: a non-empty matcher on a no-matcher-support event
 *     (`UserPromptSubmit`; was `(c)`).
 *   - `closed-set`: a matcher value outside the Pi-mappable closed set (was
 *     `(c)`).
 */
type MatcherCond = "regex" | "unmapped-tool" | "no-matcher-support" | "closed-set";

/**
 * Outcome of the matcher-level (group) supportability check. `null` means
 * the matcher is admissible -- keep the group, then filter its handlers for
 * the (d) condition.
 *
 *   - `kind:"drop"`: a degradable matcher-group drop (P2-P5) carrying `cond`.
 *   - `kind:"structural"`: the X1 table-desync programmer bug
 *     (`NON_TOOL_EVENT_FIELDS` declares a field with no
 *     `NON_TOOL_EVENT_CLOSED_SETS` entry). NOT degradable -- surfaced loud as
 *     `{ok:false}` by `parseHooksConfig` (D-71-03).
 */
type MatcherTrip = { kind: "drop"; cond: MatcherCond } | { kind: "structural"; detail: string };

/**
 * Internal structural signal for the X1 table-desync programmer bug. Thrown
 * by `partitionHooks` and caught by `parseHooksConfig`, which returns
 * `{ok:false}` so the failure stays loud/structural rather than silently
 * degrading a group (D-71-03). Never raised for plugin-authored input -- only
 * when the two non-tool-event tables fall out of sync, which the architecture
 * test pins (statically unreachable today).
 */
class HooksTableDesyncError extends Error {}

const BUCKET_A_MEMBERS = new Set<string>(BUCKET_A_EVENTS);
const TOOL_EVENT_MEMBERS = new Set<string>(TOOL_EVENTS);

/**
 * TOOL-02(a)/(b) gate for tool events. Translates a parsed matcher arm into
 * the corresponding degradable `cond` when the matcher is unsupportable on a
 * tool event. Returns `null` when the matcher is admissible (match-all /
 * tool-set / mcp-literal).
 */
function tryToolEventTrip(rawMatcher: string): MatcherTrip | null {
  const parsed = parseMatcher(rawMatcher);

  if (parsed.kind === "regex") {
    return { kind: "drop", cond: "regex" };
  }

  if (parsed.kind === "unmapped") {
    return { kind: "drop", cond: "unmapped-tool" };
  }

  return null;
}

/**
 * TOOL-02(c) gate for non-tool bucket-A events. Handles two sub-cases:
 *
 *   - Null sentinel in `NON_TOOL_EVENT_FIELDS`: Claude has no upstream
 *     matcher support (UserPromptSubmit). Any non-empty matcher drops the
 *     group with `cond:"no-matcher-support"`.
 *   - String field in `NON_TOOL_EVENT_FIELDS`: matcher value must be in the
 *     Pi-mappable closed set per `NON_TOOL_EVENT_CLOSED_SETS`; otherwise the
 *     group drops with `cond:"closed-set"`.
 *
 * Match-all (empty / `*`) is always admissible and short-circuits to `null`
 * before this function is called.
 *
 * The X1 table-desync case (field declared, closed-set entry missing) returns
 * a `kind:"structural"` trip -- it is a programmer bug, not user input, and
 * must stay loud rather than degrade (D-71-03).
 */
function tryNonToolEventTrip(
  event: Exclude<BucketAEvent, ToolEvent>,
  rawMatcher: string,
): MatcherTrip | null {
  const fieldName = NON_TOOL_EVENT_FIELDS[event];

  if (fieldName === null) {
    return { kind: "drop", cond: "no-matcher-support" };
  }

  const closedSet = NON_TOOL_EVENT_CLOSED_SETS[event];
  if (closedSet === undefined) {
    // WR-04 (D-58 review): NON_TOOL_EVENT_FIELDS declared a matcher target
    // field for this event but NON_TOOL_EVENT_CLOSED_SETS has no
    // corresponding entry -- the two tables fell out of sync. This is a
    // programming error, not a user-input miss; signalled STRUCTURAL so
    // parseHooksConfig stays `{ok:false}` rather than degrading a group
    // (D-71-03). The architecture test in
    // `tests/architecture/hooks-supportability.test.ts` red-fails CI when the
    // two tables disagree, so this branch should be statically unreachable
    // today; it is the loud fallback for future table edits.
    return {
      kind: "structural",
      detail: `(c) missing closed-set entry for non-tool event: ${event}`,
    };
  }

  if (!closedSet.has(rawMatcher)) {
    return { kind: "drop", cond: "closed-set" };
  }

  return null;
}

/**
 * Per-event-group matcher gate composing the TOOL-02(a)/(b)/(c) conditions.
 * Routes the matcher through tool-event (a/b) or non-tool-event (c) handling.
 * Returns `null` when the matcher is admissible (the caller then filters the
 * group's handlers for the (d) condition at HANDLER granularity per Q1).
 */
function tryMatcherTrip(
  event: BucketAEvent,
  group: { matcher?: string; hooks: ReadonlyArray<HookHandlerEntry> },
): MatcherTrip | null {
  const rawMatcher = group.matcher ?? "";

  if (TOOL_EVENT_MEMBERS.has(event)) {
    return tryToolEventTrip(rawMatcher);
  }

  if (rawMatcher !== "" && rawMatcher !== "*") {
    // D-58-06: match-all is always supportable on every bucket-A event.
    // Anything non-empty routes through the non-tool-event closed-set gate.
    return tryNonToolEventTrip(event as Exclude<BucketAEvent, ToolEvent>, rawMatcher);
  }

  return null;
}

/**
 * P6 / Q1 handler filter. Returns the group with its surviving `command`
 * handlers (source order preserved), or `undefined` when every handler
 * dropped. Pushes a `kind:"handler"` DroppedHook per non-`command` handler
 * at HANDLER granularity.
 */
function partitionGroupHandlers(
  event: BucketAEvent,
  matcher: string,
  group: HooksConfig[string][number],
  dropped: DroppedHook[],
): HooksConfig[string][number] | undefined {
  const keptHandlers: HookHandlerEntry[] = [];
  for (const handler of group.hooks) {
    if (handler.type === "command") {
      keptHandlers.push(handler);
    } else {
      dropped.push({ kind: "handler", event, matcher, handlerType: handler.type });
    }
  }

  if (keptHandlers.length === 0) {
    return undefined;
  }

  return { ...group, hooks: keptHandlers };
}

/**
 * Partition one bucket-A event's groups (D-71-01 / D-71-02). Drops
 * unsupportable matcher groups (P2-P5) and non-`command` handlers (P6/Q1),
 * returning the surviving groups (empty array when the event fully drops).
 * Throws `HooksTableDesyncError` on the X1 structural signal (D-71-03).
 */
function partitionEventGroups(
  event: BucketAEvent,
  groups: HooksConfig[string],
  dropped: DroppedHook[],
): HooksConfig[string] {
  const keptGroups: HooksConfig[string] = [];

  for (const group of groups) {
    const matcher = group.matcher ?? "";
    const trip = tryMatcherTrip(event, group);

    if (trip !== null) {
      if (trip.kind === "structural") {
        // X1: stays loud/structural (D-71-03).
        throw new HooksTableDesyncError(trip.detail);
      }

      // P2-P5: degradable matcher-group drop.
      dropped.push({ kind: "group", event, matcher, cond: trip.cond });
      continue;
    }

    const keptGroup = partitionGroupHandlers(event, matcher, group, dropped);
    if (keptGroup !== undefined) {
      keptGroups.push(keptGroup);
    }
  }

  return keptGroups;
}

/**
 * PHOOK-01 / D-71-01 partition. Accumulates every supportability failure
 * instead of returning on the first trip, producing the supported strict
 * subset plus the `dropped` enumeration. Granularity is event (P1) + matcher
 * group (P2-P5) + handler (P6, Q1):
 *
 *   - Non-bucket-A event -> drop the whole EVENT (`kind:"event"`).
 *   - Unsupportable matcher -> drop the matcher GROUP (`kind:"group"`),
 *     keeping the event's clean groups (D-71-02).
 *   - Non-`command` handler in an otherwise-supportable group -> drop the
 *     HANDLER (`kind:"handler"`), keeping the group's `command` handlers; a
 *     group whose handlers all drop is omitted; an event whose groups all
 *     drop is omitted (D-71-02 empty-subset edge).
 *
 * Pure and total over every schema-validated `HooksConfig`. The sole
 * non-total path is the X1 table-desync programmer bug, raised as a
 * `HooksTableDesyncError` so the structural failure stays loud (D-71-03); it
 * is statically unreachable while the two non-tool-event tables stay in sync.
 */
export function partitionHooks(config: HooksConfig): HooksPartition {
  const supported: Record<string, HooksConfig[string]> = {};
  const dropped: DroppedHook[] = [];

  for (const [eventName, groups] of Object.entries(config)) {
    // P1: non-bucket-A event -> drop the whole event.
    if (!BUCKET_A_MEMBERS.has(eventName)) {
      dropped.push({ kind: "event", event: eventName });
      continue;
    }

    const bucketAEvent = eventName as BucketAEvent;
    const keptGroups = partitionEventGroups(bucketAEvent, groups, dropped);

    // An event whose groups all dropped is omitted (D-71-02 empty-subset).
    if (keptGroups.length > 0) {
      supported[bucketAEvent] = keptGroups;
    }
  }

  return { supported, dropped };
}

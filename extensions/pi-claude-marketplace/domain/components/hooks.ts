// domain/components/hooks.ts
//
// TypeBox schema for Claude `hooks/hooks.json` files + `parseHooksConfig`
// discriminated parser. Consumed by `domain/resolver.ts` to flip
// `installable: false` on parse failure per D-57-04.
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
// D-57-04: parse failures (invalid JSON, structural shape mismatch,
// missing REQUIRED `command` on a `type: "command"` handler) surface through
// `parseHooksConfig` as `{ ok: false, reason }`. The resolver consumes this
// to flip `installable: false` with the `{unsupported hooks}` reason.
// `hookDebugLog` is the OBS-01 hand-off seam: this module ships a stub
// implementation gated on `PI_CLAUDE_MARKETPLACE_DEBUG === "1"`; OBS-01 will
// later route this through a shared debug-log helper without touching
// `parseHooksConfig` callers. The inline `eslint-disable-next-line` on the
// stub's single `console.error` call (the SOLE IL-3 deviation in this
// file) retires with the OBS-01 swap.

import Type from "typebox";
import { Compile } from "typebox/compile";

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
interface HookHandlerEntry {
  type: string;
  command?: string;
  // HOOK-03 tolerated additive extensions (silently accepted; semantics
  // live in the future EXEC layer, not here).
  statusMessage?: unknown;
  once?: unknown;
  async?: unknown;
  shell?: unknown;
  args?: unknown;
  // HOOK-03 forward-compat: unknown extension field names also accepted.
  [k: string]: unknown;
}

const HOOK_HANDLER_SCHEMA = Type.Unsafe<HookHandlerEntry>({
  type: "object",
  required: ["type"],
  properties: {
    type: { type: "string" },
    command: { type: "string" },
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
 * Discriminated parse result. Consumers (resolver) narrow on `ok` to
 * surface the `{unsupported hooks}` reason on failure (D-57-04).
 */
export type HookConfigParseResult =
  | { ok: true; value: HooksConfig }
  | { ok: false; reason: string };

/**
 * OBS-01 hand-off seam. Current implementation is a stub: routes the
 * parse-failure detail to `console.error` when
 * `PI_CLAUDE_MARKETPLACE_DEBUG === "1"`, otherwise no-op. OBS-01 will
 * replace this implementation to route through a shared debug-log helper
 * without changing the function name or signature, so every existing
 * `parseHooksConfig` caller keeps working unchanged.
 *
 * TODO(OBS-01): remove the inline lint disables below and replace this
 * stub with the shared debug-log helper. The two `eslint-disable-next-line`
 * directives below are the SOLE sanctioned IL-3 deviation in this file --
 * scoped to the single `console.error` line so a stray `console.error`
 * added elsewhere in the file still trips lint (WR-03).
 */
export function hookDebugLog(detail: string): void {
  if (process.env.PI_CLAUDE_MARKETPLACE_DEBUG === "1") {
    // eslint-disable-next-line no-console, no-restricted-syntax -- OBS-01 hand-off seam (D-58-03); retires when the shared debug-log helper lands
    console.error(`[hooks] ${detail}`);
  }
}

/**
 * D-57-04 parse path. Returns the discriminated `{ok:true,value}` on
 * success; on failure returns `{ok:false,reason}` and forwards the
 * detail through `hookDebugLog`. The resolver maps the failure to
 * `installable: false` with the `{unsupported hooks}` reason. No throws.
 */
export function parseHooksConfig(raw: string): HookConfigParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    const reason = `hooks.json is not valid JSON: ${errorMessage(err)}`;
    hookDebugLog(reason);
    return { ok: false, reason };
  }

  if (!HOOKS_VALIDATOR.Check(parsed)) {
    const detail = firstHookValidationDetail(parsed);
    const reason = `hooks.json failed schema validation: ${detail}`;
    hookDebugLog(reason);
    return { ok: false, reason };
  }

  // D-58-03 single-seam supportability gate (TOOL-02). Fold matcher /
  // event / handler-type supportability failure into the EXISTING
  // `{ok:false, reason}` arm so the resolver's not-installable cascade
  // narrows on `ok` unchanged. The reason carries the parse-time
  // `"unsupported hooks: " + debugDetail` form; the catalog-layer
  // narrowing in `shared/probe-classifiers.ts::narrowResolverNotes`
  // collapses this to the closed-set `{unsupported hooks}` Reason.
  const supportability = checkMatcherSupportability(parsed);
  if (!supportability.ok) {
    const reason = `unsupported hooks: ${supportability.debugDetail}`;
    hookDebugLog(reason);
    return { ok: false, reason };
  }

  return { ok: true, value: parsed };
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
const MCP_LITERAL = /^mcp__[A-Za-z0-9_-]+__[A-Za-z0-9_-]+$/;

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
  if (MCP_LITERAL.test(raw)) {
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
// checkMatcherSupportability (TOOL-02 four-condition gate, D-58-06)
// ──────────────────────────────────────────────────────────────────────────

/**
 * Supportability verdict carried out of the four-condition TOOL-02 gate.
 * `ok: true` means every event / matcher / handler combination in the
 * config has a Pi peer-dep analog the dispatcher can fire on. `ok: false`
 * carries the per-condition `debugDetail` string with a locked
 * `(a)` / `(b)` / `(c)` / `(d)` prefix routed to `hookDebugLog` only --
 * never to `ctx.ui.notify` or stdout.
 *
 * The four conditions map to the audit-locked TOOL-02 catalog:
 *   - `(a)`: regex matcher (MATCH-02 trip).
 *   - `(b)`: tool-event matcher referencing a Claude tool with no Pi
 *            TOOL-01 reverse-map entry (`MultiEdit` / `WebFetch` /
 *            `Task` / Pi-form lowercase / etc.).
 *   - `(c)`: non-bucket-A event, OR non-tool-event matcher value outside
 *            the Pi-mappable closed set, OR non-empty matcher on a
 *            no-matcher-support event.
 *   - `(d)`: a hook handler whose `type` is not `"command"`.
 */
type SupportabilityResult = { ok: true } | { ok: false; debugDetail: string };

/**
 * TOOL-02 supportability gate. Pure and total: iterates every event /
 * group / handler triple and returns the FIRST encountered failure with
 * a per-condition debug detail. Strict per-PLUGIN policy: a single
 * unsupportable matcher trips the entire plugin to
 * `(unavailable) {unsupported hooks}`.
 *
 * No-op happy path: an empty config, or a config whose events are all
 * bucket-A members with admissible matchers + `command` handlers, returns
 * `{ok: true}` without producing a debug-log line.
 */
const BUCKET_A_MEMBERS = new Set<string>(BUCKET_A_EVENTS);
const TOOL_EVENT_MEMBERS = new Set<string>(TOOL_EVENTS);

/**
 * TOOL-02(a)/(b) gate for tool events. Translates a parsed matcher arm
 * into the corresponding `(a)` / `(b)` failure detail when the matcher
 * is unsupportable on a tool event. Returns `null` when the matcher is
 * admissible (match-all / tool-set / mcp-literal).
 */
function tryToolEventTrip(event: ToolEvent, rawMatcher: string): SupportabilityResult | null {
  const parsed = parseMatcher(rawMatcher);

  if (parsed.kind === "regex") {
    return { ok: false, debugDetail: `(a) regex matcher in ${event}: ${rawMatcher}` };
  }

  if (parsed.kind === "unmapped") {
    return { ok: false, debugDetail: `(b) unmapped tool in ${event}: ${parsed.token}` };
  }

  return null;
}

/**
 * TOOL-02(c) gate for non-tool bucket-A events. Handles two sub-cases:
 *
 *   - Null sentinel in `NON_TOOL_EVENT_FIELDS`: Claude has no upstream
 *     matcher support (UserPromptSubmit). Any non-empty matcher trips.
 *   - String field in `NON_TOOL_EVENT_FIELDS`: matcher value must be in
 *     the Pi-mappable closed set per `NON_TOOL_EVENT_CLOSED_SETS`.
 *
 * Match-all (empty / `*`) is always admissible and short-circuits to
 * `null` before this function is called.
 */
function tryNonToolEventTrip(
  event: Exclude<BucketAEvent, ToolEvent>,
  rawMatcher: string,
): SupportabilityResult | null {
  const fieldName = NON_TOOL_EVENT_FIELDS[event];

  if (fieldName === null) {
    return {
      ok: false,
      debugDetail: `(c) matcher on no-matcher-support event: ${event}`,
    };
  }

  const closedSet = NON_TOOL_EVENT_CLOSED_SETS[event];
  if (closedSet === undefined) {
    // WR-04 (D-58 review): NON_TOOL_EVENT_FIELDS declared a matcher
    // target field for this event but NON_TOOL_EVENT_CLOSED_SETS has no
    // corresponding entry -- the two tables fell out of sync. This is a
    // programming error, not a user-input miss; distinguish it from the
    // ordinary "value not in the closed set" case so the debug detail
    // tells the truth. The architecture test in
    // `tests/architecture/hooks-supportability.test.ts` red-fails CI
    // when the two tables disagree, so this branch should be
    // statically unreachable today; it is the loud fallback for future
    // table edits.
    return {
      ok: false,
      debugDetail: `(c) missing closed-set entry for non-tool event: ${event}`,
    };
  }

  if (!closedSet.has(rawMatcher)) {
    return {
      ok: false,
      debugDetail: `(c) matcher value not in closed set for ${event}: ${rawMatcher}`,
    };
  }

  return null;
}

/**
 * TOOL-02(d) gate. Scans the handler list and returns the FIRST
 * non-`command` handler's type in a `(d)` failure detail. Returns `null`
 * when every handler is `command`.
 */
function tryHandlerTrip(
  event: BucketAEvent,
  handlers: ReadonlyArray<HookHandlerEntry>,
): SupportabilityResult | null {
  for (const handler of handlers) {
    if (handler.type !== "command") {
      return {
        ok: false,
        debugDetail: `(d) non-command handler in ${event}: ${handler.type}`,
      };
    }
  }

  return null;
}

/**
 * Per-event-group gate composing the four TOOL-02 conditions. Routes the
 * matcher through tool-event (a/b) or non-tool-event (c) handling and
 * scans the handler list for (d). Returns `null` when every check passes.
 */
function tryGroupTrip(
  event: BucketAEvent,
  group: { matcher?: string; hooks: ReadonlyArray<HookHandlerEntry> },
): SupportabilityResult | null {
  const rawMatcher = group.matcher ?? "";

  if (TOOL_EVENT_MEMBERS.has(event)) {
    const toolTrip = tryToolEventTrip(event as ToolEvent, rawMatcher);
    if (toolTrip !== null) {
      return toolTrip;
    }
  } else if (rawMatcher !== "" && rawMatcher !== "*") {
    // D-58-06: match-all is always supportable on every bucket-A event.
    // Anything non-empty routes through the non-tool-event closed-set
    // gate.
    const nonToolTrip = tryNonToolEventTrip(event as Exclude<BucketAEvent, ToolEvent>, rawMatcher);
    if (nonToolTrip !== null) {
      return nonToolTrip;
    }
  }

  return tryHandlerTrip(event, group.hooks);
}

export function checkMatcherSupportability(config: HooksConfig): SupportabilityResult {
  for (const [eventName, groups] of Object.entries(config)) {
    if (!BUCKET_A_MEMBERS.has(eventName)) {
      return { ok: false, debugDetail: `(c) non-bucket-A event: ${eventName}` };
    }

    const bucketAEvent = eventName as BucketAEvent;
    for (const group of groups) {
      const trip = tryGroupTrip(bucketAEvent, group);
      if (trip !== null) {
        return trip;
      }
    }
  }

  return { ok: true };
}

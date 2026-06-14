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
// `parseHooksConfig` callers. The per-file ESLint override that permits
// `console.error` for this stub retires with the OBS-01 swap.

import Type from "typebox";
import { Compile } from "typebox/compile";

import { errorMessage } from "../../shared/errors.ts";

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
 * OBS-01 hand-off seam. Phase-57 implementation is a stub: routes the
 * parse-failure detail to `console.error` when
 * `PI_CLAUDE_MARKETPLACE_DEBUG === "1"`, otherwise no-op. OBS-01 will
 * replace this implementation to route through a shared debug-log helper
 * without changing the function name or signature, so every existing
 * `parseHooksConfig` caller keeps working unchanged.
 */
export function hookDebugLog(detail: string): void {
  if (process.env.PI_CLAUDE_MARKETPLACE_DEBUG === "1") {
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

// domain/components/hooks.ts
//
// TypeBox schema for Claude `hooks/hooks.json` files.
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
// implementation; the implementation will later route through a shared
// debug-log helper without touching `parseHooksConfig` callers.

import Type from "typebox";
import { Compile } from "typebox/compile";

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

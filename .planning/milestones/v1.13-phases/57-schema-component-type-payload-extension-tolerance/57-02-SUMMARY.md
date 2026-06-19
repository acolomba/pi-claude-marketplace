---
phase: 57-schema-component-type-payload-extension-tolerance
plan: 02
subsystem: domain
tags:
  - typebox
  - schema
  - forward-compat
  - parser
  - hooks
dependency_graph:
  requires:
    - 57-01 PLUGIN_INSTALL_RECORD_SCHEMA.resources.hooks (string[]) + ensurePluginResources default-fill arm (carry-forward from sibling plan; resolves the storage shape this parser feeds into)
  provides:
    - HOOKS_CONFIG_SCHEMA (TypeBox lenient top-level + conditional `command` requirement)
    - HOOKS_VALIDATOR (module-level Compile result)
    - HooksConfig (Type.Static<typeof HOOKS_CONFIG_SCHEMA>)
    - HookConfigParseResult (discriminated {ok:true,value} | {ok:false,reason})
    - parseHooksConfig (raw string -> HookConfigParseResult)
    - hookDebugLog (OBS-01 hand-off stub)
  affects:
    - extensions/pi-claude-marketplace/domain/resolver.ts (next-plan caller: maps {ok:false} to installable: false with {unsupported hooks} reason per D-57-04)
tech_stack:
  added: []
  patterns:
    - JSON Schema 2020-12 conditional (`if`/`then`) via `Type.Unsafe` to enforce the REQUIRED `command` field only when `type === "command"` (typebox 1.x runtime evaluates `if/then/else` natively; see schema/engine/if.mjs)
    - module-level JIT compile (mirrors STATE_VALIDATOR / MCP_SERVERS_VALIDATOR)
    - discriminated parse result mirroring the SK-5 / D-12 + ResourcesDiscoverFailure / withStateGuard idioms used elsewhere in the codebase
    - OBS-01 hand-off seam (named exported function with stub implementation; replaceable without touching callers)
key_files:
  created:
    - extensions/pi-claude-marketplace/domain/components/hooks.ts
    - tests/domain/components/hooks.test.ts
  modified:
    - eslint.config.js
decisions:
  - "HOOK-03 honored verbatim: additionalProperties: true at every nesting level (TypeBox object default, never set false anywhere)."
  - "D-57-02 honored verbatim: top-level event keys accepted as any string via Type.Record(Type.String(), ...). Phase 58 TOOL-02(c) owns the bucket-A admission gate."
  - "Claude's Discretion locked REQUIRED: type:'command' handler entries MUST carry a string `command` field. Expressed as a JSON Schema 2020-12 conditional via Type.Unsafe because TypeBox 1.x's first-class combinators (Type.Object / Type.Union) don't compose into a discriminator-with-required-field shape cleanly — Union-with-anyOf would silently accept {type:'command'} without `command`."
  - "D-57-04 honored: parseHooksConfig returns a discriminated {ok:true,value} | {ok:false,reason} result. No throws — the resolver narrows on `ok` to flip installability."
  - "OBS-01 hand-off seam: hookDebugLog is a named exported stub gated on PI_CLAUDE_MARKETPLACE_DEBUG === '1'. The Phase-59 OBS-01 swap will replace the implementation without touching parseHooksConfig callers; the per-file ESLint override (BLOCK-style) retires with the swap."
metrics:
  duration_min: 28
  completed_date: "2026-06-14"
requirements:
  - HOOK-03
---

# Phase 57 Plan 02: Hook-config TypeBox schema + parseHooksConfig — Summary

Forward-compatible TypeBox schema for Claude `hooks/hooks.json` lands at `domain/components/hooks.ts` alongside a discriminated `parseHooksConfig` helper and the `hookDebugLog` OBS-01 hand-off seam. HOOK-03 lenience holds at every nesting level; the schema's only structural gates are JSON shape (object with array values) and the conditional REQUIRED `command` field on a `type: "command"` handler.

## Outcome

A plugin's `hooks/hooks.json` can now be parsed without inventing throws: callers receive `{ok:true, value: HooksConfig}` on a syntactically + structurally valid payload and `{ok:false, reason: string}` on any failure. The companion `hookDebugLog` stub routes the failure detail to `console.error` when `PI_CLAUDE_MARKETPLACE_DEBUG === "1"` — OBS-01 will later swap the implementation to route through a shared debug-log helper without touching `parseHooksConfig` callers. The downstream resolver in the next plan maps `{ok:false}` to `installable: false` with the existing `{unsupported hooks}` reason per D-57-04; no resolver wiring is performed here.

The schema deliberately does NOT gate on:

- Top-level event-key membership (D-57-02 — bucket-A admission is TOOL-02(c)'s job in Phase 58).
- Handler-type literals other than `"command"` (HOOK-03 forward-compat — TOOL-02(d) rejects non-`command` handlers in the supportability layer).
- Unknown extension field names anywhere in the tree (HOOK-03 forward-compat — additive Claude Code fields never force a downstream version-bump cascade).
- The five known additive extensions on a hook entry (`statusMessage`, `once`, `async`, `shell`, `args`) — declared as optional `Type.Unknown` so the EXEC layer is the only place that cares about their semantics.

## Tasks completed

| Task                                                                          | Type     | Commits             | Files                                                                                                                  |
| ----------------------------------------------------------------------------- | -------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 1: Define HOOKS_CONFIG_SCHEMA + compiled HOOKS_VALIDATOR                       | auto+tdd | a09e565 / 43aad1e   | `extensions/pi-claude-marketplace/domain/components/hooks.ts`, `tests/domain/components/hooks.test.ts`                  |
| 2: Add parseHooksConfig + hookDebugLog OBS-01 stub for D-57-04                 | auto+tdd | a0339ab / a61c048   | `extensions/pi-claude-marketplace/domain/components/hooks.ts`, `tests/domain/components/hooks.test.ts`, `eslint.config.js` |

## Behavior changes

- **`HOOKS_CONFIG_SCHEMA`** (new): `Type.Record(Type.String(), HOOK_EVENT_ARRAY_SCHEMA)`. Top-level event keys accepted as any string (D-57-02). Each event arm is an array of hook entries.
- **Hook entry shape**: `matcher` optional string (MATCH-01 absence-vs-empty-string equivalence deferred to Phase 58); `hooks` an array of handler entries; the five known additive extensions (`statusMessage`, `once`, `async`, `shell`, `args`) declared as optional `Type.Unknown` (HOOK-03). Unknown field names also accepted (TypeBox `Type.Object` default).
- **Hook handler shape**: built as raw JSON Schema via `Type.Unsafe` to enforce the conditional REQUIRED `command` field — `if {type: "command"} then required: ["type", "command"] with command: string`. Any other `type` literal passes the schema (HOOK-03), and the resolver's supportability gate (Phase 58) rejects non-`command` handlers one layer up.
- **`HOOKS_VALIDATOR`** (new): module-level `Compile(HOOKS_CONFIG_SCHEMA)`, mirroring `STATE_VALIDATOR` / `MCP_SERVERS_VALIDATOR`.
- **`parseHooksConfig(raw: string)`** (new): wraps `JSON.parse` + `HOOKS_VALIDATOR.Check` into a discriminated `{ok:true,value} | {ok:false,reason}` result. On any failure path (invalid JSON, structural shape mismatch, missing REQUIRED `command`), the detail is forwarded through `hookDebugLog` and the reason returned as a non-empty string.
- **`hookDebugLog(detail: string)`** (new): OBS-01 hand-off stub. Gated on `process.env.PI_CLAUDE_MARKETPLACE_DEBUG === "1"`; routes through `console.error` with a `[hooks] ` prefix. OBS-01 will replace the implementation to route through a shared debug-log helper; the public name and signature stay unchanged.
- **`HooksConfig`** (new exported type): `Type.Static<typeof HOOKS_CONFIG_SCHEMA>`.
- **`HookConfigParseResult`** (new exported type): `{ok:true,value:HooksConfig} | {ok:false,reason:string}`.

## Tests

15 new behavior cases in `tests/domain/components/hooks.test.ts`:

**Schema accept matrix (11):**

1. Empty object (no events declared) -> true.
1. Known event key with empty array -> true.
1. Minimum bucket-A shape `{matcher, hooks: [{type:"command", command}]}` -> true.
1. All five HOOK-03 additive extensions on a hook entry -> true.
1. Unknown extension field names (`futureField`, `anotherFuture`) -> true.
1. Unknown top-level event key (`FutureEventX`) -> true (D-57-02).
1. `type: "command"` entry missing `command` -> false.
1. Top-level value not an array (`PreToolUse: "not-an-array"`) -> false.
1. Top-level value is an array (`[]`) -> false (must be object).
1. `null` -> false.
1. Unknown handler-type literal (`type: "frobnicate"`) -> true (HOOK-03 forward-compat).

**parseHooksConfig discriminated result (4):**

1. Valid JSON + valid shape -> `{ok:true, value}` matching the parsed object.
1. Invalid JSON -> `{ok:false, reason}` (non-empty string).
1. Structurally-malformed payload -> `{ok:false, reason}`.
1. `type:"command"` missing `command` -> `{ok:false, reason}`.

Full unit suite: 1877 / 1877 GREEN (1862 from Phase 57 Plan 01 + 15 from this plan). Typecheck + ESLint + Prettier clean. Integration suite: 10 / 10 GREEN. `npm run check` exit 0.

## Deviations from Plan

### Auto-fixed Issues

None.

### Architectural deviations

None. HOOK-03 / D-57-02 / D-57-04 / Claude's Discretion REQUIRED-`command` all honored verbatim. The plan offered two implementation options for the conditional handler shape (a "discriminated union" path or a "single shape that requires both"). Neither composes cleanly with TypeBox 1.x's first-class combinators:

- `Type.Union([CommandHandler, NonCommandHandler])` is `anyOf` semantically. With `NonCommandHandler.type = Type.String()`, an input `{type: "command"}` (no `command`) fails `CommandHandler` but passes `NonCommandHandler` — contradicting the REQUIRED-`command` invariant.
- `Type.Object` cannot conditionally require a field based on another field's value.

A third path — JSON Schema 2020-12 `if`/`then` via `Type.Unsafe` — composes cleanly: typebox 1.x evaluates `if/then/else` natively (`node_modules/typebox/build/schema/engine/if.mjs`), the static type is preserved via `Type.Unsafe<T>`, and the schema reads structurally. Picked this path; documented inline.

## Verification gate results

- `npm run check`: GREEN (exit 0; full suite 1877 unit + 10 integration tests).
- `grep -n "Compile" extensions/pi-claude-marketplace/domain/components/hooks.ts`: shows the JIT-compile pattern matching `state-io.ts:103` and `mcp.ts:18`.
- `grep -n "additionalProperties.*false" extensions/pi-claude-marketplace/domain/components/hooks.ts`: NOTHING — no strict gate slipped in (HOOK-03).
- `grep -n "Type.Record(Type.String()" extensions/pi-claude-marketplace/domain/components/hooks.ts`: shows the lenient top-level (D-57-02) at line 108.
- `grep -n 'type.*const.*command' extensions/pi-claude-marketplace/domain/components/hooks.ts`: shows the conditional discriminator literal at line 74 (the `if: { properties: { type: { const: "command" } } }` clause; the equivalent of `Type.Literal("command")` inside the `if` schema).
- Forbidden tokens (`Phase 57`, `Plan 02`, `Wave 1`, `Pitfall N`) absent from `domain/components/hooks.ts` (verified via the plan's grep, no matches).

## Self-Check: PASSED

- `extensions/pi-claude-marketplace/domain/components/hooks.ts`: FOUND.
- `tests/domain/components/hooks.test.ts`: FOUND.
- `eslint.config.js` per-file override block for `domain/components/hooks.ts`: FOUND at lines 160-172.
- Commit `a09e565` (Task 1 RED): FOUND.
- Commit `43aad1e` (Task 1 GREEN): FOUND.
- Commit `a0339ab` (Task 2 RED): FOUND.
- Commit `a61c048` (Task 2 GREEN): FOUND.

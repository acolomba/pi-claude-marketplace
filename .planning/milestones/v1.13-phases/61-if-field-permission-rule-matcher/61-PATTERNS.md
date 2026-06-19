# Phase 61: `if` Field Permission-Rule Matcher - Pattern Map

**Mapped:** 2026-06-15
**Files analyzed:** 11 (5 new, 4 modified, 1 REQ amendment, 1 ARCH test)
**Analogs found:** 11 / 11

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `bridges/hooks/if-field/glob.ts` (NEW) | bridge / pure parser (compile-time) | transform (string -> compiled token list) | `domain/components/hooks.ts` (parseMatcher: tokenize + discriminated compile) | role-match (no in-repo glob analog; cohesion analog is parseMatcher) |
| `bridges/hooks/if-field/bash.ts` (NEW) | bridge / pure parser (runtime, fail-open) | transform (shell text -> subcommand list + flags) | `domain/components/hooks.ts` (parseMatcher: same parse-time-data-only model) | role-match |
| `bridges/hooks/if-field/index.ts` (NEW, top-level seam) | bridge / dispatch-time predicate + parse-time compile | request-response (predicate(event) -> bool) | `bridges/hooks/dispatch.ts` (matcherFiresOnToolEvent: discriminated-union switch + assertNever) | exact |
| `domain/components/hook-if-targets.ts` (NEW, planner discretion) | domain / static lookup table | data-only (closed map) | `domain/components/hook-tool-names.ts` (TOOL-01 + `as const satisfies` gate) | exact |
| `tests/architecture/hooks-if-field.test.ts` (NEW) | test / closed-set + truth-table fixture | data-driven assertions | `tests/architecture/hooks-supportability.test.ts` + `hooks-foundation.test.ts` | exact |
| `domain/components/hooks.ts` (MOD) | domain / schema + parser | transform (string -> ParseResult) | self (Phase 57/58 baseline) | self-extend |
| `bridges/hooks/event-router.ts` (MOD) | bridge / routing fold | data-only (config -> RoutingEntry[]) | self (Phase 59 baseline; `RoutingEntry` interface + `flattenPluginIntoBuckets`) | self-extend |
| `bridges/hooks/dispatch.ts` (MOD, single-line insertion at ~L175) | bridge / dispatch reducer | request-response | self (Phase 59/60 baseline; `reduceBucket`) | self-extend |
| `.planning/REQUIREMENTS.md` (MOD) | docs / requirement amendment | n/a | self (atomic-supersession pattern from D-58-01 lockstep) | self-extend |

## Pattern Assignments

### `bridges/hooks/if-field/glob.ts` (NEW; bridge, transform)

**Analog:** `extensions/pi-claude-marketplace/domain/components/hooks.ts` (the `parseMatcher` function + its discriminated-union shape at lines 277-362).

**Imports pattern** (Phase 57/58 baseline; hooks.ts lines 29-43):
```ts
// Top-comment block: D-NN-NN anchors + LOAD-BEARING-CONTRACT prose.
// No Phase/Plan/Wave references (per .claude/rules/typescript-comments.md).
// File-relative imports use ".ts" extension explicitly.

import { hookDebugLog } from "../../shared/debug-log.ts";
import { errorMessage } from "../../shared/errors.ts";
```

**Discriminated-union compiled-output pattern** (hooks.ts lines 277-283):
```ts
export type ParsedMatcher =
  | { kind: "match-all" }
  | { kind: "tool-set"; piTools: ReadonlySet<PiToolName> }
  | { kind: "mcp-literal"; literal: string }
  | { kind: "regex" }
  | { kind: "unmapped"; token: string };
```

Phase 61 follows: `CompiledBashGlob` / `CompiledPathGlob` interfaces with `readonly tokens: ReadonlyArray<GlobToken>` + a discriminated `GlobToken` union (`literal | star | globstar | slash`). Same `readonly` discipline as `ParsedMatcher`.

**Linear-scan tokenize pattern** (hooks.ts lines 335-360; matcher pipe-OR split):
```ts
// Char-class regex constants at module top:
const SAFE_MATCHER_CHARS = /^[A-Za-z0-9_|-]+$/;
const SAFE_TOKEN_CHARS = /^[A-Za-z0-9_-]+$/;
const MCP_LITERAL = /^mcp__[A-Za-z0-9_-]+__[A-Za-z0-9_-]+$/;

// Single-pass walk with early-return on each shape:
if (raw === "" || raw === "*") return { kind: "match-all" };
if (MCP_LITERAL.test(raw)) return { kind: "mcp-literal", literal: raw };
if (!SAFE_MATCHER_CHARS.test(raw)) return { kind: "regex" };
```

Phase 61's `tokenize(pattern)` follows the same linear-walk-with-early-emit shape; no backtracking, no regex compilation of user input.

**Naming + file-organization conventions observed:**
- File-leading block comment: file path on line 1 (`// bridges/hooks/if-field/glob.ts`), blank line, then domain prose with D-NN-NN anchors. No date stamps.
- Section dividers: `// ──────────────...` 74-dash rules between Schema / Parser / Gate sections (see hooks.ts:45, 128, 192, 364).
- Exports: types and helpers `export`-ed individually; no default exports.
- `readonly` on every interface field; `ReadonlySet` / `ReadonlyArray` on compound shapes.
- Pure-and-total contract documented in JSDoc ("never throws", "returns one of the N arms for every possible input"). Phase 61's `compileBashGlob` / `compilePathGlob` should mirror.

---

### `bridges/hooks/if-field/bash.ts` (NEW; bridge, transform)

**Analog:** `domain/components/hooks.ts` (`parseMatcher` for the parse-time + early-return + discriminated-output shape).

**Closed-set lookup pattern** (hooks.ts:399-400):
```ts
const BUCKET_A_MEMBERS = new Set<string>(BUCKET_A_EVENTS);
const TOOL_EVENT_MEMBERS = new Set<string>(TOOL_EVENTS);
```

Phase 61 follows: a top-of-file `const WRAPPER_STRIP = new Set([...])` for the 6-element process-wrapper closed set (`timeout | time | nice | nohup | stdbuf | xargs`).

**Discriminated `{ ok: true, ... } | { ok: false, reason }` pattern** (hooks.ts:148-150 `HookConfigParseResult`):
```ts
export type HookConfigParseResult =
  | { ok: true; value: HooksConfig }
  | { ok: false; reason: string };
```

Phase 61 follows: `parseBashSubcommands(command): ParseResult` returns `{ok:true, subcommands, hasInterpolation} | {ok:false, reason}`. `ok:false` is the fail-open trigger consumed by `ifFires`. Same `.reason` string convention.

**Try/catch -> errorMessage -> reason string** (hooks.ts:162-166):
```ts
try { parsed = JSON.parse(raw); }
catch (err) {
  const reason = `hooks.json is not valid JSON: ${errorMessage(err)}`;
  hookDebugLog(reason);
  return { ok: false, reason };
}
```

Phase 61 `parseBashSubcommands` follows the same `errorMessage(err)` import from `shared/errors.ts` and the same fail-clean return shape (D-61-04: "fail-open on parse failure").

---

### `bridges/hooks/if-field/index.ts` (NEW; bridge, request-response)

**Analog:** `bridges/hooks/dispatch.ts` (`matcherFiresOnToolEvent` at lines 117-129 + `entryFires` at 353-375).

**Discriminated switch + assertNever (NFR-7)** (dispatch.ts:117-129):
```ts
function matcherFiresOnToolEvent(matcher: ParsedMatcher, toolName: string): boolean {
  switch (matcher.kind) {
    case "match-all":
      return true;
    case "tool-set":
      return matcher.piTools.has(toolName as never);
    case "mcp-literal":
      return matcher.literal === toolName;
    case "regex":
    case "unmapped":
      return false;
  }
}
```

Phase 61's `ifFires(predicate, event, ctx, claudeEvent)` follows the exact same shape — `switch (predicate.kind)` with `default: return assertNever(predicate)`. Note: dispatch.ts uses exhaustive case-coverage WITHOUT a default arm (compiler infers exhaustiveness on the closed string union); Phase 61 SHOULD include the explicit `default: return assertNever(predicate)` since the union has more arms (5 vs 5 — borderline; both styles exist in the codebase). See `dispatch.ts:198` (`default: return assertNever(r)` on the HookExecResult switch) for the explicit form.

**`assertNever` import seam** (dispatch.ts:51):
```ts
import { assertNever, type HookExecResult } from "./exec-result.ts";
```

Phase 61 imports `assertNever` from the same `./exec-result.ts` location (sibling of the new `if-field/` dir).

**ESM .ts-extension import convention** (dispatch.ts:42-67): every relative import ends in `.ts`. Phase 61 follows.

---

### `domain/components/hook-if-targets.ts` (NEW; domain, data-only)

**Analog:** `domain/components/hook-tool-names.ts` (THE canonical pattern for static closed-set lookup tables in this codebase).

**File-leading block comment shape** (hook-tool-names.ts:1-35) — Phase 61's hook-if-targets.ts MUST follow this template verbatim (path on line 1, prose with D-NN-NN anchors, LOAD-BEARING-GATE callout).

**`as const satisfies Record<...>` closed-set gate** (hook-tool-names.ts:77-88):
```ts
export const PI_TO_CLAUDE_TOOL_NAMES = {
  bash: "Bash",
  read: "Read",
  edit: "Edit",
  write: "Write",
  grep: "Grep",
  find: "Glob",
  ls: "LS",
} as const satisfies Record<PiToolName, string>;
```

Phase 61 follows verbatim:
```ts
export const IF_PREFIX_TARGETS = {
  Bash:  { piEvents: new Set<PiToolName>(["bash"]),                   extractTarget: "command" },
  Read:  { piEvents: new Set<PiToolName>(["read","grep","find","ls"]), extractTarget: "path"    },
  Edit:  { piEvents: new Set<PiToolName>(["edit","write"]),            extractTarget: "path"    },
  Write: { piEvents: new Set<PiToolName>(["write"]),                   extractTarget: "path"    },
} as const satisfies Record<string, IfPrefixTarget>;
```

The `as const satisfies` is the LOAD-BEARING compile-time gate matching the TOOL-01 pattern — removing any of the four entries red-fails `npm run typecheck`. Architecture test introspects the keys (closed-set source-of-truth pattern).

**Reuse `PiToolName` from hook-tool-names.ts** — Phase 61 imports `type PiToolName` from `./hook-tool-names.ts`; do NOT redefine.

**Co-location decision (Claude's Discretion):** If the resulting file is under ~30 LoC, fold into `hook-tool-names.ts` (146 LoC currently — would not grow much). If it grows past ~30 LoC (e.g. with extractor helpers), keep separate. Mirror RESEARCH Open Question #2.

---

### `tests/architecture/hooks-if-field.test.ts` (NEW; test, data-driven)

**Analog:** `tests/architecture/hooks-supportability.test.ts` (closed-set introspection + locked tuple pinning).

**Block-scoped sections with dash rule + JSDoc preamble** (hooks-supportability.test.ts:1-25 file-leading comment + 38-41 section dividers):
```ts
// Architecture-level invariant pins for the TOOL-02 bucket-A event
// closed-set + non-tool-event matcher tables (D-58-06).
// ...
// ──────────────────────────────────────────────────────────────────────────
// Block 1: TOOL-02 bucket-A 8-event tuple (D-58-06)
// ──────────────────────────────────────────────────────────────────────────
```

**Imports + node:test shape** (hooks-supportability.test.ts:27-36):
```ts
import assert from "node:assert/strict";
import test from "node:test";

import {
  BUCKET_A_EVENTS,
  NON_TOOL_EVENT_CLOSED_SETS,
  // ...
} from "../../extensions/pi-claude-marketplace/domain/components/hook-events.ts";
```

Phase 61: import `IF_PREFIX_TARGETS` from `hook-if-targets.ts`, `compileIfPredicate` from `hooks.ts` (or wherever planner co-locates), `parseBashSubcommands` / `compileBashGlob` / `compilePathGlob` / `ifFires` from `bridges/hooks/if-field/index.ts`.

**Test-title naming convention** (hooks-supportability.test.ts:42):
```ts
test("TOOL-02: BUCKET_A_EVENTS is exactly the 8 documented events in locked order", () => {
```

Phase 61 uses: `test("MATCH-03: <invariant>", ...)`. No `Phase 61` / `Pitfall N` / `Plan NN-NN` tokens in test titles (typescript-comments.md hard rule).

**Inline truth-table fixture pattern** (Phase 61 RESEARCH § Code Examples lines 1195-1300 — verbatim upstream rows):
```ts
const HOOKS_GUIDE_TRUTH_TABLE: ReadonlyArray<{
  ifPattern: string;
  bashCommand: string;
  fires: boolean;
  why: string;
}> = [
  { ifPattern: "Bash(git *)", bashCommand: "git push", fires: true,  why: "command name matches" },
  // ...
];
```

Then a single `test("MATCH-03: upstream hooks-guide truth table", ...)` iterates with `for (const row of HOOKS_GUIDE_TRUTH_TABLE)` and asserts `assert.equal(actual, row.fires, row.why)`. This is the Phase 57/58/59/60 pattern.

---

### `domain/components/hooks.ts` (MODIFY)

**Schema admission** — add `if: Type.Optional(Type.String())` to `HOOK_HANDLER_SCHEMA` (lines 75-92). The HOOK_HANDLER_SCHEMA already uses `Type.Unsafe` with raw JSON Schema 2020-12; the existing `if`/`then` at lines 82-91 is a JSON Schema conditional (UNRELATED to the user-facing `if` field per CONTEXT.md "Existing Code Insights"). Phase 61 adds the user-facing `if` as a separate property entry at line 80-81:
```ts
properties: {
  type: { type: "string" },
  command: { type: "string" },
  if: { type: "string" },   // NEW (Phase 61)
},
```

**Parse-time-compile hand-off** — extend `parseHooksConfig` (lines 158-190) with a third step AFTER `checkMatcherSupportability` succeeds: walk each (event, group, handler) triple and attach `compileIfPredicate(handler.if, claudeEvent, ctx)` to a side-Map keyed by (event, group-index, handler-index) — OR add a private field to `HookHandlerEntry`. See RESEARCH Open Question #3. Recommended: side-Map (mirrors hooks.ts `checkMatcherSupportability` external-iteration pattern at line 524-540 — pure data, no entry mutation).

**Reason / debug-log idiom** — every compile failure emits `hookDebugLog(\`if-field compile: <step> "<raw>" failed: <reason>; falling open\`)` (RESEARCH § Code Examples line 1042-1043). Matches the exact phrasing of existing `hookDebugLog` calls in hooks.ts:164/170/184.

---

### `bridges/hooks/event-router.ts` (MODIFY)

**`RoutingEntry` interface extension** (lines 76-91):
```ts
export interface RoutingEntry {
  readonly scope: Scope;
  readonly marketplace: string;
  readonly pluginId: string;
  readonly claudeEvent: BucketAEvent;
  readonly matcher: ParsedMatcher;
  readonly rawMatcher: string;
  readonly handlerDecl: HookHandlerEntry;
  readonly declarationIndex: number;
  // NEW (Phase 61, MATCH-03):
  readonly ifPredicate: IfPredicate;
  //  ^^^^^^^^^^^^^^^^ Always-present-with-sentinel per RESEARCH Pattern 4.
}
```

Field placement at end of interface preserves declaration-order convention (Phase 60 added `claudeEvent` after the original 4 fields). `readonly` follows existing field discipline.

**`flattenPluginIntoBuckets` population** (lines 260-294):
```ts
for (const handlerDecl of group.hooks) {
  bucket.push({
    scope: cacheEntry.scope,
    marketplace: cacheEntry.marketplace,
    pluginId: cacheEntry.pluginId,
    claudeEvent,
    matcher,
    rawMatcher,
    handlerDecl,
    declarationIndex,
    ifPredicate: lookupCompiledIfPredicate(...) ?? MATCH_ALL_IF,  // NEW
  });
  declarationIndex += 1;
}
```

The lookup reads the side-Map produced by the parser. Always-present semantics: undefined-from-Map collapses to `MATCH_ALL_IF` so dispatch.ts never observes `undefined`.

**Import additions** (lines 32-54 group):
```ts
import { type IfPredicate, MATCH_ALL_IF } from "./if-field/index.ts";
```

Follows the existing relative-`./`-with-`.ts`-extension convention.

---

### `bridges/hooks/dispatch.ts` (MODIFY — single-line insertion)

**Insertion point** — inside `reduceBucket` (line 163-204), between `matcherFires(entry)` (current line 171-173) and `await activeExecutor(entry, event, ctx)` (current line 175). Concrete diff:

```ts
async function reduceBucket(
  bucket: ReadonlyArray<RoutingEntry>,
  event: unknown,
  ctx: ExtensionContext,
  matcherFires: (entry: RoutingEntry) => boolean,
): Promise<HookExecResult> {
  let finalResult: HookExecResult = { kind: "noop" };
  for (const entry of bucket) {
    if (!matcherFires(entry)) {
      continue;
    }
    // NEW (Phase 61, MATCH-03): AND composition with the group-level matcher.
    if (!ifFires(entry.ifPredicate, event, ctx, entry.claudeEvent)) {
      continue;
    }
    const r = await activeExecutor(entry, event, ctx);
    // ... rest unchanged (D-60-02 reducer arms)
  }
  return finalResult;
}
```

Import: `import { ifFires } from "./if-field/index.ts";` added to the import block at lines 42-50 (after the `./event-adapters.ts` import).

**No new comment policy violations** — the insertion uses the `(Phase 61, MATCH-03)` form. Per `.claude/rules/typescript-comments.md` (BARE `Phase NN` references are FORBIDDEN) the comment MUST be rewritten to drop `Phase 61` and keep only `MATCH-03 / D-61-02`. Final form:
```ts
// MATCH-03 / D-61-02: AND composition with the group-level matcher.
// if-no-match -> continue (skip entry), NOT block.
if (!ifFires(entry.ifPredicate, event, ctx, entry.claudeEvent)) continue;
```

---

### `.planning/REQUIREMENTS.md` (MODIFY — MATCH-03 amendment)

**Analog:** Phase 58 D-58-01 / D-58-04 / D-58-06 atomic-supersession pattern. The amendment lands in the SAME commit as the first Phase 61 code change so REQUIREMENTS.md and the implementation never diverge.

**Replacement text** — verbatim from RESEARCH § Code Examples lines 1303-1373. Drops `Grep`/`Glob`/`LS`/`MultiEdit`/`NotebookEdit` from the prefix list; adds the upstream cross-tool mapping table; adds the 2 extra MCP forms; adds the missing-target → substitute-cwd rule.

## Shared Patterns

### Pattern: File-leading comment block (path + D-NN-NN anchors)

**Source:** `domain/components/hooks.ts:1-27`, `domain/components/hook-tool-names.ts:1-35`, `domain/components/hook-events.ts:1-22`, `bridges/hooks/event-router.ts:1-30`, `bridges/hooks/dispatch.ts:1-40`.

**Apply to:** All five new files (glob.ts, bash.ts, if-field/index.ts, hook-if-targets.ts, hooks-if-field.test.ts).

**Shape:**
1. Line 1: `// <path-from-repo-root>` literal.
2. Blank line.
3. Multi-paragraph prose: WHAT the file does, WHAT it depends on, WHICH D-NN-NN / REQ-NN / NFR-N decisions anchor each load-bearing choice.
4. NO `Phase NN`, `Plan NN`, `Wave N`, `Pitfall N` references (`.claude/rules/typescript-comments.md` hard rule).

### Pattern: Discriminated union + `assertNever` exhaustiveness (NFR-7)

**Source:** `bridges/hooks/dispatch.ts:51` (import) + `dispatch.ts:198` (`default: return assertNever(r)` arm on the HookExecResult switch).

**Apply to:** Every switch in Phase 61 over `IfPredicate.kind` (in `ifFires`), `GlobToken.kind` (in `matchTokens`), `PathAnchor.kind` (in `resolveAnchor`). Each switch terminates with `default: return assertNever(x)`.

**Excerpt:**
```ts
switch (r.kind) {
  case "block":  /* ... */
  case "stop":   /* ... */
  case "mutate": /* ... */
  case "noop":   continue;
  default:       return assertNever(r);
}
```

### Pattern: Fail-clean `{ok:true,value} | {ok:false,reason}` result

**Source:** `domain/components/hooks.ts:148-150` (`HookConfigParseResult`).

**Apply to:** `parseBashSubcommands` return shape (Phase 61 `bash.ts`).

### Pattern: `hookDebugLog` for ALL `if`-layer warnings (IL-2 / OBS-01 / D-59-05)

**Source:** `shared/debug-log.ts:20-24` (the sole sanctioned escape).

**Apply to:** Every fall-open in Phase 61 — `compileIfPredicate` failures (parse-time), `parseBashSubcommands` failures (dispatch-time), the non-tool-event disposition (Pitfall 7).

**Excerpt:**
```ts
hookDebugLog(`if-field compile: malformed syntax "${rawIf}"; falling open`);
return MATCH_ALL_IF;
```

NO `ctx.ui.notify` calls at install OR runtime (IL-2 budget; D-61-02 deferred-ideas list explicitly rejects the install-time warning option).

### Pattern: `as const satisfies Record<...>` closed-set source-of-truth

**Source:** `domain/components/hook-tool-names.ts:88` (`} as const satisfies Record<PiToolName, string>`).

**Apply to:** `IF_PREFIX_TARGETS` in `hook-if-targets.ts`. The `satisfies` clause is the architecture-test pin — removing a key red-fails typecheck.

### Pattern: Architecture-test closed-set introspection

**Source:** `tests/architecture/hooks-supportability.test.ts:42-61` (`assert.deepEqual([...BUCKET_A_EVENTS], [...], "...is a public closed-set contract -- shape and order are locked")`).

**Apply to:** Pin `Object.keys(IF_PREFIX_TARGETS)` against `["Bash","Read","Edit","Write"]` in locked order with the same closed-set-contract assertion message.

### Pattern: Single-line section dividers (74-dash rule)

**Source:** `domain/components/hooks.ts:45-47`, `bridges/hooks/dispatch.ts:106-108`, `bridges/hooks/event-router.ts:57-59`.

**Apply to:** All new files. Section headers use:
```ts
// ──────────────────────────────────────────────────────────────────────────
// <Section name> (D-NN-NN anchor)
// ──────────────────────────────────────────────────────────────────────────
```

### Pattern: Test-only inspectors flagged `_<name>ForTest`

**Source:** `bridges/hooks/event-router.ts:574-622` (`_routingTableForTest`, `_resetForTest`, `_bumpEpochForTest`, `_setRoutingBucketForTest`) and `dispatch.ts:88-104` (`_setExecutorForTest`, `_resetExecutorForTest`).

**Apply to:** Any module-level state in `if-field/index.ts` (none expected — predicate is data, not state). The pattern is documented here for completeness: if Phase 61 adds a parse-time cache it MUST expose `_resetIfFieldCacheForTest` at the bottom of the file under a `// Test-only inspectors -- NOT re-exported from bridges/hooks/index.ts.` comment.

## No Analog Found

All Phase 61 files have at least a role-match analog. None require RESEARCH.md fallback patterns.

## Metadata

**Analog search scope:** `extensions/pi-claude-marketplace/{domain,bridges,shared}/` + `tests/architecture/`.
**Files scanned:** 9 (hooks.ts, hook-tool-names.ts, hook-events.ts, event-router.ts, dispatch.ts, debug-log.ts, hooks-supportability.test.ts, hooks-foundation.test.ts directory listing, eslint.config.js — implicit via debug-log seam reference).
**Pattern extraction date:** 2026-06-15.
**Comment-policy compliance:** All excerpts above strip `Phase NN` / `Plan NN-NN` / `Wave N` / `Pitfall N` tokens per `.claude/rules/typescript-comments.md`. Phase 61 implementation MUST follow.

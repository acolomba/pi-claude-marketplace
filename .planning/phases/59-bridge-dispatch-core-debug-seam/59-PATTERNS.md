# Phase 59: Bridge Dispatch Core & Debug Seam - Pattern Map

**Mapped:** 2026-06-14
**Files analyzed:** 12 (5 NEW, 7 MODIFIED)
**Analogs found:** 11 / 12

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `bridges/hooks/index.ts` (NEW) | bridge-barrel | re-export | `bridges/skills/index.ts` | exact |
| `bridges/hooks/event-router.ts` (NEW) | bridge module-state holder | event-driven + in-memory cache | none (first state-holding bridge) | no-analog |
| `bridges/hooks/dispatch.ts` (NEW, optional split) | composite handler factory | event-driven (Pi → Claude fan-out) | `index.ts` `resources_discover` `pi.on` registration | partial |
| `bridges/hooks/dispatch-exec.ts` (NEW) | stub | request-response | none (no existing stubs) | no-analog |
| `shared/debug-log.ts` (NEW) | utility | side-effect (env-gated log) | `domain/components/hooks.ts` lines 167-172 (`hookDebugLog` stub) | exact (verbatim migration) |
| `bridges/index.ts` (MODIFIED) | barrel | re-export | self | self-add `./hooks/index.ts` line |
| `index.ts` (MODIFIED) | extension factory | event-driven registration | self (existing `pi.on.bind` pattern lines 18-26) | exact |
| `orchestrators/reconcile/apply.ts` (MODIFIED) | orchestrator | per-scope loop | self (lines 790-835 — single new call after `applyPlan`) | self |
| `orchestrators/plugin/install.ts` (MODIFIED) | orchestrator | transaction-step | self (per-plugin lock + Phase 57 `parseHooksConfig` site) | self |
| `orchestrators/plugin/uninstall.ts` (MODIFIED) | orchestrator | transaction-step | self (per-plugin lock) | self |
| `domain/components/hooks.ts` (MODIFIED) | leaf | imports rewrite | self (delete lines 154-172; rewrite local `hookDebugLog` calls at 186, 193, 207 to imported binding) | self |
| `tests/architecture/hooks-dispatch.test.ts` (NEW) | architecture test | static introspection | `tests/architecture/hooks-foundation.test.ts` + `hooks-tool-name-map.test.ts` | exact |

## Pattern Assignments

### `bridges/hooks/index.ts` (NEW) — bridge-barrel

**Analog:** `/home/acolomba/pi-claude-marketplace/extensions/pi-claude-marketplace/bridges/skills/index.ts`

**File-header comment pattern** (lines 1-9): single-purpose docstring explaining what the barrel exposes vs. what is NOT re-exported, plus the opaque-handle discipline note (D-01). Copy structure, swap names. The hooks bridge has no `prepared*` opaque-handle issue (no staging), so the docstring shrinks: state "Public surface barrel for the hooks bridge. Internal `liveEpoch` and `parsedConfigCache` are NOT re-exported; callers MUST use `registerHooksBridge`, `rebuildRoutingTables`, `addPluginConfigToCache`, `removePluginConfigFromCache`."

**Export-list pattern** (lines 11-22): named re-exports grouped by source file; `export type { ... }` block for types. Apply directly:

```typescript
export {
  addPluginConfigToCache,
  registerHooksBridge,
  rebuildRoutingTables,
  removePluginConfigFromCache,
} from "./event-router.ts";

export type { RoutingEntry } from "./event-router.ts";
```

Whether `dispatch.ts` and `dispatch-exec.ts` re-export is Claude's Discretion per CONTEXT.md (planner decides splits ≥150 lines).

---

### `bridges/hooks/event-router.ts` (NEW) — module-state holder

**Analog:** none (first state-holding bridge). Use the skeleton in RESEARCH.md Pattern 1 (lines 343-387) verbatim as the starting point.

**Imports pattern** (mirror `bridges/agents/stage.ts` — same zone allows `domain/` + `persistence/` + `shared/` + `platform/` imports):

```typescript
import type { ExtensionAPI, ExtensionContext } from "../../platform/pi-api.ts";
import { compareByNameThenScope } from "../../shared/notify.ts";
import { parseHooksConfig, type HooksConfig } from "../../domain/components/hooks.ts";
import { BUCKET_A_EVENTS, type BucketAEvent } from "../../domain/components/hook-events.ts";
import { hookDebugLog } from "../../shared/debug-log.ts";
```

**Sort-key reuse pattern:** `compareByNameThenScope` at `shared/notify.ts:2899-2916` takes `{ readonly name: string; readonly scope: "user"|"project" }` — DISP-04 cross-plugin ordering passes `{ name: pluginId, scope }` directly.

**Pitfall 3 (RESEARCH.md):** Router MUST live in `bridges/hooks/`, NOT `shared/`. ESLint zone rule at `eslint.config.js:244-254` forbids `shared/ → domain/` imports.

**Pitfall 5 (RESEARCH.md):** State shape is `state.marketplaces.<mp>.plugins.<plugin>`, not `state.installations`. Iterate with `Object.entries(state.marketplaces)` then per-mp `Object.entries(mpRecord.plugins)` and filter `mpRecord.scope === loc.scope`.

**Pitfall 6 (RESEARCH.md):** Cache key MUST include marketplace: `${scope}\x00${marketplace}\x00${pluginId}` to avoid collisions across marketplaces.

---

### `bridges/hooks/dispatch-exec.ts` (NEW) — no-op stub

**Analog:** none. Ship verbatim per RESEARCH.md (lines 813-829):

```typescript
import type { ExtensionContext } from "../../platform/pi-api.ts";
import type { RoutingEntry } from "./event-router.ts";

export async function dispatchHookExec(
  _entry: RoutingEntry,
  _event: unknown,
  _ctx: ExtensionContext,
): Promise<void> {
  // No-op stub. The hook EXECUTION layer (spawn + payload + timeout)
  // fills this body. D-59-04.
  return;
}
```

Signature is locked as `Promise<void>` per D-59-04. Comments must NOT cite phase numbers per `.claude/rules/typescript-comments.md`.

---

### `shared/debug-log.ts` (NEW) — OBS-01 seam

**Analog:** `/home/acolomba/pi-claude-marketplace/extensions/pi-claude-marketplace/domain/components/hooks.ts` lines 167-172 (verbatim migration).

**Core pattern (extract verbatim):**

```typescript
export function hookDebugLog(detail: string): void {
  if (process.env.PI_CLAUDE_MARKETPLACE_DEBUG === "1") {
    // eslint-disable-next-line no-console, no-restricted-syntax -- OBS-01 sanctioned debug seam (D-59-05)
    console.error(`[hooks] ${detail}`);
  }
}
```

**ESLint per-file override (must add to `eslint.config.js`):** Mirror the existing BLOCK B style for `shared/notify.ts` (eslint.config.js:138-145 / 147-159):

```js
{
  files: ["extensions/pi-claude-marketplace/shared/debug-log.ts"],
  rules: {
    "no-restricted-syntax": "off",
    "no-console": "off",
  },
},
```

With the per-file override in place, the inline `eslint-disable-next-line` becomes optional defense-in-depth (planner picks).

**File header comment:** No phase/plan refs per typescript-comments.md. Use a description tied to OBS-01 / IL-2:

```typescript
// shared/debug-log.ts
//
// Sole debug-output seam for the hooks dispatch path. Gated on
// PI_CLAUDE_MARKETPLACE_DEBUG === "1". OBS-01 / IL-2 / IL-3 boundary:
// no other dispatch-path code may call console.error, process.stderr.write,
// or ctx.ui.notify. The per-file ESLint override at eslint.config.js
// authorizes the sanctioned console.error call below; D-59-05 anchor.
```

---

### `index.ts` (MODIFIED) — add `registerHooksBridge(pi)`

**Analog (self):** Existing factory at `/home/acolomba/pi-claude-marketplace/extensions/pi-claude-marketplace/index.ts` lines 18-67.

**`pi.on` registration pattern** (lines 19-26 — typed-binding helper used because `pi.on` overloads are awkward):

```typescript
const onResourcesDiscover = pi.on.bind(pi) as unknown as (
  event: "resources_discover",
  handler: (event: ResourcesDiscoverEvent, ctx: ExtensionContext) => Promise<ResourcesDiscoverResult>,
) => void;
```

**For Phase 59:** the 7 `pi.on(...)` calls live INSIDE `registerHooksBridge` (not at the factory top); the factory simply calls `await registerHooksBridge(pi)`. Mirror existing bridge-tool registrations (`registerClaudePluginCommand` / `registerClaudeMarketplaceTools`, lines 63-67):

```typescript
await registerHooksBridge(pi);
```

**Pitfall 2 ordering (RESEARCH.md):** Inside `registerHooksBridge`, the order MUST be: (1) bump `liveEpoch`, (2) `await hydrateCacheFromDisk()`, (3) initial `rebuildRoutingTables(...)` for both scopes, (4) the 7 `pi.on(...)` calls. Otherwise the first-after-`/reload` SessionStart fires against an empty routing table.

---

### `orchestrators/reconcile/apply.ts` (MODIFIED) — DISP-02 rebuild call site

**Analog (self):** Loop at lines 790-835. Insert `rebuildRoutingTables(readResult.state, loc)` AFTER `await applyPlan(opts, readResult.plan, outcomes)` returns (line 833) but BEFORE the `continue` falls through to the next scope iteration. Pass the per-scope `loc` (already computed inside `readPassForScope`).

**Synchronous call** (DISP-02 sub-ms): no `await`. Sits inside the existing per-scope try-block — exception propagation already handled by WR-01 isolation pattern at lines 791-823.

---

### `orchestrators/plugin/install.ts` and `uninstall.ts` (MODIFIED)

**Analog (self):** Per-plugin lock pattern. Per CONTEXT.md (D-59-02 + Pitfall reviewer Claude's Discretion): cache add/remove MUST sit INSIDE the per-plugin lock (`withLockedStateTransaction`), after Phase 57's `parseHooksConfig` has succeeded.

- `install.ts`: after the per-plugin lock's stage commit, call `addPluginConfigToCache(scope, marketplace, pluginId, parsed)`.
- `uninstall.ts`: inside the per-plugin lock, before stage release, call `removePluginConfigFromCache(scope, marketplace, pluginId)`.

Audit `reinstall.ts` and `update.ts` to verify they route through `uninstall.ts` + `install.ts` (Claude's Discretion).

---

### `domain/components/hooks.ts` (MODIFIED) — delete stub, rewrite import

**Analog (self):**

- Delete `hookDebugLog` stub at lines 154-172 (the JSDoc block + the function body).
- Add `import { hookDebugLog } from "../../shared/debug-log.ts";` to the import block at top of file.
- Callers at lines 186, 193, 207 remain unchanged — same function name, same signature.
- Update file-header comment block (lines 24-29) to drop the "ships a stub" narrative; reference `shared/debug-log.ts` as the authoritative location.

---

### `tests/architecture/hooks-dispatch.test.ts` (NEW)

**Analog:** `/home/acolomba/pi-claude-marketplace/tests/architecture/hooks-foundation.test.ts` (block structure) + `hooks-tool-name-map.test.ts` (inverse / count-lock invariant style).

**File-header pattern** (hooks-foundation.test.ts lines 1-13): doc-block stating which REQ IDs the file pins and the technique (static introspection / runtime parse round-trip / type-level `@ts-expect-error`). Mirror exactly, swap REQ IDs to DISP-01..04 + OBS-01.

**Block structure** (hooks-foundation.test.ts uses 5 separator-comment-delimited blocks):

```typescript
// ──────────────────────────────────────────────────────────────────────────
// Block 1: DISP-01 -- pi.on(...) registered exactly 7 times at factory time
// ──────────────────────────────────────────────────────────────────────────
```

**Test invariants to pin (per CONTEXT.md D-59-04 architecture-test list):**
1. **DISP-01 count-lock:** 7 `pi.on(...)` registrations at factory time. Use a fake `pi` with a counter; assert call count === 7 and the 7 event names are the locked set.
2. **DISP-02 routing-table shape:** rebuild produces 8 buckets keyed by Claude event names from `BUCKET_A_EVENTS`.
3. **DISP-04 ordering:** assert sort order matches `compareByNameThenScope` cross-plugin + declaration index within plugin.
4. **DISP-03 epoch mismatch:** register a handler, mutate `liveEpoch`, dispatch, assert `dispatchHookExec` never called. (RESEARCH.md Pitfall 1: document the limitation that this test exercises the shared-module path, not the cross-instance natural reload path.)
5. **D-59-01 `tool_result.isError` split:** call composite handler with `{isError: true}` → PostToolUseFailure bucket dispatched; with `{isError: false}` → PostToolUse bucket.

**Inverse-style fixture pattern** (hooks-tool-name-map.test.ts lines 26-58): import the closed-set tuple, iterate, assert per-element invariant. Apply for the `BUCKET_A_EVENTS` ↔ routing-table-keys check.

**Phase/plan number policy:** Test descriptions MUST NOT cite "Phase NN" / "Plan NN" / "Pitfall N" per `.claude/rules/typescript-comments.md`. Use REQ/decision anchors only (`"DISP-01"`, `"D-59-01"`).

## Shared Patterns

### Comment policy (cross-cutting, MANDATORY)

**Source:** `.claude/rules/typescript-comments.md` (loaded into context above)

**Apply to:** All new files and all modified comment blocks.

- Forbidden: `Phase NN`, `Plan NN`, `Wave N`, `Task N`, `milestone vX.Y`, `(Phase NN review)`, bare `Pitfall N` / `Pattern N` (single-digit unqualified).
- Allowed (and encouraged): `D-59-01`, `DISP-01`, `OBS-01`, `NFR-2`, `IL-2`, `IL-3`, GitHub `#NNN`.

The skeleton snippets in RESEARCH.md include phase-citing comments — strip those refs before pasting. Existing in-file phase refs that are PRESERVED (`Phase 2: remove old target files` in `bridges/agents/stage.ts`) are domain language, not GSD history. Only GSD planning artefact citations are forbidden.

### ESLint zone rules (cross-cutting)

**Source:** `eslint.config.js:188-197` (`bridges/` zone) and `eslint.config.js:244-254` (`shared/` zone)

**Apply to:** `bridges/hooks/*.ts` (may import from `domain/`, `persistence/`, `shared/`, `platform/`); `shared/debug-log.ts` (may import from `platform/` only — but it has NO imports, only `process.env` + `console.error`).

### Pi peer-dep import chokepoint

**Source:** `eslint.config.js:260-282` (D-04). All `@earendil-works/pi-coding-agent` types come through `platform/pi-api.ts` re-exports; never imported directly elsewhere.

**Apply to:** `bridges/hooks/event-router.ts`, `bridges/hooks/dispatch-exec.ts`. Use `import type { ExtensionAPI, ExtensionContext } from "../../platform/pi-api.ts"`. Add `ToolCallEvent`, `ToolResultEvent`, `SessionStartEvent`, etc. as re-exports from `platform/pi-api.ts` if not already exposed.

### Per-plugin lock seam

**Source:** `transaction/with-state-guard.ts` (`withLockedStateTransaction`)

**Apply to:** `install.ts` cache-add and `uninstall.ts` cache-remove. The cache mutation MUST sit inside the existing lock so concurrent `apply` rebuilds observe consistent state (CONTEXT.md "Cache eviction edge cases").

### Sort comparator

**Source:** `shared/notify.ts:2899-2916`

```typescript
export interface Sortable {
  readonly name: string;
  readonly scope: "user" | "project";
}

export function compareByNameThenScope(a: Sortable, b: Sortable): number {
  const byName = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  if (byName !== 0) return byName;
  if (a.scope === b.scope) return 0;
  return a.scope === "project" ? -1 : 1;
}
```

**Apply to:** `rebuildRoutingTables` cross-plugin sort. Pass `{ name: pluginId, scope }`. Project-before-user tie-break is the locked invariant — do NOT reverse.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `bridges/hooks/event-router.ts` | bridge module-state holder | event-driven + in-memory cache | First bridge with non-trivial module state (`liveEpoch` cell + `Map<key, ParsedHooksConfig>` cache + `Map<BucketAEvent, RoutingEntry[]>` routing table). Existing 4 bridges (`agents`/`commands`/`mcp`/`skills`) are state-light staging factories. Use RESEARCH.md Pattern 1 (lines 343-387) skeleton + skeleton-comment hygiene policy. |
| `bridges/hooks/dispatch-exec.ts` | no-op stub | request-response | No existing stub-files in the codebase. Ship verbatim per RESEARCH.md skeleton. |

## Metadata

**Analog search scope:**
- `extensions/pi-claude-marketplace/bridges/{agents,commands,mcp,skills}/`
- `extensions/pi-claude-marketplace/shared/`
- `extensions/pi-claude-marketplace/domain/components/hooks.ts`
- `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts`
- `extensions/pi-claude-marketplace/index.ts`
- `tests/architecture/hooks-foundation.test.ts`, `hooks-tool-name-map.test.ts`

**Files scanned:** 12

**Pattern extraction date:** 2026-06-14

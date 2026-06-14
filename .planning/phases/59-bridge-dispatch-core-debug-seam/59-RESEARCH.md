# Phase 59: Bridge Dispatch Core & Debug Seam - Research

**Researched:** 2026-06-14
**Domain:** Pi extension event dispatch + module-state lifecycle + architectural import-boundary compliance
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-59-01 (7 Pi listeners, 8 Claude routes, `tool_result` isError split).**
The bridge registers `pi.on(...)` for **7 distinct Pi event types** at
factory time. The routing table is keyed by Claude event name (8 keys).
The `tool_result` composite handler is the only one that fans out to two
Claude-event routing buckets — it reads `event.isError` once at the top,
then dispatches to the PostToolUse bucket (falsy/absent) or the
PostToolUseFailure bucket (truthy). All other 6 Pi → Claude mappings are
1:1.

Locked routing table:

| Pi event | Claude event(s) | Per-event filter at registration time |
| --- | --- | --- |
| `session_start` | SessionStart | source ∈ {startup, resume, clear, compact} from D-58-06 matcher table |
| `session_shutdown` | SessionEnd | reason ∈ {clear, resume, logout, prompt_input_exit, bypass_permissions_disabled, other} |
| `session_before_compact` | PreCompact | trigger ∈ {manual, auto} |
| `session_compact` | PostCompact | trigger ∈ {manual, auto} |
| `input` | UserPromptSubmit | no matcher (TOOL-02 rejects any non-empty matcher per D-58-06) |
| `tool_call` | PreToolUse | tool-name matcher (Phase 58's Pi-form `Set<string>` or MATCH_ALL sentinel) |
| `tool_result` | PostToolUse + PostToolUseFailure | split on `event.isError` inside the composite handler |

**D-59-02 (bridge-owned parsed-config cache, hydrated at factory time,
kept live by install/uninstall).** `rebuildRoutingTables(state, loc)`
reads from an in-memory `Map<{scope, pluginId}, ParsedHooksConfig>` owned
by the router module. Three populating moments: factory hydration, install
add, uninstall drop. Zero disk reads on the rebuild path (DISP-02).

**D-59-03 (bump at factory entry).** Module-level `let liveEpoch = 0`;
`registerHooksBridge(pi)` increments at function entry. Composite handlers
capture the value via closure; on dispatch, mismatch = no-op.

**D-59-04 (stub `dispatchHookExec`, Phase 59 owns only ordering + epoch
+ table).** Composite handler shape ships epoch check + ordering +
table walk + `await dispatchHookExec(entry, event, ctx)`. The stub
returns `void`; Phase 60 fills the body. Phase 59 architecture tests
verify: (a) `pi.on(...)` registered exactly 7 times at factory time;
(b) routing table contains expected Claude-event buckets after rebuild;
(c) order = `compareByNameThenScope` + declaration order; (d) epoch
mismatch no-ops without invoking `dispatchHookExec`; (e) `tool_result`
composite handler reads `event.isError` and dispatches to the right
bucket.

**D-59-05 (migrate `hookDebugLog` to `shared/debug-log.ts`).** The
Phase 57 local stub at `domain/components/hooks.ts` is removed; existing
callers re-import from `shared/debug-log.ts`. No behavior change — only
file move + import rewrites; per-file ESLint console override moves with
the file.

### Claude's Discretion

- `shared/event-router.ts` internal API shape — recommended surface:
  `registerHooksBridge`, `rebuildRoutingTables`, `addPluginConfigToCache`,
  `removePluginConfigFromCache`, `compositeHandlerFor(claudeEvent,
  capturedEpoch)`.
- Composite handler file placement — `bridges/hooks/dispatch.ts` or
  `bridges/hooks/index.ts`; split when composite handler + helpers
  exceed ~150 lines.
- `dispatchHookExec` stub location and signature — `bridges/hooks/
  dispatch-exec.ts` (NEW). Phase 59 signature: `Promise<void>`.
- Cache invalidation on `reinstall` / `update` orchestrators — verify
  add/remove goes through the install/uninstall seams (audit-only).
- Architecture-test source-of-truth shape — follow Phase 57 P04 /
  Phase 58 P04: `pi.on` call-count fixture, routing-table shape
  fixture, epoch-mismatch test, `tool_result.isError` split test.
- Cache eviction edge cases — verify the cache add/remove sits inside
  the per-plugin lock so a concurrent `apply` rebuild observes
  consistent state.

### Deferred Ideas (OUT OF SCOPE)

- Hook EXECUTION (`spawn child_process`) — Phase 60 EXEC-01..04.
- PAYL-01 payload translators — Phase 60.
- `if`-field permission-rule matcher (MATCH-03) — Phase 61.
- `asyncRewake` registry (HOOK-06 / EXEC-05) — Phase 62.
- SURF-01 `info <plugin>` hooks-line rendering — Phase 63.
- LIFE-01 5th cascade slot — Phase 63.
- `dispatchHookExec` return-type expansion (`Promise<HookExecResult>`)
  — Phase 60.
- Routing-table architecture-test invariants beyond the 5 Phase 59
  pins — Phases 60-62 add their own; do not churn Phase 59's test file.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DISP-01 | `pi.on(eventName, handler)` called exactly once per supported Pi event type at extension-factory time; routing state read from `shared/event-router.ts` | Pi `ExtensionAPI.on(...)` overloads verified at `node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts:807-836`; 7 distinct events targeted (`session_start`, `session_shutdown`, `session_before_compact`, `session_compact`, `input`, `tool_call`, `tool_result`); no `off`/`removeHandler` exposed (single-listener-per-event is structurally enforceable) |
| DISP-02 | Routing table cleared and rebuilt synchronously by `rebuildRoutingTables(state, loc)` after each scope's apply pass; sub-ms, atomic under Node's single-thread model | Call site identified at `orchestrators/reconcile/apply.ts:790-835` (the `for (const scope of scopes)` loop, after `applyPlan(opts, readResult.plan, outcomes)` returns per scope); cache is bridge-owned (D-59-02) so rebuild walks `state.marketplaces[*].plugins[*].resources.hooks` and reads parsed configs from cache (zero disk I/O) |
| DISP-03 | Composite handlers close over an epoch integer; module-level `liveEpoch` bumped on each bridge load; stale handlers no-op | Pi reloads extensions via `jiti` with `moduleCache: false` (`node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/loader.js:264-275`), so the module body re-evaluates on each `/reload` — module-top `let liveEpoch = 0` initializes fresh, then D-59-03's factory-entry increment puts the new load at epoch ≥ 1. **CAVEAT (Pitfall 1):** because the OLD and NEW modules are SEPARATE instances with independent `liveEpoch` variables, a stale handler from the OLD load reads its OWN module's `liveEpoch` (unchanged from prior load), so the epoch-mismatch defense as written does NOT trip in the natural module-replacement case. The real zombie defense is Pi's `_extensionRunner` swap in `agent-session.js:1915-1918`, which drops the OLD handler map entirely. Phase 59's epoch is belt-and-suspenders against a future Pi change to module caching or a future Phase 60 `setTimeout` future-dispatch path — preserve it per REQ wording but do not rely on it as the load-bearing zombie defense |
| DISP-04 | Deterministic ordering — `compareByNameThenScope` cross-plugin; declaration order within plugin's `hooks.json`; sequential awaited fan-out | `compareByNameThenScope` lives at `shared/notify.ts:2899-2916`; accepts `{readonly name: string; readonly scope: "user"\|"project"}`; project-first tie-break; case-insensitive sensitivity:'base'; established consumer (reinstall, preview, import); for routing-table entries `name = pluginName` and `scope` from cache key |
| OBS-01 | `shared/debug-log.ts` is the sole debug-output seam; gated on `PI_CLAUDE_MARKETPLACE_DEBUG=1`; never `console.error`/`process.stderr.write`/`ctx.ui.notify` in the dispatch path | Phase 57's `hookDebugLog` stub at `domain/components/hooks.ts:167-172` carries the env-gated `console.error` + per-call `eslint-disable-next-line` directive; migration path: extract function verbatim, update three callsites at `hooks.ts:186, 193, 207`, move ESLint per-file override block from current implicit (no override — the stub uses inline `eslint-disable-next-line` directives) to a new explicit `eslint.config.js` per-file override on `shared/debug-log.ts` mirroring `BLOCK B` for `shared/notify.ts` (`eslint.config.js:138-145`) |

</phase_requirements>

## Summary

Phase 59 wires the runtime dispatch layer on top of Phases 57-58's schema +
parser foundations. Five REQs land — DISP-01..04 + OBS-01 — establishing
seven `pi.on(...)` registrations at extension-factory time, an in-memory
bridge-owned routing table rebuilt synchronously after each scope's
reconcile-apply pass, an epoch-based zombie-dispatch defense, deterministic
`compareByNameThenScope` + declaration-order ordering inside each composite
handler, and a single canonical `shared/debug-log.ts` debug-output seam.

The Pi extension API surface and the Pi reload lifecycle are fully verified
against the locked `@earendil-works/pi-coding-agent@0.73.x` peer dep:
[VERIFIED: node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts:807-836]
exposes `pi.on(...)` as overloads-only (no `off`, no `removeHandler`),
which makes "exactly once per supported Pi event type" structurally
inviolable; [VERIFIED: same file:609-651, 652-692] confirms `ToolCallEvent`
and `ToolResultEvent` payload shapes including `isError: boolean` (required
field, not optional); [VERIFIED:
node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/loader.js:264-275]
shows `jiti` with `moduleCache: false` re-evaluating extension modules on
each load, giving the module-top epoch variable a fresh cell per load.

**Primary recommendation:** Move the router module from
`shared/event-router.ts` (CONTEXT.md proposal) to `bridges/hooks/event-router.ts`.
The router must call `parseHooksConfig` (a runtime function in `domain/`),
read `state.marketplaces[*].plugins[*].resources.hooks` (a runtime type
from `persistence/`), and read `locations.hooksDir` (a runtime value from
`persistence/`). Existing ESLint zone rules in `eslint.config.js:244-254`
forbid `shared/` from importing `domain/` or `persistence/` runtime
values; placing the router in `bridges/hooks/` keeps zone compliance with
zero rule changes. `shared/debug-log.ts` (OBS-01) DOES belong in `shared/`
because it imports nothing from `domain/`/`persistence/` — pure
env-gated console wrapper.

A second material finding: the Phase 58 `NON_TOOL_EVENT_CLOSED_SETS`
table (`domain/components/hook-events.ts:128-145`) already records that
`SessionEnd` / `PreCompact` / `PostCompact` have **empty** Pi-mappable
closed sets — every non-match-all matcher on those events already trips
TOOL-02 at parse time. Phase 59's "per-event filter at registration
time" for those three events therefore reduces to "no filter" (the only
admissible matchers are `""` / `"*"`, which are match-all, which means
fire on every Pi event of that type). The composite handlers for those
three Pi event types do not need source/reason/trigger extraction at
all under v1.13. Only the `session_start` composite handler needs the
SessionStart source-filter logic — and per the closed set, only
`startup` and `resume` are admissible Pi `reason` values.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `pi.on(...)` registration | `bridges/hooks/` | `platform/pi-api.ts` (types) | DISP-01 wires Pi's event surface — definitionally bridge work |
| Module-state holder (`liveEpoch`, parsed-config cache) | `bridges/hooks/event-router.ts` | — | The state spans plugin install/uninstall + factory-time hydrate + per-scope rebuild; bridges/ is the only zone that may import from `domain/` + `persistence/` + `shared/` |
| Composite handler bodies (7 of them) | `bridges/hooks/dispatch.ts` (or `bridges/hooks/index.ts`) | `bridges/hooks/event-router.ts` (router consumer) | DISP-03 epoch check + DISP-04 ordering loop + table walk live here; Phase 60 fills the `dispatchHookExec` stub body in lockstep |
| `dispatchHookExec` no-op stub | `bridges/hooks/dispatch-exec.ts` (NEW) | — | D-59-04: Phase 60 replaces the body; Phase 59 ships `() => Promise.resolve()` |
| Debug-log seam (OBS-01) | `shared/debug-log.ts` (NEW) | — | Pure env-gated console wrapper; `shared/` is the right zone |
| Routing-table rebuild call site | `orchestrators/reconcile/apply.ts` | `bridges/hooks/event-router.ts` (the rebuild function) | DISP-02 places the call after each scope's `applyPlan(...)` returns |
| Cache add/remove call sites | `orchestrators/plugin/install.ts`, `orchestrators/plugin/uninstall.ts` | `bridges/hooks/event-router.ts` | Inside the per-plugin lock so concurrent rebuilds observe consistent state |
| `parseHooksConfig` at factory-time hydrate | `bridges/hooks/event-router.ts` → `domain/components/hooks.ts` | `persistence/locations.ts` (path construction) | Read each installed plugin's `hooks.json` via `locations.hooksDir` |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js | `>=20.19.0` (effective `>=22.18` post-Phase 55) | Runtime | NFR-4; native TS strip on 22.18+ |
| TypeScript | `^5.9.3` | Strict-mode TS; discriminated handler closures | NFR-7 |
| `@earendil-works/pi-coding-agent` | peer dep `^0.70.6` floor (development against `^0.73.x`) | `ExtensionAPI.on(...)` overloads, `ExtensionHandler<E,R>` shape, payload types | Phase 59 has no new peer-dep needs beyond v1.12 baseline |
| `node:test` (built-in) | bundled | Architecture tests | Existing pattern |

### Supporting

No new dependencies. Phase 59 is pure TypeScript on the existing stack.
Confirmed via:

- `npm view @earendil-works/pi-coding-agent version` → current `0.73.x`
  line (verified at install time per package-lock).
- No `child_process`, no `fs.watch`, no `chokidar`, no `setTimeout` —
  Phase 60+ work.
- No new schema validators — Phase 57's `HOOKS_VALIDATOR` and Phase 58's
  `parseHooksConfig` are the only entry points.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Bridge-owned cache (D-59-02) | Re-parse `hooks.json` on every `rebuildRoutingTables` | Rejected by D-59-02: disk I/O on the rebuild path violates the sub-ms DISP-02 constraint |
| Module-top `let liveEpoch = 0` (D-59-03 baseline) | `globalThis`-pinned slot, e.g. `globalThis.__pi_claude_hooks_epoch__` | Rejected: introduces a global namespace dependency without solving the underlying "stale handler reads its own module's epoch" issue (Pitfall 1). Module-scope is correct per D-59-03 |
| Composite handlers fan-out via `Promise.all` | Sequential `await` (locked by DISP-04) | Rejected by REQ: ordering must be deterministic and observable for Phase 60+ |

**Installation:** No new packages. Stack is verified current.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `@earendil-works/pi-coding-agent` (peer dep, existing) | npm | n/a (existing v1.12 dep) | n/a | github.com/earendil-works | OK | Approved (carry-forward) |
| `typebox` (existing dev/peer) | npm | n/a | n/a | github.com/sinclairzx81/typebox | OK | Approved (carry-forward) |

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** none.

Phase 59 introduces NO new package dependencies. The legitimacy audit
re-confirms only existing v1.12 peer/runtime deps already in use.

## Architecture Patterns

### System Architecture Diagram

```
                        Pi process lifecycle
                                │
                                ▼
                    ┌───────────────────────┐
                    │  /reload triggered    │
                    │  ─────────────────    │
                    │  jiti.import(...) re- │
                    │  evaluates extension  │
                    │  module body          │
                    └──────────┬────────────┘
                               │
                               ▼
                   ┌──────────────────────────┐
                   │ index.ts factory call    │
                   │ (Pi calls our default    │
                   │  export with `pi`)       │
                   └──────────┬───────────────┘
                              │
                              ▼
                  ┌─────────────────────────────┐
                  │ registerHooksBridge(pi)     │
                  │ (new — Phase 59)            │
                  ├─────────────────────────────┤
                  │ 1. liveEpoch += 1           │ ◄── DISP-03
                  │ 2. hydrate cache from disk  │ ◄── D-59-02
                  │    walk state.marketplaces  │
                  │    for each plugin, read    │
                  │    <hooksDir>/<name>/       │
                  │    hooks.json + parse       │
                  │ 3. capturedEpoch = liveEpoch│
                  │ 4. for each of 7 Pi events: │
                  │      pi.on(eventName,       │ ◄── DISP-01
                  │        compositeHandlerFor( │
                  │          claudeEvent,       │
                  │          capturedEpoch))    │
                  └────────────┬────────────────┘
                               │
                               ▼
              ┌──────────────────────────────────┐
              │ resources_discover fires         │
              │   (already wired Phase 50)       │
              │ → applyReconcile(...)            │
              │   for each scope:                │
              │     readPassForScope             │
              │     applyPlan(opts, plan)        │
              │       installPlugin → cache.add  │ ◄── D-59-02
              │       uninstallPlugin → cache.rm │
              │     rebuildRoutingTables(...)    │ ◄── DISP-02
              │       (NEW Phase 59 call site)   │
              └──────────────────┬───────────────┘
                                 │
                                 ▼
                  ┌─────────────────────────────────┐
                  │ Steady-state: Pi fires events   │
                  │ → composite handler invoked     │
                  ├─────────────────────────────────┤
                  │ if (captured !== liveEpoch)     │ ◄── DISP-03
                  │   return; // belt-and-suspenders│
                  │ bucket = routingTable.get(      │
                  │   claudeEventName)              │
                  │ for entry of bucket {           │ ◄── DISP-04
                  │   if (!matcherFires) continue;  │ (compareByNameThenScope-sorted)
                  │   await dispatchHookExec(       │ ◄── D-59-04 stub
                  │     entry, event, ctx)          │   (Phase 60 fills body)
                  │ }                               │
                  │ // tool_result-special: read    │ ◄── D-59-01
                  │ // event.isError once at top,   │
                  │ // pick PostToolUse vs          │
                  │ // PostToolUseFailure bucket    │
                  └─────────────────────────────────┘
```

Component responsibilities by file:

| File | Phase 59 role |
|------|---------------|
| `bridges/hooks/event-router.ts` (NEW) | Module-state holder: `liveEpoch` cell, `Map<{scope,pluginId}, ParsedHooksConfig>` cache; exports `registerHooksBridge`, `rebuildRoutingTables`, `addPluginConfigToCache`, `removePluginConfigFromCache`, `compositeHandlerFor` |
| `bridges/hooks/dispatch.ts` (NEW, optional split) | Composite handler bodies for the 7 Pi events; matcher-fires predicate; routing-bucket lookup |
| `bridges/hooks/dispatch-exec.ts` (NEW) | `dispatchHookExec(entry, event, ctx): Promise<void>` no-op stub (D-59-04) |
| `bridges/hooks/index.ts` (NEW) | Barrel re-exports the public surface (same convention as existing bridges) |
| `shared/debug-log.ts` (NEW) | `hookDebugLog(detail: string): void`, env-gated console.error |
| `index.ts` | Adds `registerHooksBridge(pi)` call inside factory body |
| `orchestrators/reconcile/apply.ts` | Adds `rebuildRoutingTables(state, loc)` call after each scope's `applyPlan(...)` |
| `orchestrators/plugin/install.ts` | Adds `addPluginConfigToCache(scope, pluginId, parsed)` inside the per-plugin lock, after Phase 57's `parseHooksConfig` succeeds |
| `orchestrators/plugin/uninstall.ts` | Adds `removePluginConfigFromCache(scope, pluginId)` inside the per-plugin lock |
| `domain/components/hooks.ts` | Phase 57 `hookDebugLog` stub deleted; three callers (lines 186, 193, 207) re-import from `shared/debug-log.ts` |

### Recommended Project Structure

```
extensions/pi-claude-marketplace/
├── bridges/
│   ├── hooks/                     # NEW (Phase 59)
│   │   ├── index.ts               # barrel
│   │   ├── event-router.ts        # module state + 5 exports
│   │   ├── dispatch.ts            # 7 composite handler bodies (or fold into index.ts)
│   │   └── dispatch-exec.ts       # Phase 60 stub
│   ├── agents/ commands/ mcp/ skills/   # existing
├── shared/
│   ├── debug-log.ts               # NEW (Phase 59 OBS-01)
│   ├── notify.ts                  # existing (carry-forward compareByNameThenScope)
├── domain/
│   ├── components/
│   │   ├── hooks.ts               # Phase 57/58 — hookDebugLog stub removed
│   │   ├── hook-events.ts         # Phase 58
│   │   └── hook-tool-names.ts     # Phase 58
├── orchestrators/
│   ├── reconcile/apply.ts         # +1 rebuildRoutingTables call
│   └── plugin/
│       ├── install.ts             # +1 addPluginConfigToCache call
│       └── uninstall.ts           # +1 removePluginConfigFromCache call
```

### Pattern 1: Bridge factory with module-state

The four existing bridges (`bridges/agents`, `bridges/commands`,
`bridges/mcp`, `bridges/skills`) are state-light — they expose `prepareStage*`
/ `commitPrepared*` / `abortPrepared*` / `unstage*` helpers per their
`index.ts` barrels [VERIFIED: bridges/agents/index.ts, bridges/skills/index.ts,
bridges/commands/index.ts, bridges/mcp/index.ts]. None of them register
event handlers via `pi.on(...)` or carry module-level state.

The hooks bridge is the first to do both. The factory pattern:

```typescript
// bridges/hooks/event-router.ts
import type { ExtensionAPI, ExtensionContext } from "../../platform/pi-api.ts";
import { compareByNameThenScope } from "../../shared/notify.ts";
import { parseHooksConfig, type HooksConfig } from "../../domain/components/hooks.ts";
import { BUCKET_A_EVENTS, type BucketAEvent } from "../../domain/components/hook-events.ts";
import { hookDebugLog } from "../../shared/debug-log.ts";

// Source: D-59-03 module-top epoch cell.
let liveEpoch = 0;

// Source: D-59-02 bridge-owned cache.
interface CacheKey { readonly scope: "user" | "project"; readonly pluginId: string }
const parsedConfigCache = new Map<string, { scope: "user"|"project"; pluginId: string; config: HooksConfig }>();
// (key is `${scope}\x00${pluginId}` — null-byte separator avoids collisions)

const routingTable = new Map<BucketAEvent, ReadonlyArray<RoutingEntry>>();

export interface RoutingEntry {
  readonly scope: "user" | "project";
  readonly pluginId: string;
  readonly matcher: ParsedMatcher;          // from Phase 58
  readonly handlerDecl: HookHandlerEntry;   // from Phase 57
  readonly declarationIndex: number;        // for DISP-04 within-plugin order
}

export async function registerHooksBridge(pi: ExtensionAPI): Promise<void> {
  liveEpoch += 1;
  const capturedEpoch = liveEpoch;

  // Factory-time cache hydrate (D-59-02). One-time per /reload.
  // Walk both scopes, read each installed plugin's hooks.json, parse,
  // populate cache. Skip plugins with `resources.hooks: []`.
  await hydrateCacheFromDisk();

  // DISP-01: exactly one registration per supported Pi event type.
  pi.on("session_start",        compositeHandlerFor("SessionStart",       capturedEpoch));
  pi.on("session_shutdown",     compositeHandlerFor("SessionEnd",         capturedEpoch));
  pi.on("session_before_compact", compositeHandlerFor("PreCompact",       capturedEpoch));
  pi.on("session_compact",      compositeHandlerFor("PostCompact",        capturedEpoch));
  pi.on("input",                compositeHandlerFor("UserPromptSubmit",   capturedEpoch));
  pi.on("tool_call",            compositeHandlerFor("PreToolUse",         capturedEpoch));
  pi.on("tool_result",          toolResultCompositeHandler(capturedEpoch)); // D-59-01 special
}
```

**Why this pattern:** module-scope `liveEpoch` + `Map` is preserved across
the factory's lifetime; `/reload` re-evaluates the module body (Pi uses
`jiti` with `moduleCache: false`) and resets to a fresh module instance.
The factory-entry `liveEpoch += 1` writes to the NEW module's cell.

### Pattern 2: `tool_result` composite handler — `event.isError` split

```typescript
// bridges/hooks/dispatch.ts (or event-router.ts)
function toolResultCompositeHandler(capturedEpoch: number) {
  return async (event: ToolResultEvent, ctx: ExtensionContext): Promise<void> => {
    if (capturedEpoch !== liveEpoch) return;                  // DISP-03
    const claudeEvent: BucketAEvent = event.isError
      ? "PostToolUseFailure"
      : "PostToolUse";                                         // D-59-01
    const bucket = routingTable.get(claudeEvent);
    if (!bucket) return;
    for (const entry of bucket) {                              // DISP-04
      if (!matcherFires(entry.matcher, event.toolName)) continue;
      await dispatchHookExec(entry, event, ctx);               // Phase 60 stub
    }
  };
}
```

Source: D-59-01 routing table + Pi `ToolResultEvent.isError: boolean`
[VERIFIED:
node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts:652-692].

### Pattern 3: `rebuildRoutingTables` (DISP-02)

```typescript
// bridges/hooks/event-router.ts
export function rebuildRoutingTables(state: ExtensionState, loc: ScopedLocations): void {
  // Synchronous, sub-ms; no disk I/O (cache is bridge-owned).
  // Clear all 8 buckets at once, then re-populate.
  const entriesByEvent = new Map<BucketAEvent, RoutingEntry[]>();
  for (const event of BUCKET_A_EVENTS) entriesByEvent.set(event, []);

  // Walk state for THIS scope only (rebuild is per-scope per CONTEXT).
  const mpRecords = state.marketplaces;
  const collected: Array<{ scope: "user"|"project"; pluginId: string; config: HooksConfig }> = [];
  for (const [_mp, mpRecord] of Object.entries(mpRecords)) {
    if (mpRecord.scope !== loc.scope) continue;
    for (const [pluginId, pluginRecord] of Object.entries(mpRecord.plugins)) {
      if (pluginRecord.resources.hooks.length === 0) continue;
      const key = `${loc.scope}\x00${pluginId}`;
      const cached = parsedConfigCache.get(key);
      if (cached === undefined) continue;       // not hydrated yet — first install
      collected.push({ scope: loc.scope, pluginId, config: cached.config });
    }
  }

  // DISP-04: sort across plugins via compareByNameThenScope.
  collected.sort((a, b) =>
    compareByNameThenScope(
      { name: a.pluginId, scope: a.scope },
      { name: b.pluginId, scope: b.scope },
    )
  );

  // Flatten each plugin's hooks.json into per-Claude-event entries
  // preserving declaration order within the plugin.
  for (const { scope, pluginId, config } of collected) {
    for (const [eventName, groups] of Object.entries(config)) {
      const ev = eventName as BucketAEvent;
      const bucket = entriesByEvent.get(ev);
      if (!bucket) continue;          // non-bucket-A event tripped TOOL-02; defensive
      let declIdx = 0;
      for (const group of groups) {
        for (const handler of group.hooks) {
          bucket.push({ scope, pluginId, matcher: parseMatcher(group.matcher ?? ""),
                        handlerDecl: handler, declarationIndex: declIdx++ });
        }
      }
    }
  }

  for (const [ev, list] of entriesByEvent) {
    routingTable.set(ev, list);
  }
}
```

### Anti-Patterns to Avoid

- **Calling `parseHooksConfig` inside `rebuildRoutingTables`** — violates
  DISP-02 sub-ms target (disk I/O + JSON parse). Cache must be
  pre-populated at install/factory time.
- **Registering `pi.on("tool_result", ...)` twice** — REQ DISP-01 forbids;
  even though Pi's `ExtensionAPI` allows handler chaining via repeated
  `on(...)` calls, the bridge's contract is single-listener-per-event.
- **Placing the router in `shared/`** — violates ESLint zone
  rule `shared → domain` (`eslint.config.js:244-254`). Router must
  call `parseHooksConfig` and read `state.marketplaces[*].plugins[*]`,
  both of which are `domain/`/`persistence/` runtime values.
- **Reading `event.toolName` capitalized in tool_result composite** —
  Pi event `toolName` is lowercase (`"bash"`, `"read"`, etc.). The Phase
  58 parser produces Pi-form `Set<PiToolName>` matchers; comparison is
  direct lowercase-to-lowercase.
- **`Promise.all` dispatch** — DISP-04 requires sequential awaited
  fan-out so Phase 60's `block`/`mutate` semantics observe deterministic
  per-handler ordering.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Plugin name ordering | Custom sort | `compareByNameThenScope` from `shared/notify.ts:2904` | MSG-GR-3 invariant; case-insensitive base sensitivity; project-first; established consumer |
| `hooks.json` parsing | Re-implement JSON+TypeBox validation | `parseHooksConfig` from `domain/components/hooks.ts:180` | Phase 57/58 contract — discriminated `{ok:true,value}|{ok:false,reason}` already wired |
| Matcher comparison | Re-implement tool-name set semantics | `parseMatcher` + `ParsedMatcher` union from `domain/components/hooks.ts:330` | Phase 58 contract — Pi-form set / mcp-literal / match-all / regex / unmapped |
| Bucket-A event closed set | Hand-coded array | `BUCKET_A_EVENTS` tuple from `domain/components/hook-events.ts:35` | Phase 58 source-of-truth — typed `BucketAEvent` literal union |
| Non-tool event filter targets | Per-handler conditionals | `NON_TOOL_EVENT_FIELDS` + `NON_TOOL_EVENT_CLOSED_SETS` from `hook-events.ts:86,128` | Phase 58 closed-set tables already encode `SessionStart.source` map and the (empty) compact/sessionEnd sets |
| Per-plugin lock + state save | Custom lock | `withLockedStateTransaction` from `transaction/with-state-guard.ts` | CR-01 / WR-04 — already used by install/uninstall; the cache add/remove must sit INSIDE this seam |
| Atomic JSON write | `fs.writeFile` | `atomicWriteJson` from `shared/atomic-json.ts` | NFR-1; Phase 59 doesn't write state but inherits the discipline if anything is added |
| `pi.on(...)` typing | Custom `(event, handler) => void` wrapper | Direct overloaded signatures from `platform/pi-api.ts` re-export | Phase 7 D-04 — Pi peer-import chokepoint enforced by `eslint.config.js:260-282` |

**Key insight:** Phase 59 is almost entirely composition over existing
Phase 57/58 leaf primitives. The new code lives in two new files
(`bridges/hooks/event-router.ts` + `bridges/hooks/dispatch-exec.ts`) plus
a tiny `shared/debug-log.ts`. The rest is calls into existing seams.

## Runtime State Inventory

Phase 59 is a NEW-CODE phase, not a rename/refactor/migration phase. No
state items need migrating from a prior shape. The "state" introduced is
in-memory only (the bridge-owned cache + epoch); both reset on `/reload`
and are fully derivable from `state.json` + on-disk `hooks.json`
contents per NFR-3 (idempotent / fail-clean).

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — all Phase 59 state is in-memory (cache Map + epoch integer) | None |
| Live service config | None — Pi `pi.on(...)` registrations are per-load; no external service holds Phase 59 config | None |
| OS-registered state | None | None |
| Secrets/env vars | New env var read: `PI_CLAUDE_MARKETPLACE_DEBUG` — already used by Phase 57's stub at `domain/components/hooks.ts:168`; OBS-01 migration preserves the same name | None — env var name unchanged |
| Build artifacts | None — TS-only changes | None |

**Nothing found in category:** Stated explicitly above for all five.

## Common Pitfalls

### Pitfall 1: Module re-evaluation breaks the naive epoch-mismatch assumption

**What goes wrong:** A reader of D-59-03 may assume that after `/reload`,
stale composite handlers from the OLD load will trip the
`capturedEpoch !== liveEpoch` check and no-op. This is NOT what happens.

**Why it happens:** Pi re-imports the extension module via `jiti` with
`moduleCache: false`
[VERIFIED:
node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/loader.js:264-275].
On each `/reload`, the OLD and NEW module instances are SEPARATE — each
has its own `liveEpoch` variable. The OLD module's `liveEpoch` is never
mutated by the NEW load. A handler from the OLD load reads its OWN
module's `liveEpoch`, sees the value it captured at registration time,
and runs normally.

The REAL zombie defense is Pi's `_extensionRunner` swap at
`agent-session.js:1915-1918`: the new ExtensionRunner is constructed
over the new extension's handler map, the old runner is dropped,
Pi only emits to the current `_extensionRunner`. Old handlers in the
old module instance are simply never invoked — they get garbage-collected
once nothing references the old module.

**How to avoid:** Implement the epoch mechanism per D-59-03 (the REQ
mandates it; it's belt-and-suspenders against a future Pi change to
module caching, or against a future Phase 60 `setTimeout(...,
N).unref()` queued dispatch that survives reload because it was
scheduled in the OLD module's process scope). DO NOT claim in code
comments or tests that the epoch is the load-bearing zombie defense —
the planner should document accurately that the load-bearing
mechanism is Pi's runner swap, and the epoch is forward-compat insurance.

**Warning signs:** A regression test that registers a handler, "reloads"
by manually calling the factory twice on the SAME module instance,
and asserts the old handler no-ops — that test will pass (because the
shared module-scope `liveEpoch` IS incremented). But it does not
exercise the real production path. A test that imports the module twice
under separate Node `vm.Module` contexts (or via a child process) and
asserts the same — that's the honest test, and it will likely FAIL.
Document the limitation rather than hiding it.

### Pitfall 2: Routing table rebuild order vs first-fire window

**What goes wrong:** `pi.on(...)` registrations happen INSIDE
`registerHooksBridge(...)`. Pi then fires `resources_discover` AFTER
all extension factory calls return [VERIFIED:
extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:34-41
A1 inline note]. `resources_discover` triggers `applyReconcile`, which
mutates `state.marketplaces[*].plugins[*]` (install/uninstall) AND
calls `rebuildRoutingTables(state, loc)` per scope. Between factory
return and `applyReconcile` completion, Pi may fire `session_start`
(or already has, per same A1 note: "pi-coding-agent fires
`resources_discover` AFTER `session_start` has been emitted to every
extension"). The first `session_start` arrives with an EMPTY routing
table — handlers no-op silently. This is not necessarily broken (the
v1.13 first-party plugins using SessionStart are `outpost`,
`commit-commands`, `frosthaven` per CONTEXT.md, all matcher-less, so
they were going to fire match-all — they just don't fire on the FIRST
session_start after a /reload).

**Why it happens:** Pi's ordering invariant
([VERIFIED: agent-session.js:1932-1947] `reload()` emits
`session_shutdown` first, then re-builds runtime, then emits
`session_start`, then `extendResourcesFromExtensions("reload")`)
puts `session_start` BEFORE the bridge's `rebuildRoutingTables`
runs. Factory-time hydration (D-59-02) covers this — the cache is
populated from disk before `pi.on(...)` registrations complete, so
the first `session_start` actually has populated routing tables.
**Validate this:** the factory-time hydrate MUST run BEFORE the
`pi.on(...)` registrations. Otherwise there is a window where a
registered handler closes over an empty routing table.

**How to avoid:** In `registerHooksBridge`, order is critical:
1. `liveEpoch += 1` (first — cheap, defensive)
2. `await hydrateCacheFromDisk()` (await disk I/O before registration)
3. `rebuildRoutingTables(...)` for both scopes (synchronous; populates
   the table from the hydrated cache)
4. The 7 `pi.on(...)` calls (now safe — closures see populated table)

The architecture test should pin this order.

**Warning signs:** First-after-reload SessionStart hook silently
no-ops. Test by capturing `console.error`-style debug output during
the load window.

### Pitfall 3: ESLint zone violation if router placed in `shared/`

**What goes wrong:** CONTEXT.md proposes
`extensions/pi-claude-marketplace/shared/event-router.ts`. But the
router must runtime-import:
- `parseHooksConfig` (function from `domain/components/hooks.ts`)
- `HooksConfig` / `ParsedMatcher` types (from `domain/`)
- `BUCKET_A_EVENTS`, `NON_TOOL_EVENT_*` (from `domain/components/hook-events.ts`)
- `ExtensionState` type + `state.marketplaces[*].plugins[*].resources.hooks` shape (from `persistence/state-io.ts`)
- `ScopedLocations.hooksDir` (from `persistence/locations.ts`)
- `compareByNameThenScope` (from `shared/notify.ts` — OK, same zone)

`eslint.config.js:244-254` enforces:

```
target: "./extensions/pi-claude-marketplace/shared",
from: ["./extensions/pi-claude-marketplace/edge",
       "./extensions/pi-claude-marketplace/orchestrators",
       "./extensions/pi-claude-marketplace/bridges",
       "./extensions/pi-claude-marketplace/domain",
       "./extensions/pi-claude-marketplace/transaction",
       "./extensions/pi-claude-marketplace/persistence"]
message: "shared/ may only import from platform/ for Pi API types."
```

Placing the router in `shared/` means it CANNOT import from `domain/`
or `persistence/` at all — `npm run lint` red-fails on every
`import { ... } from "../../domain/components/hooks.ts"`.

**Why it happens:** Phase 51 (D-11) locked the zone rules. The naming
in CONTEXT.md predates this analysis.

**How to avoid:** Place the router at `bridges/hooks/event-router.ts`.
`bridges/` may import from `domain/` + `persistence/` + `shared/` +
`platform/` per `eslint.config.js:188-197`. The `shared/debug-log.ts`
(OBS-01) DOES belong in `shared/` because it has no cross-domain
imports — pure console wrapper. The planner should treat
"`shared/event-router.ts`" in CONTEXT.md as a naming proposal that
must yield to the zone enforcement, and either:
- (A) Move to `bridges/hooks/event-router.ts` (recommended; zero rule changes).
- (B) Amend the ESLint config to allow `shared → domain` (architecturally
  risky — opens the floodgates).
- (C) Split: epoch cell + cache primitives stay in `shared/` (just data,
  no imports), routing logic + `parseHooksConfig` consumption in
  `bridges/hooks/event-router.ts` (the bigger half).

Option (A) is cleanest.

**Warning signs:** `npm run lint` failure with messages matching
"may only import from platform/ for Pi API types" when the router
file is in `shared/`.

### Pitfall 4: Pi event payload fields do not align with Claude per-event filter values

**What goes wrong:** D-59-01's routing table column "Per-event filter at
registration time" suggests there is per-event filtering on incoming
Pi payload fields. The reality is partial:

[VERIFIED: types.d.ts:403-409]
`SessionStartEvent.reason: "startup" | "reload" | "new" | "resume" | "fork"`
— Claude SessionStart `source` is `{startup, resume, clear, compact}`.
Only `startup` and `resume` overlap. The Phase 58 closed set already
encodes this: `NON_TOOL_EVENT_CLOSED_SETS.SessionStart =
new Set(["startup", "resume"])` ([VERIFIED:
domain/components/hook-events.ts:134]). A SessionStart matcher of
`"clear"` or `"compact"` already trips TOOL-02 at PARSE time (plugin
flips unavailable). So at REGISTRATION time, the only matcher values
ever surfacing to the dispatch path are `""`/`"*"` (match-all) or
literal `"startup"`/`"resume"`. The composite handler reads
`event.reason` and either matches all or filters on the value.

[VERIFIED: types.d.ts:437-442]
`SessionShutdownEvent.reason: "quit" | "reload" | "new" | "resume" | "fork"`
— Claude SessionEnd `reason` is `{clear, resume, logout,
prompt_input_exit, bypass_permissions_disabled, other}`. The Phase 58
closed set is **empty** ([VERIFIED: hook-events.ts:138]):
`SessionEnd: new Set<string>([])`. **Every non-empty SessionEnd
matcher trips TOOL-02 at parse time.** Only match-all is supportable.
Therefore the SessionEnd composite handler does NOT need a filter
layer — it fires unconditionally on every `session_shutdown` event.

[VERIFIED: types.d.ts:423-435]
`SessionBeforeCompactEvent` and `SessionCompactEvent` have NO `trigger`
field at all (they expose `preparation`, `branchEntries`,
`customInstructions`, `signal`, `compactionEntry`, `fromExtension`).
Phase 58's closed set is empty for both events ([VERIFIED:
hook-events.ts:141-142]). Same disposition as SessionEnd: only match-all
matchers are admissible; composite handler fires unconditionally.

**Why it happens:** Pi's event surface evolved independently of
Claude's. The vocabulary divergence is deliberate per D-58-06's
strict-supportability stance.

**How to avoid:** The composite handlers for `session_shutdown`,
`session_before_compact`, `session_compact` are TRIVIAL — they do not
need to extract any filter field. They just walk their routing bucket
(which by construction can only contain entries whose matcher is
match-all). The `session_start` composite handler is the SINGLE
non-trivial non-tool case: it must extract `event.reason` and filter
entries whose matcher is `"startup"` or `"resume"`. The
`compositeHandlerFor(claudeEvent, capturedEpoch)` factory in
`bridges/hooks/event-router.ts` can return one of three shapes:
- For SessionStart: filter by `event.reason` against entry matcher.
- For tool_call / tool_result: filter by `event.toolName` against
  Phase 58 Pi-form set.
- For all four others (SessionEnd, PreCompact, PostCompact,
  UserPromptSubmit): fire on every event of that type (no filter).

Document this in the composite handler factory's JSDoc.

**Warning signs:** Tests asserting that the SessionEnd composite handler
reads `event.reason` and filters — those tests are over-specified and
unnecessary because the parser already rejects all non-match-all
SessionEnd matchers.

### Pitfall 5: state.installations naming — there is no such field

**What goes wrong:** CONTEXT.md, REQ DISP-02, and the additional context
all use "state.installations" as shorthand. The actual state shape is
`state.marketplaces.<mp>.plugins.<plugin>` [VERIFIED:
extensions/pi-claude-marketplace/persistence/state-io.ts:49-92]. There
is no top-level `state.installations` array or map.

**Why it happens:** Conceptual shorthand for "walk every plugin record".

**How to avoid:** The rebuild + hydrate must iterate
`Object.entries(state.marketplaces)` then per-mp
`Object.entries(mpRecord.plugins)` and filter to the current scope
(`mpRecord.scope === loc.scope`) or process both scopes if called
unscoped. The code skeleton in Pattern 3 above does this.

**Warning signs:** A planner who codes against `state.installations.forEach(...)`
will get a TypeScript error immediately. But a planner who refactors
the actual code to call something "installations" creates a confusing
mismatch with the rest of the codebase.

### Pitfall 6: Cache key collisions and concurrent add/remove

**What goes wrong:** Cache key `${scope}\x00${pluginId}` looks fine
until you remember plugins are uniquely identified by `(scope,
marketplace, plugin)` in state. Two plugins with the same id under
different marketplaces in the same scope would collide.

**Why it happens:** Phase 57 D-57-03 stores plugin id as a
`generatedName` per plugin, but the routing entry name used by
`compareByNameThenScope` is also the plugin id. There is no marketplace
qualifier.

**How to avoid:** Inspect existing duplicate-handling. The state shape
nests `state.marketplaces.<mp>.plugins.<plugin>`, which permits
distinct marketplaces to declare the same plugin id. Tip: include
marketplace in the cache key: `${scope}\x00${marketplace}\x00${pluginId}`.
The routing entry's `name` for sort purposes stays `pluginId` (per
D-22 / existing project convention — duplicate plugin names across
marketplaces are not normalized today either; sort stability handles
it). The composite handler's `pluginId` carry-through becomes a
`{marketplace, pluginId}` tuple for downstream phases (Phase 60 needs
both for the per-plugin env vars HOOK-05).

**Warning signs:** Two plugins with the same id in different
marketplaces both have hooks; only one entry shows up in the routing
table; the second silently drops.

## Code Examples

### Composite handler factory (pattern stub for Phase 59 plan)

```typescript
// bridges/hooks/event-router.ts
// Source: D-59-04 composite handler shape + Pitfall 4 non-trivial filter cases.

import type { ExtensionAPI, ExtensionContext } from "../../platform/pi-api.ts";
import type { ToolCallEvent, ToolResultEvent } from "@earendil-works/pi-coding-agent";
// (above import only allowed in platform/pi-api.ts; re-export from there)

import type { BucketAEvent } from "../../domain/components/hook-events.ts";

import { dispatchHookExec } from "./dispatch-exec.ts";

let liveEpoch = 0;
const routingTable = new Map<BucketAEvent, ReadonlyArray<RoutingEntry>>();

function compositeHandlerFor(claudeEvent: BucketAEvent, capturedEpoch: number) {
  return async (event: unknown, ctx: ExtensionContext): Promise<void> => {
    if (capturedEpoch !== liveEpoch) return;
    const bucket = routingTable.get(claudeEvent);
    if (!bucket) return;
    for (const entry of bucket) {
      if (!matcherFiresFor(claudeEvent, entry, event)) continue;
      await dispatchHookExec(entry, event, ctx);
    }
  };
}
```

### `dispatchHookExec` no-op stub

```typescript
// bridges/hooks/dispatch-exec.ts
// Source: D-59-04 no-op stub. Phase 60 fills the body with
// node:child_process.spawn + payload translation + timeout handling.

import type { ExtensionContext } from "../../platform/pi-api.ts";
import type { RoutingEntry } from "./event-router.ts";

export async function dispatchHookExec(
  _entry: RoutingEntry,
  _event: unknown,
  _ctx: ExtensionContext,
): Promise<void> {
  // Phase 59: no-op stub. Phase 60 (EXEC-01..04) fills the body.
  return;
}
```

### `shared/debug-log.ts` (OBS-01 seam)

```typescript
// shared/debug-log.ts
// Source: D-59-05 migration of hookDebugLog from domain/components/hooks.ts.
// Sole debug-output seam; gated on PI_CLAUDE_MARKETPLACE_DEBUG === "1".
// IL-2 boundary: never console.error / process.stderr.write / ctx.ui.notify
// in the dispatch path; this module is the sanctioned escape.

export function hookDebugLog(detail: string): void {
  if (process.env.PI_CLAUDE_MARKETPLACE_DEBUG === "1") {
    // eslint-disable-next-line no-console, no-restricted-syntax -- OBS-01 sanctioned debug seam (D-59-05); per-file ESLint override in BLOCK B-like rule
    console.error(`[hooks] ${detail}`);
  }
}
```

The Phase 57 stub at `domain/components/hooks.ts:167-172` is deleted in
lockstep; the three callers at lines 186, 193, 207 update their import
from `"./hooks.ts"` (relative same-file `hookDebugLog`) to
`"../../shared/debug-log.ts"`.

Phase 58's `checkMatcherSupportability` callers (search for `hookDebugLog`
within `domain/components/hooks.ts` — confirmed at lines 186, 193, 207
only; no other callers in the codebase per
`grep -rn "hookDebugLog" extensions/` returning only 5 hits in
`hooks.ts`).

The ESLint per-file override must move with it. Add to `eslint.config.js`:

```js
{
  files: ["extensions/pi-claude-marketplace/shared/debug-log.ts"],
  rules: {
    "no-restricted-syntax": "off",
    "no-console": "off",
  },
},
```

…sibling to the existing BLOCK B for `shared/notify.ts` and the
`persistence/migrate.ts` block (`eslint.config.js:147-159`). After the
move, the file-internal `eslint-disable-next-line` directive becomes
redundant; the planner picks whether to keep it as defense-in-depth or
remove it.

### `rebuildRoutingTables` call site

```typescript
// orchestrators/reconcile/apply.ts:790-835 — the per-scope loop.
// Source: DISP-02 + CONTEXT.md ("called from orchestrators/reconcile/apply.ts").

for (const scope of scopes) {
  let readResult: ScopeReadResult;
  try {
    readResult = await readPassForScope(scope, opts.cwd);
  } catch (err) {
    /* … */
    continue;
  }

  if (readResult.invalidOutcomes.length > 0) {
    outcomes.push(...readResult.invalidOutcomes);
    continue;
  }

  if (readResult.plan !== undefined) {
    await applyPlan(opts, readResult.plan, outcomes);
  }

  // NEW Phase 59 (DISP-02): rebuild THIS scope's routing tables after
  // the apply pass settles. Synchronous, sub-ms; cache reads only.
  const loc = locationsFor(scope, opts.cwd);
  rebuildRoutingTables(/* current state */ tx.state, loc);
  // ^ NOTE: tx is out of scope here — the readPass returned BEFORE
  //   the apply pass mutated state via per-orchestrator locks.
  //   The planner must re-load state via locationsFor + a fresh read,
  //   or thread the post-apply state snapshot through the outcome stream.
  //   Cleanest: re-read state inside rebuildRoutingTables via the
  //   transaction primitive (read-only).
}
```

**Planner note:** the precise mechanism for accessing the post-apply
state snapshot inside `apply.ts` is a design point. Options:
- (A) Re-acquire a read-only `withLockedStateTransaction(loc, async (tx)
  => rebuildRoutingTables(tx.state, loc))` — clean, but adds a lock.
- (B) Read `loadState(loc)` directly (no lock; rebuild reads only) —
  faster but races against concurrent writes (none expected at this
  point, since the apply pass is complete for this scope).
- (C) Thread the post-apply state through the apply-pass return shape
  — invasive change to `applyPlan` signature.

Option (A) is the safest. The lock-acquire cost is ~milliseconds; still
sub-ms after the lock holder.

### `compareByNameThenScope` call

```typescript
// bridges/hooks/event-router.ts — inside rebuildRoutingTables
// Source: shared/notify.ts:2899-2916.
import { compareByNameThenScope } from "../../shared/notify.ts";

collected.sort((a, b) =>
  compareByNameThenScope(
    { name: a.pluginId, scope: a.scope },
    { name: b.pluginId, scope: b.scope },
  )
);
```

`compareByNameThenScope` accepts the structural minimum `{readonly name:
string; readonly scope: "user"|"project"}`; no adapter needed.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `pi.on` returning a handler-id for `pi.off(id)` | Single-listener-per-event with no removal API | Pi 0.70+ (current 0.73.x) | Means `/reload` is the only way to update handlers; underlies DISP-03 design |
| `setTimeout`-based reload-zombie defense | Module re-evaluation via `jiti({ moduleCache: false })` | Pi current | Validates DISP-03 epoch is forward-compat insurance, not load-bearing |
| `state.installations` flat list | Nested `state.marketplaces.<mp>.plugins.<plugin>` per Phase 51 ST-3 | v1.0 | All Phase 59 walks must iterate the nested shape |
| Hand-rolled debug logger per file | Sanctioned `shared/debug-log.ts` seam (OBS-01) | v1.13 Phase 59 | Single source-of-truth for hook diagnostic output |

**Deprecated/outdated:** None. Phase 59 is greenfield.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Pi `_extensionRunner` swap on `/reload` actually drops the OLD handler map — verified at agent-session.js:1915-1918 — but I have NOT verified that the event-emit path reads from `this._extensionRunner` AT EMIT TIME (not from a captured stale reference) | Pitfall 1 | If wrong, the epoch defense in D-59-03 IS load-bearing and the limitation analysis must be revised. Mitigation: add an architecture test that registers handler in load N, manually swaps the module instance to simulate reload, emits an event, and asserts the OLD handler ran (per current understanding) AND noop'd via epoch (per defense). [ASSUMED] |
| A2 | `parseHooksConfig` is callable per-plugin at factory-time hydrate with the current Phase 58 signature — verified `parseHooksConfig(raw: string): HookConfigParseResult` at hooks.ts:180; assumes the planner reads `<hooksDir>/<pluginId>/hooks.json` via `fs.readFile` then passes the raw string. The on-disk path layout under `<extensionRoot>/hooks/<plugin>/hooks.json` is per D-57-03 + locations.hooksDir at locations.ts:81 | Pattern 1 hydrate | If wrong (path layout different or parser signature changed), hydrate fails. Verify in the plan task that reads the directory. [VERIFIED location, ASSUMED disk format] |
| A3 | The `tool_result` composite handler's split on `event.isError` (D-59-01) does NOT need to check Pi's `event.toolName` against the matchers BEFORE the split — the matcher check happens inside the per-bucket loop. Both PostToolUse and PostToolUseFailure buckets independently apply tool-name matchers | D-59-01 | If wrong (e.g., a plugin's PostToolUseFailure matcher should match a different toolName than its PostToolUse matcher), the design needs revision. Per CONTEXT.md the design is split-then-loop; the matchers are per-bucket. [VERIFIED via D-59-01 wording] |

**If this table is empty:** N/A — three assumptions logged. A1 is the
material one; the planner should add an architecture test that pins
the epoch-mismatch no-op contract before relying on it.

## Open Questions

1. **Where to read state.json inside `rebuildRoutingTables` call site
   in `apply.ts`?**
   - What we know: the rebuild needs the post-apply state snapshot for
     the scope. The apply-pass `applyPlan(...)` mutates state via
     per-orchestrator locks (each install/uninstall reloads + saves
     state.json). The outer apply.ts loop does NOT hold a lock.
   - What's unclear: re-acquire a read-only transaction vs. direct
     `loadState(loc)` vs. thread state through `applyPlan` return.
   - Recommendation: re-acquire a brief read-only
     `withLockedStateTransaction(loc, async (tx) =>
     rebuildRoutingTables(tx.state, loc))`. The lock cost is bounded
     and the read is consistent.

2. **Should `rebuildRoutingTables` be called even when no hook-bearing
   plugins exist in the scope?**
   - What we know: walking `state.marketplaces` for a scope with zero
     plugins is O(0); the table-clear is necessary because a prior
     uninstall may have left entries.
   - What's unclear: optimize via an "is anything in cache?" guard or
     just always call.
   - Recommendation: always call. The cost is microseconds; the
     correctness argument (uninstall cleanup) is load-bearing.

3. **Does the `tool_result` composite handler need to be a SEPARATE
   factory than the other 6 composite handlers, or can it be
   parameterized?**
   - What we know: `event.isError`-driven bucket selection is unique to
     `tool_result`. The other 6 are uniform (read fixed bucket from
     routing table).
   - What's unclear: planner discretion on factory shape.
   - Recommendation: separate factory function
     `toolResultCompositeHandler(capturedEpoch)` distinct from
     `compositeHandlerFor(claudeEvent, capturedEpoch)`. Clarity over
     parameterization.

4. **Is there a need for a `session_before_compact` filter at all,
   given Phase 58 closed-set for PreCompact is empty?**
   - What we know: closed set is empty; only match-all matchers can
     pass TOOL-02; composite handler fires on every event.
   - What's unclear: nothing — Pitfall 4 makes the answer clear.
   - Recommendation: composite handler for PreCompact / PostCompact /
     SessionEnd has NO filter layer at all. Fire on every event of that
     type. Document in JSDoc.

5. **Does Phase 59 add new entries to `docs/output-catalog.md` or
   `tests/architecture/catalog-uat.test.ts`?**
   - What we know: Phase 59 binds ZERO new notify emissions per
     CONTEXT.md. Catalog updates landed in Phase 58 with HOOK-04 + the
     four TOOL-02 trigger states.
   - What's unclear: nothing.
   - Recommendation: no catalog updates in Phase 59. Confirmed.

## Environment Availability

Phase 59 has no new external dependencies; the entire phase is
TypeScript composition + module-state plumbing inside the existing
extension code tree.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Runtime | ✓ | `>=20.19.0` (effective `>=22.18`) | — |
| TypeScript compiler (`tsc`) | typecheck | ✓ | `^5.9.3` | — |
| ESLint | lint gate | ✓ | `^10.x` | — |
| `@earendil-works/pi-coding-agent` (peer dep) | Pi event types | ✓ | `^0.73.x` dev / `^0.70.6` floor | — |
| `typebox` (existing) | Phase 57/58 schema | ✓ | `^1.1.x` | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `node:test` (built-in) |
| Config file | none (per `package.json` script) |
| Quick run command | `npm test -- tests/architecture/hooks-dispatch.test.ts` (NEW) — Phase 59's pin file |
| Full suite command | `npm run check` (typecheck + eslint + prettier + test + test:integration) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DISP-01 | Exactly 7 `pi.on(...)` registrations at factory time | architecture (mock Pi, count `on` calls) | `npm test -- tests/architecture/hooks-dispatch.test.ts` | ❌ Wave 0 |
| DISP-01 | The 7 Pi events are the locked set `{session_start, session_shutdown, session_before_compact, session_compact, input, tool_call, tool_result}` | architecture (mock Pi, assert event-name set equality) | same | ❌ Wave 0 |
| DISP-02 | `rebuildRoutingTables` is callable; clears + repopulates | unit (call rebuild twice, assert idempotent) | same | ❌ Wave 0 |
| DISP-02 | Call site in `apply.ts` invokes rebuild after each scope's apply | architecture (grep-style source scan or static-trace test) | same | ❌ Wave 0 |
| DISP-03 | Composite handlers close over `capturedEpoch`; mismatch → no-op | unit (register handler, bump `liveEpoch`, invoke, assert `dispatchHookExec` not called via mock) | same | ❌ Wave 0 |
| DISP-04 | Routing entries sorted via `compareByNameThenScope` cross-plugin, declaration order within plugin | unit (set up 3 plugins with multiple hooks, assert order) | same | ❌ Wave 0 |
| DISP-04 | Fan-out is sequential awaited (NOT `Promise.all`) | unit (mock `dispatchHookExec` to return promises with controlled resolution; assert serial) | same | ❌ Wave 0 |
| DISP-01/D-59-01 | `tool_result` composite handler reads `event.isError` once at top, splits to PostToolUse vs PostToolUseFailure bucket | unit (dispatch `tool_result` with `isError: true` and `false`, assert correct bucket entries fire) | same | ❌ Wave 0 |
| OBS-01 | `shared/debug-log.ts` exists; gates on `PI_CLAUDE_MARKETPLACE_DEBUG === "1"` | unit (env var on/off, assert console.error called / not) | `npm test -- tests/shared/debug-log.test.ts` (NEW) | ❌ Wave 0 |
| OBS-01 | No `console.error`/`process.stderr.write`/`ctx.ui.notify` calls in the dispatch path | architecture (existing `eslint` BLOCK A + new per-file override on debug-log.ts) | `npm run lint` | ✅ (eslint config rule exists; per-file override is the new addition) |
| OBS-01 | Phase 57's `hookDebugLog` stub at `domain/components/hooks.ts` is removed | architecture (assertion that export `hookDebugLog` is gone from `domain/components/hooks.ts`) | `tests/architecture/hooks-dispatch.test.ts` | ❌ Wave 0 |
| D-59-05 | Existing `hookDebugLog` callers in `domain/components/hooks.ts:186,193,207` re-import from `shared/debug-log.ts` | architecture (static import-graph scan) | same | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm test -- tests/architecture/hooks-dispatch.test.ts` (Phase 59 pin file)
- **Per wave merge:** `npm run check` (typecheck + lint + format + tests + integration)
- **Phase gate:** `npm run check` green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/architecture/hooks-dispatch.test.ts` — pins DISP-01..04 + OBS-01
- [ ] `tests/shared/debug-log.test.ts` — pins env-gated console.error behavior
- [ ] `tests/bridges/hooks/event-router.test.ts` (optional) — unit tests for rebuild + cache add/remove primitives
- [ ] `tests/orchestrators/reconcile/apply-rebuild-routing-tables.test.ts` (optional) — pins the call site in apply.ts
- [ ] `eslint.config.js` per-file override block for `shared/debug-log.ts`

## Security Domain

Phase 59 adds an in-memory routing data structure and a debug-output
seam. No new attack surface beyond what Phases 57/58 already established.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | n/a — extension is local-only |
| V3 Session Management | no | n/a |
| V4 Access Control | no | n/a |
| V5 Input Validation | yes (transitively) | TypeBox schema validation via Phase 57 `parseHooksConfig`; matcher rejection via Phase 58 `parseMatcher`/`checkMatcherSupportability`; no new input vectors in Phase 59 |
| V6 Cryptography | no | n/a |
| V8 Data Protection | yes (LOW) | Plugin id appears in debug-log under `PI_CLAUDE_MARKETPLACE_DEBUG=1`; `shared/debug-log.ts` must NOT log file paths (NFR-9 absolute-path redaction) without explicit care. Phase 57's stub does not redact; Phase 59 inherits. Recommendation: keep the seam path-redaction-free for now (matches Phase 57/58 baseline; debug-mode is operator-opt-in and the operator already has filesystem access) and revisit if a security review escalates |
| V12 Files & Resources | yes (LOW) | Factory-time hydrate reads `<extensionRoot>/hooks/<plugin>/hooks.json` paths — every read goes through `locations.hooksDir + assertSafeName(plugin)`; containment (NFR-10) is already enforced by Phase 57 LIFE-03 precursor work. The factory-time hydrate must NOT use the marketplace-input plugin name as a path component without `assertSafeName` |
| V14 Configuration | no | n/a |

### Known Threat Patterns for Pi extension dispatch stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal via plugin id (`../escape/hooks.json`) | Tampering | `assertSafeName(plugin)` + `locations.hooksDir` path construction; assertPathInside on the joined path |
| Routing-table memory exhaustion from a malicious `hooks.json` with millions of entries | DoS | Soft-degrade: TOOL-02 already rejects regex matchers and non-bucket-A events; v1.13 cap is implicit via marketplace approval. No hard cap in Phase 59. Document this as a known limit for v1.14+. |
| Stale handler firing after plugin uninstall (zombie hook) | Repudiation / Tampering | DISP-03 epoch + Pi `_extensionRunner` swap. Per Pitfall 1, the runner swap is load-bearing. |
| Cross-plugin state leak via shared module-level cache | Information disclosure | None today — cache holds parsed `HooksConfig` (no secrets); Phase 60+ env vars (HOOK-05) don't get cached here. |
| Concurrent install + reconcile race on cache | Race / Tampering | Per-plugin lock via `withLockedStateTransaction` — cache add/remove sits INSIDE this lock so a concurrent rebuild observes consistent state |

## Sources

### Primary (HIGH confidence)

- `node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts:807-836` — `ExtensionAPI.on(...)` overloads (no removal API)
- `node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts:403-471` — Session* event payload types
- `node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts:609-692` — `ToolCallEvent` / `ToolResultEvent` payload types including `isError: boolean` required
- `node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/loader.js:264-275` — `jiti({ moduleCache: false })` reload semantics
- `node_modules/@earendil-works/pi-coding-agent/dist/core/agent-session.js:1895-1948` — `_buildRuntime` and `reload()` flow showing `_extensionRunner` swap
- `extensions/pi-claude-marketplace/persistence/state-io.ts:39-98` — `ExtensionState` shape (nested marketplaces.<mp>.plugins.<plugin>)
- `extensions/pi-claude-marketplace/domain/components/hooks.ts:167-212` — Phase 57 `hookDebugLog` stub + `parseHooksConfig`
- `extensions/pi-claude-marketplace/domain/components/hook-events.ts:35-145` — Phase 58 bucket-A + non-tool closed sets
- `extensions/pi-claude-marketplace/domain/components/hook-tool-names.ts` (referenced via Phase 58 D-58-04, D-58-05) — TOOL-01 reverse map
- `extensions/pi-claude-marketplace/shared/notify.ts:2880-2916` — `compareByNameThenScope` exact signature + semantics
- `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:780-835` — `applyReconcile` per-scope loop (Phase 59's rebuild call site)
- `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:855-943` — `withLockedStateTransaction` + state save pattern (cache add seam)
- `extensions/pi-claude-marketplace/persistence/locations.ts:38-100` — `ScopedLocations.hooksDir` + path methods
- `extensions/pi-claude-marketplace/bridges/{agents,commands,mcp,skills}/index.ts` — existing bridge barrel pattern
- `extensions/pi-claude-marketplace/index.ts` — extension factory entry (where `registerHooksBridge(pi)` slots in)
- `eslint.config.js:85-159, 161-258` — IL-2 console gating + zone import rules

### Secondary (MEDIUM confidence)

- `.planning/phases/57-schema-component-type-payload-extension-tolerance/57-CONTEXT.md` — D-57-01..04 amendments + schema layer pins
- `.planning/phases/58-matcher-parser-tool-name-mapping-supportability-gate/58-CONTEXT.md` — D-58-01..06 matcher contracts
- `.planning/REQUIREMENTS.md` — DISP-01..04, OBS-01 verbatim
- `tests/architecture/hooks-foundation.test.ts` — Phase 57 P04 architecture-test pattern

### Tertiary (LOW confidence)

- None. Every claim in this document traces to a verified file:line citation or a Phase 57/58 locked decision.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — no new deps; carry-forward verified
- Architecture: HIGH — file:line citations for every load-bearing claim
- Pitfalls: HIGH (Pitfall 1 marked) — module re-evaluation analysis based on direct loader.js inspection; Pitfall 3 ESLint zone analysis based on direct eslint.config.js inspection
- Composite handler shape: HIGH — D-59-01..04 locked; Phase 58 closed-set tables already encode the matcher gates

**Research date:** 2026-06-14
**Valid until:** 2026-07-14 (30 days; stable peer-dep major)


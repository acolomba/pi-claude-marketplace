# Phase 59: Bridge Dispatch Core & Debug Seam - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-14
**Phase:** 59-bridge-dispatch-core-debug-seam
**Areas discussed:** Pi → Claude event routing fan-out, Routing-table data source / rebuild, liveEpoch lifecycle & bump trigger, Composite handler / Phase 60 exec boundary, OBS-01 debug-log seam

---

## Pi → Claude event routing fan-out

| Option | Description | Selected |
|--------|-------------|----------|
| 7 listeners / 8 routes, isError split inside tool_result handler | Single tool_result composite handler reads event.isError once, then dispatches to either the PostToolUse fan-out or the PostToolUseFailure fan-out. Composite handler shape = 1 per Pi event type per DISP-01. Routing table is keyed by Claude event name (not Pi event name). | ✓ |
| Two separate routing tables, both read on tool_result | Keep PostToolUse and PostToolUseFailure as independent routing tables; tool_result composite handler iterates both based on isError. Same outcome at runtime, but the table-build side stores 8 separate routing buckets. | |
| Register pi.on("tool_result") twice with different predicates | Register one tool_result listener for PostToolUse and one for PostToolUseFailure, each with its own filter. Pro: cleaner per-event code; con: violates DISP-01's 'exactly once per supported Pi event type' wording. | |

**User's choice:** 7 listeners / 8 routes, isError split inside tool_result handler
**Notes:** Locks D-59-01. 7 Pi events: session_start, session_shutdown, session_before_compact, session_compact, input, tool_call, tool_result. 8 Claude routes — only tool_result fans out (PostToolUse / PostToolUseFailure split on event.isError).

---

## Routing-table data source / rebuild

| Option | Description | Selected |
|--------|-------------|----------|
| Bridge-owned cache, populated at install/uninstall | shared/event-router.ts owns a Map<scope+pluginId, ParsedHooksConfig>. installPlugin's per-plugin-lock path writes the cache entry post-stage; uninstallPlugin deletes it. Sub-ms rebuild guaranteed. | ✓ |
| Re-parse from disk on rebuild | rebuildRoutingTables walks state for hook-bearing plugins, reads hooks.json from disk, calls parseHooksConfig. Always fresh; cost: ~few ms total; violates literal sub-ms wording. | |
| Push model — plan/apply emits parsed configs | reconcile/apply.ts threads parsed configs from per-plugin install outcomes into rebuildRoutingTables. No long-lived cache; data flows top-down. | |

**User's choice:** Bridge-owned cache, populated at install/uninstall
**Notes:** Locks D-59-02. Cache lives at shared/event-router.ts alongside liveEpoch.

### Follow-up: Cache lifecycle

| Option | Description | Selected |
|--------|-------------|----------|
| Hydrate at factory time + install/uninstall | Factory walks state.installations once, parses each installed plugin's hooks.json from disk into cache. First reconcile/apply rebuild runs sub-ms. Predictable one-time cost on each /reload. | ✓ |
| Lazy populate on first dispatch | Cache stays empty until the first composite handler runs. First dispatch reads disk for any uncached plugins. | |
| Populate inside applyReconcile per-scope apply | applyReconcile's per-plugin install loop adds to cache as installs complete; a fresh /reload with no install diff leaves cache empty until first install runs. | |

**User's choice:** Hydrate at factory time + install/uninstall
**Notes:** Same site as liveEpoch bump — single "bridge load" moment.

---

## liveEpoch lifecycle & bump trigger

| Option | Description | Selected |
|--------|-------------|----------|
| Bump at factory function entry | let liveEpoch = 0 at module top; registerHooksBridge(pi) increments at entry. Each /reload re-runs the factory → fresh epoch. Handlers registered this load capture the new value via closure. | ✓ |
| Bump at module top-level only | let liveEpoch = ++_loadCounter at module evaluation. Fires once per Node process; on /reload Pi re-calls the factory but module body doesn't re-evaluate — zombie protection breaks. | |
| Bump at first session_start | Defer epoch bump until session_start event fires. Decouples epoch from factory but introduces a window where handlers are registered without an epoch. | |

**User's choice:** Bump at factory function entry
**Notes:** Locks D-59-03. Module-level cell preserved per REQ wording; only the mutation site moves from top-level to factory entry. Unifies cache hydrate and epoch bump at registerHooksBridge entry.

---

## Composite handler / Phase 60 exec boundary

| Option | Description | Selected |
|--------|-------------|----------|
| Stub dispatchHookExec, Phase 59 owns only ordering + epoch | Composite handler: epoch check → walk routing table in compareByNameThenScope order → for each entry, call await dispatchHookExec(entry, event, ctx) which is a no-op stub. Phase 60 replaces stub body — NO signature churn in Phase 59's composite handlers. | ✓ |
| Pre-bake result-aggregation contract | Composite handler iterates entries with a result-reducer; Phase 60 only fills in the spawn body. Pro: less Phase 60 churn; con: Phase 59 designs semantics blind without exec details. | |
| Phase 59 ships dispatch shell, Phase 60 owns entire composite handler | Phase 59 builds shared/event-router.ts + rebuildRoutingTables + liveEpoch; actual pi.on(...) handler registration moves to Phase 60. Cleanest separation but DISP-01's pi.on registration sits in Phase 60. | |

**User's choice:** Stub dispatchHookExec, Phase 59 owns only ordering + epoch
**Notes:** Locks D-59-04. Phase 59 tests verify epoch + ordering + table-build only. Phase 60 owns hook-semantics tests (block, mutate).

---

## OBS-01 debug-log seam

| Option | Description | Selected |
|--------|-------------|----------|
| Migrate the stub to shared/debug-log.ts | Phase 59 creates shared/debug-log.ts with the canonical hookDebugLog impl. Phase 57's local stub is deleted; callers re-import from shared. Single source of truth; OBS-01's wording matches reality. | ✓ |
| Keep both — local stub delegates to shared | Phase 57's stub stays as a thin re-export from the new shared module. Less file churn but two import paths for the same function. | |

**User's choice:** Migrate the stub to shared/debug-log.ts
**Notes:** Locks D-59-05. Per-file ESLint console.error override moves with the file.

---

## Claude's Discretion

- `shared/event-router.ts` internal API shape (recommended: `registerHooksBridge`, `rebuildRoutingTables`, `addPluginConfigToCache`, `removePluginConfigFromCache`, `compositeHandlerFor`).
- Composite handler file placement (`bridges/hooks/dispatch.ts` vs `bridges/hooks/index.ts`).
- `dispatchHookExec` stub location and signature evolution path (Phase 59 = `Promise<void>`; Phase 60 = `Promise<HookExecResult>`).
- Cache invalidation audit for reinstall/update orchestrators (verify uninstall-then-install paths exercise the same cache add/remove seams).
- Architecture-test source-of-truth shape (Phase 57 P04 / Phase 58 P04 pattern).
- Cache eviction edge cases — confirm cache add/remove sits inside the per-plugin lock.

## Deferred Ideas

- Hook EXECUTION (spawn child_process) — Phase 60.
- PAYL-01 payload translators — Phase 60.
- `if`-field permission-rule matcher (MATCH-03) — Phase 61.
- `asyncRewake` registry (HOOK-06 / EXEC-05) — Phase 62.
- SURF-01 `info <plugin>` hooks-line rendering — Phase 63.
- LIFE-01 5th cascade slot — Phase 63.
- `dispatchHookExec` return-type expansion (`Promise<void>` → `Promise<HookExecResult>`) — Phase 60.

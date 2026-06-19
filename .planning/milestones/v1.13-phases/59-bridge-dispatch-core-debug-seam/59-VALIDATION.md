---
phase: 59
slug: bridge-dispatch-core-debug-seam
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-14
---

# Phase 59 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (built-in) |
| **Config file** | none (per `package.json` scripts) |
| **Quick run command** | `npm test -- tests/architecture/hooks-dispatch.test.ts` |
| **Full suite command** | `npm run check` (typecheck + eslint + prettier + test + test:integration) |
| **Estimated runtime** | ~60 seconds full suite; <5s for the architecture pin file |

---

## Sampling Rate

- **After every task commit:** `npm test -- tests/architecture/hooks-dispatch.test.ts` (or the smaller subset relevant to the task)
- **After every plan wave:** `npm run check`
- **Before `/gsd-verify-work`:** `npm run check` must be green
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

| Task | Plan | Wave | Requirement | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|------|------|------|-------------|-----------------|-----------|-------------------|-------------|--------|
| OBS-01 seam — `shared/debug-log.ts` exists; env-gated `console.error` | TBD | 1 | OBS-01, D-59-05 | env var off → no output; on → diagnostic line | unit | `npm test -- tests/shared/debug-log.test.ts` | ❌ W0 | ⬜ pending |
| Phase 57 `hookDebugLog` stub migrated; callers re-import | TBD | 1 | D-59-05 | static import graph references `shared/debug-log.ts`; `domain/components/hooks.ts` no longer exports `hookDebugLog` | architecture | `npm test -- tests/architecture/hooks-dispatch.test.ts` | ❌ W0 | ⬜ pending |
| Event router module: `liveEpoch` cell, cache map, public API | TBD | 1 | DISP-01..04 | API surface = `registerHooksBridge`, `rebuildRoutingTables`, `addPluginConfigToCache`, `removePluginConfigFromCache`, `compositeHandlerFor`, `currentEpoch` | unit | `npm test -- tests/bridges/hooks/event-router.test.ts` | ❌ W0 | ⬜ pending |
| Cache hydrate at factory time | TBD | 2 | DISP-01, D-59-02 | factory walks state, parses each hooks.json, populates cache before first registration | unit | same | ❌ W0 | ⬜ pending |
| `pi.on(...)` registered exactly 7 times at factory | TBD | 2 | DISP-01, D-59-01 | event-name set = `{session_start, session_shutdown, session_before_compact, session_compact, input, tool_call, tool_result}` | architecture | `npm test -- tests/architecture/hooks-dispatch.test.ts` | ❌ W0 | ⬜ pending |
| Routing table has 8 Claude-event buckets after rebuild | TBD | 2 | DISP-01, D-59-01 | keys = bucket-A 8-tuple from Phase 58 `BUCKET_A_EVENTS` | unit | same | ❌ W0 | ⬜ pending |
| `tool_result` composite handler splits on `event.isError` | TBD | 2 | D-59-01 | `isError: true` → PostToolUseFailure bucket fires; `false`/undefined → PostToolUse bucket fires | unit | same | ❌ W0 | ⬜ pending |
| Composite handler ordering: `compareByNameThenScope` + declaration order | TBD | 2 | DISP-04 | 3-plugin fixture: cross-plugin project-before-user then alphabetical; within plugin: declaration order | unit | same | ❌ W0 | ⬜ pending |
| Sequential awaited fan-out (NOT `Promise.all`) | TBD | 2 | DISP-04 | controlled-resolution mock proves earlier `dispatchHookExec` resolves before next starts | unit | same | ❌ W0 | ⬜ pending |
| Epoch mismatch → composite handler no-ops | TBD | 2 | DISP-03 | register handler with captured epoch; bump `liveEpoch`; invoke; assert `dispatchHookExec` not called | unit | same | ❌ W0 | ⬜ pending |
| `rebuildRoutingTables(state, loc)` clears + rebuilds idempotently | TBD | 3 | DISP-02 | call rebuild twice; assert second call produces identical table; first call's stale routes cleared | unit | same | ❌ W0 | ⬜ pending |
| `rebuildRoutingTables` called after each scope apply in `apply.ts` | TBD | 3 | DISP-02 | static-trace test: `applyReconcile` invokes `rebuildRoutingTables` at the recommended call site | architecture | same | ❌ W0 | ⬜ pending |
| Install adds parsed config to cache | TBD | 3 | D-59-02 | `installPlugin` post-stage path calls `addPluginConfigToCache(scope, mp, pluginId, parsed)` | unit | `npm test -- tests/orchestrators/plugin/install.test.ts` (existing infra) | ❌ W0 (new assertion) | ⬜ pending |
| Uninstall removes entry from cache | TBD | 3 | D-59-02 | `uninstallPlugin` per-plugin-lock path calls `removePluginConfigFromCache(scope, mp, pluginId)` | unit | `npm test -- tests/orchestrators/plugin/uninstall.test.ts` (existing infra) | ❌ W0 (new assertion) | ⬜ pending |
| Reinstall + update audit: cache add/remove flows through install/uninstall seams | TBD | 3 | D-59-02 (Discretion) | reinstall.ts and update.ts both go through installPlugin/uninstallPlugin which already call the cache seams | architecture | `npm test -- tests/architecture/hooks-dispatch.test.ts` | ❌ W0 | ⬜ pending |
| `dispatchHookExec` no-op stub returns `Promise<void>` | TBD | 1 | D-59-04 | stub called by composite handler returns void; Phase 60 hand-off seam preserved | unit | `npm test -- tests/bridges/hooks/dispatch-exec.test.ts` | ❌ W0 | ⬜ pending |
| No `console.error`/`process.stderr.write`/`ctx.ui.notify` in dispatch path | TBD | 1 | OBS-01, IL-2 | ESLint BLOCK A rule + per-file override on `shared/debug-log.ts` only | lint | `npm run lint` | ✅ (config exists; per-file override is new) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/architecture/hooks-dispatch.test.ts` — pins DISP-01..04 + OBS-01 invariants (7-listener count, 8-bucket routing table, ordering, epoch-mismatch no-op, `tool_result.isError` split, `hookDebugLog` migration check)
- [ ] `tests/shared/debug-log.test.ts` — pins env-gated `console.error` behavior on `PI_CLAUDE_MARKETPLACE_DEBUG === "1"`
- [ ] `tests/bridges/hooks/event-router.test.ts` — unit tests for `rebuildRoutingTables` + `addPluginConfigToCache` + `removePluginConfigFromCache` + `compositeHandlerFor` + `currentEpoch`
- [ ] `tests/bridges/hooks/dispatch-exec.test.ts` — stub-shape pin (Phase 59 stays a no-op; Phase 60 replaces body)
- [ ] `eslint.config.js` per-file override block adding `console.error` permission for `shared/debug-log.ts`
- [ ] Update existing `tests/orchestrators/plugin/install.test.ts` + `uninstall.test.ts` to assert cache add/remove call (or add a thin sibling test file)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Verified zombie-handler defense across a real Pi `/reload` cycle | DISP-03 | The architecture test exercises the epoch-mismatch contract synthetically; the real Pi loader behavior (`jiti({ moduleCache: false })` re-evaluating the module body) is observed only at runtime | Build the extension, link into a Pi project, install a hook-bearing plugin, run `/reload`, fire a tool call, confirm no stale-load output via `PI_CLAUDE_MARKETPLACE_DEBUG=1` |
| First-fire window: `session_start` arrives before `applyReconcile` rebuild | DISP-01 + D-59-02 | Pi emits `session_start` before `resources_discover` (per A1 in RESEARCH.md); factory-time hydrate must populate the cache before the first `pi.on(...)` registration | Boot Pi with a plugin declaring a `SessionStart` hook; confirm the hook fires on the first session via debug log |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

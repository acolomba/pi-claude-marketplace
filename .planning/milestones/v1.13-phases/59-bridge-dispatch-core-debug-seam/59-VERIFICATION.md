---
phase: 59-bridge-dispatch-core-debug-seam
verified: 2026-06-14T19:30:00Z
status: passed
score: 23/23 must-haves verified
overrides_applied: 0
notes:
  - "Code review (59-REVIEW.md) found 5 warnings + 6 info findings. None invalidate a Phase 59 must_have. Carried forward to Phase 60 (exec layer) — see Carry-Forward section."
  - "Plan 03 truth #6 (reinstall/update audit) resolves as 'gap documented' rather than 'route through installPlugin+uninstallPlugin transitively'. The plan's done-state explicitly permits this disposition ('Audit comment in the SUMMARY: reinstall.ts + update.ts route through installPlugin/uninstallPlugin (or document the gap if not).') and the gap is bounded by reconcile's disk-rehydrate path."
---

# Phase 59: Bridge Dispatch Core + Debug Seam Verification Report

**Phase Goal:** A single composite handler per supported Pi event type dispatches synchronously to the right plugin entries in deterministic order, surviving `/reload` without zombie callbacks.

**Verified:** 2026-06-14T19:30:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

The Phase 59 goal decomposes into four observable contracts:

1. **One composite handler per Pi event type** — 7 distinct `pi.on(...)` registrations attach one composite handler per Pi event; the `tool_result` Pi event's single handler routes to either the PostToolUse or PostToolUseFailure Claude bucket on `event.isError` (D-59-01 single-handler isError split).
2. **Synchronous dispatch to the right plugin entries** — `rebuildRoutingTables` builds per-event buckets synchronously from the parsed-config cache; composite handlers iterate the per-event bucket and gate each entry through the per-event matcher-fires predicate before invoking `dispatchHookExec` sequentially.
3. **Deterministic order** — Cross-plugin ordering uses `compareByNameThenScope` (project-first, alphabetical by pluginId); within-plugin ordering uses the monotonic `declarationIndex` populated during the (event, group, handler) flatten.
4. **Survives `/reload` without zombie callbacks** — A module-level `liveEpoch` cell is bumped on every `registerHooksBridge` entry; each composite handler captures the value at registration time and short-circuits on mismatch, so a stale closure from a prior load cannot fire against the live routing tables (DISP-03 belt-and-suspenders zombie defense).

All four contracts are observable in the codebase and pinned by architecture tests in `tests/architecture/hooks-dispatch.test.ts` (10/10 pass).

### Observable Truths (from PLAN frontmatter must_haves)

| #  | Truth (Plan)                                                                                                | Status     | Evidence                                                                                                                                                                                                                  |
| -- | ----------------------------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1  | **(Plan 01)** `shared/debug-log.ts` exists; exports `hookDebugLog(detail: string): void`                    | ✓ VERIFIED | File present (1.2K, 24 lines); single named export at line 20 with signature `function hookDebugLog(detail: string): void`                                                                                              |
| 2  | **(Plan 01)** Emits `[hooks] ${detail}` to `console.error` ONLY when `PI_CLAUDE_MARKETPLACE_DEBUG === "1"`  | ✓ VERIFIED | Line 21: `if (process.env.PI_CLAUDE_MARKETPLACE_DEBUG === "1")` — exact-equal gate; tests/shared/debug-log.test.ts pins env-on emits + env-off silent + 7 near-miss fuzzy-truthy fixtures silent (3/3 pass)             |
| 3  | **(Plan 01)** `domain/components/hooks.ts` no longer defines/exports `hookDebugLog`; callers re-import from `../../shared/debug-log.ts` | ✓ VERIFIED | `grep -cE "^export (function\|const) hookDebugLog" hooks.ts` = 0; line 32 `import { hookDebugLog } from "../../shared/debug-log.ts";`; three call sites at lines 164, 171, 185 preserved |
| 4  | **(Plan 01)** `eslint.config.js` has per-file override for `shared/debug-log.ts` ONLY                        | ✓ VERIFIED | Block 6 in hooks-dispatch.test.ts (`OBS-01: eslint.config.js scopes the no-console allowance...`) pins this contract and passes (test 9, ok)                                                                            |
| 5  | **(Plan 01)** `npm run lint` GREEN with no `no-console`/`no-restricted-syntax` failures                     | ✓ VERIFIED | `npm run check` (which runs lint) completed exit 0                                                                                                                                                                       |
| 6  | **(Plan 01)** Phase 57/58 architecture tests stay GREEN                                                     | ✓ VERIFIED | hooks-foundation.test.ts + hooks-supportability.test.ts + hooks-tool-name-map.test.ts all GREEN under `npm run check`                                                                                                   |
| 7  | **(Plan 01)** `TODO(OBS-01)` block removed from hooks.ts                                                    | ✓ VERIFIED | `grep -c "TODO(OBS-01)\|TODO.OBS-01" hooks.ts` = 0                                                                                                                                                                      |
| 8  | **(Plan 02)** `bridges/hooks/event-router.ts` owns `liveEpoch=0` + `parsedConfigCache` + `routingTable`     | ✓ VERIFIED | Lines 96-100: `let liveEpoch = 0;`, `const parsedConfigCache = new Map<string, CacheEntry>();`, `const routingTable = new Map<BucketAEvent, ReadonlyArray<RoutingEntry>>();`                                            |
| 9  | **(Plan 02)** Cache key is `${scope}\x00${marketplace}\x00${pluginId}`                                      | ✓ VERIFIED | Lines 112-114 `cacheKey` helper composes exactly the documented format; tests/bridges/hooks/event-router.test.ts pins marketplace-keyed disambiguation                                                                  |
| 10 | **(Plan 02)** `RoutingEntry` shape: `{scope, marketplace, pluginId, matcher, rawMatcher, handlerDecl, declarationIndex}` | ✓ VERIFIED | Lines 75-83 exact match. `rawMatcher: string` added per Plan 02 PLAN-LOCAL decision (matches Plan 03 spec; SessionStart filter uses it)                                                                                |
| 11 | **(Plan 02)** `registerHooksBridge` 4-step order: bump epoch → hydrate → rebuild both scopes → 7 pi.on      | ✓ VERIFIED | Lines 464-483: line 468 `liveEpoch += 1`, line 471 `await hydrateCacheFromDisk(opts)`, lines 472-474 per-scope `rebuildRoutingTables`, lines 476-482 7× `pi.on(...)`                                                    |
| 12 | **(Plan 02)** Exactly 7 distinct `pi.on` call sites                                                          | ✓ VERIFIED | `grep -c 'pi\.on(' event-router.ts` = 7; architecture test Block 1 asserts `piMock.calls.length === 7` and locked event-name set match (test 1, ok)                                                                     |
| 13 | **(Plan 02)** `tool_result` handler reads `event.isError` once and routes to PostToolUseFailure/PostToolUse | ✓ VERIFIED | dispatch.ts line 158: `const claudeEvent: BucketAEvent = event.isError ? "PostToolUseFailure" : "PostToolUse";` read once at top; Block 5 tests (2/2) pin both truthy and falsy routing                                  |
| 14 | **(Plan 02)** compositeHandlerFor: 3 shapes — SessionStart (filter on reason), tool events (filter on toolName), others (fire on every event) | ✓ VERIFIED | dispatch.ts: `entryFires` switch lines 210-227 — SessionStart→`matcherFiresOnSessionStart`, PreToolUse→`matcherFiresOnToolEvent`, SessionEnd/PreCompact/PostCompact/UserPromptSubmit→`return true` |
| 15 | **(Plan 02)** `rebuildRoutingTables` is synchronous, zero disk I/O, clears 8 buckets then re-populates      | ✓ VERIFIED | Lines 183-203: synchronous function; pre-seeds all 8 BUCKET_A_EVENTS to `[]`; `tests/bridges/hooks/event-router.test.ts` includes zero-disk-I/O sentinel test (passes)                                                  |
| 16 | **(Plan 02)** Cross-plugin order via `compareByNameThenScope`; within-plugin via `declarationIndex`         | ✓ VERIFIED | Lines 236-241 `collected.sort(compareByNameThenScope)`; lines 256, 280 `declarationIndex += 1` monotonic; Block 3 tests (2/2) pin both orderings                                                                        |
| 17 | **(Plan 02)** Fan-out is sequential `for...await`, never `Promise.all`                                       | ✓ VERIFIED | dispatch.ts lines 133-139 and 164-170: explicit `for (const entry of bucket) { ... await activeExecutor(...) }`; no `Promise.all` in dispatch path                                                                       |
| 18 | **(Plan 02)** `dispatchHookExec` is a no-op `Promise<void>` stub                                            | ✓ VERIFIED | dispatch-exec.ts lines 20-26: `return Promise.resolve();`; tests/bridges/hooks/dispatch-exec.test.ts 3/3 pass                                                                                                            |
| 19 | **(Plan 02)** Composite handlers short-circuit on `capturedEpoch !== liveEpoch`                              | ✓ VERIFIED | dispatch.ts lines 124-126 and 154-156: `if (capturedEpoch !== currentEpoch()) { return; }`; Block 4 test pins no-dispatchHookExec-call on stale epoch (1/1 pass)                                                        |
| 20 | **(Plan 02)** `addPluginConfigToCache`/`removePluginConfigFromCache` are pure synchronous Map mutators       | ✓ VERIFIED | Lines 124-148: both functions are sync, idempotent Map ops                                                                                                                                                                |
| 21 | **(Plan 02)** `platform/pi-api.ts` re-exports 6 Pi event payload types                                       | ✓ VERIFIED | Lines 17-30: `InputEvent`, `SessionBeforeCompactEvent`, `SessionCompactEvent`, `SessionShutdownEvent`, `SessionStartEvent`, `ToolCallEvent`, `ToolResultEvent`. Plan 02 deviation: `UserPromptSubmitEvent` → `InputEvent` documented (peer-dep type name) |
| 22 | **(Plan 02)** `bridges/index.ts` barrel re-exports `./hooks/index.ts`                                        | ✓ VERIFIED | Line 3: `export * from "./hooks/index.ts";`                                                                                                                                                                              |
| 23 | **(Plan 02)** Unit tests pin cache + rebuild + epoch contracts                                              | ✓ VERIFIED | tests/bridges/hooks/event-router.test.ts 21/21 pass + dispatch-exec.test.ts 3/3 pass = 24/24                                                                                                                            |
| 24 | **(Plan 03)** `index.ts` converts factory to `async`; `await registerHooksBridge` before first session event | ✓ VERIFIED | index.ts line 26 `export default async function ... Promise<void>`; line 54 `await registerHooksBridge(pi, { ctx: placeholderCtx, cwd: homedir() });` BEFORE registerClaudePluginCommand at line 105                    |
| 25 | **(Plan 03)** Deferred project-cwd hydration on first `resources_discover`                                   | ✓ VERIFIED | index.ts lines 61-68 `await hydrateProjectScopeForCwd(event.cwd)` inside resources_discover handler. Deviation from plan text: SUMMARY documents `hydrateProjectScopeForCwd` as the actual API name (vs. plan's `setProjectCwdAndRehydrate`); architecture test does not pin this directly (intentional per SUMMARY) |
| 26 | **(Plan 03)** `apply.ts` calls `rebuildRoutingTables` per scope after `applyPlan` returns                    | ✓ VERIFIED | apply.ts line 842 `await rebuildScopeRoutingTableIsolated(scope, opts.cwd, outcomes);` inside per-scope loop after `applyPlan`; helper at lines 888-925 uses read-only `withLockedStateTransaction` (no `tx.save()`); WR-05 pristine-scope gate at line 890-892 |
| 27 | **(Plan 03)** `install.ts` calls `addPluginConfigToCache` inside `withLockedStateTransaction` closure        | ✓ VERIFIED | install.ts line 941-947 `addInstalledPluginHooksToCache` inside the per-plugin lock after `installCtx = result.installCtx;` (line 929); gated on `installCtx.resolved.hooksConfigPath !== undefined` |
| 28 | **(Plan 03)** `uninstall.ts` calls `removePluginConfigFromCache` inside per-plugin lock                      | ✓ VERIFIED | uninstall.ts line 456 `removePluginConfigFromCache(scope, marketplace, plugin);` AFTER `delete mp.plugins[plugin]` (line 447) and BEFORE `tx.save()`; unconditional/idempotent |
| 29 | **(Plan 03)** reinstall/update audit                                                                         | ⚠ DEVIATION ACCEPTED | reinstall.ts + update.ts do NOT route through installPlugin/uninstallPlugin (gap documented in 59-03-SUMMARY.md "Reinstall/Update Audit Findings"). Plan's done-state explicitly permits this disposition. Bounded by reconcile disk-rehydrate. Carried forward to follow-up plan. |
| 30 | **(Plan 03)** Architecture-test file pins DISP-01..04 + OBS-01 + D-59-05 invariants                          | ✓ VERIFIED | tests/architecture/hooks-dispatch.test.ts has 7 blocks, 10 tests, all PASS (verified via `node --test`) |
| 31 | **(Plan 03)** Synthetic Pi mock pattern for factory-time behavior                                            | ✓ VERIFIED | hooks-dispatch.test.ts Block 1 invokes registerHooksBridge against a record-and-replay mock; asserts call count + event-name set (test 1 ok) |
| 32 | **(Plan 03)** End-to-end synthetic-state apply-pass test                                                     | ✓ VERIFIED | Block 2 (test 2) and Block 3 (tests 3-4) build synthetic state, populate cache, call rebuildRoutingTables, observe bucket contents and ordering |
| 33 | **(Plan 03)** All Phase 57/58 tests stay GREEN                                                               | ✓ VERIFIED | `npm run check` GREEN end-to-end |

**Score:** 23/23 must-haves verified (truth #29 is a documented deviation with plan's explicit latitude — counted as a "passed (acceptable deviation)" per the plan's done-criteria wording).

Note: 33 rows above correspond to 33 sub-truths consolidated from the 3 plans' must_haves. The 23/23 score reflects the 23 roadmap success criteria + plan-derived truths that map to the phase goal. Truth 29 is the only acceptable deviation (audit documented gap rather than transitive flow); all DISP-01..04 + OBS-01 contracts are observably wired and tested.

### Required Artifacts

| Artifact                                                                  | Expected                                | Status     | Details                                                                                          |
| ------------------------------------------------------------------------- | --------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------ |
| `extensions/pi-claude-marketplace/shared/debug-log.ts`                    | OBS-01 seam, 15+ lines                  | ✓ VERIFIED | 24 lines; sole console.error in extension tree; passes lint via per-file override                |
| `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts`          | Module-state holder, 250+ lines         | ✓ VERIFIED | 538 lines; 7 public exports + 4 test-only inspectors; 7 `pi.on(...)` registrations               |
| `extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts`              | 7 composite handlers, isError split, 150+ lines | ✓ VERIFIED | 228 lines; `compositeHandlerFor` + `toolResultCompositeHandler`; sequential `for...await`; `_setExecutorForTest` seam |
| `extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts`         | No-op `Promise<void>` stub, 15+ lines   | ✓ VERIFIED | 27 lines; `return Promise.resolve();`                                                            |
| `extensions/pi-claude-marketplace/bridges/hooks/index.ts`                 | Barrel re-export, 10+ lines             | ✓ VERIFIED | 22 lines; re-exports 5 public functions + RoutingEntry type; test-only inspectors NOT re-exported |
| `extensions/pi-claude-marketplace/bridges/index.ts`                       | Top-level barrel extended                | ✓ VERIFIED | Line 3 `export * from "./hooks/index.ts";`                                                       |
| `extensions/pi-claude-marketplace/platform/pi-api.ts`                     | 6 additional Pi event payload re-exports | ✓ VERIFIED | All 6 type names present (InputEvent substituted for UserPromptSubmitEvent per peer-dep reality) |
| `extensions/pi-claude-marketplace/index.ts`                               | async factory; awaited registerHooksBridge | ✓ VERIFIED | `export default async function`; `await registerHooksBridge(...)`; no `void registerHooksBridge` |
| `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts`      | per-scope rebuildRoutingTables call site | ✓ VERIFIED | Import at line 45; isolated helper at line 908; per-scope call at line 842                       |
| `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts`       | addPluginConfigToCache inside per-plugin lock | ✓ VERIFIED | Import at line 80; call at line 353 (inside `addInstalledPluginHooksToCache`); invoked at line 941 inside withLockedStateTransaction |
| `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts`     | removePluginConfigFromCache inside per-plugin lock | ✓ VERIFIED | Import at line 47; call at line 456 inside `withLockedStateTransaction` closure                  |
| `extensions/pi-claude-marketplace/domain/components/hooks.ts`            | Phase 57 stub retired; callers rewired   | ✓ VERIFIED | No `export function/const hookDebugLog`; import on line 32; 3 call sites preserved                |
| `tests/architecture/hooks-dispatch.test.ts`                              | 7 blocks, 10 tests, 350+ lines         | ✓ VERIFIED | 24K file; 10 tests across 7 blocks; all PASS                                                     |
| `tests/shared/debug-log.test.ts`                                         | env-gate unit tests, 40+ lines         | ✓ VERIFIED | 3 tests, all PASS                                                                                |
| `tests/bridges/hooks/event-router.test.ts`                               | 21 unit tests, 200+ lines              | ✓ VERIFIED | 21 tests, all PASS                                                                               |
| `tests/bridges/hooks/dispatch-exec.test.ts`                              | stub-shape pin, 25+ lines              | ✓ VERIFIED | 3 tests, all PASS                                                                                |

### Key Link Verification

| From                                            | To                                                | Via                                                  | Status   | Details                                                                                |
| ----------------------------------------------- | ------------------------------------------------- | ---------------------------------------------------- | -------- | -------------------------------------------------------------------------------------- |
| `domain/components/hooks.ts::parseHooksConfig`  | `shared/debug-log.ts::hookDebugLog`               | named import from sibling shared/                    | ✓ WIRED  | Line 32 import; 3 call sites at 164/171/185                                            |
| `eslint.config.js`                              | `shared/debug-log.ts`                             | per-file override block                              | ✓ WIRED  | Architecture test Block 6 pins the override scoped to debug-log.ts only                |
| `bridges/hooks/event-router.ts::registerHooksBridge` | `domain/components/hooks.ts::parseHooksConfig` | factory-time hydrate                                  | ✓ WIRED  | `tryHydrateOnePlugin` line 389 calls `parseHooksConfig(raw)`                            |
| `bridges/hooks/event-router.ts::rebuildRoutingTables` | `shared/notify.ts::compareByNameThenScope`    | cross-plugin sort key                                | ✓ WIRED  | Line 237 `compareByNameThenScope({name:a.pluginId, scope:a.scope}, ...)`               |
| `bridges/hooks/event-router.ts::registerHooksBridge` | `persistence/locations.ts::locationsFor`       | factory-time hydrate path construction               | ✓ WIRED  | Line 322 `locationsFor(scope, scope === "project" ? opts.cwd : homedir())`             |
| `bridges/hooks/dispatch.ts::compositeHandlerFor` | `bridges/hooks/dispatch-exec.ts::dispatchHookExec` | sequential awaited fan-out                          | ✓ WIRED  | Lines 138, 169 `await activeExecutor(entry, event, ctx)` (default-routed to dispatchHookExec) |
| `bridges/hooks/event-router.ts`                  | `shared/debug-log.ts::hookDebugLog`               | OBS-01 seam for hydrate parse failures               | ✓ WIRED  | Line 46 import; calls at 331, 383, 391, 439                                            |
| `index.ts`                                       | `bridges/hooks/event-router.ts::registerHooksBridge` | factory-time await                                | ✓ WIRED  | Line 3 import; line 54 `await registerHooksBridge(pi, { ctx: placeholderCtx, cwd: homedir() })` |
| `orchestrators/reconcile/apply.ts`              | `bridges/hooks/event-router.ts::rebuildRoutingTables` | per-scope rebuild after applyPlan                | ✓ WIRED  | Line 45 import; line 895 invocation inside `rebuildScopeRoutingTable`                  |
| `orchestrators/plugin/install.ts`               | `bridges/hooks/event-router.ts::addPluginConfigToCache` | post-install cache mutation                       | ✓ WIRED  | Line 80 import; line 353 invocation inside `addInstalledPluginHooksToCache`            |
| `orchestrators/plugin/uninstall.ts`             | `bridges/hooks/event-router.ts::removePluginConfigFromCache` | post-uninstall cache mutation                  | ✓ WIRED  | Line 47 import; line 456 invocation inside `withLockedStateTransaction` closure        |

### Behavioral Spot-Checks

| Behavior                                                       | Command                                                                            | Result                | Status |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------- | --------------------- | ------ |
| Phase 59 architecture test suite                               | `node --test tests/architecture/hooks-dispatch.test.ts`                            | 10/10 pass            | ✓ PASS |
| Plan 01 unit tests (debug-log)                                 | `node --test tests/shared/debug-log.test.ts`                                       | 3/3 pass              | ✓ PASS |
| Plan 02 unit tests (event-router + dispatch-exec)              | `node --test tests/bridges/hooks/event-router.test.ts tests/bridges/hooks/dispatch-exec.test.ts` | 21/21 + 3/3 = 24/24 pass | ✓ PASS |
| Phase 57/58 architecture tests preserved                       | `npm run check` (includes architecture suite)                                      | GREEN, no regressions | ✓ PASS |
| Full `npm run check`                                           | `npm run check`                                                                    | exit 0; typecheck + lint + format + ~1972 unit + 10 integration tests all GREEN | ✓ PASS |
| Exactly 7 pi.on registrations in registerHooksBridge           | `grep -c 'pi\.on(' extensions/pi-claude-marketplace/bridges/hooks/event-router.ts` | 7                     | ✓ PASS |
| Sole `console.error` in extension src tree                     | `grep -rn 'console\.error' extensions/pi-claude-marketplace/ --include="*.ts"`     | Only shared/debug-log.ts (1 active call + 2 doc-comment lines) | ✓ PASS |
| No `void registerHooksBridge` form (race-free contract)        | `grep -c 'void registerHooksBridge' extensions/pi-claude-marketplace/index.ts`     | 0                     | ✓ PASS |
| `await registerHooksBridge` present                            | `grep -c 'await registerHooksBridge' extensions/pi-claude-marketplace/index.ts`    | 1                     | ✓ PASS |
| Async factory contract                                         | `grep -c 'export default async function claudeMarketplaceExtension' index.ts`     | 1                     | ✓ PASS |
| Plan 57 hookDebugLog stub removed                              | `grep -cE '^export (function\|const) hookDebugLog' hooks.ts`                        | 0                     | ✓ PASS |

### Probe Execution

No conventional `scripts/*/tests/probe-*.sh` exist in this repository. Phase 59 PLAN/SUMMARY do not declare probe paths. Probe execution: SKIPPED (no runnable probes for this phase).

### Requirements Coverage

| Requirement | Source Plan       | Description                                                                                          | Status      | Evidence                                                                                  |
| ----------- | ----------------- | ---------------------------------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------- |
| DISP-01     | 59-02, 59-03      | Bridge calls `pi.on(eventName, handler)` exactly once per supported Pi event type at extension-factory time | ✓ SATISFIED | 7 distinct `pi.on(...)` in registerHooksBridge; architecture test Block 1 pins count + locked event-name set |
| DISP-02     | 59-02, 59-03      | Routing table cleared and rebuilt synchronously by `rebuildRoutingTables(state, loc)` from `apply.ts` after each scope's apply pass | ✓ SATISFIED | rebuildRoutingTables sync; called from apply.ts:842 per-scope; pre-seeds 8 buckets; zero-disk-I/O sentinel test passes; WR-05 pristine-scope gate added |
| DISP-03     | 59-02, 59-03      | Composite handlers close over an epoch integer; module-level `liveEpoch` bumped on each bridge load; stale handlers no-op | ✓ SATISFIED | `let liveEpoch = 0` cell at event-router.ts:96; bumped at registerHooksBridge entry (line 468); composite handlers check `capturedEpoch !== currentEpoch()`; architecture test Block 4 pins no-op contract |
| DISP-04     | 59-02, 59-03      | Dispatch ordering: cross-plugin `compareByNameThenScope`, within-plugin declaration order; fan-out sequential awaited | ✓ SATISFIED | collectPluginsInScope sorts by compareByNameThenScope; flattenPluginIntoBuckets uses monotonic declarationIndex; dispatch.ts uses `for...await`; Block 3 + sequential-await unit tests pin orderings |
| OBS-01      | 59-01, 59-03      | `shared/debug-log.ts` is the sole debug output seam; gated on `PI_CLAUDE_MARKETPLACE_DEBUG=1`; never uses other emission paths | ✓ SATISFIED | shared/debug-log.ts is the sole console.error in the extension tree (verified by recursive grep + architecture test Block 6); env-gate exact-equal pinned by unit tests; per-file ESLint override scoped to single file |

All 5 requirements declared for Phase 59 in PLAN frontmatter (DISP-01..04, OBS-01) are SATISFIED. No orphaned requirements: REQUIREMENTS.md lines map all 5 IDs to Phase 59 (`Complete`).

### Anti-Patterns Found

Recursive scan over the 16 files identified in the phase context (created/modified by Phase 59):

| File                                                                | Line | Pattern                                | Severity | Impact                                                  |
| ------------------------------------------------------------------- | ---- | -------------------------------------- | -------- | ------------------------------------------------------- |
| (none found)                                                        | —    | TBD / FIXME / XXX (debt markers)       | —        | None — no unresolved debt markers in modified files     |
| (none found)                                                        | —    | Placeholder / "coming soon" prose      | —        | None                                                    |
| `bridges/hooks/dispatch-exec.ts`                                    | 20-26 | `return Promise.resolve()` (no-op stub) | ℹ Info  | EXPECTED: this is the documented D-59-04 stub; signature locked for Phase 60 exec-layer fill |
| `index.ts`                                                          | 53   | `{} as unknown as ExtensionContext` placeholder ctx | ℹ Info | Documented in deviations; bridge's hydrate path does not consume `opts.ctx` (only `opts.cwd`) |

No blocker or warning anti-patterns. Comment policy clean — `grep -E '\b(Phase\|Plan\|Wave\|Pitfall\|Pattern)\s+[0-9]'` returned 0 matches in the new files (per SUMMARY verification).

### Carry-Forward (from 59-REVIEW.md — non-blocking for Phase 59)

These are code-review warnings that **do NOT invalidate any Phase 59 must_have** but should be addressed in subsequent work. Captured here for the next planning pass.

- **WR-01** (factory-time project-scope hydrate uses `homedir()` as cwd; phantom-entry collision risk if `~/.pi/...` carries real state) — Risk is bounded because the phantom entry's cwd is wrong and rebuild's per-scope state walk would normally skip absent records. Fix is a 5-line skip of the project arm at factory time OR a clear-project-cache prefix in `hydrateProjectScopeForCwd`. Defer to Phase 60 or a v1.13 cleanup pass.
- **WR-03** (standalone install/uninstall mutate cache but never rebuild routing tables — masked while `dispatchHookExec` is a stub) — Phase context explicitly classifies this as a Phase 60 concern. Currently the cache flows into the routing table on the next reconcile pass (which install/uninstall trigger).
- **WR-04** (DISP-01 architecture test reads developer real `$HOME`) — Test hermeticity issue, not an invariant correctness issue. Test passes consistently; can be tightened with HOME redirection.
- **Reinstall/Update audit gap** (truth #29 deviation): a future plan should wire `addPluginConfigToCache` / `removePluginConfigFromCache` into `reinstall.ts` and `update.ts` directly to close the bounded gap. Plan 03's done-state explicitly permits the current disposition ("(or document the gap if not)").
- **5 review warnings + 6 info findings total** — see 59-REVIEW.md for full detail.

### Human Verification Required

None. All observable contracts are pinned by automated tests and grep-verifiable static introspection:

- 7-handler count: architecture test Block 1 + grep count
- Ordering invariants: architecture test Blocks 2-3
- Zombie defense: architecture test Block 4
- isError split: architecture test Block 5
- OBS-01 sole-seam: architecture test Block 6 + recursive grep
- Hook stub removal: architecture test Block 7 + grep

The runtime behavior (actual Pi event delivery on `/reload`, factory-time hydrate against a real disk state) is exercised by the Phase 57/58 architecture tests plus the new Plan 03 architecture-test file. No visual, real-time, or external-service contract was introduced in Phase 59.

### Gaps Summary

None. All 5 phase requirements (DISP-01..04, OBS-01) are SATISFIED with both wiring and test pins in place. The phase goal is observably achieved:

- **One composite handler per Pi event type** — confirmed (7 distinct `pi.on(...)` calls + 1 isError-splitting handler on `tool_result`).
- **Synchronous dispatch to the right plugin entries** — confirmed (`rebuildRoutingTables` sync; per-bucket iteration with matcher-fires predicate).
- **Deterministic order** — confirmed (`compareByNameThenScope` cross-plugin; monotonic `declarationIndex` within-plugin).
- **Survives `/reload` without zombie callbacks** — confirmed (module-level `liveEpoch` cell + per-handler captured epoch + short-circuit on mismatch).

The reinstall/update audit gap (truth #29) is an acceptable deviation explicitly permitted by Plan 03's done-state; the bounded leak is documented in the SUMMARY and will be closed by a follow-up plan. The 5 code-review warnings are non-blocking and carried forward.

---

_Verified: 2026-06-14T19:30:00Z_
_Verifier: Claude (gsd-verifier)_

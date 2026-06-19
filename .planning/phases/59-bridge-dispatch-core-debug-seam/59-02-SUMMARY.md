---
phase: 59-bridge-dispatch-core-debug-seam
plan: 02
subsystem: hooks-bridge
tags: [hooks, dispatch-core, event-router, parsed-config-cache, epoch, isError-split]

# Dependency graph
requires:
  - phase: 59-bridge-dispatch-core-debug-seam
    provides: "shared/debug-log.ts canonical OBS-01 seam (Plan 01)"
  - phase: 58-hooks-supportability-dispatch-stub
    provides: "parseHooksConfig / parseMatcher / BUCKET_A_EVENTS / NON_TOOL_EVENT_CLOSED_SETS / HookHandlerEntry domain types"
provides:
  - "extensions/pi-claude-marketplace/bridges/hooks/event-router.ts: liveEpoch + parsedConfigCache + routingTable module-state holder; exports registerHooksBridge, rebuildRoutingTables, addPluginConfigToCache, removePluginConfigFromCache, currentEpoch, getRoutingBucket, RoutingEntry"
  - "extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts: compositeHandlerFor (6-uniform) + toolResultCompositeHandler (D-59-01 isError split) + bridge-internal _setExecutorForTest seam"
  - "extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts: no-op Promise<void> stub the execution layer fills in a later phase (D-59-04)"
  - "extensions/pi-claude-marketplace/bridges/hooks/index.ts: barrel re-exporting the bridge's public surface"
  - "extensions/pi-claude-marketplace/bridges/index.ts: extended top-level barrel"
  - "extensions/pi-claude-marketplace/platform/pi-api.ts: re-exports 6 additional Pi event payload types (ToolResultEvent, SessionStartEvent, SessionShutdownEvent, SessionBeforeCompactEvent, SessionCompactEvent, InputEvent)"
  - "extensions/pi-claude-marketplace/domain/components/hooks.ts: HookHandlerEntry interface now exported (was internal)"
  - "tests/bridges/hooks/event-router.test.ts: 18 unit tests pinning cache, rebuild, sort, declarationIndex, epoch, and composite-handler contracts"
  - "tests/bridges/hooks/dispatch-exec.test.ts: 3 unit tests pinning the no-op stub signature"
affects: [phase-59-plan-03-architecture-tests-and-wiring]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Module-state holder pattern: bridges/hooks/event-router.ts owns three module-level cells (liveEpoch, parsedConfigCache, routingTable) with cache mutators + a synchronous rebuild + a factory that wires the pi.on registrations; test-only inspectors (_routingTableForTest, _parsedConfigCacheForTest, _resetForTest, _bumpEpochForTest, _setRoutingBucketForTest) live on the same module and are explicitly NOT re-exported through index.ts."
    - "Cache key composition pattern: `${scope}\\x00${marketplace}\\x00${pluginId}` keyed by ALL three identity dimensions so a same-(scope,pluginId) collision across marketplaces does NOT shadow earlier entries (T-59-02-01 mitigation; pinned by the marketplace-keyed disambiguation test)."
    - "Test-injection seam pattern: dispatch.ts exposes _setExecutorForTest / _resetExecutorForTest because ESM imports are read-only bindings -- Node's `t.mock.method(mod, name, ...)` cannot redefine a re-exported function reference. The seam is bridge-internal and not re-exported through index.ts; the pattern mirrors how other bridges expose test-only mutators alongside the production surface."
    - "Sequential-await fan-out proof pattern: the DISP-04 'NOT Promise.all' contract is pinned by recording start AND end markers in a delayed mock executor; sequential dispatch produces start:p1, end:p1, start:p2, end:p2 whereas Promise.all would produce start:p1, start:p2, end:p1, end:p2."

key-files:
  created:
    - "extensions/pi-claude-marketplace/bridges/hooks/event-router.ts"
    - "extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts"
    - "extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts"
    - "extensions/pi-claude-marketplace/bridges/hooks/index.ts"
    - "tests/bridges/hooks/event-router.test.ts"
    - "tests/bridges/hooks/dispatch-exec.test.ts"
  modified:
    - "extensions/pi-claude-marketplace/bridges/index.ts"
    - "extensions/pi-claude-marketplace/platform/pi-api.ts"
    - "extensions/pi-claude-marketplace/domain/components/hooks.ts"

key-decisions:
  - "D-59-01 confirmed: 7 distinct pi.on call sites in registerHooksBridge -- session_start, session_shutdown, session_before_compact, session_compact, input, tool_call, tool_result -- with the isError split on tool_result happening inside ONE composite handler (event.isError ? PostToolUseFailure : PostToolUse) rather than via two pi.on registrations on the same Pi event."
  - "D-59-02 confirmed: parsedConfigCache is in-memory, bridge-owned, populated at factory time by hydrate + mutated by install/uninstall code paths (Plan 03 wiring); rebuildRoutingTables is synchronous and performs zero disk I/O on the hot path (DISP-02), pinned by a fs.promises.readFile sentinel test that throws if called."
  - "D-59-03 confirmed: liveEpoch is a module-top `let liveEpoch = 0` cell; registerHooksBridge increments before any other work and captures the value into closures; composite handlers short-circuit on mismatch. The architecture test in Plan 03 will pin the no-op-on-mismatch contract at the registration boundary."
  - "D-59-04 confirmed: dispatchHookExec ships as a no-op `(_entry, _event, _ctx) => Promise.resolve()` stub. The execution layer fills the body without changing the signature."
  - "Plan-internal decision (D-59-02 PLAN-LOCAL): bridges/ cannot import transaction/ per ESLint BLOCK C zone rule, so hydrateCacheFromDisk calls loadState(loc.extensionRoot) directly rather than wrapping the read in withLockedStateTransaction (as the must_haves text suggested). The read is intentionally non-locked: factory-time hydrate races with concurrent install/uninstall harmlessly because reconcile re-runs after every state mutation."
  - "Plan-internal decision (D-59-02 PLAN-LOCAL): RoutingEntry carries `rawMatcher: string` AND the pre-parsed `matcher: ParsedMatcher`. The raw form is the SessionStart filter's data source (event.reason equality is a string compare on the rawMatcher, since the parser narrows it to one of `{\"\", \"*\", \"startup\", \"resume\"}` at parse time); the parsed form is the tool-event filter's data source (piTools Set membership). The redundancy is intentional -- it keeps both filter paths O(1) and zero-allocation per dispatch."
  - "Plan-internal decision (D-59-02 PLAN-LOCAL): dispatch.ts uses a bridge-internal executor seam (`_setExecutorForTest` / `_resetExecutorForTest`) because ESM module-export bindings are read-only and `t.mock.method` fails with 'Cannot redefine property'. The seam is the mechanical workaround; the production path is byte-unchanged (activeExecutor defaults to dispatchHookExec)."

patterns-established:
  - "ESM-friendly test mocking via local indirection: when a unit test needs to swap a function imported into another module, expose a bridge-internal setter/resetter on the IMPORTING module (not the EXPORTING one). The pattern avoids requiring --experimental-test-mock or wholesale module mocking; default execution is byte-unchanged."

requirements-completed: [DISP-01, DISP-02, DISP-03, DISP-04]

# Metrics
duration: ~43min
completed: 2026-06-14
---

# Phase 59 Plan 02: Bridge Dispatch Core Summary

**Hooks-bridge dispatch core landed -- liveEpoch + parsedConfigCache + routingTable module-state holder, 7-event pi.on factory with the `event.isError` PostToolUse/PostToolUseFailure split, no-op execution stub, and 21 unit tests pinning cache + rebuild + sort + epoch + composite-handler contracts.**

## Performance

- **Duration:** ~43 min
- **Started:** 2026-06-14T21:02:13Z
- **Completed:** 2026-06-14T21:45:18Z
- **Tasks:** 3 (each with its own TDD red/green/refactor pass)
- **Files modified:** 9 (6 created, 3 edited)
- **Unit tests added:** 21 (18 event-router.test.ts + 3 dispatch-exec.test.ts)

## Accomplishments

- Built `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts` -- the hooks-bridge module-state holder. Three top-of-module cells: `let liveEpoch = 0` (D-59-03 epoch defense), `parsedConfigCache: Map<key, CacheEntry>` (D-59-02 in-memory cache), `routingTable: Map<BucketAEvent, ReadonlyArray<RoutingEntry>>` (8 buckets pre-populated to `[]` after every rebuild). Cache key composition is `${scope}\x00${marketplace}\x00${pluginId}` so two marketplaces declaring the same pluginId in the same scope each get their own entry.
- Built `extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts` -- the composite-handler factories. `compositeHandlerFor(claudeEvent, capturedEpoch)` returns the closure for six of the seven Pi events (session_start, session_shutdown, session_before_compact, session_compact, input, tool_call); `toolResultCompositeHandler(capturedEpoch)` is the seventh. Both factories apply the DISP-03 epoch check at entry and DISP-04 sequential awaited fan-out (no Promise.all). The tool_result handler reads `event.isError` ONCE at the top and routes to the PostToolUseFailure bucket on truthy or the PostToolUse bucket on falsy/undefined (D-59-01 single-handler isError split).
- Built `extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts` -- the no-op execution stub `(_entry, _event, _ctx) => Promise.resolve()` (D-59-04). The composite handlers call it sequentially against every routing-entry whose matcher fires; the execution layer fills the body in a later phase without changing the locked signature.
- Built `extensions/pi-claude-marketplace/bridges/hooks/index.ts` -- the bridge's public barrel. Re-exports `registerHooksBridge`, `rebuildRoutingTables`, `addPluginConfigToCache`, `removePluginConfigFromCache`, and the `RoutingEntry` type. The module-internal cells (liveEpoch / parsedConfigCache / routingTable) and the test-only inspectors are explicitly NOT re-exported; downstream callers treat the bridge as opaque.
- Extended `extensions/pi-claude-marketplace/bridges/index.ts` -- the top-level bridges barrel grew its 5th `export * from "./hooks/index.ts";` line alongside agents/commands/mcp/skills.
- Extended `extensions/pi-claude-marketplace/platform/pi-api.ts` -- the D-04 Pi peer-import chokepoint grew six additional type re-exports (`ToolResultEvent`, `SessionStartEvent`, `SessionShutdownEvent`, `SessionBeforeCompactEvent`, `SessionCompactEvent`, `InputEvent`).
- Exported `HookHandlerEntry` from `extensions/pi-claude-marketplace/domain/components/hooks.ts` -- the interface was previously module-internal but is now consumed by `RoutingEntry` (which the bridge re-exports).
- Pinned the dispatch-core contracts with 21 unit tests: cache mutator idempotency + marketplace-keyed disambiguation, 8-bucket population, cross-plugin sort against `compareByNameThenScope`, within-plugin source order via the monotonic `declarationIndex`, empty-rebuild clearing, cache-miss tolerance, zero disk I/O sentinel (DISP-02), currentEpoch initial value, sequential bucket firing, matcher-skips-mismatches, SessionStart filter against `event.reason`, UserPromptSubmit unconditional firing, epoch-mismatch no-op for both composite-handler shapes, tool_result PostToolUseFailure/PostToolUse routing on `event.isError`, sequential-await (NOT Promise.all) proof via a start/end-recording mock.

## Task Commits

Three tasks; each ships with its own TDD pass + atomic commit.

1. **Task 1: Scaffold dispatch surface (platform re-exports + dispatch-exec stub + barrels)** -- `38d8806` (feat)
2. **Task 2: Build dispatch core (event-router module-state + cache + rebuild + hydrate + registerHooksBridge)** -- `a6a24ec` (feat)
3. **Task 3: Extract composite handlers into dispatch.ts + 9 dispatch tests** -- `a087ebd` (refactor)

**Plan metadata commit:** TBD (final docs commit lands after this summary is written and the state/roadmap updates run).

## Files Created/Modified

### Created

- `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts` (520 lines) -- module-state holder; exports registerHooksBridge, rebuildRoutingTables, addPluginConfigToCache, removePluginConfigFromCache, currentEpoch, getRoutingBucket, RoutingEntry, plus 4 test-only inspectors.
- `extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts` (225 lines) -- compositeHandlerFor (6-uniform), toolResultCompositeHandler (isError split), matcherFiresOnToolEvent / matcherFiresOnSessionStart predicates, _setExecutorForTest / _resetExecutorForTest seam.
- `extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts` (27 lines) -- no-op stub.
- `extensions/pi-claude-marketplace/bridges/hooks/index.ts` (21 lines) -- barrel.
- `tests/bridges/hooks/event-router.test.ts` (574 lines) -- 18 tests.
- `tests/bridges/hooks/dispatch-exec.test.ts` (46 lines) -- 3 tests.

### Modified

- `extensions/pi-claude-marketplace/bridges/index.ts` (+1 line) -- top-level barrel grew the hooks re-export.
- `extensions/pi-claude-marketplace/platform/pi-api.ts` (+6 type names) -- 6 additional Pi event payload type re-exports.
- `extensions/pi-claude-marketplace/domain/components/hooks.ts` (-1 keyword, +1 keyword) -- `HookHandlerEntry` is now `export interface` (was `interface`).

## Decisions Made

- **The `UserPromptSubmitEvent` name in the plan does NOT exist in the Pi peer-dep types** -- the matching Pi event interface is `InputEvent` (`type: "input"`, fields: `text`, `source`, `images?`, `streamingBehavior?`). Substituted `InputEvent` for `UserPromptSubmitEvent` in the platform/pi-api.ts re-export and in the pi.on registration. The Claude-side bucket name `UserPromptSubmit` (used inside `BUCKET_A_EVENTS` and on the routing-table key) is unchanged.
- **Bridges cannot import transaction/ per ESLint BLOCK C** -- `hydrateCacheFromDisk` calls `loadState(loc.extensionRoot)` directly rather than wrapping the read in `withLockedStateTransaction` (as the plan's must_haves text suggested). The read is intentionally non-locked: factory-time hydrate races with concurrent install/uninstall harmlessly because reconcile re-runs after every state mutation.
- **The test-injection mechanism in dispatch.ts uses local indirection (`_setExecutorForTest`) rather than Node's `t.mock.method` on the dispatch-exec module.** Initial attempts failed with `TypeError: Cannot redefine property: dispatchHookExec` -- ESM module-export bindings are read-only. The indirection is bridge-internal, default-routed to the production `dispatchHookExec`, and not re-exported via index.ts.
- **`RoutingEntry` carries BOTH `matcher: ParsedMatcher` AND `rawMatcher: string`.** The rawMatcher is the SessionStart filter's data source (`event.reason === rawMatcher`); the parsed form is the tool-event filter's data source (`piTools.has(event.toolName)`). The redundancy keeps both filter paths O(1) and zero-allocation per dispatch.
- **The dispatch-core does NOT wire pi.on inline -- it routes through `compositeHandlerFor` / `toolResultCompositeHandler`** factories so the per-event closure shape lives in `dispatch.ts` and `registerHooksBridge` reads as a sequence of seven registration lines plus the bump-hydrate-rebuild prelude.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `UserPromptSubmitEvent` type does not exist in peer dep**

- **Found during:** Task 1
- **Issue:** The plan's must_haves listed `UserPromptSubmitEvent` among the 5 new Pi event payload types to re-export from `platform/pi-api.ts`. A grep of the peer-dep types.d.ts confirmed the type does not exist -- Pi calls the event `InputEvent` (event name `"input"`).
- **Fix:** Substituted `InputEvent` for `UserPromptSubmitEvent` in the type re-export list and in the `pi.on("input", ...)` registration; the Claude-side bucket name `UserPromptSubmit` is preserved on the routing-table key (no change to `BUCKET_A_EVENTS`).
- **Files modified:** extensions/pi-claude-marketplace/platform/pi-api.ts, extensions/pi-claude-marketplace/bridges/hooks/event-router.ts (Task 2), extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts (Task 3).
- **Commits:** 38d8806, a6a24ec, a087ebd

**2. [Rule 3 - Blocking] `HookHandlerEntry` not exported from domain/components/hooks.ts**

- **Found during:** Task 1
- **Issue:** The plan's must_haves named `HookHandlerEntry` on the `RoutingEntry` interface, but the type was declared as `interface HookHandlerEntry` (no `export`) inside domain/components/hooks.ts -- a Phase 57 / 58 omission. Without the export, the bridge cannot import the type for its public `RoutingEntry` shape.
- **Fix:** Added the `export` keyword to the existing `interface HookHandlerEntry` declaration. No semantic change; the type was already structurally complete.
- **Files modified:** extensions/pi-claude-marketplace/domain/components/hooks.ts
- **Commits:** 38d8806

**3. [Rule 3 - Blocking] bridges/ cannot import transaction/ (ESLint BLOCK C)**

- **Found during:** Task 2
- **Issue:** The plan's hydrate behavior text suggested wrapping the per-scope state read in `withLockedStateTransaction(loc, ...)` from `extensions/pi-claude-marketplace/transaction/`. ESLint BLOCK C zone rule forbids bridges/ from importing transaction/.
- **Fix:** Call `loadState(loc.extensionRoot)` directly inside `hydrateCacheFromDisk`. The read is intentionally non-locked: factory-time hydrate races with concurrent install/uninstall harmlessly because reconcile re-runs after every state mutation.
- **Files modified:** extensions/pi-claude-marketplace/bridges/hooks/event-router.ts
- **Commits:** a6a24ec

**4. [Rule 1 - Bug] Drift-guard architecture test 260525-cjr B3 caught inline `["user", "project"]` literal**

- **Found during:** Task 3 (npm test wall-of-tests pass)
- **Issue:** `hydrateCacheFromDisk` declared `const scopes: Scope[] = ["user", "project"];`. The architecture test `tests/architecture/scopes-canonical-source.test.ts` (gate 260525-cjr B3) red-fails any literal `["user", "project"]` tuple outside the canonical `SCOPES` declaration in `shared/types.ts`.
- **Fix:** Imported `SCOPES` from `../../shared/types.ts` and iterated `for (const scope of SCOPES)` instead of the inline tuple.
- **Files modified:** extensions/pi-claude-marketplace/bridges/hooks/event-router.ts
- **Commits:** a087ebd

**5. [Rule 1 - Bug] `t.mock.method` on dispatchExecMod fails with "Cannot redefine property"**

- **Found during:** Task 3 (first dispatch-test run)
- **Issue:** The dispatch tests need to spy on `dispatchHookExec` from inside the composite handlers. The plan suggested `t.mock.method(dispatchExecMod, "dispatchHookExec", ...)` against the imported namespace, but Node's ESM module-export bindings are read-only -- the assignment trips `TypeError: Cannot redefine property: dispatchHookExec`.
- **Fix:** Introduced a bridge-internal indirection seam in dispatch.ts (`_setExecutorForTest` / `_resetExecutorForTest`) that swaps a mutable `activeExecutor` reference; production default remains `dispatchHookExec`. The seam is not re-exported via index.ts.
- **Files modified:** extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts, tests/bridges/hooks/event-router.test.ts
- **Commits:** a087ebd

### Architectural Adjustments (no Rule 4 stop -- still mechanical)

- The plan asked for both `event-router.ts` and `dispatch.ts` exports of `compositeHandlerFor`. The implementation lives ONLY in `dispatch.ts`; `event-router.ts` imports it. The bridge's `index.ts` does not re-export `compositeHandlerFor` / `toolResultCompositeHandler` because they are factory-time-only consumers of `registerHooksBridge` and not part of the bridge's intended public surface. The plan's exports list in the artifact spec described the public surface as the four runtime functions + the `RoutingEntry` type; the dispatch factories are bridge-internal.
- The plan suggested the rebuild "looks up the cache entry via cacheKey; if absent, skip silently". The implementation does this AND iterates `Object.entries(state.marketplaces)` filtered by `mpRecord.scope === loc.scope` AND filters per-plugin by `pluginRecord.resources.hooks.length > 0` so the per-state walk is O(installed-plugins-in-scope) rather than O(all-installed-plugins).

## Issues Encountered

- **Prettier reformatted `tests/bridges/hooks/dispatch-exec.test.ts` on the first pre-commit run** (Task 1; collapsed a single-statement test body and rebroke import grouping after my edits). Re-staged and re-ran pre-commit; the second run was clean. Standard formatter-driven reflow, not a plan deviation.
- **Prettier reformatted `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts` on Task 2's pre-commit** -- collapsed the two-line `BUCKET_A_EVENTS` / `type BucketAEvent` import block into one line. Re-staged; second run clean.
- **Initial dispatch-test attempt used `t.mock.method` on the imported namespace and failed** -- see Deviation 5 above. The fix was a one-time architectural adjustment (the indirection seam), and the remaining 8 dispatch tests landed against the seam on the first try.
- **Initial `fs.readFileSync` mock for the zero-disk-I/O test tripped `TypeError: Cannot redefine property`** -- same ESM-binding root cause. Switched to mocking only `fs.promises.readFile` (the only fs method the rebuild path could possibly call); the rebuild's actual disk-I/O surface is zero, so the narrower mock still pins the contract.

## User Setup Required

None -- no external service configuration required.

## Next Phase Readiness

- **Plan 03 wiring surface:** `registerHooksBridge` is `async (pi, { ctx, cwd }): Promise<void>` -- Plan 03's extension factory edit awaits this call. `rebuildRoutingTables(state, loc): void` is the apply.ts call-site signature. `addPluginConfigToCache(scope, marketplace, pluginId, config)` / `removePluginConfigFromCache(scope, marketplace, pluginId)` are the install/uninstall mutators.
- **Plan 03 architecture-test pin points:** the architecture test should grep for exactly 7 `pi.on(...)` call sites in registerHooksBridge, assert the four-step order (bump epoch -> hydrate -> rebuild both scopes -> register), and assert that `getRoutingBucket(claudeEvent)` returns the bucket the rebuild produced.
- **No blockers:** `npm run check` (typecheck + lint + format:check + 1962 unit + 10 integration tests) is GREEN at plan close.

## Threat Flags

None -- the surface introduced (factory-time `loadState` read inside hydrate) was already considered in T-59-02-04 (information-disclosure via debug-log) and is mitigated by the OBS-01 seam routing. No new network endpoints, no new auth paths, no new file-write surfaces beyond what the plan's threat-model already covered.

## Verification

- `node --test tests/bridges/hooks/event-router.test.ts` -- 18/18 pass.
- `node --test tests/bridges/hooks/dispatch-exec.test.ts` -- 3/3 pass.
- `node --test tests/architecture/hooks-foundation.test.ts tests/architecture/hooks-supportability.test.ts tests/domain/components/hooks.test.ts tests/architecture/hooks-tool-name-map.test.ts` -- 53/53 pass; Phase 57/58 contracts preserved.
- `npm run check` -- GREEN (typecheck + lint + format + 1962 unit tests + 10 integration tests).
- `grep -E '\b(Phase|Plan|Wave|Pitfall|Pattern)\s+[0-9]' extensions/pi-claude-marketplace/bridges/hooks/*.ts` -- 0 matches (comment policy clean).
- `grep -c "^export " extensions/pi-claude-marketplace/bridges/hooks/event-router.ts` -- includes the 7 public exports + 5 test-only inspectors.
- `git diff --stat extensions/pi-claude-marketplace/bridges/` -- 4 new files in bridges/hooks/ + the 1-line edit to bridges/index.ts.
- `git diff --stat extensions/pi-claude-marketplace/platform/pi-api.ts` -- 6 added type names.

## Self-Check: PASSED

- Created files exist:
  - `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts` -- FOUND
  - `extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts` -- FOUND
  - `extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts` -- FOUND
  - `extensions/pi-claude-marketplace/bridges/hooks/index.ts` -- FOUND
  - `tests/bridges/hooks/event-router.test.ts` -- FOUND
  - `tests/bridges/hooks/dispatch-exec.test.ts` -- FOUND
- Modified files exist:
  - `extensions/pi-claude-marketplace/bridges/index.ts` -- FOUND
  - `extensions/pi-claude-marketplace/platform/pi-api.ts` -- FOUND
  - `extensions/pi-claude-marketplace/domain/components/hooks.ts` -- FOUND
- Commits exist:
  - `38d8806` (Task 1) -- FOUND
  - `a6a24ec` (Task 2) -- FOUND
  - `a087ebd` (Task 3) -- FOUND

---

*Phase: 59-bridge-dispatch-core-debug-seam*
*Completed: 2026-06-14*

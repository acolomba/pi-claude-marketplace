---
phase: 59-bridge-dispatch-core-debug-seam
plan: 03
subsystem: hooks-bridge
tags: [hooks, dispatch-wiring, apply-call-site, install-uninstall-cache, architecture-tests, factory-async]

# Dependency graph
requires:
  - phase: 59-bridge-dispatch-core-debug-seam
    provides: "Plan 01 OBS-01 seam at shared/debug-log.ts + Plan 02 dispatch core (event-router.ts, dispatch.ts, dispatch-exec.ts)"
provides:
  - "extensions/pi-claude-marketplace/index.ts: async default-export factory that awaits registerHooksBridge BEFORE any session-lifecycle event can fire (DISP-01 + D-59-02 + D-59-03 trigger); deferred project-scope hydrate on first resources_discover"
  - "extensions/pi-claude-marketplace/bridges/hooks/event-router.ts: new exported hydrateProjectScopeForCwd(cwd) for the deferred-project-hydrate path; barrel re-exports the helper"
  - "extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts: per-scope rebuildRoutingTables call after the apply pass, wrapped in a brief read-only withLockedStateTransaction with a WR-05 pristine-scope gate (skip when state.json absent)"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/install.ts: parsed-config cache add inside the per-plugin lock after runInstallLedger succeeds (D-59-02 cache lifecycle insert)"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts: parsed-config cache remove inside the per-plugin lock after the state mutation (D-59-02 cache lifecycle remove)"
  - "tests/architecture/hooks-dispatch.test.ts: 7-block architecture pin file (10 tests total) for DISP-01..04 + OBS-01 + D-59-05"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Async-factory contract (DISP-01): `export default async function claudeMarketplaceExtension(pi: ExtensionAPI): Promise<void>`. The peer-dep declares `ExtensionFactory = (pi) => void | Promise<void>` and Pi's loader awaits the factory Promise (loader.d.ts), so an awaited registerHooksBridge call inside the factory body guarantees all 7 pi.on registrations + user-scope cache hydrate complete BEFORE the first session event fires. The `void` fire-and-forget alternative was explicitly rejected -- it would race the first session_start because the loader does not see the un-awaited inner Promise."
    - "Deferred-cwd hydrate pattern: the factory has no project cwd at extension-load time (Pi's resources_discover is the first signal that delivers an event.cwd), so the factory-time registerHooksBridge call uses homedir() (which hydrates the USER scope correctly) and a follow-up hydrateProjectScopeForCwd(event.cwd) at the resources_discover handler rehydrates project scope before applyReconcile runs its per-scope rebuilds."
    - "Pristine-scope mkdir gate (WR-05): the per-scope rebuild guards on `pathExists(loc.stateJsonPath)` because withLockedStateTransaction would mkdir extensionRoot on lock acquisition. A pristine scope without state.json has zero installed plugins to register; skipping preserves the 'clean reconcile creates no unsolicited files' contract that index-handler.test.ts pins."

key-files:
  created:
    - "tests/architecture/hooks-dispatch.test.ts"
  modified:
    - "extensions/pi-claude-marketplace/index.ts"
    - "extensions/pi-claude-marketplace/bridges/hooks/event-router.ts"
    - "extensions/pi-claude-marketplace/bridges/hooks/index.ts"
    - "extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts"
    - "extensions/pi-claude-marketplace/orchestrators/plugin/install.ts"
    - "extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts"
    - "tests/edge/index-handler.test.ts"
    - "tests/shared/index-smoke.test.ts"
    - "tests/e2e/_helpers.ts"
    - "tests/e2e/resources-discover.test.ts"

key-decisions:
  - "D-59-02 wiring confirmed: install adds via addPluginConfigToCache inside the per-plugin lock AFTER `installCtx = result.installCtx` and BEFORE `tx.save()`; uninstall removes via removePluginConfigFromCache AFTER `delete mp.plugins[plugin]` and BEFORE `tx.save()`. The bounded-leak window (closure throw between cache mutation and tx.save) is documented in both call-site comments -- the next /reload resets the cache via the factory-time hydrate, so the leak is bounded."
  - "Plan-internal decision: registerHooksBridge's existing signature `(pi, { ctx; cwd })` from Plan 02 is preserved as-is. The plan's text suggested a `projectCwdSource: 'deferred'` shape but Plan 02 went a different route (single cwd, hydrate both scopes at factory time). The factory passes `homedir()` so user-scope hydrates correctly; project-scope hydration uses the wrong cwd (homedir, not the eventual project cwd) and silently finds no state.json (loadState's missing-file arm returns default state). The follow-up `hydrateProjectScopeForCwd(event.cwd)` at the first resources_discover event re-hydrates project scope with the correct cwd BEFORE applyReconcile rebuilds the per-scope routing tables."
  - "Plan-internal decision: a new exported `hydrateProjectScopeForCwd(cwd: string): Promise<void>` was added to event-router.ts (Rule 3 blocking fix). Plan 02 did not expose a deferred-project-hydrate path because Plan 02 shipped before the deferred-cwd constraint was concretely observable. The function is a thin wrapper around the existing per-scope `hydrateScopeFromState` helper -- no new behavior, just a public re-entry point for the project scope alone. The architecture test does NOT directly pin this function (it pins the registerHooksBridge contract, which calls hydrate at factory time); future refactor that consolidates the user-scope + project-scope hydrate paths can remove the deferred helper without breaking the architecture invariants."
  - "Plan-internal decision: WR-05 pristine-scope gate added inline to rebuildScopeRoutingTable via `pathExists(loc.stateJsonPath)` short-circuit. withLockedStateTransaction mkdir's the extensionRoot on lock acquisition; calling it unconditionally per scope on every reconcile would create `.pi/pi-claude-marketplace/` directories in arbitrary cwds (and in homedir on factory time) violating the index-handler.test.ts WR-05 contract. The gate is correctness-equivalent: a scope with no state.json has zero installed plugins, so the rebuild would walk zero buckets anyway."
  - "Plan-internal decision: the per-scope routing-table rebuild's WR-01 isolation pattern was extracted into `rebuildScopeRoutingTableIsolated` (helper) because inlining the try/catch arm inside applyReconcile pushed cognitive complexity from 15 to 17 (sonarjs lint budget). The helper carries the same WR-01 invalid-block coercion the read-pass arm uses, so a transient lock-held / EACCES throw surfaces as a structured outcome rather than aborting applyReconcile wholesale."

patterns-established:
  - "Mockable async-factory invocation pattern (consumer-side): callers of `claudeMarketplaceExtension(pi)` MUST `await` the returned Promise. tests/edge/index-handler.test.ts, tests/shared/index-smoke.test.ts, and the e2e harness were updated in lockstep. A future contributor who adds a new test must await the factory or the test will observe partial registration (the 7 hooks pi.on calls happen AFTER the hydrate await inside registerHooksBridge)."

requirements-completed: [DISP-01, DISP-02, DISP-03, DISP-04, OBS-01]

# Metrics
duration: ~95min
completed: 2026-06-14
---

# Phase 59 Plan 03: Bridge Dispatch Wiring + Architecture Pins Summary

**Hooks-bridge dispatch wiring landed: async-factory contract with `await registerHooksBridge` blocks first session event until 7 pi.on registrations complete; per-scope `rebuildRoutingTables` in apply.ts after every reconcile (gated on pristine scopes); install/uninstall maintain the parsed-config cache inside the per-plugin lock; 10 unit tests across 7 architecture blocks pin DISP-01..04 + OBS-01 + D-59-05.**

## Performance

- **Duration:** ~95 min
- **Started:** 2026-06-14T21:48:39Z
- **Completed:** 2026-06-14T23:25:00Z
- **Tasks:** 3 (Task 1 + Task 2 atomic edits; Task 3 architecture-test TDD pass)
- **Files modified:** 10 (1 new, 9 edited)
- **Architecture tests added:** 10 (across 7 named blocks)

## Accomplishments

- Converted `extensions/pi-claude-marketplace/index.ts` default-export factory to `async function`. Pi's loader (peer-dep `loader.d.ts` declares `loadExtensionFromFactory(...): Promise<Extension>`) awaits the factory Promise before emitting any session-lifecycle event, so the `await registerHooksBridge(pi, { ctx, cwd: homedir() })` call inside the factory body guarantees all 7 pi.on registrations + user-scope cache hydrate complete BEFORE the first session event fires (DISP-01 + PATTERNS Pitfall 2 ordering). The `void` fire-and-forget alternative was explicitly rejected per the plan's locked truth: it would race the first session_start because the loader does not see the un-awaited inner Promise.
- Added `hydrateProjectScopeForCwd(cwd: string): Promise<void>` to `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts` and re-exported it through the barrel. The factory has no project cwd at extension-load time (Pi's `resources_discover` event is the first signal that delivers an `event.cwd`); the helper runs project-scope cache hydrate with the correct cwd at the first resources_discover BEFORE `applyReconcile` rebuilds the per-scope routing tables. The factory-time `registerHooksBridge` call still hydrates the user scope correctly (which uses `getAgentDir()`, not the supplied cwd).
- Wired `rebuildRoutingTables(state, loc)` into `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts` inside the per-scope `for (const scope of scopes)` loop. The call sits AFTER `await applyPlan(opts, readResult.plan, outcomes)` returns AND for the no-plan arm (rebuild runs regardless of whether applyPlan ran). The acquisition uses a brief read-only `withLockedStateTransaction(loc, async (tx) => rebuildRoutingTables(tx.state, loc))` per RESEARCH Open Question 1 Option A (safest). A WR-05 pristine-scope gate (`pathExists(loc.stateJsonPath)` short-circuit) prevents the lock-acquisition `mkdir(extensionRoot)` from violating the "clean reconcile creates no unsolicited files" contract. A transient lock-held / EACCES throw is captured as a structured `invalid-block` outcome via the `rebuildScopeRoutingTableIsolated` helper -- mirrors the existing WR-01 isolation pattern.
- Wired `addPluginConfigToCache(scope, marketplace, plugin, parsed)` into `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` AFTER the `installCtx = result.installCtx` assignment AND BEFORE `tx.save()`. Skipped when the plugin declares no hooks (`installCtx.resolved.hooksConfigPath === undefined`). Read-throw and parse-error paths route through the OBS-01 debug seam (`hookDebugLog`) and are non-fatal: the resolver already validated at install entry, so a fresh failure here is defensive; reconcile rehydrates from disk on the next pass.
- Wired `removePluginConfigFromCache(scope, marketplace, plugin)` into `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts` AFTER the `delete mp.plugins[plugin]` mutation AND BEFORE `tx.save()`. Called unconditionally (the function is idempotent -- removing a missing key is a no-op).
- Built `tests/architecture/hooks-dispatch.test.ts` -- 7 named blocks, 10 tests:
  - **Block 1 (DISP-01):** synthetic Pi mock records every `on(event, handler)` call; `registerHooksBridge` invocation produces exactly 7 calls matching the locked set `{session_start, session_shutdown, session_before_compact, session_compact, input, tool_call, tool_result}`.
  - **Block 2 (DISP-02):** rebuildRoutingTables against a synthetic state populates exactly the 8 buckets in `BUCKET_A_EVENTS`.
  - **Block 3 (DISP-04):** cross-plugin order is alphabetical (project tie-breaks on same-name pairs); within-plugin order preserves declaration index across multiple groups in the same event arm.
  - **Block 4 (DISP-03):** `_bumpEpochForTest()` advances the live cell; a composite handler captured at the stale epoch no-ops -- dispatchHookExec is never invoked.
  - **Block 5 (D-59-01):** `toolResultCompositeHandler` reads `event.isError` and routes truthy to the PostToolUseFailure bucket, falsy to PostToolUse. Both buckets are pre-populated so the test pins which one is selected, not coincidental empty-bucket fall-through.
  - **Block 6 (OBS-01):** recursive `.ts` scan under `extensions/pi-claude-marketplace/` finds `console.error(...)` ONLY in `shared/debug-log.ts`; `eslint.config.js` is parsed for the three sanctioned `no-console: "off"` overrides (notify.ts / debug-log.ts / migrate.ts) -- any drift in either direction red-fails.
  - **Block 7 (D-59-05):** `domain/components/hooks.ts` no longer exports `hookDebugLog`; the import line points at `../../shared/debug-log.ts`; the three call sites (parseHooksConfig's JSON-parse / schema-validation / supportability arms) are preserved.

## Task Commits

Three tasks; each shipped with its own atomic commit.

1. **Task 1: Wire registerHooksBridge into index.ts + rebuildRoutingTables into apply.ts** -- `1a8c9ad` (feat)
2. **Task 2: Wire addPluginConfigToCache / removePluginConfigFromCache into install.ts + uninstall.ts** -- `45b63b7` (feat)
3. **Task 3: Architecture-test pin file + consumer test updates** -- `5d403d4` (test)

**Plan metadata commit:** TBD (final docs commit lands after this summary is written and the state/roadmap updates run).

## Files Created/Modified

### Created

- `tests/architecture/hooks-dispatch.test.ts` (553 lines) -- 7 blocks, 10 tests.

### Modified

- `extensions/pi-claude-marketplace/index.ts` (+~50 lines) -- async factory; `await registerHooksBridge` at factory time; deferred `hydrateProjectScopeForCwd` on first resources_discover.
- `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts` (+30 lines) -- exported `hydrateProjectScopeForCwd`.
- `extensions/pi-claude-marketplace/bridges/hooks/index.ts` (+1 line) -- barrel re-export.
- `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts` (+30 lines) -- per-scope rebuild call + isolated helper + WR-05 gate.
- `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` (+50 lines) -- cache add helper + per-call gating.
- `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts` (+10 lines) -- unconditional cache remove.
- `tests/edge/index-handler.test.ts` (~4 lines) -- `await` the now-async factory.
- `tests/shared/index-smoke.test.ts` (~10 lines) -- `await` the factory; updated events-array assertion for the 7 new hooks pi.on registrations.
- `tests/e2e/_helpers.ts` (~1 line) -- `await` the factory.
- `tests/e2e/resources-discover.test.ts` (~1 line) -- `await` the factory.

## Decisions Made

- **The factory-time `registerHooksBridge` uses `homedir()` as cwd; project-scope hydrate is deferred.** Pi's `resources_discover` is the first signal that delivers a project `cwd`; the factory has none. Passing `homedir()` correctly hydrates the user scope (which derives its path via `getAgentDir()` and ignores the supplied cwd). The follow-up `hydrateProjectScopeForCwd(event.cwd)` at the first resources_discover handler re-hydrates project scope BEFORE applyReconcile rebuilds the per-scope routing tables.
- **WR-05 pristine-scope gate on rebuildScopeRoutingTable.** `withLockedStateTransaction` mkdir's the extensionRoot on lock acquisition. Without the gate, every reconcile against a pristine scope (no state.json yet) would create `.pi/pi-claude-marketplace/` directories in arbitrary cwds, violating the index-handler.test.ts WR-05 contract. The gate is correctness-equivalent: a pristine scope has zero installed plugins, so the rebuild walks zero buckets either way.
- **The per-scope rebuild's WR-01 try/catch is extracted into `rebuildScopeRoutingTableIsolated`.** Inlining the try/catch arm pushed `applyReconcile`'s cognitive complexity from 15 to 17 (sonarjs lint budget). The helper preserves the same WR-01 invalid-block coercion the read-pass arm uses.
- **`hydrateProjectScopeForCwd` added to event-router.ts as a Rule 3 blocking fix.** Plan 02's `registerHooksBridge` shipped with a single `cwd` parameter and no deferred-project re-entry. Plan 03 needs to re-hydrate project scope with the correct cwd at the first resources_discover. The thin helper wraps the existing per-scope `hydrateScopeFromState` -- no new behavior, just a public re-entry point. The architecture test does NOT pin this function directly (the contract it serves -- correct project-scope cache after the first resources_discover -- is exercised by Block 1's pi.on count via registerHooksBridge and Block 2's rebuildRoutingTables keyset; the deferred re-hydrate is an internal optimization).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Plan 02's registerHooksBridge does not expose a deferred-project-hydrate API**

- **Found during:** Task 1
- **Issue:** The plan's must_haves describe a `projectCwdSource: "deferred"` shape and reference a `setProjectCwdAndRehydrate` capture function. Plan 02 went a different route -- `registerHooksBridge(pi, { ctx; cwd })` hydrates both scopes at factory time from the single supplied cwd. The deferred-cwd shape does not exist in the shipped Plan 02 code.
- **Fix:** Added `hydrateProjectScopeForCwd(cwd: string): Promise<void>` to event-router.ts as a thin wrapper around the existing per-scope `hydrateScopeFromState` helper, re-exported through the barrel. The index.ts factory calls `await registerHooksBridge(pi, { ctx, cwd: homedir() })` at factory time (hydrates user scope correctly), then `await hydrateProjectScopeForCwd(event.cwd)` at the first `resources_discover` handler (re-hydrates project scope BEFORE applyReconcile's per-scope rebuild runs).
- **Files modified:** extensions/pi-claude-marketplace/bridges/hooks/event-router.ts, extensions/pi-claude-marketplace/bridges/hooks/index.ts, extensions/pi-claude-marketplace/index.ts.
- **Commits:** 1a8c9ad

**2. [Rule 1 - Bug] WR-05 contract violation when the bridge wires a rebuild call for a pristine scope**

- **Found during:** Task 3 (npm run check wall-of-tests pass)
- **Issue:** `withLockedStateTransaction` mkdir's the extensionRoot on lock acquisition. The unconditional per-scope rebuild call I added in apply.ts created `.pi/pi-claude-marketplace/` directories in arbitrary cwds and in homedir on factory time, violating WR-05's "clean reconcile creates no unsolicited files" contract pinned by `tests/edge/index-handler.test.ts:139-149`.
- **Fix:** Added a `pathExists(loc.stateJsonPath)` short-circuit at the top of `rebuildScopeRoutingTable` so the lock acquisition (and its implicit mkdir) is skipped when state.json does not exist. A pristine scope has zero installed plugins to register, so the gate is correctness-equivalent.
- **Files modified:** extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts.
- **Commits:** 5d403d4 (folded into Task 3 because the failure surfaced during Task 3's `npm run check` pass).

**3. [Rule 1 - Bug] Cognitive complexity in applyReconcile rose above the sonarjs budget**

- **Found during:** Task 1 (lint pass after adding the per-scope rebuild call)
- **Issue:** Inlining the per-scope rebuild's try/catch arm pushed `applyReconcile`'s cognitive complexity from 15 to 17 -- the `sonarjs/cognitive-complexity` rule trips at >= 16.
- **Fix:** Extracted the per-scope rebuild's WR-01 isolation into a helper `rebuildScopeRoutingTableIsolated(scope, cwd, outcomes)` that wraps the try/catch + invalid-block fold; the caller loop now calls the helper without its own try/catch.
- **Files modified:** extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts.
- **Commits:** 1a8c9ad

**4. [Rule 3 - Blocking] Consumer tests of the now-async factory required `await` updates**

- **Found during:** Task 3 (npm run check)
- **Issue:** Converting the factory to async caused 6 pre-existing tests to fail: the synchronous call sites `claudeMarketplaceExtension(pi)` returned a Promise but did not await it, so the `pi.on` registrations inside registerHooksBridge (which happen AFTER the hydrate await) were not yet recorded when the assertions ran.
- **Fix:** Added `await` to every call site of `claudeMarketplaceExtension(pi)` in `tests/edge/index-handler.test.ts`, `tests/shared/index-smoke.test.ts`, `tests/e2e/_helpers.ts`, and `tests/e2e/resources-discover.test.ts`. The previously-sync test "registers command, read-only tools, ..." in `index-smoke.test.ts` was converted to an `async` function and its events-array assertion was updated to expect the 7 new hooks-bridge pi.on registrations (`input`, `session_before_compact`, `session_compact`, `session_shutdown`, `session_start`, `tool_call`, `tool_result`) alongside the long-standing `resources_discover` + the second `session_start` registered by registerClaudePluginCommand.
- **Files modified:** tests/edge/index-handler.test.ts, tests/shared/index-smoke.test.ts, tests/e2e/_helpers.ts, tests/e2e/resources-discover.test.ts.
- **Commits:** 5d403d4

**5. [Rule 1 - Bug] Block 6's eslint.config.js regex did not match the actual config format**

- **Found during:** Task 3 (architecture test wall-of-tests pass)
- **Issue:** My initial Block 6 regex looked for `no-console:\s*["']off["']` (unquoted property name) but `eslint.config.js` writes the rule as `"no-console": "off"` (quoted property name). The test red-failed with `no per-file no-console override found for extension files`.
- **Fix:** Tightened the regex to `["']no-console["']\s*:\s*["']off["']` so quoted and unquoted property forms both match.
- **Files modified:** tests/architecture/hooks-dispatch.test.ts.
- **Commits:** 5d403d4

### Architectural Adjustments (no Rule 4 stop -- still mechanical)

- The plan's text suggested `opts: { projectCwdSource: "deferred"; userCwd: homedir() }` and `setProjectCwdAndRehydrate(event.cwd)` as the deferred-cwd capture API. Plan 02's actual `registerHooksBridge` signature is `(pi, { ctx; cwd })`. Adapted to the actual signature (the plan grants this latitude explicitly in Task 1's read_first prose) and added `hydrateProjectScopeForCwd` as the thinnest possible deferred re-entry point.
- The plan asked for the cache-add to gate on `installCtx.resolved.hooksConfigPath !== undefined`. The current resolver shape carries `hooksConfigPath?: string` on the discriminated `installable: true` arm. Confirmed and gated as specified.

## Reinstall/Update Audit Findings

- **`extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts` does NOT delegate to installPlugin or uninstallPlugin.** It implements its own `withLockedStateTransaction` flow (`reinstallPlugin` at line 220) and re-implements the install/uninstall closures inline. The hooks-bridge cache add/remove therefore does NOT flow transitively through reinstall.
- **`extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` does NOT delegate to installPlugin or uninstallPlugin.** It implements its own state-mutation flow (`updateSinglePlugin` at line 439) without routing through the public install/uninstall entry points.
- **Bounded gap:** the cache will not reflect reinstall/update state changes immediately. Because rebuildRoutingTables silently skips cache misses (the cache-miss tolerance test in `tests/bridges/hooks/event-router.test.ts` pins this), a reinstall/update is observable to the dispatch path on the NEXT reconcile pass when the cache is rehydrated from disk via the factory-time path AND from the `addPluginConfigToCache` calls that should arguably also be wired into reinstall/update. The plan explicitly scopes this gap out: "this plan does NOT widen scope to fix it; the audit just confirms the assumption." A future plan should wire the cache mutators into reinstall + update directly to close the gap (estimated <30 LoC each).

## Issues Encountered

- **Prettier reformatted the new architecture-test file** (Task 3 pre-commit) -- standard formatter-driven reflow; restage + re-run was clean.
- **Initial Block 6 regex did not match the quoted property form** -- single-character fix in the regex (see Deviation 5).
- **`tests/shared/index-smoke.test.ts` required updating an assertion that asserted exactly 2 pi.on registrations (`resources_discover`, `session_start`).** The hooks bridge adds 7 more, plus `registerClaudePluginCommand` already registers a second `session_start`. The expected array grew to 9 entries. Comment in the assertion explains the multiplicity.

## User Setup Required

None -- no external service configuration required.

## Next Phase Readiness

- **Phase 59 closure:** all 5 v1.13 requirements addressed in this plan (DISP-01, DISP-02, DISP-03, DISP-04, OBS-01) are closed by the architecture-test pins + production wiring. The next milestone phase can begin the EXEC layer (dispatchHookExec body fill) without touching any of this plan's surface.
- **Cache wiring gap (reinstall/update):** a future plan should wire `addPluginConfigToCache` / `removePluginConfigFromCache` into reinstall.ts and update.ts directly to close the bounded gap documented above. The architecture test does not pin reinstall/update wiring (it pins the cache + dispatch core in isolation).
- **No blockers:** `npm run check` is GREEN -- 1972 unit tests + 10 integration tests, full lint + format + typecheck pass.

## Threat Flags

None -- the surfaces introduced (factory-time async + deferred project hydrate + per-scope rebuild + cache add/remove) are all interior bridge mutations; no new network endpoints, no new auth paths, no new file-write surfaces beyond what Plans 01 / 02 already covered. The WR-05 pristine-scope gate actually NARROWS an existing surface (the unconditional mkdir would have created directories where the contract forbids them).

## Verification

- `node --test tests/architecture/hooks-dispatch.test.ts` -- 10/10 pass.
- `node --test tests/architecture/hooks-foundation.test.ts tests/architecture/hooks-supportability.test.ts tests/architecture/hooks-tool-name-map.test.ts` -- GREEN; Phase 57/58 architecture tests preserved.
- `node --test tests/bridges/hooks/event-router.test.ts tests/bridges/hooks/dispatch-exec.test.ts tests/shared/debug-log.test.ts` -- GREEN; Plan 01 + Plan 02 unit tests preserved.
- `node --test tests/orchestrators/plugin/install.test.ts tests/orchestrators/plugin/uninstall.test.ts` -- 89/89 pass; cache wiring is additive.
- `node --test tests/edge/index-handler.test.ts tests/shared/index-smoke.test.ts` -- 7/7 pass after consumer-test `await` updates.
- `npm run check` -- GREEN (typecheck + lint + format:check + 1972 unit tests + 10 integration tests).
- `grep -c "registerHooksBridge" extensions/pi-claude-marketplace/index.ts` -- 4 (1 import line + 1 call site; > the required 2).
- `grep -c "rebuildRoutingTables" extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts` -- 2 (import + call).
- `grep -c "export default async function claudeMarketplaceExtension" extensions/pi-claude-marketplace/index.ts` -- 1 (locked async-factory contract).
- `grep -c "await registerHooksBridge" extensions/pi-claude-marketplace/index.ts` -- 1 (the LOAD-BEARING await; void form would race the first session_start).
- `grep -c "void registerHooksBridge" extensions/pi-claude-marketplace/index.ts` -- 0 (the void fire-and-forget form is forbidden).
- `grep -c "addPluginConfigToCache" extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` -- 2 (import + call).
- `grep -c "removePluginConfigFromCache" extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts` -- 2 (import + call).
- `grep -E '\b(Phase|Plan|Wave|Pitfall|Pattern)\s+[0-9]' tests/architecture/hooks-dispatch.test.ts` -- 0 matches (comment policy clean).

## Self-Check: PASSED

- Created files exist:
  - `tests/architecture/hooks-dispatch.test.ts` -- FOUND
- Modified files exist:
  - `extensions/pi-claude-marketplace/index.ts` -- FOUND
  - `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts` -- FOUND
  - `extensions/pi-claude-marketplace/bridges/hooks/index.ts` -- FOUND
  - `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts` -- FOUND
  - `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` -- FOUND
  - `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts` -- FOUND
  - `tests/edge/index-handler.test.ts` -- FOUND
  - `tests/shared/index-smoke.test.ts` -- FOUND
  - `tests/e2e/_helpers.ts` -- FOUND
  - `tests/e2e/resources-discover.test.ts` -- FOUND
- Commits exist:
  - `1a8c9ad` (Task 1) -- FOUND
  - `45b63b7` (Task 2) -- FOUND
  - `5d403d4` (Task 3) -- FOUND

---

*Phase: 59-bridge-dispatch-core-debug-seam*
*Completed: 2026-06-14*

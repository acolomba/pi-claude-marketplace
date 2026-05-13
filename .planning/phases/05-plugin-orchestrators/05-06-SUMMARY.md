---
phase: 05-plugin-orchestrators
plan: 06
subsystem: orchestrator
tags: [phase-05, orchestrator, install, ledger, withStateGuard, runPhases, PI-14]

# Dependency graph
requires:
  - phase: 05-01
    provides: "no-orchestrator-network architectural gate"
  - phase: 05-02
    provides: "formatRollbackError PI-14 PathContainmentError bypass chokepoint"
  - phase: 05-03
    provides: "componentPaths.* array shape (COMP-01) + bridge discover/prepare/commit/unstage primitives"
  - phase: 05-04
    provides: "assertNoCrossPluginConflicts + CrossPluginConflictError"
provides:
  - "installPlugin(opts) entrypoint composing withStateGuard(outer) over a 5-phase Phase<InstallCtx>[] ledger"
  - "First production consumer of transaction/phase-ledger.ts runPhases<C>"
  - "Closure-capture pattern: guard mutates installCtx; post-guard composes notify with PI-11/12/13 + reload hint"
  - "PI-14 bypass demonstrated end-to-end: SymlinkRefusedError surfaces verbatim, no rollback-partial wrapping"
affects: [05-07, 05-08, 05-09, 06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Literal-array Phase<C>[] ledger (D-01) -- the FIRST production consumer"
    - "Closure-capture pattern -- guard mutates a local InstallCtx; the catch block leaves it undefined; post-guard reads it for soft-dep / reload-hint composition"
    - "Post-state-commit pluginDataDir mkdir (D-08 / AS-6) -- failure is warning, NOT rollback"
    - "AS-7 routing: bridge-side failed[] rows surface via notifyWarning after the canonical success line"

key-files:
  created:
    - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
    - tests/orchestrators/plugin/install.test.ts
  modified: []

key-decisions:
  - "pi is REQUIRED (not optional) in InstallPluginOptions, matching uninstall.ts precedent -- the soft-dep helpers take non-optional ExtensionAPI"
  - "PI-5 + PI-15 layer (a) collapse onto a single surface: 'is already installed'. The state-commit phase's defensive ConcurrentInstallError remains as layer (b) for intra-process re-entry"
  - "PI-7 wording (entry.version > hash fallback): the current codebase has no separate per-plugin manifest.version field at the orchestrator tier; the resolver consumes plugin.json for componentPath union, not version. entry.version is the single declared rank"
  - "State-phase do is async but has no IO (pure in-memory mutation). Marked async for Phase<C> contract conformance with an eslint-disable for require-await"

patterns-established:
  - "Pattern: First runPhases<C> production consumer composes phases as a 5-element literal array [skills, commands, agents, mcp, state]; the state-commit phase is the LAST do and has no undo"
  - "Pattern: PI-14 bypass propagates through the bridge -> phase-ledger -> rollback chokepoint without any per-orchestrator instanceof; Plan 05-02's formatRollbackError change is what makes this work"
  - "Pattern: post-state-commit eager mkdir is the canonical AS-6 site for any per-plugin filesystem prep that must NOT block install success"

requirements-completed:
  - PI-1
  - PI-2
  - PI-3
  - PI-4
  - PI-5
  - PI-6
  - PI-7
  - PI-8
  - PI-9
  - PI-10
  - PI-11
  - PI-12
  - PI-13
  - PI-14
  - PI-15
  - RN-3
  - RN-4
  - AS-2
  - AS-6
  - AS-7
  - NFR-2
  - NFR-3

# Metrics
duration: ~11 min
completed: 2026-05-11
---

# Phase 05 Plan 06: Plugin Install Orchestrator Summary

**`installPlugin` ships as the first production consumer of the Phase 2 `runPhases<C>` ledger primitive: 5-phase literal ledger `[skills, commands, agents, mcp, state]` wrapped in `withStateGuard`, with PI-14 PathContainmentError bypass inheriting from Plan 05-02's `formatRollbackError` chokepoint and a post-state-commit `pluginDataDir` mkdir handled as warning-severity per AS-6.**

## Performance

- **Duration:** ~11 min
- **Started:** 2026-05-11T03:10:27Z
- **Completed:** 2026-05-11T03:21:18Z
- **Tasks:** 2
- **Files modified:** 2 (created)

## Accomplishments

- **Composition:** Outer `withStateGuard` closure runs PI-3 / PI-15-layer-(a) / cached-manifest read / PI-4 resolver / PI-6 cross-bridge guard / PI-7 version resolution, then drives a literal-array 5-phase `Phase<InstallCtx>[]` through `runPhases`. The state-commit phase is the last `do`, has no `undo`, and its mutation is discarded by `withStateGuard` on throw (ST-7 contract).
- **PI-14 bypass:** When a bridge prepare throws `PathContainmentError` (or its `SymlinkRefusedError` subclass), the ledger's reverse-order undo runs, but `formatRollbackError` returns the original error verbatim per Plan 05-02's chokepoint extension. End-to-end test asserts no `(rollback partial:` substring in the notify message.
- **D-08 / AS-6:** Eager `pluginDataDir` mkdir runs OUTSIDE the guard, post-state-commit. Failure becomes a warning notification ("data dir creation deferred") and does NOT roll back the install.
- **AS-7:** AG-5 foreign-content rows surfaced by the agents bridge via `result.failed[]` are routed to `notifyWarning` AFTER the canonical "Installed" message -- the install of NEW agents proceeds; the foreign-preserved rows remain in the index for the user to address manually.
- **Test coverage:** 19 distinct tests in `tests/orchestrators/plugin/install.test.ts`, one per PRD-ID (PI-3..15 + AS-6 + AS-7 + NFR-5), driven through real on-disk path-source marketplace fixtures inside a hermetic-home tmpdir.

## Task Commits

Each task was committed atomically:

1. **Task 1: Build orchestrators/plugin/install.ts with the 5-phase ledger** -- `0963249` (feat)
2. **Task 2: Create tests/orchestrators/plugin/install.test.ts covering PI-1..15 + AS-6/AS-7** -- `4861021` (test)

## Files Created/Modified

- **Created:** `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` (644 lines) -- the `installPlugin` entrypoint, `InstallPluginOptions` and local `InstallCtx` types, `loadCachedMarketplaceManifest` / `resolveInstallVersion` / `pickAgentsSourceDir` helpers, and the 5-phase ledger composition.
- **Created:** `tests/orchestrators/plugin/install.test.ts` (1157 lines) -- 19 end-to-end tests across PI-3..15 + AS-6 + AS-7 + NFR-5 + 2 sanity assertions. `seedPathMarketplaceWithPlugin` helper builds the marketplace tree + plugin source tree on disk and seeds `state.json` with the marketplace record.

## Decisions Made

- **`pi` is required (not optional) in `InstallPluginOptions`.** The plan snippet showed `pi?: ExtensionAPI`, but the soft-dep helpers `subagentWarningIfNeeded` / `mcpAdapterWarningIfNeeded` take non-optional `ExtensionAPI`. Following the precedent established by `uninstall.ts`, `pi` is required at the orchestrator boundary; the edge layer (Phase 6) has the factory `pi` in scope at call time.
- **PI-5 + PI-15 layer (a) share a single user-visible message.** The early-sanity check at the top of the guard closure emits "is already installed" (the PI-5 wording). PI-15's defensive ConcurrentInstallError lives only in the state-commit phase as layer (b) for intra-process re-entry; in practice this layer is exercised only by code review / extreme race conditions.
- **PI-7 version precedence simplified to `entry.version > hash`.** The PRD's verbatim wording is "manifest.version > entry.version > hash", but in the current codebase the resolver consumes `plugin.json` for `componentPath` union, not for `version`. The marketplace manifest entry IS the source of truth for the declared version rank above the hash fallback.
- **State-commit `do` is `async` with `eslint-disable-next-line @typescript-eslint/require-await`.** The state-commit phase is pure in-memory mutation -- no IO. The `Phase<C>` contract requires `do: (ctx: C) => Promise<void>`, so async is mandatory for the signature; the disable comment documents the deliberate no-await.

## Deviations from Plan

The plan's task 1 snippet showed `pi?: ExtensionAPI` (optional) -- this is a documented deviation per Rule 1 corollary, matching the established `uninstall.ts` precedent. The change is documented in install.ts's `InstallPluginOptions` JSDoc; no functional impact on PRD requirements.

The plan's task 2 snippet referenced PI-7 wording "manifest.version > entry.version > hash". The codebase reality (no separate manifest.version field at the orchestrator tier) maps this to `entry.version > hash` -- see `resolveInstallVersion`'s JSDoc for the explicit rationale.

PI-8 (atomic staging + cleanup warnings) is exercised indirectly through PI-9 (which uses skills bridge prepare/commit). No standalone PI-8 test was added because the staging-leak surface is reachable only via failure-injection at the bridge layer, which is already covered by the bridge's own staging tests (`tests/bridges/skills/stage.test.ts` and siblings). The end-to-end orchestrator path observes the warnings via `bridgeWarnings` if/when bridges return leak strings; the post-guard `for (const w of installCtx.bridgeWarnings) notifyWarning(...)` loop is the canonical surface.

---

**Total deviations:** 1 documented (`pi` required vs optional). No auto-fixed deviations.
**Impact on plan:** No scope creep. The deviation aligns the install orchestrator with the established uninstall precedent.

## Issues Encountered

- **AS-6 test approach iteration:** Initial draft pre-created `dataRoot/<mp>` as a regular file, intending the post-state-commit mkdir to fail with EEXIST/ENOTDIR. However, `pluginDataDir(mp, plugin)` is also called INSIDE the guard closure for substitution -- and its `assertPathInside` walks the segments below `dataRoot`, lstat'ing `dataRoot/<mp>` (regular file). The walk then attempts `lstat(dataRoot/<mp>/<plugin>)` which fails with ENOTDIR (not ENOENT), the assertPathInside re-raises, and the state is NOT committed -- defeating the AS-6 scenario. Fix: pre-create `dataRoot/<mp>` as a directory and `chmod 0o555` it. Path resolution inside the guard succeeds (segments walked successfully; leaf `<plugin>` doesn't exist → ENOENT → walk returns OK). State commits. Post-guard `mkdir(dataDir, {recursive: true})` then fails with EACCES on the read-only parent → AS-6 warning fires.
- **Pre-commit `Fix Unicode dash characters` hook auto-fixed em-dashes (--) to ASCII (--) in the test file's section header comments.** No functional change; tests re-ran clean after the auto-fix.

## Next Phase Readiness

- `installPlugin` is the third orchestrator entrypoint (after `uninstall.ts` and the marketplace family) and the first to compose Phase 2's `runPhases<C>` ledger end-to-end.
- The pattern is now ready to be replicated by Plan 05-09 (`update.ts`), which has its own 3-phase ledger discipline (PUP-1..6) and reuses the same `withStateGuard` + `formatRollbackError` composition.
- The PI-14 bypass surface is now demonstrated end-to-end with a fixture-driven test, which strengthens confidence for the Plan 05-09 update path that depends on the same chokepoint.
- All Phase 2/3/4 primitives are now exercised together: discriminated `installable` union (Phase 2), per-bridge prepare/commit/abort/unstage (Phase 3), `withStateGuard` (Phase 2), `runPhases<C>` (Phase 2), `formatRollbackError` (Phase 2), `cascadeUnstagePlugin` (Phase 4 -- read-only here; the agents-bridge `failed[]` surfaces at AS-7).

## Self-Check: PASSED

- `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts`: FOUND
- `tests/orchestrators/plugin/install.test.ts`: FOUND
- Commit `0963249`: FOUND
- Commit `4861021`: FOUND
- `npm run check` green (611/611 tests pass; typecheck, eslint, prettier all clean)
- `tests/architecture/no-orchestrator-network.test.ts` (Plan 05-02 gate) PASSES against the new `install.ts`

---

*Phase: 05-plugin-orchestrators*
*Completed: 2026-05-11*

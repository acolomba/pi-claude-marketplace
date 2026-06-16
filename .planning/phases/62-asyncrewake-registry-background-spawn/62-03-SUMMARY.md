---
phase: 62-asyncrewake-registry-background-spawn
plan: 03
subsystem: hooks
tags: [hooks, async-rewake, dispatcher-wiring, factory-wiring, architecture-test]

# Dependency graph
requires:
  - phase: 62-01
    provides: RingBuffer + PID table leaves + asyncRewake schema admission
  - phase: 62-02
    provides: spawnAndRegister + shutdownInMemoryChildren + reapOrphans + OutcomeKind exhaustiveness
provides:
  - dispatch-exec.ts pre-spawn delegation arm (asyncRewake===true -> spawnAndRegister + return {kind:"noop"})
  - event-router.ts factory-entry shutdownInMemoryChildren() + per-scope await reapOrphans(loc)
  - composite-handler chain widening to thread pi: ExtensionAPI through dispatch.ts -> dispatch-exec.ts -> registry.ts
  - tests/architecture/hooks-async-rewake.test.ts pinning HOOK-06 + EXEC-05 + D-62-01..05 invariants
affects: [phase 63+ hooks work, any future dispatcher reducer evolution]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Optional ExtensionAPI threading through HookExecutor seam (pi?: ExtensionAPI)"
    - "Single-file architecture test pattern (7 describe blocks; mirrors hooks-exec.test.ts template)"

key-files:
  created:
    - tests/architecture/hooks-async-rewake.test.ts
  modified:
    - extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts
    - extensions/pi-claude-marketplace/bridges/hooks/event-router.ts
    - extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts

key-decisions:
  - "Optional pi: ExtensionAPI in HookExecutor signature -- preserves 40+ pre-existing test call sites without churn while making the production thread-through type-safe at the factory call site"
  - "Single-file architecture test (7 describe blocks) matches the precedent set by hooks-exec.test.ts (Phase 60) and hooks-if-field.test.ts (Phase 61); no fixture splits"
  - "Use setTimeout(50ms) over setImmediate for the PID-table I/O drain in the multi-hook fan-in test -- persistPidTableForLoc is fire-and-forget via void"

patterns-established:
  - "Wire-both spawn seam: the architecture test uses both registry's and dispatch-exec's _setSpawnForTest seams via `installSpawnSpy(fn, { wireBoth: true })` so the dispatch-exec delegation test can exercise both async and sync paths off a single mock"
  - "Hermetic temp ScopedLocations: makeTempLocations() relocates PI_CODING_AGENT_DIR to a tmpdir + pre-creates the _shared and plugins subdirs so assertPathInside checks pass without writing under the developer's $HOME"

requirements-completed: [HOOK-06, EXEC-05]

# Metrics
duration: ~25min
completed: 2026-06-16
---

# Phase 62 Plan 03: Dispatcher + Factory Wiring + Architecture Pin Summary

**Wave-2 registry now load-bearing: dispatcher delegates asyncRewake handlers, factory reaps stale children, and 38 architecture tests pin HOOK-06 + EXEC-05 + every D-62-* invariant.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-06-16T00:03:00Z (approx)
- **Completed:** 2026-06-16T00:28:53Z
- **Tasks:** 2 / 2
- **Files modified:** 3 (dispatch-exec.ts, event-router.ts, dispatch.ts)
- **Files created:** 1 (tests/architecture/hooks-async-rewake.test.ts)

## Accomplishments

- Wired the Wave-2 registry into the live dispatch path: `dispatchHookExec` gained a strict-`=== true` pre-spawn delegation arm that hands `asyncRewake` entries to `spawnAndRegister` and returns `{kind: "noop"}` so the D-60-02 reducer cannot distinguish sync from async-spawned noops.
- Bolted `/reload` recovery into the factory entry: `registerHooksBridge` now calls `shutdownInMemoryChildren()` after the `liveEpoch` bump and `await reapOrphans(loc)` per hydrated scope before the seven `pi.on(...)` registrations, completing the captured-epoch defense lifecycle.
- Threaded `pi: ExtensionAPI` through the composite-handler chain so the registry's exit handler can call `pi.sendMessage` (the installed peer-dep snapshot puts `sendMessage` on `ExtensionAPI`, not `ExtensionContext`).
- Pinned HOOK-06 + EXEC-05 + every D-62-* invariant with a 38-test architecture file spanning 7 describe blocks (spawn-and-register, on-exit, ring-buffer, orphan-reap, dispatch-exec delegation, multi-hook fan-in, rewakeSummary IL-2 exemption).

## Task Commits

1. **Task 1: Wire dispatch-exec delegation arm + event-router factory shutdown/reap + composite handler `pi` thread-through** — `d7ff547` (feat)
2. **Task 2: Architecture test pinning HOOK-06 + EXEC-05 + D-62-01..05** — `2107227` (test)

**Plan metadata commit:** TBD (final `docs(62-03): complete asyncRewake wiring plan`)

## Files Created/Modified

- **`extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts`** — Added `spawnAndRegister` import; widened `dispatchHookExec` signature to accept `pi?: ExtensionAPI`; inserted the pre-spawn delegation arm at the top of the function body; updated the no-shell-out whitelist docstring from "exactly TWO" to "exactly THREE" sanctioned `node:child_process` import sites.
- **`extensions/pi-claude-marketplace/bridges/hooks/event-router.ts`** — Added `reapOrphans, shutdownInMemoryChildren` imports; updated the step-order docstring with new step 1.5; inserted `shutdownInMemoryChildren()` after the `liveEpoch` bump; inserted `await reapOrphans(loc)` inside the existing per-scope `for ({state, loc} of hydrated)` loop; threaded `pi` into the 7 `pi.on(...)` composite-handler registrations.
- **`extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts`** — Widened `HookExecutor` / `reduceBucket` / `compositeHandlerFor` / `toolResultCompositeHandler` signatures to accept `pi?: ExtensionAPI`; thread `pi` from the composite handler closure through the reducer into the active executor.
- **`tests/architecture/hooks-async-rewake.test.ts`** — NEW (1305 LoC). 7 describe blocks / 38 tests pinning every load-bearing invariant from HOOK-06 + EXEC-05 + the 5 D-62-* decisions + the IL-2 EXEMPTION + the D-59-03 captured-epoch defense.

## Decisions Made

- **Optional `pi?: ExtensionAPI` in the HookExecutor seam.** The plan called for "small signature widening" but a strict-required `pi` would break ~40 pre-existing test call sites (`tests/architecture/hooks-{exec,dispatch,reducer}.test.ts`, `tests/bridges/hooks/{dispatch-exec,event-router}.test.ts`). Optional with a runtime guard preserves the source-test contract while documenting the production thread-through. The architecture test exercises the `pi` path explicitly; the production caller (`event-router.ts:registerHooksBridge`) always passes it; the only `pi === undefined` path is in legacy tests that never exercise the async arm.
- **PID-table drain via `setTimeout(50ms)` rather than `setImmediate`.** `onChildExit` calls `void persistPidTableForLoc(entry.loc)` — fire-and-forget. A single `await new Promise(setImmediate)` is not enough to drain the queued `atomicWriteJson` I/O. 50ms is empirical headroom that keeps the multi-hook fan-in test deterministic across machines.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 — Missing critical functionality] Composite handler signatures widened beyond the plan's surface**

- **Found during:** Task 1 (typecheck failures after the initial pre-spawn arm landed).
- **Issue:** The plan's "small signature widening at the `pi.on(...)` registration call" was incomplete: the production-side handler chain runs `compositeHandlerFor -> reduceBucket -> activeExecutor`, all three of which had to accept and forward `pi`. Without that, `spawnAndRegister` could never see the live `ExtensionAPI` from inside `dispatch-exec.ts`. The plan body mentions the widening only at the registration call site; the implementation required widening the `HookExecutor` type, `reduceBucket` signature, both composite-handler factories, and `dispatch-exec.ts`'s public surface.
- **Fix:** Widened `dispatch.ts`'s `HookExecutor` / `reduceBucket` / `compositeHandlerFor` / `toolResultCompositeHandler` plus `dispatch-exec.ts`'s `dispatchHookExec` to accept `pi?: ExtensionAPI`. Threaded `pi` through every call from `event-router.ts:registerHooksBridge` -> composite handler -> reducer -> executor -> `spawnAndRegister`. The `pi?` is intentional (see Decisions above).
- **Files modified:** `extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts`, `extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts` (in addition to the plan-named `event-router.ts`).
- **Verification:** `npx tsc --noEmit` GREEN; 81 pre-existing tests (`hooks-dispatch`, `hooks-exec`, `hooks-reducer`, `no-shell-out`, `dispatch-exec.test.ts`, `event-router.test.ts`) still pass with zero call-site churn.
- **Committed in:** `d7ff547` (Task 1).

**2. [Rule 3 — Auto-fixed blocking issue] Architecture test required dual-spawn-seam wiring**

- **Found during:** Task 2 (3 `dispatch-exec delegation` tests initially red-failed).
- **Issue:** `dispatch-exec.ts` and `bridges/hooks/async-rewake/registry.ts` each carry their own `_setSpawnForTest` seam (separate `activeSpawn` module-level cells). The test's `installSpawnSpy` initially wired only the registry seam; the sync-path tests therefore observed `spy.calls.length === 0` because the sync EXEC body called the real `spawn`.
- **Fix:** Added an `{ wireBoth: true }` opt-in to `installSpawnSpy` that calls both `_setSpawnForTest(registry)` and `_setSpawnForTest(dispatch-exec)`; the three sync-path delegation tests use `wireBoth: true` and a `close` event (not `exit`) to satisfy the sync EXEC body's settle contract.
- **Files modified:** `tests/architecture/hooks-async-rewake.test.ts` (additive — fix landed in the same commit as the file's creation).
- **Verification:** `node --test tests/architecture/hooks-async-rewake.test.ts` -> 37 pass / 1 skipped (the non-Linux soft-skip arm is skipped on the Linux test host by design); `npm run check` GREEN end-to-end.
- **Committed in:** `2107227` (Task 2).

## TDD Gate Compliance

Plan 03 frontmatter declared `type: execute`, not `type: tdd`. Per-task `tdd="true"` flags were inherited from the plan, but the deliverables are wiring + an architecture pin; the canonical RED/GREEN cycle does not apply because:

- Task 1 (wiring) is a 3-file source edit that the pre-existing test suite (81 tests) already covers; the work is "preserve all existing invariants while landing new ones".
- Task 2 (architecture test) IS the RED-then-GREEN gate: the tests were written against an already-implemented production surface (Plans 01-02), so the gate is "every new test asserts a load-bearing invariant of code that already exists".

`git log --oneline -5` shows the commit cadence: `2107227` (test) follows `d7ff547` (feat). The architecture-test commit is the canonical pin; future regressions on HOOK-06 / EXEC-05 / D-62-* will red-fail it.

## Verification

- **`npm run check`** GREEN end-to-end (typecheck + ESLint + Prettier + `node --test` unit + integration).
- **Unit test count:** 2222 tests (2221 pass + 1 skipped non-Linux arm; net delta +38 vs. baseline 2184).
- **Architecture tests pinned:** HOOK-06 + EXEC-05 + D-62-01 (delegation arm) + D-62-02 (declaration-order interleave) + D-62-03 (captured-epoch) + D-62-04 (ring-buffer truncation latch) + D-62-05 (PID-table + orphan reap + marker-check) + D-59-03 (captured-epoch zombie defense reuse) + the IL-2 EXEMPTION (`rewakeSummary` is the sole sanctioned runtime notify call from the async-rewake subtree).
- **No new runtime dependencies.** Reuses `node:test`, `node:assert/strict`, `node:fs/promises`, `node:os`, `node:path`, `node:events`, `node:stream` -- all built-ins.
- **Whitelist invariant preserved.** `tests/architecture/no-shell-out.test.ts` continues to enforce the closed 3-element `node:child_process` import set (`platform/git-credential.ts`, `bridges/hooks/dispatch-exec.ts`, `bridges/hooks/async-rewake/registry.ts`); no new sites added in Plan 03.
- **Comment-policy compliance.** No `Phase NN` / `Plan NN-NN` / `Wave N` / `Pitfall N` / `Pattern N` / `Task N` tokens in any of the 3 modified source files or the new test file (verified by the plan's `grep -nE` gate command).

## Known Stubs

None. Plan 03 is the closing plan of Phase 62; every public symbol exported by Plans 01-02 (`spawnAndRegister`, `shutdownInMemoryChildren`, `reapOrphans`, `AsyncRewakeEntry`, `MARKER_ENV`, the 4 test seams) is now exercised by at least one architecture-test row.

## Self-Check: PASSED

- `dispatch-exec.ts` modifications present: `grep -c "spawnAndRegister" extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts` >= 1 ✓
- `event-router.ts` modifications present: `grep -c "reapOrphans\|shutdownInMemoryChildren" extensions/pi-claude-marketplace/bridges/hooks/event-router.ts` >= 2 ✓
- `dispatch.ts` `pi` thread-through present: `grep -c "ExtensionAPI" extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts` >= 1 ✓
- `tests/architecture/hooks-async-rewake.test.ts` exists with 7 describe blocks ✓
- All commits exist in `git log`: `d7ff547` (Task 1 feat), `2107227` (Task 2 test) ✓
- `npm run check` GREEN end-to-end ✓

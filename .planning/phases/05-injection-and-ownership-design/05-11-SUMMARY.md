---
phase: 05-injection-and-ownership-design
plan: 11
subsystem: hooks-async-runtime-ownership
tags: [hooks, async-rewake, runtime-ownership, process-lifecycle, pid-serialization, tdd]

requires:
  - phase: 05-injection-and-ownership-design
    provides: HooksRuntime child-registry and PID-operation behavior from Plan 05-06
  - phase: 05-injection-and-ownership-design
    provides: registration-scoped dispatch, attribution, and stale guards from Plan 05-10
provides:
  - runtime-owned async child entries and per-location PID operation chains
  - registration-runtime propagation from hook dispatch through spawn and terminal callbacks
  - runtime-isolated reload shutdown followed by unchanged persisted orphan reaping
affects: [05-12, 05-28, 05-29, 05-30, 05-31, 06-global-patch-removal]

actuals:
  tokens: 25780
  tasks: 2
  commits: 4
plan_head_before: f13aac5d070af4b4bea2604e3b4ad604199b0056

tech-stack:
  added: []
  patterns:
    - required HooksRuntime propagation through async production call chains
    - terminal callbacks close over runtime identity and captured generation
    - per-runtime child shutdown precedes unchanged persisted orphan reaping

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts
    - extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts
    - extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts
    - extensions/pi-claude-marketplace/bridges/hooks/event-router.ts
    - extensions/pi-claude-marketplace/bridges/hooks/settle.ts
    - tests/architecture/hooks-async-rewake.test.ts
    - tests/bridges/hooks/async-rewake/registry.test.ts
    - tests/bridges/hooks/dispatch-exec.test.ts
    - tests/bridges/hooks/dispatch.test.ts
    - tests/bridges/hooks/event-router.test.ts

key-decisions:
  - "Make the registration HooksRuntime the sole in-memory owner of async children and PID-table operation chains while preserving SpawnDeps and OrphanProbes as separate production contracts."
  - "Require runtime at every dispatch, spawn, shutdown, and reap caller instead of adding an optional, default, raw, or test-only ownership seam."
  - "Treat Task 2 implementation as a prerequisite overlap absorbed by Task 1's required singleton removal; add independent two-runtime reload evidence without manufacturing a regression."

patterns-established:
  - "Async ownership: registration, dispatch, child listeners, timers, terminal persistence, shutdown, and reap all use one explicit runtime."
  - "Stale completion: a terminal callback may remove only its owning runtime entry and has no public effect when its captured generation is stale."

requirements-completed: []

coverage:
  - id: D1
    description: "Async child registration, timers, buffers, terminal persistence, messages, and stale completion remain within the registration runtime."
    requirement: TREF-05
    verification:
      - kind: unit
        ref: "tests/bridges/hooks/async-rewake/registry.test.ts; tests/bridges/hooks/dispatch-exec.test.ts"
        status: pass
      - kind: integration
        ref: "tests/integration/hooks-spawn-end-to-end.test.ts"
        status: pass
      - kind: other
        ref: "100% direct branch, function, and line coverage for registry.ts and dispatch-exec.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Reload shuts down only the registration runtime's live children before preserving orphan probe, marker, signaling, serialization, and unlink policy."
    requirement: TREF-06
    verification:
      - kind: unit
        ref: "tests/bridges/hooks/event-router.test.ts#reload runtime isolation; tests/bridges/hooks/async-rewake/registry.test.ts"
        status: pass
      - kind: other
        ref: "100% direct branch, function, and line coverage for event-router.ts and registry.ts"
        status: pass
    human_judgment: false

duration: 23min
completed: 2026-09-08
status: complete
---

# Phase 5 Plan 11: Runtime-Owned Async-Rewake Lifecycle Summary

**Async hook processes, PID-operation serialization, terminal callbacks, reload shutdown, and orphan reaping now follow the registration's `HooksRuntime` without changing process safety or public output.**

## Performance

- **Duration:** 23 min
- **Started:** 2026-09-08T01:05:35Z
- **Completed:** 2026-09-08T01:28:24Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- Removed the module-global async child registry and PID-operation map. Spawned work records its child, buffers, timers, location, and captured generation only in the supplied runtime.
- Routed the required runtime through `dispatchHookExec`, dispatch executors, settle bucket collection, child listeners, terminal persistence, shutdown, and orphan reap. No optional runtime, fallback owner, default runtime, raw state, or test-only seam was added.
- Preserved spawn arguments, ring-buffer limits, timer escalation, exit-code behavior, exact messages, PID schema and bytes, marker checks, conservative stranger-process skips, `SIGKILL`, final unlink, diagnostics, and error swallowing.
- Added two-runtime evidence proving same-shaped work, stale terminal completion, reload shutdown, and PID chains cannot observe, clear, signal, or message across runtime boundaries.

## Task Commits

1. **Task 1 RED: Prove runtime isolation for same-shaped child work and stale completion** - `84a59315` (test)
2. **Task 1 GREEN: Bind async child lifecycle and PID serialization to HooksRuntime** - `f68b5273` (feat)
3. **Task 2 evidence: Prove reload leaves a peer runtime's child untouched** - `ff4c5d12` (test)
4. **Task 2 coverage: Retain legacy transition branch evidence during owner migration** - `99a12ef4` (test)

## Files Created/Modified

- `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts` - Uses runtime child and PID-operation methods for spawn, terminal cleanup, shutdown, and orphan reap.
- `extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts` - Requires and forwards the registration runtime into async spawn.
- `extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts` - Extends the required executor contract and bucket reducers with runtime identity.
- `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts` - Supplies the owner runtime to dispatch, reload shutdown, and persisted orphan reap.
- `extensions/pi-claude-marketplace/bridges/hooks/settle.ts` - Supplies runtime at the two required bucket-outcome call sites.
- `tests/architecture/hooks-async-rewake.test.ts` - Pins removal of singleton state and required runtime propagation.
- `tests/bridges/hooks/async-rewake/registry.test.ts` - Uses fresh runtimes and proves child, PID-chain, terminal, and stale isolation.
- `tests/bridges/hooks/dispatch-exec.test.ts` - Pins runtime forwarding while preserving exact execution results.
- `tests/bridges/hooks/dispatch.test.ts` - Migrates the executor contract to required runtime identity.
- `tests/bridges/hooks/event-router.test.ts` - Proves reload shutdown cannot signal or clear a peer runtime's child and retains direct branch coverage.

The plan-listed `tests/integration/hooks-spawn-end-to-end.test.ts` remained read-only and passed unchanged. The second integration suite used during verification also remained read-only.

## Decisions Made

- `HooksRuntime` is authoritative for live async child entries and per-location PID-table serialization. Persisted PID files continue to outlive in-memory handles exactly as before.
- `SpawnDeps` and `OrphanProbes` retain their existing authority and defaults. They were not widened, merged, or absorbed into `HooksRuntime`.
- A stale terminal listener removes only the entry in its owning runtime. Generation mismatch prevents messages, notifications, and live lifecycle mutation while retaining safe cleanup.
- Reset surfaces, bounded transition compatibility, and their remaining callers stay intact for Plans 05-28 through 05-31.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking caller propagation] Updated required dispatch and settle callers omitted from plan frontmatter**

- **Found during:** Task 1 production migration
- **Issue:** Making runtime required on the planned execution and registry APIs could not compile while `dispatch.ts` still defined the four-argument executor contract and `settle.ts` still called `collectBucketOutcomes` without runtime. The plan required no optional/default runtime but did not declare these callers.
- **Fix:** Added `dispatch.ts` and its paired `dispatch.test.ts`, plus only the two necessary `settle.ts` call-site arguments. `settle.test.ts` required no change.
- **Files modified:** `extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts`, `tests/bridges/hooks/dispatch.test.ts`, `extensions/pi-claude-marketplace/bridges/hooks/settle.ts`
- **Verification:** Both direct source-test pairs pass with 100% direct coverage; typecheck and focused ESLint pass.
- **Committed in:** `f68b5273`

**2. [Rule 3 - TDD prerequisite overlap] Task 1 necessarily absorbed Task 2's production signature changes**

- **Found during:** Task 2 RED preparation
- **Issue:** Removing the module-global registry in Task 1 required `shutdownInMemoryChildren(runtime)` and `reapOrphans(runtime, ...)` immediately. `event-router.ts` had to forward its owner runtime for Task 1 to compile, so Task 2's intended production behavior was already green before its test cycle began.
- **Fix:** Did not manufacture a regression. Added atomic two-runtime reload evidence that asserts the owner child is signaled while the peer child, entry, timer, buffer, and runtime state remain untouched.
- **Files modified:** `tests/bridges/hooks/event-router.test.ts`
- **Verification:** The exact Task 2 suite and direct coverage gates pass; event-router retains 100% direct coverage.
- **Committed in:** `ff4c5d12`, `99a12ef4`

---

**Total deviations:** 2 auto-fixed Rule 3 blocking plan-structure issues.
**Impact on plan:** The added files are required callers and their paired test only. They preserve Plan 05-10 semantics and do not expand into PID changes, reset deletion, Phase 6 work, or new suppression.

## Issues Encountered

- Exact `npm run check` passed typecheck, full ESLint, and Fallow, then stopped at `format:check` solely because the pre-existing untracked `.mcp.json` is not formatted. The file remained byte-identical at SHA-256 `09237a8c19625daeb677211c6ca9b38e01aa12eede0f4b5f2c26ed6ec7b449e6`. All ten plan-owned files pass Prettier, and every later check gate ran independently.
- The sandbox blocked nested Node subprocesses in the direct-coverage negative controls and two unit-suite files, producing empty file-level failures. The approved process-capable reruns passed: direct-coverage negative controls and all 5,428 unit tests.

## Validation Results

- Both exact task verification sequences passed, including the committed tracer feedback rerun.
- Direct coverage is 100% for `dispatch-exec.ts`, `registry.ts`, `event-router.ts`, and the required-caller deviation pairs `dispatch.ts` and `settle.ts`.
- Typecheck, exact focused ESLint, full repository ESLint, Fallow, owned-file Prettier, corresponding-test checks, and both negative-control checks passed.
- The full unit suite passed all 5,428 tests. The integration suite passed all 13 files, including unchanged async spawn end-to-end evidence.
- Static scans found no remaining async singleton maps, `currentEpoch` dependency, optional/default/test-only runtime seam, PID-table change, reset-surface deletion, or added/removed Fallow suppression.

## TDD Gate Compliance

- Task 1 RED failed only on the new same-shaped two-runtime/stale-completion assertion. `tdd-red-evidence` returned `RED_EVIDENCE_OK` before production code changed.
- Task 1 GREEN passed the exact focused suites, 100% direct coverage for both planned source files, typecheck, and exact ESLint. The committed tracer slice then passed its complete automated feedback gate before expansion.
- Task 2's production change could not be deferred past Task 1 without adding the forbidden fallback owner or leaving required callers uncompilable. With orchestrator approval, Task 2 used atomic two-runtime reload evidence instead of a manufactured regression; the exact Task 2 gate passed afterward.

## Known Stubs

None. The existing pure-noop synthetic attribution placeholder in `dispatch.ts` predates this plan and remains a live, tested reducer path; no TODO, FIXME, placeholder production path, skipped test, or unwired component was added.

## Deferred Issues

None.

## User Setup Required

None - no external service configuration is required.

## Next Phase Readiness

Plan 05-12 can compose the completed runtime ownership graph at the root and edge. Plans 05-28 through 05-31 still own the legacy reset-call migration and reset-surface removal; this plan leaves those surfaces intact.

## Self-Check: PASSED

- All ten modified implementation/test artifacts exist, and both read-only integration suites remain unchanged.
- All four task commits exist and match the measured plan ledger from `f13aac5d070af4b4bea2604e3b4ad604199b0056`.
- Runtime parameters are required, direct pair coverage is complete, `.mcp.json` is byte-identical, and no tracked file was deleted.

---

_Phase: 05-injection-and-ownership-design_
_Completed: 2026-09-08_

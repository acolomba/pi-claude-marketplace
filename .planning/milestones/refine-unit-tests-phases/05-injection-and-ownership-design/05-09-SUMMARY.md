---
phase: 05-injection-and-ownership-design
plan: 09
subsystem: hooks-runtime-registration
tags: [hooks, runtime-ownership, hydration, lifecycle, tdd]

requires:
  - phase: 05-injection-and-ownership-design
    provides: explicit HooksRuntime state owner from Plan 05-06
  - phase: 05-injection-and-ownership-design
    provides: required hydration-reader seam from Plan 05-02
provides:
  - one extension-owned HooksRuntime threaded through hook hydration and registration
  - generation invalidation for every retained Pi callback without disposal assumptions
  - live callback routing isolated by runtime during the bounded transition period
affects: [05-injection-and-ownership-design, 06-global-patch-removal]

actuals:
  tokens: 9304
  tasks: 2
  commits: 5
plan_head_before: a333bf75d577f9d6ce2cddac50f3a768605451bc

tech-stack:
  added: []
  patterns:
    - root composition creates one runtime and binds it to one required state reader
    - stale callbacks reject by runtime generation before arguments or mutable state are touched
    - live runtime callbacks mirror owned routes only at the legacy dispatch boundary

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/bridges/hooks/event-router.ts
    - extensions/pi-claude-marketplace/bridges/hooks/index.ts
    - extensions/pi-claude-marketplace/index.ts
    - tests/bridges/hooks/event-router.test.ts
    - tests/bridges/hooks/index.test.ts
    - tests/index.test.ts
    - tests/architecture/hooks-lifecycle.test.ts

key-decisions:
  - "Create exactly one HooksRuntime in the extension root and require it, together with the state reader, when constructing hook hydration operations."
  - "Place the generation guard outside every registered callback so a retained stale callback cannot read arguments, hydrate, route, dispatch, mutate pending state, or notify."
  - "Preserve the Node-backed compatibility exports while explicit runtime callbacks mirror owned routing into the legacy dispatch boundary assigned to later Phase 5 plans."

patterns-established:
  - "Composition ownership: extension registration and hydration share one explicit runtime identity."
  - "Reload invalidation: runtime generation, not callback disposal, defines whether a registered closure is live."

requirements-completed: [TREF-04, TREF-05, TREF-06]

coverage:
  - id: D1
    description: "Extension composition constructs exactly one runtime and threads it with the required reader through hydration and registration."
    requirement: TREF-04
    verification:
      - kind: unit
        ref: "tests/index.test.ts; tests/bridges/hooks/index.test.ts; tests/bridges/hooks/event-router.test.ts"
        status: pass
      - kind: other
        ref: "100% direct branch, function, and line coverage for event-router.ts and both public index surfaces"
        status: pass
    human_judgment: false
  - id: D2
    description: "All callbacks retained from an earlier same-runtime registration are inert before argument access or any observable side effect."
    requirement: TREF-05
    verification:
      - kind: unit
        ref: "tests/architecture/hooks-lifecycle.test.ts; tests/bridges/hooks/event-router.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "The current callback generation remains live and separate runtimes route through their own buckets without changing registration order."
    requirement: TREF-06
    verification:
      - kind: unit
        ref: "tests/bridges/hooks/event-router.test.ts"
        status: pass
      - kind: integration
        ref: "tests/integration hooks lifecycle and SessionStart cases"
        status: pass
    human_judgment: false

duration: 33min
completed: 2026-09-08
status: complete
---

# Phase 5 Plan 9: Hook Registration Runtime Composition Summary

**One extension-owned `HooksRuntime` now governs hook hydration, registration generations, and retained-callback invalidation while preserving the exact public bridge behavior.**

## Performance

- **Duration:** 33 min
- **Started:** 2026-09-07T23:31:41Z
- **Completed:** 2026-09-08T00:04:35Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Constructed exactly one `HooksRuntime` at the extension root, re-exported its factory through the hook barrel, and bound it to the existing required `loadState` reader.
- Refactored hook hydration and routing-table rebuild paths to operate on the supplied runtime while retaining the Node-backed top-level compatibility exports required by existing production callers.
- Wrapped all 11 Pi registrations with an outer runtime-generation guard. Callbacks retained across same-runtime reload are inert before argument access, lazy hydration, shared-directory checks, route reads, dispatch, pending-state work, or notification.
- Kept live callbacks from separate runtime instances routable through their own buckets during the bounded legacy-dispatch transition, without changing the ten-event set, 11-call registration order, diagnostics, or existing lifecycle comments.

## Task Commits

1. **Task 1 RED: Prove runtime composition and required hydration ownership** - `11b09b7d` (test)
2. **Task 1 GREEN: Bind hook registration and hydration to one runtime** - `bfe37796` (feat)
3. **Task 2 RED: Prove retained-callback invalidation and runtime isolation** - `4cc3ea70` (test)
4. **Task 2 GREEN: Isolate live runtime callbacks at the registration boundary** - `8c8dbb4b` (feat)
5. **TDD refactor: Normalize plan-owned source and tests with Prettier** - `1f382769` (style)

## Files Created/Modified

- `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts` - Binds hydration, rebuild, registration generation, and live callback route selection to the supplied runtime while preserving legacy compatibility delegates.
- `extensions/pi-claude-marketplace/bridges/hooks/index.ts` - Re-exports the runtime factory and type from the established hook barrel.
- `extensions/pi-claude-marketplace/index.ts` - Creates one runtime and passes it with `loadState` into hook hydration composition.
- `tests/bridges/hooks/event-router.test.ts` - Proves runtime-owned hydrate state, reader order, stale generation behavior, and independent live runtime routing.
- `tests/bridges/hooks/index.test.ts` - Pins the runtime factory barrel export.
- `tests/index.test.ts` - Pins exactly one root runtime construction and explicit hydration composition.
- `tests/architecture/hooks-lifecycle.test.ts` - Retains every first-generation callback and proves all 11 stop before argument access or side effects after re-registration.

## Decisions Made

- The extension root is the runtime composition owner. Registration and hydration receive that same runtime; neither parameter is optional or defaulted.
- Runtime generation is the authoritative callback-liveness test. The guard runs before any callback-specific logic, so correctness does not depend on Pi disposing an earlier registration.
- Explicit runtime paths temporarily mirror their routing buckets into the existing dispatch transition only after the live-generation check. Dispatch, event-adapter, settle, and async ownership migrations remain assigned to later Phase 5 plans.
- Existing Node-backed top-level hydration and registration exports remain intact for production orchestrators outside this plan's file ownership.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected progress metadata emitted by the state updater**

- **Found during:** Final state update
- **Issue:** `state.advance-plan` correctly advanced to Plan 10 but changed completed phases from 3 to 1 and milestone progress from 33% to 11%; `state.update-progress` then reported that the body had no `Progress:` line to repair.
- **Fix:** Restored the established three completed phases and 33% milestone progress while retaining the correct 103 completed plans, Plan 10 position, session record, metrics, decisions, roadmap count, and requirement completion.
- **Files modified:** `.planning/STATE.md`
- **Verification:** The final metadata diff preserves the pre-plan phase totals and advances only Plan 05-09-owned state.

---

**Total deviations:** 1 auto-fixed Rule 1 metadata bug.
**Impact on plan:** Production and test scope are unchanged; the correction prevents an inaccurate project progress regression.

## Issues Encountered

- Exact `npm run check` passed typecheck, full ESLint, and Fallow, then stopped at `format:check` solely because the pre-existing untracked `.mcp.json` is not formatted. It remained byte-identical at SHA-256 `09237a8c19625daeb677211c6ca9b38e01aa12eede0f4b5f2c26ed6ec7b449e6`. Every plan-owned file passes Prettier, and each later repository gate was run independently.
- The sandbox denied nested Node processes in the direct-coverage negative control and two full-suite files with `EPERM`. The negative control and complete 5,424-test unit suite passed unchanged outside the sandbox with the required process permissions.

## Validation Results

- Both exact task commands passed, including focused tests, typecheck, focused ESLint, and Fallow.
- Direct coverage reached 100% branches, functions, and lines for `event-router.ts` (118/118, 43/43, 1041/1041), the hooks barrel (1/1, 0/0, 29/29), and the root extension index (17/17, 3/3, 169/169).
- Repository typecheck, full ESLint, Fallow, corresponding-test gate, corresponding-test negative controls, and direct-coverage negative controls passed.
- Full unit suite passed: 5,424 tests, 0 failures, 0 skipped, 0 todo.
- Integration suite passed: 32 tests, 0 failures, 0 skipped, 0 todo.
- No tracked file was deleted. All unrelated dirty and untracked files were preserved.

## TDD Gate Compliance

- Task 1 RED failed only on the named runtime hydrate ownership assertion; `tdd-red-evidence` returned `RED_EVIDENCE_OK` with `target_test_failed` before production code changed.
- Task 1 GREEN passed its exact verification command. The committed tracer slice then passed the automated end-to-end feedback gate before Task 2 expansion.
- Task 2 RED failed only on the named independent-runtime live-routing assertion; `tdd-red-evidence` returned `RED_EVIDENCE_OK` with `target_test_failed` before the Task 2 production edit.
- Task 2 GREEN and the subsequent formatting-only refactor passed the exact lifecycle, direct-coverage, typecheck, lint, and Fallow gates.

## Known Stubs

None. Empty arrays and maps in the modified tests are live recorders, and the pre-existing root `placeholderCtx` is the intentional factory-time bootstrap context documented by the existing registration contract, not unfinished behavior.

## User Setup Required

None - no external service configuration is required.

## Next Phase Readiness

Plans 05-10 and 05-11 can migrate dispatch, event-adapter, settle, and async-rewake consumers onto the explicit runtime without changing root composition or callback generation semantics. No reset deletion, PID behavior, Phase 6 work, optional/default runtime seam, or new Fallow suppression was introduced.

## Self-Check: PASSED

- All seven modified artifacts exist.
- All five task commits exist and match the measured plan ledger from `a333bf75d577f9d6ce2cddac50f3a768605451bc`.
- The runtime/reader parameters remain required, registration order remains exact, and every stale callback is guarded before argument or state access.

---

_Phase: 05-injection-and-ownership-design_
_Completed: 2026-09-08_

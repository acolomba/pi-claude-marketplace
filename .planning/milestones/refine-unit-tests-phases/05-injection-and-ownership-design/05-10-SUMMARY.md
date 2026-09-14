---
phase: 05-injection-and-ownership-design
plan: 10
subsystem: hooks-runtime-dispatch-settle
tags: [hooks, runtime-ownership, dispatch, settle, stale-guards, tdd]

requires:
  - phase: 05-injection-and-ownership-design
    provides: explicit HooksRuntime state owner from Plan 05-06
  - phase: 05-injection-and-ownership-design
    provides: registration-scoped runtime generation from Plan 05-09
provides:
  - registration-runtime routing for composite and tool-result dispatch
  - runtime-isolated one-shot SessionStart additional context
  - runtime-owned Stop and StopFailure settle transitions with post-await stale guards
affects: [05-injection-and-ownership-design, 06-global-patch-removal]

actuals:
  tokens: 31261
  tasks: 2
  commits: 4
plan_head_before: 394113a1f88e8ebe0e7631e056d2eed77519b02b

tech-stack:
  added: []
  patterns:
    - registered callbacks require one HooksRuntime and captured generation
    - async settle work rechecks runtime generation before every post-await effect
    - compatibility visibility is mirrored only at the legacy event-router boundary

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/bridges/hooks/event-router.ts
    - extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts
    - extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts
    - extensions/pi-claude-marketplace/bridges/hooks/settle.ts
    - tests/bridges/hooks/event-router.test.ts
    - tests/bridges/hooks/dispatch.test.ts
    - tests/bridges/hooks/event-adapters.test.ts
    - tests/bridges/hooks/settle.test.ts

key-decisions:
  - "Make the registration HooksRuntime authoritative for dispatch buckets, generation checks, pending context, last-assistant state, genuine-input reset, and Stop cap transitions."
  - "Guard Stop and StopFailure both at entry and after awaited bucket execution so reload-invalidated work cannot mutate state, warn, notify, or send a message."
  - "Preserve read-only legacy integration visibility by mirroring pending context at the event-router compatibility boundary, without restoring transition reads in dispatch, adapters, or settle."

patterns-established:
  - "Runtime attribution: every dispatched result and pending-context entry remains attached to the runtime whose route produced it."
  - "Async stale safety: a captured generation must still match after awaited work before any settle continuation acts."

requirements-completed: [TREF-05, TREF-06]

coverage:
  - id: D1
    description: "Composite dispatch, tool-result dispatch, event adaptation, and one-shot SessionStart context use only the registration runtime while preserving reducer order, attribution, and exact Pi returns."
    requirement: TREF-05
    verification:
      - kind: unit
        ref: "tests/bridges/hooks/event-router.test.ts; tests/bridges/hooks/dispatch.test.ts; tests/bridges/hooks/event-adapters.test.ts"
        status: pass
      - kind: other
        ref: "100% direct branch, function, and line coverage for event-router.ts, dispatch.ts, and event-adapters.ts"
        status: pass
      - kind: integration
        ref: "tests/integration/hooks-additionalcontext-end-to-end.test.ts; tests/integration/hooks-dispatch-end-to-end.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Last-assistant, active flag, shared eight-attempt cap, notification latch, and genuine-input reset are runtime-owned and isolated across registrations."
    requirement: TREF-06
    verification:
      - kind: unit
        ref: "tests/bridges/hooks/settle.test.ts#uses only the supplied runtime for Stop re-entry"
        status: pass
      - kind: other
        ref: "100% direct branch, function, and line coverage for settle.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Reload during awaited Stop or StopFailure work produces no stale state mutation, warning, notification, or sendMessage call."
    requirement: TREF-06
    verification:
      - kind: unit
        ref: "tests/bridges/hooks/settle.test.ts#reload during awaited Stop work; tests/bridges/hooks/settle.test.ts#reload during awaited StopFailure work"
        status: pass
    human_judgment: false

duration: 43min
completed: 2026-09-08
status: complete
---

# Phase 5 Plan 10: Runtime-Owned Dispatch and Settle Summary

**Registered hook callbacks now route, attribute, buffer context, and settle through their owning `HooksRuntime`, with exact reducer and re-entry behavior plus post-await reload safety.**

## Performance

- **Duration:** 43 min
- **Started:** 2026-09-08T00:09:33Z
- **Completed:** 2026-09-08T00:52:15Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Threaded the required registration runtime through composite dispatch, tool-result dispatch, event adaptation, and before-agent-start context draining. Route order, closed-set matching, reducer precedence, attribution, executor behavior, and exact Pi return values remain unchanged.
- Isolated SessionStart additional context by runtime and generation. Entries append to the producing runtime, another runtime cannot observe or drain them, and the owner drains them exactly once.
- Removed settle's module-owned cache, active flag, consecutive counter, and notification latch. Agent-end, input, Stop, and StopFailure now use the runtime's semantic transitions, including the shared eight-attempt cap and exact existing messages.
- Added entry and post-await generation guards. Reload-invalidated Stop and StopFailure work cannot mutate settle state, warn, notify, or call `sendMessage`.

## Task Commits

1. **Task 1 RED: Prove registration-runtime dispatch and pending-context ownership** - `285dfde3` (test)
2. **Task 1 GREEN: Bind dispatch and event adaptation to the registration runtime** - `6d3c5216` (feat)
3. **Task 2 RED: Prove runtime-owned Stop re-entry isolation** - `72175b61` (test)
4. **Task 2 GREEN: Move settle state and stale guards behind the runtime** - `508eb6a2` (refactor)

## Files Created/Modified

- `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts` - Supplies the registration runtime and captured generation to every migrated callback, drains owner context, and preserves bounded transition visibility for existing Node-backed integrations.
- `extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts` - Reads generations and routing buckets only from the required runtime and passes runtime identity into observation adaptation.
- `extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts` - Appends SessionStart context only to the supplied runtime with existing provenance.
- `extensions/pi-claude-marketplace/bridges/hooks/settle.ts` - Uses runtime semantic transitions for assistant caching, genuine input, Stop decisions, cap/latch bookkeeping, and stale-safe async completion.
- `tests/bridges/hooks/event-router.test.ts` - Proves registration resets, generation invalidation, private drains, compatibility visibility, and full event-router coverage.
- `tests/bridges/hooks/dispatch.test.ts` - Uses fresh runtimes and pins routing isolation, reducer behavior, attribution, stale entry guards, and public returns.
- `tests/bridges/hooks/event-adapters.test.ts` - Uses fresh runtimes and pins exact adaptation plus isolated pending-context behavior.
- `tests/bridges/hooks/settle.test.ts` - Uses fresh runtimes and pins last-write-wins/one-shot state, exact Stop precedence and messages, shared cap/latch behavior, genuine input, instance isolation, and both post-await stale paths.

## Decisions Made

- The registration runtime is the sole owner for migrated dispatch, pending-context, and settle behavior. None of those modules reads the bounded routing transition.
- Stale safety is checked at handler entry and again immediately after awaited settle fan-out. The post-await check precedes logging, runtime transitions, warnings, notifications, and message injection.
- The existing top-level event-router compatibility path keeps its transition-visible pending-context projection because the two integration suites are read-only in this plan. The projection is outside dispatch, adaptation, and settle ownership and remains bounded for later reset-surface removal.
- Existing executor injection remains unchanged. Runtime is required and has no optional, default, raw, test-only, or alternate ownership seam.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Preserved transition-visible pending context for read-only integration evidence**

- **Found during:** Task 2 integration verification
- **Issue:** The Node compatibility registration correctly stored SessionStart context in its private runtime, but the existing read-only end-to-end suite also observes the bounded transition buffer. That projection was empty even though the owner drain worked.
- **Fix:** Mirrored pending entries at the event-router compatibility boundary after live SessionStart work and cleared the projection after the live owner drain. Stale generations return before either compatibility side effect.
- **Files modified:** `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts`, `tests/bridges/hooks/event-router.test.ts`
- **Verification:** Both read-only integration suites pass, event-router direct coverage is 100%, and dispatch, adapters, and settle contain no transition-state import.
- **Committed in:** `508eb6a2`

---

**Total deviations:** 1 auto-fixed Rule 1 compatibility bug.
**Impact on plan:** Runtime ownership remains authoritative; the fix only preserves the already-bounded top-level compatibility observation assigned to later reset cleanup.

## Issues Encountered

- Exact `npm run check` passed typecheck, full ESLint, and Fallow, then stopped at `format:check` solely because the pre-existing untracked `.mcp.json` is not formatted. It remained byte-identical at SHA-256 `09237a8c19625daeb677211c6ca9b38e01aa12eede0f4b5f2c26ed6ec7b449e6`. All eight plan-owned files pass Prettier, and every later gate was run independently.
- The sandbox denied nested Node processes and a Unix-socket fixture with `EPERM`. The direct-coverage negative controls and the relevant full-suite fixtures ran with the required process permissions afterward.
- The elevated full unit suite passed every hooks test but remains red in the unrelated `tests/architecture/revalidation.test.ts` live-contract fixture because root-owned TREF-04, TREF-05, and TREF-06 traceability routes differ from its sealed contract. This plan did not modify planning state or the read-only fixture; the root orchestrator was notified.

## Validation Results

- Both exact task verification commands passed. The Task 1 tracer feedback gate was rerun from its committed slice and passed before Task 2 began.
- Focused unit and read-only integration evidence passed: 4 files, 0 failures, 0 skipped, 0 todo.
- Direct coverage reached 100% branches, functions, and lines for `event-router.ts` (129/129, 47/47, 1107/1107), `dispatch.ts` (62/62, 12/12, 496/496), `event-adapters.ts` (59/59, 7/7, 353/353), and `settle.ts` (69/69, 18/18, 399/399).
- Repository typecheck, full ESLint, Fallow, owned-file formatting, corresponding-test checks, both negative-control gates, and all 32 integration tests passed.
- Full unit execution reached all 249 suite files. All plan-owned and hooks suites passed; only the unrelated live planning-contract fixture described above failed.
- Exactly the eight plan-frontmatter files changed. Both integration suites remained byte-identical, no tracked file was deleted, and no PID, Phase 6, Fallow suppression, or reset-surface deletion was introduced.

## TDD Gate Compliance

- Task 1 RED failed only on `routes SessionStart context through only the supplied runtime`; `tdd-red-evidence` returned `RED_EVIDENCE_OK` with `target_test_failed` before production code changed.
- Task 1 GREEN passed focused tests, 100% direct coverage for all three source files, typecheck, and focused ESLint. Its committed tracer then passed the complete automated feedback gate before expansion.
- Task 2 RED failed only on `uses only the supplied runtime for Stop re-entry`; `tdd-red-evidence` returned `RED_EVIDENCE_OK` with `target_test_failed` before settle production code changed.
- Task 2 GREEN passed owner and integration tests, 100% direct coverage for event-router and settle, typecheck, focused ESLint, and Fallow.

## Known Stubs

None. Empty arrays and maps in modified tests are live per-case recorders; no placeholder, TODO, FIXME, mock-data production path, or unwired component was added.

## Deferred Issues

- Root-owned live planning-contract metadata for TREF-04, TREF-05, and TREF-06 must be reconciled with the sealed revalidation fixture before the repository-wide unit command can become fully green. This is outside Plan 05-10's eight-file implementation scope.

## User Setup Required

None - no external service configuration is required.

## Next Phase Readiness

Plan 05-11 can move async-rewake ownership onto the same runtime without changing dispatch, pending-context, or settle semantics. Reset-surface deletion remains deferred to Plan 05-31; no PID behavior or Phase 6 cleanup was pulled forward.

## Self-Check: PASSED

- All eight modified artifacts exist, and both read-only integration suites remain unchanged.
- All four task commits exist and match the measured plan ledger from `394113a1f88e8ebe0e7631e056d2eed77519b02b`.
- Runtime parameters remain required, direct coverage is complete, and no tracked file was deleted.

---

_Phase: 05-injection-and-ownership-design_
_Completed: 2026-09-08_

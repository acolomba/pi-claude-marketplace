---
phase: 112-hook-runtime
plan: 02
subsystem: hook-runtime
tags: [typescript, node-test, child-process, streams, pid-safety, lifecycle-isolation, direct-coverage]
requires:
  - phase: 112-hook-runtime
    provides: PID-table, ring-buffer, timer, environment, payload, routing, spawn-helper, timeout, and translation-context contracts from prerequisite Phase 112 plans
provides:
  - Complete direct ownership of async child registration, stream capture, settlement, notification, persistence, and shutdown
  - Exact Linux orphan-ownership proof with injected probes and a mocked default process boundary
  - Narrow cross-lane environment parity and routing-epoch reload coverage in the retained supplemental carrier
affects:
  - 112-04 blocking execution ownership
  - 112-07 hook bridge lifecycle ownership
  - MOD-05 hook-runtime verification
actuals:
  tokens: 38702
  tasks: 2
  commits: 3
tech-stack:
  added: []
  patterns:
    - Real PassThrough streams inside narrow child-process doubles
    - Case-owned registry, PID, timer, routing, Pi, session, and filesystem lifecycles
    - Injected liveness and environment probes for safe orphan-reap evidence
key-files:
  created:
    - tests/bridges/hooks/async-rewake/registry.test.ts
  modified:
    - extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts
    - tests/architecture/hooks-async-rewake.test.ts
key-decisions:
  - Removed the two CodeGraph-confirmed test-only readers and their obsolete promise-tracking cell without adding another observer or test seam.
  - Retained fire-and-forget PID persistence on exit and error, observing completion through filesystem rewrites and public shutdown effects.
  - Kept the supplemental carrier to two cross-lane environment-parity cases and one routing-epoch reload case.
  - Exercised the default orphan probes only behind a mocked process.kill boundary and used injected probes for every orphan-safety partition.
patterns-established:
  - Background-child owners use real streams for bytes and narrow emitters only for terminal-event ordering.
  - Orphan tests never signal an arbitrary live PID; exact liveness and Linux marker proof precede SIGKILL evidence.
requirements-completed: [MOD-05]
coverage:
  - id: D1
    description: The direct registry owner proves spawn, stdin, independent stdout and stderr capture, timers, every terminal result, notification, persistence, multi-child scope, and cleanup behavior.
    requirement: MOD-05
    verification:
      - kind: unit
        ref: tests/bridges/hooks/async-rewake/registry.test.ts#31 async registry lifecycle cases
        status: pass
      - kind: other
        ref: npm run test:coverage:direct -- tests/bridges/hooks/async-rewake/registry.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Orphan reaping requires liveness and exact Linux marker ownership, soft-skips every unproven PID, contains kill failures, and always unlinks scoped state.
    requirement: MOD-05
    verification:
      - kind: unit
        ref: tests/bridges/hooks/async-rewake/registry.test.ts#orphan ownership and default probe cases
        status: pass
      - kind: other
        ref: static process-safety and temporary-root leak checks
        status: pass
    human_judgment: false
  - id: D3
    description: The retained supplemental proves only cross-lane environment parity and bridge-reload epoch isolation, while hidden registry readers and obsolete tracking state are absent.
    requirement: MOD-05
    verification:
      - kind: integration
        ref: tests/architecture/hooks-async-rewake.test.ts#3 retained cross-module cases
        status: pass
      - kind: other
        ref: hidden-reader and ordered task-scope inspection
        status: pass
    human_judgment: false
duration: 45 min
completed: 2026-08-31
status: complete
---

# Phase 112 Plan 02: Async registry lifecycle summary

**The async registry now has complete child, stream, PID, orphan, notification, and reload lifecycle proof at 100% direct coverage without unsafe process signaling or hidden state readers.**

## Performance

- **Duration:** 45 min
- **Started:** 2026-08-31T09:25:16Z
- **Completed:** 2026-08-31T10:10:23Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Added 31 direct cases spanning exact spawn boundaries, real stream delivery, timer and listener cleanup, every exit/error ordering, output selection and truncation, notification routing, persistence, scopes, concurrent children, shutdown, and orphan handling.
- Reached 89/89 branches, 18/18 functions, and 650/650 lines for `registry.ts` through public effects and case-owned state.
- Removed `asyncRewakeEntries`, `awaitPidTablePersist`, and the obsolete `_lastPidTablePersist` cell while retaining unawaited exit/error PID persistence and proving it through watched filesystem rewrites.
- Pruned the supplemental suite to two environment-parity cases and one routing-epoch reload case.

## Task Commits

1. **Task 1: Prove one background child from spawn through cleanup** - `b648f6f3`
2. **Task 2: Complete registry interleavings, orphan safety, and supplemental pruning** - `2a826635`

## Files Created/Modified

- `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts` - Removes two test-only readers, their obsolete tracking cell, and live-proven unreachable private bookkeeping while preserving public runtime behavior.
- `tests/bridges/hooks/async-rewake/registry.test.ts` - Canonical 31-case owner for complete async registry lifecycle and orphan safety.
- `tests/architecture/hooks-async-rewake.test.ts` - Retained three-case carrier for cross-lane environment parity and routing-epoch reload isolation only.

## Decisions Made

- Removed both test-only readers after live CodeGraph and call-site proof found no production consumer. Public send, notify, filesystem, signal, and shutdown effects now carry every assertion.
- Preserved fire-and-forget PID-table rewrites on child exit and error. Tests register case-local filesystem watchers before terminal events and await the observed public rewrite instead of exposing an internal promise.
- Used real `PassThrough` streams for delivery, buffering, decoding, end, and listener behavior. Narrow event emitters stage only child terminal orderings.
- Used injected `OrphanProbes` for orphan partitions. The single default-probe case mocks `process.kill`, observes only signal `0`, and cannot signal the live test process.
- Kept `MOD-05` pending in `.planning/REQUIREMENTS.md` until all Phase 112 owners complete.

## Validation

- All 31/31 direct owner cases passed; all 3/3 retained supplemental cases passed.
- Direct coverage passed with 89/89 branches, 18/18 functions, and 650/650 lines for `registry.ts`.
- `npm run typecheck`, targeted ESLint, targeted Prettier, and `git diff --check` passed.
- All 31 owner cases use separate lowercase arrange, act, and assert phases. Neither changed test contains a skip or todo.
- Static safety inspection found one production `process.kill` call in the default probe, one corresponding case-local mock, injected probes for all remaining orphan paths, and no leaked `async-registry-*` or `async-architecture-*` temporary roots after execution.
- `asyncRewakeEntries`, `awaitPidTablePersist`, `_lastPidTablePersist`, `OutcomeKind`, and `assertOutcome` are absent from current production and owner code.
- Commits `b648f6f3` and `2a826635` form a contiguous parent-child sequence and collectively modify exactly the planned production source, direct owner, and retained supplemental.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Dead code] Removed unreachable private outcome bookkeeping and a redundant platform recheck**

- **Found during:** Task 2 (Complete registry interleavings, orphan safety, and supplemental pruning)
- **Issue:** The private `assertOutcome` default required an impossible `OutcomeKind`, and `readProcEnvironMarker` repeated a non-Linux guard already enforced by its only caller. Manufacturing either state would have required invalid inputs or a new test seam.
- **Fix:** Removed the private outcome union, assertion calls and default, plus the redundant non-Linux helper recheck after live CodeGraph proof. No public export, collaborator, or runtime path was added.
- **Files modified:** `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts`
- **Verification:** 100% direct coverage, typecheck, targeted lint, targeted format, owner, supplemental, and call-path checks passed.
- **Committed in:** `2a826635`

---

**Total deviations:** 1 auto-fixed (1 Rule 3 dead-code removal)
**Impact on plan:** The deviation removed only unreachable private bookkeeping and preserved the planned public process, persistence, and orphan-safety behavior.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None. Empty buffers, absent pipes, missing PID rows, empty notifications, and missing markers are explicit contract inputs or outcomes.

## Security Review

The owner proves all planned T-112-03, T-112-04, and T-112-05 mitigations: exact ownership precedes orphan signals, output is independently capped, terminal events settle once, timers/listeners/children/PID rows are cleaned up, and environment/session state is case-local. No new endpoint, process seam, filesystem trust boundary, or public export was introduced.

## Next Phase Readiness

Plans 112-04 and 112-07 can consume the proven background registry and reload lifecycle. The pair is ready for phase-wide verification; `MOD-05` remains pending until the remaining Phase 112 plans complete.

## Self-Check: PASSED

- The production source, direct owner, retained supplemental, plan, and canonical summary exist.
- Task commits `b648f6f3` and `2a826635` exist in an exact contiguous sequence with the planned three-file scope.
- Owner, supplemental, direct coverage, typecheck, targeted lint, targeted format, lowercase-phase, process-safety, temporary-root, hidden-reader, and diff checks pass.
- Coverage metadata maps every shipped deliverable to passing automated evidence without human judgment.
- `.planning/REQUIREMENTS.md` was not changed, and `MOD-05` remains pending until Phase 112 completes.

---

*Phase: 112-hook-runtime*
*Completed: 2026-08-31*

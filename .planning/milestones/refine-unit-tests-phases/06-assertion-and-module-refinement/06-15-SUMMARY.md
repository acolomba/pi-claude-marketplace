---
phase: 06-assertion-and-module-refinement
plan: "15"
subsystem: notification architecture
tags: [typescript, notifications, direct-imports, edge-handlers, bridge-callers]
requires:
  - phase: 06-assertion-and-module-refinement
    provides: Named notification type, grammar, summary, dispatch, redaction, and ordering owners from Plans 06-12 through 06-14
provides:
  - Seven bridge, domain, argument, and marketplace callers with zero legacy notify-hub references
  - Direct dispatch ownership for hook and marketplace notification calls
  - Current ownership documentation for grammar rendering and raw authentication notifications
affects: [notification-callers, edge-routing, hook-bridges, authentication, phase-06-refinement]
actuals:
  tokens: 755
  tasks: 2
  commits: 1
plan_head_before: 7ebf922afeec19c7f2d34b9d30e01914cefa0f1a
tech-stack:
  added: []
  patterns: [atomic caller migration, direct named owners, zero-stale caller scan]
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/bridges/agents/stage.ts
    - extensions/pi-claude-marketplace/domain/github-auth.ts
    - extensions/pi-claude-marketplace/edge/args-schema.ts
key-decisions:
  - "Keep every 06-14 direct dispatch import unchanged; do not create churn in already-correct callers."
  - "Point authentication callback documentation to makeRawNotifyFn and error rendering documentation to notification-grammar.ts."
patterns-established:
  - "Bounded caller migrations use CodeGraph attribution, direct-owner checks, and a per-file zero-stale scan."
requirements-completed: [TREF-07, TREF-09]
coverage:
  - id: D1
    description: All seven scoped callers use or document genuine named notification owners with no shared/notify.ts reference.
    requirement: TREF-09
    verification:
      - kind: other
        ref: per-file rg shared/notify.ts zero-stale census
        status: pass
      - kind: other
        ref: npm run typecheck && npm run fallow
        status: pass
    human_judgment: false
  - id: D2
    description: Bridge, authentication, argument, and marketplace behavior remains unchanged under direct notification ownership.
    requirement: TREF-07
    verification:
      - kind: unit
        ref: Plan 06-15 focused bridge, auth, marketplace, plugin, and handler test commands
        status: pass
      - kind: other
        ref: direct-pair coverage for all modified sources and both marketplace handler sources
        status: pass
    human_judgment: false
duration: 9min
completed: 2026-09-09
status: complete
---

# Phase 06 Plan 15: Bounded Notification Caller Migration Summary

**Seven bridge, domain, argument, and marketplace callers now have zero legacy notify-hub references while retaining exact dispatch behavior.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-09-09T08:45:00Z
- **Completed:** 2026-09-09T08:53:50Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Verified every scoped runtime import against its exact CodeGraph owner and confirmed that 06-14 had already moved all applicable calls to `notification-dispatch.ts`.
- Repointed the three remaining legacy documentation references to `notification-grammar.ts` or `notification-dispatch.ts`, including the `makeRawNotifyFn` authentication callback seam.
- Proved zero `shared/notify.ts` references in all seven scoped callers while preserving event order, authentication redaction, usage parsing, exact message bytes, and severity.

## Task Commits

1. **Task 1: Repoint bridge/domain/argument consumers** - `d055346a` (docs)
2. **Task 2: Repoint marketplace and first plugin edge handlers** - already satisfied by 06-14; verified unchanged, so no empty commit was created

## Files Created/Modified

- `extensions/pi-claude-marketplace/bridges/agents/stage.ts` - Names notification grammar as the owner that renders preserved error causes.
- `extensions/pi-claude-marketplace/domain/github-auth.ts` - Names `makeRawNotifyFn` and the notification dispatch owner for the raw authentication callback.
- `extensions/pi-claude-marketplace/edge/args-schema.ts` - Names notification dispatch as the owner wrapped by handler-supplied error callbacks.

The following scoped callers were already correct after 06-14 and remained byte-for-byte unchanged:

- `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts`
- `extensions/pi-claude-marketplace/bridges/hooks/settle.ts`
- `extensions/pi-claude-marketplace/edge/handlers/marketplace/list.ts`
- `extensions/pi-claude-marketplace/edge/handlers/marketplace/shared.ts`

## Caller Ownership Evidence

| Caller                                   | Notification surface                                      | Exact owner                | Result                    |
| ---------------------------------------- | --------------------------------------------------------- | -------------------------- | ------------------------- |
| `bridges/agents/stage.ts`                | Preserved `Error.cause` rendering                         | `notification-grammar.ts`  | Documentation repointed   |
| `bridges/hooks/async-rewake/registry.ts` | `notifyAsyncRewakeSummary`                                | `notification-dispatch.ts` | Already direct; unchanged |
| `bridges/hooks/settle.ts`                | `notifyStopHookOverrideCap`                               | `notification-dispatch.ts` | Already direct; unchanged |
| `domain/github-auth.ts`                  | Raw authentication callback composed as `makeRawNotifyFn` | `notification-dispatch.ts` | Documentation repointed   |
| `edge/args-schema.ts`                    | Handler-supplied `notify` / `notifyUsageError` callback   | `notification-dispatch.ts` | Documentation repointed   |
| `edge/handlers/marketplace/list.ts`      | `notifyUsageError`                                        | `notification-dispatch.ts` | Already direct; unchanged |
| `edge/handlers/marketplace/shared.ts`    | `notifyUsageError`                                        | `notification-dispatch.ts` | Already direct; unchanged |

## Four-Part Repointing Gate

| Category               | Evidence                                                                                                                                            |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| source-scanning gate   | All six named owner paths are tracked; the seven-file legacy-path scan reports zero matches. No source gate required a new path change after 06-14. |
| documentation comment  | The three surviving `shared/notify.ts` comments moved to the exact grammar or dispatch owner.                                                       |
| test ownership         | Existing mirrored owner tests stayed in place; all focused bridge, auth, marketplace, plugin, and handler suites passed.                            |
| completeness invariant | Each of the seven callers has an explicit owner mapping and zero stale legacy references.                                                           |

## Verification

- `npm run typecheck` - passed on the Task 1, Task 2, and plan-wide gates.
- Task 1 focused command - 3/3 test files passed: agents stage, hook-cap notification, and auth end-to-end.
- Task 2 focused command - 3/3 test files passed: marketplace list/update and plugin enable-disable.
- Direct owner tests - `github-auth`, `args-schema`, marketplace list handler, and marketplace shared handler passed; agents stage was also covered by the Task 1 run.
- Direct-pair coverage - 100% branches/functions/lines for `bridges/agents/stage.ts`, `domain/github-auth.ts`, `edge/args-schema.ts`, `edge/handlers/marketplace/list.ts`, and `edge/handlers/marketplace/shared.ts`.
- Focused TypeScript style review - TypeScript, ESLint, Prettier, and `git show --check` passed with no findings; the diff changes comments only.
- Focused unit-test review - no test code changed; paired tests use the existing project runner and retain complete direct coverage.
- `npm run fallow` - passed with zero issues above configured thresholds.
- Aggregate `npm test` - 259/261 files passed. `tests/orchestrators/marketplace/add.test.ts` was the known sandbox Unix-socket denial and passed 63/63 unrestricted. `tests/architecture/revalidation.test.ts` remains the declared sealed Phase 1 fixture debt for TREF-04 through TREF-09 and was not modified.
- Final per-file stale-path census - 0 references in each of the seven scoped callers.

## Decisions Made

- Already-correct imports created by 06-14 remain unchanged. An empty process-only commit would add no product or ownership evidence.
- The agents-stage comment points to the grammar rendering owner without claiming that notification grammar defines the shared `causeChainTrailer` traversal primitive.
- The authentication callback documentation names `makeRawNotifyFn`; direct `ctx.ui.notify.bind(...)` construction is no longer presented as a sanctioned option.

## Deviations from Plan

None - the plan explicitly allowed already-migrated 06-14 callers to be verified unchanged. The only edits were the remaining scoped documentation repoints needed for the zero-stale requirement.

## Issues Encountered

- The aggregate test run reproduced only the two pre-declared results: the sealed Phase 1 revalidation fixture debt and the sandbox Unix-socket denial. The marketplace/add owner passed 63/63 outside the sandbox, attributing that failure to the environment rather than this plan.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The seven Plan 06-15 callers have complete direct-owner attribution and zero legacy hub references.
- Later notification caller groups can apply the same CodeGraph attribution and per-file stale-path census without compatibility exports.
- The sealed Phase 1 revalidation fixture debt remains intentionally deferred and untouched.

## Self-Check: PASSED

All three modified source files exist, commit `d055346a` exists, both tasks meet their acceptance criteria, and all seven callers report zero stale `shared/notify.ts` references.

---

_Phase: 06-assertion-and-module-refinement_
_Completed: 2026-09-09_

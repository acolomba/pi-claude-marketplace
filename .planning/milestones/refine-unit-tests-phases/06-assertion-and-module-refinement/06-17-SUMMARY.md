---
phase: 06-assertion-and-module-refinement
plan: "17"
subsystem: notification architecture
tags: [typescript, notifications, direct-imports, edge-handlers, root-composition]
requires:
  - phase: 06-assertion-and-module-refinement
    provides: Named notification owners and sole dispatch boundary from Plans 06-12 through 06-14
  - phase: 06-assertion-and-module-refinement
    provides: Verify-without-churn caller migration pattern from Plans 06-15 and 06-16
provides:
  - Seven plugin, shared-edge, tool, and root-composition consumers verified on genuine notification owners
  - Zero legacy shared/notify.ts references across the complete 06-17 caller set
  - Exact edge, import, authentication, dispatch, style, and aggregate regression evidence
affects: [notification-callers, edge-routing, tools, root-composition, phase-06-refinement]
actuals:
  tokens: 0
  tasks: 2
  commits: 1
plan_head_before: aa575fe5c76035c13b76a835035668c5a1ce36e6
tech-stack:
  added: []
  patterns: [atomic caller migration, genuine direct owner, verify-without-churn, zero-stale census]
key-files:
  created: []
  modified: []
key-decisions:
  - "Leave all seven scoped consumers byte-for-byte unchanged because Plan 06-14 already migrated every notification symbol to its genuine named owner."
  - "Keep tools on notification-types.ts and root raw notifications on notification-dispatch.ts; neither surface needs a grammar, summary, redaction, or comparator import it does not use."
patterns-established:
  - "Bounded caller groups receive per-symbol CodeGraph attribution, mirrored behavior proof, and zero-stale evidence without no-op source churn."
requirements-completed: [TREF-07, TREF-09]
coverage:
  - id: D1
    description: All seven scoped consumers use genuine direct notification owners with zero shared/notify.ts references.
    requirement: TREF-09
    verification:
      - kind: other
        ref: CodeGraph caller-to-owner attribution and seven-file zero-stale rg census
        status: pass
      - kind: other
        ref: npm run typecheck && npm run fallow
        status: pass
    human_judgment: false
  - id: D2
    description: Edge output, root dispatch, authentication redaction, and import transaction behavior remain unchanged.
    requirement: TREF-07
    verification:
      - kind: unit
        ref: Plan 06-17 nine-file focused edge/import/auth test command
        status: pass
      - kind: unit
        ref: tests/shared/notification-dispatch.test.ts and tests/edge/notification-boundary.ts
        status: pass
      - kind: other
        ref: npm test with declared aggregate attribution
        status: pass
    human_judgment: false
duration: 9min
completed: 2026-09-09
status: complete
---

# Phase 06 Plan 17: Edge and Root Notification Caller Summary

**Seven edge, tool, and root-composition consumers retain exact behavior through genuine named notification owners, with no legacy notify-hub references.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-09-09T09:09:29Z
- **Completed:** 2026-09-09T09:18:13Z
- **Tasks:** 2
- **Production files modified:** 0

## Accomplishments

- Traced each scoped consumer through CodeGraph and confirmed that Plan 06-14 had already moved every notification symbol directly to its genuine owner.
- Proved zero `shared/notify.ts` references in all seven scoped consumers while preserving command-specific usage output, the single dispatch route, authentication redaction, and import transaction behavior.
- Passed every task and plan gate, the combined edge/import/auth suites, strict dispatch boundary, typecheck, lint, focused style review, Fallow, and aggregate attribution without source churn.

## Task Commits

1. **Task 1: Repoint remaining plugin/shared edge handlers** - already satisfied by Plan 06-14; verified unchanged, so no empty commit was created
2. **Task 2: Repoint tools, root composition, auth, and import** - already satisfied by Plan 06-14; verified unchanged, so no empty commit was created

## Files Created/Modified

No production or test files changed. The following scoped consumers were verified byte-for-byte unchanged:

- `extensions/pi-claude-marketplace/edge/handlers/plugin/pending.ts`
- `extensions/pi-claude-marketplace/edge/handlers/plugin/reinstall.ts`
- `extensions/pi-claude-marketplace/edge/handlers/plugin/shared.ts`
- `extensions/pi-claude-marketplace/edge/handlers/plugin/update.ts`
- `extensions/pi-claude-marketplace/edge/handlers/shared.ts`
- `extensions/pi-claude-marketplace/edge/handlers/tools.ts`
- `extensions/pi-claude-marketplace/index.ts`

## Caller Ownership Evidence

| Caller | Notification surface | Exact owner | Result |
| --- | --- | --- | --- |
| `plugin/pending.ts` | `notifyUsageError` | `notification-dispatch.ts` | Already direct; unchanged |
| `plugin/reinstall.ts` | `notifyUsageError` | `notification-dispatch.ts` | Already direct; unchanged |
| `plugin/shared.ts` | `notifyUsageError` | `notification-dispatch.ts` | Already direct; unchanged |
| `plugin/update.ts` | `notifyUsageError` | `notification-dispatch.ts` | Already direct; unchanged |
| `handlers/shared.ts` | `notifyUsageError` | `notification-dispatch.ts` | Already direct; unchanged |
| `handlers/tools.ts` | `PluginNotificationMessage`, `isScopeBearingListRow` | `notification-types.ts` | Already direct; unchanged |
| `index.ts` | `makeRawNotifyFn` | `notification-dispatch.ts` | Already direct; unchanged |

`notifyUsageError` owns exact sentence, blank-line, Usage-block, and error-severity dispatch. `makeRawNotifyFn` is the sanctioned raw-text boundary used inside guarded root callbacks. The tools projection consumes the closed notification vocabulary but never calls the Pi notification UI. No scoped symbol requires a redundant grammar, summary, redaction, or comparator import.

## Four-Part Repointing Gate

| Category | Evidence |
| --- | --- |
| source-scanning gate | CodeGraph attributes each scoped symbol to `notification-dispatch.ts` or `notification-types.ts`; every direct `ctx.ui.notify` call remains in `notification-dispatch.ts`; the seven-file legacy-path scan returns zero matches. |
| documentation comment | No scoped comment names `shared/notify.ts`; tool and root comments continue to describe their exact structured or raw dispatch seams. |
| test ownership | All seven mirrored owner tests exist and pass; import execution, authentication end-to-end, notification dispatch, and `tests/edge/notification-boundary.ts` retain the integration proofs. |
| completeness invariant | Every plan-listed consumer has an explicit owner row and zero stale legacy references; all six possible named owner paths are tracked. |

## Verification

- Task 1 command: `npm run typecheck` passed; plugin reinstall and update handler suites passed 2/2.
- Task 2 command: `npm run typecheck` passed; tools, import execution, and authentication end-to-end suites passed 3/3.
- Combined edge/import/auth proof: all seven mirrored consumer tests plus import execution and authentication end-to-end passed 9/9.
- Sole-dispatch analogue: `tests/shared/notification-dispatch.test.ts` and `tests/edge/notification-boundary.ts` passed 2/2; all eight direct Pi notification call expressions remain in `notification-dispatch.ts`.
- Direct-pair coverage: reinstall, plugin shared, update, tools, and index passed at 100% branches, functions, and lines. The unchanged pending and shared-handler pairs retain the pre-existing direct-coverage gaps described below; direct coverage is not a 06-17 plan gate and no 06-17 source or test changed.
- Focused TypeScript style review: repository `npm run lint`, scoped ESLint, scoped Prettier, typecheck, and `git diff --check` passed with no findings. A literal `npx eslint .` also visits `.codex` runtime files outside the project lint boundary and fails because those CommonJS files lack typed parser configuration; the canonical project lint command passed.
- Focused unit-test review: no test code changed; all nine focused suites passed, strict notification tests remain case-owned, and no skipped or todo tests were introduced.
- `npm run fallow`: passed dead-code, health, and duplicate gates with zero issues above configured thresholds.
- Aggregate `npm test`: 259/261 files passed. `tests/orchestrators/marketplace/add.test.ts` reproduced the known sandbox Unix-socket denial and passed 63/63 outside the sandbox. `tests/architecture/revalidation.test.ts` remains the declared sealed Phase 1 fixture debt for TREF-04 through TREF-09 and was not modified.
- Final per-file stale-path census: zero `shared/notify.ts` references in every scoped consumer.

## Decisions Made

- Already-correct Plan 06-14 imports remain untouched. Verification supplies the required ownership evidence without empty process commits or import churn.
- `tools.ts` stays directly coupled to the notification type owner because it projects the closed union into tool results and never dispatches a notification.
- `index.ts` keeps `makeRawNotifyFn` from the dispatch owner inside its existing nested error guards, preserving last-ditch notification isolation and authentication-safe output behavior.

## Deviations from Plan

None - the plan explicitly allowed callers already migrated by 06-14 to remain unchanged after verification.

## Issues Encountered

- Direct-pair review found two unchanged pre-existing shortfalls: `plugin/pending.ts` reports 9/10 branches, and `handlers/shared.ts` reports 14/15 branches plus 83/85 lines. They predate Plan 06-17, no source/test diff exists, and their tests are outside this import-only plan's owned files, so they were not broadened into this migration.
- Aggregate tests reproduced only the two pre-declared results: the sealed Phase 1 revalidation fixture debt and the sandbox Unix-socket denial. The marketplace/add suite passed 63/63 outside the sandbox, attributing that failure to the environment rather than Plan 06-17.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The complete 06-17 caller group has direct named ownership, exact behavior evidence, and zero legacy notify-hub references.
- Wave 13 sibling Plans 06-19 and 06-21 can continue the same CodeGraph attribution and zero-stale census without compatibility exports.
- The sealed Phase 1 revalidation fixture debt remains deferred and untouched.

## Self-Check: PASSED

The summary and all seven scoped consumers exist, the recorded plan base is present in git history, every required verification completed, coverage metadata validates, and the final scoped stale-path census reports zero files.

---
_Phase: 06-assertion-and-module-refinement_
_Completed: 2026-09-09_

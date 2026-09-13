---
phase: 06-assertion-and-module-refinement
plan: "25"
subsystem: notification test ownership
tags: [typescript, architecture-tests, notifications, direct-owners, integration]
requires:
  - phase: 06-assertion-and-module-refinement
    provides: Named notification owners and sole dispatch boundary from Plan 06-14
  - phase: 06-assertion-and-module-refinement
    provides: Architecture and caller migrations through Plan 06-24
provides:
  - Seven remaining architecture, edge, boundary, and integration files verified against genuine notification owners
  - Reload policy prose attributed to notification-summary.ts and dispatch effects to notification-dispatch.ts
  - Zero legacy shared/notify.ts references across the complete 06-25 file set
affects: [notification-gates, edge-tests, auth-integration, sole-dispatch-proof]
actuals:
  tokens: 1074
  tasks: 2
  commits: 2
plan_head_before: 4b55a633b035ee77783654d929003e77f1ab1c8e
tech-stack:
  added: []
  patterns:
    [atomic caller migration, four-part repointing gate, genuine direct owner, verify-without-churn]
key-files:
  created: []
  modified:
    - tests/architecture/notify-will-reload-agreement.test.ts
    - tests/architecture/scope-fences-63.test.ts
    - tests/edge/completions/data.test.ts
key-decisions:
  - "Attribute reload policy and its independently mirrored trailer literal to notification-summary.ts while retaining notification-dispatch.ts as the sole observable output owner."
  - "Keep the four already-direct scoped files byte-identical and avoid empty process-only commits."
patterns-established:
  - "Ownership prose may move to a genuine leaf only when all executable gates, fixtures, exact bytes, and captured arrays remain unchanged."
requirements-completed: [TREF-07, TREF-09]
coverage:
  - id: D1
    description: All seven scoped files contain zero shared/notify.ts references and resolve their notification concerns to direct named owners.
    requirement: TREF-09
    verification:
      - kind: architecture
        ref: both exact plan task commands
        status: pass
      - kind: other
        ref: seven-file zero-stale census and CodeGraph owner attribution
        status: pass
      - kind: other
        ref: npm run test:corresponding and direct-coverage negative controls
        status: pass
    human_judgment: false
  - id: D2
    description: Reload policy, negative scans, fixtures, exact bytes, redaction, severity, order, and captured notification arrays remain behaviorally unchanged.
    requirement: TREF-07
    verification:
      - kind: unit
        ref: focused seven-file plan suite and five direct owner tests
        status: pass
      - kind: integration
        ref: npm run test:integration
        status: pass
      - kind: other
        ref: executable-diff proof over commit f12c3ec4
        status: pass
    human_judgment: false
duration: 9min
completed: 2026-09-09
status: complete
---

# Phase 06 Plan 25: Remaining Notification Caller Ownership Summary

**Seven remaining notification-facing test and gate files now name genuine policy and dispatch owners with zero legacy-hub references and no executable contract changes.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-09-09T10:59:00Z
- **Completed:** 2026-09-09T11:08:11Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Traced all seven plan-listed files through CodeGraph to `notification-types.ts`, `notification-summary.ts`, `notification-dispatch.ts`, `compare-name-scope.ts`, `redact-absolute-paths.ts`, and the existing command-specific owners.
- Repointed reload-oracle and trailer prose to `notification-summary.ts`, while retaining `notification-dispatch.ts::notify()` as the sole public Pi output effect.
- Repointed the HOOK-04 owner prose to `install.messaging.ts` and corrected the completion-data repository-local import-closure inventory.
- Proved zero `shared/notify.ts` references across all seven scoped files and exactly eight production `ctx.ui.notify` call expressions, all in `notification-dispatch.ts`.
- Preserved every negative gate, source scan, fixture, assertion, expected byte, type, redaction check, severity, order, and captured notification array.

## Task Commits

1. **Task 1: Remaining architecture and edge tests** - `f12c3ec4` (docs)
2. **Task 2: Boundary/integration/marketplace tests** - verified byte-identical; no empty process-only commit created

## Files Created/Modified

- `tests/architecture/notify-will-reload-agreement.test.ts` - Names the summary policy leaf for reload decisions and the dispatch leaf for the observable output effect; fixtures and assertions are unchanged.
- `tests/architecture/scope-fences-63.test.ts` - Names `install.messaging.ts` as the existing `MANIFEST_FIELD_REASONS` scan owner; its scan path and negative assertions are unchanged.
- `tests/edge/completions/data.test.ts` - Lists the completion data module's current repository-local import closure and removes the obsolete hub path; its hermetic network trap and all cases are unchanged.
- `tests/architecture/scope-order-drift.test.ts` - Already named `compare-name-scope.ts`; byte-identical.
- `tests/edge/handlers/tools.test.ts` - Already imported notification types directly; byte-identical.
- `tests/edge/notification-boundary.ts` - Already attributed strict captured output to the sole dispatch owner; byte-identical.
- `tests/integration/auth-e2e.test.ts` - Already imported `makeRawNotifyFn` from the sole dispatch owner and retained all token-redaction and exact-output assertions; byte-identical.

## Owner Evidence

| Scoped file                            | Notification concern                                    | Genuine owner                                                    | Result                                           |
| -------------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------ |
| `notify-will-reload-agreement.test.ts` | reload decision/trailer; rendered public effect         | `notification-summary.ts`; `notification-dispatch.ts`            | Stale policy prose repointed; behavior unchanged |
| `scope-fences-63.test.ts`              | closed reasons; install manifest-field classification   | `notification-types.ts`; `install.messaging.ts`                  | Stale owner prose repointed; scan unchanged      |
| `scope-order-drift.test.ts`            | canonical name/scope ordering                           | `compare-name-scope.ts`                                          | Already direct; unchanged                        |
| `edge/completions/data.test.ts`        | repository-local import closure and network hermeticity | `completion-cache.ts`; `atomic-json.ts`; `errors.ts`; `types.ts` | Obsolete closure prose corrected; trap unchanged |
| `edge/handlers/tools.test.ts`          | plugin notification status type                         | `notification-types.ts`                                          | Already direct; unchanged                        |
| `edge/notification-boundary.ts`        | exact payload, severity, count, and order capture       | `notification-dispatch.ts`                                       | Already direct; unchanged                        |
| `integration/auth-e2e.test.ts`         | raw auth notification dispatch and token redaction      | `notification-dispatch.ts`                                       | Already direct; unchanged                        |

## Four-Part Repointing Gate

| Category               | Evidence                                                                                                                                                                                                          |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| source-scanning gate   | HOOK-04 continues to read the same `install.messaging.ts` constant; scope-order continues to scan against `compare-name-scope.ts`; no regex, expected count, offender enumeration, or negative assertion changed. |
| documentation comment  | Reload policy now names `notification-summary.ts`, its observable output names `notification-dispatch.ts`, and the completion import closure contains no obsolete hub path.                                       |
| test ownership         | Both exact task commands pass; five direct notification owner tests pass; four already-correct files remain byte-identical.                                                                                       |
| completeness invariant | Every scoped file has an owner row, all seven have zero `shared/notify.ts` references, correspondence passes, and the production sole-dispatch census remains eight call expressions in one file.                 |

## Verification

- Task 1 exact gate passed all 5 files; its scoped stale-path census returned zero.
- Task 2 exact gate passed all 4 files; its scoped stale-path census returned zero.
- Plan gates `npm run typecheck` and `npm run fallow` passed.
- Focused owner suite passed 5/5: notification types, summary, dispatch, redaction, and comparator.
- Direct coverage remained complete for `notification-summary.ts` (124/124 branches, 19/19 functions, 631/631 lines) and `notification-dispatch.ts` (46/46 branches, 16/16 functions, 423/423 lines).
- `npm run test:corresponding` passed. Direct-coverage negative controls passed unrestricted after the sandbox suppressed their expected child-process diagnostic.
- Sole-dispatch census found exactly eight production `ctx.ui.notify` call expressions, all in `extensions/pi-claude-marketplace/shared/notification-dispatch.ts`.
- Focused TypeScript style review passed typecheck, seven-file ESLint with zero warnings, seven-file Prettier, and `git diff --check`; the changed lines contain none of the Google-style quick-scan constructs.
- Focused unit-test review found no executable diff, no skip/todo/only marker, and no changed assertion, fixture, expected value, double, captured array, redaction guard, or async boundary.
- Aggregate unit attribution passed 259/261 files. `tests/architecture/revalidation.test.ts` remains the declared sealed Phase 1 fixture debt for TREF-04 through TREF-09. `tests/orchestrators/marketplace/add.test.ts` hit sandbox Unix-socket denial and passed 63/63 unrestricted.
- Integration passed all 13 files.

## Decisions Made

- Kept the reload trailer literal independently authored in the architecture test; only its owner attribution changed, so the test does not derive its expectation from production.
- Corrected the completion test's whole repository-local closure inventory instead of falsely substituting a new notification owner that is not in that closure.
- Kept four already-direct files byte-identical and did not create an empty Task 2 commit.

## Deviations from Plan

None - the plan explicitly required path/prose repointing, direct-owner verification, and unchanged observable behavior.

## Issues Encountered

- Aggregate unit testing reproduced only the declared sealed Phase 1 revalidation fixture debt and sandbox socket denial. Marketplace/add passed fully outside the sandbox.
- The direct-coverage negative-control suite required unrestricted local process behavior and then passed.
- Linked-worktree Git metadata is outside the workspace-write sandbox, so commits required approved escalation while remaining on the mandated `features/refine-unit-tests` branch.

## Known Stubs

None.

## Threat Flags

None - this plan changes ownership prose only and introduces no endpoint, authentication path, file access, schema, or trust-boundary surface.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All seven remaining callers/gates are direct-owner aligned, stale-path-free, and behaviorally intact.
- The sole-dispatch, redaction, comparator, closed-type, and reload-summary constraints remain enforced for the final notification hub deletion plans.
- The sealed Phase 1 revalidation fixture debt remains intentionally deferred and unmodified.

## Self-Check: PASSED

The summary and all three modified test files exist, Task 1 commit `f12c3ec4` is present in git history, all seven scoped files contain zero `shared/notify.ts` references, and the production sole-dispatch census remains exactly eight direct Pi call expressions in `notification-dispatch.ts`.

---

_Phase: 06-assertion-and-module-refinement_
_Completed: 2026-09-09_

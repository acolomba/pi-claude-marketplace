---
phase: 06-assertion-and-module-refinement
plan: "22"
subsystem: notification architecture
tags: [typescript, notifications, direct-imports, reconciliation, persistence]
requires:
  - phase: 06-assertion-and-module-refinement
    provides: Named notification owners and sole dispatch boundary from Plans 06-12 through 06-14
  - phase: 06-assertion-and-module-refinement
    provides: Reconcile/update caller ownership established through Plan 06-21
provides:
  - Eight reconcile, type, and config callers verified on genuine named notification owners
  - Three stale shared/notify.ts prose references repointed to the notification dispatch owner
  - Zero legacy shared/notify.ts references across the complete 06-22 caller set
affects: [notification-callers, reconcile-apply, reconcile-pending, config-persistence]
actuals:
  tokens: 638
  tasks: 2
  commits: 2
plan_head_before: 233acd37da9b2f8f38850007d2e9b98636f999b2
tech-stack:
  added: []
  patterns: [atomic caller migration, genuine direct owner, verify-without-churn, zero-stale census]
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
    - extensions/pi-claude-marketplace/persistence/config-merge.ts
key-decisions:
  - "Keep all eight already-direct notification import graphs unchanged; only three explicit legacy-hub prose references required repointing."
  - "Retain notify-context.ts as the genuine command rendering and dispatch composition owner because it calls notification-dispatch.ts directly and exposes no compatibility facade."
patterns-established:
  - "A bounded caller migration traces every symbol to a genuine owner, leaves correct imports untouched, and repairs only stale ownership prose."
requirements-completed: [TREF-07, TREF-09]
coverage:
  - id: D1
    description: All eight scoped callers use genuine direct notification owners and contain zero shared/notify.ts references.
    requirement: TREF-09
    verification:
      - kind: other
        ref: CodeGraph owner attribution and eight-file zero-stale census
        status: pass
      - kind: other
        ref: npm run typecheck and npm run fallow
        status: pass
      - kind: other
        ref: tests/architecture/notify-producer-wire-coverage.test.ts and sole-dispatch source census
        status: pass
    human_judgment: false
  - id: D2
    description: Reconcile and config behavior retains exact output, redaction, severity, ordering, rollback, persistence, and merge contracts.
    requirement: TREF-07
    verification:
      - kind: unit
        ref: focused plugin update plus eight reconcile/type/config owner suites
        status: pass
      - kind: unit
        ref: tests/shared/notification-dispatch.test.ts and tests/edge/notification-boundary.ts
        status: pass
      - kind: integration
        ref: npm run test:integration
        status: pass
    human_judgment: false
duration: 7min
completed: 2026-09-09
status: complete
---

# Phase 06 Plan 22: Reconcile and Config Notification Caller Summary

**Eight reconcile, type, and config callers retain exact behavior through genuine named notification owners, with three stale hub references removed and one sole Pi dispatch boundary preserved.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-09-09T10:21:29Z
- **Completed:** 2026-09-09T10:27:57Z
- **Tasks:** 2
- **Production files modified:** 2

## Accomplishments

- Traced notification-related symbols in every plan-listed caller through CodeGraph and confirmed Plan 06-14 had already moved all eight import graphs to genuine named owners.
- Repointed one reconcile projection comment and two config-merge comments from `shared/notify.ts` to `notification-dispatch.ts` without changing imports, types, APIs, statements, output bytes, severity, ordering, reconciliation, rollback, or persistence behavior.
- Proved zero `shared/notify.ts` references across all eight callers and exactly eight production TypeScript `ctx.ui.notify` call expressions, all in `shared/notification-dispatch.ts`.
- Preserved complete direct coverage for both changed source/test pairs and passed focused owner, structural, style, integration, and aggregate attribution gates.

## Task Commits

1. **Task 1: Update and reconcile-apply callers** - already satisfied by Plan 06-14; verified unchanged, so no empty commit was created
2. **Task 2: Reconcile/type/config callers** - `7ee70808` (docs)

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts` - Names `notification-dispatch.ts` as the downstream output owner while retaining its pure projection boundary.
- `extensions/pi-claude-marketplace/persistence/config-merge.ts` - Names `notification-dispatch.ts` as the downstream notification owner in both module and function contracts.

The following scoped callers were already correct and stayed byte-for-byte unchanged:

- `extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts`
- `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts`
- `extensions/pi-claude-marketplace/orchestrators/reconcile/backfill.ts`
- `extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts`
- `extensions/pi-claude-marketplace/orchestrators/reconcile/reconcile.messaging.ts`
- `extensions/pi-claude-marketplace/orchestrators/types.ts`

## Caller Ownership Evidence

| Caller | Notification surface | Exact owner | Result |
| --- | --- | --- | --- |
| `apply-outcomes.ts` | closed reasons and structured reconcile outcomes | `notification-types.ts` | Already direct; unchanged |
| `apply.ts` | diagnostic dispatch, reason types, contextual applied cascade, redaction | `notification-dispatch.ts`; `notification-types.ts`; `notify-context.ts`; `redact-absolute-paths.ts` | Already direct; unchanged |
| `backfill.ts` | failure redaction before typed outcome projection | `redact-absolute-paths.ts` | Already direct; unchanged |
| `notify.ts` | stable name/scope ordering and notification message vocabulary | `compare-name-scope.ts`; `notification-types.ts`; `notify-reasons.ts`; `notify-context.ts` | Imports unchanged; stale dispatch-owner comment fixed |
| `pending.ts` | empty advisory dispatch, message types, contextual cascade composition | `notification-dispatch.ts`; `notification-types.ts`; `notify-context.ts` | Already direct; unchanged |
| `reconcile.messaging.ts` | row grammar, closed message types, command-local render maps | `notification-grammar.ts`; `notification-types.ts`; `notify-context.ts` | Already direct; unchanged |
| `orchestrators/types.ts` | closed content reasons and degradation vocabulary | `notification-types.ts`; `notify-reasons.ts` | Already direct; unchanged |
| `config-merge.ts` | pure config merge with downstream dispatch attribution | `notification-dispatch.ts` | No runtime import; two stale owner comments fixed |

`notify-context.ts` remains a genuine composition owner. It combines command-local render maps with summary/cardinality policy, then calls `notification-dispatch.ts` directly without re-exporting or forwarding the legacy hub API.

## Four-Part Repointing Gate

| Category | Evidence |
| --- | --- |
| source-scanning gate | CodeGraph attributes every scoped notification symbol to a genuine owner. The eight-file stale-path scan returns zero matches, and the production TypeScript census finds exactly eight direct Pi calls only in `shared/notification-dispatch.ts`. |
| documentation comment | All three explicit `shared/notify.ts` references now name `shared/notification-dispatch.ts`; no scoped import or comment retains the legacy path. |
| test ownership | All eight mirrored reconcile/type/config owner suites, plugin update, dispatch owner, edge boundary, and producer-wire architecture suites pass. |
| completeness invariant | Every plan-listed caller has an explicit ownership row, both changed direct pairs retain 100% branch/function/line coverage, and no facade, re-export, API alias, or compatibility seam was introduced. |

## Verification

- Task 1: `npm run typecheck`, plugin update, and reconcile apply passed; the three-file stale-path gate returned zero matches.
- Task 2: `npm run typecheck` and all eight reconcile/type/config owner suites passed 8/8; the five-file stale-path gate returned zero matches after the prose repoint.
- Plan gates: `npm run fallow`, focused ESLint with zero warnings, focused Prettier, `npm run test:corresponding`, and `git diff --check` passed.
- Direct-pair coverage: `orchestrators/reconcile/notify.ts` passed at 127/127 branches, 21/21 functions, and 979/979 lines; `persistence/config-merge.ts` passed at 15/15 branches, 2/2 functions, and 144/144 lines.
- Sole-dispatch proof: notification dispatch, edge boundary, and producer-wire suites passed 3/3. The production census finds exactly eight direct `ctx.ui.notify` expressions, all in `shared/notification-dispatch.ts`.
- Focused TypeScript style review: typecheck, ESLint, Prettier, diff whitespace, and prohibited-token scan passed with no findings; executable TypeScript did not change.
- Focused unit-test review: no test code changed; all mirrored owners passed, direct coverage stayed complete, the strict notification boundary passed, and no skip, todo, or only marker was introduced.
- Aggregate `npm test`: 259/261 files passed. `tests/architecture/revalidation.test.ts` remains the declared sealed Phase 1 fixture debt for TREF-04 through TREF-09. `tests/orchestrators/marketplace/add.test.ts` reproduced the known sandbox Unix-socket denial and passed 63/63 unrestricted.
- Integration: all 13 integration files passed.
- Final scoped stale-path census: zero `shared/notify.ts` references in all eight callers.

## Decisions Made

- Kept every already-direct import unchanged. Plan 06-14 completed the runtime migration, so this plan repaired only explicit stale path prose.
- Kept `notify-context.ts` on its genuine composition boundary. It calls the dispatch owner directly and is not a compatibility facade.
- Kept config merge pure. Its only change is correct downstream ownership attribution; it gains no notification import or behavior.

## Deviations from Plan

None - the plan explicitly required prose repointing and permitted already-correct imports to remain unchanged after verification.

## Issues Encountered

- Aggregate testing reproduced only the two declared results: sealed Phase 1 revalidation fixture debt and the sandbox Unix-socket denial. Marketplace/add passed 63/63 unrestricted, attributing its aggregate failure to the environment.
- The git worktree metadata directory is outside the workspace-write sandbox; the required task commit succeeded with approved escalation on the existing `features/refine-unit-tests` branch.

## Known Stubs

None.

## Threat Flags

None - this plan changes ownership prose only and introduces no endpoint, authentication path, file-access behavior, schema, or trust-boundary surface.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The complete 06-22 caller group has direct named ownership, exact behavior evidence, and zero legacy notify-hub references.
- The root executor can run the true Wave 14 aggregate/post gates across Plans 06-16, 06-18, 06-20, and 06-22.
- The sealed Phase 1 revalidation fixture debt remains intentionally deferred and unmodified.

## Self-Check: PASSED

The summary and both modified source files exist, Task 2 commit `7ee70808` is present in git history, all eight scoped callers are stale-path-free, and the sole-dispatch census still resolves exactly eight TypeScript call sites to `notification-dispatch.ts`.

---
_Phase: 06-assertion-and-module-refinement_
_Completed: 2026-09-09_

---
phase: 06-assertion-and-module-refinement
plan: "23"
subsystem: notification architecture
tags: [typescript, notifications, direct-imports, persistence, transaction]
requires:
  - phase: 06-assertion-and-module-refinement
    provides: Named notification owners and sole dispatch boundary from Plans 06-12 through 06-14
  - phase: 06-assertion-and-module-refinement
    provides: Caller ownership migrations through Plan 06-22
provides:
  - Seven persistence, platform, shared, and transaction callers verified on genuine named notification owners
  - Seventeen stale shared/notify.ts prose references repointed to notification types, grammar, context, and dispatch owners
  - Zero legacy shared/notify.ts references across the complete 06-23 caller set
affects: [notification-callers, config-migration, pi-platform, shared-errors, transaction-rollback]
actuals:
  tokens: 1871
  tasks: 2
  commits: 3
plan_head_before: fa073be084797beeef7f17a53f8cd88fd7ec3344
tech-stack:
  added: []
  patterns: [atomic caller migration, genuine direct owner, verify-without-churn, zero-stale census]
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/persistence/migrate-config.ts
    - extensions/pi-claude-marketplace/platform/pi-api.ts
    - extensions/pi-claude-marketplace/shared/README.md
    - extensions/pi-claude-marketplace/shared/debug-log.ts
    - extensions/pi-claude-marketplace/shared/errors.ts
    - extensions/pi-claude-marketplace/transaction/phase-ledger.ts
    - extensions/pi-claude-marketplace/transaction/rollback.ts
key-decisions:
  - "Keep all seven already-direct runtime import graphs unchanged; Plan 06-14 had completed the executable migration, leaving only stale ownership prose."
  - "Attribute each structured notification concern to its narrow owner: notification-types.ts, notification-grammar.ts, notify-context.ts, or notification-dispatch.ts."
patterns-established:
  - "Normative comments follow the same atomic caller migration gate as imports: trace each symbol, name its genuine owner, and prove the legacy path is absent."
requirements-completed: [TREF-07, TREF-09]
coverage:
  - id: D1
    description: All seven scoped callers use genuine direct notification owners and contain zero shared/notify.ts references.
    requirement: TREF-09
    verification:
      - kind: other
        ref: CodeGraph owner attribution and seven-file zero-stale census
        status: pass
      - kind: other
        ref: npm run typecheck and npm run fallow
        status: pass
      - kind: other
        ref: sole-dispatch architecture suites and production source census
        status: pass
    human_judgment: false
  - id: D2
    description: Migration, platform, debug, error, transaction, rollback, output, redaction, ordering, and severity behavior remain unchanged.
    requirement: TREF-07
    verification:
      - kind: unit
        ref: focused persistence, platform, shared, transaction, and rollback owner suites
        status: pass
      - kind: unit
        ref: complete direct branch, function, and line coverage for all six changed TypeScript modules
        status: pass
      - kind: integration
        ref: npm run test:integration
        status: pass
    human_judgment: false
duration: 14min
completed: 2026-09-09
status: complete
---

# Phase 06 Plan 23: Persistence, Shared, and Transaction Notification Caller Summary

**Seven persistence, platform, shared, and transaction callers retain exact behavior through genuine named notification owners, with seventeen stale hub references removed and one sole Pi dispatch boundary preserved.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-09-09T10:32:07Z
- **Completed:** 2026-09-09T10:46:09Z
- **Tasks:** 2
- **Production files modified:** 7

## Accomplishments

- Traced notification-related symbols in every plan-listed file through CodeGraph and confirmed Plan 06-14 had already moved all seven runtime import graphs to genuine named owners.
- Repointed seventeen normative prose references from the removed `shared/notify.ts` hub to the exact notification types, grammar, context, or dispatch owner without changing executable TypeScript.
- Proved zero `shared/notify.ts` references across all seven files and exactly eight production TypeScript `ctx.ui.notify` call expressions, all in `shared/notification-dispatch.ts`.
- Preserved complete direct branch, function, and line coverage for all six changed TypeScript modules and passed focused owner, transaction, architecture, style, integration, and aggregate-attribution gates.

## Task Commits

1. **Task 1: Persistence, platform, and shared callers** - `d4bd2927` (docs)
2. **Task 2: Transaction and rollback callers** - `116d8916` (docs)

## Files Created/Modified

- `extensions/pi-claude-marketplace/persistence/migrate-config.ts` - Routes the documented reconciliation outcome path through notification context to dispatch.
- `extensions/pi-claude-marketplace/platform/pi-api.ts` - Names notification dispatch as the `softDepStatus` consumer.
- `extensions/pi-claude-marketplace/shared/README.md` - Documents closed notification types, grammar, summary folding, and the sole dispatch boundary.
- `extensions/pi-claude-marketplace/shared/debug-log.ts` - Points the mirrored ESLint authorization to notification dispatch.
- `extensions/pi-claude-marketplace/shared/errors.ts` - Attributes cause-chain, rollback, and manual-recovery rendering to grammar, context, and dispatch.
- `extensions/pi-claude-marketplace/transaction/phase-ledger.ts` - Attributes rollback payload types and rendering to notification types and grammar.
- `extensions/pi-claude-marketplace/transaction/rollback.ts` - Documents its structured-data handoff through types, grammar, context, and dispatch.

## Caller Ownership Evidence

| Caller | Notification surface | Exact owner | Result |
| --- | --- | --- | --- |
| `migrate-config.ts` | reconciliation outcome composition and dispatch | `notify-context.ts`; `notification-dispatch.ts` | Runtime unchanged; stale caller-path prose fixed |
| `pi-api.ts` | soft dependency status consumed while rendering rows | `notification-dispatch.ts` | Runtime unchanged; stale consumer prose fixed |
| `shared/README.md` | notification vocabulary, grammar, summary, and Pi boundary | `notification-types.ts`; `notification-grammar.ts`; `notification-summary.ts`; `notification-dispatch.ts` | Legacy hub description replaced |
| `debug-log.ts` | ESLint authorization mirrored from the sole Pi boundary | `notification-dispatch.ts` | Runtime unchanged; stale scanner prose fixed |
| `errors.ts` | cause chains, rollback failure, and manual-recovery rows | `notification-grammar.ts`; `notify-context.ts`; `notification-dispatch.ts` | Runtime unchanged; four stale owner references fixed |
| `phase-ledger.ts` | structured rollback partial types and cause-chain rendering | `notification-types.ts`; `notification-grammar.ts` | Runtime unchanged; four stale owner references fixed |
| `rollback.ts` | rollback payload type, rendering, context, and dispatch | `notification-types.ts`; `notification-grammar.ts`; `notify-context.ts`; `notification-dispatch.ts` | Runtime unchanged; four stale owner references fixed |

## Four-Part Repointing Gate

| Category | Evidence |
| --- | --- |
| source-scanning gate | CodeGraph attributes every scoped notification concern to a genuine owner. The seven-file stale-path scan returns zero matches, and the production TypeScript census finds exactly eight direct Pi calls only in `shared/notification-dispatch.ts`. |
| documentation comment | All seventeen explicit `shared/notify.ts` references now name the narrow types, grammar, context, summary, or dispatch owner; no scoped import or comment retains the legacy path. |
| test ownership | All mirrored persistence, platform, shared, transaction, rollback, dispatch, edge-boundary, producer-wire, and required architecture suites pass. |
| completeness invariant | Every plan-listed file has an explicit ownership row, all six changed direct pairs retain complete branch/function/line coverage, and no facade, re-export, API alias, or compatibility seam was introduced. |

## Verification

- Task 1: `npm run typecheck`, auth end-to-end, and the migrate-config, Pi API, debug-log, and errors owner suites passed; the five-file stale-path gate returned zero matches.
- Task 2: catalog UAT, compatibility no-expansion, hooks notification-cap architecture suites, phase-ledger, rollback, and plugin install transaction-flow tests passed; the two-file stale-path gate returned zero matches.
- Plan gates: `npm run fallow`, focused ESLint with zero warnings, focused Prettier, `npm run test:corresponding`, and `git diff --check` passed.
- Direct-pair coverage: migrate-config passed 19/19 branches, 2/2 functions, and 209/209 lines; Pi API 12/12, 5/5, and 183/183; debug-log 3/3, 1/1, and 27/27; errors 132/132, 51/51, and 767/767; phase-ledger 30/30, 3/3, and 174/174; rollback 6/6, 1/1, and 75/75.
- Sole-dispatch proof: dispatch, edge-boundary, producer-wire, catalog UAT, compatibility no-expansion, and hooks notification-cap suites passed 6/6. The production census finds exactly eight direct `ctx.ui.notify` expressions, all in `shared/notification-dispatch.ts`.
- Focused TypeScript style review: typecheck, ESLint, Prettier, diff whitespace, and prohibited-token scan passed with no new findings; executable TypeScript did not change.
- Focused unit-test review: no test code changed; all mirrored owners passed, direct coverage stayed complete, the strict notification boundary passed, and no skip, todo, or only marker was introduced.
- Direct-coverage negative controls passed unrestricted; the sandbox run produced the known empty-stderr Unix-socket artifact.
- Aggregate `npm test`: 259/261 files passed. `tests/architecture/revalidation.test.ts` remains the declared sealed Phase 1 fixture debt for TREF-04 through TREF-09. `tests/orchestrators/marketplace/add.test.ts` reproduced the known sandbox Unix-socket denial and passed 63/63 unrestricted.
- Integration: all 13 integration files passed.
- Final scoped stale-path census: zero `shared/notify.ts` references in all seven files.

## Decisions Made

- Kept every already-direct runtime import unchanged. Plan 06-14 completed the executable migration, so this plan repaired only stale normative ownership prose.
- Mapped structured payloads to `notification-types.ts`, byte rendering and cause chains to `notification-grammar.ts`, command composition to `notify-context.ts`, and the sole Pi call boundary to `notification-dispatch.ts`.
- Kept transaction modules presentation-free. They continue returning structured rollback data and gain no notification imports or behavior.

## Deviations from Plan

None - the plan explicitly required prose and scanner repointing and permitted already-correct runtime imports to remain unchanged after verification.

## Issues Encountered

- Aggregate testing reproduced only the two declared results: sealed Phase 1 revalidation fixture debt and the sandbox Unix-socket denial. Marketplace/add passed 63/63 unrestricted, attributing its aggregate failure to the environment.
- `npm run check` reached the format gate after typecheck, lint, and fallow passed, then stopped on the pre-existing untracked user-owned `.mcp.json`; scoped Prettier passed and the file was left untouched.
- The direct-coverage negative-control suite also required unrestricted execution for its local Unix socket and then passed.
- The git worktree metadata directory is outside the workspace-write sandbox; required commits used approved escalation on the mandated `features/refine-unit-tests` branch.

## Known Stubs

None.

## Threat Flags

None - this plan changes ownership prose only and introduces no endpoint, authentication path, file-access behavior, schema, or trust-boundary surface.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The complete 06-23 caller group has direct named ownership, exact behavior evidence, and zero legacy notify-hub references.
- Persistence, platform, shared, and transaction ownership documentation now matches the runtime boundaries established in Plan 06-14.
- The sealed Phase 1 revalidation fixture debt remains intentionally deferred and unmodified.

## Self-Check: PASSED

The summary and all seven modified source files exist, Task 1 commit `d4bd2927` and Task 2 commit `116d8916` are present in git history, all seven scoped files are stale-path-free, and the sole-dispatch census still resolves exactly eight TypeScript call sites to `notification-dispatch.ts`.

---
_Phase: 06-assertion-and-module-refinement_
_Completed: 2026-09-09_

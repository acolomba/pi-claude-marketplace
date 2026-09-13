---
phase: 01-live-evidence-revalidation
plan: 38
subsystem: testing
tags: [evidence-ledger, node-test, codegraph, hermetic-mutation]
requires:
  - phase: 01-01
    provides: Deterministic evidence-shard schema and validator
provides:
  - Validated exclusive evidence shard for shared-notify-c and transaction adversarial reports
  - Current static, direct-coverage, focused-test, and hermetic mutation evidence for Phase 2 and Phase 8 routing
affects: [phase-01-merge, phase-02-unit-test-remediation, phase-08-direct-coverage]
actuals:
  tokens: 16950
  tasks: 2
  commits: 1
tech-stack:
  added: []
  patterns:
    [CodeGraph-first revalidation, repository-local isolated mutation copies, positive stale proof]
key-files:
  created:
    - .planning/phases/01-live-evidence-revalidation/shards/01-38.json
  modified: []
key-decisions:
  - "Close the historical 18-of-19 dead notify-cascade census because current install, update, and reinstall call paths now provide positive replacement evidence."
  - "Keep 100% direct branch coverage separate from mutation strength: async await and partial-order mutations still survive current transaction owner suites."
requirements-completed: [RVAL-01, RVAL-02]
coverage:
  - id: D1
    description: Both assigned corpus records are represented by a schema-valid exclusive evidence shard with all claim links resolved.
    requirement: RVAL-01
    verification:
      - kind: other
        ref: node scripts/revalidation.mjs validate-shard --assignment .planning/phases/01-live-evidence-revalidation/01-CORPUS-ASSIGNMENT.md --plan 01-38 --shard .planning/phases/01-live-evidence-revalidation/shards/01-38.json
        status: pass
    human_judgment: false
  - id: D2
    description: Focused suites, direct coverage, and isolated mutations distinguish stale coverage/reachability claims from current test-strength gaps.
    requirement: RVAL-02
    verification:
      - kind: unit
        ref: node --test tests/shared/notify.test.ts tests/transaction/phase-ledger.test.ts tests/transaction/rollback.test.ts tests/transaction/with-state-guard.test.ts
        status: pass
      - kind: other
        ref: npm run test:coverage:direct -- extensions/pi-claude-marketplace/transaction/with-state-guard.ts
        status: pass
    human_judgment: false
duration: 12min
completed: 2026-09-05
status: complete
---

# Phase 01 Plan 38: Notify and Transaction Evidence Revalidation Summary

**A claim-complete evidence shard replaces stale notify reachability and transaction coverage claims while preserving current mutation-proven owner-test gaps.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-09-05T01:06:00Z
- **Completed:** 2026-09-05T01:18:34Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Reconciled all 48 report-local claims from corpus paths 064 and 065 into two complete file records and 48 normalized findings.
- Positively closed the stale historical claims that 18 of 19 notify cascade statuses are production-dead and that `isLockHeldError` has uncovered direct branches.
- Confirmed three current owner-test gaps with surviving mutations in repository-local copies: path-source `last_updated` suppression, asynchronous state mutation ordering, and failing-phase partial ordering.

## Task Commits

1. **Tasks 1-2: Individually adjudicate corpus records 064-065** — `e48cf18c` (docs)

## Files Created/Modified

- `.planning/phases/01-live-evidence-revalidation/shards/01-38.json` — exclusive claim-linked evidence for `shared-notify-c.md` and `transaction.md`.

## Decisions Made

- Historical verdicts and counts remain traceable, but current status follows the live call graph, focused reruns, direct coverage, and isolated mutations.
- A green 100% direct coverage report does not close value-, ordering-, or await-placement gaps demonstrated by surviving mutations.

## Deviations from Plan

None - plan evidence work executed as written. The root orchestrator created the combined artifact commit because the executor could not create the linked-worktree index lock.

## Issues Encountered

The linked checkout's parent Git metadata is mounted read-only for the executor, so the root orchestrator committed the validated shard.

## Known Stubs

None. `N/A` references in the shard are explicit schema-required explanations for test-local claims.

## User Setup Required

None - all inspection, tests, coverage, and mutations used repository-local files with no network, credentials, or real user state.

## Next Phase Readiness

The shard passes exact assignment validation and is ready for the deterministic Phase 01 merge.

## Self-Check: PASSED

The shard and summary exist; artifact commit `e48cf18c`, both focused suites, the direct state-guard coverage command, three isolated mutations, and the assignment validator pass. No live `extensions/` or `tests/` file changed and no mutation-copy directory remains.

---

_Phase: 01-live-evidence-revalidation_
_Completed: 2026-09-05_

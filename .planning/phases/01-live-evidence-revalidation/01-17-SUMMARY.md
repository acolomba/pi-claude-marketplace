---
phase: 01-live-evidence-revalidation
plan: 17
subsystem: testing
tags: [unit-tests, mutation-testing, resolver, evidence-ledger]
requires:
  - phase: 01-01
    provides: Normalized evidence shard schema, assignment validator, and locked corpus inventory
provides:
  - Claim-complete live adjudication of domain resolver adversarial slices A and B
  - Current mutation evidence for resolver result, component-set, interaction, message, and type-contract weaknesses
  - Positive stale proof for three superseded or overstated historical claims
affects: [phase-02-remediation, resolver-tests, operator-decisions, shard-merge]
actuals:
  tokens: 14411
  tasks: 2
  commits: 2
tech-stack:
  added: []
  patterns: [isolated mutation copies, source-claim canonical linking, positive stale proof]
key-files:
  created:
    - .planning/phases/01-live-evidence-revalidation/shards/01-17.json
    - .planning/phases/01-live-evidence-revalidation/01-17-SUMMARY.md
  modified: []
key-decisions:
  - "Route the inconsistent resolver I/O error taxonomy and eventual module split through operator decisions rather than treating them as mechanical test fixes."
  - "Close the requirePartialInstallable over-narrowing claim as stale because the current typecheck rejects that mutation at four live call sites."
patterns-established:
  - "A passing direct-coverage gate does not close mutation-strength findings; focused surviving mutations remain independent evidence."
  - "Conflicting historical fixture verdicts resolve from current consumer evidence while both source claims remain traceable."
requirements-completed: [RVAL-01, RVAL-02]
coverage:
  - id: D1
    description: Both assigned resolver corpus files are represented by complete namespaced source claims and reconciled findings.
    requirement: RVAL-01
    verification:
      - kind: other
        ref: "node scripts/revalidation.mjs validate-shard --assignment .planning/phases/01-live-evidence-revalidation/01-CORPUS-ASSIGNMENT.md --plan 01-17 --shard .planning/phases/01-live-evidence-revalidation/shards/01-17.json"
        status: pass
    human_judgment: false
  - id: D2
    description: Current resolver evidence distinguishes live weaknesses from stale claims without changing production or test files.
    requirement: RVAL-02
    verification:
      - kind: unit
        ref: "node --test tests/domain/resolver.test.ts"
        status: pass
      - kind: other
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/resolver.ts"
        status: pass
    human_judgment: false
duration: 10min
completed: 2026-09-04
status: complete
---

# Phase 01 Plan 17: Domain Resolver Evidence Revalidation Summary

**Fifty-two historical resolver claims now have current, traceable dispositions backed by focused tests, direct coverage, isolated mutations, and call-graph evidence.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-09-04T22:42:00Z
- **Completed:** 2026-09-04T22:52:00Z
- **Tasks:** 2
- **Files modified:** 1 evidence shard

## Accomplishments

- Reconciled both assigned adversarial resolver slices into 52 source claims linked to 42 canonical findings.
- Confirmed 39 live findings, including eight wrong implementations that survive the focused resolver suite despite 100% direct branch, function, and line coverage.
- Positively closed three stale claims: shared fixture relocation, the `/dev/null` hermeticity warning, and the claimed compile-time survival of an over-narrowed partial-install gate.

## Task Commits

1. **Task 1: Individually adjudicate corpus record 027** — `9d30ef68` (docs)
2. **Task 2: Individually adjudicate corpus record 028** — `4a6960f7` (docs)

## Files Created/Modified

- `.planning/phases/01-live-evidence-revalidation/shards/01-17.json` — Exclusive validated evidence shard for the two assigned resolver reports.
- `.planning/phases/01-live-evidence-revalidation/01-17-SUMMARY.md` — Execution record and evidence overview.

## Decisions Made

- Kept evidence status independent from routing: confirmed structural policy questions can route to operator decision, while stale claims close evidence-only.
- Preserved both contradictory historical fixture claims as separate source identities, then resolved their shared current finding from live multi-consumer evidence.
- Treated the current typecheck failure under the partial-gate mutation as positive replacement proof, not merely as a changed line reference.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The task-1 assignment validator correctly rejected the intentionally partial one-file shard because plan ownership contains two paths. The first task was committed after JSON and claim-link inspection; the exact assignment validator passed after task 2 completed the shard.
- Git metadata lives in the parent checkout and required the approved out-of-sandbox commit path. No branch or worktree state was altered.

## Known Stubs

None.

## Threat Flags

None. The plan changed only normalized planning evidence. All mutations ran inside repository-local copies that were removed afterward; live production and test files remained unchanged.

## User Setup Required

None - no external services, credentials, network access, or real user state were used.

## Next Phase Readiness

- The 01-17 shard is ready for deterministic merge after the remaining review plans complete.
- Confirmed resolver fixes are routed to Phase 2; I/O taxonomy and module-split sequencing remain explicit operator decisions.

## Self-Check: PASSED

The shard and summary exist; task commits `9d30ef68` and `4a6960f7` are present; the assignment-scoped shard validator, focused resolver test, and direct coverage gate pass.

---

_Phase: 01-live-evidence-revalidation_
_Completed: 2026-09-04_

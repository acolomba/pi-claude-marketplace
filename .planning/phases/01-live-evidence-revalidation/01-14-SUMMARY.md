---
phase: 01-live-evidence-revalidation
plan: 14
subsystem: testing
tags: [evidence-ledger, node-test, mcp, skills]
requires:
  - phase: 01-01
    provides: normalized shard schema, exact corpus assignment, and fail-closed validator
provides:
  - Claim-complete current evidence for adversarial corpus records 022 and 023
  - Independent routing for MCP and skills production, test-strength, and policy findings
affects: [phase-02-production-defects, phase-03-test-quality, operator-decisions]
actuals:
  tokens: 14732
  tasks: 2
  commits: 2
tech-stack:
  added: []
  patterns: [namespaced source claims, positive stale proof, status-route separation]
key-files:
  created:
    - .planning/phases/01-live-evidence-revalidation/shards/01-14.json
    - .planning/phases/01-live-evidence-revalidation/01-14-SUMMARY.md
  modified: []
key-decisions:
  - "Keep MCP shared-predicate and test-only-export ownership as operator decisions while routing the live null/scalar defects to Phase 2."
  - "Treat compiler-forced skills prototype surgery and parser-message ownership as operator decisions rather than assuming implementation policy."
patterns-established:
  - "Direct 100% coverage closes a historical missing-case claim only when the current replacement branch and focused rerun are identified."
requirements-completed: [RVAL-01, RVAL-02]
coverage:
  - id: D1
    description: Every actionable claim in corpus records 022 and 023 is linked to a terminal current finding.
    requirement: RVAL-01
    verification:
      - kind: other
        ref: "node scripts/revalidation.mjs validate-shard --assignment .planning/phases/01-live-evidence-revalidation/01-CORPUS-ASSIGNMENT.md --plan 01-14 --shard .planning/phases/01-live-evidence-revalidation/shards/01-14.json"
        status: pass
    human_judgment: false
  - id: D2
    description: Current MCP and skills owner tests and direct coverage evidence pass without live source or test edits.
    requirement: RVAL-02
    verification:
      - kind: unit
        ref: "node --test tests/bridges/mcp/*.test.ts tests/bridges/skills/*.test.ts"
        status: pass
      - kind: unit
        ref: "npm run test:coverage:direct for mcp stage/unstage and skills stage/discover"
        status: pass
    human_judgment: false
duration: 17min
completed: 2026-09-04
status: complete
---

# Phase 01 Plan 14: MCP and Skills Evidence Summary

**A validated 55-claim shard now distinguishes live MCP and skills defects from 15 positively superseded historical test gaps.**

## Performance

- **Duration:** 17 min
- **Started:** 2026-09-04T22:19:21Z
- **Completed:** 2026-09-04T22:36:21Z
- **Tasks:** 2
- **Files modified:** 1 task artifact

## Accomplishments

- Preserved and namespaced 24 MCP claims and 31 skills claims from the two assigned adversarial reports.
- Confirmed 40 live findings, positively closed 15 stale claims, and kept four architectural or policy choices for operator decision.
- Re-ran all 17 focused MCP and skills owners plus direct coverage for the four principal source modules; every command passed.

## Task Commits

1. **Task 1: Individually adjudicate corpus record 022** — `f7d194aa` (docs)
2. **Task 2: Individually adjudicate corpus record 023** — `a8d52d7d` (docs)

## Files Created/Modified

- `.planning/phases/01-live-evidence-revalidation/shards/01-14.json` — Exclusive normalized evidence shard for corpus records 022 and 023.

## Decisions Made

- Routed the still-live MCP null/scalar behavior and locale-sensitive skills ordering to Phase 2, ahead of test-only improvements.
- Kept shared predicate ownership, test-only exports, prototype-surgery treatment, and parser-message ownership open for operator decisions because each changes an intentional contract or repository policy.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

The assignment-scoped validator intentionally rejects a one-file partial shard because Plan 01-14 owns two corpus paths. Task 1 was committed after its file record was complete; the validator passed once Task 2 completed the exact assigned path set. Git metadata for the linked checkout required the approved escalation, and only the owned shard was staged.

## Known Stubs

None. The shard contains no pending or inconclusive records.

## Threat Flags

None. This plan adds evidence data only and introduces no endpoint, authentication path, schema boundary, or production file-access behavior.

## User Setup Required

None - no external services, credentials, network access, or real user state were used.

## Next Phase Readiness

The deterministic merge can consume this shard after the remaining exclusive review shards complete. Phase 2 and Phase 3 planning can use the route field without reinterpreting historical severity labels.

## Self-Check: PASSED

The shard and summary exist; task commits `f7d194aa` and `a8d52d7d` are present; the assignment validator, all 17 focused owners, and four direct-coverage commands pass.

---
*Phase: 01-live-evidence-revalidation*
*Completed: 2026-09-04*

---
phase: 01-live-evidence-revalidation
plan: 20
subsystem: testing
tags: [evidence-ledger, node-test, mutation-testing, edge]
requires:
  - phase: 01-live-evidence-revalidation
    provides: normalized revalidation schema and shard validator from plan 01-01
provides:
  - Terminal live evidence for adversarial corpus records 032 and 033
  - Isolated mutation proof for edge handler, router, and registration test-strength gaps
affects: [phase-02-fixes, operator-decisions, evidence-ledger-merge]
actuals:
  tokens: 12645
  tasks: 2
  commits: 1
tech-stack:
  added: []
  patterns: [namespaced source claims, repository-local isolated mutation probes, positive stale replacement proof]
key-files:
  created:
    - .planning/phases/01-live-evidence-revalidation/shards/01-20.json
  modified: []
key-decisions:
  - "Route the two closable D-116-01a index-loop shortfalls to operator decision because their accepted compiler-forced premises are contradicted by current iterable rewrites."
  - "Keep callback-recorder policy and speculative flag-visibility configuration as operator decisions rather than converting them mechanically."
patterns-established:
  - "Test-strength claims use mutations in a repository-local isolated copy; live source and test files remain unchanged."
  - "Historical no-run claims become stale only with a positive current focused rerun."
requirements-completed: [RVAL-01, RVAL-02]
coverage:
  - id: D1
    description: Corpus records 032 and 033 have complete namespaced claims linked to terminal findings.
    requirement: RVAL-01
    verification:
      - kind: other
        ref: "node scripts/revalidation.mjs validate-shard --assignment .planning/phases/01-live-evidence-revalidation/01-CORPUS-ASSIGNMENT.md --plan 01-20 --shard .planning/phases/01-live-evidence-revalidation/shards/01-20.json"
        status: pass
    human_judgment: false
  - id: D2
    description: Current evidence distinguishes structural findings, live behavior, surviving mutations, and positive stale replacement proof.
    requirement: RVAL-02
    verification:
      - kind: unit
        ref: "node --test tests/edge/handlers/shared.test.ts tests/edge/handlers/tools.test.ts tests/edge/args.test.ts tests/edge/args-schema.test.ts tests/edge/flag-catalog.test.ts tests/edge/router.test.ts tests/edge/register.test.ts tests/edge/types.test.ts"
        status: pass
    human_judgment: false
duration: 6min
completed: 2026-09-04
status: complete
---

# Phase 01 Plan 20: Edge Evidence Revalidation Summary

**Forty terminal findings preserve 52 historical edge claims with live CodeGraph evidence, focused reruns, direct coverage measurements, and five isolated surviving mutations.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-09-04T23:07:33Z
- **Completed:** 2026-09-04T23:13:33Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Reconciled every actionable claim in the two assigned adversarial reports into 26 namespaced claims per corpus file and 40 terminal findings.
- Reproduced the `edge/args.ts` and `edge/handlers/shared.ts` direct-coverage shortfalls and preserved their contradicted compiler-forced premises for operator disposition.
- Proved five test-strength gaps with repository-local isolated mutations: tool filter forwarding, logical source rendering, shared-handler default pass-through, router promise propagation, and command factory binding.
- Positively replaced both reports' historical no-test-run limitations with a passing live run of all eight focused suites.

## Task Commits

1. **Tasks 1-2: Individually adjudicate corpus records 032 and 033** — `32a2b233` (docs)

The root orchestrator committed both records together after the executor's linked-worktree Git metadata was read-only. The shard remains the single plan-owned artifact and validates as one atomic evidence unit.

## Files Created/Modified

- `.planning/phases/01-live-evidence-revalidation/shards/01-20.json` — Exclusive normalized evidence shard for corpus records 032 and 033.

## Decisions Made

- Routed the two iterable-loop coverage shortfalls to operator decision because live source evidence disproves the accepted claim that removing them requires forbidden assertions.
- Kept callback-recorder policy and the catalog's unused `parse`/`complete` distinction as operator decisions because either resolution changes a cross-file convention.
- Preserved high-quality whole-value, silence-proof, type-negative, and hermetic test patterns as evidence-only closures while routing distinct surviving mutations separately.

## Deviations from Plan

### Execution Adjustment

The two task records were committed together by the root orchestrator as `32a2b233` after the executor could not create the linked-worktree Git index lock. No source, test, corpus, or unrelated working-tree file was changed, and the exclusive shard validator passed before and after the root commit.

## Issues Encountered

- Linked-worktree Git metadata was read-only to this executor. The root orchestrator committed the validated shard and resumed this executor for documentation and tracking.
- Direct coverage intentionally exits nonzero for the two reproduced accepted shortfalls; both results are evidence findings, not unrun verification.

## Known Stubs

None. Every source claim links to a terminal current finding; the empty decisions and scopeChanges arrays are intentional for this evidence-only shard.

## User Setup Required

None - no external services, credentials, network access, or real user state were used.

## Next Phase Readiness

- Plan 01-55 can deterministically merge this complete exclusive shard after all assignments arrive.
- Phase 2 planning can consume the confirmed test-strength, documentation, type-contract, error-boundary, and injection-seam findings.
- Operator review is required before changing the two D-116-01a dispositions, callback-recorder convention, or unused flag-visibility model.

## Self-Check: PASSED

The shard and summary exist, commit `32a2b233` is present, both assigned files are complete with 26 claims each, all 40 findings are terminal, and the assignment-scoped validator passes.

---
*Phase: 01-live-evidence-revalidation*
*Completed: 2026-09-04*

---
phase: 01-live-evidence-revalidation
plan: 12
subsystem: testing
tags: [evidence-ledger, node-test, hooks, mutation-testing]
requires:
  - phase: 01-01
    provides: normalized shard schema, exact corpus assignment, and fail-closed validator
provides:
  - Claim-complete current evidence for adversarial corpus records 019 and 020
  - Independent routing for hooks exec-protocol and if-field findings
affects: [phase-02-production-defects, phase-03-test-quality, operator-decisions]
actuals:
  tokens: 26180
  tasks: 2
  commits: 2
tech-stack:
  added: []
  patterns: [namespaced source claims, isolated mutation copies, status-route separation]
key-files:
  created:
    - .planning/phases/01-live-evidence-revalidation/shards/01-12.json
    - .planning/phases/01-live-evidence-revalidation/01-12-SUMMARY.md
  modified: []
key-decisions:
  - "Keep unquoted compound command-substitution semantics as an operator decision because upstream parity is not established by repository evidence."
  - "Treat dead defensive compiler catches as an operator choice between deletion and explicitly accepted uncovered lines."
patterns-established:
  - "Test-strength claims use mutations in repository-local copied trees; structural claims use current CodeGraph and source proof."
requirements-completed: [RVAL-01, RVAL-02]
coverage:
  - id: D1
    description: Every actionable claim in corpus records 019 and 020 is linked to a terminal current finding.
    requirement: RVAL-01
    verification:
      - kind: other
        ref: "node scripts/revalidation.mjs validate-shard --assignment .planning/phases/01-live-evidence-revalidation/01-CORPUS-ASSIGNMENT.md --plan 01-12 --shard .planning/phases/01-live-evidence-revalidation/shards/01-12.json"
        status: pass
    human_judgment: false
  - id: D2
    description: Focused owner tests and isolated surviving-mutation probes complete without live source or test edits.
    requirement: RVAL-02
    verification:
      - kind: unit
        ref: "node --test focused hooks exec-protocol and if-field owner tests"
        status: pass
    human_judgment: false
duration: 12min
completed: 2026-09-04
status: complete
---

# Phase 01 Plan 12: Hooks Exec Protocol and If-Field Evidence Summary

**A validated 71-claim shard now reconciles hooks execution, environment, timer, wire-protocol, and `if:` compiler review claims against the live tree.**

## Performance

- **Duration:** 12 min
- **Completed:** 2026-09-04
- **Tasks:** 2
- **Files modified:** 1 task artifact

## Accomplishments

- Preserved and namespaced 32 actionable exec-protocol claims and 39 actionable if-field claims.
- Confirmed 69 live findings, positively closed two overstated prescriptions, and retained two semantic choices for operator decision.
- Ran focused owner tests plus isolated mutations for truncation markers, spawn discriminators, wire decisions, path containment, child exit fields, Bash parsing, and MCP literal equality.

## Task Commits

1. **Task 1: Individually adjudicate corpus record 019** — `0196966f` (docs)
2. **Task 2: Individually adjudicate corpus record 020** — `d8c5988e` (docs)

## Files Created/Modified

- `.planning/phases/01-live-evidence-revalidation/shards/01-12.json` — Exclusive normalized evidence shard for corpus records 019 and 020.

## Decisions Made

- Kept the intended semantics of unquoted compound command substitutions open for an operator because current behavior is observable but upstream parity is unresolved.
- Routed the dead defensive `if:` compiler catches to operator decision instead of assuming whether defensive coverage or code deletion is preferred.

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None. The shard has no pending or inconclusive records.

## Threat Flags

None. This plan adds evidence data only and introduces no endpoint, authentication path, schema boundary, or production file-access behavior.

## User Setup Required

None - no external services, credentials, network access, or real user state were used.

## Next Phase Readiness

The deterministic merge can consume this shard after the remaining exclusive review shards complete. Remediation planning can use the route field without reinterpreting historical severity labels.

## Self-Check: PASSED

The shard and summary exist; task commits `0196966f` and `d8c5988e` are present; the assignment-scoped validator and recorded focused tests pass.

---
*Phase: 01-live-evidence-revalidation*
*Completed: 2026-09-04*

---
phase: 01-live-evidence-revalidation
plan: 06
subsystem: testing
tags: [node-test, catalog-uat, evidence-ledger, mutation-testing]
requires:
  - phase: 01-live-evidence-revalidation
    provides: Normalized evidence schema, exclusive shard validator, and locked corpus assignment
provides:
  - Claim-complete current evidence for architecture catalog UAT reports 009-010
  - Routed catalog parser, driver, fixture, documentation, and cross-cutting findings
affects: [phase-02-test-repair, catalog-uat, notification-rendering, operator-decisions]
actuals:
  tokens: 16534
  tasks: 2
  commits: 2
tech-stack:
  added: []
  patterns: [namespaced source claims, duplicate-preserving reconciliation, isolated mutation evidence]
key-files:
  created:
    - .planning/phases/01-live-evidence-revalidation/shards/01-06.json
    - .planning/phases/01-live-evidence-revalidation/01-06-SUMMARY.md
  modified: []
key-decisions:
  - "Route the catalog UAT's live weaknesses to Phase 2 while preserving its measured key-parity and whole-byte strengths as evidence-only closure."
  - "Keep the 5,442-line catalog test split as an operator-sequenced decision that follows selection of a production section-emitter interface."
patterns-established:
  - "Independent reports that describe the same defect retain distinct source claims and link through duplicateOf."
  - "A stale local style remediation requires positive current replacement evidence, not silent deletion."
requirements-completed: [RVAL-01, RVAL-02]
coverage:
  - id: D1
    description: Both assigned catalog UAT reports are represented by claim-complete normalized records.
    requirement: RVAL-01
    verification:
      - kind: other
        ref: "node scripts/revalidation.mjs validate-shard --assignment .planning/phases/01-live-evidence-revalidation/01-CORPUS-ASSIGNMENT.md --plan 01-06 --shard .planning/phases/01-live-evidence-revalidation/shards/01-06.json"
        status: pass
    human_judgment: false
  - id: D2
    description: Current evidence separates live, duplicate, stale, routed, and retained-positive catalog claims without editing production or tests.
    requirement: RVAL-02
    verification:
      - kind: unit
        ref: "node --test tests/architecture/catalog-uat.test.ts"
        status: pass
      - kind: other
        ref: "repository-local isolated checkCatalogExample bypass mutation"
        status: pass
    human_judgment: false
duration: 10min
completed: 2026-09-04
status: complete
---

# Phase 01 Plan 06: Architecture Catalog UAT Revalidation Summary

**Forty-seven historical catalog UAT claims now have current, trace-preserving evidence across the parser, driver, fixture corpus, notification seams, and catalog documentation.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-09-04T21:21:00Z
- **Completed:** 2026-09-04T21:31:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Reconciled all actionable claims from both assigned reports into 47 linked source claims and findings: 35 confirmed, 11 duplicates, and one positively proven stale local remediation.
- Confirmed the largest live defect with current CodeGraph call paths: most catalog rows still exercise the legacy central renderer rather than the command-local production emitter.
- Reconfirmed the planted-failure gap with an isolated mutation that bypassed `checkCatalogExample`; the focused suite remained green, the temporary copy was removed, and live source/test files stayed unchanged.
- Preserved six evidence-only strengths, three deferred cross-cutting items, and one operator-sequenced file-split decision separately from the 37 Phase 2 routes.

## Task Commits

1. **Task 1: Individually adjudicate corpus record 009** — `72f7c67f` (docs)
2. **Task 2: Individually adjudicate corpus record 010** — `4e5ea8ec` (docs)

## Files Created/Modified

- `.planning/phases/01-live-evidence-revalidation/shards/01-06.json` — Exclusive two-report evidence shard with normalized file, source-claim, and finding ledgers.
- `.planning/phases/01-live-evidence-revalidation/01-06-SUMMARY.md` — Execution record and verification trace.

## Decisions Made

- Kept current evidence status independent from routing: positive strengths close as evidence-only, cross-cutting audits remain backlog items, and the file split remains an operator decision.
- Preserved duplicate historical claims from the second report with their own identities and linked them to the first report's canonical live findings.
- Closed the single-letter callback-name remediation as stale because current code positively proves subsystem-wide consistency; an isolated rename would reduce consistency rather than improve it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Deferred the exact-assignment validator until both sequential records existed**

- **Found during:** Task 1 verification
- **Issue:** The specified validator requires the shard's file list to exactly match both assigned paths, so the intended append-only intermediate shard containing only record 009 necessarily fails with `shard paths must exactly match assignment order`.
- **Fix:** Preserved the validated Task 1 adjudication in its atomic commit, appended record 010 in Task 2, then ran the exact command successfully against the complete exclusive shard.
- **Files modified:** `.planning/phases/01-live-evidence-revalidation/shards/01-06.json`
- **Verification:** Final assignment-scoped validator passes with two files and 47 complete claim links.
- **Committed in:** `72f7c67f`, `4e5ea8ec`

**Total deviations:** 1 auto-fixed (Rule 3: 1)
**Impact on plan:** No evidence, ownership, or task scope changed; only the validator timing followed its exact-ownership contract.

## Issues Encountered

The checkout is a linked Git worktree whose administrative index is outside the workspace write sandbox. Git staging and commits therefore required the normal approved Git escalation. Unrelated dirty configuration, instructions, CodeGraph data, MCP configuration, and the active milestone lock were left untouched and unstaged.

## Known Stubs

None. `decisions` and `scopeChanges` are intentionally empty because this shard records one decision-routed finding but does not resolve an operator decision or authorize a scope change.

## User Setup Required

None - no external services, credentials, network access, or real user state were used.

## Next Phase Readiness

The exclusive shard is ready for deterministic merge. Phase 2 has traceable repair inputs for production-emitter routing, driver mutation controls, parser cases, fixture cleanup, stale catalog usage text, documentation pointers, and notification-port narrowing.

## Self-Check: PASSED

The shard and summary exist; commits `72f7c67f` and `4e5ea8ec` are present; the exact assignment validator and focused catalog UAT both pass; no production or test source changed.

---
*Phase: 01-live-evidence-revalidation*
*Completed: 2026-09-04*

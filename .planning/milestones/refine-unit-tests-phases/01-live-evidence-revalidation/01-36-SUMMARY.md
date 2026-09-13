---
phase: 01-live-evidence-revalidation
plan: 36
subsystem: testing
tags: [evidence-ledger, unit-tests, path-safety, hermeticity]
requires:
  - phase: 01-01
    provides: strict shard schema, assignment validation, and normalized evidence contract
provides:
  - Claim-complete live adjudication of adversarial shared-core evidence
  - Hermetic reproduction of the unnormalized-child path containment escape
affects: [phase-02-remediation, phase-07-gates, operator-decisions, scope-reconciliation]
actuals:
  tokens: 18452
  tasks: 1
  commits: 1
tech-stack:
  added: []
  patterns: [CodeGraph-first evidence, explicit D-11 inconclusive dispositions, temporary-root behavioral probes]
key-files:
  created:
    - .planning/phases/01-live-evidence-revalidation/shards/01-36.json
    - .planning/phases/01-live-evidence-revalidation/01-36-SUMMARY.md
  modified: []
key-decisions:
  - "Treat green owner tests as executability evidence only, never as confirmation of named mutation strength."
  - "Keep mutation-dependent claims inconclusive when no isolated mutation was run, while confirming structural claims from current CodeGraph and source evidence."
patterns-established:
  - "Behavioral safety defects use hermetic temporary-root reproduction; live source and tests remain untouched."
requirements-completed: [RVAL-01, RVAL-02]
coverage:
  - id: D1
    description: Corpus record 061 is represented by one assignment-exact shard with all 57 extracted claims linked to current findings.
    requirement: RVAL-01
    verification:
      - kind: other
        ref: "node scripts/revalidation.mjs validate-shard --assignment .planning/phases/01-live-evidence-revalidation/01-CORPUS-ASSIGNMENT.md --plan 01-36 --shard .planning/phases/01-live-evidence-revalidation/shards/01-36.json"
        status: pass
    human_judgment: false
  - id: D2
    description: Current shared-core evidence separates confirmed structural/behavioral findings from mutation-dependent inconclusive claims without editing production or tests.
    requirement: RVAL-02
    verification:
      - kind: unit
        ref: "node --test tests/shared/{path-safety,fs-utils,errors,errors-bridges,atomic-json,notify-context,probe-classifiers,git-failure-classifiers,markers,extension-version,completion-cache,session-env,debug-log,vars,notify-reasons,types}.test.ts"
        status: pass
      - kind: other
        ref: "temporary-root assertPathInside traversal probe"
        status: pass
    human_judgment: false
duration: 5min
completed: 2026-09-04
status: complete
---

# Phase 01 Plan 36: Shared Core Evidence Revalidation Summary

**A 57-claim shared-core shard now records current structural evidence, explicit mutation gaps, and a hermetically reproduced path-containment escape.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-09-05T00:53:22Z
- **Completed:** 2026-09-05T00:58:07Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments

- Read the full 50,123-byte adversarial shared-core record and preserved 57 actionable claims as namespaced source records.
- Revalidated current symbols with CodeGraph and current source/test/config evidence, yielding 35 confirmed and 22 explicitly inconclusive findings.
- Reproduced the unnormalized-child containment escape in a disposable temporary root and ran all 16 current shared owner tests successfully.

## Task Commits

1. **Task 1: Individually adjudicate corpus record 061** — `8c25bd09` (docs)

## Files Created/Modified

- `.planning/phases/01-live-evidence-revalidation/shards/01-36.json` — Exclusive assignment-valid shard with 57 claims and findings.
- `.planning/phases/01-live-evidence-revalidation/01-36-SUMMARY.md` — Execution evidence and guarded-commit handoff.

## Decisions Made

- Confirmed static structural claims only where current code or call paths directly prove them.
- Kept test-strength claims inconclusive when their named mutation was not run; the green owner-test run was not treated as refutation.

## Deviations from Plan

None - plan execution and evidence scope followed the plan. The root orchestrator created the artifact commit because the executor isolation guard rejected the linked feature branch.

## Issues Encountered

The linked-worktree branch `features/refine-unit-tests` fails the executor's mandatory per-agent branch allow-list. No branch or Git metadata was altered, and no commit bypass was attempted.

## Known Stubs

None.

## User Setup Required

None - no external service, credential, network, or real user state was used.

## Next Phase Readiness

The shard is ready for deterministic merge. Its inconclusive findings remain visible for final Phase 1 evidence resolution rather than being silently promoted.

## Self-Check: PASSED

The shard and summary exist, artifact commit `8c25bd09` is present, the shard validator passes, all 57 claims link to 57 findings, and the focused 16-test owner run passes.

---
*Phase: 01-live-evidence-revalidation*
*Completed: 2026-09-04*

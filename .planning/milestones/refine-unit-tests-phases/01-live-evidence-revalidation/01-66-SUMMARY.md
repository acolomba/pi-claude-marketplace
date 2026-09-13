---
phase: 01-live-evidence-revalidation
plan: 66
subsystem: testing
tags: [operator-decision, direct-coverage, pre-commit, continuous-integration, fail-closed]
requires:
  - phase: 01-65
    provides: Resolved test-double naming policy and the final pending decision dossier
provides:
  - Resolved MF-DEC-09 with the operator-selected local and CI changed-pair enforcement policy
  - Exact ORR-F028 and TXA-F022 terminal premise and affected-root trace
  - Phase 7 GGAT-01, Phase 8 RCOV-01/RCOV-02/RCOV-03, and Phase 9 CLOSE-01 controls
affects: [phase-7-gate-integrity, phase-8-direct-coverage, phase-9-final-quality-closure]
actuals:
  tokens: 988296
  tasks: 1
  commits: 1
tech-stack:
  added: []
  patterns: [strict changed-pair gate, local-and-CI parity, fail-closed pair selection, honest coverage reporting]
key-files:
  created:
    - .planning/phases/01-live-evidence-revalidation/01-66-SUMMARY.md
  modified:
    - .planning/phases/01-live-evidence-revalidation/01-REVALIDATION.json
    - .planning/phases/01-live-evidence-revalidation/01-REVALIDATION.md
key-decisions:
  - "Run the same strict changed-pair coverage gate through a scoped local pre-commit hook and a dedicated CI job."
  - "Fail closed when CI cannot resolve its base or relevant changed paths select no pairs."
  - "Keep coverage as reachability evidence only and retain independent mutation and observable-result requirements."
patterns-established:
  - "Local and CI controls use one strict changed-pair gate and the same fail-closed selection rules."
  - "The all-pair report states retained shortfalls without an allowlist, ignore pragma, exclusion, or false green result."
requirements-completed: [RVAL-03]
coverage:
  - id: D1
    description: "MF-DEC-09 records the explicit local-and-CI selection from exactly ORR-F028 and TXA-F022."
    requirement: RVAL-03
    verification:
      - kind: integration
        ref: "node scripts/revalidation.mjs validate --decision MF-DEC-09"
        status: pass
      - kind: other
        ref: "node scripts/revalidation.mjs decision-dossier --id MF-DEC-09"
        status: pass
    human_judgment: false
  - id: D2
    description: "The record keeps MF-005, AUDIT-005, MF-009, and AUDIT-010 outside the exact two-root premise."
    requirement: RVAL-03
    verification:
      - kind: other
        ref: "canonical root, support, stale-record, and pending-decision semantic checks"
        status: pass
    human_judgment: false
  - id: D3
    description: "The downstream controls require fail-closed pair selection, honest reports, and independent assertion-strength evidence."
    requirement: RVAL-03
    verification:
      - kind: other
        ref: "canonical downstream-consequence semantic checks"
        status: pass
    human_judgment: false
duration: 23min
completed: 2026-09-05
status: complete
---

# Phase 01 Plan 66: Direct Coverage Enforcement Policy Summary

**MF-DEC-09 now requires the same strict changed-pair coverage gate in local pre-commit checks and a dedicated CI job.**

## Performance

- **Duration:** 23 min
- **Started:** 2026-09-05T19:36:54Z
- **Completed:** 2026-09-05T20:00:06Z
- **Tasks:** 1
- **Files modified:** 3

## Accomplishments

- Presented only MF-DEC-09 from current CodeGraph, script, configuration, test, and terminal-ledger evidence.
- Recorded the operator's option-1 selection for local and CI enforcement of the strict changed-pair gate.
- Limited the premise and affected scope to the two terminal roots `ORR-F028` and `TXA-F022`.
- Required the local hook and CI job to use the same fail-closed pair selection and strict hit-equals-found rule.
- Kept all-pair reporting honest while the seven current shortfalls remain.
- Preserved mutation and observable-result evidence as requirements that numeric coverage cannot replace.

## Task Commits

1. **Task 1: Decide MF-DEC-09 — test:coverage:direct enforcement workstream** — `9a558f36`

## Files Created/Modified

- `.planning/phases/01-live-evidence-revalidation/01-REVALIDATION.json` — Resolved MF-DEC-09 with two exact roots, three choices, explicit selection, rejected alternatives, and downstream controls.
- `.planning/phases/01-live-evidence-revalidation/01-REVALIDATION.md` — Regenerated the operator-readable record with MF-DEC-09 resolved.
- `.planning/phases/01-live-evidence-revalidation/01-66-SUMMARY.md` — Records the decision outcome, trace, evidence, and Plan 01-67 handoff.

## Decisions Made

- Selected `Enforce changed pairs locally and in CI` over CI-only or pre-commit-only enforcement.
- Use a source-and-test-scoped local hook for early feedback and a dedicated CI job for authoritative enforcement.
- Fail closed when CI cannot resolve the pull-request base or relevant changes select no pairs.
- Keep the slow positive gate outside `npm run check` and preserve the negative control as a separate artifact.
- Do not use accepted-shortfall allowlists, ledger-keyed passes, coverage ignore pragmas, blanket exclusions, or false green reports.

## Premise and Route Trace

`premiseFindingIds` and `affectedIds` are both exactly these terminal roots:

- `ORR-F028`
- `TXA-F022`

Neither root has a duplicate or alias chain. The current tool inventories 204 source-test pairs and applies strict hit-equals-found coverage.

- `MF-005` and `AUDIT-005` remain supporting composite records. Their other observations keep independent routes.
- `MF-009` remains umbrella decision provenance instead of a specific premise substitute.
- `AUDIT-010` remains stale because the historical retained report is absent. Phase 8 must create a current baseline.
- Historical claims that the repository never measured direct coverage are stale after the current focused measurements.

## Downstream Requirements

- Phase 7 `GGAT-01` must test changed-pair discovery and CI base selection with explicit target-visitation evidence.
- `GGAT-01` must include a synthetic offender, a benign control, and a zero-selection case.
- Phase 8 `RCOV-01` must create a complete current baseline for all 204 pairs from the milestone branch.
- Phase 8 `RCOV-02` must complete the selected honest rewrites and reclassify all seven carried shortfalls before enforcement.
- Phase 8 `RCOV-03` must add the scoped local hook and the dedicated CI job with one shared changed-pair gate.
- CI must resolve the pull-request base deterministically, list the expected pairs, and report the selected pair count.
- A changed retained-shortfall pair must fail until an honest source correction or an explicit policy revision occurs.
- The all-pair report must state refused rows accurately. The strict all-pair command cannot appear green while shortfalls remain.
- Coverage proves reachability only. Mutation, public-result, state, byte-output, ordering, and other assertion-strength requirements remain independent.
- Phase 9 `CLOSE-01` must test both enforcement paths, their negative and visitation controls, the baseline, the report, and the full quality suite.

## Verification

- `node scripts/revalidation.mjs render` passed before the task commit. The generated Markdown matches the JSON source.
- `node scripts/revalidation.mjs validate --decision MF-DEC-09` passed with `Revalidation ledger valid.`
- `node scripts/revalidation.mjs decision-dossier --id MF-DEC-09` passed with the two exact roots and selected choice.
- Canonical semantic checks passed for identical premise and affected arrays, three choices, two rejected alternatives, and all downstream controls.
- The pending-decision census passed with zero pending decisions.
- The commit-scope check passed. Commit `9a558f36` contains only the canonical JSON and generated Markdown.
- `git diff --check` passed for the task commit's canonical files.

## Deviations from Plan

None. The surviving premise reached the operator as one dossier, and the record contains the explicit selection.

## Issues Encountered

None.

## Known Stubs

None. All nine operator decisions are terminal.

## User Setup Required

None. This plan required no credentials, network access, package installation, or external service configuration.

## Next Phase Readiness

Plan 01-67 can derive the complete evidence-backed scope-impact crosswalk. All findings and all nine operator decisions are terminal.

## Self-Check: PASSED

- All three plan-owned artifacts exist.
- Task commit `9a558f36` exists and contains only the canonical JSON and generated Markdown.
- The named-decision validation and dossier commands pass.
- MF-DEC-09 has identical exact two-root premise and affected arrays, and no decision remains pending.

---
*Phase: 01-live-evidence-revalidation*
*Completed: 2026-09-05*

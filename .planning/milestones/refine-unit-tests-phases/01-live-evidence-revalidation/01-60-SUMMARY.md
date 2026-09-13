---
phase: 01-live-evidence-revalidation
plan: 60
subsystem: testing
tags: [operator-decision, reconcile, marketplace-alias, source-claim-map, fixed-point]
requires:
  - phase: 01-59
    provides: Evidence-only closure of stale MF-DEC-04 and seven remaining decision dossiers
provides:
  - Resolved MF-DEC-05 with the operator-selected one-to-one source-claim mapping policy
  - Exact ORA-F03 and ORA-F33 premise and affected-root trace
  - Phase 3 PDEF-08 implementation and PDEF-01 convergence-test consequences
affects: [phase-3-production-defects, pdef-08-reconcile-alias, pdef-01-regression-evidence]
actuals:
  tokens: 983065
  tasks: 1
  commits: 1
tech-stack:
  added: []
  patterns: [one-to-one alias resolution, manifest-derived canonical identity, fail-closed mapping]
key-files:
  created:
    - .planning/phases/01-live-evidence-revalidation/01-60-SUMMARY.md
  modified:
    - .planning/phases/01-live-evidence-revalidation/01-REVALIDATION.json
    - .planning/phases/01-live-evidence-revalidation/01-REVALIDATION.md
key-decisions:
  - "Resolve declared plugin marketplace keys through a one-to-one source-claim map while preserving manifest-derived names as canonical state identity."
  - "Fail closed on missing or ambiguous alias mappings, route implementation through PDEF-08 and regression evidence through PDEF-01, and preserve ORA-F04/F07/F13 independently."
patterns-established:
  - "A behavioral policy decision cites exact terminal roots and leaves supporting test findings under their own routes."
  - "Alias compatibility can be retained without rekeying durable state by translating only at the reconcile classification boundary."
requirements-completed: [RVAL-03]
coverage:
  - id: D1
    description: "MF-DEC-05 records the explicit option-1 selection from exactly two confirmed terminal roots, ORA-F03 and ORA-F33, with the other two alternatives rejected."
    requirement: RVAL-03
    verification:
      - kind: integration
        ref: "node scripts/revalidation.mjs validate --decision MF-DEC-05"
        status: pass
      - kind: other
        ref: "node scripts/revalidation.mjs decision-dossier --id MF-DEC-05"
        status: pass
    human_judgment: false
  - id: D2
    description: "The selected policy preserves CR-01 alias support and manifest-derived canonical state identity while requiring one-to-one fail-closed mapping across every plugin action bucket."
    requirement: RVAL-03
    verification:
      - kind: other
        ref: "canonical semantic assertion over recommendation and downstream consequences"
        status: pass
    human_judgment: false
  - id: D3
    description: "ORA-F04, ORA-F07, and ORA-F13 remain confirmed under independent routes, and exactly MF-DEC-02/03/06/07/08/09 remain pending."
    requirement: RVAL-03
    verification:
      - kind: other
        ref: "canonical supporting-finding and pending-decision census"
        status: pass
    human_judgment: false
duration: 18min
completed: 2026-09-05
status: complete
---

# Phase 01 Plan 60: Reconcile Alias Mapping Policy Summary

**MF-DEC-05 now preserves marketplace aliases through a one-to-one reconcile mapping while retaining manifest-derived canonical state identity and fixed-point behavior.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-09-05T16:36:50Z
- **Completed:** 2026-09-05T16:55:07Z
- **Tasks:** 1
- **Files modified:** 3

## Accomplishments

- Presented only MF-DEC-05 from the current behavioral reproduction and CodeGraph call-path evidence.
- Recorded the operator's explicit option-1 selection to resolve declared plugin keys through a one-to-one source-claim map.
- Preserved the existing CR-01 alias contract and manifest-derived canonical state name without introducing migration or late remote-validation behavior.
- Routed complete plugin-bucket implementation through Phase 3 `PDEF-08` and distinct alias/tools fixed-point regression evidence through `PDEF-01`.
- Kept `ORA-F04`, `ORA-F07`, and `ORA-F13` confirmed and independently routed rather than treating them as resolved by the policy choice.

## Task Commits

1. **Task 1: Decide MF-DEC-05 — CR-01 / P-1 reconcile plugin-tier dead end** — `97ef96da`

## Files Created/Modified

- `.planning/phases/01-live-evidence-revalidation/01-REVALIDATION.json` — Resolved MF-DEC-05 with two terminal roots, three options, the explicit selection, rejection rationale, and downstream requirements.
- `.planning/phases/01-live-evidence-revalidation/01-REVALIDATION.md` — Regenerated decision status showing MF-DEC-05 resolved.
- `.planning/phases/01-live-evidence-revalidation/01-60-SUMMARY.md` — Decision outcome, trace, verification, and next-dossier handoff.

## Decisions Made

- Selected `Resolve declared plugin keys through the one-to-one source-claim map` over persisting the alias as state identity or rejecting aliases.
- The mapping translates declared marketplace keys to recorded manifest-derived names for install, enable, disable, and uninstall classification. It must be one-to-one and fail closed when missing or ambiguous.
- Rejected alias-backed state identity because of migration, collision, and cross-command identity blast radius.
- Rejected alias prohibition because it breaks existing configuration and can make remote-source mismatch validation occur only after materialization.

## Premise and Route Trace

`premiseFindingIds` and `affectedIds` are both exactly `ORA-F03` and `ORA-F33`.

- `ORA-F03` behaviorally reproduces a planned plugin install targeting an alias that is neither recorded nor planned for add.
- `ORA-F33` establishes that current fixtures never distinguish the declared alias from the manifest-derived name.
- `ORA-F04`, `ORA-F07`, and `ORA-F13` remain independent confirmed findings under their existing routes. Their dead-condition, declared-name guard, and differing-name fixture work must be coordinated with implementation but is not closed here.

## Downstream Requirements

- Phase 3 `PDEF-08`: carry the one-to-one alias mapping through install, enable, disable, and uninstall classification while preserving canonical recorded identity.
- Phase 3 `PDEF-01`: use independently authored `alias` and `tools` values, assert exact plan targets, apply twice, and prove fixed-point convergence without repeated failure or network work.

## Verification

- `node scripts/revalidation.mjs render` — passed; generated Markdown is byte-current.
- `node scripts/revalidation.mjs validate --decision MF-DEC-05` — passed: `Revalidation ledger valid.`
- `node scripts/revalidation.mjs decision-dossier --id MF-DEC-05` — passed with exact roots `ORA-F03` and `ORA-F33` and the selected option.
- Canonical semantic assertion — passed: three exact options, recommendation matches the selection, PDEF-08/PDEF-01 consequences are present, and supporting findings retain their current status and routes.
- Pending-decision census — passed: exactly MF-DEC-02, MF-DEC-03, and MF-DEC-06 through MF-DEC-09 remain pending.
- `git diff --check` over both plan-owned canonical files — passed.

## Deviations from Plan

None - the surviving premise reached the operator as one dossier and the explicit selection was recorded as planned.

## Issues Encountered

None.

## Known Stubs

None. The six remaining pending records are assigned decision dossiers, not implementation placeholders.

## User Setup Required

None - no credentials, network access, package installation, or external service configuration was required.

## Next Phase Readiness

Plan 01-61 can evaluate only MF-DEC-06 from terminal current evidence. MF-DEC-01, MF-DEC-04, and MF-DEC-05 are resolved; MF-DEC-02, MF-DEC-03, and MF-DEC-06 through MF-DEC-09 remain pending.

## Self-Check: PASSED

- All three plan-owned artifacts exist.
- Task commit `97ef96da` exists and contains only canonical JSON and generated Markdown.
- Named-decision validation and dossier generation pass.
- MF-DEC-05 has exact premise and affected roots `ORA-F03` and `ORA-F33`, while the six expected dossiers remain pending.

---
*Phase: 01-live-evidence-revalidation*
*Completed: 2026-09-05*

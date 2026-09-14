---
phase: 01-live-evidence-revalidation
plan: 58
subsystem: testing
tags: [operator-decision, unreachable-branches, prototype-surgery, decision-dossier, validator-seam]
requires:
  - phase: 01-57
    provides: Terminal zero-inconclusive evidence ledger with nine pending operator decisions
provides:
  - Resolved MF-DEC-01 with the operator-selected trace-preserving removal policy
  - Exact 24-root premise and affected-finding trace for unreachable and artificial branch cases
  - Decision-scoped validation that permits later named dossiers to remain pending
affects: [phase-3-production-defects, phase-4-test-hermeticity, phase-5-public-contracts, phase-6-test-refinement, phase-8-direct-coverage]
actuals:
  tokens: 997186
  tasks: 1
  commits: 2
tech-stack:
  added: []
  patterns: [one-decision validation scope, terminal-premise dossiers, trace-preserving removal]
key-files:
  created:
    - .planning/phases/01-live-evidence-revalidation/01-58-SUMMARY.md
  modified:
    - .planning/phases/01-live-evidence-revalidation/01-REVALIDATION.json
    - .planning/phases/01-live-evidence-revalidation/01-REVALIDATION.md
    - scripts/revalidation.mjs
    - tests/architecture/revalidation.test.ts
key-decisions:
  - "Select trace-preserving removal for MF-DEC-01: remove dead or no-producer branches and dishonest cases, preserve only compiler-required or genuinely safety-critical checks with current evidence, and replace reachable surgery with case-owned behavior."
  - "Route the selected policy through PDEF-01/PDEF-07, TREF-03, TREF-06, TREF-08, and RCOV-02 while withholding pid-table changes until a dedicated terminal finding exists."
patterns-established:
  - "Named decision validation evaluates only the requested dossier's pending status while retaining full validation for every other ledger invariant."
  - "A decision may cite unmodeled review context as corroboration, but that context grants no implementation authority without a terminal canonical finding."
requirements-completed: [RVAL-03]
coverage:
  - id: D1
    description: "MF-DEC-01 is resolved from 24 confirmed terminal canonical roots with three viable options, one explicit operator selection, rejected alternatives, and matching affected IDs."
    requirement: RVAL-03
    verification:
      - kind: integration
        ref: "node scripts/revalidation.mjs validate --decision MF-DEC-01"
        status: pass
      - kind: other
        ref: "node scripts/revalidation.mjs decision-dossier --id MF-DEC-01"
        status: pass
    human_judgment: false
  - id: D2
    description: "Decision-scoped validation accepts MF-DEC-01 while MF-DEC-02 through MF-DEC-09 remain pending and rejects either a pending selected dossier or an unknown dossier ID."
    requirement: RVAL-03
    verification:
      - kind: integration
        ref: "node --test tests/architecture/revalidation.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "The selected policy records exact downstream requirement ownership and grants no pid-table implementation authority from source-only context."
    requirement: RVAL-03
    verification:
      - kind: other
        ref: "canonical decision semantic assertion over selected option, affected IDs, downstream consequences, and remaining pending set"
        status: pass
    human_judgment: false
duration: 58min
completed: 2026-09-05
status: complete
---

# Phase 01 Plan 58: Trace-Preserving Branch Policy Summary

**MF-DEC-01 now selects trace-preserving removal from 24 terminal premise roots, separating dead code, honest behavior, compiler constraints, and true safety checks without manufacturing coverage.**

## Performance

- **Duration:** 58 min
- **Started:** 2026-09-05T15:28:39Z
- **Completed:** 2026-09-05T16:26:46Z
- **Tasks:** 1
- **Files modified:** 5

## Accomplishments

- Presented only MF-DEC-01 after confirming that its current premise survived as a multi-class policy question rather than the historical binary choice.
- Recorded the operator's explicit option-1 selection, `Trace-preserving removal`, together with all three viable options, concise rejection rationales, the D-17 recommendation, and exact Phase 3, 4, 5, 6, and 8 consequences.
- Linked the decision to 24 confirmed terminal canonical roots in identical `premiseFindingIds` and `affectedIds` arrays; no duplicate or umbrella finding substitutes for a specific root.
- Preserved genuinely safety-critical checks without coverage pragmas or dishonest cases, and explicitly denied pid-table implementation authority because its supporting review note has no dedicated terminal finding.
- Repaired named-decision validation so the selected dossier can close independently while the eight later dossiers remain pending.

## Task Commits

1. **Task 1: Decide MF-DEC-01 — unreachable branches, prototype surgery, and their several resolutions** — `7c47dce1`

Supporting prerequisite repair, not counted as the decision task commit:

- **Scope validation to the named decision and add regression coverage** — `723e52ed`

## Files Created/Modified

- `.planning/phases/01-live-evidence-revalidation/01-REVALIDATION.json` — Resolved MF-DEC-01 record with terminal premises, options, selection, rejections, recommendation, affected roots, and downstream consequences.
- `.planning/phases/01-live-evidence-revalidation/01-REVALIDATION.md` — Regenerated decision status showing MF-DEC-01 resolved and the other eight dossiers pending.
- `scripts/revalidation.mjs` — Decision-specific validation scope and unknown-decision rejection.
- `tests/architecture/revalidation.test.ts` — Regression cases for resolved, pending, and unknown named dossiers.
- `.planning/phases/01-live-evidence-revalidation/01-58-SUMMARY.md` — Decision outcome, prerequisite repair, verification, and handoff.

## Decisions Made

- Selected `Trace-preserving removal` over `Conservative retention` and `Testability-first production seams/contracts`.
- Dead and no-producer branches lose their artificial tests; compiler-required or genuinely safety-critical checks remain only with explicit current evidence; reachable failures use case-owned behavior; over-wide surfaces are narrowed or privatized; production restructures occur only where they create legitimate behavior; and the two removable D-116 index loops are rewritten.
- Routed production cleanup through Phase 3 `PDEF-01` and `PDEF-07`, dishonest fixtures through Phase 4 `TREF-03`, test-only or over-wide surfaces through Phase 5 `TREF-06`, shared-process surgery through Phase 6 `TREF-08`, and shortfall correction through Phase 8 `RCOV-02`.
- Treated the pid-table `assertPathInside` discussion as corroborating source context only. It has no affected finding ID and authorizes no change unless a dedicated terminal finding is added first.

## Premise Trace

The decision's 24 terminal canonical roots are:

`BA-009`, `BA-012`, `BC-003`, `BC-004`, `BC-013`, `BC-017`, `BC-019`, `BC-021`, `BSKL-013`, `DC-008`, `DC-033`, `EHR-F09`, `ER-F19`, `HIF-037`, `HRA-010`, `OMR-F13`, `ORN-F011`, `ORN-F016`, `PER-F020`, `SHC-F004`, `SHC-F023`, `SHC-F054`, `SNA-F007`, and `SNC-F023`.

All 24 are confirmed, terminal, nonduplicate roots. Broad `MF-009` remains provenance for all nine decisions and is intentionally not used as an MF-DEC-01 premise.

## Verification

- `node scripts/revalidation.mjs render` — passed; generated Markdown is byte-current.
- `node scripts/revalidation.mjs validate --decision MF-DEC-01` — passed: `Revalidation ledger valid.`
- `node scripts/revalidation.mjs decision-dossier --id MF-DEC-01` — passed with 24 premises and selected option `Trace-preserving removal`.
- Decision semantic assertion — passed: 24 unique confirmed roots, identical premise/affected arrays, three options, two rejected alternatives, and exactly MF-DEC-02 through MF-DEC-09 pending.
- `node --test tests/architecture/revalidation.test.ts` — passed, including resolved-selected, pending-selected, and unknown-decision cases.
- `git diff --check` over all plan-owned files — passed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Scoped validation to the named operator decision**

- **Found during:** Task 1 prerequisite validation
- **Issue:** The plan-mandated `validate --decision MF-DEC-01` command still rejected every other pending decision, making sequential one-dossier closure impossible.
- **Fix:** Threaded the requested decision ID into ledger validation, limited pending-status enforcement to that named dossier, added explicit unknown-decision rejection, and covered the resolved, pending, and unknown paths.
- **Files modified:** `scripts/revalidation.mjs`, `tests/architecture/revalidation.test.ts`
- **Commit:** `723e52ed`

## Issues Encountered

The pid-table defense-in-depth note in the source review is intentionally not a canonical finding. The decision preserves it as context but does not invent an affected ID or authorize work from unmodeled evidence.

## Known Stubs

None. The remaining eight pending records are assigned operator dossiers, not implementation placeholders.

## User Setup Required

None - no credentials, network access, package installation, or external service configuration was required.

## Next Phase Readiness

Plan 01-59 can present only MF-DEC-04 from terminal current evidence. MF-DEC-01 is durably resolved, and MF-DEC-02 through MF-DEC-09 remain pending except for no change to their ordering or premises.

## Self-Check: PASSED

- All five plan-owned artifacts exist.
- Both commits exist, with `7c47dce1` as the decision task and `723e52ed` as the prerequisite repair.
- Named-decision validation and the architecture regressions pass.
- MF-DEC-01 is the sole resolved decision; the exact eight expected dossiers remain pending.

---
*Phase: 01-live-evidence-revalidation*
*Completed: 2026-09-05*

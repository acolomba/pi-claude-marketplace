---
phase: 01-live-evidence-revalidation
plan: 62
subsystem: testing
tags: [operator-decision, module-splits, test-ownership, direct-coverage, gate-integrity]
requires:
  - phase: 01-61
    provides: Resolved cardinality policy and five remaining decision dossiers
provides:
  - Resolved MF-DEC-02 with the operator-selected complete sequenced module-split program
  - Exact 12-root premise and affected trace across catalog, resolver, notify, install, update, reinstall, and list
  - Prerequisite-gated Phase 6 TREF-09 execution policy with mandatory post-split controls
affects: [phase-3-production-defects, phase-5-ownership, phase-6-module-refinement, phase-7-gate-integrity, phase-8-direct-coverage]
actuals:
  tokens: 983679
  tasks: 1
  commits: 1
tech-stack:
  added: []
  patterns: [sequenced module extraction, mirrored source-test ownership, post-split checklist, direct-pair coverage]
key-files:
  created:
    - .planning/phases/01-live-evidence-revalidation/01-62-SUMMARY.md
  modified:
    - .planning/phases/01-live-evidence-revalidation/01-REVALIDATION.json
    - .planning/phases/01-live-evidence-revalidation/01-REVALIDATION.md
key-decisions:
  - "Execute the complete resolver, notify, install, update, reinstall, list, and catalog split program only after its behavior and assertion prerequisites."
  - "Treat coherent responsibility and ownership seams as the justification; file size alone never authorizes extraction."
  - "Keep info deferred and uninstall unsplit while every approved split carries mirrored test ownership, direct coverage, and the four-part checklist."
patterns-established:
  - "Module extraction follows proven production responsibility seams and retains one end-to-end wiring proof per command flow."
  - "Every moved symbol carries its scanning gates, documentation, paired-test ownership, and completeness invariants with it."
requirements-completed: [RVAL-03]
coverage:
  - id: D1
    description: "MF-DEC-02 records the explicit complete-program selection from exactly 12 confirmed terminal premise and affected roots."
    requirement: RVAL-03
    verification:
      - kind: integration
        ref: "node scripts/revalidation.mjs validate --decision MF-DEC-02"
        status: pass
      - kind: other
        ref: "node scripts/revalidation.mjs decision-dossier --id MF-DEC-02"
        status: pass
    human_judgment: false
  - id: D2
    description: "The decision preserves duplicate chains and stale exclusions while including list and leaving info and uninstall outside the authorized split scope."
    requirement: RVAL-03
    verification:
      - kind: other
        ref: "canonical premise, duplicate, exclusion, and independent-route semantic checks"
        status: pass
    human_judgment: false
  - id: D3
    description: "All approved splits are prerequisite-gated and routed through TREF-09 with mirrored owner tests, one end-to-end proof per flow, no test-only exports, the four-part checklist, and direct-pair coverage."
    requirement: RVAL-03
    verification:
      - kind: other
        ref: "canonical downstream-consequence semantic checks"
        status: pass
    human_judgment: false
duration: 24min
completed: 2026-09-05
status: complete
---

# Phase 01 Plan 62: Sequenced Module-Split Policy Summary

**MF-DEC-02 now authorizes the complete resolver, notify, install, update, reinstall, list, and catalog split program only after its correctness and test-strength prerequisites.**

## Performance

- **Duration:** 24 min
- **Started:** 2026-09-05T17:17:14Z
- **Completed:** 2026-09-05T17:41:20Z
- **Tasks:** 1
- **Files modified:** 3

## Accomplishments

- Presented only MF-DEC-02 from current CodeGraph, source, test, and terminal-ledger evidence.
- Recorded the operator's explicit option-1 selection for the complete sequenced split program.
- Preserved the five prerequisite groups and made the four-part post-split checklist mandatory for every extraction.
- Routed all approved boundaries through Phase 6 `TREF-09` with one mirrored owner test per new production module, one end-to-end proof per command flow, no test-only exports, and direct-pair coverage.
- Included the later list-only split, retained info as independent deferred work, and excluded cohesive uninstall.

## Task Commits

1. **Task 1: Decide MF-DEC-02 — Module splits and the post-split checklist** — `dee2c725`

## Files Created/Modified

- `.planning/phases/01-live-evidence-revalidation/01-REVALIDATION.json` — Resolved MF-DEC-02 with its exact terminal roots, explicit selection, rejected alternatives, prerequisites, checklist, and downstream routes.
- `.planning/phases/01-live-evidence-revalidation/01-REVALIDATION.md` — Regenerated decision status showing MF-DEC-02 resolved.
- `.planning/phases/01-live-evidence-revalidation/01-62-SUMMARY.md` — Decision outcome, evidence trace, verification, and next-dossier handoff.

## Decisions Made

- Selected `Complete sequenced split program` over a leaf-first partial program or deferring all splits.
- Approved resolver, notify, install, update, reinstall, list, and catalog boundaries only after current behavior and assertion-strength prerequisites land.
- Required coherent production ownership rather than size-only extraction, with no test-only exports or weakened cases.
- Kept `OPIFP-F009` and supporting info records independent and deferred; uninstall remains a cohesive unsplit transaction owner.

## Premise and Route Trace

`premiseFindingIds` and `affectedIds` are both exactly these 12 terminal roots:

- `ACUB-019`, `DCH-034`, and `DRA-028`
- `.planning/reviews/unit-test-adversarial/adversarial/orchestrators-plugin-install-a.md#OPIA-F24`
- `.planning/reviews/unit-test-adversarial/adversarial/orchestrators-plugin-install-b.md#OPIB-F24`
- `.planning/reviews/unit-test-adversarial/adversarial/orchestrators-plugin-install-c.md#OPIC-F17`
- `OPINFP-F010`, `OPLU-A-F16`, `OPLUFP-F003`, `OPR-B-F22`, `OPU-B-F28`, and `SNA-F021`

The decision follows resolver, reinstall, update, and notify duplicate chains to those terminal roots. Stale or superseded historical gate and tooling records remain excluded. `ACF-F006`, `ACUA-024`, `SNB-F022`, `SNA-F018`, `SNC-F020`, `OPIA-F37`, and `OPIFP-F009` remain supporting or independent rather than being silently resolved.

## Sequencing and Downstream Requirements

- Phase 2 and Phase 3 prerequisites land first: the catalog production-emitter contract, resolver `name`/`agents`/unsupported-set proofs, install assertion conversion, reinstall's seven duplicate-pair consolidation, and the named install clone-probe/version seam.
- Phase 3 `PDEF-01` owns confirmed production behavior repair, including the catalog emitter path, before boundary movement.
- Phase 5 `TREF-06` ensures moved exports remain genuine public contracts and removes or privatizes test-only surfaces.
- Phase 6 `TREF-07` completes the prerequisite assertion and duplicate-case cleanup.
- Phase 6 `TREF-09` executes every approved split at coherent named seams with mirrored paired tests, one end-to-end proof per flow, no test-only exports, and direct-pair coverage.
- Every split repoints source-scanning gates, documentation for moved literals, test ownership for moved exports, and completeness invariants used by casts left in the old owner.
- Phase 7 `GGAT-01` and `GGAT-04` verify relocated gates against real production consumers.
- Phase 8 `RCOV-01` and `RCOV-03` regenerate and enforce the direct-pair baseline for every new owner.

## Verification

- `node scripts/revalidation.mjs render` — passed before task commit; generated Markdown is current.
- `node scripts/revalidation.mjs validate --decision MF-DEC-02` — passed: `Revalidation ledger valid.`
- `node scripts/revalidation.mjs decision-dossier --id MF-DEC-02` — passed with the exact 12 roots and selected option.
- Canonical semantic checks — passed for identical premise/affected arrays, three options, two rejected alternatives, all prerequisites, the checklist, duplicate and stale treatment, deferred info, and excluded uninstall.
- Pending-decision census — passed: exactly `MF-DEC-03`, `MF-DEC-07`, `MF-DEC-08`, and `MF-DEC-09` remain pending.
- `git diff --check` over the task commit's canonical files — passed.

## Deviations from Plan

None - the surviving premise reached the operator as one dossier and the explicit selection was recorded as planned.

## Issues Encountered

None.

## Known Stubs

None. The four remaining pending records are assigned decision dossiers, not implementation placeholders.

## User Setup Required

None - no credentials, network access, package installation, or external service configuration was required.

## Next Phase Readiness

Plan 01-63 can evaluate only MF-DEC-03 from terminal current evidence. MF-DEC-01, MF-DEC-02, MF-DEC-04, MF-DEC-05, and MF-DEC-06 are resolved; exactly MF-DEC-03, MF-DEC-07, MF-DEC-08, and MF-DEC-09 remain pending.

## Self-Check: PASSED

- All three plan-owned artifacts exist.
- Task commit `dee2c725` exists and contains only canonical JSON and generated Markdown.
- Named-decision validation and dossier generation pass.
- MF-DEC-02 has the exact 12 premise and affected roots, and the four expected dossiers remain pending.

---
*Phase: 01-live-evidence-revalidation*
*Completed: 2026-09-05*

---
phase: 01-live-evidence-revalidation
plan: 64
subsystem: testing
tags: [operator-decision, builtin-patching, hermeticity, filesystem-ports, test-isolation]
requires:
  - phase: 01-63
    provides: Resolved behavioral-composition policy and three remaining decision dossiers
provides:
  - Resolved MF-DEC-07 with the operator-selected classify-and-eliminate policy for builtin namespace patching
  - Exact 11-root premise and affected trace with a current 13-file and 80-call census
  - Coordinated Phase 5 TREF-04, Phase 6 TREF-08, and Phase 6 TREF-09 implementation constraints
affects: [phase-5-injection-and-ownership, phase-6-assertion-and-module-refinement, direct-pair-coverage]
actuals:
  tokens: 985961
  tasks: 1
  commits: 1
tech-stack:
  added: []
  patterns: [case-owned temporary filesystem, consumer-owned filesystem port, process-global patch retirement]
key-files:
  created:
    - .planning/phases/01-live-evidence-revalidation/01-64-SUMMARY.md
  modified:
    - .planning/phases/01-live-evidence-revalidation/01-REVALIDATION.json
    - .planning/phases/01-live-evidence-revalidation/01-REVALIDATION.md
key-decisions:
  - "Classify each builtin-patching use and eliminate process-global mutation, using real temporary filesystem behavior by default and narrow production-owned ports only for irreproducible faults or timing."
  - "Do not add test-only exports, __deps members, unused defaults, or dead seams while implementing TREF-04 and TREF-08."
  - "Keep BC-004 under MF-DEC-01 and require a dedicated terminal finding before changing bridges/skills/stage.test.ts."
patterns-established:
  - "Filesystem failure cases use real case-owned state when portable; deterministic timing, schedule, rollback, probe, hydration, and state-read control use narrow production-owned ports."
  - "Removing syncBuiltinESMExports is insufficient if a shared builtin object remains mutated; hermeticity requires eliminating the process-global replacement itself."
requirements-completed: [RVAL-03]
coverage:
  - id: D1
    description: "MF-DEC-07 records the explicit classify-and-eliminate selection from exactly 11 confirmed terminal premise and affected roots."
    requirement: RVAL-03
    verification:
      - kind: integration
        ref: "node scripts/revalidation.mjs validate --decision MF-DEC-07"
        status: pass
      - kind: other
        ref: "node scripts/revalidation.mjs decision-dossier --id MF-DEC-07"
        status: pass
    human_judgment: false
  - id: D2
    description: "The current census records exactly 13 test files and 80 syncBuiltinESMExports call sites while preserving duplicate, supporting, prior-decision, and unmodeled-source distinctions."
    requirement: RVAL-03
    verification:
      - kind: other
        ref: "live source census and canonical trace semantic checks"
        status: pass
    human_judgment: false
  - id: D3
    description: "TREF-04, TREF-08, and TREF-09 consequences require case-owned state or legitimate production ports, preserve behavioral evidence, and prohibit test-only or dead seams."
    requirement: RVAL-03
    verification:
      - kind: other
        ref: "canonical downstream-consequence semantic checks"
        status: pass
    human_judgment: false
duration: 1h17m
completed: 2026-09-05
status: complete
---

# Phase 01 Plan 64: Builtin Namespace Patching Policy Summary

**MF-DEC-07 now requires every authorized builtin patch to be classified and eliminated through honest case-owned filesystem behavior or a narrow production-owned port.**

## Performance

- **Duration:** 1 hr 17 min
- **Started:** 2026-09-05T18:00:05Z
- **Completed:** 2026-09-05T19:17:25Z
- **Tasks:** 1
- **Files modified:** 3

## Accomplishments

- Presented only MF-DEC-07 from current CodeGraph, source, owner-test, terminal-ledger, and live-census evidence.
- Confirmed that the historical premise survives: exactly 13 test files still contain 80 `syncBuiltinESMExports()` calls.
- Recorded the operator's explicit option-1 selection to classify each use and eliminate process-global builtin namespace patching.
- Made a case-owned real temporary filesystem the default and limited production ports to irreproducible faults, timing, schedules, rollback points, probe sequences, hydration reads, and state-read races.
- Prohibited test-only exports, `__deps` additions, unused defaults, dead seams, and interaction-only replacements for current behavioral assertions.
- Preserved prior MF-DEC-01 and MF-DEC-03 dispositions and coordinated install/reinstall work with the MF-DEC-02 split sequence.

## Task Commits

1. **Task 1: Decide MF-DEC-07 — Builtin-module namespace patching** — `b1f6d692`

## Files Created/Modified

- `.planning/phases/01-live-evidence-revalidation/01-REVALIDATION.json` — Resolved MF-DEC-07 with 11 exact roots, three options, explicit selection, rejected alternatives, exclusions, and downstream controls.
- `.planning/phases/01-live-evidence-revalidation/01-REVALIDATION.md` — Regenerated decision status showing MF-DEC-07 resolved.
- `.planning/phases/01-live-evidence-revalidation/01-64-SUMMARY.md` — Decision outcome, evidence trace, verification, and next-dossier handoff.

## Decisions Made

- Selected `Classify each use and eliminate global patching` over adding filesystem ports uniformly or retaining serialized builtin stubs after an import-style conversion.
- Real temporary filesystem behavior is preferred when it is portable and deterministic; narrow consumer-owned production ports are reserved for behavior that cannot be reproduced safely through real state.
- Removing `syncBuiltinESMExports()` alone is not closure when a shared builtin object remains mutated.
- Implementation must preserve public results, complete state/configuration/tree evidence, exact notifications, failure classifications, retry ordering, and cleanup assertions.

## Premise and Route Trace

`premiseFindingIds` and `affectedIds` are both exactly these 11 terminal roots:

- `BSKL-019`, `HHD-011`, and `HSA-026`
- `OPEF-F04` and `OPEF-F09`
- `.planning/reviews/unit-test-adversarial/adversarial/orchestrators-plugin-install-a.md#OPIA-F05`
- `OPIC-F27`, `OPLU-B-F10`, `OPR-B-F14`, `ORA-F15`, and `SHC-F003`

The current census still finds 13 files and 80 `syncBuiltinESMExports()` calls. The scope-tree inventory helper also still binds `readdir` before the mutations to avoid observing them.

- `HHD-020` and `BHD-F008` remain duplicates of `HHD-011`; `BHAS-F012` remains a duplicate of `HSA-026`.
- `MF-009`, `OPEF-F16`, and `SHC-F045` remain supporting or independent records rather than decision premises.
- `BC-004` and duplicate `BC-012` remain governed solely by MF-DEC-01 and are not reopened.
- `BSFP-F008` remains excluded as a superseded clean-list record.
- `bridges/skills/stage.test.ts` is a current census member without a dedicated terminal finding, so this decision authorizes no file-specific change there until one exists.

## Downstream Requirements

- Phase 5 `TREF-04`: classify every affected use. Use a fresh case-owned temporary tree for ordinary portable filesystem behavior; introduce a narrow consumer-owned production port only for irreproducible fault or timing control.
- Ports must be wired to real adapters by production composition. They cannot be `__deps` members, test-only exports, unused live defaults, or dead seams.
- Phase 6 `TREF-08`: remove the authorized `createRequire` and `syncBuiltinESMExports` machinery, replace each case with its classified proof, and remove the scope-tree pre-binding workaround when no consumer mutates the builtin.
- Phase 6 `TREF-09`: coordinate install and reinstall port placement with their approved split sequence and mandatory gate, documentation, ownership, and completeness checklist.
- Preserve the selected reconcile-apply behavioral-composition exception: its owner continues to drive real orchestrators while only the independent state-read race boundary changes.
- Run each changed direct source-test pair and affected command-flow proof without weakening existing observable assertions.

## Verification

- `node scripts/revalidation.mjs render` — passed before task commit; generated Markdown is current.
- `node scripts/revalidation.mjs validate --decision MF-DEC-07` — passed: `Revalidation ledger valid.`
- `node scripts/revalidation.mjs decision-dossier --id MF-DEC-07` — passed with the exact 11 roots and selected option.
- Canonical semantic checks — passed for exact premise/affected equality, three options, two rejected alternatives, the 13-file/80-call census, duplicate/support/exclusion handling, and TREF-04/TREF-08/TREF-09 consequences.
- Pending-decision census — passed: exactly `MF-DEC-08` and `MF-DEC-09` remain pending.
- `git diff --check` over the task commit's canonical files — passed.

## Deviations from Plan

None - the surviving premise reached the operator as one dossier and the explicit selection was recorded as planned.

## Issues Encountered

None.

## Known Stubs

None. The two remaining pending records are assigned decision dossiers, not implementation placeholders.

## User Setup Required

None - no credentials, network access, package installation, or external service configuration was required.

## Next Phase Readiness

Plan 01-65 can evaluate only MF-DEC-08 from terminal current evidence. MF-DEC-01 through MF-DEC-07 are resolved; exactly MF-DEC-08 and MF-DEC-09 remain pending.

## Self-Check: PASSED

- All three plan-owned artifacts exist.
- Task commit `b1f6d692` exists and contains only canonical JSON and generated Markdown.
- Named-decision validation and dossier generation pass.
- MF-DEC-07 has identical exact 11-root premise and affected arrays, and the two expected dossiers remain pending.

---
*Phase: 01-live-evidence-revalidation*
*Completed: 2026-09-05*

---
phase: 01-live-evidence-revalidation
plan: 63
subsystem: testing
tags: [operator-decision, behavioral-composition, hermetic-tests, dependency-seams, exact-notifications]
requires:
  - phase: 01-62
    provides: Resolved module-split policy and four remaining decision dossiers
provides:
  - Resolved MF-DEC-03 with the operator-selected preservation of two deliberate behavioral-composition proofs
  - Exact ORA-F23 and OPS-F20 terminal premise and affected-root trace
  - Narrow Phase 5 TREF-04 exception policy with observable-behavior preservation controls
affects: [phase-5-injection-and-ownership, phase-8-direct-coverage]
actuals:
  tokens: 984539
  tasks: 1
  commits: 1
tech-stack:
  added: []
  patterns: [behavioral composition proof, case-owned filesystem, network-edge fake, exact notification boundary]
key-files:
  created:
    - .planning/phases/01-live-evidence-revalidation/01-63-SUMMARY.md
  modified:
    - .planning/phases/01-live-evidence-revalidation/01-REVALIDATION.json
    - .planning/phases/01-live-evidence-revalidation/01-REVALIDATION.md
key-decisions:
  - "Preserve applyReconcile and bootstrapClaudePlugin as the only two demonstrated behavioral-composition exceptions rather than adding production dependency seams solely for interaction tests."
  - "Phase 5 TREF-04 must exempt only these observed flows and preserve their public-result, full state/configuration/tree, and exact-notification proofs."
  - "No later work may replace these behavioral proofs with interaction-only cases or introduce test-only exports, injection seams, or dead branches for them."
patterns-established:
  - "A documented owner suite may retain real behavioral collaborators when case-owned state, a narrow network fake, and exact observable assertions make the composition itself the contract under test."
  - "Every policy exception names its exact terminal roots and flows; it does not weaken the default hidden-dependency remediation policy elsewhere."
requirements-completed: [RVAL-03]
coverage:
  - id: D1
    description: "MF-DEC-03 records the explicit preservation choice from exactly ORA-F23 and OPS-F20 as terminal premise and affected roots."
    requirement: RVAL-03
    verification:
      - kind: integration
        ref: "node scripts/revalidation.mjs validate --decision MF-DEC-03"
        status: pass
      - kind: other
        ref: "node scripts/revalidation.mjs decision-dossier --id MF-DEC-03"
        status: pass
    human_judgment: false
  - id: D2
    description: "The decision preserves ORAFP-F006 as an ORA-F23 duplicate, retains three supporting records independently, and excludes stale ORAFP-F011."
    requirement: RVAL-03
    verification:
      - kind: other
        ref: "canonical duplicate, supporting-record, and stale-exclusion semantic checks"
        status: pass
    human_judgment: false
  - id: D3
    description: "TREF-04 receives an exception for only the two observed composition flows, with exact observable assertions retained and no test-only production seams."
    requirement: RVAL-03
    verification:
      - kind: other
        ref: "canonical downstream-consequence semantic checks"
        status: pass
    human_judgment: false
duration: 16min
completed: 2026-09-05
status: complete
---

# Phase 01 Plan 63: Behavioral Composition Exception Policy Summary

**MF-DEC-03 now preserves the apply and bootstrap owner suites as two narrowly documented behavioral-composition proofs, without adding production seams solely for tests.**

## Performance

- **Duration:** 16 min
- **Started:** 2026-09-05T17:44:10Z
- **Completed:** 2026-09-05T18:00:05Z
- **Tasks:** 1
- **Files modified:** 3

## Accomplishments

- Presented only MF-DEC-03 from current CodeGraph, source, owner-test, focused-run, and terminal-ledger evidence.
- Recorded the operator's explicit option-1 selection to preserve and codify the two deliberate behavioral-composition exceptions.
- Limited the exception to `applyReconcile` and `bootstrapClaudePlugin`; it creates no general waiver for hidden collaborators elsewhere.
- Preserved the current case-owned temporary filesystems, Git/network-edge fakes, public-result evidence, full state/configuration/tree evidence, and exact notification boundaries.
- Routed the policy through Phase 5 `TREF-04` while prohibiting test-only exports or dependency-injection seams for these two flows.

## Task Commits

1. **Task 1: Decide MF-DEC-03 — apply.test.ts deliberate deviation and its second member** — `6eaee8a7`

## Files Created/Modified

- `.planning/phases/01-live-evidence-revalidation/01-REVALIDATION.json` — Resolved MF-DEC-03 with its exact two roots, explicit selection, rejected alternative, current proof, and downstream controls.
- `.planning/phases/01-live-evidence-revalidation/01-REVALIDATION.md` — Regenerated decision status showing MF-DEC-03 resolved.
- `.planning/phases/01-live-evidence-revalidation/01-63-SUMMARY.md` — Decision outcome, evidence trace, verification, and next-dossier handoff.

## Decisions Made

- Selected `Preserve and codify both exceptions as deliberate behavioral composition proofs` over adding seven production dependency members while retaining duplicate behavioral proofs.
- Kept real orchestrators in the apply and bootstrap owner suites because their composition behavior is directly observed through hermetic state and exact output boundaries.
- Required `TREF-04` to exempt only the two named flows; all other hidden-dependency findings retain their existing policy and routes.
- Prohibited later replacement with interaction-only cases and prohibited test-only exports, injection seams, or dead branches for these exceptions.

## Premise and Route Trace

`premiseFindingIds` and `affectedIds` are both exactly `ORA-F23` and `OPS-F20`.

- `ORA-F23` proves that `applyReconcile` composes five concrete orchestrators and exposes only the narrow `gitOps` seam.
- `OPS-F20` proves that `bootstrapClaudePlugin` composes `addMarketplace` and `setMarketplaceAutoupdate` and is not an injection-seam reference implementation.
- Both owner suites run real collaborators through case-owned temporary filesystems, fake only the Git/network edge, and validate observable state and exact notifications.
- `ORAFP-F006` remains a duplicate of `ORA-F23`; it is not an additional premise.
- `ORA-F19`, `ORA-F35`, and `ORAFP-F001` remain independent positive evidence-only records.
- Stale `ORAFP-F011` remains excluded because current focused and direct-coverage runs supersede its historical no-execution limitation.

## Downstream Requirements

- Phase 5 `TREF-04` must explicitly exempt only the observed `applyReconcile` and `bootstrapClaudePlugin` behavioral-composition flows from hidden-dependency remediation.
- Later work must preserve apply's public-result assertions, bootstrap's complete state, configuration, and scope-tree assertions, and both suites' exact notification assertions.
- No later task may add a test-only export or dependency-injection seam for these two flows or replace the behavior proofs with interaction-only cases.
- MF-DEC-03 itself authorizes no production or test edit and creates no broader exception.

## Verification

- `node scripts/revalidation.mjs render` — passed before task commit; generated Markdown is current.
- `node scripts/revalidation.mjs validate --decision MF-DEC-03` — passed: `Revalidation ledger valid.`
- `node scripts/revalidation.mjs decision-dossier --id MF-DEC-03` — passed with exact roots `ORA-F23` and `OPS-F20` and the selected option.
- `node --test tests/orchestrators/reconcile/apply.test.ts tests/orchestrators/plugin/bootstrap.test.ts` — passed both focused owner suites with zero failures, skips, or todos.
- Canonical semantic checks — passed for exact premise/affected roots, both options, rejected rationale, duplicate and supporting-record preservation, stale exclusion, and downstream controls.
- Pending-decision census — passed: exactly `MF-DEC-07`, `MF-DEC-08`, and `MF-DEC-09` remain pending.
- `git diff --check` over the task commit's canonical files — passed.

## Deviations from Plan

None - the surviving premise reached the operator as one dossier and the explicit selection was recorded as planned.

## Issues Encountered

None.

## Known Stubs

None. The three remaining pending records are assigned decision dossiers, not implementation placeholders.

## User Setup Required

None - no credentials, network access, package installation, or external service configuration was required.

## Next Phase Readiness

Plan 01-64 can evaluate only MF-DEC-07 from terminal current evidence. MF-DEC-01 through MF-DEC-06 are resolved; exactly MF-DEC-07, MF-DEC-08, and MF-DEC-09 remain pending.

## Self-Check: PASSED

- All three plan-owned artifacts exist.
- Task commit `6eaee8a7` exists and contains only canonical JSON and generated Markdown.
- Named-decision validation and dossier generation pass.
- MF-DEC-03 has exact premise and affected roots `ORA-F23` and `OPS-F20`, and the three expected dossiers remain pending.

---
*Phase: 01-live-evidence-revalidation*
*Completed: 2026-09-05*

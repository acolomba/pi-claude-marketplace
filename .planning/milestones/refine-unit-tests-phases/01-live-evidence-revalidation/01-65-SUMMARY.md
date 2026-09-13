---
phase: 01-live-evidence-revalidation
plan: 65
subsystem: testing
tags: [operator-decision, test-double-naming, role-names, shared-fakes, guideline-conformity]
requires:
  - phase: 01-64
    provides: Resolved builtin-patching policy and two remaining decision dossiers
provides:
  - Resolved MF-DEC-08 with the operator-selected role-only factory naming policy
  - Exact OPEF-F13, OPIA-F23, and OPIC-F38 terminal premise and affected-root trace
  - Phase 4 TREF-02 and TREF-03 implementation constraints for 16 traced factories across 10 files
affects: [phase-2-containment-and-input-safety, phase-4-hermetic-test-infrastructure, final-quality-closure]
actuals:
  tokens: 987041
  tasks: 1
  commits: 1
tech-stack:
  added: []
  patterns: [production-role factory names, behavior-preserving test-support rename, exact naming scope]
key-files:
  created:
    - .planning/phases/01-live-evidence-revalidation/01-65-SUMMARY.md
  modified:
    - .planning/phases/01-live-evidence-revalidation/01-REVALIDATION.json
    - .planning/phases/01-live-evidence-revalidation/01-REVALIDATION.md
key-decisions:
  - "Adopt production-role names for the 16 traced makeMockGitOps, makeMockCredentialOps, and makeMockDeviceFlowHttp factories across 10 files."
  - "Align CONVENTIONS.md and production comments with role-only terminology while preserving all fake behavior, typings, hermetic boundaries, and observable assertions."
  - "Keep makeMockPi and unrelated *Fake families outside the exact decision scope unless separately traced."
patterns-established:
  - "A naming-policy decision changes terminology without changing collaborator behavior, public contracts, or test strength."
  - "Broad naming sweeps require terminal trace; a convention choice does not silently authorize unrelated families."
requirements-completed: [RVAL-03]
coverage:
  - id: D1
    description: "MF-DEC-08 records the explicit role-only selection from exactly OPEF-F13, OPIA-F23, and OPIC-F38 as terminal premise and affected roots."
    requirement: RVAL-03
    verification:
      - kind: integration
        ref: "node scripts/revalidation.mjs validate --decision MF-DEC-08"
        status: pass
      - kind: other
        ref: "node scripts/revalidation.mjs decision-dossier --id MF-DEC-08"
        status: pass
    human_judgment: false
  - id: D2
    description: "The decision preserves OPEFR-F002 as an OPEF-F13 duplicate, MF-009 as umbrella provenance, and OMAUB-F08 as independent prerequisite repair."
    requirement: RVAL-03
    verification:
      - kind: other
        ref: "canonical duplicate, provenance, and independent-route semantic checks"
        status: pass
    human_judgment: false
  - id: D3
    description: "TREF-02 and TREF-03 receive a behavior-preserving rename scope limited to 16 traced factories across 10 files, with wider naming families excluded."
    requirement: RVAL-03
    verification:
      - kind: other
        ref: "canonical downstream-consequence and exclusion semantic checks"
        status: pass
    human_judgment: false
duration: 19min
completed: 2026-09-05
status: complete
---

# Phase 01 Plan 65: Test Double Naming Policy Summary

**MF-DEC-08 now requires production-role names for the traced test factories without changing their typed, hermetic, fail-closed behavior.**

## Performance

- **Duration:** 19 min
- **Started:** 2026-09-05T19:17:25Z
- **Completed:** 2026-09-05T19:36:54Z
- **Tasks:** 1
- **Files modified:** 3

## Accomplishments

- Presented only MF-DEC-08 from current CodeGraph, source, test, convention, skill, and terminal-ledger evidence.
- Replaced the historical approximate nine-file premise with the exact current census: 16 traced factory definitions across 10 files.
- Recorded the operator's explicit option-1 selection to use production-role factory names.
- Preserved the behavior, typings, fresh state, offline boundaries, fail-closed remote allow-lists, authentication collaborators, and observable assertions of the current fakes.
- Limited downstream authorization to the three traced factory families and excluded `makeMockPi` and unrelated `*Fake` families without separate terminal evidence.
- Kept the shared-fake correctness defect, the composite enable/fetch test-quality work, and positive allow-list evidence independently traceable.

## Task Commits

1. **Task 1: Decide MF-DEC-08 — makeMock naming convention conflict** — `ea3896c9`

## Files Created/Modified

- `.planning/phases/01-live-evidence-revalidation/01-REVALIDATION.json` — Resolved MF-DEC-08 with three exact roots, three options, explicit selection, rejected alternatives, provenance, exclusions, and downstream controls.
- `.planning/phases/01-live-evidence-revalidation/01-REVALIDATION.md` — Regenerated decision status showing MF-DEC-08 resolved.
- `.planning/phases/01-live-evidence-revalidation/01-65-SUMMARY.md` — Decision outcome, trace, verification, and next-dossier handoff.

## Decisions Made

- Selected `Adopt role-only names for covered factories` over `*Fake` factory names or retaining `makeMock*` as a project exception.
- Rename only the nine `makeMockGitOps`, four `makeMockCredentialOps`, and three `makeMockDeviceFlowHttp` definitions covered by current terminal evidence.
- Update the project convention and remove test-helper terminology from production comments without changing the collaborator interfaces or runtime behavior.
- Require separate terminal trace before renaming `makeMockPi` or unrelated `*Fake` families.

## Premise and Route Trace

`premiseFindingIds` and `affectedIds` are both exactly these three terminal roots:

- `OPEF-F13`
- `OPIA-F23`
- `OPIC-F38`

- `OPEFR-F002` remains a duplicate of `OPEF-F13` rather than a fourth premise.
- `MF-009` remains supporting umbrella provenance rather than a specific premise substitute.
- `OMAUB-F08` remains independent Phase 2 shared-fake correctness work.
- The unrelated full-path plugin-install finding whose suffix is `OPIA-F23` is not the short-ID root and remains excluded.
- The historical approximate nine-file count and absent `tests/helpers/credential-mock.ts` reference are stale context superseded by the exact current census, not grounds to close the live naming conflict.

## Downstream Requirements

- Phase 2 must repair `OMAUB-F08` before consolidation or renaming can hide the shared fake's authentication-observation loss or fake-internal state pokes.
- The remaining assertion, typing, and double-discipline work in `OPEF-F13` retains its independent Phase 2 route.
- Phase 4 `TREF-02` and `TREF-03` rename the 16 traced factories across the 10 evidenced files by production role, align `.planning/codebase/CONVENTIONS.md`, and remove helper-name terminology from the production comments in plugin fetch, install, reinstall, and update.
- Preserve all current typings, fresh per-case state, offline and fail-closed behavior, function-bearing authentication collaborators, call/state observations, public results, exact state, and exact notification assertions.
- Update only the naming conclusions in `OPIA-F23` and `OPIC-F38`; their positive allow-list evidence remains valid.
- Run all affected owner suites and shared-support dependents, relevant direct-pair gates, the all-pairs direct-coverage gate required after shared-support changes, type checking, and the complete quality suite.
- Add no production test-only export, dead seam, network access, or behavior change.

## Verification

- `node scripts/revalidation.mjs render` — passed before task commit; generated Markdown is current.
- `node scripts/revalidation.mjs validate --decision MF-DEC-08` — passed: `Revalidation ledger valid.`
- `node scripts/revalidation.mjs decision-dossier --id MF-DEC-08` — passed with the exact three roots and selected option.
- Canonical semantic checks — passed for identical premise/affected arrays, three options, two rejected alternatives, duplicate/provenance handling, the 16-factory/10-file census, downstream controls, and wider-family exclusions.
- Pending-decision census — passed: exactly `MF-DEC-09` remains pending.
- Commit-scope check — passed: `ea3896c9` contains only canonical JSON and generated Markdown.
- `git diff --check` over the task commit's canonical files — passed.

## Deviations from Plan

None - the surviving premise reached the operator as one dossier and the explicit selection was recorded as planned.

## Issues Encountered

None.

## Known Stubs

None. The sole remaining pending record is an assigned decision dossier, not an implementation placeholder.

## User Setup Required

None - no credentials, network access, package installation, or external service configuration was required.

## Next Phase Readiness

Plan 01-66 can evaluate only MF-DEC-09 from terminal current evidence. MF-DEC-01 through MF-DEC-08 are resolved; exactly MF-DEC-09 remains pending.

## Self-Check: PASSED

- All three plan-owned artifacts exist.
- Task commit `ea3896c9` exists and contains only canonical JSON and generated Markdown.
- Named-decision validation and dossier generation pass.
- MF-DEC-08 has identical exact three-root premise and affected arrays, and only MF-DEC-09 remains pending.

---
*Phase: 01-live-evidence-revalidation*
*Completed: 2026-09-05*

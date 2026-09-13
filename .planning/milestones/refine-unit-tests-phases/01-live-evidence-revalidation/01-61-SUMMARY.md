---
phase: 01-live-evidence-revalidation
plan: 61
subsystem: testing
tags: [operator-decision, notifications, cardinality, plural-tallies, exact-output]
requires:
  - phase: 01-60
    provides: Resolved reconcile-alias policy and six remaining decision dossiers
provides:
  - Resolved MF-DEC-06 with the operator-selected structural-cardinality and plural-tally policy
  - Exact OMR-F02 premise and affected-root trace with a current 43-call/3-explicit census
  - Phase 3 PDEF-01 implementation and Phase 6 TREF-07 exact-output consequences
affects: [phase-3-production-defects, phase-6-assertion-refinement, output-catalog]
actuals:
  tokens: 981596
  tasks: 1
  commits: 1
tech-stack:
  added: []
  patterns: [structural cardinality, plural tally contract, invocation-form classification, exact output evidence]
key-files:
  created:
    - .planning/phases/01-live-evidence-revalidation/01-61-SUMMARY.md
  modified:
    - .planning/phases/01-live-evidence-revalidation/01-REVALIDATION.json
    - .planning/phases/01-live-evidence-revalidation/01-REVALIDATION.md
key-decisions:
  - "Enforce structural single/plural cardinality at every notifyWithContext producer and honor the existing tally contract for plural operation rows without inferring cardinality from row count."
  - "Classify named autoupdate as single, a bare autoupdate sweep as plural, and marketplace list as plural while retaining no tally for list's bare headers."
  - "Replace or remove inert label-object assertions under TREF-07 while preserving six supporting findings independently."
patterns-established:
  - "A structural input such as command invocation form owns cardinality; rendered row count never does."
  - "A plural classification does not manufacture a tally when the composer has no nonzero operation category."
requirements-completed: [RVAL-03]
coverage:
  - id: D1
    description: "MF-DEC-06 records the explicit option-1 selection from exactly one confirmed terminal premise and affected root, OMR-F02, with both alternative policy models rejected."
    requirement: RVAL-03
    verification:
      - kind: integration
        ref: "node scripts/revalidation.mjs validate --decision MF-DEC-06"
        status: pass
      - kind: other
        ref: "node scripts/revalidation.mjs decision-dossier --id MF-DEC-06"
        status: pass
    human_judgment: false
  - id: D2
    description: "Current evidence records 43 notifyWithContext producer calls, only three with explicit cardinality, and distinguishes named autoupdate, bare autoupdate sweep, and list bare-header behavior."
    requirement: RVAL-03
    verification:
      - kind: other
        ref: "CodeGraph/current-source call census and canonical semantic assertion"
        status: pass
    human_judgment: false
  - id: D3
    description: "OMR-F18, OPR-B-F02/OPRFP-F003, SHC-F013, SNC-F016, and SHC-F041 retain their independent statuses and routes, with exactly five later decisions pending."
    requirement: RVAL-03
    verification:
      - kind: other
        ref: "canonical supporting-finding and pending-decision census"
        status: pass
    human_judgment: false
duration: 17min
completed: 2026-09-05
status: complete
---

# Phase 01 Plan 61: Structural Cardinality and Plural Tally Policy Summary

**MF-DEC-06 now requires type-safe structural cardinality at every notification producer and honors plural tallies while preserving the bare-header list exception.**

## Performance

- **Duration:** 17 min
- **Started:** 2026-09-05T16:56:54Z
- **Completed:** 2026-09-05T17:14:09Z
- **Tasks:** 1
- **Files modified:** 3

## Accomplishments

- Presented only MF-DEC-06 from the terminal OMR-F02 root and current CodeGraph/source evidence.
- Recorded the operator's explicit option-1 selection to enforce structural cardinality and honor plural tallies.
- Preserved the established rule that invocation structure, never rendered row count, determines single versus plural behavior.
- Recorded the current census of 43 `notifyWithContext` producer calls, only three of which pass cardinality explicitly.
- Routed production classification and atomic catalog/byte updates through Phase 3 `PDEF-01`, and inert label-assertion cleanup through Phase 6 `TREF-07`.
- Kept `OMR-F18`, `OPR-B-F02`/`OPRFP-F003`, `SHC-F013`, `SNC-F016`, and `SHC-F041` independent under their existing statuses and routes.

## Task Commits

1. **Task 1: Decide MF-DEC-06 — OUT-07 cardinality contract** — `d479eda2`

## Files Created/Modified

- `.planning/phases/01-live-evidence-revalidation/01-REVALIDATION.json` — Resolved MF-DEC-06 with its sole terminal root, three options, explicit selection, rejection rationale, and downstream requirements.
- `.planning/phases/01-live-evidence-revalidation/01-REVALIDATION.md` — Regenerated decision status showing MF-DEC-06 resolved.
- `.planning/phases/01-live-evidence-revalidation/01-61-SUMMARY.md` — Decision outcome, evidence trace, verification, and next-dossier handoff.

## Decisions Made

- Selected `Enforce structural cardinality and honor plural tallies` over preserving selective opt-in behavior or introducing a separate tally-policy dimension.
- Every current `notifyWithContext` producer must be classified type-safely as structural single or plural from its invocation contract, never from row count.
- An explicit named-marketplace autoupdate is single and retains no tally; a bare autoupdate sweep is plural and gains a tally for populated operation rows.
- Marketplace list is plural because it enumerates zero or more records, but its bare marketplace headers still produce no tally because the composer has no nonzero operation category.

## Premise and Route Trace

`premiseFindingIds` and `affectedIds` are both exactly `OMR-F02`.

- Current source contains 43 production `notifyWithContext` calls and only three explicit cardinality arguments.
- Autoupdate's plural branches omit cardinality today; for populated status/severity rows, that omission suppresses a user-visible tally.
- List also omits cardinality, but explicit plural classification does not change its bytes while it contains only bare headers.
- `OMR-F18`, `OPR-B-F02` and duplicate `OPRFP-F003`, `SHC-F013`, `SNC-F016`, and `SHC-F041` remain independently actionable or evidentiary under their existing routes. MF-DEC-06 coordinates later work but resolves none of them.

## Downstream Requirements

- Phase 3 `PDEF-01`: classify all current `notifyWithContext` producer call sites as structural single or plural without row-count inference. Update the output catalog and independently authored exact-byte tests atomically for every newly visible tally.
- Phase 3 `PDEF-01`: pin the autoupdate distinction directly—named target is single/no tally; bare sweep is plural and tallies populated operation rows—and retain list's plural/bare-header no-tally behavior.
- Phase 6 `TREF-07`: replace or remove inert label-object assertions with user-visible exact-output evidence where labels render and type-only enforcement where they do not.

## Verification

- `node scripts/revalidation.mjs render` — passed; generated Markdown is byte-current.
- `node scripts/revalidation.mjs validate --decision MF-DEC-06` — passed: `Revalidation ledger valid.`
- `node scripts/revalidation.mjs decision-dossier --id MF-DEC-06` — passed with sole root `OMR-F02` and the selected option.
- Canonical semantic assertion — passed: the 43/3 census, structural classification, named-versus-bare autoupdate distinction, list bare-header exception, PDEF-01/TREF-07 consequences, and preserved findings are present.
- Pending-decision census — passed: exactly MF-DEC-02, MF-DEC-03, MF-DEC-07, MF-DEC-08, and MF-DEC-09 remain pending.
- `git diff --check` over the task commit's canonical files — passed.

## Deviations from Plan

None - the surviving premise reached the operator as one dossier and the explicit selection was recorded as planned.

## Issues Encountered

None.

## Known Stubs

None. The five remaining pending records are assigned decision dossiers, not implementation placeholders.

## User Setup Required

None - no credentials, network access, package installation, or external service configuration was required.

## Next Phase Readiness

Plan 01-62 can evaluate only MF-DEC-02 from terminal current evidence. MF-DEC-01, MF-DEC-04, MF-DEC-05, and MF-DEC-06 are resolved; exactly MF-DEC-02, MF-DEC-03, MF-DEC-07, MF-DEC-08, and MF-DEC-09 remain pending.

## Self-Check: PASSED

- All three plan-owned artifacts exist.
- Task commit `d479eda2` exists and contains only canonical JSON and generated Markdown.
- Named-decision validation and dossier generation pass.
- MF-DEC-06 has exact premise and affected root `OMR-F02`, all named supporting findings retain their independent routes, and the five expected dossiers remain pending.

---
*Phase: 01-live-evidence-revalidation*
*Completed: 2026-09-05*

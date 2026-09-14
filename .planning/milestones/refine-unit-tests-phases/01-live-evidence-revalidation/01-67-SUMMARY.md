---
phase: 01-live-evidence-revalidation
plan: 67
subsystem: planning
tags: [scope-impact, evidence-routing, requirements, roadmap, traceability]
requires:
  - phase: 01-66
    provides: Terminal canonical ledger with all nine operator decisions resolved
provides:
  - Complete evidence-backed scope-impact crosswalk for all 32 requirements and all eight Phase 2-9 routes
  - Explicit D-19 through D-22 treatment for stale, mixed, unsupported, and current scope
  - Stable requirement IDs and stable later phase numbers ready for Plan 01-68 contract edits
affects: [phase-2-containment, phase-3-production-defects, phase-4-hermetic-tests, phase-5-ownership, phase-6-refinement, phase-7-gates, phase-8-coverage, phase-9-closure]
actuals:
  tokens: 994393
  tasks: 1
  commits: 1
tech-stack:
  added: []
  patterns: [terminal-evidence scope routing, trace-preserving removal, stable phase numbering, pre-edit crosswalk]
key-files:
  created:
    - .planning/phases/01-live-evidence-revalidation/01-67-SUMMARY.md
  modified:
    - .planning/phases/01-live-evidence-revalidation/01-REVALIDATION.json
    - .planning/phases/01-live-evidence-revalidation/01-REVALIDATION.md
key-decisions:
  - "Represent scope impact with exactly 32 requirement rows and eight Phase 2-9 route rows, each appearing once."
  - "Move unsupported AGCOL-01 and superseded standalone COV-01 work to evidence without claiming implementation."
  - "Do not activate the unused-type-member todo or named GAUTH-01 wiring without a dedicated terminal finding."
patterns-established:
  - "Mixed requirements are narrowed or split in place; stable IDs and later phase numbers do not change."
  - "Backlog prose cannot authorize implementation without terminal canonical evidence."
requirements-completed: [RVAL-04]
coverage:
  - id: D1
    description: "The crosswalk covers all 32 current requirement IDs and all eight Phase 2-9 routes exactly once."
    requirement: RVAL-04
    verification:
      - kind: integration
        ref: "node scripts/revalidation.mjs scope-impact --check"
        status: pass
      - kind: other
        ref: "exact requirement and phase-route census"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every evidence reference is an existing terminal root rather than a duplicate record."
    requirement: RVAL-04
    verification:
      - kind: integration
        ref: "node scripts/revalidation.mjs validate"
        status: pass
      - kind: other
        ref: "duplicate-root and sorted-reference semantic checks"
        status: pass
    human_judgment: false
  - id: D3
    description: "D-19 through D-22 preserve history and numbering while excluding unsupported prose-derived work."
    requirement: RVAL-04
    verification:
      - kind: other
        ref: "action census and bundled-backlog semantic checks"
        status: pass
    human_judgment: false
duration: 14min
completed: 2026-09-05
status: complete
---

# Phase 01 Plan 67: Scope-Impact Crosswalk Summary

**The terminal ledger now specifies one evidence-backed action for every current requirement and every stable Phase 2-9 route before any planning contract is rewritten.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-09-05T20:00:07Z
- **Completed:** 2026-09-05T20:14:06Z
- **Tasks:** 1
- **Files modified:** 3

## Accomplishments

- Added exactly 40 stable scope-impact records: 32 requirement rows and eight Phase 2-9 route rows.
- Linked the crosswalk to 73 unique terminal finding roots and all nine resolved decisions without using duplicate findings as premises.
- Classified the records as seven `keep`, 31 `narrow/split`, and two `move-to-evidence` actions.
- Preserved every requirement ID and every later phase number; no phase was empty, retired, added, or renumbered.
- Revalidated the folded unused-type-member todo and bundled backlog through canonical evidence instead of treating prose as authority.
- Kept the current unit-test-quality boundary intact and created no unsupported implementation authorization.

## Task Commits

1. **Task 1: Derive and validate the complete scope-impact crosswalk** — `00ef1a52`

## Files Created/Modified

- `.planning/phases/01-live-evidence-revalidation/01-REVALIDATION.json` — Added the canonical 40-row scope-impact crosswalk with evidence, decisions, actions, and rationale.
- `.planning/phases/01-live-evidence-revalidation/01-REVALIDATION.md` — Regenerated the operator-readable scope-impact view.
- `.planning/phases/01-live-evidence-revalidation/01-67-SUMMARY.md` — Records the crosswalk result and Plan 01-68 handoff.

## Decisions Made

- Use one scope-impact row for each of the 32 current requirement IDs and one for each stable Phase 2-9 route.
- Keep seven requirements whose current contract is already evidence-correct.
- Narrow or split 31 mixed requirements and phase routes so current work remains active while stale, superseded, or unrelated prose does not.
- Move `GGAT-02`/AGCOL-01 to evidence because no dedicated terminal finding supports the asserted dead gate.
- Move `RCOV-04`/COV-01 to evidence because `RCOV-01` now covers all 204 source-test pairs and neither named orchestrator is a current terminal shortfall.
- Do not activate the folded unused-type-member todo or the named GAUTH-01 sentinel-wiring prescription without a dedicated terminal finding.

## Scope-Impact Census

| Class | Count | Treatment |
| --- | ---: | --- |
| Current requirement rows | 32 | Each stable requirement ID appears exactly once |
| Later phase route rows | 8 | Phases 2 through 9 each appear exactly once |
| `keep` | 7 | Current contract remains evidence-correct |
| `narrow/split` | 31 | Retain only terminally supported clauses or routes |
| `move-to-evidence` | 2 | Preserve history without claiming implementation |
| `retire-phase` | 0 | Every later phase retains terminal current work |
| `add-in-boundary` | 0 | No new terminal finding required a new scope item |
| `defer-out-of-boundary` | 0 | No out-of-boundary work was activated |

The records cite 73 unique finding roots and all nine resolved decisions. Every finding reference exists, none carries `duplicateOf`, and all finding and decision arrays use stable bytewise ordering.

## Backlog and Todo Treatment

- `TESTQ-01`, `FLOW-09`, `REASON-01`, and `FLOW-07` retain exact routes through their terminal findings.
- `AGCOL-01` remains traceable history but leaves active scope because no terminal finding establishes the prose claim.
- `COV-01` remains traceable history and is covered by the complete `RCOV-01` baseline rather than a standalone remeasurement.
- The unused-type-member todo remains historical/deferred. Existing terminal export and gate findings stay active, but they do not prove the separate property-member claim.
- The named GAUTH-01 sentinel-wiring prescription is not activated. `AUTH-01` retains only the independently terminal authentication findings.

## D-19 Through D-22

- **D-19:** Stale-only or unsupported historical work moves to explicit evidence; no row describes it as implemented.
- **D-20:** Phase 2 through Phase 9 retain their existing numbers. No phase is empty, so no `retire-phase` action applies.
- **D-21:** Mixed requirements use `narrow/split` and state which terminal clauses remain and which historical clauses leave active scope.
- **D-22:** No new work enters scope without a terminal canonical finding inside the unit-test-quality boundary.

## Verification

- `node scripts/revalidation.mjs render` regenerated Markdown from the canonical JSON.
- `node scripts/revalidation.mjs validate` passed with `Revalidation ledger valid.` and zero pending decisions.
- `node scripts/revalidation.mjs scope-impact --check` passed and returned the full crosswalk.
- The semantic census passed with 40 unique rows, 32 unique requirement IDs, and eight unique stable phase routes.
- The action census passed with seven `keep`, 31 `narrow/split`, and two `move-to-evidence` rows.
- All referenced findings exist and resolve directly to terminal roots; no duplicate record appears in the crosswalk.
- All finding and decision arrays are sorted, and all nine decisions remain resolved.
- Commit `00ef1a52` exists and contains only canonical `01-REVALIDATION.json` and generated `01-REVALIDATION.md`.
- `git diff --check` passed.

## Deviations from Plan

None. Task 1 correctly completed the pre-edit crosswalk only. Plan 01-68 remains the owner of rewriting `REQUIREMENTS.md`, `ROADMAP.md`, and the final validation contract.

## Issues Encountered

None.

## Known Stubs

None. Every crosswalk row has at least one canonical evidence link and an explicit action.

## User Setup Required

None. This plan required no credentials, network access, package installation, or external service state.

## Next Phase Readiness

Plan 01-68 can now apply the validated crosswalk to the milestone requirements and roadmap without deriving scope from prose. Stable requirement IDs and Phase 2-9 numbers are ready to be preserved through that rewrite.

## Self-Check: PASSED

- The summary, canonical JSON, and generated Markdown exist.
- Task commit `00ef1a52` exists and contains only the two task-owned ledger artifacts.
- Strict ledger validation, scope-impact validation, exact census checks, and diff checks pass.
- The current planning contracts remain unchanged until Plan 01-68.

---
*Phase: 01-live-evidence-revalidation*
*Completed: 2026-09-05*

---
phase: 06-assertion-and-module-refinement
plan: "50"
subsystem: plugin-list-orchestration
tags: [typescript, plugin-list, orphan-fold, command-flow, direct-coverage]
requires:
  - phase: 06-assertion-and-module-refinement
    provides: installed and candidate list row owners from Plan 49
provides:
  - deterministic orphan adoption and canonical list ordering owner
  - complete plugin list state-loading and notification flow owner
  - direct caller migration for edge handlers, tools, and fold integration
affects: [plugin-list, phase-06-hub-deletion, list-architecture-gates]
plan_head_before: 81e3391fadb7530709cb97eea459bacb752845e3
actuals:
  tokens: 109307
  tasks: 2
  commits: 5
tech-stack:
  added: []
  patterns:
    - pure orphan folding returns rows and a duplicate-suppression name set
    - canonical name/scope ordering uses the shared comparator and stable sort semantics
    - the flow owner reads both scopes before invocation-form narrowing and dispatches once
key-files:
  created:
    - extensions/pi-claude-marketplace/orchestrators/plugin/list-orphan-fold.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/list-flow.ts
    - tests/orchestrators/plugin/list-orphan-fold.test.ts
    - tests/orchestrators/plugin/list-flow.test.ts
    - .planning/tdd-evidence/06-50-01.json
    - .planning/tdd-evidence/06-50-02.json
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/list.ts
    - extensions/pi-claude-marketplace/edge/handlers/plugin/list.ts
    - extensions/pi-claude-marketplace/edge/handlers/tools.ts
    - tests/orchestrators/plugin/list.test.ts
    - tests/integration/fold-adoption.test.ts
    - tests/architecture/manifest-lookup-drift.test.ts
key-decisions:
  - "Keep clone identity, installed-inventory fold selection, and canonical name/scope ordering in the pure list-orphan-fold owner."
  - "Move the complete existing list owner corpus to list-flow.test.ts so every flow branch remains directly covered without weakening exact output assertions."
  - "Vacate the legacy list.ts pair without a forwarding export; Plan 51 remains responsible for its fail-closed repointing ledger and deletion."
requirements-completed: [TREF-07, TREF-09]
coverage:
  - id: D1
    description: Orphan folding preserves empty, single, many, duplicate, same-name, equal-key, repeated, and independent parallel outcomes.
    requirement: TREF-09
    verification:
      - kind: unit
        ref: tests/orchestrators/plugin/list-orphan-fold.test.ts
        status: pass
      - kind: other
        ref: npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/plugin/list-orphan-fold.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Plugin list flow preserves both-scope state reads, filters, exact zero/one/many bytes, structural plural cardinality, failure normalization, and sole dispatch.
    requirement: TREF-07
    verification:
      - kind: integration
        ref: tests/orchestrators/plugin/list-flow.test.ts and tests/integration/fold-adoption.test.ts
        status: pass
      - kind: other
        ref: npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/plugin/list-flow.ts
        status: pass
    human_judgment: false
duration: 9min
completed: 2026-09-09
status: complete
---

# Phase 06 Plan 50: Plugin List Orphan and Flow Owner Extraction Summary

**Plugin list orphan adoption, stable name/scope ordering, cross-scope state composition, and notification dispatch now live in two directly covered owners with exact output unchanged.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-09-09T21:03:27Z
- **Completed:** 2026-09-09T21:12:00Z
- **Tasks:** 2
- **Task commits:** 5
- **Files changed by task commits:** 12
- **Realized diff scale:** 109,307 estimate tokens (437,226 diff characters / 4, including the 4,411-line owner-test move)

## Accomplishments

- Extracted clone detection, installed-inventory fold selection, duplicate suppression names, and canonical marketplace/row ordering into `list-orphan-fold.ts`.
- Proved empty, every installed variant, candidate rejection, duplicate rows, case-tied adjacency, stable equal keys, repeated calls, and independent parallel folds directly.
- Moved both-scope state/config reads, manifest-aware enumeration, filter union, block composition, failure normalization, and the single notification dispatch into `list-flow.ts`.
- Repointed the plugin-list edge handler, list tool projection, fold-adoption integration, and manifest-membership presence gate directly to the new flow owner.
- Preserved all 88 existing flow cases, including owner-local exact zero/one/many bytes and visible plural tallies, at the mirrored flow test path.

## Task Commits

1. **Task 1 RED: Orphan fold owner contract** - `2975e8b1` (test)
2. **Task 1 GREEN: Deterministic orphan fold extraction** - `5d3a842f` (feat)
3. **Task 2 RED: List flow owner contract** - `46bffb62` (test)
4. **Task 1 static-gate correction** - `7ade3584` (fix)
5. **Task 2 GREEN: Complete list flow extraction and caller migration** - `cc2cc2f7` (feat)

## Files Created/Modified

- `list-orphan-fold.ts` and its mirrored test own deterministic clone adoption, fold selection, exclusion names, and stable ordering.
- `list-flow.ts` and its mirrored test own the complete plugin list command flow and exact observable contract.
- `list.ts` and its mirrored test are deliberately vacated, with no forwarding export; Plan 51 deletes them after its required repointing ledger.
- The plugin-list edge handler and tool handler import the flow owner directly.
- Fold-adoption integration and manifest-lookup drift tests point at the new production owner.

## Decisions Made

- Keep orphan folding pure: validated state/config/manifest reads remain in the flow owner, while the fold owner receives typed rows and marketplace records.
- Reuse `compareByNameThenScope` rather than retaining a second list-specific name/scope comparator.
- Preserve stable ties by sorting copied arrays with a comparator that returns zero for equal name/scope keys.
- Move the comprehensive owner suite intact because the flow module has 90 executable branches; a narrow smoke suite would not meet direct-pair coverage or preserve all exact behavior contracts.

## TDD Gate Compliance

- **Task 1 RED:** `2975e8b1`; 8/8 cases failed because `list-orphan-fold.ts` did not exist. `.planning/tdd-evidence/06-50-01.json` passed `tdd-red-evidence`.
- **Task 1 GREEN:** `5d3a842f`; focused owner, legacy flow, and manifest gate passed. Final direct coverage is 22/22 branches, 10/10 functions, and 74/74 lines.
- **Task 2 RED:** `46bffb62`; the named owner-presence assertion failed while all 88 legacy flow cases passed. `.planning/tdd-evidence/06-50-02.json` passed `tdd-red-evidence`.
- **Task 2 GREEN:** `cc2cc2f7`; the flow, legacy pair, fold integration, manifest gate, tool, and edge-handler suites passed. Direct coverage is 90/90 branches, 15/15 functions, and 799/799 lines.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Moved the complete owner corpus instead of a single flow proof**

- **Found during:** Task 2 direct-coverage design
- **Issue:** The new flow owner contains 90 branches across filtering, state/config reads, manifest soft-failure, cross-scope composition, and failure dispatch. Moving only one end-to-end case would leave the direct owner pair incomplete and duplicate ownership in the legacy suite.
- **Fix:** Moved the existing comprehensive corpus intact to `list-flow.test.ts`, retaining every assertion and exact cardinality case; the temporary legacy pair has no forwarding API.
- **Files modified:** `tests/orchestrators/plugin/list-flow.test.ts`, `tests/orchestrators/plugin/list.test.ts`
- **Commits:** `46bffb62`, `cc2cc2f7`

**2. [Rule 3 - Blocking issue] Closed orphan owner TypeScript and Fallow gates**

- **Found during:** Overall typecheck and Fallow verification
- **Issue:** Two test rows omitted the required `severity` field, and the exported clone predicate referenced a private type alias.
- **Fix:** Completed the typed row fixtures and inlined the state record indexed-access type in the public signature.
- **Files modified:** `list-orphan-fold.ts`, `list-orphan-fold.test.ts`
- **Commit:** `7ade3584`

## Verification

- Task 1 focused command: pass (`list-orphan-fold`, legacy list, and manifest-lookup drift suites).
- Task 2 focused command: pass (`list-flow`, temporary legacy list, and fold-adoption suites).
- Orphan owner direct coverage: **22/22 branches, 10/10 functions, 74/74 lines**.
- Flow owner direct coverage: **90/90 branches, 15/15 functions, 799/799 lines**.
- Extended caller suites: plugin list edge handler, list tool projection, fold integration, and manifest membership gate all pass.
- `npm run typecheck`: pass.
- `npm run test:corresponding`: pass.
- Scoped ESLint over all changed TypeScript: pass with zero warnings.
- `npm run fallow`: pass with no enforced issue.
- Scoped Prettier and `git diff --check`: pass.

## Issues Encountered

- The repository contains unrelated dirty configuration, `.mcp.json`, CodeGraph data, Phase 1 review artifacts, and a milestone lock. They were preserved and excluded from every commit.
- Repository-wide formatting would inspect the unrelated untracked `.mcp.json`; formatting was therefore scoped to Plan 50 files.
- The known sealed Phase 1 mismatch in `tests/architecture/revalidation.test.ts` is outside this plan and was not changed.

## Known Stubs

None. The vacated legacy list pair is an intentional two-plan migration artifact required by Plan 51's fail-closed PRE-EDIT ledger and deletion task; it exposes no compatibility API and is not runtime-used.

## Threat Flags

None. The extraction adds no endpoint, authentication path, schema, or new file-access boundary. It preserves validated state/manifest inputs, redacted typed rows, stable ordering/cardinality, and the sole notification dispatch.

## User Setup Required

None.

## Next Phase Readiness

- All four plugin-list production responsibilities now have mirrored direct owner pairs.
- Production and integration callers use `list-flow.ts` directly.
- Plan 51 can repoint the remaining static docs/scanners, produce the PRE-EDIT ledger, and delete the vacated legacy pair without moving runtime behavior.

---

_Phase: 06-assertion-and-module-refinement_
_Completed: 2026-09-09_

## Self-Check: PASSED

Both production owners, both mirrored owner tests, both RED evidence records, and the summary exist. All five recorded task/corrective commits resolve from the persisted plan base, and every required plan gate passes.

---
phase: 113-orchestrator-support-and-presenters
plan: 25
subsystem: plugin-reinstall-presenter
tags: [typescript, node-test, reinstall, messaging, direct-coverage]
requires:
  - phase: 113-35
    provides: Shared presenter and architecture verification baseline
provides:
  - Complete direct ownership of reinstall outcome projection, reason narrowing, partition grouping, and rendering
  - Exact case-insensitive marketplace sorting with project-before-user scope order and stable row order within blocks
  - Lifecycle-only supplemental ownership after direct presenter consolidation
affects:
  - Phase 115 plugin lifecycle integration verification
  - MOD-06 orchestrator-support verification
actuals:
  tokens: 9230
  tasks: 1
  commits: 2
tech-stack:
  added: []
  patterns:
    - Complete literal projection values for every typed outcome partition
    - Strong typed notification and tool probes without impossible casts
    - Case-insensitive block ordering with stable caller-order rows
key-files:
  created:
    - tests/orchestrators/plugin/reinstall.messaging.test.ts
    - .planning/phases/113-orchestrator-support-and-presenters/113-25-SUMMARY.md
  modified:
    - .planning/phases/113-orchestrator-support-and-presenters/113-25-PLAN.md
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts
    - tests/orchestrators/plugin/reinstall.test.ts
key-decisions:
  - Sorted only marketplace presentation blocks by case-insensitive name and then project-before-user; preserved caller input order for rows within each block.
  - Kept impossible union combinations as compile-time negative evidence and removed the unreachable switch default instead of forging runtime input.
  - Retained filesystem, ledger, collaborator sequencing, compatibility, and end-to-end notification behavior in the supplemental lifecycle suite.
  - Replaced the lifecycle harness double casts with typed strong mocks and complete tool-name probes.
patterns-established:
  - Presenter owners assert complete public objects and exact notification bytes with lowercase AAA phases.
  - Closed-union switches rely on explicit return types and noImplicitReturns rather than unreachable runtime coverage arms.
requirements-completed: [MOD-06]
coverage:
  - id: D1
    description: All four reinstall presenter runtime exports have complete direct partition, optional-field, ordering, severity, and reload coverage.
    requirement: MOD-06
    verification:
      - kind: unit
        ref: tests/orchestrators/plugin/reinstall.messaging.test.ts
        status: pass
      - kind: unit
        ref: npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Marketplace blocks sort case-insensitively with project before user while rows retain caller order inside each block.
    requirement: MOD-06
    verification:
      - kind: unit
        ref: tests/orchestrators/plugin/reinstall.messaging.test.ts#renderReinstallPartitionAndNotify sorts case-insensitive names and scopes while preserving block row order
        status: pass
    human_judgment: false
  - id: D3
    description: The retained reinstall supplemental owns lifecycle effects and end-to-end notifications without direct presenter duplication or impossible casts.
    requirement: MOD-06
    verification:
      - kind: integration
        ref: tests/orchestrators/plugin/reinstall.test.ts
        status: pass
      - kind: architecture
        ref: tests/architecture/catalog-uat.test.ts
        status: pass
    human_judgment: false
duration: 22 min
completed: 2026-09-01
status: complete
---

# Phase 113 Plan 25: Reinstall Messaging Summary

**Reinstall messaging now has one direct owner proving every projection, narrowing, grouping, ordering, severity, cardinality, and trailer contract at exact 100% direct coverage.**

## Performance

- **Duration:** 22 min
- **Completed:** 2026-09-01T05:02:11Z
- **Tasks:** 1
- **Files modified:** 1 new owner, 2 implementation files, plus plan metadata and this summary
- **Implementation commit:** `417eba9e`

## Accomplishments

- Created the canonical direct owner with 20 runtime cases covering `renderReinstallPartitionAndNotify`, `reinstalledRowFromOutcome`, `outcomeToPluginMessage`, and `narrowReasons`.
- Proved exact block sorting across mixed-case equal marketplace names, project-before-user scope order, and stable caller input order for rows within each block.
- Covered single and plural cardinality, all four rendered statuses, all three outcome partitions, manual-recovery precedence, typed and fallback reasons, scope and version omission, all four agent/MCP dependency combinations, degraded-kind order, severity, tally, and reload behavior.
- Proved undefined, empty, exact, substring, rollback, unknown, duplicate, ordered, frozen, and independent reason-narrowing results.
- Moved ten direct presenter/projection cases out of `reinstall.test.ts`, leaving 74 filesystem, ledger, collaborator, compatibility, and end-to-end lifecycle cases.
- Replaced the supplemental harness's two `as unknown as` casts with typed strong mocks and exact tool-name probes.
- Reached exact direct coverage for `reinstall.messaging.ts`: 63/63 branches, 14/14 functions, and 445/445 lines.

## Task Commit

1. **Plan amendment: Authorize the unreachable-switch simplification** - `97047d00` (docs)
2. **Task 1: Exhaust public partitions and consolidate direct assertions** - `417eba9e` (test)

## Files Created/Modified

- `tests/orchestrators/plugin/reinstall.messaging.test.ts` - Sole mirrored owner for reinstall projection, narrowing, grouping, sorting, render bytes, and notification decisions.
- `tests/orchestrators/plugin/reinstall.test.ts` - Retains lifecycle behavior after direct presenter cases move; uses typed context, API, UI, and tool probes.
- `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts` - Removes the unreachable closed-union default arm and now-unused `assertNever` import.
- `.planning/phases/113-orchestrator-support-and-presenters/113-25-PLAN.md` - Records the authorized production simplification in the task inventory and action.
- `.planning/phases/113-orchestrator-support-and-presenters/113-25-SUMMARY.md` - Records execution, coverage, supplemental disposition, and atomic commits.

## Supplemental Disposition

- Removed direct `outcomeToPluginMessage` cases for manual recovery, typed-reason precedence, source-missing and permission failures, rollback fallback, opaque fallback, and release-wrapped recovery classification.
- Removed synthetic direct `renderReinstallPartitionAndNotify` inline-recovery coverage and the direct clean/degraded bulk-mapper comparison.
- Retained real filesystem staging, state persistence, transaction ledger, clone-cache interaction, collaborator ordering, lock and rollback behavior, compatibility paths, and end-to-end notification bytes.
- Retained 74 lifecycle cases with genuine orchestrator outcomes; no presenter export remains imported by the supplemental.

## Decisions Made

- Preserved case-sensitive marketplace identity for grouping while applying the documented case-insensitive comparator only to presentation order.
- Preserved input order inside each `(scope, marketplace)` block, including interleaved source outcomes.
- Used complete literal expected objects and bytes rather than snapshots or test-side projection logic.
- Kept invalid discriminated-union combinations as `@ts-expect-error` evidence at their exact diagnostics; no invalid runtime object, proxy, or cast was introduced.
- Kept the lifecycle supplemental offline and case-local while replacing its incomplete context/API object casts with typed mocks.

## Verification

- `node --test tests/orchestrators/plugin/reinstall.messaging.test.ts` - passed with 20 direct runtime cases.
- `node --test tests/orchestrators/plugin/reinstall.test.ts` - passed with 74 retained lifecycle cases.
- `npm run typecheck` - passed on the settled final working tree.
- `npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts` - passed at 63/63 branches, 14/14 functions, and 445/445 lines.
- `node --test tests/architecture/catalog-uat.test.ts` - passed.
- Targeted ESLint and Prettier checks for the owner, supplemental, and authorized source, plus plan formatting - passed.
- Lowercase-AAA, no-skip, no-ignore, no-impossible-cast, no-assertNever, and `git diff --check` gates - passed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Removed the unreachable closed-union default arm**

- **Found during:** Task 1 direct branch coverage.
- **Issue:** The only missing line and two branches were `default: return assertNever(outcome)` in a switch over the closed `ReinstallPluginOutcome` union. Reaching it required an impossible cast, forged proxy, or test seam, all forbidden by the plan.
- **Fix:** With root authorization, removed the unreachable default and now-unused `assertNever` import. The function's explicit `ReinstallMsg` return type plus project `noImplicitReturns` preserve compile-time exhaustiveness if a union member is added.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts`, `.planning/phases/113-orchestrator-support-and-presenters/113-25-PLAN.md`.
- **Verification:** Focused owner, supplemental lifecycle suite, global typecheck, exact direct coverage, catalog UAT, ESLint, Prettier, structural scans, and diff checks all pass.
- **Commits:** `97047d00`, `417eba9e`.

**Total deviations:** 1 auto-fixed blocking issue.

**Impact on plan:** The simplification removes dead syntax without changing any reachable outcome, public type, runtime row, message byte, severity, or reload behavior. No test seam, coverage ignore, impossible runtime value, or second P113 pair was introduced.

## Issues Encountered

- Initial direct coverage reached 62/64 branches and 448/449 lines before the unreachable default was identified. The authorized simplification and one missing ordinary-failure scope-presence case produced the final exact coverage counts.
- Concurrent Phase 113 agents observed temporary owner diagnostics while the new type evidence and supplemental mock harness were being assembled. The settled complete working tree passes global typecheck.

## User Setup Required

None - presenter and lifecycle verification are fully offline.

## Known Stubs

None.

## Security Review

T-113-25 is mitigated: exact partition objects and notification bytes prevent partial reinstall failures or manual-recovery outcomes from being reported as clean success. Stable causal row order, truthful reason precedence, scope attribution, severity, and reload stamps are directly proven. No new external or trust boundary was introduced.

## Next Phase Readiness

Reinstall presenter ownership is singular, exhaustive, isolated, and ready for Phase 115 lifecycle integration verification. No blocker remains.

## Self-Check: PASSED

- The authorized source, sole direct owner, retained lifecycle supplemental, updated plan, and this summary exist.
- The supplemental no longer imports or directly exercises any reinstall presenter export.
- Focused owner, retained lifecycle suite, global typecheck, exact direct coverage, catalog UAT, lint, format, forbidden-pattern, and diff checks pass.
- No skip, coverage ignore, impossible cast, forged runtime union value, production test seam, hidden external call, or second Phase 113 pair was introduced.
- Commits `97047d00` and `417eba9e` contain only the P113-25 plan amendment and implementation paths.

---

_Phase: 113-orchestrator-support-and-presenters_
_Completed: 2026-09-01_

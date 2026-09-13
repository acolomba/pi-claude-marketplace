---
phase: 06-assertion-and-module-refinement
plan: 41
subsystem: plugin-orchestration
tags: [typescript, update, ownership-migration, architecture-gates, documentation]
requires:
  - phase: 06-assertion-and-module-refinement
    provides: Update preflight/swap owners from Plan 39 and cascade/flow owners from Plan 40
provides:
  - Verified direct update-owner references across Plan 41 documentation, shared contracts, and architecture gates
  - Correct recovery-hint ownership attribution to update-swap.ts
  - Preserved generic update.ts/update.test.ts hub-ledger until its scheduled Plan 43 retirement
affects: [plugin-update, architecture-gates, phase-06-update-hub-retirement]
plan_head_before: bc133197074bb2e6a73caa779e24d28fd7fb749a
actuals:
  tokens: 168
  tasks: 2
  commits: 1
tech-stack:
  added: []
  patterns:
    - direct owner references follow the behavior-bearing module rather than the legacy hub name
    - safe-resume accepts already-satisfied migrations without duplicate churn
key-files:
  created:
    - .planning/phases/06-assertion-and-module-refinement/06-41-SUMMARY.md
  modified:
    - extensions/pi-claude-marketplace/shared/markers.ts
key-decisions:
  - "Repoint only the stale recovery-hint comment to update-swap.ts; keep update.ts references that still describe real enumeration, failure projection, cause-chain aggregation, lifecycle guarding, or hub-ledger tests."
  - "Treat Plan 39/40 caller and scanner migrations as pre-completed work and verify them in place instead of recreating their edits."
patterns-established:
  - "Safe-resume ownership migration: trace live symbols first, retain genuine legacy-owner references, and edit only stale prose or imports."
requirements-completed: [TREF-07, TREF-09]
coverage:
  - id: D1
    description: Update documentation, shared contracts, convergence coverage, and disabled-state scanning point to the exact live owners without weakening behavior or gate scope.
    requirement: TREF-09
    verification:
      - kind: integration
        ref: node --test tests/architecture/cross-op-convergence.test.ts tests/architecture/disabled-state-classification.test.ts tests/architecture/markers-snapshot.test.ts tests/shared/errors.test.ts
        status: pass
      - kind: other
        ref: live CodeGraph ownership trace plus targeted stale-reference inspection
        status: pass
    human_judgment: false
  - id: D2
    description: Manifest, lifecycle, network, e2e, handler, owner-pair, correspondence, and dead-code gates preserve the update flow after the Plan 39/40 migrations.
    requirement: TREF-07
    verification:
      - kind: integration
        ref: node --test tests/architecture/manifest-lookup-drift.test.ts tests/architecture/no-lifecycle-default-enabled-read.test.ts tests/architecture/no-orchestrator-network.test.ts tests/e2e/import-command.test.ts tests/edge/handlers/plugin/update.test.ts
        status: pass
      - kind: unit
        ref: node --test tests/orchestrators/plugin/update-preflight.test.ts tests/orchestrators/plugin/update-swap.test.ts tests/orchestrators/plugin/update-cascade.test.ts tests/orchestrators/plugin/update-flow.test.ts tests/orchestrators/plugin/update.test.ts tests/scripts/check-phase-06-hub-ledger.test.ts
        status: pass
      - kind: other
        ref: npm run typecheck && npm run test:corresponding && npm run fallow && npm run lint
        status: pass
    human_judgment: false
duration: 7min
completed: 2026-09-09
status: complete
---

# Phase 06 Plan 41: Update Caller and Gate Migration Summary

**Plan 41 verified the Plan 39/40 update-owner migrations in place and corrected the sole genuinely stale recovery-hint attribution from `update.ts` to `update-swap.ts`.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-09-09T17:35:51Z
- **Completed:** 2026-09-09T17:42:34Z
- **Tasks:** 2
- **Files newly modified:** 1

## Accomplishments

- Confirmed that prior Plan 39/40 commits had already migrated six of the seven scoped caller, scanner, documentation, and shared-owner targets to `update-preflight.ts`, `update-swap.ts`, or `update-flow.ts`.
- Repointed the remaining stale `RECOVERY_PLUGIN_REINSTALL_PREFIX` owner comment to `update-swap.ts`, which constructs the final recovery hint.
- Preserved valid `update.ts` references where the retained hub still owns target enumeration, direct failure projection, cause-chain outcome aggregation, and the generic lifecycle ledger.
- Proved the migrated architecture/e2e/handler surfaces, all four named update owner pairs, the retained hub ledger, and repository type/graph/style gates.

## Pre-Completed Work Accepted on Resume

Plan 41 began after broader caller and scanner migrations had already landed during Plans 39 and 40. Those edits were treated as completed evidence and were not duplicated:

- `7845eae7` repointed `disabled-state-classification.test.ts` and `manifest-lookup-drift.test.ts` to `update-preflight.ts`.
- `768fcb51` extended the default-enabled lifecycle guard across the preflight and swap owners while retaining the behavior-bearing hub.
- `2f0126cb` migrated `docs/plugin-enablement.md`, `shared/errors.ts`, `cross-op-convergence.test.ts`, the flow/handler/e2e callers, and the final update ownership surfaces introduced by Plan 40.

## Task Commits

1. **Task 1: Repoint update docs/shared/gates group one** - `f5d24b62` (docs; one remaining stale owner comment). The other four files were pre-completed by `7845eae7` and `2f0126cb` and verified unchanged.
2. **Task 2: Repoint update architecture/e2e group** - pre-completed by `7845eae7`, `768fcb51`, and `2f0126cb`; verified in place with no new commit.

## Files Created/Modified

- `extensions/pi-claude-marketplace/shared/markers.ts` - Attributes final recovery-hint composition to `update-swap.ts`, the live owner.
- `.planning/phases/06-assertion-and-module-refinement/06-41-SUMMARY.md` - Records safe-resume provenance, current ownership, and verification.

## Decisions Made

- Kept the `shared/errors.ts` reference to `orchestrators/plugin/update.ts` because `update.ts` still calls `composeErrorWithCauseChain` for direct failure outcomes.
- Kept `update.ts` in `no-lifecycle-default-enabled-read.test.ts` because the retained hub remains behavior-bearing and the guard intentionally covers it alongside flow, preflight, and swap.
- Kept `update.test.ts` references in `cross-op-convergence.test.ts` because the cited ATTR-02 and NFR-5 cases still live in the generic hub-ledger suite until Plan 43.

## Deviations from Plan

None - safe-resume found most Plan 41 migrations already satisfied by the documented Plan 39/40 expansion commits. The only new edit was the remaining stale shared marker comment.

## Verification

- Task 1 architecture/shared tests: **4/4 pass** (`cross-op-convergence`, `disabled-state-classification`, `markers-snapshot`, `shared/errors`).
- Task 2 architecture/e2e/handler plus hub-ledger tests: **7/7 pass**.
- Named update owner tests: **4/4 pass** (`update-preflight`, `update-swap`, `update-cascade`, `update-flow`).
- `npm run typecheck`: pass.
- `npm run test:corresponding`: pass.
- `npm run fallow`: pass with no enforced issues.
- `npm run lint`: pass.
- Targeted Prettier for all seven Plan 41 targets: pass.
- Repository `npm run format:check`: reports only the preserved untracked `.mcp.json`, the known pre-existing formatting debt.

## Issues Encountered

- The repository-wide format check remains red only for untracked `.mcp.json`. The file predates this plan, is unrelated, and was preserved byte-for-byte.
- Existing Phase 1 revalidation artifacts and local configuration changes were preserved unchanged and excluded from commits.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 42 can accept its caller migrations already completed by Plan 40 and verify any remaining scoped references without churn.
- The behavior-bearing `update.ts` / `update.test.ts` generic hub-ledger pair remains intact for the explicit consolidation and PRE-EDIT deletion proof in Plan 43.

---

*Phase: 06-assertion-and-module-refinement*
*Completed: 2026-09-09*

## Self-Check: PASSED

The summary and the new task commit exist; all three prior-plan commits accepted as pre-completed evidence are present. Coverage metadata validates as fully automated, and the stub scan found only initialized local accumulator arrays and documented null/empty-string handling, not shipped stubs.

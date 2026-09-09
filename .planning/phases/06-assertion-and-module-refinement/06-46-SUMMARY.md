---
phase: 06-assertion-and-module-refinement
plan: 46
subsystem: plugin-orchestration
tags: [typescript, reinstall, flow-owner, tdd, direct-coverage]
requires:
  - phase: 06-assertion-and-module-refinement
    provides: Direct reinstall target, clone, replacement, and outcome owners from Plans 44-45
provides:
  - Public reinstall flow owner that binds all four extracted leaf owners
  - Public reinstall factories and contracts outside the retained sequencing hub
  - Exact happy-path artifact and notification proof with complete direct flow-owner coverage
affects: [plugin-reinstall, edge-register, reconcile-backfill, phase-06-hub-retirement]
plan_head_before: af61dd86d6effbdca5392624f83f246eec8e29c1
actuals:
  tokens: 11163
  tasks: 2
  commits: 3
tech-stack:
  added: []
  patterns:
    - public flow owners bind named leaf owners to retained behavior-bearing sequencing functions
    - flow extraction migrates live callers atomically without compatibility re-exports
key-files:
  created:
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts
    - tests/orchestrators/plugin/reinstall-flow.test.ts
    - .planning/tdd-evidence/06-46-01.json
    - .planning/phases/06-assertion-and-module-refinement/06-46-SUMMARY.md
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
    - extensions/pi-claude-marketplace/edge/register.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/backfill.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts
    - extensions/pi-claude-marketplace/shared/errors.ts
key-decisions:
  - "Make reinstall-flow.ts the exclusive owner of public reinstall options, dependency contracts, function types, and factory exports."
  - "Expose a typed ReinstallFlowOwners bundle and two real sequencing functions from reinstall.ts instead of adding a compatibility re-export or forwarding facade."
  - "Migrate every live public factory/type caller with the owner move so the repository remains type-correct between plans."
patterns-established:
  - "Flow-owner composition: bind concrete leaves once, then pass the bundle into a retained behavior-bearing sequencer."
requirements-completed: [TREF-07, TREF-09]
coverage:
  - id: D1
    description: The public reinstall flow directly composes target selection, clone probing, transaction replacement, and outcome recording while preserving all injected and Node-backed factories.
    requirement: TREF-07
    verification:
      - kind: unit
        ref: npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts
        status: pass
      - kind: integration
        ref: tests/orchestrators/plugin/reinstall-flow.test.ts and tests/orchestrators/plugin/reinstall.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: End-to-end reinstall preserves the exact staged SKILL bytes, resource set, version metadata, data cleanup, and operator notification text.
    requirement: TREF-09
    verification:
      - kind: integration
        ref: tests/orchestrators/plugin/reinstall-flow.test.ts#direct happy-path artifact and notification assertions
        status: pass
      - kind: other
        ref: npm run test:corresponding && npm run fallow
        status: pass
    human_judgment: false
duration: 19min
completed: 2026-09-09
status: complete
---

# Phase 06 Plan 46: Reinstall Flow Owner Summary

**A public reinstall flow owner now composes all four extracted leaves, owns every factory and contract, and proves exact installed artifacts and notifications with complete direct coverage.**

## Performance

- **Duration:** 19 min
- **Started:** 2026-09-09T19:24:48Z
- **Completed:** 2026-09-09T19:43:13Z
- **Tasks:** 2
- **Task commits:** 3
- **Files changed by task commits:** 15
- **Realized diff scale:** 11,163 estimate tokens (44,653 diff characters / 4)

## Accomplishments

- Added `reinstall-flow.ts` as the exclusive public owner of reinstall options, dependencies, function contracts, and injected/Node factory creation.
- Bound `selectReinstallTargets`, `probeReinstallClone`, `REAL_REINSTALL_TRANSACTION`, and `recordReinstallOutcome` directly into one typed production composition without a facade or compatibility re-export.
- Reduced `reinstall.ts` to genuine behavior-bearing lock, ordering, lifecycle, and bulk sequencing behind explicit injected-owner seams for the locked Plan 48 retirement.
- Added a mirrored flow-owner suite that proves injected, direct Node, and bulk factories plus exact staged SKILL bytes, preserved metadata, removed data, and notification text.
- Migrated every live factory/type caller atomically and repointed neighboring owner documentation to `reinstall-flow.ts`.

## Task Commits

Each TDD phase and documentation task was committed atomically:

1. **Task 1 RED: failing reinstall flow-owner specification** - `22156854` (test)
2. **Task 1 GREEN: flow owner, composition seams, exact proof, and caller migration** - `65719192` (feat)
3. **Task 2: neighboring ownership references** - `28764585` (docs)

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts` - Public contracts and factory composition over all four named reinstall leaves.
- `tests/orchestrators/plugin/reinstall-flow.test.ts` - Mirrored direct owner proof for public factories and exact end-to-end results.
- `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts` - Retained behavior-bearing sequencing with an explicit leaf-owner bundle and no public factory exports.
- `extensions/pi-claude-marketplace/edge/register.ts` and `extensions/pi-claude-marketplace/edge/handlers/plugin/reinstall.ts` - Runtime callers imported directly from the new owner.
- `extensions/pi-claude-marketplace/orchestrators/reconcile/backfill.ts` - Reconcile caller imported public reinstall contracts from the new owner.
- `tests/architecture/cross-op-convergence.test.ts`, `tests/edge/handlers/plugin/reinstall.test.ts`, `tests/integration/transaction-lifecycle-cascade.test.ts`, and `tests/orchestrators/plugin/enable-disable.test.ts` - Test callers followed the public owner move.
- `extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts`, `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts`, and `extensions/pi-claude-marketplace/shared/errors.ts` - Ownership prose points to `reinstall-flow.ts`.

## Decisions Made

- Put the complete public flow surface in `reinstall-flow.ts`; callers do not need to know that `reinstall.ts` temporarily retains sequencing internals.
- Use a concrete `ReinstallFlowOwners` bundle to bind all four leaf modules once. The legacy hub therefore remains real implementation, not a forwarding facade.
- Move live callers in the same commit as the public contracts. Deferring them to the overlapping Plan 47 task would leave this plan uncompilable and would require forbidden compatibility exports.
- Preserve the legacy suite as the sequencing ledger while moving one exact happy-path proof to the mirrored flow-owner suite. Plan 48 can retire the hub and consolidate the temporary fixture imports atomically.

## TDD Gate Compliance

- Task 1 RED failed because `reinstall-flow.ts` did not exist. `.planning/tdd-evidence/06-46-01.json` passed `check tdd-red-evidence` before production edits.
- Task 1 GREEN passes the mirrored flow-owner suite, the complete retained sequencing suite, and all affected caller suites.
- Direct owner coverage reports **6/6 branches, 5/5 functions, and 112/112 lines**.
- RED and GREEN are separate commits; neither was amended.

## Deviations from Plan

### Authorized Boundary Expansion

**1. Migrated all live factory/type callers with the public owner move**

- **Found during:** Task 1 implementation
- **Issue:** The locked Plan 47 file list overlaps part of the caller migration, but moving the public contracts in Plan 46 without those callers would break typecheck or require a compatibility re-export from the retired owner.
- **Fix:** Migrated the edge register, edge handler, reconcile backfill, architecture, integration, and orchestrator test callers directly to `reinstall-flow.ts`.
- **Files modified:** `edge/register.ts`, `edge/handlers/plugin/reinstall.ts`, `orchestrators/reconcile/backfill.ts`, `tests/architecture/cross-op-convergence.test.ts`, `tests/edge/handlers/plugin/reinstall.test.ts`, `tests/integration/transaction-lifecycle-cascade.test.ts`, and `tests/orchestrators/plugin/enable-disable.test.ts`
- **Verification:** Typecheck, lint, all affected suites, corresponding-test enforcement, and fallow pass.
- **Committed in:** `65719192`

---

**Total deviations:** 1 authorized boundary expansion.
**Impact on plan:** The expansion is required to make the public owner move atomic and leaves Plan 47 with less migration work; it adds no behavior or compatibility surface.

## Verification

- Flow owner + retained sequencing + three architecture suites: **5/5 files pass**.
- Direct flow-owner coverage: **6/6 branches, 5/5 functions, and 112/112 lines**.
- Edge register, edge reinstall handler, reconcile backfill, transaction lifecycle cascade, enable/disable, and cross-operation convergence suites: pass.
- `npm run typecheck`: pass.
- `npm run lint`: pass with zero warnings.
- `npm run test:corresponding`: pass.
- `npm run fallow`: pass with no enforced issue.
- `npm run test:corresponding:negative`: pass.
- `npm run test:coverage:direct:negative`: pass outside the sandbox after the sandbox reproduced its known child-process stderr suppression.
- Targeted Prettier across every changed Phase 06-46 TypeScript and JSON file: pass.
- `git diff --check`: pass.

## Issues Encountered

- The direct-coverage negative control reproduced the repository's known sandbox-only child-process stderr suppression. The same command passed outside the sandbox.
- Repository-wide formatting was not used because the preserved untracked `.mcp.json` is known pre-existing formatting debt. Scoped formatting over every plan-owned file passes.
- Existing unrelated Phase 1 review artifacts and local configuration changes were preserved unchanged and excluded from every commit.
- Best-effort deviation registration in `.planning/WINDOWS.md` was rejected because its pre-existing rendered table disagrees with JSON rows 9 and 30. The ledger was left untouched rather than rewriting unrelated entries.

## Known Stubs

None. Empty collections in changed code are populated transaction accumulators or asserted test fixtures; existing “placeholder” wording documents a real synthetic failure row.

## Threat Flags

None - the plan moves existing public contracts and composition into a named owner without adding an endpoint, authentication path, filesystem trust boundary, schema change, or notification capability.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Every public reinstall factory and contract now resolves through the direct-tested flow owner.
- The remaining `reinstall.ts` exports are genuine sequencing seams, ready for Plan 48 to consolidate into the flow owner and delete the legacy hub/test pair.
- Plan 47 can treat already-migrated callers as satisfied and focus only on any remaining ownership checks in its locked scope.

---

_Phase: 06-assertion-and-module-refinement_
_Completed: 2026-09-09_

## Self-Check: PASSED

The new flow owner, mirrored test, RED evidence, and this summary exist; all three task/TDD commits resolve from the persisted plan base; the measured commit count is three; direct coverage is complete; focused and repository quality gates pass; and no public factory/type import remains pointed at the retired hub owner.

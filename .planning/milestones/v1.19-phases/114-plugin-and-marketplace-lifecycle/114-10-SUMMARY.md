---
phase: 114-plugin-and-marketplace-lifecycle
plan: 10
subsystem: plugin-lifecycle
tags: [typescript, node-test, plugin-install, authentication, rollback, direct-coverage]
requires:
  - phase: 113-orchestrator-support-and-presenters
    provides: Install notification, reason, and ledger contracts
provides:
  - Exact install source, authentication, ledger, rollback, warning, and retry proof
  - One direct owner containing all eight former install-auth cases
affects:
  - phase-114-plan-07
  - phase-115-composition-orchestrators
  - phase-116-edge-surfaces
actuals:
  tasks: 1
  commits: 1
tech-stack:
  added: []
  patterns:
    - Narrow legacy result shapes with private producer-backed type guards
    - Prove each ledger phase failure through failing-phase undo and newest-first rollback
key-files:
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
    - tests/orchestrators/plugin/install.test.ts
  deleted:
    - tests/orchestrators/plugin/install-auth.test.ts
key-decisions:
  - Absorbed all eight authentication cases into the direct owner with a stable title prefix.
  - Removed only three private fallbacks whose sole producers guarantee the required installed, error, or cause value.
requirements-completed: [MOD-07]
coverage:
  - id: D1
    description: Plugin install preserves exact source, authentication, materialization, ledger, rollback, warning, persistence, cleanup, and retry behavior.
    requirement: MOD-07
    verification:
      - kind: unit
        ref: tests/orchestrators/plugin/install.test.ts
        status: pass
      - kind: other
        ref: npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
        status: pass
    human_judgment: false
completed: 2026-09-01
status: complete
---

# Phase 114 Plan 10: Plugin Install Summary

**Plugin install now has one exhaustive direct owner for authentication, resource materialization, phase-ledger failure handling, partial rollback, persistence, warnings, and safe retry.**

## Accomplishments

- Moved all eight install-auth cases into the direct owner and deleted the supplemental.
- Covered path, GitHub, URL, git-subdir, warm/cold cache, credential and Device Flow behavior, every resource phase, state/config persistence, warnings, cleanup, partial rollback, and retry.
- Proved failing-phase undo first, completed phases newest-first, structured rollback partials, containment propagation, and exact offline/network schedules.
- Reached 236/236 branches, 51/51 functions, and 2453/2453 lines directly from 126 explicit owner cases.

## Task Commit

1. **Task 1: Exhaust plugin install and absorb eight authentication cases** - `eb981a18`

## Files Modified

- `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` - Three evidence-gated private invariant refinements.
- `tests/orchestrators/plugin/install.test.ts` - Sole direct plugin-install owner.
- `tests/orchestrators/plugin/install-auth.test.ts` - Deleted after all eight cases moved.

## Verification

- Focused owner: 126/126 cases passed.
- Transferred authentication subset: exactly 8/8 passed.
- Direct coverage: 236/236 branches, 51/51 functions, 2453/2453 lines.
- Phase-ledger suite, 26 architecture cases, global typecheck, ESLint, Prettier, prohibited-pattern scans, added-line scans, and diff checks passed.

## Deviations from Plan

- Applied D-UTR-12 to remove the private unpopulated-install-context fallback and the missing ledger-error and cascade-cause fallbacks. CodeGraph proved the sole producer of each value always populates or normalizes it. Private type guards retain compile-time precision without changing shared exported types, runtime behavior, order, or error identity.

## Issues Encountered

- The project lint rule rejected a non-null assertion for producer-backed failure values. Private discriminant type guards expressed the same proven invariant without a pragma or cast.

## User Setup Required

None.

## Security Review

Fresh allowlisted Git, credential, and Device Flow collaborators; empty offline schedules; exact rollback and artifact inventories; containment propagation; and no-network/no-credential-leak gates mitigate the plan threats.

## Self-Check: PASSED

- The direct owner contains exactly eight transferred authentication cases and the supplemental is absent.
- Runtime tests use separate lowercase arrange, act, and assert phases.
- Behavior-bearing phase, rollback, notification, and external-call order remains intact.

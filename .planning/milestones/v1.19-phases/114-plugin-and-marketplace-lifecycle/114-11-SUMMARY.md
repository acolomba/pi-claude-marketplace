---
phase: 114-plugin-and-marketplace-lifecycle
plan: 11
subsystem: plugin-lifecycle
tags: [typescript, node-test, plugin-list, presentation, manifests, direct-coverage]
requires:
  - phase: 113-orchestrator-support-and-presenters
    provides: List notification, inventory, and reason contracts
provides:
  - Exact read-only plugin inventory, manifest, scope, filter, and ordering proof
  - One direct owner containing all 17 former manifest-absence cases
affects:
  - phase-115-composition-orchestrators
  - phase-116-edge-surfaces
actuals:
  tasks: 1
  commits: 1
tech-stack:
  added: []
  patterns:
    - Narrow private classifier relationships at the value carrying the evidence
    - Rank scopes explicitly for project-before-user presentation order
key-files:
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/list.ts
    - tests/orchestrators/plugin/list.test.ts
  deleted:
    - tests/orchestrators/plugin/list-manifest-absent.test.ts
key-decisions:
  - Absorbed all 17 manifest-absence cases into the direct owner with a stable title prefix.
  - Removed source-text oracles and impossible fixture casts in favor of exported runtime and compiler evidence.
requirements-completed: [MOD-07]
coverage:
  - id: D1
    description: Plugin list preserves exact state, manifest, resource, scope, filter, presentation, immutability, and offline behavior.
    requirement: MOD-07
    verification:
      - kind: unit
        ref: tests/orchestrators/plugin/list.test.ts
        status: pass
      - kind: other
        ref: npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/plugin/list.ts
        status: pass
    human_judgment: false
completed: 2026-09-01
status: complete
---

# Phase 114 Plan 11: Plugin List Summary

**Plugin list now has one exhaustive read-only owner covering both scopes, every inventory and manifest state, filters, exact presentation, and offline behavior.**

## Accomplishments

- Moved all 17 manifest-absence cases into the direct owner and deleted the supplemental.
- Replaced four source scans and all three impossible fixture casts with exported behavior, exact immutability evidence, and a compiler witness.
- Proved installed, disabled, available, unavailable, remote, partial, folded, failed-manifest, filter, scope, dependency-marker, and ordering surfaces with strict fresh Pi/UI collaborators.
- Reached 180/180 branches, 37/37 functions, and 1575/1575 lines directly from 89 explicit owner cases.

## Task Commit

1. **Task 1: Exhaust plugin list and absorb 17 manifest-absence cases** - `80a3d0d3`

## Files Modified

- `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts` - Five evidence-gated private unreachable-branch simplifications.
- `tests/orchestrators/plugin/list.test.ts` - Sole direct plugin-list owner.
- `tests/orchestrators/plugin/list-manifest-absent.test.ts` - Deleted after all 17 cases moved.

## Verification

- Focused owner: 89/89 cases passed.
- Transferred manifest-absence subset: exactly 17/17 passed.
- Direct coverage: 180/180 branches, 37/37 functions, 1575/1575 lines.
- Four architecture gates, global typecheck, ESLint, Prettier, prohibited-pattern scans, added-line scans, and diff checks passed.

## Deviations from Plan

- Applied D-UTR-12 to encode the classifier's partially-available relationship, remove a closed-switch default, narrow the orphan-fold record after its clone predicate, and replace two construction-unreachable scope ternaries with explicit rank subtraction. CodeGraph proved all five private branches unreachable; public values and project-before-user ordering are unchanged.

## Issues Encountered

- Node worker isolation reports a file wrapper as one TAP test. Exact transferred-case verification uses `--test-isolation=none`, as recorded in the corrected Phase 114 plans.

## User Setup Required

None.

## Security Review

Exact read-only state/config/tree snapshots, strict connected notification collaborators, catalog and disabled-state gates, and the no-orchestrator-network gate mitigate the plan threats.

## Self-Check: PASSED

- The direct owner contains exactly 17 transferred manifest-absence cases and the supplemental is absent.
- Runtime tests use separate lowercase arrange, act, and assert phases.
- Presentation inventories are alphabetical while scope, reason, caller, and stable input order remain contractual.

---
phase: 113-orchestrator-support-and-presenters
plan: 22
subsystem: orchestrator-presenters
tags: [typescript, node-test, install, messaging, direct-coverage]
requires:
  - phase: 113-orchestrator-support-and-presenters
    provides: P113-35 typed install outcome unions and the locked presenter ownership contract
provides:
  - Canonical direct owner for all install message render, composition, narrowing, and failure-collapse partitions
  - Exact install row bytes, complete structured message values, and resolver-reason order and precedence proof
  - Consolidated lifecycle and cross-surface supplemental ownership without duplicate direct helper assertions
affects:
  - 114 plugin-install lifecycle owner
  - MOD-06 orchestrator-support verification
actuals:
  tokens: 22344
  tasks: 1
  commits: 2
tech-stack:
  added: []
  patterns:
    - Complete case-local structured values paired with exact command-owned row bytes
    - Closed-union exhaustiveness through explicit return types and noImplicitReturns rather than unreachable runtime guards
key-files:
  created:
    - tests/orchestrators/plugin/install.messaging.test.ts
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts
    - tests/orchestrators/plugin/install.test.ts
    - tests/orchestrators/plugin/cross-surface-reason-parity.test.ts
key-decisions:
  - Kept filesystem, ledger, rollback, and end-to-end notification behavior in the install lifecycle supplemental.
  - Kept only genuine install versus list/info reason parity in the cross-surface supplemental.
  - Removed the CodeGraph-proven unreachable PluginShapeErrorShape default while retaining compile-time exhaustiveness.
requirements-completed: [MOD-06]
coverage:
  - id: D1
    description: Every install render, composer, classifier, cause, and resolver-reason partition has a complete independent contract assertion.
    requirement: MOD-06
    verification:
      - kind: unit
        ref: tests/orchestrators/plugin/install.messaging.test.ts
        status: pass
      - kind: unit
        ref: npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Retained install lifecycle and list/info/install reason parity behavior remains green after direct-owner consolidation.
    requirement: MOD-06
    verification:
      - kind: integration
        ref: tests/orchestrators/plugin/install.test.ts
        status: pass
      - kind: integration
        ref: tests/orchestrators/plugin/cross-surface-reason-parity.test.ts
        status: pass
      - kind: other
        ref: tests/architecture/catalog-uat.test.ts
        status: pass
    human_judgment: false
duration: 20min
completed: 2026-09-01
status: complete
---

# Phase 113 Plan 22: Install Messaging Summary

**Install messaging now has one canonical direct owner with exact bytes and complete typed outcomes across every reachable render, composition, classification, and reason-narrowing partition.**

## Performance

- **Duration:** 20 min
- **Started:** 2026-09-01T04:48:42Z
- **Completed:** 2026-09-01T05:08:30Z
- **Tasks:** 1
- **Files modified:** 6, including this summary and the evidence-backed plan inventory update

## Accomplishments

- Added 47 direct runtime cases covering all six render arms, all exported composers and narrowers, exact row bytes, complete messages, version and scope boundaries, auth and runtime failures, cause formatting, entity shapes, reason precedence, ordering, deduplication, and fallback behavior.
- Reached exact direct coverage for `install.messaging.ts`: 88/88 branches, 18/18 functions, and 634/634 lines.
- Removed duplicate direct helper ownership from the install lifecycle suite while retaining its filesystem, state, ledger, rollback, and end-to-end notification behavior.
- Reduced the cross-surface supplemental to 16 genuine install versus list/info parity cases.

## Task Commit

1. **Plan amendment: Authorize the unreachable-switch simplification** - `83ae8007` (docs)
2. **Task 1: Exhaust public partitions and consolidate direct assertions** - `d00eb1f6` (test)

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts` - Removed only the unreachable closed-union default and its unused `assertNever` import.
- `tests/orchestrators/plugin/install.messaging.test.ts` - New sole mirrored owner with 47 complete direct cases.
- `tests/orchestrators/plugin/install.test.ts` - Removed direct messaging-helper cases; retained lifecycle integration and replaced impossible API/context casts with typed case-local mocks.
- `tests/orchestrators/plugin/cross-surface-reason-parity.test.ts` - Retained only true install/list/info reason-parity cases with complete expectations.
- `.planning/phases/113-orchestrator-support-and-presenters/113-22-PLAN.md` - Recorded the authorized production inventory and evidence-backed dead-branch action.
- `.planning/phases/113-orchestrator-support-and-presenters/113-22-SUMMARY.md` - Records execution, verification, scope, and atomic commits.

## Production Disposition

Live CodeGraph found one production caller path: `handleInstallThrow` calls `classifyEntityShapeError` after receiving an `unknown`, and the function first requires `err instanceof PluginShapeError`. `PluginShapeError.shape` is the closed four-member `PluginShapeErrorShape` union, and the switch already handles `already-installed`, `not-in-manifest`, `not-installable`, and `no-longer-installable`. The former default could therefore run only after fabricating an impossible internal union member.

The unreachable `default: return assertNever(err.shape)` and now-unused import were removed. The explicit `EntityErrorRow | undefined` return type and project-level `noImplicitReturns: true` preserve the compile-time failure if a fifth union member is introduced. No runtime input, output, export, or test seam changed.

## Supplemental Disposition

- `tests/orchestrators/plugin/install.test.ts` remains the owner for genuine filesystem and state transitions, phase-ledger rollback, bridge integration, concurrency, default-enabled handling, reload behavior, and final notification integration. Direct calls to `classifyEntityShapeError`, `classifyInstallFailure`, `composeInstallFailureMessage`, and `narrowResolverReasons` moved to the canonical owner.
- `tests/orchestrators/plugin/cross-surface-reason-parity.test.ts` remains the cross-module owner for reason equality between install and the list/info probe classifiers. Single-function fallback and deduplication partitions moved to the canonical owner.
- `tests/architecture/catalog-uat.test.ts` remains the architecture owner for catalog annotations and published output compatibility; it was verified but not modified.

## Decisions Made

- Preserved source, lifecycle, and caller order wherever it carries behavior; presentation-only inventories are alphabetical.
- Used complete literal objects and byte strings rather than snapshots or test-side reference implementations.
- Kept malformed runtime values limited to real untrusted `unknown` boundaries and did not fabricate a fifth internal union arm.

## Verification

- `node --test tests/orchestrators/plugin/install.messaging.test.ts` - passed; 47 direct runtime cases in the canonical owner.
- `node --test tests/orchestrators/plugin/install.test.ts tests/orchestrators/plugin/cross-surface-reason-parity.test.ts` - passed; both retained supplemental files green.
- `npm run typecheck` - passed on the final shared working tree.
- `npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts` - passed at 88/88 branches, 18/18 functions, and 634/634 lines.
- `node --test tests/architecture/catalog-uat.test.ts` - passed.
- Targeted ESLint and Prettier checks - passed.
- Lowercase AAA, no-skip/no-todo, no-coverage-ignore, no-impossible-cast, and `git diff --check` gates - passed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Removed a CodeGraph-proven unreachable runtime guard**

- **Found during:** Task 1 direct-coverage gate.
- **Issue:** All reachable behavior was covered, but the closed-union `assertNever` default held coverage at 640/641 lines and 88/90 branches. D-07 forbids fabricating an impossible internal union member.
- **Fix:** After root authorization and live CodeGraph caller/type proof, removed only the unreachable default and unused import. Updated the plan inventory and action to record the evidence.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts`, `.planning/phases/113-orchestrator-support-and-presenters/113-22-PLAN.md`.
- **Verification:** Global typecheck and exact direct coverage passed; the final source reports 88/88 branches, 18/18 functions, and 634/634 lines.
- **Committed in:** `83ae8007`, `d00eb1f6`.

---

**Total deviations:** 1 auto-fixed blocking issue.
**Impact on plan:** The deviation removes dead runtime code without changing behavior or widening the public contract; it enables the required honest 100% direct coverage.

## Issues Encountered

The direct-coverage gate exposed the unreachable union default. It was resolved through the plan's prescribed CodeGraph proof and an authorized dead-code removal, without casts, ignores, or new seams.

## User Setup Required

None.

## Known Stubs

None.

## Security Review

T-113-22 is mitigated. Exact complete values and bytes pin containment, rollback, entity, authentication, errno, and generic failure attribution. Tests remain offline and case-local, and the plan adds no network, process, filesystem, credential, or schema trust boundary.

## Next Phase Readiness

The Phase 114 install lifecycle owner can consume a singular, exhaustive messaging contract while retaining the integration behavior assigned to the lifecycle suite.

## Self-Check: PASSED

- The production source, canonical owner, two retained supplementals, updated plan, and summary exist.
- The canonical owner imports its exact production pair and contains no test-only production seam.
- Focused owner, retained supplementals, final global typecheck, exact direct coverage, catalog UAT, lint, format, structural scans, and diff checks pass.
- Commits `83ae8007` and `d00eb1f6` contain only the P113-22 plan amendment and implementation paths.

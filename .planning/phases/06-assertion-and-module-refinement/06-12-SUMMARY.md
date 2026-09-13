---
phase: 06-assertion-and-module-refinement
plan: "12"
subsystem: notification architecture
tags: [typescript, notifications, discriminated-unions, redaction, direct-coverage]
requires:
  - phase: 06-assertion-and-module-refinement
    provides: Resolver hub retirement and direct-owner extraction patterns through Plan 06-11
provides:
  - Minimal direct owner for closed notification vocabulary and message unions
  - Production-used security leaf for deterministic absolute-path redaction
  - Mirrored direct tests with complete branch, function, and line coverage
affects: [notification-rendering, plugin-orchestrators, reconcile-orchestrators, phase-06-refinement]
actuals:
  tokens: 46378
  tasks: 2
  commits: 5
plan_head_before: 74aacf5c4e5e146157c46756c3a272728c72ae30
tech-stack:
  added: []
  patterns: [direct named owners, mirrored owner tests, type-derived closed sets]
key-files:
  created:
    - extensions/pi-claude-marketplace/shared/notification-types.ts
    - tests/shared/notification-types.test.ts
    - extensions/pi-claude-marketplace/shared/redact-absolute-paths.ts
    - tests/shared/redact-absolute-paths.test.ts
  modified:
    - extensions/pi-claude-marketplace/shared/notify.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
key-decisions:
  - "Moved every live consumer to a direct owner import instead of retaining a notify.ts compatibility export."
  - "Preserved the redactor algorithm byte-for-byte, including its defensive no-separator branch."
patterns-established:
  - "Closed-set owner: const tuples, derived unions, message contracts, and narrowing helper live together in notification-types.ts."
  - "Security leaf: untrusted diagnostic text imports redaction directly from redact-absolute-paths.ts."
requirements-completed: [TREF-07, TREF-09]
coverage:
  - id: D1
    description: Closed notification vocabulary and discriminated message unions have one direct owner with unchanged membership, order, and field contracts.
    requirement: TREF-07
    verification:
      - kind: unit
        ref: tests/shared/notification-types.test.ts#exports the exact notification vocabulary from its named owner
        status: pass
      - kind: other
        ref: npm run test:coverage:direct -- extensions/pi-claude-marketplace/shared/notification-types.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Absolute-path redaction has one production-used security owner with stable bytes and idempotent behavior.
    requirement: TREF-09
    verification:
      - kind: unit
        ref: tests/shared/redact-absolute-paths.test.ts#repeated redaction is idempotent
        status: pass
      - kind: integration
        ref: tests/orchestrators/plugin/shared.test.ts
        status: pass
      - kind: other
        ref: npm run test:coverage:direct -- extensions/pi-claude-marketplace/shared/redact-absolute-paths.ts
        status: pass
    human_judgment: false
duration: 29min
completed: 2026-09-09
status: complete
---

# Phase 06 Plan 12: Notification Type and Redaction Owners Summary

**Closed notification contracts and deterministic path sanitization now live in two minimal, production-used direct owners with complete direct coverage.**

## Performance

- **Duration:** 29 min
- **Started:** 2026-09-09T07:00:24Z
- **Completed:** 2026-09-09T07:29:25Z
- **Tasks:** 2
- **Files modified:** 65

## Accomplishments

- Extracted the exact notification reason/status tuples, derived unions, message interfaces, severity contract, and scope-bearing predicate from `notify.ts` into `notification-types.ts`.
- Migrated all live production and test consumers to direct imports without a compatibility re-export or duplicate tuple.
- Extracted absolute-path redaction into a production-used security leaf while preserving POSIX, Windows-drive, extended-UNC, safe-text, deterministic, and idempotent behavior.
- Added one mirrored direct owner test for each new leaf; both report 100% branch, function, and line coverage.

## Task Commits

Each TDD task was committed with truthful RED and GREEN evidence:

1. **Task 1 RED: notification type owner contract** - `2758b8ef` (test)
2. **Task 1 GREEN: notification type owner extraction** - `50bf3021` (feat)
3. **Task 2 RED: absolute-path redactor owner contract** - `dcdfa829` (test)
4. **Task 2 GREEN: absolute-path redactor extraction** - `f0e9a880` (feat)
5. **Plan cleanup: direct-owner import ordering** - `b4c67a34` (style)

## Files Created/Modified

- `extensions/pi-claude-marketplace/shared/notification-types.ts` - Owns the exact closed tuples, derived types, notification interfaces/unions, severity, and scope-bearing predicate.
- `tests/shared/notification-types.test.ts` - Locks tuple order/membership, required fields, content-reason exclusions, exhaustive narrowing, and predicate behavior.
- `extensions/pi-claude-marketplace/shared/redact-absolute-paths.ts` - Owns the unchanged absolute-path-to-basename replacement algorithm.
- `tests/shared/redact-absolute-paths.test.ts` - Locks replacement bytes, safe input, multiple matches, idempotency, and defensive branching.
- `extensions/pi-claude-marketplace/shared/notify.ts` - Retains rendering and dispatch only; it no longer owns or re-exports the extracted contracts.
- Notification producers, orchestrators, and architecture tests - Import the moved contracts directly from their named owners.

## TDD Gate Compliance

- Task 1 RED evidence: `.planning/tdd-evidence/06-12-01.json` passed `tdd-red-evidence` with the named-owner test failing because `notification-types.ts` was absent.
- Task 1 GREEN: focused owner/renderer/architecture tests pass; direct coverage is branches 2/2, functions 1/1, lines 585/585.
- Task 2 RED evidence: `.planning/tdd-evidence/06-12-02.json` passed `tdd-red-evidence` with the named-owner test failing because `redact-absolute-paths.ts` was absent.
- Task 2 GREEN: focused owner/renderer/plugin tests pass; direct coverage is branches 5/5, functions 2/2, lines 13/13.

## Decisions Made

- All moved-symbol consumers use direct imports. `notify.ts` has no compatibility re-export, which keeps the ownership boundary mechanically enforceable.
- The redactor retained the original defensive `lastSeparator < 0` arm. Its owner test keeps that branch observable without changing production bytes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Migrated every live moved-symbol consumer**

- **Found during:** Task 1 and Task 2
- **Issue:** The plan named representative consumers, but removing the prohibited `notify.ts` re-exports required every existing producer, renderer, orchestrator, and test consumer to import the new owners directly.
- **Fix:** Updated all live imports and the architecture locks that inspect tuple ownership; no compatibility barrel or duplicate implementation remains.
- **Files modified:** Notification consumers under `extensions/pi-claude-marketplace/` and their matching tests.
- **Verification:** `npm run typecheck`, `npm run test:corresponding`, focused suites, repository lint, and duplicate-owner searches pass.
- **Committed in:** `50bf3021`, `f0e9a880`

**2. [Rule 3 - Blocking Issue] Normalized import order after direct-owner migration**

- **Found during:** Plan-wide style review
- **Issue:** Splitting mixed value/type imports introduced repository `import-x/order` violations in the migrated consumer set.
- **Fix:** Applied the configured ESLint ordering fix only to files changed by Task 1.
- **Files modified:** 48 migrated notification consumer and test files.
- **Verification:** `npm run lint`, `npm run typecheck`, and all focused 06-12 suites pass.
- **Committed in:** `b4c67a34`

---

**Total deviations:** 2 auto-fixed (1 Rule 2, 1 Rule 3)
**Impact on plan:** Both changes were required to enforce direct ownership and keep the extraction build- and lint-correct; no behavior or public bytes changed.

## Issues Encountered

- The sandbox denied one Unix-domain-socket bind in `tests/orchestrators/marketplace/add.test.ts`; the suite passed 63/63 when rerun with the required permission.
- Full `npm test` reached 255/257 test files. The only remaining product-suite failure is the pre-declared `tests/architecture/revalidation.test.ts` debt. An unrestricted focused run passed 94/136 and failed 42 assertions because the sealed Phase 1 fixture still expects the pre-refinement routes/statuses for TREF-04 through TREF-09. Per plan, that fixture was not modified.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Notification contracts and path sanitization are independently owned, directly covered, and ready for the remaining Phase 06 leaf extractions.
- The known Phase 1 revalidation fixture debt remains intentionally deferred and is unrelated to 06-12 behavior.

## Self-Check: PASSED

All four created owner/test files exist, and all five measured implementation commits are present in git history.

---
*Phase: 06-assertion-and-module-refinement*
*Completed: 2026-09-09*

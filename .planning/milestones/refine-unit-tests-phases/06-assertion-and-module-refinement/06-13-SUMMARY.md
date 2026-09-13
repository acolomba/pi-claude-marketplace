---
phase: 06-assertion-and-module-refinement
plan: "13"
subsystem: notification architecture
tags: [typescript, notifications, rendering, stable-sort, direct-coverage]
requires:
  - phase: 06-assertion-and-module-refinement
    provides: Notification type contracts and absolute-path redaction from Plan 06-12
provides:
  - Exact notification grammar and info rendering in one production-used owner
  - Canonical case-insensitive name-first, project-before-user stable comparator
  - Mirrored direct tests with complete branch, function, and line coverage
affects: [notification-rendering, hook-routing, plugin-orchestrators, reconcile-orchestrators, phase-06-refinement]
actuals:
  tokens: 54184
  tasks: 2
  commits: 5
plan_head_before: b3d51826244d18068e3e965614cc6d2913cd17bf
tech-stack:
  added: []
  patterns: [direct named owners, mirrored owner tests, stable structural comparator]
key-files:
  created:
    - extensions/pi-claude-marketplace/shared/notification-grammar.ts
    - tests/shared/notification-grammar.test.ts
    - extensions/pi-claude-marketplace/shared/compare-name-scope.ts
    - tests/shared/compare-name-scope.test.ts
  modified:
    - extensions/pi-claude-marketplace/shared/notify.ts
    - extensions/pi-claude-marketplace/bridges/hooks/event-router.ts
    - tests/architecture/scope-order-drift.test.ts
    - tests/architecture/compat-01-no-expansion.test.ts
key-decisions:
  - "Kept standalone notification-info rendering inside notification-grammar.ts and did not create notification-info.ts."
  - "Moved every live renderer and comparator consumer to a direct owner import without retaining compatibility exports."
patterns-established:
  - "Grammar owner: exact icons, token joins, row/header composition, trailers, and info bodies live together in notification-grammar.ts."
  - "Ordering owner: compare-name-scope.ts returns zero for exact ties so stable sort preserves caller order."
requirements-completed: [TREF-07, TREF-09]
coverage:
  - id: D1
    description: Exact notification grammar and info bytes have one named owner and remain deterministic across zero, one, many, and repeated renders.
    requirement: TREF-07
    verification:
      - kind: unit
        ref: tests/shared/notification-grammar.test.ts
        status: pass
      - kind: other
        ref: npm run test:coverage:direct -- extensions/pi-claude-marketplace/shared/notification-grammar.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Name-first ordering uses project-before-user scope rank while exact ties remain stable and repeated sorting is idempotent.
    requirement: TREF-09
    verification:
      - kind: unit
        ref: tests/shared/compare-name-scope.test.ts
        status: pass
      - kind: architecture
        ref: tests/architecture/scope-order-drift.test.ts
        status: pass
      - kind: other
        ref: npm run test:coverage:direct -- extensions/pi-claude-marketplace/shared/compare-name-scope.ts
        status: pass
    human_judgment: false
duration: 33min
completed: 2026-09-09
status: complete
---

# Phase 06 Plan 13: Notification Grammar and Ordering Owners Summary

**Byte-exact notification rendering and stable name/scope ordering now live in two production-used named owners with complete direct coverage.**

## Performance

- **Duration:** 33 min
- **Started:** 2026-09-09T07:33:49Z
- **Completed:** 2026-09-09T08:06:30Z
- **Tasks:** 2
- **Files modified:** 30

## Accomplishments

- Extracted every icon, token/version/scope/reason composer, marketplace header, plugin row, multi-line trailer, and standalone info-body renderer into `notification-grammar.ts` without changing output bytes.
- Kept info rendering inside the grammar owner, created no `notification-info.ts`, and left the deferred plugin-info command split untouched.
- Extracted `Sortable` and `compareByNameThenScope` into `compare-name-scope.ts`, preserving case-insensitive name ordering, project-before-user ties, exact-tie stability, and repeated-sort idempotency.
- Migrated every live production and architecture consumer directly; `notify.ts` exposes neither grammar primitives nor the comparator.
- Added one mirrored direct owner test per module. Grammar coverage is 209/209 branches, 46/46 functions, and 1618/1618 lines; comparator coverage is 8/8 branches, 1/1 function, and 22/22 lines.

## Task Commits

Each TDD task was committed with truthful RED and GREEN evidence:

1. **Task 1 RED: notification grammar owner contract** - `fe4acbd4` (test)
2. **Task 1 GREEN: exact grammar and info rendering extraction** - `be04c1ba` (feat)
3. **Task 2 RED: comparator owner contract** - `26e00932` (test)
4. **Task 2 GREEN: canonical name/scope comparator extraction** - `95cebda8` (feat)
5. **Plan fix: glyph architecture owner migration** - `d759a010` (fix)

## Files Created/Modified

- `extensions/pi-claude-marketplace/shared/notification-grammar.ts` - Owns all exact rendering vocabulary, row/header composition, trailers, cascade blocks, and info bodies.
- `tests/shared/notification-grammar.test.ts` - Locks exact bytes, closed branches, zero/many/repeated shapes, and full direct coverage.
- `extensions/pi-claude-marketplace/shared/compare-name-scope.ts` - Owns the structural minimum and canonical stable comparator.
- `tests/shared/compare-name-scope.test.ts` - Proves empty, single, unequal, equal, many, stable, and idempotent ordering.
- `extensions/pi-claude-marketplace/shared/notify.ts` - Retains notification severity, summary, dispatch, and emission only; it has no compatibility exports for the extracted owners.
- Notification render maps and sorting consumers - Import grammar or ordering behavior directly from its named owner.
- Architecture drift gates - Inspect the new canonical owner paths.

## TDD Gate Compliance

- Task 1 RED evidence: `.planning/phases/06-assertion-and-module-refinement/06-13-task-1-RED-evidence.json` passed `tdd-red-evidence`; the owner test failed because `notification-grammar.ts` was absent.
- Task 1 GREEN: the focused grammar/notify/info suite passes and direct coverage is 100% for branches, functions, and lines.
- Task 2 RED evidence: `.planning/phases/06-assertion-and-module-refinement/06-13-task-2-RED-evidence.json` passed `tdd-red-evidence`; the owner test failed because `compare-name-scope.ts` was absent.
- Task 2 GREEN: the focused comparator/notify/scope-drift suite passes and direct coverage is 100% for branches, functions, and lines.

## Decisions Made

- Notification-info rendering remains within `notification-grammar.ts`. This preserves the locked 30-module production inventory and avoids the deferred plugin-info command split.
- All moved-symbol consumers use direct imports. No compatibility export, duplicate renderer/comparator, catalog-derived expected string, or inline scope-rank ternary remains.
- Comparator exact ties return zero and rely on the runtime's stable sort, preserving caller order without adding an artificial tertiary key.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Migrated every live moved-symbol consumer**

- **Found during:** Tasks 1 and 2
- **Issue:** The plan listed representative consumers, but removing the prohibited `notify.ts` compatibility surface required every command render map and ordering caller to import the new owners directly.
- **Fix:** Repointed all grammar and comparator consumers, including plugin/import/reconcile flows and hook event routing.
- **Files modified:** Production consumers under `extensions/pi-claude-marketplace/`.
- **Verification:** Focused suites, scope-order drift, typecheck, full lint, fallow, and direct-owner searches pass.
- **Committed in:** `be04c1ba`, `95cebda8`

**2. [Rule 1 - Bug] Repointed the glyph architecture census**

- **Found during:** Plan-wide typecheck
- **Issue:** `compat-01-no-expansion.test.ts` still imported and scanned glyph declarations at the retired `notify.ts` owner path.
- **Fix:** Imported the icons from `notification-grammar.ts` and made its source path the single declaration census target.
- **Files modified:** `tests/architecture/compat-01-no-expansion.test.ts`
- **Verification:** Its focused suite, typecheck, and full repository lint pass.
- **Committed in:** `d759a010`

---

**Total deviations:** 2 auto-fixed (1 Rule 2, 1 Rule 1)
**Impact on plan:** Both fixes enforce the requested single-owner architecture; no notification byte or ordering behavior changed.

## Issues Encountered

- Full `npm test` passed 257/259 files. `tests/architecture/revalidation.test.ts` remains the pre-declared Phase 1 fixture debt and is unrelated to this plan.
- The sandbox denied the Unix-domain-socket bind in `tests/orchestrators/marketplace/add.test.ts`; its unrestricted focused rerun passed 63/63, confirming no product regression.
- The optional broken-windows append could not update `.planning/WINDOWS.md` because its rendered table already disagrees with its fenced JSON entries for row IDs 30 and 9. This pre-existing ledger-health issue did not affect execution.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Grammar and ordering are stable named leaves ready for notification summary and dispatch extraction in Plan 06-14.
- The known Phase 1 revalidation fixture debt remains intentionally deferred.

## Self-Check: PASSED

All four created owner/test files exist, and all five measured implementation commits are present in git history.

---
*Phase: 06-assertion-and-module-refinement*
*Completed: 2026-09-09*

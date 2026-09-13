---
phase: 06-assertion-and-module-refinement
plan: "27"
subsystem: notification architecture
tags: [typescript, notifications, direct-owners, preedit-ledger, hub-deletion]
requires:
  - phase: 06-assertion-and-module-refinement
    provides: Six named notification owners and migrated callers through Plan 06-26
provides:
  - Normative documentation and the sole-dispatch lint boundary point to the six genuine notification owners
  - A READY PREEDIT ledger with complete export, caller, test, gate, documentation, completeness, and dependency mapping
  - The legacy notification hub and test are deleted with no facade and zero tracked stale paths
  - Notification correspondence is green with six direct-covered owner pairs
affects: [06-28-catalog-refinement, 06-33-catalog-hub-deletion, notification-ownership, phase-06-refinement]
actuals:
  tokens: 34835
  tasks: 3
  commits: 4
plan_head_before: aafc7ce1be7080b87d593fd23c4452bde9d22e40
tech-stack:
  added: []
  patterns: [four-part repointing gate, atomic caller migration, guarded hub deletion, mirrored direct owner tests]
key-files:
  created:
    - .planning/phases/06-assertion-and-module-refinement/06-notification-PREEDIT.md
  modified:
    - docs/adr/v2-001-structured-notify.md
    - docs/competitive-analysis/pi-plugins.md
    - docs/messaging-style-guide.md
    - docs/open-closed-proof.md
    - docs/output-catalog.md
    - docs/prd/pi-claude-marketplace-prd.md
    - extensions/pi-claude-marketplace/orchestrators/plugin/info.messaging.ts
    - scripts/check-phase-06-hub-ledger.mjs
    - tests/scripts/check-phase-06-hub-ledger.test.ts
    - extensions/pi-claude-marketplace/shared/notify.ts
    - tests/shared/notify.test.ts
key-decisions:
  - "Retire notify.ts without a compatibility facade only after a fresh CodeGraph trace and the generic ledger checker report exactly Status: READY."
  - "Assign every notification responsibility to exactly one of notification-types, notification-grammar, notification-summary, notification-dispatch, redact-absolute-paths, or compare-name-scope."
  - "Rotate the generic PREEDIT checker fixture to catalog-uat.test.ts, the next live hub retained by Plans 06-28 through 06-32 and deleted by Plan 06-33."
patterns-established:
  - "A legacy hub is deleted only after exports, callers, tests, gates, documents, completeness invariants, and acyclic dependency edges have named destinations."
  - "A generic retirement gate keeps its full positive and negative contract by rotating to the next scheduled live hub after each deletion."
requirements-completed: [TREF-07, TREF-09]
coverage:
  - id: D1
    description: Normative notification ownership and the sole-dispatch lint boundary point to six genuine source-test owner pairs.
    requirement: TREF-07
    verification:
      - kind: unit
        ref: six direct owner suites plus tests/edge/notification-boundary.ts
        status: pass
      - kind: other
        ref: six direct coverage commands at 100% branch, function, and line coverage
        status: pass
      - kind: other
        ref: npx eslint extensions/pi-claude-marketplace --max-warnings=0
        status: pass
    human_judgment: false
  - id: D2
    description: The legacy notify source-test pair is deleted after a complete READY ledger, with no facade, stale path, correspondence debt, duplicate owner, missing pair, or dependency cycle.
    requirement: TREF-09
    verification:
      - kind: other
        ref: exact 06-27 PREEDIT command and full tracked-root stale census
        status: pass
      - kind: unit
        ref: npm run test:corresponding and npm run test:corresponding:negative
        status: pass
      - kind: integration
        ref: npm run test:integration
        status: pass
    human_judgment: false
duration: 13min
completed: 2026-09-09
status: complete
---

# Phase 06 Plan 27: Final Notification Ownership and Hub Deletion Summary

**Six direct-covered notification owners now replace the deleted legacy hub, backed by a complete READY graph ledger, one sanctioned dispatch boundary, and zero tracked stale paths.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-09-09T11:33:21Z
- **Completed:** 2026-09-09T11:46:19Z
- **Tasks:** 3
- **Files modified:** 12

## Accomplishments

- Repointed five normative documents and the PRD to the exact six-module notification ownership map while preserving documented output bytes and caveats.
- Moved the sole direct-output ESLint exemption to `notification-dispatch.ts`; direct `ctx.ui.notify`, console, stdout, and stderr remain forbidden elsewhere.
- Generated fresh CodeGraph evidence and a checker-validated notification PREEDIT ledger that says exactly `Status: READY` and maps 100% of exports, callers, tests, gates, documents, completeness invariants, and dependency edges.
- Deleted `shared/notify.ts` and `tests/shared/notify.test.ts` atomically with no facade or re-export, restoring a green correspondence gate and leaving zero tracked `shared/notify.ts` paths.
- Preserved all six direct owner suites at 100% branch, function, and line coverage and kept the generic hub-ledger checker's positive and negative controls intact.

## Task Commits

1. **Task 1: Repoint normative notification documents** - `9aba0b3d` (docs)
2. **Task 2: Repoint PRD and sole-dispatch lint boundary** - `3512be27` (docs)
3. **Task 3 PREEDIT deviation: Close stale ownership/checker references** - `cf0fa52f` (fix)
4. **Task 3: Retire legacy notification hub/test after READY** - `b3ff889b` (refactor)

## Files Created/Modified

- `.planning/phases/06-assertion-and-module-refinement/06-notification-PREEDIT.md` - Records the complete notification ownership and dependency proof with exact READY status.
- `docs/adr/v2-001-structured-notify.md`, `docs/competitive-analysis/pi-plugins.md`, `docs/messaging-style-guide.md`, `docs/open-closed-proof.md`, `docs/output-catalog.md` - Name the six genuine notification owners without changing output contracts.
- `docs/prd/pi-claude-marketplace-prd.md` - Aligns product requirements with the refined owner graph.
- `extensions/pi-claude-marketplace/orchestrators/plugin/info.messaging.ts` - Repoints two ownership-only comments; executable source bytes and behavior are unchanged.
- `scripts/check-phase-06-hub-ledger.mjs` - Removes the retired hub from the live-hub set and maps notification census responsibilities to their real owners.
- `tests/scripts/check-phase-06-hub-ledger.test.ts` - Rotates the generic PREEDIT fixture to the next scheduled catalog hub while preserving every acceptance and rejection assertion.
- `extensions/pi-claude-marketplace/shared/notify.ts` - Deleted empty legacy hub.
- `tests/shared/notify.test.ts` - Deleted content-free legacy pairing marker.

## PREEDIT Evidence

- Fresh `codegraph explore` output was regenerated from scratch at `/tmp/phase06-notification-preedit-codegraph.txt` and contained 24,970 bytes of symbol and call-path evidence.
- The exact Plan 06-27 PREEDIT command passed and printed `PRE-EDIT ledger READY: extensions/pi-claude-marketplace/shared/notify.ts`.
- The ledger contains exactly one `Status: READY` line and maps all six owners, all production-caller groups, all direct tests, every source-scanning/architecture/correspondence gate, all six normative documents, completeness invariants, and directed dependency edges.
- The inverse walk found no unmapped or duplicate owner, no missing source-test pair, no stale caller/reference, and no cycle.
- Before deletion, a full tracked-root census across `extensions`, `tests`, `scripts`, `docs`, and `eslint.config.js` found no in-file `shared/notify.ts` reference.
- Plan 06-28 and CodeGraph confirm `tests/architecture/catalog-uat.test.ts` remains the next live legacy hub; Plans 06-28 through 06-32 refine its owners and Plan 06-33 performs its own guarded deletion.

## Verification

- The exact Task 3 seven-file owner/boundary command passed, followed by green `npm run test:corresponding` and `npm run fallow` gates. This closes Plan 06-26's transient `wrong-import` debt.
- All six direct coverage commands passed at 100% branch, function, and line coverage: notification types (2/1/585), grammar (209/46/1618), summary (124/19/631), dispatch (46/16/423), path redaction (5/2/13), and name/scope comparison (8/1/22).
- `npm run typecheck`, full extension ESLint, `npm run lint`, `npm run test:integration` (13/13 files), and the scoped Prettier check passed.
- Ten notification architecture/edge gates passed: boundary, hooks dispatch, closed-set locks, grammar invariant, producer wire, stamp, reload agreement, scope fences/order, and hook cap.
- `npm run test:corresponding:negative` passed. Direct-coverage negative controls also passed unrestricted after their expected child-process diagnostic was suppressed by the sandbox.
- The focused Google TypeScript style review found no unsupported visibility modifier, namespace, mutable export, default export, or `var`; ESLint, Prettier, and `git diff --check` are clean for the changed source/test/checker files.
- The focused TypeScript unit-test review found all 12 checker assertions intact, including absent-category, duplicate-owner, and cycle rejection controls. No scoped `only`, `skip`, `todo`, placeholder, TODO, or FIXME marker exists.
- Aggregate attribution ran 260 files: 258 passed. `tests/orchestrators/marketplace/add.test.ts` then passed 63/63 unrestricted, leaving only the declared sealed Phase 1 `tests/architecture/revalidation.test.ts` TREF-04 through TREF-09 fixture debt unrelated to this plan.
- Both legacy files are absent. `git grep` reports zero tracked `shared/notify.ts` paths across `extensions`, `tests`, `scripts`, `docs`, and `eslint.config.js`.

## Decisions Made

- Kept the six-module ownership model explicit instead of introducing any compatibility layer.
- Treated stale PREEDIT scanner/comment ownership as a blocking correctness issue and corrected only the three authorized files before regenerating evidence.
- Used the catalog UAT hub as the generic checker's next live fixture because the upcoming plan sequence gives it the same staged-refinement and guarded-deletion lifecycle.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Corrected stale notification PREEDIT ownership references**

- **Found during:** Task 3 PREEDIT checkpoint
- **Issue:** Two ownership comments and two generic census rows still named the legacy notification hub, while the generic checker test used the hub scheduled for immediate deletion. This prevented truthful complete READY evidence and would leave the checker with a retired live-hub fixture.
- **Fix:** Repointed the comments and census rows to exact genuine owners, removed the retired hub from the live-hub set, and rotated only the generic fixture data to `tests/architecture/catalog-uat.test.ts`. All checker assertions and negative controls remain unchanged.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/info.messaging.ts`, `scripts/check-phase-06-hub-ledger.mjs`, `tests/scripts/check-phase-06-hub-ledger.test.ts`
- **Verification:** Checker unit suite, targeted ESLint/Prettier, 06-28/06-33 lifecycle inspection, fresh CodeGraph mapping, exact PREEDIT command, and tracked-root stale census all passed.
- **Committed in:** `cf0fa52f`

---

**Total deviations:** 1 auto-fixed blocking issue (Rule 3)
**Impact on plan:** The correction was necessary to make the mandatory PREEDIT evidence truthful and keep the generic checker live after deletion. It changed no executable notification behavior and did not weaken validation.

## Issues Encountered

- Repository-wide `npm run format:check` reports only unrelated existing formatting issues: untracked `.mcp.json` and two tracked `.planning/inputs/unit-test-refactor-handoff/*.mjs` files outside this plan. All scoped files covered by that script are Prettier-clean.
- Aggregate tests reproduced the declared sealed Phase 1 revalidation fixture debt and a sandbox Unix-socket denial in marketplace/add; marketplace/add passed fully unrestricted, so the only genuine aggregate red remains the sealed fixture debt.
- The optional broken-windows append could not record the deviation because `.planning/WINDOWS.md` already has table/JSON disagreements for row IDs 30 and 9. This summary remains the canonical deviation record.
- Linked-worktree Git metadata is outside the workspace-write sandbox, so commits required approved escalation while remaining on the mandated `features/refine-unit-tests` branch.

## Known Stubs

None. The retired empty hub and content-free pairing marker were deleted, and the changed checker/test files contain no placeholder or skipped behavior.

## Threat Flags

None. This plan removes a compatibility path and changes ownership documentation/checker fixtures only; it introduces no endpoint, authentication path, file-access pattern, schema, or new trust boundary. The sole output boundary and redaction owner remain enforced.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Notification ownership is fully refined into six direct-covered source-test pairs with one sanctioned dispatch boundary and no legacy path.
- Plan 06-28 can begin the catalog UAT extraction sequence; the generic PREEDIT checker now follows that live hub through its Plan 06-33 deletion checkpoint.
- The sealed Phase 1 revalidation fixture debt remains intentionally deferred and unmodified.

## Self-Check: PASSED

The summary and all four continuation commits exist, the PREEDIT ledger has exactly one READY status, both legacy files are absent, and the tracked-root stale-path census is empty.

---

_Phase: 06-assertion-and-module-refinement_
_Completed: 2026-09-09_

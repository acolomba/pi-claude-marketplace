---
phase: 06-assertion-and-module-refinement
plan: "14"
subsystem: notification architecture
tags: [typescript, notifications, summary-folding, dispatch-boundary, direct-coverage]
requires:
  - phase: 06-assertion-and-module-refinement
    provides: Notification types, exact grammar, redaction, and stable ordering from Plans 06-12 and 06-13
provides:
  - Producer-selected structural cardinality with exact severity, tally, reload, and summary folding
  - One production notification dispatch owner containing every direct Pi notify call
  - Mirrored direct tests with complete branch, function, and line coverage
affects: [notification-callers, edge-routing, hook-bridges, authentication, phase-06-refinement]
actuals:
  tokens: 125405
  tasks: 2
  commits: 4
plan_head_before: 6f39a97948223f5c8f0537fd8ad1dd5aa3c76b24
tech-stack:
  added: []
  patterns: [pure summary tuple, sole dispatch boundary, direct named owners, mirrored owner tests]
key-files:
  created:
    - extensions/pi-claude-marketplace/shared/notification-summary.ts
    - tests/shared/notification-summary.test.ts
    - extensions/pi-claude-marketplace/shared/notification-dispatch.ts
    - tests/shared/notification-dispatch.test.ts
  modified:
    - extensions/pi-claude-marketplace/shared/notify.ts
    - extensions/pi-claude-marketplace/shared/notify-context.ts
    - extensions/pi-claude-marketplace/edge/router.ts
    - eslint.config.js
key-decisions:
  - "Summary composition returns an exact notification tuple; only notification-dispatch.ts consumes that tuple at the Pi boundary."
  - "Structural cardinality is accepted from the producer and is never recomputed from rendered rows."
  - "All live dispatch consumers were repointed atomically because an interim compatibility facade would violate the locked ownership rule."
patterns-established:
  - "Summary owner: severity, tally, reload, and summary order are pure folds over typed producer facts."
  - "Dispatch owner: every direct ctx.ui.notify call and every raw/usage/diagnostic/hook entrypoint lives in notification-dispatch.ts."
requirements-completed: [TREF-07, TREF-09]
coverage:
  - id: D1
    description: Structural invocation cardinality controls tally grammar independently of rendered row count, with exact zero, one, many, severity, and reload ordering.
    requirement: TREF-07
    verification:
      - kind: unit
        ref: tests/shared/notification-summary.test.ts
        status: pass
      - kind: unit
        ref: tests/orchestrators/marketplace/autoupdate.test.ts#same-row single and plural invocation cases
        status: pass
      - kind: other
        ref: npm run test:coverage:direct -- extensions/pi-claude-marketplace/shared/notification-summary.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Notification dispatch preserves exact payload bytes, severity, call count, ordered arrays, repeated inputs, empty captures, and parallel-independent captures through one production Pi boundary.
    requirement: TREF-09
    verification:
      - kind: unit
        ref: tests/shared/notification-dispatch.test.ts
        status: pass
      - kind: architecture
        ref: tests/architecture/hooks-dispatch.test.ts and direct ctx.ui.notify source census
        status: pass
      - kind: other
        ref: npm run test:coverage:direct -- extensions/pi-claude-marketplace/shared/notification-dispatch.ts
        status: pass
    human_judgment: false
duration: 31min
completed: 2026-09-09
status: complete
---

# Phase 06 Plan 14: Notification Summary and Dispatch Owners Summary

**Producer-selected cardinality now drives byte-exact notification summaries, while one directly covered module owns every Pi notification call.**

## Performance

- **Duration:** 31 min
- **Started:** 2026-09-09T08:10:20Z
- **Completed:** 2026-09-09T08:41:02Z
- **Tasks:** 2
- **Files modified:** 48

## Accomplishments

- Extracted severity reduction, tally grammar, reload decisions, and summary composition into `notification-summary.ts`; its final direct coverage is 124/124 branches, 19/19 functions, and 631/631 lines.
- Locked structural cardinality to the producer's `single`/`plural` invocation form. One rendered row produces no tally for a single invocation and a `1 success` tally for a plural invocation; zero, one, and many plural rows remain exact.
- Extracted structured, usage, diagnostic, async-rewake, Stop-hook, raw, and context-cascade dispatch into `notification-dispatch.ts`; its direct coverage is 46/46 branches, 16/16 functions, and 423/423 lines.
- Repointed all 29 production consumers plus architecture gates directly. A production census finds eight `ctx.ui.notify` call expressions, all in `notification-dispatch.ts`.
- Preserved exact payload bytes, severity, one-call dispatch, ordered rows/arrays, empty suppression, repeated input behavior, and independent parallel captures.

## Task Commits

Each TDD task was committed with truthful RED and GREEN evidence:

1. **Task 1 RED: notification summary owner contract** - `53832e39` (test)
2. **Task 1 GREEN: severity, tally, reload, and summary extraction** - `f883bf5c` (feat)
3. **Task 2 RED: notification dispatch owner contract** - `ec2627a7` (test)
4. **Task 2 GREEN: sole dispatch owner and atomic caller migration** - `163fc6dc` (refactor)

## Files Created/Modified

- `extensions/pi-claude-marketplace/shared/notification-summary.ts` - Pure severity, tally, reload, and summary folds over typed producer facts.
- `tests/shared/notification-summary.test.ts` - Direct zero/one/many, same-row/different-cardinality, ordering, fallback, and exhaustiveness coverage.
- `extensions/pi-claude-marketplace/shared/notification-dispatch.ts` - Sole production Pi output boundary and all final dispatch entrypoints.
- `tests/shared/notification-dispatch.test.ts` - Exact legacy rendering plus direct dispatch count/order/severity and concurrency coverage.
- `extensions/pi-claude-marketplace/shared/notify.ts` and `tests/shared/notify.test.ts` - Empty, non-forwarding migration marker pair retained for the planned final deletion.
- `extensions/pi-claude-marketplace/shared/notify-context.ts` - Calls the real dispatch owner directly.
- `extensions/pi-claude-marketplace/edge/router.ts` and live notification consumers - Import dispatch entrypoints from their real owner.
- `eslint.config.js` and architecture gates - Permit direct Pi notification only in the dispatch owner.

## TDD Gate Compliance

- Task 1 RED evidence at `.planning/phases/06-assertion-and-module-refinement/06-14-task-1-RED-evidence.json` passed `tdd-red-evidence`; the direct owner test failed with `ERR_MODULE_NOT_FOUND` before `notification-summary.ts` existed.
- Task 1 GREEN passes the focused summary/notify/autoupdate suite and complete direct coverage. Cardinality assertions exercise equal rendered row counts with different invocation forms plus zero, one, and many plural outcomes.
- Task 2 RED evidence at `.planning/phases/06-assertion-and-module-refinement/06-14-task-2-RED-evidence.json` passed `tdd-red-evidence`; the direct owner test failed with `ERR_MODULE_NOT_FOUND` before `notification-dispatch.ts` existed.
- Task 2 GREEN passes the focused dispatch/legacy-marker/boundary suite, complete direct coverage, sole-boundary census, correspondence, typecheck, ESLint, Prettier, fallow, and integration gates.

## Decisions Made

- Summary composition returns either `[message]` or `[message, severity]`. This keeps all summary policy pure and makes the dispatch owner the only module that can touch the Pi UI boundary.
- Cardinality remains a structural producer fact. No summary code reads rendered row count to decide singular versus plural invocation grammar.
- Live callers moved in the same commit as the owner. The legacy hub has no exports, forwarding calls, duplicate implementation, or compatibility re-export.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Repointed every live dispatch consumer and enforcement gate atomically**

- **Found during:** Task 2
- **Issue:** Moving the dispatch exports without a prohibited forwarding facade would leave 29 production consumers uncompilable, while retaining the original implementations would create a second direct Pi boundary.
- **Fix:** Repointed every live production consumer, strict owner test, edge boundary reference, and ESLint exception to `notification-dispatch.ts` in the GREEN commit. `notify.ts` now exposes no compatibility surface.
- **Files modified:** Dispatch consumers under `extensions/pi-claude-marketplace/`, affected architecture tests, `tests/edge/notification-boundary.ts`, and `eslint.config.js`.
- **Verification:** Typecheck, full lint, focused and aggregate tests, corresponding-test gate, fallow, direct coverage, and the sole-boundary census.
- **Committed in:** `163fc6dc`

---

**Total deviations:** 1 auto-fixed (1 Rule 2)
**Impact on plan:** The additional caller edits were necessary to make the requested no-facade architecture compile and to enforce one real output boundary; observable notification behavior is unchanged.

## Issues Encountered

- The repository-wide `npm run check` reached formatting and reported the unrelated untracked `.mcp.json`; all plan-owned files pass focused Prettier checks.
- `test:coverage:direct:negative` could not spawn its child process in the sandbox (`EPERM`); its unrestricted rerun passed.
- Full `npm test` passed 259/261 files. `tests/architecture/revalidation.test.ts` remains the pre-declared Phase 1 fixture debt. `tests/orchestrators/marketplace/add.test.ts` hit the known sandbox Unix-socket restriction and passed 63/63 when rerun unrestricted.
- `npm run test:integration` passed all 13 integration files.
- The optional broken-windows append could not record the migration marker because `.planning/WINDOWS.md` already has table/JSON disagreements for row IDs 30 and 9; the stub remains recorded below.

## Known Stubs

| File | Line | Reason |
| --- | ---: | --- |
| `extensions/pi-claude-marketplace/shared/notify.ts` | 1 | Intentional empty, non-forwarding migration marker retained until the PRE-EDIT-guarded deletion in Plan 06-27; no production caller imports it. |

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Summary and dispatch now have real named owners, mirrored direct tests, complete coverage, and no live compatibility path.
- Plans 06-15 through 06-26 can treat dispatch caller repointing as already satisfied and continue with any remaining type, grammar, summary, comparator, and redaction owner imports.
- The known Phase 1 revalidation fixture debt remains intentionally deferred.

## Self-Check: PASSED

All four created owner/test files exist, and all four measured TDD implementation commits are present in git history.

---
*Phase: 06-assertion-and-module-refinement*
*Completed: 2026-09-09*

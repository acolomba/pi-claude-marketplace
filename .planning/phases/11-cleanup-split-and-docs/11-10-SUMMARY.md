---
phase: 11-cleanup-split-and-docs
plan: "10"
subsystem: reconcile-composition
tags: [typescript, dependency-injection, apply, state-locks]
requires:
  - phase: 02-apply-ordering-and-installed-declarations
    provides: deferred-pin restoration and lock-held failure reporting
provides:
  - Composition-time deferred-pin restore injection for the reconcile apply operation
  - Production-only ApplyReconcileOptions without the test restore seam
affects: [reconcile-apply, lifecycle-composition, cleanup]
actuals:
  tokens: 3439
  tasks: 2
  commits: 1
plan_head_before: 3c7654bf0ffb0b33d58e275667a5ae95b90aa1a6
plan_head_after: c8881603a7b779e54b8eb56a8919e5d1acfd108e
tech-stack:
  added: []
  patterns:
    - Test-only collaborators bind at factory composition instead of crossing request boundaries.
key-files:
  created:
    - .planning/phases/11-cleanup-split-and-docs/11-10-RED.json
  modified:
    - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts
    - test/orchestrators/reconcile/apply.test.ts
    - test/orchestrators/reconcile/types.test.ts
key-decisions:
  - Keep DeferredPinRestore limited to createApplyReconcile composition and the cascade run context.
  - Build the production restore closure from each apply request so it keeps the request cwd without widening ApplyReconcileOptions.
patterns-established:
  - Reconcile factories may accept a narrow test collaborator while request options remain production data.
requirements-completed: [CLN-01]
coverage:
  - id: D1
    description: ApplyReconcileOptions rejects deferred-pin restore injection.
    requirement: CLN-01
    verification:
      - kind: unit
        ref: test/orchestrators/reconcile/types.test.ts#ApplyReconcileOptions negative type fixture
        status: pass
    human_judgment: false
  - id: D2
    description: A factory-injected restore failure reports the lock-held row and permits later cascade steps.
    requirement: CLN-01
    verification:
      - kind: unit
        ref: test/orchestrators/reconcile/apply.test.ts#APPLY1-01 / WR-C pin restore lock-held case
        status: pass
    human_judgment: false
  - id: D3
    description: Production composition still restores a held-down record's original pin after a failed enable.
    requirement: CLN-01
    verification:
      - kind: unit
        ref: test/orchestrators/reconcile/apply.test.ts#APPLY1-01 / WR-3 restored-pin case
        status: pass
    human_judgment: false
duration: 20min
completed: 2026-10-28
status: complete
---

# Phase 11 Plan 10: Deferred-Pin Composition Summary

**Deferred-pin failure injection now belongs to reconcile composition, while production apply requests carry only runtime data and retain the real state restore.**

## Performance

- **Duration:** 20 min
- **Started:** 2026-10-28T00:12:00Z
- **Completed:** 2026-10-28T00:31:19Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Removed `restoreDeferredPin` from `ApplyReconcileOptions` and added a negative type fixture that prevents it from returning.
- Bound the optional test collaborator through `createApplyReconcile`, with the production restorer selected by default for every request.
- Kept the deterministic lock-held failure row and proved that later cascade steps still run.

## TDD Gate Compliance

### RED

The lock-held test moved its throwing restorer from the apply request to `createApplyReconcile`. Before implementation, the factory ignored that property. The target test then failed on its notification assertion because the real restore succeeded and the expected lock-held rows were absent. `.planning/phases/11-cleanup-split-and-docs/11-10-RED.json` preserves the complete TAP report. The GSD classifier returned `RED_EVIDENCE_OK`, and semantic inspection confirmed that the named target ran once and failed for the intended reason.

### GREEN

`createApplyReconcile` now selects the injected restorer or builds the production `restorePin` closure. The selected operation travels through the apply scope to the cascade run context. The focused command passed all three matching tests.

### REFACTOR

Fallow rejected a named private composition interface in an exported signature. The factory now uses the narrow inline collaborator shape, which keeps the seam factory-only and clears the private-type-leak rule.

## Task Commits

1. **Tasks 1 and 2: Pin and bind the composition-time restorer** - `c8881603` (`refactor`)

The repository hook runs direct coverage for staged source-test pairs, so it cannot accept a commit that deliberately contains the RED test without its implementation. The validated RED evidence is committed with the green source and tests instead of using `--no-verify`.

## Files Created/Modified

- `.planning/phases/11-cleanup-split-and-docs/11-10-RED.json` - Preserves the machine-validated failing TAP result.
- `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts` - Owns the factory collaborator, production default, and cascade propagation.
- `extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts` - Removes the test-only request option.
- `test/orchestrators/reconcile/apply.test.ts` - Injects the throwing restore operation at composition time.
- `test/orchestrators/reconcile/types.test.ts` - Rejects restore injection through apply request data.

## Decisions Made

- Kept the collaborator optional only on the factory input. Production composition continues to pass `{ loadState }` and receives the real restorer.
- Put the selected operation on the per-cascade run context. The failed deferred-enable step receives only the operation it needs.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] Removed a private-type leak from the exported factory**

- **Found during:** Task 2 Fallow verification
- **Issue:** A named private composition interface appeared in `createApplyReconcile`'s exported signature.
- **Fix:** Inlined the narrow reader-and-restorer shape in the factory parameter.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts`
- **Verification:** `npm run --silent fallow` and `npm run --silent check:static` passed.
- **Committed in:** `c8881603`

**2. [Rule 3 - Blocking issue] Cleared stale typed-lint failures in the owned apply module**

- **Found during:** Task commit hook
- **Issue:** Typed lint proved that two installed-result version checks in `apply.ts` were always true. They predated this plan but blocked every commit that staged the owned source file.
- **Fix:** Assigned the required version directly in the disabled-after-install and installed result rows.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts`
- **Verification:** Apply direct coverage, `npm run --silent check:static`, and the commit hook passed.
- **Committed in:** `c8881603`

**3. [Rule 3 - Workflow constraint] Combined the RED test and GREEN implementation commit**

- **Found during:** Task 1 commit preparation
- **Issue:** The repository commit hook runs the staged source-test pair and cannot accept an intentionally failing RED test. Skipping the hook is forbidden.
- **Fix:** Preserved and classified the RED report before implementation, then committed the test and implementation together through the required hook.
- **Files modified:** `.planning/phases/11-cleanup-split-and-docs/11-10-RED.json` and the four planned source-test files
- **Verification:** The evidence classifier returned `RED_EVIDENCE_OK`; the final hook passed.
- **Committed in:** `c8881603`

**Total deviations:** 3 auto-fixed (3 Rule 3)
**Impact on plan:** The request boundary and failure proof match the plan. The workflow produced one implementation commit instead of separate RED and GREEN commits, with the unchanged RED evidence retained for audit.

## Issues Encountered

- CodeGraph could not open its database in this worktree. Narrow symbol and caller searches with `rg` completed the required trace before editing.
- The worktree sits outside the sandbox's default writable root, so test caches, hooks, staging, and commits required the approved worktree permission.

## Verification

- Focused owner tests: 3 passed, 0 failed.
- Direct coverage for `orchestrators/reconcile/apply.ts`: passed.
- Direct coverage for `orchestrators/reconcile/types.ts`: passed.
- `npm run --silent fallow`: passed after the private-type fix.
- `npm run --silent check:static`: passed.
- Repository commit hook, including `npm run check:commit`: passed.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

The deferred-pin test seam is closed on the public request type. No install-flow or Phase 10-owned file changed.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. The test collaborator stays on the factory boundary and production uses the real state restorer.

## Self-Check: PASSED

- Implementation commit `c8881603` is an ancestor of the plan head.
- The RED evidence and all four planned source-test files exist.
- Summary coverage metadata classified all three deliverables as automatically covered.
- The focused tests, direct coverage, Fallow, static gate, and commit hook passed.

---

*Phase: 11-cleanup-split-and-docs*
*Completed: 2026-10-28*

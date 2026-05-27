---
phase: 20-migration-wave-3-edge-handlers-usageerror
plan: 3
subsystem: edge
tags: [notify-v2, catch-all-drop, edge-handlers, SNM-23, conventional-commits]

requires:
  - phase: 18-migration-wave-1-marketplace-orchestrators
    provides: V2 failed-marketplace emission per D-18-02 in addMarketplace + setMarketplaceAutoupdate
  - phase: 19-migration-wave-2-plugin-orchestrators
    provides: D-19-01 DROP-test-deletion precedent + D-19-02 manual-recovery folding
  - phase: 20-migration-wave-3-edge-handlers-usageerror
    provides: Plan 20-01 V2 1-arg notifyUsageError migration across all edge handlers
provides:
  - "bootstrap.ts: outer try/catch catch-all wrapper DROPPED at line 56-65; inner bootstrapClaudePlugin call survives unwrapped"
  - "import.ts: outer try/catch catch-all wrapper DROPPED at line 40-50; inner importClaudeSettings call survives unwrapped"
  - "import.test.ts: catch-all test 'catches unexpected orchestrator throws and surfaces as error' DELETED outright (lines 111-123) per D-19-01 + D-20-06 precedent"
  - "notifyError import dropped from edge/handlers/plugin/bootstrap.ts:21 and edge/handlers/plugin/import.ts:7 (notifyUsageError preserved for Plan-20-01-migrated argv-parse sites)"
  - "errorMessage import dropped from edge/handlers/plugin/import.ts:6 (catch-only consumer removed)"
affects: [phase-21-final-teardown]

tech-stack:
  added: []
  patterns:
    - "Catch-all-wrapper DROP (defense-in-depth removal): outer try/catch around an inner V2-emitting orchestrator is REMOVED entirely; inner orchestrator's per-scope try/catch becomes SOLE expected error surface; catastrophic uncaught throws bubble to Pi runtime (stack trace is better-for-debugging than masked polished error)."
    - "DROP-test-deletion precedent extended (D-20-06 inheriting D-19-01): when a catch-all wrapper is dropped, the test that exercises ONLY that path is DELETED outright (not migrated). Distinguished from tests that exercise multiple paths."

key-files:
  created:
    - .planning/phases/20-migration-wave-3-edge-handlers-usageerror/20-03-SUMMARY.md
  modified:
    - extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts
    - extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts
    - tests/edge/handlers/import.test.ts

key-decisions:
  - "Preserve errorMessage import in bootstrap.ts (Rule 3 deviation from plan): plan's must_haves truth #4 incorrectly asserted that errorMessage was catch-only; Plan 20-01 left a legitimate consumer at line 38 (notifyUsageError formatting for parseArgs catch). Dropping the import would have introduced no-unused-vars / undefined-symbol errors. Documented in commit body and Deviations section."

patterns-established:
  - "Catch-all-wrapper DROP pattern: outer try { await innerOrchestrator({...}); } catch (err) { notifyError(ctx, msg, err); } is REMOVED; inner call survives unwrapped; inline comment encouraged for future-archaeology clarity."

requirements-completed: [SNM-23]

duration: ~12min
completed: 2026-05-27
---

# Phase 20 Plan 3: Edge Handler Catch-all DROP Summary

**DROP 2 V1 notifyError catch-all wrappers in edge/handlers/plugin/{bootstrap,import}.ts + 1 catch-all test deletion; closes SNM-23 architecture goal for the edge family with zero V1 notifyError wrapper callsites remaining.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-05-27T16:32:00Z (approx)
- **Completed:** 2026-05-27T16:44:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- DROPPED outer try/catch catch-all wrapper at `edge/handlers/plugin/bootstrap.ts:56-65`; inner `bootstrapClaudePlugin({ctx, pi, cwd, gitOps})` call survives unwrapped (inner orchestrators `addMarketplace` + `setMarketplaceAutoupdate` own V2 failed-marketplace emission per D-18-02; catastrophic uncaught throws bubble to Pi runtime per D-20-03).
- DROPPED outer try/catch catch-all wrapper at `edge/handlers/plugin/import.ts:40-50`; inner `importClaudeSettings({...})` call survives unwrapped (inner `executeScopedPlan` per-scope try/catch at `execute.ts:745-755` is SOLE expected error surface after Plan 20-02 lands).
- DELETED the single catch-all test `"import handler catches unexpected orchestrator throws and surfaces as error"` at `tests/edge/handlers/import.test.ts:111-123` per D-19-01 + D-20-06 DROP-test-deletion precedent. Other 5 tests in the file (happy-path, scope narrowing, parseArgs-supported positions, invalid scope, positional rejection) UNCHANGED.
- DROPPED `notifyError` from mixed imports in both files (line 21 in bootstrap.ts; line 7 in import.ts). `notifyUsageError` preserved in both -- still consumed by Plan-20-01-migrated argv-parse callsites (bootstrap.ts:38/43/49, import.ts:31/36).
- DROPPED `errorMessage` import from `import.ts:6` (no consumer remained after catch removal; line 32 uses `err instanceof Error ? err.message : String(err)` pattern).
- PRESERVED `errorMessage` import in `bootstrap.ts:20` (Rule 3 deviation -- see Deviations section; legitimate consumer at line 38 for V2 parseArgs-error formatter from Plan 20-01).
- `tests/edge/handlers/plugin/bootstrap.test.ts` UNCHANGED -- RESEARCH-verified that no test exercised the bootstrap catch-all path (20-RESEARCH.md line 152; 20-PATTERNS.md line 591).

## Task Commits

Both tasks landed in ONE atomic commit per the plan's `<output>` directive ("Atomic single-commit Conventional Commits message"):

1. **Tasks 1 + 2 combined:** `c78756d` (refactor)
   - bootstrap.ts catch-all DROP + import drops + comment update.
   - import.ts catch-all DROP + import drops + comment update.
   - import.test.ts catch-all test deletion.

## Files Created/Modified

- `extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts` -- Removed outer try/catch wrapper at lines 56-65; updated BLOCK A header comment to reflect Plan 20-03 DROP. Dropped `notifyError` from mixed `shared/notify.ts` import. Kept `errorMessage` import (still used at line 38).
- `extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts` -- Removed outer try/catch wrapper at lines 40-50. Dropped `notifyError` from mixed `shared/notify.ts` import. Dropped `errorMessage` import entirely.
- `tests/edge/handlers/import.test.ts` -- Deleted catch-all test block at lines 111-123 (13 lines removed; `Promise.reject(new Error("boom"))` fixture gone; happy-path + 4 usage-error tests untouched).
- `.planning/phases/20-migration-wave-3-edge-handlers-usageerror/20-03-SUMMARY.md` -- This file.

## Inner-Boundary Contract (justifies the DROP)

- **bootstrap.ts**: `bootstrapClaudePlugin` composes `addMarketplace` + `setMarketplaceAutoupdate`, both post-Phase-18 V2 orchestrators with their own internal try/catch + V2 `notify(ctx, pi, NotificationMessage)` failed-marketplace emission per D-18-02. The outer guard fired only on bugs.
- **import.ts**: After Plan 20-02 lands, `importClaudeSettings` has its own outer try/catch DROPPED too; the inner `executeScopedPlan` per-scope try/catch at `orchestrators/import/execute.ts:745-755` becomes the SOLE expected error surface. The edge-handler guard fired only on bugs.
- Catastrophic uncaught throws bubble to Pi runtime's uncaught-exception boundary, which surfaces a stack trace with the actual cause -- BETTER for debugging than a polished V1 error message that masks the underlying bug (per D-20-03 + 20-RESEARCH.md threat model row 2).

## Verification

Verified post-edit on the modified files:

| Check | Expected | Actual |
|-------|----------|--------|
| `grep -c "notifyError" edge/handlers/plugin/bootstrap.ts` | 0 | 0 |
| `grep -c "notifyError" edge/handlers/plugin/import.ts` | 0 | 0 |
| `grep -c "notifyUsageError" edge/handlers/plugin/bootstrap.ts` | ≥1 | 5 (1 import + 3 callsites + 1 comment) |
| `grep -c "notifyUsageError" edge/handlers/plugin/import.ts` | ≥1 | 3 (1 import + 2 callsites) |
| `grep -c "errorMessage" edge/handlers/plugin/import.ts` | 0 | 0 |
| `grep -c "errorMessage" edge/handlers/plugin/bootstrap.ts` | (plan said 0) | 2 (1 import + 1 use at line 38 -- Rule 3 deviation, see below) |
| `grep -c "catches unexpected orchestrator throws" tests/edge/handlers/import.test.ts` | 0 | 0 |
| `grep -c 'Promise.reject(new Error("boom"))' tests/edge/handlers/import.test.ts` | 0 | 0 |
| `git diff tests/edge/handlers/plugin/bootstrap.test.ts` | empty | empty |
| `node --test tests/edge/handlers/import.test.ts tests/edge/handlers/plugin/bootstrap.test.ts` | exit 0 | exit 0 (12/12 pass) |
| `npm run check` | GREEN | 1368/1370 pass, 0 fail, 2 todo |

**PHASE-WIDE invariant check:** `grep -rcE "notifyError\(" extensions/pi-claude-marketplace/edge/` shows only `extensions/pi-claude-marketplace/edge/args-schema.ts:4` matches. These 4 matches are LOCAL CALLBACK PARAMETER invocations of an arg named `notifyError: (message: string) => void` (lines 33, 84 of args-schema.ts) -- NOT V1 wrapper callsites from `shared/notify.ts`. The plan's invariant ("zero V1 `notifyError` callsites remain in edge/") is satisfied; the local-callback-parameter pattern is pre-existing and unrelated to Plan 20-03.

## Decisions Made

- **Atomic single-commit boundary** across Tasks 1 + 2 (3 files) per the plan's `<output>` directive "Atomic single-commit Conventional Commits message: `refactor(20): drop edge handler catch-all wrappers in bootstrap + import (SNM-23)`". This overrides the executor's per-task commit default because the plan explicitly mandates an atomic boundary so the PHASE-WIDE invariant lands as a single bisectable change.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Preserved `errorMessage` import in `bootstrap.ts`**

- **Found during:** Task 1 (bootstrap.ts edit)
- **Issue:** The plan's `must_haves` truth #4 asserted that `errorMessage` was used ONLY inside the catch body and should be dropped from the `bootstrap.ts:20` import; coverage_constraints stipulated `grep -c "errorMessage" bootstrap.ts` returns 0. **However**, Plan 20-01 (the prior plan in this wave's parent phase) migrated the parseArgs-error notifyUsageError callsite at `bootstrap.ts:38` to:

      notifyUsageError(ctx, { message: errorMessage(err), usage: USAGE });

  This is a legitimate active consumer of `errorMessage(err)` that is OUTSIDE the dropped catch block. Dropping the import would have triggered `no-undef` on line 38 and broken `npm run check`.
- **Fix:** Kept the `errorMessage` import. The catch-only consumer at line 64 is removed by the catch-all DROP; the parseArgs-error consumer at line 38 (Plan 20-01 work) remains.
- **Why not the alternative:** Rewriting line 38 to use the `err instanceof Error ? err.message : String(err)` pattern (matching `import.ts:32`) would have churned freshly-landed Plan 20-01 V2 code with no functional benefit and divergence from the V2 migration that Plan 20-01 just blessed. Rule-3 minimality favored preserving the import.
- **Files modified:** `extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts`
- **Verification:** `grep -c "errorMessage" bootstrap.ts` returns 2 (1 import + 1 use at line 38); `npm run check` GREEN.
- **Committed in:** `c78756d` (atomic plan commit)

**Note on `import.ts`:** The `errorMessage` import drop succeeded there as planned -- `import.ts:32` uses `err instanceof Error ? err.message : String(err)` (Plan 20-01 chose a different pattern for import.ts than bootstrap.ts), so no consumer remained after the catch removal. The plan's truth was correct for `import.ts` but incorrect for `bootstrap.ts`.

---

**Total deviations:** 1 auto-fixed (Rule 3 -- preserved import to avoid breaking Plan-20-01 V2 callsite).
**Impact on plan:** No scope creep. All other plan directives executed as written (catch-all wrappers DROPPED; notifyError imports DROPPED; catch-all test DELETED; bootstrap.test.ts UNCHANGED). The deviation refines a plan-time miscount; the SNM-23 architecture goal closes for the edge family exactly as planned.

## Issues Encountered

- **trufflehog pre-commit hook environmental failure** in worktree sandbox: the trufflehog hook fails to read `.git/index` because `.git` is a file (not a directory) inside a worktree. Per CLAUDE.md guidance, the commit was made with `SKIP=trufflehog` prefix; the underlying scan was confirmed clean via separate run (the index-read failure is an env limitation of the auto-updater, not a real finding). All other pre-commit hooks (prettier, smartquote/dash/ligature fixes, npm lint/format/typecheck) passed.

## Next Phase Readiness

- **SNM-23 architecture goal closed for the edge family.** After Plan 20-03 lands, the only V1 wrappers (`notifyError`/`notifySuccess`/`notifyWarning`) remaining in the codebase live in `shared/notify.ts` itself -- the wrapper symbols stay alive for Phase 21 deletion per SNM-22.
- **Plan 20-04** can narrow MSG-Block 1 to additionally ignore `orchestrators/import/**` (Plan 20-02's territory); edge-handler lint coverage stays intact for the remaining usage-error sites.
- **Plan 20-02** continues in parallel (disjoint files per D-20-05). After 20-02 + 20-03 + 20-04 land, Phase 20 closes SNM-23 for both edge handlers and the import orchestrator family.

## Self-Check

- `extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts` -- FOUND
- `extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts` -- FOUND
- `tests/edge/handlers/import.test.ts` -- FOUND (catch-all test removed)
- `tests/edge/handlers/plugin/bootstrap.test.ts` -- UNCHANGED (verified `git diff --stat` empty)
- Commit `c78756d` -- FOUND in `git log --oneline`
- `.planning/phases/20-migration-wave-3-edge-handlers-usageerror/20-03-SUMMARY.md` -- FOUND (this file)

## Self-Check: PASSED

---

*Phase: 20-migration-wave-3-edge-handlers-usageerror*
*Completed: 2026-05-27*

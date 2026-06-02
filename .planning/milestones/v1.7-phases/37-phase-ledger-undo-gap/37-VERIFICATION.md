---
phase: 37
slug: phase-ledger-undo-gap
status: passed
verified: 2026-06-02
must_haves_passed: 5/5
---

# Phase 37: Phase-Ledger Undo Gap (TR-02) Verification Report

**Phase Goal:** `runPhases` in `transaction/phase-ledger.ts` correctly invokes the
failing phase's own `undo` before walking `executed[]` in reverse, so every phase
whose `do` throws gets exactly one compensation call -- not zero (pre-fix bug) and
not two (over-correction pitfall).

**Verified:** 2026-06-02
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| #   | Truth (Success Criterion) | Status     | Evidence |
| --- | ------------------------- | ---------- | -------- |
| SC#1 | In `runPhases`, on `phase.do(ctx)` throw, the failing phase's `undo(ctx)` is called exactly once from the catch block BEFORE `rollbackExecuted(executed, ctx)`; `executed[]` does NOT contain the failing phase | ✓ VERIFIED | phase-ledger.ts:157-165 -- `executed.push(phase)` (line 158) sits AFTER `await phase.do(ctx)` (line 157), so a throw skips the push. Catch block at line 164 calls `await invokeFailingPhaseUndo(phase, ctx)` BEFORE line 165 `await rollbackExecuted(executed, ctx)`. Regression test "TR-02 runPhases: failing-phase undo runs BEFORE reverse-walk, exactly once each" (phase-ledger.test.ts:316-365) asserts the exact trace `["do:p0", "do:p1", "do:p2", "undo:p2", "undo:p1", "undo:p0"]` -- failing-phase undo first, then reverse walk, each exactly once. Test PASSES under `npm run check`. |
| SC#2 | `Phase<C>.undo` JSDoc documents that undo must tolerate being called after a partial-do throw | ✓ VERIFIED | phase-ledger.ts:26-34 contains the amended JSDoc on the `Phase<C>` interface: "`undo` MUST tolerate being called after a partial-do throw -- it cannot assume `do` ran to completion; gate on context-set sentinels (cf. install.ts:481-492, :514-523, :560-572, :590-600) and keep bridge cleanup helpers ENOENT-tolerant." `grep -cE "tolerate"` returns 1 (≥1 expected); `grep -cE "partial-do"` returns 1 (≥1 expected). |
| SC#3 | `PathContainmentError` from the failing phase's `undo` re-throws immediately, matching the existing discipline at `phase-ledger.ts:84-86` | ✓ VERIFIED | The PI-14 discipline is present at BOTH undo-invocation sites: `rollbackExecuted` (lines 89-91) and the new `invokeFailingPhaseUndo` helper (lines 125-127). `grep -cE "if \(undoErr instanceof PathContainmentError\)"` returns exactly 2 (expected 2). Regression test "PI-14 runPhases: PathContainmentError from FAILING phase's own undo is RE-THROWN" (phase-ledger.test.ts:367-385) asserts `runPhases` REJECTS with a PathContainmentError when the failing phase's own undo throws one. Test PASSES. |
| SC#4 | A regression test asserts the exact undo-call sequence for a 3-phase ledger where phase 2 throws: phase2.undo, then phase1.undo, phase0.undo -- each invoked exactly once | ✓ VERIFIED | Test "TR-02 runPhases: failing-phase undo runs BEFORE reverse-walk, exactly once each" (phase-ledger.test.ts:316-365) IS that regression test: 3-phase ledger `[p0, p1, p2]` with all three having `do`+`undo`; p2.do throws; assert.deepEqual on ctx.trace locks `["do:p0", "do:p1", "do:p2", "undo:p2", "undo:p1", "undo:p0"]`. Additionally, "AS-4 runPhases: failing-phase undo failure is FIRST in rollbackPartials[]" (phase-ledger.test.ts:387-409) locks the AS-4 prepend ordering: `partials[0].phase === "p2"`, `partials[1].phase === "p1"`, `partials[2].phase === "p0"`. Both tests PASS. |
| SC#5 | `npm run check` GREEN; existing install/uninstall/reinstall tests unchanged | ✓ VERIFIED | `npm run check` exits 0 end-to-end: typecheck OK, ESLint OK, Prettier OK ("All matched files use Prettier code style!"), test suite 1346/1346 GREEN, 0 fail, 0 cancelled, 0 skipped. Targeted run of `tests/orchestrators/plugin/{install,uninstall,reinstall}.test.ts` reports 125/125 GREEN. The 10 pre-existing phase-ledger tests are byte-unchanged (lines 43-307); only the 3 new TR-02 tests were appended after line 307. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `extensions/pi-claude-marketplace/transaction/phase-ledger.ts` | runPhases catch-block restructure invoking failing-phase undo before rollbackExecuted; Phase<C>.undo JSDoc amended; PathContainmentError re-throw at new call site | ✓ VERIFIED | 173 lines; contains the amended `Phase<C>` JSDoc (lines 26-34), the new `invokeFailingPhaseUndo` helper (lines 109-135), and the restructured `runPhases` catch block (lines 159-168) with failing-phase undo BEFORE reverse walk, prepend ordering, and `original` error preservation. Imports `PathContainmentError` from `../shared/path-safety.ts` (line 24). |
| `tests/transaction/phase-ledger.test.ts` | Three new regression tests appended (TR-02 sequence, PI-14 failing-phase-undo re-throw, AS-4 newest-first ordering) | ✓ VERIFIED | 410 lines; pre-existing 10 tests at lines 43-307 byte-unchanged; three new tests appended at lines 316-365 (TR-02 sequence), 367-385 (PI-14 failing-phase undo re-throw), and 387-409 (AS-4 newest-first ordering). All three PASS under `npm run check`. Imports `runPhases`, `type Phase`, `PathContainmentError` (lines 4-8 unchanged). |

### Key Link Verification

| From | To  | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `phase-ledger.ts` (invokeFailingPhaseUndo) | `shared/path-safety.ts` (PathContainmentError) | PathContainmentError re-throw at the new failing-phase undo catch site | ✓ WIRED | Line 24 imports `PathContainmentError`; lines 125-127 inside `invokeFailingPhaseUndo` mirror the rollbackExecuted PI-14 re-throw at lines 89-91 byte-for-byte. Regression test at phase-ledger.test.ts:367-385 confirms behavior. |
| `tests/transaction/phase-ledger.test.ts` | `extensions/pi-claude-marketplace/transaction/phase-ledger.ts` | Imports `runPhases` and `type Phase` | ✓ WIRED | Lines 5-8 import `runPhases, type Phase` from the source module; all 13 phase-ledger tests exercise the imported `runPhases` directly. |
| `runPhases` catch block | `invokeFailingPhaseUndo` and `rollbackExecuted` (sequencing) | Failing-phase undo runs FIRST (line 164), reverse walk SECOND (line 165), failing-partial PREPENDED into rollbackPartials (line 167) | ✓ WIRED | Sequencing is explicit and visible at lines 164-167. `[failingPartial, ...reversePartials]` is the AS-4 newest-first ordering. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |

No debt markers (`TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER`) found in either modified file. No empty-implementation stubs. No hardcoded empty data flowing to consumers.

### Executor Deviation Audit (per verification request)

The executor extracted `invokeFailingPhaseUndo<C>()` as a private helper at
phase-ledger.ts:109-135 instead of inlining the failing-phase undo try/catch
directly in `runPhases`'s catch block (as PLAN Task 2 directed and as RESEARCH
Open Question 1 RESOLVED recommended).

**Justification (per SUMMARY.md "Deviations from Plan"):** The inlined shape
failed `sonarjs/cognitive-complexity` with score 22 > allowed 15 (hard NFR-6
gate). NFR-6 ("`npm run check` must stay GREEN") is a project-level constraint
that overrides the plan's "<=160 lines" file-size sanity check.

**Verification of deviation:**

| Concern | Check | Result |
| ------- | ----- | ------ |
| PI-14 discipline preserved in BOTH `rollbackExecuted` AND `invokeFailingPhaseUndo` | `grep -cE "if \(undoErr instanceof PathContainmentError\)"` returns 2 (one at line 89 in rollbackExecuted; one at line 125 in invokeFailingPhaseUndo). Both immediately `throw undoErr;` without folding into a RollbackPartial. | ✓ PRESERVED |
| AS-4 PREPEND ordering `[failingPartial, ...reversePartials]` | phase-ledger.ts:166-167: explicit conditional `failingPartial === undefined ? reversePartials : [failingPartial, ...reversePartials]`. Test "AS-4 runPhases: failing-phase undo failure is FIRST in rollbackPartials[]" (phase-ledger.test.ts:387-409) asserts `partials[0].phase === "p2"`, `partials[1].phase === "p1"`, `partials[2].phase === "p0"`. PASSES. | ✓ CORRECT |
| Deviation documented in SUMMARY.md | SUMMARY.md "Deviations from Plan" → "Auto-fixed Issues" section explicitly documents the extraction, the cognitive-complexity score (22 > 15), the rationale (NFR-6 hard gate), the impact (173 lines vs ≤160 target), and the fact that the structural intent ("failing-phase undo is a SEPARATE call site") is preserved by the helper. | ✓ DOCUMENTED |
| `npm run check` GREEN proves NFR-6 gate satisfied | `npm run check` exits 0; full output shows typecheck OK + lint OK + format:check OK + 1346/1346 tests GREEN. | ✓ GREEN |

**Verdict on deviation:** Accepted. The helper extraction does not change the
structural invariant the plan was protecting (the failing-phase undo is still a
SEPARATE call site, distinct from `rollbackExecuted`); it preserves PI-14
discipline at both call sites; it satisfies the hard NFR-6 lint gate. The
`<=160 lines` criterion was a sanity check, not a correctness requirement.

### Static Verification Grep Results

| Check | Expected | Actual | Status |
| ----- | -------- | ------ | ------ |
| `grep -cE "if \(undoErr instanceof PathContainmentError\)" extensions/pi-claude-marketplace/transaction/phase-ledger.ts` | 2 | 2 | ✓ |
| `grep -cE "tolerate" extensions/pi-claude-marketplace/transaction/phase-ledger.ts` | ≥1 | 1 | ✓ |
| `grep -cE "partial-do" extensions/pi-claude-marketplace/transaction/phase-ledger.ts` | ≥1 | 1 | ✓ |
| `grep -cE "executed\.push\(phase\)" extensions/pi-claude-marketplace/transaction/phase-ledger.ts` | 1 (AFTER `await phase.do(ctx)`) | 1, at line 158, AFTER `await phase.do(ctx)` at line 157 | ✓ |
| `wc -l extensions/pi-claude-marketplace/transaction/phase-ledger.ts` | ≤160 (plan target) | 173 | ⚠️ exceeds plan sanity target by 13 lines; documented and justified by NFR-6 lint gate (cognitive-complexity). NOT a correctness gap. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Full project check (typecheck + lint + format + tests) | `npm run check` | Exit 0; 1346 tests pass, 0 fail; "All matched files use Prettier code style!" | ✓ PASS |
| Targeted phase-ledger test file | (covered by `npm run check`) | All 13 phase-ledger tests GREEN (10 pre-existing + 3 new TR-02) | ✓ PASS |
| Targeted install/uninstall/reinstall regression | `node --test tests/orchestrators/plugin/{install,uninstall,reinstall}.test.ts` | 125 pass, 0 fail (SC#5 regression preservation) | ✓ PASS |
| Two phase commits exist on feature branch | `git log --oneline -10` | `0ea1134` (test commit) and `15c0e68` (fix commit) present on `features/transaction-resilience-hardening` | ✓ PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` probes are declared for this phase. PLAN
verification is `npm run check` + targeted `node --test` runs, both executed
above. SKIPPED -- no probes applicable.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| TR-02 | 37-01-FIX-PHASE-LEDGER-PLAN.md | `runPhases` invokes the failing phase's own `undo` before reverse-walking `executed[]`; failing phase's undo called exactly once as a separate catch-block call site, never via `executed[]` addition (prevents double-rollback); Phase interface JSDoc documents undo must tolerate being called after a partial-do throw | ✓ SATISFIED | All five sub-criteria (SC#1..SC#5) verified PASS above. Code at phase-ledger.ts:153-173 implements the contract; tests at phase-ledger.test.ts:316-409 lock it. |

No orphaned requirements -- REQUIREMENTS.md line 99 maps TR-02 → Phase 37 only,
and Phase 37 has exactly one plan (37-01) which claims TR-02.

### Human Verification Required

None. All five Success Criteria, the executor deviation audit, the requirements
coverage, and the regression-preservation checks were verifiable
programmatically via the modified source/test files plus `npm run check`. The
fix is a structural in-memory control-flow change with deterministic
test-locked behavior; no UX, real-time, or external-service concerns apply.

### Gaps Summary

No gaps. The phase goal is achieved:

- `runPhases` invokes the failing phase's own `undo` from a separate catch-block
  call site BEFORE `rollbackExecuted`, exactly once per phase (verified by SC#1
  + test "TR-02 runPhases: failing-phase undo runs BEFORE reverse-walk").
- `executed[]` does NOT contain the failing phase (`executed.push(phase)` at
  line 158 is AFTER `await phase.do(ctx)` at line 157, so a partial-do throw
  skips the push).
- `PathContainmentError` re-throws immediately at the new call site, mirroring
  the existing PI-14 discipline (verified by grep count 2 + test "PI-14
  runPhases: PathContainmentError from FAILING phase's own undo is RE-THROWN").
- AS-4 newest-first ordering preserved: failing-phase RollbackPartial is at
  index 0, reverse-walk partials follow (verified by test "AS-4 runPhases:
  failing-phase undo failure is FIRST in rollbackPartials[]").
- `Phase<C>.undo` JSDoc documents the partial-do tolerance contract (grep
  matches for `tolerate` and `partial-do`).
- `npm run check` GREEN: 1346/1346 tests pass; install/uninstall/reinstall
  regression preserved (125/125 GREEN).
- Executor deviation (helper extraction over inlining) is justified by NFR-6
  cognitive-complexity gate, documented in SUMMARY.md, and preserves the
  structural invariant the plan was protecting.

---

## VERIFICATION PASSED

_Verified: 2026-06-02_
_Verifier: Claude (gsd-verifier)_

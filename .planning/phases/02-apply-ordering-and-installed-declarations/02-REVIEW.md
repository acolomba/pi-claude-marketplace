---
phase: 02-apply-ordering-and-installed-declarations
reviewed: 2026-10-27T09:30:46Z
depth: standard
files_reviewed: 27
files_reviewed_list:
  - extensions/pi-claude-marketplace/edge/handlers/marketplace/add.ts
  - extensions/pi-claude-marketplace/edge/handlers/marketplace/update.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts
  - extensions/pi-claude-marketplace/edge/register.ts
  - extensions/pi-claude-marketplace/edge/types.ts
  - extensions/pi-claude-marketplace/index.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/add.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/bootstrap.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-declaration-read.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-constraint-gate.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/convergence.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/dependency-verdict.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/read-pass.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts
  - extensions/pi-claude-marketplace/orchestrators/types.ts
  - features/marketplace/add.feature
  - features/plugin/apply.feature
  - features/plugin/bootstrap.feature
  - features/plugin/enable.feature
  - features/plugin/update-dependencies.feature
findings:
  critical: 0
  warning: 0
  info: 6
  total: 6
status: clean
---

# Phase 2: Code Review Report

**Reviewed:** 2026-10-27T09:30:46Z
**Depth:** standard
**Files Reviewed:** 27
**Status:** clean (Info items only)

## Narrative Findings (AI reviewer)

## Summary

This is the third review of the phase diff `d98660a7..HEAD`. It focuses on the round-2 fix commits `9dfddcd0..HEAD` (e852f3d7, 2a3fbc1b, 6dc34113), which answer WR-02, WR-07 and WR-08 of `02-REVIEW.iter3.md`. I do not report the recorded decisions D-PL2-01..16, the SUMMARY "Uncertain choices", or the gaps the fixer named as out of scope as defects. Those gaps are listed below as Info.

Status of the previous findings:

| ID | Status | Notes |
|----|--------|-------|
| WR-02 | Fixed | `bootstrapClaudePlugin` wraps a post-commit step throw in `BootstrapStepError` (`orchestrators/plugin/bootstrap.ts:77-82,165-167`) after autoupdate has run. The handler rethrows `err.cause` (`edge/handlers/plugin/bootstrap.ts:87-89`), so `(failed)` no longer contradicts `(added)`. A GHB-03 cause is still rethrown first: `rethrowInvalidGitHubBaseUrl` walks the cause chain (`shared/errors.ts:1042-1048`). This is the same surface `marketplace add` uses. The rows of dependencies installed before the throw are still lost; the fixer named this gap, and it is IN-05. |
| WR-07 | Fixed | One rule now drives both commands: `movesAfterInstalls` / `stepsAfterInstalls` (`convergence.ts:758-807`). `composePendingReport` computes the set from the same cascade (`pending.ts:464-478`), leaves those moves out of `convergence.moves`, and lists them after the `will install` rows (`notify.ts:325-347,813-814`). The WR-06 scenario now asserts `pending` rows `cdep, alib, bapp` against `apply` rows `cdep, alib, bapp` (`apply.feature:1323-1381`). |
| WR-08 | Fixed | `runCascade` and `runAfterInstallSteps` share `runSteps` (`apply.ts:1560-1577`). A blocked non-waiting step after the install now goes into `failed.all` and pushes the replaceable `(skipped) {dependency failed}` report into `after.steps`. `cascadeRows` runs `reportRows` over those reports with the same `byKey`, so the judgement's `(disabled)` row still replaces it in place (`apply.ts:1930-1948`). `withoutUndoneStepEnables` keeps WR-B for the after-install reports. Covered by the new scenario at `apply.feature:1383-1427`. |
| IN-01..IN-04 | Not attempted (critical_warning scope) | Carried over unchanged. |

I checked the shared deferral seam and the earlier shapes, and found no regression in these:

- **Disjoint keys.** `cascadeSteps` leaves every `afterInstalls` key out of both `moved` and `alone` (`apply.ts:1510,1517`). `deferredEnables` and `enablesAfterInstalls` are disjoint (`convergence.ts:1030-1032`). So no step runs twice, and no key reaches both `reports` and `after.steps`. `dependenciesFirst` therefore never collapses two steps that share a key.
- **Pending matches the deferral.** `preview` already drops the enable of a deferred record that moves (`convergence.ts:1020-1026`). A non-waiting deferred move that is pulled after the install lists exactly one `will update` row, which carries its deferred enable (`stepsAfterInstalls`' `waited`). A waiting record lists one row, in the place where `apply` reports its single `(updated)` or `(enabled)` row.
- **Same cascade in both commands.** `pending`'s fallback `planConvergenceCascade(..., plan: settled.plan)` (`pending.ts:453-456`) plans without the waiting enables. It runs only when `settleMoveCascade` produced no cascade. A waiting record's dependents are always `releasableDependents` (their only blocking entries are scheduled `missing` ones), so a non-empty `enablesAfterInstalls` implies a defined `settled.cascade`. `pending` and `apply` therefore plan the waiting records' moves from the same view.
- **MISSORDER-01, PENDMOVE-01 and the WR-06 shapes.** Their unit cases and scenarios pass. The convergence, pending, notify and bootstrap suites pass on HEAD under a hermetic `HOME`. `movesAfterInstalls` seeds only from waiting records that have a move, so the MISSORDER shape (a dependency move in the cascade, then the install, then the waiting enable) keeps its order.
- **Read-failure paths.** If the read after the moves fails (`apply.ts:1319-1321`), the deferred steps run nowhere and report nothing besides the `state.json` row. The next `apply` retries them (NFR-3). If the second read fails, `enables` is empty, every waiting key with a move is `notLanded`, and each deferred dependent reports `(skipped) {dependency failed}`. Both outcomes are acceptable.

## Info

### IN-01 (carried over): The update-constraint seam field name points to the catalog walk while it is bound to the installed-copy walk

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-constraint-gate.ts:52,89`
**Issue:** Unchanged. `UpdateConstraintSeam.buildScopeDeclarationDetail` is typed and bound as `buildInstalledScopeDeclarationDetail`. A reader or a test double will assume the catalog-first walk.
**Fix:** Rename the field to `buildInstalledScopeDeclarationDetail`, or to a neutral name, and update the doubles.

### IN-02 (carried over): An unwrapped 135-character comment line

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/dependency-verdict.ts:39`
**Issue:** Unchanged. Prettier does not reflow comments.
**Fix:** Re-wrap the paragraph to the block's width.

### IN-03 (carried over): The autoupdate step runs a full locked read on every autoupdated `marketplace update`, and a refusal that persists turns a no-op into `(updated)`

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts:686-714`
**Issue:** Unchanged. The step always runs the scope read, including the first-run config migration, even when the manifest did not change. If a dependency's install is refused every time, each later update renders `(updated)` with the same `(failed)` child row. The command-wide `reportedDependencies` set removes repeats within one command, but not across commands.
**Fix:** Skip the step when the snapshot did not change and every outcome is `unchanged`, or render a result that holds only a refusal under the `(skipped)` header. Record the choice.

### IN-04 (carried over): When `state.json` turns unreadable during an apply, it is still reported twice

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:1315-1321` (with `1249-1266` and `judgeScopeAfterCascade`'s `reader.loadState` at `1820`)
**Issue:** Unchanged. A failed read after the moves pushes its `state.json` row into `after.rows`. `ran` is true because a cascade step ran, so the judgement reloads the state inside `runScopeIsolated(scope, outcomes, …)`. A fault that persists fails there too and pushes a second identical `invalid-block` row into `outcomes`. `unreportedFailures` removes duplicates only between `failures` and `outcomes`.
**Fix:** Before `cascadeRows` merges `after.rows`, drop each `invalid-block` row whose `failureKey` is already in `outcomes`. Alternatively, skip the judgement's own isolated row when `after.rows` already holds one for the scope.

### IN-05 (out of scope per fixer): Rows lost after a post-commit step throw; a deferred enable with no move of its own still runs in the cascade, ahead of a move it waits on

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts` (`notifyAdded`'s `finally`), `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:1515-1518`
**Issue:** These are the two gaps the round-2 fixer named. Neither changes the final state.

1. **Rows lost after a throw.** When `installMissingDependencyWithTransaction` throws in its post-commit hygiene, `marketplace add` renders `NO_DEPENDENCY_INSTALLS`, and so does bootstrap through its add. The rows of dependencies the step already installed are lost. The installs themselves stay committed.
2. **A deferred enable that runs early.** Take a held-down record D with no move of its own, released by the move of X, where X is in `afterInstalls` (X declares a waiting record that has a move). D stays an `alone` cascade step, so its enable runs before X moves. `enable` checks only for missing members, not ranges, so D is enabled for a while with X out of range. On the success path the final judgement accepts D, and `pending` and `apply` agree on the order: D's `will enable` comes before the deferred moves in both. On the failure path, where X's step after the install is blocked or fails, D is not blocked as it would have been before WR-06. The judgement then disables it again, and D reports a `(disabled)` row although it ends disabled, as it began.

**Fix:**
1. Let `createScopeDependencyInstall` turn a non-GHB post-commit hygiene throw into a debug line, so the step returns its rows.
2. Add `alone` deferred enables that declare an `afterInstalls` key to the fixpoint in `movesAfterInstalls`. Equivalently, make `cascadeSteps` exclude them and `stepsAfterInstalls` include them. `pending`'s preview would then need to list them after the installs too.

### IN-06: The `runAfterInstallSteps` doc says a step that declares a waiting record whose enable did not come does not run, but only waiting records that have a move count

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:1346-1372`
**Issue:** `notLanded` is `afterInstalls ∩ waiting \ planned`. A waiting record W with no move is never in `afterInstalls`. Take a deferred X whose new version declares both W and a waiting record with a move. If W's missing dependency is refused, X's move still runs, and the judgement then disables X (`(updated)`, then `(disabled)`). The comment promises that X is held back. This matches what the cascade does for a dependent of a refused install (the D-PL2-11 trailing disable), so the behavior is defensible. The comment overstates it.
**Fix:** Narrow the comment to "a waiting record with a move whose enable did not come". Alternatively, if the intent is to block, use `[...run.waiting].filter((key) => !planned.has(key))` and add a unit case.

---

_Reviewed: 2026-10-27T09:30:46Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

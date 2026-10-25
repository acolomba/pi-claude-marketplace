---
phase: 29-load-converges-on-the-catalog
reviewed: 2026-10-25T01:38:37Z
depth: deep
iteration: 3
scope: git diff 1f77faf4..a4b7c333 (the iteration-2 fix diff)
files_reviewed: 13
files_reviewed_list:
  - docs/dependency-resolution.md
  - docs/output-catalog.md
  - extensions/pi-claude-marketplace/orchestrators/reconcile/convergence.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/dependency-verdict.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/read-pass.ts
  - features/plugin/apply.feature
  - features/plugin/pending.feature
  - test/orchestrators/reconcile/apply.test.ts
  - test/orchestrators/reconcile/convergence.test.ts
  - test/orchestrators/reconcile/dependency-verdict.test.ts
  - test/orchestrators/reconcile/pending.test.ts
  - test/orchestrators/reconcile/read-pass.test.ts
findings:
  critical: 1
  warning: 1
  info: 10
  total: 12
status: issues_found
---

# Phase 29: Code Review Report (iteration 3)

**Reviewed:** 2026-10-25T01:38:37Z
**Depth:** deep, scoped to the fix diff `1f77faf4..a4b7c333`
**Files Reviewed:** 13
**Status:** issues_found

## Narrative Findings (AI reviewer)

## Summary

I re-reviewed the two iteration-2 fixes. I traced `planWithSettledVerdict` into `buildScopeDeclarationDetail` and `readRecordDeclarations` (`dependency-index.ts`), and `planConvergence` into `stateAsPlanLeavesIt`, `settleCandidates` and `declarationsWhileBlocked` (`convergence.ts`), `collectHolders` (`constraint-fold.ts`), and `applyPlan`, `refreshTogglePlan` and `convergeScope` (`apply.ts`). I ran six new hermetic probes. Each one uses `apply.test.ts`'s own `createHermeticScopes` and `seedConvergenceScope` harness. I ran each probe against the current tree, and I ran it again against a `git archive` of `1f77faf4`, the pre-fix tree, to tell regressions apart from older behavior. The probe file is `/tmp/claude-1000/-home-acolomba-src-pi-claude-marketplace-22442f56d78caa3a-lc-p29-catalog-1f05b5/b54feb17-c7cb-4f3d-9537-60d3ba8a0e22/scratchpad/probe/apply-probe3.test.ts` (tests `PROBE-3` to `PROBE-7`). The pre-fix copy is `apply-probe3-old.test.ts` in the same directory, and it imports from `scratchpad/old1f77/extensions/`.

Answers to the three questions:

1. **CR-01: converged, and still one shared verdict. The loop always ends. The stated cost is not the only gap.**
   - The PROBE-1 case now converges in one `apply`. This is the fixer's new apply test. A marker-held variant (`PROBE-4`: `widget` is already `dependencyDisabled`, then the catalog ships `zcore` 2.0.0) also converges in one `apply`: the enable, both moves, and then `Apply: nothing to change.`
   - `pending` and the read pass call the same `planWithSettledVerdict`, with the same `planMoves` (`planConvergence` over the read-pass snapshot). They still differ in two ways, both older than this fix: the MIG-01 `mergedViewForPlanning` view, and `pending`'s `withPlannedInstallsLanded` post-step.
   - The loop ends. A round that does not break strictly shrinks `heldDependents`, because `verdictAfterMoves` filters to the previous holders and `released` requires a smaller set. A walk that fails yields an empty held set, and then `holdsOnRange` is false. The walk does not read `version` or `enabled`, so the failure arm needs the files to change between two reads (TOCTOU).
   - The stated cost ("a plugin that a planned move takes out of range is not newly held down") is close to unreachable: for an enabled dependent, the planner and the verdict read the same catalog declarations, so the planner already holds that move.
   - The real gaps are different. The release is justified by a move set that was planned while the released plugins were disabled (CR-03). It also trusts moves that `apply` then does not make (WR-05). Both leave a plugin enabled with an unmet range on every later pass. The doc says the next `apply` disables it, and it does not.
2. **WR-01: it ends, it stays offline, and it matches the cascade except for a cascade `apply` refuses.**
   - The queue skips any key already in `declarations`. That covers recorded plugins and members that already landed. A member whose read fails never expands, and each read that succeeds adds a new key. So cycles and diamonds end.
   - The only reader is `readRecordDeclarations`: the memoized manifest plus the filesystem declaration reader. The diff adds no import, and `convergence.ts` stays outside `NETWORK_SEAMS` (NFR-5 / BLOCK F hold).
   - One regression: a cascade that `apply` always refuses, such as a dependency cycle, now holds a move in `pending` that `apply` makes (IN-09, reproduced).
3. **Other findings.** I found one more regression: CR-03 changes an outcome that used to converge correctly into an end state that stays wrong. I also have one performance note about the state lock (IN-10). The rest of the diff (`withRecords`, the narrower exports, the pending and read-pass call sites, and the tests and features) is sound.

## Critical Issues

### CR-03: The release is judged on moves planned with the released plugins disabled, so `apply` can move a dependent into a broken state that no later pass reports

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/dependency-verdict.ts:489-517` (`planWithSettledVerdict`), `:428-448` (`verdictAfterMoves`); `extensions/pi-claude-marketplace/orchestrators/reconcile/convergence.ts:140-163` and `521-538`

**Issue:** The first round calls `planning.planMoves(settled.plan)`. In that plan, every held dependent sits in `pluginsToDependencyDisable`. `stateAsPlanLeavesIt` disables those plugins, so the planner neither moves them nor counts them as holders. `collectHolders` marks them `disabled`, and they are skipped as candidates, so `declarationsWhileBlocked` never adds their installed copies. `verdictAfterMoves` then releases each dependent whose range that move set satisfies. Replanning enables them again. The move set is never re-checked with them enabled. In `apply`'s `convergeScope`, the released plugins are back as candidates. When a released plugin's own move is blocked, its installed copy (DLS-D1) adds a range, and that range can hold exactly the move the release relied on. The release is then wrong, and nothing undoes it.

- The next pass repeats the same computation: disable, plan without the plugin, release. So the state never converges. LOAD-01 never disables the dependent.
- `docs/dependency-resolution.md:291` says: "If another plugin's range holds the move of `b`, the move does not count, and `apply` disables `a` as before". That claim is false in this case.
- An installed copy that differs from the catalog copy is the normal state for a git-source plugin whose move is held, so the precondition is not exotic.
- The fixer's "release-only" rule guarantees that the loop ends. It does not make what the loop releases correct.

Reproduced as a regression (`PROBE-6`, path sources):

- `widget` is offered at 1.1.0, which declares `zcore@^2.0.0`.
- `rapp` declares `widget`. `rapp`'s installed copy also declares `zcore@^1.0.0`. `zzhost` declares `rapp@~1.0.0`, which blocks `rapp`'s move to 1.1.0.
- `zcore` is offered at 2.0.0.
- Every plugin is recorded at 1.0.0.

```
NOW  PENDING-0 widget (will update), rapp (skipped), zcore (skipped)
     APPLY-1   ● widget v1.0.0 → v1.1.0 (updated)
               ⊘ rapp (skipped) required by "zzhost@mp"
               ⊘ zcore (skipped) ... (^1.0.0, ^2.0.0) -- required by "rapp@mp", "widget@mp"
     APPLY-2   same two holds, nothing else
     STATE     widget 1.1.0 enabled (needs zcore ^2.0.0), zcore 1.0.0  -- stable, never disabled
PRE  APPLY-1   widget, rapp, zzhost (disabled); zcore 1.0.0 → 2.0.0
     APPLY-2   the three enabled again; widget → 1.1.0; rapp held
     STATE     widget 1.1.0, zcore 2.0.0 -- widget's range met
```

`apply` itself moved `widget` to a version whose declared range the scope does not meet, and every later `pending` and `apply` keeps it that way. `PROBE-3` is the variant where the released plugin is the dependent itself. There, `widget`'s own installed copy holds `zcore` once `widget` is enabled. That end state is also stable, with `widget`'s catalog range `^2.0.0` unmet and no disable. The pre-fix tree disabled `widget` there.

**Fix:** Plan the moves with the release candidates enabled, and only shrink the release set. Each round re-checks the release set against moves that were planned with exactly that set enabled. The set only shrinks, so the loop ends within |R| rounds. The final release is then consistent with the moves that `apply`'s `convergeScope` plans:

```ts
// `held` = the verdict's holders before any move; `candidate` = the verdict
// after the existing release round (release set R = held minus candidate's holders)
let candidate = next;
for (;;) {
  const plan = planning.replan(candidate);       // R enabled: candidates and holders again
  const moves = await planning.planMoves(plan);  // their installed copies hold here
  const check = await verdictAfterMoves(options, settled.verdict, togglesOf(plan), moves);
  // keep down every key `candidate` keeps down, plus each released key still unmet
  const kept = union(heldDependents(candidate), heldDependents(check));
  if (kept.size === heldDependents(candidate).size) {
    return { verdict: candidate, plan };
  }
  candidate = restrictTo(settled.verdict, kept); // R only shrinks, so this ends
}
```

Add `PROBE-6` as an `apply.test.ts` case: one `apply` must not move `widget` while `zcore` stays out of its range. Correct the paragraph in `docs/dependency-resolution.md`.

## Warnings

### WR-05: A planned move that never lands releases its dependent on every pass, so the dependent is never disabled

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/dependency-verdict.ts:489-517`; `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:1072-1106` (`convergeScope`); `docs/dependency-resolution.md:291`

**Issue:** The release is computed fresh on each pass from the offline move plan. The plan has no memory that a move failed. So a move that fails every time (D-13: EACCES, a bridge failure, a git target that cannot be fetched) is planned again, trusted again, and releases the dependent again. The same happens when the runner holds a move the planner admitted (IN-07), or when a cold git target shows a phantom move (IN-01). The doc says "If the move of `b` runs and fails, `a` stays enabled with its range unmet, and the next `apply` disables it." That is false. The dependent stays enabled for as long as the move keeps failing. Worse, the move order (marketplace, then plugin) lets the dependent move first, onto the version whose range is unmet.

Reproduced as a regression (`PROBE-7`): the PROBE-1 fixture, with a `zcore` command file set to mode 000.

```
NOW  APPLY-1  ● widget v1.0.0 → v1.1.0 (updated); ⊘ zcore v1.0.0 → v2.0.0 (failed) {permission denied}
     APPLY-2  ⊘ zcore (failed)          APPLY-3  ⊘ zcore (failed)
     STATE    widget 1.1.0 enabled (needs ^2.0.0), zcore 1.0.0
PRE  APPLY-1  ◍ widget (disabled) {dependency version unsatisfied}; ⊘ zcore (failed)
```

**Fix:** Keep D-13's promise in `apply`. After `convergeScope`, take the LOAD-01 verdict again over the fresh state. No move assumption is needed there, because the moves have run. Then run `applyToggleSteps`' dependency-disable step for each dependent that the read pass released and that is still unmet. This costs one walk, and only when the settled plan released something. Also sort the moves so that a released dependent moves after the dependency moves its release relies on, and skip its move when one of those fails. Then fix the doc sentence.

## Info

IN-01 to IN-08 are carried from iteration 2. They were out of scope for the fixer, and their numbers are kept. Two of them now feed WR-05, as noted below.

### IN-01: A cold git target compares the entry version with a record version that took the `plugin.json` version first (carried; now worse)

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/convergence.ts:300-318`
**Issue:** Unchanged as a preview defect. It is now worse, because the phantom move goes into `planWithSettledVerdict`'s `planMoves`. A phantom move whose `toVersion` satisfies a held dependent's range releases that dependent, and `apply` then does not make the move (the WR-05 mechanism).
**Fix:** As before: for a cold target whose sha pin is unchanged, or that has no pin, do not preview a move from `entry.version` alone.

### IN-02: Stale comments and docs still describe load-time behavior (carried)

**Files:** `orchestrators/reconcile/notify.ts:838-840`, `orchestrators/reconcile/mcp-migration.ts:42-46`, `orchestrators/reconcile/dependency-verdict.ts:37` ("disables it on the next reload"), `docs/dependency-resolution.md:281`
**Fix:** Change these to describe `apply`.

### IN-03: The "nothing to change" scenario does not prove that `apply` writes nothing (carried)

**File:** `features/plugin/apply.feature` ("Apply with nothing pending")
**Fix:** Assert that the state and config file bytes are unchanged.

### IN-04: The load builds the pending report before it sends the migration notice and warnings (carried)

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/load.ts:96-103`
**Fix:** Send `notifyMcpMigration` and `notifyScopeOutcomes` first, or guard the composer.

### IN-05: `apply`'s install cascades can still list tags, which `pending` cannot preview (carried)

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:451-670`
**Fix:** Document this, or name the range on the `(will install)` row.

### IN-06: The union rule reads D-12 in a new way, and CONTEXT.md does not record it (carried)

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/convergence.ts:513-538`; `docs/output-catalog.md:3671`
**Fix:** Once the user confirms the rule, amend D-12 in 29-CONTEXT.md (for example as D-12a) and cite it on `declarationsWhileBlocked`. The iteration-2 "release-only" decision (29-REVIEW-FIX.md) is a second unconfirmed reading of D-12 that also needs recording.

### IN-07: A cold git dependent that moves earlier in the same `apply` can still hold a later move the planner admitted (carried; now worse)

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:1090-1106`; `orchestrators/plugin/dependency-declaration-read.ts:179-215`
**Issue:** Unchanged as a hold mismatch. It is now worse: when the held move is one that a release relied on, the dependent stays released on every pass (WR-05).
**Fix:** As before.

### IN-08: Two small gaps that make the cause line or the result disagree (carried)

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/convergence.ts:221-223` and `constraint-fold.ts::describeConstraint`
**Issue:** Unchanged. The fixer noted that the `unusable` fail-open in `withPlannedInstalls` now applies to cascade members as well. The duplicate holder name shows up in the CR-03 output (`required by "widget@mp", "widget@mp"` in `PROBE-3`). It is no worse in kind.
**Fix:** As before.

### IN-09: A cascade that `apply` always refuses now holds a move in `pending` that `apply` makes

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/convergence.ts:197-234` (`withPlannedInstalls`)
**Issue:** The walk adds every member it can read. It never asks whether the cascade can succeed. A dependency cycle among unrecorded members always fails in `apply` (`Dependency cycle: dtop@mp -> emid@mp -> dtop@mp.`), so nothing lands and the move runs. But `pending` lists the move as held. Before WR-01's change, `pending` and `apply` agreed here. Reproduced (`PROBE-5`): `dtop` → `emid` → `dtop`, and `emid` also declares `pcore@^1.0.0`.

```
NOW  PENDING-0 dtop (will install), pcore (skipped) {dependents constrain}
     APPLY-1   ⊘ dtop (failed) {dependency failed}; ● pcore v1.0.0 → v2.0.0 (updated)
PRE  PENDING-0 dtop (will install), pcore (will update)   -- matches apply
```

The fixer documented the same class for cross-marketplace refusals. Unlike those, the walk already sees the cycle.
**Fix:** When the walk meets a key that is already on the current install's path (a back edge), treat that install's whole cascade as one that adds no holders. Or add the cycle case to the limits that `docs/output-catalog.md` names.

### IN-10: A scope with a standing range hold pays a full move plan inside the state lock on every load and `apply`

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/read-pass.ts:214-230`; `dependency-verdict.ts:500-514`
**Issue:** "A scope without one pays nothing more" is true. But a range hold is the normal steady state after LOAD-01 disables a plugin: the marker reads as enabled, so the entry stays `out-of-range` until the catalog changes. Each load and each `apply` read pass then runs `planConvergence` inside `withLockedStateTransaction`, plus a second full declaration walk. `planConvergence` costs one `resolveStrict` per enabled record, plus the installed-copy and declaration reads. `refreshTogglePlan` repeats the work, and the load's `composePendingReport` (IN-04) repeats it again without the lock. The lock uses `retries: 0`, so a second Pi process that touches the scope during that time gets `StateLockHeldError`.
**Fix:** Run the move plan only when a held dependent's out-of-range dependency has a catalog candidate. That is cheap to test from the manifest entry. Or take the settled plan outside the lock and re-check the snapshot's bytes under it.

---

_Reviewed: 2026-10-25T01:38:37Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep (fix diff only)_

---
phase: 29-load-converges-on-the-catalog
fixed_at: 2026-10-25T01:25:00Z
review_path: .planning/phases/29-load-converges-on-the-catalog/29-REVIEW.md
iteration: 2
iteration_1_fixed: 5
findings_in_scope: 2
fixed: 2
skipped: 0
status: all_fixed
---

# Phase 29: Code Review Fix Report

**Fixed at:** 2026-10-25T00:41:30Z
**Source review:** .planning/phases/29-load-converges-on-the-catalog/29-REVIEW.md
**Iteration:** 1

**Summary:**

- Findings in scope: 5 (CR-01, WR-01..WR-04). IN-01..IN-05 were out of scope (`critical_warning`).
- Fixed: 5. All five carry logic changes, so CR-01 and WR-01..WR-03 are marked "fixed: requires human verification".
- Skipped: 0

## Decision for the user (CR-01, D-12)

CR-01 needs a reading of D-12 that 29-CONTEXT.md does not settle. The fix takes the most conservative option: the preview shows the hold. Please confirm it.

- **What D-12 says:** a dependent that stays put "is judged by its recorded or installed-copy declarations". The planner read that as "replace its catalog declarations with its installed copy's".
- **Why the reviewer's fix was not applied:** the reviewer proposed giving the runner the planner's replaced declarations. I tried that first. In a hermetic `apply` test with the reviewer's fixture, `apply` then moved `zcore` to 2.0.0. The next `apply` disabled `widget` with `{dependency version unsatisfied}`, and then `zzhost` with `{dependency unsatisfied}`. The cause is that the LOAD-01 dependency check, `update`'s constraint gate and the runner all read a listed record's catalog copy (the D-05-06 read order). Replacing the catalog copy in the planner alone makes `apply` take a move that the next check reads as breaking the dependent.
- **What was done instead:** a dependent that stays put keeps its catalog declarations and adds its installed copy's (`alreadyDeclared` drops the duplicates). A range that either copy declares holds the move. Each record the planner judges now carries at least the declarations that the runner and the load-time check read. So the plan never admits a move that either of them holds. A tighter installed copy still holds the move too, which keeps the protection the old installed-copy rule gave (the old "fixed point" test). The runner's gate was not changed.
- **User-visible effect:** in the CR-01 fixture, `pending` and `apply` now both hold `zcore` with `required by "widget@tools"`. Before, `pending` listed `(will update)` and `apply` held it on every run. `docs/output-catalog.md` describes the new rule.

## Fixed Issues

### CR-01: The planner and the runner judge ranges from different declarations

**Status:** fixed: requires human verification (see the decision above)
**Files modified:** `extensions/pi-claude-marketplace/orchestrators/reconcile/convergence.ts`, `test/orchestrators/reconcile/convergence.test.ts`, `test/orchestrators/reconcile/apply.test.ts`, `docs/output-catalog.md`
**Commit:** 3969f4ee
**Applied fix:** `blockRound` now adds a held candidate's installed-copy declarations to its catalog declarations instead of replacing them. Regression tests:
- `convergence.test.ts` "a held dependent whose catalog copy is stricter than its installed copy still holds the move". It uses `zcore` and `zzhost`, the name order that let the move through before the fix. It fails on the old code.
- `apply.test.ts` "a held dependent's stricter catalog copy holds the move on every apply, and the dependent stays enabled". Two applies show the same two holds, and state.json does not change. It fails on the old code.

The existing fixed-point test now expects the combined cause line.

### WR-01: The convergence fixed point depends on plugin names

**Status:** fixed: requires human verification
**Files modified:** `extensions/pi-claude-marketplace/orchestrators/reconcile/convergence.ts`, `test/orchestrators/reconcile/convergence.test.ts`
**Commit:** 3a201f2e
**Applied fix:** `settleCandidates` now uses Jacobi rounds. Each round judges every candidate against the same declarations (`judgeCandidates`). Those declarations are derived again from the walk and the current block set (`declarationsWhileBlocked`). The loop stops when no block is added, and the reported causes come from the last round. After CR-01 a block only adds ranges, so the operator is monotone. The blocked set therefore grows each round, the loop ends within n+1 rounds, and the result is the unique least fixed point, so it cannot oscillate.

The vacuous "any input order" test was replaced. The new tests use two fixtures that differ only in plugin names (`core`/`zhost` and `zcore`/`zzhost`) and assert the same holds and cause lines for both. The `core` variant fails on the old code: the cause line it kept missed `widget`'s installed range.

### WR-02: The preview ignores dependents the plan installs

**Status:** fixed: requires human verification
**Files modified:** `extensions/pi-claude-marketplace/orchestrators/reconcile/convergence.ts`, `test/orchestrators/reconcile/convergence.test.ts`, `features/plugin/pending.feature`, `docs/output-catalog.md`
**Commit:** 9d33bbc6
**Applied fix:** `withPlannedInstalls` adds each install the plan makes (`pluginsToInstall` and `pluginsToDependencyInstall`) to the view and to the declaration map. It does this only for an install in a marketplace the scope records, and only when the install's declarations can be read offline (`readRecordDeclarations`, as the walk reads them). Such an install then holds a move the way it does after `apply` lands it. Tests:
- Unit tests for both buckets.
- Unit tests showing that an unlisted install, or an install into an unrecorded marketplace, holds nothing.
- A new cucumber scenario: "Pending lists a move that a plugin the config adds would block as held". It fails on the old code.

### WR-03: One `apply` does not converge when the config disables a dependency

**Status:** fixed: requires human verification
**Files modified:** `extensions/pi-claude-marketplace/orchestrators/reconcile/dependency-verdict.ts`, `extensions/pi-claude-marketplace/orchestrators/reconcile/read-pass.ts`, `extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts`, `test/orchestrators/reconcile/dependency-verdict.test.ts`, `test/orchestrators/reconcile/read-pass.test.ts`, `test/orchestrators/reconcile/pending.test.ts`, `test/orchestrators/reconcile/apply.test.ts`, `features/plugin/apply.feature`, `docs/dependency-resolution.md`
**Commit:** 839fc99c
**Applied fix:** this is one shared verdict, not the reviewer's apply-only re-read.
- The new `verdictAfterToggles` takes the LOAD-01 verdict again over the scope as the plan's enables and disables leave it. A config disable counts as the user's own choice, so it carries no marker.
- Both the read pass, which serves `apply` and the load, and `pending` plan with that verdict. So one `apply` disables the dependent together with the dependency, and `pending` lists both first.
- The fix also covers the mirror case: a dependency the config enables again now lifts its held-down dependent in the same pass.
- The reviewer's suggestion to re-run `refreshTogglePlan` was not used. That refresh runs before the toggles, so it would still have seen the dependency enabled.

Tests:
- Unit tests for both directions, the no-toggle case and the failed-walk case.
- A read-pass plan test.
- Two pending cases.
- An apply test where the second apply has nothing to change.
- A new cucumber scenario: "Apply disables a plugin together with the dependency that a config disables by hand, after which pending lists nothing". It fails on the old code.

### WR-04: `convergeScope` hides its own failures

**Status:** fixed
**Files modified:** `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts`, `test/orchestrators/reconcile/apply.test.ts`
**Commit:** 1c05c710
**Applied fix:** the convergence read now runs through `runScopeIsolated`, so a throw becomes a `state.json` row and is not just a debug log. The row is held back until `closeScopePass` has run. Then `unreportedFailures` drops it when another step already reported the same file, scope and reason. Without that, the two RECON-03 half-written-state tests showed the fault twice, because the routing rebuild hits it as well. New test: a convergence read that fails over a scope with a pending move reports the `state.json` row and not "nothing to change". It fails on the old code.

## Residual gaps (not fixed, for follow-up)

- **Duplicate holder name (CR-01).** When a staying dependent's catalog copy and installed copy both name the target with different ranges, the cause line names the dependent twice, for example `required by "widget@tools", "widget@tools"`. `constraint-fold.ts::describeConstraint` names one holder per declaration. That rule already applied to a manifest that repeats a dependency (D-03-02.1). I left it unchanged to keep the fix narrow.
- **Installs the preview cannot read (WR-02).** The preview still cannot see these installs offline:
  - an install into a marketplace the same plan adds, which is not cloned yet
  - the members an install's dependency cascade brings in
  - a git-source install whose tree is not cached

  A hold caused by one of them still appears first in `apply`. A planned holder is also always taken as enabled. So when an install will land disabled (DFEN-04), the preview's cause line has no `(currently disabled)` mark.
- **Uninstalls (WR-03).** Only config enables and disables re-run the verdict. A config uninstall of a dependency that an enabled dependent declares keeps today's behavior: the next `apply` plans a MISS-01 dependency install. The reviewer's "uninstalled" trigger would have planned an uninstall and a dependency install of the same key in one plan, so it was left out.
- **Cucumber coverage for CR-01, WR-01 and WR-04.** CR-01 and WR-01 need a dependent whose installed copy differs from its catalog copy. That means a git-source dependent with a per-commit copy, or a moved plugin root. The git-repository publishing steps (`features/lib/git-plugin.ts`) have no dependencies column. WR-04 needs a state file that breaks between the read pass and the convergence. The hermetic unit and apply tests listed above cover all three.

## Verification

- **Where the checks ran:** the checks ran in the main checkout of this worktree, `/home/acolomba/src/pi-claude-marketplace-22442f56d78caa3a/lc-p29-catalog-1f05b5`. No isolated review-fix worktree was created. The orchestrator's binding executor rules set sequential mode on the main working tree, and an isolated worktree would have had no `node_modules`, so the project's gates could not have run there. `workflow.use_worktrees` is `true`, and this run did not follow it.
- **Per fix:** each fix ran its owner tests and `npm run test:coverage:direct` for every touched source-test pair: convergence, dependency-verdict, read-pass, pending and apply. All pairs reached 100% coverage. The changed cucumber scenarios ran, and `npm run check:features` passed. Each new test was confirmed to fail against the pre-fix source. The pre-commit hook (`npm run check:commit`) passed on every commit.
- **Full gate:** one full `npm run check` ran after the last commit, in the background, with its log at `/tmp/claude-1000/-home-acolomba-src-pi-claude-marketplace-22442f56d78caa3a-lc-p29-catalog-1f05b5/b54feb17-c7cb-4f3d-9537-60d3ba8a0e22/scratchpad/npm-check.log`. **Exit code 0.** The end of the log:

```text
792 scenarios (792 passed)
7659 steps (7659 passed)
0m 26.575s (3m 9.400s executing your code)
Merged LCOV: coverage/direct.lcov (284 records)
npm-check-exit=0
```

## Iteration 2

**Fixed at:** 2026-10-25T01:25:00Z
**Source review:** .planning/phases/29-load-converges-on-the-catalog/29-REVIEW.md (iteration 2, committed 1f77faf4)

The frontmatter counts cover this iteration. Iteration 1's five fixes (3969f4ee, 3a201f2e, 9d33bbc6, 839fc99c, 1c05c710) stay recorded above.

**Summary:**

- Findings in scope: 2 (CR-01, WR-01). IN-01..IN-08 were out of scope (`critical_warning`).
- Fixed: 2. Both are logic changes, so both are marked "fixed: requires human verification".
- Skipped: 0

### CR-01: The dependency check runs before the catalog moves

**Status:** fixed: requires human verification
**Files modified:** `extensions/pi-claude-marketplace/orchestrators/reconcile/dependency-verdict.ts`, `extensions/pi-claude-marketplace/orchestrators/reconcile/read-pass.ts`, `extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts`, `test/orchestrators/reconcile/dependency-verdict.test.ts`, `test/orchestrators/reconcile/read-pass.test.ts`, `test/orchestrators/reconcile/pending.test.ts`, `test/orchestrators/reconcile/apply.test.ts`, `features/plugin/apply.feature`, `features/plugin/pending.feature`, `docs/dependency-resolution.md`
**Commit:** 121c6168
**Applied fix:**

- A new `planWithSettledVerdict` in `dependency-verdict.ts` is now the one place where the read pass (for `apply` and the load) and `pending` plan a scope. So `pending` and `apply` still share one verdict.
- It takes the first verdict, then the verdict after the plan's toggles, as before (WR-03 of iteration 1). Then, while a range holds a dependent down, it plans the catalog moves offline (`planConvergence` over the current plan, injected by the caller). It takes the verdict again with each moved record at its `toVersion`, and plans again.
- **Decision (conservative, please confirm):** a round only releases. An entry whose dependent the previous verdict did not hold is dropped, and the loop stops when a round releases nothing. That guarantees the loop ends, and it cannot oscillate. The cost: a plugin that a planned move takes out of its range is not newly held down in the same pass. The planner's own range check already holds such a move for an enabled dependent, so this case needs a hold the verdict does not see, for example an installed-copy range (DLS-D1). Then the dependent stays enabled with its range unmet, and the next `apply` disables it. That is the D-13 outcome the reviewer accepted.
- The move plan runs only while the verdict has an out-of-range entry. So a scope without one pays nothing more inside the read-pass lock (WR-08).
- `verdictAfterToggles` and the new `verdictAfterMoves` became private. Their tests now go through `planWithSettledVerdict`.
- `docs/dependency-resolution.md` describes the new behavior and its two limits: a move that another range holds, and a move that runs and fails.

Regression tests (each fails on the pre-fix source, which I checked by restoring the HEAD sources temporarily):

- `apply.test.ts` "one apply moves a dependent and the dependency its new range needs, and the next apply has nothing to change". This is PROBE-1: one apply reports `widget v1.0.0 → v1.1.0 (updated)` and `zcore v1.0.0 → v2.0.0 (updated)`, and the second apply reports `Apply: nothing to change.`
- `pending.test.ts`: two `(will update)` rows and no `(will disable)` row.
- `read-pass.test.ts`: the plan is empty and the verdict holds nothing.
- `dependency-verdict.test.ts`: release, partial release, release-only (a moved-out-of-range plugin is not added), no moves, and a walk that fails after the moves.
- Cucumber: `apply.feature` "Apply moves a plugin and the dependency its new version needs in one pass, after which pending lists nothing", and `pending.feature` "Pending lists a plugin and the dependency its new version needs as two updates".

### WR-01: `pending` previews `(will update)` for a move that a planned install's cascade member holds

**Status:** fixed: requires human verification
**Files modified:** `extensions/pi-claude-marketplace/orchestrators/reconcile/convergence.ts`, `test/orchestrators/reconcile/convergence.test.ts`, `test/orchestrators/reconcile/pending.test.ts`, `features/plugin/pending.feature`, `docs/output-catalog.md`
**Commit:** a4b7c333
**Applied fix:**

- **Choice:** include the cascade members that can be read offline, not the "uncertain" marker. `withPlannedInstalls` now walks a queue. It starts with the plan's installs. Each plugin it reads adds its declared dependencies to the queue.
- A key the scope records, or one already landed, is skipped. This also covers cycles and diamonds.
- A member in a marketplace the scope records, whose declarations `readRecordDeclarations` can read, is added as a `PLANNED_INSTALL_RECORD` with those declarations. So it holds a move the way `apply`'s fresh read does once the cascade records it.
- A member that cannot be read holds nothing, as a direct install already did.
- I did not reuse `domain/dependency-closure.ts`. It needs an install policy and a closure lookup, while this preview only needs to know which plugins land and what they declare. The simple walk reads the same declarations through the same reader.
- `docs/output-catalog.md` (held-move state) names the cascade members and the offline limit.

Regression tests (each fails on the pre-fix source):

- `convergence.test.ts` "a dependency a planned install's cascade brings in holds the move".
- `pending.test.ts` "pending lists a move that a planned install's cascade member holds as held". This is PROBE-2's shape: `top (will install)` plus `lib (skipped) {dependents constrain}` required by `app@tools`.
- Cucumber: `pending.feature` "Pending lists a move that a dependency of a plugin the config adds would block as held, as apply then holds it". It asserts that `pending` and the following `apply` show the same hold.

### Residual gaps (iteration 2, not fixed)

- **CR-01 release-only rule:** see the decision above. In the rare case a released dependent's range is broken by a move that only an installed-copy hold would stop, the dependent is disabled one `apply` later.
- **CR-01 move order:** in `apply` the moves still run in planner order (marketplace, then plugin). In PROBE-1 the dependent moved before its dependency, and the runner accepted it. A failure of the dependency's move leaves the dependent enabled, possibly already moved, with its range unmet, until the next `apply` disables it (D-13).
- **WR-01 preview limits:**
  - An install into a marketplace the same plan adds still holds nothing in the preview.
  - A cold git-source member is judged by its marketplace entry (D-01-07), and its own manifest can be stricter once cloned (the IN-07 class).
  - The preview does not apply the cascade's cross-marketplace permission check (`allowCrossMarketplaceDependenciesOn`) or its tag selection (IN-05). A cascade that `apply` refuses installs nothing, so `pending` may show a hold for a move that `apply` then makes. This is the same class as a planned direct install that fails.
- **Info findings IN-01..IN-08** were out of scope and are untouched. IN-08's `unusable` fail-open in `withPlannedInstalls` now also applies to cascade members.

### Verification (iteration 2)

- **Where the checks ran:** in the main checkout of this worktree, `/home/acolomba/src/pi-claude-marketplace-22442f56d78caa3a/lc-p29-catalog-1f05b5`, in sequential mode, as the orchestrator's binding executor rules require. No review-fix worktree was created, although `workflow.use_worktrees` is `true`, the same as in iteration 1. The numbers can be reproduced from this checkout.
- **Per fix:**
  - The owner tests ran.
  - `npm run test:coverage:direct` reached 100% for dependency-verdict, read-pass, pending and convergence.
  - The changed cucumber features ran, and `npm run check:features` passed.
  - `fallow dupes` and `fallow dead-code` were clean.
  - The pre-commit hook (`npm run check:commit`) passed on both commits.
- **Full gate:** one full `npm run check` ran after the last commit, in the background, with its log at `/tmp/claude-1000/-home-acolomba-src-pi-claude-marketplace-22442f56d78caa3a-lc-p29-catalog-1f05b5/b54feb17-c7cb-4f3d-9537-60d3ba8a0e22/scratchpad/npm-check-rf2.log`. **Exit code 0.** The end of the log:

```text
16 hooks (16 passed)
795 scenarios (795 passed)
7701 steps (7701 passed)
0m 26.392s (3m 8.197s executing your code)
Merged LCOV: coverage/direct.lcov (284 records)
npm-check-exit=0
```

---

_Fixed (iteration 1): 2026-10-25T00:41:30Z_
_Fixed (iteration 2): 2026-10-25T01:25:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 2_

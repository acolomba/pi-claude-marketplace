---
phase: 29-load-converges-on-the-catalog
reviewed: 2026-10-25T00:54:22Z
depth: deep
iteration: 2
scope: git diff 35c8d856..1c05c710 (the iteration-1 fix diff)
files_reviewed: 14
files_reviewed_list:
  - docs/dependency-resolution.md
  - docs/output-catalog.md
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
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
  info: 8
  total: 10
status: issues_found
---

# Phase 29: Code Review Report (iteration 2)

**Reviewed:** 2026-10-25T00:54:22Z
**Depth:** deep, scoped to the fix diff `35c8d856..1c05c710`
**Files Reviewed:** 14
**Status:** issues_found

## Narrative Findings (AI reviewer)

## Summary

I re-reviewed the five iteration-1 fixes. I traced the call chains into `constraint-fold.ts` (`foldDeclaredConstraint`, `evaluateCatalogConstraint`), `update-preflight.ts` (`selectConstraintGate`, `postFetchGuard`), `dependency-index.ts` (`readRecordDeclarations`, `buildScopeDeclarationDetail`), `dependency-declaration-read.ts`, and `plan.ts`. I also ran two hermetic probes. Each copied `apply.test.ts`'s own `createHermeticScopes` and `seedConvergenceScope` harness and ran against the real modules. The probe file is `/tmp/claude-1000/-home-acolomba-src-pi-claude-marketplace-22442f56d78caa3a-lc-p29-catalog-1f05b5/b54feb17-c7cb-4f3d-9537-60d3ba8a0e22/scratchpad/probe/apply-probe.test.ts`, with tests `PROBE-1` and `PROBE-2`.

Verdict on each fix:

- **Old CR-01 (planner and runner use different declarations): closed.** A staying candidate is now judged by its catalog declarations plus its installed copy's. Every candidate keeps its catalog declarations. The runner's gate (`evaluateCatalogConstraint`) folds the catalog declarations of the state it reads. So the planner's holder set is a superset of the runner's. A planner move cannot be held by the runner unless the catalog read itself changes between the plan and the move. That can happen only on the D-11 cold-git path (IN-07). The other direction cannot disagree: `apply` reports the planner's holds itself (`blockedMoveOutcomes`) from a fresh plan, so `pending` cannot show a hold that `apply` would not also show, as long as the two planner inputs agree. They do not always agree, and that gap is CR-01 below. One cost of the fix: the stricter union rule reads D-12 in a new way that the user has not yet confirmed (IN-06).
- **Old WR-01 (the fixed point depends on names): closed.** Each round of `judgeCandidates` judges every candidate against one declaration map, keyed by plugin, so input order and names cannot change the result. The fold is monotone in added declarations. An added range narrows the intersection or makes it fail, and an unranged holder adds no range. So blocks only grow. The loop `while (next.size > blocked.size)` grows by at least one each round and is bounded by the candidate count, so it always ends. At exit `next` and `blocked` hold the same keys, and the causes come from that final map.
- **Old WR-02 (planned installs not in the preview): partly closed.** Planned installs now hold a move. Members of an install's dependency cascade do not (WR-01 below, reproduced).
- **Old WR-03 (`verdictAfterToggles`): closed. No new bug found.** Records that the verdict treats as held down are visible to it, through LOAD-02 optimism and the `held` set. So when the second plan drops an enable, its dependents are still held through propagation. The second plan can add only lifts. Those lifts are records that carry the marker, which the verdict already treats as enabled. So one re-derivation is a fixed point. `pending` and the read pass compute it the same way, and `refreshTogglePlan` runs it again through `readPassForScope`. The uninstall case the fixer left out does not regress: the D-05-14 refusal reports it.
- **Old WR-04 (`runScopeIsolated` and dedup): closed. No swallowed or double-reported failure found.** `runScopeIsolated` only ever pushes `invalid-block`, so `failureKey` is always defined for a convergence failure, and the `undefined` keys of other outcomes cannot match it. The key includes the scope, so a fault in one scope does not hide the same fault in the other.

New in this pass: a catalog move can satisfy a range that the same `apply` already used, before the move ran, to disable a dependent (CR-01). That is the main remaining defect.

## Critical Issues

### CR-01: The dependency check runs before the catalog moves, so `apply` disables a dependent whose range its own move then satisfies

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/read-pass.ts:213-226`, `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:1040-1053` and `1203-1208`, `extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts:497-523`

**Issue:** The LOAD-01 verdict and the plan built from it are computed over the recorded versions from before the moves. `convergeScope` runs after `applyToggleSteps`, and nothing re-derives the verdict once the moves have landed. Take the most common way a range changes: a marketplace update ships a dependent's new version that needs a new version of its dependency, and ships that dependency too. The verdict reads the dependent's catalog copy (D-05-06), finds the recorded dependency out of range, and plans a dependency-disable. `apply` disables the dependent. The convergence then skips it, because disabled records never move (ENBL-08), and moves the dependency into the range. The report names a remedy that the same report says it has just carried out. The dependent's own move is lost too. A second `apply` is needed to enable the dependent and move it. This breaks D-08 ("Afterwards `pending` lists nothing except blocked moves") and the first bullet of D-19. It also breaks D-12 ("ranges are judged against the scope as it will stand after `apply`"), because the dependency check is not judged that way. For the whole first `apply`, a plugin that worked is disabled for no reason.

Reproduced (`PROBE-1`, path marketplace). `widget` and `zcore` are both recorded at 1.0.0. The catalog offers `widget` 1.1.0, which declares `zcore@^2.0.0`, and `zcore` 2.0.0:

```
PENDING-0 widget (will disable), zcore (will update)
APPLY-1   ◍ widget v1.0.0 (disabled) {dependency version unsatisfied}
            cause: Update "zcore@mp" to satisfy ^2.0.0, or uninstall "widget@mp"
          ● zcore v1.0.0 → v2.0.0 (updated)
PENDING-1 widget (will enable), widget (will update)
APPLY-2   widget (installed), widget v1.0.0 → v1.1.0 (updated)
PENDING-2 (empty)
```

**Fix:** Judge the LOAD-01 verdict against the scope as the planned moves leave it, in the read pass and in `pending` alike. Then the dependency is not disabled, and the dependent becomes a candidate in the same pass. One shape: plan the toggles, plan the convergence offline over the toggled view, then take the verdict again with each admitted move's `toVersion` written into its record. Repeat until the plan's toggle buckets stop changing. The loop is bounded because each round only releases holds:

```ts
// read-pass.ts / pending.ts, after the verdictAfterToggles step
let verdict = toggledVerdict;
let plan = planReconcile(merged, state, scope, verdict);
for (;;) {
  const moves = await planConvergence({ scope, state, locations: loc, plan });
  const next = await verdictAfterToggles(
    { state: withMovedVersions(state, moves.moves), locations: loc },
    firstVerdict,
    { enable: plan.pluginsToEnable, disable: plan.pluginsToDisable },
  );
  const replanned = planReconcile(merged, state, scope, next);
  if (sameToggles(replanned, plan)) break;
  plan = replanned;
  verdict = next;
}
```

A move that later fails to materialize leaves the range unsatisfied. The next `apply` then disables the dependent, which is an acceptable D-13 outcome. Add an `apply.feature` scenario where a marketplace update bumps a dependent and its dependency together, then assert that one `apply` moves both and that `pending` is then empty.

## Warnings

### WR-01: `pending` still previews `(will update)` for a move that a planned install's cascade member holds in `apply`

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/convergence.ts:195-230` (`withPlannedInstalls`)

**Issue:** `withPlannedInstalls` adds only the plan's direct installs (`pluginsToInstall` and `pluginsToDependencyInstall`). The install cascade that `apply` runs also installs each install's own missing dependencies (RESV-01). Those members are recorded before `convergeScope` takes its fresh read, so their catalog ranges hold moves in `apply` that `pending` and the load listed as changes. D-06 and D-23 ("`apply` applies exactly what `pending` previewed") still fail in this case. The fixer listed it as a residual gap. It is still a defect, and the cascade case can be fixed offline: for a path source the members can be read from the recorded marketplace, the same way the planned install itself is read.

Reproduced (`PROBE-2`). The config adds `dtop`, which declares `emid@^1.0.0`. `emid` is not recorded and declares `pcore@^1.0.0`. `pcore` is recorded at 1.0.0 and offered at 2.0.0:

```
PENDING-0 dtop (will install), pcore (will update)
APPLY-1   dtop (installed); ⊘ pcore v1.0.0 (skipped) {dependents constrain}
            cause: ... (^1.0.0) -- required by "emid@mp"
PENDING-1 pcore (skipped) {dependents constrain}
```

**Fix:** In `withPlannedInstalls`, walk each planned install's dependency closure offline, the walk `domain/dependency-closure.ts` already does, using the warm-cache reader. Add every member that is not already recorded and sits in a recorded marketplace, with its declarations, as a `PLANNED_INSTALL_RECORD`. A member that cannot be read offline keeps today's behavior, and `docs/output-catalog.md` should name that limit. Add the `PROBE-2` case to `pending.feature`.

## Info

The first five items are the iteration-1 Info findings, deferred and still present. Each keeps its original number so the disposition ledger still matches.

### IN-01: A cold git target compares the entry version with a record version that took the `plugin.json` version first

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/convergence.ts:296-314`
**Issue:** Unchanged. `coldGitOffer` compares `entry.version` with `record.version`, which follows VER-01. When the two disagree, the result is a `(will update)` row that looks like a downgrade and that `apply` does not make.
**Fix:** As before. For a cold target whose sha pin is unchanged, or that has no pin, do not preview a move from `entry.version` alone.

### IN-02: Stale comments and docs still describe load-time behavior

**Files:** `orchestrators/reconcile/notify.ts:838-840`, `orchestrators/reconcile/mcp-migration.ts:42-46`, `orchestrators/reconcile/dependency-verdict.ts:37` ("disables it on the next reload"), `docs/dependency-resolution.md:281` ("disabled at load time")
**Fix:** Change these to describe `apply`.

### IN-03: The "nothing to change" scenario does not prove that `apply` writes nothing

**File:** `features/plugin/apply.feature:304-314`
**Fix:** Assert that the state and config file bytes are unchanged.

### IN-04: The load builds the pending report before it sends the migration notice and warnings

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/load.ts:96-103`
**Fix:** Send `notifyMcpMigration` and `notifyScopeOutcomes` first, or guard the composer.

### IN-05: `apply`'s install cascades can still list tags, which `pending` cannot preview

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:451-670`
**Fix:** Document this, or name the range on the `(will install)` row.

### IN-06: The union rule reads D-12 in a new way, and CONTEXT.md does not record it

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/convergence.ts:509-534`; `docs/output-catalog.md:3671`
**Issue:** D-12 says a staying dependent "is judged by its recorded or installed-copy declarations". The fix judges it by its catalog copy and installed copy together. So a range in a catalog copy that is not running now holds a move that D-12, as written, would let through. The fixer asked the user to confirm this (29-REVIEW-FIX.md, "Decision for the user"). Until the user answers, the shipped behavior goes against a recorded decision. Under AGENTS.md's upstream-parity rule, that needs an amended decision ID.
**Fix:** Once confirmed, amend D-12 in 29-CONTEXT.md, for example as D-12a, and cite it in the comment on `declarationsWhileBlocked`.

### IN-07: A cold git dependent that moves earlier in the same `apply` can still hold a later move the planner admitted

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:1090-1106`; `orchestrators/plugin/dependency-declaration-read.ts:179-215`
**Issue:** The planner reads a cold git dependent's declarations from its marketplace entry. If that dependent moves first, the runner clones its tree. The gate for the next move then reads the tree's own `plugin.json` (D-05-06: the own manifest outranks the entry). If that file names a stricter range, the runner holds a move that `pending` listed as `(will update)`. The next `pending` shows the hold, so the scope still settles. This comes from D-11's offline preview and is rare: it needs an entry and a `plugin.json` that disagree.
**Fix:** Document it beside IN-01. Or, when a move clones a tree that is a holder of a later move, take the planner's verdict again before running the later move.

### IN-08: Two small gaps that make the cause line or the result disagree

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/convergence.ts:500-507` and `213-220`
**Issue:**
- When a staying dependent's two copies name the target with different ranges, the cause line names the dependent twice, for example `required by "widget@mp", "widget@mp"`. A disjoint pair also reads as "the declared ranges admit no version in common", which looks like a conflict between two plugins.
- `withPlannedInstalls` skips a planned install whose declarations come back `unusable`, so it holds nothing. That fails open, while the scope walk fails closed (D-05-07). If the install still lands (the install cascade keeps its own entry fallback, D-01-07), `apply`'s fresh walk fails on the same record and plans no move at all. So `pending` listed moves that `apply` then skips, without a word.

**Fix:**
- In `describeConstraint`, name each holder key once.
- In `withPlannedInstalls`, return `NO_CONVERGENCE` when a planned install's read is `unusable` or `unreadable manifest`. Keep skipping it when it is `not in manifest`.

---

_Reviewed: 2026-10-25T00:54:22Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep (fix diff only)_

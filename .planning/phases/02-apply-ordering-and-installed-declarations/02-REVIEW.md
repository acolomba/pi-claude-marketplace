---
phase: 02-apply-ordering-and-installed-declarations
reviewed: 2026-10-27T00:00:00Z
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
  warning: 6
  info: 3
  total: 9
status: issues_found
---

# Phase 2: Code Review Report

**Reviewed:** 2026-10-27T00:00:00Z
**Depth:** standard
**Files Reviewed:** 27
**Status:** issues_found

## Structural Findings (fallow)

`fallow audit --changed-since d98660a7`: dead_code_issues 0, duplication_clone_groups 0, complexity_findings 23. All 23 come from the CRAP model, which this project switches off with `maxCrap: 0`. `npm run fallow` health passes with maxCognitive 15 / maxCyclomatic 20, and `npm run check` exits 0 on HEAD. Treated as resolved. No structural item is carried into the narrative findings.

## Narrative Findings (AI reviewer)

## Summary

I reviewed the diff `d98660a7..HEAD` for the 22 TypeScript sources and 5 feature files. The main areas were: the reordered apply driver (`convergeScope` / `installAfterMoves`), the D-PL2-02 planner changes (`withPlannedInstallsLanded`, `releasableDependents`, `verdictWithout`, `waitingOnInstalls`), the installed-copy reader (D-PL2-06/12/13), and the injected missing-dependency step in `marketplace add`, `bootstrap` and the autoupdate cascade (D-PL2-09/10).

The recorded decisions (D-PL2-01..16) and the "Uncertain choices" in the SUMMARYs are not reported as defects. The findings below are places where the code does not do what its own comments or decisions say:

- the judgement can run over a stale snapshot after a partial throw;
- `bootstrap` sends a post-commit dependency-step throw down its add-failure path;
- the D-PL2-13 containment wrapper swallows every I/O error, not only symlink refusals;
- the autoupdate step's one-row-per-dependency rule holds only per marketplace;
- the post-move read falls back to stale data and can duplicate rows;
- a waiting record's move is pulled out of the dependencies-first order without its enabled dependents.

I found no BLOCKER-level defect. Each WARNING needs an uncommon trigger: a GHB-03 throw in the middle of a run, a post-commit hygiene throw, an unusual file layout or permission fault, a dependency shared by two autoupdated marketplaces, or a lock contention. Each one still writes wrong state or reports wrong rows when it happens.

## Warnings

### WR-01: The judgement reads the pre-cascade snapshot when the step after the moves throws after it already changed the scope

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:1299-1304` (with `1243` and `1742`)
**Issue:** `after.landed` is set only after `applyDependencyInstalls` returns (`after.landed = satisfied;`), and it is raised for the waiting enables only after their whole loop finishes (`after.landed ||= enables.length > 0;`). `applyDependencyInstalls` rethrows `InvalidGitHubBaseUrlError` (GHB-03) through `handleCaughtInstallFailure`. Take an apply with two MISS-01 entries and no cascade step: the first entry installs, then the second throws GHB-03. `after.landed` stays `false` and `reports.length === 0`, so the `finally` block calls `judgeScopeAfterCascade` with `ran: false`. That function then judges `before.state` (line 1742), where the dependency is still missing. Under D-PL2-02 the toggle step deliberately left that dependent enabled, so `enabledHolds` returns it and `applyDependencyDisables` stamps `dependencyDisabled` on a plugin whose dependency was just installed. The same thing happens when the waiting-enable loop throws after one enable has landed. The wrong state persists until the next `apply` lifts the marker.
**Fix:** Record "something may have changed" before each mutating step, not after the loop. For example, mark the scope dirty as soon as the post-move steps start, so a throw cannot leave the judgement on the stale snapshot:

```ts
async function installAfterMoves(...): Promise<void> {
  const { after, scope } = run;
  const installs = ...;
  const bucket = installs ?? toggles.plan.pluginsToDependencyInstall;
  // Any attempted install or enable may have committed before a throw.
  after.landed = bucket.length > 0 || run.waiting.size > 0;
  const satisfied = await applyDependencyInstalls(opts, bucket, after.rows);
  ...
}
```

You could also have `judgeScopeAfterCascade` always reload state when `after.rows.length > 0`.

### WR-02: `bootstrap` reports a dependency-step throw as a failed add and skips autoupdate after a committed add

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/bootstrap.ts:118-124` (with `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts:1135-1164`)
**Issue:** `notifyAdded` now runs the injected step after the add has committed. If the step throws, the `finally` block emits `(added)` and the error leaves `addMarketplace`. In `bootstrapClaudePlugin` the whole `addMarketplace` call sits inside `try { … } catch (err) { notifyAddFailure(addOptions, err); return; }`, a catch that exists for add preconditions (ATTR-07, `rethrowPreconditionErrors`). A post-commit error now takes that path:

- If `classifyAddError` classifies it (for example an `ENOENT`/`ENOTDIR` errno from the install path's post-lock `settleAddedMarketplaces` / `collectPostCommitWarnings`, which maps to `source missing`), the user sees `claude-plugins-official (added)` and then `claude-plugins-official (failed) {source missing}` for the same, successful add.
- In every case, `setMarketplaceAutoupdate` is skipped even though the marketplace is now recorded. The bootstrap is left half done, and the error output does not say so.

For GHB-03 the error is rethrown to the handler, which is the documented behavior. The precondition catch is still the wrong owner for post-commit failures.
**Fix:** Keep the precondition catch around the add body only. One option is to return the step's failure from `addMarketplace` instead of throwing it, as `apply` folds failures into rows. Another is to have bootstrap tell the two cases apart:

```ts
let added = false;
try {
  await addMarketplace({ ...addOptions, onCommitted: () => { added = true; } });
} catch (err) {
  if (added) throw err;           // post-commit: not an add failure
  notifyAddFailure(addOptions, err);
  return;
}
```

A third option: catch non-GHB errors inside `notifyAdded` after the `(added)` row is sent, and turn them into a failed child row.

### WR-03: The D-PL2-13 candidate containment check swallows every I/O error, not only symlink refusals

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/dependency-declaration-read.ts:364-391`
**Issue:** `isAdmitted` catches every error from `assertPathInside` and returns `false`, and `readContainedCandidate` then returns `ABSENT`, which ends the candidate walk. `assertPathInside` rethrows every `lstat` error except `ENOENT` (`path-containment.ts:167-181`). So:

1. **`ENOTDIR` now ends the walk.** If an installed copy has a stray regular file `.claude-plugin` and a real root `plugin.json`, the `lstat` of `.claude-plugin/plugin.json` throws `ENOTDIR`, the check answers `ABSENT`, and the root `plugin.json` is never read. `readManifestCandidate` deliberately treats `ENOTDIR` as absence and moves on to the next candidate (its doc comment says "ENOENT and ENOTDIR mean absence"). This is a regression from that behavior.
2. **`EACCES` / `EIO` fail open.** Before, `readManifestCandidate` mapped such a fault to `UNUSABLE`, so the walk failed closed (D-05-07). Now it becomes `absent`, and `readInstalledRecordDeclarations` (`dependency-index.ts:390-392`) quietly falls back to the catalog declarations for the enable closure and the update preflight.

D-PL2-13 and the 02-04 Uncertain choice 1 decided that a *symlink refusal* answers `absent`. They did not decide this for permission or I/O faults, and the project rule is to fail closed on unreadable data.
**Fix:** Treat only containment refusals as refusals, and let the existing candidate reader classify everything else:

```ts
async function isAdmitted(parent: string, child: string, label: string): Promise<boolean | "error"> {
  try {
    await assertPathInside(parent, child, label);
    return true;
  } catch (err) {
    if (err instanceof PathContainmentError) return false; // symlink / traversal / outside
    const code = isErrnoException(err) ? err.code : undefined;
    return code === "ENOTDIR" ? true : "error";           // let readManifestCandidate decide
  }
}
// readContainedCandidate: false -> ABSENT; "error" -> UNUSABLE; true -> readManifestCandidate(...)
```

### WR-04: A bare `marketplace update` attempts and reports the same refused dependency once per autoupdated marketplace

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts:670-689` (loop at `325-343`)
**Issue:** `installAutoupdateDependencies` removes duplicates against `reported`, but that set is built only from *this marketplace's* cascade outcomes. `updateAllMarketplaces` runs `refreshOneMarketplace` once per target, and each run calls the step with a fresh `reported` set. Suppose a missing dependency is declared by one plugin of marketplace A and one of marketplace B, both with autoupdate on, and its install is refused. A's step tries it and renders `(failed)`. B's step re-reads the scope, still finds it in `pluginsToDependencyInstall`, and its `select` passes because a declarer is `…@B`. It tries the install again and renders a second `(failed)` row for the same dependency in the same command. That breaks the function's own contract ("so one command reports one row per dependency (D-PL2-01)") and doubles the attempt.
**Fix:** Pass one command-level `attempted: Set<string>` through `UpdateAllMarketplacesOptions` → `RefreshOneArgs`. Seed it from each cascade's `dependencyRows` and from each step's rows, and exclude its keys in `select`:

```ts
select: (install) => {
  const key = `${install.plugin}@${install.marketplace}`;
  return !args.attempted.has(key) && !reported.has(key) &&
    install.declarers.some((d) => d.endsWith(`@${name}`));
},
// after the step: for (const row of result.rows) args.attempted.add(row.name);
```

### WR-05: When the post-move read fails, MISS-01 falls back to the pre-move bucket and can report the failure twice

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:1295-1311` (and `1337-1349`)
**Issue:** When a cascade step ran, `installs` comes from `readPlainPlan(...)`. If that read throws, for example `StateLockHeldError` from a concurrent process or a state file that turned unreadable, `runScopeIsolated` pushes a `state.json` `invalid-block` row and `plan` is `undefined`. The `installs ?? toggles.plan.pluginsToDependencyInstall` fallback then runs MISS-01 from the *pre-move* bucket anyway. The doc comment says the opposite: "A read that fails becomes the `state.json` row and leaves the rest to the judgement". Then, if `satisfied || waiting.size > 0`, the second `readPlainPlan` usually fails the same way and pushes a second `state.json` row. Both rows go into `after.rows` → `outcomes`, and `buildReconcileAppliedCascade` merges them into one block with two failed cause children. `unreportedFailures` removes duplicates only between `failures` and `outcomes`, not inside `outcomes`.
**Fix:** Tell "no cascade step ran" apart from "the read failed", and stop when the read failed:

```ts
let bucket = toggles.plan.pluginsToDependencyInstall;
if (run.reports.length > 0) {
  const read = await readPlainPlan(reader, opts, scope, after.rows);
  if (read.plan === undefined) return;          // leave it to the judgement, one row
  bucket = read.plan.pluginsToDependencyInstall;
}
```

### WR-06: A waiting record's move leaves the dependencies-first cascade, but the moves of its enabled dependents stay in it

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:1444-1460` (with `1318-1327`)
**Issue:** `cascadeSteps` drops every move in `run.waiting` (`ready = moves.filter(m => !waiting.has(key))`), and `installAfterMoves` runs those moves later. `dependenciesFirst` can only order the steps that remain, so a non-waiting step that declares a waiting record now runs *before* that dependency's move. That breaks D-26's dependencies-first order. Such a step exists in this case:

- B is enabled.
- B declares A.
- A is marker-held (LOAD-02) and waits on a missing C.

`withPlannedInstallsLanded` releases B: A is released and is not independently disabled. So the toggle step keeps B enabled. B is already enabled, so it is not in `pluginsToEnable` and not in `enablesAfterInstalls`, which means it is not in apply's `waiting`. Now give both A and B catalog moves, with B's new version needing A's new version. B's converge runs while A is still at its old version and disabled, and A's move runs only after MISS-01. `pending` lists the moves dependencies-first (A before B), so `apply` can differ from what `pending` showed. B's move may fail or be held, depending on how the update runner treats the disabled dependency.
**Fix:** Close `waiting` over the cascade's dependents before you filter, so every move that declares a deferred move is deferred with it. Or keep the waiting moves in `cascadeSteps` and mark only their *enable* as deferred:

```ts
const deferredMoves = new Set(waiting);
let grew = true;
while (grew) {
  grew = false;
  for (const move of cascade.plan.moves) {
    const key = pluginKey(move);
    if (!deferredMoves.has(key) &&
        cascadeDependencies(cascade, key).some((dep) => deferredMoves.has(dep))) {
      deferredMoves.add(key); grew = true;
    }
  }
}
// filter by deferredMoves; installAfterMoves runs deferred non-waiting moves (no enable) in order after MISS-01
```

## Info

### IN-01: The update-constraint seam field name now points to the installed-copy walk

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-constraint-gate.ts:52,89`
**Issue:** `UpdateConstraintSeam.buildScopeDeclarationDetail` is typed `typeof buildInstalledScopeDeclarationDetail` and bound to it. A reader or a test double that sees the old name will assume the catalog-first walk, which is the exact difference D-PL2-06 introduced. The SUMMARY records this as deviation 4, but the name is misleading.
**Fix:** Rename the field to `buildInstalledScopeDeclarationDetail`, or to a neutral name such as `holderDeclarations`, and update the test doubles.

### IN-02: An unwrapped comment line of 135 characters

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/dependency-verdict.ts:39`
**Issue:** The rewritten WR-07 comment joins two sentences on one 135-character line. The rest of the block is wrapped at 80 to 100 characters, and Prettier does not reflow comments.
**Fix:** Re-wrap the paragraph.

### IN-03: The autoupdate step runs a full locked read on every `marketplace update` that has autoupdate on, and a refusal that persists turns each no-op into `(updated)`

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts:659, 941-943`
**Issue:** `installAutoupdateDependencies` always calls the step. The step always runs `readPlainPlanForScope`, a full locked read pass that includes `migrateFirstRunConfig`, even when the manifest did not change and every plugin is `unchanged`. If a dependency's install is refused every time, each later `marketplace update` turns `(skipped) {up-to-date}` into `(updated)` with the same `(failed)` child row. That follows from D-PL2-10 and D-PL2-11 as written, but the marketplace header then says "updated" when nothing in the marketplace changed.
**Fix:** Consider skipping the step when `!snapshot.changed` and every outcome is `unchanged`, unless a declarer of this marketplace has a missing dependency. Or render a refusal-only cascade with the `(skipped)` header and the failed child row. Record the choice in either case.

---

_Reviewed: 2026-10-27T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

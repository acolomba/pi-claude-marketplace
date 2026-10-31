---
phase: 05-marketplace-command-parity
plan: 06
subsystem: marketplace
tags: [marketplace-add, errno, repair, orchestrated-outcome, cucumber]
status: complete

requires:
  - phase: 05-marketplace-command-parity
    provides: "05-04 newMarketplaceName(..., source) and ReservedMarketplaceNameError"
provides:
  - "fsErrnoReason(code) in orchestrators/marketplace/shared.ts, used by narrowCascadeFailure and by add.ts errorAddReason"
  - "D-PL5-17 repair: a standalone re-add of a github or url marketplace whose checkout is gone re-clones it through addMarketplaceToState with `previous` (expected-name mode)"
  - "RecordedNameMismatchError (module-local in add.ts), classified `source mismatch`"
  - "D-PL5-16 orchestrated catch-all: narrowProbeError(withoutCleanupLeaks(err))"
  - "D-PL5-19: UnchangedAdd status from the standalone RecordedSourceStep; runOrchestratedAdd runs runAddOutcome<never> without the step"
  - "Steps: `the manifest of the marketplace {string} to add is a directory` (add.steps.ts), `the {word} scope has lost the checkout of the marketplace {string}` (checkout.steps.ts); `the published source of the marketplace {string} is removed` moved to publishing.steps.ts"
affects: [marketplace add, bootstrap, apply, import, install-time marketplace add]

# commits is measured over plan_head_before..plan_head_after. It counts 8:
# this plan's 5 commits plus 3 commits of plan 05-05, which ran in parallel
# in the same tree (efa4fe44, db2a11df, 3b6ebde0). The SUMMARY commit is not
# counted.
actuals:
  tokens: 10800
  tasks: 3
  commits: 8
plan_head_before: 91042493
plan_head_after: 456ca319c8cb530022b8042b79d9fc094e3da264

tech-stack:
  added: []
  patterns:
    - "A step that only one mode may run is passed as a callback. The other mode passes none and instantiates the body's type parameter as `never`, so its outcome type excludes the step's results by construction, with no filter branch"
    - "A repair re-runs the fresh-add body with the record it replaces (`previous`): the name check requires that name and skips MA-8 for it, and a record spread keeps source, cwd, and plugins"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
    - test/orchestrators/marketplace/shared.test.ts
    - test/orchestrators/marketplace/add.test.ts
    - test/orchestrators/plugin/bootstrap.test.ts
    - test/integration/auth-e2e.test.ts
    - features/step_definitions/marketplace/add.steps.ts
    - features/step_definitions/marketplace/checkout.steps.ts
    - features/step_definitions/marketplace/update.steps.ts
    - features/step_definitions/marketplace/publishing.steps.ts
    - features/marketplace/failed-add.feature
    - features/marketplace/add.feature

key-decisions:
  - "D-PL5-17 expected-name mode is the optional `previous` record on addMarketplaceToState, threaded to the clone body. Plan 05-07 makes hosted repairable by adding `hosted` to repairableSource's kinds and passing `previous` to its hosted body; there is no second repair path"
  - "D-PL5-19 shape: redeclareRecordedSource is a RecordedSourceStep<UnchangedAdd> callback. The standalone entry passes it; runOrchestratedAdd passes none (runAddOutcome<never>), so its declared Promise<AddMarketplaceOutcome> is the WR-01 proof and also rejects the no-op"
  - "The target-layer duplicate refusal runs before the repair check, so a layer that declares the name with another source still refuses as `duplicate name` and nothing is cloned"

requirements-completed: [MKT-07]

duration: ~110min
completed: 2026-10-27
---

# Phase 5 Plan 06: marketplace add classification gaps Summary

`marketplace add` now reads a manifest that is a directory as `(failed) {unreadable}` through the errno mapping `list` and `info` use. A re-add repairs a github or url marketplace whose checkout is gone and keeps its installed plugins. A re-add of a dir or file marketplace whose manifest is gone fails `{source missing}`. `apply` and `import` can tell a malformed manifest from a crash, and the no-op add has its own internal status that the orchestrated outcome cannot hold.

## Commits

| Task | Commit | Title |
| ---- | ------ | ----- |
| 1 | `2810fe22` | fix(marketplace): read a manifest that is a directory as unreadable |
| 2 (step move, D-08) | `e41cf496` | test(marketplace): share the step that removes a published source |
| 2 | `715ccba5` | fix(marketplace): repair a marketplace whose checkout is gone on re-add |
| 2 (regression fix) | `1789704a` | test(plugin): seed the checkout of an already bootstrapped marketplace |
| 3 | `456ca319` | fix(marketplace): tell a crash from a malformed manifest on apply |

## Accomplishments

- **D-PL5-18:** `fsErrnoReason(code)` is the one errno switch (EACCES/EPERM, ENOENT/ENOTDIR, EBADF/EIO/EISDIR). `narrowCascadeFailure` calls it and keeps its `not in manifest` fallback. `errorAddReason` keeps only its `source missing` and `unreadable` results, so a write-side EACCES still rethrows in standalone mode (MPA-02). `case "EISDIR"` appears once.
- **D-PL5-17:** `redeclareRecordedSource` checks the one matched record on disk. A github or url record whose `marketplaceRoot` is gone returns a `repair` action. `runAddInGuard` then runs `addMarketplaceToState` with `previous: record`, which uses the normal staging, marker, leftover recognition, and rename. The reserved-name check still runs. MA-8 is skipped for the expected name only. Another declared name throws `RecordedNameMismatchError` before the rename, so the MA-9 catch cleans staging and the record stays byte-identical. The record keeps `source`, `scope`, `addedFromCwd`, and `plugins`, and takes new `manifestPath`, `marketplaceRoot`, `lastSuccessfulManifest`, and `lastUpdatedAt`. The config declaration is written only when the target layer lacks it. The save runs under the WR-07 catch, now extracted as `saveAddedMarketplace`, so a failed save removes the new checkout. The result is `(added)` and settles as a fresh add does. A path record whose recorded manifest is gone throws an ENOENT error, which reads `source missing`.
- **D-PL5-16:** the orchestrated catch-all reason is `narrowProbeError(withoutCleanupLeaks(err))`. `error` and `cause` stay on the outcome, and the GHB-03 rethrow and the standalone rethrow are unchanged. The `AddMarketplaceOutcome` and `handleAddFailure` doc comments were rewritten to match.
- **D-PL5-19:** the `already added` arm returns `{ status: "unchanged" }` (`UnchangedAdd`). `addMarketplace` dispatches orchestrated mode to `runOrchestratedAdd` and standalone mode to `runAddOutcome(opts, redeclareRecordedSource)`. There is no unreachable branch and no `!` or `as`. A `@ts-expect-error` line in add.test.ts proves that `AddMarketplaceOutcome` rejects the no-op. Nothing in `orchestrators/reconcile/`, `orchestrators/import/`, or `bootstrap.ts` changed.
- Scenarios: `failed-add.feature` "Adding a marketplace whose manifest is a directory fails as unreadable and leaves nothing behind". `add.feature` Outlines "Adding again a marketplace whose checkout is gone restores it and keeps its installed plugins" (`@url`, `@github`) and "Adding again a local marketplace whose manifest is gone fails as source missing" (dir, file). All of them fail on the old add.ts: a raw EISDIR exception, and `(skipped) {already added}` for the 4 Outline rows.

## Verification

- `node --test test/orchestrators/marketplace/{add,shared}.test.ts`: pass. `test/orchestrators/{reconcile,import,marketplace}` plus the install and bootstrap suites: pass.
- `npm run test:coverage:direct -- marketplace/shared.ts marketplace/add.ts`: 100%, exit 0.
- `npx cucumber-js features/marketplace/{failed-add,add,update,file-source-update}.feature`: pass.
- Full `npm run check` on the final tree in a private worktree (stages split across two runs: static, then unpaired, integration, all 917 cucumber scenarios, and `test:coverage:direct:all`): all green after the two test fixes below.
- Acceptance greps: `export function fsErrnoReason` 1; `fsErrnoReason(` in add.ts 1; `case "EISDIR"` in shared.ts 1; `reason: "unparseable"` in add.ts 0; `narrowProbeError(withoutCleanupLeaks(` 1; the moved step 0 in update.steps.ts and 1 in publishing.steps.ts; `has lost the checkout of the marketplace` 1; `checkout is gone` 1. `npx fallow health --fail-on-issues` and `npm run fallow` exit 0.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The bootstrap owner suite seeded an added marketplace with no checkout**
- **Found during:** Task 3 verification (the full suite run after Task 2 was committed)
- **Issue:** `seedAddedMarketplace` in `test/orchestrators/plugin/bootstrap.test.ts` recorded the official marketplace without `sources/claude-plugins-official/`. With D-PL5-17, bootstrap's add repairs that marketplace (`(added)` plus a clone) instead of `(skipped) {already added}`, so 3 cases failed. The commit hook did not catch it, because it covers staged pairs only.
- **Fix:** the seed creates the checkout directory, and `seededScopeTree()` lists it.
- **Committed in:** `1789704a`

**2. [Rule 1 - Expected behavior change] Tests that pinned the old catch-all and errno tokens**
- `test/orchestrators/marketplace/add.test.ts` "cleans a URL clone after state-save failure and a second invocation converges" (Task 1): the save's EISDIR now reads `(failed) {unreadable}` instead of a raw rethrow. The expectation was updated, and the cleanup and convergence assertions are unchanged.
- `test/integration/auth-e2e.test.ts` "orchestrated print marketplace add retains the typed refusal and cleans staging" (Task 3): `DeviceFlowUnavailableError` is unclassified, so D-PL5-16 makes it read `unreadable`, not `unparseable`. That is outside the plan's files; committed with Task 3 (`456ca319`).

**3. Pitfall 7 `prototypeReads` pins:** re-derived, not changed. The counts stay 6 (the duplicate-name exotic throw is classified before the catch-all) and 3 (the MA-9 catch normalizes the exotic value into a plain `Error` before `narrowProbeError` sees it). Both assertions are kept.

**4. Order of the repair check:** the plan puts the repair before both existing branches. The target-layer duplicate refusal (declared with another source) runs first, then the repair, then `already added` or declare. This way a conflicting declaration never triggers a clone.

---

**Total deviations:** 2 auto-fixed test regressions, 1 measurement note, and 1 ordering choice. No scope creep.

## Uncertain Choices

- **D-PL5-16 vs the MPA-02 truth:** in orchestrated mode, an unclassified EACCES or EPERM (for example a refused state write) now reads `permission denied`, because `narrowProbeError` maps those codes ("or its errno token", D-PL5-16). Standalone mode still rethrows such an error, and `errorAddReason` still drops the `permission denied` result, so no add row reads it. The plan's truth that `marketplace add` "never maps a state or config write's EACCES to `permission denied`" holds for the classifier and the standalone row. It does not hold for the orchestrated catch-all, which follows D-PL5-16 literally. Worth a reviewer's look.
- **Install path:** `install-outcome.ts::recordAsInstallFailure` uses `classifyAddError`. Through the shared mapping, an EISDIR, EIO, or EBADF during the install-time marketplace add now becomes `InstallMarketplaceAddError("unreadable")` instead of propagating raw. This matches what the explicit add shows.
- **Mismatch subject:** a `{source mismatch}` row names the typed source, as every failure before a name is recorded does. The record name is in `RecordedNameMismatchError.expectedName`.
- `addPathInGuard` ignores `previous`; a path record is never repaired, and its doc comment says so.

## Files outside the ROADMAP Files line

Test-only, as the plan names them: `features/step_definitions/marketplace/{add,checkout,update,publishing}.steps.ts`, `features/marketplace/{failed-add,add}.feature`. Also `test/orchestrators/plugin/bootstrap.test.ts` (regression fix, Deviation 1) and `test/integration/auth-e2e.test.ts` (expected token change, Deviation 2).

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-05-08 is mitigated: the name must match before the rename, the record keeps its source and plugins, staging is cleaned by MA-9 and the final checkout by WR-07, and writes stay under `sourceCloneDir` (PS-1). T-05-09 is mitigated: EISDIR, EIO, and EBADF render a closed-set `{unreadable}` row.

## Self-Check: PASSED

Commits 2810fe22, e41cf496, 715ccba5, 1789704a, and 456ca319 are ancestors of HEAD. Every modified file listed above exists.

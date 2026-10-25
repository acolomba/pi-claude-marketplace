---
phase: 19-import-on-the-reconcile-path
reviewed: 2026-10-23T00:00:00Z
depth: standard
files_reviewed: 14
files_reviewed_list:
  - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
  - extensions/pi-claude-marketplace/shared/notification-types.ts
  - extensions/pi-claude-marketplace/shared/notification-wire.ts
  - extensions/pi-claude-marketplace/shared/notify-reasons.ts
  - docs/output-catalog.md
  - features/plugin/import.feature
  - test/orchestrators/import/execute.test.ts
  - test/architecture/catalog-uat/catalog-contract.test.ts
  - test/architecture/catalog-uat/catalog-parser.test.ts
  - test/architecture/catalog-uat/catalog-wire.test.ts
  - test/architecture/catalog-uat/fixtures/plugin-import.ts
  - test/architecture/compat-01-no-expansion.test.ts
  - test/architecture/notify-closed-set-locks.test.ts
  - test/shared/notification-types.test.ts
findings:
  critical: 1
  warning: 4
  info: 4
  total: 9
status: issues_found
---

# Phase 19: Code Review Report

**Reviewed:** 2026-10-23
**Depth:** standard (with the reconcile planner, the enable operation, and the add operation traced)
**Files Reviewed:** 14
**Status:** issues_found

## Summary

I reviewed the uncommitted diff that moves `/claude:plugin import` onto reconcile's read-pass and plan path. The lock-held read pass, the `StateLockHeldError` arm, the `(skipped) {already added}` header, and the new reason enrollment are correct. They match D-01, D-05, D-08, and D-09. The suite passes (76/76 in `execute.test.ts`).

One defect destroys data. The source-claim path (D-07) installs a plugin under the recorded marketplace name. The config post-pass then declares that plugin under the recorded name as well. The config declares only the settings name, so the next reload plans an uninstall of the plugin that the import just installed. I reproduced this against the real planner. The other findings come from three places: the planner gets no satisfaction verdict, `recordedMarketplaceName` re-derives the source claim with different rules from the planner's, and two rows report the wrong thing.

## Critical Issues

### CR-01: A source-claimed install is declared under the recorded name, so the next reload uninstalls it

**File:** `extensions/pi-claude-marketplace/orchestrators/import/execute.ts:1339`, `:1597-1606`, `:1626-1646`, `:1545`
**Issue:** `applyPlannedPlugins` rewrites `plugin.ref.marketplace` to the recorded name (line 1339). Every outcome built from it (installed, skipped, enabled) carries that recorded name. The post-pass keys config entries by `${installed.plugin}@${installed.marketplace}` (1602), by `skipped.marketplace` (1631, 1645), and, for the local stamp, by the same recorded key (1545). Under a source claim, the config declares the *settings* name, and reconcile maps that name to the recorded one through `recordedByDeclared`. A key under the recorded name is dangling there.

**Scenario (reproduced):** the config declares `mp` with source `./mp`. This is what a first import writes when the manifest names the marketplace `recorded-mp`. The state records `recorded-mp` with `./mp`, and the settings enable `plugin@mp`. The import installs `plugin@recorded-mp` and writes `{"marketplaces":{"mp":…},"plugins":{"plugin@recorded-mp":{}}}`. Feeding that config and the new record to `planReconcile` gives `pluginsToUninstall: [plugin@recorded-mp]` plus a `dangling-reference` mismatch. The next `/reload` uninstalls the plugin that the import reported as `(installed)`. The same root cause causes two more problems:
- The D-06 enable writes `plugin@recorded-mp: {enabled:true}`, while the user's `plugin@mp` entry stays as it was.
- The WR-01 repair drops silently for a claimed marketplace. `rawSourceByName` is keyed by settings name, so `rawSourceByName.get("recorded-mp")` is `undefined`. `declaresMarketplaceOf("recorded-mp")` is also false. So a recorded-but-undeclared claimed marketplace is never repaired, and reconcile then removes it.

The D-07 unit test (`test/orchestrators/import/execute.test.ts:4545`) never asserts the config file, so it does not catch this.
**Fix:** Keep the settings name for config purposes, and keep the recorded name only for the state operations and the row grouping. For example, carry `declaredMarketplace` on `PluginInstalledOutcome`, `PluginSkipOutcome`, and `MarketplaceSkipOutcome`. (`ref` already holds `plugin@mp`.) Then key the ensure, repair, and local-stamp patches by it:
```ts
const key = installed.ref; // settings key "plugin@mp", not `${plugin}@${recordedName}`
setOwn(plugins, key, installed.reenabled === true ? { enabled: true } : {});
// repair: rawSourceByName.get(skipped.declaredMarketplace), setOwn(marketplaces, skipped.declaredMarketplace, …)
```
Add a unit case that seeds a config which declares the settings name over a claimed record. It should assert the written config bytes and that `planReconcile` over them plans no uninstall.

## Warnings

### WR-01: Without a satisfaction verdict, import enables a record the load-time check holds down, and the next reload disables it again

**File:** `extensions/pi-claude-marketplace/orchestrators/import/execute.ts:1231`, `:1348-1350`
**Issue:** `planReconcile(desiredConfigFor(scopePlan), tx.state, scope)` defaults to `NO_HELD_DECLARERS`. So `classifyDeclaredPlugin`'s D-06-03 guard (`isHeldByUnsatisfiedDependency`) never fires, and a consequence-disabled record (`dependencyDisabled: true`, dependency still unsatisfied) lands in `pluginsToEnable`. The orchestrated enable skips the enable cascade (`resolveEnableCascadeStep` returns `skipped` when `orchestrated`). It re-materializes the root with its dependency still missing, and import reports `(installed)` with `/reload to pick up changes`. On that reload, reconcile's real verdict plans `pluginsToDependencyDisable` for the record again. This is the oscillation that LOAD-02 / D-06-03 forbid. Before this change, import reported a stable `skipped {already installed}` here.
**Fix:** Compute the verdict inside the locked read pass, the way `reconcile/apply.ts::readPassForScope` does, and pass it to `planReconcile`. Or, at minimum, route a record with `dependencyDisabled === true` to the skip row and not to the enable.

### WR-02: `recordedMarketplaceName` re-derives the source claim with rules that differ from the planner's

**File:** `extensions/pi-claude-marketplace/orchestrators/import/execute.ts:891-900`, `:1286`, `:1301-1302`
**Issue:** The planner (`recordedSourceCandidates` / `resolvePendingClaims`) claims a recorded marketplace only when exactly one *undeclared* record has the same source. The import helper takes the first record in insertion order with the same source. It does not exclude names that the desired config declares, and it does not check uniqueness. It is also computed for marketplaces in `marketplacesToAdd` and for blocked ones, then stored in `usable`. Here is one way it diverges: the settings declare `X(S)` and `Y(S)`, and the state records `Y(S)` and `Z(S)`. The planner claims `Z` for `X` and plans `p@Z` for install. The import maps `X` to `Y`, so `p@Y` is in neither `installKeys` nor `enableKeys`. It has no record under `Y`, so it falls into `pushAlreadyInstalled`. A plugin that is not installed is then reported `skipped {already installed}`, never installed, and repaired into the config. Separately, a successful add of `X` (manifest renamed upstream) routes `X`'s plugins to `Y`.
**Fix:** Do not duplicate the claim. Have the planner expose its `recordedByDeclared` map on the plan (a pure addition to `plan.ts`/`types.ts`) and read it. If `plan.ts` must stay untouched, compute the recorded name only in the skip arm, and apply the planner's rule there: exclude the desired-config names and require exactly one candidate.

### WR-03: An enable that finds the record gone is reported as `already installed` and repaired into the config

**File:** `extensions/pi-claude-marketplace/orchestrators/import/execute.ts:1079-1082`
**Issue:** `EnableDisablePluginOutcome`'s `skipped` arm carries `reason: "already enabled" | "already disabled" | "not installed"`. All three fold into `pushAlreadyInstalled`. If another process uninstalls the plugin between the read pass and the enable (the D-09 window), the row reads `skipped {already installed}` for a plugin that is not installed. `buildRepairPatchForScope` then declares it.
**Fix:** Branch on `outcome.reason`. For `"not installed"`, either fall through to `installOnePlannedPlugin` or render a failed or unavailable row. Keep `pushAlreadyInstalled` for `"already enabled"` only.

### WR-04: Planner conflict mismatches render a false "does not match" cause

**File:** `extensions/pi-claude-marketplace/orchestrators/import/execute.ts:862-864`
**Issue:** `diffMarketplaces` reports both a source claim that is ambiguous and one claimed by several declarations as `cause: "source-mismatch"`, with `recordedSource` set to prose such as `ambiguous recorded marketplaces: a, b`. `recordPlannedMismatch` interpolates that prose into `Existing marketplace source ambiguous recorded marketplaces: a, b does not match Claude settings source ./mp.` The sources do match; the real problem is that the claim is ambiguous. Before this change, this input reached `addMarketplace` and failed with its own classified cause.
**Fix:** Tell the claim conflicts apart from a real mismatch. One way is a distinct planner cause. Another is to check `ownValue(read.state.marketplaces, marketplace.marketplace) === undefined`, which holds only for a conflict. Then render a cause that names the ambiguous recorded marketplaces.

## Info

### IN-01: The WR-04 invariant comment no longer describes the key derivation

**File:** `extensions/pi-claude-marketplace/orchestrators/import/execute.ts:409-418`
**Issue:** The comment says the rows and headers share keys because both come from `scopePlan.pluginsToInstall` and `marketplacesToEnsure`. Row keys now come from the `usable` map (`recordedMarketplaceName`) and header keys from `recordedName` or `marketplace.marketplace`. The invariant that rules out a headerless row now rests on those two staying in step (see WR-02).
**Fix:** Restate the invariant in terms of `ensurePlannedMarketplaces`' `usable` map.

### IN-02: An unexpected throw from the enable operation aborts the whole import

**File:** `extensions/pi-claude-marketplace/orchestrators/import/execute.ts:1045`
**Issue:** `installOnePlannedPlugin` catches a throw, rethrows only the invalid GitHub base, and records the rest as a row. `enableOnePlannedPlugin` has no catch. Any other throw skips the cascade notify and the config post-pass for entries that already committed to state. Those records are then undeclared, and reconcile tears them down.
**Fix:** Give it the same `try`/`rethrowInvalidGitHubBaseUrl`/`pushUnexpectedFailure` shape as the install arm.

### IN-03: Weak points in the new unit tests

**File:** `test/orchestrators/import/execute.test.ts:4278`, `:4628`, `:4545`
**Issue:**
- At line 4278, the expected `causeChain` is the actual object (`failure.causeChain`), so that field compares to itself. Only the separate message check and the rendered text pin it.
- At line 4628, the production enable case reuses `seedDisabledDependencyRecord` for a record that is not a dependency, which is misleading.
- `D-06`/`D-07` in the titles are phase-local IDs. They collide with the unrelated `D-03/D-06` severity anchors in the same module.
- The D-07 case (4545) asserts no config outcome; see CR-01.
**Fix:** Build the expected chain literally, rename the helper (for example, `seedDisabledRecord`), and assert the config bytes in the D-07 case.

### IN-04: Two blank lines before the first new scenario

**File:** `features/plugin/import.feature:300-301`
**Issue:** Two blank lines separate the scenarios here; one separates them everywhere else in the file.
**Fix:** Remove one blank line.

---

_Reviewed: 2026-10-23_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

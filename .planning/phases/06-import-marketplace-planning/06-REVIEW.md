---
phase: 06-import-marketplace-planning
reviewed: 2026-10-27T00:00:00Z
depth: standard
files_reviewed: 22
files_reviewed_list:
  - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
  - extensions/pi-claude-marketplace/orchestrators/import/marketplaces.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts
  - features/lib/field-rows.ts
  - features/lib/published-marketplace.ts
  - features/lib/run-tokens.ts
  - features/step_definitions/plugin/publishing.steps.ts
  - features/plugin/import.feature
  - features/plugin/apply.feature
  - features/plugin/install-rollback.feature
  - test/orchestrators/import/execute.test.ts
  - test/orchestrators/import/marketplaces.test.ts
  - test/orchestrators/plugin/enable-disable.test.ts
  - test/orchestrators/plugin/install-flow.test.ts
  - test/orchestrators/reconcile/apply-outcomes.test.ts
  - test/orchestrators/reconcile/apply.test.ts
  - test/orchestrators/reconcile/notify.test.ts
  - test/orchestrators/reconcile/plan.test.ts
findings:
  critical: 1
  warning: 2
  info: 5
  total: 8
status: issues_found
---

# Phase 6: Code Review Report

**Reviewed:** 2026-10-27
**Depth:** standard
**Files Reviewed:** 22 (the config lists 23 paths; `test/orchestrators/reconcile/{apply-outcomes,apply,notify,plan}.test.ts` was expanded)
**Status:** issues_found

## Summary

I reviewed the diff `f6df1885^..HEAD` against D-PL6-01..14 and the project conventions. Most of the work is correct:

- The rollback-row plumbing (D-PL6-03/04/05/11/12) redacts every phase cause in both import and apply.
- The cascade member's partials reach the orchestrated outcome. The GHB-03 rethrow gate already counts them through `capture`, so they are not lost.
- `aliasedScopePlan` rewrites both `marketplace` and `raw`.
- The planner's enable bucket names the recorded marketplace, so `enableKeys` matches the aliased refs.
- `marketplaceSourceClaims` is the planner's own rule.
- The feature fixture restores write permission before every removal. All three sandbox roots and the published marketplace root (under HOME) are covered.

The main defect is in the D-PL6-02 alias: the claim map is computed only from the import settings. It ignores the scope's existing `claude-plugins.json`. So it rewrites a config that is already a reconcile steady state into one that no longer converges. Two smaller decision gaps follow: the "settings do not declare that name" test reads only the planned subset of the settings, and a conflicted claim's cause line is wrong.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Alias post-pass breaks a config that already declares the settings name

**File:** `extensions/pi-claude-marketplace/orchestrators/import/execute.ts:1469` (claims), `:1521-1543` (`aliasedScopePlan`), `:1892-1924` (`buildRepairPatchForScope`), `:1954-1981` (`mergeEnsureAndRepairs`)

**Issue:** `readPassForImport` builds the claim map from `desiredConfigFor(scopePlan)`, which holds only the Claude settings. It never consults the scope's own `claude-plugins.json`. The project's Key Decision ("Reconcile aliases through one-to-one source claims while preserving the manifest-derived canonical state name") makes this state a normal steady state:

- the config declares `X` (source `S`) and `p@X`;
- the state records the marketplace under its manifest name `Y` (source `S`).

`apply` reaches it every time a user hand-writes the settings' marketplace name into `claude-plugins.json`. Now run `import` with Claude settings that name `X`/`S` and `p@X`:

1. The settings claim `X -> Y`, and the plan is aliased to `Y` and `p@Y`.
2. `Y` is reported `(skipped)`. `buildRepairPatchForScope` adds `Y: {source: S}`, and `mergeEnsureAndRepairs` writes it because the config lacks the key `Y`. The same happens for `p@Y`.
3. The config now declares both `X` and `Y` with source `S`, plus `p@X` and `p@Y`. In the planner, `recordedSourceCandidates` skips every declared name, so `Y` is no longer a candidate for `X`. `diffMarketplaces` then plans **add X**, and the plugin diff plans **install p@X** under a marketplace that is not recorded.

The next load shows pending changes. `apply` re-clones `S`, whose manifest name collides with the recorded `Y`, and fails on every run until the user edits the config by hand. Before this phase, D-07 attempted the add, failed it as a duplicate, and wrote nothing. This change turns a failed row into a persisted config divergence. `stampReenabledWhereLocalDeclares` has the same blind spot: it looks for a local `p@Y` key, so a local `p@X: {enabled: false}` stays in place while the base config gets `p@Y: {enabled: true}`.

No unit test or scenario seeds a config that declares the settings name. The MIM-01 tests all start from an empty `claude-plugins.json`.

**Fix:** Before the repair, skip the alias when the loaded config already declares the settings name and that declaration claims the same record. Keep the plan's names in that case. In the post-pass, under the lock, read the merged config and drop each aliased repair whose recorded name the config already reaches through a claim:

```ts
// in writeBatchedConfigForScope, after loading `current`:
const configClaims = marketplaceSourceClaims(
  mergedMarketplacesOf(current),          // the scope's merged base+local view
  stateMarketplacesSnapshot,              // the read pass's tx.state.marketplaces
);
const claimedByConfig = new Set(configClaims.values());
// drop repair.marketplaces[Y] and repair.plugins[`*@${Y}`] when claimedByConfig.has(Y)
// and the config declares the settings name itself; declare plugins under the
// config's own name instead (p@X), which the planner already aliases.
```

A simpler fix that fails closed: in `readPassForImport`, also load the scope's merged config. When it declares a name that maps (by name or by claim) to the same recorded marketplace as a settings claim, drop that claim from `read.claims`. Then add a unit test that seeds `claude-plugins.json` with `{X: S, p@X}` and state with `Y: S`, runs import, and asserts that `planReconcile` on the resulting merged config is still empty.

## Warnings

### WR-01: "Settings do not declare that name" is checked against the planned subset, not the settings

**File:** `extensions/pi-claude-marketplace/orchestrators/import/execute.ts:1467-1469`, `extensions/pi-claude-marketplace/orchestrators/import/marketplaces.ts:137-141`

**Issue:** D-PL6-02 allows the alias only "when the settings do not declare that name themselves". `marketplaceSourceClaims` excludes candidates by `desired.marketplaces`, which `desiredConfigFor` builds from `marketplacesToEnsure`. Two kinds of settings entry are not in that list:

- an unmappable `extraKnownMarketplaces` entry (for example a nested `file` source), which goes to `unmappableMarketplaces`;
- an unreferenced `claude-plugins-official` entry (D-PL6-08).

If the settings declare `Y` in one of those forms, and another settings entry `X` has the source the scope records under `Y`, then `X` still claims `Y`. Import then reports `Y (skipped) {already added}`, installs `p@X` as `p@Y`, and declares `Y` with `X`'s source. Meanwhile the settings' own `p@Y` refs get an `unmappable-marketplace-source` warning. The comment on `aliasedScopePlan` ("a recorded name is never a settings name") is false in this case.

**Fix:** Pass the full settings key set into the claim exclusion. For example, filter out any claim whose recorded name is a key of `scopePlan`'s raw `extraKnownMarketplaces`, or one any enabled ref names:

```ts
const settingsNames = new Set([
  ...Object.keys(settings.extraKnownMarketplaces),
  ...refs.map((ref) => ref.marketplace),
]);
claims: new Map(
  [...claims].filter(([declared, recorded]) => declared !== recorded && !settingsNames.has(recorded)),
),
```

To make this possible, thread the settings names onto `ScopedImportPlan`.

### WR-02: A conflicted claim's cause says the source does not match when it matches two records

**File:** `extensions/pi-claude-marketplace/orchestrators/import/execute.ts:1022`

**Issue:** D-PL6-09 now sends conflicted claims through `recordPlannedMismatch`, whose `source-mismatch` arm builds `Existing marketplace source ${mismatch.recordedSource} does not match Claude settings source ${marketplace.source}.` For a conflict, `recordedSource` is planner prose (`ambiguous recorded marketplaces: first-mp, second-mp` or `recorded marketplace claimed by multiple declarations: actual`). The user sees `Existing marketplace source ambiguous recorded marketplaces: first-mp, second-mp does not match Claude settings source ./mp.` That sentence is ungrammatical, and it is also false: the source matches, and the fault is that it matches more than one record. The unit tests at `test/orchestrators/import/execute.test.ts:5278` and `:5328` lock this wording in. For an unreferenced entry this cause is the only explanation the user gets (D-PL6-09).

**Fix:** Tell a conflict apart from a real mismatch. The planner's conflict entries can be recognized because `marketplace` is not recorded. Better, expose a typed conflict kind from `buildMarketplaceClaims`. Then word the cause for what happened:

```ts
const cause = ownValue(read.state.marketplaces, marketplace.marketplace) === undefined
  ? `Claude settings source ${marketplace.source} matches more than one recorded marketplace (${mismatch.recordedSource}).`
  : `Existing marketplace source ${mismatch.recordedSource} does not match Claude settings source ${marketplace.source}.`;
```

## Info

### IN-01: An unreferenced source mismatch has no `{source mismatch}` brace and counts as two failures

**File:** `extensions/pi-claude-marketplace/orchestrators/import/execute.ts:1024-1032`

**Issue:** The D-PL6-09 arm records the mismatch as `reason: "add-failed"`, and `marketplaceFailureReasons` maps that to `[]`. So the block reads `tools (failed)` with a bare child row and `Import: 2 failures` for one marketplace. A referenced mismatch reads `{source mismatch}`. No add was attempted, so the internal `add-failed` kind mislabels the outcome. This follows the decision text and reuses the WR-06 shape, but the two mismatch rows disagree on their reason.

**Fix:** Consider adding a `"source-mismatch"` member to `MarketplaceFailureOutcome["reason"]` that maps to `["source mismatch"]`.

### IN-02: A shared failing dependency can produce two rows with the same name in one block

**File:** `extensions/pi-claude-marketplace/orchestrators/import/execute.ts:628-652`, `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:550-556`

**Issue:** When two requested plugins in the same marketplace depend on the same dependency, and that dependency's undo fails, each install retries it. Each failure then adds its own `lib@mp (failed) {rollback partial}` row (import) or `lib (failed)` row (apply). Nothing dedupes or tells the rows apart. `install` never shows this, because it runs one request per command.

**Fix:** Accept this as two real attempts, or dedupe by key and keep the first row.

### IN-03: Apply puts the dependency's rollback row after the requested row, unlike its moved-dependency rows

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:552-556`

**Issue:** `applyPluginInstalls` pushes `movedDependencyOutcomes` before the requested plugin's row, and `buildReconcileAppliedCascade` keeps insertion order within a block. `installFailedOutcomes` returns `[requested, dependency]`, so the test at `test/orchestrators/reconcile/apply.test.ts:2540` renders `hello` before `bar`. Install and import sort these two rows by name.

**Fix:** Return `[dependencyRollbackOutcome(...), requested]` so dependency rows come first, as the moved rows do.

### IN-04: `enableDegradation` restates part of `degradationFromEnable`

**File:** `extensions/pi-claude-marketplace/orchestrators/import/execute.ts:1208-1216`

**Issue:** These are the first three spreads of `orchestrators/plugin/shared.ts::degradationFromEnable`, which `reconcile/apply.ts:975` still uses. If a degradation fact is added to one, the other can silently miss it.

**Fix:** Derive the narrowed value from the shared helper, for example by destructuring away `stagedAgents`, `stagedMcpServers`, and `stagedWorkflows` from `degradationFromEnable(outcome)`.

### IN-05: The install-rollback scenario uses a literal errno message, while the other new scenarios use the error token

**File:** `features/plugin/install-rollback.feature:76`

**Issue:** The import and apply scenarios match the undo cause through `{read-only skill directory removal error}`, which the step reads back from the running Node (D-PL6-14). The install scenario spells out `EACCES: permission denied, unlink '{project dir}/.../data.txt'`. The summaries show this was checked only on local Node 26, and CI runs Node 24. libuv's unlink message most likely carries the path on both versions, so this is probably fine. Still, the scenario depends on wording that no step measures.

**Fix:** Record the uncut message as a second token in the fixture step and use it here.

---

_Reviewed: 2026-10-27_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

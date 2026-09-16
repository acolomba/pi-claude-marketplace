---
phase: 04-install-provenance
reviewed: 2026-09-16T15:09:37Z
depth: standard
files_reviewed: 67
files_reviewed_list:
  - docs/dependency-resolution.md
  - docs/output-catalog.md
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-record.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts
  - extensions/pi-claude-marketplace/persistence/migrate.ts
  - extensions/pi-claude-marketplace/persistence/state-io.ts
  - extensions/pi-claude-marketplace/shared/notification-types.ts
  - extensions/pi-claude-marketplace/shared/notify-reasons.ts
  - README.md
  - scripts/test-coverage-direct.pin.json
  - tests/architecture/catalog-uat/catalog-contract.test.ts
  - tests/architecture/catalog-uat/catalog-parser.test.ts
  - tests/architecture/catalog-uat/fixtures/plugin-install.ts
  - tests/architecture/compat-01-no-expansion.test.ts
  - tests/architecture/hooks-foundation.test.ts
  - tests/architecture/notify-closed-set-locks.test.ts
  - tests/bridges/hooks/event-router.test.ts
  - tests/edge/handlers/marketplace-seed.ts
  - tests/edge/handlers/marketplace/update.test.ts
  - tests/edge/handlers/plugin/update.test.ts
  - tests/edge/handlers/tools.test.ts
  - tests/edge/register.test.ts
  - tests/index.test.ts
  - tests/integration/hooks-additionalcontext-end-to-end.test.ts
  - tests/integration/hooks-cross-scope-reconcile.test.ts
  - tests/integration/hooks-dispatch-end-to-end.test.ts
  - tests/integration/hooks-spawn-end-to-end.test.ts
  - tests/integration/reconcile-plan-convergence.test.ts
  - tests/orchestrators/edge-deps.test.ts
  - tests/orchestrators/import/execute.test.ts
  - tests/orchestrators/marketplace/add.test.ts
  - tests/orchestrators/marketplace/autoupdate.test.ts
  - tests/orchestrators/marketplace/remove.test.ts
  - tests/orchestrators/marketplace/shared.test.ts
  - tests/orchestrators/marketplace/update.test.ts
  - tests/orchestrators/plugin/bootstrap.test.ts
  - tests/orchestrators/plugin/clone-gc.test.ts
  - tests/orchestrators/plugin/enable-disable.test.ts
  - tests/orchestrators/plugin/info.test.ts
  - tests/orchestrators/plugin/install-cascade.test.ts
  - tests/orchestrators/plugin/install-disable-cascade.test.ts
  - tests/orchestrators/plugin/install-flow.test.ts
  - tests/orchestrators/plugin/install.messaging.test.ts
  - tests/orchestrators/plugin/install-outcome.test.ts
  - tests/orchestrators/plugin/list-flow.test.ts
  - tests/orchestrators/plugin/list-installed-row.test.ts
  - tests/orchestrators/plugin-path.test.ts
  - tests/orchestrators/plugin/reinstall-flow.test.ts
  - tests/orchestrators/plugin/reinstall-record.test.ts
  - tests/orchestrators/plugin/reinstall-targets.test.ts
  - tests/orchestrators/plugin/shared.test.ts
  - tests/orchestrators/plugin/uninstall.test.ts
  - tests/orchestrators/plugin/update-flow.test.ts
  - tests/orchestrators/plugin/update-preflight.test.ts
  - tests/orchestrators/reconcile/apply.test.ts
  - tests/orchestrators/reconcile/backfill.test.ts
  - tests/orchestrators/reconcile/pending.test.ts
  - tests/orchestrators/reconcile/plan.test.ts
  - tests/persistence/migrate-config.test.ts
  - tests/persistence/migrate.test.ts
  - tests/persistence/state-io.test.ts
  - tests/shared/notification-types.test.ts
  - tests/transaction/with-state-guard.test.ts
findings:
  critical: 1
  warning: 3
  info: 3
  total: 7
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-09-16T15:09:37Z
**Depth:** standard
**Files Reviewed:** 67
**Status:** issues_found

## Summary

Reviewed the phase diff (`beb86ae4^..HEAD`) across the 12 production files, the two docs, and every test in scope. The mechanical sweep (`provenance: "explicit"` fixture additions and `schemaVersion: 2 -> 3` literals across ~40 test files) is exactly that: no test in that set carries a behavioral change beyond the added field or the bumped literal, and `apply.test.ts` / `backfill.test.ts` reduce entirely to those two edits once filtered.

The specific scrutiny points from the scope guidance check out:

- `ensurePluginProvenance` (`migrate.ts:206-228`) fills only an absent key, never rewrites a present one (including a present-but-invalid value, which the new `D-04-03: leaves a present provenance untouched` case pins), and never defaults to `"dependency"`.
- `buildUninstallBucket` (`plan.ts:484-516`) gains exactly one `continue` keyed on `record.provenance === "dependency"`; an undeclared `"explicit"` record is still swept (pinned by the two `D-04-05` planner cases over a shared three-record state).
- Every record-producing site carries the field: `statePhase` (`install-outcome.ts:994`), `recordReinstalledOutcome` (`reinstall-record.ts:145`), `clonePluginRecord` (`state-io.ts:189`), and `toDisabledRecord` / the update finalize window mutate an existing record in place so the field rides through. `runInstallLedger` has exactly two callers (the cascade and the enable branch) and `runInstallCascade` exactly one, so no other producer exists.
- `"dependency promoted"` sits in `CommandPrivateReason` (`notify-reasons.ts:283-287`), not the idempotent tuple; the 53 -> 54 ledger is consistent across `notify-reasons.ts`, `notify-closed-set-locks.test.ts`, `compat-01-no-expansion.test.ts`, the catalog contract (205 -> 206, 27_293 -> 27_385) and the parser pin.
- The 04-06 deviation (`writeAdoptingConfigEntries` instead of `writePluginConfigEntry` for the promotion write) is correct: a dependency resolved through the CMP-3 fallback is recorded under a marketplace the target scope's config may not declare, and a bare plugin key there is a dangling reference the planner turns into a marketplace removal. Adopting the marketplace entry when undeclared is exactly what the fresh standalone install arm does. The orchestrated arm skips the write (WR-09) and the `--local` target flows from the single `selectDeclaringConfigWriteTarget` selection, so both arms address the file WB-01 chose.

The real problem is one level up from the exemption. The phase's stated invariant -- "a reload keeps the dependency because its record says so" -- holds only for the `pluginsToUninstall` path. The planner has a second teardown path, marketplace removal, that ignores provenance entirely, and the CMP-3 adoption the 04-06 deviation itself describes is precisely what feeds a dependency record into it. See CR-01. Two further gaps concern the promotion's reach (import's pre-check bypasses it) and the promotion row for a record that is disabled.

## Critical Issues

### CR-01: A dependency recorded under a CMP-3-adopted marketplace is torn down on the next reload; the D-04-05 exemption does not reach the marketplace-removal path

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts:324-331` (removal), `extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts:506-508` (the exemption that does not apply), `extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts:412-416` (the adoption that feeds it), `docs/dependency-resolution.md:116`

**Issue:** `buildUninstallBucket` only sees plugins under a *retained* marketplace (`plan.ts:496-498`). A recorded marketplace that the scope's merged config does not declare goes to `marketplacesToRemove` (`plan.ts:324-331`) with every plugin under it, and `applyMarketplaceRemoves` (`apply.ts:210-235`) hands that to `removeMarketplace`, which unstages those plugins whole-cloth. Nothing on that path reads `provenance`.

The cascade puts dependency records under exactly such a marketplace whenever a closure member resolves through the CMP-3 project -> user fallback: `preflightInstallResolve` clones the user-scope marketplace record into the target state (`install-outcome.ts:412-416`), and only the *root's* marketplace is ever adopted into the config (the CR-02 arm in `install-flow.ts`, via `writeAdoptingConfigEntries`, which writes `marketplaces: { [opts.marketplace]: ... }` for the requesting plugin's marketplace alone). A dependency from a user-scope-only marketplace -- an element that names that marketplace, or a transitive member whose declaring plugin lives there -- is therefore recorded at project scope under a marketplace the project config never declares.

Verified at the planner with a scratch probe (project config declares `mp1` + `root@mp1`; project state holds `mp1/root` as `explicit` and an adopted `mp2/dep` as `dependency`):

```text
"marketplacesToRemove": [ { "scope": "project", "marketplace": "mp2", "plugins": ["dep"] } ],
"pluginsToUninstall": []
```

So on the next `resources_discover` the dependency is uninstalled and its adopted marketplace record dropped, while `root` stays installed and broken -- the CR-01 (Phase 3) failure mode, surviving in the cross-marketplace case. This is inherited, not introduced: Phase 3's config write declared `dep@mp2` without declaring `mp2`, which produced a dangling reference *and* the same marketplace removal. But this phase retired that write on the strength of the provenance exemption, its tests exercise same-marketplace dependencies only (`install-flow.test.ts:3489`, `:4897`, `:5140`), and `docs/dependency-resolution.md:116` now states the invariant without qualification.

**Fix:** Two candidate shapes; either closes the hole, and the choice belongs to the operator because it decides what the desired-state config must say about a dependency's marketplace.

(a) Keep the config pure (D-04-02) and make the planner respect provenance on the removal path too -- retain a recorded-but-undeclared marketplace while any record under it is a dependency, and let `buildUninstallBucket` see it:

```ts
// plan.ts, diffMarketplaces, inside the recorded loop
const holdsDependency = Object.values(mpRecord.plugins).some(
  (record) => record.provenance === "dependency",
);
if (!retainedRecorded.has(mpName) && !claims.conflictedRecorded.has(mpName) && !holdsDependency) {
  remove.push({ scope, marketplace: mpName, plugins: Object.keys(mpRecord.plugins) });
}
```

(with `retainedMarketplaces` in `buildUninstallBucket` widened by the same predicate so that marketplace's `explicit` orphans are still swept). This keeps `plan.ts` pure and network-free.

(b) Alternatively, have the cascade's standalone write adopt every marketplace a *dependency* was resolved from (the CR-02 arm generalized over `installed.members`), so the marketplace is declared and the existing exemption suffices. This writes marketplace entries the user did not add to this scope's config, which is closer to what D-04-02 was trying to avoid.

Whichever lands, add an `install-flow.test.ts` case with the dependency seeded in a user-scope marketplace (`seedPathMarketplaceWithPlugin({ scope: "user", ... })`) and a project-scope install, asserting `planReconcile(...).marketplacesToRemove` is empty and the dependency survives `applyReconcile`, and reword `docs/dependency-resolution.md:116` to match whichever behavior is chosen.

## Warnings

### WR-01: `import` never reaches the promotion: a dependency the imported config names stays `"dependency"` while the WR-01 post-pass declares it

**File:** `extensions/pi-claude-marketplace/orchestrators/import/execute.ts:872-883`, `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts:1223-1233`

**Issue:** The promotion lives inside `installPluginWithTransaction`'s lock closure, but `executeScopedPlan` loads the scope state once (`execute.ts:825-827`) and pre-checks `state.marketplaces[...].plugins[...]` before calling `installPlugin` at all. A record that already exists at pass start is pushed to `skippedExistingPlugins` with `reason: "already-installed"` and `installPlugin` is never invoked, so `promoteDependencyRecord` never runs. The post-pass then repairs the declaration (`writeBatchedConfigForScope`, per the WR-01 comment at `execute.ts:896-905`), so the outcome is a config that declares `dep@mp` and a record that says `provenance: "dependency"`.

This is the PROV-03 scenario expressed through `import` rather than `install`: the user's imported config names the plugin. The `D-04-07: an orchestrated promotion ...` test (`install-flow.test.ts:5230`) calls `installPlugin` directly in orchestrated mode, which is a path import takes only for a dependency the *same* run's earlier cascade created (absent from the pre-loaded snapshot). A dependency recorded in any earlier session is skipped. The record/config disagreement is what Phase 5's prune will read: a plugin the config declares, reported as a dependency.

**Fix:** In `executeScopedPlan`, let a `"dependency"` record fall through to `installOnePlannedPlugin` so the orchestrated promotion runs:

```ts
const existingPlugin = state.marketplaces[plugin.ref.marketplace]?.plugins[plugin.ref.plugin];
if (existingPlugin !== undefined && existingPlugin.provenance !== "dependency") {
  result.skippedExistingPlugins.push({ /* unchanged */ });
  continue;
}
```

The promoted outcome is `installed` with `resourcesChanged: false`, which the import row composer already handles. Add an `execute.test.ts` case with a pre-seeded `"dependency"` record named by the imported settings, asserting the record reads `"explicit"` afterwards. If the operator instead decides import should *not* promote, the WR-01 repair should at least not declare a `"dependency"` record, or the two will disagree.

### WR-02: Promoting a disabled dependency reports `(installed)` for a plugin that stays disabled

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts:858-877`, `extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts:339-352`

**Issue:** `promoteDependencyRecord` gates on `record?.provenance !== "dependency"` only. A dependency can be disabled by `disable dep@mp` (the disable branch reads no provenance), which leaves `enabled: false` on the record and `{ enabled: false }` in the config. `install dep@mp` then flips provenance, spreads `pluginPatch: {}` over that entry (no change), saves, and renders `● dep vX (installed) {already installed, dependency promoted}` at info severity. The plugin remains disabled; nothing in the row says so. Under the tri-state model (info = desired state reached) the row overstates what happened, and unlike the same command on a disabled `explicit` record -- which refuses with `(failed) {already installed}` and so at least signals that nothing became active -- this one reads as success.

A second-order effect on the `--local` arm: with the `{ enabled: false }` declaration in the base file and `install dep@mp --local`, the promotion writes `dep@mp: {}` to the local file, which replaces the base entry wholesale (CFG-02). The merged view now reads enabled, the record is still disabled, and the next reload plans an enable the user never asked for.

**Fix:** Decide the disabled case explicitly rather than by omission. The smallest option that keeps the catalog closed: refuse to promote a disabled record (return `undefined` when `isRecordedButDisabled(record)`), so the existing `(failed) {already installed}` refusal stands and `enable` remains the remedy:

```ts
const record = state.marketplaces[marketplace]?.plugins[plugin];
if (record?.provenance !== "dependency" || isRecordedButDisabled(record)) {
  return undefined;
}
```

If promotion of a disabled record is wanted, the row needs to carry the disabled fact (a catalog amendment, as D-04-07 did for the promoted token), and the `--local` write must carry `enabled: false` the way the DFEN-04 arm does. Either way, add an `install-flow.test.ts` case that disables the seeded dependency before promoting it.

### WR-03: Install flags are silently discarded on the promotion arm while the row reports success

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts:1223-1233`

**Issue:** The promotion runs before `buildInstallLedgerOptions` is ever consulted, so `--map-model`, `--partial`, and a version pin (`pinVersionOverride`) on the command have no effect. Previously the same command refused (`already installed`), so a discarded flag was at least visible as a non-action. Now `install dep@mp@2.0.0` on a dependency recorded at 1.0.0 renders `(installed)` for `v1.0.0` with no indication that the pin was not honored. The version in the row is honest, but the outcome is not what the command asked for, and there is no `PluginShapeError` or reason token that says the pin was ignored.

**Fix:** Either refuse promotion when any ledger-affecting option is present (`opts.pinVersionOverride !== undefined || opts.mapModel !== undefined || opts.partial !== undefined`) so the existing refusal explains that the plugin is already installed, or document in the catalog paragraph and `docs/dependency-resolution.md` that promotion changes only the record and that `reinstall`/`update` are the commands that act on version and rendering options. The first keeps the row truthful without a catalog change.

## Info

### IN-01: `docs/dependency-resolution.md` does not describe promotion or the one-way ratchet

**File:** `docs/dependency-resolution.md:113-116`

**Issue:** The user-facing dependency doc now says a reload keeps a dependency because of its record, but nothing tells the user what `install <dependency>` does to that record, or that an explicit install stays explicit when a later plugin declares it. The only user-visible text for PROV-03 is the catalog row's paragraph, which users do not read as documentation. Phase 5's `--prune` will make this distinction consequential.

**Fix:** Add two sentences after line 116: a plugin you install by name is recorded as one you asked for, even if another plugin also needs it; installing a dependency by name later marks it as one you asked for, and the row reads `{already installed, dependency promoted}`.

### IN-02: `reinstall <dependency>` by name preserves `"dependency"`; confirm this is the intended boundary of the ratchet

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-record.ts:143-145`

**Issue:** `recordReinstalledOutcome` carries `input.oldRecord.provenance` forward, so a user who runs `reinstall dep@mp` -- also naming the plugin -- leaves it a dependency. D-04-07 scopes promotion to `install`, so this is consistent with the decision as written, but the CONTEXT's derived rule ("a dependency becomes explicit when the user installs it by name") is easy to read as covering reinstall too. Recording the boundary explicitly avoids Phase 5 relitigating it.

**Fix:** One sentence in the `reinstall-record.ts` comment stating that reinstall replaces artifacts and never promotes (D-04-07 names `install` alone), or, if the operator wants reinstall to promote, route it through the same one-field flip.

### IN-03: `plan.test.ts` still builds its state at `schemaVersion: 2`

**File:** `tests/orchestrators/reconcile/plan.test.ts:97-99`

**Issue:** The 04-02 sweep moved every other fixture to `schemaVersion: 3`, but `stateWith` still returns `{ schemaVersion: 2, ... }`. `planReconcile` is pure and never reads the version, so nothing fails; the fixture just no longer describes a document the current build writes.

**Fix:** `return { schemaVersion: 3, marketplaces: { ...marketplaces } };`

---

_Reviewed: 2026-09-16T15:09:37Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

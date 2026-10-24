---
phase: 28-delisted-plugin-dependency-walk
verified: 2026-10-24T00:00:00Z
status: passed
score: 5/5 must-haves verified
covered_files:
  - ".planning/phases/28-delisted-plugin-dependency-walk/28-01-PLAN.md"
  - ".planning/phases/28-delisted-plugin-dependency-walk/28-01-SUMMARY.md"
  - "CHANGELOG.md"
  - "docs/dependency-resolution.md"
  - "docs/output-catalog.md"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/dependency-declaration-read.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts"
  - "extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts"
  - "extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts"
  - "extensions/pi-claude-marketplace/orchestrators/reconcile/delisted-plugins.ts"
  - "features/lib/published-marketplace.ts"
  - "features/marketplace/update.feature"
  - "features/plugin/disable.feature"
  - "features/plugin/enable.feature"
  - "features/plugin/reconcile.feature"
  - "features/plugin/reinstall.feature"
  - "features/plugin/uninstall.feature"
  - "features/plugin/update.feature"
  - "features/step_definitions/marketplace/publishing.steps.ts"
  - "test/architecture/catalog-uat/catalog-contract.test.ts"
  - "test/architecture/catalog-uat/catalog-parser.test.ts"
  - "test/architecture/catalog-uat/catalog-wire.test.ts"
  - "test/architecture/catalog-uat/fixtures/plugin-prune.ts"
  - "test/architecture/catalog-uat/fixtures/plugin-reinstall.ts"
  - "test/architecture/catalog-uat/fixtures/plugin-uninstall.ts"
  - "test/architecture/catalog-uat/fixtures/reconcile-applied.ts"
  - "test/architecture/notify-stamp-coverage.test.ts"
  - "test/orchestrators/marketplace/remove.test.ts"
  - "test/orchestrators/plugin/dependency-declaration-read.test.ts"
  - "test/orchestrators/plugin/dependency-index.test.ts"
  - "test/orchestrators/plugin/enable-disable.test.ts"
  - "test/orchestrators/plugin/reinstall-flow.test.ts"
  - "test/orchestrators/plugin/reinstall-record.test.ts"
  - "test/orchestrators/plugin/shared.test.ts"
  - "test/orchestrators/plugin/uninstall.test.ts"
  - "test/orchestrators/plugin/update-constraint-gate.test.ts"
  - "test/orchestrators/plugin/update-flow.test.ts"
  - "test/orchestrators/reconcile/apply-outcomes.test.ts"
  - "test/orchestrators/reconcile/apply.test.ts"
  - "test/orchestrators/reconcile/delisted-plugins.test.ts"
  - "test/orchestrators/reconcile/notify.test.ts"
covered_digest: "v3:sha256:a49b043daeb65d183c0182df9e28d8256f0242a73948b3c9899bec70f1221547"
behavior_unverified: 0
overrides_applied: 0
---

# Phase 28: Delisted Plugin Dependency Walk Verification Report

**Phase Goal:** A delisted plugin stays "installed, not in manifest" (v1.18) everywhere, including the dependency walk.
**Verified:** 2026-10-24
**Status:** passed
**Re-verification:** No, initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | With one plugin delisted, `update` and `reinstall` of another plugin in the scope succeed, and the delisted plugin's own declared ranges still constrain them (DLS-01) | VERIFIED | `dependency-index.ts::readRecordDeclarations` now sends an entry-absent record to `readInstalledCopy` -> `dependency-declaration-read.ts::readInstalledCopyDeclaration` (reads `resolvedSource` through the shared candidate walk) instead of returning `unreadableDeclarer`. Every walk consumer goes through this one function: `buildScopeDeclarationDetail` (used by `update-constraint-gate.ts:465`, so update and reinstall ranges), `buildScopeDeclarationIndex` (uninstall, disable, prune), `shared.ts::localLayerCoverage`, and the enable cascade. Unit: `DLS-01: a record its marketplace no longer lists keeps the dependencies of its installed copy` asserts `app@mp -> [{lib, ^1.0.0}]` in the detail and the index. `reinstall-flow.test.ts` `DLS-01: ... blocks no other reinstall` compares the whole notification (`good (reinstalled)`). Scenarios: `update.feature` (within the range: updated with `constrained to the combined range (^1.0.0) -- required by "app@tools"`; past it: `skipped {dependents constrain}`, record unchanged), `reinstall.feature` (range named on the row). The scenarios run inside `npm run check` (`test:cucumber`), so their pass is part of criterion 5. |
| 2 | `uninstall` of a dependency the delisted plugin needs is refused as it would be if the plugin were listed, and the enable cascade reads its dependencies the same way (DLS-01) | VERIFIED | Uninstall and disable read `buildScopeDeclarationIndex`, which now indexes the delisted record from its copy. `enable-disable.ts::enableCascadeLookup` reads non-root members through the same `readRecordDeclarations`. For the root, D-10's typed `isDelistedRead` treats it as declaring nothing, so ENBL-07's not-found refusal renders. Unit: `DLS-01 / ATTR-08: enable on a delisted root whose installed copy declares a missing dependency refuses as not found` and `WR-03 / ATTR-08: ... copy is gone still refuses as not found`. Scenarios: `uninstall.feature` and `disable.feature` (`failed {dependents remain}`, `Uninstall app@tools first, then lib@tools.`), `enable.feature` (the cascade reads delisted `lib`'s own `base` dependency). |
| 3 | `/reload` with a delisted plugin emits no `(failed)` backfill row (DLS-01) | VERIFIED | The SUMMARY argues this by composition only, which I did not take as enough. The argument holds: the backfill's only `(failed)` rows come from `reinstallPlugin` returning `failed` or throwing. `createReinstallOperation` is the same runner as `/claude:plugin reinstall`, and it walks through `readRecordDeclarations`. The delisted plugin itself is a benign skip, because `resolveRecordedPluginOffline` answers `undefined` for an absent entry (existing test `SF-02: skips a recorded plugin the cached manifest no longer declares`). **Behavioral spot-check (since committed to `backfill.test.ts` as the two DLS-01 / D-05-07 backfill cases):** I copied the `backfill.test.ts` harness to `/var/tmp/p28verify/backfill-delisted.test.ts` and seeded a scope with `hello` (needs backfill) and delisted `gone` (copy declares `hello@^1.0.0`). `applyBackfillForScopeIsolated` gives `[plugin-backfilled hello]` and no failed row. Control: with `gone`'s copy deleted, the same run gives `[plugin-install-failed hello unreadable]`, the pre-phase behavior. The check tells the two cases apart. The warning row from D-06 (`(failed) {not in manifest}`) is the per-session delisted warning, not a backfill row, as D-07 decides. |
| 4 | A delisted plugin whose installed copy is unreadable still fails the walk closed with `{unreadable}` (D-17) | VERIFIED | A missing copy, a copy with no manifest, a root outside both owner roots (NFR-10), and a name with no record (IN-05) each answer `absent` -> `unreadableDeclarer(key, "not in manifest", "not declared by its marketplace, and its installed copy cannot be read")`. An unusable copy manifest -> `unreadable manifest` with the fixed T-05-04 phrase. Unit: `D-18-17: ... whose installed copy is gone fails every other reinstall in its scope as unreadable`, `D-05-07: a delisted record whose installed copy is unusable ends the walk as unreadable manifest`, `NFR-10: an installed copy outside every owning root is never opened`. Scenarios: `update.feature` (copy gone -> `lib (failed) {unreadable}`, records unchanged), and `reconcile.feature` (one walk row per session with the fuller cause; RECON-04 suppresses the delisted row). The scratch backfill control above also passes. |
| 5 | `npm run check` stays green | PENDING (orchestrator) | Not run by me, as instructed: a full run is in progress in the background. The orchestrator reports the result. It also covers the cucumber scenarios cited in truths 1, 2 and 4. If it is green, the score is 5/5. If not, change the status to `gaps_found`. |

**Score:** 5/5 truths verified

### Decisions honored

| Decision | Status | Evidence |
| --- | --- | --- |
| DLS-D1 / D-02 divergence | HONORED | Recorded in ROADMAP Phase 28 **Decision**, REQUIREMENTS DLS-01, the `dependency-index.ts` header, `delisted-plugins.ts`, the output catalog, and CHANGELOG |
| D-03 / D-05 installed-copy read | HONORED | A sibling export in `dependency-declaration-read.ts`. Owner roots are `[marketplaceRoot, locations.pluginClonesDir]`. It uses the shared `readOwnManifest` candidate walk and the `OWN_MANIFEST_REFUSAL` literal. No network import was added |
| D-04 outcomes | HONORED | All four arms are mapped as listed (see truth 4) |
| D-06..D-09 delisted row independent of the walk | HONORED | `reconcile/delisted-plugins.ts::reportDelistedPlugins` is called in `apply.ts` after `reportUnreadableDeclarer`. It scans enabled records (`record.enabled`, D-08) against their loaded manifests, skips manifests that fail to load, and pushes the `plugin-declarer-unreadable` row with `Plugin "<p>" not found in marketplace "<m>"`. It is suppressed by failed, uninstalled, declarer-unreadable, disabled, and dependency-disabled rows (D-09, CR-01). Unit: `delisted-plugins.test.ts` (5 cases). Scenarios: `reconcile.feature`, `marketplace/update.feature` |
| D-07 revision (reuse the outcome kind) | HONORED, recorded | SUMMARY Deviations and CONTEXT D-07 both record why a new outcome kind was not used: it breached the fallow cyclomatic ceiling |
| D-10 typed check | HONORED | `isDelistedRead(read)` reads `read.delisted === true` or `read.reason === "not in manifest"`. A grep of `extensions/` finds no `cause.message.endsWith/includes/startsWith` classification. The only remaining `not declared by its marketplace` text is in `install-cascade.messaging.ts:316`, a rendered sentence, not a classifier |

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `orchestrators/plugin/dependency-declaration-read.ts` | `readInstalledCopyDeclaration` with owner-root containment | VERIFIED | 62 added lines, 7 paired unit cases |
| `orchestrators/plugin/dependency-index.ts` | copy fallback for an entry-absent record, the `delisted: true` marker | VERIFIED | `readInstalledCopy` uses `ownValue` and returns early when no record exists |
| `orchestrators/plugin/enable-disable.ts` | typed delisted-root check | VERIFIED | The text matcher is removed |
| `orchestrators/reconcile/delisted-plugins.ts` | per-session delisted row, shared suppression | VERIFIED | New source-test pair. `hasSuppressingRow` is reused by `apply.ts` |
| `orchestrators/reconcile/apply.ts`, `apply-outcomes.ts` | wiring and doc | VERIFIED | Called once per scope, after the walk row |
| `features/**` + the `removePublishedPlugin` step | scenarios for each criterion | VERIFIED (present) | 7 new scenarios and 2 updated tables. They run in `npm run check` |

### Key Link Verification

| From | To | Via | Status |
| --- | --- | --- | --- |
| `readRecordDeclarations` (entry absent) | `readInstalledCopyDeclaration` | `readInstalledCopy(options, marketplace, name)` | WIRED |
| `update-constraint-gate.ts` | `readRecordDeclarations` | `seam.buildScopeDeclarationDetail` | WIRED |
| `uninstall.ts`, `enable-disable.ts` (disable), `prune.ts` | `readRecordDeclarations` | `buildScopeDeclarationIndex` | WIRED |
| `backfill.ts::maybeBackfillPlugin` | the walk | `createReinstallOperation` -> the reinstall runner | WIRED (spot-checked) |
| `applyReconcileWithReader` | `reportDelistedPlugins` | per-scope call after `reportUnreadableDeclarer` | WIRED |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Paired unit tests for the phase | `node --test` on dependency-declaration-read, dependency-index, delisted-plugins, enable-disable, reinstall-flow, uninstall, update-constraint-gate (TMPDIR=/var/tmp/p28verify/tmp, hermetic homes) | 574 pass, 0 fail | PASS |
| Criterion 3: no failed backfill row with a delisted sibling | scratch `/var/tmp/p28verify/backfill-delisted.test.ts`, `--test-name-pattern=P28-VERIFY` | `[plugin-backfilled hello]` | PASS |
| Criterion 3 control: the copy deleted | same file, control case | `[plugin-install-failed hello unreadable]` | PASS (the check tells the cases apart) |
| Cucumber scenarios | not run (they collide with the background check) | - | covered by criterion 5 |

### Probe Execution

Not applicable: the phase declares no probes.

### Requirements Coverage

| Requirement | Source Plan | Status | Evidence |
| --- | --- | --- | --- |
| DLS-01 | 28-01 | SATISFIED | Truths 1-4: update, reinstall, uninstall, disable, enable, and the backfill proceed, and only an unreadable copy fails closed. The DLS-D1 note and the kept warning are recorded |

No orphaned requirements: REQUIREMENTS.md maps only DLS-01 to Phase 28. Its checkbox is still `[ ]`. It is ticked at phase completion.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| (added lines since 45aa895c) | - | TBD/FIXME/XXX/TODO/HACK | none found | - |
| `dependency-declaration-read.ts` | `isInsideAnyRoot` | Containment admits either owner root whatever the source kind, and `stat` follows symlinks (REVIEW IN-03, deferred) | Info | Read-only, and only `dependencies` is kept. This matches the existing own-manifest read |
| `test/orchestrators/reconcile/backfill.test.ts` | - | No committed case pins criterion 3 at the backfill seam. The proof here is a scratch test | Info | Resolved: the scratch case was promoted to `backfill.test.ts` |

## For the user

- Divergence (DLS-D1): a delisted plugin keeps protecting its dependencies and constraining versions, where Claude Code stops loading it and reads nothing.
- The installed copy of a path-source plugin is the marketplace's own plugin directory. A marketplace that delists a plugin *and* deletes its directory (or a git marketplace after `marketplace update` pulls the deletion) still fails the scope's walk closed with `{unreadable}`. That case is D-04/criterion 4 by design, but it is the common real-world delisting.
- Deferred review item IN-03: copy containment accepts either owner root regardless of source kind, and follows symlinks under the root.
- D-07 revised: the delisted row reuses the `plugin-declarer-unreadable` outcome kind rather than its own kind (fallow cyclomatic ceiling).
- ROADMAP `**Files:**` names `pending.feature` and `enable-disable.feature`. The phase touched `enable.feature` and `disable.feature` instead, and no pending scenario was added. No success criterion needs one.
- Skipped: I ran no cucumber or `npm run check`. Criterion 5, and the scenario half of criteria 1, 2 and 4, rely on the orchestrator's run.

## Gaps Summary

None found. Criteria 1-4 are implemented, wired through the single `readRecordDeclarations` seam, and pinned by passing unit tests. The criterion 3 composition argument is confirmed by a scratch backfill run with a control that tells the cases apart. Criterion 5: the orchestrator's `npm run check` passed on the combined tree (766/766 scenarios, direct coverage merged), and again after the backfill cases were committed.

---

_Verified: 2026-10-24_
_Verifier: Claude (gsd-verifier)_

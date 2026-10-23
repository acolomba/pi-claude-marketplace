---
phase: 23-uninstall-and-prune-parity
reviewed: 2026-10-23T00:00:00Z
depth: deep
files_reviewed: 23
files_reviewed_list:
  - docs/dependency-resolution.md
  - docs/messaging-style-guide.md
  - docs/output-catalog.md
  - extensions/pi-claude-marketplace/orchestrators/plugin/prune.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts
  - extensions/pi-claude-marketplace/shared/notification-grammar.ts
  - extensions/pi-claude-marketplace/shared/notification-json.ts
  - extensions/pi-claude-marketplace/shared/notification-types.ts
  - features/plugin/pending.feature
  - features/plugin/prune.feature
  - features/plugin/state-lock.feature
  - features/plugin/uninstall.feature
  - test/architecture/catalog-uat/fixtures/plugin-pending.ts
  - test/architecture/catalog-uat/fixtures/plugin-prune.ts
  - test/orchestrators/plugin/prune.test.ts
  - test/orchestrators/plugin/uninstall.test.ts
  - test/orchestrators/reconcile/notify.test.ts
  - test/orchestrators/reconcile/pending.test.ts
  - test/shared/notification-grammar.test.ts
  - test/shared/notification-json.test.ts
  - test/shared/notification-types.test.ts
findings:
  critical: 1
  warning: 2
  info: 6
  total: 9
status: issues_found
---

# Phase 23: Code Review Report

**Reviewed:** 2026-10-23
**Depth:** deep (working-tree diff against `973f0ecc`, with the callers and callees traced)
**Files Reviewed:** 23
**Status:** issues_found

## Summary

The three changes do what D-01..D-12 ask:

- PRN-02: both pending producers and prune `--dry-run` stamp the version. Text and JSON agree (`pluginVersion`, `wireVersion`, and the layout all moved together).
- PRN-03: prune passes `StateLockHeldError` through unredacted, and the other failure arms stay redacted.
- UNI-01: the filtered index feeds `findDependents` and the LAYER-08 walk. The sweep still reads `snapshot.index`.

The `recordedVersionEntries` key (`forceInstallKey(scope, <state map key>, plugin)`) matches the lookup. The planner builds `o.marketplace` from the same `state.marketplaces` map key (`plan.ts` `buildRecordedKeys`). `survivingDependents` and the sweep do not affect each other: `dependents` is now enabled-only, and the sweep's `removed` filter still applies. An ENABLED declared needer still refuses.

Checks run:

- Passed: the touched unit tests (prune, uninstall, reconcile notify and pending, notification types/json/grammar), the four touched feature files (44 scenarios), `check-features.mjs`, `tsc --noEmit`, prettier and eslint on the changed files, and `fallow audit --base HEAD`.
- Failed: the catalog contract test (CR-01).

During the review, eslint reported an `import-x/order` error in `test/orchestrators/reconcile/notify.test.ts:20`. It was fixed in the working tree before this report was written, so it is not listed.

## Critical Issues

### CR-01: The catalog contract byte count was not updated, so `npm run check` fails

**File:** `test/architecture/catalog-uat/catalog-contract.test.ts:22`

**Issue:** The new versions in the `will uninstall` rows and the absolute lock path in prune's lock-held example grow the documented catalog examples by 90 UTF-8 bytes:

- 8 rows gain ` vX.Y.Z` (4 prune rows and 4 pending rows), at 7 bytes each: 56 bytes.
- The lock path gains `~/.pi/agent/pi-claude-marketplace/`, 34 bytes.

`catalog contract matches all 21 fixture modules to 294 exact documented states` now fails with `47615 !== 47525`. D-12 says these counts are updated "only if they change", and this one changed.

**Fix:**
```ts
const EXPECTED_UTF8_BYTES = 47_615;
```

## Warnings

### WR-01: A held-down dependent (config-enabled, disabled by the load-time check) is treated as disabled, so a LAYER-08 refusal is skipped and the dependent is never told

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts:295-309` (`withoutDisabledHolders`), and line 344

**Issue:** The filter uses `isRecordedButDisabled(plugin)`, which is just `!record.enabled`. A record that the LOAD-01 check disabled has `enabled: false` and `dependencyDisabled: true`. Its config entry still says enabled, because RECON-03 skips the config write-back.

In Claude Code's terms that plugin is enabled. `Z1t`/`Y` read `enabledPlugins` from settings. The project's own model agrees: `dependency-verdict.ts::isDisabledIndependently` treats a marker-held record as enabled, because "this same pass will lift it".

What happens today:

- For an undeclared target (LAYER-08), the D-MF-03 refusal that should name the held-down needer is skipped, and the dependency is uninstalled with a plain `(uninstalled)` row.
- For a declared target, the `{dependents unsatisfied}` cause leaves that dependent out.
- On the next reload, `plan.ts::buildDependencyDisableBucket` skips the record (`isAlreadyDependencyDisabled`), so no row names the newly missing dependency.
- When the user later fixes the original missing dependency, the dependent silently stays held. The user expected the auto-lift. Only a manual `enable` brings up the `{dependency unsatisfied}` remedy.

So D-10's claim that the uninstall "leaves no silent break" does not hold for this case.

The reverse case is less serious. A record that is still enabled but whose config is now `enabled: false` (a pending disable) is counted as enabled. That is conservative, but it also differs from upstream.

**Fix:** Drop only the holders that are disabled independently. Reuse the predicate the verdict already uses, or share it:
```ts
.filter(([, plugin]) => isRecordedButDisabled(plugin) && plugin.dependencyDisabled !== true)
```
Add an uninstall unit case where `app` is `{ enabled: false, dependencyDisabled: true }` and is declared in the target layer. The case should expect the `{dependents remain}` refusal.

This is a parity question: does "disabled" mean the record flag or the user's or config's intent? The AGENTS.md parity rule says such a question goes to the user. Record the answer as an amendment to D-07/D-09.

### WR-02: The output catalog still says a disabled dependent holds the uninstall target

**File:** `docs/output-catalog.md:1272`. Also lines 1140, 1342 and 1356.

**Issue:** Line 1272 (the LOAD-03 `dependents unsatisfied` state) still says: "A DISABLED dependent still holds the target (D-05-04): installed is installed." UNI-01 now does the opposite: a disabled dependent is not named and does not hold the target.

The uninstall intro at line 1140 and the two LAYER-08 sections ("Refused -- a plugin of the target layer needs this dependency", "Kept installed -- only a plugin of the other layer needs this dependency") do not mention that only ENABLED needers count. `docs/dependency-resolution.md` was updated, so the two documents now contradict each other.

**Fix:** Replace the sentence at line 1272 with something like: "Only an ENABLED dependent is named (UNI-01): a disabled plugin needs nothing while it is off, as in Claude Code; when only disabled plugins declare the target, the row is the plain `(uninstalled)` one." Add "enabled" to the needer wording at lines 1140, 1342 and 1356. Keep the `--prune` paragraph's "a disabled one included (PRUNE-03 / D-05-04)", which is still correct for the sweep.

## Info

### IN-01: Comments that are now stale say pending rows carry no version, and describe how uninstall reads declarers

**Files:**
- `extensions/pi-claude-marketplace/orchestrators/reconcile/reconcile.messaging.ts:22-26`
- `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:1537-1539`

**Issue:**
- `reconcile.messaging.ts` says "The pending-tense rows carry no `version` slot". `will uninstall` now carries one.
- `enable-disable.ts` says `readEnabledDependents` "Mirrors `uninstall.ts::readDeclarers`'s composition: ... `findDependents(key, result.index)`". `readDeclarers` now calls `findDependents` on the filtered `enabledIndex`.

**Fix:** In `reconcile.messaging.ts`, write "carry no `version` slot except `will uninstall`, which names the recorded version (PRN-02)". In `enable-disable.ts`, update the mirror sentence, or remove it.

### IN-02: Two separate implementations of the "enabled declarers" filter, with different keys

**Files:**
- `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts:300-309`
- `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:1567-1574`

**Issue:**
- `enable-disable.ts` filters `result.candidates` on `candidate.record`. Its keys are the index's own keys (`${name}@${marketplace.name}`).
- `withoutDisabledHolders` walks `state.marketplaces` a second time and keys on the map key (`${name}@${mapKey}`).

The two keys are equal while `record.name === mapKey`. If that invariant ever breaks, a disabled holder silently stays in the index. That is fail-safe, but the code drifts.

**Fix:** Build the filtered index from `result.candidates`. Better, export one helper next to `buildScopeDeclarationIndex`, such as `enabledDeclarationIndex(snapshot)`, and use it in both places.

### IN-03: The layer `marketplace remove` refusal still counts disabled holders

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts:754-782`

**Issue:** `refuseHeldRemovals` calls `findDependents` on the unfiltered index. A layer remove of a marketplace whose plugin only a DISABLED plugin declares is therefore refused with `{dependents remain}`. A named `uninstall` of the same plugin now goes ahead. The doc comment says the refusal works "as `disable` refuses", but `disable` counts only enabled dependents. This is outside the phase scope (D-07 names the named uninstall only), but the inconsistency between the two commands is now visible to users.

**Fix:** Decide whether UNI-01 also covers the layer remove, and record the answer. If it does, use the shared helper from IN-02.

### IN-04: Decision IDs are cited in two forms

**Files:**
- `extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts:255` and `notify.ts:267`
- `extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts:315`

**Issue:** These comments cite a bare `D-04`. `notification-json.ts` already uses `D-04` for a different decision ("D-04: the raw version, or `from` and `to`..."). `uninstall.ts` cites the qualified form `D-23-07`.

**Fix:** Use `D-23-04` in these three comments.

### IN-05: Test gaps and weak assertions

**Files:**
- `test/orchestrators/plugin/uninstall.test.ts:6194-6266`
- `test/orchestrators/reconcile/notify.test.ts:1901`
- `test/orchestrators/plugin/prune.test.ts:647`

**Issue:**
- No case mixes an ENABLED and a DISABLED needer. Such a case would prove that the refusal and skipped causes and the `{dependents unsatisfied}` cause name only the enabled one.
- The PRN-02 projection test uses one scope only. The `scope` part of the `forceInstallKey` key, which keeps the same `mp/plugin` in two scopes apart, is not exercised.
- `assert.ok(notifications[0]?.message.includes(...))` reports only `false` when it fails.

**Fix:**
- Add a mixed-needer case.
- Add a two-scope case with different versions.
- Use `assert.match(message, new RegExp(escape(`(${locations.stateLockFile})`)))`, or `assert.ok(..., message)`.

### IN-06: Small items

**Files:**
- `extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts:55-60`
- `README.md:369`

**Issue:**
- In `pending.ts`, `recordedVersionEntries` is listed before `isReconcilePlanListEmpty` in the import list. Every other member list in the file is alphabetical (no lint rule enforces this).
- `README.md:369` says the uninstall row "names the dependents". It now names only the enabled ones, and a dependency held only by disabled plugins gets a plain row. `README.es.md` has the same wording.
- The plan lists `docs/json-output.md` under `files_modified`. No change was needed, because no text there claims pending rows are versionless. Treat that entry as a no-op, not as a missed edit.

**Fix:** Reorder the import. Add "enabled" to the README sentence, in both languages.

---

_Reviewed: 2026-10-23_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_

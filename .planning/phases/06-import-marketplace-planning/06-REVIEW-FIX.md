---
phase: 06-import-marketplace-planning
fixed_at: 2026-10-27T06:03:15Z
review_path: .planning/phases/06-import-marketplace-planning/06-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 5
skipped: 3
status: partial
---

# Phase 6: Code Review Fix Report

**Fixed at:** 2026-10-27T06:03:15Z
**Source review:** .planning/phases/06-import-marketplace-planning/06-REVIEW.md
**Iteration:** 1

**Summary:**

- Findings in scope: 8 (the caller chose CR-01, WR-01, WR-02, IN-02, IN-05 to fix and IN-01, IN-03, IN-04 to leave)
- Fixed: 5
- Skipped: 3

Each fix has a unit test or a scenario, and each was checked to fail with the source change reverted.

**Where the checks ran:** in the phase worktree `pl-p6-import-d53379` itself, on branch `features/plugin-lifecycle-p6`. The caller named this worktree as the only writer, so no nested review-fix worktree was made. `npm run check` ran there after the last fix and exited 0 (914 scenarios, merged direct coverage 291 records). Each commit also passed the `check:commit` hook.

## Fixed Issues

### CR-01: Alias post-pass breaks a config that already declares the settings name

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/import/execute.ts`, `test/orchestrators/import/execute.test.ts`, `features/plugin/import.feature`
**Commit:** 288f4da3
**Applied fix:** The read pass now loads the scope's merged config. It also maps each recorded marketplace that the config claims to the name the config declares it under, using the planner's own claim rule (`configNamesByRecorded`). The post-pass (`buildBatchedPatchForScope`, `buildRepairPatchForScope`, `stampReenabledWhereLocalDeclares`) builds every marketplace and plugin key from that name. If the config declares neither name, the key is the recorded name. A config that declares `X` for record `Y` keeps `X` and `p@X`, and no `Y` is added. The operations and rows still name the recorded marketplace.
**Tests:** `CR-01: keeps the settings name a config already declares for the recorded marketplace` (repair path, config byte-identical, `planReconcile` empty) and `CR-01: declares an installed plugin under the settings name a config already declares for the recorded marketplace` (ensure path writes `plugin@mp`, `planReconcile` empty). Scenario: `Importing settings that name a known marketplace the way the config already names it keeps the config's names` (marketplace add, config `other`/`demo@other`, apply, import, then `pending` reports nothing to change).
**Status:** fixed: requires human verification (logic change in the alias post-pass)

### WR-01: "Settings do not declare that name" is checked against the planned subset

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/import/types.ts`, `extensions/pi-claude-marketplace/orchestrators/import/marketplaces.ts`, `extensions/pi-claude-marketplace/orchestrators/import/execute.ts`, `test/orchestrators/import/execute.test.ts`, `test/orchestrators/import/marketplaces.test.ts`, `test/orchestrators/import/types.test.ts`, `features/plugin/import.feature`
**Commit:** 5bf5a3f6
**Applied fix:** `ScopedClaudeImportPlan` gains `settingsMarketplaces`: every name in `extraKnownMarketplaces` and every enabled plugin's marketplace, planned or not. The read pass drops any claim whose recorded name is in that set. So an unmappable entry or an unreferenced `claude-plugins-official` that names the record stops the alias, and the settings marketplace goes to the add as before D-PL6-02.
**Tests:** `D-PL6-02: adds a settings marketplace instead of claiming a record the settings also declare with no supported source` and `... as the official marketplace no plugin names`. `buildClaudeImportPlan` cases now pin `settingsMarketplaces`. `types.test.ts` has type checks for the field. Scenario: `Importing settings that also declare the recorded name of a known marketplace does not follow its source to that record`.
**Status:** fixed: requires human verification (claim-rule condition)

### WR-02: A conflicted claim's cause says the source does not match

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts`, `extensions/pi-claude-marketplace/orchestrators/import/execute.ts`, `test/orchestrators/reconcile/plan.test.ts`, `test/orchestrators/import/execute.test.ts`, `features/plugin/import.feature`
**Commit:** c93b005b
**Applied fix:** The planner's claim conflicts now carry a typed `MarketplaceClaimConflict` (`ambiguous` with the recorded names, or `multiply-claimed` with the one recorded name), exported through `marketplaceClaimConflicts`. The planner's own `pending` prose is unchanged. Import's read pass reads the conflicts, and `sourceMismatchCause` words the cause as `Claude settings source <src> matches more than one recorded marketplace: a, b.` or `Recorded marketplace <name> is claimed by more than one Claude settings marketplace.` A true mismatch keeps its sentence.
**Tests:** The two locked-in D-PL6-09 cases were updated to the new wording. New case: `D-PL6-09: two settings marketplaces that claim one record block each other before any add`. New `marketplaceClaimConflicts` describe block in `plan.test.ts` (3 cases). Scenario: `Importing two settings marketplaces that name one known marketplace's source fails both and says why`.
**Status:** fixed

### IN-02: A shared failing dependency can produce two rows with the same name

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/import/execute.ts`, `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts`, `test/orchestrators/import/execute.test.ts`, `test/orchestrators/reconcile/apply.test.ts`, `features/plugin/import.feature`, `features/plugin/apply.feature`
**Commit:** 03de15ed
**Applied fix:** Import: `unexpectedFailureRows` keeps a set of the block and dependency keys it has already shown, so the second plugin that failed on the same dependency gets only its `{dependency failed}` row. Apply: `installFailedOutcomes` (the phase-added code and its call line only) leaves out the dependency's rollback row when `outcomes` already holds a failed-install row for that scope, marketplace, and plugin (`isSameFailedInstall`). The rows that remain are unchanged.
**Tests:** `D-PL6-04: names a dependency two plugins of one marketplace failed on once` (import) and `MIM-03: a dependency two installs fail on with an unfinished undo gets one row` (apply, a real undo failure). Scenarios: `Importing two plugins whose shared dependency rollback cannot finish names that dependency once` and `Apply that cannot finish the rollback of a dependency two plugins share reports that dependency once`. The apply case proves that a second install really fails on the dependency again, and that without the fix the row appears twice.
**Status:** fixed

### IN-05: The install-rollback scenario uses a literal errno message

**Files modified:** `features/plugin/install-rollback.feature`, `features/lib/run-tokens.ts`, `.agents/skills/cucumber/rules/features.md`
**Commit:** 78e79e6e
**Applied fix:** The cell now reads `{read-only skill directory removal error}`. That token is recorded with its path cut, and install shows the cause unredacted at a path that the fixture step cannot make the failing call at. So `projectTokens` now lets an error token also stand for its message with each quoted path replaced by any path that ends in the same segment (`anyQuotedPathPattern`). The cut form, which import and apply use, is the special case where no path comes before the segment. The cucumber skill's run-token rule says the same.
**Tests:** The scenario `An install whose skills rollback cannot finish names the skills phase` fails with the harness change reverted and passes with it. All 914 scenarios pass with the wider projection. `features/lib` has no unit-test pairing, so the scenario is the test.
**Status:** fixed

## Skipped Issues

### IN-01: An unreferenced source mismatch has no `{source mismatch}` brace and counts as two failures

**File:** `extensions/pi-claude-marketplace/orchestrators/import/execute.ts:1024-1032`
**Reason:** Left as is by the caller's instruction. The current shape follows D-PL6-09 and reuses the WR-06 `(failed)` block.
**Original issue:** The D-PL6-09 arm records the mismatch as `reason: "add-failed"`, so the block reads `tools (failed)` with a bare child row and two failures, while a referenced mismatch reads `{source mismatch}`.

### IN-03: Apply puts the dependency's rollback row after the requested row

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:552-556`
**Reason:** Left as is by the caller's instruction. The IN-02 apply scenario pins the current order (requested row, then the dependency row).
**Original issue:** `installFailedOutcomes` returns `[requested, dependency]`, while apply's moved-dependency rows come before the requested row.

### IN-04: `enableDegradation` restates part of `degradationFromEnable`

**File:** `extensions/pi-claude-marketplace/orchestrators/import/execute.ts:1208-1216`
**Reason:** Left as is by the caller's instruction.
**Original issue:** The narrowed enable signals copy the first three spreads of `orchestrators/plugin/shared.ts::degradationFromEnable`, so a new degradation fact can be missed in one of them.

---

_Fixed: 2026-10-27T06:03:15Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_

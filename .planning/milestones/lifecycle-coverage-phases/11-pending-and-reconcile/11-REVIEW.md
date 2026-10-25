---
phase: 11-pending-and-reconcile
reviewed: 2026-10-23T08:53:44Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - test/orchestrators/reconcile/apply.test.ts
  - CHANGELOG.md
  - features/plugin/pending.feature
  - features/plugin/reconcile.feature
findings:
  critical: 1
  warning: 2
  info: 2
  total: 5
status: issues_found
---

# Phase 11: Code Review Report

**Reviewed:** 2026-10-23T08:53:44Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Scope is `git diff 0fc0172c`, which covers commits `bdc2919b` (fix(reconcile)) and `f203fc53` (test(features)). The two commits landed while this review was running.

The D-07 fix is correct. `applyPluginInstalls` now copies `result.version` onto the `plugin-installed` outcome with the same conditional spread the `landedDisabled` arm uses, and `installedRowFromOutcome` already renders the version. `node --test test/orchestrators/reconcile/apply.test.ts` passes (115/115). The direct coverage check for the `apply.ts` pair (`node scripts/test-coverage-direct.mjs .../reconcile/apply.ts`) exits 0.

The fix changes every reconcile `(installed)` row whose plugin has a version. Three integration test files still expect the old row with no version, so `npm run test:integration` fails. That makes `npm run check` fail too, and it is a phase success criterion (ROADMAP Phase 11, criterion 5).

The scenarios match D-01..D-06, and each one traces to PND-01, PND-02, or REC-01..REC-04. One gap: the REC-04 scenario still passes against an install loop that stops at its first failure.

I ran `npx cucumber-js` on the two phase features once. That run was before `f203fc53` landed. It showed the two REC-01 seeds failing on the new `version` column, and `f203fc53` adds that column. I did not run cucumber again after the commit.

## Critical Issues

### CR-01: The version fix fails nine integration tests, so `npm run check` fails

**File:** `test/integration/plugin-layer-consistency.test.ts:155,190,231,260,305,338`, `test/integration/mcp-migration.test.ts:351`, `test/integration/reserved-record-keys.test.ts:249`
**Issue:** These tests run the real `createApplyReconcile` reload over a marketplace whose plugins carry `version: "1.0.0"`. They still expect the reconcile install row with no version (`● other (installed)`, `● hello (installed) {requires pi-mcp-adapter}`, `● ${plugin} (installed)`). After `bdc2919b` the row reads `● other v1.0.0 (installed)`. I confirmed the failures by running the tests:
- `node --test test/integration/plugin-layer-consistency.test.ts`: 6 of 7 fail.
- `node --test --test-name-pattern=AMIG-04 test/integration/mcp-migration.test.ts`: fails on `hello v1.0.0 (installed)`.
- `node --test --test-name-pattern="a reload whose config declares" test/integration/reserved-record-keys.test.ts`: 2 of 2 fail.

The plan verified Task 1 with `apply.test.ts` and `test:coverage:direct:commit` only. Neither runs `test/integration/**`, and the pre-commit hook does not run it either. `npm run check` runs `test:integration`, so the phase gate (criterion 5) and the milestone merge gate are both red. ROADMAP "Overlapping fixes" limits file ownership to `features/`, so this phase may edit these test files.

**Fix:** Add the version to each expected reconcile install row, the same way `apply.test.ts` was updated:
```ts
// plugin-layer-consistency.test.ts (lines 155, 190; same for demo at 231, 260 and the multi-line rows at 305, 338)
{ message: "● mp [project] (added)\n  ● other v1.0.0 (installed)\n\nReconcile: 2 successes" },
// mcp-migration.test.ts:351
"  ● hello v1.0.0 (installed) {requires pi-mcp-adapter}",
// reserved-record-keys.test.ts:249
message: `● ${marketplace} [project] (added)\n  ● ${plugin} v1.0.0 (installed)\n\nReconcile: 2 successes`,
```
Then run `npm run test:integration`, or the full `npm run check`, before the phase gate. This repo has had green runs that checked nothing, so confirm that the integration step actually ran.

## Warnings

### WR-01: The REC-04 scenario still passes when a reconcile stops at its first failed install

**File:** `features/plugin/reconcile.feature:124-129`
**Issue:** REC-04 requires that a reconcile that cannot install one plugin "leaves the other changes applied". `applyPluginInstalls` installs in config key order. The order comes from the `Object.entries(merged.plugins)` walk in `plan.ts` `diffPlugins`, and rows are emitted in that order. The scenario declares `demo` before `ghost`, so `demo` installs before `ghost` fails. A plausible wrong implementation, an install loop that breaks or throws on its first failed outcome, would still produce this result: `demo` installed with its skill offered, and `ghost` failed. The second pass (D-06) finds `demo` already installed and fails on `ghost` again, which also matches. The cucumber skill's question ("would a plausible wrong implementation still pass?") gets the answer yes. The unit test `first`/`middle` cases in `apply.test.ts` do cover this ordering, but the scenario is the REC-04 evidence.
**Fix:** Declare the failing plugin first, so the successful install comes after the failure:
```gherkin
    Given a config in scope project and layer base, with these plugins:
      | marketplace | plugin | enabled |
      | fixtures    | ghost  |         |
      | fixtures    | demo   |         |
```
Then update the `the results list these marketplaces and plugins:` table to the emitted row order (the `ghost` failed row, then the `demo` installed row, in the first result).

### WR-02: A test comment says the opposite of the assertion below it

**File:** `test/orchestrators/reconcile/apply.test.ts:6046-6047`
**Issue:** The comment says "the standard install path carries no version for a config-declared install". The assertion directly below now expects `● app v1.0.0 (installed)`, and that row is exactly what D-07 fixed. A later reader who trusts the comment could undo the fix, or could think the expectation is wrong.
**Fix:** Drop the stale parenthetical:
```ts
    // assert -- app's own cascade row is the only row; helper is
    // materialized once, and deploy-kit is left untouched.
```

## Info

### IN-01: The CHANGELOG sentence goes over the 25-word limit and names only one trigger

**File:** `CHANGELOG.md:7`
**Issue:** The bullet is one sentence of 26 words, and `.agents/skills/changelog/rules/entries.md` allows at most 25 per sentence. It also says "When a new session installs", but the same reconcile runs on `/reload` (`resources_discover`, `reason: "reload"`). Like the other in-progress bullets, it has no PR number yet.
**Fix:** For example: "A plugin that you add to a config by hand now shows its version on the `(installed)` row when a session or `/reload` installs it, as `install` does." Add the `(#N)` reference when the PR exists.

### IN-02: The output catalog's reconcile example still shows install rows with no version

**File:** `docs/output-catalog.md:3433-3440` (state `success-cascade-mixed`; fixture `test/architecture/catalog-uat/fixtures/reconcile-applied.ts:20-48`)
**Issue:** The text says the `(installed)` reconcile row "reuses the standalone-install byte form", but the example shows `● new-plugin (installed)` with no version. After D-07, a real reconcile install of a versioned plugin prints `vX.Y.Z`. No gate fails, because the fixture is synthetic and `version` is optional. Still, the main example of the catalog no longer matches typical output. A smaller point: the `pending.feature` Background (lines 7-14) now offers `alpha`, `beta`, and `gamma` to every scenario, but only the three new scenarios use them.
**Fix:** Add `version: "1.0.0"` to the two `installed` rows in the catalog fixture, and `v1.0.0` to the rendered example, so the doc shows the form users now see.

---

_Reviewed: 2026-10-23T08:53:44Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

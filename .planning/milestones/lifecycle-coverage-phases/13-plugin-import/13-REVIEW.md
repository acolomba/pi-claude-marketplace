---
phase: 13-plugin-import
reviewed: 2026-10-23T00:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
  - test/orchestrators/import/execute.test.ts
  - test/e2e/import-command.test.ts
  - features/plugin/import.feature
findings:
  critical: 2
  warning: 5
  info: 4
  total: 11
status: issues_found
---

# Phase 13: Code Review Report

**Reviewed:** 2026-10-23
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Scope: `git diff d075e472..HEAD -- extensions test features`, which covers the D-02 version slot, the D-03 `not in manifest` token, the unit and e2e updates, and the five new import scenarios. Commit `661f8740` landed during the review. It changes only `test/integration/reserved-record-keys.test.ts`, which is outside this file list.

Evidence I ran:

- `node --test test/orchestrators/import/execute.test.ts`: 70/70 pass.
- `npx cucumber-js features/plugin/import.feature`: 7 scenarios, 84 steps, all pass.
- `node --test test/e2e/import-command.test.ts`: **2 of 3 fail** (see CR-01).

The product change is small and correct where it applies. Every `InstallPluginOutcome` "installed" producer sets `version` (`install-outcome.ts:1471`, `install-flow.ts:1523`, `install-flow.ts:1814`), and the import row now renders it. The other cucumber steps compare whole results (`recordTable`, and `lastResult` asserts exactly one result).

Main concerns:

- The D-02 change broke two e2e assertions that the phase did not update. `npm run check` does not run the e2e suite, so the local gate stays green while CI's `e2e-tests` job fails.
- In the two scope scenarios, both settings files declare the same marketplace, so those scenarios cannot catch a cross-scope marketplace read.

## Critical Issues

### CR-01: The D-02 version slot breaks two e2e assertions the phase left unchanged

**File:** `test/e2e/import-command.test.ts:189`, `test/e2e/import-command.test.ts:213`
**Issue:** D-02 adds the version to every import `installed` row (`● official-plugin v1.0.0 (installed)`). The phase updated only the `unavailable-plugin` assertion at line 191. Lines 189 and 213 still match `/ {2}● official-plugin \(installed\)/` and `/ {2}● local-plugin \(installed\)/`, which need `(installed)` right after the name. Both tests fail:

```
✖ /claude:plugin import imports enabled Claude settings across both scopes
  actual: '...● claude-plugins-official [project] (added)\n  ● official-plugin v1.0.0 (installed)...'
  expected: / {2}● official-plugin \(installed\)/
✖ /claude:plugin import --scope project narrows writes to project scope
  expected: / {2}● local-plugin \(installed\)/
```

`npm run check` leaves out the e2e suite (STACK.md), so the phase gate passes. CI's `e2e-tests` job (`ci.yml`) fails, and `publish.yml` depends on that job. D-03 already said "the e2e assertion in `test/e2e/import-command.test.ts` ... follow[s]". Only one of its three affected assertions was updated.
**Fix:**
```ts
assert.match(messages, / {2}● official-plugin v1\.0\.0 \(installed\)/);
// ...
assert.match(messages, / {2}● local-plugin v1\.0\.0 \(installed\)/);
```
Then run `node --test test/e2e/import-command.test.ts`. That is `npm run test:e2e` scoped to this file.

### CR-02: The scope scenarios cannot catch a cross-scope marketplace read

**File:** `features/plugin/import.feature:187-229`, `features/plugin/import.feature:231-273`
**Issue:** The titles say each import "reads only the project's [user's] claude code settings". The plugin half of that claim is checked, because the two files enable different plugins (`demo` and `tool`). The marketplace half is not. Both settings files declare the same `extraKnownMarketplaces.fixtures` with the same source. Suppose an implementation merges `extraKnownMarketplaces` across both files, or falls back to the other scope's marketplaces. That is a plausible regression, because upstream Claude Code merges its settings layers. It still produces `fixtures [project] (added)` and `tool installed`, so both scenarios pass. Under the cucumber skill, a scenario that a plausible wrong implementation still passes is a BLOCKER.
**Fix:** Have the settings file of the unselected scope declare a marketplace of its own, and keep it out of the result. For example, in the `--scope project` scenario:
```gherkin
    Given the marketplace "others" is published as a dir source
    Given the claude code settings file of the user scope holds this text:
      """
      {
        "enabledPlugins": { "demo@fixtures": true },
        "extraKnownMarketplaces": {
          "fixtures": { "source": { "source": "directory", "path": "{home}/marketplaces/fixtures" } },
          "others":   { "source": { "source": "directory", "path": "{home}/marketplaces/others" } }
        }
      }
      """
```
The existing whole-row `Then the result lists these plugins:` then fails if `others` appears. Mirror this in the `--scope user` scenario, with the project file declaring the extra marketplace.

## Warnings

### WR-01: The output catalog still documents unversioned import rows

**File:** `docs/output-catalog.md:2255-2335` (outside the reviewed file list, but this phase made it stale)
**Issue:** The `import` states (`scope-project-narrow`, `soft-dep-markers`, `same-mp-both-scopes`, and the both-scopes block) still show `● official-plugin (installed)` and similar rows. After D-02 the producer emits `● official-plugin v1.0.0 (installed)`. The catalog-UAT contract tests feed hand-written fixtures to `notify()`, not to the import producer, so they pass (71/71) and do not detect the drift. The both-scopes block also shows `⊘ unavailable-plugin (unavailable) {unsupported hooks}`, which matches neither the old token nor the new `{not in manifest}`.
**Fix:** Add the `vX.Y.Z` slot to every import `installed` row in those catalog blocks. Change the unavailable row to `{not in manifest}`, which matches what the e2e fixture now produces.

### WR-02: A plugin that was never installed and is not installable still reads `{no longer installable}`

**File:** `extensions/pi-claude-marketplace/orchestrators/import/execute.ts:455-456`, `extensions/pi-claude-marketplace/orchestrators/import/execute.ts:1479-1481`
**Issue:** D-01 makes the delegated verb's row the reference for every import row. For a fresh install, the resolver throws `not-installable` (`plugin-resolver.ts:740`, because `op !== "update"`). `install` then reports `(unavailable)` with the resolver's own reasons, such as `{unsupported hooks}` (`install.messaging.ts:400-417`). Import folds `not-installable` and `no-longer-installable` together and renders `{no longer installable}` for a plugin it is installing for the first time. That tells the user something false: the plugin was never installable in this scope. D-03 kept this mapping deliberately, but the autonomous discuss run recorded that choice without a prompt (CONTEXT.md "Mode"). Under the AGENTS.md parity rule, a divergence from the reference row should go to the user as a question.
**Fix:** Ask the user. The D-01-consistent fix splits the `uninstallable` arm and carries the resolver reasons the way `install` does. That means narrowing `error.shape.reasons` through the same `narrowResolverReasons` seam into the warning outcome, so a fresh import renders `(unavailable) {unsupported hooks}`.

### WR-03: `version` is optional on the outcome, so a missing version is dropped without any signal

**File:** `extensions/pi-claude-marketplace/orchestrators/import/execute.ts:93`, `extensions/pi-claude-marketplace/orchestrators/import/execute.ts:540`, `extensions/pi-claude-marketplace/orchestrators/import/execute.ts:916`
**Issue:** Nine lines further down, the doc comment on `declaresAgents` says those fields are REQUIRED "so the cascade-row build site cannot read `undefined` and silently render" a wrong row (NFR-7). `version` is the same kind of field, but it is optional and passed through two conditional spreads. Every current producer of an installed `InstallPluginOutcome` sets it. A future producer that leaves it out would compile, render `● plugin (installed)`, and pass every unit test, because the `installedOutcome()` seed has no version. This is the optional-field omission pattern the project already tracks.
**Fix:** Make `version` required on the installed arm of `InstallPluginOutcome` (`orchestrators/types.ts:556`) and on `PluginInstalledOutcome`. Assign it directly (`version: outcome.version`, `version: o.version`), and add a version to the `installedOutcome()` and `installed()` seeds.

### WR-04: The Background holds a plugin that most scenarios do not use

**File:** `features/plugin/import.feature:9-12`
**Issue:** `.agents/skills/cucumber/rules/features.md` says: "A `Background:` holds `Given` steps only, and only those that every scenario in the file needs." Only 3 of the 7 scenarios use `tool` (the disabled-entry scenario and the two scope scenarios). In the disabled-entry scenario, `tool` being offered is part of the point: it shows that `false`, and not a missing plugin, keeps `tool` out. That fact lives in the Background, away from the scenario that depends on it.
**Fix:** Move the publish and offer steps into each scenario, so the scenarios that need `tool` list it next to their own settings text. Otherwise, record a scoped exception in CONTEXT.md D-05 that cites the rule.

### WR-05: The scope scenarios do not check the unselected scope's installation record, which D-09 requires

**File:** `features/plugin/import.feature:225`, `features/plugin/import.feature:269`
**Issue:** D-09 says: "the user scope has no installed plugins and no `claude-plugins.json`". The scenarios check only the config file. The existing `the {word} scope has no installed plugins` step fails when `state.json` is absent (`installation.steps.ts:88`), which probably explains why it was left out. As a result, the title's claim "changes only the project scope" is proven only by one absent config file and by the session's skills. A stray `state.json` or marketplace record in the unselected scope would pass.
**Fix:** Add a step that states the scope has no installation record at all, for example `the {word} scope has no installation record`, which asserts that `state.json` is absent. Use it in both scenarios. Otherwise, amend D-09 so it states what the scenarios actually prove.

## Info

### IN-01: The same `{not in manifest}` token now marks two unrelated failures in one import

**File:** `extensions/pi-claude-marketplace/orchestrators/import/execute.ts:478-483`
**Issue:** This mapping existed before the phase. `unexpectedFailureReason("unexpected-failure")` renders `{not in manifest}` for any unclassified throw (`execute.test.ts:1512` pins `host crash` -> `(failed) {not in manifest}`). After D-03, an import output can show `⊘ a (unavailable) {not in manifest}` for a plugin that really is absent and `⊘ b (failed) {not in manifest}` for a crash. The token D-03 introduced to be precise is ambiguous inside the same output.
**Fix:** Track this as a follow-up: an unclassified failure needs a neutral reason token.

### IN-02: The new comment claims parity with `install`, which renders a different status

**File:** `extensions/pi-claude-marketplace/orchestrators/import/execute.ts:449-450`
**Issue:** "A plugin the marketplace does not list reads as `install` and `marketplace update` report it." `install` reports `(failed) {not in manifest}` (`install.messaging.ts:390-397`), and import reports `(unavailable) {not in manifest}`. Only the reason token matches. The comment also names neither D-03 nor D-01, which are the anchors for this choice.
**Fix:** `// D-03: a plugin the marketplace does not list carries the `not in manifest` reason that install, marketplace update, and list use.`

### IN-03: The disabled-entry scenario title says "skips", but the result has no `skipped` row

**File:** `features/plugin/import.feature:84`
**Issue:** `skipped` is a status in the product's vocabulary (`⊘ demo (skipped) {already installed}`). This scenario proves the opposite: the disabled plugin gets no row at all. A reader may expect a `skipped` row.
**Fix:** `Scenario: Importing leaves out a plugin the claude code settings disable`.

### IN-04: "Changes nothing" is checked only through declarations and three record columns

**File:** `features/plugin/import.feature:115-148`
**Issue:** The IMP-02 scenario compares the config declarations and the record's `id`, `version`, and `enabled`. It does not compare staged resources, even though the `the user scope stages these skills and prompts:` step exists. A second import that re-stages, or unstages and then restages, the skill passes as long as the outcome stays `already-installed`. That is unlikely given how the rows are built, so this is Info.
**Fix:** Optionally add `Then the user scope stages these skills and prompts:` after the second import, stating the one skill entry the first import staged.

---

_Reviewed: 2026-10-23_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

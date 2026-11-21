---
phase: 02-plugin-layers-names-and-list-fold
reviewed: 2026-11-21T19:11:56Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - features/plugin/install.feature
  - features/plugin/uninstall.feature
  - features/plugin/enable.feature
  - features/plugin/disable.feature
  - features/plugin/update.feature
  - features/plugin/reinstall.feature
  - features/plugin/configuration.feature
  - features/plugin/config-migration.feature
  - features/plugin/reserved-names.feature
  - features/plugin/list.feature
  - test/integration/plugin-layer-verbs.test.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/list-flow.ts
  - test/orchestrators/plugin/list-flow.test.ts
findings:
  critical: 1
  warning: 6
  info: 3
  total: 10
  necessity: 1
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-11-21T19:11:56Z
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

Scope: the diff since `8cc0eee`, plus a check of each case in the three deleted integration files (`fold-adoption`, `plugin-layer-consistency`, `reserved-record-keys`) and of the LAYER-04 and LAYER-08 cases removed from `plugin-layer-verbs.test.ts`. For each case I looked for a scenario that fails on the same bug. Step definitions were read where a scenario's strength depends on them: `config.steps.ts`, `command.steps.ts`, `plugin/installation.steps.ts`, `marketplace/checkout.steps.ts`, and `lib/field-rows.ts`. Full-suite results were not re-run, as instructed.

Most cases carry over at equal or better strength. Plugin-row, field, and declaration tables compare the whole set, and an extra column fails, so result rows are pinned exactly. The installation-record steps read own keys only, which keeps the `constructor` own-record guarantee. Nothing outside `.planning/` still cites the deleted files. The `list-flow.ts` and `list-flow.test.ts` changes only touch comments.

Two kinds of regression came from replacing whole-tree byte snapshots with narrower checks:

- The deleted LAYER-06 tests snapshotted the whole scope tree. Two of the scenarios that replace them check the local layer's `plugins` map only, so a wrong "repair" that writes the marketplace into the local layer still passes (CR-01).
- The `__proto__` refusal and the absent-name cases lost their whole-home snapshot (WR-01).

One fold case from `fold-adoption.test.ts` step 2 was swapped for a different case, not carried over (WR-03).

Structural findings: none provided.

## Critical Issues

### CR-01: "Changes nothing" LAYER-06 apply scenarios do not check the local layer's marketplaces, a weaker check than the deleted test

**File:** `features/plugin/configuration.feature:141-143` (project scope) and `features/plugin/configuration.feature:206-208` (user scope)
**Issue:** The deleted `plugin-layer-consistency.test.ts` cases "a local layer that declares a plugin whose marketplace only the base layer declares stops the reload and changes no file" and "a local layer of the user scope ..." compared `treeBytes(scopeRoot)` before and after. The scenarios that replace them check less:
- `the config and installation record bytes ... are unchanged` reads only `claude-plugins.json` and `state.json` (`features/step_definitions/config.steps.ts:55-61`).
- `the "claude-plugins.local.json" file ... declares these plugins:` compares only the `plugins` member (`config.steps.ts:113-137`).

So a wrong implementation passes both scenarios when it reports the layer error and also "repairs" the local layer by copying the base layer's `fixtures` declaration into its `marketplaces` member. The `install --local` path already contains exactly this LAYER-06 step ("A layer that gets a plugin declaration also gets its marketplace's"), so reusing it in apply's read pass or install step is a plausible regression. Both titles promise "changes nothing", and the commit message of `25954ec` claims full coverage. Per the cucumber skill, a scenario that a plausible wrong implementation passes is a BLOCKER. Per the unit-test skill, a revision that weakens assertions is also a finding.
**Fix:** Pin the local layer completely. The existing step used at `configuration.feature:97` is enough:
```gherkin
    Then the "claude-plugins.local.json" file of the project scope declares these plugins:
      | id            |
      | demo@fixtures |
    Then the "claude-plugins.local.json" file of the project scope declares no marketplaces
```
Add the same line (with `user scope`) after line 208. Another option is to write the local layer with `a config in scope ... with this text:` and assert `holds this text:` byte for byte, as the scenario at line 213 does. The pending scenario at `features/plugin/config-migration.feature:214-216` ("writes no project config") has the same blind spot and takes the same one-line fix.

## Warnings

### WR-01: The `__proto__` refusal and the absent-`constructor` cases lost their whole-home "no file changed" snapshot

**File:** `features/plugin/reserved-names.feature:390-412`, `:414-440`, `:442-468`, `:470-490`
**Issue:** In the deleted `reserved-record-keys.test.ts`, the refused install of `__proto__@hostile` and all eight absent-name commands asserted `treeBytes(root)` unchanged over the whole hermetic home. The scenarios check only these:
- the base config and `state.json` bytes
- the local config's absence (`__proto__` only)
- the staged skill and prompt directory names

Plugin data directories, the `agents/` directory, `mcp-adapter.json`, `sources/`, `plugin-clones/`, and the on-disk completion-cache index are no longer covered. The `__proto__` id refusal is raised in the cascade layer (`orchestrators/plugin/install-cascade.messaging.ts:421`), after install planning starts. So a regression that creates the plugin's data directory, or a completion-cache file for `constructor`, before refusing would now pass. I rated this a WARNING, not a BLOCKER, because the record, both configs, and the staged resources (where a real install would land) are still pinned.
**Fix:** Add a step that snapshots and compares the whole scope tree, for example `the files of the project scope are remembered` / `... are unchanged`. Put it in `config.steps.ts` or a scope module, as a foundation-owned change. Use it in these scenarios and in the two CR-01 scenarios in place of the narrower byte step.

### WR-02: The update-refusal scenarios check staged skill names only, so a content swap before the refusal passes

**File:** `features/plugin/update.feature:188-213`, `features/plugin/update.feature:215-249`
**Issue:** Both scenarios publish a newer version (1.1.0) and then assert `the project scope stages these skills and prompts:`. That step compares only directory names (`plugin/installation.steps.ts:451-461`). An update that swaps the staged `demo-skill` / `pp-skill` files to 1.1.0 and only then fails on the unreadable layer leaves `state.json` and the config unchanged, and the same names staged, so it passes. The title says "changes nothing". The skill description carries the version (`A skill of demo 1.0.0.`, as at `features/plugin/update.feature:76-84` and `disable.feature:56-57`), so the scenario can pin the content.
**Fix:** After the existing Thens, add the session check that other files already use:
```gherkin
    When the user starts a new pi session
    Then the session offers these skills:
      | command           | description            |
      | /skill:demo-skill | A skill of demo 1.0.0. |
```
This needs a second `When`, so a separate scenario is cleaner, for example "Updating a plugin while the local config cannot be read keeps the installed version's skills".

### WR-03: Step 2 of `fold-adoption.test.ts` (a cloned fold beside an independent project marketplace) was replaced with a different case

**File:** `features/plugin/list.feature:229-257`
**Issue:** The deleted step 2 installed `alpha` into the project from a user marketplace, which gives the project a cloned record and folds the plugin. It then added an independent, differently named project marketplace that also offers `alpha`, and asserted three things:
- `alpha [project]` stays folded under the user header.
- `alpha` shows `(available)` under the new project header.
- The user header has no duplicate `(available)` alpha row.

The new scenario adds the same-name, different-source project marketplace before the install, so the project never holds a cloned record and no fold happens in that list. Neither new scenario lists a folded row and a non-folded project header at the same time. So the case where `computeOrphanFold` runs beside a second project-side enumeration that offers the same plugin name is no longer covered end to end. Commit `5019c44` says this scenario "covers the independent project marketplace".
**Fix:** Add a scenario that keeps the old order: add `official` to the user scope, install `alpha@official --scope project` (cloned fold), add an independent project marketplace (such as `team`, with its own name) that offers `alpha`, then run `list` and assert the full table: folded `alpha [project]` installed under `official [user]`, and `alpha@team` available under `team [project]`.

### WR-04: The title claims "no duplicate row", but the table shows `alpha@official` twice

**File:** `features/plugin/list.feature:229`
**Issue:** The title ends "under its own header with no duplicate row", and the table at lines 254-256 lists two `alpha@official` rows: one installed under `official [project]`, one available under `official [user]`. A reader cannot tell from the scenario which duplicate is ruled out. That knowledge (a folded copy of the installed row under the user header) lives only in `computeOrphanFold`'s JSDoc. This fails the skill's "understand it without opening a step definition" test.
**Fix:** Name the outcome the table shows, for example: "The unfiltered list shows a plugin installed from a project marketplace that shares a user marketplace's name but not its source under the project header, and offers the user marketplace's copy as available".

### WR-05: The title states a history that the steps do not set up

**File:** `features/plugin/configuration.feature:213-219`
**Issue:** The title says the local layer is one "that an earlier --local install wrote without its marketplace". The steps run a current-release `install --local`, which declares the marketplace in the local layer, and then overwrite the file by hand. A reader can conclude that today's `--local` install writes a layer without its marketplace, which contradicts `install.feature`'s "Installing with --local from a marketplace only the base layer declares also declares the marketplace in the local layer". The "earlier release" premise exists only in the title.
**Fix:** Retitle as a hand edit, for example "Applying reports a local layer edited to drop its marketplace, keeps it byte for byte, and keeps the plugin installed (LAYER-06, CFG-03)". Another option is a `Given` that names the earlier-release shape, as `config-migration.feature` does for release 0.4.3.

### WR-06: Generality without instantiation: one-element fixture loop and a version parameter left over from the trim

**File:** `test/integration/plugin-layer-verbs.test.ts:34-39`, `:49-71`, `:110`
**Category:** necessity
**Issue:** After the trim, `PLUGINS` holds one entry (`alpha`). `FixturePlugin` wraps a single `name` field, `publish` loops over that one-element array, and its `version` parameter has exactly one call site, which always passes `"1.0.0"` (line 110). The `1.1.0` publish and the `app`/`lib` dependency fixtures that justified the abstraction were deleted with the LAYER-08 cases. Line 110 and the `PLUGINS` literal at line 39 show this. The helper now suggests to a reader that several plugins and versions matter here, and none do.
**Fix:** Inline the fixture: drop `FixturePlugin` and `PLUGINS`, make `publish(source)` write `mp` with the single `alpha` plugin at `1.0.0`, and update its JSDoc.

## Info

### IN-01: "fails as an invalid config" in the new configuration titles, "fails as an invalid manifest" in the verb titles, for the same `invalid manifest` reason

**File:** `features/plugin/configuration.feature:117`, `:148`, `:182`, versus `features/plugin/install.feature:274` and siblings
**Issue:** The two sets of scenarios added in this phase report the same reason (`invalid manifest`) under two names. A reader who searches titles for one wording misses the other set.
**Fix:** Pick one wording. The reason column says `invalid manifest`. The pre-existing configuration titles say "reported as an invalid config".

### IN-02: The pre-migration apply scenario does not pin the config files

**File:** `features/plugin/config-migration.feature:218-248`
**Issue:** The scenario checks the record and the staged skills. It does not check whether apply's read pass (which runs MIG-01) writes `claude-plugins.json`, or leaves the local layer as it was. Its pending sibling at line 191 does check this. The deleted test did not check it either, so nothing was lost, but the scenario's file outcome is unspecified.
**Fix:** Add `the "claude-plugins.json" file of the project scope does not exist` (or the declarations it should hold) and `the "claude-plugins.local.json" file ... declares no marketplaces`.

### IN-03: The `computeOrphanFold` JSDoc cites scenarios as regression guards for carry-over arms they do not exercise

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/list-flow.ts:545-547`
**Issue:** "Regressions:" follows a paragraph about the `disabled`, `upgradable`, `partially-installed`, and `partially-upgradable` carry-over arms. The cited list scenarios fold only an `installed` row (`list.feature:224-227`). Those arms are guarded only by the unit tests (`list-flow.test.ts:2172` and the `plugin list manifest absent` cases).
**Fix:** Say what the scenarios cover, for example "the CMC-21 / D-13-17 fold scenarios of features/plugin/list.feature (installed rows) and the CR-01 / G-21-01 case ...".

---

_Reviewed: 2026-11-21T19:11:56Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

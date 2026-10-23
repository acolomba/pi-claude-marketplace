---
phase: 07-plugin-update-by-marketplace-constraint-and-partial
reviewed: 2026-10-23T00:00:00Z
depth: standard
files_reviewed: 1
files_reviewed_list:
  - features/plugin/update.feature
findings:
  critical: 1
  warning: 6
  info: 3
  total: 10
status: issues_found
---

# Phase 7: Code Review Report

**Reviewed:** 2026-10-23
**Depth:** standard
**Files Reviewed:** 1 (the five scenarios at `features/plugin/update.feature:243-371`)
**Status:** issues_found

## Summary

I reviewed the five new scenarios against `.agents/skills/cucumber/SKILL.md` and its `rules/features.md`, `rules/steps.md`, and `rules/layout.md`. I also read D-01..D-10 in `07-CONTEXT.md` and the plan's intent in `07-01-PLAN.md`. I traced each step to its definition (`command.steps.ts`, `session.steps.ts`, `plugin/installation.steps.ts`, `plugin/publishing.steps.ts`, `lib/field-rows.ts`, `lib/result-rows.ts`). I also traced the product paths the outcomes depend on (`orchestrators/plugin/info.ts`, `list-installed-row.ts`, `update-swap.ts`, `update-preflight.ts`). As instructed, I did not run cucumber.

The mechanics are sound. Every field and row step compares whole values: `namesLike` and `recordTable` add every unstated column, `lastResult()` requires exactly one payload, and the record and skills steps compare the whole sorted set. The tables are aligned, the steps are lower case, no `And` or `But` appears, and no `Given` comes after a `When`.

The gaps are in what the scenarios observe:

- The `--partial` update scenario never looks at the parts it claims to install.
- No scenario observes the partial state that `update --partial` persists. For a dir-source plugin, `info` re-resolves the published plugin live, so the info scenario observes almost nothing that the update produced.
- Two titles claim more than their scenarios show: "fails" for a warning, and "names the component" for a reason class.

## Critical Issues

### CR-01: The `--partial` update scenario never checks the parts it says it installs

**File:** `features/plugin/update.feature:333-348`
**Issue:** The title says the update "installs the parts Pi supports", but no step looks at an installed part:

- The row's `partially-installed` status and `1.1.0` version come from the update's own outcome (`partialDegrade` in `update-swap.ts:1467-1472`), not from disk.
- `the installation record of the project scope holds these plugins:` projects only `id`, `version`, and `enabled` (`installation.steps.ts:202-211`). It never reads `resources.skills`, and it never reads the staged files.

A plausible wrong implementation passes. One example is a partial swap that writes the 1.1.0 record but leaves the 1.0.0 skill staged. Another is a partial swap that drops the skills together with the unsupported output style. Either one gives the same row and the same record. The non-partial counterpart already has a separate session check for this risk (`update.feature:28-36`, "A new session offers the skills of the updated version"). The `--partial` path has none.
**Fix:** Add the session check that tells the versions apart. Only the skill description carries the version: `the project scope stages these skills and prompts:` shows `demo-skill` for both 1.0.0 and 1.1.0.
```gherkin
    Then the installation record of the project scope holds these plugins:
      | id            | version | enabled |
      | demo@fixtures | 1.1.0   | true    |
    When the user starts a new pi session
    Then the session offers these skills:
      | command           | description            |
      | /skill:demo-skill | A skill of demo 1.1.0. |
```
You can also put it in a separate scenario that mirrors line 28: "A new session offers the skills of a version updated with --partial". If the new session reports a result, the scenario must state it, because the world fails on uncompared session results.

## Warnings

### WR-01: No scenario observes the partial state that `update --partial` persists, and the info scenario cannot

**File:** `features/plugin/update.feature:333-371`
**Issue:** `applyAllSuccessRecordFields` writes `compatibility.unsupported` from the new candidate (`update-swap.ts:748-753`). `list` reads that persisted field through `classifyInstalledRecord` to choose `partially-installed` (`list-installed-row.ts:124-137`). For a path-source plugin, `info` does not read it: `buildInstalledRow` calls `resolveStrict` on the live marketplace directory, and it takes `status`, `reasons`, and `components` from that call (`info.ts:2312-2351`). Only `plugin version` comes from the record (`info.ts:1363-1368`). So the info scenario at 350-371 shows the published plugin as it is now, and the only thing it shows about the update is the version.

Suppose an update persists the old empty `unsupported` list. The intent mark already carries the old list forward on failure (`update-swap.ts:740-743`), so this is an easy regression. After it, `list` shows `installed` instead of `partially-installed`, and all five new scenarios still pass.
**Fix:** Add a scenario that reads the persisted state, as line 38 does for the plain update. For example: "The plugin list shows a plugin updated with --partial as partially installed". It runs `update ... --partial` as setup, then `When the user runs "/claude:plugin list --scope project"`, and expects a `partially-installed` row with the reasons `unsupported component` and the version `1.1.0`. Keep the info scenario only if D-09 still needs it, and give it the title from WR-02.

### WR-02: The info scenario's title says it names the component it left out, but it names only a reason class

**File:** `features/plugin/update.feature:350`
**Issue:** "Info on a plugin updated with --partial names the component it left out". No field of the result names the output style. `plugin reasons` is `unsupported component`, which is the class, and D-09 confirms that the JSON carries no list of component kinds. A reader who never opens a step definition expects to see the output style named. The title also describes the scenario as being about the update, but WR-01 shows that the info output comes from the live published plugin.
**Fix:** Name what the scenario shows, for example: "Info on a plugin updated with --partial reports it partially installed for an unsupported component".

### WR-03: The title says "fails", but the result is a warning that holds the update

**File:** `features/plugin/update.feature:315`
**Issue:** "... fails without --partial and keeps the installed version". The scenario states `severity warning`, the summary "A plugin operation needs attention.", and the status `partially-upgradable`. D-10 records that this is a warning decline, not an error, and the rest of the file uses "fails" only for error results (lines 66 and 152). A reader of the title expects `severity error`.
**Fix:** Name the behavior the scenario shows: "Updating a plugin whose new version is only partially available without --partial holds the update and keeps the installed version". This matches the wording of the UPD-03 scenario at line 282.

### WR-04: "Keeps the installed version" is proven by the record alone

**File:** `features/plugin/update.feature:315-331`
**Issue:** The scenario checks only the installation record (id, version, enabled). The other "nothing changed" scenarios in this file also check what a new session offers: line 66-86 for the `--local` failure, and the new UPD-03 scenario at 282-313. Today the partial gate runs in preflight, before the swap (`update-preflight.ts:388-415`). But if a change moves the gate after a bridge commit, the record stays at 1.0.0 while a 1.1.0 skill is staged, and this scenario still passes.
**Fix:** Add `When the user starts a new pi session` and `Then the session offers these skills:` with `| /skill:demo-skill | A skill of demo 1.0.0. |`, as line 308-313 does.

### WR-05: The constraint scenario does not need the Background

**File:** `features/plugin/update.feature:282-313` (Background at 7-13)
**Issue:** `rules/features.md` says: "A `Background:` holds `Given` steps only, and only those that every scenario in the file needs." The UPD-03 scenario uses only the `tools` marketplace. `demo@fixtures` appears in its record and session tables only because the Background installed it. The scenarios at 120, 152, and 198 already break this rule, and this scenario adds one more. D-02 chose to reuse the Background, but the rule has no exception for that.
**Fix:** Move the dependency-constraint scenario into a dependency-focused update feature without this Background, as `features/plugin/install-dependencies.feature` does for install. Because phase ownership allows only `update.feature`, record this as a follow-up if it cannot move in this phase.

### WR-06: Nothing shows that an update inside the dependent's range still goes through

**File:** `features/plugin/update.feature:282-313`
**Issue:** The scenario proves that `lib` 2.0.0 is held by `lib@^1.0.0`. The cause chain pins the computed range text (`>=1.0.0 <2.0.0-0`), so a wrong caret expansion fails. But a gate that holds every dependency with any declared range passes this scenario. The only update of a dependency in this file (line 120-150) uses a dependency without a range, so no scenario covers an update inside the range.
**Fix:** Add a sibling scenario. For example, "Updating a dependency within the version range its dependent declares updates it" offers `lib` 1.1.0 against `lib@^1.0.0`, expects an `updated` row from 1.0.0 to 1.1.0, and expects the record to show `lib@tools 1.1.0`.

## Info

### IN-01: The UPD-01 scenario does not cover an up-to-date plugin of the target marketplace or the other marketplace's skills

**File:** `features/plugin/update.feature:243-280`
**Issue:** Per D-03, the installation record is enough to show that `app@tools` keeps 1.0.0. The title says "each outdated plugin", but every `fixtures` plugin is outdated. So the scenario never shows that an up-to-date plugin of `@fixtures` is skipped rather than reinstalled. A session check would also show that `app`'s staged skill is still 1.0.0.
**Fix:** Optional. Add a third `fixtures` plugin that stays at 1.0.0 (its expected row is `skipped`, `up-to-date`). You can also add a session check that lists `/skill:app-skill | A skill of app 1.0.0.`.

### IN-02: The requirement text of UPD-03 describes the other direction

**File:** `.planning/REQUIREMENTS.md:56`, `.planning/ROADMAP.md:266`
**Issue:** UPD-03 and SC-2 read "a dependency whose version constraint the new version breaks blocks the update" and "an update whose new version breaks a dependency's version constraint". This is the case where the plugin's new version declares a range that the installed dependency does not meet. D-05 says that case goes through by design, and D-04 tests the dependency-side hold instead. When UPD-03 is marked complete, the traceability claims a behavior that no scenario covers.
**Fix:** Reword UPD-03 and SC-2 to the D-04 behavior, and point to D-05 for the deferred direction.

### IN-03: The partial update row has no `from` or `to`, unlike an `updated` row

**File:** `features/plugin/update.feature:344-345`
**Issue:** The whole-row comparison pins a `partially-installed` row that carries only `version 1.1.0`, while `updated` rows carry `from` and `to` (lines 25-26 and 273-275). A user of `update --partial` does not see the version move. This is product behavior, not a defect in the scenario.
**Fix:** If this is not intended, raise it as a product question. Otherwise, no action is needed.

---

_Reviewed: 2026-10-23_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

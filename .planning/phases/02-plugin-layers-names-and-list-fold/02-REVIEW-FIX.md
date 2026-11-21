---
phase: 02-plugin-layers-names-and-list-fold
fixed_at: 2026-11-21T20:05:00Z
review_path: .planning/phases/02-plugin-layers-names-and-list-fold/02-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Phase 02: Code Review Fix Report

**Fixed at:** 2026-11-21T20:05:00Z
**Source review:** .planning/phases/02-plugin-layers-names-and-list-fold/02-REVIEW.md
**Iteration:** 1

**Summary:**

- Findings in scope: 7 (CR-01, WR-01..WR-06; the orchestrator put the necessity finding WR-06 in scope)
- Fixed: 7
- Skipped: 0
- Out of scope, left in REVIEW.md: IN-01, IN-02, IN-03

## Where verification ran

Everything ran in the main checkout on `claude/stoic-shannon-la9q7o`. The orchestrator's binding note said to work there, so no worktree was created. Each red proof edited `extensions/` in the main checkout, ran the scenarios, and was reverted with `git checkout -- extensions/`. No break was committed. At the end, `git status --porcelain -- extensions/` printed nothing.

Final gates, run on HEAD `9970e43`:

- `npm run check:static`: typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, and check:features all passed.
- Adapter profile over every touched feature file, plus `features/marketplace/state-lock.feature`, which shares the edited `scope-state.steps.ts`: 127 scenarios and 1659 steps passed.
- `node --import "$PWD/scripts/isolated-pi-home.mjs" --test test/integration/plugin-layer-verbs.test.ts`: 2 passed, 0 failed.
- Builtin profile: not run. It selects none of these untagged scenarios.

## Fixed Issues

### CR-01: "Changes nothing" LAYER-06 apply scenarios do not check the local layer's marketplaces

**Files modified:** `features/plugin/configuration.feature`, `features/plugin/config-migration.feature`
**Commit:** 4724154
**Applied fix:** Added `Then the "claude-plugins.local.json" file of the <scope> scope declares no marketplaces` to three scenarios: the project-scope and user-scope apply scenarios, and the pending scenario that runs before the first-run migration. WR-01 (f972b3e) then replaced the narrow byte step in the two apply scenarios with the whole-scope file comparison.
**Red proof:** The break made `read-pass.ts` (apply) and `pending.ts` (pending) copy the other layer's marketplaces into the gap layer's config file before reporting the gap.

- With the new lines, these scenarios fail on the new step with `...claude-plugins.local.json declares marketplaces: {..."marketplaces":{"fixtures":...}}`:
  - `2) Applying a local layer ... (LAYER-06, CFG-03) # features/plugin/configuration.feature:117`
  - `3) Applying the user scope ... (LAYER-06, CFG-03) # features/plugin/configuration.feature:183`
  - `5) Pending before the first-run migration ... (MIG-01, LAYER-06) # features/plugin/config-migration.feature:191`
- Without the new lines (feature edits stashed), the same break let all three pass, which confirms the review's claim. Reverted.

### WR-01: The `__proto__` refusal and the absent-`constructor` cases lost their whole-home snapshot

**Files modified:** `features/step_definitions/scope-state.steps.ts`, `features/support/world.ts`, `features/plugin/reserved-names.feature`, `features/plugin/configuration.feature`
**Commit:** f972b3e
**Applied fix:**

- New steps `Given the files of the {word} scope are remembered` and `Then the files of the {word} scope are unchanged`. They list every entry under the scope root, recursively and in path order: a directory as `path/`, a file with its bytes, a link with its target. So a new empty directory fails the comparison too.
- The world holds the remembered lists in `rememberedScopeFiles`, typed `ScopeFiles`.
- The new steps replace the config-and-record byte step in the four reserved-name scenarios (nine examples in all) and in the two CR-01 apply scenarios. The user-scope run, which snapshots the whole agent directory, was stable.

**Red proof:** Two breaks:

- `install-cascade.messaging.ts` created `.pi/pi-claude-marketplace/data/hostile/__proto__/` while it built the invalid-id cause.
- `edge/router.ts` wrote `.pi/pi-claude-marketplace/cache/constructor.json` after any command whose arguments name `constructor`.

All nine examples failed on `Then the files of the project scope are unchanged # features/step_definitions/scope-state.steps.ts:70`:

- `features/plugin/reserved-names.feature:390`
- `:437`, `:438`, `:439`, `:440`
- `:466`, `:467`, `:468`
- `:470`

The `__proto__` diff showed the added `pi-claude-marketplace/data/hostile/__proto__/` entry. Reverted.

### WR-02: The update-refusal scenarios check staged skill names only

**Files modified:** `features/plugin/update.feature`
**Commit:** ca3fa46
**Applied fix:** The two LAYER-04 refused-update scenarios now remember and compare every file of the project scope, through the WR-01 steps, in place of the config-and-record byte step. This pins the staged skill bytes, so the version in the skill description is pinned too, without the second `When` that the review's session-check option needed. The existing Thens stay as they were.
**Red proof:** The break made `refuseOtherLayerUpdate` (`update-flow.ts`) rewrite the staged `<plugin>-skill/SKILL.md` from 1.0.0 to 1.1.0 before it threw the refusal.

- With the fix, both scenarios fail on `Then the files of the project scope are unchanged`, and the diff names `resources/skills/demo-skill/SKILL.md` and `resources/skills/pp-skill/SKILL.md`:
  - `features/plugin/update.feature:188`
  - `features/plugin/update.feature:215`
- With the feature file at its prior revision, both passed under the same break.
- The unrelated `update.feature:158` also failed under this break, on its session-skills step. Reverted.

### WR-03: Step 2 of `fold-adoption.test.ts` was replaced with a different case

**Files modified:** `features/plugin/list.feature`
**Commit:** 3f4e117
**Applied fix:** Restored the deleted step-2 case as a new scenario: "The unfiltered list keeps a plugin the project installed from a user marketplace under that marketplace beside a project marketplace that offers a plugin of the same name (CMC-21, D-13-17)". It keeps the old order:

1. Add `official` to the user scope.
2. Run `install alpha@official --scope project`, which folds the plugin.
3. Add the independent project marketplace `team`, which offers `alpha` 0.9.0.
4. Run `list`.

The table states the full result: `alpha@official` installed `[project]` under `official [user]`, and `alpha@team` available under `team [project]`. The user header has no duplicate available row, and the project scope shows no `official` header.
**Red proof:** The break passed the project's installed plugin names, from every project marketplace, as `excludeFromAvailable` to each project-scope block in `loadPluginListPayload` (`list-flow.ts`). Only the new scenario failed, `1) The unfiltered list keeps a plugin ... (CMC-21, D-13-17) # features/plugin/list.feature:229`, on `Then the result has these fields:` with the tally success count 1 against the expected 2. The other 15 list scenarios passed, so no existing scenario covers this case. Reverted.

### WR-04: The title claims "no duplicate row", but the table shows `alpha@official` twice

**Files modified:** `features/plugin/list.feature`
**Commit:** 904daad
**Applied fix:** Retitled the scenario as the review suggested: "The unfiltered list shows a plugin installed from a project marketplace that shares a user marketplace's name but not its source under the project header, and offers the user marketplace's copy as available (CMC-21, D-13-17)". Only the title changed, so no red proof applies. No file outside `.planning/` cited the old title.

### WR-05: The title states a history that the steps do not set up

**Files modified:** `features/plugin/configuration.feature`
**Commit:** 4a24414
**Applied fix:** Retitled the scenario as a hand edit: "Applying reports a local layer edited to drop its marketplace, keeps it byte for byte, and keeps the plugin installed (LAYER-06, CFG-03)". Only the title changed, so no red proof applies.

### WR-06: Generality without instantiation: one-element fixture loop and a version parameter left over from the trim

**Files modified:** `test/integration/plugin-layer-verbs.test.ts`
**Commit:** 9970e43
**Status:** fixed: requires human verification (a necessity finding that removes code)
**Applied fix:** Removed `FixturePlugin` and `PLUGINS`. `publish(source)` now writes the marketplace `mp` with the single plugin `alpha` at 1.0.0, and its JSDoc says so. The fixture bytes are the same as before: the same `marketplace.json`, `plugin.json`, and `SKILL.md`. Neither test changed its assertions.
**Red proof:** Both tests still pass after the change. The break made `install-flow-ledger.ts` write `{"schemaVersion":1,"plugins":{"alpha@mp":{}}}` to the target layer before it returned the standalone refusal. Under it, "LAYER-06: install --local is refused and changes nothing ..." failed and the other test passed. The other test pins both layer configs in full with `deepStrictEqual`. Reverted.

---

_Fixed: 2026-11-21T20:05:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_

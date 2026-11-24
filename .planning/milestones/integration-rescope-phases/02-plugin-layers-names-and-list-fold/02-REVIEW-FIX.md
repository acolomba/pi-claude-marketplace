---
phase: 02-plugin-layers-names-and-list-fold
fixed_at: 2026-11-21T19:44:24Z
review_path: .planning/phases/02-plugin-layers-names-and-list-fold/02-REVIEW.md
iteration: 2
findings_in_scope: 2
fixed: 2
skipped: 0
status: all_fixed
---

# Phase 02: Code Review Fix Report

**Fixed at:** 2026-11-21T19:44:24Z
**Source review:** .planning/phases/02-plugin-layers-names-and-list-fold/02-REVIEW.md
**Iteration:** 2

**Summary:**

- Findings in scope: 2 (WR-01, WR-02; scope `critical_warning`)
- Fixed: 2
- Skipped: 0
- Out of scope, left in REVIEW.md: IN-01, IN-02, IN-03, IN-04

## Fixed Issues

### WR-01: The unscoped `constructor` commands read the user scope, but only the project scope is pinned

**Files modified:** `features/plugin/reserved-names.feature`
**Commit:** 50fed6c
**Applied fix:** The Outline "A command that names the absent marketplace constructor fails as marketplace not added and changes nothing (D-08-07)" now also runs `Given the files of the user scope are remembered` before the command, and `Then the files of the user scope are unchanged` after the project-scope check. All four examples (`info`, `reinstall`, `marketplace update`, `marketplace remove`) pass with the new steps. As the orchestrator directed, I left the scoped scenarios (`--scope project`) unchanged.

**Red proof:** In the bare-form miss branch of `resolveScopeOrNotifyNotAdded` (`orchestrators/marketplace/shared.ts`), I made the code create `pi-claude-marketplace/` and write `pi-claude-marketplace/red-proof` under the user scope before it reports `marketplace not added`. Result under the adapter profile:

```
  1) A command that names the absent marketplace constructor fails as marketplace not added and changes nothing (D-08-07) # features/plugin/reserved-names.feature:442
       Then the files of the user scope are unchanged # features/step_definitions/scope-state.steps.ts:70
           AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
           +     'pi-claude-marketplace/',
           +     'pi-claude-marketplace/red-proof',
  2) A command that names the absent marketplace constructor fails as marketplace not added and changes nothing (D-08-07) # features/plugin/reserved-names.feature:441
4 scenarios (2 passed, 2 failed)
```

Rows `:441` (`marketplace update constructor`) and `:442` (`marketplace remove constructor`) failed on the new user-scope assertion. The `info` and `reinstall` rows do not run through that helper, so they passed. I reverted the break with `git checkout --`.

Note: my first attempt put the same write in `remove.ts`'s `resolveScopeOrFailedOutcome`. The scenario stayed green, because that function runs only in orchestrated mode (apply), and the typed command takes the standalone `resolveScopeOrNotifyNotAdded` path. That shows the break has to be on the path the command really runs. It does not show a gap in the scenario.

### WR-02: The base-layer mirror of the LAYER-06 apply trio still uses the narrow byte step

**Files modified:** `features/plugin/configuration.feature`
**Commit:** a49b3a7
**Applied fix:** In "Applying a base layer that declares a plugin whose marketplace only the local layer declares fails as an invalid config and changes nothing (LAYER-06, CFG-03)", I replaced `the config and installation record bytes of the project scope are remembered` / `are unchanged` with `the files of the project scope are remembered` / `are unchanged`, as its two sibling scenarios do. The narrow step has about 70 other uses, so `check:features` does not flag it as unused.

**Red proof:** In `layerMarketplaceGapOutcomes` (`orchestrators/reconcile/read-pass.ts`), I made the code create `pi-claude-marketplace/data/demo-fixtures/` whenever a layer gap is found, before apply refuses. Result under the adapter profile:

```
  1) Applying a base layer that declares a plugin whose marketplace only the local layer declares fails as an invalid config and changes nothing (LAYER-06, CFG-03) # features/plugin/configuration.feature:149
       Then the files of the project scope are unchanged # features/step_definitions/scope-state.steps.ts:70
           AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
           +     'pi-claude-marketplace/data/demo-fixtures/',
1 scenario (1 failed)
```

**Control:** With the same break in place and the old feature text restored, the scenario passed (`1 scenario (1 passed)`). So the old narrow step let this regression through, and the change is what catches it. I then reverted the break and restored the new feature text.

## Verification

All checks ran in the main checkout on `claude/stoic-shannon-la9q7o`. I created no worktree, as the orchestrator directed. The results can be reproduced from that tree.

- `npm run check:static`: passed (typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features).
- `npm run test:cucumber:profile -- --profile adapter --parallel 2 features/plugin/reserved-names.feature features/plugin/configuration.feature`: 36 scenarios passed, 456 steps passed.
- `git status --porcelain -- extensions/`: empty. I did not commit any of the red-proof breaks.
- The pre-commit hook ran on both commits. `npm-check` skipped them, because a `.feature` file is not a build input.
- I did not run the builtin profile: neither scenario has an MCP tag, so the builtin profile does not select them.

---

_Fixed: 2026-11-21T19:44:24Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 2_

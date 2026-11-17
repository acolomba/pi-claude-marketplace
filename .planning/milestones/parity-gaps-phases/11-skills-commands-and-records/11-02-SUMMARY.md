---
phase: 11-skills-commands-and-records
plan: "02"
subsystem: aliases
status: complete
tags: [aliases, skills, commands, PG-SKILL-11, D-PG11-09]
requires:
  - 11-01 (the stored Claude Code command name in the alias table)
provides:
  - PluginAliasTarget["menu"] (AliasMenuText, required on both arms)
  - a description on each alias suggestion, built as pi-tui 1.5.0 builds a native row
affects:
  - extensions/pi-claude-marketplace/orchestrators/skill-alias-state.ts
  - extensions/pi-claude-marketplace/edge/skill-aliases.ts
tech-stack:
  added: []
  patterns:
    - required carrier member (`menu`) so every builder states it
    - escaped U+2014 separator constant (fix-unicode-dashes hook)
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/skill-alias-state.ts
    - test/orchestrators/skill-alias-state.test.ts
    - extensions/pi-claude-marketplace/edge/skill-aliases.ts
    - test/edge/skill-aliases.test.ts
    - test/orchestrators/typed-expansion.test.ts
    - features/slash-command/aliases.feature
    - features/slash-command/frontmatter.feature
    - features/skill/aliases.feature
decisions:
  - "`claimedAliases` now maps an alias to its whole first claim (entry, names, menu), so `loadPluginNames` takes the entry name and the menu text in one place, with no second lookup by name."
  - "`AliasMenuText` is exported so the edge's `menuDescription` can name it; the edge is its production consumer, so fallow sees no unused export."
requirements-completed: [PG-SKILL-11]
metrics:
  duration: ~40m
  completed: 2026-11-15
actuals:
  tokens: 21000
  tasks: 2
  commits: 2
plan_head_before: c1cca52da0c8ffc66ecfa1d6f694e2480eaa4f32
plan_head_after: 31cb8d6a31bdf60d660aa4fc8e60c5fdceccac79
---

# Phase 11 Plan 02: Alias menu text Summary

An alias row in Pi's terminal menu now shows its target's argument hint and description. The text is joined the way pi-tui 1.5.0 joins a native command row: hint, space, U+2014, space, description, or either part alone. Both parts come from the staged frontmatter that the alias table already parses for the names. A non-string `argument-hint` reads as Claude Code 2.1.323 reads it (`String()`), so `[change]` shows `change`. A mapping or a nested list shows no hint.

## Commits

| Task | Commit | Title |
| --- | --- | --- |
| 11-02-01 | b5fd1c2d | feat(aliases): show a description on alias suggestions |
| 11-02-02 | 31cb8d6a | feat(aliases): read a list argument hint as Claude Code does |

## Red runs (before the change)

Task 1: `npm run test:cucumber:profile -- --profile adapter features/slash-command/aliases.feature features/slash-command/frontmatter.feature features/skill/aliases.feature`, with only the feature edits in the tree: `29 scenarios (26 passed, 3 failed)`, `368 steps (365 passed, 3 failed)`. Each failure was at `Then pi's terminal menu offers these slash commands:` (`frontmatter.steps.ts:146`):

- `aliases.feature:130`, row `demo:fancy`: actual description `""`, expected `Ships the branch.`
- `frontmatter.feature:167`, row `demo:demo-skill`: actual `""`, expected `A skill of demo 1.0.0.`
- `skill/aliases.feature:238`, row `demo:fancy`: actual hint `""` and description `""`, expected `<change>` and `Reviews a change.`

The terminal Pi without a model started after the scripted-model Background of `features/skill/aliases.feature`. So the scenario stays in that file (PATTERNS finding 5 is settled).

Task 2: `npx cucumber-js --profile adapter --name "(PG-SKILL-11)" features/skill/aliases.feature`, with only the new scenario added: `2 scenarios (1 passed, 1 failed)`. The failure was at line 256, row `demo:fancy`, with hint `""` where `change` was expected.

## Green runs (after the change)

- The three feature files (adapter): `29 scenarios (29 passed)`, `368 steps (368 passed)`.
- `--name "(PG-SKILL-11)"`: `1 scenario (1 passed)` after Task 1. `2 scenarios (2 passed)` after Task 2.
- Owner tests `skill-alias-state`, `edge/skill-aliases`, `typed-expansion`: 93 passed, 0 failed (Task 1). `skill-alias-state`: 50 passed (Task 2). Caller owner `test/index.test.ts` passes.
- Direct coverage exits 0 (100%) for `orchestrators/skill-alias-state.ts`, `edge/skill-aliases.ts`, and `orchestrators/typed-expansion.ts`.
- `npm run typecheck`, `npm run fallow`, `npm run check:features`, and ESLint on the changed files exit 0.
- `git diff --quiet c1cca52d -- orchestrators/typed-expansion.ts domain/invocation-frontmatter.ts` exits 0.
- The hook passed on both commits, and `npm run check:commit` ran on both. `npm run check` was not run. The wave gate runs it.

## Lines for later plans

- Type: `PluginAliasTarget["menu"]` is `AliasMenuText` (`{ readonly description: string | undefined; readonly argumentHint: string | undefined }`). It is exported from `extensions/pi-claude-marketplace/orchestrators/skill-alias-state.ts` and required on both arms.
- `features/skill/aliases.feature:238`: `Scenario: Pi's terminal menu shows a skill alias with its argument hint and its description (PG-SKILL-11)`
- `features/skill/aliases.feature:256`: `Scenario: Pi's terminal menu shows a skill's bracketed argument hint without its brackets (PG-SKILL-11)`
- Renamed: `features/slash-command/aliases.feature:130`: `Scenario: Pi's terminal menu offers a command's plugin-qualified alias with its description`. The old title was "Pi's terminal menu offers a command's plugin-qualified alias".
- Edited row, no rename: `features/slash-command/frontmatter.feature:167`, `Scenario: A command's argument hint is shown in pi's terminal menu`. Its row `demo:demo-skill` now shows `A skill of demo 1.0.0.`

## Deviations from Plan

**1. [Rule 1 - Bug] The test heredoc wrote a literal em dash**
- **Found during:** Task 1 commit.
- **Issue:** The test expectations were written with `—`, but the file got a literal U+2014. The `fix-unicode-dashes` hook rewrote it to `--`.
- **Fix:** The three expectations in `test/edge/skill-aliases.test.ts` went back to the `—` escape before the commit. The edge test passed again.
- **Commit:** b5fd1c2d.

There were no other deviations. The edge provider cases also use a new helper, `aliasSuggestions`, so the strong-mock setup appears once for the new cases. `fallow dupes` exits 0. The existing DC-25 case still covers the colon rule (a bare `/fan` adds nothing).

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-11-04: the author text goes only into the item's `description`. `value` and `label` stay the alias name. T-11-05: the hint reader returns no hint for a mapping or a nested list, and the Task 2 table loop covers each form.

## Self-Check: PASSED

- FOUND: b5fd1c2d, 31cb8d6a (both ancestors of HEAD).
- FOUND: every file in key-files.modified.

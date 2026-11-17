---
phase: 10-plugin-options-variables-and-trust
plan: "09"
subsystem: skills
status: complete
tags: [user-config, options, skills, content-substitution]
requires: ["10-02", "10-05", "10-07"]
provides:
  - "substituteClaudeContent(content, vars, options) and the structural ClaudeContentOptions in shared/vars.ts"
  - "declaredOptions(options) in domain/user-config.ts: the resolved options, or undefined for a plugin that declares no userConfig"
  - "the required member options: ClaudeContentOptions | undefined on StageSkillsInput, fed from install-outcome.ts and update-swap.ts"
  - "features/skill/options.feature (Feature: Skill options)"
affects: [10-12, 10-13, 10-14, 10-18, 10-20]
tech-stack:
  added: []
  patterns: ["the option reference joins the path-token alternation in one non-rescanning pass", "a structural option type in shared/ that ResolvedOptions satisfies"]
key-files:
  created:
    - features/skill/options.feature
  modified:
    - extensions/pi-claude-marketplace/shared/vars.ts
    - extensions/pi-claude-marketplace/domain/user-config.ts
    - extensions/pi-claude-marketplace/bridges/skills/stage.ts
    - extensions/pi-claude-marketplace/bridges/skills/types.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
    - test/shared/vars.test.ts
    - test/domain/user-config.test.ts
    - test/bridges/skills/stage.test.ts
    - test/bridges/skills/types.test.ts
    - test/orchestrators/plugin/install-outcome.test.ts
    - test/orchestrators/plugin/update-swap.test.ts
decisions:
  - "Skill content gets each ${user_config.KEY} at staging through substituteClaudeContent: the sensitive-option text for a sensitive key, the default for a key with one, the reference as written otherwise, and no option pass for a plugin that declares no userConfig (D-PG10-08, D-PG10-09, D-PG10-13, D-PG10-21)."
metrics:
  duration: "~35 min"
  completed: 2026-11-15
actuals:
  tokens: 10500
  tasks: 2
  commits: 2
plan_head_before: 22b03ed4532a7d69e8e26009b4de927fbaa2fe0e
plan_head_after: ce5db6c3c9959ee166a0f3ad6054084d99492818
---

# Phase 10 Plan 09: Write plugin option defaults into skill content Summary

A staged skill's body and description now hold each `${user_config.KEY}` filled at staging, in the same pass as the path variables. A key with a default gets the default. A sensitive key gets `[sensitive option 'KEY' not available in skill content]`, with or without a value. A key with no value keeps the reference as written. A plugin that declares no `userConfig` gets no option pass. Install, enable, import, and the install cascade fill it through the install ledger. Update and reinstall fill it through `update-swap.ts`.

## Tasks

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Write a plugin option's default into skill content at install | 3abe4484 | vars.ts, user-config.ts, skills stage.ts and types.ts, install-outcome.ts, update-swap.ts (`options: undefined`), options.feature, five tests |
| 2 | Write the option's default into skill content at update and reinstall | ce5db6c3 | update-swap.ts, update-swap.test.ts, options.feature |

## Red then green

- Task 1, scenario red: `npm run test:cucumber:profile -- --profile adapter features/skill/options.feature` gave 4 scenarios (2 passed, 2 failed) and 55 steps (53 passed, 2 failed). The `mode` and `token` rows of "A typed skill shows a plugin option by what the manifest declares for it (PG-CORE-03)" failed at `Then the model receives these calls:`. The model received `Option ${user_config.mode}.` and `Option ${user_config.token}.` in place of `Option fast.` and `Option [sensitive option 'token' not available in skill content].` The `note` row and the guard passed.
- Task 1, owner red: with `shared/vars.ts` and `domain/user-config.ts` at HEAD, the vars and user-config tests failed to load (`does not provide an export named 'substituteClaudeContent'` and `'declaredOptions'`). With `bridges/skills/stage.ts` at HEAD, stage.test gave 51 tests and 1 failed: the D-PG10-08/09/13 description-and-body case. With `install-outcome.ts` at HEAD, the D-PG10-13 skills-phase case failed and the D-PG10-21 case passed (2 tests, 1 failed).
- Task 1, guard proof: in the working tree only, I made `declaredOptions` return the options for an undeclared plugin. The guard "A skill of a plugin with no options keeps an option reference as written (D-PG10-21)" still passed (1 scenario, 1 passed, 13 steps). Then I also made `optionText` give `""` for a missing value. The guard failed at the model-calls step with `Option .` where `Option ${user_config.mode}.` was expected (1 scenario, 1 failed, 13 steps, 12 passed). I restored both files from saved copies, because they held uncommitted edits, and `diff` confirmed the restore.
- Task 1, green: the feature gave 4 scenarios (4 passed) and 55 steps (55 passed). The seven `<verify>` unit files gave 597 pass, 0 fail. The vars cases include the `substituteClaudeVars` case that keeps `${user_config.mode}` literal for the hooks bridge. spawn-helpers is unchanged. Direct coverage of the five sources exited 0. `typecheck`, `check:features`, and `git diff --quiet HEAD -- .../bridges/hooks .../persistence` exited 0, as did `npm run fallow` and ESLint on the changed files. The hook passed `check:commit`. The tracer gate was green.
- Task 2, scenario red: "A reinstall writes a changed option default into the plugin's skill (D-PG10-13, D-PG10-15)" failed at the model-calls step with `Option ${user_config.mode}.` where `Option slow.` was expected (1 scenario, 1 failed, 16 steps, 15 passed).
- Task 2, owner red: the D-PG10-13 swap case failed with `'Mode ${user_config.mode}.\n'` where `'Mode slow.\n'` was expected. The D-PG10-21 case passed (2 tests, 1 failed).
- Task 2, green: the `--name` run gave 1 scenario (1 passed), 16 steps (16 passed). update-swap, update-flow, and reinstall-flow gave 784 pass. Direct coverage of update-swap.ts exited 0. The adapter profile on skill/options, skill/invocation, and skill/lifecycle gave 30 scenarios (30 passed), 394 steps (394 passed), and `check:features` exited 0. `typecheck` and ESLint exited 0. The hook passed `check:commit`.
- Both production calls of `prepareStageSkills` (`install-outcome.ts:1268`, `update-swap.ts:408`) pass `declaredOptions(resolveOptions(<resolution>.declaredUserConfig))`.

## Lines for later plans

- Content function: `substituteClaudeContent(content: string, vars: ClaudePluginVars, options: ClaudeContentOptions | undefined): string` in `shared/vars.ts`. With `undefined` it is `substituteClaudeVars`. Otherwise one `replaceAll` over `\$\{(?:(<path tokens>)|user_config\.([^}]+))\}` runs. For each reference, the sensitive check comes first, then the value, then the reference as written. `substituteClaudeVars` keeps its signature and its output.
- Structural option type: `ClaudeContentOptions { values: ReadonlyMap<string, string>; sensitive: ReadonlySet<string> }` in `shared/vars.ts`. `ResolvedOptions` satisfies it.
- Options function: `declaredOptions(options: ResolvedOptions): ResolvedOptions | undefined` in `domain/user-config.ts`. It returns `options` when `options.declared` is true (an empty `userConfig: {}` included), and otherwise `undefined` (D-PG10-21). A hub calls it as `declaredOptions(resolveOptions(resolution.declaredUserConfig))`, and the record path calls it as `declaredOptions(recordedOptionsOf(record))`.
- Staging input: `StageSkillsInput.options: ClaudeContentOptions | undefined`, required. `SkillStagingContext.options` carries it to both content sites, the description (`augmentSkillDescription`) and the whole file.
- Scenario titles in `features/skill/options.feature`:
  - "A typed skill shows a plugin option by what the manifest declares for it (PG-CORE-03)" (Outline, columns `reference` and `text sent`, rows `mode`, `token`, `note`)
  - "A skill of a plugin with no options keeps an option reference as written (D-PG10-21)"
  - "A reinstall writes a changed option default into the plugin's skill (D-PG10-13, D-PG10-15)"

## Parent-owned lines requested

- PG-CORE-03: the skill-content half is done. Commands and agents follow in plan 10-18, so do not mark the requirement complete yet.
- STATE.md decision: "Skill content gets each ${user_config.KEY} at staging through substituteClaudeContent: the sensitive-option text for a sensitive key, the default for a key with one, the reference as written otherwise, and no option pass for a plugin that declares no userConfig (D-PG10-08, D-PG10-09, D-PG10-13, D-PG10-21)."

## Deviations from Plan

1. **The guard's working-tree edits were restored from saved copies, not with `git checkout`.** The two files held this task's uncommitted edits, and `git checkout` would have dropped them. `diff` against the copies confirmed the restore.
2. **Owner red runs came from reverting each source to HEAD in the working tree.** I wrote each test beside the product edit and then ran it with that source at HEAD, so the failing output is the same as a test-first run.
3. **`test/shared/vars.test.ts` now has one `describe` per entrypoint.** The existing cases moved under `describe("substituteClaudeVars")` unchanged, because the module now exports two functions (unit-test case rule).
4. **Two stale comments in `bridges/skills/stage.ts` were updated.** The header line and the description comment named `substituteClaudeVars`, which that file no longer calls.
5. **An edge case of the one-pass fill.** In `${user_config.a${CLAUDE_PLUGIN_ROOT}}`, the pattern reads the key as `a${CLAUDE_PLUGIN_ROOT`. That key has no value, so the whole text stays as written. Claude Code fills the path variable first in this case. No schema-valid key can match it.

## Known Stubs

None. `update-swap.ts` held `options: undefined` only between the two commits.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-10-22: `optionText` checks the sensitive set before the value. Owner cases (with a value and without one), the stage case, and the Outline's `token` row assert the sensitive-option text. No sensitive value is written into a staged skill. T-10-24: owner cases show an option value that holds `${CLAUDE_PLUGIN_ROOT}` and `${user_config.mode}` written as text, and a path value that holds `${user_config.mode}` not filled. T-10-23 stays accepted, as the plan records. T-10-SC: no package was installed or changed.

## Self-Check: PASSED

- FOUND: extensions/pi-claude-marketplace/shared/vars.ts (`export function substituteClaudeContent`, `D-PG10-13`, `not available in skill content`; it imports nothing)
- FOUND: extensions/pi-claude-marketplace/domain/user-config.ts (`export function declaredOptions`, `D-PG10-21`)
- FOUND: bridges/skills/stage.ts (`substituteClaudeContent` at the description and whole-file sites), features/skill/options.feature (`Feature: Skill options`, `D-PG10-15`, 3 `  Scenario` lines)
- FOUND: 3abe4484, ce5db6c3 (ancestors of HEAD)

---
phase: 10-plugin-options-variables-and-trust
plan: "18"
subsystem: commands, agents
status: complete
tags: [user-config, options, commands, agents, content-substitution]
requires: ["10-09", "10-16"]
provides:
  - "the required member options: ClaudeContentOptions | undefined on StageCommandsInput, StagedCommandContext, StageAgentsInput, ConvertAgentInput, and ReadSkillPreloadsInput"
  - "command content, agent bodies, and preloaded skills filled through substituteClaudeContent, fed from install-outcome.ts and update-swap.ts"
  - "features/slash-command/options.feature (Feature: Slash command options)"
  - "features/agent/options.feature (Feature: Agent options)"
  - "the corrected residual note in domain/argument-substitution.ts"
affects: [10-20, 10-21]
tech-stack:
  added: []
  patterns: ["a required staging input member, fed at each hub from the resolution's declaredUserConfig"]
key-files:
  created:
    - features/slash-command/options.feature
    - features/agent/options.feature
  modified:
    - extensions/pi-claude-marketplace/bridges/commands/staged-command.ts
    - extensions/pi-claude-marketplace/bridges/commands/stage.ts
    - extensions/pi-claude-marketplace/bridges/commands/types.ts
    - extensions/pi-claude-marketplace/bridges/agents/convert.ts
    - extensions/pi-claude-marketplace/bridges/agents/skill-preload.ts
    - extensions/pi-claude-marketplace/bridges/agents/stage.ts
    - extensions/pi-claude-marketplace/bridges/agents/types.ts
    - extensions/pi-claude-marketplace/domain/argument-substitution.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
    - "the 15 test files of the plan"
decisions:
  - "Command content, agent bodies, and the skills an agent preloads get each ${user_config.KEY} at staging through substituteClaudeContent, by the skills rule: the sensitive-option text for a sensitive key, the default for a key with one, the reference as written otherwise, and no option pass for a plugin that declares no userConfig (D-PG10-08, D-PG10-09, D-PG10-13, D-PG10-21)."
metrics:
  duration: "~60 min"
  completed: 2026-11-15
actuals:
  tokens: 14000
  tasks: 2
  commits: 2
plan_head_before: 5477fc51bd8e827c12c71bb566d43ccc970d23b1
plan_head_after: 1ba78e23
---

# Phase 10 Plan 18: Plugin options in command and agent content Summary

A staged command, a staged agent body, and every skill an agent preloads now hold each `${user_config.KEY}` filled at staging, by the rule plan 10-09 gave skills. A key with a default gets the default. A sensitive key gets `[sensitive option 'KEY' not available in skill content]`, with or without a value. A key with no value keeps the reference as written. A plugin that declares no `userConfig` gets no option pass. Install, enable, import, and the install cascade fill it through the install ledger. Update and reinstall fill it through `update-swap.ts`.

## Tasks

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Write plugin options into command content | f7abe84c | commands staged-command.ts, stage.ts, types.ts, install-outcome.ts, update-swap.ts, slash-command/options.feature, 5 tests |
| 2 | Write plugin options into agent content and preloaded skills, and correct the substitution note | 1ba78e23 | agents convert.ts, skill-preload.ts, stage.ts, types.ts, argument-substitution.ts, install-outcome.ts, update-swap.ts, agent/options.feature, 10 tests |

## Red then green

- Task 1, scenario red: "A typed command shows a plugin option's default and hides a sensitive one (PG-CORE-03, D-PG10-09)" failed at `Then the model receives these calls:`. The model received `Mode ${user_config.mode}, token ${user_config.token}.` where `Mode fast, token [sensitive option 'token' not available in skill content].` was expected. 1 scenario (1 failed), 14 steps (13 passed, 1 failed).
- Task 1, owner red (the four command sources at HEAD, `--test-name-pattern="D-PG10-(09|13|21)"` on the four owner files): 15 tests, 4 failed, 11 passed. Failed: "D-PG10-13 writes the options of its input into each staged command", "D-PG10-09 writes an option's default, the sensitive-option text, and an unset reference as written", "D-PG10-13: the commands phase writes the declared options into command content", and "D-PG10-13: a swap writes the options the new version declares into its command". The D-PG10-21 cases passed, as guards.
- Task 1, green: adapter profile on slash-command/options and slash-command/invocation gave 20 scenarios (20 passed), 256 steps (256 passed). The five unit files gave 525 tests, 525 pass. Direct coverage of the four sources exited 0. `typecheck`, `check:features`, ESLint on the touched files, and `fallow dupes` exited 0. The hook passed `check:commit`. The tracer gate was green.
- Task 2, scenario red (the agent sources and both hubs at HEAD): "An agent's staged body shows a plugin option's default and hides a sensitive one (PG-CORE-03, D-PG10-09)" failed at `Then the agents folder of the user scope holds the file "pi-claude-marketplace-demo-helper.md" with this text:`. The body was `Mode ${user_config.mode}, token ${user_config.token}.` where `Mode fast, token [sensitive option 'token' not available in skill content].` was expected. 1 scenario (1 failed), 11 steps (10 passed, 1 failed).
- Task 2, owner red (the same sources at HEAD, `--test-name-pattern="D-PG10-(09|13|21)"` on the six owner files): 22 tests, 6 failed, 16 passed. Failed: the convert D-PG10-09 body case, "D-PG10-13: the file's form holds the filled body after the block the swap replaces", "D-PG10-13: fills a preloaded skill's option references as the skill's own staging does", "D-PG10-13: writes the options of its input into the body and a preloaded skill", "D-PG10-13: the agents phase writes the declared options into agent content", and "D-PG10-13: a swap writes the options the new version declares into its agent". The D-PG10-21 cases passed, as guards.
- Task 2, green: adapter profile on agent/options and agent/frontmatter gave 14 scenarios (14 passed), 191 steps (191 passed). The twelve files of the `<verify>` gave 804 tests, 804 pass, 0 skipped, including `test/orchestrators/mcp/agent-grants-step.test.ts`, `test/domain/argument-substitution.test.ts` (its `${user_config.token}` literal case is unchanged), and both grant conformance tests. Direct coverage of the seven sources exited 0. `typecheck`, `check:features`, ESLint, `fallow dupes --fail-on-issues`, and `fallow health --fail-on-issues` exited 0. The hook passed `check:commit`.
- Every production call of the three stagers passes the options member: `install-outcome.ts:1281` (skills), `:1333` (commands), and `:1392` (agents) pass `declaredOptions(resolveOptions(installCtx.resolved.declaredUserConfig))`. `update-swap.ts::prepareUpdateHandles` passes its one `options` constant to skills, commands, and, through `UpdateAgentsInputs.options`, to `prepareStagePluginAgents`.
- The session-start grant swap (`bridges/agents/grant-rewrite.ts`) replaces the recorded frontmatter block and keeps every byte after it, so a filled body stays as it is. The grant-forms case pins that the file is the block the row records followed by the filled body.

## Lines for later plans

- Option member, all named `options: ClaudeContentOptions | undefined` and required: `StageCommandsInput` and `StagedCommandContext` (commands), `StageAgentsInput`, `ConvertAgentInput`, and `ReadSkillPreloadsInput` (agents). `GrantFormInput` carries it through `formInput`'s spread, so `grant-forms.ts` did not change. `UpdateAgentsInputs.options` (`update-swap.ts`) carries it to the update's agents staging.
- Content sites: `buildStagedCommand` (the whole command file, frontmatter included, before the reference rewrite), the agent body in `convertAgentOrEmpty` (before the reference rewrite), and `skillPreload` (after the reference rewrite, as before). The agent frontmatter `description` is not filled, as it gets no path variables either.
- Workflow scripts get no option pass. The invocation-time pass (`domain/argument-substitution.ts`) still leaves `${user_config.KEY}` alone.
- Scenario titles:
  - "A typed command shows a plugin option's default and hides a sensitive one (PG-CORE-03, D-PG10-09)" in `features/slash-command/options.feature` (`Feature: Slash command options`)
  - "An agent's staged body shows a plugin option's default and hides a sensitive one (PG-CORE-03, D-PG10-09)" in `features/agent/options.feature` (`Feature: Agent options`)

## Parent-owned lines requested

- PG-CORE-03: the content half of success criterion 2 is done (skills 10-09; commands and agents this plan). Mark the requirement complete only when every other plan that owns a part of it is done.
- STATE.md decision: "Command content, agent bodies, and the skills an agent preloads get each ${user_config.KEY} at staging through substituteClaudeContent, by the skills rule: the sensitive-option text for a sensitive key, the default for a key with one, the reference as written otherwise, and no option pass for a plugin that declares no userConfig (D-PG10-08, D-PG10-09, D-PG10-13, D-PG10-21)."

## Deviations from Plan

1. **Owner red runs came from reverting each source to HEAD in the working tree,** as in plan 10-09. The Task 2 scenario red run was taken the same way. Saved copies restored each file, and `diff` confirmed the restore.
2. **`ConvertAgentInput.options` and `ReadSkillPreloadsInput.options` are required too,** not only the staging inputs. So `test/bridges/agents/convert.test.ts` (35 literals) and `test/bridges/agents/stage.test.ts` (38 literals) took `options: undefined` at each input, beside the files the plan named. All are in the plan's file list.
3. **`bridges/agents/grant-forms.ts` did not change.** `formInput` spreads its input, so the member reaches `convertAgent` with no edit.
4. **The hub helpers were widened, not copied.** `stagedOptionSkillBody` (install-outcome test) is now `stagedOptionBodies`, and `swapOptionSkill` (update-swap test) is now `swapOptionContent`. Each writes a skill, a command, and an agent and returns the three bodies, and the 10-09 skill cases read `.skill`. In the install helper the command is `cmd`, because a command with the skill's name `opts` kept the skill from staging. That is behavior before this plan.
5. **Two comments outside the content sites were updated:** the header of `bridges/commands/staged-command.ts` names the option pass, and the preload comment in `bridges/agents/stage.ts` names the options.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-10-48: every content site calls `substituteClaudeContent`, which checks the sensitive set before it looks up a value. Owner cases with a sensitive key that has a value assert the sensitive-option text at the command site, the agent body site, and the preload site. The two scenarios assert it in the text the model receives and in the staged agent file. T-10-23 stays accepted and is now recorded in `domain/argument-substitution.ts`. T-10-SC: no package was installed or changed.

## Self-Check: PASSED

- FOUND: `substituteClaudeContent` in commands/staged-command.ts, agents/convert.ts, agents/skill-preload.ts; `D-PG10-13` in commands/staged-command.ts and domain/argument-substitution.ts
- FOUND: `Feature: Slash command options` in features/slash-command/options.feature, `Feature: Agent options` in features/agent/options.feature
- FOUND: test/orchestrators/mcp/agent-grants-step.test.ts and test/bridges/agents/grant-forms.test.ts are tracked
- FOUND: f7abe84c, 1ba78e23 (ancestors of HEAD); `git rev-list --count 5477fc51..1ba78e23` is 2

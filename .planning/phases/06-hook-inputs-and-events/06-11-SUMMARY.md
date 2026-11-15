---
phase: 06-hook-inputs-and-events
plan: "11"
subsystem: hooks
status: complete
tags: [hooks, effort, thinking-level, cucumber, scripted-model]
requires: ["06-05", "06-06", "06-08", "06-09"]
provides:
  - "hookEffortLevel(thinkingLevel) in domain/argument-substitution.ts"
  - "TranslationContext.effort, read per dispatch from ctx.thinkingLevel"
  - "effort on PreToolUse, PostToolUse, PostToolUseFailure, Stop, StopFailure stdin"
  - "PiProfile.reasoningModel and the scripted model's reasoning-model file"
affects: [bridges/hooks, features harness]
tech-stack:
  added: []
  patterns: ["conditional spread of an optional common field as the last stdin member"]
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/domain/argument-substitution.ts
    - extensions/pi-claude-marketplace/bridges/hooks/translation-context.ts
    - extensions/pi-claude-marketplace/bridges/hooks/payloads/pre-tool-use.ts
    - extensions/pi-claude-marketplace/bridges/hooks/payloads/post-tool-use.ts
    - extensions/pi-claude-marketplace/bridges/hooks/payloads/post-tool-use-failure.ts
    - extensions/pi-claude-marketplace/bridges/hooks/payloads/stop.ts
    - extensions/pi-claude-marketplace/bridges/hooks/payloads/stop-failure.ts
    - features/lib/scripted-model/extension.ts
    - features/support/world.ts
    - features/step_definitions/model.steps.ts
    - features/hook/tool-use.feature
    - features/hook/prompt-and-stop.feature
    - features/hook/stop-failure.feature
decisions:
  - "D-PG6-10 as F1/F2 correct it: effort on the three tool events, Stop, StopFailure; never UserPromptSubmit; Pi max passes as {level:max}"
  - "hookEffortLevel and claudeEffort share one CLAUDE_EFFORTS list; ClaudeEffort is derived from it"
metrics:
  duration: 26min
  completed: 2026-11-15
actuals:
  tokens: 13000
  tasks: 2
  commits: 2
plan_head_before: 4d74af3aaad68dc7280a82bf00dafcf655235145
plan_head_after: b6a566534d2e2eb39519b2dc88138128e969be31
---

# Phase 6 Plan 11: effort on tool, Stop, and StopFailure hooks Summary

Hooks of `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `Stop`, and `StopFailure` now get `effort: {"level": <level>}` when Pi's thinking level is `low`, `medium`, `high`, `xhigh`, or `max`. Pi reads the level on each dispatch through `ctx.thinkingLevel` and maps it with the new `hookEffortLevel`. Under `off`, `minimal`, or no level the field is left out. The six other events never carry it.

## Commits

| Task | Commit | Title |
|---|---|---|
| 06-11-01 | bf3befba | feat(hooks): send the session's effort level to tool hooks |
| 06-11-02 | b6a56653 | feat(hooks): send the effort level to Stop and StopFailure hooks |

The commit hook ran `npm run check:commit` (Passed) on both commits.

## Evidence

Task 06-11-01:
- Red, unchanged production tree with the harness and scenarios only: `npm run test:cucumber:profile -- --profile adapter features/hook/tool-use.feature --name "effort"` gave exit 1, "4 scenarios (1 passed, 3 failed)". The three Outline rows (low, medium, high) failed in `the hooks record these runs:` because the actual table had no `effort` column. The `minimal` guard passed.
- `minimal` guard red once: with `hookEffortLevel` changed in the working tree only to return `low` for `minimal`, `--name "minimal receives no effort"` gave exit 1, "1 scenario (1 failed)", because the actual table gained `effort`. The file was then restored from a scratch copy (`grep 'thinkingLevel === "minimal"'` finds nothing), and the restored file is the one committed.
- Green: `npm run test:cucumber:profile -- --profile adapter features/hook/tool-use.feature features/hook/prompt-commands.feature` gave exit 0, "75 scenarios (75 passed)".
- Unit: the task's `node --test` command over the 8 files gave 400 tests, 400 pass, 0 fail. `npm run test:coverage:direct --` over the 5 sources gave exit 0.
- Integration: `test/integration/hooks-dispatch-end-to-end.test.ts` and `hooks-spawn-end-to-end.test.ts` gave 7/7. All five `test/integration/hooks-*.test.ts` gave 16/16. `npm run check:features` gave exit 0. `tsc --noEmit` gave exit 0.

Task 06-11-02:
- Red, tree as task 06-11-01 left it: `--name "receives the effort level of the session"` over prompt-and-stop.feature and stop-failure.feature gave exit 1, "2 scenarios (2 failed)". Both failed on the missing `effort` column.
- Green: `npm run test:cucumber:profile -- --profile adapter features/hook/prompt-and-stop.feature features/hook/stop-failure.feature features/hook/session.feature features/hook/matchers.feature` gave exit 0, "76 scenarios (76 passed)".
- Unit: the task's 9 files gave 224 tests, 224 pass. Direct coverage for stop.ts and stop-failure.ts gave exit 0. `npm run check:features` gave exit 0.
- The `builtin` profile selects none of the new scenarios ("0 scenarios"): they carry no `@mcp` tag.

## Thinking levels Pi accepts for the scripted model that reasons

`off`, `minimal`, `low`, `medium`, and `high` (`getSupportedThinkingLevels({reasoning:true})`). Pi accepts `xhigh` and `max` only for a model that has a `thinkingLevelMap` entry for them, and the scripted model registers none. So the Outline holds `low`, `medium`, and `high`. The owner cases cover `xhigh` and `max` (hookEffortLevel), and the Stop and StopFailure cases use `max`.

## The two new steps (features/step_definitions/model.steps.ts)

- `Given pi runs with a scripted model that reasons`: it starts the profile Pi with `{ companions: [], reasoningModel: true }`, under `PROFILE_PI_START_TIMEOUT_MS`.
- `Given the user has set the thinking level {string}`: it sends RPC `set_thinking_level`, then checks with `get_state` that Pi reports that level. A level that Pi lowered fails here.

Harness: `PiProfile.reasoningModel?: true` (doc cites D-PG6-24). It writes an empty `{harness}/reasoning-model` file before Pi starts, and the scenario's release removes the file. `features/lib/scripted-model/extension.ts` exports `reasoningModelPath(harness)`. When registration runs, the extension registers each faux model with `reasoning` on if that file exists. The default export did not move.

## Pins outside this plan's files

None. dispatch-exec.ts, async-rewake/registry.ts, event-router.ts, dispatch.ts, and their tests are not in either commit. Their owner tests and test/architecture/hooks-translators.test.ts pass unchanged.

## Deviations from Plan

None in what was built. Process notes:
- The Outline's Examples table has an `effort` column with the literal object (`{"level":"high"}`) as well as the `level` column, so the acceptance grep for `"level":"high"` matches the feature file.
- A shell mistake (an empty file list) started `npx eslint --fix` and `npx prettier --write` with no paths. ESLint crashed on `.codex/` before it wrote anything. Prettier, with no file argument, waits on stdin: process 8734 (`node .../node_modules/.bin/prettier --write`, parent `npm exec` 8332) is still waiting and has written nothing. The auto-mode classifier denied my `kill`, so the orchestrator should stop it. `git status` shows no stray changes.

## Flagged assumptions (from the plan)

- F1 and F2 correct D-PG6-10, pending maintainer review: `UserPromptSubmit` is not in the event set, and Pi has a `max` level.
- A hook under `off` or `minimal` gets no `effort`, while `${CLAUDE_EFFORT}` reads `low` (D-CF1-01). Plan 06-13 states the difference on the compatibility page.
- `ctx.thinkingLevel` is read where the context is built, not through `pi.getThinkingLevel()` at the exec layer. A guard turns a getter throw into no field and one debug line.
- "Models without effort support": Pi lowers a model that cannot reason to `off`, which sends no field, so no separate check exists.
- Platform: the scenarios run on Linux, in RPC mode.

## Records for the orchestrator

This plan edits no parent-owned file. Lines for the maintainer to apply:

- PROJECT.md Key Decisions: D-PG6-10 with the corrected event set (finding F1: `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `Stop`, `StopFailure`; not `UserPromptSubmit`, `UserPromptExpansion`, `SessionStart`, `SessionEnd`, `PreCompact`, `PostCompact`), `max` passes through as `{ "level": "max" }` (finding F2), and "pending maintainer review".
- `.agents/skills/cucumber/rules/world-and-stand-ins.md`, section "The scripted model": "The profile option `reasoningModel` writes the empty file `{harness}/reasoning-model` (`reasoningModelPath` of `features/lib/scripted-model/extension.ts`) before Pi starts, and the scenario's release removes it. With the file, the scripted model registers its models as ones that reason, and Pi then accepts the thinking levels `off`, `minimal`, `low`, `medium`, and `high`. `model.steps.ts` has `Given pi runs with a scripted model that reasons` and `Given the user has set the thinking level {string}`; the second step checks the level through `get_state`."
- BACKLOG.md HOOKENV-01: the stdin field `effort` is sent; the `CLAUDE_EFFORT` variable stays deferred.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

- Commits bf3befba and b6a56653 are ancestors of HEAD.
- `grep -c "export function hookEffortLevel"` = 1; `readonly effort` in translation-context.ts = 1; `effort` in pre-tool-use.ts >= 2; `"level":"high"` in tool-use.feature >= 1; `reason` in world.ts >= 1; `effort` in stop.ts and stop-failure.ts >= 2; Scenario counts in prompt-and-stop.feature = 8 and in stop-failure.feature = 11.

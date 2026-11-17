---
phase: 10-plugin-options-variables-and-trust
plan: "03"
subsystem: orchestrators
status: complete
tags: [variables, claude-project-dir, commands, skills, agents]
requires: []
provides:
  - "commandVariables and invocationVariables supply CLAUDE_PROJECT_DIR = request.cwd at both scopes (D-PG10-16)"
  - "Four PG-CORE-05 scenarios and one agent-body guard"
affects: [10-20, 10-21]
tech-stack:
  added: []
  patterns: ["invocation-time fill of a variable the staged file keeps literal"]
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/command-invocation.ts
    - extensions/pi-claude-marketplace/orchestrators/skill-invocation.ts
    - test/orchestrators/command-invocation.test.ts
    - test/orchestrators/skill-invocation.test.ts
    - features/slash-command/invocation.feature
    - features/slash-command/model-runs.feature
    - features/skill/invocation.feature
    - features/skill/model-reads.feature
    - features/agent/frontmatter.feature
decisions:
  - "commandVariables no longer takes the staged command, and the ready arm of PreparedCommand drops its command field, because the scope check was their only reader there; the trust gate reads the command inside prepareCommand."
metrics:
  duration: "~20 min"
  completed: 2026-11-15
actuals:
  tokens: 5626
  tasks: 2
  commits: 2
plan_head_before: 12e12ce39da2975fbf6d69d48c02882535295722
plan_head_after: ad49d8032b47bede309588f246cc012960133ace
---

# Phase 10 Plan 03: CLAUDE_PROJECT_DIR at user scope Summary

A user-scope command or skill now gets the session's working directory for `${CLAUDE_PROJECT_DIR}` when the user types it, when the model runs the command through `run_plugin_command`, and when the model reads the skill's staged `SKILL.md` (PG-CORE-05, D-PG10-16). The value is `request.cwd` as given. Install staging and agent bodies keep the literal. Both trust gates are unchanged.

## Commits

| Task | Commit | Title |
| --- | --- | --- |
| 10-03-01 | 22e2f276 | feat(commands): fill the project directory for user-scope commands |
| 10-03-02 | ad49d803 | feat(skills): fill the project directory for user-scope skills |

## Red and green runs

Task 1, before the product edit (`npx cucumber-js --profile adapter --name "(PG-CORE-05)"` on the two command features): `2 scenarios (2 failed)`, `27 steps (25 passed, 2 failed)`.

- invocation.feature:113, at `Then the model receives these calls:`: actual `project ${CLAUDE_PROJECT_DIR}`, expected `project {project dir}`.
- model-runs.feature:79, at `Then the model receives these calls:`: actual `run_plugin_command returned: project ${CLAUDE_PROJECT_DIR}`, expected `run_plugin_command returned: project {project dir}`.

Task 1 owner test, red: four cases failed, "D-PG10-16: fills the project directory in a user command", "... with a space and a non-ASCII character as given" (cwd `/Work Dir/Café`), "... fills each place a user command names the project directory", and "D-PG10-16: a typed argument names the project directory of a user command". "D-PG10-16: sends a user command that does not name the project directory unchanged" passed before and after, as a guard.

Task 2, before the product edit (the two skill features): `2 scenarios (2 failed)`, `27 steps (25 passed, 2 failed)`.

- model-reads.feature:43, at `Then the model receives these calls:`: actual `project ${CLAUDE_PROJECT_DIR}`, expected `project {project dir}`.
- invocation.feature:204, at `Then the model receives these calls:`: actual `project ${CLAUDE_PROJECT_DIR}\n`, expected `project {project dir}\n`.

Task 2 owner test, red: "D-PG10-16: fills the project directory of a user skill without a record and leaves its plugin variables literal" and "D-PG10-16: fills the project directory of a user skill the model reads in a project pi does not trust" failed.

Agent guard: green on its first run. With line 1019 of `bridges/agents/convert.ts` changed to `projectDir: projectDir ?? "/wrong-project",` in the working tree, it failed at `Then the agents folder of the user scope holds the file "pi-claude-marketplace-demo-helper.md" with this text:` (actual `project /wrong-project`, expected `project ${CLAUDE_PROJECT_DIR}`; 10 steps, 9 passed, 1 failed). After `git checkout -- extensions/pi-claude-marketplace/bridges/agents/convert.ts` it passed, and `git diff --quiet HEAD -- extensions/pi-claude-marketplace/bridges` exited 0.

Green, after the product edits:

- `--name "(PG-CORE-05)"`: commands `2 scenarios (2 passed)`; skills and agent `3 scenarios (3 passed)`, 37 steps.
- `node --import test/platform/isolated-pi-home.ts --test` on the command owner test plus `test/edge/command-invocation.test.ts` and `test/edge/command-tool.test.ts`: 67 pass, 0 fail.
- The skill owner test plus `test/edge/skill-aliases.test.ts`, `test/edge/skill-read.test.ts`, `test/bridges/skills/stage.test.ts`, `test/bridges/agents/stage.test.ts`: 185 pass, 0 fail. The two staging cases that keep the literal are unchanged.
- `npm run test:coverage:direct --` for each orchestrator: exit 0.
- `npm run test:cucumber:profile -- --profile adapter`: the two command features, 24 scenarios passed; the skill, agent, and `features/plugin/project-trust.feature` files, 44 scenarios passed (T-10-07).
- `npm run check:features`: exit 0 after each task. `tsc --noEmit` exit 0. The commit hook's `npm run check:commit` passed on both commits.

## Deviations from Plan

**1. [Rule 1 - orphan removal] Dropped the parameter the scope check used**
- **Found during:** Task 1
- **Issue:** Without the scope check, `commandVariables` no longer read its `command` parameter, so `noUnusedParameters` failed. `renderCommand`'s `command` parameter and the `command` field of the `ready` arm of `PreparedCommand` then had no reader.
- **Fix:** Removed the parameter from `commandVariables` and `renderCommand`, and removed the field from the `ready` arm. The trust gates in `prepareCommand` still read the located command. No behavior change.
- **Files modified:** extensions/pi-claude-marketplace/orchestrators/command-invocation.ts
- **Commit:** 22e2f276

No `invocationVariables` parameter became unused: `skill.baseDir` still feeds `CLAUDE_SKILL_DIR`.

The command scenarios use `fixtures`/`demo` at `--scope user` instead of the `mine`/`personal` pair of `features/plugin/project-trust.feature`. Neither file's Background installs a plugin, so the plugin the files already publish was enough.

The plan-commit ledger file was not written under the git directory, because that directory sits in the main checkout, which the execution rules forbid touching. The base SHA was kept in the session scratch directory instead.

## Lines for later plans

Scenario titles (10-20 and 10-21 may cite them):

- `features/slash-command/invocation.feature`: "A user-scope command gets the project directory when the user types it (PG-CORE-05)"
- `features/slash-command/model-runs.feature`: "The model gets the project directory of a user-scope command through the tool (PG-CORE-05)"
- `features/skill/invocation.feature`: "A user-scope skill gets the project directory when the user invokes it (PG-CORE-05)"
- `features/skill/model-reads.feature`: "A user-scope skill file the model reads shows the project directory (PG-CORE-05)"
- `features/agent/frontmatter.feature`: "A user-scope agent's staged body keeps the project directory variable as written (PG-CORE-05)" (guard)

Source comments citing D-PG10-16:

- `command-invocation.ts`, in `commandVariables`: `// D-PG10-16: a user command's staged body keeps the literal, so this step fills it.`
- `skill-invocation.ts`, in `invocationVariables`: `// D-PG10-16: a user skill's staged file keeps the literal, so this step fills it.`

Unit case titles that replaced the literal pins:

- "D-PG10-16: fills the project directory in a user command" (was "D-CF3-10: leaves the project directory literal in a user command"), plus three new cases in the same table.
- "D-PG10-16: a typed argument names the project directory of a user command" (was "D-CF3-06: ... literally in a user command").
- "D-PG10-16: fills the project directory of a user skill without a record and leaves its plugin variables literal" (was "D-CF2-06: leaves the project and plugin variables of a user skill without a record literal").
- "D-PG10-16: fills the project directory of a user skill the model reads in a project pi does not trust" (was "D-CF1-03: leaves the project directory of a user skill literal").

Parent-side records this plan did not write (other plans own them): the D-PG10-16 row (10-20). The `commandVariables` doc comment still says "Install already filled the body's path variables (CM-3, SUB-02)". That holds at project scope only, so 10-20 may want to adjust it with the SUB-02 amendment. The `docs/env-vars.md` correction "`CLAUDE_PROJECT_DIR` at user scope" belongs to 10-21.

## Known Stubs

None.

## Threat Flags

None. No security-relevant surface outside the plan's `<threat_model>` was introduced. T-10-06 (accept) is the intended path disclosure. T-10-07 (mitigate) holds: both orchestrators' checks of scope against `projectTrusted` are unchanged, and the untrusted-project owner cases and `features/plugin/project-trust.feature` pass.

## Self-Check: PASSED

- FOUND: 22e2f276, ad49d803 (ancestors of HEAD)
- FOUND: every modified file listed in key-files
- `git log 12e12ce3..HEAD --name-only -- extensions` lists only `orchestrators/command-invocation.ts` and `orchestrators/skill-invocation.ts`

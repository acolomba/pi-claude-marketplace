---
phase: 08-workflow-agents-and-run-paths
plan: "03"
subsystem: workflows
tags: [workflows, cucumber, guards, parity]
status: complete
requires: ["08-01"]
provides:
  - "features/step_definitions/project.steps.ts: the step `the project is a git repository with one commit`"
  - "Five guard scenarios for the WF-07 run paths in agent-steps.feature, run.feature and collisions.feature"
affects: ["08-07"]
tech-stack:
  added: []
  patterns: ["a project-directory step module whose git runs only through runGit", "guard scenarios that print stable text where a companion names things after a run id"]
key-files:
  created:
    - features/step_definitions/project.steps.ts
  modified:
    - features/workflow/agent-steps.feature
    - features/workflow/run.feature
    - features/workflow/collisions.feature
decisions:
  - "D-PG8-07 as measured: the five run paths pass today and are pinned by guard scenarios; two titles name a difference from Claude Code (the kept worktree, E7; the failed install for two scripts with one name, E5)."
  - "The worktree scenario compares `git rev-parse --git-dir` with `--git-common-dir` and counts worktrees and branches as plain numbers, so it pins no name the engine gives a worktree or a branch."
metrics:
  duration: "about 35 minutes"
  completed: 2026-11-14
estimate:
  tokens: 60000
  tasks: 3
actuals:
  tokens: 3100
  tasks: 3
  commits: 3
plan_head_before: d483f433fdb468c9fac54b8c40d2d2bb02043553
plan_head_after: 707e3527e6b1031c84ba69cb4f11e39e43e19c4e
---

# Phase 8 Plan 03: Workflow run-path guard scenarios Summary

One new hermetic-git project step and five guard scenarios that pin today's behavior of a model-started run with an `args` object, `agent({schema})`, `isolation: "worktree"`, a sibling `workflow()` call, and two scripts with one `meta.name`. No production code changed.

## Commits

| Task | Commit | Title | Files |
| --- | --- | --- | --- |
| 08-03-01 | 0f499fb9 | test(workflows): run a workflow step in a git worktree of the project | features/step_definitions/project.steps.ts, features/workflow/agent-steps.feature |
| 08-03-02 | d74fb154 | test(workflows): start a run with arguments and call a sibling | features/workflow/run.feature |
| 08-03-03 | 707e3527 | test(workflows): return a schema object and refuse a shared name | features/workflow/agent-steps.feature, features/workflow/collisions.feature |

No commit lists a path under `extensions/` or `test/`. Each passed the commit hook without `--no-verify`, after `SKIP=npm-check pre-commit run --files <paths>`. The post-commit deletion check found no deleted file.

## Commands and results

Node v26.13.1, worktree /home/acolomba/src/pi-claude-marketplace-gaps-agents, branch features/gaps-agents.

| Command | When | Result |
| --- | --- | --- |
| `npm run test:cucumber:profile -- --profile adapter features/workflow/agent-steps.feature` | after task 1 | exit 0, 4 scenarios (4 passed), 60 steps |
| `npm run check:static` | after task 1 | exit 0: typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features all passed |
| `npm run test:cucumber:profile -- --profile adapter features/workflow/run.feature features/workflow/references.feature` | after task 2 | exit 0, 10 scenarios (10 passed), 136 steps |
| `npm run check:features` | after task 2 | exit 0 |
| `npm run test:cucumber:profile -- --profile adapter features/workflow/agent-steps.feature features/workflow/collisions.feature` | after task 3, and again after its mutations were restored | exit 0, 8 scenarios (8 passed), 114 steps |
| `npm run check:features` | after task 3 | exit 0 |
| `git diff --quiet HEAD -- extensions test features/step_definitions features/lib features/support` | before the commits of tasks 2 and 3 | exit 0 |

`npm run check` was not run; it is the orchestrator's wave gate.

## The step

`features/step_definitions/project.steps.ts` registers `Given the project is a git repository with one commit`. It runs `runGit(projectDir, home, "init", "-q")`, registers a release that removes `<project>/.git`, runs `runGit(..., "commit", "-q", "--allow-empty", "-m", "start")`, and asserts that `git rev-list --count HEAD` prints `1`. The paths come from `this.tokens`, git runs only through `runGit` (sandbox HOME, no system configuration, `GIT_CONFIG_GLOBAL=/dev/null`), and the module names no process API (`grep -c child_process` prints 0). The reset of the next scenario empties the project, which also removes the engine's worktree under `.pi/worktrees/`.

## The five scenarios

### 1. agent-steps.feature: "A workflow step that asks for worktree isolation runs in a git worktree of the project, which the engine keeps where Claude Code removes an unchanged one"

Script `workflows/iso.js`: `agent("Check the folder.", {isolation:"worktree"})`, then `agent("Count the worktrees.")`, returns both replies joined by a space. Scripted steps: a `bash` call and the reply `Checked.`, then a `bash` call and the reply `Counted.`. Result `completed`, `Checked. Counted.`. Calls table:

```text
| 1 | user        | Requested isolation: worktree\n\nTask label: agent 1\n\nCheck the folder. |
| 2 | user        | Requested isolation: worktree\n\nTask label: agent 1\n\nCheck the folder. |
| 2 | assistant   | tool call bash {"command":"if [ $(git rev-parse --git-dir) = $(git rev-parse --git-common-dir) ]; then echo main worktree; else echo linked worktree; fi"} |
| 2 | tool result | bash returned: linked worktree\n |
| 3 | user        | Task label: agent 2\n\nCount the worktrees. |
| 4 | user        | Task label: agent 2\n\nCount the worktrees. |
| 4 | assistant   | tool call bash {"command":"echo worktrees $(git worktree list \| wc -l) branches $(git branch \| wc -l)"} |
| 4 | tool result | bash returned: worktrees 2 branches 2\n |
```

Why these commands: the engine names the worktree folder and its branch after the run id, which the harness does not project. `git rev-parse --git-dir` and `--git-common-dir` print the same path only in the main worktree, so the first command prints stable text and pins no naming the engine owns. The second command runs after the first step ended, so `worktrees 2 branches 2` shows that the engine kept the worktree and its branch.

Mutation: removed `{isolation:"worktree"}` from the first `agent()` call. The calls `Then` failed: the two user rows lost `Requested isolation: worktree\n\n`, the first tool result read `bash returned: main worktree\n`, and the second read `bash returned: worktrees 1 branches 1\n` (1 scenario failed, 14 of 15 steps passed). Restored from the backup (`cmp` identical); the file's 4 scenarios passed again.

### 2. run.feature: "The model starts a workflow by name with an argument object, and the script receives the object"

Script `workflows/echo.js` returns `"who=" + args.who + " n=" + args.items.length`. Scripted steps: `workflow {"name":"demo:echo","args":{"who":"Ada","items":["a","b"]}}`, then `Run started.`. When `the user prompts "Start the echo." and the model starts a workflow run`. Calls: `1 user Start the echo.`, `2 user Start the echo.`, `2 assistant tool call workflow {"name":"demo:echo","args":{"who":"Ada","items":["a","b"]}}`, `2 tool result workflow returned: started the workflow echo`. Result `completed`, `who=Ada n=2`.

Mutation: the script read `args.missing` instead of `args.who`. The run-ending `Then` failed with actual `{status: 'completed', result: 'who=undefined n=2'}` against `who=Ada n=2`. Restored; green.

### 3. run.feature: "A workflow that calls a sibling by its installed name returns the sibling's result"

`workflows/inner.js` returns `"inner got " + args.word`; `workflows/outer.js` runs `await workflow("demo:inner", {word:"hi"})` and returns `"outer: " + answer`. When `the user runs the workflow command "/demo:outer"`. Result `completed`, `outer: inner got hi`; notice `started /demo:outer`. Neither name starts with `demo-`, so name elision changes neither.

Mutation: outer called `demo:nothing`. The run-ending `Then` failed with actual `{status: 'failed', error: '`export const meta = { name, description, phases }` must be the first statement in the script'}`: the engine reads an unknown name as inline script text. Restored; green.

### 4. agent-steps.feature: "A workflow step with a schema returns the object its subagent reports"

Script `workflows/judge.js`: `agent("Judge the change.", {schema:{type:"object",properties:{verdict:{type:"string"}},required:["verdict"]}})`, returns `"verdict=" + verdict.verdict + " type=" + typeof verdict`. Scripted step: `structured_output {"verdict":"pass"}`, with no reply after it. Result `completed`, `verdict=pass type=object`; notice `started /demo:judge`. The model's calls are not stated, because the step's user text ends with the engine's own output-contract lines (`grep -c "Final output contract"` prints 0).

Mutation: removed the `schema` option. The run-ending `Then` failed with actual `{status: 'failed', error: "Cannot read properties of null (reading 'verdict')"}`. Restored; green.

### 5. collisions.feature: "Two workflow scripts with one name fail the whole install, where Claude Code keeps the last script that parses"

`workflows/a.js` and `workflows/b.js` both declare `name:"scan"`. When `/claude:plugin install demo@fixtures --scope user`. Result fields `kind cascade`, `severity error`, `needs reload false`, `summary A plugin operation has failed.` Plugin row: `fixtures | user | demo@fixtures | demo | failed | | user | 1.0.0 | Generated workflow name collision detected. Rename the meta.name of one of the source scripts:\n  "demo:scan" <- ["a.js", "b.js"] | false | | |`. Then the user `claude-plugins.json` declares no plugins and the user scope has no installed plugins.

Mutation: `b.js` declared `name:"scan-b"`. The result-fields `Then` failed: actual severity `info`, needs reload `true`, and no `summary` row, so the install succeeded. Restored; green.

## Descriptions

- agent-steps.feature: "An agent step of a workflow runs with the plugin agent its agentType names, returns the object its schema asks for, and runs in a git worktree of the project when it asks for isolation. A scripted model and a local marketplace stand in."
- run.feature: "A workflow command, the model by installed name with an argument object, or a sibling script runs a plugin's script in the workflow engine; Pi asks no approval first, unlike Claude Code in its manual permission mode (a Pi gap). A scripted model and a local marketplace stand in."
- collisions.feature: "A workflow keeps a name it shares with a command of its plugin, as in Claude Code, and two scripts of one plugin with one name fail the install, where Claude Code keeps one (WNAM-05). A local marketplace and a registry probe in Pi stand in for a published one and the commands."

## Deviations from Plan

None in substance; the plan executed as written. Two notes:

- Each widened description stays at three lines, and the run.feature description was reworded rather than extended, because the cucumber rules keep a description to two or three lines and require the stand-in sentence.
- Mutations were restored by copying the pre-mutation file back from the scratchpad (`p0803-*.bak`) and checked with `cmp`, not with `git checkout`, because the edits were not yet committed.

## Flagged assumptions (from the plan)

- The files: agent steps in agent-steps.feature, runs in run.feature, name clashes in collisions.feature.
- The worktree scenario's calls table states the engine's own lines around a task (`Requested isolation: worktree`, `Task label: agent N`), as the file's other rows already state the task label. A projection in features/lib/upstream/workflows.ts was not built; the reviewer can ask for it.
- The worktree commands are the writer's: the form that compares git's two directory paths, read from a first run.
- The schema scenario does not state the model's calls; the result alone discriminates (type `object`, and the mutation turns the run failed).
- Today's behavior is pinned, not judged. Decision 14 of the PRD stays open (PG-WF-06).

## Parent lines (for the orchestrator; not applied here)

- PROJECT.md decision row D-PG8-07 (pending the maintainer's review): "Five guard scenarios pin the workflow run paths that no scenario covered: a run the model starts by name with an `args` object (features/workflow/run.feature), `agent({schema})` and `isolation: \"worktree\"` (features/workflow/agent-steps.feature), a `workflow()` call to a sibling by its installed name (features/workflow/run.feature), and two scripts of one plugin with one `meta.name` (features/workflow/collisions.feature). No code changed; each scenario has a recorded mutation that turns it red. Two titles name a difference from Claude Code 2.1.323: the engine keeps an isolation worktree and its branch where Claude Code removes an unchanged one (E7), and two scripts with one name fail the whole install where Claude Code keeps the last script that parses (E5). The step `the project is a git repository with one commit` (features/step_definitions/project.steps.ts) makes the project a repository with the suite's hermetic git."
- BACKLOG note for WOUT-01 ("workflow output quality is unobserved because engine subagents declined every tool call", .planning/BACKLOG.md line 3821): the entry is out of date. Evidence: in "A workflow step that asks for worktree isolation runs in a git worktree of the project, which the engine keeps where Claude Code removes an unchanged one" (features/workflow/agent-steps.feature), two workflow subagents each ran `bash`, and the calls table shows the tool results `bash returned: linked worktree\n` and `bash returned: worktrees 2 branches 2\n`.
- Engine behaviors that PRD section 8.4 or decision 14 covers, listed for the maintainer and not drafted as requests (D-PG8-17):
  1. The engine keeps an isolation worktree and its branch after the step ends, where Claude Code removes an unchanged one (E7). The worktree scenario fails on the day the engine removes it (the count drops to 1).
  2. Two scripts of one plugin with one `meta.name` fail the whole install (WNAM-05, `assertNoWorkflowNameCollisions`), where Claude Code keeps the last script that parses (E5). The collision scenario fails if this changes.
- Cucumber skill layout rules (.agents/skills/cucumber/rules/layout.md, line 54, the sentence listing "the shared step modules (`command`, `config`, `session`, `mcp-configuration`, `git-host`, and the scope and settings modules)"): if the maintainer wants it, add `project` to that list, since `project.steps.ts` is a function-level step module with no feature directory, like `config` and `session`.

## Known Stubs

None.

## Threat Flags

None — no security-relevant surface outside the plan's `<threat_model>` was introduced. T-08-09: the project step reaches git only through `runGit` with `this.tokens.home` as HOME, no system configuration, and an empty global configuration, in `this.tokens.projectDir`; the module names no process API. T-08-10: every scenario states whole tables and a value the engine or the bridge produced, and each has the recorded mutation above. T-08-11: the two `bash` commands are literals that read git state only, in the sandbox project. T-08-SC: no package was installed or changed. Every run used the cucumber sandbox, and no command read, listed, stat'ed or wrote the real `~/.pi/agent` or HOME configuration.

## Self-Check: PASSED

- FOUND: features/step_definitions/project.steps.ts (`the project is a git repository with one commit` 1, `runGit` 4, `child_process` 0)
- FOUND: features/workflow/agent-steps.feature (5 scenarios; `the project is a git repository with one commit`, `Claude Code removes`, `isolation`, `structured_output` 1; `Final output contract` 0)
- FOUND: features/workflow/run.feature (5 `Scenario` lines; `"args":`, `demo:inner`, `argument object` present)
- FOUND: features/workflow/collisions.feature (3 scenarios; `Claude Code keeps` present)
- FOUND: 0f499fb9, d74fb154, 707e3527 (ancestors of HEAD)

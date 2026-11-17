---
phase: 10-plugin-options-variables-and-trust
plan: "11"
subsystem: hooks
status: complete
tags: [user-config, options, hooks, spawn, parity]
requires: ["10-08"]
provides:
  - "the exec-form option fill in planSpawn, after the path variables, for every plugin hook"
  - "UnsetPluginOptionError and ShellFormOptionReferenceError with Claude Code 2.1.323's texts"
  - "the shell-form refusal in planSpawn, on both spawn lanes"
  - "the {em dash} projection of the hook messages step"
affects: [10-20, 10-21]
tech-stack:
  added: []
  patterns: ["a throw from planSpawn reaches the existing start-failure path"]
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/bridges/hooks/spawn-helpers.ts
    - extensions/pi-claude-marketplace/shared/errors-bridges.ts
    - features/hook/process.feature
    - features/hook/failures.feature
    - features/step_definitions/hook/messages.steps.ts
    - test/bridges/hooks/spawn-helpers.test.ts
    - test/bridges/hooks/dispatch-exec.test.ts
    - test/bridges/hooks/async-rewake/registry.test.ts
    - test/shared/errors-bridges.test.ts
decisions:
  - "An exec-form hook's command and string arguments get each ${user_config.KEY} filled from the routing entry's option values after the path variables; a key with no value fails the run with UnsetPluginOptionError, for every plugin (D-PG10-08, D-PG10-10, D-PG10-21)."
  - "A shell-form hook command that names any ${user_config.KEY}, set or not, is refused with ShellFormOptionReferenceError before the spawn on both lanes (D-PG10-10)."
metrics:
  duration: "~70 min"
  completed: 2026-11-15
actuals:
  tokens: 9472
  tasks: 2
  commits: 2
plan_head_before: 71ada6a05a1d1edc87ce4926044ddd1e217ac583
plan_head_after: a7c4603a929de4c86e126f8551770a32006ef13a
---

# Phase 10 Plan 11: Plugin options in exec-form hooks, and the shell-form refusal Summary

`planSpawn` now fills `${user_config.KEY}` in an exec-form hook's command and string arguments after the three path variables. A key with no value fails the run with Claude Code 2.1.323's message. A shell-form command that names an option is refused before the spawn on both lanes. This holds for every plugin hook, also when the plugin declares no `userConfig`.

## Tasks

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Fill plugin options in exec-form hook commands and arguments, and fail a run that names an unset option | b9f2769a | spawn-helpers.ts, errors-bridges.ts, process.feature, failures.feature, 3 test files |
| 2 | Refuse a shell-form hook command that names a plugin option | a7c4603a | spawn-helpers.ts, errors-bridges.ts, messages.steps.ts, failures.feature, 4 test files |

## Red then green

- Task 1, scenario red: `npx cucumber-js --profile adapter --name "plugin option"` on process and failures gave 3 scenarios (1 passed, 2 failed), 45 steps (40 passed, 3 skipped, 2 failed). "An exec-form hook receives plugin options in its arguments (PG-CORE-03)" failed at `Then the hooks record these runs:`. The run held `option-hook ${user_config.mode} --level=${user_config.level} ${user_config.mode}${user_config.level}` where `option-hook fast --level=3 fast3` was expected. "An exec-form hook that names a plugin option with no value fails with Claude Code's message (D-PG10-08)" failed at the same step: `token-hook ${user_config.token}` ran beside the observer.
- Whether the scenario could state the command: no. The hooks table (`features/lib/hook-files.ts`) fixes the command of each form: Node's path for `exec`, and `${CLAUDE_PLUGIN_ROOT}/hooks/<name>.sh` for `exec script`. So the scenario states the arguments only. The unit cases in `spawn-helpers.test.ts` and `dispatch-exec.test.ts` prove the command fill.
- Task 1, owner red: `spawn-helpers.test.ts` and `errors-bridges.test.ts` failed to load (`does not provide an export named 'UnsetPluginOptionError'`, 2 tests, 0 pass). In `dispatch-exec.test.ts`, "D-PG10-10: spawns an exec-form hook with its plugin options filled in" failed, and the run then hung on the first unset-option case. That case waits for a child that the old code spawned with the literal argument, so I stopped the run.
- Task 1, green: the scenario command gave 3 scenarios (3 passed), 45 steps (45 passed). The owner, lane, and hooks integration tests gave 281 tests, 281 pass. Direct coverage of `spawn-helpers.ts`, `errors-bridges.ts`, and `dispatch-exec.ts` exited 0. `test:cucumber:profile -- --profile adapter` on process and failures gave 15 scenarios (15 passed). `check:features` exited 0. The commit hook passed `check:commit`. The tracer gate was green.
- Task 2, scenario red: "A shell-form hook that names a plugin option is not run, with Claude Code's message (D-PG10-10)" gave 1 scenario (1 failed), 16 steps (15 passed, 1 failed), at `Then the hooks show the user these messages:`. The shell ran the hook: `UserPromptSubmit hook error: Failed with non-blocking status code: /bin/sh: line 1: ${user_config.mode}: bad substitution`.
- Task 2, owner red: `spawn-helpers.test.ts` and `errors-bridges.test.ts` failed to load (`does not provide an export named 'ShellFormOptionReferenceError'`). With `--test-name-pattern="D-PG10-10"` and `--test-timeout=5000`, the async lane case failed because it spawned, and the two sync lane cases were cancelled at 5 s because they spawned and waited: 4 tests, 1 pass, 1 fail, 2 cancelled.
- Task 2, green: the scenario gave 1 scenario (1 passed), 16 steps (16 passed). The owner, lane, and integration tests gave 289 tests, 289 pass. Direct coverage of `spawn-helpers.ts`, `errors-bridges.ts`, `async-rewake/registry.ts`, and `dispatch-exec.ts` exited 0. `test:cucumber:profile -- --profile adapter features/hook` gave 248 scenarios (248 passed), 3401 steps. The messages step changed, and every user is under `features/hook`, so I also ran `--profile builtin features/hook`: 13 scenarios (13 passed). `check:features`, `tsc --noEmit`, ESLint on the touched files, `fallow health`, and `fallow dupes` exited 0. The commit hook passed `check:commit`.
- After each pre-commit run I read both error texts again. The first Task 2 run of `fix-unicode-dashes` rewrote two literal U+2014 characters in `errors-bridges.ts` to `--`, because my heredoc wrote the character and not the escape. I restored the `—` escapes, ran the hook again (no change), and ran the tests again before the commit. The committed source holds `—` twice. No file under `features/` holds U+2014.

## Lines for later plans

- `UnsetPluginOptionError` (`shared/errors-bridges.ts`), field `key`. Message: `Plugin option "<key>" isn't set. Open /plugin manage to configure it, or check that the plugin's userConfig schema declares "<key>".`
- `ShellFormOptionReferenceError` (`shared/errors-bridges.ts`), fields `plugin` (`<pluginId>@<marketplace>`) and `command` (the command as written). Message: `Hook from plugin <plugin> references ${user_config.*} in a shell-form command. The substituted value would be re-parsed by the shell. Use exec form instead — {"command": "<executable>", "args": ["${user_config.KEY}", ...]} — or read $CLAUDE_PLUGIN_OPTION_<KEY> from the hook's environment. Command: <command>`. Each `—` is U+2014, written in source as `—`.
- `planSpawn`: the exec arm runs `fillPluginOptions(substituteClaudeVars(text, vars), entry.options.values)` on the command and on each string element. The shell arm throws when `namesPluginOption(command)` is true. That function uses `replaceUserConfigReferences` as the walker, so there is no second pattern.
- What the user sees (measured): `UserPromptSubmit hook error: Failed to run: <message>`, cut to 200 characters with `…`. The refusal is cut inside its first JSON example: `... Use exec form instead {em dash} {"command": "<executab…`. With `onFailure: "block"`, the block reason is `[<command>]: failed; blocking because onFailure is "block"\n<message>`. The async lane debug-logs `[hooks] async-rewake: spawnAndRegister threw (<plugin>/<event>): <message>` and spawns nothing.
- Scenario titles: "An exec-form hook receives plugin options in its arguments (PG-CORE-03)" (process.feature), "An exec-form hook that names a plugin option with no value fails with Claude Code's message (D-PG10-08)" and "A shell-form hook that names a plugin option is not run, with Claude Code's message (D-PG10-10)" (failures.feature). The changed scenario is "An exec-form hook receives its arguments with Claude's path variables filled in", which no longer passes `${user_config.token}`.

## Parent-owned lines requested

- Cucumber skill, `rules/features.md` "Run tokens", a new bullet: "`{em dash}` stands for U+2014, which Claude Code's shell-form refusal of `${user_config.*}` quotes. Only the hook messages step of `features/step_definitions/hook/messages.steps.ts` projects it, for hook notices and rewake summaries, and a command never expands it."
- Parity question for plan 10-20, or the maintainer: the prefix of the unset-option and refusal notices. A throw from `planSpawn` goes down the sync lane's existing start-failure path, which records `failure: { kind: "run" }`. The user sees that kind as `Failed to run: <message>` (D-PG5-11). 10-RESEARCH.md E3 cites the runner's caller in Claude Code 2.1.323: `.catch((St)=>{let wt=d(St);return{stdout:"",stderr:wt,output:wt,status:1,spawnFailed:!0}})` (BIN@312883290). Read that way, upstream shows `Failed with non-blocking status code: <message>`, and the once-per-session rule for a spawn failure (H9n, phase 5 U3) also applies. I did not confirm this with a run. The plan pins the `run` kind, and a change belongs to `dispatch-exec.ts` and `hook-labels.ts`, which are outside this plan's files, so I did not change it. Suggested record: "A throw before the spawn shows `Failed to run:`; upstream may show `Failed with non-blocking status code:` for an option failure (E3). Check before release."
- Out-of-scope note: `redactAbsolutePaths` reduces `${CLAUDE_PLUGIN_ROOT}/hooks/x.sh` in a start-failure cause to `${CLAUDE_PLUGIN_ROOT}x.sh`, because `/hooks/x.sh` reads as an absolute path. The refusal scenario does not show it, because the 200-character cut drops the `Command:` tail. A shorter refusal cause could show it.
- STATE.md decisions: the two `decisions` lines of the frontmatter.
- PG-CORE-03: the exec-form hook half is done. Do not mark the requirement complete here. Its other parts belong to other plans.

## Deviations from Plan

1. **Scenario title.** The plan named "An exec-form hook receives a plugin option in its command and arguments (PG-CORE-03)". The hooks table cannot state the command, so the title says "receives plugin options in its arguments", which is what the scenario proves. `--name "plugin option"` still matches it.
2. **The notice prefix is `Failed to run:`.** The plan's model scenario uses `Failed with non-blocking status code: Error occurred while executing hook command: <cause>`. The measured text for a throw before the spawn is `Failed to run: <cause>`, the `run` kind that the plan's interface names. The scenarios state the measured text. See the parity question above.
3. **The refusal scenario uses the `script` form,** so that its command (`${CLAUDE_PLUGIN_ROOT}/hooks/mode-hook.sh ${user_config.mode}`) holds no machine path. It states the cut text, which ends inside the first JSON example.
4. **The messages step also projects the em dash for rewake summaries,** because both read their text through the same `turnPayloads` function.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-10-20: the shell arm of `planSpawn` refuses any command that names an option, set or not, before a spawn. Owner cases on both lanes assert that nothing is spawned (`processBoundary.calls` and `spawnCalls` are `[]`, and no pid table is written), and the scenario shows that only the observer ran. Exec form passes each value as one argument with `shell: false`. T-10-21: accepted as planned. The cause passes through `redactAbsolutePaths` on the sync lane. T-10-SC: no package was installed or changed.

## Self-Check: PASSED

- FOUND: `UnsetPluginOptionError` and `ShellFormOptionReferenceError` in `extensions/pi-claude-marketplace/shared/errors-bridges.ts` (`D-PG10-08` 1, `D-PG10-10` 1, `Open /plugin manage to configure it` 1, `in a shell-form command` 1, `u2014` 2)
- FOUND: `D-PG10-10` (3) and `replaceUserConfigReferences` (3) in `extensions/pi-claude-marketplace/bridges/hooks/spawn-helpers.ts`; `D-PG10-08` and `D-PG10-10` in `features/hook/failures.feature`; `EM_DASH_TOKEN` in `features/step_definitions/hook/messages.steps.ts`
- FOUND: b9f2769a, a7c4603a (ancestors of HEAD); `git rev-list --count 71ada6a0..HEAD` is 2

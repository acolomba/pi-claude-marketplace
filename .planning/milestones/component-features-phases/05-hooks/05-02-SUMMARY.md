---
phase: 05-hooks
plan: 02
subsystem: hooks
tags: [hooks, exec-form, onFailure, cucumber, harness]

requires:
  - phase: 01-harness-and-version-raise
    provides: hook recorder, published-marketplace writers, hook seed feature and runs step
provides:
  - "planSpawn(entry, vars): exec-form command and args get the three path variables (D-CF5-15, FG-19)"
  - "hookPathVars(entry, transCtx, loc): the one source of CLAUDE_PLUGIN_ROOT / CLAUDE_PLUGIN_DATA / CLAUDE_PROJECT_DIR"
  - "TimerLadder.fired(): tells a timeout kill from another signal kill"
  - "bridges/hooks/on-failure.ts: HookExitFacts, onFailureBlock (D-CF5-18)"
  - "features/lib/hook-files.ts: the complete hooks table writer (forms shell, exec, script, exec script, missing; 12 optional columns)"
  - "features/hook/process.feature (3 scenarios) and features/hook/failures.feature (Outline x3 + 3 scenarios)"
affects: [05-03, 05-04, 05-05, 05-06, 05-07, 05-08, 05-09]

actuals:
  tokens: 18658
  tasks: 3
  commits: 3
plan_head_before: 74829438fbe192908f25198d7d8749e02886f8be
plan_head_after: 8656421a5a8e0b9115fe714765bcde4820a823c5

tech-stack:
  added: []
  patterns:
    - "Script hooks: hooks/<name>.sh around the frozen recorder, with a stable command text ${CLAUDE_PLUGIN_ROOT}/hooks/<name>.sh"
    - "The onFailure check runs before parseHookStdout in the sync lane's close and error handlers"

key-files:
  created:
    - extensions/pi-claude-marketplace/bridges/hooks/on-failure.ts
    - test/bridges/hooks/on-failure.test.ts
    - features/hook/process.feature
    - features/hook/failures.feature
  modified:
    - extensions/pi-claude-marketplace/bridges/hooks/spawn-helpers.ts
    - extensions/pi-claude-marketplace/bridges/hooks/hook-env.ts
    - extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts
    - extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts
    - extensions/pi-claude-marketplace/bridges/hooks/exec-timer.ts
    - features/lib/hook-files.ts
    - features/step_definitions/hook/runs.steps.ts
    - test/bridges/hooks/spawn-helpers.test.ts
    - test/bridges/hooks/hook-env.test.ts
    - test/bridges/hooks/dispatch-exec.test.ts
    - test/bridges/hooks/async-rewake/registry.test.ts
    - test/bridges/hooks/exec-timer.test.ts
    - test/bridges/hooks/runtime.test.ts

key-decisions:
  - "The onFailure reason ends at the head when the hook printed no stderr (upstream's timeout probe shows no trailing newline)"
  - "The runs step projects run tokens in the arguments cell; without it no exec-form path can be stated"
  - "TimerLadder.fired() is true only when the SIGTERM leg signals a child still running at its deadline"
  - "Script hooks need a dir or file publication; the writer throws for a git or hosted one"

patterns-established:
  - "Hooks table: required name | event | matcher, then any closed optional column; empty cell = unset"
  - "A failure scenario with no model script proves the prompt never reached the model"

requirements-completed: [HOOK-06, HOOK-07]

coverage:
  - id: D1
    description: "Exec-form command and string args get ${CLAUDE_PLUGIN_ROOT}, ${CLAUDE_PLUGIN_DATA}, ${CLAUDE_PROJECT_DIR} substituted in both lanes; other ${...} stay literal; shell form untouched"
    requirement: HOOK-06
    verification:
      - kind: unit
        ref: "test/bridges/hooks/spawn-helpers.test.ts#fills Claude's three path variables into exec-form arguments and leaves other placeholders literal"
        status: pass
      - kind: unit
        ref: "test/bridges/hooks/dispatch-exec.test.ts#spawns an exec-form hook with Claude's path variables filled in"
        status: pass
      - kind: unit
        ref: "test/bridges/hooks/async-rewake/registry.test.ts#spawns an async-rewake hook with Claude's path variables filled in"
        status: pass
      - kind: e2e
        ref: "features/hook/process.feature#An exec-form hook receives its arguments with Claude's path variables filled in"
        status: pass
      - kind: e2e
        ref: "features/hook/process.feature#A shell-form hook leaves placeholder text to the shell"
        status: pass
    human_judgment: false
  - id: D2
    description: "onFailure block turns a start failure, an exit other than 0/2, a timeout, or broken JSON into upstream's block; default and continue keep fail-open; Stop/async/asyncRewake ignore it"
    requirement: HOOK-07
    verification:
      - kind: unit
        ref: "test/bridges/hooks/on-failure.test.ts"
        status: pass
      - kind: unit
        ref: "test/bridges/hooks/dispatch-exec.test.ts#blocks a hook its timeout killed with the timed out message"
        status: pass
      - kind: e2e
        ref: "features/hook/failures.feature"
        status: pass
    human_judgment: false
  - id: D3
    description: "The complete hooks table writer every later hook plan uses"
    verification:
      - kind: e2e
        ref: "features/hook/process.feature#An exec-form hook whose command names a script under the plugin root runs it"
        status: pass
      - kind: manual_procedural
        ref: "one-off scratch feature (SUMMARY: One-off writer proofs)"
        status: pass
    human_judgment: false

duration: 50min
completed: 2026-11-01
status: complete
---

# Phase 5 Plan 02: Hook process and onFailure Summary

**Exec-form hooks get Claude's three path variables in `command` and `args` in both dispatch lanes, `onFailure: "block"` turns a failed command hook into upstream's block, and one hooks table now writes every recording, script, exec-script, and missing hook the later hook plans need.**

## Performance

- **Duration:** about 50 min
- **Started:** 2026-11-01T14:55Z
- **Completed:** 2026-11-01T15:44Z
- **Tasks:** 3
- **Files modified:** 17 (4 created, 13 modified)

## Accomplishments

- `planSpawn(entry, vars)` substitutes `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_DATA}`, and `${CLAUDE_PROJECT_DIR}` in the exec-form `command` and every string `args` element (single pass; `${user_config.*}`, `${CLAUDE_SKILL_DIR}`, `${HOME}` stay literal; non-string elements stay JSON text). Shell form is untouched. Both lanes pass `hookPathVars`, which `prepareHookEnv` also reads, so the env and the args always agree (D-CF5-15, D-CF5-16).
- `bridges/hooks/on-failure.ts` implements D-CF5-18: a start failure, an exit other than 0 and 2, a timeout (`TimerLadder.fired()`), or stdout that starts `{` and does not parse becomes `{ kind: "block", reason: "[<command>]: failed; blocking because onFailure is \"block\"\n<stderr>" }` (`timed out` for a timeout). `dispatch-exec.ts` asks it in the `error` and `close` handlers before `parseHookStdout`.
- `features/lib/hook-files.ts` is the complete writer (column reference below), and `features/hook/process.feature` / `features/hook/failures.feature` pin HOOK-06 and the onFailure part of HOOK-07.

## Task Commits

1. **Task 1: Substitute the path variables in an exec-form hook's arguments, end to end** - `f71e363` (feat)
2. **Task 2: Complete the hooks table writer and pin the command forms** - `b8f3ffc` (test)
3. **Task 3: Block on a failed hook when it sets onFailure to block** - `8656421` (feat)

Tracer gate after Task 1: interactive run, `human_verify_mode` end-of-phase, automated-only `<verify>`: re-ran the unit, integration, direct-coverage, cucumber, and check:features commands, all green, so Task 2 continued without a checkpoint.

## Files Created/Modified

- `extensions/pi-claude-marketplace/bridges/hooks/spawn-helpers.ts` - `planSpawn(entry, vars)` with exec-form substitution
- `extensions/pi-claude-marketplace/bridges/hooks/hook-env.ts` - `hookPathVars`; `prepareHookEnv` reads it
- `extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts` - substituted spawn; onFailure check in `error`/`close`; `prepareEnv` wrapper removed (inlined)
- `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts` - `planSpawn(entry, hookPathVars(...))`
- `extensions/pi-claude-marketplace/bridges/hooks/exec-timer.ts` - `TimerLadder.fired()`
- `extensions/pi-claude-marketplace/bridges/hooks/on-failure.ts` (new) - `HookExitFacts`, `onFailureBlock`
- `features/lib/hook-files.ts` - the complete hooks table writer
- `features/step_definitions/hook/runs.steps.ts` - one line: the `arguments` cell projects run tokens (see Deviations)
- `features/hook/process.feature` (new), `features/hook/failures.feature` (new)
- Tests: `spawn-helpers`, `hook-env`, `dispatch-exec`, `async-rewake/registry`, `exec-timer`, `on-failure` (new), `runtime` (fake ladder gains `fired`)

## Hooks table writer column reference

Required, first and in this order: `name` (lower-case letters, digits, dashes), `event`, `matcher`. Then any of these, in any order; an empty cell leaves the column unset; an unknown or repeated column or a malformed cell throws.

| Column | Values | Effect |
| --- | --- | --- |
| `form` | `shell` (default), `exec`, `script`, `exec script`, `missing` | `shell`: `"<node>" "<recorder>" <name> [arguments...]` through the shell. `exec`: `command` = Node, `args` = `[recorder, name, ...arguments]`. `script`: writes `hooks/<name>.sh` (0755), shell-form command `${CLAUDE_PLUGIN_ROOT}/hooks/<name>.sh [arguments...]`. `exec script`: same script, exec-form `command` `${CLAUDE_PLUGIN_ROOT}/hooks/<name>.sh`, `args` = arguments (`[]` when none). `missing`: that exec-form command, no script written. |
| `arguments` | JSON array of strings | exec forms: `args` elements; `shell`/`script`: words appended verbatim (the shell reads their quoting). |
| `output` | text | script prints it to stdout verbatim (after recording). |
| `stderr` | text | script prints it to stderr verbatim. |
| `exit code` | integer 0-255 | script exit code (default 0). |
| `sleep` | number of seconds | script sleeps after printing; the sleep holds no pipe of the hook. |
| `meets` | name of another hook of the table | script creates `$HOME/hook-meetings/<name>`, waits at most 3 s for `$HOME/hook-meetings/<meets>`, and records `met` or `alone` as its second argument. |
| `on reentry` | `allow` | after recording, exits 0 with no output when stdin holds `"stop_hook_active":true`. |
| `timeout` | number of seconds | handler `timeout`. |
| `if` | text | handler `if`. |
| `on failure` | `block`, `continue` | handler `onFailure`. |
| `once` | `true`, `false` | handler `once` (boolean). |

Behavior columns (`output`, `stderr`, `exit code`, `sleep`, `meets`, `on reentry`) on a `shell`, `exec`, or `missing` row throw. Script hooks need a `dir` or `file` publication (the writer throws for git and hosted). Publishing again replaces `hooks/hooks.json` and the scripts; `publishRecordingHooks` re-reads each script and throws when its bytes differ. The three exported signatures are unchanged (`parseRecordingHooks(rows)`, `recordingHooksText(hooks)`, `publishRecordingHooks(published, plugin, hooks): Promise<string>`); every new `RecordingHook` field is optional, so a literal `{ name, event, matcher }` still type-checks.

## Red proofs

1. **Exec-form arguments (Task 1, before the product change).** `npx cucumber-js features/hook/process.feature` failed in `Then the hooks record these runs:` with the arguments cell `exec-hook ${CLAUDE_PLUGIN_ROOT}/bin/tool --data=${CLAUDE_PLUGIN_DATA} ${CLAUDE_PROJECT_DIR} ${user_config.token} ${HOME}` (literal placeholders) against the expected `exec-hook {home}/marketplaces/fixtures/plugins/demo/bin/tool --data={project dir}/.pi/pi-claude-marketplace/data/demo {project dir} ${user_config.token} ${HOME}`. Every other column already matched. Unit RED in the same task: the three `planSpawn` cases, the `dispatch-exec` and `registry` substitution cases failed on assertions with the literal placeholders; `hook-env.test.ts` failed to load (no `hookPathVars` export).
2. **Exec-script command (Task 2, temporary negative product edit).** With `planSpawn` returning the exec-form `command` unsubstituted, `npx cucumber-js features/hook/process.feature:30` failed: the runs table came back empty (`+ []`), because the literal `${CLAUDE_PLUGIN_ROOT}/hooks/script-hook.sh` cannot spawn. Restored with `git checkout -- extensions/pi-claude-marketplace/bridges/hooks/spawn-helpers.ts`; `git diff --quiet HEAD -- extensions/pi-claude-marketplace/bridges/hooks/spawn-helpers.ts` exited 0.
3. **Shell form leaves text to the shell (Task 2, temporary negative feature edit).** Expecting `shell-hook {home}/marketplaces/fixtures/plugins/demo/x`, the scenario failed with actual `shell-hook ${CLAUDE_PLUGIN_ROOT}/x`. The feature was restored from a saved copy, and after the commit `git diff --quiet HEAD -- features/hook/process.feature` exited 0.
4. **onFailure (Task 3, before the product change).** `npx cucumber-js features/hook/failures.feature`: 6 scenarios, 4 failed, all with `AssertionError: the model was called past the end of its script` (the three Outline rows, exit 1 + `boom`, `{not json`, timeout 1 + sleep 3, and the cannot-start scenario), because today a failing hook is a noop and the prompt reached the model. The two pass-through scenarios passed. Unit RED: the four `dispatch-exec` onFailure cases returned `noop`; the `exec-timer` cases failed with `ladder.fired is not a function`; `on-failure.test.ts` failed to load (module absent).

After the fixes: `npx cucumber-js features/hook` 10 scenarios, 122 steps, all passed.

## One-off writer proofs

Scratch feature and steps under the session scratchpad (`exec-05-02/oneoff/`, not committed), run with `npx cucumber-js --import <scratch steps> <scratch feature>` against the repo's real steps. Observed:

| Case | Observed recorder rows / outcome |
| --- | --- |
| `script`, `output` = UserPromptSubmit `additionalContext` JSON, `exit code` 0 | one run `ctx`; disposition `started`; the model call held a `user` row `extra-ctx` (the stated one-row call table failed on it, which proves the output was read) |
| `script`, `exit code` 2, `stderr` `it's denied` (single quote) | one run `deny`; disposition `handled`; no model call (prompt blocked) |
| `script`, `sleep` 1 | one run `slow`; prompt reached the model |
| `left` meets `right`, `right` meets `left` | runs `left alone`, `right met` (sequential dispatch today) |
| Stop, `script`, `exit code` 2, `stderr` `keep going`, `on reentry` `allow` | two Stop runs `again`: `stop_hook_active` false (blocked, re-entered), then true (allowed); the re-entered turn ran once and ended |
| `exec script`, `arguments` `["two words", "${CLAUDE_PLUGIN_ROOT}"]` | one run, arguments `es`, `two words` (one argument), `<home>/marketplaces/fixtures/plugins/demo` |
| `observer` + `missing` `gone` | one run `observer`; `gone` never started; prompt reached the model (no onFailure) |
| republish (`first`, then `second`) before install | one run `second` (hooks.json replaced, no `wx` refusal) |
| unknown column `colour` | Given threw `the hooks table has an unknown column: colour` |
| `exit code` on a shell row | Given threw `the hook x sets exit code, which needs the script form` |

A node script printed `recordingHooksText` for `timeout` 1.5, `if` `Bash(git *)`, `on failure` block/continue, `once` true/false, and a `missing` row (handler fields `timeout: 1.5`, `if`, `onFailure`, `once: true|false`, `args: []`), and showed a throw for each malformed cell: form `pipe`, exit code `1.5`, sleep `soon`, timeout `-1`, on failure `stop`, once `yes`, on reentry `deny`, meets `nobody`, arguments `[1]`, a repeated column, and `sleep` on a `missing` row.

## Decisions Made

- The onFailure reason omits the `\n<stderr>` part when the trimmed stderr is empty. Upstream's timeout probe (`research-b/probeC.M888/out/fail-pre-timeout.jsonl`) ends at `"block"` with no newline; the exit-1 probe shows `\noops` (stderr trimmed).
- The command in the reason is the raw declared `command` (placeholders included), as upstream's `[node ${CLAUDE_PLUGIN_ROOT}/missing.js]` probe shows; exec-form `args` are not appended.
- The onFailure check runs before the parse, so exit 1 with valid deny JSON blocks with the onFailure message (the plan's flagged assumption).
- `TimerLadder.fired()` is true only when the SIGTERM leg signals a child still running at its deadline; a budget that elapses after the child exited (HKDR-01, a grandchild holding the pipe) is not a timeout.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Projected run tokens in the runs step's `arguments` cell**
- **Found during:** Task 1
- **Issue:** `runs.steps.ts` joined `run.arguments` raw, while every stdin and env cell is token-projected, so the exec-form scenario could not state `{home}`/`{project dir}` paths (it failed with the real `/tmp/pi-cm-features-*/...` paths after the fix). The plan lists `runs.steps.ts` as frozen for this wave (plan 05-01 owns it).
- **Fix:** one line in `runRecord`: `["arguments", projectTokens("text", run.arguments.join(" "), tokens)]`. Plan 05-01's own edits (session-id projection inside `cell()`, the any-order step) sit elsewhere in the file; at the time of the edit the sibling worktree had not touched that line.
- **Files modified:** `features/step_definitions/hook/runs.steps.ts`
- **Verification:** the seed and all process/failures scenarios pass; `npm run check:features` passes.
- **Committed in:** `f71e363`

**2. [Rule 3 - Blocking] Gave the runtime test's fake ladder a `fired()` method**
- **Found during:** Task 3
- **Issue:** adding `fired()` to `TimerLadder` broke `test/bridges/hooks/runtime.test.ts`, whose fake `satisfies TimerLadder` (TS1360/TS2741). The file is not in the plan's list.
- **Fix:** the fake returns `false` from `fired()`.
- **Files modified:** `test/bridges/hooks/runtime.test.ts`
- **Committed in:** `8656421`

**3. [Rule 1 - Cleanup] Inlined `dispatch-exec.ts`'s `prepareEnv` wrapper**
- **Found during:** Task 1
- **Issue:** the sync lane needs the same `locationsFor` result for the env and for `hookPathVars`.
- **Fix:** `dispatchHookExec` computes `loc` once and calls `prepareHookEnv` and `hookPathVars` with it; the one-line private wrapper went away.
- **Committed in:** `f71e363`

The reviewed `code-duplication` marker in `dispatch-exec.ts` was removed, `npx fallow dupes` re-run, and the marker restored above the `settle(...)` line, which the group (`dup:47665ee9`, `dispatch-exec.ts` 426-438 with `registry.ts` 360-371) still spans; with both markers in place `npx fallow dupes` reports no duplication.

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 cleanup)
**Impact on plan:** Needed to state the scenario and keep the tree typed. The `runs.steps.ts` line may need a trivial merge with plan 05-01.

## Issues Encountered

- `writePublishedPluginFiles` commits before the writer can `chmod` the script, so script hooks cannot carry the mode bit through a git publication; the writer throws for git and hosted kinds instead of writing a script that cannot run.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-05-05/T-05-06 (substitution only on the `shell: false` arm, single pass), T-05-07 (onFailure block fails closed on the four failure kinds), and T-05-08 (`meets` bounded at 3 s, explicit `sleep`) are implemented as planned.

## Parent lines

None.

## Verification

- `node --test` on spawn-helpers, hook-env, dispatch-exec, async-rewake/registry, exec-timer, on-failure, runtime, and `test/integration/hooks-spawn-end-to-end.test.ts`: all pass; `node --test test/architecture/no-shell-out.test.ts`: 8 pass.
- `npm run test:coverage:direct --` on all six sources: exit 0, no shortfall line.
- `npx cucumber-js features/hook`: 10 scenarios, 122 steps passed.
- `npm run check:static` (typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features): all passed after the last edit.
- Acceptance greps: `substituteClaudeVars` in spawn-helpers 3; `planSpawn(entry, ` 1 in each lane; `^Feature: Hook process$` 1; `exec script` 6 and `meets` 12 in hook-files; process scenarios 3; `onFailureBlock(` 2 in dispatch-exec; `blocking because onFailure is` 2 in on-failure; `^Feature: Hook failures$` 1 with three Examples rows.

## Next Phase Readiness

Plan 05-03 can show the onFailure block to the model through the PreToolUse adapter, and plan 05-07 can report it on events with no block. Every later hook plan can write its hooks from the table above without editing `features/lib/hook-files.ts`.

## Self-Check: PASSED

- Created files exist: `on-failure.ts`, `on-failure.test.ts`, `process.feature`, `failures.feature`.
- Commits `f71e363`, `b8f3ffc`, `8656421` are ancestors of HEAD; `git rev-list --count 74829438..HEAD` = 3.

---
*Phase: 05-hooks*
*Completed: 2026-11-01*

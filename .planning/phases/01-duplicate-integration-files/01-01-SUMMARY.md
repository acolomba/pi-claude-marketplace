---
phase: 01-duplicate-integration-files
plan: "01"
subsystem: testing
tags: [cucumber, integration-tests, hooks, fallow]

requires: []
provides:
  - "Red proofs that cucumber scenarios guard the five behaviors of the deleted hook spawn test (E1 to E5)"
  - "The deletion of test/integration/hooks-spawn-end-to-end.test.ts"
affects: [integration-rescope, fallow-audit CI job]

actuals:
  tokens: 3702
  tasks: 3
  commits: 1
plan_head_before: f67fe6c95f8990300637126823536c5d85619baf
plan_head_after: d743fafbc8b17608ff73960208d6eb664bc7e118

tech-stack:
  added: []
  patterns:
    - "Deliberate-break helper: one exact replacement, run the scenarios, restore with git checkout in an EXIT trap, log root and restored state"

key-files:
  created: []
  modified: []
  deleted:
    - test/integration/hooks-spawn-end-to-end.test.ts

key-decisions:
  - "No gap scenario was added: every break failed scenarios of the detector set on an assertion, so features/plugin/session-start-hooks.feature is unchanged"
  - "The fallow audit warn verdict (weakened-tests on the deleted file) is left to the milestone; .fallowrc.json is unchanged"

patterns-established:
  - "Read a cucumber failure as `N) <title> # <file>:<line>`: the reporter prints no `Scenario: ` prefix"

requirements-completed: [ITDUP-01]

coverage:
  - id: D1
    description: "Each of the five behaviors the hook spawn test pinned fails at least one scenario when broken on purpose, and the detector set is green under both profiles with no break"
    requirement: ITDUP-01
    verification:
      - kind: other
        ref: "npm run test:cucumber:profile -- --profile adapter --parallel 2 <detector set> (baseline: 11 scenarios (11 passed))"
        status: pass
      - kind: other
        ref: "npm run test:cucumber:profile -- --profile builtin --parallel 2 <detector set> (baseline: 2 scenarios (2 passed))"
        status: pass
      - kind: other
        ref: "$D/break.sh E1..E5 adapter, each with exit=1 and restored=clean; log check with the reporter's `N) <title> # <file>:<line>` prefix"
        status: pass
    human_judgment: false
  - id: D2
    description: "test/integration/hooks-spawn-end-to-end.test.ts is deleted, no file outside .planning names it, and the static checks pass without it"
    requirement: ITDUP-01
    verification:
      - kind: other
        ref: "npm run check:static (exit 0)"
        status: pass
      - kind: other
        ref: "npx --no fallow audit --base f67fe6c9 (0 dead code, 0 complexity, 0 clone groups; only weakened-tests on the deleted file)"
        status: pass
    human_judgment: false

duration: 16min
completed: 2026-11-21
status: complete
---

# Phase 1 Plan 01: Duplicate Hook Spawn Test Summary

**Five deliberate breaks (SessionStart dispatch, `CLAUDE_PLUGIN_ROOT` value, timeout in seconds,
root containment, cross-scope routing wipe) each failed cucumber scenarios on assertions, so
`test/integration/hooks-spawn-end-to-end.test.ts` was deleted with no new scenario.**

## Performance

- **Duration:** 16 min
- **Started:** 2026-11-21T14:28:23Z
- **Completed:** 2026-11-21T14:44:42Z
- **Tasks:** 3
- **Files modified:** 1 (deleted)

## Accomplishments

- A green baseline of the 11-scenario detector set under adapter, and of its two `@mcp`
  scenarios under builtin.
- Breaks E1 to E5 each failed scenarios of the set on an assertion. Each break was restored, and
  no break reached a commit.
- The duplicate integration file is deleted in its own commit, `check:static` passes, and the
  audit shows only the expected test-removal warning.

## Task Commits

1. **Task 1: Prove the break protocol end to end with a green baseline and break E1**: no
   commit (evidence only, in the scratch folder)
2. **Task 2: Record breaks E2 to E5 against the detector set**: no commit (no gap, so step 3 did
   not run)
3. **Task 3: Delete the duplicate integration file**: `d743faf` (test)

## Red proofs

Scratch folder `$D` =
`/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad/phase01-plan01`.
Every command ran from this plan's checkout,
`/home/user/pi-claude-marketplace/.claude/worktrees/agent-a6ca81828b13e97f5` (each break log's
first line is `root=` with that path), with the non-DAC wrapper prefix and `--parallel 2`.

The detector set, in every run: `features/plugin/session-start-hooks.feature`
`features/hook/session.feature:7` `:391` `:410` `features/hook/failures.feature:31`
`features/hook/session-end.feature:153` `:200` `features/hook/async.feature:470`
`features/plugin/subagent-child.feature:542` `features/agent/frontmatter.feature:410`.

- **Baseline, adapter:** `npm run --silent test:cucumber:profile -- --profile adapter --parallel 2 <set>`:
  `11 scenarios (11 passed)`, 121 steps, exit 0 (`$D/baseline-adapter.log`).
- **Baseline, builtin:** the same with `--profile builtin`: `2 scenarios (2 passed)` (the two
  `@mcp` scenarios, `subagent-child.feature:542` and `frontmatter.feature:410`), 13 steps,
  exit 0 (`$D/baseline-builtin.log`). The untagged scenarios are not selected there (DUAL-02).

Each break ran as `bash "$D/break.sh" <id> adapter <file> "$D/<id>.old" "$D/<id>.new" <set>`.
No run printed a cucumber step timeout, so no run was repeated. Each log ends with `exit=1` and
`restored=clean`, and `git status --porcelain -- extensions/` printed nothing after each break.

- **E1, SessionStart dispatch.** `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts:1509-1512`.
  Change (from the log): `-await sessionStartHandler(` / `-{ source: claudeSessionStartSource(event.reason, launch) },` /
  `-ctx,` / `-);` replaced by `+void launch;` (12-space indent).
  Result `11 scenarios (4 passed, 7 failed)`. Failed:
  - `session-start-hooks.feature:6` and `:19`: `Error: ENOENT: no such file or directory, open '.../project/session-starts.log'`.
  - `hook/session.feature:7` and `hook/session-end.feature:153`: `AssertionError: Expected values to be strictly deep-equal` (the SessionStart rows are missing from the runs table).
  - `hook/session.feature:391` and `:410`: `AssertionError: the terminal pi ran no SessionStart startup hook`.
  - `plugin/subagent-child.feature:542`: deep-equal on "the main session's hooks record these runs for its control prompt".
  Passed: `failures.feature:31`, `session-end.feature:200`, `async.feature:470`, `frontmatter.feature:410`.
- **E2, `CLAUDE_PLUGIN_ROOT` value.** `bridges/hooks/hook-env.ts:47`.
  Change: `-pluginRoot: entry.resolvedSource,` to
  `+pluginRoot: path.join(loc.extensionRoot, "sources", entry.marketplace, "plugins", entry.pluginId),`.
  Result `11 scenarios (1 passed, 10 failed)`. Failed:
  - `session-start-hooks.feature:6` and `:19`: `ENOENT ... session-starts.log`.
  - `hook/session.feature:7`, `:410`, `failures.feature:31`, `session-end.feature:153`, `:200`, `subagent-child.feature:542`: deep-equal on the runs tables (no run recorded through the synthesized root).
  - `hook/session.feature:391`: `AssertionError: the terminal pi ran no UserPromptSubmit hook for the prompt after the reload`.
  - `hook/async.feature:470`: `Error: the hook wake logged no start within 19978 ms`.
  Passed: `frontmatter.feature:410`.
- **E3, declared `timeout` read as seconds.** `bridges/hooks/timeout.ts:139`.
  Change: `-return capSessionEndTimeout(raw, event, pluginId, lane);` to
  `+return capSessionEndTimeout(raw / 1000, event, pluginId, lane);`.
  Result `11 scenarios (8 passed, 3 failed)`. Failed:
  - `failures.feature:31` (row `timeout 1, sleep 3`): deep-equal, the hooks record no run at all (`+ []`), because the hook is stopped after 1 ms.
  - `session-end.feature:153` and `:200` (rows `timeout 60, sleep 60`): deep-equal on the runs tables.
  Passed: `session-start-hooks.feature:6`, `:19`, `session.feature:7`, `:391`, `:410`, `async.feature:470`, `subagent-child.feature:542`, `frontmatter.feature:410`.
- **E4, containment of `CLAUDE_PLUGIN_ROOT` (HOOK-E2E-05).** `bridges/hooks/hook-env.ts:93`.
  Change: after `const vars = hookPathVars(entry, transCtx, loc);` added
  `+  await assertPathInside(loc.extensionRoot, vars.pluginRoot, "CLAUDE_PLUGIN_ROOT");`.
  Result `11 scenarios (11 failed)`. Failed:
  - `session-start-hooks.feature:6` and `:19`: `ENOENT ... session-starts.log`. A dir-source root outside the extension directory spawns its hook only because no containment check exists.
  - `hook/session.feature:7`, `failures.feature:31`, `session-end.feature:153`, `:200`: deep-equal on the runs tables.
  - `hook/session.feature:391` and `:410`: `the terminal pi ran no SessionStart startup hook`.
  - `hook/async.feature:470` (background lane): `the hook wake logged no start within 19994 ms`.
  - `subagent-child.feature:542` and `frontmatter.feature:410`: deep-equal on "the real children's hooks record these runs in any order, and no main-session run names a child".
  Passed: none.
- **E5, cross-scope wipe of user-scope routing.** `bridges/hooks/event-router.ts:994`.
  Change: `-const projectKeyPrefix = "project\x00";` to `+const projectKeyPrefix = "";`.
  Result `11 scenarios (7 passed, 4 failed)`. Failed:
  - `hook/session.feature:391` and `:410`: `AssertionError: the terminal pi ran no SessionStart startup hook` (the Given at `features/step_definitions/hook/session.steps.ts:186-192`).
  - `subagent-child.feature:542` and `frontmatter.feature:410`: deep-equal on the real children's runs.
  Passed: `session-start-hooks.feature:6` and `:19` (project scope, as expected), `session.feature:7`, `failures.feature:31`, `session-end.feature:153`, `:200`, `async.feature:470`.

E1 and E4 together satisfy ROADMAP Phase 1 success criterion 1: both fail both scenarios of
`features/plugin/session-start-hooks.feature`.

## Checks

All on Node `v24.22.3` (CONTEXT recorded v22.23.5; this container runs v24, inside the engines
range).

| Command | Exit | Tree |
| --- | --- | --- |
| Baseline adapter verify (11 passed) | 0 | `f67fe6c9`, clean |
| Baseline builtin verify (2 passed) | 0 | `f67fe6c9`, clean |
| E1 log verify, as written (`Scenario: ` prefix) | 1 | see Deviations |
| E1 log verify, reporter prefix `N) <title> # ` | 0 | `f67fe6c9`, clean after restore |
| Task 2 log verify, as written | 1 | see Deviations |
| Task 2 log verify, reporter prefix | 0 | `f67fe6c9`, clean after restore |
| `npm run --silent lint` (warm-up) | 0 | `f67fe6c9` plus the staged deletion |
| `npm run --silent check:static` | 0 | `f67fe6c9` plus the staged deletion (the content of `d743faf`) |
| `npx --no fallow audit --base f67fe6c9 --format json --quiet` | 0, verdict `warn` | before and after commit `d743faf` |
| File absent, deletion committed, no reference outside `.planning/` | 0 | `d743faf` |
| `git diff f67fe6c9 HEAD -- extensions/` and `git status --porcelain -- extensions/` empty | 0 | `d743faf` |

The commit hook printed "(no files to check)" for `npm run check:commit` and prettier, because
the commit only deletes a file. The post-merge `npm run check` of the wave is the full verdict.

## Issues for the milestone

- `fallow audit --base f67fe6c9` reports verdict `warn` with 0 dead-code issues, 0 complexity
  findings, and 0 clone groups. Its only finding is `weakened-tests` (kind `removed-tests`,
  "test cases: 2 -> 0") on `test/integration/hooks-spawn-end-to-end.test.ts`.
- The CI job `fallow-audit` in `.github/workflows/lint.yml` fails on a `warn` verdict, so the
  milestone's pull request fails that job as it stands.
- fallow's remedy (action `suppress-in-config`, not auto-fixable): "Set `weakened-tests` to `off`
  for `test/integration/hooks-spawn-end-to-end.test.ts` in an `overrides` entry of the Fallow
  config". This plan did not change `.fallowrc.json`. The milestone decides.

## Files Created/Modified

- `test/integration/hooks-spawn-end-to-end.test.ts`: deleted (371 lines, 2 test cases).

## Decisions Made

- No gap scenario was added. Every break failed scenarios on an assertion, so Task 2 step 3 did
  not run and `features/plugin/session-start-hooks.feature` is unchanged.
- E4 shows the missing containment check on `CLAUDE_PLUGIN_ROOT` working as the header of
  `prepareHookEnv` describes. It was not "fixed".

## Deviations from Plan

**1. [Rule 3 - Blocking] The verify grep for failed scenarios matches nothing the reporter prints**

- **Found during:** Task 1 (E1 log verify)
- **Issue:** The `<verify>` commands of Tasks 1 and 2 look for `Scenario: .*<file>:<line>`. This
  project's cucumber reporter lists a failure as `  N) <title> # <file>:<line>` and prints no
  `Scenario: ` prefix, so those commands exit 1 on every valid detection.
- **Fix:** Each command ran as written (exit 1, recorded above). It then ran with every check
  unchanged except the prefix, which became `^ *[0-9]+\) .* # features/.*` (exit 0). The plan file
  is not edited. A verifier that reruns the plan's verify commands verbatim will see the same
  exit 1. The Task 2 form is in `$D/verify-task2.sh <root> <prefix>`.
- **Files modified:** none in the repository.

**2. Breaks that failed a set other than research expected (all still valid detections)**

- E1 failed 7 scenarios, not the 2 that research expected. Removing the SessionStart dispatch
  also fails every SessionStart row in `hook/session.feature`, `session-end.feature:153`, and the
  main session's runs in `subagent-child.feature:542`.
- E2 failed 10 scenarios, not 3. Every dir-source fixture hook runs through
  `${CLAUDE_PLUGIN_ROOT}`, so the synthesized root breaks nearly all of them. The session start
  error is `ENOENT` on `session-starts.log`, not the synthesized path, which acceptance allows.
- E3: `async.feature:470` passed, though research saw it fail. `failures.feature:31` (no run at
  all), `session-end.feature:153`, and `:200` failed, so E3 is still detected, and its decisive
  row is the 1 s timeout read as 1 ms.
- E4 failed all 11 scenarios, not 4.
- E5 matched research exactly.

---

**Total deviations:** 1 auto-fixed (verify pattern, Rule 3) and 1 recorded difference from the
expected failures. **Impact on plan:** none on the result. Every break was detected, and the
deletion went ahead as planned.

## Issues Encountered

- This session's sandbox rejects a Bash call that combines git with other commands. The checks
  ran as separate git commands, and the compound verify commands ran from small scripts in `$D`
  (`verify-task2.sh`, `verify-task3.sh`, the latter verbatim from the plan).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- ITDUP-01 is done once the wave merges and the post-merge `npm run check` passes.
- Open for the milestone: the `fallow-audit` CI job fails on the `weakened-tests` warning.
- For the verifier: the Task 1 and Task 2 verify commands, as written, exit 1 (Deviation 1).

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

- `test/integration/hooks-spawn-end-to-end.test.ts`: absent (deleted as planned).
- `d743faf`: an ancestor of HEAD (it is HEAD before this SUMMARY's commit).
- Task 1 to 3 acceptance criteria rerun: all pass, with the reporter prefix for the log greps.

---

*Phase: 01-duplicate-integration-files*
*Completed: 2026-11-21*

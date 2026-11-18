---
phase: 06-hook-inputs-and-events
plan: "03"
subsystem: hooks
status: complete
tags: [hooks, SessionStart, resume, fork, cucumber, saved-sessions]
requires:
  - phase: 06-hook-inputs-and-events
    provides: "06-01 spike S7 result (06-S7-SPIKE.md `## Result`); 06-02 runs.steps.ts token hook (`hookRunTokens`)"
provides:
  - "`SessionLaunchFacts` and the second parameter of `claudeSessionStartSource` (bridges/hooks/payloads/session-start.ts)"
  - "`RegisterHooksBridgeOptions.processStartedAt` (bridges/hooks/event-router.ts), default `performance.timeOrigin`"
  - "`PiSessionLaunch` (`saved`, `continue`, `open` + file, `fork` + file) and `session` on `RpcProfile` / `PiArgumentOptions` (test/e2e/_rpc.ts)"
  - "Profile option `session: \"saved\"` and restart kinds `new-session`, `continue-session`, `open-session`, `fork-session` (features/support/world.ts)"
  - "features/lib/saved-sessions.ts: `sessionsFolder`, `latestSessionFile`, `projectSessionFile` and the `{session file}` token"
affects: [06-13]
tech-stack:
  added: []
  patterns:
    - "A restart that continues, opens, or forks a session drops the payloads the stopped Pi's saved session already held, after asserting they are the report's prefix"
key-files:
  created:
    - features/lib/saved-sessions.ts
  modified:
    - extensions/pi-claude-marketplace/bridges/hooks/payloads/session-start.ts
    - extensions/pi-claude-marketplace/bridges/hooks/event-router.ts
    - test/bridges/hooks/payloads/session-start.test.ts
    - test/bridges/hooks/event-router.test.ts
    - test/e2e/_rpc.ts
    - features/support/world.ts
    - features/step_definitions/hook/session.steps.ts
    - features/step_definitions/hook/runs.steps.ts
    - features/hook/session.feature
decisions:
  - "At reason `startup`: fork first (header `parentSession` and `Date.parse(header.timestamp) >= processStartedAt`), then resume (any `message` entry), else startup (D-PG6-14, D-PG6-15; spike S7 Result)"
  - "The launch facts are read only for reason `startup` and only where SessionStart dispatches; in-session reasons pass constant facts that the mapping ignores"
  - "`--fork` gets its own source `fork`: the spike showed the time test separates a new fork from a continued one (D-PG6-15 first case)"
requirements-completed: [PG-HOOK-11]
metrics:
  duration: "~45 min"
  completed: 2026-11-14
estimate:
  tokens: 96000
actuals:
  tokens: 13438
  tasks: 2
  commits: 2
plan_head_before: 9d6e4a74c87ae82f21d8599c2cb2048213b78fa4
plan_head_after: 4a92c7b290cc7b51a9d2889e67e43be273041bd2
---

# Phase 6 Plan 03: SessionStart resume and fork at a Pi launch Summary

**A `SessionStart` hook now receives `resume` when Pi starts with `--continue` or `--session <file>` and `fork` when Pi starts with `--fork <file>`, decided from `ctx.sessionManager` alone; the cucumber harness can start the profile Pi with a saved session and restart it in each of those modes.**

## Performance

- Started: 2026-11-14T23:10:41Z
- Completed: 2026-11-14T23:54:31Z
- Tasks: 2 of 2
- Files: 10 (1 created, 9 modified)

## Task Commits

1. **06-03-01: Start the profile Pi with a saved session, on the unchanged production tree** - `c7c5bf81` (test) `test(hooks): start the profile pi with a saved session`
2. **06-03-02: Report resume for a continued session and fork for a forked one** - `4a92c7b2` (feat) `feat(hooks): send resume and fork to SessionStart at a pi launch`

Both commits ran the full pre-commit pipeline, `npm run check:commit` included (Passed in the first hook pass of each). The first attempt of commit 2 failed in the hook on one fallow clone group (see Deviations); nothing was committed then, and the retry passed.

## The spike rows the rule rests on (06-S7-SPIKE.md `## Result`)

Precondition of task 06-03-02 checked: the Result answers both questions from launches that ran on Pi 1.5.0 and Pi 1.5.2.

- "Reason of `--continue` (launches 2, 5, 8b, 10) | `startup` | `startup`"; "Reason of `--session <file>` (launches 3, 9) | `startup`"; "Reason of `--fork <file>` (launch 4) | `startup`"; "Reason of a new session (launches 1, 6, 7, 8a, 11) | `startup`".
- "A continued or opened session holds a `message` entry at `session_start` | yes: 3, 5, 9, 3, 2, and 5 entries in launches 2, 3, 5, 8b, 9, 10".
- "Entry types of a new session at `session_start` | `model_change`, `thinking_level_change` (launches 1, 6, 7, 11); `session_info`, `model_change`, `thinking_level_change` under `--name` (launch 8a); no `message`".
- "Forked session (launch 4): header has `parentSession` | yes"; "header `timestamp` at or after `performance.timeOrigin` | yes, 1792 ms after | yes, 442 ms after"; "`message` entries at `session_start` | 7, copied from launch 1's file".
- "Continued fork (launch 5): header still has `parentSession` | yes"; "header `timestamp` before `performance.timeOrigin` | yes, 324 ms before | yes, 277 ms before".
- "A new session: header `timestamp` against `performance.timeOrigin` | after it ... a new session also passes the 'made in this launch' test, so the test separates forks only together with `parentSession`".
- "`--continue` in a folder with no session (launch 7) | Pi starts a new session, no error, exit 0".
- Saved session: "Folder ... `sessions/--<cwd without its leading slash, each / replaced by ->--/`"; "Form of the file name `<header timestamp, with : and . replaced by ->_<session id>.jsonl`"; for `--continue` the file "with the newest modification time".

## The rule that was built

- `resume`: reason `startup` and `ctx.sessionManager.getEntries()` holds at least one entry of type `message`, unless the fork test holds. A count of all entries is never used, so a new session with its `model_change` and `thinking_level_change` entries reads `startup` (F7).
- `fork`: reason `startup`, `getHeader().parentSession !== undefined`, and `Date.parse(header.timestamp) >= processStartedAt`. The fork test runs first, because a new fork holds the copied messages. A continued fork has an older header and reads `resume` (Pitfall 5). A timestamp that does not parse gives `NaN`, which compares false, so it marks no fork. For `fork`, the first case of the plan applies: the spike shows that the test separates the two, so `--fork` gets its own source.
- `processStartedAt` is `RegisterHooksBridgeOptions.processStartedAt ?? performance.timeOrigin`, read once per registration.
- The read runs only for reason `startup` and only where `dispatchesInCurrentSession("SessionStart")` holds, inside the handler's `try`. A read that throws writes one debug line (`[hooks] session_start skipped: <message>`), dispatches nothing, and does not throw (NFR-2). The guard key, the reload return, and the compaction path are unchanged. No file of either commit reads `process.argv`, and the detection reads no file. The harness's file reads are in features/ only.
- The in-session mapping is unchanged: `new` is `clear`, `resume` is `resume`, `fork` is `fork`, and `reload` runs no SessionStart.

## Harness: how a scenario's saved session is made and removed

- `Given pi runs with the scripted model and saves its session` starts the profile Pi with `session: "saved"`, which passes no session flag, so Pi saves its session. The step asserts that `get_state.sessionFile` lies in `sessionsFolder(tokens)`.
- The scenarios make the saved session the way the Result supports, with a first Pi that takes one prompt (`Given the user has prompted "hello"`). Pi writes the file only once the session holds a user and an assistant message. A hand-written file was not needed.
- `usePiWithProfile` registers `rm(sessionsFolder, { recursive: true, force: true })` before the Pi starts, so the release removes the folder after every profile Pi of the scenario has stopped.
- Check that nothing is left: a scratch `--import` hook (`p0603-check/after-all.mjs`, outside the repository) listed `<agent dir>/sessions` recursively in an `After` that ran before the world's releases, and again in `AfterAll`, for the scenario "A new saved session starts with source startup" run alone. The output was `after sessions=["--tmp-pi-cm-features-0U6M7S-project--"]` and then `afterAll sessions=[]`.
- `piArguments` with no `session` option still returns `--no-session`, so the e2e suite, the json driver, the terminal driver, and every other scenario start as before. Green runs: the json driver scenario "A command in pi's json mode runs SessionStart with source startup and SessionEnd with reason other" (session-end.feature), and the terminal driver scenarios "Reloading pi in the terminal runs no session hook" and "Quitting pi in the terminal runs SessionEnd with reason prompt_input_exit" (session.feature). All three ran in every feature run below.
- `{session file}`: in the hooks runs step, a `transcript_path` whose folder is `sessionsFolder(tokens)` and whose name is `<file timestamp>_<the run's own session_id>.jsonl` reads `{session file}`. Any other value stays as written. The projection runs before the generic cell, so the session id inside the path is not replaced by its ordinal first.
- The open and fork restarts read the newest `.jsonl` of the sessions folder before the stop (`latestSessionFile`), which is the session the stopped Pi was in.

## The text of the new steps

- `Given pi runs with the scripted model and saves its session`
- `Given the user has started pi again and forked the last session` (setup, no turn; asserts the new session file is the newest and its header's `parentSession` is the forked file)
- `When the user starts pi again in a new session with the hooks recording`
- `When the user starts pi again and continues the last session with the hooks recording`
- `When the user starts pi again and opens the file of the last session with the hooks recording`
- `When the user starts pi again and forks the last session with the hooks recording`

The four restart `When` steps and the existing `the user starts pi again with the hooks recording` share `recordRestart(world, restart)`.

## Scenarios (features/hook/session.feature)

- "A new saved session starts with source startup" (task 06-03-01)
- "A continued session starts with source resume": matchers `resume` and `startup`; only `on-resume` runs, with `source` `resume` and `transcript path` `{session file}`
- "A session opened from its file starts with source resume"
- "A forked session starts with source fork": matchers `fork` and `resume`; only `on-fork` runs, with `source` `fork`
- "A continued fork starts with source resume"
- "Continuing with no saved session starts with source startup" (added, because the Result shows `--continue` with no saved session starts a new one, launch 7)

## Verification runs

Task 06-03-01, on the unchanged production tree (`git diff --quiet HEAD -- extensions` exit 0):
- `npm run test:cucumber:profile -- --profile adapter features/hook/session.feature features/hook/session-end.feature`: exit 0, 37 scenarios (37 passed), 446 steps (446 passed).
- `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/architecture/hermetic-git-environment.test.ts`: 7 tests, 7 pass.
- `npm run check:features`: exit 0.

Task 06-03-02 red, on the unchanged production tree. The final harness was run against `git checkout -- <the two production files>`, and the files were then restored from a scratch copy, which `cmp` checked:
- `npx cucumber-js --profile adapter --format progress --name "continued session|opened from its file|forked session|continued fork|Continuing with no saved session|new saved session" features/hook/session.feature`: exit 1, 6 scenarios (2 passed, 4 failed). "A continued session ..." and "A session opened from its file ..." recorded `on-startup` with `source` `startup`. "A forked session ..." and "A continued fork ..." recorded no runs, because the source was `startup` and neither the `fork` nor the `resume` matcher selected it. The two passing scenarios were the two `startup` ones.

Task 06-03-02 green:
- `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/bridges/hooks/payloads/session-start.test.ts test/bridges/hooks/event-router.test.ts test/architecture/hooks-lifecycle.test.ts`: 258 tests, 258 pass, 0 fail, 0 cancelled.
- `npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/hooks/payloads/session-start.ts extensions/pi-claude-marketplace/bridges/hooks/event-router.ts`: exit 0 (100% direct coverage).
- `npm run test:cucumber:profile -- --profile adapter features/hook/session.feature features/hook/session-end.feature`: exit 0, 42 scenarios (42 passed), 510 steps (510 passed). This run came after the final step-module refactor. The session-end.feature scenarios pass with their expectations unedited, and the task 06-03-01 scenario still records `startup`.
- `npm run check:features`: exit 0. `npm run --silent fallow`: exit 0. `npx fallow dupes --fail-on-issues`: exit 0.
- Callers outside the file list, which `restartPi` changes: `npx cucumber-js --profile adapter features/mcp-server/agent-grants.feature:491 :523 :596 features/mcp-server/implementation-profiles.feature`: 5 scenarios (5 passed). `hermetic-git-environment.test.ts` (imports `_rpc.ts`) passes again after task 2.

Acceptance greps: `PiSessionLaunch` in `_rpc.ts`: 3 or more. `Scenario` in session.feature: 21. `{session file}`: 6. `SessionLaunchFacts` in session-start.ts: 3. `SessionLaunchFacts|processStartedAt` in event-router.ts: 9. `starts with source resume`: 3.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] A continued, opened, or forked restart reported the old session's payloads as new results**
- Found during: task 06-03-02, first green run.
- Issue: `restartPi` returns `readSession(pi)`, which reads every custom entry of the session. A continued, opened, or forked session holds the `marketplace add` and `install` payloads that the stopped Pi wrote, so the world's After hook failed with "no step compared these rows of the last results: cascade marketplaces, cascade marketplaces".
- Fix: For `continue-session`, `open-session`, and `fork-session`, `restartPi` reads the payloads of the stopped Pi's session when Pi has saved that session's file (`savedPayloads`). After the start, it asserts that the new report begins with those payloads, and it returns only the payloads that follow them. An unsaved session leaves nothing behind, so "Continuing with no saved session" keeps every payload.
- Files: features/support/world.ts. Commit: `4a92c7b2`.

**2. [Rule 3 - Blocking] fallow clone group in session.steps.ts**
- Found during: the first commit attempt of task 06-03-02 (the hook's `fallow` step failed: one clone group of 6 lines, session.steps.ts:263-268 and :370-374).
- Fix: Extracted `currentSessionFile(world)`, the `get_state` read that two `Given` steps shared. No commit was made by the failed attempt, and the retry passed.
- Commit: `4a92c7b2`.

**3. [Rule 3 - Blocking] `profileGitEnvironment` parameter type**
- `ProfileLaunch` now omits `PiProfile.session` and holds the wider `PiSessionLaunch`, so `profileGitEnvironment` takes `Pick<PiProfile, "withoutGitHubBaseOverride">` instead of `PiProfile`. This changes no behavior. Commit `c7c5bf81`.

**4. [Scope] Added "Continuing with no saved session starts with source startup"**: the plan adds this scenario when the Result shows that a session with no prompt leaves nothing to continue. The Result's launch 7 shows that, and Pi writes no file without a prompt and a reply.

The production code follows the rule that the plan predicted. The spike contradicted no finding.

## Stale statements in files this plan does not own (for plan 06-13)

- docs/hooks-compatibility.md:124, the row `| launch with `--continue`, `--resume`, `--fork` | -- | `startup` | Pi reports `startup` for these launches. Upstream sends `resume` or `fork`. Not changed (D-CF5-06, project decision: the test harness cannot launch Pi this way) |`. After this plan, `--continue` and `--session` read `resume`, `--fork` reads `fork`, and a continued fork reads `resume`.
- docs/prd/parity-gaps-prd.md:502 (HOOK-11 "It reports `startup` (D-CF5-06)") describes the state before the change. It is a PRD and may be historical by design.
- domain/components/hook-events.ts:261-268 (the `SessionStartSource` comment) still holds: the one mapping site returns `SessionStartSource`. Not stale.

## Flagged assumptions (carried from the plan)

- PG-HOOK-11, unclassified edge (unresolved): the edges covered by decision are a new session with its two setting entries; a session with one message; an opened file; a fork made now; a fork continued later; a header with no `parentSession`; a `timestamp` that does not parse; a read that throws; a repeated `session_start`; an in-session `new`, `resume`, and `fork`; a reload (existing case); and a child. The verifier keeps this flag if it finds an uncovered edge.
- The rule was built from the spike. F7 and F8 held, so the first and third cases of the action apply.
- D-PG6-15's fallback (`--fork` keeps `startup`) was not needed, because the fork test held in the spike.
- `--resume` has no scenario. It opens a picker, and `--session <file>` reaches the same code path in Pi and stands for it (D-PG6-16).
- A `--session <id of another project>` launch forks after a confirm prompt. It follows the fork rule, and no scenario drives the prompt.
- A continued session that holds no message reads `startup` ("entries" in D-PG6-14 means messages).
- The clocks: the fork test compares the header's wall-clock ms with `performance.timeOrigin`. A clock that steps back between the launch and the fork would break it, and no case is built for that.
- Platform: the scenarios run on Linux, in RPC mode.

## Records for the orchestrator (parent-owned lines, not applied)

- PROJECT.md Key Decisions: "D-PG6-14 (pending maintainer review): a launch whose Pi reason is `startup` and whose session holds a `message` entry sends SessionStart `source` `resume`; read from `ctx.sessionManager.getEntries()` only. Spike S7 on Pi 1.5.0 and 1.5.2." and "D-PG6-15 (pending maintainer review): a launch whose header names `parentSession` and whose header `timestamp` is not older than `performance.timeOrigin` sends `fork`; the fork test runs before the resume test, and a continued fork reads `resume`. Spike S7 on Pi 1.5.0 and 1.5.2." On the D-CF5-06 row: "Amended by D-PG6-14 (parity-gaps, Phase 6)."
- BACKLOG.md: close HOOKLAUNCH-01 once the phase verifies (D-PG6-17).
- `.agents/skills/cucumber/rules/features.md`, section "Run tokens", new bullet: "In the hooks runs step, a `transcript_path` that names the saved session file of the run's own session, `<agent dir>/sessions/--<project dir>--/<timestamp>_<session id>.jsonl`, reads as `{session file}` (D-PG6-12, D-PG6-16). Any other value stays as written. A command never expands it."
- `.agents/skills/cucumber/rules/world-and-stand-ins.md`, section "The profile Pi and project trust", new bullet: "The profile option `session: \"saved\"` starts the profile Pi without `--no-session`, so Pi saves its session in `<agent dir>/sessions/--<project dir>--/`, and the scenario's release removes that folder (D-PG6-16). `restartPi` takes the restart kinds `new-session` (a new saved session), `continue-session` (`--continue`), `open-session` (`--session <file>`), and `fork-session` (`--fork <file>`). The last two read the newest session file of that folder before the stop. After a continue, an open, or a fork, the report keeps only the payloads that follow the ones the stopped Pi's saved session held. The steps are `pi runs with the scripted model and saves its session`, `the user has started pi again and forked the last session`, and the four `the user starts pi again ... with the hooks recording` steps (`hook/session.steps.ts`)."
- `.agents/skills/cucumber/rules/layout.md`: add `features/lib/saved-sessions.ts` to the Hooks row of the libraries table (next to `features/lib/hook-files.ts`, `features/lib/hook-run-tokens.ts`). In the hooks paragraph, add: "`session.steps.ts` also holds the saved-session `Given` (`pi runs with the scripted model and saves its session`), the fork setup `Given` (`the user has started pi again and forked the last session`), and the restart `When` steps for a new, a continued, an opened, and a forked session."

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-06-06: the detection reads `ctx.sessionManager` only, with no file, `process.argv`, or environment read, inside the handler's `try`. T-06-07: the owner cases and the scenarios cover `startup`, `resume`, and `fork`. T-06-08: session files lie under the sandbox agent directory, and the release removes them, as checked above. T-06-SC: no package installs.

## Self-Check: PASSED

- features/lib/saved-sessions.ts: FOUND
- c7c5bf81: FOUND (ancestor of HEAD)
- 4a92c7b2: FOUND (ancestor of HEAD)

## Amendment (orchestrator, 2026-11-14)

The "a read that throws writes one debug line and dispatches nothing" behavior above was a regression: it dropped every SessionStart dispatch when the session manager lacked `getHeader`/`getEntries` (two integration files failed 5 of 7). Commit 0d07e530 changes it: a throwing launch read writes `[hooks] session_start launch read failed, source stays startup: <message>` and SessionStart still dispatches with source `startup` (NFR-2; Claude Code always runs SessionStart).

---
phase: 06-hooks-and-auth
fixed_at: 2026-11-22T14:02:44Z
review_path: .planning/phases/06-hooks-and-auth/06-REVIEW.md
iteration: 2
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

The frontmatter describes iteration 2. Iteration 1 (4 of 4 fixed) follows
first, unchanged; the iteration 2 report is at the end.

# Phase 6: Code Review Fix Report

**Fixed at:** 2026-11-22T13:07:30Z
**Source review:** .planning/phases/06-hooks-and-auth/06-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 4 (WR-01 to WR-04; IN-01 stays open)
- Fixed: 4
- Skipped: 0

Every fix ran in the main checkout on `claude/stoic-shannon-la9q7o` (the
orchestrator's binding note), not in an isolated worktree, so every number
below can be reproduced from this tree. Each break ran through a copy of the
plan's `break.sh` (`--parallel 1`, the `phase06-heavy.lock`), and its EXIT
trap restored `extensions/`; `git status --porcelain -- extensions/` printed
nothing after each break and at the end.

## Fixed Issues

### WR-01: An ESRCH from `/proc/<pid>/environ` now skips the group kill when the leader is a zombie whose group still runs

**Files modified:** `features/lib/hook-files.ts`
**Commit:** 355388b
**Applied fix:** When the leader's environ read fails with ESRCH (an unreaped
zombie) or ENOENT (a reaped leader), `isRegisteredHookProcess` now calls
`groupHoldsMarker`. It lists `/proc`, reads each process's group from
`/proc/<pid>/stat` (the fields after the last `)`), and reads the environ of
each other member of group `entry.pid`. The group is killed when a member
carries `PI_CLAUDE_MARKETPLACE_REWAKE_DISPATCH=<dispatchId>`. A member that has
exited, or whose environ cannot be read, does not count. Any other read error
still throws. The ENOENT arm goes beyond the review's ESRCH case on purpose.
On a host that reaps (CI, where Pi reaps its hook leader), a leader that
exited fails the read with ENOENT, and its marked children still run. That is
the same hole the review describes.

**Proof (scratch reproductions, each run alone):**
- `fix-06/zombie-group-repro.ts`: a leader in its own group and session exits
  unreaped (state `Z`) and leaves a marked `sleep 30` in its group. Before the
  fix: `child still running: FAIL {"state":"S",...}`, exit 1. After:
  `child killed: ok`, exit 0.
- `fix-06/reaped-group-repro.ts`: the same, with the leader reaped (ENOENT).
  Before: `child still running: FAIL S`. After: `child killed: ok`.
- The research's `plan-06/inputs/repro/zombie-repro.ts` (the original race)
  still prints `stopHookScripts: ok`. Its zombie leads no group, so the scan
  finds no member and nothing is killed.

### WR-02: A line that is half-written at a baseline or final read now lands in the wrong window, or in none

**Files modified:** `features/lib/turn-records.ts`
**Commit:** 66a3bbc
**Applied fix:** `logText` returns the complete lines plus a `partial` flag.
`readLogLengths` counts the unfinished trailing line
(`complete.length + (partial ? 1 : 0)`), so a write that began before the
baseline is not charged to the turn. `readLogLinesSince` parses only the
complete lines, so a polling read leaves the partial line for its next read.
`assertStandInsStopped` now also asserts, after the stand-in wait, that no
`*.jsonl` log ends without a newline ("these stand-in logs end in a line whose
write never finished").
**Proof:** `fix-06/baseline-partial-repro.ts`. Before the fix: `baseline: FAIL`
(the line written across the baseline was reported as gained), and
`unfinished line at stop: FAIL (passed silently)`. After the fix: both `ok`.
The research's `partial-line-repro.ts` still prints
`readLogLinesSince: ok [["hook-runs.jsonl",[{"a":1}]]]`.

### WR-03: The HOOK-E2E-04 scenario never proves that SessionStart context was waiting before `/reload`

**Files modified:** `features/hook/additional-context.feature`, `features/step_definitions/hook/session.steps.ts`, `features/step_definitions/session.steps.ts`, `features/support/world.ts`
**Commit:** 6619dd8
**Applied fix:** The scenario (`additional-context.feature:230`) now runs
`When the user starts pi in the terminal with the scripted model and the hooks recording`.
This new step (`hook/session.steps.ts`) starts the scripted terminal Pi
through `recordTerminalAction` and waits in `waitForStartupRun`. Next,
`Then the hooks record these runs:` states the whole startup `SessionStart`
run of `primer` (source `startup`, all columns). Then
`When the user reloads pi in the terminal and then prompts "hello there"`
reloads that same terminal Pi. The generic reload step now reuses a terminal
Pi that the scenario already started
(`this.startedTuiSession() ?? await this.startTuiSession("scripted")`, a new
`ScenarioWorld.startedTuiSession()` accessor). The three other scenarios that
use it start no terminal Pi before it, so they behave as before.
**Red proof (break H4, `plan-06/inputs/brk/H4.json`: a `globalThis` buffer
and no registration drain in `bridges/hooks/runtime.ts`), adapter, the
scenario alone, three runs:**
- `WR03-H4-1`, `WR03-H4-2`, `WR03-H4-3`: each `1 scenario (1 failed)`,
  `exit=1`, `restored=clean`, with
  `1) Reloading pi before the first prompt drops the session start hook's additional context, as docs/hooks-compatibility.md describes # features/hook/additional-context.feature:230`.
  Each run failed at `Then the model receives these calls:`, where call 1 also
  held `SessionStart hook additional context: ss-ctx`.
- Unbroken, the scenario passes (`14 steps (14 passed)`).

A small window remains. The recorder logs the run before the hook script
prints its output, so the buffer write can still trail the logged run by
milliseconds. Under H4 that does not matter, because the global buffer
catches a write that lands after the reload too.

### WR-04: The AUTH-09 check on sign-in output is gone from the Device Flow and rejected-credential paths

**Files modified:** `features/step_definitions/command.steps.ts`, `features/marketplace/device-flow.feature`, `test/integration/auth-e2e.test.ts`
**Commit:** 74d1eef
**Applied fix:** A new step,
`Then no result of the command contains {string}`, in `command.steps.ts`
next to `the command result contains no absolute sandbox path`. It checks
`JSON.stringify(this.resultsOf("command"))`. The step is applied in three
scenarios: the AUTH-01 sign-in scenario (`:10`, `stand-in-access-token`), the
AUTH-07 rejected-credential scenario (`:257`, `expired-token`), and the
AUTH-07 sign-in-again scenario (`:289`, `expired-token` and
`stand-in-access-token`). The `auth-e2e.test.ts` header no longer claims that
the scenarios cover everything a user can see. It now says what they compare,
and that the AUTH-01 and AUTH-07 scenarios check every result field for the
tokens.

**Note on the premise:** `recordTable` does not drop unstated columns.
`namesLike` appends every field that a table leaves out, so a token in a
stated or an unstated envelope or row field already failed those tables. The
gap that remained is the fields `UNSTATED_FIELDS` removes before the
comparison: `origin` and `schemaVersion`. The red proof targets that gap. A
first try that added an extra `origin.leak` field was rejected by the
driver's closed wire schema check. That run is not counted.

**Red proof (break `fix-06/brk-WR04.json`):**
`platform/git-credential.ts` saves the password it fills or approves on
`globalThis`, and `shared/notification-json.ts` `wireOrigin` appends it to
`origin.invocationId`. Adapter, the three scenarios: `3 scenarios (3 failed)`,
`34 passed, 16 skipped, 3 failed`, `exit=1`, `restored=clean`. Every earlier
`Then` passed, and each scenario failed at the new step:
- `1) ... removes the credential (AUTH-07) # features/marketplace/device-flow.feature:257`:
  `Then no result of the command contains "expired-token"`
- `2) Adding a private GitHub marketplace signs in through Device Flow and clones it # features/marketplace/device-flow.feature:10`:
  `Then no result of the command contains "stand-in-access-token"`
- `3) After the GitHub host rejected the stored credential, the next add signs in through Device Flow again (AUTH-07) # features/marketplace/device-flow.feature:289`:
  `Then no result of the command contains "expired-token"`

Unbroken: `3 scenarios (3 passed)`, `53 steps (53 passed)`.

## Verification

All runs below are in the main checkout.

- `features/hook/` plus `features/marketplace/device-flow.feature`, adapter,
  after WR-01 and WR-02: `312 scenarios (312 passed)`, exit 0.
- `features/hook/` plus `features/marketplace/device-flow.feature`, adapter,
  after all four fixes: `312 scenarios (312 passed)`, `4364 steps (4364 passed)`, exit 0 (`final-hook-device-adapter.log`).
- Full adapter run (`npm run test:cucumber:profile -- --profile adapter`):
  `2267 scenarios (2267 passed)`, `28401 steps (28401 passed)`, exit 0, no flake (`final-full-adapter.log`).
- `npm run check:static`: all seven members passed (typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features), exit 0 (`final-check-static.log`).
- Each commit's pre-commit hook passed, including `npm run check:commit`, with
  no `--no-verify` and no `SKIP` set by this run.

Scratch files: `/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad/fix-06/`
(reproductions, `brk-WR04.json`, `break.sh`, and the logs `WR03-H4-{1,2,3}-adapter.log`,
`WR04-leak-adapter.log`, `hook-device-adapter.log`, `final-*.log`).

---

_Fixed: 2026-11-22T13:07:30Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_

---

# Phase 6: Code Review Fix Report (iteration 2)

**Fixed at:** 2026-11-22T14:02:44Z
**Source review:** .planning/phases/06-hooks-and-auth/06-REVIEW.md (iteration 2)
**Iteration:** 2

**Summary:**
- Findings in scope: 3 (WR-01, IN-02, IN-03, by the orchestrator's binding
  note; IN-01 and IN-04 stay open)
- Fixed: 3 (each `fixed: requires human verification`, because each changes
  timing or kill logic that a syntax check cannot judge)
- Skipped: 0

Every fix ran in the main checkout on `claude/stoic-shannon-la9q7o` (the
orchestrator's binding note), not in an isolated worktree, so every number
below can be reproduced from this tree.

## Fixed Issues

### WR-01: A log line in flight at the end of one turn lands in no turn, and the stop check cannot see it

**Status:** fixed: requires human verification
**Files modified:** `features/lib/turn-records.ts`
**Commit:** d6136f4
**Applied fix:** `readLogLinesSince` now reads each log through a new
`finishedLogLines`. When its first read of a log ends in an unfinished line,
it reads the log again every 10 ms until that line has finished, for at most
`PARTIAL_LINE_WAIT_MS` (1 s), and then returns the complete lines. If the
line is still unfinished at the deadline, the read fails with
`<file> ends in a line whose write never finished`. Both readers now agree:
a line whose write began before a read belongs to the window that the read
closes. The baseline (`readLogLengths`) is unchanged. The wait tracks only
the line that the first read saw unfinished, so a busy writer cannot keep it
waiting. Lines that finish during the wait come along, and the next baseline
counts them, so no line is counted twice. `assertStandInsStopped` keeps its
partial-line check as a last guard.

**Proof (scratch reproductions, each run alone; "before" is `git archive`
of `eda4a23`'s `features/lib`):**
- New `fix-06b/lost-line-concurrent-repro.ts`: the reviewer's case, with the
  writer running beside the reader, as a stand-in process does. The line is
  half written when turn N's final read starts, and it finishes 50 ms later,
  before turn N+1's baseline. Before:
  `turn N: [] turn N+1: [] FAIL (line in 0 turns)`, exit 1. After:
  `turn N: [["hook-runs.jsonl",[{"event":"Stop"}]]] turn N+1: [] ok (line in 1 turns)`,
  exit 0.
- The reviewer's `lost-line-repro.ts` is sequential: it finishes the line only
  after the final read has returned. Before: `turn N: [] turn N+1: [] stop check: passed`
  (silent loss). After: the final read fails with
  `.../hook-runs.jsonl ends in a line whose write never finished`. No design
  without state carried between reads can put a line into turn N when its
  write finishes only after turn N's read returned. Turn N+1's baseline then
  counts the finished line. So a loud failure is the outcome this repro can
  show, and the concurrent version above shows the line landing in exactly
  one turn.
- `fix-06/baseline-partial-repro.ts`: `baseline: ok [["hook-runs.jsonl",[{"during":1}]]]`
  and `unfinished line at stop: ok`, exit 0.
- **Deviation, for the orchestrator to judge:** the research
  `partial-line-repro.ts` (`plan-06/inputs/repro/`) never finishes its last
  line. It printed `readLogLinesSince: ok [["hook-runs.jsonl",[{"a":1}]]]`.
  It now prints
  `readLogLinesSince threw: .../hook-runs.jsonl ends in a line whose write never finished`
  after 1 s. The binding note requires a line that never finishes to fail
  loudly, and both designs it names make the closing read wait, so this output
  cannot stay `ok`. The race that the repro stood for (async.feature:538, a
  poll that reads while a hook still writes) still passes. The new
  `fix-06b/partial-line-finishes-repro.ts` finishes the line 50 ms into the
  read. Before: `readLogLinesSince: FAIL [["hook-runs.jsonl",[{"a":1}]]]`
  (the line was left out). After:
  `readLogLinesSince: ok [["hook-runs.jsonl",[{"a":1},{"b":"unfinished"}]]]`.
  Neither version raises the original `SyntaxError`.

### IN-02: The group scan treats every read error as "not marked", and a failed group kill after a scan falls back to a PID that is known not to be the hook

**Status:** fixed: requires human verification
**Files modified:** `features/lib/hook-files.ts`
**Commit:** 1c6e3ff
**Applied fix:**
- `processGroupOf` returns `undefined` only on `ENOENT` or `ESRCH` and
  rethrows any other error.
- In `groupHoldsMarker`, a `carriesMarker` rejection counts as "not marked"
  only for `ENOENT`, `ESRCH`, or `EACCES`. Any other error, such as `EMFILE`
  from the unbounded `/proc` scan, now fails the release.
- `isRegisteredHookProcess` became `registeredHookMatch`, which returns
  `"leader" | "group" | "none"` (non-Linux hosts keep the old answer,
  `"leader"`). `stopRegisteredHookProcess` sends `kill(-pid)` and falls back
  to `kill(pid)` only for `"leader"`. A group found through a member gets no
  single-PID fallback.
- The kill helper `killIfPresent` absorbs only `ESRCH`. Before, the code
  absorbed every kill error. Other kill errors now throw.

**Proof:** these races have no deterministic reproduction. They need an error
other than ENOENT, ESRCH, or EACCES from `/proc`, or a group that empties
between the scan and the kill. The earlier repros still pass at `HEAD`:
`fix-06/zombie-group-repro.ts` and `fix-06/reaped-group-repro.ts` print
`child killed: ok` (exit 0), and the research
`plan-06/inputs/repro/zombie-repro.ts` prints `stopHookScripts: ok`.

### IN-03: The new terminal start step waits for any startup run in the log, and its inner waits add up to its step timeout

**Status:** fixed: requires human verification
**Files modified:** `features/step_definitions/hook/session.steps.ts`, `features/support/world.ts`
**Commit:** 5dc92b2
**Applied fix:**
- `recordTerminalAction` passes the log lengths that its turn began at to its
  action.
- `readHookRuns`, `waitForRun`, and `waitForStartupRun` take those lengths and
  accept only runs that the log gained since then, as `waitForHookLifecycle`
  does.
- The scripted terminal start step (`the user starts pi in the terminal with the scripted model and the hooks recording`)
  waits for its own startup run. The terminal reload step waits for its
  prompt's run after its turn began.
- The non-scripted Given (`the user has started pi in the terminal with the hooks recording`)
  now reads a baseline before it starts the TUI, because it shares
  `waitForStartupRun`.
- The scripted start step's timeout is now `SCRIPTED_TERMINAL_START_TIMEOUT_MS`
  = `SCRIPTED_TUI_READY_MS` + `TERMINAL_STARTUP_RUN_TIMEOUT_MS` + 10 s
  (100 s), above the sum of its inner deadlines. `SCRIPTED_TUI_READY_MS` is
  now exported from `world.ts` for this.

**Proof:** no current scenario logs a startup run before the scripted start
(the review says so too), so no red case exists. The scenarios that use the
changed steps (`additional-context.feature:244`, `session.feature:404/422`,
`session-end.feature:125`, the `async.feature` reloads) pass in the runs
below.

## Verification

All runs below ran in the main checkout, with the three fixes in place.

- `features/hook/` plus `features/marketplace/device-flow.feature`, adapter:
  `312 scenarios (312 passed)`, `4364 steps (4364 passed)`, exit 0
  (`fix-06b/hook-device-adapter.log`).
- Full adapter run (`npm run test:cucumber:profile -- --profile adapter`):
  `2267 scenarios (2267 passed)`, `28401 steps (28401 passed)`, exit 0, no
  flake (`fix-06b/final-full-adapter.log`).
- `npm run check:static`: all seven members passed (typecheck, lint,
  lint:workflows, fallow, format:check, test:corresponding, check:features),
  exit 0 (`fix-06b/final-check-static.log`).
- The pre-commit hook passed on each commit, including `npm run check:commit`.
  No commit used `--no-verify`, and this run set no `SKIP` (only the session's
  own `SKIP=trufflehog`). The auto-mode classifier denied the skill's
  pre-run `SKIP=npm-check pre-commit run --files`, so this run used
  `npx prettier --check` and `npx eslint` on the changed files, and then the
  hook itself.

Scratch files: `/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad/fix-06b/`
(`lost-line-concurrent-repro.ts`, `partial-line-finishes-repro.ts`, the
`before/` tree, and the logs).

---

_Fixed: 2026-11-22T14:02:44Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 2_

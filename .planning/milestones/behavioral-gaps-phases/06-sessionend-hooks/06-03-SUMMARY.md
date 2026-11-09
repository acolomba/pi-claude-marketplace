---
phase: 06-sessionend-hooks
plan: 03
subsystem: testing
tags: [cucumber, hooks, session-end]

requires:
  - phase: 06-sessionend-hooks
    provides: "06-01 steps and feature file; 06-02 timeout cap"
provides:
  - "Failure scenarios: a SessionEnd hook that exits 1, exits 2, outlasts the budget, or declares a longer timeout does not keep the next session from starting or a json-mode Pi from exiting"
affects: [parent merge]

actuals:
  tasks: 2
  commits: 1

key-files:
  created: []
  modified:
    - features/hook/session-end.feature

key-decisions:
  - "D-BG-603 implemented; the exit-2 scenario keeps the setup new session (P6-DC-23)"

requirements-completed: [SEND-01]
---

# Plan 06-03 Summary: failure scenarios

Commit `b56e0967` (`test(hooks): cover session end hooks that fail or outlast the budget`) adds two Scenario Outlines and one Scenario; both tasks went into one commit.

## What was built

- Outline on a new RPC session (no setup session, P6-DC-09), three rows: exit 1 with stderr, sleep 30 with no timeout, timeout 60 with sleep 60. The runs show SessionEnd `first` `clear` and SessionStart `second` `clear`.
- Scenario: an exit-2 hook shows `SessionEnd:clear hook error: [${CLAUDE_PLUGIN_ROOT}/hooks/end.sh]: cleanup failed` and the next session starts.
- Outline on a one-shot json-mode Pi, four rows: exit 1, exit 2, sleep 30, timeout 60 with sleep 60. The json driver fails unless Pi exits 0 within 25 s; the run shows SessionEnd `first` `other`.

## Verification

- `npx cucumber-js --profile adapter --parallel 3 features/hook/session-end.feature`: exit 0, 14 scenarios passed, 2 m 17 s wall (load average about 76).
- `npm run check:features` exit 0; `npx fallow dupes --fail-on-issues --format human` exit 0; the commit hook passed.
- First run of the new scenarios (`--parallel 2`, load average about 115): 7 of 8 passed; the exit-2 scenario, then without a setup session, found no notice. A rerun of that scenario alone passed. The notice of the startup session's end reaches the RPC stream only after Pi's double bind settles, so the scenario now starts a setup session first, as the discuss-step probe did (P6-DC-23).

## Red proofs (each reverted; `git diff --quiet -- extensions` exited 0 before the commit)

- R4, the `timeout: 60` rows, with the cap bypassed on the blocking lane in `resolveTimeoutSeconds`: the RPC row failed with `function timed out, ensure the promise resolves within 30000 milliseconds`; the json row with `/claude:plugin list in json mode failed or did not exit within 25000 ms`. This is the behavioral proof of 06-02's cap.
- R5, the sleep-30 rows, with the SessionEnd default set to `undefined` (600 s): the same two failures.
- R6, the exit-1 rows, with the `close` handler of `spawnAndCollect` returning before it settles for a non-zero SessionEnd hook: the RPC row failed with the step timeout. The json rows passed under this edit, because a promise that never settles holds nothing in Node's event loop, so the json Pi still exits 0. R6b, a settle delayed by a referenced 60 s timer for a non-zero SessionEnd hook, failed the json exit-1 and exit-2 rows with the 25 s driver message (P6-DC-24).
- R7, the exit-2 scenario, with `blockNotices` returning no notice for SessionEnd: `the hooks show the user these messages:` failed with `+ []`, while the runs step passed.
- `find ~/.pi -newer <marker>` printed nothing over the whole phase.

## Parent lines

No unowned feature file changed. Lines for the parent to apply:

- `.planning/BACKLOG.md`, HKTO-01: close it in the form of the closed entries. Disposition: D-BG-604 (behavioral-gaps Phase 6, commit `c5c5643b`) caps a turn-blocking SessionEnd hook's declared `timeout` at the 1.5 s budget, because a plugin hook's `timeout` does not raise Claude Code's budget (hooks docs and the 2.1.319 budget function). The matching hooks of one event start together (D-CF5-09), so they share the 1.5 s. Still open (D-BG-605): no bounded wait like upstream's `boundMs`, so a hook that ignores SIGTERM holds the session for the 5 s SIGKILL grace and a grandchild that keeps stdout open holds it until it exits (HKDR-01); and `CLAUDE_CODE_SESSIONEND_HOOKS_TIMEOUT_MS` is not read (SESSIONENDENV-01 below).
- `.planning/BACKLOG.md`, HOOKERRNOTE-01: add "For SessionEnd, Claude Code 2.1.319 writes `SessionEnd hook [<command>] failed: <output>` to stderr for each failed hook with output after its bounded run. The bridge shows nothing for a non-blocking SessionEnd failure, and `features/hook/session-end.feature` states no notice for one (D-BG-603, P6-DC-04)."
- `.planning/BACKLOG.md`, new item `SESSIONENDENV-01: CLAUDE_CODE_SESSIONEND_HOOKS_TIMEOUT_MS is not read`: Claude Code reads the variable as the SessionEnd budget and as the timeout of each SessionEnd hook that declares none. Since D-BG-604 a plugin's SessionEnd hooks get at most 1.5 s, and the user cannot raise that (D-BG-605, P6-DC-02). A scenario needs a hook that runs longer than 1.5 s and a timed release, which the frozen fixtures do not offer.
- `.planning/BACKLOG.md`, a note on the RPC notice of a startup session's end: a SessionEnd hook-error notice from the startup session of an RPC Pi can miss the RPC stream while Pi's double bind settles (P6-DC-23); related to the Pi 1.5.0 RPC double `session_start` item in Carried Forward.
- `.planning/PROJECT.md`, Key Decisions, six rows in the D-BG-16 form, each `-- Pending`:
  - `| **D-BG-601 (behavioral-gaps, Phase 6, settled with the recommended answer, pending user review): the session ends that hook/session.feature lacks get scenarios**: a resume of a saved session through RPC switch_session (SessionEnd resume, SessionStart resume) and a command in a one-shot json-mode Pi (SessionStart startup, SessionEnd other). Print mode, terminal /new, /resume, /fork, /clone, RPC clone, and a signal quit are not driven (P6-DC-05, P6-DC-06, P6-DC-10). | Each Pi shutdown reason and the one mode-dependent mapping get a scenario; the rest share a driven path. | -- Pending |`
  - `| **D-BG-602 (...): one matcher scenario per reason Pi produces**: clear, resume, other, and prompt_input_exit, each with five SessionEnd hooks (clear, resume, logout, prompt_input_exit, other) of which exactly one runs; logout never runs. | A two-hook scenario lets a matcher that also fires on another reason pass. | -- Pending |`
  - `| **D-BG-603 (...): a failing SessionEnd hook never keeps the session from ending**: exit 1, sleeping past the budget, and a longer declared timeout on a new RPC session and on a json-mode exit; exit 2 also shows the D-CF5-24 hook error. No non-blocking notice is stated (HOOKERRNOTE-01; P6-DC-04, P6-DC-07, P6-DC-09, P6-DC-23). | SEND-01 criterion 3; the json driver proves that Pi exits on its own. | -- Pending |`
  - `| **D-BG-604 (...): a plugin SessionEnd hook's declared timeout is capped at the 1.5 s budget**: the blocking lane caps a longer declared value with a debug line; shorter values and asyncRewake keep theirs (P6-DC-01, P6-DC-08, P6-DC-11). | Claude Code: timeouts set on plugin-provided hooks do not raise the SessionEnd budget. | -- Pending |`
  - `| **D-BG-605 (...): deferred SessionEnd timeout parts**: CLAUDE_CODE_SESSIONEND_HOOKS_TIMEOUT_MS is not read, and there is no bounded wait (P6-DC-02, P6-DC-03). | A feature no Phase 6 scenario needs; the bounded wait lives in the shared blocking lane (HKDR-01). | -- Pending |`
  - `| **D-BG-606 (...): the session-end verb module holds three steps**: the saved-session Given, the resume When, and the json-mode When; the json turn keeps no results and no records (P6-DC-12, P6-DC-19). | Every other step comes from the frozen modules. | -- Pending |`
- `CHANGELOG.md`, under `[Unreleased]`: "- A plugin's SessionEnd hook now gets at most 1.5 seconds, as in Claude Code, even when it declares a longer `timeout`, so it no longer holds a new session, a resume, or a quit open."

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Dubious Choices

- P6-DC-23: the exit-2 scenario starts a setup new session, unlike the failure outlines.
- P6-DC-24: R6 for the json rows used a delayed settle, because a never-settling promise does not keep the json Pi alive.
- Both tasks in one commit; executed inline (P6-DC-21).

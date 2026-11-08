---
phase: 06-sessionend-hooks
plan: 02
subsystem: hooks
tags: [hooks, session-end, timeout]

requires:
  - phase: 01-foundation
    provides: "the frozen harness"
provides:
  - "A declared turn-blocking SessionEnd timeout above 1.5 s is capped at the 1.5 s budget, with a debug line (D-BG-604)"
  - "The docs timeout row states the cap and the unread override (D-BG-605)"
affects: [06-03]

actuals:
  tasks: 2
  commits: 2

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/bridges/hooks/timeout.ts
    - test/bridges/hooks/timeout.test.ts
    - docs/hooks-compatibility.md

key-decisions:
  - "D-BG-604: SESSION_END_BUDGET_SECONDS constant, a private capSessionEndTimeout, one call in the declared-value branch"

requirements-completed: []
---

# Plan 06-02 Summary: SessionEnd timeout cap

Commits:

- `c5c5643b` `fix(hooks): cap a session end hook's timeout at the 1.5 s budget` -- `timeout.ts` and its unit pair.
- `737151f3` `docs(hooks): state the session end timeout cap` -- one changed line of `docs/hooks-compatibility.md` (`--numstat` 1 1).

## What was built

- `SESSION_END_BUDGET_SECONDS = 1.5`, read by the SessionEnd row of the defaults table (row order unchanged).
- `capSessionEndTimeout(seconds, event, pluginId, lane)`: returns the value unless the lane is blocking, the event is SessionEnd, and the value is above the budget; then it writes `resolveTimeoutSeconds: timeout <n> on <plugin>/SessionEnd (blocking) exceeds the 1.5s SessionEnd budget; using the budget` and returns 1.5.
- The defaults-table JSDoc now states the rule and what D-BG-605 leaves open; the HKTO-01 citation is gone from the code.
- Docs: the SessionEnd clause of the `timeout` row now reads "a synchronous `SessionEnd` timeout is capped at 1.5 s, a budget no plugin hook can raise (D-BG-604); no variable raises it (D-BG-605)", the same 133 characters as before, so no other row moved.

## Verification

- RED: the new case "caps a longer declared blocking SessionEnd timeout..." failed with `actual: 60, expected: 1.5`; the boundary and background cases passed.
- GREEN: `node --test test/bridges/hooks/timeout.test.ts` exit 0 (17 tests); `npm run test:coverage:direct -- .../timeout.ts` exit 0 (100%); ESLint, Prettier, and `fallow dupes` exit 0; the commit hook passed.
- Regression: `features/hook/session.feature`, `messages.feature`, and `session-end.feature` at `--parallel 3` under a load average of about 85 on 28 cores: 19 passed, 6 failed (exit 1, 4 m 45 s). Three failures were 90 s profile-Pi start timeouts; three (`session.feature` fork and RPC stop, and the new resume scenario) lacked their SessionEnd run, because the hook recorder (a Node process) did not start within the 1.5 s SessionEnd default that the bridge already applied before this plan to hooks with no declared timeout. None of the failing scenarios declares a timeout, so the cap is not their cause. The same files passed in later runs (06-03's full-file run, 14/14) and in the wave gate (see 06-03-SUMMARY).

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Dubious Choices

- The regression run was red under load; it was not rerun separately, because the wave gate reruns every cucumber scenario on the combined tree (P6-DC-22).
- Executed inline by the child session (P6-DC-21).

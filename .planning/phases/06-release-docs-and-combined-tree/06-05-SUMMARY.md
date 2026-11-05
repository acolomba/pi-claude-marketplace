---
phase: 06-release-docs-and-combined-tree
plan: "05"
subsystem: testing
tags: [cucumber, harness, mcp, builtin-mcp, stand-ins]

requires:
  - phase: 02-built-in-materialization
    provides: "the new-session lifecycle scenario (BLT-01), parked @adapter-only by P2-DC-77 (WINDOWS 112)"
provides:
  - "assertStandInsStopped waits up to 10 s (50 ms poll) for stand-ins to exit after Pi stops, then fails with the same message and list"
  - "\"A new session offers the plugin's tool again (BLT-01)\" runs @mcp, under both MCP implementations"
affects: [06-10 records plan (WINDOWS 112 closes), wave gate npm run check (both cucumber profiles)]

actuals:
  tokens: 1006       # chars/4 over the realized diff (4022 chars, 37f1cfd..230b60d)
  tasks: 2
  commits: 1         # measured: git rev-list --count 37f1cfd..HEAD before the SUMMARY commit
plan_head_before: 37f1cfdb09cf4cd77d4b1a8f6ff7de6358b8480f
plan_head_after: 230b60d

tech-stack:
  added: []
  patterns:
    - "Bounded poll in the stand-in check: read the pid files once, poll the listed pids every 50 ms up to a named 10 s constant, then assert"

key-files:
  created: []
  modified:
    - features/lib/turn-records.ts
    - features/mcp-server/lifecycle.feature

key-decisions:
  - "Branch (a) of Task 2: all four required runs passed, so the scenario keeps @mcp, D-P6-11's fallback is not needed, and WINDOWS 112 can close"
  - "The poll lives in turn-records.ts with node:timers/promises; it imports nothing from mcp-implementation.ts, so no cycle forms"

patterns-established:
  - "A harness check of child-process exit waits a bounded time before it fails, as the shared Pi's reset already did (STUB_EXIT_TIMEOUT_MS)"

requirements-completed: [BLT-01]

coverage:
  - id: D1
    description: "The stand-in check waits up to 10 s for stand-ins to exit after Pi stops and still fails, with the same message, on a stand-in alive after the bound"
    requirement: BLT-01
    verification:
      - kind: e2e
        ref: "npm run test:cucumber:profile -- --profile builtin --name \"A new session offers the plugin's tool again\" features/mcp-server/lifecycle.feature (red on the old harness, seed 165236; green x3 on the new one)"
        status: pass
      - kind: other
        ref: "npm run check:static"
        status: pass
    human_judgment: false
  - id: D2
    description: "BLT-01's every-new-session truth runs under Pi's built-in MCP and under pi-mcp-adapter (@mcp)"
    requirement: BLT-01
    verification:
      - kind: e2e
        ref: "npm run test:cucumber:profile -- --profile adapter --name \"A new session offers the plugin's tool again\" features/mcp-server/lifecycle.feature (seed 308176)"
        status: pass
      - kind: e2e
        ref: "npm run test:cucumber:profile -- --profile builtin features/mcp-server/lifecycle.feature (8/8, seed 68592) and --profile adapter (9/9, seed 911102)"
        status: pass
      - kind: other
        ref: "npm run check:features"
        status: pass
    human_judgment: false

duration: 43min
completed: 2026-11-05
status: complete
---

# Phase 6 Plan 05: Bounded stand-in wait and the @mcp new-session scenario Summary

**`assertStandInsStopped` now polls the stand-in pids every 50 ms for up to 10 s before it fails, so the built-in MCP stub that Pi 1.5.0's double `session_start` leaks (it exits when its stdin closes, just after Pi) no longer fails the check, and "A new session offers the plugin's tool again (BLT-01)" runs `@mcp` under both profiles.**

This plan ran in two executors. The first was killed by a container restart before its first commit. Its uncommitted Task 1 edits were saved as a patch, and this executor applied them, checked them against the plan, reran the checks on the final content, and committed them. Both executors' runs are listed below, each with its load.

## Performance

- **Duration:** about 43 min in total (first executor from 2026-11-05T00:00:16Z to the restart about 00:11Z; this executor from about 00:25Z to 00:43Z)
- **Started:** 2026-11-05T00:00:16Z
- **Completed:** 2026-11-05T00:43Z
- **Tasks:** 2 (Task 1 committed; Task 2 took branch (a), which changes no file)
- **Files modified:** 2

## Accomplishments

- The stand-in check (`features/lib/turn-records.ts`) waits a bounded time. It reads the `*.pid` files once, then polls every 50 ms, up to `STAND_IN_EXIT_TIMEOUT_MS = 10_000`, until no listed pid runs. After that it asserts as before, with the same message (`these stand-in processes outlived the profile Pi`) and the same list of files and pids. So a real leak still fails the scenario (HAR-05, T-06-10).
- The new-session scenario (BLT-01) moved from `@adapter-only` to `@mcp`, and the comment that explained the old tag is gone. It passed three builtin runs in a row and one adapter run, and the whole `lifecycle.feature` passed under both profiles.
- D-P6-11 is applied on its main branch. The fallback (keep `@adapter-only` and draft an upstream report) was not needed.

## Task Commits

1. **Task 1: the bounded stand-in wait and the `@mcp` tag** - `230b60d` (test)
2. **Task 2: settle the tag on the measured outcome** - no commit. Branch (a): all four runs passed, so the feature file needed no further change. Its verify (`check:features`, tag grep) passed on `230b60d`.

**Plan metadata:** the SUMMARY commit that follows `230b60d`.

## Files Created/Modified

- `features/lib/turn-records.ts` - adds `STAND_IN_EXIT_TIMEOUT_MS` (10 000) and `STAND_IN_EXIT_POLL_MS` (50), a private `stillRunning` filter, and the poll loop in `assertStandInsStopped`; updates the file and function doc comments (P2-DC-77, HAR-05).
- `features/mcp-server/lifecycle.feature` - the scenario at line 392 is tagged `@mcp`; the four-line comment above the old `@adapter-only` is deleted.

## Owned parent lines

| Parent line | Outcome | Commit |
|---|---|---|
| 02-06 SUMMARY line 1 / 02-08 item 16 (stand-in wait, `@mcp` lift, WINDOWS entry) | Done: the bounded poll in `assertStandInsStopped`; the scenario lifted to `@mcp`; WINDOWS 112 can close (applied by plan 06-10, see Window records). The other option, avoiding the double bind in `startSession`, was not needed. | `230b60d` |
| 02-06 SUMMARY line 2 / 02-08 item 17 (upstream Pi report) | Not drafted, and nothing goes to BACKLOG: D-P6-11 makes the report conditional on the lift failing, and the lift passed. The Pi defect itself still exists; see P6-DC-0503. | none |
| Parent note P2-DC-77 | Resolved for the harness: the leaked stub exits after Pi stops, within the bound, in every measured run. | `230b60d` |

## Red proofs

All runs use `npm run test:cucumber:profile -- --profile <profile> --name "A new session offers the plugin's tool again" features/mcp-server/lifecycle.feature`, with the plan's environment prefix. Load is the 1-minute load average on 4 CPUs, with other executors running in parallel.

| # | Executor | Harness | Profile | Result | Seed | Load (1 min) |
|---|---|---|---|---|---|---|
| R1 | first | old (at `37f1cfd`), scenario `@mcp` | builtin | FAIL: `After` hook, `AggregateError: scenario releases failed` (12/13 steps passed) | 424622 | heavy (first executor's logs do not record numbers) |
| R2 | first | old, plus a temporary debug print of the release errors in `world.ts` (not committed) | builtin | FAIL: `AssertionError: these stand-in processes outlived the profile Pi`, live `mcp-stub-25803.pid` (pid 25803), from `assertStandInsStopped` via the profile Pi's release | 396702 | heavy |
| R3 | this | old (`turn-records.ts` from `37f1cfd`), scenario `@mcp` | builtin | FAIL: `After` hook (`world.ts:934`), `AggregateError: scenario releases failed` from `release` (`world.ts:831`), 12/13 steps passed | 165236 | 6.6 before, 9.5 after |
| G1 | first | new (the draft that became `230b60d`) | builtin | PASS 1/1, 13/13 | 836866 | heavy |
| G2 | first | new | builtin | PASS | 816518 | heavy |
| G3 | first | new | builtin | PASS | 444823 | heavy |
| G4 | first | new | adapter | PASS | 362788 | heavy |
| G5 | this | new (final content, committed as `230b60d`) | builtin | PASS 1/1, 13/13, 25 s | 567019 | 8.2 to 9.6 |
| G6 | this | new | builtin | PASS 1/1, 13/13, 23 s | 813619 | 9.7 to 8.5 |
| G7 | this | new | builtin | PASS 1/1, 13/13, 30 s | 166094 | 8.5 to 10.3 |
| G8 | this | new | adapter | PASS 1/1, 13/13, 35 s | 308176 | 9.6 to 9.3 |

Whole `features/mcp-server/lifecycle.feature`:

| Executor | Profile | Result | Seed | Load (1 min) |
|---|---|---|---|---|
| first | builtin | 8 scenarios, 109 steps passed | 453213 | heavy |
| first | adapter | 9 scenarios, 131 steps passed | 796880 | heavy |
| this | builtin | 8 scenarios, 109 steps passed, 37 s | 68592 | 8.2 to 12.1 |
| this | adapter | 9 scenarios, 131 steps passed, 50 s | 911102 | 11.4 to 13.9 |

The R3 log does not print the inner assertion, because `release` throws an `AggregateError` and cucumber prints only its message. R2 shows the inner error, and R3 fails at the same hook and the same step count. The known adapter flake (P3-DC-111, seed 115524) did not occur in either executor's adapter runs, so no rerun was needed.

## Decisions Made

- Branch (a) of Task 2: keep `@mcp`, no fallback, no drafted report, WINDOWS 112 can close.
- The draft from the first executor was kept unchanged after review. It matches every point of Task 1's action: it reads the pid files once, polls every 50 ms up to a named 10 000 ms constant, asserts with the same message and list, still treats a non-integer pid as running, imports `setTimeout` from `node:timers/promises`, and imports nothing from `mcp-implementation.ts`.

## Deviations from Plan

None - plan executed exactly as written. (The plan ran in two executors because of a container restart; that changed no step.)

## Issues Encountered

- The container restart killed the first executor before its first commit. Its patch applied cleanly with `git apply --3way`.
- The worktree's isolation guard refused compound shell commands that name git, and it refused writes to the per-worktree git directory. So the plan's commit ledger file (`gsd-plan-head-before-06-05`) was not written. `commits:` above is measured directly from the known base: `git rev-list --count 37f1cfd..HEAD` returned 1 before the SUMMARY commit.

## Checks

| Command | Exit | Duration | Sha | Notes |
|---|---|---|---|---|
| `npm run lint` (warm-up) | 0 | 245 s | 37f1cfd + draft | load 6.3 to 7.5 |
| `npm run check:static` | 0 | 60 s | 37f1cfd + draft (= `230b60d` content) | typecheck, lint, lint:workflows, fallow (cycle gate included), format:check, test:corresponding, check:features all passed; load 12.4 to 8.6 |
| commit hook `npm run check:commit` | 0 | n/a | `230b60d` | ran on the commit |
| `npm run check:features` | 0 | 5 s | `230b60d` | load 4.8 |
| tag grep (Task 2 verify) | 0 | n/a | `230b60d` | line above the scenario is `  @mcp` |
| `grep -c 'node:timers/promises' features/lib/turn-records.ts` | 0 | n/a | `230b60d` | 1 (baseline 0) |
| `grep -cE '^import .*mcp-implementation' features/lib/turn-records.ts` | 1 | n/a | `230b60d` | 0, as required |

## Window records

- 112: fixed

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 06-10 applies `112: fixed` to WINDOWS. No BACKLOG entry `RPCSESSION-01` is needed from this plan.
- The parent's wave gate (`npm run check`, both cucumber profiles) covers the merged tree.

## Dubious Choices

**P6-DC-0501: one wait for every stand-in, including a non-integer pid**
- **Chose:** the draft's loop polls every listed entry until the deadline. A pid file whose text is not an integer counts as running, as the plan says, so it holds the check for the full 10 s before the scenario fails.
- **Alternatives:** fail at once on a non-integer pid, because waiting cannot change it; or treat a malformed pid file as its own assertion.
- **Why:** the plan asks for the same assertion, message, and list as before, with a non-integer pid still counted as running. Failing it early would need a second branch and a different failure path. The only cost is 10 s on a scenario that already fails.
- **Severity:** Low

**P6-DC-0502: a 10 s bound inside the 30 s `After` step budget**
- **Chose:** 10 s, the shared Pi reset's `STUB_EXIT_TIMEOUT_MS` precedent, for both callers: `restartPi` (90 s step budget) and the profile Pi's release, which runs in the `After` hook under the 30 s default step timeout, after `pi.stop()`.
- **Alternatives:** a shorter bound, such as a few listing poll intervals, as the 02-06 parent line suggested; or a bound tied to each caller's budget.
- **Why:** the plan fixes the value at 10 s. A passing scenario costs no extra time, because the loop ends as soon as the pids are gone. On a loaded runner, `pi.stop()` plus a full 10 s wait plus the other releases could approach the 30 s hook limit. If that happens, the scenario fails with a timeout, not a false pass. The time the leaked stub actually takes to exit was not measured; every measured run passed within the bound.
- **Severity:** Low

**P6-DC-0503: no upstream report drafted, although the Pi defect remains**
- **Chose:** follow D-P6-11 and Task 2 branch (a): no `## Drafted upstream report` and no BACKLOG entry, because the lift passed.
- **Alternatives:** draft the report anyway. Pi 1.5.0's RPC `new_session` still runs `session_start` twice, and the built-in MCP still keeps the first connection's server process alive until Pi exits. A real user's server process could leak once per new session. The harness now tolerates the leak; it did not fix it.
- **Why:** D-P6-11 and the plan make the report conditional on the lift failing, and filing is the user's call. The parent line (02-08 item 17) and the 06-RESEARCH section 5.8 text still hold the facts a report needs, so the user can still draft one.
- **Severity:** Medium

## Self-Check: PASSED

- FOUND: features/lib/turn-records.ts (modified; contains `assertStandInsStopped` and `node:timers/promises`)
- FOUND: features/mcp-server/lifecycle.feature (scenario tagged `@mcp`)
- FOUND: commit `230b60d` is an ancestor of HEAD

---
*Phase: 06-release-docs-and-combined-tree*
*Completed: 2026-11-05*

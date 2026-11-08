---
phase: 15-marketplace-state-lock
plan: 01
subsystem: testing
tags: [cucumber, state-lock, proper-lockfile, marketplace, autoupdate]

requires:
  - phase: 01-foundation
    provides: the live and dead lock holders (`features/lib/state-lock-holder.ts`, `scope-state.steps.ts`) and the MLOCK-02 seed
provides:
  - MLOCK-01 Outline - a named autoupdate or noautoupdate under a held lock fails as lock held and changes nothing
  - 16 stale-lock twins - every live-holder marketplace scenario has a twin that completes as with no lock
affects: [state lock, marketplace autoupdate, marketplace add, marketplace remove, marketplace update]

actuals:
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Twin scenarios: a stale-lock scenario repeats its live-holder twin's Givens and swaps only the lock step, which is the last Given"

key-files:
  created:
    - .planning/phases/15-marketplace-state-lock/15-01-SUMMARY.md
  modified:
    - features/marketplace/state-lock.feature

key-decisions:
  - "No product change: the current product already meets MLOCK-01 and MLOCK-02 (D-BG-1511)"
  - "No verb step module: every step exists in the frozen shared modules (D-BG-1510)"

requirements-completed: [MLOCK-01, MLOCK-02]

duration: about 75 min
completed: 2026-11-08
---

# Phase 15 Plan 01: Marketplace state lock scenarios Summary

**A held state lock now provably blocks `marketplace autoupdate` and `noautoupdate` without changing anything, and a lock a dead process left provably blocks none of the five marketplace verbs. Each stale scenario is a twin of a live-holder scenario.**

## Performance

- **Tasks:** 3 of 3
- **Files modified:** 1 (`features/marketplace/state-lock.feature`), plus this SUMMARY
- **Commits:** `b80a2024` (Task 1), `714d15f8` (Task 2), and the SUMMARY commit

## Execution mode

The phase's child session ran this plan inline, with no `gsd-executor`
subagent. The agent isolation guard refused the executor dispatch. It reads the
dispatch-isolation sentinel of the parent checkout (the session's primary
directory), not the sentinel of this worktree, so forcing the sentinel from
the worktree could not reach it. The parent later directed every remaining step
inline.

## Scenarios

`features/marketplace/state-lock.feature` holds 32 scenarios: 16 live-holder and 16 stale-lock.

1. NEW `Scenario Outline: Changing autoupdate while another process holds the state lock of the scope fails as lock held and changes nothing` (4 rows: autoupdate and noautoupdate, project and user; MLOCK-01)
2. REWRITTEN seed, same title: `Scenario: Removing a marketplace while a process that died left the state lock of its scope removes it` (the project remove twin, with `demo` installed)
3. NEW `Scenario: Removing a marketplace from the user scope while a process that died left its state lock removes it`
4. NEW `Scenario: Updating a marketplace in the project scope while a process that died left its state lock reports it up to date`
5. NEW `Scenario: Updating a marketplace in the user scope while a process that died left its state lock reports it up to date`
6. NEW `Scenario Outline: Adding a marketplace while a process that died left the state lock of the scope adds it` (8 rows: dir, file, `@url`, `@github`, each in both scopes)
7. NEW `Scenario Outline: Changing autoupdate while a process that died left the state lock of the scope changes it` (4 rows)

The five existing live-holder scenarios stay as they were: `diff` of lines 7-160 against the Phase 1 version prints nothing. The feature description now names D-06 and Claude Code's write without the lock. None of these scenarios carries a tag except the `@url` and `@github` Examples blocks, so each one runs once, under the `adapter` profile.

## Red proofs

Both mutations ran in the worktree on unchanged scenarios. Each was reverted with `git checkout -- <file>` before any pre-commit run or commit, and `git diff --quiet HEAD -- extensions/pi-claude-marketplace` exited 0 afterwards.

**A (MLOCK-01):** `extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts`, `flipOneScope`. It runs the same body on `loadState(locations.extensionRoot)` instead of inside `withLockedStateTransaction`, with a value import of `loadState`.
- Command: `npx cucumber-js --profile adapter --parallel 3 --order defined --format progress features/marketplace/state-lock.feature`
- Result: exit 1, `17 scenarios (13 passed, 4 failed)`.
- The failures are the four MLOCK-01 rows, `state-lock.feature:186`, `:187`, `:188`, and `:189`. Each fails at `Then the result has these fields:`, where it got `severity` `info` but expects `error`.
- Revert: `git checkout -- extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts`. Afterwards `git status --short` listed only `features/marketplace/state-lock.feature`.
- A first attempt ran before the edit had applied (the Edit tool refused an unread file), so it passed unmutated. It is not counted.

**B (MLOCK-02):** `extensions/pi-claude-marketplace/transaction/with-state-guard.ts:216`, `stale: 10_000` changed to `stale: 3_600_000`.
- Command: the same quick command, now on the 32-scenario file.
- Result: exit 1, `32 scenarios (16 passed, 16 failed)`.
- The failures are exactly the 16 stale scenarios, each at `Then the result has these fields:`:
  - the seed (`:191`) and the user remove twin (`:212`);
  - the two update twins (`:233`, `:262`);
  - the 8 add rows (`:308`-`:311`, `:316`, `:317`, `:322`, `:323`);
  - the 4 flip rows (`:346`-`:349`).
- The 16 live-holder scenarios pass, so staleness is the only difference.
- Revert: `git checkout -- extensions/pi-claude-marketplace/transaction/with-state-guard.ts`. Afterwards `git status --short` listed only the feature file.

## Gate results

Wave gate, the parts of `npm run check` in order, on commit `714d15f873be5583834548503937d708824bd3ac`, Node v26.13.0. Each part ran in the background with its exit code in a file, and every part passed on its first run, so there were no reruns. Logs are in `/tmp/claude-1000/bg-phase-15/gate/`.

| Part | Exit | Wall time |
| --- | --- | --- |
| `npm run check:static` | 0 | 28 s |
| `npm run test:unpaired` | 0 | 18 s |
| `npm run test:integration` | 0 | 36 s |
| `npm run test:cucumber:profile -- --profile adapter --parallel 3` | 0 (1659 scenarios passed) | 972 s |
| `npm run test:cucumber:profile -- --profile builtin --parallel 3` | 0 (148 scenarios passed) | 242 s |
| `npm run test:coverage:direct:all` | 0 | 149 s |

Each task also ran the quick command (`17 scenarios (17 passed)`, then `32 scenarios (32 passed)`) and `npm run check:features` (exit 0). Both commit hooks ran `npm run check:commit` and passed.

## Hermetic home

`find /home/acolomba/.pi -newer <marker>` printed nothing. The marker was touched before Task 1, and the find ran after the gate. Nothing under the real `~/.pi` changed.

## Deviations from Plan

- **Inline execution.** See "Execution mode" above. The plan text itself was followed.
- **Count wording.** Cucumber prints the counts as `17 scenarios (13 passed, 4 failed)` and `32 scenarios (16 passed, 16 failed)`. The plan wrote them failed-first, and the numbers match.

## Parent Lines

- **BACKLOG:** an unnamed `marketplace autoupdate` or `noautoupdate` under a held lock reports the `(unknown)` aggregate subject, which unit tests pin. It could name the recorded marketplaces, as an unnamed `marketplace update` does. The flip without `--scope` that writes the project scope and then fails on a held user lock has no scenario (D-BG-1506).
- **PROJECT.md Key Decisions:** a row for D-BG-1501 and D-BG-1502. The scenarios pin D-06's lock held refusal (`retries: 0`) instead of Claude Code 2.1.319's write without the lock after 5 retries, and the 10-second stale window matches upstream's proper-lockfile default.
- **CHANGELOG (milestone aggregate):** behavioral tests now cover `marketplace autoupdate` and `noautoupdate` under a held state lock, and every marketplace verb past a lock that a dead process left.
- **Frozen files:** none. The seed kept its title, so the Seeds list in `.agents/skills/cucumber/rules/layout.md` stays right.
- **Process note for the parent:** the agent isolation guard reads `<session primary dir>/.gsd/dispatch-isolation-sentinel.json`, the parent checkout, so a child that forces its sentinel from its own worktree cannot unblock an executor dispatch.
- **Unowned feature files:** none changed.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

- T-15-01: both mutations reverted; the task commits `b80a2024` and `714d15f8` each list only `features/marketplace/state-lock.feature`.
- T-15-02: the hermetic-home `find` printed nothing.
- T-15-03: the MLOCK-01 Outline passes and fails under red proof A.
- T-15-04: the 16 stale twins pass and fail under red proof B.
- T-15-05: accepted, as planned.
- T-15-SC: no package added; `package.json` and `package-lock.json` unchanged.

## Dubious Choices

- **(Medium) Inline execution.** The plan ran in the orchestrator session, not in a `gsd-executor` subagent, because the isolation guard read the parent checkout's stale sentinel, which neither this worktree nor its forced sentinel could change. Using another agent type to get past the guard was rejected as gaming it.
- **(Low) Table alignment by script.** A small aligner in the scratch folder padded every table. It reproduced the existing tables byte for byte, so the live-holder scenarios are unchanged.
- **(Low) Gate logs first written to the session scratchpad.** The gate wrote its logs to the session-specific `scratchpad/p15/exec/gate/` before the parent's own-folder rule arrived. They were copied to `/tmp/claude-1000/bg-phase-15/gate/`. The commit message files of `fcc3dc40` through `714d15f8` were in `scratchpad/p15/`, and every title matches its content.
- The planner's choices (column names `autoupdate before` and `autoupdate after`, the dropped `scope root` column, the non-parallel twin titles, the long description lines, red proof A run once, one plan with three tasks) are in DUBIOUS-CHOICES.md as P15-DC-10 to P15-DC-12.

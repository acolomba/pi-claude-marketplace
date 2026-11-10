---
quick_id: 261109-cpn
phase: quick-261109-cpn
plan: 01
subsystem: hooks
tags: [hooks, async-rewake, stop, stop_hook_active, D-BG-210]
status: complete
requires: []
provides:
  - "run-start woken mark in HooksRuntime (recordRunStart), kept apart from the Stop re-entry flag"
  - "before_agent_start marks the run that Pi starts with the claude-hook-rewake custom message"
  - "exported REWAKE_CUSTOM_TYPE; the exit-2 path writes no Stop state"
affects: [hooks-bridge, async-rewake, stop-hooks]
tech-stack:
  added: []
  patterns: ["per-run mark set at before_agent_start and cleared at the next run start"]
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/bridges/hooks/runtime.ts
    - extensions/pi-claude-marketplace/bridges/hooks/event-router.ts
    - extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts
    - extensions/pi-claude-marketplace/bridges/hooks/settle.ts
    - test/bridges/hooks/runtime.test.ts
    - test/bridges/hooks/event-router.test.ts
    - test/bridges/hooks/async-rewake/registry.test.ts
    - features/hook/async.feature
    - docs/hooks-compatibility.md
decisions:
  - "D-BG-210: only the run that an async rewake starts gives its Stop hooks stop_hook_active: true (amends D-BG-203)"
metrics:
  completed: 2026-11-09
actuals:
  tasks: 2
  commits: 2
plan_head_before: 9a3982262f7adfaf58e3e2b20176e3bb77b7bd6c
plan_head_after: 58d91f659b58e6219fc799fd3aa64bc49e6d15ce
---

# Quick 261109-cpn: only the turn an async rewake wakes gets stop_hook_active

The hooks bridge now marks a run as woken at `before_agent_start` when Pi starts that run with the rewake's own custom message (`claude-hook-rewake`). Only that run's Stop hooks see `stop_hook_active: true`. A steered turn, the next run, and an exit 2 whose send throws all leave it false (D-BG-210, which amends D-BG-203; P2-DC-04, P2-DC-26).

## Commits

| Task | Commit | Title |
| ---- | ------ | ----- |
| 1 | `7bceecbb` | fix(hooks): give stop_hook_active only to the turn a rewake wakes |
| 2 | `58d91f65` | docs(hooks): record the woken-turn stop_hook_active rule |

## What changed

- `runtime.ts`: `recordRewake` is replaced by `recordRunStart(startedByRewake)`, which has its own `runStartedByRewake` flag. `isStopHookActive()` returns the Stop re-entry flag OR the woken mark. The run-start member never touches `stopHookActive`, `consecutiveBlockCount`, or `capNotifiedThisSession`. `prepareSettleForRegistration` clears the mark, and `recordUserInput` leaves it.
- `event-router.ts`: the `before_agent_start` closure now takes the event. Before the context drain it calls `runtime.recordRunStart(event.messageType === "custom" && event.message.customType === REWAKE_CUSTOM_TYPE)`. The drain and its return value are unchanged. No `pi.on` registration was added, so there are still 12. The STOP-07 `input` comment now says that the input reset clears the re-entry flag and that the woken mark ends at the next run start.
- `async-rewake/registry.ts`: `REWAKE_CUSTOM_TYPE` is now exported, with the same value. `wakeOnExitTwo` no longer writes Stop state. The `runtime` parameter that this left unused is removed from `wakeOnExitTwo`, from the `EXIT_HANDLERS` record type, from both lane entries, and from the dispatch call in `finalizeChild`. The summary still shows before the send, and both try/catch blocks are unchanged.
- `settle.ts`: comment change only (the `inputResetHandlerFor` doc).
- `features/hook/async.feature`: new scenario "An async rewake that reaches a running turn leaves stop hook active false for the Stop hooks of that turn", placed directly after the steer scenario. It uses existing steps only, so no step file changed.
- `docs/hooks-compatibility.md`: the `stop_hook_active` stdin row now states the woken-turn rule (D-BG-210). The `asyncRewake` row is unchanged: its Notes cell is 386 characters against a 389 limit, and its clause "a woken turn sets `stop_hook_active`" is still correct.

## Red proofs

### Cucumber scenario on the unchanged tree

Before any product edit, `npm run test:cucumber:profile -- --profile adapter features/hook/async.feature --name 'An async rewake that reaches a running turn leaves stop hook active false'` exited 1:

```
Failed scenarios:
  1) An async rewake that reaches a running turn leaves stop hook active false for the Stop hooks of that turn # features/hook/async.feature:384
       Then the hooks record these runs: # features/step_definitions/hook/runs.steps.ts:151
           AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
           + actual - expected
           ...
                 'Done.',
           +     'true',
           -     'false',
                 '{project dir}',
                 '',
                 'stop',
1 scenario (1 failed)
13 steps (12 passed, 1 failed)
```

As expected, the Stop row read `true`. After the change, the whole `async.feature` passes under the adapter profile (15 scenarios, 230 steps). That includes "An async rewake Stop hook that exits 2 wakes the model once", whose second Stop row still reads `true`.

### Registry send-failure case on the unchanged registry

I added `assert.strictEqual(runtime.isStopHookActive(), false)` to "contains a send failure after an exit-two body is ready" and ran it with `--test-name-pattern` before editing the registry:

```
✖ contains a send failure after an exit-two body is ready (61.774489ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:

  true !== false

      at TestContext.<anonymous> (.../test/bridges/hooks/async-rewake/registry.test.ts:2223:14)
```

### Properties that only unit cases prove

- A cucumber scenario cannot drive a failed send. `pi.sendMessage` throws only synchronously, on a stale or uninitialized runtime, and in that state `finalizeChild` returns before the send (the captured-generation and mode guards). The registry unit case is the proof.
- A run that starts after the woken run with no user input, and that is neither a rewake nor a Stop re-entry, needs another extension's custom message. No harness extension sends one. So the event-router case "registered handlers give stop_hook_active to the Stop hooks of the woken run only (D-BG-210)" proves it through the registered `before_agent_start`, `agent_end`, and `agent_settled` handlers with an executor spy, which records `[true, false]`.

## Upstream evidence

This is the plan's record. I did not grep the binary again during execution, and nothing in execution contradicted it. I did confirm the Pi type declaration.

- Binary: `/home/linuxbrew/.linuxbrew/Caskroom/claude-code@latest/2.1.319/claude` (`2.1.319 (Claude Code)`). The planner grepped it on 2026-11-09 with `LC_ALL=C /usr/bin/grep -oa` and a Python mmap byte search. The searches were `stopHookActive` (35 occurrences), `function LTn(`, `$i={...ds,`, and `type:"queued_command",prompt:Ce`.
- The rewake queues a task notification with `stopHookActive:!0`: `LTn({..., priority:"next", stopHookActive:!0, turnAttribution:"inherit"})`.
- A query that the queue starts takes the flag when any of its starting items carries it (`rn.some((xr)=>xr.stopHookActive)?!0:void 0`). The loop sets its guard once at start, `stopHookActive: e.stopHookActive ?? false`.
- The guard lasts across the query's tool calls, because the reset set `$i` has no `stopHookActive`. A Stop block sets it to true for its continuation.
- Every other query starts with `false`.
- A queued item that is drained into a running query becomes a `queued_command` attachment, which copies no `stopHookActive`. No fold path writes the running query's guard.
- Confidence: high for the woken query, and high that a running query's own Stop hooks do not get the flag. Medium on whether the drain happens at the next tool boundary or after the query ends. Neither answer changes the value that a running query's Stop hooks see.
- Pi 1.5.0 (`node_modules/@earendil-works/pi-coding-agent/package.json` reports `1.5.0`): `BeforeAgentStartCustomEvent` (`messageType: "custom"`, `message: CustomMessage`) is "A run started by `pi.sendMessage(..., { triggerTurn: true })` while idle" (`dist/core/extensions/types.d.ts`, confirmed during execution). `_startRun` is Pi's only run path, `before_agent_start` fires once per run, and `sendCustomMessage` steers into a running run without starting one.

## Verification

- Precondition: Pi 1.5.0 is installed (confirmed).
- Owner tests, with a hermetic home (`node --import <worktree>/test/platform/isolated-pi-home.ts --test` over runtime, event-router, registry, settle, `test/architecture/hooks-lifecycle.test.ts`, and `test/architecture/hooks-async-rewake.test.ts`): 336 passed, 0 failed. `hooks-lifecycle.test.ts` passes with no edit, so the 12 registrations are unchanged.
- `npm run test:coverage:direct -- runtime.ts event-router.ts async-rewake/registry.ts settle.ts`: exit 0.
- `npm run test:cucumber:profile -- --profile adapter features/hook/async.feature`: exit 0, 15 of 15 scenarios passed.
- `tsc --noEmit`: exit 0. ESLint on the touched files was clean after one `--fix` (a missing blank line in the new test) and a Prettier write.
- Acceptance greps: `grep -c 'stop hook active' features/hook/async.feature` prints 3 (it printed 1 at HEAD). `export const REWAKE_CUSTOM_TYPE` is at registry.ts:102. `REWAKE_CUSTOM_TYPE` is at event-router.ts:69 (the import) and :255 (the run-start check).
- The Task 1 commit hook ran `npm run check:commit`, which passed. The Task 2 commit stages only markdown, so the hook skipped `check:commit`. Both commits ran the pre-commit fixers first. No commit used `--no-verify`, `git add -A`, push, rebase, or amend.
- `npm run check` in the worktree at `58d91f65`, before return: exit 0. All static checks passed (typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features), then test:unpaired and test:integration, the pi-subagents integration tests included. Cucumber passed under the adapter profile (1780 scenarios) and the builtin profile (153 scenarios), and direct coverage merged 352 records. No rerun was needed.

## Deviations from Plan

- [Coordinator amendment] Task 2 did not edit `.planning/PROJECT.md` or `CHANGELOG.md`. Their text is under `## Parent lines`. The Task 2 commit has only `docs/hooks-compatibility.md`.
- The registry send-failure assertion went into the existing case "contains a send failure after an exit-two body is ready", not into a new case. Containing the failure includes leaving no Stop state, so the title still names the behavior.
- The worktree already had a real, gitignored `node_modules/` directory, so the `ln -s` from the setup instructions made a nested `node_modules/node_modules` symlink, and all runs used the worktree's own `node_modules`. I removed the nested symlink before returning. The ignored directory itself was there before this task, so I left it.
- I could not write this SUMMARY to the primary checkout's path, because the worktree sandbox refuses writes outside the worktree. It is in the session scratchpad, and the coordinator should copy it into place.

## Dubious Choices

- **(medium)** A turn that a steered rewake reaches now sees `stop_hook_active: false` where it saw `true`. This follows from "only the woken turn" and from Claude Code's per-query guard, but the user did not name this case.
- **(low)** User input that joins the woken run does not clear the woken mark, for parity with Claude Code's per-query guard. The Stop re-entry flag still clears on input.
- **(low)** Task 1 touched eight files, above the planner's five-file guide. Each product file is committed with its unit pair and the red scenario, so no commit leaves a test red (the P2-DC-15 precedent).
- **(low)** D-BG-210 takes the next free number of the Phase 2 block.
- **(info)** P2-DC-04 and P2-DC-26 in `.planning/DUBIOUS-CHOICES.md` are left for the batch closeout.
- **(info)** mdformat did not re-pad any table. It corrected only the padding of the edited `stop_hook_active` row, and the new Notes cell (239 characters) fits inside the table's 245-character column.

## Parent lines

### .planning/PROJECT.md

Insert directly after the D-BG-209 row:

```markdown
| **D-BG-210 (behavioral-gaps, quick task 261109-cpn, asked for by the user on 2026-11-09, amends D-BG-203, DUBIOUS-CHOICES P2-DC-04 and P2-DC-26): only the turn that an async rewake wakes gives its Stop hooks `stop_hook_active: true`**: When an `asyncRewake` hook exits 2 and Pi starts a run with the rewake message, the Stop hooks at that run's end see `stop_hook_active: true`, because Claude Code starts the woken query with its guard set and keeps it to the query's end. The bridge marks the run at its `before_agent_start` (a custom message of type `claude-hook-rewake`), and the next run start clears the mark. User input that joins the woken run leaves the mark. A rewake that Pi steers into a running turn marks no turn, because a notification drained into a running query leaves that query's guard. An exit 2 whose `pi.sendMessage` throws marks no turn, because no run starts. The mark does not count toward the STOP-07 cap, and the Stop re-entry flag still lasts until the user's next input. | Claude Code 2.1.319, binary grepped on 2026-11-09: the rewake queues its notification with `stopHookActive: true`; a query that the queue starts sets its guard once at start (`stopHookActive: e.stopHookActive ?? false`) and keeps it across its tool calls (the reset set has no `stopHookActive`); every other query starts with `false`; a notification drained into a running query becomes a `queued_command` attachment that carries no flag. Pi 1.5.0 emits `before_agent_start` with `messageType: "custom"` and the starting message for a run that `pi.sendMessage(..., { triggerTurn: true })` starts while idle. See `quick/261109-cpn-async-rewake-stop-hook-active-is-true-only-for-the-woken-tur/`. | ✓ Good |
```

In the D-BG-203 row, change the parenthetical

`(behavioral-gaps, Phase 2, settled with the recommended answer, the user asked for a change on 2026-11-09, see DUBIOUS-CHOICES.md)`

to

`(behavioral-gaps, Phase 2, settled with the recommended answer, the user asked for a change on 2026-11-09, see DUBIOUS-CHOICES.md, amended by D-BG-210)`

and change its outcome cell from `-- Revisit` to `-- Amended by D-BG-210`.

### CHANGELOG.md

Under `## [Unreleased]`, directly after the sub-bullet "An `asyncRewake` hook that exits 2 now wakes the model with Claude Code's text and shows its summary, by default `Stop hook feedback`.":

```markdown
  - A `Stop` hook now gets `stop_hook_active: true` at the end of a turn that an `asyncRewake` hook woke, and not in later turns.
```

It is one sentence of 23 words, with no ID and no mechanism.

### .planning/DUBIOUS-CHOICES.md

For the batch closeout: quick task 261109-cpn (D-BG-210) fixes P2-DC-04 and P2-DC-26.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

- FOUND: every file in key-files.modified is changed in `7bceecbb` or `58d91f65`.
- FOUND: `7bceecbb` and `58d91f65` are ancestors of the worktree HEAD.

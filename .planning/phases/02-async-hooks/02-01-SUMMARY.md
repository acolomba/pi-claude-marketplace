---
phase: 02-async-hooks
plan: 01
subsystem: hooks
tags: [async-rewake, cucumber, upstream-parity]
requirements-completed: [ASYNC-01, ASYNC-02]
key-files:
  created:
    - extensions/pi-claude-marketplace/bridges/hooks/async-rewake/rewake-text.ts
    - test/bridges/hooks/async-rewake/rewake-text.test.ts
    - features/step_definitions/hook/async.steps.ts
  modified:
    - extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts
    - extensions/pi-claude-marketplace/bridges/hooks/runtime.ts
    - test/bridges/hooks/async-rewake/registry.test.ts
    - test/bridges/hooks/runtime.test.ts
    - features/hook/async.feature
commits: [7d753478]
---

# Plan 02-01 Summary: an exit-2 async rewake wakes the model

## What changed

- **D-BG-201.** On exit 2 the registry sends the rewake once with `{ triggerTurn: true, deliverAs: "steer" }`: an idle Pi starts a turn with no prompt, a running turn reads it at its next boundary. The `ctx.isIdle()` read is gone.
- **D-BG-202.** New leaf `async-rewake/rewake-text.ts`: `rewakeLabel` (the D-CF5-14 label from the stdin payload's match field), `rewakeBody` (`<rewakeMessage or default prefix> <stderr or stdout>`, one space, empty output still wakes), `rewakeSummaryText` (default `Stop hook feedback`).
- **D-BG-204.** The summary shows only on exit 2; any other exit shows and sends nothing. The exit work moved from `finalizeChild` into `wakeOnExitTwo`, and `ctx`, `pi`, and the label travel as one `RewakeExit` object.
- **D-BG-203.** New `HooksRuntime.recordRewake()` sets the Stop flag (cleared by user input and by settle registration; does not touch the STOP-07 counter); the registry calls it right before the send.
- Unit pairs rebaselined (lane, one-space body, default summary, empty output now wakes); the stale idle-getter row was dropped. Direct coverage 100% for the three sources. `test/architecture/hooks-async-rewake.test.ts` passed unchanged.

## Steps added (`features/step_definitions/hook/async.steps.ts`)

- `Given the model has answered the woken turn`
- `When the user prompts {string} after the woken turn ends`
- `When the user releases the hook {string} and it wakes the model`
- `When the user releases the hook {string} and pi handles its exit` (end line, Pi reaps the pid, two `get_state` round trips with `isStreaming` false, no `agent_start`)
- `Then the hooks show the user no rewake summaries`

## Scenarios (`features/hook/async.feature`, 7 passing, adapter profile)

- Seed 2 rewritten: "An async rewake hook that exits 2 shows the user its summary" (keeps `the user releases the hook {string} with the hooks recording`; adds the woken-turn prompt; call 3 table).
- Seed 3 rewritten: "An async rewake hook that exits 2 wakes the model with its message and its stderr" (keeps `the user has released the hook {string}`).
- New: "An async rewake hook with no message or summary wakes the model with the default texts".
- New: "An async rewake hook that exits with another code shows nothing and adds nothing to the model's context".

## Red proofs

- R1, lane reverted to `{ deliverAs: "nextTurn" }`: seeds 2, 3 and the default-texts scenario fail (`no matching record within 20000 ms` waiting for the woken turn); 4 passed, 3 failed.
- R2, body joined with a blank line and no default summary: seeds 2 and 3 fail on the call table (`'The hook woke the model.\n\nwoke up'` vs `'The hook woke the model. woke up'`); the default-texts scenario times out waiting for its summary.
- R3, every exit treated as exit 2: the silent-exit scenario fails in `pi handles its exit` (`get_state` reports `isStreaming: true`).
- All mutations restored before commit.

## Deviations

- The three plan tasks landed as one commit (7d753478), executed inline by the orchestrator (P2-DC-19), because the runtime flag and the steps had no meaningful separate state.
- The pid-reap check of RESEARCH A1 was not separately probed: the silent-exit scenario passes on this machine, which needs Pi to reap the script's pid directly.

## Parent-line candidates

- `.agents/skills/cucumber/rules/layout.md` "Seeds": the Phase 2 seed titles "An async rewake hook shows the user its summary when it exits" and "An async rewake hook that exits 2 puts its message into the model's next call" were renamed (see above).
- `.agents/skills/cucumber/rules/world-and-stand-ins.md` and the `hook/session.steps.ts` overview say the extension shows a declared rewake summary on every exit; it now shows one only on exit 2, so the frozen release steps release only a hook that exits 2.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Dubious Choices

- (Low) Plan tasks merged into one commit and run inline (see Deviations).
- (Low) The silent-exit scenario's second prompt uses `the user prompts {string} and the hook {string} goes on in the background`, since the prompt hook runs again.

## Wave gate

Parts of `npm run check` on 7d753478 (`/tmp/claude-1000/bg-phase-2/gates/wave1`): check:static 0 (114 s), test:unpaired 0, test:integration 0, cucumber builtin 148/148, test:coverage:direct:all 0. Cucumber adapter: 1640/1642 on the first run (42 min under shared load); the two failures were timeouts in unowned files (`mcp-server/configuration.feature:10`, 90 s start; `plugin/browse.feature:68`, 15 s TUI readiness), and both passed on the one rerun.

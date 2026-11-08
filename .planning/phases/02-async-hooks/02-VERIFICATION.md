---
phase: 02-async-hooks
verified: 2026-11-08
status: passed
score: 5/5
mode: inline (the orchestrator, following .claude/agents/gsd-verifier.md; P2-DC-19)
gate: npm run check on e2839ec3 (merged with features/behavioral-gaps); npm run test:modules exit 0
---

# Phase 2 Verification: Async Hooks

Goal: a plugin's async hooks run in the background as Claude Code runs them: they never hold up the event they fired on, an `asyncRewake` hook that exits 2 wakes the model with its message and shows the user its summary, any other exit reaches neither, and no hook process outlives a reload.

## Success criteria

| # | Criterion | Evidence | Status |
|---|-----------|----------|--------|
| 1 | ASYNC-01: an exit 2 puts `rewakeMessage` and the output into the model's context, shown in the call log on the next turn | `async.feature`: "...exits 2 wakes the model with its message and its stderr" (call 3 holds `The hook woke the model. woke up` before the model's `Woke.`), "...shows the user its summary", "...with no message or summary wakes the model with the default texts", "...exits 2 while a tool runs reaches the model in the same turn", "An async rewake Stop hook that exits 2 wakes the model once"; registry unit pair | ✓ |
| 2 | ASYNC-02: any other exit adds nothing and shows nothing; exit 2 shows `rewakeSummary` or `Stop hook feedback` | "...exits with another code shows nothing and adds nothing to the model's context" (no summary, no `agent_start`, call 2 without a rewake row); summary scenarios with `wake finished` and `Stop hook feedback` | ✓ |
| 3 | ASYNC-03: a slow async hook on `PreToolUse` or a prompt does not block its event | "An async rewake hook goes on running after the prompt that started it", "An async rewake PreToolUse hook does not hold up its tool call", "A plain async hook goes on running..." (each asserts the hook's start and no end while the reply and tool result arrive) | ✓ |
| 4 | ASYNC-04: `/reload` and the first load after a crash stop the earlier hook processes, project scope included | Seeds "A hook process that a dead Pi left..." and "Reloading Pi stops its waiting hook processes" (user scope), plus "A project hook process that a dead Pi left..." and "Reloading Pi stops the waiting hook processes of a project plugin" (both red before D-BG-207) | ✓ |
| 5 | ASYNC-05: plain `async: true` behaves as Claude Code's does | "A plain async hook goes on running...", "A plain async hook's answer reaches the model's next call and never the user" (exit 2 decides nothing; `systemMessage` and `additionalContext` reach call 2 after the prompt); divergence (no mid-turn attachment) recorded as D-BG-205 / P2-DC-05 | ✓ |

## Decisions

D-BG-201 to D-BG-209 are each implemented and cited in a plan's must_haves (decision coverage gate 9/9). Red proofs for every scenario are in 02-01, 02-02, and 02-03 SUMMARY.

## Gate

- `npm run check` on e2839ec3: static, unpaired, integration, and the builtin profile (152/152) and `test:coverage:direct:all` green; adapter 1768/1770 with two unowned-scenario failures (`plugin/update-dependencies.feature:116`, `plugin/autoapply.feature:447`) that passed on the one rerun. The first gate run on efd3cfbb found HOOK-E2E-04 red (review WR-01), fixed in e2839ec3.
- `npm run test:modules`: exit 0.
- No file under the real `~/.pi` changed during the phase's runs (checked against a baseline marker).

## Human verification

None needed: every behavior has an automated scenario.

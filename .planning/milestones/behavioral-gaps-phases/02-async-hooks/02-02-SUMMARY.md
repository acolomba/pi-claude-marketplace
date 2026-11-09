---
phase: 02-async-hooks
plan: 02
subsystem: hooks
tags: [async, async-rewake, stop, cucumber, upstream-parity]
requirements-completed: [ASYNC-03, ASYNC-05, ASYNC-01]
key-files:
  created:
    - extensions/pi-claude-marketplace/bridges/hooks/async-rewake/async-answer.ts
    - test/bridges/hooks/async-rewake/async-answer.test.ts
  modified:
    - extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts
    - extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts
    - extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts
    - extensions/pi-claude-marketplace/bridges/hooks/settle.ts
    - test/bridges/hooks/async-rewake/registry.test.ts
    - test/bridges/hooks/dispatch-exec.test.ts
    - test/bridges/hooks/dispatch.test.ts
    - test/bridges/hooks/settle.test.ts
    - features/step_definitions/hook/async.steps.ts
    - features/hook/async.feature
commits: [f565af80]
---

# Plan 02-02 Summary: plain async and async Stop hooks run in the background

## What changed

- **D-BG-205.** `dispatchHookExec` sends `async === true` hooks, as well as `asyncRewake === true` ones, to the registry (strict `=== true`; other values stay synchronous). The registry picks a lane per child (`laneOf`: rewake when `asyncRewake === true`, else plain) and an `EXIT_HANDLERS` table: the rewake lane keeps plan 01's exit-2 wake; the plain lane (`sendAsyncAnswer`) reads the answer with the new leaf `async-rewake/async-answer.ts` (`asyncAnswerTexts`: Claude Code's candidate order, then `parseHookStdout`) and sends `systemMessage` then `additionalContext` as `claude-hook-async-response` model-only messages with `deliverAs: "nextTurn"`, whatever the exit code or signal. No summary, no wake, no Stop flag.
- **D-BG-206.** `collectBucketOutcomes` no longer degrades `asyncRewake` entries; every matching entry goes to the executor, whose background branch returns `noop`. Comments in `dispatch.ts` and `settle.ts` and the registry header and TRANSLATORS comment say so.
- Unit pairs: plain-lane cases (exit 2, exit 0, signal, plain stdout, send failure), background delegation for both fields and the synchronous path for `"yes"` and `false`, the collection and Stop cases rebaselined. Existing registry cases now declare `asyncRewake: true` explicitly, since an undeclared handler is the plain lane. 100% direct coverage for all five sources.

## Steps added

- `When the user prompts {string} and the hook {string} wakes the model once` (prompt, settle, first end line, summary, woken settle, the next end line from just past the first, Pi reaps it, two `get_state`, no later `agent_start`).
- Helpers `promptToSettle`, `waitForHandledExit`, `lengthsPast` (the release-without-summary step now reuses `waitForHandledExit`).

## Scenarios (10 in `async.feature`; 127 in `features/hook` all pass)

- "A plain async hook goes on running after the prompt that started it" (ASYNC-05, ASYNC-03).
- "A plain async hook's answer reaches the model's next call and never the user" (ASYNC-05; exit code 2 decides nothing).
- "An async rewake Stop hook that exits 2 wakes the model once" (ASYNC-01, D-BG-203, D-BG-206): two Stop runs, `stop_hook_active` false then true; call 2 ends with `Stop hook blocking error from command "Stop": keep going`; summary `Stop hook feedback`; lifecycle start, end 2, start, end 0.

## Red proofs

- Background branch reverted to `asyncRewake` only: both plain scenarios fail (`function timed out ... 30000 milliseconds` in the background prompt steps, since the hook holds the prompt).
- The degrade restored in `collectBucketOutcomes` only: the Stop scenario fails (`the hook keep logged no end within 20000 ms`).
- `runtime.recordRewake()` removed and the plain sends skipped: the Stop scenario fails (`the hook woke the model a second time`), and the plain-answer scenario's call 2 lacks the two rows.
- (A first, too-broad mutation also changed the composite path in `dispatch.ts`; it failed all 10 scenarios and is not counted.) All mutations restored before commit.

## Deviations

- Both plan tasks in one commit, executed inline (P2-DC-19).
- `dispatch.ts` has two identical `runHooks(... executor(...))` calls now (collection and composite); fallow dupes stays green.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. The plain answer's stdout is parsed inside try/catch and reaches only the model, as upstream.

## Dubious Choices

- (Low) A killed or timed-out plain async hook still has its stdout read for an answer (upstream not checked).
- (Low) The plain-answer scenario's second prompt uses the background step, since the prompt hook runs again and waits.

## Wave gate

Parts of `npm run check` on the merged tree 27f6f597 (Phases 3, 5, 6 and others merged from the milestone branch; `/tmp/claude-1000/bg-phase-2/gates/wave2`): check:static 0, test:unpaired 0, test:integration 0, cucumber builtin 152/152, test:coverage:direct:all 0. Cucumber adapter: 1709/1755 on the first run (15 min, shared load); the 46 failures were in unowned features (skill listing, marketplace update, plugin lifecycle; skills or results missing from a slow load), and all 46 passed on the one rerun (`rerun.log`).

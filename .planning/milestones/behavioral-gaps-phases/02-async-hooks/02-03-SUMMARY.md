---
phase: 02-async-hooks
plan: 03
subsystem: hooks
tags: [async, reap, cucumber, docs]
requirements-completed: [ASYNC-04, ASYNC-03, ASYNC-01]
key-files:
  modified:
    - extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts
    - extensions/pi-claude-marketplace/bridges/hooks/event-router.ts
    - extensions/pi-claude-marketplace/bridges/hooks/timeout.ts
    - test/bridges/hooks/async-rewake/registry.test.ts
    - test/bridges/hooks/event-router.test.ts
    - features/step_definitions/hook/async.steps.ts
    - features/hook/async.feature
    - docs/hooks-compatibility.md
commits: [5c2ab122, 23c2786e, e2839ec3]
---

# Plan 02-03 Summary: project-scope reap, tool-call scenarios, docs

## What changed

- **D-BG-207.** `reapOrphans` reads this runtime's own rows (`runtime.pidTableEntries(loc)`), skips them, reaps the others through the new `reapOrphan` helper (liveness, Linux marker, SIGKILL, as before), and writes the owned rows back, unlinking the table only when it owns none. New private `reapProjectOrphans(runtime, cwd)` in `event-router.ts` reaps the project table for the session's real `cwd` when the hydrate recorded trust; it runs after the project hydrate in the `session_start` wrapper (before the SessionStart dispatch) and in `createHooksHydration().hydrateProjectScopeForCwd` (the load). `index.ts` and `routing-state.ts` are unchanged. The comment above the in-memory shutdown now says Pi builds a new runtime per load.
- Unit tests: the queued-persistence reap case now keeps the live child's row; new event-router cases reap a trusted project's dead-pid table and keep an untrusted one's. 100% direct coverage for `registry.ts`, `event-router.ts`, `timeout.ts`.
- Step: `When the user prompts {string} and the hook {string} wakes the model while the tool runs` (prompt, `tool_execution_start`, release, summary record, then the `{home}/hook-releases/tool` marker the scripted tool waits on, then the run's settle).
- Docs (D-BG-209): the `timeout` parenthesis, the `async`, `asyncRewake`, "Long-running handlers", and "Restart-survival rewake" rows, and the deleted Silent drop bullet. mdformat re-padded the whole first table (its widest Notes cell changed), so `docs/hooks-compatibility.md` shows 14+/15- lines. The feature description and the `timeout.ts` lane comment were rewritten.

## Scenarios (14 in `async.feature`, all passing)

- "A project hook process that a dead Pi left stops when Pi starts again" (ASYNC-04).
- "Reloading Pi stops the waiting hook processes of a project plugin" (ASYNC-04).
- "An async rewake PreToolUse hook does not hold up its tool call" (ASYNC-03).
- "An async rewake hook that exits 2 while a tool runs reaches the model in the same turn" (ASYNC-01, D-BG-201 steer lane).

## Red proofs

- Both `reapProjectOrphans` calls removed: both project scenarios fail at `no hook process is running` ("these hook processes are still running").
- Owned-row skip removed: the project reload scenario fails at its terminal Given (`the hook wake logged no start within 30000 ms`: the load's second hydrate killed its own SessionStart hook).
- Rewake lane `deliverAs: "followUp"`: the tool scenario fails (`the model was called past its script`).
- `asyncRewake` routed to the synchronous path: the PreToolUse scenario fails (`no matching record within 19989 ms`).
- All mutations restored before commit.

## Deviations

- Executed inline (P2-DC-19); Task 1 and Task 2 share one commit (5c2ab122), the docs task has its own.
- The plan's `5	6` numstat for the docs commit does not hold: mdformat re-padded the first table (see above).

## Parent lines

- **`.planning/BACKLOG.md`** (one entry each):
  1. ASYNCPRINT-01: Claude Code runs an `asyncRewake` hook synchronously in a non-interactive session without streaming input (`claude -p`); Pi's print and json modes still run it in the background, and no harness runs a prompt there.
  2. ASYNCSUMJSON-01: Claude Code takes a `rewakeSummary` from a JSON line on stdout for a plugin of an official marketplace; the bridge reads only the declared field.
  3. ASYNCMISSING-01: Claude Code reports an exit 2 from a hook whose script cannot be opened with its own message, once; the bridge wakes the model with the interpreter's output.
  4. ASYNCPIDS-01: two live Pi processes in one scope share its PID table; one's start reaps the other's live hook processes, and the last writer's rows win (user scope before this phase; now the project scope too).
  5. ASYNCMIDTURN-01: Claude Code may attach a finished plain async hook's answer at a tool boundary of a running turn; the bridge waits for the next prompt (Pi has no lane that does not continue the turn).
  6. ASYNCSANITIZE-01: Claude Code collapses whitespace and caps the length of the summary, redacts some keys, and escapes a trailing `<` in the body; the bridge sends both as written.
  7. ASYNCRUNTIME-01: the `{"async": true}` first stdout line that turns a synchronous hook asynchronous at run time is not supported.
  8. ASYNCNEWSESSION-01 (question for the user): a new session in a live Pi now stops the earlier session's project-scope async hooks, as the user-scope factory reap already did; Claude Code leaves them running. Keep, or reap only at load?
- **`docs/json-output.md`**: the `async-rewake-summary` `text` field reads "Author's summary text"; it is now the declared `rewakeSummary` or Claude Code's default `Stop hook feedback`.
- **`.planning/PROJECT.md` Key Decisions**: rows for D-BG-201 to D-BG-209 as written in `02-CONTEXT.md` (with D-BG-207's reason as corrected by research), all pending the user's review.
- **`CHANGELOG.md`**: "Async hooks: a plugin's `async` hooks run in the background instead of blocking their event, and give their JSON answer to the model's next call; an `asyncRewake` hook that exits 2 now wakes the model with Claude Code's text and shows its summary (default `Stop hook feedback`) only on exit 2; async Stop hooks run too; a project plugin's async hook processes stop on `/reload` and after a crash."
- **Frozen harness texts made stale**: `.agents/skills/cucumber/rules/layout.md` "Seeds" (two Phase 2 seed titles renamed, see 02-01-SUMMARY), and `.agents/skills/cucumber/rules/world-and-stand-ins.md` plus the `features/step_definitions/hook/session.steps.ts` overview, which say a released hook shows its declared summary on every exit.
- **Merge note for `docs/hooks-compatibility.md`**: mdformat re-padded the "handler fields" table; Phase 6 edited its `timeout` row. Keep Phase 6's `SessionEnd` text and this phase's `(async hooks keep 600 s everywhere)`.
- No unowned feature file changed.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. The project reap runs only for a trusted project and kills only processes whose environment carries the recorded dispatch marker.

## Dubious Choices

- (Medium) Reap tests use a pid above `pid_max` (4194305) with the real probes, so no probe parameter was added to the shared hydration signature.
- (Low) The docs table re-pad (see Deviations) widens the docs diff and may conflict with sibling phases' row edits.

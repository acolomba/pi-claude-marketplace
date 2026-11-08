# Phase 2 (Async Hooks): Dubious Choices

The choices Phase 2 made without the user. Entries are numbered in the
milestone form `P{N}-DC-NN`, with N = 2.
Only the Phase 2 child session writes this file: it copies each item from
its own steps and from the `## Dubious Choices` section of each subagent
report and plan SUMMARY.md. A subagent never edits this file. The parent
merges it into the root log `.planning/DUBIOUS-CHOICES.md`.

- **Severity.** High: changes what a user sees or diverges from upstream.
  Medium: a judgment call a reviewer may reverse at low cost. Low: process,
  naming, or tooling.
- **Status.** `open` until the user reviews it.
- **IDs.** `P{N}-DC-NN` is a choice of phase N; this log holds Phase 2's.

## Discuss step

The autonomous run took the recommended option at every discuss question; those answers are the decisions D-BG-201 to D-BG-209 in 02-CONTEXT.md. The entries below are the ones a reviewer may reverse.

- **P2-DC-01 (High, open). ASYNC-02 reworded to upstream.** Claude Code 2.1.319 shows an `asyncRewake` hook's summary only on exit 2, defaulting to `Stop hook feedback`, and shows nothing on any other exit. ASYNC-02 and the phase's success criterion 2 said the summary reaches the user on any other exit, copied from the v1.13 HOOK-06 criterion 3. No decision ID licensed that divergence, so the phase follows upstream (D-BG-204) and rewords both. A user who declares a summary no longer sees it on a clean exit, and a user who declares none now sees `Stop hook feedback` on exit 2.
- **P2-DC-02 (High, open). An exit 2 wakes the model.** The bridge used to queue the rewake for the user's next prompt (`nextTurn`) or as a follow-up. It now starts a turn with no prompt when Pi is idle, and steers a running turn (D-BG-201), as Claude Code's `next`-priority task notification does. A plugin whose hook exits 2 after the user walked away now makes the model answer on its own, and the Phase 1 seed that pinned the next-prompt delivery is rewritten.
- **P2-DC-03 (Medium, open). Claude Code's default texts.** A rewake with no `rewakeMessage` now reads `Stop hook blocking error from command "<label>": <output>`, joined by one space instead of the blank line the bridge used, and an exit 2 with no output still wakes the model (D-BG-202). The texts name Stop even for a hook of another event, because Claude Code's do.
- **P2-DC-04 (Medium, open). A woken turn sets `stop_hook_active`.** Claude Code marks only the woken turn; the bridge's flag lasts until the user's next input, as its Stop re-entry flag does (D-BG-203).
- **P2-DC-05 (Medium, open). Plain async context waits for the next prompt.** Claude Code may attach a finished plain async hook's context at a tool boundary of a running turn; Pi has no lane that does so without continuing a turn that would end, so the bridge always uses `nextTurn` (D-BG-205).
- **P2-DC-06 (Medium, open). Stop and StopFailure async hooks run in the background.** The settle path dropped an `asyncRewake` Stop hook and ran a plain async one synchronously; both now run in the background (D-BG-206). The change sits in `collectBucketOutcomes`, which Phase 3's StopFailure path also uses, but only inside its async branch.
- **P2-DC-07 (Medium, open). Project reap scope.** The project PID table is reaped only for a project Pi trusts, and the reap keeps the rows of children the live Pi owns (D-BG-207). Two live Pi processes in one scope still reap each other's hooks; that is deferred, not fixed.
- **P2-DC-08 (Low, open). Deferred parity items.** Print and json mode synchronous `asyncRewake`, the official-marketplace stdout summary override, the missing-script message, summary and body sanitizing, and the run-time `{"async": true}` protocol are deferred as BACKLOG parent lines (02-CONTEXT.md, Deferred Ideas).
- **P2-DC-09 (Low, open). Unpaired tests updated.** `test/architecture/hooks-async-rewake.test.ts` and the async cases of `test/integration/hooks-spawn-end-to-end.test.ts` pin the behavior this phase changes, so they change with it (D-BG-209), although no ownership row names them.

## Research step

- **P2-DC-10 (Medium, open). Discuss-step facts corrected.** Research showed that `/reload` and a new session rebuild the hooks runtime, so the in-memory kill never reaches the earlier load's children, and project-scope hooks survive `/reload` today; D-BG-207's reason was rewritten, and `hooks-spawn-end-to-end.test.ts` turned out to have no async case.
- **P2-DC-11 (Medium, open). New session stops project-scope async hooks.** With the project-hydrate reap, a live Pi that starts a new session stops the earlier session's project-scope async hooks, as the user-scope factory reap already does; Claude Code leaves them running.
- **P2-DC-12 (Medium, open). One lane call.** The rewake is sent as `{triggerTurn: true, deliverAs: "steer"}` with no `ctx.isIdle()` read; in Pi 1.5.0 that starts a run when idle and steers when streaming, the same behavior as D-BG-201's two branches.
- **P2-DC-13 (Low, open). Pattern mapping skipped.** The research file already maps every edit point and analog, so the optional pattern-mapper agent was not run, to save shared machine time.
- **P2-DC-14 (Low, open). json-output wording.** `docs/json-output.md` (an append-only closed-set file) describes the `async-rewake-summary` text as the author's summary; with the `Stop hook feedback` default that is not always true. Listed as a parent line, not edited.

## Planning step

- **P2-DC-15 (Medium, open). Tasks above the 5-file limit.** 02-01 Task 1 touches 6 files and 02-02 Task 1 touches 7, because each product file is committed with its unit pair and the seed rewrites it forces, so no commit leaves a scenario red (planner).
- **P2-DC-16 (Medium, open). Stop wake-once wait.** The step that waits for the Stop hook's second end line reads from the position just after the first end line, not from a fresh log-length snapshot, which research suggested but which races the woken turn under load (planner).
- **P2-DC-17 (Medium, open). Summary seed gains a second When.** The rewritten summary seed adds "prompts after the woken turn ends", so the frozen release step stays in use and the woken turn ends before `After` (planner).
- **P2-DC-18 (Low, open). Plan details.** The PreToolUse and steer-while-a-tool-runs scenarios sit in 02-03 although the steer lane ships in 02-01; the plain-async custom type is `claude-hook-async-response` with raw text; a killed plain async hook's stdout is still read; the project reap reads the trust answer the hydrate recorded; `timeout.ts` (unowned) gets a comment-only fix; the "Restart-survival rewake" Claude Code column goes to ✗ on reasoning, not code; reap unit tests use dead pids with the real probes (planner).
- **P2-DC-19 (Medium, open). Plan check done inline, and the rest of the phase run inline.** The coordinator ruled mid-phase that this child's subagents run asynchronously and stall when the turn ends, so the plan checker was not spawned: the orchestrator checked the plans itself (frontmatter and structure validators, requirement and decision coverage). Execution, code review, fixes, and verification then ran inline in the orchestrator, following `gsd-executor`, `gsd-code-reviewer.md`, and `gsd-verifier.md`, instead of in independent agent contexts.
- **P2-DC-20 (Low, open). Planner stalled once.** The background planner stopped after the first plan; it was resumed by message and finished the set.

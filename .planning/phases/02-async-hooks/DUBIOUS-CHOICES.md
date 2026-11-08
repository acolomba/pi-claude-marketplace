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

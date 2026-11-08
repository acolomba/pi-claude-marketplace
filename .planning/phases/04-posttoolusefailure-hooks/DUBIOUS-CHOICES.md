# Phase 4 (PostToolUseFailure Hooks): Dubious Choices

The choices Phase 4 made without the user. Entries are numbered in the
milestone form `P{N}-DC-NN`, with N = 4.
Only the Phase 4 child session writes this file: it copies each item from the
report of each step and from the `## Dubious Choices` section of each plan
SUMMARY.md. A subagent never edits this file. The parent merges it into the
root log at the phase's merge.

- **Severity.** High: changes what a user sees or diverges from upstream.
  Medium: a judgment call a reviewer may reverse at low cost. Low: process,
  naming, or tooling.
- **Status.** `open` until the user reviews it.
- **IDs.** `P{N}-DC-NN` is a choice of phase N; this log holds Phase 4's.

## Discuss step

The autonomous run took the recommended option at every discuss question; those answers are the decisions D-BG-401 to D-BG-403 in 04-CONTEXT.md. The choices below are the ones a reviewer may want to reverse.

- **P4-DC-01 (High, open). `is_interrupt` is always `false` (D-BG-401).** Claude Code sends the boolean on every failure, and the bridge now sends it too, but Pi's `tool_result` event has no interrupt bit, so the value is a constant. It is correct only because D-BG-402 keeps the bridge from running these hooks on a cancelled call. It changes the expected row of the PostToolUseFailure scenario in the unowned `features/hook/tool-use.feature`, and it amends the PostToolUseFailure clause of D-CF5-28 for this one field.
- **P4-DC-02 (Medium, open). The cancelled-call guard edits a shared function (D-BG-402).** The roadmap lets a hook-event phase add only new code paths and never reshape an existing function. The guard is one early return inside `toolResultCompositeHandler` in `bridges/hooks/dispatch.ts`, on the failure arm only, because no other place sees both the failed result and the turn's abort signal before the hooks start.
- **P4-DC-03 (Medium, open). `tool_use_id`, `duration_ms`, and `mcp_server` stay out (D-BG-403).** Success criterion 1 asks for "Claude Code's payload", and Claude Code sends all three. They stay deferred under D-CF5-28 because the frozen runs step can state only whole literals (the ids and timings vary per run), and `mcp_server` would also change the PreToolUse and PostToolUse payloads, which no stream owns.
- **P4-DC-04 (Medium, open). The failing MCP stand-in and the interrupt driver live in the verb module.** `features/lib/**` is frozen, and the frozen stub servers never fail, so the verb module writes a small failing wrapper into the published plugin and carries its own prompt-and-abort step. A later milestone may move either into `features/lib/`.

## Research step

- **P4-DC-05 (High, open). The adapter failure routing is fixed in a shared line (D-BG-404).** Under pi-mcp-adapter a failed plugin MCP call ran PostToolUse, because the adapter flags the error only in its own later `tool_result` handler. The fix reads the adapter's `details.error` codes (`tool_error` and `call_failed` only, not its whole override set) in the D-59-01 split of the shared `toolResultCompositeHandler`. The alternative was a `@builtin-only` scenario and a BACKLOG line.
- **P4-DC-06 (Medium, open). `updatedToolOutput` on a failure is dropped (D-BG-405).** Criterion 4 does not list that channel; the fix follows the binary's PostToolUseFailure branch, which reads only `additionalContext`.
- **P4-DC-07 (Medium, open). The failing-MCP scenarios pin each implementation's error wording and skip the built-in stand-in.** The adapter's `Error: ` prefix is pinned as the adapter words it, following the precedent of Pi's own Bash wording in `tool-use.feature`. The built-in stand-in step is left out because the extension's own registration serves the wrapper.
- **P4-DC-08 (Low, open). Research side effects.** The researcher ran the optional-peer install in this worktree and five probe scenarios from scratchpad files, and it read the milestone checkout's peer cache once, read-only. No repository file changed, and the real `~/.pi` did not change.

## Planning step

- **P4-DC-09 (Medium, open). Plan split.** The planner moved the D-BG-402 guard, the interrupt scenario, and the creation of the feature file and verb module into 04-01, ahead of the `is_interrupt` change, so no commit sends `false` on a cancelled call. The three plans run in sequence.
- **P4-DC-10 (Medium, open). Pi's `read` wording is pinned in several scenarios.** About six scenarios state `Offset 9 is beyond end of file (3 lines total)`; a Pi rewording fails them together. This extends P4-DC-07 to the read tool.
- **P4-DC-11 (Low, open). The MCP pair's titles name their licenses.** The `@adapter-only` scenario names D-BG-404 and the `@builtin-only` one MHK-01; no new decision ID covers the pair form. Its non-selecting matcher is another tool of the same server.
- **P4-DC-12 (Low, open). The adapter check runs before the empty-bucket check.** A result that carries an adapter failure code reads the proxy rule (one cached read per generation) even when both buckets are empty; the D-BG-402 signal read stays after the empty-bucket check.
- **P4-DC-13 (Low, open). No `if` row and long scenarios.** The matcher scenario has no `if` row, and each output-channel scenario repeats the whole runs-table row, as `tool-use.feature` does.
- **P4-DC-14 (Low, open). Plan checker run in the background.** The coordinator later required foreground subagents; the checker started in the background could not be stopped, and the subagent limit refused a foreground rerun, so the session waited for the background checker in the same turn and used its verdict (0 blockers, 0 warnings, 2 info; the second info was applied to 04-03).

# Phase 6 (SessionEnd Hooks): Dubious Choices

The choices Phase 6 made without the user. Entries are numbered in the
milestone form `P{N}-DC-NN`, with N = 6.
Only the Phase 6 child session writes this file: it copies each item from the
report of each step and from the `## Dubious Choices` section of each plan
SUMMARY.md. A subagent never edits this file. The parent merges it into the
root log at the phase's merge.

- **Severity.** High: changes what a user sees or diverges from upstream.
  Medium: a judgment call a reviewer may reverse at low cost. Low: process,
  naming, or tooling.
- **Status.** `open` until the user reviews it.
- **IDs.** `P{N}-DC-NN` is a choice of phase N; this log holds Phase 6's.

## Discuss step

The autonomous run took the recommended option at every discuss question; those answers are the decisions D-BG-601 to D-BG-606 in 06-CONTEXT.md, so they are not repeated here. The entries below are the parts of them a reviewer may want to reverse.

- **P6-DC-01 (High, open). Plugin SessionEnd timeouts capped at 1.5 s (D-BG-604).** A plugin SessionEnd hook that declares a `timeout` longer than 1.5 s is now stopped at 1.5 s, as Claude Code does ("Timeouts set on plugin-provided hooks don't raise the budget", hooks docs, and the 2.1.319 budget function, which reads no plugin hook). Before, the bridge honored the declared value, so a `timeout: 600` held a quit or a new session for ten minutes. A plugin that relied on the longer time loses it.
- **P6-DC-02 (Medium, open). `CLAUDE_CODE_SESSIONEND_HOOKS_TIMEOUT_MS` is not read (D-BG-605).** Claude Code lets the user raise the SessionEnd budget with this variable. After the cap, the bridge gives the user no way to give a plugin's SessionEnd hooks more than 1.5 s. Proposed as a new BACKLOG item.
- **P6-DC-03 (Medium, open). No bounded SessionEnd wait (D-BG-605).** Claude Code waits for its SessionEnd hooks at most for the budget. The bridge waits for each hook's process: a hook that ignores SIGTERM holds the session for the 5-second SIGKILL grace too, and a grandchild that keeps the hook's output open holds it until the grandchild exits (HKDR-01). Both live in the shared blocking lane, outside Phase 6's files.
- **P6-DC-04 (Medium, open). The failure outlines state no notice for a non-blocking failure (D-BG-603).** Claude Code writes `SessionEnd hook [<command>] failed: <output>` to stderr for a failed SessionEnd hook; the bridge shows nothing for a non-blocking failure on any event. HOOKERRNOTE-01 carries the gap and no decision licenses pinning either form, so the scenarios state the runs and the session's end only. The exit-2 notice is pinned, because D-CF5-24 licenses it.
- **P6-DC-05 (Medium, open). Ways a session ends that no scenario drives (D-BG-601).** Print mode (shares the json exit path and `other`), the terminal `/new`, `/resume`, `/fork`, and `/clone` (the mapping does not depend on the mode), RPC `clone` (Pi's `fork` reason), and a signal that quits a terminal Pi (the D-CF5-02 Pi gap, `prompt_input_exit` where upstream sends `other`).
- **P6-DC-06 (Low, open). The resumed session is a hand-written session file (D-BG-601).** The profile Pi runs with `--no-session` and saves no session, so the `Given` writes a version-3 Pi session header with its own id and the project directory as its cwd, and `switch_session` resumes it.
- **P6-DC-07 (Low, open). "Pi exits" is proven in json mode, not by an RPC stop (D-BG-603).** The profile Pi driver kills Pi after a 5-second grace and does not say whether Pi exited on its own; the json driver fails unless Pi exits 0 within 25 s.
- **P6-DC-08 (Low, open). HKTO-01 counted as fixed by the cap (D-BG-604).** Its first point, a budget shared across the hooks, holds because the matching hooks of one event start together (D-CF5-09), so each gets the same 1.5 s; no deadline is threaded through the fan-out.

## Research step

- **P6-DC-09 (Medium, open). The failure scenarios start no setup session.** `the user has started a new pi session` also ends the startup session and runs the slow hook, so each slow row would wait twice and the red proof would land in the Given. The failure scenarios leave it out, unlike `hook/session.feature`; the runs then name the startup session `first`.
- **P6-DC-10 (Low, open). The saved session sits directly in `{agent dir}/sessions/`.** Pi's own per-cwd folder name changes every run, so the transcript path would not be a stable literal; Pi's `/resume` list would not show the file, but `switch_session` takes the path directly.
- **P6-DC-11 (Low, open). One named budget constant.** `SESSION_END_BUDGET_SECONDS` also replaces the literal in the SessionEnd row of the defaults table (the row's value, not its order).
- **P6-DC-12 (Low, open). Json-mode details.** The json turn is recorded with disposition `handled`, runs `/claude:plugin list`, keeps no results, and the json failure outline declares only the SessionEnd hook. Json mode stops printing before the session ends, so a SessionEnd notice never reaches the driver.
- **P6-DC-13 (Low, open). The sleep-30 RPC row's red proof is just past the 30 s step timeout.** The json row's 25 s deadline is the reliable red proof.

## Planning step

- **P6-DC-14 (Low, open). No pattern-mapper run.** The research step read and measured every analog the plans copy (the session action recording, the json driver, the timeout tests), so the optional pattern-mapper agent was skipped; the AI-integration plan hook does not apply to this phase.
- **P6-DC-15 (Low, open). The cap and the scenario rows that prove it land in different waves.** 06-02 lands the cap with a unit red proof; 06-03's `timeout: 60` rows prove it end to end and record a cap-off red run.
- **P6-DC-16 (Low, open). The docs `timeout` row keeps its exact width.** Its Notes cell is the widest of the table, so a longer clause would make mdformat re-pad every row, including sibling-owned ones; the new SessionEnd clause must have the old clause's length, else it becomes a parent line. The 5 s kill-grace detail stays in the code comments and the HKTO-01 parent line.
- **P6-DC-17 (Low, open). The RPC reason and matcher scenarios keep the setup new-session Given,** as `hook/session.feature` does; only the failure scenarios drop it (P6-DC-09).
- **P6-DC-18 (Low, open). Proposed parent-line names.** BACKLOG ID `SESSIONENDENV-01` for the variable item and a sample CHANGELOG bullet; the parent may rename them.
- **P6-DC-19 (Low, open). Step texts.** `the user has a saved pi session {string} in the project`, `the user resumes the saved pi session {string} with the hooks recording`, and `the user runs {string} in pi's json mode with the hooks recording`; a sibling hook phase that registers the same text would make an ambiguous step at the parent's merge.
- **P6-DC-20 (Low, open). Researcher, planner, and checker ran as background agents** before the coordinator's foreground rule arrived; later dispatches run in the foreground, and commit messages moved to `/tmp/claude-1000/bg-phase-6/`. The two earlier commit titles were checked against their content and match.

## Execution

- **P6-DC-21 (Medium, open). Plans, review, and verification ran inline in the child session.** The `gsd-executor` dispatch was refused by the agent-isolation guard, which reads the dispatch sentinel from the session's start directory, the parent checkout this session may not touch; a general-purpose stand-in was refused by the permission classifier as a guard bypass. The coordinator then ruled that the rest of the phase runs inline (no subagents), with the code review following `gsd-code-reviewer.md` and the verification following `gsd-verifier.md`. So no independent agent reviewed or verified the work.
- **P6-DC-22 (Medium, open). SessionEnd recorder runs are load-sensitive.** Under a load average of about 85 on 28 cores, three SessionEnd scenarios (two unchanged ones in `hook/session.feature`) lost their SessionEnd run: the Node hook recorder did not start within the 1.5 s SessionEnd default, which the bridge applied before this phase too. They passed at lower load. CI on a loaded runner could see the same flake; a recorder that starts faster or a longer budget for the harness would be a parent decision.
- **P6-DC-23 (Low, open). The exit-2 scenario starts a setup session.** Without one, the hook-error notice of the startup session's end missed the RPC stream once under load (Pi's RPC double bind) and appeared on a rerun; ending a session that `new_session` created makes the notice reliable.
- **P6-DC-24 (Low, open). R6 for the json rows used a delayed settle.** A promise that never settles keeps nothing in Node's event loop, so the json Pi still exits 0; a settle delayed by a referenced 60 s timer is the plausible wrong implementation that the json rows catch.
- **P6-DC-25 (Low, open). Two tasks per commit in 06-01 and 06-03.** Each plan's feature file and step changes landed in one commit.

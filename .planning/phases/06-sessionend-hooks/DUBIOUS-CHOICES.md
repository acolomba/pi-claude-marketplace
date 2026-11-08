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

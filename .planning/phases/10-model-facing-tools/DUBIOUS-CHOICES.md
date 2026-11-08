# Phase 10 (Model-Facing Tools): Dubious Choices

The choices Phase 10 made without the user. Entries are numbered in the
milestone form `P{N}-DC-NN`, with N = 10.
Only the Phase 10 child session writes this file: it copies each item from the
report of each step and from the `## Dubious Choices` section of each plan
SUMMARY.md. A subagent never edits this file. The parent merges it into the
root log `.planning/DUBIOUS-CHOICES.md` at the phase's merge.

- **Severity.** High: changes what a user sees or diverges from upstream.
  Medium: a judgment call a reviewer may reverse at low cost. Low: process,
  naming, or tooling.
- **Status.** `open` until the user reviews it.
- **IDs.** `P{N}-DC-NN` is a choice of phase N; this log holds Phase 10's.

## Discuss step

The autonomous run took the recommended option at every discuss question;
those answers are the decisions D-BG-1001 to D-BG-1007 in 10-CONTEXT.md. The
entries below are the ones a reviewer may want to reverse.

- **P10-DC-01 (Medium, open). The carried json-output D-03 choice closes as "return `isError: true`, never throw".** D-03 left "throw a redacted Error instead" to the user because Pi 0.87.1 ignored a returned `isError`. Pi 1.5.0 honors it (`pi-agent-core/dist/agent-loop.js:588`), so the returned error result already reaches the model as a failed tool result with the redacted text, and throwing would gain nothing (D-BG-1001). The roadmap told the phase to take the recommended option and log it.
- **P10-DC-02 (High, open). A disabled plugin keeps the `[unavailable]` tag, and the `unavailable` filter now returns it.** Today no single filter returns an installed-but-disabled plugin, though the unfiltered list shows it as `[unavailable]`. The fix keeps the D-54-01 projection and makes the `unavailable` filter load the disabled rows; the `installed` and `unavailable` parameter descriptions are reworded to match (D-BG-1004). The alternative, projecting a disabled plugin to `[installed]` (the slash command's `--installed` includes disabled plugins, and the old `installed` description said "installed in state.json"), would reverse a recorded decision, so it waits for the user. Either way the content line does not say "disabled"; only `details`, which the model does not receive, carry the verbatim status.
- **P10-DC-03 (Medium, open). The list tool's `<N> plugin(s)` keeps counting installed plugins (D-09).** The model may read it as the number of plugins the marketplace offers. Phase 12 re-checks the picker's similar `0 plugin(s)` count (BROWSE-01, P1-DC-48), so the two surfaces may end up counting different things (D-BG-1005).
- **P10-DC-04 (Low, open). GSD's manager view resolves Phase 10 to an archived directory.** `gsd-tools query init.manager` reports Phase 10 as executed with stale verification, from `.planning/milestones/v1.20-phases/10-constraint-aware-update`; `init.phase-op 10` resolves the right, new `.planning/phases/10-model-facing-tools`, so the run follows `init.phase-op`. Nothing in the repository was changed for it.

## Research step

- **P10-DC-05 (Medium, open). `(no plugins)` for every block that keeps no rows.** The D-BG-1004 fix would otherwise leave a bare marketplace header under the `unavailable` filter; one empty-block shape replaces the WR-05 distinction and changes the unit case that pins the bare header (D-BG-1008).
- **P10-DC-06 (Low, open). "Each parameter form" read as 3-4 combined calls.** The call table grows as (N+1)² rows, so the no-change scenario combines parameters instead of making 13 calls (D-BG-1009).
- **P10-DC-07 (Low, open). Research probes edited the owned `tools.ts` temporarily** (restored byte for byte) and installed the optional test peers into this worktree's gitignored cache over the network.
- **P10-DC-08 (Low, open). Shared pre-commit hook briefly in migration mode.** At about 09:00 the common `.git/hooks/pre-commit.legacy` (a copy left by the parallel `init.sh` runs) made the first context commit fail; another session repaired it at 09:05, and this phase changed nothing there.
- **P10-DC-09 (Low, open). Pattern mapper skipped.** The research already names every file, analog, and unit-test line this phase touches, so the optional pattern-mapping agent was not spawned.

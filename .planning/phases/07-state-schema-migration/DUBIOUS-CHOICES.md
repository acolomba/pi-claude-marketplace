# Phase 7 (State Schema Migration): Dubious Choices

The choices Phase 7 made without the user. Entries are numbered in the
milestone form `P{N}-DC-NN`, with N = 7.
Only the Phase 7 child session writes this file: it copies each item from the
report of each step and from the `## Dubious Choices` section of each plan
SUMMARY.md. A subagent never edits this file. The parent merges it into the
root log `.planning/DUBIOUS-CHOICES.md` at the phase's merge.

- **Severity.** High: changes what a user sees or diverges from upstream.
  Medium: a judgment call a reviewer may reverse at low cost. Low: process,
  naming, or tooling.
- **Status.** `open` until the user reviews it.
- **IDs.** `P{N}-DC-NN` is a choice of phase N; this log holds Phase 7's.

## Discuss step

The autonomous run took the recommended option at every discuss question; those answers are the decisions D-BG-701 to D-BG-704 in 07-CONTEXT.md. The entries below are the parts of them a reviewer may want to reverse.

- **P7-DC-01 (Medium, open). Release 0.4.3 left to Phase 8.** STMIG-01 says "each older schema". Schema version 1 is covered by the release 0.6.0 record only; the 0.4.3 record (also schema version 1, with no `resources.hooks` and no config files) has no Phase 7 scenario, because its first load is the MIG-01 config migration that Phase 8 owns (D-BG-701).
- **P7-DC-02 (Medium, open). A new step reads the record's schema version and provenance.** The ROADMAP's Behavioral tests rule says scenarios observe the installation record "through its existing steps". No existing step reads `schemaVersion` or `provenance`, which is what "rewritten in the current schema" means, so the verb module adds one read step (D-BG-704).
- **P7-DC-03 (Medium, open). Other commands' unreadable reports are not pinned or fixed.** With a newer `state.json`, `install` reports no reason, `update` reports `unreadable manifest`, and `uninstall` and `info` report an internal error whose cause is cut to `state.json at [path]`. All refuse and change nothing, but only `list`, `disable`, `pending`, `apply`, and the load report `{unreadable}`. The fixes are in orchestrators no stream owns, so Phase 7 pins `list` (seed) and `disable` only, and proposes a BACKLOG entry as a parent line (D-BG-703).
- **P7-DC-04 (Medium, open). A refused newer record keeps the installed components working.** The load that refuses a newer `state.json` still offers the plugin's skill, because resource discovery reads the staged files, not the record. Phase 7 pins that as "every installed component stays as it was" (STMIG-02) instead of asking whether a release that cannot read the record should stop offering what it installed (D-BG-703).
- **P7-DC-05 (Low, open). The migration write stays fire-and-forget.** `loadState` does not await `persistMigratedState`, so the record steps read a file whose write the load started but did not wait for. The exploratory runs saw it landed every time, and no product change is planned unless a gate run shows otherwise (D-BG-704).
- **P7-DC-06 (Low, open). An old record with no plugins keeps its old schema version.** `loadState` rewrites the file only when a field was filled, so a schema version 1 or 2 record with marketplaces but no plugins stays at its version on disk. No scenario pins it; a BACKLOG entry is proposed as a parent line.

# Phase 12 (Browse Picker): Dubious Choices

The choices Phase 12 made without the user. Entries are numbered in the
milestone form `P{N}-DC-NN`, with N = 12.
Only the phase's own session writes this file: it copies each item from the
report of each step and from the `## Dubious Choices` section of each plan
SUMMARY.md. A subagent never edits this file. The parent merges it into the
root log `.planning/DUBIOUS-CHOICES.md`.

- **Severity.** High: changes what a user sees or diverges from upstream.
  Medium: a judgment call a reviewer may reverse at low cost. Low: process,
  naming, or tooling.
- **Status.** `open` until the user reviews it.
- **IDs.** `P{N}-DC-NN` is a choice of phase N; this log holds Phase 12's.

## Discuss step

- **P12-DC-01 (High, open). Marketplace row wording changes, not only its count.** D-BG-1201 replaces `{n} plugin(s)` with Claude Code's `{offered} available`, plus ` • {installed} installed` when any is installed, keeping Pi's ` -- {source}` tail. The roadmap asked only to check the count; matching upstream's words was judged part of fixing the row.
- **P12-DC-02 (Medium, open). Unreadable manifest leaves the count out.** As upstream does when its catalog cannot be read; the row then shows the installed part or the source alone, with no error marker on the first screen.
- **P12-DC-03 (Medium, open). BROWSE-02's "its marketplace's scope" refined.** Claude Code asks the user for the install scope and has unscoped marketplaces, so the scenarios pin installing in the scope the user picks (user, project, or the project's local config), not in the marketplace's scope.
- **P12-DC-04 (High, open). Install-scope screen kept as is (D-BG-1202).** Pi offers `Project local (Recommended)`, `Project`, `User (global)`; Claude Code offers user, project, local with none recommended. No scenario exposes a bug there, so the scenarios pin today's rows and the parity change goes to BACKLOG as a parent line.
- **P12-DC-05 (Low, open). Unavailable plugin rows pinned without an upstream reference.** The binary showed no browse-list treatment of an uninstallable catalog entry; the scenario pins Pi's `[unavailable]` / `not installable` row and its Info-only actions.
- **P12-DC-06 (Low, open). Upstream's `Updated {date}` row part not added.** Pi's marketplace record carries no date the picker shows.

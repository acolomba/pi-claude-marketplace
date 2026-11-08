# Phase 8 (First-Run Config Migration): Dubious Choices

The choices Phase 8 made without the user. Entries are numbered in the
milestone form `P{N}-DC-NN`, with N = 8.
Only the phase's session writes this file: it copies each item from the report
of each step and from the `## Dubious Choices` section of each plan
SUMMARY.md. A subagent never edits this file.

- **Severity.** High: changes what a user sees or diverges from upstream.
  Medium: a judgment call a reviewer may reverse at low cost. Low: process,
  naming, or tooling.
- **Status.** `open` until the user reviews it.
- **IDs.** `P{N}-DC-NN` is a choice of phase N; this log holds Phase 8's.

## Discuss step

The autonomous run took the recommended option at every discuss question; those answers are the decisions D-BG-801 to D-BG-808 in 08-CONTEXT.md. The entries below are the ones a reviewer may want to reverse.

- **P8-DC-01 (Medium, open). D-BG-802: a rebuilt config leaves out cascade-installed dependencies.** CFGMIG-01 says the config declares "every recorded marketplace and plugin". D-04-02 (v1.20) rules that the config names only the plugins the user asked for, and the uninstall orphan sweep treats a declared dependency as the user's desired state, which the next load reinstalls. The rebuild therefore leaves out a `provenance: "dependency"` record, except one the user disabled by name, which keeps the `{ "enabled": false }` entry `disable` wrote. A 0.4.3 state has no dependency records, so the upgrade path still declares every record.
- **P8-DC-02 (Low, open). D-BG-806: a new session stands in for a later load.** Pi runs the same `resources_discover` load on a session start and on `/reload`, and the suite already uses a new session for `/reload` (`features/agent/lifecycle.feature`). The planner adds one terminal `/reload` scenario only if the existing steps support it without a frozen-file change.
- **P8-DC-03 (Low, open). D-BG-804: a deleted config loses `autoupdate`.** Under a current release, `state.json` no longer records a marketplace's `autoupdate` (D-13), so a config the user deletes comes back without it. Only a release-0.4.3 record carries the field the rebuild copies.

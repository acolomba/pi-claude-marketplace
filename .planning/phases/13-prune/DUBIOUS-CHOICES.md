# Phase 13 (Prune): Dubious Choices

The choices Phase 13 made without the user. Entries are numbered in the
milestone form `P{N}-DC-NN`, with N = 13.
Only the child session that runs Phase 13 writes this file: it copies each item
from the report of each step and from the `## Dubious Choices` section of each
plan SUMMARY.md. A subagent never edits this file. The parent merges it into
the root log `.planning/DUBIOUS-CHOICES.md` at the phase's merge.

- **Severity.** High: changes what a user sees or diverges from upstream.
  Medium: a judgment call a reviewer may reverse at low cost. Low: process,
  naming, or tooling.
- **Status.** `open` until the user reviews it.
- **IDs.** `P{N}-DC-NN` is a choice of phase N; this log holds Phase 13's.

## Discuss step

The autonomous run took the recommended option at every discuss question; those answers are the decisions D-BG-1301 to D-BG-1307 in 13-CONTEXT.md, so they are not repeated here, except where the choice itself is open to doubt.

- **P13-DC-01 (Medium, open). Criteria 2 and 3 met by scenarios the phase does not own.** Every prune usage error already has a row with its usage text in `features/plugin/usage-errors.feature`, and prune under a held lock already has a scenario per scope in `features/plugin/state-lock.feature`. Both files belong to no stream, and the roadmap's "Existing coverage" line does not name them. The phase adds no duplicate scenario and records a red proof for each existing one instead (D-BG-1304, D-BG-1305). A reviewer who wants the prune scenarios in one file can move them at the merge.
- **P13-DC-02 (Low, open). Upstream's `autoremove` alias is not adopted.** `claude plugin autoremove` is Claude Code's CLI alias for prune. The router has none of the CLI's plugin aliases (`i`, `remove`, `rm`, `autoremove`), and prune is a CLI-only command upstream, so this is a new command surface rather than a prune bug. Deferred as a BACKLOG parent line.
- **P13-DC-03 (Medium, open). An island of dependencies that declare each other stays installed.** Claude Code's orphan scan walks only from plugins installed by name, so auto-installed plugins that only declare each other are pruned. The product keeps such an island under PRUNE-03 (v1.20). No criterion of this phase names it and install refuses a cycle, so the phase changes nothing and flags the divergence for review as a BACKLOG parent line.

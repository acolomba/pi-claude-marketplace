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

## Research step

- **P13-DC-04 (High, open). A pruned disabled dependency leaves `enabled: false` in `claude-plugins.json`.** Claude Code's prune deletes `enabledPlugins[id]` for each plugin it removes (2.1.319). The product keeps the entry, because the shared sweep in `orchestrators/plugin/uninstall.ts` (not owned by this phase) never touches the config layers. The entry changes no command result (`pending` is empty, and a later install enables the plugin). The phase does not fix it (D-BG-1309): a fix only in `prune.ts` would leave `uninstall --prune` different and would need the prune rollback to cover the config files. The disabled-orphan scenario states no config outcome. Parent line: a BACKLOG entry for the shared sweep.
- **P13-DC-05 (Low, open). A separate orphan per scope.** The two-scope scenarios use `lib` in the user scope and `mid` (through a new plugin `tool`) in the project scope, instead of CONTEXT's same-`lib` idea, so a preview that reads the wrong scope fails (D-BG-1308).
- **P13-DC-06 (Low, open). The lock red proof edits a Phase 15 file locally.** The red proof for the state-lock scenarios changes the lock path in `transaction/with-state-guard.ts` and restores it, uncommitted. A proof inside this phase's files (`prune.ts`) would show the `lock held` row but not that nothing is removed.
- **P13-DC-07 (Low, open). The optional-peer cache was missing.** The brief says init installed it; this worktree had none, so the researcher ran `node scripts/install-test-peers.mjs` (gitignored output).

## Planning step

- **P13-DC-08 (Low, open). No pattern-mapper run.** The phase changes one feature file with five scenarios whose literals the research prototype already proved, so the optional pattern mapper was skipped.
- **P13-DC-09 (Low, open). Scenario placement.** The three scope scenarios replace the one-scope preview in place, the two disabled-plugin scenarios go at the end of the file, and the feature description stays as it is.
- **P13-DC-10 (Low, open). M3 edits a file the phase does not own, locally.** The red proof for the disabled-plugin scenarios drops disabled holders in the shared `orchestrators/plugin/dependency-index.ts`, restored and never committed, as P13-DC-06 does for the lock proof.
- **P13-DC-11 (Low, open). Scenario D states the config.** The kept-dependency scenario checks that `claude-plugins.json` declares only `app@tools` with enabled `false`. That pins the existing rule that the config names only plugins the user asked for; it is not the residue D-BG-1309 keeps out of scenario E.
- **P13-DC-12 (Low, open). One plan above the half-context estimate.** The planner estimated about 105k tokens for one plan of three tasks and kept it as one plan rather than splitting the existing-coverage proofs into a second plan.
- **P13-DC-13 (Low, open). BACKLOG IDs.** The parent lines use the new IDs PRUNECFG-01, PLUGALIAS-01, and PRUNEISLAND-01.

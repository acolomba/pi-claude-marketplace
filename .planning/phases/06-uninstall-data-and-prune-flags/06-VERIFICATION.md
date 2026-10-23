---
phase: 06-uninstall-data-and-prune-flags
verified: 2026-10-23
status: passed
score: 3/3 must-haves verified
---

# Phase 6: Uninstall Data and Prune Flags - Verification

**Goal:** `uninstall` removes or keeps a plugin's data directory and its
unneeded dependencies as its flags say.

## Success criteria

| # | Criterion | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Uninstall removes the data directory; `--keep-data` keeps it and the planted file's content (UNI-01) | VERIFIED | `features/plugin/uninstall.feature`: "Uninstalling a plugin removes its data directory and the file in it" (new) and "Uninstalling with --keep-data keeps the plugin's data directory and the file in it" (seed) |
| 2 | `--prune` uninstalls and reports each dependency nothing else needs, keeps one another plugin needs (UNI-02) | VERIFIED | "Uninstalling with --prune also uninstalls the dependency that nothing else needs" (`lib` row, reason `dependency pruned`; empty record, config, skills) and "Uninstalling with --prune keeps the dependency that another installed plugin still needs" (record keeps `lib`, `other`; skills offered) |
| 3 | Scenarios pass in `npm run test:cucumber`; `check:features` and `npm run check` green | VERIFIED | `npm run check` at `3abc781c`: all static checks passed (incl. `check:features`, fallow, lint), 466/466 scenarios, direct coverage merged, exit 0 |

## Wrong-implementation check

- An uninstall that keeps the data directory (or removes it only when empty)
  fails the removal scenario: a file is planted first, and the absence step
  first proves the marketplace data directory exists, so a wrong path cannot
  pass vacuously.
- An uninstall that ignores `--prune` fails the first prune scenario; one that
  prunes every dependency fails the second.

## Requirements

- UNI-01: satisfied.
- UNI-02: satisfied.

## Product bugs

None found. Behavior matches Claude Code's `--prune` contract.

## For the orchestrator

- Shared GSD files (STATE, ROADMAP, REQUIREMENTS, WINDOWS, state.json) untouched.
- Code review: `06-REVIEW.md`, status clean (one optional info item, IN-01, not applied).

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

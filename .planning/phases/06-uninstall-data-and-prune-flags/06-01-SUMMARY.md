---
phase: 06-uninstall-data-and-prune-flags
plan: 01
subsystem: features
tags: [cucumber, uninstall, prune]
requirements-completed: [UNI-01, UNI-02]
key-files:
  created:
    - features/step_definitions/plugin/uninstall.steps.ts
  modified:
    - features/plugin/uninstall.feature
duration: n/a
completed: 2026-10-23
---

# Phase 6 Plan 01: Uninstall data and prune coverage Summary

`features/plugin/uninstall.feature` now covers the data directory and `--prune`.

## Accomplishments

- "Uninstalling a plugin removes its data directory and the file in it": plants
  a file, uninstalls, and states the directory is gone (UNI-01). The Phase 1
  `--keep-data` seed scenario covers the keep side unchanged.
- "Uninstalling with --prune also uninstalls the dependency that nothing else
  needs": both rows reported, `lib` with reason `dependency pruned`; no
  installed plugin, no declaration, no skills in a new session (UNI-02).
- "Uninstalling with --prune keeps the dependency that another installed plugin
  still needs": only `app` reported; the record keeps `lib` and `other`; a new
  session offers their skills (UNI-02).
- One phase-local step: `the uninstall has removed the data directory of
  <id> from the <scope> scope` (D-03).

## Task Commits

1. Tasks 1-2 (feature scenarios + step): `3abc781c`

## Deviations from Plan

None. No product bug found: the extension matched Claude Code's `--prune`
contract (remove dependencies no remaining plugin needs, keep the rest).

## For the orchestrator

- No shared GSD file touched; no WINDOWS item. REQUIREMENTS UNI-01 and UNI-02
  can be checked off on merge.
- Two untracked directories (`.agents/skills/fallow-setup/`,
  `.claude/skills/fallow-setup/`) appeared in this worktree from the setup copy
  and are left uncommitted.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

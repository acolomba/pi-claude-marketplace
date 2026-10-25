---
phase: 12-fetch-and-prune
plan: 02
subsystem: behavioral-tests
tags: [cucumber, prune, dependencies, git-source]
requirements-completed: [PRN-01, PRN-02, PRN-03]
key-files:
  modified:
    - features/plugin/prune.feature
duration: ~15 min
completed: 2026-10-23
---

# Phase 12 Plan 02: Plugin prune coverage Summary

**`features/plugin/prune.feature` now proves that `prune` uninstalls an orphaned auto-installed dependency and removes its clone, that `--dry-run` previews the same row and removes nothing, and that a needed dependency or a plugin installed by name is never pruned (Claude Code parity).**

## Scenarios added (beside the Phase 1 empty-scope seed)

| Scenario | Requirement | What it pins |
| --- | --- | --- |
| Pruning a scope uninstalls a dependency that no installed plugin needs | PRN-01 | `uninstalled {dependency pruned}`, needs reload true, no installed plugins after |
| Pruning a git-source dependency removes its clone | PRN-01 | row at `{ghp revision 1}`, no git clones after |
| Previewing a prune lists the dependency it would uninstall and removes nothing | PRN-02 | `will uninstall {dependency pruned}`, needs reload false, record still holds `lib@tools` |
| Pruning keeps a dependency that an installed plugin still needs | PRN-03 | `prune-empty` |
| Pruning keeps a plugin the user installed by name | PRN-03 | `prune-empty` (upstream prunes auto-installed plugins only) |

## Task Commits

1. **Task 1: Add the PRN-01..PRN-03 scenarios** - `f6afe5c1` (test)

## Verification

- `npx cucumber-js features/plugin/prune.feature`: 6 scenarios, 57 steps passed.
- `npm run check:features`: exit 0.
- Negative check: changing the dry-run row's status to `uninstalled` made the preview scenario fail; reverted.

## Deviations from Plan

- Executed inline by the orchestrating agent (see 12-01-SUMMARY.md). No new step module, no product change.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

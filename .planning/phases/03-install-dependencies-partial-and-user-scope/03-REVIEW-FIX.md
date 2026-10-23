---
phase: 03-install-dependencies-partial-and-user-scope
fixed_at: 2026-10-23
review_path: .planning/phases/03-install-dependencies-partial-and-user-scope/03-REVIEW.md
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Phase 3: Code Review Fix Report

All fixes landed in `3d8571d5` (the review ran on the staged, not yet committed scenarios).

| Finding | Fix |
| --- | --- |
| CR-01 | Both user-scope install scenarios now check that the user `claude-plugins.json` declares `demo@fixtures` and the project one declares no plugins. |
| CR-02 | The installed-dependency conflict scenario now checks that the project scope stages only `lib-skill`. |
| WR-01 | Added `list` and new-session scenarios for the contradictory-constraint conflict, and a new-session scenario for the installed-dependency conflict (offers only `lib-skill`). |
| WR-02 | The info scenario's title now says it reports "an unsupported component left out"; the specific kind collapses to that reason by design (CONTEXT D-09). |
| WR-03 | The closure install pins `claude-plugins.json` to `app@tools` only (dependencies stay undeclared); the `--partial` install pins `demo@fixtures`. |
| WR-04 | The two `list --scope project` titles now say the list shows nothing of the marketplace once the user scope installs the plugin. The list rule is recorded for the list phase (see VERIFICATION "For the orchestrator"). |
| WR-05 | The `partial-install.feature` description now covers `--partial`. |

Info findings: IN-04's awkward title was retitled. IN-01 (dependency order not observable) is CONTEXT D-03. IN-02 (resolved members have no row on failure) and IN-03 (the two conflict causes print the range differently) are product messaging observations, left as they are and listed for the orchestrator.

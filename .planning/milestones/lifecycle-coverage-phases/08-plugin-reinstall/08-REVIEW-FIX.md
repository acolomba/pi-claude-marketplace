---
phase: 08-plugin-reinstall
status: all_fixed
findings_in_scope: 5
fixed: 4
skipped: 1
---

# Phase 8: Code Review Fix Report

| ID | Severity | Outcome |
| -- | -------- | ------- |
| CR-01 | BLOCKER | Fixed: added `A new session offers the skills of the reinstalled plugin`, which reinstalls over skills still on disk and checks the next session offers the skill. |
| WR-01 | WARNING | Fixed: the not-installed scenario also compares the staged skills (`skill | demo-skill`). |
| WR-02 | WARNING | Fixed without editing the shared step: added `Uninstalling a reinstalled plugin removes it from the scope`, which ends with `the project scope has no installed plugins`, so a reinstall that empties the record's skill list leaves a staged skill and fails. |
| IN-01 | INFO | Fixed: retitled to `Deleting the installed skills of a plugin takes them out of a new session before any reinstall`. |
| IN-02 | INFO | Skipped: the user scope holds no installation in this file's Background, so there is nothing for a wrong-scope reinstall to move; no change. |

`features/plugin/reinstall.feature`: 13 scenarios, 154 steps pass; `npm run check:features` passes.

---
phase: 06-uninstall-data-and-prune-flags
reviewed: 2026-10-23
depth: standard
files_reviewed: 2
files_reviewed_list:
  - features/plugin/uninstall.feature
  - features/step_definitions/plugin/uninstall.steps.ts
findings:
  critical: 0
  warning: 0
  info: 1
  total: 1
status: clean
---

# Phase 6: Code Review Report

Reviewed against the cucumber skill (`.agents/skills/cucumber/**`) and
`typescript-style`. Each new scenario was checked with the skill's first
question: would a plausible wrong implementation still pass?

- Data directory removed by default: an uninstall that keeps the directory, or
  removes only an empty one, fails (the scenario plants a file first). The step
  asserts the marketplace data directory exists before the absence check, so a
  wrong path cannot pass vacuously.
- `--prune`, dependency nothing needs: an uninstall that ignores `--prune`
  fails on the missing `lib` row and on `the project scope has no installed
  plugins`.
- `--prune`, dependency still needed: a prune that removes every dependency
  fails on the record table and the session's skills.
- Steps are lower case, Given/When/Then only, whole tables compared; the new
  step text names its verb (D-08) and lives in the phase-owned module. No
  Phase 1 file changed.

## Info

### IN-01: The keep-dependency scenario does not state the base config

**File:** `features/plugin/uninstall.feature` (last scenario)
**Issue:** It checks the record and the session but not that
`claude-plugins.json` still declares `other@tools`. A prune that dropped the
declaration of an unrelated plugin would still be caught by the next
reconcile, and the first prune scenario already states the config, so this is
informational.
**Fix:** Optional; not applied.

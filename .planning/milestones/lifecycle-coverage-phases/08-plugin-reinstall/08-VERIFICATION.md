---
phase: 08-plugin-reinstall
verified: 2026-10-23
status: passed
score: 4/4 success criteria
requirements: [REI-01, REI-02, REI-03]
---

# Phase 8: Plugin Reinstall Verification

**Goal:** Reinstalling one plugin rewrites its artifacts at the same version,
repairs deleted skill files, and fails for a plugin that is not installed.

| # | Success criterion | Evidence | Status |
| - | ----------------- | -------- | ------ |
| 1 | Reinstalling one installed plugin reports it reinstalled, and `list` shows it at the same version and scope (REI-01) | `Reinstalling an installed plugin rebuilds it at the same version in the same scope` (whole result: `reinstalled`, `1.0.0`, `project`; record `demo@fixtures 1.0.0 true`); `The plugin list shows the reinstalled plugin at the same version` (whole list result); `A new session offers the skills of the reinstalled plugin` (artifacts rewritten over files still on disk); `Uninstalling a reinstalled plugin removes it from the scope` (record still owns the staged skill) | VERIFIED |
| 2 | After deletion a new session lacks the skills; reinstall restores them and the next session offers them (REI-02) | `Deleting the installed skills of a plugin takes them out of a new session before any reinstall` (`the session offers no skills`); Phase 1 seed `Reinstalling a plugin whose installed skills were deleted restores them` (reinstalled row, next session offers `/skill:demo-skill`) | VERIFIED |
| 3 | Reinstalling a not-installed plugin fails with the not-installed reason and changes nothing (REI-03) | `Reinstalling a plugin that is not installed fails as not installed and changes nothing`: severity `error`, summary `A plugin operation has failed.`, row `pp skipped {not installed}`; installation record, staged skills, base config and absent local config unchanged | VERIFIED |
| 4 | Scenarios pass; `check:features` and `npm run check` green | `npx cucumber-js features/plugin/reinstall.feature`: 13 scenarios / 154 steps passed. `npm run check` exit 0 at `9a2a2602` (static, unpaired, integration, 469 cucumber scenarios, direct coverage) | VERIFIED |

## Anti-patterns

None: every table is compared whole by its step (code review confirmed), steps
are lower case, `Given`/`When`/`Then` only, no `Given` after a `When`.

## For the orchestrator

- Deferred product finding: path-source reinstall after the marketplace
  advanced records the old version but stages the new content (08-CONTEXT
  D-06, 08-01-SUMMARY). Needs a user decision against D-68-02.
- No shared GSD file (STATE, ROADMAP, REQUIREMENTS, WINDOWS, state.json)
  was changed or committed.

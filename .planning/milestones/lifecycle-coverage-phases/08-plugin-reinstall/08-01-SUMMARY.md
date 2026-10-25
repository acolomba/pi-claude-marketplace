---
phase: 08-plugin-reinstall
plan: 01
subsystem: features
tags: [cucumber, reinstall]
requires: [01-suite-foundation]
provides: [REI-01, REI-02, REI-03 scenarios]
key-files:
  modified: [features/plugin/reinstall.feature]
requirements-completed: [REI-01, REI-02, REI-03]
---

# Phase 8 Plan 01: Plugin reinstall scenarios Summary

Six scenarios added to `features/plugin/reinstall.feature` (four planned, two
from the code review). No step module, product code, or Phase 1 file changed.

| Scenario | Requirement |
| -------- | ----------- |
| Reinstalling an installed plugin rebuilds it at the same version in the same scope | REI-01 |
| A new session offers the skills of the reinstalled plugin | REI-01 (review CR-01) |
| Uninstalling a reinstalled plugin removes it from the scope | REI-01 (review WR-02) |
| The plugin list shows the reinstalled plugin at the same version | REI-01 |
| Deleting the installed skills of a plugin takes them out of a new session before any reinstall | REI-02 (with the Phase 1 restore seed) |
| Reinstalling a plugin that is not installed fails as not installed and changes nothing | REI-03 |

## Commits

- `9f05582e` docs(reinstall): record the reinstall coverage context and plan
- `9c75435e` test(features): cover reinstall at one version and not installed
- `9a2a2602` docs(reinstall): record the reinstall coverage review and fixes

## Deviations from Plan

- Two scenarios added from the code review (CR-01, WR-02); the not-installed
  scenario also compares the staged skills (WR-01).
- Tasks ran inline in this session, not through a gsd-executor subagent.

## For the orchestrator

- **Deferred product finding (D-06 in 08-CONTEXT):** when a path-source
  plugin's marketplace now offers a newer version, `reinstall` reports and
  records the old version (`1.0.0`) but stages the new content (the next
  session shows `A skill of demo 1.1.0.`). `reinstall-flow.ts` documents
  that a path source re-resolves through the marketplace's current checkout,
  and D-68-02 keeps the recorded version, so fixing it changes a recorded
  decision (refuse the reinstall, or adopt the new version). Left for the
  user; no scenario pins either behavior.
- REI-03 behavior note: a not-installed reinstall is severity `error` with a
  `skipped {not installed}` row (reinstall messaging D-01), while `uninstall`
  uses a `failed {not installed}` row. Recorded as designed, not changed.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

---
phase: 07-plugin-update-by-marketplace-constraint-and-partial
plan: 01
subsystem: features
tags: [cucumber, update]
requires: []
provides:
  - "Update scenarios for @<marketplace>, a blocking dependent constraint, and --partial"
affects: [features/plugin/update.feature]
key-files:
  created: []
  modified:
    - features/plugin/update.feature
key-decisions:
  - "D-04: the constraint case is the dependent's range holding a dependency's update (skipped, dependents constrain, warning)"
  - "D-05: a new version needing a newer dependency passes update by design; LOAD-01 enforces it at load"
  - "D-10: an update decline without --partial is a warning (SEV-04/XSURF-03), not an error"
requirements-completed: [UPD-01, UPD-03, UPD-05]
duration: 40min
completed: 2026-10-23
---

# Phase 7 Plan 01: Update by marketplace, constraint, and partial

Five scenarios in `features/plugin/update.feature` now cover `update @<marketplace>`, a version range that holds a dependency's update, and `update --partial`. They use only Phase 1 steps.

## Scenarios added

| Scenario | Requirement | Proves |
| --- | --- | --- |
| Updating the plugins of one marketplace updates each outdated plugin of that marketplace only | UPD-01 | demo and pp updated 1.0.0 -> 1.1.0; the record keeps app@tools at 1.0.0 |
| Updating a dependency past the version range its dependent declares holds the update and changes nothing | UPD-03 | skipped `dependents constrain` row with its cause chain; record and session skills unchanged |
| Updating a plugin whose new version is only partially available fails without --partial and keeps the installed version | UPD-05 | `partially-upgradable` row, hint `partial-update`; record keeps 1.0.0 |
| Updating with --partial a plugin whose new version is only partially available installs the parts Pi supports | UPD-05 | `partially-installed` row at 1.1.0; record holds 1.1.0 |
| Info on a plugin updated with --partial names the component it left out | UPD-05 | whole `plugin-info` result: `partially-installed`, 1.1.0, `unsupported component` |

## Verification

- `npx cucumber-js features/plugin/update.feature`: 14 scenarios passed.
- `npm run test:cucumber`: 468 scenarios, 4472 steps passed.
- `npm run check:features`: no findings.

## Deviations from Plan

None. The plan listed the fields tables of the two `--partial` update scenarios as unknown. The run gave their values: a warning without the flag (D-10) and info with it.

## Product bugs

None found. Two observed behaviors that look like gaps follow recorded decisions (D-05, D-10 in 07-CONTEXT.md).

## For the orchestrator

- No shared GSD file was changed or committed.
- After the code review (07-REVIEW-FIX.md), the file has 2 more scenarios,
  7 in all: an in-range dependency update and a `list` after `--partial`.
  Both `--partial` update scenarios also gained new-session skill checks. Two titles changed.
- IN-02: UPD-03 and success criterion 2 read as if the update's own new
  version broke a dependency's range. The scenarios cover the gated
  direction: a dependent's range holds a dependency's new version (D-04).
  Consider rewording UPD-03 to match.
- IN-03: a `partially-installed` update row carries `version` but no
  `from`/`to`, unlike an `updated` row. This is product grammar to weigh, not
  a defect in the scenarios.
- WR-05: the constraint scenarios sit under a Background whose `demo` they do
  not need. Moving them to a dependency feature file would cross file
  ownership.
- D-05 defers a scenario for a new version that needs a newer dependency
  (enforced at load by LOAD-01) to the reconcile coverage (Phase 11).

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

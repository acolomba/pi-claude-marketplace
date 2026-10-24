---
phase: 09-plugin-list
plan: 02
subsystem: testing
tags: [cucumber, list, behavioral-tests]
requires:
  - phase: 09-plugin-list
    provides: "09-01 list fixes"
provides:
  - "features/plugin/list.feature: 14 scenarios over LST-01..LST-05"
key-files:
  created:
    - features/plugin/list.feature
requirements-completed: [LST-01, LST-02, LST-03, LST-04, LST-05]
---

# 09-02 Summary: plugin list scenarios

## What changed

`features/plugin/list.feature` (Phase 1 steps only; no list step module was
needed):

- LST-01: every status with its scope in one whole table: installed (user),
  upgradable, disabled, partially-installed, available, partially-available,
  unavailable (npm source), remote (project); no git host request.
- LST-02: `--installed`, `--available`, `--unavailable`, `--partial` each, and
  `--available --unavailable` for the union. Empty marketplace headers are
  stated as rows (D-04).
- LST-03: `list extras`; an unknown marketplace fails as not added; a
  project-only marketplace under `--scope user` fails as not added to user scope.
- LST-04 (CONTEXT D-03): `list --remote` keeps only the not-yet-cloned git
  plugin, and the git host receives no request.
- LST-05: `--scope user` / `--scope project` over the shared fixture, and both
  over a project installation from a user-only marketplace.

`npx cucumber-js features/plugin/list.feature`: 14 passed. `npm run
check:features`: green.

## Deviations

- Table columns that no row fills (`scope`, `version`) are left out, because the
  row step compares only fields that the records carry.
- ROADMAP success criterion 4 is read per CONTEXT D-03 (no network check of
  newer revisions; NFR-5).

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

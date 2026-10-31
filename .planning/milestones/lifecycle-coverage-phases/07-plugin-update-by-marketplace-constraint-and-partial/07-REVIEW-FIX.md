---
phase: 07-plugin-update-by-marketplace-constraint-and-partial
fixed_at: 2026-10-23T00:00:00Z
review_path: .planning/phases/07-plugin-update-by-marketplace-constraint-and-partial/07-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 5
skipped: 2
status: partial
---

# Phase 7: Code Review Fix Report

All fixes are in `features/plugin/update.feature`. After the fixes,
`npx cucumber-js features/plugin/update.feature` passes 16 of 16 scenarios,
and `npm run check:features` reports nothing.

## Fixed

- **CR-01:** the `--partial` update scenario now starts a new session and
  expects `/skill:demo-skill | A skill of demo 1.1.0.`, so a stale or missing
  skill fails the scenario.
- **WR-01:** a new scenario, "The plugin list shows a plugin updated with
  --partial as partially installed", reads the saved partial state through
  `list --scope project`.
- **WR-02:** the info scenario is renamed "Info on a plugin updated with
  --partial shows it partially installed with an unsupported component". The
  new title claims only what the result shows.
- **WR-03:** the no-flag scenario says "is held without --partial", which
  matches its `warning` result (D-10).
- **WR-04:** the no-flag scenario now also checks that a new session offers
  the 1.0.0 skill.
- **WR-06:** a new sibling scenario, "Updating a dependency within the version
  range its dependent declares updates it", shows that an in-range update goes
  through. Its row carries `dependency current copy`: a dir-source
  marketplace has no tags, so the current copy installs (TAGS-02).

## Skipped

- **WR-05 (Background in the constraint scenarios):** the scenarios use the
  Background's `demo`, which shows up in their record and skill tables. A
  separate dependency feature file would fall outside this phase's file
  ownership. Recorded for the orchestrator.
- **Info findings:** IN-01 is optional hardening; the installation record
  already proves that `app` kept its version. IN-02 (the UPD-03 wording) and
  IN-03 (no `from`/`to` on a `partially-installed` update row) go to the
  orchestrator in the SUMMARY and VERIFICATION.

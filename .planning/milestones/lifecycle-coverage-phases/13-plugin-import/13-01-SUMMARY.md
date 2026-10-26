---
phase: 13-plugin-import
plan: 01
subsystem: import
tags: [cucumber, import, behavioral-tests, notifications]
requires: [01-suite-foundation]
provides:
  - "IMP-01..IMP-04 scenarios in features/plugin/import.feature"
  - "import installed rows carry the version; a plugin missing from the manifest reads {not in manifest}"
affects: [import]
key-files:
  modified:
    - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
    - test/orchestrators/import/execute.test.ts
    - test/e2e/import-command.test.ts
    - test/integration/reserved-record-keys.test.ts
    - test/architecture/catalog-uat/fixtures/plugin-import.ts
    - test/architecture/catalog-uat/catalog-contract.test.ts
    - docs/output-catalog.md
    - features/plugin/import.feature
  created:
    - features/step_definitions/plugin/import.steps.ts
key-decisions:
  - "D-02: import's installed rows carry InstallPluginOutcome.version, as install, enable, and reconcile rows do"
  - "D-03: the `unavailable` (not-in-manifest) import warning renders {not in manifest}; `uninstallable` keeps {no longer installable}"
  - "D-04: a re-imported, already-recorded marketplace keeps its (updated) header"
  - "IMP-04 proves the untouched scope with an absent claude-plugins.json, an absent state.json (phase-local step), and a new session that offers only the imported scope's skill"
requirements-completed: [IMP-01, IMP-02, IMP-03, IMP-04]
completed: 2026-10-23
---

# Plan 13-01 Summary

**Import rows now show the installed version and name a plugin missing from the manifest `{not in manifest}`; seven scenarios cover IMP-01..IMP-04.**

## What changed

- `orchestrators/import/execute.ts`: `PluginInstalledOutcome` gains an
  optional `version`, filled from the install outcome and spread onto the
  `installed` row. `importWarningReason` maps `unavailable` to
  `not in manifest`.
- Unit tests: a new case pins the version on the row; the warning-reason table
  pins each reason's token; eight real-install cases now expect `v1.0.0`.
  The e2e import assertions, the reserved-key integration test, and the
  output catalog (with its import fixtures and byte pin) follow the new rows.
- `features/plugin/import.feature`: each scenario offers only the plugins it
  uses (`demo` 1.0.0, `tool` 2.0.0). Seeds gain a `version` column. New scenarios: a disabled
  entry is skipped (IMP-01), a second import changes nothing (IMP-02), an
  unoffered plugin is unavailable while the rest install (IMP-03), and one
  scenario per `--scope` value (IMP-04).

## Verification

- `npx cucumber-js features/plugin/import.feature`: 7 scenarios, 88 steps
  passed.
- `npm run check:features` passed.
- `node --test test/orchestrators/import/execute.test.ts`: 70 passed; the
  commit hook's `check:commit` (direct coverage of the staged pair) passed.

## Deviations

- The plan's IMP-04 check of "no installed plugins" in the other scope used a
  step that requires an existing empty record; the untouched scope has no
  `state.json`. Replaced with an absent `claude-plugins.json`, a new
  session that offers only the imported scope's skill, and a phase-local step
  in `plugin/import.steps.ts` that states the missing `state.json` (D-10 had
  planned no step module).
- Verification (initial `gaps_found`) found that the IMP-03 scenario listed the
  unavailable plugin last, so a stop-at-first-failure import would pass; it is
  now listed first.

- Code review (13-REVIEW.md) found that the unselected scope's settings shared
  the `fixtures` marketplace, so a merging import would pass; they now name
  their own marketplace. See 13-REVIEW-FIX.md.

## For the orchestrator

- Product fix in `orchestrators/import/execute.ts` (see D-02, D-03); a merge
  with another phase that edits the import unit tests may conflict in
  `test/orchestrators/import/execute.test.ts`.
- Deferred: the `(updated)` header for an untouched marketplace on re-import
  reads as a change (D-04).

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

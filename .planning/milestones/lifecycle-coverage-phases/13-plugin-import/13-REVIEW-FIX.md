---
phase: 13-plugin-import
status: all_fixed_or_dispositioned
findings_in_scope: 11
fixed: 7
deferred: 4
---

# Phase 13: Code Review Fix Report

| ID | Severity | Disposition |
| --- | --- | --- |
| CR-01 | Critical | **Fixed.** `test/e2e/import-command.test.ts` expects `v1.0.0` on the `official-plugin` and `local-plugin` rows; the e2e file passes (3/3). |
| CR-02 | Critical | **Fixed.** In each `--scope` scenario the unselected scope's settings name their own marketplace `other`; the selected scope's result, record, and `claude-plugins.json` show only `fixtures`, so an import that merged both files fails. |
| WR-01 | Warning | **Fixed (versions).** `docs/output-catalog.md` import states and `catalog-uat/fixtures/plugin-import.ts` carry `version: "1.0.0"` on installed rows; the contract byte pin moves to 46,721. The `{unsupported hooks}` row is a hand-written fixture for an uninstallable plugin, not the not-in-manifest case, so it stays. |
| WR-02 | Warning | **Deferred to the user.** A first-time import of a resolver-uninstallable plugin still reads `{no longer installable}`; `install` reports the narrowed resolver reasons. Changing it is a vocabulary decision outside IMP-03. |
| WR-03 | Warning | **Deferred.** `version` stays optional on the import outcome because `InstallPluginOutcome.version` is optional; making it required means changing the shared install outcome type, outside this phase. |
| WR-04 | Warning | **Fixed.** The Background only publishes `fixtures`; each scenario offers just the plugins it uses. |
| WR-05 | Warning | **Fixed.** A phase-local step, `the import leaves no installation record in the {word} scope` (`features/step_definitions/plugin/import.steps.ts`), states the unselected scope's missing `state.json` in both scope scenarios. |
| IN-01 | Info | **Deferred.** The unexpected-failure fallback already rendered `{not in manifest}` before this phase; noted for the user. |
| IN-02 | Info | **Fixed.** The comment now says import shares the `not in manifest` reason of `install`, `marketplace update`, and `list`. |
| IN-03 | Info | **Fixed.** Retitled "Importing leaves out a plugin the claude code settings disable". |
| IN-04 | Info | **Accepted.** The no-op scenario checks the result, the record, and both declaration sets; staged resources are covered by the unchanged record and the reconcile tests. |

## Verification

- `npx cucumber-js features/plugin/import.feature`: 7 scenarios, 88 steps passed; `npm run check` exit 0 at 6b69ed94.
- `npm run check:features` passed.
- `node --test test/architecture/catalog-uat/*.test.ts test/e2e/import-command.test.ts`: 74 passed.

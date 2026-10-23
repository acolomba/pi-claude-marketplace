---
phase: 19-import-on-the-reconcile-path
status: partial
findings_in_scope: 9
fixed: 8
skipped: 1
---

# Phase 19: Code Review Fix Report

| ID | Severity | Disposition | Fix |
| --- | --- | --- | --- |
| CR-01 | Critical | fixed | Import no longer follows the planner's source claim (D-07 revised). A settings marketplace not recorded under its settings name goes to `addMarketplace`, as before the phase, so rows and config keys always use the settings name. Unit test now asserts the add attempt and that no config is written. |
| WR-01 | Warning | fixed | The read pass computes `buildScopeSatisfactionVerdict` inside the lock and passes it to `planReconcile` (D-13), so a record the load-time check holds down is not enabled. |
| WR-02 | Warning | fixed | `recordedMarketplaceName` removed with CR-01; plugin decisions read the record under the settings name. |
| WR-03 | Warning | fixed | An enable answering `skipped {not installed}` fails the plugin as `{not installed}` (new `not-installed` failure reason), so the post-pass does not declare it (D-14). |
| WR-04 | Warning | fixed | Ambiguous or double source claims only arise for marketplaces not recorded under their settings name, which now go to the add; a recorded-by-name marketplace can only mismatch on its own source. |
| IN-01 | Info | fixed | The headerless-row invariant comment names the usable-marketplace gate. |
| IN-02 | Info | fixed | The enable call has the install's defensive try/catch (GHB-03 rethrow, otherwise an unexpected-failure row). |
| IN-03 | Info | fixed (partly) | `seedDisabledDependencyRecord` renamed `seedDisabledRecord` with a doc line; phase-local `D-06` / `D-07` removed from test titles. The self-compared lock cause chain is kept: its message is asserted separately and the rendered notification checks the chain text. |
| IN-04 | Info | fixed | Double blank line in `import.feature` removed. |

Verification: `node --test test/orchestrators/import/execute.test.ts` 77/77, direct coverage of `execute.ts` 100%, `features/plugin/import.feature` 10/10, then `npm run check` (see 19-VERIFICATION.md).

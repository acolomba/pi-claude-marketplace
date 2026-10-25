---
phase: 24-import-reasons
status: passed
verified: 2026-10-23
requirements: [IMP-08, IMP-09, IMP-10]
---

# Phase 24: Import Reasons - Verification

## Success criteria

| # | Criterion | Status | Evidence |
| --- | --- | --- | --- |
| 1 | A first-time import of an uninstallable plugin shows install's narrowed reason (IMP-08) | passed | `dispatchFailedOutcome` narrows through install's `narrowResolverReasons`; unit cases render `(unavailable) {unsupported hooks}` and `{unsupported component}`; scenario "Importing reports a plugin pi supports only in part as unavailable with the reason install gives" reads `{unsupported component}`, as `partial-install.feature` shows for `install`. |
| 2 | An unclassified import failure is not rendered as `{not in manifest}` (IMP-09) | passed | The unexpected-failure cases render a bare `(failed)` with the cause line; the new case renders `{network unreachable}`, `{authentication required}` (no cause line), and an add failure's `{source missing}`, as install's row does. `{not in manifest}` appears only on the absent-plugin `(unavailable)` row. |
| 3 | Import re-enabling a partially installed plugin reports `(partially-installed)` (IMP-10) | passed | The enable row is reconcile's `enabledRowFromOutcome`; unit case renders `◉ partial v1.0.0 (partially-installed) {orphan rewake, unsupported component}`; scenario "Importing a partially installed plugin the scope holds disabled enables it as partially installed" passes. |
| 4 | `npm run check` stays green | passed | Final run exit 0: static checks (typecheck, lint, fallow, format, pairing, check:features), unpaired and integration tests, 714/714 cucumber scenarios, direct coverage merged (280 records). |

Phase 19 gap: the held-dependency case ("leaves a record the load-time check holds down disabled and reports it already installed") seeds a `dependencyDisabled` record on real disk and asserts the skip row and the unchanged record.

Code review: `24-REVIEW.md` (1 critical, 3 warnings, 5 info); fixes in `24-REVIEW-FIX.md`. The critical (pinned row-policy maps) and all warnings are fixed, WR-03 partly.

## For the user

- Product change: a fresh import of a plugin that cannot be installed now reads install's reasons (e.g. `(unavailable) {unsupported component}`) instead of `{no longer installable}`; it keeps the `(unavailable)` status, not install's `(partially-available)` with a `--partial` hint, because import has no `--partial` flag (D-02).
- Product change: an unclassified import failure reads a bare `(failed)` plus its cause line (or the git-host / marketplace-add reason install shows), instead of `{not in manifest}`.
- Unfixed gap (WR-03): an install rollback-partial failure reads `(failed) {rollback partial}` on `install` but a bare `(failed)` on import, because import's outcome does not carry the rollback partials.
- Parity gap, out of scope: reconcile's own failed install still collapses both resolver arms to `{no longer installable}` (`reconcile/apply-outcomes.ts::classifyOrchestratorThrow`); the IMP-08 narrowing would apply there too.
- Shared-file edits (merge watch): `export` added to `narrowResolverReasons` (`plugin/install.messaging.ts`) and `enabledRowFromOutcome` (`reconcile/notify.ts`); `degradationFromEnable` moved from `reconcile/apply.ts` to `plugin/shared.ts`; one comment in `reconcile/apply-outcomes.ts`; `test/architecture/soft-dep-marker-policy.test.ts` pins import's new `partially-installed` policy; catalog prose in `docs/output-catalog.md` (import section).
- Tech debt (IN-03): import's enable outcome carries the companion facts twice (`declares*` and `enableSignals.staged*`), both derived from one enable outcome.
- No catalog-state pins changed: the `fresh-mixed-both-scopes` state already showed `{unsupported hooks}`, which import can now produce.

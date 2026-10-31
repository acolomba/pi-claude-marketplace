---
phase: 19-import-on-the-reconcile-path
plan: 01
subsystem: orchestrators/import
tags: [import, reconcile, state-lock, notifications]
requirements-completed: [IMP-05, IMP-06, IMP-07]
key-files:
  modified:
    - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
    - extensions/pi-claude-marketplace/shared/notification-types.ts
    - extensions/pi-claude-marketplace/shared/notify-reasons.ts
    - extensions/pi-claude-marketplace/shared/notification-wire.ts
    - features/plugin/import.feature
    - docs/output-catalog.md
    - test/orchestrators/import/execute.test.ts
    - test/architecture/catalog-uat/fixtures/plugin-import.ts
---

# Phase 19 Plan 01: Import on the Reconcile Path Summary

`import` now runs reconcile's read pass and planner with the Claude Code
settings as the desired state, reports what it skipped, and fails as
`lock held` with nothing changed under a held state lock.

## What changed

- **Read pass (IMP-05, IMP-07):** each scope with something to import takes
  the scope lock with `withLockedStateTransaction`, saves nothing, computes
  reconcile's satisfaction verdict, and runs `planReconcile` over a
  desired-state view built from the settings. The apply pass then runs with
  no outer lock through the same orchestrated add, install, and enable
  operations reconcile drives. `orchestrators/reconcile/apply.ts` is not
  edited.
- **Skips (IMP-06):** a marketplace already recorded with the settings'
  source renders `(skipped) {already added}` (new shared reason, appended at
  the tail of the closed set); a recorded plugin renders
  `(skipped) {already installed}`. A repeat import is `info`, no reload-hint.
- **Enable (D-06):** a recorded-but-disabled plugin the settings enable is
  enabled (not left disabled as before), renders the `(installed)` row
  reconcile uses for a re-enable, and is declared `{ enabled: true }`.
- **Lock held (IMP-07):** a held lock at the read pass fails each settings
  marketplace with the `marketplace add` lock row (`{lock held}` plus the
  lock error's full chain) and runs nothing. A lock taken mid-import fails
  the add or the plugin as `lock held` (new `StateLockHeldError` arm in
  `dispatchFailedOutcome`) instead of `unexpected-failure`.
- **Docs and gates:** two new catalog states (`repeat-import-skips`,
  `lock-held`) with fixtures; catalog and closed-set count pins bumped.

## Deviations

- Code review CR-01 found that following the planner's source claim (a
  settings marketplace recorded under another name) made the post-pass
  declare a key the next reload would uninstall. D-07 was revised: import
  adds such a marketplace as it did before the phase. See 19-REVIEW-FIX.md.
- WR-01: the verdict is passed to the planner so a dependency-held record is
  not enabled.

## Verification

- `node --test test/orchestrators/import/execute.test.ts`: 77/77; direct
  coverage of `execute.ts` 100%.
- `features/plugin/import.feature`: 10/10 (3 new scenarios: skipped header
  over a fresh install, enable of a disabled plugin, lock held).
- `npm run check`: see 19-VERIFICATION.md.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. The lock row shows the scope's own lock-file path unredacted, exactly as the install, enable, and `marketplace add` lock rows already do.

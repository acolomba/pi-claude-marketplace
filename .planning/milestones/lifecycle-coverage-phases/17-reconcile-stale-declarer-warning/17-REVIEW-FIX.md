---
phase: 17-reconcile-stale-declarer-warning
fixed_at: 2026-10-23T14:00:00Z
review_path: .planning/phases/17-reconcile-stale-declarer-warning/17-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 8
skipped: 0
status: all_fixed
---

# Phase 17: Code Review Fix Report

**Source review:** `17-REVIEW.md` (0 critical, 3 warning, 5 info)

## Fixed

- **WR-01** (brace contradicted its cause line): the declaration read's refused
  own manifest is now a typed `OwnManifestRefusal` (`ownManifest: true`) in
  `dependency-declaration-read.ts`, and `dependency-index.ts` maps it to
  `{unreadable manifest}`, which agrees with "its own manifest is present but
  cannot be read". A parser-rejected `dependencies` value stays
  `{invalid manifest}`. Tests in `dependency-declaration-read.test.ts`,
  `dependency-index.test.ts` and `apply.test.ts` re-pinned. CONTEXT D-05
  revised.
- **WR-03** (dedupe dropped the warning after success rows):
  `reportUnreadableDeclarer` now suppresses only after a failed row
  (`plugin-install/uninstall/enable/disable-failed`) or an uninstall of the
  same plugin, and runs after the backfill step. New `apply.test.ts` case: a
  config-driven disable of a dropped plugin renders the `(disabled)` row and
  the warning. CONTEXT D-08 revised.
- **IN-01**: bare `D-05` removed from the `DeclarerReadFailure` docblock.
- **IN-02**: `reportUnreadableDeclarer` docblock now says the failed read was
  of the plugin's own or marketplace manifest.
- **IN-03**: `satisfies` and `@ts-expect-error` proofs for
  `PluginDeclarerUnreadableOutcome` in `apply-outcomes.test.ts`.
- **IN-04**: `docs/json-output.md` tally `failures` now reads "Error rows."
- **IN-05**: `docs/dependency-resolution.md` "The load-time check" describes the
  warning row.
- Planning text: CONTEXT D-02 glyph corrected to `⊘`.

## Fixed after the user's decision (iteration 2)

- **WR-02** (tokens differ from `narrowProbeError`): the user decided
  (CONTEXT D-11) that a marketplace manifest load failure takes the shared
  classifier's token. `dependency-index.ts` now calls `narrowProbeError`:
  malformed JSON `{unparseable}`, schema-invalid `{invalid manifest}`, missing
  `{source missing}`, EACCES/EPERM `{permission denied}`, else `{unreadable}`.
  The `marketplace/update.feature` outline gains a `declarer reason` column,
  and `plugin/reconcile.feature` gains a malformed-JSON scenario (new shared
  step `the manifest of the marketplace {string} is no longer valid json`).

## Verification

`npm run check` re-run in this worktree after the fixes (see 17-VERIFICATION.md).

---
phase: 17-reconcile-stale-declarer-warning
fixed_at: 2026-10-23T14:00:00Z
review_path: .planning/phases/17-reconcile-stale-declarer-warning/17-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 7
skipped: 1
status: partial
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

## Skipped

- **WR-02** (tokens differ from `narrowProbeError`, which `list`/`info` use:
  malformed JSON is `{unparseable}` there, missing is `{source missing}`,
  EACCES is `{permission denied}`): left for the user. The 2026-10-23 decision
  names `{invalid manifest}` for an invalid marketplace manifest, which
  `narrowProbeError` would render `{unparseable}` for malformed JSON. Choosing
  one token set across surfaces is a user-facing call.

## Verification

`npm run check` re-run in this worktree after the fixes (see 17-VERIFICATION.md).
